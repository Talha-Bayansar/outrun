import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createSession, createTracking, ingestLocation, projectLocations, reconcileTracking, transition } from '../src/index.ts';
import type { CaptureContext, State } from '../src/index.ts';
const policy = { maxAgeMs: 1000, maxAccuracyMeters: 10, maxFutureMs: 0, maxSampleSkewMs: 10 };
function fixture() {
  let state = createSession('g', 'h', 'Host', 0, { preparationMs: 0, headStartMs: 0, durationMs: 100, revealIntervalMs: 10, revealWindowMs: 5 });
  for (const actorId of ['a', 'b', 'c']) state = transition(state, { id: `join-${actorId}`, actorId, type: 'join', name: actorId }, 0).state;
  for (const actorId of state.players.map(p => p.id)) state = transition(state, { id: `ready-${actorId}`, actorId, type: 'ready', ready: true }, 0).state;
  state = transition(state, { id: 'start', actorId: 'h', type: 'start' }, 0).state;
  let tracking = createTracking('g');
  for (const actorId of ['h', 'a', 'b', 'c']) tracking = ingestLocation(state, tracking, actorId,
    { latitude: 50, longitude: 4, accuracyMeters: 2, observedAt: 1, sequence: 1 }, 1, policy).tracking;
  const context: CaptureContext = { tracking, locationPolicy: policy, radiusMeters: 10, responseMs: 10, reviewMs: 20,
    evidence: ['a', 'b', 'c', 'other'].map(id => ({ id, sessionId: 'g', ownerId: 'h', uploadedAt: 1 })) };
  return { state, context };
}
function attempt(state: State, context: CaptureContext, targetId = 'a', id = targetId, now = 2) {
  return transition(state, { id, actorId: 'h', type: 'capture', targetId, evidenceId: id }, now, context);
}
test('capture submission validates authority, evidence and private proximity', () => {
  const { state, context } = fixture();
  assert.equal(attempt(state, context).accepted, true);
  assert.equal(attempt(state, { ...context, evidence: [] }).reason, 'verified_evidence_required');
  assert.equal(attempt(state, { ...context, radiusMeters: 1 }).reason, 'ambiguous');
  assert.equal(attempt(state, context, 'h').reason, 'target_unavailable');
  assert.equal(transition(state, { id: 'x', actorId: 'a', type: 'capture', targetId: 'b', evidenceId: 'a' }, 2, context).reason, 'hunter_required');
  const pending = attempt(state, context).state;
  assert.equal(pending.players.find(p => p.id === 'a')?.eliminated, undefined);
  assert.equal(attempt(pending, context).duplicate, true);
  assert.equal(attempt(pending, context, 'a', 'other').accepted, true);
});
test('target acceptance eliminates once, expires competing attempts, and removes tracking visibility', () => {
  const { state, context } = fixture();
  let pending = attempt(state, context).state;
  pending = attempt(pending, context, 'a', 'other').state;
  assert.equal(transition(pending, { id: 'bad', actorId: 'b', type: 'accept_capture', captureId: 'a' }, 3).reason, 'target_required');
  const command = { id: 'accept', actorId: 'a', type: 'accept_capture' as const, captureId: 'a' };
  const accepted = transition(pending, command, 3).state;
  assert.deepEqual(accepted.captures?.map(c => c.status), ['confirmed', 'expired']);
  assert.equal(transition(accepted, command, 4).duplicate, true);
  assert.deepEqual(projectLocations(accepted, context.tracking, 'a', 10, policy), {});
  assert.equal(reconcileTracking(accepted, context.tracking, 10, policy).latest.a, undefined);
  assert.equal(projectLocations(accepted, context.tracking, 'h', 10, policy).reveal?.markers.some(m => m.playerId === 'a'), false);
});
test('disputes require host review, expire at review deadline, and cannot reverse final decisions', () => {
  const { state, context } = fixture();
  const pending = attempt(state, context).state;
  const disputed = transition(pending, { id: 'dispute', actorId: 'a', type: 'dispute_capture', captureId: 'a' }, 3).state;
  const review = { id: 'review', actorId: 'h', type: 'review_capture' as const, captureId: 'a', approve: true };
  assert.equal(transition(disputed, { ...review, actorId: 'b' }, 4).reason, 'host_required');
  assert.equal(transition(disputed, review, 4).state.captures?.[0].reviewerId, 'h');
  const rejected = transition(disputed, { ...review, approve: false }, 4).state;
  assert.equal(rejected.captures?.[0].status, 'rejected');
  assert.equal(transition(rejected, { ...review, id: 'reverse' }, 5).reason, 'capture_unavailable');
  assert.equal(transition(disputed, review, 23).reason, 'capture_unavailable');
  assert.equal(advance(disputed, 23).captures?.[0].status, 'expired');
});
test('response deadlines auto-confirm; all runners captured produce immutable hunter victory', () => {
  const { state, context } = fixture();
  let pending = state;
  for (const target of ['a', 'b', 'c']) pending = attempt(pending, context, target).state;
  const ended = advance(pending, 12);
  assert.deepEqual(ended.result, { winner: 'hunters', endedAt: 12 });
  assert.equal(ended.captures?.filter(c => c.status === 'confirmed').length, 3);
  assert.strictEqual(advance(ended, 150), ended);
  assert.equal(transition(pending, { id: 'late-dispute', actorId: 'a', type: 'dispute_capture', captureId: 'a' }, 12).reason, 'session_finished');
});
test('game expiry takes priority over unresolved captures, including recovery and exact deadlines', () => {
  const { state, context } = fixture();
  const pending = attempt(state, context).state;
  const recovered = advance(pending, 100);
  assert.equal(recovered.result?.winner, 'runners');
  assert.equal(recovered.captures?.[0].status, 'expired');
  const boundary = attempt(state, context, 'a', 'a', 90).state;
  assert.equal(advance(boundary, 100).captures?.[0].status, 'expired');
  assert.equal(attempt(state, context, 'a', 'a', 100).reason, 'session_finished');
  assert.equal(transition(pending, { id: 'abort', actorId: 'h', type: 'abort' }, 3).state.captures?.[0].status, 'expired');
});
