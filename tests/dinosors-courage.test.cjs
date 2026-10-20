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
const { addDino, dinoMaxHp } = require(path.join(root, 'sim', 'dinos.ts'));
const tasks = require(path.join(root, 'sim', 'tasks.ts'));
const cg = require(path.join(root, 'sim', 'courage.ts'));

/* Strength in numbers: people out on a job fight a threat together when they can win, and run when they can't. */

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
const pickNone = { dino: null, human: null, dragon: null };

/** `n` armed grown-ups sent to chop a tree well out of camp. */
function job(seed, n, techs = ['tools', 'axe', 'basket', 'spear']) {
  const w = new World(seed);
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 10;
  w.randomEvents.enabled = false;
  w.dinos.length = 0;
  for (const t of techs) w.camp.learned.add(t);
  w.camp.goal = null;
  w.tribe.planT = Infinity;
  while (w.humans.filter((h) => !h.child).length < n) addHuman(w, w.camp.x, w.camp.y + 40, false);
  const tree = w.plants
    .filter((p) => ['broadleaf', 'conifer', 'palm'].includes(p.kind) && p.size > 0.7 && !p.stump)
    .map((p) => ({ p, d: Math.hypot(p.x - w.camp.x, p.y - w.camp.y) }))
    .filter((x) => x.d > 500 && x.d < 900)
    .sort((a, b) => a.d - b.d)[0].p;
  const crew = w.humans.filter((h) => !h.child).slice(0, n);
  crew.forEach((h, i) => { h.x = tree.x - 30 + (i % 4) * 20; h.y = tree.y + 20 + Math.floor(i / 4) * 16; h.state = 'idle'; });
  const task = tasks.issue(w, crew, tasks.inferCommand(w, crew, tree.x, tree.y - 30, pickNone));
  assert.ok(task && crew.every((h) => h.taskId === task.id), 'the crew is on the job');
  run(w, 2);
  return { w, crew, tree, task };
}

/** Run with a predator arriving; report who stood their ground and who ran. */
function meet(seed, n, species) {
  const s = job(seed, n);
  const d = addDino(s.w, species, s.tree.x + 200, s.tree.y, { hunger: 0.95, thirst: 0 });
  const rallied = new Set();
  const ran = new Set();
  const gone = run(s.w, 40, (w) => {
    for (const h of s.crew) {
      if (h.rally) rallied.add(h.id);
      else if (h.state === 'flee' || h.state === 'hide') ran.add(h.id);
    }
    return !w.dinos.includes(d);
  });
  return { ...s, d, rallied, ran, gone, alive: s.crew.filter((h) => s.w.humans.includes(h)) };
}

test('alone or short-handed, people on a job run from an Allosaurus; four or more stand and win', () => {
  for (const n of [1, 2, 3]) {
    const r = meet(77, n, 'allo');
    assert.equal(r.rallied.size, 0, `${n} on the job: nobody stands`);
    assert.ok(r.ran.size >= 1, `${n} on the job: they run`);
  }
  const r = meet(77, 4, 'allo');
  assert.equal(r.rallied.size, 4, 'all four stand together');
  assert.ok(r.gone >= 0, 'and bring it down');
  assert.equal(r.alive.length, 4, 'with nobody lost');
  // the fight over, it's back to the job
  run(r.w, 3);
  assert.ok(r.alive.every((h) => h.taskId === r.task.id && !h.rally && h.state !== 'hunt' && h.state !== 'aim'), 'back to chopping');
});

test('a T. rex takes a bigger band: four run, six stand and win', () => {
  const few = meet(77, 4, 'trex');
  assert.equal(few.rallied.size, 0, 'four: too few');
  const many = meet(77, 6, 'trex');
  assert.equal(many.rallied.size, 6, 'six: everyone stands');
  assert.ok(many.gone >= 0, 'the T. rex goes down');
  assert.equal(many.alive.length, 6);
});

test('a lone spear is enough for a raptor', () => {
  const r = meet(77, 1, 'raptor');
  assert.equal(r.rallied.size, 1);
  assert.ok(r.gone >= 0);
  assert.equal(r.alive.length, 1);
});

test('even a guard runs when caught short-handed out on a job', () => {
  const s = job(77, 1);
  const g = s.crew[0];
  g.role = 'guard';
  addDino(s.w, 'allo', s.tree.x + 200, s.tree.y, { hunger: 0.95, thirst: 0 });
  let ran = false;
  let fought = false;
  run(s.w, 6, () => {
    if (g.state === 'flee' || g.state === 'hide') ran = true;
    if (g.state === 'aim' || g.state === 'hunt') fought = true;
  });
  assert.ok(ran && !fought, 'the guard falls back instead of taking on an Allosaurus alone');
});

test('unarmed people and children never stand; people not on a job keep the old rules', () => {
  // no weapons invented: nobody can fight
  const s = job(78, 6, ['tools', 'axe', 'basket']);
  addDino(s.w, 'raptor', s.tree.x + 200, s.tree.y, { hunger: 0.95, thirst: 0 });
  let rallied = 0;
  run(s.w, 8, () => { rallied += s.crew.filter((h) => h.rally).length; });
  assert.equal(rallied, 0, 'unarmed: they run');
  // children are never part of a band
  const k = job(79, 4);
  const kid = k.w.humans.find((h) => h.child);
  kid.x = k.tree.x; kid.y = k.tree.y + 30;
  assert.ok(!cg.canFight(k.w, kid));
  assert.ok(!cg.bandNear(k.w, k.crew[0]).includes(kid));
  // nobody's on a job: courage doesn't apply
  assert.equal(cg.onMission(k.crew[0], null), false);
  assert.equal(cg.onMission(k.crew[0], { kind: 'rest' }), false);
  assert.equal(cg.onMission(k.crew[0], k.task), true);
});

test('the courage maths: more friends, more nerve; hurt fighters count for less; once in, they hold a while', () => {
  const s = job(80, 6);
  const allo = addDino(s.w, 'allo', s.tree.x + 150, s.tree.y, { hunger: 0, thirst: 0 });
  run(s.w, DT); // the creature grid is rebuilt each update
  const h = s.crew[0];
  const foes = cg.foesNear(s.w, h);
  assert.equal(foes.length, 1);
  assert.ok(Math.abs(cg.toughness(foes[0]) - dinoMaxHp(allo)) < 1e-6, 'a fresh Allosaurus: full toughness');
  const band = cg.bandNear(s.w, h);
  const scores = [1, 2, 4, 6].map((k) => cg.courageScore(s.w, h, band.slice(0, k), foes));
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] > scores[i - 1] * 1.3, `more friends, more nerve (${scores.map((x) => x.toFixed(2))})`);
  const full = cg.courageScore(s.w, h, band, foes);
  band.forEach((o) => { o.hp = 0.4; });
  assert.ok(cg.courageScore(s.w, h, band, foes) < full, 'hurt fighters hit softer');
  allo.health = 0.3;
  assert.ok(cg.toughness(cg.foesNear(s.w, h)[0]) < dinoMaxHp(allo) * 0.31, 'a wounded beast is easier');
  assert.ok(cg.COURAGE.hold < cg.COURAGE.start, 'stubborn once in');
});

test('Neanderthal raiders: one person runs from one, three drive one off', () => {
  const brute = (n) => {
    const s = job(81, n);
    s.w.rivals.started = true;
    const clan = s.w.rivals.spawnClan(s.w, 1, { x: s.tree.x + 900, y: s.tree.y });
    const b = s.w.rivals.members(clan.id)[0];
    b.raid = true; b.x = s.tree.x + 200; b.y = s.tree.y; b.state = 'idle'; b.think = 0;
    s.w.tribe.raid = { phase: 'attack', t: 0, ids: [b.id], fromX: 0, fromY: 0, breached: false, label: 'test', by: 'brute' };
    let rallied = 0;
    run(s.w, 25, () => { rallied = Math.max(rallied, s.crew.filter((h) => h.rally).length); return b.hp <= 0 || b.state === 'flee'; });
    return { rallied, b, alive: s.crew.filter((h) => s.w.humans.includes(h)).length };
  };
  const one = brute(1);
  assert.equal(one.rallied, 0, 'alone: run');
  const three = brute(3);
  assert.equal(three.rallied, 3, 'three: stand together');
  assert.ok(three.b.hp < 0.5, `and beat him back (${three.b.hp.toFixed(2)}, ${three.b.state})`);
  assert.equal(three.alive, 3);
});
