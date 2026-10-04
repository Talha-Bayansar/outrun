import type { Command } from './index.ts';
import { manhuntDefaults, validateSettings } from './index.ts';
import type { Settings } from './index.ts';
import { validCoordinate } from './location.ts';
import type { DeviceObservation } from './tracking.ts';

export type CommandParseResult = { accepted: true; command: Command } |
  { accepted: false; reason: 'invalid_actor' | 'invalid_command' };
const text = (value: unknown): value is string => typeof value === 'string' &&
  value.trim().length > 0 && value.length <= 80;

export type LocationParseResult = { accepted: true; sample: DeviceObservation } |
  { accepted: false; reason: 'invalid_actor' | 'invalid_sample' };

/** Parse JSON-decoded device data; identity and receipt time are server-owned. */
export function parseClientLocation(payload: unknown, actorId: string): LocationParseResult {
  if (!text(actorId)) return { accepted: false, reason: 'invalid_actor' };
  const invalid: LocationParseResult = { accepted: false, reason: 'invalid_sample' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return invalid;
  const p = payload as Record<string, unknown>;
  const fields = ['latitude', 'longitude', 'accuracyMeters', 'observedAt', 'sequence'];
  if (Object.keys(p).length !== fields.length || !fields.every(key => Object.hasOwn(p, key))) return invalid;
  const { latitude, longitude, accuracyMeters, observedAt, sequence } = p;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracyMeters !== 'number' ||
      typeof observedAt !== 'number' || typeof sequence !== 'number') return invalid;
  const sample: DeviceObservation = { latitude, longitude, accuracyMeters, observedAt, sequence };
  if (!validCoordinate(sample) || !Number.isFinite(sample.accuracyMeters) || sample.accuracyMeters < 0 ||
      ![sample.observedAt, sample.sequence].every(value => Number.isSafeInteger(value) && value >= 0)) return invalid;
  return { accepted: true, sample };
}

/** Parse a JSON-decoded payload. Identity comes exclusively from authenticated credentials. */
export function parseClientCommand(payload: unknown, actorId: string): CommandParseResult {
  if (!text(actorId)) return { accepted: false, reason: 'invalid_actor' };
  const invalid: CommandParseResult = { accepted: false, reason: 'invalid_command' };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return invalid;
  const p = payload as Record<string, unknown>;
  if (!Object.hasOwn(p, 'id') || !Object.hasOwn(p, 'type') || !text(p.id)) return invalid;
  const base = { id: p.id, actorId };
  let command: Command;
  let fields: string[];
  switch (p.type) {
    case 'join':
      if (!text(p.name)) return invalid;
      command = { ...base, type: 'join', name: p.name }; fields = ['name']; break;
    case 'ready':
      if (typeof p.ready !== 'boolean') return invalid;
      command = { ...base, type: 'ready', ready: p.ready }; fields = ['ready']; break;
    case 'assign':
      if (!text(p.playerId) || (p.role !== 'hunter' && p.role !== 'runner')) return invalid;
      command = { ...base, type: 'assign', playerId: p.playerId, role: p.role }; fields = ['playerId', 'role']; break;
    case 'start': case 'abort': case 'leave':
      command = { ...base, type: p.type }; fields = []; break;
    case 'settings': {
      try { validateSettings(p.settings as Settings); } catch { return invalid; }
      const input = p.settings as Settings;
      const settings: Settings = { preparationMs: input.preparationMs, headStartMs: input.headStartMs,
        durationMs: input.durationMs, revealIntervalMs: input.revealIntervalMs, revealWindowMs: input.revealWindowMs };
      command = { ...base, type: 'settings', settings }; fields = ['settings']; break;
    }
    case 'capture':
      if (!text(p.targetId) || !text(p.evidenceId)) return invalid;
      command = { ...base, type: 'capture', targetId: p.targetId, evidenceId: p.evidenceId }; fields = ['targetId', 'evidenceId']; break;
    case 'accept_capture': case 'dispute_capture':
      if (!text(p.captureId)) return invalid;
      command = { ...base, type: p.type, captureId: p.captureId }; fields = ['captureId']; break;
    case 'review_capture':
      if (!text(p.captureId) || typeof p.approve !== 'boolean') return invalid;
      command = { ...base, type: p.type, captureId: p.captureId, approve: p.approve }; fields = ['captureId', 'approve']; break;
    default: return invalid;
  }
  const allowed = ['id', 'type', ...fields];
  if (Object.keys(p).length !== allowed.length || !allowed.every(key => Object.hasOwn(p, key)) ||
      Object.keys(p).some(key => !allowed.includes(key))) return invalid;
  // Reconstructed field order makes reordered JSON retries share one fingerprint.
  return { accepted: true, command };
}
