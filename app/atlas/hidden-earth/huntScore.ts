import type { HiddenSite } from "./sites";

/* Hunt scoring, kept free of React/MapLibre so it can be tested on its own. */

/** How far off still scores (metres): bigger features forgive more. */
export const huntTolerance = (s: HiddenSite) => Math.max(400, s.cloudHalf * 3);

/** 1,000 for a bullseye, falling linearly to 0 at the tolerance. */
export const huntScore = (s: HiddenSite, metres: number) => Math.round(1000 * Math.max(0, 1 - metres / huntTolerance(s)));
