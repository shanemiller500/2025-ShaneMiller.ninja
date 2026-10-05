/* ------------------------------------------------------------------ */
/*  Shared simulation types. The sim is DOM-free: it only holds data   */
/*  and emits events; rendering, audio and React read from it.         */
/* ------------------------------------------------------------------ */

export const TILE = 32;
export const MAP_W = 160;
export const MAP_H = 112;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

/** Ground types. Order matters only for save compatibility. */
export enum T {
  Deep = 0,
  Shallow = 1,
  Sand = 2,
  Grass = 3,
  Jungle = 4,
  Forest = 5,
  Swamp = 6,
  Mud = 7,
  Tar = 8,
  Rock = 9,
  Mountain = 10,
  Cliff = 11,
  Volcano = 12,
  Basalt = 13,
  Dirt = 14,
  Cave = 15,
  Nest = 16,
  River = 17,
}

export type Diet = "herbivore" | "carnivore" | "piscivore";
export type Locomotion = "walk" | "fly" | "swim";
export type BodyPlan =
  | "theropod"
  | "sauropod"
  | "ceratopsian"
  | "stegosaur"
  | "ankylosaur"
  | "hadrosaur"
  | "pachy"
  | "pterosaur"
  | "mosasaur";

export type SpeciesId =
  | "trex"
  | "raptor"
  | "trike"
  | "stego"
  | "brachio"
  | "apato"
  | "ankylo"
  | "spino"
  | "allo"
  | "carno"
  | "para"
  | "dilo"
  | "pachy"
  | "iguano"
  | "compy"
  | "mosa"
  | "ptera"
  | "dimorpho";

export type SoundKind = "roar" | "bellow" | "honk" | "chirp" | "screech" | "hiss" | "grunt";

export interface DinoShape {
  /** body length multiplier for the neck (sauropods etc.) */
  neck?: number;
  /** neck angle: 0 = horizontal, 1 = straight up */
  neckUp?: number;
  tail?: number;
  head?: number;
  legs?: number;
  arms?: number;
  snout?: number;
  crest?: "double" | "tube" | "ptera" | "small";
  horns?: "trike" | "carno" | "nose";
  frill?: boolean;
  plates?: boolean;
  club?: boolean;
  spikes?: boolean;
  sail?: boolean;
  feathers?: boolean;
  dome?: boolean;
  thumb?: boolean;
  /** wingspan multiplier (pterosaurs) */
  wings?: number;
}

export interface DinoLook {
  body: string;
  belly: string;
  accent: string;
  pattern: "stripes" | "spots" | "bands" | "none";
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  nick: string;
  emoji: string;
  plan: BodyPlan;
  diet: Diet;
  move: Locomotion;
  period: string;
  lengthM: number;
  weightKg: number;
  fossils: string;
  facts: string[];
  /** adult body length in world px */
  size: number;
  speed: number;
  run: number;
  hp: number;
  /** 0..1 */
  attack: number;
  defense: number;
  aggression: number;
  fear: number;
  curiosity: number;
  herd: number;
  territory: number;
  /** need gain per second (0..1 scale) */
  hungerRate: number;
  thirstRate: number;
  sense: number;
  biomes: T[];
  nocturnal?: boolean;
  /** carnivores: largest prey size (world px body length) they will chase */
  preyMax?: number;
  /** herbivores: which plant heights they reach */
  reach?: "low" | "mid" | "high";
  /** can the player lift it? */
  liftable: boolean;
  /** herbivores that stand their ground and shove predators */
  defender?: boolean;
  /** does it start unlocked in the toy box */
  starter: boolean;
  look: DinoLook;
  shape: DinoShape;
  sound: { kind: SoundKind; pitch: number };
}

export type DinoState =
  | "idle"
  | "wander"
  | "seekFood"
  | "eat"
  | "seekWater"
  | "drink"
  | "stalk"
  | "chase"
  | "tussle"
  | "flee"
  | "defend"
  | "follow"
  | "sleep"
  | "investigate"
  | "shelter"
  | "scratch"
  | "play"
  | "wallow"
  | "roar"
  | "lookUp"
  | "knocked"
  | "carried"
  | "splash"
  | "shakeTree"
  | "nest"
  | "migrate"
  | "perch"
  | "dive"
  | "breach"
  | "steal"
  | "annoyed"
  | "faint"
  | "stuck";

export interface Emote {
  icon: string;
  t: number;
}

export interface Dino {
  id: number;
  kind: "dino";
  species: SpeciesId;
  name: string;
  x: number;
  y: number;
  /** altitude (flyers) or hop height */
  z: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  age: number;
  /** 0 = hatchling, 1 = adult */
  growth: number;
  hunger: number;
  thirst: number;
  energy: number;
  health: number;
  fear: number;
  state: DinoState;
  stateT: number;
  /** time until next AI decision */
  think: number;
  tx: number;
  ty: number;
  targetId: number;
  anim: number;
  herd: number;
  parent: number;
  homeX: number;
  homeY: number;
  emote: Emote | null;
  taps: number[];
  annoy: number;
  poopT: number;
  roarT: number;
  layT: number;
  /** temporary visitors walk off the map edge and despawn */
  migrant: boolean;
  stuckT: number;
  lastX: number;
  lastY: number;
  /** remembers predator id while fleeing */
  threat: number;
  sleeping: boolean;
  /** true for whoever started a scuffle (they resolve it) */
  lead: boolean;
  wet: number;
  muddy: number;
}

export type HumanState =
  | "idle"
  | "walk"
  | "gather"
  | "carry"
  | "fish"
  | "sitFire"
  | "sleep"
  | "flee"
  | "hide"
  | "build"
  | "craft"
  | "celebrate"
  | "talk"
  | "tossed"
  | "eat"
  | "lookUp"
  | "explore";

export type Resource = "stick" | "stone" | "grass" | "leaves" | "wood" | "fish" | "berries";

export interface Human {
  id: number;
  kind: "human";
  name: string;
  child: boolean;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  state: HumanState;
  stateT: number;
  think: number;
  tx: number;
  ty: number;
  targetId: number;
  task: Resource | "craft" | "build" | null;
  carry: Resource | null;
  carryN: number;
  anim: number;
  bubble: { text: string; t: number } | null;
  hair: string;
  skin: string;
  fur: string;
  energy: number;
  hunger: number;
  fear: number;
}

export type ItemKind = "meat" | "fish" | "fruit" | "berries" | "poop" | "fossil" | "stick" | "stone";

export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  z: number;
  vz: number;
  t: number;
  /** 0..1 how much is left */
  amount: number;
  /** id of whoever is eating/carrying it */
  claimed: number;
  /** fossil species */
  species?: SpeciesId;
}

export interface Egg {
  id: number;
  species: SpeciesId;
  x: number;
  y: number;
  t: number;
  hatchAt: number;
  herd: number;
  parent: number;
}

export type PlantKind = "conifer" | "palm" | "cycad" | "broadleaf" | "fruit" | "fern" | "bush" | "reeds" | "horsetail";

export interface Plant {
  id: number;
  kind: PlantKind;
  x: number;
  y: number;
  /** 0..1 grown */
  size: number;
  /** 0..1 food left on it */
  food: number;
  /** 0..1 how burnt (1 = charred stump) */
  burnt: number;
  fruit: number;
  variant: number;
  /** shake animation timer */
  shake: number;
  /** chopped into a stump */
  stump: boolean;
}

export type PropKind = "boulder" | "spire" | "fossilDig" | "painting" | "goldEgg" | "nest";

export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  size: number;
  variant: number;
  found?: boolean;
}

export interface Shelter {
  id: number;
  x: number;
  y: number;
  /** 0 = blueprint, 1 frame, 2 walls, 3 roof, 4 finished w/ stones */
  stage: number;
  /** resources delivered toward the current stage */
  have: number;
}

export interface Campfire {
  id: number;
  x: number;
  y: number;
  lit: boolean;
  fuel: number;
  /** cooking timer */
  cook: number;
}

export interface FishSchool {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  n: number;
  t: number;
}

export type WeatherKind = "clear" | "cloudy" | "rain" | "heavyRain" | "storm" | "fog" | "windy" | "hot";

export type TechId = "tools" | "fire" | "spear" | "fishing" | "axe" | "basket" | "shelter";

export type GameEvent =
  | { type: "sfx"; sound: string; x: number; y: number; vol?: number; pitch?: number }
  | { type: "toast"; icon: string; text: string; x?: number; y?: number; fact?: string }
  | { type: "discover"; id: string }
  | { type: "shake"; amount: number; time: number }
  | { type: "flash"; amount: number; color: string }
  | { type: "unlock"; species: SpeciesId }
  | { type: "removed"; id: number };

export type Creature = Dino | Human;
