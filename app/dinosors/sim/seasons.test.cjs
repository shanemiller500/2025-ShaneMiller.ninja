const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '../../..', request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { Engine } = require('../game/engine.ts');
const { T, MAP_W, MAP_H } = require('./types.ts');
const { seasonAt, dayForSeason } = require('./seasons.ts');
const { seasonalTerrainColor, seasonalLeaves } = require('../render/seasonStyle.ts');

function fixture() {
  const w = new World(17654, false);
  w.weather.auto = false;
  const samples = [
    [12, 20, T.Grass], [Math.floor(MAP_W / 2), 60, T.Dune],
    [MAP_W - 15, Math.floor(MAP_H / 2), T.Forest], [80, MAP_H - 15, T.Rock],
  ];
  for (const [x, y, tile] of samples) {
    w.terrain.setTile(x, y, tile); w.snow.cap[y * MAP_W + x] = 0;
    w.fire.heat[y * MAP_W + x] = 0; w.lava.heat[y * MAP_W + x] = 0;
  }
  return { w, samples };
}
const select = (w, id) => Engine.prototype.setSeason.call({ world: w, emit() {} }, id);

test('all four seasons repeat naturally in order, three days each', () => {
  const names = ['spring', 'summer', 'autumn', 'winter'];
  for (let day = 1; day <= 24; day++) {
    const s = seasonAt(day);
    assert.equal(s.def.id, names[Math.floor((day - 1) / 3) % 4]);
    assert.equal(s.dayOf, (day - 1) % 3 + 1);
    assert.equal(s.year, Math.floor((day - 1) / 12) + 1);
  }
});

test('season selection advances the calendar and never rewinds a saved world', () => {
  assert.equal(dayForSeason(1, 'winter'), 10);
  assert.equal(dayForSeason(10, 'summer'), 16);
  assert.equal(dayForSeason(16, 'summer'), 16);
  assert.equal(dayForSeason(16, 'spring'), 25);
});

test('winter covers land across the map, even on a clear day with random weather disabled', () => {
  const { w, samples } = fixture();
  w.day = 10; w.weather.kind = 'clear'; w.weather.snow = 0;
  w.snow.update(w, 1 / 30);
  for (const [x, y] of samples) assert.ok(w.snow.depth[y * MAP_W + x] >= 0.5, `winter reached ${x},${y}`);
});

test('summer clears lowland snow while permanent snowcaps, waterways and hot ground retain their roles', () => {
  const { w, samples } = fixture();
  const exceptions = [T.River, T.Deep, T.Tar, T.Volcano, T.Basalt];
  exceptions.forEach((tile, i) => w.terrain.setTile(30 + i, 30, tile));
  w.terrain.setTile(40, 30, T.Snow); w.snow.cap[30 * MAP_W + 40] = 1;
  select(w, 'winter');
  assert.equal(w.weather.kind, 'snow'); assert.ok(w.weather.temp < 0.2);
  for (const [x, y] of samples) assert.ok(w.snow.depth[y * MAP_W + x] >= 0.5);
  exceptions.forEach((_, i) => assert.equal(w.snow.depth[30 * MAP_W + 30 + i], 0));
  select(w, 'summer');
  assert.equal(seasonAt(w.day).def.id, 'summer');
  assert.equal(w.weather.kind, 'clear'); assert.equal(w.weather.snow, 0);
  assert.ok(w.weather.temp > 0.6);
  for (const [x, y] of samples) assert.equal(w.snow.depth[y * MAP_W + x], 0);
  assert.ok(w.snow.depth[30 * MAP_W + 40] >= 0.75);
});

test('a winter save opens with winter snow already visible throughout the world', () => {
  const { w, samples } = fixture(); select(w, 'winter');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(seasonAt(restored.day).def.id, 'winter');
  for (const [x, y] of samples) assert.ok(restored.snow.depth[y * MAP_W + x] >= 0.5);
});

test('four ground palettes and seasonal trees remain distinct without changing terrain types', () => {
  const ids = ['spring', 'summer', 'autumn', 'winter'];
  const colors = ids.map((id) => seasonalTerrainColor(T.Grass, [140, 190, 88], id));
  assert.equal(new Set(colors.map(String)).size, 4);
  assert.ok(colors[3][2] > colors[1][2] + 100, 'winter is visibly pale and cool');
  const water = seasonalTerrainColor(T.River, [88, 170, 205], 'winter');
  assert.ok(water[2] > water[0], 'water stays blue');
  assert.notDeepEqual(seasonalLeaves('broadleaf', 1, 'autumn'), seasonalLeaves('broadleaf', 1, 'summer'));
  assert.equal(seasonalLeaves('conifer', 1, 'autumn'), null, 'evergreens retain their own foliage');
});

test('choosing winter does not replay skipped disasters, and active events keep their remaining duration', () => {
  const { w } = fixture();
  const now = (w.day - 1) * 24 + w.time;
  w.almanac.events = [
    { kind: 'eruption', at: now + 25, hours: 4, state: 0, luck: 0, err: 0, told: 0, omens: 0 },
    { kind: 'heatWave', at: now - 1, hours: 5, state: 1, luck: 0, err: 0, told: 0, omens: 0 },
  ];
  select(w, 'winter');
  assert.ok(!w.almanac.events.some((e) => e.kind === 'eruption'));
  const active = w.almanac.events.find((e) => e.kind === 'heatWave');
  const after = (w.day - 1) * 24 + w.time;
  assert.equal(active.at + active.hours - after, 4);
});
