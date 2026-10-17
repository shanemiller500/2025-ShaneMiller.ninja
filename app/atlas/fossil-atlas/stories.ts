import type { AtlasStory, StoryDoc } from "@/components/atlas/story";

/* ------------------------------------------------------------------ */
/*  Prehistoric USA stories, told from official records: the NPS       */
/*  Dinosaur National Monument Geologic Resource Evaluation (2006),    */
/*  NPS Occasional Paper 3 on Fossil Butte (McGrew & Casilliano),      */
/*  NPS park pages, and the USGS White Sands footprint fact sheet.     */
/*  What the ancient maps show is the PALEOMAP reconstruction's.       */
/*                                                                     */
/*  Action kinds:                                                      */
/*    time       open the time machine (value = age in Ma)             */
/*    park       open a featured park (value = park id)                */
/*    fly        3D flyover of a featured park (value = park id)       */
/*    formation  show every site in one rock formation (value = name)  */
/*    today      back to today's map                                   */
/* ------------------------------------------------------------------ */

export type FossilAction = "time" | "park" | "fly" | "formation" | "today";

export const DINO_GRE_DOC: StoryDoc = {
  title: "Dinosaur National Monument — Geologic Resource Evaluation Report (NRR-2006/008)",
  url: "https://www.npshistory.com/publications/dino/nrr-2006-008.pdf",
  source: "National Park Service",
  year: 2006,
};
export const FOBU_OP3_DOC: StoryDoc = {
  title: "The Geologic History of Fossil Butte National Monument and Fossil Basin (NPS Occasional Paper 3)",
  url: "https://www.npshistory.com/series/occasional_papers/3/op3.pdf",
  source: "National Park Service",
  year: 1975,
};
const WHSA_FS_DOC: StoryDoc = {
  title: "Fossil Footprints and Ice Age Ecosystems of White Sands National Park (Fact Sheet 2025–3046)",
  url: "https://doi.org/10.3133/fs20253046",
  source: "U.S. Geological Survey",
  year: 2026,
};
const MOSASAUR_DOC: StoryDoc = { title: "Mosasaur: Apex Predator of the Western Interior Seaway", url: "https://www.nps.gov/articles/000/mosasaur.htm", source: "National Park Service" };
const DINO_HALL_DOC: StoryDoc = { title: "Quarry Exhibit Hall", url: "https://www.nps.gov/dino/planyourvisit/quarry-exhibit-hall.htm", source: "National Park Service" };
const FOBU_DOC: StoryDoc = { title: "Fossil Butte National Monument", url: "https://www.nps.gov/fobu/index.htm", source: "National Park Service" };
const WHSA_DOC: StoryDoc = { title: "Fossilized Footprints", url: "https://www.nps.gov/whsa/learn/nature/fossilized-footprints.htm", source: "National Park Service" };
const PALEOMAP_DOC: StoryDoc = { title: "PALEOMAP Paleodigital Elevation Models (PaleoDEMs) for the Phanerozoic", url: "https://doi.org/10.5281/zenodo.5460860", source: "C. R. Scotese & N. M. Wright", year: 2018 };

const QUARRY: [number, number] = [-109.3013, 40.4406];
const BADLANDS: [number, number] = [-102.34, 43.75];
const FOSSIL_BUTTE: [number, number] = [-110.7619, 41.8557];
const WHITE_SANDS: [number, number] = [-106.1714, 32.7797];

export const FOSSIL_STORIES: AtlasStory<FossilAction>[] = [
  {
    id: "inland-sea",
    title: "The inland sea",
    subtitle: "When an ocean ran through the middle of North America.",
    when: "Cretaceous",
    color: "#7FC64E",
    docs: [DINO_GRE_DOC, MOSASAUR_DOC, PALEOMAP_DOC],
    chapters: [
      {
        title: "A sea from the Gulf to the Arctic",
        date: "~90 million years ago",
        body: [
          "In the Cretaceous the seas advanced and retreated across the continent many times, until the most extensive interior seaway ever recorded drowned much of western North America.",
          "The Western Interior Seaway stretched from today's Gulf of Mexico to the Arctic Ocean — about 3,000 miles.",
        ],
        camera: { center: [-100, 41], zoom: 3.2 },
        actions: [{ label: "See it in the time machine", kind: "time", value: 90 }],
      },
      {
        title: "Mountains on one shore, plains on the other",
        body: [
          "The seaway's western shore ran along the rising Sevier mountain belt. Its eastern edge was a low, stable platform in what is now Nebraska and Kansas.",
          "Mud on the sea floor became the Mancos Shale and, to the east, the Pierre Shale. At Dinosaur National Monument the Mancos Shale forms the flat plain on the way into the dinosaur quarry.",
        ],
        camera: { center: [-104, 41], zoom: 4.2 },
        actions: [
          { label: "Fossil sites in the Mancos Shale", kind: "formation", value: "Mancos Shale" },
          { label: "…and the Pierre Shale", kind: "formation", value: "Pierre Shale" },
        ],
      },
      {
        title: "Sea monsters of South Dakota",
        date: "75–69 million years ago",
        body: [
          "Where Badlands National Park is today, the sea was roughly 400 meters deep. Its top predators were mosasaurs — marine lizards up to 50 feet long that would eat anything they could catch.",
          "Their fossils are found in the Pierre Shale, laid down in the seaway 75 to 69 million years ago.",
        ],
        camera: { center: BADLANDS, zoom: 8, pitch: 40 },
        actions: [{ label: "The seaway at 75 million years", kind: "time", value: 75 }],
      },
      {
        title: "The sea drains away",
        body: [
          "Step forward to the end of the Cretaceous. In this reconstruction the seaway has drained from the middle of the continent by 65 million years ago — the same time the last non-bird dinosaurs disappear.",
        ],
        camera: { center: [-100, 41], zoom: 3.2 },
        actions: [
          { label: "End of the Cretaceous", kind: "time", value: 65 },
          { label: "Back to today", kind: "today" },
        ],
      },
    ],
  },
  {
    id: "dinosaur-quarry",
    title: "Dinosaur Quarry",
    subtitle: "A Jurassic logjam of giants, and the man who found it.",
    when: "Jurassic · 1909",
    color: "#34B2C9",
    docs: [DINO_GRE_DOC, DINO_HALL_DOC],
    chapters: [
      {
        title: "Rivers in the Jurassic",
        date: "~150 million years ago",
        body: [
          "In Morrison time, dinosaurs were log-jammed in rivers here — caught in floods or drowned — much as bison carcasses once collected in the bends of the Missouri and Platte.",
          "Flood sediment buried the bones fast. Big limb bones still lie parallel to the old current, and small bones were carried farther downstream.",
        ],
        camera: { center: [-105, 40], zoom: 3.4 },
        actions: [{ label: "The world 150 million years ago", kind: "time", value: 150 }],
      },
      {
        title: "Eight tailbones",
        date: "August 1909",
        body: [
          "Earl Douglass of the Carnegie Museum spent months searching northeastern Utah. In August 1909 he found eight large dinosaur tail vertebrae lying in the exact position they had held in the living animal.",
          "It was an Apatosaurus of exceptional size and completeness — and it proved for the first time that Apatosaurus had a very long, whip-like tail.",
        ],
        camera: { center: QUARRY, zoom: 15.5, pitch: 60, bearing: 30 },
        actions: [
          { label: "Open Dinosaur National Monument", kind: "park", value: "dinosaur" },
          { label: "Fly over in 3D", kind: "fly", value: "dinosaur" },
        ],
      },
      {
        title: "Bones are not minerals",
        date: "October 4, 1915",
        body: [
          "Douglass filed a mining claim for the quarry, but officials ruled that dinosaur bones were not minerals under the General Mining Law of 1872.",
          "The case reached President Woodrow Wilson, who on October 4, 1915 set aside 80 acres around the quarry as a national monument. In 1938 it grew to take in the canyons of the Green and Yampa rivers.",
        ],
        camera: { center: QUARRY, zoom: 12, pitch: 45 },
      },
      {
        title: "A wall of bones",
        body: [
          "The quarry gave up the remains of over 400 animals, making it one of the greatest dinosaur localities ever found.",
          "Today the Quarry Exhibit Hall shows a wall of over 1,500 bones from 8 dinosaur species, left in the rock of the Morrison Formation.",
        ],
        camera: { center: QUARRY, zoom: 14, pitch: 50 },
        actions: [{ label: "Every Morrison fossil site", kind: "formation", value: "Morrison" }],
      },
    ],
  },
  {
    id: "fossil-lake",
    title: "Fossil Lake",
    subtitle: "Palms, crocodiles and millions of fish in Eocene Wyoming.",
    when: "Eocene · 52 million years ago",
    color: "#FD9A52",
    docs: [FOBU_OP3_DOC, FOBU_DOC],
    chapters: [
      {
        title: "Three lakes in the Rockies",
        date: "~52 million years ago",
        body: [
          "As the Rocky Mountains rose, three freshwater lakes filled the basins between them across Wyoming, Colorado and Utah — Lake Gosiute, Lake Uinta and the smallest, Fossil Lake.",
          "Together they are the Green River Lake System, and their muds are now the Green River Formation.",
        ],
        camera: { center: [-109, 41], zoom: 5.5 },
        actions: [
          { label: "The world 50 million years ago", kind: "time", value: 50 },
          { label: "Green River Formation sites", kind: "formation", value: "Green River" },
        ],
      },
      {
        title: "Palms in Wyoming",
        body: [
          "The shores were a warm, humid forest of palm, cinnamon, maple and oak. Crocodiles and turtles basked on the beaches and flamingos gathered in nesting grounds.",
          "Early members of the horse family browsed the undergrowth, and early primates lived in the trees.",
        ],
        camera: { center: FOSSIL_BUTTE, zoom: 11, pitch: 45 },
      },
      {
        title: "How a lake keeps its fish",
        body: [
          "Every so often, fish in the lake died in great numbers. They sank to the bottom and were preserved in the lake mud. Many of these shales appear varved — paired layers, one of carbonate and one of organic material.",
          "The most common fossil fish here is Knightia eocaena.",
        ],
        camera: { center: FOSSIL_BUTTE, zoom: 13, pitch: 55, bearing: 20 },
        actions: [{ label: "Open Fossil Butte", kind: "park", value: "fossil-butte" }],
      },
      {
        title: "Petrified Fish Cut",
        date: "1860s",
        body: [
          "Workers building the Union Pacific Railroad in the 1860s blasted a cut through Green River shale near Green River, Wyoming, and found well-preserved fish — “Petrified Fish Cut”.",
          "Fish from Fossil Butte have been collected and sold since the 1870s, and hang in museums and living rooms around the world.",
        ],
        camera: { center: FOSSIL_BUTTE, zoom: 12, pitch: 60, bearing: -20 },
        actions: [{ label: "Fly over Fossil Butte in 3D", kind: "fly", value: "fossil-butte" }],
      },
    ],
  },
  {
    id: "footprints",
    title: "Footprints by the lake",
    subtitle: "Children walking an Ice Age shore 23,000 years ago.",
    when: "Ice Age",
    color: "#F9F97F",
    docs: [WHSA_FS_DOC, WHSA_DOC],
    chapters: [
      {
        title: "Lake Otero",
        date: "Last Glacial Maximum",
        body: [
          "During the Ice Age, Lake Otero filled the Tularosa Basin of south-central New Mexico. Wind later scoured its sediments into the largest gypsum dune field in the world — White Sands.",
        ],
        camera: { center: WHITE_SANDS, zoom: 9.5, pitch: 30 },
        actions: [{ label: "Open White Sands", kind: "park", value: "white-sands" }],
      },
      {
        title: "Older than anyone thought",
        date: "September 2021",
        body: [
          "For most of the 20th century, archaeologists thought the first people arrived in the Americas about 13,000 years ago.",
          "In 2021, the National Park Service, USGS scientists and an international team showed that human footprints here were made between 23,000 and 21,000 years ago — while ice sheets covered much of the continent.",
        ],
        camera: { center: WHITE_SANDS, zoom: 11, pitch: 45 },
      },
      {
        title: "Teenagers and children",
        body: [
          "The team excavated 61 footprints from 8 layers at one site. Most were left by teenagers and children between 9 and 14.",
          "Dire wolves, saber-toothed cats, giant ground sloths, camels and mammoths walked the same shore — and one human trackway runs back and forth for more than 1.5 kilometers, the longest known.",
        ],
        camera: { center: WHITE_SANDS, zoom: 12, pitch: 55, bearing: 25 },
        actions: [{ label: "Fly over in 3D", kind: "fly", value: "white-sands" }],
      },
      {
        title: "Checking the clock",
        date: "2023",
        body: [
          "The first dates came from seeds of an aquatic plant, and some scientists worried the seeds had soaked up old carbon from the water, making them look too old.",
          "So the team dated pine pollen — about 75,000 grains per sample — and quartz grains from the same layers. The ages matched the seeds, showing the original dates were right.",
        ],
        camera: { center: WHITE_SANDS, zoom: 10, pitch: 35 },
        actions: [{ label: "Back to today's map", kind: "today" }],
      },
    ],
  },
];

export const fossilStoryById = (id: string) => FOSSIL_STORIES.find((s) => s.id === id);
