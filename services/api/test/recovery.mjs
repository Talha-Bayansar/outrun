import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { ApiClient } from '../../../packages/api-client/src/index.ts';
const path = new URL('../.wrangler/recovery-fixture.json', import.meta.url);
const base = process.env.OUTRUN_TEST_API ?? 'http://127.0.0.1:8787';
if (process.argv[2] === 'prepare') {
  const host = new ApiClient(base);
  host.membership = await host.create({ name: 'Recovery host', settings: { preparationMs: 0, headStartMs: 0 },
    area: { center: { latitude: 50.85, longitude: 4.35 }, radiusMeters: 1000 } });
  const memberships = [host.membership];
  for (let n = 0; n < 3; n++) memberships.push(await host.join(host.membership.code, `Recovery runner ${n}`));
  for (const membership of memberships) {
    const c = new ApiClient(base, membership);
    await c.location({ latitude: 50.85, longitude: 4.35, accuracyMeters: 2, observedAt: Date.now(), sequence: 1 });
    await c.command({ id: crypto.randomUUID(), type: 'ready', ready: true });
  }
  const command = { id: crypto.randomUUID(), type: 'start' }; await host.command(command);
  await mkdir(new URL('../.wrangler', import.meta.url), { recursive: true });
  await writeFile(path, JSON.stringify({ membership: host.membership, command, before: await host.snapshot() }));
  console.log('Recovery fixture prepared. Restart the API, then run verify.');
} else {
  const fixture = JSON.parse(await readFile(path, 'utf8'));
  const host = new ApiClient(base, fixture.membership), after = await host.snapshot();
  assert.deepEqual(after.session.deadlines, fixture.before.session.deadlines);
  assert.equal(after.session.players.length, 4);
  assert.equal((await host.command(fixture.command)).duplicate, true);
  assert.ok(after.version >= fixture.before.version);
  console.log('Restart recovery verified: roster, deadlines and durable command receipt preserved.');
  await host.command({ id: crypto.randomUUID(), type: 'abort' });
}
