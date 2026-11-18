const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { T, TILE, MAP_W } = require('./types.ts');
const { makePlant, plantHabitat, consumePlant, sproutWildPlant, updatePlants, NATURAL_FLORA } = require('./plants.ts');
const { swallowSeed, passedSeed, humanSeedTick, compostDeposit, seedSoilTick } = require('./plantCycle.ts');
const { addDino } = require('./dinos.ts');
const { actDino } = require('./behavior.ts');
const { addHuman, updateHuman } = require('./humans.ts');
const { roleAct } = require('./tribe.ts');
const { BERRIES } = require('../data/berries.ts');

function fixture() {
  const w = new World(17354, false);
  w.flags.add(NATURAL_FLORA); w.randomEvents.enabled = false; w.weather.auto = false;
  w.tribe.planT = Infinity; w.dragons.timer = Infinity; w.timePaused = true;
  w.humans.length = 0; w.dinos.length = 0; w.elapsed = 10;
  return w;
}
function site(w, meadow = false) {
  for (let y = 10; y < 95; y++) for (let x = 12; x < 145; x++) {
    const h = plantHabitat(w, x, y);
    if (!h || h.meadow !== meadow || !h.mix.some(([k]) => k === 'bush')) continue;
    if (![-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => { const near = plantHabitat(w, x + dx, y + dy); return near?.meadow === meadow && near.mix.some(([k]) => k === 'bush'); }))) continue;
    const px = (x + .5) * TILE, py = (y + .5) * TILE;
    if (Math.hypot(px - w.camp.x, py - w.camp.y) > 500) return { x: px, y: py };
  }
  throw Error('No suitable habitat');
}
const seedAt = (p, kind = 'bush', variant = 2) => ({ kind, variant, originX: p.x - 300, originY: p.y, readyAt: 0 });

test('real dinosaur feeding passes a seed away from its parent; compost settles before a stronger seedling grows', () => {
  const w = fixture(), dest = site(w); w.rng = () => 0;
  const p = makePlant(w, 'bush', dest.x - 200, dest.y); p.variant = 2; w.plants.push(p);
  const d = addDino(w, 'trike', p.x, p.y, { state: 'eat', stateT: 2, targetId: p.id, hunger: .8, poopT: 999, age: 9999 });
  actDino(w, d, .1);
  assert.ok(d.seedMeal); assert.equal(d.seedMeal.variant, 2); assert.ok(p.food < 1);
  assert.equal(passedSeed(w, d), undefined, 'digestion cannot be skipped');
  w.elapsed = d.seedMeal.readyAt + 1;
  assert.equal(passedSeed(w, d), undefined, 'standing at the same plant cannot disperse it');
  d.x = dest.x; d.y = dest.y; d.poopT = 0; d.state = 'idle';
  actDino(w, d, .1);
  const poop = w.items.find((i) => i.kind === 'poop' && i.seed);
  assert.ok(poop); assert.equal(d.seedMeal, undefined);
  poop.t = 46; w.update(.03);
  assert.equal(w.seedBeds.length, 1); assert.equal(w.plants.length, 1, 'compost is not an instant plant');
  w.elapsed = w.seedBeds[0].readyAt + 1; seedSoilTick(w);
  const child = w.plants.find((q) => q !== p);
  assert.ok(child); assert.equal(child.kind, 'bush'); assert.equal(child.variant, 2);
  assert.equal(child.vigor, 1.12); assert.ok(Math.hypot(child.x - p.x, child.y - p.y) >= 96);
  for (let i = 0; i < 500; i++) updatePlants(w, 1);
  assert.ok(child.size > 1 && child.size <= 1.12, 'a modest bonus, not unbounded superplants');
});

test('seed selection is occasional and retries during one meal do not turn every animal into a carrier', () => {
  const w = fixture(), plant = { kind: 'bush', variant: 1, x: 0, y: 0 };
  const animals = Array.from({ length: 200 }, () => ({ x: 0, y: 0 }));
  for (const a of animals) swallowSeed(w, a, plant);
  const count = animals.filter((a) => a.seedMeal).length;
  assert.ok(count > 20 && count < 90, `${count}/200 carry viable seeds`);
  for (let i = 0; i < 60; i++) for (const a of animals) swallowSeed(w, a, plant);
  assert.equal(animals.filter((a) => a.seedMeal).length, count);
});

test('people only acquire seeds after a berry meal, then leave compost after time and movement', () => {
  const w = fixture(); w.rng = () => 0;
  for (const r of ['cooked', 'fish', 'crop', 'meat']) w.camp.stock[r] = 0;
  w.camp.stock.berries = 2;
  const h = addHuman(w, w.camp.x, w.camp.y, false, { state: 'eat', stateT: 3, think: Infinity, hunger: .7 });
  updateHuman(w, h, .1);
  assert.ok(h.seedMeal); assert.equal(w.camp.stock.berries, 1);
  humanSeedTick(w, h, 1); assert.equal(w.items.length, 0);
  w.elapsed = h.seedMeal.readyAt + 1; h.x += 200;
  humanSeedTick(w, h, 1);
  assert.ok(w.items.some((i) => i.kind === 'poop' && i.seed));
});

test('meadows, winter, dense patches and the world plant cap prevent runaway growth', () => {
  const w = fixture(), meadow = site(w, true), dest = site(w); w.rng = () => 0;
  const seed = seedAt(dest);
  assert.equal(sproutWildPlant(w, meadow.x, meadow.y, seed), null);
  w.day = 10; w.seedBeds.push({ seed, ...dest, readyAt: 0, expiresAt: 1200 });
  seedSoilTick(w); assert.equal(w.plants.length, 0, 'winter keeps viable seeds dormant');
  w.day = 1;
  for (let i = 0; i < 25; i++) {
    const a = i / 25 * Math.PI * 2;
    w.plants.push(makePlant(w, 'fern', dest.x + Math.cos(a) * 100, dest.y + Math.sin(a) * 100));
  }
  assert.equal(sproutWildPlant(w, dest.x, dest.y, seed), null, 'local density is bounded');
  w.plants = Array.from({ length: 2400 }, (_, i) => makePlant(w, 'fern', 100 + i, 100));
  assert.equal(sproutWildPlant(w, dest.x, dest.y, seed), null, 'global wild population is bounded');
  w.seedBeds.length = 0;
  for (let i = 0; i < 80; i++) compostDeposit(w, { kind: 'poop', seed, ...dest });
  assert.equal(w.seedBeds.length, 48, 'only a bounded number of seeds await germination');
});

test('some heavily grazed wild plants decompose; deliberate planting is preserved', () => {
  const w = fixture(); w.rng = () => 0;
  const p = makePlant(w, 'bush', 1000, 1000); p.food = .1; w.plants.push(p);
  consumePlant(w, p, .1); assert.equal(p.stump, true); assert.equal(p.decay, 35);
  updatePlants(w, 36); assert.equal(w.plants.length, 0, 'the depleted wild plant returns to soil');
  const garden = makePlant(w, 'bush', 1000, 1000); garden.planted = true; garden.food = .1;
  consumePlant(w, garden, .1); assert.equal(garden.stump, false);
});

test('seed carriers, compost, soil beds, vigor and berry colors survive saving', () => {
  const w = fixture(), dest = site(w), seed = seedAt(dest);
  const d = addDino(w, 'trike', dest.x, dest.y, { seedMeal: seed, nextSeedMeal: 700 });
  const h = addHuman(w, dest.x + 40, dest.y, false); h.seedMeal = seed; h.nextSeedMeal = 800;
  const p = makePlant(w, 'bush', dest.x + 100, dest.y); p.variant = 3; p.vigor = 1.12; p.decay = 20; w.plants.push(p);
  w.addItem('poop', dest.x, dest.y, { seed });
  w.seedBeds.push({ seed, ...dest, readyAt: 80, expiresAt: 1200 }); w.seedGrowthAt = 50;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.deepEqual(back.dinos.find((o) => o.id === d.id).seedMeal, seed);
  assert.deepEqual(back.humans.find((o) => o.id === h.id).seedMeal, seed);
  assert.ok(back.items.some((i) => i.seed?.variant === 2));
  assert.equal(back.seedBeds.length, 1); assert.equal(back.seedGrowthAt, 50);
  assert.equal(back.plants[0].variant, 3); assert.equal(back.plants[0].vigor, 1.12); assert.equal(back.plants[0].decay, 20);
});

test('each berry plantation uses berry cuttings, yields the shared berry food, and fruits again without replanting', () => {
  for (const b of BERRIES) {
    const w = fixture(), x = w.camp.x + 300, y = w.camp.y + 160;
    w.terrain.setTile(Math.floor(x / TILE), Math.floor(y / TILE), T.Grass);
    const f = w.tribe.addFarm(w, x, y, b.crop); assert.ok(f);
    w.camp.stock.berries = 2; w.camp.stock.grass = 0;
    const h = addHuman(w, x, y, false, { state: 'farm', targetId: f.id, stateT: 3 });
    roleAct(w, h, .1);
    assert.equal(f.planted, true); assert.equal(w.camp.stock.berries, 1);
    f.growth = 1; h.state = 'farm'; h.stateT = 3; h.targetId = f.id;
    roleAct(w, h, .1);
    assert.equal(w.camp.stock.berries, 6); assert.equal(w.camp.stock.crop, 0);
    assert.equal(f.planted, true); assert.equal(f.growth, 0);
    const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
    assert.ok(back.tribe.farms.some((o) => o.crop === b.crop && o.planted));
  }
});
