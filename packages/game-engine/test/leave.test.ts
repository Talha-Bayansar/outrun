import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, transition, createTracking, reconcileTracking, projectSession, parseClientCommand } from '../src/index.ts';

function roster() {
  let state = createSession('game', 'host', 'Host', 0, { preparationMs: 0, headStartMs: 0,
    durationMs: 10000, revealIntervalMs: 1000, revealWindowMs: 100 });
  for (const id of ['a', 'b', 'c']) state = transition(state, { id: `join-${id}`, actorId: id, type: 'join', name: id }, 0).state;
  return state;
}
test('lobby leave transfers host, revokes views, and excludes departed readiness', () => {
  const state = transition(roster(), { id: 'leave', actorId: 'host', type: 'leave' }, 1).state;
  assert.equal(state.hostId, 'a');
  assert.equal(state.players[0].left, true);
  assert.equal(projectSession(state, 'host', 1), undefined);
  assert.equal(transition(state, { id: 'ready', actorId: 'host', type: 'ready', ready: true }, 1).reason, 'membership_required');
  assert.equal(parseClientCommand({ id: 'leave', type: 'leave' }, 'a').accepted, true);
});
test('runner forfeits end once, retries are safe, and all hunters leaving cancels', () => {
  let state = roster();
  for (const p of state.players) state = transition(state, { id: `ready-${p.id}`, actorId: p.id, type: 'ready', ready: true }, 0).state;
  state = transition(state, { id: 'start', actorId: 'host', type: 'start' }, 0).state;
  for (const actorId of ['a', 'b', 'c']) {
    const command = { id: `leave-${actorId}`, actorId, type: 'leave' as const };
    const result = transition(state, command, 1);
    assert.equal(result.accepted, true);
    assert.equal(transition(result.state, command, 1).duplicate, true);
    state = result.state;
  }
  assert.deepEqual(state.result, { winner: 'hunters', endedAt: 1 });
  assert.deepEqual(reconcileTracking(state, createTracking('game'), 1,
    { maxAccuracyMeters: 20, maxAgeMs: 1000, maxFutureMs: 0, maxSampleSkewMs: 500 }).latest, {});
  let fresh = roster();
  for (const p of fresh.players) fresh = transition(fresh, { id: `r-${p.id}`, actorId: p.id, type: 'ready', ready: true }, 0).state;
  fresh = transition(fresh, { id: 'start', actorId: 'host', type: 'start' }, 0).state;
  assert.equal(transition(fresh, { id: 'leave', actorId: 'host', type: 'leave' }, 1).state.phase, 'cancelled');
});
