import { parseUsminGml } from "./mines";

const WFS = "https://mrdata.usgs.gov/services/wfs/usmin";
const REVALIDATE = 7 * 86_400;
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };

async function layer(type: "points" | "polygons", [w, s, e, n]: [number, number, number, number], max: number, signal?: AbortSignal) {
  // WFS 1.1 with EPSG:4326 takes and returns latitude before longitude.
  const url = `${WFS}?service=WFS&version=1.1.0&request=GetFeature&typeName=${type}&BBOX=${s},${w},${n},${e},EPSG:4326&maxFeatures=${max}`;
  const res = await fetch(url, { headers: UA, next: { revalidate: REVALIDATE }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`USMIN ${type}: HTTP ${res.status}`);
  const xml = await res.text();
  if (/<(?:ServiceException|ExceptionReport|ExceptionText)\b/i.test(xml)) throw new Error(`USMIN ${type}: service rejected query`);
  return parseUsminGml(xml, type);
}

export async function queryUsmin(box: [number, number, number, number], limits = { points: 5000, polygons: 2000 }) {
  const [points, polygons] = await Promise.all([layer("points", box, limits.points), layer("polygons", box, limits.polygons)]);
  return { points, polygons, truncated: points.length >= limits.points || polygons.length >= limits.polygons };
}

export async function queryUsminPoints(box: [number, number, number, number], max = 500, signal?: AbortSignal) {
  const points = await layer("points", box, max, signal);
  return { points, truncated: points.length >= max };
}
