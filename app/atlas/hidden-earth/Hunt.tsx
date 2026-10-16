"use client";

import { useEffect, useMemo, useState } from "react";
import { Crosshair, RotateCcw, Trophy, X } from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { HudLabel, HudPanel } from "@/components/atlas/Hud";
import type { AtlasLayer, Picked } from "@/components/atlas/types";
import { lidarView } from "@/utils/geo/lidar";
import { kmBetween } from "@/utils/geo/strange";
import { LIDAR_VIEW_LAYERS, nationalReliefLayer } from "./layers";
import { SITES, SITE_KINDS, type HiddenSite } from "./sites";
import { huntScore } from "./huntScore";

/* ------------------------------------------------------------------ */
/*  Hunt: five rounds of "find it in the lidar". Each round drops you  */
/*  near a hidden site — not on it — on bare lidar with no labels. Tap */
/*  where you think the feature is; closer scores more (max 1,000).    */
/* ------------------------------------------------------------------ */

const ROUNDS = 5;
const BEST_KEY = "hidden-earth-hunt-best";


const huntLayer: AtlasLayer = {
  id: "hunt",
  label: "Hunt",
  group: "Hunt",
  citation: { label: "", href: "" },
  install(map) {
    map.addSource("hunt", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "hunt-line", type: "line", source: "hunt", filter: ["==", ["get", "role"], "line"], paint: { "line-color": "#fde047", "line-width": 2, "line-dasharray": [2, 1.5] } });
    map.addLayer({
      id: "hunt-answer-zone",
      type: "circle",
      source: "hunt",
      filter: ["==", ["get", "role"], "answer"],
      paint: { "circle-radius": 26, "circle-color": "#a3e635", "circle-opacity": 0.18, "circle-stroke-color": "#a3e635", "circle-stroke-width": 2.5 },
    });
    map.addLayer({
      id: "hunt-guess",
      type: "circle",
      source: "hunt",
      filter: ["==", ["get", "role"], "guess"],
      paint: { "circle-radius": 7, "circle-color": "#fde047", "circle-stroke-color": "#020617", "circle-stroke-width": 2 },
    });
    return ["hunt-line", "hunt-answer-zone", "hunt-guess"];
  },
};

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Start somewhere near the site — the feature lands off-centre, inside the view. */
function startCamera(s: HiddenSite): { center: [number, number]; zoom: number } {
  const zoom = Math.max(11, s.zoom - 0.9);
  const spanLng = (360 / 2 ** zoom) * (Math.min(window.innerWidth, 1200) / 512) * 0.32;
  const spanLat = spanLng * Math.cos((s.center[1] * Math.PI) / 180) * (window.innerHeight / Math.min(window.innerWidth, 1200));
  return { center: [s.center[0] + (Math.random() - 0.5) * spanLng, s.center[1] + (Math.random() - 0.5) * spanLat], zoom };
}

interface Result {
  site: HiddenSite;
  metres: number;
  score: number;
  guess: [number, number];
}

export function Hunt({ onExit, onCloud }: { onExit: () => void; onCloud?: (id: string) => void }) {
  const [deck, setDeck] = useState<HiddenSite[]>(() => shuffle(SITES).slice(0, ROUNDS));
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; nonce: number } | null>(null);
  const [initial] = useState(() => startCamera(deck[0]));
  const [best, setBest] = useState<number | null>(() => {
    try {
      const v = Number(window.localStorage.getItem(BEST_KEY));
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch {
      return null;
    }
  });
  const site = deck[Math.min(round, deck.length - 1)];
  const answered = results.length > round;
  const done = results.length === ROUNDS;
  const total = results.reduce((a, r) => a + r.score, 0);
  const last = answered ? results[round] : null;

  const view = lidarView(site.view);
  const layers = useMemo(() => [nationalReliefLayer, ...LIDAR_VIEW_LAYERS, huntLayer], []);
  const visible = useMemo(() => ({ "national-relief": true, hunt: true, ...Object.fromEntries(LIDAR_VIEW_LAYERS.map((l) => [l.id, l.id === `lidar-${view.key}`])) }), [view.key]);
  const data = useMemo(() => {
    if (!last) return { hunt: { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection };
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { role: "line" }, geometry: { type: "LineString", coordinates: [last.guess, last.site.center] } },
        { type: "Feature", properties: { role: "answer" }, geometry: { type: "Point", coordinates: last.site.center } },
        { type: "Feature", properties: { role: "guess" }, geometry: { type: "Point", coordinates: last.guess } },
      ],
    };
    return { hunt: fc };
  }, [last]);

  const guess = (p: Picked | null) => {
    if (!p || answered || done) return;
    const metres = kmBetween(p.lngLat, site.center) * 1000;
    const r: Result = { site, metres, score: huntScore(site, metres), guess: p.lngLat };
    setResults((rs) => [...rs, r]);
    // pull back so both the guess and the answer are in view
    setFlyTo({ center: [(p.lngLat[0] + site.center[0]) / 2, (p.lngLat[1] + site.center[1]) / 2], zoom: Math.min(site.zoom, Math.max(11, 15.5 - Math.log2(Math.max(metres, 80) / 60))), nonce: Date.now() });
  };

  const next = () => {
    const n = round + 1;
    if (n >= ROUNDS) return;
    setRound(n);
    setFlyTo({ ...startCamera(deck[n]), nonce: Date.now() });
  };

  useEffect(() => {
    if (!done) return;
    try {
      if (!best || total > best) {
        window.localStorage.setItem(BEST_KEY, String(total));
        setBest(total);
      }
    } catch {
      /* storage blocked — the score just isn't remembered */
    }
    // once, when the last round is scored
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const restart = () => {
    const d = shuffle(SITES).slice(0, ROUNDS);
    setDeck(d);
    setRound(0);
    setResults([]);
    setFlyTo({ ...startCamera(d[0]), nonce: Date.now() });
  };

  const kind = SITE_KINDS[site.kind];
  return (
    <div className="absolute inset-0 z-20 bg-[#020604]">
      <AtlasMap layers={layers} visible={visible} data={data} basemap="satellite" terrain="flat" dark onPick={guess} flyTo={flyTo} initialView={initial} className="absolute inset-0" />

      {/* ── the brief ─────────────────────────────────────────────── */}
      <HudPanel className="absolute left-3 top-[104px] z-30 w-[min(23rem,calc(100vw-1.5rem))] px-4 py-3 sm:left-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <HudLabel className="!text-amber-200/80">
              Hunt · round {Math.min(round + 1, ROUNDS)} of {ROUNDS} · {total.toLocaleString()} pts
            </HudLabel>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: kind.color }}>
              Find this {kind.label.toLowerCase()}
            </p>
            <p className="mt-0.5 font-mono text-base font-semibold uppercase tracking-[0.12em] text-white">{site.name}</p>
            <p className="text-[12px] text-slate-400">{site.where}</p>
          </div>
          <button type="button" onClick={onExit} aria-label="Quit the hunt" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        {!answered && (
          <p className="mt-2 flex gap-2 text-[12.5px] leading-snug text-slate-200">
            <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>
              {site.look} <span className="text-slate-400">Pan and zoom, then tap where you think it is.</span>
            </span>
          </p>
        )}
        {last && (
          <div className="mt-3 space-y-2">
            <p className="font-mono text-2xl font-semibold tabular-nums text-white">
              +{last.score.toLocaleString()}
              <span className="ml-2 text-[12px] font-normal text-slate-400">{last.metres < 1000 ? `${Math.round(last.metres)} m` : `${(last.metres / 1000).toFixed(1)} km`} away</span>
            </p>
            <p className="text-[12.5px] leading-snug text-slate-300">
              {site.facts[0].text}{" "}
              <a href={site.facts[0].source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-lime-300/70 hover:text-lime-200">
                ↗ {site.facts[0].source.label}
              </a>
            </p>
            <div className="flex flex-wrap gap-2">
              {!done && (
                <button type="button" onClick={next} className="rounded-xl border border-amber-300/50 bg-amber-400/15 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-amber-100 hover:bg-amber-400/25">
                  Next site →
                </button>
              )}
              {onCloud && (
                <button type="button" onClick={() => onCloud(site.id)} className="rounded-xl border border-white/15 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-200 hover:text-white">
                  See its laser points
                </button>
              )}
            </div>
          </div>
        )}
        <p className="mt-3 text-[10px] text-slate-500">
          {view.label} lidar view · USGS 3DEP. The green ring is the site.
        </p>
      </HudPanel>

      {/* ── final score ───────────────────────────────────────────── */}
      {done && (
        <HudPanel className="absolute inset-x-3 bottom-3 z-30 mx-auto max-w-md px-5 py-4 text-center">
          <Trophy className="mx-auto h-6 w-6 text-amber-300" />
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-white">{total.toLocaleString()}</p>
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            of {(ROUNDS * 1000).toLocaleString()} · {total >= 4000 ? "Lidar analyst" : total >= 2500 ? "Field archaeologist" : total >= 1000 ? "Keen eye" : "Keep looking"}
            {best != null ? ` · best ${best.toLocaleString()}` : ""}
          </p>
          <ul className="mt-3 space-y-1 text-left text-[12px]">
            {results.map((r) => (
              <li key={r.site.id} className="flex justify-between gap-3 text-slate-300">
                <span className="truncate">{r.site.name}</span>
                <span className="font-mono tabular-nums text-slate-100">+{r.score}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={restart} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-400/15 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-amber-100 hover:bg-amber-400/25">
            <RotateCcw className="h-3.5 w-3.5" /> Hunt again
          </button>
        </HudPanel>
      )}
    </div>
  );
}
