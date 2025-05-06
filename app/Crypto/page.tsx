"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSmile,
  FaMeh,
  FaFrown,
  FaAngry,
  FaGrinStars,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";

/* ---- lazy-loaded dashboard tabs ---- */
const LiveStreamHeatmap  = dynamic(() => import("./LiveStreamHeatmap"),  { ssr: false });
const TopGainersLosers   = dynamic(() => import("./TopGainersLosers"),   { ssr: false });
const CryptoChartPrices  = dynamic(() => import("./CryptoChartPrices"),  { ssr: false });

const tabs = [
  { name: "Heatmap",          component: <LiveStreamHeatmap  /> },
  { name: "Gainers & Losers", component: <TopGainersLosers   /> },
  { name: "Charts",           component: <CryptoChartPrices  /> },
];

/* ---------------- Mood → visuals + copy ----------------- */
type MoodInfo = {
  label: string;
  icon:  typeof FaSmile;
  color: string;
  copy:  string[];
};

const moodMap = (v: number | null): MoodInfo => {
  if (v == null)
    return {
      label: "?",
      icon: FaMeh,
      color: "text-amber-400",
      copy: [
        "Sentiment data is offline right now.",
        "Unable to retrieve the index; please try again later.",
        "Market thermometer is on break check back soon.",
        "No reading at the moment, stay tuned for updates.",
      ],
    };

  if (v >= 75)
    return {
      label: "Extreme Greed",
      icon: FaGrinStars,
      color: "text-green-600",
      copy: [
        "Optimism borders on over-confidence—perhaps take a few chips off the table.",
        "Headlines are uniformly bullish, remember markets move in cycles.",
        "Everyone seems certain of higher prices caution can be a useful habit.",
        "Green lights everywhere, review your risk before you celebrate.",
      ],
    };

  if (v >= 51)
    return {
      label: "Greed",
      icon: FaSmile,
      color: "text-green-400",
      copy: [
        "Momentum is strong, but discipline still matters.",
        "Positive sentiment is growing, don't let enthusiasm replace homework.",
        "Plenty of buyers around set realistic profit targets.",
        "The mood is upbeat follow your plan, not the crowd.",
      ],
    };

  if (v >= 25)
    return {
      label: "Fear",
      icon: FaFrown,
      color: "text-red-400",
      copy: [
        "Nerves are showing balanced portfolios help you sleep at night.",
        "Unease dominates conversation, opportunity often hides here.",
        "Traders are cautious, focus on fundamentals, not the noise.",
        "Price swings feel larger now—keep emotions in check.",
      ],
    };

  return {
    label: "Extreme Fear",
    icon: FaAngry,
    color: "text-red-600",
    copy: [
      "Panic selling is common rash decisions seldom age well.",
      "Screens are a sea of red, but perspective beats impulse.",
      "When confidence is scarce, quality assets often go on sale.",
      "Market anxiety is high—stick to your plan, not the headlines.",
    ],
  };
};

/* ---------------- Gauge component ------------------ */
interface GaugeProps {
  title: string;
  score: number | null;
  onClick: (d: PopupData) => void;
}

interface PopupData {
  title:   string;
  score:   number | null;
  label:   string;
  phrase:  string;
  color:   string;
  start:   string;
  end:     string;
}

const Gauge = ({ title, score, onClick }: GaugeProps) => {
  const { label, icon: Icon, color, copy } = moodMap(score);
  const pct  = score ?? 50;
  const ring = `conic-gradient(currentColor ${pct * 3.6}deg,#e5e7eb ${pct * 3.6}deg)`;

  const handleClick = () => {
    const phrase = copy[Math.floor(Math.random() * copy.length)];
    onClick({ title, score, label, phrase, color, start: "", end: "" });
    trackEvent("FGI_GaugeClick", { title, score, label });
  };

  return (
    <button
      className={`flex flex-col items-center gap-2 p-4 w-full max-w-xs ${color} focus:outline-none`}
      onClick={handleClick}
    >
      <h4 className="font-semibold">{title}</h4>

      <div
        className="w-28 h-28 rounded-full flex items-center justify-center"
        style={{ backgroundImage: ring }}
      >
        <div className="w-20 h-20 bg-white dark:bg-brand-900 rounded-full flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold">{score ?? "--"}</span>
          <span className="text-[10px]">{label}</span>
        </div>
      </div>

      <Icon className="text-lg" />
    </button>
  );
};

/* -------------- Wrapper with popup logic -------------- */
const MultiFGI = () => {
  const [today, setToday] = useState<number | null>(null);
  const [week,  setWeek]  = useState<number | null>(null);
  const [ytd,   setYtd]   = useState<number | null>(null);

  const [popup, setPopup] = useState<PopupData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const now       = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const dayCount  = Math.floor((now.getTime() - yearStart.getTime()) / 864e5) + 1;

        const url  = `https://api.alternative.me/fng/?limit=${dayCount}&format=json`;
        const json = await fetch(url).then(r => r.json());

        type Row = { value: string; timestamp: string };
        const rows: Row[] = Array.isArray(json?.data) ? json.data : [];
        const toNum = (r: Row) => parseInt(r.value ?? "0", 10);
        const toDate = (ts: string) =>
          new Date(parseInt(ts, 10) * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

        if (!rows.length) return;

        /* TODAY */
        setToday(toNum(rows[0]));

        /* WEEK (yesterday-6) */
        const weekRows = rows.slice(1, 8);
        if (weekRows.length) {
          const vals = weekRows.map(toNum);
          setWeek(Math.round(vals.reduce((s, v) => s + v, 0) / vals.length));
        }

        /* YTD */
        const ytdVals = rows.map(toNum);
        setYtd(Math.round(ytdVals.reduce((s, v) => s + v, 0) / ytdVals.length));

        /* build date ranges for popup later */
        const dateToday = toDate(rows[0].timestamp);
        const dateYesterday = rows[1] ? toDate(rows[1].timestamp) : dateToday;
        const dateWeekStart =
          weekRows[weekRows.length - 1]
            ? toDate(weekRows[weekRows.length - 1].timestamp)
            : dateYesterday;
        const dateYTDStart = yearStart.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        /* add handlers for PopupData to carry dates */
        const attachDates = (title: string, p: PopupData): PopupData => {
          if (title === "Today") {
            p.start = dateToday;
            p.end   = dateToday;
          } else if (title === "Last 7 Days") {
            p.start = dateWeekStart;
            p.end   = dateYesterday;
          } else {
            p.start = dateYTDStart;
            p.end   = dateToday;
          }
          return p;
        };

        /* override setPopup so dates are injected */
        setPopupFn(() => (d: PopupData) => setPopup(attachDates(d.title, d)));
      } catch (e) {
        console.error("FGI fetch error:", e);
      }
    })();
  }, []);

  /* we need a stable function reference after dates are known */
  const [popupFn, setPopupFn] = useState<(p: PopupData) => void>(() => setPopup);

  const closePopup = useCallback(() => setPopup(null), []);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-center gap-6">
        <Gauge title="Today"        score={today} onClick={popupFn} />
        <Gauge title="Last 7 Days"  score={week}  onClick={popupFn} />
        <Gauge title="Year-to-Date" score={ytd}   onClick={popupFn} />
      </div>

      {/* Popup */}
      <AnimatePresence>
        {popup && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePopup}
          >
            <motion.div
              className={`relative bg-white dark:bg-brand-900 rounded-lg shadow-lg max-w-sm w-full p-6 text-center ${popup.color}`}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* close */}
              <button
                className="absolute top-3 right-4 text-2xl"
                onClick={closePopup}
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

              <p className="text-base italic">{popup.phrase}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ---------------- Dashboard page ---------------- */
const CryptoDashboard = () => {
  const [active, setActive] = useState(0);

  useEffect(() => trackEvent("CryptoDashboard Page Viewed"), []);

  const handleTab = (i: number, name: string) => {
    setActive(i);
    trackEvent("Dashboard Tab Click", { tab: name });
  };

  return (
    <div className="min-h-screen p-4 space-y-8 dark:text-gray-100">
      <h1 className="text-4xl font-bold text-center">Crypto Dashboard</h1>
      <h2 className="font-bold text-center">Fear & Greed Index</h2>

      {/* gauges + popup */}
      <MultiFGI />

      {/* tabs */}
      <div className="flex justify-center border-b border-gray-700 mt-8 overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t.name}
            className={`px-6 py-2 text-lg font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === i
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent hover:border-gray-500"
            }`}
            onClick={() => handleTab(i, t.name)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-6">{tabs[active].component}</div>
    </div>
  );
};

export default CryptoDashboard;
