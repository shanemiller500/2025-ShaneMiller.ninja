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

/** A closed box of finished walls (optionally with a gate on the south side + stairs inside). */
function walledBox(w, x0, y0, x1, y1, { gate = false, kind = 'palisade' } = {}) {
  const gx = Math.floor((x0 + x1) / 2);
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      if (tx !== x0 && tx !== x1 && ty !== y0 && ty !== y1) continue;
      const part = gate && ty === y1 && tx === gx ? 'gate' : 'wall';
      const wl = w.tribe.addWall(w, tx, ty, kind, part);
      if (wl) { wl.built = 1; wl.hp = 220; }
    }
  }
  if (gate) {
    const st = w.tribe.addWall(w, gx + 1, y1 - 1, kind, 'stairs');
    st.built = 1; st.hp = 200;
  }
  w.tribe.version++;
  return { gx, gy: y1 };
}

test('finished walls stop dinosaurs; raiders bash through when there is no way round', () => {
  const w = tribeWorld(21, ['tools', 'axe', 'palisade']);
  walledBox(w, 104, 44, 122, 58);
  const closed = w.tribe.walls.length === 2 * (19 + 15) - 4;
  assert.ok(closed, `box is closed (${w.tribe.walls.length} pieces)`);
  const d = addDino(w, 'trike', 113 * TILE, 39 * TILE, { hunger: 0, thirst: 0 });
  run(w, 20, () => { d.tx = 113 * TILE; d.ty = 51 * TILE; d.state = 'wander'; d.think = 5; });
  const inside = (c) => c.x > 104 * TILE && c.x < 123 * TILE && c.y > 44 * TILE && c.y < 59 * TILE;
  assert.ok(!inside(d), `trike stayed outside the walls (${Math.round(d.x / TILE)},${Math.round(d.y / TILE)})`);
  // a raider can't find a way in, so it smashes through
  const r = addDino(w, 'allo', 113 * TILE, 40 * TILE, { raider: true, hunger: 0.9, thirst: 0 });
  w.tribe.raid = { phase: 'attack', t: 0, ids: [r.id], fromX: r.x, fromY: r.y, breached: false, label: 'test' };
  w.camp.x = 113 * TILE;
  w.camp.y = 51 * TILE; // pretend the camp is inside the box
  let bashed = false;
  run(w, 60, () => { if (r.state === 'attackWall') bashed = true; return w.tribe.raid?.breached; });
  assert.ok(bashed, 'raider attacked the wall');
  assert.ok(w.tribe.raid === null || w.tribe.raid.breached, 'wall breached');
});

test('raiders walk round a short wall (they look for openings) and through open gates', () => {
  const w = tribeWorld(28, ['tools', 'axe', 'palisade']);
  for (let tx = 104; tx <= 116; tx++) { const wl = w.tribe.addWall(w, tx, 60, 'palisade'); wl.built = 1; wl.hp = 220; }
  w.tribe.version++;
  const r = addDino(w, 'raptor', 110 * TILE, 56 * TILE, { raider: true, hunger: 0.9, thirst: 0 });
  w.tribe.raid = { phase: 'attack', t: 0, ids: [r.id], fromX: r.x, fromY: r.y, breached: false, label: 'test' };
  w.camp.x = 110 * TILE;
  w.camp.y = 66 * TILE;
  let bashed = false;
  const t = run(w, 40, () => { if (r.state === 'attackWall') bashed = true; return r.y > 63 * TILE; });
  assert.ok(t >= 0, `raider got past the wall (y=${Math.round(r.y / TILE)})`);
  assert.ok(!bashed, 'it went round instead of bashing');
});

test('gates: people pass, dinos only when open; stairs lead up onto the walkway', () => {
  const w = tribeWorld(29, ['tools', 'axe', 'palisade']);
  const { gx, gy } = walledBox(w, 100, 60, 120, 72, { gate: true });
  const gate = w.tribe.wallAt(gx, gy);
  w.tribe.setGate(gate, false, true);
  w.nav.sync(w);
  assert.equal(w.nav.ok('dino', gy * 160 + gx), false, 'closed gate blocks dinos');
  assert.equal(w.nav.ok('human', gy * 160 + gx), true, 'people use the side door');
  w.tribe.setGate(gate, true, true);
  w.nav.sync(w);
  assert.equal(w.nav.ok('dino', gy * 160 + gx), true, 'open gate lets dinos through');
  // a person outside walks in through the gate, climbs the stairs and stands on the north wall
  const h = addHuman(w, 110 * TILE, 76 * TILE, false);
  h.order = { kind: 'guard', x: 110 * TILE + 16, y: 60 * TILE + 16, top: true };
  h.role = 'guard';
  h.think = 0;
  const t = run(w, 60, () => h.level === 1 && Math.abs(h.y - (60 * TILE + 16)) < 20);
  assert.ok(t >= 0, `guard reached the walkway (level ${h.level}, at ${Math.round(h.x / TILE)},${Math.round(h.y / TILE)})`);
  run(w, 1);
  assert.ok(h.level === 1 && h.z > 10, `standing up high (z ${h.z.toFixed(1)})`);
});

const tasks = require(path.join(root, 'sim', 'tasks.ts'));
const pickNone = { dino: null, human: null, dragon: null };

test('select a person, click a tree: they chop it, bring logs home, then go back to auto', () => {
  const w = tribeWorld(30, ['tools', 'axe', 'basket']);
  const h = w.humans.find((x) => !x.child);
  const tree = w.plants.filter((p) => ['broadleaf', 'conifer', 'palm'].includes(p.kind) && p.size > 0.7 && !p.stump).sort((a, b) => Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y))[0];
  const cmd = tasks.inferCommand(w, [h], tree.x, tree.y - 30, pickNone);
  assert.equal(cmd.kind, 'chop', `click on a tree means chop (got ${cmd.kind})`);
  const wood0 = w.camp.stock.wood;
  const task = tasks.issue(w, [h], cmd);
  assert.ok(task && h.taskId === task.id);
  const t = run(w, 90, () => w.camp.stock.wood > wood0 && !h.taskId);
  assert.ok(t >= 0, `wood delivered (${w.camp.stock.wood}) + task done (taskId ${h.taskId}, state ${h.state})`);
  assert.ok(tree.stump, 'tree is a stump');
});

test('ordered builders fetch materials, build a wall stretch, then the job ends', () => {
  const w = tribeWorld(31, ['tools', 'axe', 'palisade']);
  const c = w.camp;
  const ty = Math.floor((c.y + 220) / TILE);
  const pieces = [];
  for (let tx = Math.floor(c.x / TILE) - 3; tx <= Math.floor(c.x / TILE) + 3; tx++) { const wl = w.tribe.addWall(w, tx, ty, 'palisade'); if (wl) pieces.push(wl); }
  assert.ok(pieces.length >= 5);
  w.camp.stock.stick = 4; // not enough: they'll have to gather more
  const crew = w.humans.filter((x) => !x.child).slice(0, 3);
  const cmd = tasks.inferCommand(w, crew, pieces[0].tx * TILE + 16, pieces[0].ty * TILE + 16, pickNone);
  assert.equal(cmd.kind, 'build');
  assert.equal(cmd.group.length, pieces.length, 'the whole stretch is one job');
  tasks.issue(w, crew, cmd);
  const t = run(w, 400, () => pieces.every((p) => p.built >= 1));
  assert.ok(t >= 0, `wall finished (${pieces.filter((p) => p.built >= 1).length}/${pieces.length})`);
  run(w, 5);
  assert.ok(crew.every((h) => !h.taskId), 'crew released back to auto');
});

test('a Scorpion crew drives off a dragon', () => {
  const w = tribeWorld(32, ['tools', 'spear', 'bow', 'axe', 'palisade', 'tower', 'crossbow', 'scorpion']);
  const s = w.colony.addScorpion(w, w.camp.x + 120, w.camp.y + 120);
  assert.equal(typeof s, 'object');
  s.built = 1;
  const g = w.humans.find((x) => !x.child);
  g.role = 'guard';
  const dr = w.dragons.summon(w);
  assert.ok(dr, 'dragon summoned');
  dr.x = w.camp.x + 800; dr.y = w.camp.y;
  let shots = 0;
  const t = run(w, 120, (w) => { shots += w.tribe.projectiles.filter((p) => p.kind === 'scorpion' && p.t === 0).length; return !w.dragons.list.includes(dr) || dr.state === 'flee'; });
  assert.ok(s.crew || shots > 0, 'somebody crewed the Scorpion');
  assert.ok(t >= 0, `dragon driven off (hp ${Math.round(dr.hp)}, state ${dr.state})`);
  assert.ok(w.discoveries.has('dragon'));
});

test('homes upgrade through tiers and raise capacity; wanderers join a safe camp', () => {
  const w = tribeWorld(33, ['tools', 'axe', 'basket', 'shelter']);
  const cap0 = w.population.capacity(w);
  const tent = w.camp.addShelter(w, w.camp.x - 160, w.camp.y + 90, 'tent');
  Object.assign(w.camp.stock, { stick: 12, leaves: 12, grass: 6, wood: 10, hide: 6 });
  let t = run(w, 200, () => tent.stage >= 2);
  assert.ok(t >= 0, `tent built (stage ${tent.stage})`);
  assert.ok(w.population.capacity(w) >= cap0 + 2, `tent adds room (${w.population.capacity(w)})`);
  assert.ok(w.camp.startUpgrade(w, tent));
  t = run(w, 300, () => tent.tier >= 1);
  assert.ok(t >= 0, `tent upgraded (tier ${tent.tier}, have ${JSON.stringify(tent.upHave)})`);
  assert.ok(w.population.capacity(w) >= cap0 + 3, `capacity grew (${w.population.capacity(w)})`);
  // someone gets a home
  run(w, 5);
  assert.ok(w.humans.some((h) => h.home === tent.id));
  // a family walks in
  w.camp.stock.cooked = 20;
  const fam = w.population.spawnWanderers(w);
  assert.ok(fam.length >= 1 && fam.every((h) => h.stranger));
  const n0 = w.humans.filter((h) => !h.stranger).length;
  t = run(w, 200, () => fam.every((h) => !h.stranger));
  assert.ok(t >= 0, `newcomers joined (${fam.map((h) => Math.round(Math.hypot(h.x - w.camp.x, h.y - w.camp.y))).join(',')}px away)`);
  assert.ok(w.humans.filter((h) => !h.stranger).length >= n0 + fam.length, 'they count as residents now');
});

test('befriend a triceratops, then ride it', () => {
  const w = tribeWorld(34, ['tools', 'basket', 'taming']);
  w.camp.stock.berries = 10;
  const trike = addDino(w, 'trike', w.camp.x + 260, w.camp.y + 140, { hunger: 0, thirst: 0 });
  const h = w.humans.find((x) => !x.child);
  let cmd = tasks.inferCommand(w, [h], trike.x, trike.y - 20, { ...pickNone, dino: trike });
  assert.equal(cmd.kind, 'tame');
  tasks.issue(w, [h], cmd);
  let t = run(w, 80, () => trike.owner);
  assert.ok(t >= 0, `befriended (tame ${trike.tame.toFixed(2)})`);
  cmd = tasks.inferCommand(w, [h], trike.x, trike.y - 20, { ...pickNone, dino: trike });
  assert.equal(cmd.kind, 'ride');
  tasks.issue(w, [h], cmd);
  t = run(w, 40, () => h.riding === trike.id);
  assert.ok(t >= 0, 'riding');
  assert.equal(trike.state, 'ridden');
  assert.ok(w.discoveries.has('rider'));
  // the rider drives: the trike goes where they go
  h.taskId = 0;
  const cmdMove = tasks.inferCommand(w, [h], w.camp.x - 200, w.camp.y + 200, pickNone);
  tasks.issue(w, [h], cmdMove);
  run(w, 15);
  assert.ok(Math.hypot(trike.x - h.x, trike.y - h.y) < 2, 'mount follows rider');
});

test('an asteroid on the volcano sets off a MEGA eruption', () => {
  const w = new World(35);
  w.weather.auto = false;
  w.meteor(w.volcano.x, w.volcano.y);
  run(w, 4);
  assert.ok(w.volcano.megaOn, 'mega eruption started');
  run(w, 20);
  assert.ok(w.discoveries.has('megaEruption'));
  assert.ok(w.lava.active.size > 30, `big lava flows (${w.lava.active.size})`);
  assert.ok(w.volcano.ash > 0.3, 'ash cloud');
});

test('hidden deposits get discovered by explorers and can be mined', () => {
  const w = tribeWorld(36, ['tools', 'axe', 'basket']);
  assert.ok(w.colony.nodes.length > 20, `deposits placed (${w.colony.nodes.length})`);
  const iron = w.colony.nodes.find((n) => n.kind === 'iron');
  assert.ok(iron && !iron.found, 'iron starts hidden');
  const h = w.humans.find((x) => !x.child);
  h.x = iron.x + 60; h.y = iron.y + 40;
  run(w, 1);
  assert.ok(iron.found, 'walking past finds it');
  const cmd = tasks.inferCommand(w, [h], iron.x, iron.y, pickNone);
  assert.equal(cmd.kind, 'mine');
  tasks.issue(w, [h], cmd);
  const t = run(w, 120, () => w.camp.stock.iron > 0);
  assert.ok(t >= 0, 'iron mined + carried home');
});

const injury = require(path.join(root, 'sim', 'injury.ts'));

test('knocked-out people get helped back up', () => {
  const w = tribeWorld(37, ['tools']);
  const [a, b] = w.humans.filter((x) => !x.child);
  injury.knockOut(w, a);
  assert.equal(a.state, 'down');
  b.x = a.x + 80; b.y = a.y;
  const t = run(w, 60, () => a.state !== 'down');
  assert.ok(t >= 0 && t < 40, `helped up after ${t.toFixed(1)}s`);
  assert.ok(w.discoveries.has('healer'));
});

test('hungry predators eat people; big dinos take far more hits to bring down', () => {
  const w = tribeWorld(40, ['tools']);
  const victim = w.humans.find((h) => !h.child);
  victim.x = 110 * TILE; victim.y = 56 * TILE;
  const rex = addDino(w, 'trex', victim.x + 200, victim.y, { hunger: 0.95, thirst: 0 });
  const n0 = w.humans.length;
  const t = run(w, 60, () => !w.humans.includes(victim));
  assert.ok(t >= 0, `the T. rex ate ${victim.name} (hp ${victim.hp.toFixed(2)}, rex ${rex.state})`);
  assert.equal(w.humans.length, n0 - 1);
  assert.ok(rex.hunger < 0.2, 'and is full now');
  // the same spear hits: a raptor goes down long before a T. rex
  const { hitDino } = require(path.join(root, 'sim', 'tribe.ts'));
  const hitsToDown = (species) => { const d = addDino(w, species, 30 * TILE, 30 * TILE, { hunger: 0, thirst: 0 }); let n = 0; while (w.dinos.includes(d) && n < 500) { hitDino(w, d, 26, d.x - 50, d.y); n++; } return n; };
  const raptor = hitsToDown('raptor');
  const trex = hitsToDown('trex');
  assert.ok(trex > raptor * 4, `T. rex took ${trex} hits vs raptor ${raptor}`);
  // calm mode: nobody gets eaten
  const c = tribeWorld(41, ['tools']);
  c.tribe.danger = 'calm';
  const kid = c.humans.find((h) => !h.child);
  kid.x = 110 * TILE; kid.y = 56 * TILE;
  addDino(c, 'trex', kid.x + 200, kid.y, { hunger: 0.95, thirst: 0 });
  run(c, 40);
  assert.ok(c.humans.includes(kid), 'calm mode keeps everyone safe');
});

const carcass = require(path.join(root, 'sim', 'carcass.ts'));

test('kill a dinosaur, harvest the body: meat, hide, bones; it changes stage as it goes', () => {
  const w = tribeWorld(42, ['tools', 'spear']);
  const { hitDino } = require(path.join(root, 'sim', 'tribe.ts'));
  const trike = addDino(w, 'trike', w.camp.x + 220, w.camp.y + 160, { hunger: 0, thirst: 0 });
  let n = 0;
  while (w.dinos.includes(trike) && n++ < 400) hitDino(w, trike, 40, trike.x - 60, trike.y);
  const body = w.items.find((i) => i.kind === 'carcass');
  assert.ok(body, 'the trike left a body');
  const c = body.carcass;
  assert.ok(c.meat >= 5 && c.hide >= 3 && c.bone >= 5, `big animal, big yield ${JSON.stringify(c.max)}`);
  // a raptor gives much less
  const raptor = addDino(w, 'raptor', 40 * TILE, 40 * TILE);
  const small = carcass.makeCarcass(w, raptor);
  assert.ok(small.carcass.max.meat < c.max.meat / 2);
  w.removeItem(small);
  w.removeDino(raptor);
  assert.equal(carcass.carcassStage(c), 'fresh');
  const crew = w.humans.filter((h) => !h.child).slice(0, 2);
  const cmd = tasks.inferCommand(w, crew, body.x, body.y - 10, pickNone);
  assert.equal(cmd.kind, 'butcher', `click on a body means harvest (got ${cmd.kind})`);
  tasks.issue(w, crew, cmd);
  const stages = new Set();
  const t = run(w, 240, () => { if (w.items.includes(body)) stages.add(carcass.carcassStage(c)); return !w.items.includes(body) && crew.every((h) => !h.carry); });
  assert.ok(t >= 0, `picked clean (stages seen: ${[...stages]})`);
  for (const s of ['fresh', 'partial', 'mostly']) assert.ok(stages.has(s), `went through ${s}`);
  const st = w.camp.stock;
  assert.ok(st.meat + st.cooked >= 4 && st.hide >= 3 && st.bone >= 5, `stock ${JSON.stringify({ meat: st.meat, hide: st.hide, bone: st.bone })}`);
  assert.ok(w.discoveries.has('butcher'));
});

test('predators eat the meat off a body; the rest spoils to bones if nobody harvests it', () => {
  const w = tribeWorld(43, ['tools']);
  const trike = addDino(w, 'trike', 110 * TILE, 56 * TILE, { hunger: 0, thirst: 0 });
  const body = carcass.makeCarcass(w, trike);
  w.removeDino(trike);
  const rex = addDino(w, 'trex', body.x + 300, body.y, { hunger: 0.9, thirst: 0 });
  run(w, 40, () => body.carcass.meat < body.carcass.max.meat * 0.5);
  assert.ok(body.carcass.meat < body.carcass.max.meat, `the T. rex ate (meat ${body.carcass.meat.toFixed(1)}, rex ${rex.state})`);
  body.t = 500;
  run(w, 5);
  assert.equal(carcass.carcassStage(body.carcass), 'bones', 'left out long enough, only bones');
});

test('hide → rainproof cloak at the hide rack; dressed workers keep working in the rain', () => {
  const w = tribeWorld(44, ['tools', 'axe']);
  const rack = w.colony.addBuilding(w, 'tannery', w.camp.x - 200, w.camp.y + 120);
  assert.ok(rack, 'hide rack placed');
  rack.built = 1;
  Object.assign(w.camp.stock, { hide: 10, tar: 3, bone: 2 });
  w.colony.queue.push('raincloak', 'raincloak');
  const t = run(w, 120, () => (w.colony.armory.raincloak ?? 0) + w.humans.filter((h) => h.gear.outfit === 'raincloak').length >= 2);
  assert.ok(t >= 0, `two cloaks made (armory ${JSON.stringify(w.colony.armory)}, queue ${w.colony.queue})`);
  assert.ok(w.discoveries.has('rainproof'));
  assert.ok(w.colony.known.has('raincloak'), 'recipe unlocked');
  // heavy rain: the cloaked worker keeps gathering, the others go inside
  w.weather.set(w, 'heavyRain');
  w.weather.rain = 0.85;
  run(w, 8);
  const dressed = w.humans.filter((h) => h.gear.outfit === 'raincloak');
  assert.ok(dressed.length >= 1, 'somebody is wearing one');
  run(w, 20);
  const inside = (h) => h.state === 'hide' || h.state === 'sleep';
  const undressed = w.humans.filter((h) => !h.child && !h.gear.outfit);
  assert.ok(dressed.every((h) => !inside(h)), `cloaked people still out (${dressed.map((h) => h.state)})`);
  assert.ok(undressed.filter(inside).length >= Math.min(1, undressed.length), `others sheltered (${undressed.map((h) => h.state)})`);
});

test('bone spikes outside the walls hurt + slow small attackers', () => {
  const w = tribeWorld(45, ['tools', 'spear', 'palisade']);
  const sp1 = w.colony.addBuilding(w, 'spikes', 110 * TILE, 56 * TILE);
  assert.ok(sp1);
  sp1.built = 1;
  w.colony.version++;
  const r = addDino(w, 'raptor', sp1.x - 80, sp1.y - 8, { raider: true, hunger: 0.9, thirst: 0 });
  w.tribe.raid = { phase: 'attack', t: 0, ids: [r.id], fromX: r.x, fromY: r.y, breached: false, label: 'test' };
  const h0 = r.health;
  run(w, 8, () => { r.state = 'raid'; r.tx = sp1.x + 200; r.ty = sp1.y - 8; r.think = 5; return !w.dinos.includes(r) || r.health < h0 - 0.2; });
  assert.ok(!w.dinos.includes(r) || r.health < h0 - 0.2, `raptor hurt by spikes (health ${r.health.toFixed(2)})`);
  assert.ok(sp1.hp < 10, 'the spikes wore down a bit');
  // the planner lines a walled camp with spikes
  w.tribe.planRing(w, 'palisade');
  for (const wl of w.tribe.walls) { wl.built = 1; wl.hp = 220; }
  assert.ok(w.tribe.planSpikes(w) > 8, 'a row of spikes planned outside the ring');
});

test('carcasses, hides, gear + kits survive save/load', () => {
  const w = tribeWorld(46, ['tools']);
  const body = carcass.makeCarcass(w, addDino(w, 'stego', 90 * TILE, 60 * TILE));
  body.carcass.meat = 2;
  w.camp.stock.hide = 7;
  w.camp.stock.bone = 4;
  w.humans[0].gear.outfit = 'furs';
  w.colony.kits.add('boneKnives');
  w.colony.known.add('cloak');
  const sp2 = w.colony.addBuilding(w, 'spikes', w.camp.x + 300, w.camp.y + 300);
  assert.ok(sp2);
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const b2 = w2.items.find((i) => i.kind === 'carcass');
  assert.ok(b2 && b2.carcass.meat === 2 && b2.carcass.max.bone === body.carcass.max.bone);
  assert.equal(w2.camp.stock.hide, 7);
  assert.equal(w2.camp.stock.bone, 4);
  assert.equal(w2.humans[0].gear.outfit, 'furs');
  assert.ok(w2.colony.kits.has('boneKnives') && w2.colony.known.has('cloak'));
  assert.ok(w2.colony.buildings.some((b) => b.kind === 'spikes'));
  run(w2, 3);
});

test('upgrading wood walls to stone gives the logs back', () => {
  const w = tribeWorld(47, ['tools', 'axe', 'palisade', 'stonewall']);
  const c = w.camp;
  const ty = Math.floor((c.y + 220) / TILE);
  const pieces = [];
  for (let tx = Math.floor(c.x / TILE) - 2; tx <= Math.floor(c.x / TILE) + 2; tx++) { const wl = w.tribe.addWall(w, tx, ty, 'palisade'); wl.built = 1; wl.hp = 220; pieces.push(wl); }
  for (const wl of pieces) { wl.upgrade = true; wl.have = 2; }
  const sticks0 = w.camp.stock.stick;
  const crew = w.humans.filter((h) => !h.child).slice(0, 3);
  tasks.issue(w, crew, tasks.inferCommand(w, crew, pieces[0].tx * TILE + 16, pieces[0].ty * TILE + 16, pickNone));
  run(w, 120, () => pieces.every((p) => p.kind === 'stone' && p.built >= 1));
  assert.ok(pieces.every((p) => p.kind === 'stone' && p.built >= 1), 'all stone now');
  assert.ok(w.camp.stock.stick >= sticks0 + pieces.length * 2 - 4, `sticks refunded (${sticks0} → ${w.camp.stock.stick})`);
});

test('putting out fires is a skill: no bucket brigade until the tribe learns it', () => {
  const w = tribeWorld(48, ['tools', 'fire']);
  w.weather.rain = 0;
  w.camp.stock.water = 0;
  const fire = () => { w.fire.ignite(w, Math.floor(w.camp.x / TILE) + 4, Math.floor(w.camp.y / TILE) + 4, 1); };
  w.fire.initFuel(w);
  fire();
  run(w, 6);
  assert.ok(!w.humans.some((h) => h.state === 'douse' || h.site === 'douse'), 'nobody fights it without the skill');
  const cmd = tasks.inferCommand(w, [w.humans[0]], w.camp.x + 4 * TILE, w.camp.y + 4 * TILE, pickNone);
  if (w.fire.active.size) assert.notEqual(cmd.kind, 'douse');
  w.camp.learned.add('firefighting');
  let fought = false;
  run(w, 60, () => { if (w.humans.some((h) => h.site === 'douse')) fought = true; return fought; });
  assert.ok(fought || w.fire.active.size === 0, 'with the skill they grab water');
});

test('chopped + burnt trees grow back', () => {
  const w = tribeWorld(49, ['tools']);
  const trees = w.plants.filter((p) => ['broadleaf', 'conifer'].includes(p.kind)).slice(0, 40);
  for (const p of trees.slice(0, 20)) { p.stump = true; p.food = 0; }
  for (const p of trees.slice(20)) { p.stump = true; p.burnt = 1; }
  run(w, 400);
  const back = trees.filter((p) => !p.stump).length;
  assert.ok(back >= 30, `most trees regrew (${back}/40)`);
  assert.ok(trees.filter((p) => !p.stump).some((p) => p.size > 0.5), 'and are growing up');
});

test('saves carry their time so the newest one always wins', () => {
  const w = tribeWorld(50, ['tools']);
  run(w, 10);
  const data = JSON.parse(JSON.stringify(w.serialize()));
  assert.ok(data.savedAt > 1.7e12 && data.elapsed > 9);
  const w2 = World.deserialize(data);
  assert.equal(w2.savedAt, data.savedAt);
  assert.ok(w2.elapsed > 9, 'play time carries on');
});

test('snow piles up in a blizzard, people warm up by the fire', () => {
  const w = tribeWorld(38, ['tools', 'fire']);
  w.camp.lightCampfire(w);
  w.camp.stock.stick = 20;
  w.weather.set(w, 'blizzard');
  run(w, 90);
  assert.ok(w.snow.total > 0.1, `snow on the ground (${w.snow.total.toFixed(2)})`);
  assert.ok(w.snow.at(w.camp.x + 300, w.camp.y + 200) > 0.3);
  const warm = w.humans.filter((h) => h.warmth > 0.3).length;
  assert.ok(warm >= w.humans.length - 1, `most people kept warm (${warm}/${w.humans.length})`);
});

test('v2 saves round-trip the colony; v1 saves still load', () => {
  const w = tribeWorld(39, ['tools', 'axe', 'palisade', 'smelting']);
  walledBox(w, 40, 40, 46, 46, { gate: true });
  const b = w.colony.addBuilding(w, 'storage', w.camp.x + 200, w.camp.y + 120);
  assert.ok(b, 'storage placed');
  b.built = 1;
  w.colony.armory.spear2 = 2;
  w.colony.queue.push('sword1');
  const tent = w.camp.addShelter(w, w.camp.x - 150, w.camp.y + 100, 'tent');
  tent.stage = 2; tent.tier = 3;
  w.humans[0].gear = { weapon: 'bow2', shield: 2 };
  w.humans[0].hp = 0.5;
  const data = JSON.parse(JSON.stringify(w.serialize()));
  assert.equal(data.v, 2);
  const w2 = World.deserialize(data);
  assert.equal(w2.colony.buildings.length, 1);
  assert.equal(w2.colony.armory.spear2, 2);
  assert.deepEqual(w2.colony.queue, ['sword1']);
  assert.equal(w2.colony.nodes.length, w.colony.nodes.length);
  assert.equal(w2.tribe.walls.filter((x) => x.part === 'gate').length, 1);
  assert.equal(w2.tribe.walls.filter((x) => x.part === 'stairs').length, 1);
  assert.equal(w2.shelters.find((s) => s.id === tent.id).tier, 3);
  assert.equal(w2.humans[0].gear.weapon, 'bow2');
  assert.equal(w2.humans[0].hp, 0.5);
  run(w2, 3);
  // an old v1 save (no colony fields) still loads and gets deposits
  const v1 = JSON.parse(JSON.stringify(data));
  v1.v = 1;
  delete v1.colony; delete v1.population;
  for (const s of v1.shelters) { delete s.plan; delete s.tier; delete s.hp; delete s.up; delete s.upHave; delete s.id; }
  for (const h of v1.humans) { delete h.hp; delete h.gear; delete h.home; delete h.family; delete h.warmth; delete h.stranger; }
  v1.tribe.walls = v1.tribe.walls.map((r) => r.slice(0, 6));
  v1.tribe.towers = v1.tribe.towers.map((r) => r.slice(0, 4));
  const w3 = World.deserialize(v1);
  assert.ok(w3.colony.nodes.length > 10, 'deposits generated for old worlds');
  assert.ok(w3.shelters.every((s) => s.plan === 'hut' && s.tier === 2));
  run(w3, 3);
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
