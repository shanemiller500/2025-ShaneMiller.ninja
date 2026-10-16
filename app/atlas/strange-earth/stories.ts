import type { AtlasStory, StoryDoc } from "@/components/atlas/story";
import { ANOMALIES } from "./featured";
import { LAKE_SOURCES } from "./lakes";

/* ------------------------------------------------------------------ */
/*  Strange Earth's guided stories. Every claim matches a source in    */
/*  the story's `docs` (UGS, USGS, NPS, WA DNR pages checked October   */
/*  2026) or is counted from our baked data (crater totals, sizes).    */
/*                                                                     */
/*  Action kinds:                                                      */
/*    refill       refill an Ice Age lake in 3D (value = lake name)    */
/*    fly          3D flyover of a featured anomaly (value = id)       */
/*    investigate  compare lenses (value = anomaly id or "lng,lat,z")  */
/*    geology      colour the map by bedrock                           */
/* ------------------------------------------------------------------ */

export type StrangeAction = "refill" | "fly" | "investigate" | "geology";

const fact = (id: string, i: number) => {
  const a = ANOMALIES.find((x) => x.id === id);
  if (!a?.facts[i]) throw new Error(`story fact ${id}#${i} missing`);
  return a.facts[i].text;
};
const anomalyDoc = (id: string, i: number, title: string): StoryDoc => {
  const s = ANOMALIES.find((x) => x.id === id)!.facts[i].source;
  return { title, url: s.url, source: s.label };
};

const PI39: StoryDoc = { title: "Lake Bonneville (Public Information 39)", url: LAKE_SOURCES.ugsBonneville.url, source: "Utah Geological Survey" };
const TUFAS: StoryDoc = { title: "The Tufas of Pyramid Lake, Nevada (Fact Sheet 2004-3044)", url: LAKE_SOURCES.usgsLahontan.url, source: "USGS", year: 2004 };
const EID_LIST: StoryDoc = { title: "List of impact structures on Earth (from the Earth Impact Database)", url: "https://en.wikipedia.org/wiki/List_of_impact_structures_on_Earth", source: "Wikipedia / PASSC" };

export const STRANGE_STORIES: AtlasStory<StrangeAction>[] = [
  {
    id: "lake-bonneville",
    title: "The Lake That Filled Utah",
    subtitle: "An Ice Age lake 1,000 feet deep — and the flood that broke it.",
    when: "32,000–14,000 years ago",
    color: "#38bdf8",
    docs: [PI39],
    chapters: [
      {
        title: "A salty leftover",
        body: [
          "Great Salt Lake looks enormous on a map, but it's a leftover. The Utah Geological Survey calls it a large remnant of Lake Bonneville, which existed from about 32,000 to 14,000 years ago.",
        ],
        camera: { center: [-112.5, 41.1], zoom: 7, pitch: 20, bearing: 0 },
      },
      {
        title: "Twenty thousand square miles of water",
        body: [
          "At its largest Lake Bonneville covered about 20,000 square miles of western Utah and smaller pieces of Nevada and Idaho: about 325 miles long, 135 miles wide and over 1,000 feet deep.",
          "Today's western Utah mountain ranges were islands in it.",
        ],
        camera: { center: [-113.1, 40.4], zoom: 5.8, pitch: 30, bearing: 0 },
        actions: [{ label: "Refill it in 3D", kind: "refill", value: "Bonneville" }],
      },
      {
        title: "Bathtub rings on the mountains",
        body: [
          "Each long pause in the lake's level cut a terrace into the mountainsides. The Bonneville and Provo shorelines are still visible as benches across western Utah; on Antelope Island the Bonneville shoreline sits at 5,220 ft and the Provo at 4,840 ft.",
        ],
        camera: { center: [-112.214, 40.958], zoom: 10.5, pitch: 55, bearing: 30 },
        actions: [{ label: "Find the benches in bare-earth lidar", kind: "investigate", value: "-112.214,40.958,12.5" }],
      },
      {
        title: "The flood",
        date: "About 16,800 years ago",
        body: [
          "The lake rose until it reached its lowest outlet, Red Rock Pass in Idaho, at about 5,090 ft — and started to pour north into the Snake River.",
          "The rushing water cut the pass down fast. The flood probably lasted less than a year and lowered the outlet about 375 feet; the lake then held steady and carved the Provo shoreline over the next 600 years.",
        ],
        camera: { center: [-112.044, 42.356], zoom: 10, pitch: 50, bearing: -20 },
      },
      {
        title: "What's left",
        body: [
          "As the climate warmed and dried, the lake shrank by evaporation. Its relics include Great Salt Lake, Utah Lake, Sevier Lake and the Great Salt Lake Desert — home of the Bonneville Salt Flats.",
        ],
        camera: { center: [-113.89, 40.76], zoom: 9, pitch: 45, bearing: 0 },
        actions: [{ label: "Fly over the salt flats", kind: "fly", value: "bonneville" }],
      },
    ],
  },
  {
    id: "lake-lahontan",
    title: "Nevada's Inland Sea",
    subtitle: "Lake Lahontan, and the tufa towers it left behind.",
    when: "About 15,000 years ago",
    color: "#22d3ee",
    docs: [TUFAS],
    chapters: [
      {
        title: "Bigger than Lake Ontario",
        body: [
          "At its highstand about 15,000 years ago, Lake Lahontan covered 22,800 km² — slightly larger than Lake Ontario today — and stood 1,335 m above sea level.",
          "It fell rapidly between 14,000 and 13,000 years ago.",
        ],
        camera: { center: [-118.9, 40.3], zoom: 6.3, pitch: 30, bearing: 0 },
        actions: [{ label: "Refill it in 3D", kind: "refill", value: "Lahontan" }],
      },
      {
        title: "Pyramid Lake",
        body: [
          "Pyramid Lake was one of seven water bodies that joined to form Lahontan. At the highstand the water here was 281 m deep; in 2004 Pyramid Lake was 106 m deep.",
          "Its tufa towers are calcium carbonate rock, built where springs on the lake bottom fed calcium into the carbonate-rich water.",
        ],
        camera: { center: [-119.564, 40.063], zoom: 9.5, pitch: 50, bearing: 15 },
        actions: [{ label: "Compare old maps and lidar", kind: "investigate", value: "-119.564,40.063,11" }],
      },
    ],
  },
  {
    id: "scars-from-space",
    title: "Scars From Space",
    subtitle: "Where rocks from space hit the ground — some you can see, some you can't.",
    when: "Billions of years",
    color: "#f472b6",
    docs: [EID_LIST, anomalyDoc("meteor-crater", 0, "Aerial view of Meteor Crater"), anomalyDoc("chesapeake", 0, "The Chesapeake Bay bolide (Fact Sheet 49-98)"), anomalyDoc("upheaval-dome", 0, "Upheaval Dome")],
    chapters: [
      {
        title: "190 confirmed scars",
        body: [
          "This map shows the 190 impact structures confirmed by the Earth Impact Database that have published coordinates, each drawn at its true size. The biggest, Vredefort in South Africa, is 160 km across and about two billion years old.",
          "Many are eroded flat or buried. They're confirmed by rock that only an impact can make.",
        ],
        camera: { center: [-20, 25], zoom: 1.4, pitch: 0, bearing: 0 },
      },
      {
        title: "Meteor Crater",
        body: [fact("meteor-crater", 0), fact("meteor-crater", 1)],
        camera: { center: [-111.0225, 35.0275], zoom: 12.5, pitch: 50, bearing: 20 },
        actions: [
          { label: "Fly over in 3D", kind: "fly", value: "meteor-crater" },
          { label: "Compare the 1886 map", kind: "investigate", value: "meteor-crater" },
        ],
      },
      {
        title: "The crater under the bay",
        body: [fact("chesapeake", 0), fact("chesapeake", 1)],
        camera: { center: [-76.017, 37.283], zoom: 7.5, pitch: 30, bearing: 0 },
      },
      {
        title: "Iowa's hidden crater",
        body: ["The Manson structure in Iowa is 35 km across and about 74 million years old, according to the Earth Impact Database.", "Look at it from above: farm fields and towns. Nothing at the surface gives it away."],
        camera: { center: [-94.55, 42.583], zoom: 8.5, pitch: 30, bearing: 0 },
        actions: [{ label: "What rock is here?", kind: "geology" }],
      },
      {
        title: "Impact, or salt?",
        body: [fact("upheaval-dome", 1), fact("upheaval-dome", 2)],
        camera: { center: [-109.9283, 38.4369], zoom: 12.5, pitch: 55, bearing: 30 },
        actions: [{ label: "See the rings in the geology", kind: "investigate", value: "upheaval-dome" }],
      },
    ],
  },
  {
    id: "unsolved",
    title: "Still Unsolved",
    subtitle: "Mounds, moving rocks and a tower nobody can fully explain.",
    when: "Now",
    color: "#a3e635",
    docs: [anomalyDoc("mima-mounds", 0, "Mima Mounds: The Mysterious Work of Nature"), anomalyDoc("racetrack", 0, "The Racetrack"), anomalyDoc("devils-tower", 1, "Tower formation")],
    chapters: [
      {
        title: "The Mima Mounds",
        body: [fact("mima-mounds", 0), fact("mima-mounds", 1)],
        camera: { center: [-123.047, 46.905], zoom: 14, pitch: 45, bearing: 10 },
        actions: [{ label: "See them in bare-earth lidar", kind: "investigate", value: "mima-mounds" }],
      },
      {
        title: "The sailing stones",
        body: [fact("racetrack", 1), fact("racetrack", 2)],
        camera: { center: [-117.5627, 36.6813], zoom: 12.5, pitch: 50, bearing: -25 },
        actions: [{ label: "Fly over in 3D", kind: "fly", value: "racetrack" }],
      },
      {
        title: "Devils Tower",
        body: [fact("devils-tower", 1), fact("devils-tower", 2)],
        camera: { center: [-104.7146, 44.5902], zoom: 13, pitch: 55, bearing: 0 },
        actions: [{ label: "Fly over in 3D", kind: "fly", value: "devils-tower" }],
      },
    ],
  },
];
