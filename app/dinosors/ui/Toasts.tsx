"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useClickAway } from "./useClickAway";

export interface Toast {
  id: number;
  icon: string;
  text: string;
  fact?: string;
  x?: number;
  y?: number;
}

/**
 * Messages: they no longer pop up over the game (too many). They go into a 🔔 list under the clock instead
 * (newest first, with 📍 to fly there and 💡 for the fact); pop-ups can be switched back on from the list.
 */
export default function Toasts({ toasts, log, unread, popups, onDismiss, onGo, onTogglePopups, onRead }: {
  toasts: Toast[];
  log: Toast[];
  unread: number;
  popups: boolean;
  onDismiss: (id: number) => void;
  onGo: (x: number, y: number) => void;
  onTogglePopups: (on: boolean) => void;
  onRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useClickAway(open, boxRef, () => setOpen(false), false);
  return (
    <>
      {popups && (
        <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+84px)] z-30 flex flex-col items-center gap-2 px-3 sm:top-4">
          <AnimatePresence initial={false} mode="wait">
            {toasts.slice(-1).map((t) => (
              <ToastPill key={t.id} t={t} onDismiss={onDismiss} onGo={onGo} />
            ))}
          </AnimatePresence>
        </div>
      )}
      <div ref={boxRef} className="pointer-events-none absolute left-4 top-[100px] z-30 hidden sm:block">
        <button type="button" aria-label={`Messages${unread ? ` (${unread} new)` : ""}`} aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            onRead();
          }}
          className="dl-glass pointer-events-auto relative flex h-10 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold shadow-lg transition hover:brightness-110 active:scale-95">
          <span className="text-lg leading-none">🔔</span>
          <span className="hidden sm:inline">Messages</span>
          {unread > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-[11px] font-black text-slate-900">{unread > 99 ? "99+" : unread}</span>}
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
              className="dl-glass dl-scroll pointer-events-auto mt-2 max-h-[min(60vh,520px)] w-[min(92vw,380px)] overflow-y-auto rounded-3xl p-3 shadow-2xl">
              <MessageFeed log={log} popups={popups} onTogglePopups={onTogglePopups} onGo={onGo} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export function MessageFeed({ log, popups, onTogglePopups, onGo }: {
  log: Toast[];
  popups: boolean;
  onTogglePopups: (on: boolean) => void;
  onGo: (x: number, y: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="text-sm font-bold">🔔 Recent messages</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-white/70">
          <input type="checkbox" checked={popups} onChange={(e) => onTogglePopups(e.target.checked)} className="accent-amber-400" />
          Pop-ups
        </label>
      </div>
      {log.length === 0 && <p className="px-1 py-3 text-[13px] text-white/55">Nothing yet. News from the tribe will collect here.</p>}
      <div className="space-y-1">
        {log.map((t) => <LogRow key={t.id} t={t} onGo={onGo} />)}
      </div>
    </>
  );
}

function LogRow({ t, onGo }: { t: Toast; onGo: (x: number, y: number) => void }) {
  const [fact, setFact] = useState(false);
  const where = t.x !== undefined && t.y !== undefined && t.x >= 0;
  return (
    <div className="rounded-2xl bg-white/5 px-2.5 py-1.5">
      <div className="flex items-start gap-2">
        <span className="text-lg leading-tight">{t.icon}</span>
        <span className="flex-1 text-[12.5px] leading-snug text-white/90">{t.text}</span>
        {where && (
          <button type="button" title="Show me" onClick={() => onGo(t.x!, t.y!)} className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs hover:bg-white/20 active:scale-95">
            📍
          </button>
        )}
        {t.fact && (
          <button type="button" title="Tell me more" onClick={() => setFact((f) => !f)} className={`shrink-0 rounded-full px-2 py-0.5 text-xs hover:bg-amber-300/40 ${fact ? "bg-amber-300/40" : "bg-amber-300/15"}`}>
            💡
          </button>
        )}
      </div>
      {fact && t.fact && <p className="mt-1 border-t border-white/10 pt-1 text-[12px] text-amber-100">{t.fact}</p>}
    </div>
  );
}

function ToastPill({ t, onDismiss, onGo }: { t: Toast; onDismiss: (id: number) => void; onGo: (x: number, y: number) => void }) {
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLDivElement>(null);
  useClickAway(open, pillRef, () => setOpen(false), false);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useEffect(() => {
    const id = window.setTimeout(() => dismiss.current(t.id), 6000);
    return () => window.clearTimeout(id);
  }, [t.id]);
  const where = t.x !== undefined && t.y !== undefined && t.x >= 0;
  return (
    <motion.div
      ref={pillRef}
      layout
      initial={{ y: -28, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -24, opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="dl-glass pointer-events-auto w-full max-w-[min(92vw,30rem)] rounded-3xl px-4 py-2.5 shadow-xl"
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
