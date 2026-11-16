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
const { stagesOf } = require('./build.ts');
const { addHuman } = require('./humans.ts');
const { addDino } = require('./dinos.ts');
const { thinkDino } = require('./behavior.ts');
const { organizeCastles, wingUnits, castleDragonPad, castleDinoRest, castleReserved } = require('./castleCompound.ts');
const { estates, planWing } = require('./estate.ts');
const { roostOf } = require('./dragonKeep.ts');

function fixture(n = 18) {
  const w = new World(17354, false);
  w.humans.length = 0; w.dinos.length = 0; w.shelters.length = 0;
  w.colony.buildings.length = 0; w.campfires.length = 0; w.tribe.farms.length = 0;
  w.tribe.walls.length = 0; w.tribe.towers.length = 0;
  w.camp.learned.add('shelter'); w.camp.learned.add('stonewall');
  for (let y = 14; y < 84; y++) for (let x = 28; x < 100; x++) w.terrain.setTile(x, y, T.Grass);
  for (let i = 0; i < n; i++) {
    const s = w.camp.addShelter(w, w.camp.x + (i % 6) * 110, w.camp.y + Math.floor(i / 6) * 110);
    s.tier = 4 + (i % 5 === 0 ? 1 : 0); s.stage = stagesOf(s).length;
  }
  return w;
}

test('a crowded camp becomes one compact place without losing homes, beds, residents or upgrades', () => {
  const w = fixture(), ids = w.shelters.map((s) => s.id), tiers = w.shelters.map((s) => s.tier);
  const cap = w.population.capacity(w);
  const sleepers = w.shelters.map((s) => addHuman(w, s.x, s.y + 6, false, { home: s.id, state: 'sleep' }));
  assert.equal(organizeCastles(w, true), 18);
  assert.equal(w.castleCompounds.length, 1); assert.equal(w.castleCompounds[0].wings.length, 6);
  assert.deepEqual(w.shelters.map((s) => s.id), ids); assert.deepEqual(w.shelters.map((s) => s.tier), tiers);
  assert.equal(w.population.capacity(w), cap); assert.equal(w.humans.length, 18);
  assert.equal(new Set(w.shelters.map((s) => s.x + ':' + s.y)).size, 6, 'apartments share real ground footprints');
  const width = Math.max(...w.shelters.map((s) => s.x)) - Math.min(...w.shelters.map((s) => s.x));
  assert.ok(width <= 192, 'wide sprawl tightened into contiguous wings');
  for (const h of sleepers) {
    const home = w.shelters.find((s) => s.id === h.home);
    assert.ok(Math.hypot(h.x - home.x, h.y - home.y) < 35, 'sleeping residents remain with their rooms');
  }
  assert.ok(estates(w).some((e) => e.compound && e.homes.length === 18));
  assert.equal(organizeCastles(w, true), 0, 'no repeated shuffling');
});

test('layout and apartment assignments persist; loading does not trigger another reshuffle', () => {
  const w = fixture(); organizeCastles(w, true);
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.deepEqual(restored.castleCompounds, w.castleCompounds);
  assert.equal(wingUnits(restored, restored.shelters[0]).length, 3);
  assert.equal(restored.population.capacity(restored), w.population.capacity(w));
  assert.equal(organizeCastles(restored, true), 0);
});

test('pads and the dinosaur yard are reserved, usable destinations', () => {
  const w = fixture(); organizeCastles(w, true); w.nav.sync(w);
  const c = w.castleCompounds[0];
  assert.ok(c && c.pads.length === 2 && c.rest);
  for (const p of [...c.pads, c.rest, c.garden]) {
    assert.ok(castleReserved(w, p.x, p.y));
    assert.ok(w.colony.occupied(w).has(Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE)), 'normal placement reserves the actual ground tile');
  }
  assert.equal(w.colony.addBuilding(w, 'storage', c.pads[0].x, c.pads[0].y), null, 'landings stay free of new buildings');
  const dragons = [{ id: w.nextId(), growth: 1 }, { id: w.nextId(), growth: 1 }];
  w.dragons.owned.push(...dragons);
  assert.deepEqual(castleDragonPad(w, dragons[0]), c.pads[0]);
  assert.deepEqual(castleDragonPad(w, dragons[1]), c.pads[1]);
  assert.deepEqual(roostOf(w, dragons[0]), { ...c.pads[0], roost: true });
  const a = addDino(w, 'trike', c.rest.x, c.rest.y, { owner: true, age: 9999, growth: 1, hunger: 0.1, thirst: 0.1 });
  const b = addDino(w, 'trike', c.rest.x, c.rest.y, { owner: true, age: 9999, growth: 1, hunger: 0.1, thirst: 0.1 });
  assert.notDeepEqual(castleDinoRest(w, a), castleDinoRest(w, b), 'separate resting spots');
});

test('no safe land means no partial moves, deletions or capacity changes', () => {
  const w = fixture(6), before = w.shelters.map((s) => ({ ...s })), cap = w.population.capacity(w);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 120; x++) w.terrain.setTile(x, y, T.River);
  assert.equal(organizeCastles(w, true), 0);
  assert.deepEqual(w.shelters, before); assert.equal(w.population.capacity(w), cap);
  assert.equal(w.castleCompounds.length, 0);
});

test('raids and homes being upgraded defer the cleanup', () => {
  const w = fixture(); w.tribe.raid = {};
  assert.equal(organizeCastles(w, true), 0);
  w.tribe.raid = null; w.shelters[0].up = true;
  assert.equal(organizeCastles(w, true), 0);
  w.shelters[0].up = false; assert.equal(organizeCastles(w, true), 18);
});

test('a new addon remains a normal blueprint and only joins the compact castle when finished', () => {
  const w = fixture(); organizeCastles(w, true);
  const before = w.population.capacity(w), first = w.shelters[0];
  const added = planWing(w, first.id);
  assert.equal(typeof added, 'object'); assert.equal(added.stage, 0);
  assert.equal(w.population.capacity(w), before);
  organizeCastles(w, true);
  assert.equal(w.castleCompounds[0].wings.flatMap((g) => g.ids).length, 18);
  added.stage = stagesOf(added).length;
  assert.equal(organizeCastles(w, true), 19);
  assert.equal(w.population.capacity(w), before + 6);
  assert.equal(w.castleCompounds[0].wings.length, 7);
});

test('tired tame dinosaurs walk to the reserved rest yard and sleep in separate spots', () => {
  const w = fixture(); organizeCastles(w, true); w.nav.sync(w);
  const yard = w.castleCompounds[0].rest;
  const d = addDino(w, 'trike', yard.x + 100, yard.y + 100, { owner: true, age: 9999, growth: 1, hunger: 0.1, thirst: 0.1, energy: 0.05 });
  const target = castleDinoRest(w, d);
  assert.ok(target);
  thinkDino(w, d);
  assert.equal(d.state, 'wander'); assert.equal(d.tx, target.x); assert.equal(d.ty, target.y);
  d.x = target.x; d.y = target.y;
  thinkDino(w, d);
  assert.equal(d.state, 'sleep');
  d.owner = false; assert.equal(castleDinoRest(w, d), null, 'wildlife is left alone');
});

test('the periodic world cleanup runs automatically and does not create extra housing', () => {
  const w = fixture();
  const cap = w.population.capacity(w);
  w.update(1.1);
  assert.equal(w.castleCompounds.length, 1);
  assert.equal(w.shelters.length, 18); assert.equal(w.population.capacity(w), cap);
});
