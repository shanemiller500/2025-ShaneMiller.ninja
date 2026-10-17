"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Box, Check, Layers, Link2, ListOrdered, LocateFixed, Map as MapIcon, Pause, Play, Radar, ScanLine, Search, Sun, Volume2, VolumeX, X } from "lucide-react";
import { startCaveAudio, type CaveAudio } from "@/components/atlas/caveAudio";
import { DrillTransition } from "./DrillTransition";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import { CaveScope, type CaveTelemetry, type CaveView } from "@/components/atlas/CaveScope";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass, useAtlasTheme } from "@/components/atlas/Hud";
import type { CaveSpec } from "@/components/atlas/caveGen";
import type { StoryAction } from "@/components/atlas/story";
import type { Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { useOsmCaves } from "@/utils/geo/useOsmCaves";
import { CAVES_URL, caveCollection, type CaveCollection, type CaveFilter, type CaveProps } from "@/utils/geo/caves";
import { KARST_CLASSES, KARST_SERVICE, KARST_URL, type KarstStats } from "@/utils/geo/karst";
import { useViewportFeatures } from "@/utils/geo/useViewportFeatures";
import type { AtlasView } from "@/components/atlas/types";
import { UNDERGROUND_LAYERS } from "./layers";
import { UndergroundDetails } from "./Details";
import { FEATURED, STYLE_LABEL, diveSpecFor, featuredById } from "./featured";
import { UNDERGROUND_STORIES, type UndergroundAction } from "./stories";

/* ------------------------------------------------------------------ */
/*  Underground USA — a full-screen look at what's under the country:  */
/*  the karst rock that dissolves into caves, the caves you can visit, */
/*  an X-ray view, and a 3D dive through cave reconstructions.         */
/* ------------------------------------------------------------------ */

type Mode = "map" | "dive" | "stories";
type Panel = "caves" | "layers" | null;

/** How many caves the list renders at once (14k worldwide — search narrows it). */
const LIST_MAX = 200;

/** Zoom that fits the lower 48 across most of the screen. */
const fitZoom = () => Math.min(4.6, Math.max(2.4, Math.log2((window.innerWidth * 0.9 * 360) / (512 * 58)) + 0.3));

const SPEEDS = [0.5, 1, 2, 4];

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
/** Full-detail karst, one source per class (the USGS map's five layers). */
const KARST_DETAIL_SOURCES = KARST_CLASSES.map((c) => ({ url: `${KARST_SERVICE}/${c.layer}`, props: { cls: c.key }, outFields: "KARST_TYPE" }));
/** Kentucky Geological Survey sinkhole outlines (published by the KY Division of Geographic Information). */
const KY_SINK_SOURCES = [{ url: "https://services3.arcgis.com/ghsX9CKghMvyYjBU/arcgis/rest/services/Ky_KGS_Sinkholes_WM_gdb/FeatureServer/0", outFields: "ACRES" }];
const KY_BBOX: [number, number, number, number] = [-89.6, 36.4, -81.9, 39.2];

export default function UndergroundApp() {
  const dark = useAtlasTheme();
  const [mode, setMode] = useState<Mode>("map");
  const [xray, setXray] = useState(false);
  const [caves, setCaves] = useState<CaveCollection | null>(null);
  const [karst, setKarst] = useState<(GeoJSON.FeatureCollection & { stats?: KarstStats }) | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caveFilter, setCaveFilter] = useState<CaveFilter>("tours");

  const layersForPanel = UNDERGROUND_LAYERS.filter((l) => l.id !== "xray");
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(UNDERGROUND_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number } | null>(null);
  const [initialView] = useState(() => ({ center: [-96.5, 38.6] as [number, number], zoom: fitZoom() }));

  /* ── data ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([
      fetch(CAVES_URL, { signal: ctl.signal }).then((r) => r.json()),
      fetch(KARST_URL, { signal: ctl.signal }).then((r) => r.json()),
    ])
      .then(([c, k]) => {
        setCaves(caveCollection(c));
        setKarst(k);
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    return () => ctl.abort();
  }, []);

  const caveData = useMemo(
    () => (caves ? { ...caves, features: caves.features.filter((f) => caveFilter === "all" || f.properties.tour) } : undefined),
    [caves, caveFilter]
  );
  /* ── live detail for the area on screen ─────────────────────────── */
  const [view, setView] = useState<AtlasView | null>(null);
  const karstDetail = useViewportFeatures({ sources: KARST_DETAIL_SOURCES, view, minZoom: 8, enabled: visible.karst, maxFeatures: 6000 });
  const osmCaves = useOsmCaves(view, visible.caves);
  const kySinks = useViewportFeatures({ sources: KY_SINK_SOURCES, view, minZoom: 12, extent: KY_BBOX, enabled: visible.sinkholes, maxFeatures: 14000 });
  const [flSinks, setFlSinks] = useState<GeoJSON.FeatureCollection | null>(null);
  useEffect(() => {
    if (!visible.sinkholes || flSinks) return;
    const ctl = new AbortController();
    fetch("/api/atlas/sinkholes/florida", { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && !j.error && setFlSinks(j))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [visible.sinkholes, flSinks]);
  // the service's long KARST_TYPE text → the same surface / buried split the overview uses
  const karstDetailData = useMemo(
    () =>
      karstDetail.data
        ? { ...karstDetail.data, features: karstDetail.data.features.map((f) => ({ ...f, properties: { ...f.properties, exp: /buried/i.test(String(f.properties?.KARST_TYPE ?? "")) ? "buried" : "surface" } })) }
        : undefined,
    [karstDetail.data]
  );

  const data = useMemo(
    () => ({ caves: caveData, "osm-caves": osmCaves ?? EMPTY_FC, karst: karst ?? undefined, "karst-detail": karstDetailData ?? EMPTY_FC, "sinks-fl": flSinks ?? undefined, "sinks-ky": kySinks.data ?? EMPTY_FC }),
    [caveData, osmCaves, karst, karstDetailData, flSinks, kySinks.data]
  );
  const shownVisible = useMemo<Record<string, boolean>>(() => ({ ...visible, xray, relief: visible.relief || xray }), [visible, xray]);
  const tours = useMemo(() => (caves?.features ?? []).filter((f) => f.properties.tour), [caves]);

  /* ── selection ─────────────────────────────────────────────────── */
  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const selectCave = (id: string, zoom = 10.5) => {
    const f = caves?.features.find((c) => c.properties.id === id);
    if (!f) return;
    setPicked({ layer: "caves", id, props: f.properties as unknown as Record<string, unknown>, lngLat: f.geometry.coordinates as [number, number] });
    setFlyTo({ center: f.geometry.coordinates as [number, number], zoom, pitch: 45, nonce: Date.now() });
  };

  /* ── dive ──────────────────────────────────────────────────────── */
  type Dive = { spec: CaveSpec; id: string; name: string; where: string; site: { lng: number; lat: number } | null };
  const [dive, setDive] = useState<Dive | null>(null);
  const [ground, setGround] = useState<"loading" | "real" | "none">("loading");
  const [diveView, setDiveView] = useState<CaveView>("orbit");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [scan, setScan] = useState(true);
  const [tele, setTele] = useState<CaveTelemetry>({ depth: 0, progress: 0, maxDepth: 0 });
  const [daylight, setDaylight] = useState(false);
  const [drill, setDrill] = useState<string | null>(null);
  const drillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => () => {
    if (drillTimer.current) clearTimeout(drillTimer.current);
  }, []);

  const openDive = useCallback((cave: Pick<CaveProps, "id" | "kind" | "name" | "state">, opts: { instant?: boolean } = {}) => {
    const f = featuredById(cave.id);
    // the real ground comes from the cave's listed location (exact for every visitable cave)
    const pt = caves?.features.find((c) => c.properties.id === cave.id && !c.properties.generalized)?.geometry.coordinates;
    const site = pt ? { lng: pt[0], lat: pt[1] } : f ? { lng: f.center[0], lat: f.center[1] } : null;
    setDive({ spec: diveSpecFor(cave), id: cave.id, name: f?.name ?? cave.name, where: f?.where ?? cave.state ?? "", site });
    setGround(site ? "loading" : "none");
    setDiveView("orbit");
    setPlaying(true);
    setPickedState(null);
    setPanel(null);
    if (drillTimer.current) clearTimeout(drillTimer.current);
    // from the map: swoop down onto the entrance, then drill through the surface into the cave
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (modeRef.current !== "dive" && site && !opts.instant && !reduce) {
      setDrill(f?.name ?? cave.name);
      setFlyTo({ center: [site.lng, site.lat], zoom: 14.5, pitch: 72, bearing: 25, nonce: Date.now() });
      drillTimer.current = setTimeout(() => {
        setMode("dive");
        setDrill(null);
      }, 1900);
    } else setMode("dive");
  }, [caves]);
  const diveFeatured = (id: string) => {
    const f = featuredById(id);
    if (f) openDive({ id: f.id, kind: f.dive.style === "lavatube" ? "lava" : "show", name: f.name, state: f.where });
  };

  /* ── sound (only ever started by a click) ──────────────────────── */
  const [soundOn, setSoundOn] = useState(false);
  const audioRef = useRef<CaveAudio | null>(null);
  const audioToken = useRef(0);
  const stopSound = useCallback(() => {
    audioToken.current++;
    audioRef.current?.stop();
    audioRef.current = null;
    setSoundOn(false);
  }, []);
  const playSound = useCallback(async (spec: CaveSpec) => {
    const token = ++audioToken.current;
    audioRef.current?.stop();
    audioRef.current = null;
    try {
      const a = await startCaveAudio(spec);
      if (token !== audioToken.current) return a.stop();
      audioRef.current = a;
      setSoundOn(true);
    } catch {
      setSoundOn(false);
    }
  }, []);
  const toggleSound = () => (soundOn ? stopSound() : dive && playSound(dive.spec));
  // new cave → its own soundscape; leaving the dive → silence
  const diveSpecKey = dive ? JSON.stringify(dive.spec) : "";
  useEffect(() => {
    if (soundOn && dive) void playSound(dive.spec);
    // only when the cave changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diveSpecKey]);
  useEffect(() => {
    if (mode !== "dive" && soundOn) stopSound();
  }, [mode, soundOn, stopSound]);
  useEffect(() => () => audioRef.current?.stop(), []);

  /* ── keyboard (dive) ───────────────────────────────────────────── */
  useEffect(() => {
    if (mode !== "dive") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === " ") {
        e.preventDefault();
        if (diveView === "orbit") setDiveView("fly");
        setPlaying((p) => (diveView === "orbit" ? true : !p));
      } else if (k === "f") {
        setDiveView("fly");
        setPlaying(true);
      } else if (k === "o") setDiveView("orbit");
      else if (k === "s") setScan((v) => !v);
      else if (k === "d") setDaylight((v) => !v);
      else if (k === "m") toggleSound();
      else if (k === "arrowup") {
        e.preventDefault();
        setSpeed((v) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(v) + 1)]);
      } else if (k === "arrowdown") {
        e.preventDefault();
        setSpeed((v) => SPEEDS[Math.max(0, SPEEDS.indexOf(v) - 1)]);
      } else if (k === "escape") setMode("map");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const story = UNDERGROUND_STORIES.find((s) => s.id === storyId) ?? null;
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
  const runStoryAction = (a: StoryAction<UndergroundAction>) => {
    if (a.kind === "dive") diveFeatured(String(a.value));
    else if (a.kind === "xray") setXray(true);
    else if (a.kind === "relief") setVisible((v) => ({ ...v, relief: true }));
    else if (a.kind === "sinkholes") setVisible((v) => ({ ...v, sinkholes: true }));
    else if (a.kind === "aquifers") setVisible((v) => ({ ...v, aquifers: true }));
  };

  const changeMode = (m: Mode) => {
    if (m === "dive" && !dive) diveFeatured(FEATURED[0].id);
    else setMode(m);
    setPickedState(null);
    if (m === "dive") setPanel(null);
  };

  /* ── shareable links: ?cave=Q…&mode=dive · ?story=… · &xray=1 ─── */
  const urlRead = useRef(false);
  useEffect(() => {
    if (!caves || urlRead.current) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const st = q.get("story");
    const caveId = q.get("cave");
    if (q.get("xray") === "1") setXray(true);
    if (st && UNDERGROUND_STORIES.some((s) => s.id === st)) {
      setMode("stories");
      setStoryId(st);
    } else if (caveId) {
      const f = caves.features.find((c) => c.properties.id === caveId);
      if (f && q.get("mode") === "dive" && f.properties.tour) openDive(f.properties, { instant: true });
      else if (f) selectCave(caveId);
    }
    // read once, when the cave list arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caves]);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    if (mode === "dive" && dive) {
      q.set("mode", "dive");
      q.set("cave", dive.id);
    } else if (mode === "stories" && storyId) q.set("story", storyId);
    else if (picked?.layer === "caves" && picked.id != null) q.set("cave", String(picked.id));
    if (xray && mode !== "dive") q.set("xray", "1");
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, dive, storyId, picked, xray]);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the address bar already has the link */
    }
  };

  const citations = UNDERGROUND_LAYERS.filter((l) => shownVisible[l.id] && l.citation.label).map((l) => l.citation);
  const share = karst?.stats?.share;

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#02040b] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <AtlasMap
        layers={UNDERGROUND_LAYERS}
        visible={shownVisible}
        data={data}
        basemap={basemap}
        terrain={terrain}
        dark={dark}
        atmosphere
        selected={picked}
        onPick={setPicked}
        flyTo={flyTo}
        initialView={initialView}
        onView={setView}
        className="atlas-space absolute inset-0"
      >
        <UndergroundDetails picked={picked} onClose={() => setPickedState(null)} onDive={openDive} />
      </AtlasMap>

      {drill && <DrillTransition name={drill} />}

      {/* ── 3D dive ──────────────────────────────────────────────── */}
      {mode === "dive" && dive && (
        <div className="absolute inset-0 z-20">
          <CaveScope
            spec={dive.spec}
            site={dive.site}
            onGround={(ok) => setGround(ok ? "real" : "none")}
            view={diveView}
            playing={playing}
            speed={speed}
            scan={scan}
            onTelemetry={setTele}
            onFlightEnd={() => setPlaying(false)}
            daylight={daylight}
            onSweep={() => audioRef.current?.ping()}
          />
        </div>
      )}

      {/* ── top-left: back, title, mode ──────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-cyan-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Radar className="h-3.5 w-3.5 text-cyan-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Underground USA</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            title="Copy a link to exactly this view"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${copied ? "text-emerald-300" : "text-slate-300 hover:text-cyan-200"}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2">
          <HudSwitch
            id="ug-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={changeMode}
            options={[
              { key: "map", label: <><MapIcon className="h-3.5 w-3.5" />Map</> },
              { key: "dive", label: <><Box className="h-3.5 w-3.5" />Dive 3D</> },
              { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</> },
            ]}
          />
          {mode !== "dive" && (
            <button
              type="button"
              onClick={() => setXray((x) => !x)}
              aria-pressed={xray}
              className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-all ${
                xray ? "border-cyan-300/50 text-cyan-100 shadow-[0_0_22px_-4px_rgba(34,211,238,0.7)]" : "text-slate-300 hover:text-white"
              }`}
            >
              <ScanLine className="h-3.5 w-3.5" /> X-ray {xray ? "on" : "off"}
            </button>
          )}
          {mode === "map" && (
            <HudSwitch
              id="ug-caves"
              ariaLabel="Which caves"
              value={caveFilter}
              onChange={setCaveFilter}
              options={[
                { key: "tours", label: "Visitable", title: "Caves open to the public — exact locations" },
                { key: "all", label: "All caves", title: "Adds wild and protected caves, shown only to the nearest ~10 km" },
              ]}
            />
          )}
          {story && mode !== "stories" && (
            <button type="button" onClick={() => setMode("stories")} className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan-200 hover:text-white`}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to story
            </button>
          )}
        </div>
        {loadError && <p className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}>Couldn&apos;t load the cave data ({loadError}).</p>}
        {mode !== "dive" && (karstDetail.loading || kySinks.loading) && (
          <p className={`${hudGlass} px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-200/80`}>Loading full detail for this area…</p>
        )}
        {mode !== "dive" && !kySinks.loading && kySinks.capped && (
          <p className={`${hudGlass} px-3 py-1.5 text-[11px] text-amber-200`}>So many sinkholes here that only part of this view loaded — zoom in to see them all.</p>
        )}
        {mode === "dive" && dive && <DiveCard dive={dive} ground={ground} />}
      </div>

      {/* ── right rail (map) / depth gauge (dive) ────────────────── */}
      {mode !== "dive" ? (
        <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
          <HudIconButton icon={ListOrdered} label="Caves you can visit" active={panel === "caves"} onClick={() => togglePanel("caves")} badge={tours.length || undefined} />
          <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
        </div>
      ) : (
        <DepthGauge tele={tele} view={diveView} />
      )}

      {panel && mode !== "dive" && (
        <SidePanel title={panel === "caves" ? "Caves you can visit" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "caves" && (
            <CaveList
              caves={tours.map((f) => ({ props: f.properties, at: f.geometry.coordinates as [number, number] }))}
              onPick={(id) => selectCave(id)}
              onDive={(c) => openDive(c)}
              onLocate={(at) => setFlyTo({ center: at, zoom: 6.5, pitch: 0, bearing: 0, nonce: Date.now() })}
            />
          )}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel id="ug" layers={layersForPanel} visible={visible} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))} basemap={basemap} onBasemap={setBasemap} terrain={terrain} onTerrain={setTerrain} />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── stories ──────────────────────────────────────────────── */}
      {mode === "stories" && (
        <StoryPlayer
          stories={UNDERGROUND_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}

      {/* ── dive controls ────────────────────────────────────────── */}
      {mode === "dive" && dive && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col items-center gap-2">
          <HudPanel className="flex w-full max-w-[720px] flex-wrap items-center justify-center gap-2 px-3 py-2">
            <HudSwitch
              id="ug-view"
              ariaLabel="Camera"
              value={diveView}
              onChange={(v) => {
                setDiveView(v);
                setPlaying(true);
              }}
              options={[
                { key: "orbit", label: "Orbit" },
                { key: "fly", label: "Fly through" },
              ]}
            />
            {diveView === "fly" && (
              <>
                <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"} className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-400/15 text-cyan-100">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])} className="rounded-xl border border-white/10 px-2.5 py-2 font-mono text-[11px] text-slate-300 hover:text-white">
                  {speed}×
                </button>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:w-40">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${Math.round(tele.progress * 100)}%` }} />
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setScan((s) => !s)}
              aria-pressed={scan}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-[11px] uppercase tracking-wider ${scan ? "border-cyan-300/40 text-cyan-100" : "border-white/10 text-slate-400"}`}
            >
              <ScanLine className="h-3.5 w-3.5" /> Scan
            </button>
            <button
              type="button"
              onClick={() => setDaylight((d) => !d)}
              aria-pressed={daylight}
              title="Show the real ground in true colour"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-[11px] uppercase tracking-wider ${daylight ? "border-amber-300/50 text-amber-100" : "border-white/10 text-slate-400"}`}
            >
              <Sun className="h-3.5 w-3.5" /> Daylight
            </button>
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={soundOn ? "Mute cave sound" : "Play cave sound"}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${soundOn ? "border-cyan-300/40 text-cyan-100" : "border-white/10 text-slate-400"}`}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            {diveView === "fly" && <span className="font-mono text-[12px] font-semibold text-white sm:hidden">{tele.depth} m</span>}
          </HudPanel>
          <p className="hidden font-mono text-[10px] uppercase tracking-wider text-slate-500 md:block">
            Space play · F fly · O orbit · ↑↓ speed · S scan · D daylight · M sound · Esc map
          </p>
          <div className={`${hudGlass} no-scrollbar flex max-w-full gap-1 overflow-x-auto p-1`}>
            {FEATURED.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => diveFeatured(f.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  dive.id === f.id ? "border border-cyan-300/40 bg-cyan-400/15 text-cyan-100" : "border border-transparent text-slate-300 hover:text-white"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      {mode === "map" && (
        <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
          <HudStat label="Karst · lower 48" value={share != null ? `${share}%` : "—"} tone="text-cyan-300" />
          <HudStat label="Visitable caves" value={caves ? tours.length : "—"} tone="text-white" />
          <HudStat label="Caves mapped" value={caves ? caves.features.length : "—"} tone="text-indigo-300" />
          <HudStat label="Featured dives" value={FEATURED.length} tone="text-fuchsia-300" onClick={() => changeMode("dive")} />
        </HudPanel>
      )}
    </div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────── */

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

function CaveList({ caves, onPick, onDive, onLocate }: { caves: { props: CaveProps; at: [number, number] }[]; onPick: (id: string) => void; onDive: (c: CaveProps) => void; onLocate: (at: [number, number]) => void }) {
  const [q, setQ] = useState("");
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  // straight-line distance in km (haversine)
  const km = (a: [number, number], b: [number, number]) => {
    const R = 6371;
    const dLat = ((b[1] - a[1]) * Math.PI) / 180;
    const dLng = ((b[0] - a[0]) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const locate = () => {
    if (!navigator.geolocation) return setLocating("denied");
    setLocating("busy");
    // used once for sorting; never stored or sent anywhere
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setMe(at);
        setLocating("idle");
        onLocate(at);
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  };
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = caves
      .filter((c) => !needle || `${c.props.name} ${c.props.state ?? ""}`.toLowerCase().includes(needle))
      .map((c) => ({ ...c, d: me ? km(me, c.at) : null }));
    // nearest first once located; otherwise featured first, then alphabetical
    return list.sort((a, b) =>
      a.d != null && b.d != null ? a.d - b.d : Number(!!featuredById(b.props.id)) - Number(!!featuredById(a.props.id)) || a.props.name.localeCompare(b.props.name)
    );
  }, [caves, q, me]);
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search caves or states…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
          />
        </label>
        <button
          type="button"
          onClick={locate}
          disabled={locating === "busy"}
          title="Sort by distance from you (asks for your location; it isn't stored)"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${me ? "border-cyan-300/40 text-cyan-100" : "border-white/10 text-slate-300 hover:text-white"}`}
        >
          <LocateFixed className={`h-3.5 w-3.5 ${locating === "busy" ? "animate-pulse" : ""}`} /> Near me
        </button>
      </div>
      {locating === "denied" && <p className="text-[11px] text-amber-200">Location isn&apos;t available — the list stays alphabetical.</p>}
      <ul className="space-y-0.5">
        {rows.slice(0, LIST_MAX).map(({ props: c, d }) => {
          const f = featuredById(c.id);
          return (
            <li key={c.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.05]">
              <button type="button" onClick={() => onPick(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: f?.accent ?? (c.kind === "lava" ? "#fb923c" : "#22d3ee"), boxShadow: `0 0 8px ${f?.accent ?? "#22d3ee"}` }} />
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] ${f ? "font-semibold text-white" : "text-slate-200"}`}>{c.name}</span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {c.state ?? "—"}
                    {d != null ? ` · ${d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString()} km` : ""}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDive(c)}
                aria-label={`Dive into ${c.name}`}
                className="shrink-0 rounded-lg border border-cyan-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-cyan-200 opacity-70 transition-opacity hover:bg-cyan-400/10 group-hover:opacity-100"
              >
                Dive
              </button>
            </li>
          );
        })}
        {!rows.length && <li className="py-6 text-center text-xs text-slate-500">No caves match.</li>}
        {rows.length > LIST_MAX && (
          <li className="px-2 py-3 text-center text-[11px] text-slate-500">
            Showing {LIST_MAX} of {rows.length.toLocaleString()} — search by name or country, or use Near me.
          </li>
        )}
      </ul>
    </div>
  );
}

function DiveCard({ dive, ground }: { dive: { spec: CaveSpec; id: string; name: string; where: string }; ground: "loading" | "real" | "none" }) {
  const f = featuredById(dive.id);
  return (
    <HudPanel className="pointer-events-auto mt-1 max-w-[min(26rem,calc(100vw-5rem))] px-4 py-3">
      <p className="font-mono text-sm uppercase tracking-[0.25em] text-cyan-100">{dive.name}</p>
      <p className="mt-0.5 text-[12px] text-slate-400">{dive.where}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-200">
          {ground === "real" ? "Ground: real terrain + imagery" : ground === "loading" ? "Loading real terrain…" : "Ground: generic"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-amber-200">
          Passages: illustrative, not a survey
        </span>
      </div>
      {/* on phones the card keeps just the name + what's real; the detail is one tap away on the map */}
      <p className="mt-2 hidden text-[12px] leading-snug text-slate-300 sm:block">
        <span className="text-slate-400">Modelled as </span>
        {STYLE_LABEL[dive.spec.style].toLowerCase()}
        {f ? <span className="text-slate-400"> — {f.styleNote}</span> : null}
      </p>
      {f && (
        <p className="mt-2 hidden text-[12px] leading-snug text-slate-300 sm:block">
          {f.facts[0].text}{" "}
          <a href={f.facts[0].source.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] uppercase tracking-wider text-cyan-300/70 hover:text-cyan-200">
            ↗ source
          </a>
        </p>
      )}
    </HudPanel>
  );
}

function DepthGauge({ tele, view }: { tele: CaveTelemetry; view: CaveView }) {
  const max = Math.max(tele.maxDepth, 1);
  const pct = Math.min(100, (tele.depth / max) * 100);
  return (
    <HudPanel className="absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-2 px-2.5 py-3 sm:flex">
      <HudLabel className="!tracking-[0.15em]">Depth</HudLabel>
      <div className="relative h-56 w-1.5 rounded-full bg-gradient-to-b from-cyan-300/70 via-indigo-500/70 to-violet-700/70">
        <span
          className="absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-400 shadow-[0_0_12px_#22d3ee] transition-[top] duration-200"
          style={{ top: `${view === "fly" ? pct : 0}%` }}
        />
      </div>
      <span className="font-mono text-sm font-semibold text-white">{view === "fly" ? `${tele.depth} m` : "—"}</span>
      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">of ~{tele.maxDepth} m</span>
    </HudPanel>
  );
}
