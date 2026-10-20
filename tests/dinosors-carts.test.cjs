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
const { addHuman, stockPriorities } = require(path.join(root, 'sim', 'humans.ts'));
const carts = require(path.join(root, 'sim', 'carts.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  return w;
}
function people(w, n) {
  const hs = [];
  for (let i = 0; i < n; i++) hs.push(addHuman(w, w.camp.x + i * 12, w.camp.y + 40));
  return hs;
}

test('ten free people and five low supplies: two go for each, lowest first, then round again', () => {
  const w = world(9701);
  w.humans.length = 0;
  const hs = people(w, 12);
  const needs = ['stone', 'clay', 'stick', 'grass', 'iron'];
  const sent = [];
  for (const h of hs.slice(0, 10)) {
    const job = carts.pickNeed(w, h, needs, () => ({ x: 0, y: 0, id: 0 }));
    h.task = job.r;
    sent.push(job.r);
  }
  // in order: the two lowest first, and so on down the list
  assert.deepEqual(sent, ['stone', 'stone', 'clay', 'clay', 'stick', 'stick', 'grass', 'grass', 'iron', 'iron']);
  // an 11th goes back to the lowest (round two)
  assert.equal(carts.pickNeed(w, hs[10], needs, () => ({})).r, 'stone');
  // a supply with nowhere to get it is skipped (clay pit not found yet)
  for (const h of hs) h.task = null;
  const got = [];
  for (const h of hs.slice(0, 4)) {
    const job = carts.pickNeed(w, h, needs, (r) => (r === 'clay' ? null : {}));
    h.task = job.r;
    got.push(job.r);
  }
  assert.deepEqual(got, ['stone', 'stone', 'stick', 'stick']);
  // someone comes home with their load: the next free person refills that crew
  hs[0].task = null;
  assert.equal(carts.pickNeed(w, hs[5], needs, (r) => (r === 'clay' ? null : {})).r, 'stone');
});

test('the camp keeps topping up whatever is lowest, even past its targets', () => {
  const w = world(9702);
  for (const r of ['stick', 'stone', 'grass', 'leaves', 'berries', 'fish']) w.camp.stock[r] = 200;
  assert.equal(stockPriorities(w).length, 0, 'nothing short');
  w.camp.stock.stone = 9;
  const all = stockPriorities(w, true);
  assert.equal(all[0], 'stone', 'stone is lowest relative to its target');
});

test('with axes, people take carts out for bulky loads (and only for those)', () => {
  const w = world(9703);
  const [h] = people(w, 1);
  h.task = 'stone';
  assert.equal(carts.hasCart(w, h), false, 'no axes, no carts');
  w.camp.learned.add('axe');
  assert.equal(carts.hasCart(w, h), true);
  h.task = 'berries';
  assert.equal(carts.hasCart(w, h), false, 'berries go in a basket');
  h.task = null;
  h.carry = 'clay';
  h.carryN = 4;
  h.state = 'carry';
  assert.equal(carts.hasCart(w, h), true, 'hauling clay home');
  h.riding = 5;
  assert.equal(carts.hasCart(w, h), false, 'a rider uses the dino instead');
});

test('a new dragon can take over a nest that has eggs but no dragon (made by the dragon rules, nothing else shifts)', () => {
  const make = () => {
    const w = world(9704);
    nests.seedNests(w);
    w.elapsed = 100;
    return w;
  };
  const w = make();
  const twin = make();
  const n = w.dragons.nests.find((x) => nests.nestEggs(w, x).length > 0);
  assert.ok(n);
  assert.equal(nests.parentOf(w, n), null);
  assert.ok(nests.orphanNests(w).includes(n), 'listed in the Dinos tool');
  const ids = w['idCounter'];
  const dr = nests.claimNest(w, n);
  assert.ok(dr);
  assert.ok(dr.id >= 100_000_000, 'dragon id range');
  assert.equal(w['idCounter'], ids, "the world's ids don't move");
  assert.equal(w.rng(), twin.rng(), "the world's dice don't move");
  assert.equal(dr.breed, n.breed, 'the breed of the eggs');
  assert.equal(nests.parentOf(w, n), dr);
  assert.ok(!nests.orphanNests(w).includes(n));
  assert.equal(nests.claimNest(w, n), null, 'one dragon per nest');
  // it flies in and settles on the eggs
  let home = false;
  for (let i = 0; i < 30 * 90 && !home; i++) {
    w.update(1 / 30);
    home = dr.state === 'perch' && Math.hypot(dr.x - n.x, dr.y - n.y) < 80;
  }
  assert.ok(home, 'on its new nest');
});

test('wild dragons have thick scales: every hit does half', () => {
  const w = world(9705);
  const dr = w.dragons.summon(w);
  const hp = dr.hp;
  w.dragons.hit(w, dr, 100);
  assert.equal(hp - dr.hp, 50);
});
