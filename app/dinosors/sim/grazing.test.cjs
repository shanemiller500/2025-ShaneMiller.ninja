const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { addDino } = require('./dinos.ts');
const { makePlant } = require('./plants.ts');
const { makeCarcass } = require('./carcass.ts');
const { T, TILE } = require('./types.ts');
const gz = require('./grazing.ts');

const DT = 1 / 30;
function quiet(seed = 6262) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.plants.length = 0;
  w.plantsDirty = true;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.time = 12;
  w.timePaused = true;
  w.randomEvents.enabled = false;
  w.wildlife.enabled = false;
  if (w.mountainLife) w.mountainLife.enabled = false;
  return w;
}
/** A meadow of `tile` well away from camp. */
function meadow(w, tile = T.Grass) {
  const cx = Math.floor(w.camp.x / TILE) + 40, cy = Math.floor(w.camp.y / TILE) + 25;
  for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 10; x <= cx + 10; x++) w.terrain.setTile(x, y, tile);
  w.nav.sync(w);
  return { x: cx * TILE + 16, y: cy * TILE + 16 };
}
const beast = (w, k, x, y, o = {}) => addDino(w, k, x, y, { growth: 1, homeX: x, homeY: y, thirst: 0, ...o });

test('a hungry plant-eater strips the berries off a bush first, then trims the bush down', () => {
  const w = quiet();
  const m = meadow(w);
  const bush = makePlant(w, 'bush', m.x + 40, m.y, 1);
  bush.fruit = 4;
  bush.food = 1;
  w.plants.push(bush);
  w.plantsDirty = true;
  const trike = beast(w, 'trike', m.x, m.y, { hunger: 0.95 });
  const size0 = bush.size;
  let ateBerries = false;
  for (let k = 0; k < 30 * 40 && bush.size >= size0; k++) {
    w.update(DT);
    trike.thirst = 0;
    if (bush.fruit < 4) ateBerries = true;
    if (bush.size < size0) assert.equal(bush.fruit, 0, 'the berries went first');
  }
  assert.ok(ateBerries, 'it ate the berries');
  assert.ok(bush.size < size0, `and trimmed the bush (${size0} → ${bush.size.toFixed(2)})`);
});

test('grazers crop the grass short where they graze, and it grows back', () => {
  const w = quiet();
  const m = meadow(w);
  const herd = [0, 1, 2, 3].map((k) => beast(w, 'trike', m.x + k * 60, m.y + (k % 2) * 40, { hunger: 0.95 }));
  for (let k = 0; k < 30 * 25 && gz.grazedPatches(w).length < 2; k++) {
    w.update(DT);
    for (const d of herd) d.thirst = 0;
  }
  const list = gz.grazedPatches(w);
  assert.ok(list.length >= 2, `cropped patches (${list.length})`);
  for (const g of list) assert.equal(w.terrain.tileAt(g.x, g.y), T.Grass);
  w.dinos.length = 0;
  for (let k = 0; k < 200; k++) gz.grazeTick(w, 1);
  assert.equal(gz.grazedPatches(w).length, 0, 'grown back');
});

test('mountain goats graze the thin turf up on the rocks', () => {
  const w = quiet();
  const m = meadow(w, T.Rock);
  const goat = beast(w, 'mountainGoat', m.x, m.y, { hunger: 0.95 });
  assert.ok(gz.grazeable(w, goat, m.x, m.y));
  const trike = beast(w, 'trike', m.x + 200, m.y);
  assert.ok(!gz.grazeable(w, trike, m.x, m.y), 'a lowland grazer finds nothing on bare rock');
  const h0 = goat.hunger;
  let grazed = false;
  for (let k = 0; k < 30 * 20 && !grazed; k++) {
    w.update(DT);
    goat.thirst = 0;
    grazed = goat.state === 'eat' && goat.hunger < h0 - 0.05;
  }
  assert.ok(grazed, 'it grazes');
});

test('a meat-eater guards its kill: something smaller that comes close is chased off', () => {
  const w = quiet();
  const m = meadow(w);
  const victim = beast(w, 'trike', m.x, m.y);
  const body = makeCarcass(w, victim, { wild: true });
  w.removeDino(victim);
  const rex = beast(w, 'trex', m.x - 30, m.y, { hunger: 0.9 });
  rex.targetId = body.id;
  rex.state = 'seekFood';
  for (let k = 0; k < 30 * 6 && rex.state !== 'eat'; k++) { w.update(DT); rex.thirst = 0; }
  assert.equal(rex.state, 'eat', 'the rex is eating');
  // a raptor sneaks in for a bite
  const raptor = beast(w, 'raptor', m.x + 220, m.y, { hunger: 0.9 });
  raptor.targetId = body.id;
  raptor.state = 'steal';
  raptor.tx = body.x;
  raptor.ty = body.y;
  let chased = false, snarled = false;
  for (let k = 0; k < 30 * 8 && !chased; k++) {
    w.update(DT);
    rex.thirst = 0;
    raptor.thirst = 0;
    if (rex.emote?.icon === '😠') snarled = true;
    chased = snarled && raptor.state === 'flee';
  }
  assert.ok(snarled, 'the rex snarls + lunges');
  assert.ok(chased, 'the raptor runs for it');
  assert.equal(rex.state, 'eat', 'and the rex goes back to its meal');
  assert.ok(w.dinos.includes(raptor));
  // and it doesn't chase off something its own size
  const rival = beast(w, 'trex', m.x + 90, m.y);
  rival.hunger = 0;
  for (let k = 0; k < 30 * 3; k++) { w.update(DT); rex.thirst = 0; }
  assert.notEqual(rival.state, 'flee');
});

test('meat-eaters still hunt smaller animals and leave the big ones be', () => {
  const w = quiet();
  const m = meadow(w);
  const raptor = beast(w, 'raptor', m.x, m.y, { hunger: 0.95 });
  const compy = beast(w, 'compy', m.x + 120, m.y);
  const brachio = beast(w, 'brachio', m.x - 140, m.y);
  let target = 0;
  for (let k = 0; k < 30 * 4 && !target; k++) { w.update(DT); raptor.thirst = 0; if (raptor.state === 'chase' || raptor.state === 'stalk') target = raptor.targetId; }
  assert.equal(target, compy.id, 'it goes for the small one');
  assert.notEqual(target, brachio.id);
});
