"use client";

import { useEffect, useMemo, useState } from "react";
import { Bone, Filter, Loader2 } from "lucide-react";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import {
  FLAG_DINO,
  FLAG_MAMMAL,
  PERIODS,
  collectionDetails,
  collectionTaxa,
  fmtAge,
  pbdbCollectionUrl,
  type CollectionDetails,
  type FossilsFile,
  type TaxonGroup,
} from "@/utils/geo/fossils";
import { kmBetween, type GeoUnit } from "@/utils/geo/strange";
import { parkById } from "./featured";
import { BONE } from "./layers";

/* ------------------------------------------------------------------ */
/*  Drawers for Prehistoric USA: a fossil collection (name, rock and   */
/*  what was found, live from PBDB), a featured park, or the bedrock   */
/*  under a clicked spot (Macrostrat).                                 */
/* ------------------------------------------------------------------ */

const where = ([lng, lat]: [number, number]) => `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(3)}°${lng >= 0 ? "E" : "W"}`;
const NAMES_SHOWN = 14;

function Chip({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ borderColor: `${color}66`, color }}>
      {children}
    </span>
  );
}

function TaxaList({ groups }: { groups: TaxonGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const all = open[g.group];
        const shown = all ? g.names : g.names.slice(0, NAMES_SHOWN);
        return (
          <div key={g.group}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              {g.group} · {g.names.length}
            </p>
            <p className="text-[12.5px] italic leading-relaxed text-slate-200">
              {shown.join(", ")}
              {g.names.length > shown.length && (
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.group]: true }))} className="ml-1 not-italic text-lime-300/80 hover:text-lime-200">
                  +{g.names.length - shown.length} more
                </button>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Collection({ picked, data, onClose, onFormation }: { picked: Picked; data: FossilsFile | null; onClose: () => void; onFormation?: (fm: number) => void }) {
  const id = Number(picked.props.id);
  const i = Number(picked.props.i);
  const c = data?.cols;
  const ok = !!c && c.id[i] === id;
  const per = ok ? c!.per[i] : Number(picked.props.per);
  const period = PERIODS[per];
  const flag = ok ? c!.flag[i] : Number(picked.props.flag) || 0;
  const fm = ok ? c!.fm[i] : -1;
  const [details, setDetails] = useState<CollectionDetails | null>(null);
  const [taxa, setTaxa] = useState<TaxonGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([collectionDetails(id, ctl.signal), collectionTaxa(id, ctl.signal)])
      .then(([d, t]) => {
        setDetails(d);
        setTaxa(t);
      })
      .catch(() => !ctl.signal.aborted && setFailed(true));
    return () => ctl.abort();
  }, [id]);

  const formation = details?.formation ?? (fm >= 0 ? data!.formations[fm] : null);
  const loading = !details && !failed;
  return (
    <FeatureDrawer
      open
      onClose={onClose}
      eyebrow={`Fossil site · ${period?.label ?? "Unknown period"}`}
      accent={period?.color ?? "#a3e635"}
      title={details?.name || `Collection ${id}`}
      subtitle={[details?.county ? (/county|parish|borough$/i.test(details.county) ? details.county : `${details.county} County`) : null, details?.state ?? (ok && c!.st[i] >= 0 ? data!.states[c!.st[i]] : null)].filter(Boolean).join(", ") || where(picked.lngLat)}
    >
      <div className="space-y-4">
        {(flag & FLAG_DINO || flag & FLAG_MAMMAL) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flag & FLAG_DINO ? (
              <Chip color={BONE}>
                <Bone className="h-3 w-3" /> Dinosaurs
              </Chip>
            ) : null}
            {flag & FLAG_MAMMAL ? <Chip color="#fda4af">Mammals</Chip> : null}
          </div>
        )}
        <FactGrid
          facts={[
            ["Age", ok ? fmtAge(c!.max[i], c!.min[i]) : null],
            ["Interval", details?.interval ?? null],
            ["Formation", formation],
            ["Rock", details?.lithology ?? null],
            ["Finds recorded", ok ? c!.n[i].toLocaleString() : null],
            ["Position", where(picked.lngLat)],
          ]}
        />
        {fm >= 0 && onFormation && (
          <button type="button" onClick={() => onFormation(fm)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/40 bg-lime-400/10 px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-lime-400/20">
            <Filter className="h-4 w-4" /> Every site in this formation ({data!.formations[fm]})
          </button>
        )}
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-lime-200/80">What was found here</p>
          {loading && (
            <p className="flex items-center gap-2 text-[12px] text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Asking the Paleobiology Database…
            </p>
          )}
          {failed && <p className="text-[12px] text-slate-400">The Paleobiology Database didn&apos;t answer — open the record below instead.</p>}
          {taxa && (taxa.length ? <TaxaList groups={taxa} /> : <p className="text-[12px] text-slate-400">No identified taxa are listed for this collection.</p>)}
        </div>
        {details?.reference && <p className="text-[11px] leading-snug text-slate-500">Reference: {details.reference}</p>}
        <DrawerLink href={pbdbCollectionUrl(id)}>Paleobiology Database record</DrawerLink>
        <p className="text-[10.5px] text-slate-500">Data: The Paleobiology Database, CC BY 4.0. Positions are as recorded — some are only approximate. Collecting on public land needs a permit.</p>
      </div>
    </FeatureDrawer>
  );
}

function Park({ id, data, onClose }: { id: string; data: FossilsFile | null; onClose: () => void }) {
  const p = parkById(id)!;
  const photo = useWikiPhoto(p.wiki);
  // PBDB sites within 15 km
  const near = useMemo(() => {
    if (!data) return null;
    const c = data.cols;
    let n = 0;
    for (let i = 0; i < c.id.length; i++) if (Math.abs(c.lat[i] - p.center[1]) < 0.2 && kmBetween(p.center, [c.lng[i], c.lat[i]]) <= 15) n++;
    return n;
  }, [data, p.center]);
  return (
    <FeatureDrawer open onClose={onClose} eyebrow={p.age} accent={p.accent} title={p.name} subtitle={p.where}>
      <div className="space-y-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={p.name} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
        )}
        <p className="text-[14px] font-semibold leading-snug text-white">{p.tagline}</p>
        <ul className="space-y-2">
          {p.facts.map((f) => (
            <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: p.accent }} />
              <span>
                {f.text}{" "}
                <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-lime-300/70 hover:text-lime-200">
                  ↗ {f.source.label}
                </a>
              </span>
            </li>
          ))}
        </ul>
        {near != null && near > 0 && (
          <p className="text-[12px] text-slate-400">
            <span className="font-semibold text-white">{near.toLocaleString()}</span> fossil collections in the Paleobiology Database lie within 15 km.
          </p>
        )}
        {p.approximate && <p className="text-[11.5px] leading-snug text-amber-200/90">The footprint sites aren&apos;t published, so the marker is the park itself.</p>}
        <p className="text-[11.5px] leading-snug text-slate-500">Taking fossils from a national park is illegal — look, photograph, and leave them.</p>
        <div className="space-y-2">
          <DrawerLink href={p.site.url}>{p.site.label}</DrawerLink>
          <DrawerLink href={`https://en.wikipedia.org/wiki/${p.wiki}`}>Wikipedia</DrawerLink>
        </div>
      </div>
    </FeatureDrawer>
  );
}

function Rock({ picked, onClose }: { picked: Picked; onClose: () => void }) {
  const u = picked.props as unknown as GeoUnit;
  return (
    <FeatureDrawer open onClose={onClose} eyebrow="Bedrock geology" accent={u.color} title={u.name || "Mapped rock unit"} subtitle={where(picked.lngLat)}>
      <div className="space-y-4">
        <FactGrid
          facts={[
            ["Age", u.period || null],
            ["Formed", u.bAge ? fmtAge(u.bAge, u.tAge) : null],
            ["Rock", u.lith || null],
            ["Unit", u.strat || null],
          ]}
        />
        {u.desc && <p className="text-[12.5px] leading-relaxed text-slate-300">{u.desc}</p>}
        {u.ref && <p className="text-[11px] leading-snug text-slate-500">Map source: {u.ref}</p>}
        <DrawerLink href={`https://macrostrat.org/map/loc/${picked.lngLat[0].toFixed(4)}/${picked.lngLat[1].toFixed(4)}`}>Open in Macrostrat</DrawerLink>
      </div>
    </FeatureDrawer>
  );
}

export function FossilDetailsDrawer({ picked, data, onClose, onFormation }: { picked: Picked | null; data: FossilsFile | null; onClose: () => void; onFormation?: (fm: number) => void }) {
  if (!picked) return <FeatureDrawer open={false} onClose={onClose} />;
  if (picked.layer === "parks" && parkById(String(picked.props.id))) return <Park key={String(picked.props.id)} id={String(picked.props.id)} data={data} onClose={onClose} />;
  if (picked.layer === "fossils") return <Collection key={String(picked.props.id)} picked={picked} data={data} onClose={onClose} onFormation={onFormation} />;
  if (picked.layer === "geology") return <Rock picked={picked} onClose={onClose} />;
  return <FeatureDrawer open={false} onClose={onClose} />;
}
