"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Layers, Link2, ListOrdered, LocateFixed, Map as MapIcon, Mountain, Orbit, Pause, Play, ScanSearch, Search, Sparkles, X, BookOpen } from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass } from "@/components/atlas/Hud";
import type { AtlasView, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { IMPACTS_URL, LANDFORMS_URL, STRANGE_CATS, STRANGE_URL, formatAge, kmBetween, ringRadius0, strangeCat, type ImpactProps, type StrangeCat, type StrangeProps } from "@/utils/geo/strange";
import { ANOMALIES, VERDICTS, anomalyById, type Anomaly } from "./featured";
import { STRANGE_LAYERS } from "./layers";
import { StrangeDetails, type FlyTarget } from "./Details";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import type { LakeGeometry } from "@/components/atlas/basinGrid";
import { Refill } from "./Refill";
import { LAKES_URL, type LakeProps } from "./lakes";
import { STRANGE_STORIES, type StrangeAction } from "./stories";
import { Investigate, type InvestigateState } from "./Investigate";
import type { CompareCamera } from "@/components/atlas/CompareView";

/* ------------------------------------------------------------------ */
/*  Strange Earth — a full-screen globe of geological oddities: every  */
/*  confirmed impact crater on Earth at true size, the strangest       */
/*  landforms in the U.S., the bedrock under any click, and orbiting   */
/*  3D flyovers over real terrain and imagery.                         */
/* ------------------------------------------------------------------ */

type Mode = "map" | "investigate" | "fly" | "refill" | "stories";
type LakeFc = GeoJSON.FeatureCollection<LakeGeometry, LakeProps>;
type Panel = "explore" | "layers" | null;
type Fc<P> = GeoJSON.FeatureCollection<GeoJSON.Point, P>;

const ORBIT_SPEED = 5; // degrees per second
const TOUR_STOP_MS = 24000;

/** Zoom that shows the whole globe with the U.S. up front. */
const fitZoom = () => Math.min(3.2, Math.max(1.4, Math.log2((Math.min(window.innerWidth, window.innerHeight * 1.4) * 360) / (512 * 150))));

export default function StrangeApp() {
  const [mode, setMode] = useState<Mode>("map");
  const [places, setPlaces] = useState<Fc<StrangeProps> | null>(null);
  const [impacts, setImpacts] = useState<Fc<ImpactProps> | null>(null);
  const [landforms, setLandforms] = useState<GeoJSON.FeatureCollection | null>(null);
  const [lakes, setLakes] = useState<LakeFc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cats, setCats] = useState<Set<StrangeCat>>(() => new Set(STRANGE_CATS.map((c) => c.key)));

  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(STRANGE_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number } | null>(null);
  const [initialView] = useState(() => ({ center: [-98, 32] as [number, number], zoom: fitZoom() }));
  const [view, setView] = useState<AtlasView | null>(null);

  /* ── data ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([fetch(STRANGE_URL, { signal: ctl.signal }).then((r) => r.json()), fetch(IMPACTS_URL, { signal: ctl.signal }).then((r) => r.json())])
      .then(([p, i]: [Fc<StrangeProps>, Fc<ImpactProps>]) => {
        setPlaces(p);
        // true-size ring radius at zoom 0, so the layer can scale it with the map
        setImpacts({ ...i, features: i.features.map((f) => ({ ...f, properties: { ...f.properties, r0: ringRadius0(f.properties.diameterKm, f.geometry.coordinates[1]) } })) });
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    return () => ctl.abort();
  }, []);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(LAKES_URL, { signal: ctl.signal })
      .then((res) => res.json())
      .then(setLakes)
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);
  // ~0.5 MB of GNIS names: only once someone turns them on
  useEffect(() => {
    if (!visible.landforms || landforms) return;
    const ctl = new AbortController();
    fetch(LANDFORMS_URL, { signal: ctl.signal })
      .then((r) => r.json())
      .then(setLandforms)
      .catch(() => undefined);
    return () => ctl.abort();
  }, [visible.landforms, landforms]);

  const placeData = useMemo(() => (places ? { ...places, features: places.features.filter((f) => cats.has(f.properties.cat)) } : undefined), [places, cats]);
  const data = useMemo(() => ({ places: placeData, impacts: impacts ?? undefined, landforms: landforms ?? undefined }), [placeData, impacts, landforms]);

  /* ── selection ─────────────────────────────────────────────────── */
  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const pickAnomaly = (a: Anomaly) => {
    setPicked({ layer: "anomalies", id: a.id, props: { id: a.id, name: a.name }, lngLat: a.center });
    setFlyTo({ center: a.center, zoom: Math.min(a.fly.zoom - 1.5, 11), pitch: 40, bearing: 0, nonce: Date.now() });
  };
  const pickImpact = (f: Fc<ImpactProps>["features"][number]) => {
    const at = f.geometry.coordinates as [number, number];
    setPicked({ layer: "impacts", id: f.properties.id, props: f.properties as unknown as Record<string, unknown>, lngLat: at });
    setFlyTo({ center: at, zoom: Math.max(4, Math.min(12, 11.5 - Math.log2(Math.max(f.properties.diameterKm, 0.3)))), pitch: 30, bearing: 0, nonce: Date.now() });
  };
  const pickPlace = (f: Fc<StrangeProps>["features"][number]) => {
    const at = f.geometry.coordinates as [number, number];
    setPicked({ layer: "places", id: f.properties.id, props: f.properties as unknown as Record<string, unknown>, lngLat: at });
    setFlyTo({ center: at, zoom: 11, pitch: 40, bearing: 0, nonce: Date.now() });
  };

  /* ── 3D flyover ────────────────────────────────────────────────── */
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const [orbiting, setOrbiting] = useState(true);
  const [touring, setTouring] = useState(false);
  const before = useRef<{ basemap: Basemap; terrain: TerrainMode } | null>(null);

  const startFly = useCallback((t: FlyTarget) => {
    if (!before.current) before.current = { basemap, terrain };
    setFly(t);
    setMode("fly");
    setPickedState(null);
    setPanel(null);
    setBasemap("satellite");
    setTerrain("3d");
    setOrbiting(true);
    const cam = t.fly ?? { zoom: 13, pitch: 60, bearing: 20 };
    setFlyTo({ center: t.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, nonce: Date.now() });
  }, [basemap, terrain]);

  const flyAnomaly = useCallback((a: Anomaly) => startFly({ name: a.name, center: a.center, fly: a.fly, anomalyId: a.id }), [startFly]);

  /** Where to go back to when a tool opened from a story closes. */
  const returnTo = useRef<Mode | null>(null);
  const backMode = () => {
    const m = returnTo.current ?? "map";
    returnTo.current = null;
    return m;
  };
  /** Leave the flyover's satellite + 3D setup without moving the camera. */
  const resetFly = useCallback(() => {
    const back = before.current;
    before.current = null;
    setTouring(false);
    setBasemap(back?.basemap ?? "map");
    setTerrain(back?.terrain ?? "flat");
    setFly(null);
  }, []);
  const exitFly = useCallback(() => {
    const to = backMode();
    resetFly();
    setMode(to);
    if (fly && to === "map") setFlyTo({ center: fly.center, zoom: 5, pitch: 0, bearing: 0, nonce: Date.now() });
  }, [fly, resetFly]);

  /* ── investigate (compare lenses) ──────────────────────────────── */
  const [invest, setInvest] = useState<(Partial<InvestigateState> & { camera: CompareCamera; focus?: string; nonce: number }) | null>(null);
  const investState = useRef<InvestigateState | null>(null);
  const startInvestigate = useCallback(
    (t: { center: [number, number]; zoom?: number; anomalyId?: string } & Partial<InvestigateState>) => {
      if (mode === "fly") resetFly();
      setRefillId(null);
      const zoom = Math.min(16, Math.max(t.zoom ?? 13, 10));
      setInvest({ ...t, camera: { center: t.center, zoom }, focus: t.anomalyId, nonce: Date.now() });
      setMode("investigate");
      setPickedState(null);
      setPanel(null);
    },
    [mode, resetFly]
  );
  const exitInvestigate = useCallback((cam: CompareCamera) => {
    setMode(backMode());
    setInvest(null);
    investState.current = null;
    setFlyTo({ center: cam.center, zoom: Math.min(cam.zoom, 12), pitch: 0, bearing: 0, nonce: Date.now() });
  }, []);
  // from the mode switch: the spot in the middle of the map (or the open anomaly)
  const investigateHere = () => {
    const a = picked?.layer === "anomalies" ? anomalyById(String(picked.id)) : fly?.anomalyId ? anomalyById(fly.anomalyId) : undefined;
    if (a) return startInvestigate({ center: a.center, zoom: Math.min(a.fly.zoom, 14), anomalyId: a.id });
    if (picked) return startInvestigate({ center: picked.lngLat, zoom: 13 });
    if (view && view.zoom >= 8) return startInvestigate({ center: view.center, zoom: view.zoom });
    // zoomed out to the globe: start somewhere worth looking at
    const m = ANOMALIES[0];
    startInvestigate({ center: m.center, zoom: 14, anomalyId: m.id });
  };

  /* ── refill an Ice Age lake ─────────────────────────────────────── */
  const [refillId, setRefillId] = useState<number | null>(null);
  const refillLake = lakes?.features.find((f) => f.properties.id === refillId) ?? null;
  const bigLakes = useMemo(() => (lakes?.features ?? []).filter((f) => f.properties.name).slice(0, 12), [lakes]);
  const openRefill = useCallback(
    (key: number | string) => {
      const f = lakes?.features.find((l) => (typeof key === "number" ? l.properties.id === key : l.properties.name === key));
      if (!f) return;
      if (mode === "fly") resetFly();
      setInvest(null);
      setRefillId(f.properties.id);
      setMode("refill");
      setPickedState(null);
      setPanel(null);
    },
    [lakes, mode, resetFly]
  );
  const exitRefill = useCallback(() => {
    const to = backMode();
    const f = refillLake;
    setRefillId(null);
    setMode(to);
    if (f && to === "map") {
      const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flatMap((poly) => poly[0]);
      const lng = ring.reduce((a, c) => a + c[0], 0) / ring.length;
      const lat = ring.reduce((a, c) => a + c[1], 0) / ring.length;
      setFlyTo({ center: [lng, lat], zoom: Math.max(5, 9.5 - Math.log2(Math.max(1, f.properties.areaKm2)) / 2), pitch: 0, bearing: 0, nonce: Date.now() });
    }
  }, [refillLake]);

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const story = STRANGE_STORIES.find((st) => st.id === storyId) ?? null;
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
  const runStoryAction = (a: StoryAction<StrangeAction>) => {
    const v = String(a.value ?? "");
    if (a.kind === "geology") return setVisible((cur) => ({ ...cur, geology: true }));
    returnTo.current = "stories";
    if (a.kind === "refill") openRefill(v);
    else if (a.kind === "fly") {
      const an = anomalyById(v);
      if (an) flyAnomaly(an);
    } else if (a.kind === "investigate") {
      const an = anomalyById(v);
      const at = v.split(",").map(Number);
      if (an) startInvestigate({ center: an.center, zoom: Math.min(an.fly.zoom, 14), anomalyId: an.id });
      else if (at.length === 3 && at.every(Number.isFinite)) startInvestigate({ center: [at[0], at[1]], zoom: at[2] });
    }
  };

  /** The mode switch: leave whatever is open, then enter the new mode. */
  const goMode = (m: Mode) => {
    if (m === mode) return;
    returnTo.current = null;
    if (m === "map") {
      if (mode === "fly") exitFly();
      else if (mode === "investigate") exitInvestigate(investState.current?.camera ?? invest?.camera ?? { center: initialView.center, zoom: initialView.zoom });
      else if (mode === "refill") exitRefill();
      else setMode("map");
      return;
    }
    if (m === "investigate") return investigateHere();
    if (mode === "fly") resetFly();
    setInvest(null);
    setRefillId(null);
    if (m === "fly") startTour();
    else setMode(m);
    setPickedState(null);
    setPanel(null);
  };

  const tourIndex = fly?.anomalyId ? ANOMALIES.findIndex((a) => a.id === fly.anomalyId) : -1;
  const step = useCallback((dir: 1 | -1) => {
    const i = tourIndex < 0 ? 0 : (tourIndex + dir + ANOMALIES.length) % ANOMALIES.length;
    flyAnomaly(ANOMALIES[i]);
  }, [tourIndex, flyAnomaly]);
  const startTour = () => {
    setTouring(true);
    flyAnomaly(ANOMALIES[0]);
  };
  // the tour moves on by itself
  useEffect(() => {
    if (!touring || mode !== "fly") return;
    const t = setTimeout(() => step(1), TOUR_STOP_MS);
    return () => clearTimeout(t);
  }, [touring, mode, fly, step]);

  /* ── keyboard (flyover) ────────────────────────────────────────── */
  useEffect(() => {
    if (mode !== "fly") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") exitFly();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setOrbiting((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, exitFly, step]);

  /* ── shareable links: ?a=<anomaly>&mode=fly · ?impact=Q… · ?place=Q… ── */
  const urlRead = useRef(false);
  const [investTick, setInvestTick] = useState(0);
  useEffect(() => {
    if (!impacts || !places || urlRead.current) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const a = q.get("a") && anomalyById(q.get("a")!);
    const imp = q.get("impact") && impacts.features.find((f) => f.properties.id === q.get("impact"));
    const pl = q.get("place") && places.features.find((f) => f.properties.id === q.get("place"));
    if (q.get("geology") === "1") setVisible((v) => ({ ...v, geology: true }));
    const at = q.get("at")?.split(",").map(Number);
    const st = q.get("story");
    if (st && STRANGE_STORIES.some((x) => x.id === st)) {
      setStoryId(st);
      setChapter(Math.max(0, Number(q.get("ch")) || 0));
      setMode("stories");
    } else if (q.get("mode") === "investigate" && at?.length === 3 && at.every(Number.isFinite)) {
      const lens = (v: string | null) => (["satellite", "lidar", "geology", "topo"].includes(v ?? "") ? (v as InvestigateState["left"]) : undefined);
      startInvestigate({
        center: [at[0], at[1]],
        zoom: at[2],
        anomalyId: a ? a.id : undefined,
        layout: q.get("lay") === "grid" ? "grid" : "swipe",
        left: lens(q.get("l")),
        right: lens(q.get("r")),
        edition: q.get("ed"),
      });
    } else if (a && q.get("mode") === "fly") flyAnomaly(a);
    else if (a) pickAnomaly(a);
    else if (imp) pickImpact(imp);
    else if (pl) pickPlace(pl);
    // read once, when the data arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impacts, places]);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    const iv = investState.current;
    if (mode === "investigate" && iv) {
      q.set("mode", "investigate");
      q.set("at", `${iv.camera.center[0].toFixed(5)},${iv.camera.center[1].toFixed(5)},${iv.camera.zoom.toFixed(2)}`);
      if (invest?.focus) q.set("a", invest.focus);
      if (iv.layout === "grid") q.set("lay", "grid");
      else {
        q.set("l", iv.left);
        q.set("r", iv.right);
      }
      if (iv.edition) q.set("ed", iv.edition);
    } else if (mode === "refill" && refillId != null) {
      q.set("mode", "refill");
      q.set("lake", String(refillId));
    } else if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (mode === "fly" && fly?.anomalyId) {
      q.set("a", fly.anomalyId);
      q.set("mode", "fly");
    } else if (picked?.layer === "anomalies") q.set("a", String(picked.id));
    else if (picked?.layer === "impacts") q.set("impact", String(picked.id));
    else if (picked?.layer === "places") q.set("place", String(picked.id));
    if (visible.geology && mode === "map") q.set("geology", "1");
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, fly, picked, visible.geology, investTick, refillId, storyId, chapter]);
  // ?mode=refill&lake=… needs the lake outlines, which arrive separately
  const lakeUrlRead = useRef(false);
  useEffect(() => {
    if (!lakes || lakeUrlRead.current) return;
    lakeUrlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const id = Number(q.get("lake"));
    if (q.get("mode") === "refill" && q.get("lake") && Number.isFinite(id)) openRefill(id);
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lakes]);
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

  const citations = STRANGE_LAYERS.filter((l) => visible[l.id] && l.citation.label).map((l) => l.citation);
  const flyAnom = fly?.anomalyId ? anomalyById(fly.anomalyId) : undefined;
  const geologyOn = !!visible.geology;
  const landformsHidden = visible.landforms && (view?.zoom ?? 0) < 4.5;

  return (
    <div className="dark fixed inset-0 overflow-hidden bg-[#03020a] text-slate-100">
      <style>{`@keyframes tourBar { from { transform: scaleX(0) } to { transform: scaleX(1) } } @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <AtlasMap
        layers={STRANGE_LAYERS}
        visible={visible}
        data={data}
        basemap={basemap}
        terrain={terrain}
        dark
        atmosphere
        selected={picked}
        onPick={mode === "fly" ? undefined : setPicked}
        flyTo={flyTo}
        initialView={initialView}
        onView={setView}
        orbit={mode === "fly" && orbiting ? ORBIT_SPEED : 0}
        onOrbitStop={() => setOrbiting(false)}
        className="atlas-space absolute inset-0"
      >
        {mode === "map" && (
          <StrangeDetails
            picked={picked}
            onClose={() => setPickedState(null)}
            onFly={startFly}
            onInvestigate={(t) => startInvestigate({ center: t.center, zoom: Math.min(t.fly?.zoom ?? 13, 14), anomalyId: t.anomalyId })}
            onRefill={openRefill}
          />
        )}
      </AtlasMap>

      {mode === "refill" && refillLake && <Refill lake={refillLake} lakes={bigLakes} onPick={(id) => setRefillId(id)} onExit={exitRefill} />}

      {mode === "stories" && (
        <StoryPlayer
          stories={STRANGE_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}

      {mode === "investigate" && invest && (
        <Investigate
          key={invest.nonce}
          initial={invest}
          focus={invest.focus ? anomalyById(invest.focus) : undefined}
          onExit={exitInvestigate}
          onState={(st) => {
            investState.current = st;
            setInvestTick((n) => n + 1);
          }}
        />
      )}

      {/* ── top-left: back, title, mode ──────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-fuchsia-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Strange Earth</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            title="Copy a link to exactly this view"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${copied ? "text-emerald-300" : "text-slate-300 hover:text-fuchsia-200"}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2">
          <HudSwitch
            id="se-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={goMode}
            options={[
              { key: "map", label: <><MapIcon className="h-3.5 w-3.5" />Map</> },
              { key: "investigate", label: <><ScanSearch className="h-3.5 w-3.5" />Investigate</>, title: "Compare satellite, bare-earth lidar, geology and old topo maps of one spot" },
              { key: "fly", label: <><Orbit className="h-3.5 w-3.5" />Flyover</>, title: "Orbit each featured anomaly in 3D" },
              { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</>, title: "Guided tours: Lake Bonneville, impact scars, unsolved mysteries" },
            ]}
          />
          {mode === "map" && (
            <button
              type="button"
              onClick={() => setVisible((v) => ({ ...v, geology: !v.geology }))}
              aria-pressed={geologyOn}
              title="Colour the map by the rock at the surface; click anywhere to ask what's under it"
              className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-all ${
                geologyOn ? "border-fuchsia-300/50 text-fuchsia-100 shadow-[0_0_22px_-4px_rgba(232,121,249,0.7)]" : "text-slate-300 hover:text-white"
              }`}
            >
              <Mountain className="h-3.5 w-3.5" /> What&apos;s under here? {geologyOn ? "on" : "off"}
            </button>
          )}
        </div>
        {loadError && <p className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}>Couldn&apos;t load the map data ({loadError}).</p>}
        {mode === "map" && geologyOn && !picked && (
          <p className={`${hudGlass} px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fuchsia-200/80`}>Click anywhere to read the rock beneath it</p>
        )}
        {mode === "map" && landformsHidden && (
          <p className={`${hudGlass} px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300`}>Zoom in to see named landforms</p>
        )}
      </div>

      {/* ── right rail ───────────────────────────────────────────── */}
      {mode === "map" && (
        <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
          <HudIconButton icon={ListOrdered} label="Explore anomalies, craters and places" active={panel === "explore"} onClick={() => togglePanel("explore")} badge={ANOMALIES.length} />
          <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
        </div>
      )}

      {panel && mode === "map" && (
        <SidePanel title={panel === "explore" ? "Explore" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "explore" && (
            <ExploreList
              impacts={impacts?.features ?? []}
              places={places?.features ?? []}
              onAnomaly={pickAnomaly}
              onFlyAnomaly={flyAnomaly}
              onImpact={pickImpact}
              onPlace={pickPlace}
              onLocate={(at) => setFlyTo({ center: at, zoom: 6, pitch: 0, bearing: 0, nonce: Date.now() })}
            />
          )}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel
                id="se"
                layers={STRANGE_LAYERS}
                visible={visible}
                onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))}
                basemap={basemap}
                onBasemap={setBasemap}
                terrain={terrain}
                onTerrain={setTerrain}
                extras={{
                  places: (
                    <CatFilter
                      cats={cats}
                      counts={places?.features ?? []}
                      onToggle={(k) =>
                        setCats((cur) => {
                          const next = new Set(cur);
                          if (next.has(k)) next.delete(k);
                          else next.add(k);
                          return next;
                        })
                      }
                    />
                  ),
                }}
              />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── flyover HUD ──────────────────────────────────────────── */}
      {mode === "fly" && fly && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col items-center gap-2">
          <HudPanel className="w-full max-w-[640px] px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fuchsia-200/70">
                  {flyAnom ? `Anomaly ${tourIndex + 1} of ${ANOMALIES.length}` : "Flyover"}
                  {flyAnom && (
                    <span className="ml-2" style={{ color: VERDICTS[flyAnom.verdict].color }}>
                      · {VERDICTS[flyAnom.verdict].label}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate font-mono text-lg font-semibold uppercase tracking-[0.18em] text-white">{fly.name}</p>
                {flyAnom && <p className="text-[12px] text-slate-400">{flyAnom.where}</p>}
              </div>
              <button type="button" onClick={exitFly} aria-label="Exit flyover" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {flyAnom && <FactTicker key={flyAnom.id} anomaly={flyAnom} />}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {flyAnom && (
                <button type="button" onClick={() => step(-1)} aria-label="Previous anomaly" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOrbiting((o) => !o)}
                aria-pressed={orbiting}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider ${orbiting ? "border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-100" : "border-white/10 text-slate-300"}`}
              >
                {orbiting ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Orbit
              </button>
              {flyAnom && (
                <button
                  type="button"
                  onClick={() => setTouring((t) => !t)}
                  aria-pressed={touring}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider ${touring ? "border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-100" : "border-white/10 text-slate-300"}`}
                >
                  {touring ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Auto-tour
                </button>
              )}
              {flyAnom && (
                <button type="button" onClick={() => step(1)} aria-label="Next anomaly" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-slate-500 sm:block">Drag to look · Space orbit · ←→ next · Esc exit</span>
            </div>
          </HudPanel>
          {touring && <TourProgress key={fly.anomalyId} />}
        </div>
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      {mode === "map" && (
        <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
          <HudStat label="Confirmed impacts" value={impacts ? impacts.features.length : "—"} tone="text-pink-300" onClick={() => togglePanel("explore")} />
          <HudStat label="Strange places" value={places ? places.features.length : "—"} tone="text-violet-300" />
          <HudStat label="Named landforms" value={landforms ? landforms.features.length.toLocaleString() : visible.landforms ? "…" : "off"} tone="text-orange-200" onClick={() => setVisible((v) => ({ ...v, landforms: !v.landforms }))} />
          <HudStat label="Ice Age lakes" value={lakes ? lakes.features.length : "—"} tone="text-sky-300" onClick={() => openRefill("Bonneville")} />
          <HudStat label="Flyover tour" value={`${ANOMALIES.length} stops`} tone="text-fuchsia-300" onClick={startTour} />
        </HudPanel>
      )}
    </div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────── */

function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <HudPanel className="absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] flex-col md:inset-x-auto md:bottom-20 md:right-16 md:top-3 md:max-h-none md:w-[350px]">
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

function CatFilter({ cats, counts, onToggle }: { cats: Set<StrangeCat>; counts: Fc<StrangeProps>["features"]; onToggle: (k: StrangeCat) => void }) {
  const n = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of counts) m[f.properties.cat] = (m[f.properties.cat] ?? 0) + 1;
    return m;
  }, [counts]);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {STRANGE_CATS.map((c) => {
        const on = cats.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onToggle(c.key)}
            aria-pressed={on}
            title={c.blurb}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${on ? "border-white/20 text-slate-100" : "border-white/5 text-slate-500 line-through"}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: on ? c.color : "#475569" }} />
            {c.label}
            <span className="font-mono text-[9px] text-slate-500">{n[c.key] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

type ExploreTab = "featured" | "craters" | "places";

function ExploreList({
  impacts,
  places,
  onAnomaly,
  onFlyAnomaly,
  onImpact,
  onPlace,
  onLocate,
}: {
  impacts: Fc<ImpactProps>["features"];
  places: Fc<StrangeProps>["features"];
  onAnomaly: (a: Anomaly) => void;
  onFlyAnomaly: (a: Anomaly) => void;
  onImpact: (f: Fc<ImpactProps>["features"][number]) => void;
  onPlace: (f: Fc<StrangeProps>["features"][number]) => void;
  onLocate: (at: [number, number]) => void;
}) {
  const [tab, setTab] = useState<ExploreTab>("featured");
  const [q, setQ] = useState("");
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
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
  const needle = q.trim().toLowerCase();
  const dist = (at: [number, number]) => (me ? kmBetween(me, at) : null);
  const fmtKm = (d: number | null) => (d == null ? "" : ` · ${d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString()} km`);
  const byDist = <T extends { d: number | null }>(a: T, b: T) => (a.d != null && b.d != null ? a.d - b.d : 0);

  const anomalyRows = useMemo(
    () => ANOMALIES.filter((a) => !needle || `${a.name} ${a.where}`.toLowerCase().includes(needle)).map((a) => ({ a, d: dist(a.center) })).sort(byDist),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needle, me]
  );
  const craterRows = useMemo(
    () =>
      impacts
        .filter((f) => !needle || `${f.properties.name} ${f.properties.location ?? ""} ${f.properties.country ?? ""}`.toLowerCase().includes(needle))
        .map((f) => ({ f, d: dist(f.geometry.coordinates as [number, number]) }))
        // nearest first once located; otherwise biggest first
        .sort((a, b) => byDist(a, b) || b.f.properties.diameterKm - a.f.properties.diameterKm)
        .slice(0, 120),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [impacts, needle, me]
  );
  const placeRows = useMemo(
    () =>
      places
        .filter((f) => !needle || `${f.properties.name} ${f.properties.state ?? ""}`.toLowerCase().includes(needle))
        .map((f) => ({ f, d: dist(f.geometry.coordinates as [number, number]) }))
        .sort((a, b) => byDist(a, b) || Number(!!b.f.properties.image) - Number(!!a.f.properties.image) || a.f.properties.name.localeCompare(b.f.properties.name))
        .slice(0, 120),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, needle, me]
  );

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <HudSwitch
        id="se-explore"
        ariaLabel="List"
        value={tab}
        onChange={setTab}
        className="!bg-transparent !shadow-none"
        options={[
          { key: "featured", label: "Featured" },
          { key: "craters", label: `Craters ${impacts.length || ""}` },
          { key: "places", label: `Places ${places.length || ""}` },
        ]}
      />
      <div className="flex gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "craters" ? "Search craters or countries…" : "Search names or states…"}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-fuchsia-300/40"
          />
        </label>
        <button
          type="button"
          onClick={locate}
          disabled={locating === "busy"}
          title="Sort by distance from you (asks for your location; it isn't stored)"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${me ? "border-fuchsia-300/40 text-fuchsia-100" : "border-white/10 text-slate-300 hover:text-white"}`}
        >
          <LocateFixed className={`h-3.5 w-3.5 ${locating === "busy" ? "animate-pulse" : ""}`} /> Near me
        </button>
      </div>
      {locating === "denied" && <p className="text-[11px] text-amber-200">Location isn&apos;t available — the list keeps its usual order.</p>}

      <ul className="space-y-0.5">
        {tab === "featured" &&
          anomalyRows.map(({ a, d }) => (
            <li key={a.id} className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.05]">
              <button type="button" onClick={() => onAnomaly(a)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2" style={{ borderColor: a.accent, boxShadow: `0 0 8px ${a.accent}` }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">{a.name}</span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    <span style={{ color: VERDICTS[a.verdict].color }}>{VERDICTS[a.verdict].label}</span> · {a.where.split(",").pop()?.trim()}
                    {fmtKm(d)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onFlyAnomaly(a)}
                aria-label={`Fly over ${a.name}`}
                className="shrink-0 rounded-lg border border-fuchsia-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fuchsia-200 opacity-70 transition-opacity hover:bg-fuchsia-400/10 group-hover:opacity-100"
              >
                3D
              </button>
            </li>
          ))}
        {tab === "craters" &&
          craterRows.map(({ f, d }) => (
            <li key={f.properties.id}>
              <button type="button" onClick={() => onImpact(f)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-pink-300" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-slate-100">{f.properties.name}</span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {f.properties.country ?? "—"} · {formatAge(f.properties.ageMa)}
                    {fmtKm(d)}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-pink-200">{f.properties.diameterKm} km</span>
              </button>
            </li>
          ))}
        {tab === "places" &&
          placeRows.map(({ f, d }) => {
            const c = strangeCat(f.properties.cat);
            return (
              <li key={f.properties.id}>
                <button type="button" onClick={() => onPlace(f)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-slate-100">{f.properties.name}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {c.label} · {f.properties.state ?? "—"}
                      {fmtKm(d)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        {((tab === "featured" && !anomalyRows.length) || (tab === "craters" && !craterRows.length) || (tab === "places" && !placeRows.length)) && (
          <li className="py-6 text-center text-xs text-slate-500">Nothing matches.</li>
        )}
      </ul>
    </div>
  );
}

/** Cycles the anomaly's sourced facts while the camera circles. */
function FactTicker({ anomaly }: { anomaly: Anomaly }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % anomaly.facts.length), 7000);
    return () => clearInterval(t);
  }, [anomaly]);
  const f = anomaly.facts[i];
  return (
    <p key={i} className="mt-2 min-h-[2.5rem] animate-[fadeIn_0.5s_ease] text-[13px] leading-snug text-slate-200">
      {f.text}{" "}
      <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-fuchsia-300/70 hover:text-fuchsia-200">
        ↗ {f.source.label}
      </a>
    </p>
  );
}

function TourProgress() {
  return (
    <div className="h-1 w-full max-w-[640px] overflow-hidden rounded-full bg-white/10">
      <div className="h-full origin-left bg-gradient-to-r from-fuchsia-400 to-violet-500" style={{ animation: `tourBar ${TOUR_STOP_MS}ms linear forwards` }} />
    </div>
  );
}
