/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Camera, ChevronLeft, ChevronRight, ExternalLink, Loader2, Orbit } from "lucide-react";

import { trackEvent } from "@/utils/mixpanel";
import { Modal } from "@/components/ui/modal";
import { IconBadge } from "@/components/ui/icon-badge";

// Perseverance's raw-image feed (mars.nasa.gov). NASA's old Mars Rover Photos API has been
// retired and Curiosity's feed is empty, so this is the live source: pictures from Mars, often
// less than a day old.
const FEED = "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&ver=1.2&order=sol+desc";
const PER_PAGE = 60;

interface RawImage {
  imageid: string;
  sol: number;
  title: string;
  caption: string;
  credit?: string;
  date_taken_utc: string;
  date_taken_mars?: string;
  sample_type?: string;
  link?: string;
  camera: { instrument: string };
  image_files: { small?: string; medium?: string; large?: string; full_res?: string };
}

// Friendly names for Perseverance's cameras, matched on the instrument prefix.
const CAMERAS: { key: string; label: string; match: RegExp }[] = [
  { key: "all", label: "All cameras", match: /./ },
  { key: "navcam", label: "Navcam", match: /^NAVCAM/ },
  { key: "mastcam", label: "Mastcam-Z", match: /^MCZ/ },
  { key: "hazcam", label: "Hazcams", match: /HAZCAM/ },
  { key: "supercam", label: "SuperCam", match: /^SUPERCAM/ },
  { key: "sherloc", label: "SHERLOC / WATSON", match: /^SHERLOC/ },
  { key: "sky", label: "Sky & other", match: /SKYCAM|CACHECAM|PIXL|EDL|LCAM/ },
];
const cameraName = (instrument: string) =>
  instrument.replace(/_/g, " ").replace(/\bMCZ\b/, "Mastcam-Z").replace(/\bRMI\b/, "Micro-Imager").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const earth = (utc: string) => new Date(utc.endsWith("Z") ? utc : `${utc}Z`).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function MarsRoverPhotos() {
  const [images, setImages] = useState<RawImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState("all");
  const [viewer, setViewer] = useState<number | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${FEED}&num=${PER_PAGE}&page=${p}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      // Skip thumbnail-only frames; keep the proper pictures.
      const fresh = ((json.images || []) as RawImage[]).filter((i) => i.sample_type !== "Thumbnail" && i.image_files?.small);
      setImages((prev) => (p === 0 ? fresh : [...prev, ...fresh.filter((i) => !prev.some((x) => x.imageid === i.imageid))]));
      setTotal(Number(json.total_results) || 0);
      setPage(p);
    } catch {
      setError("Couldn't reach Mars just now (well, NASA's feed). Try again shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(0); }, [load]);

  const shown = useMemo(() => {
    const cam = CAMERAS.find((c) => c.key === camera)!;
    return images.filter((i) => cam.match.test(i.camera?.instrument || ""));
  }, [images, camera]);
  const latest = images[0];
  const current = viewer !== null ? shown[viewer] : null;
  const step = (n: number) => setViewer((v) => (v === null ? v : (v + n + shown.length) % shown.length));

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={Orbit} tone="rose" size="lg" label="Perseverance" pulse />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Perseverance, live from Jezero Crater</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Raw images straight off the rover</p>
          </div>
        </div>
      </div>

      {/* Mission stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Latest sol", latest ? `Sol ${latest.sol.toLocaleString()}` : "—", "A sol is a Mars day: 24h 39m"],
          ["Last photo", latest ? earth(latest.date_taken_utc) : "—", "Earth time"],
          ["Mars local time", latest?.date_taken_mars?.split(" ").slice(-2).join(" ") || "—", "When the shutter clicked"],
          ["Photos sent home", total ? total.toLocaleString() : "—", "Since landing, Feb 2021"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
            <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{note}</p>
          </div>
        ))}
      </div>

      {/* Camera filter */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CAMERAS.map((c) => {
          const count = c.key === "all" ? images.length : images.filter((i) => c.match.test(i.camera?.instrument || "")).length;
          return (
            <button key={c.key} type="button" onClick={() => { setCamera(c.key); trackEvent("Mars Camera Filter", { camera: c.key }); }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] transition ${camera === c.key ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:text-slate-300"}`}>
              <Camera className="h-3 w-3" aria-hidden />{c.label}<span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-200">{error}</div>}
      {!loading && !error && shown.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center font-mono text-xs text-slate-400 dark:border-white/10">No shots from that camera in this batch. Load more or pick another.</p>}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {shown.map((img, i) => (
          <motion.button key={img.imageid} type="button" onClick={() => { setViewer(i); trackEvent("Mars Photo Opened", { id: img.imageid }); }}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200/70 bg-[#2a150f] text-left outline-none transition hover:shadow-[0_16px_40px_-18px_rgba(225,29,72,0.55)] focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:border-white/[0.08]">
            <img src={img.image_files.small} alt={img.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 transition group-hover:opacity-100" />
            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-rose-200">Sol {img.sol}</p>
              <p className="line-clamp-1 text-xs font-semibold text-white">{cameraName(img.camera.instrument)}</p>
            </div>
          </motion.button>
        ))}
        {loading && Array.from({ length: 10 }, (_, i) => <div key={`s${i}`} className="aspect-square animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />)}
      </div>

      {images.length > 0 && (page + 1) * PER_PAGE < total && (
        <div className="mt-6 flex justify-center">
          <button type="button" disabled={loading} onClick={() => load(page + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(244,63,94,0.6)] transition hover:bg-rose-600 disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Older photos
          </button>
        </div>
      )}

      <Modal open={!!current} onClose={() => setViewer(null)} labelledBy="mars-title" size="xl" accent="#f43f5e">
        {current && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="relative grid place-items-center bg-[radial-gradient(ellipse_at_top,#4a1f14,#120705_70%)]">
              <img src={current.image_files.large || current.image_files.medium} alt={current.title} className="max-h-[65vh] w-full object-contain" />
              {shown.length > 1 && (["prev", "next"] as const).map((dir) => (
                <button key={dir} type="button" onClick={() => step(dir === "prev" ? -1 : 1)} aria-label={dir === "prev" ? "Previous photo" : "Next photo"}
                  className={`absolute top-1/2 -translate-y-1/2 ${dir === "prev" ? "left-3" : "right-3"} rounded-full bg-white/10 p-2.5 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25`}>
                  {dir === "prev" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              ))}
            </div>
            <div className="p-5 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-wider text-rose-500 dark:text-rose-300">Sol {current.sol} · {cameraName(current.camera.instrument)}</p>
              <h2 id="mars-title" className="mt-1.5 font-aspekta text-2xl font-[650] tracking-tight text-slate-900 dark:text-white">{current.title}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[["Taken (Earth)", earth(current.date_taken_utc)], ["Taken (Mars)", current.date_taken_mars || "—"], ["Credit", current.credit || "NASA/JPL-Caltech"]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
              {current.caption && <p className="mt-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{current.caption}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={current.image_files.full_res || current.image_files.large} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600">
                  Full resolution <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
                {current.link && <a href={current.link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                  On NASA&apos;s site <ExternalLink className="h-4 w-4" aria-hidden />
                </a>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
