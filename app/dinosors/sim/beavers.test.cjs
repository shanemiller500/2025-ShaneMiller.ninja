const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { makePlant } = require('./plants.ts');
const { T, TILE, MAP_W } = require('./types.ts');
const { TERRAIN_GEN } = require('./terrain.ts');
const bv = require('./beavers.ts');

function quiet(seed = 5151, gen = TERRAIN_GEN) {
  const w = new World(seed, false, gen);
  w.dinos.length = 0;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.time = 12;
  w.timePaused = true;
  w.randomEvents.enabled = false;
  w.wildlife.enabled = true;
  // (the camera somewhere out of the way)
  w.view = { x0: -9000, x1: -8000, y0: -9000, y1: -8000 };
  return w;
}
const damMid = (s) => ({ x: ((s.tx0 + s.tx1 + 1) / 2) * TILE, y: s.ty * TILE + TILE / 2 });
/** A few trees by the stream for them to gnaw. */
function grove(w, s) {
  const m = damMid(s);
  for (const [dx, dy] of [[-110, -40], [110, -30], [-130, 50], [140, 60], [-90, 120], [100, 130]]) {
    const p = makePlant(w, 'broadleaf', m.x + dx, m.y + dy, 1);
    w.plants.push(p);
  }
}

test('the small streams have beaver dam sites: across the water, bank to bank, away from the camp and the volcanoes', () => {
  const w = quiet();
  const sites = bv.damSites(w);
  assert.ok(sites.length >= 3, `sites: ${sites.length}`);
  for (const s of sites) {
    for (let x = s.tx0; x <= s.tx1; x++) assert.equal(w.terrain.tiles[s.ty * MAP_W + x], T.River, 'the dam goes across stream water');
    assert.notEqual(w.terrain.tiles[s.ty * MAP_W + s.tx0 - 1], T.River, 'a bank on the west');
    assert.notEqual(w.terrain.tiles[s.ty * MAP_W + s.tx1 + 1], T.River, 'and on the east');
    assert.ok(Math.hypot(s.px - w.camp.x, s.py - w.camp.y) > 1000, 'away from camp');
    for (const v of w.volcanoes) assert.ok(Math.hypot(s.px - v.x, s.py - v.y) > 900, 'off the volcanoes');
    assert.ok(s.py < s.ty * TILE, 'the pond backs up upstream');
  }
  // the same every time
  assert.deepEqual(bv.damSites(quiet()).map((s) => [s.tx0, s.ty]), sites.map((s) => [s.tx0, s.ty]));
});

test('a pair of beavers lives at each dam, and they never lay (the land keeps their number)', () => {
  const w = quiet();
  for (let k = 0; k < 3; k++) { w.elapsed += 1; bv.beaverTick(w, 1.1); }
  const sites = bv.damSites(w);
  const beavers = w.dinos.filter((d) => d.species === 'beaver');
  assert.equal(beavers.length, sites.length * 2);
  for (const d of beavers) assert.ok(d.layT > 1e8);
});

test('they gnaw sticks off trees by the stream, carry them back and build the dam up, stick by stick', () => {
  const w = quiet();
  const s = bv.damSites(w)[0];
  grove(w, s);
  w.nav.sync(w);
  let carried = false;
  for (let k = 0; k < 10 * 240 && !s.done; k++) {
    w.update(0.1);
    if (w.dinos.some((d) => bv.beaverHolding(d) === 'stick')) carried = true;
  }
  assert.ok(carried, 'a stick in its teeth');
  assert.ok(s.done, `the dam got built (${s.sticks}/${bv.DAM_STICKS} sticks)`);
});

test('a finished dam backs the stream up into a pond, with fish in it', () => {
  const w = quiet();
  const s = bv.damSites(w)[0];
  const mid = Math.floor(s.py / TILE) * MAP_W + Math.floor(s.px / TILE);
  const before = w.terrain.tiles[mid];
  assert.notEqual(before, T.Shallow);
  bv.finishDam(w, s);
  assert.equal(w.terrain.tiles[mid], T.Shallow, 'the land behind the dam is under water');
  let pond = 0;
  for (let y = s.ty - 6; y < s.ty; y++) for (let x = s.tx0 - 5; x <= s.tx1 + 5; x++) if (w.terrain.tiles[y * MAP_W + x] === T.Shallow && w.terrain.base[y * MAP_W + x] !== T.Shallow) pond++;
  assert.ok(pond >= 8, `a pond (${pond} tiles)`);
  assert.ok(w.terrain.tiles[s.ty * MAP_W + s.tx0] === T.River, 'the dam row itself stays the stream');
  const fish = w.schools.find((f) => f.pond === s.id);
  assert.ok(fish && fish.n > 0, 'fish move in');
  // they swim about in it and stay in it
  for (let k = 0; k < 600; k++) w.update(0.1);
  assert.ok(bv.inPond(s, fish.x, fish.y) || Math.hypot(fish.x - s.px, fish.y - s.py) < s.rx * 1.4, 'still in the pond');
  assert.ok(bv.lodgeOf(s), 'and the beavers have a lodge in it');
});

test('the beavers dive for the pond\'s fish, catch them and sit and eat them; the fish come back', () => {
  const w = quiet();
  const s = bv.damSites(w)[0];
  bv.finishDam(w, s);
  for (let k = 0; k < 3; k++) { w.elapsed += 1; bv.beaverTick(w, 1.1); }
  const fish = w.schools.find((f) => f.pond === s.id);
  const n0 = fish.n;
  let dived = false, ate = false, low = n0;
  for (let k = 0; k < 10 * 120 && !ate; k++) {
    w.update(0.1);
    for (const d of w.dinos) {
      if (bv.beaverDiving(d)) dived = true;
      if (bv.beaverHolding(d) === 'fish') ate = true;
    }
    low = Math.min(low, fish.n);
  }
  assert.ok(dived, 'dived');
  assert.ok(ate, 'caught one and is eating it');
  assert.ok(low < n0, 'one fewer fish');
  const after = fish.n;
  fish.n = 0;
  let back = 0;
  for (let k = 0; k < 10 * 70; k++) { w.update(0.1); back = Math.max(back, fish.n); }
  assert.ok(back > 0, `the fish come back (${after} → 0 → ${back})`);
});

test('a save keeps the pond: the dam is finished on loading, and its fish are back', () => {
  const w = quiet();
  const s = bv.damSites(w)[0];
  bv.finishDam(w, s);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  loaded.view = { x0: -9000, x1: -8000, y0: -9000, y1: -8000 };
  const s2 = bv.damSites(loaded).find((x) => x.tx0 === s.tx0 && x.ty === s.ty);
  assert.ok(s2, 'the same dam site');
  assert.ok(s2.done, 'finished');
  loaded.elapsed += 2;
  bv.beaverTick(loaded, 1.1);
  assert.ok(loaded.schools.some((f) => f.pond === s2.id), 'with its fish');
});
