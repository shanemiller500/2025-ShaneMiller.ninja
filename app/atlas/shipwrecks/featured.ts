/* ------------------------------------------------------------------ */
/*  Featured shipwrecks. Every fact carries the official page it came  */
/*  from (NOAA / NPS; abroad Historic Environment Scotland, Ireland's  */
/*  INFOMAR seabed survey).                                            */
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
  /** published depth of the wreck (m) — only where a fact below gives it */
  depthM?: number;
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
  scapa: { label: "Historic Environment Scotland", url: "https://portal.historicenvironment.scot/designation/SM9298" },
  lusitania: { label: "INFOMAR (Ireland)", url: "https://infomar.ie/node/460" },
  vasa: { label: "Vasa Museum", url: "https://www.vasamuseet.se/en/explore/vasa-history/timeline" },
  maryRose: { label: "Mary Rose Trust", url: "https://maryrose.org/discover/history/" },
  batavia: { label: "WA Museum", url: "https://visit.museum.wa.gov.au/batavia-1629" },
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
    depthM: 3800,
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
    depthM: 73, // "about 240 feet"
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
    depthM: 5.5, // "18 feet of water"
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
    depthM: 792, // "about 2,600 feet"
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
    depthM: 87, // "about 287 feet"
    approximate: true,
    zoom: 12,
    wiki: "SS_City_of_Rio_de_Janeiro",
    facts: [
      { text: "In fog on February 22, 1901, she struck rocks at Fort Point and sank within minutes; 128 of the 210 aboard were lost.", source: S.rio },
      { text: "NOAA located and mapped the wreck in 2014, about 287 feet down.", source: S.rio },
    ],
  },
  {
    id: "scapa-flow",
    name: "German High Seas Fleet, Scapa Flow",
    where: "Scapa Flow, Orkney, Scotland",
    lost: "June 21, 1919",
    tagline: "A whole navy, sunk by its own crews.",
    accent: "#cbd5e1",
    center: [-3.153, 58.8866],
    depthM: 41, // König lies 16–41 m down
    zoom: 12,
    wiki: "Scuttling_of_the_German_fleet_at_Scapa_Flow",
    facts: [
      { text: "Interned at Scapa Flow after the 1918 Armistice, the German High Seas Fleet was scuttled by its own crews on 21 June 1919, during the peace talks; only a few ships were beached by the British guard.", source: S.scapa },
      { text: "Salvors licensed by the British government raised or removed most of the fleet — but not the battleships König, Kronprinz Wilhelm and Markgraf.", source: S.scapa },
      { text: "König lies 16 m to 41 m down, Kronprinz Wilhelm 14–40 m and Markgraf 23–46 m; the three were scheduled as a monument on 23 May 2001.", source: S.scapa },
    ],
  },
  {
    id: "lusitania",
    name: "RMS Lusitania",
    where: "Off the Old Head of Kinsale, Ireland",
    lost: "May 7, 1915",
    tagline: "The liner whose sinking turned opinion against the U-boat war.",
    accent: "#fda4af",
    center: [-8.548, 51.415],
    depthM: 93,
    approximate: true,
    zoom: 9,
    wiki: "RMS_Lusitania",
    facts: [
      { text: "Torpedoed by U-20 on 7 May 1915 near the end of a transatlantic voyage, she sank within 18 minutes. Of the 1,960 people on board, 1,193 were lost (other sources give 1,198).", source: S.lusitania },
      { text: "The wreck lies in 93 m of water, 11.5 nautical miles off the Old Head of Kinsale.", source: S.lusitania },
      { text: "Ireland placed an Underwater Heritage Order on the wreck in 1995; its seabed survey has mapped it with the state's Underwater Archaeology Unit since 2002. It is slowly collapsing, but the bow still stands proud of the seabed.", source: S.lusitania },
    ],
  },
  {
    id: "vasa",
    name: "Vasa",
    where: "Vasa Museum, Stockholm, Sweden",
    lost: "August 10, 1628",
    tagline: "A warship that sank on her maiden voyage and came back up almost whole.",
    accent: "#fcd34d",
    center: [18.0911, 59.3278],
    zoom: 15,
    wiki: "Vasa_(ship)",
    facts: [
      { text: "Vasa sank on 10 August 1628, about 1,300 m into her maiden voyage, and came to rest 32 m down.", source: S.vasa },
      { text: "Anders Franzén found her on 25 August 1956. She was raised on 24 April 1961, after 333 years on the seabed.", source: S.vasa },
      { text: "She is now in the Vasa Museum — the point marks the museum, not where she sank.", source: S.vasa },
    ],
  },
  {
    id: "mary-rose",
    name: "Mary Rose",
    where: "Mary Rose Museum, Portsmouth, England",
    lost: "July 19, 1545",
    tagline: "Henry VIII's warship, lost as he watched from the shore.",
    accent: "#fca5a5",
    center: [-1.1067, 50.7997],
    zoom: 15,
    wiki: "Mary_Rose",
    facts: [
      { text: "Built in 1510 for Henry VIII.", source: S.maryRose },
      { text: "She sank on 19 July 1545 at the Battle of the Solent, while Henry VIII watched from Southsea Castle.", source: S.maryRose },
      { text: "Raised in 1982; the point marks her museum in Portsmouth, not the wreck site in the Solent.", source: S.maryRose },
    ],
  },
  {
    id: "batavia",
    name: "Batavia",
    where: "Morning Reef, Houtman Abrolhos, Western Australia",
    lost: "June 4, 1629",
    tagline: "A Dutch East India ship whose wreck was followed by mutiny and murder.",
    accent: "#fbbf24",
    center: [113.7919, -28.4916],
    zoom: 12,
    wiki: "Batavia_(1628_ship)",
    facts: [
      { text: "The Dutch East India Company ship Batavia was wrecked on Morning Reef in the Houtman Abrolhos on 4 June 1629.", source: S.batavia },
      { text: "Among the survivors stranded on the islands, mutineers murdered over 100 people.", source: S.batavia },
      { text: "The wreck was found in 1963.", source: S.batavia },
    ],
  },
];

export const featuredById = (id: string) => FEATURED_WRECKS.find((w) => w.id === id);
