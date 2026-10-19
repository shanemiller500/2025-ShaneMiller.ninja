"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { Feature, Point } from "geojson";
import { fmtKm, kmBetween, nearest } from "@/utils/geo/near";
import { DEATH_COLORS, deathRank, deathsText, fmtNceiDate, type NceiQuakes, type NceiTsunamis } from "@/utils/geo/ncei";
import { depthColor, type QuakeFeature } from "@/utils/geo/quakes";
import type { VolcanoProps } from "@/utils/geo/volcanoes";

/* ------------------------------------------------------------------ */
/*  "Near me" for Earth Alive: what's shaking near you now, the        */
/*  nearest volcanoes, and the biggest earthquakes and tsunamis in     */
/*  NOAA's records around you — anywhere on Earth.                     */
/* ------------------------------------------------------------------ */

export const NEAR_KM = 500;
export const TSUNAMI_KM = 1000;

/** Row indexes of NOAA events within `km` of `at`, biggest first by `size`. */
export function biggestNear(lng: number[], lat: number[], at: [number, number], km: number, size: (i: number) => number, n: number) {
  const out: { i: number; km: number }[] = [];
  const latBox = km / 111 + 0.1;
  for (let i = 0; i < lng.length; i++) {
    if (Math.abs(lat[i] - at[1]) > latBox) continue;
    const d = kmBetween(at, [lng[i], lat[i]]);
    if (d <= km) out.push({ i, km: d });
  }
  return out.sort((a, b) => size(b.i) - size(a.i) || a.km - b.km).slice(0, n);
}

const row = "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]";
const head = "px-2 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400";

export function NearPanel({
  me,
  quakes,
  volcanoes,
  ncei,
  onQuake,
  onVolcano,
  onHistory,
  onTsunami,
}: {
  me: [number, number];
  quakes: QuakeFeature[];
  volcanoes: Feature<Point, VolcanoProps>[];
  ncei: { quakes?: NceiQuakes; tsunamis?: NceiTsunamis };
  onQuake: (q: QuakeFeature) => void;
  onVolcano: (v: Feature<Point, VolcanoProps>) => void;
  onHistory: (i: number) => void;
  onTsunami: (i: number) => void;
}) {
  const live = useMemo(() => nearest(quakes, me, (q) => q.geometry.coordinates as [number, number], 8, NEAR_KM), [quakes, me]);
  const volc = useMemo(() => nearest(volcanoes, me, (v) => v.geometry.coordinates as [number, number], 6), [volcanoes, me]);
  const hist = useMemo(() => {
    const q = ncei.quakes;
    return q ? biggestNear(q.cols.lng, q.cols.lat, me, NEAR_KM, (i) => q.cols.mag[i] ?? 0, 8) : null;
  }, [ncei.quakes, me]);
  const tsu = useMemo(() => {
    const t = ncei.tsunamis;
    return t ? biggestNear(t.cols.lng, t.cols.lat, me, TSUNAMI_KM, (i) => t.cols.height[i] ?? 0, 5) : null;
  }, [ncei.tsunamis, me]);

  return (
    <ul className="space-y-0.5">
      <li className={head}>Shaking within {NEAR_KM} km · on the map now</li>
      {live.map(({ item: q, km }) => (
        <li key={q.properties.id}>
          <button type="button" onClick={() => onQuake(q)} className={row}>
            <span className="w-11 shrink-0 font-mono text-sm font-bold" style={{ color: depthColor(q.properties.depth) }}>
              M{q.properties.mag.toFixed(1)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-100">{q.properties.place}</span>
            <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtKm(km)}</span>
          </button>
        </li>
      ))}
      {!live.length && <li className="px-2 py-1 text-[12px] text-slate-500">None in the current window — try 7D or 30D.</li>}

      <li className={head}>Nearest volcanoes</li>
      {volc.map(({ item: v, km }) => (
        <li key={v.properties.vnum}>
          <button type="button" onClick={() => onVolcano(v)} className={row}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${v.properties.erupting ? "bg-orange-500 shadow-[0_0_8px_#f97316]" : "bg-slate-500"}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-slate-100">{v.properties.name}</span>
              <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {v.properties.erupting ? "erupting now" : v.properties.country}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtKm(km)}</span>
          </button>
        </li>
      ))}
      {!volcanoes.length && <li className="px-2 py-1 text-[12px] text-slate-500">Loading volcanoes…</li>}

      <li className={head}>Biggest earthquakes in history within {NEAR_KM} km</li>
      {hist == null && (
        <li className="flex items-center gap-2 px-2 py-1 text-[12px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading NOAA&rsquo;s records…
        </li>
      )}
      {hist?.map(({ i, km }) => {
        const c = ncei.quakes!.cols;
        const deaths = deathsText(c.deaths[i], c.deathsAmt[i], ncei.quakes!.amount);
        return (
          <li key={c.id[i]}>
            <button type="button" onClick={() => onHistory(i)} className={row}>
              <span className="w-11 shrink-0 font-mono text-sm font-bold" style={{ color: DEATH_COLORS[deathRank(c.deaths[i], c.deathsAmt[i])] }}>
                {c.mag[i] != null ? `M${c.mag[i]}` : "M?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-slate-100">{c.place[i]}</span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {fmtNceiDate(c.date[i])}
                  {deaths && deaths !== "None" ? ` · ${deaths} deaths` : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtKm(km)}</span>
            </button>
          </li>
        );
      })}
      {hist && !hist.length && <li className="px-2 py-1 text-[12px] text-slate-500">None in NOAA&rsquo;s significant-earthquake list.</li>}

      <li className={head}>Tsunamis that began within {TSUNAMI_KM.toLocaleString("en-US")} km</li>
      {tsu?.map(({ i, km }) => {
        const c = ncei.tsunamis!.cols;
        return (
          <li key={c.id[i]}>
            <button type="button" onClick={() => onTsunami(i)} className={row}>
              <span className="w-11 shrink-0 font-mono text-[12px] font-bold text-sky-300">{c.height[i] != null ? `${c.height[i]} m` : "—"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-slate-100">{c.place[i] || "Tsunami"}</span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">{fmtNceiDate(c.date[i])}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtKm(km)}</span>
            </button>
          </li>
        );
      })}
      {tsu && !tsu.length && <li className="px-2 py-1 text-[12px] text-slate-500">None in NOAA&rsquo;s tsunami list.</li>}
      <li className="px-2 pt-3 text-[11px] leading-snug text-slate-500">Your location is only used to sort these lists — it isn&rsquo;t stored or sent anywhere.</li>
    </ul>
  );
}
