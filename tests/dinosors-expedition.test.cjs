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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const ch = require(path.join(root, 'sim', 'chariots.ts'));

const DT = 1 / 30;
function world(seed, people = 12) {
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
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'spear', 'bow', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 10; x <= cx + 60; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x + (w.humans.length % 6) * 18, w.camp.y + 30 + Math.floor(w.humans.length / 6) * 18);
  for (const h of w.humans) h.role = 'guard';
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
function chariot(w, x, y) {
  const b = w.colony.addBuilding(w, 'warChariot', x, y);
  b.built = 1;
  run(w, 0.1);
  const c = w.colony.chariots[w.colony.chariots.length - 1];
  addDino(w, 'trike', c.x + 80, c.y, { owner: true, tame: 1, age: 9999, hunger: 0, thirst: 0 });
  return c;
}
function rideDino(w, h) {
  const d = addDino(w, 'raptor', h.x + 160, h.y + 40, { owner: true, tame: 1, age: 9999, hunger: 0, thirst: 0 });
  workOf(d).partner = h.id;
  h.partner = d.id;
  return d;
}
function rideDragon(w, h) {
  const egg = { id: w.dragons.nextId(), breed: 'fire', x: h.x + 200, y: h.y - 60, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, skills: { trust: 1, follow: 1, flight: 1, rider: 1 } });
  keep.newDragonStats(dr);
  keep.bondDragon(w, dr, h);
  return dr;
}
function nestAt(w, dx, dy) {
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  n.found = true;
  n.x = w.camp.x + dx; n.y = w.camp.y + dy;
  for (const e of w.dragons.eggs.filter((e) => e.nest === n.id)) { e.x = n.x; e.y = n.y; }
  return n;
}

test('sent at a nest: riders take their own dino + dragon, the chariot seats fill next, only the rest walk', () => {
  const w = world(9301, 14);
  const n = nestAt(w, 1300, 100);
  const c = chariot(w, w.camp.x + 300, w.camp.y + 200);
  const people = w.humans.filter((h) => !h.child);
  const dinoMan = people[3];
  const dragonMan = people[4];
  const d = rideDino(w, dinoMan);
  const dr = rideDragon(w, dragonMan);
  run(w, 1.2);
  assert.equal(ch.startHunt(w, 'ring', { people, nest: n.id }), null);
  const hunt = w.colony.hunt;
  const of = (h) => hunt.crew.find((m) => m.id === h.id);
  assert.equal(of(dinoMan).ride, 'dino');
  assert.equal(of(dragonMan).ride, 'dragon');
  assert.equal(hunt.crew.filter((m) => m.chariot === c.id).length, 10, 'every chariot seat filled before anyone walks');
  assert.equal(hunt.crew.filter((m) => !m.chariot && !m.ride).length, people.length - 12, 'the rest on foot');
  // nobody sets out till (nearly) everyone is aboard / mounted / at the muster point
  let checked = false;
  run(w, 150, () => {
    if (w.colony.hunt.phase === 'muster') return false;
    checked = true;
    assert.equal(dinoMan.riding, d.id, 'on their dino before setting out');
    assert.equal(dragonMan.aloft, dr.id, 'on their dragon before setting out');
    assert.ok(w.humans.filter((h) => h.chariot === c.id).length >= 9, 'chariot full');
    return true;
  });
  assert.ok(checked, 'set out');
  // they only attack once 98% are in their places round the nest
  let fought = false;
  run(w, 300, () => {
    if (w.colony.hunt?.phase !== 'battle') return false;
    fought = true;
    return true;
  });
  assert.ok(fought, 'surrounded the nest and attacked');
  assert.ok(Math.hypot(c.x - n.x, c.y - n.y) < 420, 'the chariot is round the nest');
  assert.ok(Math.hypot(dr.x - n.x, dr.y - n.y) < 500, 'the dragon carried its rider there');
});

test('sent at a clan camp: the same force goes out, waits for 98%, then wins the camp and frees our people', () => {
  const w = world(9302, 12);
  const clan = w.rivals.spawnClan(w, 3, { x: w.camp.x + 1400, y: w.camp.y + 60 });
  assert.ok(clan);
  Object.assign(clan, { raidT: Infinity, spyT: Infinity, ambushT: Infinity, trapT: Infinity, riteT: Infinity });
  for (const b of w.rivals.members(clan.id)) { b.age = 180; b.hp = Math.min(b.hp, 30); }
  chariot(w, w.camp.x + 300, w.camp.y + 200);
  const people = w.humans.filter((h) => !h.child);
  for (const h of people) w.colony.equipKind(h, 'spear');
  run(w, 1.2);
  assert.equal(ch.startHunt(w, 'pincer', { people, clan: clan.id }), null);
  const hunt = w.colony.hunt;
  assert.equal(hunt.clan, clan.id);
  assert.equal(hunt.crew.filter((m) => m.chariot).length, 10, 'chariot filled first');
  let placedAtAttack = -1;
  let result = null;
  run(w, 400, () => {
    const hu = w.colony.hunt;
    if (!hu) return true;
    if (hu.phase === 'battle' && placedAtAttack < 0) placedAtAttack = hu.t;
    if (hu.result) { result = hu.result; return true; }
    return false;
  });
  assert.ok(placedAtAttack >= 0, 'attacked');
  assert.equal(result, 'won', 'took the camp');
});
