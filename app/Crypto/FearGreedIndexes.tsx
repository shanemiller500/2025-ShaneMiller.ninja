"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSmile,
  FaMeh,
  FaFrown,
  FaAngry,
  FaGrinStars,
  FaTimesCircle,
  FaCalendarAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";

/* ---------- mood helper ---------- */
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

/* ---------- popup data ---------- */
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

/* ---------- Gauge component ---------- */
const Gauge = ({
  title,
  score,
  open,
}: {
  title: string;
  score: number | null;
  open: (d: PopupData) => void;
}) => {
  const mood = moodMap(score);
  const pct = score ?? 50;
  const ring = `conic-gradient(currentColor ${pct * 3.6}deg,#e5e7eb ${pct * 3.6}deg)`;
  const phrase = mood.copy[Math.floor(Math.random() * mood.copy.length)];

  const handle = () => {
    open({
      title,
      score,
      label: mood.label,
      phrase,
      color: mood.color,
      bg: mood.bg,
      icon: mood.icon,
      start: "",
      end: "",
    });
    trackEvent("FGI_GaugeClick", { title, score, label: mood.label });
  };

  return (
    <div
      onClick={handle}
      className={`cursor-pointer flex flex-col items-center gap-2 p-3 sm:p-4 transition-transform hover:scale-105 ${mood.color}`}
    >
      <h4 className="font-semibold text-xs sm:text-sm">{title}</h4>
      <div
        className="w-20 h-20 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
        style={{ backgroundImage: ring }}
      >
        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white dark:bg-gray-900 rounded-full flex flex-col items-center justify-center">
          <span className="text-lg sm:text-2xl font-bold">
            {score ?? "--"}
          </span>
          <span className="text-[9px] sm:text-[10px]">{mood.label}</span>
        </div>
      </div>
      <mood.icon className="text-base sm:text-lg" />
    </div>
  );
};

/* ---------- Main component ---------- */
export default function FearGreedIndexes() {
  const [today, setToday] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [ytd, setYtd] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

        const toNum = (r: Row) => parseInt(r.value ?? "0", 10);
        const toDate = (ts: string) =>
          new Date(parseInt(ts, 10) * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

        setToday(toNum(rows[0]));

        const weekRows = rows.slice(1, 8);
        if (weekRows.length)
          setWeek(
            Math.round(
              weekRows.map(toNum).reduce((s, v) => s + v, 0) / weekRows.length
            )
          );

        const jan1 = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
        const ytdRows = rows.filter((r) => parseInt(r.timestamp, 10) >= jan1);
        if (ytdRows.length)
          setYtd(
            Math.round(
              ytdRows.map(toNum).reduce((s, v) => s + v, 0) / ytdRows.length
            )
          );

        const yearRows = rows.slice(0, 365);
        setYear(
          Math.round(
            yearRows.map(toNum).reduce((s, v) => s + v, 0) / yearRows.length
          )
        );

        const dateToday = toDate(rows[0].timestamp);
        const dateYest = rows[1] ? toDate(rows[1].timestamp) : dateToday;
        const dateWeekSt = weekRows.length
          ? toDate(weekRows[weekRows.length - 1].timestamp)
          : dateYest;
        const dateYearSt = yearRows.length
          ? toDate(yearRows[yearRows.length - 1].timestamp)
          : dateToday;
        const dateYTDSt = new Date(
          now.getFullYear(),
          0,
          1
        ).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        const withDates = (g: string, p: PopupData) => {
          if (g === "Today") {
            p.start = dateToday;
            p.end = dateToday;
          } else if (g === "Last 7 Days") {
            p.start = dateWeekSt;
            p.end = dateYest;
          } else if (g === "Year-to-Date") {
            p.start = dateYTDSt;
            p.end = dateToday;
          } else {
            p.start = dateYearSt;
            p.end = dateToday;
          }
          return p;
        };

        setPopupEnhancer(
          () => (d: PopupData) => setPopup(withDates(d.title, d))
        );
      } catch (err) {
        console.error("FGI fetch error:", err);
      }
    })();
  }, []);

  const [popupEnhancer, setPopupEnhancer] = useState<
    (d: PopupData) => void
  >(() => setPopup);

  const close = useCallback(() => setPopup(null), []);

  const gauges = (
    <div className="flex flex-col lg:flex-row flex-wrap justify-center gap-4 sm:gap-6">
      <Gauge title="Today" score={today} open={popupEnhancer} />
      <Gauge title="Last 7 Days" score={week} open={popupEnhancer} />
      <Gauge title="Year-to-Date" score={ytd} open={popupEnhancer} />
      <Gauge title="12 Months" score={year} open={popupEnhancer} />
    </div>
  );

  return (
    <>
      {/* Mobile hamburger with label */}
      <div className="sm:hidden flex items-center justify-end p-2 gap-2">
        <span className="text-xs italic text-gray-600 dark:text-gray-400">
          View Gauges
        </span>
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? (
            <FaTimes className="text-2xl" />
          ) : (
            <FaBars className="text-2xl" />
          )}
        </button>
      </div>

      {/* Mobile gauges */}
      {mobileOpen && <div className="sm:hidden px-2">{gauges}</div>}

      {/* Desktop gauges */}
      
      <div className="hidden sm:block">{gauges}</div>

      {/* Popup */}
      <AnimatePresence>
        {popup && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-xl bg-white dark:bg-brand-900 border border-gray-200 dark:border-gray-700 shadow-2xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`h-2 w-full ${popup.bg}`} />

              <button
                className="absolute top-3 right-4 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                aria-label="Close"
                onClick={close}
              >
                <FaTimesCircle className="text-xl" />
              </button>

              <div className="px-8 py-10 text-center">
                <popup.icon
                  className={`mx-auto mb-5 text-5xl drop-shadow-sm ${popup.color}`}
                />
                <h3 className="text-2xl font-extrabold tracking-tight mb-1">
                  {popup.title}
                </h3>
                <p className="mb-4 text-lg font-medium">
                  <span className="text-4xl font-black">{popup.score}</span> –{" "}
                  {popup.label}
                </p>
                <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-300 flex items-center justify-center flex-wrap">
                  <FaCalendarAlt className="inline mr-2" />
                  {popup.start === popup.end ? (
                    `Date: ${popup.start}`
                  ) : (
                    <>
                      From {popup.start} to{" "}
                      <FaCalendarAlt className="inline mx-1" /> {popup.end}
                    </>
                  )}
                </p>
                <p className="italic text-neutral-800 dark:text-neutral-200">
                  {popup.phrase}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
