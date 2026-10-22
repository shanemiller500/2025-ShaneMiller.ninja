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
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));

const DT = 1 / 30;
function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.storm = 0;
  w.timePaused = true;
  w.time = 12;
  w.daylight = 1;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (let i = 0; i < 4; i++) addHuman(w, w.camp.x + i * 20, w.camp.y + 40);
  return w;
}
function run(w, s, each) {
  for (let i = 0; i < Math.round(s / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
/** a grown, flying dragon of ours, but NOT war-trained */
function ours(w, x, y) {
  const egg = { id: w.dragons.nextId(), breed: 'swift', x, y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, hunger: 0, energy: 1, stamina: 1, skills: { trust: 1, follow: 1, flight: 1, fire: 1 } });
  keep.newDragonStats(dr);
  dr.hp = dr.maxHp;
  return dr;
}
function wild(w, x, y, z = 200) {
  let dr = null;
  for (let k = 0; k < 6 && !dr; k++) {
    dr = w.dragons.summon(w, { x, y });
    if (!dr) w.dragons.list.length = 0;
  }
  Object.assign(dr, { x, y, z, nest: undefined, state: 'circle', tx: x, ty: y, t: 0 });
  return dr;
}

test('a wild dragon comes near the camp: our dragons (not just war-trained ones) chase it off and fight it', () => {
  const w = world(9971);
  const mine = ours(w, w.camp.x + 200, w.camp.y + 100);
  assert.equal(keep.warTrained(mine), false);
  const foe = wild(w, w.camp.x + 500, w.camp.y - 200);
  const hp = foe.hp;
  let chased = false;
  run(w, 40, () => {
    if (mine.cmd?.kind === 'attack' && mine.cmd.target === foe.id) chased = true;
    return chased && (foe.hp < hp || !w.dragons.list.includes(foe));
  });
  assert.ok(chased, 'it went after the intruder');
  assert.ok(foe.hp < hp || !w.dragons.list.includes(foe), 'and hurt it');
});

test('one of ours is grabbed by a wild dragon: our dragon tears them out of its claws and brings them down safe', () => {
  const w = world(9972);
  const mine = ours(w, w.camp.x + 100, w.camp.y);
  const h = w.humans[0];
  const foe = wild(w, h.x + 300, h.y, 150);
  foe.prey = h.id;
  h.snatched = foe.id;
  foe.state = 'carry';
  let caught = false;
  const safe = run(w, 60, () => {
    if (h.rescuedBy === mine.id) caught = true;
    return caught && !h.rescuedBy && h.z === 0;
  });
  assert.ok(caught, 'caught in mid-air');
  assert.ok(safe, 'and set down');
  assert.ok(w.humans.includes(h), 'alive');
  assert.equal(h.snatched, undefined);
  assert.notEqual(foe.prey, h.id, 'out of its claws');
});

test('dropped over the volcano: a dragon close enough catches them before they hit the lava', () => {
  const w = world(9973);
  const v = w.volcano;
  const foe = wild(w, v.x + 10, v.y - 20, 440);
  const h = w.humans[0];
  const mine = ours(w, v.x + 220, v.y);
  mine.z = 380;
  w.dragons.dropBody(w, foe, h, true, true, `${foe.name} dropped ${h.name} into the volcano!`);
  let caught = false;
  run(w, 30, () => { if (h.rescuedBy === mine.id) caught = true; return caught && !h.rescuedBy; });
  assert.ok(caught, 'caught');
  assert.ok(w.humans.includes(h), 'saved from the volcano');
});

test('only our people get saved: a Neanderthal dropped in the volcano is left to fall', () => {
  const w = world(9974);
  const v = w.volcano;
  const foe = wild(w, v.x + 10, v.y - 20, 440);
  const clan = w.rivals.spawnClan(w, 2, { x: w.camp.x + 1500, y: w.camp.y });
  const b = w.rivals.members(clan.id)[0];
  const mine = ours(w, v.x + 220, v.y);
  mine.z = 380;
  w.dragons.dropBody(w, foe, b, true, true, 'gone');
  let tried = false;
  run(w, 5, () => { if (mine.rescue) tried = true; });
  assert.ok(!tried, 'no rescue for them');
});
