const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, overrides = {}) {
  const exports = {};
  const context = {
    exports, require, URL, Request, Response, TextEncoder, AbortSignal,
    ReadableStream, setTimeout, clearTimeout, setInterval, clearInterval,
    process: { env: { COINCAP_API_KEY: 'private-test-key' } },
    ...overrides,
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, context, { filename: file });
  return exports;
}

const restFile = 'app/api/coincap/[...path]/route.ts';
const restRequest = (get, path, query = '') => get(
  new Request(`http://localhost/api/coincap/${path.join('/')}?${query}`),
  { params: Promise.resolve({ path }) },
);

test('REST authenticates only upstream, fixes the provider host, and caches data', async () => {
  let called = false;
  const { GET } = load(restFile, { fetch: async (url, options) => {
    called = true;
    assert.equal(url.toString(), 'https://rest.coincap.io/v3/assets?limit=200');
    assert.equal(options.headers.Authorization, 'Bearer private-test-key');
    assert.equal(options.next.revalidate, 60);
    assert.equal(options.redirect, 'error');
    return Response.json({ data: [{ id: 'bitcoin', priceUsd: '100' }] });
  } });
  const response = await restRequest(GET, ['assets'], 'limit=200');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  assert.equal((await response.json()).data[0].id, 'bitcoin');
  assert.ok(called);
});

test('REST rejects arbitrary endpoints, credential overrides, duplicate and unbounded queries', async () => {
  const { GET } = load(restFile, { fetch: () => { throw new Error('Must not fetch'); } });
  for (const [path, query] of [
    [['account'], ''], [['assets', '..'], ''], [['assets', 'bitcoin', 'markets'], ''],
    [['assets'], 'apiKey=attacker'], [['assets'], 'limit=201'], [['assets'], 'limit=0'],
    [['assets'], 'limit=10&limit=20'], [['assets'], 'search='],
    [['assets', 'bitcoin', 'history'], 'interval=m1&start=10'],
    [['assets', 'bitcoin', 'history'], 'interval=bad&start=1000&end=2000'],
  ]) assert.equal((await restRequest(GET, path, query)).status, 400);
});

test('REST supports asset details, searches, and normalized chart windows', async () => {
  const urls = [];
  const { GET } = load(restFile, { fetch: async (url) => {
    urls.push(url);
    return Response.json({ data: [] });
  } });
  assert.equal((await restRequest(GET, ['assets', 'bitcoin'])).status, 200);
  assert.equal((await restRequest(GET, ['assets'], 'search=BTC&limit=10')).status, 200);
  const end = Date.now();
  assert.equal((await restRequest(GET, ['assets', 'bitcoin', 'history'], `interval=m1&start=${end - 3600000}&end=${end}`)).status, 200);
  assert.equal(urls[0].pathname, '/v3/assets/bitcoin');
  assert.equal(urls[1].searchParams.get('search'), 'BTC');
  assert.equal(Number(urls[2].searchParams.get('end')) % 60000, 0);
});

test('provider denial is visible without echoing a secret or caching the error', async () => {
  const { GET } = load(restFile, { fetch: async () => new Response('private-test-key', { status: 403 }) });
  const response = await restRequest(GET, ['assets']);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const text = await response.text();
  assert.match(text, /refused access/);
  assert.match(text, /403/);
  assert.ok(!text.includes('private-test-key'));
});

test('missing configuration and network errors are sanitized', async () => {
  const missing = load(restFile, { process: { env: {} } });
  assert.equal((await restRequest(missing.GET, ['assets'])).status, 503);
  const failed = load(restFile, { fetch: async () => { throw new Error('private-test-key'); } });
  const response = await restRequest(failed.GET, ['assets']);
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('private-test-key'));
});

function streamFixture() {
  const sockets = [];
  const timers = new Map();
  class Socket {
    constructor(url) { this.url = url; sockets.push(this); }
    close() { this.closed = true; }
  }
  const { GET } = load('app/api/coincap/stream/route.ts', {
    WebSocket: Socket,
    setTimeout: (callback, ms) => { timers.set(ms, callback); return ms; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (callback, ms) => { timers.set(ms, callback); return ms; },
    clearInterval: (id) => timers.delete(id),
  });
  return { GET, sockets, timers };
}

test('stream relays only subscribed prices and closes upstream on client disconnect', async () => {
  const { GET, sockets, timers } = streamFixture();
  const abort = new AbortController();
  const response = await GET(new Request('http://localhost/api/coincap/stream?assets=bitcoin', { signal: abort.signal }));
  const socket = sockets[0];
  assert.equal(socket.url.searchParams.get('apiKey'), 'private-test-key');
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  const reader = response.body.getReader();
  socket.onopen();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: ready/);
  socket.onmessage({ data: JSON.stringify({ bitcoin: '100', ethereum: '20', apiKey: 'private-test-key' }) });
  const event = new TextDecoder().decode((await reader.read()).value);
  assert.match(event, /"bitcoin":"100"/);
  assert.ok(!event.includes('ethereum') && !event.includes('private-test-key'));
  abort.abort();
  assert.ok(socket.closed);
  assert.equal(timers.size, 0);
  assert.equal((await reader.read()).done, true);
});

test('stream denial is sanitized and ends upstream work', async () => {
  const { GET, sockets, timers } = streamFixture();
  const response = await GET(new Request('http://localhost/api/coincap/stream?assets=bitcoin'));
  sockets[0].onmessage({ data: 'Unauthorized private-test-key' });
  const body = await response.text();
  assert.match(body, /provider-error/);
  assert.ok(!body.includes('private-test-key'));
  assert.ok(sockets[0].closed);
  assert.equal(timers.size, 0);
});

test('stream renews before hosting timeout and cancellation clears timers', async () => {
  const { GET, sockets, timers } = streamFixture();
  const response = await GET(new Request('http://localhost/api/coincap/stream?assets=bitcoin'));
  sockets[0].onopen();
  timers.get(25000)();
  assert.match(await response.text(), /event: reconnect/);
  assert.ok(sockets[0].closed);
  assert.equal(timers.size, 0);
  const next = await GET(new Request('http://localhost/api/coincap/stream?assets=bitcoin'));
  await next.body.cancel();
  assert.ok(sockets[1].closed);
  assert.equal(timers.size, 0);
});

test('invalid streaming subscriptions never open upstream connections', async () => {
  const { GET, sockets } = streamFixture();
  for (const query of ['', 'assets=../account', 'assets=bitcoin&apiKey=override', 'assets=a&assets=b']) {
    assert.equal((await GET(new Request(`http://localhost/api/coincap/stream?${query}`))).status, 400);
  }
  assert.equal(sockets.length, 0);
});

test('browser waits for upstream readiness and stops after a provider error', () => {
  const sources = [];
  class Source {
    listeners = {};
    constructor(url) { this.url = url; sources.push(this); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    close() { this.closed = true; }
  }
  const { subscribeCoinCap } = load('utils/coincap-client.ts', { EventSource: Source });
  const statuses = [];
  const prices = [];
  const stop = subscribeCoinCap(['bitcoin'], (data) => prices.push(data), (status) => statuses.push(status));
  assert.equal(sources[0].url, '/api/coincap/stream?assets=bitcoin');
  assert.deepEqual(statuses, ['connecting']);
  sources[0].listeners.ready();
  sources[0].onmessage({ data: '{"bitcoin":"100"}' });
  sources[0].listeners['provider-error']();
  assert.deepEqual(statuses, ['connecting', 'live', 'error']);
  assert.equal(prices[0].bitcoin, '100');
  assert.ok(sources[0].closed);
  stop();
});

test('browser cancels pending reconnect work on unmount', () => {
  const sources = [];
  const timers = new Map();
  class Source {
    listeners = {};
    constructor() { sources.push(this); }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    close() { this.closed = true; }
  }
  const { subscribeCoinCap } = load('utils/coincap-client.ts', {
    EventSource: Source,
    setTimeout: (callback, ms) => { timers.set(ms, callback); return ms; },
    clearTimeout: (id) => timers.delete(id),
  });
  const stop = subscribeCoinCap(['bitcoin'], () => {});
  sources[0].onerror();
  assert.equal(timers.size, 1);
  const pending = timers.get(1000);
  stop();
  assert.equal(timers.size, 0);
  pending();
  assert.equal(sources.length, 1);
});
