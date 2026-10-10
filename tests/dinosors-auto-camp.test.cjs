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
const root = path.join(__dirname, '..', 'app', 'dinosors', 'sim');
const { World } = require(path.join(root, 'world.ts'));
const { addHuman, stockPriorities } = require(path.join(root, 'humans.ts'));

test('Auto plans one useful project after the first day and remembers it across saves', () => {
  const w = new World(7803, false);
  addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  w.camp.learned.add('basket');
  w.tribe.autoImprove(w);
  assert.equal(w.colony.buildings.length, 0, 'nothing planned before day two');
  w.day = 2;
  w.tribe.planT = 0;
  w.update(1 / 30);
  assert.equal(w.colony.buildings.filter((b) => b.kind === 'foodStore').length, 1);
  w.tribe.autoImprove(w);
  assert.equal(w.colony.buildings.length, 1, 'no second plan on the same day');
  const restored = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  restored.colony.buildings[0].built = 1;
  restored.colony.version++;
  restored.tribe.autoImprove(restored);
  assert.equal(restored.colony.buildings.length, 1, 'loading does not repeat the daily plan');
  restored.camp.learned.add('axe');
  restored.day = 3;
  restored.tribe.autoImprove(restored);
  assert.equal(restored.colony.buildings.filter((b) => b.kind === 'storage').length, 1, 'next day adds another useful building');
});

test('Auto restocking prioritizes supplies that are low relative to the camp target', () => {
  const w = new World(7804, false);
  const h = addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  for (const r of ['stick', 'stone', 'grass', 'leaves', 'berries', 'fish']) w.camp.stock[r] = 0;
  assert.ok(stockPriorities(w).includes('stick'));
  w.camp.stock.stick = 100;
  assert.ok(!stockPriorities(w).includes('stick'), 'well-stocked supplies are not requested');
  h.task = 'fish'; h.carry = 'fish'; h.carryN = 100;
  assert.ok(!stockPriorities(w).includes('fish'), 'a carried load counts toward the stock target');
});



test('Auto plans a home upgrade when the daily building queue is clear', () => {
  const { stagesOf } = require(path.join(root, 'build.ts'));
  const w = new World(7805, false);
  addHuman(w, w.camp.x, w.camp.y, false, { role: 'auto' });
  w.camp.learned.add('shelter');
  const home = w.camp.addShelter(w, w.camp.x + 140, w.camp.y + 140);
  home.stage = stagesOf(home).length;
  home.hp = 1;
  w.day = 2;
  w.tribe.autoImprove(w);
  assert.equal(home.up, true);
  w.elapsed += 1;
  assert.equal(w.buildSites().find((site) => site.id === home.id)?.kind, 'upgrade');
});

