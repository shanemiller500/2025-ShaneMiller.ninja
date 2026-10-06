/* ------------------------------------------------------------------ */
/*  Little hand-drawn icons for things emoji don't cover well: hide,   */
/*  bone, teeth & claws, rainproof gear, bone spikes. Everything else  */
/*  falls back to its emoji so call sites can use one component.      */
/* ------------------------------------------------------------------ */
import type { ReactElement } from "react";
import { RES_INFO } from "../data/colony";

export type GlyphId = "hide" | "bone" | "tooth" | "rainproof" | "spikes" | "barricade" | "totem" | "tannery";

const SVG: Record<GlyphId, ReactElement> = {
  hide: (
    <>
      <path d="M3 5.5c2 .8 3.4.6 5-1.5 1.6 2.1 3 2.3 5 1.5-.9 2.4-.6 4.6 1 7-3.3-.6-6.2-.6-12 0 1.6-2.4 1.9-4.6 1-7z" fill="#9b6b43" stroke="#4e3220" strokeWidth=".9" strokeLinejoin="round" />
      <circle cx="6.6" cy="8.6" r="1" fill="#5c3b22" opacity=".55" />
      <circle cx="9.8" cy="9.8" r=".8" fill="#5c3b22" opacity=".55" />
    </>
  ),
  bone: (
    <>
      <path d="M4.3 11.7l7.4-7.4" stroke="#efe6cf" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="3.6" cy="10.6" r="1.7" fill="#efe6cf" />
      <circle cx="5.4" cy="12.4" r="1.7" fill="#efe6cf" />
      <circle cx="10.6" cy="3.6" r="1.7" fill="#efe6cf" />
      <circle cx="12.4" cy="5.4" r="1.7" fill="#efe6cf" />
      <path d="M4.3 11.7l7.4-7.4" stroke="#b9ad95" strokeWidth=".6" strokeLinecap="round" opacity=".7" />
    </>
  ),
  tooth: <path d="M4 4.5c2.6-1.6 5.4-1.6 8 0-.9 1.3-1.9 4.9-3.4 8.5-.4.9-1.5.9-1.7 0C6.2 9.6 5.1 6 4 4.5z" fill="#f3ecd8" stroke="#8a7c63" strokeWidth=".8" strokeLinejoin="round" />,
  rainproof: (
    <>
      <path d="M8 2.2c-2.6 0-4.3 2-4.3 4.4 0 2.6-1 5-1.7 7h12c-.7-2-1.7-4.4-1.7-7 0-2.4-1.7-4.4-4.3-4.4z" fill="#4f5a3c" stroke="#22281a" strokeWidth=".8" />
      <ellipse cx="8" cy="6.6" rx="2" ry="2.2" fill="#e0b48a" />
      <path d="M12.6 1.5c.9 1.3 1.4 2.1 1.4 2.7a1.4 1.4 0 0 1-2.8 0c0-.6.5-1.4 1.4-2.7z" fill="#7cc4ff" />
      <path d="M4.6 8.5c.3 1.6.1 3.2-.5 4.6" stroke="#fff" strokeWidth=".6" opacity=".45" fill="none" />
    </>
  ),
  spikes: (
    <>
      <ellipse cx="8" cy="13.2" rx="6.4" ry="1.8" fill="#6b4e33" opacity=".6" />
      {[3.5, 6.5, 9.5, 12.5].map((x, i) => (
        <path key={x} d={`M${x} 13l${2.4} ${-8 - (i % 2) * 2}`} stroke="#efe6cf" strokeWidth="1.7" strokeLinecap="round" />
      ))}
    </>
  ),
  barricade: (
    <>
      <path d="M2.5 13l5-9M7.5 13l-5-9M8.5 13l5-9M13.5 13l-5-9" stroke="#efe6cf" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M1.5 8.2h13" stroke="#cfc4ab" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  totem: (
    <>
      <rect x="7" y="6" width="2" height="9" fill="#6b4a2a" />
      <ellipse cx="8" cy="4.6" rx="3.4" ry="2.6" fill="#f1ead7" />
      <circle cx="6.9" cy="4.3" r=".75" fill="#2a1e16" />
      <circle cx="9.1" cy="4.3" r=".75" fill="#2a1e16" />
      <path d="M4.8 3.2L3.2 .8M11.2 3.2L12.8.8" stroke="#efe1c3" strokeWidth="1" strokeLinecap="round" />
    </>
  ),
  tannery: (
    <>
      <path d="M2 14V3M14 14V3M2 3.5h12" stroke="#6b4a2a" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M3.5 4.5h9c-.6 2.5-.4 5 .4 7.5-3.3-.7-6.5-.7-9.8 0 .8-2.5 1-5 .4-7.5z" fill="#9b6b43" />
    </>
  ),
};

const IS_GLYPH = new Set<string>(Object.keys(SVG));

/** A resource / item icon: drawn SVG when we have one, emoji otherwise. */
export function GameIcon({ id, size = 16, fallback, className = "" }: { id: string; size?: number; fallback?: string; className?: string }) {
  if (IS_GLYPH.has(id)) {
    return (
      <svg viewBox="0 0 16 16" width={size} height={size} className={`inline-block shrink-0 align-[-0.15em] drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${className}`} aria-hidden>
        {SVG[id as GlyphId]}
      </svg>
    );
  }
  const emoji = fallback ?? RES_INFO[id as keyof typeof RES_INFO]?.icon ?? "❔";
  return (
    <span className={`inline-block leading-none ${className}`} style={{ fontSize: size * 0.95 }} aria-hidden>
      {emoji}
    </span>
  );
}
