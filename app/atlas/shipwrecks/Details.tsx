"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, MapPinOff } from "lucide-react";
import type { DiveTarget } from "./Descent";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import { WATER_LEVEL, metresToFeet, ukhoWreck, wreckCat, wreckDetails, type UkhoWreck, type WreckDetails } from "@/utils/geo/wrecks";
import { causeOf, fmtDay, sourceUrl } from "@/utils/geo/sinkings";
import { featuredById } from "./featured";

/* ------------------------------------------------------------------ */
/*  Drawers for Shipwrecks: a featured wreck, a NOAA charted wreck, a  */
/*  named wreck (story loaded live from Wikidata), or a sanctuary.     */
/* ------------------------------------------------------------------ */

function DiveButton({ onClick, accent = "#22d3ee" }: { onClick: () => void; accent?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10"
      style={{ borderColor: `${accent}80`, background: `${accent}22`, boxShadow: `0 0 22px -6px ${accent}` }}
    >
      <ArrowDownToLine className="h-4 w-4" /> Dive to the wreck
    </button>
  );
}

function NamedWreck({ picked, onClose, onDive }: { picked: Picked; onClose: () => void; onDive?: (t: DiveTarget) => void }) {
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
        {onDive && <DiveButton onClick={() => onDive({ name: d?.label ?? String(picked.props.name), center: picked.lngLat, depth: null, depthSource: null })} />}
        <div className="space-y-2">
          {d?.wiki && <DrawerLink href={d.wiki}>Wikipedia</DrawerLink>}
          <DrawerLink href={`https://www.wikidata.org/wiki/${qid}`}>Wikidata record</DrawerLink>
        </div>
      </div>
    </FeatureDrawer>
  );
}

/** A UK Hydrographic Office wreck: slim on the map, the full chart record loads live. */
function UkhoWreckDrawer({ picked, onClose, onDive }: { picked: Picked; onClose: () => void; onDive?: (t: DiveTarget) => void }) {
  const p = picked.props as Record<string, unknown>;
  const [d, setD] = useState<UkhoWreck | null | undefined>(undefined);
  useEffect(() => {
    const ctl = new AbortController();
    ukhoWreck(String(p.id), ctl.signal)
      .then(setD)
      .catch(() => !ctl.signal.aborted && setD(null));
    return () => ctl.abort();
  }, [p.id]);
  const cat = wreckCat(p.cat ? String(p.cat) : null);
  const depth = d?.depth ?? (p.depth == null ? null : Number(p.depth));
  const [lng, lat] = picked.lngLat;
  const name = d?.name ?? (p.name ? String(p.name) : null);
  return (
    <FeatureDrawer
      open
      onClose={onClose}
      eyebrow="UK Hydrographic Office chart record"
      accent={cat?.color ?? "#94a3b8"}
      title={name ?? cat?.label ?? "Charted wreck"}
      subtitle={`${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`}
    >
      <div className="space-y-4">
        {d === undefined && <p className="animate-pulse font-mono text-[11px] uppercase tracking-wider text-sky-200/70">Reading the chart record…</p>}
        <FactGrid
          facts={[
            ["Category", cat?.label ?? "Not specified"],
            ["Sunk", d?.sunk ?? (p.year ? String(p.year) : null)],
            ["Vessel", [d?.type, d?.flag ? `flag ${d.flag}` : null].filter(Boolean).join(" · ") || null],
            ["Depth over wreck", depth != null ? `${depth} m · ${metresToFeet(depth)} ft` : "not charted"],
            ["Water depth", d?.waterDepth != null ? `${d.waterDepth} m · ${metresToFeet(d.waterDepth)} ft` : null],
            ["Length", d?.length != null ? `${d.length} m` : null],
            ["Tonnage", d?.tonnage ?? null],
            ["Cargo", d?.cargo ?? null],
            ["Last detected", d?.lastSeen ?? null],
          ]}
        />
        {d?.circumstances && (
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">Circumstances of loss · chart text</p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-slate-300">{d.circumstances}</p>
          </div>
        )}
        {d?.comments && <p className="font-mono text-[11px] leading-snug text-slate-400">CHART NOTE: {d.comments}</p>}
        <p className="text-[11px] leading-snug text-slate-500">
          Contains public sector information from the UK Hydrographic Office, licensed under the Open Government Licence v3.0, served by EMODnet. Depths are from chart datum (about the lowest tide). Not for navigation.
        </p>
        {onDive && (
          <DiveButton
            accent={cat?.color}
            onClick={() => onDive({ name: name ?? cat?.label ?? "Charted wreck", center: picked.lngLat, depth: depth && depth > 0 ? depth : null, depthSource: depth && depth > 0 ? "charted" : null })}
          />
        )}
        <DrawerLink href="https://emodnet.ec.europa.eu/geoviewer/">EMODnet map viewer</DrawerLink>
      </div>
    </FeatureDrawer>
  );
}

export function WreckDetailsDrawer({ picked, onClose, onDive }: { picked: Picked | null; onClose: () => void; onDive?: (t: DiveTarget) => void }) {
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
          {onDive && (
            <DiveButton
              accent={featured.accent}
              onClick={() => onDive({ name: featured.name, center: featured.center, depth: featured.depthM ?? null, depthSource: featured.depthM ? "published" : null })}
            />
          )}
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

  if (picked.layer === "named") return <NamedWreck key={String(p.id)} picked={picked} onClose={onClose} onDive={onDive} />;

  if (picked.layer === "areas") {
    const hulks = p.kind === "hulks";
    const depth = p.depth == null || p.depth === "" ? null : Number(p.depth);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="NOAA nautical chart" accent={hulks ? "#a3e635" : "#fb923c"} title={p.name ? String(p.name) : hulks ? "Field of hulks" : "Wreck area"} subtitle={p.note ? String(p.note) : undefined}>
        <div className="space-y-4">
          <p className="text-[12px] leading-snug text-slate-400">
            {hulks ? "Charted as a foul area of sunken hulks rather than single wrecks." : "Charted as an area — scattered remains or several wrecks lying together — rather than a single point."}
          </p>
          {depth != null && <FactGrid facts={[["Depth over wreckage", `${depth} m · ${metresToFeet(depth)} ft`]]} />}
          {onDive && <DiveButton accent={hulks ? "#a3e635" : "#fb923c"} onClick={() => onDive({ name: p.name ? String(p.name) : hulks ? "Field of hulks" : "Wreck area", center: picked.lngLat, depth: depth && depth > 0 ? depth : null, depthSource: depth && depth > 0 ? "charted" : null })} />}
          <DrawerLink href="https://nauticalcharts.noaa.gov/enconline/enconline.html">NOAA ENC Online chart viewer</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "noaa" && p.src === "ukho") return <UkhoWreckDrawer key={String(p.id)} picked={picked} onClose={onClose} onDive={onDive} />;

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
          {onDive && (
            <DiveButton
              accent={cat?.color}
              onClick={() => onDive({ name: p.name ? String(p.name) : cat?.label ?? "Charted wreck", center: picked.lngLat, depth: depth && depth > 0 ? depth : null, depthSource: depth && depth > 0 ? "charted" : null })}
            />
          )}
          <DrawerLink href="https://nauticalcharts.noaa.gov/enconline/enconline.html">NOAA ENC Online chart viewer</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "sinkings") {
    const cause = causeOf(String(p.cause ?? "other"));
    const t = Number(p.t);
    const lost = p.lost == null ? null : Number(p.lost);
    const [lng, lat] = picked.lngLat;
    const src = sourceUrl(p.page ? String(p.page) : null, t);
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`Sunk ${fmtDay(t)}`} accent={cause.color} title={String(p.ship)} subtitle={p.flag ? String(p.flag) : undefined}>
        <div className="space-y-4">
          <FactGrid
            facts={[
              ["How", cause.label],
              ["Lives lost", lost != null ? `${lost.toLocaleString()} (as the entry states)` : "not stated"],
              ["Position", `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`],
            ]}
          />
          {p.desc ? <p className="text-[13px] leading-relaxed text-slate-300">{String(p.desc)}</p> : null}
          <p className="text-[11px] leading-snug text-slate-500">
            From Wikipedia&apos;s list of shipwrecks for that month (CC BY-SA 4.0). Wartime positions are often estimates, and the cause is read from the entry&apos;s wording.
          </p>
          {onDive && <DiveButton accent={cause.color} onClick={() => onDive({ name: String(p.ship), center: picked.lngLat, depth: null, depthSource: null })} />}
          {src && <DrawerLink href={src}>Wikipedia — {String(p.page)}</DrawerLink>}
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
