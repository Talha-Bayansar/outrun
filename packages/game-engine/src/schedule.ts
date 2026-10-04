import { advance, revealWindow } from './index.ts';
import type { State } from './index.ts';

/** Next strictly future gameplay boundary after reconciliation, in server milliseconds. */
export function nextWakeAt(state: State, now: number): number | undefined {
  const current = advance(state, now);
  const d = current.deadlines;
  if (!d || current.phase === 'ended' || current.phase === 'cancelled') return;
  const candidates = [d.runnersReleasedAt, d.huntStartsAt, d.endsAt];
  if (current.phase === 'active') {
    const window = revealWindow(current, now);
    if (window) candidates.push(window.expiresAt);
    const nextNumber = Math.floor((now - d.huntStartsAt) / current.settings.revealIntervalMs) + 1;
    const nextReveal = d.huntStartsAt + nextNumber * current.settings.revealIntervalMs;
    if (nextReveal < d.endsAt) candidates.push(nextReveal);
    for (const capture of current.captures ?? []) {
      if (capture.status === 'pending_response') candidates.push(capture.responseDeadline);
      if (capture.status === 'disputed' && capture.reviewDeadline !== undefined) candidates.push(capture.reviewDeadline);
    }
  }
  const future = candidates.filter(t => Number.isSafeInteger(t) && t > now);
  return future.length ? Math.min(...future) : undefined;
}
