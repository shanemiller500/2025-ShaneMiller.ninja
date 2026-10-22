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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const shows = require(path.join(root, 'sim', 'shows.ts'));
const hall = require(path.join(root, 'sim', 'riderHall.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 9;
  w.daylight = 1;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'fire', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 4; y <= cy + 30; y++) for (let x = cx + 2; x <= cx + 50; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  return w;
}
function pit(w, dx, dy) {
  const p = w.colony.addBuilding(w, 'dragonPit', w.camp.x + dx, w.camp.y + dy);
  assert.ok(p && typeof p === 'object', `placed (${p})`);
  p.built = 1;
  return p;
}
function dragon(w) {
  const egg = { id: w.dragons.nextId(), breed: 'fire', x: w.camp.x + 500, y: w.camp.y + 300, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, hunger: 0, energy: 1, stamina: 1, skills: { trust: 1, follow: 1, flight: 1 } });
  keep.newDragonStats(dr);
  return dr;
}
function run(w, s, each) {
  for (let i = 0; i < Math.round(s * 30); i++) {
    w.update(1 / 30);
    w.events.length = 0;
    w.daylight = w.time > 20 || w.time < 6 ? 0.05 : 1;
    if (each && each(w) === true) return true;
  }
  return false;
}

test('a second dragon pit built beside the first: they join into one bigger pit, centred between them', () => {
  const w = world(9901);
  const a = pit(w, 520, 320);
  hall.placeHall(w);
  w.colony.buildings.find((b) => b.kind === 'riderHall').built = 1;
  const b = pit(w, 520 + 330, 320 + 40);
  const r0 = shows.pitRadius(a);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  run(w, 1.5);
  const left = w.colony.buildings.filter((x) => x.kind === 'dragonPit');
  assert.equal(left.length, 1, 'one pit now');
  assert.equal(left[0], a);
  assert.equal(a.merged, 1);
  assert.ok(shows.pitRadius(a) > r0 * 1.5, `much bigger (${Math.round(r0)} → ${Math.round(shows.pitRadius(a))})`);
  assert.ok(Math.hypot(a.x - mid.x, a.y - mid.y) < 40, 'centred between the two');
  const hb = w.colony.buildings.find((x) => x.kind === 'riderHall');
  assert.ok(Math.hypot(hb.x - a.x, hb.y - a.y) < 2, 'the colosseum moved with it');
  assert.ok(shows.pitMax(a) > shows.PIT_MAX, 'and it can grow bigger than one pit could');
  // saved + loaded
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const p2 = w2.colony.buildings.find((x) => x.kind === 'dragonPit');
  assert.equal(p2.merged, 1);
  assert.ok(Math.abs(shows.pitRadius(p2) - shows.pitRadius(a)) < 2);
});

test('a pit built far away stays a separate pit', () => {
  const w = world(9902);
  pit(w, 520, 320);
  pit(w, 520 + 1400, 320);
  run(w, 1.5);
  assert.equal(w.colony.buildings.filter((x) => x.kind === 'dragonPit').length, 2);
});

test('shade: in the heat of the day the dragons rest under the overhang; at night they sleep in their spots', () => {
  const w = world(9903);
  const p = pit(w, 520, 320);
  const drs = [dragon(w), dragon(w), dragon(w)];
  const shade = shows.pitShade(p);
  const inShade = (d) => Math.hypot((d.x - shade.x) / (shade.rx + 20), (d.y - shade.y) / (shade.ry + 20)) <= 1;
  w.time = 13;
  for (const d of drs) assert.ok(inShade(keep.roostOf(w, d)), 'its midday spot is in the shade');
  const resting = run(w, 120, () => drs.every((d) => inShade(d)));
  assert.ok(resting, `all resting in the shade (${drs.map((d) => Math.round(Math.hypot(d.x - shade.x, d.y - shade.y))).join(', ')})`);
  w.time = 23;
  drs.forEach((d, i) => {
    const want = shows.pitSpot(p, w.dragons.owned.indexOf(d), w.dragons.owned.length);
    const got = keep.roostOf(w, d);
    assert.ok(Math.hypot(got.x - want.x, got.y - want.y) < 1, `dragon ${i}: back to its own sleeping spot at night`);
  });
});
