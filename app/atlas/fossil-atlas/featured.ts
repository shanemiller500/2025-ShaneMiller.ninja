/* ------------------------------------------------------------------ */
/*  Featured fossil parks. Every fact comes from the National Park     */
/*  Service page it links to (checked October 2026). Positions are the */
/*  parks' fossil sites or visitor centres; White Sands' footprint     */
/*  sites aren't published, so its marker is the park.                 */
/* ------------------------------------------------------------------ */

export interface Source {
  label: string;
  url: string;
}
export interface Fact {
  text: string;
  source: Source;
}

export interface FossilPark {
  id: string;
  name: string;
  where: string;
  /** e.g. "Late Jurassic · ~150 million years ago" */
  age: string;
  tagline: string;
  accent: string;
  /** [lng, lat] */
  center: [number, number];
  approximate?: boolean;
  zoom: number;
  wiki: string;
  facts: Fact[];
  site: Source;
}

const S = {
  dinoHall: { label: "NPS", url: "https://www.nps.gov/dino/planyourvisit/quarry-exhibit-hall.htm" },
  dinoQuarry: { label: "NPS", url: "https://www.nps.gov/dino/learn/historyculture/carnegie_quarry.htm" },
  whsa: { label: "NPS", url: "https://www.nps.gov/whsa/learn/nature/fossilized-footprints.htm" },
  pefo: { label: "NPS", url: "https://www.nps.gov/pefo/learn/nature/fossils.htm" },
  fobu: { label: "NPS", url: "https://www.nps.gov/fobu/index.htm" },
  flfo: { label: "NPS", url: "https://www.nps.gov/flfo/index.htm" },
  agfo: { label: "NPS", url: "https://www.nps.gov/agfo/index.htm" },
  joda: { label: "NPS", url: "https://www.nps.gov/joda/index.htm" },
  messel: { label: "UNESCO", url: "https://whc.unesco.org/en/list/720/" },
  chengjiang: { label: "UNESCO", url: "https://whc.unesco.org/en/list/1388/" },
  ischigualasto: { label: "UNESCO", url: "https://whc.unesco.org/en/list/966/" },
  dpp: { label: "UNESCO", url: "https://whc.unesco.org/en/list/71/" },
  jurassic: { label: "UNESCO", url: "https://whc.unesco.org/en/list/1029/" },
  rockies: { label: "UNESCO", url: "https://whc.unesco.org/en/list/304/" },
} satisfies Record<string, Source>;

export const FOSSIL_PARKS: FossilPark[] = [
  {
    id: "dinosaur",
    name: "Dinosaur National Monument",
    where: "Utah–Colorado border",
    age: "Late Jurassic · ~150 million years ago",
    tagline: "A wall of 1,500 dinosaur bones, left where they lay.",
    accent: "#34B2C9",
    center: [-109.3013, 40.4406],
    zoom: 14,
    wiki: "Dinosaur_National_Monument",
    facts: [
      { text: "On August 17, 1909, Earl Douglass found eight Apatosaurus tailbones “in exact position” — the first bones of the Carnegie Quarry. His team went on to remove over 300 tons of fossils.", source: S.dinoQuarry },
      { text: "On October 4, 1915, President Woodrow Wilson proclaimed the quarry and about 80 acres around it Dinosaur National Monument.", source: S.dinoQuarry },
      { text: "The Quarry Exhibit Hall's wall holds over 1,500 bones of 8 dinosaur species from the Late Jurassic, about 150 million years old, in the Morrison Formation.", source: S.dinoHall },
    ],
    site: { label: "Dinosaur National Monument (NPS)", url: "https://www.nps.gov/dino/" },
  },
  {
    id: "white-sands",
    name: "White Sands",
    where: "Tularosa Basin, New Mexico",
    age: "Ice Age · ~23,000–21,000 years ago",
    tagline: "Footprints of children playing beside an Ice Age lake.",
    accent: "#F9F97F",
    center: [-106.1714, 32.7797],
    approximate: true,
    zoom: 10,
    wiki: "White_Sands_National_Park",
    facts: [
      { text: "Seeds found above and below human footprints here date to about 22,860 and 21,130 years ago — people were living in the Tularosa Basin at least 23,000 years ago, as reported in the journal Science.", source: S.whsa },
      { text: "Most of the footprints in the study were left by teenagers and children. Harlan's ground sloth and dire wolf tracks were found here too.", source: S.whsa },
      { text: "White Sands has the largest collection of fossilized human footprints.", source: S.whsa },
    ],
    site: { label: "White Sands National Park (NPS)", url: "https://www.nps.gov/whsa/" },
  },
  {
    id: "petrified-forest",
    name: "Petrified Forest",
    where: "Northeastern Arizona",
    age: "Triassic · over 200 million years ago",
    tagline: "Logs turned to stone at the dawn of the dinosaurs.",
    accent: "#812B92",
    center: [-109.7879, 34.9099],
    zoom: 11,
    wiki: "Petrified_Forest_National_Park",
    facts: [
      { text: "Its plant and animal fossils come from the Triassic Period, more than 200 million years ago — sometimes called the “Dawn of the Dinosaurs”.", source: S.pefo },
      { text: "Petrified wood is the fossilized remnant of ancient trees.", source: S.pefo },
    ],
    site: { label: "Petrified Forest National Park (NPS)", url: "https://www.nps.gov/pefo/" },
  },
  {
    id: "fossil-butte",
    name: "Fossil Butte",
    where: "Southwestern Wyoming",
    age: "Eocene · 52 million years ago",
    tagline: "A warm lake that turned into a fossil library.",
    accent: "#FD9A52",
    center: [-110.7619, 41.8557],
    zoom: 12,
    wiki: "Fossil_Butte_National_Monument",
    facts: [
      { text: "Its fossils come from 52-million-year-old Fossil Lake, from the Eocene, when the area was warm and wet.", source: S.fobu },
      { text: "The most common fossil fish here is Knightia eocaena; the visitor centre shows fishes, insects, plants, reptiles, birds and mammals from the Green River Formation.", source: S.fobu },
    ],
    site: { label: "Fossil Butte National Monument (NPS)", url: "https://www.nps.gov/fobu/" },
  },
  {
    id: "florissant",
    name: "Florissant Fossil Beds",
    where: "Central Colorado",
    age: "Late Eocene · 34 million years ago",
    tagline: "Giant redwood stumps and insects pressed in paper shale.",
    accent: "#FDA75F",
    center: [-105.2856, 38.9136],
    zoom: 13,
    wiki: "Florissant_Fossil_Beds_National_Monument",
    facts: [
      { text: "A flow of volcanic debris blocked a stream about 34 million years ago and formed ancient Lake Florissant. Fine layers of ash and diatoms became “paper shale” that preserved leaves, seeds and especially delicate insects and spiders.", source: S.flfo },
      { text: "A fast-moving volcanic mudflow — a lahar — buried the bases of giant redwoods. Some stumps are up to 14 feet wide; some trees were over 230 feet tall.", source: S.flfo },
    ],
    site: { label: "Florissant Fossil Beds National Monument (NPS)", url: "https://www.nps.gov/flfo/" },
  },
  {
    id: "agate",
    name: "Agate Fossil Beds",
    where: "Northwestern Nebraska",
    age: "Miocene · ~20 million years ago",
    tagline: "Whole skeletons of the mammals of the Miocene plains.",
    accent: "#FFE619",
    center: [-103.7322, 42.4243],
    zoom: 12,
    wiki: "Agate_Fossil_Beds_National_Monument",
    facts: [
      { text: "The park preserves full skeletons of extinct Miocene mammals and is the world's leading source of them.", source: S.agfo },
      { text: "Among them is Dinohyus, a scavenger nicknamed the “Terrible Pig” — the top predator of the plains some 20 million years ago.", source: S.agfo },
    ],
    site: { label: "Agate Fossil Beds National Monument (NPS)", url: "https://www.nps.gov/agfo/" },
  },
  {
    id: "john-day",
    name: "John Day Fossil Beds",
    where: "Central Oregon",
    age: "Cenozoic",
    tagline: "Painted hills of fossil soils, and the forests that became grasslands.",
    accent: "#FFB86B",
    center: [-120.2617, 44.6598],
    zoom: 12,
    wiki: "John_Day_Fossil_Beds_National_Monument",
    facts: [
      { text: "Three units: the Painted Hills (ancient fossilized soils), Sheep Rock and Clarno, whose palisades are the remains of ancient volcanic mudslides.", source: S.joda },
      { text: "Its fossils record rhino-like brontotheres in a semitropical forest and dog-sized three-toed horses — and a climate that cooled as forests gave way to drier grasslands.", source: S.joda },
    ],
    site: { label: "John Day Fossil Beds National Monument (NPS)", url: "https://www.nps.gov/joda/" },
  },
  {
    id: "messel",
    name: "Messel Pit",
    where: "Hesse, Germany",
    age: "Eocene · 57–36 million years ago",
    tagline: "Whole Eocene animals, down to their last meals.",
    accent: "#a3e635",
    center: [8.757, 49.918],
    zoom: 14,
    wiki: "Messel_Pit",
    facts: [
      { text: "The richest site in the world for understanding the living environment of the Eocene, between 57 and 36 million years ago.", source: S.messel },
      { text: "Its mammal fossils are exceptionally well preserved — from fully articulated skeletons to the contents of their stomachs — and show the early stages of mammal evolution.", source: S.messel },
      { text: "Inscribed as a World Heritage Site in 1995.", source: S.messel },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/720/" },
  },
  {
    id: "chengjiang",
    name: "Chengjiang Fossil Site",
    where: "Yunnan, China",
    age: "Early Cambrian · ~530 million years ago",
    tagline: "A snapshot of the Cambrian explosion, soft parts and all.",
    accent: "#f472b6",
    center: [102.9772, 24.6689],
    zoom: 12,
    wiki: "Maotianshan_Shales",
    facts: [
      { text: "A hilly 512-hectare site holding the most complete record of an early Cambrian marine community, with both hard and soft tissues preserved.", source: S.chengjiang },
      { text: "It documents at least sixteen phyla and about 196 species from 530 million years ago, when almost all of today's major animal groups emerged.", source: S.chengjiang },
      { text: "Inscribed as a World Heritage Site in 2012.", source: S.chengjiang },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/1388/" },
  },
  {
    id: "ischigualasto",
    name: "Ischigualasto & Talampaya",
    where: "San Juan & La Rioja, Argentina",
    age: "Triassic · 245–208 million years ago",
    tagline: "The most complete record of life on land in the Triassic.",
    accent: "#fb923c",
    center: [-67.9118, -30.1168],
    zoom: 11,
    wiki: "Ischigualasto_Provincial_Park",
    facts: [
      { text: "Two neighbouring desert parks covering 275,300 hectares on the western edge of the Sierras Pampeanas.", source: S.ischigualasto },
      { text: "Together they hold the most complete continental fossil record known from the Triassic Period.", source: S.ischigualasto },
      { text: "Six geological formations contain fossils of ancestors of mammals, dinosaurs and plants.", source: S.ischigualasto },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/966/" },
  },
  {
    id: "dinosaur-provincial",
    name: "Dinosaur Provincial Park",
    where: "Alberta, Canada",
    age: "Late Cretaceous · ~75 million years ago",
    tagline: "Badlands holding about 35 species of dinosaur.",
    accent: "#fbbf24",
    center: [-111.485, 50.7617],
    zoom: 12,
    wiki: "Dinosaur_Provincial_Park",
    facts: [
      { text: "In the heart of Alberta's badlands, it holds some of the most important fossil discoveries ever made from the Age of Reptiles.", source: S.dpp },
      { text: "About 35 species of dinosaur have been found here, dating back some 75 million years.", source: S.dpp },
      { text: "Inscribed as a World Heritage Site in 1979.", source: S.dpp },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/71/" },
  },
  {
    id: "jurassic-coast",
    name: "Jurassic Coast",
    where: "Dorset & East Devon, England",
    age: "Mesozoic · ~185 million years",
    tagline: "185 million years of Earth history along one stretch of cliffs.",
    accent: "#38bdf8",
    center: [-2.9899, 50.7056],
    approximate: true,
    zoom: 10,
    wiki: "Jurassic_Coast",
    facts: [
      { text: "The cliffs expose an almost continuous sequence of rocks spanning the Mesozoic Era — some 185 million years of Earth's history.", source: S.jurassic },
      { text: "Its fossil sites and coastal landforms have been studied by earth scientists for over 300 years.", source: S.jurassic },
      { text: "Inscribed as a World Heritage Site in 2001. The point marks the middle of a long coast.", source: S.jurassic },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/1029/" },
  },
  {
    id: "burgess",
    name: "Burgess Shale",
    where: "Yoho National Park, British Columbia, Canada",
    age: "Cambrian",
    tagline: "Soft-bodied sea animals from the Cambrian, preserved in mountain rock.",
    accent: "#818cf8",
    center: [-116.467, 51.4333],
    zoom: 13,
    wiki: "Burgess_Shale",
    facts: [
      { text: "The Burgess Shale fossil site is well known for its fossil remains of soft-bodied marine animals.", source: S.rockies },
      { text: "It lies within the Canadian Rocky Mountain Parks World Heritage Site — Banff, Jasper, Kootenay and Yoho national parks and three provincial parks.", source: S.rockies },
    ],
    site: { label: "UNESCO World Heritage listing", url: "https://whc.unesco.org/en/list/304/" },
  },
];

export const parkById = (id: string) => FOSSIL_PARKS.find((p) => p.id === id);
