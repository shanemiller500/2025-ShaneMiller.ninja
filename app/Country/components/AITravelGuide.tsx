"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaBus,
  FaCalendarAlt,
  FaCheckCircle,
  FaCreditCard,
  FaExclamationTriangle,
  FaMapPin,
  FaPlane,
  FaRedo,
  FaRobot,
  FaShieldAlt,
  FaStar,
  FaTimes,
  FaUtensils,
  FaWater,
} from "react-icons/fa";

import { cn } from "../lib/utils";
import type { AITravelInsights } from "../lib/types";

// ─── Shared props ─────────────────────────────────────────────────────────────

interface AISectionProps {
  insights: AITravelInsights | null;
  loading: boolean;
}

// ─── Loading phrases ──────────────────────────────────────────────────────────

const LOADING_PHRASES = [
  "Convincing airport security this is definitely not a one-way life decision...",
  "There are 10 lies of Santorini, and they are all true.",
  "Teaching Google Maps what 'shortcut' actually means...",
  "Arguing with a tuk-tuk driver in three languages and one hand gesture after he ran over someone...",
  "Ranking street food by how brave & drunk you're feeling today...",
  "Translating 'authentic experience' into 'no WiFi but incredible story later'...",
  "Checking if that volcano is the scenic kind or the evacuation kind...",
  "Negotiating with a seagull over who wants your lunch more than you do...",
  "Making peace with the fact that the 'quick hike' was not quick...",
  "Finding the café that only locals know about (and now you do too)...",
  "Practicing the art of looking like you know where you're going...",
  "Recalculating after missing the train... again...",
  "Getting stuck in a Taiwanese airport for three days after they denied your visa at the counter and pretending this was always the plan...",
  "Trying to convince Mexican airport security that your vape pen is just 'very enthusiastic mint air'...",
];

// ─── Month chip colours ───────────────────────────────────────────────────────

const MONTH_CHIP: Record<string, string> = {
  January:   "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  February:  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  March:     "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  April:     "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  May:       "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  June:      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  July:      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  August:    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  September: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  October:   "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  November:  "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300",
  December:  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
};

// ─── Experience card accents (cycles through 5 colour sets) ──────────────────

const EXP_ACCENTS = [
  {
    gradient:  "from-indigo-500/[0.07] to-violet-500/[0.05] dark:from-indigo-500/[0.14] dark:to-violet-500/[0.10]",
    numBg:     "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
    border:    "border-indigo-100 dark:border-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-600/60",
    pin:       "text-indigo-500 dark:text-indigo-400",
    watermark: "text-indigo-200 dark:text-indigo-700/40",
  },
  {
    gradient:  "from-amber-500/[0.07] to-orange-500/[0.05] dark:from-amber-500/[0.12] dark:to-orange-500/[0.08]",
    numBg:     "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    border:    "border-amber-100 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-600/60",
    pin:       "text-amber-500 dark:text-amber-400",
    watermark: "text-amber-200 dark:text-amber-700/40",
  },
  {
    gradient:  "from-emerald-500/[0.07] to-teal-500/[0.05] dark:from-emerald-500/[0.12] dark:to-teal-500/[0.08]",
    numBg:     "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    border:    "border-emerald-100 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-600/60",
    pin:       "text-emerald-500 dark:text-emerald-400",
    watermark: "text-emerald-200 dark:text-emerald-700/40",
  },
  {
    gradient:  "from-rose-500/[0.07] to-pink-500/[0.05] dark:from-rose-500/[0.12] dark:to-pink-500/[0.08]",
    numBg:     "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
    border:    "border-rose-100 dark:border-rose-800/40 hover:border-rose-300 dark:hover:border-rose-600/60",
    pin:       "text-rose-500 dark:text-rose-400",
    watermark: "text-rose-200 dark:text-rose-700/40",
  },
  {
    gradient:  "from-sky-500/[0.07] to-cyan-500/[0.05] dark:from-sky-500/[0.12] dark:to-cyan-500/[0.08]",
    numBg:     "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
    border:    "border-sky-100 dark:border-sky-800/40 hover:border-sky-300 dark:hover:border-sky-600/60",
    pin:       "text-sky-500 dark:text-sky-400",
    watermark: "text-sky-200 dark:text-sky-700/40",
  },
] as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function Label({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-widest", className)}>
      {text}
    </span>
  );
}

function Bullet({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className={cn("flex items-start gap-2 text-sm leading-relaxed", className)}>
          <span className="mt-0.5 shrink-0 font-bold">›</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

const sh = "bg-gray-200 dark:bg-white/[0.07] rounded-full animate-pulse";

function Skel({ h = "h-3", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={cn(sh, h, w, className)} />;
}

// ─── Rotating phrase (used inside loading banner) ─────────────────────────────

function RotatingPhrase() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // Give each phrase reading time proportional to word count — min 1 800 ms
    const words = LOADING_PHRASES[idx].split(" ").length;
    const id = setTimeout(
      () => setIdx((i) => (i + 1) % LOADING_PHRASES.length),
      Math.max(1800, words * 280),
    );
    return () => clearTimeout(id);
  }, [idx]);

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-0.5 shrink-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400"
        >
          {LOADING_PHRASES[idx]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ─── Exported section components ──────────────────────────────────────────────

/**
 * Animated loading ticker — slides in when AI is fetching, slides out when done.
 * Place this near the top of the page so users know something is happening.
 */
export function AILoadingBanner({ loading }: { loading: boolean }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          key="ai-loading-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-800/30 bg-indigo-50/60 dark:bg-indigo-950/20 px-4 py-3.5">
            <RotatingPhrase />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact inline error with retry button.
 * Renders nothing when error is null.
 */
export function AIErrorBanner({ error, onRetryAction }: { error: string | null; onRetryAction: () => void }) {
  if (!error) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-rose-100 dark:border-rose-800/30 bg-rose-50/50 dark:bg-rose-950/20 px-4 py-3.5 flex items-center gap-3"
    >
      <FaRobot className="text-rose-400 dark:text-rose-500 shrink-0 text-lg" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700 dark:text-white/75 mb-0.5">
          AI travel guide unavailable
        </p>
        <p className="text-[11px] text-gray-400 dark:text-white/40 line-clamp-1">{error}</p>
      </div>
      <button
        type="button"
        onClick={onRetryAction}
        className="shrink-0 flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 transition shadow-sm"
      >
        <FaRedo className="text-[9px]" />
        Retry
      </button>
    </motion.div>
  );
}

/**
 * Hero summary card — full-width indigo gradient.
 * Shows a shimmer skeleton while loading.
 */
export function AIQuickSummary({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600/20 to-violet-600/10 dark:from-indigo-900/50 dark:to-violet-900/30 border border-indigo-200/40 dark:border-indigo-700/20 p-5 space-y-3 animate-pulse">
        <Skel h="h-2.5" w="w-20" className="bg-indigo-300/60 dark:bg-indigo-700/50" />
        <Skel h="h-4" />
        <Skel h="h-4" w="w-5/6" />
        <Skel h="h-4" w="w-4/6" />
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" as const }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 dark:from-indigo-700 dark:to-violet-800 p-5 sm:p-6 shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10"
    >
      <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
      <Label text="✦ At a glance" className="text-indigo-200 block mb-2.5" />
      <p className="relative text-sm sm:text-[15px] leading-relaxed font-medium text-white/90">
        {insights.quickSummary}
      </p>
    </motion.div>
  );
}

/**
 * Best time to visit + Money at a glance — 2-col internal layout.
 * Shows paired shimmer cards while loading.
 */
export function AIBestTimeAndMoney({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800/20 bg-white/80 dark:bg-white/[0.04] p-4 space-y-2.5">
          <Skel h="h-2.5" w="w-32" className="bg-emerald-200 dark:bg-emerald-700/40" />
          <Skel h="h-3" />
          <Skel h="h-3" w="w-4/5" />
          <div className="flex gap-1.5 flex-wrap pt-1">
            {["w-14", "w-16", "w-12", "w-16"].map((w, i) => (
              <div key={i} className={cn("h-6 rounded-full bg-gray-100 dark:bg-white/[0.06]", w)} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-100 dark:border-violet-800/20 bg-white/80 dark:bg-white/[0.04] p-4 space-y-3">
          <Skel h="h-2.5" w="w-28" className="bg-violet-200 dark:bg-violet-700/40" />
          <div className="h-8 w-28 rounded-xl bg-violet-100/80 dark:bg-violet-900/30" />
          <Skel h="h-3" />
          <Skel h="h-3" w="w-4/5" />
          <Skel h="h-3" w="w-3/5" />
        </div>
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" as const }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {/* Best time */}
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800/30 bg-white/80 dark:bg-white/[0.04] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FaCalendarAlt className="text-emerald-500 dark:text-emerald-400 shrink-0" />
          <Label text="Best time to visit" className="text-emerald-700 dark:text-emerald-400" />
        </div>
        <p className="text-sm text-gray-700 dark:text-white/80 leading-relaxed flex-1">
          {insights.bestTimeToVisit.summary}
        </p>
        {insights.bestTimeToVisit.months.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {insights.bestTimeToVisit.months.map((m) => (
              <span
                key={m}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  MONTH_CHIP[m] ?? "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/70",
                )}
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Money */}
      <div className="rounded-2xl border border-violet-100 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-950/20 p-4 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <FaCreditCard className="text-violet-500 dark:text-violet-400 shrink-0" />
          <Label text="Money at a glance" className="text-violet-700 dark:text-violet-400" />
        </div>
        {insights.money.currency && (
          <span className="self-start rounded-xl bg-violet-600 text-white text-xs font-bold px-3 py-1.5 shadow-sm">
            {insights.money.currency}
          </span>
        )}
        {insights.money.tipping && (
          <p className="text-xs text-gray-700 dark:text-white/75 leading-relaxed">
            <span className="font-semibold text-violet-700 dark:text-violet-400">Tipping: </span>
            {insights.money.tipping}
          </p>
        )}
        {insights.money.paymentTips.slice(0, 2).map((tip, i) => (
          <p key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-white/65 leading-relaxed">
            <span className="text-violet-400 mt-0.5 shrink-0 font-bold">›</span>
            {tip}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Top experiences — 3-col card grid with accent colours.
 * Shows 3 shimmer cards while loading.
 */
export function AIExperiences({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5 animate-pulse">
          <div className="w-3.5 h-3.5 rounded bg-amber-200 dark:bg-amber-700/40 shrink-0" />
          <Skel h="h-2.5" w="w-28" className="bg-amber-200 dark:bg-amber-700/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] p-4 space-y-2 min-h-[130px] relative overflow-hidden"
            >
              <div className="absolute top-2 right-3 text-5xl font-black text-gray-100 dark:text-white/[0.04] select-none">
                {i + 1}
              </div>
              <div className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-white/10" />
              <Skel h="h-3.5" w="w-3/4" />
              <Skel h="h-3" />
              <Skel h="h-3" w="w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" as const }}
    >
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <FaStar className="text-amber-500 shrink-0" />
        <Label text="Top experiences" className="text-amber-700 dark:text-amber-400" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.topExperiences.map((exp, i) => {
          const accent = EXP_ACCENTS[i % EXP_ACCENTS.length];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.07, ease: "easeOut" as const }}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className={cn(
                "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-shadow hover:shadow-md cursor-default",
                accent.gradient,
                accent.border,
              )}
            >
              <span
                className={cn(
                  "absolute top-2 right-3 text-6xl font-black select-none pointer-events-none leading-none",
                  accent.watermark,
                )}
              >
                {i + 1}
              </span>
              <div className={cn("w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center mb-3 shadow-sm", accent.numBg)}>
                {i + 1}
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white mb-1.5 leading-snug pr-8">
                {exp.title}
              </p>
              <p className="text-xs text-gray-600 dark:text-white/65 leading-relaxed mb-3">
                {exp.why}
              </p>
              <div className={cn("flex items-center gap-1.5 text-xs font-semibold", accent.pin)}>
                <FaMapPin className="text-[9px] shrink-0" />
                <span className="truncate">{exp.where}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Dos & Don'ts — side-by-side green/red cards.
 * Shows matched shimmer skeleton while loading.
 */
export function AIDosDonts({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800/20 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2">
          <Skel h="h-2.5" w="w-10" className="bg-emerald-200 dark:bg-emerald-700/40" />
          {[1, 2, 3].map((j) => <Skel key={j} h="h-3" />)}
        </div>
        <div className="rounded-2xl border border-red-100 dark:border-red-800/20 bg-red-50/50 dark:bg-red-950/20 p-4 space-y-2">
          <Skel h="h-2.5" w="w-14" className="bg-red-200 dark:bg-red-700/40" />
          {[1, 2, 3].map((j) => <Skel key={j} h="h-3" />)}
        </div>
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" as const }}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <FaCheckCircle className="text-emerald-500 dark:text-emerald-400 text-sm shrink-0" />
          <Label text="Do" className="text-emerald-700 dark:text-emerald-400" />
        </div>
        <Bullet items={insights.dos} className="text-gray-700 dark:text-white/80" />
      </div>
      <div className="rounded-2xl border border-red-100 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/20 p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <FaTimes className="text-red-500 dark:text-red-400 text-sm shrink-0" />
          <Label text="Don't" className="text-red-700 dark:text-red-400" />
        </div>
        <Bullet items={insights.donts} className="text-gray-700 dark:text-white/80" />
      </div>
    </motion.div>
  );
}

/**
 * Safety section — risks, scams, and emergency help callout.
 * Shows an orange shimmer skeleton while loading.
 */
export function AISafety({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-orange-100 dark:border-orange-800/20 bg-orange-50/50 dark:bg-orange-950/20 p-4 space-y-3 animate-pulse">
        <Skel h="h-2.5" w="w-16" className="bg-orange-200 dark:bg-orange-700/40" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">{[1, 2, 3].map((j) => <Skel key={j} h="h-3" />)}</div>
          <div className="space-y-1.5">{[1, 2, 3].map((j) => <Skel key={j} h="h-3" />)}</div>
        </div>
        <Skel h="h-10" className="rounded-xl" />
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" as const }}
      className="rounded-2xl border border-orange-100 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-950/20 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <FaShieldAlt className="text-orange-500 dark:text-orange-400 shrink-0" />
        <Label text="Safety" className="text-orange-700 dark:text-orange-400" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {insights.safety.commonRisks.length > 0 && (
          <div>
            <Label text="Common risks" className="text-orange-600/80 dark:text-orange-400/70 block mb-2" />
            <Bullet items={insights.safety.commonRisks} className="text-gray-700 dark:text-white/75" />
          </div>
        )}
        {insights.safety.scamsToWatch.length > 0 && (
          <div>
            <Label text="Scams to watch" className="text-orange-600/80 dark:text-orange-400/70 block mb-2" />
            <ul className="space-y-1.5">
              {insights.safety.scamsToWatch.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-white/75 leading-relaxed">
                  <FaExclamationTriangle className="text-[9px] mt-1 shrink-0 text-orange-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {insights.safety.gettingHelp && (
        <div className="rounded-xl bg-white/70 dark:bg-white/[0.05] border border-orange-100 dark:border-orange-800/20 px-3.5 py-3 text-sm text-gray-800 dark:text-white/80 leading-relaxed">
          <span className="font-bold text-orange-700 dark:text-orange-400">🚨 Emergency: </span>
          {insights.safety.gettingHelp}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Getting around — city transit + between-cities + road notes.
 * Shows a sky-blue shimmer skeleton while loading.
 */
export function AIGettingAround({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3 px-0.5 animate-pulse">
          <div className="w-3.5 h-3.5 rounded bg-sky-200 dark:bg-sky-700/40 shrink-0" />
          <Skel h="h-2.5" w="w-32" className="bg-sky-200 dark:bg-sky-700/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
          <div className="rounded-2xl border border-sky-100 dark:border-sky-800/20 bg-white/80 dark:bg-white/[0.04] p-4 space-y-2">
            <Skel h="h-2.5" w="w-20" className="bg-sky-200 dark:bg-sky-700/30" />
            {[1, 2, 3].map((j) => <Skel key={j} h="h-3" />)}
          </div>
          <div className="rounded-2xl border border-sky-100 dark:border-sky-800/20 bg-white/80 dark:bg-white/[0.04] p-4 space-y-2">
            <Skel h="h-2.5" w="w-24" className="bg-sky-200 dark:bg-sky-700/30" />
            {[1, 2, 3].map((j) => <Skel key={j} h="h-3" />)}
          </div>
        </div>
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" as const }}
    >
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <FaBus className="text-sky-500 dark:text-sky-400 shrink-0" />
        <Label text="Getting around" className="text-sky-700 dark:text-sky-400" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5">
        {insights.gettingAround.insideCities.length > 0 && (
          <div className="rounded-2xl border border-sky-100 dark:border-sky-800/30 bg-white/80 dark:bg-white/[0.04] p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <FaBus className="text-[10px] text-sky-500 dark:text-sky-400" />
              <Label text="In the city" className="text-sky-600/80 dark:text-sky-400/70" />
            </div>
            <Bullet items={insights.gettingAround.insideCities} className="text-gray-700 dark:text-white/80" />
          </div>
        )}
        {insights.gettingAround.betweenCities.length > 0 && (
          <div className="rounded-2xl border border-sky-100 dark:border-sky-800/30 bg-white/80 dark:bg-white/[0.04] p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <FaPlane className="text-[10px] text-sky-500 dark:text-sky-400" />
              <Label text="Between cities" className="text-sky-600/80 dark:text-sky-400/70" />
            </div>
            <Bullet items={insights.gettingAround.betweenCities} className="text-gray-700 dark:text-white/80" />
          </div>
        )}
      </div>
      {insights.gettingAround.roadNotes && (
        <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-800/20 px-3.5 py-3 text-sm text-gray-700 dark:text-white/80 leading-relaxed">
          <span className="font-semibold text-sky-700 dark:text-sky-400">Road notes: </span>
          {insights.gettingAround.roadNotes}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Food & drink — must-try dishes, water advice, overflow payment tips.
 * Shows a pink shimmer skeleton while loading.
 */
export function AIFoodAndDrink({ insights, loading }: AISectionProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-pink-100 dark:border-pink-800/20 bg-pink-50/50 dark:bg-pink-950/20 p-4 space-y-3 animate-pulse">
        <Skel h="h-2.5" w="w-24" className="bg-pink-200 dark:bg-pink-700/40" />
        <div className="flex flex-wrap gap-1.5">
          {["w-20", "w-16", "w-24", "w-14", "w-20"].map((w, i) => (
            <div key={i} className={cn("h-8 rounded-full bg-pink-100 dark:bg-pink-900/30", w)} />
          ))}
        </div>
        <Skel h="h-10" className="rounded-xl" />
      </div>
    );
  }
  if (!insights) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" as const }}
      className="rounded-2xl border border-pink-100 dark:border-pink-800/30 bg-pink-50/50 dark:bg-pink-950/20 p-4 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <FaUtensils className="text-pink-500 dark:text-pink-400 shrink-0" />
        <Label text="Food & drink" className="text-pink-700 dark:text-pink-400" />
      </div>
      {insights.foodAndDrink.mustTry.length > 0 && (
        <div className="mb-4">
          <Label text="Must try" className="text-pink-600/80 dark:text-pink-400/70 block mb-2.5" />
          <div className="flex flex-wrap gap-1.5">
            {insights.foodAndDrink.mustTry.map((food, i) => (
              <span
                key={i}
                className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-white/10 border border-pink-200 dark:border-pink-700/40 text-gray-800 dark:text-white/85 shadow-sm hover:shadow hover:border-pink-300 dark:hover:border-pink-600/50 transition cursor-default"
              >
                {food}
              </span>
            ))}
          </div>
        </div>
      )}
      {insights.money.paymentTips.length > 2 && (
        <div className="mb-4">
          <Label text="More payment tips" className="text-pink-600/80 dark:text-pink-400/70 block mb-2" />
          <Bullet items={insights.money.paymentTips.slice(2)} className="text-gray-700 dark:text-white/80" />
        </div>
      )}
      {insights.foodAndDrink.waterAdvice && (
        <div className="rounded-xl bg-white/70 dark:bg-white/[0.05] border border-pink-100 dark:border-pink-800/20 px-3.5 py-3 text-sm text-gray-700 dark:text-white/80 flex items-start gap-2.5 leading-relaxed">
          <FaWater className="text-sky-400 dark:text-sky-500 shrink-0 mt-0.5" />
          <span>{insights.foodAndDrink.waterAdvice}</span>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Tiny AI attribution footer — only renders once insights are loaded.
 */
export function AIAttribution({ insights }: { insights: AITravelInsights | null }) {
  if (!insights) return null;
  return (
    <div className="flex items-center justify-center gap-1.5 pt-1 pb-1">
      <FaRobot className="text-[10px] text-gray-300 dark:text-white/15" />
      <p className="text-[10px] text-gray-300 dark:text-white/20 text-center">
        AI-generated travel advice · Verify time-sensitive details before you travel
      </p>
    </div>
  );
}
