/* ------------------------------------------------------------------ */
/*  Shared helpers for the Charles (talking dog) API routes            */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** Tiny in-memory per-IP limiter. Good enough to stop casual abuse of the key. */
export function rateLimited(ip: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > maxPerMinute;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function openAiKey(): string | undefined {
  return process.env.OPENAI_API_KEY?.trim() || undefined;
}
