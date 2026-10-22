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
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const brood = require(path.join(root, 'sim', 'dragonBrood.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const rage = require(path.join(root, 'sim', 'dragonRage.ts'));

const DT = 1 / 30;
function world(seed) {
  const w = new World(seed, false);
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  w.dragons.timer = Infinity;
  for (const t of ['tools', 'spear', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  nests.seedNests(w);
  w.elapsed = 1000;
  for (const n of w.dragons.nests) { n.emptyT = 0; n.layT = Infinity; }
  nests.nestsUpdate(w, 0.1);
  return w;
}
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
function hunter(w, x, y) {
  const h = addHuman(w, x, y, false, { role: 'guard' });
  w.colony.equipKind(h, 'spear');
  w.tribe.planT = Infinity;
  return h;
}

test('attacked at its nest, a dragon turns on its attacker and fights back with fire', () => {
  const w = world(9801);
  const n = w.dragons.nests[0];
  const p = nests.parentOf(w, n);
  const h = hunter(w, n.x + 420, n.y + 120);
  const hp = h.hp;
  w.dragons.hit(w, p, 60);
  assert.equal(p.state, 'retaliate', 'it fights back');
  assert.equal(p.foe, h.id);
  let close = false;
  run(w, 20, () => { if (Math.hypot(p.x - h.x, p.y - h.y) < 220) close = true; return h.hp < hp * 0.7 || h.state === 'down'; });
  assert.ok(close, 'it went after them');
  assert.ok(h.hp < hp || h.state === 'down', 'and burned them');
});

test('one of our dragons attacking it gets the fire back', () => {
  const w = world(9802);
  const n = w.dragons.nests[0];
  const p = nests.parentOf(w, n);
  const egg = { id: w.dragons.nextId(), breed: 'fire', x: n.x + 300, y: n.y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const mine = nests.hatch(w, egg);
  Object.assign(mine, { age: 1300, growth: 1, auto: false, x: n.x + 300, y: n.y + 40, z: 0, skills: { trust: 1, follow: 1, flight: 1, fire: 1, combat: 1 } });
  keep.newDragonStats(mine);
  const hp = mine.hp;
  w.dragons.hit(w, p, 60);
  assert.equal(p.foeKind, 'dragon');
  run(w, 20, () => mine.hp < hp * 0.9);
  assert.ok(mine.hp < hp, `our dragon got burned (${Math.round(mine.hp)}/${hp})`);
});

test('hurt its young and the parent dives in to defend it', () => {
  const w = world(9803);
  const n = w.dragons.nests[0];
  const p = nests.parentOf(w, n);
  const young = brood.wildHatch(w, nests.nestEggs(w, n)[0], n);
  hunter(w, n.x - 300, n.y + 80);
  w.dragons.hit(w, young, 1);
  assert.equal(p.state, 'retaliate', 'the parent comes for the attacker');
});

test('kill its young and it rages: tougher, fiercer, bigger, slower to give up (to 3), and it cools in time', () => {
  const w = world(9804);
  const n = w.dragons.nests[0];
  const p = nests.parentOf(w, n);
  const scale0 = keep.dragonStats(p).scale;
  const give0 = rage.giveUpAt(p);
  // how much one hit takes off before it rages
  const before = p.hp;
  w.dragons.hit(w, p, 100);
  const calmLoss = before - p.hp;
  for (let i = 0; i < 4; i++) {
    const young = brood.wildHatch(w, nests.nestEggs(w, n)[0] ?? nests.layEgg(w, n), n);
    w.dragons.hit(w, young, young.hp * 4);
    assert.ok(!w.dragons.list.includes(young), 'the young one died');
  }
  assert.equal(p.rage, rage.MAX_RAGE, 'rage climbs to its peak');
  p.hp = p.maxHp * 0.9;
  const b2 = p.hp;
  w.dragons.hit(w, p, 100);
  assert.ok(b2 - p.hp < calmLoss / 4, `much harder to hurt (${(b2 - p.hp).toFixed(1)} vs ${calmLoss.toFixed(1)})`);
  assert.ok(keep.dragonStats(p).scale > scale0 * 1.3, 'bigger');
  assert.ok(rage.giveUpAt(p) < give0, 'fights on longer');
  // saved + loaded
  const w2 = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(w2.dragons.list.find((d) => d.id === p.id)?.rage, rage.MAX_RAGE);
  // left alone a long while, it slowly cools
  p.calmT = 601;
  rage.rageTick(w, p, 0.1);
  assert.equal(p.rage, rage.MAX_RAGE - 1);
});
