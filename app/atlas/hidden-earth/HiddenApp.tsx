"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Box, Check, Crosshair, Layers, Layers2, Link2, ListOrdered, LocateFixed, Map as MapIcon, ScanEye, X } from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { useNearMe } from "@/components/atlas/useNearMe";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass, useAtlasTheme } from "@/components/atlas/Hud";
import type { CompareCamera } from "@/components/atlas/CompareView";
import type { AtlasView, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { LIDAR_MIN_ZOOM, LIDAR_VIEWS, lidarView, type LidarViewKey } from "@/utils/geo/lidar";
import { kmBetween } from "@/utils/geo/strange";
import { HIDDEN_LAYERS, LIDAR_VIEW_LAYERS } from "./layers";
import { HiddenDetails, type PeelTarget } from "./Details";
import { Peel, type PeelState } from "./Peel";
import { Cloud, type EptIndex } from "./Cloud";
import { Hunt } from "./Hunt";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { HIDDEN_STORIES, type HiddenAction } from "./stories";
import { SITES, SITE_KINDS, siteById, type HiddenSite } from "./sites";

/* ------------------------------------------------------------------ */
/*  Hidden Earth — the ground the way lidar sees it: trees, crops and  */
/*  buildings stripped away, so ancient earthworks, hidden faults and  */
/*  old landslides show. Five server-rendered lidar views, a 1 m       */
/*  coverage map, featured sites and a satellite-vs-lidar peel.        */
/* ------------------------------------------------------------------ */

type Mode = "map" | "peel" | "cloud" | "hunt" | "stories";
type Panel = "sites" | "layers" | null;

const fitZoom = () => Math.min(4.6, Math.max(2.4, Math.log2((window.innerWidth * 0.9 * 360) / (512 * 58)) + 0.3));

export default function HiddenApp() {
  const dark = useAtlasTheme();
  const [mode, setMode] = useState<Mode>("map");
  const [view, setView] = useState<LidarViewKey>("multi");
  const [extra, setExtra] = useState<Record<string, boolean>>({ coverage: false, sites: true, "national-relief": true });
  const visible = useMemo<Record<string, boolean>>(
    () => ({ ...extra, ...Object.fromEntries(LIDAR_VIEW_LAYERS.map((l) => [l.id, l.id === `lidar-${view}`])) }),
    [extra, view]
  );
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number } | null>(null);
  const [initialView] = useState(() => ({ center: [-97.5, 39.5] as [number, number], zoom: fitZoom() }));
  const [mapView, setMapView] = useState<AtlasView | null>(null);

  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const pickSite = (s: HiddenSite) => {
    setView(s.view);
    setPicked({ layer: "sites", id: s.id, props: { id: s.id, name: s.name }, lngLat: s.center });
    setFlyTo({ center: s.center, zoom: s.zoom, pitch: 0, bearing: 0, nonce: Date.now() });
  };

  /** Where a tool opened from a story goes back to. */
  const returnTo = useRef<Mode | null>(null);
  const backMode = () => {
    const m = returnTo.current ?? "map";
    returnTo.current = null;
    return m;
  };

  /* ── laser point clouds ────────────────────────────────────────── */
  const [ept, setEpt] = useState<EptIndex>({});
  useEffect(() => {
    const ctl = new AbortController();
    fetch("/atlas/hidden-ept.json", { signal: ctl.signal })
      .then((res) => res.json())
      .then((j: { sites: EptIndex }) => setEpt(j.sites))
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);
  const [cloudSite, setCloudSite] = useState<string | null>(null);
  const openCloud = useCallback((id: string) => {
    setCloudSite(id);
    setMode("cloud");
    setPeel(null);
    setPickedState(null);
    setPanel(null);
  }, []);
  const exitCloud = useCallback(() => {
    const s = cloudSite ? siteById(cloudSite) : undefined;
    const to = backMode();
    setMode(to);
    setCloudSite(null);
    if (s && to === "map") setFlyTo({ center: s.center, zoom: s.zoom, pitch: 0, bearing: 0, nonce: Date.now() });
  }, [cloudSite]);
  const cloudHere = () => {
    const sel = picked?.layer === "sites" ? String(picked.id) : peel?.siteId;
    const withData = SITES.filter((x) => (ept[x.id] ?? []).length);
    openCloud(sel && (ept[sel] ?? []).length ? sel : (withData.find((x) => x.id === "serpent") ?? withData[0] ?? SITES[0]).id);
  };

  /* ── peel ──────────────────────────────────────────────────────── */
  const [peel, setPeel] = useState<(Partial<PeelState> & { camera: CompareCamera; siteId?: string; nonce: number }) | null>(null);
  const peelState = useRef<PeelState | null>(null);
  const [peelTick, setPeelTick] = useState(0);
  const openPeel = useCallback(
    (t: PeelTarget & Partial<PeelState>) => {
      setPeel({ ...t, camera: { center: t.center, zoom: Math.max(t.zoom, 12) }, view: t.view ?? view, nonce: Date.now() });
      setMode("peel");
      setCloudSite(null);
      setPickedState(null);
      setPanel(null);
    },
    [view]
  );
  const exitPeel = useCallback((c: CompareCamera) => {
    const to = backMode();
    setMode(to);
    setPeel(null);
    if (peelState.current) setView(peelState.current.view);
    peelState.current = null;
    if (to === "map") setFlyTo({ center: c.center, zoom: c.zoom, pitch: 0, bearing: 0, nonce: Date.now() });
  }, []);

  /* ── hunt + stories ────────────────────────────────────────────── */
  const exitHunt = useCallback(() => setMode(backMode()), []);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const story = HIDDEN_STORIES.find((x) => x.id === storyId) ?? null;
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    setFlyTo({ ...story.chapters[Math.min(chapter, story.chapters.length - 1)].camera, nonce: Date.now() });
  }, [mode, story, chapter]);
  const openStory = (id: string | null) => {
    setStoryId(id);
    setChapter(0);
    setPickedState(null);
    if (!id) setFlyTo({ ...initialView, pitch: 0, bearing: 0, nonce: Date.now() });
  };
  const runStoryAction = (a: StoryAction<HiddenAction>) => {
    const v = String(a.value ?? "");
    if (a.kind === "view") {
      if (LIDAR_VIEWS.some((x) => x.key === v)) setView(v as LidarViewKey);
      return;
    }
    returnTo.current = "stories";
    const st = siteById(v);
    if (a.kind === "hunt") setMode("hunt");
    else if (a.kind === "cloud" && st) openCloud(st.id);
    else if ((a.kind === "peel" || a.kind === "then") && st) openPeel({ center: st.center, zoom: st.zoom, siteId: st.id, view: st.view, layout: a.kind === "then" ? "then" : "swipe" });
  };
  const peelHere = () => {
    const s = picked?.layer === "sites" ? siteById(String(picked.id)) : undefined;
    if (s) return openPeel({ center: s.center, zoom: s.zoom, siteId: s.id, view: s.view });
    if (mapView && mapView.zoom >= 9) return openPeel({ center: mapView.center, zoom: mapView.zoom });
    const first = SITES.find((x) => x.id === "serpent") ?? SITES[0];
    openPeel({ center: first.center, zoom: first.zoom, siteId: first.id, view: first.view });
  };

  /* ── share links: ?site= · ?view= · ?mode=peel&at=lng,lat,z ────── */
  const urlRead = useRef(false);
  useEffect(() => {
    if (urlRead.current) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view");
    if (v && LIDAR_VIEWS.some((x) => x.key === v)) setView(v as LidarViewKey);
    if (q.get("coverage") === "1") setExtra((e) => ({ ...e, coverage: true }));
    const s = q.get("site") ? siteById(q.get("site")!) : undefined;
    const at = q.get("at")?.split(",").map(Number);
    const st = q.get("story");
    if (st && HIDDEN_STORIES.some((x) => x.id === st)) {
      setStoryId(st);
      setChapter(Math.max(0, Number(q.get("ch")) || 0));
      setMode("stories");
    } else if (q.get("mode") === "hunt") {
      setMode("hunt");
    } else if (q.get("mode") === "cloud" && s) {
      openCloud(s.id);
    } else if (q.get("mode") === "peel" && at?.length === 3 && at.every(Number.isFinite)) {
      openPeel({ center: [at[0], at[1]], zoom: at[2], siteId: s?.id, layout: q.get("lay") === "grid" || q.get("lay") === "then" ? (q.get("lay") as "grid" | "then") : "swipe", view: (v as LidarViewKey) ?? s?.view, edition: q.get("ed") });
    } else if (s) pickSite(s);
    // once, on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    const ps = peelState.current;
    if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (mode === "hunt") {
      q.set("mode", "hunt");
    } else if (mode === "cloud" && cloudSite) {
      q.set("mode", "cloud");
      q.set("site", cloudSite);
    } else if (mode === "peel" && ps) {
      q.set("mode", "peel");
      q.set("at", `${ps.camera.center[0].toFixed(5)},${ps.camera.center[1].toFixed(5)},${ps.camera.zoom.toFixed(2)}`);
      if (peel?.siteId) q.set("site", peel.siteId);
      if (ps.layout !== "swipe") q.set("lay", ps.layout);
      if (ps.layout === "then" && ps.edition) q.set("ed", ps.edition);
      q.set("view", ps.view);
    } else {
      if (picked?.layer === "sites") q.set("site", String(picked.id));
      if (view !== "multi") q.set("view", view);
      if (extra.coverage) q.set("coverage", "1");
    }
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, picked, view, extra.coverage, peel, peelTick, cloudSite, storyId, chapter]);
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

  const zoomedOut = (mapView?.zoom ?? 0) < LIDAR_MIN_ZOOM;
  const panelLayers = HIDDEN_LAYERS.filter((l) => !l.id.startsWith("lidar-") && l.id !== "national-relief");
  const citations = [...LIDAR_VIEW_LAYERS.slice(0, 1), ...panelLayers].filter((l) => l.citation.label && (l.id.startsWith("lidar-") || visible[l.id])).map((l) => l.citation);

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#020604] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <AtlasMap
        layers={HIDDEN_LAYERS}
        visible={visible}
        basemap={basemap}
        terrain={terrain}
        dark={dark}
        atmosphere
        selected={picked}
        onPick={setPicked}
        flyTo={flyTo}
        initialView={initialView}
        onView={setMapView}
        className="atlas-space absolute inset-0"
      >
        {mode === "map" && <HiddenDetails picked={picked} onClose={() => setPickedState(null)} onPeel={openPeel} onCloud={(id) => ((ept[id] ?? []).length ? openCloud(id) : undefined)} hasCloud={(id) => (ept[id] ?? []).length > 0} />}
      </AtlasMap>

      {mode === "cloud" && cloudSite && siteById(cloudSite) && <Cloud site={siteById(cloudSite)!} ept={ept} onPick={setCloudSite} onExit={exitCloud} />}

      {/* no laser-points jump mid-game: leaving would reset the score */}
      {mode === "hunt" && <Hunt onExit={exitHunt} />}

      {mode === "stories" && (
        <StoryPlayer
          stories={HIDDEN_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}

      {mode === "peel" && peel && (
        <Peel
          key={peel.nonce}
          initial={peel}
          site={peel.siteId ? siteById(peel.siteId) : undefined}
          onExit={exitPeel}
          onState={(s) => {
            peelState.current = s;
            setPeelTick((n) => n + 1);
          }}
        />
      )}

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-lime-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <ScanEye className="h-3.5 w-3.5 text-lime-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Hidden Earth</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            title="Copy a link to exactly this view"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${copied ? "text-emerald-300" : "text-slate-300 hover:text-lime-200"}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2">
          <HudSwitch
            id="he-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={(m) => {
              if (m === mode) return;
              returnTo.current = null;
              // close whatever overlay is open first
              if (mode === "peel") {
                setPeel(null);
                peelState.current = null;
              }
              if (mode === "cloud") setCloudSite(null);
              if (m === "peel") return peelHere();
              if (m === "cloud") return cloudHere();
              setPickedState(null);
              setPanel(null);
              setMode(m);
            }}
            options={[
              { key: "map", label: <><MapIcon className="h-3.5 w-3.5" />Map</> },
              { key: "peel", label: <><Layers2 className="h-3.5 w-3.5" />Peel</>, title: "Satellite vs bare-earth lidar, with a draggable divider" },
              { key: "cloud", label: <><Box className="h-3.5 w-3.5" />Laser points</>, title: "The raw lidar returns in 3D — strip the trees away" },
              { key: "hunt", label: <><Crosshair className="h-3.5 w-3.5" />Hunt</>, title: "Find the hidden sites yourself — five rounds" },
              { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</>, title: "Guided tours: seeing through trees, the first builders, ground that moves" },
            ]}
          />
          {mode === "map" && (
            <HudSwitch id="he-view" ariaLabel="Lidar view" value={view} onChange={setView} options={LIDAR_VIEWS.map((v) => ({ key: v.key, label: v.label, title: v.blurb }))} />
          )}
        </div>
        {mode === "map" && zoomedOut && (
          <p className={`${hudGlass} px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-lime-200/80`}>Zoom in — live lidar renders from zoom {LIDAR_MIN_ZOOM} · or pick a site →</p>
        )}
        {mode === "map" && !zoomedOut && !picked && (
          <p className={`${hudGlass} max-w-sm px-3 py-1.5 text-[11px] text-slate-300`}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-lime-200/80">{lidarView(view).label} · </span>
            {lidarView(view).blurb}
          </p>
        )}
      </div>

      {/* ── right rail ───────────────────────────────────────────── */}
      {mode === "map" && (
        <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
          <HudIconButton icon={ListOrdered} label="Hidden sites" active={panel === "sites"} onClick={() => togglePanel("sites")} badge={SITES.length} />
          <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
        </div>
      )}
      {panel && mode === "map" && (
        <SidePanel title={panel === "sites" ? "Hidden sites" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "sites" && <SiteList hasCloud={(id) => (ept[id] ?? []).length > 0} onCloud={(s) => openCloud(s.id)} onPick={pickSite} onPeel={(s) => openPeel({ center: s.center, zoom: s.zoom, siteId: s.id, view: s.view })} onLocate={(at) => setFlyTo({ center: at, zoom: 7, pitch: 0, bearing: 0, nonce: Date.now() })} />}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel id="he" layers={panelLayers} visible={visible} onToggle={(id) => setExtra((e) => ({ ...e, [id]: !e[id] }))} basemap={basemap} onBasemap={setBasemap} terrain={terrain} onTerrain={setTerrain} />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      {mode === "map" && (
        <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
          <HudStat label="Hidden sites" value={SITES.length} tone="text-lime-300" onClick={() => togglePanel("sites")} />
          <HudStat label="Lidar view" value={lidarView(view).label} tone="text-white" />
          <HudStat label="1 m coverage" value={extra.coverage ? "shown" : "off"} tone="text-emerald-300" onClick={() => setExtra((e) => ({ ...e, coverage: !e.coverage }))} />
          <HudStat label="Peel" value="satellite ⇆ lidar" tone="text-amber-200" onClick={peelHere} />
          <HudStat label="Hunt" value="find them yourself" tone="text-yellow-200" onClick={() => setMode("hunt")} />
          <HudStat label="Laser points" value={`${SITES.filter((x) => (ept[x.id] ?? []).length).length} sites`} tone="text-emerald-300" onClick={cloudHere} />
        </HudPanel>
      )}
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

function SiteList({
  onPick,
  onPeel,
  onCloud,
  hasCloud,
  onLocate,
}: {
  onPick: (s: HiddenSite) => void;
  onPeel: (s: HiddenSite) => void;
  onCloud: (s: HiddenSite) => void;
  hasCloud: (id: string) => boolean;
  onLocate: (at: [number, number]) => void;
}) {
  const { me, setMe, locating, locate: locate } = useNearMe((at) => {
    onLocate(at);
  });
  const rows = SITES.map((s) => ({ s, d: me ? kmBetween(me, s.center) : null })).sort((a, b) => (a.d != null && b.d != null ? a.d - b.d : 0));
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={locate}
        disabled={locating === "busy"}
        title="Sort by distance from you (asks for your location; it isn't stored)"
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider ${me ? "border-lime-300/40 text-lime-100" : "border-white/10 text-slate-300 hover:text-white"}`}
      >
        <LocateFixed className={`h-3.5 w-3.5 ${locating === "busy" ? "animate-pulse" : ""}`} /> Nearest to me
      </button>
      {locating === "denied" && <p className="text-[11px] text-amber-200">Location isn&apos;t available.</p>}
      <ul className="space-y-0.5">
        {rows.map(({ s, d }) => {
          const k = SITE_KINDS[s.kind];
          return (
            <li key={s.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.05]">
              <button type="button" onClick={() => onPick(s)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: k.color, boxShadow: `0 0 8px ${k.color}` }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">{s.name}</span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {k.label} · {s.where.split(",").pop()?.trim()}
                    {d != null ? ` · ${Math.round(d).toLocaleString()} km` : ""}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onPeel(s)}
                aria-label={`Peel back ${s.name}`}
                className="shrink-0 rounded-lg border border-lime-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-lime-200 opacity-70 transition-opacity hover:bg-lime-400/10 group-hover:opacity-100"
              >
                Peel
              </button>
              {hasCloud(s.id) && (
                <button
                  type="button"
                  onClick={() => onCloud(s)}
                  aria-label={`Laser points of ${s.name}`}
                  className="shrink-0 rounded-lg border border-emerald-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-200 opacity-70 transition-opacity hover:bg-emerald-400/10 group-hover:opacity-100"
                >
                  3D
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
