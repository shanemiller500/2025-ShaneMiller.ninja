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
const { MAP_W, T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { isWaterTile } = require(path.join(root, 'sim', 'terrain.ts'));
const { toughness } = require(path.join(root, 'sim', 'courage.ts'));
const { scorpionTarget } = require(path.join(root, 'sim', 'colony.ts'));
const { seaHuntThink } = require(path.join(root, 'sim', 'seaHunters.ts'));
const { inferCommand, issue } = require(path.join(root, 'sim', 'tasks.ts'));
const { SEA_TOUGH, SEA_GROWN, SEA_MIN, seaRoute } = require(path.join(root, 'sim', 'seaFolk.ts'));

const DT = 1 / 30;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A real world with two Sea People villages settled and everything that wanders about switched off. */
function seaWorld(seed = 4242) {
  const w = new World(seed);
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
  w.rivals.clans.length = 0;
  w.rivals.brutes.length = 0;
  w.wildlife.enabled = false;
  w.forest.enabled = false;
  w.elapsed = 400;
  w.seaFolk.update(w, 0.05);
  for (const t of w.seaFolk.tribes) t.raidT = Infinity;
  w.dinos = w.dinos.filter((d) => ['mosa', 'plesio', 'plio'].includes(d.species));
  w.toasts = [];
  const toast = w.toast.bind(w);
  w.toast = (icon, text, x, y, f) => {
    w.toasts.push(`${icon} ${text}`);
    return toast(icon, text, x, y, f);
  };
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
const water = (w, x, y) => isWaterTile(w.terrain.tileAt(x, y));

test('Sea People build stilt villages out on the sea, far from us, with canoes, shore markers and folk of their own', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  assert.equal(s.tribes.length, 2);
  for (const t of s.tribes) {
    assert.ok(water(w, t.x, t.y) && w.terrain.isSalt(t.x, t.y), `${t.name} sits out on the sea`);
    assert.ok(Math.hypot(t.x - w.camp.x, t.y - w.camp.y) >= SEA_MIN, 'far from our town');
    assert.ok(t.huts.length >= 4, 'stilt-houses');
    for (const h of t.huts) assert.ok(water(w, h.x, h.y), 'every house stands in the water');
    assert.ok(t.huts.some((h) => h.kind === 'dock') && t.huts.some((h) => h.kind === 'longhouse'));
    for (const g of t.signs) assert.ok(!water(w, g.x, g.y), 'markers on the shore');
    const folk = s.members(t.id);
    assert.ok(folk.length >= 6);
    assert.ok(folk.every((b) => b.sea === t.id && b.clan === 0 && w.rivals.brutes.includes(b)));
  }
});

test('their war canoes go by water: a route to our town runs up the river most of the way', () => {
  const w = seaWorld();
  for (const t of w.seaFolk.tribes) {
    const r = seaRoute(w, t.x, t.y, w.camp.pileX, w.camp.pileY);
    assert.ok(r && r.length > 20, 'a way there');
    const wet = r.filter((i) => isWaterTile(w.terrain.tiles[i])).length / r.length;
    assert.ok(wet > 0.7, `mostly water (${Math.round(wet * 100)}%)`);
  }
});

test('a canoe raid paddles up to our town, grabs food and paddles home', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  const t = s.tribes.sort((a, b) => dist(a, w.camp) - dist(b, w.camp))[0];
  w.elapsed = 900;
  w.camp.stock.meat = 40;
  for (const h of w.humans) h.x = w.camp.x - 500, h.y = w.camp.y;
  const free = s.members(t.id).filter((b) => b.age >= SEA_GROWN);
  assert.ok(s.launch(w, t, free, { kind: 'town', id: 0 }, w.camp.pileX, w.camp.pileY));
  const bd = s.bands[s.bands.length - 1];
  const party = bd.ids.map((id) => w.rivals.byId(id));
  let boated = false;
  let landed = false;
  run(w, 400, () => {
    if (party.some((b) => b.boat && dist(b, t) > 400)) boated = true;
    if (party.some((b) => !b.boat && dist(b, bd) < 200)) landed = true;
    return !s.bands.includes(bd);
  });
  assert.ok(boated, 'out on the water in their canoes');
  assert.ok(landed, 'landed by the town');
  assert.ok(w.camp.stock.meat < 40, 'took our food');
  assert.ok(w.toasts.some((x) => x.includes('river')), 'we were warned');
  assert.ok(!s.bands.includes(bd), 'the raid ended');
});

test('the sea reptiles are their friends: they never hunt them, and go for intruders in a village\'s waters first', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  const t = s.tribes[0];
  const sp = s.members(t.id)[0];
  // a bank spot (real dry land, inside the map) a sea hunter can reach from deep water, near the village
  const { deepNear } = require(path.join(root, 'sim', 'seaHunters.ts'));
  let bank = null;
  for (let r = 100; r < t.r * 1.6 && !bank; r += 16) for (let a = 0; a < 6.28 && !bank; a += 0.2) {
    const x = t.x + Math.cos(a) * r;
    const y = t.y + Math.sin(a) * r;
    const tile = w.terrain.tileAt(x, y);
    if (!water(w, x, y) && tile !== T.Mountain && tile !== T.Cliff && deepNear(w, x, y, 70)) bank = { x, y };
  }
  // (no natural bank there: shallows all along the shore) make a little sand spit out to the deep water
  for (let r = 100; r < t.r * 1.6 && !bank; r += 16) for (let a = 0; a < 6.28 && !bank; a += 0.2) {
    const tx = Math.floor((t.x + Math.cos(a) * r) / TILE);
    const ty = Math.floor((t.y + Math.sin(a) * r) / TILE);
    if (w.terrain.tiles[ty * MAP_W + tx] === T.Shallow && w.terrain.tiles[(ty + 1) * MAP_W + tx] === T.Deep) {
      w.terrain.setTile(tx, ty, T.Sand);
      bank = { x: tx * TILE + 16, y: ty * TILE + 12 };
    }
  }
  assert.ok(bank, 'a spot on the bank');
  w.dinos.length = 0;
  const d = addDino(w, 'plesio', bank.x, bank.y + 40, { age: 9999 });
  const deep = require(path.join(root, 'sim', 'seaHunters.ts')).deepNear(w, bank.x, bank.y, 90);
  d.x = deep.x;
  d.y = deep.y;
  d.huntCd = 0;
  d.hunger = 0.9;
  sp.x = bank.x;
  sp.y = bank.y;
  d.think = 0.5;
  seaHuntThink(w, d);
  assert.ok(!d.seaHunt || d.seaHunt.prey !== sp.id, 'never one of the Sea People');
  const h = addHuman(w, bank.x + 6, bank.y);
  d.seaHunt = undefined;
  seaHuntThink(w, d);
  assert.ok(d.seaHunt && d.seaHunt.prey === h.id, 'the stranger in their waters is the one it stalks');
  assert.ok(s.guarded(bank.x, bank.y));
});

test('they fight the Neanderthals and the Tree People, and each side fights back', () => {
  const w = seaWorld();
  const sp = w.seaFolk.members(w.seaFolk.tribes[0].id).find((b) => b.age >= SEA_GROWN);
  let clan = null;
  for (const [dx, dy] of [[0, -900], [600, -800], [-600, -800], [900, -600], [-900, -600]]) {
    clan = w.rivals.spawnClan(w, 3, { x: sp.x + dx, y: sp.y + dy });
    if (clan) break;
  }
  assert.ok(clan, 'a clan nearby');
  const brute = w.rivals.members(clan.id)[0];
  sp.boat = false;
  sp.x = brute.x + 60;
  sp.y = brute.y;
  assert.equal(w.rivals['nearestFoe'](w, brute, 150), sp, 'a Neanderthal sees a Sea Person as a foe');
  // and the Sea People go for clan brutes they meet
  const t = w.seaFolk.tribes[0];
  const f = w.seaFolk['foeNearAt'](w, sp.x, sp.y, 150, false, t);
  assert.ok(f && f.kind === 'brute' && f.b === brute);
  assert.equal(toughness({ kind: 'brute', b: sp, dist: 0 }), SEA_TOUGH * sp.hp);
});

test("at night a canoe on the water is a shadow: Scorpions can't see it, people only close up; on land they're seen", () => {
  const w = seaWorld();
  w.time = 23;
  run(w, 0.1);
  const t = w.seaFolk.tribes[0];
  const b = w.seaFolk.members(t.id).find((x) => x.age >= SEA_GROWN);
  b.band = undefined;
  b.boat = true;
  b.spotT = 0;
  assert.equal(w.rivals.hostile(w, b), false);
  assert.notEqual(scorpionTarget(w, b.x - 200, b.y, 700)?.id, b.id);
  b.spotT = 2;
  assert.equal(w.rivals.hostile(w, b), true, 'spotted');
  assert.notEqual(scorpionTarget(w, b.x - 200, b.y, 700)?.id, b.id, 'still nothing for a Scorpion to aim at');
  b.boat = false;
  b.spotT = 0;
  assert.equal(w.rivals.hostile(w, b), true, 'on land, seen');
});

test('we attack a spotted village: beat them, wade in, pull the stilt-houses down, take fish, salt + harpoons', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  const t = s.tribes[0];
  for (const b of s.members(t.id).filter((x) => x.age >= SEA_GROWN).slice(1)) w.rivals.kill(w, b);
  t.found = true;
  w.dinos.length = 0;
  w.camp.learned.add('spear');
  // a dry spot on the shore near the village
  let shore = null;
  for (let r = 60; r < 500 && !shore; r += 16) for (let a = 0; a < 6.28 && !shore; a += 0.25) {
    const x = t.x + Math.cos(a) * r;
    const y = t.y + Math.sin(a) * r;
    if (w.nav.passable('human', x, y) && !water(w, x, y)) shore = { x, y };
  }
  assert.ok(shore);
  const crew = [];
  for (let i = 0; i < 8; i++) crew.push(addHuman(w, shore.x + (i % 4) * 12, shore.y + Math.floor(i / 4) * 12));
  const cmd = inferCommand(w, crew, t.x, t.y, {});
  assert.equal(cmd.kind, 'seaRaid');
  assert.ok(issue(w, crew, cmd));
  const fish = w.camp.stock.fish;
  const spears = w.colony.armory.spearB ?? 0;
  run(w, 400, () => !s.tribe(t.id));
  assert.ok(!s.tribe(t.id), 'the village is gone');
  assert.ok(w.camp.stock.fish > fish && (w.colony.armory.spearB ?? 0) > spears);
  assert.ok(w.toasts.some((x) => x.includes('sea village')));
});

test('the People tool builds a Sea People village where you tap on the sea (and says why not on land)', () => {
  const { applyTool, DEFAULT_TOOL } = require(path.join(root, 'game', 'tools.ts'));
  const w = new World(4242);
  const tool = { ...DEFAULT_TOOL, id: 'people', people: 'seaFolk' };
  assert.equal(applyTool(w, tool, w.camp.x + 40, w.camp.y + 40, false), false, 'not on dry land by camp');
  let spot = null;
  for (let ty = 108; ty > 60 && !spot; ty--) for (let tx = 10; tx < 150 && !spot; tx += 2) {
    const x = tx * TILE + 16;
    const y = ty * TILE + 16;
    if (w.terrain.tileAt(x, y) === T.Shallow && w.terrain.isSalt(x, y) && Math.hypot(x - w.camp.x, y - w.camp.y) > 1600) spot = { x, y };
  }
  assert.ok(spot);
  assert.equal(applyTool(w, tool, spot.x, spot.y, false), true);
  const v = w.seaFolk.tribes.find((t) => dist(t, spot) < 360);
  assert.ok(v && v.found && w.seaFolk.members(v.id).length >= 6);
  run(w, 2);
  assert.ok(w.seaFolk.members(v.id).length >= 6, 'they live on');
});

test('save + load keeps villages, huts, markers and folk', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  s.tribes[0].found = true;
  const n = s.folk(w).length;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.seaFolk.tribes.length, 2);
  assert.equal(back.seaFolk.tribes[0].huts.length, s.tribes[0].huts.length);
  assert.equal(back.seaFolk.tribes[0].found, true);
  assert.equal(back.seaFolk.folk(back).length, n);
  assert.ok(back.rivals.serialize().brutes.every((b) => !b.sea));
  run(back, 3);
});

test('bare test worlds have no Sea People', () => {
  const w = new World(77, false);
  w.rivals.started = true;
  w.elapsed = 1000;
  w.update(DT);
  assert.equal(w.seaFolk.tribes.length, 0);
});

test('all Sea People are friends: villages join into one bigger village (names, colours, sea dragons + riches)', () => {
  const { MAX_SEA_TIER } = require(path.join(root, 'sim', 'seaFolk.ts'));
  const w = seaWorld();
  const s = w.seaFolk;
  const [a, b] = s.tribes;
  a.seen = true;
  b.found = true;
  for (const x of s.members(b.id).slice(3)) w.rivals.kill(w, x);
  const movers = s.members(b.id);
  const beast = w.dinos[0];
  beast.seaTribe = b.id;
  b.pearls = 5;
  a.tier = 3;
  const total = s.members(a.id).length + movers.length;
  s['uniteT'] = 0;
  s['slowTick'](w, 1);
  assert.equal(s.tribes.length, 1);
  const u = s.tribes[0];
  assert.equal(u.id, a.id);
  assert.ok(u.name.includes('&'), u.name);
  assert.equal(u.colors.length, 2);
  assert.equal(u.tier, 4, 'past the usual top size');
  assert.equal(s.maxTier(u), 4);
  assert.ok(u.pearls >= 5, 'their pearls came too');
  assert.equal(beast.seaTribe, u.id, 'and their sea dragon');
  assert.equal(s.members(u.id).length, total);
  assert.ok(movers.every((x) => x.sea === u.id));
  assert.ok(u.found && u.seen);
  assert.ok(w.toasts.some((x) => x.includes('joined into one village')));
  u.merges = 9;
  assert.equal(s.maxTier(u), MAX_SEA_TIER);
  // Sea People never fight Sea People
  const p = s.members(u.id)[0];
  assert.equal(s['foeNearAt'](w, p.x, p.y, 5000, false, u)?.b?.sea, undefined);
});

test('they train a wild sea dragon, ride it round their waters, and it bites from the water in a fight', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  const t = s.tribes[0];
  w.dinos.length = 0;
  // a wild plesiosaur in the village's waters
  let spot = null;
  for (let r = 80; r < t.r && !spot; r += 20) for (let a = 0; a < 6.28 && !spot; a += 0.3) {
    const x = t.x + Math.cos(a) * r;
    const y = t.y + Math.sin(a) * r;
    if (w.terrain.tileAt(x, y) === T.Deep) spot = { x, y };
  }
  assert.ok(spot);
  const d = addDino(w, 'plesio', spot.x, spot.y, { age: 9999 });
  for (let i = 0; i < 400 && !d.seaTribe; i++) s['tameTick'](w, t, 1, 6);
  assert.equal(d.seaTribe, t.id, 'trained');
  w.update(DT); // (the world's id index picks the new dino up each frame)
  assert.ok(w.toasts.some((x) => x.includes('trained a wild')) || !t.found);
  // up on its back
  const b = s.members(t.id).find((x) => x.age >= SEA_GROWN);
  b.band = undefined;
  assert.ok(s.mountUp(w, b, d));
  assert.equal(d.seaRider, b.id);
  b.tx = d.x + 120;
  b.ty = d.y;
  b.state = 'wander';
  b.think = 999;
  const x0 = d.x;
  for (let i = 0; i < 30; i++) s.step(w, b, DT);
  assert.ok(b.z > 2, 'sits up on its back');
  assert.equal(d.x, b.x, 'the dragon carries its rider');
  assert.ok(Math.abs(d.x - x0) > 1 || !water(w, x0 + 20, d.y), 'it moved (through the water)');
  // a fight: someone on the bank within reach gets bitten
  const h = addHuman(w, b.x + 40, b.y);
  b.targetId = h.id;
  b.state = 'fight';
  b.stateT = 0;
  b.cd = 0;
  const hp = h.hp;
  require(path.join(root, 'sim', 'rivals.ts'));
  s['act'](w, b, DT);
  assert.ok(h.hp < hp || !w.humans.includes(h), 'the sea dragon bit');
  // the rider falls: the dragon is free again
  w.rivals.kill(w, b);
  assert.equal(d.seaRider, undefined);
});

test('their sea farms grow pearls (and shark teeth); a raid on the village carries the pearls home', () => {
  const w = seaWorld();
  const s = w.seaFolk;
  const t = s.tribes[0];
  assert.ok(t.huts.some((h) => h.kind === 'pearlBed') && t.huts.some((h) => h.kind === 'fishPen') && t.huts.some((h) => h.kind === 'sharkPen'), 'pearl beds, a fish pen + a shark pen');
  for (let i = 0; i < 600; i++) s['farmsTick'](t, 1);
  assert.ok(t.pearls >= 4 && t.teeth >= 3, 'pearls + teeth piled up');
  const pearls = w.camp.stock.pearl;
  s.raze(w, t, 'us');
  assert.ok(w.camp.stock.pearl >= pearls + 4, 'pearls came home');
});
