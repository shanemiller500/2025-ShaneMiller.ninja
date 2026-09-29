import { clientIp, rateLimited } from "@/app/api/charles/shared";
import { getDayData } from "@/app/day-out/lib/service";
import { chooseIdea } from "@/app/day-out/lib/concierge";
import { recommend, surpriseCandidates } from "@/app/day-out/lib/recommendations";
import { record } from "@/app/day-out/lib/normalize";
import type { Activity } from "@/app/day-out/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;
const FITS: Record<string, (activity: Activity) => boolean> = {
  "Anything good": activity => activity.kind !== "event" || ["Music", "War", "Motorsport"].includes(activity.category),
  "A motorbike ride": activity => activity.kind === "ride",
  "War history": activity => activity.category === "War",
  "Live music": activity => activity.category === "Music",
  "Camping trip": activity => activity.category === "Camping",
};
export async function POST(request: Request) {
  if (rateLimited(`day-out:${clientIp(request.headers)}`, 6)) return Response.json({ error: "Easy, tiger. Try again in a minute." }, { status: 429 });
  let preference: unknown;
  try { preference = record(await request.json()).preference; } catch { return Response.json({ error: "Choose an idea type." }, { status: 400 }); }
  if (typeof preference !== "string" || !Object.hasOwn(FITS, preference)) return Response.json({ error: "Choose an idea type." }, { status: 400 });
  const data = await getDayData();
  const ranked = recommend(data).filter(item => FITS[preference](item.activity));
  const candidates = surpriseCandidates(ranked);
  const choice = await chooseIdea(candidates, preference, data);
  const recommendation = candidates.find(item => item.activity.id === choice.id) || null;
  return Response.json({ recommendation, assisted: choice.assisted, pitch: choice.pitch, tips: choice.tips }, { headers: { "Cache-Control": "no-store" } });
}
