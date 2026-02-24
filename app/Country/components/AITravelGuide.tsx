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
  "Trying to convince Mexican airport security that your vape pen is just 'very enthusiastic mint air'..."
];

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Accent colour sets for experience cards — cycles through 5 colours
const EXP_ACCENTS = [
  {
    gradient: "from-indigo-500/[0.07] to-violet-500/[0.05] dark:from-indigo-500/[0.14] dark:to-violet-500/[0.10]",
    numBg: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-100 dark:border-indigo-800/40 hover:border-indigo-300 dark:hover:border-indigo-600/60",
    pin: "text-indigo-500 dark:text-indigo-400",
    watermark: "text-indigo-200 dark:text-indigo-700/40",
  },
  {
    gradient: "from-amber-500/[0.07] to-orange-500/[0.05] dark:from-amber-500/[0.12] dark:to-orange-500/[0.08]",
    numBg: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    border: "border-amber-100 dark:border-amber-800/40 hover:border-amber-300 dark:hover:border-amber-600/60",
    pin: "text-amber-500 dark:text-amber-400",
    watermark: "text-amber-200 dark:text-amber-700/40",
  },
  {
    gradient: "from-emerald-500/[0.07] to-teal-500/[0.05] dark:from-emerald-500/[0.12] dark:to-teal-500/[0.08]",
    numBg: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-100 dark:border-emerald-800/40 hover:border-emerald-300 dark:hover:border-emerald-600/60",
    pin: "text-emerald-500 dark:text-emerald-400",
    watermark: "text-emerald-200 dark:text-emerald-700/40",
  },
  {
    gradient: "from-rose-500/[0.07] to-pink-500/[0.05] dark:from-rose-500/[0.12] dark:to-pink-500/[0.08]",
    numBg: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
    border: "border-rose-100 dark:border-rose-800/40 hover:border-rose-300 dark:hover:border-rose-600/60",
    pin: "text-rose-500 dark:text-rose-400",
    watermark: "text-rose-200 dark:text-rose-700/40",
  },
  {
    gradient: "from-sky-500/[0.07] to-cyan-500/[0.05] dark:from-sky-500/[0.12] dark:to-cyan-500/[0.08]",
    numBg: "bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300",
    border: "border-sky-100 dark:border-sky-800/40 hover:border-sky-300 dark:hover:border-sky-600/60",
    pin: "text-sky-500 dark:text-sky-400",
    watermark: "text-sky-200 dark:text-sky-700/40",
  },
] as const;

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

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

// ─── Rotating phrase ──────────────────────────────────────────────────────────

function RotatingPhrase() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    // Each phrase gets time proportional to its word count so longer ones are readable.
    // 280 ms per word, minimum 1 800 ms.
    const words = LOADING_PHRASES[idx].split(" ").length;
    const duration = Math.max(1800, words * 280);
    const id = setTimeout(
      () => setIdx((i) => (i + 1) % LOADING_PHRASES.length),
      duration,
    );
    return () => clearTimeout(id);
  }, [idx]); // re-fires with a fresh timer on every phrase change

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

// ─── Skeleton (mirrors real layout) ──────────────────────────────────────────

const sh = "bg-gray-200 dark:bg-white/[0.07] rounded-full animate-pulse";

function SkeletonBlock({ h = "h-3", w = "w-full", className = "" }: { h?: string; w?: string; className?: string }) {
  return <div className={cn(sh, h, w, className)} />;
}

function GuideSkeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* phrase ticker */}
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-800/30 bg-indigo-50/60 dark:bg-indigo-950/20 px-4 py-3.5">
        <RotatingPhrase />
      </div>

      {/* hero summary */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600/20 to-violet-600/10 dark:from-indigo-900/50 dark:to-violet-900/30 border border-indigo-200/40 dark:border-indigo-700/20 p-5 space-y-3 animate-pulse">
        <SkeletonBlock h="h-2.5" w="w-20" className="bg-indigo-300/60 dark:bg-indigo-700/50" />
        <SkeletonBlock h="h-4" />
        <SkeletonBlock h="h-4" w="w-5/6" />
        <SkeletonBlock h="h-4" w="w-4/6" />
      </div>

      {/* 2-col: best time + money */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800/20 bg-white/80 dark:bg-white/[0.04] p-4 space-y-2.5">
          <SkeletonBlock h="h-2.5" w="w-32" className="bg-emerald-200 dark:bg-emerald-700/40" />
          <SkeletonBlock h="h-3" />
          <SkeletonBlock h="h-3" w="w-4/5" />
          <div className="flex gap-1.5 flex-wrap pt-1">
            {["w-14", "w-16", "w-12", "w-16"].map((w, i) => (
              <div key={i} className={cn("h-6 rounded-full bg-gray-100 dark:bg-white/[0.06]", w)} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-100 dark:border-violet-800/20 bg-white/80 dark:bg-white/[0.04] p-4 space-y-3">
          <div className="h-10 w-10/12 rounded-xl bg-violet-100/80 dark:bg-violet-900/30" />
          <SkeletonBlock h="h-3" />
          <SkeletonBlock h="h-3" w="w-4/5" />
          <SkeletonBlock h="h-3" w="w-3/5" />
        </div>
      </div>

      {/* experience cards */}
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
            <SkeletonBlock h="h-3.5" w="w-3/4" />
            <SkeletonBlock h="h-3" />
            <SkeletonBlock h="h-3" w="w-2/3" />
          </div>
        ))}
      </div>

      {/* dos/donts */}
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-800/20 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2">
          <SkeletonBlock h="h-2.5" w="w-10" className="bg-emerald-200 dark:bg-emerald-700/40" />
          {[1, 2, 3].map((j) => <SkeletonBlock key={j} h="h-3" />)}
        </div>
        <div className="rounded-2xl border border-red-100 dark:border-red-800/20 bg-red-50/50 dark:bg-red-950/20 p-4 space-y-2">
          <SkeletonBlock h="h-2.5" w="w-14" className="bg-red-200 dark:bg-red-700/40" />
          {[1, 2, 3].map((j) => <SkeletonBlock key={j} h="h-3" />)}
        </div>
      </div>

      {/* safety */}
      <div className="rounded-2xl border border-orange-100 dark:border-orange-800/20 bg-orange-50/50 dark:bg-orange-950/20 p-4 space-y-3 animate-pulse">
        <SkeletonBlock h="h-2.5" w="w-16" className="bg-orange-200 dark:bg-orange-700/40" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">{[1, 2, 3].map((j) => <SkeletonBlock key={j} h="h-3" />)}</div>
          <div className="space-y-1.5">{[1, 2, 3].map((j) => <SkeletonBlock key={j} h="h-3" />)}</div>
        </div>
        <SkeletonBlock h="h-10" className="rounded-xl" />
      </div>
    </motion.div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function GuideError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-rose-100 dark:border-rose-800/30 bg-rose-50/50 dark:bg-rose-950/20 p-6 flex flex-col items-center text-center gap-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-500 dark:text-rose-400">
        <FaRobot className="text-2xl" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-white/80 mb-1.5">
          AI travel guide temporarily unavailable
        </p>
        <p className="text-xs text-gray-400 dark:text-white/40 mb-4 max-w-[280px] leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-5 py-2.5 transition shadow-sm"
        >
          <FaRedo className="text-[10px]" />
          Try again
        </button>
      </div>
      <p className="text-[10px] text-gray-300 dark:text-white/20">
        Powered by an AI travel advice model · Results may vary
      </p>
    </motion.div>
  );
}

// ─── Idle card ────────────────────────────────────────────────────────────────

function IdleCard({ countryName, onLoad }: { countryName: string; onLoad: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-indigo-200/60 dark:border-indigo-700/40 bg-gradient-to-br from-indigo-50 via-violet-50/60 to-sky-50/40 dark:from-indigo-950/50 dark:via-violet-950/30 dark:to-sky-950/20 p-5 sm:p-6"
    >
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-indigo-200/30 dark:bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-violet-200/20 dark:bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10">
          <FaRobot className="text-white text-2xl" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Label text="✦ AI Travel Guide" className="text-indigo-600 dark:text-indigo-400" />
            <span className="rounded-full bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">
              New
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-white/75 leading-relaxed">
            Deep-dive advice for{" "}
            <span className="font-semibold text-gray-900 dark:text-white">{countryName}</span> —
            seasons, top experiences, safety, money, food &amp; transport.
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <motion.button
          type="button"
          onClick={onLoad}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-bold px-5 py-3 shadow-md shadow-indigo-500/20 transition-all"
        >
          <FaRobot className="text-sm" />
          Generate my travel guide
        </motion.button>
        <p className="text-[10px] text-gray-400 dark:text-white/30">
          AI-powered · Cached locally forever
        </p>
      </div>
    </motion.div>
  );
}

// ─── Guide content (magazine layout) ─────────────────────────────────────────

function GuideContent({ insights }: { insights: AITravelInsights }) {
  const row = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: "easeOut" as const } },
  };
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.09 } },
  } as const;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">

      {/* ── 1. Hero summary ─────────────────────────────────────── */}
      <motion.div
        variants={row}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 dark:from-indigo-700 dark:to-violet-800 p-5 sm:p-6 shadow-lg shadow-indigo-500/20 dark:shadow-indigo-500/10"
      >
        {/* decorative circles */}
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
        <Label text="✦ At a glance" className="text-indigo-200 block mb-2.5" />
        <p className="relative text-sm sm:text-[15px] leading-relaxed font-medium text-white/90">
          {insights.quickSummary}
        </p>
      </motion.div>

      {/* ── 2. Best time + Money side by side ───────────────────── */}
      <motion.div variants={row} className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Best time to visit */}
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

        {/* Money at a glance */}
        <div className="flex flex-col gap-2.5">
          {/* Currency + tipping */}
          <div className="rounded-2xl border border-violet-100 dark:border-violet-800/30 bg-violet-50/50 dark:bg-violet-950/20 p-4 flex-1 flex flex-col gap-2.5">
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
        </div>
      </motion.div>

      {/* ── 3. Top experiences ──────────────────────────────────── */}
      <motion.div variants={row}>
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
                whileHover={{ y: -3, transition: { duration: 0.18 } }}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-shadow hover:shadow-md cursor-default",
                  accent.gradient,
                  accent.border,
                )}
              >
                {/* large watermark number */}
                <span
                  className={cn(
                    "absolute top-2 right-3 text-6xl font-black select-none pointer-events-none leading-none",
                    accent.watermark,
                  )}
                >
                  {i + 1}
                </span>
                {/* number badge */}
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

      {/* ── 4. Dos & Don'ts ─────────────────────────────────────── */}
      <motion.div variants={row} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* ── 5. Safety ───────────────────────────────────────────── */}
      <motion.div
        variants={row}
        className="rounded-2xl border border-orange-100 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-950/20 p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <FaShieldAlt className="text-orange-500 dark:text-orange-400 shrink-0" />
          <Label text="Safety" className="text-orange-700 dark:text-orange-400" />
        </div>
        {/* 2-col: risks + scams */}
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
        {/* Emergency help — full-width callout */}
        {insights.safety.gettingHelp && (
          <div className="rounded-xl bg-white/70 dark:bg-white/[0.05] border border-orange-100 dark:border-orange-800/20 px-3.5 py-3 text-sm text-gray-800 dark:text-white/80 leading-relaxed">
            <span className="font-bold text-orange-700 dark:text-orange-400">🚨 Emergency: </span>
            {insights.safety.gettingHelp}
          </div>
        )}
      </motion.div>

      {/* ── 6. Getting around ───────────────────────────────────── */}
      <motion.div variants={row}>
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

      {/* ── 7. Food & drink ─────────────────────────────────────── */}
      <motion.div
        variants={row}
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
        {/* payment tips that didn't fit above */}
        {insights.money.paymentTips.length > 2 && (
          <div className="mb-4">
            <Label text="More payment tips" className="text-pink-600/80 dark:text-pink-400/70 block mb-2" />
            <Bullet
              items={insights.money.paymentTips.slice(2)}
              className="text-gray-700 dark:text-white/80"
            />
          </div>
        )}
        {insights.foodAndDrink.waterAdvice && (
          <div className="rounded-xl bg-white/70 dark:bg-white/[0.05] border border-pink-100 dark:border-pink-800/20 px-3.5 py-3 text-sm text-gray-700 dark:text-white/80 flex items-start gap-2.5 leading-relaxed">
            <FaWater className="text-sky-400 dark:text-sky-500 shrink-0 mt-0.5" />
            <span>{insights.foodAndDrink.waterAdvice}</span>
          </div>
        )}
      </motion.div>

      {/* ── 8. Attribution ──────────────────────────────────────── */}
      <motion.div variants={row} className="flex items-center justify-center gap-1.5 pt-1 pb-1">
        <FaRobot className="text-[10px] text-gray-300 dark:text-white/15" />
        <p className="text-[10px] text-gray-300 dark:text-white/20 text-center">
          AI-generated travel advice · Verify time-sensitive details before you travel
        </p>
      </motion.div>

    </motion.div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface AITravelGuideProps {
  insights: AITravelInsights | null;
  loading: boolean;
  error: string | null;
  countryName: string;
  onLoad: () => void;
}

export default function AITravelGuide({
  insights,
  loading,
  error,
  countryName,
  onLoad,
}: AITravelGuideProps) {
  if (loading) return <GuideSkeleton />;
  if (error) return <GuideError error={error} onRetry={onLoad} />;
  if (insights) return <GuideContent insights={insights} />;
  return <IdleCard countryName={countryName} onLoad={onLoad} />;
}
