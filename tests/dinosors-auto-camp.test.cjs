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
const root = path.join(__dirname, '..', 'app', 'dinosors', 'sim');
const { World } = require(path.join(root, 'world.ts'));
const { addHuman, stockPriorities } = require(path.join(root, 'humans.ts'));

test('Auto plans one useful project after the first day and remembers it across saves', () => {
  const w = new World(7803, false);
  addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  w.camp.learned.add('basket');
  w.tribe.autoImprove(w);
  assert.equal(w.colony.buildings.length, 0, 'nothing planned before day two');
  w.day = 2;
  w.tribe.planT = 0;
  w.update(1 / 30);
  assert.equal(w.colony.buildings.filter((b) => b.kind === 'foodStore').length, 1);
  w.tribe.autoImprove(w);
  assert.equal(w.colony.buildings.length, 1, 'no second plan on the same day');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  restored.colony.buildings[0].built = 1;
  restored.colony.version++;
  restored.tribe.autoImprove(restored);
  assert.equal(restored.colony.buildings.length, 1, 'loading does not repeat the daily plan');
  restored.camp.learned.add('axe');
  restored.day = 3;
  restored.tribe.autoImprove(restored);
  assert.equal(restored.colony.buildings.filter((b) => b.kind === 'storage').length, 1, 'next day adds another useful building');
});

test('Auto restocking prioritizes supplies that are low relative to the camp target', () => {
  const w = new World(7804, false);
  const h = addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  for (const r of ['stick', 'stone', 'grass', 'leaves', 'berries', 'fish']) w.camp.stock[r] = 0;
  assert.ok(stockPriorities(w).includes('stick'));
  w.camp.stock.stick = 100;
  assert.ok(!stockPriorities(w).includes('stick'), 'well-stocked supplies are not requested');
  h.task = 'fish'; h.carry = 'fish'; h.carryN = 100;
  assert.ok(!stockPriorities(w).includes('fish'), 'a carried load counts toward the stock target');
});



test('Auto plans a home upgrade when the daily building queue is clear', () => {
  const { stagesOf } = require(path.join(root, 'build.ts'));
  const w = new World(7805, false);
  addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  w.camp.learned.add('shelter');
  const home = w.camp.addShelter(w, w.camp.x + 140, w.camp.y + 140);
  home.stage = stagesOf(home).length;
  home.hp = 1;
  w.day = 2;
  w.tribe.autoImprove(w);
  assert.equal(home.up, true);
  w.elapsed += 1;
  assert.equal(w.buildSites().find((site) => site.id === home.id)?.kind, 'upgrade');
});


test('Auto can plan a stone wall upgrade after the first day', () => {
  const { T, TILE } = require(path.join(root, 'types.ts'));
  const w = new World(7806, false);
  addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  w.camp.learned.add('stonewall');
  const tx = Math.floor(w.camp.x / TILE) + 7;
  const ty = Math.floor(w.camp.y / TILE) + 7;
  w.terrain.setTile(tx, ty, T.Grass);
  const wall = w.tribe.addWall(w, tx, ty, 'palisade');
  assert.ok(wall);
  wall.built = 1;
  wall.hp = 100;
  w.day = 2;
  w.nav.sync(w);
  w.tribe.autoImprove(w);
  assert.equal(wall.upgrade, true);
});

test('stonework queues all finished wooden walls without waiting for raids', () => {
  const { T, TILE } = require(path.join(root, 'types.ts'));
  const { sites, deliver, work } = require(path.join(root, 'build.ts'));
  const w = new World(7810, false);
  w.camp.learned.add('stonewall');
  const tx = Math.floor(w.camp.x / TILE) + 7;
  const ty = Math.floor(w.camp.y / TILE) + 7;
  for (let x = tx; x <= tx + 1; x++) w.terrain.setTile(x, ty, T.Grass);
  const walls = [tx, tx + 1].map((x) => w.tribe.addWall(w, x, ty, 'palisade'));
  assert.ok(walls.every(Boolean));
  for (const wall of walls) { wall.built = 1; wall.hp = 220; }
  w.tribe.autoPlan(w);
  assert.ok(walls.every((wall) => wall.upgrade && wall.upTo === 'stone'));
  const site = sites(w).find((s) => s.kind === 'wall' && s.id === walls[0].id);
  assert.ok(site && !site.locked && site.need === 'stone');
  assert.equal(deliver(w, site, 'stone', 2, site.x, site.y), 2);
  for (let i = 0; i < 4; i++) { const pending = sites(w).find((s) => s.id === walls[0].id); if (pending) work(w, pending, 0.5); }
  assert.equal(walls[0].kind, 'stone');
  assert.equal(walls[0].built, 1);
});

test('polygon age plans shaped-stone production and finishes a wall upgrade', () => {
  const { T, TILE } = require(path.join(root, 'types.ts'));
  const { sites, deliver, work } = require(path.join(root, 'build.ts'));
  const w = new World(7811, false);
  w.camp.learned.add('stonewall');
  w.civ.done.add('precisionStone');
  const tx = Math.floor(w.camp.x / TILE) + 7;
  const ty = Math.floor(w.camp.y / TILE) + 7;
  w.terrain.setTile(tx, ty, T.Grass);
  const wall = w.tribe.addWall(w, tx, ty, 'palisade');
  assert.ok(wall);
  wall.built = 1;
  wall.hp = 220;
  w.tribe.autoPlan(w);
  assert.ok(w.colony.buildings.some((b) => b.kind === 'shapingYard'), 'Auto plans the source of shaped stone');
  assert.equal(wall.upTo, 'polygon');
  const site = sites(w).find((s) => s.kind === 'wall' && s.id === wall.id);
  assert.ok(site && !site.locked && site.need === 'shaped');
  assert.equal(deliver(w, site, 'shaped', 2, site.x, site.y), 2);
  for (let i = 0; i < 5; i++) { const pending = sites(w).find((s) => s.id === wall.id); if (pending) work(w, pending, 0.5); }
  assert.equal(wall.kind, 'polygon');
  assert.equal(wall.built, 1);
});

test('finished homes in an outlying area gain residents and local home routines', () => {
  const { stagesOf } = require(path.join(root, 'build.ts'));
  const { homeArea } = require(path.join(root, 'humans.ts'));
  const w = new World(7812, false);
  const local = w.camp.addShelter(w, w.camp.x + 100, w.camp.y + 80);
  const remote = w.camp.addShelter(w, w.camp.x + 650, w.camp.y - 50);
  local.stage = stagesOf(local).length;
  remote.stage = stagesOf(remote).length;
  const people = Array.from({ length: 8 }, (_, i) => addHuman(w, w.camp.x + i * 4, w.camp.y, false, { role: 'auto' }));
  w.population.assignHomes(w);
  const settlers = people.filter((h) => h.home === remote.id);
  assert.ok(settlers.length > 0, 'residents move into a built outlying area');
  assert.ok(people.some((h) => h.home === local.id), 'original area remains lived in');
  assert.deepEqual(homeArea(w, settlers[0]), { x: remote.x, y: remote.y });
});

test('upgrade all queues every eligible structure once and respects unlocks', () => {
  const { stagesOf, queueUpgrades } = require(path.join(root, 'build.ts'));
  const { T, TILE } = require(path.join(root, 'types.ts'));
  const w = new World(7813, false);
  w.camp.learned.add('stonewall');
  const home = w.camp.addShelter(w, w.camp.x + 100, w.camp.y + 80);
  home.stage = stagesOf(home).length;
  const tower = { id: w.nextId(), stage: 3, stone: false, up: false, have: 0 };
  w.tribe.towers.push(tower);
  const scorpion = { id: w.nextId(), tier: 1, built: 1, up: false, have: {} };
  w.colony.scorpions.push(scorpion);
  const tx = Math.floor(w.camp.x / TILE) + 7, ty = Math.floor(w.camp.y / TILE) + 7;
  w.terrain.setTile(tx, ty, T.Grass);
  const wall = w.tribe.addWall(w, tx, ty, 'palisade');
  assert.ok(wall);
  wall.built = 1; wall.hp = 220;
  assert.deepEqual(queueUpgrades(w), { homes: 1, towers: 1, scorpions: 0, walls: 1 });
  assert.equal(wall.upTo, 'stone');
  assert.deepEqual(queueUpgrades(w), { homes: 0, towers: 0, scorpions: 0, walls: 0 }, 'pending work is not queued twice');
  w.colony.buildings.push({ kind: 'blacksmith', built: 1 });
  assert.deepEqual(queueUpgrades(w, 'scorpions'), { homes: 0, towers: 0, scorpions: 1, walls: 0 });
  assert.equal(scorpion.up, true);
});
