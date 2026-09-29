"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BikerShazz, { type ShazzPose } from "./BikerShazz";
import BigFinger from "./BigFinger";
import FamilyCar from "./FamilyCar";
import PoliceCar from "./PoliceCar";
import StopSign from "./StopSign";
import BbqScene from "./BbqScene";
import CopFigure from "./CopFigure";
import TattooScene, { type TattooStage } from "./TattooScene";
import MiniBiker from "./MiniBiker";
import Guillotine from "./Guillotine";
import Brawler from "./Brawler";
import RoadKill, { CRITTERS, type Critter } from "./RoadKill";
import BinChicken from "./BinChicken";
import WheelieBin from "./WheelieBin";
import Kangaroo from "./Kangaroo";
import GumTree from "./GumTree";
import DropBear from "./DropBear";
import SportBike from "./SportBike";
import HoopSnake from "./HoopSnake";
import Bludger from "./Bludger";
import styles from "../day-out.module.css";

const JOKES = [
  "Harley owners are a special breed of dropkick. Indian owners actually get where they're going, ya flog.",
  "Oi wanker, your Harley's been in the shop more than you've been to the pub. And that's saying something.",
  "Get a mullet up ya, ya absolute tosser. The Indian's better and you know it.",
  "You ride like a nervous learner, ya knob. Twist the bloody throttle.",
  "Listen here, ya dropkick: chrome doesn't make it go faster. It just makes it shinier while it breaks down.",
  "Fair dinkum, you're a flog. Who reverses a caravan into the letterbox? Twice.",
  "Indian starts first go. Harley needs a jump start, a prayer and a mechanic named Dazza. Get a mullet up ya.",
  "Harley riders reckon it's a lifestyle. Yeah, the lifestyle is standing on the side of the Pacific Motorway, ya dickhead.",
  "Indian: built like a Swiss watch. Harley: built like a dunny door in a cyclone. Fight me, ya prick.",
  "You know why Harleys vibrate so much? So the owner doesn't notice the bits falling off. Dickhead.",
  "Bought a Harley, did ya? Tell ya what, ya prick, the only thing it's faster at is emptying your wallet.",
  "An Indian rider and a Harley rider walk into a pub. Only one of 'em rode there. The other one's still waiting on the NRMA, ya dickhead.",
  "Harley: all chrome, no brains. Bit like you, ya prick.",
  "The Indian Chief will still be purring when your Harley's a garden ornament. Get a mullet up ya.",
  "I ride a Harley, and even I'll admit the Indian's a better bike. Don't tell anyone or I'll deck ya, ya dickhead.",
  "Harley's idea of innovation is a new shade of black. Indian actually builds bikes, ya prick.",
  "Oi dickhead, a Harley leaks oil so you always know where you parked it. With your memory, that's a feature.",
  "Get a mullet up ya, ya flamin' galah. Business at the front, oil leak at the back.",
  "You're a good cunt, but your taste in bikes is bloody criminal, ya prick.",
  "Fuck me, you're slow. My nan's mobility scooter would lap ya, ya dickhead.",
  "This is a Night Train, ya galah. Last of the real engines before all that V-tech water-cooled shit came out.",
  "Night Train. Proper air-cooled Harley, loud as buggery. Your V-tech whatever can get stuffed.",
  "They don't make 'em like the Night Train anymore. Now it's all computers and water cooling. Soft as butter, the lot of 'em.",
  "Tell ya what ya cunt, Indian or Harley? The Indian starts. The Harley pisses oil on the driveway to mark its territory.",
  "Harley riders wave at each other. Indian riders wave at the Harleys broken down on the side of the road. Suck on that, ya drongo.",
  "A Harley isn't loud, ya deaf old bastard. It's just telling the whole suburb you're coming, five minutes before you get there.",
  "Indian vs Harley, settled: whichever one you can still pick up when it tips over in the driveway. So neither, ya weak dog.",
  "Every Harley comes with a free oil drip tray. It's called your fuckin' garage floor.",
  "Barnesy can still hit the big note in Working Class Man. You hit it getting out of the recliner, ya mongrel.",
  "Barnesy's been screaming since the '70s and he's still got more puff than you on a flight of stairs.",
  "Barnesy's got a voice like gravel. You've got knees like gravel, ya creaky old bastard.",
  "You've retired from mowing the lawn more times than Farnsy's retired from touring. Get off ya arse.",
  "Brocky won Bathurst nine times. You've taken the wrong turn to Canungra at least that many, ya galah.",
  "Steve Irwin wrestled crocs. You wrestle the caravan awning, and the awning wins. Every. Single. Time.",
  "\"That's not a knife.\" That's attempt number four at reversing the caravan, ya useless galah. Crikey.",
  "AC/DC said it's a long way to the top. They were talking about you backing the trailer up the driveway.",
  "Midnight Oil sang Beds Are Burning. Your camp cooking took it as a fuckin' challenge.",
  "Did I already tell you this one? Doesn't matter, ya won't remember, ya forgetful old coot. Easiest crowd I've ever had.",
  "Upside of the memory going: every ride up Tamborine is a brand new adventure. Never been, apparently.",
  "Keys in the fridge again? Relax, at least they're next to the beer. Priorities intact, ya legend.",
  "Hang on, what was I saying? Ah, fuck it. Neither of us will remember in a minute anyway.",
  "Holden or Ford? Doesn't matter. You'll still reckon the one you had in '78 was better, ya stubborn old mule.",
  "The Chiko Roll was invented in Wagga and perfected by your arteries.",
  "Bunnings snag queue: the only line you've ever stood in without a fuckin' whinge.",
  "Reckon you can still pull a wheelie? The physio reckons no, and so do I, ya flog.",
  "The tram's the only thing you'll overtake on the Gold Coast this year, and it's on bloody rails.",
  "Your campervan's got more rust than a Kingswood left on the beach at Bribie.",
  "Crocodile Dundee had the knife. You've got a Swiss Army knife with 40 tools and ya still use your teeth.",
];
const LINES: Record<"flip" | "moon" | "drink" | "smoke" | "throw" | "fall" | "up", string[]> = {
  flip: ["Swivel on that, ya dropkick!", "That one's from me and the whole Smart Arse MC, ya old bastard.", "Here's the Harley warranty department's official response, ya dill.", "Oi! Read it and weep, grandpa."],
  moon: ["Full moon over the Gold Coast tonight, ya ratbag!", "Kiss that, old man. Best view you've had since '82.", "That's the only thing round here shinier than your chrome.", "Park ya eyes on that, ya perve. Ha!"],
  drink: ["Cheers, ya cunt! XXXX Gold: breakfast of champions.", "One for the road, and one for the other fuckin' road.", "Don't look at me like that. It's five o'clock somewhere, ya wowser.", "Ahhh. Beer's colder than your ex, ya muppet."],
  smoke: ["Doctor said quit. Doctor rides a Vespa, ya bogan.", "Got a light? Nah, found one. Tight arse.", "Want a drag? Course ya don't, you're soft as butter, ya numpty."],
  throw: ["Catch, ya goose!", "Recycling, Aussie style!", "Heads up, ya slow bastard!", "Empty. Like your fuckin' head."],
  fall: ["Who moved the fuckin' ground?!", "I'm right! I'm right! Nobody saw that, ya galahs.", "That's not a stack, that's a tactical dismount, ya knob.", "Ow. Fuck. Me stubby's alright though."],
  up: ["Right. Where was I? Oh yeah: you're a flog.", "Back on the horse. Don't tell anyone, ya dobber.", "Sweet as. Barely a scratch. On the bike, I mean."],
};
// For anyone who'd rather not read the full-strength version.
const bleep = (text: string) => text.replace(/cunt/gi, "c**t").replace(/fuck/gi, "f**k").replace(/shit/gi, "sh*t").replace(/bastard/gi, "b*stard").replace(/prick/gi, "pr*ck").replace(/dickhead/gi, "d*ckhead").replace(/wanker/gi, "w*nker");
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const FAR_LANE = 58;
const CAR_COLORS = ["#2e7dd1", "#e0a100", "#c0392b", "#27ae60", "#8e44ad", "#e8e8e8"];
const CAR_LINES = ["Oi! Eyes on the road, ya dag!", "What are youse lookin' at?!", "Wind the window up, Karen!", "Take a photo, it'll last longer, ya drongos!", "Bloody tourists.", "Yeah, you heard me, Dad. Keep drivin'!"];
const KILL_LINES: Record<Critter, string[]> = {
  roo: ["Beauty! Roo snags tonight!", "Skippy's comin' home with me, ya larrikin.", "Fresh roo. Only been there since Tuesday."],
  koala: ["Drop bear down! Koala curry, anyone?", "Smells like eucalyptus. Pre-seasoned!", "Don't tell the tourists, ya great sook."],
  croc: ["Croc! That's a handbag AND dinner.", "Who's a tough nut now, ya big handbag?", "Tastes like chicken. Angry chicken."],
  wombat: ["Wombat! Square poo, square meal.", "Built like a brick shithouse. Feeds six.", "Wombat stew. Nan's recipe, ya galah."],
};
const CRITTER_NAMES: Record<Critter, string> = { roo: "roo", koala: "koala", croc: "croc", wombat: "wombat" };
const STOP_LINES = ["Stop sign? More of a suggestion, really.", "Stop? Never heard of it, ya drongo!", "Council can send me the bill."];
const BLAST_LINES = ["Stop THIS, ya mongrel!", "Say hello to me little friend!", "That's for every red light, ya bastard."];
const COP_LINES = ["Shit, it's the cops! Catch me if ya can, ya mongrels!", "Oi oi, the fuzz! Hold onto ya stubbies!", "Coppers! Time to open her up!"];
const ESCAPE_LINES = ["Lost 'em. Too easy, ya flog!", "Coppers couldn't catch a cold.", "They'll never take me alive, ya ratbags!", "Outran the pigs AND kept me beer. Legend."];
const ONCOMING_LINES = ["Get on ya own side, ya dropkick!", "Swerve, ya drongo! …Oh, that's my side? Whatever.", "Nearly wore ya on the grille, ya muppet!", "Move it or lose it, Dad!"];
const BBQ_START = ["Right, that's three. Barbie time, ya bogans!", "Esky's full. Fire up the barbie!"];
const BBQ_COOKING = ["Pink on…", "Roo, koala and croc. Surf and turf, bush style.", "Don't touch me tongs, ya dill."];
const BBQ_DONE = ["…black off. Just the way we love 'em!", "Charcoal. Perfect. Anyone who says otherwise can get stuffed."];
const BBQ_SERVED = ["Snag on bread with a squirt of dead horse. Get around it, ya muppets!", "Snag sanga with dead horse. Bunnings wishes."];
const CHASE_LINES = ["Catch me if ya can, ya flogs!", "Too slow, Constable Plod!", "Ya'll need a Night Train to catch me!", "Wee-oo wee-oo, ya wankers!", "Is that all ya got, ya cunts?"];
const COP_SHOUTS = ["PULL OVER!", "STOP THAT BIKE!", "OI! YOU!", "BACKUP! BACKUP!"];
const LASSO_LINES = ["Gotcha, ya ratbag! Hand over ya snags.", "Yee-haw! Where d'ya think you're goin'?", "Caught one! Tie 'em to the Night Train."];
// Things that come flying out of a proper cartoon bikie brawl.
const JUNK = ["🍳", "🐔", "🩴", "🪑", "🎸", "🧯", "🏓", "🍺", "🌭", "🥾", "🪣", "🛞", "🧦", "🥫"];
// Four pairs slugging it out, as px offsets from the middle of the screen, and what they're swinging.
const PAIRS = [{ at: -190, row: 22 }, { at: -80, row: 42 }, { at: 30, row: 22 }, { at: 140, row: 42 }];
const RED_WEAPONS = ["🍳", undefined, "🏓", "🐔"], BLUE_WEAPONS = ["🩴", "🌭", undefined, "🎸"];
const BRAWL_HITS = ["POW!", "BIFF!", "WHACK!", "KAPOW!", "BONK!", "THWACK!", "OOF!", "CRUNCH!"];
// Left on the road for a minute, roadkill gets nicked by a bin chicken.
const IBIS_AFTER_MS = 60_000;
const IBIS_LINES = ["Squawk. Finders keepers.", "Mine now. MINE.", "Five second rule, ya bogans.", "Bin chicken's eating good tonight.", "Honk. Don't mind me.", "I've eaten worse out of a Maccas bin.", "Shh. I was never here."];
// Bin chicken flock: they land on (and around) the wheelie bin at the back of the road.
const BIN_BOTTOM = 96, BIN_W = 56, BIN_H = 75, FLOCK_SIZE = 6;
const BIN_JUNK = ["🍌", "🥡", "🍕", "📰", "🥤", "🍟", "🦴", "🧃"];
const FLOCK_LINES = ["Oi, the bin chicken union's having a meeting.", "Look at 'em. Feathered bogans, the lot of 'em.", "Get outta that bin, ya filthy animals!", "Six of 'em. SIX. It's an infestation, ya galahs."];
const ROO_LINES = ["Skippy and the boys, off to the pub.", "Oi! Don't jump in front of the Night Train!", "Look at 'em go. Built like brick dunnies.", "That big buck's eyeing me off. Come at me, Skip!", "Roo mob! Hide the snags."];
// Gum trees along the back of the road (as fractions of the screen width); koalas in some.
const TREES = [{ at: 0.34, koala: true }, { at: 0.64, koala: false }, { at: 0.88, koala: true }];
const TREE_W = 110, TREE_H = 200, TREE_BOTTOM = 100;
const DROP_LINES = ["DROP BEAR! Vegemite behind the ears, quick!", "Bloody drop bears. Tourists reckon they're a myth, the dills.", "That's why ya never park under a gum tree, ya galah.", "Get back up ya tree, ya feral little mongrel!"];
const SPORTBIKE_COLORS = ["#16a34a", "#dc2626", "#2563eb", "#f59e0b", "#e5e7eb", "#7c3aed"];
const SPORTBIKE_LINES = ["Plastic fantastic! Get a real bike, ya muppet!", "Listen to that sewing machine scream.", "Nice pyjamas, ya Power Ranger!", "Hairdryer on wheels, that one.", "Knees on the ground, brain in the bin."];
const STRIKE_LINES = ["Oof! Skippy's had a bad day. Dinner's sorted, though.", "Should've got a roo bar, ya galah!", "That's why ya don't drive at dusk, ya dill.", "Poor bastard. The roo, not the car."];
const SNAKE_LINES = ["HOOP SNAKE! Lift ya feet, ya galah!", "Rolled right past me, the cheeky mongrel.", "Seen bigger hoop snakes at the Ekka.", "Never trust a snake that bites its own arse."];
const DAZZA_ASKS = ["Oi, spare a durry, love?", "Got a couple o' bucks for the bus? I'm a bit short.", "Couldn't bum a smoke off ya, could I? I'll pay ya back Tuesday."];
const SHAZZ_TO_DAZZA = ["Pay me back Tuesday? Which Tuesday, ya bludger?", "Get a mullet up ya, Dazza. Buy ya own.", "Here, take one and piss off, ya bludger.", "I've seen more of your IOUs than you've had hot dinners, Dazza."];
const DRUNK_LABELS = ["Stone cold sober", "Tipsy", "Pissed", "Maggoted", "Absolutely legless"];
function Trick({ label, onClick }: { label: string; onClick: () => void }) {
  const [icon, ...words] = label.split(" ");
  return <button className={styles.trick} onClick={onClick} aria-label={words.join(" ")} title={words.join(" ")}><span aria-hidden>{icon}</span><em>{words.join(" ")}</em></button>;
}
const FIRST_DELAY = 20_000, GAP = 150_000, GROUND = 14, VIEW_W = 260, VIEW_H = 180, FALL_AT = 4;
type Phase = "hidden" | "enter" | "parked" | "leave";
type Action = "flip" | "moon" | "drink" | "smoke" | "throw";
type Line = { text: string; ai: boolean };
type Fx = { id: number; kind: "smoke" | "tyre" | "skid" | "burst" | "bottle" | "shard" | "stars" | "fog" | "boom" | "rubber" | "bullet" | "junk" | "splat" | "rooFly"; x: number; y: number; size: number; text?: string; dx?: number; dy?: number; arc?: number; hit?: boolean };
let uid = 0;

// `summon` increments each time the "Call Shazz" button is pressed.
export default function SmartArse({ topic, summon }: { topic: string; summon: number }) {
  const [muted, setMuted] = useState<boolean | null>(null);
  // Swearing is bleeped unless the viewer switches it to full.
  const [clean, setClean] = useState(true);
  const [phase, setPhaseState] = useState<Phase>("hidden");
  const [line, setLine] = useState<Line | null>(null);
  const [talking, setTalking] = useState(false);
  const [pose, setPose] = useState<ShazzPose>("ride");
  const [drunk, setDrunk] = useState(0);
  const [fx, setFx] = useState<Fx[]>([]);
  const [width, setWidth] = useState(210);
  const [atX, setAtX] = useState(0);
  const [moving, setMoving] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [menu, setMenu] = useState(false);
  const [meter, setMeter] = useState(false);
  const [burning, setBurning] = useState(false);
  const [wall, setWall] = useState<{ left: number; width: number; height: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [finger, setFinger] = useState<{ left: number; bottom: number } | null>(null);
  const smokeCloud = useRef<HTMLDivElement>(null);
  const [cars, setCars] = useState<{ id: number; dir: 1 | -1; lane: "far" | "near"; color: string; ms: number; width: number; shockAt: number; turnAt?: number }[]>([]);
  const [trophies, setTrophies] = useState<Critter[]>([]);
  const trophyCount = useRef(0);
  // Set when the third critter goes on the bike; the barbie runs as soon as she's free.
  const bbqPending = useRef(false);
  const [bbq, setBbq] = useState<{ left: number; width: number; served: boolean; stolen?: number } | null>(null);
  const [kills, setKills] = useState<{ id: number; kind: Critter; x: number; bornAt: number; claimed?: boolean }[]>([]);
  const [ibis, setIbis] = useState<{ x: number; ms: number; faceLeft: boolean; stage: "walk" | "grab" | "leave"; carrying: Critter | null; line: string | null } | null>(null);
  // Bin chickens just cruising overhead, and the one that raids the barbie.
  const [flyers, setFlyers] = useState<{ id: number; dir: 1 | -1; bottom: number; ms: number; delay: number }[]>([]);
  type FlockBird = { x: number; bottom: number; ms: number; onBin: boolean };
  const [flock, setFlock] = useState<{ dir: 1 | -1; stage: "in" | "landed" | "out"; birds: FlockBird[] } | null>(null);
  const flockBusy = useRef(false);
  // A mob of roos bouncing across behind her now and then.
  const [dropBear, setDropBear] = useState<{ x: number; bottom: number; ms: number; ease: string; faceLeft: boolean } | null>(null);
  const dropBusy = useRef(false);
  // Narrow screens get two trees instead of three.
  const treeSpots = () => TREES.filter((_, i) => window.innerWidth >= 640 || i !== 1).map((t) => ({ ...t, x: Math.round(window.innerWidth * t.at - TREE_W / 2) }));
  // Traffic and wildlife extras
  const [sportbikes, setSportbikes] = useState<{ id: number; dir: 1 | -1; lane: "far" | "near"; color: string; ms: number }[]>([]);
  const [strike, setStrike] = useState<{ carX: number; carMs: number; color: string; dented: boolean; rooX: number; rooBottom: number; rooMs: number; rooGone: boolean; shaking: boolean } | null>(null);
  const strikeBusy = useRef(false);
  const [danglers, setDanglers] = useState<{ id: number; x: number; top: number; ms: number }[]>([]);
  const [snakes, setSnakes] = useState<{ id: number; dir: 1 | -1; ms: number; bottom: number }[]>([]);
  const [dazza, setDazza] = useState<{ x: number; ms: number; faceLeft: boolean; pose: "walk" | "ask" | "run"; bear: boolean; line: string | null; bearTop: number | null } | null>(null);
  const dazzaBusy = useRef(false);
  const [roos, setRoos] = useState<{ id: number; dir: 1 | -1; bottom: number; size: number; ms: number; delay: number; hop: number; joey: boolean }[]>([]);
  const binX = () => Math.max(24, Math.round(window.innerWidth * 0.1));
  const [raider, setRaider] = useState<{ x: number; bottom: number; ms: number; faceLeft: boolean; carrying: "snag" | null } | null>(null);
  const ibisBusy = useRef(false);
  const killsRef = useRef(kills);
  killsRef.current = kills;
  const esky = useRef(0);
  const [sign, setSign] = useState<{ x: number; holes: number; down: boolean } | null>(null);
  const [cop, setCop] = useState(false);
  const copCar = useRef<HTMLSpanElement>(null);
  const [copDamage, setCopDamage] = useState(0);
  const damageRef = useRef(0);
  const [wreck, setWreck] = useState(false);
  const [fireball, setFireball] = useState<{ x: number; bottom: number } | null>(null);
  const [cops, setCops] = useState<{ x: number; bottom: number; look: "xray" | "singed" } | null>(null);
  const [tattoo, setTattoo] = useState<{ left: number; width: number; stage: TattooStage } | null>(null);
  const [teardrops, setTeardrops] = useState(1);
  const [gamePrompt, setGamePrompt] = useState(false);
  const gameStart = useRef<() => void>(() => {});
  const [game, setGame] = useState(false);
  const shootRef = useRef<(() => void) | null>(null);
  const [convoy, setConvoy] = useState(0);
  const [brawl, setBrawl] = useState<"rideIn" | "fight" | "guillotine" | "chop" | null>(null);
  const brawlRef = useRef(brawl);
  brawlRef.current = brawl;
  const [knocked, setKnocked] = useState<string | null>(null);
  const bike = useRef<HTMLButtonElement>(null);
  const place = useRef<{ x: number; tilt: number; pivot: number; y?: number }>({ x: -500, tilt: 0, pivot: 60 });
  const phaseRef = useRef<Phase>("hidden");
  const drunkRef = useRef(0);
  const busy = useRef(false);
  const lineTimer = useRef(0);
  const meterTimer = useRef(0);
  const showMeter = () => { setMeter(true); window.clearTimeout(meterTimer.current); meterTimer.current = window.setTimeout(() => setMeter(false), 10_000); };
  const frame = useRef(0);
  const deck = useRef<string[]>([]);
  const ai = useRef<Record<string, { at: number; list: string[] }>>({});
  const topicRef = useRef(topic);
  topicRef.current = topic;
  const scale = width / VIEW_W;
  const height = VIEW_H * scale;

  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const add = (item: Omit<Fx, "id">) => setFx(list => [...list.slice(-180), { ...item, id: ++uid }]);
  const remove = (id: number) => setFx(list => list.filter(item => item.id !== id));
  const s = () => (bike.current?.offsetWidth || width) / VIEW_W;
  // The more she's had, the more she weaves across the road and lurches about.
  const weave = (t: number, x: number, tilt: number, pivot: number) => {
    const d = drunkRef.current;
    if (!d) return { x, tilt, pivot };
    return {
      x: x + Math.sin(t * Math.PI * (2 + d)) * d * 9 * (1 - t * 0.6),
      y: Math.abs(Math.sin(t * Math.PI * (1.5 + d * 0.8))) * d * 7,
      tilt: tilt + Math.sin(t * Math.PI * (4 + d * 2)) * d * 2.5,
      pivot,
    };
  };
  const later = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));
  const draw = useCallback(() => {
    const el = bike.current; if (!el) return;
    const { x, tilt, pivot, y = 0 } = place.current, k = el.offsetWidth / VIEW_W;
    el.style.transformOrigin = `${pivot * k}px ${172 * k}px`;
    el.style.transform = `translate(${x}px, ${-y}px) rotate(${tilt}deg)`;
  }, []);
  const animate = (duration: number, step: (t: number) => void, stop?: () => boolean) => new Promise<void>(resolve => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      step(t); draw();
      if (t < 1 && !stop?.()) frame.current = requestAnimationFrame(tick); else resolve();
    };
    frame.current = requestAnimationFrame(tick);
  });

  // Lines queue up: a new one waits until the current one has been up long enough to read,
  // then shows for roughly reading time plus a generous buffer (10s minimum, up to 25s).
  const lineShownAt = useRef(0);
  const lineQueue = useRef<{ text: string; ai: boolean }[]>([]);
  const queueTimer = useRef(0);
  const readTime = (text: string) => Math.min(25_000, 10_000 + text.length * 120);
  const MIN_READ_MS = 7000;
  const showLine = useCallback((text: string, fromAi: boolean) => {
    // The more she drinks, the more she hiccups.
    const hic = drunkRef.current >= 2 ? pick([" *hic*", " *hic* ...", " *burp*"]) : "";
    setLine({ text: text + hic, ai: fromAi });
    lineShownAt.current = Date.now();
    window.clearTimeout(lineTimer.current);
    lineTimer.current = window.setTimeout(() => setLine(null), readTime(text));
    setTalking(true); window.setTimeout(() => setTalking(false), 1800);
  }, []);
  const drainQueue = useCallback(() => {
    window.clearTimeout(queueTimer.current);
    const wait = MIN_READ_MS - (Date.now() - lineShownAt.current);
    if (wait > 0) { queueTimer.current = window.setTimeout(drainQueue, wait); return; }
    const nextLine = lineQueue.current.shift();
    if (nextLine) { showLine(nextLine.text, nextLine.ai); if (lineQueue.current.length) queueTimer.current = window.setTimeout(drainQueue, MIN_READ_MS); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLine]);
  const speak = useCallback((text: string, fromAi = false) => {
    // Keep only the newest couple waiting so she never falls minutes behind.
    lineQueue.current = [...lineQueue.current, { text, ai: fromAi }].slice(-2);
    drainQueue();
  }, [drainQueue]);
  // AI jokes are fetched per topic and used first; the built-in list is the fallback.
  const loadAi = useCallback(async () => {
    const key = topicRef.current, cached = ai.current[key];
    if (cached && (cached.list.length || Date.now() - cached.at < 600_000)) return;
    ai.current[key] = { at: Date.now(), list: [] };
    try {
      const response = await fetch("/api/day-out/smartarse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: key }), signal: AbortSignal.timeout(15000) });
      const body: { jokes?: unknown } = response.ok ? await response.json() : {};
      if (Array.isArray(body.jokes)) ai.current[key].list.push(...body.jokes.filter((joke): joke is string => typeof joke === "string"));
    } catch { /* built-in jokes cover it */ }
  }, []);
  const say = useCallback(() => {
    const fresh = ai.current[topicRef.current]?.list.shift();
    if (!fresh && !deck.current.length) deck.current = [...JOKES].sort(() => Math.random() - 0.5);
    speak(fresh || deck.current.pop()!, !!fresh);
    if (!ai.current[topicRef.current]?.list.length) void loadAi();
  }, [loadAi, speak]);

  async function fall() {
    const k = s(), x = place.current.x;
    setPose("fallen");
    add({ kind: "burst", x: x + 30 * k, y: GROUND + 70 * k, size: 0, text: "THUD!" });
    for (let i = 0; i < 6; i++) add({ kind: "tyre", x: x + (40 + i * 18) * k, y: GROUND + 4, size: 30 + Math.random() * 20 });
    await later(500);
    add({ kind: "stars", x: x + 10 * k, y: GROUND + 34 * k, size: 0, text: "★ ✦ ★" });
    speak(pick(LINES.fall));
    await later(4200);
    drunkRef.current = 0; setDrunk(0); setPose("ride");
    speak(pick(LINES.up));
  }
  async function act(action: Action) {
    if (phaseRef.current !== "parked" || busy.current) return;
    busy.current = true;
    const k = s(), x = place.current.x;
    setPose(action);
    if (action === "drink") {
      drunkRef.current += 1; setDrunk(drunkRef.current); showMeter();
      if (drunkRef.current >= FALL_AT) { speak("One more for the road… whoa, whoa, WHOA—"); await later(900); await fall(); busy.current = false; return; }
      speak(pick(LINES.drink));
      await later(1400);
      // Empty. Slam it into the road.
      const handY = GROUND + (VIEW_H - 60) * k;
      add({ kind: "bottle", x: x + 143 * k, y: handY, size: 0, dx: 25 + Math.random() * 45, dy: handY - GROUND - 6, arc: -35 });
      await later(700);
    } else if (action === "throw") {
      speak(pick(LINES.throw));
      await later(300);
      // Lob a stubby behind her; it smashes on the road.
      const startX = x + 80 * k, startY = GROUND + (VIEW_H - 8) * k, dx = -(90 + Math.random() * 260);
      add({ kind: "bottle", x: startX, y: startY, size: 0, dx, dy: startY - GROUND - 6 });
      await later(700);
    } else if (action === "smoke") {
      speak(pick(LINES.smoke));
      for (let i = 0; i < 8; i++) { add({ kind: "smoke", x: x + 151 * k + i * 2, y: GROUND + (VIEW_H - 38) * k, size: 10 + i * 2 }); await later(280); }
    } else {
      speak(pick(action === "flip" ? LINES.flip : LINES.moon));
      add({ kind: "burst", x: x + (action === "moon" ? 20 : 120) * k, y: height + GROUND + 30, size: 0, text: action === "moon" ? "FULL MOON!" : "OI!" });
      await later(2600);
    }
    setPose("ride");
    busy.current = false;
  }
  // Click the road and she rides over there, turning round if she has to go left.
  async function rideTo(clientX: number) {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    const k = s(), w = bike.current.offsetWidth, x0 = place.current.x;
    const target = Math.max(8, Math.min(window.innerWidth - w - 8, clientX - w / 2));
    if (Math.abs(target - x0) < 12) return;
    busy.current = true; setMoving(true);
    const left = target < x0; setFacingLeft(left);
    const rearAt = (x: number) => x + (left ? VIEW_W - 60 : 60) * k, exhaustAt = (x: number) => x + (left ? VIEW_W - 16 : 16) * k;
    let lastPuff = 0, lastRear: number | null = null;
    await animate(Math.max(600, Math.abs(target - x0) * (2.2 + drunkRef.current * 0.5)), t => {
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, x = x0 + (target - x0) * e, now = performance.now();
      place.current = weave(t, x, 0, 60);
      if (now - lastPuff > 70) { lastPuff = now; add({ kind: "smoke", x: exhaustAt(x), y: GROUND + (VIEW_H - 128) * k, size: 12 + Math.random() * 10 }); }
      // Skid the back tyre while she pulls up.
      if (t > 0.75) {
        const rear = rearAt(x);
        if (lastRear !== null && Math.abs(rear - lastRear) > 0) add({ kind: "skid", x: Math.min(rear, lastRear), y: GROUND + 5 * k, size: Math.abs(rear - lastRear) + 1 });
        if (now - lastPuff < 5) add({ kind: "tyre", x: rear, y: GROUND + 4, size: 20 + Math.random() * 12 });
        lastRear = rear;
      }
    });
    place.current = { x: target, tilt: 0, pivot: 60 }; draw();
    setFacingLeft(false); setAtX(target); setMoving(false);
    busy.current = false;
    if (Math.random() < 0.5) speak(pick(["Happy now, ya bossy bugger?", "Righto, parked. Where's me beer?", "Don't tell me where to park, ya cunt. …Fine.", "This spot's got better views of your bald patch."]));
  }
  // She sobers up one beer every 45 seconds.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (busy.current || drunkRef.current === 0) return;
      drunkRef.current -= 1; setDrunk(drunkRef.current);
    }, 45_000);
    return () => clearInterval(timer);
  }, []);
  // Left alone, she gets restless: rides somewhere or pulls a random trick every few seconds.
  const restless = useRef<() => void>(() => {});
  restless.current = () => {
    if (phaseRef.current !== "parked" || busy.current) return;
    const roll = Math.random();
    if (bbqPending.current) { void barbie(); return; }
    if (killsRef.current.length && roll < 0.3) { void collect(pick(killsRef.current).id); return; }
    if (roll < 0.06) void burnout();
    else if (roll < 0.1) void runStopSign();
    else if (roll < 0.13) void callBackup();
    else if (roll < 0.4 + drunkRef.current * 0.12) void rideTo(40 + Math.random() * (window.innerWidth - 80));
    else void act(pick(["drink", "flip", "moon", "smoke", "throw", "flip", "smoke"] as Action[]));
  };
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { restless.current(); next(); }, 12_000 + Math.random() * 10_000); };
    next();
    return () => clearTimeout(timer);
  }, [phase]);
  // Stubby from her hand, slammed into the road in front of the bike.
  const slamBottle = (x: number, k: number) => {
    const handY = GROUND + (VIEW_H - 60) * k;
    add({ kind: "bottle", x: x + 143 * k, y: handY, size: 0, dx: 25 + Math.random() * 45, dy: handY - GROUND - 6, arc: -35 });
  };
  // Brick wall, front wheel up, full throttle for ten seconds until the rear tyre lets go.
  async function burnout() {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    setMenu(false);
    let k = s();
    // She needs room for the wall in front of her.
    if (place.current.x + 310 * k > window.innerWidth) await rideTo(window.innerWidth * 0.3 + bike.current.offsetWidth / 2);
    if (busy.current) return;
    busy.current = true; setBurning(true); k = s();
    const x0 = place.current.x, rear = x0 + 60 * k;
    setWall({ left: x0 + 226 * k, width: 70 * k, height: 130 * k });
    speak("Hold me stubby. Watch this, ya muppet!");
    await later(900);
    const done = new Set<string>();
    const at = (key: string, when: number, t: number, run: () => void) => { if (t >= when && !done.has(key)) { done.add(key); run(); } };
    const shout = (text: string) => add({ kind: "burst", x: x0 + (Math.random() * 120 - 20) * k, y: VIEW_H * k + GROUND + 30 + Math.random() * 60, size: 0, text });
    let lastPuff = 0, lastFog = 0;
    await animate(10000, t => {
      const now = performance.now();
      // Front wheel up against the wall, the whole bike shaking on the rev limiter.
      place.current = { x: x0 + Math.sin(t * 420) * 1.8, tilt: -Math.min(12, t * 90) + Math.sin(t * 310) * 1.2, pivot: 60 };
      if (now - lastPuff > 35) { lastPuff = now; add({ kind: "tyre", x: rear - Math.random() * 50, y: GROUND + 4, size: 40 + Math.random() * 50 + t * 80 }); }
      if (t > 0.08 && now - lastFog > 110) { lastFog = now; add({ kind: "fog", x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight * 0.9, size: 200 + Math.random() * 280 }); }
      if (smokeCloud.current) smokeCloud.current.style.opacity = String(Math.min(0.88, t * 1.15));
      if (now % 900 < 20) add({ kind: "skid", x: rear - 30 * k, y: GROUND + 5 * k, size: 60 * k });
      at("y1", 0.05, t, () => shout("YEOOOOO!"));
      at("d1", 0.2, t, () => setPose("drink"));
      at("b1", 0.33, t, () => { setPose("ride"); slamBottle(x0, k); });
      at("y2", 0.4, t, () => shout("BRAAAAAAP!"));
      at("d2", 0.5, t, () => setPose("drink"));
      at("b2", 0.62, t, () => { setPose("ride"); slamBottle(x0, k); });
      at("y3", 0.7, t, () => shout("YEEEOOOOOO!!"));
      at("f1", 0.78, t, () => setPose("flip"));
      at("y4", 0.88, t, () => { setPose("ride"); shout("SEND IT!!"); });
    });
    // Tyre lets go: bang, rubber everywhere, white flash.
    add({ kind: "boom", x: rear - 90, y: GROUND + 40, size: 0, text: "BANG!!" });
    for (let i = 0; i < 16; i++) add({ kind: "rubber", x: rear, y: GROUND + 20 * k, size: 8 + Math.random() * 12, dx: (Math.random() - 0.5) * 600, dy: Math.random() * 260 - 40 });
    setFlash(n => n + 1);
    await later(300);
    if (smokeCloud.current) smokeCloud.current.style.opacity = "0";
    setFx(list => list.filter(item => item.kind !== "fog" && item.kind !== "tyre"));
    setWall(null); setBurning(false);
    place.current = { x: x0, tilt: 0, pivot: 60 }; draw();
    drunkRef.current = Math.min(FALL_AT - 1, drunkRef.current + 2); setDrunk(drunkRef.current); showMeter();
    await later(1000);
    // Arm up, then the finger grows straight out of her fist.
    setPose("flip");
    await later(250);
    // Keep the giant hand on screen even if she's parked near an edge.
    setFinger({ left: Math.min(window.innerWidth - 120, Math.max(120, place.current.x + 137 * k)), bottom: GROUND + (VIEW_H - 16) * k });
    speak("Yeah cunt! What a ripper!");
    await later(3400);
    setFinger(null); setPose("ride");
    busy.current = false;
  }
  // Aussies drive on the left: far-lane traffic heads left to right; near-lane traffic comes
  // right to left, straight at Shazz (who's on the wrong side, naturally), and they swerve.
  function spawnCar() {
    const width = window.innerWidth < 640 ? 150 : 200, lane: "far" | "near" = Math.random() < 0.5 ? "far" : "near";
    const dir: 1 | -1 = lane === "far" ? 1 : -1, ms = 4200 + Math.random() * 2500;
    const from = dir === 1 ? -width : window.innerWidth, to = dir === 1 ? window.innerWidth : -width;
    const herMiddle = place.current.x + (bike.current?.offsetWidth || 200) / 2;
    const passAt = Math.max(0, Math.min(1, (herMiddle - width / 2 - from) / (to - from))) * ms;
    if (brawlRef.current) {
      // Nobody drives through a bikie brawl: pull up short, gawk, chuck a U-ey.
      const cx = window.innerWidth / 2;
      const turnAt = dir === 1 ? Math.max(-width * 0.3, cx - 560 - width) : Math.min(window.innerWidth - width * 0.7, cx + 560);
      setCars(list => [...list, { id: ++uid, dir, lane, color: pick(CAR_COLORS), ms: ms * 1.2, width, shockAt: ms * 1.2 * 0.42, turnAt }]);
      return;
    }
    setCars(list => [...list, { id: ++uid, dir, lane, color: pick(CAR_COLORS), ms, width, shockAt: passAt }]);
    window.setTimeout(async () => {
      if (phaseRef.current !== "parked" || busy.current) return;
      busy.current = true;
      setPose("flip");
      add({ kind: "burst", x: herMiddle - 20, y: VIEW_H * s() + GROUND + 24, size: 0, text: "OI!" });
      if (lane === "far") { speak(pick(CAR_LINES)); await later(1700); }
      else {
        // Head-on: she ducks toward the kerb and wobbles while the car dives into the other lane.
        speak(pick(ONCOMING_LINES));
        const x0 = place.current.x;
        await animate(900, t => { place.current = { x: x0, y: -Math.sin(t * Math.PI) * 10, tilt: Math.sin(t * Math.PI * 3) * 7, pivot: 130 }; });
        place.current = { x: x0, tilt: 0, pivot: 60 }; draw();
        await later(700);
      }
      setPose("ride"); busy.current = false;
    }, Math.max(0, passAt - (lane === "near" ? 550 : 350)));
  }
  // Something's copped it on the road. She'll grab it for dinner.
  function spawnKill() {
    if (killsRef.current.length >= 3) return;
    const herMiddle = place.current.x + (bike.current?.offsetWidth || 200) / 2;
    let x = 0;
    for (let i = 0; i < 8; i++) { x = 30 + Math.random() * (window.innerWidth - 120); if (Math.abs(x + 35 - herMiddle) > 140) break; }
    setKills(list => [...list, { id: ++uid, kind: pick(CRITTERS), x, bornAt: Date.now() }]);
  }
  async function collect(id: number) {
    const kill = killsRef.current.find(item => item.id === id);
    if (!kill || kill.claimed || phaseRef.current !== "parked" || busy.current) return;
    await rideTo(kill.x + 35);
    if (busy.current || !killsRef.current.some(item => item.id === id)) return;
    busy.current = true;
    setPose("throw");
    setKills(list => list.filter(item => item.id !== id));
    esky.current += 1;
    setTrophies(list => [...list, kill.kind].slice(-3));
    trophyCount.current += 1;
    add({ kind: "burst", x: kill.x - 20, y: GROUND + 90, size: 0, text: "+1 FOR DINNER!" });
    speak(`${pick(KILL_LINES[kill.kind])} Strapped to the front of the Night Train. That's ${esky.current} for the esky.`);
    await later(1200);
    setPose("ride"); busy.current = false;
    if (trophyCount.current >= 3) bbqPending.current = true;
  }

  // Three critters on the bike: hop off, cook 'em pink to charcoal, serve on bread with dead horse.
  async function barbie() {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    const w = () => bike.current?.offsetWidth || 200;
    const sceneW = Math.round(w() * 0.9);
    // Needs room beside the bike for the barbie.
    if (place.current.x + w() + sceneW + 10 > window.innerWidth) await rideTo(window.innerWidth * 0.35);
    if (busy.current) return;
    busy.current = true; setMenu(false); bbqPending.current = false;
    const left = place.current.x + w() - 10;
    setPose("off");
    setBbq({ left, width: sceneW, served: false });
    speak(pick(BBQ_START));
    const plateX = left + sceneW * (126 / 170), plateY = GROUND + sceneW * (150 / 170) * (60 / 150);
    window.setTimeout(() => void snagRaid(plateX, plateY), 1800);
    let lastPuff = 0, said = 0;
    await animate(6500, t => {
      const now = performance.now();
      if (now - lastPuff > 140) { lastPuff = now; add({ kind: "smoke", x: plateX + (Math.random() - 0.5) * sceneW * 0.4, y: plateY, size: 14 + Math.random() * 14 + t * 10 }); }
      if (t > 0.2 && said === 0) { said = 1; speak(pick(BBQ_COOKING)); add({ kind: "burst", x: plateX - 50, y: plateY + 40, size: 0, text: "SIZZLE!" }); }
      if (t > 0.75 && said === 1) { said = 2; speak(pick(BBQ_DONE)); }
    });
    setBbq(current => current && { ...current, served: true });
    speak(pick(BBQ_SERVED));
    add({ kind: "burst", x: plateX - 60, y: plateY + 50, size: 0, text: "SNAG SANGA!" });
    await later(3800);
    // Dinner's eaten, the straps are empty, back on the bike.
    setBbq(null); setTrophies([]); trophyCount.current = 0;
    setPose("ride");
    speak("Right. Back on the Night Train.");
    busy.current = false;
  }
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (bbqPending.current && phaseRef.current === "parked" && !busy.current) void barbie();
    }, 600);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase !== "parked") return;
    let carTimer = 0, killTimer = 0;
    const nextCar = () => { carTimer = window.setTimeout(() => { spawnCar(); nextCar(); }, 9000 + Math.random() * 16000); };
    const nextKill = () => { killTimer = window.setTimeout(() => { spawnKill(); nextKill(); }, 12000 + Math.random() * 18000); };
    nextCar(); nextKill();
    return () => { clearTimeout(carTimer); clearTimeout(killTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // Blow straight through a stop sign, then turn round and let it have both barrels.
  async function runStopSign(fromUser = false) {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    setMenu(false);
    const w = bike.current.offsetWidth, x0 = place.current.x, goRight = x0 < window.innerWidth / 2;
    const signX = goRight ? Math.min(window.innerWidth - 150, x0 + w + 90) : Math.max(90, x0 - 150);
    setSign({ x: signX, holes: 0, down: false });
    speak(pick(STOP_LINES));
    await later(900);
    await rideTo(goRight ? signX + w + 60 : signX - 110);
    if (busy.current) return;
    busy.current = true;
    const k = s(), x = place.current.x, faceLeft = signX < x;
    setFacingLeft(faceLeft); setPose("shotgun");
    await later(400);
    const muzzle = faceLeft ? x + (VIEW_W - 192) * k : x + 192 * k, muzzleY = GROUND + (VIEW_H - 42) * k;
    for (let shot = 1; shot <= 2; shot++) {
      add({ kind: "burst", x: muzzle - 40, y: muzzleY + 10, size: 0, text: "BLAM!" });
      for (let i = 0; i < 5; i++) add({ kind: "smoke", x: muzzle + (faceLeft ? -i * 8 : i * 8), y: muzzleY, size: 14 + i * 5 });
      place.current = { ...place.current, tilt: faceLeft ? 3 : -3 }; draw();
      setSign(current => current && { ...current, holes: shot, down: shot === 2 });
      if (shot === 1) speak(pick(BLAST_LINES));
      await later(160);
      place.current = { ...place.current, tilt: 0 }; draw();
      await later(700);
    }
    setPose("ride"); setFacingLeft(false);
    window.setTimeout(() => setSign(null), 2500);
    busy.current = false;
    // Shooting up public property tends to attract attention.
    if (fromUser && Math.random() < 0.7) { await later(1200); await copChase(); }
  }

  // Shoot-the-cops mini game. A popup explains the rules; once it's closed, every click
  // fires the sawn-off. The cop car drives her exact line a beat behind. Six hits and it goes up.
  async function copChase() {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    busy.current = true; setMenu(false); setBurning(true); setLine(null);
    const k = s(), w = bike.current.offsetWidth, copW = window.innerWidth < 640 ? 160 : 210, copH = copW * 0.42;
    setCop(true); setWreck(false);
    damageRef.current = 0; setCopDamage(0);
    await later(50);
    let copX = -copW - 30, lastCopX = copX, copSpin = 0, x = place.current.x, curLeft = false;
    const moveCop = (px: number) => {
      const el = copCar.current; if (!el) return;
      const dir = px < lastCopX - 0.5 ? -1 : px > lastCopX + 0.5 ? 1 : 0;
      el.style.transform = `translateX(${px}px) rotate(${copSpin}deg)`;
      if (dir) (el.firstElementChild as HTMLElement | null)?.style.setProperty("transform", dir < 0 ? "scaleX(-1)" : "none");
      lastCopX = px; copX = px;
    };
    moveCop(copX);
    add({ kind: "burst", x: 20, y: GROUND + 130, size: 0, text: "WEE-OO WEE-OO!" });
    add({ kind: "burst", x: place.current.x, y: VIEW_H * k + GROUND + 40, size: 0, text: pick(["Shit! Cops!", "The fuzz!", "Coppers!"]) });
    // Cop pulls up behind her, lights going, while the rules pop up.
    const parkCop = Math.max(10, Math.min(x - copW - 40, window.innerWidth * 0.3));
    await animate(1300, t => moveCop(-copW - 30 + (parkCop + copW + 30) * (1 - Math.pow(1 - t, 2))));
    await new Promise<void>(resolve => { gameStart.current = resolve; setGamePrompt(true); });

    // Game on: sawn-off out the whole time, click anywhere to fire.
    setPose("shotgun"); setGame(true);
    let lastShot = 0;
    shootRef.current = () => {
      const now = performance.now();
      if (now - lastShot < 260 || damageRef.current >= 6) return;
      lastShot = now;
      const target = copX + copW / 2, faceLeft = target < x + w / 2;
      setFacingLeft(faceLeft);
      window.setTimeout(() => setFacingLeft(curLeft), 380);
      const muzzle = faceLeft ? x + (VIEW_W - 192) * k : x + 192 * k, muzzleY = GROUND + (VIEW_H - 42) * k, aimY = GROUND + 30 + copH / 2;
      add({ kind: "burst", x: muzzle - (faceLeft ? 70 : 10), y: muzzleY + 14, size: 0, text: "BLAM!" });
      for (let i = 0; i < 3; i++) add({ kind: "smoke", x: muzzle + (faceLeft ? -i * 9 : i * 9), y: muzzleY, size: 12 + i * 6 });
      // Three pellets; the first one to land counts as the hit.
      for (let i = 0; i < 3; i++) add({ kind: "bullet", x: muzzle, y: muzzleY, size: 0, dx: target - muzzle + (Math.random() - 0.5) * 40, dy: muzzleY - aimY + (Math.random() - 0.5) * 18, hit: i === 0 });
      place.current = { ...place.current, tilt: faceLeft ? 4 : -4 }; draw();
    };
    const trail: { at: number; x: number }[] = [];
    const LAG = 900, START = performance.now(), LENGTH = 120_000;
    let lastPuff = 0, lastShout = 0;
    const exhaustAt = (px: number, left: boolean) => px + (left ? VIEW_W - 16 : 16) * k;
    const rearAt = (px: number, left: boolean) => px + (left ? VIEW_W - 60 : 60) * k;
    while (performance.now() - START < LENGTH && phaseRef.current === "parked" && damageRef.current < 6) {
      let target = x;
      for (let i = 0; i < 10 && Math.abs(target - x) < window.innerWidth * 0.3; i++) target = 10 + Math.random() * (window.innerWidth - w - 20);
      const left = target < x, x0 = x;
      curLeft = left; setFacingLeft(left);
      add({ kind: "skid", x: rearAt(x0, left) - 25 * k, y: GROUND + 5 * k, size: 50 * k });
      for (let i = 0; i < 4; i++) add({ kind: "tyre", x: rearAt(x0, left) + (Math.random() - 0.5) * 30, y: GROUND + 4, size: 30 + Math.random() * 24 });
      if (Math.random() < 0.3) add({ kind: "burst", x: Math.max(10, x0 - 40), y: VIEW_H * k + GROUND + 40, size: 0, text: pick(CHASE_LINES) });
      if (Math.random() < 0.3) spawnCar();
      // Slower legs than a normal ride, so he's got time to line up shots.
      await animate(Math.abs(target - x0) * 2.4 + 500, t => {
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, now = performance.now();
        x = x0 + (target - x0) * e;
        place.current = weave(t, x, (left ? 1 : -1) * Math.sin(t * Math.PI) * 5, 60);
        trail.push({ at: now, x });
        while (trail.length > 2 && trail[1].at <= now - LAG) trail.shift();
        if (trail[0].at <= now - LAG) moveCop(trail[0].x - (left ? -1 : 1) * 30);
        else moveCop(copX + (x - copX) * 0.02);
        if (now - lastPuff > 80) { lastPuff = now; add({ kind: "smoke", x: exhaustAt(x, left), y: GROUND + (VIEW_H - 128) * k, size: 14 + Math.random() * 10 }); }
        if (damageRef.current >= 3 && Math.random() < 0.15) add({ kind: "smoke", x: copX + copW * 0.85, y: GROUND + 70, size: 16 + damageRef.current * 4 });
        if (now - lastShout > 3500) { lastShout = now; add({ kind: "burst", x: copX + 10, y: GROUND + 150, size: 0, text: pick(COP_SHOUTS) }); }
      }, () => damageRef.current >= 6);
    }
    shootRef.current = null; setGame(false); setPose("ride"); setFacingLeft(false);
    place.current = { x, tilt: 0, pivot: 60 }; draw();
    if (damageRef.current >= 6) { await copsCooked(copX, copW); return; }
    // Ran out of time: the cop overcooks a U-turn and spins out. She's gone.
    add({ kind: "burst", x: copX, y: GROUND + 150, size: 0, text: "SPUN OUT!" });
    await animate(1400, t => {
      copSpin = t * 720; moveCop(copX + Math.sin(t * Math.PI) * 40);
      if (Math.random() < 0.4) add({ kind: "tyre", x: copX + copW / 2 + (Math.random() - 0.5) * copW, y: GROUND + 6, size: 30 + Math.random() * 30 });
    });
    setAtX(x); speak("See ya later, Constable Plod!");
    const x0 = x, end = window.innerWidth + 160;
    await animate(1800, t => {
      const px = x0 + (end - x0) * t * t * t, now = performance.now();
      place.current = weave(t, px, -Math.min(14, t * 50), 60);
      if (now - lastPuff > 45) { lastPuff = now; add({ kind: "smoke", x: exhaustAt(px, false), y: GROUND + (VIEW_H - 128) * k, size: 16 + Math.random() * 12 }); }
    });
    setCop(false); setBurning(false);
    await later(1400);
    setPhase("hidden");
    busy.current = false;
    await arrive();
    speak(pick(ESCAPE_LINES));
  }
  // A pellet landed on the cop car.
  const bulletLanded = (item: Fx) => {
    remove(item.id);
    if (!item.hit || !shootRef.current) return;
    damageRef.current += 1; setCopDamage(damageRef.current);
    add({ kind: "burst", x: item.x + (item.dx || 0) - 30, y: item.y - (item.dy || 0) + 20, size: 0, text: pick(["PING!", "PANG!", "CLUNK!", "TINK!"]) });
  };

  // Six hits: KA-BOOM, slowly. X-ray skeleton flash, then two singed cops leg it. Then new ink.
  async function copsCooked(copX: number, copW: number) {
    setFacingLeft(false); setPose("ride");
    const cx = copX + copW / 2;
    speak("Right. Hold me stubby.");
    // A beat of dread: the car shudders and smokes first.
    for (let i = 0; i < 8; i++) { add({ kind: "smoke", x: cx + (Math.random() - 0.5) * copW * 0.8, y: GROUND + 40 + Math.random() * 30, size: 24 + i * 5 }); await later(160); }
    add({ kind: "boom", x: cx - 160, y: GROUND + 90, size: 0, text: "KA-BOOM!!" });
    setFireball({ x: cx, bottom: GROUND + 10 }); setFlash(n => n + 1); setWreck(true);
    setCops({ x: cx, bottom: GROUND + 40, look: "xray" });
    for (let i = 0; i < 18; i++) add({ kind: "smoke", x: cx + (Math.random() - 0.5) * copW, y: GROUND + 30 + Math.random() * 60, size: 40 + Math.random() * 60 });
    await later(1700);
    setCops(current => current && { ...current, look: "singed" });
    add({ kind: "burst", x: cx - 60, y: GROUND + 170, size: 0, text: "MUUUUUM!" });
    speak("Oops. Bit much? Nah.");
    await later(2400);
    setFireball(null);
    // The wreck burns for a bit.
    for (let i = 0; i < 12; i++) { add({ kind: "smoke", x: cx + (Math.random() - 0.5) * copW * 0.7, y: GROUND + 40, size: 30 + Math.random() * 30 }); await later(220); }
    setCop(false); setCops(null); setWreck(false); setBurning(false);
    await later(600);
    await tattooTime();
    busy.current = false;
  }

  // Reds vs Blues: both clubs ride in, fifteen seconds of cartoon punch-up in a dust cloud
  // with junk flying everywhere, then the blue leader loses his mullet to the guillotine.
  async function bikieBrawl() {
    if (phaseRef.current !== "parked" || busy.current) return;
    busy.current = true; setMenu(false);
    speak("Reds versus Blues. Righto, let's have it, ya blue mongrels!");
    setBrawl("rideIn");
    await later(2400);
    setBrawl("fight"); setLine(null);
    const cx = window.innerWidth / 2, cloudY = GROUND + 60;
    const started = performance.now();
    let i = 0;
    while (performance.now() - started < 15_000 && phaseRef.current === "parked") {
      // Junk flies out of the cloud in every direction.
      const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * Math.min(520, window.innerWidth * 0.45));
      add({ kind: "junk", x: cx + (Math.random() - 0.5) * 80, y: cloudY + 40 + Math.random() * 60, size: 0, dx, dy: cloudY + 60 - GROUND, arc: -(100 + Math.random() * 160), text: pick(JUNK) });
      if (i % 3 === 0) add({ kind: "burst", x: cx - 160 + Math.random() * 260, y: cloudY + 90 + Math.random() * 110, size: 0, text: pick(BRAWL_HITS) });
      if (i % 2 === 0) { const p = pick(PAIRS); add({ kind: "tyre", x: cx + p.at + Math.random() * 40, y: GROUND + p.row, size: 26 + Math.random() * 20 }); }
      if (i % 4 === 0) { const n = Math.floor(Math.random() * PAIRS.length); setKnocked(`${Math.random() < 0.5 ? "r" : "b"}${n}`); add({ kind: "stars", x: cx + PAIRS[n].at - 10, y: GROUND + PAIRS[n].row + 70, size: 0, text: "★ ✦ ★" }); }
      if (i === 8 || i === 40) spawnCar();
      if (i % 12 === 0) { setPose(pick<ShazzPose>(["flip", "drink", "ride", "flip"])); }
      i++;
      await later(220);
    }
    setPose("ride"); setKnocked(null);
    setBrawl("guillotine");
    speak("Blue leader. The mullet's gotta go.");
    await later(2200);
    setBrawl("chop");
    add({ kind: "boom", x: cx - 150, y: GROUND + 200, size: 0, text: "SHWING!" });
    await later(700);
    add({ kind: "burst", x: cx - 220, y: GROUND + 150, size: 0, text: "OI OI OI!" });
    add({ kind: "burst", x: cx + 40, y: GROUND + 130, size: 0, text: "HOORAY!" });
    speak("Business at the front, NOTHING at the back. Reds win, ya drongos!");
    setPose("flip");
    await later(3800);
    setPose("ride"); setBrawl(null);
    busy.current = false;
  }

  // She rings the boys; fifty bikes rumble past in formation for about ten seconds.
  async function callBackup() {
    if (phaseRef.current !== "parked" || busy.current) return;
    busy.current = true; setMenu(false);
    setPose("phone");
    add({ kind: "burst", x: place.current.x + 40, y: VIEW_H * s() + GROUND + 30, size: 0, text: "RING RING" });
    speak("Oi, it's Shazz. Bring the boys. All of 'em.");
    await later(2200);
    setPose("ride");
    setConvoy(n => n + 1);
    speak("Here they come! That's me boys, ya mongrels!");
    for (let i = 0; i < 10; i++) {
      await later(1000);
      if (i % 2 === 0) add({ kind: "burst", x: Math.random() * (window.innerWidth - 200), y: GROUND + 150 + Math.random() * 40, size: 0, text: pick(["BRAAAP!", "VROOOM!", "POTATO POTATO", "YEOOO!"]) });
      if (i === 5) setPose("flip");
      if (i === 7) setPose("ride");
    }
    await later(800);
    setConvoy(0);
    speak("Ride safe, boys!");
    busy.current = false;
  }

  // Off the bike, onto the stool: second teardrop. Then a cheeky pat and a big slap.
  async function tattooTime() {
    const w = bike.current?.offsetWidth || 200, sceneW = Math.round(w * 1.05);
    if (place.current.x + w + sceneW + 10 > window.innerWidth) { busy.current = false; await rideTo(window.innerWidth * 0.3); busy.current = true; }
    const left = place.current.x + w - 10, k = s();
    setAtX(place.current.x); setPose("off");
    setTattoo({ left, width: sceneW, stage: "inking" });
    speak("Two teardrops now. Ink me up, love.");
    for (let i = 0; i < 4; i++) { add({ kind: "burst", x: left + sceneW * 0.3, y: GROUND + sceneW * 0.62, size: 0, text: "BZZZZ" }); await later(750); }
    setTeardrops(2);
    setTattoo(current => current && { ...current, stage: "done" });
    speak("Ohh, she's a beauty.");
    await later(1600);
    setTattoo(current => current && { ...current, stage: "pat" });
    add({ kind: "burst", x: left + sceneW * 0.5, y: GROUND + sceneW * 0.55, size: 0, text: "*pat pat*" });
    await later(1000);
    setTattoo(current => current && { ...current, stage: "slap" });
    add({ kind: "boom", x: left - 30, y: GROUND + VIEW_H * k * 0.4, size: 0, text: "SLAP!!" });
    speak("…Worth it.");
    await later(2800);
    setTattoo(null); setPose("ride");
    speak("And that's a wrap, ya ratbags.");
  }

  // Click a passing car and she lassoes it with a chain, holds it, then lets it go.
  const [lasso, setLasso] = useState<{ carId: number; x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [heldCar, setHeldCar] = useState<number | null>(null);
  async function lassoCar(carId: number, el: HTMLElement) {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    busy.current = true; setMenu(false);
    const k = s(), box = el.getBoundingClientRect();
    const handX = place.current.x + 86 * k, handY = window.innerHeight - (GROUND + (VIEW_H - 12) * k);
    setPose("throw");
    setHeldCar(carId);
    setLasso({ carId, x1: handX, y1: handY, x2: box.left + box.width / 2, y2: box.top + box.height * 0.35 });
    add({ kind: "burst", x: box.left + box.width / 2 - 40, y: window.innerHeight - box.top + 10, size: 0, text: "YOINK!" });
    speak(pick(LASSO_LINES));
    await later(2600);
    setLasso(null); setHeldCar(null); setPose("ride");
    speak("Nah, go on, piss off. Drive safe!");
    busy.current = false;
  }
  async function binChickenRaid(killId: number) {
    const kill = killsRef.current.find(item => item.id === killId);
    if (!kill || ibisBusy.current) return;
    ibisBusy.current = true;
    setKills(list => list.map(item => (item.id === killId ? { ...item, claimed: true } : item)));
    const fromRight = kill.x > window.innerWidth / 2;
    const start = fromRight ? window.innerWidth + 20 : -100, target = kill.x - 4;
    const walkMs = Math.max(1500, Math.abs(target - start) * 9);
    setIbis({ x: start, ms: 0, faceLeft: fromRight, stage: "walk", carrying: null, line: null });
    await later(60);
    setIbis(current => current && { ...current, x: target, ms: walkMs });
    await later(walkMs);
    setIbis(current => current && { ...current, stage: "grab" });
    await later(700);
    setKills(list => list.filter(item => item.id !== killId));
    setIbis(current => current && { ...current, carrying: kill.kind, line: pick(IBIS_LINES) });
    if (phaseRef.current === "parked" && !busy.current) speak(pick(["Oi! That's MY dinner, ya bin chicken!", "Get back here with me roo, ya feathered bastard!", "Bloody bin chickens. Nothing's sacred."]));
    await later(7000);
    // Turn round and wander off the way it came, dinner in beak (still muttering).
    setIbis(current => current && { ...current, stage: "leave", faceLeft: !fromRight, x: start, ms: walkMs });
    await later(walkMs + 100);
    setIbis(null);
    ibisBusy.current = false;
  }
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (ibisBusy.current) return;
      const stale = killsRef.current.find(item => !item.claimed && Date.now() - item.bornAt > IBIS_AFTER_MS);
      if (stale) void binChickenRaid(stale.id);
    }, 4000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => {
      // A loose group of 2-4 flying together, slightly staggered.
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, base = 170 + Math.random() * Math.max(80, window.innerHeight * 0.4), ms = 6500 + Math.random() * 3000;
      const group = 2 + Math.floor(Math.random() * 3);
      setFlyers(list => [...list, ...Array.from({ length: group }, (_, i) => ({ id: ++uid, dir, bottom: base + (i % 2 ? 36 : -14) * Math.ceil(i / 2), ms: ms + i * 220, delay: i * 260 }))]);
      next();
    }, 20_000 + Math.random() * 25_000); };
    next();
    return () => clearTimeout(timer);
  }, [phase]);

  // A flock drops onto the wheelie bin, rummages for a bit, then takes off together.
  async function flockVisit() {
    if (flockBusy.current) return;
    flockBusy.current = true;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, bx = binX();
    const spots = [
      { x: bx - 8, bottom: BIN_BOTTOM + BIN_H - 12, onBin: true },
      { x: bx + 18, bottom: BIN_BOTTOM + BIN_H - 12, onBin: true },
      { x: bx - 72, bottom: BIN_BOTTOM - 6, onBin: false },
      { x: bx - 40, bottom: BIN_BOTTOM - 10, onBin: false },
      { x: bx + BIN_W + 6, bottom: BIN_BOTTOM - 8, onBin: false },
      { x: bx + BIN_W + 40, bottom: BIN_BOTTOM - 4, onBin: false },
    ].slice(0, FLOCK_SIZE);
    const offX = (i: number) => (dir === 1 ? -140 - i * 60 : window.innerWidth + 60 + i * 60);
    setFlock({ dir, stage: "in", birds: spots.map((sp, i) => ({ x: offX(i), bottom: window.innerHeight * (0.55 + (i % 3) * 0.1), ms: 0, onBin: sp.onBin })) });
    await later(60);
    setFlock(fl => fl && { ...fl, birds: spots.map((sp, i) => ({ ...sp, ms: 2400 + i * 260 })) });
    await later(2400 + FLOCK_SIZE * 260);
    setFlock(fl => fl && { ...fl, stage: "landed" });
    add({ kind: "burst", x: bx - 40, y: BIN_BOTTOM + BIN_H + 50, size: 0, text: "SQUAWK SQUAWK!" });
    if (phaseRef.current === "parked" && !busy.current) speak(pick(FLOCK_LINES));
    // Rubbish flies out of the bin while they dig.
    for (let i = 0; i < 7; i++) {
      await later(1100);
      add({ kind: "junk", x: bx + BIN_W / 2, y: BIN_BOTTOM + BIN_H, size: 0, dx: (Math.random() - 0.5) * 260, dy: BIN_H + 10, arc: -(60 + Math.random() * 80), text: pick(BIN_JUNK) });
    }
    // Everyone up at once, off the far side.
    setFlock(fl => fl && { ...fl, stage: "out", birds: fl.birds.map((b, i) => ({ ...b, x: dir === 1 ? window.innerWidth + 80 + i * 50 : -160 - i * 50, bottom: window.innerHeight * (0.6 + (i % 3) * 0.08), ms: 2600 + i * 180 })) });
    await later(2600 + FLOCK_SIZE * 180 + 200);
    setFlock(null);
    flockBusy.current = false;
  }
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { void flockVisit(); next(); }, 35_000 + Math.random() * 35_000); };
    timer = window.setTimeout(() => { void flockVisit(); next(); }, 12_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A drop bear falls out of a gum tree, lands with a thud, snarls, and bolts for the bush.
  async function dropBearAttack() {
    if (dropBusy.current) return;
    dropBusy.current = true;
    const tree = pick(treeSpots());
    const x = tree.x + TREE_W * 0.55, top = TREE_BOTTOM + TREE_H * 0.62;
    setDropBear({ x, bottom: top, ms: 0, ease: "ease-in", faceLeft: false });
    await later(80);
    setDropBear(d => d && { ...d, bottom: GROUND + 6, ms: 650 });
    await later(650);
    add({ kind: "burst", x: x - 30, y: GROUND + 70, size: 0, text: "THUD!" });
    for (let i = 0; i < 4; i++) add({ kind: "tyre", x: x + (Math.random() - 0.5) * 40, y: GROUND + 6, size: 20 + Math.random() * 16 });
    await later(500);
    add({ kind: "burst", x: x - 50, y: GROUND + 100, size: 0, text: "RAAARGH!" });
    if (phaseRef.current === "parked" && !busy.current) speak(pick(DROP_LINES));
    await later(1400);
    const toLeft = x < window.innerWidth / 2;
    setDropBear(d => d && { ...d, faceLeft: toLeft, x: toLeft ? -80 : window.innerWidth + 40, ms: 1600, ease: "cubic-bezier(.5,0,.8,.6)" });
    await later(1700);
    setDropBear(null);
    dropBusy.current = false;
  }
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { void dropBearAttack(); next(); }, 45_000 + Math.random() * 45_000); };
    timer = window.setTimeout(() => { void dropBearAttack(); next(); }, 35_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Sportsbikes scream past like the cars, faster.
  function spawnSportbike() {
    const lane: "far" | "near" = Math.random() < 0.5 ? "far" : "near", dir: 1 | -1 = lane === "far" ? 1 : -1;
    setSportbikes(list => [...list, { id: ++uid, dir, lane, color: pick(SPORTBIKE_COLORS), ms: 1900 + Math.random() * 900 }]);
    add({ kind: "burst", x: dir === 1 ? 20 : window.innerWidth - 220, y: (lane === "far" ? FAR_LANE : GROUND) + 70, size: 0, text: "NEEEEOWWW!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.4) window.setTimeout(() => speak(pick(SPORTBIKE_LINES)), 900);
  }

  // A roo hops out in front of a family wagon: BONK. Roo becomes roadkill, car limps off dented.
  async function rooStrike() {
    if (strikeBusy.current) return;
    strikeBusy.current = true;
    const rooX = Math.round(window.innerWidth * (0.4 + Math.random() * 0.2)), carW = window.innerWidth < 640 ? 150 : 200;
    const impactCarX = rooX - carW * 0.93, runIn = 2400;
    setStrike({ carX: -carW - 20, carMs: 0, color: pick(CAR_COLORS), dented: false, rooX, rooBottom: 150, rooMs: 0, rooGone: false, shaking: false });
    await later(60);
    setStrike(st => st && { ...st, carX: impactCarX, carMs: runIn, rooBottom: FAR_LANE + 8, rooMs: runIn });
    await later(runIn);
    add({ kind: "boom", x: rooX - 120, y: FAR_LANE + 110, size: 0, text: "BONK!" });
    add({ kind: "splat", x: rooX, y: FAR_LANE + 10, size: 46 });
    add({ kind: "rooFly", x: rooX, y: FAR_LANE + 20, size: 0, dx: 160 + Math.random() * 120, dy: FAR_LANE + 20 - GROUND, arc: -130 });
    setStrike(st => st && { ...st, dented: true, rooGone: true, shaking: true });
    if (phaseRef.current === "parked" && !busy.current) speak(pick(STRIKE_LINES));
    for (let i = 0; i < 6; i++) { add({ kind: "smoke", x: impactCarX + carW * 0.92, y: FAR_LANE + 50, size: 18 + i * 5 }); await later(160); }
    setStrike(st => st && { ...st, shaking: false, carX: window.innerWidth + 40, carMs: 6000 });
    await later(6100);
    setStrike(null);
    strikeBusy.current = false;
  }
  const rooLanded = (item: Fx) => {
    remove(item.id);
    const x = Math.max(20, Math.min(window.innerWidth - 90, item.x + (item.dx || 0) - 36));
    setKills(list => [...list, { id: ++uid, kind: "roo", x, bornAt: Date.now() }]);
  };

  // Drop bears lower down on a web thread from the gum trees, dangle a bit, and climb back up.
  function spawnDangler() {
    const tree = pick(treeSpots());
    const x = tree.x + TREE_W * (0.3 + Math.random() * 0.4), top = window.innerHeight - (TREE_BOTTOM + TREE_H * 0.78);
    setDanglers(list => [...list, { id: ++uid, x, top, ms: 7000 + Math.random() * 3000 }]);
  }

  // Hoop snakes roll across the road.
  function spawnSnake() {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    setSnakes(list => [...list, { id: ++uid, dir, ms: 4200 + Math.random() * 1500, bottom: GROUND + 4 + Math.random() * 30 }]);
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.5) window.setTimeout(() => speak(pick(SNAKE_LINES)), 1000);
  }

  // Dazza the bludger wanders up for a durry and a few bucks, then cops a drop bear.
  async function dazzaVisit() {
    if (dazzaBusy.current) return;
    dazzaBusy.current = true;
    const tree = pick(treeSpots());
    const standX = tree.x + TREE_W * 0.35, fromRight = standX > window.innerWidth / 2;
    const start = fromRight ? window.innerWidth + 20 : -80;
    const walkMs = Math.max(2500, Math.abs(standX - start) * 7);
    setDazza({ x: start, ms: 0, faceLeft: fromRight, pose: "walk", bear: false, line: null, bearTop: null });
    await later(60);
    setDazza(d => d && { ...d, x: standX, ms: walkMs });
    await later(walkMs);
    setDazza(d => d && { ...d, pose: "ask", line: pick(DAZZA_ASKS) });
    await later(4500);
    if (phaseRef.current === "parked" && !busy.current) speak(pick(SHAZZ_TO_DAZZA));
    await later(3500);
    // Drop bear straight onto his head from the gum above.
    setDazza(d => d && { ...d, line: null, bearTop: window.innerHeight - (TREE_BOTTOM + TREE_H * 0.7) });
    await later(80);
    setDazza(d => d && { ...d, bearTop: window.innerHeight - (GROUND + 118) });
    await later(600);
    add({ kind: "burst", x: standX - 40, y: GROUND + 150, size: 0, text: "THUD!" });
    setDazza(d => d && { ...d, bear: true, bearTop: null, pose: "run", line: "AAARGH! DROP BEAR! GET IT OFF!" });
    await later(1400);
    if (phaseRef.current === "parked" && !busy.current) speak(pick(["Told ya not to stand under the gum tree, Dazza!", "Ha! Karma, ya bludger!", "Vegemite behind the ears next time, Dazza!"]));
    const exit = fromRight ? window.innerWidth + 40 : -100;
    setDazza(d => d && { ...d, faceLeft: !fromRight, x: exit, ms: 1800 });
    await later(1900);
    setDazza(null);
    dazzaBusy.current = false;
  }

  useEffect(() => {
    if (phase !== "parked") return;
    const timers: number[] = [];
    const every = (first: number, min: number, spread: number, run: () => void) => {
      const next = () => { timers.push(window.setTimeout(() => { run(); next(); }, min + Math.random() * spread)); };
      timers.push(window.setTimeout(() => { run(); next(); }, first));
    };
    every(9_000, 12_000, 13_000, spawnSportbike);
    every(50_000, 70_000, 50_000, () => void rooStrike());
    every(15_000, 25_000, 20_000, spawnDangler);
    every(28_000, 35_000, 35_000, spawnSnake);
    every(40_000, 50_000, 40_000, () => void dazzaVisit());
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function rooMob() {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, count = 4 + Math.floor(Math.random() * 3), ms = 5500 + Math.random() * 2000;
    // Spread them across the back of the road; bigger ones are "closer".
    setRoos(list => [...list, ...Array.from({ length: count }, (_, i) => {
      const size = 62 + Math.random() * 30;
      return { id: ++uid, dir, size, bottom: 104 - (size - 62) * 0.8 + (i % 2) * 10, ms: ms + (Math.random() - 0.5) * 900, delay: i * 380 + Math.random() * 200, hop: 520 + Math.random() * 140, joey: i === 1 };
    })]);
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) window.setTimeout(() => speak(pick(ROO_LINES)), 1200);
  }
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { rooMob(); next(); }, 30_000 + Math.random() * 35_000); };
    timer = window.setTimeout(() => { rooMob(); next(); }, 22_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // During the barbie: one swoops in, nicks a snag off the plate, and flaps off with it.
  async function snagRaid(plateX: number, plateBottom: number) {
    const w = 84;
    setRaider({ x: window.innerWidth + 40, bottom: window.innerHeight * 0.65, ms: 0, faceLeft: true, carrying: null });
    await later(60);
    setRaider(r => r && { ...r, x: plateX - w * 0.9, bottom: plateBottom, ms: 1600 });
    await later(1600);
    add({ kind: "burst", x: plateX - 60, y: plateBottom + 70, size: 0, text: "SQUAWK!" });
    setBbq(current => current && { ...current, stolen: Math.min(3, (current.stolen || 0) + 1) });
    setRaider(r => r && { ...r, carrying: "snag" });
    speak(pick(["OI! Get off me snags, ya flying rat!", "That's MY snag, ya bin-diving mongrel!", "Bloody bin chicken! That was the good one!"]));
    await later(650);
    setRaider(r => r && { ...r, x: -160, bottom: window.innerHeight * 0.75, ms: 1900 });
    await later(2000);
    setRaider(null);
  }
  const smash = (item: Fx) => {
    remove(item.id);
    const x = item.x + (item.dx || 0);
    add({ kind: "burst", x: x - 30, y: GROUND + 30, size: 0, text: "SMASH!" });
    for (let i = 0; i < 9; i++) add({ kind: "shard", x, y: GROUND + 6, size: 4 + Math.random() * 6, dx: (Math.random() - 0.5) * 90, dy: -(Math.random() * 26) });
  };

  const arrive = useCallback(async () => {
    if (phaseRef.current !== "hidden") { if (phaseRef.current === "parked") say(); return; }
    const w = window.innerWidth < 640 ? 150 : 210, k = w / VIEW_W;
    setWidth(w); setPhase("enter"); setPose("ride"); void loadAi();
    const park = window.innerWidth - w - 16;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { place.current = { x: park, tilt: 0, pivot: 60 }; draw(); }
    else {
      const start = -w - 80; let lastPuff = 0, lastRear: number | null = null, screeched = false;
      await animate(1900, t => {
        const x = start + (park - start) * (1 - Math.pow(1 - t, 3));
        const braking = t > 0.5, now = performance.now();
        // Braking dips the nose over the front wheel and shakes a little.
        place.current = weave(t, x, braking ? 3 * (1 - t) * 2 + Math.sin(t * 90) * 0.6 : 0, 205);
        if (now - lastPuff > 60) {
          lastPuff = now;
          add({ kind: "smoke", x: x + 16 * k, y: GROUND + (VIEW_H - 128) * k, size: 14 + Math.random() * 10 });
          if (braking) add({ kind: "tyre", x: x + 60 * k, y: GROUND + 4, size: 24 + Math.random() * 16 });
        }
        if (braking) {
          const rear = x + 60 * k;
          if (!screeched) { screeched = true; add({ kind: "burst", x: x + 80 * k, y: VIEW_H * k + GROUND + 20, size: 0, text: "SCREEECH!" }); }
          if (lastRear !== null && rear > lastRear) add({ kind: "skid", x: lastRear, y: GROUND + 5 * k, size: rear - lastRear + 1 });
          lastRear = rear;
        }
      });
      await animate(250, t => { place.current = { x: place.current.x, tilt: 1.2 * (1 - t), pivot: 205 }; });
    }
    setAtX(park); setPhase("parked"); say();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, loadAi, say]);

  async function leave(mute = false) {
    if (phaseRef.current !== "parked" || busy.current) return;
    setLine(null); lineQueue.current = []; setMenu(false); setPhase("leave"); setPose("ride");
    if (mute) { setMuted(true); try { localStorage.setItem("day-out-smartarse-muted", "1"); } catch { /* ignore */ } }
    const k = s();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const x0 = place.current.x, rear = x0 + 60 * k; let lastPuff = 0;
      add({ kind: "burst", x: x0 - 20, y: VIEW_H * k * 0.6 + GROUND, size: 0, text: "BRAAAP!" });
      add({ kind: "skid", x: rear - 30 * k, y: GROUND + 5 * k, size: 44 * k });
      // Burnout on the spot, then a wheelie off the right-hand side.
      await animate(800, t => {
        place.current = { x: x0 + Math.sin(t * 120) * 1.5, tilt: 0, pivot: 60 };
        const now = performance.now();
        if (now - lastPuff > 40) { lastPuff = now; add({ kind: "tyre", x: rear - 10 + Math.random() * 20, y: GROUND + 2, size: 28 + Math.random() * 22 }); }
      });
      const end = window.innerWidth + 120; let lastRear = rear;
      await animate(1400, t => {
        const x = x0 + (end - x0) * t * t * t, now = performance.now();
        place.current = weave(t, x, -Math.min(16, t * 60) * (t < 0.8 ? 1 : (1 - t) * 5), 60);
        if (now - lastPuff > 50) { lastPuff = now; add({ kind: "smoke", x: x + 16 * k, y: GROUND + (VIEW_H - 128) * k, size: 16 + Math.random() * 12 }); }
        const r = x + 60 * k;
        if (t < 0.35 && r > lastRear) { add({ kind: "skid", x: lastRear, y: GROUND + 5 * k, size: r - lastRear + 1 }); lastRear = r; }
      });
    }
    place.current = { x: -500, tilt: 0, pivot: 60 }; draw();
    setKills([]); setIbis(null); ibisBusy.current = false; setBbq(null); setFlyers([]); setRaider(null); setFlock(null); flockBusy.current = false; setRoos([]); setDropBear(null); dropBusy.current = false; setSportbikes([]); setStrike(null); strikeBusy.current = false; setDanglers([]); setSnakes([]); setDazza(null); dazzaBusy.current = false; setTattoo(null); setConvoy(0); setBrawl(null);
    setPhase("hidden");
  }

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("day-out-smartarse-muted") === "1");
      setClean(localStorage.getItem("day-out-smartarse-clean") !== "0");
    } catch { setMuted(false); }
    const onResize = () => {
      if (phaseRef.current !== "parked" || !bike.current) return;
      place.current.x = Math.min(place.current.x, window.innerWidth - bike.current.offsetWidth - 8); draw(); setAtX(place.current.x);
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(frame.current); };
  }, [draw]);
  useEffect(() => {
    if (muted !== false) return;
    const first = window.setTimeout(arrive, FIRST_DELAY);
    const repeat = window.setInterval(() => { if (phaseRef.current === "hidden") void arrive(); }, GAP);
    return () => { clearTimeout(first); clearInterval(repeat); };
  }, [muted, arrive]);
  useEffect(() => {
    if (!summon) return;
    setMuted(false);
    try { localStorage.removeItem("day-out-smartarse-muted"); } catch { /* ignore */ }
    void arrive();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summon]);
  function toggleClean() {
    setClean(value => { try { localStorage.setItem("day-out-smartarse-clean", value ? "0" : "1"); } catch { /* ignore */ } return !value; });
  }

  const onRoad = phase !== "hidden" || fx.some(item => item.kind === "skid" || item.kind === "shard");
  const actions: [Action, string][] = [["drink", "🍺 Crack a tinnie"], ["flip", "🖕 Flip us off"], ["moon", "🍑 Show us ya arse"], ["smoke", "🚬 Light a durry"], ["throw", "🍾 Chuck a bottle"]];
  return <div className={`${styles.stage} ${convoy ? styles.rumble : ""}`}>
    <div className={`${styles.road} ${onRoad ? styles.roadOn : ""} ${phase === "parked" ? styles.roadClickable : ""}`} onClick={event => void rideTo(event.clientX)} title={phase === "parked" ? "Click to move Shazz here" : undefined} />
    {cars.map(car => <span key={car.id} className={`${styles.car} ${car.turnAt !== undefined ? styles.carTurn : ""} ${phase === "parked" ? styles.carClickable : ""} ${heldCar === car.id ? styles.carHeld : ""}`}
      onClick={event => void lassoCar(car.id, event.currentTarget)} title={phase === "parked" ? "Lasso it!" : undefined} onAnimationEnd={event => event.target === event.currentTarget && setCars(list => list.filter(item => item.id !== car.id))}
      style={{ bottom: car.lane === "far" ? FAR_LANE : GROUND + 2, width: car.width, height: car.width * 0.45, animationDuration: `${car.ms}ms`, ["--from" as string]: `${car.dir === 1 ? -car.width : window.innerWidth}px`, ["--to" as string]: `${car.dir === 1 ? window.innerWidth : -car.width}px`, ["--stop" as string]: `${car.turnAt ?? 0}px` }}>
      <span className={car.lane === "near" && car.turnAt === undefined ? styles.carSwerve : styles.carFlip} style={car.lane === "near" && car.turnAt === undefined ? { animationDelay: `${Math.max(0, car.shockAt - 650)}ms` } : undefined}>
        <span className={styles.carFlip} style={{ transform: car.dir === -1 ? "scaleX(-1)" : undefined }}><span className={styles.carBody}><FamilyCar color={car.color} /></span></span>
      </span>
      <span className={styles.carShock} style={{ animationDelay: `${car.shockAt}ms` }}>!!</span>
    </span>)}
    {brawl && <div className={styles.brawl} aria-hidden>
      {/* Each club's bikes ride in, then stay parked on their side of the road */}
      {Array.from({ length: 8 }, (_, i) => <span key={`rb${i}`} className={`${styles.gangBike} ${brawl === "rideIn" ? styles.gangInLeft : ""}`}
        style={{ left: `calc(50% - ${300 + Math.floor(i / 2) * 62 + (i % 2) * 28}px)`, bottom: i % 2 ? 50 : 68, animationDelay: `${(i % 4) * 0.08}s` }}><MiniBiker seed={i} gang="red" riderless={brawl !== "rideIn"} /></span>)}
      {Array.from({ length: 8 }, (_, i) => <span key={`bb${i}`} className={`${styles.gangBike} ${brawl === "rideIn" ? styles.gangInRight : ""}`}
        style={{ left: `calc(50% + ${212 + Math.floor(i / 2) * 62 + (i % 2) * 28}px)`, bottom: i % 2 ? 50 : 68, animationDelay: `${(i % 4) * 0.08}s` }}><span className={styles.facingLeft}><MiniBiker seed={i + 20} gang="blue" riderless={brawl !== "rideIn"} /></span></span>)}
      {/* The punch-up, in full view */}
      {brawl === "fight" && PAIRS.map((pair, i) => <span key={`pair${i}`}>
        <span className={`${styles.brawler} ${knocked === `r${i}` ? styles.knockedRed : ""}`} style={{ left: `calc(50% + ${pair.at - 38}px)`, bottom: pair.row }}><Brawler gang="red" seed={i} weapon={RED_WEAPONS[i]} /></span>
        <span className={`${styles.brawler} ${knocked === `b${i}` ? styles.knockedBlue : ""}`} style={{ left: `calc(50% + ${pair.at + 4}px)`, bottom: pair.row }}><span className={styles.facingLeft}><Brawler gang="blue" seed={i + 3} weapon={BLUE_WEAPONS[i]} /></span></span>
      </span>)}
      {/* Reds celebrate round the guillotine */}
      {(brawl === "guillotine" || brawl === "chop") && [0, 1, 2, 3].map(i => <span key={`c${i}`} className={`${styles.brawler} ${styles.cheer}`}
        style={{ left: `calc(50% - ${130 + i * 42}px)`, bottom: i % 2 ? 40 : 22, animationDelay: `${i * 0.1}s` }}><Brawler gang="red" seed={i} /></span>)}
      {(brawl === "guillotine" || brawl === "chop") && <span className={styles.guillotine}><Guillotine chopped={brawl === "chop"} /></span>}
    </div>}
    {convoy > 0 && <div key={convoy} className={styles.convoy} aria-hidden>
      {Array.from({ length: 50 }, (_, i) => <span key={i} className={styles.convoyBike} style={{ left: Math.floor(i / 2) * 78 + (i % 2) * 34, bottom: i % 2 ? 50 : 66, animationDelay: `${(i % 7) * 0.07}s` }}><MiniBiker seed={i} /></span>)}
    </div>}
    {sign && <span className={`${styles.stopSign} ${sign.down ? styles.stopSignDown : ""}`} style={{ left: sign.x, bottom: 44 }}><StopSign holes={sign.holes} /></span>}
    {bbq && <span className={styles.bbq} style={{ left: bbq.left, bottom: GROUND - 2, width: bbq.width, height: bbq.width * (150 / 170) }}><BbqScene served={bbq.served} stolen={bbq.stolen} /></span>}
    {raider && <span className={styles.raider} style={{ left: raider.x, bottom: raider.bottom, transitionDuration: `${raider.ms}ms` }} aria-hidden>
      <span className={styles.ibisBody} style={{ transform: raider.faceLeft ? "scaleX(-1)" : undefined }}><BinChicken flying carrying={raider.carrying} /></span>
    </span>}
    {phase !== "hidden" && treeSpots().map((t, i) => (
      <span key={i} className={styles.gumTree} style={{ left: t.x, bottom: TREE_BOTTOM, width: TREE_W, height: TREE_H }} aria-hidden><GumTree koala={t.koala} variant={i} /></span>
    ))}
    {danglers.map(d => <span key={d.id} className={styles.dangler} style={{ left: d.x, top: d.top, animationDuration: `${d.ms}ms` }} aria-hidden
      onAnimationEnd={event => event.target === event.currentTarget && setDanglers(list => list.filter(x => x.id !== d.id))}>
      <svg className={styles.web} viewBox="-12 -12 24 24" aria-hidden><path d="M-10 0 H10 M0 -10 V10 M-7 -7 L7 7 M7 -7 L-7 7" stroke="#fff" strokeWidth="0.6" opacity="0.8" /><circle r="4" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.8" /><circle r="8" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.6" /></svg>
      <span className={styles.danglerThread} style={{ animationDuration: `${d.ms}ms` }}><span className={styles.danglerBear}><DropBear /></span></span>
    </span>)}
    {dropBear && <span className={styles.dropBear} aria-hidden
      style={{ left: dropBear.x - 24, bottom: dropBear.bottom, transitionDuration: `${dropBear.ms}ms`, transitionTimingFunction: dropBear.ease }}>
      <span className={styles.ibisBody} style={{ transform: dropBear.faceLeft ? "scaleX(-1)" : undefined }}><DropBear /></span>
    </span>}
    {strike && <span className={styles.strikeCar} aria-hidden
      style={{ left: strike.carX, bottom: FAR_LANE, width: window.innerWidth < 640 ? 150 : 200, height: (window.innerWidth < 640 ? 150 : 200) * 0.45, transitionDuration: `${strike.carMs}ms` }}>
      <span className={`${styles.carBody} ${strike.shaking ? styles.carShake : ""}`}><FamilyCar color={strike.color} dented={strike.dented} /></span>
      {strike.dented && <span className={styles.carShock} style={{ animationDelay: "0ms" }}>!!</span>}
    </span>}
    {strike && !strike.rooGone && <span className={styles.strikeRoo} aria-hidden style={{ left: strike.rooX, bottom: strike.rooBottom, transitionDuration: `${strike.rooMs}ms`, ["--hop" as string]: "480ms" }}>
      <span className={styles.rooHop}><span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><Kangaroo /></span></span>
    </span>}
    {snakes.map(sn => <span key={sn.id} className={styles.hoopSnake} aria-hidden onAnimationEnd={event => event.target === event.currentTarget && setSnakes(list => list.filter(x => x.id !== sn.id))}
      style={{ bottom: sn.bottom, animationDuration: `${sn.ms}ms`, ["--from" as string]: `${sn.dir === 1 ? -60 : window.innerWidth + 10}px`, ["--to" as string]: `${sn.dir === 1 ? window.innerWidth + 10 : -60}px` }}>
      <span className={styles.snakeBounce}><span className={sn.dir === 1 ? styles.snakeRollRight : styles.snakeRollLeft}><HoopSnake /></span></span>
    </span>)}
    {sportbikes.map(b => <span key={b.id} className={styles.car} aria-hidden onAnimationEnd={event => event.target === event.currentTarget && setSportbikes(list => list.filter(x => x.id !== b.id))}
      style={{ bottom: b.lane === "far" ? FAR_LANE + 4 : GROUND + 4, width: 110, height: 60, animationDuration: `${b.ms}ms`, ["--from" as string]: `${b.dir === 1 ? -120 : window.innerWidth}px`, ["--to" as string]: `${b.dir === 1 ? window.innerWidth : -120}px` }}>
      <span className={`${styles.carFlip} ${styles.moving}`} style={{ transform: b.dir === -1 ? "scaleX(-1)" : undefined }}><SportBike color={b.color} /></span>
    </span>)}
    {dazza && <span className={styles.dazza} aria-hidden style={{ left: dazza.x, bottom: GROUND + 2, transitionDuration: `${dazza.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: dazza.faceLeft ? "scaleX(-1)" : undefined }}><Bludger pose={dazza.pose} /></span>
      {dazza.bear && <span className={styles.bearOnHead}><DropBear /></span>}
      {dazza.line && <span className={styles.ibisBubble}>{dazza.line}</span>}
    </span>}
    {dazza && dazza.bearTop !== null && <span className={styles.fallingBear} aria-hidden style={{ left: dazza.x + 8, top: dazza.bearTop }}><DropBear /></span>}
    {roos.map(r => <span key={r.id} className={styles.roo} aria-hidden onAnimationEnd={event => event.target === event.currentTarget && setRoos(list => list.filter(x => x.id !== r.id))}
      style={{ bottom: r.bottom, width: r.size, height: r.size * 0.9, animationDuration: `${r.ms}ms`, animationDelay: `${r.delay}ms`, ["--from" as string]: `${r.dir === 1 ? -r.size - 20 : window.innerWidth + 20}px`, ["--to" as string]: `${r.dir === 1 ? window.innerWidth + 20 : -r.size - 20}px`, ["--hop" as string]: `${r.hop}ms` }}>
      <span className={styles.rooHop}><span className={styles.ibisBody} style={{ transform: r.dir === -1 ? "scaleX(-1)" : undefined }}><Kangaroo joey={r.joey} /></span></span>
    </span>)}
    {phase !== "hidden" && <span className={styles.wheelieBin} style={{ left: binX(), bottom: BIN_BOTTOM, width: BIN_W, height: BIN_H }} aria-hidden><WheelieBin rattling={flock?.stage === "landed"} /></span>}
    {flock && flock.birds.map((b, i) => (
      <span key={i} className={`${styles.flockBird} ${flock.stage === "landed" ? (b.onBin ? styles.ibisRummage : styles.ibisWalking) : ""}`} aria-hidden
        style={{ left: b.x, bottom: b.bottom, transitionDuration: `${b.ms}ms` }}>
        <span className={styles.ibisBody} style={{ transform: (flock.stage === "landed" ? (b.x > binX() + BIN_W / 2) : flock.dir === -1) ? "scaleX(-1)" : undefined }}>
          <BinChicken flying={flock.stage !== "landed"} />
        </span>
      </span>
    ))}
    {flyers.map(fl => <span key={fl.id} className={styles.flyer} aria-hidden onAnimationEnd={event => event.target === event.currentTarget && setFlyers(list => list.filter(x => x.id !== fl.id))}
      style={{ bottom: fl.bottom, animationDuration: `${fl.ms}ms`, animationDelay: `${fl.delay}ms`, ["--from" as string]: `${fl.dir === 1 ? -120 : window.innerWidth + 40}px`, ["--to" as string]: `${fl.dir === 1 ? window.innerWidth + 40 : -120}px` }}>
      <span className={styles.flyerBob}><span className={styles.ibisBody} style={{ transform: fl.dir === -1 ? "scaleX(-1)" : undefined }}><BinChicken flying /></span></span>
    </span>)}
    {fireball && <span className={styles.fireball} style={{ left: fireball.x, bottom: fireball.bottom }}><span className={styles.fireCore} /></span>}
    {cop && <span ref={copCar} className={styles.copCar} style={{ bottom: GROUND + 30, width: window.innerWidth < 640 ? 160 : 210, height: (window.innerWidth < 640 ? 160 : 210) * 0.42, transform: "translateX(-400px)" }}><span className={styles.copFlip}><PoliceCar damage={copDamage} wrecked={wreck} /></span></span>}
    {cops && <span className={styles.copsFlee} style={{ left: cops.x - 40, bottom: cops.bottom }}>
      <span className={styles.copMan}><CopFigure look={cops.look} /></span>
      <span className={styles.copMan} style={{ animationDelay: "0.12s" }}><CopFigure look={cops.look} /></span>
    </span>}
    {tattoo && <span className={styles.bbq} style={{ left: tattoo.left, bottom: GROUND - 2, width: tattoo.width, height: tattoo.width * (150 / 190) }}><TattooScene stage={tattoo.stage} /></span>}
    {kills.map(kill => <button key={kill.id} className={styles.roadkill} style={{ left: kill.x, bottom: GROUND - 2 }} disabled={kill.claimed} onClick={() => void collect(kill.id)}
      aria-label={`Dead ${CRITTER_NAMES[kill.kind]} on the road. Send Shazz to grab it for dinner`} title="Dinner! Click to send Shazz">
      <RoadKill kind={kill.kind} />
    </button>)}
    {ibis && <span className={`${styles.ibis} ${ibis.stage === "grab" ? styles.ibisPecking : styles.ibisWalking}`}
      style={{ left: ibis.x, bottom: GROUND - 2, transitionDuration: `${ibis.ms}ms` }} aria-hidden>
      <span className={styles.ibisBody} style={{ transform: ibis.faceLeft ? "scaleX(-1)" : undefined }}><BinChicken carrying={ibis.carrying} /></span>
      {ibis.line && <span className={styles.ibisBubble}>{ibis.line}</span>}
    </span>}
    {fx.map(item => {
      if (item.kind === "fog") return null;
      if (item.kind === "rubber") return <span key={item.id} className={styles.rubber} style={{ left: item.x, bottom: item.y, width: item.size, height: item.size * 0.6, ["--dx" as string]: `${item.dx}px`, ["--dy" as string]: `${item.dy}px` }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "splat") return <span key={item.id} className={styles.splat} style={{ left: item.x - item.size / 2, bottom: item.y, width: item.size, height: item.size * 0.45 }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "rooFly") return <span key={item.id} className={styles.bottleX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && rooLanded(item)}>
        <span className={styles.bottleY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -110}px` }}><span className={styles.rooTumble}><Kangaroo /></span></span>
      </span>;
      if (item.kind === "junk") return <span key={item.id} className={styles.bottleX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && remove(item.id)}>
        <span className={styles.bottleY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -110}px` }}><span className={styles.junk}>{item.text}</span></span>
      </span>;
      if (item.kind === "bullet") return <span key={item.id} className={styles.bullet} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px`, ["--dy" as string]: `${item.dy}px`, ["--angle" as string]: `${Math.atan2(item.dy || 0, item.dx || 1)}rad` }} onAnimationEnd={() => bulletLanded(item)} />;
      if (item.kind === "burst" || item.kind === "stars" || item.kind === "boom") return <span key={item.id} className={styles[item.kind]} style={{ left: item.x, bottom: item.y }} onAnimationEnd={() => remove(item.id)}>{item.text}</span>;
      if (item.kind === "bottle") return <span key={item.id} className={styles.bottleX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && smash(item)}>
        <span className={styles.bottleY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -110}px` }}><span className={styles.bottle} /></span>
      </span>;
      if (item.kind === "shard") return <span key={item.id} className={styles.shard} style={{ left: item.x, bottom: item.y, width: item.size, height: item.size, ["--dx" as string]: `${item.dx}px`, ["--dy" as string]: `${item.dy}px` }} onAnimationEnd={() => remove(item.id)} />;
      return <span key={item.id} className={styles[item.kind]} onAnimationEnd={() => remove(item.id)}
        style={item.kind === "skid" ? { left: item.x, bottom: item.y, width: item.size } : { left: item.x - item.size / 2, bottom: item.y - item.size / 2, width: item.size, height: item.size }} />;
    })}
    {wall && <span className={styles.wall} style={{ left: wall.left, bottom: GROUND - 2, width: wall.width, height: wall.height }} />}
    <button ref={bike} className={`${styles.shazz} ${phase === "enter" || phase === "leave" || moving || burning ? styles.moving : ""} ${talking ? styles.talking : ""}`}
      style={{ width, height, bottom: GROUND, visibility: phase === "hidden" ? "hidden" : "visible", transform: "translateX(-500px)" }}
      onClick={() => phase === "parked" && void act(pick(actions)[0])} tabIndex={phase === "parked" ? 0 : -1} aria-label="Big Shazz. Poke her and see what happens">
      <span style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}><span className={drunk ? styles.wobble : ""} style={{ ["--wobble" as string]: `${Math.min(drunk, 3) * 2.5}deg` }}><BikerShazz pose={pose} drunk={drunk} trophies={trophies} teardrops={teardrops} /></span></span>
    </button>
    <div ref={smokeCloud} className={styles.smokeCloud} />
    {fx.filter(item => item.kind === "fog").map(item => <span key={item.id} className={styles.fog} style={{ left: item.x - item.size / 2, bottom: item.y - item.size / 2, width: item.size, height: item.size }} />)}
    {lasso && <svg className={styles.chain} width="100%" height="100%" aria-hidden>
      <line x1={lasso.x1} y1={lasso.y1} x2={lasso.x2} y2={lasso.y2} stroke="#111" strokeWidth={7} strokeLinecap="round" />
      <line x1={lasso.x1} y1={lasso.y1} x2={lasso.x2} y2={lasso.y2} stroke="#c9ced6" strokeWidth={4} strokeDasharray="7 4" strokeLinecap="round" className={styles.chainLinks} />
      <ellipse cx={lasso.x2} cy={lasso.y2} rx={34} ry={12} fill="none" stroke="#c9ced6" strokeWidth={4} strokeDasharray="7 4" />
    </svg>}
    {flash > 0 && <div key={flash} className={styles.flash} />}
    {game && <div className={styles.shootZone} onPointerDown={() => shootRef.current?.()}>
      <div className={styles.gameHud}>
        <span>Shoot the cop car!</span>
        <span className={styles.hits}>{Array.from({ length: 6 }, (_, i) => <i key={i} className={i < copDamage ? styles.hitOn : ""} />)}</span>
        <small>Click anywhere to fire</small>
      </div>
    </div>}
    {gamePrompt && <div className={styles.gamePrompt} role="dialog" aria-modal="true" aria-labelledby="cop-game-title">
      <div>
        <p className={styles.gamePromptBadge}>🚓 WEE-OO WEE-OO</p>
        <h2 id="cop-game-title">The cops are on Shazz's tail!</h2>
        <p>You must shoot the cop car to get rid of it. Once you close this, click anywhere to fire the sawn-off. Six hits and it's toast.</p>
        <button autoFocus onClick={() => { setGamePrompt(false); gameStart.current(); }}>Lock and load 🔫</button>
      </div>
    </div>}
    {finger && <div className={styles.bigFinger} style={{ left: finger.left, bottom: finger.bottom }} role="img" aria-label="Shazz gives you the finger">
      <BigFinger />
      <p>{clean ? bleep("Yeah cunt! What a ripper!") : "Yeah cunt! What a ripper!"}</p>
    </div>}
    {phase === "parked" && !moving && line && (() => {
      const bubbleW = Math.min(320, window.innerWidth - 32), head = atX + 118 * scale;
      const left = Math.max(16, Math.min(window.innerWidth - bubbleW - 16, head - bubbleW + 60));
      return <aside key={line.text} className={styles.bubble} style={{ left, width: bubbleW, bottom: height + GROUND + 14 }} role="status" aria-live="polite" onClick={() => { setLine(null); lineShownAt.current = 0; drainQueue(); }}>
        <p>{clean ? bleep(line.text) : line.text}</p>
        <span className={styles.bubbleTail} style={{ left: Math.max(16, Math.min(bubbleW - 42, head - left - 13)) }} />
      </aside>;
    })()}
    {phase !== "hidden" && meter && <div className={styles.drunkMeter} role="meter" aria-label="Shazz's drunk meter" aria-valuemin={0} aria-valuemax={FALL_AT} aria-valuenow={drunk}>
      <span className={styles.drunkLabel}>Drunk-o-meter: <b>{DRUNK_LABELS[Math.min(drunk, FALL_AT)]}</b></span>
      <span className={styles.drunkTrack}><span className={styles.drunkFill} style={{ width: `${(Math.min(drunk, FALL_AT) / FALL_AT) * 100}%` }} /></span>
      <span className={styles.drunkCans} aria-hidden>{Array.from({ length: FALL_AT }, (_, i) => <span key={i} className={i < drunk ? styles.canFull : ""}>🍺</span>)}</span>
    </div>}
    {phase === "parked" && <div className={styles.trickBar}>
      <button className={styles.trickToggle} onClick={() => setMenu(open => !open)} aria-expanded={menu} aria-label="Shazz's tricks and settings">{menu ? "✕" : "🤘"}</button>
      {menu && <>
        <Trick label="🔥 Burnout" onClick={() => void burnout()} />
        <Trick label="🛑 Run a stop sign" onClick={() => void runStopSign(true)} />
        <Trick label="🚓 Cop chase" onClick={() => void copChase()} />
        <Trick label="📱 Call for backup" onClick={() => void callBackup()} />
        <Trick label="🥊 Reds vs Blues brawl" onClick={() => void bikieBrawl()} />
        {actions.map(([action, label]) => <Trick key={action} label={label} onClick={() => void act(action)} />)}
        <span className={styles.trickDivider} />
        <Trick label="💬 Another one" onClick={say} />
        <Trick label={clean ? "🤬 Full swearing" : "🤐 Bleep swearing"} onClick={toggleClean} />
        <Trick label="👋 Yeah, righto" onClick={() => void leave()} />
        <Trick label="🖐️ Piss off, Shazz" onClick={() => void leave(true)} />
      </>}
    </div>}
  </div>;
}
