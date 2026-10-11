const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require(path.join(__dirname, '..', 'app', 'dinosors', 'sim', 'world.ts'));

test('clans carry gathered food home, raise children, build camps, and save progress', () => {
  const w = new World(83211, false);
  const r = w.rivals;
  r.started = true;
  w.daylight = 1;
  const clan = r.spawnClan(w, 3, { x: w.camp.x + 1500, y: w.camp.y + 200 });
  assert.ok(clan);
  const gatherer = r.members(clan.id)[0];
  const berries = w.addItem('berries', gatherer.x + 8, gatherer.y, { amount: 2 });
  clan.food = 2;
  gatherer.state = 'forage';
  gatherer.targetId = berries.id;
  gatherer.tx = berries.x;
  gatherer.ty = berries.y;
  gatherer.think = 10;
  for (let i = 0; i < 180 && clan.food <= 2; i++) r.update(w, 0.1);
  assert.ok(clan.food > 2, 'gathered food reaches the clan camp');
  assert.ok(!w.items.includes(berries));

  clan.food = 20;
  clan.growT = 0;
  for (let i = 0; i < 12; i++) r.update(w, 1);
  const child = r.members(clan.id).find((b) => b.age < 180);
  assert.ok(child, 'a fed clan has a child');
  assert.equal(child.raid, false);
  clan.campWork = 11.9;
  for (let i = 0; i < 8 && !clan.campTier; i++) r.update(w, 1);
  assert.equal(clan.campTier, 1, 'adults expand their camp');
  const copy = new World(83212, false);
  copy.rivals.load(copy, r.serialize());
  const restored = copy.rivals.clan(clan.id);
  assert.equal(restored.style, clan.style);
  assert.equal(restored.campTier, 1);
  assert.ok(copy.rivals.members(clan.id).some((b) => b.age < 180));
});


test('children stay home during attacks and old clan saves load as adults', () => {
  const w = new World(83213, false);
  const r = w.rivals;
  const clan = r.spawnClan(w, 4, { x: w.camp.x + 1500, y: w.camp.y + 200 });
  const child = r.addBrute(w, clan, clan.x, clan.y, { age: 0 });
  assert.equal(r.startRaid(w, clan), true);
  assert.ok(!w.tribe.raid.ids.includes(child.id));
  assert.equal(child.raid, false);
  const old = r.serialize();
  for (const c of old.clans) { delete c.style; delete c.campTier; delete c.campWork; }
  for (const b of old.brutes) { delete b.age; delete b.forage; delete b.forageKind; }
  const copy = new World(83214, false);
  copy.rivals.load(copy, old);
  assert.equal(copy.rivals.clan(clan.id).campTier, 0);
  assert.ok(copy.rivals.members(clan.id).every((b) => b.age === 180));
});

test('fresh clans settle up to the larger limit and each can grow a larger camp', () => {
  const w = new World(83215, false);
  const r = w.rivals;
  const clans = [];
  for (let i = 0; i < 6; i++) {
    const clan = r.spawnClan(w);
    assert.ok(clan, `clan ${i + 1} finds a separate camp site`);
    clans.push(clan);
    assert.ok(r.members(clan.id).length >= 4, 'new clans arrive with a larger founding band');
  }
  assert.equal(r.spawnClan(w), null, 'world population remains bounded');
  for (const clan of clans) {
    clan.campTier = 3;
    clan.food = 100;
    clan.growT = 0;
  }
  r.started = true;
  for (let i = 0; i < 12; i++) r.update(w, 1);
  assert.ok(clans.every((clan) => r.members(clan.id).length >= 5), 'each fed clan can add members');
  const save = r.serialize();
  assert.ok(save.arriveT >= 0, 'new-clan timing is saved');
});

test('arrival timer creates a fresh clan and resumes after loading', () => {
  const w = new World(83216, false);
  const r = w.rivals;
  r.load(w, { ...r.serialize(), started: true, arriveT: 0 });
  r.update(w, 1);
  assert.equal(r.clans.length, 1, 'expired timer settles a new clan');
  const remaining = r.serialize().arriveT;
  assert.ok(remaining > 0);
  const copy = new World(83217, false);
  copy.rivals.load(copy, r.serialize());
  assert.equal(copy.rivals.serialize().arriveT, remaining);
});
