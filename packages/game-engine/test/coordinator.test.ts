import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, createTracking, coordinateCommand, coordinateLocation,
  reconcileSession, projectSessionAggregate } from '../src/index.ts';
const policy = { maxAgeMs: 100, maxAccuracyMeters: 10, maxFutureMs: 0, maxSampleSkewMs: 10 };
function session() {
  let aggregate = { state: createSession('game', 'host', 'Host', 0, {
    preparationMs: 10, headStartMs: 20, durationMs: 100, revealIntervalMs: 30, revealWindowMs: 5,
  }), tracking: createTracking('game') };
  for (const actor of ['a', 'b', 'c']) aggregate = coordinateCommand(aggregate,
    { id: `join-${actor}`, type: 'join', name: actor }, actor, 0, policy).aggregate;
  for (const actor of ['host', 'a', 'b', 'c']) aggregate = coordinateCommand(aggregate,
    { id: `ready-${actor}`, type: 'ready', ready: true }, actor, 0, policy).aggregate;
  return coordinateCommand(aggregate, { id: 'start', type: 'start' }, 'host', 0, policy).aggregate;
}
const sample = { latitude: 50, longitude: 4, accuracyMeters: 2, observedAt: 40, sequence: 1 };

test('coordinator freezes reveals before ingestion and delivers copied member views', () => {
  const initial = session();
  const first = coordinateLocation(initial, 'a', sample, 40, policy);
  assert.equal(first.aggregate.state.phase, 'active');
  assert.equal(first.wakeAt, 60);
  const boundary = coordinateLocation(first.aggregate, 'a',
    { ...sample, latitude: 51, observedAt: 60, sequence: 2 }, 60, policy);
  const host = projectSessionAggregate(boundary.aggregate, 'host', policy)!;
  assert.equal(host.session.serverTime, 60);
  assert.equal(host.locations.reveal?.markers[0].latitude, 50);
  assert.equal(boundary.wakeAt, 65);
  assert.equal(projectSessionAggregate(boundary.aggregate, 'a', policy)?.locations.own?.latitude, 51);
  assert.equal(projectSessionAggregate(boundary.aggregate, 'outsider', policy), undefined);
  host.locations.reveal!.markers[0].latitude = 80;
  host.session.players[0].name = 'Changed';
  assert.equal(boundary.aggregate.tracking.reveal?.markers[0].latitude, 50);
  assert.equal(boundary.aggregate.state.players[0].name, 'Host');
  assert.deepEqual(initial.tracking.latest, {});
});

test('invalid commands and retries still reconcile deadlines and clear terminal tracking', () => {
  let aggregate = coordinateLocation(session(), 'a', sample, 40, policy).aggregate;
  const invalid = coordinateCommand(aggregate, { type: 'abort', actorId: 'host' }, 'a', 60, policy);
  assert.equal(invalid.reason, 'invalid_command');
  assert.equal(invalid.aggregate.tracking.reveal?.markers.length, 1);
  aggregate = invalid.aggregate;
  const retry = coordinateCommand(aggregate, { type: 'start', id: 'start' }, 'host', 65, policy);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.aggregate.tracking.reveal, undefined);
  const end = coordinateCommand(retry.aggregate, null, 'host', 130, policy);
  assert.equal(end.aggregate.state.result?.winner, 'runners');
  assert.deepEqual(end.aggregate.tracking, createTracking('game'));
  assert.equal(end.wakeAt, undefined);
  assert.throws(() => reconcileSession({ ...aggregate, tracking: createTracking('other') }, 60, policy));
});

test('untrusted locations reject safely, retain freshness rules, and reconcile on rejection', () => {
  const first = coordinateLocation(session(), 'a', sample, 40, policy);
  const spoofed = coordinateLocation(first.aggregate, 'a', { ...sample, receivedAt: 60 }, 60, policy);
  assert.equal(spoofed.reason, 'invalid_sample');
  assert.equal(spoofed.aggregate.state.lastAdvancedAt, 60);
  assert.equal(spoofed.aggregate.tracking.reveal?.markers[0].latitude, 50);
  assert.equal(spoofed.aggregate.tracking.latest.a.receivedAt, 40);
  const invalidActor = coordinateLocation(spoofed.aggregate, '', null, 61, policy);
  assert.equal(invalidActor.reason, 'invalid_actor');
  const stale = coordinateLocation(invalidActor.aggregate, 'a', { ...sample, observedAt: 0, sequence: 2 }, 101, policy);
  assert.equal(stale.reason, 'stale_sample');
  const replay = coordinateLocation(stale.aggregate, 'a', sample, 102, policy);
  assert.equal(replay.reason, 'out_of_order');
  const terminal = coordinateLocation(replay.aggregate, 'a', null, 130, policy);
  assert.equal(terminal.reason, 'invalid_sample');
  assert.equal(terminal.aggregate.state.phase, 'ended');
  assert.deepEqual(terminal.aggregate.tracking, createTracking('game'));
  assert.equal(terminal.wakeAt, undefined);
});

test('capture commands use aggregate observations and remove eliminated locations at deadlines', () => {
  let aggregate = session();
  for (const actor of ['host', 'a']) aggregate = coordinateLocation(aggregate, actor, sample, 40, policy).aggregate;
  const captured = coordinateCommand(aggregate,
    { id: 'capture', type: 'capture', targetId: 'a', evidenceId: 'photo' }, 'host', 60, policy,
    { radiusMeters: 20, responseMs: 2, reviewMs: 10,
      evidence: [{ id: 'photo', sessionId: 'game', ownerId: 'host', uploadedAt: 40 }] });
  assert.equal(captured.accepted, true);
  assert.equal(captured.wakeAt, 62);
  assert.equal(captured.aggregate.tracking.reveal?.markers.length, 1);
  const expired = reconcileSession(captured.aggregate, 62, policy);
  assert.equal(expired.aggregate.state.players.find(p => p.id === 'a')?.eliminated, true);
  assert.equal(Object.hasOwn(expired.aggregate.tracking.latest, 'a'), false);
  assert.deepEqual(expired.aggregate.tracking.reveal?.markers, []);
  assert.equal(expired.wakeAt, 65);
  const aborted = coordinateCommand(expired.aggregate, { id: 'abort', type: 'abort' }, 'host', 63, policy);
  assert.equal(aborted.accepted, true);
  assert.deepEqual(aborted.aggregate.tracking, createTracking('game'));
  assert.equal(aborted.wakeAt, undefined);
});
