/* ------------------------------------------------------------------ */
/*  Shared simulation types. The sim is DOM-free: it only holds data   */
/*  and emits events; rendering, audio and React read from it.         */
/* ------------------------------------------------------------------ */

import type { Genes } from "./genetics";
import type { DragonBreed, DragonCmdKind, DragonSkill } from "../data/dragons";

export const TILE = 32;
/** The most people a tribe can grow to. */
export const MAX_PEOPLE = 100;
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
  | "mosasaur"
  | "plesiosaur";

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
  | "plesio"
  | "plio"
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
  // a sea hunter bursting out of the water at its prey (seaHunters.ts)
  | "lunge"
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
    | "war"
  | "work"
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
  | "stuck"
  | "raid"
  | "attackWall"
  /** carrying a cave person around */
  | "ridden";

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
  /** marching on the cave camp */
  raider: boolean;
  /** tamed by a Neanderthal clan (its id): lives in their pen, fights in their raids */
  clan?: number;
  /** a war animal on guard duty (warGuard.ts): the person it's guarding out in the wild, and where it is on its patrol ring */
  ward?: number;
  /** harnessed to pull a war chariot (its id): the chariot moves it (chariots.ts) */
  chariot?: number;
  patrolA?: number;
  /** a sea hunter's current hunt: who, where it lies in wait, how long it's waited (seaHunters.ts) */
  seaHunt?: { kind: "human" | "brute" | "dino"; prey: number; sx: number; sy: number; wait?: number; back?: boolean };
  /** seconds until a sea hunter hunts again */
  huntCd?: number;
  /** evolution tier: 0 normal, 1 tough, 2 alpha */
  tier: number;
  /** working down the mine as a pack animal (parked + hidden on the surface; see packs.ts) */
  under?: boolean;
  /** inherited genes (size, speed, toughness, colour, mutation) */
  genes: Genes;
  /** generation number */
  gen: number;
  /** 0..1 how much it trusts the tribe (befriending herbivores) */
  tame: number;
  /** befriended: lives near camp, can be ridden if its species allows */
  owner: boolean;
    /** 0..1 progress from working with a trainer */
    warTraining?: number;
    /** fitted protection: 0 none, 1 hide and bone, 2 metal */
    warArmor?: number;
  /** hurrying (running) to meet its rider */
  hurry?: boolean;
    /** seconds until this animal can strike again */
    warCd?: number;
    /** short pause between bone-tusk collision hits */
    spikeCd?: number;
  /** id of the person riding it (0 = nobody) */
  rider: number;
  /** Extra passengers on a trained sauropod. */
  passengers?: number[];
  /** Settlement work training and the load physically carried on this animal. */
  work?: {
    skills: Partial<Record<"hauler" | "riding" | "heavy" | "runner" | "scout" | "flyer", number>>;
    focus: "hauler" | "riding" | "heavy" | "runner" | "scout" | "flyer" | null;
    /** the person bonded to this dinosaur as its rider (a Dino Rider team, see riders.ts) */
    partner?: number;
    /** a scouting flight / ride under way: where to, and when it was set off */
    mission?: { x: number; y: number; kind: "scout" | "warn"; home: boolean } | null;
    /** the player sent the rider team somewhere: ride there (then carry on with the day's work) */
    rideTo?: { x: number; y: number; label: string } | null;
    /** when (world elapsed seconds) the team's next scouting trip is due */
    missionAt?: number;
    trainer: number;
    practice: number;
    harness: number;
    auto: boolean;
    cargo: Resource | null;
    cargoN: number;
    job: "collect" | "deliver" | "travel" | "clear" | null;
    /** land clearing: the middle of the patch being cleared */
    clearX?: number;
    clearY?: number;
    source: "stock" | "mine" | null;
    site: string;
    targetX: number;
    targetY: number;
    manual: boolean;
    loadT: number;
    helper?: number;
    boardUntil?: number;
  };
  /** seconds since fire/lava last hurt it (charred bones if it dies hot) */
  burn: number;
  /** nav path (tile indices) + the goal it was planned for */
  path: number[] | null;
  pathI: number;
  pathKey: number;
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
  | "explore"
  | "hunt"
  | "aim"
  | "haul"
  | "loadDino"
  | "cook"
  | "farm"
  | "guard"
  | "repair"
  | "heal"
  | "operate"
  | "tame"
    | "train"
  | "ride"
  | "down"
  | "douse"
  | "rest"
  | "smith"
  | "research"
  | "resonate"
  | "captive"
  /** lying back studying the night sky (see sky.ts) */
  | "stargaze"
  /** sitting in the shade / under a covered rest area (see shade.ts) */
  | "relax"
  /** feeding, calming or drilling a tamed dragon, or tending a dragon egg (see dragonKeep.ts) */
  | "dragonCare"
  /** blasting a fire with an ultrasonic emitter (see sonic.ts) */
  | "sonic"
  /** a dragon slayer drilling (see dragonRaid.ts) */
  | "drill"
  /** heaving a building up / setting it down (see moving.ts) */
  | "lift"
  /** a keeper playing with their dragon (see keepers.ts) */
  | "dragonPlay"
  /** a keeper directing their dragon in a show / someone watching it (see shows.ts) */
  | "show"
  | "watch";

export type Resource =
  | "stick"
  | "stone"
  | "limestone"
  | "grass"
  | "leaves"
  | "wood"
  | "fish"
  | "berries"
  | "meat"
  | "cooked"
  | "crop"
  | "flour"
  | "water"
  | "clay"
  | "iron"
  | "gold"
  | "obsidian"
  | "flint"
  | "tar"
  | "salt"
  | "hide"
  | "bone"
  | "tooth"
  | "copper"
  | "quartz"
  | "magnetite"
  | "crystal"
  | "meteorite"
  | "shaped"
  | "diamond"
  | "silver"
  | "coal"
  | "goldBar"
  | "silverBar"
  | "copperBar";

/** What a cave person does. "auto" lets the tribe decide. */
export type Role = "auto" | "gatherer" | "builder" | "hunter" | "guard" | "cook" | "farmer" | "smith" | "researcher" | "shaper" | "technician" | "miner" | "trainer" | "dragonSlayer" | "eggRunner" | "dragonKeeper";

export type HumanOrder = { kind: "hunt"; id: number } | { kind: "guard"; x: number; y: number; top?: boolean } | null;

export type WeaponKind = "spear" | "sword" | "axe" | "bow";

export interface Gear {
  /** armory item id like "spear2" (null = whatever the tribe's tech allows) */
  weapon: string | null;
  /** 0 = none, 1..3 shield tier */
  shield: number;
  /** hide clothing id ("cloak", "raincloak", "tunic", "furs") */
  outfit?: string | null;
  /** metal helmet id ("helmCopper", "helmGold"…) */
  helmet?: string | null;
}

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
  /** on town clean-up duty (cleanup.ts) */
  cleaning?: boolean;
  /** knocked out: seconds lying there waiting for help, whether they're fading, and when someone last patched them up (death.ts) */
  downT?: number;
  fading?: boolean;
  helpedAt?: number;
  anim: number;
  bubble: { text: string; t: number } | null;
  hair: string;
  skin: string;
  fur: string;
  energy: number;
  hunger: number;
  fear: number;
  role: Role;
  /** Work schedule; manual assignments survive Auto Balance. */
  shift?: "day" | "night";
  shiftManual?: boolean;
  /** the job the tribe picked when role is "auto" */
  autoRole: Role;
  order: HumanOrder;
  /** seconds alive (kids grow up) */
  age: number;
  /** weapon cooldown */
  cd: number;
  /** 0..1 health; 0 = knocked out */
  hp: number;
  /** 0..1 body heat (cold weather, snow) */
  warmth: number;
  gear: Gear;
  /** player task this person is working on (0 = none) */
  taskId: number;
  taskStep: number;
  /** Local emergency state; ordinary work remains assigned while sheltering. */
  dangerUntil?: number;
  /** standing their ground beside friends (see courage.ts): who they're fighting, how many were with them. Not saved. */
  rally?: { id: number; band: number };
  /** where they're running to; `open` = just open ground away from the threat, not cover */
  refuge?: { x: number; y: number; open?: boolean };
  interrupted?: { state: HumanState; x: number; y: number; tx: number; ty: number };
  /** nav path: node ids (tile + level * tiles) */
  path: number[] | null;
  pathI: number;
  pathKey: number;
  /** 0 = ground, 1 = up on a wall / tower walkway */
  level: number;
  /** dino being ridden */
  riding: number;
  /** shelter they live in (0 = the cave) */
  home: number;
  family: number;
  /** the campfire or shade structure (and seat at it) this person is heading to or sitting at */
  fireId?: number;
  /** the dinosaur this person is bonded to as its rider (a Dino Rider team) */
  partner?: number;
  /** the tamed dragon this person is bonded to (a Dragon Rider) */
  dragon?: number;
  /** riding a dragon right now (its id): position follows it, the sim leaves them be */
  aloft?: number;
  /** carrying a dragon egg (its id) */
  egg?: number;
  /** a second egg (egg runners in their kit carry two) */
  egg2?: number;
  /** 0..1 dragon-slaying drill (hits dragons harder, rolls away from fire) */
  slayer?: number;
  /** carrying an ultrasonic fire emitter from the fire station */
  sonic?: boolean;
  /** snatched by a wild dragon (its id): dangling under it */
  snatched?: number;
  /** on the way to pick up this dragon egg (to carry it to the incubator) */
  eggFor?: number;
  /** where the emitter is pointed */
  aim?: { x: number; y: number };
  seat?: number;
  /** construction site being worked on ("wall:12", "" = none) */
  site: string;
  /** wants to stand up on the wall walkway at its goal */
  wantTop: boolean;
  /** a wanderer who hasn't joined yet */
  stranger: boolean;
  /** down in the mine (the surface brain leaves them alone; see sim/miners.ts) */
  under?: boolean;
  /** carried off by a Neanderthal clan (its id); 0 / missing = free */
  captive?: number;
  /** walking out with this person to protect them (packs) */
  escort?: number;
  /** dropped by a dragon: falling through the air (dragons.ts moves the body) */
  falling?: boolean;
  /** the captured clan catapult this person crews (bonded to it for good: ourCatapults.ts) */
  catapult?: number;
  /** made to wear a clan's rags while held captive (its id) */
  clanGarb?: number;
  /** seconds held captive (long enough, and some give up and join the clan) */
  captiveT?: number;
  /** a captive's chore: where they're sent to fetch from, and the load they're bringing back */
  chore?: { x: number; y: number; r: "food" | "wood" | "bones"; t: number; back: boolean } | null;
  /** riding in a war chariot (its id): the chariot moves them (chariots.ts) */
  chariot?: number;
}

/* ------------------------------ Neanderthals ------------------------------ */

/** Basic weapons only: Neanderthals never invent bows, metal or energy weapons. */
export type BruteWeapon = "club" | "axe" | "spear" | "rock" | "sling" | "catapult"
  // the Tree People's (treeFolk.ts): bone knives + short bows
  | "bone" | "bow";

export type BruteState = "idle" | "wander" | "walk" | "sleep" | "fight" | "hunt" | "forage" | "bash" | "carry" | "flee" | "home" | "loot" | "rally" | "spy" | "lurk" | "siege"
  // clan life (clanLife.ts): gathering bones + wood, building, sparring, digging traps, fetching someone caught;
  // the dragon rite (clanRite.ts): dancing round the altar, jumping for joy
  | "gather" | "build" | "train" | "trap" | "collect" | "dance" | "cheer"
  // taming a wild dino for the clan's pen
  | "tame"
  // Tree People (treeFolk.ts): up in a tree, climbing, leaping down on someone, darting back out of reach
  | "perch" | "climb" | "drop" | "dart";

/** What a clan builds up at home (clanLife.ts). */
export type ClanBuild = "longhouse" | "smokehouse" | "boneRack" | "trainingRing" | "dragonAltar" | "dinoPen" | "boneFence" | "boneTotem";

/** A Neanderthal pit trap dug where our people walk. */
/** Part of our town the Neanderthals have taken and are holding (clanHolds.ts). */
export interface ClanHold {
  id: number;
  clan: number;
  x: number;
  y: number;
  r: number;
  /** supplies the occupiers have left */
  food: number;
  /** seconds held */
  t: number;
  /** surrounded by our people: no supplies get through */
  cut: boolean;
}

/** A war chariot: a Triceratops-drawn fighting wagon with two Scorpions and 10 seats (chariots.ts). */
export interface Chariot {
  id: number;
  x: number;
  y: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  /** the Triceratops pulling it (dino id; 0 = none harnessed yet) */
  trike: number;
  /** where it parks at home */
  homeX: number;
  homeY: number;
  /** where it's driving to (null = standing) */
  to: { x: number; y: number } | null;
  path: number[] | null;
  pathI: number;
  pathKey: number;
  /** the two Scorpions: seconds to reload, and aim (radians) */
  cd: [number, number];
  aim: [number, number];
  anim: number;
  /** flash when it's hit */
  hit: number;
}

export type HuntFormation = "ring" | "pincer" | "wedge";

/** A dragon hunt in war chariots: an event you win or lose (chariots.ts). */
export interface DragonHunt {
  nest: number;
  formation: HuntFormation;
  phase: "muster" | "march" | "surround" | "battle" | "collect" | "return";
  t: number;
  /** attacking a Neanderthal clan's camp instead of a nest (its id) */
  clan?: number;
  /** hunting one wild dragon wherever it goes (its id) instead of a nest */
  dragon?: number;
  /** on the march: stopped to fight a threat on the way (its id), and for how long */
  engage?: number;
  engageT?: number;
  /** mustering: how many are ready / needed */
  ready?: number;
  need?: number;
  /** where the formation was laid out (a moving dragon gets it laid out again) */
  cx?: number;
  cy?: number;
  /** each crew member: which chariot + seat (0..9), their own dino / dragon to ride, or on foot; runners fetch the eggs;
   *  their place in the formation (set when they march) */
  crew: { id: number; chariot: number; seat: number; runner: boolean; ride?: "dino" | "dragon"; mount?: number; sx?: number; sy?: number }[];
  /** how many set out (to judge losses) */
  start: number;
  eggs: number;
  result?: "won" | "lost";
}

/** A clan catapult we captured (ourCatapults.ts). */
export interface OurCatapult {
  id: number;
  x: number;
  y: number;
  dir: 1 | -1;
  /** the person who took it: they crew it, keep it up and upgrade it (for good) */
  keeper: number;
  /** 1..3 */
  level: number;
  /** 0..1 worn down (1 = broken until repaired) */
  wear: number;
  cd: number;
  anim: number;
}

export interface ClanTrap {
  id: number;
  clan: number;
  x: number;
  y: number;
  /** seconds it has been dug */
  t: number;
  /** who fell in (human id; 0 = still hidden) */
  caught: number;
}

/** A Neanderthal: bigger + stronger than our people, not as clever. CPU-run. */
export interface Brute {
  id: number;
  kind: "brute";
  name: string;
  clan: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  /** 0..1 */
  hp: number;
  weapon: BruteWeapon;
  state: BruteState;
  stateT: number;
  think: number;
  tx: number;
  ty: number;
  /** who / what they're after (human, brute, dino or wall id) */
  targetId: number;
  cd: number;
  anim: number;
  path: number[] | null;
  pathI: number;
  pathKey: number;
  stuckT: number;
  /** marching on our camp right now */
  raid: boolean;
  /** off to fight another clan (its id) */
  war: number;
  /** person being carried off (id) */
  captive: number;
  /** Captive reserved as one gruesome catapult salvo during this raid. */
  siegeCaptive?: number;
  siegeShots?: number;
  /** food grabbed from a stockpile */
  loot: number;
  /** Age in game seconds; young clan members stay near home until grown. */
  age?: number;
  /** Food gathered from the wild and carried back to this clan. */
  forage?: number;
  forageKind?: "berries" | "fruit" | "meat" | "fish";
  /** what that loot was (food unless they raided our stores) */
  lootKind?: Resource;
  /** hiding in the grass waiting to jump on our people */
  ambush?: boolean;
  /** the colour of the band they were born into (a union's members keep theirs) */
  tint?: string;
  /** snatched by a wild dragon (its id) */
  snatched?: number;
  /** dropped by a dragon: falling through the air (dragons.ts moves the body) */
  falling?: boolean;
  /** holding part of our town (a clanHolds.ts hold id) */
  hold?: number;
  /** once one of ours: a captive who gave up and joined the clan */
  turned?: boolean;
  /** looks like one of our people (someone who joined, or their child), not a Neanderthal */
  look?: { skin: string; hair: string; fur: string };
  /** 0..1 fighting skill from sparring at the clan's training ring */
  skill?: number;
  /** bones / wood being carried home for the clan's building */
  haul?: { r: "bones" | "wood"; n: number };
  /** the site (gather) / project (build) it's working on */
  job?: string;
  /** seconds spent on the job at hand */
  work?: number;
  /** one of the Tree People (treeFolk.ts): the id of their tree tribe (clan is 0) */
  tree?: number;
  /** a Tree Person hidden up in the leaves / down in the brush: our side can't see them to shoot */
  hidden?: boolean;
  /** the ambush / raid band (treeFolk.ts) they're part of */
  band?: number;
  /** which way round they circle a foe (−1 / 1) and how wide */
  flank?: number;
  /** a Tree Person's perch: how high up the tree they climb / sit (px) */
  up?: number;
  /** after dark a Tree Person is only seen for this long after coming close / near a fire / striking (s, not saved) */
  spotT?: number;
  bubble: { text: string; t: number } | null;
}

/* ------------------------------ Tree People (treeFolk.ts) ------------------------------ */

/** One platform up in a camp tree: a hut, a bare deck, a lookout, a hanging store or the ritual deck. */
export interface TreePod {
  x: number;
  y: number;
  /** height of the deck above the ground (px) */
  h: number;
  kind: "hut" | "deck" | "lookout" | "store" | "ritual";
  /** 0..1: 0 = pulled down / burnt */
  hp: number;
}

/** A tribal warning display at the edge of their forest. */
export interface TreeSign {
  x: number;
  y: number;
  kind: "totem" | "bones" | "spikes" | "marks" | "trophy" | "remains";
  v: number;
}

/** A feral tribe living up in the forest canopy. */
export interface TreeTribe {
  id: number;
  name: string;
  /** body-paint colour */
  color: string;
  /** the camp's heart (the ground under the platforms) */
  x: number;
  y: number;
  pods: TreePod[];
  signs: TreeSign[];
  /** territory radius (they roam + ambush inside it) */
  r: number;
  /** 0-3: bigger camps hold more of them */
  tier: number;
  food: number;
  growT: number;
  raidT: number;
  ambushT: number;
  /** growth toward the next tier */
  work: number;
  /** an outpost founded from this tribe */
  parent?: number;
  /** every paint it wears: its own + each tribe that united with it */
  colors?: string[];
  /** how many tribes have united into this one (each union lets the camp grow bigger) */
  merges?: number;
  /** seconds of darkness till they next sneak into our town */
  nightT?: number;
  /** our people have spotted its warning signs */
  seen?: boolean;
  /** our people have scouted the camp itself */
  found?: boolean;
}

/** An ambush or raiding party. */
export interface TreeBand {
  id: number;
  tribe: number;
  mode: "lurk" | "strike" | "raid" | "home";
  /** the ambush spot / the raid's goal */
  x: number;
  y: number;
  ids: number[];
  t: number;
  /** a raid's target: our town's edge, a Neanderthal camp, or one person */
  /** "night": a sneak raid on our town after dark (steal + snatch people) */
  goal?: { kind: "town" | "clan" | "human" | "night"; id: number };
  /** how many set out (morale: they break once too many are down) */
  size: number;
  /** a volley's been thrown: the charge comes next */
  volley?: boolean;
}

/** A small Neanderthal band with its own camp. Relations: -1 war, 0 wary, 1 allies. */
export interface Clan {
  id: number;
  name: string;
  color: string;
  /** every colour it flies: its own + each clan that united with it (see clanTowns.ts) */
  colors?: string[];
  x: number;
  y: number;
  food: number;
  /** seconds until they raid our camp */
  raidT: number;
  growT: number;
  /** Stable architecture used for this clan's camp. */
  style?: "hide" | "timber" | "bone";
  /** 0-3; bigger camps house more people and field larger parties. */
  campTier?: number;
  /** Work contributed by adults at home toward the next camp expansion. */
  campWork?: number;
  /** A shore camp with a fishing trap area. */
  sea?: boolean;
  /** Seconds until the shore traps bring in fish. */
  fishT?: number;
  /** how cunning they've become from spying on us: 1 ambushes, 2 shields, 3 raid our stores + take kids */
  smarts?: number;
  /** spy reports brought home */
  intel?: number;
  /** seconds until they send the next spy / ambush party */
  spyT?: number;
  ambushT?: number;
  /** building stores (clanLife.ts) */
  bones?: number;
  wood?: number;
  /** what's been built, and its level */
  builds?: Partial<Record<ClanBuild, number>>;
  /** work done on the project under way */
  buildWork?: number;
  /** a wild dragon that's been fed an offering: it leaves this clan alone until favorT runs out */
  favor?: number;
  favorT?: number;
  /** seconds until the next offering to the dragon */
  riteT?: number;
  /** seconds until the next trap is dug */
  trapT?: number;
  /** fresh blood on the dragon altar (fades) */
  altarBlood?: number;
  /** clan know-how (clanTech.ts): progress toward the next invention, and how many they have */
  science?: number;
  tech?: number;
  /** how many bands have united into this one (each union speeds their progress up) */
  merges?: number;
}

export type ItemKind = "meat" | "fish" | "fruit" | "berries" | "poop" | "fossil" | "stick" | "stone" | "bones" | "carcass";

/** What's left on a dead dinosaur (people harvest it; predators eat the meat). */
export interface Carcass {
  meat: number;
  hide: number;
  bone: number;
  tooth: number;
  /** starting amounts (for the "how harvested is it" stage) */
  max: { meat: number; hide: number; bone: number; tooth: number };
  /** body length (px) it was in life */
  size: number;
  dir: 1 | -1;
  /** died in fire / lava: charred, only bones worth taking */
  burnt: boolean;
  /** 0..1 decay */
  rot: number;
  /** lying in the town: it never rots there (it's gathered, or a dragon roasts it) */
  town?: boolean;
  /** roasted by dragon fire: portions of cooked meat waiting to go to the feast table */
  roast?: number;
  /** a dragon roasted it (drawn browned + steaming) */
  cooked?: boolean;
}

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
  /** cave person dragging this carcass home */
  draggedBy?: number;
  /** fossil species */
  species?: SpeciesId;
  /** a dead dinosaur's body */
  carcass?: Carcass;
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
  genes?: Genes;
  gen?: number;
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

export type PropKind = "boulder" | "spire" | "fossilDig" | "painting" | "goldEgg" | "nest" | "chamber" | "megalith";

export interface Prop {
  id: number;
  kind: PropKind;
  x: number;
  y: number;
  size: number;
  variant: number;
  found?: boolean;
}

export type ShelterPlan = "tent" | "hut";

export interface Shelter {
  id: number;
  /** being carried by a crew: where it's drawn meanwhile (see moving.ts) */
  lift?: { x: number; y: number; z: number };
  x: number;
  y: number;
  /** construction stage (see stagesOf); == stages.length when finished */
  stage: number;
  /** resources delivered toward the current stage */
  have: number;
  /** what the blueprint builds: a quick tent or a full hut */
  plan: ShelterPlan;
  /** housing tier once finished: 0 tent … 4 stone house */
  tier: number;
  /** 0..1 condition (fire, falling rocks) */
  hp: number;
  /** upgrade to the next tier in progress */
  up: boolean;
  /** materials delivered toward the upgrade */
  upHave: Partial<Record<Resource, number>>;
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

export type WeatherKind = "clear" | "cloudy" | "rain" | "heavyRain" | "storm" | "fog" | "windy" | "hot" | "snow" | "blizzard";

export type TechId =
  | "tools"
  | "fire"
  | "spear"
  | "fishing"
  | "axe"
  | "basket"
  | "shelter"
  | "farming"
  | "palisade"
  | "bow"
  | "crossbow"
  | "stonewall"
  | "tower"
  | "medicine"
  | "taming"
  | "smelting"
  | "scorpion"
  | "firefighting"
  /** ultrasonic fire emitters + the sonic fire station (see sonic.ts) */
  | "sonicFire"
  /** dragon slayers, egg runners + dragon raids (see dragonRaid.ts) */
  | "dragonHunting";

export type WallKind = "palisade" | "stone" | "polygon";
/** wall pieces: plain wall, a gate, or stairs up to the walkway */
export type WallPart = "wall" | "gate" | "stairs";

/** One wall tile. `built` < 1 means it's still a blueprint. */
export interface Wall {
  id: number;
  tx: number;
  ty: number;
  kind: WallKind;
  part: WallPart;
  /** gates: open lets anything through; closed only lets people use the side door */
  open: boolean;
  /** gates: the tribe opens/closes it by itself */
  auto: boolean;
  hp: number;
  built: number;
  /** blueprint waiting to replace this piece with a stronger kind */
  upgrade?: boolean;
  /** what the upgrade turns it into (default stone) */
  upTo?: WallKind;
  /** resources delivered so far */
  have: number;
  /** gates: the grand bone entrance (crossed tusks, rib-cage arch, bone doors) */
  bone?: boolean;
  /** a finished piece waiting to be rebuilt as a bone gate (works as before until then) */
  boneUp?: boolean;
}

export interface Farm {
  id: number;
  x: number;
  y: number;
  /** 0 = bare, 0..1 growing, 1 = ripe */
  growth: number;
  planted: boolean;
  crop?: "flower" | "wheat" | "barley";
}

export interface Tower {
  id: number;
  x: number;
  y: number;
  /** footprint: the 2x2 tiles with (tx, ty) top-left */
  tx: number;
  ty: number;
  /** 0..3 build stages, 3 = done */
  stage: number;
  have: number;
  hp: number;
  /** built (or being built) in stone: much tougher */
  stone?: boolean;
  /** a finished wooden tower waiting to be rebuilt in stone */
  up?: boolean;
}

export type BuildingKind = "storage" | "workshop" | "blacksmith" | "foodStore" | "waterStore" | "well" | "healer" | "pen" | "post" | "trap" | "bridge" | "path" | "boneTorch" | "tannery" | "spikes" | "barricade" | "totem" | "mill" | "bakery"
  // shade + seating (see shade.ts)
  | "canopy" | "seatRing" | "pavilion"
  // animal keeping (see riders.ts)
  | "stable" | "perch" | "tack"
  // dragon keeping (see dragonKeep.ts)
  | "roost" | "hatchery" | "dragonYard" | "feedPit"
  // sonic firefighting (see sonic.ts)
  | "fireStation"
  // the dragons' home + show arena (see shows.ts)
  | "dragonPit"
  /** a dead dragon's bones laid out on a plinth: a monument (dragonBones.ts) */
  | "dragonBones"
  | "warChariot"
  | "riderHall"
  // the Old Ways' last-resort project
  | "shelterDeep"
  | "refinery"
  // resonance (fantasy) architecture
  | "resTable"
  | "chamber"
  | "shapingYard"
  | "energyTower"
  | "condenser"
  | "obelisk"
  | "stoneCircle"
  | "levPad"
  | "beamTower"
  | "pylon"
  | "pyramid"
  | "resShield";

export interface Building {
  id: number;
  kind: BuildingKind;
  /** being carried by a crew: where it's drawn meanwhile (see moving.ts) */
  lift?: { x: number; y: number; z: number };
  /** footprint top-left tile */
  tx: number;
  ty: number;
  /** base centre (world px) */
  x: number;
  y: number;
  /** 0..1 construction (1 = finished) */
  built: number;
  /** materials delivered */
  have: Partial<Record<Resource, number>>;
  hp: number;
  /** multi-stage projects (the pyramid): which stage is being built */
  stage?: number;
  /** beam towers: seconds until they can fire again */
  cd?: number;
  /** the dragon pit: how far it's been dug out (1 = as first built; it grows with the dragons, shows.ts) */
  grow?: number;
  /** dragon pit: how many other pits have been joined into this one (each lets it grow bigger) */
  merged?: number;
  /** dragon bones monument: whose they were, its breed, how big it was, and whether it was one of ours */
  label?: string;
  breed?: string;
  size?: number;
  ours?: boolean;
}

/** A giant crossbow. Sits on a wall tile, a tower or the ground. */
export interface Scorpion {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** 1 basic, 2 reinforced, 3 heavy siege */
  tier: number;
  built: number;
  have: Partial<Record<Resource, number>>;
  /** upgrade in progress to tier + 1 */
  up: boolean;
  hp: number;
  /** aim angle (ground plane, radians) */
  aim: number;
  reload: number;
  /** cave person working it (0 = unmanned) */
  crew: number;
  mount: "wall" | "tower" | "ground";
  /** recoil animation */
  kick: number;
  /** powered by an energy tower: aims + fires on its own (not saved; set every frame) */
  drone?: boolean;
}

export type NodeKind = "stone" | "limestone" | "clay" | "iron" | "coal" | "silver" | "gold" | "obsidian" | "flint" | "salt" | "tar" | "artifact" | "fossil" | "copper" | "quartz" | "magnetite" | "crystal" | "diamond" | "meteorite";

/** A resource deposit. Rare ones stay hidden until someone walks by. */
export interface ResNode {
  id: number;
  kind: NodeKind;
  x: number;
  y: number;
  amount: number;
  max: number;
  found: boolean;
  variant: number;
}

export type DragonState = "arrive" | "circle" | "hunt" | "strafe" | "land" | "eat" | "flee" | "leave"
  // wild dragons that live here: at the nest, flying home, driving off intruders, chasing an egg thief,
  // fetching branches for the nest, swooping on a person, carrying them off
  | "perch" | "home" | "defend" | "chase" | "fetch" | "snatch" | "carry"
  // called down to a clan's altar to take an offering (clanRite.ts)
  | "offering"
  // a wild parent coming to take its stolen baby back
  | "reclaim"
  // a wild dragon that's been attacked, turning on whoever attacked it (dragonRage.ts)
  | "retaliate"
  // tamed dragons (see dragonKeep.ts)
  | "idle" | "sleep" | "play" | "walk" | "fly" | "hover";

/** A player order for a tamed dragon. */
export interface DragonCmd {
  kind: DragonCmdKind;
  x: number;
  y: number;
  /** creature to attack */
  target?: number;
  /** route waypoints */
  pts?: { x: number; y: number }[];
  /** current waypoint / step */
  i?: number;
  /** seconds since it was given */
  t: number;
  /** set by Auto mode (a player order replaces it) */
  auto?: boolean;
  /** a war dragon's full-time guard duty patrol (warGuard.ts): it doesn't end on its own */
  duty?: boolean;
}

/** A dragon nest high in the mountains or on a volcanic ridge. */
export interface DragonNest {
  id: number;
  x: number;
  y: number;
  breed: DragonBreed;
  /** "peak" | "cliff" | "volcanic" | "cave" | "plateau" (just flavour + art) */
  site: string;
  found: boolean;
  /** the wild dragon that lives here (0 = none right now) */
  parent: number;
  /** treasure lying in the nest */
  loot: Partial<Record<Resource, number>>;
  /** seconds until the parent lays again */
  layT: number;
  /** seconds until a new parent moves in (after one is driven off) */
  emptyT: number;
  /** bowls in the nest: 1, or 2 once it holds more than 3 eggs (a second nest joined on) */
  size?: number;
  /** the parent is expecting: seconds until it lays */
  gravid?: number;
  /** how many eggs are coming */
  clutch?: number;
  /** 0..1 how far the nest is built (it builds while expecting) */
  grow?: number;
  /** wood stocked in the nest for the brooding fire (dragonBrood.ts) */
  wood?: number;
  /** 0..1 how hot the nest is (the parent breathes fire into the wood; it cools off) */
  warmth?: number;
  /** seconds left of the parent breathing fire into it */
  fireT?: number;
}

/** A dragon egg: in a nest, carried, on the ground, or incubating at camp. */
export interface DragonEgg {
  id: number;
  breed: DragonBreed;
  x: number;
  y: number;
  at: "nest" | "carried" | "ground" | "camp";
  nest: number;
  /** human carrying it */
  carrier: number;
  /** 0..1 how warm it is */
  heat: number;
  /** 0..1 incubation */
  progress: number;
  /** 0..1 (0 = the egg is lost) */
  health: number;
  /** a rare golden-flecked egg: the hatchling learns faster */
  rare: boolean;
  /** >0 while hatching (the crack animation), seconds */
  hatchT: number;
  /** the person keeping it (warming, turning, then raising what hatches) */
  keeper?: number;
}

export interface Dragon {
  id: number;
  kind: "dragon";
  name: string;
  x: number;
  y: number;
  /** altitude */
  z: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  state: DragonState;
  t: number;
  /** prey dino id (hunting) */
  target: number;
  tx: number;
  ty: number;
  /** 0..1 fire breath */
  breath: number;
  anim: number;
  /** colour scheme 0..2 */
  hue: number;
  /** strafing runs over the settlement so far */
  passes: number;
  /** hit flash timer */
  hit: number;
  breed?: DragonBreed;
  /** a wild dragon that lives at this nest: it goes home instead of leaving */
  nest?: number;
  /** one of ours (tamed dragons live in Dragons.owned, never in the wild list) */
  owner?: boolean;
  /** seconds since hatching */
  age?: number;
  /** 0..1 grown (wild ones are 1) */
  growth?: number;
  skills?: Partial<Record<DragonSkill, number>>;
  /** the lesson its trainer is teaching */
  lesson?: DragonSkill | null;
  trainer?: number;
  /** bonded Dragon Rider (human id) */
  partner?: number;
  /** whoever is on its back right now */
  rider?: number;
  /** 0..1: drains flying + breathing fire, comes back resting */
  stamina?: number;
  /** 0..1 rest (sleep restores it) */
  energy?: number;
  /** 0..1 */
  hunger?: number;
  /** seconds before it can breathe fire again */
  fireCd?: number;
  /** seconds of fire left in the current burst */
  burst?: number;
  aimX?: number;
  aimY?: number;
  cmd?: DragonCmd | null;
  /** Auto mode: rest, patrol, defend on its own when there are no orders */
  auto?: boolean;
  /** the roost building it calls home */
  roost?: number;
  /** cargo on its back */
  carrying?: { r: Resource; n: number } | null;
  /** banking into turns (radians, for the art) */
  bank?: number;
  /** a human it is after (nest intruder / egg thief) */
  foe?: number;
  /** golden-flecked (from a rare egg) */
  rare?: boolean;
  /** seconds until Auto sends it out on patrol again */
  restT?: number;
  /** seconds of play / a short hop (the art bounces it) */
  hop?: number;
  /** its keeper: raised it from the egg, plays with it, puts it in shows (see keepers.ts) */
  keeper?: number;
  /** a tamed dragon hatched from an egg stolen from this nest */
  fromNest?: number;
  /** wild parent: expecting eggs (it fetches branches for the nest) */
  gravid?: boolean;
  /** strafing this Neanderthal clan's town instead of ours */
  atClan?: number;
  /** answering a clan's offering at its altar (clan id) */
  riteClan?: number;
  /** a wild youngster raised at its parents' nest (it grows up there, and fights beside them) */
  young?: boolean;
  /** a war dragon on guard duty: the person it's watching over out in the wild (warGuard.ts) */
  ward?: number;
  /** its own look (set when it hatches, so no two are alike): a colour shift (degrees), markings, eye colour */
  tint?: number;
  marks?: 0 | 1 | 2 | 3;
  eye?: string;
  /** who was there when it hatched (the hatching scene) */
  hatchedBy?: number;
  /** seconds until a parent tries to win its stolen baby back */
  reclaimT?: number;
  /** its standing job: a patrol / route the player gave it. It breaks off to rest, eat or heal, then goes back to it, until it's told otherwise */
  post?: DragonCmd;
  /** a wild parent flying back with wood for its nest */
  wood?: boolean;
  /** 0..3 rage: its young were killed. Each level: harder to hurt, fiercer fire, bigger, slower to give up (dragonRage.ts) */
  rage?: number;
  /** what it's turned on (retaliate): a person, a chariot or one of our dragons */
  foeKind?: "human" | "chariot" | "dragon";
  /** where a gentle (cooking / brooding) flame is aimed: drawn from the mouth to here */
  fireAt?: { x: number; y: number };
  /** the dead dino (item id) it's off to roast for the feast table, and how long it's been breathing on it */
  cook?: number;
  cookT?: number;
  /** 0..1 battle-hardened: every fight won makes a war dragon bigger + stronger */
  vet?: number;
  /** seconds since it was last hurt (wild dragons heal once they're left alone) */
  calmT?: number;
  /** seconds until it next weighs up whether it can win this fight */
  oddsT?: number;
  /** 0..1 wings flung wide (the rite's roar) */
  spread?: number;
  /** breathing its fire straight up into the sky */
  skyFire?: boolean;
  /** its prey is a Neanderthal (not one of ours) */
  preyBrute?: boolean;
  /** wild parent whose stolen egg hatched: bigger, 50x tougher, fire that melts stone */
  fury?: boolean;
  /** seconds until its next raging attack on the town */
  furyT?: number;
  /** raging attacks made so far (it calms after three) */
  waves?: number;
  /** on a raging attack right now */
  waveOn?: boolean;
  /** the person it has snatched (human id) */
  prey?: number;
}

export type ProjectileKind = "spear" | "arrow" | "bolt" | "scorpion" | "beam";

export interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  dur: number;
  kind: ProjectileKind;
  target: number;
  dmg: number;
  hit: boolean;
  /** damage multiplier against dragons */
  big?: number;
  /** a glowing energy bolt (from a powered Scorpion) */
  glow?: boolean;
}

export type Danger = "calm" | "normal" | "wild";

export type GameEvent =
  | { type: "sfx"; sound: string; x: number; y: number; vol?: number; pitch?: number }
  | { type: "toast"; icon: string; text: string; x?: number; y?: number; fact?: string }
  | { type: "discover"; id: string }
  | { type: "shake"; amount: number; time: number }
  | { type: "flash"; amount: number; color: string }
  | { type: "unlock"; species: SpeciesId }
  | { type: "removed"; id: number }
  /** a dragon egg just hatched: play its hatching scene */
  | { type: "hatched"; dragon: number };

export type Creature = Dino | Human;
