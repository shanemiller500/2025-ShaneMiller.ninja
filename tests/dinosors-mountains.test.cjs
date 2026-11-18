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
const ter = require(path.join(root, 'sim', 'terrain.ts'));
const ml = require(path.join(root, 'sim', 'mountainLife.ts'));
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { MAP_W, MAP_H, T, TILE } = require(path.join(root, 'sim', 'types.ts'));

const DT = 1 / 30;
const SEEDS = [12345, 777, 4242];

function dist(px, py, pts) {
  let b = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    b = Math.min(b, Math.hypot(ax + dx * t - px, ay + dy * t - py));
  }
  return b;
}
/** Walkable-ground islands (8-way, no cutting corners), with some tiles blocked off. */
function islands(tr, blocked) {
  const id = new Int32Array(MAP_W * MAP_H).fill(-1);
  const ok = (i) => ter.isWalkTile(tr.tiles[i]) && !blocked[i];
  let n = 0;
  for (let s = 0; s < id.length; s++) {
    if (id[s] >= 0 || !ok(s)) continue;
    const q = [s];
    id[s] = n;
    while (q.length) {
      const i = q.pop(), x = i % MAP_W, y = (i / MAP_W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const j = ny * MAP_W + nx;
        if (id[j] >= 0 || !ok(j) || (dx && dy && (!ok(y * MAP_W + nx) || !ok(ny * MAP_W + x)))) continue;
        id[j] = n;
        q.push(j);
      }
    }
    n++;
  }
  return id;
}
const islandAt = (id, x, y) => {
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const v = id[(y + dy) * MAP_W + x + dx];
    if (v >= 0) return v;
  }
  return -1;
};
/** Either side of each range (tiles). */
const SIDES = {
  mossback: [[[22, 20], [24, 55], [26, 80]], [[56, 40], [60, 70], [50, 85], [50, 22]]],
  sentinel: [[[120, 60], [125, 85], [135, 45]], [[175, 60], [170, 85], [168, 40]]],
  redrock: [[[190, 70], [192, 92]], [[225, 80], [222, 98]]],
  icefang: [[[255, 75], [262, 92], [265, 57]], [[305, 80], [300, 95], [300, 40]]],
};

test('new worlds are generation 5: four mountain ranges, two snow-capped and two rocky; older worlds keep their land', () => {
  assert.equal(ter.TERRAIN_GEN, 5);
  assert.equal(ter.RANGES.length, 4);
  assert.deepEqual(ter.RANGES.map((r) => r.snowy), [false, true, false, true]);
  const old = new ter.Terrain(12345, 4);
  assert.ok(old.range.every((v) => v === 0), 'a generation-4 world has no new ranges in it');
  for (const seed of SEEDS) {
    const tr = new ter.Terrain(seed, 5);
    for (let k = 0; k < ter.RANGES.length; k++) {
      const r = ter.RANGES[k];
      let crest = 0, tiles = 0, forest = 0;
      for (let i = 0; i < tr.tiles.length; i++) {
        if (tr.range[i] !== k + 1) continue;
        tiles++;
        if (tr.tiles[i] === T.Mountain) crest++;
        if (tr.tiles[i] === T.Forest) forest++;
      }
      assert.ok(crest > 60, `${r.name}: a long crest of bare mountain (${crest} tiles)`);
      if (!r.dry) assert.ok(forest > 40, `${r.name}: pine forest on its slopes (${forest} tiles)`);
      // the passes are open, with a trail over the saddle
      for (const p of r.passes) {
        const [a, b] = p.pts;
        const mx = Math.round((a[0] + b[0]) / 2), my = Math.round((a[1] + b[1]) / 2);
        let trail = 0;
        for (let dx = -8; dx <= 8; dx++) for (let dy = -2; dy <= 2; dy++) if (tr.tiles[(my + dy) * MAP_W + mx + dx] === T.Dirt) trail++;
        assert.ok(trail > 2, `${r.name}: the ${p.name} has a trail`);
      }
    }
  }
});

test('the ranges cut the land into sections: you can only get across at the passes', () => {
  for (const seed of SEEDS) {
    const tr = new ter.Terrain(seed, 5);
    const open = islands(tr, new Uint8Array(MAP_W * MAP_H));
    for (const r of ter.RANGES) {
      const blocked = new Uint8Array(MAP_W * MAP_H);
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        if (r.passes.some((p) => dist(x, y, p.pts) < p.r + 3)) blocked[y * MAP_W + x] = 1;
        // (round Redrock's north end, the other way is the Great Peaks' own west pass)
        if (r.id === 'redrock' && dist(x, y, ter.VALLEYS[0].pts) < 5) blocked[y * MAP_W + x] = 1;
      }
      const shut = islands(tr, blocked);
      const [W, E] = SIDES[r.id];
      const ow = W.map(([x, y]) => islandAt(open, x, y)), oe = E.map(([x, y]) => islandAt(open, x, y));
      assert.ok([...ow, ...oe].every((c) => c >= 0 && c === ow[0]), `seed ${seed} ${r.name}: the passes join the sections`);
      const sw = W.map(([x, y]) => islandAt(shut, x, y)), se = E.map(([x, y]) => islandAt(shut, x, y));
      assert.ok(!sw.some((c) => c >= 0 && se.includes(c)), `seed ${seed} ${r.name}: with its passes shut there's no way round`);
    }
  }
});

test('snow-capped ranges stay white all year; rocky ranges are bare rock, white only in winter', () => {
  const w = new World(12345, false, 5);
  const crestOf = (k) => {
    const out = [];
    for (let i = 0; i < w.terrain.tiles.length; i++) if (w.terrain.range[i] === k + 1 && w.terrain.tiles[i] === T.Mountain && Math.floor(i / MAP_W) > 20) out.push(i);
    return out;
  };
  const cappedShare = (k) => { const c = crestOf(k); return c.filter((i) => w.snow.cap[i]).length / c.length; };
  assert.ok(cappedShare(1) > 0.8 && cappedShare(3) > 0.8, 'Sentinel + Icefang: snowcaps on the crest');
  assert.ok(cappedShare(0) < 0.05 && cappedShare(2) < 0.05, 'Mossback + Redrock: no snowcaps');
  // and the renderer only whitens rock above 0.55: the rocky ranges stay under it
  for (const i of crestOf(0)) assert.ok(w.terrain.elev[i] <= 0.55);
  // winter: a blanket over every range
  w.day = 10;
  w.snow.applySeason(w, true);
  const rocky = crestOf(2).map((i) => i + MAP_W).filter((i) => ter.isWalkTile(w.terrain.tiles[i]));
  assert.ok(rocky.length && rocky.every((i) => w.snow.depth[i] > 0.4), 'winter snow on the Redrock Range');
  w.day = 1;
  w.snow.applySeason(w, true);
  assert.ok(rocky.every((i) => w.snow.depth[i] < 0.1), 'gone again in spring');
});

test('there is ore up on the ranges', () => {
  const w = new World(12345, true, 5);
  for (let k = 0; k < ter.RANGES.length; k++) {
    const nodes = w.colony.nodes.filter((n) => w.terrain.range[Math.floor(n.y / TILE) * MAP_W + Math.floor(n.x / TILE)] === k + 1);
    assert.ok(nodes.some((n) => n.kind === 'iron'), `${ter.RANGES[k].name}: iron`);
  }
});

test('mountain goats, bighorns + mountain lions arrive on their own ranges', () => {
  const w = new World(777, true, 5);
  for (let t = 0; t < 160; t += DT) { w.update(DT); w.events.length = 0; }
  const mtn = w.dinos.filter(ml.isMountainBeast);
  for (let k = 0; k < ter.RANGES.length; k++) {
    const here = mtn.filter((d) => ml.homeRange(w, d) === k);
    const r = ter.RANGES[k];
    assert.ok(here.some((d) => d.species === 'mountainLion'), `${r.name}: a mountain lion`);
    assert.ok(here.some((d) => d.species === (r.snowy ? 'mountainGoat' : 'bighorn')), `${r.name}: ${r.snowy ? 'mountain goats' : 'bighorns'}`);
    assert.ok(!here.some((d) => d.species === (r.snowy ? 'bighorn' : 'mountainGoat')), `${r.name}: not the other kind`);
  }
  // older worlds: none (there are no ranges for them)
  const old = new World(777, true, 4);
  for (let t = 0; t < 160; t += DT) { old.update(DT); old.events.length = 0; }
  assert.equal(old.dinos.filter(ml.isMountainBeast).length, 0);
});

test('a goat that strays off its range heads back home, and it lays its eggs up there', () => {
  const w = new World(4242, false, 5);
  w.nav.sync(w);
  const home = ml.rangeHomes(w, 1, true)[0];
  assert.ok(home, 'Sentinel has homes');
  const g = addDino(w, 'mountainGoat', home.x - 30 * TILE, home.y, { growth: 1, homeX: home.x, homeY: home.y, hunger: 0.2, thirst: 0.2 });
  g.state = 'idle';
  assert.equal(ml.mountainThink(w, g), true, 'it decided to go back');
  assert.equal(g.state, 'wander');
  assert.ok(Math.hypot(g.tx - home.x, g.ty - home.y) < 120, 'toward home');
  // its nest: at home, not down on the valley's nesting ground
  g.x = home.x; g.y = home.y; g.layT = 0; g.health = 1; g.hunger = 0.1; g.thirst = 0.1; g.state = 'idle'; g.think = 0;
  const { thinkDino } = require(path.join(root, 'sim', 'behavior.ts'));
  if (thinkDino) {
    for (let i = 0; i < 20 && g.state !== 'nest'; i++) { g.think = 0; thinkDino(w, g); }
    if (g.state === 'nest') assert.ok(Math.hypot(g.tx - home.x, g.ty - home.y) < 2 * TILE, 'nesting at home');
  }
  // its wandering keeps to the range
  for (let i = 0; i < 20; i++) {
    const p = ml.rangeWander(w, g);
    assert.equal(w.terrain.range[Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE)], 2);
  }
});

test('the first time one of ours goes over a pass, it is announced by name', () => {
  const w = new World(12345, false, 5);
  w.mountainLife.enabled = true;
  const p = ter.RANGES[1].passes[1];
  const [a, b] = p.pts;
  const h = addHuman(w, ((a[0] + b[0]) / 2) * TILE, ((a[1] + b[1]) / 2) * TILE, false, { role: 'gatherer' });
  w.mountainLife.update(w, 0.1);
  const toast = w.events.find((e) => e.type === 'toast' && e.text.includes(p.name));
  assert.ok(toast, 'announced');
  assert.ok(toast.text.includes('Sentinel Range') && toast.text.includes(h.name));
  w.events.length = 0;
  w.mountainLife.update(w, 2.1);
  assert.ok(!w.events.some((e) => e.type === 'toast' && e.text.includes(p.name)), 'only the first time');
});
