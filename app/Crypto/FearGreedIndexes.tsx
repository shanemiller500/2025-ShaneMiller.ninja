"use client";

import { useState, useEffect, useCallback } from "react";

import { AnimatePresence, motion } from "framer-motion";
import {
  FaAngry,
  FaCalendarAlt,
  FaFrown,
  FaGrinStars,
  FaInfoCircle,
  FaMeh,
  FaSmile,
  FaTimes,
} from "react-icons/fa";

import { gaugeGradient } from "@/utils/colors";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type MoodInfo = {
  label: string;
  icon: typeof FaSmile;
  color: string;
  bg: string;
  copy: string[];
};

const moodMap = (v: number | null): MoodInfo => {
  if (v == null)
    return {
      label: "?",
      icon: FaMeh,
      color: "text-amber-500",
      bg: "bg-amber-500",
      copy: [
        "Sentiment data is offline right now.",
        "Unable to retrieve the index; please try again later.",
        "Market thermometer is on break; check back soon.",
        "No reading at the moment; stay tuned for updates.",
      ],
    };
  if (v >= 75)
    return {
      label: "Extreme Greed",
      icon: FaGrinStars,
      color: "text-green-600",
      bg: "bg-green-600",
      copy: [
        "Optimism borders on over-confidence—consider trimming gains.",
        "Headlines are uniformly bullish; remember cycles repeat.",
        "Everyone expects higher prices; caution is healthy.",
        "Green lights everywhere—review your risk management.",
      ],
    };
  if (v >= 51)
    return {
      label: "Greed",
      icon: FaSmile,
      color: "text-green-400",
      bg: "bg-green-400",
      copy: [
        "Momentum is strong, yet discipline still matters.",
        "Positive sentiment is building; stay grounded in research.",
        "Plenty of buyers—set realistic targets.",
        "Mood is upbeat; stick to your trading plan.",
      ],
    };
  if (v >= 25)
    return {
      label: "Fear",
      icon: FaFrown,
      color: "text-red-400",
      bg: "bg-red-400",
      copy: [
        "Nerves are showing—balanced portfolios help you rest.",
        "Unease dominates talk; opportunity often hides here.",
        "Caution prevails; fundamentals matter more than noise.",
        "Swings feel larger now—keep emotions in check.",
      ],
    };
  return {
    label: "Extreme Fear",
    icon: FaAngry,
    color: "text-red-600",
    bg: "bg-red-600",
    copy: [
      "Panic selling is common—rash decisions seldom age well.",
      "Screens are red; perspective beats impulse.",
      "Confidence is scarce; quality assets often go on sale.",
      "Anxiety is high—stay committed to your plan.",
    ],
  };
};

interface PopupData {
  title: string;
  score: number | null;
  label: string;
  phrase: string;
  color: string;
  bg: string;
  icon: typeof FaSmile;
  start: string;
  end: string;
}

/* ------------------------------------------------------------------ */
/*  Methodology Data                                                   */
/* ------------------------------------------------------------------ */
const methodology = [
  { label: "Volatility",         weight: "25%" },
  { label: "Market Momentum",    weight: "25%" },
  { label: "Social Media",       weight: "15%" },
  { label: "Surveys",            weight: "15%" },
  { label: "Bitcoin Dominance",  weight: "10%" },
  { label: "Google Trends",      weight: "10%" },
];

/* ------------------------------------------------------------------ */
/*  Gauge Component                                                    */
/* ------------------------------------------------------------------ */
interface GaugeProps {
  title: string;
  score: number | null;
  open: (d: PopupData) => void;
}

const Gauge = ({ title, score, open }: GaugeProps) => {
  const mood = moodMap(score);
  const pct = score ?? 50;
  const ring = gaugeGradient(pct);
  const phrase = mood.copy[Math.floor(Math.random() * mood.copy.length)];

  const handle = () => {
    open({ title, score, label: mood.label, phrase, color: mood.color, bg: mood.bg, icon: mood.icon, start: "", end: "" });
    trackEvent("FGI_GaugeClick", { title, score, label: mood.label });
  };

  return (
    <motion.div
      onClick={handle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.06] shadow-sm hover:shadow-md transition-all border border-gray-200/70 dark:border-white/10"
    >
      <h4 className="font-bold text-xs sm:text-sm tracking-wide text-gray-600 dark:text-white/70 uppercase">{title}</h4>
      <div className="relative pb-2">
        <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center shadow-md" style={{ backgroundImage: ring }}>
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white dark:bg-brand-900 rounded-full flex items-center justify-center shadow-inner">
            <span className="text-3xl sm:text-4xl font-black text-gray-800 dark:text-white">{score ?? "--"}</span>
          </div>
        </div>
        <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${mood.bg} rounded-full p-2.5 shadow-lg`}>
          <mood.icon className="text-white text-lg sm:text-xl" />
        </div>
      </div>
      <p className={`text-xs sm:text-sm font-bold ${mood.color}`}>{mood.label}</p>
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/*  FearGreedIndexes Component                                         */
/* ------------------------------------------------------------------ */
export default function FearGreedIndexes() {
  const [today, setToday] = useState<number | null>(null);
  const [week,  setWeek]  = useState<number | null>(null);
  const [ytd,   setYtd]   = useState<number | null>(null);
  const [year,  setYear]  = useState<number | null>(null);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  /* fetch data */
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const json = await fetch(
          "https://api.alternative.me/fng/?limit=400&format=json"
        ).then((r) => r.json());

        type Row = { value: string; timestamp: string };
        const rows: Row[] = Array.isArray(json?.data) ? json.data : [];
        if (!rows.length) return;

        const toNum  = (r: Row) => parseInt(r.value ?? "0", 10);
        const toDate = (ts: string) =>
          new Date(parseInt(ts, 10) * 1000).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          });

        setToday(toNum(rows[0]));

        const weekRows = rows.slice(1, 8);
        if (weekRows.length)
          setWeek(Math.round(weekRows.map(toNum).reduce((s, v) => s + v, 0) / weekRows.length));

        const jan1 = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
        const ytdRows = rows.filter((r) => parseInt(r.timestamp, 10) >= jan1);
        if (ytdRows.length)
          setYtd(Math.round(ytdRows.map(toNum).reduce((s, v) => s + v, 0) / ytdRows.length));

        const yearRows = rows.slice(0, 365);
        setYear(Math.round(yearRows.map(toNum).reduce((s, v) => s + v, 0) / yearRows.length));

        const dateToday  = toDate(rows[0].timestamp);
        const dateYest   = rows[1] ? toDate(rows[1].timestamp) : dateToday;
        const dateWeekSt = weekRows.length ? toDate(weekRows[weekRows.length - 1].timestamp) : dateYest;
        const dateYearSt = yearRows.length ? toDate(yearRows[yearRows.length - 1].timestamp) : dateToday;
        const dateYTDSt  = new Date(now.getFullYear(), 0, 1).toLocaleDateString(undefined, {
          year: "numeric", month: "short", day: "numeric",
        });

        const withDates = (g: string, p: PopupData) => {
          if (g === "Today")          { p.start = dateToday;  p.end = dateToday; }
          else if (g === "Last 7 Days") { p.start = dateWeekSt; p.end = dateYest; }
          else if (g === "Year-to-Date") { p.start = dateYTDSt; p.end = dateToday; }
          else                          { p.start = dateYearSt; p.end = dateToday; }
          return p;
        };

        setPopupEnhancer(() => (d: PopupData) => setPopup(withDates(d.title, d)));
      } catch (err) {
        console.error("FGI fetch error:", err);
      }
    })();
  }, []);

  const [popupEnhancer, setPopupEnhancer] = useState<(d: PopupData) => void>(() => setPopup);

  const close = useCallback(() => setPopup(null), []);

  const isLoading = today === null && week === null && ytd === null && year === null;

  const skeletonCard = (key: number) => (
    <div key={key} className="flex flex-col items-center gap-3 p-5 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.06] border border-gray-200/70 dark:border-white/10 animate-pulse">
      <div className="h-4 w-20 bg-gray-200 dark:bg-white/10 rounded-full" />
      <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-gray-200 dark:bg-white/10" />
      <div className="h-3 w-16 bg-gray-200 dark:bg-white/10 rounded-full" />
    </div>
  );

  const gauges = isLoading
    ? [1, 2, 3, 4].map(skeletonCard)
    : [
        { title: "Today",        score: today },
        { title: "Last 7 Days",  score: week  },
        { title: "Year-to-Date", score: ytd   },
        { title: "12 Months",    score: year  },
      ].map((g) => <Gauge key={g.title} title={g.title} score={g.score} open={popupEnhancer} />);

  return (
    <div className="py-4 px-4 sm:py-6 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Intro ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Fear & Greed Index
            </h2>
            <button
              type="button"
              onClick={() => setShowMethodology(true)}
              className="text-indigo-500 hover:scale-110 transition-transform"
              aria-label="How it's calculated"
            >
              <FaInfoCircle className="text-lg sm:text-xl" />
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-white/50 max-w-lg mx-auto">
            Real-time sentiment across four time horizons. Tap any card for details.
          </p>
        </motion.div>

        {/* ── Gauges ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {gauges}
        </motion.div>

        {/* ── Legend ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.16 }}
          className="flex justify-center"
        >
          <div className="inline-flex flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-3 rounded-2xl bg-white dark:bg-white/[0.06] border border-gray-200/70 dark:border-white/10 shadow-sm">
            {[
              { color: "bg-red-600",   label: "0–25 · Extreme Fear" },
              { color: "bg-red-400",   label: "26–50 · Fear" },
              { color: "bg-green-400", label: "51–74 · Greed" },
              { color: "bg-green-600", label: "75–100 · Extreme Greed" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.color}`} />
                <span className="text-xs font-medium text-gray-500 dark:text-white/50 whitespace-nowrap">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* ── Methodology Modal ── */}
      <AnimatePresence>
        {showMethodology && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMethodology(false)}
          >
            <motion.div
              className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-brand-900 shadow-2xl border border-gray-200/70 dark:border-white/10 overflow-hidden"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-indigo-500" />
              <button
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/15 transition"
                onClick={() => setShowMethodology(false)}
              >
                <FaTimes className="text-sm" />
              </button>
              <div className="p-6">
                <h4 className="font-bold text-base mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <FaInfoCircle className="text-indigo-500" />
                  How It&apos;s Calculated
                </h4>
                <div className="space-y-1">
                  {methodology.map((item, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-white/[0.08] last:border-0">
                      <span className="text-sm text-gray-600 dark:text-white/60">{item.label}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{item.weight}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 text-xs text-gray-400 dark:text-white/40 italic text-center">
                  Data from Alternative.me API
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail Popup ── */}
      <AnimatePresence>
        {popup && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-brand-900 shadow-2xl border border-gray-200/70 dark:border-white/10"
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`h-1 w-full ${popup.bg}`} />
              <button
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/15 transition hover:rotate-90 duration-200"
                aria-label="Close"
                onClick={close}
              >
                <FaTimes className="text-sm" />
              </button>

              <div className="px-6 sm:px-8 py-8 sm:py-10 text-center">
                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${popup.bg} mb-5 shadow-lg`}>
                  <popup.icon className="text-white text-4xl" />
                </div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-white/50 mb-1 uppercase tracking-widest">
                  {popup.title}
                </h3>
                <div className="mb-5">
                  <div className="inline-flex items-baseline gap-2">
                    <span className={`text-6xl font-black ${popup.color}`}>{popup.score ?? "--"}</span>
                    <span className="text-2xl font-semibold text-gray-400 dark:text-white/30">/ 100</span>
                  </div>
                  <p className={`mt-1.5 text-base font-bold ${popup.color}`}>{popup.label}</p>
                </div>
                <div className="mb-5 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/[0.06] border border-gray-100 dark:border-white/10">
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-white/60">
                    <FaCalendarAlt className="text-indigo-500 shrink-0" />
                    {popup.start === popup.end ? (
                      <span className="font-medium">{popup.start}</span>
                    ) : (
                      <span className="font-medium">{popup.start} → {popup.end}</span>
                    )}
                  </div>
                </div>
                <div className="px-5 py-4 rounded-2xl bg-indigo-50 dark:bg-white/[0.06] border border-indigo-100 dark:border-white/10">
                  <p className="text-sm leading-relaxed text-gray-700 dark:text-white/80 italic font-medium">
                    &ldquo;{popup.phrase}&rdquo;
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
