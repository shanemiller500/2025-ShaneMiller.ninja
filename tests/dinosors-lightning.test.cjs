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
const { KILL_R, SHOCK_R } = require(path.join(root, 'sim', 'lightningStrike.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 1; // no fires to muddy things
  w.dragons.timer = Infinity;
  if (w.snowFolk) w.snowFolk.enabled = false;
  return w;
}

test('a lightning bolt kills people + animals where it lands and burns up the weapons people hold', () => {
  const w = world(7701);
  const x = w.camp.x + 300;
  const y = w.camp.y + 260;
  // open ground: no tree for the bolt to jump to
  w.plants = w.plants.filter((p) => Math.hypot(p.x - x, p.y - y) > 400);
  const hit = addHuman(w, x + 4, y, false, {});
  hit.gear.weapon = 'spear1';
  const near = addHuman(w, x + (KILL_R + SHOCK_R) / 2, y, false, {});
  near.gear.weapon = 'axe1';
  near.gear.shield = 1;
  const far = addHuman(w, x + 400, y, false, {});
  far.gear.weapon = 'spear1';
  const hiding = addHuman(w, x - 6, y, false, {});
  hiding.state = 'hide';
  hiding.gear.weapon = 'spear1';
  const dino = addDino(w, 'trike', x, y + 10);
  w.lightning(x, y, true);
  assert.ok(!w.humans.includes(hit), 'a direct hit kills');
  assert.ok(!w.dinos.includes(dino), 'animals too');
  assert.ok(w.items.some((it) => it.kind === 'carcass' && it.carcass?.burnt), 'leaving a burnt body');
  assert.ok(w.humans.includes(near), 'close by survives…');
  assert.equal(near.gear.weapon, null, '…but their weapon is burnt up');
  assert.equal(near.gear.shield, 0, 'and their shield');
  assert.ok(near.hp < 1, 'and they are hurt');
  assert.equal(far.gear.weapon, 'spear1', 'far away: nothing happens');
  assert.ok(w.humans.includes(hiding) && hiding.gear.weapon === 'spear1', 'hiding indoors is safe');
});
