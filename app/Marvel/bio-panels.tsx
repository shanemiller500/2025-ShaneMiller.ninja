"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, ExternalLink, Quote, ShieldAlert, Sparkles, Swords, Users, Wrench, Zap } from "lucide-react";

import { loadBio, type Bio, type BioSection } from "./lib/bio";
import { clean, splitList, type Hero } from "./lib/roster";

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
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:text-indigo-600 dark:hover:text-indigo-300">
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
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
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
      {facts.map((f) => (
        <div key={f.label} className="border-b border-slate-100 py-2 dark:border-white/[0.05]">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{f.label}</dt>
          <dd className="mt-0.5 text-[13px] text-slate-800 dark:text-slate-200">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/*  Bio tab — history chapters + personality                           */
/* ------------------------------------------------------------------ */
const CHAPTERS_SHOWN = 8;

export function BioTab({ bio, loading, error }: { bio: Bio | null; loading: boolean; error: boolean }) {
  const [open, setOpen] = useState<number | null>(0);
  const [all, setAll] = useState(false);
  if (loading) return <BioSkeleton lines={10} />;
  if (!bio) return <NoBio error={error} />;
  const chapters = all ? bio.history : bio.history.slice(0, CHAPTERS_SHOWN);

  return (
    <div className="space-y-6">
      {bio.history.length > 0 && (
        <section>
          <Label icon={BookOpen} right={<WikiLink href={bio.pageUrl}>Full history</WikiLink>}>
            History · {bio.history.length} chapters
          </Label>
          <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
            {chapters.map((c, i) => {
              const isOpen = open === i;
              return (
                <li key={`${c.title}-${i}`} className="relative pl-6">
                  <span className={cn("absolute left-0 top-[11px] h-[15px] w-[15px] rounded-full border-2 bg-white transition-colors dark:bg-[#1a1a1d]", isOpen ? "border-indigo-500" : "border-slate-300 dark:border-white/20")} />
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 rounded-lg py-2 text-left text-[13px] font-semibold text-slate-900 transition-colors hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300"
                  >
                    <span>{c.title}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <ReadMore text={c.text} limit={900} className="pb-3" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
          {bio.history.length > CHAPTERS_SHOWN && (
            <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 pl-6 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
              {all ? "Show fewer chapters" : `Show all ${bio.history.length} chapters`}
            </button>
          )}
        </section>
      )}

      {bio.personality && (
        <section>
          <Label icon={Sparkles}>Personality</Label>
          <ReadMore text={bio.personality} limit={700} />
        </section>
      )}

      {!bio.history.length && !bio.personality && <NoBio />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Powers tab                                                         */
/* ------------------------------------------------------------------ */
const SECTION_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  Powers: { icon: Zap, tone: "text-violet-500" },
  Abilities: { icon: Sparkles, tone: "text-sky-500" },
  Weaknesses: { icon: ShieldAlert, tone: "text-rose-500" },
  Equipment: { icon: Wrench, tone: "text-amber-500" },
  Weapons: { icon: Swords, tone: "text-orange-500" },
  Transportation: { icon: Zap, tone: "text-emerald-500" },
};

function PowerItem({ name, text }: { name: string; text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <li className="rounded-xl border border-slate-200/70 p-3 dark:border-white/[0.08]">
      {name && <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{name}</p>}
      <p className={cn("whitespace-pre-line text-[12px] leading-relaxed text-slate-500 dark:text-slate-400", name && "mt-0.5", !open && long && "line-clamp-3")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-300">
          {open ? "Less" : "More"}
        </button>
      )}
    </li>
  );
}

function PowerSection({ section }: { section: BioSection }) {
  const style = SECTION_STYLE[section.title] ?? SECTION_STYLE.Powers;
  const [all, setAll] = useState(false);
  const items = all ? section.items : section.items.slice(0, 8);
  return (
    <section>
      <Label icon={style.icon}>
        <span className={style.tone}>{section.title}</span>
        {section.items.length ? ` · ${section.items.length}` : ""}
      </Label>
      {section.intro && <ReadMore text={section.intro} limit={400} className="mb-2" />}
      {items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((it, i) => (
            <PowerItem key={`${it.name}-${i}`} name={it.name} text={it.text} />
          ))}
        </ul>
      )}
      {section.items.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300">
          {all ? "Show fewer" : `Show all ${section.items.length}`}
        </button>
      )}
    </section>
  );
}

export function PowersTab({ bio, loading, error }: { bio: Bio | null; loading: boolean; error: boolean }) {
  if (loading) return <BioSkeleton lines={8} />;
  if (!bio || !bio.powers.length) return <NoBio error={error} />;
  return (
    <div className="space-y-6">
      {bio.powers.map((s) => (
        <PowerSection key={s.title} section={s} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Family tab — relatives, affiliations, codenames, trivia            */
/* ------------------------------------------------------------------ */
export function FamilyTab({ hero, bio, loading }: { hero: Hero; bio: Bio | null; loading: boolean }) {
  if (loading) return <BioSkeleton lines={8} />;
  const teams = splitList(hero.connections.groupAffiliation, 14);
  const family = bio?.family ?? [];
  const datasetRelatives = splitList(hero.connections.relatives, 12);
  const codenames = bio?.codenames.length ? bio.codenames : hero.biography.aliases.map(clean).filter(Boolean);

  return (
    <div className="space-y-6">
      {family.length > 0 ? (
        <section>
          <Label icon={Users}>Family &amp; affiliations</Label>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {family.map((g) => (
              <div key={g.label}>
                <p className="text-[12px] font-semibold text-slate-900 dark:text-white">{g.label}</p>
                <ul className="mt-1 space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it} className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : datasetRelatives.length > 0 ? (
        <section>
          <Label icon={Users}>Relatives</Label>
          <ul className="space-y-0.5">
            {datasetRelatives.map((r) => (
              <li key={r} className="text-[12px] text-slate-500 dark:text-slate-400">
                {r}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {teams.length > 0 && (
        <section>
          <Label>Teams</Label>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <span key={t} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {codenames.length > 0 && (
        <section>
          <Label>Codenames &amp; aliases · {codenames.length}</Label>
          <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{codenames.join(" · ")}</p>
        </section>
      )}

      {bio?.trivia.length ? (
        <section>
          <Label icon={Sparkles}>Trivia</Label>
          <ul className="space-y-2">
            {bio.trivia.map((t) => (
              <li key={t} className="relative pl-4 text-[12px] leading-relaxed text-slate-600 before:absolute before:left-0 before:top-[7px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-indigo-400 dark:text-slate-300">
                {t}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
