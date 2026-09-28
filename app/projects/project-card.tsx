"use client";

import { useRef, type MouseEvent } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface ProjectItem {
  id: number;
  icon: StaticImageData;
  slug: string;
  title: string;
  excerpt: string;
  openSource?: boolean;
  badge?: string;
}

interface ProjectCardProps {
  item: ProjectItem;
  /** Position in the grid — rendered as a mono index ("01") */
  index?: number;
  /** Full-width hero treatment for the flagship entry */
  featured?: boolean;
  onClick?: () => void;
}

/* ------------------------------------------------------------------ */
/*  ProjectCard Component                                              */
/* ------------------------------------------------------------------ */
export default function ProjectCard({ item, index, featured = false, onClick }: ProjectCardProps) {
  const isExternal = /^https?:\/\//i.test(item.slug);
  const ref = useRef<HTMLAnchorElement>(null);

  // Cursor-following spotlight — writes CSS vars, no re-render
  const handleMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  };

  const tags = [
    item.badge,
    item.openSource ? "Open Source" : null,
    isExternal ? "External" : null,
  ].filter(Boolean) as string[];

  const iconBox = (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-slate-100 ring-1 ring-slate-200/80 dark:from-white/[0.08] dark:to-white/[0.02] dark:ring-white/10 ${
        featured ? "h-14 w-14" : "h-10 w-10"
      }`}
    >
      <Image
        src={item.icon}
        width={featured ? 36 : 24}
        height={featured ? 36 : 24}
        alt=""
        className={`object-contain ${featured ? "h-9 w-9" : "h-6 w-6"}`}
      />
    </div>
  );

  const meta = (
    <div className="flex items-center gap-3">
      {typeof index === "number" && (
        <span className="font-mono text-[11px] tabular-nums text-slate-300 transition-colors group-hover:text-indigo-400 dark:text-slate-600">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-all duration-300 group-hover:bg-indigo-500 group-hover:text-white dark:text-slate-500 dark:group-hover:bg-indigo-400 dark:group-hover:text-slate-900">
        <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
      </span>
    </div>
  );

  return (
    <Link
      ref={ref}
      href={item.slug}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      onClick={onClick}
      onMouseMove={handleMove}
      className={[
        "group relative isolate block h-full overflow-hidden rounded-2xl",
        "border border-slate-200/70 bg-white/80 backdrop-blur-sm",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-indigo-300/60 hover:shadow-[0_12px_40px_-12px_rgba(99,102,241,0.35)]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50",
        "dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-indigo-400/40 dark:hover:shadow-[0_12px_40px_-12px_rgba(129,140,248,0.4)] dark:focus-visible:ring-offset-brand-900",
      ].join(" ")}
    >
      {/* Spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(320px circle at var(--x, 50%) var(--y, 0%), rgba(99,102,241,0.10), rgba(34,211,238,0.06) 40%, transparent 70%)",
        }}
      />
      {/* Top scan line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      {featured && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-200/50 via-sky-100/40 to-transparent blur-2xl dark:from-indigo-500/15 dark:via-cyan-400/5"
        />
      )}

      <div className={`flex h-full ${featured ? "flex-col gap-5 p-6 sm:flex-row sm:gap-6 sm:p-7" : "flex-col p-5"}`}>
        {featured ? (
          iconBox
        ) : (
          <div className="mb-4 flex items-start justify-between gap-3">
            {iconBox}
            {meta}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <h3
            className={`font-aspekta font-[650] tracking-tight text-slate-900 dark:text-white ${
              featured ? "pr-10 text-2xl" : "text-[15px]"
            }`}
          >
            {item.title}
          </h3>
          <p
            className={`mt-1.5 text-slate-500 dark:text-slate-400 ${
              featured ? "max-w-2xl text-[15px] leading-relaxed" : "line-clamp-3 text-sm leading-relaxed"
            }`}
          >
            {item.excerpt}
          </p>

          {tags.length > 0 && (
            <div className={`mt-auto flex flex-wrap gap-1.5 ${featured ? "pt-4" : "pt-5"}`}>
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-slate-200/80 bg-slate-50/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {featured && <div className="absolute right-6 top-6 sm:right-7 sm:top-7">{meta}</div>}
      </div>
    </Link>
  );
}
