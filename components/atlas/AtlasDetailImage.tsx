"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { atlasImagePath, atlasImageSourcePage } from "@/utils/geo/atlasImage";

export function AtlasDetailImage({ src, alt, caption, credit, className = "" }: { src: string; alt: string; caption?: string; credit?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const sourcePage = atlasImageSourcePage(src);
  const proxied = atlasImagePath(src);

  useEffect(() => setFailed(false), [src]);

  if (!proxied || failed) {
    return (
      <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <ImageOff aria-hidden className="h-5 w-5 text-slate-400" />
        <span className="text-xs text-slate-500 dark:text-slate-400">Image temporarily unavailable</span>
        {sourcePage && <a href={sourcePage} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 underline underline-offset-2 dark:text-indigo-300">View at source</a>}
      </div>
    );
  }

  return (
    <figure className="space-y-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={proxied} alt={alt} loading="eager" onError={() => setFailed(true)} className={className} />
      {(caption || credit) && <figcaption className="line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">{credit || caption}</figcaption>}
    </figure>
  );
}
