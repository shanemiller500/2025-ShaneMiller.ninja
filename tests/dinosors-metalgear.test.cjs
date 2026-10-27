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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const data = require(path.join(root, 'data', 'colony.ts'));
const gear = require(path.join(root, 'sim', 'gear.ts'));
const { hurtHuman } = require(path.join(root, 'sim', 'injury.ts'));
const tiers = require(path.join(root, 'sim', 'chariotTiers.ts'));

const DT = 1 / 30;
function world(seed, people = 4) {
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
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'spear', 'axe', 'bow', 'taming', 'dragonHunting', 'smelting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 10; y <= cy + 20; y++) for (let x = cx - 10; x <= cx + 40; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x + w.humans.length * 20, w.camp.y + 40);
  for (const h of w.humans) h.child = false;
  return w;
}
function run(w, s, each) {
  for (let i = 0; i < Math.round(s / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}
function building(w, kind, dx, dy) {
  const b = w.colony.addBuilding(w, kind, w.camp.x + dx, w.camp.y + dy);
  assert.ok(b && typeof b === 'object', `${kind} placed (${b})`);
  b.built = 1;
  b.hp = data.BUILDINGS[kind].hp;
  w.colony.version++;
  return b;
}

test('the refinery smelts iron + coal into steel (coal only, and it keeps some iron back)', () => {
  const w = world(9301);
  building(w, 'refinery', 260, 120);
  Object.assign(w.camp.stock, { iron: 10, coal: 0, wood: 10, copper: 0, gold: 0, silver: 0, steel: 0 });
  run(w, 30);
  assert.equal(w.camp.stock.steel, 0, 'a log fire is not hot enough for steel');
  w.camp.stock.coal = 10;
  assert.ok(run(w, 60, () => w.camp.stock.steel >= 2), `steel poured (${w.camp.stock.steel})`);
  run(w, 120);
  assert.ok(w.camp.stock.iron >= 4, `some raw iron kept for iron recipes (${w.camp.stock.iron})`);
});

test('a full metal progression: copper, iron and steel weapons, the steel tower shield and every armour set', () => {
  const ids = ['spearC', 'axeC', 'swordC', 'spear2', 'axe2', 'sword2', 'spear3', 'axe3', 'sword3'];
  for (const id of ids) assert.ok(data.WEAPON_BY_ID[id], id);
  // each step up hits harder: stone/bone → copper → iron → steel
  for (const [a, b, c, d] of [['spear1', 'spearC', 'spear2', 'spear3'], ['axe1', 'axeC', 'axe2', 'axe3'], ['sword1', 'swordC', 'sword2', 'sword3']]) {
    assert.ok(data.WEAPON_BY_ID[a].dmg < data.WEAPON_BY_ID[b].dmg && data.WEAPON_BY_ID[b].dmg < data.WEAPON_BY_ID[c].dmg && data.WEAPON_BY_ID[c].dmg < data.WEAPON_BY_ID[d].dmg, `${a} < ${b} < ${c} < ${d}`);
  }
  assert.ok(data.WEAPON_BY_ID.spearC.cost.copperBar && data.WEAPON_BY_ID.spear3.cost.steel, 'made of smelted metal');
  assert.equal(data.SHIELD_BY_ID.shield4.name, 'Steel tower shield');
  assert.ok(data.SHIELD_BY_ID.shield4.block > data.SHIELD_BY_ID.shield3.block);
  for (const id of ['armorHide', 'armorCopper', 'armorIron', 'armorSteel', 'armorElite', 'armorRider']) {
    assert.ok(data.ARMOR_BY_ID[id], id);
    assert.ok(data.FORGE_ITEMS.some((f) => f.id === id && f.cat === 'armor'), `${id} can be made at the forge`);
  }
  const w = world(9302);
  building(w, 'blacksmith', 260, 120);
  assert.ok(w.colony.canCraft(w, 'armorSteel'), 'the blacksmith makes steel plate');
  assert.ok(w.colony.canCraft(w, 'steelSaddles'));
});

test('people put on armour from the armory (riders take rider armour) and it really cuts the harm they take', () => {
  const w = world(9303, 4);
  const [guard, worker, rider] = w.humans;
  guard.role = 'guard';
  worker.role = 'gatherer';
  rider.role = 'gatherer';
  rider.partner = 9999; // a Dino Rider
  w.colony.armory.armorSteel = 1;
  w.colony.armory.armorHide = 1;
  w.colony.armory.armorRider = 1;
  w.colony.armory.shield4 = 1;
  w.colony.armory.spearC = 1;
  // the tribe hands gear out with the job round
  run(w, 4);
  assert.equal(rider.gear.armor, 'armorRider', 'the rider takes the rider armour');
  assert.equal(guard.gear.armor, 'armorSteel', 'the guard takes the steel plate');
  assert.equal(worker.gear.armor, 'armorHide', 'the worker gets the hide armour');
  assert.equal(guard.gear.shield, 4, 'the guard takes up the tower shield');
  assert.equal(guard.gear.weapon, 'spearC', 'and the copper spear');
  // the same bite on someone bare and on the armoured guard
  const bare = w.humans[3];
  bare.gear = { weapon: null, shield: 0 };
  bare.hp = 1;
  guard.hp = 1;
  hurtHuman(w, bare, 0.3, bare.x - 20, bare.y, 'bite');
  hurtHuman(w, guard, 0.3, guard.x - 20, guard.y, 'bite');
  const bareLoss = 1 - bare.hp;
  const guardLoss = 1 - guard.hp;
  assert.ok(guardLoss < bareLoss * 0.35, `armour + shield cut it right down (${guardLoss.toFixed(3)} vs ${bareLoss.toFixed(3)})`);
  assert.ok(guardLoss >= 0.3 * gear.MIN_HARM - 1e-9, 'but never to nothing');
  assert.ok(gear.protection(w, guard) > 0.6);
});

test('steel saddles: riders hit harder from the saddle and take less up there', () => {
  const w = world(9304, 2);
  const [h] = w.humans;
  const d = addDino(w, 'trike', h.x + 30, h.y, { owner: true, tame: 1, age: 9999 });
  h.riding = d.id;
  d.rider = h.id;
  assert.equal(gear.mountedDamage(w, h), 1);
  w.colony.kits.add('steelSaddles');
  assert.equal(gear.mountedDamage(w, h), gear.SADDLE_DMG);
  assert.ok(gear.armorGuard(w, h, 'bite') < 1, 'the saddle takes some of it');
  h.gear.armor = 'armorRider';
  const mountedGuard = gear.armorGuard(w, h, 'bite');
  h.riding = 0;
  const footGuard = gear.armorGuard(w, h, 'bite');
  assert.ok(mountedGuard < footGuard, `rider armour is better mounted (${mountedGuard.toFixed(2)} < ${footGuard.toFixed(2)})`);
});

test('the auto smith makes armour for the tribe once there is steel and a blacksmith', () => {
  const w = world(9305, 5);
  for (const h of w.humans) h.role = 'auto';
  building(w, 'blacksmith', 260, 120);
  Object.assign(w.camp.stock, { steel: 20, iron: 20, hide: 20, bone: 10, copperBar: 10, goldBar: 2, wood: 20, stick: 20, stone: 20 });
  const made = run(w, 240, () => Object.keys(w.colony.armory).some((id) => data.ARMOR_BY_ID[id] && w.colony.armory[id] > 0) || w.humans.some((h) => h.gear.armor));
  assert.ok(made, `armour made (queue ${JSON.stringify(w.colony.queue)}, armory ${JSON.stringify(w.colony.armory)})`);
});

test('the steel war fortress: the last chariot upgrade, toughest of all, and its spiked wheels cut what it rolls into', () => {
  const w = world(9306, 4);
  building(w, 'blacksmith', 260, 120);
  const b = w.colony.addBuilding(w, 'warChariot', w.camp.x + 400, w.camp.y + 200);
  b.built = 1;
  run(w, 0.2);
  const c = w.colony.chariots[0];
  assert.ok(c);
  c.tier = 2;
  c.maxHp = tiers.CHARIOT_TIERS[2].hp;
  c.hp = c.maxHp;
  assert.equal(tiers.nextChariotTier(c).name, 'Steel war fortress');
  assert.equal(tiers.orderChariotUpgrade(w, c), null);
  tiers.finishChariotUpgrade(c);
  assert.equal(c.tier, 3);
  assert.ok(c.maxHp > tiers.CHARIOT_TIERS[2].hp);
  assert.ok(tiers.chariotUpgradeProblem(w, c), 'nothing past the fortress');
  // roll it into a hostile raptor
  const trike = addDino(w, 'trike', c.x + 80, c.y, { owner: true, tame: 1, age: 9999, hunger: 0, thirst: 0 });
  run(w, 1.5);
  assert.ok(c.trike, 'harnessed');
  const foe = addDino(w, 'raptor', c.x + 40, c.y, { age: 9999 });
  foe.raider = true;
  const hp0 = foe.health;
  c.to = { x: c.x + 600, y: c.y };
  run(w, 0.5);
  assert.ok(foe.health < hp0, `cut by the wheels (${hp0} → ${foe.health})`);
  void trike;
});
