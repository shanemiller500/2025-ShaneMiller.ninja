import { NextResponse, type NextRequest } from "next/server";
import { MINES_NAMES_PATH, foldNames, searchNames, type NamesIndex } from "@/utils/geo/mines";

/* ------------------------------------------------------------------ */
/*  Mine-name search over every named site in MRDS and MSHA's register */
/*  (250,000+ names). The index is a static file too big to send to    */
/*  phones, so it's loaded here once per server instance and only the  */
/*  top matches go back.                                               */
/*                                                                     */
/*  GET /api/atlas/mines-search?q=homestake                            */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

let loaded: Promise<{ ix: NamesIndex; folded: string[] }> | null = null;

function load(origin: string) {
  if (!loaded) {
    // static files aren't bundled with server functions, so read our own public copy (too big for Next's fetch cache)
    loaded = fetch(new URL(MINES_NAMES_PATH, origin), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`names index: HTTP ${r.status}`))))
      .then((ix: NamesIndex) => ({ ix, folded: foldNames(ix) }));
    loaded.catch(() => (loaded = null));
  }
  return loaded;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (q.trim().length < 2) return NextResponse.json({ hits: [] });
  try {
    const { ix, folded } = await load(req.nextUrl.origin);
    return NextResponse.json({ hits: searchNames(ix, q, 40, folded) }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
