const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { T, TILE } = require('./types.ts');
const { addHuman } = require('./humans.ts');
const { stagesOf, shelterDone, sites, deliver, work } = require('./build.ts');
const { estates, planWing, wingSpot } = require('./estate.ts');
const { applyTool, DEFAULT_TOOL } = require('../game/tools.ts');
const { awningLayout } = require('../render/awningLayout.ts');

function fixture() {
  const w = new World(17352, false);
  w.humans.length = 0; w.dinos.length = 0; w.shelters.length = 0;
  w.colony.buildings.length = 0; w.campfires.length = 0; w.tribe.farms.length = 0;
  w.tribe.walls.length = 0; w.tribe.towers.length = 0;
  w.camp.learned.add('shelter'); w.camp.learned.add('stonewall');
  for (let y = 24; y < 60; y++) for (let x = 40; x < 85; x++) w.terrain.setTile(x, y, T.Grass);
  return w;
}
function home(w, x = w.camp.x, y = w.camp.y, tier = 4) {
  const s = w.camp.addShelter(w, x, y); s.tier = tier; s.stage = stagesOf(s).length;
  return s;
}
function people(w, n) { return Array.from({ length: n }, (_, i) => addHuman(w, w.camp.x + i * 2, w.camp.y + 30, false)); }

test('nearby stone homes join; distant homes, blueprints and tents retain their identity', () => {
  const w = fixture(); const a = home(w), b = home(w, a.x + 90, a.y + 25, 5);
  home(w, a.x + 600, a.y); home(w, a.x - 90, a.y, 0);
  w.camp.addShelter(w, a.x, a.y + 90, 'castle');
  const groups = estates(w);
  assert.equal(groups.length, 2);
  assert.deepEqual(new Set(groups.find((e) => e.homes.includes(a)).homes), new Set([a, b]));
  assert.equal(w.shelters.length, 5, 'none are replaced or deleted');
  assert.equal(b.tier, 5, 'upgrades retained');
});

test('connections do not bridge water or run through another building', () => {
  const w = fixture(), a = home(w), b = home(w, a.x + 104, a.y);
  const mx = Math.floor((a.x + b.x) / 2 / TILE), my = Math.floor(a.y / TILE);
  w.terrain.setTile(mx, my, T.River);
  assert.equal(estates(w).length, 2);
  w.terrain.setTile(mx, my, T.Grass);
  assert.equal(estates(w).length, 1);
  w.colony.buildings.push({ id: w.nextId(), kind: 'storage', x: (a.x + b.x) / 2, y: a.y, tx: mx, ty: my, hp: 100, built: 1, have: {} });
  assert.equal(estates(w).length, 2);
});

test('an open ring receives a central garden; an occupied centre does not', () => {
  const w = fixture(), a = home(w);
  for (const [gx, gy] of [[1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]]) home(w, a.x + gx * 104, a.y + gy * 80);
  const e = estates(w)[0];
  assert.equal(e.homes.length, 8); assert.deepEqual(e.garden, { x: a.x + 104, y: a.y + 80 });
  w.campfires.push({ x: e.garden.x, y: e.garden.y });
  assert.equal(estates(w)[0].garden, null);
});

test('Add wing reserves a clear adjacent blueprint, requires supplies and work, then adds six beds', () => {
  const w = fixture(), a = home(w); const before = w.population.capacity(w);
  const wing = planWing(w, a.id);
  assert.equal(typeof wing, 'object'); assert.equal(wing.plan, 'castle');
  assert.equal(w.population.capacity(w), before, 'unfinished rooms do not count');
  assert.ok(Math.hypot(wing.x - a.x, wing.y - a.y) <= 110);
  const spent = {};
  for (let i = 0; i < stagesOf(wing).length; i++) {
    let site = sites(w).find((s) => s.id === wing.id);
    const stage = stagesOf(wing)[wing.stage];
    work(w, site, 100);
    assert.equal(wing.stage, i, 'work alone cannot skip missing materials');
    const used = deliver(w, site, stage.need, stage.n, wing.x, wing.y);
    spent[stage.need] = (spent[stage.need] ?? 0) + used;
    site = sites(w).find((s) => s.id === wing.id);
    work(w, site, 100);
  }
  assert.deepEqual(spent, { stone: 18, wood: 6, leaves: 6 });
  assert.ok(shelterDone(wing)); assert.equal(w.population.capacity(w), before + 6);
  assert.equal(estates(w)[0].homes.length, 2);
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const saved = restored.shelters.find((s) => s.id === wing.id);
  assert.equal(saved.plan, 'castle'); assert.ok(shelterDone(saved));
  assert.equal(restored.population.capacity(restored), before + 6);
});

test('multiple clicks reserve separate sites and preserve the centre of the courtyard', () => {
  const w = fixture(), a = home(w);
  const planned = Array.from({ length: 4 }, () => planWing(w, a.id));
  assert.ok(planned.every((s) => typeof s === 'object'));
  assert.equal(new Set(planned.map((s) => s.x + ':' + s.y)).size, 4);
  assert.ok(planned.every((s) => s.x !== a.x + 104 || s.y !== a.y + 80));
  for (let y = 24; y < 60; y++) for (let x = 40; x < 85; x++) w.terrain.setTile(x, y, T.River);
  assert.equal(wingSpot(w, a), null);
  assert.equal(typeof planWing(w, a.id), 'string');
});

test('families cannot overfill beds, existing excess people survive, and each resident has a named bed', () => {
  const w = fixture(), a = home(w); const cap = w.population.capacity(w);
  people(w, cap - 1);
  const family = [0, 1].map(() => addHuman(w, w.camp.x, w.camp.y, false, { stranger: true, family: 909 }));
  w.population.arrived(w, family[0]);
  assert.ok(family.every((h) => h.stranger), 'whole family waits for enough beds');
  const b = home(w, a.x + 104, a.y);
  w.population.arrived(w, family[0]);
  assert.ok(family.every((h) => !h.stranger));
  const labels = w.humans.map((h) => w.population.bedLabel(w, h));
  assert.ok(labels.every((s) => /bed \d+\//.test(s)));
  // Include the home id when checking uniqueness: each wing has its own numbered rooms.
  assert.equal(new Set(w.humans.map((h) => h.home + ':' + w.population.bedLabel(w, h))).size, w.humans.length);
  b.hp = 0; w.population.assignHomes(w);
  const count = w.humans.length;
  assert.ok(w.humans.some((h) => /Waiting for a bed/.test(w.population.bedLabel(w, h))));
  w.population.update(w, 0.1);
  assert.equal(w.humans.length, count, 'loss of beds never deletes people');
});

test('Auto does not increase beds; manual people placement waits for a completed free bed', () => {
  const w = fixture(), a = home(w);
  people(w, w.population.capacity(w));
  const before = w.humans.length;
  assert.equal(applyTool(w, { ...DEFAULT_TOOL, id: 'people', people: 'adult' }, w.camp.x, w.camp.y + 60, false), false);
  assert.equal(w.humans.length, before);
  w.tribe.autoPlan(w); w.day = 3; w.tribe.autoImprove(w);
  assert.equal(w.shelters.length, 1); assert.equal(a.up, false);
});

test('births pause at the last bed and resume only after a requested wing is finished', () => {
  const w = fixture(), a = home(w);
  people(w, w.population.capacity(w)); w.camp.stock.cooked = 100;
  const initial = w.humans.length;
  w.tribe.birthT = 0; w.tribe.updateGrowth(w, 0.1);
  assert.equal(w.humans.length, initial);
  const wing = planWing(w, a.id);
  w.tribe.birthT = 0; w.tribe.updateGrowth(w, 0.1);
  assert.equal(w.humans.length, initial, 'a blueprint is not a bed');
  wing.stage = stagesOf(wing).length;
  w.tribe.birthT = 0; w.tribe.updateGrowth(w, 0.1);
  assert.equal(w.humans.length, initial + 1);
  assert.match(w.population.bedLabel(w, w.humans.at(-1)), /bed \d+\//);
});

test('an unfinished wing saves its stone deliveries and resumes at the right stage', () => {
  const w = fixture(), a = home(w), wing = planWing(w, a.id);
  wing.stage = 2; wing.have = 7;
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const saved = restored.shelters.find((s) => s.id === wing.id);
  assert.equal(saved.plan, 'castle'); assert.equal(saved.stage, 2); assert.equal(saved.have, 7);
  assert.equal(stagesOf(saved)[saved.stage].need, 'stone');
  assert.equal(stagesOf(saved)[saved.stage].n, 10);
  assert.equal(restored.population.capacity(restored), w.population.capacity(w));
});

test('sideways awnings join at the actual roof origin, regardless of placement order', () => {
  const w = fixture();
  const canopies = [[0, 0], [128, 0], [64, 0]].map(([dx, dy]) => ({ id: w.nextId(), kind: 'canopy', x: w.camp.x + dx, y: w.camp.y + dy, built: 1, hp: 100 }));
  w.colony.buildings.push(...canopies);
  const spans = awningLayout(w);
  assert.equal(spans.length, 2, 'one continuous row without redundant diagonals');
  assert.equal(new Set(spans.flatMap((l) => [l.aId, l.bId])).size, 3, 'every awning is connected');
  for (const span of spans) {
    assert.equal(span.ay, canopies.find((b) => b.id === span.aId).y, 'no half-tile roof offset');
    assert.equal(span.by, canopies.find((b) => b.id === span.bId).y);
  }
});

test('diagonal awning rows join, while water, walls and unfinished awnings do not', () => {
  const w = fixture();
  const a = { id: w.nextId(), kind: 'canopy', x: w.camp.x, y: w.camp.y, built: 1, hp: 100 };
  const b = { ...a, id: w.nextId(), x: a.x + 64, y: a.y + 64 };
  w.colony.buildings.push(a, b);
  assert.equal(awningLayout(w).length, 1);
  b.built = 0.5; assert.equal(awningLayout(w).length, 0);
  b.built = 1;
  const tx = Math.floor((a.x + b.x) / 2 / TILE), ty = Math.floor((a.y + b.y) / 2 / TILE);
  w.terrain.setTile(tx, ty, T.River); assert.equal(awningLayout(w).length, 0);
  w.terrain.setTile(tx, ty, T.Grass);
  w.tribe.walls.push({ tx, ty }); assert.equal(awningLayout(w).length, 0);
});
