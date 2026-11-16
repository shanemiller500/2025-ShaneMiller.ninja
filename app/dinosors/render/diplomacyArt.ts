import type { Caravan } from "../sim/diplomacy";
import { PERSONALITIES } from "../sim/diplomacy";
import { isWaterTile } from "../sim/terrain";
import type { World } from "../sim/world";
import { MAP_W, TILE } from "../sim/types";

/** Small physical trade parties, drawn in the same depth order as people and buildings. */
export function drawCaravan(c: CanvasRenderingContext2D, w: World, caravan: Caravan, time: number) {
  const kind = caravan.faction.split(":")[0] as keyof typeof PERSONALITIES;
  const sea = kind === "sea" && isWaterTile(w.terrain.tileAt(caravan.x, caravan.y));
  const bob = Math.sin(time * 5 + caravan.id) * 1.5;
  const next = caravan.route[caravan.step];
  const direction = next === undefined || ((next % MAP_W) * TILE) >= caravan.x ? 1 : -1;
  c.save(); c.translate(caravan.x, caravan.y); c.scale(direction, 1);
  c.fillStyle = "rgba(9,18,28,.24)"; c.beginPath(); c.ellipse(0, 2, 34, 9, 0, 0, Math.PI * 2); c.fill();
  if (sea) {
    c.fillStyle = "#815434"; c.beginPath(); c.moveTo(-41, -2); c.quadraticCurveTo(-28, 17, 32, 6); c.lineTo(42, -5); c.closePath(); c.fill();
    c.strokeStyle = "#d4ba78"; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, -20 + bob); c.lineTo(-38, 10); c.stroke();
  } else if (kind === "sand") {
    c.strokeStyle = "#cba269"; c.lineWidth = 4;
    for (const x of [-18, 15]) { c.beginPath(); c.moveTo(x, -9); c.lineTo(x + Math.sin(time * 6 + x) * 5, 5); c.stroke(); }
    c.fillStyle = "#d3ad72"; c.beginPath(); c.ellipse(0, -17 + bob, 27, 12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(2, -29 + bob, 10, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(22, -41 + bob, 6, 26); c.beginPath(); c.ellipse(28, -40 + bob, 10, 5, 0, 0, Math.PI * 2); c.fill();
  } else {
    c.strokeStyle = kind === "snow" ? "#c8e4ea" : "#78573a"; c.lineWidth = 3; c.beginPath(); c.moveTo(-30, 3); c.lineTo(24, 3); c.quadraticCurveTo(34, 3, 35, -7); c.stroke();
  }
  // Two traders and bundled, strapped cargo; the cargo changes after exchange.
  for (const x of [-20, 18]) {
    c.fillStyle = kind === "snow" ? "#dee9ea" : kind === "tree" ? "#609d60" : kind === "sea" ? "#32b8c9" : "#bd8b5b";
    c.fillRect(x - 4, -22 + bob, 9, 13);
    c.fillStyle = "#d6ae84"; c.beginPath(); c.arc(x, -27 + bob, 4.5, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = caravan.phase === "incoming" ? "#bd8a49" : "#91ac79"; c.fillRect(-12, -19 + bob, 23, 16);
  c.strokeStyle = "#efdc9d"; c.lineWidth = 2; c.strokeRect(-12, -19 + bob, 23, 16); c.beginPath(); c.moveTo(0, -19 + bob); c.lineTo(0, -3 + bob); c.stroke();
  c.scale(direction, 1); c.font = "bold 10px sans-serif"; c.textAlign = "center"; c.fillStyle = "#f3e8bb"; c.fillText("TRADE", 0, -43);
  c.restore();
}
