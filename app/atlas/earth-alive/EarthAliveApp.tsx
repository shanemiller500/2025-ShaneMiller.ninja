"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, BookOpen, Box, History, Layers, ListOrdered, Radio, RefreshCw, Star, X } from "lucide-react";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { useLibrary } from "@/utils/geo/useLibrary";
import { EARTH_STORIES, type EarthStoryAction } from "./stories";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { TimeSlider } from "@/components/atlas/TimeSlider";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass } from "@/components/atlas/Hud";
import { timeBins, useTimeline } from "@/components/atlas/useTimeline";
import type { AtlasTime, AtlasView, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import {
  DEPTH_STOPS,
  FAMOUS_QUAKES,
  REPLAY_PRESETS,
  sequenceDays,
  sequenceMinMag,
  sequenceRadiusKm,
  type QuakeAnchor,
  type QuakeFeature,
  type QuakeMin,
  type QuakeWindow,
  type ReplayPresetKey,
} from "@/utils/geo/quakes";
import { VOLCANO_FILTERS, volcanoMatches, type VolcanoFilter } from "@/utils/geo/volcanoes";
import { EARTH_ALIVE_LAYERS } from "./layers";
import { useQuakeQuery, useQuakes, useVolcanoes, type QuakeQuery } from "./useEarthData";
import { QuakeList } from "./QuakeList";
import { EarthDetails } from "./Details";
import { DepthRegionBar, DepthScene } from "./DepthPanel";
import { DEPTH_REGIONS, type DepthRegion } from "./regions";

/* ------------------------------------------------------------------ */
/*  Earth Alive — a full-screen globe: live earthquakes, plates,       */
/*  faults and erupting volcanoes, a time machine over the USGS        */
/*  catalog, and a 3D look beneath the surface. Controls float as a    */
/*  HUD; detail lives in panels you open on demand.                    */
/* ------------------------------------------------------------------ */

type Mode = "live" | "replay" | "depth" | "stories";
type Panel = "quakes" | "layers" | "famous" | null;
type Replay = { kind: "preset"; key: ReplayPresetKey; query: QuakeQuery } | { kind: "sequence"; anchor: QuakeAnchor & { name?: string }; query: QuakeQuery };

const DAY = 86_400_000;

/** Round "now" to 10 minutes so repeat visits share the server cache. */
const roundedNow = () => Math.floor(Date.now() / 600_000) * 600_000;

function presetReplay(key: ReplayPresetKey): Replay {
  const p = REPLAY_PRESETS.find((r) => r.key === key)!;
  const end = roundedNow();
  const start = p.startIso ? Date.parse(p.startIso) : end - (p.days ?? 7) * DAY;
  return { kind: "preset", key, query: { start, end, minmag: p.minmag } };
}

function sequenceReplay(anchor: QuakeAnchor & { name?: string }): Replay {
  const start = anchor.time - 2 * DAY;
  const end = Math.min(roundedNow(), anchor.time + sequenceDays(anchor.mag) * DAY);
  return {
    kind: "sequence",
    anchor,
    query: { start, end, minmag: sequenceMinMag(anchor.mag), circle: { lat: anchor.lat, lng: anchor.lng, radiusKm: sequenceRadiusKm(anchor.mag) } },
  };
}

/** Map zoom that fits a circle of `km` radius. */
const zoomForRadius = (km: number) => Math.min(10, Math.max(2.5, 8.7 - Math.log2(km / 10)));

/** Zoom at which the globe fills most of the screen. */
const fillZoom = () => {
  const px = Math.min(window.innerWidth, window.innerHeight) * 0.92;
  return Math.max(1.2, Math.log2((px * Math.PI) / 512));
};

const timeFormat = (span: number) => (t: number) => format(t, span > 3 * 365 * DAY ? "MMM yyyy" : span > 60 * DAY ? "MMM d, yyyy" : "MMM d, HH:mm");

export default function EarthAliveApp() {
  const [mode, setMode] = useState<Mode>("live");
  const [win, setWin] = useState<QuakeWindow>("day");
  const [min, setMin] = useState<QuakeMin>("all");
  const quakes = useQuakes(win, min);
  const volcanoes = useVolcanoes();
  const [volcanoFilter, setVolcanoFilter] = useState<VolcanoFilter>("erupting");

  const [replay, setReplay] = useState<Replay>(() => presetReplay("year"));
  const history = useQuakeQuery(mode === "replay" ? replay.query : null);

  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(EARTH_ALIVE_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<{ center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number } | null>(null);
  const viewRef = useRef<AtlasView | null>(null);
  const [initialView] = useState(() => ({ center: [-125, 22] as [number, number], zoom: fillZoom() }));

  // a detail drawer and a side panel would sit on top of each other — the drawer wins
  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };

  // re-render the "updated 20s ago" label
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  /* ── replay clock ──────────────────────────────────────────────── */
  const hStart = history.data?.start ?? replay.query.start;
  const hEnd = history.data?.end ?? replay.query.end ?? Date.now();
  const timeline = useTimeline(hStart, hEnd, replay.kind === "sequence" ? 30_000 : 45_000);
  const { play } = timeline;
  useEffect(() => {
    if (mode === "replay" && history.data) play();
  }, [mode, history.data, play]);

  const span = hEnd - hStart;
  const time: AtlasTime | null = useMemo(
    () => (mode === "replay" && history.data ? { cursor: timeline.cursor, trail: span * (replay.kind === "sequence" ? 0.12 : 0.06), flash: span / 120 } : null),
    [mode, history.data, timeline.cursor, span, replay.kind]
  );
  const bins = useMemo(() => (history.data ? timeBins(history.data.features.map((f) => f.properties.time), hStart, hEnd) : undefined), [history.data, hStart, hEnd]);

  /* ── 3D depth ──────────────────────────────────────────────────── */
  const [regionKey, setRegionKey] = useState("tonga");
  const [viewRegion, setViewRegion] = useState<DepthRegion | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const region = regionKey === "view" ? viewRegion : DEPTH_REGIONS.find((r) => r.key === regionKey) ?? null;
  const depthQuery = useMemo<QuakeQuery | null>(() => {
    if (mode !== "depth" || !region) return null;
    const today = Math.floor(Date.now() / DAY) * DAY;
    return { start: today - region.years * 365 * DAY, minmag: region.minmag, bbox: region.bbox };
  }, [mode, region]);
  const depth = useQuakeQuery(depthQuery);

  const selectRegion = (key: string) => {
    setRegionKey(key);
    setNotice(null);
    setPickedState(null);
  };
  const pickThisView = () => {
    const v = viewRef.current;
    if (!v) return;
    const [w, s, e, n] = v.bounds;
    const lonSpan = e - w;
    const latSpan = n - s;
    if (lonSpan > 40 || latSpan > 30) {
      setNotice("Zoom the map in to a region (about 40° across) first — switch to Live, zoom in, then come back.");
      return;
    }
    const big = Math.max(lonSpan, latSpan);
    const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
    setViewRegion({
      key: "view",
      name: "Your view",
      blurb: "",
      bbox: [wrap(w), Math.max(-89, s), wrap(e), Math.min(89, n)],
      minmag: big <= 8 ? 2.5 : big <= 20 ? 4 : 4.5,
      years: big <= 8 ? 2 : 5,
    });
    selectRegion("view");
  };

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const [libraryOn, setLibraryOn] = useState(false);
  const library = useLibrary(libraryOn ? { project: "earth-alive" } : null);
  const story = EARTH_STORIES.find((s) => s.id === storyId) ?? null;

  // each chapter moves the camera
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    const cam = story.chapters[Math.min(chapter, story.chapters.length - 1)].camera;
    setFlyTo({ ...cam, nonce: Date.now() });
  }, [mode, story, chapter]);

  const openStory = (id: string | null) => {
    setStoryId(id);
    setChapter(0);
    setPickedState(null);
    if (id) setLibraryOn(true);
    else setFlyTo({ center: initialView.center, zoom: initialView.zoom, pitch: 0, bearing: 0, nonce: Date.now() });
  };

  /* ── what's on the map / in the list ───────────────────────────── */
  const volcanoData = useMemo(
    () => (volcanoes.data ? { ...volcanoes.data, features: volcanoes.data.features.filter((f) => volcanoMatches(f.properties, volcanoFilter)) } : undefined),
    [volcanoes.data, volcanoFilter]
  );
  const replayFc = useMemo(() => (history.data ? { type: "FeatureCollection" as const, features: history.data.features } : undefined), [history.data]);
  const data = useMemo(
    () => ({ quakes: mode === "replay" ? replayFc : quakes.mapData, volcanoes: volcanoData }),
    [mode, replayFc, quakes.mapData, volcanoData]
  );
  const deferredCursor = useDeferredValue(timeline.cursor);
  const list: QuakeFeature[] = useMemo(() => {
    if (mode !== "replay") return quakes.feed?.features ?? [];
    return (history.data?.features ?? []).filter((f) => f.properties.time <= deferredCursor);
  }, [mode, quakes.feed, history.data, deferredCursor]);

  const stats = useMemo(() => {
    const largest = list.reduce<QuakeFeature | null>((m, q) => (!m || q.properties.mag > m.properties.mag ? q : m), null);
    const all = volcanoes.data?.features ?? [];
    return {
      largest,
      deep: list.filter((q) => q.properties.depth >= 300).length,
      erupting: all.filter((v) => v.properties.erupting).length,
      alerts: all.filter((v) => v.properties.rank >= 2).length,
    };
  }, [list, volcanoes.data]);

  /* ── actions ───────────────────────────────────────────────────── */
  const selectQuake = useCallback(
    (q: QuakeFeature) => {
      const center = q.geometry.coordinates as [number, number];
      setPicked({ layer: "quakes", id: q.properties.id, props: q.properties as unknown as Record<string, unknown>, lngLat: center });
      setFlyTo({ center, nonce: Date.now() });
    },
    [setPicked]
  );

  const startSequence = useCallback(
    (anchor: QuakeAnchor & { name?: string }) => {
      setMode("replay");
      setReplay(sequenceReplay(anchor));
      setPicked({ layer: "quakes", id: anchor.id, props: { ...anchor }, lngLat: [anchor.lng, anchor.lat] });
      setFlyTo({ center: [anchor.lng, anchor.lat], zoom: zoomForRadius(sequenceRadiusKm(anchor.mag)), nonce: Date.now() });
    },
    [setPicked]
  );

  const pickPreset = (key: ReplayPresetKey) => {
    setReplay(presetReplay(key));
    setPickedState(null);
  };

  const toggle = (id: string) => {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
    if (picked?.layer === id) setPickedState(null);
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    if (m !== "replay") timeline.pause();
    setPickedState(null);
    setNotice(null);
    // map panels don't apply to the 3D block; Famous only belongs to Replay
    if (m === "depth" || (panel === "famous" && m !== "replay")) setPanel(null);
  };

  /** A story chapter's button: open the matching tool, keeping the story to come back to. */
  const runStoryAction = (a: StoryAction<EarthStoryAction>) => {
    if (a.kind === "sequence") {
      const q = FAMOUS_QUAKES.find((f) => f.id === a.value);
      if (q) startSequence(q);
    } else if (a.kind === "depth") {
      changeMode("depth");
      selectRegion(String(a.value));
    } else if (a.kind === "faults") {
      setVisible((v) => ({ ...v, faults: true }));
    } else if (a.kind === "terrain") {
      setTerrain(a.value === "3d" ? "3d" : "relief");
    } else if (a.kind === "volcano") {
      const v = volcanoes.data?.features.find((f) => f.properties.vnum === Number(a.value));
      // make sure it's on the map (St. Helens isn't erupting, so the default filter hides it)
      if (v && !volcanoMatches(v.properties, volcanoFilter)) setVolcanoFilter("all");
      if (v) setPicked({ layer: "volcanoes", id: v.properties.vnum, props: v.properties as unknown as Record<string, unknown>, lngLat: v.geometry.coordinates as [number, number] });
    }
  };

  const citations = EARTH_ALIVE_LAYERS.filter((l) => visible[l.id]).map((l) => l.citation);
  const fmt = timeFormat(span);
  const seq = replay.kind === "sequence" ? replay.anchor : null;
  const error = mode === "live" ? quakes.error : mode === "replay" ? history.error : null;

  return (
    <div className="dark fixed inset-0 overflow-hidden bg-[#02040b] text-slate-100">
      <AtlasMap
        layers={EARTH_ALIVE_LAYERS}
        visible={visible}
        data={data}
        basemap={basemap}
        terrain={terrain}
        dark
        atmosphere
        selected={picked}
        onPick={setPicked}
        flyTo={flyTo}
        time={time}
        onView={(v) => (viewRef.current = v)}
        initialView={initialView}
        className="atlas-space absolute inset-0"
      >
        {mode === "depth" && (
          <DepthScene
            region={region}
            data={depth.data}
            loading={depth.loading}
            error={depth.error}
            dark
            selectedId={picked?.layer === "quakes" ? String(picked.id) : null}
            onPick={(q) => setPicked(q ? { layer: "quakes", id: q.properties.id, props: q.properties as unknown as Record<string, unknown>, lngLat: q.geometry.coordinates as [number, number] } : null)}
          />
        )}
        <EarthDetails picked={picked} onClose={() => setPickedState(null)} onReplaySequence={startSequence} />
      </AtlasMap>

      {/* ── top-left: back, title, mode + filters ───────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-cyan-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Earth Alive</span>
          </div>
        </div>

        <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2">
          <HudSwitch
            id="ea-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={changeMode}
            options={[
              { key: "live", label: <><Radio className="h-3.5 w-3.5" />Live</> },
              { key: "replay", label: <><History className="h-3.5 w-3.5" />Replay</> },
              { key: "depth", label: <><Box className="h-3.5 w-3.5" />3D</> },
              { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</> },
            ]}
          />
          {story && mode !== "stories" && (
            <button
              type="button"
              onClick={() => changeMode("stories")}
              className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan-200 hover:text-white`}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to story
            </button>
          )}
          {mode === "live" && (
            <>
              <HudSwitch
                id="ea-window"
                ariaLabel="Time window"
                value={win}
                onChange={setWin}
                options={[
                  { key: "hour", label: "1h" },
                  { key: "day", label: "24h" },
                  { key: "week", label: "7d" },
                  { key: "month", label: "30d" },
                ]}
              />
              <HudSwitch
                id="ea-min"
                ariaLabel="Minimum magnitude"
                value={min}
                onChange={setMin}
                options={[
                  { key: "all", label: "All" },
                  { key: "2.5", label: "2.5+" },
                  { key: "4.5", label: "4.5+" },
                  { key: "significant", label: "Big", title: "USGS 'significant' — big or widely felt" },
                ]}
              />
            </>
          )}
          {mode === "replay" &&
            (seq ? (
              <span className={`${hudGlass} inline-flex items-center gap-2 py-1 pl-3 pr-1 font-mono text-[11px] uppercase tracking-wider text-cyan-100`}>
                Aftershocks · M{seq.mag.toFixed(1)} {seq.name ?? seq.place}
                <button type="button" aria-label="Back to replay periods" onClick={() => pickPreset("year")} className="rounded-lg p-1 hover:bg-white/10">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <HudSwitch
                id="ea-preset"
                ariaLabel="Replay period"
                value={replay.kind === "preset" ? replay.key : "year"}
                onChange={pickPreset}
                options={REPLAY_PRESETS.map((p) => ({ key: p.key, label: p.key === "century" ? "1900→" : p.label, title: `${p.label} · ${p.hint}` }))}
              />
            ))}
          {mode === "replay" && (
            <button
              type="button"
              onClick={() => togglePanel("famous")}
              className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider ${panel === "famous" ? "text-cyan-200" : "text-slate-300 hover:text-white"}`}
            >
              <Star className="h-3.5 w-3.5" /> Famous quakes
            </button>
          )}
        </div>

        {(error || notice || (mode === "replay" && history.loading)) && (
          <p className={`${hudGlass} pointer-events-auto max-w-md px-3 py-2 text-xs ${error ? "text-rose-300" : "text-cyan-100/90"}`}>
            {error ? `USGS: ${error}` : notice ?? "Loading the USGS catalog…"}
          </p>
        )}
      </div>

      {/* ── right rail ───────────────────────────────────────────── */}
      {mode !== "depth" && (
        <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
          <HudIconButton icon={ListOrdered} label="Earthquake list" active={panel === "quakes"} onClick={() => togglePanel("quakes")} />
          <HudIconButton icon={Layers} label="Layers & filters" active={panel === "layers"} onClick={() => togglePanel("layers")} />
        </div>
      )}

      {/* ── side panel ───────────────────────────────────────────── */}
      {panel && (
        <SidePanel
          title={panel === "quakes" ? (mode === "replay" ? "Replayed so far" : "Earthquakes") : panel === "layers" ? "Layers" : "Famous earthquakes"}
          onClose={() => setPanel(null)}
        >
          {panel === "quakes" && <QuakeList quakes={list} selectedId={picked?.layer === "quakes" ? picked.id : undefined} onSelect={selectQuake} />}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel
                id="ea"
                layers={EARTH_ALIVE_LAYERS}
                visible={visible}
                onToggle={toggle}
                basemap={basemap}
                onBasemap={setBasemap}
                terrain={terrain}
                onTerrain={setTerrain}
                extras={{
                  volcanoes: (
                    <HudSwitch
                      id="ea-volc"
                      ariaLabel="Which volcanoes"
                      value={volcanoFilter}
                      onChange={setVolcanoFilter}
                      options={VOLCANO_FILTERS.map((f) => ({ key: f.key, label: f.label, title: f.title }))}
                      className="!p-0.5 [&>button]:!px-2 [&>button]:!text-[10px]"
                    />
                  ),
                }}
              />
              <SourceCitation citations={citations} />
            </div>
          )}
          {panel === "famous" && (
            <ul className="space-y-1">
              {FAMOUS_QUAKES.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => startSequence(q)}
                    className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${seq?.id === q.id ? "bg-cyan-400/10 ring-1 ring-cyan-300/30" : "hover:bg-white/[0.05]"}`}
                  >
                    <span className="w-11 shrink-0 font-mono text-sm font-bold text-cyan-200">M{q.mag}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-slate-100">{q.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{q.place}</span>
                    </span>
                  </button>
                </li>
              ))}
              <li className="px-2.5 pt-2 text-[11px] leading-snug text-slate-400">Replays each mainshock and its aftershocks. Any quake M5+ on the map can do this too.</li>
            </ul>
          )}
        </SidePanel>
      )}

      {/* ── bottom: replay scrubber / 3D regions ─────────────────── */}
      {mode === "replay" && history.data && (
        <TimeSlider
          className="absolute inset-x-3 bottom-[4.75rem] z-20 sm:left-1/2 sm:right-auto sm:w-[min(760px,64vw)] sm:-translate-x-1/2"
          start={hStart}
          end={hEnd}
          cursor={timeline.cursor}
          onCursor={timeline.setCursor}
          playing={timeline.playing}
          onPlay={timeline.play}
          onPause={timeline.pause}
          speed={timeline.speed}
          onSpeed={timeline.setSpeed}
          bins={bins}
          format={fmt}
          status={`${list.length.toLocaleString()} / ${history.data.count.toLocaleString()}${history.data.truncated ? "+" : ""}`}
        />
      )}
      {mode === "depth" && (
        <div className="absolute inset-x-3 bottom-9 z-20 flex justify-center">
          <DepthRegionBar regions={DEPTH_REGIONS} activeKey={regionKey} onSelect={selectRegion} onThisView={pickThisView} />
        </div>
      )}

      {/* ── stories card ─────────────────────────────────────────── */}
      {mode === "stories" && (
        <StoryPlayer
          stories={EARTH_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          library={library.docs}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}

      {/* ── bottom-left: status strip ────────────────────────────── */}
      {(mode === "live" || mode === "replay") && (
        <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
          <HudStat
            label={mode === "replay" ? "So far" : { hour: "Past 1h", day: "Past 24h", week: "Past 7d", month: "Past 30d" }[win]}
            value={(mode === "replay" ? history.data : quakes.feed) ? list.length.toLocaleString() : "—"}
          />
          <HudStat
            label="Largest"
            value={stats.largest ? `M${stats.largest.properties.mag.toFixed(1)}` : "—"}
            tone="text-amber-300"
            onClick={stats.largest ? () => selectQuake(stats.largest!) : undefined}
          />
          {mode === "replay" ? (
            <HudStat label="300 km+ deep" value={stats.deep} tone="text-violet-300" />
          ) : (
            <HudStat label="Erupting" value={volcanoes.data ? stats.erupting : "—"} tone="text-orange-400" />
          )}
          <HudStat label="USGS alerts" value={volcanoes.data ? stats.alerts : "—"} tone="text-yellow-300" />
          {mode === "live" && (
            <button type="button" onClick={quakes.refresh} className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-cyan-200 sm:inline-flex">
              <RefreshCw className={`h-3 w-3 ${quakes.loading ? "animate-spin" : ""}`} />
              {quakes.updatedAt ? formatDistanceToNowStrict(quakes.updatedAt, { addSuffix: true }) : "…"}
            </button>
          )}
        </HudPanel>
      )}

      {/* ── bottom-right: depth key ──────────────────────────────── */}
      {mode !== "depth" && visible.quakes && (
        <HudPanel className="absolute bottom-3 right-3 z-20 hidden px-3 py-2 md:block">
          <HudLabel className="mb-1">Quake depth</HudLabel>
          <div className="flex items-center gap-1">
            {DEPTH_STOPS.map((s) => (
              <span key={s.km} className="flex flex-col items-center gap-0.5">
                <span className="h-1.5 w-9 rounded-full" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}88` }} />
                <span className="font-mono text-[9px] text-slate-400">{s.km === 300 ? "300+" : s.km}</span>
              </span>
            ))}
            <span className="ml-1 self-end font-mono text-[9px] text-slate-500">km</span>
          </div>
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
