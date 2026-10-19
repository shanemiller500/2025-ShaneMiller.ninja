"use client";

import { History, MapPinOff, Orbit } from "lucide-react";
import type { FeaturedTown } from "./featured";
import type { ThenNowPlace } from "@/components/atlas/ThenNow";
import { hasUsgsTopo } from "@/utils/geo/topo";
import { DrawerLink, FactGrid, FeatureDrawer } from "@/components/atlas/FeatureDrawer";
import type { Picked } from "@/components/atlas/types";
import { useWikiPhoto } from "@/components/atlas/useWikiPhoto";
import { commonsThumb, ghostKind, gnisUrl, kmBetween, lifespan, wikiUrl, type DrownedTown, type GhostCols } from "@/utils/geo/ghost";
import { featuredById } from "./featured";
import { GHOST_COLORS } from "./layers";

/* ------------------------------------------------------------------ */
/*  Drawers for Ghost Towns: a featured town, a Wikidata ghost town,   */
/*  a vanished place from GNIS, or a town under a reservoir.           */
/* ------------------------------------------------------------------ */

function ThenNowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/50 bg-amber-400/15 px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_22px_-6px_#fbbf24] transition-colors hover:bg-amber-400/25"
    >
      <History className="h-4 w-4" /> Then &amp; now — the old survey maps
    </button>
  );
}

const where = ([lng, lat]: [number, number]) => `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? "E" : "W"}`;

function Featured({ id, onClose, onThenNow, onFly }: { id: string; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void; onFly?: (t: FeaturedTown) => void }) {
  const t = featuredById(id)!;
  const photo = useWikiPhoto(t.wiki);
  return (
    <FeatureDrawer open onClose={onClose} eyebrow={`${t.kind === "drowned" ? "Drowned" : t.kind === "deserted" ? "Deserted village" : "Ghost town"} · ${t.era}`} accent={t.accent} title={t.name} subtitle={t.where}>
      <div className="space-y-4">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={t.name} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
        )}
        <p className="text-[14px] font-semibold leading-snug text-white">{t.tagline}</p>
        <ul className="space-y-2">
          {t.facts.map((f) => (
            <li key={f.text} className="flex gap-2 text-[13px] leading-relaxed text-slate-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full" style={{ background: t.accent }} />
              <span>
                {f.text}{" "}
                <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-amber-300/70 hover:text-amber-200">
                  ↗ {f.source.label}
                </a>
              </span>
            </li>
          ))}
        </ul>
        {onThenNow && hasUsgsTopo(t.center) && <ThenNowButton onClick={() => onThenNow({ name: t.name, center: t.center, zoom: Math.min(t.zoom, 14.5) })} />}
        {onFly && (
          <button type="button" onClick={() => onFly(t)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-[13px] font-semibold text-slate-100 transition-colors hover:bg-white/10">
            <Orbit className="h-4 w-4" /> Fly over in 3D
          </button>
        )}
        <div className="space-y-2">
          <DrawerLink href={t.site.url}>{t.site.label}</DrawerLink>
          <DrawerLink href={`https://en.wikipedia.org/wiki/${t.wiki}`}>Wikipedia</DrawerLink>
        </div>
      </div>
    </FeatureDrawer>
  );
}

function GhostTown({ picked, cols, drowned, onClose, onThenNow }: { picked: Picked; cols: GhostCols | null; drowned: DrownedTown[] | null; onClose: () => void; onThenNow?: (p: ThenNowPlace) => void }) {
  const i = Number(picked.props.i);
  const ok = cols && Number.isFinite(i) && cols.id[i] != null;
  const name = ok ? cols!.name[i] : String(picked.props.name ?? "Ghost town");
  const image = ok ? cols!.image[i] : null;
  const wiki = ok ? cols!.wiki[i] : null;
  const life = ok ? lifespan(cols!.founded[i], cols!.abandoned[i]) : null;
  // the same town may also be on the drowned list
  const under = drowned?.find((d) => d.name === name && kmBetween([d.lng, d.lat], picked.lngLat) < 5)?.reservoir ?? null;
  return (
    <FeatureDrawer open onClose={onClose} eyebrow={ok ? ghostKind(cols!, i) : "Ghost town"} accent={GHOST_COLORS.ghost} title={name} subtitle={ok ? cols!.desc[i] || cols!.country[i] || undefined : undefined}>
      <div className="space-y-4">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={commonsThumb(image)} alt={name} loading="lazy" className="max-h-52 w-full rounded-xl bg-white/5 object-cover" />
        )}
        <FactGrid
          facts={[
            ["Country", ok ? cols!.country[i] : null],
            ["Lifespan", life],
            ["Lies under", under],
            ["Position", where(picked.lngLat)],
          ]}
        />
        {onThenNow && hasUsgsTopo(picked.lngLat) && <ThenNowButton onClick={() => onThenNow({ name, center: picked.lngLat, zoom: 14 })} />}
        <div className="space-y-2">
          {wiki && <DrawerLink href={wikiUrl(wiki)}>Wikipedia</DrawerLink>}
          {ok && <DrawerLink href={`https://www.wikidata.org/wiki/${cols!.id[i]}`}>Wikidata record</DrawerLink>}
        </div>
        {image && <p className="text-[10.5px] text-slate-500">Photo: Wikimedia Commons — see the file page for author and license.</p>}
      </div>
    </FeatureDrawer>
  );
}

export function GhostDetailsDrawer({
  picked,
  cols,
  drowned,
  onClose,
  onThenNow,
  onFly,
}: {
  picked: Picked | null;
  cols: GhostCols | null;
  drowned: DrownedTown[] | null;
  onClose: () => void;
  onThenNow?: (p: ThenNowPlace) => void;
  onFly?: (t: FeaturedTown) => void;
}) {
  if (!picked) return <FeatureDrawer open={false} onClose={onClose} />;
  const p = picked.props as Record<string, unknown>;

  if (picked.layer === "featured" && featuredById(String(p.id))) return <Featured key={String(p.id)} id={String(p.id)} onClose={onClose} onThenNow={onThenNow} onFly={onFly} />;
  if (picked.layer === "ghost") return <GhostTown key={String(p.i)} picked={picked} cols={cols} drowned={drowned} onClose={onClose} onThenNow={onThenNow} />;
  const thenNow = (zoom: number) => onThenNow && hasUsgsTopo(picked.lngLat) && <ThenNowButton onClick={() => onThenNow({ name: String(p.name ?? "This place"), center: picked.lngLat, zoom })} />;

  if (picked.layer === "gnis") {
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Vanished place · USGS GNIS" accent={GHOST_COLORS.gnis} title={String(p.name)} subtitle={[p.county ? `${p.county} County` : null, p.state].filter(Boolean).join(", ")}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            The U.S. Geological Survey lists this populated place as <span className="font-semibold text-white">historical</span>: it no longer exists. Often the name and a dot on an old map are all that's left — a stage stop, a mill town, a farm post office, a railroad siding.
          </p>
          <FactGrid
            facts={[
              ["County", p.county ? String(p.county) : null],
              ["State", p.state ? String(p.state) : null],
              ["Position", where(picked.lngLat)],
              ["GNIS ID", String(p.id)],
            ]}
          />
          {thenNow(14.5)}
          <DrawerLink href={gnisUrl(Number(p.id))}>USGS GNIS record</DrawerLink>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "osm") {
    return (
      <FeatureDrawer open onClose={onClose} eyebrow={`Abandoned ${String(p.kind ?? "place")} · OpenStreetMap`} accent={GHOST_COLORS.osm} title={p.name ? String(p.name) : "Unnamed abandoned place"} subtitle={where(picked.lngLat)}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">Mapped by OpenStreetMap volunteers as an abandoned or former settlement.{p.note ? <> Their note: “{String(p.note)}”</> : null}</p>
          <p className="text-[11.5px] leading-snug text-slate-500">Ruins are often on private land or unstable — look, don&apos;t climb, and ask before you go.</p>
          {thenNow(14.5)}
          <div className="space-y-2">
            {p.wikipedia ? <DrawerLink href={`https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.wikipedia).replace(/^en:/, ""))}`}>Wikipedia</DrawerLink> : null}
            {p.wikidata ? <DrawerLink href={`https://www.wikidata.org/wiki/${String(p.wikidata)}`}>Wikidata</DrawerLink> : null}
            <DrawerLink href={`https://www.openstreetmap.org/${String(p.osm)}`}>OpenStreetMap (© contributors, ODbL)</DrawerLink>
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  if (picked.layer === "drowned") {
    const approx = String(p.approximate) === "true";
    return (
      <FeatureDrawer open onClose={onClose} eyebrow="Drowned town" accent={GHOST_COLORS.drowned} title={String(p.name)} subtitle={[p.state, `under ${p.reservoir}`].filter(Boolean).join(" · ")}>
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            When the dam closed and {String(p.reservoir)} filled, the water rose over this town — some or all of it now lies beneath the surface.
          </p>
          {approx && (
            <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-amber-200/90">
              <MapPinOff className="mt-px h-3.5 w-3.5 shrink-0" /> The town's own position isn't published, so it's marked at its reservoir.
            </p>
          )}
          {thenNow(13.5)}
          <div className="space-y-2">
            {p.wiki ? <DrawerLink href={wikiUrl(String(p.wiki))}>Wikipedia — {String(p.name)}</DrawerLink> : null}
            <DrawerLink href="https://en.wikipedia.org/wiki/List_of_flooded_towns_in_the_United_States">List of flooded towns in the United States</DrawerLink>
          </div>
        </div>
      </FeatureDrawer>
    );
  }

  return <FeatureDrawer open={false} onClose={onClose} />;
}
