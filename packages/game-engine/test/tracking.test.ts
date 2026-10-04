import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createSession, createTracking, ingestLocation, projectLocations, reconcileTracking, transition } from '../src/index.ts';
const policy = { maxAgeMs: 100, maxAccuracyMeters: 10, maxFutureMs: 0, maxSampleSkewMs: 10 };
const sample = { latitude: 50, longitude: 4, accuracyMeters: 2, observedAt: 40, sequence: 1 };
function session() {
  let state = createSession('game', 'host', 'Host', 0, {
    preparationMs: 10, headStartMs: 20, durationMs: 100, revealIntervalMs: 30, revealWindowMs: 5,
  });
  for (const actorId of ['a', 'b', '__proto__']) state = transition(state, { id: `join-${actorId}`, actorId, type: 'join', name: actorId }, 0).state;
  for (const actorId of state.players.map(p => p.id)) state = transition(state, { id: `ready-${actorId}`, actorId, type: 'ready', ready: true }, 0).state;
  return transition(state, { id: 'start', actorId: 'host', type: 'start' }, 0).state;
}
test('ingestion requires membership and active tracking, validates order, and stamps server time', () => {
  const state = session();
  const empty = createTracking(state.id);
  assert.equal(ingestLocation(state, empty, 'stranger', sample, 40, policy).reason, 'membership_required');
  const accepted = ingestLocation(state, empty, '__proto__', { ...sample, receivedAt: 999 } as typeof sample, 40, policy);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.tracking.latest['__proto__'].receivedAt, 40);
  assert.deepEqual(empty.latest, {});
  assert.equal(ingestLocation(state, accepted.tracking, '__proto__', sample, 41, policy).reason, 'out_of_order');
  assert.equal(ingestLocation(state, empty, 'a', { ...sample, accuracyMeters: 11 }, 40, policy).reason, 'poor_accuracy');
  assert.equal(ingestLocation(createSession('game', 'host', 'H', 0), empty, 'host', sample, 40, policy).reason, 'tracking_inactive');
  assert.throws(() => reconcileTracking(state, createTracking('other'), 40, policy));
});
test('reveal freezes before same-time ingestion and remains identical after reconnect', () => {
  const state = session();
  let tracking = ingestLocation(state, createTracking(state.id), 'a', sample, 40, policy).tracking;
  assert.deepEqual(projectLocations(state, tracking, 'host', 59, policy), {});
  tracking = ingestLocation(state, tracking, 'a', { ...sample, latitude: 51, observedAt: 60, sequence: 2 }, 60, policy).tracking;
  assert.equal(tracking.reveal?.markers[0].latitude, 50);
  const view = projectLocations(state, tracking, 'host', 64, policy);
  assert.deepEqual(view.reveal, tracking.reveal);
  view.reveal!.markers[0].latitude = 80;
  assert.equal(tracking.reveal?.markers[0].latitude, 50);
  assert.equal(projectLocations(state, tracking, 'host', 65, policy).reveal, undefined);
  assert.equal(reconcileTracking(state, tracking, 65, policy).reveal, undefined);
});
test('privacy projections restrict runners and outsiders, including a runner host', () => {
  const state = session();
  const tracking = ingestLocation(state, createTracking(state.id), 'a', sample, 40, policy).tracking;
  assert.deepEqual(projectLocations(state, tracking, 'outsider', 60, policy), {});
  const runner = projectLocations(state, tracking, 'a', 60, policy);
  assert.equal(runner.own?.latitude, 50);
  assert.equal(runner.reveal, undefined);
  assert.equal('sequence' in runner.own!, false);
  assert.equal('receivedAt' in runner.own!, false);
  const runnerHost = { ...state, hostId: 'a' };
  assert.equal(projectLocations(runnerHost, tracking, 'a', 60, policy).reveal, undefined);
});
test('recovery excludes late/stale samples and terminal reconciliation clears private state', () => {
  const state = session();
  let tracking = ingestLocation(state, createTracking(state.id), 'a', sample, 40, policy).tracking;
  tracking = ingestLocation(state, tracking, 'b', { ...sample, observedAt: 61 }, 61, policy).tracking;
  // Simulate persisted latest observations without a persisted reveal after recovery.
  const recovered = reconcileTracking(state, { ...tracking, reveal: undefined }, 62, policy);
  assert.deepEqual(recovered.reveal?.markers.map(m => m.playerId), ['a']);
  assert.equal(reconcileTracking(state, recovered, 100, policy).reveal, undefined);
  assert.equal(reconcileTracking(state, recovered, 120, { ...policy, maxAgeMs: 10 }).reveal?.markers.length, 0);
  const terminal = advance(state, 130);
  assert.deepEqual(reconcileTracking(terminal, tracking, 130, policy), createTracking(state.id));
  assert.deepEqual(projectLocations(terminal, tracking, 'host', 130, policy), {});
  assert.equal(ingestLocation(state, tracking, 'a', { ...sample, observedAt: 130, sequence: 2 }, 130, policy).reason, 'tracking_inactive');
  const cancelled = transition(state, { id: 'abort', actorId: 'host', type: 'abort' }, 50).state;
  assert.deepEqual(reconcileTracking(cancelled, tracking, 50, policy).latest, {});
});
