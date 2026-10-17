"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Anchor, ArrowLeft, Check, Layers, Link2, ListOrdered, Search, X } from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { HudIconButton, HudLabel, HudPanel, HudStat, hudGlass, useAtlasTheme } from "@/components/atlas/Hud";
import type { Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { NAMED_WRECKS_URL, NOAA_WRECKS_URL, WRECK_CATS, namedWreckFeatures, type NamedWreckCols } from "@/utils/geo/wrecks";
import { FEATURED_WRECKS, featuredById, type FeaturedWreck } from "./featured";
import { WRECK_LAYERS } from "./layers";
import { WreckDetailsDrawer } from "./Details";

/* ------------------------------------------------------------------ */
/*  Shipwrecks — every wreck on NOAA's nautical charts, 30,000 named   */
/*  wrecks worldwide, the National Marine Sanctuaries that protect     */
/*  them, and nine wrecks with their stories, over the ocean floor.    */
/* ------------------------------------------------------------------ */

type Panel = "find" | "layers" | null;
type FC = GeoJSON.FeatureCollection;

export default function ShipwrecksApp() {
  const dark = useAtlasTheme();
  const [noaa, setNoaa] = useState<FC | null>(null);
  const [named, setNamed] = useState<NamedWreckCols | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cats, setCats] = useState<Set<string>>(() => new Set([...WRECK_CATS.map((c) => c.key), "none"]));
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(WRECK_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number } | null>(null);
  const [initialView] = useState(() => ({ center: [-70, 38] as [number, number], zoom: Math.min(3.2, Math.max(1.6, Math.log2(window.innerWidth / 300))) }));

  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([fetch(NOAA_WRECKS_URL, { signal: ctl.signal }).then((r) => r.json()), fetch(NAMED_WRECKS_URL, { signal: ctl.signal }).then((r) => r.json())])
      .then(([n, w]: [FC, { cols: NamedWreckCols }]) => {
        setNoaa(n);
        setNamed(w.cols);
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    return () => ctl.abort();
  }, []);

  const noaaData = useMemo(() => (noaa ? { ...noaa, features: noaa.features.filter((f) => cats.has(f.properties?.cat ?? "none")) } : undefined), [noaa, cats]);
  const namedData = useMemo(() => (named ? namedWreckFeatures(named) : undefined), [named]);
  const data = useMemo(() => ({ noaa: noaaData, named: namedData }), [noaaData, namedData]);

  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const pickFeatured = (w: FeaturedWreck) => {
    setPicked({ layer: "featured", id: w.id, props: { id: w.id, name: w.name }, lngLat: w.center });
    setFlyTo({ center: w.center, zoom: w.zoom, pitch: 0, bearing: 0, nonce: Date.now() });
  };
  const pickNamed = (i: number) => {
    if (!named) return;
    const at: [number, number] = [named.lng[i], named.lat[i]];
    setPicked({ layer: "named", id: i, props: { id: named.id[i], name: named.name[i], year: named.year[i] }, lngLat: at });
    setFlyTo({ center: at, zoom: 11, pitch: 0, bearing: 0, nonce: Date.now() });
  };

  /* ── share links: ?wreck=<featured id> · ?q=<wikidata id> ───────── */
  const urlRead = useRef(false);
  useEffect(() => {
    if (urlRead.current || !named) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("wreck") ? featuredById(q.get("wreck")!) : undefined;
    const qid = q.get("q");
    if (f) pickFeatured(f);
    else if (qid) {
      const i = named.id.indexOf(qid);
      if (i >= 0) pickNamed(i);
    }
    // once the named list has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [named]);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    if (picked?.layer === "featured") q.set("wreck", String(picked.id));
    else if (picked?.layer === "named") q.set("q", String(picked.props.id));
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [picked]);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const citations = WRECK_LAYERS.filter((l) => visible[l.id] && l.citation.label).map((l) => l.citation);
  const dangerous = noaa?.features.filter((f) => f.properties?.cat === "danger").length ?? 0;

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#010610] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <AtlasMap
        layers={WRECK_LAYERS}
        visible={visible}
        data={data}
        basemap={basemap}
        terrain={terrain}
        dark={dark}
        atmosphere
        selected={picked}
        onPick={setPicked}
        flyTo={flyTo}
        initialView={initialView}
        className="atlas-space absolute inset-0"
      >
        <WreckDetailsDrawer picked={picked} onClose={() => setPickedState(null)} />
      </AtlasMap>

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-sky-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Anchor className="h-3.5 w-3.5 text-sky-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Shipwrecks</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            title="Copy a link to exactly this view"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${copied ? "text-emerald-300" : "text-slate-300 hover:text-sky-200"}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
        <div className="pointer-events-auto flex max-w-full flex-wrap gap-1.5 md:max-w-[calc(100vw-480px)]">
          {WRECK_CATS.map((c) => {
            const on = cats.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                title={c.blurb}
                onClick={() =>
                  setCats((cur) => {
                    const next = new Set(cur);
                    if (next.has(c.key)) next.delete(c.key);
                    else next.add(c.key);
                    return next;
                  })
                }
                className={`${hudGlass} inline-flex items-center gap-1.5 !rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-opacity ${on ? "text-slate-100" : "text-slate-500 opacity-60"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: on ? c.color : "#475569" }} />
                {c.label}
              </button>
            );
          })}
        </div>
        {loadError && <p className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}>Couldn&apos;t load the wreck data ({loadError}).</p>}
      </div>

      {/* ── right rail ───────────────────────────────────────────── */}
      <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
        <HudIconButton icon={ListOrdered} label="Find a wreck" active={panel === "find"} onClick={() => togglePanel("find")} badge={FEATURED_WRECKS.length} />
        <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
      </div>
      {panel && (
        <SidePanel title={panel === "find" ? "Find a wreck" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "find" && <FindWreck named={named} onFeatured={pickFeatured} onNamed={pickNamed} />}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel id="sw" layers={WRECK_LAYERS} visible={visible} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))} basemap={basemap} onBasemap={setBasemap} terrain={terrain} onTerrain={setTerrain} />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
        <HudStat label="Charted wrecks (U.S.)" value={noaa ? noaa.features.length.toLocaleString() : "—"} tone="text-sky-300" />
        <HudStat label="Hazards to ships" value={noaa ? dangerous.toLocaleString() : "—"} tone="text-rose-300" />
        <HudStat label="Named wrecks" value={named ? named.id.length.toLocaleString() : "—"} tone="text-white" onClick={() => togglePanel("find")} />
        <HudStat label="Sanctuaries" value="18" tone="text-teal-300" />
        <HudStat label="Featured" value={FEATURED_WRECKS.length} tone="text-amber-200" onClick={() => togglePanel("find")} />
      </HudPanel>
    </div>
  );
}

function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <HudPanel className="absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] flex-col md:inset-x-auto md:bottom-20 md:right-16 md:top-3 md:max-h-none md:w-[340px]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <HudLabel>{title}</HudLabel>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">{children}</div>
    </HudPanel>
  );
}

function FindWreck({ named, onFeatured, onNamed }: { named: NamedWreckCols | null; onFeatured: (w: FeaturedWreck) => void; onNamed: (i: number) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!named || needle.length < 2) return [];
    const out: number[] = [];
    for (let i = 0; i < named.name.length && out.length < 60; i++) if (named.name[i].toLowerCase().includes(needle)) out.push(i);
    return out;
  }, [named, needle]);
  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search 30,000 named wrecks…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-300/40"
        />
      </label>
      {needle.length >= 2 ? (
        <ul className="space-y-0.5">
          {hits.map((i) => (
            <li key={i}>
              <button type="button" onClick={() => onNamed(i)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-100" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-slate-100">{named!.name[i]}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {named!.lat[i].toFixed(2)}°, {named!.lng[i].toFixed(2)}°{named!.year[i] ? ` · lost ${named!.year[i]}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!hits.length && <li className="py-6 text-center text-xs text-slate-500">No named wreck matches.</li>}
        </ul>
      ) : (
        <ul className="space-y-0.5">
          {FEATURED_WRECKS.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => onFeatured(w)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: w.accent, boxShadow: `0 0 8px ${w.accent}` }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">{w.name}</span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {w.lost} · {w.where.split(",").pop()?.trim()}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
