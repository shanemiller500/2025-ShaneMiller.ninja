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
const { addHuman, updateHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { inferCommand, issue, rallyBattlePets } = require(path.join(root, 'sim', 'tasks.ts'));
const { thinkDino, actDino } = require(path.join(root, 'sim', 'behavior.ts'));

test('a person trains a befriended dinosaur, grows armor, and saves both', () => {
  const w = new World(9812, false);
  w.camp.learned.add('taming');
  w.daylight = 1;
  const x = w.camp.x + 110, y = w.camp.y + 110;
  const h = addHuman(w, x, y, false, { role: 'hunter' });
  const d = addDino(w, 'trike', x + 25, y, { owner: true, tame: 1, homeX: x, homeY: y });
  w.nav.sync(w);
  w.byId.set(d.id, d);
  assert.equal(inferCommand(w, [h], d.x, d.y, { dino: d, human: null, dragon: null }).kind, 'train');
  assert.ok(issue(w, [h], { kind: 'train', icon: '??', label: 'Train', x: d.x, y: d.y, target: d.id }));
  for (let i = 0; i < 1500 && (d.warTraining ?? 0) < 1; i++) updateHuman(w, h, 1 / 30);
  assert.equal(d.warTraining, 1, `state ${h.state} task ${h.taskId} target ${h.targetId} think ${h.think} at ${h.x},${h.y}`);
  assert.equal(d.warArmor, 2);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const friend = loaded.dinos.find((other) => other.id === d.id);
  assert.equal(friend.owner, true);
  assert.equal(friend.warTraining, 1);
  assert.equal(friend.warArmor, 2);
});

test('trained friends hurt raiding dinosaurs and brutes and armor reduces return damage', () => {
  const w = new World(9813, false);
  const x = w.camp.x + 100, y = w.camp.y + 100;
  const friend = addDino(w, 'trike', x, y, { owner: true, tame: 1, warTraining: 1, warArmor: 2 });
  const raider = addDino(w, 'raptor', x + 24, y, { raider: true, health: 1 });
  thinkDino(w, friend);
  assert.equal(friend.state, 'war');
  actDino(w, friend, 1 / 30);
  assert.ok(raider.health < 1, 'trained pet attacks a raiding dinosaur');
  assert.ok(friend.health > 0.95, 'grown armor softens retaliation');
  raider.x += 500;
  friend.warCd = 0;
  const brute = w.rivals.addBrute(w, { id: 77 }, x + 20, y, { raid: true });
  const before = brute.hp;
  actDino(w, friend, 1 / 30);
  assert.ok(brute.hp < before, 'trained pet attacks a raiding clan member');
  friend.rider = 999;
  friend.state = 'ridden';
  friend.warCd = 0;
  const mountedBefore = brute.hp;
  actDino(w, friend, 1 / 30);
  assert.ok(brute.hp < mountedBefore, 'mounted battle dino still fights');
});

test('battle-ready pets return to a finished pen, sleep on its hay, and still answer threats', () => {
  const w = new World(9814, false);
  const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
  const tx = 62, ty = 46;
  for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 5; x++) w.terrain.setTile(x, y, T.Grass);
  const pen = w.colony.addBuilding(w, 'pen', (tx + 0.5) * TILE, (ty + 0.5) * TILE);
  assert.ok(pen);
  pen.built = 1;
  w.nav.sync(w);
  const d = addDino(w, 'trike', pen.x + 135, pen.y + 20, { owner: true, tame: 1, warTraining: 1, hunger: 0, thirst: 0, energy: 0.6 });
  w.daylight = 1;
  thinkDino(w, d);
  assert.equal(d.state, 'wander');
  assert.ok(Math.abs(d.tx - pen.x) < 50 && d.ty < pen.y, 'pet heads back inside the pen');
  d.x = d.tx; d.y = d.ty;
  d.energy = 0.5;
  w.daylight = 0;
  thinkDino(w, d);
  assert.equal(d.state, 'sleep');
  assert.ok(d.x > pen.x - 48 && d.x < pen.x + 48 && d.y < pen.y, 'sleeping position is inside pen');
  d.energy = 1; d.stateT = 15;
  actDino(w, d, 0.1);
  assert.equal(d.state, 'sleep', 'a rested pet stays in its pen overnight');
  const raider = addDino(w, 'raptor', d.x + 25, d.y, { raider: true });
  thinkDino(w, d);
  assert.equal(d.state, 'war', 'a sleeping pet wakes to defend the camp');
  raider.x += 500;
  d.rider = 123;
  d.state = 'ridden';
  thinkDino(w, d);
  assert.equal(d.state, 'ridden', 'riding takes precedence over returning to pen');
});


test('rally mounts trained pets and fires while moving', () => {
  const w = new World(9815, false);
  w.camp.learned.add('bow');
  w.daylight = 1;
  const x = w.camp.x + 100, y = w.camp.y + 80;
  const h = addHuman(w, x, y, false, { role: 'guard' });
  const pet = addDino(w, 'trike', x + 12, y, { owner: true, tame: 1, warTraining: 1, warArmor: 2 });
  const untrained = addDino(w, 'para', x + 20, y, { owner: true, tame: 1, warTraining: 0.5 });
  w.nav.sync(w);
  w.byId.set(pet.id, pet);
  const assigned = rallyBattlePets(w);
  assert.deepEqual(assigned, [h.id]);
  assert.equal(w.tasks.get(h.taskId).target, pet.id);
  assert.notEqual(w.tasks.get(h.taskId).target, untrained.id);
  w.flags.add('rallyDinos');
  for (let i = 0; i < 70 && !h.riding; i++) updateHuman(w, h, 1 / 30);
  assert.equal(h.riding, pet.id, 'person mounts trained pet');
  const foe = addDino(w, 'raptor', h.x + 85, h.y, { raider: true });
  w.byId.set(foe.id, foe);
  h.state = 'walk'; h.tx = foe.x; h.ty = foe.y;
  h.targetId = foe.id; h.cd = 0;
  updateHuman(w, h, 1 / 30);
  assert.ok(w.tribe.projectiles.length > 0, 'rider fires while moving');
  assert.equal(h.state, 'walk');
});

test('charging bone tusks strike raiders on contact with a cooldown', () => {
  const w = new World(9816, false);
  const x = w.camp.x + 100, y = w.camp.y + 80;
  const pet = addDino(w, 'trike', x, y, { owner: true, tame: 1, warTraining: 1, warArmor: 2 });
  pet.rider = 999; pet.state = 'ridden'; pet.vx = 100;
  const foe = addDino(w, 'raptor', x + 25, y, { raider: true });
  actDino(w, pet, 1 / 30);
  assert.ok(foe.health <= 0, 'bone tusks defeat a small raider');
  assert.ok(pet.spikeCd > 0, 'spike damage has a short cooldown');
});
