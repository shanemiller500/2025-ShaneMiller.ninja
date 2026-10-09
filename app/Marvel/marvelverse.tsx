"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, BookOpen, Compass, ExternalLink, GitBranch, Maximize2, Minus, Orbit, Plus, Search, Shuffle, Sparkles, Users, X } from "lucide-react";

import { loadBio, type Bio } from "./lib/bio";
import { clean, type Hero } from "./lib/roster";
import { loadRelationPortrait, relationName, type RelationPortrait } from "./lib/relations";
import { RelationProfile } from "./relation-profile";
import { buildUniverseGraph, teamNames, type RelationshipEdge } from "./lib/marvelverse-graph";
import { MarvelverseTimeline } from "./marvelverse-timeline";

type LinkKind = "family" | "team";
export type MarvelverseMode = "map" | "family" | "timeline";
type Connection = { hero: Hero; kind: LinkKind; detail: string; edge: RelationshipEdge };
type Placed = Connection & { x: number; y: number; parentId?: number };
const WIDTH = 1000;
const HEIGHT = 620;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function connectionsFor(hero: Hero, roster: Hero[], graph: ReturnType<typeof buildUniverseGraph>): Connection[] {
  const byId = new Map(roster.map((item) => [item.id, item]));
  const found = new Map<number, Connection>();
  for (const edge of graph.relationships) {
    if (edge.from !== hero.id && edge.to !== hero.id) continue;
    const candidate = byId.get(edge.from === hero.id ? edge.to : edge.from);
    if (!candidate) continue;
    const kind = edge.evidence === "explicit" ? "family" : "team";
    const previous = found.get(candidate.id);
    if (!previous || edge.strength > previous.edge.strength) found.set(candidate.id, { hero: candidate, kind, detail: edge.detail, edge });
  }
  // A shared affiliation connects the focused character to every roster member
  // of that group. The normalized graph uses a sparse chain for global layout.
  const groups = new Set(teamNames(hero.connections.groupAffiliation).map(key));
  for (const candidate of roster) {
    if (candidate.id === hero.id || found.has(candidate.id)) continue;
    const shared = teamNames(candidate.connections.groupAffiliation).find((name) => groups.has(key(name)));
    if (!shared) continue;
    const edge: RelationshipEdge = { id: `shared:${hero.id}:${candidate.id}`, from: hero.id, to: candidate.id, kind: "team", evidence: "inferred", detail: shared, strength: 46 };
    found.set(candidate.id, { hero: candidate, kind: "team", detail: shared, edge });
  }
  return Array.from(found.values()).sort((a, b) => b.edge.strength - a.edge.strength || b.hero.total - a.hero.total);
}

function placedConnections(links: Connection[]): Placed[] {
  const family = links.filter((link) => link.kind === "family");
  const team = links.filter((link) => link.kind === "team");
  return links.map((link) => {
    const set = link.kind === "family" ? family : team;
    const i = set.findIndex((item) => item.hero.id === link.hero.id);
    const start = link.kind === "family" ? Math.PI * 0.72 : -Math.PI * 0.26;
    const sweep = link.kind === "family" ? Math.PI * 0.75 : Math.PI * 1.35;
    const angle = start + (sweep * (i + 0.5)) / Math.max(1, set.length);
    const radius = link.kind === "family" ? 190 : 250 + (i % 2) * 30;
    return { ...link, x: CENTER.x + Math.cos(angle) * radius, y: CENTER.y + Math.sin(angle) * radius };
  });
}

export function MarvelverseTab({ roster, onOpen, requestFocus }: { roster: Hero[]; onOpen: (hero: Hero) => void; requestFocus?: { id: number; nonce: number; mode?: MarvelverseMode } | null }) {
  const [focusId, setFocusId] = useState(() => roster.find((hero) => hero.name === "Spider-Man")?.id ?? roster[0]?.id);
  const [mode, setMode] = useState<MarvelverseMode>("map");
  const [expanded, setExpanded] = useState(false);
  const [inspected, setInspected] = useState<number | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const [bio, setBio] = useState<Bio | null>(null);
  const [extraFamily, setExtraFamily] = useState<{ label: string; portrait: RelationPortrait }[]>([]);
  const [relative, setRelative] = useState<{ label: string; portrait: RelationPortrait } | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | LinkKind>("all");
  const [chapter, setChapter] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const reducedMotion = useReducedMotion();
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const focus = roster.find((hero) => hero.id === focusId) ?? roster[0];

  useEffect(() => {
    if (!requestFocus || !roster.some((hero) => hero.id === requestFocus.id)) return;
    setFocusId(requestFocus.id);
    setMode(requestFocus.mode ?? "map");
    setTrail([]);
  }, [requestFocus?.nonce, roster]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom((value) => Math.min(1.8, Math.max(0.7, +(value + (event.deltaY < 0 ? 0.08 : -0.08)).toFixed(2))));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!focus) return;
    let alive = true;
    setBio(null);
    setLoading(true);
    setChapter(0);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    loadBio(focus).then((result) => { if (alive) setBio(result); }).catch(() => { if (alive) setBio(null); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [focus]);

  useEffect(() => {
    if (!bio) { setExtraFamily([]); return; }
    let alive = true;
    const known = new Set(roster.flatMap((hero) => [key(hero.name), key(clean(hero.biography.fullName))]));
    const names = Array.from(new Set(bio.family.filter((group) => group.label !== "Affiliation").flatMap((group) => group.items).map(relationName))).filter((name) => name.length > 2 && !known.has(key(name))).slice(0, 8);
    Promise.all(names.map(async (label) => ({ label, portrait: await loadRelationPortrait(label) }))).then((items) => { if (alive) setExtraFamily(items.filter((item): item is { label: string; portrait: RelationPortrait } => !!item.portrait)); });
    return () => { alive = false; };
  }, [bio, roster]);

  const graph = useMemo(() => buildUniverseGraph(roster, bio && focus ? new Map([[focus.id, bio]]) : undefined), [roster, bio, focus]);
  const links = useMemo(() => focus ? connectionsFor(focus, roster, graph) : [], [focus, roster, graph]);
  const filtered = links.filter((link) => (mode !== "family" || link.kind === "family") && (filter === "all" || link.kind === filter));
  const shown = useMemo(() => {
    const first = placedConnections(filtered.slice(0, expanded ? 26 : 22));
    if (!expanded) return first;
    const used = new Set([focus?.id, ...first.map((link) => link.hero.id)]);
    const second: Placed[] = [];
    first.slice(0, 12).forEach((anchor) => {
      const branch = connectionsFor(anchor.hero, roster, graph).filter((link) => mode !== "family" || link.kind === "family").filter((link) => !used.has(link.hero.id)).slice(0, 3);
      branch.forEach((link, index) => {
        used.add(link.hero.id);
        const angle = Math.atan2(anchor.y - CENTER.y, anchor.x - CENTER.x) + (index - (branch.length - 1) / 2) * .35;
        second.push({ ...link, x: anchor.x + Math.cos(angle) * 125, y: anchor.y + Math.sin(angle) * 125, parentId: anchor.hero.id });
      });
    });
    return [...first, ...second].slice(0, 60);
  }, [filtered, expanded, focus, roster, graph, mode]);
  const shownExtra = filter === "team" ? [] : extraFamily.map((item, i) => ({ ...item, x: CENTER.x + Math.cos(Math.PI * .72 + Math.PI * .75 * (i + .5) / extraFamily.length) * 270, y: CENTER.y + Math.sin(Math.PI * .72 + Math.PI * .75 * (i + .5) / extraFamily.length) * 270 }));
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? roster.filter((hero) => `${hero.name} ${hero.biography.fullName}`.toLowerCase().includes(term)).slice(0, 7) : [];
  }, [query, roster]);
  if (!focus) return null;
  const firstAppearance = bio?.facts.find((fact) => fact.label === "First appearance")?.value || clean(focus.biography.firstAppearance);
  const activeChapter = bio?.history[Math.min(chapter, Math.max(0, bio.history.length - 1))];
  const inspectedLink = links.find((link) => link.hero.id === inspected);
  const select = (hero: Hero) => { if (hero.id !== focus.id) { setTrail((current) => [...current, focus.id]); setFocusId(hero.id); } setInspected(null); setQuery(""); setPan({ x: 0, y: 0 }); };
  const goBack = () => { const previous = trail[trail.length - 1]; if (previous === undefined) return; setTrail((current) => current.slice(0, -1)); setFocusId(previous); };

  return <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8f7f3] shadow-xl shadow-slate-900/5 dark:border-white/10 dark:bg-[#1a1a1d] dark:shadow-black/20">
    <div className="relative overflow-hidden border-b border-slate-200 px-5 py-6 dark:border-white/10 sm:px-7">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-300/10" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div><p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300"><Sparkles className="h-4 w-4" /> Marvelverse explorer</p><h2 className="mt-2 font-aspekta text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">A universe of connections</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">Follow named relatives, shared affiliations, and source ordered journeys. Every mapped connection carries its evidence.</p></div>
        <span className="rounded-full border border-amber-400/30 bg-amber-300/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-amber-200">{shown.length + shownExtra.length} mapped links</span>
      </div>
      <div className="relative mt-5 flex max-w-xl items-start gap-2">{trail.length > 0 && <button type="button" onClick={goBack} aria-label="Previous character" title="Previous character" className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-700 hover:border-amber-400 dark:border-white/15 dark:bg-[#252529] dark:text-white"><ArrowLeft className="h-4 w-4" /></button>}<div className="relative min-w-0 flex-1"><Search aria-hidden className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a character" aria-label="Find a Marvel character" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 outline-none focus:border-amber-500 dark:border-white/15 dark:bg-[#252529] dark:text-white" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-2 rounded-lg p-1 text-slate-500 hover:bg-black/10 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>}{results.length > 0 && <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/15 dark:bg-[#252529]">{results.map((hero) => <button key={hero.id} type="button" onClick={() => select(hero)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm text-slate-900 hover:bg-amber-50 dark:text-white dark:hover:bg-white/10"><img src={hero.images.sm} alt="" className="h-9 w-9 rounded-md object-cover" /><span>{hero.name}</span></button>)}</div>}</div><button type="button" onClick={() => select(roster[Math.floor(Math.random() * roster.length)])} className="rounded-xl border border-amber-400/40 bg-amber-300/10 p-2.5 text-amber-700 hover:bg-amber-300/20 dark:text-amber-300" title="Surprise me" aria-label="Surprise me"><Shuffle className="h-4 w-4" /></button></div>
      <div className="relative mt-5 grid gap-2 sm:grid-cols-3">{([{ id: "map", label: "Universe Map", icon: Orbit, caption: "Explore the roster network" }, { id: "family", label: "Family Web", icon: Users, caption: "Trace named relatives" }, { id: "timeline", label: "Timeline", icon: GitBranch, caption: "Follow publication and story" }] as const).map((item) => <button key={item.id} type="button" onClick={() => { setMode(item.id); setFilter("all"); }} aria-pressed={mode === item.id} className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${mode === item.id ? "border-amber-400 bg-amber-300/15 shadow-[0_0_24px_rgba(245,158,11,.12)]" : "border-slate-200 bg-white/60 hover:border-amber-400/50 dark:border-white/10 dark:bg-white/[.035]"}`}><item.icon className="h-5 w-5 text-amber-700 transition group-hover:rotate-12 dark:text-amber-300" /><span><strong className="block text-sm text-slate-950 dark:text-white">{item.label}</strong><small className="text-[11px] text-slate-500 dark:text-slate-400">{item.caption}</small></span></button>)}</div>
    </div>
    {mode === "timeline" ? <MarvelverseTimeline roster={roster} focus={focus} bio={bio} onFocus={select} onOpen={onOpen} /> : <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
      <div className="relative min-w-0 border-b border-slate-200 dark:border-white/10 lg:border-b-0 lg:border-r">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6"><div className="flex gap-1" role="group" aria-label="Connection filters">{(["all", "family", "team"] as const).filter((value) => mode !== "family" || value !== "team").map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize transition ${filter === value ? "bg-amber-300 text-slate-950" : "text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"}`}>{value === "team" ? "Teams" : value}</button>)}</div><div className="flex items-center gap-1"><button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)} className="rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10">{expanded ? "Collapse" : "Expand"}</button><button type="button" onClick={() => setZoom((value) => Math.max(0.7, +(value - 0.15).toFixed(2)))} aria-label="Zoom out" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"><Minus className="h-4 w-4" /></button><span className="w-10 text-center font-mono text-[10px] text-slate-500">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.8, +(value + 0.15).toFixed(2)))} aria-label="Zoom in" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset map view" title="Reset map" className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"><Maximize2 className="h-4 w-4" /></button></div></div>
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(251,191,36,.13),transparent_52%)] dark:bg-[radial-gradient(circle_at_center,rgba(251,191,36,.08),transparent_55%)]"><div aria-hidden className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(120,120,120,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(120,120,120,.12)_1px,transparent_1px)] [background-size:32px_32px]" />
          <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Interactive connection map centered on ${focus.name}`} className="relative block h-[420px] w-full touch-none cursor-grab select-none active:cursor-grabbing sm:h-[540px]" onPointerDown={(event) => { if ((event.target as Element).closest("[data-node]")) return; drag.current = { x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y }; svgRef.current?.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current || !svgRef.current) return; const rect = svgRef.current.getBoundingClientRect(); setPan({ x: drag.current.originX + (event.clientX - drag.current.x) * WIDTH / rect.width, y: drag.current.originY + (event.clientY - drag.current.y) * HEIGHT / rect.height }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <g transform={`translate(${CENTER.x + pan.x} ${CENTER.y + pan.y}) scale(${zoom}) translate(${-CENTER.x} ${-CENTER.y})`}><defs><clipPath id="marvelverse-center"><circle cx={CENTER.x} cy={CENTER.y} r="54" /></clipPath>{shown.map((link) => <clipPath key={link.hero.id} id={`marvelverse-${link.hero.id}`}><circle cx={link.x} cy={link.y} r="27" /></clipPath>)}</defs>
              <circle cx={CENTER.x} cy={CENTER.y} r="190" fill="none" stroke="currentColor" strokeOpacity=".08" strokeDasharray="5 9" /><circle cx={CENTER.x} cy={CENTER.y} r="320" fill="none" stroke="currentColor" strokeOpacity=".06" strokeDasharray="3 11" />
              {shown.map((link) => { const parent = shown.find((item) => item.hero.id === link.parentId); const x1 = parent?.x ?? CENTER.x; const y1 = parent?.y ?? CENTER.y; return <g key={`line-${link.hero.id}`}><line x1={x1} y1={y1} x2={link.x} y2={link.y} stroke={link.edge.kind === "partner" ? "#f87171" : link.edge.kind === "sibling" ? "#60a5fa" : link.edge.kind === "alternate" ? "#c084fc" : link.kind === "family" ? "#f59e0b" : "#22d3ee"} strokeOpacity=".55" strokeWidth={link.edge.strength / 42} strokeDasharray={link.edge.evidence === "inferred" || link.edge.kind === "alternate" ? "5 6" : undefined} /><circle cx={(link.x + x1) / 2} cy={(link.y + y1) / 2} r="3" fill={link.kind === "family" ? "#fbbf24" : "#22d3ee"} /></g>; })}
              {shownExtra.map((item) => <line key={`extra-line-${item.label}`} x1={CENTER.x} y1={CENTER.y} x2={item.x} y2={item.y} stroke="#f59e0b" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="4 6" />)}
              {shown.map((link) => <g key={link.hero.id} data-node="true" role="button" tabIndex={0} aria-label={`Inspect ${link.hero.name}, ${link.edge.evidence} ${link.edge.kind} connection: ${link.detail}`} onClick={() => setInspected(link.hero.id)} onDoubleClick={() => select(link.hero)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setInspected(link.hero.id); } }} className="cursor-pointer outline-none"><title>{`${link.hero.name} · ${link.detail}`}</title><circle cx={link.x} cy={link.y} r="32" fill="#27272a" stroke={link.kind === "family" ? "#fbbf24" : "#22d3ee"} strokeWidth={inspected === link.hero.id ? "4" : "2"} /><image href={link.hero.images.sm} x={link.x - 27} y={link.y - 27} width="54" height="54" preserveAspectRatio="xMidYMid slice" clipPath={`url(#marvelverse-${link.hero.id})`} /><rect x={link.x - 63} y={link.y + 37} width="126" height="22" rx="10" fill="#27272a" opacity=".96" /><text x={link.x} y={link.y + 52} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{link.hero.name.length > 17 ? `${link.hero.name.slice(0, 15)}…` : link.hero.name}</text></g>)}
              {shownExtra.map((item) => <g key={item.label} data-node="true" role="button" tabIndex={0} aria-label={`Open ${item.label} family file`} onClick={() => setRelative(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setRelative(item); } }} className="cursor-pointer outline-none"><title>{item.label} · Marvel Database family</title><circle cx={item.x} cy={item.y} r="27" fill="#27272a" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" /><text x={item.x} y={item.y + 5} textAnchor="middle" fill="#fbbf24" fontSize="15" fontWeight="800">{item.label.charAt(0)}</text><rect x={item.x - 57} y={item.y + 34} width="114" height="21" rx="10" fill="#27272a" /><text x={item.x} y={item.y + 48} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{item.label.length > 15 ? `${item.label.slice(0, 13)}…` : item.label}</text></g>)}
              <motion.g key={focus.id} initial={{ opacity: 0, scale: reducedMotion ? 1 : .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : .3 }} style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}><circle cx={CENTER.x} cy={CENTER.y} r="59" fill="#27272a" stroke="#fbbf24" strokeWidth="3" /><motion.circle cx={CENTER.x} cy={CENTER.y} r="66" fill="none" stroke="#fbbf24" strokeOpacity=".35" strokeDasharray="4 8" animate={reducedMotion ? undefined : { rotate: 360 }} transition={reducedMotion ? undefined : { duration: 36, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }} /><image href={focus.images.md} x={CENTER.x - 54} y={CENTER.y - 54} width="108" height="108" preserveAspectRatio="xMidYMid slice" clipPath="url(#marvelverse-center)" /><rect x={CENTER.x - 89} y={CENTER.y + 72} width="178" height="30" rx="14" fill="#27272a" /><text x={CENTER.x} y={CENTER.y + 92} textAnchor="middle" fill="white" fontSize="15" fontWeight="800">{focus.name.length > 20 ? `${focus.name.slice(0, 18)}…` : focus.name}</text></motion.g>
            </g>
          </svg>
          {shown.length + shownExtra.length === 0 && <p className="pointer-events-none absolute bottom-5 inset-x-5 text-center text-xs text-slate-500 dark:text-slate-400">No {filter === "all" ? "mapped roster" : filter} links for this character. Search to jump elsewhere.</p>}
        </div>
        <p className="flex items-center gap-2 px-5 py-3 text-[11px] text-slate-500 dark:text-slate-400"><Compass className="h-3.5 w-3.5" /> Drag to move · scroll to zoom · click to inspect · double click to center</p>
      </div>
      <aside className="min-w-0 px-5 py-5 sm:px-6"><div className="flex items-start gap-4"><img src={focus.images.md} alt="" className="h-24 w-20 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/10" /><div className="min-w-0"><p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Current character</p><h3 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{focus.name}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{clean(focus.biography.fullName) || focus.biography.publisher}</p><button type="button" onClick={() => onOpen(focus)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 hover:text-slate-950 dark:bg-amber-300 dark:text-slate-950 dark:hover:bg-amber-200"><BookOpen className="h-3.5 w-3.5" /> Open character file</button></div></div>
        {inspectedLink && <div className="mt-5 rounded-2xl border border-amber-400/35 bg-amber-300/[.08] p-4"><div className="flex gap-3"><img src={inspectedLink.hero.images.sm} alt="" className="h-16 w-14 rounded-lg object-cover" /><div><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">{inspectedLink.edge.evidence} {inspectedLink.edge.kind}</p><h4 className="text-base font-bold text-slate-950 dark:text-white">{inspectedLink.hero.name}</h4><p className="text-xs text-slate-500 dark:text-slate-400">{clean(inspectedLink.hero.biography.fullName)}</p></div></div><p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{inspectedLink.detail} · display strength {inspectedLink.edge.strength}/100</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => select(inspectedLink.hero)} className="rounded-lg bg-amber-300 px-2.5 py-1.5 text-xs font-bold text-slate-950">Center here</button><button type="button" onClick={() => onOpen(inspectedLink.hero)} className="rounded-lg border border-amber-400/40 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-amber-100">Open profile</button></div></div>}
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10"><p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"><Users className="h-3.5 w-3.5" /> Connection signals</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-amber-400/40 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-800 dark:text-amber-200">{links.filter((link) => link.kind === "family").length + extraFamily.length} named family</span><span className="rounded-full border border-cyan-400/40 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-700 dark:text-cyan-200">{links.filter((link) => link.kind === "team").length} shared affiliation</span></div><p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Solid gold links come from named relatives. Dashed cyan links are inferred from matching affiliations; they do not prove the characters met. Strength controls display weight and is not a canon score.</p><div className="mt-3 max-h-44 space-y-1 overflow-y-auto">{shown.map((link) => <button key={link.hero.id} type="button" onClick={() => setInspected(link.hero.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-amber-300/10 dark:text-slate-200"><span>{link.hero.name}</span><span className="capitalize text-slate-400">{link.edge.kind}</span></button>)}</div></div>
        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10"><p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Character story · source order</p>{loading ? <p className="mt-3 text-sm text-slate-500">Loading chapters…</p> : bio?.history.length ? <><div className="mt-3 flex gap-1.5 overflow-x-auto pb-2">{bio.history.map((item, i) => <button key={`${item.title}-${i}`} type="button" onClick={() => setChapter(i)} aria-pressed={chapter === i} title={item.title} className={`h-2.5 min-w-6 shrink-0 rounded-full transition-all ${chapter === i ? "w-10 bg-amber-400" : "bg-slate-300 hover:bg-amber-300 dark:bg-white/20"}`} />)}</div><p className="mt-1 font-mono text-[10px] text-slate-400">Chapter {Math.min(chapter + 1, bio.history.length)} / {bio.history.length}</p><h4 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{activeChapter?.title}</h4><p className="mt-2 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{activeChapter?.text}</p><div className="mt-3 flex items-center justify-between gap-2"><button type="button" disabled={chapter === 0} onClick={() => setChapter((value) => value - 1)} className="text-xs font-bold text-amber-700 disabled:opacity-30 dark:text-amber-300">Previous</button><button type="button" disabled={chapter >= bio.history.length - 1} onClick={() => setChapter((value) => value + 1)} className="text-xs font-bold text-amber-700 disabled:opacity-30 dark:text-amber-300">Next chapter</button></div></> : <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No detailed history chapters are available for this character.</p>}{firstAppearance && <p className="mt-4 border-l-2 border-amber-400 pl-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300"><span className="block font-mono text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">First appearance</span>{firstAppearance}</p>}{bio?.pageUrl && <a href={bio.pageUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline dark:text-amber-300">Marvel Database source <ExternalLink className="h-3 w-3" /></a>}</div>
      </aside>
    </div>}
    {relative && <RelationProfile key={relative.portrait.page} label={relative.label} portrait={relative.portrait} onBack={() => setRelative(null)} />}
  </section>;
}
