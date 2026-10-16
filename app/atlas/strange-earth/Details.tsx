"use client";

import { useEffect, useState } from "react";
import { Droplets, Mountain, Orbit, ScanSearch } from "lucide-react";
import { createContext, useContext } from "react";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { EID_URL, IMPACT_AGE_STOPS, LANDFORM_CLASSES, formatAge, geologyAt, gnisUrl, strangeCat, type GeoUnit, type ImpactProps, type LandformProps, type StrangeProps } from "@/utils/geo/strange";
import { VERDICTS, anomalyById } from "./featured";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import { LAKE_FACTS, LAKE_SOURCES, lakeLabel, type LakeProps } from "./lakes";

/* ------------------------------------------------------------------ */
/*  Drawers for Strange Earth: an anomaly, an impact crater, an odd    */
/*  place, a GNIS landform, or the bedrock under a click. Every one    */
/*  ends with "the rock under here" from Macrostrat.                   */
/* ------------------------------------------------------------------ */

export interface FlyTarget {
  name: string;
  center: [number, number];
  fly?: { zoom: number; pitch: number; bearing: number };
  anomalyId?: string;
}

const ageColor = (ma: number) => [...IMPACT_AGE_STOPS].reverse().find(([a]) => ma >= a)?.[1] ?? IMPACT_AGE_STOPS[0][1];

function Photo({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />;
}

/** Investigate handler, passed down once instead of through every drawer. */
const InvestigateCtx = createContext<((t: FlyTarget) => void) | null>(null);

/** "Fly over in 3D" + "Investigate" for one target. */
function FlyButton({ onClick, accent = "#e879f9", target }: { onClick: () => void; accent?: string; target: FlyTarget }) {
  const investigate = useContext(InvestigateCtx);
  return (
    <div className="flex gap-2">
      <FlyOnly onClick={onClick} accent={accent} />
      {investigate && (
        <button
          type="button"
          onClick={() => investigate(target)}
          title="Compare satellite, bare-earth lidar, geology and old topo maps of this spot"
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-3 py-2.5 text-[13px] font-semibold text-slate-200 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white"
        >
          <ScanSearch className="h-4 w-4" /> Investigate
        </button>
      )}
    </div>
  );
}

function FlyOnly({ onClick, accent }: { onClick: () => void; accent: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
      style={{ borderColor: `${accent}80`, background: `${accent}22`, boxShadow: `0 0 22px -6px ${accent}` }}
    >
      <Orbit className="h-4 w-4" /> Fly over in 3D
    </button>
  );
}

/** "What rock is under here?" — Macrostrat's most detailed mapped unit at the point. */
export function RockReadout({ at, unit: given }: { at: [number, number]; unit?: GeoUnit }) {
  const [unit, setUnit] = useState<GeoUnit | null | undefined>(given);
  useEffect(() => {
    if (given) return setUnit(given);
    setUnit(undefined);
    const ctl = new AbortController();
    geologyAt(at[0], at[1], ctl.signal)
      .then(setUnit)
      .catch(() => !ctl.signal.aborted && setUnit(null));
    return () => ctl.abort();
  }, [at, given]);

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-fuchsia-200/80">
        <Mountain className="h-3.5 w-3.5" /> The rock under here
      </p>
      {unit === undefined && <p className="mt-2 animate-pulse font-mono text-[11px] text-slate-400">Reading the geologic map…</p>}
      {unit === null && <p className="mt-2 text-[12px] text-slate-400">No mapped bedrock at this exact spot (water, or a gap in the maps).</p>}
      {unit && (
        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-2.5">
            <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded" style={{ background: unit.color }} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-white">{unit.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {unit.period}
                {!unit.bAge ? "" : unit.tAge < 0.012 ? ` · up to ${formatAge(unit.bAge)} old` : ` · ${formatAge(unit.tAge)} – ${formatAge(unit.bAge)} old`.replace(/ years – /, " – ")}
              </p>
            </div>
          </div>
          {unit.strat && <p className="text-[12px] text-slate-300">{unit.strat}</p>}
          {unit.lith && <p className="text-[12px] text-slate-400">Rock types: {unit.lith}</p>}
          {unit.desc && <p className="line-clamp-4 text-[12px] leading-relaxed text-slate-300">{unit.desc}</p>}
          <p className="text-[10px] leading-snug text-slate-500">
            Macrostrat (CC-BY 4.0){unit.ref ? ` · ${unit.ref.split(/[.;]/)[0]}` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

export function StrangeDetails({
  onInvestigate,
  ...rest
}: {
  picked: Picked | null;
  onClose: () => void;
  onFly: (t: FlyTarget) => void;
  onInvestigate?: (t: FlyTarget) => void;
  onRefill?: (lakeId: number) => void;
}) {
  return (
    <InvestigateCtx.Provider value={onInvestigate ?? null}>
      <Drawers {...rest} />
    </InvestigateCtx.Provider>
  );
}

function Drawers({ picked, onClose, onFly, onRefill }: { picked: Picked | null; onClose: () => void; onFly: (t: FlyTarget) => void; onRefill?: (lakeId: number) => void }) {
  const anomaly = picked?.layer === "anomalies" ? anomalyById(String(picked.props.id)) : undefined;
  const impact = picked?.layer === "impacts" ? (picked.props as unknown as ImpactProps) : undefined;
  const place = picked?.layer === "places" ? (picked.props as unknown as StrangeProps) : undefined;
  const wikiTitle = anomaly?.wiki ?? (impact && !impact.image && impact.wiki ? decodeURIComponent(impact.wiki.split("/wiki/")[1] ?? "") : null);
  const wikiPhoto = useWikiPhoto(wikiTitle || null);

  if (anomaly) {
    const v = VERDICTS[anomaly.verdict];
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Featured anomaly" accent={anomaly.accent} title={anomaly.name} subtitle={anomaly.where}>
        <div className="space-y-4">
          <Photo src={wikiPhoto} alt={anomaly.name} />
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ring-1" style={{ color: v.color, background: `${v.color}1f`, boxShadow: `inset 0 0 0 1px ${v.color}55` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.color }} /> {v.label}
          </span>
          <p className="text-[14px] font-semibold leading-snug text-white">{anomaly.tagline}</p>
          <ul className="space-y-2">
            {anomaly.facts.map((f) => (
              <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: anomaly.accent }} />
                <span>
                  {f.text}{" "}
                  <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-fuchsia-300/70 hover:text-fuchsia-200">
                    ↗ {f.source.label}
                  </a>
                </span>
              </li>
            ))}
          </ul>
          <FlyButton accent={anomaly.accent} target={{ name: anomaly.name, center: anomaly.center, fly: anomaly.fly, anomalyId: anomaly.id }} onClick={() => onFly({ name: anomaly.name, center: anomaly.center, fly: anomaly.fly, anomalyId: anomaly.id })} />
          <RockReadout at={anomaly.center} />
          <DrawerLink href={`https://en.wikipedia.org/wiki/${anomaly.wiki}`}>Wikipedia</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (impact) {
    const ma = Number(impact.ageMa);
    const km = Number(impact.diameterKm);
    const color = ageColor(ma);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Confirmed impact structure" accent={color} title={impact.name} subtitle={[impact.location, impact.country].filter(Boolean).join(", ")}>
        <div className="space-y-4">
          <Photo src={impact.image || wikiPhoto} alt={impact.name} />
          <FactGrid
            facts={[
              ["Diameter", `${km.toLocaleString()} km (${(km * 0.621).toLocaleString(undefined, { maximumFractionDigits: km < 10 ? 1 : 0 })} mi)`],
              ["Age", formatAge(ma)],
              ["As published", impact.ageText],
              ["Country", impact.country],
            ]}
          />
          <p className="text-[12px] leading-relaxed text-slate-400">
            Confirmed by evidence only an impact makes — shocked quartz, shatter cones, melted rock. The ring on the map is drawn at its true size; erosion or burial may hide it at the surface.
          </p>
          <FlyButton accent={color} target={{ name: impact.name, center: picked!.lngLat, fly: { zoom: Math.max(6, Math.min(14.5, 14.2 - Math.log2(Math.max(km, 0.3)))), pitch: 58, bearing: 25 } }} onClick={() => onFly({ name: impact.name, center: picked!.lngLat, fly: { zoom: Math.max(6, Math.min(14.5, 14.2 - Math.log2(Math.max(km, 0.3)))), pitch: 58, bearing: 25 } })} />
          <RockReadout at={picked!.lngLat} />
          <div className="space-y-2">
            {impact.wiki && <DrawerLink href={impact.wiki}>Wikipedia</DrawerLink>}
            <DrawerLink href={EID_URL}>Earth Impact Database (PASSC)</DrawerLink>
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  if (place) {
    const cat = strangeCat(place.cat);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={cat.label} accent={cat.color} title={place.name} subtitle={place.state ?? undefined}>
        <div className="space-y-4">
          <Photo src={place.image} alt={place.name} />
          {place.desc && <p className="text-[13px] leading-relaxed text-slate-300">{place.desc.charAt(0).toUpperCase() + place.desc.slice(1)}</p>}
          <FlyButton accent={cat.color} target={{ name: place.name, center: picked!.lngLat, fly: { zoom: place.cat === "lakebed" || place.cat === "volcanic" || place.cat === "dune" ? 12 : 14.6, pitch: 62, bearing: 30 } }} onClick={() => onFly({ name: place.name, center: picked!.lngLat, fly: { zoom: place.cat === "lakebed" || place.cat === "volcanic" || place.cat === "dune" ? 12 : 14.6, pitch: 62, bearing: 30 } })} />
          <RockReadout at={picked!.lngLat} />
          <div className="space-y-2">
            {place.wiki && <DrawerLink href={place.wiki}>Wikipedia</DrawerLink>}
            <DrawerLink href={`https://www.wikidata.org/wiki/${place.id}`}>Wikidata record</DrawerLink>
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "lakes") {
    const p = picked.props as unknown as LakeProps;
    const facts = p.name ? LAKE_FACTS[p.name] : undefined;
    const area = Number(p.areaKm2);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Ice Age lake" accent="#38bdf8" title={lakeLabel(p)} subtitle="Great Basin · late Pleistocene">
        <div className="space-y-4">
          {facts && <p className="text-[14px] font-semibold leading-snug text-white">{facts.tagline}</p>}
          <FactGrid
            facts={[
              ["Mapped extent", `${area.toLocaleString()} km² · ${Math.round(area / 2.58999).toLocaleString()} sq mi`],
            ]}
          />
          {facts ? (
            <ul className="space-y-2">
              {facts.facts.map((f) => (
                <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sky-300" />
                  <span>
                    {f.text}{" "}
                    <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-sky-300/70 hover:text-sky-200">
                      ↗ {f.source.label.split(" ")[0]}
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-300">
              One of the lakes that filled the Great Basin&apos;s closed valleys late in the last Ice Age, outlined from the shorelines it left behind.
            </p>
          )}
          {onRefill && (
            <button
              type="button"
              onClick={() => onRefill(Number(p.id))}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/50 bg-sky-400/15 px-3 py-2.5 text-[13px] font-semibold text-sky-50 shadow-[0_0_22px_-6px_rgba(56,189,248,0.9)] transition-colors hover:bg-sky-400/25"
            >
              <Droplets className="h-4 w-4" /> Refill it in 3D
            </button>
          )}
          <RockReadout at={picked.lngLat} />
          <DrawerLink href={LAKE_SOURCES.layer.url}>Lake outlines (after Mifflin &amp; Wheat 1979)</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "landforms") {
    const p = picked.props as unknown as LandformProps;
    const cls = LANDFORM_CLASSES.find((c) => c.key === p.cls) ?? LANDFORM_CLASSES[0];
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`GNIS · ${cls.label}`} accent={cls.color} title={p.name} subtitle={p.state ?? undefined}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            An official U.S. place name for a {cls.label.toLowerCase()}.
            {p.cls === "crater" && " GNIS doesn't say how a crater formed — most are volcanic. The confirmed impact craters are the glowing rings."}
          </p>
          <FlyButton accent={cls.color} target={{ name: p.name, center: picked.lngLat, fly: { zoom: 15, pitch: 62, bearing: 20 } }} onClick={() => onFly({ name: p.name, center: picked.lngLat, fly: { zoom: 15, pitch: 62, bearing: 20 } })} />
          <RockReadout at={picked.lngLat} />
          <DrawerLink href={gnisUrl(p.gnis)}>USGS GNIS record</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "geology") {
    const unit = picked.props as unknown as GeoUnit;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Bedrock geology" accent={unit.color} title={unit.name || "Mapped rock unit"} subtitle={`${picked.lngLat[1].toFixed(3)}°, ${picked.lngLat[0].toFixed(3)}°`}>
        <div className="space-y-4">
          <RockReadout key={picked.lngLat.join(",")} at={picked.lngLat} unit={unit} />
          <FlyButton
            accent="#e879f9"
            target={{ name: unit.name || "This spot", center: picked.lngLat, fly: { zoom: 13, pitch: 60, bearing: 20 } }}
            onClick={() => onFly({ name: unit.name || "This spot", center: picked.lngLat, fly: { zoom: 13, pitch: 60, bearing: 20 } })}
          />
          <DrawerLink href={`https://macrostrat.org/map/loc/${picked.lngLat[0].toFixed(4)}/${picked.lngLat[1].toFixed(4)}`}>Open in Macrostrat</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}
