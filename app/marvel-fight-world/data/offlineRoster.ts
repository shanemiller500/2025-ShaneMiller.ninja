/* Small local roster so the game remains playable when the character CDN is down.
 * These are game balance presets, not a copy of the external character dataset. */
import { buildFighter, type HeroLike } from "../engine/fighters";
import type { FighterDef, Stats } from "../engine/types";

type Preset = { id: number; name: string; alignment: "good" | "bad"; color: string; stats: Stats };
const presets: Preset[] = [
  { id: 620, name: "Spider-Man", alignment: "good", color: "#dc2626", stats: { intelligence: 90, strength: 55, speed: 67, durability: 75, power: 74, combat: 85 } },
  { id: 332, name: "Hulk", alignment: "good", color: "#4f9e3a", stats: { intelligence: 88, strength: 100, speed: 63, durability: 100, power: 98, combat: 85 } },
  { id: 149, name: "Captain America", alignment: "good", color: "#2563eb", stats: { intelligence: 69, strength: 19, speed: 38, durability: 55, power: 60, combat: 100 } },
  { id: 90004, name: "Wolverine", alignment: "good", color: "#eab308", stats: { intelligence: 65, strength: 45, speed: 50, durability: 90, power: 55, combat: 95 } },
  { id: 90005, name: "Iron Man", alignment: "good", color: "#b91c1c", stats: { intelligence: 95, strength: 65, speed: 70, durability: 80, power: 95, combat: 65 } },
  { id: 90006, name: "Thor", alignment: "good", color: "#64748b", stats: { intelligence: 70, strength: 95, speed: 70, durability: 95, power: 100, combat: 80 } },
  { id: 90007, name: "Black Panther", alignment: "good", color: "#4338ca", stats: { intelligence: 85, strength: 45, speed: 75, durability: 70, power: 55, combat: 95 } },
  { id: 90008, name: "Doctor Strange", alignment: "good", color: "#7c3aed", stats: { intelligence: 95, strength: 30, speed: 45, durability: 65, power: 100, combat: 75 } },
  { id: 90009, name: "Deadpool", alignment: "good", color: "#b91c1c", stats: { intelligence: 65, strength: 35, speed: 65, durability: 90, power: 60, combat: 85 } },
  { id: 90010, name: "Venom", alignment: "bad", color: "#1e293b", stats: { intelligence: 65, strength: 80, speed: 60, durability: 85, power: 75, combat: 75 } },
  { id: 90011, name: "Magneto", alignment: "bad", color: "#be185d", stats: { intelligence: 90, strength: 35, speed: 55, durability: 70, power: 100, combat: 80 } },
  { id: 90012, name: "Thanos", alignment: "bad", color: "#1d4ed8", stats: { intelligence: 90, strength: 100, speed: 55, durability: 100, power: 100, combat: 90 } },
];

function portrait(name: string, color: string) {
  const initials = name.split(/[ -]/).map((part) => part[0]).join("").slice(0, 3).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 480"><rect width="320" height="480" fill="#080d1c"/><path d="M-80 400 280-40h120L40 480Z" fill="${color}" opacity=".6"/><circle cx="160" cy="198" r="75" fill="${color}" opacity=".35"/><path d="M44 480c0-120 45-177 116-177s116 57 116 177" fill="${color}" opacity=".55"/><text x="160" y="455" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="45" font-weight="900">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function offlineFighters(): FighterDef[] {
  return presets.map(({ id, name, alignment, color, stats }) => {
    const image = portrait(name, color);
    const hero: HeroLike = { id, name, powerstats: stats, biography: { fullName: name, alignment }, images: { xs: image, sm: image, md: image, lg: image } };
    return buildFighter(hero);
  });
}
