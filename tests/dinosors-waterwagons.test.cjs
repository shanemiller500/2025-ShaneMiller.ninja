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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const lava = require(path.join(root, 'sim', 'lavaFolk.ts'));
const wagons = require(path.join(root, 'sim', 'waterWagons.ts'));
const build = require(path.join(root, 'sim', 'build.ts'));
const { NODES } = require(path.join(root, 'data', 'colony.ts'));

const DT = 1 / 30;
function world(seed, people = 8) {
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
  w.rivals['arriveT'] = Infinity;
  w.wildlife.enabled = false;
  for (const t of ['tools', 'spear', 'firefighting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 10; x <= cx + 60; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x + (w.humans.length % 6) * 18, w.camp.y + 30 + Math.floor(w.humans.length / 6) * 18);
  // the stores start dry: otherwise everyone joins in with buckets and the wagon isn't what's tested
  w.camp.stock.water = 0;
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
function wagon(w, x, y) {
  const b = w.colony.addBuilding(w, 'waterWagon', x, y);
  assert.ok(b && typeof b === 'object', 'placed');
  b.built = 1;
  run(w, 0.1);
  return w.colony.wagons[w.colony.wagons.length - 1];
}
/** A Lava Monster held in place (it doesn't wander home or throw lava, so the test is about the wagon). */
function pinnedLava(w, x, y) {
  const d = lava.spawnLavaFolk(w, x, y);
  const hold = () => {
    if (!w.dinos.includes(d)) return;
    d.x = x; d.y = y; d.vx = d.vy = 0; d.lavaCd = 99; d.homeX = x; d.homeY = y;
  };
  return { d, hold };
}

test('a finished water wagon rolls out of the yard with a full tank, and saves + loads', () => {
  const w = world(7101);
  const g = wagon(w, w.camp.x + 300, w.camp.y + 150);
  assert.ok(g, 'it rolled out');
  assert.ok(!w.colony.buildings.some((b) => b.kind === 'waterWagon'), 'the build site is cleared');
  assert.equal(g.tank, g.tankMax);
  assert.equal(g.mode, 'home');
  assert.equal(g.auto, true, 'it goes by itself');
  g.tank = 21;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.colony.wagons.length, 1);
  assert.equal(back.colony.wagons[0].tank, 21);
});

test('a Lava Monster comes near: a crew of 3 run to the wagon, roll it out and hose it into a lava-stone statue', () => {
  const w = world(7102);
  const g = wagon(w, w.camp.x + 300, w.camp.y + 150);
  const { d, hold } = pinnedLava(w, g.x + 700, g.y);
  hold();
  let crewed = 0, rolled = false, hosed = false, closest = Infinity;
  const done = run(w, 120, () => {
    hold();
    crewed = Math.max(crewed, g.crew.length);
    if (g.mode === 'out' && g.to) rolled = true;
    if (g.spray > 0) hosed = true;
    if (w.dinos.includes(d)) closest = Math.min(closest, Math.hypot(d.x - g.x, d.y - g.y));
    return !w.dinos.includes(d);
  });
  run(w, 0.2);
  assert.equal(crewed, wagons.WAGON_CREW, 'a full crew was called up');
  assert.ok(rolled, 'they rolled it out');
  assert.ok(hosed, 'it hosed it');
  assert.ok(done, 'the Lava Monster set solid');
  assert.ok(closest > 100, `it stood off out of reach (${Math.round(closest)} px)`);
  assert.ok(g.tank < g.tankMax, 'the tank emptied as it sprayed');
  assert.equal(g.stoned, 1, 'it counts the statue');
  const statue = lava.lavaStatues(w).find((s) => s.id === d.id);
  assert.ok(statue, 'a statue stands where it fell');
  const node = w.colony.nodes.find((n) => n.id === statue.node);
  assert.equal(node.kind, 'lavaStone');
  assert.equal(NODES.lavaStone.gives, 'lavaStone', 'dig it for lava stone');
});

test('the tank runs dry: it rolls home, refills from the water stores, and the crew go back to work', () => {
  const w = world(7103);
  const g = wagon(w, w.camp.x + 300, w.camp.y + 150);
  const { d, hold } = pinnedLava(w, g.x + 500, g.y);
  hold();
  g.tank = 8;
  g.tankMax = 60;
  // a big, hot one that 8 squirts won't finish
  d.lavaHeat = 1;
  wagons.sendWagon(w, g);
  const went = run(w, 60, () => { hold(); d.lavaHeat = 1; return g.mode === 'back'; });
  assert.ok(went, 'heading home when the tank ran dry');
  assert.equal(g.tank, 0);
  // the Lava Monster goes away while it's refilling
  w.dinos.splice(w.dinos.indexOf(d), 1);
  w.camp.stock.water = 200;
  const water = w.camp.stock.water;
  const home = run(w, 60, () => g.mode === 'home' && g.tank >= g.tankMax);
  assert.ok(home, 'home and full again');
  assert.ok(w.camp.stock.water < water, 'the water came from the stores');
  run(w, 12);
  assert.equal(g.crew.length, 0, 'the crew stand down');
  assert.ok(w.humans.every((h) => !h.wagon), 'nobody is still tied to it');
});

test('a Lava Monster right up against it burns it, and too much smashes it (the crew jump clear)', () => {
  const w = world(7104);
  const g = wagon(w, w.camp.x + 300, w.camp.y + 150);
  g.auto = false;
  const { d, hold } = pinnedLava(w, g.x + 20, g.y);
  hold();
  const hp = g.hp;
  run(w, 1, hold);
  assert.ok(g.hp < hp, 'scorched');
  run(w, 20, hold);
  assert.ok(!w.colony.wagons.includes(g), 'smashed');
});

test('Lava-stone walls: built from lava stone, the toughest wall, and the polygon age never downgrades them', () => {
  const w = world(7105);
  const tx = Math.floor(w.camp.x / TILE) + 12, ty = Math.floor(w.camp.y / TILE) + 8;
  const wl = w.tribe.addWall(w, tx, ty, 'lava', 'wall');
  assert.ok(wl, 'planned');
  assert.deepEqual(build.wallNeed(wl), { r: 'lavaStone', n: 2 });
  wl.built = 1;
  wl.hp = build.wallMaxHp(wl);
  assert.ok(build.WALL_HP.lava > build.WALL_HP.polygon, 'tougher than polygon stone');
  const sites = build.sites(w);
  assert.ok(!sites.some((s) => s.kind === 'wall' && s.id === wl.id && s.locked), 'never locked behind research');
  // a polygon wall drawn over with lava stone is upgraded
  const poly = w.tribe.addWall(w, tx + 1, ty, 'polygon', 'wall');
  poly.built = 1;
  poly.hp = 900;
  w.tribe.addWall(w, tx + 1, ty, 'lava', 'wall');
  assert.equal(poly.upgrade, true);
  assert.equal(poly.upTo, 'lava');
  // the polygon age rebuilds walls in polygon stone, but leaves lava stone alone
  w.civ.done.add('precisionStone');
  assert.ok(w.civ.polygonAge);
  run(w, 1);
  assert.equal(wl.kind, 'lava');
  assert.ok(!wl.upgrade, 'not queued to be "upgraded" to polygon');
  assert.equal(poly.upTo, 'lava');
  // saved + loaded: still lava stone (and the queued upgrade to it)
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.tribe.wallAt(tx, ty).kind, 'lava');
  assert.equal(back.tribe.wallAt(tx + 1, ty).upTo, 'lava');
});

test('a Scorpion out past camp, with no guards: a free hand crews it and it turns water cannon on a Lava Monster', () => {
  const w = world(7106);
  for (const h of w.humans) h.role = 'gatherer';
  const { CAMP_LEVELS } = require(path.join(root, 'data', 'facts.ts'));
  const R = CAMP_LEVELS[w.tribe.level].radius;
  const s = w.colony.addScorpion(w, w.camp.x + R + 160, w.camp.y + 40);
  s.built = 1;
  s.hp = 999;
  // well outside the camp's ring (where a raptor would be ignored), but inside the Scorpion's reach
  const { d, hold } = pinnedLava(w, s.x + 260, s.y);
  hold();
  w.camp.stock.water = 40;
  let crewed = false, cannon = false;
  run(w, 60, () => {
    hold();
    if (s.crew) crewed = true;
    if (lava.lavaSplashes(w).some((x) => x.kind === 'cannon')) cannon = true;
    return cannon;
  });
  assert.ok(crewed, 'someone crewed it');
  assert.equal(s.water, true, 'it swung round as a water cannon');
  assert.ok(cannon, 'it fired water at the Lava Monster');
  assert.ok(!w.tribe.projectiles.some((p) => p.kind === 'scorpion' && p.target === d.id), 'no bolts at it');
});
