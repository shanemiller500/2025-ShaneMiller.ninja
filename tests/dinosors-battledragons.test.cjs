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
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const life = require(path.join(root, 'sim', 'clanLife.ts'));

const DT = 1 / 30;
function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.storm = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.rivals.started = true;
  w.rivals['relT'] = Infinity;
  w.rivals['arriveT'] = Infinity;
  while (w.humans.filter((h) => !h.child).length < 3) addHuman(w, w.camp.x + w.humans.length * 20, w.camp.y + 40);
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
function quietClan(w, n, x, y) {
  const clan = w.rivals.spawnClan(w, n, { x, y });
  assert.ok(clan);
  Object.assign(clan, { raidT: Infinity, spyT: Infinity, ambushT: Infinity, trapT: Infinity, riteT: Infinity });
  for (const b of w.rivals.members(clan.id)) b.age = 180;
  return clan;
}
/** a grown, fully trained dragon of our own */
function grownDragon(w, x, y) {
  const egg = { id: w.nextId(), breed: 'fire', x, y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  Object.assign(dr, { age: 1300, growth: 1, hunger: 0, energy: 1, stamina: 1, skills: { trust: 1, follow: 1, flight: 1, fire: 1, carry: 1, rider: 1, combat: 1 } });
  keep.newDragonStats(dr);
  dr.hp = dr.maxHp;
  return dr;
}

test('a wild dragon over the volcano lets go: we watch the body fall, and only then the lava + smoke', () => {
  const w = world(9901);
  const clan = quietClan(w, 3, w.camp.x + 1500, w.camp.y + 100);
  const b = w.rivals.members(clan.id)[0];
  const v = w.volcano;
  const dr = w.dragons.summon(w, v);
  Object.assign(dr, { x: v.x + 300, y: v.y, z: 400, state: 'carry', prey: b.id, preyBrute: true, t: 0 });
  b.snatched = dr.id;
  const puffs = [];
  const real = w.dragons.lavaPuff.bind(w.dragons);
  w.dragons.lavaPuff = (ww) => { puffs.push({ t: w.elapsed, alive: w.rivals.brutes.includes(b), z: b.z }); real(ww); };
  let fellAt = null;
  let lowest = Infinity;
  let highest = 0;
  run(w, 20, () => {
    if (b.falling && fellAt === null) fellAt = w.elapsed;
    if (b.falling) {
      lowest = Math.min(lowest, b.z);
      highest = Math.max(highest, b.z);
    }
    return !w.rivals.brutes.includes(b);
  });
  assert.ok(fellAt !== null, 'the body fell');
  assert.ok(highest - lowest > 60, `we saw it drop (${highest.toFixed(0)} → ${lowest.toFixed(0)})`);
  assert.equal(puffs.length, 1);
  assert.ok(puffs[0].t - fellAt > 0.3, 'lava + smoke only after the fall');
  assert.ok(!w.rivals.brutes.includes(b), 'gone into the crater');
});

test('Volcano Drop: our war dragon snatches a Neanderthal, climbs over the volcano and drops them in', () => {
  const w = world(9902);
  const clan = quietClan(w, 3, w.camp.x + 1200, w.camp.y + 100);
  const b = w.rivals.members(clan.id)[0];
  const dr = grownDragon(w, w.camp.x + 200, w.camp.y);
  assert.equal(keep.commandDragon(w, dr, 'volcano', { x: b.x, y: b.y, target: b.id }), null);
  let grabbed = false;
  let fell = false;
  const done = run(w, 120, () => {
    if (b.snatched === dr.id) grabbed = true;
    if (b.falling) fell = true;
    return !w.rivals.brutes.includes(b);
  });
  assert.ok(grabbed, 'snatched');
  assert.ok(fell, 'dropped (we saw them fall)');
  assert.ok(done, 'into the volcano');
  assert.ok((dr.vet ?? 0) > 0, 'battle-hardened a little');
});

test('a war dragon tears Neanderthals apart, grows bigger with every fight, and pulls out to heal when it is losing', () => {
  const w = world(9903);
  const dr = grownDragon(w, w.camp.x, w.camp.y);
  const scale0 = keep.dragonStats(dr).scale;
  const clan = quietClan(w, 4, w.camp.x + 1500, w.camp.y);
  const foes = w.rivals.members(clan.id);
  for (const b of foes) { b.x = w.camp.x + 300; b.y = w.camp.y + 40; b.think = 99; }
  w.dragons.scanT = 0;
  let toasts = [];
  const real = w.toast.bind(w);
  w.toast = (icon, msg, ...rest) => { toasts.push(msg); return real(icon, msg, ...rest); };
  for (const b of foes) {
    keep.commandDragon(w, dr, 'attack', { x: b.x, y: b.y, target: b.id });
    run(w, 30, () => !w.rivals.brutes.includes(b));
  }
  assert.ok(foes.every((b) => !w.rivals.brutes.includes(b)), 'all four torn apart');
  assert.ok(toasts.some((m) => /tore .* apart/.test(m)));
  assert.ok((dr.vet ?? 0) >= 0.1, `vet ${dr.vet}`);
  assert.ok(keep.dragonStats(dr).scale > scale0, 'bigger');
  // badly hurt in a fight: it breaks off and heads home to heal
  const wild = w.dragons.summon(w);
  Object.assign(wild, { x: w.camp.x + 400, y: w.camp.y, z: 100, state: 'circle' });
  keep.commandDragon(w, dr, 'attack', { x: wild.x, y: wild.y, target: wild.id });
  dr.hp = dr.maxHp * 0.2;
  run(w, 0.2);
  assert.equal(dr.cmd?.kind, 'home');
});

test('a dragon stays with its rider, and a bonded battle dragon takes its rider up on sky patrols', () => {
  const w = world(9904);
  const dr = grownDragon(w, w.camp.x, w.camp.y);
  const rider = w.humans.find((h) => !h.child);
  keep.bondDragon(w, dr, rider);
  dr.restT = 9999;
  rider.x = w.camp.x + 420;
  rider.y = w.camp.y + 60;
  rider.think = 99;
  rider.state = 'idle';
  const close = run(w, 30, () => Math.hypot(dr.x - rider.x, dr.y - rider.y) < 175);
  assert.ok(close, 'it came over to its rider');
  // patrols the skies with them
  dr.restT = 0;
  rider.think = 0;
  let patrolled = false;
  let aloft = false;
  run(w, 60, () => {
    if (dr.cmd?.kind === 'patrol') patrolled = true;
    if (rider.aloft === dr.id && dr.z > 100) aloft = true;
    return patrolled && aloft;
  });
  assert.ok(patrolled, 'off on patrol');
  assert.ok(aloft, 'with its rider on its back');
});

test('wild dragons heal when left alone, and break off a fight they cannot win', () => {
  const w = world(9905);
  const dr = w.dragons.summon(w);
  Object.assign(dr, { x: w.camp.x + 2000, y: w.camp.y, state: 'circle', tx: w.camp.x + 2000, ty: w.camp.y });
  dr.hp = dr.maxHp * 0.5;
  dr.calmT = 0;
  run(w, 30);
  assert.ok(dr.hp > dr.maxHp * 0.55, 'healing');
  // over a well-defended town, hurt: it reads the odds and flies off
  const w2 = world(9906);
  for (const t of ['tools', 'spear', 'bow', 'crossbow', 'tower', 'scorpion']) w2.camp.learned.add(t);
  for (let i = 0; i < 4; i++) {
    const s = w2.colony.addScorpion(w2, w2.camp.x + 120 + i * 70, w2.camp.y + 120);
    if (typeof s === 'object') s.built = 1;
  }
  const d2 = w2.dragons.summon(w2);
  Object.assign(d2, { x: w2.camp.x + 150, y: w2.camp.y + 100, z: 120, state: 'strafe' });
  d2.hp = d2.maxHp * 0.55;
  w2.dragons.hit(w2, d2, 10);
  assert.equal(d2.state, 'flee');
});

test('a parent can win its stolen baby back: it grows up wild at the nest and fights beside its parent', () => {
  const w = world(9907);
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  w.elapsed = 1000;
  n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  const parent = nests.parentOf(w, n);
  assert.ok(parent);
  const baby = grownDragon(w, w.camp.x, w.camp.y);
  baby.growth = 0.4;
  baby.age = 500;
  baby.skills = { trust: 1, follow: 1 };
  keep.newDragonStats(baby);
  baby.fromNest = n.id;
  parent.x = n.x + 34;
  parent.y = n.y - 8;
  parent.state = 'perch';
  parent.reclaimT = 0;
  parent.hp = parent.maxHp;
  w.dragons.rng = () => 0.01; // it wins the tussle
  const won = run(w, 90, () => w.dragons.list.includes(baby));
  assert.ok(won, 'took it back');
  assert.ok(!w.dragons.owned.includes(baby));
  assert.ok(baby.young && baby.nest === n.id && !baby.owner);
  const age0 = baby.age;
  run(w, 20);
  assert.ok(baby.age > age0, 'growing up');
  assert.ok(Math.hypot(baby.x - n.x, baby.y - n.y) < 200, 'at home by the nest');
  // it flies out beside its parent when the parent goes to fight
  parent.state = 'defend';
  parent.z = 120;
  parent.foe = 0;
  w.dragons['youngStep'](w, baby, n, DT);
  assert.equal(baby.state, 'defend');
  // saved + loaded as a wild youngster
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const b2 = back.dragons.list.find((d) => d.id === baby.id);
  assert.ok(b2 && b2.young && b2.age > 0);
});

test('clans build a dino pen, tame a wild beast, and it charges in their raids (then limps home)', () => {
  const w = world(9908);
  const clan = quietClan(w, 5, w.camp.x + 1500, w.camp.y + 100);
  clan.builds = { longhouse: 1, smokehouse: 1, trainingRing: 1, dinoPen: 1 };
  clan.food = 60;
  const beast = addDino(w, 'trike', clan.x + 250, clan.y + 80, { age: 9999 });
  const tamed = run(w, 200, () => {
    clan.food = Math.max(clan.food, 40);
    return beast.clan === clan.id;
  });
  assert.ok(tamed, 'tamed');
  const pen = life.siteOf(clan, 'dinoPen');
  run(w, 40);
  assert.ok(Math.hypot(beast.x - pen.x, beast.y - pen.y) < 160, 'lives in the pen');
  // a raid: it charges with them
  for (const b of w.rivals.members(clan.id)) b.raid = true;
  const brutes = w.rivals.members(clan.id).map((b) => b.id);
  w.tribe.raid = { phase: 'attack', t: 0, ids: brutes, fromX: clan.x, fromY: clan.y, breached: false, label: 'test', by: 'brute' };
  run(w, 1.5);
  assert.ok(beast.raider, 'charging');
  assert.equal(beast.state, 'raid');
  w.tribe.raid = null;
  run(w, 1.5);
  assert.ok(!beast.raider, 'home again after');
  // saved + loaded
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.dinos.find((d) => d.id === beast.id).clan, clan.id);
});
