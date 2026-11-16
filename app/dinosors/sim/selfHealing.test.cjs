const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { addHuman, updateHuman } = require('./humans.ts');
const { addDino } = require('./dinos.ts');
const { hurtHuman } = require('./injury.ts');
const { canSend, sendDown, updateCrew } = require('./miners.ts');

function fixture(overrides = {}) {
  const w = new World(9211, false);
  w.dinos.length = 0;
  w.time = 12; w.weather.auto = false;
  const h = addHuman(w, w.camp.caveX, w.camp.caveY, false, { role: 'gatherer', hp: 0.49, think: 0, ...overrides });
  return { w, h };
}

test('below half health pauses assigned work and restores health and energy', () => {
  const { w, h } = fixture({ energy: 0.3 });
  const task = w.tasks.add(w, { kind: 'move', label: 'Go there', icon: '', target: 0, x: h.x + 300, y: h.y }, [h]);
  h.taskId = task.id; h.state = 'walk'; h.tx = task.x; h.ty = task.y;
  updateHuman(w, h, 0.1);
  assert.equal(h.selfHealing, true);
  assert.equal(h.state, 'rest');
  assert.equal(h.taskId, task.id, 'work assignment is preserved');
  const hp = h.hp, energy = h.energy;
  updateHuman(w, h, 1);
  assert.ok(h.hp > hp); assert.ok(h.energy > energy);
  h.hp = 0.65; h.think = 0;
  updateHuman(w, h, 0.1);
  assert.equal(h.state, 'rest', 'crossing 50% does not immediately restart work');
  h.hp = 0.91; h.think = 0;
  updateHuman(w, h, 0.1);
  assert.equal(h.selfHealing, false);
  assert.notEqual(h.state, 'rest');
});

test('injured children also rest at home', () => {
  const { w, h } = fixture({ child: true });
  updateHuman(w, h, 0.1);
  assert.equal(h.state, 'rest'); assert.equal(h.selfHealing, true);
});

test('a person seeks the completed healing hut instead of continuing their order', () => {
  const { w, h } = fixture();
  const hut = { id: w.nextId(), kind: 'healer', tx: Math.floor(h.x / 32) + 5, ty: Math.floor(h.y / 32), x: h.x + 160, y: h.y, built: 1, hp: 320, have: {} };
  w.colony.buildings.push(hut);
  const door = w.colony.door(hut);
  h.order = { kind: 'guard', x: h.x - 500, y: h.y };
  updateHuman(w, h, 0.1);
  assert.equal(h.state, 'walk');
  assert.equal(h.tx, door.x); assert.equal(h.ty, door.y);
  assert.equal(h.order.kind, 'guard');
});

test('a guard below half health escapes a Yeti instead of fighting', () => {
  const { w, h } = fixture({ hp: 0.49, role: 'guard' });
  const yeti = addDino(w, 'yeti', h.x + 90, h.y, { state: 'chase', targetId: h.id });
  w.creatureHash.insert(yeti);
  h.state = 'aim'; h.targetId = yeti.id;
  updateHuman(w, h, 0.1);
  assert.ok(['flee', 'hide'].includes(h.state), 'retreat or take shelter instead of fighting');
  assert.equal(h.targetId, 0); assert.equal(h.selfHealing, true);
});

test('injured Scorpion operators leave their weapon to heal', () => {
  const { w, h } = fixture({ state: 'operate', role: 'guard' });
  const scorpion = { id: w.nextId(), crew: h.id, x: h.x, y: h.y, built: 1, hp: 100 };
  w.colony.scorpions.push(scorpion);
  updateHuman(w, h, 0.1);
  assert.equal(scorpion.crew, 0); assert.equal(h.state, 'rest');
});

test('treatment keeps carried supplies and survives a save above half health', () => {
  const { w, h } = fixture({ carry: 'wood', carryN: 2 });
  updateHuman(w, h, 0.1);
  assert.equal(h.carry, 'wood'); assert.equal(h.carryN, 2);
  h.hp = 0.65;
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const patient = loaded.humans.find((o) => o.id === h.id);
  assert.equal(patient.selfHealing, true);
  patient.think = 0;
  updateHuman(loaded, patient, 0.1);
  assert.equal(patient.selfHealing, true);
  assert.ok(['walk', 'rest'].includes(patient.state));
});

test('passengers recover safely in their seat without being teleported off a chariot', () => {
  const { w, h } = fixture({ chariot: 123, energy: 0.3 });
  const x = h.x, y = h.y, hp = h.hp;
  updateHuman(w, h, 1);
  assert.ok(h.hp > hp); assert.ok(h.energy > 0.3);
  assert.equal(h.chariot, 123); assert.equal(h.x, x); assert.equal(h.y, y);
});

test('damage below half prompts an immediate decision; healthy people do not enter treatment', () => {
  const { w, h } = fixture({ hp: 0.6, think: 10 });
  hurtHuman(w, h, 0.2, h.x - 20, h.y, 'cold');
  assert.equal(h.selfHealing, true); assert.equal(h.think, 0);
  const other = addHuman(w, h.x, h.y, false, { hp: 0.5, think: 0 });
  updateHuman(w, other, 0.1);
  assert.ok(!other.selfHealing);
});

test('miners cannot be sent underground below half health or before treatment finishes', () => {
  const { h } = fixture();
  assert.equal(canSend(h), false);
  h.hp = 0.8; h.selfHealing = true;
  assert.equal(canSend(h), false);
});

test('a miner injured on the way to the lift stays above ground to heal', () => {
  const { w, h } = fixture({ hp: 1 });
  assert.equal(sendDown(w, h), true);
  h.hp = 0.49;
  updateCrew(w, 0.1);
  assert.equal(w.mine.pending.has(h.id), false);
  assert.ok(!h.under);
  assert.equal(w.mine.healing.has(h.id), true);
});

test('an off-shift miner below half health plans treatment instead of waiting underground', () => {
  const { w, h } = fixture({ hp: 1, shift: 'night' });
  w.shifts.mode = 'split';
  assert.equal(sendDown(w, h), true);
  updateCrew(w, 0.1);
  assert.equal(h.under, true);
  const miner = w.mine.crew.find((m) => m.id === h.id);
  h.hp = 0.49;
  updateCrew(w, 0.1);
  assert.ok(!h.under || ['exit', 'heal'].includes(miner.job?.kind));
});
