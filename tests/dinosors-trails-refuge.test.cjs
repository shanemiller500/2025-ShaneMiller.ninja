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
const { T, TILE, MAP_W } = require(path.join(root, 'sim', 'types.ts'));
const { addHuman, moveHuman, updateHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { applyTool } = require(path.join(root, 'game', 'tools.ts'));
const { stagesOf } = require(path.join(root, 'sim', 'build.ts'));

test('repeated walking leaves no footpath or navigation discount', () => {
  const w = new World(9101, false);
  const tx = 62, ty = 46;
  for (let x = tx; x <= tx + 2; x++) w.terrain.setTile(x, ty, T.Grass);
  w.nav.sync(w);
  const h = addHuman(w, tx * TILE + 14, ty * TILE + 16, false, { role: 'gatherer' });
  for (let n = 0; n < 5; n++) {
    h.x = tx * TILE + 30;
    h.y = ty * TILE + 16;
    h.tx = (tx + 1) * TILE + 16;
    h.ty = h.y;
    h.pathKey = 0;
    moveHuman(w, h, 0.2);
  }
  const footIndex = Math.floor((ty * TILE + 16) / 8) * (MAP_W * 4) + Math.floor((tx * TILE + 30) / 8);
  assert.equal(w.trails.at(tx * TILE + 16, ty * TILE + 16), 0);
  assert.equal(w.trails.detail[footIndex], 0);
  w.nav.sync(w);
  assert.ok(w.nav.cost[ty * MAP_W + tx] >= 0.9);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(loaded.trails.at(tx * TILE + 16, ty * TILE + 16), 0);
});
test('bone torches can be strung across a route and light a planned path', () => {
  const w = new World(9102, false);
  w.camp.learned.add('fire');
  const ty = 46, start = 62;
  for (let tx = start; tx <= start + 5; tx++) w.terrain.setTile(tx, ty, T.Grass);
  w.nav.sync(w);
  const tool = { id: 'build', build: 'boneTorch' };
  assert.equal(applyTool(w, tool, (start + 0.5) * TILE, (ty + 0.5) * TILE, false), true);
  assert.equal(applyTool(w, tool, (start + 4.5) * TILE, (ty + 0.5) * TILE, true), true);
  assert.equal(w.colony.buildings.filter((b) => b.kind === 'boneTorch').length, 2);
  assert.ok(w.trails.at((start + 2.5) * TILE, (ty + 0.5) * TILE) >= 5);
  const litFootIndex = Math.floor(((ty + 0.5) * TILE) / 8) * (MAP_W * 4) + Math.floor(((start + 2.5) * TILE) / 8);
  assert.ok(w.trails.detail[litFootIndex] >= 5, 'torch line is a continuous fine trail');
  w.nav.budget = 24000;
  w.nav.sync(w);
  const walker = addHuman(w, (start + 0.5) * TILE, (ty + 0.5) * TILE, false, { role: 'gatherer' });
  walker.tx = (start + 4.5) * TILE; walker.ty = walker.y;
  moveHuman(w, walker, 1 / 30);
  assert.ok(walker.path && walker.path.length, 'people route along the marked path');
  assert.ok(w.buildSites().some((s) => s.kind === 'building' && s.id === w.colony.buildings[0].id));
});

test('nonfighters head for reachable walled refuge during a raid', () => {
  const w = new World(9103, false);
  const x0 = 64, y0 = 45, x1 = 72, y1 = 53;
  for (let ty = y0 - 2; ty <= y1 + 2; ty++) for (let tx = x0 - 2; tx <= x1 + 2; tx++) w.terrain.setTile(tx, ty, T.Grass);
  for (let tx = x0; tx <= x1; tx++) for (const ty of [y0, y1]) {
    const wall = w.tribe.addWall(w, tx, ty, 'palisade');
    assert.ok(wall);
    wall.built = 1; wall.hp = 100;
  }
  for (let ty = y0 + 1; ty < y1; ty++) for (const tx of [x0, x1]) {
    const wall = w.tribe.addWall(w, tx, ty, 'palisade', tx === x0 && ty === y0 + 4 ? 'gate' : 'wall');
    assert.ok(wall);
    wall.built = 1; wall.hp = 100;
  }
  w.tribe.walls.find((wall) => wall.part === 'gate').open = false;
  w.tribe.version++;
  w.nav.sync(w);
  w.nav.budget = 24000;
  const h = addHuman(w, (x0 - 2) * TILE + 16, (y0 + 4) * TILE + 16, false, { role: 'gatherer' });
  w.tribe.raid = { phase: 'warn', t: 0, ids: [], fromX: w.camp.x + 900, fromY: w.camp.y, breached: false, label: 'Raid' };
  const refuge = w.tribe.walledRefuge(w, h);
  assert.ok(refuge, 'the walled area is reachable through its gate');
  assert.ok(w.tribe.enclosed(w, refuge.x, refuge.y));
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'flee');
  assert.ok(w.tribe.enclosed(w, h.tx, h.ty));
});

test('an idle specialist helps upgrade a home', () => {
  const w = new World(9104, false);
  const h = addHuman(w, w.camp.x + 30, w.camp.y + 20, false, { role: 'cook' });
  const home = w.camp.addShelter(w, w.camp.x + 200, w.camp.y + 100);
  home.stage = stagesOf(home).length;
  assert.equal(w.camp.startUpgrade(w, home), true);
  w.camp.stock.wood = 20;
  w.camp.stock.stone = 20;
  w.camp.stock.clay = 20;
  w.nav.sync(w);
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  assert.equal(h.site, 'upgrade:' + home.id);
});




test('builders skip a stalled site and take a buildable one', () => {
  const { buildThink } = require(path.join(root, 'sim', 'tasks.ts'));
  const w = new World(9105, false);
  const ty = 46, tx = 62;
  for (let x = tx; x <= tx + 4; x++) w.terrain.setTile(x, ty, T.Grass);
  const blocked = w.colony.addBuilding(w, 'boneTorch', (tx + 0.5) * TILE, (ty + 0.5) * TILE);
  const ready = w.colony.addBuilding(w, 'path', (tx + 4.5) * TILE, (ty + 0.5) * TILE);
  assert.ok(blocked && ready);
  const h = addHuman(w, blocked.x + TILE, blocked.y, false, { role: 'builder' });
  w.camp.stock.bone = 0;
  w.camp.stock.stone = 2;
  w.nav.sync(w);
  assert.equal(buildThink(w, h, () => true), true);
  assert.equal(h.site, 'building:' + ready.id);
});






test('old saved walking tracks disappear while placed torch routes survive', () => {
  const w = new World(9106, false);
  const ty = 46, start = 62;
  for (let tx = start; tx <= start + 8; tx++) w.terrain.setTile(tx, ty, T.Grass);
  const a = w.colony.addBuilding(w, 'boneTorch', (start + 0.5) * TILE, (ty + 0.5) * TILE);
  const b = w.colony.addBuilding(w, 'boneTorch', (start + 4.5) * TILE, (ty + 0.5) * TILE);
  assert.ok(a && b);
  w.nav.sync(w);
  w.trails.connect(w, a.x, a.y, b.x, b.y);
  const data = JSON.parse(JSON.stringify(w.serialize()));
  const oldTrack = ty * MAP_W + start + 8;
  data.trails.push([oldTrack, 20]);
  const loaded = World.deserialize(data);
  assert.equal(loaded.trails.wear[oldTrack], 0, 'walking track from an old save is removed');
  assert.ok(loaded.trails.at((start + 2.5) * TILE, (ty + 0.5) * TILE) >= 5, 'torch route is rebuilt');
});
test('people sharing an open route spread out without losing their destination', () => {
  const w = new World(9110, false);
  for (let ty = 42; ty <= 55; ty++) for (let tx = 62; tx <= 68; tx++) w.terrain.setTile(tx, ty, T.Grass);
  w.nav.sync(w);
  const walkers = Array.from({ length: 9 }, (_, i) => {
    const h = addHuman(w, 65.5 * TILE, (52.5 + i * 0.38) * TILE, false, { role: 'gatherer' });
    h.tx = 65.5 * TILE;
    h.ty = 43.5 * TILE;
    return h;
  });
  for (let tick = 0; tick < 110; tick++) for (const h of walkers) moveHuman(w, h, 1 / 30);
  const xs = walkers.map((h) => h.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 12, 'walkers use more than one line on open ground');
  assert.ok(walkers.every((h) => h.y < 52 * TILE), 'every walker continues towards the destination: ' + walkers.map((h) => Math.round(h.y / TILE)).join(','));
  assert.ok(walkers.every((h) => w.nav.passable('human', h.x, h.y)), 'spacing stays on walkable ground');
});



test('a small crowd still crosses a one tile gate', () => {
  const w = new World(9111, false);
  for (let ty = 43; ty <= 55; ty++) for (let tx = 62; tx <= 68; tx++) w.terrain.setTile(tx, ty, T.Grass);
  for (let tx = 62; tx <= 68; tx++) {
    const wall = w.tribe.addWall(w, tx, 49, 'palisade', tx === 65 ? 'gate' : 'wall');
    assert.ok(wall);
    wall.built = 1;
    wall.hp = 100;
  }
  w.tribe.version++;
  w.nav.sync(w);
  w.nav.budget = 24000;
  const walkers = Array.from({ length: 3 }, (_, i) => {
    const h = addHuman(w, (65.5 + (i - 1) * 0.3) * TILE, (53.5 + i * 0.45) * TILE, false, { role: 'gatherer' });
    h.tx = 65.5 * TILE;
    h.ty = 45.5 * TILE;
    return h;
  });
  for (let tick = 0; tick < 420; tick++) for (const h of walkers) moveHuman(w, h, 1 / 30);
  assert.ok(walkers.every((h) => h.y < 49 * TILE), 'everyone gets through the gate');
  assert.ok(walkers.every((h) => w.nav.passable('human', h.x, h.y)));
});


test('hanging torch strings light only when both ends are built and survive a save', () => {
  const w = new World(9110, false);
  w.camp.learned.add('fire');
  const ty = 46, start = 62;
  for (let tx = start; tx <= start + 5; tx++) w.terrain.setTile(tx, ty, T.Grass);
  w.nav.sync(w);
  const tool = { id: 'build', build: 'boneTorch' };
  assert.ok(applyTool(w, tool, (start + 0.5) * TILE, (ty + 0.5) * TILE, false));
  assert.ok(applyTool(w, tool, (start + 4.5) * TILE, (ty + 0.5) * TILE, true));
  const [a, b] = w.colony.buildings.filter((building) => building.kind === 'boneTorch');
  assert.equal(w.trails.lightLinks.length, 1);
  assert.equal(w.trails.builtLinks(w).length, 0, 'planned strings do not glow before construction');
  a.built = b.built = 1;
  assert.equal(w.trails.builtLinks(w).length, 1);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(loaded.trails.lightLinks.length, 1);
  assert.equal(loaded.trails.builtLinks(loaded).length, 1);
  const removed = loaded.colony.buildings.find((building) => building.kind === 'boneTorch');
  loaded.colony.removeBuilding(removed);
  loaded.trails.disconnectTorch(loaded, removed.x, removed.y);
  assert.equal(loaded.trails.builtLinks(loaded).length, 0);
  assert.equal(loaded.trails.lightLinks.length, 0);
});
