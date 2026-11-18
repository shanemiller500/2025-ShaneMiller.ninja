const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { T, TILE, MAP_W, MAP_H } = require('./types.ts');
const { NATURAL_FLORA, makePlant, naturalizePlants, plantHabitat, sproutWildPlant } = require('./plants.ts');
const { applyTool, DEFAULT_TOOL } = require('../game/tools.ts');
const { clearPlantsUnderBuilds } = require('./buildClear.ts');
const kinds = ['conifer', 'palm', 'cycad', 'broadleaf', 'fruit', 'fern', 'bush', 'reeds', 'horsetail'];

test('different seeds contain all nine existing plants, varied habitats, and connected open meadows', () => {
  for (const seed of [17354, 9157, 42]) {
    const w = new World(seed, true), counts = {};
    for (const p of w.plants) counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    for (const k of kinds) assert.ok(counts[k] >= 5, `${seed}: ${k}`);
    assert.ok(counts.bush / w.plants.length < .15, 'berries do not dominate');
    let openSquare = false;
    for (let y = 4; y < MAP_H - 4 && !openSquare; y++) for (let x = 4; x < MAP_W - 4; x++) {
      if (!plantHabitat(w, x, y)?.meadow) continue;
      const open = Array.from({ length: 25 }, (_, i) => [x + i % 5 - 2, y + Math.floor(i / 5) - 2])
        .every(([tx, ty]) => w.terrain.tiles[ty * MAP_W + tx] === T.Grass && plantHabitat(w, tx, ty)?.meadow);
      if (open) { openSquare = true; break; }
    }
    assert.ok(openSquare, 'there are actual stretches of grass, not isolated empty tiles');
    assert.ok(w.terrain.tiles.some((t) => t === T.Forest));
    assert.ok(w.terrain.tiles.some((t) => t === T.Swamp));
    assert.ok(w.terrain.tiles.some((t) => t === T.Sand));
  }
});

test('natural recruitment varies by habitat, is bounded, and keeps grass meadows empty', () => {
  const w = new World(17354, false);
  w.flags.add(NATURAL_FLORA);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) sproutWildPlant(w, (x + .5) * TILE, (y + .5) * TILE);
  const count = w.plants.length;
  assert.ok(count > 500 && count < 2500);
  assert.deepEqual(new Set(w.plants.map((p) => p.kind)), new Set(kinds));
  for (let pass = 0; pass < 3; pass++) for (const p of [...w.plants]) assert.equal(sproutWildPlant(w, p.x, p.y), null);
  assert.equal(w.plants.length, count, 'repeated deposits cannot stack plants');
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (plantHabitat(w, x, y)?.meadow) assert.equal(sproutWildPlant(w, (x + .5) * TILE, (y + .5) * TILE), null);
  assert.ok(w.plants.every((p) => plantHabitat(w, Math.floor(p.x / TILE), Math.floor(p.y / TILE)).mix.some(([k]) => k === p.kind)));
});

test('old berry carpets thin and diversify once, while gardens, farms, buildings and terrain edits survive', () => {
  const w = new World(17354, false);
  for (let y = 10; y < 90; y++) for (let x = 10; x < 145; x++) {
    if (![T.Grass, T.Forest, T.Jungle].includes(w.terrain.tiles[y * MAP_W + x])) continue;
    for (let i = 0; i < 3; i++) w.plants.push(makePlant(w, 'bush', (x + .5) * TILE + i, (y + .5) * TILE));
  }
  const garden = makePlant(w, 'fruit', 40 * TILE, 40 * TILE); garden.planted = true; w.plants.push(garden);
  const farm = { id: w.nextId(), x: 44 * TILE, y: 44 * TILE, growth: 0, planted: false, crop: 'grape' };
  w.tribe.farms.push(farm);
  const vine = makePlant(w, 'bush', farm.x + 10, farm.y); w.plants.push(vine);
  const edited = 75 * MAP_W + 24; w.terrain.setTile(24, 75, T.Rock);
  const before = w.plants.length;
  naturalizePlants(w);
  assert.ok(w.plants.length < before / 2, 'crowded wilderness is thinned');
  assert.ok(new Set(w.plants.map((p) => p.kind)).size >= 6, 'old bushes become a local mix');
  assert.ok(w.plants.includes(garden)); assert.equal(garden.kind, 'fruit');
  assert.ok(w.plants.includes(vine)); assert.equal(vine.kind, 'bush');
  assert.equal(w.terrain.tiles[edited], T.Rock);
  clearPlantsUnderBuilds(w);
  const after = JSON.stringify(w.serialize().plants);
  naturalizePlants(w);
  assert.equal(JSON.stringify(w.serialize().plants), after, 'no repeated reshuffling');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(JSON.stringify(restored.serialize().plants), after);
  assert.ok(restored.flags.has(NATURAL_FLORA));
});

test('the plant brush marks deliberate planting and preserves it through save/load', () => {
  const w = new World(17354, false), x = w.camp.x + 250, y = w.camp.y + 80;
  w.terrain.setTile(Math.floor(x / TILE), Math.floor(y / TILE), T.Grass);
  assert.equal(applyTool(w, { ...DEFAULT_TOOL, id: 'plant', plant: 'palm' }, x, y, false), true);
  assert.equal(w.plants[0].planted, true);
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(restored.plants.some((p) => p.kind === 'palm' && p.planted));
  const legacy = JSON.parse(JSON.stringify(w.serialize()));
  legacy.plants = legacy.plants.map((p) => p.slice(0, 8));
  assert.doesNotThrow(() => World.deserialize(legacy), 'old plant tuples still load');
});
