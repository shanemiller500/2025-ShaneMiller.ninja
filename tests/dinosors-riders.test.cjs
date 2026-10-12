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
const { addHuman, updateHuman, coatWarmth, heavyRider, go } = require(path.join(root, 'sim', 'humans.ts'));
const { workOf, trainingStage } = require(path.join(root, 'sim', 'workDinos.ts'));
const { OUTFITS, OUTFIT_BY_ID } = require(path.join(root, 'data', 'colony.ts'));
const { seasonAt } = require(path.join(root, 'sim', 'seasons.ts'));
const { pickShade, goRelax } = require(path.join(root, 'sim', 'shade.ts'));
const riders = require(path.join(root, 'sim', 'riders.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  return w;
}

const done = (w, b) => { b.built = 1; w.colony.version++; return b; };

test('winter gear comes in four tiers, each warmer, and people pull on the best in the snow', () => {
  const tiers = OUTFITS.filter((o) => o.winter).sort((a, b) => a.winter - b.winter);
  assert.deepEqual(tiers.map((o) => o.winter), [1, 2, 3, 4]);
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i].warmth > tiers[i - 1].warmth, `${tiers[i].id} warmer than ${tiers[i - 1].id}`);
  assert.ok(tiers[3].armor > tiers[1].armor, 'reinforced + elite gear also protect');
  const w = world(4401);
  const h = addHuman(w, w.camp.x, w.camp.y, false, { role: 'gatherer' });
  w.weather.snow = 1;
  w.weather.temp = 0.05;
  w.colony.armory.hideGear = 1;
  w.colony.armory.eliteWinter = 1;
  w.colony.dress(w, h);
  assert.equal(h.gear.outfit, 'eliteWinter');
  assert.equal(coatWarmth(h), OUTFIT_BY_ID.eliteWinter.warmth);
  assert.equal(w.colony.armory.eliteWinter, 0);
});

test('Auto queues the best winter gear it can make in autumn, one at a time', () => {
  const w = world(4402);
  for (let i = 0; i < 4; i++) addHuman(w, w.camp.x + i * 10, w.camp.y, false, {});
  let day = 1;
  while (seasonAt(day).def.id !== 'autumn') day++;
  w.day = day;
  w.colony.queue.length = 0;
  w.tribe.planWinterGear(w);
  assert.equal(w.colony.queue.length, 0, 'no tannery, no winter gear');
  done(w, w.colony.addBuilding(w, 'tannery', w.camp.x + 200, w.camp.y + 120));
  w.camp.stock.hide = 20; w.camp.stock.bone = 10; w.camp.stock.grass = 10;
  w.tribe.planWinterGear(w);
  assert.equal(w.colony.queue.length, 1);
  assert.equal(w.colony.queue[0], 'winterMail', 'reinforced is the best a tannery can make');
  w.tribe.planWinterGear(w);
  assert.equal(w.colony.queue.length, 1, 'one at a time');
});

test('shade seats: people rest under an awning, and only covered ones count in the rain', () => {
  const w = world(4403);
  const h = addHuman(w, w.camp.x + 40, w.camp.y + 40, false, { role: 'gatherer' });
  const ring = done(w, w.colony.addBuilding(w, 'seatRing', w.camp.x + 120, w.camp.y + 60));
  assert.ok(ring);
  assert.equal(pickShade(w, h, { covered: true }), null, 'a seating ring has no roof');
  const awning = done(w, w.colony.addBuilding(w, 'canopy', w.camp.x - 120, w.camp.y + 60));
  assert.ok(awning);
  const seat = pickShade(w, h, { covered: true });
  assert.equal(seat.b.id, awning.id);
  h.hp = 0.6;
  assert.ok(goRelax(w, h, { covered: true }));
  for (let i = 0; i < 900 && h.state !== 'relax'; i++) updateHuman(w, h, 1 / 30);
  assert.equal(h.state, 'relax');
  const hp = h.hp;
  for (let i = 0; i < 150; i++) updateHuman(w, h, 1 / 30);
  assert.ok(h.hp > hp, 'resting in the shade heals a little');
  // four seats under an awning: a fifth person goes elsewhere
  for (let i = 0; i < 3; i++) {
    const o = addHuman(w, awning.x, awning.y, false, {});
    assert.ok(goRelax(w, o, { covered: true }));
    o.state = 'relax';
  }
  const late = addHuman(w, awning.x, awning.y, false, {});
  assert.equal(pickShade(w, late, { covered: true }), null);
});

test('the animal trainer job exists when there is taming work, and training takes time', () => {
  const w = world(4404);
  const people = [0, 1, 2, 3].map((i) => addHuman(w, w.camp.x + i * 12, w.camp.y + 30, false, {}));
  assert.equal(riders.trainerWork(w), 0, 'no taming yet');
  w.camp.learned.add('taming');
  const d = addDino(w, 'trike', w.camp.x + 60, w.camp.y + 40, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  assert.equal(riders.trainerWork(w), 1);
  w.tribe.assignJobs(w);
  const trainer = people.find((h) => w.tribe.roleOf(h) === 'trainer');
  assert.ok(trainer, 'Auto made someone the animal trainer');
  assert.equal(trainingStage(d), 'Friendly');
  assert.ok(riders.trainerThink(w, trainer));
  assert.equal(workOf(d).trainer, trainer.id);
  assert.equal(workOf(d).focus, 'riding', 'riding comes first');
  w.camp.stock.crop = 40;
  for (let i = 0; i < 60; i++) updateHuman(w, trainer, 1 / 30);
  assert.ok((workOf(d).skills.riding ?? 0) < 0.2, 'not instant');
  for (let i = 0; i < 6000 && (workOf(d).skills.riding ?? 0) < 0.35; i++) updateHuman(w, trainer, 1 / 30);
  assert.ok((workOf(d).skills.riding ?? 0) >= 0.35, 'riding lessons progressed');
  assert.equal(trainingStage(d), 'Trained');
});

test('a ready dinosaur gets a rider; the bond survives a save', () => {
  const w = world(4405);
  w.camp.learned.add('taming');
  const h = addHuman(w, w.camp.x, w.camp.y + 30, false, { role: 'guard' });
  const d = addDino(w, 'trike', w.camp.x + 40, w.camp.y + 30, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  assert.match(riders.bond(w, d, h), /training/);
  workOf(d).skills.riding = 1;
  d.warTraining = 1;
  assert.equal(trainingStage(d), 'Expert');
  assert.equal(riders.bond(w, d, h), null);
  assert.equal(riders.partnerOf(w, h), d);
  assert.equal(riders.riderOf(w, d), h);
  assert.equal(riders.riderType(d), 'war');
  assert.ok(w.discoveries.has?.('riderBond') ?? true);
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const h2 = back.humans.find((x) => x.id === h.id);
  const d2 = back.dinos.find((x) => x.id === d.id);
  assert.equal(h2.partner, d.id);
  assert.equal(d2.work.partner, h.id);
  assert.equal(riders.partnerOf(back, h2).id, d.id);
  riders.unbond(back, d2);
  assert.equal(h2.partner, undefined);
});

test('a war rider rides at danger close by instead of running', () => {
  const w = world(4406);
  w.camp.learned.add('taming');
  const x = w.camp.x + 300, y = w.camp.y + 200;
  const h = addHuman(w, x, y, false, { role: 'gatherer' });
  const d = addDino(w, 'trike', x + 30, y, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  workOf(d).skills.riding = 1;
  d.warTraining = 1;
  assert.equal(riders.bond(w, d, h), null);
  const raider = addDino(w, 'raptor', x - 120, y, { raider: true });
  w.creatureHash.insert(raider);
  w.creatureHash.insert(d);
  w.tribe.raid = { phase: 'attack', t: 0, ids: [raider.id], fromX: raider.x, fromY: raider.y, breached: false, label: 'Raid' };
  go(h, 'idle', h.x, h.y); // done celebrating the new team
  h.think = 0;
  updateHuman(w, h, 1 / 30);
  assert.notEqual(h.state, 'flee');
  assert.equal(h.riding, d.id, 'mounted up');
  assert.ok(Math.hypot(h.tx - raider.x, h.ty - raider.y) < 60, 'heading for the danger');
});

test('heavy riders carry more; a flying team scouts deposits from the air', () => {
  const w = world(4407);
  w.camp.learned.add('taming');
  const h = addHuman(w, w.camp.x, w.camp.y + 30, false, {});
  const big = addDino(w, 'apato', w.camp.x + 40, w.camp.y + 30, { owner: true, tame: 1 });
  w.byId.set(big.id, big);
  workOf(big).skills.riding = 1;
  workOf(big).skills.heavy = 1;
  assert.equal(riders.bond(w, big, h), null);
  assert.equal(riders.riderType(big), 'heavy');
  h.riding = big.id;
  big.rider = h.id;
  assert.equal(heavyRider(w, h), true);
  big.rider = 0; h.riding = 0;

  const flier = addHuman(w, w.camp.x + 10, w.camp.y + 30, false, {});
  const p = addDino(w, 'ptera', w.camp.x + 20, w.camp.y + 30, { owner: true, tame: 1 });
  w.byId.set(p.id, p);
  workOf(p).skills.flyer = 1;
  assert.equal(trainingStage(p), 'Expert');
  assert.equal(riders.bond(w, p, flier), null);
  assert.equal(riders.riderType(p), 'flyer');
  const hidden = { id: w.nextId(), kind: 'iron', x: w.camp.x + 900, y: w.camp.y + 300, amount: 10, max: 10, found: false, variant: 0 };
  w.colony.nodes.push(hidden);
  // the flyer is over the deposit with its rider aboard
  flier.riding = p.id;
  p.passengers = [flier.id];
  p.x = hidden.x; p.y = hidden.y;
  workOf(p).mission = { x: hidden.x, y: hidden.y, kind: 'scout', home: false };
  assert.ok(riders.partnerThink(w, p));
  assert.equal(hidden.found, true, 'spotted from the air');
  assert.equal(workOf(p).mission.home, true, 'heading home');
});
