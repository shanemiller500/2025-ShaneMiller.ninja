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
const { organizeCastles, wingUnits, castleDragonPad, castleDinoRest, castleReserved, castleBodyTiles } = require('./castleCompound.ts');
const { estates, planWing } = require('./estate.ts');
const { roostOf } = require('./dragonKeep.ts');
const { keptClear } = require('./clearArea.ts');

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
  assert.equal(w.castleCompounds.length, 1); assert.equal(w.castleCompounds[0].wings.length, 1);
  assert.deepEqual(w.shelters.map((s) => s.id), ids); assert.deepEqual(w.shelters.map((s) => s.tier), tiers);
  assert.equal(w.population.capacity(w), cap); assert.equal(w.humans.length, 18);
  assert.equal(new Set(w.shelters.map((s) => s.x + ':' + s.y)).size, 1, 'all rooms share one real ground footprint');
  const width = Math.max(...w.shelters.map((s) => s.x)) - Math.min(...w.shelters.map((s) => s.x));
  assert.equal(width, 0, 'one castle replaces the entire house cluster');
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
  assert.equal(wingUnits(restored, restored.shelters[0]).length, 18);
  assert.equal(restored.population.capacity(restored), w.population.capacity(w));
  assert.equal(organizeCastles(restored, true), 0);
  const c = restored.castleCompounds[0];
  assert.ok(keptClear(restored, c.garden.x, c.garden.y), 'the courtyard stays clear after reopening');
  assert.ok(keptClear(restored, c.pads[0].x, c.pads[0].y));
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

test('one upgrading room and a distant raid do not block the whole castle cleanup', () => {
  const w = fixture(); w.tribe.raid = {}; w.shelters[0].up = true; w.shelters[0].upHave = { stone: 3 };
  assert.equal(organizeCastles(w, true), 18);
  assert.equal(w.castleCompounds[0].wings.length, 1);
  assert.equal(w.shelters[0].up, true); assert.equal(w.shelters[0].upHave.stone, 3);
});

test('a new addon remains a normal blueprint and only joins the compact castle when finished', () => {
  const w = fixture(); organizeCastles(w, true);
  const before = w.population.capacity(w), first = w.shelters[0];
  const added = planWing(w, first.id);
  assert.equal(typeof added, 'object'); assert.equal(added.stage, 0);
  assert.equal(w.population.capacity(w), before);
  organizeCastles(w, true);
  assert.equal(w.castleCompounds[0].wings.flatMap((g) => g.ids).length, 19);
  added.stage = stagesOf(added).length;
  assert.equal(organizeCastles(w, true), 0);
  assert.equal(w.population.capacity(w), before + 6);
  assert.equal(w.castleCompounds[0].wings.length, 1);
  assert.equal(wingUnits(w, first).length, 19);
  assert.equal(added.x, first.x); assert.equal(added.y, first.y);
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

test('every shared wing has a reachable entrance and landmarks remain outside its footprint', () => {
  const w = fixture(); organizeCastles(w, true); w.nav.sync(w);
  assert.equal(w.castleCompounds.length, 1);
  for (const wing of w.castleCompounds[0].wings) {
    w.nav.budget = 24000;
    const route = w.nav.find(w, 'human', w.camp.x, w.camp.y + 32, 0, wing.x, wing.y + 18, 0);
    assert.ok(Array.isArray(route), 'workers and residents can reach the entrance');
    assert.ok(w.props.every((p) => Math.abs(wing.x - p.x) > 31 + (p.kind === 'chamber' ? 56 : 24) || Math.abs(wing.y - 15 - p.y) > 28 + (p.kind === 'chamber' ? 48 : 24)));
  }
});

test('an older multi-wing save migrates to one keep even when all its room ids were already managed', () => {
  const w = fixture();
  const origin = { x: w.shelters[0].x, y: w.shelters[0].y };
  const wings = [];
  for (let i = 0; i < 6; i++) {
    const units = w.shelters.slice(i * 3, i * 3 + 3);
    const x = origin.x + (i % 4) * 64, y = origin.y + Math.floor(i / 4) * 96;
    for (const s of units) { s.x = x; s.y = y; }
    wings.push({ x, y, ids: units.map((s) => s.id) });
  }
  w.castleCompounds = [{ id: w.shelters[0].id, origin, wings, garden: { x: origin.x + 96, y: origin.y + 144 }, pads: [], rest: null }];
  const beds = w.population.capacity(w);
  assert.equal(organizeCastles(w, true), 18);
  assert.equal(w.castleCompounds[0].layout, 'keep');
  assert.equal(w.castleCompounds[0].wings.length, 1);
  assert.equal(new Set(w.shelters.map((s) => s.x + ':' + s.y)).size, 1);
  assert.equal(w.population.capacity(w), beds);
});

test('a fenced camp interleaved with working buildings and riverbanks still forms one castle', () => {
  const w = fixture(0);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
    const s = w.camp.addShelter(w, w.camp.x - 96 + col * 128, w.camp.y - 96 + row * 112);
    s.tier = 4; s.stage = stagesOf(s).length;
  }
  const services = [];
  for (const dx of [-32, 96]) for (const dy of [-96, 16, 128, 240]) {
    const b = w.colony.addBuilding(w, 'canopy', w.camp.x + dx, w.camp.y + dy);
    if (b) { b.built = 1; services.push(b); }
  }
  const workshop = w.colony.addBuilding(w, 'workshop', w.camp.x + 270, w.camp.y + 120);
  if (workshop) { workshop.built = 1; services.push(workshop); }
  assert.ok(services.length >= 5, 'the fixture actually has crowded, existing camp buildings');
  w.camp.learned.add('palisade');
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let x = cx - 7; x <= cx + 11; x++) for (const y of [cy - 7, cy + 13]) {
    const wall = w.tribe.addWall(w, x, y, 'palisade'); if (wall) { wall.built = 1; wall.hp = 200; }
  }
  for (let y = cy - 6; y < cy + 13; y++) for (const x of [cx - 7, cx + 11]) {
    const wall = w.tribe.addWall(w, x, y, 'palisade'); if (wall) { wall.built = 1; wall.hp = 200; }
  }
  for (let y = cy - 8; y <= cy + 14; y++) w.terrain.setTile(cx + 13, y, T.River);
  assert.ok(w.tribe.walledIn(w, w.shelters[0].x, w.shelters[0].y), 'the fixture is enclosed');
  const before = services.map((b) => ({ ...b })), beds = w.population.capacity(w);
  w.shelters[2].up = true; w.shelters[2].upHave = { stone: 2 };
  assert.equal(organizeCastles(w, true), 12);
  const keep = w.castleCompounds[0];
  assert.equal(keep.layout, 'keep'); assert.equal(keep.wings.length, 1);
  assert.equal(new Set(w.shelters.map((s) => s.x + ':' + s.y)).size, 1);
  assert.ok(w.tribe.walledIn(w, keep.origin.x, keep.origin.y));
  assert.deepEqual(services, before, 'working buildings are preserved');
  assert.equal(w.population.capacity(w), beds);
  assert.equal(w.shelters[2].upHave.stone, 2);
  w.nav.sync(w);
  assert.ok(castleBodyTiles(w).length >= 3, 'the wider keep has a real navigation footprint');
  w.nav.budget = 24000;
  assert.ok(Array.isArray(w.nav.find(w, 'human', w.camp.x, w.camp.y + 32, 0, keep.origin.x, keep.origin.y + 24, 0)));
});
