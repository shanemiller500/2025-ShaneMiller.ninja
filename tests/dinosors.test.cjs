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
const { SPECIES, sp } = require(path.join(root, 'data', 'species.ts'));

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

/* ----------------------------- tribe layer ----------------------------- */
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));

function tribeWorld(seed, techs) {
  const w = new World(seed);
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 10;
  w.randomEvents.enabled = false;
  w.dinos.length = 0;
  for (const t of techs) w.camp.learned.add(t);
  w.camp.goal = null;
  return w;
}

test('finished walls stop dinosaurs; raiders bash through them', () => {
  const w = tribeWorld(21, ['tools', 'axe', 'palisade']);
  const ty = 60;
  for (let tx = 95; tx <= 125; tx++) {
    const wl = w.tribe.addWall(w, tx, ty, 'palisade');
    if (wl) { wl.built = 1; wl.hp = 220; }
  }
  const d = addDino(w, 'trike', 110 * TILE, 56 * TILE, { hunger: 0, thirst: 0 });
  run(w, 20, () => { d.tx = 110 * TILE; d.ty = 66 * TILE; d.state = 'wander'; d.think = 5; });
  assert.ok(d.y < ty * TILE, `trike stayed north of the wall (y=${Math.round(d.y / TILE)})`);
  // a raider gets frustrated and smashes it
  const r = addDino(w, 'allo', 110 * TILE, 57 * TILE, { raider: true, hunger: 0.9, thirst: 0 });
  w.tribe.raid = { phase: 'attack', t: 0, ids: [r.id], fromX: r.x, fromY: r.y, breached: false, label: 'test' };
  w.camp.y = 70 * TILE; // pretend the camp is behind the wall
  let bashed = false;
  run(w, 40, () => { if (r.state === 'attackWall') bashed = true; return w.tribe.raid?.breached; });
  assert.ok(bashed, 'raider attacked the wall');
  assert.ok(w.tribe.raid === null || w.tribe.raid.breached, 'wall breached');
});

test('hunters shoot prey, drag it home, cooks roast it', () => {
  const w = tribeWorld(22, ['tools', 'fire', 'spear', 'bow']);
  w.camp.lightCampfire(w);
  for (const h of w.humans) h.role = 'gatherer';
  const hunter = w.humans.find((h) => !h.child);
  hunter.role = 'hunter';
  const cook = w.humans.filter((h) => !h.child)[1];
  cook.role = 'cook';
  const prey = addDino(w, 'compy', w.camp.x + 260, w.camp.y + 120, { hunger: 0, thirst: 0 });
  let downed = false;
  const t = run(w, 120, (w) => {
    if (!w.dinos.includes(prey)) downed = true;
    return w.camp.stock.cooked > 0;
  });
  assert.ok(downed, 'prey was downed');
  assert.ok(t >= 0, `meat hauled + cooked (meat=${w.camp.stock.meat}, cooked=${w.camp.stock.cooked})`);
  assert.ok(w.discoveries.has('hunted') && w.discoveries.has('feast'));
});

test('a raid comes, guards fight, and it ends', () => {
  const w = tribeWorld(23, ['tools', 'fire', 'spear', 'bow', 'crossbow']);
  for (const h of w.humans) h.role = h.child ? 'auto' : 'guard';
  assert.ok(w.tribe.startRaid(w), 'raid started');
  const ids = [...w.tribe.raid.ids];
  let shots = 0;
  const t = run(w, 170, (w) => { shots += w.tribe.projectiles.length ? 1 : 0; return w.tribe.raid === null; });
  assert.ok(t >= 0, 'raid finished');
  assert.ok(shots > 0, 'guards shot at the raiders');
  const downedOrGone = ids.filter((id) => !w.dinoById(id) || !w.dinoById(id).raider).length;
  assert.equal(downedOrGone, ids.length);
  assert.ok(w.tribe.raidsWon === 1 && w.discoveries.has('defended'));
});

test('calm mode never raids', () => {
  const w = tribeWorld(24, ['tools', 'spear']);
  w.tribe.danger = 'calm';
  w.tribe.raidTimer = 1;
  run(w, 10);
  assert.equal(w.tribe.raid, null);
  assert.equal(w.tribe.startRaid(w), false);
});

test('farms grow crops; a fed tribe has babies and the camp levels up', () => {
  const w = tribeWorld(25, ['tools', 'basket', 'farming', 'axe', 'shelter']);
  w.tribe.addFarm(w, w.camp.x + 40, w.camp.y + 140);
  const f = w.tribe.farms[0];
  w.humans.find((h) => !h.child).role = 'farmer';
  w.camp.stock.grass = 5;
  run(w, 150, () => w.camp.stock.crop > 0);
  assert.ok(w.camp.stock.crop > 0 || f.growth > 0.5, `farm grew (crop=${w.camp.stock.crop}, growth=${f.growth.toFixed(2)})`);
  // huts + food → babies → Little Village
  for (let i = 0; i < 2; i++) { const s = w.camp.addShelter(w, w.camp.x - 150 + i * 80, w.camp.y + 80); s.stage = 4; }
  w.camp.stock.cooked = 60;
  run(w, 200, () => w.tribe.level >= 1);
  assert.ok(w.humans.length >= 9, `population ${w.humans.length}`);
  assert.equal(w.tribe.level, 1);
});

test('jobs auto-assign and direct orders work', () => {
  const w = tribeWorld(26, ['tools', 'spear', 'axe', 'palisade', 'fire']);
  w.camp.lightCampfire(w);
  w.camp.stock.meat = 3;
  w.tribe.planRing(w, 'palisade');
  run(w, 4);
  const roles = new Set(w.humans.filter((h) => !h.child).map((h) => h.autoRole));
  for (const r of ['guard', 'builder', 'cook']) assert.ok(roles.has(r), `auto job ${r} (got ${[...roles]})`);
  const target = addDino(w, 'compy', w.camp.x + 200, w.camp.y + 100, { hunger: 0 });
  const h = w.humans.find((h) => !h.child);
  h.order = { kind: 'hunt', id: target.id };
  h.think = 0;
  run(w, 30, () => !w.dinos.includes(target));
  assert.ok(!w.dinos.includes(target), 'ordered hunter got it');
});

test('tribe state survives save/load', () => {
  const w = tribeWorld(27, ['tools', 'axe', 'palisade']);
  w.tribe.planRing(w, 'palisade');
  w.tribe.walls[0].built = 1;
  w.tribe.walls[0].hp = 220;
  w.tribe.level = 2;
  w.tribe.danger = 'wild';
  w.humans[0].role = 'guard';
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(w2.tribe.walls.length, w.tribe.walls.length);
  assert.equal(w2.tribe.level, 2);
  assert.equal(w2.tribe.danger, 'wild');
  assert.equal(w2.humans[0].role, 'guard');
  assert.ok(w2.tribe.blocks(w.tribe.walls[0].tx, w.tribe.walls[0].ty));
});

/* ----------------------------- evolution ----------------------------- */
const { inherit, evolveWorld, traitsOf } = require(path.join(root, 'sim', 'genetics.ts'));
const { makeRng } = require(path.join(root, 'sim', 'rng.ts'));

test('babies inherit genes from their parents (+ a little mutation)', () => {
  const w = new World(31, false);
  const mum = addDino(w, 'trike', LM.nest.x * TILE, LM.nest.y * TILE, { genes: { size: 1.4, speed: 1.3, tough: 1.2, hue: 0.5, mut: 'spotted' }, gen: 4 });
  addDino(w, 'trike', LM.nest.x * TILE + 60, LM.nest.y * TILE, { genes: { size: 1.4, speed: 1.3, tough: 1.2, hue: 0.5, mut: 'spotted' }, gen: 4 });
  w.addEgg('trike', mum.x, mum.y + 20, 0, mum.id, 1);
  run(w, 2);
  const baby = w.dinos.find((d) => d.growth < 0.2);
  assert.ok(baby, 'baby hatched');
  assert.equal(baby.gen, 5);
  assert.ok(baby.genes.size > 1.2 && baby.genes.speed > 1.1, `inherited big + fast (${baby.genes.size.toFixed(2)}, ${baby.genes.speed.toFixed(2)})`);
  // mutations happen sometimes
  const rng = makeRng(5);
  let muts = 0;
  for (let i = 0; i < 400; i++) if (inherit(rng, { size: 1, speed: 1, tough: 1, hue: 0, mut: null }, null).mut) muts++;
  assert.ok(muts > 5 && muts < 80, `mutation rate ${muts}/400`);
  assert.ok(traitsOf({ size: 1.4, speed: 1.4, tough: 1, hue: 0, mut: 'glow' }).length === 3);
});

test('evolving a million years pushes species the way their world does', () => {
  const w = new World(32);
  const before = new Map();
  for (const d of w.dinos) if (sp(d.species).diet === 'herbivore') before.set(d.id, { ...d.genes });
  for (let i = 0; i < 6; i++) evolveWorld(w);
  const herbs = w.dinos.filter((d) => before.has(d.id));
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const change = avg(herbs.map((d) => { const b = before.get(d.id); return Math.abs(d.genes.size - b.size) + Math.abs(d.genes.speed - b.speed) + Math.abs(d.genes.tough - b.tough); }));
  assert.ok(change > 0.15, `species changed (avg ${change.toFixed(2)})`);
  // hunted plant-eaters trend toward running away or toughing it out
  const escape = avg(herbs.map((d) => d.genes.speed + d.genes.tough - before.get(d.id).speed - before.get(d.id).tough));
  assert.ok(escape > 0.05, `escape/defence trend ${escape.toFixed(2)}`);
  const paras = w.dinos.filter((d) => d.species === 'para');
  assert.ok(paras.every((d) => d.gen > 40), 'generations advanced');
  assert.equal(w.evoLeaps, 6);
  assert.ok(w.discoveries.has('evolved'));
  run(w, 5);
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const p1 = w.dinos.find((d) => d.species === 'para');
  const p2 = w2.dinos.find((d) => d.id === p1.id);
  assert.ok(Math.abs(p2.genes.speed - p1.genes.speed) < 0.01 && p2.gen === p1.gen, 'genes survive save/load');
});
