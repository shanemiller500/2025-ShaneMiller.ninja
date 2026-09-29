import { getDayData } from "@/app/day-out/lib/service";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET() {
  return Response.json(await getDayData(), { headers: { "Cache-Control": "no-store" } });
}
