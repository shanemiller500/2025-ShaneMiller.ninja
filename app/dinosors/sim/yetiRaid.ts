/* ------------------------------------------------------------------ */
/*  Yeti bands raid the Snow People.                                   */
/*                                                                     */
/*  Yetis that have met keep together as a band (matching scarves,     */
/*  snowBeasts.yetiBands). Every so often a band of two or more goes   */
/*  down on the nearest Snow People camp: they march in together,      */
/*  stamp out the camp's fires, and go after everyone there — people   */
/*  and their Frosthorns alike — pelting them with snowballs, rocks    */
/*  and whole uprooted trees and clubbing whoever they catch. A raid   */
/*  is the one time a Yeti steps off its snow. It ends when the camp   */
/*  is cleared, or after a while; then the band trudges home.          */
/*                                                                     */
/*  Raids are moment-to-moment (not saved): a reload ends them.        */
/* ------------------------------------------------------------------ */
import { emote, setState } from "./dinos";
import { P } from "./particles";
import type { SnowTribe } from "./snowFolk";
import type { Brute, Dino } from "./types";
import type { World } from "./world";

/** Seconds between a band's raids (half that in winter). */
export const RAID_EVERY = 300;
/** A raid lasts at most this long (s). */
const RAID_LEN = 150;
/** A band only goes for a camp this close (px). */
const RAID_REACH = 2600;
/** Stamping out a fire: this close (px). */
const DOUSE_R = 56;

interface Raid {
  pack: number;
  tribe: number;
  until: number;
  /** fires put out so far (for the toasts) */
  doused: number;
}

const raids = new WeakMap<World, Map<number, Raid>>();
const nextAt = new WeakMap<World, Map<number, number>>();
const lastTick = new WeakMap<World, number>();

const raidsOf = (w: World) => {
  let m = raids.get(w);
  if (!m) raids.set(w, (m = new Map()));
  return m;
};
const nextOf = (w: World) => {
  let m = nextAt.get(w);
  if (!m) nextAt.set(w, (m = new Map()));
  return m;
};

const winter = (w: World) => Math.floor((w.day - 1) / 3) % 4 === 3;

/** The yetis of each band (two or more that have met). */
function bands(w: World) {
  const out = new Map<number, Dino[]>();
  for (const d of w.dinos) {
    if (d.species !== "yeti" || d.owner || !d.yetiPack || d.state === "faint") continue;
    const list = out.get(d.yetiPack);
    if (list) list.push(d);
    else out.set(d.yetiPack, [d]);
  }
  for (const [k, v] of Array.from(out)) if (v.length < 2) out.delete(k);
  return out;
}

/** The Snow People this raid is after, still standing. */
const tribeOf = (w: World, r: Raid): SnowTribe | null => w.snowFolk.tribes.find((t) => t.id === r.tribe) ?? null;

/** The fighters + Frosthorns of a camp still there to attack. */
function campFoes(w: World, t: SnowTribe) {
  const folk: Brute[] = w.snowFolk.members(t.id).filter((b) => b.hp > 0 && !b.snatched && !b.captive && !b.falling && b.z <= 20);
  const beasts = w.dinos.filter((d) => d.snowTribe === t.id && d.state !== "faint" && !d.under);
  return { folk, beasts };
}

/** Starts + ends raids (a couple of times a second at most). */
export function raidTick(w: World) {
  if (Math.abs(w.elapsed - (lastTick.get(w) ?? -9)) < 0.5) return;
  lastTick.set(w, w.elapsed);
  const active = raidsOf(w);
  const next = nextOf(w);
  const all = bands(w);
  // over: time's up, the camp is gone or cleared, or the band broke up
  for (const [pack, r] of Array.from(active)) {
    const t = tribeOf(w, r);
    const band = all.get(pack);
    const foes = t ? campFoes(w, t) : null;
    const fires = t ? t.lodges.some((l) => l.kind === "fire" && l.hp > 0) : false;
    if (w.elapsed < r.until && t && band && (foes!.folk.length || foes!.beasts.length || fires)) continue;
    active.delete(pack);
    next.set(pack, w.elapsed + RAID_EVERY * (winter(w) ? 0.5 : 1));
    for (const y of band ?? []) {
      y.targetId = 0;
      setState(y, "wander", y.homeX, y.homeY);
      emote(y, "😤", 1.5);
    }
    if (t && (t.found || t.seen)) w.toast("❄️", `The Yeti band has left the ${t.name} camp and gone back up to the snow.`, t.x, t.y);
  }
  // a band that's ready goes for the nearest Snow People camp
  for (const [pack, band] of Array.from(all)) {
    if (active.has(pack)) continue;
    const at = next.get(pack);
    if (at === undefined) {
      // a band that just formed has a look round first
      next.set(pack, w.elapsed + 60);
      continue;
    }
    if (w.elapsed < at) continue;
    const cx = band.reduce((s, d) => s + d.x, 0) / band.length;
    const cy = band.reduce((s, d) => s + d.y, 0) / band.length;
    const target = w.snowFolk.tribes
      .filter((t) => Math.hypot(t.x - cx, t.y - cy) < RAID_REACH)
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
    if (!target) {
      next.set(pack, w.elapsed + 60);
      continue;
    }
    active.set(pack, { pack, tribe: target.id, until: w.elapsed + RAID_LEN, doused: 0 });
    for (const y of band) {
      y.targetId = 0;
      y.fear = 0;
      setState(y, "roar", y.x, y.y);
    }
    w.sfx("roar", cx, cy, 1.2, 0.35);
    if (target.found || target.seen || w.inView(cx, cy, 200)) {
      w.toast("❄️", `A band of ${band.length} Yetis in matching scarves is raiding the ${target.name} Snow People! They stamp out the fires and throw snow, rocks and trees at anyone there.`, target.x, target.y);
    }
  }
}

/** The raid this Yeti's band is on (null = none). */
export function raidOf(w: World, d: Dino): (Raid & { t: SnowTribe }) | null {
  if (!d.yetiPack) return null;
  const r = raidsOf(w).get(d.yetiPack);
  const t = r ? tribeOf(w, r) : null;
  return r && t ? { ...r, t } : null;
}

/** Still worth chasing on a raid: alive and round the camp. */
export function raidChaseOk(w: World, d: Dino, x: number, y: number) {
  const r = raidOf(w, d);
  return !!r && Math.hypot(x - r.t.x, y - r.t.y) < r.t.r + 420;
}

/**
 * A raiding Yeti's brain (from yetiThink). True = decided. March to the camp; there, go for whoever
 * is close, else stamp out the nearest fire, else hunt down the rest of the camp.
 */
export function raidThink(w: World, d: Dino): boolean {
  const r = raidOf(w, d);
  if (!r) return false;
  const t = r.t;
  // (the fire-stamper drops a chase that strays from the fire it's after)
  const lit = t.lodges.some((l) => l.kind === "fire" && l.hp > 0);
  const first = !w.dinos.some((o) => o.species === "yeti" && o.yetiPack === d.yetiPack && o.id < d.id && o.state !== "faint");
  if (d.state === "chase" && d.targetId && !(first && lit)) return false;
  const fromCamp = Math.hypot(d.x - t.x, d.y - t.y);
  if (fromCamp > t.r + 40) {
    // in together: each a little off to one side
    const a = (d.id % 6) * 1.05;
    setState(d, "wander", t.x + Math.cos(a) * 40, t.y + Math.sin(a) * 28);
    if (w.rng() < 0.05) emote(d, "❗", 1.2);
    return true;
  }
  const { folk, beasts } = campFoes(w, t);
  const foes: { id: number; x: number; y: number }[] = [...folk, ...beasts];
  const near = (o: { x: number; y: number }) => Math.hypot(o.x - d.x, o.y - d.y);
  // one of the band (the first of them) goes for the fires while the rest fight: it only stops for
  // someone right in its way
  const stamper = !w.dinos.some((o) => o.species === "yeti" && o.yetiPack === d.yetiPack && o.id < d.id && o.state !== "faint");
  const close = foes.filter((o) => near(o) < (stamper ? 70 : 200)).sort((a, b) => near(a) - near(b))[0];
  const fire = t.lodges.filter((l) => l.kind === "fire" && l.hp > 0).sort((a, b) => near(a) - near(b))[0];
  if (!close && fire) {
    if (near(fire) < DOUSE_R) {
      fire.hp = 0;
      w.particles.burst(P.Steam, fire.x, fire.y, 12, 50, { vz: 28, size: 11, max: 1.3, color: "#dcecf4" });
      w.particles.burst(P.Poof, fire.x, fire.y, 8, 40, { size: 10, max: 0.8, color: "rgba(240,248,255,0.85)" });
      w.sfx("hiss", fire.x, fire.y, 0.9);
      emote(d, "❄️", 1.5);
      const raid = raidsOf(w).get(r.pack);
      if (raid && !raid.doused++ && (t.found || t.seen)) w.toast("🔥", `The Yetis stamped out the ${t.name} camp's fire!`, fire.x, fire.y);
    } else setState(d, "wander", fire.x, fire.y);
    return true;
  }
  const foe = close ?? foes.sort((a, b) => near(a) - near(b))[0];
  if (foe) {
    d.targetId = foe.id;
    setState(d, "roar", d.x, d.y);
    d.dir = foe.x > d.x ? 1 : -1;
    return true;
  }
  return false;
}
