import type { Command, State } from './index.ts';
import { assessProximity } from './location.ts';
import type { LocationPolicy } from './location.ts';
import type { TrackingState } from './tracking.ts';

export type CaptureCommand = { type: 'capture'; targetId: string; evidenceId: string } |
  { type: 'accept_capture' | 'dispute_capture'; captureId: string } |
  { type: 'review_capture'; captureId: string; approve: boolean };
export interface Capture {
  id: string; hunterId: string; targetId: string; evidenceId: string;
  status: 'pending_response' | 'disputed' | 'confirmed' | 'rejected' | 'expired';
  submittedAt: number; responseDeadline: number; reviewDeadline?: number;
  reviewMs: number; resolvedAt?: number; reviewerId?: string;
}
/** Trusted adapter data, never a client command payload. */
export interface CaptureContext {
  tracking: TrackingState;
  locationPolicy: LocationPolicy;
  radiusMeters: number;
  responseMs: number;
  reviewMs: number;
  evidence: { id: string; sessionId: string; ownerId: string; uploadedAt: number }[];
}
const unresolved = (capture: Capture) => ['pending_response', 'disputed'].includes(capture.status);
export function expireCaptures(state: State): State {
  if (!state.captures) return state;
  return { ...state, captures: state.captures.map(c => unresolved(c) ? { ...c, status: 'expired' } : c) };
}
function confirm(state: State, id: string, now: number): State {
  const capture = state.captures!.find(c => c.id === id)!;
  const players = state.players.map(p => p.id === capture.targetId ? { ...p, eliminated: true } : p);
  let next: State = { ...state, players, captures: state.captures!.map(c => c.id === id ?
    { ...c, status: 'confirmed', resolvedAt: now } : c.targetId === capture.targetId && unresolved(c) ? { ...c, status: 'expired' } : c) };
  if (players.filter(p => p.role === 'runner').every(p => p.eliminated)) {
    next = expireCaptures({ ...next, phase: 'ended', result: { winner: 'hunters', endedAt: now } });
  }
  return next;
}
export function advanceCaptures(state: State, now: number): State {
  let next = state;
  const due = (state.captures ?? []).filter(c => unresolved(c) &&
    (c.status === 'pending_response' ? c.responseDeadline : c.reviewDeadline!) <= now)
    .sort((a, b) => (a.reviewDeadline ?? a.responseDeadline) - (b.reviewDeadline ?? b.responseDeadline) || a.submittedAt - b.submittedAt);
  for (const capture of due) {
    if (next.phase !== 'active' || !unresolved(next.captures!.find(c => c.id === capture.id)!)) continue;
    if (capture.status === 'pending_response') next = confirm(next, capture.id, capture.responseDeadline);
    else next = { ...next, captures: next.captures!.map(c => c.id === capture.id ? { ...c, status: 'expired', resolvedAt: c.reviewDeadline } : c) };
  }
  return next;
}
export function captureTransition(state: State, command: Command & CaptureCommand, now: number,
  context?: CaptureContext): { state: State; reason?: string } {
  const reject = (reason: string) => ({ state, reason });
  const actor = state.players.find(p => p.id === command.actorId);
  if (!actor) return reject('membership_required');
  if (state.phase !== 'active') return reject('hunting_required');
  if (command.type === 'capture') {
    if (actor.role !== 'hunter' || actor.eliminated) return reject('hunter_required');
    const target = state.players.find(p => p.id === command.targetId);
    if (!target || target.role !== 'runner' || target.eliminated || target.id === actor.id) return reject('target_unavailable');
    if (!context || context.tracking.sessionId !== state.id) return reject('capture_context_required');
    if (![context.responseMs, context.reviewMs].every(v => Number.isSafeInteger(v) && v > 0) ||
        !Number.isSafeInteger(now + context.responseMs + context.reviewMs)) return reject('invalid_capture_policy');
    const evidence = context.evidence.find(e => e.id === command.evidenceId && e.sessionId === state.id && e.ownerId === actor.id &&
      Number.isSafeInteger(e.uploadedAt) && e.uploadedAt >= state.deadlines!.huntStartsAt && e.uploadedAt <= now);
    if (!evidence) return reject('verified_evidence_required');
    if (state.captures?.some(c => c.evidenceId === evidence.id)) return reject('evidence_already_used');
    const samples = context.tracking.latest;
    if (!Object.hasOwn(samples, actor.id) || !Object.hasOwn(samples, target.id)) return reject('location_unavailable');
    const proximity = assessProximity(samples[actor.id], samples[target.id], context.radiusMeters, now, context.locationPolicy);
    if (proximity.status !== 'in_range') return reject(proximity.status === 'unavailable' ? proximity.reason : proximity.status);
    const capture: Capture = { id: command.id, hunterId: actor.id, targetId: target.id, evidenceId: evidence.id,
      status: 'pending_response', submittedAt: now, responseDeadline: now + context.responseMs, reviewMs: context.reviewMs };
    return { state: { ...state, captures: [...(state.captures ?? []), capture] } };
  }
  const capture = state.captures?.find(c => c.id === command.captureId);
  if (!capture || !unresolved(capture)) return reject('capture_unavailable');
  if (command.type === 'review_capture') {
    if (actor.id !== state.hostId) return reject('host_required');
    if (capture.status !== 'disputed') return reject('dispute_required');
    if (typeof command.approve !== 'boolean') return reject('invalid_decision');
    const reviewed = { ...state, captures: state.captures!.map(c => c.id === capture.id ? { ...c, reviewerId: actor.id } : c) };
    return { state: command.approve ? confirm(reviewed, capture.id, now) : { ...reviewed,
      captures: reviewed.captures.map(c => c.id === capture.id ? { ...c, status: 'rejected', resolvedAt: now } : c) } };
  }
  if (actor.id !== capture.targetId) return reject('target_required');
  if (capture.status !== 'pending_response') return reject('response_unavailable');
  if (command.type === 'accept_capture') return { state: confirm(state, capture.id, now) };
  return { state: { ...state, captures: state.captures!.map(c => c.id === capture.id ?
    { ...c, status: 'disputed', reviewDeadline: now + c.reviewMs } : c) } };
}
