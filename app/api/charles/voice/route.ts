import { NextRequest, NextResponse } from "next/server";
import { clientIp, openAiKey, rateLimited } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_TEXT = 300;

const VOICE_INSTRUCTIONS =
  "Voice: a male with a broad, natural Australian accent, like a laid-back bloke from regional Queensland. " +
  "Tone: dry, deadpan, sassy and warm, with relaxed Aussie vowels and easygoing rhythm. " +
  "Delivery: unhurried, understated comic timing, a little smug. Get briefly, genuinely excited when food is mentioned, then back to deadpan. " +
  "Character: Charles, a black Lab and Chow mix who thinks he runs the place.";

/** Text-to-speech for one spoken segment of Charles's reply. Returns audio/mpeg. */
export async function POST(req: NextRequest) {
  const key = openAiKey();
  if (!key) {
    return NextResponse.json({ error: "Voice is offline (no OPENAI_API_KEY)." }, { status: 503 });
  }

  // A reply is split into a few segments around barks, so allow more voice calls than chat calls.
  if (rateLimited(`voice:${clientIp(req.headers)}`, 60)) {
    return NextResponse.json({ error: "Too many barks. Slow down." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
  if (!text) {
    return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CHARLES_TTS_MODEL?.trim() || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_CHARLES_VOICE?.trim() || "ash",
        speed: 1.0,
        input: text,
        instructions: VOICE_INSTRUCTIONS,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error("[charles] OpenAI TTS error", upstream.status, detail);
      return NextResponse.json({ error: "Charles lost his voice." }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[charles] TTS failed", err);
    return NextResponse.json({ error: "Charles lost his voice." }, { status: 502 });
  }
}
