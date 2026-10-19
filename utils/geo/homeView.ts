/* ------------------------------------------------------------------ */
/*  Where a worldwide map should open: over the viewer's part of the   */
/*  world, guessed from the browser's time zone — no location prompt,  */
/*  nothing stored or sent. Unknown zones get the caller's fallback.   */
/* ------------------------------------------------------------------ */

export interface Region {
  key: string;
  label: string;
  center: [number, number];
}

export const REGIONS: Record<string, Region> = {
  northAmerica: { key: "northAmerica", label: "North America", center: [-98, 39] },
  southAmerica: { key: "southAmerica", label: "South America", center: [-62, -18] },
  europe: { key: "europe", label: "Europe", center: [12, 50] },
  africa: { key: "africa", label: "Africa", center: [20, 2] },
  middleEast: { key: "middleEast", label: "the Middle East", center: [45, 29] },
  southAsia: { key: "southAsia", label: "South Asia", center: [78, 22] },
  eastAsia: { key: "eastAsia", label: "East Asia", center: [118, 33] },
  southeastAsia: { key: "southeastAsia", label: "Southeast Asia", center: [110, 6] },
  australia: { key: "australia", label: "Australia", center: [134, -26] },
  newZealand: { key: "newZealand", label: "New Zealand", center: [172, -41] },
  hawaii: { key: "hawaii", label: "Hawaii", center: [-157, 20.5] },
  iceland: { key: "iceland", label: "Iceland", center: [-19, 65] },
};

const SOUTH_AMERICA = /^America\/(Argentina|Sao_Paulo|Santiago|Lima|Bogota|Caracas|La_Paz|Montevideo|Asuncion|Guayaquil|Cayenne|Paramaribo|Guyana|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha|Punta_Arenas|Eirunepe)/;
const SOUTH_ASIA = /^Asia\/(Kolkata|Calcutta|Dhaka|Karachi|Kathmandu|Katmandu|Colombo|Thimphu|Kabul)|^Indian\/Maldives/;
const EAST_ASIA = /^Asia\/(Tokyo|Seoul|Pyongyang|Shanghai|Chongqing|Harbin|Urumqi|Hong_Kong|Macau|Taipei|Ulaanbaatar)/;
const SOUTHEAST_ASIA = /^Asia\/(Bangkok|Jakarta|Singapore|Kuala_Lumpur|Ho_Chi_Minh|Saigon|Manila|Yangon|Phnom_Penh|Vientiane|Makassar|Jayapura|Pontianak|Brunei|Dili|Kuching)/;
const MIDDLE_EAST = /^Asia\/(Dubai|Riyadh|Tehran|Baghdad|Jerusalem|Tel_Aviv|Beirut|Damascus|Amman|Kuwait|Qatar|Bahrain|Muscat|Aden|Baku|Tbilisi|Yerevan|Nicosia|Famagusta|Gaza|Hebron)|^Europe\/Istanbul/;

/** The viewer's region from an IANA time zone, or null when it can't be told. */
export function regionForZone(tz: string | undefined | null): Region | null {
  if (!tz) return null;
  if (tz === "Pacific/Honolulu") return REGIONS.hawaii;
  if (/^(Pacific\/(Auckland|Chatham)|NZ)/.test(tz)) return REGIONS.newZealand;
  if (/^Australia\//.test(tz)) return REGIONS.australia;
  if (tz === "Atlantic/Reykjavik") return REGIONS.iceland;
  if (MIDDLE_EAST.test(tz)) return REGIONS.middleEast;
  if (SOUTH_AMERICA.test(tz)) return REGIONS.southAmerica;
  if (/^(America|US|Canada)\//.test(tz)) return REGIONS.northAmerica;
  if (/^Europe\//.test(tz)) return REGIONS.europe;
  if (/^Africa\//.test(tz)) return REGIONS.africa;
  if (SOUTH_ASIA.test(tz)) return REGIONS.southAsia;
  if (EAST_ASIA.test(tz)) return REGIONS.eastAsia;
  if (SOUTHEAST_ASIA.test(tz)) return REGIONS.southeastAsia;
  return null;
}

/** The centre a worldwide map opens on: the viewer's region, else `fallback`. */
export function homeCenter(fallback: [number, number]): [number, number] {
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }
  return regionForZone(tz)?.center ?? fallback;
}
