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
const { TOWER_STAGES } = require(path.join(root, 'sim', 'build.ts'));
const { DEFAULT_TOOL, applyTool } = require(path.join(root, 'game', 'tools.ts'));
const { TILE } = require(path.join(root, 'sim', 'types.ts'));

const ERASE = { ...DEFAULT_TOOL, id: 'erase' };

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.dragons.timer = Infinity;
  for (const t of ['tools', 'fire', 'axe', 'spear', 'basket', 'shelter', 'palisade', 'tower', 'scorpion']) w.camp.learned.add(t);
  for (let i = 0; i < 6; i++) addHuman(w, w.camp.x + i * 12, w.camp.y + 40, false, {});
  return w;
}

/** run Auto's planners a few times (as if minutes had gone by) */
function plan(w, rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    w.tribe.planT = 0;
    w.tribe.improvedAt = -Infinity;
    w.day = Math.max(w.day, 3);
    w.tribe.update(w, 0.01);
  }
}

test('erasing a finished tower removes it cleanly and Auto does not put it back', () => {
  const w = world(7301);
  plan(w, 2);
  assert.ok(w.tribe.towers.length >= 1, 'Auto planned towers');
  const tower = w.tribe.towers[0];
  tower.stage = TOWER_STAGES.length;
  tower.hp = 400;
  // someone up top + a Scorpion on it
  const guard = w.humans[0];
  guard.x = tower.x;
  guard.y = tower.y;
  guard.level = 1;
  const sc = w.colony.addScorpion(w, tower.x, tower.y - 10);
  const hadScorpion = typeof sc !== 'string';
  assert.ok(applyTool(w, ERASE, tower.x, tower.y - 30, false), 'erased');
  assert.ok(!w.tribe.towers.includes(tower), 'tower gone');
  assert.equal(guard.level, 0, 'the guard is back on the ground');
  if (hadScorpion) assert.ok(!w.colony.scorpions.includes(sc), 'its Scorpion went with it');
  w.nav.sync(w);
  assert.ok(w.nav.passable('human', tower.x, tower.y - 8), 'plain walkable land again');
  const before = w.tribe.towers.length;
  plan(w, 8);
  assert.equal(w.tribe.towers.length, before, 'Auto did not rebuild a tower');
  // the player can still build one by hand
  assert.ok(w.tribe.addTower(w, tower.x, tower.y), 'hand-built is fine');
});

test('erased buildings, walls and homes stay erased (and the memory is saved)', () => {
  const w = world(7302);
  plan(w, 4);
  // a store Auto wants
  w.camp.learned.add('basket');
  plan(w, 4);
  const store = w.colony.buildings.find((b) => b.kind === 'foodStore');
  assert.ok(store, 'Auto planned a food store');
  assert.ok(applyTool(w, ERASE, store.x, store.y - 4, false));
  plan(w, 8);
  assert.ok(!w.colony.buildings.some((b) => b.kind === 'foodStore'), 'no food store came back');
  // a wall piece
  const wl = w.tribe.walls[0];
  if (wl) {
    const { tx, ty } = wl;
    assert.ok(applyTool(w, ERASE, tx * TILE + TILE / 2, ty * TILE + TILE / 2, false));
    w.flags.delete('planRing');
    plan(w, 4);
    assert.equal(w.tribe.wallAt(tx, ty), undefined, 'that wall piece stayed gone');
  }
  // a home
  const home = w.shelters[0];
  if (home) {
    const hx = home.x, hy = home.y;
    assert.ok(applyTool(w, ERASE, hx, hy - 16, false));
    plan(w, 6);
    assert.ok(!w.shelters.some((s) => Math.hypot(s.x - hx, s.y - hy) < 60), 'no home rebuilt on that spot');
  }
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.tribe.erased.length, w.tribe.erased.length);
  assert.ok(back.tribe.erased.some((e) => e.kind === 'foodStore'));
});
