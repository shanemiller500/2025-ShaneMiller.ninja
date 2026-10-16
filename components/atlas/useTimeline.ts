"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Playback clock for any atlas time replay. The cursor sweeps from   */
/*  start → end in `durationMs` at 1x; React only hears about it ~20x  */
/*  a second so a page with a big list doesn't re-render every frame.  */
/* ------------------------------------------------------------------ */

export const TIMELINE_SPEEDS = [0.5, 1, 2, 4] as const;

export function useTimeline(start: number, end: number, durationMs = 40_000) {
  const [cursor, setCursorState] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof TIMELINE_SPEEDS)[number]>(1);
  const cursorRef = useRef(end);

  const setCursor = useCallback((t: number) => {
    cursorRef.current = t;
    setCursorState(t);
  }, []);

  // a new range starts over from the beginning
  useEffect(() => {
    setCursor(start);
  }, [start, end, setCursor]);

  useEffect(() => {
    if (!playing || end <= start) return;
    let raf = 0;
    let last = performance.now();
    let lastPush = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      let t = cursorRef.current + ((end - start) * dt * speed) / durationMs;
      if (t >= end) t = end;
      cursorRef.current = t;
      if (now - lastPush > 50 || t === end) {
        lastPush = now;
        setCursorState(t);
      }
      if (t === end) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, start, end, durationMs]);

  /** Play from the start (or resume); pressing play at the end rewinds first. */
  const play = useCallback(() => {
    if (cursorRef.current >= end) setCursor(start);
    setPlaying(true);
  }, [start, end, setCursor]);

  return { cursor, setCursor, playing, play, pause: () => setPlaying(false), speed, setSpeed };
}

/** Event counts per time bin — the histogram under the slider. */
export function timeBins(times: number[], start: number, end: number, n = 120) {
  const bins = new Array<number>(n).fill(0);
  const span = end - start || 1;
  for (const t of times) {
    const i = Math.floor(((t - start) / span) * n);
    if (i >= 0 && i < n) bins[i]++;
    else if (i === n) bins[n - 1]++;
  }
  return bins;
}
