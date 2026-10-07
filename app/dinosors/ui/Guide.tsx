"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import { BUBBLES, GUIDE_IMG, TIPS, type Tip } from "../data/guide";
import type { Engine, Snapshot } from "../game/engine";

/* ------------------------------------------------------------------ */
/*  Ugg + Oona: little tips now and then (some matched to what's going */
/*  on), and "?" bubbles over things in the world. Never more than one */
/*  at a time, never while a panel is open, easy to switch off.        */
/* ------------------------------------------------------------------ */

const SEEN_KEY = "dinosors:tips-seen";
/** first tip after… (s) */
const FIRST = 20;
/** quiet time between tips (s) */
const GAP = 150;
/** urgent tips can cut in after… (s) */
const URGENT_GAP = 45;

function loadSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function saveSeen(s: Record<string, number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(s));
  } catch {
    /* storage off: tips just repeat a bit more */
  }
}

/** The tip card, bottom-left, with a cave person popping up beside it. */
export function TipCoach({ snap, enabled, busy, onOff, onHelp }: { snap: Snapshot; enabled: boolean; busy: boolean; onOff: () => void; onHelp: (section?: string) => void }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const last = useRef({ at: -999, start: 0 });
  const seen = useRef<Record<string, number>>({});

  useEffect(() => {
    seen.current = loadSeen();
    last.current.start = performance.now() / 1000;
  }, []);

  // pick something worth saying
  const choose = (wantGeneral = false): Tip | null => {
    const s = snapRef.current;
    const now = Date.now();
    const fresh = (t: Tip) => now - (seen.current[t.id] ?? 0) > (t.urgent ? 10 * 60_000 : 45 * 60_000);
    const fits = (t: Tip) => !t.when || t.when(s);
    if (!wantGeneral) {
      const urgent = TIPS.find((t) => t.urgent && fits(t) && fresh(t));
      if (urgent) return urgent;
      const ctx = TIPS.find((t) => t.when && !t.urgent && fits(t) && fresh(t));
      if (ctx) return ctx;
    }
    const general = TIPS.filter((t) => !t.when && fresh(t));
    const pool = general.length ? general : TIPS.filter((t) => !t.when);
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  };

  const show = (t: Tip | null) => {
    if (!t) return;
    seen.current[t.id] = Date.now();
    saveSeen(seen.current);
    last.current.at = performance.now() / 1000;
    setTip(t);
  };

  useEffect(() => {
    if (!enabled) {
      setTip(null);
      return;
    }
    const id = window.setInterval(() => {
      if (busy || tip) return;
      const now = performance.now() / 1000;
      if (now - last.current.start < FIRST) return;
      const since = now - last.current.at;
      const s = snapRef.current;
      const urgent = TIPS.find((t) => t.urgent && t.when?.(s) && Date.now() - (seen.current[t.id] ?? 0) > 10 * 60_000);
      if (urgent && since > URGENT_GAP) return show(urgent);
      if (since > GAP + Math.random() * 60 || last.current.at < 0) show(choose());
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, busy, tip]);

  // tips tidy themselves away
  useEffect(() => {
    if (!tip) return;
    const id = window.setTimeout(() => setTip(null), 22_000);
    return () => window.clearTimeout(id);
  }, [tip]);

  const deep = snap.view === "deep";
  return (
    <AnimatePresence>
      {tip && enabled && !busy && (
        <motion.div
          key={tip.id}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          className={`pointer-events-auto absolute left-2 z-30 flex w-[min(360px,calc(100vw-16px))] items-end sm:left-4 ${deep ? "bottom-[160px] sm:bottom-28" : "bottom-[100px] sm:bottom-32"}`}
          role="status"
        >
          <motion.img
            src={GUIDE_IMG(tip.art)}
            alt={tip.who}
            width={96}
            height={96}
            initial={{ y: 30, rotate: -6 }}
            animate={{ y: 0, rotate: [0, -3, 2, 0] }}
            transition={{ y: { type: "spring", stiffness: 260, damping: 16 }, rotate: { duration: 1.6, delay: 0.3 } }}
            className="relative z-10 -mr-5 h-24 w-24 shrink-0 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
          />
          <div className="dl-glass relative flex-1 rounded-3xl rounded-bl-md p-3 pl-6 shadow-2xl">
            <button type="button" aria-label="Close tip" onClick={() => setTip(null)} className="absolute right-2 top-2 rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">{tip.who} says</div>
            <p className="mt-0.5 pr-4 text-[13.5px] leading-snug text-white/90">{tip.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setTip(null)} className="rounded-full bg-amber-400 px-3 py-1 text-[12px] font-bold text-slate-900 hover:bg-amber-300 active:scale-95">
                Got it
              </button>
              <button type="button" onClick={() => show(choose(true))} className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold hover:bg-white/20 active:scale-95">
                Another tip
              </button>
              <button
                type="button"
                onClick={() => {
                  setTip(null);
                  onHelp(tip.help);
                }}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold hover:bg-white/20 active:scale-95"
              >
                <BookOpen className="h-3.5 w-3.5" /> Help
              </button>
              <button type="button" onClick={onOff} className="ml-auto text-[11px] font-semibold text-white/45 underline-offset-2 hover:text-white/80 hover:underline">
                Turn tips off
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Now and then a "?" bubble floats over something in view; tap it for a one-line explanation. */
export function HintBubbles({ engine, enabled, busy, view }: { engine: Engine; enabled: boolean; busy: boolean; view: string }) {
  const [hint, setHint] = useState<{ key: string; x: number; y: number; open: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<Record<string, number>>({});

  // every so often, pick something on screen we haven't explained lately
  useEffect(() => {
    if (!enabled) {
      setHint(null);
      return;
    }
    let next = performance.now() + 40_000;
    const id = window.setInterval(() => {
      if (busy || hint || performance.now() < next) return;
      const now = Date.now();
      const options = engine.hintTargets().filter((t) => now - (shown.current[t.key] ?? 0) > 20 * 60_000);
      if (!options.length) return;
      const t = options[Math.floor(Math.random() * options.length)];
      shown.current[t.key] = now;
      next = performance.now() + 80_000 + Math.random() * 50_000;
      setHint({ ...t, open: false });
    }, 4000);
    return () => window.clearInterval(id);
  }, [enabled, busy, hint, engine]);

  // follow the thing as the camera moves
  useEffect(() => {
    if (!hint) return;
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const p = engine.screenOf(hint.x, hint.y);
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const hide = window.setTimeout(() => setHint((h) => (h && !h.open ? null : h)), 25_000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hide);
    };
  }, [hint, engine]);

  // a view change (surface ↔ Deep) drops the bubble
  useEffect(() => setHint(null), [view]);

  if (!hint || !enabled || busy) return null;
  const info = BUBBLES[hint.key.split(":")[0]];
  if (!info) return null;
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-20" style={{ willChange: "transform" }}>
      <div className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full pb-2">
        {hint.open ? (
          <motion.div initial={{ opacity: 0, scale: 0.85, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="dl-glass flex w-[230px] items-start gap-2 rounded-2xl p-2.5 shadow-2xl">
            <img src={GUIDE_IMG(info.art)} alt="" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-amber-200">{info.title}</div>
              <p className="text-[12px] leading-snug text-white/85">{info.text}</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => setHint(null)} className="rounded-full p-0.5 text-white/50 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            type="button"
            aria-label={`What's this? ${info.title}`}
            onClick={() => setHint({ ...hint, open: true })}
            initial={{ scale: 0, y: 8 }}
            animate={{ scale: 1, y: [0, -5, 0] }}
            transition={{ scale: { type: "spring", stiffness: 400, damping: 14 }, y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/80 bg-amber-400 text-base font-black text-slate-900 shadow-[0_4px_14px_rgba(0,0,0,0.4)] hover:bg-amber-300"
          >
            ?
          </motion.button>
        )}
      </div>
    </div>
  );
}
