/* ------------------------------------------------------------------ */
/*  Featured shipwrecks. Every fact carries the NOAA / NPS page it     */
/*  came from (checked October 2026). Positions from Wikipedia; two    */
/*  wrecks have no published position and are marked approximate.     */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}
export interface Fact {
  text: string;
  source: Source;
}

export interface FeaturedWreck {
  id: string;
  name: string;
  where: string;
  lost: string;
  tagline: string;
  accent: string;
  /** [lng, lat] */
  center: [number, number];
  approximate?: boolean;
  zoom: number;
  wiki: string;
  facts: Fact[];
}

const S = {
  monitorShip: { label: "NOAA", url: "https://monitor.noaa.gov/shipwrecks/uss_monitor.html" },
  monitorAbout: { label: "NOAA", url: "https://monitor.noaa.gov/about/" },
  monitorMonument: { label: "NOAA", url: "https://monitor.noaa.gov/150th/news_monument.html" },
  arizona: { label: "NPS", url: "https://www.nps.gov/perl/learn/historyculture/uss-arizona.htm" },
  thunderBay: { label: "NOAA", url: "https://thunderbay.noaa.gov/about/welcome.html" },
  thunderBayMag: { label: "NOAA", url: "https://sanctuaries.noaa.gov/magazine/4/thunder-bay" },
  fitz: { label: "NOAA NWS", url: "https://vlab.noaa.gov/web/nws-heritage/-/tragedy-on-lake-superior-the-wreckage-of-the-edmund-fitzgerald" },
  mallows: { label: "NOAA", url: "https://sanctuaries.noaa.gov/news/nov19/community-celebrates-new-mallows-bay-potomac-river-national-marine-sanctuary.html" },
  sanPedro: { label: "NOAA", url: "https://floridakeys.noaa.gov/shipwrecktrail/sanpedro.html" },
  titanic: { label: "NOAA", url: "https://www.noaa.gov/office-of-general-counsel/gc-international-section/rms-titanic-history-and-significance" },
  independence: { label: "NOAA", url: "https://sanctuaries.noaa.gov/news/press/2015/independence-survey.html" },
  rio: { label: "NOAA", url: "https://sanctuaries.noaa.gov/shipwrecks/city-of-rio-de-janeiro" },
} satisfies Record<string, Source>;

export const FEATURED_WRECKS: FeaturedWreck[] = [
  {
    id: "titanic",
    name: "RMS Titanic",
    where: "North Atlantic, off Newfoundland",
    lost: "April 15, 1912",
    tagline: "The most famous shipwreck in the world, two and a half miles down.",
    accent: "#e2e8f0",
    center: [-49.9469, 41.7325],
    zoom: 6,
    wiki: "Titanic",
    facts: [
      { text: "After striking an iceberg, Titanic broke apart and sank on April 15, 1912, taking the lives of more than 1,500 passengers and crew.", source: S.titanic },
      { text: "The wreck was found on September 1, 1985, by a joint American–French expedition, about 350 nautical miles off Newfoundland.", source: S.titanic },
      { text: "It lies 12,500 feet (3,800 m) down — two and a half miles below the surface.", source: S.titanic },
    ],
  },
  {
    id: "monitor",
    name: "USS Monitor",
    where: "Off Cape Hatteras, North Carolina",
    lost: "December 31, 1862",
    tagline: "The Civil War ironclad that became the first national marine sanctuary.",
    accent: "#94a3b8",
    center: [-75.4064, 35.0017],
    zoom: 9,
    wiki: "USS_Monitor",
    facts: [
      { text: "Around 1:30 a.m. on December 31, 1862, Monitor's red signal lantern disappeared as she slipped beneath the waves off Cape Hatteras. Sixteen men were lost.", source: S.monitorMonument },
      { text: "The wreck lies in about 240 feet of water.", source: S.monitorShip },
      { text: "A Duke University expedition located it in 1973; on January 30, 1975, NOAA designated it the nation's first national marine sanctuary.", source: S.monitorAbout },
    ],
  },
  {
    id: "arizona",
    name: "USS Arizona",
    where: "Pearl Harbor, Oʻahu, Hawaiʻi",
    lost: "December 7, 1941",
    tagline: "A battleship that is also a grave.",
    accent: "#f43f5e",
    center: [-157.9501, 21.3648],
    zoom: 15,
    wiki: "USS_Arizona_(BB-39)",
    facts: [
      { text: "The ship is the final resting place for over 900 of the 1,177 crewmen who lost their lives on December 7, 1941.", source: S.arizona },
      { text: "The USS Arizona Memorial spans 184 feet across the sunken battleship, and the U.S. flag still flies from a pole attached to her severed mainmast.", source: S.arizona },
    ],
  },
  {
    id: "fitzgerald",
    name: "SS Edmund Fitzgerald",
    where: "Lake Superior, off Whitefish Point",
    lost: "November 10, 1975",
    tagline: "Lost with all hands in a Lake Superior storm.",
    accent: "#38bdf8",
    center: [-85.11, 46.9983],
    zoom: 9,
    wiki: "SS_Edmund_Fitzgerald",
    facts: [
      { text: "She left Superior, Wisconsin, on the evening of November 9, 1975, carrying 26,116 long tons of iron ore, and sank in a storm the next day. All 29 crew were lost.", source: S.fitz },
      { text: "Ships in the storm recorded winds of up to 50 knots and waves of almost 20 feet.", source: S.fitz },
      { text: "The wreck was found just north of Whitefish Point in southeast Lake Superior.", source: S.fitz },
    ],
  },
  {
    id: "thunder-bay",
    name: "Thunder Bay — “Shipwreck Alley”",
    where: "Lake Huron, off Alpena, Michigan",
    lost: "1800s–1900s",
    tagline: "Nearly 100 wrecks found in one stretch of Lake Huron — and at least 100 more still missing.",
    accent: "#22d3ee",
    center: [-83.253, 45.0034],
    zoom: 8,
    wiki: "Thunder_Bay_National_Marine_Sanctuary",
    facts: [
      { text: "Designated on October 7, 2000 — the first national marine sanctuary in the Great Lakes; its boundaries were expanded in 2014.", source: S.thunderBay },
      { text: "Known shipwrecks: 99. Still to be located: 100+.", source: S.thunderBayMag },
    ],
  },
  {
    id: "mallows-bay",
    name: "Mallows Bay Ghost Fleet",
    where: "Potomac River, Maryland",
    lost: "1920s",
    tagline: "The wooden bones of a World War I fleet, slowly returning to the Potomac.",
    accent: "#a3e635",
    center: [-77.2686, 38.4726],
    zoom: 14,
    wiki: "Mallows_Bay",
    facts: [
      { text: "The sanctuary protects the remnants of 118 World War I-era wooden steamships, collectively known as the Ghost Fleet.", source: S.mallows },
      { text: "Designated on September 3, 2019 — the first new national marine sanctuary in almost two decades.", source: S.mallows },
    ],
  },
  {
    id: "san-pedro",
    name: "San Pedro",
    where: "Off Indian Key, Florida Keys",
    lost: "1733",
    tagline: "A Spanish treasure-fleet wreck you can snorkel.",
    accent: "#fbbf24",
    center: [-80.6794, 24.8633],
    zoom: 13,
    wiki: "San_Pedro_Underwater_Archaeological_Preserve_State_Park",
    facts: [
      { text: "A 287-ton, Dutch-built ship of the 1733 Spanish treasure fleet, which left Havana on July 13, 1733 and was caught by a hurricane in the Straits of Florida.", source: S.sanPedro },
      { text: "She sank in 18 feet of water about a mile south of Indian Key; divers see a big pile of ballast stones mixed with red galley bricks.", source: S.sanPedro },
      { text: "A State of Florida Underwater Archaeological Preserve since 1989.", source: S.sanPedro },
    ],
  },
  {
    id: "independence",
    name: "USS Independence",
    where: "Near the Farallon Islands, California",
    lost: "Scuttled 1951",
    tagline: "A WWII aircraft carrier that became an atomic-test target.",
    accent: "#d946ef",
    center: [-122.98, 37.53],
    approximate: true,
    zoom: 9,
    wiki: "USS_Independence_(CVL-22)",
    facts: [
      { text: "One of more than 90 ships used as a target fleet for the 1946 atomic bomb tests in the Marshall Islands; it was scuttled in 1951.", source: S.independence },
      { text: "NOAA's 2015 survey found it upright and “amazingly intact” in about 2,600 feet of water.", source: S.independence },
    ],
  },
  {
    id: "rio",
    name: "SS City of Rio de Janeiro",
    where: "Golden Gate, San Francisco",
    lost: "February 22, 1901",
    tagline: "“The Titanic of the Golden Gate.”",
    accent: "#fb7185",
    center: [-122.481, 37.811],
    approximate: true,
    zoom: 12,
    wiki: "SS_City_of_Rio_de_Janeiro",
    facts: [
      { text: "In fog on February 22, 1901, she struck rocks at Fort Point and sank within minutes; 128 of the 210 aboard were lost.", source: S.rio },
      { text: "NOAA located and mapped the wreck in 2014, about 287 feet down.", source: S.rio },
    ],
  },
];

export const featuredById = (id: string) => FEATURED_WRECKS.find((w) => w.id === id);
