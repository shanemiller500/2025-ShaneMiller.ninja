"use client";

import React, { useMemo, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";

interface Props {
  link: { url: string; title: string; thumbnail?: string | null; snippet?: string };
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export default function LinkCard({ link }: Props) {
  const domain = useMemo(() => safeHost(link.url), [link.url]);

  // thum.io preview, fallback to favicon
  const screen = useMemo(
    () => `https://image.thum.io/get/width/900/noanimate/${encodeURIComponent(link.url)}`,
    [link.url]
  );
  const icon = useMemo(
    () => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    [domain]
  );

  const [src, setSrc] = useState(link.thumbnail || screen);
  const [ready, setReady] = useState(false);

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("Link Click", { url: link.url })}
      className="group block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      {/* Banner */}
      <div className="relative h-36 bg-gray-100 dark:bg-brand-900 sm:h-44">
        {!ready && <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-brand-900" />}

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

        {/* overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
            <img src={icon} alt="" className="h-5 w-5 rounded-md bg-white/90 p-[2px]" />
            <span className="truncate text-xs font-semibold text-white">{domain}</span>
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="p-4">
        <p className="line-clamp-2 text-sm font-extrabold tracking-tight text-indigo-700 dark:text-indigo-300">
          {link.title || "Untitled"}
        </p>

        {link.snippet ? (
          <p className="mt-2 line-clamp-2 text-xs opacity-75">{link.snippet}</p>
        ) : (
          <p className="mt-2 text-xs opacity-60">{domain}</p>
        )}
      </div>
    </a>
  );
}
