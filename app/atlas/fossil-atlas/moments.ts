/* Time-machine quick jumps. Each caption describes what the map shows at that moment;
   the Dinosaur National Monument and Fossil Butte ages are the NPS figures in featured.ts. */

/** Quick jumps. The map's own period name shows next to the caption, so captions don't repeat it. */
export const MOMENTS: { age: number; label: string; caption: string }[] = [
  { age: 500, label: "Cambrian", caption: "early animals — life is still almost all in the sea" },
  { age: 300, label: "Coal swamps", caption: "North America straddles the equator" },
  { age: 250, label: "Pangaea", caption: "the continents are joined as Pangaea" },
  { age: 150, label: "Jurassic giants", caption: "when the Dinosaur National Monument bones were buried" },
  { age: 90, label: "Inland sea", caption: "a seaway splits North America in two" },
  { age: 65, label: "End of the dinosaurs", caption: "the last of the non-bird dinosaurs" },
  { age: 50, label: "Fossil Lake", caption: "around the time of Fossil Butte's fish" },
  { age: 0, label: "Today", caption: "" },
];
