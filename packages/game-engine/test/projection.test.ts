import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, projectSession, canViewCaptureEvidence } from '../src/index.ts';
import type { State } from '../src/index.ts';

function fixture(): State {
  return { ...createSession('g', 'host', 'Host', 0), phase: 'active',
    deadlines: { runnersReleasedAt: 0, huntStartsAt: 0, endsAt: 100 },
    players: ['host', 'hunter', 'target', 'other'].map(id => ({ id, name: id,
      role: id === 'hunter' ? 'hunter' : 'runner', ready: true })),
    receipts: { secret: { fingerprint: 'private-command', accepted: true } },
    captures: [{ id: 'attempt', hunterId: 'hunter', targetId: 'target', evidenceId: 'photo',
      status: 'pending_response', submittedAt: 1, responseDeadline: 20, reviewMs: 30 }] };
}
test('member views omit receipts and restrict capture evidence to participants and dispute reviewer', () => {
  const state = fixture();
  assert.equal(projectSession(state, 'outsider', 2), undefined);
  for (const id of ['host', 'other']) {
    assert.deepEqual(projectSession(state, id, 2)?.captures, []);
    assert.equal(canViewCaptureEvidence(state, id, 'photo', 2), false);
  }
  for (const id of ['hunter', 'target']) {
    const view = projectSession(state, id, 2)!;
    assert.equal('receipts' in view, false);
    assert.equal('reviewMs' in view.captures[0], false);
    assert.equal(canViewCaptureEvidence(state, id, 'photo', 2), true);
  }
  state.captures![0].status = 'disputed';
  state.captures![0].reviewDeadline = 30;
  assert.equal(canViewCaptureEvidence(state, 'host', 'photo', 2), true);
  assert.equal(canViewCaptureEvidence(state, 'other', 'photo', 2), false);
});
test('deadline reconciliation revokes evidence and does not leak mutable state references', () => {
  const state = fixture();
  const view = projectSession(state, 'target', 2)!;
  view.players[0].name = 'changed';
  view.settings.durationMs = 1;
  view.deadlines!.endsAt = 1;
  view.captures[0].status = 'rejected';
  assert.equal(state.players[0].name, 'host');
  assert.equal(state.deadlines!.endsAt, 100);
  assert.equal(state.captures![0].status, 'pending_response');
  assert.equal(canViewCaptureEvidence(state, 'target', 'photo', 20), false);
  assert.equal(projectSession(state, 'target', 20)?.captures[0].status, 'confirmed');
  assert.equal(projectSession(state, 'target', 100)?.phase, 'ended');
  assert.equal(canViewCaptureEvidence({ ...state, phase: 'cancelled' }, 'target', 'photo', 2), false);
  state.captures![0].status = 'disputed';
  state.captures![0].reviewDeadline = 30;
  assert.equal(canViewCaptureEvidence(state, 'host', 'photo', 30), false);
});
