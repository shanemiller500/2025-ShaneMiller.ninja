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
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { addDino, walkable } = require(path.join(root, 'sim', 'dinos.ts'));
const { issue } = require(path.join(root, 'sim', 'tasks.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { workOf } = require(path.join(root, 'sim', 'workDinos.ts'));
const bounds = require(path.join(root, 'sim', 'dinoBounds.ts'));
const clearing = require(path.join(root, 'sim', 'clearing.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  for (const t of ['tools', 'axe', 'spear', 'taming', 'palisade']) w.camp.learned.add(t);
  return w;
}

/** a finished palisade box (tile coords), open ground inside + out */
function box(w, x0, y0, x1, y1) {
  for (let ty = y0 - 4; ty <= y1 + 4; ty++) for (let tx = x0 - 4; tx <= x1 + 4; tx++) w.terrain.setTile(tx, ty, T.Grass);
  for (let tx = x0; tx <= x1; tx++) for (const ty of [y0, y1]) { const wl = w.tribe.addWall(w, tx, ty, 'palisade'); if (wl) { wl.built = 1; wl.hp = 400; } }
  for (let ty = y0; ty <= y1; ty++) for (const tx of [x0, x1]) { const wl = w.tribe.addWall(w, tx, ty, 'palisade'); if (wl) { wl.built = 1; wl.hp = 400; } }
  w.tribe.version++;
  w.nav.sync(w);
}

test('the tribe\'s dinos stay outside the walls; pens can only go outside (and move out)', () => {
  const w = world(9101);
  const tx0 = Math.floor(w.camp.x / TILE) + 10, ty0 = Math.floor(w.camp.y / TILE) + 4;
  box(w, tx0, ty0, tx0 + 8, ty0 + 6);
  const inside = { x: (tx0 + 4) * TILE + 16, y: (ty0 + 3) * TILE + 16 };
  const outside = { x: (tx0 - 2) * TILE + 16, y: (ty0 + 3) * TILE + 16 };
  assert.equal(bounds.insideWalls(w, inside.x, inside.y), true);
  const d = addDino(w, 'trike', outside.x, outside.y, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  assert.equal(walkable(w, d, inside.x, inside.y), false, 'a tribe dino may not step inside');
  const wild = addDino(w, 'trike', outside.x, outside.y + 40, {});
  assert.equal(bounds.blockedForDino(w, wild, inside.x, inside.y), true, 'no grown dinosaur at all comes inside');
  const baby = addDino(w, 'trike', outside.x, outside.y + 60, { owner: true, tame: 1, growth: 0.2 });
  assert.equal(bounds.blockedForDino(w, baby, inside.x, inside.y), false, 'babies may stay');
  const raider = addDino(w, 'raptor', outside.x, outside.y + 80, { raider: true });
  assert.equal(bounds.blockedForDino(w, raider, inside.x, inside.y), false, '(raiders are what the walls are for)');
  // an open gate doesn't make the camp count as "outside"
  const gate = w.tribe.wallAt(tx0 + 4, ty0 + 6);
  gate.part = 'gate';
  gate.open = true;
  w.tribe.version++;
  assert.equal(bounds.insideWalls(w, inside.x, inside.y), true, 'still inside with the gate open');
  // one already inside walks out
  const lost = addDino(w, 'para', inside.x, inside.y, { owner: true, tame: 1 });
  w.byId.set(lost.id, lost);
  const out = bounds.leaveWalls(w, lost);
  assert.ok(out && !bounds.insideWalls(w, out.x, out.y), 'it heads for open ground outside');
  // pens: not allowed inside, and old ones get moved out
  assert.match(w.colony.canPlace(w, 'pen', inside.x, inside.y) ?? '', /outside the walls/);
  const pen = { id: w.nextId(), kind: 'pen', tx: tx0 + 3, ty: ty0 + 2, x: (tx0 + 4.5) * TILE, y: (ty0 + 3.5) * TILE, built: 1, have: {}, hp: 200 };
  w.colony.buildings.push(pen);
  assert.equal(bounds.moveAnimalBuildingsOut(w), 1);
  const moved = w.colony.buildings.find((b) => b.kind === 'pen');
  assert.ok(moved && !bounds.insideWalls(w, moved.x, moved.y) && moved.built === 1, 'the pen now stands outside, still built');
});

test('a rally / call: the dino runs to meet its person, and riding into battle is a run', () => {
  const w = world(9102);
  const h = addHuman(w, w.camp.x, w.camp.y + 40, false, { role: 'guard' });
  const d = addDino(w, 'trike', w.camp.x + 600, w.camp.y + 40, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  workOf(d).skills.riding = 1;
  assert.ok(issue(w, [h], { kind: 'ride', icon: '🏇', label: 'Ride', x: d.x, y: d.y, target: d.id }));
  const start = Math.hypot(h.x - d.x, h.y - d.y);
  let t = -1;
  for (let i = 0; i < 30 * 30; i++) {
    w.update(1 / 30);
    if (i === 30) assert.ok(d.hurry, 'the dino is running to meet them');
    if (h.riding === d.id) { t = i / 30; break; }
  }
  assert.ok(t > 0, 'mounted');
  assert.ok(start / t > 60, `they closed the gap fast (${(start / t).toFixed(0)} px/s)`);
  assert.equal(d.hurry, false);
});

test('clear land: a big dino pushes over the trees + shrubs, timber goes to the stores, dirt grows back to grass', () => {
  const w = world(9103);
  const cx = w.camp.x + 500, cy = w.camp.y + 300;
  const ctx = Math.floor(cx / TILE), cty = Math.floor(cy / TILE);
  for (let ty = cty - 6; ty <= cty + 6; ty++) for (let tx = ctx - 6; tx <= ctx + 6; tx++) w.terrain.setTile(tx, ty, T.Jungle);
  w.plants = w.plants.filter((p) => Math.hypot(p.x - cx, p.y - cy) > 200);
  const { makePlant } = require(path.join(root, 'sim', 'plants.ts'));
  const kinds = ['palm', 'palm', 'broadleaf', 'bush', 'fern', 'palm'];
  kinds.forEach((k, i) => { const p = makePlant(w, k, cx - 60 + i * 24, cy + (i % 2) * 30); p.size = 1; w.plants.push(p); });
  w.plantsDirty = true;
  w.nav.sync(w);
  const d = addDino(w, 'trike', cx - 150, cy, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  workOf(d).skills.heavy = 1;
  assert.equal(clearing.canClear(d), true);
  const wood = w.camp.stock.wood;
  assert.equal(clearing.commandClear(w, d, cx, cy), null);
  let done = -1;
  for (let i = 0; i < 30 * 90; i++) {
    w.update(1 / 30);
    if (!w.plants.some((p) => Math.hypot(p.x - cx, p.y - cy) < clearing.CLEAR_R)) { done = i / 30; break; }
  }
  assert.ok(done > 0, 'every plant knocked down');
  assert.ok(w.camp.stock.wood > wood, 'timber in the stores');
  assert.equal(w.terrain.tileAt(cx, cy + 6) === T.Dirt || w.cleared.length > 0, true, 'trampled to dirt');
  const n = w.cleared.length;
  assert.ok(n > 0);
  // later the grass comes back
  w.elapsed += clearing.REGROW_SECONDS * 1.3;
  clearing.regrowTick(w);
  assert.equal(w.cleared.length, 0);
  assert.equal(w.terrain.tileAt(cx, cy), T.Grass);
  // saved
  w.cleared.push({ i: 5, at: w.elapsed + 10 });
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.cleared.length, 1);
});
