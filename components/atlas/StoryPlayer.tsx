"use client";

import { motion } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, FileText, X } from "lucide-react";
import { sameUrl, type LibraryDoc } from "@/utils/geo/useLibrary";
import { HudLabel, hudGlass } from "./Hud";
import type { AtlasStory, StoryAction } from "./story";

/* ------------------------------------------------------------------ */
/*  HUD story card: pick a story, then step through its chapters.      */
/*  The page owns the camera + actions; this only renders and calls    */
/*  back. Sources resolve to the library's hosted copy when there is   */
/*  one, otherwise to the original publisher.                          */
/* ------------------------------------------------------------------ */

interface StoryPlayerProps<K extends string> {
  stories: AtlasStory<K>[];
  storyId: string | null;
  chapter: number;
  onStory: (id: string | null) => void;
  onChapter: (i: number) => void;
  onAction: (a: StoryAction<K>) => void;
  library?: LibraryDoc[] | null;
  className?: string;
}

export function StoryPlayer<K extends string>({ stories, storyId, chapter, onStory, onChapter, onAction, library, className = "" }: StoryPlayerProps<K>) {
  const story = stories.find((s) => s.id === storyId) ?? null;

  if (!story) {
    return (
      <div className={`${hudGlass} flex max-h-full flex-col ${className}`}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <BookOpen className="h-4 w-4 text-cyan-300" />
          <HudLabel>Stories</HudLabel>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {stories.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onStory(s.id)} className="group flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/[0.05]">
                <span className="mt-0.5 h-9 w-1 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }} />
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[14px] font-semibold text-slate-100 group-hover:text-white">{s.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">{s.when}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-slate-400">{s.subtitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const ch = story.chapters[Math.min(chapter, story.chapters.length - 1)];
  const last = chapter >= story.chapters.length - 1;
  const hosted = (url: string) => library?.find((d) => sameUrl(d.sourceUrl, url) && d.fileUrl) ?? null;

  return (
    <div className={`${hudGlass} flex max-h-full flex-col ${className}`}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2 w-2 rounded-full" style={{ background: story.color, boxShadow: `0 0 10px ${story.color}` }} />
        <HudLabel className="min-w-0 flex-1 truncate">
          {story.title} · {chapter + 1}/{story.chapters.length}
        </HudLabel>
        <button type="button" onClick={() => onStory(null)} aria-label="Close story" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">

          {/* keyed fade-in per chapter (no exit animation — fast clicking could strand one) */}
          <motion.div key={`${story.id}-${chapter}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
            {ch.date && <p className="font-mono text-[11px] uppercase tracking-wider" style={{ color: story.color }}>{ch.date}</p>}
            <h3 className="mt-1 font-aspekta text-xl font-[650] leading-tight text-white">{ch.title}</h3>
            <div className="mt-2 space-y-2">
              {ch.body.map((p, i) => (
                <p key={i} className="text-[13.5px] leading-relaxed text-slate-300">
                  {p}
                </p>
              ))}
            </div>
            {!!ch.actions?.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ch.actions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => onAction(a)}
                    className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-[12px] font-semibold text-cyan-100 shadow-[0_0_16px_-6px_rgba(34,211,238,0.7)] transition-colors hover:bg-cyan-400/20"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {last && story.docs.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <HudLabel>Read the science</HudLabel>
                {story.docs.map((d) => {
                  const copy = hosted(d.url);
                  return (
                    <a
                      key={d.url}
                      href={copy?.fileUrl ?? d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 rounded-xl border border-white/10 px-3 py-2 text-[12.5px] text-slate-200 transition-colors hover:border-cyan-300/40 hover:text-white"
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                      <span className="min-w-0">
                        <span className="block leading-snug">{d.title}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                          {d.source}
                          {d.year ? ` · ${d.year}` : ""}
                          {copy ? ` · ${copy.pages ?? "?"} pp · atlas library` : ""}
                        </span>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </motion.div>

      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onChapter(chapter - 1)}
          disabled={chapter === 0}
          aria-label="Previous chapter"
          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 justify-center gap-1.5">
          {story.chapters.map((c, i) => (
            <button
              key={c.title}
              type="button"
              onClick={() => onChapter(i)}
              aria-label={`Chapter ${i + 1}: ${c.title}`}
              className={`h-1.5 rounded-full transition-all ${i === chapter ? "w-6" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
              style={i === chapter ? { background: story.color, boxShadow: `0 0 8px ${story.color}` } : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? onStory(null) : onChapter(chapter + 1))}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-200 hover:bg-white/10"
        >
          {last ? "Done" : "Next"}
          {!last && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
