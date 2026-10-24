// Server-side helpers shared by the Land Intelligence AI routes (zoning code, property fill).
import { publicUrl } from "./zoning-code";

// Each uncached AI lookup is a paid web-search call: one budget per visitor and per instance across both features.
const visitorHits = new Map<string, number[]>();
const instanceHits: number[] = [];
const VISITOR_LIMIT = { count: 5, windowMs: 10 * 60 * 1000 };
const INSTANCE_LIMIT = { count: 60, windowMs: 60 * 60 * 1000 };

export function overAiLimit(ip: string) {
  const now = Date.now();
  const recent = (visitorHits.get(ip) ?? []).filter((time) => now - time < VISITOR_LIMIT.windowMs);
  while (instanceHits.length && now - instanceHits[0] >= INSTANCE_LIMIT.windowMs) instanceHits.shift();
  if (recent.length >= VISITOR_LIMIT.count || instanceHits.length >= INSTANCE_LIMIT.count) return true;
  recent.push(now); instanceHits.push(now);
  if (visitorHits.size > 5000) visitorHits.clear();
  visitorHits.set(ip, recent);
  return false;
}

export const clientIp = (headers: Headers) => headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
export const aiReady = () => Boolean(process.env.OPENAI_API_KEY?.trim());
export const aiModel = () => process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

/**
 * One Responses API call with a strict JSON schema, searching the web unless `webSearch` is false.
 * `deterministic` pins temperature to 0 where the model allows it.
 */
export async function askOpenAIJson({ system, user, schemaName, schema, region = "", city, contextSize = "medium", maxTokens = 1800, timeoutMs = 70000, deterministic = false, webSearch = true }: {
  system: string; user: string; schemaName: string; schema: object; region?: string; city?: string;
  contextSize?: "low" | "medium" | "high"; maxTokens?: number; timeoutMs?: number; deterministic?: boolean; webSearch?: boolean;
}): Promise<Record<string, unknown>> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const org = process.env.OPENAI_ORG?.trim();
  const model = aiModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(org ? { "OpenAI-Organization": org } : {}) },
    body: JSON.stringify({
      model, store: false, max_output_tokens: maxTokens,
      // Reasoning models (o-series, gpt-5) reject a custom temperature.
      ...(deterministic && !/^(o\d|gpt-5)/.test(model) ? { temperature: 0 } : {}),
      ...(webSearch ? { tools: [{ type: "web_search_preview", search_context_size: contextSize, user_location: { type: "approximate", country: "US", region, ...(city ? { city } : {}) } }] } : {}),
      input: [{ role: "system", content: system }, { role: "user", content: user }],
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const body = await response.json();
  const output: { type?: string; content?: { type?: string; text?: unknown }[] }[] = Array.isArray(body?.output) ? body.output : [];
  const answer = output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []).find((part) => part.type === "output_text")?.text;
  if (typeof answer !== "string") throw new Error("No output");
  return JSON.parse(answer) as Record<string, unknown>;
}

const ENTITIES: Record<string, string> = { amp: "&", nbsp: " ", lt: "<", gt: ">", quot: "\"", "#39": "'", "#36": "$" };

/**
 * Visible text of a public HTML or plain-text page, or null when it can't be read. Each redirect hop is re-checked
 * with publicUrl, so a model-chosen URL can't bounce the server to a private host. PDFs and scripts-only pages read as null/empty.
 */
export async function fetchPageText(url: string, hops = 2): Promise<string | null> {
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (compatible; LandIntelligence/1.0)", Accept: "text/html,text/plain" } });
    if (response.status >= 300 && response.status < 400) {
      response.body?.cancel().catch(() => {});
      const next = publicUrl(new URL(response.headers.get("location") ?? "", url).href);
      return next && hops > 0 ? fetchPageText(next, hops - 1) : null;
    }
    if (!response.ok || !/text\/(html|plain)/i.test(response.headers.get("content-type") ?? "")) { response.body?.cancel().catch(() => {}); return null; }
    const html = (await response.text()).slice(0, 1_500_000);
    return html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&(amp|nbsp|lt|gt|quot|#39|#36);/g, (_, name: string) => ENTITIES[name]).replace(/\s+/g, " ");
  } catch { return null; }
}

/** A checker for which URLs answer. Redirects are not followed, so a model-chosen URL can't bounce the server elsewhere. */
export async function reachableUrls(urls: string[]) {
  const unique = Array.from(new Set(urls.filter(Boolean).map((url) => url.split("#")[0]))).slice(0, 12);
  const alive = await Promise.all(unique.map(async (url) => {
    try {
      const response = await fetch(url, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "Mozilla/5.0 (compatible; LandIntelligence/1.0)" } });
      response.body?.cancel().catch(() => {});
      // 401/403/405/429 usually mean a bot wall in front of a live page, not a dead link.
      return response.status < 400 || [401, 403, 405, 429].includes(response.status);
    } catch { return false; }
  }));
  const live = new Set(unique.filter((_, index) => alive[index]));
  return (url: string) => live.has(url.split("#")[0]);
}
