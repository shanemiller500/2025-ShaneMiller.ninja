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
const nests = require(path.join(root, 'sim', 'dragonNests.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.randomEvents.enabled = false;
  w.dragons.timer = Infinity;
  return w;
}
const egg = (w, breed = 'fire') => {
  const e = { id: w.dragons.nextId(), breed, x: w.camp.x, y: w.camp.y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(e);
  return e;
};

test('every hatchling has its own look (shade, markings, eyes) and its hatching plays as a scene', () => {
  const w = world(9301);
  const twin = world(9301);
  w.events.length = 0;
  const looks = [];
  for (let i = 0; i < 8; i++) {
    const dr = nests.hatch(w, egg(w));
    assert.ok(Number.isFinite(dr.tint) && Math.abs(dr.tint) <= 35, 'a shade of its breed');
    assert.ok([0, 1, 2, 3].includes(dr.marks));
    assert.match(dr.eye, /^#[0-9a-f]{6}$/);
    looks.push(`${dr.tint}/${dr.marks}/${dr.eye}`);
    assert.ok(w.events.some((e) => e.type === 'hatched' && e.dragon === dr.id), 'the scene is queued');
  }
  assert.ok(new Set(looks).size >= 6, `no two alike (${new Set(looks).size}/8)`);
  // made with the dragons' own dice: the world's don't move
  assert.equal(w.rng(), twin.rng());
  // kept through a save
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  for (const d of w.dragons.owned) {
    const b = back.dragons.owned.find((x) => x.id === d.id);
    assert.equal(b.tint, d.tint);
    assert.equal(b.marks, d.marks);
    assert.equal(b.eye, d.eye);
  }
});
