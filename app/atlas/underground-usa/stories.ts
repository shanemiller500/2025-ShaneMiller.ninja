import type { AtlasStory, StoryDoc } from "@/components/atlas/story";
import { SOURCES } from "./featured";

/* ------------------------------------------------------------------ */
/*  Underground USA's guided stories. Every claim matches a source in  */
/*  the story's `docs` (NPS / USGS pages, fact-checked October 2026);  */
/*  the "about 22%" figure is measured from our baked copy of the USGS */
/*  karst map; rock units come from the USGS map service.              */
/*                                                                     */
/*  Action kinds:                                                      */
/*    dive    open the 3D reconstruction (value = Wikidata id)         */
/*    xray    switch the map to X-ray                                  */
/*    relief  show USGS 3DEP shaded relief (1 m lidar up close)        */
/*    sinkholes  show FL subsidence reports + KY mapped sinkholes      */
/*    aquifers   show the USGS karst aquifers                          */
/* ------------------------------------------------------------------ */

export type UndergroundAction = "dive" | "xray" | "relief" | "sinkholes" | "aquifers";

const doc = (s: { label: string; url: string }, year?: number): StoryDoc => {
  const [source, ...title] = s.label.split(" · ");
  return { title: title.join(" · ") || s.label, url: s.url, source, year };
};

const KARST_MAP: StoryDoc = { title: "Karst in the United States: A Digital Map Compilation and Database (OFR 2014-1156)", url: "https://doi.org/10.3133/ofr20141156", source: "USGS · Weary & Doctor", year: 2014 };
const FLORIDAN: StoryDoc = { title: "Floridan aquifer system", url: "https://www.usgs.gov/mission-areas/water-resources/science/floridan-aquifer-system", source: "USGS Water Resources" };

export const UNDERGROUND_STORIES: AtlasStory<UndergroundAction>[] = [
  {
    id: "hollow-country",
    title: "A Hollow Country",
    subtitle: "About a fifth of the lower 48 sits on rock that water can hollow out.",
    when: "Now",
    color: "#22d3ee",
    docs: [KARST_MAP, FLORIDAN],
    chapters: [
      {
        title: "Rock that dissolves",
        body: [
          "Rainwater picks up carbon dioxide and turns faintly acidic. Over very long spans of time it dissolves limestone, dolomite, gypsum and salt, leaving sinkholes, springs, sinking streams — and caves. Geologists call this landscape karst.",
          "Measured from the USGS karst map, karst and cave-prone pseudokarst rock underlies about 22% of the lower 48 states.",
        ],
        camera: { center: [-96, 38.5], zoom: 3.4, pitch: 0, bearing: 0 },
        actions: [{ label: "X-ray the map", kind: "xray" }],
      },
      {
        title: "The limestone heartland",
        body: ["The great carbonate belts run through the Appalachians, the Interior Low Plateaus of Kentucky and Tennessee, and the Ozarks — classic cave country, home to Mammoth Cave."],
        camera: { center: [-87.5, 36.5], zoom: 5.2, pitch: 30, bearing: -10 },
      },
      {
        title: "Florida floats on limestone",
        body: [
          "Under Florida lies the Floridan aquifer: limestone and dolomite riddled with dissolved conduits. USGS calls it one of the most productive aquifers in the world — the main source of drinking water for almost 10 million people.",
          "The same dissolving rock is why sinkholes are a familiar hazard there.",
        ],
        camera: { center: [-82.4, 28.6], zoom: 5.8, pitch: 25, bearing: 0 },
        actions: [
          { label: "Show sinkhole reports", kind: "sinkholes" },
          { label: "Show karst aquifers", kind: "aquifers" },
        ],
      },
      {
        title: "Salt and gypsum",
        body: ["Evaporite rock — gypsum and salt left by ancient seas — dissolves much faster than limestone. On the USGS map, wide belts of it run under the southern Great Plains and the Southwest."],
        camera: { center: [-102, 33.5], zoom: 4.8, pitch: 20, bearing: 0 },
      },
      {
        title: "Not all caves are dissolved",
        body: ["In the volcanic West, flowing lava built tunnels of its own: lava tubes. Look for the orange basalt fields of Oregon, Idaho and northern California."],
        camera: { center: [-118.5, 43.2], zoom: 4.8, pitch: 20, bearing: 0 },
      },
    ],
  },
  {
    id: "mammoth",
    title: "Mammoth Cave",
    subtitle: "Rivers in the dark, and the longest cave known on Earth.",
    when: "Kentucky",
    color: "#22d3ee",
    docs: [doc(SOURCES.macaGeo), doc(SOURCES.macaFaq), doc(SOURCES.macaStats), KARST_MAP],
    chapters: [
      {
        title: "Above it: karst country",
        body: [
          "The land over Mammoth Cave is classic karst — sinkholes and sinking streams funnel rain straight down into the limestone.",
          "Turn on Kentucky's mapped sinkholes and the 1-meter lidar relief to see the dimpled ground for yourself.",
        ],
        camera: { center: [-86.02, 37.08], zoom: 11.6, pitch: 40, bearing: 0 },
        actions: [
          { label: "Show mapped sinkholes", kind: "sinkholes" },
          { label: "Show lidar relief", kind: "relief" },
        ],
      },
      {
        title: "Limestone under a sandstone roof",
        body: ["The cave is dissolved in Mississippian limestone — the Ste. Genevieve and St. Louis Limestones on the USGS map — under uplands capped by erosion-resistant sandstone."],
        camera: { center: [-86.1, 37.18], zoom: 10.2, pitch: 55, bearing: 30 },
      },
      {
        title: "More than 400 miles",
        body: [
          "Explorers have mapped more than 400 miles of passages here — the longest known cave system in the world — and the number keeps growing.",
          "Dive into a reconstruction built in its style: wide trunk passages, pits between levels, and a river at the bottom.",
        ],
        camera: { center: [-86.1, 37.18], zoom: 11, pitch: 60, bearing: 60 },
        actions: [{ label: "Dive into Mammoth (3D)", kind: "dive", value: "Q2666855" }],
      },
      {
        title: "Still at work",
        body: ["Underground rivers at the water table are still carving new passages today, while the Green River winds through the park above. Mammoth Cave became a national park in 1941 and a World Heritage Site in 1981."],
        camera: { center: [-86.15, 37.2], zoom: 9.6, pitch: 35, bearing: 0 },
      },
    ],
  },
  {
    id: "carlsbad",
    title: "Carved by Acid",
    subtitle: "Carlsbad Cavern and a fossil reef dissolved from below.",
    when: "New Mexico",
    color: "#f0abfc",
    docs: [doc(SOURCES.caveGeoPdf), doc(SOURCES.caveAtlas), doc(SOURCES.caveFacts), doc(SOURCES.caveBats)],
    chapters: [
      {
        title: "A reef in the desert",
        body: ["The Guadalupe Mountains hold a Permian reef complex, 260 to 270 million years old. Carlsbad Cavern is dissolved in its Capitan Limestone."],
        camera: { center: [-104.5, 32.15], zoom: 8.6, pitch: 50, bearing: -20 },
        actions: [{ label: "Show terrain relief", kind: "relief" }],
      },
      {
        title: "Dissolved from below",
        body: ["Most caves are carved by water seeping down. Here, hydrogen sulfide rising from deeply buried petroleum reservoirs reacted with groundwater to make sulfuric acid, which ate through the limestone."],
        camera: { center: [-104.441, 32.1771], zoom: 11, pitch: 60, bearing: 10 },
      },
      {
        title: "The Big Room",
        body: [
          "The Big Room trail begins about 750 feet underground. At 8.2 acres it is the largest readily accessible cave chamber in North America.",
          "On summer evenings, Brazilian free-tailed bats — the park's largest colony — spiral out of the natural entrance.",
        ],
        camera: { center: [-104.441, 32.1771], zoom: 12, pitch: 62, bearing: 60 },
        actions: [{ label: "Dive into Carlsbad (3D)", kind: "dive", value: "Q95742097" }],
      },
    ],
  },
  {
    id: "black-hills",
    title: "Boxwork & Jewels",
    subtitle: "Two great mazes under the Black Hills.",
    when: "South Dakota",
    color: "#a5b4fc",
    docs: [doc(SOURCES.wicaBirth), doc(SOURCES.wicaBox), doc(SOURCES.wicaWind), doc(SOURCES.wicaGeo), doc(SOURCES.jecaHome), doc(SOURCES.jecaDiscovery), doc(SOURCES.jecaMonument)],
    chapters: [
      {
        title: "The Black Hills",
        body: ["On the USGS map, Wind Cave and Jewel Cave are both dissolved in the Madison Group limestone of the Black Hills — and both rank among the longest caves on Earth."],
        camera: { center: [-103.65, 43.85], zoom: 7.6, pitch: 40, bearing: 0 },
        actions: [{ label: "X-ray the map", kind: "xray" }],
      },
      {
        title: "Wind Cave",
        body: [
          "On January 9, 1903, Wind Cave became the first cave in the world made a national park. It breathes: air rushes in or out of its entrance as the barometric pressure outside changes.",
          "Its walls carry boxwork — thin calcite blades in a honeycomb. Perhaps in no other cave in the world is boxwork so well formed and abundant.",
        ],
        camera: { center: [-103.4795, 43.558], zoom: 11, pitch: 55, bearing: 20 },
        actions: [{ label: "Dive into Wind Cave (3D)", kind: "dive", value: "Q9375154" }],
      },
      {
        title: "Jewel Cave",
        body: ["A few miles west, Jewel Cave was named for calcite crystals that sparkled like jewels in its discoverers' lanterns. Roosevelt proclaimed it a national monument in 1908; today more than 220 miles are mapped."],
        camera: { center: [-103.8294, 43.7294], zoom: 11, pitch: 55, bearing: -20 },
        actions: [{ label: "Dive into Jewel Cave (3D)", kind: "dive", value: "Q11725941" }],
      },
    ],
  },
  {
    id: "lava-tubes",
    title: "Tunnels of Fire",
    subtitle: "Caves left behind by rivers of lava.",
    when: "California",
    color: "#fb923c",
    docs: [doc(SOURCES.labeArticle), doc(SOURCES.labeGeo), doc(SOURCES.lavaTubes), doc(SOURCES.mushpot)],
    chapters: [
      {
        title: "A lava plateau",
        body: ["Lava Beds National Monument sits on the Medicine Lake shield volcano — the largest volcano by volume in the Cascade Range — and holds more than 700 caves."],
        camera: { center: [-121.55, 41.72], zoom: 9.2, pitch: 45, bearing: 0 },
      },
      {
        title: "How a lava tube forms",
        body: ["The surface of a lava river cools into a roof that insulates the lava still flowing inside. When the eruption ends, the lava drains out — leaving a tunnel."],
        camera: { center: [-121.5087, 41.7136], zoom: 12, pitch: 60, bearing: 30 },
        actions: [{ label: "Dive into Mushpot Cave (3D)", kind: "dive", value: "Q67166156" }],
      },
    ],
  },
];
