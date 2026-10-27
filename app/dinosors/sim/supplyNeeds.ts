/* ------------------------------------------------------------------ */
/*  What the camp is short of, and why: the Camp panel's "Needed"      */
/*  list, so the player knows exactly what to go and get.              */
/*                                                                     */
/*  It adds up every shortfall: what the building sites still need     */
/*  delivered, the invention + civilization study being worked on, the */
/*  forge's next order, and the everyday supplies that have run low    */
/*  (the same targets the gatherers work to). Each comes with where it */
/*  comes from (a deposit to dig, a yard to cut it at, a tool needed). */
/* ------------------------------------------------------------------ */
import { CIV_TECH } from "../data/civ";
import { FORGE_ITEMS, NODES, RES_INFO } from "../data/colony";
import { TECH } from "../data/facts";
import { siteRemaining } from "./build";
import { stockGoals } from "./humans";
import type { Resource } from "./types";
import type { World } from "./world";

export interface SupplyNeed {
  r: Resource;
  icon: string;
  name: string;
  have: number;
  /** how much is needed in all (have < need) */
  need: number;
  /** what's waiting on it ("3 building jobs", "🔬 Pottery", "running low") */
  why: string[];
  /** building work is stuck waiting on it */
  blocking: boolean;
  /** where to get it */
  hint: string;
}

/** Below this share of their target, everyday supplies count as running low. */
const LOW = 0.35;
const FOOD: Resource[] = ["meat", "fish", "berries", "cooked", "crop"];

/** Where a resource comes from, and what's stopping us getting it (if anything). */
function hintFor(w: World, r: Resource): string {
  const L = w.camp.learned;
  if (r === "shaped") return w.colony.finished("shapingYard") ? "Cut from stone at the Shaping yard (stone shapers, or builders)." : "Build a Shaping yard: shapers cut it from stone.";
  if (r === "steel") return w.colony.finished("refinery") ? "Smelted at the Refinery from iron + coal: mine more iron and coal." : "Build a Refinery to smelt steel from iron + coal.";
  if (r === "goldBar" || r === "silverBar" || r === "copperBar") return w.colony.finished("refinery") ? "Smelted at the Refinery from ore: mine more ore." : "Build a Refinery to smelt it from ore.";
  if (r === "wood") return L.has("axe") ? "Gatherers chop trees (or clear an area)." : "Invent the 🪓 axe to chop wood.";
  if (r === "water") return "Fetched from fresh water into the Water store (or an Air condenser).";
  if (r === "meat" || r === "cooked") return "Hunters bring in meat; cooks roast it at the fire.";
  if (r === "fish") return "Gatherers fish at the water's edge.";
  if (r === "berries") return "Gatherers pick berry bushes (and farms + vineyards help).";
  if (r === "hide" || r === "bone" || r === "tooth") return "From hunted and butchered dinosaurs.";
  const nodes = Object.values(NODES).filter((n) => n.gives === r);
  if (nodes.length) {
    const known = w.colony.nodes.some((n) => n.found && n.amount > 0 && NODES[n.kind].gives === r);
    const tool = nodes[0].needs && !L.has(nodes[0].needs) ? nodes[0].needs : null;
    if (tool) return `Needs ${TECH[tool]?.icon ?? ""} ${TECH[tool]?.name ?? tool} to dig it out of a ${nodes[0].name.toLowerCase()} deposit.`;
    if (known) return `Gatherers dig it at a known ${nodes[0].name.toLowerCase()} deposit.`;
    return `No ${nodes[0].name.toLowerCase()} deposit found yet: explore (scouts, Dragon Riders) to find one, or mine for it in the Deep.`;
  }
  return "Gatherers collect it round the valley.";
}

/** Every supply we're short of, the most urgent first (building work waiting on it, then the biggest gap). */
export function supplyNeeds(w: World): SupplyNeed[] {
  const stock = w.camp.stock;
  const need = new Map<Resource, { n: number; why: Map<string, number>; blocking: boolean }>();
  const add = (r: Resource, n: number, why: string, blocking = false) => {
    if (n <= 0) return;
    const e = need.get(r) ?? { n: 0, why: new Map(), blocking: false };
    e.n += n;
    e.why.set(why, (e.why.get(why) ?? 0) + 1);
    e.blocking = e.blocking || blocking;
    need.set(r, e);
  };
  // 1. the building sites (not the ones still waiting on a discovery)
  for (const s of w.buildSites()) {
    if (s.locked) continue;
    for (const [r, n] of Object.entries(siteRemaining(w, s)) as [Resource, number][]) add(r, n, "building", true);
  }
  // 2. the invention + civilization study being worked on
  if (w.camp.goal && !w.camp.crafting && w.camp.goal !== "shelter") {
    const t = TECH[w.camp.goal];
    for (const [r, n] of Object.entries(t.needs) as [Resource, number][]) add(r, n, `🔬 ${t.name}`);
  }
  if (w.civ.current && !w.civ.paid) {
    const t = CIV_TECH[w.civ.current];
    for (const [r, n] of Object.entries(w.civ.costOf(w.civ.current)) as [Resource, number][]) add(r, n, `📜 ${t.name}`);
  }
  // 3. the forge's next order
  const order = w.colony.current(w);
  if (order) {
    const item = FORGE_ITEMS.find((f) => f.id === order);
    for (const [r, n] of Object.entries(w.colony.craftCost(order)) as [Resource, number][]) add(r, n, `⚒️ ${item?.name ?? order}`);
  }
  // 4. everyday supplies that have run low
  for (const [r, target] of stockGoals(w)) if (stock[r] < target * LOW) add(r, Math.ceil(target - stock[r]), "running low");
  // 5. food: under a few meals a head, every kind of food counts
  const people = w.humans.filter((h) => !h.stranger && !h.captive).length;
  const meals = FOOD.reduce((n, r) => n + (stock[r] ?? 0), 0);
  if (people && meals < people * 3) add("meat", Math.ceil(people * 3 - meals), "🍽️ food is running out");
  const out: SupplyNeed[] = [];
  for (const [r, e] of Array.from(need.entries())) {
    // (food counts all its kinds together; everything else on its own)
    const have = r === "meat" && e.why.has("🍽️ food is running out") ? meals : stock[r] ?? 0;
    if (have >= e.n) continue;
    const why = Array.from(e.why.entries()).map(([k, c]) => (k === "building" ? `🏗️ ${c} building job${c === 1 ? "" : "s"}` : k));
    out.push({ r, icon: RES_INFO[r]?.icon ?? "•", name: RES_INFO[r]?.name ?? r, have: Math.floor(have), need: Math.ceil(e.n), why, blocking: e.blocking, hint: hintFor(w, r) });
  }
  return out.sort((a, b) => Number(b.blocking) - Number(a.blocking) || (a.have / a.need) - (b.have / b.need));
}
