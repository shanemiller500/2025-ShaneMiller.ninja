import type { Mood, Pose } from "./CharlesDog";
import type { PropKind } from "./props";

/* ------------------------------------------------------------------ */
/*  Everything Charles says when he doesn't need the AI                */
/*  [BARK] marks an involuntary bark mid-sentence.                     */
/* ------------------------------------------------------------------ */

export interface Line {
  text: string;
  action?: Pose | "wag" | "spin" | "zoomies" | "none";
  mood?: Mood;
}

export const OFFLINE_REPLIES: Line[] = [
  { text: "I have big plans today. Nap. Stare at the fridge. [BARK] Sorry. Wind. Then another nap.", mood: "smug" },
  { text: "Children are basically snack dispensers with no security. Low grip strength. Zero [BARK] situational awareness.", mood: "smug", action: "headtilt" },
  { text: "Fetch? I don't chase things I already had. That's called a relationship problem.", mood: "offended", action: "sit" },
  { text: "Technically I'm not allowed on the couch. Technically.", mood: "sassy", action: "lie" },
  { text: "The mitochondria is the powerhouse of the [BARK] ...leaf. It was a leaf. Powerhouse of the cell.", mood: "smug" },
  { text: "I've been a very good boy today. Nobody can prove otherwise. The evidence was [BARK] eaten.", mood: "sassy", action: "wag" },
  { text: "My neck mane is chow heritage. It is not a sweater. Please stop asking if I'm cold.", mood: "offended", action: "headtilt" },
  { text: "The river is my favorite place. Cold water, good sticks, which I will [BARK] not be fetching.", mood: "happy", action: "wag" },
  { text: "My daily schedule: nap, stare at the fridge, supervise dinner from under the table, nap again. Busy season.", mood: "happy", action: "lie" },
  { text: "I bark at the wind because nobody else will. Someone has to hold it [BARK] accountable.", mood: "alert", action: "alert" },
  { text: "Pro tip: make eye contact with the smallest human, then look at the food, then back. Works every time.", mood: "hungry", action: "beg" },
  { text: "E equals m c squared. Energy, mass, and the constant speed at which toast leaves a toddler's [BARK] hand.", mood: "smug", action: "headtilt" },
];

export const FOODS: { kind: PropKind; name: string }[] = [
  { kind: "pizza", name: "pizza crust" },
  { kind: "chicken", name: "chicken leg" },
  { kind: "hotdog", name: "hot dog" },
  { kind: "sandwich", name: "sandwich" },
  { kind: "cheese", name: "cheese stick" },
  { kind: "cookie", name: "cookie" },
  { kind: "bacon", name: "bacon" },
  { kind: "burger", name: "cheeseburger" },
];

export const STEAL_LINES = [
  "Low grip strength. Poor situational awareness. Textbook.",
  "They hold it at exactly nose height. It's practically an invitation.",
  "I didn't take it. It fell into my mouth from a great height. Physics.",
  "Crying is how they say thank you.",
  "Tell no one. Especially the tall ones.",
  "The trick is to look disappointed in them afterward.",
];

export const FETCH_LINES = [
  "You threw it. You go get it.",
  "I don't chase things I already had.",
  "Bold of you to assume I work for free.",
  "I'll watch it from here. Supervisory role.",
];

export const BAD_DOG_LINES = [
  "I regret nothing.",
  "That one was for the mailman.",
  "Consider it performance art.",
  "You're welcome, lawn.",
  "Smells like victory. Also regret. Mostly victory.",
  "The couch knows what it did.",
];

export const POOP_LINES = [
  "In my defense, it was the good carpet.",
  "Don't look at me. I'm concentrating.",
  "I'd like to speak to the manager of this lawn.",
  "Signed my work.",
];

export const TREAT_LINES = [
  "Acceptable. Continue.",
  "Oh. Oh, that's the good stuff.",
  "I'll allow it.",
  "Payment received. Services still not guaranteed.",
];

export const PET_LINES = [
  "Yes. There. Keep going. Do not stop.",
  "You may continue petting the legend.",
  "This is fine. This is actually very fine.",
];

export const WAKE_LINES = [
  "I wasn't asleep. I was monitoring the couch.",
  "I was meditating. On bacon.",
  "Deep dream. I was the mailman. It was terrifying.",
];

export const CLEAN_LINES = [
  "Thank you for your service.",
  "Missed a spot. Just kidding. Or am I.",
  "Tidy. Now I have room to work.",
];

/** Seeds for when you poke him. The AI riffs on these. */
export const POKE_TOPICS = [
  "Someone just booped you. Say something random and funny.",
  "Tell a dry joke about hanging around the kids' feet at dinner.",
  "Explain, with confidence, how easy it is to take food out of a child's hand.",
  "Share a very confident but completely dog-brained opinion about humans.",
  "Complain about the wind like it's a coworker.",
  "Explain why you refuse to play fetch.",
  "Describe your ideal day in the Colorado mountains.",
  "Brag about your chow mane.",
  "Give a very serious report on a threat you barked at today.",
  "Reveal something about the couch you're definitely not allowed on.",
];


export function pickOne<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export const SIT_LINES = [
  "Sitting. Not because you asked. I was going to anyway.",
  "There. I sat. Where's the paperwork. And by paperwork I mean cheese.",
  "This is a sit of my own free will.",
];

export const JUMP_LINES = [
  "Hup. Cardio. Done for the year.",
  "I can also fly. I just don't want to show off.",
  "That was a jump. The judges have awarded me one snack.",
];

export const ROLL_REFUSE_LINES = [
  "I'll roll over when the stock market does.",
  "Roll over? On this floor? In this economy?",
];

export const ROLL_LINES = ["Tada. Invoice to follow.", "Barrel roll. Nailed it. Unimpressed faces noted."];

export const LIE_LINES = ["Lying down. Emotionally and physically.", "Horizontal mode engaged. Do not disturb."];

export const SPIN_LINES = ["I have no idea why I did that.", "Chasing my tail. It's a cardio thing. Not a brain thing."];

export const WALK_LINES = {
  happy: ["On my way. Tail first.", "Ooh, over there? Sure!", "Adventure!"],
  snark: ["Fine. I'll walk. Slowly. On purpose.", "Oh, you want me over THERE. Sure. Why not.", "Moving. Under protest."],
};

export const WILDLIFE_LINES: Record<"deer" | "elk" | "moose" | "lion" | "bear", string[]> = {
  bear: [
    "A bear. A BEAR. [BARK] I'm going to be extremely brave from right here, mate.",
    "Big fluffy trash panda. Respect. From a distance. A long distance.",
    "That bear looked at me. I looked at the door. We understand each other.",
  ],
  deer: [
    "Deer. A whole committee of them. Nobody approved this meeting.",
    "Keep walking, Bambi. Keep walking.",
    "Five deer. Zero invitations. Classic.",
  ],
  elk: [
    "Elk. Deer with a helmet made of trees.",
    "That elk is the size of the truck. I barked anyway. Brave.",
    "Big antlers. Small manners.",
  ],
  moose: [
    "That is not a horse. That is a moose. I've made a terrible mistake.",
    "Moose. Legs for days. Face only a mother could love.",
    "I'll bark from up here. Moose rules.",
  ],
  lion: [
    "Mountain lion. I'm going to bark once and then think about my choices.",
    "Big cat. Not scared. Just standing closer to the door. For reasons.",
    "That's a cat the size of a couch. [BARK] Nope. Nope nope nope.",
  ],
};

export const CAR_LINES = [
  "A car. Near MY house. Unacceptable.",
  "Every car is the mailman until proven otherwise.",
  "Drove right past. Didn't even wave. Rude.",
  "Vroom yourself.",
];

export const DOORBELL_LINES = [
  "WHO IS IT. [BARK] Nobody move. I've got this.",
  "The doorbell! [BARK] It could be pizza. It could be doom. Same energy.",
  "Intruder! [BARK] Or grandma. Honestly both need barking at.",
];

export const HUMP_LINES = [
  "That was a handshake. A very enthusiastic handshake.",
  "We don't talk about that. Ever.",
  "Dominance established. Also, I panicked.",
  "He started it. He did not start it.",
  "Nothing happened. Look at the mountains. Lovely mountains.",
];
