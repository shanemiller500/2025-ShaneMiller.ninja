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
const { addDino, setState, sizeOf } = require(path.join(root, 'sim', 'dinos.ts'));
const { downDino } = require(path.join(root, 'sim', 'tribe.ts'));
const carcass = require(path.join(root, 'sim', 'carcass.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));

const DT = 1 / 30;
/** Open grass well away from camp, no wildlife spawning, no people. */
function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.humans.length = 0;
  w.wildlife.enabled = false;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  const cx = Math.floor(w.camp.x / TILE) + 60, cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  return { w, x: cx * TILE + 16, y: cy * TILE + 16 };
}
const bodies = (w) => w.items.filter((i) => i.kind === 'carcass');
const bones = (w) => w.items.filter((i) => i.kind === 'bones' || (i.kind === 'carcass' && carcass.carcassStage(i.carcass) === 'bones'));
/** A hungry meat-eater sat at a body, eating it. */
function eatAt(w, d, it, hunger) {
  d.hunger = hunger;
  d.x = it.x + 20; d.y = it.y;
  d.targetId = it.id;
  setState(d, 'eat', it.x, it.y);
}

test('an animal eats a body whole: bones, hide and teeth go down with the meat, and nothing is left', () => {
  const { w, x, y } = world(5101);
  const prey = addDino(w, 'trike', x, y, { growth: 1 });
  const it = carcass.makeCarcass(w, prey, { wild: true });
  w.removeDino(prey);
  const c = it.carcass;
  const max = { ...c.max };
  carcass.eatCarcass(it, max.meat / 2);
  assert.ok(Math.abs(c.bone / max.bone - 0.5) < 0.02, 'half the meat eaten: half the bones too');
  assert.ok(Math.abs(c.hide / max.hide - 0.5) < 0.02, 'and half the hide');
  const done = carcass.eatCarcass(it, max.meat);
  assert.equal(done, true);
  assert.equal(carcass.carcassTotal(c), 0, 'not a bone left');
});

test('a big kill: the hunter eats its fill and leaves the rest; a passing meat-eater finds it and finishes it', () => {
  const { w, x, y } = world(5102);
  const prey = addDino(w, 'brachio', x, y, { growth: 1 });
  const it = carcass.makeCarcass(w, prey, { wild: true });
  w.removeDino(prey);
  const raptor = addDino(w, 'raptor', x + 20, y, { growth: 1 });
  eatAt(w, raptor, it, 0.6);
  for (let i = 0; i < 30 * 40 && raptor.state === 'eat'; i++) { w.update(DT); w.events.length = 0; }
  assert.notEqual(raptor.state, 'eat', 'it ate its fill and stopped');
  assert.ok(w.items.includes(it), 'a big body is more than one hunter can eat: the rest is left');
  assert.ok(it.carcass.meat > 0 && it.carcass.bone < it.carcass.max.bone, 'what it ate took bones with it');
  assert.equal(it.claimed, 0, 'free for anyone');
  // the leftovers draw in other meat-eaters (they eat it all between them)
  const pack = [0, 1, 2, 3, 4, 5].map((k) => addDino(w, 'trex', x + 40 + k * 10, y + (k % 2) * 20, { growth: 1 }));
  for (let i = 0; i < 30 * 600 && w.items.includes(it); i++) {
    for (const d of pack) if (w.dinos.includes(d) && d.state !== 'eat' && w.items.includes(it)) eatAt(w, d, it, 0.95);
    w.update(DT);
    w.events.length = 0;
  }
  assert.ok(!w.items.includes(it), 'finished off by the next meat-eaters');
  assert.equal(bones(w).length, 0, 'no bones or body left behind');
});

test('an animal kill nobody finishes fades away whole: never a bare skeleton', () => {
  const { w, x, y } = world(5103);
  const prey = addDino(w, 'trike', x, y, { growth: 1 });
  const it = carcass.makeCarcass(w, prey, { wild: true });
  w.removeDino(prey);
  let skeleton = false;
  for (let i = 0; i < 30 * 700 && w.items.includes(it); i++) {
    w.update(DT);
    w.events.length = 0;
    if (w.items.includes(it) && carcass.carcassStage(it.carcass) === 'bones') skeleton = true;
  }
  assert.ok(!w.items.includes(it), 'it went');
  assert.equal(skeleton, false, 'it never showed as a skeleton');
  assert.equal(bones(w).length, 0, 'and left no bones');
});

test('our own kills are still ours: hide + bones stay to harvest after the meat spoils', () => {
  const { w, x, y } = world(5104);
  const prey = addDino(w, 'trike', x, y, { growth: 1 });
  downDino(w, prey);
  const it = bodies(w)[0];
  assert.ok(it && !it.carcass.wild, 'a normal body');
  for (let i = 0; i < 30 * 320; i++) { w.update(DT); w.events.length = 0; }
  assert.ok(w.items.includes(it), 'still there');
  assert.ok(it.carcass.meat <= 0.01 && it.carcass.bone > 0, 'meat spoiled, bones to gather');
});
