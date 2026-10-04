import { advance } from './index.ts';
import type { State, Player, Settings, Phase } from './index.ts';
import type { Capture } from './capture.ts';

export interface CaptureView {
  id: string; hunterId: string; targetId: string; status: Capture['status'];
  submittedAt: number; responseDeadline: number; reviewDeadline?: number;
  resolvedAt?: number; reviewerId?: string; evidenceId?: string;
}
export interface SessionView {
  id: string; hostId: string; phase: Phase; settings: Settings; players: Player[];
  serverTime: number; deadlines?: State['deadlines']; result?: State['result'];
  captures: CaptureView[];
}

/** Authenticated membership is supplied by the adapter. Never serialize raw State. */
export function projectSession(state: State, recipientId: string, now: number): SessionView | undefined {
  const current = advance(state, now);
  if (!current.players.some(p => p.id === recipientId && !p.left)) return;
  const captures = (current.captures ?? []).filter(c => c.hunterId === recipientId ||
    c.targetId === recipientId || (recipientId === current.hostId && c.status === 'disputed'))
    .map(c => {
      const view: CaptureView = { id: c.id, hunterId: c.hunterId, targetId: c.targetId,
        status: c.status, submittedAt: c.submittedAt, responseDeadline: c.responseDeadline };
      if (c.reviewDeadline !== undefined) view.reviewDeadline = c.reviewDeadline;
      if (c.resolvedAt !== undefined) view.resolvedAt = c.resolvedAt;
      if (c.reviewerId !== undefined) view.reviewerId = c.reviewerId;
      if (current.phase === 'active' && ['pending_response', 'disputed'].includes(c.status)) view.evidenceId = c.evidenceId;
      return view;
    });
  return { id: current.id, hostId: current.hostId, phase: current.phase,
    settings: { ...current.settings }, players: current.players.map(p => ({ ...p })), serverTime: now,
    ...(current.deadlines ? { deadlines: { ...current.deadlines } } : {}),
    ...(current.result ? { result: { ...current.result } } : {}), captures };
}

/** Recheck on every private media request; a previous view is not an access token. */
export function canViewCaptureEvidence(state: State, recipientId: string, evidenceId: string, now: number): boolean {
  return projectSession(state, recipientId, now)?.captures.some(c => c.evidenceId === evidenceId) ?? false;
}
