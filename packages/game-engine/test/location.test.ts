import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessBoundary, assessProximity, distanceMeters, observationRejection } from '../src/index.ts';
import type { Observation } from '../src/index.ts';

const policy = { maxAccuracyMeters: 20, maxAgeMs: 1000, maxFutureMs: 50, maxSampleSkewMs: 100 };
const sample: Observation = { latitude: 0, longitude: 0, accuracyMeters: 2, observedAt: 1000, receivedAt: 1010, sequence: 1 };
const east = (meters: number): Observation => ({ ...sample, longitude: meters / 6_371_008.8 * 180 / Math.PI });

test('geodesic distance handles identical, antipodal, polar and antimeridian points', () => {
  assert.equal(distanceMeters(sample, sample), 0);
  assert.ok(Math.abs(distanceMeters(sample, east(100)) - 100) < 0.000001);
  assert.ok(Math.abs(distanceMeters(sample, { latitude: 0, longitude: 180 }) - Math.PI * 6_371_008.8) < 0.001);
  assert.ok(distanceMeters({ latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }) < 223);
  assert.ok(distanceMeters({ latitude: 90, longitude: 0 }, { latitude: 90, longitude: 180 }) < 0.001);
  assert.throws(() => distanceMeters(sample, { latitude: NaN, longitude: 0 }));
});
test('observations validate ordering, coordinates, quality and both clocks', () => {
  assert.equal(observationRejection(sample, 2000, policy), undefined);
  assert.equal(observationRejection(sample, 2001, policy), 'stale_sample');
  assert.equal(observationRejection({ ...sample, receivedAt: 2001 }, 2001, policy), 'stale_sample');
  assert.equal(observationRejection(sample, 1010, policy, 1), 'out_of_order');
  assert.equal(observationRejection({ ...sample, latitude: 91 }, 1010, policy), 'invalid_sample');
  assert.equal(observationRejection({ ...sample, sequence: 1.5 }, 1010, policy), 'invalid_sample');
  assert.equal(observationRejection({ ...sample, accuracyMeters: -1 }, 1010, policy), 'invalid_sample');
  assert.equal(observationRejection({ ...sample, accuracyMeters: 21 }, 1010, policy), 'poor_accuracy');
  assert.equal(observationRejection(sample, 1000, policy), 'future_sample');
  assert.equal(observationRejection({ ...sample, observedAt: 1061 }, 1100, policy), 'future_sample');
  assert.equal(observationRejection({ ...sample, observedAt: 1060 }, 1100, policy), undefined);
  assert.throws(() => observationRejection(sample, 1010, { ...policy, maxAgeMs: -1 }));
});
test('proximity distinguishes clear results from uncertainty and unavailable readings', () => {
  assert.equal(assessProximity(sample, east(10), 20, 1010, policy).status, 'in_range');
  assert.equal(assessProximity(sample, east(30), 20, 1010, policy).status, 'out_of_range');
  assert.equal(assessProximity(sample, east(20), 20, 1010, policy).status, 'ambiguous');
  assert.deepEqual(assessProximity(sample, { ...east(10), observedAt: 899 }, 20, 1010, policy), { status: 'unavailable', reason: 'sample_skew' });
  assert.deepEqual(assessProximity(sample, east(10), 20, 2001, policy), { status: 'unavailable', reason: 'stale_sample' });
  assert.equal(assessProximity(sample, { ...sample, accuracyMeters: 20 }, 22, 1010, policy).status, 'in_range');
  assert.equal(assessProximity(sample, sample, 3, 1010, policy).status, 'ambiguous');
});
test('boundary warnings preserve state at uncertain edges and use hysteresis', () => {
  const area = { center: { latitude: 0, longitude: 0 }, radiusMeters: 100 };
  assert.equal(assessBoundary(east(50), area, 1010, policy).status, 'inside');
  assert.equal(assessBoundary(east(150), area, 1010, policy).status, 'outside');
  assert.equal(assessBoundary(east(100), area, 1010, policy).status, 'unknown');
  assert.equal(assessBoundary(east(108), area, 1010, policy, 'inside', 10).status, 'inside');
  assert.equal(assessBoundary(east(113), area, 1010, policy, 'inside', 10).status, 'outside');
  assert.equal(assessBoundary(east(95), area, 1010, policy, 'outside', 10).status, 'outside');
  assert.equal(assessBoundary(east(87), area, 1010, policy, 'outside', 10).status, 'inside');
  assert.deepEqual(assessBoundary(sample, area, 2001, policy, 'outside'), { status: 'outside', reason: 'stale_sample' });
  assert.throws(() => assessBoundary(sample, area, 1010, policy, 'inside', 100));
});
