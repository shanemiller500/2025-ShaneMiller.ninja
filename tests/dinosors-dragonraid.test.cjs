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
const { hurtHuman } = require(path.join(root, 'sim', 'injury.ts'));
const { TECH, ROLES } = require(path.join(root, 'data', 'facts.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const raid = require(path.join(root, 'sim', 'dragonRaid.ts'));
const riders = require(path.join(root, 'sim', 'riders.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  for (const t of ['spear', 'bow', 'fire', 'taming', 'dragonHunting']) w.camp.learned.add(t);
  return w;
}

test('dragon hunting: a real invention with two new jobs and their own outfits', () => {
  assert.ok(TECH.dragonHunting);
  assert.ok(ROLES.some((r) => r.id === 'dragonSlayer') && ROLES.some((r) => r.id === 'eggRunner'));
  const w = world(8101);
  w.colony.armory.dragonMail = 1;
  w.colony.armory.runnerKit = 1;
  const s = addHuman(w, w.camp.x, w.camp.y, false, { role: 'dragonSlayer' });
  const r = addHuman(w, w.camp.x + 20, w.camp.y, false, { role: 'eggRunner' });
  w.colony.dress(w, s);
  w.colony.dress(w, r);
  assert.equal(s.gear.outfit, 'dragonMail');
  assert.equal(r.gear.outfit, 'runnerKit');
  assert.equal(raid.eggCapacity(r), 2, 'a runner in a kit carries two eggs');
  assert.ok(raid.eggSpeed(w, r) > 1, 'and runs fast');
  // slayers drill, and it shows
  s.slayer = 1;
  assert.ok(raid.slayerDamage(s) > 3);
  assert.ok(raid.burnGuard(s) < 0.2, 'fire barely hurts a drilled slayer in armour');
});

test('a 10-strong raid: slayers drive the parent off, runners bring the eggs home', () => {
  const w = world(5103);
  nests.seedNests(w);
  const n = w.dragons.nests[0];
  n.x = w.camp.x + 700;
  n.y = w.camp.y + 200;
  w.dragons.eggs = w.dragons.eggs.filter((e) => e.nest !== n.id);
  for (let i = 0; i < 4; i++) w.dragons.eggs.push({ id: w.dragons.nextId(), breed: 'fire', x: n.x - 10 + i * 10, y: n.y, at: 'nest', nest: n.id, carrier: 0, heat: 1, progress: 0, health: 1, rare: false, hatchT: 0 });
  n.found = true;
  w.elapsed = 1000;
  n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  const parent = nests.parentOf(w, n);
  assert.ok(parent);
  w.colony.armory.dragonMail = 7;
  w.colony.armory.runnerKit = 3;
  const people = [];
  for (let i = 0; i < 10; i++) {
    const h = addHuman(w, w.camp.x + (i % 5) * 14, w.camp.y + 40 + Math.floor(i / 5) * 14, false, { role: i < 7 ? 'dragonSlayer' : 'eggRunner' });
    h.slayer = i < 7 ? 1 : 0;
    w.colony.dress(w, h);
    people.push(h);
  }
  assert.ok(raid.launchRaid(w, people, n));
  let most = 0;
  for (let i = 0; i < 30 * 200 && w.dragons.eggs.filter((e) => e.at === 'camp').length < 4; i++) {
    w.update(1 / 30);
    for (const h of people) most = Math.max(most, raid.eggsCarried(h));
  }
  assert.equal(w.dragons.eggs.filter((e) => e.at === 'camp').length, 4, 'every egg made it home');
  assert.equal(most, 2, 'a runner carried two at once');
  assert.ok(parent.hp < parent.maxHp * 0.6 || !w.dragons.list.includes(parent), 'the slayers hurt the dragon badly');
  assert.ok(people.every((h) => w.humans.includes(h)), 'nobody was killed');
});

test('war dino riders: hard to hit, shoot from the saddle, and the bone spikes gore attackers', () => {
  const w = world(8103);
  const h = addHuman(w, w.camp.x + 300, w.camp.y + 200, false, { role: 'guard' });
  const d = addDino(w, 'trike', h.x, h.y, { owner: true, tame: 1 });
  w.byId.set(d.id, d);
  d.warTraining = 1;
  d.warArmor = 2;
  h.riding = d.id;
  d.rider = h.id;
  // hard to hit: lots of blows miss, the rest do half or less
  let hp = 1;
  h.hp = 1;
  for (let i = 0; i < 20; i++) hurtHuman(w, h, 0.05, h.x + 10, h.y, 'club');
  const onFoot = addHuman(w, w.camp.x, w.camp.y, false, {});
  for (let i = 0; i < 20; i++) hurtHuman(w, onFoot, 0.05, onFoot.x + 10, onFoot.y, 'club');
  assert.ok(1 - h.hp < (1 - onFoot.hp) * 0.5, `the rider took far less (${(1 - h.hp).toFixed(2)} vs ${(1 - onFoot.hp).toFixed(2)})`);
  // shoots from the saddle
  const raider = addDino(w, 'raptor', h.x + 180, h.y, { raider: true });
  w.byId.set(raider.id, raider);
  h.cd = 0;
  const before = w.tribe.projectiles.length;
  riders.saddleVolley(w, h);
  assert.ok(w.tribe.projectiles.length > before, 'an arrow flies');
  // a Neanderthal who clubs the rider gets gored by the bone spikes
  w.rivals.started = true;
  const clan = w.rivals.spawnClan(w, 1, { x: h.x + 1500, y: h.y });
  const b = w.rivals.members(clan.id)[0];
  b.x = h.x + 14;
  b.y = h.y;
  const bhp = b.hp;
  w.rivals.strike(w, b, h);
  assert.ok(b.hp < bhp || !w.rivals.brutes.includes(b), 'the spikes bit back');
  void hp;
});
