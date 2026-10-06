"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, FolderPlus, Pencil, Play, Star, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { Engine } from "../game/engine";
import { deleteSlot, getSlot, keepSlot, listSlots, putSlot, updateSlot, type SlotMeta } from "../game/slots";

/* ------------------------------------------------------------------ */
/*  Saved games: continue where you left off, jump back to an earlier  */
/*  point in time, save named copies, rename them, sort them into      */
/*  groups, delete them. Loading anything first snapshots the current  */
/*  game, so nothing is ever lost by accident.                         */
/* ------------------------------------------------------------------ */

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
const clock = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")}${hh < 12 ? "am" : "pm"}`;
};

export default function SavedGames({ open, onClose, engine, fontClass, onToast }: { open: boolean; onClose: () => void; engine: Engine; fontClass: string; onToast: (icon: string, text: string) => void }) {
  const [slots, setSlots] = useState<SlotMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("My saves");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => setSlots(await listSlots()), []);
  useEffect(() => {
    if (!open) return;
    void refresh();
    const w = engine.world;
    setName(`Day ${w.day} · ${clock(w.time)}`);
  }, [open, engine, refresh]);

  const groups = useMemo(() => {
    const m = new Map<string, SlotMeta[]>();
    for (const s of slots) {
      if (s.kind === "latest") continue;
      const g = s.group || "My saves";
      m.set(g, [...(m.get(g) ?? []), s]);
    }
    // your own groups first (A→Z), rescued + autosaves last
    return Array.from(m.entries()).sort(([a], [b]) => {
      const rank = (g: string) => (g === "Autosaves" ? 2 : g === "Rescued" ? 1 : 0);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
  }, [slots]);
  const groupNames = useMemo(() => Array.from(new Set(["My saves", ...groups.map(([g]) => g).filter((g) => g !== "Autosaves")])), [groups]);
  const latest = slots.find((s) => s.kind === "latest");

  const saveAs = async () => {
    setBusy(true);
    await putSlot(engine.makeSlot("manual", name.trim() || undefined, group.trim() || "My saves"));
    await putSlot(engine.makeSlot("latest"));
    await refresh();
    setBusy(false);
    onToast("💾", `Saved “${name.trim() || "this game"}”.`);
  };

  const load = async (s: SlotMeta) => {
    setBusy(true);
    // keep the game you're leaving, just in case
    await putSlot(engine.makeSlot("auto", `Before loading “${s.name}”`));
    const full = await getSlot(s.id);
    const ok = !!full && engine.importSave(full.data);
    if (ok) await putSlot(engine.makeSlot("latest"));
    setBusy(false);
    if (ok) {
      onToast("📂", `Loaded “${s.name}” — Day ${s.day}, ${clock(s.time)}.`);
      onClose();
    } else onToast("⚠️", "That save couldn't be opened. Your current game is untouched.");
    await refresh();
  };

  const rename = async (id: string) => {
    const n = editName.trim();
    if (n) await updateSlot(id, { name: n.slice(0, 48) });
    setEditing(null);
    await refresh();
  };

  const move = async (s: SlotMeta, g: string) => {
    const target = g.trim();
    if (!target) return;
    // autosaves get kept (copied) when filed into a group so they're never pruned
    if (s.kind === "auto") await keepSlot(s.id, s.name, target);
    else await updateSlot(s.id, { group: target });
    setMoving(null);
    setNewGroup("");
    await refresh();
  };

  const remove = async (id: string) => {
    await deleteSlot(id);
    setConfirmDel(null);
    await refresh();
  };

  const toggleGroup = (g: string) =>
    setClosed((c) => {
      const n = new Set(c);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  return (
    <Modal open={open} onClose={onClose} size="wide" accent="#f59e0b" labelledBy="dl-saves">
      <div className={`dl-scroll max-h-[82vh] overflow-y-auto p-5 text-slate-800 dark:text-slate-100 sm:p-6 ${fontClass}`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">📂</span>
          <div>
            <h2 id="dl-saves" className="text-2xl font-bold leading-tight">
              Saved games
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your game saves itself every 30 seconds and whenever you leave. It always opens where you left off.</p>
          </div>
        </div>

        {latest && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:ring-emerald-400/20">
            {latest.thumb ? <img src={latest.thumb} alt="" className="h-14 w-24 shrink-0 rounded-xl object-cover" /> : <span className="flex h-14 w-24 items-center justify-center rounded-xl bg-emerald-200/50 text-2xl">🦕</span>}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">▶ Where you left off</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Day {latest.day} · {clock(latest.time)} · {latest.people} people · {latest.level} · saved {ago(latest.savedAt)}
              </div>
            </div>
          </div>
        )}

        <form
          className="mt-4 rounded-2xl bg-slate-100 p-3 dark:bg-white/5"
          onSubmit={(e) => {
            e.preventDefault();
            void saveAs();
          }}
        >
          <div className="text-sm font-bold">💾 Save this game as…</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="Name" aria-label="Save name" className="rounded-xl bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 dark:bg-slate-900 dark:ring-white/10" />
            <input value={group} onChange={(e) => setGroup(e.target.value)} maxLength={32} list="dl-groups" placeholder="Group" aria-label="Group" className="rounded-xl bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 dark:bg-slate-900 dark:ring-white/10" />
            <datalist id="dl-groups">
              {groupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
            <button type="submit" disabled={busy} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-600 active:scale-95 disabled:opacity-50">
              Save
            </button>
          </div>
        </form>

        {groups.length === 0 && <p className="mt-4 text-center text-sm text-slate-500">No saved games yet — autosaves appear here every 5 minutes of play.</p>}

        <div className="mt-4 space-y-3">
          {groups.map(([g, list]) => (
            <section key={g} className="rounded-2xl ring-1 ring-slate-200 dark:ring-white/10">
              <button type="button" onClick={() => toggleGroup(g)} className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5">
                <span>
                  {g === "Autosaves" ? "🕒" : g === "Rescued" ? "🛟" : "📁"} {g} <span className="font-medium text-slate-400">({list.length})</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition ${closed.has(g) ? "-rotate-90" : ""}`} />
              </button>
              {!closed.has(g) && (
                <ul className="space-y-1.5 px-2 pb-2">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-white/5">
                      {s.thumb ? <img src={s.thumb} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" /> : <span className="flex h-12 w-20 items-center justify-center rounded-lg bg-slate-200 text-xl dark:bg-white/10">🦕</span>}
                      <div className="min-w-0 flex-1">
                        {editing === s.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void rename(s.id);
                            }}
                          >
                            <input autoFocus value={editName} maxLength={48} onChange={(e) => setEditName(e.target.value)} onBlur={() => void rename(s.id)} className="w-full rounded-lg bg-white px-2 py-1 text-sm font-bold outline-none ring-2 ring-amber-400 dark:bg-slate-900" />
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(s.id);
                              setEditName(s.name);
                            }}
                            className="group flex items-center gap-1.5 text-left text-sm font-bold"
                            title="Rename"
                          >
                            <span className="truncate">{s.name}</span>
                            <Pencil className="h-3 w-3 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                          </button>
                        )}
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Day {s.day} · {clock(s.time)} · {s.people} people · {s.level} · {ago(s.savedAt)}
                        </div>
                        {moving === s.id && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {groupNames
                              .filter((x) => x !== g)
                              .map((x) => (
                                <button key={x} type="button" onClick={() => void move(s, x)} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-200 hover:ring-amber-400 dark:bg-slate-900 dark:ring-white/10">
                                  📁 {x}
                                </button>
                              ))}
                            <form
                              className="flex items-center gap-1"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void move(s, newGroup);
                              }}
                            >
                              <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} maxLength={32} placeholder="New group…" className="w-28 rounded-full bg-white px-2.5 py-1 text-xs outline-none ring-1 ring-slate-200 focus:ring-amber-400 dark:bg-slate-900 dark:ring-white/10" />
                              <button type="submit" className="rounded-full bg-amber-500 px-2 py-1 text-xs font-bold text-white">
                                Move
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" disabled={busy} onClick={() => void load(s)} className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-600 active:scale-95 disabled:opacity-50">
                          <Play className="h-3.5 w-3.5" /> Load
                        </button>
                        {s.kind === "auto" && (
                          <button type="button" title="Keep this one (copy it into My saves)" onClick={() => void move(s, "My saves")} className="rounded-xl p-1.5 text-slate-500 transition hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-white/10">
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        <button type="button" title="Move to a group" onClick={() => setMoving(moving === s.id ? null : s.id)} className="rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-200 dark:hover:bg-white/10">
                          <FolderPlus className="h-4 w-4" />
                        </button>
                        {confirmDel === s.id ? (
                          <button type="button" onClick={() => void remove(s.id)} className="rounded-xl bg-rose-500 px-2.5 py-1.5 text-xs font-bold text-white">
                            Delete?
                          </button>
                        ) : (
                          <button type="button" title="Delete" onClick={() => setConfirmDel(s.id)} className="rounded-xl p-1.5 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-white/10">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
