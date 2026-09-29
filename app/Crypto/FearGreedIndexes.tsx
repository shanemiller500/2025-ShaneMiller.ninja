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
} from "react-icons/fa";

import { Modal } from "@/components/ui/modal";
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
  if (v >= 26)
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
/*  Gauge Component — SVG arc meter                                    */
/* ------------------------------------------------------------------ */
const hexFor = (v: number | null) =>
  v == null ? "#f59e0b" : v >= 75 ? "#16a34a" : v >= 51 ? "#4ade80" : v >= 26 ? "#f87171" : "#dc2626";

/** Point on the 240° arc (from -210° to 30°) for a 0–100 value. */
const arcPoint = (v: number, r: number, c = 60) => {
  const a = ((-210 + (v / 100) * 240) * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
};
const ARC_R = 46;
const ARC_LEN = (240 / 360) * 2 * Math.PI * ARC_R;
const ARC_PATH = (() => {
  const [x0, y0] = arcPoint(0, ARC_R);
  const [x1, y1] = arcPoint(100, ARC_R);
  return `M ${x0} ${y0} A ${ARC_R} ${ARC_R} 0 1 1 ${x1} ${y1}`;
})();

interface GaugeProps {
  title: string;
  score: number | null;
  open: (d: PopupData) => void;
  index: number;
}

const Gauge = ({ title, score, open, index }: GaugeProps) => {
  const mood = moodMap(score);
  const hex = hexFor(score);
  const pct = score ?? 0;
  const [kx, ky] = arcPoint(pct, ARC_R);

  const handle = () => {
    const phrase = mood.copy[Math.floor(Math.random() * mood.copy.length)];
    open({ title, score, label: mood.label, phrase, color: mood.color, bg: mood.bg, icon: mood.icon, start: "", end: "" });
    trackEvent("FGI_GaugeClick", { title, score, label: mood.label });
  };

  return (
    <motion.button
      type="button"
      onClick={handle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group relative isolate flex flex-col items-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white px-4 pb-5 pt-4 text-center transition hover:-translate-y-0.5 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/20"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 -z-10 h-32 w-32 -translate-x-1/2 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-35"
        style={{ background: hex }}
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{title}</span>

      <svg viewBox="0 0 120 104" className="mt-1 w-full max-w-[170px]" aria-hidden>
        <defs>
          <linearGradient id={`fg-track-${index}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="35%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="65%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
        </defs>
        {/* track */}
        <path d={ARC_PATH} fill="none" strokeWidth="8" strokeLinecap="round" className="stroke-slate-100 dark:stroke-white/[0.06]" />
        {/* value */}
        <motion.path
          d={ARC_PATH}
          fill="none"
          stroke={`url(#fg-track-${index})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          initial={{ strokeDashoffset: ARC_LEN }}
          animate={{ strokeDashoffset: ARC_LEN * (1 - pct / 100) }}
          transition={{ duration: 1.1, delay: 0.15 + index * 0.06, ease: "easeOut" }}
        />
        {/* ticks */}
        {[0, 25, 50, 75, 100].map((t) => {
          const [ax, ay] = arcPoint(t, 36);
          const [bx, by] = arcPoint(t, 32);
          return <line key={t} x1={ax} y1={ay} x2={bx} y2={by} strokeWidth="1.2" className="stroke-slate-300 dark:stroke-white/15" />;
        })}
        {/* knob */}
        {score != null && (
          <motion.circle
            r="5"
            cx={kx}
            cy={ky}
            fill="white"
            stroke={hex}
            strokeWidth="3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.1 + index * 0.06 }}
            style={{ filter: `drop-shadow(0 0 6px ${hex})` }}
          />
        )}
        <text x="60" y="66" textAnchor="middle" className="fill-slate-900 font-mono dark:fill-white" style={{ fontSize: 26, fontWeight: 600 }}>
          {score ?? "--"}
        </text>
        <text x="60" y="80" textAnchor="middle" className="fill-slate-400 font-mono" style={{ fontSize: 7, letterSpacing: 1 }}>
          / 100
        </text>
      </svg>

      <span className="-mt-2 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: hex }}>
        <mood.icon className="h-3.5 w-3.5" />
        {mood.label}
      </span>
    </motion.button>
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
    <div key={key} className="flex h-[196px] flex-col items-center gap-3 rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]">
      <div className="h-3 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
      <div className="h-28 w-28 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.06]" />
    </div>
  );

  const gauges = isLoading
    ? [1, 2, 3, 4].map(skeletonCard)
    : [
        { title: "Today",        score: today },
        { title: "Last 7 Days",  score: week  },
        { title: "Year-to-Date", score: ytd   },
        { title: "12 Months",    score: year  },
      ].map((g, i) => <Gauge key={g.title} title={g.title} score={g.score} open={popupEnhancer} index={i} />);

  const closeMethodology = useCallback(() => setShowMethodology(false), []);
  const popupHex = popup ? hexFor(popup.score) : undefined;

  return (
    <div className="p-3 sm:p-5">
      {/* ── Intro ── */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Fear &amp; Greed Index</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            Market sentiment across four time horizons. Tap a gauge for details.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowMethodology(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white"
        >
          <FaInfoCircle className="h-3 w-3 text-indigo-500" />
          How it&apos;s calculated
        </button>
      </div>

      {/* ── Gauges ── */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">{gauges}</div>

      {/* ── Legend ── */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        {[
          { hex: "#dc2626", label: "0–25 Extreme fear" },
          { hex: "#f87171", label: "26–50 Fear" },
          { hex: "#4ade80", label: "51–74 Greed" },
          { hex: "#16a34a", label: "75–100 Extreme greed" },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: item.hex, boxShadow: `0 0 8px ${item.hex}` }} />
            {item.label}
          </span>
        ))}
      </div>

      {/* ── Methodology Modal ── */}
      <Modal open={showMethodology} onClose={closeMethodology} labelledBy="fg-method-title" size="sm">
        <div className="p-6">
          <h4 id="fg-method-title" className="text-base font-semibold text-slate-900 dark:text-white">How it&apos;s calculated</h4>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">A weighted blend of six signals.</p>
          <div className="mt-5 space-y-3">
            {methodology.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-600 dark:text-slate-300">{item.label}</span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">{item.weight}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${parseInt(item.weight, 10) * 4}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-wider text-slate-400">Source · alternative.me</p>
        </div>
      </Modal>

      {/* ── Detail Popup ── */}
      <Modal open={!!popup} onClose={close} labelledBy="fg-detail-title" accent={popupHex}>
        {popup && (
          <div className="relative isolate px-6 pb-7 pt-8 text-center">
            <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-48 w-72 -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: popupHex }} />
            <p id="fg-detail-title" className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{popup.title}</p>
            <div className="mt-3 inline-flex items-baseline gap-1.5">
              <span className="font-mono text-6xl font-semibold tabular-nums" style={{ color: popupHex }}>{popup.score ?? "--"}</span>
              <span className="font-mono text-lg text-slate-400">/100</span>
            </div>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-base font-semibold" style={{ color: popupHex }}>
              <popup.icon className="h-4 w-4" />
              {popup.label}
            </p>

            {/* position on the scale */}
            <div className="relative mx-auto mt-5 h-1.5 max-w-xs rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-green-600">
              <motion.span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 dark:border-[#1a1a1d] dark:bg-white"
                initial={{ left: "50%" }}
                animate={{ left: `${popup.score ?? 50}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 22 }}
              />
            </div>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-mono text-[11px] text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
              <FaCalendarAlt className="h-3 w-3 text-indigo-500" />
              {popup.start && popup.start !== popup.end ? `${popup.start} → ${popup.end}` : popup.start || "—"}
            </div>

            <p className="mx-auto mt-5 max-w-sm text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
              &ldquo;{popup.phrase}&rdquo;
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
