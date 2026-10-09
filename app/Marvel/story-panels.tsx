"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Eye, Orbit, ShieldAlert, Sparkles, Swords, Wrench, Zap, type LucideIcon } from "lucide-react";

import type { LightboxImage } from "@/components/ui/lightbox";
import type { Bio } from "./lib/bio";
import { clean, type Hero } from "./lib/roster";

type StoryProps = { bio: Bio | null; loading: boolean; error: boolean; art?: LightboxImage[]; onOpenArt?: (index: number) => void; fallbackText?: string };
const sections: Record<string, { icon: LucideIcon; color: string; glow: string }> = {
  Powers: { icon: Zap, color: "text-amber-200", glow: "from-amber-400/25" },
  Abilities: { icon: Sparkles, color: "text-amber-200", glow: "from-amber-400/15" },
  Weaknesses: { icon: ShieldAlert, color: "text-rose-200", glow: "from-rose-400/25" },
  Equipment: { icon: Wrench, color: "text-violet-200", glow: "from-violet-400/25" },
  Weapons: { icon: Swords, color: "text-orange-200", glow: "from-orange-400/25" },
  Transportation: { icon: Orbit, color: "text-emerald-200", glow: "from-emerald-400/25" },
};

function Fallback({ loading, error, text }: { loading: boolean; error: boolean; text?: string }) {
  return <div className="rounded-2xl border border-amber-300/30 bg-[#fffaf0] p-6 text-sm text-slate-600 dark:bg-[#242428] dark:text-slate-300">
    {loading ? <div className="space-y-3">{["70%", "90%", "55%"].map((width) => <div key={width} className="h-3 animate-pulse rounded bg-white/10" style={{ width }} />)}</div>
      : <><p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Character file</p><p className="mt-3 leading-relaxed">{text || (error ? "The Marvel Database file is unavailable right now." : "No detailed Marvel Database file is available for this character.")}</p></>}
  </div>;
}

function StoryText({ text, comic = false }: { text: string; comic?: boolean }) {
  return <div className={`space-y-4 whitespace-pre-line font-aspekta text-[14px] leading-[1.8] text-slate-700 dark:text-slate-200 ${comic ? "[&_p:first-child::first-letter]:float-left [&_p:first-child::first-letter]:mr-2 [&_p:first-child::first-letter]:text-5xl [&_p:first-child::first-letter]:font-black [&_p:first-child::first-letter]:leading-none [&_p:first-child::first-letter]:text-amber-600 dark:[&_p:first-child::first-letter]:text-amber-300" : ""}`}>{text.split(/\n{2,}/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>;
}

export function ComicOverview({ title, text, kicker = "The character file" }: { title: string; text: string; kicker?: string }) {
  return <article className="relative overflow-hidden rounded-[24px] border border-amber-400/30 bg-[#fffaf0] p-5 shadow-[5px_5px_0_rgba(245,158,11,.13)] dark:bg-[#232326] sm:p-6"><div aria-hidden className="absolute right-0 top-0 h-16 w-16 bg-amber-300/15 [clip-path:polygon(100%_0,0_0,100%_100%)]" /><p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">{kicker}</p><h3 className="mt-2 font-aspekta text-2xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h3><div className="mt-4 border-t border-amber-400/25 pt-4"><StoryText text={text} comic /></div></article>;
}

export function rosterOverview(hero: Hero) {
  const lines = [
    clean(hero.biography.fullName) && `Identity: ${clean(hero.biography.fullName)}.`,
    clean(hero.work.occupation) && `Occupation: ${clean(hero.work.occupation)}.`,
    clean(hero.work.base) && `Base: ${clean(hero.work.base)}.`,
    clean(hero.connections.groupAffiliation) && `Affiliations: ${clean(hero.connections.groupAffiliation)}.`,
    clean(hero.biography.firstAppearance) && `First appearance: ${clean(hero.biography.firstAppearance)}.`,
  ].filter(Boolean);
  return lines.length ? lines.join("\n\n") : `${hero.name} appears in the Marvel Comics roster. More story details are not available in this character file.`;
}

function StoryArt({ art, index, onOpenArt, className = "" }: { art: LightboxImage[]; index: number; onOpenArt?: (index: number) => void; className?: string }) {
  const image = art[index % art.length];
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [image?.src]);
  if (!image || broken) return <div className={`relative overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,.07),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(251,191,36,.14),transparent_50%),#1a1a1d] ${className}`}><div aria-hidden className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "24px 24px" }} /></div>;
  return <div className={`relative overflow-hidden bg-[#1a1a1d] ${className}`}>
    <img src={image.thumb ?? image.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="relative h-full w-full object-contain" />
    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#1a1a1d] via-transparent to-transparent" />
    <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/75">Character gallery art</span>
      {onOpenArt ? <button type="button" onClick={() => onOpenArt(index)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur hover:border-amber-300 hover:bg-amber-300/10"><Eye className="h-3 w-3" /> View art</button>
        : image.href && <a href={image.href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur hover:border-amber-300"><ExternalLink className="h-3 w-3" /> Art source</a>}
    </div>
  </div>;
}

export function BioTab({ bio, loading, error, art = [], onOpenArt, fallbackText }: StoryProps) {
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(true);
  const rail = useRef<HTMLOListElement>(null);
  useEffect(() => setActive(0), [bio?.page]);
  useEffect(() => { if (!showAll) rail.current?.querySelector<HTMLElement>(`[data-chapter="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }, [active, showAll]);
  if (loading || !bio) return <Fallback loading={loading} error={error} text={fallbackText} />;
  const chapters = bio.history;
  const index = Math.min(active, Math.max(0, chapters.length - 1));
  const chapter = chapters[index];
  return <div className="overflow-hidden rounded-[26px] border border-amber-400/25 bg-[#fffaf0] text-slate-950 shadow-[0_24px_65px_rgba(0,0,0,.12)] dark:bg-[#1a1a1d] dark:text-white">
    <div className="relative overflow-hidden border-b border-white/10 px-5 py-5 sm:px-6">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-amber-300/5 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div><p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300"><BookOpen className="h-3.5 w-3.5" /> Marvel world timeline</p><h3 className="mt-2 font-aspekta text-2xl font-black tracking-tight sm:text-3xl">The story so far</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Explore {chapters.length} chapters in source order. Gallery art is illustrative.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => setShowAll(!showAll)} aria-pressed={showAll} className="rounded-lg border border-amber-400/35 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">{showAll ? "Chapter focus" : "Read all chapters"}</button><a href={bio.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 hover:border-amber-300/40 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:text-white">Source file <ExternalLink className="h-3 w-3" /></a></div>
      </div>
    </div>
    {showAll && chapters.length > 0 ? <div className="space-y-4 p-4 sm:p-6">{chapters.map((item, index) => <motion.article key={`${item.title}-${index}`} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .1 }} transition={{ duration: .25 }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white/75 shadow-[4px_4px_0_rgba(245,158,11,.07)] dark:border-white/10 dark:bg-white/[.035]"><div className="grid md:grid-cols-[minmax(0,1fr)_minmax(150px,27%)]"><div className="min-w-0 p-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-amber-700 dark:text-amber-300">Chapter {String(index + 1).padStart(2, "0")}</p><h4 className="mt-2 font-aspekta text-xl font-black tracking-tight">{item.title}</h4><div className="mt-4"><StoryText text={item.text} comic /></div></div>{art.length > 0 && <StoryArt art={art} index={index % art.length} onOpenArt={onOpenArt} className="min-h-44" />}</div></motion.article>)}</div> : chapter ? <>
      <ol ref={rail} className="relative flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-4 before:pointer-events-none before:absolute before:left-0 before:right-0 before:top-1/2 before:h-px before:bg-amber-300/25 sm:px-6" aria-label="Story chapters">
        {chapters.map((item, i) => <li key={`${item.title}-${i}`} className="relative z-10 shrink-0"><button type="button" data-chapter={i} aria-current={i === index ? "step" : undefined} onClick={() => setActive(i)} className={`group flex max-w-48 items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${i === index ? "border-amber-300/60 bg-amber-300/15 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,.08)] dark:text-white" : "border-slate-200 bg-white/80 text-slate-600 hover:border-amber-300 dark:border-white/10 dark:bg-[#242428] dark:text-slate-400 dark:hover:text-white"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${i === index ? "bg-amber-300 text-slate-950" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}>{String(i + 1).padStart(2, "0")}</span><span className="truncate text-[11px] font-semibold">{item.title}</span></button></li>)}
      </ol>
      <AnimatePresence mode="wait" initial={false}><motion.article key={`${bio.page}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .18 }} className="grid md:grid-cols-[minmax(0,1fr)_minmax(180px,34%)]">
        <div className="min-w-0 px-5 py-5 sm:px-6"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Chapter {String(index + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</p><h4 className="mt-2 font-aspekta text-xl font-black tracking-tight text-slate-950 dark:text-white">{chapter.title}</h4><div className="mt-4"><StoryText key={`${bio.page}-${index}`} text={chapter.text} comic /></div></div>
        <StoryArt art={art} index={index % (art.length || 1)} onOpenArt={onOpenArt} className="min-h-44 md:min-h-72" />
      </motion.article></AnimatePresence>
      <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3 sm:px-6"><button type="button" disabled={index === 0} onClick={() => setActive(index - 1)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-30 dark:text-amber-200"><ArrowLeft className="h-3.5 w-3.5" /> Previous</button><div aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${((index + 1) / chapters.length) * 100}%` }} /></div><button type="button" disabled={index === chapters.length - 1} onClick={() => setActive(index + 1)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-30 dark:text-amber-200">Next <ArrowRight className="h-3.5 w-3.5" /></button></div>
    </> : <div className="p-5 sm:p-6"><ComicOverview title="The story" text={bio.overview || bio.personality || "No history chapters are available for this character."} /></div>}
    {bio.personality && <div className="border-t border-white/10 bg-amber-300/[0.035] px-5 py-5 sm:px-6"><p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200"><Sparkles className="h-3.5 w-3.5" /> Character profile</p><StoryText text={bio.personality} /></div>}
  </div>;
}

export function PowersTab({ bio, loading, error, art = [], onOpenArt, fallbackText }: StoryProps) {
  const [category, setCategory] = useState(0);
  const [selected, setSelected] = useState(0);
  useEffect(() => { setCategory(0); setSelected(0); }, [bio?.page]);
  if (loading || !bio?.powers.length) return <Fallback loading={loading} error={error} text={fallbackText} />;
  const section = bio.powers[Math.min(category, bio.powers.length - 1)];
  const config = sections[section.title] ?? sections.Powers;
  const Icon = config.icon;
  const picked = section.items[Math.min(selected, Math.max(0, section.items.length - 1))];
  return <div className="overflow-hidden rounded-[26px] border border-amber-400/25 bg-[#fffaf0] text-slate-950 shadow-[0_24px_65px_rgba(0,0,0,.12)] dark:bg-[#1a1a1d] dark:text-white">
    <div className="relative overflow-hidden border-b border-white/10 px-5 py-5 sm:px-6">
      <div className={`pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-b ${config.glow} to-transparent blur-3xl`} />
      <div className="relative flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300"><Zap className="h-3.5 w-3.5" /> Capability matrix</p><h3 className="mt-2 font-aspekta text-2xl font-black tracking-tight sm:text-3xl">Powers & abilities</h3></div><span className="rounded-lg border border-amber-300/20 bg-amber-300/5 px-2.5 py-1.5 font-mono text-[10px] text-amber-800 dark:text-amber-200">{bio.powers.reduce((sum, item) => sum + item.items.length, 0)} records</span></div>
    </div>
    <div role="tablist" aria-label="Capability categories" className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 sm:px-6">{bio.powers.map((item, i) => { const SIcon = (sections[item.title] ?? sections.Powers).icon; return <button key={item.title} type="button" role="tab" aria-selected={category === i} onClick={() => { setCategory(i); setSelected(0); }} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${category === i ? "border-amber-300/60 bg-amber-300/15 text-amber-900 dark:text-amber-100" : "border-slate-200 text-slate-600 hover:border-amber-300 dark:border-white/10 dark:text-slate-400 dark:hover:text-white"}`}><SIcon className="h-3.5 w-3.5" />{item.title}<span className="opacity-50">{item.items.length}</span></button>; })}</div>
    <div className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(190px,34%)]">
      <div className="min-w-0 p-4 sm:p-6"><p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200"><Icon className="h-4 w-4" />{section.title}</p>{section.intro && <div className="mt-3"><StoryText key={section.title} text={section.intro} /></div>}
        {section.items.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2">{section.items.map((item, i) => <button key={`${item.name}-${i}`} type="button" aria-pressed={selected === i} onClick={() => setSelected(i)} className={`group min-w-0 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${selected === i ? "border-amber-400/70 bg-amber-300/10 shadow-[0_0_22px_rgba(251,191,36,.09)]" : "border-slate-200 bg-white/75 hover:border-amber-300/40 hover:bg-amber-300/5 dark:border-white/10 dark:bg-white/[0.025]"}`}><span className="flex items-start gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300/15 text-amber-700 dark:text-amber-200"><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block break-words text-[12px] font-bold text-slate-950 dark:text-white">{item.name || `${section.title} ${i + 1}`}</span>{item.text && <span className="mt-1 block line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">{item.text}</span>}</span></span></button>)}</div>}
      </div>
      <StoryArt art={art} index={(category + 1) % (art.length || 1)} onOpenArt={onOpenArt} className="min-h-48 lg:min-h-full" />
    </div>
    {picked && <div className="border-t border-slate-200 bg-amber-300/[0.05] px-5 py-5 dark:border-white/10 dark:bg-[#242428] sm:px-6"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Selected capability / {String(selected + 1).padStart(2, "0")}</p><h4 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{picked.name || `${section.title} ${selected + 1}`}</h4><div className="mt-3">{picked.text ? <StoryText key={`${section.title}-${selected}`} text={picked.text} /> : <p className="text-sm text-slate-500 dark:text-slate-400">No further description is available in the source file.</p>}</div></div>}
  </div>;
}
