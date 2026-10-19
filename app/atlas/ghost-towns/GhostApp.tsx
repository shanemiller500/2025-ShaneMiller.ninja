"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, ChevronRight, Ghost, Layers, Link2, ListOrdered, LocateFixed, Map as MapIcon, Pause, Play, Search, X } from "lucide-react";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { useLibrary } from "@/utils/geo/useLibrary";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { HudIconButton, HudLabel, HudPanel, HudStat, HudSwitch, hudGlass, useAtlasTheme } from "@/components/atlas/Hud";
import type { AtlasView, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { useOsmBoxes } from "@/utils/geo/useOsmBoxes";
import {
  DROWNED_URL,
  GHOST_TOWNS_URL,
  GNIS_GHOST_URL,
  drownedFeatures,
  ghostFeatures,
  gnisFeatures,
  kmBetween,
  lifespan,
  type DrownedTown,
  type GhostCols,
  type GnisCols,
} from "@/utils/geo/ghost";
import { FEATURED_TOWNS, featuredById, type FeaturedTown } from "./featured";
import { GHOST_COLORS, GHOST_LAYERS, OSM_MIN_ZOOM } from "./layers";
import { GhostDetailsDrawer } from "./Details";
import { ThenNow, type ThenNowPlace } from "@/components/atlas/ThenNow";
import { GHOST_STORIES, ghostStoryById, type GhostAction } from "./stories";

type Mode = "map" | "stories";
const ORBIT_SPEED = 5; // degrees per second

/* ------------------------------------------------------------------ */
/*  Ghost Towns — every vanished place in the USGS register, 3,000+    */
/*  ghost towns worldwide, towns drowned under reservoirs, and a few   */
/*  famous ones with their stories.                                    */
/* ------------------------------------------------------------------ */

type Panel = "find" | "layers" | null;
type FlyTo = { center: [number, number]; zoom?: number; pitch?: number; bearing?: number; nonce: number };

/** One searchable row across every source. */
interface Row {
  key: string;
  kind: "featured" | "ghost" | "gnis" | "drowned";
  name: string;
  sub: string;
  at: [number, number];
  pick: () => void;
}

export default function GhostApp() {
  const dark = useAtlasTheme();
  const [gnis, setGnis] = useState<GnisCols | null>(null);
  const [ghost, setGhost] = useState<GhostCols | null>(null);
  const [drowned, setDrowned] = useState<DrownedTown[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(GHOST_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const [initialView] = useState(() => ({ center: [-104, 40] as [number, number], zoom: Math.min(3.6, Math.max(2, Math.log2(window.innerWidth / 260))) }));

  useEffect(() => {
    const ctl = new AbortController();
    const get = (u: string) => fetch(u, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${u}: HTTP ${r.status}`))));
    Promise.all([get(GHOST_TOWNS_URL), get(DROWNED_URL), get(GNIS_GHOST_URL)])
      .then(([g, d, n]: [{ cols: GhostCols }, { towns: DrownedTown[] }, { cols: GnisCols }]) => {
        setGhost(g.cols);
        setDrowned(d.towns);
        setGnis(n.cols);
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    return () => ctl.abort();
  }, []);

  /* OpenStreetMap's abandoned places for the area on screen */
  const [view, setView] = useState<AtlasView | null>(null);
  const osm = useOsmBoxes("/api/atlas/osm-abandoned", view, visible.osm, OSM_MIN_ZOOM);
  const osmData = useMemo(() => osm.data ?? { type: "FeatureCollection" as const, features: [] }, [osm.data]);

  const data = useMemo(
    () => ({
      osm: osmData,
      gnis: gnis ? gnisFeatures(gnis) : undefined,
      ghost: ghost ? ghostFeatures(ghost) : undefined,
      drowned: drowned ? drownedFeatures(drowned) : undefined,
    }),
    [gnis, ghost, drowned, osmData]
  );

  /* then & now */
  const [thenNow, setThenNow] = useState<ThenNowPlace | null>(null);

  /* ── modes: map · stories ─────────────────────────────────────── */
  const [mode, setMode] = useState<Mode>("map");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const story = storyId ? ghostStoryById(storyId) ?? null : null;
  const library = useLibrary(mode === "stories" ? { project: "ghost-towns" } : null);

  /* ── 3D flyover of a featured town ─────────────────────────────── */
  const [fly, setFly] = useState<FeaturedTown | null>(null);
  const [orbiting, setOrbiting] = useState(true);
  const beforeFly = useRef<{ basemap: Basemap; terrain: TerrainMode } | null>(null);
  const startFly = useCallback(
    (t: FeaturedTown) => {
      if (!beforeFly.current) beforeFly.current = { basemap, terrain };
      setFly(t);
      setPickedState(null);
      setPanel(null);
      setBasemap("satellite");
      setTerrain("3d");
      setOrbiting(true);
      setFlyTo({ center: t.center, zoom: Math.min(t.zoom, 15) - 0.5, pitch: 62, bearing: 20, nonce: Date.now() });
    },
    [basemap, terrain]
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
  const flyIndex = fly ? FEATURED_TOWNS.findIndex((t) => t.id === fly.id) : -1;

  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const go = (center: [number, number], zoom: number) => setFlyTo({ center, zoom, pitch: 0, bearing: 0, nonce: Date.now() });

  const pickFeatured = (t: FeaturedTown) => {
    setPicked({ layer: "featured", id: t.id, props: { id: t.id, name: t.name }, lngLat: t.center });
    go(t.center, t.zoom);
  };
  const pickGhost = (i: number) => {
    if (!ghost) return;
    const at: [number, number] = [ghost.lng[i], ghost.lat[i]];
    setPicked({ layer: "ghost", id: i, props: { i, id: ghost.id[i], name: ghost.name[i] }, lngLat: at });
    go(at, 12);
  };
  const pickGnis = (i: number) => {
    if (!gnis) return;
    const at: [number, number] = [gnis.lng[i], gnis.lat[i]];
    setPicked({ layer: "gnis", id: gnis.id[i], props: { id: gnis.id[i], name: gnis.name[i], state: gnis.state[i], county: gnis.county[i] }, lngLat: at });
    go(at, 12.5);
  };
  const pickDrowned = (i: number) => {
    if (!drowned) return;
    const d = drowned[i];
    setPicked({ layer: "drowned", id: i, props: { i, name: d.name, state: d.state, reservoir: d.reservoir, wiki: d.wiki, approximate: d.approximate }, lngLat: [d.lng, d.lat] });
    go([d.lng, d.lat], 11);
  };

  /* each chapter flies to its camera */
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    const i = Math.min(chapter, story.chapters.length - 1);
    setPickedState(null);
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
  };
  const runStoryAction = (a: StoryAction<GhostAction>) => {
    const v = String(a.value ?? "");
    if (a.kind === "town") {
      const t = featuredById(v);
      if (t) pickFeatured(t);
    } else if (a.kind === "fly") {
      const t = featuredById(v);
      if (t) startFly(t);
    } else if (a.kind === "then") {
      const [lng, lat, zoom, ...name] = v.split(",");
      setThenNow({ center: [Number(lng), Number(lat)], zoom: Number(zoom), name: name.join(",") });
    } else if (a.kind === "layer") {
      // show just this layer, across the country
      setVisible((cur) => Object.fromEntries(Object.keys(cur).map((k) => [k, k === v || k === "featured"])));
      go([-97, 39], 3.6);
    }
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setPickedState(null);
    setPanel(null);
    if (m === "map") setVisible(Object.fromEntries(GHOST_LAYERS.map((l) => [l.id, !!l.defaultOn])));
  };

  /* every place as one searchable list */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = FEATURED_TOWNS.map((t) => ({ key: `f-${t.id}`, kind: "featured", name: t.name, sub: `${t.where} · ${t.era}`, at: t.center, pick: () => pickFeatured(t) }));
    if (ghost)
      for (let i = 0; i < ghost.id.length; i++) {
        const life = lifespan(ghost.founded[i], ghost.abandoned[i]);
        out.push({ key: `g-${ghost.id[i]}`, kind: "ghost", name: ghost.name[i], sub: [ghost.country[i], life].filter(Boolean).join(" · "), at: [ghost.lng[i], ghost.lat[i]], pick: () => pickGhost(i) });
      }
    if (drowned) drowned.forEach((d, i) => out.push({ key: `d-${i}`, kind: "drowned", name: d.name, sub: `under ${d.reservoir}${d.state ? ` · ${d.state}` : ""}`, at: [d.lng, d.lat], pick: () => pickDrowned(i) }));
    if (gnis)
      for (let i = 0; i < gnis.id.length; i++)
        out.push({ key: `n-${gnis.id[i]}`, kind: "gnis", name: gnis.name[i], sub: [gnis.county[i] ? `${gnis.county[i]} Co.` : null, gnis.state[i]].filter(Boolean).join(", "), at: [gnis.lng[i], gnis.lat[i]], pick: () => pickGnis(i) });
    return out;
    // the pick closures only read the data captured here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghost, drowned, gnis]);

  /* ── share links: ?town=<featured id> · ?q=<Wikidata id> · ?gnis=<id> ── */
  const urlRead = useRef(false);
  useEffect(() => {
    if (urlRead.current || !ghost || !gnis || !drowned) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("town") ? featuredById(q.get("town")!) : undefined;
    const sid = q.get("story");
    if (sid && ghostStoryById(sid)) {
      setMode("stories");
      setStoryId(sid);
      setChapter(Math.max(0, Number(q.get("ch") ?? 0) || 0));
      return;
    }
    const reopen = (name: string, center: [number, number], zoom: number) => q.get("view") === "then" && setThenNow({ name, center, zoom });
    if (f) {
      pickFeatured(f);
      reopen(f.name, f.center, Math.min(f.zoom, 14.5));
    }
    else if (q.get("q")) {
      const i = ghost.id.indexOf(q.get("q")!);
      if (i >= 0) {
        pickGhost(i);
        reopen(ghost.name[i], [ghost.lng[i], ghost.lat[i]], 14);
      }
    } else if (q.get("gnis")) {
      const i = gnis.id.indexOf(Number(q.get("gnis")));
      if (i >= 0) {
        pickGnis(i);
        reopen(gnis.name[i], [gnis.lng[i], gnis.lat[i]], 14.5);
      }
    }
    // once everything has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghost, gnis, drowned]);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (picked?.layer === "featured") q.set("town", String(picked.id));
    else if (picked?.layer === "ghost") q.set("q", String(picked.props.id));
    else if (picked?.layer === "gnis") q.set("gnis", String(picked.props.id));
    if (thenNow && q.toString()) q.set("view", "then");
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [picked, thenNow, mode, storyId, chapter]);
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

  const citations = GHOST_LAYERS.filter((l) => visible[l.id] && l.citation.label).map((l) => l.citation);
  const usGhost = ghost ? ghost.country.filter((c) => c === "United States").length : 0;

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#0c0a09] text-stone-100" : "bg-stone-50 text-stone-900"}`}>
      <AtlasMap
        layers={GHOST_LAYERS}
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
        <GhostDetailsDrawer picked={picked} cols={ghost} drowned={drowned} onClose={() => setPickedState(null)} onThenNow={setThenNow} onFly={startFly} />
      </AtlasMap>

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/atlas" className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-amber-200`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Ghost className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">Ghost Towns</span>
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
            id="gt-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={switchMode}
            className="pointer-events-auto"
            options={[
              { key: "map", label: <><MapIcon className="h-3.5 w-3.5" />Map</> },
              { key: "stories", label: <><BookOpen className="h-3.5 w-3.5" />Stories</> },
            ]}
          />
        )}
        {loadError && <p className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}>Couldn&apos;t load the ghost-town data ({loadError}).</p>}
      </div>

      {thenNow && <ThenNow key={thenNow.center.join(",")} place={thenNow} onExit={() => setThenNow(null)} />}

      {mode === "stories" && !fly && (
        <StoryPlayer
          stories={GHOST_STORIES}
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
              onClick={() => startFly(FEATURED_TOWNS[(flyIndex + 1) % FEATURED_TOWNS.length])}
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
      {mode === "map" && !fly && (
      <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
        <HudIconButton icon={ListOrdered} label="Find a town" active={panel === "find"} onClick={() => togglePanel("find")} badge={FEATURED_TOWNS.length} />
        <HudIconButton icon={Layers} label="Layers" active={panel === "layers"} onClick={() => togglePanel("layers")} />
      </div>
      )}
      {panel && (
        <SidePanel title={panel === "find" ? "Find a town" : "Layers"} onClose={() => setPanel(null)}>
          {panel === "find" && <FindTown rows={rows} onGo={go} />}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel id="gt" layers={GHOST_LAYERS} visible={visible} onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))} basemap={basemap} onBasemap={setBasemap} terrain={terrain} onTerrain={setTerrain} />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      {mode === "map" && !fly && (
      <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
        <HudStat label="Vanished places (U.S.)" value={gnis ? gnis.id.length.toLocaleString() : "—"} tone="text-stone-300" />
        <HudStat label="Ghost towns" value={ghost ? ghost.id.length.toLocaleString() : "—"} tone="text-amber-300" onClick={() => togglePanel("find")} />
        <HudStat label="In the U.S." value={ghost ? usGhost.toLocaleString() : "—"} tone="text-amber-200" />
        <HudStat label="Drowned towns" value={drowned ? drowned.length : "—"} tone="text-sky-300" onClick={() => go([-82, 39], 4.2)} />
        <HudStat label="Featured" value={FEATURED_TOWNS.length} tone="text-white" onClick={() => togglePanel("find")} />
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

const KIND_DOT: Record<Row["kind"], string> = { featured: "#ffffff", ghost: GHOST_COLORS.ghost, gnis: GHOST_COLORS.gnis, drowned: GHOST_COLORS.drowned };
const KIND_LABEL: Record<Row["kind"], string> = { featured: "Featured", ghost: "Ghost town", gnis: "Vanished place", drowned: "Drowned town" };
const LIST_MAX = 80;

function FindTown({ rows, onGo }: { rows: Row[]; onGo: (c: [number, number], z: number) => void }) {
  const [q, setQ] = useState("");
  const [me, setMe] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const needle = q.trim().toLowerCase();
  const list = useMemo(() => {
    if (me) return rows.map((r) => ({ r, d: kmBetween(me, r.at) })).sort((a, b) => a.d - b.d).slice(0, LIST_MAX);
    if (needle.length < 2) return rows.filter((r) => r.kind === "featured").map((r) => ({ r, d: null as number | null }));
    const hits: { r: Row; d: number | null }[] = [];
    // ghost towns and drowned towns before the long tail of vanished places
    for (const kind of ["featured", "ghost", "drowned", "gnis"] as const)
      for (const r of rows) {
        if (hits.length >= LIST_MAX) break;
        if (r.kind === kind && `${r.name} ${r.sub}`.toLowerCase().includes(needle)) hits.push({ r, d: null });
      }
    return hits;
  }, [rows, needle, me]);
  const nearMe = () => {
    if (!navigator.geolocation) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setMe(at);
        setLocating("idle");
        onGo(at, 8);
      },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  };
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
            placeholder="Search 19,000 vanished places…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-[13px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-300/40"
          />
        </label>
        <button type="button" onClick={nearMe} title="Ghost towns near me" className={`inline-flex items-center gap-1 rounded-xl border px-2.5 font-mono text-[10px] uppercase tracking-wider ${me ? "border-amber-300/50 text-amber-200" : "border-white/10 text-slate-300 hover:text-white"}`}>
          <LocateFixed className="h-3.5 w-3.5" /> Near me
        </button>
      </div>
      {locating === "denied" && <p className="text-[11px] text-slate-500">Location isn&apos;t available — search by name or state instead.</p>}
      {!needle && !me && <HudLabel>Featured towns</HudLabel>}
      <ul className="space-y-0.5">
        {list.map(({ r, d }) => (
          <li key={r.key}>
            <button type="button" onClick={r.pick} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_DOT[r.kind], boxShadow: r.kind === "featured" ? "0 0 8px #fbbf24" : undefined }} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[13px] ${r.kind === "featured" ? "font-semibold text-white" : "text-slate-100"}`}>{r.name}</span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {KIND_LABEL[r.kind]}
                  {r.sub ? ` · ${r.sub}` : ""}
                </span>
              </span>
              {d != null && <span className="shrink-0 font-mono text-[11px] text-amber-200">{d < 10 ? d.toFixed(1) : Math.round(d)} km</span>}
            </button>
          </li>
        ))}
        {needle.length >= 2 && !list.length && <li className="py-6 text-center text-xs text-slate-500">No place matches.</li>}
      </ul>
    </div>
  );
}
