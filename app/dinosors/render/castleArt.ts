import type { Shelter } from "../sim/types";
import type { Estate, HomeLink } from "../sim/estate";
import { keepHeight, type CastleCompound } from "../sim/castleCompound";

type Ctx = CanvasRenderingContext2D;
const STONE = "#b9b8aa", EDGE = "#626f75", LIGHT = "#e2deca", ROOF = "#466976";

function arch(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h + w / 2);
  c.arc(x + w / 2, y - h + w / 2, w / 2, Math.PI, 0);
  c.lineTo(x + w, y); c.closePath(); c.fill();
}

function masonry(c: Ctx, x: number, y: number, w: number, h: number) {
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, LIGHT); g.addColorStop(0.5, STONE); g.addColorStop(1, "#899392");
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.strokeStyle = "rgba(67,81,85,.3)"; c.lineWidth = 0.7;
  for (let r = 0; r < h / 8; r++) {
    const yy = y + r * 8;
    c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy);
    for (let xx = x + (r % 2 ? 7 : 0); xx < x + w; xx += 15) { c.moveTo(xx, yy); c.lineTo(xx, Math.min(y + h, yy + 8)); }
    c.stroke();
  }
  c.strokeStyle = EDGE; c.strokeRect(x, y, w, h);
}

function rail(c: Ctx, x: number, y: number, w: number) {
  c.fillStyle = LIGHT; c.fillRect(x - 1, y, w + 2, 2.5);
  c.fillRect(x - 2, y + 9, w + 4, 3);
  for (let xx = x; xx <= x + w; xx += 6) c.fillRect(xx, y, 2, 10);
  c.fillStyle = "#718184"; c.fillRect(x - 2, y + 12, w + 4, 2);
}

function statue(c: Ctx, x: number, y: number, mirror = 1) {
  c.save(); c.translate(x, y); c.scale(mirror, 1);
  c.fillStyle = "#778e8c"; c.fillRect(-5, -3, 10, 3);
  c.fillStyle = "#c8c8b5"; c.fillRect(-3, -6, 6, 3);
  c.beginPath(); c.moveTo(-3, -6); c.lineTo(-2, -16); c.lineTo(1, -17); c.lineTo(4, -6); c.fill();
  c.beginPath(); c.arc(0, -19, 2.4, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#c8c8b5"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -15); c.lineTo(6, -12); c.moveTo(6, -8); c.lineTo(6, -23); c.stroke();
  c.fillStyle = "#bdab68"; c.beginPath(); c.arc(6, -24, 1.5, 0, Math.PI * 2); c.fill();
  c.restore();
}

function turret(c: Ctx, x: number, night: boolean, t: number, banner: boolean) {
  masonry(c, x - 9, -70, 18, 70);
  arch(c, x - 3, -35, 6, 13, night ? "#f6d389" : "#304d5b");
  c.fillStyle = LIGHT; c.fillRect(x - 11, -72, 22, 5);
  for (let i = -1; i <= 1; i++) c.fillRect(x + i * 8 - 3, -79, 6, 8);
  c.fillStyle = ROOF;
  c.beginPath(); c.moveTo(x - 12, -79); c.lineTo(x, -101); c.lineTo(x + 12, -79); c.fill();
  c.fillStyle = "#789898"; c.beginPath(); c.moveTo(x, -101); c.lineTo(x + 12, -79); c.lineTo(x + 2, -79); c.fill();
  c.strokeStyle = "#c7b170"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, -101); c.lineTo(x, -113); c.stroke();
  if (banner) {
    c.fillStyle = "#dcac62";
    c.beginPath(); c.moveTo(x + 1, -113); c.quadraticCurveTo(x + 9, -117 + Math.sin(t * 2) * 2, x + 16, -111); c.lineTo(x + 12, -107); c.lineTo(x + 1, -108); c.fill();
  }
}

/** Contiguous apartment wings share walls and roof lines; only outer corners carry towers. */
export function drawCompoundWing(c: Ctx, units: number, beds: number, occupied: number, night: boolean, cutaway: boolean, corner: number) {
  const floors = Math.max(2, units + 1), h = floors * 26;
  c.fillStyle = "#7b8984"; c.fillRect(-33, -4, 66, 8);
  masonry(c, -32, -h, 64, h);
  const glow = night ? "#f5ce88" : "#344d55";
  for (let floor = 0; floor < floors; floor++) {
    const y = -floor * 26;
    c.fillStyle = LIGHT; c.fillRect(-33, y - 26, 66, 2);
    for (const x of [-23, -5, 13]) {
      arch(c, x - 1, y - 8, 11, 16, LIGHT); arch(c, x, y - 9, 9, 13, glow);
      c.strokeStyle = "#81918c"; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 4.5, y - 21); c.lineTo(x + 4.5, y - 9); c.stroke();
    }
  }
  arch(c, -7, 0, 14, 23, "#34474a");
  c.fillStyle = "#d1cbb2"; c.fillRect(-10, 0, 20, 3);
  rail(c, -15, -40, 30);
  if (cutaway) {
    c.fillStyle = "#a99b7e"; c.fillRect(-29, -h + 3, 58, h - 32);
    for (let i = 0; i < beds; i++) {
      const x = -27 + (i % 6) * 9, y = -h + 6 + Math.floor(i / 6) * 12;
      c.fillStyle = "#65513c"; c.fillRect(x, y, 8, 10);
      c.fillStyle = i < occupied ? "#6c9b9c" : "#b9b495"; c.fillRect(x + 1, y + 3, 6, 6);
      c.fillStyle = "#f1e6cb"; c.fillRect(x + 1, y + 1, 6, 2);
    }
  } else {
    c.fillStyle = "#627b7c"; c.fillRect(-33, -h - 8, 66, 10);
    c.fillStyle = "#809380"; c.fillRect(-29, -h - 7, 58, 5);
    rail(c, -32, -h - 12, 64);
    if (corner) {
      c.save(); c.translate(0, -h + 54); turret(c, corner < 0 ? -28 : 28, night, 0, true); c.restore();
    }
  }
}

export function drawCompoundGrounds(c: Ctx, compound: CastleCompound, t: number) {
  // A small shared garden and open stone walks, rather than a solid slab over the whole site.
  const g = compound.garden;
  c.strokeStyle = "#b2af93"; c.lineWidth = 9; c.lineCap = "round";
  if (compound.layout !== "keep") {
    if (compound.rest) { c.beginPath(); c.moveTo(g.x, g.y + 14); c.lineTo(g.x, compound.rest.y - 40); c.stroke(); }
    for (const p of compound.pads) { c.beginPath(); c.moveTo(g.x, p.y); c.lineTo(p.x, p.y); c.stroke(); }
  }
  if (compound.layout !== "keep") {
  c.save(); c.translate(g.x, g.y);
  c.fillStyle = "#b5b69c"; c.fillRect(-54, -46, 108, 92);
  c.strokeStyle = "#ded7b9"; c.lineWidth = 3; c.strokeRect(-52, -44, 104, 88);
  for (const x of [-44, 10]) for (const y of [-36, 14]) {
    c.fillStyle = "#507457"; c.fillRect(x, y, 34, 22);
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? "#d8b89f" : "#bba4bd"; c.fillRect(x + 3 + i * 5, y + 7, 3, 3); }
  }
  c.fillStyle = "#758e8c"; c.beginPath(); c.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#8bbdbc"; c.beginPath(); c.ellipse(0, -2, 14, 8, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#d4e3c9"; c.lineWidth = 1;
  c.beginPath(); c.ellipse(0, -2, 5 + (t % 1) * 7, 2 + (t % 1) * 4, 0, 0, Math.PI * 2); c.stroke();
  statue(c, -43, 43); statue(c, 43, 43, -1); c.restore();
  }
  compound.pads.forEach((p, i) => {
    c.save(); c.translate(p.x, p.y);
    c.fillStyle = "#8e9b90"; c.beginPath(); c.ellipse(0, 0, 43, 36, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#d9c68f"; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 36, 29, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = "#e0d3a8"; c.lineWidth = 2.3;
    c.beginPath(); c.moveTo(-24, -6); c.lineTo(-9, -18); c.lineTo(0, 0); c.lineTo(9, -18); c.lineTo(24, -6); c.moveTo(-9, -18); c.lineTo(-16, 8); c.lineTo(0, 0); c.lineTo(16, 8); c.lineTo(9, -18); c.moveTo(0, 0); c.lineTo(0, 14); c.stroke();
    c.fillStyle = "#e1d9bb"; c.font = "bold 7px sans-serif"; c.textAlign = "center"; c.fillText(`LANDING ${i + 1}`, 0, 24); c.restore();
  });
  const r = compound.rest;
  if (!r) return;
  c.save(); c.translate(r.x, r.y);
  c.fillStyle = "#6d875f"; c.beginPath(); c.roundRect(-64, -38, 128, 76, 12); c.fill();
  c.strokeStyle = "#b6ad83"; c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 6; i++) {
    const x = (i % 3 - 1) * 38, y = (Math.floor(i / 3) - 0.5) * 34;
    c.fillStyle = "#b5a776"; c.beginPath(); c.ellipse(x, y, 16, 11, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#d3c58d"; c.lineWidth = 0.6;
    for (let j = -2; j <= 2; j++) { c.beginPath(); c.moveTo(x - 9, y + j * 3); c.lineTo(x + 9, y + j * 3 - 2); c.stroke(); }
  }
  c.fillStyle = "#738e88"; c.fillRect(-24, 28, 48, 7); c.fillStyle = "#93babb"; c.fillRect(-21, 29, 42, 3);
  c.restore();
}

/** One closed silhouette and entrance for the whole residence, rather than repeated house sprites. */
export function drawCastleKeep(c: Ctx, rooms: number, beds: number, occupied: number, night: boolean, cutaway: boolean, halfWidth = 64, projects = 0) {
  const w = halfWidth, h = keepHeight(rooms), glow = night ? "#f7d28e" : "#314d57";
  c.fillStyle = "rgba(20,36,37,.22)"; c.beginPath(); c.ellipse(0, 4, w + 8, 13, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#83928b"; c.fillRect(-w - 3, -4, w * 2 + 6, 8);
  masonry(c, -w, -h, w * 2, h);
  const columns = Math.max(2, Math.floor((w * 2 - 30) / 19));
  for (let floor = 0; floor < h / 24; floor++) {
    const y = -floor * 24;
    c.fillStyle = "#dfdac5"; c.fillRect(-w, y - 24, w * 2, 2);
    for (let col = 0; col < columns; col++) {
      const x = -w + 20 + col * (w * 2 - 40) / Math.max(1, columns - 1);
      if (floor === 0 && Math.abs(x) < 14) continue;
      arch(c, x - 5, y - 7, 10, 15, "#e8e0c5"); arch(c, x - 4, y - 8, 8, 12, glow);
    }
  }
  // The roof garden is enclosed by the same parapet as the main walls.
  c.fillStyle = "#8b9b8e"; c.fillRect(-w + 8, -h - 25, w * 2 - 16, 25);
  c.fillStyle = "#6f8d66"; c.fillRect(-w + 20, -h - 22, w * 2 - 40, 15);
  for (const x of [-w + 25, w - 33]) { c.fillStyle = "#456b50"; c.fillRect(x, -h - 21, 8, 11); c.fillStyle = "#ddb99d"; c.fillRect(x + 2, -h - 18, 3, 2); }
  c.fillStyle = "#d1cfb6"; c.beginPath(); c.ellipse(0, -h - 14, 8, 5, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#87b7b5"; c.beginPath(); c.ellipse(0, -h - 15, 5, 2.5, 0, 0, Math.PI * 2); c.fill();
  rail(c, -w + 7, -h - 9, w * 2 - 14);
  // Only the two outer towers rise above the shared roofline.
  for (const side of [-1, 1]) {
    const x = side * (w - 7);
    masonry(c, x - 9, -h - 14, 18, h + 14);
    c.fillStyle = "#e3deca"; c.fillRect(x - 11, -h - 15, 22, 4);
    for (let y = -20; y > -h + 4; y -= 28) arch(c, x - 2.5, y, 5, 10, glow);
    c.fillStyle = ROOF; c.beginPath(); c.moveTo(x - 13, -h - 16); c.lineTo(x, -h - 43); c.lineTo(x + 13, -h - 16); c.closePath(); c.fill();
    c.fillStyle = "#7c9998"; c.beginPath(); c.moveTo(x, -h - 43); c.lineTo(x + 13, -h - 16); c.lineTo(x + 3, -h - 16); c.fill();
    c.strokeStyle = "#c8b274"; c.lineWidth = 1; c.beginPath(); c.moveTo(x, -h - 43); c.lineTo(x, -h - 55); c.stroke();
    c.fillStyle = "#d5ab60"; c.beginPath(); c.moveTo(x, -h - 55); c.lineTo(x + 12, -h - 52); c.lineTo(x, -h - 48); c.fill();
  }
  if (cutaway) {
    const left = -w + 18, width = w * 2 - 36, cols = Math.max(4, Math.floor(width / 7));
    const rows = Math.max(1, Math.ceil(beds / cols)), cellW = width / cols, cellH = Math.min(11, (h - 36) / rows);
    c.fillStyle = "#b6a583"; c.fillRect(left, -h + 3, width, h - 35);
    for (let i = 0; i < beds; i++) {
      const x = left + (i % cols) * cellW + 0.5, y = -h + 5 + Math.floor(i / cols) * cellH;
      c.fillStyle = "#69543c"; c.fillRect(x, y, cellW - 1, cellH - 1);
      c.fillStyle = i < occupied ? "#6b9998" : "#c2bc9c"; c.fillRect(x + 1, y + 2, cellW - 3, Math.max(2, cellH - 4));
      c.fillStyle = "#efe6cc"; c.fillRect(x + 1, y + 1, cellW - 3, 1.5);
    }
  } else if (w >= 48) {
    rail(c, -w + 18, -43, w - 30); rail(c, 12, -43, w - 30);
  }
  arch(c, -13, 0, 26, 32, "#dcd6bd"); arch(c, -10, 0, 20, 27, "#304448");
  c.fillStyle = "#b99a60"; c.fillRect(-9, -18, 18, 2);
  c.fillStyle = "#d3d0b9"; c.fillRect(-16, 0, 32, 3); c.fillRect(-20, 3, 40, 3);
  if (w >= 48) { statue(c, -27, 0); statue(c, 27, 0, -1); }
  if (projects) {
    c.strokeStyle = "#bd9866"; c.lineWidth = 2;
    for (const x of [w - 20, w + 3]) { c.beginPath(); c.moveTo(x, 1); c.lineTo(x, -h + 12); c.stroke(); }
    for (let y = -12; y > -h + 12; y -= 16) { c.beginPath(); c.moveTo(w - 23, y); c.lineTo(w + 6, y); c.stroke(); }
    c.strokeStyle = "#e2c284"; c.lineWidth = 1; c.beginPath(); c.moveTo(w - 20, -6); c.lineTo(w + 3, -h + 12); c.stroke();
  }
}

/** A wing remains a real home. The selected wing opens to show its actual bed capacity. */
export function drawCastleWing(c: Ctx, s: Shelter, neighbours: number, night: boolean, t: number, beds: number, occupied: number, cutaway: boolean) {
  const glow = night ? "#f7d18a" : "#314f59";
  const tower = neighbours < 2 || s.id % 4 === 0;
  c.fillStyle = "rgba(16,32,37,.22)"; c.beginPath(); c.ellipse(0, 4, 42, 12, 0, 0, Math.PI * 2); c.fill();
  // A projecting plinth and two storeys give all wings a common architectural rhythm.
  c.fillStyle = "#73827e"; c.fillRect(-34, -3, 68, 7);
  masonry(c, -30, -54, 60, 54);
  c.fillStyle = LIGHT; c.fillRect(-32, -29, 64, 3);
  arch(c, -7, 0, 14, 23, "#31454b");
  c.strokeStyle = "#bca875"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -17); c.lineTo(0, 0); c.stroke();
  for (const x of [-22, 13]) {
    arch(c, x - 1, -9, 11, 17, LIGHT); arch(c, x, -10, 9, 14, glow);
    arch(c, x - 1, -35, 11, 16, LIGHT); arch(c, x, -36, 9, 13, glow);
    c.strokeStyle = "#8b9d99"; c.beginPath(); c.moveTo(x + 4.5, -49); c.lineTo(x + 4.5, -36); c.stroke();
  }
  // Central balcony: stone corbels, French doors, flowers and balusters.
  arch(c, -6, -32, 12, 18, glow);
  c.fillStyle = "#7d8e87"; c.fillRect(-14, -28, 28, 4);
  rail(c, -13, -40, 26);
  for (const x of [-12, 10]) { c.fillStyle = "#658c69"; c.fillRect(x, -42, 4, 3); c.fillStyle = "#dbba96"; c.fillRect(x, -44, 2, 2); }
  if (cutaway) {
    // Two furnished rooms, with one drawn bed for every capacity slot (including hall research).
    c.fillStyle = "#6c6353"; c.fillRect(-29, -54, 58, 27);
    c.fillStyle = "#bdab88"; c.fillRect(-27, -52, 54, 23);
    c.fillStyle = "#dcd4bb"; c.fillRect(-1, -53, 2, 25);
    for (let i = 0; i < beds; i++) {
      const x = -25 + (i % 4) * 13, y = -50 + Math.floor(i / 4) * 11;
      c.fillStyle = "#5b4635"; c.fillRect(x, y, 10, 9);
      c.fillStyle = i < occupied ? "#659096" : "#aaad91"; c.fillRect(x + 1, y + 3, 8, 5);
      c.fillStyle = "#eee5cc"; c.fillRect(x + 1, y + 1, 8, 2);
    }
  } else {
    // Recessed roof garden, copper ridge and a lower slate roof on alternate wings.
    c.fillStyle = "#687e7d";
    c.beginPath(); c.moveTo(-34, -55); c.lineTo(-22, -67); c.lineTo(24, -67); c.lineTo(34, -55); c.fill();
    c.fillStyle = s.id % 3 ? "#708b79" : ROOF; c.fillRect(-24, -65, 48, 9);
    rail(c, -30, -65, 60);
    c.fillStyle = "#50765d"; c.fillRect(-20, -68, 10, 3); c.fillRect(13, -68, 8, 3);
    statue(c, -23, -66); if (neighbours > 1) statue(c, 23, -66, -1);
  }
  if (tower && !cutaway) turret(c, s.id % 2 ? -28 : 28, night, t, true);
  // Steps face the same approach as the original house, preserving navigation and selection.
  c.fillStyle = "#c5c4af"; c.fillRect(-11, 0, 22, 3); c.fillRect(-14, 3, 28, 3);
}

export function drawGallery(c: Ctx, link: HomeLink, night: boolean) {
  const { a, b } = link;
  // A continuous open arcade allows people to walk through the original gap.
  const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
  const back = a.y < b.y ? a : b, front = a.y < b.y ? b : a;
  const direction = b.x >= a.x ? 1 : -1;
  const ax = vertical ? back.x : a.x + direction * 26;
  const ay = vertical ? back.y + 10 : a.y - 13;
  const bx = vertical ? front.x : b.x - direction * 26;
  const by = vertical ? front.y - 31 : b.y - 13;
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  c.save(); c.translate(ax, ay);
  c.strokeStyle = "#9aa995"; c.lineWidth = 18;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(dx, dy); c.stroke();
  const bays = Math.max(2, Math.ceil(length / 22));
  for (let i = 1; i < bays; i++) {
    const x = dx * i / bays, y = dy * i / bays;
    c.fillStyle = "#d0d0ba"; c.fillRect(x - 2, y - 27, 4, 27);
    c.fillStyle = "#9aa899"; c.fillRect(x - 4, y - 3, 8, 3);
    if (night && i % 2) { c.fillStyle = "#f6cb82"; c.fillRect(x - 2, y - 22, 4, 4); }
  }
  c.strokeStyle = "#627f82"; c.lineWidth = 14;
  c.beginPath(); c.moveTo(0, -29); c.lineTo(dx, dy - 29); c.stroke();
  c.strokeStyle = "#d5d5ba"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -36); c.lineTo(dx, dy - 36); c.stroke();
  c.restore();
}

export function drawCourtyard(c: Ctx, estate: Estate, t: number) {
  if (!estate.garden) return;
  const { x, y } = estate.garden;
  c.save(); c.translate(x, y - 12);
  c.fillStyle = "#b2b39c"; c.fillRect(-36, -22, 72, 46);
  c.strokeStyle = "#d2d1b6"; c.lineWidth = 3; c.strokeRect(-35, -21, 70, 44);
  for (const xx of [-30, 9]) for (const yy of [-16, 7]) {
    c.fillStyle = "#567859"; c.fillRect(xx, yy, 21, 11);
    for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? "#e4c6a0" : "#b798b9"; c.fillRect(xx + 2 + i * 4, yy + 3, 2, 2); }
  }
  c.fillStyle = "#788e8b"; c.beginPath(); c.ellipse(0, 1, 12, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#83b7bb"; c.beginPath(); c.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#b8e2d5"; c.lineWidth = 1;
  c.beginPath(); c.ellipse(0, 0, 3 + (t % 1) * 5, 1 + (t % 1) * 2, 0, 0, Math.PI * 2); c.stroke();
  statue(c, -29, 20); statue(c, 29, 20, -1);
  c.restore();
}

export interface AwningLink { ax: number; ay: number; bx: number; by: number }

export function drawCastleSite(c: Ctx, s: Shelter) {
  c.strokeStyle = "#e1d7b4"; c.lineWidth = 1.2; c.setLineDash([4, 3]);
  c.strokeRect(-34, -32, 68, 38); c.setLineDash([]);
  if (s.stage > 0) masonry(c, -30, -s.stage * 14, 60, s.stage * 14);
  if (s.stage > 1) arch(c, -7, 0, 14, 22, "#344b4c");
  c.strokeStyle = "#ae8a5e"; c.lineWidth = 2;
  for (const x of [-36, 36]) { c.beginPath(); c.moveTo(x, 5); c.lineTo(x, -62); c.stroke(); }
  for (let y = -8; y > -62; y -= 15) { c.beginPath(); c.moveTo(-39, y); c.lineTo(39, y); c.stroke(); }
  c.strokeStyle = "#dbc799"; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-36, 0); c.lineTo(36, -53); c.stroke();
}

export function drawAwningLink(c: Ctx, l: AwningLink) {
  c.save();
  // The two slopes span the entire awning width, so diagonal rows read as one roof.
  const back = l.ay < l.by || (l.ay === l.by && l.ax < l.bx) ? { x: l.ax, y: l.ay } : { x: l.bx, y: l.by };
  const front = back.x === l.ax && back.y === l.ay ? { x: l.bx, y: l.by } : { x: l.ax, y: l.ay };
  c.fillStyle = "#c79a64";
  c.beginPath();
  c.moveTo(back.x - 22, back.y - 29); c.lineTo(back.x, back.y - 35); c.lineTo(front.x, front.y - 35);
  c.lineTo(front.x - 22, front.y - 29); c.closePath(); c.fill();
  c.fillStyle = "#af8557";
  c.beginPath();
  c.moveTo(back.x, back.y - 35); c.lineTo(back.x + 22, back.y - 29); c.lineTo(front.x + 22, front.y - 29);
  c.lineTo(front.x, front.y - 35); c.closePath(); c.fill();
  c.strokeStyle = "#e0bd88"; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(back.x, back.y - 35); c.lineTo(front.x, front.y - 35); c.stroke();
  // A single end hem replaces the repeated caps and intermediate connector posts.
  c.strokeStyle = "#987348"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(front.x - 22, front.y - 29); c.lineTo(front.x, front.y - 35); c.lineTo(front.x + 22, front.y - 29); c.stroke();
  c.restore();
}
