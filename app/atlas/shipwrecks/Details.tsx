"use client";

import { useEffect, useState } from "react";
import { MapPinOff } from "lucide-react";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import { WATER_LEVEL, metresToFeet, wreckCat, wreckDetails, type WreckDetails } from "@/utils/geo/wrecks";
import { featuredById } from "./featured";

/* ------------------------------------------------------------------ */
/*  Drawers for Shipwrecks: a featured wreck, a NOAA charted wreck, a  */
/*  named wreck (story loaded live from Wikidata), or a sanctuary.     */
/* ------------------------------------------------------------------ */

function NamedWreck({ picked, onClose }: { picked: Picked; onClose: () => void }) {
  const qid = String(picked.props.id);
  const [d, setD] = useState<WreckDetails | null | undefined>(undefined);
  useEffect(() => {
    const ctl = new AbortController();
    setD(undefined);
    wreckDetails(qid, ctl.signal)
      .then(setD)
      .catch(() => !ctl.signal.aborted && setD(null));
    return () => ctl.abort();
  }, [qid]);
  const [lng, lat] = picked.lngLat;
  return (
    <FeatureDrawer open onClose={onClose} eyebrow="Named shipwreck" accent="#f8fafc" title={d?.label ?? String(picked.props.name)} subtitle={d?.description ?? `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`}>
      <div className="space-y-4">
        {d === undefined && <p className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-sky-200/70">Reading the record…</p>}
        {d?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image} alt={d.label} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
        )}
        <FactGrid
          facts={[
            ["Lost", d?.lost ?? (picked.props.year ? String(picked.props.year) : null)],
            ["Position", `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? "E" : "W"}`],
          ]}
        />
        <p className="text-[11px] leading-snug text-slate-500">Positions come from contributors to Wikidata and can be approximate.</p>
        <div className="space-y-2">
          {d?.wiki && <DrawerLink href={d.wiki}>Wikipedia</DrawerLink>}
          <DrawerLink href={`https://www.wikidata.org/wiki/${qid}`}>Wikidata record</DrawerLink>
        </div>
      </div>
    </FeatureDrawer>
  );
}

export function WreckDetailsDrawer({ picked, onClose }: { picked: Picked | null; onClose: () => void }) {
  const featured = picked?.layer === "featured" ? featuredById(String(picked.props.id)) : undefined;
  const photo = useWikiPhoto(featured?.wiki ?? null);
  if (!picked) return <FeatureDrawer open={false} onClose={onClose} />;
  const p = picked.props as Record<string, unknown>;

  if (featured) {
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`Lost ${featured.lost}`} accent={featured.accent} title={featured.name} subtitle={featured.where}>
        <div className="space-y-4">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={featured.name} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
          )}
          <p className="text-[14px] font-semibold leading-snug text-white">{featured.tagline}</p>
          <ul className="space-y-2">
            {featured.facts.map((f) => (
              <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: featured.accent }} />
                <span>
                  {f.text}{" "}
                  <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-sky-300/70 hover:text-sky-200">
                    ↗ {f.source.label}
                  </a>
                </span>
              </li>
            ))}
          </ul>
          {featured.approximate && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-200/90">
              <MapPinOff className="h-3.5 w-3.5" /> No published position — the marker shows the general area.
            </p>
          )}
          <DrawerLink href={`https://en.wikipedia.org/wiki/${featured.wiki}`}>Wikipedia</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "named") return <NamedWreck key={String(p.id)} picked={picked} onClose={onClose} />;

  if (picked.layer === "noaa") {
    const cat = wreckCat(p.cat ? String(p.cat) : null);
    const depth = p.depth == null || p.depth === "" ? null : Number(p.depth);
    const [lng, lat] = picked.lngLat;
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="NOAA nautical chart" accent={cat?.color ?? "#94a3b8"} title={p.name ? String(p.name) : cat?.label ?? "Charted wreck"} subtitle={`${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["Category", cat?.label ?? "Not specified"],
              ["Depth over wreck", depth != null ? `${depth} m · ${metresToFeet(depth)} ft` : "not charted"],
              ["Water level", p.lvl ? WATER_LEVEL[String(p.lvl)] ?? null : null],
            ]}
          />
          {cat && <p className="text-[12px] leading-snug text-slate-400">{cat.blurb}</p>}
          {p.note ? <p className="text-[12px] leading-snug text-slate-300">Chart note: “{String(p.note)}”</p> : null}
          <p className="text-[11px] leading-snug text-slate-500">
            Depth is the shallowest sounding over the wreck, measured from chart datum (mean lower low water on U.S. coastal charts). Not for navigation — use official NOAA charts.
          </p>
          <DrawerLink href="https://nauticalcharts.noaa.gov/enconline/enconline.html">NOAA ENC Online chart viewer</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "sanctuaries") {
    const code = String(p.code ?? "").toLowerCase().replace(/nms$/, "");
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Protected waters" accent="#2dd4bf" title={String(p.name)} subtitle="NOAA Office of National Marine Sanctuaries">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            National marine sanctuaries protect places of special ecological, historical or cultural value — shipwrecks among them. Most sanctuaries’ rules prohibit disturbing or removing historical resources such as shipwrecks.
          </p>
          <DrawerLink href="https://sanctuaries.noaa.gov/">National Marine Sanctuaries</DrawerLink>
          {code && <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Code: {String(p.code)}</p>}
        </div>
      </FeatureDrawer>
    );
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}
