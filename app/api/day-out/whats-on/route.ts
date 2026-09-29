import { getWhatsOn } from "@/app/day-out/lib/providers/whatsOn";
import { openAiReady } from "@/app/day-out/lib/openai";
import { brisbaneDay } from "@/app/day-out/lib/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

// Today's (and tomorrow's) events from a web search, cached per Queensland day.
export async function GET() {
  const day = brisbaneDay(new Date());
  if (!openAiReady()) return Response.json({ day, events: [], ok: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = await getWhatsOn();
    return Response.json({ ...result, ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Not cached server-side, and ok:false tells the browser not to store it either.
    return Response.json({ day, events: [], ok: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
