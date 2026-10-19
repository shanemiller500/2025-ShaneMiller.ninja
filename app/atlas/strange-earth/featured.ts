/* ------------------------------------------------------------------ */
/*  Strange Earth's featured anomalies. Every fact carries the page it */
/*  came from (NPS, USGS, state surveys; abroad UNESCO and NASA) — check the source */
/*  before adding or changing one; several "well-known" claims about  */
/*  these places turned out to be wrong or unsupported.                */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}

export interface Fact {
  text: string;
  source: Source;
}

/** How settled the science is. */
export type Verdict = "solved" | "debated" | "unexplained";

export const VERDICTS: Record<Verdict, { label: string; color: string }> = {
  solved: { label: "Explained", color: "#34d399" },
  debated: { label: "Still debated", color: "#fbbf24" },
  unexplained: { label: "Unexplained", color: "#f472b6" },
};

export interface Anomaly {
  id: string;
  name: string;
  where: string;
  tagline: string;
  verdict: Verdict;
  accent: string;
  /** [lng, lat] */
  center: [number, number];
  /** 3D flyover camera */
  fly: { zoom: number; pitch: number; bearing: number };
  /** Investigate mode: what to compare across the lenses */
  look: string;
  /** Wikipedia article (for the photo) */
  wiki: string;
  facts: Fact[];
}

const S = {
  usgsMeteor: { label: "USGS", url: "https://www.usgs.gov/media/images/aerial-view-meteor-crater-color-coconino-county-arizona" },
  usgsChesapeake: { label: "USGS FS 49-98", url: "https://pubs.usgs.gov/fs/fs49-98/" },
  npsUpheaval: { label: "NPS", url: "https://www.nps.gov/places/upheaval-dome-overlook-a-mystery.htm" },
  npsUpheavalArticle: { label: "NPS", url: "https://www.nps.gov/articles/cany-upheaval-dome.htm" },
  eidList: { label: "Earth Impact Database", url: "https://en.wikipedia.org/wiki/List_of_impact_structures_on_Earth" },
  npsRacetrack: { label: "NPS", url: "https://www.nps.gov/deva/planyourvisit/the-racetrack.htm" },
  npsDetoFaq: { label: "NPS", url: "https://www.nps.gov/deto/faqs.htm" },
  npsDetoFormation: { label: "NPS", url: "https://www.nps.gov/deto/learn/nature/tower-formation.htm" },
  npsWhsaSize: { label: "NPS", url: "https://www.nps.gov/whsa/learn/management/white-sands-purpose-and-significance-statement.htm" },
  npsWhsaGypsum: { label: "NPS", url: "https://www.nps.gov/whsa/learn/gypsum.htm" },
  npsArches: { label: "NPS", url: "https://www.nps.gov/arch/learn/nature/geologicformations.htm" },
  npsCrmo: { label: "NPS", url: "https://www.nps.gov/crmo/learn/nature/geologicactivity.htm" },
  dnrMima: { label: "WA DNR", url: "https://dnr.wa.gov/natural-areas/natural-area-preserves/mima-mounds-natural-area-preserve" },
  dnrMimaPanel: { label: "WA DNR", url: "https://dnr.wa.gov/sites/default/files/2025-03/amp_mima_mounds_mistery.pdf" },
  blmBonneville: { label: "BLM", url: "https://www.blm.gov/visit/bonneville-salt-flats" },
  unescoVredefort: { label: "UNESCO", url: "https://whc.unesco.org/en/list/1162/" },
  unescoCauseway: { label: "UNESCO", url: "https://whc.unesco.org/en/list/369/" },
  nasaRichat: { label: "NASA Earth Observatory", url: "https://science.nasa.gov/earth/earth-observatory/eyeing-the-richat-structure/" },
  unescoUluru: { label: "UNESCO", url: "https://whc.unesco.org/en/list/447/" },
  unescoGoreme: { label: "UNESCO", url: "https://whc.unesco.org/en/list/357/" },
  unescoDanxia: { label: "UNESCO", url: "https://whc.unesco.org/en/list/1335/" },
} satisfies Record<string, Source>;

export const ANOMALIES: Anomaly[] = [
  {
    id: "meteor-crater",
    look: "Bare earth shows the raised rim and the apron of debris around it; the old topo draws the bowl as tight rings of contours.",
    name: "Meteor Crater",
    where: "Coconino County, Arizona",
    tagline: "A bowl 1.2 km wide, punched into the Arizona plateau by an iron-nickel meteorite.",
    verdict: "solved",
    accent: "#fef08a",
    center: [-111.0225, 35.0275],
    fly: { zoom: 14, pitch: 62, bearing: 20 },
    wiki: "Meteor_Crater",
    facts: [
      { text: "About 1.2 km (¾ mile) across, blasted out roughly 50,000 years ago.", source: S.usgsMeteor },
      { text: "The impactor was an iron-nickel meteorite about 30 m across, weighing roughly 100,000 tons.", source: S.usgsMeteor },
      { text: "The bowl is about 180 m deep, ringed by a raised rim and a blanket of rock thrown out by the blast.", source: S.usgsMeteor },
    ],
  },
  {
    id: "chesapeake",
    look: "Look for anything at all — there's nothing. The crater is buried 300–500 m down, invisible from above.",
    name: "Chesapeake Bay Impact",
    where: "Under the mouth of Chesapeake Bay, Virginia",
    tagline: "A giant impact crater hidden under the mouth of the bay.",
    verdict: "solved",
    accent: "#fb7185",
    center: [-76.017, 37.283],
    fly: { zoom: 8.2, pitch: 45, bearing: -15 },
    wiki: "Chesapeake_Bay_impact_crater",
    facts: [
      { text: "A comet or asteroid struck here about 35 million years ago, leaving a crater roughly 85 km (53 miles) wide.", source: S.usgsChesapeake },
      { text: "It lies buried 300–500 m beneath younger sediment — invisible at the surface.", source: S.usgsChesapeake },
      { text: "The impact left behind a pocket of unusually salty groundwater, which matters for wells in the region.", source: S.usgsChesapeake },
    ],
  },
  {
    id: "upheaval-dome",
    look: "Switch to geology: the rock layers form rings around the centre, like a bullseye.",
    name: "Upheaval Dome",
    where: "Island in the Sky, Canyonlands NP, Utah",
    tagline: "A bullseye of rock layers bent upward and broken in a ring.",
    verdict: "debated",
    accent: "#fbbf24",
    center: [-109.9283, 38.4369],
    fly: { zoom: 13.6, pitch: 60, bearing: 35 },
    wiki: "Upheaval_Dome",
    facts: [
      { text: "Across about 3 miles (5 km), rock layers that lie flat in the rest of the park are pushed up into a dome, ringed by a trough of down-bent layers.", source: S.npsUpheavalArticle },
      { text: "Two theories are hotly debated: a salt bubble that rose and was eroded away, or a meteorite about a third of a mile wide that struck roughly 60 million years ago.", source: S.npsUpheavalArticle },
      { text: "Recent research leans toward the impact — but questions remain.", source: S.npsUpheavalArticle },
      { text: "The Earth Impact Database already lists it as a confirmed impact structure, which is why its ring shows on the crater layer.", source: S.eidList },
    ],
  },
  {
    id: "racetrack",
    look: "Satellite: the playa's flat, pale floor; zoom right in to hunt for rocks and their trails.",
    name: "Racetrack Playa",
    where: "Death Valley NP, California",
    tagline: "Rocks that slide across a dry lakebed, leaving trails behind them.",
    verdict: "solved",
    accent: "#e2e8f0",
    center: [-117.5627, 36.6813],
    fly: { zoom: 13.2, pitch: 58, bearing: -25 },
    wiki: "Racetrack_Playa",
    facts: [
      { text: "Rocks on this flat, dry lakebed move on their own and leave long tracks in the mud.", source: S.npsRacetrack },
      { text: "Reported in 2014: when a shallow pond on the playa freezes, floating ice sheets break up and light winds of about 10 mph push them — shoving the rocks along through the mud.", source: S.npsRacetrack },
      { text: "Not quite closed: nobody has yet watched the biggest rocks move.", source: S.npsRacetrack },
    ],
  },
  {
    id: "devils-tower",
    look: "Bare earth: the tower's steep sides rise out of gentle rolling ground.",
    name: "Devils Tower",
    where: "Crook County, Wyoming",
    tagline: "A tower of cooled magma, left standing as the land around it wore away.",
    verdict: "debated",
    accent: "#a78bfa",
    center: [-104.7146, 44.5902],
    fly: { zoom: 14.2, pitch: 64, bearing: 0 },
    wiki: "Devils_Tower",
    facts: [
      { text: "The first national monument in the U.S., proclaimed in 1906.", source: S.npsDetoFaq },
      { text: "Made of phonolite porphyry — magma that cooled underground and was exposed as the softer rock around it eroded away.", source: S.npsDetoFormation },
      { text: "Exactly how that magma body formed is still argued over; geologists have proposed several competing explanations.", source: S.npsDetoFormation },
    ],
  },
  {
    id: "white-sands",
    look: "Satellite vs bare earth: the white dunefield and the ripple of dune crests under it.",
    name: "White Sands",
    where: "Tularosa Basin, New Mexico",
    tagline: "Brilliant white dunes made of gypsum, a mineral that dissolves in water.",
    verdict: "solved",
    accent: "#f8fafc",
    center: [-106.27, 32.8],
    fly: { zoom: 11.2, pitch: 55, bearing: 40 },
    wiki: "White_Sands_National_Park",
    facts: [
      { text: "The world's largest gypsum dunefield — over 275 square miles, big enough that astronauts use it as a landmark from space.", source: S.npsWhsaSize },
      { text: "Gypsum dissolves in water, which is why gypsum sand is so rare anywhere else.", source: S.npsWhsaGypsum },
    ],
  },
  {
    id: "arches",
    look: "Bare earth: rows of parallel sandstone fins — the walls the arches are carved from.",
    name: "Arches",
    where: "Arches NP, Utah",
    tagline: "More than two thousand stone arches in one park.",
    verdict: "solved",
    accent: "#fb923c",
    center: [-109.4994, 38.7436],
    fly: { zoom: 14.4, pitch: 62, bearing: -30 },
    wiki: "Arches_National_Park",
    facts: [
      { text: "Over 2,000 documented natural stone arches.", source: S.npsArches },
      { text: "Most are carved from Entrada Sandstone: water dissolves the cement holding the grains together, and ice pries open the cracks.", source: S.npsArches },
    ],
  },
  {
    id: "craters-of-the-moon",
    look: "Satellite and bare earth: dark young lava flows and cinder cones strung out along the rift.",
    name: "Craters of the Moon",
    where: "Snake River Plain, Idaho",
    tagline: "A sea of young black lava along a crack in the crust.",
    verdict: "solved",
    accent: "#f43f5e",
    center: [-113.5166, 43.4166],
    fly: { zoom: 11.8, pitch: 58, bearing: 15 },
    wiki: "Craters_of_the_Moon_National_Monument_and_Preserve",
    facts: [
      { text: "Eight major eruptive periods built this lava field, from about 15,000 to about 2,000 years ago.", source: S.npsCrmo },
      { text: "The lava came up along the Great Rift, a 52-mile-long set of cracks in the Earth's crust.", source: S.npsCrmo },
    ],
  },
  {
    id: "mima-mounds",
    look: "Bare earth at full zoom: the mounds show up as a dimpled, egg-carton texture across the prairie.",
    name: "Mima Mounds",
    where: "Thurston County, Washington",
    tagline: "A prairie covered in look-alike mounds. Nobody knows why.",
    verdict: "unexplained",
    accent: "#a3e635",
    center: [-123.047, 46.905],
    fly: { zoom: 15.2, pitch: 52, bearing: 10 },
    wiki: "Mima_mounds",
    facts: [
      { text: "More than 30 explanations have been proposed for how the mounds formed — none has been proven.", source: S.dnrMimaPanel },
      { text: "Leading ideas: pocket gophers building nest mounds, debris settling out of melting glacier ice, permafrost cracking, or earthquake shaking.", source: S.dnrMimaPanel },
      { text: "Mounds are 8–40 feet across and 1–7 feet high, about 8 to 10 per acre — and they sit only on gravel left by Ice Age meltwater.", source: S.dnrMimaPanel },
      { text: "A paved, accessible half-mile loop trail runs through the preserve.", source: S.dnrMima },
    ],
  },
  {
    id: "bonneville",
    look: "Old topo vs satellite: compare where the old surveyors drew the salt flats with the crust today.",
    name: "Bonneville Salt Flats",
    where: "Tooele County, Utah",
    tagline: "The salty floor of a vanished Ice Age lake.",
    verdict: "solved",
    accent: "#bae6fd",
    center: [-113.89, 40.76],
    fly: { zoom: 10.6, pitch: 50, bearing: -10 },
    wiki: "Bonneville_Salt_Flats",
    facts: [
      { text: "A remnant of Lake Bonneville, which covered over a third of Utah between about 32,000 and 10,000 years ago.", source: S.blmBonneville },
      { text: "The salt crust is almost 5 feet thick in places near the center, thinning to under an inch at the edges.", source: S.blmBonneville },
    ],
  },
  /* ── beyond the U.S. (lidar and old topo maps are U.S.-only; satellite and geology work anywhere) ── */
  {
    id: "vredefort",
    look: "Satellite + geology: the crater itself is long eroded — follow the curving ridges of the Vredefort Dome, the rings left around its uplifted centre.",
    name: "Vredefort Dome",
    where: "Free State & North West, South Africa",
    tagline: "The oldest and largest known impact structure on Earth.",
    verdict: "solved",
    accent: "#fca5a5",
    center: [27.5, -27.0],
    fly: { zoom: 9, pitch: 50, bearing: 0 },
    wiki: "Vredefort_impact_structure",
    facts: [
      { text: "Formed about 2,023 million years ago, the oldest and largest known meteorite impact structure on Earth — the site of the world's greatest known single release of energy.", source: S.unescoVredefort },
      { text: "Erosion has cut so deep that it exposes a full geological profile below the crater floor — the only place on Earth that does.", source: S.unescoVredefort },
      { text: "It lies about 120 km south-west of Johannesburg and became a World Heritage Site in 2005.", source: S.unescoVredefort },
    ],
  },
  {
    id: "richat",
    look: "Satellite: the bull's-eye of rings is obvious from orbit. Geology shows why — circular ridges of tougher rock eroding more slowly than the softer rings between.",
    name: "Richat Structure",
    where: "Adrar Plateau, Mauritania",
    tagline: "The “Eye of the Sahara” — once taken for an impact crater.",
    verdict: "solved",
    accent: "#fdba74",
    center: [-11.4, 21.124],
    fly: { zoom: 9.2, pitch: 45, bearing: 0 },
    wiki: "Richat_Structure",
    facts: [
      { text: "A 40-kilometre-wide formation of concentric ridges on the Adrar Plateau in northern Mauritania.", source: S.nasaRichat },
      { text: "First thought to be an impact crater, it is actually a deeply eroded geologic dome, pushed up by an igneous intrusion underground.", source: S.nasaRichat },
      { text: "Rock types eroded at different rates, leaving circular ridges known as cuestas. Gemini IV astronauts Ed White and James McDivitt photographed it from orbit.", source: S.nasaRichat },
    ],
  },
  {
    id: "giants-causeway",
    look: "Satellite: zoom to the shore to see the pavement of columns stepping into the sea; geology shows the Antrim plateau's lava flows behind it.",
    name: "Giant's Causeway",
    where: "County Antrim, Northern Ireland",
    tagline: "Some 40,000 basalt columns, cooled from lava 60 million years ago.",
    verdict: "solved",
    accent: "#94a3b8",
    center: [-6.5116, 55.2408],
    fly: { zoom: 15.5, pitch: 60, bearing: 330 },
    wiki: "Giant's_Causeway",
    facts: [
      { text: "Some 40,000 large, regularly shaped polygonal columns of basalt form a pavement into the sea.", source: S.unescoCauseway },
      { text: "The columns formed around 60 million years ago, making the coast a classic locality for the study of basaltic volcanism.", source: S.unescoCauseway },
      { text: "Legends of giants striding over the sea to Scotland grew up around it; it became a World Heritage Site in 1986.", source: S.unescoCauseway },
    ],
  },
  {
    id: "uluru",
    look: "Satellite + bare earth: one monolith rising alone out of the flat red plain, with the domes of Kata Tjuta to the west.",
    name: "Uluru & Kata Tjuta",
    where: "Northern Territory, Australia",
    tagline: "An immense monolith alone on the red sand plain.",
    verdict: "solved",
    accent: "#f97316",
    center: [131.0361, -25.345],
    fly: { zoom: 12.5, pitch: 60, bearing: 20 },
    wiki: "Uluru",
    facts: [
      { text: "Uluru, an immense monolith, and Kata Tjuta, the rock domes to its west, dominate the vast red sandy plain of central Australia.", source: S.unescoUluru },
      { text: "Both are part of the traditional belief system of one of the oldest human societies in the world. The traditional owners are the Anangu Aboriginal people.", source: S.unescoUluru },
      { text: "The park was formerly called Uluru (Ayers Rock – Mount Olga) National Park. Inscribed 1987.", source: S.unescoUluru },
    ],
  },
  {
    id: "cappadocia",
    look: "Bare earth + satellite: valleys carved into soft rock, crowded with eroded cones and pillars.",
    name: "Göreme & Cappadocia",
    where: "Nevşehir, Türkiye",
    tagline: "A valley sculpted by erosion, with churches and whole towns cut into the rock.",
    verdict: "solved",
    accent: "#fda4af",
    center: [34.8631, 38.6528],
    fly: { zoom: 13, pitch: 60, bearing: 30 },
    wiki: "Göreme_Historical_National_Park",
    facts: [
      { text: "The Göreme valley is a landscape entirely sculpted by erosion.", source: S.unescoGoreme },
      { text: "Its rock-hewn sanctuaries are unique evidence of Byzantine art after the Iconoclastic period.", source: S.unescoGoreme },
      { text: "Dwellings, troglodyte villages and underground towns survive from a way of life dating back to the 4th century. Inscribed 1985.", source: S.unescoGoreme },
    ],
  },
  {
    id: "danxia",
    look: "Satellite + bare earth: red cliffs, pillars and gorges breaking up the forested hills.",
    name: "China Danxia",
    where: "South-west China (six areas)",
    tagline: "Red sandstone cliffs, towers and gorges.",
    verdict: "solved",
    accent: "#ef4444",
    center: [106.043, 28.4219],
    fly: { zoom: 12, pitch: 55, bearing: 0 },
    wiki: "Danxia_landform",
    facts: [
      { text: "Danxia is the Chinese name for landscapes formed on red continental sedimentary beds, shaped by uplift and by weathering and erosion.", source: S.unescoDanxia },
      { text: "The World Heritage Site is six areas in subtropical south-west China — red cliffs, natural pillars, towers, ravines, valleys and waterfalls.", source: S.unescoDanxia },
      { text: "The rugged terrain has protected subtropical evergreen forests and about 400 rare or threatened species. Inscribed 2010.", source: S.unescoDanxia },
    ],
  },
];

export const anomalyById = (id: string) => ANOMALIES.find((a) => a.id === id);
