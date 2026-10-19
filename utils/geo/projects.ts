/* ------------------------------------------------------------------ */
/*  The atlas hub's catalogue. Each project is its own route under     */
/*  /atlas and reuses components/atlas + utils/geo + the geo library.  */
/* ------------------------------------------------------------------ */

export type AtlasStatus = "live" | "planned";

export interface AtlasProject {
  slug: string;
  title: string;
  tagline: string;
  status: AtlasStatus;
  /** How far the data reaches, said plainly on the hub card */
  coverage?: string;
  /** Main data sources (planned ones are the intended sources) */
  sources: string[];
  /** Tailwind gradient for the card glow */
  glow: string;
}

export const ATLAS_PROJECTS: AtlasProject[] = [
  {
    slug: "earth-alive",
    title: "Earth Alive",
    tagline: "Earthquakes worldwide as USGS reports them, live — with the world's volcanoes and faults, and 4,000 years of great quakes and tsunamis.",
    status: "live",
    coverage: "Worldwide",
    sources: ["USGS", "Smithsonian GVP", "NOAA NCEI", "GEM faults", "PB2002"],
    glow: "from-rose-500/30 via-orange-400/20 to-amber-300/10",
  },
  {
    slug: "disaster-atlas",
    title: "Disaster Atlas",
    tagline: "Cyclones, satellite fire detections and disaster alerts worldwide, with U.S. warnings, wildfires, tornadoes and floods in depth.",
    status: "live",
    coverage: "World feeds · U.S. detail",
    sources: ["GDACS", "NASA FIRMS", "IBTrACS", "NOAA / NWS", "NIFC", "FEMA"],
    glow: "from-orange-500/30 via-red-400/20 to-rose-300/10",
  },
  {
    slug: "strange-earth",
    title: "Strange Earth",
    tagline: "Every confirmed impact crater, 4,000 strange places in 120 countries, and the bedrock under any spot on Earth.",
    status: "live",
    coverage: "Worldwide",
    sources: ["Earth Impact Database", "Wikidata", "Macrostrat", "Geoscience Australia", "UNESCO"],
    glow: "from-violet-500/30 via-fuchsia-400/20 to-pink-300/10",
  },
  {
    slug: "hidden-earth",
    title: "Hidden Earth",
    tagline: "See beneath the tree canopy with lidar, from ancient earthworks to hidden faults — across the U.S. and much of Europe.",
    status: "live",
    coverage: "U.S. & Europe",
    sources: ["USGS 3DEP lidar", "Environment Agency", "AHN", "IGN", "swisstopo", "Kartverket"],
    glow: "from-emerald-500/30 via-teal-400/20 to-cyan-300/10",
  },
  {
    slug: "underground",
    title: "Underground World",
    tagline: "Caves and karst on every continent — 13,000+ mapped caves, the world karst map, and 3D dives below the surface.",
    status: "live",
    coverage: "Worldwide",
    sources: ["WHYMAP WOKAM", "Wikidata", "OpenStreetMap", "UNESCO", "USGS karst map"],
    glow: "from-slate-500/30 via-indigo-400/20 to-sky-300/10",
  },
  {
    slug: "fossil-atlas",
    title: "Prehistoric Earth",
    tagline: "278,000 fossil sites on every continent, dinosaur country, and a time machine back 540 million years to the seas and continents they lived in.",
    status: "live",
    coverage: "Worldwide",
    sources: ["Paleobiology Database", "PALEOMAP", "GPlates", "UNESCO", "National Park Service"],
    glow: "from-lime-500/30 via-green-400/20 to-emerald-300/10",
  },
  {
    slug: "lost-mines",
    title: "Lost Mines",
    tagline: "304,000 mines in 165 countries, from Potosí's silver mountain to the gold rushes — plus the shafts and adits on the old U.S. topo maps.",
    status: "live",
    coverage: "Worldwide · U.S. detail",
    sources: ["USGS MRDS", "UNESCO", "USMIN", "MSHA"],
    glow: "from-yellow-500/30 via-amber-400/20 to-orange-300/10",
  },
  {
    slug: "ghost-towns",
    title: "Ghost Towns",
    tagline: "8,500 ghost towns and abandoned villages in 99 countries, 10,700 vanished U.S. places, and towns lost beneath reservoirs.",
    status: "live",
    coverage: "Worldwide · U.S. detail",
    sources: ["Wikidata", "OpenStreetMap", "USGS GNIS", "UNESCO", "English Heritage"],
    glow: "from-stone-500/30 via-zinc-400/20 to-neutral-300/10",
  },
  {
    slug: "forgotten-infrastructure",
    title: "Forgotten Infrastructure",
    tagline: "Old rail corridors, historic bridges and disused canals over modern imagery.",
    status: "planned",
    sources: ["National Bridge Inventory", "Historical topo maps"],
    glow: "from-sky-500/30 via-blue-400/20 to-indigo-300/10",
  },
  {
    slug: "shipwrecks",
    title: "Shipwrecks",
    tagline: "79,000 charted wrecks worldwide, 7,400 historic wrecks around Australia and New Zealand, and 30,000 named ships — Titanic to the Batavia.",
    status: "live",
    coverage: "Worldwide",
    sources: ["NOAA charts", "UK Hydrographic Office", "Australasian UCH Database", "Wikidata"],
    glow: "from-cyan-500/30 via-sky-400/20 to-blue-300/10",
  },
  {
    slug: "america-through-time",
    title: "America Through Time",
    tagline: "Battles, forts, railways and borders rebuilt on a timeline.",
    status: "planned",
    sources: ["Historical boundaries", "NPS"],
    glow: "from-red-500/30 via-rose-400/20 to-indigo-300/10",
  },
];
