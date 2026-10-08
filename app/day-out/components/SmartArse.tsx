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
import PalmTree from "./PalmTree";
import DropBear from "./DropBear";
import SportBike from "./SportBike";
import HoopSnake from "./HoopSnake";
import Bludger from "./Bludger";
import OldNev from "./OldNev";
import StoreBiker from "./StoreBiker";
import Bubble, { readMs } from "./Bubble";
import SmokoGirl from "./SmokoGirl";
import FruitBat from "./FruitBat";
import { WIRES, onWire, type WireName } from "./streetWires";
import DogWalker from "./DogWalker";
import { Seagull, ChipEater } from "./BeachGulls";
import { Lifeguard, Swimmer, PaddleSurfer, SharkFin, SharkLunge } from "./BeachRescue";
import { SkiBoat, StackedSkier, JetSki, Parasail, FallingRider, DolphinPod, WhaleBreach, WhaleTail, Bazza, VMRBoat, BrokenBoat, Floater, Helicopter, PilotChute, ChopperWreck } from "./SeaLife";
import BeachGoer from "./BeachGoer";
import PassingBiker from "./PassingBiker";
import { HarleyBadge, IndianBadge } from "./BikeLogos";
import Commuter from "./Commuter";
import AquaDuck from "./AquaDuck";
import { HARLEY_ON_INDIAN, INDIAN_ON_HARLEY, CREW_LAUGHS, HARLEY_SENDOFFS, INDIAN_SENDOFFS } from "./bikerJokes";
import TrueBlue, { Pelican, type TrueBluePose } from "./TrueBlue";
import Emu, { EmuLeg } from "./Emu";
import Shopfronts from "./Shopfronts";
import Dingo from "./Dingo";
import Bev from "./Bev";
import Jet from "./Jet";
import RoachArt from "./Roach";
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
// Gum trees, pinned to spots along the street drawing (Shopfronts x units): one between the Indian
// shop and the fish and chip shop, one between Centrelink and the Harley shop, one out the front of
// the chemist (clear of its doors). Kept clear of the bus stop, Centrelink's doors and the bottlo door.
const TREES = [{ sx: 50, koala: true }, { sx: 1040, koala: false }, { sx: 2005, koala: true }];
// Tall palms, taller than the shops; their shaggy skirts are where the cockroaches live.
// Spread along the street: the Indian shop, between the empty shop and the milk bar, out the front
// of Centrelink (next to the power pole), and between the Harley shop and the bottlo.
const PALMS: { sx: number; lean: 1 | -1 }[] = [{ sx: -400, lean: 1 }, { sx: 250, lean: -1 }, { sx: 640, lean: 1 }, { sx: 1455, lean: -1 }];
// Where the bottlo's door is on the street drawing (dole day stragglers and True Blue use it).
const BOTTLO_DOOR = 1585;
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
const DOLE_QUEUE_LINES = [
  "Dole day! Best day of the fortnight!",
  "Applied for three jobs. Made sure I didn't get any.",
  "Me job diary says 'went fishin'' fourteen times.",
  "Best job I ever had, this one.",
  "Mutual obligation? I'm mutually obliged to the couch.",
  "If they ask, I'm a 'freelance consultant'.",
  "Gonna do a course. A course of beers.",
  "Twelve years and they still spell me name wrong.",
  "Is this the line for the free money?",
  "Dressed up for it an' everything. Clean thongs.",
];
const DOLE_EXIT_LINES = ["CHA-CHING!", "PAYDAY, BABY!", "Too easy!", "See ya in a fortnight, Centrelink!", "Straight to the bottlo!"];
const DOLE_BOTTLO_LINES = ["*hic* …Bargain.", "Whole fortnight's sorted! …For tonight.", "Who moved the footpath?", "Slab of VB and a scratchie. Investin'."];
const BEV_LINES = ["A DINGO ATE MY BABY!", "THE DINGO'S GOT ME BABY!", "MY BABY'S GONE!", "SOMEONE CALL THE COPS!"];
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
// The Harley and Indian blokes out the front of their shops, and what they yell at each other.
type ShopBiker = { id: number; brand: "harley" | "indian"; look: number; x: number; bottom: number; ms: number; faceLeft: boolean; walking: boolean; until: number; flipping: boolean; line: string | null; crew?: boolean; laughing?: boolean; lift?: number; brawling?: boolean; cheering?: boolean };
const HARLEY_JABS = ["Nice scooter, mate!", "Oi! Feathers! Go polish ya hairdryer!", "Real bikes leak oil, sunshine!", "That's not a bike, that's a pram!", "Indian? More like Indi-CAN'T!", "Come back when ya grow a beard!"];
const INDIAN_JABS = ["Nice tractor, champ!", "Ours actually start, mate!", "Harley? More like HARDLY!", "Shake, rattle and roll on home!", "Get a real bike, ya galah!", "Is it leaking or just crying?"];
type Roach = { id: number; x: number; bottom: number; ms: number; angle: number; squashed: boolean; busy: boolean };
// Folk waiting at the bus stop, and the Aquaduck that comes to get them.
type CommuterState = { id: number; look: number; x: number; bottom: number; ms: number; faceLeft: boolean; walking: boolean; waving: boolean; line: string | null };
type DuckBus = { x: number; ms: number; riders: number; quack: boolean; moving: boolean; leaving: boolean };
const BUS_STOP_LINES = ["Lovely day for it!", "Duck's running late again.", "Ooh, I love the duck bus!", "Hope I get a seat up the front.", "Morning!", "Is this the stop for the duck?", "Nice day for a swim, eh?", "Don't mind me, just waiting for the duck."];
// The magpie flock: birds wheeling about over the street, diving on whoever's walking underneath.
type Swooper = { id: number; x: number; bottom: number; ms: number; faceLeft: boolean; diving: boolean; until: number; leaving: boolean };
const SWOOPED_YELLS = ["ARGH! MAGPIE!", "GET OFF ME!", "ME EYES!", "NOT AGAIN!", "SWOOPED!", "ME HEAD!", "BLOODY MAGPIES!", "AAARGH!", "WHY MEEE?!", "IN ME HAIR!"];
const SHAZZ_SWOOPED = ["Oi! Pick on someone ya own size!", "Get outta me mullet, ya feathered mongrel!", "Every flamin' spring!", "I'll set Trev on ya, ya pied prick!", "Not the hair! NOT THE HAIR!"];
// The sledging match between the bike shops: after each crew's joke, a prompt asks whether the
// other crew fires back. Keeps score in laughs.
type Sledge = { next: "harley" | "indian"; score: { harley: number; indian: number }; round: number; title: string; blurb: string; open: boolean };
const CREW_NAME = { harley: "Harley", indian: "Indian" } as const;
const sledgeTitle = (victim: string, scorer: string, round: number) => pick([
  `Ooh, ${victim} just got roasted!`, `Round ${round} to ${scorer}!`, "That one left a mark!", `The ${victim} mob are fuming!`, `${scorer} with the cheap shot!`, "OHHHHH!",
]);
const sledgeBlurb = (victim: string, round: number) => pick([
  `The ${victim} blokes are muttering into their beards. Reckon they've got one back?`,
  `${victim} look like they've just been swooped by a magpie. Fire back?`,
  `The whole street heard that. Do the ${victim} boys hit back?`,
  `Somebody fetch the ${victim} crew an ice pack for that burn. Or a comeback.`,
  `${victim} have gone dead quiet. That's never a good sign...`,
  ...(round >= 4 ? ["This is better than the footy. Keep it going?", "Centrelink's emptied out to watch. Another round?", "Even the bin chickens have stopped to listen."] : []),
]);
// The bike shop brawl, and club riders cruising past.
type Ride = { id: number; brand: "harley" | "indian"; look: number; x: number; ms: number; dir: 1 | -1; lane: number };
const BRAWL_CRIES: Record<"harley" | "indian", string[]> = { harley: ["HARLEY! HARLEY! HARLEY!", "Let's 'ave 'em, boys!", "FOR MILWAUKEE!"], indian: ["INDIAN! INDIAN! INDIAN!", "Get 'em, lads!", "FOR SPRINGFIELD!"] };
const SHOP_BRAWL_HITS = ["BIFF!", "POW!", "WHACK!", "CRUNCH!", "KAPOW!", "OOF!", "THWACK!", "BONK!", "SMACK!", "NOT THE BEARD!"];
const BRAWL_WINS: Record<"harley" | "indian", string[]> = { harley: ["HARLEY RULES!", "Back to ya snowmobiles!", "Milwaukee iron, baby!"], indian: ["INDIAN FOREVER!", "Go leak somewhere else!", "1901, ya mugs! Respect ya elders!"] };
const BRAWL_LOSSES = ["Ow... me ribs...", "I meant to do that...", "Me mum's gonna kill me...", "That's it, I'm taking up golf.", "Is me tooth still in?"];
const RIDE_CHEERS = ["YEAHHH, BROTHER!", "Loud pipes save lives!", "Ride free, legend!", "WOOOO!", "THAT'S a motorbike!"];
const RIDE_NOISE: Record<"harley" | "indian", string[]> = { harley: ["POTATO POTATO POTATO!", "BRAAAP!", "BLAT BLAT BLAT!"], indian: ["VROOOOM!", "BRAAAP!", "RUMBLE RUMBLE!"] };
// The street fight in the bike shop brawl: each club's bikes, and who's paired up with who.
type RumbleBike = { id: number; brand: "harley" | "indian"; look: number; x: number; bottom: number; ms: number; faceLeft: boolean; ridden: boolean; moving: boolean };
type Rumble = { mid: number; bikes: RumbleBike[]; stage: "ride" | "fight" | "result" | "leave"; knocked: string | null; winner: "harley" | "indian" | null };
const SHOP_PAIRS = [{ at: -210, row: 18 }, { at: -75, row: 50 }, { at: 60, row: 18 }, { at: 195, row: 50 }];
const INDIAN_WEAPONS = ["🔧", undefined, "🌭", "🪃"], HARLEY_WEAPONS = ["🍺", "🔧", undefined, "🩴"];
// Life down the beach end: a bloke walking his dog round the park, tweakers going through the bins,
// lifeguard rescues and the odd shark.
type DogWalkState = { x: number; bottom: number; ms: number; faceLeft: boolean; pose: "walk" | "pee" | "poop" | "stand"; line: string | null };
type BinDiver = { who: "trev" | "kylie"; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "cook" | "dance"; line: string | null };
type GuardState = { x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "swim" | "carry" | "flex" | "stand"; line: string | null };
type SwimmerState = { x: number; bottom: number; ms: number; faceLeft: boolean; pose: "drown" | "sit" | "walk"; line: string | null };
type SharkState = { surfer: { x: number; bottom: number } | null; fin: { x: number; bottom: number; ms: number } | null; chomp: { x: number; bottom: number } | null; blood: { x: number; bottom: number } | null; board: { x: number; bottom: number } | null };
const DOG_PEE_LINES = ["Every. Single. Tree.", "Hurry up, Bluey, it's cold.", "Not the BBQ, Bluey!", "Leave somethin' for the other dogs."];
const DOG_POOP_LINES = ["Nobody saw that.", "Good boy! ...ah. No bags.", "Council can pick that up.", "That's a ripper, Bluey."];
const BIN_FINDS = ["Half a dim sim! JACKPOT!", "Who chucks out a perfectly good pie?!", "Chips! Bit of sand on 'em. Still good.", "Ooh, a bottle cap. Score.", "Cold snag! Breakfast sorted!", "Half a can of Bundy! It's me birthday!"];
const RESCUE_THANKS = ["My hero!", "*cough* ...thanks, legend!", "I only went in for a wee!", "Can I get your number? For... safety."];
const RESCUE_BRAG = ["All in a day's work.", "Swim between the flags, love!", "That's what the flags are for!", "Rip current. Happens to the best of us."];
const SHARK_SCREAMS = ["SHAAAARK!", "GET OUTTA THE WATER!", "Not again...", "He was such a good paddler..."];
// Out on the water: ski boats, jet skis, parasailers, dolphins, whales (and what happens to people
// who fall in). Each bit is a positioned span; `cls` moves it, `inner` animates what's inside.
// `tms` makes a bit slide (CSS transition on left) to its x instead, with `ease`; `hide` fades it out.
type SeaBit = { id: number; kind: "ski" | "skier" | "jet" | "para" | "rider" | "pod" | "whale" | "tail" | "fin" | "chomp" | "blood" | "vmr" | "broke" | "floater" | "pelicans" | "pelicanDiver" | "chute" | "wreck"; x: number; bottom: number; w: number; h: number; cls?: string; inner?: string; clip?: boolean; dx?: number; dy?: number; ms?: number; delay?: number; on?: boolean; colour?: string; tms?: number; ease?: string; hide?: boolean; hook?: boolean };
type BazzaState = { x: number; bottom: number; ms: number; faceLeft: boolean; pose: "walk" | "hold" | "zapped" | "hop"; line: string | null };
// Flying foxes hanging off the power lines: hover over one and it touches two wires (ZZZT), shoot one
// and it drops; another one hangs up there again later.
type Bat = { id: number; wire: WireName; t: number; open: boolean; zapped: boolean; shot: boolean };
const BAT_SPOTS: [WireName, number, boolean][] = [["rightHigh", 0.52, false], ["rightHigh", 0.545, true], ["rightHigh", 0.57, false], ["rightHigh", 0.595, false], ["leftLow", 0.3, false], ["leftLow", 0.33, true], ["midHigh", 0.66, false], ["midHigh", 0.685, false]];
const BAT_ZAPS = ["ZZZZT!", "BZZZT!", "*crackle*", "SKREEEE!", "*smells like BBQ*"];
// Two dancers from Sandy Bottoms on a smoko in Snag Alley. Click either and they have a yarn about
// the job: one sets it up, the other knocks it down. Dealt like a shuffled deck.
const DANCER_CHAT: [string, string][] = [
  ["Some bloke tried to tip me in Woolies vouchers.", "Ya take 'em? Eggs are dear, love."],
  ["Pole dancing's the only cardio I do.", "Same. That and running from me ex."],
  ["Me mum still thinks I work in hospitality.", "Technically true. Ya serve drinks... and dreams."],
  ["Another buck's party tonight.", "Great. Twelve Daryls and one tenner between 'em."],
  ["Bloke asked if I'm a uni student.", "Tell him ya majoring in his wallet."],
  ["These heels cost more than me rego.", "And they've got better suspension than your Commodore."],
  ["A tradie tipped me in Bunnings snags last night.", "Onion on top? Then he's a keeper."],
  ["Some fella reckons he 'doesn't normally come to these places'.", "Yeah, him and every other regular."],
  ["Me back's killin' me.", "Pole's tax deductible, love. Ask me accountant."],
  ["Bloke in there asked for me number.", "Gave him Centrelink's. He'll be on hold till Christmas."],
  ["Got glitter in places glitter's got no business bein'.", "Ya'll be findin' it at ya funeral, mate."],
  ["Hens night in there. They're feral.", "Worse than the bikies. At least the bikies tip."],
  ["The Harley boys were in last night.", "Tipped in beard hair and oil stains again?"],
  ["Then the Indian mob came in.", "Spent the whole night arguin' about the Harley mob, didn't they."],
  ["Some bloke tipped me entirely in coins.", "What is he, a parking meter?"],
  ["Smoko's the best part of the shift.", "Only time nobody's askin' for a 'special discount'."],
  ["Bloke asked me what a girl like me's doin' in a place like this.", "Rent, mate. It's called rent."],
  ["Me stage name's Sandy. 'Cos of the club.", "Mine's Chardonnay. 'Cos of the chardonnay."],
  ["True Blue come in again. Paid in shrimp off the barbie.", "Better than the bloke who paid in exposure."],
  ["I'm savin' up for a house.", "On the Gold Coast? Better learn a few more moves, love."],
];
// The seagull chip heist: someone brings fish and chips down to the beach, the gulls gather, and
// one of them makes off with the lot.
type Gull = { id: number; x: number; bottom: number; ms: number; faceLeft: boolean; flying: boolean; carrying: boolean };
type ChipRaid = { eater: { x: number; bottom: number; ms: number; faceLeft: boolean; pose: "walk" | "eat" | "shoo" | "robbed"; line: string | null }; gulls: Gull[] };
// Two choppers collide over the beach; the crowd on the sand has thoughts.
type Heli = { id: number; x: number; bottom: number; ms: number; faceLeft: boolean; falling: boolean; dy: number; livery: 0 | 1 };
type Gawker = { id: number; x: number; bottom: number; look: number; line: string | null };
const GAWKER_LINES = ["What a tragedy.", "I'm gonna mark meself safe on Facebook.", "We will rebuild...", "We're all in this together.", "A fucken dog ate my lunch!!"];
type Phase = "hidden" | "enter" | "parked" | "leave";
type Action = "flip" | "moon" | "drink" | "smoke" | "throw";
type Line = { text: string; ai: boolean };
type Fx = { stage?: number; palette?: string[]; id: number; kind: "leg" | "hole" | "poop" | "poopSplat" | "drop" | "feathers" | "smoke" | "tyre" | "skid" | "burst" | "bottle" | "shard" | "stars" | "fog" | "boom" | "rubber" | "bullet" | "junk" | "splat" | "rooFly" | "flail"; x: number; y: number; size: number; text?: string; dx?: number; dy?: number; arc?: number; hit?: boolean };
// Ids for everything on screen. Seeded from the clock so a hot reload (which re-runs this file
// while the old items are still on screen) can never hand out an id that is already in use.
let uid = Date.now();
// Full-screen mode (/day-out/shazz): set by the component when it mounts with `immersive`.
let IMMERSIVE = false;
const isPhone = () => typeof window !== "undefined" && (window.innerWidth < 640 || (IMMERSIVE && window.innerHeight < 500));
// The street drawing (Shopfronts, 5330×420) is shown whole at the strip's height, so the world is
// usually wider than the screen and you drag / swipe / edge-pan along it. The strip heights here
// match .shopStrip in day-out.module.css (full screen: shops in the bottom half, sky above).
const STREET_X = -1120, STREET_W = 5330, STREET_H = 420;
const stripHeight = () => {
  const W = window.innerWidth, H = window.innerHeight;
  if (IMMERSIVE) return Math.min(H - 147, Math.max(H * 0.46, 220));
  if (W <= 640) return Math.min(252, H * 0.5);
  return Math.max(240, Math.min(W * 0.28, H * 0.64));
};
const VW = () => {
  if (typeof window === "undefined") return 1200;
  return Math.max(window.innerWidth, Math.round(stripHeight() * STREET_W / STREET_H));
};
// Crossing timings were tuned for a ~1600px street; this stretches one to the full street (out to
// the beach) so things keep their speed instead of rocketing across.
const span = (ms: number) => ms * Math.max(1, VW() / 1600);
// Sportsbikes are drawn 110×60; this keeps them road-sized next to the cars and Shazz.
const sportbikeW = () => (isPhone() ? 150 : 205);
// Everything Shazz can take a shot at. Birds and pests go up in a puff; the rest drop as dinner.
type Target = { kind: "flyer"; id: number } | { kind: "flock"; index: number } | { kind: "raider" } | { kind: "ibis" } | { kind: "magpie"; id: number } | { kind: "swooper"; id: number } | { kind: "bat"; id: number }
  | { kind: "roo"; id: number } | { kind: "crossing"; id: number } | { kind: "snake"; id: number } | { kind: "strikeRoo" }
  | { kind: "dropBear" } | { kind: "dangler"; id: number } | { kind: "koala"; tree: number } | { kind: "lorikeet"; id: number } | { kind: "emu"; id: number };
const FUR: Partial<Record<Target["kind"], string[]>> = {
  roo: ["#b5733a", "#e6c49a"], strikeRoo: ["#b5733a", "#e6c49a"], koala: ["#9aa0a6", "#e8e8e8"], dropBear: ["#8a7f72", "#5b5148"], dangler: ["#8a7f72", "#5b5148"],
  snake: ["#7a5c2e", "#c9a86a"], magpie: ["#111", "#fff", "#111"], swooper: ["#111", "#fff", "#111"], bat: ["#3b2a20", "#b07a3c", "#22160f"], emu: ["#5b4636", "#3b2f26", "#7a6048"], lorikeet: ["#16a34a", "#1d4ed8", "#f97316", "#dc2626", "#facc15"],
};
const POSTIE_W = 170, KID_W = 115;
type DolePerson = { id: number; who: "trev" | "kylie"; tint: string; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "peek" | "dance" | "scratch"; line: string | null; inside: boolean; cash: boolean; beer: boolean; stagger: boolean; gone: boolean; enter?: "climb" | "pop"; weird?: boolean };
type Crossing = { id: number; kind: Critter; x: number; bottom: number; ms: number; faceLeft: boolean; flat: boolean; done: boolean; lane: "far" | "near" };
type Hitter = { id: number; lane: "far" | "near"; dir: 1 | -1; vehicle: "car" | "bike"; color: string; vx: number; vms: number; vw: number };
type Snake = { id: number; x: number; bottom: number; ms: number; dir: 1 | -1; mode: "slither" | "hoop" | "flat"; done: boolean };
type Kid = { x: number; ms: number; dir: 1 | -1; panic: boolean; line: string | null; magpies: { id: number; ox: number; oy: number; sx: number; sy: number; delay: number }[] };

// `summon` increments each time the "Call Shazz" button is pressed; `dismiss` each time
// "Send Shazz home" is. `onPresence` reports whether she is on screen, so the header button can flip.
// `immersive`: the full-screen Bogan Street page. The street fills the screen and scrolls sideways.
export default function SmartArse({ topic, summon, dismiss = 0, onPresence, immersive = false }: { topic: string; summon: number; dismiss?: number; onPresence?: (out: boolean) => void; immersive?: boolean }) {
  IMMERSIVE = immersive;
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
  const treeSpots = () => TREES.map(t => ({ ...t, x: Math.round(stripMap().x(t.sx) - TREE.W / 2) }));
  // Palms: drawn 470 drawing-units tall (well over the rooftops), standing on the footpath.
  const palmSpots = () => {
    const sm = stripMap(), h = 470 * sm.k, w = h * 0.4;
    return PALMS.map((pt, i) => {
      const trunk = sm.x(pt.sx), base = sm.b(395);
      return { ...pt, i, left: trunk - w / 2, w, h, base, trunk, skirtX: trunk + (pt.lean * w) / 12, skirtBottom: base + h * 0.7 };
    });
  };
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
  const [blue, setBlue] = useState<{ x: number; bottom?: number; ms: number; faceLeft: boolean; pose: TrueBluePose; line: string | null; fish: boolean } | null>(null);
  const blueBusy = useRef(false);
  const [blueAnimal, setBlueAnimal] = useState<{ kind: "roo" | "koala" | "wombat" | "dropbear" | "croc"; x: number; ms: number; faceLeft: boolean } | null>(null);
  type PerchBird = { x: number; bottom: number; ms: number; landed: boolean } | null;
  const [blueBirds, setBlueBirds] = useState<{ lori: PerchBird; ibis: PerchBird } | null>(null);
  const [pelican, setPelican] = useState<{ x: number; bottom: number; ms: number; fish: boolean } | null>(null);
  const [roadFish, setRoadFish] = useState<{ x: number } | null>(null);
  const [gary, setGary] = useState<{ mode: "hiding" | "out"; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "dance" | "crawl" | "pee"; carrying: Critter | "fish" | null; fish: boolean; line: string | null } | null>(null);
  const garyBusy = useRef(false);
  // Bev from the caravan park and the dingo pack that pinched her snags.
  const [bev, setBev] = useState<{ x: number; ms: number; faceLeft: boolean; pose: "shout" | "run"; line: string | null } | null>(null);
  const [dingoes, setDingoes] = useState<{ id: number; x: number; ms: number; faceLeft: boolean; running: boolean; snags: boolean; puzzled: boolean }[]>([]);
  const dingoBusy = useRef(false);
  // Cockroaches scuttling about the footpath and the edge of the road.
  const [roaches, setRoaches] = useState<Roach[]>([]);
  // Jets high over the street, leaving contrails ("chemtrails", if you ask Trev).
  const [jets, setJets] = useState<{ id: number; x0: number; y0: number; x1: number; y1: number; ms: number }[]>([]);
  // Dole day at Centrelink.
  const [dole, setDole] = useState<{ open: boolean; people: DolePerson[] } | null>(null);
  const doleBusy = useRef(false);
  const dolePeopleLeft = useRef(0);
  const doleNow = useRef<typeof dole>(null);
  const doleRobbed = useRef(new Set<number>());
  useEffect(() => { doleNow.current = dole; dolePeopleLeft.current = dole ? dole.people.filter(d => !d.gone).length : 0; }, [dole]);
  // A tree tweaker down on the road having a go at the crows over a carcass.
  const [fighter, setFighter] = useState<{ who: "trev" | "kylie" | "gary"; x: number; bottom: number; ms: number; faceLeft: boolean; pose: "run" | "dance"; carrying: Critter | null; scuffle: boolean; line: string | null } | null>(null);
  // A tweaker clicked out of their tree for a five-second boogie.
  const [boogie, setBoogie] = useState<{ who: "trev" | "kylie" | "gary"; x: number; line: string } | null>(null);
  // Emus: each takes two shots. `hits` 1 = one leg gone, hopping slower.
  const [emus, setEmus] = useState<{ id: number; dir: 1 | -1; x: number; bottom: number; size: number; ms: number; hits: number }[]>([]);
  const [roos, setRoos] = useState<{ id: number; dir: 1 | -1; bottom: number; size: number; ms: number; delay: number; hop: number; joey: boolean }[]>([]);
  // The bin chicken's wheelie bin, out the front of Centrelink where the scrappy street tree used to be.
  const binX = () => Math.round(stripMap().x(760) - BIN_W / 2);
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
  // Mouse drag to move along the street (when it is wider than the screen). A drag never counts as
  // a click, so letting go doesn't shoot, lasso or send Shazz anywhere.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const menuOpen = useRef(false);
  menuOpen.current = menu;
  const edgePointer = useRef<{ x: number; y: number; type: string; down: boolean } | null>(null);
  useEffect(() => {
    let raf = 0, lit = "";
    const light = (side: string) => {
      if (side === lit) return;
      document.body.classList.remove(styles.edgePanLeft, styles.edgePanRight);
      if (side) document.body.classList.add(side === "left" ? styles.edgePanLeft : styles.edgePanRight);
      lit = side;
    };
    const onMove = (event: PointerEvent) => {
      // Not while over the buttons that live near the edges.
      const target = event.target as Element | null;
      if (target?.closest?.(`.${styles.trickBar}, .${styles.immersiveBack}, .${styles.fullButton}, .${styles.rotatePrompt}`)) { edgePointer.current = null; return; }
      edgePointer.current = { x: event.clientX, y: event.clientY, type: event.pointerType, down: event.buttons > 0 };
    };
    const onEnd = (event: PointerEvent) => { if (event.pointerType !== "mouse") edgePointer.current = null; };
    const onLeave = () => { edgePointer.current = null; };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const sc = scroller.current, pt = edgePointer.current;
      if (!sc || !pt || menuOpen.current || drag.current?.moved || sc.scrollWidth <= sc.clientWidth + 4 || (pt.type !== "mouse" && !pt.down)) { light(""); return; }
      const W = window.innerWidth, H = window.innerHeight;
      // On the normal page only the scene at the bottom counts, not the planner above it.
      if (!IMMERSIVE) { const strip = document.querySelector<HTMLElement>(`.${styles.shopStrip}`); if (pt.y < H - 147 - (strip?.offsetHeight ?? 0) - 30) { light(""); return; } }
      const zone = Math.min(220, Math.max(70, W * 0.18));
      const v = pt.x < zone ? -Math.pow(1 - pt.x / zone, 2) : pt.x > W - zone ? Math.pow(1 - (W - pt.x) / zone, 2) : 0;
      const before = sc.scrollLeft;
      if (v) sc.scrollLeft += v * 16;
      light(v && sc.scrollLeft !== before ? (v < 0 ? "left" : "right") : "");
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(raf); light("");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const d = drag.current, sc = scroller.current;
      if (!d || !sc) return;
      const dx = event.clientX - d.x;
      if (!d.moved && Math.abs(dx) > 6) { d.moved = true; document.body.classList.add(styles.dragging); }
      if (d.moved) sc.scrollLeft = d.left - dx;
    };
    const up = () => {
      if (drag.current?.moved) { justDragged.current = true; window.setTimeout(() => { justDragged.current = false; }, 80); }
      drag.current = null;
      document.body.classList.remove(styles.dragging);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);
  const [phoneView, setPhoneView] = useState(false);
  const panX = () => scroller.current?.scrollLeft ?? 0;
  const sRect = (el: Element) => {
    const r = el.getBoundingClientRect(), dx = panX();
    return { left: r.left + dx, right: r.right + dx, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  // Swipe the phone view so x (scene px) is in the middle of the screen.
  const panTo = (x: number) => {
    const sc = scroller.current;
    if (!sc || sc.scrollWidth <= sc.clientWidth + 4) return;
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
    const dir: 1 | -1 = lane === "far" ? 1 : -1, ms = span(4200 + Math.random() * 2500);
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
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, base = 200 + Math.random() * Math.max(80, window.innerHeight * 0.4), ms = span(6500 + Math.random() * 3000);
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
      case "swooper": setSwoopers(list => list.filter(b => b.id !== target.id)); break;
      case "bat": {
        const fell = bats.find(b => b.id === target.id);
        setBats(list => list.map(b => (b.id === target.id ? { ...b, shot: true, zapped: false } : b)));
        window.setTimeout(() => setBats(list => list.filter(b => b.id !== target.id)), 1300);
        // Another one hangs up in the same spot a while later.
        if (fell) window.setTimeout(() => setBats(list => (list.length ? [...list, { ...fell, id: ++uid, shot: false, zapped: false }] : list)), 45_000 + Math.random() * 30_000);
        break;
      }
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
    // Half land along the shop rooftops (parapet tops in the street drawing), half in the gums.
    const sm = stripMap(), ROOFTOPS: [number, number, number][] = [[10, 240, 82], [255, 495, 64], [505, 570, 70], [680, 745, 70], [755, 995, 88], [1455, 1510, 84], [1640, 1695, 84], [1705, 1805, 110], [1945, 2045, 110], [1005, 1115, 20], [1120, 1445, 78], [-445, -5, 58], [2445, 2475, 150], [2615, 2645, 110], [2795, 2825, 160]];
    const perch = () => {
      if (Math.random() < 0.5) { const [a, b, y] = pick(ROOFTOPS); return { x: sm.x(a + Math.random() * (b - a)) - 16, bottom: sm.b(y) - 3 }; }
      const t = pick(trees); return { x: t.x + TREE.W * (0.12 + Math.random() * 0.7) - 15, bottom: TREE_BOTTOM + TREE.H * (0.62 + Math.random() * 0.28) };
    };
    const birds = Array.from({ length: 32 }, (_, i) => ({ id: ++uid, x: fromRight ? W + 30 + Math.random() * 220 : -60 - Math.random() * 220, bottom: H * (0.55 + Math.random() * 0.3), ms: 0, delay: i * 60, faceLeft: fromRight, perched: false }));
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
  // ---- Dole day at Centrelink -------------------------------------------------------------
  // Where things in the shop-strip drawing (Shopfronts' viewBox is -1120 0 5330 420, scaled to cover
  // the strip) land on screen. Building coordinates are in drawing units; the Indian shop is at x < 0.
  const stripMap = () => {
    const strip = typeof document === "undefined" ? null : document.querySelector<HTMLElement>(`.${styles.shopStrip}`);
    const W = VW(), h = strip?.offsetHeight || (typeof window === "undefined" ? 300 : stripHeight());
    const k = Math.max(W / STREET_W, h / STREET_H), off = (W - STREET_W * k) / 2;
    return { x: (svgX: number) => off + (svgX - STREET_X) * k, b: (svgY: number) => 147 + (420 - svgY) * k, k };
  };
  // The bludgers queue before it opens, have a yarn, file in one door and out the other with cash.
  // About half go straight into the bottlo and stagger back out.
  async function doleDay() {
    if (doleBusy.current || phaseRef.current !== "parked") return;
    doleBusy.current = true;
    doleRobbed.current.clear();
    sceneUntil.current = Date.now() + 120_000;
    const W = VW(), m = stripMap(), entry = m.x(790), exit = m.x(935), bottlo = m.x(BOTTLO_DOOR), foot = m.b(395), door = m.b(381);
    const tints = ["#b91c1c", "#16a34a", "#2563eb", "#f59e0b", "#7c3aed", "#0f766e", "#f9a8d4", "#fb923c", "#22d3ee", "#a3e635", "#e11d48", "#fde047"];
    const gap = Math.min(46, Math.max(26, (entry - 60) / tints.length));
    const spot = (i: number) => entry - 70 - i * gap;
    // Where they come from: walking in from either side, climbing down off the rooftops, or out of the bins.
    const ROOFS: [number, number][] = [[125, 82], [375, 64], [625, 40], [875, 88], [1280, 78], [1575, 50], [1760, 110], [1990, 110]];
    const binAt = binX() + BIN_W / 2 - 33, binTop = BIN_BOTTOM + BIN_H - 56;
    const people: DolePerson[] = tints.map((tint, i) => {
      const from = i % 4, roof = ROOFS[(i * 7) % ROOFS.length];
      const base = { id: ++uid, who: (i % 2 ? "kylie" : "trev") as "trev" | "kylie", tint, ms: 0, line: null, inside: false, cash: false, beer: false, stagger: false, gone: false };
      if (from === 2) return { ...base, x: m.x(roof[0]) - 33 + (i % 3) * 22, bottom: m.b(roof[1]) - 24, faceLeft: false, pose: "dance" as const, enter: "climb" as const };
      if (from === 3) return { ...base, x: binAt, bottom: binTop, faceLeft: false, pose: "dance" as const, enter: "pop" as const };
      return { ...base, x: from === 1 ? W + 40 + i * 30 : -90 - i * 40, bottom: foot, faceLeft: from === 1, pose: "run" as const };
    });
    const setPerson = (id: number, change: (p: DolePerson) => DolePerson) => setDole(d => d && { ...d, people: d.people.map(p => (p.id === id ? change(p) : p)) });
    setDole({ open: false, people });
    panTo(entry);
    await later(60);
    // Down off the rooftops hand over hand, and up out of the bins with a clang.
    people.forEach((p, i) => {
      if (p.enter === "climb") setPerson(p.id, q => ({ ...q, bottom: foot, ms: 2600 + i * 120 }));
      if (p.enter === "pop") window.setTimeout(() => {
        setBinRattle(true);
        window.setTimeout(() => setBinRattle(false), 700);
        add({ kind: "burst", x: binAt - 10, y: BIN_BOTTOM + BIN_H + 40, size: 0, text: pick(["CLANG!", "RATTLE RATTLE", "BOO!"]) });
        setPerson(p.id, q => ({ ...q, bottom: foot, x: q.x + 54, ms: 600 }));
      }, 300 + i * 260);
    });
    await later(2900 + people.length * 140);
    // Then everyone into the queue (before it's even open).
    let longest = 0;
    people.forEach((p, i) => {
      const from = p.enter === "pop" ? p.x + 54 : p.x, ms = Math.max(1500, Math.abs(spot(i) - from) * 5);
      longest = Math.max(longest, ms);
      setPerson(p.id, q => ({ ...q, pose: "run", enter: undefined, x: spot(i), ms, faceLeft: spot(i) < q.x }));
    });
    await later(longest + 100);
    // Waiting: half of 'em can't stop scratching.
    const IDLE: DolePerson["pose"][] = ["peek", "scratch", "peek", "scratch", "dance"];
    people.forEach(p => setPerson(p.id, q => ({ ...q, pose: pick(IDLE), faceLeft: Math.random() < 0.2, ms: 0 })));
    // A yarn while they wait: one at a time.
    const talk = [...DOLE_QUEUE_LINES].sort(() => Math.random() - 0.5).slice(0, 4);
    for (const line of talk) {
      const who = pick(people).id;
      people.forEach(pp => { if (Math.random() < 0.35) setPerson(pp.id, q => ({ ...q, pose: pick(IDLE), faceLeft: Math.random() < 0.2 })); });
      const itchy = Math.floor(Math.random() * people.length);
      add({ kind: "burst", x: spot(itchy) - 20, y: foot + 130, size: 0, text: pick(["*scratch scratch*", "*scritch*", "itchy itchy"]) });
      setPerson(who, q => ({ ...q, line }));
      await later(3200);
      setPerson(who, q => ({ ...q, line: null }));
      await later(300);
    }
    // Doors open.
    setDole(d => d && { ...d, open: true });
    add({ kind: "burst", x: entry - 80, y: door + 120, size: 0, text: "NOW SERVING: 001" });
    setPerson(people[0].id, q => ({ ...q, line: "IT'S OPEN! IT'S OPEN!" }));
    await later(1200);
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      // Front of the line goes in; everyone behind shuffles up.
      setPerson(p.id, q => ({ ...q, line: null, pose: "run", x: entry - 33, bottom: door, ms: 700 }));
      for (let j = i + 1; j < people.length; j++) { const at = spot(j - i - 1); setPerson(people[j].id, q => ({ ...q, x: at, ms: 700 })); }
      await later(750);
      setPerson(p.id, q => ({ ...q, inside: true }));
      // Processed, out the other door with cash.
      void (async () => {
        await later(1800);
        setPerson(p.id, q => ({ ...q, inside: false, cash: true, x: exit - 33, bottom: door, ms: 0, faceLeft: false, line: pick(DOLE_EXIT_LINES) }));
        await later(500);
        const roll = Math.random(), offRight = W + 90, offLeft = -110;
        const off = async (x: number, ms: number) => { setPerson(p.id, q => ({ ...q, x, ms, faceLeft: x < exit })); await later(ms + 100); };
        // A victim: someone else outside holding cash who isn't already being robbed.
        const victim = doleNow.current?.people.find(v => v.id !== p.id && v.cash && !v.inside && !v.gone && !doleRobbed.current.has(v.id));
        if (roll < 0.28) {
          // Straight to the bottlo...
          setPerson(p.id, q => ({ ...q, x: bottlo - 33, bottom: foot, ms: Math.max(1200, Math.abs(bottlo - exit) * 4) }));
          await later(Math.max(1200, Math.abs(bottlo - exit) * 4) + 50);
          setPerson(p.id, q => ({ ...q, bottom: door, ms: 400, line: null }));
          await later(450);
          setPerson(p.id, q => ({ ...q, inside: true, cash: false }));
          await later(2600 + Math.random() * 1500);
          // ...and staggers back out with a tinnie.
          setPerson(p.id, q => ({ ...q, inside: false, beer: true, stagger: true, bottom: foot, ms: 500, line: pick(DOLE_BOTTLO_LINES) }));
          await later(1800);
          setPerson(p.id, q => ({ ...q, line: null }));
          await off(offRight, 7000);
        } else if (roll < 0.42 && victim) {
          // Snatch and run: grabs someone else's cash, and they give chase.
          doleRobbed.current.add(victim.id);
          setPerson(p.id, q => ({ ...q, bottom: foot, x: victim.x - 20, ms: 600, line: "Ooh, what's that?" }));
          await later(650);
          add({ kind: "burst", x: victim.x - 20, y: foot + 120, size: 0, text: "YOINK!" });
          const away = victim.x < W / 2 ? offLeft : offRight;
          setPerson(p.id, q => ({ ...q, line: "FINDERS KEEPERS!", x: away, ms: Math.abs(away - victim.x) * 1.6, faceLeft: away < victim.x }));
          setPerson(victim.id, q => ({ ...q, cash: false, stagger: false, line: "OI! ME DOLE!", x: away, ms: Math.abs(away - victim.x) * 1.8 + 400, faceLeft: away < victim.x, pose: "run" }));
          window.setTimeout(() => setPerson(victim.id, q => ({ ...q, gone: true })), Math.abs(away - victim.x) * 1.8 + 600);
          await later(Math.abs(away - victim.x) * 1.6 + 150);
        } else if (roll < 0.58) {
          // Sprints off like the cops are after him.
          setPerson(p.id, q => ({ ...q, bottom: foot, ms: 300, line: pick(["GOTTA GO FAST!", "BEFORE THEY CHANGE THEIR MINDS!", "RUN, MONEY, RUN!"]) }));
          await later(350);
          const to = Math.random() < 0.5 ? offLeft : offRight;
          await off(to, Math.abs(to - exit) * 1.3);
        } else if (roll < 0.8) {
          // Scatters like a weirdo: darting about, spinning, hopping, before buggering off.
          setPerson(p.id, q => ({ ...q, bottom: foot, ms: 300, weird: true, line: pick(["WOOO! RICH!", "I CAN HEAR COLOURS!", "WHICH WAY'S HOME?!"]) }));
          await later(350);
          let x = exit;
          for (let k = 0; k < 4; k++) {
            x = Math.max(20, Math.min(W - 80, x + (Math.random() - 0.5) * 320));
            const nx = x;
            setPerson(p.id, q => ({ ...q, x: nx, bottom: foot + Math.random() * 18, ms: 450, faceLeft: Math.random() < 0.5, line: k === 1 ? null : q.line }));
            await later(500);
          }
          await off(Math.random() < 0.5 ? offLeft : offRight, 2200);
        } else {
          // Wanders off the other way, counting it.
          setPerson(p.id, q => ({ ...q, bottom: foot, ms: 400, line: pick(["One, two… three hundred an'… lost count.", "Rent? Nah. Priorities."]) }));
          await later(450);
          await off(offLeft, Math.max(3000, Math.abs(offLeft - exit) * 6));
        }
        setPerson(p.id, q => ({ ...q, gone: true }));
      })();
      await later(1000);
    }
    // Wait for the last of them to wander off, then shut up shop.
    for (let t = 0; t < 30 && dolePeopleLeft.current > 0; t++) await later(1000);
    setDole(null);
    doleBusy.current = false;
  }

  // Bev storms out screaming that a dingo took her snags. Every time she yells, the pack looks at
  // each other with a big "?"; then they chase her off the screen, one still with the sausages.
  async function dingoSnags(now = false) {
    if (dingoBusy.current) return;
    if (now) sceneUntil.current = Date.now() + 30_000;
    else if (!claimScene(24_000, 8000)) return;
    dingoBusy.current = true;
    const W = VW(), stand = Math.round(W * 0.42);
    setBev({ x: -80, ms: 0, faceLeft: false, pose: "run", line: null });
    panTo(stand);
    await later(60);
    setBev(b => b && { ...b, x: stand, ms: 2200 });
    await later(2250);
    setBev(b => b && { ...b, pose: "shout", line: BEV_LINES[0] });
    // The pack trots in from the other side and sits there looking at her.
    const pack = Array.from({ length: 5 }, (_, i) => ({ id: ++uid, x: W + 40 + i * 60, ms: 0, faceLeft: true, running: true, snags: i === 0, puzzled: false }));
    setDingoes(pack);
    await later(60);
    setDingoes(list => list.map((d, i) => ({ ...d, x: stand + 120 + i * 58, ms: 2000 + i * 150 })));
    await later(2300);
    setDingoes(list => list.map(d => ({ ...d, running: false })));
    // Every scream: the whole pack goes "?".
    for (let i = 1; i < BEV_LINES.length; i++) {
      setBev(b => b && { ...b, line: BEV_LINES[i] });
      setDingoes(list => list.map(d => ({ ...d, puzzled: true, faceLeft: Math.random() < 0.7 })));
      await later(1600);
      setDingoes(list => list.map(d => ({ ...d, puzzled: false })));
      await later(700);
    }
    // Then they go for her.
    setBev(b => b && { ...b, pose: "run", faceLeft: true, line: "AAAAAAAAH!", x: -120, ms: 3600 });
    setDingoes(list => list.map((d, i) => ({ ...d, running: true, faceLeft: true, puzzled: false, x: -120 - i * 30, ms: 3400 + i * 220 })));
    add({ kind: "burst", x: stand - 20, y: ROAD_H + 150, size: 0, text: "YIP YIP YIP!" });
    await later(4500);
    setBev(null); setDingoes([]);
    dingoBusy.current = false;
  }

  useEffect(() => {
    if (!immersive && phase === "hidden") return;
    let timer = 0;
    // One jet along a straight line through (cx, cy) at slope s (bottom-up px per px; + climbs to
    // the right). The low end never dips below the rooftops; the high end can fly out the top of the
    // sky (the sky is clipped there), which is what lets the trails cross at decent angles.
    // The sky band the jets fly in. Full screen: way up in the open sky above the rooftops.
    const sky = () => {
      const sm = stripMap(), H = window.innerHeight;
      return IMMERSIVE ? { W: VW(), lo: Math.max(sm.b(0) + 24, H * 0.55), hi: H - 8 } : { W: VW(), lo: sm.b(78), hi: sm.b(0) };
    };
    const launch = (cx: number, cy: number, s: number, leftToRight: boolean, delay = 0) => {
      const { W } = sky(), id = ++uid, ms = 9000 + Math.random() * 7000;
      const xa = -140, xb = W + 140, ya = cy + s * (xa - cx), yb = cy + s * (xb - cx);
      const [x0, y0, x1, y1] = leftToRight ? [xa, ya, xb, yb] : [xb, yb, xa, ya];
      window.setTimeout(() => {
        setJets(list => [...list, { id, x0, y0, x1, y1, ms }]);
        // The trail hangs about after the jet's gone, spreading out, then fades; tidy up once it has.
        window.setTimeout(() => setJets(list => list.filter(j => j.id !== id)), ms + 22_000);
      }, delay);
      return ms + delay;
    };
    // The steepest slope (with that sign) that keeps the low end of a line through (cx, cy) above the
    // rooftops: a climb only needs room on its left end, a descent on its right.
    const maxSlope = (cx: number, cy: number, sign: 1 | -1) => {
      const { W, lo } = sky(), room = sign > 0 ? cx + 140 : W + 140 - cx;
      return sign * Math.max(0.03, (cy - lo) / room);
    };
    const sgn = (): 1 | -1 => (coin() ? 1 : -1);
    const coin = () => Math.random() < 0.5;
    // Different patterns, never the same one twice running.
    const PATTERNS = ["solo", "x", "lattice", "hash", "formation"] as const;
    let last = "";
    const fly = () => {
      const { W, lo, hi } = sky(), band = hi - lo;
      const pattern = pick(PATTERNS.filter(p => p !== last));
      last = pattern;
      let longest = 0;
      const at = (fx: number, fy: number) => ({ cx: W * fx, cy: lo + band * fy });
      if (pattern === "solo") {
        const { cx, cy } = at(0.2 + Math.random() * 0.6, 0.35 + Math.random() * 0.5), s = maxSlope(cx, cy, sgn()) * (0.4 + Math.random() * 0.6);
        longest = launch(cx, cy, s, coin());
      } else if (pattern === "x") {
        // Two through the same point on opposite slopes.
        const { cx, cy } = at(0.2 + Math.random() * 0.6, 0.45 + Math.random() * 0.45), up = maxSlope(cx, cy, 1) * (0.6 + Math.random() * 0.4), down = maxSlope(cx, cy, -1) * (0.6 + Math.random() * 0.4);
        longest = Math.max(launch(cx, cy, up, coin()), launch(cx, cy, down, coin(), 1200 + Math.random() * 3000));
      } else if (pattern === "lattice") {
        // A run of trails alternating slopes across the sky: a criss-cross diamond lattice.
        const n = 4 + Math.floor(Math.random() * 3), cy = lo + band * (0.55 + Math.random() * 0.35);
        for (let i = 0; i < n; i++) {
          const cx = W * (0.12 + (i / (n - 1)) * 0.76), s = maxSlope(cx, cy, i % 2 ? -1 : 1) * 0.85;
          longest = Math.max(longest, launch(cx, cy, s, coin(), i * (900 + Math.random() * 900)));
        }
      } else if (pattern === "hash") {
        // Two parallel one way, two parallel the other: a #.
        const cy = lo + band * (0.6 + Math.random() * 0.3), gap = W * (0.12 + Math.random() * 0.1);
        // Same steepness for both pairs so the # stays square-ish.
        const s = Math.min(maxSlope(W * 0.5 - gap, cy, 1), -maxSlope(W * 0.5 + gap, cy, -1)) * 0.9;
        ([[W * 0.5 - gap, 1], [W * 0.5 + gap, 1], [W * 0.5 - gap, -1], [W * 0.5 + gap, -1]] as [number, 1 | -1][]).forEach(([cx, sign], i) => {
          longest = Math.max(longest, launch(cx, cy, s * sign, coin(), i * (700 + Math.random() * 1200)));
        });
      } else {
        // Formation: two or three side by side on the same heading.
        const { cx, cy } = at(0.3 + Math.random() * 0.4, 0.6 + Math.random() * 0.3), s = maxSlope(cx, cy, sgn()) * (0.3 + Math.random() * 0.6), dir = coin();
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) longest = Math.max(longest, launch(cx + i * 30, cy + i * 14, s, dir, i * (300 + Math.random() * 400)));
      }
      if (Math.random() < 0.35) window.setTimeout(() => {
        const trees = treeSpots(), t = pick(trees);
        add({ kind: "burst", x: t.x + TREE.W * 0.3, y: TREE_BOTTOM + TREE.H * 0.7, size: 0, text: pick(["CHEMTRAILS!!", "SEE?! SEE?! CHEMTRAILS!", "THEY'RE SPRAYIN' US AGAIN!", "VEGEMITE VAPOUR, I TOLD YA!", "THAT'S A GRID! THEY'RE MAPPIN' US!"]) });
      }, Math.min(longest, 8000) * 0.5);
      timer = window.setTimeout(fly, Math.max(14_000, longest * 0.6) + Math.random() * 18_000);
    };
    timer = window.setTimeout(fly, 5000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);

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
    const bird = ["flyer", "flock", "raider", "ibis", "lorikeet", "bat"].includes(target.kind), pest = ["magpie", "swooper", "dropBear", "dangler", "emu"].includes(target.kind);
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
    const start = dir === 1 ? -w - 10 : VW() + 10, end = dir === 1 ? VW() + 10 : -w - 10, ms = span(9000);
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
    setFlock(fl => fl && { ...fl, dir: 1, stage: "pass", birds: fl.birds.map((b, i) => ({ ...b, x: VW() + 80 + i * 60, bottom: window.innerHeight * (0.62 + (i % 3) * 0.07), ms: span(7000) + i * 200 })) });
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
    const ms = span(red ? 380 + Math.random() * 80 : 1900 + Math.random() * 900);
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
      setFlyers(list => [...list, ...ids.map((id, i) => ({ id, dir, bottom: base + (i % 2 ? 40 : -10) * Math.ceil(i / 2), ms: span(8000) + i * 220, delay: i * 300 }))]);
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
      [8, () => void lorikeetVisit()],
      [2, () => void dingoSnags()],
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

  // Roaches: only a few about. They live in the palm skirts: every so often one scuttles to the
  // nearest palm, runs up the trunk and vanishes into the dead fronds, and another one comes down a
  // trunk somewhere else a bit later. On the ground they dart, freeze, dart again. Click to stomp.
  const roachCount = () => (isPhone() ? 2 : 3);
  const roachesRef = useRef<Roach[]>([]);
  useEffect(() => { roachesRef.current = roaches; }, [roaches]);
  const roachMove = (r: Roach, x: number, bottom: number, msPerPx: number): Roach =>
    ({ ...r, x, bottom, ms: Math.max(220, Math.hypot(x - r.x, bottom - r.bottom) * msPerPx), angle: (Math.atan2(-(bottom - r.bottom), x - r.x) * 180) / Math.PI });
  const setRoach = (id: number, change: (r: Roach) => Roach) => setRoaches(list => list.map(r => (r.id === id && !r.squashed ? change(r) : r)));
  // Out of a palm skirt and down the trunk to the footpath.
  function roachEmerge() {
    if (roachesRef.current.filter(r => !r.squashed).length >= roachCount()) return;
    const palm = pick(palmSpots()), id = ++uid, climb = Math.max(220, (palm.skirtBottom - palm.base) * 7);
    setRoaches(list => [...list, { id, x: palm.skirtX - 14, bottom: palm.skirtBottom, ms: 0, angle: 90, squashed: false, busy: true }]);
    window.setTimeout(() => setRoach(id, r => roachMove(r, palm.trunk - 14, palm.base - 6, 7)), 120);
    window.setTimeout(() => setRoach(id, r => ({ ...r, busy: false })), 120 + climb + 200);
  }
  // Back to the nearest palm, up the trunk and gone; another one comes out somewhere later on.
  function roachHome(id: number) {
    const r0 = roachesRef.current.find(r => r.id === id);
    if (!r0) return;
    const palm = palmSpots().reduce((best, pt) => (Math.abs(pt.trunk - r0.x) < Math.abs(best.trunk - r0.x) ? pt : best));
    const dash = Math.max(220, Math.hypot(palm.trunk - 14 - r0.x, palm.base - 6 - r0.bottom) * 2.2), climb = Math.max(220, (palm.skirtBottom - palm.base) * 7);
    setRoach(id, r => ({ ...roachMove(r, palm.trunk - 14, palm.base - 6, 2.2), busy: true }));
    window.setTimeout(() => setRoach(id, r => roachMove(r, palm.skirtX - 14, palm.skirtBottom, 7)), dash + 150);
    window.setTimeout(() => setRoaches(list => list.filter(r => r.id !== id || r.squashed)), dash + 150 + climb + 100);
    window.setTimeout(roachEmerge, dash + climb + 6000 + Math.random() * 9000);
  }
  const roachHomeRef = useRef(roachHome);
  roachHomeRef.current = roachHome;
  const roachEmergeRef = useRef(roachEmerge);
  roachEmergeRef.current = roachEmerge;
  useEffect(() => {
    if (!immersive && phase === "hidden") { setRoaches([]); return; }
    // Start with one already out on the street and the rest coming down out of the palms.
    const starters: number[] = [];
    if (!roachesRef.current.length) {
      const W = VW();
      setRoaches([{ id: ++uid, x: 20 + Math.random() * (W - 60), bottom: GROUND + Math.random() * (ROAD_H + 22 - GROUND), ms: 0, angle: Math.random() * 360, squashed: false, busy: false }]);
      for (let i = 1; i < roachCount(); i++) starters.push(window.setTimeout(() => roachEmergeRef.current(), 1500 + i * 2500));
    }
    const timer = window.setInterval(() => {
      const W = VW();
      setRoaches(list => list.map(r => {
        if (r.squashed || r.busy || Math.random() > 0.3) return r;
        // A quick dash in a random direction (roaches don't do straight lines for long).
        const heading = r.angle + (Math.random() - 0.5) * 160, rad = (heading * Math.PI) / 180, dist = 40 + Math.random() * 170;
        const x = Math.max(10, Math.min(W - 40, r.x + Math.cos(rad) * dist)), bottom = Math.max(GROUND - 4, Math.min(ROAD_H + 24, r.bottom - Math.sin(rad) * dist * 0.35));
        return roachMove(r, x, bottom, 2.2);
      }));
    }, 450);
    // Now and then one heads home to its palm.
    const nest = window.setInterval(() => {
      if (Math.random() > 0.3) return;
      const out = roachesRef.current.filter(r => !r.squashed && !r.busy);
      if (out.length) roachHomeRef.current(pick(out).id);
    }, 5000);
    return () => { clearInterval(timer); clearInterval(nest); starters.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);
  function stompRoach(id: number, x: number, y: number) {
    setRoaches(list => list.map(r => (r.id === id ? { ...r, squashed: true, ms: 0 } : r)));
    add({ kind: "burst", x: x - 30, y: y + 30, size: 0, text: pick(["SQUISH!", "CRUNCH!", "GOTCHA!", "EWW!"]) });
    window.setTimeout(() => setRoaches(list => list.filter(r => r.id !== id)), 2600);
    // A replacement comes down out of a palm a while later.
    window.setTimeout(() => roachEmergeRef.current(), 8000 + Math.random() * 8000);
  }

  // Bike-shop rivalry: three Harley blokes and three Indian blokes mill about out the front of their own
  // shops, and every so often one turns and flips the other shop off with a sledge. Sometimes the
  // other mob gives it straight back. Click one and his whole crew tells a joke (crewJoke below).
  const [shopBikers, setShopBikers] = useState<ShopBiker[]>([]);
  const shopBikersRef = useRef<ShopBiker[]>([]);
  useEffect(() => { shopBikersRef.current = shopBikers; }, [shopBikers]);
  const bikerZone = (brand: ShopBiker["brand"]): [number, number] => {
    const sm = stripMap();
    return brand === "harley" ? [sm.x(1125), sm.x(1425)] : [sm.x(-420), sm.x(-100)];
  };
  function bikerFlip(id: number, comeback = true) {
    const target = shopBikersRef.current.find(bk => bk.id === id);
    if (!target || target.flipping || target.crew) return;
    setShopBikers(list => list.map(bk => {
      if (bk.id !== id) return bk;
      // The rival shop is always to the other side: the Indian shop is at the left end of the street.
      return { ...bk, walking: false, ms: 0, until: 0, flipping: true, faceLeft: bk.brand === "harley", line: pick(bk.brand === "harley" ? HARLEY_JABS : INDIAN_JABS) };
    }));
    window.setTimeout(() => setShopBikers(list => list.map(bk => (bk.id === id ? { ...bk, flipping: false, line: null } : bk))), 4200);
    if (comeback && Math.random() < 0.55) window.setTimeout(() => {
      const rivals = shopBikersRef.current.filter(bk => bk.brand !== target.brand && !bk.flipping && !bk.crew);
      if (rivals.length) bikerFlip(pick(rivals).id, false);
    }, 1400);
  }
  // Click a biker: his whole crew huddles round him, he tells a joke about the other mob, they all
  // crack up, all flip the other shop off together, then wander off about their day. Jokes come
  // round in order (one list per crew), so you hear the lot before any repeats.
  const crewBusy = useRef({ harley: false, indian: false });
  const [sledge, setSledge] = useState<Sledge | null>(null);
  // The other crew's turn: one of them steps up and the camera swings across.
  function fireBack() {
    if (!sledge) return;
    const crew = shopBikersRef.current.filter(bk => bk.brand === sledge.next);
    setSledge(s => s && { ...s, open: false });
    if (crew.length) void crewJoke(pick(crew).id);
  }
  // Enough of that: the score resets for next time.
  function moveAlong() { setSledge(null); }
  // ---- Bike shop brawl: both crews charge at each other outside Centrelink, vanish into a cartoon
  // dust cloud of fists and boots, and one mob comes out on top. They take turns winning. The losers
  // limp home to find their shop trashed: windows smashed, boarded up, bikes gone, for five minutes.
  // No brawl till they're back in business.
  const [closedShops, setClosedShops] = useState({ harley: 0, indian: 0 });
  const closedRef = useRef(closedShops);
  useEffect(() => { closedRef.current = closedShops; }, [closedShops]);
  const [shopBrawl, setShopBrawl] = useState<{ x: number; bottom: number } | null>(null);
  const [rumble, setRumble] = useState<Rumble | null>(null);
  const brawlWinner = useRef<"harley" | "indian">(Math.random() < 0.5 ? "harley" : "indian"), brawlOn = useRef(false);
  async function shopBrawlStart() {
    const now = Date.now(), L = panX();
    const shut = (["harley", "indian"] as const).find(b => closedRef.current[b] > now);
    if (shut) {
      const left = Math.ceil((closedRef.current[shut] - now) / 1000);
      add({ kind: "burst", x: L + window.innerWidth / 2 - 150, y: stripMap().b(250), size: 0, text: `${CREW_NAME[shut]}'s still boarded up! Back in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` });
      return;
    }
    const all = shopBikersRef.current;
    if (brawlOn.current || crewBusy.current.harley || crewBusy.current.indian || !all.some(b => b.brand === "harley") || !all.some(b => b.brand === "indian")) return;
    brawlOn.current = true;
    crewBusy.current = { harley: true, indian: true };
    setSledge(null);
    const sm = stripMap(), mid = sm.x(500), foot = sm.b(392);
    panTo(mid);
    // Charge!
    const count = { harley: 0, indian: 0 };
    const plan = new Map(all.map(bk => {
      const i = count[bk.brand]++, x = bk.brand === "harley" ? mid + 10 + i * 34 : mid - 66 - i * 34;
      return [bk.id, { x, ms: Math.max(600, Math.abs(x - bk.x) * 5), first: i === 0 }];
    }));
    const runMs = Math.max(...Array.from(plan.values(), v => v.ms)), started = Date.now();
    setShopBikers(list => list.map(bk => {
      const go = plan.get(bk.id);
      return go ? { ...bk, crew: true, flipping: false, laughing: false, cheering: false, x: go.x, bottom: foot, ms: go.ms, walking: true, until: started + go.ms, faceLeft: bk.brand === "harley", line: go.first ? pick(BRAWL_CRIES[bk.brand]) : null, lift: 0 } : bk;
    }));
    // And the rest of each club turns up on their bikes: Indian roaring in from the left, Harley
    // from the right, pulling up on the road either side of the fight.
    const viewL = mid - window.innerWidth / 2, viewW = window.innerWidth, bw = rideW(), bikes: RumbleBike[] = [], park = new Map<number, number>();
    for (let i = 0; i < 6; i++) {
      const row = i % 2 ? 26 : 70, back = (i >> 1) * 95 + (i % 2) * 40, indian = ++uid, harley = ++uid;
      bikes.push({ id: indian, brand: "indian", look: i, x: viewL - bw - 60 - i * 110, bottom: row, ms: 0, faceLeft: false, ridden: true, moving: true });
      bikes.push({ id: harley, brand: "harley", look: i, x: viewL + viewW + 60 + i * 110, bottom: row, ms: 0, faceLeft: true, ridden: true, moving: true });
      park.set(indian, mid - 330 - bw - back).set(harley, mid + 330 + back);
    }
    setRumble({ mid, bikes, stage: "ride", knocked: null, winner: null });
    await later(60);
    setRumble(r => r && { ...r, bikes: r.bikes.map(b => ({ ...b, x: park.get(b.id) ?? b.x, ms: 2200 + Math.random() * 700 })) });
    add({ kind: "burst", x: mid - 110, y: GROUND + 220, size: 0, text: "BRAAAP BRAAAP BRAAAP!" });
    await later(Math.max(runMs, 3000) + 150);
    // Off the bikes and into it, right there in the middle of the road. The shop crews pile into a
    // dust cloud on the footpath.
    setRumble(r => r && { ...r, stage: "fight", bikes: r.bikes.map(b => ({ ...b, ridden: false, moving: false })) });
    setShopBikers(list => list.map(bk => (plan.has(bk.id) ? { ...bk, brawling: true, walking: false, line: null } : bk)));
    setShopBrawl({ x: mid - 20, bottom: foot - 10 });
    for (let i = 0; i < 28; i++) {
      const dx = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 400);
      add({ kind: "junk", x: mid + (Math.random() - 0.5) * 80, y: GROUND + 100 + Math.random() * 60, size: 0, dx, dy: 120, arc: -(100 + Math.random() * 160), text: pick(JUNK) });
      if (i % 2 === 0) add({ kind: "burst", x: mid - 160 + Math.random() * 260, y: GROUND + 150 + Math.random() * 110, size: 0, text: pick(SHOP_BRAWL_HITS) });
      if (i % 3 === 0) {
        const n = Math.floor(Math.random() * SHOP_PAIRS.length);
        setRumble(r => r && { ...r, knocked: `${Math.random() < 0.5 ? "i" : "h"}${n}` });
        add({ kind: "stars", x: mid + SHOP_PAIRS[n].at - 10, y: GROUND + SHOP_PAIRS[n].row + 70, size: 0, text: "★ ✦ ★" });
      }
      await later(260);
    }
    setShopBrawl(null);
    // They take turns: whoever won last time cops it this time.
    const winner = brawlWinner.current, loser = winner === "harley" ? "indian" : "harley";
    brawlWinner.current = loser;
    const firstOf = (brand: string) => all.find(bk => bk.brand === brand)?.id;
    setShopBikers(list => list.map(bk => {
      if (!plan.has(bk.id)) return bk;
      const won = bk.brand === winner;
      return { ...bk, brawling: false, cheering: won, faceLeft: bk.brand === "indian", line: bk.id === firstOf(bk.brand) ? pick(won ? BRAWL_WINS[winner] : BRAWL_LOSSES) : null };
    }));
    add({ kind: "burst", x: mid - 90, y: foot + 190, size: 0, text: `${CREW_NAME[winner].toUpperCase()} WIN!` });
    setRumble(r => r && { ...r, stage: "result", knocked: null, winner });
    await later(2800);
    // Everyone back on the bikes: the losers bolt for home, the winners hot on their tails.
    const fleeLeft = loser === "indian", gone = fleeLeft ? mid - viewW - 500 : mid + viewW + 500;
    setRumble(r => r && { ...r, stage: "leave", bikes: r.bikes.map((b, i) => ({ ...b, ridden: true, moving: true, faceLeft: fleeLeft, x: gone + (fleeLeft ? -1 : 1) * (i % 6) * 60, ms: b.brand === loser ? 1700 : 2500 })) });
    window.setTimeout(() => setRumble(null), 2700);
    // Losers limp home...
    const home = loser === "harley" ? sm.x(1225) : sm.x(-265), limpStart = Date.now();
    const losers = all.filter(bk => bk.brand === loser), limpMs = Math.max(...losers.map(bk => Math.max(1500, Math.abs(home - (plan.get(bk.id)?.x ?? bk.x)) * 7)));
    setShopBikers(list => list.map(bk => {
      if (!plan.has(bk.id)) return bk;
      if (bk.brand === winner) return { ...bk, line: null };
      const ms = Math.max(1500, Math.abs(home - bk.x) * 7);
      return { ...bk, x: home + (Math.random() - 0.5) * 40, ms, walking: true, until: limpStart + ms, faceLeft: home < bk.x, line: null };
    }));
    window.setTimeout(() => setShopBikers(list => list.map(bk => (plan.has(bk.id) && bk.brand === winner ? { ...bk, crew: false, cheering: false } : bk))), 2500);
    crewBusy.current[winner] = false;
    // ...to find the winners have trashed the joint.
    await later(1500);
    panTo(home);
    await later(1200);
    ["SMASH!", "CRASH!", "TINKLE TINKLE..."].forEach((text, i) => window.setTimeout(() => add({ kind: "burst", x: home - 120 + i * 60, y: sm.b(260) - i * 30, size: 0, text }), i * 350));
    setClosedShops(c => ({ ...c, [loser]: Date.now() + 5 * 60_000 }));
    await later(Math.max(0, limpMs - 2700));
    setShopBikers(list => list.filter(bk => bk.brand !== loser));
    add({ kind: "burst", x: home - 110, y: sm.b(150), size: 0, text: "CLOSED FOR REPAIRS" });
    crewBusy.current[loser] = false;
    brawlOn.current = false;
  }
  // Five minutes later: the boards come down and the crew's back.
  function reopenShop(brand: "harley" | "indian") {
    setClosedShops(c => ({ ...c, [brand]: 0 }));
    if (!immersive && phaseRef.current === "hidden") return;
    const sm = stripMap(), door = brand === "harley" ? sm.x(1225) : sm.x(-42);
    const fresh: ShopBiker[] = [0, 1, 2].map(i => ({ id: ++uid, brand, look: (brand === "harley" ? 0 : 3) + i, x: door + i * 18, bottom: sm.b(390 + i * 8), ms: 0, faceLeft: brand === "indian", walking: false, until: 0, flipping: false, line: i === 0 ? pick(["BACK IN BUSINESS, BABY!", "Good as new!", "Right. Who's next?"]) : null }));
    setShopBikers(list => [...list.filter(bk => bk.brand !== brand), ...fresh]);
    window.setTimeout(() => setShopBikers(list => list.map(bk => (fresh.some(f => f.id === bk.id) ? { ...bk, line: null } : bk))), 4000);
    add({ kind: "burst", x: door - 100, y: sm.b(150), size: 0, text: "BACK IN BUSINESS!" });
  }
  useEffect(() => {
    const now = Date.now();
    const timers = (["harley", "indian"] as const).filter(b => closedShops[b] > 0).map(b => window.setTimeout(() => reopenShop(b), Math.max(0, closedShops[b] - now)));
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closedShops]);
  // ---- Club riders cruising down the street now and then: their own crew cheers them on, the
  // other crew flips them off as they go past.
  const [rides, setRides] = useState<Ride[]>([]);
  const rideW = () => (isPhone() ? 130 : 175);
  function reactToRide(crew: "harley" | "indian", rider: "harley" | "indian") {
    const mates = shopBikersRef.current.filter(bk => bk.brand === crew && !bk.crew && !bk.flipping && !bk.walking);
    if (!mates.length) return;
    const ids = new Set(mates.map(bk => bk.id)), same = crew === rider, lines = same ? RIDE_CHEERS : crew === "harley" ? HARLEY_JABS : INDIAN_JABS;
    setShopBikers(list => list.map(bk => (ids.has(bk.id) ? { ...bk, cheering: same, flipping: !same, line: bk.id === mates[0].id ? pick(lines) : null, lift: 0 } : bk)));
    window.setTimeout(() => setShopBikers(list => list.map(bk => (ids.has(bk.id) ? { ...bk, cheering: false, flipping: false, line: null } : bk))), 2800);
  }
  function rideBy(brand?: "harley" | "indian") {
    if (!immersive && phaseRef.current === "hidden") return;
    const b = brand ?? (Math.random() < 0.5 ? "harley" : "indian"), dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, W = VW(), w = rideW();
    const start = dir === 1 ? -w - 40 : W + 40, end = dir === 1 ? W + 40 : -w - 40, ms = Math.round(Math.abs(end - start) * 2.4), id = ++uid;
    const lane = dir === 1 ? GROUND + 4 : FAR_LANE - 4;
    setRides(list => [...list, { id, brand: b, look: Math.floor(Math.random() * 3), x: start, ms: 0, dir, lane }]);
    window.setTimeout(() => setRides(list => list.map(r => (r.id === id ? { ...r, x: end, ms } : r))), 60);
    window.setTimeout(() => setRides(list => list.filter(r => r.id !== id)), ms + 300);
    // Each crew reacts as it goes past their shop.
    (["harley", "indian"] as const).forEach(crew => {
      const mates = shopBikersRef.current.filter(bk => bk.brand === crew);
      if (!mates.length) return;
      const at = mates.reduce((sum, bk) => sum + bk.x, 0) / mates.length, t = (at - start) / (end - start);
      if (t > 0 && t < 1) window.setTimeout(() => reactToRide(crew, b), Math.max(0, 60 + t * ms - 500));
    });
    // The pipes, as it goes past whatever you're looking at.
    const view = panX() + window.innerWidth / 2, tv = (view - start) / (end - start);
    if (tv > 0 && tv < 1) window.setTimeout(() => add({ kind: "burst", x: view - 70, y: lane + 120, size: 0, text: pick(RIDE_NOISE[b]) }), 60 + tv * ms);
  }
  useEffect(() => {
    if (!immersive && phase === "hidden") { setRides([]); return; }
    let timer = 0;
    const next = () => { timer = window.setTimeout(() => { rideBy(); next(); }, 18000 + Math.random() * 22000); };
    next();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);
  useEffect(() => {
    if (!sledge?.open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSledge(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sledge?.open]);
  // Each crew's jokes come off a shuffled deck: no repeats till the deck's done, then a fresh
  // shuffle (never starting on the one just told). Where each deck is up to is saved per browser, so
  // a reload doesn't start the same jokes over.
  const jokeDecks = useRef<{ harley: number[] | null; indian: number[] | null }>({ harley: null, indian: null });
  const lastJoke = useRef({ harley: -1, indian: -1 });
  function nextJoke(brand: "harley" | "indian") {
    const jokes = brand === "harley" ? HARLEY_ON_INDIAN : INDIAN_ON_HARLEY, key = `day-out-jokes-${brand}`;
    if (jokeDecks.current[brand] === null) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
        jokeDecks.current[brand] = Array.isArray(saved) ? saved.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < jokes.length) : [];
      } catch { jokeDecks.current[brand] = []; }
    }
    let deck = jokeDecks.current[brand]!;
    if (!deck.length) {
      deck = jokes.map((_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
      if (deck[0] === lastJoke.current[brand]) deck.push(deck.shift()!);
    }
    const index = deck.shift()!;
    jokeDecks.current[brand] = deck;
    lastJoke.current[brand] = index;
    try { localStorage.setItem(key, JSON.stringify(deck)); } catch { /* private window: fine, just not remembered */ }
    return jokes[index];
  }
  async function crewJoke(tellerId: number) {
    const teller = shopBikersRef.current.find(bk => bk.id === tellerId);
    if (!teller || crewBusy.current[teller.brand]) return;
    const brand = teller.brand, crew = shopBikersRef.current.filter(bk => bk.brand === brand), ids = new Set(crew.map(bk => bk.id));
    crewBusy.current[brand] = true;
    const joke = nextJoke(brand);
    const crewSet = (change: (bk: ShopBiker, i: number) => ShopBiker) => setShopBikers(list => list.map(bk => (ids.has(bk.id) ? change(bk, crew.findIndex(c => c.id === bk.id)) : bk)));
    // Huddle: the teller stays put (kept inside his patch), his mates close in either side, facing him.
    const [a, b] = bikerZone(brand), mid = Math.min(b - 50, Math.max(a + 50, teller.x));
    // Swing the camera over to whoever's telling it.
    panTo(mid + 28);
    const mates = crew.filter(bk => bk.id !== tellerId), spot = new Map<number, number>([[tellerId, mid]]);
    mates.forEach((bk, i) => spot.set(bk.id, mid + (i % 2 ? 48 : -48) * (1 + Math.floor(i / 2))));
    const now = Date.now(), msFor = (bk: ShopBiker) => Math.max(350, Math.abs(spot.get(bk.id)! - bk.x) * 12);
    const gather = Math.max(...crew.map(msFor));
    crewSet(bk => {
      const x = spot.get(bk.id)!, ms = msFor(bk);
      return { ...bk, crew: true, flipping: false, laughing: false, line: null, x, ms, walking: Math.abs(x - bk.x) > 4, until: now + ms, faceLeft: bk.id === tellerId ? bk.faceLeft : x > mid };
    });
    await later(gather + 150);
    crewSet(bk => ({ ...bk, walking: false, ms: 0 }));
    // The setup... (bubbles stay up long enough to read: a beat plus time per character)
    const readMs = (text: string) => Math.max(5000, 1800 + text.length * 75);
    setShopBikers(list => list.map(bk => (bk.id === tellerId ? { ...bk, line: joke.setup, lift: 0 } : bk)));
    await later(readMs(joke.setup));
    // ...and the punchline.
    setShopBikers(list => list.map(bk => (bk.id === tellerId ? { ...bk, line: joke.punch } : bk)));
    await later(readMs(joke.punch) + 800);
    // Everyone loses it.
    const laughs = [...CREW_LAUGHS].sort(() => Math.random() - 0.5);
    crewSet((bk, i) => ({ ...bk, laughing: true, line: laughs[i % laughs.length], lift: i * 26 }));
    await later(4000);
    // All together now: the bird, straight down the street at the other shop.
    const sendoffs = brand === "harley" ? HARLEY_SENDOFFS : INDIAN_SENDOFFS;
    crewSet((bk, i) => ({ ...bk, laughing: false, flipping: true, faceLeft: brand === "harley", line: i === 0 ? pick(sendoffs) : null, lift: 0 }));
    await later(4000);
    crewSet(bk => ({ ...bk, flipping: false, line: null, crew: false }));
    crewBusy.current[brand] = false;
    // Over to the other mob: do they fire back?
    const victim = brand === "harley" ? "indian" : "harley";
    if (shopBikersRef.current.some(bk => bk.brand === victim)) setSledge(prev => {
      const score = { ...(prev?.score ?? { harley: 0, indian: 0 }) };
      score[brand]++;
      const round = (prev?.round ?? 0) + 1;
      return { next: victim, score, round, open: true, title: sledgeTitle(CREW_NAME[victim], CREW_NAME[brand], round), blurb: sledgeBlurb(CREW_NAME[victim], round) };
    });
    // Sometimes the other mob gives it straight back.
    shopBikersRef.current.filter(bk => bk.brand !== brand && !bk.crew && !bk.flipping).forEach((bk, i) => {
      if (Math.random() < 0.5) window.setTimeout(() => bikerFlip(bk.id, false), 300 + i * 350);
    });
  }
  useEffect(() => {
    if (!immersive && phase === "hidden") { setShopBikers([]); return; }
    setShopBikers(list => {
      if (list.length) return list;
      const sm = stripMap();
      return (["harley", "harley", "harley", "indian", "indian", "indian"] as const).filter(brand => !(closedRef.current[brand] > Date.now())).map((brand, i) => {
        const [a, b] = bikerZone(brand);
        return { id: ++uid, brand, look: i, x: a + Math.random() * (b - a), bottom: sm.b(388 + Math.random() * 22), ms: 0, faceLeft: Math.random() < 0.5, walking: false, until: 0, flipping: false, line: null };
      });
    });
    // Wander: a slow amble to another spot in front of his own shop, then a stand about.
    const amble = window.setInterval(() => {
      const now = Date.now(), sm = stripMap();
      setShopBikers(list => list.map(bk => {
        if (bk.flipping || bk.crew || bk.cheering) return bk;
        if (bk.walking) return now > bk.until ? { ...bk, walking: false } : bk;
        const [a, b] = bikerZone(bk.brand), stray = bk.x < a - 20 || bk.x > b + 20;
        if (!stray && Math.random() > 0.18) return bk;
        const x = a + Math.random() * (b - a), ms = Math.max(900, Math.abs(x - bk.x) * 22);
        return { ...bk, x, bottom: sm.b(388 + Math.random() * 22), ms, faceLeft: x < bk.x, walking: true, until: now + ms };
      }));
    }, 700);
    // Every so often somebody can't help himself.
    let flipTimer = 0;
    const nextFlip = () => {
      flipTimer = window.setTimeout(() => {
        const ready = shopBikersRef.current.filter(bk => !bk.flipping && !bk.crew);
        if (ready.length) bikerFlip(pick(ready).id);
        nextFlip();
      }, 9000 + Math.random() * 9000);
    };
    nextFlip();
    return () => { clearInterval(amble); clearTimeout(flipTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);

  // ---- Bus stop: nice normal people wander up to the bus shelter one at a time. Once four or five
  // are waiting, the Aquaduck rolls up (QUACK QUACK!), they wave it down, hop on one by one, and off
  // it goes down the street with a full canopy. Then the stop slowly fills up again.
  const [commuters, setCommuters] = useState<CommuterState[]>([]);
  const [duck, setDuck] = useState<DuckBus | null>(null);
  const commutersRef = useRef<CommuterState[]>([]);
  useEffect(() => { commutersRef.current = commuters; }, [commuters]);
  const duckW = () => (isPhone() ? 240 : 330);
  // Waiting spots along the shelter (Shopfronts x 452..582), staggered a little front to back.
  const stopSpot = (i: number) => { const sm = stripMap(); return { x: sm.x(452 + i * 26) - 22, bottom: sm.b(388 + (i % 2) * 12) }; };
  const updCommuter = (id: number, change: (c: CommuterState) => CommuterState) => setCommuters(list => list.map(c => (c.id === id ? change(c) : c)));
  const commuterLine = (id: number, line: string, ms = 4500) => {
    updCommuter(id, c => ({ ...c, line }));
    window.setTimeout(() => updCommuter(id, c => (c.line === line ? { ...c, line: null } : c)), ms);
  };
  const quackAt = (x: number) => add({ kind: "burst", x, y: FAR_LANE + duckW() * 0.5, size: 0, text: pick(["QUACK QUACK!", "QUAAACK!", "QUACK QUACK QUACK!"]) });
  useEffect(() => {
    if (!immersive && phase === "hidden") { setCommuters([]); setDuck(null); setSwoopers([]); diving.current.clear(); setSledge(null); setShopBrawl(null); setRumble(null); setDogWalk(null); setDogPoops([]); setBinDiver(null); setRescue(null); setShark(null); setSeaBits([]); setBazza(null); setBats([]); setChips(null); chipsOn.current = false; setHelis([]); setGawkers([]); heliOn.current = false; setRides([]); brawlOn.current = false; crewBusy.current = { harley: false, indian: false }; return; }
    let alive = true, target = 4 + (Math.random() < 0.5 ? 1 : 0), look = Math.floor(Math.random() * 6);
    const busComes = async () => {
      const bw = duckW(), sm = stripMap(), stopAt = sm.x(505) - bw * 0.6, startX = -bw - 40, driveMs = Math.max(2500, (stopAt - startX) * 3);
      setDuck({ x: startX, ms: 0, riders: 2 + Math.floor(Math.random() * 3), quack: false, moving: true, leaving: false });
      await later(80);
      setDuck(d => d && { ...d, x: stopAt, ms: driveMs });
      // Everyone spots it coming and waves it down.
      await later(Math.max(0, driveMs - 1800));
      if (!alive) return;
      setCommuters(list => list.map(c => ({ ...c, waving: true, faceLeft: true })));
      const spotter = commutersRef.current[0];
      if (spotter) commuterLine(spotter.id, pick(["Here's our duck!", "Ooh, here it comes!", "DUCK! Over here!"]), 3000);
      await later(1800);
      if (!alive) return;
      setDuck(d => d && { ...d, moving: false, quack: true });
      quackAt(stopAt + bw * 0.75);
      await later(1300);
      setDuck(d => d && { ...d, quack: false });
      // On they get, nearest the door first.
      const door = stopAt + bw * 0.6 - 20;
      const queue = [...commutersRef.current].sort((a, b) => Math.abs(a.x - door) - Math.abs(b.x - door));
      for (const c of queue) {
        if (!alive) return;
        const ms = Math.max(500, Math.abs(door - c.x) * 14);
        updCommuter(c.id, x => ({ ...x, waving: false, walking: true, x: door, bottom: FAR_LANE + 30, ms, faceLeft: door < x.x }));
        await later(ms);
        setCommuters(list => list.filter(x => x.id !== c.id));
        setDuck(d => d && { ...d, riders: d.riders + 1 });
        await later(450);
      }
      await later(1000);
      if (!alive) return;
      // And away: QUACK QUACK!
      const endX = VW() + 60, offMs = Math.max(2500, (endX - stopAt) * 3);
      setDuck(d => d && { ...d, quack: true, moving: true, leaving: true, x: endX, ms: offMs });
      quackAt(stopAt + bw * 0.75);
      await later(900);
      setDuck(d => d && { ...d, quack: false });
      await later(offMs);
      setDuck(null);
    };
    const run = async () => {
      await later(5000 + Math.random() * 5000);
      while (alive) {
        const waiting = commutersRef.current.length;
        if (waiting < target) {
          // Someone new strolls up from one way or the other.
          const spot = stopSpot(waiting), fromLeft = Math.random() < 0.5, from = spot.x + (fromLeft ? -1 : 1) * (500 + Math.random() * 400);
          const id = ++uid, ms = Math.abs(spot.x - from) * 14;
          setCommuters(list => [...list, { id, look: look++ % 6, x: from, bottom: spot.bottom, ms: 0, faceLeft: !fromLeft, walking: true, waving: false, line: null }]);
          await later(80);
          updCommuter(id, c => ({ ...c, x: spot.x, ms }));
          await later(ms);
          if (!alive) return;
          updCommuter(id, c => ({ ...c, walking: false, faceLeft: Math.random() < 0.5 }));
          if (Math.random() < 0.4) commuterLine(id, pick(BUS_STOP_LINES));
          await later(4000 + Math.random() * 6000);
          continue;
        }
        await busComes();
        target = 4 + (Math.random() < 0.5 ? 1 : 0);
        await later(12000 + Math.random() * 12000);
      }
    };
    void run();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);

  // ---- Magpie flock: four to six maggies wheel about over the street, dive-bomb anybody walking
  // underneath (Shazz, the bikers, the bus queue, the dole mob, Nev, everyone), and crap on the lot.
  // Swooped people freak out, flailing their arms round their heads. On its own it's one or two lone
  // maggies at a time; the menu brings the whole flock, a mass swoop and a poop raid.
  const [swoopers, setSwoopers] = useState<Swooper[]>([]);
  const swoopersRef = useRef<Swooper[]>([]);
  useEffect(() => { swoopersRef.current = swoopers; }, [swoopers]);
  const diving = useRef(new Set<number>()), lastSwoopLine = useRef(0);
  // Where the flock flies: above head height, up to the rooftops (way up into the sky full screen).
  const flockSky = () => { const sm = stripMap(), H = window.innerHeight; return { lo: sm.b(300), hi: Math.max(sm.b(300) + 60, Math.min(H - 70, sm.b(0) + 40)) }; };
  // Everyone who can be swooped, preferring whoever's on screen.
  const swoopables = () => {
    const all = Array.from(document.querySelectorAll<HTMLElement>('[data-poopable="person"], [data-poopable="shazz"]'))
      .map(el => ({ el, r: sRect(el) })).filter(({ r }) => r.width > 0 && r.right > 0 && r.left < VW());
    const L = panX(), R = L + window.innerWidth, seen = all.filter(({ r }) => r.right > L - 100 && r.left < R + 100);
    return seen.length ? seen : all;
  };
  // A swooped person: a frantic little jig, arms flailing round the head, and a yell.
  function freakOut(el: HTMLElement) {
    // Shazz stays on the bike: only she (head and arms, pivoting at the hips) flinches about, and
    // the flailing arms go round her head rather than the middle of the bike.
    const flincher = el.dataset.poopable === "shazz" ? el.querySelector<SVGGElement>(`.${styles.rider}`) : el;
    const r = sRect(flincher ?? el), H = window.innerHeight, cx = r.left + r.width / 2, top = H - r.top;
    if (el.dataset.poopable === "shazz") flincher?.animate?.([{ translate: "-1.5px 0", rotate: "-5deg" }, { translate: "1.5px -2px", rotate: "4deg" }], { duration: 150, iterations: 14, direction: "alternate" });
    else flincher?.animate?.([{ translate: "-3px 0", rotate: "-6deg" }, { translate: "3px -6px", rotate: "6deg" }], { duration: 150, iterations: 14, direction: "alternate" });
    add({ kind: "flail", x: cx, y: top - Math.min(26, r.height * 0.16), size: Math.max(34, Math.min(66, r.width * 0.9)) });
    if (el.dataset.poopable === "shazz") {
      if (Date.now() - lastSwoopLine.current > 8000) { lastSwoopLine.current = Date.now(); speak(pick(SHAZZ_SWOOPED), false, true); }
    } else add({ kind: "burst", x: cx - 40, y: top + 34, size: 0, text: pick(SWOOPED_YELLS) });
  }
  // One bird dives on one person's head, then pulls up and away.
  async function swoopOn(id: number, target?: { el: HTMLElement; r: DOMRect | { left: number; right: number; top: number; bottom: number; width: number; height: number } }) {
    const bird = swoopersRef.current.find(b => b.id === id), t = target ?? pick(swoopables());
    if (!bird || !t || diving.current.has(id)) return;
    diving.current.add(id);
    const H = window.innerHeight, hx = t.r.left + t.r.width / 2, head = H - t.r.top, faceLeft = hx < bird.x + 27;
    setSwoopers(list => list.map(b => (b.id === id ? { ...b, x: hx - 27, bottom: head - 6, ms: 520, faceLeft, diving: true } : b)));
    await later(520);
    if (!swoopersRef.current.some(b => b.id === id)) { diving.current.delete(id); return; }
    if (t.el.isConnected) freakOut(t.el);
    const { lo, hi } = flockSky();
    setSwoopers(list => list.map(b => (b.id === id ? { ...b, x: hx - 27 + (faceLeft ? -1 : 1) * (150 + Math.random() * 140), bottom: lo + Math.random() * (hi - lo), ms: 800, diving: false } : b)));
    await later(800);
    diving.current.delete(id);
  }
  // A bird (or a few) flies in from just off one side of the view, with its own time to stay.
  function bringMagpies(n: number, stayMs: number) {
    if (!immersive && phaseRef.current === "hidden") return;
    const { lo, hi } = flockSky(), L = panX(), W = window.innerWidth, fromLeft = Math.random() < 0.5, now = Date.now();
    const birds: Swooper[] = Array.from({ length: n }, () => ({ id: ++uid, x: fromLeft ? L - 90 - Math.random() * 220 : L + W + 30 + Math.random() * 220, bottom: lo + Math.random() * (hi - lo), ms: 0, faceLeft: !fromLeft, diving: false, until: now + stayMs * (0.8 + Math.random() * 0.4), leaving: false }));
    const ids = new Set(birds.map(b => b.id));
    setSwoopers(list => [...list, ...birds]);
    window.setTimeout(() => setSwoopers(list => list.map(b => (ids.has(b.id) ? { ...b, x: L + 40 + Math.random() * (W - 120), ms: 1800 + Math.random() * 800 } : b))), 60);
  }
  // From the menu: a whole flock at once.
  function magpieFlock() {
    bringMagpies(4 + Math.floor(Math.random() * 3), 32000);
    const L = panX(), { hi } = flockSky();
    add({ kind: "burst", x: L + window.innerWidth / 2 - 100, y: hi - 20, size: 0, text: "SWOOPING SEASON!" });
  }
  // Keep whoever's out hanging about a bit longer (for the menu's mass swoop and poop raid).
  const keepMagpies = (ms: number) => setSwoopers(list => list.map(b => (b.leaving ? b : { ...b, until: Math.max(b.until, Date.now() + ms) })));
  // Every maggie picks somebody different and goes for them, all at once.
  function swoopEveryone() {
    if (!swoopersRef.current.length) { magpieFlock(); window.setTimeout(swoopEveryone, 2000); return; }
    keepMagpies(15000);
    const people = [...swoopables()].sort(() => Math.random() - 0.5);
    swoopersRef.current.filter(b => !b.leaving).forEach((b, i) => { if (people.length) window.setTimeout(() => void swoopOn(b.id, people[i % people.length]), i * 220); });
  }
  // Bombs away: every bird lets go, three times over.
  function poopRaid() {
    if (!swoopersRef.current.length) { magpieFlock(); window.setTimeout(poopRaid, 2000); return; }
    keepMagpies(15000);
    for (let k = 0; k < 3; k++) window.setTimeout(() => swoopersRef.current.forEach((b, i) => window.setTimeout(() => {
      const cur = swoopersRef.current.find(x => x.id === b.id);
      if (cur) dropPoop(cur.x + 27, cur.bottom, 0);
    }, i * 120)), k * 900);
  }
  // Swooping season: on their own, it's just a lone maggie (two at most) turning up now and then,
  // each one arriving separately, causing a bit of havoc for twenty-odd seconds, then buggering off.
  useEffect(() => {
    if (!immersive && phase === "hidden") { setSwoopers([]); return; }
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        if (swoopersRef.current.filter(b => !b.leaving).length < 2) bringMagpies(1, 24000);
        next();
      }, 25000 + Math.random() * 30000);
    };
    timer = window.setTimeout(() => { bringMagpies(1, 24000); next(); }, 15000 + Math.random() * 15000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);
  // While they're about: wheel around, dive on people (one bird at a time, never together), drop the
  // odd bomb; each one clears off when its time's up.
  const flockOut = swoopers.length > 0;
  useEffect(() => {
    if (!flockOut) return;
    const timer = window.setInterval(() => {
      const now = Date.now(), birds = swoopersRef.current, L = panX(), W = window.innerWidth;
      const done = birds.filter(b => !b.leaving && b.until < now && !diving.current.has(b.id));
      if (done.length) {
        const ids = new Set(done.map(b => b.id)), away = Math.random() < 0.5;
        setSwoopers(list => list.map(b => (ids.has(b.id) ? { ...b, leaving: true, x: away ? L - 300 : L + W + 300, ms: 2200, faceLeft: away, diving: false } : b)));
        window.setTimeout(() => setSwoopers(list => list.filter(b => !ids.has(b.id))), 2300);
      }
      const { lo, hi } = flockSky();
      let swooping = diving.current.size > 0;
      birds.forEach(b => {
        if (b.leaving || b.until < now || diving.current.has(b.id)) return;
        const roll = Math.random();
        if (roll < 0.14 && !swooping) { swooping = true; void swoopOn(b.id); }
        else if (roll < 0.24) dropPoop(b.x + 27, b.bottom, 0);
        else if (roll < 0.6) {
          const x = Math.max(L - 60, Math.min(L + W - 20, b.x + (Math.random() - 0.5) * 520));
          setSwoopers(list => list.map(o => (o.id === b.id ? { ...o, x, bottom: lo + Math.random() * (hi - lo), ms: 1300 + Math.random() * 900, faceLeft: x < o.x } : o)));
        }
      });
    }, 900);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flockOut]);

  // ---- The dancers on their smoko in Snag Alley ----
  const [dancerLines, setDancerLines] = useState<[string | null, string | null]>([null, null]);
  const [dancersOut, setDancersOut] = useState(false);
  useEffect(() => { setDancersOut(immersive || phase !== "hidden"); if (!immersive && phase === "hidden") setDancerLines([null, null]); }, [phase, immersive]);
  const dancerBusy = useRef(false), dancerDeck = useRef<number[]>([]);
  async function dancerChat(first: 0 | 1) {
    if (dancerBusy.current) return;
    dancerBusy.current = true;
    if (!dancerDeck.current.length) dancerDeck.current = DANCER_CHAT.map((_, i) => i).sort(() => Math.random() - 0.5);
    const [setup, punch] = DANCER_CHAT[dancerDeck.current.shift()!], read = (text: string) => Math.max(4200, 1600 + text.length * 72);
    setDancerLines(first === 0 ? [setup, null] : [null, setup]);
    await later(read(setup));
    setDancerLines(first === 0 ? [null, punch] : [punch, null]);
    await later(read(punch));
    setDancerLines([null, null]);
    dancerBusy.current = false;
  }

  // ---- Fruit bats on the power lines ----
  const [bats, setBats] = useState<Bat[]>([]);
  useEffect(() => {
    if (!immersive && phase === "hidden") { setBats([]); return; }
    setBats(list => (list.length ? list : BAT_SPOTS.map(([wire, t, open]) => ({ id: ++uid, wire, t, open, zapped: false, shot: false }))));
  }, [phase, immersive]);
  // Where a bat sits on screen: hanging by its feet from its spot on the wire.
  const batBox = (b: Bat) => {
    const sm = stripMap(), at = onWire(WIRES[b.wire], b.t), w = 52 * sm.k, h = 44 * sm.k;
    return { left: sm.x(at.x) - w / 2, bottom: sm.b(at.y) + 2 * sm.k - h, w, h };
  };
  // Hover over one: it brushes the other wire. ZZZT.
  function zapBat(id: number) {
    const bat = bats.find(b => b.id === id);
    if (!bat || bat.zapped || bat.shot) return;
    setBats(list => list.map(b => (b.id === id ? { ...b, zapped: true } : b)));
    const box = batBox(bat);
    add({ kind: "burst", x: box.left - 10, y: box.bottom + box.h + 6, size: 0, text: pick(BAT_ZAPS) });
    window.setTimeout(() => setBats(list => list.map(b => (b.id === id ? { ...b, zapped: false } : b))), 1300);
  }

  // ---- Down the beach end ----
  const beachSize = { dog: () => (isPhone() ? 84 : 116), guard: () => (isPhone() ? 34 : 46), swimmer: () => (isPhone() ? 26 : 34), surfer: () => (isPhone() ? 52 : 70), shark: () => (isPhone() ? 90 : 120) };
  // A bloke walks his blue heeler round the park, all day: wanders about, the dog cocks its leg on
  // everything, does the odd poo (which may or may not get picked up). Click them for a woof.
  const [dogWalk, setDogWalk] = useState<DogWalkState | null>(null);
  const dogRef = useRef<DogWalkState | null>(null);
  useEffect(() => { dogRef.current = dogWalk; }, [dogWalk]);
  const [dogPoops, setDogPoops] = useState<{ id: number; x: number; bottom: number }[]>([]);
  useEffect(() => {
    if (!immersive && phase === "hidden") { setDogWalk(null); setDogPoops([]); return; }
    let alive = true;
    const run = async () => {
      setDogWalk({ x: stripMap().x(2430), bottom: stripMap().b(377), ms: 0, faceLeft: false, pose: "walk", line: null });
      await later(500);
      while (alive) {
        const sm = stripMap(), w = beachSize.dog(), cur = dogRef.current;
        if (!cur) { await later(500); continue; }
        const x = sm.x(2440 + Math.random() * 540) - w / 2, ms = Math.max(1200, Math.abs(x - cur.x) * 16);
        setDogWalk(d => d && { ...d, x, bottom: sm.b(373 + Math.random() * 5), ms, faceLeft: x < d.x, pose: "walk", line: null });
        await later(ms);
        if (!alive) return;
        const roll = Math.random();
        if (roll < 0.3) {
          setDogWalk(d => d && { ...d, ms: 0, pose: "pee", line: Math.random() < 0.5 ? pick(DOG_PEE_LINES) : null });
          await later(2800);
        } else if (roll < 0.55) {
          setDogWalk(d => d && { ...d, ms: 0, pose: "poop", line: null });
          await later(2400);
          if (!alive) return;
          const d0 = dogRef.current;
          if (d0) {
            const id = ++uid, rear = d0.faceLeft ? d0.x + w * (50 / 130) : d0.x + w * (80 / 130);
            setDogPoops(list => [...list.slice(-5), { id, x: rear - 6, bottom: d0.bottom }]);
            window.setTimeout(() => setDogPoops(list => list.filter(item => item.id !== id)), 120_000);
          }
          setDogWalk(d => d && { ...d, pose: "stand", line: pick(DOG_POOP_LINES) });
          await later(2800);
        } else {
          setDogWalk(d => d && { ...d, ms: 0, pose: "stand" });
          await later(1200 + Math.random() * 2200);
        }
      }
    };
    void run();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);
  // Tweakers doing the rounds of the bins (the two in the park and the bin chicken's one) for a
  // feed: rummage, rubbish everywhere, a little dance when they find something.
  const [binDiver, setBinDiver] = useState<BinDiver | null>(null);
  const binDiveOn = useRef(false);
  async function binDive(pan = false) {
    if (binDiveOn.current || (!immersive && phaseRef.current === "hidden")) return;
    binDiveOn.current = true;
    const sm = stripMap(), bins = [{ x: sm.x(2860), b: sm.b(378) }, { x: binX() + BIN_W / 2, b: BIN_BOTTOM - 4 }], bin = pick(bins);
    if (pan) panTo(bin.x);
    const who = Math.random() < 0.55 ? "trev" : "kylie", fromLeft = Math.random() < 0.5;
    const from = bin.x + (fromLeft ? -1 : 1) * (420 + Math.random() * 220), stand = fromLeft ? bin.x - 64 : bin.x + 2, walkMs = Math.max(1200, Math.abs(stand - from) * 7);
    setBinDiver({ who, x: from, bottom: bin.b, ms: 0, faceLeft: !fromLeft, pose: "run", line: null });
    await later(60);
    setBinDiver(d => d && { ...d, x: stand, ms: walkMs });
    await later(walkMs + 100);
    setBinDiver(d => d && { ...d, pose: "cook", ms: 0, line: pick(["Right, what've we got...", "Come to daddy...", "Dinner time."]) });
    for (let i = 0; i < 7; i++) {
      add({ kind: "junk", x: bin.x, y: bin.b + 50, size: 0, dx: (Math.random() - 0.5) * 240, dy: 50, arc: -(60 + Math.random() * 70), text: pick(BIN_JUNK) });
      if (i === 2) setBinDiver(d => d && { ...d, line: null });
      await later(480);
    }
    setBinDiver(d => d && { ...d, pose: "dance", line: pick(BIN_FINDS) });
    await later(2800);
    setBinDiver(d => d && { ...d, pose: "run", line: null, x: from, ms: walkMs, faceLeft: fromLeft });
    await later(walkMs + 100);
    setBinDiver(null);
    binDiveOn.current = false;
  }
  // Somebody gets caught in the rip; the lifeguard sprints down from the hut, swims out, carries
  // her back up the sand, and they both have a moment.
  const [rescue, setRescue] = useState<{ guard: GuardState | null; swimmer: SwimmerState | null } | null>(null);
  const rescueOn = useRef(false);
  const updGuard = (change: (g: GuardState) => GuardState) => setRescue(r => (r && r.guard ? { ...r, guard: change(r.guard) } : r));
  async function lifeguardRescue(pan = false) {
    if (rescueOn.current || (!immersive && phaseRef.current === "hidden")) return;
    rescueOn.current = true;
    const sm = stripMap(), gw = beachSize.guard(), gh = gw * 2, sw = beachSize.swimmer(), sh = sw * 2.5;
    const spot = sm.x(3210 + Math.random() * 170), sea = sm.b(312), sand = sm.b(374), shore = sm.b(334), hut = sm.x(3485);
    if (pan) panTo(spot);
    setRescue({ guard: null, swimmer: { x: spot - sw / 2, bottom: sea - sh * 0.2, ms: 0, faceLeft: false, pose: "drown", line: "HELP! HELP!" } });
    await later(1800);
    add({ kind: "burst", x: hut - 50, y: sand + gh + 20, size: 0, text: "TWEEEEET!" });
    setRescue(r => r && { ...r, guard: { x: hut - gw / 2, bottom: sand, ms: 0, faceLeft: spot < hut, pose: "run", line: pick(["HANG ON, LOVE!", "I'M COMIN'!", "OUTTA THE WAY!"]) } });
    await later(80);
    const runMs = Math.max(900, Math.abs(spot - hut) * 5);
    updGuard(g => ({ ...g, x: spot - gw / 2 + (spot < hut ? 26 : -26), bottom: shore, ms: runMs }));
    await later(runMs);
    updGuard(g => ({ ...g, pose: "swim", line: null, x: spot - gw / 2, bottom: sea - gh * 0.18, ms: 1400 }));
    await later(1500);
    // Got her.
    setRescue(r => r && { ...r, swimmer: null });
    updGuard(g => ({ ...g, pose: "carry", x: spot - gw / 2, bottom: sand - 4, ms: 2200, faceLeft: true }));
    await later(2300);
    setRescue(r => r && { guard: r.guard && { ...r.guard, pose: "flex", ms: 0, line: null }, swimmer: { x: spot - gw / 2 - sw - 4, bottom: sand - 4, ms: 0, faceLeft: false, pose: "sit", line: pick(RESCUE_THANKS) } });
    await later(2400);
    updGuard(g => ({ ...g, line: pick(RESCUE_BRAG) }));
    await later(2600);
    // Back to work, and off she goes.
    updGuard(g => ({ ...g, pose: "run", line: null, x: hut - gw / 2, bottom: sand, ms: runMs, faceLeft: hut < g.x }));
    setRescue(r => r && r.swimmer ? { ...r, swimmer: { ...r.swimmer, pose: "walk", line: null, x: r.swimmer.x - 320, ms: 4200, faceLeft: true } } : r);
    await later(4300);
    setRescue(null);
    rescueOn.current = false;
  }
  // A surfer paddling out, a fin closing in, dun-dun... dun-dun... CHOMP. Board's all that's left.
  const [shark, setShark] = useState<SharkState | null>(null);
  const sharkOn = useRef(false);
  async function sharkAttack(pan = false) {
    if (sharkOn.current || (!immersive && phaseRef.current === "hidden")) return;
    sharkOn.current = true;
    const sm = stripMap(), uw = beachSize.surfer(), sea = sm.b(300), sx = sm.x(3270 + Math.random() * 200), surfBottom = sea - uw * (30 / 70) * 0.27;
    if (pan) panTo(sx);
    setShark({ surfer: { x: sx - uw / 2, bottom: surfBottom }, fin: { x: sx + 420, bottom: sea - 6, ms: 0 }, chomp: null, blood: null, board: null });
    await later(80);
    setShark(st => st && { ...st, fin: st.fin && { ...st.fin, x: sx + 10, ms: 3400 } });
    add({ kind: "burst", x: sx + 200, y: sea + 50, size: 0, text: "dun dun..." });
    await later(1700);
    add({ kind: "burst", x: sx + 90, y: sea + 60, size: 0, text: "DUN DUN... DUN DUN..." });
    await later(1800);
    // CHOMP.
    const sw = beachSize.shark();
    setShark(st => st && { ...st, surfer: null, fin: null, chomp: { x: sx - sw / 2, bottom: sea - sw * 0.3 }, blood: { x: sx, bottom: sea - 14 } });
    add({ kind: "burst", x: sx - 50, y: sea + 70, size: 0, text: "CHOMP!!" });
    window.setTimeout(() => { if (Math.random() < 0.6) void vmrRecover(sx); }, 7000);
    window.setTimeout(() => add({ kind: "burst", x: sx - 140, y: sea + 30, size: 0, text: pick(SHARK_SCREAMS) }), 700);
    await later(1100);
    setShark(st => st && { ...st, chomp: null, board: { x: sx - 12, bottom: sea - 10 } });
    await later(9000);
    setShark(null);
    sharkOn.current = false;
  }
  // ---- Out on the water ----
  const [seaBits, setSeaBits] = useState<SeaBit[]>([]);
  const seaBitsRef = useRef<SeaBit[]>([]);
  useEffect(() => { seaBitsRef.current = seaBits; }, [seaBits]);
  const addSea = (bit: Omit<SeaBit, "id">, life: number) => {
    const id = ++uid;
    setSeaBits(list => [...list, { ...bit, id }]);
    window.setTimeout(() => setSeaBits(list => list.filter(item => item.id !== id)), life);
    return id;
  };
  const updSea = (id: number, change: Partial<SeaBit>) => setSeaBits(list => list.map(item => (item.id === id ? { ...item, ...change } : item)));
  // Boats come in off the open sea at the right-hand end and run along to the point at the dunes.
  const seaLane = () => { const sm = stripMap(); return { sm, k: sm.k, start: sm.x(4230), end: sm.x(3020) }; };
  const seaPan = () => panTo(stripMap().x(3310));
  // Somebody in the water gets the dun-dun treatment: fin closes in, CHOMP, red water.
  async function sharkGets(x: number, bottom: number, victim: number) {
    const { k } = seaLane();
    addSea({ kind: "fin", x: x + 6, bottom: bottom - 2, w: 30, h: 24, cls: "finApproach", dx: 260, ms: 2200 }, 2250);
    add({ kind: "burst", x: x + 120, y: bottom + 40, size: 0, text: "dun dun... DUN DUN..." });
    await later(2200);
    setSeaBits(list => list.filter(item => item.id !== victim));
    const sw = 120 * k * 0.8;
    addSea({ kind: "chomp", x: x - sw / 2, bottom: bottom - sw * 0.3, w: sw, h: (sw * 80) / 120, cls: "sharkLeap" }, 1200);
    addSea({ kind: "blood", x, bottom: bottom - 6, w: 150, h: 28, cls: "bloodPool" }, 9000);
    add({ kind: "burst", x: x - 50, y: bottom + 70, size: 0, text: "CHOMP!!" });
    window.setTimeout(() => add({ kind: "burst", x: x - 150, y: bottom + 30, size: 0, text: pick(SHARK_SCREAMS) }), 700);
    window.setTimeout(() => { if (Math.random() < 0.6) void vmrRecover(x); }, 7000);
  }
  // A ski boat goes past; halfway along the skier stacks it. Sometimes something finds them.
  async function skiRun(pan = false) {
    const { sm, k, start, end } = seaLane(), w = 200 * k * 0.55, h = w / 4, water = sm.b(294), ms = 9000, dx = end - start;
    if (pan) seaPan();
    const boat = addSea({ kind: "ski", x: start, bottom: water - h * 0.2, w, h, cls: "seaCross", dx, ms, on: true }, ms + 300);
    await later(ms * 0.5);
    updSea(boat, { on: false });
    const fx = start + dx * 0.5 + w * 0.8, fb = water - 8;
    add({ kind: "burst", x: fx - 40, y: fb + 50, size: 0, text: pick(["SPLASH!", "KERPLUNK!", "FACEPLANT!"]) });
    const skier = addSea({ kind: "skier", x: fx - 14, bottom: fb, w: 40 * k * 0.7, h: 30 * k * 0.7, cls: "floatBob" }, 7000);
    window.setTimeout(() => add({ kind: "burst", x: fx - 60, y: fb + 30, size: 0, text: pick(["ME BOARDIES!", "I'M OKAAAY!", "...where's me teeth?"]) }), 700);
    if (Math.random() < 0.4) { await later(1500); await sharkGets(fx, fb, skier); }
  }
  // A couple of jet skis tear through, one launching off a wave.
  function jetRun(pan = false) {
    const { sm, k, start, end } = seaLane(), w = 80 * k * 0.7, h = w / 2;
    if (pan) seaPan();
    [0, 1].forEach(i => addSea({ kind: "jet", x: start + i * 70, bottom: sm.b(i ? 302 : 286) - h * 0.15, w, h, cls: "jetCross", dx: end - start - i * 70, ms: 5200 + i * 600, delay: i * 500, colour: i ? "#22d3ee" : "#facc15" }, 7000));
    window.setTimeout(() => add({ kind: "burst", x: panX() + window.innerWidth / 2 - 80, y: sm.b(260), size: 0, text: "BRRRAAAAP!" }), 1200);
  }
  // A parasail goes over; halfway along the punter comes unclipped and drops into the drink.
  async function paraRun(pan = false) {
    const { sm, k, start, end } = seaLane(), w = 220 * k * 0.6, h = (w * 200) / 220, water = sm.b(288), ms = 11000, dx = end - start;
    if (pan) seaPan();
    const rig = addSea({ kind: "para", x: start, bottom: water - h * 0.04, w, h, cls: "seaCross", dx, ms, on: true }, ms + 300);
    await later(ms * 0.45);
    updSea(rig, { on: false });
    const rx = start + dx * 0.45 + w * (190 / 220) - 10, ry = water - h * 0.04 + h * (1 - 60 / 200), rw = 30 * k * 0.7;
    addSea({ kind: "rider", x: rx, bottom: ry, w: rw, h: rw * (40 / 30), cls: "riderFall", dy: ry - water, ms: 1300 }, 1350);
    add({ kind: "burst", x: rx - 50, y: ry + 30, size: 0, text: "AAAAAAAH!" });
    await later(1300);
    add({ kind: "burst", x: rx - 40, y: water + 40, size: 0, text: "SPLOOSH!" });
    const splashed = addSea({ kind: "skier", x: rx - 6, bottom: water - 8, w: 40 * k * 0.7, h: 30 * k * 0.7, cls: "floatBob" }, 6000);
    if (Math.random() < 0.3) { await later(1200); await sharkGets(rx, water - 8, splashed); }
  }
  const dolphinRun = (pan = false) => {
    const { sm, k, start, end } = seaLane(), w = 200 * k * 0.55, h = w * 0.3;
    if (pan) seaPan();
    addSea({ kind: "pod", x: start, bottom: sm.b(298) - h * 0.13, w, h, cls: "seaCross", dx: end - start, ms: 10000 }, 10300);
  };
  // A humpback breaches out the back, then later waves its tail.
  async function whaleRun(pan = false) {
    const { sm, k } = seaLane(), x = sm.x(3120 + Math.random() * 380), water = sm.b(272), w = 160 * k * 0.55, h = w * 0.75;
    if (pan) seaPan();
    addSea({ kind: "whale", x: x - w / 2, bottom: water - h * 0.07, w, h, clip: true, inner: "whaleBreach" }, 3100);
    await later(1700);
    add({ kind: "burst", x: x - 80, y: water + 60, size: 0, text: "KER-SPLOOOSH!" });
    await later(2600);
    addSea({ kind: "tail", x: x - w * 0.2, bottom: water - 4, w: 80 * k * 0.5, h: 60 * k * 0.5, clip: true, inner: "tailRise" }, 3900);
    add({ kind: "burst", x: x - 30, y: water + 50, size: 0, text: "*pfffffff*" });
  }
  // Steve from "Steve's Wild Oz" (the host; internally still bazza*) wades in to show us a bluebottle. Goes about as well as you'd think.
  const [bazza, setBazza] = useState<BazzaState | null>(null);
  const bazzaOn = useRef(false);
  async function bazzaShow(pan = false) {
    if (bazzaOn.current || (!immersive && phaseRef.current === "hidden")) return;
    bazzaOn.current = true;
    const sm = stripMap(), w = isPhone() ? 36 : 50, from = sm.x(3040), wade = sm.x(3160 + Math.random() * 120), sand = sm.b(372), shallows = sm.b(334);
    if (pan) panTo(wade);
    setBazza({ x: from - w / 2, bottom: sand, ms: 0, faceLeft: false, pose: "walk", line: "G'day! Welcome to Steve's Wild Oz!" });
    await later(80);
    const walkMs = Math.max(1500, Math.abs(wade - from) * 9);
    setBazza(b => b && { ...b, x: wade - w / 2, bottom: shallows, ms: walkMs });
    await later(walkMs);
    setBazza(b => b && { ...b, ms: 0, pose: "hold", line: "Crikey! Look at this little beauty! A bluebottle!" });
    await later(3200);
    setBazza(b => b && { ...b, line: "Totally harmless, long as ya don't—" });
    await later(1600);
    setBazza(b => b && { ...b, pose: "zapped", line: null });
    add({ kind: "burst", x: wade - 40, y: shallows + w * 2 + 10, size: 0, text: "ZZZZAP!" });
    window.setTimeout(() => add({ kind: "burst", x: wade - 70, y: shallows + w * 2 - 20, size: 0, text: "STREWTH!!" }), 600);
    await later(1900);
    setBazza(b => b && { ...b, pose: "hop", line: pick(["VINEGAR! Somebody get me VINEGAR!", "RIGHT ON ME KNEE!", "...and that's why ya don't touch 'em, kids!"]) });
    for (let i = 0; i < 4; i++) { setBazza(b => b && { ...b, x: b.x + (i % 2 ? 26 : -26), ms: 380, faceLeft: i % 2 === 0 }); await later(420); }
    setBazza(b => b && { ...b, x: from - w / 2 - 260, bottom: sand, ms: walkMs * 1.4, faceLeft: true });
    await later(walkMs * 1.4);
    setBazza(null);
    bazzaOn.current = false;
  }
  // The VMR (Volunteer Marine Rescue). A runabout's motor carks it out the back; the skipper waves
  // his arms; the VMR cat comes in, throws him a line and tows him in round the point.
  const vmrOn = useRef(false);
  const vmrSize = () => { const { k } = seaLane(), w = 220 * k * 0.6; return { w, h: (w * 80) / 220 }; };
  async function vmrTow(pan = false) {
    if (vmrOn.current) return;
    vmrOn.current = true;
    const { sm, k, start, end } = seaLane(), water = sm.b(292), bw = 100 * k * 0.6, bh = bw * 0.44, v = vmrSize();
    const spot = sm.x(3080 + Math.random() * 220);
    if (pan) seaPan();
    const broke = addSea({ kind: "broke", x: start, bottom: water - bh * 0.14, w: bw, h: bh, cls: "floatBob", tms: 0 }, 60_000);
    await later(80);
    updSea(broke, { x: spot, tms: 4200, ease: "ease-out" });
    await later(4300);
    add({ kind: "burst", x: spot - 60, y: water + bh + 30, size: 0, text: pick(["MAYDAY! Me motor's carked it!", "OI! VMR! Little help?!", "She won't start, mate!"]) });
    await later(1600);
    const stop = spot - v.w - 6;
    const boat = addSea({ kind: "vmr", x: start + 60, bottom: water - v.h * 0.12, w: v.w, h: v.h, tms: 0 }, 60_000);
    await later(80);
    updSea(boat, { x: stop, tms: 4200, ease: "ease-out" });
    await later(4300);
    add({ kind: "burst", x: stop + v.w * 0.6, y: water + v.h + 10, size: 0, text: pick(["VMR here, mate. Chuck us ya rope!", "Righto, hook her up!", "Third one this week, Kev."]) });
    updSea(boat, { on: true });
    await later(1800);
    // Towed in round the point, the pair of them.
    const gone = end - v.w - 40, dx = gone - stop, towMs = 6500;
    updSea(boat, { x: gone, tms: towMs, ease: "ease-in" });
    updSea(broke, { x: spot + dx, tms: towMs, ease: "ease-in" });
    await later(towMs - 900);
    updSea(boat, { hide: true }); updSea(broke, { hide: true });
    await later(1000);
    setSeaBits(list => list.filter(item => item.id !== boat && item.id !== broke));
    vmrOn.current = false;
  }
  // After the shark's been (or someone's just gone missing), the VMR comes out to fish the floater out.
  async function vmrRecover(at?: number, pan = false) {
    if (vmrOn.current) return;
    vmrOn.current = true;
    const { sm, k, start, end } = seaLane(), water = sm.b(296), fx = at ?? sm.x(3100 + Math.random() * 250), fw = 50 * k * 0.6, fh = fw * 0.4, v = vmrSize();
    if (pan) panTo(fx);
    const floater = addSea({ kind: "floater", x: fx - fw / 2, bottom: water - fh * 0.5, w: fw, h: fh, cls: "floatBob" }, 60_000);
    if (at === undefined) add({ kind: "burst", x: fx - 50, y: water + 40, size: 0, text: "Uh oh... floater." });
    await later(1600);
    const stop = fx - v.w * 1.02;
    const boat = addSea({ kind: "vmr", x: start + 60, bottom: water - v.h * 0.12, w: v.w, h: v.h, tms: 0 }, 60_000);
    await later(80);
    updSea(boat, { x: stop, tms: 4400, ease: "ease-out" });
    await later(4500);
    updSea(boat, { hook: true });
    add({ kind: "burst", x: fx - 90, y: water + v.h + 10, size: 0, text: pick(["Gently... gently... got 'im.", "Righto, he's comin' aboard.", "Another one for the paperwork."]) });
    await later(2000);
    setSeaBits(list => list.filter(item => item.id !== floater));
    updSea(boat, { hook: false });
    add({ kind: "burst", x: fx - 70, y: water + v.h - 10, size: 0, text: pick(["That's three this arvo.", "Swim between the flags, they said...", "Shark's eatin' better than me."]) });
    await later(1500);
    const gone = end - v.w - 40;
    updSea(boat, { x: gone, tms: 5200, ease: "ease-in" });
    await later(4300);
    updSea(boat, { hide: true });
    await later(1000);
    setSeaBits(list => list.filter(item => item.id !== boat));
    vmrOn.current = false;
  }
  // A flock of pelicans cruising along the beach in a big V. One peels off, plunges into the water and
  // comes up with a fish.
  async function pelicanFlock(pan = false) {
    const { sm, k, start, end } = seaLane(), w = 420 * k * 0.55, h = w * 0.4, high = sm.b(170), ms = 14_000, dx = end - start;
    if (pan) seaPan();
    addSea({ kind: "pelicans", x: start, bottom: high, w, h, cls: "seaCross", dx, ms }, ms + 300);
    await later(ms * 0.45);
    const px = start + dx * 0.45 + w * 0.5, pw = 90 * k * 0.5, water = sm.b(300);
    addSea({ kind: "pelicanDiver", x: px, bottom: high, w: pw, h: pw * 0.55, cls: "pelicanDive", dy: high - water, ms: 1100 }, 1150);
    await later(1100);
    add({ kind: "burst", x: px - 40, y: water + 40, size: 0, text: "SPLOOSH!" });
    addSea({ kind: "pelicanDiver", x: px, bottom: water - pw * 0.2, w: pw, h: pw * 0.55, cls: "floatBob", on: true }, 7000);
  }
  // Two choppers buzzing the beach, one each way, and neither one looking. KER-RUNCH. Both pilots
  // bail out under little parachutes; the choppers spin down into the drink. A row of punters
  // sitting on the sand watch the whole thing and have their say.
  const [helis, setHelis] = useState<Heli[]>([]);
  const [gawkers, setGawkers] = useState<Gawker[]>([]);
  const heliOn = useRef(false);
  async function heliCrash(pan = false) {
    if (heliOn.current || (!immersive && phaseRef.current === "hidden")) return;
    heliOn.current = true;
    const sm = stripMap(), k = sm.k, hw = 120 * k * 0.6, hh = hw / 2, cx = sm.x(3360 + Math.random() * 300), alt = sm.b(150), water = sm.b(292);
    if (pan) panTo(cx);
    const gw = isPhone() ? 32 : 44;
    setGawkers([3070, 3125, 3180, 3235, 3290].map((sx, i) => ({ id: ++uid, x: sm.x(sx) - gw / 2, bottom: sm.b(368 + (i % 2) * 5), look: i, line: null })));
    const a = ++uid, b = ++uid, spread = Math.max(700, window.innerWidth * 0.6);
    setHelis([
      { id: a, x: cx - spread - hw, bottom: alt + hh * 0.3, ms: 0, faceLeft: false, falling: false, dy: 0, livery: 0 },
      { id: b, x: cx + spread, bottom: alt - hh * 0.2, ms: 0, faceLeft: true, falling: false, dy: 0, livery: 1 },
    ]);
    await later(80);
    setHelis(list => list.map(h => ({ ...h, x: h.id === a ? cx - hw * 0.92 : cx - hw * 0.08, bottom: alt, ms: 4600 })));
    add({ kind: "burst", x: cx - 90, y: alt + 120, size: 0, text: "WHUP WHUP WHUP WHUP" });
    await later(4650);
    // KER-RUNCH.
    add({ kind: "boom", x: cx - 140, y: alt - 20, size: 0, text: "KABOOM!" });
    add({ kind: "burst", x: cx - 60, y: alt + hh + 40, size: 0, text: "KER-RUNCH!!" });
    for (let i = 0; i < 8; i++) add({ kind: "smoke", x: cx + (Math.random() - 0.5) * hw, y: alt + Math.random() * hh, size: 26 + Math.random() * 30 });
    setHelis(list => list.map(h => ({ ...h, falling: true, dy: alt - water + hh * 0.3 })));
    // Both pilots punch out.
    [-1, 1].forEach(side => addSea({ kind: "chute", x: cx + side * hw * 0.5 - 14, bottom: alt + hh, w: 28 * k, h: 40 * k, cls: "chuteDrift", dy: alt + hh - water, ms: 7000 }, 13_000));
    await later(1600);
    setHelis([]);
    add({ kind: "burst", x: cx - 120, y: water + 50, size: 0, text: "SPLOOSH!" });
    window.setTimeout(() => add({ kind: "burst", x: cx + 10, y: water + 40, size: 0, text: "SPLOOSH!" }), 300);
    addSea({ kind: "wreck", x: cx - 25 * k, bottom: water - 8, w: 50 * k, h: 40 * k, cls: "floatBob" }, 16_000);
    // The commentary.
    await later(1200);
    for (let i = 0; i < GAWKER_LINES.length; i++) {
      const line = GAWKER_LINES[i];
      setGawkers(list => list.map((g, j) => ({ ...g, line: j === i ? line : null })));
      await later(readMs(line) + 300);
    }
    setGawkers(list => list.map(g => ({ ...g, line: null })));
    await later(1500);
    setGawkers([]);
    heliOn.current = false;
  }
  // Something's always going on out there, one thing at a time-ish.
  useEffect(() => {
    if (!immersive && phase === "hidden") { setSeaBits([]); setBazza(null); bazzaOn.current = false; return; }
    let timer = 0;
    const shows = [() => void skiRun(), () => jetRun(), () => void paraRun(), () => dolphinRun(), () => void whaleRun(), () => void skiRun(), () => jetRun(), () => void bazzaShow(), () => void vmrTow(), () => void pelicanFlock()];
    const next = () => { timer = window.setTimeout(() => { if (seaBitsRef.current.length < 3) pick(shows)(); next(); }, 14_000 + Math.random() * 12_000); };
    next();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);
  const seaArt = (b: SeaBit) => b.kind === "ski" ? <SkiBoat skier={b.on} /> : b.kind === "skier" ? <StackedSkier /> : b.kind === "jet" ? <JetSki colour={b.colour} />
    : b.kind === "para" ? <Parasail rider={b.on} /> : b.kind === "rider" ? <FallingRider /> : b.kind === "pod" ? <span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><DolphinPod /></span> : b.kind === "whale" ? <WhaleBreach />
      : b.kind === "pelicans" ? <span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><svg viewBox="0 0 420 170" width="100%" height="100%" overflow="visible">
        {[[0, 0], [60, 30], [120, 60], [180, 90], [60, 110], [0, 140], [-60, 160]].map(([px, py], i) => <svg key={i} x={300 - px} y={py * 0.5} width={90} height={50} overflow="visible"><Pelican /></svg>)}
      </svg></span>
      : b.kind === "pelicanDiver" ? <span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><Pelican fish={b.on} /></span>
      : b.kind === "chute" ? <PilotChute /> : b.kind === "wreck" ? <ChopperWreck />
      : b.kind === "vmr" ? <VMRBoat tow={b.on} hook={b.hook} /> : b.kind === "broke" ? <BrokenBoat /> : b.kind === "floater" ? <Floater />
      : b.kind === "tail" ? <WhaleTail /> : b.kind === "fin" ? <span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><SharkFin /></span> : b.kind === "chomp" ? <SharkLunge /> : null;

  // ---- The seagull chip heist ----
  const [chips, setChips] = useState<ChipRaid | null>(null);
  const chipsOn = useRef(false);
  const updEater = (change: Partial<ChipRaid["eater"]>) => setChips(c => c && { ...c, eater: { ...c.eater, ...change } });
  const updGulls = (change: (g: Gull, i: number) => Gull) => setChips(c => c && { ...c, gulls: c.gulls.map(change) });
  async function chipRaid(pan = false) {
    if (chipsOn.current || (!immersive && phaseRef.current === "hidden")) return;
    chipsOn.current = true;
    const sm = stripMap(), sand = sm.b(370), from = sm.x(2990), spot = sm.x(3080 + Math.random() * 280), ew = isPhone() ? 32 : 44, H = window.innerHeight;
    const sky = () => sand + 90 + Math.random() * Math.min(220, H * 0.3);
    if (pan) panTo(spot);
    // Down to the beach with the parcel.
    setChips({ eater: { x: from - ew / 2, bottom: sand, ms: 0, faceLeft: false, pose: "walk", line: null }, gulls: [] });
    await later(80);
    const walkMs = Math.max(1600, Math.abs(spot - from) * 12);
    updEater({ x: spot - ew / 2, ms: walkMs });
    await later(walkMs);
    updEater({ pose: "eat", ms: 0, line: pick(["Ahh. Beachside chippy. Heaven.", "Nothin' beats chips on the beach.", "Flake and chips, extra salt. Lovely."]) });
    await later(2400);
    updEater({ line: null });
    // The gulls start turning up. First a couple, then the lot.
    const gw = isPhone() ? 28 : 36, L = panX(), W = window.innerWidth;
    for (let i = 0; i < 9; i++) {
      const fromLeft = Math.random() < 0.5, id = ++uid;
      setChips(c => c && { ...c, gulls: [...c.gulls, { id, x: fromLeft ? L - 60 : L + W + 20, bottom: sky(), ms: 0, faceLeft: !fromLeft, flying: true, carrying: false }] });
      await later(60);
      const tx = spot + (Math.random() - 0.5) * 260;
      setChips(c => c && { ...c, gulls: c.gulls.map(g => (g.id === id ? { ...g, x: tx, bottom: sky(), ms: 1800 + Math.random() * 900, faceLeft: tx < g.x } : g)) });
      if (i % 2 === 0) add({ kind: "burst", x: spot - 120 + Math.random() * 200, y: sand + 150 + Math.random() * 60, size: 0, text: pick(["MINE!", "MINE! MINE!", "SQUAWK!", "MINE?"]) });
      // Some come down and stand about, edging closer.
      if (i >= 3) window.setTimeout(() => updGulls(g => (g.id === id ? { ...g, flying: false, bottom: sand + Math.random() * 6, x: spot + (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 90), ms: 900 } : g)), 2000);
      await later(650);
    }
    await later(1600);
    updGulls(g => (g.flying ? g : { ...g, x: g.x + (spot - g.x) * 0.4, ms: 1200 }));
    updEater({ pose: "shoo", line: pick(["Piss off!", "Get away, ya flying rats!", "Not today, Kevin!", "SHOO! SHOO!"]) });
    // They scatter... and come straight back.
    updGulls(g => ({ ...g, flying: true, bottom: sky(), x: g.x + (Math.random() - 0.5) * 160, ms: 700 }));
    await later(1600);
    updEater({ pose: "eat", line: null });
    updGulls(g => ({ ...g, flying: Math.random() < 0.4, bottom: Math.random() < 0.4 ? sky() : sand + Math.random() * 6, x: spot + (Math.random() < 0.5 ? -1 : 1) * (36 + Math.random() * 70), ms: 1100 }));
    add({ kind: "burst", x: spot - 60, y: sand + 170, size: 0, text: "MINE! MINE! MINE!" });
    await later(2400);
    // The snatch.
    let thief = 0;
    setChips(c => { if (c && c.gulls.length) thief = c.gulls[0].id; return c; });
    await later(30);
    updGulls(g => (g.id === thief ? { ...g, flying: true, x: spot - gw / 2 + ew * 0.4, bottom: sand + 40, ms: 450, faceLeft: false } : g));
    await later(480);
    add({ kind: "burst", x: spot - 40, y: sand + 120, size: 0, text: "SNATCH!" });
    updEater({ pose: "robbed", line: pick(["ME CHIPS!!", "OI! THAT WAS FOUR BUCKS!", "Oh, come ON!"]) });
    const away = Math.random() < 0.5, offX = away ? panX() - 300 : panX() + window.innerWidth + 300;
    updGulls(g => (g.id === thief ? { ...g, carrying: true, x: offX, bottom: H * 0.8, ms: 2600, faceLeft: away } : { ...g, flying: true, x: offX + (Math.random() - 0.5) * 300, bottom: H * (0.6 + Math.random() * 0.25), ms: 2800 + Math.random() * 1200, faceLeft: away }));
    for (let i = 0; i < 6; i++) window.setTimeout(() => add({ kind: "junk", x: spot + (away ? -1 : 1) * i * 50, y: sand + 140 + i * 12, size: 0, dx: (Math.random() - 0.5) * 60, dy: 140 + i * 12, arc: -20, text: "🍟" }), 200 + i * 220);
    await later(3000);
    updEater({ line: pick(["...shoulda got the potato scallops.", "Every. Bloody. Time.", "I'm gettin' a dog."]) });
    await later(2600);
    // Off home, empty-handed.
    updEater({ pose: "walk", line: null, x: from - 200, ms: walkMs, faceLeft: true });
    await later(walkMs);
    setChips(null);
    chipsOn.current = false;
  }

  // They all happen by themselves every so often.
  useEffect(() => {
    if (!immersive && phase === "hidden") { setBinDiver(null); setRescue(null); setShark(null); binDiveOn.current = false; rescueOn.current = false; sharkOn.current = false; return; }
    const timers: number[] = [];
    const every = (run: () => void, min: number, spread: number) => {
      const next = () => { timers.push(window.setTimeout(() => { run(); next(); }, min + Math.random() * spread)); };
      next();
    };
    every(() => void binDive(), 40_000, 35_000);
    every(() => void lifeguardRescue(), 70_000, 60_000);
    every(() => void sharkAttack(), 100_000, 70_000);
    every(() => void chipRaid(), 60_000, 50_000);
    every(() => void heliCrash(), 150_000, 120_000);
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, immersive]);

  // Dust and smoke kicked up from the emus' feet as they run.
  const emusOut = emus.length > 0;
  useEffect(() => {
    if (!emusOut) return;
    const timer = window.setInterval(() => {
      document.querySelectorAll<HTMLElement>("[data-emu]").forEach(el => {
        if (Math.random() < 0.4) return;
        const r = sRect(el), dir = Number(el.dataset.emu), feet = dir === 1 ? r.left + r.width * 0.38 : r.right - r.width * 0.38;
        if (r.right < 0 || r.left > VW()) return;
        add({ kind: "smoke", x: feet + (Math.random() - 0.5) * 12, y: window.innerHeight - r.bottom + 2, size: 8 + Math.random() * 12 });
      });
    }, 140);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emusOut]);
  // A mob of emus legs it across the road, all neck and knees.
  function emuFlock() {
    if (!claimScene(8000)) return;
    const W = VW(), dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, count = 10 + Math.floor(Math.random() * 4);
    const flock = Array.from({ length: count }, (_, i) => {
      const size = 62 + Math.random() * 18;
      return { id: ++uid, dir, size, x: dir === 1 ? -size - 40 - i * 70 - Math.random() * 40 : W + 40 + i * 70 + Math.random() * 40, bottom: [GROUND + 2, FAR_LANE + 6, ROAD_H - 8][i % 3] + Math.random() * 8, ms: 0, hits: 0 };
    });
    setEmus(list => [...list, ...flock]);
    window.setTimeout(() => setEmus(list => list.map(e => {
      const f = flock.find(x => x.id === e.id);
      if (!f) return e;
      const end = dir === 1 ? VW() + 100 : -f.size - 40;
      return { ...e, x: end, ms: Math.abs(end - f.x) * 3 };
    })), 60);
    add({ kind: "burst", x: dir === 1 ? 20 : W - 240, y: GROUND + 150, size: 0, text: "THUD THUD THUD THUD!" });
    if (phaseRef.current === "parked" && !busy.current && Math.random() < 0.5) window.setTimeout(() => speak(pick(["EMUS! Lock up the barbie!", "They won the Great Emu War, ya know. Cocky buggers.", "Look at the knees on 'em!"])), 1000);
  }
  function rooMob() {
    if (!claimScene(8000)) return;
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1, count = 8 + Math.floor(Math.random() * 4), ms = span(5500 + Math.random() * 2000);
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
    setKills([]); setIbis(null); ibisBusy.current = false; setBbq(null); setFlyers([]); setRaider(null); setFlock(null); flockBusy.current = false; setRoos([]); setEmus([]); setDropBear(null); dropBusy.current = false; setSportbikes([]); setStrike(null); strikeBusy.current = false; setDanglers([]); setSnakes([]); setDazza(null); dazzaBusy.current = false; setNev(null); nevRun.current++; setBlue(null); blueBusy.current = false; setBlueAnimal(null); setBlueBirds(null); setPelican(null); setRoadFish(null); setGary(null); garyBusy.current = false; setCrossings([]); crossingCount.current = 0; setCrows([]); setLorikeets([]); setPoops({}); setTrev(null); setCookout(null); setDole(null); doleBusy.current = false; setBev(null); setDingoes([]); dingoBusy.current = false; setRoaches([]); setShopBikers([]); setCommuters([]); setDuck(null); setRave(null); setThieves({ trev: null, kylie: null, stolenRed: false, bricked: false }); setHitters([]); setPostie(null); setKid(null); setShotKoalas([]); shotIds.current.clear(); sceneUntil.current = 0; setTattoo(null); setConvoy(0); setBrawl(null);
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
    setPhoneView(VW() > window.innerWidth + 1);
    const onResize = () => {
      setPhoneView(VW() > window.innerWidth + 1);
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
    if (now) sceneUntil.current = Date.now() + 90_000;
    else if (!claimScene(80_000, 4000)) return;
    blueBusy.current = true;
    const W = VW(), verge = ROAD_H - 10, say = (line: string | null) => setBlue(b => b && { ...b, line });
    const pose = (p: TrueBluePose) => setBlue(b => b && { ...b, pose: p });
    // He comes out of the bottlo, of course.
    const sm = stripMap(), bottloX = Math.round(sm.x(BOTTLO_DOOR) - 33), bottloDoor = sm.b(381);
    let at = bottloX;
    setBlue({ x: bottloX, bottom: bottloDoor, ms: 0, faceLeft: false, pose: "walk", line: "🎵 Hey True Blue! Is it me and you? 🎵", fish: false });
    panTo(bottloX);
    add({ kind: "burst", x: bottloX - 10, y: bottloDoor + 120, size: 0, text: "*clink clink*" });
    await later(500);
    setBlue(b => b && { ...b, bottom: verge, ms: 700 });
    await later(750);
    // Wanders about the street; somewhere a decent way from where he is now.
    const spot = () => { let x = at; for (let i = 0; i < 12 && Math.abs(x - at) < 180; i++) x = Math.round(60 + Math.random() * (W - 220)); return x; };
    const walkTo = async (x: number) => {
      const ms = Math.max(1400, Math.abs(x - at) * 10);
      panTo(x);
      setBlue(b => b && { ...b, pose: "walk", x, ms, faceLeft: x < at });
      at = x;
      await later(ms + 50);
      pose("stand");
    };
    pose("drink"); say("Ahh. Nothin' beats a hard-earned thirst.");
    await later(2600);
    say("A hard-earned thirst needs a big cold beer!");
    await walkTo(spot());
    say(null);
    // The animals find him one at a time, wherever he's wandered to.
    const pets = (["roo", "koala", "wombat", "dropbear", "croc"] as const).slice().sort(() => Math.random() - 0.5).slice(0, 4);
    for (const kind of pets) {
      const fromLeft = at > W / 2 ? Math.random() < 0.3 : Math.random() < 0.7, edge = fromLeft ? -90 : W + 40;
      const besideX = fromLeft ? at - 72 : at + 62;
      setBlueAnimal({ kind, x: edge, ms: 0, faceLeft: !fromLeft });
      await later(60);
      setBlueAnimal(a => a && { ...a, x: besideX, ms: Math.max(1400, Math.abs(besideX - edge) * 3) });
      setBlue(b => b && { ...b, faceLeft: fromLeft });
      await later(Math.max(1400, Math.abs(besideX - edge) * 3) + 50);
      pose("pet"); say(PET_LINES[kind]);
      for (let i = 0; i < 3; i++) { add({ kind: "burst", x: besideX + 10, y: ROAD_H + 40 + i * 14, size: 0, text: i === 1 ? "pat pat" : "♥" }); await later(450); }
      pose("stand"); say(null);
      setBlueAnimal(a => a && { ...a, x: edge, ms: 1600, faceLeft: !a.faceLeft });
      await later(900);
      setBlueAnimal(null);
      await walkTo(spot());
    }
    // Gumtree Gary wants one too.
    await garyComeForPat(at + 60);
    setBlue(b => b && { ...b, faceLeft: false });
    pose("pet"); say("Who's a good boy, Gary? Who's a GOOD boy?");
    for (let i = 0; i < 3; i++) { add({ kind: "burst", x: at + 70, y: ROAD_H + 40 + i * 14, size: 0, text: i === 1 ? "pat pat" : "♥" }); await later(450); }
    pose("stand");
    void garyGoHome();
    await later(1700);
    say("Oh, ya filthy animal. Not on the gum tree!");
    await later(2400);
    say(null);
    // Somewhere new for the birds: a lorikeet onto his shoulder, a bin chicken beside him.
    await walkTo(spot());
    setBlueBirds({ lori: { x: -40, bottom: window.innerHeight * 0.7, ms: 0, landed: false }, ibis: { x: W + 40, bottom: window.innerHeight * 0.6, ms: 0, landed: false } });
    await later(60);
    setBlueBirds({ lori: { x: at + 22, bottom: verge + 84, ms: 1800, landed: false }, ibis: { x: at - 70, bottom: ROAD_H - 14, ms: 2200, landed: false } });
    await later(2300);
    setBlueBirds(bb => bb && { lori: bb.lori && { ...bb.lori, landed: true }, ibis: bb.ibis && { ...bb.ibis, landed: true } });
    say("G'day, birds! Plenty of room on the shoulder.");
    await later(2600);
    // Fish from the sky (twice): the pelican drops one into his hand, he kisses it and lobs it on the road.
    const gary = garyHome();
    for (let round = 0; round < 2; round++) {
      setPelican({ x: -120, bottom: window.innerHeight * 0.78, ms: 0, fish: true });
      await later(60);
      setPelican({ x: at - 10, bottom: ROAD_H + 190, ms: 2200, fish: true });
      pose("catch"); say(round ? "Another one! Ya spoil me!" : "Here she comes!");
      await later(2250);
      setPelican(p => p && { ...p, fish: false });
      add({ kind: "junk", x: at + 50, y: ROAD_H + 200, size: 0, dx: 0, dy: 120, arc: -10, text: "🐟" });
      await later(900);
      setPelican(p => p && { ...p, x: W + 160, bottom: window.innerHeight * 0.85, ms: 2600 });
      setBlue(b => b && { ...b, pose: "kiss", fish: true, line: "MWAH! Ya beautiful thing." });
      add({ kind: "burst", x: at + 10, y: ROAD_H + 150, size: 0, text: "♥ MWAH ♥" });
      await later(1800);
      setBlue(b => b && { ...b, pose: "toss", fish: false, line: "Off ya go, mate!" });
      const landX = gary.x + 20 + (Math.random() - 0.5) * 60, handX = at + 60, handY = verge + 108;
      add({ kind: "junk", x: handX, y: handY, size: 0, dx: landX - handX, dy: handY - (GROUND + 8), arc: -110, text: "🐟" });
      await later(950);
      setRoadFish({ x: landX });
      pose("stand");
      if (round === 0) await later(400);
      void garyFetch(landX + 12, GROUND - 2, () => setRoadFish(null), "fish");
      await later(round === 0 ? 3500 : 1500);
    }
    setPelican(null);
    // Off he staggers, singing (back to the bottlo for another, probably).
    setBlueBirds(bb => bb && { lori: bb.lori && { ...bb.lori, landed: false, x: W + 60, bottom: window.innerHeight * 0.8, ms: 2400 }, ibis: bb.ibis && { ...bb.ibis, landed: false, x: -80, ms: 3000 } });
    const offMs = Math.max(4000, (W + 80 - at) * 11);
    setBlue(b => b && { ...b, pose: "walk", faceLeft: false, line: "🎵 Hey True Blue… 🎵 Hooroo, cobbers!", x: W + 80, ms: offMs });
    if (!busy.current) speak(pick(["Hey True Blue! Legend.", "That bloke's patted more roos than I've had hot dinners.", "Kissin' fish on a Tuesday. Living the dream."]));
    await later(offMs);
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

  // Full screen on a phone held upright: ask them to turn it sideways.
  const [portrait, setPortrait] = useState(false);
  const [rotateOk, setRotateOk] = useState(false);
  useEffect(() => {
    if (!immersive) return;
    const check = () => {
      const upright = window.innerHeight > window.innerWidth && Math.min(window.innerWidth, window.innerHeight) < 600;
      setPortrait(upright);
      if (!upright) setRotateOk(false);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    setCanFull(!!document.fullscreenEnabled);
    const fsChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fsChange);
    return () => { window.removeEventListener("resize", check); window.removeEventListener("orientationchange", check); document.removeEventListener("fullscreenchange", fsChange); };
  }, [immersive]);
  const [isFull, setIsFull] = useState(false);
  const [canFull, setCanFull] = useState(false);
  async function goLandscape() {
    try {
      await document.documentElement.requestFullscreen?.();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      await orientation.lock?.("landscape");
    } catch { /* not every phone allows it; turning it by hand works too */ }
    setRotateOk(true);
  }
  function fullScreen() {
    if (!immersive) { window.location.href = "/day-out/shazz"; return; }
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void goLandscape();
  }
  // Esc closes the tricks menu.
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);
  const scrollStreet = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * window.innerWidth * 0.6, behavior: "smooth" });
  const onRoad = immersive || phase !== "hidden" || fx.some(item => item.kind === "skid" || item.kind === "shard");
  const actions: [Action, string][] = [["drink", "🍺 Crack a tinnie"], ["flip", "🖕 Flip us off"], ["moon", "🍑 Show us ya arse"], ["smoke", "🚬 Light a durry"], ["throw", "🍾 Chuck a bottle"]];
  // Choosing anything from the menu closes it (so on a phone the sheet gets out of the way).
  const pickTrick = (run: () => void) => () => { setMenu(false); run(); };
  // Wildlife and locals from the menu jump the queue (clear the "something's on" lock first).
  const callIn = (run: () => void) => pickTrick(() => { sceneUntil.current = 0; run(); });
  return <><div ref={scroller} className={`${styles.stageScroller} ${phoneView ? styles.draggable : ""}`}
    onPointerDown={event => {
      const sc = scroller.current;
      if (event.pointerType !== "mouse" || event.button !== 0 || !sc || sc.scrollWidth <= sc.clientWidth + 4) return;
      drag.current = { x: event.clientX, left: sc.scrollLeft, moved: false };
    }}
    onClickCapture={event => { if (justDragged.current) { event.stopPropagation(); event.preventDefault(); justDragged.current = false; } }}
    onWheel={immersive ? event => { if (scroller.current && Math.abs(event.deltaY) > Math.abs(event.deltaX)) scroller.current.scrollLeft += event.deltaY; } : undefined}>
    <div className={`${styles.stage} ${immersive ? styles.immersive : ""} ${convoy || brawl === "boom" ? styles.rumble : ""}`} style={phoneView ? { width: VW() } : undefined}>
    {/* The shops behind the road. Not clickable itself, but it stops clicks reaching the page behind. */}
    {/* Sky first, then the jets, then the shops (sky-less) on top: the trails go behind the buildings. */}
    {(immersive || phase !== "hidden") && <div className={styles.skyLayer} aria-hidden onClick={event => event.stopPropagation()} />}
    {jets.length > 0 && <span className={styles.skyClip} aria-hidden style={{ width: VW(), height: immersive ? window.innerHeight : stripMap().b(0) }}>{jets.map(j => {
      // bottom-up coords, so a climb is a negative (anticlockwise) rotation on screen
      const dx = j.x1 - j.x0, dy = j.y1 - j.y0, len = Math.hypot(dx, dy), angle = (-Math.atan2(dy, dx) * 180) / Math.PI, upsideDown = Math.abs(angle) > 90;
      return <span key={j.id} className={styles.flightPath} aria-hidden style={{ left: j.x0, bottom: j.y0, width: len, transform: `rotate(${angle}deg)`, ["--ms" as string]: `${j.ms}ms` }}>
        <span className={styles.contrailWrap}><span className={styles.contrail} /></span>
        <span className={styles.jet} style={{ animationDuration: `${j.ms}ms`, ["--from" as string]: "-60px", ["--to" as string]: `${len - 10}px` }}>
          <span className={styles.ibisBody} style={{ transform: upsideDown ? "scaleY(-1)" : undefined }}><Jet /></span>
        </span>
      </span>;
    })}</span>}
    {(immersive || phase !== "hidden") && <div className={styles.shopStrip} aria-hidden onClick={event => event.stopPropagation()}><Shopfronts sky={false} closed={{ harley: closedShops.harley > 0, indian: closedShops.indian > 0 }} /></div>}
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
        <Bubble text={thieves.trev.line} className={styles.ibisBubble} style={{ bottom: 140 }} />
      </span>}
      {thieves.kylie && <span className={styles.thief} style={{ left: thieves.kylie.x, bottom: 60, width: 70, height: 121, transitionDuration: `${thieves.kylie.ms}ms` }}>
        <span className={styles.thiefBody}><span className={styles.ibisBody} style={{ transform: thieves.kylie.leaving ? undefined : "scaleX(-1)" }}><Kylie pose="run" /></span></span>
        {thieves.kylie.wheel && <span className={styles.stolenWheel} />}
        <Bubble text={thieves.kylie.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
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
    {convoy > 0 && <div key={convoy} className={styles.convoy} aria-hidden style={{ ["--world" as string]: `${VW()}px`, animationDuration: `${Math.round((11000 * (2980 + VW())) / 4580)}ms` }}>
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
      <Bubble text={trev.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
    </span>}
    {phase !== "hidden" && palmSpots().map(pt => <span key={`palm${pt.i}`} className={styles.palmTree} aria-hidden style={{ left: pt.left, bottom: pt.base, width: pt.w, height: pt.h }}>
      <PalmTree lean={pt.lean} variant={pt.i} />
    </span>)}
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
          <Bubble text={cookout.line?.who === who ? cookout.line.text : null} className={styles.ibisBubble} style={{ bottom: 132 }} />
        </span>;
      })}
      {cookout.cop && <span className={styles.strikeCar} aria-hidden style={{ left: cookout.cop.x, bottom: FAR_LANE, width: isPhone() ? 150 : 190, height: (isPhone() ? 150 : 190) * 0.42, transitionDuration: `${cookout.cop.ms}ms` }}>
        <span className={styles.carFlip} style={{ transform: cookout.cop.flip ? "scaleX(-1)" : undefined }}><PoliceCar damage={0} wrecked={false} /></span>
      </span>}
    </>}
    {dingoes.map(d => <span key={d.id} data-poopable="animal" className={styles.dingo} style={{ left: d.x, bottom: ROAD_H - 12, transitionDuration: `${d.ms}ms` }}>
      <span className={d.running ? styles.dingoRun : styles.ibisBody}><span className={styles.ibisBody} style={{ transform: d.faceLeft ? "scaleX(-1)" : undefined }}><Dingo running={d.running} snags={d.snags} /></span></span>
      {d.puzzled && <span className={styles.puzzled}>?</span>}
    </span>)}
    {bev && <span data-poopable="person" className={styles.bev} style={{ left: bev.x, bottom: ROAD_H - 10, transitionDuration: `${bev.ms}ms` }}>
      <span className={bev.pose === "shout" ? styles.trevTwitch : styles.ibisBody}><span className={styles.ibisBody} style={{ transform: bev.faceLeft ? "scaleX(-1)" : undefined }}><Bev pose={bev.pose} /></span></span>
      <Bubble text={bev.line} className={styles.ibisBubble} style={{ bottom: 124 }} />
    </span>}
    {dole && (() => {
      const m = stripMap();
      return <>
        <span className={`${styles.doleSign} ${dole.open ? styles.doleOpen : ""}`} style={{ left: m.x(790) - 34, bottom: m.b(318) }}>{dole.open ? "OPEN" : "CLOSED"}</span>
        {dole.people.map(d => d.gone || d.inside ? null : <span key={d.id} data-poopable="person" className={styles.trev} style={{ left: d.x, bottom: d.bottom, transitionDuration: `${d.ms}ms`, ["--d" as string]: `${-((d.id % 9) * 0.137)}s`, ["--sd" as string]: `${0.09 + (d.id % 5) * 0.03}s` }}>
          <span className={d.enter === "climb" ? styles.climbDown : d.enter === "pop" ? styles.binPop : d.weird ? styles.weirdo : d.stagger ? styles.stagger : d.pose === "peek" || d.pose === "scratch" ? styles.trevTwitch : styles.ibisBody}>
            <span className={styles.ibisBody} style={{ transform: d.faceLeft ? "scaleX(-1)" : undefined }}>
              {d.who === "trev" ? <Trev pose={d.pose} shorts={d.tint} /> : <Kylie pose={d.pose} top={d.tint} />}
            </span>
          </span>
          {(d.cash || d.beer) && <span className={styles.heldFish} style={{ left: d.faceLeft ? 0 : 44, bottom: 64, fontSize: 18 }}>{d.beer ? "🍺" : "💵"}</span>}
          <Bubble text={d.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
        </span>)}
      </>;
    })()}
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
        <Bubble text={r.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
      </span>)}
      {rave.cops.map(c => !c.gone && <span key={c.id} className={styles.raveCop} style={{ left: c.x, bottom: c.bottom, transitionDuration: `${c.ms}ms` }}>
        <span className={styles.ibisBody} style={{ transform: c.faceLeft ? "scaleX(-1)" : undefined }}><RaveCop zap={c.zap} walking={c.walking} baton={c.baton} /></span>
        <Bubble text={c.line} className={styles.ibisBubble} style={{ bottom: 118 }} />
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
      <Bubble text={kid.line} className={styles.ibisBubble} style={{ bottom: KID_W + 56 }} />
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
        <Bubble text={gary.line} className={styles.ibisBubble} style={{ bottom: 128 }} />
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
    {blue && <span data-poopable="person" className={styles.trueBlue} role="button" aria-label="True Blue" title="True Blue" style={{ left: blue.x, bottom: blue.bottom ?? ROAD_H - 10, transitionDuration: `${blue.ms}ms` }}
      onClick={() => setBlue(b => b && { ...b, line: pick(["🎵 Hey True Blue! Is it me and you? 🎵", "For a hard-earned thirst, mate.", "Beer o'clock somewhere, cobber.", "Every animal's a mate if ya pat it right."]) })}>
      <span className={blue.pose === "walk" ? styles.stagger : styles.ibisBody}>
        <span className={styles.ibisBody} style={{ transform: blue.faceLeft ? "scaleX(-1)" : undefined }}><TrueBlue pose={blue.pose} /></span>
      </span>
      {blue.fish && <span className={styles.heldFish} style={{ left: 36, bottom: 96 }}>🐟</span>}
      <Bubble text={blue.line} className={styles.ibisBubble} style={{ bottom: 130 }} />
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
      <Bubble text={fighter.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
    </span>}
    {boogie && <span data-poopable="person" className={styles.trev} aria-hidden style={{ left: boogie.x, bottom: TREE_BOTTOM - 6 }}>
      <span className={styles.wildDance}>
        <span className={styles.ibisBody}>{boogie.who === "kylie" ? <Kylie pose="dance" /> : <Trev pose="dance" shorts={boogie.who === "gary" ? "#4d7c0f" : undefined} />}</span>
      </span>
      <Bubble text={boogie.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
    </span>}
    {shopBikers.map(bk => <span key={bk.id} data-poopable="person" className={styles.storeBiker} role="button" aria-label={`${bk.brand === "harley" ? "Harley" : "Indian"} biker`} title={bk.brand === "harley" ? "Harley bloke" : "Indian bloke"}
      style={{ left: bk.x, bottom: bk.bottom, transitionDuration: `${bk.ms}ms`, visibility: bk.brawling ? "hidden" : undefined }} onClick={event => { event.stopPropagation(); void crewJoke(bk.id); }}>
      <span className={styles.ibisBody} style={{ transform: bk.faceLeft ? "scaleX(-1)" : undefined }}><StoreBiker brand={bk.brand} look={bk.look} walking={bk.walking} flipping={bk.flipping} laughing={bk.laughing} cheering={bk.cheering} /></span>
      <Bubble text={bk.line} className={styles.ibisBubble} style={{ bottom: `calc(105% + ${bk.lift ?? 0}px)`, zIndex: 2 }} />
    </span>)}
    {rumble && <div className={styles.brawl} aria-hidden>
      {rumble.bikes.map(b => <span key={b.id} className={styles.passingRide} style={{ left: b.x, bottom: b.bottom, width: rideW(), height: (rideW() * 100) / 160, transitionDuration: `${b.ms}ms`, transitionTimingFunction: rumble.stage === "ride" ? "ease-out" : "ease-in" }}>
        <span className={styles.ibisBody} style={{ transform: b.faceLeft ? "scaleX(-1)" : undefined }}><span className={b.moving ? styles.carBody : styles.ibisBody}><PassingBiker brand={b.brand} look={b.look} riderless={!b.ridden} /></span></span>
      </span>)}
      {(rumble.stage === "fight" || rumble.stage === "result") && SHOP_PAIRS.map((pair, i) => {
        const indianDown = rumble.stage === "result" && rumble.winner === "harley", harleyDown = rumble.stage === "result" && rumble.winner === "indian";
        const pose = (down: boolean) => (down ? styles.rumbleDown : rumble.stage === "result" ? styles.rumbleCheer : styles.ibisBody);
        return <span key={`sp${i}`}>
          <span className={`${styles.brawler} ${rumble.knocked === `i${i}` ? styles.knockedRed : ""}`} style={{ left: rumble.mid + pair.at - 54, bottom: pair.row }}>
            <span className={pose(indianDown)}><Brawler gang="red" seed={i} colour="#b91c1c" weapon={rumble.stage === "fight" ? INDIAN_WEAPONS[i] : undefined} /></span>
          </span>
          <span className={`${styles.brawler} ${rumble.knocked === `h${i}` ? styles.knockedBlue : ""}`} style={{ left: rumble.mid + pair.at + 6, bottom: pair.row }}>
            <span className={pose(harleyDown)}><span className={styles.facingLeft}><Brawler gang="blue" seed={i + 3} colour="#f97316" weapon={rumble.stage === "fight" ? HARLEY_WEAPONS[i] : undefined} /></span></span>
          </span>
        </span>;
      })}
    </div>}
    {shopBrawl && <span className={styles.shopBrawl} style={{ left: shopBrawl.x - 130, bottom: shopBrawl.bottom }} aria-hidden>
      <span className={styles.shopBrawlDust} />
      {["👊", "🦶", "⭐", "💥", "🦵", "👊", "💫"].map((bit, i) => <span key={i} className={styles.shopBrawlBit} style={{ ["--a" as string]: `${i * 51}deg`, animationDelay: `${-i * 0.13}s` }}>{bit}</span>)}
    </span>}
    {rides.map(r => <span key={r.id} className={styles.passingRide} aria-hidden style={{ left: r.x, bottom: r.lane, width: rideW(), height: (rideW() * 100) / 160, transitionDuration: `${r.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: r.dir === -1 ? "scaleX(-1)" : undefined }}><span className={styles.carBody}><PassingBiker brand={r.brand} look={r.look} /></span></span>
    </span>)}
    {dogPoops.map(item => <span key={item.id} className={styles.dogPoop} style={{ left: item.x, bottom: item.bottom }} aria-hidden />)}
    {dogWalk && <span data-poopable="person" className={styles.dogWalker} role="button" aria-label="A bloke walking his dog" title="Bluey and his owner"
      style={{ left: dogWalk.x, bottom: dogWalk.bottom, width: beachSize.dog(), height: (beachSize.dog() * 100) / 130, transitionDuration: `${dogWalk.ms}ms` }}
      onClick={event => { event.stopPropagation(); add({ kind: "burst", x: dogWalk.x + beachSize.dog() * 0.6, y: dogWalk.bottom + 80, size: 0, text: pick(["WOOF!", "ARF ARF!", "*sniff sniff*", "Bluey! Heel!"]) }); }}>
      <span className={styles.ibisBody} style={{ transform: dogWalk.faceLeft ? "scaleX(-1)" : undefined }}><DogWalker pose={dogWalk.pose} /></span>
      <Bubble text={dogWalk.line} className={styles.ibisBubble} style={{ bottom: "100%" }} />
    </span>}
    {binDiver && <span data-poopable="person" className={styles.trev} style={{ left: binDiver.x, bottom: binDiver.bottom, transitionDuration: `${binDiver.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: binDiver.faceLeft ? "scaleX(-1)" : undefined }}>{binDiver.who === "trev" ? <Trev pose={binDiver.pose} /> : <Kylie pose={binDiver.pose} />}</span>
      <Bubble text={binDiver.line} className={styles.ibisBubble} style={{ bottom: 132 }} />
    </span>}
    {rescue?.swimmer && <span className={styles.beachActor} style={{ left: rescue.swimmer.x, bottom: rescue.swimmer.bottom, width: beachSize.swimmer(), height: beachSize.swimmer() * 2.5, transitionDuration: `${rescue.swimmer.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: rescue.swimmer.faceLeft ? "scaleX(-1)" : undefined }}><Swimmer pose={rescue.swimmer.pose} /></span>
      <Bubble text={rescue.swimmer.line} className={styles.ibisBubble} style={{ bottom: "100%" }} />
    </span>}
    {rescue?.guard && <span data-poopable="person" className={styles.beachActor} style={{ left: rescue.guard.x, bottom: rescue.guard.bottom, width: beachSize.guard(), height: beachSize.guard() * 2, transitionDuration: `${rescue.guard.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: rescue.guard.faceLeft ? "scaleX(-1)" : undefined }}><Lifeguard pose={rescue.guard.pose} /></span>
      <Bubble text={rescue.guard.line} className={styles.ibisBubble} style={{ bottom: "100%" }} />
    </span>}
    {chips && <span data-poopable="person" className={styles.beachActor} style={{ left: chips.eater.x, bottom: chips.eater.bottom, width: isPhone() ? 32 : 44, height: isPhone() ? 80 : 110, transitionDuration: `${chips.eater.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: chips.eater.faceLeft ? "scaleX(-1)" : undefined }}><ChipEater pose={chips.eater.pose} /></span>
      <Bubble text={chips.eater.line} className={styles.ibisBubble} style={{ bottom: "100%" }} />
    </span>}
    {chips?.gulls.map(g => <span key={g.id} data-poopable="animal" className={styles.gull} style={{ left: g.x, bottom: g.bottom, width: isPhone() ? 28 : 36, height: isPhone() ? 21 : 27, transitionDuration: `${g.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: g.faceLeft ? "scaleX(-1)" : undefined }}><Seagull flying={g.flying} carrying={g.carrying} /></span>
    </span>)}
    {helis.map(h => <span key={h.id} className={`${styles.heli} ${h.falling ? styles.heliFall : ""}`} aria-hidden
      style={{ left: h.x, bottom: h.bottom, width: 120 * stripMap().k * 0.6, height: 60 * stripMap().k * 0.6, transitionDuration: `${h.ms}ms`, ["--dy" as string]: `${h.dy}px` }}>
      <span className={styles.ibisBody} style={{ transform: h.faceLeft ? "scaleX(-1)" : undefined }}><Helicopter livery={h.livery} /></span>
    </span>)}
    {gawkers.map(g => <span key={g.id} data-poopable="person" className={styles.beachActor} style={{ left: g.x, bottom: g.bottom, width: isPhone() ? 32 : 44, height: isPhone() ? 80 : 110 }}>
      <span className={styles.ibisBody}><BeachGoer look={g.look} pose="sit" /></span>
      <Bubble text={g.line && (clean ? bleep(g.line) : g.line)} className={styles.ibisBubble} style={{ bottom: "72%" }} />
    </span>)}
    {seaBits.map(b => <span key={b.id} className={`${styles.seaThing} ${b.cls ? styles[b.cls] : ""} ${b.clip ? styles.seaClip : ""}`} aria-hidden
      style={{ left: b.x, bottom: b.bottom, width: b.w, height: b.h, opacity: b.hide ? 0 : undefined, ...(b.tms !== undefined ? { transitionProperty: "left, opacity", transitionDuration: `${b.tms}ms, 900ms`, transitionTimingFunction: b.ease ?? "linear" } : {}), animationDuration: b.ms ? `${b.ms}ms` : undefined, animationDelay: b.delay ? `${b.delay}ms` : undefined, ["--dx" as string]: `${b.dx ?? 0}px`, ["--dy" as string]: `${b.dy ?? 0}px` }}>
      {b.inner ? <span className={styles[b.inner]} style={{ display: "block", width: "100%", height: "100%" }}>{seaArt(b)}</span> : seaArt(b)}
    </span>)}
    {bazza && <span data-poopable="person" className={styles.beachActor} style={{ left: bazza.x, bottom: bazza.bottom, width: isPhone() ? 36 : 50, height: isPhone() ? 72 : 100, transitionDuration: `${bazza.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: bazza.faceLeft ? "scaleX(-1)" : undefined }}><Bazza pose={bazza.pose} /></span>
      <Bubble text={bazza.line} className={styles.ibisBubble} style={{ bottom: "100%" }} />
    </span>}
    {shark?.blood && <span className={styles.bloodPool} style={{ left: shark.blood.x, bottom: shark.blood.bottom }} aria-hidden />}
    {shark?.surfer && <span className={`${styles.seaThing} ${styles.floatBob}`} style={{ left: shark.surfer.x, bottom: shark.surfer.bottom, width: beachSize.surfer(), height: (beachSize.surfer() * 30) / 70 }} aria-hidden><PaddleSurfer /></span>}
    {shark?.fin && <span className={styles.seaFin} style={{ left: shark.fin.x, bottom: shark.fin.bottom, transitionDuration: `${shark.fin.ms}ms` }} aria-hidden><span className={styles.ibisBody} style={{ transform: "scaleX(-1)" }}><SharkFin /></span></span>}
    {shark?.board && <span className={`${styles.seaThing} ${styles.floatBob}`} style={{ left: shark.board.x, bottom: shark.board.bottom, width: 34, height: 14 }} aria-hidden>
      <svg viewBox="0 0 40 16" width="100%" height="100%" overflow="visible"><path d="M2 10 Q18 3 30 7 L25 10 L31 13 Q16 16 2 10 Z" fill="#f97316" stroke="#111" strokeWidth={1.2} /></svg>
    </span>}
    {shark?.chomp && <span className={styles.sharkLeap} style={{ left: shark.chomp.x, bottom: shark.chomp.bottom, width: beachSize.shark(), height: (beachSize.shark() * 80) / 120 }} aria-hidden><SharkLunge /></span>}
    {commuters.map(c => <span key={c.id} data-poopable="person" className={styles.commuter} role="button" aria-label="Someone waiting for the bus" title="Waiting for the duck"
      style={{ left: c.x, bottom: c.bottom, transitionDuration: `${c.ms}ms` }} onClick={event => { event.stopPropagation(); commuterLine(c.id, pick(BUS_STOP_LINES)); }}>
      <span className={styles.ibisBody} style={{ transform: c.faceLeft ? "scaleX(-1)" : undefined }}><Commuter look={c.look} walking={c.walking} waving={c.waving} /></span>
      <Bubble text={c.line} className={styles.ibisBubble} style={{ bottom: "105%" }} />
    </span>)}
    {duck && <span className={styles.aquaDuck} role="button" aria-label="The Aquaduck" title="Quack quack!"
      style={{ left: duck.x, bottom: FAR_LANE - 12, width: duckW(), height: (duckW() * 140) / 300, transitionDuration: `${duck.ms}ms`, transitionTimingFunction: duck.leaving ? "ease-in" : "ease-out" }}
      onClick={event => { event.stopPropagation(); setDuck(d => d && { ...d, quack: true }); quackAt(duck.x + duckW() * 0.75); window.setTimeout(() => setDuck(d => d && { ...d, quack: false }), 700); }}>
      <span className={duck.moving ? styles.carBody : styles.duckParked}><AquaDuck riders={duck.riders} quack={duck.quack} /></span>
    </span>}
    {swoopers.map(b => <span key={b.id} className={`${styles.swooper} ${styles.shootable}`} {...shootProps({ kind: "swooper", id: b.id }, "Shoot the magpie!")}
      style={{ left: b.x, bottom: b.bottom, transitionDuration: `${b.ms}ms` }}>
      <span className={b.diving ? styles.swooperDive : styles.swooperFlap}><span className={styles.ibisBody} style={{ transform: b.faceLeft ? "scaleX(-1)" : undefined }}><Magpie /></span></span>
    </span>)}
    {nev && <span data-poopable="person" className={styles.nev} role="button" aria-label="Talk to Old Nev" title="Old Nev" style={{ left: nev.x, bottom: ROAD_H - 10, transitionDuration: `${nev.ms}ms` }} onClick={nevSays}>
      <span className={styles.ibisBody} style={{ transform: nev.faceLeft ? "scaleX(-1)" : undefined }}><OldNev walking={nev.walking} shaking={nev.shaking} /></span>
      <Bubble text={nev.line} className={styles.ibisBubble} style={{ bottom: 128 }} />
    </span>}
    {dazza && <span data-poopable="person" className={styles.dazza} aria-hidden style={{ left: dazza.x, bottom: GROUND + 2, transitionDuration: `${dazza.ms}ms` }}>
      <span className={styles.ibisBody} style={{ transform: dazza.faceLeft ? "scaleX(-1)" : undefined }}><Bludger pose={dazza.pose} /></span>
      {dazza.bear && <span className={styles.bearOnHead}><DropBear /></span>}
      <Bubble text={dazza.line} className={styles.ibisBubble} />
    </span>}
    {dazza && dazza.bearTop !== null && <span className={styles.fallingBear} aria-hidden style={{ left: dazza.x + 14, top: dazza.bearTop }}><DropBear /></span>}
    {dancersOut && ([[2116, 378], [2160, 376]] as const).map(([sx, sy], i) => {
      const sm = stripMap(), w = isPhone() ? 34 : 46;
      return <span key={`dancer${i}`} data-poopable="person" className={styles.dancer} role="button" aria-label="A dancer from Sandy Bottoms on her smoko" title="Have a yarn"
        style={{ left: sm.x(sx) - w / 2, bottom: sm.b(sy), width: w, height: w * 2.5 }} onClick={event => { event.stopPropagation(); void dancerChat(i as 0 | 1); }}>
        <span className={styles.ibisBody} style={{ transform: i ? "scaleX(-1)" : undefined }}><SmokoGirl look={i} /></span>
        <Bubble text={dancerLines[i]} className={styles.ibisBubble} style={{ bottom: "100%", zIndex: 2 }} />
      </span>;
    })}
    {bats.map(b => {
      const box = batBox(b);
      return <span key={b.id} className={`${styles.wireBat} ${styles.shootable} ${b.shot ? styles.batFall : ""}`} {...shootProps({ kind: "bat", id: b.id }, "Shoot the fruit bat!")}
        onPointerEnter={() => zapBat(b.id)} style={{ left: box.left, bottom: box.bottom, width: box.w, height: box.h }}><FruitBat open={b.open} zapped={b.zapped} /></span>;
    })}
    {roaches.map(r => <span key={r.id} className={styles.roach} role="button" aria-label="Stomp the cockroach" title="Stomp it!"
      style={{ left: r.x, bottom: r.bottom, transitionDuration: `${r.ms}ms` }}
      onClick={event => { event.stopPropagation(); if (!r.squashed) stompRoach(r.id, r.x + 14, r.bottom); }}>
      <span className={styles.roachTurn} style={{ transform: r.squashed ? undefined : `rotate(${r.angle}deg)`, transitionDuration: `${Math.min(200, r.ms)}ms` }}><RoachArt squashed={r.squashed} /></span>
    </span>)}
    {emus.map(e => <span data-poopable="animal" data-emu={e.dir} key={e.id} className={`${styles.emu} ${styles.shootable}`} {...shootProps({ kind: "emu", id: e.id }, e.hits ? "Finish it off!" : "Shoot the emu!")}
      onTransitionEnd={event => { if (event.target === event.currentTarget && e.ms > 0) setEmus(list => list.filter(x => x.id !== e.id)); }}
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
      <Bubble text={ibis.line} className={styles.ibisBubble} />
    </span>}
    {fx.map(item => {
      if (item.kind === "fog") return null;
      if (item.kind === "hole") return <span key={item.id} className={styles.bulletHole} style={{ left: item.x - item.size / 2, bottom: item.y - item.size / 2, width: item.size, height: item.size }} onAnimationEnd={() => remove(item.id)} />;
      if (item.kind === "flail") return <span key={item.id} className={styles.flail} aria-hidden style={{ left: item.x - item.size / 2, bottom: item.y - item.size * 0.35, width: item.size, height: item.size }} onAnimationEnd={event => { if (event.target === event.currentTarget) remove(item.id); }}>
        <svg viewBox="0 0 60 60" width="100%" height="100%" overflow="visible">
          <g className={styles.flailArm} style={{ transformOrigin: "22px 52px" }}><path d="M22 52 L9 22" stroke="#111" strokeWidth={7} strokeLinecap="round" /><path d="M22 52 L9 22" stroke="#e0a982" strokeWidth={4.6} strokeLinecap="round" /><circle cx={8} cy={19} r={4.6} fill="#e0a982" stroke="#111" strokeWidth={1.2} /></g>
          <g className={`${styles.flailArm} ${styles.flailArmOther}`} style={{ transformOrigin: "38px 52px" }}><path d="M38 52 L51 22" stroke="#111" strokeWidth={7} strokeLinecap="round" /><path d="M38 52 L51 22" stroke="#e0a982" strokeWidth={4.6} strokeLinecap="round" /><circle cx={52} cy={19} r={4.6} fill="#e0a982" stroke="#111" strokeWidth={1.2} /></g>
          <path d="M0 14 q4 -5 8 0 M52 10 q4 -5 8 0 M24 4 q5 -6 10 0" stroke="#111" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </svg>
      </span>;
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
      if (item.kind === "burst" || item.kind === "stars" || item.kind === "boom") return <span key={item.id} className={styles[item.kind]} style={{ left: item.x, bottom: item.y, animationDuration: item.kind === "burst" && item.text && item.text.length > 10 ? `${Math.max(2600, readMs(item.text) - 600)}ms` : undefined }} onAnimationEnd={() => remove(item.id)}>{item.text}</span>;
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
    {immersive && <>
      <a href="/day-out" className={styles.immersiveBack} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); }}>← Day Out</a>
      {canFull && <button className={styles.fullButton} onClick={fullScreen}>{isFull ? "⤢ Exit full screen" : "⛶ Full screen"}</button>}
      {phoneView && <>
        <button className={`${styles.streetArrow} ${styles.streetArrowLeft}`} onClick={() => scrollStreet(-1)} aria-label="Look left along the street">◀</button>
        <button className={`${styles.streetArrow} ${styles.streetArrowRight}`} onClick={() => scrollStreet(1)} aria-label="Look right along the street">▶</button>
      </>}
      {phase === "hidden" && <div className={styles.callBack}>
        <p>Shazz has buggered off.</p>
        <button onClick={() => void arrive()}>Call her back</button>
      </div>}
      {portrait && !rotateOk && <div className={styles.rotatePrompt}>
        <span className={styles.rotatePhone} aria-hidden>📱</span>
        <h2>Turn your phone sideways</h2>
        <p>Bogan Street is a wide street. Turn your phone on its side to see the lot, then swipe along it.</p>
        <button onClick={() => void goLandscape()}>Go full screen</button>
        <button className={styles.rotateSkip} onClick={() => setRotateOk(true)}>Play like this anyway</button>
      </div>}
    </>}
    {sledge?.open && <div className={styles.sledgeCard} role="dialog" aria-labelledby="sledge-title">
      <div className={styles.sledgeScore} aria-label={`Harley ${sledge.score.harley}, Indian ${sledge.score.indian}`}>
        <HarleyBadge className={styles.sledgeLogo} />
        <span className={styles.sledgeHarley}>HARLEY {sledge.score.harley}</span>
        <span className={styles.sledgeVs}>vs</span>
        <span className={styles.sledgeIndian}>{sledge.score.indian} INDIAN</span>
        <IndianBadge className={styles.sledgeLogo} />
      </div>
      <h3 id="sledge-title">{sledge.title}</h3>
      <p>{sledge.blurb}</p>
      <div className={styles.sledgeButtons}>
        <button autoFocus className={sledge.next === "harley" ? styles.sledgeGoHarley : styles.sledgeGoIndian} onClick={fireBack}>🔥 Fire back, {CREW_NAME[sledge.next]}!</button>
        <button className={styles.sledgeNah} onClick={moveAlong}>🚶 Nah, move along</button>
        <button className={styles.sledgeBrawl} onClick={() => void shopBrawlStart()}>🥊 Settle it outside!</button>
      </div>
    </div>}
    {phase === "parked" && <div className={`${styles.trickBar} ${immersive ? styles.trickBarImmersive : ""}`}>
      <button className={styles.trickToggle} onClick={() => setMenu(open => !open)} aria-expanded={menu} aria-label="Shazz's tricks and settings"><span aria-hidden>{menu ? "✕" : "🤘"}</span>{menu ? "Close" : "Tricks"}</button>
      {!immersive && !menu && <button className={styles.webFull} onClick={fullScreen} title="Open the full-screen street"><span aria-hidden>⛶</span>Full screen</button>}
      {menu && <>
        {/* Phones: the menu is a bottom sheet; tapping outside it closes it */}
        <div className={styles.trickBackdrop} onClick={() => setMenu(false)} aria-hidden />
        <div className={styles.trickPanel}>
          {/* Phones: close sits at the top of the sheet (the floating toggle hides while it's open) */}
          <button className={styles.sheetClose} onClick={() => setMenu(false)}><span aria-hidden>✕</span> Close</button>
          <div className={styles.trickTitle}><strong>🤘 Shazz&apos;s tricks</strong><span>Pick one and stand back. Esc or click outside to close.</span></div>
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
            <Trick label="💸 Dole day" onClick={pickTrick(() => void doleDay())} />
          </div>
          <p className={styles.trickHeading}>Wildlife & locals</p>
          <div className={styles.trickGroup}>
            <Trick label="🔫 Shoot something" onClick={pickTrick(() => shootSomething())} />
            <Trick label="🚲 Magpie swoop" onClick={callIn(() => void magpieSwoop())} />
            <Trick label="🐦‍⬛ Magpie flock" onClick={pickTrick(() => magpieFlock())} />
            <Trick label="😱 Swoop everyone!" onClick={pickTrick(() => swoopEveryone())} />
            <Trick label="💩 Magpie poop raid" onClick={pickTrick(() => poopRaid())} />
            <Trick label="🥊 Bike shop brawl" onClick={pickTrick(() => void shopBrawlStart())} />
            <Trick label="🏍️ Club ride-by" onClick={pickTrick(() => rideBy())} />
            <Trick label="🗑️ Bin dive" onClick={pickTrick(() => void binDive(true))} />
            <Trick label="🛟 Lifeguard rescue" onClick={pickTrick(() => void lifeguardRescue(true))} />
            <Trick label="🦈 Shark attack" onClick={pickTrick(() => void sharkAttack(true))} />
            <Trick label="🚤 Ski boat" onClick={pickTrick(() => void skiRun(true))} />
            <Trick label="🌊 Jet skis" onClick={pickTrick(() => jetRun(true))} />
            <Trick label="🪂 Parasail" onClick={pickTrick(() => void paraRun(true))} />
            <Trick label="🐬 Dolphins" onClick={pickTrick(() => dolphinRun(true))} />
            <Trick label="🐋 Whale" onClick={pickTrick(() => void whaleRun(true))} />
            <Trick label="🪼 Steve's Wild Oz" onClick={pickTrick(() => void bazzaShow(true))} />
            <Trick label="⚓ VMR tow" onClick={pickTrick(() => void vmrTow(true))} />
            <Trick label="🍟 Seagull chip heist" onClick={pickTrick(() => void chipRaid(true))} />
            <Trick label="🐦 Pelican flock" onClick={pickTrick(() => void pelicanFlock(true))} />
            <Trick label="🚁 Chopper crash" onClick={pickTrick(() => void heliCrash(true))} />
            <Trick label="🪝 VMR recovery" onClick={pickTrick(() => void vmrRecover(undefined, true))} />
            <Trick label="🦜 Lorikeets" onClick={callIn(() => void lorikeetVisit())} />
            <Trick label="🦘 Roo mob" onClick={callIn(() => rooMob())} />
            <Trick label="🪶 Emus" onClick={callIn(() => emuFlock())} />
            <Trick label="🐕 Dingo!" onClick={pickTrick(() => void dingoSnags(true))} />
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
            <Trick label={isFull ? "⤢ Exit full screen" : "⛶ Full screen"} onClick={pickTrick(fullScreen)} />
            <Trick label={clean ? "🤬 Full swearing" : "🤐 Bleep swearing"} onClick={pickTrick(toggleClean)} />
            <Trick label="👋 Yeah, righto" onClick={pickTrick(() => void leave())} />
            <Trick label="🖐️ Piss off, Shazz" onClick={pickTrick(() => void leave(true))} />
          </div>
        </div>
      </>}
    </div>}
  </>;
}
