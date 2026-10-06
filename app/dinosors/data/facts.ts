/* ------------------------------------------------------------------ */
/*  Bite-sized facts + names + the "sticker book" of secret            */
/*  discoveries. Short on purpose: this is a toy, not homework.        */
/* ------------------------------------------------------------------ */
import type { Resource, TechId } from "../sim/types";

export const DINO_NAMES = [
  "Chompy", "Pebbles", "Stompy", "Twinkle", "Rex", "Noodle", "Biscuit", "Tank", "Sprout", "Mango",
  "Boulder", "Ziggy", "Pickle", "Waffles", "Captain", "Nugget", "Bubbles", "Sunny", "Thunder", "Daisy",
  "Gizmo", "Pudding", "Rocket", "Fern", "Muddy", "Spike", "Clover", "Peanut", "Tiny", "Gus",
  "Marshmallow", "Banjo", "Comet", "Hazel", "Dusty", "Pip", "Olive", "Turbo", "Coco", "Echo",
];

export const CAVE_NAMES = ["Ugg", "Oona", "Bok", "Mira", "Grug", "Tikki", "Zog", "Lulu", "Kip", "Nana", "Ruk", "Pim"];

export const TECH: Record<
  TechId,
  { icon: string; name: string; needs: Partial<Record<Resource, number>>; after?: TechId[]; fact: string; what: string }
> = {
  tools: {
    icon: "🪨",
    name: "Stone tools",
    needs: { stone: 4 },
    what: "Unlocks every other invention.",
    fact: "The oldest known stone tools are about 3.3 million years old!",
  },
  fire: {
    icon: "🔥",
    name: "Fire",
    needs: { stick: 6, grass: 4, stone: 2 },
    after: ["tools"],
    what: "Campfires light the night, scare dinos and cook food.",
    fact: "Early humans learned to control fire hundreds of thousands of years ago.",
  },
  spear: {
    icon: "🗡️",
    name: "Spear",
    needs: { stick: 3, stone: 2 },
    after: ["tools"],
    what: "Hunters + guards can fight back.",
    fact: "Wooden spears found in Germany are about 300,000 years old.",
  },
  fishing: {
    icon: "🎣",
    name: "Fishing",
    needs: { stick: 4, grass: 3 },
    after: ["spear"],
    what: "Fishing is fast and never misses.",
    fact: "People have been catching fish for at least 40,000 years.",
  },
  axe: {
    icon: "🪓",
    name: "Hand axe",
    needs: { stick: 2, stone: 3 },
    after: ["tools"],
    what: "Chop trees for wood.",
    fact: "Teardrop-shaped hand axes were used for over a million years!",
  },
  basket: {
    icon: "🧺",
    name: "Baskets",
    needs: { grass: 6, leaves: 4 },
    after: ["tools"],
    what: "Carry twice as much.",
    fact: "Woven containers let people carry more food home at once.",
  },
  shelter: {
    icon: "🛖",
    name: "Shelter",
    needs: {},
    after: ["axe"],
    what: "Huts keep people dry and make room for babies.",
    fact: "People built huts from branches, leaves, hides and even mammoth bones!",
  },
  farming: {
    icon: "🌾",
    name: "Farming",
    needs: { grass: 4, berries: 3 },
    after: ["basket"],
    what: "Farmers grow crops in fields.",
    fact: "Farming started about 12,000 years ago — and changed everything!",
  },
  palisade: {
    icon: "🪵",
    name: "Palisade",
    needs: { wood: 4, stick: 4 },
    after: ["axe"],
    what: "Build wooden walls dinos can't walk through.",
    fact: "A palisade is a wall of sharpened logs standing side by side.",
  },
  bow: {
    icon: "🏹",
    name: "Bow & arrow",
    needs: { stick: 4, grass: 3, stone: 2 },
    after: ["spear"],
    what: "Hunters + guards shoot from far away — even flying reptiles.",
    fact: "Bows and arrows were invented over 60,000 years ago.",
  },
  tower: {
    icon: "🗼",
    name: "Watchtower",
    needs: { wood: 4, stone: 2 },
    after: ["palisade"],
    what: "Guards in towers see further and shoot better.",
    fact: "From up high you can spot danger long before it arrives.",
  },
  crossbow: {
    icon: "🎯",
    name: "Crossbow",
    needs: { wood: 3, stone: 3, stick: 3 },
    after: ["bow", "palisade"],
    what: "Powerful bolts that can stop even a T. rex. (Fantasy tech!)",
    fact: "Real crossbows came much later — about 2,500 years ago in China.",
  },
  stonewall: {
    icon: "🧱",
    name: "Stone walls",
    needs: { stone: 6 },
    after: ["palisade", "tower"],
    what: "Super-strong walls. Upgrade your palisades!",
    fact: "Some of the first stone walls were built around the town of Jericho.",
  },
  medicine: {
    icon: "🌿",
    name: "Medicine",
    needs: { leaves: 4, grass: 3, berries: 2 },
    after: ["fire"],
    what: "Healing huts, and hurt people heal faster.",
    fact: "Ancient people used plants like willow bark to ease pain.",
  },
  taming: {
    icon: "🐾",
    name: "Taming",
    needs: { berries: 4, grass: 4 },
    after: ["basket"],
    what: "Befriend gentle plant-eaters, build pens and ride them!",
    fact: "Dogs were the first animals people tamed, over 15,000 years ago. (Riding dinos is fantasy!)",
  },
  smelting: {
    icon: "🔥",
    name: "Smelting",
    needs: { clay: 3, stone: 4, wood: 3 },
    after: ["fire", "stonewall"],
    what: "Melt ore into metal: blacksmiths forge metal weapons and shields.",
    fact: "People first smelted copper about 7,000 years ago.",
  },
  firefighting: {
    icon: "🪣",
    name: "Fire fighting",
    needs: { grass: 4, stick: 3, leaves: 3 },
    after: ["fire"],
    what: "The tribe learns to beat out flames and pass water along a bucket line. Without it they can only run!",
    fact: "Firefighters still use fire breaks: clearing a strip of land so the fire has nothing to burn.",
  },
  scorpion: {
    icon: "🏹",
    name: "Scorpion",
    needs: { wood: 4, stick: 4, stone: 2 },
    after: ["crossbow", "tower"],
    what: "Giant bolt-throwers for walls and towers. Great against dragons!",
    fact: "Roman armies used a small catapult called a scorpio to shoot heavy bolts.",
  },
};

export const TECH_ORDER: TechId[] = ["tools", "fire", "axe", "spear", "basket", "firefighting", "fishing", "shelter", "farming", "medicine", "taming", "palisade", "bow", "tower", "crossbow", "stonewall", "scorpion", "smelting"];

/** Each shelter stage: what has to be carried in, and what it looks like. */
export const SHELTER_STAGES: { label: string; need: "wood" | "stick" | "leaves" | "stone"; n: number }[] = [
  { label: "Frame", need: "wood", n: 4 },
  { label: "Walls", need: "stick", n: 6 },
  { label: "Roof", need: "leaves", n: 6 },
  { label: "Stones", need: "stone", n: 4 },
];

/** The camp grows through these levels. */
export const CAMP_LEVELS: { name: string; icon: string; people: number; huts: number; need?: string; radius: number }[] = [
  { name: "Cave Camp", icon: "🏕️", people: 0, huts: 0, radius: 260 },
  { name: "Little Village", icon: "🛖", people: 9, huts: 2, radius: 340 },
  { name: "Wooden Fort", icon: "🪵", people: 12, huts: 3, need: "palisade", radius: 420 },
  { name: "Stone Town", icon: "🏰", people: 16, huts: 4, need: "stonewall", radius: 500 },
];

export const ROLES: { id: import("../sim/types").Role; icon: string; name: string; tip: string }[] = [
  { id: "auto", icon: "✨", name: "Auto", tip: "Does whatever the tribe needs most" },
  { id: "gatherer", icon: "🧺", name: "Gatherer", tip: "Collects sticks, stones, grass, fish" },
  { id: "builder", icon: "🔨", name: "Builder", tip: "Builds huts, walls + towers, fixes damage" },
  { id: "hunter", icon: "🏹", name: "Hunter", tip: "Hunts dinos + flyers and drags them home" },
  { id: "guard", icon: "🛡️", name: "Guard", tip: "Stands watch and fights off raiders" },
  { id: "cook", icon: "🍖", name: "Cook", tip: "Roasts meat + fish on the fire" },
  { id: "farmer", icon: "🌾", name: "Farmer", tip: "Plants and harvests crops" },
  { id: "smith", icon: "⚒️", name: "Smith", tip: "Crafts weapons, shields + Scorpion parts" },
  { id: "researcher", icon: "📜", name: "Researcher", tip: "Studies your civilization's next idea (fastest at a Resonance table)" },
  { id: "miner", icon: "⛏️", name: "Miner", tip: "Digs copper, quartz, magnetite, crystal + ore" },
  { id: "shaper", icon: "🔷", name: "Stone shaper", tip: "Cuts raw stone into polygon blocks at the Shaping yard" },
  { id: "technician", icon: "⚡", name: "Technician", tip: "Tends energy buildings: fixes overloads, keeps the hum clean" },
];

export const FACTS = {
  volcano: "Volcanoes release melted rock called magma. Once it flows out, it's called lava!",
  lavaCool: "When lava cools down it hardens into new rock, like basalt.",
  lightning: "Lightning is hotter than the surface of the Sun!",
  rain: "Rain helps plants grow — and plants feed the herbivores.",
  rainbow: "Rainbows happen when sunlight bends through raindrops.",
  meteor: "A huge asteroid hit Earth 66 million years ago and helped end the age of dinosaurs.",
  quake: "Earthquakes happen when giant slabs of Earth's crust slip past each other.",
  fossil: "Fossils form when bones get buried and slowly turn to stone over millions of years.",
  foodChain: "Plants → plant-eaters → meat-eaters. That's a food chain!",
  egg: "All dinosaurs hatched from eggs. Some nests had over 20 eggs!",
  poop: "Fossil dinosaur poop is called a coprolite. Scientists study it!",
  herd: "Many plant-eaters lived in herds — there's safety in numbers.",
  tar: "Animals got stuck in sticky tar pits — that's how we found lots of fossils.",
  painting: "Ancient cave paintings are up to 45,000 years old.",
  fire: "Fire kept people warm, cooked food and scared away animals.",
  cooked: "Cooking makes food softer and easier to digest.",
  extinction: "Most dinosaurs went extinct — but birds are living dinosaurs!",
  fog: "Fog is just a cloud sitting on the ground.",
  wind: "Wind is air moving from high pressure to low pressure.",
  night: "Some dinosaurs had big eyes and may have hunted at night.",
} as const;

export interface Discovery {
  id: string;
  icon: string;
  name: string;
  hint: string;
}

/** Secret interactions kids can collect. Hints stay vague on purpose. */
export const DISCOVERIES: Discovery[] = [
  { id: "annoyed", icon: "😤", name: "Grumpy Dino", hint: "Some dinos don't like being poked…" },
  { id: "snore", icon: "💤", name: "Snore Patrol", hint: "Listen closely at night." },
  { id: "poop", icon: "💩", name: "Number Two", hint: "Everybody does it." },
  { id: "scratch", icon: "🌲", name: "Itchy Back", hint: "Trees make great back-scratchers." },
  { id: "fruitShake", icon: "🍎", name: "Fruit Shaker", hint: "Big dinos + fruit trees." },
  { id: "thief", icon: "🦝", name: "Food Thief", hint: "Raptors are sneaky." },
  { id: "fishThief", icon: "🐟", name: "Fish Snatcher", hint: "Watch the fishers." },
  { id: "roar", icon: "📢", name: "Big Roar", hint: "The king makes everyone run." },
  { id: "splash", icon: "💦", name: "Splash Party", hint: "Water is fun." },
  { id: "hatch", icon: "🐣", name: "Hatchling", hint: "Eggs wobble before…" },
  { id: "play", icon: "🤸", name: "Playtime", hint: "Babies love friends." },
  { id: "fireMade", icon: "🔥", name: "Fire Makers", hint: "Help the cave people." },
  { id: "shelterDone", icon: "🛖", name: "Home Sweet Home", hint: "Build a whole hut." },
  { id: "eruption", icon: "🌋", name: "Kaboom!", hint: "The mountain is grumbling." },
  { id: "meteor", icon: "☄️", name: "Look Up!", hint: "Something from space." },
  { id: "rainbow", icon: "🌈", name: "Rainbow", hint: "After the rain…" },
  { id: "lightning", icon: "⚡", name: "Zap!", hint: "Storms are electric." },
  { id: "fossil", icon: "🦴", name: "Fossil Hunter", hint: "Dig where the bones are." },
  { id: "painting", icon: "🖐️", name: "Cave Art", hint: "A hidden cave behind the cliffs." },
  { id: "goldEgg", icon: "🥚", name: "Golden Egg", hint: "Deep in the dark forest." },
  { id: "tar", icon: "🛢️", name: "Sticky Feet", hint: "Something sticky in the swamp." },
  { id: "wallow", icon: "🐷", name: "Mud Bath", hint: "Some dinos love mud." },
  { id: "breach", icon: "🌊", name: "Sea Monster", hint: "Keep an eye on the ocean." },
  { id: "tossed", icon: "🤸‍♂️", name: "Yeet!", hint: "Cave people should keep their distance." },
  { id: "headbutt", icon: "⛑️", name: "Bonk!", hint: "Thick heads, big bonks." },
  { id: "allSpecies", icon: "🏆", name: "Dino Expert", hint: "Meet every species." },
  { id: "hunted", icon: "🏹", name: "Great Hunter", hint: "Send a hunter out." },
  { id: "feast", icon: "🍗", name: "Feast!", hint: "Cook something big." },
  { id: "defended", icon: "🛡️", name: "Defenders", hint: "Survive a raid." },
  { id: "alpha", icon: "👑", name: "Alpha Down", hint: "The strongest raiders wear crowns." },
  { id: "harvest", icon: "🌾", name: "Harvest Time", hint: "Grow something." },
  { id: "village", icon: "🏘️", name: "Growing Tribe", hint: "Help the camp grow." },
  { id: "baby", icon: "👶", name: "New Baby", hint: "A well-fed tribe grows." },
  { id: "mutant", icon: "🧬", name: "Mutant!", hint: "Watch the eggs hatch…" },
  { id: "evolved", icon: "⏩", name: "Deep Time", hint: "Skip ahead a million years." },
  { id: "gold", icon: "🪙", name: "Gold Rush", hint: "Something glitters near the mountains." },
  { id: "artifact", icon: "🏺", name: "Archaeologist", hint: "Strange mounds hide old treasures." },
  { id: "family", icon: "👨‍👩‍👧", name: "New Neighbours", hint: "Safe, well-fed camps attract wanderers." },
  { id: "rider", icon: "🏇", name: "Dino Rider", hint: "Make friends with a gentle giant." },
  { id: "scorpion", icon: "🎯", name: "Bullseye", hint: "A giant crossbow on the wall." },
  { id: "dragon", icon: "🐉", name: "Here Be Dragons", hint: "Something huge circles the sky." },
  { id: "dragonSlayer", icon: "🛡️", name: "Dragon Defenders", hint: "Drive a dragon away." },
  { id: "megaEruption", icon: "☄️", name: "MEGA ERUPTION", hint: "What if something from space hit the volcano?" },
  { id: "snow", icon: "❄️", name: "Snow Day", hint: "It gets cold up in the peaks." },
  { id: "healer", icon: "🩹", name: "Patched Up", hint: "Look after the hurt." },
  { id: "stoneHouse", icon: "🏡", name: "Stone Mason", hint: "Upgrade a home all the way." },
  { id: "tarTrap", icon: "🪤", name: "Stuck Fast", hint: "Tar pits catch the little ones." },
  { id: "butcher", icon: "🔪", name: "Nothing Wasted", hint: "A hunt gives more than meat." },
  { id: "rainproof", icon: "🌧️", name: "Rainproof", hint: "Tar + hide keep the rain out." },
  { id: "boneDefense", icon: "🦴", name: "Bone Fortress", hint: "Bones make walls scarier." },
  { id: "chamber", icon: "💠", name: "The Humming Chamber", hint: "Something hums in the rocks once the tribe is settled." },
  { id: "civTraditional", icon: "🔥", name: "The Old Ways", hint: "Learn an idea of the Old Ways." },
  { id: "civResonance", icon: "🔔", name: "The Resonance", hint: "Learn an idea of the Resonance." },
  { id: "tuned", icon: "🎶", name: "Perfect Pitch", hint: "Find a material's true note on the Resonance table." },
  { id: "condenser", icon: "💧", name: "Water From Air", hint: "Squeeze water out of the fog." },
  { id: "levitation", icon: "🪶", name: "Lighter Than Air", hint: "Make stone float." },
  { id: "beam", icon: "🔆", name: "Beam!", hint: "A tower that shoots light." },
  { id: "pyramid", icon: "🔺", name: "The Great Pyramid", hint: "Six stages, one capstone, a lot of energy." },
  { id: "omen", icon: "🌘", name: "The Last Sunset", hint: "Only you can call it down." },
];

export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map((d) => [d.id, d]));
