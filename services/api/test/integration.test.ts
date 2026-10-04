import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../../../packages/api-client/src/index.ts';
import jpeg from 'jpeg-js';

const base = process.env.OUTRUN_TEST_API ?? 'http://127.0.0.1:8787';
test('live multiplayer membership, privacy, receipts, start, websocket recovery and revocation', async () => {
  const host = new ApiClient(base);
  const membership = await host.create({ name: 'Host', settings: { preparationMs: 0, headStartMs: 0 },
    area: { center: { latitude: 50.85, longitude: 4.35 }, radiusMeters: 1000 } });
  host.membership = membership;
  const clients = [host];
  for (let n = 0; n < 3; n++) { const client = new ApiClient(base); client.membership = await client.join(membership.code, `Runner ${n}`); clients.push(client); }
  const initial = await host.snapshot();
  assert.equal(initial.session.players.length, 4);
  assert.equal('receipts' in initial.session, false);
  assert.equal('tracking' in initial, false);
  const forbidden = new ApiClient(base, { ...membership, token: 'wrong' });
  await assert.rejects(() => forbidden.snapshot(), (e: ApiError) => e.status === 401);
  await assert.rejects(() => clients[1].command({ id: crypto.randomUUID(), type: 'abort' }), /host required/);
  await assert.rejects(() => host.command({ id: crypto.randomUUID(), type: 'ready', ready: true }), /fresh gps required/);
  for (const c of clients) {
    assert.equal((await c.location({ latitude: 50.85, longitude: 4.35, accuracyMeters: 2, observedAt: Date.now(), sequence: 1 })).accepted, true);
    await c.command({ id: crypto.randomUUID(), type: 'ready', ready: true });
  }
  const start = { id: crypto.randomUUID(), type: 'start' };
  await host.command(start); assert.equal((await host.command(start)).duplicate, true);
  const started = await host.snapshot(); assert.equal(started.session.phase, 'active');
  const runner = clients[1];
  await runner.location({ latitude: 50.8501, longitude: 4.3501, accuracyMeters: 2, observedAt: Date.now(), sequence: 2 });
  const hidden = await host.snapshot(); assert.equal(hidden.locations.reveal, undefined);
  assert.equal(JSON.stringify(hidden).includes('50.8501'), false);
  const socket = new WebSocket(base.replace('http', 'ws') + host.path('/realtime'));
  const wsView = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Handshake timeout')); }, 5000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'handshake', protocol: 1, token: membership.token }));
    socket.onmessage = e => { clearTimeout(timer); resolve(JSON.parse(String(e.data))); };
    socket.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket failed')); };
  });
  assert.equal(wsView.type, 'snapshot'); socket.close();
  const leave = { id: crypto.randomUUID(), type: 'leave' };
  await runner.command(leave);
  await assert.rejects(() => runner.snapshot(), (e: ApiError) => e.status === 401);
  const after = await host.snapshot(); assert.equal(after.session.players.find(p => p.id === runner.membership!.playerId)?.left, true);
  await host.command({ id: crypto.randomUUID(), type: 'abort' });
  assert.equal((await clients[2].snapshot()).session.phase, 'cancelled');
});

test('verified private photo capture, target response, host review and final results', async () => {
  const host = new ApiClient(base);
  host.membership = await host.create({ name: 'Photo host', settings: { preparationMs: 0, headStartMs: 0 },
    area: { center: { latitude: 50.85, longitude: 4.35 }, radiusMeters: 1000 } });
  const clients = [host];
  for (let n = 0; n < 3; n++) { const c = new ApiClient(base); c.membership = await c.join(host.membership.code, `Photo runner ${n}`); clients.push(c); }
  for (const c of clients) {
    await c.location({ latitude: 50.85, longitude: 4.35, accuracyMeters: 2, observedAt: Date.now(), sequence: 1 });
    await c.command({ id: crypto.randomUUID(), type: 'ready', ready: true });
  }
  await host.command({ id: crypto.randomUUID(), type: 'start' });
  for (const c of clients) await c.location({ latitude: 50.85, longitude: 4.35, accuracyMeters: 2, observedAt: Date.now(), sequence: 2 });
  await assert.rejects(() => host.upload(new Blob([new Uint8Array([255,216,255,217])], { type: 'image/jpeg' })), /invalid photo/);
  const image = jpeg.encode({ width: 32, height: 32, data: new Uint8Array(32 * 32 * 4).fill(255) }, 70).data;
  const uploaded = await host.upload(new Blob([image], { type: 'image/jpeg' }));
  const capture = { id: crypto.randomUUID(), type: 'capture', targetId: clients[1].membership!.playerId, evidenceId: uploaded.evidenceId };
  await host.command(capture); assert.equal((await host.command(capture)).duplicate, true);
  const photoPath = host.path(`/evidence/${uploaded.evidenceId}`);
  const targetResponse = await fetch(base + photoPath, { headers: { Authorization: `Bearer ${clients[1].membership!.token}` } });
  assert.equal(targetResponse.status, 200); assert.equal(targetResponse.headers.get('Cache-Control'), 'no-store');
  await targetResponse.arrayBuffer();
  const strangerResponse = await fetch(base + photoPath, { headers: { Authorization: `Bearer ${clients[2].membership!.token}` } });
  assert.equal(strangerResponse.status, 401); await strangerResponse.arrayBuffer();
  await clients[1].command({ id: crypto.randomUUID(), type: 'dispute_capture', captureId: capture.id });
  await assert.rejects(() => clients[2].command({ id: crypto.randomUUID(), type: 'review_capture', captureId: capture.id, approve: true }), /host required/);
  await host.command({ id: crypto.randomUUID(), type: 'review_capture', captureId: capture.id, approve: true });
  assert.equal((await clients[1].snapshot()).session.players.find(p => p.id === clients[1].membership!.playerId)?.eliminated, true);
  assert.deepEqual((await clients[1].snapshot()).locations, {});
  const expiredPhoto = await fetch(base + photoPath, { headers: { Authorization: `Bearer ${host.membership.token}` } });
  assert.equal(expiredPhoto.status, 401); await expiredPhoto.arrayBuffer();
  for (const c of clients.slice(2)) {
    const evidence = await host.upload(new Blob([image], { type: 'image/jpeg' }));
    const command = { id: crypto.randomUUID(), type: 'capture', targetId: c.membership!.playerId, evidenceId: evidence.evidenceId };
    await host.command(command); await c.command({ id: crypto.randomUUID(), type: 'accept_capture', captureId: command.id });
  }
  const ended = await host.snapshot(); assert.equal(ended.session.result?.winner, 'hunters'); assert.deepEqual(ended.locations, {});
  assert.equal(ended.results?.captureCounts[host.membership.playerId], 3);
  await clients[1].request(clients[1].path('/membership'), { method: 'DELETE' });
  await assert.rejects(() => clients[1].snapshot(), (e: ApiError) => e.status === 401);
  assert.equal((await host.snapshot()).session.players.find(p => p.id === clients[1].membership!.playerId)?.name, 'Deleted player');
});

test('durable alarms freeze and expire reveals, then end a round without player commands', { timeout: 80_000 }, async () => {
  const host = new ApiClient(base);
  host.membership = await host.create({ name: 'Alarm host', settings: { preparationMs: 0, headStartMs: 0, durationMs: 60000,
    revealIntervalMs: 15000, revealWindowMs: 1000 }, area: { center: { latitude: 50.85, longitude: 4.35 }, radiusMeters: 1000 } });
  const clients = [host];
  for (let n = 0; n < 3; n++) { const c = new ApiClient(base); c.membership = await c.join(host.membership.code, `Alarm runner ${n}`); clients.push(c); }
  for (const c of clients) {
    await c.location({ latitude: 50.85, longitude: 4.35, accuracyMeters: 2, observedAt: Date.now(), sequence: 1 });
    await c.command({ id: crypto.randomUUID(), type: 'ready', ready: true });
  }
  await host.command({ id: crypto.randomUUID(), type: 'start' });
  for (const c of clients) await c.location({ latitude: 50.85, longitude: 4.35, accuracyMeters: 2, observedAt: Date.now(), sequence: 2 });
  let revealed = false, expired = false;
  await new Promise<void>((resolve, reject) => {
    let dispose: () => void;
    const timeout = setTimeout(() => { dispose(); reject(new Error('Deadline alarm did not deliver')); }, 75000);
    dispose = host.subscribe(snapshot => {
      if (snapshot.locations.reveal?.markers.length) revealed = true;
      if (revealed && !snapshot.locations.reveal) expired = true;
      if (snapshot.session.phase === 'ended') {
        try { assert.equal(snapshot.session.result?.winner, 'runners'); assert.equal(revealed, true); assert.equal(expired, true);
          assert.deepEqual(snapshot.locations, {}); clearTimeout(timeout); dispose(); resolve();
        } catch (error) { clearTimeout(timeout); dispose(); reject(error); }
      }
    }, () => {});
  });
});
