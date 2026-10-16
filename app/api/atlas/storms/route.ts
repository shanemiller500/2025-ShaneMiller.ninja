import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Active tropical cyclones (NHC) with their forecast cone, forecast  */
/*  track + points and past track, for the Disaster Atlas.             */
/*                                                                     */
/*  GET /api/atlas/storms                                              */
/*                                                                     */
/*  NHC's CurrentStorms.json has no CORS header, so it's proxied here; */
/*  the geometry comes from NOAA's NHC_tropical_weather map service,   */
/*  whose layers are named by the storm's "bin" (AT1, EP2, CP1 …).     */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const CURRENT = "https://www.nhc.noaa.gov/CurrentStorms.json";
const MAP = "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";
const REVALIDATE = 600;

interface NhcStorm {
  id: string;
  binNumber: string;
  name: string;
  classification: string;
  intensity: string;
  pressure: string;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir: number;
  movementSpeed: number;
  lastUpdate: string;
  publicAdvisory?: { advNum: string; url: string };
}

const CLASS: Record<string, string> = {
  HU: "Hurricane",
  TS: "Tropical Storm",
  TD: "Tropical Depression",
  STS: "Subtropical Storm",
  STD: "Subtropical Depression",
  PTC: "Potential Tropical Cyclone",
  PC: "Post-tropical Cyclone",
  TY: "Typhoon",
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.split("/").slice(-2).join("/")}`);
  return res.json() as Promise<T>;
}

/** Saffir–Simpson category from 1-minute sustained wind (knots). */
const category = (kt: number) => (kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0);

export async function GET() {
  try {
    const [{ activeStorms }, layers] = await Promise.all([
      getJson<{ activeStorms: NhcStorm[] }>(CURRENT),
      getJson<{ layers: { id: number; name: string }[] }>(`${MAP}?f=json`),
    ]);
    const layerId = (bin: string, what: string) => layers.layers.find((l) => l.name === `${bin} ${what}`)?.id;
    const query = async (id: number | undefined) => {
      if (id == null) return [] as GeoJSON.Feature[];
      try {
        const j = await getJson<GeoJSON.FeatureCollection>(`${MAP}/${id}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`);
        return j.features ?? [];
      } catch {
        return [];
      }
    };

    const storms = await Promise.all(
      (activeStorms ?? []).map(async (s) => {
        const [cone, track, points, past] = await Promise.all(["Forecast Cone", "Forecast Track", "Forecast Points", "Past Track"].map((w) => query(layerId(s.binNumber, w))));
        const kt = Number(s.intensity) || 0;
        const geom = (fs: GeoJSON.Feature[]) => fs.map((f) => ({ type: "Feature" as const, properties: { storm: s.id }, geometry: f.geometry }));
        return {
          id: s.id,
          bin: s.binNumber,
          name: s.name,
          kind: CLASS[s.classification] ?? s.classification,
          classification: s.classification,
          windKt: kt,
          windMph: Math.round(kt * 1.15078),
          category: s.classification === "HU" ? category(kt) : 0,
          pressureMb: Number(s.pressure) || null,
          center: [s.longitudeNumeric, s.latitudeNumeric] as [number, number],
          movement: { dir: s.movementDir, mph: Math.round(s.movementSpeed * 1.15078) },
          updated: s.lastUpdate,
          advisory: s.publicAdvisory ? { number: s.publicAdvisory.advNum, url: s.publicAdvisory.url } : null,
          cone: geom(cone),
          track: geom(track),
          past: geom(past),
          points: points.map((f) => {
            const p = (f.properties ?? {}) as Record<string, unknown>;
            return {
              type: "Feature" as const,
              properties: { storm: s.id, label: String(p.datelbl ?? ""), dev: String(p.dvlbl ?? ""), windKt: Number(p.maxwind) || null, tau: Number(p.tau) || 0 },
              geometry: f.geometry,
            };
          }),
        };
      })
    );
    return NextResponse.json({ updated: new Date().toISOString(), storms }, { headers: { "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=1800` } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, storms: [] }, { status: 502 });
  }
}
