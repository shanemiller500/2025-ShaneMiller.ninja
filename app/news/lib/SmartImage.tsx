/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  SmartImage — cycles through candidate URLs on load failure         */
/* ------------------------------------------------------------------ */

export function SmartImage({
  candidates,
  alt,
  className,
  wrapperClassName,
}: {
  candidates: string[];
  alt: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [idx, setIdx] = useState(0);
  const key = candidates.join("|");
  useEffect(() => setIdx(0), [key]);

  const src = candidates[idx];
  if (!src) return null;

  return (
    <div className={wrapperClassName}>
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (idx < candidates.length - 1) setIdx((n) => n + 1);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonCard — shared loading placeholder                         */
/* ------------------------------------------------------------------ */

export function SkeletonCard({ hasImage = true }: { hasImage?: boolean }) {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
      {hasImage && <div className="h-44 bg-slate-100 dark:bg-white/[0.04]" />}
      <div className="p-4">
        <div className="mb-2 h-3.5 w-3/4 rounded bg-slate-100 dark:bg-white/[0.06]" />
        <div className="mb-4 h-3.5 w-2/3 rounded bg-slate-100 dark:bg-white/[0.06]" />
        <div className="h-2.5 w-1/3 rounded bg-slate-100 dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}
