"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, ExternalLink, LayoutDashboard, Users, Zap } from "lucide-react";

import { BioSkeleton, FamilyTreeView } from "./bio-panels";
import { BioTab, ComicOverview, PowersTab } from "./story-panels";
import { loadBioForPage, type Bio } from "./lib/bio";
import { loadGalleryForPage, type GalleryImage } from "./lib/gallery";
import { loadLargeRelationPortrait, relationName, type RelationPortrait } from "./lib/relations";
import type { Hero } from "./lib/roster";

type Section = "overview" | "bio" | "powers" | "family";
const EMPTY_ROSTER = new Map<string, Hero>();

export function RelationProfile({ label, portrait, onBack }: { label: string; portrait: RelationPortrait; onBack: () => void }) {
  const [subject, setSubject] = useState({ label, portrait });
  const [history, setHistory] = useState<{ label: string; portrait: RelationPortrait }[]>([]);
  const [bio, setBio] = useState<Bio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [image, setImage] = useState(subject.portrait.src);
  const [artwork, setArtwork] = useState<GalleryImage[]>([]);
  const [tab, setTab] = useState<Section>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, subject.portrait.page]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    setBio(null);
    setImage(subject.portrait.src);
    setArtwork([]);
    loadBioForPage(subject.portrait.page)
      .then((result) => { if (alive) { setBio(result); setError(!result); } })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    loadLargeRelationPortrait(subject.portrait.page).then((src) => { if (alive && src) setImage(src); }).catch(() => {});
    loadGalleryForPage(subject.portrait.page).then((gallery) => { if (alive) setArtwork(gallery.images); }).catch(() => {});
    return () => { alive = false; };
  }, [subject.portrait.page, subject.portrait.src]);

  const back = () => {
    if (!history.length) { onBack(); return; }
    setSubject(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };
  const name = relationName(subject.label);
  const shownBio = bio?.page === subject.portrait.page ? bio : null;
  const isLoading = loading || (!!bio && !shownBio);
  const storyArt = [{ src: image, alt: name }, ...artwork.map((item) => ({ src: item.full, thumb: item.thumb, alt: item.caption, caption: item.caption, href: item.source }))];
  const tabs = [
    { id: "overview", title: "Overview", icon: LayoutDashboard },
    { id: "bio", title: "Bio", icon: BookOpen },
    { id: "powers", title: "Powers", icon: Zap },
    { id: "family", title: "Family", icon: Users },
  ];

  return (
    <div className="absolute inset-0 z-30 flex min-h-0 flex-col bg-[#f8f7f3] text-slate-950 dark:bg-[#1a1a1d] dark:text-white" role="region" aria-label={`${name} character file`}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-7">
        <button type="button" data-pad-back autoFocus onClick={back} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-amber-300/10 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-amber-300 dark:text-white/80 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> {history.length ? "Previous character" : "Back to family"}
        </button>
        <a href={subject.portrait.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-950 dark:text-white/50 dark:hover:text-white">
          Marvel Database <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="relative h-64 overflow-hidden bg-[#1a1a1d] md:sticky md:top-0 md:h-[calc(100dvh-110px)]">
            <img src={image} alt={name} referrerPolicy="no-referrer" className="relative h-full w-full object-contain" />
          </div>
          <div className="min-w-0 px-5 pb-8 pt-6 sm:px-7">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300">Marvel Database file</p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{name}</h2>
            {shownBio?.realName && shownBio.realName !== name && <p className="mt-1 text-sm text-slate-500 dark:text-white/55">{shownBio.realName}</p>}
            {subject.label !== name && <p className="mt-1 text-xs text-slate-500 dark:text-white/50">{subject.label.slice(name.length).trim()}</p>}
            <div role="tablist" aria-label={`${name} sections`} className="mt-5 flex gap-4 overflow-x-auto border-b border-white/10">
              {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); setTab(item.id as Section); }} className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 py-2 text-xs font-bold uppercase tracking-wide ${tab === item.id ? "border-amber-400 text-slate-950 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-950 dark:text-white/45 dark:hover:text-white"}`}><item.icon aria-hidden="true" className="h-3.5 w-3.5" />{item.title}</button>)}
            </div>
            <div className="pt-5">
              {isLoading && <BioSkeleton lines={6} />}
              {!isLoading && tab === "overview" && (shownBio ? <div className="space-y-5">
                <ComicOverview title={`${name}: overview`} text={shownBio.overview || shownBio.personality || `The Marvel Database file for ${name} has no overview text.`} />
                {shownBio.facts.length > 0 && <dl className="grid gap-3 sm:grid-cols-2">{shownBio.facts.map((fact) => <div key={fact.label} className="border-t border-white/10 pt-2"><dt className="font-mono text-[10px] uppercase text-white/45">{fact.label}</dt><dd className="mt-1 text-sm text-white/85">{fact.value}</dd></div>)}</dl>}
              </div> : <ComicOverview title={`${name}: overview`} text={error ? "Could not load this Marvel Database file right now." : "No overview text is available for this character."} />)}
              {!isLoading && tab === "bio" && <BioTab bio={shownBio} loading={false} error={error} fallbackText={`No additional biography text is available for ${name}.`} art={storyArt} />}
              {!isLoading && tab === "powers" && <PowersTab bio={shownBio} loading={false} error={error} fallbackText={`No powers text is available for ${name}.`} art={storyArt} />}
              {!isLoading && tab === "family" && <FamilyTreeView name={name} realName={shownBio?.realName} portrait={image} family={shownBio?.family ?? []} roster={EMPTY_ROSTER} codenames={shownBio?.codenames} trivia={shownBio?.trivia} onSelectWiki={(nextLabel, nextPortrait) => { setHistory((old) => [...old, subject]); setSubject({ label: nextLabel, portrait: nextPortrait }); setTab("overview"); }} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
