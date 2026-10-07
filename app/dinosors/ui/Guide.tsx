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
          className={`pointer-events-auto absolute left-1 z-30 flex w-[min(420px,calc(100vw-8px))] items-end sm:left-3 ${deep ? "bottom-[160px] sm:bottom-28" : "bottom-[100px] sm:bottom-32"}`}
          role="status"
        >
          <motion.img
            src={GUIDE_IMG(tip.art)}
            alt={tip.who}
            width={128}
            height={128}
            initial={{ y: 40, rotate: -8 }}
            animate={{ y: 0, rotate: [0, -4, 3, 0] }}
            transition={{ y: { type: "spring", stiffness: 260, damping: 15 }, rotate: { duration: 1.6, delay: 0.3 } }}
            className="relative z-20 -mr-1 h-28 w-28 shrink-0 object-contain drop-shadow-[0_5px_0_rgba(36,20,10,0.55)] sm:h-32 sm:w-32"
          />
          <div className="relative mb-6 min-w-0 flex-1">
            <div className="dl-paper relative rounded-[26px] px-4 pb-3 pt-4">
              <div className="dl-leopard dl-btn absolute -top-3.5 left-4 rounded-full px-3 py-0.5 text-[12px] font-bold uppercase tracking-wider text-[#fff6dd]">
                <span className="dl-ink">{tip.who} says</span>
              </div>
              <button type="button" aria-label="Close tip" onClick={() => setTip(null)} className="absolute right-2.5 top-2.5 rounded-full p-1 text-[#3a2414]/50 hover:bg-[#3a2414]/10 hover:text-[#3a2414]">
                <X className="h-4 w-4" strokeWidth={3} />
              </button>
              <p className="pr-5 text-[15px] font-semibold leading-snug">{tip.text}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setTip(null)} className="dl-btn rounded-full bg-amber-400 px-3.5 py-1 text-[13px] font-bold text-[#3a2414] hover:bg-amber-300">
                  Got it!
                </button>
                <button type="button" onClick={() => show(choose(true))} className="dl-btn rounded-full bg-[#fffaf0] px-3 py-1 text-[13px] font-bold text-[#3a2414] hover:bg-white">
                  Another tip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTip(null);
                    onHelp(tip.help);
                  }}
                  className="dl-btn flex items-center gap-1 rounded-full bg-[#fffaf0] px-3 py-1 text-[13px] font-bold text-[#3a2414] hover:bg-white"
                >
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={2.5} /> Help
                </button>
              </div>
              <button type="button" onClick={onOff} className="mt-2 text-[11.5px] font-semibold text-[#3a2414]/55 underline-offset-2 hover:text-[#3a2414] hover:underline">
                Turn tips off
              </button>
            </div>
            {/* speech tail toward the speaker */}
            <span aria-hidden className="absolute -left-[10px] bottom-6 z-10 h-5 w-5 rotate-45 border-b-[3px] border-l-[3px] border-[#3a2414] bg-[#f8e8c8]" />
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
  // near the top of the screen there's no room above the thing: show the card below it
  const [below, setBelow] = useState(false);
  const belowRef = useRef(false);

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
        const b = p.y < 250;
        if (b !== belowRef.current) {
          belowRef.current = b;
          setBelow(b);
        }
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
      <div className={`pointer-events-auto absolute -translate-x-1/2 ${hint.open && below ? "pt-12" : "-translate-y-full pb-3"}`}>
        {hint.open ? (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 420, damping: 24 }} className="relative w-[min(360px,calc(100vw-24px))]">
            <div className="dl-paper flex items-start gap-3.5 rounded-[26px] p-4 pr-10">
              <img src={GUIDE_IMG(info.art)} alt="" width={104} height={104} className="-mb-2 -ml-2 -mt-10 h-[104px] w-[104px] shrink-0 object-contain drop-shadow-[0_3px_0_rgba(36,20,10,0.45)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[18px] font-bold leading-tight">{info.title}</div>
                <p className="mt-1.5 text-[15.5px] font-medium leading-snug text-[#3a2414]/85">{info.text}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setHint(null)} className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-[#3a2414]/50 hover:bg-[#3a2414]/10 hover:text-[#3a2414]">
                <X className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
            {/* tail down to the thing */}
            <span aria-hidden className={`absolute left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-[#3a2414] ${below ? "-top-[11px] border-l-[3px] border-t-[3px] bg-[#fff6e0]" : "-bottom-[11px] border-b-[3px] border-r-[3px] bg-[#f6e4bd]"}`} />
          </motion.div>
        ) : (
          <div className="relative flex flex-col items-center">
            <span aria-hidden className="absolute top-0 h-12 w-12 animate-ping rounded-full bg-amber-300/50" />
            <motion.button
              type="button"
              aria-label={`What's this? ${info.title}`}
              onClick={() => setHint({ ...hint, open: true })}
              initial={{ scale: 0, y: 8 }}
              animate={{ scale: 1, y: [0, -5, 0] }}
              transition={{ scale: { type: "spring", stiffness: 400, damping: 14 }, y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } }}
              className="dl-btn relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-2xl font-black text-[#3a2414] hover:from-amber-200"
            >
              ?
            </motion.button>
            <span aria-hidden className="mt-0.5 h-0 w-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-[#3a2414]" />
          </div>
        )}
      </div>
    </div>
  );
}
