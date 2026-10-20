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
const tech = require(path.join(root, 'sim', 'clanTech.ts'));
const life = require(path.join(root, 'sim', 'clanLife.ts'));
const holds = require(path.join(root, 'sim', 'clanHolds.ts'));
const cats = require(path.join(root, 'sim', 'ourCatapults.ts'));
const captives = require(path.join(root, 'sim', 'clanCaptives.ts'));

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
  w.rivals.started = true;
  w.rivals['relT'] = Infinity;
  w.rivals['arriveT'] = Infinity;
  while (w.humans.filter((h) => !h.child).length < 4) addHuman(w, w.camp.x + w.humans.length * 20, w.camp.y + 40);
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
function quietClan(w, n, x, y) {
  const clan = w.rivals.spawnClan(w, n, { x, y });
  assert.ok(clan);
  Object.assign(clan, { raidT: Infinity, spyT: Infinity, ambushT: Infinity, trapT: Infinity, riteT: Infinity });
  for (const b of w.rivals.members(clan.id)) b.age = 180;
  return clan;
}
const adults = (w) => w.humans.filter((h) => !h.child);

test('clans invent things slowly, faster with every union; masterwork outclasses our weapons', () => {
  const w = world(9601);
  const a = quietClan(w, 5, w.camp.x + 1500, w.camp.y);
  const lone = tech.studyRate(a, 5, 0, 0);
  assert.ok(1 / lone > 400, `about ten minutes an invention (${(1 / lone).toFixed(0)} s)`);
  a.merges = 2;
  assert.ok(tech.studyRate(a, 5, 0, 0) >= lone * 1.9, 'two unions: twice as fast');
  a.merges = 0;
  a.science = 0.999;
  run(w, 1.5);
  assert.equal(tech.techOf(a), 1);
  assert.ok(tech.hasTech(a, 'boneTools'));
  // unions pool what they know and count the merge
  const b = quietClan(w, 2, w.camp.x + 1500, w.camp.y + 450);
  b.tech = 3;
  w.rivals.merge(w, b, a);
  assert.equal(tech.techOf(a), 3);
  assert.equal(a.merges, 1);
  // bone armour, then masterwork: our hits do less
  const brute = w.rivals.members(a.id)[0];
  const hit = () => { brute.hp = 1; w.rivals.hit(w, brute, 30, brute.x, brute.y, false, 'arrow'); return 1 - brute.hp; };
  a.smarts = 0;
  a.tech = 1;
  const base = hit();
  a.tech = 8;
  assert.ok(hit() < base * 0.6, 'masterwork armour');
  assert.ok(tech.mightOf(a) > 1.7, 'and they hit much harder');
});

test('they put their bones into a fence first; totems only once invented', () => {
  const w = world(9602);
  const c = quietClan(w, 4, w.camp.x + 1500, w.camp.y);
  c.builds = { longhouse: 1, smokehouse: 1, trainingRing: 1 };
  assert.equal(life.nextProject(c), 'boneFence');
  c.builds = { longhouse: 1, smokehouse: 1, trainingRing: 1, boneFence: 1, dinoPen: 1, dragonAltar: 1 };
  assert.notEqual(life.nextProject(c), 'boneTotem', 'not invented yet');
  c.tech = 3;
  assert.equal(life.nextProject(c), 'boneTotem');
  assert.ok(life.CLAN_BUILDS.boneFence.cost(0).bones >= 10, 'built from the bones they collect');
});

test('captives wear the clan rags, do chores that feed the clan, and can be rescued', () => {
  const w = world(9603);
  const c = quietClan(w, 4, w.camp.x + 1500, w.camp.y + 100);
  c.food = 2;
  const h = adults(w)[0];
  Object.assign(h, { captive: c.id, state: 'captive', x: c.x, y: c.y + 24 });
  const food0 = c.food;
  let walked = false;
  run(w, 40, () => { if (h.chore) walked = true; });
  assert.equal(h.clanGarb, c.id, 'in their rags');
  assert.ok(walked, 'sent on chores');
  assert.ok(c.food > food0 - 0.6, `fetching food (${food0} → ${c.food.toFixed(1)})`);
  assert.ok(h.hp < 1, 'hard labour wears them down');
  w.rivals.free(w, h, 'saved');
  assert.equal(h.clanGarb, undefined);
  assert.equal(h.chore, null);
});

test('held long enough, a captive may give up and join the clan', () => {
  const w = world(9604);
  const c = quietClan(w, 3, w.camp.x + 1500, w.camp.y + 100);
  const h = adults(w)[1];
  Object.assign(h, { captive: c.id, state: 'captive', x: c.x, y: c.y + 24, captiveT: captives.HOLD_OUT + 1 });
  const n = w.rivals.members(c.id).length;
  const real = w.rng;
  w.rng = () => 0.001;
  captives.captivesSlow(w, w.rivals, 1);
  w.rng = real;
  assert.ok(!w.humans.includes(h));
  const turned = w.rivals.members(c.id).find((b) => b.turned);
  assert.ok(turned && turned.name === h.name, 'one of them now');
  assert.equal(w.rivals.members(c.id).length, n + 1);
});

test('a raid that breaks in can dig in and hold part of the town: they wreck it, starve under siege, and we take it back', () => {
  const w = world(9605);
  const c = quietClan(w, 5, w.camp.x + 1500, w.camp.y + 100);
  c.food = 0;
  const party = w.rivals.members(c.id).slice(0, 3);
  for (const [i, b] of party.entries()) { b.x = w.camp.x + 40 + i * 20; b.y = w.camp.y + 60; b.raid = true; }
  w.tribe.raid = { phase: 'attack', t: 250, ids: party.map((b) => b.id), fromX: c.x, fromY: c.y, breached: true, label: 'test', by: 'brute' };
  w.tribe['updateBruteRaid'](w, w.tribe.raid);
  assert.equal(w.tribe.raid, null, 'the raid became a hold');
  const hold = w.rivals.holds[0];
  assert.ok(hold && party.every((b) => b.hold === hold.id));
  // they wreck what's in it
  const hut = w.shelters.find((s) => s.stage > 0) ?? null;
  if (hut) {
    hold.x = hut.x; hold.y = hut.y;
    const hp = hut.hp;
    holds.holdsTick(w, w.rivals, 5);
    assert.ok(hut.hp < hp, 'wrecking the hut');
  }
  // surrounded: no supplies, they starve, give up and leave
  for (const h of adults(w)) { h.x = hold.x + 120; h.y = hold.y; h.think = 999; }
  hold.food = 0;
  for (const k of ['cooked', 'meat', 'fish', 'crop', 'berries']) w.camp.stock[k] = 0; // (nothing of ours left to eat in there)
  const real = w.rng;
  w.rng = () => 0.001;
  for (let i = 0; i < 5; i++) holds.holdsTick(w, w.rivals, 1);
  w.rng = real;
  assert.ok(hold.cut, 'under siege');
  assert.ok(party.every((b) => !b.hold || !w.rivals.brutes.includes(b)), 'starved out');
  holds.holdsTick(w, w.rivals, 1);
  assert.equal(w.rivals.holds.length, 0, 'ours again');
});

test('two of ours (one on foot) seize an undefended catapult; its keeper crews it, repairs it, upgrades it', () => {
  const w = world(9606);
  const c = quietClan(w, 3, w.camp.x + 1600, w.camp.y + 100);
  const cat = w.rivals.addBrute(w, c, w.camp.x + 500, w.camp.y + 60, { weapon: 'catapult', name: 'Catapult', age: 180 });
  const [a, b] = adults(w);
  // close up, we don't smash it
  const hp = cat.hp;
  w.rivals.hit(w, cat, 50, a.x, a.y, false, 'melee');
  assert.equal(cat.hp, hp);
  // defended: no
  for (const h of [a, b]) { h.x = cat.x + 20; h.y = cat.y; h.think = 999; h.state = 'idle'; }
  const guard = w.rivals.members(c.id).find((x) => x !== cat);
  guard.x = cat.x + 60; guard.y = cat.y;
  cats.seizeTick(w, w.rivals);
  assert.equal(w.rivals.taken.length, 0, 'its crew is still there');
  guard.x = c.x; guard.y = c.y;
  cats.seizeTick(w, w.rivals);
  assert.equal(w.rivals.taken.length, 1, 'taken');
  assert.ok(!w.rivals.brutes.includes(cat));
  const ours = w.rivals.taken[0];
  const keeper = w.humans.find((h) => h.id === ours.keeper);
  assert.equal(keeper.catapult, ours.id, 'bonded to it');
  // it throws at Neanderthals in range while its keeper is at it
  const foe = w.rivals.members(c.id)[0];
  foe.x = ours.x + 420; foe.y = ours.y; foe.think = 999; foe.hp = 1;
  keeper.x = ours.x - 26; keeper.y = ours.y + 8;
  ours.cd = 0;
  const wear = ours.wear;
  run(w, 4, () => { foe.x = ours.x + 420; foe.y = ours.y; foe.vx = foe.vy = 0; keeper.x = ours.x - 26; keeper.y = ours.y + 8; });
  assert.ok(ours.wear > wear, 'it threw');
  assert.ok(foe.hp < 1 || !w.rivals.brutes.includes(foe), 'and hit');
  // worn: the keeper repairs it with wood
  ours.wear = 0.8;
  w.camp.stock.wood = 5;
  foe.hp = 0; w.rivals.kill(w, foe);
  keeper.think = 0;
  for (const o of w.rivals.members(c.id)) { o.x = c.x; o.y = c.y; }
  assert.equal(cats.keeperThink(w, keeper), true);
  assert.ok(ours.wear < 0.8 && w.camp.stock.wood === 4, 'repaired');
  // upgrade
  Object.assign(w.camp.stock, { wood: 50, stone: 50, iron: 10 });
  assert.equal(cats.upgradeCatapult(w, ours), null);
  assert.equal(ours.level, 2);
  assert.ok(cats.rangeOf(ours) > 740);
  // saved + loaded with its keeper
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.rivals.taken[0].level, 2);
  assert.equal(back.humans.find((h) => h.id === keeper.id).catapult, ours.id);
});

test('someone who joined a clan keeps their looks, settles in, and in time has a family there', () => {
  const w = world(9607);
  const c = quietClan(w, 3, w.camp.x + 1500, w.camp.y + 100);
  c.food = 60;
  const h = adults(w)[0];
  const look = { skin: h.skin, hair: h.hair, fur: h.fur };
  Object.assign(h, { captive: c.id, state: 'captive', x: c.x, y: c.y + 24, captiveT: captives.HOLD_OUT + 1 });
  const real = w.rng;
  w.rng = () => 0.001;
  captives.captivesSlow(w, w.rivals, 1);
  w.rng = real;
  const turned = w.rivals.members(c.id).find((b) => b.turned);
  assert.deepEqual(turned.look, look, 'still looks like themselves');
  // a family: settled members make births come sooner, and their child can take after them
  let baby = null;
  run(w, 400, () => {
    c.food = Math.max(c.food, 30);
    baby = w.rivals.members(c.id).find((b) => (b.age ?? 180) < 180 && b.look) ?? baby;
    return !!baby;
  });
  assert.ok(baby, 'a child who takes after them');
  // kept through a save
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(back.rivals.brutes.some((b) => b.turned && b.look && b.name === h.name));
});
