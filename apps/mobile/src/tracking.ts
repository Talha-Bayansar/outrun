import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { ApiClient } from '../../../packages/api-client/src/index.ts';
import type { Membership } from '../../../packages/api-client/src/index.ts';
import { read, write } from './storage';
export const TRACKING_TASK = 'outrun-active-location';
interface TrackingConfig { baseUrl: string; membership: Membership; endsAt: number }
export function sample(location: Location.LocationObject) {
  return { latitude: location.coords.latitude, longitude: location.coords.longitude,
    accuracyMeters: location.coords.accuracy ?? 999, observedAt: Math.round(location.timestamp), sequence: Math.round(location.timestamp) };
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRACKING_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const stored = await read('tracking');
  if (!stored) { await stopBackground(); return; }
  const config: TrackingConfig = JSON.parse(stored);
  if (Date.now() >= config.endsAt) { await stopBackground(); return; }
  const client = new ApiClient(config.baseUrl, config.membership);
  try {
    const current = await client.snapshot();
    const player = current.session.players.find(p => p.id === config.membership.playerId);
    if (!player || player.left || player.eliminated || ['ended', 'cancelled'].includes(current.session.phase)) { await stopBackground(); return; }
    const latest = data.locations.at(-1);
    if (latest) await client.location(sample(latest));
  } catch { /* Send only a new observation on the next update; never queue stale GPS. */ }
});
export async function stopBackground() {
  await write('tracking', null);
  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK)) await Location.stopLocationUpdatesAsync(TRACKING_TASK);
}
export async function startBackground(config: TrackingConfig) {
  await write('tracking', JSON.stringify(config));
  await Location.startLocationUpdatesAsync(TRACKING_TASK, { accuracy: Location.Accuracy.High, timeInterval: 10_000,
    distanceInterval: 5, pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
    foregroundService: { notificationTitle: 'Outrun game active', notificationBody: 'Location is shared only by your game rules. Leave the game to stop.' } });
}
