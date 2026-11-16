import type { World } from "./world";
import type { Brute, Dino, Dragon, Human, Resource } from "./types";
import { MAP_W, TILE } from "./types";
import { moveBrute, setB } from "./rivals";
import { seaRoute } from "./seaFolk";
import { hurtHuman } from "./injury";
import { ARMORS, OUTFITS, WEAPONS } from "../data/colony";

export type NationKind = "clan" | "sea" | "sand" | "tree" | "snow";
export type NationId = "us" | `${NationKind}:${number}`;
export type RelationStatus = "Hostile" | "At War" | "Unfriendly" | "Neutral" | "Friendly" | "Allied";
export type Good = Resource | `gear:${string}`;
export type DiplomacyAction = "peace" | "war" | "alliance" | "break" | "help" | "supplies" | "join";
type Pact = { a: NationId; b: NationId; score: number; war: boolean; allied: boolean; trade: boolean; ceasefire: number; cooldown: number };
export type Chronicle = { t: number; a: NationId; b: NationId; text: string; delta: number };
export type Caravan = { id: number; faction: NationId; give: Good; amount: number; receive: Good; quantity: number;
  x: number; y: number; route: number[]; step: number; age: number; phase: "incoming" | "returning"; gift: boolean; supplies: boolean; delivered: boolean };
type Mission = { faction: NationId; target: NationId; ids: number[]; until: number; reason: "help" | "war" };
export type Offer = { id: number; from: NationId; kind: "trade" | "peace" | "join"; target?: NationId; expires: number };
export type DiplomacySave = { pairs: Pact[]; history: Chronicle[]; caravans: Caravan[]; missions: Mission[]; offers: Offer[]; known: NationId[]; inventory: [NationId, Partial<Record<Good, number>>][]; next: number; aiAt: number; restockAt: number; postLevels: [number, number][]; supportAt?: [NationId, number][] };
export const PERSONALITIES: Record<NationKind, { name: string; icon: string; aggression: number; trust: number; trade: number; loyalty: number; needs: string[]; exports: Resource[] }> = {
  sea: { name: "Sea People", icon: "🌊", aggression: 0.35, trust: 0.7, trade: 1.2, loyalty: 0.7, needs: ["iron", "wood", "gear:"], exports: ["fish", "salt", "pearl", "silver"] },
  sand: { name: "Sand People", icon: "🏜️", aggression: 0.8, trust: 0.35, trade: 0.7, loyalty: 0.45, needs: ["water", "cooked", "iron"], exports: ["gold", "copper", "quartz", "stone"] },
  tree: { name: "Tree People", icon: "🌳", aggression: 0.55, trust: 0.4, trade: 0.8, loyalty: 0.65, needs: ["stone", "iron", "gear:"], exports: ["wood", "berries", "hide", "bone"] },
  snow: { name: "Snow People", icon: "❄️", aggression: 0.2, trust: 0.6, trade: 0.8, loyalty: 1.2, needs: ["cooked", "wood", "coal", "iron", "gear:furs"], exports: ["hide", "iron", "crystal", "silver"] },
  clan: { name: "Clans", icon: "🏕️", aggression: 0.6, trust: 0.5, trade: 0.7, loyalty: 0.65, needs: ["cooked", "wood", "gear:"], exports: ["bone", "stone", "copper", "hide"] },
};
const VALUES: Partial<Record<Good, number>> = { wood: 2, stone: 2, cooked: 3, water: 1, hide: 4, bone: 3, copper: 6, iron: 8, gold: 12, silver: 10, quartz: 6, crystal: 14, coal: 3, fish: 2, salt: 3, pearl: 12, berries: 1 };
export const TRADE_GOODS: { id: Good; name: string; value: number }[] = [
  ...Object.entries(VALUES).map(([id, value]) => ({ id: id as Good, name: id === "cooked" ? "Food" : id[0].toUpperCase() + id.slice(1), value: value ?? 1 })),
  ...[...WEAPONS, ...ARMORS, ...OUTFITS].map((g) => ({ id: `gear:${g.id}` as Good, name: g.name, value: Math.max(8, Object.values(g.cost).reduce((a, n) => a + (n ?? 0), 0) * 3) })),
];
const key = (a: NationId, b: NationId) => [a, b].sort().join("|");
export const nationOf = (b: Pick<Brute, "clan" | "sea" | "sand" | "tree" | "snow">): NationId =>
  b.tree ? `tree:${b.tree}` : b.sea ? `sea:${b.sea}` : b.sand ? `sand:${b.sand}` : b.snow ? `snow:${b.snow}` : `clan:${b.clan}`;
const kindOf = (id: NationId) => id.split(":")[0] as NationKind;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n: number) => Math.max(-100, Math.min(100, n));

/** Political state is per settlement. Existing folk modules retain growth, hunting and movement. */
export class Diplomacy {
  pairs = new Map<string, Pact>();
  history: Chronicle[] = [];
  caravans: Caravan[] = [];
  missions: Mission[] = [];
  offers: Offer[] = [];
  known = new Set<NationId>();
  inventory = new Map<NationId, Partial<Record<Good, number>>>();
  postLevels = new Map<number, number>();
  private next = 1;
  private tick = 0;
  private aiAt = 120;
  private restockAt = 180;
  private supportAt = new Map<NationId, number>();
  private attackAt = new Map<NationId, number>();
  private playerStrikes = new WeakMap<Brute, number>();

  settlements(w: World) {
    return [
      ...w.rivals.clans.map((t) => ({ id: `clan:${t.id}` as NationId, kind: "clan" as const, name: `${t.name} Clan`, color: t.color, x: t.x, y: t.y, found: true })),
      ...([ ["sea", w.seaFolk.tribes], ["sand", w.sandFolk.tribes], ["tree", w.forest.tribes], ["snow", w.snowFolk.tribes] ] as const).flatMap(([kind, tribes]) =>
        tribes.map((t) => ({ id: `${kind}:${t.id}` as NationId, kind, name: `${t.name} · ${PERSONALITIES[kind].name}`, color: t.color, x: t.x, y: t.y, found: !!t.found }))),
    ];
  }
  location(w: World, id: NationId) { return id === "us" ? w.camp : this.settlements(w).find((t) => t.id === id); }
  name(w: World, id: NationId) { return id === "us" ? "Our tribe" : this.location(w, id) && this.settlements(w).find((t) => t.id === id)?.name || id; }
  relation(a: NationId, b: NationId): Pact {
    const k = key(a, b);
    let p = this.pairs.get(k);
    if (!p) {
      const us = a === "us" || b === "us";
      const other = a === "us" ? b : a;
      const same = kindOf(a) === kindOf(b);
      p = { a, b, score: a === b ? 100 : us ? (kindOf(other) === "snow" ? 0 : -35) : same ? 0 : -35,
        war: false, allied: a === b, trade: false, ceasefire: 0, cooldown: 0 };
      this.pairs.set(k, p);
    }
    return p;
  }
  status(a: NationId, b: NationId): RelationStatus {
    const p = this.relation(a, b);
    return p.war ? "At War" : p.allied ? "Allied" : p.score <= -30 ? "Hostile" : p.score < -10 ? "Unfriendly" : p.score < 30 ? "Neutral" : "Friendly";
  }
  hostile(a: NationId, b: NationId) { return a !== b && (this.relation(a, b).war || this.status(a, b) === "Hostile"); }
  hostileUnit(b: Brute) { return this.hostile("us", nationOf(b)); }
  hostileDragon(dr: Dragon) { return !dr.owner && (!dr.sandTribe || this.hostile("us", `sand:${dr.sandTribe}`)); }
  nationDino(d: Dino): NationId | null { return d.owner ? "us" : d.seaTribe ? `sea:${d.seaTribe}` : d.sandTribe ? `sand:${d.sandTribe}` : d.snowTribe ? `snow:${d.snowTribe}` : d.clan ? `clan:${d.clan}` : null; }
  protectedDino(d: Dino) { const faction = this.nationDino(d); return !!faction && !this.hostile("us", faction); }
  nationTarget(w: World, id: number): NationId | null {
    const brute = w.rivals.byId(id); if (brute) return nationOf(brute);
    const dino = w.dinoById(id); if (dino) return this.nationDino(dino);
    const dragon = w.dragons.anyById(id);
    return dragon?.owner ? "us" : dragon?.sandTribe ? `sand:${dragon.sandTribe}` : null;
  }
  playerHit(w: World, b: Brute) {
    this.playerStrikes.set(b, w.elapsed);
    const id = nationOf(b);
    if ((this.attackAt.get(id) ?? -1) > w.elapsed) return;
    this.attackAt.set(id, w.elapsed + 10);
    this.change(w, "us", id, -3, "Our forces attacked their people");
    for (const ally of this.settlements(w)) if (this.relation("us", ally.id).allied && this.hostile(ally.id, id) && distance(ally, b) < 900) this.change(w, "us", ally.id, 2, "Helped defend our settlement");
  }
  rescued(w: World, b: Brute) { this.change(w, "us", nationOf(b), 8, "Rescued one of our people from a dragon"); }
  casualty(w: World, b: Brute) {
    const hit = this.playerStrikes.get(b);
    if (hit !== undefined && w.elapsed - hit <= 3) this.change(w, "us", nationOf(b), -8, "Our forces killed a member of their faction");
  }
  clearPlayerStrike(b: Brute) { this.playerStrikes.delete(b); }
  merge(w: World, from: NationId, into: NationId) {
    for (const p of Array.from(this.pairs.values())) {
      if (p.a !== from && p.b !== from) continue;
      const other = p.a === from ? p.b : p.a;
      if (other === into) continue;
      const next = this.relation(other, into);
      next.war ||= p.war;
      next.allied = !next.war && (next.allied || p.allied);
      next.score = next.war ? Math.min(next.score, p.score) : Math.max(next.score, p.score);
      next.trade ||= p.trade;
      next.ceasefire = Math.max(next.ceasefire, p.ceasefire);
    }
    if (this.known.delete(from)) this.known.add(into);
    for (const c of this.caravans) if (c.faction === from) c.faction = into;
    for (const m of this.missions) { if (m.faction === from) m.faction = into; if (m.target === from) m.target = into; }
    for (const o of this.offers) { if (o.from === from) o.from = into; if (o.target === from) o.target = into; }
    this.change(w, from, into, 0, "Settlements united; diplomatic agreements carried forward");
  }
  allowsGoal(from: NationId, goal: { kind: string; id: number }) {
    if (["town", "human", "night"].includes(goal.kind)) return this.hostile(from, "us");
    if (["clan", "sea", "sand", "tree", "snow"].includes(goal.kind)) return this.hostile(from, `${goal.kind}:${goal.id}` as NationId);
    return true;
  }
  canTarget(w: World, b: Brute, id: number) {
    if (!id) return true;
    const other = w.rivals.byId(id);
    if (other) return this.hostile(nationOf(b), nationOf(other));
    const dino = w.dinoById(id);
    const faction = dino ? this.nationDino(dino) : null;
    if (faction) return this.hostile(nationOf(b), faction);
    if (w.humans.some((h) => h.id === id) || w.dinoById(id)?.owner || w.dragons.anyById(id)?.owner) return this.hostileUnit(b);
    return true;
  }
  change(w: World, a: NationId, b: NationId, delta: number, text: string) {
    const p = this.relation(a, b);
    p.score = clamp(p.score + delta);
    this.history.unshift({ t: w.elapsed, a, b, text, delta });
    this.history.length = Math.min(this.history.length, 100);
  }
  private announce(w: World, a: NationId, b: NationId, text: string) {
    this.change(w, a, b, 0, text);
    if (a === "us" || b === "us" || this.known.has(a) || this.known.has(b)) w.toast("🤝", text);
  }
  war(w: World, a: NationId, b: NationId) {
    if (a === b || this.relation(a, b).war) return;
    const p = this.relation(a, b);
    p.war = true; p.allied = false; p.trade = false; p.score = Math.min(-60, p.score); p.ceasefire = 0;
    this.cancelTrades(w, a, b);
    this.announce(w, a, b, `${this.name(w, a)} declared war on ${this.name(w, b)}.`);
    for (const t of this.settlements(w)) if (t.id !== a && t.id !== b && this.relation(t.id, b).allied) this.change(w, a, t.id, -15, "Attacked our ally");
    if (a !== "us") this.dispatch(w, a, b, "war");
    if (b !== "us") this.dispatch(w, b, a, "war");
  }
  peace(w: World, a: NationId, b: NationId) {
    const p = this.relation(a, b);
    p.war = false; p.score = Math.max(0, p.score); p.ceasefire = w.elapsed + 300;
    for (const m of this.missions) if (key(m.faction, m.target) === key(a, b)) m.until = w.elapsed - 1;
    this.stopCombat(w);
    if (a === "us" || b === "us") {
      const faction = a === "us" ? b : a;
      const tribe = Number(faction.split(":")[1]);
      if (kindOf(faction) === "clan" || kindOf(faction) === "tree") for (const h of w.humans) {
        if (h.captive !== (kindOf(faction) === "tree" ? -tribe : tribe)) continue;
        for (const carrier of w.rivals.brutes) if (carrier.captive === h.id) carrier.captive = 0;
        w.rivals.free(w, h, `${h.name} was released under the peace agreement.`);
      }
    }
    // Missiles from before the treaty cannot keep a canceled attack alive.
    w.rivals.missiles.length = 0;
    this.announce(w, a, b, `${this.name(w, a)} and ${this.name(w, b)} agreed to peace.`);
  }
  action(w: World, id: NationId, action: DiplomacyAction, target?: NationId): string {
    if (!this.known.has(id) || !this.location(w, id)) return "Meet this faction first.";
    const p = this.relation("us", id);
    const personality = PERSONALITIES[kindOf(id)];
    if (action === "war") { this.war(w, "us", id); return "War declared. Caravans have been recalled."; }
    if (action === "break") {
      if (!p.allied) return "There is no alliance to end.";
      p.allied = false; this.change(w, "us", id, -30, "Broke our alliance");
      for (const m of this.missions) if (m.faction === id && m.reason === "help") m.until = w.elapsed - 1;
      return "Alliance ended. Trust has fallen.";
    }
    if (w.elapsed < p.cooldown) return `Wait ${Math.ceil(p.cooldown - w.elapsed)} seconds before another request.`;
    if (action === "peace") {
      const payment = p.war && p.score < -70 ? 12 : 0;
      if (payment && w.camp.stock.gold < payment) return `They require ${payment} gold to end this bitter war.`;
      w.camp.stock.gold -= payment; p.cooldown = w.elapsed + 30;
      this.peace(w, "us", id); return payment ? `Peace agreed for ${payment} gold.` : "Peace agreed. Attacks and raids have stopped.";
    }
    if (action === "alliance") {
      if (p.war || p.score < 30) return "Become friendly first: trade, gifts and aid improve trust.";
      const trust = p.score / 100 + personality.trust * 0.4 + personality.loyalty * 0.2;
      if (trust < 0.7) return "They need more trust before accepting an alliance.";
      p.allied = true; p.trade = true;
      this.change(w, "us", id, 10, "Alliance accepted");
      this.announce(w, "us", id, `${this.name(w, id)} accepted our alliance.`);
      return "Alliance formed.";
    }
    if (!p.allied) return "Only allies can be asked for military aid or supplies.";
    if (action === "supplies") {
      if ((this.supportAt.get(id) ?? 0) > w.elapsed) return "Your ally needs time to replenish supplies.";
      const good = personality.exports[0];
      const stock = this.stock(id);
      const n = Math.min(12, stock[good] ?? 0);
      if (n < 3) return "Their stores are too low to send supplies.";
      const result = this.startCaravan(w, id, "wood", 0, good, n, false, true);
      if (result === "Caravan approaching.") { this.supportAt.set(id, w.elapsed + 180); p.cooldown = w.elapsed + 20; }
      return result;
    }
    const enemy = action === "join" ? target : "us";
    if (action === "join") {
      if (!enemy || enemy === id || enemy === "us" || !this.relation("us", enemy).war) return "Choose a faction currently at war with us.";
      if (this.relation(id, enemy).allied) return "They will not attack their own ally.";
      if (p.score + personality.loyalty * 30 - personality.aggression * 10 < 50) return "They value their independence. Improve trust before asking them to join.";
      this.war(w, id, enemy);
      this.change(w, "us", id, 4, "Joined a common war");
      p.cooldown = w.elapsed + 90;
      return "Our ally joined the war and is sending fighters.";
    }
    const threats = w.rivals.brutes.filter((b) => this.hostileUnit(b) && distance(b, w.camp) < 1200);
    if (!threats.length) return "No hostile force is approaching our settlement.";
    const enemies = threats.filter((b) => !this.relation(id, nationOf(b)).allied && nationOf(b) !== id);
    if (!enemies.length) return "They will not fight their own allies.";
    if (!this.dispatch(w, id, "us", "help")) return "Their fighters are recovering or defending their own settlement.";
    for (const enemy of Array.from(new Set(enemies.map(nationOf)))) this.war(w, id, enemy);
    p.cooldown = w.elapsed + 120;
    return "Allied fighters are on their way to defend us.";
  }
  stock(id: NationId) {
    let stock = this.inventory.get(id);
    if (!stock) {
      stock = {};
      for (const good of TRADE_GOODS) stock[good.id] = good.id.startsWith("gear:") ? 2 : PERSONALITIES[kindOf(id)].exports.includes(good.id as Resource) ? 40 : 12;
      this.inventory.set(id, stock);
    }
    return stock;
  }
  owned(w: World, good: Good) { return good.startsWith("gear:") ? w.colony.armory[good.slice(5)] ?? 0 : w.camp.stock[good as Resource] ?? 0; }
  private add(w: World, good: Good, n: number) {
    if (good.startsWith("gear:")) w.colony.armory[good.slice(5)] = (w.colony.armory[good.slice(5)] ?? 0) + n;
    else w.camp.stock[good as Resource] = (w.camp.stock[good as Resource] ?? 0) + n;
  }
  value(id: NationId, good: Good) {
    const base = TRADE_GOODS.find((g) => g.id === good)?.value ?? 1;
    const p = PERSONALITIES[kindOf(id)];
    const need = p.needs.some((r) => good === r || (r === "gear:" && good.startsWith(r))) ? 1.5 : 1;
    const scarcity = Math.max(0.8, Math.min(1.5, 1.4 - (this.stock(id)[good] ?? 0) / 60));
    return base * need * scarcity;
  }
  post(w: World) { return w.colony.buildings.find((b) => b.kind === "tradingPost" && b.built >= 1 && b.hp > 0); }
  postLevel(w: World) { const p = this.post(w); return p ? this.postLevels.get(p.id) ?? 1 : 0; }
  upgrade(w: World): string {
    const post = this.post(w); const level = this.postLevel(w);
    if (!post) return "Build a Trading Post first.";
    if (level >= 3) return "Trading Post is already level 3.";
    if (w.camp.stock.wood < level * 15 || w.camp.stock.stone < level * 10 || w.camp.stock.gold < level * 5) return `Needs ${level * 15} wood, ${level * 10} stone and ${level * 5} gold.`;
    w.camp.stock.wood -= level * 15; w.camp.stock.stone -= level * 10; w.camp.stock.gold -= level * 5;
    this.postLevels.set(post.id, level + 1); return `Trading Post upgraded to level ${level + 1}.`;
  }
  quote(w: World, id: NationId, give: Good, amount: number, receive: Good) {
    const p = this.relation("us", id);
    const rate = (p.allied ? 0.95 : 0.8) + this.postLevel(w) * 0.03;
    return Math.max(0, Math.floor(amount * this.value(id, give) / this.value(id, receive) * rate));
  }
  trade(w: World, id: NationId, give: Good, amount: number, receive: Good, gift = false): string {
    if (!this.known.has(id) || !this.location(w, id)) return "Meet this faction first.";
    if (!Number.isSafeInteger(amount) || amount <= 0 || !TRADE_GOODS.some((g) => g.id === give) || !TRADE_GOODS.some((g) => g.id === receive)) return "Choose valid goods and a whole quantity.";
    const status = this.status("us", id);
    if (this.relation("us", id).war || (!gift && !["Neutral", "Friendly", "Allied"].includes(status))) return "Agree to peace before trading.";
    if (!gift && give === receive) return "Choose different goods to exchange.";
    const quantity = gift ? 0 : this.quote(w, id, give, amount, receive);
    if (!gift && quantity < 1) return "Offer more goods for at least one unit in return.";
    return this.startCaravan(w, id, give, amount, receive, quantity, gift, false);
  }
  private startCaravan(w: World, id: NationId, give: Good, amount: number, receive: Good, quantity: number, gift: boolean, supplies: boolean): string {
    const post = this.post(w); const from = this.location(w, id); const level = this.postLevel(w);
    if (!post || !from) return "Build and finish a Trading Post to receive caravans.";
    if (this.caravans.length >= level + 1) return "All caravan slots are busy. Upgrade the Trading Post for more.";
    if (amount > level * 40 || quantity > level * 40) return `This post can handle ${level * 40} units per cargo.`;
    if (this.owned(w, give) < amount) return "We do not have enough goods.";
    if ((this.stock(id)[receive] ?? 0) < quantity) return "Their stores cannot fill this order.";
    const route = seaRoute(w, from.x, from.y, post.x, post.y + TILE, 30000, kindOf(id) !== "sea");
    if (!route?.length) return "No safe route to the Trading Post. Move it to accessible ground.";
    this.add(w, give, -amount); this.stock(id)[receive] = (this.stock(id)[receive] ?? 0) - quantity;
    this.caravans.push({ id: this.next++, faction: id, give, amount, receive, quantity, x: from.x, y: from.y, route, step: 0, age: 0, phase: "incoming", gift, supplies, delivered: false });
    this.announce(w, "us", id, `Trade caravan approaching from ${this.name(w, id)}.`);
    return "Caravan approaching.";
  }
  private cancelTrades(w: World, a: NationId, b: NationId) {
    if (a !== "us" && b !== "us") return;
    const id = a === "us" ? b : a;
    this.caravans = this.caravans.filter((c) => {
      if (c.faction !== id) return true;
      if (!c.delivered) { this.add(w, c.give, c.amount); this.stock(id)[c.receive] = (this.stock(id)[c.receive] ?? 0) + c.quantity; }
      return false;
    });
  }
  private advanceCaravans(w: World, dt: number) {
    for (const c of this.caravans) {
      c.age += dt;
      if (c.delivered && c.phase === "incoming") continue;
      if (c.age > 600 || !this.post(w) || this.relation("us", c.faction).war || (!c.gift && !c.supplies && this.hostile("us", c.faction))) {
        if (!c.delivered) { this.add(w, c.give, c.amount); this.stock(c.faction)[c.receive] = (this.stock(c.faction)[c.receive] ?? 0) + c.quantity; }
        c.step = -1; continue;
      }
      const i = c.route[c.step];
      if (i === undefined) {
        if (c.phase === "returning") { c.step = -1; continue; }
        this.add(w, c.receive, c.quantity);
        this.stock(c.faction)[c.give] = (this.stock(c.faction)[c.give] ?? 0) + c.amount;
        c.delivered = true;
        const gain = c.supplies ? 2 : c.gift ? Math.min(15, 2 + Math.floor(c.amount * this.value(c.faction, c.give) / 12)) : 3 + this.postLevel(w);
        this.change(w, "us", c.faction, gain, c.supplies ? "Ally delivered supplies" : c.gift ? "Gift delivered" : "Trade completed");
        this.relation("us", c.faction).trade = true;
        this.announce(w, "us", c.faction, c.gift ? "Gift delivered. Relations improved." : "Caravan arrived. Goods exchanged.");
        c.phase = "returning"; c.route.reverse(); c.step = 0;
        continue;
      }
      const x = (i % MAP_W + 0.5) * TILE, y = (Math.floor(i / MAP_W) + 0.5) * TILE;
      const d = Math.hypot(x - c.x, y - c.y), step = Math.min(d, dt * (kindOf(c.faction) === "sand" ? 82 : kindOf(c.faction) === "sea" ? 64 : 50));
      if (w.tribe.blocks(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
      if (d < 3) c.step++;
      else { c.x += (x - c.x) / d * step; c.y += (y - c.y) / d * step; }
    }
    this.caravans = this.caravans.filter((c) => c.step >= 0);
  }
  dispatch(w: World, faction: NationId, target: NationId, reason: Mission["reason"]) {
    const home = this.location(w, faction); const destination = this.location(w, target);
    if (!home || !destination || faction === "us" || this.missions.some((m) => m.faction === faction)) return false;
    const adults = w.rivals.brutes.filter((b) => nationOf(b) === faction && (b.age ?? 180) >= (b.tree ? 100 : b.sand ? 110 : b.snow || b.sea ? 120 : 180) && b.hp > 0.6 && !b.captive && !b.snatched && !b.falling && b.weapon !== "catapult");
    if (adults.length < 4) return false;
    const party = adults.slice(0, Math.min(6, adults.length - 2));
    for (const b of party) { b.band = undefined; b.raid = false; b.war = 0; b.hidden = false; setB(b, "walk", destination.x, destination.y); }
    this.missions.push({ faction, target, ids: party.map((b) => b.id), until: w.elapsed + 180, reason });
    return true;
  }
  committed(b: Brute) { return this.missions.some((m) => m.ids.includes(b.id)); }
  missionDestination(w: World, b: Brute) {
    const m = this.missions.find((o) => o.ids.includes(b.id));
    if (!m) return null;
    const returning = w.elapsed > m.until || b.hp < 0.3 || (m.reason === "war" ? !this.hostile(m.faction, m.target) : !this.relation("us", m.faction).allied);
    return this.location(w, returning ? m.faction : m.target);
  }
  /** Intercepts political military missions; native movement and damage still do the work. */
  missionStep(w: World, b: Brute, dt: number) {
    const mission = this.missions.find((m) => m.ids.includes(b.id));
    if (!mission) return false;
    const home = this.location(w, mission.faction);
    const returning = w.elapsed > mission.until || b.hp < 0.3 || (mission.reason === "war" ? !this.hostile(mission.faction, mission.target) : !this.relation("us", mission.faction).allied);
    const destination = returning ? home : this.location(w, mission.target);
    if (!destination) return false;
    if (b.onDragon) {
      if (returning && home && distance(b, home) < 180) mission.ids = mission.ids.filter((id) => id !== b.id);
      return true;
    }
    const targets: (Brute | Human)[] = returning ? [] : w.rivals.brutes.filter((o) => o !== b && o.hp > 0 && !o.hidden && !o.snatched && !o.falling && this.hostile(mission.faction, nationOf(o)) && distance(o, b) < 400);
    if (!returning && this.hostile(mission.faction, "us")) targets.push(...w.humans.filter((h) => !h.child && !h.captive && !h.under && !h.aloft && !h.hung && h.state !== "down" && h.level === 0 && distance(h, b) < 360));
    const foe = targets.sort((a, c) => distance(a, b) - distance(c, b))[0];
    if (foe) {
      b.targetId = foe.id; b.dir = foe.x > b.x ? 1 : -1;
      const range = b.weapon === "bow" || b.weapon === "sling" ? 230 : 36;
      if (distance(b, foe) < range && !w.nav.wallBetween(b.x, b.y, foe.x, foe.y)) {
        b.state = "fight"; b.vx = b.vy = 0;
        if (b.cd <= 0) {
          b.cd = 1.8;
          if (foe.kind === "brute") w.rivals.hit(w, foe, 0.18, b.x, b.y, true);
          else hurtHuman(w, foe, 0.18, b.x, b.y, "club");
          w.sfx("whoosh", b.x, b.y, 0.5);
          if (foe.kind === "brute" && this.hostile("us", nationOf(foe)) && this.relation("us", mission.faction).allied && (this.history[0]?.t ?? -30) < w.elapsed - 15) this.change(w, "us", mission.faction, 1, "Fought a common enemy");
        }
        return true;
      }
      b.tx = foe.x; b.ty = foe.y;
    } else {
      b.tx = destination.x + (b.id % 5 - 2) * 24; b.ty = destination.y + 60;
      if (!returning && mission.reason === "war" && distance(b, destination) < 180 && b.cd <= 0) {
        b.cd = 3;
        const id = Number(mission.target.split(":")[1]);
        const structures = mission.target === "us" ? w.colony.buildings : kindOf(mission.target) === "tree" ? w.forest.tribe(id)?.pods : kindOf(mission.target) === "sea" ? w.seaFolk.tribe(id)?.huts : kindOf(mission.target) === "sand" ? w.sandFolk.tribe(id)?.tents : kindOf(mission.target) === "snow" ? w.snowFolk.tribe(id)?.lodges : undefined;
        const building = structures?.filter((s) => s.hp > 0 && distance(b, s) < 70).sort((a, c) => distance(a, b) - distance(c, b))[0];
        if (building) { building.hp = Math.max(0, building.hp - 8); w.sfx("thunk", b.x, b.y, 0.5); }
      }
    }
    b.state = "walk";
    // Preserve each folk's terrain-specific transport and mount synchronization.
    if (b.sea) w.seaFolk.diplomaticMove(w, b, dt);
    else { moveBrute(w, b, dt, b.mount ? 76 : 48); if (b.mount) (b.snow ? w.snowFolk : w.sandFolk).diplomaticRide(w, b); }
    if (!returning && mission.reason === "war" && mission.target === "us" && b.stuckT > 0.8 && b.cd <= 0) {
      const wall = w.tribe.walls.find((wall) => wall.hp > 0 && Math.hypot(wall.tx * TILE + TILE / 2 - b.x, wall.ty * TILE + TILE / 2 - b.y) < 70);
      if (wall) { wall.hp = Math.max(0, wall.hp - 12); b.cd = 2; w.sfx("thunk", b.x, b.y, 0.5); }
    }
    if (returning && home && distance(b, home) < 100) {
      mission.ids = mission.ids.filter((id) => id !== b.id); setB(b, "idle", b.x, b.y);
    }
    return true;
  }
  /** Validate again after native AI thinks, before it can swing, steal or smash a wall. */
  blockAction(w: World, b: Brute) {
    const peaceful = !this.hostileUnit(b);
    const invalid = !this.canTarget(w, b, b.targetId);
    const band = b.band ? (b.tree ? w.forest.bands : b.sea ? w.seaFolk.bands : b.sand ? w.sandFolk.bands : w.snowFolk.bands).find((band) => band.id === b.band) : null;
    const forbiddenRaid = b.raid && !(band?.goal && this.allowsGoal(nationOf(b), band.goal));
    if (!invalid && !(peaceful && (forbiddenRaid || b.hold || b.ambush || ["bash", "steal", "spy", "rally"].includes(b.state)))) return false;
    const home = this.location(w, nationOf(b));
    b.raid = false; b.war = 0; b.ambush = false; b.hold = undefined; b.targetId = 0; b.band = undefined;
    setB(b, "home", home?.x ?? b.x, home?.y ?? b.y);
    return true;
  }
  stopCombat(w: World) {
    for (const b of w.rivals.brutes) this.blockAction(w, b);
    for (const h of w.humans) {
      const target = w.rivals.byId(h.targetId), dr = w.dragons.anyById(h.targetId), dino = w.dinoById(h.targetId);
      if ((target && !this.hostileUnit(target)) || (dr && !this.hostileDragon(dr)) || (dino && this.protectedDino(dino))) {
        h.targetId = 0; h.order = null; h.rally = undefined; h.think = 0;
        if (h.state === "hunt" || h.state === "aim") { h.state = "idle"; h.stateT = 0; }
      }
    }
    for (const dr of w.dragons.list) if (!this.hostileDragon(dr)) dr.repel = undefined;
    for (const task of w.tasks.list) {
      const id = task.kind === "hunt" ? this.nationTarget(w, task.target) : task.kind === "raid" ? `clan:${task.target}` : task.kind === "treeRaid" ? `tree:${task.target}` : task.kind === "seaRaid" ? `sea:${task.target}` : null;
      if (id && !this.hostile("us", id as NationId)) {
        for (const h of w.humans) if (h.taskId === task.id) { h.taskId = 0; h.order = null; h.think = 0; }
        task.people = [];
      }
    }
    w.tribe.projectiles = w.tribe.projectiles.filter((p) => { const target = w.rivals.byId(p.target), dr = w.dragons.anyById(p.target), dino = w.dinoById(p.target); return (!target || this.hostileUnit(target)) && (!dr || this.hostileDragon(dr)) && (!dino || !this.protectedDino(dino)); });
    const raid = w.tribe.raid;
    if (raid?.by === "brute") { raid.ids = raid.ids.filter((id) => { const b = w.rivals.byId(id); return b && this.hostileUnit(b); }); if (!raid.ids.length) w.tribe.raid = null; }
    for (const folk of [w.forest, w.seaFolk, w.sandFolk, w.snowFolk]) for (const band of folk.bands) {
      const from = `${folk === w.forest ? "tree" : folk === w.seaFolk ? "sea" : folk === w.sandFolk ? "sand" : "snow"}:${band.tribe}` as NationId;
      const goal = "goal" in band ? band.goal : undefined;
      if (goal && !this.allowsGoal(from, goal)) { if ("phase" in band) band.phase = "home"; else band.mode = "home"; }
    }
  }
  respond(w: World, id: number, accept: boolean): string {
    const offer = this.offers.find((o) => o.id === id && o.expires > w.elapsed);
    if (!offer) return "That offer has expired.";
    this.offers = this.offers.filter((o) => o.id !== id);
    if (!accept) return "Offer declined.";
    if (offer.kind === "peace") { this.peace(w, "us", offer.from); return "Ceasefire agreed."; }
    if (offer.kind === "join" && offer.target) {
      if (!this.relation("us", offer.from).allied || !this.relation(offer.from, offer.target).war) return "The situation has changed.";
      this.war(w, "us", offer.target); this.change(w, "us", offer.from, 6, "Honored our alliance"); return "We joined our ally's war.";
    }
    return "Trade invitation accepted. Choose goods in the trade panel.";
  }
  update(w: World, dt: number) {
    this.advanceCaravans(w, dt);
    this.tick -= dt; if (this.tick > 0) return; this.tick = 1;
    const settlements = this.settlements(w);
    for (const s of settlements) if (s.found || w.humans.some((h) => !h.under && distance(s, h) < 650)) {
      if (!this.known.has(s.id)) { this.known.add(s.id); this.announce(w, "us", s.id, `Met ${s.name}. Diplomacy is available.`); }
    }
    this.stopCombat(w);
    for (const m of this.missions) m.ids = m.ids.filter((id) => !!w.rivals.byId(id));
    this.missions = this.missions.filter((m) => m.ids.length && w.elapsed < m.until + 240);
    this.offers = this.offers.filter((o) => o.expires > w.elapsed);
    if (w.elapsed > this.restockAt) {
      this.restockAt = w.elapsed + 180;
      for (const s of settlements) for (const good of PERSONALITIES[s.kind].exports) this.stock(s.id)[good] = Math.min(80, (this.stock(s.id)[good] ?? 0) + 8);
      for (const p of Array.from(this.pairs.values())) if (!p.war && p.score < 30 && p.score >= -10) p.score++;
    }
    if (w.elapsed < this.aiAt) return;
    this.aiAt = w.elapsed + 60;
    if (!settlements.length) return;
    const a = settlements[Math.floor(w.rng() * settlements.length)];
    const personality = PERSONALITIES[a.kind];
    const rivals = settlements.filter((s) => s.id !== a.id && distance(s, a) < 7000);
    const b = rivals[Math.floor(w.rng() * rivals.length)];
    if (b) {
      const p = this.relation(a.id, b.id);
      if (p.war && w.rng() < 0.25 + personality.trust * 0.2) this.peace(w, a.id, b.id);
      else if (!p.war && !p.allied && p.ceasefire < w.elapsed && w.rng() < personality.aggression * 0.3) this.war(w, a.id, b.id);
      else if (p.war) this.dispatch(w, a.id, b.id, "war");
      else if (!p.allied && p.score >= 30 && w.rng() < personality.trust * 0.4) {
        p.allied = true; p.trade = true; this.announce(w, a.id, b.id, `${a.name} and ${b.name} formed an alliance.`);
      } else if (!p.allied && p.score < 0 && w.rng() < personality.trust * 0.25) this.peace(w, a.id, b.id);
      else if (!this.hostile(a.id, b.id) && w.rng() < personality.trade * 0.4) this.change(w, a.id, b.id, 5, "Neighbors exchanged supplies");
    }
    if (!this.known.has(a.id) || this.offers.some((o) => o.from === a.id)) return;
    const p = this.relation("us", a.id);
    const enemy = settlements.find((s) => this.relation(a.id, s.id).war && !this.relation("us", s.id).war);
    const kind: Offer["kind"] = p.war ? "peace" : p.allied && enemy ? "join" : "trade";
    if (kind === "trade" && (p.score < -10 || w.rng() > personality.trade * 0.6)) {
      if (p.score <= -50 && !p.war && w.tribe.danger !== "calm" && p.ceasefire < w.elapsed && w.rng() < personality.aggression * 0.2) this.war(w, a.id, "us");
      return;
    }
    this.offers.push({ id: this.next++, from: a.id, kind, target: enemy?.id, expires: w.elapsed + 180 });
    this.announce(w, "us", a.id, `${a.name} ${kind === "peace" ? "requested peace" : kind === "join" ? "asked us to join a war" : "offered a trade"}.`);
  }
  snapshot(w: World) {
    const all = this.settlements(w);
    return { postLevel: this.postLevel(w), caravans: this.caravans.map((c) => ({ ...c, route: undefined })), offers: this.offers,
      factions: all.filter((s) => this.known.has(s.id)).map((s) => ({ ...s, icon: PERSONALITIES[s.kind].icon, personality: PERSONALITIES[s.kind], status: this.status("us", s.id), ...this.relation("us", s.id),
        allies: all.filter((o) => o.id !== s.id && this.relation(s.id, o.id).allied).map((o) => ({ id: o.id, name: o.name })),
        enemies: all.filter((o) => this.relation(s.id, o.id).war).map((o) => ({ id: o.id, name: o.name })),
        history: this.history.filter((h) => h.a === s.id || h.b === s.id).slice(0, 6), stock: { ...this.stock(s.id) },
      })), history: this.history.slice(0, 15) };
  }
  serialize(): DiplomacySave {
    return { pairs: Array.from(this.pairs.values()), history: this.history, caravans: this.caravans, missions: this.missions, offers: this.offers, known: Array.from(this.known), inventory: Array.from(this.inventory), next: this.next, aiAt: this.aiAt, restockAt: this.restockAt, postLevels: Array.from(this.postLevels), supportAt: Array.from(this.supportAt) };
  }
  load(data?: DiplomacySave, w?: World) {
    if (!data) {
      if (w) {
        for (const a of w.rivals.clans) for (const b of w.rivals.clans) if (a.id < b.id) {
          const legacy = w.rivals.relation(a.id, b.id), p = this.relation(`clan:${a.id}`, `clan:${b.id}`);
          p.war = legacy < 0; p.allied = legacy > 0; p.score = legacy < 0 ? -60 : legacy > 0 ? 50 : 0;
        }
        for (const t of w.snowFolk.tribes) if (t.grudge > 0) this.relation("us", `snow:${t.id}`).score = -35;
      }
      return;
    }
    this.pairs = new Map(data.pairs.map((p) => [key(p.a, p.b), p])); this.history = data.history.slice(0, 100);
    this.caravans = data.caravans; this.missions = data.missions; this.offers = data.offers; this.known = new Set(data.known);
    this.inventory = new Map(data.inventory); this.next = data.next; this.aiAt = data.aiAt; this.restockAt = data.restockAt;
    this.postLevels = new Map(data.postLevels ?? []);
    this.supportAt = new Map(data.supportAt ?? []);
  }
}
