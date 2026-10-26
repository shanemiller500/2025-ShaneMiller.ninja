// Headless tests for the living world (Phase 2): seasons, the almanac of world events and
// their forecasts, new neighbourhoods, fire stories, worn footpaths and map generations.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const root = path.join(__dirname, '..', 'app', 'dinosors', 'sim');
const { World } = require(path.join(root, 'world.ts'));
const { addHuman } = require(path.join(root, 'humans.ts'));
const { seasonAt, SEASON_DAYS, hoursOf } = require(path.join(root, 'seasons.ts'));
const { nextWeather } = require(path.join(root, 'weather.ts'));
const { buildZones, homeSpot, MAIN_HOMES } = require(path.join(root, 'zones.ts'));
const { stagesOf } = require(path.join(root, 'build.ts'));
const { T, TILE, MAP_W } = require(path.join(root, 'types.ts'));
const { LM, TERRAIN_GEN } = require(path.join(root, 'terrain.ts'));
const { Trails } = require(path.join(root, 'trails.ts'));

const DT = 1 / 30;
const run = (w, seconds) => { for (let i = 0; i < seconds / DT; i++) { w.update(DT); w.events.length = 0; } };
const dayOf = (season) => 1 + ['spring', 'summer', 'autumn', 'winter'].indexOf(season) * SEASON_DAYS;

test('the year turns: four seasons, starting in spring', () => {
  assert.equal(seasonAt(1).def.id, 'spring');
  assert.equal(seasonAt(1 + SEASON_DAYS).def.id, 'summer');
  assert.equal(seasonAt(1 + SEASON_DAYS * 2).def.id, 'autumn');
  assert.equal(seasonAt(1 + SEASON_DAYS * 3).def.id, 'winter');
  assert.equal(seasonAt(1 + SEASON_DAYS * 4).def.id, 'spring');
  assert.equal(seasonAt(1 + SEASON_DAYS * 4).year, 2);
});

test('the weather follows the season: snow in winter, never in summer; heat in summer, never in winter', () => {
  const w = new World(11, false);
  const sample = (season) => {
    w.day = dayOf(season);
    const n = {};
    for (const from of ['clear', 'cloudy', 'snow', 'windy', 'fog', 'rain']) for (let k = 0; k < 300; k++) { const x = nextWeather(w, from); n[x] = (n[x] || 0) + 1; }
    return n;
  };
  const winter = sample('winter');
  const summer = sample('summer');
  assert.ok((winter.snow ?? 0) > 300, `plenty of winter snow (${winter.snow})`);
  assert.equal(summer.snow ?? 0, 0, 'no summer snow');
  assert.equal(summer.blizzard ?? 0, 0);
  assert.equal(winter.hot ?? 0, 0, 'no winter heat');
  assert.ok((summer.hot ?? 0) > 100, 'summer heat');
});

test('crops stand still in winter and plants grow back slowly', () => {
  const w = new World(12, false);
  w.randomEvents.enabled = false;
  w.timePaused = true;
  w.tribe.farms.push({ id: 1, x: 100, y: 100, planted: true, growth: 0, crop: 'wheat' });
  w.day = dayOf('summer');
  run(w, 20);
  const summerGrowth = w.tribe.farms[0].growth;
  w.tribe.farms[0].growth = 0;
  w.day = dayOf('winter');
  run(w, 20);
  assert.ok(summerGrowth > 0.1, `summer crops grow (${summerGrowth})`);
  assert.equal(w.tribe.farms[0].growth, 0, 'nothing grows in winter');
});

test('the almanac plans this season and the next ahead, and saves them', () => {
  const w = new World(13);
  run(w, 1);
  assert.ok(w.almanac.planned >= seasonAt(w.day).index + 1, 'next season planned already');
  assert.ok(w.almanac.events.length > 0, 'something is coming');
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.almanac.events.length, w.almanac.events.length);
  assert.equal(back.almanac.planned, w.almanac.planned);
});

test('a drought holds the sky clear and stalls plants + crops until it breaks', () => {
  const w = new World(14, false);
  w.day = dayOf('summer');
  run(w, DT);
  const now = hoursOf(w);
  w.almanac.events = [{ kind: 'drought', at: now + 0.05, hours: 2, state: 0, luck: 0.5, err: 0, told: 0, omens: 0 }];
  w.almanac.planned = 99;
  run(w, 10);
  assert.ok(w.almanac.active('drought'), 'under way');
  assert.equal(w.weather.kind, 'clear');
  assert.ok(w.almanac.plantsMul() < 0.3 && w.almanac.farmsMul() < 0.3);
  w.time += 3;
  run(w, 1);
  assert.ok(!w.almanac.active('drought'), 'it breaks');
});

test('a meteor shower leaves meteor fragments to collect', () => {
  const w = new World(15, false);
  w.time = 22;
  w.timePaused = true;
  run(w, DT);
  const before = w.colony.nodes.filter((n) => n.kind === 'meteorite').length;
  w.almanac.events = [{ kind: 'meteorShower', at: hoursOf(w) - 0.01, hours: 50, state: 0, luck: 0.5, err: 0, told: 0, omens: 0 }];
  w.almanac.planned = 99;
  run(w, 40);
  w.timePaused = false;
  w.time += 0.5;
  run(w, 1);
  const after = w.colony.nodes.filter((n) => n.kind === 'meteorite').length;
  assert.ok(after > before, `fragments landed (${before} → ${after})`);
});

test('the volcano grumbles a day ahead, then erupts', () => {
  const w = new World(16, false);
  run(w, DT);
  // wait out any grumble already going on
  for (let k = 0; k < 3000 && w.volcano.phase !== 'idle'; k++) w.update(0.1);
  assert.equal(w.volcano.phase, 'idle');
  const now = hoursOf(w);
  w.almanac.events = [{ kind: 'eruption', at: now + 23.9, hours: 6, state: 0, luck: 0.5, err: 0, told: 0, omens: 0 }];
  w.almanac.planned = 99;
  run(w, 1);
  assert.equal(w.almanac.events[0].omens, 1, 'the first grumble');
  assert.notEqual(w.volcano.phase, 'idle');
  // let the grumble settle, then jump to the eruption
  for (let k = 0; k < 2000 && w.volcano.phase !== 'idle'; k++) w.update(0.1);
  w.time += 24;
  if (w.time >= 24) { w.time -= 24; w.day++; }
  run(w, 1);
  assert.equal(w.almanac.events[0].state, 1, 'erupting');
});

test('sky watchers foresee what is coming only once they know enough, and false alarms never happen', () => {
  const w = new World(17, false);
  run(w, DT);
  const now = hoursOf(w);
  w.almanac.events = [
    { kind: 'coldSnap', at: now + 6, hours: 12, state: 0, luck: 0.1, err: 0, told: 0, omens: 0 },
    { kind: 'drought', at: now + 4, hours: 1, state: 0, phantom: true, luck: 0.99, err: 0, told: 0, omens: 0 },
  ];
  w.almanac.planned = 99;
  w.sky.knowledge = 0;
  assert.equal(w.almanac.forecasts(w).length, 0, 'nothing known yet');
  w.sky.knowledge = 900;
  const seen = w.almanac.forecasts(w).map((f) => f.text);
  assert.ok(seen.some((t) => /cold snap/i.test(t)), `the cold snap is foreseen (${seen})`);
  assert.ok(seen.some((t) => /drought/i.test(t)), 'a false alarm can fool them');
  w.time += 5;
  run(w, 1);
  assert.equal(w.almanac.events.find((e) => e.phantom).state, 2, 'the false alarm passes');
  assert.ok(!w.almanac.active('drought'), 'and nothing happened');
});

test('once the cave camp is full of homes, Auto builds out a new neighbourhood (then fills it)', () => {
  const w = new World(18, false);
  const c = w.camp;
  for (let i = 0; i < MAIN_HOMES; i++) {
    const a = (i / MAIN_HOMES) * Math.PI * 2;
    const s = c.addShelter(w, c.x + Math.cos(a) * 130, c.y + 50 + Math.sin(a) * 80);
    s.stage = stagesOf(s).length;
  }
  w.tribe.zones = buildZones(w);
  const spot = homeSpot(w);
  assert.ok(spot && spot.founded, 'a new neighbourhood');
  const d = Math.hypot(spot.x - c.x, spot.y - c.y);
  assert.ok(d >= 600 && d <= 1100, `out in the land (${Math.round(d)}px)`);
  const s = c.addShelter(w, spot.x, spot.y);
  s.stage = stagesOf(s).length;
  w.tribe.zones = buildZones(w);
  const next = homeSpot(w);
  assert.ok(next && !next.founded && Math.hypot(next.x - spot.x, next.y - spot.y) < 260, 'the next home joins it');
});

test('children who sit at the fire with grown-ups grow up faster than children on their own', () => {
  const w = new World(19, false);
  w.randomEvents.enabled = false;
  w.timePaused = true;
  w.time = 22;
  // a cloudy night: nobody slips off to watch the stars instead
  w.weather.auto = false;
  w.weather.set(w, 'cloudy');
  w.weather.cloud = 0.9;
  const c = w.camp;
  w.campfires.length = 0;
  const f = { id: w.nextId(), x: c.x, y: c.y + 14, lit: true, fuel: 1, cook: 0 };
  w.campfires.push(f);
  const adult = addHuman(w, f.x + 30, f.y, false);
  const kid = addHuman(w, f.x - 30, f.y, true, { age: 100 });
  const alone = addHuman(w, c.x + 400, c.y + 200, true, { age: 100 });
  for (const [h, seat] of [[adult, 0], [kid, 4]]) { h.fireId = f.id; h.seat = seat; h.state = 'sitFire'; h.stateT = seat ? 1 : 50; h.think = 1e9; }
  alone.state = 'idle';
  alone.think = 1e9;
  for (let k = 0; k < 300; k++) { w.update(DT); w.events.length = 0; adult.think = kid.think = alone.think = 1e9; }
  assert.ok(kid.age - 100 > (alone.age - 100) * 1.4, `listening helps (${(kid.age - 100).toFixed(1)} vs ${(alone.age - 100).toFixed(1)})`);
});

test('busy routes wear footpaths that make walking easier, and unused ones grass over', () => {
  const w = new World(20, false);
  const x0 = w.camp.x + 40;
  const y = w.camp.y + 60;
  const i = Math.floor(y / TILE) * MAP_W + Math.floor(x0 / TILE);
  for (let k = 0; k < 30; k++) w.trails.step(w, x0, y);
  assert.ok(w.trails.worn[i] >= Trails.footpath, 'a footpath');
  w.nav.sync(w);
  assert.ok(w.nav.cost[i] < 1, 'easier going');
  for (let k = 0; k < 60; k++) w.trails.fade(20);
  assert.ok(w.trails.worn[i] < Trails.footpath, 'fades without use');
});

test('new worlds get the bigger northern range; old saves keep the map they were made with', () => {
  assert.ok(TERRAIN_GEN >= 2);
  // (the northern range of the old valley: the eastern lands are the same for every generation)
  const mountains = (w) => w.terrain.tiles.reduce((n, t, i) => n + (t === T.Mountain && i % MAP_W < 160 && i < 40 * MAP_W ? 1 : 0), 0);
  const fresh = new World(21, false);
  const old = new World(21, false, 1);
  assert.ok(mountains(fresh) > mountains(old) * 1.1, `a bigger range (${mountains(old)} → ${mountains(fresh)})`);
  // the landmarks stay put
  const at = (w, p) => w.terrain.tiles[p.y * MAP_W + p.x];
  for (const w of [fresh, old]) {
    assert.equal(at(w, LM.camp), T.Dirt);
    assert.equal(at(w, LM.lake), T.Deep);
  }
  // a save from before generations were recorded loads with the original map
  const data = JSON.parse(JSON.stringify(old.serialize()));
  delete data.terrainGen;
  const back = World.deserialize(data);
  assert.equal(back.terrain.gen, 1);
  assert.deepEqual(Array.from(back.terrain.tiles.slice(0, 4000)), Array.from(old.terrain.tiles.slice(0, 4000)));
  const back2 = World.deserialize(JSON.parse(JSON.stringify(fresh.serialize())));
  assert.equal(back2.terrain.gen, TERRAIN_GEN);
});
