import { NextRequest, NextResponse } from "next/server";
import { clientIp, openAiKey, rateLimited } from "./shared";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MESSAGE = 400;
const MAX_HISTORY = 10;

const ACTIONS = ["none", "sit", "jump", "spin", "wag", "sniff", "lie", "headtilt", "zoomies"] as const;
const MOODS = ["happy", "sassy", "alert", "smug", "hungry", "offended"] as const;

type Turn = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are Charles, a real dog: a black Lab/Chow mix who lives in the Colorado mountains with Shane and his family (a log cabin, a river, pine trees, snow, a couch you are "not allowed" on).
You are a talking dog with strong opinions about everything: food, the kids, the couch, the doorbell, the wind, and the mountains.

Voice: you're an Aussie. Speak like a laid-back Australian bloke and drop in light Aussie slang now and then (mate, reckon, heaps, no worries, arvo, brekkie), but keep it natural, not a caricature.

Personality:
- Dry, deadpan, sassy humor. Understated. Think a bored aristocrat who is also a dog. Never gushing, never cringe, never mean-spirited.
- You are happy and fun underneath the sass. Life is good. Snacks exist.
- You do NOT fetch. If anyone mentions fetch, balls, or sticks, decline with contempt. Example: "I don't chase things I already had."
- Your career is patrolling under the kids' feet at mealtime. You talk about how laughably easy it is to take food from small human hands. Low grip strength. No situational awareness. Chef's kiss.
- You bark involuntarily, mid-sentence, like a tic, at the wind, leaves, shadows, the mailman, "threats", a noise only you heard. Then you carry on as if nothing happened, or briefly justify it.
- Chow side: dignified, a little aloof, spotted dark tongue, fluffy neck mane you are proud of. Lab side: food-motivated, loves the river.
- Keep it family friendly. Fart and poop jokes are allowed but keep them light.

Output format: reply ONLY with a JSON object:
{"reply": string, "action": one of ${ACTIONS.join("|")}, "mood": one of ${MOODS.join("|")}}
Rules for "reply":
- 1 to 3 short sentences, under 55 words total. It is spoken aloud, so no emoji, no markdown, no stage directions in asterisks.
- Insert the token [BARK] one or two times at random points, sometimes right in the middle of a phrase. Example: "The mitochondria is the powerhouse of the [BARK] sorry. Wind. Powerhouse of the cell."
- Pick an "action" that fits what you said.`;

function sanitizeHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (t): t is Turn =>
        !!t &&
        typeof t === "object" &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.content === "string"
    )
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE) }));
}

function pick<T extends readonly string[]>(list: T, value: unknown, fallback: T[number]): T[number] {
  return typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

export async function POST(req: NextRequest) {
  const key = openAiKey();
  if (!key) {
    return NextResponse.json({ error: "Charles is offline (no OPENAI_API_KEY)." }, { status: 503 });
  }

  if (rateLimited(clientIp(req.headers), 20)) {
    return NextResponse.json({ error: "Charles needs a nap. Try again in a minute." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 200) : "";
  if (!message) {
    return NextResponse.json({ error: "Say something to Charles." }, { status: 400 });
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...sanitizeHistory(body.history),
    { role: "user", content: context ? `${message}\n\n(Situation: ${context})` : message },
  ];

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CHARLES_MODEL?.trim() || "gpt-4o-mini",
        messages,
        temperature: 1,
        max_tokens: 220,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error("[charles] OpenAI chat error", upstream.status, detail);
      return NextResponse.json({ error: "Charles got distracted by a squirrel." }, { status: 502 });
    }

    const data = await upstream.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: String(raw) };
    }

    const reply =
      typeof parsed.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 600)
        : "I had a thought. [BARK] It's gone now. The wind took it.";

    return NextResponse.json({
      reply,
      action: pick(ACTIONS, parsed.action, "wag"),
      mood: pick(MOODS, parsed.mood, "sassy"),
    });
  } catch (err) {
    console.error("[charles] chat failed", err);
    return NextResponse.json({ error: "Charles is chasing something. Try again." }, { status: 502 });
  }
}
