"use client";

import { AlertTriangle, History, Orbit } from "lucide-react";
import type { ThenNowPlace } from "@/components/atlas/ThenNow";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import { GROUPS, MSHA_MDRS_URL, SIZE_LABEL, USMIN_KINDS, kmBetween, mrdsUrl, type MineTile, type MinesIndex } from "@/utils/geo/mines";
import type { GeoUnit } from "@/utils/geo/strange";
import type { LoadedTile } from "@/utils/geo/useMineTiles";
import { SAFETY, siteById, type MineSite } from "./featured";

/* ------------------------------------------------------------------ */
/*  Drawers for Lost Mines: a featured site, an MRDS mine, an MSHA     */
/*  mine, a symbol from the old topo maps, or the rock under a spot.   */
/* ------------------------------------------------------------------ */

const where = ([lng, lat]: [number, number]) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;
const STATUS_NOTE: Record<string, string> = {
  Producer: "Producing when the record was written — USGS stopped updating these records in 2011, so it may have closed since.",
  "Past Producer": "Mined at some point, but not producing when the record was written.",
  Prospect: "Explored — trenches, shafts or drill holes — but never mined.",
  Occurrence: "Ore found here, but little or no work done.",
  Plant: "A mill, smelter or processing plant.",
};

/** Opens the old USGS topo maps of this spot beside today's ground. */
function ThenNowButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/50 bg-amber-400/15 px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_22px_-6px_#fbbf24] transition-colors hover:bg-amber-400/25">
      <History className="h-4 w-4" /> Then &amp; now — the old topo maps
    </button>
  );
}

export function Safety() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11.5px] leading-snug text-rose-100">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-300" />
      <span>
        {SAFETY.text}{" "}
        <a href={SAFETY.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-rose-300/80 hover:text-rose-200">
          ↗ NPS
        </a>
      </span>
    </p>
  );
}

const firstWord = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").find((w) => w.length > 2 && !["the", "mine", "mines", "mining"].includes(w)) ?? "";

/** The other register's record for the same mine: within 1.5 km and sharing a name word. */
function matchIn<T extends { lng: number[]; lat: number[]; name: string[] }>(cols: T, at: [number, number], name: string): number {
  const w = firstWord(name);
  if (!w) return -1;
  let best = -1;
  let bestKm = 1.5;
  for (let i = 0; i < cols.name.length; i++) {
    if (firstWord(cols.name[i]) !== w) continue;
    const km = kmBetween(at, [cols.lng[i], cols.lat[i]]);
    if (km < bestKm) [best, bestKm] = [i, km];
  }
  return best;
}

function Site({ id, onClose, onThenNow, onFly }: { id: string; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void; onFly?: (s: MineSite) => void }) {
  const s = siteById(id)!;
  const photo = useWikiPhoto(s.wiki);
  return (
    <FeatureDrawer open onClose={onClose} eyebrow={s.era} accent={s.accent} title={s.name} subtitle={s.where}>
      <div className="space-y-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={s.name} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
        )}
        <p className="text-[14px] font-semibold leading-snug text-white">{s.tagline}</p>
        <ul className="space-y-2">
          {s.facts.map((f) => (
            <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: s.accent }} />
              <span>
                {f.text}{" "}
                <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-amber-300/70 hover:text-amber-200">
                  ↗ {f.source.label}
                </a>
              </span>
            </li>
          ))}
        </ul>
        {onThenNow && <ThenNowButton onClick={() => onThenNow({ name: s.name, center: s.center, zoom: Math.min(s.zoom, 14.5) })} />}
        {onFly && (
          <button type="button" onClick={() => onFly(s)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-[13px] font-semibold text-slate-100 transition-colors hover:bg-white/10">
            <Orbit className="h-4 w-4" /> Fly over in 3D
          </button>
        )}
        <Safety />
        <div className="space-y-2">
          <DrawerLink href={s.site.url}>{s.site.label}</DrawerLink>
          <DrawerLink href={`https://en.wikipedia.org/wiki/${s.wiki}`}>Wikipedia</DrawerLink>
        </div>
      </div>
    </FeatureDrawer>
  );
}

function Mrds({ tile, i, index, picked, onClose, onThenNow }: { tile: MineTile; i: number; index: MinesIndex; picked: Picked; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void }) {
  const m = tile.mrds;
  const d = tile.dict;
  const g = GROUPS[m.g[i]];
  const status = index.mrdsStatus[m.st[i]] ?? "Unknown";
  const at: [number, number] = [m.lng[i], m.lat[i]];
  const years = [m.disc[i] ? `found ${m.disc[i]}` : null, m.first[i] ? `first produced ${m.first[i]}` : null, m.last[i] ? `last produced ${m.last[i]}` : null].filter(Boolean).join(" · ");
  const k = matchIn(tile.msha, at, m.name[i]);
  return (
    <FeatureDrawer open onClose={onClose} eyebrow={`${g.label} · USGS MRDS`} accent={g.color} title={m.name[i] || "Unnamed mine"} subtitle={[d[m.county[i]] ? (d[m.country[i]] === "United States" ? `${d[m.county[i]]} County` : d[m.county[i]]) : null, d[m.state[i]], d[m.country[i]] && d[m.country[i]] !== "United States" ? d[m.country[i]] : null].filter(Boolean).join(", ") || where(picked.lngLat)}>
      <div className="space-y-4">
        <FactGrid
          facts={[
            ["Commodities", d[m.com[i]] || null],
            ["Status (as recorded)", status],
            ["Production", SIZE_LABEL[m.sz[i]] ?? null],
            ["Operation", d[m.op[i]] || null],
            ["Dates", years || null],
            ["Position", where(at)],
          ]}
        />
        {STATUS_NOTE[status] && <p className="text-[12px] leading-snug text-slate-400">{STATUS_NOTE[status]}</p>}
        {k >= 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] leading-snug text-slate-300">
            MSHA&apos;s register — kept current — lists <span className="font-semibold text-white">{tile.msha.name[k]}</span> nearby as{" "}
            <span className="font-semibold text-white">{(index.mshaStatus[tile.msha.st[k]] ?? "").toLowerCase()}</span>
            {tile.msha.date[k] ? <> since {tile.msha.date[k]}</> : null}.
          </p>
        )}
        {onThenNow && <ThenNowButton onClick={() => onThenNow({ name: m.name[i] || "This mine", center: at, zoom: 15 })} />}
        <Safety />
        <DrawerLink href={mrdsUrl(m.id[i])}>USGS MRDS record #{m.id[i]}</DrawerLink>
        <p className="text-[10.5px] text-slate-500">Data: USGS Mineral Resources Data System (public domain). Positions and details are as reported, some long ago.</p>
      </div>
    </FeatureDrawer>
  );
}

function Msha({ tile, i, index, onClose, onThenNow }: { tile: MineTile; i: number; index: MinesIndex; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void }) {
  const h = tile.msha;
  const d = tile.dict;
  const g = GROUPS[h.g[i]];
  const status = index.mshaStatus[h.st[i]] ?? "";
  const at: [number, number] = [h.lng[i], h.lat[i]];
  const k = matchIn(tile.mrds, at, h.name[i]);
  return (
    <FeatureDrawer open onClose={onClose} eyebrow={`${g.label} · MSHA register`} accent={g.color} title={h.name[i] || "Unnamed mine"} subtitle={[d[h.county[i]] ? `${d[h.county[i]]} County` : null, d[h.state[i]]].filter(Boolean).join(", ")}>
      <div className="space-y-4">
        <FactGrid
          facts={[
            ["Status", status ? `${status}${h.date[i] ? ` since ${h.date[i]}` : ""}` : null],
            ["Commodity", d[h.sic[i]] || null],
            ["Type", d[h.type[i]] || null],
            ["MSHA mine ID", h.id[i]],
            ["Position", where(at)],
          ]}
        />
        <p className="text-[12px] leading-snug text-slate-400">The Mine Safety and Health Administration keeps this register current — an abandoned mine stays on it with the date its status changed.</p>
        {k >= 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] leading-snug text-slate-300">
            USGS&apos;s older MRDS lists <span className="font-semibold text-white">{tile.mrds.name[k]}</span> nearby as{" "}
            <span className="font-semibold text-white">{(index.mrdsStatus[tile.mrds.st[k]] ?? "").toLowerCase()}</span> — <a className="underline decoration-dotted hover:text-white" href={mrdsUrl(tile.mrds.id[k])} target="_blank" rel="noopener noreferrer">its record</a>.
          </p>
        )}
        {onThenNow && <ThenNowButton onClick={() => onThenNow({ name: h.name[i] || "This mine", center: at, zoom: 15 })} />}
        <Safety />
        <DrawerLink href={MSHA_MDRS_URL}>MSHA Mine Data Retrieval System — look up ID {h.id[i]}</DrawerLink>
      </div>
    </FeatureDrawer>
  );
}

function Usmin({ picked, onClose, onThenNow }: { picked: Picked; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void }) {
  const p = picked.props as { type: string; kind: number; name?: string | null; topo?: string | null; topoDate?: number | null; scale?: number | null; url?: string | null; area?: boolean };
  const kind = USMIN_KINDS[Number(p.kind)] ?? USMIN_KINDS[USMIN_KINDS.length - 1];
  return (
    <FeatureDrawer open onClose={onClose} eyebrow="From the old USGS topo maps" accent={kind.color} title={p.name || p.type} subtitle={p.name ? p.type : where(picked.lngLat)}>
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-slate-300">
          A {p.type.toLowerCase()} {String(p.area) === "true" ? "outlined" : "marked"} on the USGS topographic map
          {p.topo ? <> of <span className="font-semibold text-white">{p.topo}</span></> : null}
          {p.topoDate ? <> ({p.topoDate})</> : null}. USGS digitized these symbols so the old workings aren&apos;t forgotten — many are on no other map.
        </p>
        <FactGrid
          facts={[
            ["Map", p.topo ? `${p.topo}${p.scale ? ` · 1:${Number(p.scale).toLocaleString()}` : ""}` : null],
            ["Map date", p.topoDate ? String(p.topoDate) : null],
            ["Position", where(picked.lngLat)],
          ]}
        />
        {onThenNow && <ThenNowButton onClick={() => onThenNow({ name: p.name || p.type, center: picked.lngLat, zoom: 15.5 })} />}
        <Safety />
        {p.url && <DrawerLink href={p.url}>USGS USMIN record</DrawerLink>}
      </div>
    </FeatureDrawer>
  );
}

function Rock({ picked, onClose }: { picked: Picked; onClose: () => void }) {
  const u = picked.props as unknown as GeoUnit;
  return (
    <FeatureDrawer open onClose={onClose} eyebrow="Bedrock geology" accent={u.color} title={u.name || "Mapped rock unit"} subtitle={where(picked.lngLat)}>
      <div className="space-y-4">
        <FactGrid facts={[["Age", u.period || null], ["Rock", u.lith || null], ["Unit", u.strat || null]]} />
        {u.desc && <p className="text-[12.5px] leading-relaxed text-slate-300">{u.desc}</p>}
        <DrawerLink href={`https://macrostrat.org/map/loc/${picked.lngLat[0].toFixed(4)}/${picked.lngLat[1].toFixed(4)}`}>Open in Macrostrat</DrawerLink>
      </div>
    </FeatureDrawer>
  );
}

export function MineDetailsDrawer({ picked, tiles, index, onClose, onThenNow, onFly }: { picked: Picked | null; tiles: LoadedTile[]; index: MinesIndex | null; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void; onFly?: (s: MineSite) => void }) {
  if (!picked) return <FeatureDrawer open={false} onClose={onClose} />;
  const p = picked.props as Record<string, unknown>;
  if (picked.layer === "sites" && siteById(String(p.id))) return <Site key={String(p.id)} id={String(p.id)} onClose={onClose} onThenNow={onThenNow} onFly={onFly} />;
  if (picked.layer === "usmin") return <Usmin picked={picked} onClose={onClose} onThenNow={onThenNow} />;
  if (picked.layer === "geology") return <Rock picked={picked} onClose={onClose} />;
  if (picked.layer === "mines" && index) {
    const t = tiles.find((x) => x.key === p.tile)?.tile;
    const i = Number(p.i);
    if (t && p.src === "msha" && t.msha.id[i] != null) return <Msha tile={t} i={i} index={index} onClose={onClose} onThenNow={onThenNow} />;
    if (t && p.src === "mrds" && t.mrds.id[i] != null) return <Mrds tile={t} i={i} index={index} picked={picked} onClose={onClose} onThenNow={onThenNow} />;
  }
  return <FeatureDrawer open={false} onClose={onClose} />;
}
