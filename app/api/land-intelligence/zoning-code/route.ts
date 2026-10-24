import { NextRequest, NextResponse } from "next/server";
import { aiModel, aiReady, askOpenAIJson, clientIp, overAiLimit, reachableUrls } from "@/app/land-intelligence/ai";
import { lookupZoning, validPoint } from "@/app/land-intelligence/zoning-lookup";
import { ZONING_CODE_SCHEMA, ZONING_CODE_SYSTEM, sanitizeZoningCode, zoningCodePrompt, type CodeLink, type ZoningCode } from "@/app/land-intelligence/zoning-code";

export const runtime = "nodejs";
export const maxDuration = 90;

const codeCache = new Map<string, { expires: number; result: ZoningCode }>();

export async function POST(request: NextRequest) {
  let body: { lng?: unknown; lat?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid map point." }, { status: 400 }); }
  const { lng, lat } = body;
  if (!validPoint(lng, lat)) return NextResponse.json({ error: "A U.S. map point is required." }, { status: 400 });
  if (!aiReady()) return NextResponse.json({ error: "The AI code lookup is not configured." }, { status: 503 });

  const zoning = await lookupZoning(lng, lat as number);
  const jurisdiction = zoning.jurisdiction;
  if (!jurisdiction) return NextResponse.json({ error: zoning.note }, { status: zoning.status === "outside" ? 422 : 503 });
  const district = zoning.district;
  const key = `${jurisdiction.authority}|${district?.code ?? ""}`.toLowerCase();
  const cached = codeCache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.result);

  if (overAiLimit(clientIp(request.headers))) return NextResponse.json({ error: "Too many AI lookups right now. Try again in a few minutes." }, { status: 429 });

  let found;
  try { found = sanitizeZoningCode(await askOpenAIJson({ system: ZONING_CODE_SYSTEM, user: zoningCodePrompt(jurisdiction, district), schemaName: "zoning_code", schema: ZONING_CODE_SCHEMA, region: jurisdiction.state, city: jurisdiction.city })); }
  catch { return NextResponse.json({ error: "The AI code lookup did not respond. Try again shortly." }, { status: 503 }); }

  const links = [found.code, found.districtSection, found.zoningMap].filter((link): link is CodeLink => Boolean(link));
  const live = await reachableUrls([...links.map((link) => link.url), ...found.standards.map((item) => item.sourceUrl), ...found.sources.map((link) => link.url)]);
  const keep = (link: CodeLink | null) => link && live(link.url) ? link : null;
  const [code, districtSection, zoningMap] = [keep(found.code), keep(found.districtSection), keep(found.zoningMap)];
  const sources = found.sources.filter((link) => live(link.url));
  const result: ZoningCode = {
    ...found, code, districtSection, zoningMap, sources,
    // A standard citing a dead page has nothing behind it.
    standards: found.standards.filter((item) => live(item.sourceUrl)),
    districtName: district ? found.districtName : "",
    status: code || districtSection ? "found" : sources.length ? "partial" : "none",
    checkedAt: new Date().toISOString(), model: aiModel(), jurisdiction, district,
    note: `AI-assisted web search, not legal advice. Links and standards can be out of date or wrong; confirm with ${jurisdiction.authority} before relying on them.`,
  };
  if (codeCache.size >= 300) codeCache.delete(codeCache.keys().next().value!);
  codeCache.set(key, { expires: Date.now() + 24 * 60 * 60 * 1000, result });
  return NextResponse.json(result);
}
