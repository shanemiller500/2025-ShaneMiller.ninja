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
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { addHuman, updateHuman, go } = require(path.join(root, 'sim', 'humans.ts'));
const { issue } = require(path.join(root, 'sim', 'tasks.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const { INCUBATE_SECONDS } = require(path.join(root, 'data', 'dragons.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.storm = 0;
  w.weather.temp = 0.6;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  return w;
}

/** a grown, fully trained dragon of our own */
function grownDragon(w, x, y, breed = 'fire') {
  const egg = { id: w.nextId(), breed, x, y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  dr.age = 1300;
  dr.growth = 1;
  dr.skills = { trust: 1, follow: 1, flight: 1, fire: 1, carry: 1, rider: 1, combat: 1 };
  dr.hunger = 0;
  dr.energy = 1;
  dr.stamina = 1;
  keep.newDragonStats(dr);
  dr.hp = dr.maxHp;
  return dr;
}

const step = (w, secs, fn) => {
  for (let i = 0; i < secs * 30; i++) {
    w.update(1 / 30);
    if (fn && fn()) return i / 30;
  }
  return -1;
};

test('nests sit in remote rocky country, start hidden, and hold real eggs + treasure', () => {
  const w = world(5101);
  nests.seedNests(w);
  assert.ok(w.dragons.nests.length >= 1);
  for (const n of w.dragons.nests) {
    assert.ok(Math.hypot(n.x - w.camp.x, n.y - w.camp.y) > 1200, 'far from camp');
    assert.ok(w.nav.passable('human', n.x, n.y), 'people can reach it');
    assert.equal(n.found, false);
    assert.ok((n.loot.gold ?? 0) > 0 && (n.loot.bone ?? 0) > 0, 'treasure');
    assert.ok(nests.nestEggs(w, n).length >= 1, 'eggs in it');
  }
  // someone walking up to it finds it
  const n = w.dragons.nests[0];
  addHuman(w, n.x + 200, n.y, false, {});
  w.dragons.seeT = 0;
  nests.nestsUpdate(w, 0.1);
  assert.equal(n.found, true);
  assert.ok(w.discoveries.has('dragonNest'));
});

test('a wild parent perches on its nest and rises to drive off people who come close', () => {
  const w = world(5102);
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  w.elapsed = 1000;
  n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  const parent = nests.parentOf(w, n);
  assert.ok(parent, 'a dragon moved in');
  assert.equal(parent.state, 'perch');
  assert.equal(w.dragons.menacing(w), false, 'a dragon asleep on a far-off nest is no threat to camp');
  addHuman(w, n.x + 120, n.y + 40, false, {});
  w.dragons.update(w, 0.1);
  assert.equal(parent.state, 'defend');
});

test('an egg hunt: walk to the nest, take an egg, carry it home (the parent chases a thief)', () => {
  const w = world(5103);
  w.camp.learned.add('fire');
  nests.seedNests(w);
  // a nest within an easy walk for the test (on open ground near camp)
  const n = w.dragons.nests[0];
  n.x = w.camp.x + 520;
  n.y = w.camp.y + 140;
  for (const e of nests.nestEggs(w, n)) { e.x = n.x; e.y = n.y; }
  w.nav.sync(w);
  const a = addHuman(w, w.camp.x + 60, w.camp.y + 60, false, { role: 'guard' });
  const b = addHuman(w, w.camp.x + 70, w.camp.y + 60, false, { role: 'guard' });
  const t = issue(w, [a, b], { kind: 'eggHunt', icon: '🥚', label: 'Steal an egg', x: n.x, y: n.y, target: n.id });
  assert.ok(t);
  const took = step(w, 120, () => a.egg || b.egg);
  assert.ok(took >= 0, 'someone took an egg');
  const carrier = a.egg ? a : b;
  const egg = w.dragons.eggs.find((e) => e.id === carrier.egg);
  assert.equal(egg.at, 'carried');
  assert.ok(n.found, 'they found the nest on the way');
  const home = step(w, 160, () => egg.at === 'camp');
  assert.ok(home >= 0, `the egg made it home (${egg.at})`);
  assert.ok(w.discoveries.has('dragonEgg'));
  // a parent close by when an egg is taken gives chase
  const w2 = world(5104);
  nests.seedNests(w2);
  const n2 = w2.dragons.nests[0];
  w2.elapsed = 1000;
  n2.emptyT = 0;
  nests.nestsUpdate(w2, 0.1);
  const parent = nests.parentOf(w2, n2);
  const thief = addHuman(w2, n2.x, n2.y, false, {});
  const t2 = w2.tasks.add(w2, { kind: 'eggHunt', icon: '🥚', label: 'x', x: n2.x, y: n2.y, target: n2.id }, [thief]);
  thief.taskId = t2.id;
  nests.eggHuntThink(w2, thief, t2, () => {});
  assert.ok(thief.egg, 'grabbed one');
  assert.equal(parent.state, 'chase');
});

test('eggs need warmth: a cold egg weakens, a fuelled incubation shelter hatches it (not instantly)', () => {
  const w = world(5105);
  nests.seedNests(w);
  const egg = w.dragons.eggs[0];
  nests.settleEgg(w, egg, null);
  const h0 = egg.health;
  step(w, 60);
  assert.ok(egg.heat < 0.4 && egg.health < h0, 'no fire, no shelter: it cools');
  assert.ok(egg.progress < 0.2, 'and does not grow');
  const hatch = w.colony.addBuilding(w, 'hatchery', egg.x + 4, egg.y + 30);
  hatch.built = 1;
  w.dragons.fuel[hatch.id] = 99999;
  egg.x = hatch.x; egg.y = hatch.y - 6;
  step(w, 30);
  assert.ok(egg.heat > 0.6, `warm in the shelter (${egg.heat.toFixed(2)})`);
  assert.equal(w.dragons.owned.length, 0, 'not hatched yet');
  const t = step(w, INCUBATE_SECONDS * 1.3, () => w.dragons.owned.length > 0);
  assert.ok(t > INCUBATE_SECONDS * 0.5, `hatched after a good while (${t.toFixed(0)} s)`);
  const baby = w.dragons.owned[0];
  assert.equal(baby.growth < 0.05, true);
  assert.equal(keep.dragonStage(baby), 'Hatched');
  assert.ok(w.discoveries.has('dragonHatch'));
});

test('a hatchling grows up slowly and lessons wait for it; untrained dragons refuse orders', () => {
  const w = world(5106);
  const egg = { id: w.nextId(), breed: 'swift', x: w.camp.x + 80, y: w.camp.y + 80, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  assert.equal(keep.nextDragonLesson(dr), 'trust');
  dr.skills = { trust: 1, follow: 1 };
  assert.equal(keep.nextDragonLesson(dr), null, 'too young to fly');
  assert.match(keep.commandDragon(w, dr, 'flyTo', { x: 0, y: 0 }), /hasn't learned/);
  const hp0 = dr.maxHp;
  dr.hunger = 0;
  step(w, 120, () => { dr.hunger = 0; });
  assert.ok(dr.growth > 0.05 && dr.growth < 0.2, `growing, slowly (${dr.growth.toFixed(3)})`);
  dr.age = 0.3 * 1260;
  step(w, 1);
  assert.equal(keep.nextDragonLesson(dr), 'flight');
  assert.ok(dr.maxHp > hp0, 'bigger and tougher');
  assert.equal(keep.dragonStage(dr), 'Trusting');
});

test('a trainer teaches a young dragon (it takes time) and Auto makes someone the trainer', () => {
  const w = world(5107);
  w.camp.learned.add('taming');
  for (let i = 0; i < 4; i++) addHuman(w, w.camp.x + i * 14, w.camp.y + 40, false, {});
  const egg = { id: w.nextId(), breed: 'fire', x: w.camp.x + 90, y: w.camp.y + 60, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  dr.hunger = 0;
  w.camp.stock.meat = 50;
  w.tribe.assignJobs(w);
  const trainer = w.humans.find((h) => w.tribe.roleOf(h) === 'trainer');
  assert.ok(trainer, 'Auto picked a trainer for the dragon');
  step(w, 5);
  assert.ok((dr.skills.trust ?? 0) < 0.3, 'not instant');
  const t = step(w, 240, () => (dr.skills.trust ?? 0) >= 1);
  assert.ok(t > 0, `trust lessons done (${JSON.stringify(dr.skills)})`);
});

test('a Dragon Rider: bond, climb on, take off, fly across the map, land; the bond survives a save', () => {
  const w = world(5108);
  const dr = grownDragon(w, w.camp.x + 100, w.camp.y + 100);
  const h = addHuman(w, w.camp.x + 140, w.camp.y + 110, false, { role: 'guard' });
  assert.equal(keep.dragonStage(dr), 'War-Trained');
  assert.equal(keep.bondDragon(w, dr, h), null);
  assert.equal(keep.dragonStage(dr), 'Fully Bonded');
  go(h, 'idle', h.x, h.y);
  const dest = { x: w.camp.x + 1600, y: w.camp.y + 600 };
  assert.equal(keep.commandDragon(w, dr, 'flyTo', dest), null);
  const up = step(w, 30, () => h.aloft === dr.id);
  assert.ok(up >= 0, 'the rider climbed on');
  step(w, 3);
  assert.ok(dr.z > 40, `took off (${dr.z.toFixed(0)})`);
  const arrived = step(w, 40, () => Math.hypot(dr.x - dest.x, dr.y - dest.y) < 80);
  assert.ok(arrived >= 0, 'flew there');
  assert.ok(Math.hypot(h.x - dr.x, h.y - dr.y) < 30 && h.z > dr.z, 'the rider is up there with it');
  assert.equal(keep.commandDragon(w, dr, 'land'), null);
  const down = step(w, 30, () => dr.z === 0 && !h.aloft);
  assert.ok(down >= 0, 'landed and the rider hopped off');
  assert.ok(w.nav.passable('human', dr.x, dr.y), 'on clear ground');
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const d2 = back.dragons.owned.find((x) => x.id === dr.id);
  const h2 = back.humans.find((x) => x.id === h.id);
  assert.ok(d2 && h2);
  assert.equal(d2.partner, h.id);
  assert.equal(h2.dragon, dr.id);
  assert.equal(d2.breed, 'fire');
  assert.equal(keep.dragonStage(d2), 'Fully Bonded');
  assert.ok(d2.growth > 0.99);
});

test('fire breath: real fire on the ground, burns a raider, costs stamina and has a cooldown', () => {
  const w = world(5109);
  const dr = grownDragon(w, w.camp.x - 600, w.camp.y + 300);
  // a patch of grass to burn, with a raider in it
  const tx = Math.floor((w.camp.x - 600) / TILE) + 8;
  const ty = Math.floor((w.camp.y + 300) / TILE);
  for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) w.terrain.setTile(x, y, T.Grass);
  w.fire.initFuel(w);
  const target = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  const raider = addDino(w, 'raptor', target.x, target.y, { raider: true });
  const hp0 = raider.health;
  const st0 = dr.stamina;
  assert.equal(keep.commandDragon(w, dr, 'fire', target), null);
  const lit = step(w, 25, () => w.fire.active.size > 0);
  assert.ok(lit >= 0, 'the grass caught fire');
  step(w, 3);
  assert.ok(raider.health < hp0 || !w.dinos.includes(raider), 'the raider got burned');
  assert.ok(dr.stamina < st0, 'breathing fire is tiring');
  assert.ok(dr.fireCd > 0, 'cooldown');
  assert.match(keep.commandDragon(w, dr, 'fire', target), /catching its breath/);
  // a hatchling can't breathe fire at all
  const w2 = world(5110);
  const baby = grownDragon(w2, w2.camp.x, w2.camp.y);
  baby.growth = 0.15;
  assert.equal(keep.startBurst(w2, baby, baby.x + 50, baby.y), false);
});

test('Auto: a war-trained dragon flies out to meet a raider near camp; owned dragons are never targets', () => {
  const w = world(5111);
  const dr = grownDragon(w, w.camp.x + 80, w.camp.y + 120);
  const raider = addDino(w, 'raptor', w.camp.x + 500, w.camp.y + 200, { raider: true });
  w.dragons.scanT = 0;
  step(w, 0.5);
  assert.equal(dr.cmd?.kind, 'attack');
  assert.equal(dr.cmd?.target, raider.id);
  const hp0 = raider.health;
  step(w, 20, () => !w.dinos.includes(raider) || raider.health < hp0 * 0.5);
  assert.ok(!w.dinos.includes(raider) || raider.health < hp0, 'it went after the raider');
  assert.equal(w.dragons.list.includes(dr), false, 'our dragon is not in the wild list');
  assert.equal(w.dragons.menacing(w), false);
});

test('a dragon that runs out of stamina has to come down; tired dragons go home to rest', () => {
  const w = world(5112);
  const dr = grownDragon(w, w.camp.x, w.camp.y + 100);
  assert.equal(keep.commandDragon(w, dr, 'patrol', { x: w.camp.x + 300, y: w.camp.y }), null);
  step(w, 5);
  assert.ok(dr.z > 40);
  dr.stamina = 0.17;
  step(w, 0.2);
  assert.equal(dr.cmd?.kind, 'home', 'tired: heads home');
  const down = step(w, 40, () => dr.z === 0);
  assert.ok(down >= 0, 'landed');
  assert.match(keep.commandDragon(w, dr, 'flyTo', { x: 0, y: 0 }) ?? 'ok', /too tired|ok/);
});
