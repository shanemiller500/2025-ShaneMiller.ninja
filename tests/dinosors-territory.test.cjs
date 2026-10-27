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
const { T, TILE, MAX_PEOPLE, BASE_PEOPLE } = require(path.join(root, 'sim', 'types.ts'));
const data = require(path.join(root, 'data', 'colony.ts'));
const terr = require(path.join(root, 'sim', 'territory.ts'));
const pop = require(path.join(root, 'sim', 'population.ts'));

const DT = 1 / 30;
function world(seed, people = 4) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.daylight = 1;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  for (const t of ['tools', 'spear', 'taming']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 25; y <= cy + 25; y++) for (let x = cx - 25; x <= cx + 45; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x + w.humans.length * 20, w.camp.y + 40);
  for (const h of w.humans) { h.child = false; h.role = 'auto'; }
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

test('shock sticks + ray guns: battery sidearms everyone carries, handed out as an even mix', () => {
  for (const id of terr.SIDEARMS) {
    const wp = data.WEAPON_BY_ID[id];
    assert.ok(wp && wp.sidearm && wp.battery, id);
  }
  assert.ok(data.WEAPON_BY_ID.shockStick.melee && !data.WEAPON_BY_ID.rayGun.melee, 'one up close, one at range');
  const w = world(9501, 6);
  w.colony.armory.shockStick = 3;
  w.colony.armory.rayGun = 3;
  for (const h of w.humans) terr.carrySidearm(w, h);
  const n = (id) => w.humans.filter((h) => h.gear.sidearm === id).length;
  assert.equal(n('shockStick') + n('rayGun'), 6, 'everyone has one');
  assert.ok(Math.abs(n('shockStick') - n('rayGun')) <= 1, 'a mix of both');
  // a guard's main weapon pick never takes a sidearm off the rack
  w.colony.armory.rayGun = 2;
  const g = w.humans[0];
  g.gear.weapon = null;
  w.colony.equip(w, g);
  assert.notEqual(g.gear.weapon, 'rayGun');
  // the sidearm is what they fight with when they have nothing else
  assert.equal(w.tribe.weaponFor(w, w.humans[1]).id, w.humans[1].gear.sidearm);
  // the auto smith wants one for everyone
  const bare = world(9502, 3);
  assert.ok(terr.sidearmWanted(bare, bare.humans));
});

test('our ground: inside the walls and round everything we built, and not out in the wilds', () => {
  const w = world(9503);
  assert.ok(terr.inTerritory(w, w.camp.x, w.camp.y + 40));
  assert.ok(!terr.inTerritory(w, w.camp.x + 3000, w.camp.y + 2000));
  // a hut further out grows the ground with it
  const far = { x: w.camp.x + 900, y: w.camp.y };
  assert.ok(!terr.inTerritory(w, far.x + 60, far.y));
  w.colony.buildings.push({ id: w.nextId(), kind: 'storage', tx: Math.floor(far.x / TILE), ty: Math.floor(far.y / TILE), x: far.x, y: far.y, built: 1, hp: 100, have: {} });
  w.elapsed += 10; // the settlement outline is cached for a moment
  assert.ok(terr.inTerritory(w, far.x + 60, far.y), 'the ground grows as we build');
});

test('a wild animal on our ground is driven out by the nearest person with a sidearm, and not killed', () => {
  const w = world(9504, 3);
  for (const h of w.humans) h.gear.sidearm = 'rayGun';
  const d = addDino(w, 'trike', w.camp.x + 160, w.camp.y + 60, { age: 9999 });
  // ours + friends' animals are left alone
  const mine = addDino(w, 'trike', w.camp.x - 160, w.camp.y + 60, { owner: true, tame: 1, age: 9999 });
  const friend = addDino(w, 'para', w.camp.x - 100, w.camp.y + 80, { age: 9999 });
  friend.seaTribe = 1;
  assert.ok(terr.isStray(d) && !terr.isStray(mine) && !terr.isStray(friend));
  assert.ok(terr.inTerritory(w, d.x, d.y));
  let chased = false;
  const out = run(w, 90, () => {
    if (w.humans.some((h) => h.repelId === d.id)) chased = true;
    return !terr.inTerritory(w, d.x, d.y);
  });
  assert.ok(chased, 'someone went to see it off');
  assert.ok(out, `driven off our ground (${Math.round(d.x - w.camp.x)}, ${Math.round(d.y - w.camp.y)})`);
  assert.ok(w.dinos.includes(d) && d.health > 0, 'alive: repelled, not killed');
  assert.ok(w.dinos.includes(mine) && !mine.shooed, 'our own trike was left alone');
});

test('armed with a sidearm, people face a raider instead of running', () => {
  const w = world(9505, 3);
  const [h] = w.humans;
  h.gear.sidearm = 'shockStick';
  h.role = 'gatherer';
  const raptor = addDino(w, 'raptor', h.x + 120, h.y, { age: 9999 });
  raptor.raider = true;
  let fled = false;
  let faced = false;
  run(w, 6, () => {
    if (h.state === 'flee' || h.state === 'hide') fled = true;
    if (h.state === 'hunt' || h.state === 'aim') faced = true;
  });
  assert.ok(faced, 'they went for it');
  assert.ok(!fled, 'and never ran');
});

test('⚡ Sweep: the picked people chase every stray off our ground, then the sweep ends', () => {
  const w = world(9506, 4);
  for (const h of w.humans) h.gear.sidearm = 'rayGun';
  const strays = [addDino(w, 'trike', w.camp.x + 200, w.camp.y + 90, { age: 9999 }), addDino(w, 'para', w.camp.x - 200, w.camp.y + 120, { age: 9999 })];
  const picked = w.humans.slice(0, 2);
  assert.equal(terr.startSweep(w, picked), 2);
  assert.ok(picked.every((h) => h.sweep));
  const done = run(w, 150, () => !terr.straysIn(w).length && !picked.some((h) => h.sweep));
  assert.ok(done, `swept (${terr.straysIn(w).length} left)`);
  assert.ok(strays.every((d) => w.dinos.includes(d)), 'all still alive');
});

test('past 100 people once the tribe is stable (fed, safe, housed), up to 200; short of homes, the player is told', () => {
  assert.equal(BASE_PEOPLE, 100);
  assert.equal(MAX_PEOPLE, 200);
  const w = world(9507, 4);
  // no food: it stays at the base cap
  for (const r of ['cooked', 'crop', 'fish', 'berries']) w.camp.stock[r] = 0;
  assert.equal(pop.peopleCap(w), BASE_PEOPLE);
  // fed + housed + safe: it can grow to 200
  w.camp.stock.cooked = 500;
  assert.ok(w.population.capacity(w) >= w.humans.length);
  assert.equal(pop.peopleCap(w), MAX_PEOPLE);
  // out of room: a "more homes needed" message
  const toasts = [];
  const orig = w.toast.bind(w);
  w.toast = (icon, text, x, y) => { toasts.push(text); return orig(icon, text, x, y); };
  w.population.needHomes(w, 40);
  assert.ok(toasts.some((t) => /More homes needed/.test(t)), toasts.join(' | '));
});
