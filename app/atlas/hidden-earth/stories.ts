import type { AtlasStory, StoryDoc } from "@/components/atlas/story";
import { SITES } from "./sites";

/* ------------------------------------------------------------------ */
/*  Hidden Earth's guided stories. Every claim is a site fact (with    */
/*  its source in sites.ts) or comes from the USGS fact sheets in the  */
/*  docs below — checked October 2026.                                 */
/*                                                                     */
/*  Action kinds:                                                      */
/*    peel    satellite ⇆ lidar at a site (value = site id)            */
/*    cloud   the raw laser points of a site (value = site id)         */
/*    then    old topo map ⇆ lidar at a site (value = site id)         */
/*    view    switch the map's lidar view (value = view key)           */
/*    hunt    start the "find it" game                                 */
/* ------------------------------------------------------------------ */

export type HiddenAction = "peel" | "cloud" | "then" | "view" | "hunt";

const fact = (id: string, i: number) => {
  const s = SITES.find((x) => x.id === id);
  if (!s?.facts[i]) throw new Error(`story fact ${id}#${i} missing`);
  return s.facts[i].text;
};
const cam = (id: string, dz = 0, pitch = 0) => {
  const s = SITES.find((x) => x.id === id)!;
  return { center: s.center, zoom: s.zoom + dz, pitch, bearing: 0 };
};
const siteDoc = (id: string, i: number, title: string): StoryDoc => {
  const src = SITES.find((x) => x.id === id)!.facts[i].source;
  return { title, url: src.url, source: src.label };
};

const FS_3DEP: StoryDoc = { title: "3D Elevation Program — Virtual USA in 3D (Fact Sheet 2016-3022)", url: "https://pubs.usgs.gov/fs/2016/3022/fs20163022.pdf", source: "USGS", year: 2016 };
const FS_FAULTS: StoryDoc = { title: "Discovering Hidden Faults (Fact Sheet 017-03)", url: "https://pubs.usgs.gov/fs/2003/fs017-03/", source: "USGS", year: 2003 };

export const HIDDEN_STORIES: AtlasStory<HiddenAction>[] = [
  {
    id: "seeing-through-trees",
    title: "Seeing Through Trees",
    subtitle: "How a laser on a plane finds what the forest hides.",
    when: "Now",
    color: "#a3e635",
    docs: [FS_3DEP, FS_FAULTS],
    chapters: [
      {
        title: "Hundreds of thousands of pulses a second",
        body: [
          "From an airplane, a lidar system fires hundreds of thousands of laser pulses at the ground every second. They bounce off buildings and trees — and off rocks and the ground underneath the trees (USGS).",
          "Timing each echo gives the distance; computers turn the echoes into a 3D model of the land. The USGS 3D Elevation Program aims to map the whole country this way.",
        ],
        camera: { center: [-96, 38.5], zoom: 3.6, pitch: 0, bearing: 0 },
      },
      {
        title: "Strip the trees away",
        body: [
          "Keep only the echoes from the ground and you get the bare earth. Here, in the Iowa woods, it shows rows of mounds along the bluff top, under the canopy.",
          fact("effigy-mounds", 0),
        ],
        camera: cam("effigy-mounds", -0.4),
        actions: [
          { label: "Peel back the forest", kind: "peel", value: "effigy-mounds" },
          { label: "See the laser points", kind: "cloud", value: "effigy-mounds" },
        ],
      },
      {
        title: "A fault nobody had seen",
        body: [fact("toe-jam-hill", 0), fact("toe-jam-hill", 1)],
        camera: cam("toe-jam-hill"),
        actions: [{ label: "Peel back the forest", kind: "peel", value: "toe-jam-hill" }],
      },
      {
        title: "Your turn",
        body: ["Now you know what to look for: straight steps, rings, ridges and bumps that no river or road would make. Try to find the sites yourself."],
        camera: { center: [-90, 39], zoom: 4, pitch: 0, bearing: 0 },
        actions: [{ label: "Start the hunt", kind: "hunt" }],
      },
    ],
  },
  {
    id: "first-builders",
    title: "America's First Builders",
    subtitle: "Three thousand years of earthworks, from the delta to the moonrise.",
    when: "1000 B.C. – A.D. 1100",
    color: "#fbbf24",
    docs: [siteDoc("poverty-point", 0, "Poverty Point National Monument"), siteDoc("newark", 0, "Newark Earthworks joins World Heritage sites"), siteDoc("cahokia", 0, "Cahokia Mounds State Historic Site"), siteDoc("effigy-mounds", 1, "Effigy moundbuilders")],
    chapters: [
      {
        title: "Poverty Point",
        date: "About 3,000 years ago",
        body: [fact("poverty-point", 0), fact("poverty-point", 1)],
        camera: cam("poverty-point", -0.3),
        actions: [{ label: "Slope view", kind: "view", value: "slope" }],
      },
      {
        title: "Geometry and the moon",
        date: "About A.D. 1–400",
        body: [fact("newark", 1), fact("newark", 2)],
        camera: cam("newark", -0.2),
        actions: [{ label: "Then & now: the old maps", kind: "then", value: "newark" }],
      },
      {
        title: "Mound City",
        body: [fact("mound-city", 0), fact("mound-city", 2)],
        camera: cam("mound-city"),
        actions: [{ label: "Height view", kind: "view", value: "tinted" }],
      },
      {
        title: "Bears and birds",
        date: "1,400–750 years ago",
        body: [fact("effigy-mounds", 1)],
        camera: cam("effigy-mounds"),
        actions: [{ label: "Peel back the forest", kind: "peel", value: "effigy-mounds" }],
      },
      {
        title: "A city of mounds",
        date: "Around 1100",
        body: [fact("cahokia", 0), fact("cahokia", 1)],
        camera: cam("cahokia"),
        actions: [{ label: "See the laser points", kind: "cloud", value: "cahokia" }],
      },
    ],
  },
  {
    id: "ground-that-moves",
    title: "Ground That Moves",
    subtitle: "Landslides and faults written into the forest floor.",
    when: "2,500 years ago – 2014",
    color: "#fb923c",
    docs: [siteDoc("oso", 0, "Dating historic activity at Oso site shows recurring major landslides"), siteDoc("toe-jam-hill", 1, "Late Holocene earthquakes on the Toe Jam Hill fault"), FS_FAULTS],
    chapters: [
      {
        title: "Oso",
        date: "March 2014",
        body: [fact("oso", 0), fact("oso", 1)],
        camera: cam("oso", -0.4),
        actions: [{ label: "Peel back the forest", kind: "peel", value: "oso" }],
      },
      {
        title: "Every 140 years",
        body: [fact("oso", 2), "In the lidar, the scars of those older slides show up and down the valley walls."],
        camera: cam("oso", -1),
        actions: [{ label: "Slope view", kind: "view", value: "slope" }],
      },
      {
        title: "The fault under the trees",
        body: [fact("toe-jam-hill", 2), fact("toe-jam-hill", 3)],
        camera: cam("toe-jam-hill"),
        actions: [{ label: "Peel back the forest", kind: "peel", value: "toe-jam-hill" }],
      },
    ],
  },
];
