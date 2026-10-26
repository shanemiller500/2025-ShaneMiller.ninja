/* ------------------------------------------------------------------ */
/*  Sharing the tribe out across its jobs.                             */
/*                                                                     */
/*  Protected roles: specialists are never swept up by bulk job tools  */
/*  (Set number, All, Split evenly) or the Auto balancer. In order of  */
/*  precedence:                                                        */
/*    1. Dragon Riders (bonded to a dragon, or keeping its egg): ALWAYS */
/*       protected, so a bulk change never silently breaks the bond.    */
/*    2. Dino Riders (bonded to a riding dinosaur).                     */
/*    3. Specialists: animal trainers + researchers.                    */
/*    4. Everyone else: ordinary jobs.                                  */
/*  Riders + specialists can be released for bulk tools in Camp →      */
/*  Jobs (Tribe.jobGuard, saved). Assigning one person by hand always  */
/*  works: that's the player choosing to.                              */
/* ------------------------------------------------------------------ */
import type { Human, Role } from "./types";
import type { World } from "./world";

export type ProtectedRole = "dragonRider" | "dinoRider" | "specialist";
/** Higher outranks lower. */
export const PROTECT_RANK: Record<ProtectedRole, number> = { dragonRider: 3, dinoRider: 2, specialist: 1 };
export const PROTECTED_INFO: Record<ProtectedRole, { icon: string; name: string }> = {
  dragonRider: { icon: "🐉", name: "Dragon Rider" },
  dinoRider: { icon: "🏇", name: "Dino Rider" },
  specialist: { icon: "🎓", name: "Specialist" },
};
const SPECIALISTS = new Set<Role>(["trainer", "researcher"]);

/** Which bulk tools leave alone (Dragon Riders always). Saved with the tribe. */
export interface JobGuard {
  dinoRiders: boolean;
  specialists: boolean;
}
export const DEFAULT_JOB_GUARD: JobGuard = { dinoRiders: true, specialists: true };

/** The protected role someone holds (the highest one), or null for an ordinary worker. */
export function protectedRole(w: World, h: Human): ProtectedRole | null {
  if (h.child || h.stranger || h.captive) return null;
  // a Dragon Rider: bonded to a tamed dragon, or the keeper raising one (egg included)
  if (w.dragons.owned.some((d) => d.partner === h.id || d.keeper === h.id) || w.dragons.eggs.some((e) => e.keeper === h.id && e.at !== "nest")) return "dragonRider";
  if (h.partner) {
    const d = w.dinoById(h.partner) ?? w.dinos.find((x) => x.id === h.partner);
    if (d && d.work?.partner === h.id) return "dinoRider";
  }
  if (SPECIALISTS.has(h.role)) return "specialist";
  return null;
}

/** Is this person kept out of bulk job changes (and out of the Auto balancer's reshuffles)? */
export function bulkProtected(w: World, h: Human): ProtectedRole | null {
  const p = protectedRole(w, h);
  if (!p) return null;
  if (p === "dragonRider") return p;
  if (p === "dinoRider") return w.tribe.jobGuard.dinoRiders ? p : null;
  return w.tribe.jobGuard.specialists ? p : null;
}

/**
 * Split people evenly across the jobs (the first few jobs take one extra when it doesn't divide).
 * People already doing a job keep it while it still has room; everyone else fills the gaps in order.
 * Returns who should change to what.
 */
export function evenSplit(people: Human[], roles: Role[]): Map<Human, Role> {
  const moves = new Map<Human, Role>();
  if (!roles.length || !people.length) return moves;
  const room = new Map<Role, number>(roles.map((r, i) => [r, Math.floor(people.length / roles.length) + (i < people.length % roles.length ? 1 : 0)]));
  const left: Human[] = [];
  for (const h of people) {
    const n = room.get(h.role as Role);
    if (n && n > 0) room.set(h.role as Role, n - 1);
    else left.push(h);
  }
  for (const r of roles) {
    let n = room.get(r) ?? 0;
    while (n-- > 0 && left.length) moves.set(left.shift()!, r);
  }
  return moves;
}
