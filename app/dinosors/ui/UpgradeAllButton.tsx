"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Engine } from "../game/engine";
import { upgradeStatus, type UpgradeKind } from "../sim/build";

export function UpgradeAllButton({ engine, kind = "all", label, className = "" }: { engine: Engine; kind?: UpgradeKind; label: string; className?: string }) {
  const [, refresh] = useState(0);
  const { available, queued } = upgradeStatus(engine.world, kind);
  const disabled = available === 0;
  const text = disabled ? queued ? `${queued} upgrade${queued === 1 ? "" : "s"} on the way` : "No upgrades available" : label;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={text}
      onClick={() => { engine.upgradeAll(kind); refresh((n) => n + 1); }}
      className={`flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-default disabled:bg-amber-400/50 disabled:text-slate-900/70 ${className}`}
    >
      {queued > 0 ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : <span aria-hidden="true">⬆️</span>}
      <span>{text}</span>
    </button>
  );
}
