const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const root = path.join(__dirname, '..', 'app', 'dinosors');
const { World } = require(path.join(root, 'sim', 'world.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const links = require(path.join(root, 'sim', 'wallLinks.ts'));

/** An open patch of grass well away from the camp: (x0, y0) is its top-left tile. */
function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.camp.learned.add('stonewall');
  w.camp.learned.add('tower');
  const x0 = Math.floor(w.camp.x / TILE) + 14, y0 = Math.floor(w.camp.y / TILE) - 6;
  for (let y = y0; y <= y0 + 20; y++) for (let x = x0; x <= x0 + 24; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  return { w, x0, y0 };
}
const run = (w, tx, ty, n, dx = 1, dy = 0) => {
  const out = [];
  for (let k = 0; k < n; k++) {
    const wl = w.tribe.addWall(w, tx + dx * k, ty + dy * k, 'stone', 'wall');
    assert.ok(wl, `wall at ${tx + dx * k},${ty + dy * k}`);
    out.push(wl);
  }
  return out;
};

test('a run that stops two tiles short of a tower is joined onto it, and the player is told', () => {
  const { w, x0, y0 } = world(9401);
  const t = w.tribe.addTower(w, (x0 + 10) * TILE, (y0 + 5) * TILE);
  assert.ok(t, 'tower');
  // the wall runs east toward the tower's west side and stops 2 tiles short
  const ws = run(w, t.tx - 6, t.ty, 4);
  const joins = links.connectWalls(w, ws);
  assert.equal(joins.length, 2);
  assert.ok(joins.every((j) => j.to === 'tower'));
  assert.ok(w.tribe.wallAt(t.tx - 1, t.ty) && w.tribe.wallAt(t.tx - 2, t.ty), 'the gap is walled');
  assert.match(links.joinMessage(joins), /tower/);
});

test('a wall left one tile from the water is sealed to the water\'s edge; a corner gets its corner piece', () => {
  const { w, x0, y0 } = world(9402);
  // water down the east side
  for (let y = y0; y <= y0 + 20; y++) for (let x = x0 + 18; x <= x0 + 24; x++) w.terrain.setTile(x, y, T.Shallow);
  w.nav.sync(w);
  const ws = run(w, x0 + 12, y0 + 4, 5); // ends at x0+16, one land tile (x0+17) from the water
  const joins = links.connectWalls(w, ws);
  assert.deepEqual(joins.map((j) => [j.tx - x0, j.to]), [[17, 'water']]);
  // corner: a run going east ends one tile diagonally short of a run going south
  const a = run(w, x0 + 2, y0 + 10, 3); // x0+2..x0+4, row y0+10
  const b = run(w, x0 + 5, y0 + 11, 3, 0, 1); // column x0+5, rows y0+11..13
  const cj = links.connectWalls(w, [...a, ...b]);
  assert.ok(cj.some((j) => j.to === 'corner' || j.to === 'wall'), JSON.stringify(cj));
  assert.ok(w.tribe.wallAt(x0 + 5, y0 + 10) || w.tribe.wallAt(x0 + 4, y0 + 11), 'the corner is closed');
});

test('two walls side by side are never stitched together, and a far gap is left for the player', () => {
  const { w, x0, y0 } = world(9403);
  const a = run(w, x0 + 2, y0 + 2, 6);
  const b = run(w, x0 + 2, y0 + 4, 6); // parallel, two rows down
  assert.equal(links.connectWalls(w, [...a, ...b]).length, 0, 'parallel walls stay apart');
  // a gap of 4 tiles between two runs is a gateway, not a mistake
  const c = run(w, x0 + 2, y0 + 8, 3);
  const d = run(w, x0 + 9, y0 + 8, 3);
  assert.equal(links.connectWalls(w, [...c, ...d]).length, 0);
});

test('an old save closes its one-tile wall gaps once on load', () => {
  const { w, x0, y0 } = world(9404);
  run(w, x0 + 2, y0 + 3, 3);
  run(w, x0 + 6, y0 + 3, 3); // one tile gap at x0+5
  for (const wl of w.tribe.walls) { wl.built = 1; wl.hp = 600; }
  w.flags.delete('wallsJoined');
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(back.tribe.wallAt(x0 + 5, y0 + 3), 'gap filled');
  assert.ok(back.flags.has('wallsJoined'));
  // and only once
  const again = World.deserialize(JSON.parse(JSON.stringify(back.serialize())));
  assert.equal(again.tribe.walls.length, back.tribe.walls.length);
});

test('walls join onto a Dragon Shield pylon like a tower, and a turned wall run moulds onto what it now meets', () => {
  const { w, x0, y0 } = world(9405);
  // a Dragon Shield pylon two tiles past the end of a run
  const shield = w.colony.addBuilding(w, 'dragonShield', (x0 + 9.5) * TILE, (y0 + 3) * TILE);
  assert.ok(shield && typeof shield === 'object', `shield placed (${shield})`);
  const a = run(w, shield.tx - 5, shield.ty, 3);
  const joins = links.connectWalls(w, a);
  assert.ok(joins.length === 2 && joins.every((j) => j.to === 'shield'), JSON.stringify(joins));
  assert.match(links.joinMessage(joins), /Dragon Shield/);
  assert.equal(w.tribe.wallAnchorAt(w, shield.tx, shield.ty), 'shield');
  // turn a 3-piece east-west run a quarter turn: it stands north-south round the same middle
  const b = run(w, x0 + 3, y0 + 12, 3);
  const r = w.tribe.rotateWalls(w, b);
  assert.ok(typeof r !== 'string', r);
  assert.ok(b.every((wl) => wl.tx === b[1].tx), 'all in one column now');
  assert.deepEqual(b.map((wl) => wl.ty).sort((p, q) => p - q), [y0 + 11, y0 + 12, y0 + 13]);
  // undo puts it back exactly
  assert.equal(w.tribe.restoreWalls(w, r.from), null);
  assert.deepEqual(b.map((wl) => [wl.tx, wl.ty]), [[x0 + 3, y0 + 12], [x0 + 4, y0 + 12], [x0 + 5, y0 + 12]]);
  // turned next to a tower, it nudges a tile to join onto it
  const t = w.tribe.addTower(w, (x0 + 16) * TILE, (y0 + 13) * TILE);
  assert.ok(t);
  const c = run(w, t.tx - 3, t.ty - 1, 3, 0, 1); // a column 3 tiles left of the tower, level with it
  const rr = w.tribe.rotateWalls(w, c);
  assert.ok(typeof rr !== 'string', rr);
  assert.ok(c.some((wl) => w.tribe.wallAnchorAt(w, wl.tx + 1, wl.ty) === 'tower'), `joined the tower (${c.map((wl) => [wl.tx - t.tx, wl.ty - t.ty])})`);
});

test('a tower can be moved with its Scorpion on it: the crew lifts it, the Scorpion rides along, nearby walls join onto it', () => {
  const { w, x0, y0 } = world(9406);
  const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
  const { TOWER_STAGES } = require(path.join(root, 'sim', 'build.ts'));
  const moving = require(path.join(root, 'sim', 'moving.ts'));
  for (let i = 0; i < 5; i++) addHuman(w, (x0 + 2 + i) * TILE, (y0 + 15) * TILE);
  for (const h of w.humans) h.child = false;
  w.timePaused = true;
  w.tribe['planT'] = Infinity;
  const t = w.tribe.addTower(w, (x0 + 6) * TILE, (y0 + 6) * TILE);
  assert.ok(t);
  t.stage = TOWER_STAGES.length;
  t.hp = 900;
  w.nav.sync(w);
  const sc = w.colony.addScorpion(w, t.x, t.y - 10);
  assert.ok(typeof sc !== 'string', sc);
  assert.equal(sc.mount, 'tower');
  sc.built = 1;
  sc.hp = 300;
  // someone crewing it, up on the platform
  const gunner = w.humans[0];
  gunner.level = 1;
  gunner.x = t.x;
  gunner.y = t.y - 8;
  sc.crew = gunner.id;
  // a wall run that will end 2 tiles from where the tower goes
  const ws = run(w, x0 + 10, y0 + 11, 3);
  const old = { tx: t.tx, ty: t.ty, sx: sc.tx, sy: sc.ty };
  assert.equal(moving.canMove(w, { kind: 'tower', id: t.id }), null);
  assert.ok(moving.moveSpotOk(w, { kind: 'tower', id: t.id }, (x0 + 10) * TILE, (y0 + 2) * TILE) === null, 'a clear spot is fine');
  // the new spot: west of the wall run, 2 tiles short of it
  const why = moving.startMove(w, { kind: 'tower', id: t.id }, (x0 + 7) * TILE, (y0 + 12) * TILE);
  assert.equal(why, null, why);
  for (let i = 0; i < 30 * 40 && t.tx === old.tx && t.ty === old.ty; i++) w.update(1 / 30);
  assert.ok(t.tx !== old.tx || t.ty !== old.ty, 'moved');
  assert.equal(sc.tx - old.sx, t.tx - old.tx, 'the Scorpion rode along');
  assert.equal(sc.ty - old.sy, t.ty - old.ty);
  assert.equal(sc.mount, 'tower');
  assert.equal(gunner.level, 0, 'the gunner climbed down first');
  assert.equal(sc.crew, 0);
  assert.ok(w.colony.scorpions.includes(sc) && sc.built === 1 && sc.hp === 300, 'it is the same Scorpion, intact');
  // can't put it on water
  for (let y = y0; y <= y0 + 3; y++) for (let x = x0 + 20; x <= x0 + 24; x++) w.terrain.setTile(x, y, T.Shallow);
  w.nav.sync(w);
  assert.ok(moving.moveSpotOk(w, { kind: 'tower', id: t.id }, (x0 + 22) * TILE, (y0 + 2) * TILE), 'refused on water');
  assert.ok(w.tribe.wallAt(x0 + 8, y0 + 11) && w.tribe.wallAt(x0 + 9, y0 + 11), 'the wall run joined onto the moved tower');
  void ws;
});

test('measuring lines while moving: green to a wall it lines up with, red when it is a tile or two out of line', () => {
  const { w, x0, y0 } = world(9407);
  run(w, x0 + 2, y0 + 5, 4); // a wall along row y0+5, x0+2..x0+5
  // a tower placed 3 tiles east of the wall's end, level with it (its rows y0+4..y0+5)
  const level = links.alignGuides(w, { tx0: x0 + 9, ty0: y0 + 4, tx1: x0 + 10, ty1: y0 + 5 });
  const west = level.find((g) => g.x1 < g.x0);
  assert.ok(west && west.ok, JSON.stringify(level));
  assert.equal(west.gap, 3, 'three open tiles between them');
  // the same tower two rows too far north: red, 1 tile out of line
  const off = links.alignGuides(w, { tx0: x0 + 9, ty0: y0 + 2, tx1: x0 + 10, ty1: y0 + 3 });
  const w2 = off.find((g) => g.x1 < g.x0);
  assert.ok(w2 && !w2.ok && w2.off === 2, JSON.stringify(off));
  // far out of line: no line at all
  assert.equal(links.alignGuides(w, { tx0: x0 + 9, ty0: y0 - 4, tx1: x0 + 10, ty1: y0 - 3 }).filter((g) => g.x1 < g.x0).length, 0);
  // the pieces being moved never measure against themselves
  const piece = w.tribe.wallAt(x0 + 5, y0 + 5);
  const self = links.alignGuides(w, { tx0: x0 + 5, ty0: y0 + 5, tx1: x0 + 5, ty1: y0 + 5 }, new Set([piece.id]));
  // (the end piece itself is left out: it measures to the rest of its run, touching = "joins")
  const back = self.find((g) => g.x1 <= g.x0);
  assert.ok(back && back.ok && back.gap === 0, JSON.stringify(self));
});
