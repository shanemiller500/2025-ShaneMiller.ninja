"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Swords, X } from "lucide-react";

import { BioSkeleton, BioTab, FactsGrid, FamilyTab, PowersTab, ReadMore, useBio } from "@/app/Marvel/bio-panels";
import { loadGallery, type Gallery } from "@/app/Marvel/lib/gallery";
import type { Hero } from "@/app/Marvel/lib/roster";
import { Lightbox, type LightboxImage } from "@/components/ui/lightbox";
import { ARCHETYPE_INFO } from "../engine/fighters";
import type { FighterDef } from "../engine/types";
import type { Settings } from "../data/storage";
import { HowToPlay, MoveGuide } from "./MoveGuide";
import { AlignmentChip, ArcadeButton, ArchetypeChip, StatBars, StatRadar, cn } from "./kit";

type Tab = "overview" | "how" | "moves" | "bio" | "powers" | "family" | "gallery";

export function CharacterSheet({
  def,
  settings,
  hero,
  onClose,
  onFightAs,
  onFightAgainst,
}: {
  def: FighterDef;
  settings: Settings;
  hero: Hero | undefined;
  onClose: () => void;
  onFightAs?: (d: FighterDef) => void;
  onFightAgainst?: (d: FighterDef) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { bio, loading, error } = useBio(hero ?? null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [galLoading, setGalLoading] = useState(true);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    if (!hero) {
      setGalLoading(false);
      return;
    }
    let alive = true;
    loadGallery(hero)
      .then((g) => alive && setGallery(g))
      .catch(() => alive && setGallery(null))
      .finally(() => alive && setGalLoading(false));
    return () => {
      alive = false;
    };
  }, [hero]);

  useEffect(() => {
    // Capture phase: the sheet owns the keyboard while open, so screens
    // underneath (world, select grid) never see Esc / movement keys.
    // The lightbox handles (and stops) its own keys while it is open.
    const onKey = (e: KeyboardEvent) => {
      if (viewer !== null) return;
      e.stopImmediatePropagation();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, viewer]);

  const images: LightboxImage[] = [
    { src: def.portrait.lg, thumb: def.portrait.sm, alt: def.name, caption: `${def.name} · portrait` },
    ...(gallery?.images ?? []).map((im) => ({ src: im.full, thumb: im.thumb, alt: im.caption, caption: im.caption, href: im.source })),
  ];

  const TABS: [Tab, string, number?][] = [
    ["overview", "Overview"],
    ["how", "How to Play"],
    ["moves", "Moves"],
    ["bio", "Bio", bio?.history.length],
    ["powers", "Powers", bio?.powers.reduce((n, s) => n + s.items.length, 0)],
    ["family", "Family"],
    ["gallery", "Gallery", gallery?.images.length],
  ];

  return (
    <motion.div data-pad-menu initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40 flex bg-black/80 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="relative m-auto grid h-[min(92vh,940px)] w-[min(96vw,1280px)] overflow-hidden rounded-3xl bg-[#0b0c14] ring-1 ring-white/10 md:grid-cols-[minmax(0,380px)_1fr]"
      >
        <button type="button" data-pad-back onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 rounded-xl bg-black/40 p-2 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {/* Portrait column */}
        <div className="relative hidden overflow-hidden md:block">
          <button type="button" onClick={() => setViewer(0)} className="absolute inset-0" aria-label="View portrait full size">
            <img src={def.portrait.lg} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
            <img src={def.portrait.lg} alt={def.name} className="relative h-full w-full object-contain" />
          </button>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0c14] via-transparent to-transparent" />
          <div className="absolute inset-x-6 bottom-6 space-y-3">
            {onFightAs && (
              <ArcadeButton size="lg" className="w-full" onClick={() => onFightAs(def)}>
                <Swords className="h-5 w-5" /> Fight as {def.name.split(" ")[0]}
              </ArcadeButton>
            )}
            {onFightAgainst && (
              <ArcadeButton size="md" tone="rose" className="w-full" onClick={() => onFightAgainst(def)}>
                Fight against
              </ArcadeButton>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="dark fw-thin-scroll min-h-0 overflow-y-auto text-white">
          <div className="px-7 pt-7">
            <div className="flex flex-wrap items-center gap-2 pr-10">
              <ArchetypeChip def={def} />
              <AlignmentChip def={def} />
              {def.custom && <span className="rounded-sm bg-amber-300 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950">★ Signature moves</span>}
            </div>
            <h2 className="fw-display fw-outline mt-3 text-5xl font-[650] uppercase leading-none">{def.name}</h2>
            <p className="mt-1 text-white/60">{bio?.realName && bio.realName !== "Inapplicable" ? bio.realName : def.realName}</p>
          </div>

          <div className="sticky top-0 z-10 mt-5 border-b border-white/10 bg-[#0b0c14]/95 px-7 backdrop-blur">
            <div className="fw-no-scrollbar -mb-px flex gap-5 overflow-x-auto">
              {TABS.map(([k, label, n]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={cn("relative shrink-0 py-3 text-sm font-bold uppercase tracking-wider transition", tab === k ? "text-white" : "text-white/45 hover:text-white/80")}>
                  {label}
                  {n ? <span className="ml-1 font-mono text-[10px] text-white/40">{n}</span> : null}
                  {tab === k && <motion.span layoutId="fwSheetTab" className="absolute inset-x-0 -bottom-px h-0.5 bg-amber-300" />}
                </button>
              ))}
            </div>
          </div>

          <div className="px-7 pb-10 pt-6">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {tab === "overview" && (
                  <div className="space-y-6">
                    <div className="grid items-center gap-6 lg:grid-cols-[1fr_240px]">
                      <div className="space-y-4">
                        <StatBars def={def} />
                        <p className="text-sm text-white/65">{def.blurb}</p>
                        <p className="text-[13px] text-white/55">
                          <span className="font-bold" style={{ color: ARCHETYPE_INFO[def.archetype].color }}>
                            {ARCHETYPE_INFO[def.archetype].label}:
                          </span>{" "}
                          {ARCHETYPE_INFO[def.archetype].desc}
                        </p>
                      </div>
                      <StatRadar defs={[def]} size={240} />
                    </div>
                    {loading ? <BioSkeleton lines={4} /> : bio?.overview ? <ReadMore text={bio.overview} limit={600} /> : null}
                    {bio?.quote && (
                      <blockquote className="border-l-4 border-amber-300 pl-4 text-[15px] italic text-white/80">
                        “{bio.quote.text.length > 300 ? `${bio.quote.text.slice(0, 300)}…` : bio.quote.text}”
                        {bio.quote.speaker && <footer className="mt-1 font-mono text-[11px] not-italic uppercase tracking-wider text-white/45">— {bio.quote.speaker}</footer>}
                      </blockquote>
                    )}
                    {hero && <FactsGrid hero={hero} bio={bio} />}
                  </div>
                )}

                {tab === "how" && <HowToPlay def={def} settings={settings} />}
                {tab === "moves" && <MoveGuide def={def} settings={settings} player={0} />}

                {tab === "bio" && <BioTab bio={bio} loading={loading} error={error} />}
                {tab === "powers" && <PowersTab bio={bio} loading={loading} error={error} />}
                {tab === "family" && hero && <FamilyTab hero={hero} bio={bio} loading={loading} />}
                {tab === "gallery" && (
                  <div>
                    {galLoading ? (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-white/[0.06]" />
                        ))}
                      </div>
                    ) : images.length <= 1 ? (
                      <p className="text-white/50">No extra artwork found for this character.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {images.map((im, i) => (
                          <button key={im.src} type="button" onClick={() => setViewer(i)} className="group aspect-[3/4] overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/10" title={im.caption}>
                            <img src={im.thumb ?? im.src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile fight buttons */}
          <div className="flex gap-3 px-7 pb-8 md:hidden">
            {onFightAs && <ArcadeButton className="flex-1" onClick={() => onFightAs(def)}>Fight as</ArcadeButton>}
            {onFightAgainst && <ArcadeButton tone="rose" className="flex-1" onClick={() => onFightAgainst(def)}>Fight against</ArcadeButton>}
          </div>
        </div>
      </motion.div>

      <Lightbox images={images} index={viewer ?? 0} open={viewer !== null} onClose={() => setViewer(null)} onIndexChange={setViewer} referrerPolicy="no-referrer" />
    </motion.div>
  );
}
