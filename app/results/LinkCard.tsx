/* app/(ai-search)/LinkCard.tsx */
"use client";

import React, { useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

interface Props {
  link: { url: string; title: string; thumbnail?: string | null };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function LinkCard({ link }: Props) {
  const domain  = new URL(link.url).hostname;
  const screen  = `https://image.thum.io/get/width/800/noanimate/${encodeURIComponent(link.url)}`;
  const icon    = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

  const [src,   setSrc]   = useState(link.thumbnail || screen);
  const [ready, setReady] = useState(false);

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("Link Click", { url: link.url })}
      className="block overflow-hidden rounded-xl transition hover:shadow-lg"
    >
      {/* Banner */}
      <div className="relative h-32 sm:h-44 bg-gray-100 dark:bg-brand-900">
        {!ready && (
          <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-brand-900" />
        )}
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          style={{ display: ready ? "block" : "none" }}
          onLoad={() => setReady(true)}
          onError={() => {
            if (src !== icon) setSrc(icon);
            else setReady(true);
          }}
        />
      </div>

      {/* Text */}
      <div className="p-4">
        <p className="line-clamp-2 font-semibold text-indigo-600 dark:text-indigo-400">
          {link.title}
        </p>
        <p className="mt-1 text-xs text-brand-300">{domain}</p>
      </div>
    </a>
  );
}
