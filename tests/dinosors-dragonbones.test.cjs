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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const moving = require(path.join(root, 'sim', 'moving.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'axe', 'basket', 'shelter', 'taming']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 4; y <= cy + 20; y++) for (let x = cx + 2; x <= cx + 40; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  for (let i = 0; i < 6; i++) addHuman(w, w.camp.x + 40 + i * 12, w.camp.y + 60);
  return w;
}
function ourDragon(w, rider) {
  const egg = { id: w.dragons.nextId(), breed: 'swift', x: w.camp.x + 400, y: w.camp.y + 200, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, skills: { trust: 1, follow: 1, flight: 1, rider: 1 }, auto: false });
  keep.newDragonStats(dr);
  if (rider) keep.bondDragon(w, dr, rider);
  return dr;
}
const bones = (w) => w.colony.buildings.filter((b) => b.kind === 'dragonBones');

test('one of our dragons dies: its bones are laid out as a monument with its name, where it fell', () => {
  const w = world(9961);
  const rider = w.humans[0];
  const dr = ourDragon(w, rider);
  const at = { x: dr.x, y: dr.y };
  dr.hp = 0;
  w.update(1 / 30);
  assert.ok(!w.dragons.owned.includes(dr), 'gone from our dragons');
  const [b] = bones(w);
  assert.ok(b, 'a monument');
  assert.equal(b.label, dr.name);
  assert.equal(b.ours, true);
  assert.equal(b.built, 1, 'standing, no building needed');
  assert.ok(Math.hypot(b.x - at.x, b.y - at.y) < TILE * 8, 'where it fell');
  assert.equal(rider.dragon, undefined, 'its rider is free');
  // saved + loaded
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const b2 = w2.colony.buildings.find((x) => x.kind === 'dragonBones');
  assert.equal(b2.label, dr.name);
  assert.equal(b2.ours, true);
});

test('a wild dragon brought down leaves only a scatter of bones (no shrine: that is for our own dragons)', () => {
  const w = world(9962);
  nests.seedNests(w);
  w.elapsed = 1000;
  for (const n of w.dragons.nests) n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  const p = nests.parentOf(w, w.dragons.nests[0]);
  p.x = w.camp.x + 600;
  p.y = w.camp.y + 200;
  const before = w.items.filter((i) => i.kind === 'bones').length;
  w.dragons.hit(w, p, p.maxHp * 10);
  assert.ok(!w.dragons.list.includes(p), 'it fell');
  assert.equal(bones(w).length, 0, 'no shrine for a wild one');
  const piles = w.items.filter((i) => i.kind === 'bones' && Math.hypot(i.x - p.x, i.y - p.y) < 80);
  assert.ok(w.items.filter((i) => i.kind === 'bones').length > before && piles.length >= 3, 'its bones lie where it fell');
});

test('the bones are a statue the tribe can pick up and move', () => {
  const w = world(9963);
  const dr = ourDragon(w, null);
  dr.hp = 0;
  w.update(1 / 30);
  const [b] = bones(w);
  const ref = { kind: 'building', id: b.id };
  assert.equal(moving.canMove(w, ref), null, 'movable');
  assert.equal(moving.startMove(w, ref, b.x + 200, b.y + 60), null, 'a crew sets off to carry it');
  assert.ok(w.humans.some((h) => w.tasks.get(h.taskId)?.kind === 'moveBuilding'), 'on it');
});
