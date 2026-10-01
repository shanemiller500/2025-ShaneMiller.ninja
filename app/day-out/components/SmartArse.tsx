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
import OldNev from "./OldNev";
import TrueBlue, { Pelican, type TrueBluePose } from "./TrueBlue";
import Emu, { EmuLeg } from "./Emu";
import Shopfronts from "./Shopfronts";
import LiveCritter from "./LiveCritter";
import SlitherSnake from "./SlitherSnake";
import PostieBike from "./PostieBike";
import KidBike from "./KidBike";
import Magpie from "./Magpie";
import Crow from "./Crow";
import Lorikeet from "./Lorikeet";
import Trev from "./Trev";
import Kylie from "./Kylie";
import FireCan from "./FireCan";
import Dynamite from "./Dynamite";
import RaveCop from "./RaveCop";
import PaddyWagon from "./PaddyWagon";
import { HillsHoist, Esky, Boombox, WobbleBoard } from "./RaveGear";
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
// The road is ROAD_H tall (matches .road in the CSS); FAR_LANE is the back lane.
const ROAD_H = 150, FAR_LANE = 86;
const CAR_COLORS = ["#2e7dd1", "#e0a100", "#c0392b", "#27ae60", "#8e44ad", "#e8e8e8"];
const CAR_LINES = ["Oi! Eyes on the road, ya dag!", "What are youse lookin' at?!", "Wind the window up, Karen!", "Take a photo, it'll last longer, ya drongos!", "Bloody tourists.", "Yeah, you heard me, Dad. Keep drivin'!"];
const KILL_LINES: Record<Critter, string[]> = {
  emu: ["Emu drumsticks tonight! Well. Drumstick.", "They won the war in '32. Not this one.", "Big bird, bigger barbie."],
  snake: ["Hoop snake! Tastes like chicken. Rolls like a wheel.", "Flat as a tack. Easy to pack, too.", "Snake on the barbie. Put that on a postcard."],
  roo: ["Beauty! Roo snags tonight!", "Skippy's comin' home with me, ya larrikin.", "Fresh roo. Only been there since Tuesday."],
  koala: ["Drop bear down! Koala curry, anyone?", "Smells like eucalyptus. Pre-seasoned!", "Don't tell the tourists, ya great sook."],
  croc: ["Croc! That's a handbag AND dinner.", "Who's a tough nut now, ya big handbag?", "Tastes like chicken. Angry chicken."],
  wombat: ["Wombat! Square poo, square meal.", "Built like a brick shithouse. Feeds six.", "Wombat stew. Nan's recipe, ya galah."],
};
const CRITTER_NAMES: Record<Critter, string> = { roo: "roo", koala: "koala", croc: "croc", wombat: "wombat", snake: "hoop snake", emu: "emu" };
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
const PAIRS = [{ at: -270, row: 20 }, { at: -115, row: 48 }, { at: 40, row: 20 }, { at: 195, row: 48 }];
// Where the blue bikes park (px right of centre), and how they end up in the pile.
const BLUE_AT = (i: number) => 300 + Math.floor(i / 2) * 90 + (i % 2) * 40;
const PILE_X = 320, PILE_ROT = [-20, 15, -35, 25, -10, 40, -25, 10];
const RED_WEAPONS = ["🍳", undefined, "🏓", "🐔"], BLUE_WEAPONS = ["🩴", "🌭", undefined, "🎸"];
const BRAWL_HITS = ["POW!", "BIFF!", "WHACK!", "KAPOW!", "BONK!", "THWACK!", "OOF!", "CRUNCH!"];
// Left on the road for a minute, roadkill gets nicked by a bin chicken.
const IBIS_AFTER_MS = 60_000;
const IBIS_LINES = ["Squawk. Finders keepers.", "Mine now. MINE.", "Five second rule, ya bogans.", "Bin chicken's eating good tonight.", "Honk. Don't mind me.", "I've eaten worse out of a Maccas bin.", "Shh. I was never here."];
// Bin chicken flock: they land on (and around) the wheelie bin at the back of the road.
const BIN_BOTTOM = 138, BIN_W = 56, BIN_H = 75, FLOCK_SIZE = 6;
const BIN_JUNK = ["🍌", "🥡", "🍕", "📰", "🥤", "🍟", "🦴", "🧃"];
const FLOCK_LINES = ["Check out those white pointers!!", "Oi, the bin chicken union's having a meeting.", "Look at 'em. Feathered bogans, the lot of 'em.", "Get outta that bin, ya filthy animals!", "Six of 'em. SIX. It's an infestation, ya galahs."];
const ROO_LINES = ["Skippy and the boys, off to the pub.", "Oi! Don't jump in front of the Night Train!", "Look at 'em go. Built like brick dunnies.", "That big buck's eyeing me off. Come at me, Skip!", "Roo mob! Hide the snags."];
// Gum trees along the back of the road (as fractions of the screen width); koalas in some.
// Roadside gums: clear of the bus shelter in the shop strip (roughly 28-43% across).
const TREES = [{ at: 0.19, koala: true }, { at: 0.62, koala: false }, { at: 0.88, koala: true }];
const TREE_BOTTOM = 142;
// Gum tree size: big on desktop, cut down on phones so it doesn't swallow the screen.
const TREE = {
  get W() { return typeof window !== "undefined" && isPhone() ? 130 : 170; },
  get H() { return typeof window !== "undefined" && isPhone() ? 236 : 310; },
};
const DROP_LINES = ["DROP BEAR! Vegemite behind the ears, quick!", "Bloody drop bears. Tourists reckon they're a myth, the dills.", "That's why ya never park under a gum tree, ya galah.", "Get back up ya tree, ya feral little mongrel!"];
const RED_BIKE = "#dc2626";
const RED_BIKE_LINES = ["Jesus! Was that a bike or a bloody comet?!", "Red ones go faster. Everyone knows that, ya drongo.", "Slow down, Rossi! Ya'll be a hood ornament!", "Blink and ya missed him. Organ donor on wheels.", "That red one's got more speeding fines than brains."];
const SPORTBIKE_COLORS = ["#16a34a", RED_BIKE, "#2563eb", "#f59e0b", "#e5e7eb", "#7c3aed"];
const SPORTBIKE_LINES = ["Plastic fantastic! Get a real bike, ya muppet!", "Listen to that sewing machine scream.", "Nice pyjamas, ya Power Ranger!", "Hairdryer on wheels, that one.", "Knees on the ground, brain in the bin."];
const STRIKE_LINES = ["Oof! Skippy's had a bad day. Dinner's sorted, though.", "Should've got a roo bar, ya galah!", "That's why ya don't drive at dusk, ya dill.", "Poor bastard. The roo, not the car."];
const SNAKE_LINES = ["HOOP SNAKE! Lift ya feet, ya galah!", "Rolled right past me, the cheeky mongrel.", "Seen bigger hoop snakes at the Ekka.", "Never trust a snake that bites its own arse."];
const DAZZA_ASKS = ["Oi, spare a durry, love?", "Got a couple o' bucks for the bus? I'm a bit short.", "Couldn't bum a smoke off ya, could I? I'll pay ya back Tuesday."];
const SPLAT_LINES = ["Ooh, flattened. Dinner's sorted.", "Didn't even brake, the mongrel. Mine now.", "Pancaked! Somebody fetch me a spatula.", "Road's provided again. Cheers, mate.", "That's the Bruce Highway diet, that is."];
const ANIMAL_SHOT_LINES = ["Dinner's served, ya beauty!", "Bang! Straight in the esky.", "Yeehaw! Tea's sorted.", "Shoulda stayed in the bush, mate.", "One for the barbie!"];
const PEST_SHOT_LINES = ["Take that, ya feral!", "Swoop on THAT, ya mongrel!", "Get back to the bush, ya ratbag!", "Not so tough now, are ya?"];
const SNAKE_SPLAT_LINES = ["Ha! Should've hooped up quicker, ya dill.", "Hoop snake? More like hoop FLAT.", "Snake on a plate. I'll allow it."];
const POSTIE_LINES = ["G'day postie! Anything but bills, ya legend.", "Oi postie! If that's another speeding fine, burn it!", "Only Honda I'll ever respect, the postie bike.", "Beep beep, ya legend. Mind the roadkill."];
const MAGPIE_LINES = ["SWOOPING SEASON! Pedal, kid, PEDAL!", "Cable ties on the helmet won't save ya, mate!", "Magpies. The real apex predator of Queensland.", "Wave ya arms, kid, it only makes 'em angrier! Ha!"];
const KID_SCREAMS = ["AAAAH! MAGPIES!", "MUUUM! THEY'RE GETTIN' ME!", "NOT THE HELMET! NOT THE HELMET!"];
const CROW_LINES = ["Here come the crows. Nature's cleanup crew.", "Oi! Get off me dinner, ya feathered goths!", "Crows. The undertakers of the Bruce Highway.", "Look at 'em. Like bikies at a buffet."];
const LORIKEET_LINES = ["Rainbow lorikeets! Noisy little drunks, they are.", "Twenty lorikeets and not one of 'em can shut up.", "Look at 'em. Dressed like a Mardi Gras float.", "They get pissed on fermented nectar, ya know. My kinda bird."];
const POOP_CAR_LINES = ["HA! Bombed ya roof, mate!", "Bin chicken special, right on the car!", "Direct hit! Wipers on, ya dill!", "That's gonna bake on nice in this sun."];
const POOP_SHAZZ_LINES = ["OI! Ya flamin' bin chicken just crapped on me!", "Right on the Night Train! I'll wring ya scrawny neck!", "That's meant to be lucky. Lucky me arse."];
// Old droppings around the wheelie bin: ground splotches (x offset from the bin, size) and
// streaks down the front of the bin (x offset, length).
const BIN_POOP = [[-58, 12], [-34, 9], [-14, 14], [6, 8], [30, 11], [52, 13], [70, 9], [92, 12], [-44, 7], [80, 7]];
const BIN_DRIPS = [[9, 26], [21, 14], [33, 34], [44, 18]];
const TREV_PEEK = ["Psst... anyone usin' that?", "Don't mind me. Just... lookin'. Just lookin'.", "Is that a roo? That's a roo. That's MY roo.", "Nobody's watchin'. Nobody's watchin'. Nobody's—"];
const TREV_GRAB = ["Finders keepers, sweet as, sweet as, sweet as!", "Never saw me! NEVER SAW ME!", "Dinner! Dinner dinner dinner!", "Cheers, love! Owe ya one! Owe ya two!"];
const TREV_SHAZZ = ["OI! Twitchy Trev! Put me roo down!", "How many cans of V have you had today, Trev?!", "Blink, ya weirdo! Ya eyes are gonna fall out!", "Put a bloody shirt on, Trev!"];
const KYLIE_HELLO = ["Babe! BABE! I got one too!", "Trev! Dinner for two, babe!", "Found a beauty, babe! Get the can!"];
const CONSPIRACIES = [
  "Bin chickens are government drones, babe. Why else are they always watchin'?",
  "The moon landing was filmed in Toowoomba. Me cousin held the boom mic.",
  "Drop bears are real. Koalas are just the disguise.",
  "Chemtrails are Vegemite vapour. They're makin' us more Australian.",
  "Birds aren't real, Kyl. They sit on power lines to CHARGE.",
  "Tasmania doesn't exist. Ever met anyone from there? Exactly.",
  "The Big Banana's a radio tower. It talks to the Big Pineapple.",
  "Daylight savings fades the curtains AND ya brain.",
  "The emus won the war 'cause they're lizard people. Obviously.",
  "Magpies swoop ya 'cause they know who ya really are.",
  "Roos can't walk backwards 'cause the government chipped 'em.",
  "Bunnings snags are cooked by the Wi-Fi. Look it up, babe.",
];
const RUN_SHOUTS = ["YOU'LL NEVER TAKE THE TRUTH, COPPA!", "THE BIRDS ARE WATCHIN' YOUSE TOO!", "TASMANIA ISN'T REAL!", "IT'S ALL THE BIG PINEAPPLE!", "SAVE THE DINNER, BABE! SAVE THE DINNER!"];
const COOKOUT_SHAZZ = ["Oh here we go. Trev and Kylie's Kitchen.", "Cookin' roadkill over a paint tin. Classy.", "Don't listen to 'em too long, ya brain'll melt.", "Five-star dining on the Bruce, that."];
const COOKOUT_BUST = ["Ha! Run, ya galahs, RUN!", "Look at 'em go! Dinner held high like the Olympic torch!", "Coppas! Every man and his conspiracy for himself!"];
const RAVE_LINES = ["This is the best night of me LIFE!", "Who brought the goon?! LEGEND!", "Spin the Hills Hoist! Goon of fortune!", "Turn it UP, Dazza!", "I can see sounds, babe. SOUNDS.", "Wobble board solo! WOBBLE BOARD SOLO!", "Birds aren't real and neither is Tuesday!"];
const ZAPPED_LINES = ["BZZZT—AAAAAA!", "NOT THE ZAPPER!", "I'M A SOVEREIGN CITIZEN!", "THE BIRDS TOLD ME TO!", "I KNOW ME RIGHTS! OW!"];
const CUFFED_LINES = ["I want me lawyer! Me mum's a lawyer!", "This is a sovereign doof!", "Mind the mullet, officer!", "Can I at least finish me goon?", "I was just holdin' it for a mate!"];
const RAVE_COP_LINES = ["Party's over, champions.", "Music off. Hands where I can see 'em.", "You have the right to remain silent. I'd use it.", "Tell it to the magistrate, sunshine.", "Nice thongs. In the van.", "Birds aren't real? Neither's ya bail, mate.", "Sovereign citizen? Sovereign of the back seat, more like.", "Next."];
const MISS_LINES = ["Bugger! Missed!", "Sun was in me eyes, alright?!", "That was a warning shot, ya mongrel.", "Too many tinnies. Hold STILL!", "Bloody sights on this thing are bent."];
const BIRD_SHOT_LINES = ["Get stuffed, ya bin chicken!", "Pillow stuffing, anyone?", "Feathers everywhere. Worth it.", "That's for me roo, ya thieving galah!", "Bin chicken nil, sawn-off one."];
// Old Nev's story, one line per click (and now and then when he stops for a breather).
const NEV_LINES = [
  "Have ya seen me boy? Sold him for ten cents at the Sunday markets.",
  "It was 1983. A crazy bloke with a mullet gave me ten cents for him.",
  "He looked a bit like that Shane fella. The one who builds the websites. …Can't be sure.",
  "Could be Shane. Same nose. Same haircut. Same… website.",
  "Best ten cents I ever… worst. WORST ten cents I ever spent.",
  "He'd be in his forties now. Probably building things for his old man.",
];
const PET_LINES: Record<"roo" | "koala" | "wombat" | "dropbear" | "croc", string> = {
  roo: "G'day, Skip! Who's a good roo?",
  koala: "Look at ya, ya little gumnut.",
  wombat: "Hello, ya square-bummed beauty!",
  dropbear: "Easy, mate… easy… there's a good drop bear.",
  croc: "Even you, ya big handbag. Pat pat.",
};
const NEV_SHAZZ = ["Shane? Nah, Shane's dad's the one reading this, Nev.", "Keep lookin', Nev. He'll turn up. They always do when they want money.", "Ten cents? Ya got ripped off, Nev. That bloke got a bargain."];
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
type Fx = { stage?: number; palette?: string[]; id: number; kind: "leg" | "hole" | "poop" | "poopSplat" | "drop" | "feathers" | "smoke" | "tyre" | "skid" | "burst" | "bottle" | "shard" | "stars" | "fog" | "boom" | "rubber" | "bullet" | "junk" | "splat" | "rooFly"; x: number; y: number; size: number; text?: string; dx?: number; dy?: number; arc?: number; hit?: boolean };
// Ids for everything on screen. Seeded from the clock so a hot reload (which re-runs this file
// while the old items are still on screen) can never hand out an id that is already in use.
let uid = Date.now();
// Phones get a wider street than the screen (you swipe along it); desktop uses the screen width.
const PHONE_WORLD = 900;
const isPhone = () => typeof window !== "undefined" && window.innerWidth < 640;
const VW = () => (typeof window === "undefined" ? 1200 : isPhone() ? Math.max(PHONE_WORLD, window.innerWidth) : window.innerWidth);
// Sportsbikes are drawn 110×60; this keeps them road-sized next to the cars and Shazz.
const sportbikeW = () => (isPhone() ? 150 : 205);
// Everything Shazz can take a shot at. Birds and pests go up in a puff; the rest drop as dinner.
type Target = { kind: "flyer"; id: number } | { kind: "flock"; index: number } | { kind: "raider" } | { kind: "ibis" } | { kind: "magpie"; id: number }
  | { kind: "roo"; id: number } | { kind: "crossing"; id: number } | { kind: "snake"; id: number } | { kind: "strikeRoo" }
  | { kind: "dropBear" } | { kind: "dangler"; id: number } | { kind: "koala"; tree: number } | { kind: "lorikeet"; id: number } | { kind: "emu"; id: number };
const FUR: Partial<Record<Target["kind"], string[]>> = {
  roo: ["#b5733a", "#e6c49a"], strikeRoo: ["#b5733a", "#e6c49a"], koala: ["#9aa0a6", "#e8e8e8"], dropBear: ["#8a7f72", "#5b5148"], dangler: ["#8a7f72", "#5b5148"],
  snake: ["#7a5c2e", "#c9a86a"], magpie: ["#111", "#fff", "#111"], emu: ["#5b4636", "#3b2f26", "#7a6048"], lorikeet: ["#16a34a", "#1d4ed8", "#f97316", "#dc2626", "#facc15"],
};
const POSTIE_W = 170, KID_W = 115;
type Crossing = { id: number; kind: Critter; x: number; bottom: number; ms: number; faceLeft: boolean; flat: boolean; done: boolean; lane: "far" | "near" };
type Hitter = { id: number; lane: "far" | "near"; dir: 1 | -1; vehicle: "car" | "bike"; color: string; vx: number; vms: number; vw: number };
type Snake = { id: number; x: number; bottom: number; ms: number; dir: 1 | -1; mode: "slither" | "hoop" | "flat"; done: boolean };
type Kid = { x: number; ms: number; dir: 1 | -1; panic: boolean; line: string | null; magpies: { id: number; ox: number; oy: number; sx: number; sy: number; delay: number }[] };

// `summon` increments each time the "Call Shazz" button is pressed; `dismiss` each time
// "Send Shazz home" is. `onPresence` reports whether she is on screen, so the header button can flip.
export default function SmartArse({ topic, summon, dismiss = 0, onPresence }: { topic: string; summon: number; dismiss?: number; onPresence?: (out: boolean) => void }) {
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
  // `bones`: the crows have picked it clean; it just lies there until something runs it over.
  const [kills, setKills] = useState<{ id: number; kind: Critter; x: number; bottom?: number; bornAt: number; claimed?: boolean; bones?: boolean; bloody?: boolean }[]>([]);
  const [crows, setCrows] = useState<{ id: number; x: number; bottom: number; ms: number; faceLeft: boolean; eating: boolean; peck: number; messy?: boolean }[]>([]);
  // Live critters wandering onto the road, and whatever's about to flatten them.
  const [crossings, setCrossings] = useState<Crossing[]>([]);
  const crossingCount = useRef(0);
  const [hitters, setHitters] = useState<Hitter[]>([]);
  const shotIds = useRef(new Set<number>());
  const strikeRooShot = useRef(false);
  const [shotKoalas, setShotKoalas] = useState<number[]>([]);
  const [postie, setPostie] = useState<{ x: number; ms: number; dir: 1 | -1 } | null>(null);
  const [kid, setKid] = useState<Kid | null>(null);
  // Only one big ambient set piece at a time, with a breather after each.
  const sceneUntil = useRef(0);
  const claimScene = (ms: number, rest = 10_000) => {
    if (Date.now() < sceneUntil.current) return false;
    sceneUntil.current = Date.now() + ms + rest;
    return true;
  };
  // True while a set piece (or the breather after it) is running: extras hold off.
  const sceneActive = () => Date.now() < sceneUntil.current;
  const ibisAlive = useRef(false);
  const [ibis, setIbis] = useState<{ x: number; ms: number; faceLeft: boolean; stage: "walk" | "grab" | "leave"; carrying: Critter | null; line: string | null } | null>(null);
  // Bin chickens just cruising overhead, and the one that raids the barbie.
  const [flyers, setFlyers] = useState<{ id: number; dir: 1 | -1; bottom: number; ms: number; delay: number }[]>([]);
  type FlockBird = { x: number; bottom: number; ms: number; onBin: boolean; shot?: boolean };
  const [flock, setFlock] = useState<{ dir: 1 | -1; stage: "in" | "landed" | "out" | "pass"; birds: FlockBird[] } | null>(null);
  const [binRattle, setBinRattle] = useState(false);
  // Twitchy Trev, who hides behind a gum tree and nicks any roadkill left lying about.
  // Trev and Kylie's roadside cookout (and the coppers breaking it up).
  type Tweaker = { x: number; bottom: number; ms: number; faceLeft: boolean; pose: "peek" | "run" | "cook"; carrying: Critter | null; stick: "none" | "cook" | "up" };
  const [cookout, setCookout] = useState<{ trev: Tweaker; kylie: Tweaker; fireX: number; fireBottom: number; can: "none" | "lit" | "kicked"; kick: 1 | -1; line: { who: "trev" | "kylie"; text: string } | null; cop: { x: number; ms: number; flip: boolean } | null } | null>(null);
  // The bush doof, and the coppers who shut it down.
  type Raver = { id: number; who: "trev" | "kylie"; tint: string; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "dance" | "zapped" | "run" | "cuffed"; line: string | null; board: boolean; tossed: boolean; gone: boolean; scuffle?: boolean; hiding?: boolean };
  type RaveCopState = { id: number; x: number; bottom: number; ms: number; faceLeft: boolean; zap: boolean; walking: boolean; line: string | null; gone: boolean; baton?: boolean };
  type RaveVehicle = { id: number; kind: "car" | "wagon"; w: number; x: number; bottom: number; ms: number; flip: boolean };
  const [rave, setRave] = useState<{ ravers: Raver[]; cops: RaveCopState[]; vehicles: RaveVehicle[]; gear: boolean; lights: boolean } | null>(null);
  // Brawl thieves: Trev nicks a red bike; Kylie nicks a blue bike's back wheel and leaves it on bricks.
  const [thieves, setThieves] = useState<{ trev: { x: number; ms: number; riding: boolean; line: string | null } | null; kylie: { x: number; ms: number; wheel: boolean; line: string | null; leaving?: boolean } | null; stolenRed: boolean; bricked: boolean }>({ trev: null, kylie: null, stolenRed: false, bricked: false });
  const [trev, setTrev] = useState<{ x: number; bottom: number; ms: number; faceLeft: boolean; pose: "peek" | "run"; carrying: Critter | null; line: string | null } | null>(null);
  // Droppings stuck to vehicles: vehicle key ("car-3", "bike-7", "hit-9", "postie") -> x positions (0-1).
  const [poops, setPoops] = useState<Record<string, number[]>>({});
  const lastPoopLine = useRef(0);
  const [lorikeets, setLorikeets] = useState<{ id: number; x: number; bottom: number; ms: number; delay: number; faceLeft: boolean; perched: boolean }[]>([]);
  // Head on fire, Ghost Rider style, while she has a car on the lasso.
  const [flaming, setFlaming] = useState(false);
  // Bin chickens on alert because the mouse is near: index -> which side the cursor is on.
  const [spooked, setSpooked] = useState<Record<number, -1 | 1>>({});
  const [flockHover, setFlockHover] = useState(false);
  const flockBusy = useRef(false);
  // A mob of roos bouncing across behind her now and then.
  const [dropBear, setDropBear] = useState<{ x: number; bottom: number; ms: number; ease: string; faceLeft: boolean } | null>(null);
  const dropBusy = useRef(false);
  // Narrow screens get two trees instead of three.
  // Phones only get the one roadside gum (the right-hand one); there isn't room for three.
  const treeSpots = () => TREES.filter(() => true).map((t) => ({ ...t, x: Math.round(VW() * t.at - TREE.W / 2) }));
  // Traffic and wildlife extras
  const [sportbikes, setSportbikes] = useState<{ id: number; dir: 1 | -1; lane: "far" | "near"; color: string; ms: number }[]>([]);
  const [strike, setStrike] = useState<{ carX: number; carMs: number; color: string; dented: boolean; rooX: number; rooBottom: number; rooMs: number; rooGone: boolean; shaking: boolean } | null>(null);
  const strikeBusy = useRef(false);
  const [danglers, setDanglers] = useState<{ id: number; x: number; top: number; ms: number }[]>([]);
  const [snakes, setSnakes] = useState<Snake[]>([]);
  const [dazza, setDazza] = useState<{ x: number; ms: number; faceLeft: boolean; pose: "walk" | "ask" | "run" | "aim"; bear: boolean; line: string | null; bearTop: number | null } | null>(null);
  const dazzaBusy = useRef(false);
  // Old Nev shuffles up and down the verge looking for his boy.
  const [nev, setNev] = useState<{ x: number; ms: number; faceLeft: boolean; walking: boolean; shaking?: boolean; line: string | null } | null>(null);
  const nevLine = useRef(0);
  // True Blue and his entourage; Gumtree Gary up the right-hand gum.
  const [blue, setBlue] = useState<{ x: number; ms: number; faceLeft: boolean; pose: TrueBluePose; line: string | null; fish: boolean } | null>(null);
  const blueBusy = useRef(false);
  const [blueAnimal, setBlueAnimal] = useState<{ kind: "roo" | "koala" | "wombat" | "dropbear" | "croc"; x: number; ms: number; faceLeft: boolean } | null>(null);
  type PerchBird = { x: number; bottom: number; ms: number; landed: boolean } | null;
  const [blueBirds, setBlueBirds] = useState<{ lori: PerchBird; ibis: PerchBird } | null>(null);
  const [pelican, setPelican] = useState<{ x: number; bottom: number; ms: number; fish: boolean } | null>(null);
  const [roadFish, setRoadFish] = useState<{ x: number } | null>(null);
  const [gary, setGary] = useState<{ mode: "hiding" | "out"; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "dance" | "crawl" | "pee"; carrying: Critter | "fish" | null; fish: boolean; line: string | null } | null>(null);
  const garyBusy = useRef(false);
  // A tree tweaker down on the road having a go at the crows over a carcass.
  const [fighter, setFighter] = useState<{ who: "trev" | "kylie" | "gary"; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "dance"; carrying: Critter | null; scuffle: boolean; line: string | null } | null>(null);
  // A tweaker clicked out of their tree for a five-second boogie.
  const [boogie, setBoogie] = useState<{ who: "trev" | "kylie" | "gary"; x: number; line: string } | null>(null);
  // Emus: each takes two shots. `hits` 1 = one leg gone, hopping slower.
  const [emus, setEmus] = useState<{ id: number; dir: 1 | -1; x: number; bottom: number; size: number; ms: number; hits: number }[]>([]);
  const [roos, setRoos] = useState<{ id: number; dir: 1 | -1; bottom: number; size: number; ms: number; delay: number; hop: number; joey: boolean }[]>([]);
  const binX = () => Math.max(24, Math.round(VW() * 0.1));
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
  const [brawl, setBrawl] = useState<"rideIn" | "fight" | "guillotine" | "chop" | "kick" | "dynamite" | "boom" | null>(null);
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
  // She talks less: nothing while she's in the middle of something (brawls, chases, tricks), and
  // otherwise only now and then, at random, with a decent gap. `force` is for when she's asked.
  const lastSpoke = useRef(0);
  // On phones the scene scrolls sideways inside this; panX() is how far it's been swiped.
  const scroller = useRef<HTMLDivElement>(null);
  const [phoneView, setPhoneView] = useState(false);
  const panX = () => scroller.current?.scrollLeft ?? 0;
  const sRect = (el: Element) => {
    const r = el.getBoundingClientRect(), dx = panX();
    return { left: r.left + dx, right: r.right + dx, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  // Swipe the phone view so x (scene px) is in the middle of the screen.
  const panTo = (x: number) => {
    const sc = scroller.current;
    if (!sc || !isPhone()) return;
    sc.scrollTo({ left: Math.max(0, x - window.innerWidth / 2), behavior: "smooth" });
  };
  const lastHover = useRef(0);
  const speak = useCallback((text: string, fromAi = false, force = false) => {
    // Comments are off: she only talks when hovered, clicked, or asked from the menu.
    if (!force) return;
    // One bubble at a time: a new line replaces whatever she was saying, nothing queues up.
    lineQueue.current = []; window.clearTimeout(queueTimer.current);
    showLine(text, fromAi);
    return;
    lastSpoke.current = Date.now();
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
    speak(fresh || deck.current.pop()!, !!fresh, true);
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
  // `lazy`: she's wandering on her own, so she cruises instead of gunning it.
  async function rideTo(clientX: number, lazy = false) {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    const k = s(), w = bike.current.offsetWidth, x0 = place.current.x;
    const target = Math.max(8, Math.min(VW() - w - 8, clientX - w / 2));
    if (Math.abs(target - x0) < 12) return;
    busy.current = true; setMoving(true);
    const left = target < x0; setFacingLeft(left);
    const rearAt = (x: number) => x + (left ? VIEW_W - 60 : 60) * k, exhaustAt = (x: number) => x + (left ? VIEW_W - 16 : 16) * k;
    let lastPuff = 0, lastRear: number | null = null;
    await animate(Math.max(lazy ? 1800 : 600, Math.abs(target - x0) * ((lazy ? 5 : 2.2) + drunkRef.current * 0.5)), t => {
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
    if (!lazy && Math.random() < 0.5) speak(pick(["Happy now, ya bossy bugger?", "Righto, parked. Where's me beer?", "Don't tell me where to park, ya cunt. …Fine.", "This spot's got better views of your bald patch."]));
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
    // Something's already going on: she just watches.
    if (sceneActive() && !bbqPending.current) return;
    const roll = Math.random();
    if (bbqPending.current) { void barbie(); return; }
    if (!claimScene(6000, 6000)) return;
    if (killsRef.current.length && roll < 0.3) { void collect(pick(killsRef.current).id); return; }
    if (roll < 0.06) void burnout();
    else if (roll < 0.1) void runStopSign();
    else if (roll < 0.13) void callBackup();
    else if (roll < 0.22 + drunkRef.current * 0.08) {
      // A short cruise, not a lap of the screen.
      const here = place.current.x + (bike.current?.offsetWidth || 200) / 2, hop = (120 + Math.random() * 200) * (Math.random() < 0.5 ? -1 : 1);
      void rideTo(Math.max(40, Math.min(VW() - 40, here + hop)), true);
    }
    else void act(pick(["drink", "flip", "moon", "smoke", "throw", "flip", "smoke"] as Action[]));
  };
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { restless.current(); next(); }, 30_000 + Math.random() * 20_000); };
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
    if (place.current.x + 310 * k > VW()) await rideTo(VW() * 0.3 + bike.current.offsetWidth / 2);
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
      if (t > 0.08 && now - lastFog > 110) { lastFog = now; add({ kind: "fog", x: Math.random() * VW(), y: Math.random() * window.innerHeight * 0.9, size: 200 + Math.random() * 280 }); }
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
    setFinger({ left: Math.min(VW() - 120, Math.max(120, place.current.x + 137 * k)), bottom: GROUND + (VIEW_H - 16) * k });
    speak("Yeah cunt! What a ripper!");
    await later(3400);
    setFinger(null); setPose("ride");
    busy.current = false;
  }
  // Aussies drive on the left: far-lane traffic heads left to right; near-lane traffic comes
  // right to left, straight at Shazz (who's on the wrong side, naturally), and they swerve.
  function spawnCar() {
    const width = isPhone() ? 150 : 200, lane: "far" | "near" = Math.random() < 0.5 ? "far" : "near";
    const dir: 1 | -1 = lane === "far" ? 1 : -1, ms = 4200 + Math.random() * 2500;
    const from = dir === 1 ? -width : VW(), to = dir === 1 ? VW() : -width;
    const herMiddle = place.current.x + (bike.current?.offsetWidth || 200) / 2;
    const passAt = Math.max(0, Math.min(1, (herMiddle - width / 2 - from) / (to - from))) * ms;
    if (brawlRef.current) {
      // Nobody drives through a bikie brawl: pull up short, gawk, chuck a U-ey.
      const cx = VW() / 2;
      const turnAt = dir === 1 ? Math.max(-width * 0.3, cx - 560 - width) : Math.min(VW() - width * 0.7, cx + 560);
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
  // A car or sportsbike comes down the lane and cleans up whatever's standing at x. Resolves
  // at the moment of impact; the vehicle carries on off-screen at the same speed.
  async function runOver(x: number, lane: "far" | "near", targetW: number) {
    const id = ++uid, dir: 1 | -1 = lane === "far" ? 1 : -1, vehicle: "car" | "bike" = Math.random() < 0.4 ? "bike" : "car";
    const vw = vehicle === "bike" ? sportbikeW() : isPhone() ? 150 : 200;
    const startX = dir === 1 ? -vw - 20 : VW() + 20, impactX = dir === 1 ? x - vw * 0.9 : x + targetW * 0.6 - vw * 0.1;
    const runIn = vehicle === "bike" ? 1600 : 2400, speed = Math.abs(impactX - startX) / runIn;
    const update = (change: (h: Hitter) => Hitter) => setHitters(list => list.map(h => (h.id === id ? change(h) : h)));
    setHitters(list => [...list, { id, lane, dir, vehicle, color: pick(vehicle === "bike" ? SPORTBIKE_COLORS : CAR_COLORS), vx: startX, vms: 0, vw }]);
    await later(60);
    if (vehicle === "bike") add({ kind: "burst", x: dir === 1 ? 20 : VW() - 220, y: (lane === "far" ? FAR_LANE : GROUND) + 70, size: 0, text: "NEEEEOWWW!" });
    update(h => ({ ...h, vx: impactX, vms: runIn }));
    await later(runIn);
    const exitX = dir === 1 ? VW() + 40 : -vw - 40, exitMs = Math.abs(exitX - impactX) / speed;
    update(h => ({ ...h, vx: exitX, vms: exitMs }));
    window.setTimeout(() => setHitters(list => list.filter(h => h.id !== id)), exitMs + 150);
  }

  // Roadkill starts out alive: a critter wanders onto the road, freezes in the headlights, and a
  // car or sportsbike flattens it. What's left becomes dinner.
  async function spawnKill() {
    if (killsRef.current.length + crossingCount.current >= 3 || !claimScene(7000)) return;
    const herMiddle = place.current.x + (bike.current?.offsetWidth || 200) / 2;
    let x = 0;
    for (let i = 0; i < 8; i++) { x = 30 + Math.random() * (VW() - 120); if (Math.abs(x + 35 - herMiddle) > 140) break; }
    crossingCount.current++;
    const id = ++uid, kind = pick(CRITTERS), lane: "far" | "near" = Math.random() < 0.5 ? "far" : "near", critterW = kind === "roo" ? 74 : 66;
    const laneBottom = lane === "far" ? FAR_LANE + 4 : GROUND + 2;
    const update = (change: (c: Crossing) => Crossing) => setCrossings(list => list.map(c => (c.id === id ? change(c) : c)));
    setCrossings(list => [...list, { id, kind, x, bottom: ROAD_H + 40, ms: 0, faceLeft: Math.random() < 0.5, flat: false, done: false, lane }]);
    await later(60);
    update(c => ({ ...c, bottom: laneBottom, ms: 2600 }));
    await later(2600);
    await runOver(x, lane, critterW);
    const alive = !shotIds.current.has(id);
    if (alive) {
      update(c => ({ ...c, flat: true }));
      add({ kind: "burst", x: x - 30, y: laneBottom + 80, size: 0, text: pick(["SPLAT!", "THUMP!", "SQUISH!", "KER-SPLAT!"]) });
      add({ kind: "splat", x: x + critterW / 2, y: laneBottom, size: 56 });
      if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) window.setTimeout(() => speak(pick(SPLAT_LINES)), 700);
    }
    await later(900);
    update(c => ({ ...c, done: true }));
    if (alive && phaseRef.current === "parked") setKills(list => [...list, { id: ++uid, kind, x, bottom: laneBottom - 4, bornAt: Date.now() }]);
    await later(300);
    setCrossings(list => list.filter(c => c.id !== id));
    crossingCount.current = Math.max(0, crossingCount.current - 1);
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
    if (place.current.x + w() + sceneW + 10 > VW()) await rideTo(VW() * 0.35);
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
  // Blow straight through a stop sign, then turn round and let it have both barrels.
  async function runStopSign(fromUser = false) {
    if (phaseRef.current !== "parked" || busy.current || !bike.current) return;
    setMenu(false);
    const w = bike.current.offsetWidth, x0 = place.current.x, goRight = x0 < VW() / 2;
    const signX = goRight ? Math.min(VW() - 150, x0 + w + 90) : Math.max(90, x0 - 150);
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
    const k = s(), w = bike.current.offsetWidth, copW = isPhone() ? 160 : 210, copH = copW * 0.42;
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
    const parkCop = Math.max(10, Math.min(x - copW - 40, VW() * 0.3));
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
      for (let i = 0; i < 10 && Math.abs(target - x) < VW() * 0.3; i++) target = 10 + Math.random() * (VW() - w - 20);
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
    const x0 = x, end = VW() + 160;
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
    const cx = VW() / 2, cloudY = GROUND + 60;
    const started = performance.now();
    let i = 0;
    while (performance.now() - started < 15_000 && phaseRef.current === "parked") {
      // Junk flies out of the cloud in every direction.
      const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * Math.min(520, VW() * 0.45));
      add({ kind: "junk", x: cx + (Math.random() - 0.5) * 80, y: cloudY + 40 + Math.random() * 60, size: 0, dx, dy: cloudY + 60 - GROUND, arc: -(100 + Math.random() * 160), text: pick(JUNK) });
      if (i % 3 === 0) add({ kind: "burst", x: cx - 160 + Math.random() * 260, y: cloudY + 90 + Math.random() * 110, size: 0, text: pick(BRAWL_HITS) });
      if (i % 2 === 0) { const p = pick(PAIRS); add({ kind: "tyre", x: cx + p.at + Math.random() * 40, y: GROUND + p.row, size: 26 + Math.random() * 20 }); }
      if (i % 4 === 0) { const n = Math.floor(Math.random() * PAIRS.length); setKnocked(`${Math.random() < 0.5 ? "r" : "b"}${n}`); add({ kind: "stars", x: cx + PAIRS[n].at - 10, y: GROUND + PAIRS[n].row + 70, size: 0, text: "★ ✦ ★" }); }
      if (i === 8 || i === 40) spawnCar();
      const redBikeX = cx - 460, blueBikeX = cx + BLUE_AT(0);
      if (i === 12) setThieves(t => ({ ...t, trev: { x: -90, ms: 0, riding: false, line: null } }));
      if (i === 13) setThieves(t => ({ ...t, trev: t.trev && { ...t.trev, x: redBikeX + 20, ms: 2000, line: "Nobody's usin' this one, eh?" } }));
      if (i === 24) {
        setThieves(t => ({ ...t, stolenRed: true, trev: t.trev && { ...t.trev, riding: true, x: -260, ms: 2600, line: "SWEET AS! SWEET AS! SWEET AS!" } }));
        add({ kind: "burst", x: redBikeX - 20, y: GROUND + 150, size: 0, text: "OI! ME BIKE!" });
      }
      if (i === 28) setThieves(t => ({ ...t, kylie: { x: VW() + 40, ms: 0, wheel: false, line: null } }));
      if (i === 29) setThieves(t => ({ ...t, kylie: t.kylie && { ...t.kylie, x: blueBikeX + 96, ms: 2000, line: "Ooh. Spare wheel." } }));
      if (i === 40) {
        setThieves(t => ({ ...t, bricked: true, kylie: t.kylie && { ...t.kylie, wheel: true, line: "Bricks under it, babe. It's only fair." } }));
        add({ kind: "burst", x: blueBikeX + 40, y: GROUND + 150, size: 0, text: "CLUNK CLUNK!" });
      }
      if (i === 48) setThieves(t => ({ ...t, kylie: t.kylie && { ...t.kylie, x: VW() + 80, ms: 2400, line: "BYE!", leaving: true } }));
      if (i === 60) setThieves(t => ({ ...t, trev: null, kylie: null }));
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
    await later(2600);
    // Their bikes get booted into a heap...
    setPose("ride"); setBrawl("kick");
    speak("Right boys. Pile up their bikes.");
    for (let b = 0; b < 8; b++) {
      await later(160);
      add({ kind: "burst", x: cx + BLUE_AT(b) - 20, y: GROUND + 110 + (b % 2) * 30, size: 0, text: pick(["KICK!", "BOOT!", "CLANG!", "CRUNCH!"]) });
    }
    await later(1100);
    // ...a bundle of dynamite goes on top...
    setBrawl("dynamite");
    speak("FIRE IN THE HOLE, ya blue mongrels!");
    add({ kind: "burst", x: cx + PILE_X - 20, y: GROUND + 170, size: 0, text: "TSSSSSSS..." });
    await later(2600);
    // ...and up it all goes.
    setBrawl("boom");
    add({ kind: "boom", x: cx + PILE_X - 160, y: GROUND + 230, size: 0, text: "KA-BOOOOOM!" });
    for (let j = 0; j < 14; j++) add({ kind: "junk", x: cx + PILE_X + 40, y: GROUND + 60, size: 0, dx: (Math.random() - 0.5) * 700, dy: 50, arc: -(160 + Math.random() * 220), text: pick(["🛞", "⚙️", "🔩", "🔧", "🪖", "💥"]) });
    for (let j = 0; j < 12; j++) add({ kind: "smoke", x: cx + PILE_X + 40 + (Math.random() - 0.5) * 160, y: GROUND + 30 + Math.random() * 90, size: 50 + Math.random() * 60 });
    await later(1600);
    add({ kind: "burst", x: cx - 200, y: GROUND + 170, size: 0, text: "OI OI OI!" });
    speak("Now THAT'S a bonfire. Reds win, ya galahs!");
    setPose("flip");
    await later(3200);
    setPose("ride"); setBrawl(null);
    setThieves({ trev: null, kylie: null, stolenRed: false, bricked: false });
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
      if (i % 2 === 0) add({ kind: "burst", x: Math.random() * (VW() - 200), y: GROUND + 150 + Math.random() * 40, size: 0, text: pick(["BRAAAP!", "VROOOM!", "POTATO POTATO", "YEOOO!"]) });
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
    if (place.current.x + w + sceneW + 10 > VW()) { busy.current = false; await rideTo(VW() * 0.3); busy.current = true; }
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
    const k = s(), box = sRect(el);
    const handX = place.current.x + 86 * k, handY = window.innerHeight - (GROUND + (VIEW_H - 12) * k);
    setPose("throw"); setFlaming(true);
    add({ kind: "boom", x: place.current.x + 40 * k, y: GROUND + (VIEW_H + 30) * k, size: 0, text: "WHOOSH!" });
    setHeldCar(carId);
    setLasso({ carId, x1: handX, y1: handY, x2: box.left + box.width / 2, y2: box.top + box.height * 0.35 });
    add({ kind: "burst", x: box.left + box.width / 2 - 40, y: window.innerHeight - box.top + 10, size: 0, text: "YOINK!" });
    speak(pick(LASSO_LINES));
    await later(2600);
    setLasso(null); setHeldCar(null); setPose("ride"); setFlaming(false);
    speak("Nah, go on, piss off. Drive safe!");
    busy.current = false;
  }
  // Roadkill left lying about too long: Twitchy Trev peeks out from behind the nearest gum,
  // twitches a while, darts out, grabs it and bolts back behind the tree.
  async function binChickenRaid(killId: number) {
    const kill = killsRef.current.find(item => item.id === killId);
    if (!kill || ibisBusy.current) return;
    ibisBusy.current = true;
    setKills(list => list.map(item => (item.id === killId ? { ...item, claimed: true } : item)));
    const tree = treeSpots().reduce((best, t) => (Math.abs(t.x + TREE.W / 2 - kill.x) < Math.abs(best.x + TREE.W / 2 - kill.x) ? t : best));
    const hideX = tree.x + TREE.W * 0.42 - 33, hideBottom = TREE_BOTTOM - 6, faceLeft = kill.x < hideX;
    setTrev({ x: hideX, bottom: hideBottom, ms: 0, faceLeft, pose: "peek", carrying: null, line: pick(TREV_PEEK) });
    await later(4000);
    // Go!
    const grabX = kill.x - 8, dash = Math.max(700, Math.hypot(grabX - hideX, hideBottom - GROUND) * 2.2);
    setTrev(t => t && { ...t, pose: "run", line: null, x: grabX, bottom: GROUND - 2, ms: dash });
    await later(dash + 100);
    if (!killsRef.current.some(k => k.id === killId)) { setTrev(null); ibisBusy.current = false; return; }
    setKills(list => list.filter(item => item.id !== killId));
    setTrev(t => t && { ...t, carrying: kill.kind, line: pick(TREV_GRAB) });
    if (phaseRef.current === "parked" && !busy.current) speak(pick(TREV_SHAZZ));
    await later(700);
    if (Math.random() < 0.5 && claimScene(36_000, 4000)) {
      setTrev(null);
      await tweakerCookout(tree, { x: grabX, bottom: GROUND - 2, pose: "run" }, kill.kind);
      ibisBusy.current = false;
      return;
    }
    setTrev(t => t && { ...t, faceLeft: !faceLeft, x: hideX, bottom: hideBottom, ms: dash });
    await later(dash + 1400);
    setTrev(null);
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
  // A loose group of 2-4 bin chickens flying over together, slightly staggered.
  function spawnFlyers() {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, base = 200 + Math.random() * Math.max(80, window.innerHeight * 0.4), ms = 6500 + Math.random() * 3000;
    const group = 2 + Math.floor(Math.random() * 3);
    setFlyers(list => [...list, ...Array.from({ length: group }, (_, i) => ({ id: ++uid, dir, bottom: base + (i % 2 ? 36 : -14) * Math.ceil(i / 2), ms: ms + i * 220, delay: i * 260 }))]);
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.35) window.setTimeout(() => speak("Check out those white pointers!!"), 1500);
  }

  // Shazz (or dad, clicking) can shoot any animal on screen. Birds and pests go up in a puff of
  // feathers or fur; roos, koalas, snakes and the rest drop onto the road as dinner.
  function hitTarget(target: Target, el: Element, text?: string) {
    if (!el.isConnected) return;
    const r = sRect(el);
    const x = r.left + r.width / 2, y = window.innerHeight - (r.top + r.height / 2);
    const onRoad = Math.max(GROUND - 2, Math.min(FAR_LANE + 4, window.innerHeight - r.bottom));
    const dinner = (kind: Critter) => {
      if (killsRef.current.length >= 6) return;
      const id = ++uid;
      setKills(list => [...list, { id, kind, x: x - 36, bottom: onRoad, bornAt: Date.now() }]);
      void crowFeast(id);
    };
    add({ kind: "feathers", x, y, size: 0, palette: FUR[target.kind] });
    add({ kind: "burst", x: x - 30, y: y + 36, size: 0, text: text ?? pick(["POOF!", "KA-BLAM!", "BLAM!"]) });
    switch (target.kind) {
      case "flyer": setFlyers(list => list.filter(f => f.id !== target.id)); break;
      case "flock": setFlock(fl => fl && { ...fl, birds: fl.birds.map((b, i) => (i === target.index ? { ...b, shot: true } : b)) }); break;
      case "raider": setRaider(null); break;
      case "ibis":
        ibisAlive.current = false;
        // Whatever it had nicked drops back on the road.
        if (ibis?.carrying) { const carried = ibis.carrying, at = ibis.x; setKills(list => [...list, { id: ++uid, kind: carried, x: at, bornAt: Date.now() }]); }
        setIbis(null);
        break;
      case "magpie": setKid(k => k && { ...k, magpies: k.magpies.filter(m => m.id !== target.id) }); break;
      case "roo": setRoos(list => list.filter(item => item.id !== target.id)); dinner("roo"); break;
      case "crossing": {
        const critter = crossings.find(c => c.id === target.id);
        shotIds.current.add(target.id);
        setCrossings(list => list.map(c => (c.id === target.id ? { ...c, done: true } : c)));
        if (critter) dinner(critter.kind);
        break;
      }
      case "snake":
        shotIds.current.add(target.id);
        setSnakes(list => list.map(sn => (sn.id === target.id ? { ...sn, done: true } : sn)));
        dinner("snake");
        break;
      case "strikeRoo": strikeRooShot.current = true; setStrike(st => st && { ...st, rooGone: true }); dinner("roo"); break;
      case "dropBear": setDropBear(null); break;
      case "dangler": setDanglers(list => list.filter(d => d.id !== target.id)); break;
      case "koala": {
        const tree = target.tree;
        setShotKoalas(list => [...list, tree]);
        dinner("koala");
        // Another one climbs up eventually.
        window.setTimeout(() => setShotKoalas(list => list.filter(t => t !== tree)), 40_000 + Math.random() * 20_000);
        break;
      }
      case "lorikeet": setLorikeets(list => list.filter(b => b.id !== target.id)); break;
      case "emu": {
        const emu = emus.find(e => e.id === target.id);
        if (!emu) break;
        if (emu.hits === 0) {
          // First shot: feathers and a leg go flying; it hops on, slower but still going.
          add({ kind: "leg", x: x - 8, y: Math.max(GROUND, y - 30), size: 0, dx: (Math.random() - 0.5) * 120, dy: Math.max(10, y - 30 - GROUND), arc: -(70 + Math.random() * 60) });
          const end = emu.dir === 1 ? VW() + 100 : -emu.size - 40, here = r.left;
          setEmus(list => list.map(e => (e.id === emu.id ? { ...e, hits: 1, x: here, ms: 0 } : e)));
          window.setTimeout(() => setEmus(list => list.map(e => (e.id === emu.id ? { ...e, x: end, ms: Math.abs(end - here) * 9 } : e))), 40);
        } else {
          // Second shot finishes the job: one-legged roadkill.
          setEmus(list => list.filter(e => e.id !== emu.id));
          dinner("emu");
        }
        break;
      }
    }
  }
  // A shot animal draws a murder of crows: five drop in, pick at it for 10-15s and leave. Half the
  // time there's only a skeleton left, which sits on the road until a car or bike crunches it.
  // One of the tree tweakers comes down and has a go at the crows. Win and they carry the carcass up
  // their tree; lose and they slink back while the crows carry on. Returns "won", "lost" or null.
  async function crowFight(killId: number, kind: Critter, mid: number, kb: number, crowIds: number[], spots: { id: number; x: number; bottom: number }[]): Promise<"won" | "lost" | null> {
    const trees = treeSpots(), lurkersHome = !trev && !cookout && !rave && !thieves.trev && !thieves.kylie;
    const choices = (["gary", "trev", "kylie"] as const).filter(w => boogie?.who !== w && (w === "gary" ? !garyBusy.current : lurkersHome && trees.length > (w === "trev" ? 1 : 2)));
    if (!choices.length || fighter) return null;
    const who = pick([...choices]);
    if (who === "gary") garyBusy.current = true;
    const tree = who === "gary" ? trees[trees.length - 1] : trees[who === "trev" ? 0 : 1], trunkX = tree.x + TREE.W * 0.45 - 33;
    const flock = (change: (c: (typeof crows)[number]) => (typeof crows)[number]) => setCrows(list => list.map(c => (crowIds.includes(c.id) ? change(c) : c)));
    // Down out of the tree (Gary climbs down from the canopy; the others pop out from behind the trunk).
    setFighter({ who, x: trunkX, bottom: who === "gary" ? TREE_BOTTOM + TREE.H * 0.48 : TREE_BOTTOM - 6, ms: 0, faceLeft: false, pose: who === "gary" ? "dance" : "run", carrying: null, scuffle: false, line: pick(["OI! THAT'S MY DINNER!", "GET OFF IT, YA FEATHERED MONGRELS!", "MINE! MINE MINE MINE!"]) });
    await later(400);
    if (who === "gary") { setFighter(f => f && { ...f, bottom: TREE_BOTTOM - 6, ms: 900 }); await later(950); }
    const runMs = Math.max(700, Math.abs(mid - 33 - trunkX) * 3);
    setFighter(f => f && { ...f, pose: "run", x: mid - 33, bottom: kb, ms: runMs, faceLeft: mid - 33 < trunkX, line: null });
    await later(runMs + 50);
    // The brawl: crows up and flapping, a cloud of dust and feathers.
    setFighter(f => f && { ...f, scuffle: true });
    for (let i = 0; i < 6; i++) {
      flock(c => ({ ...c, eating: false, x: mid - 60 + Math.random() * 100, bottom: kb + 20 + Math.random() * 70, ms: 350 }));
      add({ kind: "burst", x: mid - 50 + (Math.random() - 0.5) * 80, y: kb + 120 + Math.random() * 30, size: 0, text: pick(["CAW!", "GERROFF!", "PECK PECK!", "OW! ME EAR!", "SQUAWK!", "BIFF!"]) });
      if (i % 2 === 0) add({ kind: "feathers", x: mid, y: kb + 50, size: 0, palette: ["#111", "#1b1b1f", "#3b3b3b"] });
      await later(420);
    }
    const won = Math.random() < 0.55, home = who === "gary" ? TREE_BOTTOM + TREE.H * 0.48 : TREE_BOTTOM - 6;
    if (won) {
      setKills(list => list.filter(k => k.id !== killId));
      setFighter(f => f && { ...f, scuffle: false, carrying: kind, line: "HA! DINNER'S MINE!" });
      flock(c => ({ ...c, eating: false, faceLeft: Math.random() < 0.5, x: mid + (Math.random() < 0.5 ? -1 : 1) * (VW() * 0.7), bottom: window.innerHeight * (0.65 + Math.random() * 0.2), ms: 2200 }));
      add({ kind: "burst", x: mid - 50, y: kb + 140, size: 0, text: "CAAAW!!" });
      window.setTimeout(() => setCrows(list => list.filter(c => !crowIds.includes(c.id))), 2400);
    } else {
      setFighter(f => f && { ...f, scuffle: false, line: "ALRIGHT! ALRIGHT! YA CAN HAVE IT!" });
      setCrows(list => list.map(c => { const sp = spots.find(x => x.id === c.id); return sp ? { ...c, x: sp.x, bottom: sp.bottom, ms: 600, eating: true, faceLeft: sp.x + 22 > mid } : c; }));
    }
    await later(900);
    // Back home.
    setFighter(f => f && { ...f, x: trunkX, bottom: TREE_BOTTOM - 6, ms: runMs, faceLeft: trunkX < mid - 33, line: null });
    await later(runMs + 50);
    if (who === "gary") { setFighter(f => f && { ...f, pose: "dance", bottom: home, ms: 900 }); await later(950); }
    if (won) add({ kind: "burst", x: trunkX, y: (who === "gary" ? home : TREE_BOTTOM) + 140, size: 0, text: "NOM NOM NOM" });
    setFighter(null);
    if (who === "gary") garyBusy.current = false;
    return won ? "won" : "lost";
  }
  async function crowFeast(killId: number) {
    await later(1500 + Math.random() * 2000);
    const kill = killsRef.current.find(k => k.id === killId);
    if (!kill || kill.claimed || phaseRef.current !== "parked") return;
    setKills(list => list.map(k => (k.id === killId ? { ...k, claimed: true } : k)));
    const fromRight = Math.random() < 0.5, kb = kill.bottom ?? GROUND - 2, mid = kill.x + 36;
    const spots = Array.from({ length: 5 }, (_, i) => ({ id: ++uid, x: kill.x - 34 + i * 24 + Math.random() * 8, bottom: kb + (i % 2 ? 8 : 0) }));
    const ids = spots.map(sp => sp.id);
    const mine = (change: (c: (typeof crows)[number]) => (typeof crows)[number]) => setCrows(list => list.map(c => (ids.includes(c.id) ? change(c) : c)));
    setCrows(list => [...list, ...spots.map((sp, i) => ({ id: sp.id, x: mid + (fromRight ? 1 : -1) * (420 + i * 70), bottom: window.innerHeight * (0.6 + (i % 3) * 0.08), ms: 0, faceLeft: fromRight, eating: false, peck: Math.round(Math.random() * 900) }))]);
    await later(60);
    setCrows(list => list.map(c => { const sp = spots.find(x => x.id === c.id); return sp ? { ...c, x: sp.x, bottom: sp.bottom, ms: 1800 + ids.indexOf(c.id) * 220 } : c; }));
    await later(1800 + 5 * 220);
    mine(c => ({ ...c, eating: true, faceLeft: c.x + 22 > mid }));
    setKills(list => list.map(k => (k.id === killId ? { ...k, bloody: true } : k)));
    add({ kind: "splat", x: mid, y: kb, size: 90 });
    let flicking = true;
    void (async () => {
      let n = 0;
      while (flicking) {
        await later(260 + Math.random() * 300);
        if (!flicking) break;
        const sp = pick(spots), side = sp.x + 22 > mid ? 1 : -1;
        for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
          add({ kind: "drop", x: sp.x + 24 + side * 10, y: sp.bottom + 16, size: 3 + Math.random() * 3, dx: side * (15 + Math.random() * 45), dy: 16 + Math.random() * 6, arc: -(20 + Math.random() * 35) });
        }
        if (++n === 6) mine(c => ({ ...c, messy: true }));
      }
    })();
    add({ kind: "burst", x: mid - 50, y: kb + 80, size: 0, text: "CAW! CAW!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) speak(pick(CROW_LINES));
    const eatMs = 10_000 + Math.random() * 5000, fightRoll = Math.random() < 0.45;
    for (let t = 0; t < eatMs; t += 3500) {
      await later(Math.min(3500, eatMs - t));
      if (!killsRef.current.some(k => k.id === killId)) break;
      if (t === 0 && fightRoll) {
        const result = await crowFight(killId, kill.kind, mid, kb, ids, spots);
        if (result === "won") { flicking = false; return; }
      }
      if (Math.random() < 0.6) add({ kind: "burst", x: mid - 40 + (Math.random() - 0.5) * 60, y: kb + 70, size: 0, text: pick(["CAW!", "CAAAW!", "peck peck"]) });
    }
    flicking = false;
    // Done: up and away. Either it's still dinner, or it's down to the bones.
    const bones = Math.random() < 0.5;
    setKills(list => list.map(k => (k.id === killId ? (bones ? { ...k, bones: true } : { ...k, claimed: false, bornAt: Date.now() }) : k)));
    const away = Math.random() < 0.5 ? 1 : -1;
    mine(c => ({ ...c, eating: false, faceLeft: away === -1, x: mid + away * (VW() * 0.7 + Math.random() * 200), bottom: window.innerHeight * (0.65 + Math.random() * 0.2), ms: 2200 }));
    await later(2400);
    setCrows(list => list.filter(c => !ids.includes(c.id)));
    if (!bones) return;
    // Eventually something drives over the skeleton.
    await later(8000 + Math.random() * 12_000);
    const left = killsRef.current.find(k => k.id === killId);
    if (!left || phaseRef.current !== "parked") return;
    const lane: "far" | "near" = (left.bottom ?? GROUND) > (GROUND + FAR_LANE) / 2 ? "far" : "near";
    await runOver(left.x + 20, lane, 70);
    if (!killsRef.current.some(k => k.id === killId)) return;
    add({ kind: "burst", x: left.x - 10, y: kb + 80, size: 0, text: pick(["CRUNCH!", "KRRRNCH!", "SNAP CRACKLE POP!"]) });
    for (let i = 0; i < 4; i++) add({ kind: "junk", x: left.x + 36, y: kb + 10, size: 0, dx: (Math.random() - 0.5) * 140, dy: 6, arc: -(30 + Math.random() * 50), text: "🦴" });
    setKills(list => list.filter(k => k.id !== killId));
  }

  // Bin chickens in the air let go now and then. A dropping falls in up to three steps: past the
  // back lane's roofs, past the front lane's roofs, then onto the road. Anything under it cops it.
  useEffect(() => {
    if (phase !== "parked") return;
    const timer = window.setInterval(() => {
      if (Math.random() > 0.4) return;
      const birds = Array.from(document.querySelectorAll<HTMLElement>("[data-pooper]")).map(el => sRect(el))
        .filter(r => r.right > 0 && r.left < VW() && r.bottom > 0 && window.innerHeight - r.bottom > FAR_LANE + 110);
      if (!birds.length) return;
      const r = pick(birds), x = r.left + r.width / 2, y = window.innerHeight - r.bottom + 10;
      dropPoop(x, y, 0);
    }, 900);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const POOP_STOPS = [FAR_LANE + 88, GROUND + 92];
  // The highest head (person, animal or Shazz) under x that's below fromY, if any.
  function headUnder(x: number, fromY: number) {
    const H = window.innerHeight;
    return Array.from(document.querySelectorAll<HTMLElement>("[data-poopable]"))
      .map(el => ({ el, r: sRect(el) }))
      .filter(({ r }) => x > r.left + r.width * 0.15 && x < r.right - r.width * 0.15 && H - r.top < fromY - 4 && H - r.top > 0)
      .map(({ el, r }) => ({ el, top: H - r.top }))
      .sort((a, b) => b.top - a.top)[0];
  }
  function dropPoop(x: number, fromY: number, stage: number) {
    const toY = stage < 2 ? POOP_STOPS[stage] : GROUND + 6 + Math.random() * (FAR_LANE + 30 - GROUND);
    // Somebody's head in the way? Aim for that instead.
    const head = headUnder(x, fromY);
    if (head && head.top > toY) {
      const dy = fromY - head.top;
      add({ kind: "poop", x, y: fromY, size: 0, dy, stage, hit: true, dx: Math.max(120, Math.sqrt(dy) * 45) });
      return;
    }
    if (toY >= fromY) { if (stage < 2) dropPoop(x, fromY, stage + 1); return; }
    const dy = fromY - toY;
    add({ kind: "poop", x, y: fromY, size: 0, dy, stage, dx: Math.max(120, Math.sqrt(dy) * 45) });
  }
  function poopLanded(item: Fx) {
    remove(item.id);
    const x = item.x, y = item.y - (item.dy || 0), stage = item.stage ?? 2;
    if (item.hit) {
      // Still under it? SPLAT. (If they stepped out of the way, it keeps falling.)
      const head = headUnder(x, y + 30);
      if (head && Math.abs(head.top - y) < 40) {
        const who = head.el.dataset.poopable;
        add({ kind: "burst", x: x - 30, y: y + 26, size: 0, text: "SPLAT!" });
        if (who !== "shazz") add({ kind: "burst", x: x - 20, y: y + 58, size: 0, text: who === "animal" ? pick(["!!", "SQUAWK?!", "OI!"]) : pick(["OI!", "EWWW!", "ME HAT!", "IN ME HAIR!", "LUCKY, APPARENTLY"]) });
        else if (Date.now() - lastPoopLine.current > 9000) { lastPoopLine.current = Date.now(); speak(pick(POOP_SHAZZ_LINES)); }
        return;
      }
      dropPoop(x, y, stage);
      return;
    }
    if (stage < 2) {
      const lane = stage === 0 ? "far" : "near";
      const hit = Array.from(document.querySelectorAll<HTMLElement>(`[data-vehicle][data-lane="${lane}"]`)).find(el => {
        const r = sRect(el);
        return x > r.left + r.width * 0.08 && x < r.right - r.width * 0.08;
      });
      const shazz = lane === "near" && bike.current && phaseRef.current === "parked" && (() => { const r = sRect(bike.current!); return x > r.left + r.width * 0.2 && x < r.right - r.width * 0.2; })();
      if (hit || shazz) {
        add({ kind: "burst", x: x - 30, y: y + 30, size: 0, text: "SPLAT!" });
        if (hit) {
          const key = hit.dataset.vehicle!, r = sRect(hit), f = (x - r.left) / r.width;
          setPoops(all => ({ ...all, [key]: [...(all[key] || []), f] }));
        }
        if (Date.now() - lastPoopLine.current > 9000 && phaseRef.current === "parked" && (shazz || Math.random() < 0.5)) {
          lastPoopLine.current = Date.now();
          speak(pick(shazz ? POOP_SHAZZ_LINES : POOP_CAR_LINES));
        }
        return;
      }
      dropPoop(x, y, stage + 1);
      return;
    }
    add({ kind: "poopSplat", x, y, size: 10 + Math.random() * 6 });
  }
  const poopMarks = (key: string, top: string) => poops[key]?.map((f, i) => <span key={i} className={styles.poopMark} style={{ left: `${f * 100}%`, top }} />);

  // A mob of about twenty rainbow lorikeets: a noisy swirl across the sky, into the gum trees,
  // a bit of flitting about, then off again one by one in every direction.
  async function lorikeetVisit() {
    if (!claimScene(24_000, 8000)) return;
    const trees = treeSpots(), fromRight = Math.random() < 0.5, W = VW(), H = window.innerHeight;
    const perch = () => { const t = pick(trees); return { x: t.x + TREE.W * (0.12 + Math.random() * 0.7) - 15, bottom: TREE_BOTTOM + TREE.H * (0.62 + Math.random() * 0.28) }; };
    const birds = Array.from({ length: 20 }, (_, i) => ({ id: ++uid, x: fromRight ? W + 30 + Math.random() * 220 : -60 - Math.random() * 220, bottom: H * (0.55 + Math.random() * 0.3), ms: 0, delay: i * 60, faceLeft: fromRight, perched: false }));
    const ids = birds.map(b => b.id);
    const mine = (change: (b: (typeof birds)[number]) => (typeof birds)[number]) => setLorikeets(list => list.map(b => (ids.includes(b.id) ? change(b) : b)));
    setLorikeets(list => [...list, ...birds]);
    await later(60);
    mine(b => ({ ...b, x: W * (0.25 + Math.random() * 0.5), bottom: H * (0.5 + Math.random() * 0.3), ms: 1800 + Math.random() * 700 }));
    add({ kind: "burst", x: W / 2 - 90, y: H * 0.72, size: 0, text: "SCREEEECH!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) window.setTimeout(() => speak(pick(LORIKEET_LINES)), 1200);
    await later(2800);
    mine(b => { const p = perch(); return { ...b, x: p.x, bottom: p.bottom, ms: 1300 + Math.random() * 700, delay: Math.random() * 400, faceLeft: p.x < b.x }; });
    await later(2500);
    mine(b => ({ ...b, perched: true, delay: 0 }));
    // Sit about for a bit; a couple at a time flit to another branch.
    const sit = 6000 + Math.random() * 4000;
    for (let t = 0; t < sit; t += 1500) {
      await later(1500);
      const flitters = [pick(ids), pick(ids)];
      mine(b => { if (!flitters.includes(b.id)) return b; const p = perch(); return { ...b, x: p.x, bottom: p.bottom, ms: 900, perched: false, faceLeft: p.x < b.x }; });
      window.setTimeout(() => mine(b => (flitters.includes(b.id) ? { ...b, perched: true } : b)), 950);
      if (Math.random() < 0.35) add({ kind: "burst", x: pick(trees).x, y: TREE_BOTTOM + TREE.H + 10, size: 0, text: pick(["SCREECH!", "chatter chatter", "SQUAWK!"]) });
    }
    // Off they go, each in its own time and direction.
    mine(b => { const toLeft = Math.random() < 0.5; return { ...b, perched: false, delay: Math.random() * 2500, x: toLeft ? -80 : W + 40, bottom: H * (0.45 + Math.random() * 0.45), ms: 1500 + Math.random() * 1000, faceLeft: toLeft }; });
    await later(5200);
    setLorikeets(list => list.filter(b => !ids.includes(b.id)));
  }

  // Trev and Kylie, a dinner each, cook up on sticks over a paint tin fire and talk conspiracy
  // rubbish until the coppers turn up. Then they kick the can over and leg it, dinner held high.
  async function tweakerCookout(tree: { x: number }, trevFrom: { x: number; bottom: number; pose: "peek" | "run" }, trevFood: Critter) {
    const W = VW(), mid = tree.x + TREE.W / 2, side = mid < W / 2 ? 1 : -1;
    const fireX = Math.max(110, Math.min(W - 150, mid + side * 120)), fireBottom = TREE_BOTTOM - 16;
    const hideX = tree.x + TREE.W * 0.42 - 33, hideBottom = TREE_BOTTOM - 6;
    const upd = (change: (c: NonNullable<typeof cookout>) => NonNullable<typeof cookout>) => setCookout(c => c && change(c));
    const gone = () => phaseRef.current !== "parked";
    const person = (x: number, bottom: number, pose: Tweaker["pose"], carrying: Critter): Tweaker => ({ x, bottom, ms: 0, faceLeft: fireX < x, pose, carrying, stick: "none" });
    setCookout({ trev: person(trevFrom.x, trevFrom.bottom, trevFrom.pose, trevFood), kylie: person(hideX + 26, hideBottom, "peek", pick(CRITTERS)), fireX, fireBottom, can: "none", kick: 1, line: { who: "kylie", text: pick(KYLIE_HELLO) }, cop: null });
    await later(2400);
    if (gone()) return;
    upd(c => ({ ...c, line: null, trev: { ...c.trev, pose: "run", x: fireX - 84, bottom: fireBottom, ms: 1300, faceLeft: false }, kylie: { ...c.kylie, pose: "run", x: fireX + 40, bottom: fireBottom, ms: 1300, faceLeft: true } }));
    await later(1400);
    upd(c => ({ ...c, can: "lit", trev: { ...c.trev, pose: "cook", carrying: null, stick: "cook" }, kylie: { ...c.kylie, pose: "cook", carrying: null, stick: "cook" } }));
    add({ kind: "burst", x: fireX - 40, y: fireBottom + 90, size: 0, text: "FWOOMP!" });
    if (!busy.current) window.setTimeout(() => speak(pick(COOKOUT_SHAZZ)), 1500);
    // The nonsense.
    const talk = [...CONSPIRACIES].sort(() => Math.random() - 0.5).slice(0, 4);
    for (let i = 0; i < talk.length; i++) {
      if (gone()) return;
      upd(c => ({ ...c, line: { who: i % 2 ? "kylie" : "trev", text: talk[i] } }));
      for (let j = 0; j < 4; j++) { add({ kind: "smoke", x: fireX + (Math.random() - 0.5) * 12, y: fireBottom + 55, size: 12 + Math.random() * 10 }); await later(1300); }
    }
    // Coppers.
    const copW = W < 640 ? 150 : 190, fromRight = fireX < W / 2;
    const copStart = fromRight ? W + 20 : -copW - 20, copStop = fromRight ? fireX + 170 : fireX - 150 - copW;
    upd(c => ({ ...c, line: { who: "trev", text: "Babe... babe. BABE. Coppas." }, cop: { x: copStart, ms: 0, flip: fromRight } }));
    add({ kind: "burst", x: fromRight ? W - 260 : 20, y: FAR_LANE + 110, size: 0, text: "WEE-OO WEE-OO!" });
    await later(60);
    upd(c => ({ ...c, cop: c.cop && { ...c.cop, x: copStop, ms: 1800 } }));
    await later(1900);
    add({ kind: "burst", x: copStop + (fromRight ? 0 : copW - 160), y: FAR_LANE + 120, size: 0, text: "OI! YOUSE TWO!" });
    upd(c => ({ ...c, line: { who: "kylie", text: "LEG IT, BABE!" } }));
    await later(900);
    // Boot the can and scarper, dinner held up high.
    const kick: 1 | -1 = fromRight ? -1 : 1;
    upd(c => ({ ...c, can: "kicked", kick, line: null, trev: { ...c.trev, pose: "run", stick: "up" }, kylie: { ...c.kylie, pose: "run", stick: "up" } }));
    add({ kind: "burst", x: fireX - 30, y: fireBottom + 80, size: 0, text: "CLANG!" });
    for (let i = 0; i < 5; i++) add({ kind: "junk", x: fireX, y: fireBottom + 30, size: 0, dx: kick * (30 + Math.random() * 120), dy: 20, arc: -(40 + Math.random() * 60), text: "🔥" });
    await later(350);
    const escapeX = fromRight ? -150 : W + 70;
    upd(c => ({ ...c, line: { who: "trev", text: pick(RUN_SHOUTS) }, trev: { ...c.trev, x: escapeX, bottom: GROUND + 16, ms: 3600, faceLeft: fromRight }, kylie: { ...c.kylie, x: escapeX, bottom: GROUND + 36, ms: 4100, faceLeft: fromRight } }));
    if (!busy.current) window.setTimeout(() => speak(pick(COOKOUT_BUST)), 800);
    await later(1600);
    upd(c => ({ ...c, line: { who: "kylie", text: pick(RUN_SHOUTS) }, cop: c.cop && { ...c.cop, x: fromRight ? -copW - 80 : W + 80, ms: 4000 } }));
    await later(2600);
    upd(c => ({ ...c, line: null }));
    await later(1600);
    setCookout(null);
  }
  // As its own act: they both come out from behind a gum with a dinner each.
  async function tweakerAct() {
    if (ibisBusy.current || !claimScene(38_000, 4000)) return;
    ibisBusy.current = true;
    const tree = pick(treeSpots()), hideX = tree.x + TREE.W * 0.42 - 33;
    await tweakerCookout(tree, { x: hideX, bottom: TREE_BOTTOM - 6, pose: "peek" }, pick(CRITTERS));
    ibisBusy.current = false;
  }

  // Bush doof: a mob of Trev's mates turn up with the Hills Hoist, an esky, a boombox and a wobble
  // board and go off for fifteen seconds. Then the coppers roll in, zap the lot (slapstick), and
  // chuck them in the paddy wagon, deadpan as you like.
  async function bushRave() {
    if (phaseRef.current !== "parked" || busy.current) return;
    busy.current = true; setMenu(false);
    sceneUntil.current = Date.now() + 70_000;
    const W = VW(), n = 8 + Math.floor(Math.random() * 5), rows = [TREE_BOTTOM - 14, FAR_LANE + 14, GROUND + 10];
    const tints = ["#b91c1c", "#16a34a", "#2563eb", "#f59e0b", "#7c3aed", "#0f766e", "#f9a8d4", "#fde047", "#22d3ee", "#fb923c", "#a3e635", "#e11d48"];
    const spots = Array.from({ length: n }, (_, i) => ({ x: W * (0.08 + (i / (n - 1)) * 0.8) + (Math.random() - 0.5) * 24, bottom: rows[i % 3] }));
    const updRave = (change: (rv: NonNullable<typeof rave>) => NonNullable<typeof rave>) => setRave(rv => rv && change(rv));
    const setRaver = (id: number, change: (r: Raver) => Raver) => updRave(rv => ({ ...rv, ravers: rv.ravers.map(r => (r.id === id ? change(r) : r)) }));
    const setCop = (id: number, change: (c: RaveCopState) => RaveCopState) => updRave(rv => ({ ...rv, cops: rv.cops.map(c => (c.id === id ? change(c) : c)) }));
    const ravers: Raver[] = spots.map((sp, i) => ({ id: ++uid, who: i % 2 ? "kylie" : "trev", tint: tints[i % tints.length], x: sp.x < W / 2 ? -90 - Math.random() * 120 : W + 20 + Math.random() * 120, bottom: sp.bottom, ms: 0, faceLeft: sp.x >= W / 2, pose: "run", line: null, board: false, tossed: false, gone: false }));
    setRave({ ravers, cops: [], vehicles: [], gear: false, lights: false });
    speak("Oh no. Trev's mates have found out about the bush doof.");
    await later(60);
    updRave(rv => ({ ...rv, ravers: rv.ravers.map((r, i) => ({ ...r, x: spots[i].x, ms: 1500 + Math.random() * 700 })) }));
    await later(2300);
    updRave(rv => ({ ...rv, gear: true, lights: true, ravers: rv.ravers.map((r, i) => ({ ...r, pose: "dance", ms: 0, board: i === 2, faceLeft: Math.random() < 0.5 })) }));
    add({ kind: "burst", x: W / 2 - 110, y: GROUND + 230, size: 0, text: "UNTZ UNTZ UNTZ!" });
    // Fifteen seconds of doof.
    const started = performance.now();
    for (let k = 0; performance.now() - started < 15_000; k++) {
      await later(700);
      if (phaseRef.current !== "parked") break;
      add({ kind: "junk", x: W * 0.62 + 35, y: GROUND + 40, size: 0, dx: (Math.random() - 0.5) * 220, dy: -30, arc: -(80 + Math.random() * 80), text: pick(["🎵", "🎶", "🎵"]) });
      if (k % 7 === 0) { const who = pick(ravers).id, line = pick(RAVE_LINES); updRave(rv => ({ ...rv, ravers: rv.ravers.map(r => ({ ...r, line: r.id === who ? line : null })) })); }
      if (k % 5 === 3) add({ kind: "burst", x: W * (0.2 + Math.random() * 0.5), y: GROUND + 200 + Math.random() * 40, size: 0, text: pick(["UNTZ UNTZ!", "OI OI OI!", "DOOF DOOF!", "SPIN THE HOIST!"]) });
      if (k === 6) speak("Wobble board AND a Hills Hoist. Very Australian. Very illegal.");
    }
    // Coppers: two cars and the paddy wagon.
    const copW = W < 640 ? 150 : 190, wagonW = W < 640 ? 170 : 220, wagonX = W - wagonW - 16;
    const vehicles: RaveVehicle[] = [
      { id: ++uid, kind: "car", w: copW, x: -copW - 30, bottom: FAR_LANE, ms: 0, flip: false },
      { id: ++uid, kind: "car", w: copW, x: W + 30, bottom: FAR_LANE, ms: 0, flip: true },
      { id: ++uid, kind: "wagon", w: wagonW, x: W + 60, bottom: GROUND + 2, ms: 0, flip: true },
    ];
    const stops = [12, W - copW - 12, wagonX];
    updRave(rv => ({ ...rv, lights: false, vehicles, ravers: rv.ravers.map(r => ({ ...r, line: null })) }));
    add({ kind: "burst", x: 20, y: FAR_LANE + 120, size: 0, text: "WEE-OO WEE-OO!" });
    add({ kind: "burst", x: W - 260, y: FAR_LANE + 120, size: 0, text: "WEE-OO WEE-OO!" });
    speak("COPPAS! Scatter, ya ferals!");
    await later(60);
    updRave(rv => ({ ...rv, vehicles: rv.vehicles.map((v, i) => ({ ...v, x: stops[i], ms: 1900 })) }));
    // Panic on the dance floor.
    const shuffled = [...ravers].sort(() => Math.random() - 0.5);
    const climbers = shuffled.slice(0, 2), runners = shuffled.slice(2, 5), stayers = shuffled.slice(5);
    const PANIC = ["COPPAS!!", "SCATTER!", "LEG IT!", "COPPAS! RUN!", "EVERY MAN FOR HIMSELF!"];
    shuffled.slice(0, 5).forEach((r, i) => setRaver(r.id, rr => ({ ...rr, line: PANIC[i] })));
    if (stayers[0]) setRaver(stayers[0].id, r => ({ ...r, line: "Is that part of the show?" }));
    await later(900);
    // Three of 'em get away...
    runners.forEach(r => {
      const toLeft = r.x < W / 2;
      setRaver(r.id, rr => ({ ...rr, pose: "run", board: false, faceLeft: toLeft, x: toLeft ? -140 : W + 80, ms: 1300 + Math.random() * 500 }));
    });
    // ...and two shin up gum trees (different ones if there are enough) and hide in the leaves.
    const trees = treeSpots(), taken: number[] = [];
    climbers.forEach((climber, ci) => {
      const order = trees.map((t, ti) => ({ ti, d: Math.abs(t.x + TREE.W / 2 - climber.x) })).sort((a, b) => a.d - b.d);
      const pickTree = order.find(o => !taken.includes(o.ti)) ?? order[0];
      taken.push(pickTree.ti);
      const trunkX = trees[pickTree.ti].x + TREE.W * 0.45 - 33 + (taken.filter(t => t === pickTree.ti).length > 1 ? 24 : 0);
      setRaver(climber.id, r => ({ ...r, pose: "run", board: false, x: trunkX, bottom: TREE_BOTTOM - 6, ms: 900, faceLeft: trunkX < r.x, line: ci ? "ME TOO! ME TOO!" : "UP THE TREE!" }));
      void (async () => {
        await later(950 + ci * 200);
        setRaver(climber.id, r => ({ ...r, pose: "dance", bottom: TREE_BOTTOM + TREE.H * (ci ? 0.52 : 0.45), ms: 1300, line: null }));
        await later(1350);
        setRaver(climber.id, r => ({ ...r, hiding: true }));
      })();
    });
    await later(1300);
    runners.forEach(r => setRaver(r.id, rr => ({ ...rr, gone: true, line: null })));
    add({ kind: "burst", x: 20, y: GROUND + 200, size: 0, text: "THREE GOT AWAY!" });
    await later(800);
    // Four coppers pile out.
    const doors = [stops[0] + copW * 0.6, stops[1] + copW * 0.3, wagonX + wagonW * 0.2, wagonX + wagonW * 0.55];
    const cops: RaveCopState[] = doors.map((x, i) => ({ id: ++uid, x, bottom: i < 2 ? FAR_LANE + 10 : GROUND + 8, ms: 0, faceLeft: x > W / 2, zap: false, walking: false, line: null, gone: false }));
    updRave(rv => ({ ...rv, cops, ravers: rv.ravers.map(r => ({ ...r, line: null })) }));
    setCop(cops[0].id, c => ({ ...c, line: pick(RAVE_COP_LINES.slice(0, 2)) }));
    await later(1200);
    // Round by round: each copper walks up to one, zaps them, chucks them in the van.
    const van = { x: wagonX + wagonW * 0.72, bottom: GROUND + 40 };
    const queue = [...stayers];
    let caught = 0;
    const copAt = cops.map(c => c.x);
    while (queue.length && phaseRef.current === "parked") {
      const round = queue.splice(0, cops.length);
      const approach = round.map((r, j) => Math.max(900, Math.abs(r.x - copAt[j]) * 3));
      round.forEach((r, j) => {
        const standAt = r.x + (r.x > copAt[j] ? -48 : 48);
        setCop(cops[j].id, c => ({ ...c, x: standAt, bottom: r.bottom, ms: approach[j], walking: true, faceLeft: standAt > r.x, line: null }));
      });
      await later(Math.max(...approach) + 50);
      round.forEach((r, j) => {
        setCop(cops[j].id, c => ({ ...c, walking: false, zap: true, line: Math.random() < 0.35 ? pick(RAVE_COP_LINES) : null }));
        setRaver(r.id, rr => ({ ...rr, pose: "zapped", board: false, line: Math.random() < 0.4 ? pick(ZAPPED_LINES) : null }));
        add({ kind: "burst", x: r.x - 10, y: r.bottom + 120, size: 0, text: "BZZZT!" });
        add({ kind: "stars", x: r.x, y: r.bottom + 100, size: 0, text: "★ ✦ ★" });
      });
      await later(1000);
      // Batons out: a few cartoon bonks, stars all round.
      round.forEach((r, j) => {
        setCop(cops[j].id, c => ({ ...c, zap: false, baton: true }));
        setRaver(r.id, rr => ({ ...rr, line: Math.random() < 0.4 ? pick(["OW! ME HEAD!", "NOT THE FACE!", "I'LL BE GOOD!", "OI! THAT'S ME GOOD SIDE!"]) : null }));
      });
      for (let b = 0; b < 3; b++) {
        round.forEach(r => add({ kind: "burst", x: r.x - 10 + (Math.random() - 0.5) * 30, y: r.bottom + 110 + b * 12, size: 0, text: pick(["BONK!", "WHACK!", "THWACK!", "DONK!"]) }));
        round.forEach(r => add({ kind: "stars", x: r.x + 6, y: r.bottom + 104, size: 0, text: "★ ✦ ★" }));
        await later(450);
      }
      round.forEach((r, j) => setCop(cops[j].id, c => ({ ...c, baton: false })));
      // Into the scuffle cloud...
      round.forEach((r, j) => {
        setCop(cops[j].id, c => ({ ...c, zap: false, gone: true }));
        setRaver(r.id, rr => ({ ...rr, scuffle: true, line: null }));
        add({ kind: "burst", x: r.x - 20, y: r.bottom + 150, size: 0, text: pick(["SCUFFLE!", "OOF!", "BIFF!", "KERFUFFLE!"]) });
      });
      await later(1500);
      // ...and out comes a cuffed, frazzled bogan.
      round.forEach((r, j) => {
        setCop(cops[j].id, c => ({ ...c, gone: false }));
        setRaver(r.id, rr => ({ ...rr, scuffle: false, pose: "cuffed", line: Math.random() < 0.5 ? pick(CUFFED_LINES) : null }));
      });
      await later(700);
      // Frog-marched to the paddy wagon.
      const march = round.map(r => Math.max(1400, Math.abs(van.x - r.x) * 4 + Math.abs(van.bottom - r.bottom) * 3));
      round.forEach((r, j) => {
        const faceLeft = van.x < r.x, copX = van.x + (faceLeft ? 46 : -46);
        copAt[j] = copX;
        setRaver(r.id, rr => ({ ...rr, x: van.x, bottom: GROUND + 10, ms: march[j], faceLeft }));
        setCop(cops[j].id, c => ({ ...c, x: copX, bottom: GROUND + 10, ms: march[j], walking: true, faceLeft, line: Math.random() < 0.3 ? pick(RAVE_COP_LINES) : null }));
      });
      await later(Math.max(...march) + 100);
      round.forEach((r, j) => { setRaver(r.id, rr => ({ ...rr, gone: true, line: null })); setCop(cops[j].id, c => ({ ...c, walking: false })); });
      caught += round.length;
      add({ kind: "burst", x: van.x - 30, y: van.bottom + 80, size: 0, text: pick(["THUNK!", "IN YA GO!", "CLANG!"]) });
    }
    updRave(rv => ({ ...rv, gear: false }));
    setCop(cops[2].id, c => ({ ...c, line: "Right. Who's for a pie?" }));
    setCop(cops[1].id, c => ({ ...c, line: "Could've sworn there were more of 'em." }));
    speak(`Ha! ${caught} in the paddy wagon. Personal best, lads.`);
    await later(1600);
    // Everyone back in and off.
    updRave(rv => ({ ...rv, cops: rv.cops.map(c => ({ ...c, gone: true })) }));
    add({ kind: "burst", x: wagonX - 40, y: GROUND + 150, size: 0, text: "LET US OUT! TASMANIA ISN'T REAL!" });
    updRave(rv => ({ ...rv, vehicles: rv.vehicles.map(v => (v.kind === "wagon" ? { ...v, x: -v.w - 40, ms: 4200 } : v.flip ? { ...v, x: W + 40, flip: false, ms: 3000 } : { ...v, x: -v.w - 40, flip: true, ms: 3000 })) }));
    await later(4300);
    // Coast is clear.
    climbers.forEach((c, ci) => setRaver(c.id, r => ({ ...r, hiding: false, line: ci ? "…Is it safe?" : "Are they gone? …THEY'RE GONE!" })));
    await later(1400);
    climbers.forEach(c => setRaver(c.id, r => ({ ...r, bottom: TREE_BOTTOM - 6, ms: 1100, line: null })));
    await later(1150);
    climbers.forEach((c, ci) => {
      const away = c.x < W / 2;
      setRaver(c.id, r => ({ ...r, pose: "run", faceLeft: away, x: away ? -140 : W + 80, ms: 1800 + ci * 300, line: ci ? "WAIT FOR MEEE!" : "YA'LL NEVER TAKE ME ALIVE, COPPAS!" }));
    });
    await later(2200);
    setRave(null);
    busy.current = false;
  }

  // A few holes left where the shot went, a bit wide of whatever she was aiming at.
  function bulletHoles(el: Element, count: number) {
    const r = sRect(el), cx = r.left + r.width / 2, cy = window.innerHeight - (r.top + r.height / 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50;
      add({ kind: "hole", x: cx + Math.cos(angle) * dist, y: Math.max(GROUND + 4, cy + Math.sin(angle) * dist), size: 8 + Math.random() * 5 });
    }
  }
  function missed(el: Element) {
    const r = sRect(el);
    bulletHoles(el, 2 + Math.floor(Math.random() * 2));
    add({ kind: "burst", x: r.left - 10, y: window.innerHeight - r.top + 20, size: 0, text: "MISSED!" });
    if (Math.random() < 0.7) speak(pick(MISS_LINES));
  }

  // Clicking an animal: Shazz swings the sawn-off round if she's free, otherwise it just goes off.
  async function blast(target: Target, el: Element) {
    if (phaseRef.current === "hidden") return;
    if (phaseRef.current !== "parked" || busy.current || !bike.current) { hitTarget(target, el, "BLAM!"); return; }
    busy.current = true; setMenu(false);
    const box = sRect(el), faceLeft = box.left + box.width / 2 < place.current.x + bike.current.offsetWidth / 2;
    setFacingLeft(faceLeft); setPose("shotgun");
    await later(260);
    const k = s(), x = place.current.x, muzzle = faceLeft ? x + (VIEW_W - 192) * k : x + 192 * k, muzzleY = GROUND + (VIEW_H - 42) * k;
    add({ kind: "burst", x: muzzle - 40, y: muzzleY + 10, size: 0, text: "BLAM!" });
    for (let i = 0; i < 4; i++) add({ kind: "smoke", x: muzzle + (faceLeft ? -i * 8 : i * 8), y: muzzleY, size: 12 + i * 5 });
    place.current = { ...place.current, tilt: faceLeft ? 3 : -3 }; draw();
    if (Math.random() < 0.22 + drunkRef.current * 0.08) {
      missed(el);
      busy.current = false;
      await later(160);
      place.current = { ...place.current, tilt: 0 }; draw();
      await later(500);
      if (!busy.current) { setPose("ride"); setFacingLeft(false); }
      return;
    }
    hitTarget(target, el);
    if (Math.random() < 0.4) bulletHoles(el, 1);
    const bird = ["flyer", "flock", "raider", "ibis", "lorikeet"].includes(target.kind), pest = ["magpie", "dropBear", "dangler", "emu"].includes(target.kind);
    if (Math.random() < 0.55) speak(pick(bird ? BIRD_SHOT_LINES : pest ? PEST_SHOT_LINES : ANIMAL_SHOT_LINES));
    await later(160);
    place.current = { ...place.current, tilt: 0 }; draw();
    await later(500);
    setPose("ride"); setFacingLeft(false);
    busy.current = false;
  }
  const shootProps = (target: Target, title = "Shoot it!") => ({
    title,
    // Lets the "Shoot something" button find targets on screen.
    "data-shoot": JSON.stringify(target),
    onClick: (event: React.MouseEvent<HTMLElement>) => { event.stopPropagation(); void blast(target, event.currentTarget); },
  });
  // "Shoot something" from the menu: she picks something on screen, going for dinner first (roos,
  // emus, critters, snakes, koalas) so the crows and the tweakers get fed. Nothing about? A roo mob
  // or a mob of emus gets called in and she has a go at that.
  const DINNER_KINDS = ["roo", "emu", "crossing", "snake", "koala", "strikeRoo"];
  function shootSomething(retry = true) {
    const W = VW(), H = window.innerHeight;
    const onScreen = Array.from(document.querySelectorAll<HTMLElement>("[data-shoot]")).filter(el => {
      const r = sRect(el);
      return r.right > 10 && r.left < W - 10 && r.bottom > 0 && r.top < H;
    });
    const dinner = onScreen.filter(el => DINNER_KINDS.includes((JSON.parse(el.dataset.shoot!) as Target).kind));
    const el = pick(dinner.length ? dinner : onScreen.length ? onScreen : [null]);
    if (el) { const r = sRect(el); panTo(r.left + r.width / 2); void blast(JSON.parse(el.dataset.shoot!) as Target, el); return; }
    if (!retry) return;
    sceneUntil.current = 0;
    if (Math.random() < 0.5) rooMob(); else emuFlock();
    window.setTimeout(() => shootSomething(false), 2200);
  }

  // The postie putters past on the little red Honda, flinging letters.
  async function postieRun() {
    if (!claimScene(10_000)) return;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, w = isPhone() ? 130 : POSTIE_W;
    const start = dir === 1 ? -w - 10 : VW() + 10, end = dir === 1 ? VW() + 10 : -w - 10, ms = 9000;
    setPostie({ x: start, ms: 0, dir });
    await later(60);
    setPostie(pt => pt && { ...pt, x: end, ms });
    add({ kind: "burst", x: dir === 1 ? 20 : VW() - 200, y: GROUND + 120, size: 0, text: "BEEP BEEP!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) window.setTimeout(() => speak(pick(POSTIE_LINES)), 1500);
    const t0 = performance.now();
    for (let i = 0; i < 6; i++) {
      await later(1200);
      const t = Math.min(1, (performance.now() - t0) / ms), px = start + (end - start) * t + w / 2;
      add({ kind: "junk", x: px, y: GROUND + 110, size: 0, dx: (Math.random() - 0.5) * 160, dy: 60, arc: -(60 + Math.random() * 60), text: pick(["✉️", "📨", "📦", "🧾", "✉️"]) });
    }
    await later(Math.max(0, ms - 7200) + 200);
    setPostie(null);
  }

  // A kid on a BMX rides under a gum tree in swooping season. Bad idea.
  async function magpieSwoop() {
    if (!claimScene(14_000)) return;
    const tree = pick(treeSpots()), treeMid = tree.x + TREE.W / 2, dir: 1 | -1 = treeMid < VW() / 2 ? -1 : 1;
    const start = dir === 1 ? -KID_W - 10 : VW() + 10, end = dir === 1 ? VW() + 10 : -KID_W - 10;
    const meet = treeMid - KID_W / 2, rideMs = Math.max(2500, Math.abs(meet - start) * 6);
    setKid({ x: start, ms: 0, dir, panic: false, line: null, magpies: [] });
    await later(60);
    setKid(k => k && { ...k, x: meet, ms: rideMs, line: "Ding ding! Lovely day for a ride!" });
    await later(rideMs);
    // Out of the canopy they come.
    const canopyBottom = TREE_BOTTOM + TREE.H * 0.75, magpies = Array.from({ length: 5 }, (_, i) => {
      const ox = -10 + i * 28, oy = 84 + (i % 2) * 30;
      return { id: ++uid, ox, oy, sx: tree.x + TREE.W * (0.2 + Math.random() * 0.6) - (meet + ox), sy: -(canopyBottom - (GROUND + 2 + oy)), delay: i * 160 };
    });
    setKid(k => k && { ...k, panic: true, magpies, line: pick(KID_SCREAMS) });
    add({ kind: "burst", x: treeMid - 60, y: canopyBottom + 20, size: 0, text: "SWOOOOP!" });
    if (phaseRef.current === "parked" && !busy.current) window.setTimeout(() => speak(pick(MAGPIE_LINES)), 900);
    await later(1000);
    const fleeMs = Math.max(2000, Math.abs(end - meet) * 3.2);
    setKid(k => k && { ...k, x: end, ms: fleeMs });
    for (let t = 0; t < fleeMs; t += 1400) {
      await later(1400);
      setKid(k => { if (k && k.magpies.length) add({ kind: "burst", x: Math.max(20, Math.min(VW() - 200, meet + (end - meet) * Math.min(1, (t + 1400) / fleeMs))), y: GROUND + 190, size: 0, text: pick(["CLACK CLACK!", "SWOOP!", "CAROL-CAROL!"]) }); return k; });
    }
    await later(300);
    setKid(null);
  }

  // The resident flock: they live on (and around) the wheelie bin. Click one and the lot take
  // off; about 14s later they pass over once, and at about 30s they come home to the bin.
  const flockSpots = () => {
    const bx = binX();
    return [
      { x: bx - 8, bottom: BIN_BOTTOM + BIN_H - 12, onBin: true },
      { x: bx + 18, bottom: BIN_BOTTOM + BIN_H - 12, onBin: true },
      { x: bx - 72, bottom: BIN_BOTTOM - 6, onBin: false },
      { x: bx - 40, bottom: BIN_BOTTOM - 10, onBin: false },
      { x: bx + BIN_W + 6, bottom: BIN_BOTTOM - 8, onBin: false },
      { x: bx + BIN_W + 40, bottom: BIN_BOTTOM - 4, onBin: false },
    ].filter((_, i) => !isPhone() || [0, 1, 4].includes(i)).slice(0, FLOCK_SIZE);
  };
  useEffect(() => {
    if (phase !== "enter" && phase !== "parked") return;
    setFlock(fl => fl ?? { dir: 1, stage: "landed", birds: flockSpots().map(sp => ({ ...sp, ms: 0 })) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // While they're home, every so often one digs something out of the bin.
  useEffect(() => {
    if (phase !== "parked") return;
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => {
      if (!flockBusy.current && !sceneActive()) {
        const bx = binX();
        setBinRattle(true);
        add({ kind: "junk", x: bx + BIN_W / 2, y: BIN_BOTTOM + BIN_H, size: 0, dx: (Math.random() - 0.5) * 220, dy: BIN_H + 10, arc: -(60 + Math.random() * 80), text: pick(BIN_JUNK) });
        window.setTimeout(() => setBinRattle(false), 900);
      }
      next();
    }, 10_000 + Math.random() * 8000); };
    next();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // Mouse gets close: that bird flaps and hops away from it, like it is about to take off.
  // Mouse over the flock: the birds closest to it stand up tall, look at it and shuffle away.
  function alertNear(clientX: number, clientY: number) {
    if (flockBusy.current || !flock || flock.stage !== "landed") return;
    const cy = window.innerHeight - clientY, next: Record<number, -1 | 1> = {};
    flock.birds.forEach((b, i) => {
      const bx = b.x + 35, by = b.bottom + 35;
      if (Math.hypot(bx - clientX, by - cy) < 120) next[i] = clientX < bx ? 1 : -1;
    });
    setSpooked(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }
  async function scatterFlock() {
    if (flockBusy.current || flock?.stage !== "landed") return;
    flockBusy.current = true;
    setSpooked({}); setFlockHover(false);
    const bx = binX(), gone = () => phaseRef.current === "hidden" || phaseRef.current === "leave";
    add({ kind: "burst", x: bx - 40, y: BIN_BOTTOM + BIN_H + 50, size: 0, text: "SQUAAAWK!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) speak(pick(["Ha! Go on, scatter, ya bin chickens!", "Shoo! Take ya stink with ya!", "They'll be back. They're always back."]));
    // Up and off the left edge.
    setFlock(fl => fl && { ...fl, dir: -1, stage: "out", birds: fl.birds.map((b, i) => ({ ...b, shot: false, x: -160 - i * 50, bottom: window.innerHeight * (0.55 + (i % 3) * 0.08), ms: 1800 + i * 150 })) });
    await later(14_000);
    if (gone()) { flockBusy.current = false; return; }
    // One lap over the top, left to right.
    setFlock(fl => fl && { ...fl, dir: 1, stage: "pass", birds: fl.birds.map((b, i) => ({ ...b, x: VW() + 80 + i * 60, bottom: window.innerHeight * (0.62 + (i % 3) * 0.07), ms: 7000 + i * 200 })) });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.5) window.setTimeout(() => speak("Check out those white pointers!!"), 1500);
    await later(13_000);
    if (gone()) { flockBusy.current = false; return; }
    // Home again: in from the right and back onto the bin.
    setFlock(fl => fl && { ...fl, dir: -1, stage: "in", birds: flockSpots().map((sp, i) => ({ ...sp, ms: 2600 + i * 180 })) });
    await later(2600 + FLOCK_SIZE * 180 + 100);
    setFlock(fl => fl && { ...fl, stage: "landed" });
    add({ kind: "burst", x: bx - 40, y: BIN_BOTTOM + BIN_H + 50, size: 0, text: "SQUAWK SQUAWK!" });
    flockBusy.current = false;
  }

  // A drop bear falls out of a gum tree, lands with a thud, snarls, and bolts for the bush.
  async function dropBearAttack() {
    if (dropBusy.current || !claimScene(5000)) return;
    dropBusy.current = true;
    const tree = pick(treeSpots());
    const x = tree.x + TREE.W * 0.55, top = TREE_BOTTOM + TREE.H * 0.62;
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
    const toLeft = x < VW() / 2;
    setDropBear(d => d && { ...d, faceLeft: toLeft, x: toLeft ? -80 : VW() + 40, ms: 1600, ease: "cubic-bezier(.5,0,.8,.6)" });
    await later(1700);
    setDropBear(null);
    dropBusy.current = false;
  }

  // Sportsbikes scream past like the cars, faster.
  // The red one is a proper missile: gone in well under a second. She always has something to say.
  function spawnSportbike() {
    const lane: "far" | "near" = Math.random() < 0.5 ? "far" : "near", dir: 1 | -1 = lane === "far" ? 1 : -1;
    const color = pick(SPORTBIKE_COLORS), red = color === RED_BIKE;
    const ms = red ? 380 + Math.random() * 80 : 1900 + Math.random() * 900;
    setSportbikes(list => [...list, { id: ++uid, dir, lane, color, ms }]);
    if (red) {
      // So fast it leaves a trail of smoke hanging over the road behind it.
      const bw = sportbikeW(), from = dir === 1 ? -bw - 10 : VW(), to = dir === 1 ? VW() : -bw - 10, laneY = (lane === "far" ? FAR_LANE : GROUND) + 16;
      for (let i = 0; i <= 14; i++) window.setTimeout(() => add({ kind: "smoke", x: from + (to - from) * (i / 14) + (dir === 1 ? 14 : bw - 14), y: laneY + Math.random() * 10, size: 26 + Math.random() * 18 }), (i / 14) * ms);
    }
    add({ kind: "burst", x: dir === 1 ? 20 : VW() - 260, y: (lane === "far" ? FAR_LANE : GROUND) + 70, size: 0, text: red ? "NYEEEEEEOOOWWWWW!!!" : "NEEEEOWWW!" });
    if (red) for (let i = 0; i < 4; i++) add({ kind: "smoke", x: dir === 1 ? 10 + i * 30 : VW() - 10 - i * 30, y: (lane === "far" ? FAR_LANE : GROUND) + 20, size: 18 + i * 6 });
    if (phaseRef.current === "parked") window.setTimeout(() => speak(pick(red ? RED_BIKE_LINES : SPORTBIKE_LINES)), red ? 500 : 900);
  }

  // A roo hops out in front of a family wagon: BONK. Roo becomes roadkill, car limps off dented.
  async function rooStrike() {
    if (strikeBusy.current) return;
    strikeBusy.current = true;
    if (!claimScene(12_000)) { strikeBusy.current = false; return; }
    strikeRooShot.current = false;
    const rooX = Math.round(VW() * (0.4 + Math.random() * 0.2)), carW = isPhone() ? 150 : 200;
    const impactCarX = rooX - carW * 0.93, runIn = 2400;
    setStrike({ carX: -carW - 20, carMs: 0, color: pick(CAR_COLORS), dented: false, rooX, rooBottom: ROAD_H + 40, rooMs: 0, rooGone: false, shaking: false });
    await later(60);
    setStrike(st => st && { ...st, carX: impactCarX, carMs: runIn, rooBottom: FAR_LANE + 8, rooMs: runIn });
    await later(runIn);
    if (strikeRooShot.current) {
      // Shazz got Skippy first; the wagon just drives on through.
      setStrike(st => st && { ...st, carX: VW() + 40, carMs: 3500 });
      await later(3600);
      setStrike(null); strikeBusy.current = false;
      return;
    }
    add({ kind: "boom", x: rooX - 120, y: FAR_LANE + 110, size: 0, text: "BONK!" });
    add({ kind: "splat", x: rooX, y: FAR_LANE + 10, size: 46 });
    add({ kind: "rooFly", x: rooX, y: FAR_LANE + 20, size: 0, dx: 160 + Math.random() * 120, dy: FAR_LANE + 20 - GROUND, arc: -130 });
    setStrike(st => st && { ...st, dented: true, rooGone: true, shaking: true });
    if (phaseRef.current === "parked" && !busy.current) speak(pick(STRIKE_LINES));
    for (let i = 0; i < 6; i++) { add({ kind: "smoke", x: impactCarX + carW * 0.92, y: FAR_LANE + 50, size: 18 + i * 5 }); await later(160); }
    setStrike(st => st && { ...st, shaking: false, carX: VW() + 40, carMs: 6000 });
    await later(6100);
    setStrike(null);
    strikeBusy.current = false;
  }
  const rooLanded = (item: Fx) => {
    remove(item.id);
    const x = Math.max(20, Math.min(VW() - 90, item.x + (item.dx || 0) - 36));
    setKills(list => [...list, { id: ++uid, kind: "roo", x, bornAt: Date.now() }]);
  };

  // Drop bears lower down on a web thread from the gum trees, dangle a bit, and climb back up.
  function spawnDangler() {
    const tree = pick(treeSpots());
    const x = tree.x + TREE.W * (0.3 + Math.random() * 0.4), top = window.innerHeight - (TREE_BOTTOM + TREE.H * 0.78);
    setDanglers(list => [...list, { id: ++uid, x, top, ms: 7000 + Math.random() * 3000 }]);
  }

  // Hoop snakes slither out onto the road. Then they either hoop up and roll off at speed,
  // or sit there too long and cop a tyre.
  async function snakeRun() {
    if (!claimScene(11_000)) return;
    const id = ++uid, dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, lane: "far" | "near" = Math.random() < 0.5 ? "far" : "near";
    const bottom = lane === "far" ? FAR_LANE + 8 : GROUND + 6, start = dir === 1 ? -130 : VW() + 10;
    const stop = VW() * (0.3 + Math.random() * 0.4), slitherMs = Math.min(7000, Math.abs(stop - start) * 9);
    const update = (change: (sn: Snake) => Snake) => setSnakes(list => list.map(sn => (sn.id === id ? change(sn) : sn)));
    const shot = () => shotIds.current.has(id);
    setSnakes(list => [...list, { id, x: start, bottom, ms: 0, dir, mode: "slither", done: false }]);
    await later(60);
    update(sn => ({ ...sn, x: stop, ms: slitherMs }));
    await later(slitherMs);
    if (!shot() && Math.random() < 0.45) {
      await runOver(stop, lane, 120);
      if (!shot()) {
        update(sn => ({ ...sn, mode: "flat" }));
        add({ kind: "burst", x: stop, y: bottom + 70, size: 0, text: pick(["SQUISH!", "SPLAT!", "HSSSK—"]) });
        if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) window.setTimeout(() => speak(pick(SNAKE_SPLAT_LINES)), 600);
        await later(900);
        update(sn => ({ ...sn, done: true }));
        if (phaseRef.current === "parked" && killsRef.current.length < 6) setKills(list => [...list, { id: ++uid, kind: "snake", x: stop + 20, bottom: bottom - 6, bornAt: Date.now() }]);
      }
    } else if (!shot()) {
      // Bites its own tail and off it goes.
      update(sn => ({ ...sn, mode: "hoop", x: dir === 1 ? stop + 70 : stop, ms: 0 }));
      add({ kind: "burst", x: stop, y: bottom + 70, size: 0, text: "HOOP!" });
      if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.5) window.setTimeout(() => speak(pick(SNAKE_LINES)), 700);
      await later(450);
      const end = dir === 1 ? VW() + 20 : -80, ms = Math.abs(end - stop) * 2.2;
      update(sn => ({ ...sn, x: end, ms }));
      await later(ms);
    }
    await later(200);
    setSnakes(list => list.filter(sn => sn.id !== id));
  }

  // Dazza the bludger wanders up for a durry and a few bucks, then cops a drop bear.
  async function dazzaVisit() {
    if (dazzaBusy.current || !claimScene(28_000)) return;
    dazzaBusy.current = true;
    const tree = pick(treeSpots());
    const standX = tree.x + TREE.W * 0.35, fromRight = standX > VW() / 2;
    const start = fromRight ? VW() + 20 : -140;
    const walkMs = Math.max(2500, Math.abs(standX - start) * 7);
    setDazza({ x: start, ms: 0, faceLeft: fromRight, pose: "walk", bear: false, line: null, bearTop: null });
    await later(60);
    setDazza(d => d && { ...d, x: standX, ms: walkMs });
    await later(walkMs);
    setDazza(d => d && { ...d, pose: "ask", line: pick(DAZZA_ASKS) });
    await later(4500);
    if (phaseRef.current === "parked" && !busy.current) speak(pick(SHAZZ_TO_DAZZA));
    await later(3500);
    if (Math.random() < 0.6) {
      // Bin chickens overhead: out comes the slug gun.
      const dir: 1 | -1 = fromRight ? 1 : -1, base = GROUND + 250 + Math.random() * 90, ids = [++uid, ++uid, ++uid];
      setFlyers(list => [...list, ...ids.map((id, i) => ({ id, dir, bottom: base + (i % 2 ? 40 : -10) * Math.ceil(i / 2), ms: 8000 + i * 220, delay: i * 300 }))]);
      setDazza(d => d && { ...d, line: "Hang on... BIN CHICKENS! Where's me slug gun?" });
      await later(1600);
      setDazza(d => d && { ...d, pose: "aim", line: null });
      const muzzleX = fromRight ? standX - 4 : standX + 62 * 1.8, muzzleY = GROUND + 2 + (100 - 16) * 1.8;
      let hits = 0;
      for (const id of ids) {
        await later(800);
        add({ kind: "burst", x: muzzleX - 30, y: muzzleY + 20, size: 0, text: "PEW!" });
        add({ kind: "smoke", x: muzzleX, y: muzzleY, size: 14 });
        const bird = document.querySelector(`[data-bird="f${id}"]`);
        if (bird && Math.random() < 0.8) { hitTarget({ kind: "flyer", id }, bird, "POOF!"); hits++; }
      }
      setDazza(d => d && { ...d, pose: "ask", line: hits ? "Ha! Pillow stuffin'. Now spare us a durry?" : "Missed the lot. Spare us a durry anyway?" });
      if (phaseRef.current === "parked" && !busy.current) window.setTimeout(() => speak(hits ? "Not bad, Dazza. Still not getting a durry." : "Couldn't hit a barn with that, ya drongo."), 1200);
      await later(3000);
    }
    // Drop bear straight onto his head from the gum above.
    setDazza(d => d && { ...d, line: null, bearTop: window.innerHeight - (TREE_BOTTOM + TREE.H * 0.7) });
    await later(80);
    setDazza(d => d && { ...d, bearTop: window.innerHeight - (GROUND + 234) });
    await later(600);
    add({ kind: "burst", x: standX - 40, y: GROUND + 240, size: 0, text: "THUD!" });
    setDazza(d => d && { ...d, bear: true, bearTop: null, pose: "run", line: "AAARGH! DROP BEAR! GET IT OFF!" });
    await later(1400);
    if (phaseRef.current === "parked" && !busy.current) speak(pick(["Told ya not to stand under the gum tree, Dazza!", "Ha! Karma, ya bludger!", "Vegemite behind the ears next time, Dazza!"]));
    const exit = fromRight ? VW() + 40 : -160;
    setDazza(d => d && { ...d, faceLeft: !fromRight, x: exit, ms: 1800 });
    await later(1900);
    setDazza(null);
    dazzaBusy.current = false;
  }

  // The director: one act on the road at a time. Every few seconds, if nothing's on and Shazz
  // isn't mid-trick, it picks the next thing (weighted) — a car, then maybe some birds later, etc.
  useEffect(() => {
    if (phase !== "parked") return;
    const acts: [number, () => void][] = [
      // Traffic and people
      [4, () => { if (claimScene(6000, 5000)) spawnCar(); }],
      [5, () => { if (claimScene(2500, 5000)) spawnSportbike(); }],
      [1, () => void postieRun()],
      [1, () => void dazzaVisit()],
      // Animals: most of the show
      [2, () => { if (claimScene(9000, 6000)) spawnFlyers(); }],
      [5, () => void spawnKill()],
      [3, () => { if (claimScene(10_000, 6000)) spawnDangler(); }],
      [4, () => void snakeRun()],
      [4, () => rooMob()],
      [3, () => void dropBearAttack()],
      [3, () => void rooStrike()],
      [2, () => void magpieSwoop()],
      [5, () => void lorikeetVisit()],
      [3, () => void trueBlueVisit()],
      [3, () => emuFlock()],
      [5, () => void tweakerAct()],
    ];
    // On a phone there isn't room for all of it: only cars, bikes and roadkill come by themselves,
    // and the wildlife and locals are buttons in the tricks menu instead.
    const phoneActs = [acts[0], acts[1], acts[5]];
    let timer = 0;
    const tick = () => {
      if (!sceneActive() && !busy.current) {
        const pool = isPhone() ? phoneActs : acts, total = pool.reduce((sum, [weight]) => sum + weight, 0);
        let roll = Math.random() * total;
        const act = pool.find(([weight]) => (roll -= weight) < 0) ?? pool[0];
        act[1]();
      }
      timer = window.setTimeout(tick, 5000 + Math.random() * 4000);
    };
    // Lorikeets open the show shortly after she parks.
    const opener = window.setTimeout(() => { if (!isPhone()) void lorikeetVisit(); }, 3000);
    timer = window.setTimeout(tick, 4000);
    return () => { clearTimeout(opener); clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A mob of emus legs it across the road, all neck and knees.
  function emuFlock() {
    if (!claimScene(8000)) return;
    const W = VW(), dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, count = 5 + Math.floor(Math.random() * 3);
    const flock = Array.from({ length: count }, (_, i) => {
      const size = 62 + Math.random() * 18;
      return { id: ++uid, dir, size, x: dir === 1 ? -size - 40 - i * 70 - Math.random() * 40 : W + 40 + i * 70 + Math.random() * 40, bottom: [GROUND + 2, FAR_LANE + 6, ROAD_H - 8][i % 3] + Math.random() * 8, ms: 0, hits: 0 };
    });
    setEmus(list => [...list, ...flock]);
    window.setTimeout(() => setEmus(list => list.map(e => {
      const f = flock.find(x => x.id === e.id);
      if (!f) return e;
      const end = dir === 1 ? W + 100 : -f.size - 40;
      return { ...e, x: end, ms: Math.abs(end - f.x) * 3 };
    })), 60);
    add({ kind: "burst", x: dir === 1 ? 20 : W - 240, y: GROUND + 150, size: 0, text: "THUD THUD THUD THUD!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.5) window.setTimeout(() => speak(pick(["EMUS! Lock up the barbie!", "They won the Great Emu War, ya know. Cocky buggers.", "Look at the knees on 'em!"])), 1000);
  }
  function rooMob() {
    if (!claimScene(8000)) return;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, count = 4 + Math.floor(Math.random() * 3), ms = 5500 + Math.random() * 2000;
    // Spread them across the back of the road; bigger ones are "closer".
    setRoos(list => [...list, ...Array.from({ length: count }, (_, i) => {
      const size = 62 + Math.random() * 30;
      return { id: ++uid, dir, size, bottom: ROAD_H - 4 - (size - 62) * 0.8 + (i % 2) * 10, ms: ms + (Math.random() - 0.5) * 900, delay: i * 380 + Math.random() * 200, hop: 520 + Math.random() * 140, joey: i === 1 };
    })]);
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.6) window.setTimeout(() => speak(pick(ROO_LINES)), 1200);
  }

  // During the barbie: one swoops in, nicks a snag off the plate, and flaps off with it.
  async function snagRaid(plateX: number, plateBottom: number) {
    const w = 84;
    setRaider({ x: VW() + 40, bottom: window.innerHeight * 0.65, ms: 0, faceLeft: true, carrying: null });
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
    const w = isPhone() ? 150 : 210, k = w / VIEW_W;
    setWidth(w); setPhase("enter"); setPose("ride"); void loadAi();
    const park = VW() - w - 16;
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
    setAtX(park); setPhase("parked"); panTo(park + w / 2);
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
      const end = VW() + 120; let lastRear = rear;
      await animate(1400, t => {
        const x = x0 + (end - x0) * t * t * t, now = performance.now();
        place.current = weave(t, x, -Math.min(16, t * 60) * (t < 0.8 ? 1 : (1 - t) * 5), 60);
        if (now - lastPuff > 50) { lastPuff = now; add({ kind: "smoke", x: x + 16 * k, y: GROUND + (VIEW_H - 128) * k, size: 16 + Math.random() * 12 }); }
        const r = x + 60 * k;
        if (t < 0.35 && r > lastRear) { add({ kind: "skid", x: lastRear, y: GROUND + 5 * k, size: r - lastRear + 1 }); lastRear = r; }
      });
    }
    place.current = { x: -500, tilt: 0, pivot: 60 }; draw();
    setKills([]); setIbis(null); ibisBusy.current = false; setBbq(null); setFlyers([]); setRaider(null); setFlock(null); flockBusy.current = false; setRoos([]); setEmus([]); setDropBear(null); dropBusy.current = false; setSportbikes([]); setStrike(null); strikeBusy.current = false; setDanglers([]); setSnakes([]); setDazza(null); dazzaBusy.current = false; setNev(null); nevRun.current++; setBlue(null); blueBusy.current = false; setBlueAnimal(null); setBlueBirds(null); setPelican(null); setRoadFish(null); setGary(null); garyBusy.current = false; setCrossings([]); crossingCount.current = 0; setCrows([]); setLorikeets([]); setPoops({}); setTrev(null); setCookout(null); setRave(null); setThieves({ trev: null, kylie: null, stolenRed: false, bricked: false }); setHitters([]); setPostie(null); setKid(null); setShotKoalas([]); shotIds.current.clear(); sceneUntil.current = 0; setTattoo(null); setConvoy(0); setBrawl(null);
    setPhase("hidden");
  }

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("day-out-smartarse-muted") === "1");
      setClean(localStorage.getItem("day-out-smartarse-clean") !== "0");
    } catch { setMuted(false); }
    const keepInView = (w: number) => {
      const x = Math.max(8, Math.min(place.current.x, VW() - w - 8));
      if (x !== place.current.x) { place.current.x = x; draw(); setAtX(x); }
    };
    setPhoneView(isPhone());
    const onResize = () => {
      setPhoneView(isPhone());
      if (phaseRef.current === "hidden" || !bike.current) return;
      const w = isPhone() ? 150 : 210;
      setWidth(w);
      if (phaseRef.current === "parked") keepInView(w);
    };
    const watchdog = window.setInterval(() => {
      if (phaseRef.current === "parked" && !busy.current && bike.current) keepInView(bike.current.offsetWidth);
    }, 2000);
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); clearInterval(watchdog); cancelAnimationFrame(frame.current); };
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
  // ---- Gumtree Gary: lives up the right-hand roadside gum, eats whatever lands on the road ----
  const garyHome = () => {
    const trees = treeSpots(), t = trees[trees.length - 1];
    return { x: t.x + TREE.W * 0.45 - 33, bottom: TREE_BOTTOM + TREE.H * 0.48, base: TREE_BOTTOM - 6 };
  };
  useEffect(() => {
    if (phase !== "parked") return;
    const h = garyHome();
    setGary({ mode: "hiding", x: h.x, bottom: h.bottom, ms: 0, faceLeft: false, pose: "dance", carrying: null, fish: false, line: null });
    // Every so often, if there's roadkill on the road, down he comes for it.
    const timer = window.setInterval(() => {
      if (garyBusy.current || busy.current) return;
      const kill = killsRef.current.find(k => !k.claimed && Date.now() - k.bornAt > 12_000);
      if (!kill || Math.random() < 0.4) return;
      setKills(list => list.map(k => (k.id === kill.id ? { ...k, claimed: true } : k)));
      void garyFetch(kill.x + 30, kill.bottom ?? GROUND - 2, () => setKills(list => list.filter(k => k.id !== kill.id)), kill.kind);
    }, 9000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // Down the trunk, over to it, grab it, back up the tree. Fish go straight in the gob on the spot;
  // roadkill gets carried up and eaten up the tree.
  async function garyFetch(targetX: number, targetBottom: number, grab: () => void, critter: Critter | "fish") {
    while (garyBusy.current) await later(500);
    garyBusy.current = true;
    const h = garyHome(), isFish = critter === "fish";
    setGary(g => g && { ...g, mode: "out", x: h.x, bottom: h.bottom, ms: 0, pose: "dance", line: isFish ? pick(["Ooh! FISH!", "Is someone gonna eat that?"]) : pick(["Dinner's served!", "Nobody's usin' that, eh?"]) });
    await later(400);
    setGary(g => g && { ...g, bottom: h.base, ms: 1000, line: null });
    await later(1050);
    const runMs = Math.max(700, Math.abs(targetX - 33 - h.x) * 3);
    setGary(g => g && { ...g, pose: "run", x: targetX - 33, bottom: Math.max(GROUND - 2, targetBottom), ms: runMs, faceLeft: targetX - 33 < h.x });
    await later(runMs + 50);
    grab();
    if (isFish) {
      setGary(g => g && { ...g, fish: true, line: "Into the gob!" });
      await later(800);
      setGary(g => g && { ...g, fish: false, line: "GULP!" });
      add({ kind: "burst", x: targetX - 30, y: GROUND + 130, size: 0, text: "NOM!" });
      await later(600);
    } else {
      setGary(g => g && { ...g, carrying: critter, line: "Mine now!" });
      await later(600);
    }
    setGary(g => g && { ...g, x: h.x, bottom: h.base, ms: runMs, faceLeft: h.x < targetX - 33, line: null });
    await later(runMs + 50);
    setGary(g => g && { ...g, pose: "dance", bottom: h.bottom, ms: 1000 });
    await later(1050);
    setGary(g => g && { ...g, mode: "hiding", carrying: null });
    if (!isFish) add({ kind: "burst", x: h.x, y: h.bottom + 140, size: 0, text: "NOM NOM NOM" });
    garyBusy.current = false;
  }

  // Click a tweaker: out they come and go absolutely mental on the dance floor for five seconds.
  async function boogieOut(who: "trev" | "kylie" | "gary") {
    if (boogie || (who === "gary" && garyBusy.current)) return;
    if (who === "gary") garyBusy.current = true;
    const trees = treeSpots(), tree = who === "gary" ? trees[trees.length - 1] : trees[who === "trev" ? 0 : 1];
    if (!tree) { if (who === "gary") garyBusy.current = false; return; }
    const trunk = tree.x + TREE.W * 0.45, x = who === "trev" ? trunk - 96 : trunk + 26;
    const lines = ["WOOOOOO!", "THIS IS MY JAM!", "UNTZ UNTZ UNTZ!", "CAN'T STOP, WON'T STOP!", "DOOF DOOF DOOF!", "WATCH THIS! …WATCH THIS!"];
    setBoogie({ who, x, line: pick(lines) });
    panTo(x + 33);
    for (let i = 0; i < 6; i++) {
      add({ kind: "junk", x: x + 33, y: TREE_BOTTOM + 90, size: 0, dx: (Math.random() - 0.5) * 140, dy: 20, arc: -(60 + Math.random() * 60), text: pick(["🎵", "🎶", "✨"]) });
      if (i === 3) setBoogie(b => b && { ...b, line: pick(lines) });
      await later(830);
    }
    setBoogie(null);
    if (who === "gary") garyBusy.current = false;
  }

  // Gary on all fours for a pat from True Blue: down the tree, scamper over (returns once he's there).
  async function garyComeForPat(petX: number) {
    while (garyBusy.current) await later(400);
    garyBusy.current = true;
    const h = garyHome();
    setGary(g => g && { ...g, mode: "out", x: h.x, bottom: h.bottom, ms: 0, pose: "dance", carrying: null, fish: false, line: "Woof?" });
    await later(500);
    setGary(g => g && { ...g, bottom: h.base, ms: 1000, line: null });
    await later(1050);
    const ms = Math.max(900, Math.abs(petX - h.x) * 4);
    setGary(g => g && { ...g, pose: "crawl", x: petX, bottom: ROAD_H - 12, ms, faceLeft: petX < h.x });
    await later(ms + 50);
    setGary(g => g && { ...g, faceLeft: true, line: "*pant pant*" });
  }
  // ...then back to his tree, leg up against the trunk for a wee, and up he goes.
  async function garyGoHome() {
    const h = garyHome(), byTrunk = h.x + 34;
    setGary(g => g && { ...g, line: null, x: byTrunk, bottom: TREE_BOTTOM - 8, ms: 1600, faceLeft: false });
    await later(1650);
    setGary(g => g && { ...g, pose: "pee", line: null });
    add({ kind: "burst", x: byTrunk - 40, y: TREE_BOTTOM + 70, size: 0, text: "psssssst" });
    await later(2200);
    setGary(g => g && { ...g, pose: "dance", x: h.x, bottom: h.base, ms: 300 });
    await later(350);
    setGary(g => g && { ...g, bottom: h.bottom, ms: 1000 });
    await later(1050);
    setGary(g => g && { ...g, mode: "hiding" });
    garyBusy.current = false;
  }

  // ---- True Blue: staggers down the road with his VB, sings, pats every animal, kisses fish ----
  // `now`: called from the tricks menu, so he comes straight away instead of waiting his turn.
  async function trueBlueVisit(now = false) {
    if (blueBusy.current) return;
    if (now) sceneUntil.current = Date.now() + 64_000;
    else if (!claimScene(60_000, 4000)) return;
    blueBusy.current = true;
    const W = VW(), stand = Math.round(W * 0.36), say = (line: string | null) => setBlue(b => b && { ...b, line });
    const pose = (p: TrueBluePose) => setBlue(b => b && { ...b, pose: p });
    setBlue({ x: -80, ms: 0, faceLeft: false, pose: "walk", line: "🎵 Hey True Blue! Is it me and you? 🎵", fish: false });
    panTo(stand);
    await later(60);
    const walkMs = Math.max(4000, (stand + 80) * 11);
    setBlue(b => b && { ...b, x: stand, ms: walkMs });
    await later(walkMs);
    pose("drink"); say("Ahh. Nothin' beats a hard-earned thirst.");
    await later(2600);
    pose("stand"); say("A hard-earned thirst needs a big cold beer!");
    await later(2600);
    // The animals queue up for a pat, one at a time.
    const pets = (["roo", "koala", "wombat", "dropbear", "croc"] as const).slice().sort(() => Math.random() - 0.5).slice(0, 4);
    for (const kind of pets) {
      setBlueAnimal({ kind, x: W + 40, ms: 0, faceLeft: true });
      await later(60);
      setBlueAnimal(a => a && { ...a, x: stand + 62, ms: 1800 });
      await later(1850);
      pose("pet"); say(PET_LINES[kind]);
      for (let i = 0; i < 3; i++) { add({ kind: "burst", x: stand + 70, y: ROAD_H + 40 + i * 14, size: 0, text: i === 1 ? "pat pat" : "♥" }); await later(450); }
      pose("stand");
      setBlueAnimal(a => a && { ...a, x: W + 40, ms: 1600, faceLeft: false });
      await later(700);
    }
    setBlueAnimal(null); say(null);
    // Gumtree Gary wants one too.
    await garyComeForPat(stand + 60);
    pose("pet"); say("Who's a good boy, Gary? Who's a GOOD boy?");
    for (let i = 0; i < 3; i++) { add({ kind: "burst", x: stand + 70, y: ROAD_H + 40 + i * 14, size: 0, text: i === 1 ? "pat pat" : "♥" }); await later(450); }
    pose("stand");
    void garyGoHome();
    await later(1700);
    say("Oh, ya filthy animal. Not on the gum tree!");
    await later(2400);
    say(null);
    // Birds: a lorikeet onto his shoulder, a bin chicken beside him.
    setBlueBirds({ lori: { x: -40, bottom: window.innerHeight * 0.7, ms: 0, landed: false }, ibis: { x: W + 40, bottom: window.innerHeight * 0.6, ms: 0, landed: false } });
    await later(60);
    setBlueBirds({ lori: { x: stand + 22, bottom: ROAD_H - 10 + 84, ms: 1800, landed: false }, ibis: { x: stand - 70, bottom: ROAD_H - 14, ms: 2200, landed: false } });
    await later(2300);
    setBlueBirds(bb => bb && { lori: bb.lori && { ...bb.lori, landed: true }, ibis: bb.ibis && { ...bb.ibis, landed: true } });
    say("G'day, birds! Plenty of room on the shoulder.");
    await later(2600);
    // Fish from the sky (twice): the pelican drops one into his hand, he kisses it and lobs it on the road.
    const gary = garyHome();
    for (let round = 0; round < 2; round++) {
      setPelican({ x: -120, bottom: window.innerHeight * 0.78, ms: 0, fish: true });
      await later(60);
      setPelican({ x: stand - 10, bottom: ROAD_H + 190, ms: 2200, fish: true });
      pose("catch"); say(round ? "Another one! Ya spoil me!" : "Here she comes!");
      await later(2250);
      setPelican(p => p && { ...p, fish: false });
      add({ kind: "junk", x: stand + 50, y: ROAD_H + 200, size: 0, dx: 0, dy: 120, arc: -10, text: "🐟" });
      await later(900);
      setPelican(p => p && { ...p, x: W + 160, bottom: window.innerHeight * 0.85, ms: 2600 });
      setBlue(b => b && { ...b, pose: "kiss", fish: true, line: "MWAH! Ya beautiful thing." });
      add({ kind: "burst", x: stand + 10, y: ROAD_H + 150, size: 0, text: "♥ MWAH ♥" });
      await later(1800);
      setBlue(b => b && { ...b, pose: "toss", fish: false, line: "Off ya go, mate!" });
      const landX = gary.x + 20 + (Math.random() - 0.5) * 60, handX = stand + 60, handY = ROAD_H - 10 + 108;
      add({ kind: "junk", x: handX, y: handY, size: 0, dx: landX - handX, dy: handY - (GROUND + 8), arc: -110, text: "🐟" });
      await later(950);
      setRoadFish({ x: landX });
      pose("stand");
      if (round === 0) await later(400);
      void garyFetch(landX + 12, GROUND - 2, () => setRoadFish(null), "fish");
      await later(round === 0 ? 3500 : 1500);
    }
    setPelican(null);
    // Off he staggers, singing.
    setBlueBirds(bb => bb && { lori: bb.lori && { ...bb.lori, landed: false, x: W + 60, bottom: window.innerHeight * 0.8, ms: 2400 }, ibis: bb.ibis && { ...bb.ibis, landed: false, x: -80, ms: 3000 } });
    setBlue(b => b && { ...b, pose: "walk", line: "🎵 Hey True Blue… 🎵 Hooroo, cobbers!", x: W + 80, ms: Math.max(4000, (W - stand) * 11) });
    if (!busy.current) speak(pick(["Hey True Blue! Legend.", "That bloke's patted more roos than I've had hot dinners.", "Kissin' fish on a Tuesday. Living the dream."]));
    await later(Math.max(4000, (W - stand) * 11));
    setBlue(null); setBlueBirds(null);
    blueBusy.current = false;
  }

  useEffect(() => { onPresence?.(phase !== "hidden"); }, [phase, onPresence]);
  useEffect(() => {
    if (phase === "hidden") return;
    const make = () => {
      const strip = document.querySelector<HTMLElement>(`.${styles.shopStrip}`);
      document.body.style.paddingBottom = `${(strip?.offsetHeight ?? 0) + ROAD_H + 16}px`;
    };
    make();
    const late = window.setTimeout(make, 600);
    window.addEventListener("resize", make);
    return () => { clearTimeout(late); window.removeEventListener("resize", make); document.body.style.paddingBottom = ""; };
  }, [phase]);
  // Nev only turns up when the "Dad?" button is pressed. He shuffles in, wanders about looking
  // for his boy (slow, like an old bloke should be: 14ms a pixel), shakes his cane now and then,
  // and after a minute he gives up for the day and walks off screen.
  const nevRun = useRef(0);
  function nevVisit() {
    if (nev || phaseRef.current !== "parked") return;
    const run = ++nevRun.current, alive = () => nevRun.current === run && phaseRef.current === "parked";
    let at = -60, timer = 0;
    const shuffle = () => {
      if (!alive()) return;
      const from = at, to = 20 + Math.random() * (VW() - 80), ms = Math.max(2500, Math.abs(to - from) * 14);
      at = to;
      setNev(n => n && { ...n, x: to, ms, faceLeft: to < from, walking: true });
      timer = window.setTimeout(() => {
        if (!alive()) return;
        setNev(cur => cur && { ...cur, walking: false });
        if (Math.random() < 0.35) {
          setNev(cur => cur && { ...cur, shaking: true });
          window.setTimeout(() => alive() && setNev(cur => cur && { ...cur, shaking: false }), 2200);
        }
        timer = window.setTimeout(shuffle, 4000 + Math.random() * 6000);
      }, ms);
    };
    setNev({ x: at, ms: 0, faceLeft: false, walking: false, line: "Has anyone seen me boy?" });
    window.setTimeout(() => alive() && setNev(n => n && { ...n, line: null }), 4000);
    timer = window.setTimeout(shuffle, 1500);
    // A minute later, off he goes.
    window.setTimeout(() => {
      if (!alive()) return;
      nevRun.current++;
      clearTimeout(timer);
      const off = VW() + 80, ms = Math.max(2500, Math.abs(off - at) * 14);
      setNev(n => n && { ...n, x: off, ms, faceLeft: false, walking: true, shaking: false, line: "Ah well. I'll keep lookin'." });
      window.setTimeout(() => setNev(n => n && { ...n, line: null }), 4000);
      window.setTimeout(() => setNev(null), ms + 100);
    }, 60_000);
  }
  function nevSays() {
    setNev(n => n && { ...n, line: NEV_LINES[nevLine.current++ % NEV_LINES.length] });
    window.setTimeout(() => setNev(n => n && { ...n, line: null }), 4500);
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.3) window.setTimeout(() => speak(pick(NEV_SHAZZ)), 1500);
  }
  // Sent home from the header: wait for her to finish whatever she is doing, then ride off
  // and stay away until she is called again.
  useEffect(() => {
    if (!dismiss) return;
    let timer = 0, tries = 0;
    const go = () => {
      if (phaseRef.current === "hidden" || phaseRef.current === "leave") return;
      if (phaseRef.current === "parked" && !busy.current) { void leave(true); return; }
      if (++tries < 400) timer = window.setTimeout(go, 250);
    };
    go();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismiss]);
  function toggleClean() {
    setClean(value => { try { localStorage.setItem("day-out-smartarse-clean", value ? "0" : "1"); } catch { /* ignore */ } return !value; });
  }

  const onRoad = phase !== "hidden" || fx.some(item => item.kind === "skid" || item.kind === "shard");
  const actions: [Action, string][] = [["drink", "🍺 Crack a tinnie"], ["flip", "🖕 Flip us off"], ["moon", "🍑 Show us ya arse"], ["smoke", "🚬 Light a durry"], ["throw", "🍾 Chuck a bottle"]];
  // Choosing anything from the menu closes it (so on a phone the sheet gets out of the way).
  const pickTrick = (run: () => void) => () => { setMenu(false); run(); };
  // Wildlife and locals from the menu jump the queue (clear the "something's on" lock first).
  const callIn = (run: () => void) => pickTrick(() => { sceneUntil.current = 0; run(); });
  return <><div ref={scroller} className={styles.stageScroller}><div className={`${styles.stage} ${convoy || brawl === "boom" ? styles.rumble : ""}`} style={phoneView ? { width: VW() } : undefined}>
    {/* The shops behind the road. Not clickable itself, but it stops clicks reaching the page behind. */}
    {phase !== "hidden" && <div className={styles.shopStrip} aria-hidden onClick={event => event.stopPropagation()}><Shopfronts /></div>}
    <div className={`${styles.road} ${onRoad ? styles.roadOn : ""} ${phase === "parked" ? styles.roadClickable : ""}`} onClick={event => void rideTo(event.clientX + panX())} title={phase === "parked" ? "Click to move Shazz here" : undefined} />
    {cars.map(car => <span key={car.id} data-vehicle={`car-${car.id}`} data-lane={car.lane} className={`${styles.car} ${car.turnAt !== undefined ? styles.carTurn : ""} ${phase === "parked" ? styles.carClickable : ""} ${heldCar === car.id ? styles.carHeld : ""}`}
      onClick={event => void lassoCar(car.id, event.currentTarget)} title={phase === "parked" ? "Lasso it!" : undefined} onAnimationEnd={event => event.target === event.currentTarget && setCars(list => list.filter(item => item.id !== car.id))}
      style={{ bottom: car.lane === "far" ? FAR_LANE : GROUND + 2, width: car.width, height: car.width * 0.45, animationDuration: `${car.ms}ms`, ["--from" as string]: `${car.dir === 1 ? -car.width : VW()}px`, ["--to" as string]: `${car.dir === 1 ? VW() : -car.width}px`, ["--stop" as string]: `${car.turnAt ?? 0}px` }}>
      <span className={car.lane === "near" && car.turnAt === undefined ? styles.carSwerve : styles.carFlip} style={car.lane === "near" && car.turnAt === undefined ? { animationDelay: `${Math.max(0, car.shockAt - 650)}ms` } : undefined}>
        <span className={styles.carFlip} style={{ transform: car.dir === -1 ? "scaleX(-1)" : undefined }}><span className={styles.carBody}><FamilyCar color={car.color} /></span></span>
        {poopMarks(`car-${car.id}`, "10%")}
      </span>
      <span className={styles.carShock} style={{ animationDelay: `${car.shockAt}ms` }}>!!</span>
    </span>)}
    {brawl && <div className={styles.brawl} aria-hidden>
      {/* Each club's bikes ride in, then stay parked on their side of the road */}
      {Array.from({ length: 8 }, (_, i) => <span key={`rb${i}`} className={`${styles.gangBike} ${brawl === "rideIn" ? styles.gangInLeft : ""}`}
        style={{ left: `calc(50% - ${420 + Math.floor(i / 2) * 90 + (i % 2) * 40}px)`, bottom: i % 2 ? 44 : 74, animationDelay: `${(i % 4) * 0.08}s`, visibility: thieves.stolenRed && i === 1 ? "hidden" : undefined }}><MiniBiker seed={i} gang="red" riderless={brawl !== "rideIn"} /></span>)}
      {brawl !== "boom" && Array.from({ length: 8 }, (_, i) => {
        const piled = brawl === "kick" || brawl === "dynamite";
        return <span key={`bb${i}`} className={`${styles.gangBike} ${brawl === "rideIn" ? styles.gangInRight : ""}`}
        style={{ left: `calc(50% + ${BLUE_AT(i)}px)`, bottom: i % 2 ? 44 : 74, animationDelay: `${(i % 4) * 0.08}s`, transition: "transform .55s cubic-bezier(.3,1.4,.5,1)", transitionDelay: `${i * 160}ms`,
          transform: piled ? `translate(${PILE_X + ((i % 3) - 1) * 34 - BLUE_AT(i)}px, ${(i % 2 ? 0 : 30) - Math.floor(i / 3) * 26}px) rotate(${PILE_ROT[i]}deg)` : undefined }}><span className={styles.facingLeft}><MiniBiker seed={i + 20} gang="blue" riderless={brawl !== "rideIn"} bricks={thieves.bricked && i === 0} /></span></span>;
      })}
      {thieves.trev && <span className={styles.thief} style={{ left: thieves.trev.x, bottom: 44, width: 128, height: 130, transitionDuration: `${thieves.trev.ms}ms` }}>
        {thieves.trev.riding && <span className={`${styles.thiefBike} ${styles.moving}`}><span className={styles.facingLeft}><MiniBiker seed={1} gang="red" riderless /></span></span>}
        <span className={styles.thiefBody} style={thieves.trev.riding ? { left: 34, bottom: 22 } : undefined}><span className={styles.ibisBody} style={{ transform: thieves.trev.riding ? "scaleX(-1)" : undefined }}><Trev pose={thieves.trev.riding ? "cook" : "run"} /></span></span>
        {thieves.trev.line && <span className={styles.ibisBubble} style={{ bottom: 140 }}>{thieves.trev.line}</span>}
      </span>}
      {thieves.kylie && <span className={styles.thief} style={{ left: thieves.kylie.x, bottom: 60, width: 70, height: 121, transitionDuration: `${thieves.kylie.ms}ms` }}>
        <span className={styles.thiefBody}><span className={styles.ibisBody} style={{ transform: thieves.kylie.leaving ? undefined : "scaleX(-1)" }}><Kylie pose="run" /></span></span>
        {thieves.kylie.wheel && <span className={styles.stolenWheel} />}
        {thieves.kylie.line && <span className={styles.ibisBubble} style={{ bottom: 132 }}>{thieves.kylie.line}</span>}
      </span>}
      {brawl === "dynamite" && <span className={styles.dynamite} style={{ left: `calc(50% + ${PILE_X + 34}px)`, bottom: 150 }}><Dynamite /></span>}
      {brawl === "boom" && <><span className={styles.bikeBoom} style={{ left: `calc(50% + ${PILE_X + 64}px)` }} /><span className={styles.scorch} style={{ left: `calc(50% + ${PILE_X - 40}px)` }} /></>}
      {/* The punch-up, in full view */}
      {brawl === "fight" && PAIRS.map((pair, i) => <span key={`pair${i}`}>
        <span className={`${styles.brawler} ${knocked === `r${i}` ? styles.knockedRed : ""}`} style={{ left: `calc(50% + ${pair.at - 54}px)`, bottom: pair.row }}><Brawler gang="red" seed={i} weapon={RED_WEAPONS[i]} /></span>
        <span className={`${styles.brawler} ${knocked === `b${i}` ? styles.knockedBlue : ""}`} style={{ left: `calc(50% + ${pair.at + 6}px)`, bottom: pair.row }}><span className={styles.facingLeft}><Brawler gang="blue" seed={i + 3} weapon={BLUE_WEAPONS[i]} /></span></span>
      </span>)}
      {/* Reds celebrate round the guillotine */}
      {brawl && ["guillotine", "chop", "kick", "dynamite", "boom"].includes(brawl) && [0, 1, 2, 3].map(i => <span key={`c${i}`} className={`${styles.brawler} ${styles.cheer}`}
        style={{ left: `calc(50% - ${190 + i * 60}px)`, bottom: i % 2 ? 40 : 22, animationDelay: `${i * 0.1}s` }}><Brawler gang="red" seed={i} /></span>)}
      {(brawl === "guillotine" || brawl === "chop") && <span className={styles.guillotine}><Guillotine chopped={brawl === "chop"} /></span>}
    </div>}
    {convoy > 0 && <div key={convoy} className={styles.convoy} aria-hidden>
      {Array.from({ length: 50 }, (_, i) => <span key={i} className={styles.convoyBike} style={{ left: Math.floor(i / 2) * 112 + (i % 2) * 50, bottom: i % 2 ? 36 : 72, animationDelay: `${(i % 7) * 0.07}s` }}><MiniBiker seed={i} /></span>)}
    </div>}
    {sign && <span className={`${styles.stopSign} ${sign.down ? styles.stopSignDown : ""}`} style={{ left: sign.x, bottom: 44 }}><StopSign holes={sign.holes} /></span>}
    {bbq && <span className={styles.bbq} style={{ left: bbq.left, bottom: GROUND - 2, width: bbq.width, height: bbq.width * (150 / 170) }}><BbqScene served={bbq.served} stolen={bbq.stolen} /></span>}
    {raider && <span className={`${styles.raider} ${styles.shootable}`} style={{ left: raider.x, bottom: raider.bottom, transitionDuration: `${raider.ms}ms` }} {...shootProps({ kind: "raider" }, "Shoot the bin chicken!")}>
      <span className={styles.ibisBody} style={{ transform: raider.faceLeft ? "scaleX(-1)" : undefined }}><BinChicken flying carrying={raider.carrying} /></span>
    </span>}
    {phase !== "hidden" && (() => {
      const others = treeSpots().slice(0, -1), home = !trev && !cookout && !rave && !thieves.trev && !thieves.kylie;
      if (!home) return null;
      return others.slice(0, 2).map((t, i) => {
        const left = i === 0, trunk = t.x + TREE.W * 0.45, who = i === 0 ? "trev" : "kylie";
        if (boogie?.who === who || fighter?.who === who) return null;
        return <span key={`lurk${i}`} className={styles.lurker} style={{ left: trunk - (left ? 46 : 20), bottom: TREE_BOTTOM - 6 }}>
          <span className={styles.lurkHit} role="button" aria-label={`Get ${i === 0 ? "Trev" : "Kylie"} out for a dance`} title="Oi! Come out!" onClick={() => void boogieOut(who)} />
          <span className={left ? styles.lurkLeft : styles.lurkRight} style={{ animationDelay: `${-i * 2.6}s` }}>
            <span className={styles.trevTwitch}>
              <span className={styles.ibisBody} style={{ transform: left ? "scaleX(-1)" : undefined }}>{i === 0 ? <Trev pose="peek" /> : <Kylie pose="peek" />}</span>
            </span>
          </span>
        </span>;
      });
    })()}
    {trev && <span data-poopable="person" className={styles.trev} aria-hidden style={{ left: trev.x, bottom: trev.bottom, transitionDuration: `${trev.ms}ms` }}>
      <span className={trev.pose === "peek" ? styles.trevTwitch : styles.ibisBody}>
        <span className={styles.ibisBody} style={{ transform: trev.faceLeft ? "scaleX(-1)" : undefined }}><Trev pose={trev.pose} carrying={trev.carrying} /></span>
      </span>
      {trev.line && <span className={styles.ibisBubble} style={{ bottom: 132 }}>{trev.line}</span>}
    </span>}
    {phase !== "hidden" && treeSpots().map((t, i) => (
      <span key={i} className={styles.gumTree} style={{ left: t.x, bottom: TREE_BOTTOM, width: TREE.W, height: TREE.H }}>
        <GumTree koala={t.koala && !shotKoalas.includes(i)} variant={i} />
        {t.koala && !shotKoalas.includes(i) && phase === "parked" && <span className={`${styles.koalaTarget} ${styles.shootable}`} {...shootProps({ kind: "koala", tree: i }, "Shoot the koala!")}
          style={{ left: TREE.W * (80 / 120) - 16, top: TREE.H * (98 / 220) - 22, width: 32, height: 40 }} />}
      </span>
    ))}
    {cookout && <>
      {cookout.can !== "none" && <span className={`${styles.fireCan} ${cookout.can === "kicked" ? styles.canKick : ""}`} aria-hidden
        style={{ left: cookout.fireX - 20, bottom: cookout.fireBottom, ["--kx" as string]: `${cookout.kick * 70}px` }}><FireCan lit={cookout.can === "lit"} /></span>}
      {(["trev", "kylie"] as const).map(who => {
        const t = cookout[who];
        return <span data-poopable="person" key={who} className={styles.trev} aria-hidden style={{ left: t.x, bottom: t.bottom, transitionDuration: `${t.ms}ms` }}>
          <span className={t.pose === "peek" ? styles.trevTwitch : styles.ibisBody}>
            <span className={styles.ibisBody} style={{ transform: t.faceLeft ? "scaleX(-1)" : undefined }}>
              {who === "trev" ? <Trev pose={t.pose} carrying={t.carrying} stick={t.stick} /> : <Kylie pose={t.pose} carrying={t.carrying} stick={t.stick} />}
            </span>
          </span>
          {cookout.line?.who === who && <span key={cookout.line.text} className={styles.ibisBubble} style={{ bottom: 132 }}>{cookout.line.text}</span>}
        </span>;
      })}
      {cookout.cop && <span className={styles.strikeCar} aria-hidden style={{ left: cookout.cop.x, bottom: FAR_LANE, width: isPhone() ? 150 : 190, height: (isPhone() ? 150 : 190) * 0.42, transitionDuration: `${cookout.cop.ms}ms` }}>
        <span className={styles.carFlip} style={{ transform: cookout.cop.flip ? "scaleX(-1)" : undefined }}><PoliceCar damage={0} wrecked={false} /></span>
      </span>}
    </>}
    {rave && <div className={styles.rave} aria-hidden>
      {rave.lights && <span className={styles.raveLights} />}
      {rave.gear && <>
        <span className={styles.raveProp} style={{ left: VW() * 0.48 - 60, bottom: TREE_BOTTOM - 20, width: 120, height: 150 }}><HillsHoist /></span>
        <span className={styles.raveProp} style={{ left: VW() * 0.3, bottom: GROUND + 4, width: 60, height: 44 }}><Esky /></span>
        <span className={styles.raveProp} style={{ left: VW() * 0.62, bottom: GROUND + 4, width: 70, height: 44 }}><Boombox /></span>
        {[0.18, 0.8].map(f => <span key={f} className={styles.raveProp} style={{ left: VW() * f, bottom: FAR_LANE + 6, width: 40, height: 50 }}><FireCan /></span>)}
      </>}
      {rave.vehicles.map(v => <span key={v.id} className={`${styles.strikeCar} ${styles.moving}`} style={{ left: v.x, bottom: v.bottom, width: v.w, height: v.kind === "wagon" ? v.w * 0.5 : v.w * 0.42, transitionDuration: `${v.ms}ms` }}>
        <span className={styles.carFlip} style={{ transform: v.flip ? "scaleX(-1)" : undefined }}>{v.kind === "wagon" ? <PaddyWagon /> : <PoliceCar damage={0} wrecked={false} />}</span>
      </span>)}
      {rave.ravers.map(r => r.gone ? null : r.hiding ? <span key={r.id} className={styles.peekFace} style={{ left: r.x + 18, bottom: r.bottom + 88 }}>
        <span className={styles.peekInner}>{r.who === "trev" ? <Trev pose="peek" shorts={r.tint} /> : <Kylie pose="peek" top={r.tint} />}</span>
      </span> : <span key={r.id} className={`${styles.trev} ${r.tossed ? styles.tossed : ""}`} style={{ left: r.x, bottom: r.bottom, transitionDuration: `${r.ms}ms` }}>
        {r.scuffle && <span className={styles.scuffle}><em>💥</em><em>👊</em><em>⭐</em><em>🦶</em></span>}
        <span className={r.pose === "dance" ? styles.raveDance : r.pose === "zapped" ? styles.trevTwitch : styles.ibisBody} style={{ animationDelay: `${-(r.id % 5) * 90}ms`, visibility: r.scuffle ? "hidden" : undefined }}>
          <span className={styles.ibisBody} style={{ transform: r.faceLeft ? "scaleX(-1)" : undefined }}>
            {r.who === "trev" ? <Trev pose={r.pose} shorts={r.tint} /> : <Kylie pose={r.pose} top={r.tint} />}
          </span>
        </span>
        {r.board && <span className={styles.boardHeld}><WobbleBoard /></span>}
        {r.line && <span className={styles.ibisBubble} style={{ bottom: 132 }}>{r.line}</span>}
      </span>)}
      {rave.cops.map(c => !c.gone && <span key={c.id} className={styles.raveCop} style={{ left: c.x, bottom: c.bottom, transitionDuration: `${c.ms}ms` }}>
        <span className={styles.ibisBody} style={{ transform: c.faceLeft ? "scaleX(-1)" : undefined }}><RaveCop zap={c.zap} walking={c.walking} baton={c.baton} /></span>
        {c.line && <span className={styles.ibisBubble} style={{ bottom: 118 }}>{c.line}</span>}
      </span>)}
    </div>}
    {lorikeets.map(b => <span key={b.id} className={`${styles.lorikeet} ${styles.shootable}`} {...shootProps({ kind: "lorikeet", id: b.id }, "Shoot the lorikeet!")}
      style={{ left: b.x, bottom: b.bottom, transitionDuration: `${b.ms}ms`, transitionDelay: `${b.delay}ms` }}>
      <span className={styles.ibisBody} style={{ transform: b.faceLeft ? "scaleX(-1)" : undefined }}><Lorikeet flying={!b.perched} /></span>
    </span>)}
    {danglers.map(d => <span key={d.id} className={styles.dangler} style={{ left: d.x, top: d.top, animationDuration: `${d.ms}ms` }} aria-hidden
      onAnimationEnd={event => event.target === event.currentTarget && setDanglers(list => list.filter(x => x.id !== d.id))}>
      <svg className={styles.web} viewBox="-12 -12 24 24" aria-hidden><path d="M-10 0 H10 M0 -10 V10 M-7 -7 L7 7 M7 -7 L-7 7" stroke="#fff" strokeWidth="0.6" opacity="0.8" /><circle r="4" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.8" /><circle r="8" fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.6" /></svg>
      <span className={styles.danglerThread} style={{ animationDuration: `${d.ms}ms` }}><span className={`${styles.danglerBear} ${styles.shootable}`} {...shootProps({ kind: "dangler", id: d.id }, "Shoot the drop bear!")}><DropBear /></span></span>
    </span>)}
    {dropBear && <span data-poopable="animal" className={`${styles.dropBear} ${styles.shootable}`} {...shootProps({ kind: "dropBear" }, "Shoot the drop bear!")}
      style={{ left: dropBear.x - 24, bottom: dropBear.bottom, transitionDuration: `${dropBear.ms}ms`, transitionTimingFunction: dropBear.ease }}>
      <span className={styles.ibisBody} style={{ transform: dropBear.faceLeft ? "scaleX(-1)" : undefined }}><DropBear /></span>
    </span>}
    {crossings.map(c => !c.done && <span data-poopable="animal" key={c.id} className={`${styles.crossing} ${styles.shootable}`} {...shootProps({ kind: "crossing", id: c.id })}
      style={{ left: c.x, bottom: c.bottom, width: c.kind === "roo" ? 74 : 66, height: c.kind === "roo" ? 66 : 46, transitionDuration: `${c.ms}ms` }}>
      <span className={c.flat ? styles.flatten : c.kind === "roo" ? styles.rooHop : styles.critterWaddle}>
        <span className={styles.ibisBody} style={{ transform: c.faceLeft ? "scaleX(-1)" : undefined }}><LiveCritter kind={c.kind} /></span>
      </span>
    </span>)}
    {snakes.map(sn => !sn.done && <span key={sn.id} className={`${styles.snake} ${styles.shootable}`} {...shootProps({ kind: "snake", id: sn.id }, "Shoot the hoop snake!")}
      style={{ left: sn.x, bottom: sn.bottom, width: sn.mode === "hoop" ? 46 : 120, height: sn.mode === "hoop" ? 46 : 30, transitionDuration: `${sn.ms}ms` }}>
      {sn.mode === "hoop"
        ? <span className={styles.snakeBounce}><span className={sn.dir === 1 ? styles.snakeRollRight : styles.snakeRollLeft}><HoopSnake /></span></span>
        : <span className={sn.mode === "flat" ? styles.flatten : styles.ibisBody}><span className={styles.ibisBody} style={{ transform: sn.dir === -1 ? "scaleX(-1)" : undefined }}><SlitherSnake /></span></span>}
    </span>)}
    {hitters.map(h => <span key={h.id} data-vehicle={`hit-${h.id}`} data-lane={h.lane} className={`${styles.strikeCar} ${styles.moving}`} aria-hidden
      style={{ left: h.vx, bottom: h.lane === "far" ? FAR_LANE : GROUND + 2, width: h.vw, height: h.vehicle === "bike" ? h.vw * 60 / 110 : h.vw * 0.45, transitionDuration: `${h.vms}ms` }}>
      <span className={styles.carFlip} style={{ transform: h.dir === -1 ? "scaleX(-1)" : undefined }}>
        <span className={styles.carBody}>{h.vehicle === "bike" ? <SportBike color={h.color} /> : <FamilyCar color={h.color} />}</span>
      </span>
      {poopMarks(`hit-${h.id}`, h.vehicle === "bike" ? "6%" : "10%")}
    </span>)}
    {postie && <span data-vehicle="postie" data-lane="near" className={`${styles.postie} ${styles.moving}`} aria-hidden
      style={{ left: postie.x, bottom: GROUND + 2, width: isPhone() ? 130 : POSTIE_W, height: (isPhone() ? 130 : POSTIE_W) * 100 / 130, transitionDuration: `${postie.ms}ms` }}>
      <span className={styles.carFlip} style={{ transform: postie.dir === -1 ? "scaleX(-1)" : undefined }}><span className={styles.carBody}><PostieBike /></span></span>
      {poopMarks("postie", "2%")}
    </span>}
    {kid && <span data-poopable="person" className={`${styles.kid} ${styles.moving}`} style={{ left: kid.x, bottom: GROUND + 2, width: KID_W, height: KID_W, transitionDuration: `${kid.ms}ms` }}>
      <span className={styles.carFlip} style={{ transform: kid.dir === -1 ? "scaleX(-1)" : undefined }}><KidBike panic={kid.panic} /></span>
      {kid.line && <span className={styles.ibisBubble} style={{ bottom: KID_W + 56 }}>{kid.line}</span>}
      {kid.magpies.map(m => <span key={m.id} className={`${styles.magpie} ${styles.shootable}`} {...shootProps({ kind: "magpie", id: m.id }, "Shoot the magpie!")}
        style={{ left: m.ox, bottom: m.oy, animationDelay: `${m.delay}ms`, ["--sx" as string]: `${m.sx}px`, ["--sy" as string]: `${m.sy}px` }}>
        <span className={styles.magpieSwoop} style={{ animationDelay: `${m.delay + 800}ms` }}>
          <span className={styles.ibisBody} style={{ transform: kid.dir === -1 ? "scaleX(-1)" : undefined }}><Magpie /></span>
        </span>
      </span>)}
    </span>}
    {strike && <span className={styles.strikeCar} aria-hidden
      style={{ left: strike.carX, bottom: FAR_LANE, width: isPhone() ? 150 : 200, height: (isPhone() ? 150 : 200) * 0.45, transitionDuration: `${strike.carMs}ms` }}>
      <span className={`${styles.carBody} ${strike.shaking ? styles.carShake : ""}`}><FamilyCar color={strike.color} dented={strike.dented} /></span>
      {strike.dented && <span className={styles.carShock} style={{ animationDelay: "0ms" }}>!!</span>}
    </span>}
    {strike && !strike.rooGone && <span className={`${styles.strikeRoo} ${styles.shootable}`} {...shootProps({ kind: "strikeRoo" })} style={{ left: strike.rooX, bottom: strike.rooBottom, transitionDuration: `${strike.rooMs}ms`, ["--hop" as string]: "480ms" }}>
      <span className={styles.rooHop}><span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><Kangaroo /></span></span>
    </span>}
    {sportbikes.map(b => <span key={b.id} data-vehicle={`bike-${b.id}`} data-lane={b.lane} className={styles.car} aria-hidden onAnimationEnd={event => event.target === event.currentTarget && setSportbikes(list => list.filter(x => x.id !== b.id))}
      style={{ bottom: b.lane === "far" ? FAR_LANE + 4 : GROUND + 4, width: sportbikeW(), height: sportbikeW() * 60 / 110, animationDuration: `${b.ms}ms`, ["--from" as string]: `${b.dir === 1 ? -sportbikeW() - 10 : VW()}px`, ["--to" as string]: `${b.dir === 1 ? VW() : -sportbikeW() - 10}px` }}>
      <span className={`${styles.carFlip} ${styles.moving}`} style={{ transform: b.dir === -1 ? "scaleX(-1)" : undefined }}><SportBike color={b.color} /></span>
      {poopMarks(`bike-${b.id}`, "6%")}
    </span>)}
    {/* Gumtree Gary: just his face in the leaves, or out and about after a feed */}
    {gary && gary.mode === "hiding" && boogie?.who !== "gary" && fighter?.who !== "gary" && <span className={styles.lurkHit} role="button" aria-label="Get Gary down for a dance" title="Oi, Gary!"
      style={{ inset: "auto", left: garyHome().x, bottom: garyHome().bottom + 40, width: 66, height: 90 }} onClick={() => void boogieOut("gary")} />}
    {gary && (gary.mode === "hiding"
      ? boogie?.who === "gary" || fighter?.who === "gary" ? null : <span className={styles.peekFace} style={{ left: garyHome().x + 18, bottom: garyHome().bottom + 88 }}><span className={styles.peekInner}><Trev pose="peek" shorts="#4d7c0f" /></span></span>
      : <span data-poopable="person" className={styles.trev} style={{ left: gary.x, bottom: gary.bottom, transitionDuration: `${gary.ms}ms` }}>
        <span className={styles.ibisBody} style={{ transform: gary.faceLeft ? "scaleX(-1)" : undefined }}>
          <Trev pose={gary.pose} shorts="#4d7c0f" carrying={gary.carrying && gary.carrying !== "fish" ? gary.carrying : null} />
        </span>
        {gary.fish && <span className={styles.heldFish} style={{ left: gary.faceLeft ? 4 : 34, bottom: 92 }}>🐟</span>}
        {gary.line && <span className={styles.ibisBubble} style={{ bottom: 128 }}>{gary.line}</span>}
      </span>)}
    {roadFish && <span className={styles.roadFish} style={{ left: roadFish.x, bottom: GROUND + 4 }}>🐟</span>}
    {/* True Blue and his visitors */}
    {blueAnimal && <span className={styles.blueAnimal} style={{ left: blueAnimal.x, bottom: ROAD_H - 12, width: blueAnimal.kind === "roo" ? 74 : blueAnimal.kind === "dropbear" ? 52 : 66, height: blueAnimal.kind === "roo" ? 66 : blueAnimal.kind === "dropbear" ? 52 : 46, transitionDuration: `${blueAnimal.ms}ms` }}>
      <span className={blueAnimal.kind === "roo" ? styles.rooHop : styles.critterWaddle}>
        <span className={styles.ibisBody} style={{ transform: blueAnimal.faceLeft ? "scaleX(-1)" : undefined }}>
          {blueAnimal.kind === "roo" ? <Kangaroo /> : blueAnimal.kind === "dropbear" ? <DropBear /> : <LiveCritter kind={blueAnimal.kind} />}
        </span>
      </span>
    </span>}
    {blue && <span data-poopable="person" className={styles.trueBlue} role="button" aria-label="True Blue" title="True Blue" style={{ left: blue.x, bottom: ROAD_H - 10, transitionDuration: `${blue.ms}ms` }}
      onClick={() => setBlue(b => b && { ...b, line: pick(["🎵 Hey True Blue! Is it me and you? 🎵", "For a hard-earned thirst, mate.", "Beer o'clock somewhere, cobber.", "Every animal's a mate if ya pat it right."]) })}>
      <span className={blue.pose === "walk" ? styles.stagger : styles.ibisBody}>
        <span className={styles.ibisBody} style={{ transform: blue.faceLeft ? "scaleX(-1)" : undefined }}><TrueBlue pose={blue.pose} /></span>
      </span>
      {blue.fish && <span className={styles.heldFish} style={{ left: 36, bottom: 96 }}>🐟</span>}
      {blue.line && <span className={styles.ibisBubble} style={{ bottom: 130 }}>{blue.line}</span>}
    </span>}
    {blueBirds?.lori && <span className={styles.blueBird} style={{ left: blueBirds.lori.x, bottom: blueBirds.lori.bottom, width: 30, height: 21, transitionDuration: `${blueBirds.lori.ms}ms` }}><Lorikeet flying={!blueBirds.lori.landed} /></span>}
    {blueBirds?.ibis && <span className={styles.blueBird} style={{ left: blueBirds.ibis.x, bottom: blueBirds.ibis.bottom, width: 70, height: 70, transitionDuration: `${blueBirds.ibis.ms}ms` }}><BinChicken flying={!blueBirds.ibis.landed} /></span>}
    {pelican && <span className={styles.pelican} style={{ left: pelican.x, bottom: pelican.bottom, transitionDuration: `${pelican.ms}ms` }}><Pelican fish={pelican.fish} /></span>}
    {fighter && <span data-poopable="person" className={styles.trev} aria-hidden style={{ left: fighter.x, bottom: fighter.bottom, transitionDuration: `${fighter.ms}ms` }}>
      {fighter.scuffle && <span className={styles.scuffle}><em>💥</em><em>🪶</em><em>👊</em><em>⭐</em></span>}
      <span className={styles.ibisBody} style={{ visibility: fighter.scuffle ? "hidden" : undefined }}>
        <span className={styles.ibisBody} style={{ transform: fighter.faceLeft ? "scaleX(-1)" : undefined }}>
          {fighter.who === "kylie" ? <Kylie pose={fighter.pose} carrying={fighter.carrying} /> : <Trev pose={fighter.pose} carrying={fighter.carrying} shorts={fighter.who === "gary" ? "#4d7c0f" : undefined} />}
        </span>
      </span>
      {fighter.line && <span key={fighter.line} className={styles.ibisBubble} style={{ bottom: 132 }}>{fighter.line}</span>}
    </span>}
    {boogie && <span data-poopable="person" className={styles.trev} aria-hidden style={{ left: boogie.x, bottom: TREE_BOTTOM - 6 }}>
      <span className={styles.wildDance}>
        <span className={styles.ibisBody}>{boogie.who === "kylie" ? <Kylie pose="dance" /> : <Trev pose="dance" shorts={boogie.who === "gary" ? "#4d7c0f" : undefined} />}</span>
      </span>
      <span key={boogie.line} className={styles.ibisBubble} style={{ bottom: 132 }}>{boogie.line}</span>
    </span>}
    {nev && <span data-poopable="person" className={styles.nev} role="button" aria-label="Talk to Old Nev" title="Old Nev" style={{ left: nev.x, bottom: ROAD_H - 10, transitionDuration: `${nev.ms}ms` }} onClick={nevSays}>
      <span className={styles.ibisBody} style={{ transform: nev.faceLeft ? "scaleX(-1)" : undefined }}><OldNev walking={nev.walking} shaking={nev.shaking} /></span>
      {nev.line && <span className={styles.ibisBubble} style={{ bottom: 128 }}>{nev.line}</span>}
    </span>}
    {dazza && <span data-poopable="person" className={styles.dazza} aria-hidden style={{ left: dazza.x, bottom: GROUND + 2, transitionDuration: `${dazza.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: dazza.faceLeft ? "scaleX(-1)" : undefined }}><Bludger pose={dazza.pose} /></span>
      {dazza.bear && <span className={styles.bearOnHead}><DropBear /></span>}
      {dazza.line && <span className={styles.ibisBubble}>{dazza.line}</span>}
    </span>}
    {dazza && dazza.bearTop !== null && <span className={styles.fallingBear} aria-hidden style={{ left: dazza.x + 14, top: dazza.bearTop }}><DropBear /></span>}
    {emus.map(e => <span data-poopable="animal" key={e.id} className={`${styles.emu} ${styles.shootable}`} {...shootProps({ kind: "emu", id: e.id }, e.hits ? "Finish it off!" : "Shoot the emu!")}
      onTransitionEnd={event => { if (event.target === event.currentTarget && (e.x > VW() || e.x < -e.size)) setEmus(list => list.filter(x => x.id !== e.id)); }}
      style={{ left: e.x, bottom: e.bottom, width: e.size, height: e.size * 90 / 70, transitionDuration: `${e.ms}ms` }}>
      <span className={e.hits ? styles.emuHop : styles.emuRun}><span className={styles.ibisBody} style={{ transform: e.dir === -1 ? "scaleX(-1)" : undefined }}><Emu oneLeg={e.hits > 0} /></span></span>
    </span>)}
    {roos.map(r => <span data-poopable="animal" key={r.id} className={`${styles.roo} ${styles.shootable}`} {...shootProps({ kind: "roo", id: r.id }, "Shoot the roo!")} onAnimationEnd={event => event.target === event.currentTarget && setRoos(list => list.filter(x => x.id !== r.id))}
      style={{ bottom: r.bottom, width: r.size, height: r.size * 0.9, animationDuration: `${r.ms}ms`, animationDelay: `${r.delay}ms`, ["--from" as string]: `${r.dir === 1 ? -r.size - 20 : VW() + 20}px`, ["--to" as string]: `${r.dir === 1 ? VW() + 20 : -r.size - 20}px`, ["--hop" as string]: `${r.hop}ms` }}>
      <span className={styles.rooHop}><span className={styles.ibisBody} style={{ transform: r.dir === -1 ? "scaleX(-1)" : undefined }}><Kangaroo joey={r.joey} /></span></span>
    </span>)}
    {phase !== "hidden" && <span className={styles.wheelieBin} style={{ left: binX(), bottom: BIN_BOTTOM, width: BIN_W, height: BIN_H }} aria-hidden><WheelieBin rattling={binRattle} /></span>}
    {phase !== "hidden" && BIN_POOP.map(([dx, size], i) => <span key={`bp${i}`} className={styles.binPoop} aria-hidden style={{ left: binX() + dx, bottom: BIN_BOTTOM - 6 + (i % 3) * 2, width: size, height: size * 0.5 }} />)}
    {phase !== "hidden" && BIN_DRIPS.map(([dx, len], i) => <span key={`bd${i}`} className={styles.binDrip} aria-hidden style={{ left: binX() + dx, bottom: BIN_BOTTOM + BIN_H - 8 - len, height: len }} />)}
    {flock && flock.birds.map((b, i) => {
      if (b.shot) return null;
      const landed = flock.stage === "landed", alert = landed ? spooked[i] : undefined;
      // On alert it faces the cursor (to keep an eye on it) while shuffling away from it.
      const faceLeft = alert ? alert === 1 : landed ? b.x > binX() + BIN_W / 2 : flock.dir === -1;
      return <span key={i} data-pooper={landed ? undefined : ""} className={`${styles.flockBird} ${landed && flockHover ? styles.flockLit : ""} ${alert ? styles.ibisAlert : landed ? (b.onBin ? styles.ibisRummage : styles.ibisWalking) : ""}`}
        style={{ left: b.x, bottom: b.bottom, transitionDuration: `${b.ms}ms` }}>
        <span className={styles.flockNudge} style={{ transform: alert ? `translate(${-alert * (b.onBin ? 4 : 12)}px, -3px) scaleY(1.06)` : undefined }}>
          <span className={styles.ibisBody} style={{ transform: faceLeft ? "scaleX(-1)" : undefined }}>
            <BinChicken flying={!landed} />
          </span>
        </span>
        {alert && <span className={styles.alertMark} aria-hidden>!</span>}
      </span>;
    })}
    {flock?.stage === "landed" && <span className={styles.flockZone} title="Shoo the bin chickens!" role="button" aria-label="Shoo the bin chickens"
      style={{ left: binX() - 110, bottom: BIN_BOTTOM - 24, width: BIN_W + 230, height: BIN_H + 90 }}
      onMouseEnter={() => setFlockHover(true)} onMouseMove={event => alertNear(event.clientX + panX(), event.clientY)}
      onMouseLeave={() => { setFlockHover(false); setSpooked({}); }}
      onClick={event => { event.stopPropagation(); void scatterFlock(); }} />}
    {flyers.map(fl => <span key={fl.id} className={`${styles.flyer} ${styles.shootable}`} data-bird={`f${fl.id}`} data-pooper="" {...shootProps({ kind: "flyer", id: fl.id }, "Shoot the bin chicken!")} onAnimationEnd={event => event.target === event.currentTarget && setFlyers(list => list.filter(x => x.id !== fl.id))}
      style={{ bottom: fl.bottom, animationDuration: `${fl.ms}ms`, animationDelay: `${fl.delay}ms`, ["--from" as string]: `${fl.dir === 1 ? -120 : VW() + 40}px`, ["--to" as string]: `${fl.dir === 1 ? VW() + 40 : -120}px` }}>
      <span className={styles.flyerBob}><span className={styles.ibisBody} style={{ transform: fl.dir === -1 ? "scaleX(-1)" : undefined }}><BinChicken flying /></span></span>
    </span>)}
    {fireball && <span className={styles.fireball} style={{ left: fireball.x, bottom: fireball.bottom }}><span className={styles.fireCore} /></span>}
    {cop && <span ref={copCar} className={styles.copCar} style={{ bottom: GROUND + 30, width: isPhone() ? 160 : 210, height: (isPhone() ? 160 : 210) * 0.42, transform: "translateX(-400px)" }}><span className={styles.copFlip}><PoliceCar damage={copDamage} wrecked={wreck} /></span></span>}
    {cops && <span className={styles.copsFlee} style={{ left: cops.x - 40, bottom: cops.bottom }}>
      <span className={styles.copMan}><CopFigure look={cops.look} /></span>
      <span className={styles.copMan} style={{ animationDelay: "0.12s" }}><CopFigure look={cops.look} /></span>
    </span>}
    {tattoo && <span className={styles.bbq} style={{ left: tattoo.left, bottom: GROUND - 2, width: tattoo.width, height: tattoo.width * (150 / 190) }}><TattooScene stage={tattoo.stage} /></span>}
    {kills.map(kill => <button key={kill.id} className={styles.roadkill} style={{ left: kill.x, bottom: kill.bottom ?? GROUND - 2 }} disabled={kill.claimed} onClick={() => void collect(kill.id)}
      aria-label={kill.bones ? `${CRITTER_NAMES[kill.kind]} skeleton on the road` : `Dead ${CRITTER_NAMES[kill.kind]} on the road. Send Shazz to grab it for dinner`} title={kill.bones ? undefined : kill.claimed ? undefined : "Dinner! Click to send Shazz"}>
      <RoadKill kind={kill.kind} bones={kill.bones} bloody={kill.bloody} />
    </button>)}
    {crows.map(c => <span key={c.id} className={`${styles.crow} ${c.eating ? styles.crowEating : ""}`} aria-hidden
      style={{ left: c.x, bottom: c.bottom, transitionDuration: `${c.ms}ms`, ["--peck" as string]: `${-c.peck}ms` }}>
      <span className={styles.ibisBody} style={{ transform: c.faceLeft ? "scaleX(-1)" : undefined }}><Crow flying={!c.eating} messy={c.messy} /></span>
    </span>)}
    {ibis && <span className={`${styles.ibis} ${styles.shootable} ${ibis.stage === "grab" ? styles.ibisPecking : styles.ibisWalking}`}
      style={{ left: ibis.x, bottom: GROUND - 2, transitionDuration: `${ibis.ms}ms` }} {...shootProps({ kind: "ibis" }, "Shoot the bin chicken!")}>
      <span className={styles.ibisBody} style={{ transform: ibis.faceLeft ? "scaleX(-1)" : undefined }}><BinChicken carrying={ibis.carrying} /></span>
      {ibis.line && <span className={styles.ibisBubble}>{ibis.line}</span>}
    </span>}
    {fx.map(item => {
      if (item.kind === "fog") return null;
      if (item.kind === "hole") return <span key={item.id} className={styles.bulletHole} style={{ left: item.x - item.size / 2, bottom: item.y - item.size / 2, width: item.size, height: item.size }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "poop") return <span key={item.id} className={styles.poopFall} style={{ left: item.x - 3, bottom: item.y, animationDuration: `${item.dx}ms`, ["--dy" as string]: `${item.dy}px` }} onAnimationEnd={() => poopLanded(item)} />;
      if (item.kind === "poopSplat") return <span key={item.id} className={styles.poopSplat} style={{ left: item.x - item.size / 2, bottom: item.y, width: item.size, height: item.size * 0.5 }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "drop") return <span key={item.id} className={styles.dropX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && remove(item.id)}>
        <span className={styles.dropY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -30}px` }}><span className={styles.bloodDrop} style={{ width: item.size, height: item.size }} /></span>
      </span>;
      if (item.kind === "feathers") {
        const rnd = (n: number) => { const v = Math.sin(item.id * 97.3 + n * 13.7) * 10000; return v - Math.floor(v); };
        return <span key={item.id} className={styles.featherPuff} style={{ left: item.x, bottom: item.y }} onAnimationEnd={event => event.target === event.currentTarget && remove(item.id)}>
          {Array.from({ length: 18 }, (_, i) => {
            const angle = (i / 18) * Math.PI * 2 + rnd(i) * 0.5, dist = 50 + rnd(i + 40) * 70;
            return <span key={i} className={styles.feather} style={{ background: item.palette ? item.palette[i % item.palette.length] : i % 5 === 0 ? "#2b2b2b" : undefined, animationDelay: `${Math.round(rnd(i + 80) * 120)}ms`, ["--dx" as string]: `${Math.cos(angle) * dist}px`, ["--dy" as string]: `${Math.sin(angle) * dist - 20}px`, ["--r" as string]: `${Math.round((rnd(i + 120) - 0.5) * 540)}deg` }} />;
          })}
        </span>;
      }
      if (item.kind === "rubber") return <span key={item.id} className={styles.rubber} style={{ left: item.x, bottom: item.y, width: item.size, height: item.size * 0.6, ["--dx" as string]: `${item.dx}px`, ["--dy" as string]: `${item.dy}px` }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "splat") return <span key={item.id} className={styles.splat} style={{ left: item.x - item.size / 2, bottom: item.y, width: item.size, height: item.size * 0.45 }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "rooFly") return <span key={item.id} className={styles.bottleX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && rooLanded(item)}>
        <span className={styles.bottleY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -110}px` }}><span className={styles.rooTumble}><Kangaroo /></span></span>
      </span>;
      if (item.kind === "leg") return <span key={item.id} className={styles.bottleX} style={{ left: item.x, bottom: item.y, ["--dx" as string]: `${item.dx}px` }} onAnimationEnd={event => event.target === event.currentTarget && remove(item.id)}>
        <span className={styles.bottleY} style={{ ["--dy" as string]: `${item.dy}px`, ["--arc" as string]: `${item.arc ?? -110}px` }}><span className={styles.flyingLeg}><EmuLeg /></span></span>
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
    <button data-poopable="shazz" ref={bike} className={`${styles.shazz} ${phase === "enter" || phase === "leave" || moving || burning ? styles.moving : ""} ${talking ? styles.talking : ""}`}
      style={{ width, height, bottom: GROUND, visibility: phase === "hidden" ? "hidden" : "visible", transform: "translateX(-500px)" }}
      onClick={() => { if (phase === "parked") { if (Date.now() - lineShownAt.current > 3000) say(); void act(pick(actions)[0]); } }}
      // Only a real hover counts (the mouse actually moving over her), not her riding under a still cursor.
      onPointerMove={event => { if (phase !== "parked" || event.pointerType !== "mouse" || (!event.movementX && !event.movementY) || Date.now() - lastHover.current < 8000) return; lastHover.current = Date.now(); say(); }} tabIndex={phase === "parked" ? 0 : -1} aria-label="Big Shazz. Poke her and see what happens">
      <span style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}><span className={drunk ? styles.wobble : ""} style={{ ["--wobble" as string]: `${Math.min(drunk, 3) * 2.5}deg` }}><BikerShazz pose={pose} drunk={drunk} trophies={trophies} teardrops={teardrops} flaming={flaming} /></span></span>
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
      const bubbleW = Math.min(isPhone() ? 250 : 320, VW() - 32), head = atX + 118 * scale;
      const left = Math.max(16, Math.min(VW() - bubbleW - 16, head - bubbleW + 60));
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
    </div></div>
    {phase === "parked" && <div className={styles.trickBar}>
      <button className={styles.trickToggle} onClick={() => setMenu(open => !open)} aria-expanded={menu} aria-label="Shazz's tricks and settings"><span aria-hidden>{menu ? "✕" : "🤘"}</span>{menu ? "Close" : "Tricks"}</button>
      {menu && <>
        {/* Phones: the menu is a bottom sheet; tapping outside it closes it */}
        <div className={styles.trickBackdrop} onClick={() => setMenu(false)} aria-hidden />
        <div className={styles.trickPanel}>
          <p className={styles.trickHeading}>Big stuff</p>
          <div className={styles.trickGroup}>
            <Trick label="🔥 Burnout" onClick={pickTrick(() => void burnout())} />
            <Trick label="🛑 Stop sign" onClick={pickTrick(() => void runStopSign(true))} />
            <Trick label="🚓 Cop chase" onClick={pickTrick(() => void copChase())} />
            <Trick label="📱 Call backup" onClick={pickTrick(() => void callBackup())} />
            <Trick label="🥊 Bikie brawl" onClick={pickTrick(() => void bikieBrawl())} />
            <Trick label="🍺 True Blue" onClick={pickTrick(() => void trueBlueVisit(true))} />
            <Trick label="👴 Dad?" onClick={pickTrick(nevVisit)} />
            <Trick label="🪩 Bush doof" onClick={pickTrick(() => void bushRave())} />
          </div>
          <p className={styles.trickHeading}>Wildlife & locals</p>
          <div className={styles.trickGroup}>
            <Trick label="🔫 Shoot something" onClick={pickTrick(() => shootSomething())} />
            <Trick label="🚲 Magpie swoop" onClick={callIn(() => void magpieSwoop())} />
            <Trick label="🦜 Lorikeets" onClick={callIn(() => void lorikeetVisit())} />
            <Trick label="🦘 Roo mob" onClick={callIn(() => rooMob())} />
            <Trick label="🪶 Emus" onClick={callIn(() => emuFlock())} />
            <Trick label="🐍 Hoop snake" onClick={callIn(() => void snakeRun())} />
            <Trick label="🐨 Drop bear" onClick={callIn(() => void dropBearAttack())} />
            <Trick label="🐦 Bin chickens" onClick={callIn(() => spawnFlyers())} />
            <Trick label="📬 Postie" onClick={callIn(() => void postieRun())} />
            <Trick label="🙋 Dazza" onClick={callIn(() => void dazzaVisit())} />
            <Trick label="🔥 Cookout" onClick={callIn(() => void tweakerAct())} />
          </div>
          <p className={styles.trickHeading}>Her antics</p>
          <div className={styles.trickGroup}>
            {actions.map(([action, label]) => <Trick key={action} label={label} onClick={pickTrick(() => void act(action))} />)}
            <Trick label="💬 Say something" onClick={pickTrick(say)} />
          </div>
          <p className={styles.trickHeading}>Settings</p>
          <div className={styles.trickGroup}>
            <Trick label={clean ? "🤬 Full swearing" : "🤐 Bleep swearing"} onClick={toggleClean} />
            <Trick label="👋 Yeah, righto" onClick={pickTrick(() => void leave())} />
            <Trick label="🖐️ Piss off, Shazz" onClick={pickTrick(() => void leave(true))} />
          </div>
        </div>
      </>}
    </div>}
  </>;
}
