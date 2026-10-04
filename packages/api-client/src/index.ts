import type { SessionView } from '../../game-engine/src/projection.ts';
import type { PlayingArea } from '../../game-engine/src/location.ts';
import type { RevealMarker } from '../../game-engine/src/tracking.ts';
export interface Membership { sessionId: string; playerId: string; token: string; code: string }
export interface Snapshot {
  type: 'snapshot'; protocol: 1; version: number; serverTime: number; code: string;
  area: PlayingArea; radiusMeters: number; session: SessionView;
  results?: { captureCounts: Record<string, number>; survivalSeconds: Record<string, number> };
  locations: { own?: RevealMarker; reveal?: { number: number; startsAt: number; expiresAt: number; markers: RevealMarker[] } };
}
export class ApiError extends Error {
  code: string; status: number;
  constructor(code: string, status: number) { super(code.replaceAll('_', ' ')); this.code = code; this.status = status; }
}
export class ApiClient {
  baseUrl: string; membership?: Membership;
  constructor(baseUrl: string, membership?: Membership) { this.baseUrl = baseUrl.replace(/\/$/, ''); this.membership = membership; }
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.membership) headers.set('Authorization', `Bearer ${this.membership.token}`);
    if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(this.baseUrl + path, { ...init, headers, signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new ApiError(data.error ?? 'request_failed', response.status);
      return data;
    } finally { clearTimeout(timer); }
  }
  create(input: unknown) { return this.request<Membership>('/games', { method: 'POST', body: JSON.stringify(input) }); }
  join(code: string, name: string) { return this.request<Membership>(`/games/${code.toUpperCase()}/join`, { method: 'POST', body: JSON.stringify({ name }) }); }
  path(suffix = '') { if (!this.membership) throw new Error('Join a game first'); return `/sessions/${this.membership.sessionId}${suffix}`; }
  snapshot() { return this.request<Snapshot>(this.path()); }
  async command(payload: { id: string; type: string; [key: string]: unknown }) {
    const submit = () => this.request<{ accepted: boolean; reason?: string; duplicate?: boolean }>(this.path('/commands'), { method: 'POST', body: JSON.stringify(payload) });
    let result;
    try { result = await submit(); } catch (error) { if (error instanceof ApiError) throw error; result = await submit(); }
    if (!result.accepted) throw new ApiError(result.reason ?? 'command_rejected', 409);
    return result;
  }
  location(input: unknown) { return this.request<{ accepted: boolean; reason?: string }>(this.path('/locations'), { method: 'POST', body: JSON.stringify(input) }); }
  upload(photo: Blob) { return this.request<{ evidenceId: string }>(this.path('/evidence'), { method: 'POST', body: photo, headers: { 'Content-Type': 'image/jpeg' } }); }
  subscribe(onSnapshot: (snapshot: Snapshot) => void, onStatus: (connected: boolean) => void) {
    let disposed = false, socket: WebSocket | undefined, timer: ReturnType<typeof setTimeout>, attempts = 0;
    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(this.baseUrl.replace(/^http/, 'ws') + this.path('/realtime'));
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'handshake', protocol: 1, token: this.membership?.token }));
      socket.onmessage = event => {
        if (disposed) return;
        try { const value = JSON.parse(event.data);
          if (value.type === 'snapshot' && value.protocol === 1 && value.session && Number.isSafeInteger(value.version)) {
            attempts = 0; onStatus(true); onSnapshot(value);
          }
        } catch { socket?.close(); }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = event => { onStatus(false); if (!disposed && event.code !== 1008) timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts++) + Math.random() * 500); };
    };
    connect(); return () => { disposed = true; clearTimeout(timer); socket?.close(); };
  }
}
