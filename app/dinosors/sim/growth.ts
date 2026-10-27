/* ------------------------------------------------------------------ */
/*  Peoples who last, grow. Every settlement of every people (the      */
/*  Neanderthal clans, the Tree, Sea, Sand + Snow People) counts how   */
/*  long it has stood; every SURVIVE_STEP seconds it survives lets it  */
/*  grow one tier bigger than it otherwise could (up to +2): more      */
/*  homes, better buildings, a wider territory, more fighters. A camp  */
/*  that's raided flat and abandoned starts again from nothing.        */
/* ------------------------------------------------------------------ */
import type { World } from "./world";

/** seconds a settlement must stand for each extra tier it may grow to */
export const SURVIVE_STEP = 1500;
export const SURVIVE_MAX = 2;

/** Extra tiers this settlement has earned by surviving (it starts counting the first time it's asked). */
export function survived(w: World, t: { since?: number }) {
  if (t.since === undefined) t.since = Math.round(w.elapsed);
  return Math.min(SURVIVE_MAX, Math.floor((w.elapsed - t.since) / SURVIVE_STEP));
}
