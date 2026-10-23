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
const { makePlant } = require(path.join(root, 'sim', 'plants.ts'));
const { MAP_W, T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const clear = require(path.join(root, 'sim', 'clearArea.ts'));

const DT = 1 / 30;
function world(seed, people = 4) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.daylight = 1;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'axe', 'taming']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 6; y <= cy + 24; y++) for (let x = cx - 6; x <= cx + 40; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  for (let i = 0; i < people; i++) addHuman(w, w.camp.x + i * 20, w.camp.y + 40);
  for (const h of w.humans) h.role = 'gatherer';
  return w;
}
function run(w, s, each) {
  for (let i = 0; i < Math.round(s / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
/** a patch of wild growth: jungle floor, trees, berry bushes, ferns */
function overgrown(w, x0, y0) {
  const box = { x0, y0, x1: x0 + 6 * TILE, y1: y0 + 4 * TILE };
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(box.y1 / TILE); ty++) for (let tx = Math.floor(x0 / TILE); tx <= Math.floor(box.x1 / TILE); tx++) w.terrain.setTile(tx, ty, T.Jungle);
  const plants = [];
  const kinds = ['bush', 'fern', 'broadleaf', 'bush', 'fruit', 'fern', 'bush', 'cycad'];
  kinds.forEach((k, i) => {
    const p = makePlant(w, k, x0 + 16 + (i % 4) * 44, y0 + 20 + Math.floor(i / 4) * 60, k === 'broadleaf' || k === 'fruit' ? 0.8 : 1);
    if (k === 'bush' || k === 'fruit') p.fruit = 2;
    w.plants.push(p);
    plants.push(p);
  });
  w.plantsDirty = true;
  w.nav.sync(w);
  return { box, plants };
}

test('picked people clear a box of wild growth down to grass: timber + berries to the stores, then it is kept clear', () => {
  const w = world(9991);
  const { box, plants } = overgrown(w, w.camp.x + 220, w.camp.y + 120);
  const stock = { ...w.camp.stock };
  const crew = w.humans.slice(0, 3);
  const r = clear.startClearJob(w, box, crew, []);
  assert.ok(r.ok, r.msg);
  assert.ok(crew.every((h) => h.clearJob), 'on the job');
  const done = run(w, 300, () => !w.clearJobs.length);
  assert.ok(done, `cleared (${clear.plantsIn(w, box).length} left)`);
  assert.ok(plants.every((p) => !w.plants.includes(p)), 'every plant is gone');
  const tx = Math.floor((box.x0 + box.x1) / 2 / TILE), ty = Math.floor((box.y0 + box.y1) / 2 / TILE);
  assert.equal(w.terrain.tiles[ty * MAP_W + tx], T.Grass, 'down to grass');
  assert.ok(w.camp.stock.wood > stock.wood && w.camp.stock.berries > stock.berries, 'timber + berries to the stores');
  assert.ok(crew.every((h) => !h.clearJob), 'everyone released');
  assert.ok(clear.keptClear(w, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2), 'kept clear');
  // saved + loaded
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(clear.keptClear(w2, (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2));
});

test('nobody picked: free hands go, and a big tame dinosaur pushes the trees over (only inside the box)', () => {
  const w = world(9992);
  const { box } = overgrown(w, w.camp.x + 220, w.camp.y + 120);
  const outside = makePlant(w, 'broadleaf', box.x1 + 70, box.y0 + 40, 1);
  w.plants.push(outside);
  const d = addDino(w, 'trike', box.x0 - 80, box.y0 + 60, { owner: true, tame: 1, age: 9999, hunger: 0, thirst: 0 });
  workOf(d);
  const r = clear.startClearJob(w, box, [], []);
  assert.ok(r.ok, r.msg);
  assert.ok(w.humans.some((h) => h.clearJob), 'free hands took it on');
  let dinoWorked = false;
  const done = run(w, 300, () => { if (d.work?.job === 'clear') dinoWorked = true; return !w.clearJobs.length; });
  assert.ok(dinoWorked, 'the dino helped');
  assert.ok(done, 'cleared');
  assert.ok(w.plants.includes(outside), 'the tree outside the box is still standing');
});

test('nobody free at all: it says so', () => {
  const w = world(9993, 0);
  const { box } = overgrown(w, w.camp.x + 220, w.camp.y + 120);
  const r = clear.startClearJob(w, box, [], []);
  assert.equal(r.ok, false);
  assert.match(r.msg, /Nobody/);
});
