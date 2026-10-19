"use client";

import { useEffect, useState } from "react";
import { Box, MapPinOff, Ticket } from "lucide-react";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { caveKind, type CaveProps } from "@/utils/geo/caves";
import { karstClass, karstUnitAt, type KarstClass, type KarstUnit } from "@/utils/geo/karst";
import { featuredById } from "./featured";
import { AQUIFER_COLORS, SINK_COLORS } from "./layers";

/* ------------------------------------------------------------------ */
/*  Drawers for Underground World: a cave, or the karst under a click. */
/* ------------------------------------------------------------------ */

/** queryRenderedFeatures flattens arrays to JSON strings — undo that. */
const asList = (v: unknown): string[] => {
  if (Array.isArray(v)) return v as string[];
  try {
    const parsed = JSON.parse(String(v ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export function UndergroundDetails({ picked, onClose, onDive }: { picked: Picked | null; onClose: () => void; onDive: (cave: CaveProps) => void }) {
  // a cave entrance from OpenStreetMap
  if (picked?.layer === "caves" && picked.props.osm != null) {
    const p = picked.props as Record<string, unknown>;
    const [lng, lat] = picked.lngLat;
    const show = String(p.show) === "true";
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Cave entrance · OpenStreetMap" accent={show ? "#22d3ee" : "#e2e8f0"} title={p.name ? String(p.name) : "Cave entrance"} subtitle={`${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Elevation", p.ele != null && p.ele !== "" ? `${Math.round(Number(p.ele))} m` : null],
              ["Access", p.access ? String(p.access) : "not tagged"],
              ["Fee", p.fee ? String(p.fee) : null],
            ]}
          />
          <p className="text-[12px] leading-snug text-slate-400">
            Mapped by OpenStreetMap volunteers. Many caves are on private land, closed to protect bats or simply dangerous — only enter with permission, a guide or a caving club.
          </p>
          {p.wikidata ? <DrawerLink href={`https://www.wikidata.org/wiki/${String(p.wikidata)}`}>Wikidata</DrawerLink> : null}
          <DrawerLink href={`https://www.openstreetmap.org/node/${String(p.osm)}`}>OpenStreetMap (© contributors, ODbL)</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }
  if (picked?.layer === "caves") {
    const p = picked.props as unknown as CaveProps;
    const cave: CaveProps = { ...p, areas: asList(p.areas), tour: String(p.tour) === "true" || p.tour === true, generalized: String(p.generalized) === "true" || p.generalized === true };
    const featured = featuredById(cave.id);
    const kind = caveKind(cave.kind);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={kind.label} accent={featured?.accent ?? kind.color} title={cave.name} subtitle={featured?.where ?? [cave.state, cave.desc].filter(Boolean).join(" · ")}>
        <div className="space-y-4">
          {cave.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cave.image} alt={cave.name} loading="lazy" className="max-h-52 w-full rounded-xl object-cover" />
          )}
          <div className="flex flex-wrap gap-2">
            {cave.tour && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/15 px-2.5 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-300/40">
                <Ticket className="h-3.5 w-3.5" /> Open to visitors
              </span>
            )}
            {cave.generalized && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-400/15 px-2.5 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-300/40">
                <MapPinOff className="h-3.5 w-3.5" /> Location generalized (~10 km)
              </span>
            )}
          </div>

          {featured ? (
            <>
              <p className="text-[14px] font-semibold text-white">{featured.tagline}</p>
              <ul className="space-y-2">
                {featured.facts.map((f) => (
                  <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: featured.accent }} />
                    <span>
                      {f.text}{" "}
                      <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-cyan-300/70 hover:text-cyan-200">
                        ↗ {f.source.label}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            cave.desc && <p className="text-[13px] leading-relaxed text-slate-300">{cave.desc}</p>
          )}

          <FactGrid
            facts={[
              ["Where", cave.state],
              ["Mapped length", cave.lengthKm ? `${cave.lengthKm.toLocaleString()} km` : null],
              ["Depth", cave.depthM ? `${cave.depthM} m` : null],
              ["Protected area", cave.areas[0] ?? null],
            ]}
          />

          {cave.tour && (
            <button
              type="button"
              onClick={() => onDive(cave)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/50 bg-cyan-400/15 px-3 py-2.5 text-[13px] font-semibold text-cyan-100 shadow-[0_0_22px_-6px_rgba(34,211,238,0.9)] transition-colors hover:bg-cyan-400/25"
            >
              <Box className="h-4 w-4" /> Dive inside in 3D
            </button>
          )}
          {cave.generalized && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              Wild and closed caves are fragile and federally protected; the atlas only shows roughly where they are, never the entrance.
            </p>
          )}

          <div className="space-y-2">
            {featured && <DrawerLink href={featured.site.url}>{featured.site.label}</DrawerLink>}
            {cave.wiki && <DrawerLink href={cave.wiki}>Wikipedia</DrawerLink>}
            <DrawerLink href={`https://www.wikidata.org/wiki/${cave.id}`}>Wikidata record</DrawerLink>
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "sinkholes" && picked.props.verified != null) {
    const p = picked.props as { ref: string | null; date: number | null; verified: "Y" | "N" | "U"; county: string | null; accuracy: string | null; lengthFt: number | null; widthFt: number | null; depthFt: number | null; damage: string | null; notes: string | null };
    const label = p.verified === "Y" ? "Confirmed sinkhole" : p.verified === "N" ? "Not a sinkhole" : "Unverified subsidence report";
    const size = [p.lengthFt && `${p.lengthFt} ft long`, p.widthFt && `${p.widthFt} ft wide`, p.depthFt && `${p.depthFt} ft deep`].filter(Boolean).join(" · ");
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Florida subsidence report" accent={SINK_COLORS[p.verified]} title={label} subtitle={[p.county && `${p.county.toLowerCase()} county`, p.ref && `report ${p.ref}`].filter(Boolean).join(" · ")}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Reported", p.date ? new Date(p.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : null],
              ["Size", size || null],
              ["Property damage", p.damage === "Y" ? "Yes" : p.damage === "N" ? "No" : null],
              ["Location accuracy", p.accuracy],
            ]}
          />
          {p.notes && <p className="text-[12px] leading-relaxed text-slate-300">“{p.notes.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase())}”</p>}
          <p className="text-[11px] leading-relaxed text-slate-400">
            The Florida Geological Survey logs every reported depression; most are never checked by a licensed geologist, and some turn out to be broken pipes or settling fill.
            Many locations are only accurate to a quarter section (about 160 acres).
          </p>
          <DrawerLink href="https://floridadep.gov/fgs/sinkholes">Florida Geological Survey · sinkholes</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "sinkholes") {
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Kentucky Geological Survey" accent={SINK_COLORS.ky} title="Mapped sinkhole" subtitle="Kentucky">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            One of about 100,000 sinkholes the Kentucky Geological Survey has outlined across the state&apos;s karst — closed depressions where the ground has sagged or collapsed into dissolved limestone below.
          </p>
          <FactGrid facts={[["Area", picked.props.ACRES != null ? `${Number(picked.props.ACRES).toFixed(2)} acres` : null]]} />
          <p className="text-[11px] text-slate-400">Turn on terrain relief: from zoom 11 the 1-meter lidar shows these depressions in the ground itself.</p>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "aquifers") {
    const p = picked.props as { name: string; rock: string };
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Karst aquifer" accent={AQUIFER_COLORS[p.rock === "carbonate" ? "carbonate" : "mixed"]} title={p.name} subtitle={p.rock === "carbonate" ? "Carbonate-rock aquifer" : "Sandstone and carbonate-rock aquifer"}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            Groundwater here moves through cracks and conduits that water itself has dissolved in the rock — the same process that makes caves. Karst aquifers can yield a lot of water, but they are easily polluted: water from the surface reaches them fast, with little filtering.
          </p>
          <p className="text-[11px] text-slate-400">Shown where this is the uppermost principal aquifer (USGS); it may extend further at depth.</p>
          <DrawerLink href="https://www.usgs.gov/mission-areas/water-resources/science/principal-aquifers-united-states">USGS · Principal aquifers of the United States</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked?.layer === "karst") {
    return <KarstDrawer key={`${picked.lngLat.join(",")}`} picked={picked} onClose={onClose} />;
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}

function KarstDrawer({ picked, onClose }: { picked: Picked; onClose: () => void }) {
  const cls = String(picked.props.cls) as KarstClass;
  const exp = String(picked.props.exp);
  const clim = String(picked.props.clim ?? "");
  const info = karstClass(cls);
  const [unit, setUnit] = useState<KarstUnit | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    karstUnitAt(cls, picked.lngLat[0], picked.lngLat[1], ctl.signal)
      .then(setUnit)
      .catch((e) => !ctl.signal.aborted && setError((e as Error).message));
    return () => ctl.abort();
  }, [cls, picked.lngLat]);

  return (
    <FeatureDrawer open onClose={onClose} eyebrow="Karst" accent={info.color} title={info.label} subtitle={`${info.short} · ${exp === "buried" ? "buried under other sediment" : "at or near the surface"}${clim ? ` · ${clim} climate` : ""}`}>
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-slate-300">{info.blurb}</p>
        {unit === undefined && !error && <p className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-cyan-200/70">Reading the USGS map unit…</p>}
        {error && <p className="text-xs text-rose-400">Couldn&apos;t reach the USGS karst map ({error}).</p>}
        {unit && (
          <>
            <FactGrid
              facts={[
                ["Rock unit", unit.unitName],
                ["Age", unit.unitAge],
                ["Rocks", unit.rocks.slice(0, 3).join(", ") || null],
                ["Ecoregion", unit.ecoregion],
              ]}
            />
            <p className="text-[11px] leading-relaxed text-slate-400">{unit.karstType}</p>
            {unit.url && <DrawerLink href={unit.url}>USGS geologic unit details</DrawerLink>}
          </>
        )}
        {unit === null && <p className="text-xs text-slate-400">No detailed unit right under the click — the outline here is generalized to about 1 km.</p>}
        <DrawerLink href="https://doi.org/10.3133/ofr20141156">USGS Open-File Report 2014-1156</DrawerLink>
      </div>
    </FeatureDrawer>
  );
}
