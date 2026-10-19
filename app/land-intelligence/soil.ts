export const SOIL_CATEGORIES = [
  { id: "clay", label: "Clay rich", color: "#b87968" },
  { id: "loam", label: "Loam", color: "#d6a35e" },
  { id: "sand", label: "Sand", color: "#e5d18b" },
  { id: "silt", label: "Silt", color: "#9eaa79" },
  { id: "rock", label: "Rock / shallow", color: "#9ca3af" },
  { id: "water", label: "Water / wet", color: "#66a8bb" },
  { id: "developed", label: "Developed", color: "#a58bb5" },
  { id: "other", label: "Other map unit", color: "#88a991" },
] as const;

// A visual grouping of map-unit *names*, not a laboratory texture classification.
export function soilCategory(name: string) {
  const value = name.toLowerCase();
  if (/water|marsh|muck|peat|tidal|wetland/.test(value)) return "water";
  if (/urban|built|pits|dump|mine|disturbed/.test(value)) return "developed";
  if (/rock|bedrock|stony|very shallow|outcrop/.test(value)) return "rock";
  if (/clay/.test(value)) return "clay";
  if (/sandy|sand|dune/.test(value)) return "sand";
  if (/silt/.test(value)) return "silt";
  if (/loam/.test(value)) return "loam";
  return "other";
}
