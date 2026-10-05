// Headless tests for the Dinosaur Land simulation (app/dinosors/sim).
// The sim is DOM-free, so we transpile its TypeScript on the fly and step it in Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const root = path.join(__dirname, '..', 'app', 'dinosors');
const { World } = require(path.join(root, 'sim', 'world.ts'));
const { LM } = require(path.join(root, 'sim', 'terrain.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { SPECIES } = require(path.join(root, 'data', 'species.ts'));

const DT = 1 / 30;
function run(w, seconds, each) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w, i * DT) === true) return i * DT;
  }
  return -1;
}
const tileAt = (w, p) => w.terrain.tiles[p.y * 160 + p.x];

test('terrain has its landmarks', () => {
  const w = new World(1234, false);
  assert.equal(tileAt(w, LM.camp), T.Dirt);
  assert.equal(tileAt(w, LM.lake), T.Deep);
  assert.equal(tileAt(w, LM.volcano), T.Mountain, 'crater is impassable');
  assert.equal(tileAt(w, LM.tar), T.Tar);
  assert.equal(tileAt(w, LM.nest), T.Nest);
  const drink = w.terrain.nearestDrink(LM.camp.x * TILE, LM.camp.y * TILE);
  assert.ok(drink, 'camp can reach fresh water');
});

test('species catalog is complete and data-driven', () => {
  const ids = SPECIES.map((s) => s.id);
  for (const id of ['trex', 'raptor', 'trike', 'stego', 'brachio', 'apato', 'ankylo', 'spino', 'allo', 'carno', 'para', 'dilo', 'pachy', 'iguano', 'compy', 'mosa', 'ptera', 'dimorpho']) {
    assert.ok(ids.includes(id), id);
  }
  for (const s of SPECIES) {
    assert.ok(s.facts.length >= 2 && s.size > 0 && s.speed > 0 && s.run >= s.speed, s.id);
  }
});

test('world populates and stays alive for 4 minutes', () => {
  const w = new World(42);
  assert.ok(w.dinos.length > 40, `dinos: ${w.dinos.length}`);
  assert.equal(w.humans.length, 8);
  assert.ok(w.plants.length > 600, `plants: ${w.plants.length}`);
  const states = new Set();
  const humanStates = new Set();
  run(w, 240, (w) => {
    for (const d of w.dinos) states.add(d.state);
    for (const h of w.humans) humanStates.add(h.state);
  });
  assert.ok(w.dinos.length > 25, `dinos left: ${w.dinos.length}`);
  for (const s of ['wander', 'eat', 'drink', 'idle']) assert.ok(states.has(s), `saw dino state ${s} (got ${[...states]})`);
  for (const s of ['gather', 'carry']) assert.ok(humanStates.has(s), `saw human state ${s} (got ${[...humanStates]})`);
  for (const d of w.dinos) {
    assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y), 'finite positions');
  }
});

test('a hungry predator hunts nearby prey', () => {
  const w = new World(7, false);
  const x = 110 * TILE;
  const y = 56 * TILE;
  const rex = addDino(w, 'trex', x, y, { hunger: 0.95, thirst: 0 });
  const baby = addDino(w, 'trike', x + 160, y, { growth: 0.1, thirst: 0, hunger: 0 });
  let chased = false;
  const t = run(w, 40, (w) => {
    if (rex.state === 'stalk' || rex.state === 'chase') chased = true;
    return !w.dinos.includes(baby) || rex.state === 'eat';
  });
  assert.ok(chased, 'rex stalked or chased');
  assert.ok(t >= 0, 'hunt resolved');
});

test('herbivores flee from predators', () => {
  const w = new World(8, false);
  const x = 110 * TILE;
  const y = 56 * TILE;
  const para = addDino(w, 'para', x, y, { hunger: 0, thirst: 0 });
  addDino(w, 'trex', x + 120, y, { hunger: 0.9, thirst: 0 });
  const t = run(w, 5, () => para.state === 'flee');
  assert.ok(t >= 0, 'para fled');
});

test('volcano erupts, lava flows, then cools into rock', () => {
  const w = new World(9, false);
  w.weather.auto = false;
  assert.ok(w.volcano.trigger(w));
  run(w, 16);
  assert.ok(w.lava.active.size > 5, `lava tiles: ${w.lava.active.size}`);
  const basaltBefore = w.terrain.tiles.filter((t) => t === T.Basalt).length;
  run(w, 200);
  const basaltAfter = w.terrain.tiles.filter((t) => t === T.Basalt).length;
  assert.ok(basaltAfter > basaltBefore, 'new rock formed');
  assert.equal(w.volcano.phase, 'idle');
});

test('rain puts out wildfires and burnt ground starts healing', () => {
  const w = new World(10, false);
  w.weather.auto = false;
  const tx = LM.forest.x;
  const ty = LM.forest.y;
  w.fire.initFuel(w);
  assert.ok(w.fire.ignite(w, tx, ty, 1));
  run(w, 6);
  assert.ok(w.fire.active.size >= 1);
  w.weather.set(w, 'storm');
  w.weather.rain = 1;
  run(w, 40);
  assert.equal(w.fire.active.size, 0, 'fire is out');
  assert.ok(w.fire.scorched.size > 0, 'scorch marks remain');
});

test('cave people discover fire step by step', () => {
  const w = new World(11);
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 10;
  // keep dinos away from camp for this test
  w.dinos.length = 0;
  w.camp.learned.add('tools');
  w.camp.goal = 'fire';
  Object.assign(w.camp.stock, { stick: 8, grass: 5, stone: 3 });
  const t = run(w, 90, (w) => w.camp.learned.has('fire'));
  assert.ok(t >= 0, 'fire learned');
  assert.ok(w.campfires.some((f) => f.lit), 'campfire lit');
  assert.ok(w.discoveries.has('fireMade'));
});

test('cave people gather resources and build a shelter in stages', () => {
  const w = new World(12);
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 10;
  w.dinos.length = 0;
  for (const t of ['tools', 'axe', 'basket']) w.camp.learned.add(t);
  w.camp.setGoal(w, 'shelter');
  assert.equal(w.shelters.length, 1);
  Object.assign(w.camp.stock, { wood: 4, stick: 6, leaves: 6, stone: 4 });
  let maxStage = 0;
  run(w, 240, (w) => {
    maxStage = Math.max(maxStage, w.shelters[0].stage);
    return maxStage >= 4;
  });
  assert.ok(maxStage >= 2, `shelter reached stage ${maxStage}`);
});

test('eggs hatch into babies that grow', () => {
  const w = new World(13, false);
  const e = w.addEgg('trike', LM.nest.x * TILE, LM.nest.y * TILE, 0, 0, 2);
  run(w, 3);
  assert.ok(!w.eggs.includes(e));
  const baby = w.dinos.find((d) => d.species === 'trike');
  assert.ok(baby && baby.growth < 0.1);
  run(w, 10);
  assert.ok(baby.growth > 0.02);
});

test('meteor makes everyone look up, then knocks them over', () => {
  const w = new World(14, false);
  const x = 110 * TILE;
  const y = 56 * TILE;
  const d = addDino(w, 'stego', x + 150, y, { hunger: 0, thirst: 0 });
  w.meteor(x, y);
  w.update(DT);
  assert.equal(d.state, 'lookUp');
  run(w, 3.4);
  assert.ok(['knocked', 'flee', 'idle'].includes(d.state), d.state);
  assert.ok(w.discoveries.has('meteor'));
});

test('save → load round-trips the world', () => {
  const w = new World(15);
  run(w, 5);
  w.camp.learned.add('tools');
  w.discoveries.add('poop');
  w.terrain.setTile(10, 10, T.Shallow);
  const json = JSON.stringify(w.serialize());
  const w2 = World.deserialize(JSON.parse(json));
  assert.equal(w2.dinos.length, w.dinos.length);
  assert.equal(w2.humans.length, w.humans.length);
  assert.equal(w2.plants.length, w.plants.length);
  assert.ok(w2.camp.learned.has('tools'));
  assert.ok(w2.discoveries.has('poop'));
  assert.equal(w2.terrain.tiles[10 * 160 + 10], T.Shallow);
  run(w2, 5);
});
