/* ------------------------------------------------------------------ */
/*  The cave-people guides: little tips that pop up now and then       */
/*  (some match what's happening in your world), the How-to-play       */
/*  guide, and the "?" bubbles that appear over things in the world.  */
/* ------------------------------------------------------------------ */
import type { Snapshot } from "../game/engine";

/** Art in /public/images/cavemen/web (cut-outs + scenes). */
export const GUIDE_IMG = (name: string) => `/images/cavemen/web/${name}.webp`;

export type GuideArt =
  | "ugg-face"
  | "oona-face"
  | "berries"
  | "water"
  | "spearmaker"
  | "weaver"
  | "hatchling"
  | "builder"
  | "logs"
  | "stonecutter"
  | "hunter"
  | "crystal-miner"
  | "dino-friend"
  | "forager"
  | "water-carrier"
  | "knapper"
  | "basket";

export interface Tip {
  id: string;
  art: GuideArt;
  /** who's talking */
  who: "Ugg" | "Oona";
  text: string;
  /** shows up when this is true (otherwise it's a general tip) */
  when?: (s: Snapshot) => boolean;
  /** contextual tips that matter right now jump the queue */
  urgent?: boolean;
  /** the Help section to open from the tip */
  help?: string;
}

const food = (s: Snapshot) => ["cooked", "meat", "fish", "berries", "crop"].reduce((a, r) => a + (s.camp.stock[r] ?? 0), 0);
const has = (s: Snapshot, t: string) => s.camp.learned.includes(t as never);

export const TIPS: Tip[] = [
  // ---- things happening right now ----
  { id: "raid", art: "hunter", who: "Ugg", text: "RAID! Close the gates and let your guards fight. Walls, towers + Scorpions make raids much easier.", when: (s) => !!s.tribe.raid, urgent: true, help: "defend" },
  { id: "chamber", art: "crystal-miner", who: "Oona", text: "The humming chamber! Open 🏛️ Civilization and choose how your tribe grows — the Old Ways or the Resonance.", when: (s) => s.civ.pending, urgent: true, help: "civ" },
  { id: "hungry", art: "berries", who: "Oona", text: "Food is running low! Send gatherers for berries, build a farm 🌾, go fishing or hunt.", when: (s) => s.humans > 2 && food(s) < s.humans * 0.6, urgent: true, help: "tribe" },
  { id: "hurt", art: "water-carrier", who: "Oona", text: "Someone's hurt. A 🌿 Healing hut gets people back on their feet twice as fast.", when: (s) => s.tribe.people.some((p) => p.condition === "down" || p.condition === "badly"), urgent: true, help: "tribe" },
  { id: "noTools", art: "knapper", who: "Ugg", text: "First things first: stones! Your tribe invents 🪨 Stone tools once there are enough on the pile. Watch the 💡 Invent tab in Your tribe.", when: (s) => !has(s, "tools"), help: "start" },
  { id: "noFire", art: "basket", who: "Oona", text: "Next, fire! Sticks + grass + stone. A campfire keeps small dinos away and cooks your food.", when: (s) => has(s, "tools") && !has(s, "fire"), help: "start" },
  { id: "noHome", art: "builder", who: "Ugg", text: "Time for homes! 🛠️ Build → Homes → Tent or Hut. More homes = room for more people.", when: (s) => has(s, "axe") && s.colony.homes === 0, help: "build" },
  { id: "full", art: "logs", who: "Ugg", text: "The camp is full. Build more homes (or upgrade them) so newcomers can join and babies can be born.", when: (s) => s.humans >= s.tribe.capacity && s.humans > 4, help: "build" },
  { id: "deep", art: "crystal-miner", who: "Oona", text: "Under the cave is the Deep: a whole mine! Tap ⛏️ at the top, send miners down and mark rock to dig.", when: (s) => has(s, "tools") && s.day >= 2 && s.crew === 0 && s.view === "surface", help: "deep" },
  { id: "night", art: "ugg-face", who: "Ugg", text: "It's getting dark. People head home to sleep — keep a campfire lit so the camp stays warm and bright.", when: (s) => s.daylight < 0.25 && s.view === "surface" },
  // ---- down in the Deep ----
  { id: "deepDig", art: "crystal-miner", who: "Oona", text: "Pick ⛏️ Dig and drag across rock to mark a tunnel. Miners dig it, bag the ore and send it up the lift.", when: (s) => s.view === "deep", help: "deep" },
  { id: "deepScan", art: "stonecutter", who: "Ugg", text: "Ping the 📡 scanner to map the rock around you. Lamps spot ore in the walls — miners follow the veins!", when: (s) => s.view === "deep", help: "deep" },
  { id: "deepBedrock", art: "builder", who: "Ugg", text: "Dark bedrock blocks the way? Picks bounce off — mark it with 🧨 Blast (tar + a stick).", when: (s) => s.view === "deep" && (s.deep?.deepestFt ?? 0) > 120, help: "deep" },
  { id: "deepBuild", art: "logs", who: "Oona", text: "Dug out a big room? 🏗️ Build homes, a vault, a pump station or a glowshroom farm down there.", when: (s) => s.view === "deep" && (s.deep?.dug ?? 0) > 20, help: "deep" },
  { id: "deepFlood", art: "water", who: "Oona", text: "Flooding! Miners bail it out, and a 🚰 Pump station drains it for good (the water goes to camp).", when: (s) => s.view === "deep" && (s.deep?.hazards.flooded ?? 0) > 3, urgent: true, help: "deep" },
  // ---- general tips (any time) ----
  { id: "select", art: "ugg-face", who: "Ugg", text: "Tap a person, then tap a tree, rock or dino — they'll go and work on it. Shift-drag to pick a whole group!", help: "tribe" },
  { id: "jobs", art: "oona-face", who: "Oona", text: "Open Your tribe → 👥 Jobs to give people jobs. Leave them on ✨ Auto and they'll do what the tribe needs.", help: "tribe" },
  { id: "pickup", art: "dino-friend", who: "Ugg", text: "Hold your finger on a small dino to pick it up and carry it somewhere else!", help: "dinos" },
  { id: "eggs", art: "hatchling", who: "Oona", text: "🥚 Eggs hatch into babies. Babies grow up, have their own eggs… and slowly evolve!", help: "dinos" },
  { id: "tame", art: "dino-friend", who: "Oona", text: "Learn Taming and your people can befriend gentle dinos — then ride the big ones!", help: "dinos" },
  { id: "captive", art: "hunter", who: "Ugg", text: "The Neanderthals are holding one of us at their camp! Pick some armed people and send them there. Once the guards are gone, walk right up and bring her home.", when: (s) => s.rivals.clans.some((c) => c.captives.length > 0), urgent: true, help: "defend" },
  { id: "brutes", art: "hunter", who: "Ugg", text: "Neanderthal clans live out in the wild: big, strong, not clever. Keep walls up and guards armed. They only have clubs and rocks; our bows and Scorpions beat them.", when: (s) => s.rivals.clans.length > 0, help: "defend" },
  { id: "walls", art: "stonecutter", who: "Ugg", text: "Drag to draw walls. Add a 🚪 gate and 🪜 stairs so guards can shoot from the top.", help: "defend" },
  { id: "forge", art: "spearmaker", who: "Ugg", text: "The ⚒️ Forge makes spears, bows, shields, hide cloaks and metal helmets. Check Your tribe → Forge.", help: "build" },
  { id: "carcass", art: "hunter", who: "Ugg", text: "A dino body is a treasure: meat, hide and bones. Tap it and harvest before it spoils!", help: "tribe" },
  { id: "saves", art: "oona-face", who: "Oona", text: "Your world saves by itself. ☰ Menu → 📂 Saved games lets you jump back to any point.", help: "start" },
  { id: "stickers", art: "berries", who: "Oona", text: "🏆 Stickers are secret discoveries. Poke dinos, explore and try things to find them all!", help: "start" },
  { id: "boom", art: "ugg-face", who: "Ugg", text: "💥 Boom lets you call lightning, meteors and eruptions… careful, the supervolcano ends everything!", help: "disasters" },
  { id: "weather", art: "water-carrier", who: "Oona", text: "Rain makes plants grow, storms knock things about and snow makes people cold. Hide cloaks help!", help: "tribe" },
];

/* ------------------------------ How to play ------------------------------ */

export interface HelpSection {
  id: string;
  icon: string;
  title: string;
  /** a scene from /images/cavemen/web */
  scene: string;
  intro: string;
  steps: string[];
}

export const HELP: HelpSection[] = [
  {
    id: "start",
    icon: "🏕️",
    title: "Getting started",
    scene: "scene-firemaking",
    intro: "You look after a little tribe of cave people living alongside the dinosaurs.",
    steps: [
      "Drag to look around, pinch or scroll to zoom. Tap anything to learn about it.",
      "Your people gather sticks, stones, grass and food by themselves.",
      "Open 🏕️ Your tribe to see what they need and what they're inventing (💡 Invent).",
      "Inventions unlock everything: tools → fire → axes → spears → homes and more.",
      "The world saves itself. ☰ Menu → 📂 Saved games lets you go back in time.",
    ],
  },
  {
    id: "tribe",
    icon: "👥",
    title: "Your people",
    scene: "scene-roast",
    intro: "Keep them fed, warm and safe and the tribe grows — up to 100 people.",
    steps: [
      "Tap a person to see how they're doing. Tap them, then tap something to give an order.",
      "Shift-drag (or + idle people) to pick a group and send them together.",
      "Jobs: gatherer, builder, hunter, guard, cook, farmer, smith, miner… or ✨ Auto.",
      "Food: berries, fish, crops and cooked meat. Hungry people work slowly and get sick.",
      "Hurt people heal at home or in a 🌿 Healing hut. Hide cloaks keep them dry and warm.",
    ],
  },
  {
    id: "build",
    icon: "🛠️",
    title: "Building",
    scene: "scene-hut",
    intro: "Pick 🛠️ Build, choose something, and tap (or drag) where it goes.",
    steps: [
      "Builders fetch the materials and put it up. Missing something? Gatherers go and get it.",
      "Homes upgrade: tent → hut → house → stone house → polygon house. Tap a home to upgrade it.",
      "Work buildings: storage, a forge (workshop + blacksmith), a refinery for gold + silver bars…",
      "Upgrading walls or homes gives some old materials back.",
      "In the polygon age, fire can't hurt your buildings any more.",
    ],
  },
  {
    id: "defend",
    icon: "🛡️",
    title: "Defending",
    scene: "scene-tracks",
    intro: "Raiders, Neanderthals and dragons will come. Be ready!",
    steps: [
      "Draw walls by dragging. Add gates (they shut themselves when danger comes) and stairs.",
      "Guards defend; towers let them see and shoot further.",
      "🎯 Scorpions are giant crossbows. With an energy tower they aim and fire by themselves.",
      "Inside the walls with auto-defences up, people keep working through a raid.",
      "Bone spikes, traps and totems help too.",
      "🪓 Neanderthal clans raid too. They club the men and carry the women off to their camp: kill the carrier, or reach their camp while it's unguarded, to bring her home.",
    ],
  },
  {
    id: "dinos",
    icon: "🦖",
    title: "Dinosaurs",
    scene: "scene-fishing",
    intro: "Every dino eats, drinks, sleeps, lays eggs and gets on with its life.",
    steps: [
      "🦖 Dinos tool: add new dinosaurs. 🥚 Eggs: place eggs and watch them hatch.",
      "Hold a small dino to pick it up. Tap one to see its mood and needs.",
      "Meat-eaters hunt — sometimes your people! Big ones are much harder to stop.",
      "🧬 Evolution: species change over time to fit the world.",
      "With Taming, gentle dinos become friends you can ride.",
    ],
  },
  {
    id: "deep",
    icon: "⛏️",
    title: "The Deep (mining)",
    scene: "scene-mining",
    intro: "Under the cave is a mine full of ore, crystals, fossils… and danger.",
    steps: [
      "Tap ⛏️ at the top to go down. Send miners with +1 / +3 in the Crew panel.",
      "Pick ⛏️ Dig and drag across rock to mark tunnels. 📡 Ping maps the rock nearby.",
      "Ore runs in veins and seams — miners follow them and send it up the lift.",
      "Hazards: floods (pump them), gas, cave-ins (prop the roof), heat, troglodons (lamps scare them).",
      "Bedrock needs 🧨 Blast. Build homes, vaults, pumps and farms in dug-out space.",
    ],
  },
  {
    id: "civ",
    icon: "🏛️",
    title: "Civilization",
    scene: "scene-painting",
    intro: "Once your tribe is settled, a humming chamber appears in the rocks.",
    steps: [
      "Walk someone over to it, then choose: 🔥 the Old Ways or 💠 the Resonance.",
      "Researchers study new ideas in 🏛️ Civilization → Research.",
      "Old Ways: iron, farms, siege, cavalry, great halls. Resonance: energy, polygon stone, floating blocks.",
      "Both reach the polygon age: polygon walls + houses, fire-proof buildings, energy lances.",
      "Late on you can borrow a few ideas from the other path.",
    ],
  },
  {
    id: "disasters",
    icon: "💥",
    title: "Weather + disasters",
    scene: "scene-cave",
    intro: "The world can be wild — and you can make it wilder.",
    steps: [
      "🌦️ Weather: rain, storms, fog, heat, snow and blizzards.",
      "💥 Boom: lightning, meteors, eruptions, quakes, raids and dragons.",
      "Fire spreads through dry plants. Learn Firefighting so people put it out.",
      "☄️ End of an age: an asteroid most life won't survive. ☄️🌋 Supervolcano: nothing survives.",
      "Save first (📂 Saved games) if you want to come back!",
    ],
  },
];

/* ------------------------------ "?" bubbles on things ------------------------------ */

/** Short explanations for things in the world (shown when you tap a "?" bubble). */
export const BUBBLES: Record<string, { title: string; text: string; art: GuideArt }> = {
  campfire: { title: "Campfire", text: "Warmth, light and cooking. Small dinos keep away from it. It needs sticks to stay lit.", art: "basket" },
  cave: { title: "The cave", text: "Home before there are huts — and the way down to the Deep mine.", art: "ugg-face" },
  pile: { title: "Stockpile", text: "Everything your people gather ends up here. Tap Your tribe to see what's on it.", art: "logs" },
  site: { title: "Building site", text: "Builders bring the materials and put it up. Tap it to see what's still needed.", art: "builder" },
  node: { title: "Deposit", text: "Stone, clay, ore or gems. Gatherers and miners dig it out.", art: "stonecutter" },
  chamber: { title: "Humming chamber", text: "Something old and strange. Send someone to look — then choose your path.", art: "crystal-miner" },
  carcass: { title: "Dino body", text: "Meat, hide and bones. Harvest it before it spoils (or a predator eats it).", art: "hunter" },
  volcano: { title: "The volcano", text: "It rumbles now and then. Lava flows burn everything — and cool into new rock.", art: "ugg-face" },
  egg: { title: "Egg", text: "It'll hatch soon! Babies stay near their parents while they grow.", art: "hatchling" },
  dino: { title: "Dinosaur", text: "Tap it to see what it's feeling. Hold a small one to pick it up.", art: "dino-friend" },
  lift: { title: "The lift", text: "Carries miners down and ore up. Upgrade it to reach deeper.", art: "crystal-miner" },
  vein: { title: "Ore vein", text: "A seam of ore in the rock. Mark it to dig — miners follow it along.", art: "crystal-miner" },
  bedrock: { title: "Bedrock", text: "Too hard to dig. Mark it with 🧨 Blast to break through to the next section.", art: "builder" },
};
