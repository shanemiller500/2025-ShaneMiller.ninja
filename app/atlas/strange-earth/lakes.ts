/* ------------------------------------------------------------------ */
/*  Ice Age lakes: sourced facts for the big two. Every number here    */
/*  comes from the linked page (UGS Public Information 39; USGS Fact   */
/*  Sheet 2004-3044). The 3D refill's level / depth / volume are       */
/*  estimated from terrain and labelled as such in the UI.             */
/* ------------------------------------------------------------------ */
import type { Fact, Source } from "./featured";

export const LAKES_URL = "/atlas/pluvial.json";

export interface LakeProps {
  id: number;
  name: string | null;
  note: string | null;
  areaKm2: number;
}

export const LAKE_SOURCES = {
  ugsBonneville: { label: "Utah Geological Survey PI-39", url: "https://ugspub.nr.utah.gov/publications/public_information/pi-39.pdf" },
  usgsLahontan: { label: "USGS FS 2004-3044", url: "https://pubs.usgs.gov/fs/2004/3044/" },
  layer: {
    label: "Great Basin pluvial lakes (after Mifflin & Wheat 1979)",
    url: "https://services3.arcgis.com/hDXM0jVzBTOKdR4i/arcgis/rest/services/Great_Basin_Pluvial_Lakes_MW1979/FeatureServer/0",
  },
} satisfies Record<string, Source>;

const B = LAKE_SOURCES.ugsBonneville;
const L = LAKE_SOURCES.usgsLahontan;

export const LAKE_FACTS: Record<string, { tagline: string; facts: Fact[] }> = {
  Bonneville: {
    tagline: "The Ice Age lake that filled western Utah.",
    facts: [
      { text: "Existed from about 32,000 to 14,000 years ago and at its largest covered about 20,000 square miles.", source: B },
      { text: "About 325 miles long, 135 miles wide and over 1,000 feet deep; today's western Utah mountain ranges were its islands.", source: B },
      { text: "About 16,800 years ago it rose to its lowest outlet, Red Rock Pass in Idaho (about 5,090 ft), and broke through. The flood probably lasted less than a year and cut the outlet down about 375 feet.", source: B },
      { text: "Its old shorelines survive as benches on the mountains — the Bonneville shoreline sits at 5,220 ft on Antelope Island.", source: B },
      { text: "Great Salt Lake is a large remnant of it; so are Utah Lake, Sevier Lake and the Great Salt Lake Desert with the Bonneville Salt Flats.", source: B },
    ],
  },
  Lahontan: {
    tagline: "Nevada's Ice Age inland sea.",
    facts: [
      { text: "At its highstand Lake Lahontan covered 22,800 km² — slightly larger than Lake Ontario today — and was 281 m deep.", source: L },
      { text: "It rose rapidly to its highstand (1,335 m above sea level) about 15,000 years ago, then fell rapidly between 14,000 and 13,000 years ago.", source: L },
      { text: "Pyramid Lake was one of seven water bodies that joined to form Lahontan. At the highstand the water there was 281 m deep; in 2004 Pyramid Lake was 106 m deep.", source: L },
      { text: "Its tufa towers are calcium carbonate rock, built where springs on the lake bottom fed calcium into the carbonate-rich lake water.", source: L },
    ],
  },
};

export const lakeLabel = (p: Pick<LakeProps, "name">) => (p.name ? `Lake ${p.name}` : "Unnamed Ice Age lake");
