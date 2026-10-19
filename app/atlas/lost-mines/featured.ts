/* ------------------------------------------------------------------ */
/*  Featured gold-rush and mine sites. Every fact comes from the       */
/*  official page it links to — the park, state historic site or       */
/*  agency that looks after the place (checked October 2026).          */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}
export interface Fact {
  text: string;
  source: Source;
}

export interface MineSite {
  id: string;
  name: string;
  where: string;
  /** e.g. "Gold · 1799" */
  era: string;
  /** when it began, for the timeline markers (null = no sourced start year) */
  year: number | null;
  /** how the year reads on the marker, when it is approximate */
  yearLabel?: string;
  tagline: string;
  accent: string;
  /** [lng, lat] */
  center: [number, number];
  zoom: number;
  wiki: string;
  facts: Fact[];
  site: Source;
}

const S = {
  reed: { label: "NC Historic Sites", url: "https://historicsites.nc.gov/all-sites/reed-gold-mine/history" },
  reedHome: { label: "NC Historic Sites", url: "https://historicsites.nc.gov/all-sites/reed-gold-mine" },
  dahlonega: { label: "Georgia State Parks", url: "https://gastateparks.org/DahlonegaGoldMuseum" },
  marshall: { label: "California State Parks", url: "https://www.parks.ca.gov/?page_id=484" },
  empire: { label: "California State Parks", url: "https://www.parks.ca.gov/?page_id=499" },
  homestakeState: { label: "S.D. Dept. of Agriculture & Natural Resources", url: "https://danr.sd.gov/Environment/MineralsMining/MiningHistory.aspx" },
  homestakeLab: { label: "Sanford Underground Research Facility", url: "https://sanfordlab.org/our-story" },
  keane: { label: "NPS", url: "https://www.nps.gov/deva/learn/historyculture/keane-wonder-mine.htm" },
  kennecott: { label: "NPS", url: "https://www.nps.gov/places/kennecott-mines.htm" },
  klondike: { label: "NPS", url: "https://www.nps.gov/klgo/learn/historyculture/tonofgoods.htm" },
} satisfies Record<string, Source>;

export const MINE_SITES: MineSite[] = [
  {
    id: "reed",
    year: 1799,
    name: "Reed Gold Mine",
    where: "Cabarrus County, North Carolina",
    era: "Gold · 1799",
    tagline: "A 17-pound doorstop and America's first gold find.",
    accent: "#facc15",
    center: [-80.46996, 35.28542],
    zoom: 15,
    wiki: "Reed_Gold_Mine",
    facts: [
      { text: "One Sunday in 1799, Conrad Reed found a large yellow rock in Little Meadow Creek on his family's farm. It reportedly weighed 17 pounds.", source: S.reed },
      { text: "For three years it was used as a doorstop. In 1802 a Fayetteville jeweler bought it for $3.50 — one-tenth of one percent of its true value.", source: S.reed },
      { text: "Reed Gold Mine is the site of the first documented gold find in the United States, and North Carolina led the nation in gold production until 1848.", source: S.reedHome },
      { text: "An enslaved boy named Peter later unearthed a 28-pound nugget — the largest found east of the Mississippi River.", source: S.reed },
    ],
    site: { label: "Reed Gold Mine (NC Historic Sites)", url: "https://historicsites.nc.gov/all-sites/reed-gold-mine" },
  },
  {
    id: "dahlonega",
    year: 1829, yearLabel: "c. 1829",
    name: "Dahlonega",
    where: "Lumpkin County, Georgia",
    era: "Gold · 1830s",
    tagline: "America's first major gold rush, in the Cherokee Nation.",
    accent: "#fde047",
    center: [-83.98488, 34.53267],
    zoom: 14,
    wiki: "Dahlonega_Gold_Museum_Historic_Site",
    facts: [
      { text: "Twenty years before the 1849 gold rush in California, thousands of prospectors flocked into the Cherokee Nation here.", source: S.dahlonega },
      { text: "A U.S. Branch Mint opened at Dahlonega in 1838 and coined more than $6 million in gold before closing in 1861.", source: S.dahlonega },
      { text: "The gold museum is in the 1836 Lumpkin County Courthouse, one of the oldest courthouse buildings in Georgia.", source: S.dahlonega },
    ],
    site: { label: "Dahlonega Gold Museum (Georgia State Parks)", url: "https://gastateparks.org/DahlonegaGoldMuseum" },
  },
  {
    id: "sutters-mill",
    year: 1848,
    name: "Sutter's Mill, Coloma",
    where: "El Dorado County, California",
    era: "Gold · 1848",
    tagline: "Where the California Gold Rush began.",
    accent: "#fbbf24",
    center: [-120.89236, 38.80347],
    zoom: 15,
    wiki: "Sutter's_Mill",
    facts: [
      { text: "In 1848 James Marshall discovered gold in the tailrace of the sawmill he was building with John Sutter, on the South Fork of the American River.", source: S.marshall },
      { text: "The discovery led to the greatest mass movement of people in the Western Hemisphere. The tailrace is still visible in Coloma today.", source: S.marshall },
    ],
    site: { label: "Marshall Gold Discovery State Historic Park", url: "https://www.parks.ca.gov/?page_id=484" },
  },
  {
    id: "empire",
    year: null,
    name: "Empire Mine",
    where: "Grass Valley, California",
    era: "Gold · closed 1956",
    tagline: "367 miles of tunnels under the Sierra foothills.",
    accent: "#f59e0b",
    center: [-121.04278, 39.20361],
    zoom: 15,
    wiki: "Empire_Mine_State_Historic_Park",
    facts: [
      { text: "In operation for more than 100 years, the Empire Mine extracted 5.8 million ounces of gold before it closed in 1956.", source: S.empire },
      { text: "The park is the entrance to 367 miles of abandoned and flooded mine shafts — one of the deepest mines in California.", source: S.empire },
    ],
    site: { label: "Empire Mine State Historic Park", url: "https://www.parks.ca.gov/?page_id=499" },
  },
  {
    id: "homestake",
    year: 1876,
    name: "Homestake Mine",
    where: "Lead, South Dakota",
    era: "Gold · 1876–2001",
    tagline: "125 years of gold — now a physics lab deep underground.",
    accent: "#eab308",
    center: [-103.76501, 44.35607],
    zoom: 14,
    wiki: "Homestake_Mine",
    facts: [
      { text: "Operating since 1876, Homestake's mill produced 39.62 million ounces of gold and 9 million ounces of silver. It mined its last ton of ore on December 14, 2001.", source: S.homestakeState },
      { text: "Until it closed, Homestake was the largest and deepest gold mine in North America. In 2006 it became an underground research facility.", source: S.homestakeLab },
      { text: "The federal records disagree, as old records do: USGS's MRDS, frozen since 2011, still lists Homestake as a producer, while MSHA marks it abandoned — click the mine on the map to see both.", source: { label: "USGS MRDS", url: "https://mrdata.usgs.gov/mrds/show-mrds.php?dep_id=10106953" } },
    ],
    site: { label: "Sanford Underground Research Facility", url: "https://sanfordlab.org/our-story" },
  },
  {
    id: "keane-wonder",
    year: 1903,
    name: "Keane Wonder Mine",
    where: "Death Valley National Park, California",
    era: "Gold · 1903–1942",
    tagline: "A mile-long tramway down a desert mountainside.",
    accent: "#fb923c",
    center: [-116.90944, 36.66917],
    zoom: 15,
    wiki: "Keane_Wonder_Mine",
    facts: [
      { text: "Claims were staked in December 1903, and by 1907 the mine was in full operation. Its mile-long aerial tramway would have carried 70 tons of gold ore a day at peak production.", source: S.keane },
      { text: "By 1912 the ore was running out; the last attempt to keep it going ended in 1942.", source: S.keane },
      { text: "From 2008 to 2017 the area was closed for structural stabilization and mine safety work. The park warns: mines are unstable and may collapse — not all shafts are closed.", source: S.keane },
    ],
    site: { label: "Keane Wonder Mine (NPS)", url: "https://www.nps.gov/deva/learn/historyculture/keane-wonder-mine.htm" },
  },
  {
    id: "kennecott",
    year: 1911,
    name: "Kennecott",
    where: "Wrangell-St. Elias National Park, Alaska",
    era: "Copper · 1911–1938",
    tagline: "A copper empire in the Alaskan wilderness.",
    accent: "#f97316",
    center: [-142.8869, 61.4859],
    zoom: 14,
    wiki: "Kennecott,_Alaska",
    facts: [
      { text: "By April 1911 the first trainload of copper ore was on its way to Cordova.", source: S.kennecott },
      { text: "Before the operation closed in 1938, the mines extracted 591,535 short tons of copper from 4,525,909 tons of ore, valued at $200 million in 1938 dollars.", source: S.kennecott },
    ],
    site: { label: "NPS — Kennecott Mines", url: "https://www.nps.gov/places/kennecott-mines.htm" },
  },
  {
    id: "klondike",
    year: 1897,
    name: "Skagway & the Klondike trails",
    where: "Skagway, Alaska",
    era: "Gold · 1897–98",
    tagline: "The American gateway to Canada's Klondike gold fields.",
    accent: "#fcd34d",
    center: [-135.26367, 59.57537],
    zoom: 12,
    wiki: "Klondike_Gold_Rush_National_Historical_Park",
    facts: [
      { text: "The gold fields were in Canada's Yukon. To prevent starvation, the Canadian government required every stampeder to bring a year's supply of goods before crossing the border.", source: S.klondike },
      { text: "Food alone weighed at least 1,095 pounds; with clothes and gear the load became known as a “ton of goods”.", source: S.klondike },
      { text: "Relaying it in trip after trip, some stampeders walked nearly 1,000 miles to move their supplies the 33 miles from Dyea to Lake Bennett.", source: S.klondike },
    ],
    site: { label: "Klondike Gold Rush National Historical Park (NPS)", url: "https://www.nps.gov/klgo/" },
  },
];

export const siteById = (id: string) => MINE_SITES.find((s) => s.id === id);

/** Safety, from the National Park Service's abandoned mineral lands program. */
export const SAFETY = {
  text: "Old mines kill. Miners often left shafts uncovered when they moved on, and deadly gases and air with almost no oxygen collect underground — by the time you feel ill you can't react. Stay out, stay alive.",
  source: { label: "NPS — Abandoned Mineral Lands: Hazards and Safety", url: "https://www.nps.gov/subjects/abandonedminerallands/hazards-and-safety.htm" },
};
