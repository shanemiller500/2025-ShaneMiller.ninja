// The snowy peaks + defence upgrade (Oct 2026): Snow People, snow animals (snow leopard, Rimeclaw,
// Frosthorn, Glacierback, the Snow Rex + the Yeti), Sand Dragons that really fly, Clear area that
// never sticks, moving groups of wall pieces, friendly-fire-proof Scorpions, rain gear that keeps
// people working, Dragon Shields, and bulk job tools that never break a Dragon Rider's bond.
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
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { T, TILE, MAP_W } = require(path.join(root, 'sim', 'types.ts'));
const { REGION } = require(path.join(root, 'sim', 'terrain.ts'));
const { makePlant } = require(path.join(root, 'sim', 'plants.ts'));
const { startClearJob, clearJobsTick, plantsLeft } = require(path.join(root, 'sim', 'clearArea.ts'));
const { hitScorpionsAt, canHurt } = require(path.join(root, 'sim', 'factions.ts'));
const { breathBlast } = require(path.join(root, 'sim', 'breath.ts'));
const { rainSendsIn } = require(path.join(root, 'sim', 'humans.ts'));
const { shieldRadius, upgradeShield, SHIELD } = require(path.join(root, 'sim', 'dragonShield.ts'));
const { snowGround, SNOW_SPECIES } = require(path.join(root, 'sim', 'snowBeasts.ts'));
const { protectedRole } = require(path.join(root, 'sim', 'duties.ts'));
const { Engine } = require(path.join(root, 'game', 'engine.ts'));

const DT = 1 / 30;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w, i * DT) === true) return i * DT;
  }
  return -1;
}

/** A populated world with the wandering + random bits switched off (each test turns on what it needs). */
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

/** An engine with no canvas: enough for the job + wall tools. */
function headlessEngine(w) {
  const e = Object.create(Engine.prototype);
  e.world = w;
  e.audio = { play() {} };
  e.emit = () => {};
  e.wallSel = new Set();
  e.wallUndo = [];
  return e;
}

/** A finished, grown, tamed dragon bonded to h. */
function ourDragon(w, h, x, y) {
  const dr = { id: w.dragons.nextId(), kind: 'dragon', name: 'Ember', x, y, z: 0, vx: 0, vy: 0, dir: 1, hp: 3000, maxHp: 3000, state: 'idle', t: 0, target: 0, tx: x, ty: y, breath: 0, anim: 0, hue: 0, passes: 0, hit: 0, breed: 'fire', owner: true, growth: 1, skills: { flight: 1, combat: 1, fire: 1, rider: 1, trust: 1, follow: 1 }, partner: h.id, keeper: h.id };
  w.dragons.owned.push(dr);
  h.role = 'dragonKeeper';
  return dr;
}

test('Sand Dragons really fly: perch → take off → patrol in the air → land + fold their wings at the roost', () => {
  const w = quiet(7);
  w.sandFolk.enabled = true;
  w.elapsed = 400;
  w.sandFolk.update(w, 0.05);
  const dr = w.dragons.list.find((d) => d.sandTribe);
  assert.ok(dr, 'a tribe with a Sand Dragon');
  assert.ok(dr.skills?.flight >= 1, 'it can use the shared flight');
  dr.skyT = 0.1;
  const seen = new Set();
  let top = 0;
  run(w, 90, () => {
    seen.add(dr.state);
    top = Math.max(top, dr.z);
  });
  assert.ok(top > 120, `it climbed into the sky (max z ${Math.round(top)})`);
  assert.ok(seen.has('fly'), 'a takeoff');
  assert.ok(seen.has('circle'), 'a patrol flight');
  // the patrol ends: home, down, wings folded (z 0 on the ground)
  dr.passes = 0;
  dr.skyT = 999;
  run(w, 60);
  assert.ok(['perch', 'sleep'].includes(dr.state), `back on its perch (${dr.state})`);
  assert.equal(dr.z, 0, 'on the ground (the art folds its wings at z ≤ 6)');
  const t = w.sandFolk.tribes.find((x) => x.id === dr.sandTribe);
  const roost = t.tents.find((x) => x.kind === 'roost') ?? t;
  assert.ok(dist(dr, roost) < 60, 'at the roost');
});

test('a Sand Dragon whose rider was knocked off flies back down to them and they climb back on', () => {
  const w = quiet(7);
  w.sandFolk.enabled = true;
  w.elapsed = 400;
  w.sandFolk.update(w, 0.05);
  const dr = w.dragons.list.find((d) => d.sandTribe);
  const rider = w.rivals.byId(dr.sandRider);
  rider.onDragon = undefined;
  dr.sandRider = undefined;
  rider.x = dr.x + 400;
  rider.y = dr.y + 80;
  dr.skyT = 999;
  const t = run(w, 60, () => dr.sandRider === rider.id);
  assert.ok(t >= 0, 'back in the saddle');
});

test('Clear area clears the box completely, skips plants nobody can reach, and frees the dino after', () => {
  const w = quiet(5);
  const c = w.camp;
  for (let i = 0; i < 4; i++) addHuman(w, c.x + 20 * i, c.y + 60, false);
  const box = { x0: c.x + 300, y0: c.y + 200, x1: c.x + 460, y1: c.y + 300 };
  w.plants = w.plants.filter((p) => !(p.x >= box.x0 - 40 && p.x <= box.x1 + 40 && p.y >= box.y0 - 40 && p.y <= box.y1 + 40));
  for (let i = 0; i < 6; i++) w.plants.push(makePlant(w, i % 2 ? 'bush' : 'fern', box.x0 + 20 + i * 22, box.y0 + 40, 0.6));
  // one stuck out in deep water: nobody can stand beside it
  const tx = Math.floor((box.x1 - 10) / TILE);
  const ty = Math.floor((box.y1 - 10) / TILE);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) w.terrain.setTile(tx + dx, ty + dy, T.Deep);
  w.nav.sync(w);
  const wet = makePlant(w, 'fern', (tx + 0.5) * TILE, (ty + 0.5) * TILE, 0.6);
  w.plants.push(wet);
  w.plantsDirty = true;
  const r = startClearJob(w, box, [], []);
  assert.ok(r.ok, r.msg);
  const job = w.clearJobs[0];
  const done = run(w, 240, () => !w.clearJobs.length);
  assert.ok(done >= 0, `the job finished (left: ${w.clearJobs[0] ? plantsLeft(w, w.clearJobs[0]).length : 0})`);
  assert.ok(w.plants.filter((p) => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1).every((p) => p === wet), 'everything reachable is gone');
  assert.ok(job.skip.includes(wet.id), 'the one in the water was given up as out of reach');
  assert.ok(w.humans.every((h) => !h.clearJob), 'nobody is left stuck on it');
  assert.ok(w.keepClear.length >= 1, 'kept clear');
});

test('a Clear area job whose crew is pulled away gets new hands (never left half done), and is saved', () => {
  const w = quiet(5);
  const c = w.camp;
  for (let i = 0; i < 4; i++) addHuman(w, c.x + 20 * i, c.y + 60, false);
  const box = { x0: c.x - 460, y0: c.y + 200, x1: c.x - 300, y1: c.y + 300 };
  for (let i = 0; i < 4; i++) w.plants.push(makePlant(w, 'bush', box.x0 + 20 + i * 30, box.y0 + 40, 0.6));
  const picked = w.humans.slice(0, 1);
  assert.ok(startClearJob(w, box, picked, []).ok);
  // the one person on it is sent off elsewhere
  picked[0].clearJob = undefined;
  clearJobsTick(w);
  assert.ok(w.humans.some((h) => h.clearJob === w.clearJobs[0].id), 'free hands took it over');
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.clearJobs.length, 1, 'the job is saved');
  back.update(1.1);
  assert.ok(back.humans.some((h) => h.clearJob === back.clearJobs[0].id), 'and re-crews itself after a load');
});

test('wall edit: several pieces move together keeping their shape, blocked moves are refused, and undo puts them back', () => {
  const w = quiet(9);
  const c = w.camp;
  const tx = Math.floor((c.x + 420) / TILE);
  const ty = Math.floor((c.y + 260) / TILE);
  const pieces = [];
  for (let i = 0; i < 4; i++) pieces.push(w.tribe.addWall(w, tx + i, ty, 'polygon', 'wall'));
  assert.ok(pieces.every(Boolean), 'four polygon wall pieces in a row');
  for (const p of pieces) p.built = 1;
  const before = pieces.map((p) => [p.tx, p.ty]);
  const e = headlessEngine(w);
  e.toggleWallEditMode(pieces[0].id);
  for (const p of pieces.slice(1)) e.toggleWallPiece(p.id);
  assert.equal(e.wallSel.size, 4, 'tap to pick each');
  e.toggleWallPiece(pieces[3].id);
  assert.equal(e.wallSel.size, 3, 'tap again to drop one');
  e.toggleWallPiece(pieces[3].id);
  // slide the group one tile along itself: it may land on its own tiles
  const r = w.tribe.moveWalls(w, pieces, 1, 0);
  assert.ok(typeof r === 'object', typeof r === 'string' ? r : 'moved');
  e.wallUndo.push(r.from);
  // then three down
  const r2 = w.tribe.moveWalls(w, pieces, 0, 3);
  assert.ok(typeof r2 === 'object');
  e.wallUndo.push(r2.from);
  assert.deepEqual(pieces.map((p) => [p.tx - before[0][0], p.ty - before[0][1]]), [[1, 3], [2, 3], [3, 3], [4, 3]], 'same arrangement, moved as one');
  assert.ok(pieces.every((p) => w.tribe.wallAt(p.tx, p.ty) === p), 'the wall map follows');
  // onto another wall: refused, nothing moves
  const other = w.tribe.addWall(w, pieces[0].tx, pieces[0].ty + 2, 'stone', 'wall');
  assert.ok(other);
  assert.equal(typeof w.tribe.moveWalls(w, pieces, 0, 2), 'string', 'blocked');
  assert.deepEqual(pieces.map((p) => p.ty - before[0][1]), [3, 3, 3, 3], 'nothing moved');
  e.undoWallMove();
  e.undoWallMove();
  assert.deepEqual(pieces.map((p) => [p.tx, p.ty]), before, 'undo puts them back');
});

test('wall edit: a group dropped one tile short snaps onto the wall it was meant to join', () => {
  const w = quiet(9);
  const c = w.camp;
  const tx = Math.floor((c.x + 420) / TILE);
  const ty = Math.floor((c.y + 300) / TILE);
  const fixed = w.tribe.addWall(w, tx + 6, ty, 'polygon', 'wall');
  const group = [w.tribe.addWall(w, tx, ty, 'polygon', 'wall'), w.tribe.addWall(w, tx + 1, ty, 'polygon', 'wall')];
  assert.ok(fixed && group.every(Boolean));
  // dropped 3 to the right leaves a one-tile gap; the snap closes it
  const s = w.tribe.snapWallMove(w, group, 3, 0);
  assert.deepEqual(s, { dtx: 4, dty: 0 });
});

test('friendly fire: our own fire, breath + boulders never hurt our Scorpions; an enemy\'s still do', () => {
  const w = quiet(4);
  const c = w.camp;
  const s = w.colony.addScorpion(w, c.x + 260, c.y + 140);
  assert.equal(typeof s, 'object', s);
  s.built = 1;
  const hp0 = s.hp;
  assert.equal(canHurt('us', 'us'), false);
  hitScorpionsAt(w, s.x, s.y, 60, 500, 'us');
  assert.equal(s.hp, hp0, 'our own blast: untouched');
  const h = addHuman(w, c.x, c.y + 40, false);
  const ours = ourDragon(w, h, s.x - 80, s.y);
  breathBlast(w, ours, s.x, s.y, 'sand', 1);
  assert.equal(s.hp, hp0, 'our own dragon\'s breath: untouched');
  w.crush(s.x, s.y, 80, 1, 'us');
  assert.equal(s.hp, hp0, 'our own heavy blow: untouched');
  const wild = { ...ours, id: w.dragons.nextId(), owner: false, partner: undefined, keeper: undefined };
  breathBlast(w, wild, s.x, s.y, 'sand', 1);
  assert.ok(s.hp < hp0, 'a wild dragon\'s breath still hurts it');
  const hp1 = s.hp;
  w.crush(s.x, s.y, 80, 0.2);
  assert.ok(s.hp < hp1, 'a meteor (nature) still hurts it');
});

test('rain gear: rainproof workers keep working in rain + ordinary storms; a severe storm brings everyone in', () => {
  const w = quiet(3);
  const a = addHuman(w, w.camp.x, w.camp.y + 50, false);
  const b = addHuman(w, w.camp.x + 20, w.camp.y + 50, false);
  a.gear.outfit = 'raincloak';
  w.weather.rain = 0.85;
  w.weather.storm = 0.6;
  assert.equal(rainSendsIn(w, a), false, 'cloaked: keeps working');
  assert.equal(rainSendsIn(w, b), true, 'no gear: goes in');
  w.weather.storm = 0.97;
  assert.equal(rainSendsIn(w, a), true, 'a severe storm sends everyone in');
  // in the sim: the cloaked one stays on their job outside in heavy rain
  w.weather.storm = 0.4;
  a.role = 'gatherer';
  b.role = 'gatherer';
  let hid = 0;
  run(w, 40, () => {
    if (a.state === 'hide' || a.state === 'relax') hid++;
  });
  assert.ok(hid < 30, 'the cloaked gatherer did not shelter');
});

test('Dragon Shields repel a dragon without hurting it, draw energy, and do nothing without power', () => {
  const setup = (energy) => {
    const w = quiet(8);
    w.civ.path = 'resonance';
    w.civ.energy = energy;
    const sh = w.colony.addBuilding(w, 'dragonShield', w.camp.x + 200, w.camp.y + 220);
    assert.ok(sh, 'placed');
    sh.built = 1;
    const dr = w.dragons.summon(w, { x: w.camp.x, y: w.camp.y });
    dr.x = sh.x + 260;
    dr.y = sh.y;
    dr.z = 150;
    return { w, sh, dr };
  };
  const { w, sh, dr } = setup(400);
  const hp0 = dr.hp;
  const e0 = w.civ.energy;
  let rattled = false;
  run(w, 30, () => {
    if (dr.repel && dr.repel.k >= 1) rattled = true;
  });
  assert.ok(rattled, 'the hum rattled it');
  assert.equal(dr.hp, hp0, 'not a scratch on it');
  assert.ok(dist(dr, sh) > shieldRadius(sh), 'it flew out of the field');
  assert.ok(w.civ.energy < e0, 'it cost energy');
  assert.ok(w.dragons.list.includes(dr) || dr.state === 'leave', 'it flew off (it did not just vanish)');
  // no energy: the field is down
  const off = setup(0);
  run(off.w, 10);
  assert.ok(!off.dr.repel, 'no power, no repelling');
  // upgrades: a wider field
  off.w.camp.stock.copper = 20;
  off.w.camp.stock.quartz = 20;
  const r0 = shieldRadius(off.sh);
  assert.equal(upgradeShield(off.w, off.sh, 'radius'), null);
  assert.equal(shieldRadius(off.sh), r0 + SHIELD.rUp);
});

test('Set All + Split evenly never take a bonded Dragon Rider (or other protected roles) off their job', () => {
  const w = quiet(6);
  const people = [];
  for (let i = 0; i < 6; i++) people.push(addHuman(w, w.camp.x + i * 12, w.camp.y + 50, false));
  const rider = people[0];
  const dr = ourDragon(w, rider, w.camp.x + 80, w.camp.y + 80);
  people[1].role = 'trainer';
  assert.equal(protectedRole(w, rider), 'dragonRider');
  const e = headlessEngine(w);
  e.setAllRoles('gatherer');
  assert.equal(rider.role, 'dragonKeeper', 'the Dragon Rider kept their job');
  assert.equal(dr.partner, rider.id, 'the bond is intact');
  assert.equal(people[1].role, 'trainer', 'the trainer (a protected specialist) too');
  assert.ok(people.slice(2).every((h) => h.role === 'gatherer'), 'everyone else changed');
  e.splitRolesEvenly();
  assert.equal(rider.role, 'dragonKeeper');
  // release specialists: then a bulk change may move the trainer, never the rider
  e.setJobGuard('specialists', false);
  e.setAllRoles('builder');
  assert.equal(people[1].role, 'builder');
  assert.equal(rider.role, 'dragonKeeper');
  // by hand it's allowed (the player chose to), and the bond still isn't broken
  e.setRole(rider.id, 'hunter');
  assert.equal(rider.role, 'hunter');
  assert.equal(dr.partner, rider.id);
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.tribe.jobGuard.specialists, false, 'the protection settings are saved');
});

test('Snow People settle in groups up in the snowy peaks, with Frosthorn mounts, away from the monks', () => {
  const w = quiet(11);
  w.snowFolk.enabled = true;
  w.elapsed = 400;
  w.snowFolk.update(w, 0.05);
  assert.ok(w.snowFolk.tribes.length >= 1, 'a camp');
  const t = w.snowFolk.tribes[0];
  const i = Math.floor(t.y / TILE) * MAP_W + Math.floor(t.x / TILE);
  assert.equal(w.terrain.region[i], REGION.peaks, 'in the Great Peaks');
  assert.ok(dist(t, w.camp) > 1400, 'far from our town');
  assert.ok(t.lodges.some((l) => l.kind === 'igloo') && t.lodges.some((l) => l.kind === 'lodge'), 'igloos round a longhouse');
  const folk = w.snowFolk.folk(w);
  assert.ok(folk.length >= 9);
  assert.ok(folk.every((b) => b.grp), 'everyone belongs to a group');
  assert.ok(w.groups.list.some((g) => g.side === 'snow' && g.kind === 'patrol'), 'a patrol of riders');
  assert.ok(folk.some((b) => b.mount && w.dinos.find((d) => d.id === b.mount)?.species === 'frosthorn'), 'Frosthorn riders');
  // neighbours, not enemies: our guards leave them be until they're at odds with us
  const b = folk.find((x) => !x.mount);
  assert.equal(w.rivals.hostile(w, b), false, 'peaceful neighbours');
  w.rivals.hit(w, b, 0.01, b.x, b.y, false);
  assert.equal(w.rivals.hostile(w, b), true, 'hurt one of them and they hold a grudge');
  // they and the Sand People are old enemies
  const saves = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(saves.snowFolk.tribes.length, w.snowFolk.tribes.length, 'saved');
  assert.equal(saves.snowFolk.folk(saves).length, w.snowFolk.folk(w).length);
  assert.ok(saves.snowFolk.tribes[0].grudge > 0, 'the grudge is saved');
  assert.ok(saves.snowFolk.folk(saves).some((x) => x.mount), 'riders back on their Frosthorns');
});

test('the snow animals arrive on the snow, keep to the cold, the legends are rare and never breed', () => {
  const w = quiet(12);
  w.wildlife.enabled = true;
  w.snowLife.enabled = true;
  w.elapsed = 210;
  w.snowLife.update(w, 6);
  const beasts = w.dinos.filter((d) => SNOW_SPECIES.has(d.species));
  for (const s of SNOW_SPECIES) assert.ok(beasts.some((d) => d.species === s), `${s} arrived`);
  assert.equal(beasts.filter((d) => d.species === 'yeti').length, 1, 'one Yeti');
  assert.equal(beasts.filter((d) => d.species === 'snowRex').length, 1, 'one Snow Rex');
  assert.equal(w.canLayEgg('yeti'), false, 'the Yeti never lays');
  assert.equal(w.canLayEgg('snowRex'), false, 'nor the Snow Rex');
  const cold = beasts.filter((d) => snowGround(w, d.x, d.y) || w.terrain.region[Math.floor(d.y / TILE) * MAP_W + Math.floor(d.x / TILE)] === REGION.peaks).length;
  assert.ok(cold / beasts.length > 0.8, `up in the peaks (${cold}/${beasts.length})`);
  // a snow leopard dropped down out of the cold heads back up
  const leo = beasts.find((d) => d.species === 'snowLeopard');
  leo.x = w.camp.x + 900;
  leo.y = w.camp.y;
  const back = run(w, 3, () => leo.state === 'wander' && dist({ x: leo.tx, y: leo.ty }, { x: leo.homeX, y: leo.homeY }) < 200);
  assert.ok(back >= 0, 'it set off home to the snow');
  const saved = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(saved.dinos.filter((d) => d.species === 'yeti').length, 1, 'the Yeti is saved');
  assert.ok(saved.snowLife.seeded, 'and the peaks stay stocked (no second arrival)');
});

test('the Yeti guards its cave: an intruder gets a roar, then a charge', () => {
  const w = quiet(12);
  const yeti = addDino(w, 'yeti', 271 * TILE, 27 * TILE, { growth: 1, homeX: 271 * TILE, homeY: 27 * TILE });
  w.update(DT);
  const h = addHuman(w, yeti.x + 150, yeti.y + 40, false);
  h.role = 'gatherer';
  const t = run(w, 8, () => yeti.state === 'chase' || yeti.state === 'roar');
  assert.ok(t >= 0, `it reacted (${yeti.state})`);
});
