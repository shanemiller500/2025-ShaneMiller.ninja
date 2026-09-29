import { record } from "./normalize";

// One place for the OpenAI key, org and model so every Day Out AI call is configured the same way.
export function openAiReady() { return !!process.env.OPENAI_API_KEY?.trim(); }
export function openAiModel() { return process.env.OPENAI_DAY_OUT_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"; }
export async function chatJson(system: string, user: unknown, schemaName: string, schema: object, maxTokens: number, temperature = 0.2): Promise<Record<string, unknown> | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const org = process.env.OPENAI_ORG?.trim();
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(org ? { "OpenAI-Organization": org } : {}) },
      body: JSON.stringify({
        model: openAiModel(),
        // Reasoning models (o-series, gpt-5) reject a custom temperature.
        store: false, max_completion_tokens: maxTokens, ...(/^(o\d|gpt-5)/.test(openAiModel()) ? {} : { temperature }),
        messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(user) }],
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
      }),
    });
    if (!response.ok) return null;
    const body = record(await response.json());
    const content = record(record(Array.isArray(body.choices) ? body.choices[0] : null).message).content;
    return typeof content === "string" ? record(JSON.parse(content)) : null;
  } catch { return null; }
}
