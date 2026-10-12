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
const { issue } = require(path.join(root, 'sim', 'tasks.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { TECH, TECH_ORDER } = require(path.join(root, 'data', 'facts.ts'));
const { BUILDINGS } = require(path.join(root, 'data', 'colony.ts'));
const sonic = require(path.join(root, 'sim', 'sonic.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.wind = 0;
  w.weather.windX = 0;
  w.weather.windY = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  for (const t of ['fire', 'firefighting', 'smelting', 'sonicFire']) w.camp.learned.add(t);
  return w;
}

function station(w, x, y) {
  const b = w.colony.addBuilding(w, 'fireStation', x, y);
  assert.ok(b, 'placed the fire station');
  b.built = 1;
  w.colony.version++;
  w.nav.sync(w);
  return b;
}

/** a burning patch of grass (tx, ty centre) */
function blaze(w, x, y, r = 2) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  for (let j = ty - r - 2; j <= ty + r + 2; j++) for (let i = tx - r - 2; i <= tx + r + 2; i++) w.terrain.setTile(i, j, T.Grass);
  w.fire.initFuel(w);
  for (let j = ty - r; j <= ty + r; j++) for (let i = tx - r; i <= tx + r; i++) w.fire.ignite(w, i, j, 1);
  return { tx, ty };
}

const step = (w, secs, fn) => {
  for (let i = 0; i < secs * 30; i++) {
    w.update(1 / 30);
    if (fn && fn()) return i / 30;
  }
  return -1;
};

test('sonic firefighting is a real invention after fire fighting + smelting, and unlocks the fire station', () => {
  assert.ok(TECH.sonicFire);
  assert.deepEqual(TECH.sonicFire.after, ['firefighting', 'smelting']);
  assert.ok(TECH_ORDER.includes('sonicFire'));
  assert.equal(BUILDINGS.fireStation.tech, 'sonicFire');
  const w = world(6201);
  w.camp.learned.delete('sonicFire');
  assert.equal(w.colony.canCraft(w, 'sonicEmitter'), false, 'not invented yet');
  w.camp.learned.add('sonicFire');
  assert.equal(w.colony.canCraft(w, 'sonicEmitter'), false, 'needs the station');
  station(w, w.camp.x + 200, w.camp.y + 120);
  assert.equal(w.colony.canCraft(w, 'sonicEmitter'), true);
  // a smith makes one at the station: it goes on the station's rack
  w.colony.queue.push('sonicEmitter');
  const st = w.colony.station(w);
  const b = w.colony.buildings.find((x) => x.kind === 'fireStation');
  assert.ok(Math.hypot(st.x - b.x, st.y - b.y) < 80, 'made at the fire station');
  Object.assign(w.camp.stock, { copper: 5, bone: 5, hide: 5 });
  const smith = addHuman(w, st.x, st.y, false, {});
  for (let i = 0; i < 300 && !(w.colony.armory.sonicEmitter > 0); i++) w.colony.forgeTick(w, smith, 1 / 30);
  assert.equal(w.colony.armory.sonicEmitter, 1);
  assert.equal(sonic.storedEmitters(w), 1);
});

test('the crew takes emitters from the station, shakes the fire out from a distance, then returns them', () => {
  const w = world(6202);
  const b = station(w, w.camp.x + 160, w.camp.y + 120);
  w.colony.armory.sonicEmitter = 2;
  const fire = { x: w.camp.x + 560, y: w.camp.y + 260 };
  blaze(w, fire.x, fire.y, 1);
  assert.ok(w.fire.active.size > 0);
  const a = addHuman(w, b.x - 30, b.y + 40, false, { role: 'builder' });
  const c = addHuman(w, b.x - 50, b.y + 50, false, { role: 'gatherer' });
  assert.ok(issue(w, [a, c], { kind: 'douse', icon: '🔊', label: 'Fire!', x: fire.x, y: fire.y, target: 0 }));
  const grabbed = step(w, 30, () => a.sonic && c.sonic);
  assert.ok(grabbed >= 0, 'both took an emitter');
  assert.equal(w.colony.armory.sonicEmitter, 0, 'the rack is empty');
  let closest = Infinity;
  const blasting = step(w, 40, () => {
    for (const h of [a, c]) if (h.state === 'sonic') closest = Math.min(closest, Math.hypot(h.x - fire.x, h.y - fire.y));
    return a.state === 'sonic' || c.state === 'sonic';
  });
  assert.ok(blasting >= 0, 'blasting');
  const out = step(w, 60, () => w.fire.active.size === 0);
  assert.ok(out >= 0, 'the fire is out');
  assert.ok(closest > 50, `they stayed back from the flames (${closest.toFixed(0)})`);
  assert.equal(a.carry, null, 'no water needed');
  const back = step(w, 60, () => !a.sonic && !c.sonic);
  assert.ok(back >= 0, 'emitters returned');
  assert.equal(w.colony.armory.sonicEmitter, 2, 'back on the rack');
});

test('the station sends a crew by itself to a fire near it; no emitters → the bucket brigade', () => {
  const w = world(6203);
  const b = station(w, w.camp.x + 160, w.camp.y + 120);
  w.colony.armory.sonicEmitter = 3;
  const people = [0, 1, 2, 3, 4].map((i) => addHuman(w, b.x - 40 + i * 12, b.y + 60, false, {}));
  const fire = { x: b.x + 700, y: b.y + 300 };
  blaze(w, fire.x, fire.y, 1);
  sonic.sonicDispatch(w);
  const crew = people.filter((h) => w.tasks.get(h.taskId)?.kind === 'douse');
  assert.equal(crew.length, 3, 'three emitters, three firefighters');
  const out = step(w, 120, () => w.fire.active.size === 0);
  assert.ok(out >= 0, 'they put it out');
  assert.ok(w.discoveries.has('sonicFire'));
  // without emitters the old way still works (sonicDouse hands over to the buckets)
  const w2 = world(6204);
  station(w2, w2.camp.x + 160, w2.camp.y + 120);
  const h = addHuman(w2, w2.camp.x, w2.camp.y, false, {});
  blaze(w2, w2.camp.x + 400, w2.camp.y + 200, 1);
  assert.equal(sonic.sonicDouse(w2, h, () => {}), false);
});

test('an emitter out with someone is saved', () => {
  const w = world(6205);
  const h = addHuman(w, w.camp.x, w.camp.y, false, {});
  h.sonic = true;
  w.colony.armory.sonicEmitter = 1;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.humans.find((x) => x.id === h.id).sonic, true);
  assert.equal(back.colony.armory.sonicEmitter, 1);
});
