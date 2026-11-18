const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { T, TILE, MAP_W } = require('./types.ts');
const { applyTool, DEFAULT_TOOL } = require('../game/tools.ts');
const { moveSpotOk } = require('./moving.ts');

function fixture() {
  const w = new World(17352, false);
  w.humans.length = 0; w.dinos.length = 0; w.shelters.length = 0;
  w.colony.buildings.length = 0; w.campfires.length = 0;
  w.tribe.walls.length = 0; w.tribe.towers.length = 0; w.tribe.farms.length = 0;
  for (const tech of ['shelter', 'palisade', 'tower', 'farming', 'fire', 'axe', 'scorpion']) w.camp.learned.add(tech);
  for (let y = 24; y < 60; y++) for (let x = 40; x < 100; x++) w.terrain.setTile(x, y, T.Grass);
  return w;
}
function paving(w, x, y, kind = 'storage') {
  const fp = w.colony.footprint(kind, x, y), paths = [];
  for (let dy = 0; dy <= fp.h; dy++) for (let dx = 0; dx < fp.w; dx++) {
    const p = w.colony.addBuilding(w, 'path', (fp.tx + dx + .5) * TILE, (fp.ty + dy + .5) * TILE);
    assert.ok(p); p.built = 1; paths.push(p);
  }
  return paths;
}

test('a building can cover paths across its footprint and doorway; paths survive save/load', () => {
  const w = fixture(), x = w.camp.x + 400, y = w.camp.y + 160;
  const paths = paving(w, x, y);
  assert.equal(w.colony.canPlace(w, 'storage', x, y), null);
  const b = w.colony.addBuilding(w, 'storage', x, y);
  assert.ok(b); assert.equal(b.built, 0, 'normal construction remains required');
  assert.equal(w.colony.canPlace(w, 'workshop', x, y), 'Something is already there.');
  assert.ok(paths.every((p) => w.colony.buildings.includes(p)), 'paving is retained beneath the building');
  assert.equal(w.colony.buildingAt(b.x, b.y - 8)?.id, b.id, 'inspection selects the building above the path');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(restored.colony.buildings.filter((p) => p.kind === 'path').length, paths.length);
  assert.ok(restored.colony.buildings.some((p) => p.kind === 'storage'));
  assert.equal(applyTool(w, { ...DEFAULT_TOOL, id: 'erase' }, b.x, b.y - 8, false), true);
  assert.ok(!w.colony.buildings.includes(b));
  assert.ok(paths.every((p) => w.colony.buildings.includes(p)), 'erasing the structure preserves its paving');
});

test('items, homes, walls and farms can be planned over paths', () => {
  for (const kind of ['boneTorch', 'hut', 'wall', 'farm', 'tower', 'scorpion']) {
    const w = fixture(), x = w.camp.x + 400, y = w.camp.y + 160;
    paving(w, x, y);
    assert.equal(applyTool(w, { ...DEFAULT_TOOL, id: 'build', build: kind }, x, y, false), true, kind);
  }
});

test('moving a building onto paving is allowed; water and real structures remain blocked', () => {
  const w = fixture(), x = w.camp.x + 400, y = w.camp.y + 160;
  paving(w, x, y);
  const b = w.colony.addBuilding(w, 'storage', x - 200, y); assert.ok(b); b.built = 1;
  assert.equal(moveSpotOk(w, { kind: 'building', id: b.id }, x, y), null);
  const fp = w.colony.footprint('storage', x, y);
  w.terrain.setTile(fp.tx, fp.ty, T.River);
  assert.equal(w.colony.canPlace(w, 'storage', x, y), "That ground won't hold a building.");
});

test('duplicate paths are rejected, and terrain protection can still include paving', () => {
  const w = fixture(), x = w.camp.x + 400, y = w.camp.y + 160;
  const p = w.colony.addBuilding(w, 'path', x, y); assert.ok(p);
  const tile = p.ty * MAP_W + p.tx;
  assert.equal(w.colony.addBuilding(w, 'path', x, y), null);
  assert.equal(w.colony.occupied(w).has(tile), false);
  assert.equal(w.colony.occupied(w, false).has(tile), true);
});
