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
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const shows = require(path.join(root, 'sim', 'shows.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  for (const t of ['tools', 'fire', 'spear', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  w.camp.stock.stone = 99; w.camp.stock.wood = 99; w.camp.stock.hide = 99;
  w.dragons.seeded = true;
  const tx = Math.floor(w.camp.x / TILE), ty = Math.floor(w.camp.y / TILE);
  for (let y = ty - 2; y <= ty + 16; y++) for (let x = tx + 2; x <= tx + 34; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  return w;
}
function dragon(w, x, y, growth = 1) {
  const egg = { id: w.nextId(), breed: 'fire', x, y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300 * growth, growth, hunger: 0, energy: 1, stamina: 1, skills: { trust: 1, follow: 1 } });
  keep.newDragonStats(dr);
  dr.hp = dr.maxHp;
  return dr;
}
function pit(w) {
  const p = w.colony.addBuilding(w, 'dragonPit', w.camp.x + 520, w.camp.y + 320);
  assert.ok(p && typeof p === 'object');
  p.built = 1;
  return p;
}

test('the dragon pit digs itself out wider as we get more (and bigger) dragons, and never shrinks', () => {
  const w = world(9401);
  const p = pit(w);
  dragon(w, p.x, p.y, 0.2);
  assert.ok(shows.pitWant(w) <= 1.25, 'one little hatchling: the pit as built is plenty');
  const one = shows.pitWant(w);
  for (let i = 0; i < 6; i++) dragon(w, p.x, p.y);
  const want = shows.pitWant(w);
  assert.ok(want > 2.2, `seven dragons, six of them grown: much bigger (${want.toFixed(2)})`);
  assert.ok(want > one);
  // it grows over time (not all at once)
  for (let i = 0; i < 30; i++) shows.pitGrow(w, 1);
  assert.ok(shows.pitScale(p) > 1 && shows.pitScale(p) < want, 'digging');
  for (let i = 0; i < 400; i++) shows.pitGrow(w, 1);
  assert.ok(Math.abs(shows.pitScale(p) - want) < 0.02, 'dug out to fit');
  assert.ok(shows.pitRadius(p) > 2.2 * 2.4 * 32);
  // a dragon gone: it stays as big
  w.dragons.owned.pop();
  for (let i = 0; i < 50; i++) shows.pitGrow(w, 1);
  assert.ok(Math.abs(shows.pitScale(p) - want) < 0.02, 'never shrinks');
  // capped
  for (let i = 0; i < 40; i++) dragon(w, p.x, p.y);
  assert.ok(shows.pitWant(w) <= shows.PIT_MAX);
});

test('every dragon gets its own sleeping spot inside the pit, and they wander its floor', () => {
  const w = world(9402);
  const p = pit(w);
  for (let i = 0; i < 9; i++) dragon(w, p.x, p.y);
  for (let i = 0; i < 400; i++) shows.pitGrow(w, 1);
  const c = shows.pitCentre(p);
  const r = shows.pitRadius(p);
  const spots = w.dragons.owned.map((d) => keep.roostOf(w, d));
  for (const s of spots) assert.ok(Math.hypot(s.x - c.x, (s.y - c.y) * 2) < r, 'inside the arena');
  // spread out: nobody sleeps on top of anyone else
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) > 30, 'room each');
  for (let i = 0; i < 20; i++) {
    const s = shows.pitWanderSpot(w, p);
    assert.ok(Math.hypot(s.x - c.x, (s.y - c.y) * 2) < r);
  }
  // saved + loaded at its dug-out size
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const bp = back.colony.buildings.find((b) => b.kind === 'dragonPit');
  assert.ok(Math.abs(shows.pitScale(bp) - shows.pitScale(p)) < 0.01);
});

test('the arena floor is kept clear of trees as it widens', () => {
  const w = world(9403);
  const p = pit(w);
  const { makePlant } = require(path.join(root, 'sim', 'plants.ts'));
  const c = shows.pitCentre(p);
  w.plants.push(makePlant(w, 'broadleaf', c.x + 30, c.y + 10, 1));
  const outside = makePlant(w, 'broadleaf', c.x + 600, c.y, 1);
  w.plants.push(outside);
  const wood = w.camp.stock.wood;
  assert.equal(shows.clearPitFloor(w, p), 1);
  assert.ok(w.plants.includes(outside), 'only inside the arena');
  assert.ok(w.camp.stock.wood > wood, 'timber to the stores');
});
