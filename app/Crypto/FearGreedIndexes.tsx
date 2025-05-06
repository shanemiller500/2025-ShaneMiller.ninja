"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSmile,
  FaMeh,
  FaFrown,
  FaAngry,
  FaGrinStars,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";

/* ---------- mood helper ---------- */
type MoodInfo = { label: string; icon: typeof FaSmile; color: string; copy: string[] };

const moodMap = (v: number | null): MoodInfo => {
  if (v == null)
    return {
      label: "?",
      icon: FaMeh,
      color: "text-amber-400",
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
    copy: [
      "Panic selling is common—rash decisions seldom age well.",
      "Screens are red; perspective beats impulse.",
      "Confidence is scarce; quality assets often go on sale.",
      "Anxiety is high—stay committed to your plan.",
    ],
  };
};

/* ---------- gauge + popup ---------- */
interface PopupData {
  title: string;
  score: number | null;
  label: string;
  phrase: string;
  color: string;
  start: string;
  end: string;
}

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
  const pct  = score ?? 50;
  const ring = `conic-gradient(currentColor ${pct * 3.6}deg,#e5e7eb ${pct * 3.6}deg)`;
  const phrase = mood.copy[Math.floor(Math.random() * mood.copy.length)];

  const handle = () => {
    open({
      title,
      score,
      label: mood.label,
      phrase,
      color: mood.color,
      start: "",
      end: "",
    });
    trackEvent("FGI_GaugeClick", { title, score, label: mood.label });
  };

  return (
    <button
      className={`flex flex-col items-center gap-2 p-4 max-w-xs ${mood.color}`}
      onClick={handle}
    >
      <h4 className="font-semibold">{title}</h4>
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ backgroundImage: ring }}
      >
        <div className="w-20 h-20 bg-white dark:bg-brand-900 rounded-full flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{score ?? "--"}</span>
          <span className="text-[10px]">{mood.label}</span>
        </div>
      </div>
      <mood.icon className="text-lg" />
    </button>
  );
};

const FearGreedIndexes = () => {
  const [today, setToday]   = useState<number | null>(null);
  const [week,  setWeek]    = useState<number | null>(null);
  const [ytd,   setYtd]     = useState<number | null>(null);
  const [year,  setYear]    = useState<number | null>(null);   // 12-month gauge
  const [popup, setPopup]   = useState<PopupData | null>(null);

  /* fetch */
  useEffect(() => {
    (async () => {
      try {
        const now   = new Date();
        const url   = `https://api.alternative.me/fng/?limit=400&format=json`;
        const json  = await fetch(url).then(r => r.json());
        type Row    = { value: string; timestamp: string };
        const rows: Row[] = Array.isArray(json?.data) ? json.data : [];
        if (!rows.length) return;

        const toNum  = (r: Row) => parseInt(r.value ?? "0", 10);
        const toDate = (ts: string) =>
          new Date(parseInt(ts, 10) * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

        /* Today */
        setToday(toNum(rows[0]));

        /* Week average (yesterday-6) */
        const weekRows = rows.slice(1, 8);
        if (weekRows.length)
          setWeek(
            Math.round(weekRows.map(toNum).reduce((s, v) => s + v, 0) / weekRows.length)
          );

        /* YTD average */
        const jan1 = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
        const ytdRows = rows.filter(r => parseInt(r.timestamp, 10) >= jan1);
        if (ytdRows.length)
          setYtd(
            Math.round(ytdRows.map(toNum).reduce((s, v) => s + v, 0) / ytdRows.length)
          );

        /* 12-month average (last 365 values or all available) */
        const yearRows = rows.slice(0, 365);
        setYear(
          Math.round(yearRows.map(toNum).reduce((s, v) => s + v, 0) / yearRows.length)
        );

        /* date helpers for popup */
        const dateToday  = toDate(rows[0].timestamp);
        const dateYest   = rows[1] ? toDate(rows[1].timestamp) : dateToday;
        const dateWeekSt = weekRows.length ? toDate(weekRows[weekRows.length - 1].timestamp) : dateYest;
        const dateYearSt = yearRows.length ? toDate(yearRows[yearRows.length - 1].timestamp) : dateToday;
        const dateYTDSt  = (new Date(now.getFullYear(), 0, 1)).toLocaleDateString(undefined, {
          year: "numeric", month: "short", day: "numeric",
        });

        /* attach range info */
        const withDates = (g: string, p: PopupData): PopupData => {
          if (g === "Today")          { p.start = dateToday;  p.end = dateToday; }
          else if (g === "Last 7 Days"){ p.start = dateWeekSt; p.end = dateYest; }
          else if (g === "Year-to-Date"){ p.start = dateYTDSt;  p.end = dateToday; }
          else { /* 12 Months */        p.start = dateYearSt; p.end = dateToday; }
          return p;
        };
        setPopupEnhancer(() => (d: PopupData) => setPopup(withDates(d.title, d)));
      } catch (err) {
        console.error("FGI fetch error:", err);
      }
    })();
  }, []);

  /* stable setter once dates are known */
  const [popupEnhancer, setPopupEnhancer] =
    useState<(d: PopupData) => void>(() => setPopup);

  const close = useCallback(() => setPopup(null), []);

  return (
    <>
      <div className="flex flex-col lg:flex-row flex-wrap justify-center gap-6">
        <Gauge title="Today"          score={today} open={popupEnhancer} />
        <Gauge title="Last 7 Days"    score={week}  open={popupEnhancer} />
        <Gauge title="Year-to-Date"   score={ytd}   open={popupEnhancer} />
        <Gauge title="12 Months"      score={year}  open={popupEnhancer} />
      </div>

      <AnimatePresence>
        {popup && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className={`relative bg-white dark:bg-brand-900 rounded-lg shadow-lg max-w-sm w-full p-6 text-center ${popup.color}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-4 text-2xl"
                onClick={close}
              >
                ×
              </button>

              <h3 className="text-xl font-bold mb-1">{popup.title}</h3>
              <p className="mb-2">
                <span className="text-3xl font-extrabold">{popup.score}</span>{" "}
                – {popup.label}
              </p>

              <p className="text-sm mb-4">
                {popup.start === popup.end
                  ? `Date: ${popup.start}`
                  : `From ${popup.start} to ${popup.end}`}
              </p>

              <p className="italic">{popup.phrase}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FearGreedIndexes;
