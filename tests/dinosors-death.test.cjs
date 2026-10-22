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
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { workOf } = require(path.join(root, 'sim', 'workDinos.ts'));
const { knockOut, hurtHuman } = require(path.join(root, 'sim', 'injury.ts'));
const { issue } = require(path.join(root, 'sim', 'tasks.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const death = require(path.join(root, 'sim', 'death.ts'));

const DT = 1 / 30;
function world(seed, people) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.snow = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  w.population.timer = Infinity;
  for (let i = 0; i < people; i++) addHuman(w, w.camp.x + i * 20, w.camp.y + 40);
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

test('knocked out with nobody to help: after a minute they are gone from the game for good', () => {
  const w = world(9951, 1);
  const [h] = w.humans;
  knockOut(w, h);
  run(w, death.DOWN_FOR * 0.6);
  assert.ok(w.humans.includes(h), 'still hanging on');
  assert.ok(h.fading, 'fading (a warning)');
  run(w, death.DOWN_FOR * 0.5);
  assert.ok(!w.humans.includes(h), 'gone');
  assert.equal(w.tribe.lost, 1);
});

test('a friend who gets to them in time saves them', () => {
  const w = world(9952, 3);
  const [h] = w.humans;
  knockOut(w, h);
  const saved = run(w, death.DOWN_FOR + 10, () => h.state !== 'down');
  assert.ok(saved, 'back on their feet');
  run(w, death.DOWN_FOR + 10);
  assert.ok(w.humans.includes(h), 'and alive');
  assert.equal(w.tribe.lost, 0);
});

test('hurt again while they lie there: time runs out fast, and they do not survive a beating', () => {
  const w = world(9953, 2);
  const [h] = w.humans;
  knockOut(w, h);
  hurtHuman(w, h, 0.3, h.x + 10, h.y, 'bite');
  assert.ok(w.humans.includes(h), 'one more hit: time running out');
  assert.ok(h.downT >= 20);
  for (let i = 0; i < 3; i++) hurtHuman(w, h, 0.3, h.x + 10, h.y, 'bite');
  assert.ok(!w.humans.includes(h), 'a few more and they do not survive');
});

test('Calm mode: nobody dies, they come round by themselves', () => {
  const w = world(9954, 1);
  w.tribe.danger = 'calm';
  const [h] = w.humans;
  knockOut(w, h);
  hurtHuman(w, h, 0.5, h.x, h.y, 'bite');
  run(w, death.DOWN_FOR + 20);
  assert.ok(w.humans.includes(h));
  assert.notEqual(h.state, 'down');
});

test('nothing is left tied to someone who died: their dragon, their dino, their job', () => {
  const w = world(9955, 3);
  const [h, other] = w.humans;
  const egg = { id: w.dragons.nextId(), breed: 'fire', x: h.x + 100, y: h.y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, skills: { trust: 1, follow: 1, flight: 1, rider: 1 } });
  keep.newDragonStats(dr);
  keep.bondDragon(w, dr, h);
  const d = addDino(w, 'raptor', h.x + 60, h.y, { owner: true, tame: 1, age: 9999 });
  workOf(d).partner = h.id;
  h.partner = d.id;
  const t = issue(w, [h, other], { kind: 'move', icon: '👣', label: 'Go', x: h.x + 300, y: h.y, target: 0 });
  death.dies(w, h, 'test');
  assert.ok(!w.humans.includes(h));
  assert.equal(dr.partner, undefined, 'the dragon has no rider now');
  assert.notEqual(dr.keeper, h.id);
  assert.equal(workOf(d).partner, undefined, 'the dino is free');
  assert.ok(!t.people.includes(h.id) && t.people.includes(other.id), 'off the job');
  death.dies(w, h, 'again');
  assert.equal(w.tribe.lost, 1, 'counted once');
});

test('the whole tribe gone: a family of wanderers finds the empty camp and moves in to start again', () => {
  const w = world(9956, 2);
  for (const h of [...w.humans]) death.dies(w, h, 'gone');
  assert.equal(w.humans.length, 0);
  w.population.timer = 1;
  const back = run(w, 5, () => w.humans.filter((h) => !h.stranger).length >= 2);
  assert.ok(back, `a new family moved in (${w.humans.length})`);
  assert.ok(w.humans.every((h) => !h.stranger), 'they live here now');
});
