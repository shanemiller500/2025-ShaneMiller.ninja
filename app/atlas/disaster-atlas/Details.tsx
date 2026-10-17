"use client";

import { useEffect, useMemo, useState } from "react";
import { ImpactPanel } from "@/components/atlas/ImpactPanel";
import type { AreaGeometry } from "@/utils/geo/impact";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { CAT_COLORS, EF_COLORS, FIPS_ALIASES, ktToMph, tornadoAt, type CountyDeclarations, type HurdatStorm, type TornadoCols } from "./history";
import { FLOOD_LEVELS, NRI_URL, REPORT_KINDS, RISK_RATINGS, WORLD_ALERT_LEVELS, alertGroup, worldEventType, compass, countyAt, money, riskColor, type CountyRisk, type Storm } from "@/utils/geo/hazards";

/* ------------------------------------------------------------------ */
/*  Drawers for the Disaster Atlas: a warning, a fire, a hotspot, a    */
/*  storm, a storm report, a flooding river — and for any spot, the    */
/*  county's FEMA risk profile ("what's at risk here").                */
/* ------------------------------------------------------------------ */

let nriPromise: Promise<GeoJSON.FeatureCollection> | null = null;
/** The county risk file (~2 MB) — loaded once, on first need. */
export const loadNri = () => (nriPromise ??= fetch(NRI_URL).then((r) => r.json()));

const when = (v: unknown) => {
  if (v == null || v === "") return null;
  const d = new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
};
const forecastLink = ([lng, lat]: [number, number]) => `https://forecast.weather.gov/MapClick.php?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

function RiskBar({ label, rating }: { label: string; rating: string | null }) {
  const i = RISK_RATINGS.findIndex((r) => r.key === rating);
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-24 shrink-0 text-slate-400">{label}</span>
      <span className="flex h-2 flex-1 gap-0.5">
        {RISK_RATINGS.map((r, k) => (
          <span key={r.key} className="flex-1 rounded-sm" style={{ background: k <= i ? riskColor(rating) : "rgba(255,255,255,0.08)" }} />
        ))}
      </span>
      <span className="w-28 shrink-0 text-right text-slate-200">{rating ?? "—"}</span>
    </div>
  );
}

export function CountyRiskPanel({ c }: { c: CountyRisk }) {
  return (
    <div className="space-y-3">
      <FactGrid
        facts={[
          ["People", c.pop ? c.pop.toLocaleString() : null],
          ["Building value", c.bldg ? money(c.bldg) : null],
          ["Expected loss / yr", c.eal ? money(c.eal) : null],
          ["Risk score", c.score != null ? `${c.score} / 100` : null],
        ]}
      />
      <div className="space-y-1.5">
        <RiskBar label="Overall risk" rating={c.risk} />
        <RiskBar label="Hurricane" rating={c.hrcn} />
        <RiskBar label="Tornado" rating={c.trnd} />
        <RiskBar label="Wildfire" rating={c.wfir} />
        <RiskBar label="Inland flood" rating={c.ifld} />
        <RiskBar label="Coastal flood" rating={c.cfld} />
      </div>
      <FactGrid
        facts={[
          ["Social vulnerability", c.sovi],
          ["Community resilience", c.resl],
        ]}
      />
      <p className="text-[11px] leading-snug text-slate-500">
        FEMA combines the losses a county can expect each year with how socially vulnerable its people are and how resilient the community is, then ranks it against every other U.S. county.
      </p>
    </div>
  );
}

function PlaceDrawer({ picked, onClose }: { picked: Picked; onClose: () => void }) {
  const [county, setCounty] = useState<CountyRisk | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setCounty(undefined);
    loadNri()
      .then((fc) => live && setCounty(countyAt(fc, picked.lngLat)))
      .catch(() => live && setCounty(null));
    return () => {
      live = false;
    };
  }, [picked.lngLat]);
  return (
    <FeatureDrawer
      open
      onClose={onClose}
      eyebrow="What's at risk here"
      accent={riskColor(county?.risk ?? null)}
      title={county ? `${county.name}, ${county.state}` : county === null ? "Outside the U.S." : "Looking up the county…"}
      subtitle={`${picked.lngLat[1].toFixed(3)}°, ${picked.lngLat[0].toFixed(3)}°`}
    >
      <div className="space-y-4">
        {county === undefined && <p className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-orange-200/70">Reading FEMA&apos;s National Risk Index…</p>}
        {county && <CountyRiskPanel c={county} />}
        {county === null && (
          <p className="text-[13px] leading-relaxed text-slate-400">
            The county-by-county risk scores here are FEMA&apos;s and cover the U.S. only. Anywhere on Earth, the coloured dots show disasters happening now (from GDACS) and the yellow specks are satellite fire detections — click one for details.
          </p>
        )}
        <div className="space-y-2">
          {county === null ? (
            <DrawerLink href="https://www.gdacs.org/">GDACS — disasters worldwide</DrawerLink>
          ) : (
            <>
              <DrawerLink href={forecastLink(picked.lngLat)}>NWS forecast &amp; active alerts for this spot</DrawerLink>
              <DrawerLink href="https://hazards.fema.gov/nri/map">FEMA National Risk Index map</DrawerLink>
            </>
          )}
        </div>
      </div>
    </FeatureDrawer>
  );
}

export interface HistoryLookups {
  storms: HurdatStorm[] | null;
  tornadoes: TornadoCols | null;
  declarations: Record<string, CountyDeclarations> | null;
}

const SCALE = ["Tropical storm / depression", "Category 1", "Category 2", "Category 3", "Category 4", "Category 5"];

export function DisasterDetails({
  picked,
  storms,
  history,
  geometryFor,
  onClose,
}: {
  picked: Picked | null;
  storms: Storm[];
  history?: HistoryLookups;
  /** the full area of a picked fire / warning / cone / tornado path, for the impact counts */
  geometryFor?: (p: Picked) => AreaGeometry | null;
  onClose: () => void;
}) {
  // memoised so the impact query runs once per pick
  const area = useMemo(() => (picked && geometryFor ? geometryFor(picked) : null), [picked, geometryFor]);
  if (!picked) return <FeatureDrawer open={false} onClose={onClose} />;
  const p = picked.props as Record<string, unknown>;

  if (picked.layer === "hist-hurricanes") {
    const st = history?.storms?.find((x) => x.id === p.id);
    if (!st) return <FeatureDrawer open={false} onClose={onClose} />;
    const end = st.start + st.pts[st.pts.length - 1][0] * 3_600_000;
    const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`${st.basin === "AL" ? "Atlantic" : "Eastern Pacific"} · ${st.year}`} accent={CAT_COLORS[st.cat]} title={st.name ? `${st.cat ? "Hurricane" : "Storm"} ${st.name}` : `Unnamed storm of ${st.year}`} subtitle={`${day(st.start)} – ${day(end)}`}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Peak strength", SCALE[st.cat]],
              ["Peak wind", `${ktToMph(st.maxWind)} mph (${st.maxWind} kt)`],
              ["Lowest pressure", st.minPres ? `${st.minPres} mb` : "not recorded"],
              ["Landfalls", st.landfalls ? String(st.landfalls) : "none recorded"],
              ["Lifetime", `${Math.round((end - st.start) / 86_400_000)} days`],
              ["Track fixes", String(st.pts.length)],
            ]}
          />
          <p className="text-[11px] leading-snug text-slate-500">
            NOAA&apos;s best-track (HURDAT2) values: re-analysed after the season, so they can differ from what was reported at the time. Early records (before aircraft and satellites) are less certain.
          </p>
          <DrawerLink href={`https://www.nhc.noaa.gov/data/tcr/index.php?season=${st.year}&basin=${st.basin === "AL" ? "atl" : "epac"}`}>NHC storm reports for {st.year}</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "hist-tornadoes") {
    const c = history?.tornadoes;
    const i = Number(p.i ?? picked.id);
    if (!c || !Number.isFinite(i) || c.yr[i] === undefined) return <FeatureDrawer open={false} onClose={onClose} />;
    const t = tornadoAt(c, i);
    const scale = t.year >= 2007 ? "EF" : "F";
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`Tornado · ${t.state}`} accent={EF_COLORS[t.mag] ?? "#94a3b8"} title={t.mag >= 0 ? `${scale}${t.mag} tornado` : "Tornado (unrated)"} subtitle={`${t.date} · ${t.time}`}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Deaths", t.fat.toLocaleString()],
              ["Injuries", t.inj.toLocaleString()],
              ["Path length", t.len ? `${t.len} mi` : null],
              ["Path width", t.wid ? `${t.wid.toLocaleString()} yd` : null],
            ]}
          />
          <p className="text-[11px] leading-snug text-slate-500">
            {t.year < 2007 ? "Rated on the original Fujita scale (EF replaced it in 2007). " : ""}The map draws a straight line from touchdown to lift-off; real paths curve.
          </p>
          {area && (
            <ImpactPanel
              geometry={area}
              accent={EF_COLORS[t.mag] ?? "#f97316"}
              framing={`Standing in this path today (${t.wid ? `${t.wid.toLocaleString()} yd wide` : "width not recorded"})`}
              caveat="The record keeps only where the tornado touched down and lifted, so this straight corridor can miss where the track curved — treat it as a rough guide."
            />
          )}
          <DrawerLink href="https://www.spc.noaa.gov/wcm/">NOAA SPC Severe Weather Database</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "hist-fires") {
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`Wildfire · ${p.year}`} accent="#ea580c" title={String(p.name)} subtitle={p.agency ? `Mapped by ${p.agency}` : undefined}>
        <div className="space-y-4">
          <FactGrid facts={[["Burned area", `${Number(p.acres).toLocaleString()} acres`], ["Square miles", (Number(p.acres) / 640).toLocaleString(undefined, { maximumFractionDigits: 0 })]]} />
          {area && <ImpactPanel geometry={area} accent="#ea580c" framing="Inside this burn scar today — buildings standing now, not what burned" />}
          <DrawerLink href="https://data-nifc.opendata.arcgis.com/">NIFC fire perimeter history</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "declarations") {
    const d = history?.declarations?.[String(p.id)] ?? history?.declarations?.[FIPS_ALIASES[String(p.id)]];
    const types = d ? Object.entries(d.t).sort((a, b) => b[1] - a[1]) : [];
    const max = types[0]?.[1] ?? 1;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="FEMA disaster declarations" accent="#ea580c" title={`${p.name}, ${p.state}`} subtitle={d ? `${d.n} federal declarations since 1953` : p.state === "CT" ? "FEMA's records use Connecticut's old counties, which became planning regions in 2022" : "No county-level declarations on record"}>
        <div className="space-y-4">
          {types.length > 0 && (
            <ul className="space-y-1.5">
              {types.slice(0, 8).map(([k, n]) => (
                <li key={k} className="flex items-center gap-2 text-[12px]">
                  <span className="w-28 shrink-0 truncate text-slate-300">{k}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right font-mono text-slate-200">{n}</span>
                </li>
              ))}
            </ul>
          )}
          {d && d.last.length > 0 && (
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Most recent</p>
              {d.last.map(([year, type, title, num, kind]) => (
                <a key={num} href={`https://www.fema.gov/disaster/${num}`} target="_blank" rel="noopener noreferrer" className="block rounded-lg px-2 py-1 text-[12px] text-slate-300 hover:bg-white/5 hover:text-white">
                  <span className="font-mono text-slate-500">{year}</span> · {title} <span className="text-slate-500">({type}, {kind})</span>
                </a>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-500">DR = major disaster, EM = emergency, FM = fire management assistance. Statewide declarations aren&apos;t counted per county.</p>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "place") return <PlaceDrawer key={picked.lngLat.join(",")} picked={picked} onClose={onClose} />;

  if (picked.layer === "risk") {
    const c = p as unknown as CountyRisk;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="FEMA National Risk Index" accent={riskColor(c.risk)} title={`${c.name}, ${c.state}`} subtitle={`${c.risk ?? "No rating"} overall risk`}>
        <div className="space-y-4">
          <CountyRiskPanel c={{ ...c, pop: Number(c.pop), bldg: Number(c.bldg), eal: Number(c.eal), score: c.score == null ? null : Number(c.score) }} />
          <DrawerLink href="https://hazards.fema.gov/nri/map">FEMA National Risk Index map</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "alerts") {
    const g = alertGroup(String(p.group));
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={p.watch === true || p.watch === "true" ? "NWS watch" : "NWS warning"} accent={g.color} title={String(p.product)} subtitle={p.wfo ? `Issued by NWS ${String(p.wfo).replace(/^K/, "")}` : undefined}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Issued", when(p.issued)],
              ["Expires", when(p.expires)],
            ]}
          />
          <p className="text-[12px] leading-snug text-slate-400">
            {p.watch === true || p.watch === "true"
              ? "A watch means conditions are favourable for this hazard — be ready."
              : "A warning means the hazard is happening or about to — act now."}{" "}
            Always follow your local National Weather Service office and emergency officials.
          </p>
          {area && <ImpactPanel geometry={area} accent={g.color} framing={`Inside this ${p.watch === true || p.watch === "true" ? "watch" : "warning"} area right now`} />}
          <DrawerLink href={forecastLink(picked.lngLat)}>Full alert text &amp; forecast for this spot</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "fires") {
    const contained = p.contained == null ? null : Number(p.contained);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={String(p.type ?? "Wildfire")} accent={contained != null && contained >= 100 ? "#a8a29e" : "#f97316"} title={`${String(p.name)} Fire`} subtitle={p.state ? String(p.state) : undefined}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Mapped area", `${Number(p.acres).toLocaleString()} acres`],
              ["Contained", contained != null ? `${contained}%` : "not reported"],
              ["Discovered", when(p.discovered)],
              ["Cause", p.cause ? String(p.cause) : null],
              ["Personnel", p.personnel ? Number(p.personnel).toLocaleString() : null],
              ["Perimeter updated", when(p.updated)],
            ]}
          />
          {contained != null && contained < 100 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-orange-500 to-emerald-400" style={{ width: `${Math.max(2, contained)}%` }} />
            </div>
          )}
          {area && <ImpactPanel geometry={area} accent="#f97316" framing="Inside the mapped fire perimeter" caveat="Buildings already lost may still appear: the footprint map isn't updated during a fire." />}
          <DrawerLink href={`https://inciweb.wildfire.gov/`}>InciWeb — official incident updates</DrawerLink>
          <DrawerLink href={forecastLink(picked.lngLat)}>Fire weather &amp; alerts here (NWS)</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "world") {
    const t = worldEventType(String(p.type));
    const level = WORLD_ALERT_LEVELS.find((l) => l.key === p.level);
    const fmt = (v: unknown) => (v ? new Date(`${String(v)}Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`${t.label} · worldwide`} accent={level?.color ?? t.color} title={String(p.name ?? t.label)} subtitle={p.country ? String(p.country) : undefined}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Alert", level?.label ?? String(p.level ?? "")],
              ["Strength", p.severity ? String(p.severity) : null],
              ["Since", fmt(p.from)],
              ["Last update", fmt(p.to)],
              ["Reported by", p.source ? String(p.source) : null],
            ]}
          />
          <p className="text-[12px] leading-snug text-slate-400">
            GDACS — run by the United Nations and the European Commission — rates each event by the harm to people it is likely to cause, combining its size with how many people live in its path and how vulnerable they are.
          </p>
          {p.report ? <DrawerLink href={String(p.report)}>GDACS event report</DrawerLink> : null}
          <DrawerLink href="https://www.gdacs.org/">GDACS — Global Disaster Alert and Coordination System</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "hotspots") {
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Satellite fire detection" accent="#fde047" title={`${p.frp ?? "?"} MW of fire radiative power`} subtitle={String(p.when ?? "").replace("T", " ")}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Seen", p.day === true || p.day === "true" ? "Daytime pass" : "Night-time pass"],
              ["Confidence", p.conf ? String(p.conf) : null],
            ]}
          />
          <p className="text-[12px] leading-snug text-slate-400">
            The VIIRS sensor on the NOAA-20 satellite flagged this ~375 m pixel as unusually hot. Most detections are fires; some are gas flares, volcanoes or industrial heat. Radiative power hints at how intensely it was burning, not how big the fire is.
          </p>
          <DrawerLink href="https://firms.modaps.eosdis.nasa.gov/map/">NASA FIRMS fire map</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "storms") {
    const s = storms.find((x) => x.id === p.storm) ?? null;
    if (!s) return <FeatureDrawer open={false} onClose={onClose} />;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={s.category ? `Category ${s.category} hurricane` : s.kind} accent="#d946ef" title={`${s.kind} ${s.name}`} subtitle={`Updated ${when(s.updated)}`}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Max sustained wind", `${s.windMph} mph (${s.windKt} kt)`],
              ["Pressure", s.pressureMb ? `${s.pressureMb} mb` : null],
              ["Moving", s.movement.mph ? `${compass(s.movement.dir)} at ${s.movement.mph} mph` : "stationary"],
              ["Centre", `${Math.abs(s.center[1]).toFixed(1)}°${s.center[1] >= 0 ? "N" : "S"} ${Math.abs(s.center[0]).toFixed(1)}°${s.center[0] >= 0 ? "E" : "W"}`],
            ]}
          />
          <p className="text-[12px] leading-snug text-slate-400">
            The white cone shows where the storm&apos;s <em>centre</em> will probably track — not how big the storm is. Dangerous wind, surge and rain often reach far outside it.
          </p>
          {area && <ImpactPanel geometry={area} accent="#d946ef" framing="Inside the forecast cone (U.S. land only)" caveat="People outside the cone can be hit too — the cone is about the centre's track, not the storm's reach." />}
          {s.advisory && <DrawerLink href={s.advisory.url}>NHC public advisory #{s.advisory.number}</DrawerLink>}
          <DrawerLink href="https://www.nhc.noaa.gov/aboutcone.shtml">About the cone of uncertainty (NHC)</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "reports") {
    const k = REPORT_KINDS.find((x) => x.key === p.kind) ?? REPORT_KINDS[0];
    const mag = p.mag ? String(p.mag) : null;
    const magText = !mag ? null : k.key === "hail" ? `${(Number(mag) / 100).toFixed(2)}-inch hail` : k.key === "wind" ? `${mag} mph gust` : mag;
    const t = String(p.time ?? "");
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`${k.label} report · ${p.day}`} accent={k.color} title={String(p.place)} subtitle={`${t.slice(0, 2)}:${t.slice(2)} UTC · preliminary`}>
        <div className="space-y-4">
          {magText && <FactGrid facts={[["Reported", magText]]} />}
          {p.comments ? <p className="text-[13px] leading-relaxed text-slate-300">“{String(p.comments)}”</p> : null}
          <p className="text-[11px] text-slate-500">Storm reports are preliminary — from spotters, emergency managers and the public — and are checked later by the NWS.</p>
          <DrawerLink href="https://www.spc.noaa.gov/climo/reports/today.html">SPC storm reports</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "gauges") {
    const lvl = FLOOD_LEVELS.find((l) => l.key === p.status) ?? FLOOD_LEVELS[0];
    const unit = String(p.units ?? "ft");
    const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : `${Number(v).toFixed(1)} ${unit}`);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={lvl.label} accent={lvl.color} title={`${String(p.river ?? "River")}`} subtitle={`at ${String(p.name ?? "")}${p.state ? `, ${p.state}` : ""}`}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Now", num(p.observed)],
              ["Flood stage", num(p.floodStage)],
              ["Moderate", num(p.moderateStage)],
              ["Major", num(p.majorStage)],
              ["Observed", p.time ? String(p.time) : null],
            ]}
          />
          {p.url ? <DrawerLink href={String(p.url)}>Hydrograph &amp; forecast (NWS)</DrawerLink> : null}
        </div>
      </FeatureDrawer>
    );
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}
