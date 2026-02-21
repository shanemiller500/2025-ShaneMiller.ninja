/**
 * marketStore.ts — Module-level singleton for all Finnhub market data.
 *
 * WHAT THIS SOLVES
 * ────────────────
 * Previously each component (MarketWidgets, LiveStreamHeatmapSection,
 * LiveStreamTickerWidget) maintained its own fetch logic, caches, and
 * WebSocket connection. The result was 200+ API calls on page load and
 * up to 3 separate WS connections, causing 429 rate-limit errors.
 *
 * HOW IT WORKS
 * ────────────
 * 1. Quote cache  (10-min TTL, in-memory)
 * 2. Profile cache (24-h TTL, in-memory + localStorage)
 * 3. In-flight deduplication — if AAPL is already being fetched, a second
 *    request gets the same Promise (zero duplicate HTTP calls)
 * 4. Priority queue — HIGH requests run first, then MEDIUM, then LOW
 * 5. Concurrency cap — max 3 simultaneous requests
 * 6. Rate limiting — 250ms minimum between items
 * 7. 429 backoff — exponential back-off: min(12 000, 900 × 2^n) ms
 * 8. Single WebSocket connection shared across all components, with
 *    symbol-level ref-counting (subscribe/unsubscribe per component)
 */

import type {
  QuoteData,
  ProfileData,
  TickerData,
  MarketStatus,
  DataPriority,
  StoreSubscriber,
} from "./types";

/* ─── Config ──────────────────────────────────────────────────────────── */
const PROXY          = "https://u-mail.co/api/finnhubProxy";
const WS_URL_BASE    = "wss://ws.finnhub.io";
const QUOTE_TTL      = 10 * 60 * 1_000;      // 10 minutes
const PROFILE_TTL    = 24 * 60 * 60 * 1_000; // 24 hours
const STATUS_TTL     = 5  * 60 * 1_000;      // 5 minutes
const LS_KEY         = "market_profiles_v1";  // localStorage key
const MAX_CONCURRENT    = 2;    // conservative — prevents burst 429s
const ITEM_DELAY_MS     = 500;  // 2 req/sec max throughput
const RATE_LIMIT_PAUSE  = 4_000; // pause queue this long after any 429

/* ─── Internal state (module-scoped, not React state) ─────────────────── */

interface CachedQuote   { data: QuoteData;   ts: number }
interface CachedProfile { data: ProfileData | null; logo: string; ts: number }

const quoteCache:   Map<string, CachedQuote>   = new Map();
const profileCache: Map<string, CachedProfile> = new Map();

// In-flight Promises keyed by `"quote:AAPL"` or `"profile:AAPL"`
const inflight: Map<string, Promise<any>> = new Map();

// Subscribers: symbol → Set of callbacks
const subscribers: Map<string, Set<StoreSubscriber>> = new Map();

// WebSocket state
let wsSocket:       WebSocket | null = null;
let wsReconnTimer:  ReturnType<typeof setTimeout> | null = null;
let wsRefCount:     Map<string, number> = new Map(); // symbol → subscriber count
let wsStopped       = false;

// Market status cache
let statusCache: { data: MarketStatus; ts: number } | null = null;

// Priority queue
type QueueEntry = { symbol: string; kind: "quote" | "profile"; priority: DataPriority };
const QUEUE: QueueEntry[] = [];
let active = 0; // number of concurrent fetches in flight
let queueRunning = false;

// Global rate-limit gate — when set, the queue pauses until this timestamp
let rateLimitedUntil = 0;

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const priorityOrder: Record<DataPriority, number> = { high: 0, medium: 1, low: 2 };

/** Sort queue so HIGH items always process first. */
function sortQueue() {
  QUEUE.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/** Fire callbacks for all subscribers watching `symbol`. */
function notify(symbol: string, data: TickerData) {
  const set = subscribers.get(symbol);
  if (set) set.forEach((cb) => cb(symbol, data));
}

/** Build a TickerData from whatever caches we have. */
function buildTickerData(symbol: string): TickerData | null {
  const q = quoteCache.get(symbol);
  if (!q) return null;
  const p = profileCache.get(symbol);
  return {
    symbol,
    quote: q.data,
    profile: p?.data ?? undefined,
    logo: p?.logo ?? "",
  };
}

/* ─── localStorage profile persistence ───────────────────────────────── */

function loadProfilesFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedProfile>;
    const now = Date.now();
    for (const [sym, entry] of Object.entries(parsed)) {
      if (entry?.ts && now - entry.ts < PROFILE_TTL) {
        profileCache.set(sym, entry);
      }
    }
  } catch { /* ignore */ }
}

function saveProfilesToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, CachedProfile> = {};
    for (const [sym, entry] of Array.from(profileCache.entries())) {
      obj[sym] = entry;
    }
    window.localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

// Hydrate from localStorage on module load (runs once)
loadProfilesFromStorage();

/* ─── Fetch with 429 backoff ──────────────────────────────────────────── */

async function fetchWithBackoff(url: string, tries = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (res.status === 429) {
        // Signal the queue to pause globally — no point hammering while limited
        rateLimitedUntil = Date.now() + RATE_LIMIT_PAUSE * Math.pow(1.5, i);
        const wait = Math.min(12_000, 900 * Math.pow(2, i));
        await sleep(wait);
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      const wait = Math.min(12_000, 900 * Math.pow(2, i));
      await sleep(wait);
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

/* ─── Logo resolution (finnhub logo → clearbit fallback) ─────────────── */

function cleanUrl(raw?: string): string {
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch { return ""; }
}

function resolveLogo(profile: any): string {
  const finnhub = cleanUrl(profile?.logo);
  if (finnhub) return finnhub;
  const domain =
    cleanUrl(profile?.weburl)?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] ||
    cleanUrl(profile?.website)?.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] || "";
  return domain ? `https://logo.clearbit.com/${domain}` : "";
}

/* ─── Core fetch functions ────────────────────────────────────────────── */

async function doFetchQuote(symbol: string): Promise<QuoteData | null> {
  const key = `quote:${symbol}`;

  // Check cache first
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;

  // Dedup: reuse in-flight promise
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async (): Promise<QuoteData | null> => {
    try {
      const res = await fetchWithBackoff(`${PROXY}/quote/${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      const data = await res.json() as QuoteData;
      if (typeof data?.c !== "number" || data.c <= 0) return null;
      quoteCache.set(symbol, { data, ts: Date.now() });

      // Notify subscribers with updated TickerData
      const td = buildTickerData(symbol);
      if (td) notify(symbol, td);

      return data;
    } catch { return null; }
    finally { inflight.delete(key); }
  })();

  inflight.set(key, promise);
  return promise;
}

async function doFetchProfile(symbol: string): Promise<CachedProfile | null> {
  const key = `profile:${symbol}`;

  // Check cache first
  const cached = profileCache.get(symbol);
  if (cached && Date.now() - cached.ts < PROFILE_TTL) return cached;

  // Dedup: reuse in-flight promise
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async (): Promise<CachedProfile | null> => {
    try {
      const res = await fetchWithBackoff(`${PROXY}/profile/${encodeURIComponent(symbol)}`);
      if (!res.ok) return null;
      const data = await res.json() as ProfileData;
      const logo = resolveLogo(data);
      const entry: CachedProfile = { data: data || null, logo, ts: Date.now() };
      profileCache.set(symbol, entry);
      saveProfilesToStorage();

      // Notify subscribers with updated TickerData
      const td = buildTickerData(symbol);
      if (td) notify(symbol, td);

      return entry;
    } catch { return null; }
    finally { inflight.delete(key); }
  })();

  inflight.set(key, promise);
  return promise;
}

/* ─── Priority queue processor ────────────────────────────────────────── */

async function processQueue(): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;

  while (QUEUE.length > 0) {
    // Honour global rate-limit pause before starting the next request
    const rlWait = rateLimitedUntil - Date.now();
    if (rlWait > 0) await sleep(rlWait);

    // Wait for a concurrency slot
    while (active >= MAX_CONCURRENT) {
      await sleep(50);
    }

    sortQueue();
    const entry = QUEUE.shift();
    if (!entry) break;

    active++;
    (async () => {
      try {
        if (entry.kind === "quote") await doFetchQuote(entry.symbol);
        else                         await doFetchProfile(entry.symbol);
      } finally {
        active--;
      }
    })();

    // Minimum gap between starting requests
    await sleep(ITEM_DELAY_MS);
  }

  queueRunning = false;
}

function enqueue(symbol: string, kind: "quote" | "profile", priority: DataPriority) {
  // Skip if already cached / in-flight / already queued
  if (kind === "quote") {
    const c = quoteCache.get(symbol);
    if (c && Date.now() - c.ts < QUOTE_TTL) return;
    if (inflight.has(`quote:${symbol}`)) return;
  } else {
    const c = profileCache.get(symbol);
    if (c && Date.now() - c.ts < PROFILE_TTL) return;
    if (inflight.has(`profile:${symbol}`)) return;
  }
  if (QUEUE.some((q) => q.symbol === symbol && q.kind === kind)) return;

  QUEUE.push({ symbol, kind, priority });
  processQueue();
}

/* ─── WebSocket ───────────────────────────────────────────────────────── */

function getApiToken(): string {
  // Token loaded from env at runtime
  try {
    // Dynamic import of config not ideal in singleton; read from window or
    // rely on caller passing it via wsInit()
    return (globalThis as any).__FINNHUB_TOKEN__ ?? "";
  } catch { return ""; }
}

function wsConnect(attempt = 0) {
  if (wsStopped) return;

  const token = getApiToken();
  if (!token) return;

  const safeClose = (sock: WebSocket | null) => {
    if (!sock) return;
    try {
      sock.onopen = null; sock.onclose = null;
      sock.onerror = null; sock.onmessage = null;
      if (sock.readyState <= WebSocket.OPEN) sock.close();
    } catch { /* ignore */ }
  };

  safeClose(wsSocket);

  const ws = new WebSocket(`${WS_URL_BASE}?token=${token}`);
  wsSocket = ws;

  ws.onopen = () => {
    if (wsStopped) return;
    // Re-subscribe all symbols that have active subscribers
    for (const sym of Array.from(wsRefCount.keys())) {
      try { ws.send(JSON.stringify({ type: "subscribe", symbol: sym })); } catch { /* ignore */ }
    }
    // Notify all subscribers of WS state change
    notifyWsState(true);
  };

  ws.onmessage = (evt) => {
    if (wsStopped) return;
    let msg: any;
    try { msg = JSON.parse(evt.data); } catch { return; }

    if (msg?.type === "error") { safeClose(ws); return; }
    if (msg?.type !== "trade" || !Array.isArray(msg.data)) return;

    const trades = msg.data as Array<{ s: string; p: number; t: number }>;

    for (const u of trades) {
      const sym = u.s;
      if (!wsRefCount.has(sym)) continue;

      const price = Number(u.p);
      if (!Number.isFinite(price) || price <= 0) continue;

      const cached = quoteCache.get(sym);
      if (!cached) continue;

      // Update cached quote with latest price (keep prevClose from REST)
      const updated: QuoteData = {
        ...cached.data,
        c: price,
        d: price - (cached.data.pc ?? 0),
        dp: cached.data.pc > 0 ? ((price - cached.data.pc) / cached.data.pc) * 100 : 0,
        t: typeof u.t === "number" && u.t > 0 ? Math.floor(u.t / 1000) : cached.data.t,
      };
      quoteCache.set(sym, { data: updated, ts: cached.ts }); // keep original fetch ts

      const td = buildTickerData(sym);
      if (td) notify(sym, td);
    }
  };

  ws.onerror = () => {
    if (wsStopped) return;
    notifyWsState(false);
    safeClose(ws);
  };

  ws.onclose = (evt) => {
    if (wsStopped) return;
    notifyWsState(false);
    if (evt.code === 1008) return; // policy violation — do not retry

    const wait = Math.min(15_000, 1_200 * Math.pow(2, attempt));
    if (wsReconnTimer) clearTimeout(wsReconnTimer);
    wsReconnTimer = setTimeout(() => wsConnect(attempt + 1), wait);
  };
}

/* WS state callbacks (components can listen via wsStateSubscribers) */
type WsStateCallback = (connected: boolean) => void;
const wsStateSubscribers: Set<WsStateCallback> = new Set();

function notifyWsState(connected: boolean) {
  wsStateSubscribers.forEach((cb) => cb(connected));
}

/* ─── Public API ──────────────────────────────────────────────────────── */

export const marketStore = {
  /* ── Data access ──────────────────────────────────────────────────── */

  /** Sync read from cache. Returns null if not yet loaded. */
  getQuote(symbol: string): { data: QuoteData | null; fresh: boolean } {
    const c = quoteCache.get(symbol);
    if (!c) return { data: null, fresh: false };
    return { data: c.data, fresh: Date.now() - c.ts < QUOTE_TTL };
  },

  getProfile(symbol: string): { data: ProfileData | null; logo: string; fresh: boolean } {
    const c = profileCache.get(symbol);
    if (!c) return { data: null, logo: "", fresh: false };
    return { data: c.data, logo: c.logo, fresh: Date.now() - c.ts < PROFILE_TTL };
  },

  /** Async request — adds to priority queue, resolves when data is ready. */
  async requestQuote(symbol: string, priority: DataPriority): Promise<QuoteData | null> {
    const cached = quoteCache.get(symbol);
    if (cached && Date.now() - cached.ts < QUOTE_TTL) return cached.data;
    enqueue(symbol, "quote", priority);
    // Poll until the queue processes this symbol (or it appears via in-flight)
    return new Promise((resolve) => {
      const unsub = marketStore.subscribe([symbol], (_, td) => {
        unsub();
        resolve(td.quote);
      });
      // Fallback: resolve null after 30s to avoid hanging
      setTimeout(() => { unsub(); resolve(null); }, 30_000);
    });
  },

  async requestProfile(symbol: string, priority: DataPriority): Promise<ProfileData | null> {
    const cached = profileCache.get(symbol);
    if (cached && Date.now() - cached.ts < PROFILE_TTL) return cached.data;
    enqueue(symbol, "profile", priority);
    return new Promise((resolve) => {
      // We don't have a profile-specific event, so just wait for any update
      const unsub = marketStore.subscribe([symbol], (_, td) => {
        if (td.profile) { unsub(); resolve(td.profile); }
      });
      setTimeout(() => { unsub(); resolve(null); }, 30_000);
    });
  },

  /** Request quotes + profiles for multiple symbols at once. */
  prefetch(symbols: string[], priority: DataPriority): void {
    for (const sym of symbols) {
      enqueue(sym, "quote",   priority);
      enqueue(sym, "profile", priority);
    }
  },

  /** Market status (cached 5min). */
  async getMarketStatus(): Promise<MarketStatus | null> {
    if (statusCache && Date.now() - statusCache.ts < STATUS_TTL) return statusCache.data;
    try {
      const res = await fetchWithBackoff(`${PROXY}/market-status?exchange=US`);
      if (!res.ok) return null;
      const data = await res.json() as MarketStatus;
      statusCache = { data, ts: Date.now() };
      return data;
    } catch { return null; }
  },

  /* ── Subscribers ──────────────────────────────────────────────────── */

  /**
   * Subscribe to data updates for a set of symbols.
   * Returns an unsubscribe function.
   *
   * Callback fires immediately with cached data (if any), then again
   * whenever new data arrives for any of the subscribed symbols.
   */
  subscribe(symbols: string[], callback: StoreSubscriber): () => void {
    for (const sym of symbols) {
      if (!subscribers.has(sym)) subscribers.set(sym, new Set());
      subscribers.get(sym)!.add(callback);

      // Fire immediately with cached data so components render something
      const td = buildTickerData(sym);
      if (td) {
        // Defer to avoid calling setState during render
        setTimeout(() => callback(sym, td), 0);
      }
    }

    return () => {
      for (const sym of symbols) {
        subscribers.get(sym)?.delete(callback);
      }
    };
  },

  /* ── WebSocket ────────────────────────────────────────────────────── */

  /**
   * Initialise the store's WebSocket connection.
   * Must be called with the API token before any wsSubscribe calls.
   * Safe to call multiple times (idempotent).
   */
  wsInit(token: string): void {
    (globalThis as any).__FINNHUB_TOKEN__ = token;
    if (!wsSocket && !wsStopped) {
      setTimeout(() => wsConnect(0), 600);
    }
  },

  /** Increment ref-count for symbol; sends WS subscribe if first consumer. */
  wsSubscribe(symbols: string[]): void {
    for (const sym of symbols) {
      const count = wsRefCount.get(sym) ?? 0;
      wsRefCount.set(sym, count + 1);
      if (count === 0 && wsSocket?.readyState === WebSocket.OPEN) {
        try { wsSocket.send(JSON.stringify({ type: "subscribe", symbol: sym })); } catch { /* ignore */ }
      }
    }
  },

  /** Decrement ref-count for symbol; sends WS unsubscribe if last consumer. */
  wsUnsubscribe(symbols: string[]): void {
    for (const sym of symbols) {
      const count = wsRefCount.get(sym) ?? 0;
      if (count <= 1) {
        wsRefCount.delete(sym);
        if (wsSocket?.readyState === WebSocket.OPEN) {
          try { wsSocket.send(JSON.stringify({ type: "unsubscribe", symbol: sym })); } catch { /* ignore */ }
        }
      } else {
        wsRefCount.set(sym, count - 1);
      }
    }
  },

  /** Subscribe to WebSocket connection state changes. */
  onWsState(cb: WsStateCallback): () => void {
    wsStateSubscribers.add(cb);
    return () => wsStateSubscribers.delete(cb);
  },

  get wsConnected(): boolean {
    return wsSocket?.readyState === WebSocket.OPEN;
  },
};
