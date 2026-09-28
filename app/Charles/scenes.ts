import type { Season } from "./scenes/parts";
import type { PropKind } from "./props";
import type { Pose } from "./CharlesDog";
import { CABIN_VIEW } from "./scenes/CabinScene";
import { HOME_VIEW } from "./scenes/HomeScene";

/* ------------------------------------------------------------------ */
/*  Animated cartoon versions of Charles's real territory.             */
/*  Anchors are points in each scene's SVG view box, so props land on  */
/*  the actual rail, window, and door at any screen size.              */
/* ------------------------------------------------------------------ */

export type SceneId = "cabin" | "home";
export type { Season };

export interface SceneThreat {
  label: string;
  line: string;
  /** Cartoon prop that pops up at the anchor. Omit to just pulse the spot. */
  prop?: PropKind;
  at: [number, number];
  /** Prop size in px on a 640px-tall screen (far things are smaller). */
  size?: number;
  fx?: "wind" | "doorbell";
  season?: Season;
}

/** A place in the scene you can send Charles to. */
export interface Spot {
  id: string;
  label: string;
  /** Marker position in the view box. Charles walks to this x. */
  at: [number, number];
  pose: Pose;
  happy: string[];
  snark: string[];
  winter?: { happy: string[]; snark: string[] };
}

export interface SceneDef {
  id: SceneId;
  name: string;
  view: { w: number; h: number };
  /** Horizontal focus (0 left .. 1 right) when the screen is narrower than the art. */
  focusX: number;
  /** Dog width as a fraction of screen height (perspective: closer = bigger). */
  dogScale: number;
  /** Walkable floor in view-box y: [back edge, front edge]. */
  floorBand: [number, number];
  /** Dog size at the back edge relative to the front (perspective). */
  backScale: number;
  /**
   * Optional open ground beyond the floor (the cabin meadow): [far edge y, near edge y] and the
   * dog's size at the far edge. Charles gets there by the steps, and walks behind the railing.
   */
  meadow?: { band: [number, number]; farScale: number; steps: [number, number]; ground: [number, number] };
  threats: SceneThreat[];
  spots: Spot[];
  arrive: { happy: string[]; snark: string[] };
}

export const SCENES: Record<SceneId, SceneDef> = {
  cabin: {
    id: "cabin",
    name: "Cabin deck",
    view: CABIN_VIEW,
    focusX: 0.5,
    dogScale: 0.5,
    floorBand: [815, 1182],
    backScale: 0.6,
    meadow: { band: [470, 800], farScale: 0.24, steps: [155, 1003], ground: [95, 792] },
    arrive: {
      happy: ["The cabin! Fresh air, pine trees, zero doorbells. Paradise.", "Mountains. My people. Well, my trees."],
      snark: ["The cabin. Where the Wi-Fi is bad and the squirrels are worse.", "Oh good, the deck. Again. Thrilling."],
    },
    threats: [
      { label: "a squirrel", prop: "squirrel", at: [1000, 318], size: 44, line: "Squirrel on the rail. Staring at me. In my own mountains." },
      { label: "the truck", at: [80, 440], line: "The truck hasn't moved in three days. That's how they get you." },
      { label: "a rabbit", prop: "rabbit", at: [1240, 650], size: 38, line: "Rabbit in the meadow. I'm choosing peace. Today." },
      { label: "the aspen tree", at: [632, 400], line: "That aspen has been whispering all morning. I have questions." },
      { label: "the wind", fx: "wind", at: [800, 400], line: "The wind. Again. It knows exactly what it did." },
      { label: "a plastic bag", prop: "bag", at: [820, 250], size: 38, line: "Plastic bag. Possibly a ghost. Barked to be safe." },
      { label: "falling snow", prop: "snow", at: [520, 250], size: 44, season: "winter", line: "Snow fell off that tree. Coordinated attack. I saw the whole thing." },
      { label: "a snowplow", at: [80, 470], season: "winter", line: "I heard a snowplow. Four miles away. Still counts." },
      { label: "a butterfly", prop: "butterfly", at: [900, 480], size: 34, season: "summer", line: "A butterfly. Flapping. Clearly up to something." },
      { label: "a bee", prop: "bee", at: [1100, 300], size: 30, season: "summer", line: "A bee. I respect the bee. From here. Loudly." },
    ],
    spots: [
      {
        id: "bowl",
        label: "Water bowl",
        at: [1500, 830],
        pose: "sniff",
        happy: ["Water. Crisp. Mountain fresh. Five stars.", "Hydration break. Being this handsome is exhausting."],
        snark: ["The bowl is half empty. I'm a realist.", "Tap water. At a cabin. We're really roughing it."],
        winter: {
          happy: ["Frozen water bowl. It's basically a popsicle now. Winning."],
          snark: ["Someone froze my water. I'm filing a report."],
        },
      },
      {
        id: "rail",
        label: "Lookout",
        at: [950, 805],
        pose: "alert",
        happy: ["Best view in Colorado. I'd know. I've sniffed all of it.", "Look at all those trees. Every single one is mine."],
        snark: ["Scanning for threats. Found one. It's you.", "Standing guard. You're welcome, everyone."],
      },
      {
        id: "meadow",
        label: "The meadow",
        at: [900, 650],
        pose: "sniff",
        happy: ["Off the deck! Freedom smells like pine and deer.", "Meadow time. Every blade of grass has a story."],
        snark: ["I'm in the meadow now. Don't wait up.", "Out here, I make the rules. Rule one: no baths."],
        winter: {
          happy: ["Belly deep in snow and living my best life.", "Snow zoomies zone. Clear the area."],
          snark: ["My legs are in the snow. My dignity is also in the snow.", "Cold. Wet. Worth it. Barely."],
        },
      },
      {
        id: "treeline",
        label: "Tree line",
        at: [1260, 505],
        pose: "alert",
        happy: ["The edge of the forest. Something out there knows my name."],
        snark: ["Standing guard at the trees. The trees started it."],
      },
      {
        id: "steps",
        label: "The steps",
        at: [250, 950],
        pose: "sit",
        happy: ["Sitting on the steps like a very good boy. Take a picture. It won't happen again."],
        snark: ["I'll guard the stairs. Mostly from people without snacks."],
      },
      {
        id: "sunny",
        label: "Sunny spot",
        at: [1030, 1010],
        pose: "lie",
        happy: ["Sunbeam acquired. Do not disturb."],
        snark: ["This is my sunbeam. Find your own."],
        winter: {
          happy: ["Snow angel. Dog edition. Nailed it."],
          snark: ["Lying in the snow. Emotionally, I'm fine."],
        },
      },
      {
        id: "post",
        label: "Corner post",
        at: [330, 720],
        pose: "sniff",
        happy: ["Checking my messages. The squirrel left a whole novel."],
        snark: ["Checking my messages. Mostly spam from the deer."],
      },
    ],
  },
  home: {
    id: "home",
    name: "Home",
    view: HOME_VIEW,
    focusX: 0.4,
    dogScale: 0.46,
    floorBand: [900, 994],
    backScale: 0.82,
    arrive: {
      happy: ["Home! Where the kids drop food and the couch is almost allowed.", "Home sweet home. Mostly sweet. The doorbell is here."],
      snark: ["Home. Where the doorbell lives. My nemesis.", "Back inside. The rug missed me. Probably."],
    },
    threats: [
      { label: "a delivery", prop: "box", at: [790, 700], size: 40, line: "A box. On MY porch. Nobody panic. I'll panic for all of us." },
      { label: "a squirrel", prop: "squirrel", at: [790, 520], size: 38, line: "Porch squirrel. We've discussed this." },
      { label: "a kid on a bike", prop: "bike", at: [790, 400], size: 40, line: "Neighborhood child on wheels. Moving too fast. Suspicious." },
      { label: "the neighbor's dog", prop: "dog", at: [790, 640], size: 42, line: "Gary. From next door. He knows what he did." },
      { label: "the doorbell", fx: "doorbell", at: [519, 470], line: "The doorbell. The single worst sound ever invented." },
      { label: "the painting", at: [1180, 280], line: "That painting has been making eye contact for three years." },
      { label: "the sunglasses", at: [1060, 548], line: "The sunglasses moved. I saw it. Nobody believes me." },
      { label: "a spider", prop: "spider", at: [560, 950], size: 30, line: "Spider on the rug. I've decided it lives here now." },
      { label: "the snowman", at: [812, 630], season: "winter", line: "There's a snowman in the yard. He hasn't blinked in six hours." },
      { label: "the wreath", at: [519, 190], season: "winter", line: "Someone hung a plant on the door. Nobody asked me." },
      { label: "a fly", prop: "fly", at: [600, 600], size: 26, season: "summer", line: "A fly. Inside. The security breach of the century." },
    ],
    spots: [
      {
        id: "door",
        label: "Front door",
        at: [540, 760],
        pose: "sit",
        happy: ["Door watch. Somebody has to do it, and I'm very good at it."],
        snark: ["I'll sit here until someone lets me out. Or feeds me. Or both."],
      },
      {
        id: "window",
        label: "Window",
        at: [790, 560],
        pose: "alert",
        happy: ["Window time. Best show in town. Tonight's episode: a leaf."],
        snark: ["Staring out the window. The mailman knows why."],
      },
      {
        id: "rug",
        label: "The rug",
        at: [600, 945],
        pose: "lie",
        happy: ["The rug. Softest spot in the house. Allegedly for wiping feet."],
        snark: ["Shedding on the good rug. Strategically."],
      },
      {
        id: "console",
        label: "Snack table",
        at: [1160, 575],
        pose: "beg",
        happy: ["Something up there smells amazing. Could be keys. Could be destiny."],
        snark: ["I can smell the granola bar in that bin. Don't insult me."],
      },
      {
        id: "bench",
        label: "Shoe bench",
        at: [150, 740],
        pose: "sniff",
        happy: ["Kid shoes. So many stories. Mostly about juice."],
        snark: ["Somebody's sneakers need to go to jail."],
      },
      {
        id: "chair",
        label: "The chair",
        at: [1500, 720],
        pose: "sit",
        happy: ["I'm not ON the chair. I'm near the chair. Legally different."],
        snark: ["Not allowed on the chair. Noted. Ignored."],
      },
    ],
  },
};

export function threatsFor(scene: SceneDef, season: Season) {
  return scene.threats.filter((t) => !t.season || t.season === season);
}

/** The visible slice of a scene's art for a screen size (cover, bottom-anchored, focused on focusX). */
export function sceneCrop(scene: SceneDef, stageW: number, stageH: number) {
  const { w: iw, h: ih } = scene.view;
  const s = Math.max(stageW / iw, stageH / ih);
  const vw = stageW / s;
  const vh = stageH / s;
  const vx = scene.focusX * (iw - vw);
  const vy = ih - vh;
  return { s, vx, vy, vw, vh, viewBox: `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}` };
}

/** Map a view-box point to screen pixels. */
export function sceneToStage(scene: SceneDef, px: number, py: number, stageW: number, stageH: number) {
  const c = sceneCrop(scene, stageW, stageH);
  return { x: (px - c.vx) * c.s, y: (py - c.vy) * c.s, scale: c.s };
}

/** Winter from November through March, summer otherwise. */
export function defaultSeason(date = new Date()): Season {
  const m = date.getMonth();
  return m >= 10 || m <= 2 ? "winter" : "summer";
}
