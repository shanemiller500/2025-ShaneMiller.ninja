"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Anchor,
  ArrowLeft,
  BookOpen,
  Check,
  History as HistoryIcon,
  Layers,
  Link2,
  ListOrdered,
  Map as MapIcon,
  Search,
  X,
} from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { useTimeline } from "@/components/atlas/useTimeline";
import {
  HudIconButton,
  HudLabel,
  HudPanel,
  HudStat,
  HudSwitch,
  hudGlass,
  useAtlasTheme,
} from "@/components/atlas/Hud";
import type { AtlasTime, Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import { useLibrary } from "@/utils/geo/useLibrary";
import {
  CAUSES,
  ERAS,
  SINKINGS_URL,
  eraRows,
  sinkingFeatures,
  type EraKey,
  type SinkingsFile,
} from "@/utils/geo/sinkings";
import {
  NAMED_WRECKS_URL,
  NOAA_WRECKS_URL,
  WORLD_WRECKS_URL,
  WRECK_CATS,
  chartedWreckFeatures,
  namedWreckFeatures,
  type NamedWreckCols,
  type WorldWreckCols,
} from "@/utils/geo/wrecks";
import { FEATURED_WRECKS, featuredById, type FeaturedWreck } from "./featured";
import { MAP_PANEL_LAYERS, WRECK_LAYERS } from "./layers";
import { WreckDetailsDrawer } from "./Details";
import { Descent, type DiveTarget } from "./Descent";
import { SinkingsBar } from "./Sinkings";
import { WRECK_STORIES, storyById, type WreckAction } from "./stories";

type Mode = "map" | "time" | "stories";
const DAY = 86_400_000;
const eraOf = (t: number): EraKey => (t < Date.UTC(1930, 0, 1) ? "ww1" : "ww2");
const parseDay = (s: string) => Date.parse(`${s}T12:00:00Z`);

interface Graveyard {
  name: string;
  center: [number, number];
  wrecks: number;
  dangerous: number;
}

/* ------------------------------------------------------------------ */
/*  Shipwrecks — charted wrecks worldwide (NOAA in U.S. waters, the    */
/*  UK Hydrographic Office everywhere else), 30,000 named wrecks, the  */
/*  National Marine Sanctuaries, and eleven wrecks with their stories. */
/* ------------------------------------------------------------------ */

type Panel = "find" | "layers" | null;
type FC = GeoJSON.FeatureCollection;

export default function ShipwrecksApp() {
  const dark = useAtlasTheme();
  const [noaa, setNoaa] = useState<FC | null>(null);
  const [named, setNamed] = useState<NamedWreckCols | null>(null);
  const [world, setWorld] = useState<WorldWreckCols | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cats, setCats] = useState<Set<string>>(
    () => new Set([...WRECK_CATS.map((c) => c.key), "none"]),
  );
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WRECK_LAYERS.map((l) => [l.id, !!l.defaultOn])),
  );
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [terrain, setTerrain] = useState<TerrainMode>("flat");
  const [picked, setPickedState] = useState<Picked | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [flyTo, setFlyTo] = useState<{
    center: [number, number];
    zoom?: number;
    pitch?: number;
    bearing?: number;
    nonce: number;
  } | null>(null);
  const [initialView] = useState(() => ({
    center: [-70, 38] as [number, number],
    zoom: Math.min(3.2, Math.max(1.6, Math.log2(window.innerWidth / 300))),
  }));

  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([
      fetch(NOAA_WRECKS_URL, { signal: ctl.signal }).then((r) => r.json()),
      fetch(NAMED_WRECKS_URL, { signal: ctl.signal }).then((r) => r.json()),
    ])
      .then(([n, w]: [FC, { cols: NamedWreckCols }]) => {
        setNoaa(n);
        setNamed(w.cols);
      })
      .catch((e) => !ctl.signal.aborted && setLoadError((e as Error).message));
    // the rest of the world's charted wrecks — bigger, so it streams in after the U.S. ones
    fetch(WORLD_WRECKS_URL, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j: { cols: WorldWreckCols }) => setWorld(j.cols))
      .catch(() => undefined);
    return () => ctl.abort();
  }, []);

  const noaaData = useMemo(
    () => (noaa || world ? chartedWreckFeatures(noaa, world, cats) : undefined),
    [noaa, world, cats],
  );
  const namedData = useMemo(
    () => (named ? namedWreckFeatures(named) : undefined),
    [named],
  );
  /* ── modes: the map · sinkings through time · stories ─────────── */
  const [mode, setMode] = useState<Mode>("map");
  const [sinkFile, setSinkFile] = useState<SinkingsFile | null>(null);
  const [sinkError, setSinkError] = useState<string | null>(null);
  const wantSinkings = mode !== "map";
  useEffect(() => {
    if (!wantSinkings || sinkFile) return;
    const ctl = new AbortController();
    fetch(SINKINGS_URL, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j: SinkingsFile) => setSinkFile(j))
      .catch((e) => !ctl.signal.aborted && setSinkError((e as Error).message));
    return () => ctl.abort();
  }, [wantSinkings, sinkFile]);
  const [era, setEra] = useState<EraKey>("ww2");
  const [causes, setCauses] = useState<Set<string>>(() => new Set(CAUSES.map((c) => c.key)));
  const rows = useMemo(() => (sinkFile ? eraRows(sinkFile, era) : []), [sinkFile, era]);
  const sinkData = useMemo(() => (sinkFile ? sinkingFeatures(sinkFile, rows, causes) : undefined), [sinkFile, rows, causes]);
  const tl = useTimeline(ERAS[era].start, ERAS[era].end, era === "ww1" ? 80_000 : 100_000);
  // jump the replay to a day, switching war first if needed (the timeline rewinds on a new range)
  const pendingGo = useRef<{ t: number; play: boolean } | null>(null);
  const goTo = useCallback(
    (t: number, play: boolean) => {
      const e = eraOf(t);
      const clamped = Math.min(ERAS[e].end, Math.max(ERAS[e].start, t));
      if (e !== era) {
        pendingGo.current = { t: clamped, play };
        setEra(e);
        return;
      }
      tl.pause();
      tl.setCursor(clamped);
      if (play) setTimeout(tl.play, 0);
    },
    [era, tl],
  );
  useEffect(() => {
    const p = pendingGo.current;
    if (!p) return;
    pendingGo.current = null;
    tl.setCursor(p.t);
    if (p.play) setTimeout(tl.play, 0);
    // after the era (and so the timeline range) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [era]);

  const data = useMemo(
    () => ({ noaa: noaaData, named: namedData, density: noaaData, sinkings: sinkData }),
    [noaaData, namedData, sinkData],
  );

  /* graveyards: the densest clusters of charted wrecks */
  const [graveyards, setGraveyards] = useState<Graveyard[]>([]);
  useEffect(() => {
    fetch("/atlas/graveyards.json")
      .then((r) => r.json())
      .then((j: { graveyards: Graveyard[] }) => setGraveyards(j.graveyards))
      .catch(() => undefined);
  }, []);

  /* the descent */
  const [dive, setDive] = useState<DiveTarget | null>(null);
  const openDive = useCallback((t: DiveTarget) => {
    setDive(t);
    setPickedState(null);
    setPanel(null);
  }, []);

  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const pickFeatured = (w: FeaturedWreck) => {
    setPicked({
      layer: "featured",
      id: w.id,
      props: { id: w.id, name: w.name },
      lngLat: w.center,
    });
    setFlyTo({
      center: w.center,
      zoom: w.zoom,
      pitch: 0,
      bearing: 0,
      nonce: Date.now(),
    });
  };
  const pickNamed = (i: number) => {
    if (!named) return;
    const at: [number, number] = [named.lng[i], named.lat[i]];
    setPicked({
      layer: "named",
      id: i,
      props: { id: named.id[i], name: named.name[i], year: named.year[i] },
      lngLat: at,
    });
    setFlyTo({ center: at, zoom: 11, pitch: 0, bearing: 0, nonce: Date.now() });
  };
  const pickSinking = (i: number) => {
    const f = sinkData?.features.find((x) => x.id === i);
    if (!f) return;
    setPicked({ layer: "sinkings", id: i, props: f.properties ?? {}, lngLat: f.geometry.coordinates as [number, number] });
    setFlyTo({ center: f.geometry.coordinates as [number, number], zoom: 6, pitch: 0, bearing: 0, nonce: Date.now() });
  };

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const story = storyId ? storyById(storyId) ?? null : null;
  const chapterTime = mode === "stories" && story ? story.time[Math.min(chapter, story.chapters.length - 1)] ?? null : null;
  const library = useLibrary(mode === "stories" ? { project: "shipwrecks" } : null);
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    const i = Math.min(chapter, story.chapters.length - 1);
    const at = story.time[i];
    if (at) goTo(parseDay(at.at), false);
    setPickedState(null);
    setFlyTo({ ...story.chapters[i].camera, nonce: Date.now() });
    // run when the chapter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storyId, chapter]);
  const openStory = (id: string | null) => {
    setStoryId(id);
    setChapter(0);
  };
  const runStoryAction = (a: StoryAction<WreckAction>) => {
    if (a.kind === "replay") {
      setMode("time");
      setCauses(new Set(CAUSES.map((c) => c.key)));
      goTo(parseDay(String(a.value)), true);
    } else if (a.kind === "wreck" || a.kind === "dive") {
      const w = featuredById(String(a.value));
      if (!w) return;
      if (a.kind === "wreck") pickFeatured(w);
      else openDive({ name: w.name, center: w.center, depth: w.depthM ?? null, depthSource: w.depthM ? "published" : null });
    }
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setPickedState(null);
    setPanel(null);
    if (m !== "time") tl.pause();
  };

  /* what the map draws in each mode */
  const showTime = mode === "time" || !!chapterTime;
  const shownVisible = useMemo<Record<string, boolean>>(() => {
    if (showTime) return { seafloor: true, sanctuaries: false, sinkings: true, featured: mode === "stories" };
    const v: Record<string, boolean> = { ...visible, sinkings: false };
    if (mode === "stories") v.featured = true;
    return v;
  }, [showTime, visible, mode]);
  const time = useMemo<AtlasTime | null>(
    () => (showTime ? { cursor: tl.cursor, trail: (mode === "stories" ? 365 : 120) * DAY, flash: 14 * DAY } : null),
    [showTime, tl.cursor, mode],
  );

  /* ── share links: ?wreck=<featured id> · ?q=<wikidata id> ───────── */
  const urlRead = useRef(false);
  useEffect(() => {
    if (urlRead.current || !named) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("wreck") ? featuredById(q.get("wreck")!) : undefined;
    const qid = q.get("q");
    const sid = q.get("story");
    if (sid && storyById(sid)) {
      setMode("stories");
      setStoryId(sid);
      setChapter(Math.max(0, Number(q.get("ch") ?? 0) || 0));
    } else if (q.get("mode") === "time") {
      setMode("time");
      const e = q.get("era");
      if (e === "ww1" || e === "ww2") setEra(e);
    } else if (f) pickFeatured(f);
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
    if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (mode === "time") {
      q.set("mode", "time");
      q.set("era", era);
    } else if (picked?.layer === "featured") q.set("wreck", String(picked.id));
    else if (picked?.layer === "named") q.set("q", String(picked.props.id));
    const qs = q.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [picked, mode, storyId, chapter, era]);
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

  const citations = MAP_PANEL_LAYERS.filter(
    (l) => visible[l.id] && l.citation.label,
  ).map((l) => l.citation);
  const charted = (noaa?.features.length ?? 0) + (world?.id.length ?? 0);
  const dangerous =
    (noaa?.features.filter((f) => f.properties?.cat === "danger").length ?? 0) +
    (world?.cat.filter((c) => c === "danger").length ?? 0);

  return (
    <div
      className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#010610] text-slate-100" : "bg-slate-50 text-slate-900"}`}
    >
      <AtlasMap
        layers={WRECK_LAYERS}
        visible={shownVisible}
        data={data}
        time={time}
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
        <WreckDetailsDrawer
          picked={picked}
          onClose={() => setPickedState(null)}
          onDive={openDive}
        />
      </AtlasMap>

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/atlas"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-sky-200`}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <Anchor className="h-3.5 w-3.5 text-sky-300" />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">
              Shipwrecks
            </span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            title="Copy a link to exactly this view"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${copied ? "text-emerald-300" : "text-slate-300 hover:text-sky-200"}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {copied ? "Copied" : "Share"}
            </span>
          </button>
        </div>
        {!dive && (
          <HudSwitch
            id="sw-mode"
            ariaLabel="Mode"
            value={mode}
            onChange={switchMode}
            className="pointer-events-auto"
            options={[
              {
                key: "map",
                label: (
                  <>
                    <MapIcon className="h-3.5 w-3.5" />
                    Wrecks
                  </>
                ),
              },
              {
                key: "time",
                label: (
                  <>
                    <HistoryIcon className="h-3.5 w-3.5" />
                    Through time
                  </>
                ),
                title: "Ships lost in the two world wars, day by day",
              },
              {
                key: "stories",
                label: (
                  <>
                    <BookOpen className="h-3.5 w-3.5" />
                    Stories
                  </>
                ),
              },
            ]}
          />
        )}
        {mode === "map" && (
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
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: on ? c.color : "#475569" }}
                />
                {c.label}
              </button>
            );
          })}
        </div>
        )}
        {loadError && (
          <p
            className={`${hudGlass} pointer-events-auto px-3 py-2 text-xs text-rose-300`}
          >
            Couldn&apos;t load the wreck data ({loadError}).
          </p>
        )}
      </div>

      {dive && <Descent target={dive} onExit={() => setDive(null)} />}

      {/* ── right rail ───────────────────────────────────────────── */}
      {/* map chrome hides while diving */}
      {!dive && mode === "time" && (
        <SinkingsBar
          file={sinkFile}
          error={sinkError}
          era={era}
          onEra={(e) => {
            setEra(e);
            setPickedState(null);
          }}
          rows={rows}
          causes={causes}
          onCauses={setCauses}
          tl={tl}
          onPickRow={pickSinking}
        />
      )}
      {!dive && mode === "stories" && (
        <StoryPlayer
          stories={WRECK_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          library={library.docs}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}
      {!dive && chapterTime && (
        <HudPanel className="absolute right-3 top-[120px] z-20 px-3 py-2 sm:right-4">
          <HudLabel>Sinkings to</HudLabel>
          <p className="font-mono text-[13px] font-semibold text-white">
            {new Date(tl.cursor).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}
          </p>
        </HudPanel>
      )}
      {!dive && mode === "map" && (
        <>
          <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
            <HudIconButton
              icon={ListOrdered}
              label="Find a wreck"
              active={panel === "find"}
              onClick={() => togglePanel("find")}
              badge={FEATURED_WRECKS.length}
            />
            <HudIconButton
              icon={Layers}
              label="Layers"
              active={panel === "layers"}
              onClick={() => togglePanel("layers")}
            />
          </div>
          {panel && (
            <SidePanel
              title={panel === "find" ? "Find a wreck" : "Layers"}
              onClose={() => setPanel(null)}
            >
              {panel === "find" && (
                <FindWreck
                  named={named}
                  graveyards={graveyards}
                  onFeatured={pickFeatured}
                  onNamed={pickNamed}
                  onGraveyard={(g) => {
                    setVisible((v) => ({ ...v, density: true }));
                    setFlyTo({
                      center: g.center,
                      zoom: 9.5,
                      pitch: 0,
                      bearing: 0,
                      nonce: Date.now(),
                    });
                  }}
                />
              )}
              {panel === "layers" && (
                <div className="space-y-4">
                  <LayerPanel
                    id="sw"
                    layers={MAP_PANEL_LAYERS}
                    visible={visible}
                    onToggle={(id) =>
                      setVisible((v) => ({ ...v, [id]: !v[id] }))
                    }
                    basemap={basemap}
                    onBasemap={setBasemap}
                    terrain={terrain}
                    onTerrain={setTerrain}
                  />
                  <SourceCitation citations={citations} />
                </div>
              )}
            </SidePanel>
          )}

          {/* ── status strip ─────────────────────────────────────────── */}
          <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
            <HudStat
              label="Charted wrecks"
              value={noaa ? charted.toLocaleString() : "—"}
              tone="text-sky-300"
            />
            <HudStat
              label="Hazards to ships"
              value={noaa ? dangerous.toLocaleString() : "—"}
              tone="text-rose-300"
            />
            <HudStat
              label="Named wrecks"
              value={named ? named.id.length.toLocaleString() : "—"}
              tone="text-white"
              onClick={() => togglePanel("find")}
            />
            <HudStat label="Sanctuaries" value="18" tone="text-teal-300" />
            <HudStat
              label="Featured"
              value={FEATURED_WRECKS.length}
              tone="text-amber-200"
              onClick={() => togglePanel("find")}
            />
            {graveyards[0] && (
              <HudStat
                label="Densest cluster"
                value={`${graveyards[0].name.split(",")[0]} · ${graveyards[0].wrecks}`}
                tone="text-rose-200"
                onClick={() => {
                  setVisible((v) => ({ ...v, density: true }));
                  setFlyTo({
                    center: graveyards[0].center,
                    zoom: 9.5,
                    pitch: 0,
                    bearing: 0,
                    nonce: Date.now(),
                  });
                }}
              />
            )}
          </HudPanel>
        </>
      )}
    </div>
  );
}

function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <HudPanel className="absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] flex-col md:inset-x-auto md:bottom-20 md:right-16 md:top-3 md:max-h-none md:w-[340px]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <HudLabel>{title}</HudLabel>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {children}
      </div>
    </HudPanel>
  );
}

function FindWreck({
  named,
  graveyards,
  onFeatured,
  onNamed,
  onGraveyard,
}: {
  named: NamedWreckCols | null;
  graveyards: Graveyard[];
  onFeatured: (w: FeaturedWreck) => void;
  onNamed: (i: number) => void;
  onGraveyard: (g: Graveyard) => void;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!named || needle.length < 2) return [];
    const out: number[] = [];
    for (let i = 0; i < named.name.length && out.length < 60; i++)
      if (named.name[i].toLowerCase().includes(needle)) out.push(i);
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
              <button
                type="button"
                onClick={() => onNamed(i)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-100" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-slate-100">
                    {named!.name[i]}
                  </span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {named!.lat[i].toFixed(2)}°, {named!.lng[i].toFixed(2)}°
                    {named!.year[i] ? ` · lost ${named!.year[i]}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!hits.length && (
            <li className="py-6 text-center text-xs text-slate-500">
              No named wreck matches.
            </li>
          )}
        </ul>
      ) : (
        <ul className="space-y-0.5">
          {FEATURED_WRECKS.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onFeatured(w)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border-2"
                  style={{
                    borderColor: w.accent,
                    boxShadow: `0 0 8px ${w.accent}`,
                  }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {w.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {w.lost} · {w.where.split(",").pop()?.trim()}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {graveyards.length > 0 && (
            <li className="px-2 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Densest wreck clusters (charted)
            </li>
          )}
          {graveyards.slice(0, 10).map((g) => (
            <li key={g.name}>
              <button
                type="button"
                onClick={() => onGraveyard(g)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-100">
                  {g.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-rose-200">
                  {g.wrecks}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
