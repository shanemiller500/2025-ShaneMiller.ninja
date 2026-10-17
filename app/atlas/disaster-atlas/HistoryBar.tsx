"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { HudPanel, HudSwitch } from "@/components/atlas/Hud";
import type { Picked } from "@/components/atlas/types";
import {
  HISTORY_RANGES,
  NOTABLE,
  declarationFeatures,
  BASIN_OPTIONS,
  basinGroup,
  filterStorms,
  type BasinFilter,
  hurricaneFeatures,
  ktToMph,
  landfallFeatures,
  loadDeclarations,
  loadFireYear,
  loadHurricanes,
  loadTornadoes,
  tornadoFeatures,
  tornadoStats,
  type CountyDeclarations,
  type HistoryHazard,
  type HurdatStorm,
  type TornadoCols,
} from "./history";
import { loadNri } from "./Details";

/* ------------------------------------------------------------------ */
/*  History mode: pick a hazard, step or play through the years, and   */
/*  the map redraws from the archives.                                 */
/* ------------------------------------------------------------------ */

type FC = GeoJSON.FeatureCollection;
const EMPTY: FC = { type: "FeatureCollection", features: [] };

export interface HistoryArchives {
  storms: HurdatStorm[] | null;
  tornadoes: TornadoCols | null;
  declarations: Record<string, CountyDeclarations> | null;
}

export const DECL_TYPES = [
  "Hurricane",
  "Flood",
  "Severe Storm",
  "Fire",
  "Tornado",
  "Snowstorm",
  "Severe Ice Storm",
  "Biological",
  "Earthquake",
  "Drought",
];

export function useHistory(active: boolean) {
  const [hazard, setHazard] = useState<HistoryHazard>("hurricanes");
  const [years, setYears] = useState<Record<string, number>>({
    hurricanes: 2005,
    tornadoes: 2011,
    fires: 2020,
  });
  const [allYears, setAllYears] = useState(false);
  const [minCat, setMinCat] = useState(0);
  const [minMag, setMinMag] = useState(0);
  const [minAcres, setMinAcres] = useState(5000);
  const [basin, setBasin] = useState<BasinFilter>("all");
  const [declType, setDeclType] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [archives, setArchives] = useState<HistoryArchives>({
    storms: null,
    tornadoes: null,
    declarations: null,
  });
  const [counties, setCounties] = useState<FC | null>(null);
  const [fires, setFires] = useState<{ key: string; fc: FC } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const year = years[hazard] ?? 2020;
  const setYear = (y: number) => setYears((cur) => ({ ...cur, [hazard]: y }));
  const setYearFor = (hz: HistoryHazard, y: number) => setYears((cur) => ({ ...cur, [hz]: y }));

  /* load whichever archive the chosen hazard needs, once */
  useEffect(() => {
    if (!active) return;
    let live = true;
    const run = async () => {
      setError(null);
      try {
        if (hazard === "hurricanes" && !archives.storms) {
          setLoading("Loading 175 years of hurricane tracks…");
          const storms = await loadHurricanes();
          if (live) setArchives((a) => ({ ...a, storms }));
        } else if (hazard === "tornadoes" && !archives.tornadoes) {
          setLoading("Loading every tornado since 1950…");
          const tornadoes = await loadTornadoes();
          if (live) setArchives((a) => ({ ...a, tornadoes }));
        } else if (
          hazard === "declarations" &&
          (!archives.declarations || !counties)
        ) {
          setLoading("Loading FEMA declarations…");
          const [d, c] = await Promise.all([loadDeclarations(), loadNri()]);
          if (live) {
            setArchives((a) => ({ ...a, declarations: d.counties }));
            setCounties(c);
          }
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setLoading(null);
      }
    };
    void run();
    return () => {
      live = false;
    };
  }, [
    active,
    hazard,
    archives.storms,
    archives.tornadoes,
    archives.declarations,
    counties,
  ]);

  /* past fire perimeters are queried live, per year */
  const fireKey = `${year}:${minAcres}`;
  useEffect(() => {
    if (!active || hazard !== "fires" || fires?.key === fireKey) return;
    const ctl = new AbortController();
    setLoading(`Loading ${year} fire perimeters…`);
    setError(null);
    loadFireYear(year, minAcres, ctl.signal)
      .then((fc) => setFires({ key: fireKey, fc }))
      .catch((e) => !ctl.signal.aborted && setError((e as Error).message))
      .finally(() => !ctl.signal.aborted && setLoading(null));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hazard, fireKey]);

  /* play: one year at a time */
  const range = hazard === "declarations" ? null : HISTORY_RANGES[hazard];
  useEffect(() => {
    if (!playing || !range || allYears) return;
    if (year >= range[1]) {
      setPlaying(false);
      return;
    }
    // fires wait for each year's download
    if (hazard === "fires" && loading) return;
    const t = setTimeout(
      () => setYear(year + 1),
      hazard === "fires" ? 1800 : 1300,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, year, hazard, allYears, loading]);
  useEffect(() => setPlaying(false), [hazard]);

  /* map data */
  const yr: number | "all" = allYears ? "all" : year;
  const shownStorms = useMemo(
    () =>
      archives.storms
        ? filterStorms(archives.storms, { year: yr, minCat, basin })
        : [],
    [archives.storms, yr, minCat, basin],
  );
  const data = useMemo(() => {
    const out: Record<string, FC> = {
      "hist-hu": EMPTY,
      "hist-hu-labels": EMPTY,
      "hist-hu-landfalls": EMPTY,
      "hist-tor": EMPTY,
      "hist-fires": EMPTY,
      declarations: EMPTY,
    };
    if (!active) return out;
    if (hazard === "hurricanes") {
      const { lines, labels } = hurricaneFeatures(shownStorms);
      out["hist-hu"] = lines;
      out["hist-hu-labels"] = labels;
      out["hist-hu-landfalls"] = landfallFeatures(shownStorms);
    } else if (hazard === "tornadoes" && archives.tornadoes)
      out["hist-tor"] = tornadoFeatures(archives.tornadoes, {
        year: yr,
        minMag,
      });
    else if (hazard === "fires" && fires) out["hist-fires"] = fires.fc;
    else if (hazard === "declarations" && counties && archives.declarations)
      out.declarations = declarationFeatures(
        counties,
        archives.declarations,
        declType,
      );
    return out;
  }, [
    active,
    hazard,
    shownStorms,
    archives.tornadoes,
    archives.declarations,
    counties,
    fires,
    yr,
    minMag,
    declType,
  ]);

  /* the one-line summary under the slider */
  const summary = useMemo(() => {
    if (hazard === "hurricanes") {
      const hu = shownStorms.filter((s) => s.cat >= 1).length;
      const major = shownStorms.filter((s) => s.cat >= 3).length;
      const top = [...shownStorms].sort((a, b) => b.maxWind - a.maxWind)[0];
      return `${shownStorms.length} storms · ${hu} hurricanes · ${major} major${top ? ` · strongest: ${top.name ?? "unnamed"} ${allYears ? top.year + " " : ""}(${ktToMph(top.maxWind)} mph)` : ""}`;
    }
    if (hazard === "tornadoes" && archives.tornadoes) {
      const s = tornadoStats(archives.tornadoes, { year: yr, minMag });
      return `${s.n.toLocaleString()} tornadoes · ${s.violent} rated (E)F4–5 · ${s.fat.toLocaleString()} deaths`;
    }
    if (hazard === "fires" && fires) {
      const acres = fires.fc.features.reduce(
        (a, f) => a + (f.properties?.acres ?? 0),
        0,
      );
      const top = fires.fc.features[0]?.properties;
      return `${fires.fc.features.length} fires over ${minAcres.toLocaleString()} acres · ${Math.round(acres).toLocaleString()} acres burned${top ? ` · largest: ${top.name} (${Number(top.acres).toLocaleString()} ac)` : ""}`;
    }
    if (hazard === "declarations" && archives.declarations) {
      const entries = Object.entries(archives.declarations).map(
        ([id, d]) => [id, declType ? (d.t[declType] ?? 0) : d.n] as const,
      );
      const total = entries.reduce((a, [, n]) => a + n, 0);
      const top = entries.sort((a, b) => b[1] - a[1])[0];
      const name =
        top &&
        counties?.features.find((f) => f.properties?.id === top[0])?.properties;
      return `${total.toLocaleString()} county declarations${declType ? ` for ${declType.toLowerCase()}` : ""} since 1953${name ? ` · most: ${name.name}, ${name.state} (${top[1]})` : ""}`;
    }
    return "";
  }, [
    hazard,
    shownStorms,
    archives.tornadoes,
    archives.declarations,
    counties,
    fires,
    yr,
    minMag,
    minAcres,
    declType,
    allYears,
  ]);

  return {
    hazard,
    setHazard,
    year,
    setYear,
    setYearFor,
    allYears,
    setAllYears,
    minCat,
    setMinCat,
    minMag,
    setMinMag,
    minAcres,
    setMinAcres,
    basin,
    setBasin,
    declType,
    setDeclType,
    playing,
    setPlaying,
    range,
    data,
    archives,
    summary,
    loading,
    error,
  };
}

export type HistoryState = ReturnType<typeof useHistory>;

export function HistoryBar({
  h,
  onPick,
  onGo,
}: {
  h: HistoryState;
  onPick: (p: Picked) => void;
  onGo: (center: [number, number], zoom: number) => void;
}) {
  const jumpStorm = (id: string) => {
    const s = h.archives.storms?.find((x) => x.id === id);
    if (!s) return;
    h.setAllYears(false);
    h.setMinCat(0);
    h.setBasin(basinGroup(s.basin));
    h.setYear(s.year);
    const peak = s.pts.reduce((a, p) => (p[3] > a[3] ? p : a), s.pts[0]);
    onPick({
      layer: "hist-hurricanes",
      props: { id: s.id },
      lngLat: [peak[2] / 10, peak[1] / 10],
    });
    onGo([peak[2] / 10, peak[1] / 10], 4.2);
  };
  const jumpTornado = (n: (typeof NOTABLE.tornadoes)[number]) => {
    const c = h.archives.tornadoes;
    if (!c) return;
    // several tornadoes can share a day, state and rating: take the deadliest
    let best = -1;
    for (let i = 0; i < c.yr.length; i++)
      if (
        c.yr[i] === n.year &&
        c.md[i] === n.md &&
        c.st[i] === n.st &&
        c.mag[i] === n.mag &&
        (best < 0 || c.fat[i] > c.fat[best])
      )
        best = i;
    if (best < 0) return;
    h.setAllYears(false);
    h.setMinMag(0);
    h.setYear(n.year);
    const at: [number, number] = [c.slon[best], c.slat[best]];
    onPick({
      layer: "hist-tornadoes",
      id: best,
      props: { i: best },
      lngLat: at,
    });
    onGo(at, 9.5);
  };

  const range = h.range;
  return (
    <HudPanel className="absolute inset-x-3 bottom-3 z-30 px-3 py-2.5 sm:left-4 md:right-[76px]">
      <div className="flex flex-wrap items-center gap-2">
        {/* scrolls sideways on phones instead of running off the edge */}
        <div className="no-scrollbar max-w-full overflow-x-auto">
          <HudSwitch
            id="hist-hazard"
            ariaLabel="Hazard"
            value={h.hazard}
            onChange={h.setHazard}
            className="!bg-transparent !p-0 !shadow-none !border-0"
            options={[
              { key: "hurricanes", label: "Hurricanes" },
              { key: "tornadoes", label: "Tornadoes" },
              { key: "fires", label: "Wildfires" },
              { key: "declarations", label: "FEMA declarations" },
            ]}
          />
        </div>
        <span className="hidden h-5 w-px bg-white/10 sm:block" />
        {h.hazard === "hurricanes" && (
          <>
            <Select
              label="Basin"
              value={h.basin}
              onChange={(v) => h.setBasin(v as BasinFilter)}
              options={BASIN_OPTIONS}
            />
            <Select
              label="At least"
              value={String(h.minCat)}
              onChange={(v) => h.setMinCat(Number(v))}
              options={[
                ["0", "Any storm"],
                ["1", "Category 1+"],
                ["3", "Major (3+)"],
                ["5", "Category 5"],
              ]}
            />
          </>
        )}
        {h.hazard === "tornadoes" && (
          <Select
            label="At least"
            value={String(h.minMag)}
            onChange={(v) => h.setMinMag(Number(v))}
            options={[
              ["0", "Any rating"],
              ["2", "(E)F2+"],
              ["3", "(E)F3+"],
              ["4", "(E)F4+ violent"],
              ["5", "(E)F5"],
            ]}
          />
        )}
        {h.hazard === "fires" && (
          <Select
            label="Larger than"
            value={String(h.minAcres)}
            onChange={(v) => h.setMinAcres(Number(v))}
            options={[
              ["1000", "1,000 ac"],
              ["5000", "5,000 ac"],
              ["25000", "25,000 ac"],
              ["100000", "100,000 ac"],
            ]}
          />
        )}
        {h.hazard === "declarations" && (
          <Select
            label="Type"
            value={h.declType ?? ""}
            onChange={(v) => h.setDeclType(v || null)}
            options={[
              ["", "All types"],
              ...DECL_TYPES.map((t) => [t, t] as [string, string]),
            ]}
          />
        )}
        {(h.hazard === "hurricanes" || h.hazard === "tornadoes") && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300">
            <input
              type="checkbox"
              checked={h.allYears}
              onChange={(e) => {
                h.setAllYears(e.target.checked);
                // every year at once needs a strength floor to stay readable
                if (
                  e.target.checked &&
                  h.hazard === "hurricanes" &&
                  h.minCat < 3
                )
                  h.setMinCat(3);
                if (
                  e.target.checked &&
                  h.hazard === "tornadoes" &&
                  h.minMag < 4
                )
                  h.setMinMag(4);
              }}
              className="accent-orange-500"
            />
            All years
          </label>
        )}
      </div>

      {range && !h.allYears && (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => h.setPlaying(!h.playing)}
            aria-label={h.playing ? "Pause" : "Play through the years"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-orange-300/40 bg-orange-400/15 text-orange-100"
          >
            {h.playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => h.setYear(Math.max(range[0], h.year - 1))}
            aria-label="Previous year"
            className="rounded-lg p-1 text-slate-400 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-12 shrink-0 text-center font-mono text-lg font-semibold tabular-nums text-white">
            {h.year}
          </span>
          <button
            type="button"
            onClick={() => h.setYear(Math.min(range[1], h.year + 1))}
            aria-label="Next year"
            className="rounded-lg p-1 text-slate-400 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={range[0]}
            max={range[1]}
            value={h.year}
            onChange={(e) => h.setYear(Number(e.target.value))}
            aria-label="Year"
            className="min-w-0 flex-1 accent-orange-500"
          />
          <span className="hidden font-mono text-[10px] text-slate-500 sm:inline">
            {range[0]}–{range[1]}
          </span>
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-300">
          {h.loading ? (
            <span className="animate-pulse text-orange-200/80">
              {h.loading}
            </span>
          ) : h.error ? (
            <span className="text-rose-300">Couldn&apos;t load: {h.error}</span>
          ) : (
            h.summary
          )}
        </p>
        {h.hazard === "hurricanes" && h.archives.storms && (
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {NOTABLE.hurricanes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => jumpStorm(n.id)}
                className="shrink-0 rounded-lg border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:text-white"
              >
                {n.label}
              </button>
            ))}
          </div>
        )}
        {h.hazard === "tornadoes" && h.archives.tornadoes && (
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {NOTABLE.tornadoes.map((n) => (
              <button
                key={n.label}
                type="button"
                onClick={() => jumpTornado(n)}
                className="shrink-0 rounded-lg border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:text-white"
              >
                {n.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </HudPanel>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] normal-case tracking-normal text-slate-100"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
