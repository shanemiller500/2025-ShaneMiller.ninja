import { ALIGNMENT, alignmentOf, type Hero } from "./roster";

/** Visual palette only. Never used to infer a character's story or allegiance. */
export function characterAccent(hero: Hero): { primary: string; secondary: string } {
  const name = hero.name.toLowerCase();
  if (name.includes("spider-man") || name.includes("spider man")) return { primary: "#e34b56", secondary: "#4c8de5" };
  if (name.includes("hulk")) return { primary: "#75ba58", secondary: "#a879d2" };
  if (name.includes("iron man")) return { primary: "#df6251", secondary: "#e9ba56" };
  if (name === "thor" || name.startsWith("thor ")) return { primary: "#6ba9e6", secondary: "#c6d3de" };
  if (name.includes("black panther")) return { primary: "#a37bd7", secondary: "#9aa5b5" };
  if (name.includes("doctor strange")) return { primary: "#e06857", secondary: "#6c9de4" };
  return { primary: ALIGNMENT[alignmentOf(hero)].hex, secondary: "#fbbf24" };
}
