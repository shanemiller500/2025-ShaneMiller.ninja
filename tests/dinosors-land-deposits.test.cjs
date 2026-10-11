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
const { T, TILE } = require(path.join(root, 'sim', 'types.ts'));
const { isWalkTile, isWaterTile } = require(path.join(root, 'sim', 'terrain.ts'));
const { NODES } = require(path.join(root, 'data', 'colony.ts'));
const { LAND_OPTS, DEFAULT_TOOL, applyTool } = require(path.join(root, 'game', 'tools.ts'));

test('every earth deposit in Land can be placed, mined and saved', () => {
  const w = new World(2201, false);
  w.camp.learned.add('tools');
  const kinds = LAND_OPTS.slice(4).map((o) => o.value);
  assert.deepEqual(new Set(kinds), new Set(Object.keys(NODES)));
  for (const kind of kinds) assert.doesNotMatch(NODES[kind].name, /vein|seam|pocket|geode|quarry|outcrop|bank|mound|bed/i, kind + ' is a surface material');
  const placed = [];
  for (const kind of kinds) {
    let spot = null;
    for (let ty = 8; ty < 102 && !spot; ty += 2) for (let tx = 8; tx < 150 && !spot; tx += 2) {
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      const tile = w.terrain.tileAt(x, y);
      if (!isWalkTile(tile) || isWaterTile(tile) || tile === T.Tar || tile === T.Cave || tile === T.Volcano) continue;
      if (w.colony.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 54)) continue;
      if (w.colony.buildings.some((b) => Math.hypot(b.x - x, b.y - y) < 40)) continue;
      spot = { x, y };
    }
    assert.ok(spot, 'room for ' + kind);
    const tool = { ...DEFAULT_TOOL, id: 'land', land: kind };
    assert.equal(applyTool(w, tool, spot.x, spot.y, false), true, kind + ' placed');
    assert.equal(applyTool(w, tool, spot.x, spot.y, false), false, kind + ' cannot overlap');
    const node = w.colony.nodes.at(-1);
    assert.equal(node.kind, kind);
    assert.equal(node.found, true);
    placed.push(node);
  }
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  for (const kind of kinds) assert.ok(loaded.colony.nodes.some((n) => n.kind === kind && n.found && n.amount > 0), kind + ' saved');
  for (const node of placed.filter((n) => NODES[n.kind].gives)) {
    const before = node.amount;
    const result = w.colony.mine(w, node);
    assert.equal(result.r, NODES[node.kind].gives);
    assert.ok(node.amount < before, node.kind + ' was harvested');
  }
});
