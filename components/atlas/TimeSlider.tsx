"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { TIMELINE_SPEEDS } from "./useTimeline";

interface TimeSliderProps {
  start: number;
  end: number;
  cursor: number;
  onCursor: (t: number) => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  speed: number;
  onSpeed: (s: (typeof TIMELINE_SPEEDS)[number]) => void;
  /** Event counts per bin, drawn as a histogram behind the track */
  bins?: number[];
  /** Label for a timestamp (cursor, start, end) */
  format: (t: number) => string;
  /** e.g. "1,204 of 7,636 quakes" */
  status?: string;
  className?: string;
}

/** Play / scrub control for an atlas replay: histogram + range input + speed. */
export function TimeSlider({ start, end, cursor, onCursor, playing, onPlay, onPause, speed, onSpeed, bins, format, status, className = "" }: TimeSliderProps) {
  const pct = end > start ? ((cursor - start) / (end - start)) * 100 : 100;
  const max = bins?.length ? Math.max(...bins, 1) : 1;
  const atEnd = cursor >= end;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#141418]/90 ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          aria-label={playing ? "Pause replay" : atEnd ? "Replay from the start" : "Play replay"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.7)] transition-colors hover:bg-indigo-600"
        >
          {playing ? <Pause className="h-4 w-4" /> : atEnd ? <RotateCcw className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{format(cursor)}</span>
            {status && <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-400">{status}</span>}
          </div>
          <div className="relative mt-1.5 h-9">
            {bins && (
              <div aria-hidden className="absolute inset-x-0 bottom-3 flex h-6 items-end gap-px">
                {bins.map((b, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-t-sm ${(i + 0.5) / bins.length <= pct / 100 ? "bg-indigo-500/70" : "bg-slate-300/70 dark:bg-white/15"}`}
                    style={{ height: `${b ? Math.max(8, (b / max) * 100) : 0}%` }}
                  />
                ))}
              </div>
            )}
            <div aria-hidden className="absolute inset-x-0 bottom-2.5 h-1 rounded-full bg-slate-200 dark:bg-white/10">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
            </div>
            <input
              type="range"
              aria-label="Replay time"
              min={start}
              max={end}
              step={(end - start) / 1000 || 1}
              value={cursor}
              onChange={(e) => {
                onPause();
                onCursor(Number(e.target.value));
              }}
              className="atlas-range absolute inset-x-0 bottom-0 h-6 w-full cursor-pointer"
            />
          </div>
          <div className="flex justify-between font-mono text-[10px] text-slate-400">
            <span>{format(start)}</span>
            <span>{format(end)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSpeed(TIMELINE_SPEEDS[(TIMELINE_SPEEDS.indexOf(speed as (typeof TIMELINE_SPEEDS)[number]) + 1) % TIMELINE_SPEEDS.length])}
          aria-label="Playback speed"
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-500 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:text-white"
        >
          {speed}×
        </button>
      </div>
    </div>
  );
}
