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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { CAMP_LEVELS } = require(path.join(root, 'data', 'facts.ts'));
const guard = require(path.join(root, 'sim', 'warGuard.ts'));
const riders = require(path.join(root, 'sim', 'riders.ts'));
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
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals['arriveT'] = Infinity;
  // open grassland all round the camp
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 40; y <= cy + 40; y++) for (let x = cx - 50; x <= cx + 50; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < 4) addHuman(w, w.camp.x + w.humans.length * 16, w.camp.y + 30);
  return w;
}
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
const warDino = (w, x, y) => addDino(w, 'trike', x, y, { owner: true, tame: 1, warTraining: 1, hunger: 0, thirst: 0, energy: 1, age: 9999 });
const campR = (w) => CAMP_LEVELS[w.tribe.level].radius;
/** freeze someone where they are (doing their thing) */
const hold = (h, x, y) => { h.x = x; h.y = y; h.think = 999; h.state = 'gather'; h.vx = h.vy = 0; };

test('a war dino with nobody to guard patrols round and round the camp, outside the walls', () => {
  const w = world(9201);
  for (const h of w.humans) hold(h, w.camp.x, w.camp.y + 20);
  const d = warDino(w, w.camp.x + campR(w) + 150, w.camp.y);
  const angles = [];
  run(w, 60, () => {
    angles.push(Math.atan2(d.y - w.camp.y, d.x - w.camp.x));
    d.hunger = 0; d.thirst = 0; d.energy = 1;
  });
  const spread = Math.max(...angles) - Math.min(...angles);
  assert.ok(spread > 1.2, `it gets round the camp (${spread.toFixed(2)} rad)`);
  const r = Math.hypot(d.x - w.camp.x, (d.y - w.camp.y) / 0.75);
  assert.ok(r > campR(w) + 60, 'outside the camp');
});

test('one war animal per person out in the wild: it sticks close (not on top of them) and fights what threatens them', () => {
  const w = world(9202);
  const [a, b] = w.humans.filter((h) => !h.child);
  hold(a, w.camp.x + 900, w.camp.y + 100);
  hold(b, w.camp.x - 900, w.camp.y - 80);
  for (const h of w.humans) if (h !== a && h !== b) hold(h, w.camp.x, w.camp.y + 20);
  const d1 = warDino(w, w.camp.x + campR(w) + 150, w.camp.y);
  const d2 = warDino(w, w.camp.x - campR(w) - 150, w.camp.y);
  guard.assignWards(w);
  assert.ok(d1.ward && d2.ward && d1.ward !== d2.ward, 'each person has their own guard');
  assert.equal(d1.ward, a.id, 'the nearest');
  run(w, 40, () => { for (const d of [d1, d2]) { d.hunger = 0; d.thirst = 0; d.energy = 1; } hold(a, w.camp.x + 900, w.camp.y + 100); hold(b, w.camp.x - 900, w.camp.y - 80); });
  const gap = Math.hypot(d1.x - a.x, d1.y - a.y);
  assert.ok(gap < 170 && gap > 25, `close but not on top (${gap.toFixed(0)})`);
  // a predator comes for them: the guard goes for it
  const rex = addDino(w, 'allo', a.x + 160, a.y, { age: 9999 });
  rex.state = 'chase';
  rex.think = 999;
  let fought = false;
  run(w, 4, () => { if (d1.state === 'war' && d1.targetId === rex.id) fought = true; rex.state = 'chase'; return fought; });
  assert.ok(fought, 'it attacks the threat');
  // threat gone: straight back to its person
  w.removeDino(rex);
  run(w, 15, () => { d1.hunger = 0; d1.energy = 1; hold(a, w.camp.x + 900, w.camp.y + 100); });
  assert.ok(Math.hypot(d1.x - a.x, d1.y - a.y) < 200, 'back guarding');
});

test('at home under attack, a war dino fights even without its person', () => {
  const w = world(9203);
  for (const h of w.humans) hold(h, w.camp.x - 1200, w.camp.y);
  const d = warDino(w, w.camp.x + campR(w) + 150, w.camp.y);
  const raider = addDino(w, 'raptor', w.camp.x + 60, w.camp.y + 40, { raider: true, age: 9999 });
  raider.think = 999;
  w.tribe.raid = { phase: 'attack', t: 0, ids: [raider.id], fromX: 0, fromY: 0, breached: false, label: 'test' };
  let fought = false;
  run(w, 4, () => { if (d.state === 'war' && d.targetId === raider.id) fought = true; return fought; });
  assert.ok(fought);
});

test('a bonded rider climbs on and rides the patrol with their war dino', () => {
  const w = world(9204);
  const h = w.humans.find((x) => !x.child);
  for (const o of w.humans) if (o !== h) hold(o, w.camp.x, w.camp.y + 20);
  h.x = w.camp.x + campR(w) + 120; h.y = w.camp.y;
  const d = warDino(w, h.x + 30, h.y);
  d.work = d.work ?? { skills: { riding: 1 }, focus: null, trainer: 0, practice: 0, harness: 0, auto: true, cargo: null, cargoN: 0, job: null, source: null, site: '', targetX: 0, targetY: 0 };
  d.work.skills.riding = 1;
  assert.equal(riders.bond(w, d, h), null);
  let mounted = false;
  const a0 = Math.atan2(h.y - w.camp.y, h.x - w.camp.x);
  let moved = 0;
  run(w, 40, () => {
    d.hunger = 0; d.thirst = 0; d.energy = 1;
    if (h.riding === d.id) mounted = true;
    moved = Math.max(moved, Math.abs(Math.atan2(h.y - w.camp.y, h.x - w.camp.x) - a0));
  });
  assert.ok(mounted, 'on its back');
  assert.ok(moved > 0.4, `riding the patrol (${moved.toFixed(2)} rad round)`);
});

test('a war dragon is on guard duty full time: patrolling with its rider aboard, circling over someone out in the wild', () => {
  const w = world(9205);
  const [rider, worker] = w.humans.filter((x) => !x.child);
  for (const o of w.humans) if (o !== rider && o !== worker) hold(o, w.camp.x, w.camp.y + 20);
  rider.x = w.camp.x + 60; rider.y = w.camp.y + 60; rider.role = 'auto';
  const egg = { id: w.nextId(), breed: 'fire', x: rider.x + 40, y: rider.y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, hunger: 0, energy: 1, stamina: 1, skills: { trust: 1, follow: 1, flight: 1, fire: 1, carry: 1, rider: 1, combat: 1 } });
  keep.newDragonStats(dr);
  dr.hp = dr.maxHp;
  keep.bondDragon(w, dr, rider);
  hold(worker, w.camp.x + 1100, w.camp.y + 150);
  let aboard = false;
  let duty = 0;
  let nearWard = false;
  run(w, 160, () => {
    dr.hunger = 0; dr.stamina = 1; dr.energy = 1;
    hold(worker, w.camp.x + 1100, w.camp.y + 150);
    if (rider.aloft === dr.id) aboard = true;
    if (dr.cmd?.kind === 'patrol' && dr.cmd.duty) duty++;
    if (dr.ward === worker.id && dr.z > 50 && Math.hypot(dr.x - worker.x, dr.y - worker.y) < 260) nearWard = true;
  });
  assert.ok(aboard, 'its rider rides with it');
  assert.ok(duty > 30 * 140, `on duty nearly the whole time (${(duty / 30).toFixed(0)} s)`);
  assert.ok(nearWard, 'circling over the one out in the wild');
});
