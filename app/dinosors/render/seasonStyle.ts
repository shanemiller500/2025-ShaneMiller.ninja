import type { SeasonId } from "../sim/seasons";
import { T, type Plant } from "../sim/types";

export function seasonalTerrainColor(tile: T, base: [number, number, number], season: SeasonId): [number, number, number] {
  const green = tile === T.Grass || tile === T.Forest || tile === T.Jungle || tile === T.Swamp;
  if (green) {
    const colors: Record<SeasonId, [number, number, number]> = {
      spring: [125, 188, 96], summer: [160, 184, 76], autumn: [177, 143, 83], winter: [197, 215, 216],
    };
    const target = colors[season], blend = tile === T.Grass ? 1 : 0.7;
    return base.map((n, i) => Math.round(n * (1 - blend) + target[i] * blend)) as [number, number, number];
  }
  if (season === "winter" && [T.Sand, T.Dune, T.Dirt, T.Mud, T.Nest, T.Rock, T.Cliff, T.Mountain].includes(tile)) {
    return base.map((n, i) => Math.round(n * 0.4 + [215, 223, 222][i] * 0.6)) as [number, number, number];
  }
  if (tile === T.Deep || tile === T.Shallow || tile === T.River) {
    if (season === "winter") return base.map((n, i) => Math.round(n * 0.65 + [115, 155, 181][i] * 0.35)) as [number, number, number];
    if (season === "summer") return [base[0], Math.min(255, base[1] + 8), base[2]];
  }
  return [...base];
}

/** Dark, body, sunlit and highlight colors; evergreens keep their character in autumn. */
export function seasonalLeaves(kind: Plant["kind"], variant: number, season: SeasonId): [string, string, string, string] | null {
  if (season === "spring") return ["#315b31", "#528b40", "#7db65c", "#b1d880"];
  if (season === "summer") return ["#244c28", "#3c7935", "#63a347", "#92c961"];
  if (season === "winter") return ["#617979", "#90a9a4", "#c5d7d1", "#f0f5ed"];
  if (kind === "conifer" || kind === "palm" || kind === "cycad") return null;
  return [
    ["#70492d", "#b7773c", "#d79b50", "#ecd188"],
    ["#78472f", "#b26039", "#d78647", "#edb36b"],
    ["#756132", "#b49a44", "#d5bd65", "#e8d895"],
    ["#663d32", "#9c5140", "#c27850", "#dfa87d"],
  ][variant % 4] as [string, string, string, string];
}
