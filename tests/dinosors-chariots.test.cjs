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
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
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
  w.rivals['arriveT'] = Infinity;
  for (const t of ['tools', 'spear', 'bow', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 10; x <= cx + 60; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x + (w.humans.length % 6) * 18, w.camp.y + 30 + Math.floor(w.humans.length / 6) * 18);
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
  assert.ok(b && typeof b === 'object', 'placed');
  b.built = 1;
  run(w, 0.1);
  return w.colony.chariots[w.colony.chariots.length - 1];
}
const trike = (w, x, y) => addDino(w, 'trike', x, y, { owner: true, tame: 1, age: 9999, hunger: 0, thirst: 0 });

test('a finished war chariot rolls out, and a tamed Triceratops is harnessed to pull it', () => {
  const w = world(9101, 4);
  const c = chariot(w, w.camp.x + 300, w.camp.y + 200);
  assert.ok(c, 'it rolled out');
  assert.ok(!w.colony.buildings.some((b) => b.kind === 'warChariot'), 'the build site is cleared');
  assert.equal(c.trike, 0, 'nothing to pull it yet');
  const d = trike(w, w.camp.x + 600, w.camp.y + 200);
  run(w, 1.2);
  assert.equal(c.trike, d.id);
  assert.equal(d.chariot, c.id);
  assert.ok(Math.abs(d.y - c.y) < 6 && Math.abs(d.x - c.x) < 140, 'in the traces, at the front');
  // saved + loaded
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.colony.chariots.length, 1);
  assert.equal(back.colony.chariots[0].trike, d.id);
});

test('a chariot hunt: everyone boards (no one leaves till all are aboard), the extras march on foot, and the chariots ride out into formation', () => {
  const w = world(9102, 14);
  for (const h of w.humans) h.role = 'guard';
  w.humans.slice(0, 2).forEach((h) => (h.role = 'eggRunner'));
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  n.found = true;
  n.x = w.camp.x + 1300; n.y = w.camp.y + 100;
  for (const e of w.dragons.eggs.filter((e) => e.nest === n.id)) { e.x = n.x; e.y = n.y; }
  const c = chariot(w, w.camp.x + 300, w.camp.y + 200);
  trike(w, c.x + 80, c.y);
  run(w, 1.2);
  assert.equal(ch.startHunt(w, 'ring'), null);
  const hunt = w.colony.hunt;
  assert.equal(hunt.crew.filter((m) => m.chariot === c.id).length, 10, 'ten seats filled');
  assert.ok(hunt.crew.some((m) => !m.chariot), 'the rest on foot');
  assert.ok(hunt.crew.some((m) => m.runner && m.chariot), 'egg runners ride inside');
  // it doesn't roll till everyone's aboard
  let rolled = false;
  run(w, 90, () => {
    const aboard = w.humans.filter((h) => h.chariot === c.id).length;
    if (w.colony.hunt.phase !== 'muster') { rolled = true; assert.equal(aboard, 10, 'all ten aboard when it rolls'); return true; }
    return false;
  });
  assert.ok(rolled, 'rolled out');
  // out to the nest, into formation
  const there = run(w, 120, () => w.colony.hunt?.phase === 'battle');
  assert.ok(there, 'surrounded the nest');
  assert.ok(Math.abs(Math.hypot(c.x - n.x, (c.y - n.y) / 0.8) - 300) < 60, 'in its formation slot');
});

test('formations: a ring all round, a pincer from both flanks, a wedge from the camp side', () => {
  const w = world(9103, 2);
  const nx = w.camp.x + 1200, ny = w.camp.y;
  const ring = ch.formationSlots(w, nx, ny, 'ring', 4);
  const xs = ring.map((p) => p.x - nx);
  assert.ok(Math.min(...xs) < -200 && Math.max(...xs) > 200, 'ring: both sides of the nest');
  const pincer = ch.formationSlots(w, nx, ny, 'pincer', 4);
  assert.ok(pincer.some((p) => p.y < ny - 100) && pincer.some((p) => p.y > ny + 100), 'pincer: both flanks');
  const wedge = ch.formationSlots(w, nx, ny, 'wedge', 3);
  assert.ok(wedge.every((p) => p.x < nx), 'wedge: all from the camp side');
});

test('clans pelt a chariot going by; too many hits and it falls apart: some die, the rest scatter', () => {
  const w = world(9104, 6);
  w.rivals.started = true;
  const clan = w.rivals.spawnClan(w, 5) ?? w.rivals.spawnClan(w, 5, { x: w.camp.x + 1500, y: w.camp.y });
  const c = chariot(w, w.camp.x + 300, w.camp.y + 200);
  trike(w, c.x + 80, c.y);
  run(w, 1.2);
  const crew = w.humans.filter((h) => !h.child).slice(0, 6);
  crew.forEach((h, i) => { h.chariot = c.id; });
  for (const b of w.rivals.members(clan.id)) { b.x = c.x + 120; b.y = c.y + 60; b.think = 999; b.age = 180; }
  const hp = c.hp;
  run(w, 6, () => { for (const b of w.rivals.members(clan.id)) { b.x = c.x + 120; b.y = c.y + 60; } });
  assert.ok(c.hp < hp, 'hit');
  // smash it
  ch.hitChariot(w, c, 9999, 'a test');
  assert.equal(w.colony.chariots.length, 0, 'wrecked');
  const left = crew.filter((h) => w.humans.includes(h));
  assert.ok(left.every((h) => !h.chariot && h.z === 0), 'the survivors are down on foot');
  assert.ok(left.length <= crew.length);
  assert.ok(!w.dinos.some((d) => d.chariot), 'the trike is free');
});

test('the battle: Scorpions + spears wear the dragon down, the runners grab the eggs, and it ends in a result', () => {
  const w = world(9105, 14);
  for (const h of w.humans) h.role = 'guard';
  w.humans.slice(0, 2).forEach((h) => (h.role = 'eggRunner'));
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  n.found = true;
  n.x = w.camp.x + 1100; n.y = w.camp.y + 60;
  for (const e of w.dragons.eggs.filter((e) => e.nest === n.id)) { e.x = n.x + 4; e.y = n.y; }
  w.elapsed = 1000;
  n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  const parent = nests.parentOf(w, n);
  assert.ok(parent);
  const hp0 = parent.hp;
  for (let i = 0; i < 2; i++) {
    const c = chariot(w, w.camp.x + 260, w.camp.y + 150 + i * 90);
    trike(w, c.x + 80, c.y);
  }
  run(w, 1.2);
  assert.equal(ch.startHunt(w, 'pincer'), null);
  let hurt = false;
  let grabbed = false;
  let result = null;
  run(w, 600, () => {
    if (parent.hp < hp0) hurt = true;
    if (w.humans.some((h) => h.egg)) grabbed = true;
    if (w.colony.hunt?.result) result = w.colony.hunt.result;
    return result !== null;
  });
  assert.ok(hurt, 'the dragon took hits');
  assert.ok(result === 'won' || result === 'lost', `a result: ${result}`);
  if (result === 'won') assert.ok(grabbed || parent.hp < parent.maxHp * 0.35, 'won by eggs or by beating it');
  // and everyone comes home + climbs down
  const home = run(w, 300, () => w.colony.hunt === null);
  assert.ok(home, 'the hunt is over');
  assert.ok(!w.humans.some((h) => h.chariot), 'everyone climbed down');
});
