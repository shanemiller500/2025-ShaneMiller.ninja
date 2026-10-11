// Headless tests for the Deep's Phase 1 mining foundation: spent rubble, rich deposits,
// tool tiers, natural pools that sleep, and ore stranded at the cave mouth.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const root = path.join(__dirname, '..', 'app', 'dinosors');
const { World } = require(path.join(root, 'sim', 'world.ts'));
const { Mine, pickTier, toolsOf } = require(path.join(root, 'sim', 'mine.ts'));
const { flushMineLoads } = require(path.join(root, 'sim', 'miners.ts'));
const { LIFT_X, M, MINE_W, FIND_AMOUNT } = require(path.join(root, 'data', 'mine.ts'));

const mIdx = (x, y) => y * MINE_W + x;
const ALL_TOOLS = { pick: true, ironPick: true, drill: true, lantern: true, pump: true, dynamite: true, luck: 0 };

/** Open a straight tunnel from the shaft at row y out to (not including) column x. */
function carve(mine, x, y) {
  for (let cx = LIFT_X + 1; cx < x; cx++) mine.cells[mIdx(cx, y)] = M.Open;
  mine.version++;
}

/** First ore cell in rows [y0, y1) whose deposit takes at least `hits` hits. */
function findDeposit(mine, y0, y1, hits) {
  for (let y = y0; y < y1; y++)
    for (let x = LIFT_X + 3; x < MINE_W - 3; x++) {
      const i = mIdx(x, y);
      if (mine.baseAt(i) === M.Open || mine.baseAt(i) === M.Bedrock) continue;
      const r = mine.oreAt(i);
      if (r && r in FIND_AMOUNT && mine.oreHits(i) >= hits && mine.contentOf(i) === r) return { x, y, r };
    }
  return null;
}

test('a rich deposit takes several hits, shrinks as it goes, then opens', () => {
  const m = new Mine(4242);
  const d = findDeposit(m, 3, 28, 2);
  assert.ok(d, 'a multi-hit deposit exists near the top');
  carve(m, d.x, d.y);
  const i = mIdx(d.x, d.y);
  const hits = m.oreHits(i);
  let got = 0;
  for (let k = 1; k < hits; k++) {
    const r = m.dig(d.x, d.y, ALL_TOOLS);
    assert.ok(r.ok && r.r === d.r && r.n >= 1, 'each hit pays out ore');
    assert.equal(r.left, hits - k, 'hits left counts down');
    assert.ok(m.cells[i] !== M.Open, 'still rock while ore is left');
    assert.deepEqual(m.oreRemaining(i), { left: hits - k, max: hits });
    got += r.n;
  }
  const last = m.dig(d.x, d.y, ALL_TOOLS);
  assert.ok(last.ok && !last.left, 'the last hit digs it out');
  assert.equal(m.cells[i], M.Open);
  assert.ok(got + (last.n ?? 0) >= hits, 'paid out at least one unit per hit');
});

test('a part-chipped deposit survives save + load', () => {
  const w = new World(4242, false);
  const m = w.mine;
  const d = findDeposit(m, 3, 28, 2);
  carve(m, d.x, d.y);
  m.dig(d.x, d.y, ALL_TOOLS);
  const i = mIdx(d.x, d.y);
  const left = m.oreLeft[i];
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.mine.oreLeft[i], left);
  // untouched deposits aren't written into the save at all
  assert.equal(w.serialize().mine.oreLeft.length, 1);
});

test('rubble is spent rock: re-digging a collapsed ore cell pays nothing and brings down no more roof', () => {
  const m = new Mine(4242);
  const d = findDeposit(m, 3, 28, 1);
  carve(m, d.x, d.y);
  const i = mIdx(d.x, d.y);
  while (m.cells[i] !== M.Open) m.dig(d.x, d.y, ALL_TOOLS);
  // the roof falls back in where the ore was
  m.cells[i] = M.Rubble;
  m.version++;
  assert.equal(m.contentOf(i), null, 'nothing left in the rubble');
  const caveIns = m.stats.caveIns;
  const r = m.dig(d.x, d.y, ALL_TOOLS);
  assert.ok(r.ok);
  assert.equal(r.r, undefined, 'no ore the second time');
  assert.equal(r.collapsed, undefined, 'clearing rubble is safe');
  assert.equal(m.stats.caveIns, caveIns);
});

test('pick tiers follow what the tribe has, and the copper pick kit counts', () => {
  assert.equal(pickTier({ ...ALL_TOOLS, pick: false, ironPick: false, drill: false }), 0);
  assert.equal(pickTier({ ...ALL_TOOLS, ironPick: false, drill: false }), 1);
  assert.equal(pickTier({ ...ALL_TOOLS, ironPick: false, drill: false, copperPick: true }), 2);
  assert.equal(pickTier({ ...ALL_TOOLS, drill: false }), 3);
  assert.equal(pickTier({ ...ALL_TOOLS, drill: false, reinforced: true }), 4);
  assert.equal(pickTier({ ...ALL_TOOLS }), 5);
  assert.equal(pickTier({ ...ALL_TOOLS, diamond: true }), 6);
  const w = new World(7, false);
  w.colony.kits.add('copperPick');
  assert.equal(toolsOf(w).copperPick, true);
  const m = w.mine;
  const d = findDeposit(m, 3, 28, 1);
  carve(m, d.x, d.y);
  const bare = m.digTime(d.x, d.y, { ...ALL_TOOLS, ironPick: false, drill: false });
  const copper = m.digTime(d.x, d.y, { ...ALL_TOOLS, ironPick: false, drill: false, copperPick: true });
  assert.ok(copper < bare, 'copper picks dig faster');
});

test('natural caverns hold settled pools that stay put, cost nothing while still, and save as nothing', () => {
  let pools = 0;
  for (const seed of [1, 42, 777]) {
    const m = new Mine(seed);
    let cells = 0;
    for (let i = 0; i < m.water.length; i++) if (m.water[i] > 0.5) cells++;
    pools += cells;
    const before = Float32Array.from(m.water);
    for (let k = 0; k < 600; k++) m.update(null, 1 / 60);
    let drift = 0;
    for (let i = 0; i < m.water.length; i++) drift += Math.abs(m.water[i] - before[i]);
    assert.ok(drift < 1e-3, `seed ${seed}: the pools are already level (moved ${drift})`);
    assert.equal(m.serialize().water.length, 0, 'untouched pools are part of the generated mine');
  }
  assert.ok(pools > 30, `some worlds have underground pools (${pools} cells)`);
});

test('breaching a pool lets the water run into the new tunnel', () => {
  const m = new Mine(777);
  // a pool cell with rock right beside it at the same level
  let at = null;
  for (let i = 0; i < m.water.length && !at; i++) {
    if (m.water[i] < 0.99) continue;
    const x = i % MINE_W;
    const y = Math.floor(i / MINE_W);
    const side = mIdx(x + 1, y);
    if (x + 2 < MINE_W && m.cells[side] !== M.Open && m.cells[side] !== M.Bedrock && m.cells[side] !== M.Magma && m.cells[side] !== M.Granite) at = { x: x + 1, y };
  }
  assert.ok(at, 'a pool with a diggable wall');
  // open the wall (as a dig would), with a little tunnel behind it
  m.cells[mIdx(at.x, at.y)] = M.Open;
  m.cells[mIdx(at.x + 1, at.y)] = M.Open;
  m.version++;
  for (let k = 0; k < 120; k++) m.update(null, 1 / 60);
  assert.ok(m.water[mIdx(at.x, at.y)] > 0.05, 'water spilled into the breach');
});

test('a dug-out pool cell is remembered after save + load', () => {
  const w = new World(777, false);
  const m = w.mine;
  const i = m.water.findIndex((v) => v > 0.99);
  assert.ok(i >= 0);
  m.water[i] = 0;
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(back.mine.water[i] < 0.01, 'the drained cell stays drained');
  const j = m.water.findIndex((v, k) => v > 0.99 && k !== i);
  assert.ok(back.mine.water[j] > 0.99, 'the rest of the pool is still there');
});

test('ore waiting for a hauler goes onto the stockpile by hand when there is no hauler', () => {
  const w = new World(5, false);
  w.mineLoads = { copper: 7, gold: 2 };
  const copper = w.camp.stock.copper;
  flushMineLoads(w);
  assert.equal(w.camp.stock.copper, copper + 7);
  assert.deepEqual(w.mineLoads, {});
});

test('reinforced picks cut granite without a drill (slowly); shovels shift soft ground faster', () => {
  const m = new Mine(4242);
  let g = null;
  for (let y = 31; y < 105 && !g; y++) for (let x = LIFT_X + 3; x < MINE_W - 3; x++) if (m.cells[mIdx(x, y)] === M.Granite) { g = { x, y }; break; }
  assert.ok(g, 'some granite');
  m.liftMax = g.y;
  carve(m, g.x, g.y);
  const noDrill = { ...ALL_TOOLS, drill: false };
  assert.match(m.cantDig(g.x, g.y, noDrill) ?? '', /drill/i, 'plain iron picks bounce off granite');
  assert.equal(m.cantDig(g.x, g.y, { ...noDrill, reinforced: true }), null, 'reinforced picks get through');
  assert.ok(m.digTime(g.x, g.y, { ...noDrill, reinforced: true }) > m.digTime(g.x, g.y, ALL_TOOLS), 'but slower than a drill');
  // soft ground
  let s = null;
  for (let x = LIFT_X + 2; x < MINE_W - 2 && !s; x++) if (m.cells[mIdx(x, 3)] === M.Soil || m.cells[mIdx(x, 3)] === M.Clay) s = { x, y: 3 };
  assert.ok(s);
  carve(m, s.x, s.y);
  assert.ok(m.digTime(s.x, s.y, { ...ALL_TOOLS, shovel: true }) < m.digTime(s.x, s.y, ALL_TOOLS) * 0.7);
});

test('without a chisel some fossils + artifacts crack; with one they never do', () => {
  let cracked = 0;
  let whole = 0;
  for (const seed of [9001, 9002, 9003, 9004, 9005, 9006]) {
    for (const chisel of [false, true]) {
      const m = new Mine(seed);
      for (let y = 110; y < 150; y++)
        for (let x = LIFT_X + 3; x < MINE_W - 3; x++) {
          const i = mIdx(x, y);
          const c = m.contentOf(i);
          if (c !== 'fossil' && c !== 'artifact') continue;
          if (m.baseAt(i) === M.Open || m.cells[i] === M.Bedrock) continue;
          m.liftMax = Math.max(m.liftMax, y);
          carve(m, x, y);
          const r = m.dig(x, y, { ...ALL_TOOLS, chisel });
          if (!r.ok || (!r.fossil && !r.artifact)) continue;
          if (chisel) assert.ok(!r.damaged, 'a chisel keeps finds whole');
          else if (r.damaged) cracked++;
          else whole++;
        }
    }
  }
  assert.ok(cracked > 0 && whole > 0, `some crack, some don't (${cracked} cracked, ${whole} whole)`);
});

test('every world grows its cave features: rivers, crystal caves, lost rooms, hidden chambers, shafts + ramps', () => {
  for (const seed of [1, 5, 42, 777]) {
    const m = new Mine(seed);
    const kinds = new Set(m.features.map((f) => f.kind));
    for (const k of ['river', 'crystalCave', 'artifactRoom', 'hiddenChamber', 'shaft', 'ramp']) assert.ok(kinds.has(k), `seed ${seed} has a ${k}`);
    // a lost room has things set into its walls
    const room = m.features.find((f) => f.kind === 'artifactRoom');
    assert.ok(room.cells.some((i) => ['artifact', 'fossil'].includes(m.contentOf(i))), 'finds in the lost room walls');
    // a crystal cave is lined with crystal
    const cave = m.features.find((f) => f.kind === 'crystalCave');
    assert.ok(cave.cells.filter((i) => m.oreAt(i) === 'crystal').length >= 6, 'crystal walls');
  }
});

test('a cave feature is found when it comes into view, gives its sticker once, and stays found after save + load', () => {
  const w = new World(42, false);
  const m = w.mine;
  const n = m.features.findIndex((f) => f.kind === 'crystalCave');
  const cave = m.features[n];
  for (const i of cave.cells) m.seen[i] = 1;
  m.version++;
  w.update(1 / 30);
  assert.ok(m.featuresFound.has(n), 'found');
  assert.ok(w.discoveries.has('crystalCave'), 'sticker');
  assert.ok(cave.cells.some((i) => m.seen[i] === 2 && m.known.get(i) === 'crystal'), 'the crystal walls light up as known');
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(back.mine.featuresFound.has(n), 'still found after loading');
});

test('underground rivers: nobody wades in, water that runs into one is carried away', () => {
  const m = new Mine(42);
  const i = m.river.findIndex((v) => v > 0);
  assert.ok(i >= 0);
  const x = i % MINE_W;
  const y = Math.floor(i / MINE_W);
  assert.equal(m.passable(x, y), false, 'the stream itself');
  assert.equal(m.passable(x, y - 1), true, 'the bank above it');
  m.water[i - MINE_W] = 1; // a splash on the bank right above
  m.version++;
  for (let k = 0; k < 120; k++) m.update(null, 1 / 60);
  assert.ok(m.water[i - MINE_W] < 0.05 && m.water[i] === 0, 'drained into the river');
});

test('a pump station beside a river keeps the camp supplied without draining anything', () => {
  const { updateDeepBuilds } = require(path.join(root, 'sim', 'deepBuild.ts'));
  const w = new World(42, false);
  const m = w.mine;
  const i = m.river.findIndex((v) => v > 0);
  const x = i % MINE_W;
  const y = Math.floor(i / MINE_W);
  m.builds.push({ id: 99, kind: 'pump', x, y: y - 2, built: 1, have: true, grow: 0 });
  m.reindex();
  w.camp.stock.water = 0;
  for (let k = 0; k < 300; k++) updateDeepBuilds(w, 1 / 30);
  assert.ok(w.camp.stock.water > 5, `water came up (${w.camp.stock.water})`);
});

/** A camp with tools + food, n miners down the mine and a dig order, plus (optionally) a trained stego. */
function packWorld(seed, withPack) {
  const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
  const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
  const { LM } = require(path.join(root, 'sim', 'terrain.ts'));
  const { pickMiners, sendDown, setOrder } = require(path.join(root, 'sim', 'miners.ts'));
  const { workOf } = require(path.join(root, 'sim', 'workDinos.ts'));
  const w = new World(seed);
  for (let i = 0; i < 8; i++) addHuman(w, (LM.camp.x + (i % 4) - 2) * 32, (LM.camp.y + 2) * 32);
  for (const t of ['tools', 'fire', 'basket']) w.camp.learned.add(t);
  Object.assign(w.camp.stock, { cooked: 200, wood: 50 });
  for (let k = 0; k < 120; k++) w.update(1 / 30);
  for (const h of pickMiners(w, 4)) sendDown(w, h);
  let stego = null;
  if (withPack) {
    stego = addDino(w, 'stego', w.camp.caveX + 40, w.camp.caveY + 40, { owner: true, tame: 1, growth: 1, herd: 0 });
    const work = workOf(stego);
    work.skills.hauler = 0.8;
    work.harness = 1;
    work.auto = false;
  }
  for (let k = 0; k < 30 * 40; k++) w.update(1 / 30);
  // a long gallery out along row 12 + 13 (two high: a pack can follow)
  for (let y = 12; y <= 13; y++) for (let x = LIFT_X + 1; x < 40; x++) setOrder(w, x, y, 'dig');
  for (let y = 2; y <= 12; y++) setOrder(w, LIFT_X + 1, y, 'dig');
  return { w, stego };
}

test('a pack dinosaur rides down, keeps to the tall tunnels, takes sacks off the miners and carries them up', () => {
  const { sendPack, roomy, PACK } = require(path.join(root, 'sim', 'packs.ts'));
  const { w, stego } = packWorld(77, true);
  assert.ok(w.mine.crew.length >= 3, `crew down (${w.mine.crew.length})`);
  assert.equal(sendPack(w, stego), null, 'sent');
  assert.ok(stego.under && w.mine.packs.length === 1);
  let carried = 0;
  let cramped = 0;
  for (let k = 0; k < 30 * 180; k++) {
    w.update(1 / 30);
    w.events.length = 0;
    const p = w.mine.packs[0];
    if (!p) break;
    const load = Object.values(p.carry).reduce((a, n) => a + (n ?? 0), 0);
    carried = Math.max(carried, load);
    if (!p.path.length && !roomy(w.mine, Math.floor(p.x), Math.floor(p.y))) cramped++;
  }
  assert.ok(carried > 0, 'miners handed their sacks to it');
  assert.equal(cramped, 0, 'never stopped in a one-high tunnel');
  assert.ok(!w.creatureHash.rect(0, 0, 1e5, 1e5, []).includes(stego), 'not on the surface while it works');
  // it survives save + load, then comes home when called
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(back.mine.packs.length, 1);
  assert.ok(back.dinos.find((d) => d.id === stego.id).under);
  const { recallPacks } = require(path.join(root, 'sim', 'packs.ts'));
  recallPacks(back);
  for (let k = 0; k < 30 * 60 && back.mine.packs.length; k++) back.update(1 / 30);
  assert.equal(back.mine.packs.length, 0, 'came up');
  assert.ok(!back.dinos.find((d) => d.id === stego.id).under, "back on the surface");
  void PACK;
});

test('big dinosaurs are turned away at the cave', () => {
  const { sendPack } = require(path.join(root, 'sim', 'packs.ts'));
  const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
  const { workOf } = require(path.join(root, 'sim', 'workDinos.ts'));
  const w = new World(3, false);
  const brachio = addDino(w, 'brachio', 500, 500, { owner: true, tame: 1, growth: 1 });
  workOf(brachio).skills.heavy = 0.8;
  workOf(brachio).harness = 1;
  assert.match(sendPack(w, brachio) ?? '', /too big/i);
  assert.ok(!brachio.under);
});

test('a miner who went up hurt heads back down once healed; a recall keeps everyone up', () => {
  const { hurtMiner, recallAll } = require(path.join(root, 'sim', 'miners.ts'));
  const { w } = packWorld(81, false);
  const m = w.mine.crew[0];
  const h = w.humans.find((x) => x.id === m.id);
  hurtMiner(w, m, 5, 'rock');
  assert.ok(!h.under && w.mine.healing.has(h.id), 'up to heal, remembered');
  h.hp = 1;
  if (h.state === 'down') h.state = 'idle';
  for (let k = 0; k < 120; k++) w.update(1 / 30);
  assert.ok(w.mine.pending.has(h.id) || h.under, 'on the way back down');
  // a recall forgets it
  const m2 = w.mine.crew.find((x) => x.id !== h.id);
  const h2 = w.humans.find((x) => x.id === m2.id);
  hurtMiner(w, m2, 5, 'rock');
  assert.ok(w.mine.healing.has(h2.id));
  recallAll(w);
  assert.equal(w.mine.healing.size, 0);
});
