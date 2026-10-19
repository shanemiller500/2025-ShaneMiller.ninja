"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, History, Waves } from "lucide-react";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import { AtlasDetailImage } from "@/components/atlas/AtlasDetailImage";
import type { Picked } from "@/components/atlas/types";
import type { FaultInfo } from "@/utils/geo/faults";
import { WORLD_FAULT_KINDS } from "./layers";
import { BOUNDARY_CLASS_BLURB, BOUNDARY_CLASS_LABEL, boundaryColor, plateName, type BoundaryClass } from "@/utils/geo/plates";
import { depthColor, mmiRoman, PAGER_TONE, type QuakeAnchor, type QuakeDetail } from "@/utils/geo/quakes";
import { CODE_STYLE, eruptionYear, type VolcanoDetail } from "@/utils/geo/volcanoes";
import { useDetail } from "./useEarthData";
import { DEATH_COLORS, deathRank, deathsText, fmtNceiDate, nceiQuakeUrl, nceiTsunamiUrl, type NceiQuakes, type NceiTsunamis } from "@/utils/geo/ncei";

/* ------------------------------------------------------------------ */
/*  The drawer for whatever was picked on the Earth Alive map.         */
/* ------------------------------------------------------------------ */

export function EarthDetails({
  picked,
  onClose,
  onReplaySequence,
  ncei,
}: {
  picked: Picked | null;
  onClose: () => void;
  onReplaySequence?: (anchor: QuakeAnchor) => void;
  /** NOAA's history tables, once loaded. */
  ncei?: { quakes?: NceiQuakes; tsunamis?: NceiTsunamis };
}) {
  const kind = picked?.layer;
  const p = picked?.props ?? {};

  const quakeUrl = kind === "quakes" && picked?.id ? `/api/atlas/quake/${picked.id}` : null;
  const volcanoUrl = kind === "volcanoes" && p.vnum ? `/api/atlas/volcano/${p.vnum}` : null;
  const quake = useDetail<QuakeDetail>(quakeUrl);
  const volcano = useDetail<VolcanoDetail>(volcanoUrl);

  if (kind === "quakes") {
    const mag = Number(p.mag);
    const depth = Number(p.depth);
    return (
      <FeatureDrawer
        open
        onClose={onClose}
        eyebrow="Earthquake"
        accent={depthColor(depth)}
        title={`M ${mag.toFixed(1)} — ${String(p.place)}`}
        subtitle={`${formatDistanceToNowStrict(Number(p.time), { addSuffix: true })} · ${format(Number(p.time), "PPpp")}`}
      >
        {onReplaySequence && mag >= 5 && (
          <button
            type="button"
            onClick={() =>
              onReplaySequence({
                id: String(picked!.id),
                mag,
                lng: quake.data?.lng ?? picked!.lngLat[0],
                lat: quake.data?.lat ?? picked!.lngLat[1],
                time: Number(p.time),
                place: String(p.place),
              })
            }
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-[13px] font-semibold text-white shadow-[0_0_18px_-6px_rgba(99,102,241,0.8)] transition-colors hover:bg-indigo-600"
          >
            <History className="h-4 w-4" /> Replay its aftershocks
          </button>
        )}
        <QuakeBody base={p} detail={quake.data} loading={quake.loading} error={quake.error} />
      </FeatureDrawer>
    );
  }

  if (kind === "volcanoes") {
    const code = (volcano.data?.code ?? p.code) as keyof typeof CODE_STYLE | null;
    return (
      <FeatureDrawer
        open
        onClose={onClose}
        eyebrow="Volcano"
        accent={code ? CODE_STYLE[code].dot : "#92400e"}
        title={String(p.name)}
        subtitle={[p.type, p.country].filter(Boolean).join(" · ")}
      >
        <VolcanoBody detail={volcano.data} loading={volcano.loading} error={volcano.error} />
      </FeatureDrawer>
    );
  }

  // a fault from the GEM worldwide database
  if (kind === "faults" && p.cat != null) {
    const k = WORLD_FAULT_KINDS.find((x) => x.key === p.kind);
    const rate = p.rate == null || p.rate === "" ? null : Number(p.rate);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Active fault" accent={k?.color ?? "#f97316"} title={p.name ? String(p.name) : "Unnamed fault"} subtitle={k?.label}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Movement", p.slip ? String(p.slip).replace(/_/g, " ") : k?.label ?? null],
              ["Slip rate", rate != null ? `${rate} mm/yr` : "not estimated"],
              ["Mapped by", String(p.cat)],
            ]}
          />
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Thrust faults push rock together, normal faults pull it apart, strike-slip faults slide past each other. Slip rate is the long-term average — how fast the two sides creep apart over thousands of years, not a forecast.
          </p>
          <DrawerLink href="https://github.com/GEMScienceTools/gem-global-active-faults">GEM Global Active Faults Database (CC BY-SA 4.0)</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (kind === "faults") {
    const f = p as unknown as FaultInfo;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Quaternary fault" accent="#f97316" title={f.name} subtitle={f.section ?? f.location ?? undefined}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Last moved", f.age],
              ["Slip rate", f.slipRate ? `${f.slipRate} mm/yr` : null],
              ["Slip sense", f.slipSense],
              ["Dips toward", f.dip],
              ["Length", f.lengthKm ? `${f.lengthKm} km` : null],
              ["Location", f.location],
              ["Mapping", f.certainty],
              ["Reviewed", f.reviewed],
            ]}
          />
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            &ldquo;Last moved&rdquo; is the age of the most recent surface rupture geologists have found — younger faults are generally the bigger hazard.
          </p>
          <div className="space-y-2">
            {f.reportUrl && <DrawerLink href={f.reportUrl}>USGS fault report</DrawerLink>}
            {f.pdfUrl && <DrawerLink href={f.pdfUrl}>Archived report (PDF)</DrawerLink>}
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  if (kind === "history" && ncei?.quakes) {
    const q = ncei.quakes;
    const c = q.cols;
    const i = Number(p.i);
    const deaths = deathsText(c.deaths[i], c.deathsAmt[i], q.amount);
    return (
      <FeatureDrawer
        open
        onClose={onClose}
        eyebrow="Earthquake in history"
        accent={DEATH_COLORS[deathRank(c.deaths[i], c.deathsAmt[i])]}
        title={`${c.mag[i] != null ? `M ${c.mag[i]} — ` : ""}${c.place[i]}`}
        subtitle={fmtNceiDate(c.date[i])}
      >
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Magnitude", c.mag[i] != null ? String(c.mag[i]) : "not measured"],
              ["Depth", c.depth[i] != null ? `${c.depth[i]} km` : null],
              ["Deaths", deaths ?? "not recorded"],
              ["Country", c.country[i] || null],
              ["Tsunami", c.tsunami[i] != null ? "Yes" : null],
            ]}
          />
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            From NOAA&rsquo;s Significant Earthquake Database. Deaths include the tsunami, fires and landslides the quake set off. For old events the magnitude is estimated from written accounts of damage, and positions can be tens of kilometres out.
          </p>
          <div className="space-y-2">
            <DrawerLink href={nceiQuakeUrl(c.id[i])}>NOAA event record</DrawerLink>
            {c.tsunami[i] != null && <DrawerLink href={nceiTsunamiUrl(c.tsunami[i]!)}>The tsunami it caused</DrawerLink>}
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  if (kind === "tsunamis" && ncei?.tsunamis) {
    const t = ncei.tsunamis;
    const c = t.cols;
    const i = Number(p.i);
    const deaths = deathsText(c.deaths[i], c.deathsAmt[i], t.amount);
    return (
      <FeatureDrawer
        open
        onClose={onClose}
        eyebrow="Tsunami"
        accent={DEATH_COLORS[deathRank(c.deaths[i], c.deathsAmt[i])]}
        title={c.place[i] || "Tsunami"}
        subtitle={`${fmtNceiDate(c.date[i])} · ${c.validity[i] >= 4 ? "definite" : "probable"} tsunami`}
      >
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Highest wave", c.height[i] != null ? `${c.height[i]} m` : "not recorded"],
              ["Cause", t.causes[c.cause[i]] ?? null],
              ["Quake magnitude", c.mag[i] != null ? String(c.mag[i]) : null],
              ["Deaths", deaths ?? "not recorded"],
              ["Places it reached", c.runups[i] ? c.runups[i].toLocaleString("en-US") : null],
              ["Country", c.country[i] || null],
            ]}
          />
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            The ring sits where the tsunami started. &ldquo;Highest wave&rdquo; is the greatest water height measured or reported anywhere it came ashore. NOAA&rsquo;s record links every place it reached.
          </p>
          <DrawerLink href={nceiTsunamiUrl(c.id[i])}>NOAA event record &amp; run-ups</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (kind === "plates") {
    const cls = p.cls as BoundaryClass;
    return (
      <FeatureDrawer
        open
        onClose={onClose}
        eyebrow="Plate boundary"
        accent={boundaryColor(cls)}
        title={`${plateName(String(p.a))} ↔ ${plateName(String(p.b))}`}
        subtitle={BOUNDARY_CLASS_LABEL[cls]}
      >
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{BOUNDARY_CLASS_BLURB[cls]}</p>
          <FactGrid
            facts={[
              ["Relative speed", `${p.v} mm/yr`],
              ["That's about", `${(Number(p.v) / 10).toFixed(1)} cm a year`],
              ["Plates", String(p.name)],
              ["Type", BOUNDARY_CLASS_LABEL[cls]],
            ]}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">Speeds are long-term averages from the PB2002 model — roughly how fast fingernails grow.</p>
        </div>
      </FeatureDrawer>
    );
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}

/* ── bodies ──────────────────────────────────────────────────────── */

function QuakeBody({ base, detail, loading, error }: { base: Record<string, unknown>; detail: QuakeDetail | null; loading: boolean; error: string | null }) {
  const alert = detail?.alert ?? (base.alert as string | null);
  const tsunami = detail?.tsunami ?? Number(base.tsunami) === 1;
  return (
    <div className="space-y-4">
      {(alert || tsunami) && (
        <div className="flex flex-wrap gap-2">
          {alert && PAGER_TONE[alert] && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${PAGER_TONE[alert].className}`}>
              <AlertTriangle className="h-3.5 w-3.5" /> PAGER {PAGER_TONE[alert].label}
            </span>
          )}
          {tsunami && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-500/30 dark:text-sky-300">
              <Waves className="h-3.5 w-3.5" /> Tsunami flag
            </span>
          )}
        </div>
      )}

      <FactGrid
        facts={[
          ["Magnitude", `${Number(base.mag).toFixed(1)} ${detail?.magType ?? base.magType ?? ""}`],
          ["Depth", detail ? `${detail.depth} km` : base.depth != null ? `${base.depth} km` : null],
          ["Felt reports", detail?.felt ?? (base.felt as number | null) ?? "None yet"],
          ["Max felt", detail?.cdi ? `${mmiRoman(detail.cdi)} (${detail.cdi.toFixed(1)})` : null],
          ["ShakeMap max", detail?.mmi ? `${mmiRoman(detail.mmi)} (${detail.mmi.toFixed(1)})` : null],
          ["Faulting", detail?.mechanism?.style ?? null],
          ["Status", detail?.status ?? null],
        ]}
      />

      {loading && <p className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-slate-400">Loading USGS products…</p>}
      {error && <p className="text-xs text-rose-500">Couldn&apos;t load the full USGS record ({error}).</p>}

      {alert && (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          PAGER is USGS&apos;s rapid estimate of fatalities and economic loss: green means little expected impact, red means a major disaster is likely.
        </p>
      )}

      {detail?.mechanism && (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Focal mechanism: strike {Math.round(detail.mechanism.strike)}°, dip {Math.round(detail.mechanism.dip)}°, rake {Math.round(detail.mechanism.rake)}° —
          the rock moved as a <strong className="font-semibold text-slate-700 dark:text-slate-200">{detail.mechanism.style.toLowerCase()}</strong> rupture.
        </p>
      )}

      {detail?.shakemap && (
        <AtlasDetailImage
          key={detail.shakemap.image}
          src={detail.shakemap.image}
          alt="USGS ShakeMap intensity"
          caption="ShakeMap — estimated shaking intensity around the epicentre."
          className="w-full rounded-xl border border-slate-200 dark:border-white/10"
        />
      )}

      <div className="space-y-2">
        {(detail?.url ?? base.url) ? <DrawerLink href={String(detail?.url ?? base.url)}>Full USGS event page</DrawerLink> : null}
        {(detail?.url ?? base.url) ? <DrawerLink href={`${String(detail?.url ?? base.url)}/tellus`}>Did you feel it? Report it</DrawerLink> : null}
      </div>
    </div>
  );
}

function VolcanoBody({ detail, loading, error }: { detail: VolcanoDetail | null; loading: boolean; error: string | null }) {
  if (loading) return <p className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-slate-400">Loading Smithsonian profile…</p>;
  if (error || !detail) return <p className="text-xs text-rose-500">Couldn&apos;t load this volcano&apos;s profile{error ? ` (${error})` : ""}.</p>;
  return (
    <div className="space-y-4">
      {detail.erupting && (
        <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-300 ring-1 ring-orange-500/40">
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
          Erupting now{detail.eruptingSince ? ` · since ${formatYmd(detail.eruptingSince)}` : ""}
        </span>
      )}
      {detail.code && (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${CODE_STYLE[detail.code].className}`}>
          <span className="h-2 w-2 rounded-full" style={{ background: CODE_STYLE[detail.code].dot }} />
          USGS {detail.code.toLowerCase()} · {detail.level?.toLowerCase()}
        </span>
      )}
      {detail.photo && (
        <AtlasDetailImage
          key={detail.photo.url}
          src={detail.photo.url}
          alt={`Photo of ${detail.name}`}
          credit={detail.photo.credit}
          className="max-h-52 w-full rounded-xl object-cover"
        />
      )}
      <FactGrid
        facts={[
          ["Last eruption", eruptionYear(detail.lastEruption)],
          ["Elevation", detail.elevation != null ? `${detail.elevation.toLocaleString()} m` : null],
          ["Landform", detail.landform],
          ["Rock", detail.rock],
          ["Setting", detail.tectonic],
          ["Region", detail.subregion || detail.region],
        ]}
      />
      {detail.summary && <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{detail.summary}</p>}
      <div className="space-y-2">
        <DrawerLink href={`https://volcano.si.edu/volcano.cfm?vn=${detail.vnum}`}>Smithsonian GVP profile</DrawerLink>
        {detail.notice && <DrawerLink href={detail.notice.url}>Latest {detail.notice.observatory} notice</DrawerLink>}
      </div>
    </div>
  );
}

/** GVP dates are YYYYMMDD (month/day can be 00 when unknown). */
function formatYmd(ymd: string) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  if (!m) return String(y);
  return format(new Date(y, m - 1, d || 1), d ? "MMM d, yyyy" : "MMM yyyy");
}
