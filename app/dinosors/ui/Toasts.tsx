"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface Toast {
  id: number;
  icon: string;
  text: string;
  fact?: string;
  x?: number;
  y?: number;
}

/** Little pill messages at the top. Facts hide behind a 💡 so they never become homework. */
export default function Toasts({ toasts, onDismiss, onGo }: { toasts: Toast[]; onDismiss: (id: number) => void; onGo: (x: number, y: number) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex flex-col items-center gap-2 px-3 sm:top-4">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastPill key={t.id} t={t} onDismiss={onDismiss} onGo={onGo} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastPill({ t, onDismiss, onGo }: { t: Toast; onDismiss: (id: number) => void; onGo: (x: number, y: number) => void }) {
  const [open, setOpen] = useState(false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const id = window.setTimeout(() => dismiss.current(t.id), open ? 12000 : t.fact ? 7000 : 4800);
    return () => window.clearTimeout(id);
  }, [t.id, t.fact, open]);
  const where = t.x !== undefined && t.y !== undefined && t.x >= 0;
  return (
    <motion.div
      layout
      initial={{ y: -20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -12, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="dl-glass pointer-events-auto max-w-[min(92vw,30rem)] rounded-3xl px-4 py-2.5 shadow-xl"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-2xl leading-none">{t.icon}</span>
        <span className="text-[15px] font-semibold leading-snug">{t.text}</span>
        {where && (
          <button type="button" title="Show me" onClick={() => onGo(t.x!, t.y!)} className="ml-1 shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold hover:bg-white/25 active:scale-95">
            📍
          </button>
        )}
        {t.fact && (
          <button type="button" title="Tell me more" onClick={() => setOpen((o) => !o)} className={`shrink-0 rounded-full px-2.5 py-1 text-sm hover:bg-amber-300/40 active:scale-95 ${open ? "bg-amber-300/40" : "bg-amber-300/20"}`}>
            💡
          </button>
        )}
        <button type="button" aria-label="Dismiss" onClick={() => onDismiss(t.id)} className="shrink-0 rounded-full px-1.5 text-white/60 hover:text-white">
          ✕
        </button>
      </div>
      {open && t.fact && <p className="mt-1.5 border-t border-white/10 pt-1.5 text-sm text-amber-100">{t.fact}</p>}
    </motion.div>
  );
}
