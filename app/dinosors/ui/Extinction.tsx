"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@/components/ui/modal";
import type { Engine, Snapshot } from "../game/engine";
import { putSlot } from "../game/slots";

/* ------------------------------------------------------------------ */
/*  The end of an age: the confirm dialog, the countdown banner and    */
/*  the "THE AGE ENDS" screen with what to do next.                    */
/* ------------------------------------------------------------------ */

export function ExtinctionConfirm({ open, onClose, snap, engine, fontClass, onToast }: { open: boolean; onClose: () => void; snap: Snapshot; engine: Engine; fontClass: string; onToast: (icon: string, text: string) => void }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setSaved(false);
  }, [open]);
  const ext = snap.extinction;
  return (
    <Modal open={open} onClose={onClose} size="md" accent="#ef4444" labelledBy="ext-confirm">
      <div className={`bg-slate-950 p-6 text-white ${fontClass}`}>
        <div className="text-5xl">☄️</div>
        <h2 id="ext-confirm" className="mt-2 text-2xl font-bold">Call down the extinction asteroid?</h2>
        <p className="mt-2 text-sm text-white/70">
          The sky will change, the animals will panic, and then it hits. A shockwave rolls across the whole map: fires, eruptions, falling rock and ash. <b className="text-rose-300">Most dinosaurs and most of your people will die.</b> Buildings in its path are flattened.
        </p>
        <div className="mt-3 rounded-2xl bg-white/5 p-3 text-[13px]">
          <p className="font-bold">Your chances</p>
          <p className="mt-1">{ext.shelter ? "✅ A Deep shelter is built: people who reach it have a good chance." : "⬜ No Deep shelter."}</p>
          <p>{ext.shield ? (ext.shieldReady ? "✅ The Resonance shield is charged." : "⚠️ The Resonance shield needs more stored energy to hold.") : "⬜ No Resonance shield."}</p>
          <p className="mt-1 text-[11px] text-white/50">Even with them, survival isn&apos;t guaranteed.</p>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={onClose} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold hover:bg-white/20">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || saved}
            onClick={async () => {
              setSaving(true);
              await putSlot(engine.makeSlot("manual", `Before the asteroid · Day ${engine.world.day}`, "Ages"));
              engine.save(true);
              setSaving(false);
              setSaved(true);
              onToast("💾", "World saved in 📂 Saved games (group: Ages).");
            }}
            className="rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-bold hover:bg-emerald-500 disabled:opacity-60"
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save World First"}
          </button>
          <button
            type="button"
            onClick={() => {
              engine.triggerExtinction();
              onClose();
            }}
            className="rounded-2xl bg-rose-600 px-3 py-3 text-sm font-bold shadow-lg shadow-rose-900/40 hover:bg-rose-500"
          >
            Trigger Extinction
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Countdown + warnings while it's happening. */
export function ExtinctionBanner({ snap }: { snap: Snapshot }) {
  const ext = snap.extinction;
  const on = ext.phase === "omen" || ext.phase === "incoming" || ext.phase === "impact";
  const n = Math.ceil(ext.countdown);
  return (
    <AnimatePresence>
      {on && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-[34%] z-30 -translate-x-1/2 text-center">
          {ext.phase === "impact" ? (
            <p className="text-3xl font-black tracking-widest text-amber-100 drop-shadow-[0_0_20px_rgba(255,120,60,0.9)] sm:text-5xl">IMPACT</p>
          ) : (
            <>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-200/90">{ext.phase === "omen" ? "The sky is changing…" : "Take cover!"}</p>
              <motion.p key={n} initial={{ scale: 1.4, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl font-black tabular-nums text-white drop-shadow-[0_0_24px_rgba(255,80,60,0.9)] sm:text-7xl">
                {n}
              </motion.p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** "THE AGE ENDS" — after the dust settles. */
export function AgeEnds({ snap, engine, fontClass, onLoad, onNew }: { snap: Snapshot; engine: Engine; fontClass: string; onLoad: () => void; onNew: () => void }) {
  const ext = snap.extinction;
  const s = ext.stats;
  return (
    <AnimatePresence>
      {ext.phase === "ended" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.6 }} className={`pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black/90 via-stone-950/85 to-black/95 p-4 ${fontClass}`}>
          <div className="w-full max-w-lg text-center">
            <motion.h2 initial={{ letterSpacing: "0.1em", opacity: 0 }} animate={{ letterSpacing: "0.35em", opacity: 1 }} transition={{ duration: 3 }} className="text-4xl font-black text-stone-100 sm:text-6xl">
              THE AGE ENDS
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1.5 }} className="mt-3 text-sm text-stone-400">
              Day {snap.day}. The ash will take a long time to settle.
            </motion.p>
            {s && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2, duration: 1 }} className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2 text-left text-sm">
                <Stat icon="🦖" label="Dinosaurs lost" value={`${s.dinosLost} of ${s.dinosBefore}`} />
                <Stat icon="🧔" label="People lost" value={`${s.peopleLost} of ${s.peopleBefore}`} />
                <Stat icon="🕳️" label="Sheltered" value={`${s.sheltered}`} />
                <Stat icon="🏚️" label="Buildings lost" value={`${s.buildingsLost}`} />
                {s.shieldHeld && <p className="col-span-2 rounded-xl bg-cyan-500/15 px-3 py-2 text-cyan-100">🌀 The Resonance shield held over the camp.</p>}
                <p className="col-span-2 rounded-xl bg-white/5 px-3 py-2 text-stone-300">{snap.humans > 0 ? `${snap.humans} ${snap.humans === 1 ? "person" : "people"} walk out into a grey world.` : "No one is left. The world is quiet."}</p>
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.2, duration: 1 }} className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-2">
              <button type="button" onClick={() => engine.observeRuins()} className="rounded-2xl bg-white/10 py-3 font-bold text-white hover:bg-white/20">
                🔭 Observe Ruins
              </button>
              <button type="button" onClick={() => engine.restartWorld()} className="rounded-2xl bg-white/10 py-3 font-bold text-white hover:bg-white/20">
                🔁 Restart World
              </button>
              <button type="button" onClick={onNew} className="rounded-2xl bg-amber-500 py-3 font-bold text-slate-950 hover:bg-amber-400">
                🌍 New World
              </button>
              <button type="button" onClick={onLoad} className="rounded-2xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-500">
                📂 Load Previous Save
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const Stat = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="rounded-xl bg-white/5 px-3 py-2">
    <span className="text-lg">{icon}</span> <span className="text-stone-400">{label}</span>
    <b className="block text-lg text-stone-100">{value}</b>
  </div>
);
