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
  Activity,
  Loader2,
  LocateFixed,
  ArrowLeft,
  BookOpen,
  Flame,
  History as HistoryIcon,
  Layers,
  Radio,
  RefreshCw,
  Siren,
  Users,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { useNearMe } from "@/components/atlas/useNearMe";
import { LayerPanel } from "@/components/atlas/LayerPanel";
import { SourceCitation } from "@/components/atlas/SourceCitation";
import {
  HudIconButton,
  HudLabel,
  HudPanel,
  HudStat,
  HudSwitch,
  hudGlass,
  useAtlasTheme,
} from "@/components/atlas/Hud";
import type { Basemap, Picked, TerrainMode } from "@/components/atlas/types";
import {
  ALERT_GROUPS,
  FLOOD_LEVELS,
  fetchAlerts,
  fetchHotspots,
  fetchWorldEvents,
  fetchIcebergs,
  worldEventsShown,
  fetchFirePerimeters,
  fetchFloodGauges,
  fetchStormReports,
  fetchStorms,
  type AlertGroup,
  type Storm,
} from "@/utils/geo/hazards";
import { DISASTER_LAYERS, HISTORY_LAYER_IDS } from "./layers";
import { NearList } from "./NearList";
import { pathPolygon, type AreaGeometry } from "@/utils/geo/impact";
import { HistoryBar, useHistory } from "./HistoryBar";
import { StoryPlayer } from "@/components/atlas/StoryPlayer";
import type { StoryAction } from "@/components/atlas/story";
import { DISASTER_STORIES, type DisasterAction } from "./stories";
import { NOTABLE } from "./history";
import { DisasterDetails, loadNri } from "./Details";

/* ------------------------------------------------------------------ */
/*  Disaster Atlas — what's happening right now: NWS warnings, active  */
/*  wildfires + satellite hotspots, hurricanes with their cones,       */
/*  today's storm reports and flooding rivers, over FEMA's county      */
/*  risk index. Everything refreshes every five minutes.               */
/* ------------------------------------------------------------------ */

type Panel = "now" | "layers" | "near" | null;
type FC = GeoJSON.FeatureCollection;

const REFRESH_MS = 5 * 60_000;
const EMPTY: FC = { type: "FeatureCollection", features: [] };
const fitZoom = () =>
  Math.min(
    4.6,
    Math.max(
      2.4,
      Math.log2((window.innerWidth * 0.9 * 360) / (512 * 58)) + 0.3,
    ),
  );

interface Live {
  alerts: FC | null;
  fires: FC | null;
  hotspots: FC | null;
  world: FC | null;
  icebergs: FC | null;
  storms: Storm[] | null;
  reports: FC | null;
  gauges: FC | null;
}

/** Each feed loads on its own; a slow or failing one never blocks the others. */
function useLiveHazards() {
  const [live, setLive] = useState<Live>({
    alerts: null,
    fires: null,
    hotspots: null,
    world: null,
    icebergs: null,
    storms: null,
    reports: null,
    gauges: null,
  });
  const [failed, setFailed] = useState<string[]>([]);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    const jobs: [keyof Live, string, () => Promise<unknown>][] = [
      ["alerts", "NWS warnings", () => fetchAlerts(ctl.signal)],
      ["fires", "fire perimeters", () => fetchFirePerimeters(ctl.signal)],
      ["hotspots", "satellite fire detections", () => fetchHotspots(ctl.signal)],
      ["world", "disasters worldwide (GDACS)", () => fetchWorldEvents(ctl.signal)],
      ["icebergs", "giant icebergs (NASA EONET)", () => fetchIcebergs(ctl.signal)],
      ["storms", "hurricanes", () => fetchStorms(ctl.signal)],
      ["reports", "storm reports", () => fetchStormReports(ctl.signal)],
      ["gauges", "river gauges", () => fetchFloodGauges(ctl.signal)],
    ];
    const fails: string[] = [];
    Promise.allSettled(
      jobs.map(([key, label, run]) =>
        run()
          .then(
            (v) =>
              !ctl.signal.aborted && setLive((cur) => ({ ...cur, [key]: v })),
          )
          .catch(() => {
            if (!ctl.signal.aborted) fails.push(label);
          }),
      ),
    ).then(() => {
      if (ctl.signal.aborted) return;
      setFailed(fails);
      setUpdated(new Date());
    });
    const t = setTimeout(() => setTick((n) => n + 1), REFRESH_MS);
    return () => {
      ctl.abort();
      clearTimeout(t);
    };
  }, [tick]);
  return { live, failed, updated, refresh: () => setTick((n) => n + 1) };
}

const HAZARD_LAYER: Record<string, string> = {
  hurricanes: "hist-hurricanes",
  tornadoes: "hist-tornadoes",
  fires: "hist-fires",
  declarations: "declarations",
};

export default function DisasterApp() {
  const dark = useAtlasTheme();
  const { live, failed, updated, refresh } = useLiveHazards();
  const [mode, setMode] = useState<"live" | "history" | "stories">("live");
  // stories draw on the same archives as history mode
  const hist = useHistory(mode !== "live");
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DISASTER_LAYERS.map((l) => [l.id, !!l.defaultOn])),
  );
  const [groups, setGroups] = useState<Set<AlertGroup>>(
    () => new Set(ALERT_GROUPS.map((g) => g.key)),
  );
  const [showWatches, setShowWatches] = useState(true);
  const [showContained, setShowContained] = useState(false);
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
    center: [-96.5, 37.5] as [number, number],
    zoom: fitZoom(),
  }));

  // the county risk file is big: fetch it only once someone turns the layer on
  const [nri, setNri] = useState<FC | null>(null);
  useEffect(() => {
    if (visible.risk && !nri)
      loadNri()
        .then(setNri)
        .catch(() => undefined);
  }, [visible.risk, nri]);

  const setPicked = useCallback((p: Picked | null) => {
    setPickedState(p);
    if (p) setPanel(null);
  }, []);
  const { me, locating, locate } = useNearMe((at) => {
    setPickedState(null);
    setPanel("near");
    setFlyTo({ center: at, zoom: 6, pitch: 0, bearing: 0, nonce: Date.now() });
  });
  const togglePanel = (p: Exclude<Panel, null>) => {
    setPanel((cur) => (cur === p ? null : p));
    setPickedState(null);
  };
  const go = (center: [number, number], zoom: number) =>
    setFlyTo({ center, zoom, pitch: 0, bearing: 0, nonce: Date.now() });

  /* ── what goes on the map ──────────────────────────────────────── */
  const alertData = useMemo<FC | undefined>(
    () =>
      live.alerts
        ? {
            ...live.alerts,
            features: live.alerts.features.filter(
              (f) =>
                groups.has(f.properties?.group) &&
                (showWatches || !f.properties?.watch),
            ),
          }
        : undefined,
    [live.alerts, groups, showWatches],
  );
  const fireData = useMemo<FC | undefined>(
    () =>
      live.fires
        ? {
            ...live.fires,
            features: live.fires.features.filter(
              (f) => showContained || (f.properties?.contained ?? 0) < 100,
            ),
          }
        : undefined,
    [live.fires, showContained],
  );
  const stormData = useMemo(() => {
    const ss = live.storms ?? [];
    const fc = (fs: GeoJSON.Feature[]): FC => ({
      type: "FeatureCollection",
      features: fs,
    });
    return {
      "storm-cone": fc(ss.flatMap((s) => s.cone)),
      "storm-track": fc(ss.flatMap((s) => s.track)),
      "storm-past": fc(ss.flatMap((s) => s.past)),
      "storm-points": fc(ss.flatMap((s) => s.points)),
      "storm-centers": fc(
        ss.map((s) => ({
          type: "Feature" as const,
          properties: {
            storm: s.id,
            title: `${s.category ? `Cat ${s.category} ` : ""}${s.name} · ${s.windMph} mph`,
          },
          geometry: { type: "Point" as const, coordinates: s.center },
        })),
      ),
    };
  }, [live.storms]);
  const worldData = useMemo(
    () => worldEventsShown(live.world, (live.storms ?? []).map((st) => st.name)),
    [live.world, live.storms],
  );
  // live layers in live mode; just the chosen archive layer in history mode
  const shownVisible = useMemo<Record<string, boolean>>(() => {
    if (mode === "live")
      return {
        ...visible,
        ...Object.fromEntries(HISTORY_LAYER_IDS.map((id) => [id, false])),
      };
    return Object.fromEntries(
      DISASTER_LAYERS.map((l) => [l.id, l.id === HAZARD_LAYER[hist.hazard]]),
    );
  }, [mode, visible, hist.hazard]);

  const data = useMemo(
    () => ({
      ...hist.data,
      alerts: alertData,
      fires: fireData,
      hotspots: live.hotspots ?? undefined,
      world: worldData ?? undefined,
      icebergs: live.icebergs ?? undefined,
      reports: live.reports ?? undefined,
      gauges: live.gauges ?? undefined,
      risk: nri ?? EMPTY,
      ...stormData,
    }),
    [
      alertData,
      fireData,
      live.hotspots,
      worldData,
      live.icebergs,
      live.reports,
      live.gauges,
      nri,
      stormData,
      hist.data,
    ],
  );

  /* ── headline numbers ──────────────────────────────────────────── */
  const worldCyclones = (worldData?.features ?? []).filter((f) => f.properties?.type === "TC");
  const worldSerious = (worldData?.features ?? []).filter((f) => f.properties?.level === "Red" || f.properties?.level === "Orange");
  const warnings = (live.alerts?.features ?? []).filter(
    (f) => !f.properties?.watch,
  );
  const activeFires = (live.fires?.features ?? []).filter(
    (f) =>
      (f.properties?.contained ?? 0) < 100 && f.properties?.type === "Wildfire",
  );
  const fireAcres = activeFires.reduce(
    (a, f) => a + (f.properties?.acres ?? 0),
    0,
  );
  const todayReports = (live.reports?.features ?? []).filter(
    (f) => f.properties?.day === "today",
  );
  const flooding = (live.gauges?.features ?? []).filter(
    (f) => f.properties?.status !== "action",
  );

  /** Full geometry for the impact counts (map hits are clipped to tiles, so look it up in the data). */
  const geometryFor = useCallback(
    (p: Picked): AreaGeometry | null => {
      const poly = (f?: GeoJSON.Feature) => (f && (f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon") ? (f.geometry as AreaGeometry) : null);
      const byId = (fc: FC | null | undefined, id: unknown) => fc?.features.find((f) => String(f.properties?.id) === String(id));
      if (p.layer === "fires") return poly(byId(live.fires, p.props.id));
      if (p.layer === "alerts") return poly(byId(live.alerts, p.props.id));
      if (p.layer === "hist-fires") return poly(byId(hist.data["hist-fires"], p.props.id));
      if (p.layer === "storms") return poly(live.storms?.find((st) => st.id === p.props.storm)?.cone[0]);
      if (p.layer === "hist-tornadoes") {
        const c = hist.archives.tornadoes;
        const i = Number(p.props.i ?? p.id);
        if (!c || !Number.isFinite(i) || c.yr[i] === undefined) return null;
        return pathPolygon([c.slon[i], c.slat[i]], c.elat[i] ? [c.elon[i], c.elat[i]] : null, c.wid[i]);
      }
      return null;
    },
    [live.fires, live.alerts, live.storms, hist.data, hist.archives.tornadoes]
  );

  const citations = DISASTER_LAYERS.filter(
    (l) => shownVisible[l.id] && l.citation.label,
  ).map((l) => l.citation);
  const switchMode = (m: "live" | "history" | "stories") => {
    setMode(m);
    setPickedState(null);
    setPanel(null);
  };

  /* ── stories ───────────────────────────────────────────────────── */
  const [storyId, setStoryId] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const story = DISASTER_STORIES.find((st) => st.id === storyId) ?? null;
  // each chapter sets the archive map up, then flies to its camera
  useEffect(() => {
    if (mode !== "stories" || !story) return;
    const i = Math.min(chapter, story.chapters.length - 1);
    const setup = story.setup[i];
    if (setup) {
      hist.setHazard(setup.hazard);
      hist.setAllYears(false);
      hist.setMinCat(0);
      hist.setMinMag(0);
      hist.setMinAcres(1000);
      hist.setYearFor(setup.hazard, setup.year);
    }
    setPickedState(null);
    setFlyTo({ ...story.chapters[i].camera, nonce: Date.now() });
    // run when the chapter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storyId, chapter]);
  /* share links: ?story=<id>&ch=<n> · ?mode=history */
  const urlRead = useRef(false);
  useEffect(() => {
    if (urlRead.current) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const st = q.get("story");
    if (st && DISASTER_STORIES.some((x) => x.id === st)) {
      setStoryId(st);
      setChapter(Math.max(0, Number(q.get("ch")) || 0));
      setMode("stories");
    } else if (q.get("mode") === "history") setMode("history");
  }, []);
  useEffect(() => {
    if (!urlRead.current) return;
    const q = new URLSearchParams();
    if (mode === "stories" && storyId) {
      q.set("story", storyId);
      if (chapter) q.set("ch", String(chapter));
    } else if (mode !== "live") q.set("mode", mode);
    const qs = q.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [mode, storyId, chapter]);
  const openStory = (id: string | null) => {
    setStoryId(id);
    setChapter(0);
    setPickedState(null);
  };
  // a fire to open once that year's perimeters arrive
  const [pendingFire, setPendingFire] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingFire) return;
    const f = hist.data["hist-fires"].features.find((x) => String(x.properties?.name ?? "").toUpperCase() === pendingFire);
    if (!f) return;
    setPendingFire(null);
    const ring = (f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flatMap((pp) => pp[0]) : []) as number[][];
    const at: [number, number] = ring.length ? [ring.reduce((a, c) => a + c[0], 0) / ring.length, ring.reduce((a, c) => a + c[1], 0) / ring.length] : [0, 0];
    setPicked({ layer: "hist-fires", id: f.properties?.id, props: (f.properties ?? {}) as Record<string, unknown>, lngLat: at });
  }, [pendingFire, hist.data, setPicked]);
  const runStoryAction = (a: StoryAction<DisasterAction>) => {
    const v = String(a.value ?? "");
    if (a.kind === "hurricane") {
      const st = hist.archives.storms?.find((x) => x.id === v);
      if (!st) return;
      const peak = st.pts.reduce((m, q) => (q[3] > m[3] ? q : m), st.pts[0]);
      setPicked({ layer: "hist-hurricanes", props: { id: st.id }, lngLat: [peak[2] / 10, peak[1] / 10] });
    } else if (a.kind === "tornado") {
      const n = NOTABLE.tornadoes.find((x) => x.label === v);
      const c = hist.archives.tornadoes;
      if (!n || !c) return;
      // several tornadoes can share a day, state and rating: take the deadliest
      let best = -1;
      for (let i = 0; i < c.yr.length; i++) if (c.yr[i] === n.year && c.md[i] === n.md && c.st[i] === n.st && c.mag[i] === n.mag && (best < 0 || c.fat[i] > c.fat[best])) best = i;
      if (best >= 0) setPicked({ layer: "hist-tornadoes", id: best, props: { i: best }, lngLat: [c.slon[best], c.slat[best]] });
    } else if (a.kind === "fire") {
      const [, name] = v.split(":");
      setPendingFire(name.toUpperCase());
    }
  };

  return (
    <div className={`atlas-map-page fixed inset-0 overflow-hidden ${dark ? "dark bg-[#0a0403] text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      <AtlasMap
        layers={DISASTER_LAYERS}
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
        className="atlas-space absolute inset-0"
      >
        <DisasterDetails
          picked={picked}
          storms={live.storms ?? []}
          history={hist.archives}
          geometryFor={geometryFor}
          onClose={() => setPickedState(null)}
        />
      </AtlasMap>

      {/* ── top-left ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-30 flex flex-col items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/atlas"
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 transition-colors hover:text-orange-200`}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Atlas
          </Link>
          <div className={`${hudGlass} flex items-center gap-2.5 px-3 py-2`}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.3em] text-white">
              Disaster Atlas
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-red-300/80 sm:inline">
              Live
            </span>
          </div>
          <button
            type="button"
            onClick={refresh}
            title={
              updated
                ? `Updated ${updated.toLocaleTimeString()} — refreshes every 5 minutes`
                : "Loading…"
            }
            className={`${hudGlass} inline-flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:text-orange-200`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${updated ? "" : "animate-spin"}`}
            />
            <span className="hidden sm:inline">
              {updated
                ? updated.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "Loading"}
            </span>
          </button>
        </div>
        <HudSwitch
          id="da-mode"
          ariaLabel="Mode"
          value={mode}
          onChange={switchMode}
          className="pointer-events-auto"
          options={[
            {
              key: "live",
              label: (
                <>
                  <Radio className="h-3.5 w-3.5" />
                  Live now
                </>
              ),
            },
            {
              key: "history",
              label: (
                <>
                  <HistoryIcon className="h-3.5 w-3.5" />
                  History
                </>
              ),
              title:
                "Hurricanes since 1851, tornadoes since 1950, past fires and FEMA declarations",
            },
            {
              key: "stories",
              label: (
                <>
                  <BookOpen className="h-3.5 w-3.5" />
                  Stories
                </>
              ),
              title: "Joplin, Katrina, Harvey and the Camp Fire — from the federal reports",
            },
          ]}
        />
        {/* stop short of the detail drawer on wide screens */}
        {mode === "live" && (
          <div className="pointer-events-auto flex max-w-full flex-wrap gap-1.5 md:max-w-[calc(100vw-480px)]">
            {ALERT_GROUPS.map((g) => {
              const on = groups.has(g.key);
              const n = warnings.filter(
                (f) => f.properties?.group === g.key,
              ).length;
              return (
                <button
                  key={g.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setGroups((cur) => {
                      const next = new Set(cur);
                      if (next.has(g.key)) next.delete(g.key);
                      else next.add(g.key);
                      return next;
                    })
                  }
                  className={`${hudGlass} inline-flex items-center gap-1.5 !rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-opacity ${on ? "text-slate-100" : "text-slate-500 opacity-60"}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: on ? g.color : "#475569" }}
                  />
                  {g.label}
                  {n > 0 && <span className="text-slate-400">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        {mode === "live" && failed.length > 0 && (
          <p
            className={`${hudGlass} pointer-events-auto px-3 py-1.5 text-[11px] text-amber-200`}
          >
            Couldn&apos;t reach: {failed.join(", ")} — retrying in a few
            minutes.
          </p>
        )}
      </div>

      {/* ── right rail ───────────────────────────────────────────── */}
      {mode === "live" && (
        <div className="absolute right-3 top-[168px] z-30 flex flex-col gap-2">
          <HudIconButton
            icon={Activity}
            label="Happening now"
            active={panel === "now"}
            onClick={() => togglePanel("now")}
          />
          <HudIconButton
            icon={Users}
            label="People at risk (FEMA)"
            active={!!visible.risk}
            onClick={() => setVisible((v) => ({ ...v, risk: !v.risk }))}
          />
          <HudIconButton
            icon={Layers}
            label="Layers"
            active={panel === "layers"}
            onClick={() => togglePanel("layers")}
          />
          <HudIconButton
            icon={locating === "busy" ? Loader2 : LocateFixed}
            label={locating === "denied" ? "Near me — location isn't available" : "Near me"}
            active={panel === "near"}
            onClick={() => (me ? togglePanel("near") : locate())}
          />
        </div>
      )}
      {panel && mode === "live" && (
        <SidePanel
          title={panel === "now" ? "Happening now" : panel === "near" ? "Near you" : "Layers"}
          onClose={() => setPanel(null)}
        >
          {panel === "near" && me && (
            <NearList
              me={me}
              storms={live.storms ?? []}
              world={worldData?.features ?? []}
              icebergs={live.icebergs?.features ?? []}
              fires={activeFires}
              flooding={flooding}
              reports={todayReports}
              warnings={warnings}
              centreOf={centreOf}
              onGo={go}
              onPick={setPicked}
            />
          )}
          {panel === "now" && (
            <NowList
              storms={live.storms ?? []}
              fires={activeFires}
              flooding={flooding}
              tornadoes={todayReports.filter(
                (f) => f.properties?.kind === "tornado",
              )}
              warnings={warnings}
              onGo={go}
              onPick={setPicked}
            />
          )}
          {panel === "layers" && (
            <div className="space-y-4">
              <LayerPanel
                id="da"
                layers={DISASTER_LAYERS.filter((l) => l.id !== "place")}
                visible={visible}
                onToggle={(id) => setVisible((v) => ({ ...v, [id]: !v[id] }))}
                basemap={basemap}
                onBasemap={setBasemap}
                terrain={terrain}
                onTerrain={setTerrain}
                extras={{
                  alerts: (
                    <Toggle
                      label="Include watches"
                      on={showWatches}
                      onChange={setShowWatches}
                    />
                  ),
                  fires: (
                    <Toggle
                      label="Include fully contained fires"
                      on={showContained}
                      onChange={setShowContained}
                    />
                  ),
                }}
              />
              <SourceCitation citations={citations} />
            </div>
          )}
        </SidePanel>
      )}

      {mode === "stories" && (
        <StoryPlayer
          stories={DISASTER_STORIES}
          storyId={storyId}
          chapter={chapter}
          onStory={openStory}
          onChapter={(i) => setChapter(Math.max(0, i))}
          onAction={runStoryAction}
          className="absolute inset-x-3 bottom-3 z-30 max-h-[48vh] sm:inset-x-auto sm:left-4 sm:w-[400px] sm:max-h-[min(560px,62vh)]"
        />
      )}
      {mode === "history" && (
        <HistoryBar h={hist} onPick={setPicked} onGo={go} />
      )}

      {/* ── status strip ─────────────────────────────────────────── */}
      {mode === "live" && (
        <HudPanel className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-5 overflow-x-auto px-4 py-2.5 sm:left-4">
          <HudStat
            label="Warnings"
            value={live.alerts ? warnings.length.toLocaleString() : "—"}
            tone="text-red-300"
            onClick={() => togglePanel("now")}
          />
          <HudStat
            label="Active wildfires"
            value={
              live.fires
                ? `${activeFires.length} · ${Math.round(fireAcres).toLocaleString()} ac`
                : "—"
            }
            tone="text-orange-300"
          />
          <HudStat
            label="Tropical systems"
            value={live.storms || worldData ? (live.storms?.length ?? 0) + worldCyclones.length : "—"}
            tone="text-fuchsia-300"
            onClick={() => {
              if (live.storms?.[0]) go(live.storms[0].center, 4.5);
              else if (worldCyclones[0]) go((worldCyclones[0].geometry as GeoJSON.Point).coordinates as [number, number], 4.5);
            }}
          />
          <HudStat
            label="Storm reports today"
            value={live.reports ? todayReports.length : "—"}
            tone="text-sky-300"
          />
          <HudStat
            label="Rivers flooding"
            value={live.gauges ? flooding.length : "—"}
            tone="text-emerald-300"
          />
          <HudStat
            label="World alerts · orange/red"
            value={worldData ? worldSerious.length : "—"}
            tone="text-amber-300"
            onClick={() => go([20, 15], 1.6)}
          />
        </HudPanel>
      )}
    </div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────── */

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
    <HudPanel className="absolute inset-x-2 bottom-2 z-30 flex max-h-[62%] flex-col md:inset-x-auto md:bottom-20 md:right-16 md:top-3 md:max-h-none md:w-[350px]">
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

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-300">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-orange-500"
      />
      {label}
    </label>
  );
}

/** A point to fly to for any feature (centre of its bounding box). */
function centreOf(f: GeoJSON.Feature): [number, number] {
  const g = f.geometry;
  if (g.type === "Point") return g.coordinates as [number, number];
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, y);
      n = Math.max(n, y);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk("coordinates" in g ? g.coordinates : []);
  return [(w + e) / 2, (s + n) / 2];
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Flame;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1">
      <p className="flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {title}
        {count != null && <span className="text-slate-500">· {count}</span>}
      </p>
      {children}
    </section>
  );
}

function Row({
  color,
  title,
  sub,
  onClick,
}: {
  color: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.05]"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-slate-100">
          {title}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {sub}
        </span>
      </span>
    </button>
  );
}

function NowList({
  storms,
  fires,
  flooding,
  tornadoes,
  warnings,
  onGo,
  onPick,
}: {
  storms: Storm[];
  fires: GeoJSON.Feature[];
  flooding: GeoJSON.Feature[];
  tornadoes: GeoJSON.Feature[];
  warnings: GeoJSON.Feature[];
  onGo: (c: [number, number], z: number) => void;
  onPick: (p: Picked) => void;
}) {
  const bigFires = [...fires]
    .sort((a, b) => (b.properties?.acres ?? 0) - (a.properties?.acres ?? 0))
    .slice(0, 8);
  const rank = (s: string) => ["major", "moderate", "minor"].indexOf(s);
  const rivers = [...flooding]
    .sort((a, b) => rank(a.properties?.status) - rank(b.properties?.status))
    .slice(0, 10);
  const byGroup = ALERT_GROUPS.map((g) => ({
    g,
    n: warnings.filter((f) => f.properties?.group === g.key).length,
  })).filter((x) => x.n);
  const pick = (layer: string, f: GeoJSON.Feature, zoom: number) => {
    const at = centreOf(f);
    onPick({
      layer,
      id: f.properties?.id,
      props: (f.properties ?? {}) as Record<string, unknown>,
      lngLat: at,
    });
    onGo(at, zoom);
  };
  return (
    <div className="space-y-4">
      <Section icon={Wind} title="Tropical systems" count={storms.length}>
        {storms.length ? (
          storms.map((s) => (
            <Row
              key={s.id}
              color="#d946ef"
              title={`${s.kind} ${s.name}`}
              sub={`${s.windMph} mph${s.category ? ` · Cat ${s.category}` : ""}${s.pressureMb ? ` · ${s.pressureMb} mb` : ""}`}
              onClick={() => {
                onPick({
                  layer: "storms",
                  props: { storm: s.id },
                  lngLat: s.center,
                });
                onGo(s.center, 4.6);
              }}
            />
          ))
        ) : (
          <p className="px-2 text-[12px] text-slate-500">
            No active tropical cyclones.
          </p>
        )}
      </Section>
      <Section icon={Siren} title="Active warnings" count={warnings.length}>
        {byGroup.length ? (
          <div className="flex flex-wrap gap-1.5 px-1">
            {byGroup.map(({ g, n }) => (
              <span
                key={g.key}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-200"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: g.color }}
                />{" "}
                {g.label} <span className="font-mono text-slate-400">{n}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="px-2 text-[12px] text-slate-500">
            No major warnings in effect.
          </p>
        )}
      </Section>
      <Section
        icon={Flame}
        title="Largest active wildfires"
        count={fires.length}
      >
        {bigFires.map((f) => (
          <Row
            key={String(f.properties?.id)}
            color="#f97316"
            title={`${f.properties?.name} Fire`}
            sub={`${Number(f.properties?.acres ?? 0).toLocaleString()} ac · ${f.properties?.contained ?? "?"}% contained${f.properties?.state ? ` · ${f.properties.state}` : ""}`}
            onClick={() => pick("fires", f, 9)}
          />
        ))}
        {!bigFires.length && (
          <p className="px-2 text-[12px] text-slate-500">
            No active wildfire perimeters.
          </p>
        )}
      </Section>
      <Section icon={Waves} title="Rivers flooding" count={flooding.length}>
        {rivers.map((f) => (
          <Row
            key={String(f.properties?.id)}
            color={
              FLOOD_LEVELS.find((l) => l.key === f.properties?.status)?.color ??
              "#94a3b8"
            }
            title={`${f.properties?.river ?? "River"} at ${f.properties?.name}`}
            sub={`${f.properties?.status} flooding${f.properties?.state ? ` · ${f.properties.state}` : ""}`}
            onClick={() => pick("gauges", f, 9)}
          />
        ))}
        {!rivers.length && (
          <p className="px-2 text-[12px] text-slate-500">
            No rivers above flood stage.
          </p>
        )}
      </Section>
      <Section
        icon={Activity}
        title="Tornado reports today"
        count={tornadoes.length}
      >
        {tornadoes.slice(0, 8).map((f, i) => (
          <Row
            key={i}
            color="#ef4444"
            title={String(f.properties?.place)}
            sub={`${String(f.properties?.time).slice(0, 2)}:${String(f.properties?.time).slice(2)} UTC${f.properties?.mag ? ` · ${f.properties.mag}` : ""}`}
            onClick={() => pick("reports", f, 9)}
          />
        ))}
        {!tornadoes.length && (
          <p className="px-2 text-[12px] text-slate-500">
            No tornado reports so far today.
          </p>
        )}
      </Section>
    </div>
  );
}
