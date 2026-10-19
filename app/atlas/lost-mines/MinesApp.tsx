"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ChevronRight, Clock, Layers, Link2, ListOrdered, Loader2, LocateFixed, Map as MapIcon, Pause, Pickaxe, Play, Search, X } from "lucide-react";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { useLibrary } from "@/utils/geo/useLibrary";
import { ThenNow, type ThenNowPlace } from "@/components/atlas/ThenNow";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass, useAtlasTheme } from "@/components/atlas/Hud";
import type { AtlasView, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { DEFAULT_OFF, GROUPS, MINES_DATED_URL, MINES_INDEX_URL, MINES_SUMMARY_URL, TILE_DEG, datedFeatures, kmBetween, mineFeatures, summaryFeatures, type DatedMines, type MineHit, type MinesIndex, type MinesSummary } from "@/utils/geo/mines";
import { useMineTiles } from "@/utils/geo/useMineTiles";
import { useOsmBoxes } from "@/utils/geo/useOsmBoxes";
import { MINE_SITES, siteById, type MineSite } from "./featured";
import { MAP_ONLY, MINES_MIN_ZOOM, MINE_LAYERS, TIMELINE_ONLY, USMIN_MIN_ZOOM } from "./layers";
import { FROM, YearBar } from "./Timeline";
import { MINE_STORIES, mineStoryById, type MineAction } from "./stories";
import { MineDetailsDrawer } from "./Details";

/* ------------------------------------------------------------------ */
/*  Lost Mines — every U.S. mine in USGS's Mineral Resources Data      */
/*  System and MSHA's register, the shafts and adits USGS drew on its  */
/*  old topo maps, and the gold rushes that started it all.            */
/* ------------------------------------------------------------------ */

type Panel = "find" | "layers" | null;
type Mode = "map" | "timeline" | "stories";
const ORBIT_SPEED = 5; // degrees per second
type FlyTo = { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number };
const ALL_ON = new Set(GROUPS.map((_, i) => i).filter((i) => !DEFAULT_OFF.has(GROUPS[i].key)));

export default function MinesApp() {
  const dark = useAtlasTheme();
  const [index, setIndex] = useState<MinesIndex | null>(null);
  const [summary, setSummary] = useState<MinesSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(MINE_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const [view, setView] = useState<AtlasView | null>(null);
  const [initialView] = useState(() => ({ center: [-104, 40] as [number, number], zoom: Math.min(3.6, Math.max(2, Math.log2(window.innerWidth / 260))) }));

  /* filters: commodity groups, and whether to show never-mined prospects */
  const [groupsOn, setGroupsOn] = useState<Set<number>>(ALL_ON);
  const [prospects, setProspects] = useState(false);
  const toggleGroup = (i: number) =>
    setGroupsOn((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const onlyGroup = (i: number) => setGroupsOn(new Set([i]));

  useEffect(() => {
    const ctl = new AbortController();
    const get = (u: string) => fetch(u, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u}: HTTP ${r.status}`))));
    Promise.all([get(MINES_INDEX_URL), get(MINES_SUMMARY_URL)])
      .then(([ix, sm]: [MinesIndex, MinesSummary]) => {
        setIndex(ix);
        setSummary(sm);
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    return () => ctl.abort();
  }, []);

  /* ── modes: the map · when it was mined ──────────────────────── */
  const [mode, setMode] = useState<Mode>(() => {
    const q = new URLSearchParams(window.location.search);
    return q.has("story") ? "stories" : q.has("year") ? "timeline" : "map";
  });
  /* a story chapter can open the timeline too */
  const [storyYear, setStoryYear] = useState<number | null>(null);
  const [year, setYear] = useState(() => {
    const y = Number(new URLSearchParams(window.location.search).get("year"));
    return Number.isFinite(y) && y >= FROM ? y : 1850;
  });
  const [playing, setPlaying] = useState(false);
  const [dated, setDated] = useState<DatedMines | null>(null);
  const timeline = mode === "timeline" || (mode === "stories" && storyYear != null);
  useEffect(() => {
    if (!timeline || dated) return;
    fetch(MINES_DATED_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setDated)
      .catch((e) => setLoadError((e as Error).message));
  }, [timeline, dated]);
  // the timeline shows only dated mines; the map its own layers (as they were)
  const mapSaved = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (timeline) {
      setVisible((v) => {
        mapSaved.current = Object.fromEntries(MAP_ONLY.map((id) => [id, v[id]]));
        return { ...v, ...Object.fromEntries(MAP_ONLY.map((id) => [id, false])), ...Object.fromEntries(TIMELINE_ONLY.map((id) => [id, true])) };
      });
    } else {
      setPlaying(false);
      setVisible((v) => ({ ...v, ...Object.fromEntries(TIMELINE_ONLY.map((id) => [id, false])), ...(mapSaved.current ?? Object.fromEntries(MAP_ONLY.map((id) => [id, true]))) }));
    }
  }, [timeline]);
  const switchMode = (m: Mode) => {
    setMode(m);
    setStoryYear(null);
    setPickedState(null);
    setPanel(null);
    if (m === "timeline") go([-100, 40], Math.min(view?.zoom ?? 3.6, 4));
  };

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(() => {
    const id = new URLSearchParams(window.location.search).get("story");
    return id && mineStoryById(id) ? id : null;
  });
  const [chapter, setChapter] = useState(() => Math.max(0, Number(new URLSearchParams(window.location.search).get("ch") ?? 0) || 0));
  const story = storyId ? mineStoryById(storyId) ?? null : null;
  const library = useLibrary(mode === "stories" ? { project: "lost-mines" } : null);
  // each chapter flies to its camera, on the map
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    const i = Math.min(chapter, story.chapters.length - 1);
    setPickedState(null);
    setStoryYear(null);
    setPlaying(false);
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
    setStoryYear(null);
  };

  /* ── 3D flyover of a featured site ─────────────────────────────── */
  const [fly, setFly] = useState<MineSite | null>(null);
  const [orbiting, setOrbiting] = useState(true);
  const beforeFly = useRef<{ basemap: Basemap; terrain: TerrainMode } | null>(null);
  const startFly = useCallback(
    (site: MineSite) => {
      if (!beforeFly.current) beforeFly.current = { basemap, terrain };
      setFly(site);
      setStoryYear(null);
      if (mode === "timeline") setMode("map");
      setPickedState(null);
      setPanel(null);
      setThenNow(null);
      setBasemap("satellite");
      setTerrain("3d");
      setOrbiting(true);
      setFlyTo({ center: site.center, zoom: Math.min(site.zoom, 15) - 0.5, pitch: 62, bearing: 20, nonce: Date.now() });
    },
    // the then & now setter is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const flyIndex = fly ? MINE_SITES.findIndex((x) => x.id === fly.id) : -1;

  /* then & now: the old topo maps of a spot beside today's ground */
  const [thenNow, setThenNow] = useState<ThenNowPlace | null>(null);

  /* tiles for the view (+ any a share link or "near me" needs) */
  const [need, setNeed] = useState<string[]>([]);
  const mines = useMineTiles(index, view, MINES_MIN_ZOOM, need);
  const usmin = useOsmBoxes("/api/atlas/usmin", view, !!visible.usmin, USMIN_MIN_ZOOM, 0.25);

  const data = useMemo(
    () => ({
      country: summary ? summaryFeatures(summary, groupsOn) : undefined,
      mines: mineFeatures(mines.tiles, groupsOn, { prospects }),
      usmin: usmin.data ?? { type: "FeatureCollection" as const, features: [] },
      dated: timeline && dated ? datedFeatures(dated, year, groupsOn) : undefined,
    }),
    [summary, groupsOn, mines.tiles, prospects, usmin.data, timeline, dated, year]
  );

  const setPickedRaw = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const setPicked = (p: Picked | null) => {
    if (p?.layer === "dated") {
      setPlaying(false);
      openMine("mrds", String(p.props.tile), Number(p.props.i), p.lngLat);
    } else setPickedRaw(p);
  };
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const go = (center: [number, number], zoom: number) => setFlyTo({ center, zoom, pitch: 0, bearing: 0, nonce: Date.now() });
  const pickSite = (s: MineSite) => {
    setPicked({ layer: "sites", id: s.id, props: { id: s.id, name: s.name }, lngLat: s.center });
    go(s.center, s.zoom);
  };
  const pickMine = (src: "mrds" | "msha", key: string, i: number, zoom = 13) => {
    const t = mines.tiles.find((x) => x.key === key)?.tile;
    if (!t) return;
    const c = t[src];
    const at: [number, number] = [c.lng[i], c.lat[i]];
    setPicked({ layer: "mines", props: { src, tile: key, i, g: c.g[i], name: c.name[i] }, lngLat: at });
    go(at, zoom);
  };

  /* ── share links: ?site=<id> · ?mine=<mrds|msha>.<id>&t=<tile> · ?year · &view=then ── */
  const pending = useRef<{ src: "mrds" | "msha"; id?: string; i?: number; tile: string } | null>(null);
  /** Open a mine that may sit in a tile not loaded yet (search hits, the timeline). */
  const openMine = (src: "mrds" | "msha", tile: string, i: number, at?: [number, number]) => {
    if (mines.tiles.some((x) => x.key === tile)) return pickMine(src, tile, i);
    pending.current = { src, tile, i };
    setNeed([tile]);
    if (at) go(at, 13);
  };
  const runStoryAction = (a: StoryAction<MineAction>) => {
    const v = String(a.value ?? "");
    if (a.kind === "site") {
      const site = siteById(v);
      setStoryYear(null);
      if (site) pickSite(site);
    } else if (a.kind === "fly") {
      const site = siteById(v);
      if (site) startFly(site);
    } else if (a.kind === "then") {
      const [lng, lat, zoom, ...name] = v.split(",");
      setThenNow({ center: [Number(lng), Number(lat)], zoom: Number(zoom), name: name.join(",") });
    } else if (a.kind === "timeline") {
      setPickedState(null);
      setStoryYear(Number(v));
      setYear(Number(v));
      go([-100, 40], 3.6);
    } else if (a.kind === "mine") {
      const m = /^(mrds|msha)\.(\w+)@(.+)$/.exec(v);
      if (m) {
        setStoryYear(null);
        pending.current = { src: m[1] as "mrds" | "msha", id: m[2], tile: m[3] };
        setNeed([m[3]]);
      }
    } else if (a.kind === "map") switchMode("map");
  };

  const urlRead = useRef(false);
  useEffect(() => {
    if (urlRead.current || !index) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const s = q.get("site") ? siteById(q.get("site")!) : undefined;
    if (s) pickSite(s);
    const mine = /^(mrds|msha)\.(\w+)$/.exec(q.get("mine") ?? "");
    const tile = q.get("t");
    if (mine && tile && index.tiles[tile]) {
      pending.current = { src: mine[1] as "mrds" | "msha", id: mine[2], tile };
      setNeed([tile]);
    }
    if (q.get("view") === "then" && q.get("at")) {
      const [lng, lat] = q.get("at")!.split(",").map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat)) setThenNow({ name: q.get("name") ?? "This spot", center: [lng, lat], zoom: 14.5 });
    }
    // once the index has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const t = mines.tiles.find((x) => x.key === p.tile)?.tile;
    if (!t) return;
    pending.current = null;
    const i = p.i ?? (t[p.src].id as (string | number)[]).map(String).indexOf(p.id ?? "");
    if (i >= 0) pickMine(p.src, p.tile, i);
    // when the needed tile arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mines.tiles]);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    if (picked?.layer === "sites") q.set("site", String(picked.id));
    else if (picked?.layer === "mines") {
      const t = mines.tiles.find((x) => x.key === picked.props.tile)?.tile;
      const src = picked.props.src as "mrds" | "msha";
      const id = t?.[src].id[Number(picked.props.i)];
      if (id != null) {
        q.set("mine", `${src}.${id}`);
        q.set("t", String(picked.props.tile));
      }
    }
    if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (timeline) q.set("year", String(Math.floor(year / 10) * 10));
    if (thenNow) {
      q.set("view", "then");
      q.set("at", `${thenNow.center[0].toFixed(5)},${thenNow.center[1].toFixed(5)}`);
      q.set("name", thenNow.name);
    }
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    // the tiles only matter for the picked mine's id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, timeline, year, thenNow, mode, storyId, chapter]);
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

  const citations = MINE_LAYERS.filter((l) => visible[l.id] && l.citation.label).map((l) => l.citation);
  const zoom = view?.zoom ?? initialView.zoom;
  const shown = data.mines.features.length;
  const hint =
    zoom < MINES_MIN_ZOOM
      ? "Zoom in to see every mine"
      : mines.loading
        ? "Loading mines…"
        : visible.usmin && zoom < USMIN_MIN_ZOOM
          ? "Zoom in further for shafts & adits from the old topo maps"
          : visible.usmin && usmin.loading
            ? "Loading the old topo map symbols…"
            : null;

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#0c0a09] text-stone-100" : "bg-stone-50 text-stone-900"}`}>
      <AtlasMap
        layers={MINE_LAYERS}
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
        onView={setView}
        orbit={fly && orbiting ? ORBIT_SPEED : 0}
        onOrbitStop={() => setOrbiting(false)}
        className="atlas-space absolute inset-0"
      >
        <MineDetailsDrawer picked={picked} tiles={mines.tiles} index={index} onClose={() => setPickedState(null)} onThenNow={setThenNow} onFly={startFly} />
      </AtlasMap>

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-amber-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Pickaxe className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Lost Mines</span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            title="Copy a link to exactly this view"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${copied ? "text-emerald-300" : "text-slate-300 hover:text-amber-200"}`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
        {!fly && (
        <HudSwitch
          id="lm-mode"
          ariaLabel="Mode"
          value={mode}
          onChange={switchMode}
          className="pointer-events-auto"
          options={[
            { key: "map", label: <><MapIcon className="h-3.5 w-3.5" />Map</>, title: "Every mine on record" },
            { key: "timeline", label: <><Clock className="h-3.5 w-3.5" />When it was mined</>, title: "Mines by the decade they were found or first worked" },
            { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</>, title: "Guided stories from the records" },
          ]}
        />
        )}
        {mode === "stories" && storyYear != null && (
          <span className={`${hudGlass} pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 text-[12px] text-white`}>
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono font-semibold">{Math.floor(year / 10) * 10}s</span>
            <span className="text-slate-400">· mines found or first worked by then</span>
            <button type="button" onClick={() => setStoryYear(null)} aria-label="Back to the map" className="rounded-md p-0.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <CommodityChips on={groupsOn} onToggle={toggleGroup} onOnly={onlyGroup} onAll={() => setGroupsOn(ALL_ON)} prospects={prospects} onProspects={timeline ? undefined : () => setProspects((p) => !p)} />
        {hint && !timeline && (
          <span className={`${hudGlass} pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-100/90`}>
            {(mines.loading || usmin.loading) && <Loader2 className="h-3 w-3 animate-spin" />}
            {hint}
          </span>
        )}
        {loadError && <p className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}>Couldn&apos;t load the mine data ({loadError}).</p>}
      </div>

      {thenNow && <ThenNow key={thenNow.center.join(",")} place={thenNow} onExit={() => setThenNow(null)} />}

      {mode === "stories" && !fly && (
        <StoryPlayer
          stories={MINE_STORIES}
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
              <HudLabel className="!text-amber-200/80">Flyover</HudLabel>
              <p className="truncate font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-white">{fly.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setOrbiting((o) => !o)}
              aria-pressed={orbiting}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider ${orbiting ? "border-amber-300/40 bg-amber-400/15 text-amber-100" : "border-white/10 text-slate-300"}`}
            >
              {orbiting ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Orbit
            </button>
            <button
              type="button"
              onClick={() => startFly(MINE_SITES[(flyIndex + 1) % MINE_SITES.length])}
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

      {/* ── right rail ───────────────────────────────────────────── */}
      {mode !== "stories" && !fly && (
      <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
        <HudIconButton icon={ListOrdered} label="Find a site" active={panel === "find"} onClick={() => togglePanel("find")} badge={MINE_SITES.length} />
        <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
      </div>
      )}
      {panel && (
        <SidePanel title={panel === "find" ? "Find" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "find" && <FindPanel tiles={mines.tiles} groupsOn={groupsOn} onSite={pickSite} onMine={pickMine} onHit={(h) => openMine(h.src, h.tile, h.i, [h.lng, h.lat])} onNeed={setNeed} onGo={go} />}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel id="lm" layers={MINE_LAYERS} visible={visible} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))} basemap={basemap} onBasemap={setBasemap} terrain={terrain} onTerrain={setTerrain} />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      {mode === "stories" || fly ? null : timeline ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 sm:left-4 sm:right-auto sm:w-[620px]">
          <YearBar dated={dated} total={index?.counts.mrds ?? 0} year={year} onYear={setYear} playing={playing} onPlay={setPlaying} groupsOn={groupsOn} onSite={pickSite} />
        </div>
      ) : (
      <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
        <HudStat label="USGS records" value={index ? index.counts.mrds.toLocaleString() : "—"} tone="text-amber-300" />
        <HudStat label="MSHA mines" value={index ? index.counts.msha.toLocaleString() : "—"} tone="text-stone-300" />
        <HudStat label="On screen" value={zoom >= MINES_MIN_ZOOM ? shown.toLocaleString() : "—"} tone="text-white" />
        <HudStat label="Topo symbols" value={visible.usmin && usmin.data ? usmin.data.features.length.toLocaleString() : "—"} tone="text-orange-300" />
        <HudStat label="Featured" value={MINE_SITES.length} tone="text-white" onClick={() => togglePanel("find")} />
      </HudPanel>
      )}
    </div>
  );
}

function CommodityChips({ on, onToggle, onOnly, onAll, prospects, onProspects }: { on: Set<number>; onToggle: (i: number) => void; onOnly: (i: number) => void; onAll: () => void; prospects: boolean; onProspects?: () => void }) {
  return (
    <div className={`${hudGlass} pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto px-1.5 py-1.5 sm:max-w-[min(100%,620px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
      {GROUPS.map((g, i) => {
        if (g.key === "other") return null;
        const active = on.has(i);
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onToggle(i)}
            onDoubleClick={() => onOnly(i)}
            aria-pressed={active}
            title={`${g.label} — click to toggle, double-click for only this`}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${active ? "border-white/25 bg-white/10 text-white" : "border-transparent text-slate-500 hover:text-slate-200"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color, opacity: active ? 1 : 0.35 }} />
            {g.label}
          </button>
        );
      })}
      <span className="mx-1 h-4 w-px shrink-0 bg-white/15" />
      {onProspects && (
      <button type="button" onClick={onProspects} aria-pressed={prospects} title="Also show prospects and occurrences — explored, never mined" className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${prospects ? "border-amber-300/50 bg-amber-400/15 text-amber-100" : "border-transparent text-slate-400 hover:text-white"}`}>
        + Prospects
      </button>
      )}
      <button type="button" onClick={onAll} className="shrink-0 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-white">
        Reset
      </button>
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

const NEAR_MAX = 40;

function FindPanel({
  tiles,
  groupsOn,
  onSite,
  onMine,
  onHit,
  onNeed,
  onGo,
}: {
  tiles: { key: string; tile: import("@/utils/geo/mines").MineTile }[];
  groupsOn: Set<number>;
  onSite: (s: MineSite) => void;
  onMine: (src: "mrds" | "msha", key: string, i: number, zoom?: number) => void;
  onHit: (h: MineHit) => void;
  onNeed: (keys: string[]) => void;
  onGo: (c: [number, number], z: number) => void;
}) {
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  /* name search runs on the server (the index is too big for phones) */
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MineHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/atlas/mines-search?q=${encodeURIComponent(needle)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((j: { hits?: MineHit[] }) => setHits(j.hits ?? []))
        .catch(() => !ctl.signal.aborted && setHits([]))
        .finally(() => !ctl.signal.aborted && setSearching(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  const nearMe = () => {
    if (!navigator.geolocation) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setMe(at);
        setLocating("idle");
        // the tile around you and its neighbours
        const x = Math.floor(at[0] / TILE_DEG);
        const y = Math.floor(at[1] / TILE_DEG);
        const keys: string[] = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keys.push(`${x + dx}_${y + dy}`);
        onNeed(keys);
        onGo(at, 9);
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  };
  const nearest = useMemo(() => {
    if (!me) return [];
    const out: { src: "mrds" | "msha"; key: string; i: number; name: string; g: number; d: number }[] = [];
    for (const { key, tile } of tiles)
      for (const src of ["mrds", "msha"] as const) {
        const c = tile[src];
        for (let i = 0; i < c.name.length; i++) {
          if (!groupsOn.has(c.g[i]) || (src === "mrds" && tile.mrds.st[i] > 1)) continue;
          const d = kmBetween(me, [c.lng[i], c.lat[i]]);
          if (d < 120) out.push({ src, key, i, name: c.name[i], g: c.g[i], d });
        }
      }
    return out.sort((a, b) => a.d - b.d).slice(0, NEAR_MAX);
  }, [me, tiles, groupsOn]);
  const row = "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]";

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMe(null);
          }}
          placeholder="A mine's name — add a state: “homestake sd”"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-8 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-300/40"
        />
        {searching && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
      </label>
      {hits && (
        <>
          <HudLabel>{hits.length >= 40 ? "First 40 matches — add a state to narrow" : `${hits.length} match${hits.length === 1 ? "" : "es"}`}</HudLabel>
          <ul className="space-y-0.5">
            {hits.map((h) => (
              <li key={`${h.src}-${h.tile}-${h.i}`}>
                <button type="button" onClick={() => onHit(h)} className={row}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUPS[h.g]?.color, boxShadow: h.src === "msha" ? "0 0 0 1.5px #fff" : undefined }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-100">{h.name}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {GROUPS[h.g]?.label} · {h.county ? `${h.county} Co., ` : ""}{h.state || "—"} · {h.src === "msha" ? "MSHA" : "USGS"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!hits.length && <li className="py-4 text-center text-xs text-slate-500">No mine by that name on record.</li>}
          </ul>
        </>
      )}
      {!hits && (
      <>
      <button type="button" onClick={nearMe} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 font-mono text-[11px] uppercase tracking-wider ${me ? "border-amber-300/50 text-amber-200" : "border-white/10 text-slate-200 hover:text-white"}`}>
        {locating === "busy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />} Mines near me
      </button>
      {locating === "denied" && <p className="text-[11px] text-slate-500">Location isn&apos;t available — zoom the map to your area instead.</p>}
      {me ? (
        <>
          <HudLabel>Nearest mines</HudLabel>
          {!nearest.length && <p className="py-4 text-center text-xs text-slate-500">No producing mines on record within 120 km.</p>}
          <ul className="space-y-0.5">
            {nearest.map((m) => (
              <li key={`${m.src}-${m.key}-${m.i}`}>
                <button type="button" onClick={() => onMine(m.src, m.key, m.i)} className={row}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: GROUPS[m.g].color, boxShadow: m.src === "msha" ? "0 0 0 1.5px #fff" : undefined }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-100">{m.name || "Unnamed mine"}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {GROUPS[m.g].label} · {m.src === "msha" ? "MSHA" : "USGS"}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-amber-200">{m.d < 10 ? m.d.toFixed(1) : Math.round(m.d)} km</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <HudLabel>Gold rushes &amp; famous mines</HudLabel>
          <ul className="space-y-0.5">
            {MINE_SITES.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onSite(s)} className={row}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.accent, boxShadow: `0 0 8px ${s.accent}` }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-white">{s.name}</span>
                    <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {s.where} · {s.era}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      </>
      )}
    </div>
  );
}
