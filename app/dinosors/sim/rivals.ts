/* ------------------------------------------------------------------ */
/*  Neanderthals: rival clans the computer runs. A few small bands     */
/*  live in rough camps around the map. They're bigger and stronger    */
/*  than our people but never get any cleverer: clubs, stone axes,     */
/*  wooden spears and thrown rocks, forever. They hunt, feud with each */
/*  other, make pacts, merge, and every so often march on our camp:    */
/*  they club the men, carry the women off to their camp and grab      */
/*  food. Kill the carrier (or reach their camp while it's unguarded)  */
/*  and she comes home. They're dumb about walls: no stairs, no gates, */
/*  they just bash.                                                    */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { FEMALE_NAMES } from "../data/facts";
import { findSpawnSpot, isBaby, sizeOf } from "./dinos";
import { go } from "./humans";
import { hurtHuman } from "./injury";
import { goalKey, nodePos, tileOf } from "./nav";
import { P } from "./particles";
import { pick } from "./rng";
import { hitDino } from "./tribe";
import { MAP_H, MAP_W, TILE, type Brute, type BruteState, type BruteWeapon, type Clan, type Human, type Resource, type Wall } from "./types";
import type { World } from "./world";

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
};

/** Tough: our hits are divided by this (a person is ~1; a raptor raider ~2). */
const BRUTE_TOUGH = 150;
const REACH = 24;
const SPEED = 40;
export const MAX_CLANS = 4;
const MAX_BRUTES = 7;

export const isFemale = (h: Human) => FEMALE_NAMES.has(h.name);

/** A thrown spear or rock in flight. */
interface Missile {
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
  kind: "spear" | "rock";
}

const relKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export class Rivals {
  clans: Clan[] = [];
  brutes: Brute[] = [];
  missiles: Missile[] = [];
  /** clan pair → -1 war, 0 wary, 1 allies */
  rel = new Map<string, number>();
  /** clans have shown up in this world */
  started = false;
  private nextClan = 1;
  private relT = 90;
  private arriveT = 500;
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
  captives(w: World, clan?: number) {
    return w.humans.filter((h) => h.captive && (clan === undefined || h.captive === clan));
  }

  /** Should our guards + defenses shoot this one? */
  hostile(w: World, b: Brute) {
    if (b.raid || b.captive) return true;
    const c = w.camp;
    return Math.hypot(b.x - c.x, b.y - c.y) < 700 || (b.state === "fight" && w.humans.some((h) => h.id === b.targetId));
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
      weapon: r < 0.45 ? "club" : r < 0.7 ? "axe" : r < 0.9 ? "spear" : "rock",
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
      bubble: null,
      ...o,
    };
    this.brutes.push(b);
    return b;
  }

  /** A spot for a camp: well away from ours, other clans and the volcano. */
  campSpot(w: World): { x: number; y: number } | null {
    const c = w.camp;
    const raptor = sp("raptor");
    for (let k = 0; k < 80; k++) {
      const a = w.rng() * Math.PI * 2;
      const r = 1500 + w.rng() * 1500;
      const x = Math.max(260, Math.min(WORLD_W - 260, c.x + Math.cos(a) * r));
      const y = Math.max(260, Math.min(WORLD_H - 200, c.y + Math.sin(a) * r * 0.8));
      if (Math.hypot(x - c.x, y - c.y) < 1300) continue;
      if (Math.hypot(x - w.volcano.x, y - w.volcano.y) < 650) continue;
      if (this.clans.some((o) => Math.hypot(o.x - x, o.y - y) < 900)) continue;
      const s = findSpawnSpot(w, raptor, x, y, 120);
      if (!s || !w.nav.passable("dino", s.x, s.y)) continue;
      if (w.tribe.enclosed(w, s.x, s.y)) continue;
      return s;
    }
    return null;
  }

  /** A new clan settles nearby. */
  spawnClan(w: World, n = 3 + Math.floor(w.rng() * 2), at?: { x: number; y: number }): Clan | null {
    const spot = at ?? this.campSpot(w);
    if (!spot) return null;
    const used = new Set(this.clans.map((c) => c.name));
    const names = CLAN_NAMES.filter((x) => !used.has(x));
    const clan: Clan = {
      id: this.nextClan++,
      name: pick(w.rng, names.length ? names : CLAN_NAMES),
      color: CLAN_COLORS[(this.nextClan - 2) % CLAN_COLORS.length],
      x: spot.x,
      y: spot.y,
      food: 6,
      raidT: 600 + w.rng() * 360,
      growT: 180 + w.rng() * 120,
    };
    this.clans.push(clan);
    for (let i = 0; i < n; i++) this.addBrute(w, clan, spot.x + (w.rng() - 0.5) * 80, spot.y + 20 + (w.rng() - 0.5) * 40);
    return clan;
  }

  /* ------------------------------ fighting ------------------------------ */

  /** Our spear / arrow / bolt (or another Neanderthal's club) lands. */
  hit(w: World, b: Brute, dmg: number, fx: number, fy: number, byBrute = false) {
    b.hp -= byBrute ? dmg : dmg / BRUTE_TOUGH;
    w.particles.burst(P.Star, b.x, b.y, 2, 30, { z: 26, size: 5, max: 0.6 });
    w.sfx("thunk", b.x, b.y, 0.7, 0.8);
    if (b.hp <= 0) return this.kill(w, b);
    if (w.rng() < 0.4) say(b, pick(w.rng, ["RAAGH!", "Grrr!", "Ugh!", "Hurt!"]), 1.4);
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
    if (b.loot) w.addItem("berries", b.x, b.y, { amount: 1 });
    w.particles.burst(P.Poof, b.x, b.y, 10, 60, { size: 12, max: 0.9, color: "rgba(200,190,170,0.9)" });
    w.addItem("bones", b.x, b.y);
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

  private dropCaptive(w: World, b: Brute, killed: boolean) {
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
    const own = this.members(clan.id).filter((b) => b.hp > 0.5 && !b.captive && !b.war);
    // someone always stays home to mind the camp (and any captives)
    const stay = own.length >= 4 ? 1 : 0;
    const party = own.slice(0, own.length - stay);
    let allies = 0;
    for (const o of this.clans) {
      if (o === clan || this.relation(o.id, clan.id) !== 1) continue;
      const help = this.members(o.id).filter((b) => b.hp > 0.6 && !b.war && !b.captive).slice(0, 2);
      party.push(...help);
      allies += help.length;
    }
    if (party.length < 2) return false;
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

  /* ------------------------------ clan politics ------------------------------ */

  private politics(w: World) {
    if (this.clans.length < 2) return;
    const a = this.clans[Math.floor(w.rng() * this.clans.length)];
    const others = this.clans.filter((c) => c !== a);
    const b = others[Math.floor(w.rng() * others.length)];
    const r = this.relation(a.id, b.id);
    const na = this.members(a.id).length;
    const nb = this.members(b.id).length;
    const roll = w.rng();
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
    } else if (r === 1 && (Math.min(na, nb) <= 2 || roll < 0.18)) {
      const [big, small] = na >= nb ? [a, b] : [b, a];
      this.merge(w, small, big);
    }
  }

  /** Send warriors to beat up another clan. */
  warParty(w: World, att: Clan, def: Clan) {
    const party = this.members(att.id).filter((b) => b.hp > 0.55 && !b.raid && !b.captive);
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
    w.toast("🤝", `The ${from.name} clan joined the ${into.name} clan: ${this.members(into.id).length} Neanderthals strong now!`, into.x, into.y);
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
    }
    if (!this.started) return;
    this.updateMissiles(w, dt);
    for (let i = this.brutes.length - 1; i >= 0; i--) {
      const b = this.brutes[i];
      if (!b) continue;
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
      const n = this.members(clan.id).length;
      if (!n) {
        this.clanGone(w, clan);
        continue;
      }
      clan.food = Math.max(0, clan.food - n * 0.004 * dt);
      // a fed clan grows (captives help it grow faster)
      clan.growT -= dt * (1 + this.captives(w, clan.id).length * 0.5);
      if (clan.growT <= 0) {
        clan.growT = 200 + w.rng() * 120;
        if (clan.food >= 5 && n < MAX_BRUTES) {
          clan.food -= 5;
          const b = this.addBrute(w, clan, clan.x + (w.rng() - 0.5) * 40, clan.y + 20);
          say(b, "Grr!");
        }
      }
      // raids on us: hungry clans come sooner; nobody raids a calm world
      const ready = t.danger !== "calm" && w.elapsed > 480 && (w.camp.learned.has("spear") || t.level >= 1 || w.elapsed > 900);
      if (ready && !t.raid) {
        clan.raidT -= dt * (t.danger === "wild" ? 1.7 : 1) * (clan.food < 2 ? 1.5 : 1);
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
    this.relT -= dt;
    if (this.relT <= 0) {
      this.relT = 70 + w.rng() * 70;
      this.politics(w);
    }
    // new bands wander in now and then
    this.arriveT -= dt;
    if (this.arriveT <= 0) {
      this.arriveT = 420 + w.rng() * 300;
      if (this.clans.length < 3) {
        const c = this.spawnClan(w, 3);
        if (c) w.toast("🪓", `A new band of Neanderthals, the ${c.name} clan, has moved in nearby.`, c.x, c.y);
      }
    }
  }

  /* ------------------------------ brains ------------------------------ */

  private thinkBrute(w: World, b: Brute) {
    b.think = 0.5 + w.rng() * 0.6;
    const clan = this.clan(b.clan);
    if (!clan) return;
    if (b.captive) return; // carrying someone home: nothing else matters
    if (b.state === "bash" || b.state === "flee") return;
    const raid = w.tribe.raid && w.tribe.raid.by === "brute" && w.tribe.raid.ids.includes(b.id) ? w.tribe.raid : null;
    if (b.raid && !raid) this.goHome(w, b); // the raid is over
    if (b.raid && raid?.phase === "warn") {
      if (b.state !== "rally") setB(b, "rally", b.x, b.y);
      if (w.rng() < 0.15) say(b, pick(w.rng, ["UGH!", "Smash!", "Grr!"]), 1.5);
      return;
    }
    if (b.loot && b.state !== "home") return this.goHome(w, b);
    if (b.hp < 0.25) return this.goHome(w, b, "flee");

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
      const c = w.camp;
      if (Math.hypot(b.x - c.pileX, b.y - c.pileY) < 70) {
        b.loot = takeFood(w, 4);
        say(b, b.loot ? "FOOD!" : "No food?!", 2);
        this.goHome(w, b);
        if (b.loot) w.toast("😠", `${b.name} the Neanderthal is running off with our food!`, b.x, b.y);
        return;
      }
      if (b.state !== "walk" || Math.hypot(b.tx - c.pileX, b.ty - c.pileY) > 40) setB(b, "walk", c.pileX + (w.rng() - 0.5) * 30, c.pileY);
      return;
    }
    // 4) off to fight another clan
    if (b.war) {
      const enemy = this.clan(b.war);
      if (!enemy || b.stateT > 120) return this.goHome(w, b);
      if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < 90) {
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
    if (clan.food < 8 && b.state !== "hunt" && w.rng() < 0.3) {
      const prey = this.preyDino(w, clan);
      if (prey) {
        b.targetId = prey.id;
        setB(b, "hunt", prey.x, prey.y);
        return;
      }
    }
    if (b.state === "hunt" && w.dinoById(b.targetId)) return;
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
      if (o === b || this.relation(o.clan, b.clan) !== -1) continue;
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
      if (h.captive || h.child || h.stranger || h.under) continue;
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

  private preyDino(w: World, clan: Clan) {
    let best = null as ReturnType<World["dinoById"]>;
    let bd = 450;
    for (const d of w.dinos) {
      const def = sp(d.species);
      if (def.diet !== "herbivore" || def.move !== "walk" || d.owner || isBaby(d) || sizeOf(d) > 55) continue;
      const dist = Math.hypot(d.x - clan.x, d.y - clan.y);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return best;
  }

  /* ------------------------------ bodies ------------------------------ */

  private actBrute(w: World, b: Brute, dt: number) {
    const clan = this.clan(b.clan);
    const wp = BRUTE_WEAPONS[b.weapon];
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
          setB(b, "idle", b.x, b.y);
        }
        return;
      }
      case "walk": {
        const arrived = moveBrute(w, b, dt, b.raid || b.war ? SPEED : SPEED * 0.8);
        if (b.raid) this.bashIfBlocked(w, b);
        if (arrived) {
          setB(b, "idle", b.x, b.y);
          b.think = 0;
        }
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
          w.toast("😢", `${h.name} is a captive at the ${clan.name} camp. Send people to bring her home!`, h.x, h.y);
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
          hitDino(w, d, 40, b.x, b.y);
          if (d.health <= 0 && clan) {
            clan.food += 4;
            say(b, "MEAT!", 2);
            setB(b, "idle", b.x, b.y);
          }
        }
        if (b.stateT > 40) setB(b, "idle", b.x, b.y);
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

  /** Club a man (and finish him if he's down); grab a woman and run. */
  private strike(w: World, b: Brute, h: Human) {
    const wp = BRUTE_WEAPONS[b.weapon];
    if (b.raid && isFemale(h) && !b.captive && h.level === 0) {
      this.grab(w, b, h);
      return;
    }
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
    hurtHuman(w, h, wp.hit, b.x, b.y, "club");
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
    w.toast("😱", `${b.name} grabbed ${h.name} and is carrying her off to the ${clan.name} camp! Stop him!`, h.x, h.y);
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
    this.missiles.push({ x: b.x, y: b.y, z: sz, vx: (tx - b.x) / flight, vy: (ty - b.y) / flight, vz: (tz - sz) / flight + 0.5 * 260 * flight, t: 0, dur: flight, target: h.id, dmg: wp.throw, kind: b.weapon === "spear" ? "spear" : "rock" });
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
        const h = w.humans.find((o) => o.id === m.target);
        if (h && !h.captive && Math.hypot(h.x - m.x, h.y - m.y) < 16) hurtHuman(w, h, m.dmg, m.x - m.vx * 0.1, m.y - m.vy * 0.1, m.kind === "rock" ? "rock" : "club");
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
    this.rel.clear();
  }

  /* ------------------------------ save ------------------------------ */

  serialize() {
    const r = (n: number) => Math.round(n);
    return {
      started: this.started,
      next: this.nextClan,
      clans: this.clans.map((c) => ({ id: c.id, name: c.name, color: c.color, x: r(c.x), y: r(c.y), food: Math.round(c.food * 10) / 10, raidT: r(c.raidT), growT: r(c.growT) })),
      brutes: this.brutes.map((b) => ({ clan: b.clan, name: b.name, x: r(b.x), y: r(b.y), hp: Math.round(b.hp * 100) / 100, weapon: b.weapon })),
      rel: Array.from(this.rel.entries()).filter(([, v]) => v !== 0),
    };
  }

  load(w: World, d: ReturnType<Rivals["serialize"]> | undefined) {
    this.clear();
    if (!d) return;
    this.started = !!d.started;
    this.nextClan = d.next ?? 1;
    for (const c of d.clans ?? []) this.clans.push({ ...c });
    for (const b of d.brutes ?? []) {
      const clan = this.clan(b.clan);
      if (clan) this.addBrute(w, clan, b.x, b.y, { name: b.name, hp: b.hp, weapon: b.weapon });
    }
    for (const [k, v] of d.rel ?? []) this.rel.set(k, v);
    // anyone mid-carry when the game was saved ends up at the camp
    for (const h of w.humans) if (h.captive && !this.clan(h.captive)) h.captive = 0;
  }
}

/* ------------------------------ helpers ------------------------------ */

function setB(b: Brute, s: BruteState, x = b.tx, y = b.ty) {
  if (b.state !== s) b.stateT = 0;
  b.state = s;
  b.tx = x;
  b.ty = y;
}

function say(b: { bubble: { text: string; t: number } | null }, text: string, t = 2) {
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

/** Take some food off our stockpile (wrapped stores lose less). */
function takeFood(w: World, n: number) {
  const s = w.camp.stock;
  let got = 0;
  for (const r of ["cooked", "meat", "fish", "crop", "berries"] as Resource[]) {
    const k = Math.min(n - got, s[r]);
    s[r] -= k;
    got += k;
    if (got >= n) break;
  }
  return got;
}

/** Remove one of our people for good. */
export function killHuman(w: World, h: Human, msg: string) {
  w.particles.burst(P.Poof, h.x, h.y, 10, 60, { size: 12, max: 0.9, color: "rgba(235,228,210,0.95)" });
  w.sfx("thud", h.x, h.y, 0.9, 0.6);
  const i = w.humans.indexOf(h);
  if (i >= 0) w.humans.splice(i, 1);
  w.events.push({ type: "removed", id: h.id });
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
