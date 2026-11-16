import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

// MEMBERS-HDR (Crivo and CodeRabbit on PR 50): at the public URL, /data/members.json is fetched once and that very answer
// is checked, on both branches, so the Worker and the origin can never be mixed up between two requests. The throwaway
// server answers every other path with nothing the header contract accepts; only the count of members.json reads matters.
async function membersReads(source: 'built-in' | 'discord'): Promise<number> {
  let reads = 0;
  const server = createServer((request, response) => {
    if (request.url !== '/data/members.json') { response.writeHead(404); response.end(); return; }
    reads += 1;
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', 'x-content-type-options': 'nosniff' });
    response.end(JSON.stringify({ schema: 1, discord: { members: 900, updatedAt: '2026-11-16T00:00:00Z', source } }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const child = spawn(process.execPath, ['scripts/http-test.ts'], { env: { ...process.env, BASE_URL: `http://127.0.0.1:${port}`, PUBLIC: '1' }, stdio: 'ignore' });
    await new Promise(resolve => child.on('close', resolve));
    return reads;
  } finally { await new Promise(resolve => server.close(resolve)); }
}

test('the members.json probe is the one answer checked, on the Worker branch and on the origin branch', async () => {
  assert.equal(await membersReads('discord'), 1);
  assert.equal(await membersReads('built-in'), 1);
});
