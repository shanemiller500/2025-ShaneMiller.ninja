/* ------------------------------------------------------------------ */
/*  Neanderthals: rival clans the computer runs. A few small bands     */
/*  live in rough camps around the map. They're bigger and stronger    */
/*  than our people: clubs, stone axes, wooden spears + thrown rocks.  */
/*  They hunt, feud with each other, make pacts, merge, and every so   */
/*  often march on our camp: they club the men, carry the women (and,  */
/*  once they're cunning, the children) off to their camp and grab     */
/*  food. Kill the carrier (or reach their camp while it's unguarded)  */
/*  and they come home. We never get along with them.                  */
/*                                                                     */
/*  They get cleverer by spying on us. Each spy who makes it home      */
/*  teaches the clan something: first to ambush our people out in the  */
/*  wild, then to carry hide shields (good against our energy lances), */
/*  then to raid our stores for wood + stone as well as food.          */
/*  Everyone drops what they carried when they fall.                   */
/* ------------------------------------------------------------------ */
import { removeHuman } from "./death";
import { sp } from "../data/species";
import { CAMP_LEVELS, FEMALE_NAMES } from "../data/facts";
import { findSpawnSpot, isBaby, sizeOf } from "./dinos";
import { go } from "./humans";
import { hurtHuman } from "./injury";
import { goalKey, nodePos, tileOf } from "./nav";
import { P } from "./particles";
import { pick } from "./rng";
import { isWalkTile, isWaterTile } from "./terrain";
import { hitDino } from "./tribe";
import { MAP_H, MAP_W, TILE, type Brute, type BruteState, type BruteWeapon, type Clan, type ClanHold, type ClanTrap, type Human, type OurCatapult, type ItemKind, type Resource, type Wall } from "./types";
import type { World } from "./world";
import { BOULDER_DMG, CATAPULT_RANGE, CATAPULT_RELOAD, MAX_CAMP_TIER, boulderLands, colorsOf, hasEngines, isTown, siegeTarget, unite } from "./clanTowns";
import { boneSpikes } from "./behavior";
import { clanJob, extraRoom, huntPower, lifeAct, lvOf, spoilRate, trapTick, trapsUpdate, warDinoTick } from "./clanLife";
import { riteAct, riteTick, riteUpdate, type Rite } from "./clanRite";
import { armourOf, hasTech, mightOf, studyTick } from "./clanTech";
import { captivesSlow, captivesUpdate } from "./clanCaptives";
import { holdThink, holdsTick } from "./clanHolds";
import { ourCatapultsUpdate, seizeTick, type OurShot } from "./ourCatapults";

const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;

const CLAN_NAMES = ["Grak", "Thud", "Urrg", "Krag", "Mog", "Boru", "Drak", "Hrum", "Zub", "Gorn", "Vrok", "Bagh"];
const BRUTE_NAMES = ["Thog", "Urk", "Brum", "Mok", "Drog", "Hunk", "Gorr", "Bonk", "Krull", "Vug", "Zorg", "Ogg", "Rumm", "Tusk", "Krog", "Grum", "Bash", "Duk"];
const CLAN_COLORS = ["#c0392b", "#2e86de", "#8e44ad", "#16a085", "#d35400", "#7f8c8d"];

/** How hard each weapon hits people, walls; and whether it can be thrown. */
export const BRUTE_WEAPONS: Record<BruteWeapon, { hit: number; wall: number; throw: number; range: number }> = {
  club: { hit: 0.34, wall: 18, throw: 0, range: 0 },
  axe: { hit: 0.4, wall: 22, throw: 0, range: 0 },
  spear: { hit: 0.3, wall: 10, throw: 0.2, range: 150 },
  rock: { hit: 0.24, wall: 12, throw: 0.16, range: 125 },
  sling: { hit: 0.28, wall: 12, throw: 0.26, range: 260 },
  // the Tree People's (treeFolk.ts keeps their own, lighter numbers)
  bone: { hit: 0.26, wall: 6, throw: 0.12, range: 0 },
  bow: { hit: 0.12, wall: 4, throw: 0.16, range: 280 },
  // a clan town's siege engine (clanTowns.ts): no melee, it lobs flaming boulders from beyond Scorpion range
  // (740 = CATAPULT_RANGE: written out so this table never waits on clanTowns.ts loading first)
  catapult: { hit: 0, wall: 0, throw: 0, range: 740 },
};

/** Tough: our hits are divided by this (a person is ~1; a raptor raider ~2). */
export const BRUTE_TOUGH = 150;
const REACH = 24;
const SPEED = 40;
export const MAX_CLANS = 6;
const MAX_BRUTES = 14;
export const GROWN_AGE = 180;

export const isFemale = (h: Human) => FEMALE_NAMES.has(h.name);

/** A thrown spear or rock in flight. */
export interface Missile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  dur: number;
  target: number;
  dmg: number;
  kind: "spear" | "rock" | "sling" | "boulder" | "fireball" | "arrow" | "gore";
  targetKind?: "scorpion" | "tower" | "wall" | "camp";
  goreName?: string;
}

const relKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export class Rivals {
  clans: Clan[] = [];
  brutes: Brute[] = [];
  missiles: Missile[] = [];
  /** hidden pit traps the clans have dug (clanLife.ts) */
  traps: ClanTrap[] = [];
  /** a dragon offering under way (clanRite.ts) */
  rite: Rite | null = null;
  /** parts of our town a clan has taken (clanHolds.ts) */
  holds: ClanHold[] = [];
  /** clan catapults we captured, and their boulders in flight (ourCatapults.ts) */
  taken: OurCatapult[] = [];
  ourShots: OurShot[] = [];
  /** clan pair → -1 war, 0 wary, 1 allies */
  rel = new Map<string, number>();
  /** clans have shown up in this world */
  started = false;
  private nextClan = 1;
  private relT = 90;
  private arriveT = 300;
  private tickT = 0;

  /* ------------------------------ lookups ------------------------------ */

  byId(id: number): Brute | null {
    for (const b of this.brutes) if (b.id === id) return b;
    return null;
  }
  clan(id: number) {
    return this.clans.find((c) => c.id === id) ?? null;
  }
  members(id: number) {
    return this.brutes.filter((b) => b.clan === id);
  }
  relation(a: number, b: number) {
    return a === b ? 1 : this.rel.get(relKey(a, b)) ?? 0;
  }
  setRelation(a: number, b: number, v: number) {
    if (a !== b) this.rel.set(relKey(a, b), v);
  }
  /** People held by the clans (the Tree People's captives have a negative id: see treeFolk.ts). */
  captives(w: World, clan?: number) {
    return w.humans.filter((h) => (h.captive ?? 0) > 0 && (clan === undefined || h.captive === clan));
  }

  /** Should our guards + defenses shoot this one? Always (the clans and us never get along), once they can see it:
   *  a Tree Person hidden up in the leaves isn't a target until it shows itself. */
  hostile(w: World, b: Brute) {
    // (nor are their little ones up on the decks: TREE_GROWN, written out so this never waits on treeFolk.ts loading)
    // after dark a Tree Person (or a Sea Person out in a canoe) is a shadow: only seen up close, by firelight,
    // or once they strike (treeFolk.ts / seaFolk.ts set spotT)
    if (b.tree && (b.hidden || (b.age ?? 100) < 100)) return false;
    if (b.sea && (b.age ?? 120) < 120) return false;
    if ((b.tree || (b.sea && b.boat)) && w.daylight < 0.3 && !((b.spotT ?? 0) > 0)) return false;
    return !!w && !!b;
  }
  /** "Thog the Neanderthal" / "Kit of the Moss Eye Tree People" / "Nalu of the Salt Fin Sea People" */
  label(w: World, b: Brute) {
    return b.tree ? w.forest.label(b) : b.sea ? w.seaFolk.label(b) : `${b.name} the Neanderthal`;
  }
  /** Any hostile Neanderthal within r of (x, y)? */
  threatNear(w: World, x: number, y: number, r: number) {
    return this.brutes.some((b) => this.hostile(w, b) && Math.hypot(b.x - x, b.y - y) < r);
  }

  /* ------------------------------ making them ------------------------------ */

  addBrute(w: World, clan: Clan, x: number, y: number, o: Partial<Brute> = {}): Brute {
    const used = new Set(this.brutes.map((b) => b.name));
    const free = BRUTE_NAMES.filter((n) => !used.has(n));
    const r = w.rng();
    const b: Brute = {
      id: w.nextId(),
      kind: "brute",
      name: pick(w.rng, free.length ? free : BRUTE_NAMES),
      clan: clan.id,
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      dir: w.rng() < 0.5 ? 1 : -1,
      hp: 1,
      weapon: (clan.smarts ?? 0) >= 4 && r < 0.6 ? "sling" : r < 0.45 ? "club" : r < 0.7 ? "axe" : r < 0.9 ? "spear" : "rock",
      tint: clan.color,
      state: "idle",
      stateT: 0,
      think: w.rng() * 2,
      tx: x,
      ty: y,
      targetId: 0,
      cd: 0,
      anim: w.rng() * 10,
      path: null,
      pathI: 0,
      pathKey: 0,
      stuckT: 0,
      raid: false,
      war: 0,
      captive: 0,
      loot: 0,
      age: GROWN_AGE,
      forage: 0,
      forageKind: "berries",
      bubble: null,
      ...o,
    };
    this.brutes.push(b);
    return b;
  }

  /** A spot for a camp: well away from ours, other clans and the volcano. */
  private dryCamp(w: World, x: number, y: number) {
    // Reserve the town's ground and the spots where its later buildings stand.
    for (let dy = -160; dy <= 160; dy += 24) for (let dx = -300; dx <= 300; dx += 24) {
      if ((dx / 300) ** 2 + (dy / 160) ** 2 > 1) continue;
      const t = w.terrain.tileAt(x + dx, y + dy);
      if (!isWalkTile(t) || isWaterTile(t)) return false;
    }
    for (const [sx, sy] of [[-355, -35], [341, -64], [-312, 125], [363, 139], [0, -276], [-15, 276]]) {
      for (const [dx, dy] of [[0, 0], [-32, 0], [32, 0], [0, -32], [0, 32]]) {
        const t = w.terrain.tileAt(x + sx + dx, y + sy + dy);
        if (!isWalkTile(t) || isWaterTile(t)) return false;
      }
    }
    return w.nav.passable("dino", x, y);
  }

  private dryCampNear(w: World, x: number, y: number) {
    if (this.dryCamp(w, x, y)) return { x, y };
    for (let radius = 32; radius <= 960; radius += 32) {
      const count = Math.max(8, Math.ceil(radius / 32) * 8);
      for (let i = 0; i < count; i++) {
        const a = i * Math.PI * 2 / count;
        const px = x + Math.cos(a) * radius;
        const py = y + Math.sin(a) * radius;
        if (this.dryCamp(w, px, py)) return { x: px, y: py };
      }
    }
    return null;
  }

  private bySea(w: World, x: number, y: number) {
    for (let dy = -640; dy <= 640; dy += 64) for (let dx = -640; dx <= 640; dx += 64) {
      if (dx * dx + dy * dy <= 640 * 640 && w.terrain.isSalt(x + dx, y + dy) && isWaterTile(w.terrain.tileAt(x + dx, y + dy))) return true;
    }
    return false;
  }

  campSpot(w: World): { x: number; y: number } | null {
    const c = w.camp;
    const raptor = sp("raptor");
    for (let k = 0; k < 160; k++) {
      const a = w.rng() * Math.PI * 2;
      const r = 1500 + w.rng() * 1700;
      const x = Math.max(260, Math.min(WORLD_W - 260, c.x + Math.cos(a) * r));
      const y = Math.max(260, Math.min(WORLD_H - 200, c.y + Math.sin(a) * r * 0.8));
      if (Math.hypot(x - c.x, y - c.y) < 1300) continue;
      if (Math.hypot(x - w.volcano.x, y - w.volcano.y) < 650) continue;
      if (this.clans.some((o) => Math.hypot(o.x - x, o.y - y) < 700)) continue;
      // never in the Tree People's woods
      if (w.forest.tribes.some((t) => Math.hypot(t.x - x, t.y - y) < t.r + 450)) continue;
      const s = findSpawnSpot(w, raptor, x, y, 120);
      if (!s || !this.dryCamp(w, s.x, s.y)) continue;
      // finding firm ground can nudge the spot: it still has to be well away from us
      if (Math.hypot(s.x - c.x, s.y - c.y) < 1300) continue;
      if (w.tribe.enclosed(w, s.x, s.y)) continue;
      return s;
    }
    return null;
  }

  /** A new clan settles nearby. */
  spawnClan(w: World, n = 4 + Math.floor(w.rng() * 2), at?: { x: number; y: number }): Clan | null {
    if (this.clans.length >= MAX_CLANS) return null;
    const spot = at ? this.dryCampNear(w, at.x, at.y) : this.campSpot(w);
    if (!spot) return null;
    const used = new Set(this.clans.map((c) => c.name));
    const names = CLAN_NAMES.filter((x) => !used.has(x));
    const clan: Clan = {
      id: this.nextClan++,
      name: pick(w.rng, names.length ? names : CLAN_NAMES),
      color: CLAN_COLORS[(this.nextClan - 2) % CLAN_COLORS.length],
      x: spot.x,
      y: spot.y,
      food: 12,
      raidT: 600 + w.rng() * 360,
      growT: 110 + w.rng() * 80,
      style: (["hide", "timber", "bone"] as const)[(this.nextClan - 2) % 3],
      campTier: 0,
      campWork: 0,
      sea: this.bySea(w, spot.x, spot.y),
    };
    this.clans.push(clan);
    for (let i = 0; i < n; i++) this.addBrute(w, clan, spot.x + (w.rng() - 0.5) * 80, spot.y + 20 + (w.rng() - 0.5) * 40);
    return clan;
  }

  /* ------------------------------ fighting ------------------------------ */

  /** Our spear / arrow / bolt (or another Neanderthal's club) lands. */
  hit(w: World, b: Brute, dmg: number, fx: number, fy: number, byBrute = false, proj?: string) {
    // the Tree People take hits their own way (lighter; they scatter or swarm whoever did it); so do the Sea People
    if (b.tree) return w.forest.hit(w, b, dmg, fx, fy, byBrute, proj);
    if (b.sea) return w.seaFolk.hit(w, b, dmg, fx, fy, byBrute, proj);
    // cunning clans carry hide shields: they soak up a lot of an energy lance, some of an arrow
    const clan = this.clan(b.clan);
    // close up, our people seize a catapult rather than smash it (ourCatapults.ts)
    if (b.weapon === "catapult" && proj === "melee") {
      if (w.rng() < 0.2) say(b, "Grr!", 1);
      return;
    }
    if (!byBrute && clan && ((clan.smarts ?? 0) >= 2 || hasTech(clan, "hideShields")) && b.state !== "carry") {
      const block = Math.min(0.85, (proj === "scorpion" && (clan.smarts ?? 0) >= 4 ? 0.72 : proj === "beam" || proj === "lance" ? 0.55 : proj ? 0.25 : 0.1) + (proj === "scorpion" && colorsOf(clan).length > 1 ? 0.1 : 0));
      dmg *= 1 - block;
      if (block > 0.3 && w.rng() < 0.4) w.particles.burst(P.Spark, b.x + b.dir * 8, b.y, 6, 60, { z: 20, size: 2, max: 0.4, color: "#c9f7ff" });
    }
    if (b.weapon === "catapult") dmg *= 0.35; // a timber frame takes a lot of breaking
    dmg *= 1 - (b.skill ?? 0) * 0.35; // trained at the ring: harder to put down
    if (!byBrute) dmg *= armourOf(clan); // bone armour, then masterwork
    b.hp -= byBrute ? dmg : dmg / BRUTE_TOUGH;
    w.particles.burst(P.Star, b.x, b.y, 2, 30, { z: 26, size: 5, max: 0.6 });
    w.sfx("thunk", b.x, b.y, 0.7, 0.8);
    if (b.hp <= 0) return this.kill(w, b);
    if (w.rng() < 0.4) say(b, pick(w.rng, ["RAAGH!", "Grrr!", "Ugh!", "Hurt!"]), 1.4);
    if (!byBrute && proj === "scorpion" && (clan?.smarts ?? 0) >= 4) this.counterFire(w, b, clan!);
    // turn on whoever did it
    if (!byBrute && !b.captive && b.hp > 0.3 && b.state !== "fight") {
      const h = nearestHuman(w, fx, fy, 260, false);
      if (h) {
        b.targetId = h.id;
        setB(b, "fight", h.x, h.y);
      }
    }
    if (b.hp < 0.25 && b.state !== "flee") this.goHome(w, b, "flee");
  }

  kill(w: World, b: Brute) {
    this.dropCaptive(w, b, true);
    // whatever he stole comes back; and every Neanderthal drops a little something
    if (b.loot) {
      const kind = b.lootKind ?? "berries";
      w.camp.stock[kind] += b.loot;
      w.toast("🎒", `Got back ${b.loot} ${kind} that ${b.name} stole!`, b.x, b.y);
      b.loot = 0;
    }
    if (b.tree || b.sea) {
      const k = this.brutes.indexOf(b);
      if (k >= 0) this.brutes.splice(k, 1);
      if (b.tree) w.forest.died(w, b);
      else w.seaFolk.died(w, b);
      return;
    }
    if (b.forage) w.addItem(b.forageKind ?? "berries", b.x, b.y, { amount: b.forage });
    w.particles.burst(P.Poof, b.x, b.y, 10, 60, { size: 12, max: 0.9, color: "rgba(200,190,170,0.9)" });
    w.addItem("bones", b.x, b.y);
    w.addItem("meat", b.x + 10, b.y + 4, { amount: 1 });
    if (w.rng() < 0.6) w.addItem(b.weapon === "rock" ? "stone" : "stick", b.x - 10, b.y + 2);
    const i = this.brutes.indexOf(b);
    if (i >= 0) this.brutes.splice(i, 1);
    const clan = this.clan(b.clan);
    if (b.raid || Math.hypot(b.x - w.camp.x, b.y - w.camp.y) < 900) {
      w.toast("💀", `${b.name} the Neanderthal is down!`, b.x, b.y);
      w.sfx("thud", b.x, b.y, 0.8, 0.7);
    }
    if (clan && !this.members(clan.id).length) this.clanGone(w, clan);
  }

  private clanGone(w: World, clan: Clan, quiet = false) {
    this.clans.splice(this.clans.indexOf(clan), 1);
    for (const k of Array.from(this.rel.keys())) if (k.split(":").includes(String(clan.id))) this.rel.delete(k);
    // nobody left to guard the captives: they walk home
    for (const h of this.captives(w, clan.id)) this.free(w, h, `${h.name} is free: the ${clan.name} clan is gone!`);
    if (!quiet) w.toast("🏳️", `The ${clan.name} clan of Neanderthals is no more.`, clan.x, clan.y);
  }

  /** A person comes home. */
  free(w: World, h: Human, msg: string) {
    h.captive = 0;
    h.chore = null;
    h.captiveT = 0;
    h.clanGarb = undefined;
    h.z = 0;
    h.path = null;
    h.pathKey = 0;
    h.hp = Math.max(h.hp, 0.3);
    go(h, "flee", w.camp.caveX + (w.rng() - 0.5) * 40, w.camp.caveY + 30);
    h.think = 6;
    say(h, pick(w.rng, ["I'm free!", "Home! Home!", "Thank you!"]), 3);
    w.toast("🎉", msg, h.x, h.y);
    w.celebrate("Rescued!");
  }

  dropCaptive(w: World, b: Brute, killed: boolean) {
    if (!b.captive) return;
    const h = w.humans.find((o) => o.id === b.captive);
    b.captive = 0;
    if (h && h.captive) {
      h.x = b.x + b.dir * 10;
      h.y = b.y + 4;
      this.free(w, h, killed ? `${h.name} got away when ${b.name} went down!` : `${h.name} wriggled free!`);
    }
  }

  private goHome(w: World, b: Brute, s: BruteState = "home") {
    const clan = this.clan(b.clan);
    b.raid = false;
    b.war = 0;
    if (!clan) return;
    setB(b, s, clan.x + (w.rng() - 0.5) * 60, clan.y + 10 + (w.rng() - 0.5) * 30);
  }

  /* ------------------------------ raids on us ------------------------------ */

  /** A clan (and any allies who fancy it) marches on our camp. */
  startRaid(w: World, clan: Clan) {
    const t = w.tribe;
    if (t.raid || !clan) return false;
    const own = this.members(clan.id).filter((b) => (b.age ?? GROWN_AGE) >= GROWN_AGE && b.hp > 0.5 && !b.captive && !b.war);
    // someone always stays home to mind the camp (and any captives)
    const stay = own.length >= 4 ? 1 : 0;
    const party = own.slice(0, own.length - stay);
    let allies = 0;
    for (const o of this.clans) {
      if (o === clan || this.relation(o.id, clan.id) !== 1 || allies >= 4) continue;
      const help = this.members(o.id).filter((b) => (b.age ?? GROWN_AGE) >= GROWN_AGE && b.hp > 0.6 && !b.war && !b.captive && b.weapon !== "catapult").slice(0, 2);
      party.push(...help);
      allies += help.length;
    }
    if (party.length < 2) return false;
    // a clan town rolls out its catapult(s)
    if (hasEngines(clan)) {
      const want = (clan.campTier ?? 0) >= MAX_CAMP_TIER ? 2 : 1;
      const captives = this.captives(w, clan.id).filter((h) => !h.child && !this.brutes.some((b) => b.captive === h.id));
      for (let i = 0; i < want; i++) party.push(this.addBrute(w, clan, clan.x + (i - 0.5) * 40, clan.y + 30, { weapon: "catapult", name: "Catapult", age: GROWN_AGE, siegeCaptive: captives[i]?.id, siegeShots: 0 }));
    }
    for (const b of party) {
      b.raid = true;
      b.war = 0;
      setB(b, "rally", b.x, b.y);
      say(b, pick(w.rng, ["UGH! UGH!", "Smash!", "Take food!", "RAAAH!"]), 2.5);
    }
    const label = `The ${clan.name} clan${allies ? " + friends" : ""} (Neanderthals)`;
    t.raid = { phase: "warn", t: 0, ids: party.map((b) => b.id), fromX: clan.x, fromY: clan.y, breached: false, label, by: "brute" };
    // the other clans hold off for a while (one war at a time is plenty)
    for (const o of this.clans) if (o !== clan) o.raidT = Math.max(o.raidT, 240 + w.rng() * 120);
    w.sfx("drums", w.camp.x, w.camp.y, 1.2, 0.8);
    w.toast("🪓", `${label}: ${party.length} big brutes are coming to raid! Close the gates, arm the guards!`, clan.x, clan.y);
    if (!w.flags.has("bruteRaidTip")) {
      w.flags.add("bruteRaidTip");
      w.toast("⚠️", "Neanderthals club the men and carry women off to their camp. Kill the carrier to free her!", clan.x, clan.y);
    }
    return true;
  }

  /* ------------------------------ cunning ------------------------------ */

  /** Send one Neanderthal to creep up and watch our camp from the edge. */
  sendSpy(w: World, clan: Clan) {
    const b = this.members(clan.id).find((o) => (o.age ?? GROWN_AGE) >= GROWN_AGE && o.hp > 0.6 && !o.raid && !o.war && !o.captive && !o.ambush && o.state !== "spy");
    if (!b) return false;
    const c = w.camp;
    const a = Math.atan2(clan.y - c.y, clan.x - c.x) + (w.rng() - 0.5) * 0.8;
    const r = CAMP_R(w) + 160;
    let x = c.x + Math.cos(a) * r;
    let y = c.y + Math.sin(a) * r * 0.8;
    if (!w.nav.passable("dino", x, y)) {
      x = c.x + Math.cos(a) * (r + 80);
      y = c.y + Math.sin(a) * (r + 80) * 0.8;
    }
    setB(b, "spy", x, y);
    if (!w.flags.has("spyTip")) {
      w.flags.add("spyTip");
      w.toast("👀", `A Neanderthal from the ${clan.name} clan is sneaking up to spy on the camp! Stop him before he gets home — every spy teaches his clan new tricks.`, x, y);
    } else w.toast("👀", `${b.name} of the ${clan.name} clan is spying on the camp!`, x, y);
    return true;
  }

  /** A spy made it back: the clan learns from what it saw. */
  learn(w: World, clan: Clan) {
    clan.intel = (clan.intel ?? 0) + 1;
    const next = clan.intel >= 7 ? 4 : clan.intel >= 5 ? 3 : clan.intel >= 3 ? 2 : clan.intel >= 1 ? 1 : 0;
    if (next <= (clan.smarts ?? 0)) return;
    clan.smarts = next;
    const what = [
      "",
      "learned to set ambushes for anyone working far from camp",
      "made hide shields — our energy lances and arrows hurt them much less now",
      "worked out where we keep our stores: they'll raid them for wood + stone, and snatch children too",
      "built stone shields that turn Scorpion bolts aside and learned to answer with long-range slings",
    ][next];
    if (next >= 4) for (const b of this.members(clan.id)) if (b.weapon === "rock" || b.weapon === "club") b.weapon = "sling";
    w.toast("🧠", `The ${clan.name} clan has been watching us and ${what}!`, clan.x, clan.y);
  }

  /** Once a clan has learned sling warfare, a Scorpion hit draws a counter-shot. */
  private counterFire(w: World, b: Brute, clan: Clan) {
    const sc = w.colony.scorpions.filter((s) => s.built >= 1 && s.hp > 0 && Math.hypot(s.x - b.x, s.y - b.y) < 620).sort((a, z) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(z.x - b.x, z.y - b.y))[0];
    if (!sc || b.cd > 0 || b.state === "carry" || b.hp <= 0) return;
    b.weapon = "sling";
    b.cd = 4.5 + w.rng() * 2;
    b.dir = sc.x > b.x ? 1 : -1;
    const dist = Math.hypot(sc.x - b.x, sc.y - b.y);
    const flight = Math.max(0.3, dist / 310);
    const tx = sc.x + (w.rng() - 0.5) * 22;
    const ty = sc.y + (w.rng() - 0.5) * 16;
    this.missiles.push({ x: b.x, y: b.y, z: 24, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (14 - 24) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: sc.id, targetKind: "scorpion", dmg: 46, kind: "sling" });
    w.sfx("whoosh", b.x, b.y, 0.45, 1.2);
  }

  /** Hide 2-3 warriors in the grass next to one of ours working out in the wild. */
  setAmbush(w: World, clan: Clan) {
    const c = w.camp;
    const prey = w.humans.filter((h) => !h.child && !h.stranger && !h.captive && !h.under && h.level === 0 && Math.hypot(h.x - c.x, h.y - c.y) > CAMP_R(w) + 120 && Math.hypot(h.x - clan.x, h.y - clan.y) < 2200 && !w.tribe.enclosed(w, h.x, h.y));
    if (!prey.length) return false;
    const h = prey[Math.floor(w.rng() * prey.length)];
    const party = this.members(clan.id).filter((o) => (o.age ?? GROWN_AGE) >= GROWN_AGE && o.hp > 0.6 && !o.raid && !o.war && !o.captive && !o.ambush && o.state !== "spy").slice(0, clan.campTier ? 4 : 3);
    if (party.length < 2) return false;
    const a = w.rng() * Math.PI * 2;
    for (let i = 0; i < party.length; i++) {
      const o = party[i];
      const x = h.x + Math.cos(a + i * 0.5) * 120;
      const y = h.y + Math.sin(a + i * 0.5) * 80;
      o.ambush = true;
      setB(o, "walk", w.nav.passable("dino", x, y) ? x : h.x + Math.cos(a) * 90, w.nav.passable("dino", x, y) ? y : h.y);
    }
    return true;
  }

  /** Where a raider heads for loot: the stockpile, or (cunning clans) the nearest storehouse. */
  private storeFor(w: World, b: Brute, clan: Clan) {
    const c = w.camp;
    let best = { x: c.pileX, y: c.pileY };
    if ((clan.smarts ?? 0) < 3) return best;
    let bd = Math.hypot(b.x - c.pileX, b.y - c.pileY);
    for (const s of w.colony.buildings) {
      if ((s.kind !== "storage" && s.kind !== "foodStore") || s.built < 1) continue;
      const door = w.colony.door(s);
      const d = Math.hypot(b.x - door.x, b.y - door.y);
      if (d < bd) {
        bd = d;
        best = door;
      }
    }
    return best;
  }

  /** Our people reached an empty clan camp: carry off their food (+ whatever they stole). */
  plunder(w: World, clan: Clan) {
    const food = Math.floor(Math.min(clan.food, 6));
    clan.food -= food;
    w.camp.stock.meat += food;
    // a raid hurts them: they lose some of what they learned about us
    if ((clan.intel ?? 0) > 0) clan.intel = (clan.intel ?? 0) - 1;
    return food;
  }

  /* ------------------------------ clan politics ------------------------------ */

  private politics(w: World) {
    if (this.clans.length < 2) return;
    const a = this.clans[Math.floor(w.rng() * this.clans.length)];
    const others = this.clans.filter((c) => c !== a);
    const b = others[Math.floor(w.rng() * others.length)];
    const na = this.members(a.id).length;
    const nb = this.members(b.id).length;
    const roll = w.rng();
    // the clans are all friends now: any old feud is made up, and friends unite into one band
    if (this.relation(a.id, b.id) !== 1) {
      this.setRelation(a.id, b.id, 1);
      w.toast("🤝", `The ${a.name} and ${b.name} clans are friends now.`, a.x, a.y);
      return;
    }
    if (roll < 0.35 || Math.min(na, nb) <= 3) {
      const [big, small] = na >= nb ? [a, b] : [b, a];
      this.merge(w, small, big);
      return;
    }
    const r = this.relation(a.id, b.id);
    if (r === 0) {
      if (roll < 0.4) {
        this.setRelation(a.id, b.id, -1);
        w.toast("⚔️", `The ${a.name} and ${b.name} Neanderthal clans are feuding!`, a.x, a.y);
      } else if (roll < 0.65) {
        this.setRelation(a.id, b.id, 1);
        w.toast("🤝", `The ${a.name} and ${b.name} clans made a pact. They may raid together…`, a.x, a.y);
      }
    } else if (r === -1) {
      if (roll < 0.15) {
        this.setRelation(a.id, b.id, 0);
        return;
      }
      // the bigger band goes looking for a fight
      const [att, def] = na >= nb ? [a, b] : [b, a];
      this.warParty(w, att, def);
    } else if (r === 1 && Math.min(na, nb) <= 1) {
      const [big, small] = na >= nb ? [a, b] : [b, a];
      this.merge(w, small, big);
    }
  }

  /** Send warriors to beat up another clan. */
  warParty(w: World, att: Clan, def: Clan) {
    const party = this.members(att.id).filter((b) => (b.age ?? GROWN_AGE) >= GROWN_AGE && b.hp > 0.55 && !b.raid && !b.captive);
    if (party.length < 2) return false;
    for (const b of party.slice(0, Math.max(2, party.length - 1))) {
      b.war = def.id;
      setB(b, "walk", def.x + (w.rng() - 0.5) * 60, def.y + (w.rng() - 0.5) * 40);
    }
    return true;
  }

  /** One clan joins another (members, food + captives move over). */
  merge(w: World, from: Clan, into: Clan) {
    for (const b of this.members(from.id)) {
      b.clan = into.id;
      b.war = 0;
      setB(b, "walk", into.x + (w.rng() - 0.5) * 70, into.y + 14 + (w.rng() - 0.5) * 30);
    }
    for (const h of this.captives(w, from.id)) {
      h.captive = into.id;
      h.x = into.x + (w.rng() - 0.5) * 50;
      h.y = into.y + 24;
    }
    into.food += from.food;
    into.campWork = (into.campWork ?? 0) + (from.campWork ?? 0) * 0.5;
    const was = into.name;
    unite(from, into);
    w.toast("🤝", `The ${from.name} and ${was} clans united into the ${into.name} clan: ${this.members(into.id).length} Neanderthals strong, flying ${colorsOf(into).length} colours. Their camp is growing into a town!`, into.x, into.y);
    this.clanGone(w, from, true);
  }

  /* ------------------------------ update ------------------------------ */

  update(w: World, dt: number) {
    // the end of the world spares nobody
    const ext = w.extinction.phase;
    if (ext === "aftermath" || ext === "ended" || ext === "ruins") {
      if (this.brutes.length || this.clans.length) this.clear();
      return;
    }
    if (!this.started && w.elapsed > 150 && w.humans.length) {
      this.started = true;
      this.spawnClan(w);
      this.spawnClan(w);
      this.spawnClan(w);
    }
    if (!this.started) return;
    this.updateMissiles(w, dt);
    trapsUpdate(w, this, dt);
    riteUpdate(w, this, dt);
    captivesUpdate(w, this, dt);
    ourCatapultsUpdate(w, this, dt);
    for (let i = this.brutes.length - 1; i >= 0; i--) {
      const b = this.brutes[i];
      if (!b) continue;
      // falling from a dragon's claws: the dragons move the body
      if (b.falling) continue;
      if (b.snatched) {
        // a Sea Person snatched off their sea dragon: it's free
        if (b.mount) w.seaFolk.dismount(w, b);
        const dr = w.dragons.anyById(b.snatched);
        if (dr && dr.prey === b.id) {
          b.x = dr.x;
          b.y = dr.y + 2;
          b.z = Math.max(0, dr.z - 26);
          b.anim += dt * 8;
          if (w.rng() < dt * 0.5) say(b, pick(w.rng, ["RAAAGH!", "Let go!", "NO!"]), 1.2);
          continue;
        }
        b.snatched = undefined;
        b.z = 0;
      }
      b.stateT += dt;
      b.cd = Math.max(0, b.cd - dt);
      if (b.bubble) {
        b.bubble.t -= dt;
        if (b.bubble.t <= 0) b.bubble = null;
      }
      // lava + fire hurt them like anyone
      const here = tileOf(b.x, b.y);
      if ((w.lava.heat[here] > 0.2 || w.fire.heat[here] > 0.45) && w.rng() < dt * 2) {
        this.hit(w, b, 0.12, b.x, b.y - 10, true);
        if (!this.brutes.includes(b)) continue;
      }
      // the Tree People have their own brains (treeFolk.ts)
      if (b.tree) {
        w.forest.step(w, b, dt);
        continue;
      }
      if (b.sea) {
        w.seaFolk.step(w, b, dt);
        continue;
      }
      b.think -= dt;
      if (b.think <= 0) this.thinkBrute(w, b);
      this.actBrute(w, b, dt);
    }
    // captives stay put at the camp (being carried is handled by the carrier)
    for (const h of w.humans) {
      if (!h.captive) continue;
      const carried = this.brutes.some((b) => b.captive === h.id);
      if (!carried) h.z = 0;
    }
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 1;
      this.slowTick(w, 1);
    }
  }

  /** Once a second: food, growth, raids, politics, rescues. */
  private slowTick(w: World, dt: number) {
    const t = w.tribe;
    for (const clan of [...this.clans]) {
      const members = this.members(clan.id);
      const n = members.length;
      if (!n) {
        this.clanGone(w, clan);
        continue;
      }
      clan.food = Math.max(0, clan.food - n * 0.004 * dt * spoilRate(clan));
      if (clan.sea) {
        clan.fishT = (clan.fishT ?? 30) - dt;
        if (clan.fishT <= 0) {
          clan.food += 1;
          clan.fishT = 30;
        }
      }
      if (clan.altarBlood) clan.altarBlood = Math.max(0, clan.altarBlood - dt / 400);
      for (const b of members) b.age = Math.min(GROWN_AGE, (b.age ?? GROWN_AGE) + (clan.food > 0 ? dt : dt * 0.4));
      // Adults at home improve their own camp. A stocked camp can house more children.
      const workers = members.filter((b) => (b.age ?? GROWN_AGE) >= GROWN_AGE && !b.raid && !b.war && !b.ambush && Math.hypot(b.x - clan.x, b.y - clan.y) < 180).length;
      if (workers && clan.food >= 3 && (clan.campTier ?? 0) < (colorsOf(clan).length > 1 ? MAX_CAMP_TIER : 3)) {
        clan.campWork = (clan.campWork ?? 0) + workers * dt * 0.025;
        if (clan.campWork >= 12 + (clan.campTier ?? 0) * 6) {
          clan.campWork = 0;
          clan.campTier = (clan.campTier ?? 0) + 1;
          clan.food -= 2;
          w.toast("🏕️", isTown(clan) ? `The ${clan.name} clan town grew bigger.` : `The ${clan.name} clan expanded its ${clan.style ?? "hide"} camp.`, clan.x, clan.y);
          if (hasEngines(clan) && !w.flags.has(`engines${clan.id}`)) {
            w.flags.add(`engines${clan.id}`);
            w.toast("🪨", `The ${clan.name} clan town has built a catapult. It throws flaming boulders from beyond our Scorpions' reach: go out and smash it!`, clan.x, clan.y);
          }
        }
      }
      // Children are born only if the clan can feed and house them.
      // families: more of them with people who've joined from our tribe and settled in
      const settled = members.filter((b) => b.turned && (b.age ?? GROWN_AGE) >= GROWN_AGE);
      clan.growT -= dt * (1 + settled.length * 0.4);
      if (clan.growT <= 0) {
        clan.growT = 115 + w.rng() * 75;
        if (clan.food >= 4 && n < Math.min(MAX_BRUTES + extraRoom(clan), 6 + (clan.campTier ?? 0) * 3 + extraRoom(clan))) {
          clan.food -= 3;
          // one who joined us… joined them: their child takes after them
          const parent = settled.length && w.rng() < 0.6 ? pick(w.rng, settled) : null;
          const b = this.addBrute(w, clan, (parent?.x ?? clan.x) + (w.rng() - 0.5) * 40, (parent?.y ?? clan.y) + 20, { age: 0, ...(parent?.look && w.rng() < 0.6 ? { look: { ...parent.look } } : {}) });
          say(b, "Baby!", 2);
          if (parent) {
            say(parent, "Our little one!", 2.5);
            w.toast("👶", `${parent.name}, who joined the ${clan.name} clan, has a baby. They've made their life there now.`, parent.x, parent.y);
          } else w.toast("👶", `A child was born to the ${clan.name} clan.`, clan.x, clan.y);
        }
      }
      // pit traps where our people walk; offerings to the dragons
      trapTick(w, this, clan, dt);
      riteTick(w, this, clan, dt);
      warDinoTick(w, this, clan);
      // their own science (faster with every union, more hands, totems, and captives to learn from)
      studyTick(w, clan, dt, members.filter((b) => (b.age ?? GROWN_AGE) >= GROWN_AGE && b.weapon !== "catapult").length, lvOf(clan, "boneTotem"), this.captives(w, clan.id).length);
      // spies come to watch us; a clan that's learned how sets ambushes for our people out in the wild
      const day = w.daylight > 0.45;
      if (t.danger !== "calm" && w.elapsed > 300 && day && !t.raid) {
        clan.spyT = (clan.spyT ?? 150 + w.rng() * 120) - dt;
        if (clan.spyT <= 0) {
          clan.spyT = 200 + w.rng() * 160;
          this.sendSpy(w, clan);
        }
        if ((clan.smarts ?? 0) >= 1 || (clan.campTier ?? 0) >= 2) {
          clan.ambushT = (clan.ambushT ?? 120) - dt;
          if (clan.ambushT <= 0) {
            clan.ambushT = 180 + w.rng() * 160;
            this.setAmbush(w, clan);
          }
        }
      }
      // raids on us: hungry clans come sooner; nobody raids a calm world
      const ready = t.danger !== "calm" && w.elapsed > 480 && (w.camp.learned.has("spear") || t.level >= 1 || w.elapsed > 900);
      if (ready && !t.raid) {
        clan.raidT -= dt * (t.danger === "wild" ? 1.7 : 1) * (clan.food < 2 ? 1.5 : 1) * (1 + (clan.campTier ?? 0) * 0.16);
        if (clan.raidT <= 0) {
          clan.raidT = 600 + w.rng() * 400;
          this.startRaid(w, clan);
        }
      }
    }
    // rescue: reach a captive while no Neanderthal of that clan is close by
    for (const h of this.captives(w)) {
      if (this.brutes.some((b) => b.captive === h.id)) continue;
      const clan = this.clan(h.captive!);
      if (!clan) {
        this.free(w, h, `${h.name} found the way home!`);
        continue;
      }
      const guarded = this.brutes.some((b) => b.clan === clan.id && b.hp > 0.2 && Math.hypot(b.x - h.x, b.y - h.y) < 170);
      const friend = w.humans.some((o) => o !== h && !o.captive && !o.child && !o.stranger && o.state !== "down" && Math.hypot(o.x - h.x, o.y - h.y) < 60);
      if (friend && !guarded) this.free(w, h, `${h.name} was rescued from the ${clan.name} camp!`);
    }
    holdsTick(w, this, dt);
    seizeTick(w, this);
    captivesSlow(w, this, dt);
    this.relT -= dt;
    if (this.relT <= 0) {
      this.relT = 70 + w.rng() * 70;
      this.politics(w);
    }
    // new bands wander in now and then
    this.arriveT -= dt;
    if (this.arriveT <= 0) {
      this.arriveT = 230 + w.rng() * 170;
      if (this.clans.length < MAX_CLANS) {
        const c = this.spawnClan(w);
        if (c) w.toast("🪓", `A new band of Neanderthals, the ${c.name} clan, has moved in nearby.`, c.x, c.y);
        else this.arriveT = 60; // try another part of the map soon
      }
    }
  }

  /* ------------------------------ brains ------------------------------ */

  private thinkBrute(w: World, b: Brute) {
    b.think = 0.5 + w.rng() * 0.6;
    const clan = this.clan(b.clan);
    if (!clan) return;
    if (b.weapon === "catapult") return this.catapultThink(w, b, clan);
    if ((b.age ?? GROWN_AGE) < GROWN_AGE) {
      if (Math.hypot(b.x - clan.x, b.y - clan.y) > 65) setB(b, "home", clan.x, clan.y + 20);
      else if (b.state !== "idle" && b.state !== "sleep") setB(b, "idle", b.x, b.y);
      return;
    }
    if (b.captive) return; // carrying someone home: nothing else matters
    // the dragon rite: dance (but turn on anyone who comes for the offering)
    if (b.state === "cheer") return;
    // holding part of our town
    if (b.hold && holdThink(w, this, b, (x, hold) => this.preyFor(w, x, hold.r + 120, { x: hold.x, y: hold.y, r: hold.r + 140 }))) return;
    if (b.state === "dance") {
      const h = this.preyFor(w, b, 160, { x: b.x, y: b.y, r: 160 });
      if (h) {
        b.z = 0;
        b.targetId = h.id;
        setB(b, "fight", h.x, h.y);
        say(b, "NOT YOURS!", 1.5);
      }
      return;
    }
    if (b.state === "bash" || b.state === "flee") return;
    const raid = w.tribe.raid && w.tribe.raid.by === "brute" && w.tribe.raid.ids.includes(b.id) ? w.tribe.raid : null;
    if (b.raid && !raid) this.goHome(w, b); // the raid is over
    if (b.raid && raid?.phase === "warn") {
      if (b.state !== "rally") setB(b, "rally", b.x, b.y);
      if (w.rng() < 0.15) say(b, pick(w.rng, ["UGH!", "Smash!", "Grr!"]), 1.5);
      return;
    }
    if (b.loot || b.forage || b.haul) {
      if (b.state !== "home") this.goHome(w, b);
      return;
    }
    if (b.hp < 0.25) return this.goHome(w, b, "flee");
    // a spy watching our camp: once they've seen enough, run home and tell the clan
    if (b.state === "spy") {
      if (Math.hypot(b.x - b.tx, b.y - b.ty) < 20 && b.stateT > 14) {
        this.learn(w, clan);
        say(b, "Hrm. Me see.", 1.6);
        return this.goHome(w, b);
      }
      if (b.stateT > 70) return this.goHome(w, b);
      return;
    }
    // an ambush: lie low in the grass until one of ours wanders close, then jump
    if (b.ambush) {
      const h = this.preyFor(w, b, 170, null);
      if (h) {
        for (const o of this.brutes) {
          if (!o.ambush || o.clan !== b.clan || Math.hypot(o.x - b.x, o.y - b.y) > 260) continue;
          o.ambush = false;
          o.targetId = h.id;
          setB(o, "fight", h.x, h.y);
          say(o, pick(w.rng, ["NOW!", "GET!", "RAAAH!"]), 1.6);
        }
        w.alarm(h.x, h.y, 500, 0.8, "😱", false);
        w.toast("🌿", `Ambush! The ${clan.name} clan was hiding in the grass by ${h.name}!`, h.x, h.y);
        if (!w.flags.has("packs")) {
          w.flags.add("packs");
          w.toast("🛡️", "Your tribe learned a lesson: hunters now walk out with anyone working far from camp. Go out in packs!", h.x, h.y);
        }
        return;
      }
      if (b.stateT > 90) {
        b.ambush = false;
        return this.goHome(w, b);
      }
      if (b.state !== "lurk" && b.state !== "walk") setB(b, "walk", b.tx, b.ty);
      return;
    }

    // 1) an enemy clan member close by: fight
    const foe = this.nearestFoe(w, b, b.war ? 260 : 150);
    if (foe) {
      b.targetId = foe.id;
      setB(b, "fight", foe.x, foe.y);
      return;
    }
    // 2) our people: on a raid anyone outside; at home anyone who comes too close
    const range = b.raid ? 340 : 220;
    const h = this.preyFor(w, b, range, !b.raid ? { x: clan.x, y: clan.y, r: 380 } : null);
    if (h) {
      b.targetId = h.id;
      setB(b, "fight", h.x, h.y);
      if (w.rng() < 0.3) say(b, isFemale(h) && !h.child ? "Mine!" : pick(w.rng, ["Smash!", "RAAGH!", "Ugh!"]), 1.6);
      return;
    }
    // 3) raiding: make for the stockpile (bashing whatever's in the way)
    if (b.raid) {
      // cunning clans know where we keep things: the stockpile or a storehouse
      const store = this.storeFor(w, b, clan);
      if (Math.hypot(b.x - store.x, b.y - store.y) < 70) {
        const got = takeLoot(w, 4, (clan.smarts ?? 0) >= 3);
        b.loot = got.n;
        b.lootKind = got.r;
        say(b, b.loot ? (got.r === "wood" || got.r === "stone" ? "MINE NOW!" : "FOOD!") : "Nothing?!", 2);
        this.goHome(w, b);
        if (b.loot) w.toast("😠", `${b.name} the Neanderthal is running off with our ${got.r}!`, b.x, b.y);
        return;
      }
      if (b.state !== "walk" || Math.hypot(b.tx - store.x, b.ty - store.y) > 40) setB(b, "walk", store.x + (w.rng() - 0.5) * 30, store.y);
      return;
    }
    // 4) off to fight another clan
    if (b.war) {
      const enemy = this.clan(b.war);
      if (!enemy || b.stateT > 120) return this.goHome(w, b);
      if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < 90) {
        // they're out working round their camp: go after them
        const out = this.brutes.filter((o) => o.clan === enemy.id && o.hp > 0 && !o.captive && !o.snatched && Math.hypot(o.x - enemy.x, o.y - enemy.y) < 700).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
        if (out) {
          b.targetId = out.id;
          setB(b, "fight", out.x, out.y);
          return;
        }
        // nobody left to fight: help yourself to their food and go home
        const grab = Math.min(3, enemy.food);
        enemy.food -= grab;
        clan.food += grab;
        return this.goHome(w, b);
      }
      if (b.state !== "walk") setB(b, "walk", enemy.x, enemy.y);
      return;
    }
    // 5) everyday life: sleep at night, hunt when hungry, potter about the camp
    if (w.daylight < 0.3) {
      if (Math.hypot(b.x - clan.x, b.y - clan.y) > 70) setB(b, "home", clan.x + (w.rng() - 0.5) * 60, clan.y + 14);
      else if (b.state !== "sleep") setB(b, "sleep", b.x, b.y);
      return;
    }
    if (b.state === "sleep") setB(b, "idle", b.x, b.y);
    if (b.state === "forage" && (w.plants.some((p) => p.id === b.targetId && !p.stump && (p.fruit > 0 || p.food > 0.25)) || w.items.some((it) => it.id === b.targetId && it.amount > 0))) return;
    if (clan.food < 12 + this.members(clan.id).length && b.state !== "hunt" && w.rng() < 0.45) {
      const food = this.forageTarget(w, clan, b);
      if (food && (w.rng() < 0.7 || !this.preyDino(w, clan))) {
        b.targetId = food.id;
        setB(b, "forage", food.x, food.y);
        return;
      }
      // hunters go out in a pack: together they take something bigger
      const pack = this.members(clan.id).filter((o) => o !== b && (o.age ?? GROWN_AGE) >= GROWN_AGE && !o.raid && !o.war && !o.captive && !o.haul && !o.forage && !o.loot && o.weapon !== "catapult" && o.hp > 0.5 && (o.state === "idle" || o.state === "wander") && Math.hypot(o.x - b.x, o.y - b.y) < 300).slice(0, 2 + lvOf(clan, "boneRack"));
      const prey = this.preyDino(w, clan, pack.length + 1);
      if (prey) {
        b.targetId = prey.id;
        setB(b, "hunt", prey.x, prey.y);
        for (const o of pack) {
          o.targetId = prey.id;
          setB(o, "hunt", prey.x, prey.y);
        }
        if (pack.length) {
          say(b, pick(w.rng, ["Hunt! Together!", "Surround!", "Big meat!"]), 1.8);
          if (!w.flags.has("packHunt")) {
            w.flags.add("packHunt");
            w.toast("🦴", `The ${clan.name} clan hunts in packs now: ${pack.length + 1} of them closing in on a ${sp(prey.species).nick}.`, prey.x, prey.y);
          }
        }
        return;
      }
    }
    if (b.state === "hunt" && w.dinoById(b.targetId)) return;
    // the clan's work: bones + wood, building, sparring
    if (clanJob(w, this, b, clan)) return;
    if (b.state === "idle" || b.state === "home" || (b.state === "wander" && b.stateT > 8) || b.state === "walk" || b.state === "hunt" || b.state === "fight") {
      if (w.rng() < 0.5) setB(b, "idle", b.x, b.y);
      else {
        const a = w.rng() * Math.PI * 2;
        const r = 40 + w.rng() * 200;
        const x = clan.x + Math.cos(a) * r;
        const y = clan.y + Math.sin(a) * r * 0.7;
        if (w.nav.passable("dino", x, y)) setB(b, "wander", x, y);
      }
      if (w.rng() < 0.05) say(b, pick(w.rng, ["Ugh.", "Hrmm.", "Me hungry.", "*scratch*", "Grunt."]), 1.6);
    }
  }

  private nearestFoe(w: World, b: Brute, r: number): Brute | null {
    let best: Brute | null = null;
    let bd = r;
    for (const o of this.brutes) {
      // feuding clans, any Tree Person who's shown themselves, and the Sea People
      if (o === b || (o.tree ? o.hidden || o.hp <= 0 : o.sea ? o.hp <= 0 || !!o.boat : this.relation(o.clan, b.clan) !== -1)) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** Someone of ours worth going after (not hidden, not up on a wall unless we can throw). */
  private preyFor(w: World, b: Brute, r: number, near: { x: number; y: number; r: number } | null): Human | null {
    const wp = BRUTE_WEAPONS[b.weapon];
    const raid = w.tribe.raid;
    const inside = !!raid && raid.by === "brute" && (raid.breached || !w.tribe.walls.some((x) => x.built >= 1 && x.hp > 0) || !w.tribe.enclosed(w, w.camp.x, w.camp.y + 30));
    let best: Human | null = null;
    let bd = r;
    for (const h of w.humans) {
      if (h.captive || h.stranger || h.under) continue;
      // kids are only snatched on raids by a cunning clan
      if (h.child && !(b.raid && (this.clan(b.clan)?.smarts ?? 0) >= 3)) continue;
      if (h.state === "tossed") continue;
      // hiding at home only works while the walls hold (or there's someone to hide behind)
      if ((h.state === "hide" || h.state === "sleep") && !(b.raid && inside)) continue;
      if (h.level === 1 && !wp.throw) continue;
      if (near && Math.hypot(h.x - near.x, h.y - near.y) > near.r) continue;
      let d = Math.hypot(h.x - b.x, h.y - b.y);
      // can't walk to it (walls): only worth it if we can throw at it
      if (d > 60 && !wp.throw && w.nav.wallBetween(b.x, b.y, h.x, h.y)) continue;
      if (h.state === "down" && !isFemale(h)) d -= 40; // finish them
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  private preyDino(w: World, clan: Clan, pack = 1) {
    let best = null as ReturnType<World["dinoById"]>;
    let bd = 450 + (pack - 1) * 120;
    const big = pack >= 3 ? 120 : pack === 2 ? 80 : 55;
    for (const d of w.dinos) {
      const def = sp(d.species);
      if (def.diet !== "herbivore" || def.move !== "walk" || d.owner || isBaby(d) || sizeOf(d) > big) continue;
      const dist = Math.hypot(d.x - clan.x, d.y - clan.y);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  private forageTarget(w: World, clan: Clan, b: Brute): { id: number; x: number; y: number } | null {
    let best: { id: number; x: number; y: number } | null = null;
    let distance = 500;
    const consider = (o: { id: number; x: number; y: number }) => {
      if (Math.hypot(o.x - clan.x, o.y - clan.y) > 500) return;
      if (this.brutes.some((other) => other !== b && other.state === "forage" && other.targetId === o.id)) return;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < distance && w.nav.passable("dino", o.x, o.y)) { distance = d; best = o; }
    };
    for (const it of w.items) if (!it.claimed && it.amount > 0 && ["berries", "fruit", "meat", "fish"].includes(it.kind)) consider(it);
    for (const p of w.plants) if (!p.stump && p.burnt < 0.3 && ((p.kind === "fruit" && p.fruit > 0) || (p.kind === "bush" && p.food > 0.35))) consider(p);
    return best;
  }

  /* ------------------------------ bodies ------------------------------ */

  private actBrute(w: World, b: Brute, dt: number) {
    const clan = this.clan(b.clan);
    const wp = BRUTE_WEAPONS[b.weapon];
    // a catapult rolls up and fires once it is dug in
    if (b.weapon === "catapult") {
      if (b.state === "siege") {
        b.vx = b.vy = 0;
        if (b.cd <= 0) this.fireSiege(w, b);
      } else if (b.state === "walk" || b.state === "home") {
        if (moveBrute(w, b, dt, SPEED * 0.7)) setB(b, "idle", b.x, b.y);
      }
      return;
    }
    if (lifeAct(w, this, b, clan, dt) || riteAct(w, this, b, dt)) return;
    switch (b.state) {
      case "idle":
      case "rally":
      case "sleep": {
        b.vx = b.vy = 0;
        if (b.state === "sleep" || (clan && Math.hypot(b.x - clan.x, b.y - clan.y) < 120)) b.hp = Math.min(1, b.hp + dt * 0.006);
        if (b.state === "rally") b.anim += dt * 4;
        return;
      }
      case "wander":
      case "home":
      case "flee": {
        if (moveBrute(w, b, dt, b.state === "flee" ? SPEED * 1.15 : SPEED * 0.8)) {
          if (b.loot && clan) {
            clan.food += b.loot;
            b.loot = 0;
          }
          if (b.forage && clan) {
            clan.food += b.forage;
            b.forage = 0;
          }
          if (b.haul && clan) {
            clan[b.haul.r] = (clan[b.haul.r] ?? 0) + b.haul.n;
            b.haul = undefined;
          }
          setB(b, "idle", b.x, b.y);
        }
        return;
      }
      case "walk": {
        const arrived = moveBrute(w, b, dt, b.raid || b.war ? SPEED : SPEED * 0.8);
        if (b.raid) this.bashIfBlocked(w, b);
        if (arrived) {
          setB(b, b.ambush ? "lurk" : "idle", b.x, b.y);
          b.think = 0;
        }
        return;
      }
      case "spy": {
        // creep up to a lookout spot, then crouch + watch
        if (Math.hypot(b.x - b.tx, b.y - b.ty) > 6) {
          moveBrute(w, b, dt, SPEED * 0.7);
          b.stateT = Math.min(b.stateT, 1);
        } else b.vx = b.vy = 0;
        return;
      }
      case "lurk": {
        b.vx = b.vy = 0;
        return;
      }
      case "carry": {
        const h = w.humans.find((o) => o.id === b.captive);
        if (!h || !clan) {
          b.captive = 0;
          setB(b, "idle", b.x, b.y);
          return;
        }
        const home = moveBrute(w, b, dt, SPEED * 0.85);
        h.x = b.x - b.dir * 3;
        h.y = b.y + 1;
        h.z = 22;
        h.dir = b.dir;
        if (w.rng() < dt * 0.4) say(h, pick(w.rng, ["Help!!", "Let me go!", "HELP ME!"]), 2);
        if (home) {
          b.captive = 0;
          h.z = 0;
          h.x = clan.x + (w.rng() - 0.5) * 50;
          h.y = clan.y + 24 + w.rng() * 10;
          say(h, "Help…", 3);
          w.toast("😢", `${h.name} is a captive at the ${clan.name} camp. Send people to bring ${h.child ? "them" : "her"} home!`, h.x, h.y);
          setB(b, "idle", b.x, b.y);
        }
        return;
      }
      case "hunt": {
        const d = w.dinoById(b.targetId);
        if (!d || d.health <= 0) {
          setB(b, "idle", b.x, b.y);
          return;
        }
        if (Math.hypot(b.tx - d.x, b.ty - d.y) > 40) {
          b.tx = d.x;
          b.ty = d.y;
        }
        const dist = Math.hypot(d.x - b.x, d.y - b.y);
        if (dist > REACH + sizeOf(d) * 0.35) moveBrute(w, b, dt, SPEED * 1.1);
        else if (b.cd <= 0) {
          b.cd = 1.4;
          b.dir = d.x > b.x ? 1 : -1;
          b.stateT = 0;
          w.sfx("whoosh", b.x, b.y, 0.4, 0.7);
          hitDino(w, d, 40 * huntPower(b, clan), b.x, b.y);
          // clubbing a war dino in grown bone armour: the spikes bite back
          if (d.owner && (d.warArmor ?? 0) > 0) {
            boneSpikes(w, b.x, b.y);
            this.hit(w, b, 60 + (d.warArmor ?? 0) * 50, d.x, d.y, false, "tusk");
            if (b.hp <= 0) return;
          }
          if (d.health <= 0 && clan) {
            b.forage = 4;
            b.forageKind = "meat";
            say(b, "MEAT!", 2);
            this.goHome(w, b);
            // the rest of the pack carries meat home too
            for (const o of this.members(clan.id)) {
              if (o === b || o.state !== "hunt" || o.targetId !== d.id) continue;
              o.forage = 3;
              o.forageKind = "meat";
              say(o, "Meat! Meat!", 1.6);
              this.goHome(w, o);
            }
          }
        }
        if (b.stateT > 40) setB(b, "idle", b.x, b.y);
        return;
      }
      case "forage": {
        if (!clan) { setB(b, "idle", b.x, b.y); return; }
        const item = w.items.find((it) => it.id === b.targetId && it.amount > 0 && !it.claimed);
        const plant = w.plants.find((p) => p.id === b.targetId && !p.stump);
        const target = item ?? plant;
        if (!target || (plant && plant.fruit <= 0 && plant.food <= 0.25)) { setB(b, "idle", b.x, b.y); return; }
        b.tx = target.x;
        b.ty = target.y;
        if (Math.hypot(b.x - target.x, b.y - target.y) > 24) moveBrute(w, b, dt, SPEED * 0.8);
        else {
          if (item) {
            b.forage = Math.min(2, item.amount);
            b.forageKind = item.kind as "berries" | "fruit" | "meat" | "fish";
            item.amount -= b.forage;
            if (item.amount <= 0) w.removeItem(item);
          } else if (plant) {
            if (plant.kind === "fruit" && plant.fruit > 0) { plant.fruit--; b.forage = 2; b.forageKind = "fruit"; }
            else { plant.food = Math.max(0, plant.food - 0.35); b.forage = 1; b.forageKind = "berries"; }
            plant.shake = 0.5;
          }
          say(b, "Food!", 1.3);
          this.goHome(w, b);
        }
        return;
      }
      case "fight": {
        const foe = this.byId(b.targetId);
        const h = foe ? null : w.humans.find((o) => o.id === b.targetId) ?? null;
        const t = foe ?? h;
        if (!t || (h && (h.captive || h.state === "hide" || h.under)) || b.stateT > 30) {
          setB(b, "idle", b.x, b.y);
          b.think = 0;
          return;
        }
        if (Math.hypot(b.tx - t.x, b.ty - t.y) > 30) {
          b.tx = t.x;
          b.ty = t.y;
        }
        const dist = Math.hypot(t.x - b.x, t.y - b.y);
        const up = !!h && h.level === 1;
        const canReach = !up && !(dist > 50 && w.nav.wallBetween(b.x, b.y, t.x, t.y));
        if (dist <= REACH && canReach) {
          b.vx = b.vy = 0;
          b.dir = t.x > b.x ? 1 : -1;
          if (b.cd <= 0) {
            b.cd = 1.5 + w.rng() * 0.4;
            b.anim = 0;
            w.sfx("whoosh", b.x, b.y, 0.5, 0.7);
            if (foe) this.hit(w, foe, wp.hit * 0.9, b.x, b.y, true);
            else if (h) this.strike(w, b, h);
          }
          return;
        }
        // can't get there (on a wall / behind one): throw if we can, else bash through
        if (wp.throw && dist < wp.range && (!canReach || dist > 70) && b.cd <= 0 && h) {
          this.throwAt(w, b, h);
          return;
        }
        if (!canReach && b.raid) {
          this.bashIfBlocked(w, b, true);
          if ((b.state as BruteState) === "bash") return;
        }
        // a short charge once they're close
        moveBrute(w, b, dt, SPEED * (dist < 140 ? 1.6 : 1.15));
        if (b.raid) this.bashIfBlocked(w, b);
        return;
      }
      case "bash": {
        const wl = w.tribe.walls.find((x) => x.id === b.targetId);
        if (!wl || wl.hp <= 0 || wl.built < 1 || (wl.part === "gate" && wl.open) || !b.raid) {
          setB(b, "walk", w.camp.pileX, w.camp.pileY);
          b.pathKey = 0;
          b.think = 0;
          return;
        }
        b.vx = b.vy = 0;
        b.dir = wl.tx * TILE + 16 > b.x ? 1 : -1;
        wl.hp -= wp.wall * dt;
        b.anim += dt * 5;
        if (w.rng() < dt * 3) {
          w.particles.spawn(P.Crumb, wl.tx * TILE + 16, wl.ty * TILE + 10, { z: 16, vz: 50, vx: (w.rng() - 0.5) * 60, g: 160, size: 3, max: 0.6, color: wl.kind === "palisade" ? "#8a6238" : "#8f8a82" });
          w.sfx("thud", b.x, b.y, 0.6, 0.8);
        }
        if (wl.part === "gate" && !w.flags.has("bruteGate")) {
          w.flags.add("bruteGate");
          w.toast("🚪", `${b.name} the Neanderthal is smashing at the gate!`, wl.tx * TILE, wl.ty * TILE);
        }
        if (wl.hp <= 0) {
          w.tribe.collapse(w, wl);
          w.shake(4, 0.4);
          const r = w.tribe.raid;
          if (r && !r.breached) {
            r.breached = true;
            w.toast("💥", "The Neanderthals smashed through the wall!", wl.tx * TILE, wl.ty * TILE);
          }
          setB(b, "walk", w.camp.pileX, w.camp.pileY);
          b.think = 0;
        }
        return;
      }
    }
  }

  /** A catapult's raid: roll up to just beyond our Scorpions' reach, dig in, and lob boulders. */
  private catapultThink(w: World, b: Brute, clan: Clan) {
    b.think = 0.6;
    const raid = w.tribe.raid && w.tribe.raid.by === "brute" && w.tribe.raid.ids.includes(b.id) ? w.tribe.raid : null;
    if (!b.raid || !raid || raid.phase === "warn") {
      if (b.raid && !raid) b.raid = false;
      if (!b.raid && Math.hypot(b.x - clan.x, b.y - clan.y) > 80) setB(b, "home", clan.x + 50, clan.y + 30);
      return;
    }
    const t = siegeTarget(w, b);
    if (!t) return;
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d > CATAPULT_RANGE - 20) {
      // stop a little inside its own range (which is outside theirs)
      const k = (CATAPULT_RANGE - 40) / d;
      setB(b, "walk", t.x + (b.x - t.x) * k, t.y + (b.y - t.y) * k);
      return;
    }
    if (b.state !== "siege") {
      setB(b, "siege", b.x, b.y);
      b.targetId = t.id;
      if (!w.flags.has("catapultSiege")) {
        w.flags.add("catapultSiege");
        w.toast("🪨", `The ${clan.name} catapult is in range and out of ours! Send people out to smash it, or a dragon.`, b.x, b.y);
      }
    }
  }

  /** Siege salvos: repeated structure damage, fireballs, arrows, and one captive volley. */
  private fireSiege(w: World, b: Brute) {
    const t = siegeTarget(w, b);
    if (!t || Math.hypot(t.x - b.x, t.y - b.y) > CATAPULT_RANGE + 10) {
      setB(b, "idle", b.x, b.y);
      return;
    }
    b.cd = CATAPULT_RELOAD;
    b.anim = 0;
    b.siegeShots = (b.siegeShots ?? 0) + 1;
    const flight = 1.6;
    const launch = (kind: Missile["kind"], x: number, y: number, target: number, damage: number, targetKind?: Missile["targetKind"], goreName?: string) => {
      this.missiles.push({ x: b.x, y: b.y, z: 30, vx: (x - b.x) / flight, vy: (y - b.y) / flight, vz: (10 - 30) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target, targetKind, dmg: damage, kind, goreName });
    };
    const captive = b.siegeCaptive ? w.humans.find((h) => h.id === b.siegeCaptive && h.captive === b.clan && !h.child) : null;
    if (captive && b.siegeShots === 2) {
      b.siegeCaptive = undefined;
      const name = captive.name;
      killHuman(w, captive, `${name} was loaded into the ${this.clan(b.clan)?.name ?? "enemy"} clan's catapult!`);
      const aim = Math.hypot(w.camp.pileX - b.x, w.camp.pileY - b.y) <= CATAPULT_RANGE ? { x: w.camp.pileX, y: w.camp.pileY } : t;
      for (let i = 0; i < 3; i++) launch("gore", aim.x + (i - 1) * 32, aim.y + (i % 2 ? -18 : 18), 0, 0, undefined, i === 0 ? name : undefined);
    } else if (b.siegeShots % 4 === 0) {
      launch("fireball", t.x, t.y, t.id, BOULDER_DMG * 1.35, t.kind);
    } else if (b.siegeShots % 3 === 0) {
      const defender = w.humans.filter((h) => !h.child && !h.captive && !h.under && !h.aloft && h.state !== "down" && Math.hypot(h.x - b.x, h.y - b.y) < CATAPULT_RANGE).sort((a, z) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(z.x - b.x, z.y - b.y))[0];
      if (defender) for (let i = 0; i < 4; i++) launch("arrow", defender.x + (i - 1.5) * 5, defender.y + (i % 2 ? 4 : -4), defender.id, 0.13);
      else launch("boulder", t.x, t.y, t.id, BOULDER_DMG, t.kind);
    } else launch("boulder", t.x, t.y, t.id, BOULDER_DMG, t.kind);
    w.sfx("thud", b.x, b.y, 0.9, 0.5);
  }

  /** Club a man (and finish him if he's down); grab a woman and run. */
  private strike(w: World, b: Brute, h: Human) {
    const wp = BRUTE_WEAPONS[b.weapon];
    // a rider up on a war dino: no grabbing them, and its bone spikes gore whoever reaches up
    const mount = h.riding ? w.dinoById(h.riding) : null;
    if (mount && mount.owner && (mount.warArmor ?? 0) > 0) {
      boneSpikes(w, b.x, b.y);
      this.hit(w, b, 50 + (mount.warArmor ?? 0) * 45, mount.x, mount.y, false, "tusk");
      if (b.hp <= 0) return;
    }
    if (b.raid && (isFemale(h) || h.child) && !b.captive && h.level === 0 && !h.riding) {
      this.grab(w, b, h);
      return;
    }
    if (h.child) return; // never club a kid
    if (h.state === "down") {
      if (isFemale(h)) return; // they want the women alive
      killHuman(w, h, `${h.name} was killed by ${b.name} the Neanderthal!`);
      const r = w.tribe.raid;
      if (r && r.by === "brute") r.took = (r.took ?? 0) + 1;
      say(b, "HA!", 1.5);
      setB(b, "idle", b.x, b.y);
      b.think = 0;
      return;
    }
    hurtHuman(w, h, wp.hit * (1 + (b.skill ?? 0) * 0.5) * mightOf(this.clan(b.clan)), b.x, b.y, "club");
  }

  grab(w: World, b: Brute, h: Human) {
    const clan = this.clan(b.clan);
    if (!clan) return;
    if (h.riding) {
      const d = w.dinoById(h.riding);
      if (d) {
        d.rider = 0;
        d.state = "idle";
      }
      h.riding = 0;
    }
    h.captive = clan.id;
    h.state = "captive";
    h.stateT = 0;
    h.path = null;
    h.pathKey = 0;
    h.task = null;
    h.carry = null;
    h.carryN = 0;
    h.order = null;
    h.taskId = 0;
    h.level = 0;
    h.vx = h.vy = 0;
    b.captive = h.id;
    b.raid = false;
    setB(b, "carry", clan.x + (w.rng() - 0.5) * 40, clan.y + 10);
    say(h, "HELP!!", 2.5);
    say(b, "MINE!", 2);
    w.sfx("yelp", h.x, h.y, 1);
    w.alarm(h.x, h.y, 400, 0.8, "😱", false);
    const r = w.tribe.raid;
    if (r && r.by === "brute") r.took = (r.took ?? 0) + 1;
    w.toast("😱", `${b.name} grabbed ${h.name} and is carrying ${isFemale(h) && !h.child ? "her" : "them"} off to the ${clan.name} camp! Stop him!`, h.x, h.y);
  }

  private throwAt(w: World, b: Brute, h: Human) {
    const wp = BRUTE_WEAPONS[b.weapon];
    b.cd = 3 + w.rng();
    b.dir = h.x > b.x ? 1 : -1;
    b.anim = 0;
    const dist = Math.hypot(h.x - b.x, h.y - b.y);
    const flight = Math.max(0.25, dist / 260);
    const miss = 26;
    const tx = h.x + (w.rng() - 0.5) * miss;
    const ty = h.y + (w.rng() - 0.5) * miss * 0.6;
    const sz = 26;
    const tz = h.z + 12;
    this.missiles.push({ x: b.x, y: b.y, z: sz, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (tz - sz) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: h.id, dmg: wp.throw, kind: b.weapon === "spear" ? "spear" : b.weapon === "sling" ? "sling" : "rock" });
    w.sfx("whoosh", b.x, b.y, 0.5, 0.6);
  }

  private updateMissiles(w: World, dt: number) {
    for (const m of this.missiles) {
      m.t += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.z += m.vz * dt;
      m.vz -= 260 * dt;
      if (m.t >= m.dur) {
        if (m.kind === "boulder" || m.kind === "fireball") {
          boulderLands(w, m.x, m.y, m.target, m.targetKind, m.dmg, m.kind === "fireball");
          continue;
        }
        if (m.kind === "gore") {
          w.particles.burst(P.Rock, m.x, m.y, 9, 95, { z: 12, vz: 75, g: 160, size: 5, max: 1.6, color: "#8d1d27" });
          w.particles.burst(P.Mud, m.x, m.y, 16, 80, { size: 8, max: 2.2, color: "#b32632" });
          w.particles.burst(P.Dust, m.x, m.y, 5, 35, { size: 16, max: 0.8, color: "rgba(115,18,27,0.6)" });
          w.sfx("plop", m.x, m.y, 1, 0.5);
          if (m.goreName) {
            w.toast("💥", `${m.goreName}'s remains splattered across the camp!`, m.x, m.y);
            w.shake(4, 0.5);
          }
          for (const h of w.humans) if (!h.captive && Math.hypot(h.x - m.x, h.y - m.y) < 75) h.fear = 1;
          continue;
        }
        if (m.targetKind === "scorpion") {
          const sc = w.colony.scorpions.find((o) => o.id === m.target && o.built >= 1 && o.hp > 0);
          if (sc && Math.hypot(sc.x - m.x, sc.y - m.y) < 38) {
            sc.hp = Math.max(0, sc.hp - m.dmg);
            w.particles.burst(P.Rock, sc.x, sc.y - 12, 5, 38, { z: 20, size: 3, max: 0.5, color: "#baa77f" });
            w.sfx("thunk", sc.x, sc.y, 0.45, 0.8);
          } else w.particles.burst(P.Dust, m.x, m.y, 3, 20, { size: 3, max: 0.4, color: "rgba(160,140,110,0.6)" });
          continue;
        }
        const h = w.humans.find((o) => o.id === m.target);
        if (h && !h.captive && Math.hypot(h.x - m.x, h.y - m.y) < 18) hurtHuman(w, h, m.dmg, m.x - m.vx * 0.1, m.y - m.vy * 0.1, m.kind === "rock" || m.kind === "arrow" ? "rock" : "club");
        else w.particles.burst(P.Dust, m.x, m.y, 3, 20, { size: 3, max: 0.4, color: "rgba(160,140,110,0.6)" });
      }
    }
    this.missiles = this.missiles.filter((m) => m.t < m.dur);
  }

  /** A wall between us and where we're going: smash it (they never think of the gate latch). */
  private bashIfBlocked(w: World, b: Brute, force = false) {
    const a = Math.atan2(b.ty - b.y, b.tx - b.x);
    let blocked = force || b.stuckT > 0.8 || (b.pathKey !== 0 && !b.path && b.stateT > 1);
    for (const step of [18, 36]) {
      if (blocked) break;
      blocked = w.tribe.blocks(Math.floor((b.x + Math.cos(a) * step) / TILE), Math.floor((b.y + Math.sin(a) * step) / TILE));
    }
    if (!blocked) return;
    const wl = wallAhead(w, b, a);
    if (wl) {
      b.targetId = wl.id;
      setB(b, "bash", b.x, b.y);
      b.stuckT = 0;
    }
  }

  clear() {
    this.clans = [];
    this.brutes = [];
    this.missiles = [];
    this.traps = [];
    this.rite = null;
    this.holds = [];
    this.ourShots = [];
    this.rel.clear();
  }

  /* ------------------------------ save ------------------------------ */

  serialize() {
    const r = (n: number) => Math.round(n);
    return {
      started: this.started,
      next: this.nextClan,
      arriveT: this.arriveT,
      clans: this.clans.map((c) => ({ id: c.id, name: c.name, color: c.color, x: r(c.x), y: r(c.y), food: Math.round(c.food * 10) / 10, raidT: r(c.raidT), growT: r(c.growT), smarts: c.smarts ?? 0, intel: c.intel ?? 0, style: c.style, campTier: c.campTier ?? 0, campWork: c.campWork ?? 0, sea: c.sea, fishT: c.fishT, colors: c.colors, bones: c.bones ?? 0, wood: c.wood ?? 0, builds: c.builds ?? {}, buildWork: Math.round((c.buildWork ?? 0) * 10) / 10, favor: c.favor, favorT: r(c.favorT ?? 0), riteT: c.riteT === undefined ? undefined : r(c.riteT), trapT: c.trapT === undefined ? undefined : r(c.trapT), altarBlood: c.altarBlood, science: c.science ? Math.round(c.science * 1000) / 1000 : undefined, tech: c.tech || undefined, merges: c.merges || undefined })),
      brutes: this.brutes.filter((b) => !b.tree && !b.sea).map((b) => ({ clan: b.clan, name: b.name, x: r(b.x), y: r(b.y), hp: Math.round(b.hp * 100) / 100, weapon: b.weapon, age: b.age ?? GROWN_AGE, forage: b.forage ?? 0, forageKind: b.forageKind ?? "berries", tint: b.tint, skill: b.skill ? Math.round(b.skill * 100) / 100 : undefined, haul: b.haul, hold: b.hold, turned: b.turned || undefined, look: b.look })),
      holds: this.holds.map((h) => ({ ...h, x: r(h.x), y: r(h.y), food: Math.round(h.food * 10) / 10, t: r(h.t) })),
      taken: this.taken.map((c) => ({ ...c, x: r(c.x), y: r(c.y), wear: Math.round(c.wear * 100) / 100, cd: 0, anim: 0 })),
      traps: this.traps.map((t) => ({ clan: t.clan, x: r(t.x), y: r(t.y), t: r(t.t), caught: t.caught })),
      rel: Array.from(this.rel.entries()).filter(([, v]) => v !== 0),
    };
  }

  load(w: World, d: ReturnType<Rivals["serialize"]> | undefined) {
    this.clear();
    if (!d) return;
    this.started = !!d.started;
    this.nextClan = d.next ?? 1;
    this.arriveT = d.arriveT ?? 300;
    const moves = new Map<number, { x: number; y: number; dx: number; dy: number }>();
    for (const c of d.clans ?? []) {
      const spot = this.dryCampNear(w, c.x, c.y) ?? this.campSpot(w);
      if (!spot) continue;
      moves.set(c.id, { x: c.x, y: c.y, dx: spot.x - c.x, dy: spot.y - c.y });
      this.clans.push({ ...c, ...spot, sea: this.bySea(w, spot.x, spot.y), style: c.style ?? (["hide", "timber", "bone"] as const)[(c.id - 1) % 3], campTier: c.campTier ?? 0, campWork: c.campWork ?? 0 });
    }
    for (const b of d.brutes ?? []) {
      const clan = this.clan(b.clan);
      const move = moves.get(b.clan);
      const atCamp = move && Math.hypot(b.x - move.x, b.y - move.y) < 400;
      if (clan) this.addBrute(w, clan, b.x + (atCamp ? move!.dx : 0), b.y + (atCamp ? move!.dy : 0), { name: b.name, hp: b.hp, weapon: b.weapon, age: b.age ?? GROWN_AGE, forage: b.forage ?? 0, forageKind: b.forageKind ?? "berries", ...((b as { tint?: string }).tint ? { tint: (b as { tint?: string }).tint } : {}), ...(b.skill ? { skill: b.skill } : {}), ...(b.haul ? { haul: b.haul } : {}), ...((b as { hold?: number }).hold ? { hold: (b as { hold?: number }).hold } : {}), ...((b as { turned?: boolean }).turned ? { turned: true } : {}), ...((b as { look?: Brute["look"] }).look ? { look: (b as { look?: Brute["look"] }).look } : {}) });
    }
    for (const [k, v] of d.rel ?? []) this.rel.set(k, v);
    this.holds = ((d as { holds?: ClanHold[] }).holds ?? []).filter((h) => this.clan(h.clan)).map((h) => ({ ...h }));
    this.taken = ((d as { taken?: OurCatapult[] }).taken ?? []).map((c) => ({ ...c }));
    for (const t of d.traps ?? []) if (this.clan(t.clan)) this.traps.push({ id: w.nextId(), clan: t.clan, x: t.x, y: t.y, t: t.t, caught: t.caught && w.humans.some((h) => h.id === t.caught && h.captive === t.clan) ? t.caught : 0 });
    // anyone mid-carry when the game was saved ends up at the camp
    for (const h of w.humans) if ((h.captive ?? 0) > 0 && !this.clan(h.captive!)) h.captive = 0;
  }
}

/* ------------------------------ helpers ------------------------------ */

export function setB(b: Brute, s: BruteState, x = b.tx, y = b.ty) {
  if (b.state !== s) b.stateT = 0;
  b.state = s;
  b.tx = x;
  b.ty = y;
}

export function say(b: { bubble: { text: string; t: number } | null }, text: string, t = 2) {
  b.bubble = { text, t };
}

function nearestHuman(w: World, x: number, y: number, r: number, any: boolean): Human | null {
  let best: Human | null = null;
  let bd = r;
  for (const h of w.humans) {
    if (h.captive || h.under || (!any && (h.child || h.stranger))) continue;
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}

/** Take one load off our stores: food first; cunning raiders go for materials too. */
function takeLoot(w: World, n: number, materials: boolean): { r: Resource; n: number } {
  const s = w.camp.stock;
  const kinds: Resource[] = ["cooked", "meat", "fish", "crop", "berries"];
  if (materials) kinds.unshift(...(w.rng() < 0.5 ? (["wood", "stone"] as Resource[]) : []));
  for (const r of kinds) {
    const k = Math.min(n, Math.floor(s[r]));
    if (k <= 0) continue;
    s[r] -= k;
    return { r, n: k };
  }
  return { r: "berries", n: 0 };
}

/** How far out our camp reaches (spies + ambushes stay just beyond it). */
const CAMP_R = (w: World) => CAMP_LEVELS[w.tribe.level]?.radius ?? 300;

/** Remove one of our people for good. */
export function killHuman(w: World, h: Human, msg: string) {
  // whatever they were carrying falls where they fell (back to the tribe, or to whoever finds it)
  if (h.carry && h.carryN > 0) {
    const item = ({ stick: "stick", stone: "stone", meat: "meat", fish: "fish", berries: "berries" } as Partial<Record<Resource, ItemKind>>)[h.carry];
    if (item) w.addItem(item, h.x, h.y, { amount: Math.max(1, h.carryN) });
    else w.camp.stock[h.carry] += h.carryN;
  }
  w.particles.burst(P.Poof, h.x, h.y, 10, 60, { size: 12, max: 0.9, color: "rgba(235,228,210,0.95)" });
  w.sfx("thud", h.x, h.y, 0.9, 0.6);
  removeHuman(w, h);
  w.toast("💀", msg, h.x, h.y);
  w.alarm(h.x, h.y, 500, 0.9, "😱", false);
}

/** The finished wall or closed gate in front of us (gates first: they're weaker). */
function wallAhead(w: World, b: Brute, a: number): Wall | null {
  let best: Wall | null = null;
  let bd = 80;
  for (const wl of w.tribe.walls) {
    if (wl.built < 1 || wl.hp <= 0 || (wl.part === "gate" && wl.open)) continue;
    const x = wl.tx * TILE + 16;
    const y = wl.ty * TILE + 16;
    const dist = Math.hypot(x - b.x, y - b.y) - (wl.part === "gate" ? 24 : 0);
    if (dist > bd) continue;
    const da = Math.abs(((Math.atan2(y - b.y, x - b.x) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 1.4) {
      bd = dist;
      best = wl;
    }
  }
  return best;
}

/** Walk toward (tx, ty) like a ground dino: around obstacles if there's a way, never through walls. */
export function moveBrute(w: World, b: Brute, dt: number, speed: number) {
  const key = goalKey(b.tx, b.ty);
  if (b.pathKey !== key) {
    b.pathKey = key;
    b.pathI = 0;
    b.path = null;
    if (!w.nav.lineClear("dino", b.x, b.y, b.tx, b.ty)) {
      const p = w.nav.find(w, "dino", b.x, b.y, 0, b.tx, b.ty, 0, 6000);
      if (p === undefined) b.pathKey = 0;
      else b.path = p;
    }
  }
  let wx = b.tx;
  let wy = b.ty;
  if (b.path && b.pathI < b.path.length) {
    const np = nodePos(b.path[b.pathI]);
    wx = np.x;
    wy = np.y;
  }
  const dx = wx - b.x;
  const dy = wy - b.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) {
    if (b.path && b.pathI < b.path.length) {
      b.pathI++;
      return false;
    }
    b.vx = b.vy = 0;
    return true;
  }
  const ok = (x: number, y: number) => w.nav.passable("dino", x, y) && w.lava.heat[tileOf(x, y)] < 0.15;
  let a = Math.atan2(dy, dx);
  const look = 14;
  if (!ok(b.x + Math.cos(a) * look, b.y + Math.sin(a) * look) && ok(b.x, b.y)) {
    for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5]) {
      if (ok(b.x + Math.cos(a + off) * look, b.y + Math.sin(a + off) * look)) {
        a += off;
        break;
      }
    }
  }
  const step = Math.min(d, speed * dt);
  const nx = b.x + Math.cos(a) * step;
  const ny = b.y + Math.sin(a) * step;
  if (ok(nx, ny) || !ok(b.x, b.y)) {
    b.vx = (nx - b.x) / Math.max(dt, 1e-4);
    b.vy = (ny - b.y) / Math.max(dt, 1e-4);
    b.x = nx;
    b.y = ny;
    b.stuckT = Math.max(0, b.stuckT - dt);
  } else {
    b.vx = b.vy = 0;
    b.stuckT += dt;
  }
  if (Math.abs(Math.cos(a)) > 0.2) b.dir = Math.cos(a) > 0 ? 1 : -1;
  b.anim += dt * (speed / 12);
  return false;
}
