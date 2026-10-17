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
    tagline: "A full-screen live globe: earthquakes, plates, active faults worldwide and erupting volcanoes — plus a time machine back to 1900, 3D slabs and guided stories.",
    status: "live",
    sources: ["USGS", "Smithsonian GVP", "PB2002"],
    glow: "from-rose-500/30 via-orange-400/20 to-amber-300/10",
  },
  {
    slug: "disaster-atlas",
    title: "Disaster Atlas",
    tagline: "Live: disasters worldwide and fire detections across the planet, plus NWS warnings, U.S. wildfires, hurricanes with their cones, today's tornado reports and flooding rivers — over FEMA's county risk index.",
    status: "live",
    sources: ["NOAA / NWS", "NIFC", "NASA FIRMS", "FEMA"],
    glow: "from-orange-500/30 via-red-400/20 to-rose-300/10",
  },
  {
    slug: "strange-earth",
    title: "Strange Earth",
    tagline: "Every confirmed impact crater at true size, 850+ U.S. oddities, a lens-swipe investigator back to 1880s survey maps, Ice Age lakes you can refill in 3D — and flyovers of real mysteries from Arizona to the Sahara.",
    status: "live",
    sources: ["Earth Impact Database", "Macrostrat", "USGS topo archive", "USGS 3DEP"],
    glow: "from-violet-500/30 via-fuchsia-400/20 to-pink-300/10",
  },
  {
    slug: "hidden-earth",
    title: "Hidden Earth",
    tagline: "The ground the way lidar sees it — trees stripped away: ancient mounds, hidden faults, old landslides and Civil War trenches, with a satellite-vs-lidar peel.",
    status: "live",
    sources: ["USGS 3DEP lidar", "NPS", "USGS"],
    glow: "from-emerald-500/30 via-teal-400/20 to-cyan-300/10",
  },
  {
    slug: "underground-usa",
    title: "Underground USA",
    tagline: "X-ray the country: the karst rock that hollows into caves, 14,000 caves worldwide (every one you can visit pinned exactly), and 3D dives through Mammoth, Carlsbad, Wind and Jewel.",
    status: "live",
    sources: ["USGS karst map", "Wikidata", "USGS 3DEP"],
    glow: "from-slate-500/30 via-indigo-400/20 to-sky-300/10",
  },
  {
    slug: "fossil-atlas",
    title: "Prehistoric USA",
    tagline: "Fossil finds, ancient coastlines and how America looked millions of years ago.",
    status: "planned",
    sources: ["Paleobiology Database", "Macrostrat"],
    glow: "from-lime-500/30 via-green-400/20 to-emerald-300/10",
  },
  {
    slug: "lost-mines",
    title: "Lost Mines",
    tagline: "Gold rushes, historic mines and mineral districts, from the archives.",
    status: "planned",
    sources: ["USGS MRDS", "USMIN"],
    glow: "from-yellow-500/30 via-amber-400/20 to-orange-300/10",
  },
  {
    slug: "ghost-towns",
    title: "Ghost Towns",
    tagline: "Abandoned towns, drowned communities and forgotten settlements, rising and fading over time.",
    status: "planned",
    sources: ["USGS GNIS", "Historical topo maps"],
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
    tagline: "80,000 charted wrecks worldwide, 30,000 named ones, two world wars of sinkings day by day, the sanctuaries that protect them — and dives to the Titanic, Monitor and more.",
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
