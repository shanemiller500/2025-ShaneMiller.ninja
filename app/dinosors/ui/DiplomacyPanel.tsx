"use client";

import { useEffect, useRef, useState } from "react";
import { Handshake, X, MapPin, Swords, Package, Shield } from "lucide-react";
import type { Engine, Snapshot } from "../game/engine";
import { TRADE_GOODS, type DiplomacyAction, type Good, type NationId } from "../sim/diplomacy";

const button = "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40";
const input = "min-w-0 rounded-xl border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white";
const colors = { Hostile: "text-orange-300", "At War": "text-rose-300", Unfriendly: "text-amber-200", Neutral: "text-slate-200", Friendly: "text-emerald-300", Allied: "text-cyan-300" };

export default function DiplomacyPanel({ engine, snap, onClose, onBuild }: { engine: Engine; snap: Snapshot; onClose: () => void; onBuild: () => void }) {
  const w = engine.world, diplomacy = w.diplomacy;
  const data = diplomacy.snapshot(w);
  const [selected, setSelected] = useState<NationId | null>(null);
  const [give, setGive] = useState<Good>("wood");
  const [receive, setReceive] = useState<Good>("iron");
  const [amount, setAmount] = useState(10);
  const [enemy, setEnemy] = useState<NationId | "">("");
  const [message, setMessage] = useState("");
  const [warConfirm, setWarConfirm] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const faction = data.factions.find((s) => s.id === selected) ?? data.factions[0];
  const wars = data.factions.filter((s) => s.war && s.id !== faction?.id);
  const enemyId = wars.some((s) => s.id === enemy) ? enemy : wars[0]?.id;
  useEffect(() => {
    const before = document.activeElement;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); closeRef.current(); }
      if (e.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,[tabindex="0"]');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("keydown", key, true); if (before instanceof HTMLElement) before.focus(); };
  }, []);
  const run = (fn: () => string) => { const text = fn(); setMessage(text); w.toast("🤝", text); };
  const action = (a: DiplomacyAction) => { if (faction) run(() => diplomacy.action(w, faction.id, a, enemyId || undefined)); };
  const quote = faction ? diplomacy.quote(w, faction.id, give, amount, receive) : 0;
  const canTrade = !!faction && ["Neutral", "Friendly", "Allied"].includes(faction.status) && data.postLevel > 0;
  return <div className="pointer-events-auto absolute inset-0 z-[65] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-6" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="diplomacy-title" onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-950 text-white shadow-2xl outline-none">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
        <div><h2 id="diplomacy-title" className="flex items-center gap-2 text-xl font-bold"><Handshake className="h-6 w-6 text-emerald-300" /> Diplomacy</h2><p className="mt-1 text-xs text-slate-400">Meet your neighbors. Build trust. Choose your wars.</p></div>
        <button className={button} aria-label="Close diplomacy" onClick={onClose}><X className="h-5 w-5" /></button>
      </header>
      <div className="overflow-y-auto overscroll-contain p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3">
          <div><p className="font-semibold text-amber-200">Trading Post {data.postLevel ? `· Level ${data.postLevel}` : "· Not built"}</p><p className="text-xs text-slate-400">{data.postLevel ? `${data.postLevel * 40} units per cargo · ${data.caravans.length}/${data.postLevel + 1} caravans · better rates at higher levels` : "Build outside your walls so visiting caravans can reach it."}</p></div>
          {!data.postLevel ? <button className={button} onClick={onBuild}>Build Trading Post</button> : data.postLevel < 3 && <button className={button} onClick={() => run(() => diplomacy.upgrade(w))}>Upgrade · {data.postLevel * 15} wood, {data.postLevel * 10} stone, {data.postLevel * 5} gold</button>}
        </div>
        {data.offers.length > 0 && <div className="mb-4 space-y-2" aria-label="Diplomatic offers">{data.offers.map((offer) => <div key={offer.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm">
          <span className="flex-1">{diplomacy.name(w, offer.from)}: {offer.kind === "peace" ? "Offer of peace" : offer.kind === "join" ? `Join war against ${diplomacy.name(w, offer.target!)}` : "Invitation to trade"} <span className="text-xs text-slate-400">({Math.ceil(offer.expires - w.elapsed)}s)</span></span>
          <button className={button} onClick={() => { setSelected(offer.from); run(() => diplomacy.respond(w, offer.id, true)); }}>Accept</button><button className={button} onClick={() => run(() => diplomacy.respond(w, offer.id, false))}>Decline</button>
        </div>)}</div>}
        {!faction ? <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center"><Handshake className="mx-auto mb-3 h-10 w-10 text-emerald-300" /><h3 className="font-bold">A world of future neighbors</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Explore with your people to meet settlements. Clans and Sea, Sand, Tree and Snow People will appear here as you discover them.</p></div> : <div className="grid gap-4 md:grid-cols-[230px_1fr]">
          <nav aria-label="Known factions" className="flex gap-2 overflow-x-auto md:block md:space-y-2">{data.factions.map((s) => <button key={s.id} onClick={() => { setSelected(s.id); setWarConfirm(false); setMessage(""); }} className={`min-w-44 rounded-2xl border p-3 text-left md:w-full ${faction.id === s.id ? "border-emerald-300/40 bg-emerald-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/10"}`}>
            <span className="text-xl">{s.icon}</span><span className="ml-2 text-sm font-bold">{s.name.split(" · ")[0]}</span><div className={`mt-1 text-xs ${colors[s.status]}`}>{s.status} · {Math.round(s.score)}</div>
          </button>)}</nav>
          <main className="min-w-0 space-y-4">
            <div><div className="flex items-start justify-between gap-2"><h3 className="text-lg font-bold">{faction.icon} {faction.name}</h3><button className={button} title="Show settlement" aria-label="Show settlement on map" onClick={() => engine.flyTo(faction.x, faction.y, 0.8)}><MapPin className="h-4 w-4" /></button></div>
              <p className={`mt-1 font-semibold ${colors[faction.status]}`}>{faction.status} <span className="text-xs text-slate-400">{Math.round(faction.score)} / 100 · {faction.war ? "War" : "Peace"} · {canTrade ? "Trade open" : "Trade closed"}</span></p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(faction.score + 100) / 2}%` }} /></div>
              <p className="mt-2 text-xs text-slate-400">Values: {faction.personality.needs.map((n) => n === "gear:" ? "weapons & equipment" : n === "gear:furs" ? "warm clothing" : n === "cooked" ? "food" : n).join(", ")}. {faction.kind === "sand" ? "Suspicious and warlike." : faction.kind === "snow" ? "Defensive; loyal once allied." : faction.kind === "tree" ? "Territorial; trust grows slowly." : faction.kind === "sea" ? "Trade-minded; protective of their coast." : "Independent and protective of their clan."}</p>
              <p className="mt-2 text-xs text-slate-400">Allies: {faction.allied ? ["Our tribe", ...faction.allies.map((a) => a.name)].join(", ") : faction.allies.map((a) => a.name).join(", ") || "None"}</p><p className="mt-1 text-xs text-slate-400">Enemies: {[...(faction.war ? ["Our tribe"] : []), ...faction.enemies.map((a) => a.name)].join(", ") || "None"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={button} onClick={() => action("peace")} disabled={!faction.war && faction.score >= 0}>Offer Peace{faction.war && faction.score < -70 ? " · 12 gold" : ""}</button>
              <button className={button} disabled={faction.allied || faction.war || faction.score < 30} onClick={() => action("alliance")}><Shield className="mr-1 inline h-4 w-4" />Ask for Alliance</button>
              {faction.allied && <button className={button} onClick={() => action("break")}>End Alliance</button>}
              {!faction.war && <button className={`${button} text-rose-300`} onClick={() => setWarConfirm(true)}><Swords className="mr-1 inline h-4 w-4" />Declare War</button>}
            </div>
            {warConfirm && <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm"><p>Declare war on {faction.name}? This ends your agreements and recalls caravans.</p><div className="mt-2 flex gap-2"><button className={`${button} text-rose-200`} onClick={() => { action("war"); setWarConfirm(false); }}>Declare War</button><button className={button} onClick={() => setWarConfirm(false)}>Cancel</button></div></div>}
            <div className="rounded-2xl border border-white/10 p-3 sm:p-4">
              <h4 className="mb-3 flex items-center gap-2 font-bold"><Package className="h-4 w-4 text-amber-200" /> Trade & gifts</h4>
              <div className="grid grid-cols-2 gap-2"><label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">We offer<select className={input} value={give} onChange={(e) => setGive(e.target.value as Good)}>{TRADE_GOODS.map((g) => <option key={g.id} value={g.id}>{g.name} ({diplomacy.owned(w, g.id)} owned)</option>)}</select></label>
                <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">We receive<select className={input} value={receive} onChange={(e) => setReceive(e.target.value as Good)}>{TRADE_GOODS.map((g) => <option key={g.id} value={g.id}>{g.name} ({faction.stock[g.id] ?? 0} available)</option>)}</select></label></div>
              <label className="mt-2 flex items-center gap-3 text-xs text-slate-400">Offer quantity<input className={`${input} w-24`} type="number" min={1} max={data.postLevel * 40 || 40} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
              <p className="mt-2 text-sm text-emerald-200">{amount || 0} {TRADE_GOODS.find((g) => g.id === give)?.name} → {quote} {TRADE_GOODS.find((g) => g.id === receive)?.name}</p>
              <p className="mt-1 text-xs text-slate-400">Prices reflect their needs, remaining stock, your alliance and post level. Goods arrive with the caravan; your offer is reserved until delivery.</p>
              <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={!canTrade || !Number.isSafeInteger(amount) || amount <= 0} onClick={() => run(() => diplomacy.trade(w, faction.id, give, amount, receive))}>Send trade caravan</button><button className={button} disabled={faction.war || !data.postLevel || amount <= 0} onClick={() => run(() => diplomacy.trade(w, faction.id, give, amount, receive, true))}>Offer Gift</button></div>
            </div>
            {faction.allied && <div className="rounded-2xl border border-cyan-300/20 p-3"><h4 className="mb-2 font-bold text-cyan-200">Alliance support</h4><p className="mb-3 text-xs text-slate-400">Allies keep defenders at home. Help is limited by trust, available fighters and recovery time.</p><div className="flex flex-wrap gap-2"><button className={button} onClick={() => action("help")}>Ask for Help</button><button className={button} onClick={() => action("supplies")}>Ask for Supplies</button></div>{wars.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Enemy to join war against" className={input} value={enemyId} onChange={(e) => setEnemy(e.target.value as NationId)}>{wars.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><button className={button} onClick={() => action("join")}>Ask to Join War</button></div>}</div>}
            <div><h4 className="mb-2 text-sm font-bold">Recent relations</h4><ul className="space-y-1 text-xs text-slate-400">{faction.history.length ? faction.history.map((h, i) => <li key={`${h.t}:${i}`}>{h.delta !== 0 && <span className={h.delta > 0 ? "text-emerald-300" : "text-rose-300"}>{h.delta > 0 ? "+" : ""}{h.delta} </span>}{h.text}</li>) : <li>No agreements yet.</li>}</ul></div>
          </main>
        </div>}
        {data.caravans.length > 0 && <div className="mt-4 rounded-2xl border border-white/10 p-3"><h4 className="font-bold">Caravans on the road</h4>{data.caravans.map((c) => <button key={c.id} className="mt-2 block text-left text-xs text-slate-300 hover:text-white" onClick={() => engine.flyTo(c.x, c.y, 1)}>📦 {diplomacy.name(w, c.faction)} · {c.phase === "incoming" ? c.gift ? "Collecting gift" : "Approaching post" : "Returning home"} · {c.supplies ? `${c.quantity} ${c.receive} supplies` : `${c.amount} ${c.give} ↔ ${c.quantity} ${c.receive}`}</button>)}</div>}
      </div>
      <footer className="min-h-12 border-t border-white/10 px-5 py-3 text-sm text-amber-100" role="status" aria-live="polite">{message || `Day ${snap.day} · Agreements and caravans are included in your world save.`}</footer>
    </section>
  </div>;
}
