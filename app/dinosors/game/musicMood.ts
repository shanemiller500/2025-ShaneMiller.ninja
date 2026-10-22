import type { World } from "../sim/world";

export type MusicMood = "calm" | "hunt" | "attack";

/** Music follows what the tribe is doing, with immediate danger taking priority. */
export function musicMood(w: World): MusicMood {
  if (w.tribe.raid?.phase === "attack" || w.humans.some((h) => !h.stranger && !h.captive && h.hp > 0 && (h.state === "flee" || !!h.rally || h.state === "hide" && (h.dangerUntil ?? 0) > w.elapsed))) return "attack";
  if (w.colony.hunt && w.colony.hunt.phase !== "return" || w.tasks.list.some((t) => t.kind === "hunt" && t.people.length > 0) || w.humans.some((h) => h.order?.kind === "hunt" && h.hp > 0 && h.state !== "down")) return "hunt";
  return "calm";
}
