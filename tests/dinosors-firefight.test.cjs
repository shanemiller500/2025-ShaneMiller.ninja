// Fire crews, tougher Scorpions + raids that come from outside (Oct 2026): the Firefighter role and
// fire priorities inside the settlement's protection area, Scorpion damage kinds / condition states /
// wrecks that are rebuilt in place (never a duplicate), the Obsidian Fire Shield, and dinosaur raids
// that gather on a ring outside the whole settlement on valid ground and walk in as a pack.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '..', request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const root = path.join(__dirname, '..', 'app', 'dinosors');
const { World } = require(path.join(root, 'sim', 'world.ts'));
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { T, TILE, MAP_W } = require(path.join(root, 'sim', 'types.ts'));
const { hitScorpion, hitScorpionsAt } = require(path.join(root, 'sim', 'factions.ts'));
const { scorpionCondition, scorpionMaxHp, scorpionWorks, orderObsidian, obsidianProblem, OBSIDIAN_SHIELD } = require(path.join(root, 'sim', 'scorpionArmor.ts'));
const { footprint, distToCamp, refreshFootprint, raidSpotProblem, RAID_MARGIN } = require(path.join(root, 'sim', 'settlement.ts'));
const { fireThreats, refreshFires, claimFire, throwSpot, safeToStand, answersFire, bucketBrigade, OUTER_R } = require(path.join(root, 'sim', 'firefight.ts'));

const DT = 1 / 30;
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w, i * DT) === true) return i * DT;
  }
  return -1;
}

function quiet(seed = 7) {
  const w = new World(seed);
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.storm = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals.clans.length = 0;
  w.rivals.brutes.length = 0;
  w.forest.enabled = false;
  w.seaFolk.enabled = false;
  w.sandFolk.enabled = false;
  w.snowFolk.enabled = false;
  w.snowLife.enabled = false;
  w.wildlife.enabled = false;
  return w;
}

/** Grass under a block of tiles round (x, y) so things can stand / burn there. */
function grass(w, x, y, r = 3) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) w.terrain.setTile(tx + dx, ty + dy, T.Grass);
}

/** A finished, reinforced ground Scorpion on open grass. */
function scorpion(w, x, y, tier = 1) {
  grass(w, x, y, 1);
  const s = w.colony.addScorpion(w, x, y);
  assert.equal(typeof s, 'object', s);
  s.built = 1;
  s.tier = tier;
  s.hp = scorpionMaxHp(s);
  return s;
}

/* ------------------------------ Scorpions ------------------------------ */

test('Scorpion damage: blueprints can\'t be hurt, fire / missiles / blasts only knock one out, heavy blows can destroy it', () => {
  const w = quiet(4);
  const c = w.camp;
  // a blueprint isn't a machine yet
  grass(w, c.x + 420, c.y + 160, 1);
  const bp = w.colony.addScorpion(w, c.x + 420, c.y + 160);
  assert.equal(typeof bp, "object", bp);
  const bp0 = bp.hp;
  hitScorpion(w, bp, 5000, 'wild', 'heavy');
  assert.equal(bp.hp, bp0, 'blueprint untouched');
  assert.ok(w.colony.scorpions.includes(bp));
  const s = scorpion(w, c.x + 260, c.y + 140, 2);
  assert.equal(scorpionCondition(s), 'healthy');
  // a huge fire: badly hurt + knocked out, never destroyed
  for (let i = 0; i < 40; i++) hitScorpion(w, s, 400, 'wild', 'fire');
  assert.ok(s.hp > 0 && s.built >= 1, 'fire never wrecks it');
  assert.equal(scorpionCondition(s), 'disabled');
  assert.equal(scorpionWorks(w, s), false, 'a knocked-out Scorpion can\'t shoot');
  for (let i = 0; i < 40; i++) hitScorpion(w, s, 400, 'clan', 'missile');
  for (let i = 0; i < 40; i++) hitScorpionsAt(w, s.x, s.y, 40, 400, 'wild');
  assert.ok(s.hp > 0 && s.built >= 1, 'nor do missiles or stray blasts');
  // the stages on the way down
  s.hp = scorpionMaxHp(s) * 0.6;
  assert.equal(scorpionCondition(s), 'damaged');
  s.hp = scorpionMaxHp(s) * 0.3;
  assert.equal(scorpionCondition(s), 'heavy');
  assert.equal(scorpionWorks(w, s), true, 'heavily damaged still shoots');
  // a clan boulder finishes it: a wreck on the same spot, rebuilt there (no new one planned beside it)
  const n0 = w.colony.scorpions.length;
  const id = s.id, tx = s.tx, ty = s.ty;
  for (let i = 0; i < 10 && s.built >= 1; i++) hitScorpion(w, s, 400, 'clan', 'heavy');
  assert.equal(s.built, 0, 'destroyed');
  run(w, 0.5);
  assert.equal(w.colony.scorpions.length, n0, 'not deleted, not duplicated');
  const still = w.colony.scorpions.find((o) => o.id === id);
  assert.ok(still && still.tx === tx && still.ty === ty, 'the wreck stays put');
  assert.ok(w.buildSites().some((x) => x.kind === 'scorpion' && x.id === id && !x.repair), 'builders rebuild it in place');
});

test('a Scorpion whose wall / tower is gone drops to the ground instead of vanishing', () => {
  const w = quiet(5);
  const c = w.camp;
  const x = c.x + 320, y = c.y + 200;
  grass(w, x, y, 2);
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  w.tribe.addWall(w, tx, ty, 'palisade');
  const wl = w.tribe.wallAt(tx, ty);
  assert.ok(wl, 'wall placed');
  wl.built = 1;
  const s = w.colony.addScorpion(w, x, y);
  assert.equal(typeof s, 'object', s);
  assert.equal(s.mount, 'wall');
  s.built = 1;
  w.tribe.walls = w.tribe.walls.filter((o) => o !== wl);
  w.tribe.wallMap?.delete?.(ty * MAP_W + tx);
  run(w, 0.2);
  const still = w.colony.scorpions.find((o) => o.id === s.id);
  assert.ok(still, 'still there');
  assert.equal(still.mount, 'ground');
  assert.ok(still.hp > 0);
});

test('Obsidian Fire Shield: any tier with a Blacksmith, shrugs off fire, breath + catapult boulders, other heavy blows still hurt', () => {
  const w = quiet(6);
  const c = w.camp;
  const plain = scorpion(w, c.x + 260, c.y + 140, 1);
  const obs = scorpion(w, c.x + 340, c.y + 140, 1);
  if (!w.colony.finished('blacksmith')) assert.ok(obsidianProblem(w, obs), 'needs a Blacksmith');
  const smith = w.colony.addBuilding(w, 'blacksmith', c.x - 300, c.y + 200);
  assert.ok(smith);
  smith.built = 1;
  assert.equal(obsidianProblem(w, obs), null, 'a basic (tier 1) Scorpion can take it');
  assert.ok(orderObsidian(w, obs));
  const site = w.buildSites().find((x) => x.kind === 'scorpion' && x.id === obs.id);
  assert.ok(site && Object.keys(OBSIDIAN_SHIELD.cost).includes(site.need), 'builders bring obsidian plates');
  // fitted
  obs.obsidianUp = false;
  obs.obsidian = true;
  obs.hp = scorpionMaxHp(obs);
  assert.ok(scorpionMaxHp(obs) > scorpionMaxHp(plain), 'a bit tougher overall');
  const f0 = plain.hp, o0 = obs.hp;
  hitScorpion(w, plain, 100, 'wild', 'breath');
  hitScorpion(w, obs, 100, 'wild', 'breath');
  const plainLoss = f0 - plain.hp, obsLoss = o0 - obs.hp;
  assert.ok(obsLoss > 0, 'not invincible');
  assert.ok(obsLoss < plainLoss * 0.4, `dragon breath mostly glances off (${obsLoss} vs ${plainLoss})`);
  assert.ok(obs.glint > 0, 'heat flashes off the plates');
  const o1 = obs.hp;
  hitScorpion(w, obs, 100, 'clan', 'heavy');
  assert.ok(o1 - obs.hp > 50, 'a heavy blow still hurts');
  // a clan catapult's boulder: mostly turned by the angled glass
  const p1 = plain.hp, o2 = obs.hp;
  hitScorpion(w, plain, 100, 'clan', 'siege');
  hitScorpion(w, obs, 100, 'clan', 'siege');
  assert.ok(o2 - obs.hp < (p1 - plain.hp) * 0.5, `catapult boulders mostly glance off (${o2 - obs.hp} vs ${p1 - plain.hp})`);
  // the shield stays on through an upgrade
  obs.tier = 2;
  assert.ok(obs.obsidian && scorpionMaxHp(obs) > scorpionMaxHp({ tier: 2, obsidian: false }));
  // fit on all: every other one that can take it is ordered at once
  const more = [scorpion(w, c.x + 420, c.y + 140, 1), scorpion(w, c.x + 500, c.y + 140, 3)];
  const { orderObsidianAll, obsidianStatus } = require(path.join(root, 'sim', 'scorpionArmor.ts'));
  assert.equal(obsidianStatus(w).available, 3, 'the plain one + the two new ones');
  assert.equal(orderObsidianAll(w), 3);
  assert.ok(more.every((s) => s.obsidianUp) && plain.obsidianUp);
  assert.equal(obsidianStatus(w).fitting, 3);
  // saved + loaded
  const data = w.colony.serialize();
  assert.ok(data.scorpions.find((x) => x.id === obs.id).obsidian);
});

test('repair, don\'t rebuild: a damaged Scorpion is repaired by Auto workers and no extra one is planned', () => {
  const w = quiet(8);
  for (let i = 0; i < 4; i++) addHuman(w, w.camp.x + i * 10, w.camp.y + 40, false);
  w.camp.learned.add('tools');
  w.camp.learned.add('scorpion');
  const c = w.camp;
  const list = [scorpion(w, c.x + 200, c.y + 150), scorpion(w, c.x + 260, c.y + 150), scorpion(w, c.x + 320, c.y + 150), scorpion(w, c.x + 380, c.y + 150)];
  const hurt = list[3];
  hurt.hp = scorpionMaxHp(hurt) * 0.6;
  assert.ok(w.buildSites().some((s) => s.kind === 'scorpion' && s.id === hurt.id && s.repair), 'on the repair list');
  const n0 = w.colony.scorpions.length;
  const fixed = run(w, 120, () => hurt.hp >= scorpionMaxHp(hurt));
  assert.ok(fixed >= 0, 'repaired');
  assert.equal(w.colony.scorpions.length, n0, 'no fifth Scorpion');
});

/* ------------------------------ fire ------------------------------ */

test('fire priorities: people, then homes, then critical buildings…; far-off fires aren\'t ours to fight', () => {
  const w = quiet(9);
  const c = w.camp;
  w.camp.learned.add('firefighting');
  refreshFootprint(w);
  // a grass fire well outside the protection area
  const far = { x: c.x + 2200, y: c.y + 300 };
  grass(w, far.x, far.y);
  w.fire.ignite(w, Math.floor(far.x / TILE), Math.floor(far.y / TILE), 1);
  // a burning tile beside a healing hut
  const hut = w.colony.addBuilding(w, 'healer', c.x - 260, c.y + 160);
  hut.built = 1;
  w.fire.ignite(w, Math.floor(hut.x / TILE), Math.floor((hut.y + 20) / TILE), 1);
  // someone standing in a fire
  const h = addHuman(w, c.x + 160, c.y + 220, false);
  grass(w, h.x, h.y, 1);
  w.fire.ignite(w, Math.floor(h.x / TILE), Math.floor(h.y / TILE), 1);
  refreshFootprint(w);
  refreshFires(w);
  const list = fireThreats(w);
  assert.ok(list.length >= 2);
  assert.equal(list[0].pri, 1, 'people in danger first');
  assert.ok(list.some((f) => f.pri === 3), 'the healing hut counts as critical');
  assert.ok(!list.some((f) => Math.hypot(f.x - far.x, f.y - far.y) < 64), 'not map-wide');
  for (const f of list) assert.ok(distToCamp(w, f.x, f.y) <= OUTER_R + 1);
});

/** The camp has a finished fire station (so the fire crew, not the bucket brigade, handles fires). */
function stationFor(w) {
  const finished = w.colony.finished.bind(w.colony);
  w.colony.finished = (k) => k === 'fireStation' || finished(k);
}

test('no fire station + fire near camp: the bucket brigade (no invention needed) puts it out fast', () => {
  const w = quiet(12);
  const c = w.camp;
  assert.ok(!c.learned.has('firefighting'), 'nobody has invented fire fighting');
  c.stock.water = 40;
  const people = [];
  for (let i = 0; i < 5; i++) {
    const h = addHuman(w, c.x - 40 + i * 20, c.y + 40, false);
    h.role = i < 3 ? 'gatherer' : 'builder';
    people.push(h);
  }
  const at = { x: c.x + 200, y: c.y + 170 };
  grass(w, at.x, at.y, 3);
  const tx = Math.floor(at.x / TILE), ty = Math.floor(at.y / TILE);
  w.fire.ignite(w, tx, ty, 1);
  refreshFootprint(w);
  refreshFires(w);
  assert.ok(bucketBrigade(w), 'the brigade is called out');
  assert.ok(people.every((h) => answersFire(w, h)), 'every grown-up grabs a bucket');
  const out = run(w, 60, () => {
    let burning = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) burning += w.fire.heat[(ty + dy) * MAP_W + tx + dx] > 0.1 ? 1 : 0;
    return burning === 0;
  });
  assert.ok(out >= 0, 'the fire is out');
  run(w, 10);
  assert.ok(people.every((h) => h.site !== 'douse'), 'everyone back to work');
});

test('a firefighter puts out a fire in camp from a safe spot, a busy gatherer keeps working, and both go back to normal after', () => {
  const w = quiet(10);
  const c = w.camp;
  c.learned.add('firefighting');
  c.stock.water = 30;
  const ff = addHuman(w, c.x + 20, c.y + 40, false);
  ff.role = 'firefighter';
  const g = addHuman(w, c.x - 30, c.y + 40, false);
  g.role = 'gatherer';
  // with a fire station the fire crew handles it (no station = the bucket brigade, tested below)
  stationFor(w);
  // a small patch of burning grass near the camp's edge
  const at = { x: c.x + 230, y: c.y + 190 };
  grass(w, at.x, at.y, 3);
  const tx = Math.floor(at.x / TILE), ty = Math.floor(at.y / TILE);
  w.fire.ignite(w, tx, ty, 1);
  refreshFootprint(w);
  refreshFires(w);
  assert.ok(fireThreats(w).length, 'the fire is in our area');
  assert.equal(answersFire(w, ff), true);
  assert.equal(answersFire(w, g), false, 'a small fire is the fire crew\'s job');
  // the throwing spot is never in the flames
  const spot = throwSpot(w, fireThreats(w)[0], ff);
  assert.ok(spot && safeToStand(w, spot.x, spot.y));
  let stoodInFire = false;
  const out = run(w, 90, () => {
    const i = Math.floor(ff.y / TILE) * MAP_W + Math.floor(ff.x / TILE);
    if (ff.state === 'douse' && w.fire.heat[i] > 0.6) stoodInFire = true;
    let burning = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) burning += w.fire.heat[(ty + dy) * MAP_W + tx + dx] > 0.1 ? 1 : 0;
    return burning === 0;
  });
  assert.ok(out >= 0, 'the fire is out');
  assert.equal(stoodInFire, false, 'never threw from inside the blaze');
  run(w, 3);
  assert.notEqual(ff.site, 'douse', 'back to normal work');
  assert.equal(claimFire(w, ff), null);
});

test('a major fire (a home burning) brings nearby workers to help; the crew spreads over different spots', () => {
  const w = quiet(11);
  const c = w.camp;
  c.learned.add('firefighting');
  c.stock.water = 40;
  grass(w, c.x + 240, c.y + 200, 4);
  const home = c.addShelter(w, c.x + 240, c.y + 200);
  home.stage = 9;
  const people = [];
  for (let i = 0; i < 4; i++) {
    const h = addHuman(w, home.x + 60 + i * 12, home.y + 60, false);
    h.role = 'gatherer';
    h.home = home.id;
    people.push(h);
  }
  people[0].role = 'firefighter';
  const tx = Math.floor(home.x / TILE), ty = Math.floor(home.y / TILE);
  for (let dx = -2; dx <= 2; dx++) w.fire.ignite(w, tx + dx, ty + 1, 1);
  refreshFootprint(w);
  refreshFires(w);
  const list = fireThreats(w);
  assert.ok(list.some((f) => f.pri === 2), 'an occupied home is burning');
  assert.ok(people.slice(1).some((h) => answersFire(w, h)), 'regular workers nearby help with a major fire');
  const spots = people.map((h) => claimFire(w, h)).filter(Boolean);
  assert.ok(new Set(spots.map((f) => f.i)).size >= 2, 'not everyone piles onto one tile');
});

/* ------------------------------ raids ------------------------------ */

test('raid spawn validation: never water, lava, walls, inside or beside the camp, beside people or in another people\'s camp', () => {
  const w = quiet(12);
  const c = w.camp;
  const h = addHuman(w, c.x, c.y + 40, false);
  assert.ok(raidSpotProblem(w, 'raptor', c.x, c.y + 40), 'not in the camp');
  const out = { x: c.x + 2600, y: c.y };
  grass(w, out.x, out.y, 2);
  refreshFootprint(w);
  if (distToCamp(w, out.x, out.y) > RAID_MARGIN) {
    assert.equal(raidSpotProblem(w, 'raptor', out.x, out.y), null, 'open grass far out is fine');
    h.x = out.x + 40;
    h.y = out.y;
    assert.match(raidSpotProblem(w, 'raptor', out.x, out.y), /beside/);
    h.x = c.x;
    h.y = c.y;
    w.terrain.setTile(Math.floor(out.x / TILE), Math.floor(out.y / TILE), T.Deep);
    assert.ok(raidSpotProblem(w, 'raptor', out.x, out.y), 'not in deep water');
  }
});

test('a dinosaur raid gathers outside the whole settlement (not just the cave), as a pack, and walks in before attacking', () => {
  const w = quiet(13);
  const c = w.camp;
  for (let i = 0; i < 4; i++) addHuman(w, c.x + i * 10, c.y + 40, false);
  w.tribe.danger = 'normal';
  // the settlement has grown well east of the cave
  for (let k = 1; k <= 3; k++) {
    const b = w.colony.addBuilding(w, 'storage', c.x + 400 + k * 230, c.y + 120);
    if (b) b.built = 1;
  }
  refreshFootprint(w);
  const f = footprint(w);
  assert.ok(w.tribe.startRaid(w), 'a raid started');
  const raiders = w.tribe.raid.ids.map((id) => w.dinos.find((d) => d.id === id)).filter(Boolean);
  assert.ok(raiders.length >= 2);
  for (const d of raiders) {
    assert.ok(distToCamp(w, d.x, d.y) >= RAID_MARGIN - 1, `spawned well outside every part of the camp (${Math.round(distToCamp(w, d.x, d.y))}px)`);
    assert.ok(!w.tribe.walledIn(w, d.x, d.y));
    assert.ok(!w.humans.some((h) => Math.hypot(h.x - d.x, h.y - d.y) < 300), 'nobody right beside it');
  }
  const cx = raiders.reduce((s, d) => s + d.x, 0) / raiders.length;
  const cy = raiders.reduce((s, d) => s + d.y, 0) / raiders.length;
  for (const d of raiders) assert.ok(Math.hypot(d.x - cx, d.y - cy) < 260, 'they arrive together');
  const d0 = Math.hypot(cx - f.cx, cy - f.cy);
  run(w, 8);
  const mx = raiders.reduce((s, d) => s + d.x, 0) / raiders.length;
  const my = raiders.reduce((s, d) => s + d.y, 0) / raiders.length;
  assert.ok(Math.hypot(mx - f.cx, my - f.cy) < d0 - 40, 'the pack moves in, in view');
  assert.ok(raiders.every((d) => distToCamp(w, d.x, d.y) > 400), 'still outside before the attack starts');
});
