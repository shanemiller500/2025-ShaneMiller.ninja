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
const { buildThink } = require('./tasks.ts');

test('Auto plans camp walls before any raid and two spaced watchtowers', () => {
  const w = new World(9301, false);
  w.camp.learned.add('palisade');
  w.camp.learned.add('tower');
  assert.equal(w.tribe.raid, null);
  w.tribe.autoPlan(w);
  assert.ok(w.tribe.walls.length > 0, 'the camp perimeter is planned immediately');
  w.tribe.autoPlan(w);
  assert.equal(w.tribe.towers.length, 2);
  assert.ok(Math.hypot(w.tribe.towers[0].x - w.tribe.towers[1].x, w.tribe.towers[0].y - w.tribe.towers[1].y) >= 150);
});

test('Auto builders take defensive sites before a closer hut', () => {
  const w = new World(9302, false);
  w.camp.learned.add('palisade');
  w.camp.learned.add('shelter');
  const c = w.camp;
  c.addShelter(w, c.x + 70, c.y + 80);
  w.tribe.planRing(w, 'palisade');
  w.elapsed++;
  const h = addHuman(w, c.x + 65, c.y + 75, false, { role: 'auto', autoRole: 'builder' });
  Object.assign(c.stock, { stick: 50, grass: 50, leaves: 50, wood: 50 });
  assert.equal(buildThink(w, h, () => true), true);
  assert.match(h.site, /^(wall|tower):/, 'defensive blueprint gets the first crew');
});

test('Auto assigns a larger building crew while the perimeter is unfinished', () => {
  const w = new World(9303, false);
  w.camp.learned.add('palisade');
  w.tribe.planRing(w, 'palisade');
  for (let i = 0; i < 10; i++) addHuman(w, w.camp.x + i * 8, w.camp.y + 30);
  w.tribe.assignJobs(w);
  const builders = w.humans.filter((h) => h.autoRole === 'builder').length;
  assert.ok(builders >= 4, `defense construction gets a larger crew (${builders})`);
});
