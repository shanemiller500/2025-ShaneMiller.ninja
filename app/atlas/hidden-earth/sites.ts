import type { LidarViewKey } from "@/utils/geo/lidar";

/* ------------------------------------------------------------------ */
/*  Hidden Earth's featured sites: places where lidar shows what the   */
/*  eye (or the forest) hides. Every fact carries the page it came     */
/*  from — checked October 2026. Coordinates from Wikipedia / OSM.     */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}
export interface Fact {
  text: string;
  source: Source;
}

export type SiteKind = "earthwork" | "fault" | "landslide" | "battlefield" | "landform";

export const SITE_KINDS: Record<SiteKind, { label: string; color: string }> = {
  earthwork: { label: "Ancient earthwork", color: "#fbbf24" },
  fault: { label: "Hidden fault", color: "#f43f5e" },
  landslide: { label: "Old landslides", color: "#fb923c" },
  battlefield: { label: "Battlefield earthworks", color: "#a78bfa" },
  landform: { label: "Mystery landform", color: "#a3e635" },
};

export interface HiddenSite {
  id: string;
  name: string;
  where: string;
  kind: SiteKind;
  tagline: string;
  /** [lng, lat] */
  center: [number, number];
  zoom: number;
  /** half-width (m) of the point-cloud window: small for small earthworks so the points stay dense */
  cloudHalf: number;
  /** the lidar view that shows it best */
  view: LidarViewKey;
  /** what to look for in the lidar */
  look: string;
  /** Wikipedia article (photo) */
  wiki: string;
  facts: Fact[];
}

const S = {
  usgsHidden: { label: "USGS FS 017-03", url: "https://pubs.usgs.gov/fs/2003/fs017-03/hidden.html" },
  usgsToeJam: { label: "USGS", url: "https://www.usgs.gov/publications/late-holocene-earthquakes-toe-jam-hill-fault-seattle-fault-zone-bainbridge-island" },
  uwOso: { label: "Univ. of Washington", url: "https://www.washington.edu/news/2015/12/22/dating-historic-activity-at-oso-site-shows-recurring-major-landslides/" },
  dnrMima: { label: "WA DNR", url: "https://dnr.wa.gov/sites/default/files/2025-03/amp_mima_mounds_mistery.pdf" },
  osuNewark: { label: "Ohio State Univ.", url: "https://history.osu.edu/news/newark-earthworks-joins-world-heritage-sites" },
  npsHopewell: { label: "NPS", url: "https://www.nps.gov/hocu/learn/historyculture/index.htm" },
  wikiSerpent: { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Serpent_Mound" },
  cahokia: { label: "Cahokia Mounds", url: "https://cahokiamounds.org/" },
  npsPoverty: { label: "NPS", url: "https://www.nps.gov/popo/index.htm" },
  npsOcmulgee: { label: "NPS", url: "https://www.nps.gov/ocmu/index.htm" },
  npsEffigy: { label: "NPS", url: "https://www.nps.gov/efmo/index.htm" },
  npsEffigyBuilders: { label: "NPS", url: "https://www.nps.gov/efmo/learn/historyculture/effigy-moundbuilders.htm" },
  npsPetersburg: { label: "NPS", url: "https://www.nps.gov/pete/learn/news/presskit.htm" },
  eosBays: { label: "Eos (AGU)", url: "https://eos.org/articles/four-planetary-landscapes-that-scientists-cant-explain" },
} satisfies Record<string, Source>;

export const SITES: HiddenSite[] = [
  {
    id: "toe-jam-hill",
    cloudHalf: 300,
    name: "Toe Jam Hill Fault",
    where: "Bainbridge Island, Washington",
    kind: "fault",
    tagline: "An earthquake fault hiding under the forest, a ferry ride from Seattle.",
    center: [-122.5064, 47.5884],
    zoom: 13.3,
    view: "multi",
    look: "A straight east–west step in the ground, cutting across the wooded hills and ignoring the streams.",
    wiki: "Seattle_Fault",
    facts: [
      { text: "Lidar sees through forests and measures the ground to a foot or less — so faults hidden under Puget Sound's trees became visible.", source: S.usgsHidden },
      { text: "The Toe Jam Hill fault scarp was the first to be revealed by laser imagery.", source: S.usgsToeJam },
      { text: "Trenches dug across it record three or possibly four earthquakes between 2,500 and 1,000 years ago; the latest, around A.D. 900–930, raised beaches and sent a tsunami through Puget Sound.", source: S.usgsToeJam },
      { text: "Those earthquakes were near magnitude 7.", source: S.usgsToeJam },
    ],
  },
  {
    id: "oso",
    cloudHalf: 400,
    name: "Oso & the Stillaguamish Slides",
    where: "Snohomish County, Washington",
    kind: "landslide",
    tagline: "A valley that has slid before — again and again.",
    center: [-121.848, 48.2826],
    zoom: 13,
    view: "multi",
    look: "Bowl-shaped scars on the valley walls and hummocky lobes of old debris on the valley floor.",
    wiki: "2014_Oso_landslide",
    facts: [
      { text: "The March 2014 Oso landslide was the deadliest landslide in U.S. history.", source: S.uwOso },
      { text: "Lidar of the valley shows older slides. The Rowan landslide, about 500 years old, was about five times the size of Oso.", source: S.uwOso },
      { text: "Over the past 2,000 years the slopes here have collapsed about once every 140 years on average.", source: S.uwOso },
    ],
  },
  {
    id: "mima",
    cloudHalf: 150,
    name: "Mima Mounds",
    where: "Thurston County, Washington",
    kind: "landform",
    tagline: "A prairie covered in look-alike mounds. Nobody knows why.",
    center: [-123.0505, 46.8986],
    zoom: 15.5,
    view: "multi",
    look: "An egg-carton texture: low bumps packed side by side across the prairie.",
    wiki: "Mima_mounds",
    facts: [
      { text: "More than 30 explanations have been proposed for how the mounds formed — none has been proven.", source: S.dnrMima },
      { text: "Mounds are 8–40 feet across and 1–7 feet high, about 8 to 10 per acre.", source: S.dnrMima },
    ],
  },
  {
    id: "newark",
    cloudHalf: 320,
    name: "Newark Earthworks",
    where: "Newark, Ohio",
    kind: "earthwork",
    tagline: "A giant octagon that tracks the moon.",
    center: [-82.4466, 40.0535],
    zoom: 14.2,
    view: "multi",
    look: "An octagon joined to a circle, laid out between modern streets and fairways.",
    wiki: "Newark_Earthworks",
    facts: [
      { text: "Built between about A.D. 1 and 400. In 2023 it became part of the Hopewell Ceremonial Earthworks — Ohio's first World Heritage site.", source: S.osuNewark },
      { text: "The Octagon encloses 50 acres; each of its eight walls is about 550 feet long and 5–6 feet high.", source: S.osuNewark },
      { text: "Its central axis lines up with the moon's northernmost rising, which comes around every 18.6 years.", source: S.osuNewark },
      { text: "The Great Circle nearby is nearly 1,200 feet across, with 8-foot walls around a 5-foot-deep moat.", source: S.osuNewark },
    ],
  },
  {
    id: "mound-city",
    cloudHalf: 160,
    name: "Mound City",
    where: "Hopewell Culture NHP, Chillicothe, Ohio",
    kind: "earthwork",
    tagline: "Hopewell mounds inside an earthen wall, about 2,000 years old.",
    center: [-83.0064, 39.3758],
    zoom: 15.3,
    view: "tinted",
    look: "Low round mounds inside a squared wall, beside the river.",
    wiki: "Hopewell_Culture_National_Historical_Park",
    facts: [
      { text: "The Hopewell culture flourished in the eastern woodlands from about A.D. 1 to 400, building earthen walls, ditches and mounds in geometric patterns.", source: S.npsHopewell },
      { text: "Mound City Group National Monument was proclaimed in 1923 to protect mounds of \"great historic and scientific interest\".", source: S.npsHopewell },
      { text: "Five sites in the park are among the eight earthworks inscribed as World Heritage in 2023.", source: S.osuNewark },
    ],
  },
  {
    id: "serpent",
    cloudHalf: 140,
    name: "Serpent Mound",
    where: "Adams County, Ohio",
    kind: "earthwork",
    tagline: "A quarter-mile snake of earth, coiled along a ridge.",
    center: [-83.4308, 39.0264],
    zoom: 16.2,
    view: "slope",
    look: "The coils show as a sharp wavy line along the top of the ridge, with an oval at the head.",
    wiki: "Serpent_Mound",
    facts: [
      { text: "About 1,348 feet long, from 9 inches to more than 3 feet high.", source: S.wikiSerpent },
      { text: "Who built it, and when, is still argued — radiocarbon dates have pointed both to around 300 B.C. and to about 900 years ago.", source: S.wikiSerpent },
    ],
  },
  {
    id: "cahokia",
    cloudHalf: 320,
    name: "Cahokia",
    where: "Collinsville, Illinois",
    kind: "earthwork",
    tagline: "A city of mounds bigger than medieval London.",
    center: [-90.0644, 38.6539],
    zoom: 14.4,
    view: "tinted",
    look: "Monks Mound's huge flat-topped platform, ringed by smaller mounds and plazas.",
    wiki: "Cahokia",
    facts: [
      { text: "Around 1100 it was the largest pre-Columbian site north of Mexico, with nearly 20,000 people — larger than London at the time.", source: S.cahokia },
      { text: "At its peak it covered more than 4,000 acres with about 120 earthen mounds; Illinois protects about 2,200 acres, including 72 of the nearly 80 mounds that remain.", source: S.cahokia },
      { text: "A UNESCO World Heritage site since 1982.", source: S.cahokia },
    ],
  },
  {
    id: "poverty-point",
    cloudHalf: 380,
    name: "Poverty Point",
    where: "West Carroll Parish, Louisiana",
    kind: "earthwork",
    tagline: "Earthworks raised 3,000 years ago in the Mississippi delta.",
    center: [-91.4114, 32.6367],
    zoom: 14.6,
    view: "multi",
    look: "Curving, nested ridges and big mounds rising out of flat farmland.",
    wiki: "Poverty_Point",
    facts: [
      { text: "At its peak about 3,000 years ago, and the product of some five million hours of labor.", source: S.npsPoverty },
      { text: "A UNESCO World Heritage site, and part of an enormous ancient trading network.", source: S.npsPoverty },
    ],
  },
  {
    id: "ocmulgee",
    cloudHalf: 220,
    name: "Ocmulgee Mounds",
    where: "Macon, Georgia",
    kind: "earthwork",
    tagline: "Mississippian temple mounds above the river.",
    center: [-83.6083, 32.8367],
    zoom: 15.2,
    view: "tinted",
    look: "The flat-topped Great Temple Mound and the smaller mounds around it.",
    wiki: "Ocmulgee_Mounds_National_Historical_Park",
    facts: [
      { text: "The Great Temple Mound, the park's largest, stands 55 feet tall.", source: S.npsOcmulgee },
      { text: "The Earth Lodge was a council chamber; its original floor has been carbon-dated to the year 1015. The Mississippian period here began around 900.", source: S.npsOcmulgee },
    ],
  },
  {
    id: "effigy-mounds",
    cloudHalf: 200,
    name: "Effigy Mounds",
    where: "Harpers Ferry, Iowa",
    kind: "earthwork",
    tagline: "Bears and birds made of earth, hidden in the woods.",
    center: [-91.1856, 43.0888],
    zoom: 15.4,
    view: "slope",
    look: "Under the forest: animal-shaped outlines and rows of round mounds along the bluff top.",
    wiki: "Effigy_Mounds_National_Monument",
    facts: [
      { text: "The monument preserves 200-plus American Indian mounds.", source: S.npsEffigy },
      { text: "Mounds were shaped as birds, bears, deer, bison, lynx, turtles, panthers or water spirits, built in the Late Woodland period, 1,400–750 years ago.", source: S.npsEffigyBuilders },
    ],
  },
  {
    id: "petersburg",
    cloudHalf: 200,
    name: "Petersburg Siege Lines",
    where: "Petersburg, Virginia",
    kind: "battlefield",
    tagline: "Civil War trenches still zig-zagging through the woods.",
    center: [-77.3777, 37.2183],
    zoom: 15,
    view: "multi",
    look: "The Crater, the pit that gave the July 30, 1864 battle its name, with trench lines running off through the trees.",
    wiki: "Petersburg_National_Battlefield",
    facts: [
      { text: "The campaign ran from the first assaults on June 15–17, 1864 to the Union breakthrough on April 2, 1865.", source: S.npsPetersburg },
      { text: "The park preserves 43 acres of earthworks — about 1.9 million square feet.", source: S.npsPetersburg },
      { text: "Fort Fisher was the largest fortification on the Petersburg front.", source: S.npsPetersburg },
    ],
  },
  {
    id: "carolina-bays",
    cloudHalf: 700,
    name: "Carolina Bays",
    where: "Bladen County, North Carolina",
    kind: "landform",
    tagline: "Thousands of oval hollows, all pointing the same way.",
    center: [-78.5954, 34.6827],
    zoom: 11.6,
    view: "tinted",
    look: "Overlapping ovals with raised rims, every one tilted northwest to southeast.",
    wiki: "Carolina_bays",
    facts: [
      { text: "Shallow oval depressions from 180 m to about 20 km long — all aligned northwest to southeast — from New Jersey to Florida, with a large cluster in the Carolinas.", source: S.eosBays },
      { text: "No one has a solid explanation for how they formed; scientists are split between impacts and wind- or water-driven erosion.", source: S.eosBays },
    ],
  },
];

export const siteById = (id: string) => SITES.find((s) => s.id === id);
