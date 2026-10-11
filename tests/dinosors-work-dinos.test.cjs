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
const { addDino, moveDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { addHuman, updateHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { issue, mount, dismount } = require(path.join(root, 'sim', 'tasks.ts'));
const { thinkDino } = require(path.join(root, 'sim', 'behavior.ts'));
const { actWorkDino, capacity, commandCollect, commandDeliver, commandTravel, eligible, thinkWorkDino, workOf } = require(path.join(root, 'sim', 'workDinos.ts'));
const { sites, siteKey } = require(path.join(root, 'sim', 'build.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));

function unloadWithWorker(w, d, h, work) {
  d.x = work.targetX; d.y = work.targetY; d.state = 'work';
  w.byId.set(d.id, d);
  actWorkDino(w, d, 0.1);
  h.x = d.x + 12; h.y = d.y; h.think = 0;
  for (let i = 0; i < 4; i++) updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'loadDino');
  actWorkDino(w, d, 2.1);
}

test('herbivore size and gear determine work eligibility and capacity', () => {
  const w = new World(1911, false);
  const small = addDino(w, 'compy', w.camp.x, w.camp.y, { owner: true, tame: 1 });
  const trike = addDino(w, 'trike', w.camp.x + 80, w.camp.y, { owner: true, tame: 1 });
  const giant = addDino(w, 'apato', w.camp.x + 160, w.camp.y, { owner: true, tame: 1 });
  assert.equal(eligible(small, 'hauler'), false);
  assert.equal(eligible(trike, 'hauler'), true);
  assert.equal(eligible(giant, 'heavy'), true);
  const pack = workOf(giant);
  pack.skills.heavy = 1;
  assert.equal(capacity(giant), 0);
  pack.harness = 1;
  assert.ok(capacity(giant) >= 200);
});

test('a trainer feeds and practices with a dinosaur; work training is saved', () => {
  const w = new World(1912, false);
  w.camp.learned.add('taming');
  const x = w.camp.x + 110, y = w.camp.y + 110;
  const h = addHuman(w, x, y, false, { role: 'gatherer' });
  const d = addDino(w, 'trike', x + 22, y, { owner: true, tame: 0.8, homeX: x, homeY: y });
  w.byId.set(d.id, d);
  w.nav.sync(w);
  w.camp.stock.crop = 30;
  const work = workOf(d);
  work.focus = 'hauler'; work.trainer = h.id;
  assert.ok(issue(w, [h], { kind: 'trainWork', icon: 'dino', label: 'Train hauler', x: d.x, y: d.y, target: d.id }));
  for (let i = 0; i < 3200 && (work.skills.hauler ?? 0) < 0.36; i++) updateHuman(w, h, 1 / 30);
  assert.ok((work.skills.hauler ?? 0) >= 0.35, 'training progressed');
  assert.ok(w.camp.stock.crop < 30);
  work.harness = 1;
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const friend = loaded.dinos.find((other) => other.id === d.id);
  assert.ok(friend.work.skills.hauler >= 0.35);
  assert.equal(friend.work.harness, 1);
});

test('a trained dinosaur loads stock and unloads at a construction site', () => {
  const w = new World(1913, false);
  w.camp.learned.add('tools');
  const tx = 62, ty = 47;
  for (let y = ty - 5; y <= ty + 8; y++) for (let x = tx - 6; x <= tx + 8; x++) w.terrain.setTile(x, y, T.Grass);
  const building = w.colony.addBuilding(w, 'workshop', (tx + 0.5) * TILE, (ty + 0.5) * TILE);
  assert.ok(building);
  const site = sites(w).find((s) => s.kind === 'building' && s.id === building.id);
  assert.equal(site.need, 'wood');
  const d = addDino(w, 'trike', w.camp.pileX, w.camp.pileY, { owner: true, tame: 1 });
  const work = workOf(d);
  const h = addHuman(w, d.x + 12, d.y, false, { role: 'builder' });
  work.skills.hauler = 0.8; work.harness = 1; work.auto = false;
  w.camp.stock.wood = 90;
  w.nav.sync(w);
  assert.ok(commandCollect(w, d, 'stock', 'wood', w.camp.pileX, w.camp.pileY));
  unloadWithWorker(w, d, h, work);
  assert.ok(work.cargoN >= 50);
  assert.ok(w.camp.stock.wood < 90);
  assert.ok(commandDeliver(w, d, siteKey(site), site.sx, site.sy));
  unloadWithWorker(w, d, h, work);
  assert.equal(building.have.wood, 5);
  assert.ok(work.cargoN > 0);
});

test('mine loads wait at the cave until carried to town', () => {
  const w = new World(1914, false);
  const d = addDino(w, 'trike', w.camp.caveX, w.camp.caveY + 70, { owner: true, tame: 1 });
  const work = workOf(d);
  const h = addHuman(w, d.x + 12, d.y, false, { role: 'builder' });
  work.skills.runner = 0.8; work.harness = 1;
  w.mineLoads.gold = 12;
  w.nav.sync(w);
  assert.equal(thinkWorkDino(w, d), true);
  assert.equal(work.source, 'mine');
  unloadWithWorker(w, d, h, work);
  assert.equal(work.cargoN, 12);
  assert.equal(w.mineLoads.gold, 0);
  assert.equal(w.camp.stock.gold, 0);
  thinkWorkDino(w, d);
  assert.equal(work.job, 'deliver');
  const resumed = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const savedLoad = resumed.dinos.find((other) => other.id === d.id);
  assert.equal(savedLoad.work.cargoN, 12);
  assert.equal(savedLoad.work.job, 'deliver');
  assert.equal(resumed.mineLoads.gold, 0);
  unloadWithWorker(w, d, h, work);
  assert.equal(w.camp.stock.gold, 12);
});

test('a riding-trained dinosaur walks the route instead of teleporting', () => {
  const w = new World(1915, false);
  for (let y = 46; y <= 56; y++) for (let x = 56; x <= 76; x++) w.terrain.setTile(x, y, T.Grass);
  const d = addDino(w, 'trike', 60 * TILE + 16, 50 * TILE + 16, { owner: true, tame: 1, hunger: 0, thirst: 0, energy: 1 });
  workOf(d).skills.riding = 1;
  w.nav.sync(w);
  const targetX = 69 * TILE + 16, targetY = 50 * TILE + 16;
  assert.ok(commandTravel(w, d, targetX, targetY));
  thinkDino(w, d);
  assert.equal(d.state, 'work');
  const startX = d.x;
  moveDino(w, d, 1 / 30);
  assert.ok(d.x > startX && d.x < targetX - 100, 'first step is a short physical movement');
  for (let i = 0; i < 1400 && d.work.job; i++) { moveDino(w, d, 1 / 30); actWorkDino(w, d, 1 / 30); }
  assert.equal(d.work.job, null);
  assert.ok(Math.abs(d.x - targetX) < 30);
});

test('a trained sauropod carries multiple riders and dismounts them individually', () => {
  const w = new World(1916, false);
  const d = addDino(w, 'apato', w.camp.x + 180, w.camp.y + 130, { owner: true, tame: 1 });
  workOf(d).skills.riding = 1;
  w.byId.set(d.id, d);
  const a = addHuman(w, d.x, d.y, false, { role: 'gatherer' });
  const b = addHuman(w, d.x, d.y, false, { role: 'gatherer' });
  const c = addHuman(w, d.x, d.y, false, { role: 'gatherer' });
  mount(w, a, d); mount(w, b, d); mount(w, c, d);
  assert.equal(d.rider, a.id);
  assert.deepEqual(d.passengers, [b.id, c.id]);
  dismount(w, b);
  assert.equal(b.riding, 0);
  assert.equal(d.rider, a.id);
  assert.deepEqual(d.passengers, [c.id]);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const saved = loaded.dinos.find((other) => other.id === d.id);
  assert.equal(saved.rider, a.id);
  assert.deepEqual(saved.passengers, [c.id]);
});