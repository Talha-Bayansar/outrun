import { advance, transition } from './index.ts';
import type { State } from './index.ts';
import type { CaptureContext } from './capture.ts';
import { parseClientCommand, parseClientLocation } from './contracts.ts';
import type { LocationPolicy } from './location.ts';
import { projectSession } from './projection.ts';
import { nextWakeAt } from './schedule.ts';
import { ingestLocation, projectLocations, reconcileTracking } from './tracking.ts';
import type { TrackingState } from './tracking.ts';

/** Private aggregate. Persist both fields atomically; never deliver this to clients. */
export interface SessionAggregate { state: State; tracking: TrackingState }
export interface CoordinatedUpdate { aggregate: SessionAggregate; wakeAt?: number }
export type CapturePolicy = Omit<CaptureContext, 'tracking' | 'locationPolicy'>;

/** Used for alarms, recovery, and reads before persisting and delivering views. */
export function reconcileSession(aggregate: SessionAggregate, now: number,
  policy: LocationPolicy): CoordinatedUpdate {
  const state = advance(aggregate.state, now);
  const tracking = reconcileTracking(state, aggregate.tracking, now, policy);
  return { aggregate: { state, tracking }, wakeAt: nextWakeAt(state, now) };
}

/** Authenticated identity and verified evidence must come from the adapter. */
export function coordinateCommand(aggregate: SessionAggregate, payload: unknown,
  actorId: string, now: number, policy: LocationPolicy, capturePolicy?: CapturePolicy):
  CoordinatedUpdate & { accepted: boolean; reason?: string; duplicate?: boolean } {
  const before = reconcileSession(aggregate, now, policy);
  const parsed = parseClientCommand(payload, actorId);
  if (!parsed.accepted) return { ...before, accepted: false, reason: parsed.reason };
  const outcome = transition(before.aggregate.state, parsed.command, now, capturePolicy ?
    { ...capturePolicy, tracking: before.aggregate.tracking, locationPolicy: policy } : undefined);
  const after = reconcileSession({ state: outcome.state, tracking: before.aggregate.tracking }, now, policy);
  return { ...after, accepted: outcome.accepted, reason: outcome.reason, duplicate: outcome.duplicate };
}

/** Reject malformed JSON data while still reconciling scheduled gameplay effects. */
export function coordinateLocation(aggregate: SessionAggregate, actorId: string,
  payload: unknown, now: number, policy: LocationPolicy) {
  const before = reconcileSession(aggregate, now, policy);
  const parsed = parseClientLocation(payload, actorId);
  if (!parsed.accepted) return { ...before, accepted: false, reason: parsed.reason };
  const outcome = ingestLocation(before.aggregate.state, before.aggregate.tracking, actorId, parsed.sample, now, policy);
  return { aggregate: { state: before.aggregate.state, tracking: outcome.tracking },
    wakeAt: before.wakeAt, accepted: outcome.accepted, reason: outcome.reason };
}

/** Project only a reconciled, persisted aggregate at its recorded server time. */
export function projectSessionAggregate(aggregate: SessionAggregate, actorId: string, policy: LocationPolicy) {
  const now = aggregate.state.lastAdvancedAt;
  const session = projectSession(aggregate.state, actorId, now);
  if (!session) return undefined;
  return { session, locations: projectLocations(aggregate.state, aggregate.tracking, actorId, now, policy) };
}
