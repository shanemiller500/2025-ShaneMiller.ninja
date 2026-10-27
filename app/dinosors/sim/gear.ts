/* ------------------------------------------------------------------ */
/*  Metal gear: body armour, rider gear, and what it all does.         */
/*                                                                     */
/*  Ore is mined, smelted at the Refinery (copper / silver / gold      */
/*  bars; iron + coal → steel), and the smiths make it into weapons,   */
/*  shields, helmets and body armour (data/colony.ts ARMORS). Each     */
/*  armour set is a breastplate with arm guards + greaves.             */
/*                                                                     */
/*  People put on the best armour in the armory: riders take the heavy */
/*  rider armour first, fighters the heaviest plate, everyone else     */
/*  whatever's left. Armour takes a share off every bite, kick, club + */
/*  rock (a little off burns); with the shield, helmet and clothes it  */
/*  stacks, up to a cap so nobody is ever untouchable.                 */
/*                                                                     */
/*  Steel saddles + harness (a tribe kit) make every rider hit harder  */
/*  from the saddle and take less up there.                            */
/* ------------------------------------------------------------------ */
import { ARMORS, ARMOR_BY_ID, HELMET_BY_ID, OUTFIT_BY_ID, SHIELDS, type ArmorDef } from "../data/colony";
import type { HurtCause } from "./injury";
import type { Human } from "./types";
import type { World } from "./world";

/** However much gear they wear, a hit still does at least this share of its harm. */
export const MIN_HARM = 0.12;
/** Steel saddles: riders' hits from the saddle, and the harm they take up there. */
export const SADDLE_DMG = 1.25;
export const SADDLE_GUARD = 0.75;

const FIGHTERS = new Set(["guard", "hunter", "dragonSlayer", "eggRunner"]);

/** A Dino Rider or Dragon Rider (bonded to a mount, or up on one now). */
export const isRider = (h: Human) => !!(h.riding || h.aloft || h.dragon || h.partner);
/** Up on a mount right now. */
export const mounted = (h: Human) => !!(h.riding || h.aloft);

export const armorOf = (h: Human): ArmorDef | null => (h.gear.armor ? ARMOR_BY_ID[h.gear.armor] ?? null : null);

/** How much an armour set is worth to this person (riders value rider armour; workers skip heavy plate). */
function worth(w: World, h: Human, a: ArmorDef | null) {
  if (!a) return 0;
  const rider = isRider(h);
  const fighter = FIGHTERS.has(w.tribe.roleOf(h));
  return a.armor + (rider ? a.mounted ?? 0 : (a.mounted ?? 0) > 0 ? -0.08 : 0) + (fighter || rider ? 0 : a.look === "plate" ? -0.06 : 0);
}

/** Put on the best body armour in the armory (grown-ups only; the old set goes back on the rack). */
export function wearArmor(w: World, h: Human) {
  if (h.child || h.stranger) return;
  const armory = w.colony.armory;
  const cur = armorOf(h);
  let best = cur;
  let bs = worth(w, h, cur);
  const rider = isRider(h);
  for (const a of ARMORS) {
    // rider armour is kept for the riders
    if ((armory[a.id] ?? 0) <= 0 || (a.mounted && !rider)) continue;
    const s = worth(w, h, a);
    if (s > bs + 0.01) {
      bs = s;
      best = a;
    }
  }
  if (!best || best === cur) return;
  armory[best.id]--;
  if (cur) armory[cur.id] = (armory[cur.id] ?? 0) + 1;
  h.gear.armor = best.id;
  h.bubble = { text: best.gilded ? "Look at this!" : best.look === "hide" ? "Nice and tough." : "Clank clank!", t: 1.8 };
}

/** The share of a hit that gets through their body armour (and the rider's saddle). */
export function armorGuard(w: World, h: Human, cause: HurtCause) {
  if (cause === "cold") return 1;
  let k = 1;
  const a = armorOf(h);
  if (a) k *= 1 - (cause === "burn" ? a.armor * 0.4 : a.armor) - (mounted(h) && cause !== "burn" ? a.mounted ?? 0 : 0);
  if (mounted(h) && w.colony.kits.has("steelSaddles")) k *= SADDLE_GUARD;
  return Math.max(0, k);
}

/** Share of a bite / club blocked by everything they wear (shield, clothes, helmet, armour), for the card. */
export function protection(w: World, h: Human) {
  const shield = h.gear.shield ? SHIELDS[h.gear.shield - 1]?.block ?? 0 : 0;
  const coat = h.gear.outfit ? OUTFIT_BY_ID[h.gear.outfit]?.armor ?? 0 : 0;
  const helm = h.gear.helmet ? HELMET_BY_ID[h.gear.helmet]?.armor ?? 0 : 0;
  const k = (1 - shield) * (1 - coat) * (1 - helm) * armorGuard(w, h, "bite");
  return 1 - Math.max(MIN_HARM, k);
}

/** Damage bonus from the saddle (steel saddles, up on a mount). */
export function mountedDamage(w: World, h: Human) {
  return mounted(h) && w.colony.kits.has("steelSaddles") ? SADDLE_DMG : 1;
}

/** How many of each armour the tribe wants on hand (the auto-crafter): riders, fighters, then everyone. */
export function armorWanted(w: World, people: Human[], fighterTarget: number) {
  const riders = people.filter(isRider).length;
  return { rider: riders, heavy: fighterTarget, any: people.length };
}
