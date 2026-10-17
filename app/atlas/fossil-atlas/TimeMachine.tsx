"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { HudPanel } from "@/components/atlas/Hud";
import { PERIODS, periodEnd } from "@/utils/geo/fossils";
import { MOMENTS } from "./moments";
import { PALEO_INDEX_URL, fmtMa, nearestSlice, paleoDataUrl, paleoImageUrl, type PaleoIndex, type PaleoSlice, type PaleoSliceData } from "@/utils/geo/paleo";

/* ------------------------------------------------------------------ */
/*  The time machine: pick a moment between 540 million years ago and  */
/*  today; the map becomes Earth as it was then, with the fossil sites */
/*  from that time at their ancient positions.                         */
/* ------------------------------------------------------------------ */

const STEP_MS = 1100;

export function useTimeMachine(active: boolean, initialAge: number | null) {
  const [index, setIndex] = useState<PaleoIndex | null>(null);
  const [age, setAgeState] = useState<number>(initialAge ?? 90);
  const [sliceData, setSliceData] = useState<PaleoSliceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const cache = useRef(new Map<string, Promise<PaleoSliceData>>());

  /* the list of slices, the first time the machine is opened */
  useEffect(() => {
    if (!active || index) return;
    fetch(PALEO_INDEX_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((ix: PaleoIndex) => {
        setIndex(ix);
        setAgeState((a) => nearestSlice(ix.slices, a).age);
      })
      .catch((e) => setError((e as Error).message));
  }, [active, index]);

  const slice: PaleoSlice | null = index ? nearestSlice(index.slices, age) : null;
  const get = (s: PaleoSlice) => {
    let p = cache.current.get(s.file);
    if (!p) {
      p = fetch(paleoDataUrl(s.file)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
      cache.current.set(s.file, p);
      p.catch(() => cache.current.delete(s.file));
    }
    return p;
  };

  /* this slice's fossils + outline; warm up the next ones */
  useEffect(() => {
    if (!active || !slice || !index) return;
    let live = true;
    get(slice)
      .then((d) => live && setSliceData(d))
      .catch((e) => live && setError((e as Error).message));
    const at = index.slices.findIndex((s) => s.file === slice.file);
    for (const s of [index.slices[at - 1], index.slices[at - 2], index.slices[at + 1]]) {
      if (!s) continue;
      get(s).catch(() => {});
      const img = new Image();
      img.src = paleoImageUrl(s.file);
    }
    return () => {
      live = false;
    };
    // the slice's file identifies it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slice?.file, index]);

  /* play: step toward today */
  useEffect(() => {
    if (!playing || !index || !active) return;
    const t = setTimeout(() => {
      const at = index.slices.findIndex((s) => s.age === slice?.age);
      if (at <= 0) setPlaying(false);
      else setAgeState(index.slices[at - 1].age);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, index, active, slice?.age]);

  const setAge = (a: number) => {
    setPlaying(false);
    setAgeState(index ? nearestSlice(index.slices, a).age : a);
  };
  const play = () => {
    if (playing) return setPlaying(false);
    // from today, start at the beginning
    if (index && slice?.age === 0) setAgeState(index.slices[index.slices.length - 1].age);
    setPlaying(true);
  };
  // only show slice data that belongs to the current slice
  const current = sliceData && slice && sliceData.age === slice.age ? sliceData : null;
  return { index, slice, age: slice?.age ?? age, setAge, data: current, error, playing, play };
}

export function TimeBar({
  machine,
  shown,
  onStep,
}: {
  machine: ReturnType<typeof useTimeMachine>;
  /** fossil sites drawn for this slice */
  shown: number | null;
  onStep?: () => void;
}) {
  const { index, slice, setAge, playing, play, error, data } = machine;
  const max = index ? index.slices[index.slices.length - 1].age : 540;
  const pct = (ma: number) => ((max - ma) / max) * 100;
  const bands = useMemo(
    () =>
      PERIODS.map((p, i) => ({ ...p, from: Math.min(p.start, max), to: periodEnd(i) }))
        .filter((p) => p.to < max)
        .map((p) => ({ ...p, left: pct(p.from), width: pct(p.to) - pct(p.from) })),
    // pct only depends on max
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [max]
  );
  const moment = MOMENTS.find((m) => m.age === slice?.age);

  return (
    <HudPanel className="pointer-events-auto w-full px-4 pb-3 pt-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => {
            play();
            onStep?.();
          }}
          disabled={!index}
          aria-label={playing ? "Pause" : "Play through time"}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime-300/40 bg-lime-400/15 text-lime-100 transition-colors hover:bg-lime-400/25 disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {slice ? (
            <>
              <p className="font-mono text-[17px] font-semibold leading-tight text-white sm:text-[19px]">{fmtMa(slice.age)}</p>
              <p className="truncate text-[12px] text-slate-300">
                {slice.label}
                {slice.stage && slice.label !== "Today" ? <span className="text-slate-400"> · {slice.stage}</span> : null}
                {moment?.caption ? <span className="hidden text-lime-200/90 sm:inline"> — {moment.caption}</span> : null}
              </p>
            </>
          ) : (
            <p className="flex items-center gap-2 text-[12px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the ancient maps…
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-400">Fossil sites then</p>
          <p className="font-mono text-sm font-semibold text-lime-300">{data && shown != null ? shown.toLocaleString() : "—"}</p>
        </div>
      </div>

      {/* the slider, over a strip of the geologic periods */}
      <div className="relative mt-3">
        <div className="relative h-2.5 overflow-hidden rounded-full">
          {bands.map((b) => (
            <span key={b.key} title={b.label} className="absolute inset-y-0" style={{ left: `${b.left}%`, width: `${b.width}%`, background: b.color, opacity: 0.85 }} />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={0.1}
          value={slice ? max - slice.age : 0}
          onChange={(e) => setAge(max - Number(e.target.value))}
          aria-label="How long ago"
          aria-valuetext={slice ? fmtMa(slice.age) : undefined}
          disabled={!index}
          className="atlas-range atlas-range-lime absolute left-0 top-[5px] h-6 w-full -translate-y-1/2 cursor-pointer"
        />
        <div className="mt-1 hidden justify-between font-mono text-[9px] uppercase tracking-wider text-slate-500 sm:flex">
          {bands
            .filter((b) => b.width > 6)
            .map((b) => (
              <span key={b.key} className="absolute -translate-x-1/2" style={{ left: `${b.left + b.width / 2}%` }}>
                {b.label.slice(0, 4)}
              </span>
            ))}
          <span>&nbsp;</span>
        </div>
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MOMENTS.map((m) => (
          <button
            key={m.age}
            type="button"
            onClick={() => setAge(m.age)}
            aria-pressed={slice?.age === m.age}
            className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              slice?.age === m.age ? "border-lime-300/50 bg-lime-400/15 text-lime-100" : "border-white/10 text-slate-300 hover:text-white"
            }`}
          >
            {m.label}
            {m.age ? <span className="ml-1 text-slate-500">{m.age}</span> : null}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-300">Couldn&apos;t load this time slice ({error}).</p>}
      <p className="mt-2 text-[10.5px] leading-snug text-slate-500">
        Ancient maps and positions are reconstructions — scientists&apos; best estimates, less certain the further back you go. Map: PALEOMAP PaleoDEMs (Scotese &amp; Wright 2018, CC BY 4.0); positions: GPlates.
      </p>
    </HudPanel>
  );
}
