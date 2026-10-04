import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFrontendServer } from './serve-prebuilt-frontend.mjs';

// Execute this suite on the remote build host. All listeners and files are
// isolated fixtures; the workstation's frontend and backend are never used.
const html = '<!doctype html><title>Prebuilt fixture</title>';
const javascript = 'console.log("fixture");';
const options = { timeout: 15000 };

async function listen(t, server) {
  const sockets = new Set();
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

async function fixture(t, handler = (_request, response) => {
  response.writeHead(404);
  response.end();
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'prebuilt-frontend-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const assets = path.join(directory, 'browser');
  await mkdir(assets);
  await writeFile(path.join(assets, 'index.html'), html);
  await writeFile(path.join(assets, 'main.js'), javascript);
  const backend = http.createServer(handler);
  const backendUrl = await listen(t, backend);
  const frontend = await createFrontendServer(assets, backendUrl);
  const url = await listen(t, frontend);
  return { directory, assets, backend, backendUrl, frontend, url };
}

function request(base, target, { method = 'GET', headers = {}, body } = {}) {
  const address = new URL(base);
  return new Promise((resolve, reject) => {
    const outgoing = http.request({
      hostname: address.hostname, port: address.port,
      path: target, method, headers, agent: false,
    }, incoming => {
      const chunks = [];
      incoming.on('data', chunk => chunks.push(chunk));
      const result = aborted => ({
        status: incoming.statusCode,
        headers: incoming.headers,
        body: Buffer.concat(chunks).toString(),
        aborted,
      });
      incoming.on('end', () => resolve(result(false)));
      incoming.on('aborted', () => resolve(result(true)));
      incoming.on('error', () => resolve(result(true)));
    });
    outgoing.on('error', reject);
    outgoing.setTimeout(10000, () => outgoing.destroy(new Error('Fixture HTTP timeout')));
    outgoing.end(body);
  });
}

test('serves the entry point without Accept and serves typed assets', options, async t => {
  const { url } = await fixture(t);
  const entry = await request(url, '/');
  assert.equal(entry.status, 200);
  assert.equal(entry.body, html);
  assert.match(entry.headers['content-type'], /^text\/html/);
  assert.equal(entry.headers['cache-control'], 'no-cache');
  assert.equal(entry.headers['x-content-type-options'], 'nosniff');
  const script = await request(url, '/main.js?v=1');
  assert.equal(script.status, 200);
  assert.equal(script.body, javascript);
  assert.match(script.headers['content-type'], /^text\/javascript/);
});

test('HEAD preserves metadata and omits the body for root and assets', options, async t => {
  const { url } = await fixture(t);
  for (const [target, content] of [['/', html], ['/main.js', javascript]]) {
    const result = await request(url, target, { method: 'HEAD' });
    assert.equal(result.status, 200);
    assert.equal(result.body, '');
    assert.equal(Number(result.headers['content-length']), Buffer.byteLength(content));
  }
});

test('SPA fallback only serves document routes and missing assets stay 404', options, async t => {
  const { url } = await fixture(t);
  const route = await request(url, '/projects/example/board', { headers: { accept: 'text/html' } });
  assert.equal(route.status, 200);
  assert.equal(route.body, html);
  assert.equal((await request(url, '/projects/example/board')).status, 404);
  assert.equal((await request(url, '/missing.js', { headers: { accept: 'text/html' } })).status, 404);
  const refused = await request(url, '/main.js', { method: 'POST', body: 'ignored' });
  assert.equal(refused.status, 405);
  assert.equal(refused.headers.allow, 'GET, HEAD');
});

test('rejects traversal, invalid escapes and links outside the asset directory', options, async t => {
  const { directory, assets, url } = await fixture(t);
  await writeFile(path.join(directory, 'private.txt'), 'private fixture');
  await symlink(path.join(directory, 'private.txt'), path.join(assets, 'leak.txt'));
  for (const target of ['/../private.txt', '/%2e%2e/private.txt', '/%2e%2e%2fprivate.txt', '/%5cprivate.txt', '/%00', '/%ZZ']) {
    const result = await request(url, target, { headers: { accept: 'text/html' } });
    assert.equal(result.status, 400, target);
    assert.doesNotMatch(result.body, /private fixture/);
  }
  assert.equal((await request(url, '/leak.txt')).status, 403);
  assert.equal((await request(url, '/')).status, 200);
});

test('forwards API method, raw path, body, identity headers and response headers', options, async t => {
  let observed;
  const { url, backendUrl } = await fixture(t, async (incoming, response) => {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    observed = { method: incoming.method, url: incoming.url, headers: incoming.headers, body: Buffer.concat(chunks).toString() };
    response.writeHead(207, { 'Content-Type': 'application/json', 'X-Fixture': 'upstream', 'Set-Cookie': ['one=1', 'two=2'] });
    response.end('{"saved":true}');
  });
  const body = '{"task":"fixture"}';
  const result = await request(url, '/api/../healthz?literal=%2F', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Client-Id': 'fixture-client', Authorization: 'Bearer fixture' },
    body,
  });
  assert.equal(result.status, 207);
  assert.equal(result.body, '{"saved":true}');
  assert.equal(result.headers['x-fixture'], 'upstream');
  assert.deepEqual(result.headers['set-cookie'], ['one=1', 'two=2']);
  assert.equal(observed.method, 'POST');
  assert.equal(observed.url, '/api/../healthz?literal=%2F');
  assert.equal(observed.body, body);
  assert.equal(observed.headers['x-client-id'], 'fixture-client');
  assert.equal(observed.headers.authorization, 'Bearer fixture');
  assert.equal(observed.headers.host, new URL(backendUrl).host);
});

test('prefix lookalikes do not reach the backend', options, async t => {
  let calls = 0;
  const { url } = await fixture(t, (_request, response) => {
    calls++;
    response.end('upstream');
  });
  const result = await request(url, '/apix/board', { headers: { accept: 'text/html' } });
  assert.equal(result.status, 200);
  assert.equal(result.body, html);
  assert.equal(calls, 0);
});

test('backend connection failure returns 502 while static assets remain available', options, async t => {
  const { url, backend } = await fixture(t);
  await new Promise(resolve => backend.close(resolve));
  assert.equal((await request(url, '/api/tasks')).status, 502);
  assert.equal((await request(url, '/')).status, 200);
});

test('an aborted upstream response cannot crash the frontend server', options, async t => {
  const { url } = await fixture(t, (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': 10000 });
    response.write('partial');
    setImmediate(() => response.destroy());
  });
  const result = await request(url, '/api/abort').catch(() => ({ aborted: true }));
  assert.ok(result.aborted || result.status === 502);
  assert.equal((await request(url, '/')).body, html);
});

test('passes WebSocket upgrade headers, head bytes and bidirectional socket data', options, async t => {
  const { url, backend } = await fixture(t);
  let observedPath;
  backend.on('upgrade', (incoming, socket, head) => {
    observedPath = incoming.url;
    socket.on('error', () => {});
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\nready:');
    let received = head.toString();
    const respond = chunk => {
      received += chunk.toString();
      if (received.includes('ping')) socket.write('pong');
    };
    socket.on('data', respond);
    if (received.includes('ping')) socket.write('pong');
  });
  await new Promise((resolve, reject) => {
    const outgoing = http.request(url + '/hubs/fixture?connection=one', { headers: { Connection: 'Upgrade', Upgrade: 'websocket' } });
    outgoing.on('error', reject);
    outgoing.on('response', incoming => {
      incoming.resume();
      reject(new Error('Expected upgrade, received ' + incoming.statusCode));
    });
    outgoing.on('upgrade', (incoming, socket, head) => {
      assert.equal(incoming.statusCode, 101);
      assert.equal(incoming.headers.upgrade, 'websocket');
      let received = head.toString();
      const check = chunk => {
        received += chunk.toString();
        if (received.includes('ready:') && received.includes('pong')) {
          socket.destroy();
          resolve();
        }
      };
      socket.on('error', reject);
      socket.on('data', check);
      socket.write('ping');
      check(Buffer.alloc(0));
    });
    outgoing.end();
  });
  assert.equal(observedPath, '/hubs/fixture?connection=one');
});

test('disconnecting before an upgrade closes the pending backend connection', options, async t => {
  const { url, backend } = await fixture(t);
  let backendArrived;
  const arrived = new Promise(resolve => { backendArrived = resolve; });
  let backendClosed;
  const closed = new Promise(resolve => { backendClosed = resolve; });
  backend.on('upgrade', (_request, socket) => {
    socket.on('error', () => {});
    socket.on('close', backendClosed);
    socket.on('end', () => socket.end());
    socket.resume();
    backendArrived();
  });
  const outgoing = http.request(url + '/hubs/pending', { headers: { Connection: 'Upgrade', Upgrade: 'websocket' } });
  outgoing.on('error', () => {});
  outgoing.end();
  await arrived;
  outgoing.destroy();
  await closed;
});

test('rejects non-loopback upstreams and incomplete frontend artifacts', options, async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'prebuilt-frontend-invalid-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'index.html'), html);
  await assert.rejects(createFrontendServer(directory, 'https://127.0.0.1:5031'), /loopback/);
  await assert.rejects(createFrontendServer(directory, 'http://example.invalid:5031'), /loopback/);
  const missing = path.join(directory, 'missing');
  await mkdir(missing);
  await assert.rejects(createFrontendServer(missing, 'http://127.0.0.1:5031'), /ENOENT/);
  await mkdir(path.join(missing, 'index.html'));
  await assert.rejects(createFrontendServer(missing, 'http://127.0.0.1:5031'), /must be a file/);
});
