/* ------------------------------------------------------------------ */
/*  Costumes: a per-body-part description of what a fighter wears.     */
/*                                                                      */
/*  Signature fighters get hand-authored suits (Spider-Man's red/blue   */
/*  split + webbing, Cap's star & stripes, Wolverine's tiger stripes…). */
/*  Everyone else gets a costume built from their palette — which is    */
/*  sampled from their actual portrait art (see palette.ts), so all 272 */
/*  fighters wear their real colours.                                   */
/* ------------------------------------------------------------------ */

import type { Look } from "../engine/types";
import { shade } from "./util";

export type Pattern = "web" | "armor" | "panther" | "scales";
export type Chest = "spider" | "venom" | "star" | "reactor" | "discs" | "amulet" | "deadpool" | "diamond" | "bolt" | "circle" | "none";

export interface CostumeSpec {
  torso: string;
  /** Side panels under the arms (Spider-Man blue, Deadpool black) */
  sides?: string;
  /** V-shaped shoulder yoke (Wolverine blue, Thanos gold) */
  yoke?: string;
  /** Vertical abdomen stripes (Captain America) */
  abStripes?: [string, string];
  trunks: string;
  belt: string;
  buckle: "rect" | "round" | "x" | "none";
  pouches?: boolean;
  /** Wide cloth sash instead of a belt (Doctor Strange) */
  sash?: string;

  upperArm: string;
  foreArm: string;
  /** Stripe along the arms / legs (side seam) */
  armStripe?: string;
  legStripe?: string;
  glove: string;
  gloveLong?: boolean;
  /** Armband / bracer instead of a full glove (bare hands) */
  bracer?: string;
  hand: string;

  thigh: string;
  shin: string;
  boot: string;
  bootTall?: boolean;
  barefoot?: boolean;
  /** Pants torn just below the knee (Hulk) */
  tornPants?: boolean;

  pattern?: Pattern;
  patternColor?: string;
  /** Pattern only drawn on parts of these colours (e.g. web only on red) */
  patternOn?: string[];
  chest: Chest;
  chestColor?: string;
  /** Tiger stripes down the sides (Wolverine) */
  tiger?: string;
  necklace?: string;
  /** Infinity-gauntlet style gems on the front fist */
  gauntlet?: boolean;
  /** Extra shine for armour / latex suits (0..1) */
  gloss: number;
}

/* ── Hand-authored signature suits ─────────────────────────────────── */
const RED = "#c8102e";
const SPIDEY_RED = "#d4202f";
const SPIDEY_BLUE = "#1f45b8";

const SIGNATURE: Record<string, (l: Look) => Partial<CostumeSpec>> = {
  "Spider-Man": () => ({
    torso: SPIDEY_RED,
    sides: SPIDEY_BLUE,
    trunks: SPIDEY_RED,
    belt: SPIDEY_RED,
    buckle: "none",
    upperArm: SPIDEY_RED,
    armStripe: SPIDEY_BLUE,
    foreArm: SPIDEY_RED,
    glove: SPIDEY_RED,
    gloveLong: true,
    thigh: SPIDEY_BLUE,
    shin: SPIDEY_BLUE,
    boot: SPIDEY_RED,
    bootTall: true,
    pattern: "web",
    patternColor: "rgba(10,12,20,0.55)",
    patternOn: [SPIDEY_RED],
    chest: "spider",
    chestColor: "#0a0c14",
    gloss: 0.32,
  }),
  "Captain America": () => ({
    torso: "#1f3f8f",
    abStripes: [RED, "#f1f5f9"],
    trunks: "#1f3f8f",
    belt: "#6b4f2a",
    buckle: "rect",
    pouches: true,
    upperArm: "#1f3f8f",
    foreArm: "#1f3f8f",
    glove: RED,
    gloveLong: true,
    thigh: "#1f3f8f",
    shin: "#1f3f8f",
    boot: RED,
    bootTall: true,
    chest: "star",
    chestColor: "#f8fafc",
    gloss: 0.3,
  }),
  Wolverine: () => ({
    torso: "#f2c21a",
    yoke: "#1d3f8f",
    sides: "#1d3f8f",
    tiger: "#0a0c14",
    trunks: "#1d3f8f",
    belt: RED,
    buckle: "x",
    upperArm: "#1d3f8f",
    foreArm: "#f2c21a",
    glove: "#1d3f8f",
    gloveLong: true,
    thigh: "#f2c21a",
    shin: "#f2c21a",
    boot: "#1d3f8f",
    bootTall: true,
    chest: "none",
    gloss: 0.3,
  }),
  "Iron Man": () => ({
    torso: "#b3121b",
    abStripes: ["#c9a227", "#b3121b"],
    trunks: "#b3121b",
    belt: "#c9a227",
    buckle: "none",
    upperArm: "#c9a227",
    foreArm: "#b3121b",
    glove: "#b3121b",
    thigh: "#c9a227",
    shin: "#b3121b",
    boot: "#b3121b",
    bootTall: true,
    pattern: "armor",
    patternColor: "rgba(10,12,20,0.45)",
    chest: "reactor",
    gloss: 0.6,
  }),
  Thor: () => ({
    torso: "#2b3443",
    trunks: "#1c2029",
    belt: "#9aa3b2",
    buckle: "round",
    upperArm: "#2b3443",
    foreArm: "#f0c7a0",
    bracer: "#9aa3b2",
    glove: "#f0c7a0",
    hand: "#f0c7a0",
    thigh: "#1c2029",
    shin: "#1c2029",
    boot: "#3a4250",
    bootTall: true,
    pattern: "scales",
    patternColor: "rgba(200,210,225,0.18)",
    patternOn: ["#2b3443"],
    chest: "discs",
    chestColor: "#cfd6e2",
    gloss: 0.4,
  }),
  "Black Panther": () => ({
    torso: "#1c1c26",
    trunks: "#1c1c26",
    belt: "#2a2a36",
    buckle: "none",
    upperArm: "#1c1c26",
    foreArm: "#1c1c26",
    glove: "#1c1c26",
    gloveLong: true,
    thigh: "#1c1c26",
    shin: "#1c1c26",
    boot: "#1c1c26",
    bootTall: true,
    pattern: "panther",
    patternColor: "rgba(170,160,235,0.2)",
    chest: "none",
    necklace: "#cfd5e2",
    gloss: 0.45,
  }),
  "Doctor Strange": () => ({
    torso: "#1d3f8f",
    trunks: "#22263a",
    belt: "#c79a2a",
    buckle: "none",
    sash: "#c79a2a",
    upperArm: "#1d3f8f",
    foreArm: "#3b3346",
    glove: "#c79a2a",
    gloveLong: false,
    thigh: "#22263a",
    shin: "#22263a",
    boot: "#2b2240",
    bootTall: true,
    chest: "amulet",
    chestColor: "#c79a2a",
    gloss: 0.2,
  }),
  Deadpool: () => ({
    torso: "#b3121b",
    sides: "#1a1a1a",
    trunks: "#b3121b",
    belt: "#2b2b2b",
    buckle: "round",
    pouches: true,
    upperArm: "#b3121b",
    armStripe: "#1a1a1a",
    foreArm: "#b3121b",
    glove: "#1a1a1a",
    thigh: "#b3121b",
    legStripe: "#1a1a1a",
    shin: "#b3121b",
    boot: "#1a1a1a",
    bootTall: true,
    chest: "none",
    gloss: 0.3,
  }),
  Venom: () => ({
    torso: "#14141c",
    trunks: "#14141c",
    belt: "#14141c",
    buckle: "none",
    upperArm: "#14141c",
    foreArm: "#14141c",
    glove: "#14141c",
    thigh: "#14141c",
    shin: "#14141c",
    boot: "#14141c",
    chest: "venom",
    chestColor: "#f1f5f9",
    gloss: 0.55,
  }),
  Magneto: () => ({
    torso: "#a3123a",
    sides: "#5b2a7a",
    trunks: "#5b2a7a",
    belt: "#5b2a7a",
    buckle: "none",
    upperArm: "#a3123a",
    foreArm: "#a3123a",
    glove: "#5b2a7a",
    gloveLong: true,
    thigh: "#a3123a",
    shin: "#a3123a",
    boot: "#5b2a7a",
    bootTall: true,
    chest: "none",
    gloss: 0.35,
  }),
  Thanos: () => ({
    torso: "#2f4b8f",
    yoke: "#d4a429",
    trunks: "#2f4b8f",
    belt: "#d4a429",
    buckle: "rect",
    upperArm: "#2f4b8f",
    foreArm: "#2f4b8f",
    glove: "#d4a429",
    gloveLong: true,
    thigh: "#2f4b8f",
    shin: "#2f4b8f",
    boot: "#d4a429",
    bootTall: true,
    pattern: "armor",
    patternColor: "rgba(10,12,20,0.35)",
    patternOn: ["#d4a429"],
    chest: "none",
    gauntlet: true,
    gloss: 0.4,
  }),
  Hulk: (l) => ({
    torso: l.skin,
    trunks: "#6b3fa0",
    belt: "#5a3488",
    buckle: "none",
    upperArm: l.skin,
    foreArm: l.skin,
    glove: l.skin,
    hand: l.skin,
    thigh: "#6b3fa0",
    shin: l.skin,
    boot: l.skin,
    barefoot: true,
    tornPants: true,
    chest: "none",
    gloss: 0.18,
  }),
};

/** Resolve the full costume for a look (memoised on the look object). */
const cache = new WeakMap<Look, { key: string; spec: CostumeSpec }>();

export function costumeFor(look: Look, name: string): CostumeSpec {
  const key = `${look.primary}|${look.secondary}|${look.accent}|${look.skin}`;
  const hit = cache.get(look);
  if (hit && hit.key === key) return hit.spec;

  const bareArms = !!look.bareArms;
  const female = look.body === "female";
  const generic: CostumeSpec = {
    torso: look.bareChest ? look.skin : look.primary,
    sides: look.mark === "stripe" ? undefined : shade(look.primary, -0.38),
    trunks: look.secondary,
    belt: look.accent,
    buckle: (["rect", "round", "x"] as const)[name.length % 3],
    upperArm: bareArms ? look.skin : look.primary,
    foreArm: bareArms ? look.skin : look.primary,
    armStripe: bareArms ? undefined : look.accent,
    glove: look.accent,
    gloveLong: !bareArms,
    hand: look.accent,
    thigh: look.secondary,
    shin: look.secondary,
    legStripe: female ? undefined : shade(look.accent, -0.1),
    boot: look.accent,
    bootTall: name.length % 2 === 0,
    chest: (look.mark === "stripe" || look.mark === "chevron" ? "none" : look.mark) ?? "none",
    chestColor: look.accent,
    gloss: 0.3,
  };
  if (bareArms) generic.bracer = look.accent;
  const sig = SIGNATURE[name]?.(look);
  const spec: CostumeSpec = sig ? { ...generic, sides: undefined, armStripe: undefined, legStripe: undefined, ...sig } : generic;
  if (!sig) {
    // Chevron mark becomes a yoke; stripe mark becomes side panels
    if (look.mark === "chevron") spec.yoke = look.accent;
  }
  spec.hand = sig?.hand ?? spec.glove;
  cache.set(look, { key, spec });
  return spec;
}

export function patternApplies(c: CostumeSpec, color: string) {
  return !!c.pattern && (!c.patternOn || c.patternOn.includes(color));
}
