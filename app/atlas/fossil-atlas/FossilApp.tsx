"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Bone, Check, ChevronRight, Hourglass, Layers, Link2, ListOrdered, Loader2, LocateFixed, Map as MapIcon, Pause, Play, Search, X } from "lucide-react";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { useLibrary } from "@/utils/geo/useLibrary";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass, useAtlasTheme } from "@/components/atlas/Hud";
import type { AtlasView, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import {
  FLAG_DINO,
  FLAG_MAMMAL,
  FOSSILS_FORMATIONS_URL,
  FOSSILS_INDEX_URL,
  FOSSILS_SUMMARY_URL,
  PERIODS,
  SITES_MIN_ZOOM,
  fitBbox,
  fossilTileUrl,
  periodCounts,
  periodEnd,
  searchFormations,
  summaryFeatures,
  tileFeatures,
  tilesAround,
  tilesFor,
  word,
  type FormationIndex,
  type FossilIndex,
  type FossilSummary,
  type FossilTile,
} from "@/utils/geo/fossils";
import { useTileSet } from "@/utils/geo/useTileSet";
import { formatAge, kmBetween } from "@/utils/geo/strange";
import { coastFeatures, coastPointIn, fmtMa, nearestCoastPoint, paleoFeatures, paleoImageUrl, sitesIn, type PaleoSliceData } from "@/utils/geo/paleo";
import { FOSSIL_PARKS, parkById, type FossilPark } from "./featured";
import { BONE, FOSSIL_LAYERS, TIME_ONLY, TODAY_ONLY } from "./layers";
import { FossilDetailsDrawer } from "./Details";
import { TimeBar, useTimeMachine } from "./TimeMachine";
import { FOSSIL_STORIES, fossilStoryById, type FossilAction } from "./stories";

/* ------------------------------------------------------------------ */
/*  Prehistoric Earth — every fossil site in the world in the          */
/*  Paleobiology Database, by geologic period, with the dinosaur sites */
/*  marked and the parks that protect famous fossil beds — and a time  */
/*  machine back to Earth as it was when they were alive.              */
/* ------------------------------------------------------------------ */

type Show = "all" | "dinos" | "mammals";
type Mode = "today" | "time" | "stories";
const ORBIT_SPEED = 5; // degrees per second
type Panel = "find" | "layers" | null;
type FlyTo = { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number };
const SHOW_FLAG: Record<Show, number | undefined> = { all: undefined, dinos: FLAG_DINO, mammals: FLAG_MAMMAL };
/** A formation can sit in many tiles; load at most this many. */
const FORMATION_TILES_MAX = 80;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export default function FossilApp() {
  const dark = useAtlasTheme();
  const [index, setIndex] = useState<FossilIndex | null>(null);
  const [summary, setSummary] = useState<FossilSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(FOSSIL_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const [initialView] = useState(() => ({ center: [-30, 30] as [number, number], zoom: Math.min(2.4, Math.max(1.4, Math.log2(window.innerWidth / 420))) }));

  /* filters: what to show, one period, one rock formation (by name) */
  const [show, setShow] = useState<Show>("all");
  const [period, setPeriod] = useState<number | null>(null);
  const [formation, setFormation] = useState<string | null>(null);

  /* ── modes: today's map · the time machine ─────────────────────── */
  const [mode, setMode] = useState<Mode>(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("story") ? "stories" : q.has("t") ? "time" : "today";
  });
  /* a story chapter can open the time machine too */
  const [storyAge, setStoryAge] = useState<number | null>(null);
  const [startAge] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    return t != null && Number.isFinite(Number(t)) ? Number(t) : null;
  });
  const timeOn = mode === "time" || (mode === "stories" && storyAge != null);
  const machine = useTimeMachine(timeOn, startAge);
  const [follow, setFollow] = useState(true);
  const [view, setView] = useState<AtlasView | null>(null);
  const viewRef = useRef<AtlasView | null>(null);
  viewRef.current = view ?? viewRef.current;
  // ancient Earth on: its layers in, today's geology, parks and summary out (and back as they were after)
  const todaySaved = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (timeOn) {
      setPeriod(null);
      setVisible((v) => {
        todaySaved.current = Object.fromEntries(TODAY_ONLY.map((id) => [id, v[id]]));
        return { ...v, ...Object.fromEntries(TIME_ONLY.map((id) => [id, true])), ...Object.fromEntries(TODAY_ONLY.map((id) => [id, false])) };
      });
    } else {
      setVisible((v) => ({ ...v, ...Object.fromEntries(TIME_ONLY.map((id) => [id, false])), ...(todaySaved.current ?? Object.fromEntries(TODAY_ONLY.map((id) => [id, !!FOSSIL_LAYERS.find((l) => l.id === id)?.defaultOn]))) }));
    }
  }, [timeOn]);
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setStoryAge(null);
    setPickedState(null);
    setPanel(null);
  };

  /* keep the land you're looking at in view as it drifts: the coastline point nearest the middle of the screen, in the next slice */
  const paleo = machine.data as PaleoSliceData | null;
  const prevSlice = useRef<PaleoSliceData | null>(null);
  useEffect(() => {
    if (!timeOn || !paleo) return;
    const prev = prevSlice.current;
    prevSlice.current = paleo;
    const v = viewRef.current;
    if (!follow || !prev || !v || prev === paleo) return;
    const k = nearestCoastPoint(prev.coast, v.center);
    const then = k >= 0 ? coastPointIn(paleo.coast, k) : null;
    if (!then) return;
    // move the view by as much as that coastline point moved
    const from = prev.coast[k] ?? v.center;
    setFlyTo({ center: [v.center[0] + (then[0] - from[0]), Math.max(-80, Math.min(80, v.center[1] + (then[1] - from[1])))], zoom: v.zoom, nonce: Date.now() });
  }, [paleo, timeOn, follow]);

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(() => {
    const id = new URLSearchParams(window.location.search).get("story");
    return id && fossilStoryById(id) ? id : null;
  });
  const [chapter, setChapter] = useState(() => Math.max(0, Number(new URLSearchParams(window.location.search).get("ch") ?? 0) || 0));
  const story = storyId ? fossilStoryById(storyId) ?? null : null;
  const library = useLibrary(mode === "stories" ? { project: "fossil-atlas" } : null);
  // each chapter flies to its camera, on today's map
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    const i = Math.min(chapter, story.chapters.length - 1);
    setPickedState(null);
    setStoryAge(null);
    setFlyTo({ ...story.chapters[i].camera, nonce: Date.now() });
    // run when the chapter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storyId, chapter]);
  // an open story reads best over satellite; the previous map comes back after
  const beforeStory = useRef<Basemap | null>(null);
  useEffect(() => {
    const reading = mode === "stories" && !!storyId;
    if (reading && beforeStory.current == null) {
      beforeStory.current = basemap;
      setBasemap("satellite");
    } else if (!reading && beforeStory.current != null) {
      setBasemap(beforeStory.current);
      beforeStory.current = null;
    }
    // only when a story opens or closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storyId]);
  const openStory = (id: string | null) => {
    setStoryId(id);
    setChapter(0);
    setStoryAge(null);
  };

  /* ── 3D flyover of a fossil park ───────────────────────────────── */
  const [fly, setFly] = useState<FossilPark | null>(null);
  const [orbiting, setOrbiting] = useState(true);
  const beforeFly = useRef<{ basemap: Basemap; terrain: TerrainMode } | null>(null);
  const startFly = useCallback(
    (p: FossilPark) => {
      if (!beforeFly.current) beforeFly.current = { basemap, terrain };
      setFly(p);
      setStoryAge(null);
      if (mode === "time") setMode("today");
      setPickedState(null);
      setPanel(null);
      setBasemap("satellite");
      setTerrain("3d");
      setOrbiting(true);
      setFlyTo({ center: p.center, zoom: Math.min(p.zoom, 15) - 0.5, pitch: 62, bearing: 20, nonce: Date.now() });
    },
    [basemap, terrain, mode]
  );
  const endFly = useCallback(() => {
    const b = beforeFly.current;
    beforeFly.current = null;
    setFly(null);
    if (b) {
      setBasemap(b.basemap);
      setTerrain(b.terrain);
    }
  }, []);
  const flyIndex = fly ? FOSSIL_PARKS.findIndex((p) => p.id === fly.id) : -1;

  /* ── data: index + summary up front, tiles for the view, formations on demand ── */
  useEffect(() => {
    const ctl = new AbortController();
    const get = (u: string) => fetch(u, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u}: HTTP ${r.status}`))));
    Promise.all([get(FOSSILS_INDEX_URL), get(FOSSILS_SUMMARY_URL)])
      .then(([ix, sm]: [FossilIndex, FossilSummary]) => {
        setIndex(ix);
        setSummary(sm);
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    return () => ctl.abort();
  }, []);
  const [formations, setFormations] = useState<FormationIndex | null>(null);
  const formationsLoading = useRef<Promise<FormationIndex> | null>(null);
  const loadFormations = useCallback(() => {
    if (!formationsLoading.current)
      formationsLoading.current = fetch(FOSSILS_FORMATIONS_URL)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((fi: FormationIndex) => {
          setFormations(fi);
          return fi;
        });
    return formationsLoading.current;
  }, []);
  /** extra tiles: a formation's, "near me", a share link's */
  const [need, setNeed] = useState<string[]>([]);
  const zoom = view?.zoom ?? initialView.zoom;
  const zoomedIn = zoom >= SITES_MIN_ZOOM;
  const viewTiles = useMemo(() => (index && view && zoomedIn && !timeOn ? tilesFor(view.bounds, index) : []), [index, view, zoomedIn, timeOn]);
  const wanted = useMemo(() => Array.from(new Set([...viewTiles, ...need])), [viewTiles, need]);
  const loaded = useTileSet<FossilTile>(wanted, fossilTileUrl);

  const flag = SHOW_FLAG[show];
  // zoomed in or a formation: every site; zoomed out: the summary
  const sites = useMemo(() => (formation || zoomedIn ? tileFeatures(loaded.tiles, { period, flag, formation }) : EMPTY_FC), [loaded.tiles, period, flag, formation, zoomedIn]);
  const cells = useMemo(() => (summary && !formation && !zoomedIn ? summaryFeatures(summary, { period, flag }) : EMPTY_FC), [summary, period, flag, formation, zoomedIn]);
  const paleoSpots = useMemo(() => (timeOn && paleo && machine.index ? paleoFeatures(paleo, machine.index.tiles, { flag }) : null), [timeOn, paleo, machine.index, flag]);
  const mapData = useMemo(
    () =>
      timeOn
        ? {
            fossils: paleoSpots ?? EMPTY_FC,
            cells: EMPTY_FC,
            coastthen: paleo && machine.index ? coastFeatures(machine.index.coast, paleo.coast) : undefined,
            ancient: machine.slice ? { url: paleoImageUrl(machine.slice.file) } : undefined,
          }
        : { fossils: sites, cells },
    [timeOn, paleoSpots, paleo, machine.index, machine.slice, sites, cells]
  );

  /* how many sites each period chip would show under the other filters */
  const perCounts = useMemo(() => {
    if (formation) {
      const out = PERIODS.map(() => 0);
      for (const f of tileFeatures(loaded.tiles, { flag, formation }).features) out[Number(f.properties?.per)]++;
      return out;
    }
    return summary ? periodCounts(summary, flag) : PERIODS.map(() => 0);
  }, [summary, flag, formation, loaded.tiles]);
  const shown = formation || zoomedIn ? sites.features.length : cells.features.reduce((a, f) => a + Number(f.properties?.n ?? 0), 0);

  const setPicked = useCallback((p: Picked | null) => {
    // a zoomed-out cell: zoom in on it
    if (p?.layer === "cells") {
      setFlyTo({ center: p.lngLat, zoom: SITES_MIN_ZOOM + 1.2, pitch: 0, bearing: 0, nonce: Date.now() });
      return;
    }
    if (p?.layer === "fossils" && p.props.tile) setNeed((cur) => (cur.includes(String(p.props.tile)) ? cur : [...cur, String(p.props.tile)]));
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const go = (center: [number, number], z: number) => setFlyTo({ center, zoom: z, pitch: 0, bearing: 0, nonce: Date.now() });

  const pickPark = (p: FossilPark) => {
    if (index) setNeed(tilesAround(p.center, index));
    setPicked({ layer: "parks", id: p.id, props: { id: p.id, name: p.name }, lngLat: p.center });
    go(p.center, p.zoom);
  };
  /** Open one site (its tile may not be loaded yet — the drawer fills in when it is). */
  const pickSite = (tile: string, i: number, at: [number, number], z = 11) => {
    setNeed((cur) => (cur.includes(tile) ? cur : [...cur, tile]));
    setPicked({ layer: "fossils", props: { tile, i }, lngLat: at });
    go(at, z);
  };
  /** Filter to one formation and frame every site in it. */
  const showFormation = async (name: string) => {
    const fi = formations ?? (await loadFormations().catch(() => null));
    if (!fi) return;
    const k = fi.name.indexOf(name);
    if (k < 0) return;
    setFormation(name);
    setPeriod(null);
    setShow("all");
    setPickedState(null);
    setPanel(null);
    setNeed(fi.t[k].slice(0, FORMATION_TILES_MAX).map((t) => fi.tiles[t]));
    const ext = fitBbox(fi.bbox[k]);
    go(ext.center, ext.zoom);
  };

  const runStoryAction = (a: StoryAction<FossilAction>) => {
    const v = String(a.value ?? "");
    if (a.kind === "time") {
      setPickedState(null);
      setFollow(true);
      setStoryAge(Number(v));
      machine.setAge(Number(v));
    } else if (a.kind === "today") {
      setStoryAge(null);
      if (story) setFlyTo({ ...story.chapters[Math.min(chapter, story.chapters.length - 1)].camera, nonce: Date.now() });
    } else if (a.kind === "park") {
      const p = parkById(v);
      setStoryAge(null);
      if (p) pickPark(p);
    } else if (a.kind === "fly") {
      const p = parkById(v);
      if (p) startFly(p);
    } else if (a.kind === "formation") {
      setStoryAge(null);
      void showFormation(v);
    }
  };

  /* ── share links: ?park · ?coll=<id>&tile=<key> · ?fm · ?period · ?show · ?t · ?story ── */
  const urlRead = useRef(false);
  const pendingColl = useRef<{ id: number; tile: string } | null>(null);
  useEffect(() => {
    if (urlRead.current || !index) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const s = q.get("show");
    if (s === "dinos" || s === "mammals") setShow(s);
    const per = PERIODS.findIndex((p) => p.key === q.get("period"));
    if (per >= 0) setPeriod(per);
    if (q.get("fm")) void showFormation(q.get("fm")!);
    const park = q.get("park") ? parkById(q.get("park")!) : undefined;
    if (park) pickPark(park);
    else if (q.get("coll") && q.get("tile") && index.tiles[q.get("tile")!]) {
      pendingColl.current = { id: Number(q.get("coll")), tile: q.get("tile")! };
      setNeed((cur) => [...cur, q.get("tile")!]);
    }
    // once the index has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    const p = pendingColl.current;
    if (!p) return;
    const t = loaded.tiles.find((x) => x.key === p.tile)?.tile;
    if (!t) return;
    pendingColl.current = null;
    const i = t.cols.id.indexOf(p.id);
    if (i >= 0) pickSite(p.tile, i, [t.cols.lng[i], t.cols.lat[i]]);
    // when the tile arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded.tiles]);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    if (picked?.layer === "parks") q.set("park", String(picked.id));
    else if (picked?.layer === "fossils") {
      const t = loaded.tiles.find((x) => x.key === picked.props.tile)?.tile;
      const id = t?.cols.id[Number(picked.props.i)];
      if (id != null) {
        q.set("coll", String(id));
        q.set("tile", String(picked.props.tile));
      }
    }
    if (formation) q.set("fm", formation);
    if (period != null) q.set("period", PERIODS[period].key);
    if (show !== "all") q.set("show", show);
    if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (timeOn) q.set("t", String(machine.age));
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    // the tiles only matter for the picked site's id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, formation, period, show, timeOn, machine.age, mode, storyId, chapter]);
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

  const citations = FOSSIL_LAYERS.filter((l) => visible[l.id] && l.citation.label).map((l) => l.citation);
  const counts = index?.counts;

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#0b0f0a] text-stone-100" : "bg-stone-50 text-stone-900"}`}>
      <AtlasMap
        layers={FOSSIL_LAYERS}
        visible={visible}
        data={mapData}
        basemap={basemap}
        terrain={terrain}
        dark={dark}
        atmosphere
        selected={picked}
        onPick={setPicked}
        flyTo={flyTo}
        initialView={initialView}
        onView={setView}
        orbit={fly && orbiting ? ORBIT_SPEED : 0}
        onOrbitStop={() => setOrbiting(false)}
        className="atlas-space absolute inset-0"
      >
        <FossilDetailsDrawer picked={picked} tiles={loaded.tiles} then={timeOn && machine.slice ? machine.slice : null} onClose={() => setPickedState(null)} onFormation={timeOn ? undefined : (name) => void showFormation(name)} onFly={startFly} />
      </AtlasMap>

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-lime-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Bone className="h-3.5 w-3.5 text-lime-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Prehistoric Earth</span>
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
        {!fly && (
          <HudSwitch
            id="pf-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={switchMode}
            className="pointer-events-auto"
            options={[
              { key: "today", label: <><MapIcon className="h-3.5 w-3.5" />Today</>, title: "Where fossils are found today" },
              { key: "time", label: <><Hourglass className="h-3.5 w-3.5" />Time machine</>, title: "Earth as it was, with the fossils where they lived" },
              { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</>, title: "Guided stories from the rock record" },
            ]}
          />
        )}
        {mode === "stories" && storyAge != null && machine.slice && (
          <span className={`${hudGlass} pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 text-[12px] text-white`}>
            <Hourglass className="h-3.5 w-3.5 text-lime-300" />
            <span className="font-mono font-semibold">{fmtMa(machine.slice.age)}</span>
            <span className="text-slate-400">· {machine.slice.label}</span>
            <button type="button" onClick={() => runStoryAction({ label: "", kind: "today" })} aria-label="Back to today's map" className="rounded-md p-0.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <HudSwitch
          id="pf-show"
          ariaLabel="Which fossil sites"
          value={show}
          onChange={setShow}
          className="pointer-events-auto"
          options={[
            { key: "all", label: "All fossils", title: "Every fossil site" },
            { key: "dinos", label: <><Bone className="h-3.5 w-3.5" />Dinosaurs</>, title: "Only sites with dinosaur fossils" },
            { key: "mammals", label: "Mammals", title: "Only sites with mammal fossils" },
          ]}
        />
        {formation && !timeOn && (
          <span className={`${hudGlass} pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 text-[12px] text-white`}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-lime-200/80">Formation</span>
            {formation}
            <span className="font-mono text-[11px] text-slate-400">· {loaded.loading ? "…" : `${shown.toLocaleString()} sites`}</span>
            <button
              type="button"
              onClick={() => {
                setFormation(null);
                setNeed([]);
              }}
              aria-label="Show every formation"
              className="rounded-md p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        {!timeOn && !formation && !zoomedIn && mode === "today" && (
          <span className={`${hudGlass} pointer-events-auto px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-lime-100/80`}>Zoom in (or click a dot) to see every site</span>
        )}
        {loaded.loading && zoomedIn && !timeOn && (
          <span className={`${hudGlass} pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-lime-100/80`}>
            <Loader2 className="h-3 w-3 animate-spin" /> Loading fossil sites…
          </span>
        )}
        {loadError && <p className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}>Couldn&apos;t load the fossil data ({loadError}).</p>}
      </div>

      {/* ── right rail ───────────────────────────────────────────── */}
      {mode !== "stories" && !fly && (
        <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
          {!timeOn && <HudIconButton icon={ListOrdered} label="Find a park or formation" active={panel === "find"} onClick={() => togglePanel("find")} badge={FOSSIL_PARKS.length} />}
          <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
        </div>
      )}

      {mode === "stories" && !fly && (
        <StoryPlayer
          stories={FOSSIL_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          library={library.docs}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}

      {fly && (
        <div className="absolute inset-x-3 bottom-3 z-30 flex justify-center">
          <HudPanel className="flex max-w-full items-center gap-2 px-3 py-2">
            <div className="mr-1 min-w-0">
              <HudLabel className="!text-lime-200/80">Flyover</HudLabel>
              <p className="truncate font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-white">{fly.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setOrbiting((o) => !o)}
              aria-pressed={orbiting}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider ${orbiting ? "border-lime-300/40 bg-lime-400/15 text-lime-100" : "border-white/10 text-slate-300"}`}
            >
              {orbiting ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Orbit
            </button>
            <button
              type="button"
              onClick={() => startFly(FOSSIL_PARKS[(flyIndex + 1) % FOSSIL_PARKS.length])}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:text-white"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={endFly} aria-label="End the flyover" className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 px-3 font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:text-white">
              <X className="h-3.5 w-3.5" /> Exit
            </button>
          </HudPanel>
        </div>
      )}
      {panel && (
        <SidePanel title={panel === "find" ? "Find" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "find" && (
            <FindPanel
              index={index}
              formations={formations}
              loadFormations={loadFormations}
              tiles={loaded.tiles}
              onPark={pickPark}
              onFormation={(name) => void showFormation(name)}
              onSite={pickSite}
              onNear={(at) => {
                if (index) setNeed(tilesAround(at, index));
                go(at, 8);
              }}
            />
          )}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel id="pf" layers={FOSSIL_LAYERS} visible={visible} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))} basemap={basemap} onBasemap={setBasemap} terrain={terrain} onTerrain={setTerrain} />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── bottom: geologic periods + status ────────────────────── */}
      {mode !== "stories" && !fly && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col items-start gap-2 sm:left-4 sm:right-auto sm:max-w-[min(860px,calc(100%-6rem))]">
          {timeOn ? (
            <div className="pointer-events-auto flex w-full flex-col items-start gap-2 sm:w-[640px]">
              <label className={`${hudGlass} inline-flex cursor-pointer items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300`}>
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-lime-400" />
                Follow the land you&apos;re looking at
              </label>
              <TimeBar machine={machine} shown={paleoSpots ? sitesIn(paleoSpots) : null} />
            </div>
          ) : (
            <>
              <PeriodStrip counts={perCounts} value={period} onChange={setPeriod} />
              <HudPanel className="pointer-events-auto flex max-w-full items-center gap-5 overflow-x-auto px-4 py-2.5">
                <HudStat label="Sites shown" value={summary ? shown.toLocaleString() : "—"} tone="text-lime-300" />
                <HudStat label="Finds" value={counts ? counts.finds.toLocaleString() : "—"} tone="text-stone-300" />
                <HudStat label="Dinosaurs" value={counts ? counts.dino.toLocaleString() : "—"} tone="text-amber-100" onClick={() => setShow("dinos")} />
                <HudStat label="Mammals" value={counts ? counts.mammal.toLocaleString() : "—"} tone="text-rose-300" onClick={() => setShow("mammals")} />
                <HudStat label="Countries" value={counts ? counts.countries.toLocaleString() : "—"} tone="text-white" />
              </HudPanel>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "201 million to 145 million years ago"; the Quaternary runs to today. */
const periodSpan = (i: number) => (i === 0 ? `${formatAge(PERIODS[0].start)} ago to today` : `${formatAge(PERIODS[i].start)} to ${formatAge(periodEnd(i))} ago`);

/** One chip per geologic period, youngest first; tap one to see only that period. */
function PeriodStrip({ counts, value, onChange }: { counts: number[]; value: number | null; onChange: (p: number | null) => void }) {
  const p = value != null ? PERIODS[value] : null;
  return (
    <HudPanel className="pointer-events-auto max-w-full px-2 py-2">
      <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value == null}
          className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${value == null ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}
        >
          All ages
        </button>
        {PERIODS.map((per, i) => {
          const on = value === i;
          return (
            <button
              key={per.key}
              type="button"
              onClick={() => onChange(on ? null : i)}
              aria-pressed={on}
              disabled={!counts[i]}
              title={`${per.label}: ${periodSpan(i)} · ${counts[i].toLocaleString()} sites`}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-30 ${
                on ? "border-white/40 bg-white/15 text-white" : "border-transparent text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: per.color }} />
              {per.label}
            </button>
          );
        })}
      </div>
      {p && value != null && (
        <p className="px-1.5 pt-1 text-[11px] text-slate-400">
          <span className="font-semibold text-white">{p.label}</span> · {periodSpan(value)} · {counts[value].toLocaleString()} sites
        </p>
      )}
    </HudPanel>
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

const LIST_MAX = 40;

function FindPanel({
  index,
  formations,
  loadFormations,
  tiles,
  onPark,
  onFormation,
  onSite,
  onNear,
}: {
  index: FossilIndex | null;
  formations: FormationIndex | null;
  loadFormations: () => Promise<FormationIndex>;
  tiles: { key: string; tile: FossilTile }[];
  onPark: (p: FossilPark) => void;
  onFormation: (name: string) => void;
  onSite: (tile: string, i: number, at: [number, number], zoom?: number) => void;
  onNear: (at: [number, number]) => void;
}) {
  const [q, setQ] = useState("");
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const needle = q.trim().toLowerCase();
  // the formation index (≈1 MB) loads the first time someone searches
  useEffect(() => {
    if (needle.length >= 2 && !formations) void loadFormations().catch(() => {});
  }, [needle, formations, loadFormations]);

  const parks = needle.length < 2 ? FOSSIL_PARKS : FOSSIL_PARKS.filter((p) => `${p.name} ${p.where} ${p.age}`.toLowerCase().includes(needle));
  const fmHits = useMemo(() => (formations && needle.length >= 2 ? searchFormations(formations, needle) : []), [formations, needle]);
  const nearest = useMemo(() => {
    if (!me || !index) return [];
    const mine = new Set(tilesAround(me, index));
    const out: { tile: string; i: number; d: number; t: FossilTile }[] = [];
    for (const { key, tile } of tiles) {
      if (!mine.has(key)) continue;
      const c = tile.cols;
      for (let i = 0; i < c.id.length; i++) {
        const d = kmBetween(me, [c.lng[i], c.lat[i]]);
        if (d < 150) out.push({ tile: key, i, d, t: tile });
      }
    }
    return out.sort((a, b) => a.d - b.d).slice(0, LIST_MAX);
  }, [me, tiles, index]);

  const nearMe = () => {
    if (!navigator.geolocation) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setMe(at);
        setQ("");
        setLocating("idle");
        onNear(at);
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  };

  const row = "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setMe(null);
            }}
            placeholder="A park or rock formation…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-lime-300/40"
          />
        </label>
        <button type="button" onClick={nearMe} title="Fossil sites near me" className={`inline-flex items-center gap-1 rounded-xl border px-2.5 font-mono text-[10px] uppercase tracking-wider ${me ? "border-lime-300/50 text-lime-200" : "border-white/10 text-slate-300 hover:text-white"}`}>
          {locating === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />} Near me
        </button>
      </div>
      {locating === "denied" && <p className="text-[11px] text-slate-500">Location isn&apos;t available — zoom the map to your area instead.</p>}

      {me ? (
        <>
          <HudLabel>Nearest fossil sites</HudLabel>
          {!nearest.length && <p className="py-4 text-center text-xs text-slate-500">{tiles.length ? "No recorded fossil sites within 150 km." : "Loading…"}</p>}
          <ul className="space-y-0.5">
            {nearest.map(({ tile, i, d, t }) => {
              const per = PERIODS[t.cols.per[i]];
              const fm = word(t, "fm", i);
              return (
                <li key={`${tile}-${i}`}>
                  <button type="button" onClick={() => onSite(tile, i, [t.cols.lng[i], t.cols.lat[i]], 10)} className={row}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: per.color, boxShadow: t.cols.flag[i] & FLAG_DINO ? `0 0 0 2px ${BONE}` : undefined }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-100">{fm || `${per.label} site`}</span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        {per.label} · {t.cols.n[i]} finds
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-lime-200">{d < 10 ? d.toFixed(1) : Math.round(d)} km</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          {!!parks.length && <HudLabel>Fossil parks</HudLabel>}
          <ul className="space-y-0.5">
            {parks.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onPark(p)} className={row}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.accent, boxShadow: `0 0 8px ${p.accent}` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white">{p.name}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {p.where} · {p.age.split(" · ")[0]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {needle.length >= 2 && !formations && (
            <p className="flex items-center gap-2 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading 19,000 rock formations…
            </p>
          )}
          {!!fmHits.length && formations && <HudLabel>Rock formations</HudLabel>}
          <ul className="space-y-0.5">
            {formations &&
              fmHits.map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => onFormation(formations.name[k])} className={row}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PERIODS[formations.per[k]]?.color ?? "#a3e635" }} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-100">{formations.name[k]}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{formations.n[k].toLocaleString()} sites</span>
                  </button>
                </li>
              ))}
          </ul>
          {needle.length >= 2 && formations && !parks.length && !fmHits.length && <p className="py-6 text-center text-xs text-slate-500">Nothing matches — try a formation like “Morrison”, “Hell Creek” or “Solnhofen”.</p>}
          {needle.length < 2 && <p className="text-[11px] leading-snug text-slate-500">Try a rock formation — “Morrison” for Jurassic giants, “Hell Creek” for T. rex and Triceratops country, “Yixian” for feathered dinosaurs… or use Near me.</p>}
        </>
      )}
    </div>
  );
}
