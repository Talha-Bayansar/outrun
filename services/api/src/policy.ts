import { manhuntDefaults, validateSettings, validCoordinate } from '../../../packages/game-engine/src/index.ts';
import type { Settings, PlayingArea } from '../../../packages/game-engine/src/index.ts';
export const locationPolicy = { maxAccuracyMeters: 35, maxAgeMs: 30_000, maxFutureMs: 5000, maxSampleSkewMs: 15_000 };
export const retentionMs = 24 * 60 * 60 * 1000;
export function setup(input: unknown): { name: string; settings: Settings; area: PlayingArea; radiusMeters: number } {
  if (!input || typeof input !== 'object') throw new Error('invalid_setup');
  const p = input as Record<string, unknown>;
  if (Array.isArray(input) || Object.keys(p).some(k => !['name', 'settings', 'area', 'radiusMeters'].includes(k))) throw new Error('invalid_setup');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40) throw new Error('invalid_name');
  if (p.settings !== undefined && (!p.settings || typeof p.settings !== 'object' || Array.isArray(p.settings))) throw new Error('invalid_settings');
  const settings = { ...manhuntDefaults, ...(p.settings as Partial<Settings> ?? {}) };
  if (Object.keys(settings).some(k => !Object.hasOwn(manhuntDefaults, k))) throw new Error('invalid_settings');
  try { validateSettings(settings); } catch { throw new Error('invalid_settings'); }
  if (settings.durationMs < 60_000 || settings.durationMs > 10_800_000 || settings.preparationMs > 60_000 ||
    settings.headStartMs > 900_000 || settings.revealIntervalMs < 15_000 || settings.revealIntervalMs > settings.durationMs ||
    settings.revealWindowMs > 60_000) throw new Error('invalid_settings');
  const area = p.area as PlayingArea;
  if (!area || !area.center || !validCoordinate(area.center) || !Number.isFinite(area.radiusMeters) ||
    area.radiusMeters < 100 || area.radiusMeters > 5000) throw new Error('invalid_area');
  const radiusMeters = p.radiusMeters ?? 25;
  if (typeof radiusMeters !== 'number' || !Number.isFinite(radiusMeters) || radiusMeters < 10 || radiusMeters > 100) throw new Error('invalid_capture_radius');
  return { name: p.name.trim(), settings, area: { center: { latitude: area.center.latitude, longitude: area.center.longitude }, radiusMeters: area.radiusMeters }, radiusMeters };
}
export async function digest(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
export function credential() { return crypto.randomUUID() + crypto.randomUUID(); }
export function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function boundedBody(request: Request, max = 16_384) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('missing_body');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > max) { await reader.cancel(); throw new Error('body_too_large'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function bodyJson(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  const bytes = await boundedBody(request);
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('invalid_json'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_json');
  return value as Record<string, unknown>;
}
