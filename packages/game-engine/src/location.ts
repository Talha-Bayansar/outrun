/** Private observations. Adapters associate these with authenticated membership. */
export interface Coordinate { latitude: number; longitude: number }
export interface Observation extends Coordinate {
  accuracyMeters: number;
  observedAt: number;
  receivedAt: number;
  sequence: number;
}
export interface LocationPolicy {
  maxAccuracyMeters: number;
  maxAgeMs: number;
  maxFutureMs: number;
  maxSampleSkewMs: number;
}
export type LocationRejection = 'invalid_sample' | 'out_of_order' | 'future_sample' | 'stale_sample' | 'poor_accuracy';

function nonnegative(value: number): boolean { return Number.isFinite(value) && value >= 0; }
function timestamp(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
export function validCoordinate(value: Coordinate): boolean {
  return Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
function validatePolicy(policy: LocationPolicy): void {
  if (!nonnegative(policy.maxAccuracyMeters) ||
      ![policy.maxAgeMs, policy.maxFutureMs, policy.maxSampleSkewMs].every(timestamp)) {
    throw new Error('Invalid location policy');
  }
}
/** Recheck freshness at use time; receiving an old sample never refreshes it. */
export function observationRejection(sample: Observation, now: number, policy: LocationPolicy,
  previousSequence?: number): LocationRejection | undefined {
  validatePolicy(policy);
  if (!timestamp(now)) throw new Error('Invalid server time');
  if (!validCoordinate(sample) || !nonnegative(sample.accuracyMeters) ||
      ![sample.observedAt, sample.receivedAt, sample.sequence].every(timestamp)) return 'invalid_sample';
  if (previousSequence !== undefined && (!timestamp(previousSequence) || sample.sequence <= previousSequence)) return 'out_of_order';
  if (sample.receivedAt > now || sample.observedAt - sample.receivedAt > policy.maxFutureMs ||
      sample.observedAt - now > policy.maxFutureMs) return 'future_sample';
  if (now - sample.observedAt > policy.maxAgeMs || now - sample.receivedAt > policy.maxAgeMs) return 'stale_sample';
  if (sample.accuracyMeters > policy.maxAccuracyMeters) return 'poor_accuracy';
}

/** Great-circle distance using mean Earth radius, including antimeridian crossings. */
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  if (!validCoordinate(a) || !validCoordinate(b)) throw new Error('Invalid coordinate');
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const h = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(a.latitude * radians) *
    Math.cos(b.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export type Proximity = { status: 'in_range' | 'out_of_range' | 'ambiguous'; distanceMeters: number;
  minimumMeters: number; maximumMeters: number } |
  { status: 'unavailable'; reason: LocationRejection | 'sample_skew' };
/** Accuracy is a heuristic uncertainty estimate, never proof of physical proximity. */
export function assessProximity(a: Observation, b: Observation, radiusMeters: number,
  now: number, policy: LocationPolicy): Proximity {
  if (!nonnegative(radiusMeters)) throw new Error('Invalid proximity radius');
  const reason = observationRejection(a, now, policy) ?? observationRejection(b, now, policy);
  if (reason) return { status: 'unavailable', reason };
  if (Math.abs(a.observedAt - b.observedAt) > policy.maxSampleSkewMs) return { status: 'unavailable', reason: 'sample_skew' };
  const distance = distanceMeters(a, b);
  const uncertainty = a.accuracyMeters + b.accuracyMeters;
  const minimumMeters = Math.max(0, distance - uncertainty);
  const maximumMeters = distance + uncertainty;
  return { status: maximumMeters <= radiusMeters ? 'in_range' : minimumMeters > radiusMeters ? 'out_of_range' : 'ambiguous',
    distanceMeters: distance, minimumMeters, maximumMeters };
}
export interface PlayingArea { center: Coordinate; radiusMeters: number }
/** Warning assessment only. Ambiguous/stale readings preserve the last clear status. */
export function assessBoundary(sample: Observation, area: PlayingArea, now: number,
  policy: LocationPolicy, previous: 'inside' | 'outside' | 'unknown' = 'unknown', hysteresisMeters = 0):
  { status: 'inside' | 'outside' | 'unknown'; reason?: LocationRejection; distanceMeters?: number } {
  if (!validCoordinate(area.center) || !nonnegative(area.radiusMeters) || area.radiusMeters === 0 ||
      !nonnegative(hysteresisMeters) || hysteresisMeters >= area.radiusMeters) throw new Error('Invalid playing area');
  const reason = observationRejection(sample, now, policy);
  if (reason) return { status: previous, reason };
  const distance = distanceMeters(sample, area.center);
  const insideLimit = area.radiusMeters - (previous === 'outside' ? hysteresisMeters : 0);
  const outsideLimit = area.radiusMeters + (previous === 'inside' ? hysteresisMeters : 0);
  const status = distance + sample.accuracyMeters <= insideLimit ? 'inside' :
    distance - sample.accuracyMeters > outsideLimit ? 'outside' : previous;
  return { status, distanceMeters: distance };
}
