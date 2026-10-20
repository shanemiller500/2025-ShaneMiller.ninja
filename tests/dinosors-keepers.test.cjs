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
const { addHuman, updateHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));
const keepers = require(path.join(root, 'sim', 'keepers.ts'));
const shows = require(path.join(root, 'sim', 'shows.ts'));
const keep = require(path.join(root, 'sim', 'dragonKeep.ts'));
const raid = require(path.join(root, 'sim', 'dragonRaid.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  for (const t of ['fire', 'taming', 'axe']) w.camp.learned.add(t);
  const tx = Math.floor(w.camp.x / TILE), ty = Math.floor(w.camp.y / TILE);
  for (let y = ty - 2; y <= ty + 16; y++) for (let x = tx + 2; x <= tx + 34; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  Object.assign(w.camp.stock, { wood: 40, meat: 40, stick: 20 });
  return w;
}

const egg = (w, x, y, extra = {}) => {
  const e = { id: w.dragons.nextId(), breed: 'fire', x, y, at: 'carried', nest: 0, carrier: 0, heat: 0.9, progress: 0, health: 1, rare: false, hatchT: 0, ...extra };
  w.dragons.eggs.push(e);
  return e;
};

test('the egg runner who brings an egg home becomes its keeper; unkept eggs get one', () => {
  const w = world(9501);
  const hatch = w.colony.addBuilding(w, 'hatchery', w.camp.x + 200, w.camp.y + 160);
  hatch.built = 1;
  const runner = addHuman(w, w.camp.x + 220, w.camp.y + 200, false, { role: 'eggRunner' });
  const e1 = egg(w, runner.x, runner.y, { carrier: runner.id });
  runner.egg = e1.id;
  raid.settleCarried(w, runner);
  assert.equal(e1.at, 'camp');
  assert.equal(e1.keeper, runner.id, 'the runner keeps it');
  assert.equal(runner.role, 'dragonKeeper', 'and that\'s their job now');
  // two more eggs already at home with nobody: egg runners get them first
  const r2 = addHuman(w, w.camp.x + 100, w.camp.y + 100, false, { role: 'eggRunner' });
  addHuman(w, w.camp.x + 90, w.camp.y + 100, false, { role: 'gatherer' });
  const e2 = egg(w, hatch.x, hatch.y - 6, { at: 'camp' });
  const e3 = egg(w, hatch.x + 12, hatch.y - 6, { at: 'camp' });
  keepers.assignKeepers(w);
  assert.ok(e2.keeper && e3.keeper && e2.keeper !== e3.keeper && e2.keeper !== runner.id, 'one keeper each');
  assert.ok([e2.keeper, e3.keeper].includes(r2.id), 'the egg runner got one');
});

test('a keeper tends their egg, it hatches to them, they play with + train it, and they fly it', () => {
  const w = world(9502);
  const hatch = w.colony.addBuilding(w, 'hatchery', w.camp.x + 200, w.camp.y + 160);
  hatch.built = 1;
  w.dragons.fuel[hatch.id] = 30;
  const k = addHuman(w, w.camp.x + 120, w.camp.y + 200, false, { role: 'auto' });
  const e = egg(w, hatch.x, hatch.y - 6, { at: 'camp', progress: 0.96 });
  keepers.makeKeeper(w, e, k, true);
  // they stoke the fire and sit with it
  let tended = false;
  for (let i = 0; i < 30 * 30 && !w.dragons.owned.length; i++) {
    w.update(1 / 30);
    if (k.state === 'dragonCare' && k.targetId === e.id) tended = true;
  }
  assert.ok(tended, 'the keeper sat with their egg');
  assert.ok((w.dragons.fuel[hatch.id] ?? 0) > 30, 'and kept the fire going');
  const dr = w.dragons.owned[0];
  assert.ok(dr, 'it hatched');
  assert.equal(dr.keeper, k.id, 'the baby is its keeper\'s');
  assert.equal(keepers.chargeOf(w, k).dragon, dr);
  // playtime when there's nothing to learn right now
  dr.skills = { trust: 0.5, follow: 1 };
  dr.hunger = 0;
  dr.growth = 0.1;
  dr.age = 120;
  dr.skills.trust = 1;
  let played = false;
  for (let i = 0; i < 30 * 30 && !played; i++) {
    w.update(1 / 30);
    if (k.state === 'dragonPlay') played = true;
  }
  assert.ok(played, 'they played together');
  // grown + rideable: the keeper becomes its rider (not some guard)
  addHuman(w, w.camp.x + 300, w.camp.y + 200, false, { role: 'guard' });
  dr.growth = 1;
  dr.age = 1300;
  dr.skills = { trust: 1, follow: 1, flight: 1, fire: 1, carry: 1, rider: 1, combat: 1 };
  keep.newDragonStats(dr);
  assert.equal(keep.chooseDragonRider(w, dr), k);
  k.think = 0;
  for (let i = 0; i < 30 * 5 && dr.partner !== k.id; i++) w.update(1 / 30);
  assert.equal(dr.partner, k.id, `${k.name} flies the dragon they raised`);
  // keepers are saved
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.dragons.owned.find((d) => d.id === dr.id).keeper, k.id);
});

test('a dragon show in the pit: keepers perform, the camp watches, everyone goes home rested', () => {
  const w = world(9503);
  const pit = w.colony.addBuilding(w, 'dragonPit', w.camp.x + 520, w.camp.y + 320);
  assert.ok(pit);
  pit.built = 1;
  const k = addHuman(w, pit.x - 40, pit.y + 30, false, { role: 'auto' });
  const watchers = [0, 1, 2, 3].map((i) => addHuman(w, w.camp.x + 200 + i * 20, w.camp.y + 200, false, { role: 'gatherer' }));
  for (const h of watchers) h.energy = 0.5;
  const e = egg(w, pit.x, pit.y, { at: 'camp', progress: 1 });
  keepers.makeKeeper(w, e, k, true);
  const dr = nests.hatch(w, e);
  dr.growth = 0.6;
  dr.age = 800;
  dr.skills = { trust: 1, follow: 1, flight: 1, fire: 1 };
  keep.newDragonStats(dr);
  dr.hp = dr.maxHp;
  assert.equal(shows.showReady(w), null);
  assert.equal(shows.startShow(w), null);
  assert.ok(w.dragons.show.crowd.length >= 3, 'people come to watch');
  let watching = 0;
  let performing = false;
  let fire = false;
  for (let i = 0; i < 30 * (shows.SHOW_SECONDS + 2) && w.dragons.show; i++) {
    w.update(1 / 30);
    watching = Math.max(watching, watchers.filter((h) => h.state === 'watch').length);
    if (k.state === 'show') performing = true;
    if (dr.breath > 0.5) fire = true;
  }
  assert.equal(w.dragons.show, null, 'curtain');
  assert.ok(watching >= 3, `the crowd sat round the rim (${watching})`);
  assert.ok(performing, 'the keeper directed the act');
  assert.ok(fire, 'with a fire trick');
  assert.ok(w.discoveries.has('dragonShow'));
  assert.ok(watchers.some((h) => h.energy > 0.6), 'the audience went home rested');
  // dragons live in the pit
  const home = keep.roostOf(w, dr);
  assert.ok(Math.hypot(home.x - pit.x, home.y - pit.y) < 160, 'home is the pit');
});

test('eggs left by the fire (the Eggs tool): an egg runner carries them into the incubator; with no runner, their keepers do', () => {
  for (const withRunner of [true, false]) {
    const w = world(withRunner ? 9504 : 9505);
    const hatch = w.colony.addBuilding(w, 'hatchery', w.camp.x + 420, w.camp.y + 220);
    hatch.built = 1;
    w.dragons.fuel[hatch.id] = 600;
    const fire = { x: w.camp.x + 160, y: w.camp.y + 120 };
    w.campfires.push({ id: w.nextId(), x: fire.x, y: fire.y, lit: true, fuel: 1, cook: 0 });
    for (let i = 0; i < 3; i++) assert.equal(nests.placeDragonEgg(w, 'fire', fire.x - 40 + i * 30, fire.y - 30), null);
    if (withRunner) {
      const r = addHuman(w, fire.x + 30, fire.y + 40, false, { role: 'eggRunner' });
      w.colony.armory.runnerKit = 1;
      w.colony.dress(w, r);
    }
    for (let i = 0; i < 3; i++) addHuman(w, fire.x - 30 + i * 20, fire.y + 50, false, {});
    const eggs = w.dragons.eggs.filter((e) => e.at !== 'nest');
    const inside = () => eggs.filter((e) => e.at === 'camp' && Math.hypot(e.x - hatch.x, e.y - hatch.y) < 60).length;
    for (let i = 0; i < 30 * 150 && inside() < 3; i++) w.update(1 / 30);
    assert.equal(inside(), 3, `all three eggs are in the incubator (${withRunner ? 'egg runner' : 'keepers'})`);
    assert.ok(eggs.every((e) => keepers.keeperOf(w, e)), 'each with a keeper');
  }
});
