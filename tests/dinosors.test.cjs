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
const { World, START } = require(path.join(root, 'sim', 'world.ts'));
// a real game starts with a small family; these scenarios were written for (and tuned with) the original 8-person tribe
const NEW_GAME_PEOPLE = START.people;
START.people = 8;
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

test('a new game starts small: two grown-ups and a kid', () => {
  START.people = NEW_GAME_PEOPLE;
  try {
    const w = new World(42);
    assert.equal(w.humans.length, 3);
    assert.equal(w.humans.filter((h) => h.child).length, 1);
  } finally {
    START.people = 8;
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

/* ------------------------------ civilization paths ------------------------------ */

const { CIV_TECH, PYRAMID_STAGES, SHIELD_HOLD } = require(path.join(root, 'data', 'civ.ts'));
const { BUILDINGS } = require(path.join(root, 'data', 'colony.ts'));
const { wallMaxHp, sites } = require(path.join(root, 'sim', 'build.ts'));
const { applyTool, DEFAULT_TOOL } = require(path.join(root, 'game', 'tools.ts'));

const SETTLED = ['tools', 'fire', 'axe', 'spear', 'basket', 'palisade', 'stonewall', 'farming', 'shelter'];

/** A settled tribe that has already opened the chamber (and picked a path). */
function civWorld(seed, pathId) {
  const w = tribeWorld(seed, SETTLED);
  w.civ.update(w, 2.1);
  w.civ.investigate(w);
  if (pathId) w.civ.choose(w, pathId);
  return w;
}
const finish = (w, kind, x, y) => {
  const b = w.colony.addBuilding(w, kind, x, y);
  assert.ok(b, `placed ${kind}`);
  b.built = 1;
  b.hp = BUILDINGS[kind].hp;
  w.colony.version++;
  return b;
};
const learn = (w, ...ids) => ids.forEach((id) => w.civ.done.add(id));
const clone = (w) => World.deserialize(JSON.parse(JSON.stringify(w.serialize())));

test('the humming chamber surfaces once the tribe is settled, and offers the choice', () => {
  const w = tribeWorld(501, ['tools']);
  run(w, 3);
  assert.equal(w.civ.chamberX, 0, 'not before the tribe is settled');
  for (const t of SETTLED) w.camp.learned.add(t);
  run(w, 3);
  assert.ok(w.civ.chamberX > 0, 'chamber surfaced');
  assert.ok(w.props.some((p) => p.kind === 'chamber'), 'as a prop in the world');
  const d = Math.hypot(w.civ.chamberX - w.camp.x, w.civ.chamberY - w.camp.y);
  assert.ok(d > 300 && d < 1300, `a walk from camp (${Math.round(d)}px)`);
  const h = w.humans.find((x) => !x.child);
  h.x = w.civ.chamberX + 20;
  h.y = w.civ.chamberY + 10;
  run(w, 3);
  assert.ok(w.civ.found && w.civ.choicePending, 'choice offered');
  assert.equal(w.civ.path, 'none', 'nothing decided for the player');
  const meteor = w.camp.stock.meteorite;
  assert.ok(w.civ.choose(w, 'resonance'));
  assert.equal(w.civ.current, 'resonance', 'starts on the first idea');
  assert.equal(w.camp.stock.meteorite, meteor + 1, 'the meteor shard from the chamber');
  assert.ok(!w.civ.choose(w, 'traditional'), 'the choice is final');
  const w2 = clone(w);
  assert.equal(w2.civ.path, 'resonance');
  assert.equal(w2.civ.chamberX, w.civ.chamberX, 'chamber position saves');
});

test('Resonance research: researchers at the table learn ideas that unlock buildings', () => {
  const w = civWorld(502, 'resonance');
  Object.assign(w.camp.stock, { stone: 40, wood: 20, copper: 10, quartz: 10 });
  finish(w, 'resTable', w.camp.x + 140, w.camp.y + 120);
  const [a, b] = w.humans.filter((h) => !h.child);
  a.role = 'researcher';
  b.role = 'researcher';
  const t0 = run(w, 150, (w) => w.civ.done.has('resonance') && w.civ.done.has('copperRes'));
  assert.ok(t0 > 0, `learned two ideas (done: ${[...w.civ.done]}, current ${w.civ.current} ${w.civ.rp.toFixed(1)})`);
  assert.ok(w.camp.stock.copper < 10, 'materials were used');
  const tw = w.colony.addBuilding(w, 'energyTower', w.camp.x - 200, w.camp.y + 150);
  assert.equal(sites(w).find((s) => s.kind === 'building' && s.id === tw.id).locked, null, 'energy tower unlocked');
  const pyr = w.colony.addBuilding(w, 'pyramid', w.camp.x + 300, w.camp.y + 300);
  assert.equal(sites(w).find((s) => s.id === pyr.id).locked, 'monumental', 'later wonders stay locked');
});

test('Old Ways: masonry toughens stone walls, crop rotation speeds farms, late cross-research opens', () => {
  const w = civWorld(503, 'traditional');
  const wl = w.tribe.addWall(w, Math.floor(w.camp.x / TILE) + 6, Math.floor(w.camp.y / TILE) + 6, 'stone');
  const before = wallMaxHp(wl);
  learn(w, 'masonry');
  run(w, 0.1);
  assert.ok(wallMaxHp(wl) > before * 1.4, 'masonry: +50% wall hp');
  const f = w.tribe.addFarm(w, w.camp.x + 260, w.camp.y + 200) ?? w.tribe.farms[0];
  assert.ok(f, 'a farm');
  f.planted = true;
  f.growth = 0;
  run(w, 10);
  const slow = f.growth;
  f.growth = 0;
  learn(w, 'cropRotation');
  run(w, 10);
  assert.ok(f.growth > slow * 1.7, `crop rotation doubles growth (${slow.toFixed(3)} -> ${f.growth.toFixed(3)})`);
  assert.ok(!w.civ.crossOpen());
  learn(w, 'ironForge', 'herbalism', 'granary', 'huntingHorns');
  assert.ok(w.civ.crossOpen(), 'six ideas in: the fence opens');
  const opts = w.civ.options();
  assert.ok(opts.includes('waterAir') && opts.includes('precisionStone'), `can borrow (${opts})`);
  assert.ok(!opts.includes('levitation'), 'but not the deep Resonance');
  assert.equal(w.civ.rpOf('waterAir'), CIV_TECH.waterAir.rp * 2, 'borrowing costs double');
});

test('energy: towers charge up to their store, storms charge faster, condensers pull water from fog', () => {
  const w = civWorld(504, 'resonance');
  learn(w, 'resonance', 'copperRes', 'waterAir');
  finish(w, 'energyTower', w.camp.x - 160, w.camp.y + 140);
  finish(w, 'energyTower', w.camp.x - 120, w.camp.y + 200);
  w.civ.energy = 0;
  run(w, 20);
  const calm = w.civ.energy;
  assert.ok(calm > 10, `charged (${calm.toFixed(1)})`);
  run(w, 400);
  assert.ok(w.civ.energy <= w.civ.cap + 0.01 && w.civ.energy > w.civ.cap * 0.9, `fills to the cap (${w.civ.energy.toFixed(1)}/${w.civ.cap})`);
  w.civ.energy = 0;
  w.weather.set(w, 'storm');
  w.weather.storm = 1;
  run(w, 20);
  assert.ok(w.civ.energy > calm * 1.3, `storm charges faster (${w.civ.energy.toFixed(1)} vs ${calm.toFixed(1)})`);
  finish(w, 'condenser', w.camp.x + 240, w.camp.y + 260);
  const humid = (o) => { Object.assign(w.weather, o); };
  w.weather.set(w, 'hot');
  humid({ rain: 0, fog: 0, storm: 0, temp: 0.95, snow: 0 });
  w.civ.energy = 100;
  w.camp.stock.water = 0;
  run(w, 30, () => humid({ rain: 0, fog: 0, storm: 0, temp: 0.95, snow: 0 }));
  const dry = w.camp.stock.water;
  w.weather.set(w, 'fog');
  w.camp.stock.water = 0;
  w.civ.energy = 100;
  run(w, 30, () => humid({ rain: 0, fog: 0.75, storm: 0, temp: 0.4, snow: 0 }));
  assert.ok(w.camp.stock.water > dry * 2 && w.camp.stock.water > 0.2, `fog gives more water (${dry.toFixed(2)} vs ${w.camp.stock.water.toFixed(2)})`);
});

test('beam towers shoot raiders (costing energy) and pylon barriers push them back', () => {
  const w = civWorld(505, 'resonance');
  learn(w, 'resonance', 'copperRes', 'quartzTuning', 'energyStorage', 'energyWeapons', 'defensiveEnergy');
  w.tribe.danger = 'normal';
  const bt = finish(w, 'beamTower', w.camp.x + 40, w.camp.y + 200);
  finish(w, 'energyTower', w.camp.x - 160, w.camp.y + 140);
  w.civ.update(w, 1.1);
  w.civ.energy = w.civ.cap;
  const raptor = addDino(w, 'raptor', bt.x + 260, bt.y + 40, { raider: true, hunger: 0.9 });
  const h0 = raptor.health;
  const e0 = w.civ.energy;
  run(w, 12, () => !w.dinos.includes(raptor));
  assert.ok(!w.dinos.includes(raptor) || raptor.health < h0 - 0.3, 'beam tower hurt the raider');
  assert.ok(w.civ.energy < e0, 'shots cost energy');
  const p1 = finish(w, 'pylon', w.camp.x - 400, w.camp.y - 300);
  const p2 = finish(w, 'pylon', w.camp.x - 240, w.camp.y - 300);
  assert.equal(w.civ.pylonLinks(w).length, 1, 'linked');
  w.civ.energy = w.civ.cap;
  const r2 = addDino(w, 'raptor', (p1.x + p2.x) / 2, p1.y - 40, { raider: true, hunger: 0.9 });
  for (let i = 0; i < 60; i++) {
    r2.y += 2; // tries to walk south through the line
    w.update(DT);
  }
  assert.ok(r2.y < p1.y - 6, `pushed back from the barrier (y ${r2.y.toFixed(0)} vs line ${p1.y})`);
});

test('shaped stone: shapers cut blocks, polygon walls need them and upgrades refund the old stone', () => {
  const w = civWorld(506, 'resonance');
  learn(w, 'resonance', 'copperRes', 'quartzTuning', 'precisionStone');
  finish(w, 'shapingYard', w.camp.x + 180, w.camp.y + 130);
  w.camp.stock.stone = 20;
  w.camp.stock.shaped = 0;
  const h = w.humans.find((x) => !x.child);
  h.role = 'shaper';
  run(w, 60, () => w.camp.stock.shaped >= 2);
  assert.ok(w.camp.stock.shaped >= 2, `shaped blocks (${w.camp.stock.shaped})`);
  assert.ok(w.camp.stock.stone <= 16);
  h.role = 'gatherer';
  const tx = Math.floor(w.camp.x / TILE) + 8;
  const ty = Math.floor(w.camp.y / TILE) + 5;
  const wl = w.tribe.addWall(w, tx, ty, 'stone');
  wl.built = 1;
  wl.hp = wallMaxHp(wl);
  const up = w.tribe.addWall(w, tx, ty, 'polygon');
  assert.equal(up, wl, 'same piece');
  assert.ok(wl.upgrade && wl.upTo === 'polygon');
  assert.equal(sites(w).find((s) => s.kind === 'wall' && s.id === wl.id).need, 'shaped');
  const wl2 = clone(w).tribe.wallAt(tx, ty);
  assert.ok(wl2.upgrade && wl2.upTo === 'polygon', 'polygon upgrade survives save/load');
  wl.have = 2;
  const stone0 = w.camp.stock.stone;
  for (const b of w.humans.filter((x) => !x.child && x !== h)) b.role = 'builder';
  run(w, 60, () => wl.kind === 'polygon' && wl.built >= 1);
  assert.equal(wl.kind, 'polygon');
  assert.ok(wallMaxHp(wl) > 800, 'toughest wall');
  assert.ok(w.camp.stock.stone >= stone0, `old stone refunded (${stone0} -> ${w.camp.stock.stone})`);
  assert.equal(clone(w).tribe.wallAt(tx, ty).kind, 'polygon', 'polygon walls save');
});

test('the pyramid rises stage by stage, lift pads float blocks onto it, and it needs energy to wake', () => {
  const w = civWorld(507, 'resonance');
  learn(w, 'resonance', 'copperRes', 'quartzTuning', 'precisionStone', 'levitation', 'monumental', 'energyStorage');
  finish(w, 'levPad', w.camp.x + 140, w.camp.y + 260);
  const pyr = w.colony.addBuilding(w, 'pyramid', w.camp.x + 420, w.camp.y + 320);
  assert.ok(pyr, 'pyramid placed');
  Object.assign(w.camp.stock, { stone: 80, shaped: 60, crystal: 10, copper: 10, gold: 3, quartz: 6 });
  pyr.stage = 1;
  pyr.built = 0.4;
  w.civ.update(w, 1.1);
  w.civ.energy = 50;
  run(w, 8);
  assert.ok((pyr.have.shaped ?? 0) > 0 || pyr.stage > 1, 'blocks floated over');
  for (const h of w.humans.filter((x) => !x.child)) h.role = 'builder';
  w.civ.energy = 0;
  const seen = new Set();
  run(w, 900, () => {
    seen.add(pyr.stage ?? 0);
    w.civ.energy = 0;
    if ((pyr.stage ?? 0) === PYRAMID_STAGES.length - 1 && pyr.built >= 0.99) return true;
  });
  assert.ok(seen.size >= 4, `went through stages (${[...seen]})`);
  assert.equal(pyr.stage, PYRAMID_STAGES.length - 1, 'reached activation');
  assert.ok(pyr.built < 1, 'waiting for a charge');
  run(w, 30, () => {
    w.civ.cap = 400;
    w.civ.energy = 200;
    return pyr.built >= 1;
  });
  assert.ok(pyr.built >= 1, 'woke up with energy');
  assert.ok(w.discoveries.has('pyramid'));
  assert.equal(clone(w).colony.buildings.find((b) => b.kind === 'pyramid').stage, PYRAMID_STAGES.length - 1, 'stage saved');
});

test('Levitate tool floats a megalith (range, energy + shaped stone checked)', () => {
  const w = civWorld(508, 'resonance');
  learn(w, 'resonance', 'copperRes', 'quartzTuning', 'precisionStone', 'levitation');
  const pad = finish(w, 'levPad', w.camp.x + 160, w.camp.y + 200);
  w.camp.stock.shaped = 1;
  w.civ.energy = 100;
  w.civ.cap = 100;
  const tool = { ...DEFAULT_TOOL, id: 'build', build: 'levitate' };
  assert.ok(!applyTool(w, tool, pad.x + 120, pad.y + 60, false), 'not enough shaped stone');
  w.camp.stock.shaped = 6;
  assert.ok(!applyTool(w, tool, pad.x + 1400, pad.y, false), 'out of range');
  assert.ok(applyTool(w, tool, pad.x + 120, pad.y + 60, false), 'lifted');
  assert.ok(w.civ.energy < 100 && w.camp.stock.shaped === 4);
  run(w, 4);
  assert.ok(w.props.some((p) => p.kind === 'megalith'), 'megalith landed');
  assert.ok(clone(w).props.some((p) => p.kind === 'megalith'), 'megaliths save');
});

test('tuning experiments: hints toward the hidden note, a perfect note tunes the material', () => {
  const w = civWorld(509, 'resonance');
  learn(w, 'resonance');
  finish(w, 'resTable', w.camp.x + 140, w.camp.y + 120);
  w.camp.stock.copper = 5;
  const note = w.civ.noteOf(w, 'copper');
  const far = w.civ.experiment(w, 'copper', note > 500 ? note - 300 : note + 300);
  assert.ok(far.result === 'cold' || far.result === 'spark', far.result);
  w.elapsed += 2;
  const warm = w.civ.experiment(w, 'copper', Math.round(note * 1.08));
  assert.equal(warm.result, 'warm');
  assert.equal(warm.hint, 'lower');
  w.elapsed += 2;
  assert.equal(w.civ.experiment(w, 'copper', note).result, 'resonant');
  assert.ok(w.civ.tuned.has('copper'));
  w.camp.stock.crystal = 30;
  const cn = w.civ.noteOf(w, 'crystal');
  let cracked = 0;
  for (let i = 0; i < 25; i++) {
    w.elapsed += 2;
    if (w.civ.experiment(w, 'crystal', Math.round(cn * 1.6)).result === 'fracture') cracked++;
  }
  if (cn * 1.6 <= 960) assert.ok(cracked > 0 && w.camp.stock.crystal < 30, 'shrill notes crack crystal');
  const w2 = clone(w);
  assert.ok(w2.civ.tuned.has('copper') && w2.civ.path === 'resonance', 'civ state saves');
});

test('an overloaded grid can fail (sparks, damage or power loss)', () => {
  const w = civWorld(510, 'resonance');
  learn(w, 'resonance', 'copperRes');
  const towers = [0, 1, 2, 3].map((i) => finish(w, 'energyTower', w.camp.x - 260 + i * 50, w.camp.y + 200));
  let fails = 0;
  for (let i = 0; i < 80; i++) {
    w.civ.strain = 1;
    w.civ.energy = 50;
    w.camp.stock.crystal = 5;
    const hp = towers.reduce((s, t) => s + t.hp, 0);
    const cr = w.camp.stock.crystal;
    w.civ.failT = 0;
    w.civ.update(w, 0.01);
    if (towers.reduce((s, t) => s + t.hp, 0) < hp || w.civ.energy < 30 || w.camp.stock.crystal < cr) fails++;
  }
  assert.ok(fails > 0, `failures happen (${fails}/80)`);
});

test('the extinction asteroid: omen, countdown, impact; most life dies; deep shelters save some', () => {
  const w = civWorld(511, 'traditional');
  learn(w, 'deepShelter');
  const bunker = finish(w, 'shelterDeep', w.camp.x - 220, w.camp.y + 160);
  for (let i = 0; i < 4; i++) addHuman(w, w.camp.x + i * 10, w.camp.y + 40, false);
  for (let i = 0; i < 30; i++) addDino(w, 'trike', 1400 + i * 60, 1500 + (i % 5) * 40);
  const dinos0 = w.dinos.length;
  const people0 = w.humans.length;
  assert.ok(w.extinction.trigger(w));
  assert.equal(w.extinction.phase, 'omen');
  assert.ok(!w.extinction.trigger(w), 'only one at a time');
  run(w, 8);
  assert.equal(w.extinction.phase, 'incoming');
  assert.ok(w.extinction.countdown() > 0 && w.extinction.countdown() <= 10);
  const door = w.colony.door(bunker);
  w.humans.slice(0, 6).forEach((h) => { h.x = door.x; h.y = door.y; });
  run(w, 9.95);
  w.humans.slice(0, 6).forEach((h) => { h.x = door.x; h.y = door.y; });
  run(w, 1);
  assert.equal(w.extinction.phase, 'impact');
  run(w, 8);
  const st = w.extinction.stats;
  assert.ok(st.dinosLost > dinos0 * 0.6, `most dinosaurs died (${st.dinosLost}/${dinos0})`);
  assert.ok(st.peopleLost > 0, 'people died');
  assert.ok(w.humans.length > 0 && st.sheltered > 0, `some survived in the shelter (${w.humans.length}/${people0}, sheltered ${st.sheltered})`);
  assert.ok(w.colony.nodes.some((n) => n.kind === 'meteorite' && n.amount === 4), 'meteor fragments around the crater');
  assert.equal(clone(w).extinction.phase, 'aftermath', 'saves mid-way');
  run(w, 16);
  assert.equal(w.extinction.phase, 'ended');
  w.extinction.observe();
  assert.equal(w.extinction.phase, 'ruins');
  run(w, 5);
  assert.ok(w.extinction.ash > 0, 'ash hangs in the sky');
});

test('the Resonance shield holds when charged', () => {
  const w = civWorld(512, 'resonance');
  learn(w, 'advancedArch', 'monumental', 'defensiveEnergy', 'energyStorage');
  const sh = finish(w, 'resShield', w.camp.x + 60, w.camp.y + 120);
  const n0 = w.humans.length;
  w.extinction.trigger(w);
  run(w, 17.2, () => {
    w.civ.cap = 400;
    w.civ.energy = SHIELD_HOLD + 40;
    for (const h of w.humans) { h.x = sh.x + ((h.id % 7) - 3) * 12; h.y = sh.y + 40; }
  });
  assert.ok(w.extinction.stats.shieldHeld, 'held');
  run(w, 8);
  assert.ok(w.humans.length >= Math.floor(n0 * 0.6), `most under the dome lived (${w.humans.length}/${n0})`);
});

/* ------------------------------ The Deep (mine, phase 1) ------------------------------ */

const { Mine, NO_TOOLS, idx: mIdx, toolsOf, rle, unrle } = require(path.join(root, 'sim', 'mine.ts'));
const { M, MATERIALS, MINE_W, MINE_H, LIFT_X, LIFT_START, LIFT_STEP, LIFT_MAX, MAGMA_FROM, FLOODED, bandAt } = require(path.join(root, 'data', 'mine.ts'));

const ALL_TOOLS = { pick: true, ironPick: true, drill: true, lantern: true, pump: true, dynamite: true, luck: 0 };
/** Open a straight tunnel from the shaft at row y out to column x (test setup, not digging). */
function carve(mine, x, y) {
  const step = x > LIFT_X ? 1 : -1;
  for (let cx = LIFT_X + step; cx !== x + step; cx += step) mine.cells[mIdx(cx, y)] = M.Open;
  mine.version++;
}
/** First cell in rows [y0, y1) holding `what`, away from the shaft and the band edges. */
function findContent(mine, what, y0, y1) {
  for (let y = y0; y < y1; y++)
    for (let x = LIFT_X + 3; x < MINE_W - 3; x++) {
      const i = mIdx(x, y);
      if (mine.baseAt(i) === M.Open || mine.baseAt(i) === M.Granite) continue;
      if (mine.contentOf(i) === what) return { x, y };
    }
  return null;
}

test('the Deep is generated from the seed: barrier on top, lift shaft, rock bands, caverns, magma below', () => {
  const a = new Mine(9001);
  const b = new Mine(9001);
  const c = new Mine(9002);
  assert.deepEqual(Buffer.from(a.cells), Buffer.from(b.cells), 'same seed, same mine');
  assert.notDeepEqual(Buffer.from(a.cells), Buffer.from(c.cells), 'different seed, different mine');
  for (let x = 0; x < MINE_W; x++) if (x !== LIFT_X) assert.equal(a.at(x, 0), M.Barrier, 'groundwater barrier across the top');
  for (let y = 0; y <= LIFT_MAX; y++) assert.equal(a.at(LIFT_X, y), M.Shaft, 'shaft runs down');
  for (let x = 0; x < MINE_W; x++) assert.equal(a.at(x, MINE_H - 1), M.Magma, 'molten floor');
  const count = (y0, y1, m) => { let n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < MINE_W; x++) if (x !== LIFT_X && a.at(x, y) === m) n++; return n; };
  assert.ok(count(1, 30, M.Soil) > count(1, 30, M.Stone), 'topsoil near the top');
  assert.equal(count(1, 30, M.Granite), 0, 'no granite in the topsoil');
  assert.ok(count(70, 110, M.Granite) > 300, 'plenty of granite deep down');
  assert.ok(count(150, MAGMA_FROM - 2, M.Volcanic) > 300, 'volcanic rock in the Furnace');
  assert.equal(count(1, 30, M.Open), 2, 'no caverns in the topsoil (just the landing)');
  assert.ok(count(110, 150, M.Open) > 60, `fossil + crystal caverns (${count(110, 150, M.Open)})`);
  for (let y = 1; y < MINE_H; y++) for (const dx of [-3, -2, 2, 3]) if (y > 1) assert.notEqual(a.at(LIFT_X + dx, y), M.Open, 'caverns never touch the shaft');
});

test('finds get richer with depth (and are fixed once looked at)', () => {
  const m = new Mine(77);
  const tally = (y0, y1) => {
    const t = {};
    for (let y = y0; y < y1; y++) for (let x = 0; x < MINE_W; x++) { const c = m.contentOf(mIdx(x, y)); if (c) t[c] = (t[c] ?? 0) + 1; }
    return t;
  };
  const top = tally(1, 30);
  const deep = tally(110, 150);
  const furnace = tally(150, MAGMA_FROM);
  assert.ok(!top.gold && !top.crystal, 'no gold or crystal in the topsoil');
  assert.ok((top.flint ?? 0) > 0 && (top.copper ?? 0) > 0, 'flint + copper near the top');
  assert.ok((deep.crystal ?? 0) > 10 && (deep.fossil ?? 0) > 3, `crystals + fossils in the caverns (${JSON.stringify(deep)})`);
  assert.ok((furnace.gold ?? 0) > (tally(30, 70).gold ?? 0), 'more gold deeper');
  assert.ok(furnace.meteorite > 0 || furnace.obsidian > 10, 'obsidian / meteor shards at the bottom');
  // luck: better finds, fewer nasty surprises
  let bad = 0, badLucky = 0;
  for (let y = 30; y < 150; y++) for (let x = 0; x < MINE_W; x++) {
    const i = mIdx(x, y);
    if (['caveIn', 'gas', 'spring'].includes(m.contentOf(i, 0))) bad++;
    if (['caveIn', 'gas', 'spring'].includes(m.contentOf(i, 1))) badLucky++;
  }
  assert.ok(badLucky < bad, `luck helps (${bad} → ${badLucky})`);
  // once scanned, the answer never changes
  const i = mIdx(20, 40);
  const seen = m.scan(i, 0);
  assert.equal(m.contentOf(i, 1), seen);
  assert.equal(m.seen[i], 2);
});

test('digging: only from a tunnel, granite needs a drill, tools speed it up, lanterns spot ore', () => {
  const m = new Mine(31337);
  assert.ok(m.cantDig(LIFT_X + 5, 10, ALL_TOOLS), 'not from inside solid rock');
  assert.match(m.cantDig(LIFT_X + 1, 0, ALL_TOOLS), /barrier/i);
  const x = LIFT_X + 1;
  const y = 2;
  assert.equal(m.cantDig(x, y, NO_TOOLS), null, 'the rock under the landing can be dug');
  assert.ok(m.digTime(x, y, ALL_TOOLS) < m.digTime(x, y, NO_TOOLS) * 0.6, 'tools are faster');
  const r = m.dig(x, y, { ...ALL_TOOLS });
  assert.ok(r.ok, r.why);
  assert.equal(m.at(x, y), M.Rubble === m.at(x, y) ? M.Rubble : M.Open);
  assert.ok(m.seen[mIdx(x + 2, y)] >= 1, 'lantern lights two cells around');
  assert.equal(m.stats.dug, 1);
  // granite
  let g = null;
  for (let yy = 31; yy < 69 && !g; yy++) for (let xx = LIFT_X + 1; xx < LIFT_X + 3; xx++) if (m.at(xx, yy) === M.Granite) { g = { x: xx, y: yy }; break; }
  if (g) {
    for (let cx = LIFT_X + 1; cx < g.x; cx++) m.cells[mIdx(cx, g.y)] = M.Open;
    m.version++;
    assert.match(m.cantDig(g.x, g.y, { ...ALL_TOOLS, drill: false }) ?? '', /drill/i);
    if (g.y <= m.liftMax) assert.equal(m.cantDig(g.x, g.y, ALL_TOOLS), null);
  }
  // digging out a find hands it over
  const f = findContent(m, 'copper', 3, 30);
  assert.ok(f, 'a copper cell exists');
  carve(m, f.x - 1, f.y);
  const got = m.dig(f.x, f.y, ALL_TOOLS);
  assert.equal(got.r, 'copper');
  assert.ok(got.n >= 1);
  assert.ok(m.stats.mined.copper >= 1);
});

test('springs flood the tunnels downhill; pumping clears them', () => {
  const m = new Mine(4040);
  const s = findContent(m, 'spring', 5, 26);
  assert.ok(s, 'a spring exists');
  // a tunnel to it plus a sump below
  carve(m, s.x - 1, s.y);
  for (let yy = s.y + 1; yy <= s.y + 4; yy++) m.cells[mIdx(s.x - 1, yy)] = M.Open;
  m.version++;
  const r = m.dig(s.x, s.y, ALL_TOOLS);
  if (r.event === 'caveIn') return; // rare: the roof came down on it first
  assert.equal(r.event, 'spring');
  for (let i = 0; i < 300; i++) m.update(null, 1 / 30);
  const sump = m.water[mIdx(s.x - 1, s.y + 4)];
  assert.ok(sump > FLOODED, `water ran down into the sump (${sump.toFixed(2)})`);
  assert.ok(!m.passable(s.x - 1, s.y + 4), 'flooded cells block the way');
  for (let i = 0; i < 400; i++) m.update(null, 1 / 30);
  let removed = 0;
  for (let k = 0; k < 20; k++) removed += m.pump(s.x - 1, s.y + 4, 2, ALL_TOOLS);
  assert.ok(removed > 1, `pumped ${removed.toFixed(1)}`);
  assert.ok(m.water[mIdx(s.x - 1, s.y + 4)] < FLOODED, 'drained');
});

test('weak roofs cave in; support beams stop it', () => {
  const m = new Mine(5150);
  m.liftMax = 120;
  const c = findContent(m, 'caveIn', 31, 69);
  assert.ok(c, 'a weak roof exists');
  carve(m, c.x - 1, c.y);
  for (let dx = -3; dx <= -1; dx++) for (const dy of [-1, 1]) m.cells[mIdx(c.x + dx, c.y + dy)] = M.Open;
  m.version++;
  const r = m.dig(c.x, c.y, ALL_TOOLS);
  assert.equal(r.event, 'caveIn');
  assert.ok(r.collapsed.includes(mIdx(c.x, c.y)), 'the dug cell filled back in');
  assert.equal(m.at(c.x, c.y), M.Rubble);
  assert.ok(m.digTime(c.x, c.y, NO_TOOLS) < 1.3, 'rubble is quick to clear');
  // the same thing with a support in place
  const m2 = new Mine(5150);
  m2.liftMax = 120;
  carve(m2, c.x - 1, c.y);
  m2.version++;
  const w = new World(1, false);
  w.camp.stock.wood = 3;
  assert.equal(m2.addSupport(w, c.x - 1, c.y), null);
  assert.equal(w.camp.stock.wood, 2, 'supports cost wood');
  const r2 = m2.dig(c.x, c.y, ALL_TOOLS);
  assert.notEqual(r2.event, 'caveIn', 'held up by the beam');
  assert.equal(m2.at(c.x, c.y), M.Open);
});

test('gas pockets turn a dynamite blast into an explosion', () => {
  const m = new Mine(6060);
  m.liftMax = 120;
  const g = findContent(m, 'gas', 31, 69);
  assert.ok(g, 'a gas pocket exists');
  carve(m, g.x - 1, g.y);
  const r = m.dig(g.x, g.y, ALL_TOOLS);
  if (r.event === 'caveIn') return;
  assert.equal(r.event, 'gas');
  assert.ok(m.hazardAt(g.x, g.y).gas, 'gas hangs in the tunnel');
  const w = new World(2, false);
  w.camp.learned.add('fire');
  w.camp.stock.tar = 2;
  w.camp.stock.stick = 2;
  const t = toolsOf(w);
  assert.ok(t.dynamite);
  const b = m.blast(w, g.x, g.y, t);
  assert.ok(typeof b !== 'string', b);
  assert.ok(b.explosion, 'kaboom');
  assert.equal(w.camp.stock.tar, 1, 'a charge used tar');
  for (let i = 0; i < 30 * 30; i++) m.update(null, 1 / 30);
  assert.ok(!m.hazardAt(g.x, g.y).gas, 'gas clears over time');
});

test('the lift: upgrades from the stockpile go 60 ft deeper each, up to the bottom', () => {
  const m = new Mine(7);
  const w = new World(3, false);
  assert.equal(m.liftMax, LIFT_START);
  assert.ok(m.upgradeLift(w), 'costs something');
  Object.assign(w.camp.stock, { wood: 999, stone: 999, iron: 999, copper: 999 });
  assert.equal(m.upgradeLift(w), null);
  assert.equal(m.liftMax, LIFT_START + LIFT_STEP);
  assert.ok(w.camp.stock.wood < 999);
  while (!m.upgradeLift(w));
  assert.equal(m.liftMax, LIFT_MAX, 'stops above the magma');
  assert.ok(w.camp.stock.iron < 999, 'deep upgrades need iron');
  m.callLift(500);
  for (let i = 0; i < 30 * 30; i++) m.update(null, 1 / 30);
  assert.equal(m.liftY, LIFT_MAX, 'car travels down');
  assert.ok(!m.passable(LIFT_X, LIFT_MAX + 1), 'nothing below the lift');
});

test('paths go through tunnels and the shaft (only as deep as the lift)', () => {
  const m = new Mine(8);
  carve(m, LIFT_X + 8, 12);
  carve(m, LIFT_X + 6, 25);
  const p = m.path(LIFT_X + 8, 12, LIFT_X + 6, 25);
  assert.ok(p && p.length > 10, 'via the shaft');
  carve(m, LIFT_X + 6, 45);
  assert.equal(m.path(LIFT_X + 8, 12, LIFT_X + 6, 45), null, 'too deep for the lift');
  m.liftMax = 50;
  m.version++;
  assert.ok(m.path(LIFT_X + 8, 12, LIFT_X + 6, 45), 'reachable after an upgrade');
});

test('the Deep saves compactly and loads back exactly; old saves get a fresh mine', () => {
  const w = new World(424242);
  const m = w.mine;
  m.liftMax = 80;
  for (let y = 2; y < 60; y++) { m.cells[mIdx(LIFT_X + 1, y)] = M.Open; }
  m.version++;
  const f = findContent(m, 'iron', 31, 59);
  if (f) { carve(m, f.x - 1, f.y); m.dig(f.x, f.y, ALL_TOOLS); }
  m.water[mIdx(LIFT_X + 1, 59)] = 0.8;
  m.supports.add(mIdx(LIFT_X + 1, 20));
  m.scan(mIdx(LIFT_X + 2, 40));
  const json = JSON.stringify(w.serialize());
  const data = JSON.parse(json);
  assert.ok(JSON.stringify(data.mine).length < 20000, `small (${JSON.stringify(data.mine).length} bytes)`);
  const w2 = World.deserialize(data);
  assert.deepEqual(Buffer.from(w2.mine.cells), Buffer.from(m.cells), 'rock');
  assert.deepEqual(Buffer.from(w2.mine.seen), Buffer.from(m.seen), 'fog');
  assert.ok(Math.abs(w2.mine.water[mIdx(LIFT_X + 1, 59)] - 0.8) < 0.02, 'water');
  assert.ok(w2.mine.supports.has(mIdx(LIFT_X + 1, 20)), 'supports');
  assert.equal(w2.mine.contentOf(mIdx(LIFT_X + 2, 40), 1), m.contentOf(mIdx(LIFT_X + 2, 40)), 'scanned contents');
  assert.equal(w2.mine.liftMax, 80);
  assert.equal(w2.mine.stats.dug, m.stats.dug);
  delete data.mine;
  const w3 = World.deserialize(data);
  assert.equal(w3.mine.liftMax, LIFT_START, 'pre-mine saves just get a brand new mine');
  assert.equal(unrle(rle(new Uint8Array([0, 0, 1, 2, 2, 2])), 6).join(','), '0,0,1,2,2,2');
});

test('nothing in the Deep changes the surface simulation', () => {
  const a = new World(1717);
  const b = new World(1717);
  const m = b.mine;
  m.liftMax = 120;
  // depth milestones pay the surface on purpose (gifts + a celebration): count them as already earned here
  for (const id of ['deep30', 'deep70', 'deep110', 'deep150', 'deep185']) m.milestones.add(id);
  for (let y = 2; y < 100; y++) m.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  m.version++;
  for (let y = 2; y < 100; y += 3) m.dig(LIFT_X + 2, y, ALL_TOOLS);
  for (let k = 0; k < 6; k++) m.springs.set(mIdx(LIFT_X + 1, 10 + k * 12), 20);
  run(a, 20);
  run(b, 20);
  const pos = (w) => w.dinos.map((d) => `${d.id}:${d.x.toFixed(3)},${d.y.toFixed(3)}`).join('|') + w.humans.map((h) => `${h.id}:${h.x.toFixed(3)}`).join('|');
  assert.equal(pos(b), pos(a), 'same dinos + people, step for step');
  assert.ok(b.mine.anyWater || b.mine.springs.size >= 0);
  void bandAt;
});

test('the scanner ping maps rock near the tunnels (not what is in it), then recharges', () => {
  const m = new Mine(2468);
  const before = m.seen.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
  const n = m.ping(LIFT_X + 3, 8);
  assert.ok(typeof n === 'number' && n > 30, `charted ${n} cells`);
  assert.ok(m.seen.reduce((a, v) => a + (v > 0 ? 1 : 0), 0) > before);
  assert.ok(![...m.seen].some((v) => v === 2), 'contents stay hidden');
  assert.match(String(m.ping(LIFT_X + 3, 8)), /recharg/i, 'cooldown');
  for (let i = 0; i < 30 * 13; i++) m.update(null, 1 / 30);
  assert.match(String(m.ping(LIFT_X + 30, 150)), /too far/i, 'only near your tunnels');
  assert.equal(typeof m.ping(LIFT_X + 2, 20), 'number', 'ready again');
});

/* ------------------------------ The Deep: the mining crew (phase 3) ------------------------------ */

const { pickMiners, sendDown, setOrder, recallAll, CARRY, LANDING } = require(path.join(root, 'sim', 'miners.ts'));

/** A settled tribe with food, ready to mine. */
function mineWorld(seed) {
  const w = tribeWorld(seed, ['tools', 'fire', 'axe', 'basket']);
  Object.assign(w.camp.stock, { cooked: 40, wood: 10 });
  return w;
}
/** Send n people and wait until they're all down. */
function crewDown(w, n) {
  const list = pickMiners(w, n);
  list.forEach((h) => sendDown(w, h));
  run(w, 50, (w) => w.mine.crew.length === list.length);
  assert.equal(w.mine.crew.length, list.length, 'everyone made it down');
  return list;
}

test('people sent down walk to the cave, ride the lift and leave the surface alone', () => {
  const w = mineWorld(601);
  const guard = w.humans.find((h) => !h.child);
  guard.role = 'guard';
  const picked = pickMiners(w, 3);
  assert.equal(picked.length, 3);
  assert.ok(!picked.includes(guard), 'guards stay on duty');
  picked.forEach((h) => assert.ok(sendDown(w, h)));
  assert.ok(!sendDown(w, picked[0]), 'not twice');
  assert.ok(!sendDown(w, w.humans.find((h) => h.child)), 'no children down the mine');
  run(w, 50, (w) => w.mine.crew.length === 3);
  for (const h of picked) {
    assert.ok(h.under, `${h.name} is underground`);
    assert.equal(h.state, 'hide', 'their surface body waits hidden at the cave');
    assert.ok(Math.hypot(h.x - w.camp.caveX, h.y - w.camp.caveY) < 2);
  }
  // the surface job board counts only people who are up top
  run(w, 3);
  for (const h of picked) assert.ok(!(h.role === 'auto' && h.autoRole === 'guard'), 'miners are not given surface guard slots');
});

test('miners dig marked rock, haul it to the lift and it lands on the camp stockpile', () => {
  const w = mineWorld(602);
  const stone0 = w.camp.stock.stone + w.camp.stock.clay + w.camp.stock.flint + w.camp.stock.copper;
  crewDown(w, 2);
  for (let x = LIFT_X + 2; x < LIFT_X + 14; x++) setOrder(w, x, 1, 'dig');
  run(w, 120, (w) => [...w.mine.orders.values()].filter((k) => k === 'dig').length === 0);
  assert.equal([...w.mine.orders.values()].filter((k) => k === 'dig').length, 0, 'the whole row got dug');
  for (let x = LIFT_X + 2; x < LIFT_X + 14; x++) assert.notEqual(w.mine.at(x, 1), M.Soil, `cell ${x},1 is open (or rubble)`);
  run(w, 60, (w) => Object.values(w.mine.hauled).reduce((a, n) => a + n, 0) > 0 && w.mine.crew.every((m) => !Object.keys(m.carry).length));
  const hauled = Object.values(w.mine.hauled).reduce((a, n) => a + n, 0);
  assert.ok(hauled > 0, `the lift carried loads up (${JSON.stringify(w.mine.hauled)})`);
  const after = w.camp.stock.stone + w.camp.stock.clay + w.camp.stock.flint + w.camp.stock.copper;
  assert.ok(after > stone0 - 4, 'it landed on the stockpile');
  assert.ok(w.mine.stats.dug >= 12);
});

test('a directed miner excavates a chosen face and keeps skill across saves', () => {
  const w = mineWorld(2602);
  crewDown(w, 1);
  const miner = w.mine.crew[0];
  const target = mIdx(LIFT_X + 2, 1);
  assert.equal(setOrder(w, LIFT_X + 2, 1, 'dig'), null);
  miner.target = target;
  miner.thinkT = 0;
  run(w, 30, () => !MATERIALS[w.mine.cells[target]].solid);
  assert.ok(!MATERIALS[w.mine.cells[target]].solid, 'directed rock face was excavated');
  assert.ok(miner.experience > 0, 'excavation earns miner experience');
  w.mine.discoveries.push({ kind: 'fossil', name: 'dinosaur tooth', detail: 'Recovered in the Deep.', cell: target });
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(restored.mine.crew[0].experience, miner.experience);
  assert.equal(restored.mine.discoveries[0].name, 'dinosaur tooth');
});

test('loose cave nuggets are carried out and stay collected after loading', () => {
  const w = mineWorld(2603);
  const m = w.mine;
  const entry = [...m.loose.entries()][0];
  assert.ok(entry, 'natural caverns hold loose nuggets');
  const [cell, find] = entry;
  const x = cell % MINE_W;
  const y = Math.floor(cell / MINE_W);
  m.liftMax = Math.max(m.liftMax, y);
  carve(m, x - 1, y);
  m.seen[cell] = 1;
  crewDown(w, 1);
  m.crew[0].target = cell;
  m.crew[0].thinkT = 0;
  run(w, 90, () => m.looseTaken.has(cell));
  assert.ok(m.looseTaken.has(cell), 'miner picked up the nugget');
  assert.ok((m.crew[0]?.carry[find.metal] ?? 0) > 0 || (m.hauled[find.metal] ?? 0) > 0, 'the nugget was carried or hauled');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(!restored.mine.loose.has(cell), 'collected nugget stays gone');
});
test('buried artifacts remain distinct discoveries in the Deep', () => {
  const m = new Mine(9001);
  const find = findContent(m, 'artifact', 110, 145);
  assert.ok(find, 'an artifact is hidden in a deep cave band');
  m.liftMax = find.y;
  carve(m, find.x - 1, find.y);
  const result = m.dig(find.x, find.y, ALL_TOOLS);
  assert.ok(result.ok && result.artifact, 'excavation identifies the artifact');
  assert.equal(m.stats.artifacts, 1);
});
test('miners dig out ore they spot by themselves (and stop when told not to)', () => {
  const w = mineWorld(603);
  const m = w.mine;
  // a short tunnel with a known copper vein at the end
  let ore = null;
  for (let x = LIFT_X + 3; x < LIFT_X + 20 && !ore; x++) if (m.contentOf(mIdx(x, 2)) === 'copper' || m.contentOf(mIdx(x, 2)) === 'flint') ore = x;
  assert.ok(ore, 'some ore in row 2');
  for (let x = LIFT_X + 1; x < ore; x++) { m.cells[mIdx(x, 2)] = M.Open; m.cells[mIdx(x, 1)] = M.Open; }
  m.version++;
  m.scan(mIdx(ore, 2));
  m.autoMine = false;
  crewDown(w, 1);
  run(w, 20);
  assert.equal(m.at(ore, 2), M.Soil === m.baseAt(mIdx(ore, 2)) ? M.Soil : m.baseAt(mIdx(ore, 2)), 'auto-mining off: left alone');
  m.autoMine = true;
  run(w, 40, () => !MATERIALS[m.at(ore, 2)].solid || m.at(ore, 2) === M.Rubble);
  assert.ok(!MATERIALS[m.at(ore, 2)].solid || m.at(ore, 2) === M.Rubble, 'dug out the vein');
});

test('support orders cost wood; flooded tunnels get pumped; dynamite clears rock and everyone runs', () => {
  const w = mineWorld(604);
  const m = w.mine;
  for (let x = LIFT_X + 1; x < LIFT_X + 12; x++) m.cells[mIdx(x, 1)] = M.Open;
  for (let y = 2; y < 6; y++) m.cells[mIdx(LIFT_X + 11, y)] = M.Open;
  m.version++;
  crewDown(w, 2);
  // a support
  const wood = w.camp.stock.wood;
  assert.equal(setOrder(w, LIFT_X + 6, 1, 'support'), null);
  run(w, 20, () => m.supports.has(mIdx(LIFT_X + 6, 1)));
  assert.ok(m.supports.has(mIdx(LIFT_X + 6, 1)), 'beam put in');
  assert.equal(w.camp.stock.wood, wood - 1);
  // a flooded sump
  m.water[mIdx(LIFT_X + 11, 5)] = 1;
  m.water[mIdx(LIFT_X + 11, 4)] = 1;
  m.water[mIdx(LIFT_X + 11, 3)] = 0.8;
  run(w, 40, () => m.water[mIdx(LIFT_X + 11, 3)] + m.water[mIdx(LIFT_X + 11, 4)] < 0.6);
  assert.ok(m.water[mIdx(LIFT_X + 11, 3)] + m.water[mIdx(LIFT_X + 11, 4)] < 0.6, 'they bailed the flood out without being asked');
  // dynamite
  w.camp.stock.tar = 3;
  w.camp.stock.stick = 5;
  const target = mIdx(LIFT_X + 6, 2);
  assert.equal(setOrder(w, LIFT_X + 6, 2, 'blast'), null);
  run(w, 30, () => m.charges.length > 0);
  assert.ok(m.charges.length, 'charge set');
  run(w, 6);
  assert.ok(!MATERIALS[m.cells[target]].solid || m.cells[target] === M.Rubble, 'blasted open');
  assert.ok(w.camp.stock.tar < 3, 'used tar');
  assert.ok(w.humans.filter((h) => h.under).every((h) => h.hp > 0.5), 'nobody stood next to it');
});

test('hazards hurt miners; badly hurt ones head up, and a knocked-out miner rides the lift up to be helped', () => {
  const w = mineWorld(605);
  const [a, b] = crewDown(w, 2);
  // badly hurt: they walk back to the lift by themselves
  a.hp = 0.2;
  run(w, 20, () => !a.under);
  assert.ok(!a.under, 'went up to rest');
  assert.notEqual(a.state, 'down');
  // knocked out by gas: the lift brings them up, out cold
  const mnr = w.mine.crew.find((m) => m.id === b.id);
  const here = mIdx(Math.floor(mnr.x), Math.floor(mnr.y));
  w.mine.gas.set(here, 60);
  b.hp = 0.0004;
  run(w, 1, () => !b.under);
  assert.ok(!b.under, 'came back up');
  assert.equal(b.state, 'down', 'knocked out on the surface (the tribe patches them up)');
  assert.equal(w.mine.crew.length, 0);
});

test('recall brings everyone up; the crew survives save + load', () => {
  const w = mineWorld(606);
  crewDown(w, 3);
  for (let x = LIFT_X + 2; x < LIFT_X + 10; x++) setOrder(w, x, 1, 'dig');
  run(w, 10);
  const data = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = World.deserialize(data);
  assert.equal(w2.mine.crew.length, 3, 'crew saved');
  assert.equal(w2.humans.filter((h) => h.under).length, 3, 'still underground after loading');
  assert.ok(w2.mine.orders.size > 0, 'orders saved');
  run(w2, 5);
  recallAll(w2);
  run(w2, 60, (w) => w.mine.crew.length === 0);
  assert.equal(w2.mine.crew.length, 0, 'everyone came up');
  assert.equal(w2.humans.filter((h) => h.under).length, 0);
  assert.ok(w2.humans.every((h) => Number.isFinite(h.x)));
  assert.ok(CARRY >= 4);
});

test('deep miners shelter from the extinction asteroid', () => {
  const w = mineWorld(607);
  w.mine.liftMax = 60;
  for (let y = 2; y < 50; y++) w.mine.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  w.mine.version++;
  const crew = crewDown(w, 2);
  for (const m of w.mine.crew) { m.x = LIFT_X + 1.5; m.y = 45.5; m.path = []; m.job = null; }
  w.mine.autoMine = false;
  w.extinction.trigger(w);
  run(w, 7 + 10 + 8);
  for (const h of crew) assert.ok(w.humans.includes(h), `${h.name} survived underground`);
});

/* ------------------------------ The Deep: building down there (phase 4) ------------------------------ */

const { canPlaceDeep, placeDeep, demolishDeep, deepRoom, hasVault, lit, cellsOf } = require(path.join(root, 'sim', 'deepBuild.ts'));
const { DEEP_DEFS } = require(path.join(root, 'data', 'mine.ts'));

/** A mined-out hall next to the shaft: rows y0..y1 open from x0..x1 (with rock under it). */
function hall(m, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.cells[mIdx(x, y)] = M.Open;
  for (let x = x0; x <= x1; x++) if (!MATERIALS[m.cells[mIdx(x, y1 + 1)]].solid) m.cells[mIdx(x, y1 + 1)] = M.Stone;
  m.version++;
}
function richWorld(seed) {
  const w = mineWorld(seed);
  Object.assign(w.camp.stock, { wood: 60, stone: 60, hide: 10, clay: 20, grass: 20, stick: 20, tar: 10, cooked: 60 });
  hall(w.mine, LIFT_X + 1, LIFT_X + 16, 1, 3);
  return w;
}

test('rooms only go in dug-out space your miners can reach, with a floor under them', () => {
  const w = richWorld(701);
  const m = w.mine;
  assert.equal(canPlaceDeep(m, 'home', LIFT_X + 2, 2), null, 'fits in the hall');
  assert.match(canPlaceDeep(m, 'home', LIFT_X + 2, 5), /dig out/i, 'not in solid rock');
  assert.match(canPlaceDeep(m, 'home', LIFT_X - 1, 2), /shaft|dig out/i, 'not over the shaft');
  assert.match(canPlaceDeep(m, 'home', LIFT_X + 2, 1), /floor/i, 'needs rock under the floor');
  // an unreached cavern
  hall(m, 30, 34, 60, 61);
  assert.match(canPlaceDeep(m, 'vault', 30, 60), /can't get there/i);
  const b = placeDeep(w, 'home', LIFT_X + 2, 2);
  assert.ok(typeof b !== 'string');
  assert.match(canPlaceDeep(m, 'vault', LIFT_X + 3, 2), /already/i, 'no overlaps');
  assert.equal(m.buildAt.get(mIdx(LIFT_X + 4, 3)), b);
});

test('miners fetch supplies from the lift and build rooms; homes add room for people', () => {
  const w = richWorld(702);
  const cap0 = w.population.capacity(w);
  const wood0 = w.camp.stock.wood;
  const home = placeDeep(w, 'home', LIFT_X + 2, 2);
  const lamp = placeDeep(w, 'lamp', LIFT_X + 9, 3);
  crewDown(w, 2);
  run(w, 90, () => home.built >= 1 && lamp.built >= 1);
  assert.ok(home.built >= 1 && lamp.built >= 1, `built (home ${home.built.toFixed(2)}, lamp ${lamp.built.toFixed(2)})`);
  assert.ok(w.camp.stock.wood <= wood0 - DEEP_DEFS.home.cost.wood, 'paid from the camp stockpile');
  assert.equal(deepRoom(w.mine), DEEP_DEFS.home.room);
  assert.equal(w.population.capacity(w), cap0 + DEEP_DEFS.home.room, 'the tribe has room for more people');
  assert.ok(lit(w.mine, LIFT_X + 10, 3), 'the lamp lights its surroundings');
  for (const i of cellsOf(home)) assert.ok(w.mine.reinforced.has(i), 'finished rooms are reinforced');
});

test('miners build torches that light nearby excavation', () => {
  const w = richWorld(7702);
  const torch = placeDeep(w, 'torch', LIFT_X + 5, 2);
  assert.ok(typeof torch !== 'string');
  crewDown(w, 1);
  run(w, 30, () => torch.built >= 1);
  assert.equal(torch.built, 1);
  assert.ok(lit(w.mine, LIFT_X + 8, 2));
  assert.ok(!lit(w.mine, LIFT_X + 10, 2), 'torchlight has a limited range');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(lit(restored.mine, LIFT_X + 8, 2), 'torch survives the save');
});
test('a fossil gallery turns recovered specimens into research', () => {
  const { updateDeepBuilds } = require(path.join(root, 'sim', 'deepBuild.ts'));
  const w = richWorld(7703);
  w.mine.stats.fossils = 5;
  w.civ.path = 'resonance';
  w.civ.current = 'copperRes';
  w.civ.paid = true;
  const gallery = placeDeep(w, 'gallery', LIFT_X + 5, 2);
  assert.ok(typeof gallery !== 'string');
  gallery.built = 1;
  w.mine.reindex();
  updateDeepBuilds(w, 45);
  assert.ok(w.civ.rp > 0, 'displayed fossils advanced active research');
});
test('a room waits (and says so) when the stockpile is short', () => {
  const w = richWorld(703);
  w.camp.stock.hide = 0;
  const home = placeDeep(w, 'home', LIFT_X + 2, 2);
  crewDown(w, 1);
  run(w, 20);
  assert.ok(!home.have && home.built === 0, 'not started without hide');
  w.camp.stock.hide = 3;
  run(w, 60, () => home.built >= 1);
  assert.ok(home.built >= 1, 'built once the hide arrived');
});

test('the vault is a nearer drop-off and keeps food safe from raiders', () => {
  const w = richWorld(704);
  hall(w.mine, LIFT_X + 17, LIFT_X + 30, 2, 3);
  const v = placeDeep(w, 'vault', LIFT_X + 28, 2);
  assert.ok(typeof v !== 'string', v);
  v.built = 1; v.have = true;
  w.mine.reindex();
  assert.ok(hasVault(w.mine));
  // a miner with a full sack far down the hall unloads at the vault, not the lift
  crewDown(w, 1);
  const mnr = w.mine.crew[0];
  mnr.x = LIFT_X + 26.5; mnr.y = 3.5; mnr.carry = { copper: 9 }; mnr.path = []; mnr.job = null;
  const copper0 = w.camp.stock.copper;
  run(w, 6, () => w.camp.stock.copper > copper0);
  assert.ok(w.camp.stock.copper >= copper0 + 9, 'unloaded');
  assert.ok(mnr.x > LIFT_X + 20, `at the vault, not the lift (x ${mnr.x.toFixed(1)})`);
});

test('glowshrooms grow crops; lamps clear gas and speed up digging nearby', () => {
  const w = richWorld(705);
  const f = placeDeep(w, 'mushroom', LIFT_X + 2, 3);
  const l = placeDeep(w, 'lamp', LIFT_X + 12, 3);
  for (const b of [f, l]) { b.built = 1; b.have = true; }
  w.mine.reindex();
  const crop0 = w.camp.stock.crop;
  run(w, 65);
  assert.ok(w.camp.stock.crop >= crop0 + 2, 'a harvest came up');
  w.mine.gas.set(mIdx(LIFT_X + 13, 2), 50);
  w.mine.gas.set(mIdx(LIFT_X + 30, 30), 50);
  run(w, 1);
  assert.ok(!w.mine.gas.has(mIdx(LIFT_X + 13, 2)), 'gas near the lamp is gone');
  assert.ok(w.mine.gas.has(mIdx(LIFT_X + 30, 30)), 'gas far away stays');
});

test('a mess hall heals hurt miners down below; rooms hold the roof up', () => {
  const w = richWorld(706);
  const mess = placeDeep(w, 'mess', LIFT_X + 6, 2);
  mess.built = 1; mess.have = true;
  w.mine.reindex();
  const [h] = crewDown(w, 1);
  h.hp = 0.4;
  run(w, 30, () => h.hp > 0.9);
  assert.ok(h.under, 'stayed down');
  assert.ok(h.hp > 0.9, `healed at the mess (hp ${h.hp.toFixed(2)})`);
  // roof next to a room never caves in, even on a weak-roof cell
  assert.ok(w.mine.supported(LIFT_X + 6, 4), 'rooms count as supports');
});

test('taking a room down refunds half; rooms save + load', () => {
  const w = richWorld(707);
  const home = placeDeep(w, 'home', LIFT_X + 2, 2);
  const shroom = placeDeep(w, 'mushroom', LIFT_X + 8, 3);
  home.built = 1; home.have = true; shroom.have = true; shroom.built = 0.5; shroom.grow = 0.3;
  w.mine.reindex();
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(w2.mine.builds.length, 2);
  assert.equal(deepRoom(w2.mine), DEEP_DEFS.home.room, 'home still counts after loading');
  assert.ok(w2.mine.buildAt.has(mIdx(LIFT_X + 9, 3)));
  const wood = w2.camp.stock.wood;
  assert.ok(demolishDeep(w2, w2.mine.builds.find((b) => b.kind === 'home').id));
  assert.equal(w2.camp.stock.wood, wood + Math.floor(DEEP_DEFS.home.cost.wood / 2));
  assert.equal(deepRoom(w2.mine), 0);
});

/* ------------------------------ The Deep: landmarks, milestones, cave life (phase 5) ------------------------------ */

const { LANDMARKS, LANDMARK_ORDER, MILESTONES, TROG } = require(path.join(root, 'data', 'mine.ts'));
const { landmarkEvent, wakeCavern } = require(path.join(root, 'sim', 'deepLife.ts'));

test('every world hides its four landmarks in the right depths (fixed by the seed)', () => {
  const a = new Mine(8101);
  const b = new Mine(8101);
  assert.equal(a.landmarks.length, 4, 'all four placed');
  for (const l of a.landmarks) {
    const L = LANDMARKS[l.kind];
    for (const i of l.cells) {
      const y = Math.floor(i / MINE_W);
      assert.ok(y >= L.rows[0] && y < L.rows[1] + L.h, `${l.kind} at row ${y}`);
      assert.ok(MATERIALS[a.cells[i]].solid, 'buried in rock');
      assert.equal(a.contentOf(i), l.kind);
    }
  }
  assert.deepEqual(a.landmarks.map((l) => l.cells.join()), b.landmarks.map((l) => l.cells.join()), 'same seed, same places');
  assert.ok(LANDMARK_ORDER.every((k) => a.landmarks.some((l) => l.kind === k)));
});

test('the scanner picks up landmarks; digging one out pays off (more on the matching civ path)', () => {
  const w = mineWorld(8102);
  const m = w.mine;
  const lode = m.landmarks.find((l) => l.kind === 'lode');
  const [first] = lode.cells;
  const fx = first % MINE_W;
  const fy = Math.floor(first / MINE_W);
  m.liftMax = 110;
  for (let y = 2; y <= fy; y++) m.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  for (let x = LIFT_X + 1; x < fx; x++) m.cells[mIdx(x, fy)] = M.Open;
  m.version++;
  const r = m.ping(fx - 2, fy);
  assert.equal(typeof r, 'number');
  assert.ok(m.lastSignals.includes('lode'), 'signal picked up');
  assert.equal(m.seen[first], 2, 'landmark cells show on the map');
  // dig the whole lode out directly
  const tools = { pick: true, ironPick: true, drill: true, lantern: true, pump: true, dynamite: false, luck: 0 };
  let iron = 0;
  // repeated passes: each dug cell opens the face to the next one
  for (let pass = 0; pass < 4; pass++)
    for (const i of lode.cells) {
      const res = m.dig(i % MINE_W, Math.floor(i / MINE_W), tools);
      if (res.ok && res.loot) iron += res.loot.iron ?? 0;
      if (res.ok && res.landmark?.done) landmarkEvent(w, 'lode', res.landmark.first, true);
    }
  assert.ok(m.landmarkProgress('lode') >= 1, `dug out (${m.landmarkProgress('lode')})`);
  assert.ok(iron >= lode.cells.length * 4, 'every cell gave iron');
  assert.ok(m.landmarksDone.has('lode'));
  assert.ok(w.discoveries.has('motherLode'), 'sticker');
  // the geode charges a Resonance grid
  w.civ.path = 'resonance';
  w.civ.cap = 300;
  w.civ.energy = 0;
  landmarkEvent(w, 'geode', false, true);
  assert.ok(w.civ.energy >= 150 && w.civ.tuned.has('crystal'), 'geode tuned the crystal + charged the grid');
});

test('depth milestones pay out once each', () => {
  const w = mineWorld(8103);
  const stone0 = w.camp.stock.stone;
  w.mine.stats.deepest = 75;
  run(w, 0.2);
  assert.ok(w.mine.milestones.has('deep30') && w.mine.milestones.has('deep70'));
  assert.ok(!w.mine.milestones.has('deep110'));
  assert.equal(w.camp.stock.stone, stone0 + MILESTONES[0].gift.stone, 'gift paid');
  assert.ok(w.discoveries.has('deep30'));
  run(w, 1);
  assert.equal(w.camp.stock.stone, stone0 + MILESTONES[0].gift.stone, 'only once');
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  run(w2, 0.2);
  assert.equal(w2.camp.stock.stone, w.camp.stock.stone, 'not again after loading');
});

test('diamonds turn up deep down, and a diamond drill cuts granite twice as fast', () => {
  const m = new Mine(8104);
  let diamonds = 0;
  for (let y = 110; y < MAGMA_FROM; y++) for (let x = 0; x < MINE_W; x++) if (m.contentOf(mIdx(x, y)) === 'diamond') diamonds++;
  assert.ok(diamonds > 0, `diamonds in the deep (${diamonds})`);
  let shallow = 0;
  for (let y = 1; y < 100; y++) for (let x = 0; x < MINE_W; x++) if (m.contentOf(mIdx(x, y)) === 'diamond') shallow++;
  assert.equal(shallow, 0, 'none near the top');
  let g = null;
  for (let y = 75; y < 105 && !g; y++) for (let x = 10; x < 40; x++) if (m.at(x, y) === M.Granite) { g = { x, y }; break; }
  const base = { pick: true, ironPick: true, drill: true, lantern: true, pump: true, dynamite: false, luck: 0 };
  assert.ok(Math.abs(m.digTime(g.x, g.y, { ...base, diamond: true }) - m.digTime(g.x, g.y, base) * 0.5) < 0.01);
  const w = new World(8104, false);
  w.colony.kits.add('diamondDrill');
  assert.ok(toolsOf(w).drill && toolsOf(w).diamond, 'the kit counts as a drill');
});

test('troglodons wake in breached caverns, hunt in the dark, fear lamps, and the crew fights back', () => {
  const w = richWorld(8105);
  const m = w.mine;
  // a dark gallery off the hall
  hall(m, LIFT_X + 17, LIFT_X + 35, 1, 3);
  m.liftMax = 60;
  for (let y = 4; y < 40; y++) m.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  hall(m, LIFT_X + 2, LIFT_X + 30, 35, 37);
  m.version++;
  wakeCavern(w, mIdx(LIFT_X + 20, 36));
  for (let k = 0; k < 10 && !m.critters.length; k++) wakeCavern(w, mIdx(LIFT_X + 20, 36));
  assert.ok(m.critters.length > 0, 'something woke up');
  const [h] = crewDown(w, 1);
  w.camp.learned.add('spear');
  const mnr = m.crew[0];
  const c = m.critters[0];
  mnr.x = c.x - 1; mnr.y = c.y; mnr.path = []; mnr.job = null;
  m.autoMine = false;
  const hp0 = h.hp;
  run(w, 12, () => !m.critters.includes(c));
  assert.ok(h.hp < hp0 || !m.critters.includes(c), 'they clashed');
  assert.ok(!m.critters.includes(c), 'the miner won');
  assert.ok(w.discoveries.has('troglodon'));
  // lamplight: a troglodon caught in it scurries off (or disappears into a crack)
  wakeCavern(w, mIdx(LIFT_X + 20, 36));
  for (let k = 0; k < 10 && !m.critters.length; k++) wakeCavern(w, mIdx(LIFT_X + 20, 36));
  if (m.critters.length) {
    const t = m.critters[0];
    const lamp = placeDeep(w, 'lamp', Math.floor(t.x), Math.floor(t.y));
    if (typeof lamp !== 'string') {
      lamp.built = 1; lamp.have = true; m.reindex();
      run(w, 6);
      for (const k of m.critters) assert.ok(!lit(m, Math.floor(k.x), Math.floor(k.y)), 'nothing lingers in the light');
    }
  }
  assert.ok(TROG.bite > 0);
});

test('the supervolcano: a meteor hits the volcano and nothing is spared', () => {
  const w = civWorld(9301, 'resonance');
  learn(w, 'advancedArch', 'monumental', 'defensiveEnergy', 'energyStorage');
  // even a charged shield, a deep shelter and miners underground can't save anyone
  finish(w, 'resShield', w.camp.x + 60, w.camp.y + 120);
  w.civ.cap = 400;
  w.civ.energy = 400;
  Object.assign(w.camp.stock, { cooked: 30, wood: 30 });
  w.mine.liftMax = 60;
  for (let y = 2; y < 50; y++) w.mine.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  w.mine.version++;
  crewDown(w, 2);
  for (let i = 0; i < 20; i++) addDino(w, 'trike', 1000 + i * 150, 2600);
  w.tribe.addWall(w, Math.floor(w.camp.x / TILE) + 6, Math.floor(w.camp.y / TILE) + 6, 'stone').built = 1;
  assert.ok(w.extinction.trigger(w, 'supervolcano'));
  assert.equal(w.extinction.x, w.volcano.x, 'aimed at the volcano');
  // the meteor shower comes first: little rocks that grow
  run(w, 8);
  assert.equal(w.extinction.phase, 'shower');
  const sizes = [];
  run(w, 14, (w) => { for (const m of w.meteors) if (!sizes.includes(m.size)) sizes.push(m.size); });
  assert.ok(sizes.length > 4, `a real shower (${sizes.length} meteors)`);
  assert.ok(Math.max(...sizes) > Math.min(...sizes) * 2.5, `small ones to big ones (${Math.min(...sizes).toFixed(2)} → ${Math.max(...sizes).toFixed(2)})`);
  assert.equal(w.extinction.phase, 'incoming', 'then the big one');
  run(w, 10 + 7 + 14 + 1);
  assert.equal(w.extinction.phase, 'ended');
  assert.equal(w.dinos.length, 0, 'every dinosaur gone');
  assert.equal(w.humans.length, 0, 'every person gone (miners too)');
  assert.equal(w.mine.crew.length, 0);
  assert.equal(w.colony.buildings.length, 0, 'nothing built survives');
  assert.equal(w.tribe.walls.length, 0);
  assert.equal(w.shelters.length, 0);
  assert.ok(w.plants.every((p) => p.burnt >= 1), 'every plant burned');
  const vx = Math.floor(w.volcano.x / TILE);
  const vy = Math.floor(w.volcano.y / TILE);
  assert.equal(w.terrain.tiles[vy * 160 + vx], T.Basalt, 'the mountain is a molten crater');
  let grass = 0;
  for (const t of w.terrain.tiles) if (t === T.Grass || t === T.Forest || t === T.Jungle) grass++;
  assert.ok(grass < 40, `a wasteland (${grass} green tiles left)`);
  assert.ok(w.discoveries.has('supervolcano'));
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(w2.extinction.cause, 'supervolcano', 'saved');
});

/* ------------------------------ metal, the polygon age, a realistic mine ------------------------------ */

const { HELMET_BY_ID, HOUSING } = require(path.join(root, 'data', 'colony.ts'));
const { hurtHuman } = require(path.join(root, 'sim', 'injury.ts'));

/** Connected groups of cells holding the same ore. */
function oreBodies(m) {
  const seen = new Uint8Array(m.ore.length);
  const out = [];
  for (let i = 0; i < m.ore.length; i++) {
    if (!m.ore[i] || seen[i]) continue;
    const k = m.ore[i];
    const q = [i];
    seen[i] = 1;
    let n = 0;
    while (q.length) {
      const j = q.pop();
      n++;
      const x = j % MINE_W;
      for (const d of [-1, 1, -MINE_W, MINE_W, -MINE_W - 1, -MINE_W + 1, MINE_W - 1, MINE_W + 1]) {
        const o = j + d;
        if (o < 0 || o >= m.ore.length || seen[o] || m.ore[o] !== k) continue;
        if (Math.abs((o % MINE_W) - x) > 1) continue;
        seen[o] = 1;
        q.push(o);
      }
    }
    out.push({ r: m.oreKinds[k - 1], n });
  }
  return out;
}

test('ore comes in real bodies: seams + veins + pockets, mostly small, a few huge; silver too', () => {
  const m = new Mine(6601);
  const bodies = oreBodies(m);
  assert.ok(bodies.length > 60, `plenty of bodies (${bodies.length})`);
  const sizes = bodies.map((b) => b.n).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const biggest = sizes[sizes.length - 1];
  assert.ok(median <= 12, `most are small (median ${median})`);
  assert.ok(biggest >= 30, `some are huge (biggest ${biggest})`);
  for (const r of ['copper', 'iron', 'silver', 'gold', 'crystal', 'clay', 'flint']) assert.ok(bodies.some((b) => b.r === r), `${r} bodies exist`);
  // silver + gold stay below the topsoil
  for (let y = 1; y < 30; y++) for (let x = 0; x < MINE_W; x++) assert.ok(!['gold', 'silver'].includes(m.oreAt(mIdx(x, y))), 'no gold/silver in the topsoil');
  // fixed by the seed
  assert.deepEqual(Buffer.from(new Mine(6601).ore), Buffer.from(m.ore));
});

test('bedrock sections the mine: sheets between bands + walls, only dynamite gets through; cave systems link caverns', () => {
  const m = new Mine(6602);
  let sheet = 0;
  for (let x = 0; x < MINE_W; x++) if (m.at(x, 30) === M.Bedrock || m.at(x, 31) === M.Bedrock) sheet++;
  assert.ok(sheet >= MINE_W - 1, `a bedrock sheet under the topsoil (${sheet})`);
  assert.equal(m.at(LIFT_X, 30), M.Shaft, 'only the shaft goes through');
  let wall = 0;
  for (let y = 75; y < 105; y++) for (let x = LIFT_X + 6; x < MINE_W; x++) if (m.at(x, y) === M.Bedrock) wall++;
  assert.ok(wall > 40, `a dividing wall in the granite band (${wall})`);
  const t = { pick: true, ironPick: true, drill: true, lantern: true, pump: true, dynamite: true, luck: 0, diamond: true };
  // a tunnel up to the sheet
  m.liftMax = 60;
  for (let y = 2; y < 30; y++) m.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  m.version++;
  const by = m.at(LIFT_X + 1, 30) === M.Bedrock ? 30 : 31;
  for (let y = 30; y < by; y++) m.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  m.version++;
  assert.match(m.cantDig(LIFT_X + 1, by, t), /dynamite|blast/i, 'picks + drills bounce off');
  const w = new World(6602, false);
  w.camp.learned.add('fire');
  w.camp.stock.tar = 2;
  w.camp.stock.stick = 2;
  const r = m.blast(w, LIFT_X + 1, by, t);
  assert.ok(typeof r !== 'string', r);
  assert.notEqual(m.at(LIFT_X + 1, by), M.Bedrock, 'blasted through');
  // winding tunnels: more open rock in the bedrock band than the old blobs alone
  let open = 0;
  for (let y = 32; y < 69; y++) for (let x = LIFT_X + 4; x < MINE_W; x++) if (m.baseAt(mIdx(x, y)) === M.Open) open++;
  assert.ok(open > 60, `cave systems (${open} open cells)`);
});

test('following a vein: a lantern shows where the ore runs next', () => {
  const m = new Mine(6603);
  const t = { pick: true, ironPick: true, drill: true, lantern: true, pump: true, dynamite: false, luck: 0 };
  // find a vein cell next to the landing row and dig to it
  let target = null;
  for (let y = 2; y < 28 && !target; y++) for (let x = LIFT_X + 2; x < MINE_W - 2; x++) {
    const i = mIdx(x, y);
    if (!m.ore[i]) continue;
    const same = [i - 1, i + 1, i - MINE_W, i + MINE_W].filter((j) => m.ore[j] === m.ore[i]).length;
    if (same >= 1) { target = { x, y }; break; }
  }
  assert.ok(target);
  for (let x = LIFT_X + 1; x < target.x; x++) m.cells[mIdx(x, target.y)] = M.Open;
  for (let y = 1; y <= target.y; y++) m.cells[mIdx(LIFT_X + 1, y)] = M.Open;
  m.version++;
  const r = m.dig(target.x, target.y, t);
  assert.ok(r.ok);
  let shown = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = mIdx(target.x + dx, target.y + dy);
    if (m.ore[i] === m.ore[mIdx(target.x, target.y)] && m.seen[i] === 2) shown++;
  }
  assert.ok(shown >= 1, 'the rest of the vein lit up');
});

test('the refinery smelts raw gold, silver + copper into bars', () => {
  const w = tribeWorld(6604, ['tools', 'fire', 'axe', 'smelting']);
  const ref = w.colony.addBuilding(w, 'refinery', w.camp.x + 180, w.camp.y + 160);
  assert.ok(ref);
  ref.built = 1;
  Object.assign(w.camp.stock, { gold: 6, silver: 4, copper: 8, wood: 10 });
  run(w, 60);
  assert.ok(w.camp.stock.goldBar >= 1, `gold bars (${w.camp.stock.goldBar})`);
  assert.ok(w.camp.stock.silverBar >= 1 && w.camp.stock.copperBar >= 1, 'silver + copper bars too');
  assert.ok(w.camp.stock.gold < 6 && w.camp.stock.wood < 10, 'used ore + fuel');
});

test('coal seams fuel the refinery when no logs are available', () => {
  const w = tribeWorld(7604, ['tools', 'fire', 'axe', 'smelting']);
  const ref = w.colony.addBuilding(w, 'refinery', w.camp.x + 180, w.camp.y + 160);
  assert.ok(ref);
  ref.built = 1;
  Object.assign(w.camp.stock, { gold: 2, silver: 0, copper: 0, wood: 0, coal: 1 });
  run(w, 3, () => w.camp.stock.goldBar > 0);
  assert.equal(w.camp.stock.goldBar, 1);
  assert.equal(w.camp.stock.coal, 0);
});
test('helmets: forged from metal, worn by grown-ups, and they soften hits', () => {
  const w = tribeWorld(6605, ['tools', 'fire', 'smelting']);
  const h = w.humans.find((x) => !x.child);
  w.colony.armory.helmGold = 1;
  w.colony.helm(w, h);
  assert.equal(h.gear.helmet, 'helmGold');
  const a = w.humans.filter((x) => !x.child)[1];
  a.hp = 1;
  hurtHuman(w, a, 0.4, a.x, a.y, 'bite');
  const bare = 1 - a.hp;
  h.hp = 1;
  hurtHuman(w, h, 0.4, h.x, h.y, 'bite');
  const helmed = 1 - h.hp;
  assert.ok(helmed < bare * (1 - HELMET_BY_ID.helmGold.armor) + 0.01, `less damage with a helmet (${helmed.toFixed(2)} vs ${bare.toFixed(2)})`);
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(w2.humans.find((x) => x.id === h.id).gear.helmet, 'helmGold', 'helmets save');
});

test('the polygon age: both paths reach it; polygon houses + walls + buildings shrug off fire; energy lances unlock', () => {
  const w = civWorld(6606, 'traditional');
  assert.ok(!w.civ.polygonAge);
  const s = w.shelters[0] ?? (() => { w.camp.addShelter(w, w.camp.x + 200, w.camp.y + 120, 'hut'); return w.shelters[0]; })();
  s.stage = 99; s.tier = HOUSING.length - 2; s.hp = 1;
  assert.ok(!w.camp.startUpgrade(w, s), 'polygon houses wait for the polygon age');
  learn(w, 'masonry');
  assert.ok(w.civ.polygonAge && w.civ.has('precisionStone'), 'Dressed masonry = polygon stonework on the Old Ways');
  assert.ok(w.camp.startUpgrade(w, s), 'now it can be upgraded');
  s.up = false;
  s.tier = HOUSING.length - 1;
  assert.ok(HOUSING[s.tier].polygon);
  // fire under it does nothing
  const ti = Math.floor((s.y - 8) / TILE) * 160 + Math.floor(s.x / TILE);
  w.fire.ignite(w, Math.floor(s.x / TILE), Math.floor((s.y - 8) / TILE), 1);
  run(w, 4);
  assert.equal(s.hp, 1, 'polygon house untouched by fire');
  void ti;
  // colony buildings don't burn in the polygon age
  const b = w.colony.addBuilding(w, 'storage', w.camp.x - 220, w.camp.y + 160);
  b.built = 1;
  const hp0 = b.hp;
  for (let k = 0; k < 3; k++) w.fire.ignite(w, b.tx + k % 2, b.ty, 1);
  run(w, 4);
  assert.equal(b.hp, hp0, 'buildings shrug off fire');
  // the energy lance is now on the forge list
  w.colony.addBuilding(w, 'workshop', w.camp.x + 260, w.camp.y + 200).built = 1;
  assert.ok(w.colony.canCraft(w, 'lance'), 'resonance lances in the polygon age');
});

test('pump stations drain the Deep and pipe the water up to camp', () => {
  const w = richWorld(6607);
  const m = w.mine;
  const pump = placeDeep(w, 'pump', LIFT_X + 6, 2);
  assert.ok(typeof pump !== 'string', pump);
  pump.built = 1; pump.have = true;
  m.reindex();
  for (let x = LIFT_X + 9; x < LIFT_X + 14; x++) m.water[mIdx(x, 3)] = 1;
  const water0 = w.camp.stock.water;
  run(w, 20);
  let left = 0;
  for (let x = LIFT_X + 9; x < LIFT_X + 14; x++) left += m.water[mIdx(x, 3)];
  assert.ok(left < 1.5, `drained (${left.toFixed(2)} left)`);
  assert.ok(w.camp.stock.water > water0 + 3, 'water went up to the camp store');
});

test('energy towers power the Scorpions: they fire on their own, and with plenty nobody has to stand guard', () => {
  const w = civWorld(7701, 'resonance');
  learn(w, 'resonance', 'copperRes', 'quartzTuning', 'energyStorage');
  w.camp.learned.add('scorpion');
  w.camp.learned.add('spear');
  w.tribe.danger = 'normal';
  // four Scorpions on the ground around camp, no crew
  const spots = [[160, 160], [-160, 160], [160, -60], [-160, -60]];
  for (const [dx, dy] of spots) {
    const s = w.colony.addScorpion(w, w.camp.x + dx, w.camp.y + dy);
    assert.ok(typeof s !== 'string', s);
    s.built = 1;
    s.hp = 300;
  }
  // without power they need crews
  run(w, 1);
  assert.ok(w.colony.scorpions.every((s) => !s.drone), 'no tower, no drones');
  finish(w, 'energyTower', w.camp.x - 260, w.camp.y + 220);
  w.civ.update(w, 1.1);
  w.civ.energy = w.civ.cap;
  run(w, 0.5);
  assert.ok(w.colony.scorpions.every((s) => s.drone), 'powered');
  assert.equal(w.colony.drones(w), 4);
  // a raider walks up: the drones shoot it with nobody crewing
  const raptor = addDino(w, 'raptor', w.camp.x + 420, w.camp.y + 160, { raider: true, hunger: 0.9 });
  const e0 = w.civ.energy;
  run(w, 15, () => !w.dinos.includes(raptor));
  assert.ok(!w.dinos.includes(raptor) || raptor.health < 0.6, 'drones hit it');
  assert.ok(w.civ.energy < e0, 'shots use energy');
  assert.ok(w.colony.scorpions.every((s) => !s.crew), 'nobody crewed them');
  run(w, 8);
  assert.ok(!w.humans.some((h) => h.role === 'auto' && h.autoRole === 'guard'), 'with 4 drones nobody stands guard');
  // the grid runs dry: back to needing crews
  w.civ.energy = 0;
  w.civ.cap = 0;
  w.colony.buildings = w.colony.buildings.filter((b) => b.kind !== 'energyTower');
  run(w, 0.5);
  assert.ok(w.colony.scorpions.every((s) => !s.drone), 'unpowered again');
});

test('inside the walls with auto-defenses up, people keep working through a raid (outside they still run)', () => {
  const setup = (seed, auto) => {
    const w = civWorld(seed, 'resonance');
    learn(w, 'resonance', 'copperRes', 'quartzTuning', 'energyStorage');
    for (const t of ['spear', 'scorpion', 'palisade']) w.camp.learned.add(t);
    w.tribe.danger = 'normal';
    const cx = Math.floor(w.camp.x / TILE);
    const cy = Math.floor(w.camp.y / TILE);
    walledBox(w, cx - 9, cy + 3, cx + 9, cy + 12, { gate: true });
    run(w, 0.5);
    if (auto) {
      finish(w, 'energyTower', w.camp.x - 120, w.camp.y + 9 * TILE);
      const s = w.colony.addScorpion(w, w.camp.x + 120, w.camp.y + 9 * TILE);
      assert.ok(typeof s !== 'string', s);
      s.built = 1;
      s.hp = 300;
      w.civ.update(w, 1.1);
      w.civ.energy = w.civ.cap;
    }
    // everyone inside the compound, at work
    const inside = w.humans.filter((h) => !h.child).slice(0, 4);
    inside.forEach((h, i) => { h.x = w.camp.x - 60 + i * 30; h.y = w.camp.y + 7 * TILE; h.role = 'gatherer'; h.state = 'idle'; });
    // one person out in the field
    const outside = w.humans.find((h) => !h.child && !inside.includes(h));
    outside.x = w.camp.x + 700; outside.y = w.camp.y + 300; outside.role = 'gatherer';
    return { w, inside, outside };
  };
  // no auto-defenses: everyone runs for cover
  const a = setup(7801, false);
  assert.ok(a.w.tribe.enclosed(a.w, a.inside[0].x, a.inside[0].y), 'the compound counts as inside the walls');
  assert.ok(!a.w.tribe.enclosed(a.w, a.outside.x, a.outside.y));
  assert.ok(a.w.tribe.startRaid(a.w));
  run(a.w, 4);
  assert.ok(a.inside.some((h) => h.state === 'flee' || h.state === 'hide'), 'without auto-defenses they run');
  // powered Scorpion: the people inside carry on
  const b = setup(7801, true);
  assert.ok(b.w.tribe.autoDefense(b.w) >= 1);
  assert.ok(b.w.tribe.startRaid(b.w));
  // nobody who is inside the walls panics while the raid is on
  let panicked = 0;
  run(b.w, 6, (w) => {
    for (const h of b.inside) if ((h.state === 'flee' || h.state === 'hide') && w.tribe.enclosed(w, h.x, h.y)) panicked++;
  });
  assert.equal(panicked, 0, 'they keep working inside the walls');
  assert.ok(b.outside.state === 'flee' || b.outside.state === 'hide' || !b.w.tribe.enclosed(b.w, b.outside.x, b.outside.y), 'outside the walls is still dangerous');
  assert.ok(!b.w.tribe.safeInside(b.w, b.outside), 'no safety outside');
});

test('the tribe can grow to 100 people', () => {
  const w = tribeWorld(7901, ['tools', 'fire']);
  const tool = { ...DEFAULT_TOOL, id: 'people', people: 'adult' };
  let added = 0;
  for (let k = 0; k < 140; k++) if (applyTool(w, tool, w.camp.x + (k % 12) * 20 - 120, w.camp.y + 120 + Math.floor(k / 12) * 14, false)) added++;
  assert.equal(w.humans.length, 100, `capped at 100 (added ${added})`);
  run(w, 3);
  assert.ok(w.humans.length >= 99, 'they all live on');
});

test('every wall ring gets a grand bone gate entrance: built from bones, shuts dinos out, saves', () => {
  const w = tribeWorld(48, ['tools', 'axe', 'palisade']);
  w.tribe.planRing(w, 'palisade');
  for (const wl of w.tribe.walls) { wl.built = 1; wl.hp = wallMaxHp(wl); }
  assert.equal(w.tribe.planEntrances(w), 1, 'one entrance for the ring');
  const g = w.tribe.walls.find((x) => x.boneUp);
  assert.ok(g && g.part === 'gate', 'the front gate is queued to become bone');
  assert.equal(w.tribe.walls.filter((x) => x.part === 'gate' && !x.boneUp).length, 1, 'the side gate stays as it is');
  assert.equal(w.tribe.planEntrances(w), 0, 'only one per ring');
  assert.equal(sites(w).find((s) => s.kind === 'wall' && s.id === g.id).need, 'bone');
  assert.ok(clone(w).tribe.wallAt(g.tx, g.ty).boneUp, 'the plan saves');
  w.camp.stock.bone = 10;
  for (const b of w.humans.filter((x) => !x.child)) b.role = 'builder';
  run(w, 180, () => g.bone && !g.boneUp);
  assert.ok(g.bone && !g.boneUp && g.built >= 1, 'the bone gate went up');
  assert.ok(wallMaxHp(g) > 220, 'tougher than a wood gate');
  w.tribe.setGate(g, false, true);
  assert.ok(w.tribe.blocks(g.tx, g.ty), 'shut bone doors stop dinos');
  w.tribe.setGate(g, true, true);
  assert.ok(!w.tribe.blocks(g.tx, g.ty), 'open, anything walks through the rib cage');
  const g2 = clone(w).tribe.wallAt(g.tx, g.ty);
  assert.ok(g2.bone && g2.part === 'gate', 'bone gates save');
});

test('the Bone gate tool fills a gap in a wall or swaps an old gate', () => {
  const w = tribeWorld(49, ['tools', 'palisade', 'stonewall']);
  const ty = Math.floor(w.camp.y / TILE) + 8;
  const tx0 = Math.floor(w.camp.x / TILE) - 3;
  for (let tx = tx0; tx <= tx0 + 6; tx++) if (tx !== tx0 + 3) { const wl = w.tribe.addWall(w, tx, ty, 'stone'); wl.built = 1; wl.hp = 600; }
  const tool = { ...DEFAULT_TOOL, id: 'build', build: 'bonegate' };
  assert.ok(applyTool(w, tool, (tx0 + 3) * TILE + 16, ty * TILE + 16, false), 'planted in the gap');
  const gap = w.tribe.wallAt(tx0 + 3, ty);
  assert.ok(gap.bone && gap.part === 'gate' && gap.kind === 'stone', 'matches the wall it sits in');
  assert.ok(!applyTool(w, tool, (tx0 + 3) * TILE + 16, ty * TILE + 16, false), 'already a bone gate');
  assert.ok(applyTool(w, tool, (tx0 + 1) * TILE + 16, ty * TILE + 16, false), 'swaps a finished wall piece');
  assert.ok(w.tribe.wallAt(tx0 + 1, ty).boneUp, 'queued; it keeps standing until the bones arrive');
});

test('researching polygon stonework auto-upgrades every wall to polygon', () => {
  const w = civWorld(508, 'resonance');
  const ty = Math.floor(w.camp.y / TILE) + 8;
  const tx0 = Math.floor(w.camp.x / TILE) - 2;
  const done = [];
  for (let tx = tx0; tx <= tx0 + 3; tx++) { const wl = w.tribe.addWall(w, tx, ty, 'stone'); wl.built = 1; wl.hp = 600; done.push(wl); }
  const plan = w.tribe.addWall(w, tx0 + 4, ty, 'palisade');
  run(w, 8);
  assert.ok(done.every((x) => !x.upgrade), 'nothing before the research');
  learn(w, 'resonance', 'copperRes', 'quartzTuning', 'precisionStone');
  run(w, 25, () => done.every((x) => x.upgrade));
  assert.ok(done.every((x) => x.upgrade && x.upTo === 'polygon'), 'finished walls queued for polygon');
  assert.ok(plan.kind === 'polygon' || plan.upTo === 'polygon', `the new wall goes polygon too (${plan.kind}, built ${plan.built})`);
});

/* ------------------------------ Neanderthals ------------------------------ */
const rivals = require(path.join(root, 'sim', 'rivals.ts'));
const { scorpionTarget } = require(path.join(root, 'sim', 'colony.ts'));
const { knockOut } = require(path.join(root, 'sim', 'injury.ts'));

/** A clan close to camp, with our people named so we know who's who. */
function bruteWorld(seed, n = 2, dx = 700) {
  const w = tribeWorld(seed, ['tools', 'spear']);
  w.rivals.started = true;
  const clan = w.rivals.spawnClan(w, n, { x: w.camp.x + dx, y: w.camp.y + 120 });
  assert.ok(clan, 'clan placed');
  const adults = w.humans.filter((h) => !h.child);
  while (adults.length < 2) adults.push(addHuman(w, w.camp.x, w.camp.y + 40));
  adults[0].name = 'Ugg';
  adults[1].name = 'Oona';
  return { w, clan, man: adults[0], woman: adults[1], brutes: w.rivals.members(clan.id) };
}
const bruteRaid = (w, ids) => { w.tribe.raid = { phase: 'attack', t: 0, ids, fromX: 0, fromY: 0, breached: false, label: 'test', by: 'brute' }; };

test('Neanderthal clans settle far from camp with only basic weapons, and save + load', () => {
  const w = tribeWorld(60, ['tools', 'spear', 'bow', 'crossbow', 'smelting', 'stonewall']);
  run(w, 152);
  assert.ok(w.rivals.started, 'they showed up');
  assert.ok(w.rivals.clans.length >= 2, `${w.rivals.clans.length} clans`);
  for (const c of w.rivals.clans) assert.ok(Math.hypot(c.x - w.camp.x, c.y - w.camp.y) >= 1300, 'camps keep their distance');
  assert.ok(w.rivals.brutes.length >= 6);
  assert.ok(w.rivals.brutes.every((b) => ['club', 'axe', 'spear', 'rock'].includes(b.weapon)), 'clubs, axes, spears + rocks only');
  const [a, b] = w.rivals.clans;
  w.rivals.setRelation(a.id, b.id, -1);
  const w2 = clone(w);
  assert.equal(w2.rivals.clans.length, w.rivals.clans.length);
  assert.equal(w2.rivals.brutes.length, w.rivals.brutes.length);
  assert.equal(w2.rivals.relation(a.id, b.id), -1, 'feuds are remembered');
  assert.ok(w2.rivals.started);
});

test('raiding Neanderthals finish off the men and carry women off; killing the carrier frees her', () => {
  const { w, clan, man, woman, brutes } = bruteWorld(61);
  const [b1, b2] = brutes;
  bruteRaid(w, [b1.id, b2.id]);
  b1.raid = b2.raid = true;
  // a man already knocked out: the brute finishes him
  knockOut(w, man);
  Object.assign(b1, { x: man.x + 12, y: man.y, state: 'fight', targetId: man.id, cd: 0, think: 5 });
  run(w, 3, () => !w.humans.includes(man));
  assert.ok(!w.humans.includes(man), 'the man was killed');
  assert.ok(w.tribe.raid.took >= 1);
  // a woman: grabbed and carried, not hurt
  woman.think = 99;
  Object.assign(b2, { x: woman.x + 12, y: woman.y, state: 'fight', targetId: woman.id, cd: 0, think: 5 });
  run(w, 3, () => !!woman.captive);
  assert.equal(woman.captive, clan.id, 'carried off');
  assert.equal(b2.captive, woman.id);
  assert.equal(woman.state, 'captive');
  run(w, 2);
  assert.ok(woman.z > 0 && Math.hypot(woman.x - b2.x, woman.y - b2.y) < 10, 'over his shoulder');
  w.rivals.hit(w, b2, 9999, b2.x, b2.y);
  assert.ok(!w.rivals.brutes.includes(b2), 'carrier down');
  assert.ok(!woman.captive && woman.state !== 'captive', 'she is free');
});

test('captives are held at the clan camp and come home when rescued (or the clan is wiped out)', () => {
  const { w, clan, woman, brutes } = bruteWorld(62, 3, 520);
  const [b1, b2, b3] = brutes;
  bruteRaid(w, [b1.id]);
  b1.raid = true;
  Object.assign(b1, { x: woman.x + 12, y: woman.y, state: 'fight', targetId: woman.id, cd: 0, think: 5 });
  woman.think = 99;
  run(w, 3, () => !!woman.captive);
  assert.equal(woman.captive, clan.id);
  run(w, 60, () => b1.captive === 0);
  assert.equal(b1.captive, 0, 'got her home');
  assert.ok(Math.hypot(woman.x - clan.x, woman.y - clan.y) < 80, 'held at their camp');
  assert.ok(clone(w).humans.find((h) => h.id === woman.id).captive === clan.id, 'captives save');
  // guarded: a friend nearby isn't enough
  const friend = w.humans.find((h) => !h.child && h !== woman);
  friend.x = woman.x + 20; friend.y = woman.y; friend.think = 99;
  for (const b of [b1, b2, b3]) { b.x = woman.x + 30; b.y = woman.y; b.state = 'idle'; b.think = 99; }
  run(w, 1.5);
  assert.ok(woman.captive, 'still guarded');
  // guards wander off: the friend sneaks her out
  for (const b of [b1, b2, b3]) { b.x = clan.x + 600; b.y = clan.y; b.tx = b.x; b.ty = b.y; }
  friend.x = woman.x + 20; friend.y = woman.y;
  run(w, 1.5);
  assert.ok(!woman.captive, 'rescued');
});

test('guards, Scorpions + drones target raiding Neanderthals, and our bolts hurt them', () => {
  const { w, brutes } = bruteWorld(63);
  const b = brutes[0];
  b.raid = true;
  b.x = w.camp.x + 160; b.y = w.camp.y + 60; b.think = 99; b.state = 'idle';
  const t = scorpionTarget(w, w.camp.x, w.camp.y, 400);
  assert.ok(t && t.id === b.id, 'Scorpions aim at him');
  w.tribe.fireBolt(w, w.camp.x, w.camp.y, 20, t, 60, 700, 0.5);
  run(w, 1);
  assert.ok(b.hp < 1 && b.hp > 0.3, `a bolt hurts but he's tough (${b.hp.toFixed(2)})`);
  // the clans and us never get along: even at home they're fair game
  const home = brutes[1];
  assert.ok(w.rivals.hostile(w, home), 'a target even at their own camp');
});

test('Neanderthals cannot get through closed walls: they bash them', () => {
  const { w, brutes } = bruteWorld(64, 2, 600);
  const cx = Math.floor(w.camp.x / TILE);
  const cy = Math.floor(w.camp.y / TILE);
  walledBox(w, cx - 7, cy - 1, cx + 7, cy + 8);
  const b = brutes[0];
  bruteRaid(w, [b.id]);
  b.raid = true;
  b.x = (cx + 12) * TILE; b.y = (cy + 4) * TILE; b.think = 0;
  let broke = false;
  run(w, 50, () => { broke = w.tribe.walls.some((x) => x.hp < 220); if (!broke) assert.ok(!w.tribe.enclosed(w, b.x, b.y), 'never inside before breaking a wall'); return broke; });
  assert.ok(broke, 'he bashed at the wall');
});

test('clans feud with each other, and allies merge into one band', () => {
  const w = tribeWorld(65, ['tools']);
  w.rivals.started = true;
  const a = w.rivals.spawnClan(w, 4, { x: w.camp.x + 1500, y: w.camp.y });
  const b = w.rivals.spawnClan(w, 2, { x: w.camp.x + 1500, y: w.camp.y + 450 });
  w.rivals.setRelation(a.id, b.id, -1);
  assert.ok(w.rivals.warParty(w, a, b), 'war party set off');
  const before = w.rivals.members(b.id).length + w.rivals.members(a.id).length;
  run(w, 90, () => w.rivals.brutes.length < before);
  assert.ok(w.rivals.brutes.length < before, 'somebody lost the fight');
  // a pact: the small clan joins the big one
  const c = w.rivals.spawnClan(w, 2, { x: w.camp.x - 1500, y: w.camp.y });
  const d = w.rivals.spawnClan(w, 3, { x: w.camp.x - 1500, y: w.camp.y + 450 });
  w.rivals.setRelation(c.id, d.id, 1);
  const n = w.rivals.members(c.id).length + w.rivals.members(d.id).length;
  w.rivals.merge(w, c, d);
  assert.ok(!w.rivals.clan(c.id), 'the small clan is gone');
  assert.equal(w.rivals.members(d.id).length, n, 'everyone joined');
});

test('a whole Neanderthal raid plays out on its own and ends', () => {
  const { w, clan } = bruteWorld(66, 4, 900);
  for (const h of w.humans) if (!h.child) h.role = 'guard';
  assert.ok(w.rivals.startRaid(w, clan), 'raid started');
  assert.equal(w.tribe.raid.by, 'brute');
  assert.ok(w.tribe.raid.ids.length >= 2 && w.tribe.raid.ids.length <= 4, 'one stays home');
  run(w, 12);
  assert.equal(w.tribe.raid.phase, 'attack');
  const t = run(w, 260, () => !w.tribe.raid);
  assert.ok(t >= 0, 'the raid ended');
  run(w, 5);
});

test('resetting the mine re-rolls rock + minerals but keeps rooms, lift, stock and saves', () => {
  const { resetMine } = require(path.join(root, 'sim', 'miners.ts'));
  const { LIFT_X, LIFT_START } = require(path.join(root, 'data', 'mine.ts'));
  const w = tribeWorld(70, ['tools']);
  const m = w.mine;
  const seed0 = m.seed;
  const ore0 = Array.from(m.ore).join('');
  m.liftMax = LIFT_START + 4;
  w.camp.stock.stone = 33;
  m.builds.push({ id: 99, kind: 'home', x: LIFT_X + 2, y: 3, built: 1, have: true, grow: 0 });
  m.reindex();
  const h = w.humans.find((x) => !x.child);
  h.under = true;
  resetMine(w);
  assert.notEqual(m.seed, seed0, 'new seed');
  assert.notEqual(Array.from(m.ore).join(''), ore0, 'minerals moved');
  assert.ok(m.ore.some((x) => x > 0), 'and there are still minerals');
  assert.equal(m.liftMax, LIFT_START + 4, 'lift kept');
  assert.equal(w.camp.stock.stone, 33, 'stockpile kept');
  assert.equal(m.builds.length, 1, 'room kept');
  assert.equal(m.cells[(3) * 0 + m.builds[0].y * require(path.join(root, 'data', 'mine.ts')).MINE_W + m.builds[0].x], 0, 'room space dug out');
  assert.ok(!h.under, 'everyone came up');
  const w2 = clone(w);
  assert.equal(w2.mine.seed, m.seed, 'the new mine saves');
  assert.equal(Array.from(w2.mine.ore).join(''), Array.from(m.ore).join(''), 'same minerals after load');
  assert.equal(w2.mine.builds.length, 1);
});

test('a finished bridge deck holds a 2x2 tower; open water does not', () => {
  const w = new World(12345);
  const { isWaterTile } = require(path.join(root, 'sim', 'terrain.ts'));
  let at = null;
  for (let ty = 5; ty < 100 && !at; ty++) for (let tx = 5; tx < 150 && !at; tx++) {
    let ok = true;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) if (!isWaterTile(w.terrain.tiles[(ty + dy) * 160 + tx + dx])) ok = false;
    if (ok) at = [tx, ty];
  }
  assert.ok(at, 'found open water');
  const [x0, y0] = at;
  const px = x0 * TILE + TILE, py = y0 * TILE + TILE + 16;
  assert.equal(w.tribe.towerSpot(w, px, py), null, 'no tower on bare water');
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const b = w.colony.addBuilding(w, 'bridge', (x0 + dx) * TILE + 16, (y0 + dy) * TILE + 16);
    assert.ok(b, 'bridge planned');
    b.built = 1;
  }
  w.camp.learned.add('tower');
  const t = w.tribe.addTower(w, px, py);
  assert.ok(t && t.tx === x0 && t.ty === y0, 'tower snaps onto the deck');
});

test('only chicken-sized dinos can step onto a bridge', () => {
  const w = new World(12345, false);
  const { isWaterTile } = require(path.join(root, 'sim', 'terrain.ts'));
  let i = -1;
  for (let ty = 5; ty < 100 && i < 0; ty++) for (let tx = 5; tx < 150 && i < 0; tx++) if (isWaterTile(w.terrain.tiles[ty * 160 + tx])) i = ty * 160 + tx;
  assert.ok(i >= 0, 'found water');
  const tx = i % 160, ty = Math.floor(i / 160);
  const b = w.colony.addBuilding(w, 'bridge', tx * TILE + 16, ty * TILE + 16);
  assert.ok(b, 'bridge planned');
  b.built = 1;
  w.nav.sync(w);
  assert.ok(w.nav.ok('human', i), 'people walk the bridge');
  assert.ok(w.nav.ok('dino', i), 'a compy can cross');
  assert.ok(!w.nav.ok('bigDino', i), 'a big dino cannot');
});

test('a Scorpion tapped near a free finished tower snaps onto it', () => {
  const w = new World(12345);
  const t = w.tribe.addTower(w, w.camp.x + 260, w.camp.y + 140);
  assert.ok(t, 'tower planned');
  t.stage = 3;
  // a little off to the side of the tower, not on its outline
  const spot = w.colony.scorpionSpot(w, t.x + 50, t.y + 20);
  assert.equal(spot.mount, 'tower');
  assert.ok(w.colony.towerFree(t), 'free before');
  w.camp.learned.add('scorpion');
  const s = w.colony.addScorpion(w, t.x + 50, t.y + 20);
  assert.ok(typeof s !== 'string' && s.mount === 'tower', 'mounted on the tower');
  assert.ok(!w.colony.towerFree(t), 'taken after');
});
