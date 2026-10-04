import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClientLocation } from '../src/index.ts';
const sample = { latitude: 50, longitude: 4, accuracyMeters: 2, observedAt: 40, sequence: 1 };

test('device contract accepts coordinate boundaries and returns independent explicit fields', () => {
  const parsed = parseClientLocation(sample, 'member');
  assert.equal(parsed.accepted, true);
  if (!parsed.accepted) return;
  assert.deepEqual(parsed.sample, sample);
  parsed.sample.latitude = 80;
  assert.equal(sample.latitude, 50);
  for (const latitude of [-90, 90]) for (const longitude of [-180, 180]) {
    assert.equal(parseClientLocation({ ...sample, latitude, longitude, accuracyMeters: 0,
      observedAt: 0, sequence: Number.MAX_SAFE_INTEGER }, '__proto__').accepted, true);
  }
});

test('device contract rejects malformed numbers, missing fields, and injected server data', () => {
  for (const payload of [null, undefined, [], 'location', 42, true]) {
    assert.equal(parseClientLocation(payload, 'member').accepted, false);
  }
  for (const key of Object.keys(sample)) {
    const missing = { ...sample };
    delete missing[key as keyof typeof sample];
    assert.equal(parseClientLocation(missing, 'member').accepted, false);
    for (const value of ['1', null, undefined, NaN, Infinity, -Infinity]) {
      assert.equal(parseClientLocation({ ...sample, [key]: value }, 'member').accepted, false);
    }
  }
  for (const [key, value] of [['latitude', 90.1], ['longitude', -180.1], ['accuracyMeters', -1],
    ['observedAt', -1], ['observedAt', 1.5], ['sequence', -1], ['sequence', 1.5],
    ['sequence', Number.MAX_SAFE_INTEGER + 1]]) {
    assert.equal(parseClientLocation({ ...sample, [key]: value }, 'member').accepted, false);
  }
  for (const key of ['actorId', 'receivedAt', 'sessionId', 'tracking', 'extra']) {
    assert.equal(parseClientLocation({ ...sample, [key]: 'injected' }, 'member').accepted, false);
  }
  const inherited = Object.assign(Object.create({ sequence: 1 }), sample);
  delete inherited.sequence;
  assert.equal(parseClientLocation(inherited, 'member').accepted, false);
  for (const actor of ['', ' ', 'x'.repeat(81)]) {
    assert.deepEqual(parseClientLocation(sample, actor), { accepted: false, reason: 'invalid_actor' });
  }
});
