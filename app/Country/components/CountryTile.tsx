/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import type { LiteCountry } from "../lib/types";
import { cn } from "../lib/utils";

interface CountryTileProps {
  c: LiteCountry;
  onClick: () => void;
  selected?: boolean;
  reducedMotion?: boolean;
}

export default function CountryTile({ c, onClick, selected, reducedMotion }: CountryTileProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reducedMotion ? {} : { y: -3 }}
      whileTap={reducedMotion ? {} : { scale: 0.97 }}
      className={cn(
        "group relative h-24 w-full overflow-hidden rounded-2xl border text-left outline-none transition-shadow sm:h-28",
        "focus-visible:ring-2 focus-visible:ring-indigo-500/60",
        selected
          ? "border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.25),0_12px_30px_-12px_rgba(99,102,241,0.6)]"
          : "border-slate-200/70 hover:shadow-[0_12px_30px_-14px_rgba(15,23,42,0.45)] dark:border-white/[0.08]",
      )}
      title={c.name.common}
    >
      {/* Flag as <img> so referrerPolicy applies */}
      {c.flags?.png ? (
        <img src={c.flags.png} alt="" aria-hidden referrerPolicy="no-referrer" loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-sky-500/10" />
      )}
      <div className={cn("absolute inset-0 bg-gradient-to-t", selected ? "from-indigo-950/90 via-indigo-900/40 to-transparent" : "from-slate-950/85 via-slate-950/25 to-transparent")} />

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <div className="line-clamp-1 text-[13px] font-semibold text-white drop-shadow-sm">{c.name.common}</div>
        {c.continents?.[0] && <div className="line-clamp-1 font-mono text-[9px] uppercase tracking-wider text-white/60">{c.continents[0]}</div>}
      </div>

      {selected && (
        <span className="absolute right-2 top-2 rounded-full bg-indigo-500 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white shadow-[0_0_12px_rgba(99,102,241,0.8)]">
          Viewing
        </span>
      )}
    </motion.button>
  );
}
