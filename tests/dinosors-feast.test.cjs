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
const { makeCarcass } = require(path.join(root, 'sim', 'carcass.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const feast = require(path.join(root, 'sim', 'feast.ts'));

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
  for (const t of ['tools', 'fire', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 14; y <= cy + 14; y++) for (let x = cx - 14; x <= cx + 60; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
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
function body(w, x, y) {
  const d = addDino(w, 'trike', x, y, { age: 9999 });
  const it = makeCarcass(w, d);
  w.removeDino(d);
  return it;
}
function dragon(w) {
  const egg = { id: w.dragons.nextId(), breed: 'fire', x: w.camp.x + 260, y: w.camp.y + 120, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, hunger: 0.4, energy: 1, stamina: 1, skills: { trust: 1, follow: 1, flight: 1, fire: 1, carry: 1 } });
  keep.newDragonStats(dr);
  return dr;
}

test('a dead dinosaur in town never rots (one out in the wild does)', () => {
  const w = world(9401);
  const town = body(w, w.camp.x + 220, w.camp.y + 60);
  const wild = body(w, w.camp.x + 2400, w.camp.y + 60);
  const meat = town.carcass.meat;
  run(w, 1000);
  assert.ok(w.items.includes(town), 'still lying in town');
  assert.equal(town.carcass.meat, meat, 'still fresh');
  assert.equal(town.carcass.rot, 0);
  assert.ok(!w.items.includes(wild) || wild.carcass.meat < meat * 0.2, 'the one in the wild went off');
});

test('a dragon walks over and roasts a body in town: its share, the rest roast (no fire in the town)', () => {
  const w = world(9402);
  const dr = dragon(w);
  const it = body(w, w.camp.x + 300, w.camp.y + 40);
  const meat = it.carcass.meat;
  const hunger = dr.hunger;
  let fires = 0;
  const done = run(w, 120, () => {
    fires = Math.max(fires, w.fire.active.size);
    return !!it.carcass.cooked;
  });
  assert.ok(done, 'roasted');
  assert.ok(Math.hypot(dr.x - it.x, dr.y - it.y) < 160, 'right beside it');
  assert.equal(it.carcass.meat, 0);
  assert.ok(it.carcass.roast >= meat * 0.6 && it.carcass.roast < meat, `roast for the table (${it.carcass.roast} of ${meat})`);
  assert.ok(dr.hunger < hunger, 'the dragon had a bite');
  assert.equal(fires, 0, 'cooking fire lights nothing');
  assert.ok(w.items.includes(it), 'nothing rots while it waits');
});

test('someone carries the roast to the table by the fire, and hungry people line up until it is all eaten', () => {
  const w = world(9403);
  dragon(w);
  for (let i = 0; i < 9; i++) addHuman(w, w.camp.x - 120 + (i % 3) * 30, w.camp.y + 90 + Math.floor(i / 3) * 24);
  const people = w.humans.filter((h) => !h.child);
  for (const h of people) h.hunger = 0.1;
  const it = body(w, w.camp.x + 300, w.camp.y + 40);
  assert.ok(run(w, 120, () => !!it.carcass.cooked), 'roasted');
  const roast = it.carcass.roast;
  // carried over to the table
  assert.ok(run(w, 120, () => w.colony.feast.food >= roast), `all on the table (${w.colony.feast.food}/${roast})`);
  assert.ok(!w.items.includes(it) || !it.carcass.roast, 'none left on the body');
  // dinner time: everyone's hungry at once → a line
  for (const h of people) h.hunger = 0.5;
  let line = 0;
  const table = feast.feastTable(w);
  const ate = run(w, 400, () => {
    const q = w.colony.feast.queue.map((id) => w.humans.find((h) => h.id === id)).filter((h) => h && Math.hypot(h.x - table.x, h.y - table.y) < 200);
    line = Math.max(line, q.length);
    for (const h of w.humans) if (!w.colony.feast.queue.includes(h.id) && h.hunger < 0.3 && w.colony.feast.food > 0) h.hunger = 0.5;
    return w.colony.feast.food === 0;
  });
  assert.ok(line >= 2, `a line formed (${line})`);
  assert.ok(ate, `it was all eaten (${w.colony.feast.food} left, ${w.colony.feast.eaten} eaten)`);
  assert.ok(w.colony.feast.eaten >= roast);
});

test('a dragon on patrol sticks to it: rests when tired (no wandering off to cook), then goes back by itself, till told otherwise', () => {
  const w = world(9404);
  const dr = dragon(w);
  dr.skills.combat = 0;
  assert.equal(keep.commandDragon(w, dr, 'patrol', { x: w.camp.x, y: w.camp.y }), null);
  assert.equal(dr.post?.kind, 'patrol', 'its job now');
  run(w, 20);
  assert.equal(dr.cmd?.kind, 'patrol');
  assert.ok(dr.z > 40, 'up patrolling');
  // worn out: home to rest
  dr.stamina = 0.1;
  const it = body(w, w.camp.x + 260, w.camp.y + 30);
  let rested = false;
  run(w, 90, () => { if (dr.z < 2 && !dr.cmd) rested = true; return rested; });
  assert.ok(rested, 'landed to rest');
  run(w, 20);
  assert.ok(!dr.cook && !it.carcass.cooked, 'it does not go off to cook while it has a job');
  assert.notEqual(dr.cmd?.kind, 'patrol', 'still resting');
  // rested: back on patrol on its own
  dr.stamina = 0.9;
  dr.restT = 0;
  const back = run(w, 10, () => dr.cmd?.kind === 'patrol');
  assert.ok(back, 'back on patrol by itself');
  // told otherwise: the job ends
  assert.equal(keep.commandDragon(w, dr, 'home'), null);
  assert.equal(dr.post, undefined, 'a new order ends the patrol job');
});
