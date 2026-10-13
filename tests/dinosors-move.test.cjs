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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { stagesOf } = require(path.join(root, 'sim', 'build.ts'));
const moving = require(path.join(root, 'sim', 'moving.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  for (const t of ['tools', 'axe', 'basket', 'shelter']) w.camp.learned.add(t);
  const tx = Math.floor(w.camp.x / TILE), ty = Math.floor(w.camp.y / TILE);
  for (let y = ty - 2; y <= ty + 14; y++) for (let x = tx + 2; x <= tx + 30; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  for (let i = 0; i < 6; i++) addHuman(w, w.camp.x + 40 + i * 10, w.camp.y + 60, false, {});
  return w;
}

test('a crew picks a finished building up, carries it over their heads and sets it down', () => {
  const w = world(9401);
  const b = w.colony.addBuilding(w, 'storage', w.camp.x + 180, w.camp.y + 120);
  assert.ok(b);
  b.built = 1;
  const to = { x: w.camp.x + 560, y: w.camp.y + 260 };
  const ref = { kind: 'building', id: b.id };
  assert.equal(moving.startMove(w, ref, to.x, to.y), null);
  const crew = w.humans.filter((h) => w.tasks.get(h.taskId)?.kind === 'moveBuilding');
  assert.equal(crew.length, moving.crewSize(w, ref));
  let lifted = false;
  let liftedHigh = false;
  let done = -1;
  for (let i = 0; i < 30 * 120; i++) {
    w.update(1 / 30);
    if (b.lift) {
      lifted = true;
      if (b.lift.z > 20) liftedHigh = true;
      // while it's up, it doesn't block the ground it stood on
      assert.equal(w.colony.occupied(w).has(b.ty * 160 + b.tx), false);
    }
    if (!b.lift && lifted) { done = i / 30; break; }
  }
  assert.ok(liftedHigh, 'they heaved it up over their heads');
  assert.ok(done > 0, 'and set it down');
  assert.ok(Math.hypot(b.x - to.x, b.y - to.y) < 48, `it stands at the new spot (${Math.round(b.x)},${Math.round(b.y)})`);
  assert.equal(b.built, 1, 'still finished');
  assert.ok(w.colony.occupied(w).has(b.ty * 160 + b.tx), 'and blocks its new ground');
  for (let i = 0; i < 30; i++) w.update(1 / 30);
  assert.ok(crew.every((h) => w.tasks.get(h.taskId)?.kind !== 'moveBuilding'), 'the crew goes back to work');
});

test('homes can be carried too (residents keep it); blueprints just slide; some things stay put', () => {
  const w = world(9402);
  const home = w.camp.addShelter(w, w.camp.x + 200, w.camp.y + 200);
  home.stage = stagesOf(home).length;
  home.hp = 1;
  const resident = w.humans[0];
  resident.home = home.id;
  const to = { x: w.camp.x + 480, y: w.camp.y + 200 };
  assert.equal(moving.startMove(w, { kind: 'shelter', id: home.id }, to.x, to.y), null);
  for (let i = 0; i < 30 * 120 && Math.hypot(home.x - to.x, home.y - to.y) > 2; i++) w.update(1 / 30);
  assert.ok(Math.hypot(home.x - to.x, home.y - to.y) < 40, 'the home moved');
  assert.equal(resident.home, home.id, 'still their home');
  // a blueprint just slides over
  const plan = w.colony.addBuilding(w, 'foodStore', w.camp.x + 300, w.camp.y + 380);
  assert.ok(plan && plan.built === 0);
  assert.equal(moving.startMove(w, { kind: 'building', id: plan.id }, w.camp.x + 700, w.camp.y + 380), null);
  assert.ok(Math.abs(plan.x - (w.camp.x + 700)) < 48, 'moved at once');
  // a bad spot is refused
  const b = w.colony.addBuilding(w, 'storage', w.camp.x + 180, w.camp.y + 120);
  b.built = 1;
  assert.ok(moving.startMove(w, { kind: 'building', id: b.id }, plan.x, plan.y), 'can\'t drop it on another building');
});
