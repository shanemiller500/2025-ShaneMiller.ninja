import type { CaveSpec } from "@/components/atlas/caveGen";
import type { CaveProps } from "@/utils/geo/caves";

/* ------------------------------------------------------------------ */
/*  Featured caves: real places (Wikidata ids, coordinates from the    */
/*  baked cave layer), facts checked against the National Park         */
/*  Service, state parks and USGS — every fact carries its source —    */
/*  and the style of their illustrative 3D reconstruction.             */
/*  Fact-checked October 2026.                                         */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}

export interface Fact {
  text: string;
  source: Source;
}

export interface FeaturedCave {
  /** Wikidata id — matches caves.json */
  id: string;
  name: string;
  where: string;
  center: [number, number];
  tagline: string;
  facts: Fact[];
  /** official site */
  site: Source;
  /** what the reconstruction is modelled on, in plain words */
  styleNote: string;
  dive: Omit<CaveSpec, "seed">;
  accent: string;
}

/* ── sources ─────────────────────────────────────────────────────── */

const S = {
  macaFaq: { label: "NPS · Mammoth Cave FAQ", url: "https://www.nps.gov/maca/faqs.htm" },
  macaStats: { label: "NPS · Mammoth Cave park statistics", url: "https://www.nps.gov/maca/learn/management/statistics.htm" },
  macaGeo: { label: "NPS Geodiversity Atlas · Mammoth Cave", url: "https://www.nps.gov/articles/nps-geodiversity-atlas-mammoth-cave-national-park-kentucky.htm" },
  usgsKarst: { label: "USGS karst map (OFR 2014-1156)", url: "https://doi.org/10.3133/ofr20141156" },
  caveGeoPdf: { label: "NPS · Carlsbad Caverns cave geology", url: "https://www.nps.gov/cave/planyourvisit/upload/cave_geology.pdf" },
  caveFacts: { label: "NPS · Interesting facts about Carlsbad Caverns", url: "https://www.nps.gov/cave/learn/news/interesting-facts-about-carlsbad-caverns.htm" },
  caveTours: { label: "NPS · Explore the cavern at your own pace", url: "https://www.nps.gov/cave/planyourvisit/selfguided_tours.htm" },
  caveBats: { label: "NPS · Carlsbad Caverns bats", url: "https://www.nps.gov/cave/learn/nature/bats.htm" },
  caveAtlas: { label: "NPS Geodiversity Atlas · Carlsbad Caverns", url: "https://www.nps.gov/articles/nps-geodiversity-atlas-carlsbad-caverns-national-park-new-mexico.htm" },
  wicaBirth: { label: "NPS · Birth of a national park (Wind Cave)", url: "https://home.nps.gov/wica/learn/historyculture/birth-of-a-national-park-a-national-park-is-created.htm" },
  wicaBox: { label: "NPS · Wind Cave boxwork", url: "https://www.nps.gov/wica/learn/nature/speleothems-boxwork.htm" },
  wicaGeo: { label: "NPS · Wind Cave geology", url: "https://www.nps.gov/wica/learn/nature/wind-cave-geology.htm" },
  wicaWind: { label: "NPS · What causes the wind of Wind Cave", url: "https://www.nps.gov/wica/learn/education/what-causes-the-wind-of-wind-cave.htm" },
  jecaHome: { label: "NPS · Jewel Cave National Monument", url: "https://www.nps.gov/jeca/index.htm" },
  jecaDiscovery: { label: "NPS · Jewel Cave discovery & early history", url: "https://www.nps.gov/jeca/learn/historyculture/discovery-early-history.htm" },
  jecaMonument: { label: "NPS · Jewel Cave becoming a monument", url: "https://www.nps.gov/jeca/learn/historyculture/becoming-a-monument.htm" },
  kartHistory: { label: "Arizona State Parks · Kartchner history", url: "https://azstateparks.com/kartchner/explore/park-history" },
  kartCave: { label: "Arizona State Parks · Kartchner cave information", url: "https://azstateparks.com/kartchner/cave-tours/cave-information" },
  lurayStory: { label: "Luray Caverns · Our story", url: "https://luraycaverns.com/our-story/" },
  lurayOrgan: { label: "Luray Caverns · The Great Stalacpipe Organ", url: "https://luraycaverns.com/news/the-great-stalacpipe-organ/" },
  mushpot: { label: "NPS · Mushpot Cave", url: "https://www.nps.gov/places/mushpot-cave.htm" },
  labeCaving: { label: "NPS · Caving at Lava Beds", url: "https://www.nps.gov/labe/planyourvisit/caving.htm" },
  lavaTubes: { label: "NPS · Lava caves and tubes", url: "https://www.nps.gov/subjects/caves/lava-caves-or-tubes.htm" },
  labeGeo: { label: "NPS · Lava Beds geology", url: "https://www.nps.gov/labe/learn/nature/geology.htm" },
  labeArticle: { label: "NPS · California: Lava Beds National Monument", url: "https://www.nps.gov/articles/lavabeds.htm" },
  ticaFoundation: { label: "NPS · Timpanogos Cave foundation document", url: "https://www.nps.gov/tica/learn/management/foundation-document.htm" },
  ticaTrail: { label: "NPS · Hike the Cave Trail", url: "https://www.nps.gov/thingstodo/hike-the-cave-trail.htm" },
  ticaNature: { label: "NPS · Timpanogos Cave nature", url: "https://www.nps.gov/tica/learn/nature/index.htm" },
  orcaTimeline: { label: "NPS · Oregon Caves timeline", url: "https://www.nps.gov/orca/learn/historyculture/timeline.htm" },
  orcaAtlas: { label: "NPS Geodiversity Atlas · Oregon Caves", url: "https://www.nps.gov/articles/nps-geodiversity-atlas-oregon-caves-national-monument-preserve-oregon.htm" },
} satisfies Record<string, Source>;

export const SOURCES = S;

/* ── caves ───────────────────────────────────────────────────────── */

export const FEATURED: FeaturedCave[] = [
  {
    id: "Q2666855",
    name: "Mammoth Cave",
    where: "Kentucky · Mammoth Cave National Park",
    center: [-86.1, 37.1833],
    tagline: "The longest known cave system on Earth.",
    facts: [
      { text: "More than 400 miles of passages have been mapped — the longest known cave system in the world, and still growing as surveys continue.", source: S.macaFaq },
      { text: "Dissolved in Mississippian limestone (the Ste. Genevieve and St. Louis Limestones on the USGS map), under uplands capped by erosion-resistant sandstone.", source: S.macaGeo },
      { text: "Underground rivers at the water table are still carving new passages today; the Green River winds through the park above them.", source: S.macaGeo },
      { text: "Established as a national park on July 1, 1941, and named a World Heritage Site in 1981.", source: S.macaStats },
    ],
    site: { label: "Mammoth Cave National Park (NPS)", url: "https://www.nps.gov/maca/" },
    styleNote: "Stacked trunk passages on several levels, joined by pits, with a river on the lowest level.",
    dive: { style: "trunk", depth: 60, river: true, formations: 0.12, palette: "limestone" },
    accent: "#22d3ee",
  },
  {
    id: "Q95742097",
    name: "Carlsbad Cavern",
    where: "New Mexico · Carlsbad Caverns National Park",
    center: [-104.441, 32.1771],
    tagline: "A cathedral dissolved by sulfuric acid.",
    facts: [
      { text: "Dissolved not by ordinary rainwater but by sulfuric acid: hydrogen sulfide rising from deeply buried petroleum reservoirs reacted with groundwater and ate through the limestone.", source: S.caveGeoPdf },
      { text: "The cave lies in the Upper Permian Capitan Limestone, part of a fossil reef complex 260 to 270 million years old.", source: S.caveAtlas },
      { text: "The Big Room covers 8.2 acres — the largest readily accessible cave chamber in North America.", source: S.caveFacts },
      { text: "Its trail begins about 750 feet underground, reached by the natural entrance or by elevator.", source: S.caveTours },
      { text: "Its largest bat colony is Brazilian free-tailed bats, which spiral out of the natural entrance on summer evenings.", source: S.caveBats },
    ],
    site: { label: "Carlsbad Caverns National Park (NPS)", url: "https://www.nps.gov/cave/" },
    styleNote: "A switchback main corridor down from the natural entrance into a chain of great rooms crowded with formations.",
    dive: { style: "chamber", depth: 230, formations: 0.85, palette: "limestone" },
    accent: "#f0abfc",
  },
  {
    id: "Q9375154",
    name: "Wind Cave",
    where: "South Dakota · Wind Cave National Park",
    center: [-103.4795, 43.558],
    tagline: "A breathing maze lined with boxwork.",
    facts: [
      { text: "Made a national park on January 9, 1903 — the first cave in the world to become a national park.", source: S.wicaBirth },
      { text: "Famous for boxwork, thin calcite blades in a honeycomb pattern; perhaps in no other cave in the world is boxwork so well formed and abundant.", source: S.wicaBox },
      { text: "It breathes: air rushes in or out of the entrance as the outside barometric pressure changes.", source: S.wicaWind },
      { text: "About 167 miles of known passages lie under just 1.25 square miles of land — a dense three-dimensional maze.", source: S.wicaGeo },
    ],
    site: { label: "Wind Cave National Park (NPS)", url: "https://www.nps.gov/wica/" },
    styleNote: "A 3D lattice of narrow passages on several levels, walls latticed with boxwork fins.",
    dive: { style: "maze", depth: 40, boxwork: true, formations: 0.04, palette: "limestone" },
    accent: "#a5b4fc",
  },
  {
    id: "Q11725941",
    name: "Jewel Cave",
    where: "South Dakota · Jewel Cave National Monument",
    center: [-103.8294, 43.7294],
    tagline: "A maze of glittering calcite crystal.",
    facts: [
      { text: "With over 220 miles of mapped and surveyed passages, it is one of the longest caves in the world.", source: S.jecaHome },
      { text: "Found in 1900 by the Michaud brothers, it was named for calcite crystals that sparkled like jewels in their lantern light.", source: S.jecaDiscovery },
      { text: "Proclaimed a national monument by Theodore Roosevelt on February 7, 1908.", source: S.jecaMonument },
    ],
    site: { label: "Jewel Cave National Monument (NPS)", url: "https://www.nps.gov/jeca/" },
    styleNote: "A multi-level maze of narrow passages with crystal-lined walls.",
    dive: { style: "maze", depth: 55, crystals: true, formations: 0.06, palette: "marble" },
    accent: "#e0f2fe",
  },
  {
    id: "Q387762",
    name: "Kartchner Caverns",
    where: "Arizona · Kartchner Caverns State Park",
    center: [-110.3472, 31.8375],
    tagline: "A living cave kept secret for years.",
    facts: [
      { text: "Discovered in November 1974 by cavers Gary Tenen and Randy Tufts, who kept it secret until 1978 to protect it.", source: S.kartHistory },
      { text: "A “live” cave: its formations are still growing.", source: S.kartCave },
      { text: "Opened to the public in November 1999 as an Arizona state park.", source: S.kartHistory },
    ],
    site: { label: "Kartchner Caverns State Park", url: "https://azstateparks.com/kartchner" },
    styleNote: "Large, highly decorated rooms joined by short passages.",
    dive: { style: "chamber", depth: 35, formations: 1, palette: "limestone", scale: 0.7 },
    accent: "#fda4af",
  },
  {
    id: "Q1476610",
    name: "Luray Caverns",
    where: "Virginia · Shenandoah Valley",
    center: [-78.4838, 38.6643],
    tagline: "The cave that plays music.",
    facts: [
      { text: "Discovered on August 13, 1878, when three men felt cold air rushing from a limestone sinkhole on a hot day.", source: S.lurayStory },
      { text: "Home of the Great Stalacpipe Organ (dedicated 1957), which plays music by striking tuned stalactites with rubber-tipped plungers.", source: S.lurayOrgan },
    ],
    site: { label: "Luray Caverns", url: "https://luraycaverns.com/" },
    styleNote: "Big decorated chambers, thick with stalactites and columns.",
    dive: { style: "chamber", depth: 45, formations: 1, palette: "limestone", scale: 0.8 },
    accent: "#fde68a",
  },
  {
    id: "Q67166156",
    name: "Mushpot Cave",
    where: "California · Lava Beds National Monument",
    center: [-121.5087, 41.7136],
    tagline: "Walk through a tunnel that lava drained out of.",
    facts: [
      { text: "The only cave in Lava Beds with lights and interpretive signs — about 770 feet long, a short walk from the visitor center.", source: S.mushpot },
      { text: "Lava Beds National Monument holds more than 700 caves, most of them open to the public.", source: S.labeArticle },
      { text: "The monument sits on the Medicine Lake shield volcano — the largest volcano by volume in the Cascade Range.", source: S.labeGeo },
      { text: "Lava tubes form when the surface of a lava river cools into an insulating roof while lava keeps flowing inside; when the eruption ends, the lava drains out and leaves the tunnel.", source: S.lavaTubes },
    ],
    site: { label: "Lava Beds National Monument (NPS)", url: "https://www.nps.gov/labe/" },
    styleNote: "One long, round, flat-floored lava tube just under the surface, with collapsed skylights.",
    dive: { style: "lavatube", depth: 10, formations: 0.05, palette: "basalt" },
    accent: "#fb923c",
  },
  {
    id: "Q1456525",
    name: "Timpanogos Cave",
    where: "Utah · Timpanogos Cave National Monument",
    center: [-111.7094, 40.4406],
    tagline: "Gravity-defying helictites, high on a canyon wall.",
    facts: [
      { text: "Three caves — Hansen, Middle and Timpanogos — joined by tunnels blasted in the 1930s, so visitors walk through all three.", source: S.ticaFoundation },
      { text: "Known for its high abundance of helictites — delicate formations that twist in every direction.", source: S.ticaNature },
      { text: "Reached by a 1.5-mile trail that climbs about 1,100 vertical feet.", source: S.ticaTrail },
    ],
    site: { label: "Timpanogos Cave National Monument (NPS)", url: "https://www.nps.gov/tica/" },
    styleNote: "Small, crystal-rich chambers joined by passages.",
    dive: { style: "chamber", depth: 25, formations: 0.9, crystals: true, palette: "limestone", scale: 0.55 },
    accent: "#bef264",
  },
  {
    id: "Q1187702",
    name: "Oregon Caves",
    where: "Oregon · Oregon Caves National Monument and Preserve",
    center: [-123.4058, 42.0956],
    tagline: "The “Marble Halls of Oregon.”",
    facts: [
      { text: "A solution cave dissolved in marble — promoted in 1907 as the “Marble Halls of Oregon.”", source: S.orcaAtlas },
      { text: "Proclaimed a national monument by President Taft on July 12, 1909.", source: S.orcaTimeline },
    ],
    site: { label: "Oregon Caves National Monument and Preserve (NPS)", url: "https://www.nps.gov/orca/" },
    styleNote: "Marble chambers and winding passages.",
    dive: { style: "chamber", depth: 30, formations: 0.7, palette: "marble", scale: 0.6 },
    accent: "#c4b5fd",
  },
];

export const featuredById = (id: string | null | undefined) => FEATURED.find((f) => f.id === id) ?? null;

/** A dive for any toured cave: featured caves get their tuned style, others a sensible default. */
export function diveSpecFor(cave: Pick<CaveProps, "id" | "kind">): CaveSpec {
  const f = featuredById(cave.id);
  if (f) return { seed: f.id, ...f.dive };
  if (cave.kind === "lava") return { seed: cave.id, style: "lavatube", depth: 10, formations: 0.05, palette: "basalt" };
  return { seed: cave.id, style: "chamber", depth: 40, formations: 0.7, palette: "limestone", scale: 0.7 };
}

export const STYLE_LABEL: Record<CaveSpec["style"], string> = {
  trunk: "Multi-level trunk passages",
  chamber: "Great chambers",
  maze: "3D maze",
  lavatube: "Lava tube",
};
