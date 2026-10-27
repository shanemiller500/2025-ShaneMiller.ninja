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
const { makePlant } = require(path.join(root, 'sim', 'plants.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const vine = require(path.join(root, 'sim', 'vineyard.ts'));

const DT = 1 / 30;
function world(seed, people = 3) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.daylight = 1;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'fire', 'farming', 'basket']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 6; y <= cy + 20; y++) for (let x = cx - 6; x <= cx + 30; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  for (let i = 0; i < people; i++) addHuman(w, w.camp.x + i * 20, w.camp.y + 40);
  return w;
}
function run(w, s, each) {
  for (let i = 0; i < Math.round(s / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
function farmer(w) {
  const [h] = w.humans.filter((x) => !x.child);
  h.role = 'farmer';
  for (const o of w.humans) if (o !== h) o.role = 'guard';
  return h;
}

test('a vineyard planted over wild berry bushes: the wild growth is cleared into neat rows (the bushes are the cuttings)', () => {
  const w = world(9981);
  farmer(w);
  const x = w.camp.x + 260, y = w.camp.y + 140;
  const wild = [];
  for (let i = 0; i < 6; i++) {
    const p = makePlant(w, i % 2 ? 'bush' : 'fern', x - 40 + i * 16, y - 10 + (i % 3) * 8, 1);
    if (p.kind === 'bush') p.fruit = 2;
    w.plants.push(p);
    wild.push(p);
  }
  w.camp.stock.berries = 0;
  const f = w.tribe.addFarm(w, x, y, 'grape');
  assert.ok(f);
  assert.ok(vine.vinesReady(w, f), 'wild bushes on it: ready to plant, no berries needed');
  assert.ok(run(w, 120, () => f.planted), 'planted');
  assert.ok(wild.every((p) => !w.plants.includes(p)), 'the wild growth is gone');
  assert.ok(w.camp.stock.berries >= 3, `their berries went to the stores (${w.camp.stock.berries})`);
});

test('on bare ground a vineyard is planted from 2 berries; it grows, the grapes are picked, and the vines stay', () => {
  const w = world(9982);
  farmer(w);
  w.camp.stock.berries = 5;
  const f = w.tribe.addFarm(w, w.camp.x + 260, w.camp.y + 140, 'grape');
  assert.ok(run(w, 120, () => f.planted), 'planted');
  assert.equal(w.camp.stock.berries, 3, 'two berries as cuttings');
  f.growth = 1;
  const grapes = w.camp.stock.grapes;
  assert.ok(run(w, 120, () => w.camp.stock.grapes > grapes), 'harvested');
  assert.equal(w.camp.stock.grapes - grapes, vine.GRAPE_YIELD);
  assert.ok(f.planted && f.growth < 1 && f.growth > 0, 'the vines stay planted and grow again');
  // saved + loaded
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(w2.tribe.farms[0].crop, 'grape');
  assert.equal(w2.camp.stock.grapes, w.camp.stock.grapes);
});

test('the winery: a cook with nothing to roast treads the grapes into wine', () => {
  const w = world(9983);
  const [h] = w.humans.filter((x) => !x.child);
  h.role = 'cook';
  for (const o of w.humans) if (o !== h) o.role = 'guard';
  const b = w.colony.addBuilding(w, 'winery', w.camp.x + 200, w.camp.y + 100);
  assert.ok(b && typeof b === 'object');
  b.built = 1;
  w.colony.version++;
  w.camp.stock.grapes = 9;
  w.camp.stock.meat = 0;
  w.camp.stock.fish = 0;
  let pressing = false;
  run(w, 120, () => { if (h.state === 'press') pressing = true; return w.camp.stock.wine >= 3; });
  assert.ok(pressing, 'treading the grapes');
  assert.equal(w.camp.stock.wine, 3);
  assert.equal(w.camp.stock.grapes, 0);
});

test('grown-ups enjoy a cup of wine of an evening (it perks them up); children never get any', () => {
  const w = world(9984, 3);
  const adult = w.humans.find((h) => !h.child);
  const kid = addHuman(w, w.camp.x, w.camp.y + 50, true);
  w.camp.stock.wine = 5;
  w.time = 20;
  adult.energy = 0.4;
  let drank = false;
  for (let i = 0; i < 50 && !drank; i++) drank = vine.maybeDrink(w, adult);
  assert.ok(drank, 'a cup');
  assert.ok(adult.energy > 0.6, 'perked up');
  for (let i = 0; i < 50; i++) assert.equal(vine.maybeDrink(w, kid), false);
  // and not in the middle of the day
  const other = w.humans.find((h) => !h.child && h !== adult);
  w.time = 12;
  for (let i = 0; i < 50; i++) assert.equal(vine.maybeDrink(w, other), false);
});

test('wineries built side by side grow vines round them; the vines keep to open land, off the water and clear of what we built', () => {
  const estate = require(path.join(root, 'sim', 'wineEstate.ts'));
  const { MAP_W } = require(path.join(root, 'sim', 'types.ts'));
  const w = world(9987);
  const cx = Math.floor(w.camp.x / TILE) + 14, cy = Math.floor(w.camp.y / TILE) + 8;
  // water a few tiles east of the wineries
  for (let y = cy - 8; y <= cy + 10; y++) for (let x = cx + 5; x <= cx + 12; x++) w.terrain.setTile(x, y, T.Shallow);
  w.nav.sync(w);
  const a = w.colony.addBuilding(w, 'winery', (cx - 1) * TILE, (cy + 1) * TILE);
  assert.ok(a && typeof a === 'object');
  a.built = 1;
  w.colony.version++;
  assert.equal(estate.wineryEstates(w).length, 0, 'one winery on its own stays a winery');
  const b = w.colony.addBuilding(w, 'winery', (cx + 1) * TILE, (cy + 1) * TILE);
  assert.ok(b && typeof b === 'object', `second winery placed (${b})`);
  b.built = 1;
  assert.ok(w.tribe.addTower(w, (cx - 6) * TILE, cy * TILE), 'a tower nearby');
  w.colony.version++;
  const [e] = estate.wineryEstates(w);
  assert.ok(e, 'they joined');
  assert.equal(e.wineries.length, 2);
  assert.ok(e.vines.length > 10, `vines planted round it (${e.vines.length})`);
  const water = (i) => w.terrain.tiles[i] === T.Shallow;
  for (const i of e.vines) {
    const tx = i % MAP_W, ty = Math.floor(i / MAP_W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) assert.ok(!water((ty + dy) * MAP_W + tx + dx), 'never on or right beside the water');
  }
  const built = w.colony.occupied(w);
  for (const i of e.vines) assert.ok(!built.has(i), 'never on anything built');
  const t = w.tribe.towers[0];
  assert.ok(e.vines.every((i) => Math.abs((i % MAP_W) - t.tx - 0.5) > 1.5 || Math.abs(Math.floor(i / MAP_W) - t.ty - 0.5) > 1.5), 'a tile clear of the tower');
  // wild growth on a vine tile is cleared for the rows; a bush off the vines stays
  const v = e.vines[0];
  const inside = makePlant(w, 'bush', (v % MAP_W) * TILE + 16, Math.floor(v / MAP_W) * TILE + 16, 1);
  const outside = makePlant(w, 'bush', (cx + 2) * TILE, (cy - 8) * TILE, 1);
  w.plants.push(inside, outside);
  run(w, 2);
  assert.ok(!w.plants.includes(inside), 'the vine rows are cleared');
  assert.ok(w.plants.includes(outside), 'off the vines is left alone');
  assert.ok(w.flags.has('wineVines'), 'the player is told');
  // pulled down to one: back to a plain winery
  w.colony.buildings.splice(w.colony.buildings.indexOf(b), 1);
  w.colony.version++;
  assert.equal(estate.wineryEstates(w).length, 0);
});
