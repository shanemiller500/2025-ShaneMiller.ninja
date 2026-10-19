"use client";

import { useEffect, useMemo } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { HudPanel } from "@/components/atlas/Hud";
import { perDecade, type DatedMines } from "@/utils/geo/mines";
import { MINE_SITES, type MineSite } from "./featured";

/* ------------------------------------------------------------------ */
/*  When it was mined: a decade slider over the mines whose records    */
/*  give a year (found, or first produced), a histogram of how many    */
/*  per decade, and markers for the gold rushes.                       */
/* ------------------------------------------------------------------ */

export const FROM = 1790;
export const TO = 2000;
const STEP_MS = 900;

export function YearBar({
  dated,
  total,
  year,
  onYear,
  playing,
  onPlay,
  groupsOn,
  onSite,
}: {
  dated: DatedMines | null;
  /** all MRDS records, to say how many have a year */
  total: number;
  year: number;
  onYear: (y: number) => void;
  playing: boolean;
  onPlay: (p: boolean) => void;
  groupsOn: Set<number>;
  onSite: (s: MineSite) => void;
}) {
  const bins = useMemo(() => (dated ? perDecade(dated, FROM, TO, groupsOn) : []), [dated, groupsOn]);
  const max = Math.max(1, ...bins);
  const decade = Math.floor(year / 10) * 10;
  const thisDecade = bins[Math.floor((Math.min(TO, Math.max(FROM, decade)) - FROM) / 10)] ?? 0;
  const upTo = bins.slice(0, Math.floor((Math.min(TO, decade) - FROM) / 10) + 1).reduce((a, b) => a + b, 0);
  const pct = (y: number) => ((y - FROM) / (TO + 10 - FROM)) * 100;
  const rushes = MINE_SITES.filter((s) => s.year != null).sort((a, b) => a.year! - b.year!);

  /* play: a decade at a time, stopping at the end */
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (decade >= TO) onPlay(false);
      else onYear(decade + 10);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, decade, onYear, onPlay]);

  return (
    <HudPanel className="pointer-events-auto w-full px-4 pb-3 pt-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => {
            if (!playing && decade >= TO) onYear(FROM);
            onPlay(!playing);
          }}
          disabled={!dated}
          aria-label={playing ? "Pause" : "Play through the decades"}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-amber-100 transition-colors hover:bg-amber-400/25 disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[19px] font-semibold leading-tight text-white">{decade <= FROM ? `By ${FROM + 9}` : `The ${decade}s`}</p>
          <p className="text-[12px] text-slate-300">
            {dated ? (
              <>
                <span className="font-semibold text-amber-200">{thisDecade.toLocaleString()}</span> mines found or first worked · {upTo.toLocaleString()} so far
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading the dated mines…
              </span>
            )}
          </p>
        </div>
      </div>

      {/* histogram + slider */}
      <div className="relative mt-3">
        <div className="flex h-10 items-end gap-px" aria-hidden>
          {bins.map((n, k) => {
            const d = FROM + k * 10;
            return <span key={d} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(2, (n / max) * 100)}%`, background: d === Math.min(TO, Math.max(FROM, decade)) ? "#fcd34d" : d <= decade ? "rgba(252,211,77,0.45)" : "rgba(255,255,255,0.12)" }} />;
          })}
        </div>
        {/* gold-rush markers on the axis */}
        <div className="relative h-5">
          {rushes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPlay(false);
                onYear(s.year!);
                onSite(s);
              }}
              title={`${s.name} — ${s.yearLabel ?? s.year}`}
              className="absolute top-0.5 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#0c0a09] transition-transform hover:scale-125"
              style={{ left: `${pct(s.year!) + 100 / ((TO + 10 - FROM) / 10) / 2}%`, background: s.accent }}
            />
          ))}
        </div>
        <input
          type="range"
          min={FROM}
          max={TO}
          step={10}
          value={Math.min(TO, Math.max(FROM, decade))}
          onChange={(e) => {
            onPlay(false);
            onYear(Number(e.target.value));
          }}
          aria-label="Decade"
          aria-valuetext={`the ${decade}s`}
          disabled={!dated}
          className="atlas-range atlas-range-amber absolute inset-x-0 bottom-3 h-12 w-full cursor-pointer"
        />
        <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500">
          <span>{FROM}s</span>
          <span>1850s</span>
          <span>1900s</span>
          <span>1950s</span>
          <span>{TO}s</span>
        </div>
      </div>

      <div className="mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rushes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              onPlay(false);
              onYear(s.year!);
              onSite(s);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-300 hover:text-white"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} />
            {s.name.split(",")[0].replace(/ & the Klondike trails/, " · Klondike")}
            <span className="text-slate-500">{s.yearLabel ?? s.year}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-slate-500">
        Only {dated ? `${dated.y.length.toLocaleString()} of ${total.toLocaleString()}` : "about one in twelve"} USGS mine records give a year they were found or first worked, so this shows when mining was recorded — not every mine ever dug.
      </p>
    </HudPanel>
  );
}
