"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Plus, Users, Video, X } from "lucide-react";
import { WEAPON_KINDS } from "../data/colony";
import { CONDITION_LABEL } from "../sim/injury";
import type { Engine, Snapshot } from "../game/engine";

/* ------------------------------------------------------------------ */
/*  The squad strip: who's picked, what they were just told to do (and */
/*  what else that tap could have meant), and quick actions. With      */
/*  nobody picked it shrinks to a single "pick people" pill.           */
/* ------------------------------------------------------------------ */

export default function SelectionBar({ snap, engine, toolOn = false }: { snap: Snapshot; engine: Engine; toolOn?: boolean }) {
  const sel = snap.selection;
  const cmd = snap.command;
  const kidsOnly = sel.length > 0 && sel.every((p) => p.child);
  const [hidePickTip, setHidePickTip] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[78px] z-30 flex flex-col-reverse items-center gap-2 px-2 sm:bottom-[96px]">
      <AnimatePresence mode="popLayout">
        {sel.length === 0 && (toolOn || hidePickTip) ? null : sel.length === 0 ? (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="dl-glass pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white/85 shadow-lg transition hover:bg-white/15 active:scale-95"
          >
            <button type="button" onClick={() => engine.selectAll(true)} title="Pick everyone who isn't busy (or tap a person, shift-drag a box)" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Pick idle people
            </button>
            <span className="hidden text-[11px] font-medium text-white/50 sm:inline">· or tap someone</span>
            <button type="button" onClick={() => setHidePickTip(true)} aria-label="Close pick people tip" className="ml-1 rounded-full p-0.5 text-white/60 hover:bg-white/15 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        ) : (
          <motion.div
            key="bar"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="dl-glass pointer-events-auto flex max-w-[min(760px,calc(100vw-16px))] items-center gap-2 rounded-3xl px-2.5 py-2 shadow-2xl"
          >
            <div className="dl-scroll flex min-w-0 items-center gap-1 overflow-x-auto">
              {sel.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => engine.selectPeople([p.id])}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    engine.toggleSelect(p.id);
                  }}
                  title={`${p.name} — ${p.activity}${p.condition !== "healthy" ? ` (${CONDITION_LABEL[p.condition].label})` : ""}`}
                  className="group relative flex shrink-0 flex-col items-center rounded-2xl bg-white/5 px-2 py-1 transition hover:bg-white/15"
                >
                  <span className="text-xl leading-none">{p.icon}</span>
                  <span className="mt-0.5 max-w-[56px] truncate text-[10.5px] font-bold">{p.name}</span>
                  <span className="mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full" style={{ width: `${Math.round(p.hp * 100)}%`, background: CONDITION_LABEL[p.condition].color }} />
                  </span>
                </button>
              ))}
              {sel.length > 10 && <span className="shrink-0 px-1 text-xs font-bold text-white/70">+{sel.length - 10}</span>}
            </div>
            <div className="hidden h-10 w-px shrink-0 bg-white/10 sm:block" />
            <div className="flex shrink-0 items-center gap-1">
              <span className="hidden max-w-[150px] text-[11.5px] leading-tight text-white/65 md:block">{kidsOnly ? "Kids help with light jobs near camp" : "Tap anything in the world to give an order"}</span>
              <button
                type="button"
                onClick={() => (engine.addMode = !engine.addMode)}
                aria-pressed={engine.addMode}
                title="Add more: tap other people to add them (or shift-click)"
                className={`rounded-xl p-2 transition active:scale-90 ${engine.addMode ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}
              >
                <Plus className="h-4 w-4" />
              </button>
              {sel.length === 1 && (
                <button type="button" onClick={() => engine.follow(snap.followId === sel[0].id ? 0 : sel[0].id)} title="Follow with the camera" className={`rounded-xl p-2 transition active:scale-90 ${snap.followId === sel[0].id ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"}`}>
                  <Video className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => engine.cancelOrders()} title="Cancel their orders: back to auto" className="rounded-xl bg-white/10 px-2.5 py-1.5 text-[12px] font-bold transition hover:bg-white/20 active:scale-95">
                ✨ Auto
              </button>
              <button type="button" onClick={() => engine.clearSelection()} aria-label="Deselect" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cmd && sel.length > 0 && (
          <motion.div
            key={cmd.at}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="dl-glass pointer-events-auto flex max-w-[calc(100vw-16px)] flex-wrap items-center justify-center gap-1.5 rounded-2xl px-3 py-1.5 text-[13px] shadow-xl"
          >
            <span className="font-bold">
              {cmd.icon} {cmd.label}
            </span>
            {cmd.weapons.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-white/55">with</span>
                {WEAPON_KINDS.filter((k) => cmd.weapons.includes(k.kind)).map((k) => (
                  <button
                    key={k.kind}
                    type="button"
                    onClick={() => engine.commandWeapon(k.kind)}
                    title={k.name}
                    className={`rounded-lg px-1.5 py-0.5 text-base transition active:scale-90 ${cmd.weapon === k.kind ? "bg-amber-400" : "bg-white/10 hover:bg-white/20"}`}
                  >
                    {k.icon}
                  </button>
                ))}
              </span>
            )}
            {cmd.alts.length > 0 && <span className="text-white/55">· instead:</span>}
            {cmd.alts.map((a) => (
              <button key={a.i} type="button" onClick={() => engine.commandAlt(a.i)} className="rounded-lg bg-white/10 px-2 py-0.5 font-semibold transition hover:bg-white/20 active:scale-95">
                {a.icon} {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
