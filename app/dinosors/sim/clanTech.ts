/* ------------------------------------------------------------------ */
/*  Clan science: the Neanderthals work things out for themselves.     */
/*                                                                     */
/*  Slowly: about one invention every ten minutes for a lone band.     */
/*  Every band that unites with them speeds it up (and so do more      */
/*  grown-ups, bone totems, and captives they learn our tricks from).  */
/*  In order: bone tools → hide shields → bone totems → catapults →    */
/*  bone armour → war drums → obsidian blades → masterwork (at which   */
/*  point their kit outclasses everything we can make).                */
/* ------------------------------------------------------------------ */
import { P } from "./particles";
import type { Clan } from "./types";
import type { World } from "./world";

export type ClanTechId = "boneTools" | "hideShields" | "boneTotems" | "catapults" | "boneArmor" | "warDrums" | "obsidianBlades" | "masterwork";

export const CLAN_TECH: { id: ClanTechId; icon: string; name: string; does: string }[] = [
  { id: "boneTools", icon: "🦴", name: "bone tools", does: "they gather and build faster" },
  { id: "hideShields", icon: "🛡️", name: "hide shields", does: "they carry shields that soak up arrows" },
  { id: "boneTotems", icon: "🗿", name: "bone totems", does: "they raise totems that speed up their learning" },
  { id: "catapults", icon: "🪨", name: "catapults", does: "they build catapults that outrange our Scorpions" },
  { id: "boneArmor", icon: "🦕", name: "bone armour", does: "our hits do less to them" },
  { id: "warDrums", icon: "🥁", name: "war drums", does: "their warriors hit harder" },
  { id: "obsidianBlades", icon: "🗡️", name: "obsidian blades", does: "their warriors hit much harder" },
  { id: "masterwork", icon: "👑", name: "masterwork weapons", does: "their weapons and armour now beat everything we can make" },
];

/** How many inventions this clan has. */
export const techOf = (c: Clan | null | undefined) => Math.min(CLAN_TECH.length, c?.tech ?? 0);
export const hasTech = (c: Clan | null | undefined, id: ClanTechId) => techOf(c) > CLAN_TECH.findIndex((t) => t.id === id);

/** Seconds of study per invention for a lone band of five (before bonuses). */
const STUDY = 600;

/** How fast they're learning (inventions per second). */
export function studyRate(c: Clan, grown: number, totems: number, captives: number) {
  return (1 / STUDY) * (1 + (c.merges ?? 0) * 0.5) * (0.6 + Math.min(12, grown) * 0.08) * (1 + totems * 0.2) * (1 + Math.min(4, captives) * 0.15);
}

/** Once a second: study, and maybe a new invention. */
export function studyTick(w: World, c: Clan, dt: number, grown: number, totems: number, captives: number) {
  if (techOf(c) >= CLAN_TECH.length || grown < 1) return;
  c.science = (c.science ?? 0) + dt * studyRate(c, grown, totems, captives);
  if (c.science < 1) return;
  c.science = 0;
  c.tech = techOf(c) + 1;
  const t = CLAN_TECH[c.tech - 1];
  w.particles.burst(P.Star, c.x, c.y - 30, 8, 60, { z: 30, size: 6, max: 1 });
  w.toast(t.icon, `The ${c.name} clan worked out ${t.name}: ${t.does}.${c.tech >= CLAN_TECH.length ? " They've caught up with us… and passed us." : ""}`, c.x, c.y);
}

/** How much less our hits do to a member of this clan (bone armour, masterwork). */
export const armourOf = (c: Clan | null | undefined) => (hasTech(c, "masterwork") ? 0.55 : hasTech(c, "boneArmor") ? 0.8 : 1);
/** How much harder their warriors hit. */
export const mightOf = (c: Clan | null | undefined) => 1 + (hasTech(c, "warDrums") ? 0.15 : 0) + (hasTech(c, "obsidianBlades") ? 0.3 : 0) + (hasTech(c, "masterwork") ? 0.35 : 0);
