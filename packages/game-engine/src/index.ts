/** Pure session rules. Adapters supply authenticated actors and server time (ms). */
export * from './location.ts';
export * from './tracking.ts';
export * from './capture.ts';
import { advanceCaptures, captureTransition, expireCaptures } from './capture.ts';
import type { Capture, CaptureContext, CaptureCommand } from './capture.ts';
export type Role = 'hunter' | 'runner';
export type Phase = 'lobby' | 'countdown' | 'head_start' | 'active' | 'ended' | 'cancelled';
export interface Settings {
  preparationMs: number;
  headStartMs: number;
  durationMs: number;
  revealIntervalMs: number;
  revealWindowMs: number;
}
export const manhuntDefaults: Readonly<Settings> = Object.freeze({
  preparationMs: 10_000, headStartMs: 180_000, durationMs: 2_700_000,
  revealIntervalMs: 180_000, revealWindowMs: 10_000,
});
export interface Player { id: string; name: string; role: Role; ready: boolean; eliminated?: boolean }
export interface State {
  id: string;
  hostId: string;
  phase: Phase;
  settings: Settings;
  players: Player[];
  lastAdvancedAt: number;
  deadlines?: { runnersReleasedAt: number; huntStartsAt: number; endsAt: number };
  result?: { winner: 'runners' | 'hunters'; endedAt: number };
  captures?: Capture[];
  receipts: Record<string, { fingerprint: string; accepted: boolean; reason?: string }>;
}
export type Command = { id: string; actorId: string } & (
  | { type: 'join'; name: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'assign'; playerId: string; role: Role }
  | { type: 'start' }
  | { type: 'abort' }
  | CaptureCommand
);
export interface Outcome { state: State; accepted: boolean; reason?: string; duplicate?: boolean }

export function validateSettings(settings: Settings): void {
  for (const value of Object.values(settings)) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid timer');
  }
  if (settings.durationMs <= 0 || settings.revealIntervalMs <= 0 ||
      settings.revealWindowMs <= 0 || settings.revealWindowMs > settings.revealIntervalMs) {
    throw new Error('Invalid timer combination');
  }
}
function validText(value: string): boolean { return typeof value === 'string' && value.trim().length > 0 && value.length <= 80; }
function validTime(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid server time');
}
export function createSession(id: string, hostId: string, name: string, now: number,
  settings: Settings = manhuntDefaults): State {
  validTime(now);
  if (![id, hostId, name].every(validText)) throw new Error('Invalid identity');
  validateSettings(settings);
  return { id, hostId, phase: 'lobby', settings: { ...settings },
    players: [{ id: hostId, name: name.trim(), role: 'hunter', ready: false }],
    lastAdvancedAt: now, receipts: {} };
}
/** Reconcile directly against deadlines; recovery never replays expired phases. */
export function advance(state: State, now: number): State {
  validTime(now);
  if (now < state.lastAdvancedAt) throw new Error('Server time moved backwards');
  if (state.phase === 'ended' || state.phase === 'cancelled') return state;
  const next = { ...state, lastAdvancedAt: now };
  const d = state.deadlines;
  if (!d) return next;
  if (now >= d.endsAt) return expireCaptures({ ...next, phase: 'ended', result: { winner: 'runners', endedAt: d.endsAt } });
  if (now >= d.huntStartsAt) return advanceCaptures({ ...next, phase: 'active' }, now);
  if (now >= d.runnersReleasedAt) return { ...next, phase: 'head_start' };
  return next;
}
/** Timing metadata only. Location snapshots belong to a durable, private adapter. */
export function revealWindow(state: State, now: number): { number: number; startsAt: number; expiresAt: number } | undefined {
  const current = advance(state, now);
  if (current.phase !== 'active' || !current.deadlines) return;
  const number = Math.floor((now - current.deadlines.huntStartsAt) / current.settings.revealIntervalMs);
  if (number < 1) return;
  const startsAt = current.deadlines.huntStartsAt + number * current.settings.revealIntervalMs;
  const expiresAt = Math.min(startsAt + current.settings.revealWindowMs, current.deadlines.endsAt);
  if (now < expiresAt) return { number, startsAt, expiresAt };
}
export function transition(state: State, command: Command, now: number, context?: CaptureContext): Outcome {
  let next = advance(state, now);
  const fingerprint = JSON.stringify(command);
  const receipt = Object.hasOwn(next.receipts, command.id) ? next.receipts[command.id] : undefined;
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) return { state: next, accepted: false, reason: 'command_id_conflict' };
    return { state: next, accepted: receipt.accepted, reason: receipt.reason, duplicate: true };
  }
  function finish(accepted: boolean, reason?: string): Outcome {
    next = { ...next, receipts: { ...next.receipts, [command.id]: { fingerprint, accepted, reason } } };
    return { state: next, accepted, reason };
  }
  if (!validText(command.id) || !validText(command.actorId)) return { state: next, accepted: false, reason: 'invalid_identity' };
  if (next.phase === 'ended' || next.phase === 'cancelled') return { state: next, accepted: false, reason: 'session_finished' };
  const player = next.players.find(p => p.id === command.actorId);
  if (command.type === 'abort') {
    if (command.actorId !== next.hostId) return finish(false, 'host_required');
    next = expireCaptures({ ...next, phase: 'cancelled' });
    return finish(true);
  }
  if (['capture', 'accept_capture', 'dispute_capture', 'review_capture'].includes(command.type)) {
    const result = captureTransition(next, command as Command & CaptureCommand, now, context);
    next = result.state;
    return finish(!result.reason, result.reason);
  }
  if (next.phase !== 'lobby') return finish(false, 'lobby_required');
  if (command.type === 'join') {
    if (player) return finish(false, 'already_joined');
    if (!validText(command.name)) return finish(false, 'invalid_name');
    if (next.players.length >= 20) return finish(false, 'lobby_full');
    next = { ...next, players: [...next.players, { id: command.actorId, name: command.name.trim(), role: 'runner', ready: false }] };
    return finish(true);
  }
  if (!player) return finish(false, 'membership_required');
  if (command.type === 'ready') {
    if (typeof command.ready !== 'boolean') return finish(false, 'invalid_readiness');
    next = { ...next, players: next.players.map(p => p.id === player.id ? { ...p, ready: command.ready } : p) };
    return finish(true);
  }
  if (command.actorId !== next.hostId) return finish(false, 'host_required');
  if (command.type === 'assign') {
    if (!['hunter', 'runner'].includes(command.role)) return finish(false, 'invalid_role');
    if (!next.players.some(p => p.id === command.playerId)) return finish(false, 'player_missing');
    next = { ...next, players: next.players.map(p => p.id === command.playerId ? { ...p, role: command.role, ready: false } : p) };
    return finish(true);
  }
  if (command.type !== 'start') return finish(false, 'unsupported_command');
  if (next.players.length < 4 || !next.players.every(p => p.ready) ||
      !next.players.some(p => p.role === 'hunter') || !next.players.some(p => p.role === 'runner')) {
    return finish(false, 'roster_not_ready');
  }
  const runnersReleasedAt = now + next.settings.preparationMs;
  const huntStartsAt = runnersReleasedAt + next.settings.headStartMs;
  const endsAt = huntStartsAt + next.settings.durationMs;
  if (!Number.isSafeInteger(endsAt)) return finish(false, 'invalid_deadline');
  next = advance({ ...next, phase: 'countdown', deadlines: { runnersReleasedAt, huntStartsAt, endsAt } }, now);
  return finish(true);
}
