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
  /** Main data sources (planned ones are the intended sources) */
  sources: string[];
  /** Tailwind gradient for the card glow */
  glow: string;
}

export const ATLAS_PROJECTS: AtlasProject[] = [
  {
    slug: "earth-alive",
    title: "Earth Alive",
    tagline: "Earthquakes, volcanoes, faults, and a century of seismic history on one globe.",
    status: "live",
    sources: ["USGS", "Smithsonian GVP", "PB2002"],
    glow: "from-rose-500/30 via-orange-400/20 to-amber-300/10",
  },
  {
    slug: "disaster-atlas",
    title: "Disaster Atlas",
    tagline: "Live storms, fires, warnings, and flood conditions across the United States and beyond.",
    status: "live",
    sources: ["NOAA / NWS", "NIFC", "NASA FIRMS", "FEMA"],
    glow: "from-orange-500/30 via-red-400/20 to-rose-300/10",
  },
  {
    slug: "strange-earth",
    title: "Strange Earth",
    tagline: "Impact craters, unusual places, historic maps, and landscapes shaped by deep time.",
    status: "live",
    sources: ["Earth Impact Database", "Macrostrat", "USGS topo archive", "USGS 3DEP"],
    glow: "from-violet-500/30 via-fuchsia-400/20 to-pink-300/10",
  },
  {
    slug: "hidden-earth",
    title: "Hidden Earth",
    tagline: "See beneath the tree canopy with lidar, from ancient earthworks to hidden faults.",
    status: "live",
    sources: ["USGS 3DEP lidar", "NPS", "USGS"],
    glow: "from-emerald-500/30 via-teal-400/20 to-cyan-300/10",
  },
  {
    slug: "underground",
    title: "Underground World",
    tagline: "Caves and karst on every continent — 13,000+ mapped caves, the world karst map, and 3D dives below the surface.",
    status: "live",
    sources: ["WHYMAP WOKAM", "USGS karst map", "Wikidata", "OpenStreetMap"],
    glow: "from-slate-500/30 via-indigo-400/20 to-sky-300/10",
  },
  {
    slug: "fossil-atlas",
    title: "Prehistoric Earth",
    tagline: "278,000 fossil sites on every continent, dinosaur country, and a time machine back 540 million years to the seas and continents they lived in.",
    status: "live",
    sources: ["Paleobiology Database", "PALEOMAP", "GPlates", "National Park Service"],
    glow: "from-lime-500/30 via-green-400/20 to-emerald-300/10",
  },
  {
    slug: "lost-mines",
    title: "Lost Mines",
    tagline: "304,000 mines in 165 countries, the shafts and adits on the old U.S. topo maps, and the gold rushes that started it all.",
    status: "live",
    sources: ["USGS MRDS", "USMIN", "MSHA"],
    glow: "from-yellow-500/30 via-amber-400/20 to-orange-300/10",
  },
  {
    slug: "ghost-towns",
    title: "Ghost Towns",
    tagline: "Vanished settlements, historic ghost towns, and communities lost beneath reservoirs.",
    status: "live",
    sources: ["USGS GNIS", "Wikidata", "Wikipedia"],
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
    tagline: "Charted wrecks, maritime history, protected sanctuaries, and notable ships.",
    status: "live",
    sources: ["NOAA charts", "NOAA Sanctuaries", "Wikidata"],
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
