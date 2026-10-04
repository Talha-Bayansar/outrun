import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClientCommand, createSession, transition } from '../src/index.ts';

test('client commands bind authenticated identity and canonicalize retried JSON', () => {
  const first = parseClientCommand({ id: 'ready', type: 'ready', ready: true }, 'host');
  const retry = parseClientCommand({ ready: true, type: 'ready', id: 'ready' }, 'host');
  assert.equal(first.accepted, true);
  assert.equal(retry.accepted, true);
  if (!first.accepted || !retry.accepted) throw new Error('Expected commands');
  const state = transition(createSession('g', 'host', 'Host', 0), first.command, 1).state;
  assert.equal(transition(state, retry.command, 2).duplicate, true);
  assert.equal(first.command.actorId, 'host');
  assert.equal(parseClientCommand({ id: 'x', type: 'abort', actorId: 'host' }, 'other').accepted, false);
});
test('all supported commands validate required fields without coercion', () => {
  const bodies = [{ type: 'join', name: 'Runner' }, { type: 'ready', ready: false },
    { type: 'assign', playerId: 'runner', role: 'runner' }, { type: 'start' }, { type: 'abort' },
    { type: 'capture', targetId: 'runner', evidenceId: 'photo' },
    { type: 'accept_capture', captureId: 'attempt' }, { type: 'dispute_capture', captureId: 'attempt' },
    { type: 'review_capture', captureId: 'attempt', approve: false }];
  for (const body of bodies) {
    assert.equal(parseClientCommand({ id: 'x', ...body }, 'actor').accepted, true);
    for (const key of Object.keys(body)) {
      const missing: Record<string, unknown> = { id: 'x', ...body };
      delete missing[key];
      assert.equal(parseClientCommand(missing, 'actor').accepted, false);
    }
  }
  for (const payload of [null, [], 'start', 1, { id: 'x', type: 'unknown' },
    { id: 'x', type: 'ready', ready: 'true' }, { id: ' ', type: 'start' },
    { id: 'x', type: 'capture', targetId: 'r', evidenceId: 'e', tracking: {} },
    { id: 'x', type: 'start', receivedAt: 1 }, { id: 'x'.repeat(81), type: 'start' }]) {
    assert.equal(parseClientCommand(payload, 'actor').accepted, false);
  }
  assert.equal(parseClientCommand({ id: 'x', type: 'start' }, '').accepted, false);
  assert.equal(parseClientCommand(Object.create({ id: 'x', type: 'start' }), 'actor').accepted, false);
});
