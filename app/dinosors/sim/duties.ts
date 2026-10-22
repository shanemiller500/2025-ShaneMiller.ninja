/* ------------------------------------------------------------------ */
/*  Sharing the tribe out across its jobs.                             */
/* ------------------------------------------------------------------ */
import type { Human, Role } from "./types";

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
