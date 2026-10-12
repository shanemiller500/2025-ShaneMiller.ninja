const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { addHuman, updateHuman, go } = require('./humans.ts');
const { addDino } = require('./dinos.ts');
const { stagesOf } = require('./build.ts');
const { MAP_W, TILE } = require('./types.ts');

function world() {
  const w = new World(9211, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  return w;
}

test('a distant raid leaves another settlement worker alone', () => {
  const w = world();
  const west = addHuman(w, w.camp.x, w.camp.y, false, { role: 'gatherer' });
  const east = addHuman(w, w.camp.x + 1100, w.camp.y, false, { role: 'builder' });
  go(east, 'walk', east.x + 100, east.y);
  const raider = addDino(w, 'raptor', west.x + 100, west.y, { raider: true });
  w.creatureHash.insert(raider);
  w.tribe.raid = { phase: 'attack', t: 0, ids: [raider.id], fromX: raider.x, fromY: raider.y, breached: false, label: 'Raid' };
  west.think = east.think = 0;
  updateHuman(w, west, 1 / 30);
  updateHuman(w, east, 1 / 30);
  assert.equal(west.state, 'flee');
  assert.equal(east.state, 'walk');
  assert.equal(east.dangerUntil, undefined);
});

test('a nearby house is selected and interrupted travel resumes', () => {
  const w = world();
  const h = addHuman(w, w.camp.x + 650, w.camp.y + 100, false, { role: 'builder' });
  const home = w.camp.addShelter(w, h.x + 60, h.y + 40);
  home.stage = stagesOf(home).length;
  home.hp = 1;
  const destination = { x: h.x + 150, y: h.y + 10 };
  go(h, 'walk', destination.x, destination.y);
  const raider = addDino(w, 'raptor', h.x - 100, h.y, { raider: true });
  w.creatureHash.insert(raider);
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'flee');
  assert.ok(Math.hypot(h.tx - home.x, h.ty - home.y) < 25);
  raider.x += 1300;
  w.creatureHash.clear();
  w.creatureHash.insert(raider);
  h.x = h.tx; h.y = h.ty; h.state = 'hide'; h.stateT = 4;
  w.elapsed = h.dangerUntil + 0.1;
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'walk');
  assert.ok(Math.hypot(h.tx - destination.x, h.ty - destination.y) < 1);
});

test('a local fire affects a child while a distant worker keeps moving', () => {
  const w = world();
  const child = addHuman(w, w.camp.x + 80, w.camp.y + 40, true);
  const worker = addHuman(w, w.camp.x + 1100, w.camp.y + 40, false, { role: 'farmer' });
  go(worker, 'walk', worker.x + 80, worker.y);
  w.fire.heat[Math.floor(child.y / TILE) * MAP_W + Math.floor((child.x + 64) / TILE)] = 0.8;
  child.think = worker.think = 0;
  updateHuman(w, child, 1 / 30);
  updateHuman(w, worker, 1 / 30);
  assert.equal(child.state, 'flee');
  assert.equal(worker.state, 'walk');
});
