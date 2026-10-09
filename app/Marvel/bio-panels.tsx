"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, BriefcaseBusiness, Dna, ExternalLink, Eye, Fingerprint,
  Flag, GraduationCap, Heart, House, Info, MapPin, Orbit, PenLine, Quote,
  Ruler, Scissors, Sparkles, UserRound,
  type LucideIcon,
} from "lucide-react";

import { loadBio, type Bio } from "./lib/bio";
import { clean, splitList, type Hero } from "./lib/roster";
import { loadRelationPortrait, relationName, relationRoster, rosterRelative, type RelationPortrait } from "./lib/relations";

const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/*  Data hook                                                          */
/* ------------------------------------------------------------------ */
export function useBio(hero: Hero | null) {
  const [state, setState] = useState<{ loading: boolean; bio: Bio | null; error: boolean }>({ loading: false, bio: null, error: false });
  useEffect(() => {
    if (!hero) return;
    let alive = true;
    setState({ loading: true, bio: null, error: false });
    loadBio(hero)
      .then((bio) => alive && setState({ loading: false, bio, error: false }))
      .catch(() => alive && setState({ loading: false, bio: null, error: true }));
    return () => {
      alive = false;
    };
  }, [hero]);
  return state;
}

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
export function Label({ icon: Icon, children, right }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {Icon && <Icon className="h-3 w-3" />}
        {children}
      </p>
      {right}
    </div>
  );
}

export function WikiLink({ href, children = "Marvel Database" }: { href: string; children?: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:text-amber-600 dark:hover:text-amber-300">
      {children} <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

/** Paragraphs with a "Read more" fold after `limit` characters. */
export function ReadMore({ text, limit = 600, className = "" }: { text: string; limit?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  const shown = !long || open ? text : `${text.slice(0, text.lastIndexOf(" ", limit))}…`;
  return (
    <div className={className}>
      <div className="space-y-3 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        {shown.split(/\n{2,}/).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-xs font-medium text-amber-600 hover:underline dark:text-amber-300">
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export function BioSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" style={{ width: `${92 - ((i * 13) % 35)}%`, animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  );
}

export function NoBio({ error }: { error?: boolean }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-[12px] text-slate-400 dark:border-white/10">
      {error ? "Couldn't reach the Marvel Database right now." : "No Marvel Database file found for this character, so only the core stats are available."}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview pieces                                                    */
/* ------------------------------------------------------------------ */
export function QuoteCard({ bio, accent }: { bio: Bio; accent: string }) {
  if (!bio.quote) return null;
  return (
    <figure className="relative mt-5 overflow-hidden rounded-2xl border border-slate-200/70 p-4 pl-11 dark:border-white/[0.08]">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <Quote aria-hidden className="absolute left-4 top-4 h-4 w-4 text-slate-300 dark:text-slate-600" />
      <blockquote className="text-[13px] italic leading-relaxed text-slate-700 dark:text-slate-200">
        {bio.quote.text.length > 360 ? `${bio.quote.text.slice(0, bio.quote.text.lastIndexOf(" ", 360))}…` : bio.quote.text}
      </blockquote>
      {bio.quote.speaker && <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">— {bio.quote.speaker}</figcaption>}
    </figure>
  );
}

/** Wiki facts first, then dataset facts the wiki didn't cover. */
const FACT_ICONS: Record<string, LucideIcon> = {
  Identity: Fingerprint,
  Citizenship: Flag,
  "Marital status": Heart,
  Education: GraduationCap,
  Origin: Sparkles,
  Universe: Orbit,
  Gender: UserRound,
  Eyes: Eye,
  Hair: Scissors,
  "Unusual features": Sparkles,
  "Created by": PenLine,
  "First appearance": BookOpen,
  "Place of birth": MapPin,
  Occupation: BriefcaseBusiness,
  Base: House,
  Species: Dna,
  "Height · weight": Ruler,
};

export function FactsGrid({ hero, bio }: { hero: Hero; bio: Bio | null }) {
  const facts: { label: string; value: string }[] = [...(bio?.facts ?? [])].filter((f) => f.label !== "Real name" && f.label !== "Current alias");
  const has = (l: string) => facts.some((f) => f.label === l);
  const add = (label: string, value: string) => {
    if (value && !has(label)) facts.push({ label, value });
  };
  if (!bio) add("First appearance", clean(hero.biography.firstAppearance));
  add("Place of birth", clean(hero.biography.placeOfBirth));
  add("Occupation", clean(hero.work.occupation));
  add("Base", clean(hero.work.base));
  add("Species", clean(hero.appearance.race));
  add("Height · weight", [hero.appearance.height?.[1], hero.appearance.weight?.[1]].map(clean).filter((v) => v && !/^0 /.test(v)).join(" · "));
  if (!bio) {
    add("Eyes", clean(hero.appearance.eyeColor));
    add("Hair", clean(hero.appearance.hairColor));
  }

  return (
    <dl className="grid gap-x-6 sm:grid-cols-2">
      {facts.map((f) => {
        const Icon = FACT_ICONS[f.label] ?? Info;
        return (
          <div key={f.label} className="min-w-0 border-b border-slate-100 py-2.5 dark:border-white/[0.05]">
            <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
              {f.label}
            </dt>
            <dd className="mt-1 break-words text-[13px] text-slate-800 dark:text-slate-200">{f.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/*  Family tab — relatives, affiliations, codenames, trivia            */
/* ------------------------------------------------------------------ */
function RelativeItem({ label, roster, onSelect, onSelectWiki, lookupImage, category }: { label: string; roster: Map<string, Hero>; onSelect?: (hero: Hero) => void; onSelectWiki?: (label: string, portrait: RelationPortrait) => void; lookupImage: boolean; category?: string }) {
  const match = rosterRelative(label, roster);
  const [wikiImage, setWikiImage] = useState<RelationPortrait | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (match || !lookupImage) return;
    let alive = true;
    loadRelationPortrait(label).then((image) => { if (alive) setWikiImage(image); });
    return () => { alive = false; };
  }, [label, match, lookupImage]);

  const src = match?.images.sm ?? wikiImage?.src;
  const name = relationName(label);
  const body = <>
    {src && !broken ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-14 w-14 shrink-0 rounded-lg object-cover object-top ring-1 ring-amber-300/20" />
      : <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-amber-300/10 font-bold text-amber-700 dark:text-amber-200/70 ring-1 ring-amber-300/15">{name.charAt(0)}</span>}
    <span className="min-w-0 text-left">
      {category && <span className="mb-0.5 block font-mono text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300/65">{category}</span>}
      <span className="block break-words text-[12px] font-bold leading-tight text-slate-950 dark:text-white">{name}</span>
      {name !== label && <span className="mt-1 block text-[10px] leading-snug text-slate-500 dark:text-slate-400">{label.slice(name.length).trim()}</span>}
    </span>
  </>;
  const style = "group relative flex min-h-[72px] w-full items-center gap-2.5 overflow-hidden rounded-xl border border-amber-500/20 bg-white p-2 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:shadow-[0_0_22px_rgba(251,191,36,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 before:absolute before:inset-y-3 before:left-0 before:w-[2px] before:bg-amber-300/50 dark:border-white/10 dark:bg-[#242428] dark:hover:bg-[#2b2b30]";
  if (match && onSelect) return <button type="button" onClick={() => onSelect(match)} aria-label={`View ${match.name}`} className={style}>{body}</button>;
  if (wikiImage && onSelectWiki) return <button type="button" onClick={() => onSelectWiki(label, wikiImage)} className={style} aria-label={`View ${relationName(label)} character file`}>{body}</button>;
  if (wikiImage) return <a href={wikiImage.href} target="_blank" rel="noopener noreferrer" className={style} aria-label={`View ${relationName(label)} on Marvel Database`}>{body}</a>;
  return <span className={style}>{body}</span>;
}

function datasetFamily(relatives: string) {
  const result: { label: string; items: string[] }[] = [];
  const source = clean(relatives);
  if (!source) return result;
  const add = (label: string, item: string) => {
    let group = result.find((g) => g.label === label);
    if (!group) { group = { label, items: [] }; result.push(group); }
    group.items.push(item);
  };
  let depth = 0;
  let current = "";
  const items: string[] = [];
  for (const char of source) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if ((char === "," || char === ";") && depth === 0) { if (current.trim()) items.push(current.trim()); current = ""; }
    else current += char;
  }
  if (current.trim()) items.push(current.trim());
  for (const item of items.slice(0, 24)) {
    const role = item.match(/\(([^)]*)\)/)?.[1]?.toLowerCase() ?? "";
    const group = /grand(?:father|mother|parent)/.test(role) ? "Grandparents"
      : /father|mother|parent/.test(role) ? "Parents"
      : /brother|sister|sibling/.test(role) ? "Siblings"
      : /wife|husband|spouse/.test(role) ? "Spouses"
      : /son|daughter|child/.test(role) ? "Children" : "Relatives";
    add(group, item);
  }
  return result;
}

function TreeGroup({ title, items, roster, onSelect, onSelectWiki, stack = false }: { title: string; items: string[]; roster: Map<string, Hero>; onSelect?: (hero: Hero) => void; onSelectWiki?: (label: string, portrait: RelationPortrait) => void; stack?: boolean }) {
  if (!items.length) return null;
  return <div className="min-w-0">
    <p className="mb-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200/65">{title} <span className="ml-1 text-amber-700 dark:text-amber-300/35">/ {String(items.length).padStart(2, "0")}</span></p>
    <ul className={cn("flex flex-wrap justify-center gap-2", stack && "flex-col")}>
      {items.map((item) => <li key={item} className={cn("min-w-0", stack ? "w-full" : "w-full sm:min-w-[180px] sm:max-w-[260px] sm:flex-[1_1_180px]")}><RelativeItem label={item} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} lookupImage /></li>)}
    </ul>
  </div>;
}

function TreeLink() {
  return <div aria-hidden className="relative mx-auto h-9 w-px bg-gradient-to-b from-amber-300/70 to-amber-300/65"><span className="absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]" /></div>;
}

export function FamilyTreeView({ name, realName, portrait, family, roster, onSelect, onSelectWiki, teams = [], codenames = [], trivia = [] }: { name: string; realName?: string; portrait: string; family: { label: string; items: string[] }[]; roster: Map<string, Hero>; onSelect?: (hero: Hero) => void; onSelectWiki?: (label: string, portrait: RelationPortrait) => void; teams?: string[]; codenames?: string[]; trivia?: string[] }) {
  const items = (label: string) => family.find((g) => g.label === label)?.items ?? [];
  const extra = family.filter((g) => !["Grandparents", "Parents", "Siblings", "Spouses", "Children", "Affiliation"].includes(g.label));
  const extended = extra.flatMap((group) => group.items.map((item) => ({ group: group.label, item })));
  const densePeers = items("Siblings").length > 2 || items("Spouses").length > 2;
  const peers = [
    ...items("Siblings").map((item) => ({ group: "Sibling", item })),
    ...items("Spouses").map((item) => ({ group: "Spouse / partner", item })),
  ];
  const affiliations = Array.from(new Set([...items("Affiliation"), ...teams]));
  const count = family.filter((g) => g.label !== "Affiliation").reduce((sum, group) => sum + group.items.length, 0);
  return <section className="relative isolate overflow-hidden rounded-[26px] border border-amber-500/20 bg-[#fffaf0] text-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#1a1a1d] dark:text-white">
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "28px 28px", maskImage: "linear-gradient(to bottom, black, transparent 78%)" }} />
    <div aria-hidden className="pointer-events-none absolute -top-28 left-1/2 h-80 w-[32rem] -translate-x-1/2 rounded-full bg-amber-300/5 blur-[80px]" />
    <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.025] px-4 py-3 sm:px-6">
      <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]" /> Family network</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-100/45">{count} {count === 1 ? "connection" : "connections"} mapped</p>
    </div>
    <div className="relative px-3 pb-7 pt-6 sm:px-6">
      {items("Grandparents").length > 0 && <div className="mx-auto max-w-3xl"><TreeGroup title="Grandparents" items={items("Grandparents")} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} /><TreeLink /></div>}
      {items("Parents").length > 0 && <div className="mx-auto max-w-3xl"><TreeGroup title="Parents" items={items("Parents")} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} /><TreeLink /></div>}
      <div className={cn("relative grid items-center gap-5", !densePeers && "lg:grid-cols-[minmax(0,1fr)_minmax(180px,230px)_minmax(0,1fr)]")}>
        {!densePeers && (items("Siblings").length > 0 || items("Spouses").length > 0) && <div aria-hidden className="pointer-events-none absolute inset-x-[11%] top-1/2 hidden h-px bg-gradient-to-r from-amber-300/15 via-amber-300/65 to-amber-300/15 lg:block" />}
        {!densePeers && (items("Siblings").length > 0 || items("Spouses").length > 0) && <div aria-hidden className="pointer-events-none absolute bottom-6 left-1/2 top-20 w-px bg-gradient-to-b from-amber-300/60 via-amber-300/55 to-amber-300/15 lg:hidden" />}
        {!densePeers && <div className="relative z-10 order-2 lg:order-1"><TreeGroup title="Siblings" items={items("Siblings")} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} stack /></div>}
        <div className="relative z-10 order-1 mx-auto w-full max-w-[230px] overflow-hidden rounded-2xl border border-amber-400/70 bg-white p-2 text-center shadow-[0_0_35px_rgba(251,191,36,0.16)] dark:bg-gradient-to-b dark:from-[#2b261f] dark:via-[#242428] dark:to-[#1a1a1d] lg:order-2">
          <div className="relative overflow-hidden rounded-xl bg-black/30">
            <img src={portrait} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="mx-auto h-36 w-full object-contain object-top" />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#242428] to-transparent" />
          </div>
          <p className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Core identity</p>
          <p className="mt-0.5 text-base font-black uppercase tracking-tight text-slate-950 dark:text-white">{name}</p>
          {realName && realName !== name && <p className="truncate px-2 pb-2 text-[11px] text-slate-500 dark:text-slate-400">{realName}</p>}
        </div>
        {!densePeers && <div className="relative z-10 order-3"><TreeGroup title="Spouses & partners" items={items("Spouses")} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} stack /></div>}
      </div>
      {densePeers && <div className="mx-auto mt-5 max-w-3xl"><TreeLink /><p className="mb-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200/65">Siblings & partners / {String(peers.length).padStart(2, "0")}</p><ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 205px), 1fr))" }}>{peers.map(({ group, item }) => <li key={`${group}-${item}`} className="min-w-0"><RelativeItem label={item} category={group} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} lookupImage /></li>)}</ul></div>}
      {items("Children").length > 0 && <div className="mx-auto max-w-3xl"><TreeLink /><TreeGroup title="Children" items={items("Children")} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} /></div>}
      {extended.length > 0 && <div className="mt-7 border-t border-amber-200/10 pt-5"><p className="mb-4 text-center font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300/55">Extended lineage / {String(extended.length).padStart(2, "0")}</p><ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 205px), 1fr))" }}>{extended.map(({ group, item }) => <li key={`${group}-${item}`} className="min-w-0"><RelativeItem label={item} category={group} roster={roster} onSelect={onSelect} onSelectWiki={onSelectWiki} lookupImage /></li>)}</ul></div>}
    </div>
    {(affiliations.length > 0 || codenames.length > 0 || trivia.length > 0) && <div className="relative border-t border-amber-500/15 bg-amber-300/[0.04] px-4 py-5 dark:border-white/10 dark:bg-[#202024] sm:px-6">
      {affiliations.length > 0 && <div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200/55">Affiliations & teams</p><div className="mt-2 flex flex-wrap gap-1.5">{affiliations.map((item) => <span key={item} className="rounded-md border border-amber-200/15 bg-amber-100/[0.035] px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300">{item}</span>)}</div></div>}
      {codenames.length > 0 && <div className="mt-4 border-t border-amber-200/10 pt-3"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200/55">Known aliases</p><p className="mt-1.5 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{codenames.join(" · ")}</p></div>}
      {trivia.length > 0 && <details className="mt-4 border-t border-amber-200/10 pt-3"><summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200/70">Field notes / {trivia.length}</summary><ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">{trivia.map((item) => <li key={item} className="border-l border-amber-300/45 pl-3">{item}</li>)}</ul></details>}
    </div>}
  </section>;
}

export function FamilyTab({ hero, bio, loading, roster = [], onSelect, onSelectWiki }: { hero: Hero; bio: Bio | null; loading: boolean; roster?: Iterable<Hero>; onSelect?: (hero: Hero) => void; onSelectWiki?: (label: string, portrait: RelationPortrait) => void }) {
  const relatives = useMemo(() => relationRoster(roster), [roster]);
  if (loading) return <BioSkeleton lines={8} />;
  return <FamilyTreeView
    name={hero.name}
    realName={clean(hero.biography.fullName)}
    portrait={hero.images.sm}
    family={bio?.family.length ? bio.family : datasetFamily(hero.connections.relatives)}
    roster={relatives}
    onSelect={onSelect}
    onSelectWiki={onSelectWiki}
    teams={splitList(hero.connections.groupAffiliation, 14)}
    codenames={bio?.codenames.length ? bio.codenames : hero.biography.aliases.map(clean).filter(Boolean)}
    trivia={bio?.trivia}
  />;
}
