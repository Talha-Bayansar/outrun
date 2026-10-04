import { advance, revealWindow } from './index.ts';
import type { State } from './index.ts';
import { observationRejection } from './location.ts';
import type { LocationPolicy, Observation, LocationRejection } from './location.ts';

export interface RevealMarker {
  playerId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  observedAt: number;
}
/** Server-only state: never serialize this object to a player. */
export interface TrackingState {
  sessionId: string;
  latest: Record<string, Observation>;
  reveal?: { number: number; startsAt: number; expiresAt: number; markers: RevealMarker[] };
}
export function createTracking(sessionId: string): TrackingState {
  return { sessionId, latest: {} };
}
function ownSample(tracking: TrackingState, id: string): Observation | undefined {
  return Object.hasOwn(tracking.latest, id) ? tracking.latest[id] : undefined;
}
/** Persist alongside advanced session state before delivering a reveal. */
export function reconcileTracking(state: State, tracking: TrackingState, now: number,
  policy: LocationPolicy): TrackingState {
  if (state.id !== tracking.sessionId) throw new Error('Tracking session mismatch');
  const current = advance(state, now);
  if (current.phase === 'ended' || current.phase === 'cancelled') return createTracking(state.id);
  const latest = Object.fromEntries(current.players.flatMap(player => {
    const sample = ownSample(tracking, player.id);
    return sample ? [[player.id, { ...sample }]] : [];
  }));
  const window = revealWindow(current, now);
  if (!window) return { sessionId: state.id, latest };
  if (tracking.reveal?.number === window.number) {
    return { sessionId: state.id, latest, reveal: { ...tracking.reveal,
      markers: tracking.reveal.markers.filter(marker => current.players.some(p => p.id === marker.playerId && p.role === 'runner'))
        .map(marker => ({ ...marker })) } };
  }
  const markers = current.players.filter(p => p.role === 'runner').flatMap(player => {
    const sample = ownSample(tracking, player.id);
    // Recovery uses only samples already received at the original window start.
    if (!sample || observationRejection(sample, window.startsAt, policy)) return [];
    return [{ playerId: player.id, latitude: sample.latitude, longitude: sample.longitude,
      accuracyMeters: sample.accuracyMeters, observedAt: sample.observedAt }];
  });
  return { sessionId: state.id, latest, reveal: { ...window, markers } };
}
export type DeviceObservation = Omit<Observation, 'receivedAt'>;
export function ingestLocation(state: State, tracking: TrackingState, actorId: string,
  sample: DeviceObservation, now: number, policy: LocationPolicy):
  { tracking: TrackingState; accepted: boolean; reason?: LocationRejection | 'membership_required' | 'tracking_inactive' } {
  const current = advance(state, now);
  const next = reconcileTracking(current, tracking, now, policy);
  if (!current.players.some(p => p.id === actorId)) return { tracking: next, accepted: false, reason: 'membership_required' };
  if (!['countdown', 'head_start', 'active'].includes(current.phase)) return { tracking: next, accepted: false, reason: 'tracking_inactive' };
  // Explicit fields discard client-supplied receipt times and extra metadata.
  const observation: Observation = { latitude: sample.latitude, longitude: sample.longitude,
    accuracyMeters: sample.accuracyMeters, observedAt: sample.observedAt, sequence: sample.sequence, receivedAt: now };
  const reason = observationRejection(observation, now, policy, ownSample(next, actorId)?.sequence);
  if (reason) return { tracking: next, accepted: false, reason };
  return { accepted: true, tracking: { ...next, latest: { ...next.latest, [actorId]: observation } } };
}
/** Recipient-specific output. Host privileges do not bypass gameplay visibility. */
export function projectLocations(state: State, tracking: TrackingState, actorId: string,
  now: number, policy: LocationPolicy): { own?: RevealMarker; reveal?: NonNullable<TrackingState['reveal']> } {
  const current = advance(state, now);
  const next = reconcileTracking(current, tracking, now, policy);
  const player = current.players.find(p => p.id === actorId);
  if (!player || !['countdown', 'head_start', 'active'].includes(current.phase)) return {};
  const result: { own?: RevealMarker; reveal?: NonNullable<TrackingState['reveal']> } = {};
  const sample = ownSample(next, actorId);
  if (sample && !observationRejection(sample, now, policy)) {
    result.own = { playerId: actorId, latitude: sample.latitude, longitude: sample.longitude,
      accuracyMeters: sample.accuracyMeters, observedAt: sample.observedAt };
  }
  if (player.role === 'hunter' && next.reveal) result.reveal = {
    ...next.reveal, markers: next.reveal.markers.map(marker => ({ ...marker })),
  };
  return result;
}
