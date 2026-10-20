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
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.tribe.danger = 'normal';
  return w;
}

/** a nest with its parent at home */
function homeNest(w) {
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  w.elapsed = 1000;
  n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  return { n, parent: nests.parentOf(w, n) };
}

test('every nest has a clutch of three; older saves are topped up once (and only once)', () => {
  const w = world(9601);
  nests.seedNests(w);
  for (const n of w.dragons.nests) assert.equal(nests.nestEggs(w, n).length, 3);
  // an old save: one egg, never topped up
  const n = w.dragons.nests[0];
  w.dragons.eggs = w.dragons.eggs.filter((e) => e.nest !== n.id).concat([w.dragons.eggs.find((e) => e.nest === n.id) ?? { id: w.dragons.nextId(), breed: 'fire', x: n.x, y: n.y, at: 'nest', nest: n.id, carrier: 0, heat: 1, progress: 0, health: 1, rare: false, hatchT: 0 }]);
  w.dragons.topped = false;
  nests.nestsUpdate(w, 0.1);
  assert.equal(nests.nestEggs(w, n).length, 3);
  // take them all: a reload doesn't refill the nest
  for (const e of nests.nestEggs(w, n)) e.at = 'camp';
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  nests.nestsUpdate(back, 0.1);
  assert.equal(nests.nestEggs(back, back.dragons.nests.find((x) => x.id === n.id)).length, 0);
});

test('an expecting parent fetches branches and builds the nest up, then lays three; past three a second nest joins on', () => {
  const w = world(9602);
  const { n, parent } = homeNest(w);
  for (const e of nests.nestEggs(w, n)) e.at = 'camp';
  n.layT = 0;
  nests.nestsUpdate(w, 0.1);
  assert.ok(n.gravid > 0, 'expecting');
  assert.ok(parent.gravid);
  const grow0 = n.grow;
  let fetched = false;
  for (let i = 0; i < 30 * 60; i++) { w.update(1 / 30); if (parent.state === 'fetch') fetched = true; }
  assert.ok(fetched, 'it flew off for branches');
  assert.ok(n.grow > grow0, 'the nest is growing');
  n.gravid = 0.01;
  nests.nestsUpdate(w, 0.1);
  assert.equal(nests.nestEggs(w, n).length, 3, 'a clutch of three');
  // the Eggs tool: one more by the nest = a second nest joined on
  assert.equal(nests.placeDragonEgg(w, 'swift', n.x + 10, n.y), null);
  assert.equal(nests.nestEggs(w, n).length, 4);
  assert.equal(n.size, 2);
  // and away from any nest it just sits there to be kept warm
  assert.equal(nests.placeDragonEgg(w, 'heavy', w.camp.x, w.camp.y + 100), null);
  assert.ok(w.dragons.eggs.some((e) => e.breed === 'heavy' && e.at === 'camp'));
});

test('stolen eggs: the parent hunts people, snatches a hunter and drops them in the volcano', () => {
  const w = world(9603);
  const { n, parent } = homeNest(w);
  for (const e of nests.nestEggs(w, n)) e.at = 'camp';
  const hunter = addHuman(w, n.x - 500, n.y + 300, false, { role: 'hunter' });
  hunter.think = 999;
  parent.t = 100;
  let grabbed = false;
  for (let i = 0; i < 30 * 120 && w.humans.includes(hunter); i++) {
    w.update(1 / 30);
    hunter.x = n.x - 500; // stands still out in the open
    if (hunter.snatched) grabbed = true;
  }
  assert.ok(grabbed, 'it snatched the hunter');
  assert.equal(w.humans.includes(hunter), false, 'and they never came back');
});

test('a stolen egg hatches while the parent lives: fury — bigger, 50x tougher, melts stone, attacks the town in time', () => {
  const w = world(9604);
  const { n, parent } = homeNest(w);
  const egg = nests.nestEggs(w, n)[0];
  egg.at = 'camp';
  egg.progress = 1;
  const before = keep.dragonStats(parent).scale;
  nests.hatch(w, egg);
  assert.ok(parent.fury, 'furious');
  assert.ok(keep.dragonStats(parent).scale > before * 1.4, 'it grew');
  const hp = parent.hp;
  w.dragons.hit(w, parent, 500);
  assert.ok(hp - parent.hp <= 10 + 1e-6, `arrows + bolts barely scratch it (${(hp - parent.hp).toFixed(1)})`);
  // it doesn't come at once…
  assert.ok(parent.furyT > 60);
  w.update(1 / 30);
  assert.notEqual(parent.state, 'arrive');
  // …but when its time comes, it does
  parent.furyT = 0;
  parent.state = 'perch';
  w.update(1 / 30);
  assert.equal(parent.state, 'arrive');
  assert.ok(parent.waveOn);
  // its fire melts stone
  const wl = w.tribe.addWall(w, Math.floor(w.camp.x / 32) + 4, Math.floor(w.camp.y / 32) + 4, 'stone');
  wl.built = 1;
  wl.hp = 1000;
  parent.x = wl.tx * 32 + 16; parent.y = wl.ty * 32 + 16; parent.vx = parent.vy = 0; parent.z = 60;
  w.dragons['breathT'] = 0;
  w.dragons['breathe'](w, parent, 0.1);
  assert.ok(wl.hp <= 1000 - 40, `stone melts (${wl.hp})`);
});
