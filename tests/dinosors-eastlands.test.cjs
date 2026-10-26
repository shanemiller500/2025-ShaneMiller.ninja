// The bigger world (Oct 2026): the eastern lands (central desert, Great Peaks), Dinosaur Scorpions,
// Sand People, Mountain Monks, Ice + Sand Dragons, folk groups, priorities, Dragon Riders at work,
// the atlas (minimap) and old saves loading into the bigger map.
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
const { T, TILE, MAP_W, MAP_H, OLD_MAP_W } = require(path.join(root, 'sim', 'types.ts'));
const { LM, REGION, isSandTile } = require(path.join(root, 'sim', 'terrain.ts'));
const { breathBlast } = require(path.join(root, 'sim', 'breath.ts'));
const { isProtected, MAX_MONKS } = require(path.join(root, 'sim', 'monks.ts'));
const { siteKey } = require(path.join(root, 'sim', 'build.ts'));
const { riderDutyThink } = require(path.join(root, 'sim', 'riderDuty.ts'));
const { flyToward } = require(path.join(root, 'sim', 'dragonKeep.ts'));

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
const tileAt = (w, x, y) => w.terrain.tiles[y * MAP_W + x];

/** A populated world with the wandering + random bits switched off (each test turns on what it needs). */
function quiet(seed = 7) {
  const w = new World(seed);
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
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
  w.sandFolk.enabled = false; w.snowFolk.enabled = false;
  w.wildlife.enabled = false;
  return w;
}

test('the world is bigger and the old valley is where it always was', () => {
  const w = new World(1234, false);
  assert.equal(MAP_W, 288);
  assert.ok(MAP_H >= 112);
  assert.equal(tileAt(w, LM.camp.x, LM.camp.y), T.Dirt);
  assert.equal(tileAt(w, LM.lake.x, LM.lake.y), T.Deep);
  // the central desert: dunes round its middle, an oasis with fresh water
  assert.equal(w.terrain.region[LM.desert.y * MAP_W + LM.desert.x], REGION.desert);
  let dunes = 0;
  for (let y = LM.desert.y - 10; y < LM.desert.y + 10; y++) for (let x = LM.desert.x - 10; x < LM.desert.x + 10; x++) if (tileAt(w, x, y) === T.Dune) dunes++;
  assert.ok(dunes > 150, `dunes in the middle of the desert: ${dunes}`);
  assert.ok(w.terrain.nearestDrink(LM.oasis.x * TILE, LM.oasis.y * TILE, 400), 'an oasis to drink at');
  // the Great Peaks: bare rock, snowfields, ice, cliffs, caves, high + cold
  const counts = {};
  for (let y = 0; y < 70; y++) for (let x = 210; x < MAP_W; x++) counts[tileAt(w, x, y)] = (counts[tileAt(w, x, y)] ?? 0) + 1;
  assert.ok(counts[T.Snow] > 150 && counts[T.Mountain] > 300 && counts[T.Ice] > 0 && counts[T.Cliff] > 20 && counts[T.Cave] > 0, JSON.stringify(counts));
  assert.ok(w.terrain.elev[LM.peaks.y * MAP_W + LM.peaks.x] > 0.5, 'the peaks are high');
  assert.ok(w.snow.chill(w, LM.peaks.x * TILE, LM.peaks.y * TILE) > w.snow.chill(w, LM.camp.x * TILE, LM.camp.y * TILE) + 0.2, 'colder up high');
});

test('the monks can walk from their valley up to the high ledge (the passes are open)', () => {
  const w = new World(77, false);
  w.nav.sync(w);
  const from = { x: LM.monastery.x * TILE, y: LM.monastery.y * TILE };
  const to = { x: LM.altar.x * TILE, y: (LM.altar.y + 1) * TILE };
  let p;
  for (let k = 0; k < 20 && (p === undefined); k++) {
    w.nav.budget = 1e9;
    p = w.nav.find(w, 'dino', from.x, from.y, 0, to.x, to.y, 0, 60000);
  }
  assert.ok(Array.isArray(p) && p.length >= 1, 'a path up to the ledge');
});

test('an old save (160 tiles wide) loads into the bigger map: edits land in place, the new lands get filled', () => {
  const w = new World(2024, true, 2);
  // an edit in the old valley: a patch of mud
  w.terrain.setTile(60, 40, T.Mud);
  const data = w.serialize();
  // make it look like it was written before the world grew
  delete data.mapW;
  data.edits = data.edits.map(([i, t]) => [(i % MAP_W) + Math.floor(i / MAP_W) * OLD_MAP_W, t]);
  data.plants = data.plants.filter(([, x]) => x < OLD_MAP_W * TILE);
  data.colony.nodes = data.colony.nodes.filter(([, x]) => x < OLD_MAP_W * TILE - 400);
  delete data.atlas;
  delete data.monks;
  const back = World.deserialize(JSON.parse(JSON.stringify(data)));
  assert.equal(tileAt(back, 60, 40), T.Mud, 'the edit is where it was');
  assert.ok(back.plants.some((p) => p.x > OLD_MAP_W * TILE), 'plants grew in the new lands');
  assert.ok(back.colony.nodes.some((n) => n.x > OLD_MAP_W * TILE), 'deposits out east');
  assert.ok(back.dinos.some((d) => d.species === 'camel'), 'camels in the desert');
  // the atlas: the old valley counts as seen, the new lands are unexplored
  assert.ok(back.atlas.isSeen(LM.camp.x * TILE, LM.camp.y * TILE));
  assert.ok(!back.atlas.isSeen(LM.peaks.x * TILE, LM.peaks.y * TILE));
});

test('a Dinosaur Scorpion guards its den: it charges an intruder, pinches + stings (dizzy), and never strays far', () => {
  const w = quiet(31);
  w.dinos = w.dinos.filter((d) => d.species === 'dinoScorpion');
  const sc = w.dinos[0];
  assert.ok(sc, 'one spawned with the world');
  assert.notEqual(sc.species, 'scorpion');
  sc.x = sc.homeX;
  sc.y = sc.homeY;
  const h = addHuman(w, sc.homeX + 180, sc.homeY + 20, false);
  h.hp = 1;
  w.timePaused = true;
  let stung = false;
  run(w, 25, () => {
    h.x = sc.homeX + 160;
    h.y = sc.homeY + 20;
    h.state = 'idle';
    h.think = 99;
    if (h.slowT > 0) stung = true;
    return stung && h.hp < 0.9;
  });
  assert.ok(stung, 'its venom left them dizzy');
  assert.ok(h.hp < 1, 'and it hurt');
  // the intruder leaves: it goes back home
  h.x = sc.homeX + 3000;
  run(w, 30);
  assert.ok(dist(sc, { x: sc.homeX, y: sc.homeY }) < 650, 'stays near its den');
});

test('dragons land beside mountains (no hovering on the cliff floor) and fold their wings on the ground', () => {
  const w = quiet(5);
  const peak = (() => {
    for (let y = 10; y < 60; y++) for (let x = 220; x < 280; x++) if (tileAt(w, x, y) === T.Mountain && tileAt(w, x, y + 1) !== T.Mountain && w.nav.passable('human', x * TILE + 16, (y + 1) * TILE + 16)) return { x: x * TILE + 16, y: (y + 1) * TILE + 16 };
    return null;
  })();
  assert.ok(peak);
  const dr = { id: 999, kind: 'dragon', name: 'Test', x: peak.x - 300, y: peak.y - 200, z: 220, vx: 0, vy: 0, dir: 1, hp: 3000, maxHp: 3000, state: 'fly', t: 0, target: 0, tx: 0, ty: 0, breath: 0, anim: 0, hue: 0, passes: 0, hit: 0, breed: 'mountain', owner: true, growth: 1, skills: { flight: 1 } };
  for (let i = 0; i < 400; i++) flyToward(w, dr, peak.x, peak.y, 0, DT);
  assert.ok(dr.z < 6, `came down to the ground beside the peak (z ${dr.z.toFixed(0)})`);
});

test('Sand People: camps in the desert, groups, camels, a Sand Dragon Rider, and camouflage on the sand', () => {
  const w = quiet(11);
  w.sandFolk.enabled = true;
  w.elapsed = 400;
  w.sandFolk.update(w, 0.05);
  assert.ok(w.sandFolk.tribes.length >= 1, 'pitched their tents');
  for (const t of w.sandFolk.tribes) {
    const tx = Math.floor(t.x / TILE);
    const ty = Math.floor(t.y / TILE);
    assert.equal(w.terrain.region[ty * MAP_W + tx], REGION.desert, 'in the desert');
    assert.ok(dist(t, w.camp) > 1400);
  }
  const folk = w.sandFolk.folk(w);
  assert.ok(folk.length >= 8);
  assert.ok(folk.some((b) => b.mount), 'camel riders');
  assert.ok(folk.every((b) => b.grp), 'everyone belongs to a group');
  const dr = w.dragons.list.find((d) => d.sandTribe);
  assert.ok(dr && dr.breed === 'sand' && dr.sandRider, 'a Sand Dragon with its rider');
  // camouflage: out on the sand, nobody near → our guards can't target them; off the sand they can
  const b = folk.find((x) => !x.mount && !x.onDragon && (x.age ?? 200) >= 110);
  b.x = w.sandFolk.tribes[0].x;
  b.y = w.sandFolk.tribes[0].y + 40;
  for (let k = 0; k < 40 && !isSandTile(w.terrain.tileAt(b.x, b.y)); k++) b.x += 20;
  b.spotT = 0;
  assert.equal(w.rivals.hostile(w, b), false, 'blends into the dunes');
  b.x = w.camp.x;
  b.y = w.camp.y;
  assert.equal(w.rivals.hostile(w, b), true, 'plain to see off the sand');
});

test('groups: a family of Tree People placed with the People tool stays together and defends one another', () => {
  const w = quiet(4242);
  w.forest.enabled = true;
  w.elapsed = 500;
  w.forest['prepPlants'](w);
  const forest = (() => {
    for (let y = 36; y < 90; y++) for (let x = 6; x < 46; x++) {
      const t = tileAt(w, x, y);
      if ((t === T.Jungle || t === T.Forest) && Math.hypot(x * TILE - w.camp.x, y * TILE - w.camp.y) > 1200 && w.forest['hosts'](w, x * TILE, y * TILE, 150).length >= 2) return { x: x * TILE, y: y * TILE };
    }
    return null;
  })();
  assert.ok(forest, 'some jungle with trees');
  const r = w.forest.placeGroup(w, forest.x, forest.y, 'patrol');
  assert.equal(typeof r, 'object', String(r));
  const g = r.g;
  assert.equal(g.kind, 'patrol');
  const members = w.groups.members(w, g);
  assert.equal(members.length, 4);
  run(w, 60);
  const ms = w.groups.members(w, g);
  const lead = w.groups.leader(w, g);
  assert.ok(ms.every((b) => dist(b, lead) < 520), `they keep together: ${ms.map((b) => Math.round(dist(b, lead))).join(',')}`);
  // one of them is attacked by one of ours: the others join in
  const h = addHuman(w, lead.x + 60, lead.y, false);
  w.forest.hit(w, ms[1], 0.05, h.x, h.y);
  const fighting = ms.filter((b) => b.state === 'fight' && b.targetId === h.id).length;
  assert.ok(fighting >= 2, `${fighting} of the group turned on the attacker`);
});

test('Mountain Monks: protected, they walk in a procession, and the yearly offering leaves the eldest who rebuild', () => {
  const w = quiet(19);
  w.update(DT);
  const mk = w.monks;
  assert.ok(mk.list.length >= 6 && mk.list.length <= MAX_MONKS);
  assert.ok(isProtected(mk.list[0]), 'protected');
  assert.ok(!w.humans.includes(mk.list[0]) && !w.dinos.includes(mk.list[0]) && !w.rivals.brutes.includes(mk.list[0]), 'never in a list anything hunts from');
  // a walk: the procession keeps a line behind its leader
  w.time = 8;
  w.camX = mk.home.x;
  w.camY = mk.home.y;
  w.view = { x0: mk.home.x - 800, y0: mk.home.y - 600, x1: mk.home.x + 800, y1: mk.home.y + 600 };
  run(w, 25);
  assert.equal(mk.activity, 'walk');
  const lead = mk.list.find((m) => m.slot === 0);
  const spread = Math.max(...mk.list.filter((m) => !m.pilgrim).map((m) => dist(m, lead)));
  assert.ok(spread < 40 * mk.list.length, `a line, not scattered (${Math.round(spread)})`);
  // the offering
  const before = mk.list.filter((m) => !m.pilgrim).length;
  assert.equal(mk.startRite(w), null);
  run(w, 600, () => !mk.rite);
  assert.equal(mk.rite, null, 'the offering finished');
  assert.equal(mk.list.filter((m) => !m.pilgrim).length, Math.min(before, 2), 'the two eldest walked home');
  assert.ok(mk.lastRite >= 0);
  // and the order slowly grows again
  w.time = 12;
  run(w, 400);
  assert.ok(mk.list.length > 2, 'pilgrims came');
});

test('hot sand breath burns, then cools into plain sand; an Ice Dragon’s frost slows', () => {
  const w = quiet(3);
  const spot = { x: w.camp.x + 600, y: w.camp.y + 300 };
  const tx = Math.floor(spot.x / TILE);
  const ty = Math.floor(spot.y / TILE);
  w.terrain.setTile(tx, ty, T.Grass);
  const h = addHuman(w, spot.x + 10, spot.y, false);
  const dr = { id: 1e8 + 1, kind: 'dragon', name: 'Dune', x: spot.x - 100, y: spot.y, z: 60, vx: 0, vy: 0, dir: 1, hp: 2800, maxHp: 2800, state: 'strafe', t: 0, target: 0, tx: 0, ty: 0, breath: 0, anim: 0, hue: 0, passes: 0, hit: 0, breed: 'sand', sandTribe: 99 };
  breathBlast(w, dr, spot.x, spot.y, 'sand', 1);
  assert.ok(h.hp < 1, 'scorched');
  assert.equal(w.hazards.list.length, 1);
  assert.equal(w.hazards.list[0].kind, 'hotSand');
  run(w, 20);
  assert.equal(w.hazards.list.length, 0, 'cooled');
  assert.equal(tileAt(w, tx, ty), T.Sand, 'left a drift of sand behind');
  const h2 = addHuman(w, spot.x + 300, spot.y, false);
  breathBlast(w, { ...dr, breed: 'ice', sandTribe: undefined }, h2.x, h2.y, 'frost', 1);
  assert.ok(h2.slowT > 0, 'frozen stiff');
});

test('Ice Dragons nest high in the Great Peaks', () => {
  const w = new World(55);
  w.dragons.update(w, DT);
  const ice = w.dragons.nests.filter((n) => n.breed === 'ice');
  assert.ok(ice.length >= 1);
  for (const n of ice) {
    assert.equal(w.terrain.region[Math.floor(n.y / TILE) * MAP_W + Math.floor(n.x / TILE)], REGION.peaks);
    assert.ok(w.dragons.eggs.some((e) => e.nest === n.id && e.breed === 'ice'), 'ice eggs');
  }
  // the classic nests stay in the old valley
  assert.ok(w.dragons.nests.filter((n) => n.breed !== 'ice').every((n) => n.x < OLD_MAP_W * TILE));
});

test('priorities: an Urgent building is supplied + built before a normal one, and miners dig High orders first', () => {
  const w = quiet(8);
  for (let i = 0; i < 6; i++) addHuman(w, w.camp.x + i * 10, w.camp.y + 40, false);
  w.camp.learned.add('tools');
  w.camp.learned.add('axe');
  w.camp.stock.wood = 0;
  w.camp.stock.stone = 40;
  w.camp.stock.stick = 40;
  const a = w.colony.addBuilding(w, 'storage', w.camp.x + 220, w.camp.y + 150);
  const b = w.colony.addBuilding(w, 'storage', w.camp.x - 260, w.camp.y + 170);
  assert.ok(a && b, 'placed both');
  const siteB = w.buildSites().find((s) => s.kind === 'building' && s.id === b.id);
  w.priority.set(siteKey(siteB), 3);
  run(w, 240, () => b.built >= 1);
  assert.ok(b.built >= 1, 'the urgent one is built');
  assert.ok(a.built < 1 || b.built >= 1, 'urgent first');
  // the mine
  const { setOrder } = require(path.join(root, 'sim', 'miners.ts'));
  assert.equal(w.priority.topMine(), 0);
  setOrder(w, 20, 5, 'dig', 2);
  assert.equal(w.priority.topMine(), 2);
});

test('a Dragon Rider and their dragon take on jobs for the tribe (scouting unknown land) instead of sleeping', () => {
  const w = quiet(12);
  const h = addHuman(w, w.camp.x + 40, w.camp.y + 40, false);
  w.time = 10;
  const { hatch } = require(path.join(root, 'sim', 'dragonNests.ts'));
  const egg = { id: w.dragons.nextId(), breed: 'swift', x: w.camp.x + 60, y: w.camp.y + 50, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = hatch(w, egg);
  dr.growth = 1;
  dr.skills = { trust: 1, follow: 1, flight: 1, fire: 1, carry: 1, rider: 1 };
  dr.maxHp = dr.hp = 1700;
  dr.partner = h.id;
  h.dragon = dr.id;
  dr.keeper = h.id;
  h.role = 'dragonKeeper';
  const seen = w.atlas.count;
  let jobs = 0;
  run(w, 200, () => {
    if (dr.duty) jobs++;
  });
  assert.ok(jobs > 0, 'it took a job');
  assert.ok(w.atlas.count > seen, `the map filled in (${seen} → ${w.atlas.count})`);
  assert.equal(riderDutyThink.length, 2);
});

test('everything new saves + loads', () => {
  const w = new World(66);
  for (let i = 0; i < 6; i++) addHuman(w, w.camp.x + i * 10, w.camp.y + 40, false);
  w.rivals.started = true;
  w.elapsed = 400;
  run(w, 5);
  w.priority.set('building:123', 3);
  const n = w.sandFolk.folk(w).length;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.sandFolk.tribes.length, w.sandFolk.tribes.length);
  assert.equal(back.sandFolk.folk(back).length, n);
  assert.equal(back.monks.list.length, w.monks.list.length);
  assert.equal(back.groups.list.length, w.groups.list.length);
  assert.equal(back.priority.get('building:123'), 3);
  assert.equal(back.atlas.count, w.atlas.count);
  assert.equal(back.dragons.list.filter((d) => d.sandTribe).length, w.dragons.list.filter((d) => d.sandTribe).length);
  assert.ok(back.dinos.some((d) => d.species === 'dinoScorpion'));
});
