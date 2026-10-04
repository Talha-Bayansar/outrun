import { DurableObject } from 'cloudflare:workers';
import jpeg from 'jpeg-js';
import { createSession, createTracking, coordinateCommand, coordinateLocation, reconcileSession, projectSessionAggregate,
  canViewCaptureEvidence, parseClientLocation, observationRejection } from '../../../packages/game-engine/src/index.ts';
import type { SessionAggregate, PlayingArea } from '../../../packages/game-engine/src/index.ts';
import { setup, locationPolicy, retentionMs, digest, credential, json, bodyJson, boundedBody } from './policy.ts';

interface Member { id: string; expiresAt: number }
interface Evidence { id: string; sessionId: string; ownerId: string; uploadedAt: number; key: string; complete: boolean }
interface RecordState {
  aggregate: SessionAggregate; code: string; area: PlayingArea; radiusMeters: number; version: number;
  expiresAt: number; members: Record<string, Member>; evidence: Evidence[];
  readyGps: Record<string, number>;
}
interface SocketAuth { hash?: string; openedAt: number }

export class GameDirectory extends DurableObject<Env> {
  async create(input: unknown) {
    const config = setup(input);
    return this.ctx.blockConcurrencyWhile(async () => {
      let code: string;
      do { code = Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join(''); }
      while (await this.ctx.storage.get(code));
      const id = crypto.randomUUID();
      const result = await this.env.GAMES.getByName(id).initialize(id, code, config);
      await this.ctx.storage.put(code, { id, expiresAt: Date.now() + retentionMs });
      await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
      return result;
    });
  }
  async lookup(code: string) {
    const value = await this.ctx.storage.get<{ id: string; expiresAt: number }>(code);
    return value && value.expiresAt > Date.now() ? value.id : null;
  }
  async alarm() {
    const codes = await this.ctx.storage.list<{ expiresAt: number }>();
    for (const [code, value] of codes) if (value.expiresAt <= Date.now()) await this.ctx.storage.delete(code);
    if ((await this.ctx.storage.list()).size) await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
  }
}

export class GameSession extends DurableObject<Env> {
  async initialize(id: string, code: string, config: ReturnType<typeof setup>) {
    return this.ctx.blockConcurrencyWhile(async () => {
      if (await this.ctx.storage.get('record')) throw new Error('already_created');
      const playerId = crypto.randomUUID(), token = credential(), now = Date.now();
      const record: RecordState = { aggregate: { state: createSession(id, playerId, config.name, now, config.settings), tracking: createTracking(id) },
        code, area: config.area, radiusMeters: config.radiusMeters, version: 1, expiresAt: now + retentionMs,
        members: { [await digest(token)]: { id: playerId, expiresAt: now + retentionMs } }, evidence: [], readyGps: {} };
      await this.save(record, now);
      return { sessionId: id, playerId, token, code };
    });
  }
  async load() {
    const record = await this.ctx.storage.get<RecordState>('record');
    if (!record || record.expiresAt <= Date.now()) throw new Error('session_expired');
    return record;
  }
  member(record: RecordState, hash: string) {
    const member = Object.hasOwn(record.members, hash) ? record.members[hash] : undefined;
    if (!member || member.expiresAt <= Date.now() || !record.aggregate.state.players.some(p => p.id === member.id && !p.left)) throw new Error('unauthorized');
    return member.id;
  }
  async save(record: RecordState, now: number) {
    const next = reconcileSession(record.aggregate, Math.max(now, record.aggregate.state.lastAdvancedAt), locationPolicy);
    record.aggregate = next.aggregate;
    const active = record.aggregate.state.phase !== 'ended' && record.aggregate.state.phase !== 'cancelled';
    const used = new Set((record.aggregate.state.captures ?? []).filter(c => ['pending_response', 'disputed'].includes(c.status)).map(c => c.evidenceId));
    const expired = record.evidence.filter(e => !active || (!used.has(e.id) && now - e.uploadedAt > 300_000));
    // Delete private media before dropping its durable cleanup reference. Alarm retries failures.
    for (const e of expired) await this.env.EVIDENCE.delete(e.key);
    record.evidence = record.evidence.filter(e => !expired.includes(e));
    record.version++;
    await this.ctx.storage.transaction(async txn => {
      await txn.put('record', record);
      await txn.setAlarm(Math.min(next.wakeAt ?? record.expiresAt, record.expiresAt,
        ...(record.evidence.length ? [now + 60_000] : [])));
    });
  }
  view(record: RecordState, actorId: string) {
    const state = record.aggregate.state;
    const results = ['ended', 'cancelled'].includes(state.phase) ? {
      captureCounts: Object.fromEntries(state.players.filter(p => p.role === 'hunter').map(p => [p.id,
        (state.captures ?? []).filter(c => c.hunterId === p.id && c.status === 'confirmed').length])),
      survivalSeconds: Object.fromEntries(state.players.filter(p => p.role === 'runner').map(p => [p.id, state.deadlines ? Math.floor(Math.max(0,
        Math.min(p.leftAt ?? Infinity, state.captures?.find(c => c.targetId === p.id && c.status === 'confirmed')?.resolvedAt ?? Infinity,
          state.result?.endedAt ?? state.lastAdvancedAt) - state.deadlines.huntStartsAt) / 1000) : 0])),
    } : undefined;
    return { type: 'snapshot', protocol: 1, version: record.version, serverTime: Date.now(), code: record.code,
      area: record.area, radiusMeters: record.radiusMeters, ...(results ? { results } : {}), ...projectSessionAggregate(record.aggregate, actorId, locationPolicy) };
  }
  broadcast(record: RecordState) {
    for (const socket of this.ctx.getWebSockets()) {
      try { const auth = socket.deserializeAttachment() as SocketAuth;
        if (!auth.hash) { if (Date.now() - auth.openedAt > 10_000) socket.close(1008, 'Handshake required'); continue; }
        socket.send(JSON.stringify(this.view(record, this.member(record, auth.hash))));
      } catch { socket.close(1008, 'Membership revoked'); }
    }
  }
  async throttle(key: string, limit: number) {
    const now = Date.now();
    const bucket = await this.ctx.storage.get<{ count: number; reset: number }>(`rate:${key}`) ?? { count: 0, reset: now + 60_000 };
    if (bucket.reset <= now) { bucket.count = 0; bucket.reset = now + 60_000; }
    if (++bucket.count > limit) throw new Error('rate_limited');
    await this.ctx.storage.put(`rate:${key}`, bucket);
  }
  async fetch(request: Request) {
    if (request.headers.get('Upgrade') === 'websocket') {
      const record = await this.load();
      if (this.ctx.getWebSockets().length >= 40) return json({ error: 'connection_limit' }, 429);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ openedAt: Date.now() } satisfies SocketAuth);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const record = await this.load(), path = new URL(request.url).pathname.split('/').slice(3).join('/'), now = Date.now();
        if (path === 'join' && request.method === 'POST') {
          await this.throttle('join', 40);
          const input = await bodyJson(request);
          if (typeof input.name !== 'string' || input.name.length > 40) throw new Error('invalid_name');
          const playerId = crypto.randomUUID(), token = credential();
          const result = coordinateCommand(record.aggregate, { id: crypto.randomUUID(), type: 'join', name: input.name }, playerId, now, locationPolicy);
          record.aggregate = result.aggregate;
          if (!result.accepted) { await this.save(record, now); return json({ error: result.reason }, 409); }
          record.members[await digest(token)] = { id: playerId, expiresAt: record.expiresAt };
          await this.save(record, now); this.broadcast(record);
          return json({ sessionId: record.aggregate.state.id, playerId, token, code: record.code });
        }
        const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
        const hash = await digest(token), actorId = this.member(record, hash);
        await this.throttle(actorId, 180);
        record.aggregate = reconcileSession(record.aggregate, now, locationPolicy).aggregate;
        let result: unknown;
        if (path === '' && request.method === 'GET') result = this.view(record, actorId);
        else if (path === 'membership' && request.method === 'DELETE') {
          if (!['ended', 'cancelled'].includes(record.aggregate.state.phase)) record.aggregate = coordinateCommand(record.aggregate,
            { id: crypto.randomUUID(), type: 'leave' }, actorId, now, locationPolicy).aggregate;
          record.aggregate.state.players = record.aggregate.state.players.map(p => p.id === actorId ? { ...p, name: 'Deleted player', left: true } : p);
          record.aggregate.state.receipts = Object.fromEntries(Object.entries(record.aggregate.state.receipts).filter(([, receipt]) => {
            try { return JSON.parse(receipt.fingerprint).actorId !== actorId; } catch { return false; }
          }));
          for (const [key, member] of Object.entries(record.members)) if (member.id === actorId) delete record.members[key];
          delete record.readyGps[actorId];
          const targetEvidence = new Set(record.aggregate.state.captures?.filter(c => c.targetId === actorId).map(c => c.evidenceId));
          const remove = record.evidence.filter(e => e.ownerId === actorId || targetEvidence.has(e.id));
          for (const evidence of remove) await this.env.EVIDENCE.delete(evidence.key);
          record.evidence = record.evidence.filter(e => !remove.includes(e));
          result = { deleted: true };
        } else if (path === 'commands' && request.method === 'POST') {
          const payload = await bodyJson(request);
          if (payload.type === 'settings') setup({ name: 'Validation', settings: payload.settings, area: record.area, radiusMeters: record.radiusMeters });
          const retry = typeof payload.id === 'string' && Object.hasOwn(record.aggregate.state.receipts, payload.id);
          if (!retry && Object.keys(record.aggregate.state.receipts).length >= 2048 && !['leave', 'abort'].includes(String(payload.type))) throw new Error('command_limit');
          if (!retry && payload.type === 'ready' && payload.ready && (record.readyGps[actorId] ?? 0) < now - 60_000) throw new Error('fresh_gps_required');
          if (!retry && payload.type === 'start' && record.aggregate.state.players.some(p => !p.left && (record.readyGps[p.id] ?? 0) < now - 60_000)) throw new Error('fresh_gps_required');
          const update = coordinateCommand(record.aggregate, payload, actorId, now, locationPolicy,
            { radiusMeters: record.radiusMeters, responseMs: 30_000, reviewMs: 120_000, evidence: record.evidence.filter(e => e.complete) });
          record.aggregate = update.aggregate;
          result = { type: 'receipt', id: payload.id, accepted: update.accepted, reason: update.reason, duplicate: update.duplicate };
        } else if (path === 'locations' && request.method === 'POST') {
          const payload = await bodyJson(request);
          if (record.aggregate.state.phase === 'lobby') {
            const parsed = parseClientLocation(payload, actorId);
            const reason = parsed.accepted ? observationRejection({ ...parsed.sample, receivedAt: now }, now, locationPolicy) : parsed.reason;
            if (!reason) record.readyGps[actorId] = now;
            result = { accepted: !reason, reason };
          } else {
            const update = coordinateLocation(record.aggregate, actorId, payload, now, locationPolicy);
            record.aggregate = update.aggregate; result = { accepted: update.accepted, reason: update.reason };
          }
        } else if (path === 'evidence' && request.method === 'POST') {
          const actor = record.aggregate.state.players.find(p => p.id === actorId)!;
          if (actor.role !== 'hunter' || actor.eliminated || record.aggregate.state.phase !== 'active') throw new Error('hunting_required');
          if (record.evidence.filter(e => e.ownerId === actorId).length >= 6) throw new Error('upload_limit');
          const bytes = await boundedBody(request, 4 * 1024 * 1024);
          if (request.headers.get('Content-Type') !== 'image/jpeg' || bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 ||
            bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('invalid_photo');
          let clean: Uint8Array;
          try {
            const decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: 2, maxMemoryUsageInMB: 32, tolerantDecoding: false });
            if (decoded.width < 32 || decoded.height < 32) throw new Error('invalid_photo');
            clean = jpeg.encode({ data: decoded.data, width: decoded.width, height: decoded.height }, 70).data;
          } catch { throw new Error('invalid_photo'); }
          const id = crypto.randomUUID(), key = `${record.aggregate.state.id}/${id}`;
          const evidence = { id, key, sessionId: record.aggregate.state.id, ownerId: actorId, uploadedAt: now, complete: false };
          // Persist the cleanup reference before uploading, so interrupted writes remain collectible.
          record.evidence.push(evidence); await this.save(record, now);
          await this.env.EVIDENCE.put(key, clean, { httpMetadata: { contentType: 'image/jpeg' } });
          evidence.complete = true;
          result = { evidenceId: id };
        } else if (path.startsWith('evidence/') && request.method === 'GET') {
          const id = path.slice(9), evidence = record.evidence.find(e => e.id === id);
          if (!evidence || !canViewCaptureEvidence(record.aggregate.state, actorId, id, now)) throw new Error('unauthorized');
          await this.save(record, now);
          const object = await this.env.EVIDENCE.get(evidence.key);
          if (!object) return json({ error: 'photo_unavailable' }, 404);
          return new Response(object.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
        } else return json({ error: 'not_found' }, 404);
        await this.save(record, now); this.broadcast(record);
        // Build reads after durable reconciliation so version and snapshot agree.
        return json(path === '' ? this.view(record, actorId) : result);
      } catch (error) { return failure(error); }
    });
  }
  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        if (typeof message !== 'string' || message.length > 4096) throw new Error('invalid_message');
        const auth = socket.deserializeAttachment() as SocketAuth;
        if (auth.hash) throw new Error('http_commands_required');
        if (Date.now() - auth.openedAt > 10_000) throw new Error('handshake_expired');
        const payload = JSON.parse(message);
        if (payload.type !== 'handshake' || payload.protocol !== 1 || typeof payload.token !== 'string' || payload.token.length > 150) throw new Error('invalid_handshake');
        const record = await this.load(), hash = await digest(payload.token);
        const actorId = this.member(record, hash);
        socket.serializeAttachment({ hash, openedAt: auth.openedAt });
        await this.save(record, Date.now()); socket.send(JSON.stringify(this.view(record, actorId)));
      } catch { socket.close(1008, 'Authentication failed'); }
    });
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const record = await this.ctx.storage.get<RecordState>('record');
      if (!record) return;
      if (record.expiresAt <= Date.now()) {
        for (const e of record.evidence) await this.env.EVIDENCE.delete(e.key);
        for (const socket of this.ctx.getWebSockets()) socket.close(1008, 'Session expired');
        await this.ctx.storage.deleteAll(); return;
      }
      await this.save(record, Date.now()); this.broadcast(record);
    });
  }
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'request_failed';
  const known = /^(invalid_|missing_|body_too_large|fresh_gps_required|photo_metadata_forbidden|hunting_required|upload_limit|command_limit|rate_limited|unauthorized|session_expired)/.test(message);
  return json({ error: known ? message : 'request_failed' }, message === 'unauthorized' ? 401 : message === 'rate_limited' ? 429 : message === 'session_expired' ? 410 : known ? 400 : 500);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = !origin || env.ALLOWED_ORIGINS.split(',').includes(origin);
    if (!allowed) return json({ error: 'origin_forbidden' }, 403);
    const headers = { 'Access-Control-Allow-Origin': origin ?? '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      const path = new URL(request.url).pathname;
      let response: Response;
      if (path === '/health') response = json({ ok: true, protocol: 1 });
      else if (path === '/games' && request.method === 'POST') response = json(await env.DIRECTORY.getByName('directory').create(await bodyJson(request)), 201);
      else if (/^\/games\/[A-Z2-9]{6}\/join$/.test(path) && request.method === 'POST') {
        const id = await env.DIRECTORY.getByName('directory').lookup(path.split('/')[2]);
        if (!id) response = json({ error: 'game_not_found' }, 404);
        else response = await env.GAMES.getByName(id).fetch(new Request(new URL(`/sessions/${id}/join`, request.url), request));
      } else if (/^\/sessions\/[a-f0-9-]{36}(\/.*)?$/.test(path)) response = await env.GAMES.getByName(path.split('/')[2]).fetch(request);
      else response = json({ error: 'not_found' }, 404);
      if (response.status === 101) return response;
      const result = new Response(response.body, response); for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
      return result;
    } catch (error) { const response = failure(error); for (const [key, value] of Object.entries(headers)) response.headers.set(key, value); return response; }
  },
} satisfies ExportedHandler<Env>;
