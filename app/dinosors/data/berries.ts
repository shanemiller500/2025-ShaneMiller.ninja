/** Cultivars share the berry food resource and the existing bush silhouette. */
export const BERRIES = [
  { crop: "berries", name: "Purple berries", color: "#67368b", shine: "#c39adf" },
  { crop: "redBerries", name: "Red berries", color: "#ba434e", shine: "#f6a29e" },
  { crop: "blueBerries", name: "Blue berries", color: "#416fa6", shine: "#a4c9ec" },
  { crop: "goldBerries", name: "Golden berries", color: "#ce973b", shine: "#ffe3a1" },
] as const;
export const berryCropVariant = (crop: string) => BERRIES.findIndex((b) => b.crop === crop);
