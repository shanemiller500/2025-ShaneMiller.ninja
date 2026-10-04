// The bike-shop crews' material. Click a Harley bloke and the Harley crew huddle up, one tells a
// joke about Indian, they all crack up and flip the Indian shop off; same the other way round.
// Each crew deals its list out like a shuffled deck (SmartArse remembers where it's up to between
// visits), so you hear the lot, in a different order every time, before any repeats. The digs are built on
// real history (who owns who, who builds what, where the parts come from), served bogan style.

export type BikerJoke = { setup: string; punch: string };

// The Harley crew, on Indian.
export const HARLEY_ON_INDIAN: BikerJoke[] = [
  { setup: "Oi, why'd Indian shut up shop from 1953 to 1999?", punch: "Longest smoko in history! Forty-six years, mate!" },
  { setup: "Know who owns Indian these days?", punch: "Polaris! The SNOWMOBILE mob! Bring a beanie, ya galahs!" },
  { setup: "Late fifties, what'd ya get if ya bought a new 'Indian'?", punch: "A Pommy Royal Enfield with a new sticker on the tank!" },
  { setup: "And who makes Royal Enfield now?", punch: "INDIA! So the Indian was a Pommy bike, and the Pommy bike's Indian. Cooked!" },
  { setup: "Polaris had another bike brand once. Victory, remember?", punch: "Killed it off in 2017. You blokes are next in the queue!" },
  { setup: "Seventies Indian minibikes. Where were they built?", punch: "TAIWAN! Proper American heritage, that!" },
  { setup: "Indian reckons it's been around since 1901...", punch: "Yeah, around the bankruptcy court, mostly. Went under how many times?!" },
  { setup: "What's the difference between an Indian and a sewing machine?", punch: "The sewing machine's got more grunt!" },
  { setup: "Why's the Indian showroom always so clean?", punch: "Nobody's walked in since Tuesday!" },
  { setup: "That new Scout's water-cooled, ya know.", punch: "I've seen sexier radiators down the wreckers!" },
  { setup: "What's the fastest Indian ever built?", punch: "The one Burt Munro rebuilt in his shed! Took a Kiwi to make it go!" },
  { setup: "They build 'em in Spirit Lake, Iowa now.", punch: "Spirit Lake! 'Cos the spirit's all that's left of the original!" },
  { setup: "How d'ya know an Indian rider's at the servo?", punch: "He's asking where the snowmobile fuel is!" },
  { setup: "Indian rider walks into a pub...", punch: "...'cos his bike's still in the shop gettin' its ego polished!" },
  { setup: "Indian's big 1999 comeback Chief. Guess what motor it had?", punch: "An S&S! A HARLEY-STYLE V-twin! Even your comeback ran on our homework!" },
  { setup: "The Gilroy Indian lot went broke in 2003.", punch: "That's bankruptcy number... ah, I've run outta fingers!" },
  { setup: "Polaris also makes the Slingshot. Three wheels, thinks it's a bike.", punch: "Bit like you blokes. Close, but no cigar!" },
  { setup: "Know what else Polaris builds? Farm quads!", punch: "Your Chief's got a cousin that rounds up sheep! Says it all!" },
  { setup: "That Indian FTR's a flat-track bike for the road.", punch: "Makes sense. You lot ride bitumen like it's a dirt track!" },
  { setup: "Indian slapped those big skirted fenders on in 1940.", punch: "Eighty years later they're still hiding the ugly bits!" },
  { setup: "Indian's founder, Hendee, was a pushbike racer.", punch: "Explains the horsepower! Pedal harder, champ!" },
  { setup: "The very first Indian in 1901?", punch: "A pushie with a motor bolted on! Honestly, not much has changed!" },
  { setup: "They named the Springfield after the town they started in...", punch: "...the same town they shot through from! Loyal as a cat!" },
  { setup: "What's the difference between an Indian and a lawnmower?", punch: "You can get the lawnmower serviced in this postcode!" },
  { setup: "Two Indian riders pass on the highway and wave...", punch: "That's the whole Indian Owners Group, done for the year!" },
  { setup: "Indian made a little 350 in the twenties. Called it the Prince.", punch: "THE PRINCE! Ya couldn't make it up! Did it come with a tiara?" },
];

// The Indian crew, on Harley.
export const INDIAN_ON_HARLEY: BikerJoke[] = [
  { setup: "Harley's X440. Know who builds it?", punch: "Hero MotoCorp, in INDIA! YOU'RE the one riding the Indian, champ!" },
  { setup: "And that little Harley X500?", punch: "Built in China by QJ Motor! 'Made in Milwaukee' me left one!" },
  { setup: "What fed the fuel into Harleys for years?", punch: "Keihin carbies! JAPANESE! It's a Honda in a leather vest!" },
  { setup: "And the forks on a Sportster?", punch: "Showa! Japanese AGAIN! Konnichiwa, Milwaukee!" },
  { setup: "In '83 Harley begged Reagan for tariffs on Japanese bikes...", punch: "...then bolted Japanese bits all over their own! Legends!" },
  { setup: "Brembo brakes, Italian. Showa forks, Japanese.", punch: "Only American bit on a Harley is the finance agreement!" },
  { setup: "Harley spent six years in court trying to trademark their exhaust note.", punch: "Six years of lawyers to own 'potato-potato'!" },
  { setup: "Harley built golf carts for near twenty years.", punch: "Most reliable thing they ever made! Still running at the bowlo!" },
  { setup: "Harley made a scooter in the sixties. The Topper.", punch: "Look it up! Hardest bloke in Milwaukee rode a step-through!" },
  { setup: "Sixties Harley lightweights. What were they really?", punch: "Italian Aermacchis with a Harley badge! Ciao, bella!" },
  { setup: "Indian started in 1901. Harley?", punch: "1903! You lot have been copying our homework for 120 years!" },
  { setup: "Why do Harleys come with leather saddlebags?", punch: "To carry the bits that fall off on the way home!" },
  { setup: "How d'ya find where a Harley's been parked?", punch: "Follow the oil stains! Leaves a map like a treasure hunt!" },
  { setup: "What's the quickest way to make a Harley go faster?", punch: "Chuck it on the back of a tow truck!" },
  { setup: "The first Harley factory? A wooden shed, three metres by four and a half.", punch: "And the build quality never left the shed!" },
  { setup: "Knucklehead, Panhead, Shovelhead... Harley names engines after what they look like.", punch: "So what's the owner? A Blockhead? Oh wait, that's the Evo!" },
  { setup: "Harley needed help building the V-Rod motor. Who'd they call?", punch: "PORSCHE! Took the Germans to make a Harley that revs!" },
  { setup: "Harley's electric LiveWire is dead quiet.", punch: "First Harley that doesn't wake the whole street! Owners hated it!" },
  { setup: "Why're Harleys called Hogs?", punch: "Their 1920 race team carried a real pig on victory laps! Been riding with pigs ever since!" },
  { setup: "Harley bought Buell for sportsbikes...", punch: "...then shut it down in 2009! Even their fast bikes gave up!" },
  { setup: "The Harley Street 750? Built in Bawal, India!", punch: "Mate, half your lineup's more Indian than we are!" },
  { setup: "In '81, AMF sold Harley back to a bunch of execs.", punch: "Even a BOWLING BALL company didn't want it!" },
  { setup: "Harley Pan America. An adventure bike!", punch: "The adventure is whether it starts in the morning!" },
  { setup: "What's the difference between a Harley and a vacuum cleaner?", punch: "Where ya put the dirtbag!" },
  { setup: "Harley rider's favourite form of exercise?", punch: "Pushin' it home from the servo!" },
];

export const CREW_LAUGHS = ["HAHAHAHA!", "OH STOP IT!", "I'M CRYIN', MATE!", "HAHA! GOLD!", "*wheeze* HAHA!", "CLASSIC!", "BWAHAHA!", "STOP, ME RIBS!"];
export const HARLEY_SENDOFFS = ["Up yours, Feathers!", "Get stuffed, Indian!", "Ride THAT, ya galahs!", "Snowmobile this!"];
export const INDIAN_SENDOFFS = ["Up yours, Milwaukee!", "Rattle off, Harley!", "Get stuffed, oil-leakers!", "Konnichiwa THIS!"];
