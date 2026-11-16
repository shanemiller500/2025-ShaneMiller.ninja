const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { addHuman, updateHuman } = require('./humans.ts');
const { addDino } = require('./dinos.ts');

function encounter(distance = 100) {
  const w = new World(9211, false);
  w.dinos.length = 0;
  w.weather.auto = false;
  w.time = 12;
  const h = addHuman(w, w.camp.x, w.camp.y, false, { role: 'gatherer', think: 0, cd: 0 });
  const yeti = addDino(w, 'yeti', h.x + distance, h.y, { state: 'chase', targetId: h.id });
  // World.update normally rebuilds this index before people act.
  w.byId.set(yeti.id, yeti);
  w.byId.set(h.id, h);
  w.creatureHash.insert(yeti);
  return { w, h, yeti };
}

test('an off-duty worker closes on an attacking Yeti and hits it with the basic club', () => {
  const { w, h, yeti } = encounter(450);
  updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'hunt', 'responds from winter throwing range');
  assert.equal(h.targetId, yeti.id);
  h.x = yeti.x - 20;
  h.y = yeti.y;
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  h.cd = 0;
  updateHuman(w, h, 1 / 30);
  assert.ok(yeti.health < 1, 'the combat response actually damages the Yeti');
});

test('nearby adults defend a comrade, including one carried away by a Yeti', () => {
  for (const carried of [false, true]) {
    const { w, h, yeti } = encounter();
    const helper = addHuman(w, h.x - 40, h.y, false, { role: 'builder', think: 0 });
    if (carried) {
      yeti.holding = h.id;
      yeti.targetId = 0;
      yeti.state = 'wander';
      h.yetiHeld = yeti.id;
    }
    updateHuman(w, helper, 1 / 30);
    assert.equal(helper.targetId, yeti.id);
    assert.ok(['hunt', 'aim'].includes(helper.state));
  }
});

test('a worker with a bow shoots back using the existing projectile combat', () => {
  const { w, h, yeti } = encounter(100);
  w.camp.learned.add('bow');
  updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'aim');
  assert.equal(h.targetId, yeti.id);
  assert.ok(w.tribe.projectiles.length > 0);
});

test('workers do not start a fight with a Yeti that is leaving people alone', () => {
  const { w, h, yeti } = encounter();
  yeti.state = 'idle';
  yeti.targetId = 0;
  updateHuman(w, h, 1 / 30);
  assert.ok(!['hunt', 'aim'].includes(h.state));
});

test('children and injured workers seek safety from an attacking Yeti', () => {
  for (const overrides of [{ child: true }, { hp: 0.3 }]) {
    const { w, h } = encounter();
    Object.assign(h, overrides);
    updateHuman(w, h, 1 / 30);
    assert.equal(h.state, 'flee');
  }
});

test('a worker already fleeing an attack turns to defend', () => {
  const { w, h, yeti } = encounter();
  Object.assign(h, { state: 'flee', dangerUntil: w.elapsed + 3, refuge: { x: h.x - 100, y: h.y } });
  updateHuman(w, h, 1 / 30);
  assert.equal(h.targetId, yeti.id);
  assert.ok(['hunt', 'aim'].includes(h.state));
  assert.equal(h.dangerUntil, 0);
});

test('a distant worker and a worker separated by a wall do not join the fight', () => {
  for (const blocked of [false, true]) {
    const { w, h } = encounter(blocked ? 100 : 800);
    if (blocked) w.nav.wallBetween = () => true;
    updateHuman(w, h, 1 / 30);
    assert.ok(!['hunt', 'aim'].includes(h.state));
  }
});
