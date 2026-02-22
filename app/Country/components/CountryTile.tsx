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
      whileHover={reducedMotion ? {} : { scale: 1.04, y: -3 }}
      whileTap={reducedMotion ? {} : { scale: 0.97 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl transition-shadow duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        selected
          ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/25"
          : "shadow-sm hover:shadow-lg",
        "h-[88px] sm:h-28 w-full",
      )}
      style={{
        backgroundImage: c.flags?.png ? `url(${c.flags.png})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      title={c.name.common}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t transition-opacity duration-300",
          selected
            ? "from-indigo-900/90 via-indigo-700/30 to-transparent"
            : "from-black/80 via-black/25 to-transparent group-hover:from-black/70",
        )}
      />
      <div className="absolute inset-0 flex flex-col justify-end p-2.5">
        <div className="text-[13px] font-bold text-white drop-shadow-sm line-clamp-1">{c.name.common}</div>
        {c.continents?.[0] && (
          <div className="text-[10px] text-white/60 mt-0.5 line-clamp-1">{c.continents[0]}</div>
        )}
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-[9px] font-bold">&#10003;</span>
        </div>
      )}
    </motion.button>
  );
}
