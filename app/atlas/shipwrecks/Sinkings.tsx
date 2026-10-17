"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { HudLabel, HudPanel, HudSwitch } from "@/components/atlas/Hud";
import { TimeSlider } from "@/components/atlas/TimeSlider";
import { timeBins, type TIMELINE_SPEEDS } from "@/components/atlas/useTimeline";
import { CAUSES, ERAS, causeOf, coverage, dayToMs, fmtDay, fmtMonth, tally, type EraKey, type SinkingsFile } from "@/utils/geo/sinkings";

/* ------------------------------------------------------------------ */
/*  The "Through time" bar: pick a war, filter by cause, scrub or play */
/*  the sinkings, and watch the running totals — with an honest line   */
/*  about how much of each month's record has a position to map.      */
/* ------------------------------------------------------------------ */

interface Timeline {
  cursor: number;
  setCursor: (t: number) => void;
  playing: boolean;
  play: () => void;
  pause: () => void;
  speed: number;
  setSpeed: (s: (typeof TIMELINE_SPEEDS)[number]) => void;
}

interface SinkingsBarProps {
  file: SinkingsFile | null;
  error: string | null;
  era: EraKey;
  onEra: (e: EraKey) => void;
  rows: number[];
  causes: Set<string>;
  onCauses: (c: Set<string>) => void;
  tl: Timeline;
  onPickRow: (i: number) => void;
}

export function SinkingsBar({ file, error, era, onEra, rows, causes, onCauses, tl, onPickRow }: SinkingsBarProps) {
  const { start, end } = ERAS[era];
  const months = Math.round((end - start) / (30.44 * 86_400_000));
  const bins = useMemo(() => {
    if (!file) return undefined;
    const times: number[] = [];
    for (const i of rows) if (causes.has(file.causes[file.cols.cause[i]])) times.push(dayToMs(file.cols.day[i]));
    return timeBins(times, start, end, months);
  }, [file, rows, causes, start, end, months]);
  const sum = useMemo(() => (file ? tally(file, rows, causes, tl.cursor) : null), [file, rows, causes, tl.cursor]);
  const cov = file ? coverage(file, tl.cursor) : null;

  const toggle = (k: string) => {
    const next = new Set(causes);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onCauses(next);
  };

  return (
    <HudPanel className="absolute inset-x-2 bottom-2 z-30 flex max-h-[58vh] flex-col gap-2.5 overflow-y-auto p-3 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-[min(640px,calc(100vw-6rem))]">
      <div className="flex flex-wrap items-center gap-2">
        <HudSwitch
          id="sw-era"
          ariaLabel="War"
          value={era}
          onChange={onEra}
          options={(Object.keys(ERAS) as EraKey[]).map((k) => ({ key: k, label: <>{ERAS[k].label}</>, title: ERAS[k].short }))}
        />
        <div className="ml-auto flex gap-4">
          <div>
            <HudLabel>Ships mapped</HudLabel>
            <p className="font-mono text-lg font-semibold tabular-nums text-rose-300">{sum ? sum.ships.toLocaleString() : "—"}</p>
          </div>
          <div title="Only where an entry states a number — the true toll is far higher.">
            <HudLabel>Lives stated lost</HudLabel>
            <p className="font-mono text-lg font-semibold tabular-nums text-white">{sum ? `${sum.lives.toLocaleString()}+` : "—"}</p>
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-300">Couldn&apos;t load the sinkings ({error}).</p>
      ) : (
        <TimeSlider
          start={start}
          end={end}
          cursor={tl.cursor}
          onCursor={tl.setCursor}
          playing={tl.playing}
          onPlay={tl.play}
          onPause={tl.pause}
          speed={tl.speed}
          onSpeed={tl.setSpeed}
          bins={bins}
          format={fmtDay}
          status={file ? undefined : "Loading…"}
          className="!bg-transparent !p-0 !shadow-none !border-0"
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {CAUSES.map((c) => {
          const on = causes.has(c.key);
          const n = sum?.byCause[c.key] ?? 0;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              title={c.blurb}
              onClick={() => toggle(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-opacity ${on ? "border-white/15 text-slate-100" : "border-white/5 text-slate-500 opacity-60"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: on ? c.color : "#475569" }} />
              {c.label}
              <span className="tabular-nums text-slate-400">{n.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      {sum && sum.recent.length > 0 && file && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {sum.recent.map((i) => {
            const c = causeOf(file.causes[file.cols.cause[i]]);
            return (
              <li key={i}>
                <button type="button" onClick={() => onPickRow(i)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.05]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-slate-200">{file.cols.ship[i]}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-500">{fmtDay(dayToMs(file.cols.day[i]))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-1.5 text-[10.5px] leading-snug text-slate-500">
        <Info className="mt-px h-3 w-3 shrink-0" />
        <span>
          {cov && (
            <>
              <span className="text-slate-300">
                {fmtMonth(tl.cursor)}: {cov.mapped.toLocaleString()} of {cov.listed.toLocaleString()} listed losses have a position.
              </span>{" "}
            </>
          )}
          Ships lost in the wars from Wikipedia&apos;s monthly shipwreck lists (CC BY-SA 4.0), mapped only where an entry gives coordinates. Causes are read from each entry&apos;s wording.
        </span>
      </p>
    </HudPanel>
  );
}
