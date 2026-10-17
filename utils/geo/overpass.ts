/* ------------------------------------------------------------------ */
/*  Server-side Overpass (OpenStreetMap) query with mirror fallback.   */
/*  The public instances go down or rate-limit now and then, so each   */
/*  is tried in turn with its own timeout. Results are cached by the   */
/*  calling route (Next data cache) for `revalidate` seconds.          */
/* ------------------------------------------------------------------ */

const UA = "shanemiller.ninja atlas (+https://shanemiller.ninja)";

export const OVERPASS_MIRRORS = [
  { url: "https://overpass-api.de/api/interpreter", timeout: 15_000 },
  { url: "https://overpass.private.coffee/api/interpreter", timeout: 15_000 },
  {
    url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    timeout: 35_000,
  },
];

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function overpass(
  query: string,
  revalidate: number,
): Promise<OverpassElement[]> {
  const errors: string[] = [];
  // two rounds over the mirrors: busy instances often answer a moment later
  for (let round = 0; round < 2; round++) {
    if (round) await new Promise((r) => setTimeout(r, 1500));
    for (const m of OVERPASS_MIRRORS) {
      try {
        const res = await fetch(m.url, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(query)}`,
          next: { revalidate },
          signal: AbortSignal.timeout(m.timeout),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as {
          elements?: OverpassElement[];
          remark?: string;
        };
        // a runtime error comes back as 200 with a remark and no elements
        if (!j.elements) throw new Error(j.remark ?? "no elements");
        return j.elements;
      } catch (e) {
        errors.push(`${new URL(m.url).host}: ${(e as Error).message}`);
      }
    }
  }
  throw new Error(`Overpass unavailable (${errors.join("; ")})`);
}
