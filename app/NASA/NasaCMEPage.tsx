"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Flame, Gauge, Loader2, Radio, Sun, Zap } from "lucide-react";

import { trackEvent } from "@/utils/mixpanel";
import { Segmented } from "@/components/ui/segmented";
import { IconBadge } from "@/components/ui/icon-badge";

import { nasaGet } from "./nasaFetch";
type Range = "7" | "30" | "90";

interface Flare { flrID: string; beginTime: string; peakTime?: string; endTime?: string; classType?: string; sourceLocation?: string; activeRegionNum?: number; link?: string; note?: string }
interface CME {
  activityID: string; startTime: string; sourceLocation?: string; note?: string; link?: string;
  cmeAnalyses?: { isMostAccurate?: boolean; speed?: number; type?: string; halfAngle?: number }[] | null;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const when = (t?: string) => (t ? new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
// Flare classes run A < B < C < M < X, each ×10 stronger; the number scales within the class.
const flareScore = (c?: string) => (c ? "ABCMX".indexOf(c[0]) * 10 + (parseFloat(c.slice(1)) || 0) : -1);
const FLARE_STYLE: Record<string, string> = {
  X: "bg-rose-500 text-white shadow-[0_0_14px_rgba(244,63,94,0.7)]",
  M: "bg-orange-500 text-white",
  C: "bg-amber-400 text-slate-900",
  B: "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-white",
  A: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};
const bestAnalysis = (c: CME) => c.cmeAnalyses?.find((a) => a.isMostAccurate) || c.cmeAnalyses?.[0];

export default function NasaDONKIPage() {
  const [range, setRange] = useState<Range>("30");
  const [flares, setFlares] = useState<Flare[]>([]);
  const [cmes, setCmes] = useState<CME[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: Range) => {
    setLoading(true); setError(null);
    const end = new Date(), start = new Date();
    start.setUTCDate(start.getUTCDate() - Number(days));
    const q = { startDate: isoDay(start), endDate: isoDay(end) };
    try {
      const [f, c] = await Promise.all([nasaGet<Flare[]>("DONKI/FLR", q), nasaGet<CME[]>("DONKI/CME", q)]);
      const byTime = <T,>(list: T[], key: (x: T) => string) => [...list].sort((a, b) => +new Date(key(b)) - +new Date(key(a)));
      setFlares(byTime(Array.isArray(f) ? f : [], (x: Flare) => x.peakTime || x.beginTime));
      setCmes(byTime(Array.isArray(c) ? c : [], (x: CME) => x.startTime));
      trackEvent("DONKI Data Fetched", { days });
    } catch {
      setError("NASA's space weather service didn't answer. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(range); }, [range, load]);

  const strongest = useMemo(() => flares.reduce<Flare | null>((best, f) => (!best || flareScore(f.classType) > flareScore(best.classType) ? f : best), null), [flares]);
  const fastest = useMemo(() => cmes.reduce<{ cme: CME; speed: number } | null>((best, c) => {
    const speed = bestAnalysis(c)?.speed || 0;
    return !best || speed > best.speed ? { cme: c, speed } : best;
  }, null), [cmes]);
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = { X: 0, M: 0, C: 0, B: 0 };
    flares.forEach((f) => { const k = f.classType?.[0]; if (k && k in counts) counts[k]++; });
    return counts;
  }, [flares]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={Sun} tone="amber" size="lg" label="Space weather" pulse />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Space weather</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Solar flares &amp; coronal mass ejections · NASA DONKI</p>
          </div>
        </div>
        <Segmented id="donkiRange" ariaLabel="Time range" value={range} onChange={setRange}
          options={[{ key: "7", label: "7 days" }, { key: "30", label: "30 days" }, { key: "90", label: "90 days" }]} />
      </div>

      {/* The sun, doing its thing */}
      <div className="relative mb-5 overflow-hidden rounded-3xl border border-slate-200/70 bg-[#0b0602] p-5 dark:border-white/[0.08] sm:p-7">
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#fff7c2_0%,#ffb020_35%,#ff5a1f_60%,transparent_72%)] opacity-90 blur-[1px] [animation:pulse_4s_ease-in-out_infinite]" />
        <div aria-hidden className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="relative grid gap-4 sm:grid-cols-3">
          <Hero icon={Flame} label="Strongest flare" value={strongest?.classType || "—"} note={strongest ? `Peaked ${when(strongest.peakTime || strongest.beginTime)}` : "No flares logged"} />
          <Hero icon={Gauge} label="Fastest CME" value={fastest?.speed ? `${fastest.speed.toLocaleString()} km/s` : "—"} note={fastest?.speed ? `${Math.round((150_000_000 / fastest.speed) / 3600)} h to reach Earth's distance` : "No speed measured"} />
          <Hero icon={Radio} label="Events logged" value={`${flares.length} · ${cmes.length}`} note="Flares · CMEs in this window" />
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {Object.entries(classCounts).map(([k, n]) => (
            <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] ${FLARE_STYLE[k]}`}>{k}-class <b>{n}</b></span>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-200">{error}</div>}
      {loading && <p className="flex items-center justify-center gap-2 py-10 font-mono text-[11px] uppercase tracking-wider text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Reading the sun…</p>}

      {!loading && !error && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden />Solar flares ({flares.length})
            </h3>
            <div className="space-y-2">
              {flares.slice(0, 40).map((f, i) => (
                <motion.a key={f.flrID} href={f.link} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 transition hover:border-amber-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-amber-400/40">
                  <span className={`w-14 shrink-0 rounded-lg py-1 text-center font-mono text-xs font-bold ${FLARE_STYLE[f.classType?.[0] || "A"] || FLARE_STYLE.A}`}>{f.classType || "?"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">Peak {when(f.peakTime || f.beginTime)}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {[f.sourceLocation, f.activeRegionNum ? `AR ${f.activeRegionNum}` : null].filter(Boolean).join(" · ") || "Location unknown"}
                    </span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-amber-500" aria-hidden />
                </motion.a>
              ))}
              {!flares.length && <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center font-mono text-xs text-slate-400 dark:border-white/10">A quiet sun. No flares logged.</p>}
            </div>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Sun className="h-3.5 w-3.5 text-orange-500" aria-hidden />Coronal mass ejections ({cmes.length})
            </h3>
            <div className="space-y-2">
              {cmes.slice(0, 40).map((c, i) => {
                const a = bestAnalysis(c);
                const speed = a?.speed || 0;
                return (
                  <motion.a key={c.activityID} href={c.link} target="_blank" rel="noopener noreferrer" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.03 }}
                    className="group block rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 transition hover:border-orange-300 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-orange-400/40">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{when(c.startTime)}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{c.sourceLocation || "—"}{a?.type ? ` · type ${a.type}` : ""}</span>
                    </span>
                    {speed > 0 && (
                      <span className="mt-2 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                          <span className="block h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" style={{ width: `${Math.min(100, (speed / 2500) * 100)}%` }} />
                        </span>
                        <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-300">{speed.toLocaleString()} km/s</span>
                      </span>
                    )}
                    {c.note && <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">{c.note}</span>}
                  </motion.a>
                );
              })}
              {!cmes.length && <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center font-mono text-xs text-slate-400 dark:border-white/10">No CMEs logged in this window.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Hero({ icon: Icon, label, value, note }: { icon: typeof Sun; label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-200/80"><Icon className="h-3.5 w-3.5" aria-hidden />{label}</p>
      <p className="mt-1.5 font-aspekta text-3xl font-[650] tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-orange-100/70">{note}</p>
    </div>
  );
}
