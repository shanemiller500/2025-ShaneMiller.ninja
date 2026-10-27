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
const { SPECIES } = require(path.join(root, 'data', 'species.ts'));
const { SNOW_SPECIES } = require(path.join(root, 'sim', 'snowBeasts.ts'));
const wl = require(path.join(root, 'sim', 'repopulate.ts'));

const DT = 1 / 30;
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
function quiet(w) {
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.dragons.timer = Infinity;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  w.population.timer = Infinity;
  return w;
}

test('every kind of dinosaur is always around: wiped out, a mother comes home and lays a clutch (sea reptiles: live young)', () => {
  const w = quiet(new World(9501, false));
  w.dinos.length = 0;
  w.eggs.length = 0;
  w.wildlife.enabled = true;
  w.wildlife.spellT = Infinity;
  run(w, 6);
  // (the snowy peaks' animals keep their own numbers: snowBeasts.ts SnowLife, tested in dinosors-snowlands)
  const VALLEY = SPECIES.filter((d) => !SNOW_SPECIES.has(d.id));
  for (const def of VALLEY) {
    const n = w.wildlife.count(w, def.id);
    assert.ok(n >= wl.MIN_KEEP, `${def.id} came back (${n})`);
    if (def.move === 'swim') assert.ok(!w.eggs.some((e) => e.species === def.id), `${def.id}: no eggs on land`);
    else assert.ok(w.eggs.some((e) => e.species === def.id), `${def.id}: a clutch of eggs`);
  }
  // nobody turns up in the town
  for (const d of w.dinos) assert.ok(Math.hypot(d.x - w.camp.x, d.y - w.camp.y) > 600, `${d.species} not in town`);
  // the eggs hatch into babies
  const babies = () => w.dinos.filter((d) => d.growth < 0.2).length;
  const clutch = new Set(w.eggs.map((e) => e.id));
  assert.ok(run(w, 130, () => !w.eggs.some((e) => clutch.has(e.id))), 'every clutch hatched');
  assert.ok(babies() >= VALLEY.filter((d) => d.move !== 'swim').length * 2, `babies (${babies()})`);
});

test('a species hunted out of a real valley comes back on its own', () => {
  const w = quiet(new World(9502, true));
  run(w, 2);
  const gone = w.dinos.filter((d) => d.species === 'trike');
  assert.ok(gone.length > 0);
  for (const d of gone) w.removeDino(d);
  w.eggs = w.eggs.filter((e) => e.species !== 'trike');
  assert.equal(w.wildlife.count(w, 'trike'), 0);
  const back = run(w, 200, () => w.dinos.some((d) => d.species === 'trike'));
  assert.ok(back, 'trikes back');
});

test('good years + lean years: some species boom (and lay sooner), others dip, and it is saved', () => {
  const w = quiet(new World(9503, true));
  w.wildlife.shuffle(w);
  const ids = SPECIES.map((d) => d.id);
  const up = ids.filter((s) => (w.wildlife.boom[s] ?? 1) > 1.3);
  const down = ids.filter((s) => (w.wildlife.boom[s] ?? 1) < 0.7);
  assert.ok(up.length >= 2 && down.length >= 2, `booms ${up} / dips ${down}`);
  for (const s of up) assert.ok(w.wildlife.cap(s) > wl.baseCap(s), `${s} more than usual`);
  for (const s of down) assert.ok(w.wildlife.cap(s) <= wl.baseCap(s) && w.wildlife.cap(s) >= wl.MIN_KEEP, `${s} fewer, never none`);
  // a booming species' grown-ups lay sooner
  const boomer = up.find((s) => w.dinos.some((d) => d.species === s && d.growth >= 1 && !d.owner));
  if (boomer) {
    for (const d of w.dinos) if (d.species === boomer) d.layT = 900;
    for (const d of w.dinos) if (d.species === boomer) w.eggs = w.eggs.filter((e) => e.species !== boomer);
    if (w.wildlife.count(w, boomer) < w.wildlife.cap(boomer)) {
      run(w, 6);
      assert.ok(w.dinos.filter((d) => d.species === boomer && d.growth >= 1).every((d) => d.layT < 100), 'laying soon');
    }
  }
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = World.deserialize(saved);
  assert.deepEqual(w2.wildlife.boom, w.wildlife.boom);
  assert.ok(w2.wildlife.enabled, 'a loaded game keeps its wildlife coming back');
});

test('a lean year after a boom: a crowded species slowly thins out as some wander off over the hills', () => {
  const w = quiet(new World(9504, true));
  w.wildlife.spellT = Infinity;
  const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
  const herd = w.dinos.find((d) => d.species === 'para');
  for (let i = 0; i < 8; i++) addDino(w, 'para', herd.x + i * 20, herd.y + 30, { homeX: herd.homeX, homeY: herd.homeY });
  w.wildlife.boom.para = 0.4;
  const before = w.dinos.filter((d) => d.species === 'para').length;
  const left = run(w, 200, () => w.dinos.some((d) => d.species === 'para' && d.migrant));
  assert.ok(left, `one moved on (of ${before})`);
  assert.ok(w.wildlife.count(w, 'para') >= 2, 'never down to none');
});
