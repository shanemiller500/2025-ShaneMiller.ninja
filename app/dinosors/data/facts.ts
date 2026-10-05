/* ------------------------------------------------------------------ */
/*  Bite-sized facts + names + the "sticker book" of secret            */
/*  discoveries. Short on purpose: this is a toy, not homework.        */
/* ------------------------------------------------------------------ */
import type { TechId } from "../sim/types";

export const DINO_NAMES = [
  "Chompy", "Pebbles", "Stompy", "Twinkle", "Rex", "Noodle", "Biscuit", "Tank", "Sprout", "Mango",
  "Boulder", "Ziggy", "Pickle", "Waffles", "Captain", "Nugget", "Bubbles", "Sunny", "Thunder", "Daisy",
  "Gizmo", "Pudding", "Rocket", "Fern", "Muddy", "Spike", "Clover", "Peanut", "Tiny", "Gus",
  "Marshmallow", "Banjo", "Comet", "Hazel", "Dusty", "Pip", "Olive", "Turbo", "Coco", "Echo",
];

export const CAVE_NAMES = ["Ugg", "Oona", "Bok", "Mira", "Grug", "Tikki", "Zog", "Lulu", "Kip", "Nana", "Ruk", "Pim"];

export const TECH: Record<
  TechId,
  { icon: string; name: string; needs: Partial<Record<"stick" | "stone" | "grass" | "leaves" | "wood", number>>; after?: TechId[]; fact: string }
> = {
  tools: {
    icon: "🪨",
    name: "Stone tools",
    needs: { stone: 4 },
    fact: "The oldest known stone tools are about 3.3 million years old!",
  },
  fire: {
    icon: "🔥",
    name: "Fire",
    needs: { stick: 6, grass: 4, stone: 2 },
    after: ["tools"],
    fact: "Early humans learned to control fire hundreds of thousands of years ago.",
  },
  spear: {
    icon: "🗡️",
    name: "Spear",
    needs: { stick: 3, stone: 2 },
    after: ["tools"],
    fact: "Wooden spears found in Germany are about 300,000 years old.",
  },
  fishing: {
    icon: "🎣",
    name: "Fishing",
    needs: { stick: 4, grass: 3 },
    after: ["spear"],
    fact: "People have been catching fish for at least 40,000 years.",
  },
  axe: {
    icon: "🪓",
    name: "Hand axe",
    needs: { stick: 2, stone: 3 },
    after: ["tools"],
    fact: "Teardrop-shaped hand axes were used for over a million years!",
  },
  basket: {
    icon: "🧺",
    name: "Baskets",
    needs: { grass: 6, leaves: 4 },
    after: ["tools"],
    fact: "Woven containers let people carry more food home at once.",
  },
  shelter: {
    icon: "🛖",
    name: "Shelter",
    needs: {},
    after: ["axe"],
    fact: "People built huts from branches, leaves, hides and even mammoth bones!",
  },
};

export const TECH_ORDER: TechId[] = ["tools", "fire", "axe", "spear", "basket", "fishing", "shelter"];

/** Each shelter stage: what has to be carried in, and what it looks like. */
export const SHELTER_STAGES: { label: string; need: "wood" | "stick" | "leaves" | "stone"; n: number }[] = [
  { label: "Frame", need: "wood", n: 4 },
  { label: "Walls", need: "stick", n: 6 },
  { label: "Roof", need: "leaves", n: 6 },
  { label: "Stones", need: "stone", n: 4 },
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
];

export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map((d) => [d.id, d]));
