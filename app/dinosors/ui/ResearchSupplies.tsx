"use client";

import { NODES, RES_INFO, type Cost } from "../data/colony";
import { FIND_AMOUNT } from "../data/mine";
import type { Engine, Snapshot } from "../game/engine";
import type { BuildingKind, Resource } from "../sim/types";
import { GameIcon } from "./GameIcon";

export function ResearchSupplies({ cost, snap, engine, onNavigate, onBuildStation }: { cost: Cost; snap: Snapshot; engine: Engine; onNavigate: () => void; onBuildStation?: (kind: BuildingKind) => void }) {
  const missing = (Object.entries(cost) as [Resource, number][]).filter(([r, n]) => (snap.camp.stock[r] ?? 0) < n);
  if (!missing.length) return <p className="mt-2 text-[11px] text-emerald-200">All materials collected. Research will continue when someone is working.</p>;
  return (
    <div className="mt-2 space-y-1.5">
      {missing.map(([r, n]) => {
        const node = engine.world.colony.nodes.find((site) => site.found && site.amount > 0 && NODES[site.kind].gives === r && (!NODES[site.kind].needs || engine.world.camp.learned.has(NODES[site.kind].needs!)));
        const deep = !!FIND_AMOUNT[r];
        const yard = r === "shaped" ? engine.world.colony.buildings.find((b) => b.kind === "shapingYard" && b.built >= 1) : null;
        return (
          <div key={r} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 text-[11px]">
            <GameIcon id={r} size={16} />
            <span className="min-w-0 flex-1">{RES_INFO[r]?.name ?? r} <strong>{Math.floor(snap.camp.stock[r] ?? 0)}/{n}</strong></span>
            {r === "shaped" ? yard ? <button type="button" className="rounded-lg bg-cyan-400/20 px-2 py-1 font-bold hover:bg-cyan-400/35" onClick={() => { engine.flyTo(yard.x, yard.y, 0.9); onNavigate(); }}>Find shaping yard</button> : onBuildStation ? <button type="button" className="rounded-lg bg-cyan-400/20 px-2 py-1 font-bold hover:bg-cyan-400/35" onClick={() => onBuildStation("shapingYard")}>Build shaping yard</button> : <span>Build a shaping yard</span>
              : node ? <button type="button" className="rounded-lg bg-cyan-400/20 px-2 py-1 font-bold hover:bg-cyan-400/35" onClick={() => { engine.flyTo(node.x, node.y, 0.85); onNavigate(); }}>Find deposit</button>
              : deep ? <button type="button" className="rounded-lg bg-cyan-400/20 px-2 py-1 font-bold hover:bg-cyan-400/35" onClick={() => { if (snap.crew === 0) engine.deepSend(1); engine.enterDeep(); onNavigate(); }}>{snap.crew === 0 ? "Send miner · Open Deep" : "Open Deep"}</button>
                : <span className="text-white/55">{r === "hide" || r === "bone" || r === "tooth" ? "Hunt / butcher" : r === "wood" ? "Gather trees" : "Explore / gather"}</span>}
          </div>
        );
      })}
    </div>
  );
}
