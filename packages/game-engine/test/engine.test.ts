import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createSession, manhuntDefaults, revealWindow, transition, validateSettings } from '../src/index.ts';
import type { Command, State } from '../src/index.ts';

function lobby(): State {
  let state = createSession('game', 'host', 'Host', 0, {
    preparationMs: 10, headStartMs: 20, durationMs: 100, revealIntervalMs: 30, revealWindowMs: 5,
  });
  for (const actorId of ['a', 'b', 'c']) state = transition(state, { id: `join-${actorId}`, actorId, type: 'join', name: actorId }, 0).state;
  for (const actorId of ['host', 'a', 'b', 'c']) state = transition(state, { id: `ready-${actorId}`, actorId, type: 'ready', ready: true }, 0).state;
  return state;
}
const start: Command = { id: 'start', actorId: 'host', type: 'start' };

test('starts only with authorized, ready, mixed roster', () => {
  assert.equal(transition(createSession('g', 'host', 'H', 0), start, 0).reason, 'roster_not_ready');
  assert.equal(transition(lobby(), { ...start, actorId: 'a' }, 0).reason, 'host_required');
  const state = transition(lobby(), start, 0).state;
  assert.deepEqual(state.deadlines, { runnersReleasedAt: 10, huntStartsAt: 30, endsAt: 130 });
  assert.equal(advance(state, 9).phase, 'countdown');
  assert.equal(advance(state, 10).phase, 'head_start');
  assert.equal(advance(state, 30).phase, 'active');
  assert.equal(advance(state, 130).phase, 'ended');
});
test('reveal windows are half open and recovery skips old windows', () => {
  const state = transition(lobby(), start, 0).state;
  assert.equal(revealWindow(state, 59), undefined);
  assert.deepEqual(revealWindow(state, 60), { number: 1, startsAt: 60, expiresAt: 65 });
  assert.equal(revealWindow(state, 65), undefined);
  assert.equal(revealWindow(state, 130), undefined);
  assert.deepEqual(revealWindow(state, 121), { number: 3, startsAt: 120, expiresAt: 125 });
});
test('duplicate commands have no repeated effects and collisions reject', () => {
  const original = lobby();
  const accepted = transition(original, start, 0);
  const retry = transition(accepted.state, start, 5);
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.state.deadlines, accepted.state.deadlines);
  assert.equal(transition(accepted.state, { ...start, actorId: 'a' }, 5).reason, 'command_id_conflict');
  assert.equal(original.phase, 'lobby');
  assert.equal(original.deadlines, undefined);
});
test('deadline takes priority over abort; terminal results remain immutable', () => {
  const running = transition(lobby(), start, 0).state;
  const outcome = transition(running, { id: 'abort', actorId: 'host', type: 'abort' }, 130);
  assert.equal(outcome.reason, 'session_finished');
  assert.deepEqual(outcome.state.result, { winner: 'runners', endedAt: 130 });
  assert.strictEqual(advance(outcome.state, 200), outcome.state);
  assert.strictEqual(transition(outcome.state, start, 200).state, outcome.state);
});
test('role changes invalidate readiness; late joins are rejected', () => {
  const changed = transition(lobby(), { id: 'assign', actorId: 'host', type: 'assign', playerId: 'a', role: 'hunter' }, 0);
  assert.equal(changed.state.players.find(p => p.id === 'a')?.ready, false);
  assert.equal(transition(changed.state, start, 0).accepted, false);
  const running = transition(lobby(), start, 0).state;
  assert.equal(transition(running, { id: 'late', actorId: 'late', type: 'join', name: 'Late' }, 0).reason, 'lobby_required');
});
test('zero head start releases both teams together; recovery ends directly', () => {
  const initial = { ...lobby(), settings: { ...lobby().settings, headStartMs: 0 } };
  const running = transition(initial, start, 0).state;
  assert.equal(advance(running, 10).phase, 'active');
  assert.equal(advance(running, 1000).result?.endedAt, 110);
});
test('invalid timers and backwards clocks reject', () => {
  assert.throws(() => validateSettings({ ...manhuntDefaults, revealWindowMs: Infinity }));
  assert.throws(() => validateSettings({ ...manhuntDefaults, revealWindowMs: 200_000 }));
  assert.throws(() => advance(createSession('g', 'h', 'Host', 10), 9));
});
test('arbitrary command IDs cannot read inherited receipts', () => {
  const outcome = transition(lobby(), { ...start, id: 'toString' }, 0);
  assert.equal(outcome.accepted, true);
  assert.equal(transition(outcome.state, { ...start, id: 'toString' }, 1).duplicate, true);
});
