"use client";

/* ------------------------------------------------------------------ */
/*  Character profile: dataset info + lazy Marvel Database enrichment   */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { ARCHETYPE_INFO, specialList } from "../engine/fighters";
import type { FighterDef } from "../engine/types";
import type { Hero } from "../data/roster";
import { loadWikiProfile, type WikiProfile } from "../data/fandom";
import { AlignBadge, ArcadeButton, ArchetypeBadge, Portrait, Radar, StatBars } from "./shared";

const clean = (v: string | string[] | null | undefined) => {
  const s = Array.isArray(v) ? v.filter((x) => x && x !== "-").join(", ") : v ?? "";
  return s && s !== "-" && s !== "null" ? s : "";
};

export default function CharacterDetail({
  fighter,
  hero,
  compareWith,
  onClose,
  onFightAs,
  onFightAgainst,
}: {
  fighter: FighterDef;
  hero?: Hero;
  compareWith?: FighterDef | null;
  onClose: () => void;
  onFightAs: (f: FighterDef) => void;
  onFightAgainst: (f: FighterDef) => void;
}) {
  const [wiki, setWiki] = useState<WikiProfile | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setWiki(undefined);
    if (!hero) {
      setWiki(null);
      return;
    }
    loadWikiProfile(hero.id, hero).then((w) => live && setWiki(w));
    return () => {
      live = false;
    };
  }, [hero]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.code === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const facts: [string, string][] = hero
    ? ([
        ["Real name", clean(hero.biography.fullName)],
        ["Aliases", clean(hero.biography.aliases)],
        ["Born", clean(hero.biography.placeOfBirth)],
        ["First appearance", clean(hero.biography.firstAppearance) || clean(wiki?.first)],
        ["Species", clean(hero.appearance.race)],
        ["Height", clean(hero.appearance.height)],
        ["Weight", clean(hero.appearance.weight)],
        ["Eyes", clean(hero.appearance.eyeColor)],
        ["Hair", clean(hero.appearance.hairColor)],
        ["Occupation", clean(hero.work.occupation)],
        ["Base", clean(hero.work.base)],
        ["Teams", clean(hero.connections.groupAffiliation)],
        ["Family", clean(hero.connections.relatives)],
        ["Citizenship", clean(wiki?.citizenship)],
        ["Education", clean(wiki?.education)],
        ["Identity", clean(wiki?.identity)],
        ["Origin", clean(wiki?.origin)],
        ["Creators", clean(wiki?.creators)],
      ] as [string, string][]).filter(([, v]) => v)
    : [];

  const sections: [string, string | undefined][] = wiki
    ? [
        ["Powers", wiki.powers],
        ["Abilities", wiki.abilities],
        ["Weaknesses", wiki.weaknesses],
        ["Personality", wiki.personality],
        ["Equipment", wiki.equipment],
        ["Weapons", wiki.weapons],
        ["Transportation", wiki.transportation],
      ]
    : [];

  return (
    <div className="absolute inset-0 z-30 flex items-stretch justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div className="mfw-panel mfw-scroll relative flex w-full max-w-5xl flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-2 z-10 text-2xl font-black text-white/60 hover:text-white" aria-label="Close">
          ✕
        </button>
        <div className="grid gap-4 p-4 md:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <div className="relative aspect-[3/4] overflow-hidden border-4 border-black" style={{ background: fighter.look.primary }}>
              <Portrait src={fighter.portrait.lg} alt={fighter.name} className="h-full w-full" color={fighter.look.primary} eager />
            </div>
            <div className="flex flex-col gap-2">
              <ArcadeButton tone="primary" onClick={() => onFightAs(fighter)}>
                Fight as {fighter.name}
              </ArcadeButton>
              <ArcadeButton tone="ghost" onClick={() => onFightAgainst(fighter)}>
                Fight against {fighter.name}
              </ArcadeButton>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="mfw-title text-4xl sm:text-6xl">{fighter.name}</h2>
              <div className="mt-1 text-sm font-bold text-white/70">{fighter.realName}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <AlignBadge a={fighter.alignment} />
                <ArchetypeBadge a={fighter.archetype} />
                {fighter.custom && <span className="text-[10px] font-black text-yellow-300">★ SIGNATURE MOVESET</span>}
              </div>
              {wiki?.quote && <blockquote className="mt-3 border-l-4 border-yellow-400 pl-3 text-sm italic text-white/80">“{wiki.quote}”</blockquote>}
            </div>

            <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
              <Radar stats={fighter.stats} compare={compareWith?.stats} color={fighter.look.primary.startsWith("#") ? fighter.look.primary : "#ef4444"} />
              <div className="space-y-2">
                <StatBars stats={fighter.stats} compare={compareWith?.stats} />
                {compareWith && <p className="text-[11px] text-white/50">White ticks / blue shape: {compareWith.name}</p>}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[11px]">
                  <div className="bg-white/5 p-1.5">
                    <div className="font-black text-yellow-300">{fighter.maxHealth}</div>HP
                  </div>
                  <div className="bg-white/5 p-1.5">
                    <div className="font-black text-yellow-300">{Math.round(fighter.physMul * 100)}%</div>Physical
                  </div>
                  <div className="bg-white/5 p-1.5">
                    <div className="font-black text-yellow-300">{Math.round(fighter.powerMul * 100)}%</div>Power
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-white/5 p-3">
                <div className="mb-1 text-xs font-black uppercase tracking-widest text-yellow-300">In the arena</div>
                <p className="mb-2 text-xs text-white/70">
                  {ARCHETYPE_INFO[fighter.archetype].desc} {fighter.blurb}
                </p>
                {specialList(fighter).map(({ move, input }) => (
                  <div key={move.id} className="flex justify-between gap-2 text-xs">
                    <span className="font-bold">{move.name}</span>
                    <span className="text-white/50">{input}</span>
                  </div>
                ))}
                <div className="mt-2 text-xs">
                  <span className="font-bold text-yellow-200">{fighter.passive.name}:</span> <span className="text-white/70">{fighter.passive.desc}</span>
                </div>
              </div>
              <div className="bg-white/5 p-3 text-xs">
                <div className="mb-1 font-black uppercase tracking-widest text-yellow-300">File</div>
                <dl className="space-y-1">
                  {facts.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[100px_1fr] gap-2">
                      <dt className="text-white/50">{k}</dt>
                      <dd className="line-clamp-3">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {wiki === undefined && <p className="animate-pulse text-xs font-bold uppercase tracking-widest text-white/50">Checking the Marvel Database…</p>}
            {wiki === null && <p className="text-xs text-white/40">No confirmed Marvel Database page for this character — showing the base dataset only.</p>}
            {wiki?.overview && (
              <div>
                <div className="mb-1 text-xs font-black uppercase tracking-widest text-yellow-300">Bio</div>
                <p className="whitespace-pre-line text-sm text-white/80">{wiki.overview}</p>
              </div>
            )}
            {sections
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 text-xs font-black uppercase tracking-widest text-yellow-300">{k}</div>
                  <p className="whitespace-pre-line text-sm text-white/80">{v}</p>
                </div>
              ))}
            {wiki && wiki.gallery.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-black uppercase tracking-widest text-yellow-300">Gallery</div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {wiki.gallery.map((src) => (
                    <Portrait key={src} src={src} alt={fighter.name} className="h-40 w-auto shrink-0 border-2 border-black" />
                  ))}
                </div>
              </div>
            )}
            <p className="border-t border-white/10 pt-2 text-[10px] text-white/40">
              Stats &amp; portraits: open-source Superhero API dataset (akabab/superhero-api).
              {wiki && (
                <>
                  {" "}
                  Profile text &amp; images:{" "}
                  <a href={wiki.url} target="_blank" rel="noreferrer" className="underline hover:text-white/70">
                    Marvel Database on Fandom
                  </a>{" "}
                  (CC BY-SA).
                </>
              )}{" "}
              Fan-made project, not affiliated with or endorsed by Marvel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
