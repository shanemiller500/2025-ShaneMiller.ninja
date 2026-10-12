const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('../app/dinosors/sim/world.ts');
const { addHuman, updateHuman } = require('../app/dinosors/sim/humans.ts');
const settlement = () => {
  const w = new World(7331, false);
  Object.assign(w.camp.stock, { cooked: 50, berries: 50 });
  for (let i = 0; i < 8; i++) addHuman(w, w.camp.x + i * 12, w.camp.y + 30, false, { role: i < 2 ? 'guard' : i < 4 ? 'miner' : 'builder' });
  return w;
};

test('All Day default and manual assignments persist through Auto Balance', () => {
  const w = settlement();
  assert.equal(w.shifts.mode, 'all');
  assert.ok(w.humans.every((h) => w.shifts.active(w, h)));
  w.shifts.setMode(w, 'split');
  assert.ok(w.humans.some((h) => h.shift === 'day'));
  assert.ok(w.humans.some((h) => h.shift === 'night'));
  for (const hour of [5.5, 6, 6.5, 17.5, 18, 18.5]) {
    w.time = hour;
    assert.ok(w.humans.filter((h) => h.role === 'guard').some((h) => w.shifts.active(w, h)), 'a guard covers handoff');
  }
  const manual = w.humans[7];
  w.shifts.assign(w, manual, 'night');
  w.shifts.balance(w);
  assert.equal(manual.shift, 'night');
  w.time = 2;
  assert.ok(w.humans.some((h) => w.shifts.active(w, h)));
  assert.ok(w.humans.some((h) => !w.shifts.active(w, h)));
  w.shifts.setMode(w, 'all');
  assert.ok(w.humans.every((h) => !h.shift && w.shifts.active(w, h)));
});

test('pyramid power lights suits and shuts off with empty storage or a broken pyramid', () => {
  const w = settlement();
  w.shifts.setMode(w, 'split');
  const h = w.humans.find((p) => p.shift === 'night');
  h.gear.outfit = 'nightLit';
  w.civ.done.add('energyLitClothing');
  w.civ.path = 'resonance';
  w.civ.gen = 4;
  w.civ.use = 0;
  w.civ.energy = 30;
  w.time = 22;
  const pyramid = { kind: 'pyramid', stage: 6, built: 1, hp: 1000 };
  w.colony.buildings.push(pyramid);
  w.shifts.update(w, 1);
  assert.ok(w.shifts.poweredOutfit(w, h));
  assert.ok(w.shifts.draw > 0);
  w.civ.energy = 0;
  w.shifts.update(w, 1);
  assert.equal(w.shifts.poweredOutfit(w, h), false);
  w.civ.energy = 30;
  pyramid.hp = 0;
  w.shifts.update(w, 1);
  assert.equal(w.shifts.poweredOutfit(w, h), false);
});

test('save restores mode, Auto Balance, worker assignments and outfit', () => {
  const w = settlement();
  w.shifts.setMode(w, 'split');
  w.shifts.auto = false;
  w.shifts.assign(w, w.humans[0], 'night');
  w.humans[0].gear.outfit = 'nightHide';
  w.humans[0].gear.weapon = 'nightSidearm';
  w.civ.done.add('nightDefenseGear');
  const restored = World.deserialize(w.serialize());
  assert.equal(restored.shifts.mode, 'split');
  assert.equal(restored.shifts.auto, false);
  assert.equal(restored.humans[0].shift, 'night');
  assert.equal(restored.humans[0].shiftManual, true);
  assert.equal(restored.humans[0].gear.outfit, 'nightHide');
  assert.equal(restored.humans[0].gear.weapon, 'nightSidearm');
  assert.ok(restored.civ.done.has('nightDefenseGear'));
});

test('day and night crews hand work over while jobs stay assigned', () => {
  const w = settlement();
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.shifts.setMode(w, 'split');
  w.time = 23;
  for (let i = 0; i < 12 * 30; i++) { w.update(1 / 30); w.events.length = 0; }
  const day = w.humans.filter((h) => h.shift === 'day');
  const night = w.humans.filter((h) => h.shift === 'night');
  assert.ok(day.some((h) => h.state === 'sleep' || h.state === 'walk'), 'day crew heads to rest');
  assert.ok(night.some((h) => h.state !== 'sleep'), 'night crew remains active');
});

test('outgoing worker releases an open build order for the next crew', () => {
  const w = settlement();
  w.shifts.setMode(w, 'split');
  w.time = 23;
  const h = w.humans.find((p) => p.shift === 'day');
  const task = w.tasks.add(w, { kind: 'build', icon: '🔨', label: 'Build', x: h.x, y: h.y, target: 0 }, [h]);
  h.taskId = task.id;
  h.state = 'idle';
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  assert.equal(h.taskId, 0);
  assert.equal(task.people.length, 0);
  assert.ok(w.tasks.get(task.id), 'unfinished open work stays on the board');
});
