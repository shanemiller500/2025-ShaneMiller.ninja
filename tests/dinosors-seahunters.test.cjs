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
const { sp } = require(path.join(root, 'data', 'species.ts'));
const { T, TILE, MAP_W, MAP_H } = require(path.join(root, 'sim', 'types.ts'));
const sea = require(path.join(root, 'sim', 'seaHunters.ts'));

const DT = 1 / 30;
function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.rivals['arriveT'] = Infinity;
  return w;
}
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w, i * DT) === true) return true;
  }
  return false;
}
/** A spot on the bank right by deep water, and a spot well out in that same water. */
function shore(w) {
  const at = (tx, ty) => w.terrain.tileAt(tx * TILE + 16, ty * TILE + 16);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let ty = 12; ty < MAP_H - 12; ty++) {
      for (let tx = 12; tx < MAP_W - 12; tx++) {
        if (at(tx, ty) !== T.Sand && at(tx, ty) !== T.Grass) continue;
        // a strip of shallows at most, then open deep water for a good way
        let k = 1;
        while (k <= 3 && at(tx + dx * k, ty + dy * k) === T.Shallow) k++;
        if (k > 3 || at(tx + dx * k, ty + dy * k) !== T.Deep) continue;
        let n = 0;
        while (n < 7 && at(tx + dx * (k + n), ty + dy * (k + n)) === T.Deep) n++;
        if (n < 7) continue;
        const ex = tx + dx * (k + 6);
        const ey = ty + dy * (k + 6);
        const lx = tx + dx * (k - 1);
        const ly = ty + dy * (k - 1);
        return { land: { x: tx * TILE + 16 - dx * 6, y: ty * TILE + 16 - dy * 6 }, edge: { x: lx * TILE + 16, y: ly * TILE + 16 }, water: { x: ex * TILE + 16, y: ey * TILE + 16 } };
      }
    }
  }
  return null;
}
function hunter(w, species, at) {
  const d = addDino(w, species, at.x, at.y, { age: 9999 });
  d.hunger = 1;
  d.think = 0;
  return d;
}

test('plesiosaurs + pliosaurs join the mosasaurs in the water', () => {
  for (const id of ['plesio', 'plio']) {
    const def = sp(id);
    assert.equal(def.move, 'swim');
    assert.equal(def.plan, 'plesiosaur');
  }
  assert.ok(sp('plesio').shape.neck > sp('plio').shape.neck, 'a long neck vs a short one');
  assert.ok(sp('plio').shape.head > sp('plesio').shape.head, 'and a huge head');
  const g = new World(4242);
  const swimmers = new Set(g.dinos.filter((d) => sp(d.species).move === 'swim').map((d) => d.species));
  assert.ok(swimmers.has('plesio') && swimmers.has('plio') && swimmers.has('mosa'), [...swimmers].join(','));
});

test('a sea hunter stalks someone fishing, waits low in the water, then bursts out and drags them under', () => {
  const w = world(9501);
  const s = shore(w);
  assert.ok(s, 'found a shore');
  const h = w.humans.find((x) => !x.child) ?? addHuman(w, s.land.x, s.land.y);
  Object.assign(h, { x: s.land.x, y: s.land.y, state: 'fish', think: 999, role: 'auto' });
  const d = hunter(w, 'plio', s.water);
  let stalked = null;
  let lunged = null;
  let lowest = 1;
  const gone = run(w, 90, (ww, t) => {
    h.think = 999;
    if (w.humans.includes(h)) h.state = 'fish';
    if (d.state === 'stalk' && stalked === null) stalked = t;
    if (d.state === 'stalk') lowest = Math.min(lowest, d.z);
    if (d.state === 'lunge' && lunged === null) lunged = t;
    return !w.humans.includes(h);
  });
  assert.ok(stalked !== null, 'it stalked first');
  assert.ok(lunged !== null && lunged - stalked >= sea.STALK_MIN, `then struck (${stalked?.toFixed(1)} → ${lunged?.toFixed(1)} s)`);
  assert.equal(lowest, 0, 'under the surface while stalking');
  assert.ok(gone, 'dragged under');
  assert.ok(d.huntCd > 30, 'and goes quiet for a while after');
});

test('Neanderthals + dinosaurs at the water are prey too', () => {
  const w = world(9502);
  const s = shore(w);
  w.rivals.started = true;
  const clan = w.rivals.spawnClan(w, 2) ?? w.rivals.spawnClan(w, 2, { x: w.camp.x + 1500, y: w.camp.y });
  const b = w.rivals.members(clan.id)[0];
  Object.assign(b, { x: s.land.x, y: s.land.y, think: 999, state: 'idle', age: 180 });
  for (const h of w.humans) { h.x = s.land.x - 2000; h.y = s.land.y; }
  const d = hunter(w, 'plesio', s.water);
  const got = run(w, 90, () => { b.think = 999; b.x = s.land.x; b.y = s.land.y; b.vx = b.vy = 0; return !w.rivals.brutes.includes(b); });
  assert.ok(got, 'the Neanderthal was dragged under');
  // a small dino drinking at the edge
  const w2 = world(9503);
  const s2 = shore(w2);
  for (const h of w2.humans) { h.x = s2.land.x - 2000; }
  // right at the water's edge (a mosasaur's reach is the shortest)
  const prey = addDino(w2, 'compy', s2.edge.x, s2.edge.y, { age: 9999 });
  const m = hunter(w2, 'mosa', s2.water);
  const ate = run(w2, 90, () => { prey.think = 999; prey.state = 'drink'; prey.x = s2.edge.x; prey.y = s2.edge.y; return !w2.dinos.includes(prey); });
  assert.ok(ate, 'the dino at the water was taken');
  assert.ok(w2.dinos.includes(m));
});

test('people well away from deep water are safe', () => {
  const w = world(9504);
  const s = shore(w);
  const h = w.humans.find((x) => !x.child) ?? addHuman(w, 0, 0);
  Object.assign(h, { x: s.land.x - 400, y: s.land.y, think: 999, state: 'idle' });
  // (make sure that spot really is far from deep water)
  assert.equal(sea.deepNear(w, h.x, h.y, 120), null);
  const d = hunter(w, 'plesio', s.water);
  run(w, 30, () => { h.think = 999; });
  assert.ok(w.humans.includes(h));
  assert.notEqual(d.state, 'lunge');
});
