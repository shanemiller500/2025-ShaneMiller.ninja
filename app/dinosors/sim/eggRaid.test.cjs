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

const { World } = require('./world.ts');
const { addHuman } = require('./humans.ts');
const { addDino } = require('./dinos.ts');
const { seedNests, layEgg, nestEggs, eggHuntThink, eggDropOff, nestsUpdate, parentOf } = require('./dragonNests.ts');
const { startHunt, chariotsUpdate, endHunt, raidTargets, huntThink } = require('./chariots.ts');
const { eggCapacity, eggsCarried } = require('./dragonRaid.ts');
const { T, TILE } = require('./types.ts');

function party(seed, count = 10) {
  const w = new World(seed, false);
  for (const tech of ['tools', 'spear', 'bow', 'taming', 'dragonHunting']) w.camp.learned.add(tech);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 8; x <= cx + 24; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  seedNests(w);
  const nest = w.dragons.nests[0];
  nest.found = true;
  nest.parent = 0;
  nest.x = w.camp.x + 220;
  nest.y = w.camp.y + 40;
  for (const egg of nestEggs(w, nest)) { egg.x = nest.x; egg.y = nest.y; }
  while (nestEggs(w, nest).length < 5) { const egg = layEgg(w, nest); egg.x = nest.x; egg.y = nest.y; }
  const people = Array.from({ length: count }, (_, i) => addHuman(w, nest.x + i % 2, nest.y));
  return { w, nest, people };
}

test('ten sent to five eggs assign enough carriers for the whole clutch', () => {
  const { w, nest, people } = party(5811);
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  const runners = w.colony.hunt.crew.filter((m) => m.runner);
  const capacity = runners.reduce((n, m) => n + eggCapacity(people.find((h) => h.id === m.id)), 0);
  assert.ok(capacity >= 5, `capacity ${capacity} for five eggs`);
  assert.ok(runners.length < people.length, 'fighters still guard the carriers');
});

test('simple steal order spreads five eggs across free hands, two per runner kit', () => {
  const { w, nest, people } = party(5812);
  for (const h of people.slice(0, 3)) h.gear.outfit = 'runnerKit';
  const order = { target: nest.id, people: people.map((h) => h.id), x: nest.x, y: nest.y };
  for (const h of people.slice(0, 3)) eggHuntThink(w, h, order, () => {});
  for (const h of people.slice(0, 2)) eggHuntThink(w, h, order, () => {});
  assert.equal(nestEggs(w, nest).length, 0);
  assert.equal(people.reduce((n, h) => n + eggsCarried(h), 0), 5);
  assert.equal(eggsCarried(people[0]), 2);
  assert.equal(eggsCarried(people[1]), 2);
  for (const h of people.slice(0, 3)) {
    const home = eggDropOff(w);
    h.x = home.x; h.y = home.y;
    eggHuntThink(w, h, order, () => {});
  }
  assert.equal(w.dragons.eggs.filter((e) => e.at === 'camp' && e.nest === nest.id).length, 5);
});

test('raid assigned helpers leave the chariot to collect eggs', () => {
  const { w, nest, people } = party(5813);
  const building = w.colony.addBuilding(w, 'warChariot', w.camp.x + 300, w.camp.y + 200);
  building.built = 1;
  chariotsUpdate(w, 0.1);
  const car = w.colony.chariots[0];
  assert.ok(car);
  const trike = addDino(w, 'trike', car.x + 80, car.y, { owner: true, tame: 1, age: 9999, hunger: 0, thirst: 0 });
  car.trike = trike.id;
  trike.chariot = car.id;
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  const hunt = w.colony.hunt;
  const member = hunt.crew.find((m) => m.runner && m.chariot === car.id);
  assert.ok(member);
  const helper = people.find((h) => h.id === member.id);
  helper.chariot = car.id;
  hunt.phase = 'battle';
  hunt.t = 31;
  chariotsUpdate(w, 0.1);
  assert.equal(member.chariot, 0);
  assert.equal(helper.chariot, undefined);
});

test('ten person raid brings the five egg clutch home', () => {
  const { w, nest, people } = party(5814);
  nest.layT = Infinity;
  w.dragons.timer = Infinity;
  w.randomEvents.enabled = false;
  w.tribe.planT = Infinity;
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  w.colony.hunt.phase = 'battle';
  w.colony.hunt.t = 31;
  for (let i = 0; i < 90 * 30 && w.dragons.eggs.filter((e) => e.at === 'camp' && e.nest === nest.id).length < 5; i++) w.update(1 / 30);
  assert.equal(nestEggs(w, nest).length, 0);
  assert.equal(w.dragons.eggs.filter((e) => e.at === 'camp' && e.nest === nest.id).length, 5);
  assert.ok(!w.dragons.nests.some((n) => n.id === nest.id), 'the expedition demolished the nest before returning');
});

test('an empty nest is cleared on site, stays gone after loading, and cannot be cleared remotely', () => {
  const { w, nest, people } = party(5815);
  w.dragons.eggs = w.dragons.eggs.filter((e) => e.nest !== nest.id);
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  const hunt = w.colony.hunt;
  hunt.phase = 'march';
  chariotsUpdate(w, .1);
  assert.equal(hunt.phase, 'clear', 'unguarded nests skip combat');
  for (const h of people) { h.x = w.camp.x - 1000; h.y = w.camp.y; }
  chariotsUpdate(w, 9);
  assert.ok(w.dragons.nests.includes(nest), 'being victorious is insufficient from a distance');
  people[0].x = nest.x; people[0].y = nest.y;
  chariotsUpdate(w, 4);
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(restored.colony.hunt, null, 'loading calls off expeditions, as before');
  assert.ok(restored.dragons.nests.some((n) => n.id === nest.id), 'unfinished demolition leaves a real nest');
  chariotsUpdate(w, 4.1);
  assert.equal(hunt.phase, 'return');
  assert.ok(!w.dragons.nests.some((n) => n.id === nest.id));
  assert.ok(!raidTargets(w).some((t) => t.kind === 'nest' && t.id === nest.id));
  const reopened = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(!reopened.dragons.nests.some((n) => n.id === nest.id));
});

test('a victorious raid preserves eggs before demolition; defeat leaves the nest standing', () => {
  const { w, nest, people } = party(5816);
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  const hunt = w.colony.hunt;
  endHunt(w, hunt, 'won', 'The dragon was driven off.');
  chariotsUpdate(w, 160);
  assert.equal(hunt.phase, 'collect', 'collection cannot time out and demolish uncollected eggs');
  assert.equal(nestEggs(w, nest).length, 5);
  assert.ok(w.dragons.nests.includes(nest));
  endHunt(w, hunt, 'lost', 'Retreat.');
  chariotsUpdate(w, 10);
  assert.ok(w.dragons.nests.includes(nest));
  assert.equal(nestEggs(w, nest).length, 5);
});

test('after defeating a guarded nest, eggs survive and the driven-off dragon survives demolition', () => {
  const { w, nest, people } = party(5817);
  w.elapsed = 1000; nest.emptyT = 0;
  nestsUpdate(w, .1);
  const parent = parentOf(w, nest);
  assert.ok(parent);
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  const hunt = w.colony.hunt;
  endHunt(w, hunt, 'won', 'The defender is beaten.');
  assert.equal(parent.state, 'flee');
  assert.equal(hunt.phase, 'collect');
  for (const h of people) huntThink(w, h);
  assert.equal(nestEggs(w, nest).length, 0);
  assert.equal(people.reduce((n, h) => n + eggsCarried(h), 0), 5);
  chariotsUpdate(w, .1);
  assert.equal(hunt.phase, 'clear');
  chariotsUpdate(w, 8.1);
  assert.equal(hunt.phase, 'return');
  assert.ok(!w.dragons.nests.includes(nest));
  assert.ok(w.dragons.list.includes(parent), 'demolition removes the structure, not living dragons');
  assert.equal(people.reduce((n, h) => n + eggsCarried(h), 0), 5);
});

test('a small crew makes extra egg trips, then clears the nest instead of getting stuck with full hands', () => {
  const { w, nest, people } = party(5818, 2);
  w.humans = people; w.dinos.length = 0;
  nest.layT = Infinity; nest.emptyT = Infinity;
  w.dragons.timer = Infinity; w.randomEvents.enabled = false; w.tribe.planT = Infinity;
  assert.equal(startHunt(w, 'ring', { people, nest: nest.id }), null);
  endHunt(w, w.colony.hunt, 'won', 'The nest is unguarded.');
  for (let i = 0; i < 120 * 30 && w.dragons.nests.some((n) => n.id === nest.id); i++) w.update(1 / 30);
  assert.ok(!w.dragons.nests.some((n) => n.id === nest.id));
  const saved = w.dragons.eggs.filter((e) => e.nest === nest.id);
  assert.equal(saved.length, 5);
  assert.ok(saved.every((e) => e.at === 'camp' || e.at === 'carried'));
});
