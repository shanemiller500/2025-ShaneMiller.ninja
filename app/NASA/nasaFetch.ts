/* ------------------------------------------------------------------ */
/*  api.nasa.gov is flaky: the same request can return 200, 500 or a   */
/*  503 "upstream connect error". Retry transient failures with a      */
/*  short backoff + timeout before giving up.                          */
/* ------------------------------------------------------------------ */

export const NASA_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || "DEMO_KEY";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class NasaError extends Error {
  constructor(public status: number) {
    super(`NASA ${status}`);
  }
}

/** GET a NASA API path (e.g. "DONKI/FLR") as JSON, retrying hiccups. */
export function nasaGet<T = unknown>(path: string, params: Record<string, string> = {}, opts?: { tries?: number; timeoutMs?: number }): Promise<T> {
  return getJson<T>(`https://api.nasa.gov/${path}?${new URLSearchParams({ api_key: NASA_KEY, ...params })}`, opts);
}

/** GET any JSON URL, retrying transient failures with backoff + a timeout. */
export async function getJson<T = unknown>(url: string, { tries = 3, timeoutMs = 15000 } = {}): Promise<T> {
  let last: unknown = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (res.ok) return (await res.json()) as T;
      last = new NasaError(res.status);
      // a bad request won't get better by asking again
      if (!RETRYABLE.has(res.status)) break;
    } catch (e) {
      last = e; // network error or timeout: worth another go
    } finally {
      clearTimeout(timer);
    }
    if (attempt < tries - 1) await sleep(600 * 2 ** attempt + Math.random() * 300);
  }
  throw last instanceof Error ? last : new Error("NASA request failed");
}
