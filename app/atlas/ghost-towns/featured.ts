/* ------------------------------------------------------------------ */
/*  Featured ghost towns. Every fact carries the page it came from —   */
/*  the agency that looks after the place (state parks, BLM, NPS, the  */
/*  Massachusetts Archives). Checked October 2026. Positions from      */
/*  Wikipedia.                                                          */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}
export interface Fact {
  text: string;
  source: Source;
}

export type FeaturedKind = "boom" | "drowned" | "deserted";

export interface FeaturedTown {
  id: string;
  name: string;
  where: string;
  kind: FeaturedKind;
  /** e.g. "1859–1932" */
  era: string;
  tagline: string;
  accent: string;
  /** [lng, lat] */
  center: [number, number];
  zoom: number;
  wiki: string;
  facts: Fact[];
  /** who looks after it today */
  site: Source;
}

const S = {
  bodie: { label: "California State Parks", url: "https://www.parks.ca.gov/?page_id=509" },
  rhyolite: { label: "BLM", url: "https://www.blm.gov/press-release/public-tours-historic-rhyolite-back-popular-demand" },
  kennecott: { label: "NPS", url: "https://www.nps.gov/places/kennecott-mines.htm" },
  bannack: { label: "Montana State Parks", url: "https://fwp.mt.gov/stateparks/bannack/" },
  garnet: { label: "BLM", url: "https://www.blm.gov/press-release/garnet-day-celebrates-mining-heritage-montanas-most-intact-ghost-town" },
  quabbin: { label: "Massachusetts Archives", url: "https://www.digitalcommonwealth.org/collections/commonwealth:76537133j" },
  humberstone: { label: "UNESCO", url: "https://whc.unesco.org/en/list/1178/" },
  wharram: { label: "English Heritage", url: "https://www.english-heritage.org.uk/visit/places/wharram-percy-deserted-medieval-village/history/" },
} satisfies Record<string, Source>;

export const FEATURED_TOWNS: FeaturedTown[] = [
  {
    id: "bodie",
    name: "Bodie",
    where: "Mono County, California",
    kind: "boom",
    era: "boom 1875–1881",
    tagline: "A gold town left exactly as it fell, kept in “arrested decay”.",
    accent: "#fbbf24",
    center: [-119.0119, 38.2122],
    zoom: 15,
    wiki: "Bodie,_California",
    facts: [
      { text: "Named for W. S. Body (or Bodey), who found small amounts of gold in the hills north of Mono Lake. An 1875 mine cave-in revealed a rich vein, and the town boomed to roughly 8,000 people.", source: S.bodie },
      { text: "The bust began in 1881. Of around 2,000 structures, fires in 1892 and 1932 left less than 10% standing.", source: S.bodie },
      { text: "What remains is preserved in a state of “arrested decay” — designated a National Historic Site and State Historic Park in 1962, at 8,375 feet.", source: S.bodie },
    ],
    site: { label: "Bodie State Historic Park", url: "https://www.parks.ca.gov/?page_id=509" },
  },
  {
    id: "rhyolite",
    name: "Rhyolite",
    where: "Nye County, Nevada",
    kind: "boom",
    era: "1904–1916",
    tagline: "A gold-rush city that lasted barely a decade.",
    accent: "#f97316",
    center: [-116.8287, 36.9019],
    zoom: 15,
    wiki: "Rhyolite,_Nevada",
    facts: [
      { text: "Frank “Shorty” Harris and Ernest “Ed” Cross found quartz here in 1904. By 1905 the town had running water; by 1907 electricity, telephones, a bank — and 50 saloons.", source: S.rhyolite },
      { text: "At its peak it may have held 5,000–8,000 people. On March 14, 1911, residents began leaving in large numbers, and in 1916 the power was turned off.", source: S.rhyolite },
      { text: "The Tom Kelly Bottle House is one of the first buildings visitors see.", source: S.rhyolite },
    ],
    site: { label: "BLM — Rhyolite Historic Area", url: "https://www.blm.gov/press-release/public-tours-historic-rhyolite-back-popular-demand" },
  },
  {
    id: "kennecott",
    name: "Kennecott",
    where: "Wrangell-St. Elias National Park, Alaska",
    kind: "boom",
    era: "1911–1938",
    tagline: "A copper company town in the Alaskan wilderness.",
    accent: "#ef4444",
    center: [-142.8869, 61.4859],
    zoom: 14,
    wiki: "Kennecott,_Alaska",
    facts: [
      { text: "By April 1911 the first trainload of copper ore was on its way to Cordova.", source: S.kennecott },
      { text: "Before the operation closed in 1938, the mines extracted 591,535 short tons of copper from 4,525,909 tons of ore, valued at $200 million in 1938 dollars.", source: S.kennecott },
      { text: "Designated a National Historic Landmark in 1986.", source: S.kennecott },
    ],
    site: { label: "NPS — Kennecott Mines", url: "https://www.nps.gov/places/kennecott-mines.htm" },
  },
  {
    id: "bannack",
    name: "Bannack",
    where: "Beaverhead County, Montana",
    kind: "boom",
    era: "gold found 1862",
    tagline: "Montana's first territorial capital, now its best-kept ghost town.",
    accent: "#a3e635",
    center: [-112.9958, 45.1608],
    zoom: 15,
    wiki: "Bannack,_Montana",
    facts: [
      { text: "Site of Montana's first major gold discovery, on July 28, 1862 — and Montana's first territorial capital.", source: S.bannack },
      { text: "Over 50 buildings line Main Street; it is the best preserved of all Montana ghost towns.", source: S.bannack },
      { text: "Bannack State Park is a National Historic Landmark.", source: S.bannack },
    ],
    site: { label: "Bannack State Park", url: "https://fwp.mt.gov/stateparks/bannack/" },
  },
  {
    id: "garnet",
    name: "Garnet",
    where: "Granite County, Montana",
    kind: "boom",
    era: "last resident 1947",
    tagline: "A gold camp that slowly went to sleep.",
    accent: "#fde68a",
    center: [-113.3383, 46.8256],
    zoom: 15,
    wiki: "Garnet,_Montana",
    facts: [
      { text: "A gold-mining town that declined after a fire destroyed many of its buildings and the gold grew harder to mine.", source: S.garnet },
      { text: "Its last full-time resident died in 1947. The town is publicly owned and managed by the Bureau of Land Management's Missoula Field Office.", source: S.garnet },
    ],
    site: { label: "BLM — Garnet Ghost Town", url: "https://www.blm.gov/visit/garnet-ghost-town" },
  },
  {
    id: "quabbin",
    name: "The lost towns of the Quabbin",
    where: "Swift River valley, Massachusetts",
    kind: "drowned",
    era: "disincorporated 1938",
    tagline: "Four towns erased to give Boston its water.",
    accent: "#38bdf8",
    center: [-72.3, 42.38],
    zoom: 10.5,
    wiki: "Quabbin_Reservoir",
    facts: [
      { text: "On April 28, 1938, four Massachusetts towns were disincorporated — Dana, Enfield, Greenwich and Prescott — for the Quabbin Reservoir, Dam and Aqueduct, a water supply for Boston and its metropolitan area.", source: S.quabbin },
      { text: "Even the dead were moved: about 7,500 burials in 34 cemeteries in the watershed had to be dealt with under the Acts of 1927, chapter 321.", source: S.quabbin },
    ],
    site: { label: "Massachusetts Archives — Quabbin records", url: "https://www.digitalcommonwealth.org/collections/commonwealth:76537133j" },
  },
  {
    id: "humberstone",
    name: "Humberstone & Santa Laura",
    where: "Tarapacá, Chile",
    kind: "boom",
    era: "saltpeter boom from 1880",
    tagline: "Company towns of the nitrate boom in one of Earth's driest deserts.",
    accent: "#fdba74",
    center: [-69.7944, -20.2083],
    zoom: 15,
    wiki: "Humberstone_and_Santa_Laura_Saltpeter_Works",
    facts: [
      { text: "Workers from Chile, Peru and Bolivia lived in company towns at over 200 saltpeter works, forging their own 'pampino' culture.", source: S.humberstone },
      { text: "For over 60 years from 1880 they processed the world's largest saltpeter deposit, making the sodium nitrate fertilizer that transformed farming in the Americas and Europe.", source: S.humberstone },
      { text: "The works sit in the remote Pampas, one of the driest deserts on Earth. Inscribed 2005.", source: S.humberstone },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/1178/" },
  },
  {
    id: "wharram-percy",
    name: "Wharram Percy",
    where: "North Yorkshire, England",
    kind: "deserted",
    era: "deserted by the early 1500s",
    tagline: "A medieval village emptied for sheep.",
    accent: "#a3e635",
    center: [-0.6897, 54.0675],
    zoom: 16,
    wiki: "Wharram_Percy",
    facts: [
      { text: "People lived here for about 600 years; the village was probably founded in the 9th or 10th century.", source: S.wharram },
      { text: "It was nearly empty by the early 16th century, and by 1527 the land had been turned over to sheep pasture.", source: S.wharram },
      { text: "The ruined church of St Martin is the last standing medieval building; about 40 peasant houses and two manor houses survive as foundations. Archaeologists dug here every summer from the 1950s to 1990.", source: S.wharram },
    ],
    site: { label: "Wharram Percy (English Heritage)", url: "https://www.english-heritage.org.uk/visit/places/wharram-percy-deserted-medieval-village/" },
  },
];

export const featuredById = (id: string) => FEATURED_TOWNS.find((t) => t.id === id);
