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
const root = path.join(__dirname, '..', 'app', 'dinosors', 'sim');
const { World } = require(path.join(root, 'world.ts'));
const { T, TILE, MAP_W } = require(path.join(root, 'types.ts'));
const { addHuman, updateHuman, shelterSpot } = require(path.join(root, 'humans.ts'));
const { addDino } = require(path.join(root, 'dinos.ts'));

test('an armed tower covers a bridge during raids, and cover loss sends people to shelter', () => {
  const w = new World(7802);
  w.weather.auto = false; w.timePaused = true; w.dinos.length = 0; w.camp.learned.add('spear');
  const tx = Math.floor(w.camp.x / TILE) + 6, ty = Math.floor(w.camp.y / TILE) + 5;
  const bridge = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  w.terrain.tiles[ty * MAP_W + tx] = T.Shallow; w.terrain.version++;
  w.colony.buildings.push({ id: w.nextId(), kind: 'bridge', tx, ty, ...bridge, built: 1, have: {}, hp: 200 });
  w.colony.version++;
  const tower = { id: w.nextId(), tx, ty, x: (tx + 1) * TILE, y: (ty + 2) * TILE - 4, stage: 3, have: 0, hp: 400 };
  w.tribe.towers.push(tower); w.tribe.version++;
  const scorpion = w.colony.addScorpion(w, tower.x, tower.y - 10);
  assert.equal(typeof scorpion, 'object'); scorpion.built = 1;
  const crew = addHuman(w, tower.x, tower.y - 18, false, { role: 'guard', state: 'operate', level: 1 });
  const seat = w.colony.crewSpot(scorpion); crew.x = seat.x; crew.y = seat.y; scorpion.crew = crew.id;
  const person = addHuman(w, bridge.x - 25, bridge.y, false, { role: 'gatherer' });
  w.tribe.raid = { phase: 'warn', t: 0, ids: [], fromX: bridge.x + 600, fromY: bridge.y, breached: false, label: 'Raid' };
  w.nav.sync(w);
  assert.deepEqual(w.tribe.coveredBridge(w, person), bridge);
  person.think = 0; updateHuman(w, person, 1 / 30);
  assert.equal(person.state, 'flee');
  assert.deepEqual({ x: person.tx, y: person.ty }, bridge);
  person.x = bridge.x; person.y = bridge.y; person.think = 0;
  const raider = addDino(w, 'raptor', bridge.x + 110, bridge.y, { raider: true });
  w.byId.set(raider.id, raider);
  updateHuman(w, person, 1 / 30);
  assert.equal(person.state, 'aim'); assert.equal(person.targetId, raider.id);
  scorpion.crew = 0; crew.level = 0;
  assert.equal(w.tribe.coveredBridge(w, person), null);
  person.state = 'hide'; person.think = 0; updateHuman(w, person, 1 / 30);
  assert.deepEqual({ x: person.tx, y: person.ty }, shelterSpot(w, person));
});


