const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { addHuman } = require('./humans.ts');
const { addDino } = require('./dinos.ts');
const { T, TILE, MAP_W, MAP_H, PREV_MAP_W } = require('./types.ts');
const { LM, STREAMS, TERRAIN_GEN } = require('./terrain.ts');
const rb = require('./riverBeasts.ts');

const DT = 1 / 30;
function quiet(seed = 5151) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.time = 12;
  w.timePaused = true;
  w.randomEvents.enabled = false;
  return w;
}
/** A pool of river water with dry bank to its east, well out of camp. */
function riverside(w) {
  const cx = Math.floor(w.camp.x / TILE) + 50, cy = Math.floor(w.camp.y / TILE) + 30;
  for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 8; x <= cx + 8; x++) w.terrain.setTile(x, y, x <= cx ? T.River : T.Dirt);
  w.nav.sync(w);
  return { x: (cx - 2) * TILE + 16, y: cy * TILE + 16, bank: (cx + 1) * TILE + 16 };
}
function beast(w, kind, x, y) {
  const d = addDino(w, kind, x, y, { growth: 1, homeX: x, homeY: y, hunger: 0, thirst: 0 });
  d.layT = 1e9;
  w.update(DT);
  return d;
}

test('the land keeps its crocodiles, hippos and snakes, all well away from the camp', () => {
  const w = quiet();
  w.wildlife.enabled = true;
  for (let k = 0; k < 3; k++) { w.elapsed += 1; rb.riverLifeTick(w, 1.1); }
  for (const k of ['croc', 'hippo', 'snake']) {
    const list = w.dinos.filter((d) => d.species === k);
    assert.ok(list.length >= 2, `${k}: ${list.length}`);
    for (const d of list) assert.ok(Math.hypot(d.x - w.camp.x, d.y - w.camp.y) > rb.CAMP_CLEAR - 100, `${k} away from camp`);
  }
  for (const d of w.dinos.filter((x) => x.species === 'croc')) assert.ok(rb.homeWater(w, d.homeX, d.homeY), 'crocs live in the water');
  assert.ok(w.dinos.every((d) => !rb.isRiverBeast(d) || d.layT > 1e8), 'they never lay (the land keeps their numbers)');
});

test('a crocodile lurking in the river lunges at someone at the water\'s edge, and bites', () => {
  const w = quiet();
  const s = riverside(w);
  const croc = beast(w, 'croc', s.x, s.y);
  const h = addHuman(w, s.bank, s.y + 6, false, { role: 'gatherer' });
  const hp = h.hp;
  let bitten = false;
  for (let k = 0; k < 30 * 8 && !bitten; k++) { w.update(DT); h.x = s.bank; h.y = s.y + 6; bitten = h.hp < hp || !w.humans.includes(h); }
  assert.ok(bitten, 'bitten');
  assert.ok(Math.hypot(croc.x - croc.homeX, croc.y - croc.homeY) < rb.CFG.croc.leash * 1.3, 'it stays near home');
});

test('a hippo charges anything that comes near it, animals too', () => {
  const w = quiet();
  const s = riverside(w);
  const hippo = beast(w, 'hippo', s.x, s.y);
  const trike = addDino(w, 'trike', s.bank + 20, s.y, { growth: 1 });
  w.update(DT);
  const hp = trike.health;
  let hit = false;
  for (let k = 0; k < 30 * 8 && !hit; k++) { w.update(DT); trike.x = s.bank + 20; trike.y = s.y; hit = trike.health < hp || !w.dinos.includes(trike); }
  assert.ok(hit, 'it charged + bit the trike');
  assert.ok(w.dinos.includes(hippo));
});

test('a giant snake strikes whoever walks past: venom leaves them dizzy and slow', () => {
  const w = quiet();
  const s = riverside(w);
  const snake = beast(w, 'snake', s.bank + 80, s.y);
  const h = addHuman(w, s.bank + 120, s.y, false, { role: 'gatherer' });
  let struck = false;
  for (let k = 0; k < 30 * 6 && !struck; k++) { w.update(DT); h.x = s.bank + 120; h.y = s.y; struck = (h.slowT ?? 0) > 0; }
  assert.ok(struck, 'dizzy from the venom');
  assert.ok(w.dinos.includes(snake));
});

test('they eat anything: someone of ours knocked down by one is gone (not on Calm)', () => {
  const w = quiet();
  const s = riverside(w);
  w.tribe.danger = 'normal';
  const croc = beast(w, 'croc', s.x, s.y);
  const h = addHuman(w, s.bank, s.y, false, { role: 'gatherer', hp: 0.2 });
  for (let k = 0; k < 30 * 8 && w.humans.includes(h); k++) { w.update(DT); if (w.humans.includes(h)) { h.x = s.bank; h.y = s.y; } }
  assert.ok(!w.humans.includes(h), 'eaten');
  assert.ok(w.dinos.includes(croc));
});

test('the second volcano: in the far east, and it erupts when the first one does', () => {
  const w = quiet();
  assert.ok(MAP_W > PREV_MAP_W, 'the map grew');
  assert.ok(w.volcano2.x > PREV_MAP_W * TILE, 'out in the new far east');
  assert.equal(w.terrain.tileAt(w.volcano2.x + 4 * TILE, w.volcano2.y), T.Volcano);
  assert.equal(w.volcanoes.length, 2);
  w.volcano.trigger(w);
  let erupted = false;
  for (let k = 0; k < 30 * 30 && !erupted; k++) { w.update(DT); erupted = w.volcano2.phase !== 'idle'; }
  assert.ok(erupted, 'the far-east volcano follows');
});

test('small streams run down to the sea, with rapids, and rocks in the rivers', () => {
  const w = quiet();
  let river = 0, rapids = 0;
  for (let x = PREV_MAP_W; x < MAP_W; x++) for (let y = 0; y < MAP_H; y++) {
    const i = y * MAP_W + x;
    if (w.terrain.tiles[i] === T.River) river++;
    if (w.terrain.rapids[i]) rapids++;
  }
  assert.ok(river > 40, `streams in the far east (${river} tiles)`);
  assert.ok(rapids > 5, `with rapids (${rapids})`);
  assert.ok(STREAMS.length >= 4);
});

test('a save from the 288-wide map loads with the far east filled in (and nothing doubled up)', () => {
  const w = new World(4242, true);
  const data = JSON.parse(JSON.stringify(w.serialize()));
  // make it look like an older save: 288 wide, with nothing out in the far east
  const edge = PREV_MAP_W * TILE;
  data.mapW = PREV_MAP_W;
  data.edits = (data.edits ?? []).filter(([i]) => i % MAP_W < PREV_MAP_W).map(([i, t]) => [(i % MAP_W) + Math.floor(i / MAP_W) * PREV_MAP_W, t]);
  data.plants = data.plants.filter((p) => p[1] < edge);
  data.dinos = data.dinos.filter((d) => d.x < edge);
  data.colony.nodes = data.colony.nodes.filter((n) => n[1] < edge);
  const oldNodes = data.colony.nodes.length;
  // (what an ordinary reload of the same world keeps in the old lands: the count to match)
  const plain = World.deserialize(JSON.parse(JSON.stringify(w.serialize()))).plants.filter((p) => p.x < edge).length;
  const loaded = World.deserialize(data);
  const west = loaded.plants.filter((p) => p.x < edge).length;
  assert.equal(west, plain, 'the old lands keep exactly their plants');
  assert.ok(loaded.plants.filter((p) => p.x >= edge).length > 50, 'the far east is planted');
  assert.ok(loaded.colony.nodes.filter((n) => n.x >= edge).length > 0, 'and has deposits');
  assert.equal(loaded.colony.nodes.filter((n) => n.x < edge).length, oldNodes, 'no extra deposits in the old lands');
  assert.ok(loaded.dinos.filter((d) => d.x >= edge).length > 0, 'and animals');
});

test('a new game (the newest map) also has small streams with rapids through the old lands', () => {
  const w = new World(5151, false, TERRAIN_GEN);
  const old = new World(5151, false);
  let added = 0, rapids = 0;
  for (let x = 0; x < PREV_MAP_W; x++) for (let y = 0; y < MAP_H; y++) {
    const i = y * MAP_W + x;
    if (w.terrain.tiles[i] === T.River && old.terrain.tiles[i] !== T.River) added++;
    if (w.terrain.rapids[i]) rapids++;
  }
  assert.ok(added > 60, `new streams (${added} tiles)`);
  assert.ok(rapids > 10, `with rapids (${rapids})`);
  // the camp, the lake and the nesting ground are where they always were
  assert.equal(w.terrain.tileAt(LM.camp.x * TILE, LM.camp.y * TILE), T.Dirt);
  assert.equal(w.terrain.tileAt(LM.lake.x * TILE, LM.lake.y * TILE), T.Deep);
});
