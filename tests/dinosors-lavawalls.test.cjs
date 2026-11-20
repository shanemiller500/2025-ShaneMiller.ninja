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
const build = require(path.join(root, 'sim', 'build.ts'));
const nav = require(path.join(root, 'sim', 'nav.ts'));
const { SCORPION_TIERS } = require(path.join(root, 'data', 'colony.ts'));
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  for (const t of ['tools', 'fire', 'palisade', 'stonewall', 'scorpion']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 14; y <= cy + 14; y++) for (let x = cx - 14; x <= cx + 14; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  return { w, cx, cy };
}
/** A finished run of wall: the first few palisade, then stone, polygon, a bone gate, stairs. */
function walls(w, cx, cy) {
  const out = [];
  for (let x = cx - 6; x <= cx + 6; x++) {
    const kind = x < cx - 2 ? 'palisade' : x < cx + 2 ? 'stone' : 'polygon';
    const wl = w.tribe.addWall(w, x, cy + 9, kind, x === cx ? 'gate' : 'wall');
    wl.built = 1;
    wl.hp = build.wallMaxHp(wl);
    out.push(wl);
  }
  const gate = out.find((g) => g.part === 'gate');
  gate.bone = true;
  const stairs = w.tribe.addWall(w, cx - 6, cy + 10, 'stone', 'stairs');
  stairs.built = 1;
  stairs.hp = build.wallMaxHp(stairs);
  w.tribe.version++;
  w.nav.sync(w);
  return { out, gate, stairs };
}
const plan = (w) => w.tribe['autoPlan'](w);

test('lava stone is the next wall upgrade: once there is some, every wall is queued to be rebuilt in it (by itself)', () => {
  const { w, cx, cy } = world(6101);
  const { out, gate } = walls(w, cx, cy);
  plan(w);
  assert.ok(out.every((wl) => wl.upTo !== 'lava'), 'nothing happens without lava stone');
  w.camp.stock.lavaStone = 1;
  plan(w);
  assert.ok(w.flags.has('lavaWalls'));
  assert.ok(w.events.some((e) => e.type === 'toast' && e.text.includes('Lava stone!')), 'announced');
  for (const wl of out) {
    assert.equal(wl.upgrade, true, `${wl.kind} ${wl.part} queued`);
    assert.equal(wl.upTo, 'lava');
  }
  // the costs: one block a piece, two for a gate
  assert.deepEqual(build.wallNeed(out[0]), { r: 'lavaStone', n: 1 });
  assert.deepEqual(build.wallNeed(gate), { r: 'lavaStone', n: 2 });
  // the polygon age never takes it back to polygon stone
  w.civ.done.add('precisionStone');
  plan(w);
  assert.ok(out.every((wl) => wl.upTo === 'lava'));
});

test('a wall built in lava stone: tougher, no bones on the gate, and no new bone entrance planned for its ring', () => {
  const { w, cx, cy } = world(6102);
  const { out, gate } = walls(w, cx, cy);
  w.camp.stock.lavaStone = 1;
  plan(w);
  // builders finish the swap (the finishing step from build.ts): kind turns lava, bone dressing comes off
  for (const wl of out) {
    wl.kind = wl.upTo;
    wl.upTo = undefined;
    wl.upgrade = false;
    if (wl.kind === 'lava') { wl.bone = false; wl.boneUp = false; }
    wl.built = 1;
    wl.hp = build.wallMaxHp(wl);
  }
  assert.equal(gate.kind, 'lava');
  assert.equal(gate.bone, false, 'no bones on top');
  assert.ok(build.wallMaxHp(out[1]) >= build.WALL_HP.lava, 'the toughest wall');
  assert.ok(build.WALL_HP.lava > build.WALL_HP.polygon);
  w.tribe.version++;
  w.tribe['entranceV'] = -1;
  plan(w);
  assert.ok(!w.tribe.walls.some((g) => g.bone || g.boneUp), 'no bone gate comes back');
});

test('the real builders do the swap: the finished piece is lava stone, and a bone gate loses its bones', () => {
  const { w, cx, cy } = world(6103);
  const { gate } = walls(w, cx, cy);
  w.camp.stock.lavaStone = 300;
  plan(w);
  for (let i = 0; i < 6; i++) addHuman(w, w.camp.x + i * 12, w.camp.y + 40, false, { role: 'builder' });
  w.tribe.planT = Infinity;
  const stone0 = w.camp.stock.lavaStone;
  for (let t = 0; t < 120; t += 1 / 30) { w.update(1 / 30); w.events.length = 0; }
  const done = w.tribe.walls.filter((x) => x.kind === 'lava' && x.built >= 1);
  assert.ok(done.length >= 20, `builders swapped walls over to lava stone (${done.length})`);
  assert.ok(w.camp.stock.lavaStone < stone0, 'using the lava stone from the stores');
  assert.ok(done.every((x) => !x.bone && !x.boneUp), 'no bones on any finished lava piece');
  assert.ok(done.every((x) => x.hp >= build.wallMaxHp(x) * 0.99), 'built to full strength');
});

test('Scorpions on a lava-stone wall are fully upgraded for free', () => {
  const { w, cx, cy } = world(6104);
  const { out } = walls(w, cx, cy);
  const wl = out[3];
  const s = w.colony.addScorpion(w, wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE / 2);
  assert.ok(s && typeof s === 'object');
  s.built = 1;
  s.tier = 1;
  s.hp = 50;
  w.camp.stock.lavaStone = 1;
  plan(w);
  assert.equal(s.tier, 1, 'not till its wall is lava stone');
  wl.kind = 'lava'; wl.upgrade = false; wl.upTo = undefined; wl.built = 1;
  plan(w);
  assert.equal(s.tier, SCORPION_TIERS.length, 'top tier');
  assert.equal(s.obsidian, true, 'the Obsidian Fire Shield');
  assert.ok(s.hp >= SCORPION_TIERS[SCORPION_TIERS.length - 1].hp, 'mended to full');
  assert.equal(w.camp.stock.lavaStone, 1, 'for free');
});

test('the lava walkway stands taller: guards + Scorpions on it are raised to match', () => {
  const { w, cx, cy } = world(6105);
  const { out } = walls(w, cx, cy);
  const wl = out[4];
  wl.kind = 'lava';
  w.tribe.version++;
  w.nav.sync(w);
  const h = addHuman(w, wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE / 2, false, { role: 'guard' });
  h.level = 1;
  h.z = 0;
  for (let i = 0; i < 30; i++) { h.think = 99; w.update(1 / 30); }
  assert.ok(h.z > nav.WALK_Z + 6, `standing on the taller walkway (z ${h.z.toFixed(1)})`);
  const s = w.colony.addScorpion(w, wl.tx * TILE + TILE / 2, wl.ty * TILE + TILE / 2);
  if (s && typeof s === 'object' && s.mount === 'wall') assert.equal(w.colony.scorpionZ(s, w), nav.WALK_Z + 8 + nav.LAVA_WALK_LIFT);
});

test('nobody has to do a thing: auto workers dig the statues, and the walls upgrade from that', () => {
  const { w, cx, cy } = world(6106);
  for (const t of ['axe', 'basket']) w.camp.learned.add(t);
  for (let x = cx + 14; x <= cx + 30; x++) for (let y = cy - 4; y <= cy + 4; y++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  const { out } = walls(w, cx, cy);
  // two Lava Monster statues (lava-stone deposits) out past the camp
  for (let k = 0; k < 2; k++) w.colony.nodes.push({ id: w.nextId(), kind: 'lavaStone', x: (cx + 24 + k * 2) * TILE + 16, y: (cy + k) * TILE + 16, amount: 6, max: 6, found: true, variant: 0 });
  for (let i = 0; i < 8; i++) addHuman(w, w.camp.x + (i % 4) * 14, w.camp.y + 30 + Math.floor(i / 4) * 14, false, {});
  w.tribe.planT = 1e9;
  for (let t = 0; t < 360; t += 1 / 30) {
    w.update(1 / 30);
    w.events.length = 0;
    if (Math.round(t * 30) % 180 === 0) plan(w);
  }
  assert.ok(w.flags.has('lavaWalls'), 'lava stone came home, by itself');
  assert.ok(out.filter((x) => x.kind === 'lava' && x.built >= 1).length >= 4, 'and walls were rebuilt in it');
});
