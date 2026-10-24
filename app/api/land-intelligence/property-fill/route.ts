import { NextRequest, NextResponse } from "next/server";
import { aiModel, aiReady, askOpenAIJson, clientIp, fetchPageText, overAiLimit, reachableUrls } from "@/app/land-intelligence/ai";
import { fieldMapFor, findCountyRecord, readRecord } from "@/app/land-intelligence/county-record";
import { PARCEL_KEY, queryParcelDetail } from "@/app/land-intelligence/parcel-detail";
import { PROPERTY_FILL_SCHEMA, PROPERTY_FILL_SYSTEM, missingFields, propertyFillPrompt, sanitizePropertyFill, valueOnPage, type FillKey, type PropertyFill } from "@/app/land-intelligence/property-fill";
import { jurisdictionAt, validPoint } from "@/app/land-intelligence/zoning-lookup";

export const runtime = "nodejs";
export const maxDuration = 60;

// Same parcel, same answer: results (including "nothing found") are kept for a week.
const fillCache = new Map<string, { expires: number; result: PropertyFill }>();
type Fields = PropertyFill["fields"];

/** Step 1: the county's own GIS parcel record at the tapped point (official values; the AI only maps field names). */
async function fromCountyRecord(lng: number, lat: number, detail: NonNullable<Awaited<ReturnType<typeof queryParcelDetail>>>, wanted: FillKey[]) {
  const jurisdiction = await jurisdictionAt(lng, lat);
  if (!jurisdiction) return null;
  const record = await findCountyRecord({ lng, lat, county: jurisdiction.county, state: jurisdiction.state, parcelId: detail.parcel.id, address: detail.parcel.address });
  if (!record) return null;
  const map = await fieldMapFor(record);
  return { fields: readRecord(record, map, wanted), layer: { name: record.layer.name, url: record.layer.url } };
}

/** Step 2: AI web search for whatever the county record didn't have. A value counts only if its cited page shows it. */
async function fromWebSearch(detail: NonNullable<Awaited<ReturnType<typeof queryParcelDetail>>>, wanted: FillKey[]) {
  const found = sanitizePropertyFill(await askOpenAIJson({
    system: PROPERTY_FILL_SYSTEM, user: propertyFillPrompt(detail, wanted), schemaName: "property_fill", schema: PROPERTY_FILL_SCHEMA,
    region: detail.parcel.state, contextSize: "medium", maxTokens: 1500, timeoutMs: 50000, deterministic: true,
  }), wanted);
  const entries = Object.entries(found.fields) as [FillKey, NonNullable<Fields[FillKey]>][];
  const urls = Array.from(new Set(entries.map(([, item]) => item.sourceUrl.split("#")[0]))).slice(0, 6);
  const pages = new Map(await Promise.all(urls.map(async (url) => [url, await fetchPageText(url)] as const)));
  const fields = Object.fromEntries(entries.filter(([field, item]) => {
    const page = pages.get(item.sourceUrl.split("#")[0]);
    return page ? valueOnPage(field, item.value, page) : false;
  })) as Fields;
  const live = found.recordUrl ? await reachableUrls([found.recordUrl]) : () => false;
  return { fields, recordUrl: found.recordUrl && live(found.recordUrl) ? found.recordUrl : "" };
}

export async function POST(request: NextRequest) {
  let body: { key?: unknown; lng?: unknown; lat?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A parcel selection is required." }, { status: 400 }); }
  const key = typeof body.key === "string" ? body.key : "";
  if (!PARCEL_KEY.test(key)) return NextResponse.json({ error: "A valid parcel selection is required." }, { status: 400 });
  if (!aiReady()) return NextResponse.json({ error: "The AI lookup is not configured." }, { status: 503 });
  const cached = fillCache.get(key);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.result);

  // The prompts are built from the source record fetched here, never from browser text. The point only places a spatial query.
  let detail;
  try { detail = await queryParcelDetail(key); } catch { return NextResponse.json({ error: "The public parcel record did not respond. Try again shortly." }, { status: 503 }); }
  if (!detail) return NextResponse.json({ error: "This parcel record was not found in the public source." }, { status: 404 });
  const wanted = missingFields(detail);
  const base = { checkedAt: new Date().toISOString(), model: aiModel(), note: "County values come straight from the county's GIS parcel record. Web values were found by AI search and confirmed on the linked page. Verify with the county before relying on them." };
  if (!wanted.length) return NextResponse.json({ ...base, fields: {}, notFound: [], recordUrl: "" } satisfies PropertyFill);

  if (overAiLimit(clientIp(request.headers))) return NextResponse.json({ error: "Too many AI lookups right now. Try again in a few minutes." }, { status: 429 });

  const county = validPoint(body.lng, body.lat) ? await fromCountyRecord(body.lng, body.lat as number, detail, wanted).catch(() => null) : null;
  const remaining = wanted.filter((field) => !county?.fields[field]);
  const web = remaining.length && (detail.parcel.address || detail.parcel.id) ? await fromWebSearch(detail, remaining).catch(() => null) : null;
  if (!county && !web && remaining.length) return NextResponse.json({ error: "The lookup did not respond. Try again shortly." }, { status: 503 });

  const fields: Fields = { ...web?.fields, ...county?.fields };
  const result: PropertyFill = { ...base, fields, notFound: wanted.filter((field) => !fields[field]), recordUrl: web?.recordUrl ?? "", ...(county ? { countyLayer: county.layer } : {}) };
  if (fillCache.size >= 500) fillCache.delete(fillCache.keys().next().value!);
  fillCache.set(key, { expires: Date.now() + 7 * 24 * 60 * 60 * 1000, result });
  return NextResponse.json(result);
}
