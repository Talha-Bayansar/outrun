import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, nextWakeAt } from '../src/index.ts';
import type { State } from '../src/index.ts';

function running(): State {
  return { ...createSession('g', 'h', 'Host', 0, { preparationMs: 10, headStartMs: 20,
    durationMs: 100, revealIntervalMs: 30, revealWindowMs: 5 }), phase: 'countdown',
    deadlines: { runnersReleasedAt: 10, huntStartsAt: 30, endsAt: 130 },
    players: [{ id: 'h', name: 'Host', role: 'hunter', ready: true },
      { id: 'a', name: 'A', role: 'runner', ready: true }, { id: 'b', name: 'B', role: 'runner', ready: true }] };
}
test('scheduler follows phase and half-open reveal boundaries without replaying missed alarms', () => {
  const state = running();
  for (const [now, expected] of [[0, 10], [10, 30], [30, 60], [60, 65], [65, 90],
    [90, 95], [119, 120], [120, 125], [125, 130]]) {
    assert.equal(nextWakeAt(state, now), expected);
  }
  assert.equal(nextWakeAt(state, 130), undefined);
  assert.equal(nextWakeAt(state, 1000), undefined);
  assert.equal(nextWakeAt(createSession('g', 'h', 'Host', 0), 0), undefined);
  assert.equal(nextWakeAt({ ...state, phase: 'cancelled' }, 0), undefined);
  assert.equal(state.phase, 'countdown');
});
test('capture deadlines compete with reveals and due attempts reconcile before rescheduling', () => {
  const state = running();
  state.captures = [{ id: 'c', hunterId: 'h', targetId: 'a', evidenceId: 'e', status: 'pending_response',
    submittedAt: 31, responseDeadline: 40, reviewMs: 20 }];
  assert.equal(nextWakeAt(state, 31), 40);
  assert.equal(nextWakeAt(state, 40), 60);
  state.captures[0] = { ...state.captures[0], status: 'disputed', reviewDeadline: 62 };
  assert.equal(nextWakeAt(state, 59), 60);
  assert.equal(nextWakeAt(state, 60), 62);
  assert.equal(nextWakeAt(state, 62), 65);
  state.players = state.players.filter(p => p.id !== 'b');
  state.captures[0].status = 'pending_response';
  assert.equal(nextWakeAt(state, 40), undefined); // Last runner auto-confirms.
});
test('continuous and truncated windows schedule expiry, with game end taking priority', () => {
  const state = running();
  state.settings.revealWindowMs = 30;
  assert.equal(nextWakeAt(state, 60), 90);
  assert.equal(nextWakeAt(state, 90), 120);
  assert.equal(nextWakeAt(state, 120), 130);
  state.deadlines!.runnersReleasedAt = 0;
  state.deadlines!.huntStartsAt = 0;
  assert.equal(nextWakeAt(state, 0), 30);
  assert.throws(() => nextWakeAt({ ...state, lastAdvancedAt: 10 }, 9));
});
