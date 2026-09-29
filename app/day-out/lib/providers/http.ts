import { unstable_cache } from "next/cache";

// Cache the fetch timestamp with the payload. A cache hit must not look newly fetched.
export async function fetchSource(url: string, seconds: number, format: "json" | "text" = "json") {
  return unstable_cache(async () => {
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: format === "json" ? "application/json" : "application/rss+xml, application/xml, text/xml" } });
    if (!response.ok) throw new Error("Source unavailable");
    const body = await response.text();
    if (body.length > 8_000_000) throw new Error("Source too large");
    return { body: format === "json" ? JSON.parse(body) as unknown : body, fetchedAt: new Date().toISOString() };
  }, ["day-out-source-v1", url, format], { revalidate: seconds })();
}
