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
const brood = require(path.join(root, 'sim', 'dragonBrood.ts'));

function world(seed) {
  const w = new World(seed, false);
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.timePaused = true;
  w.time = 12;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  w.dragons.timer = Infinity;
  nests.seedNests(w);
  w.elapsed = 1000;
  for (const n of w.dragons.nests) n.emptyT = 0;
  nests.nestsUpdate(w, 0.1);
  return w;
}
function run(w, seconds, each, dt = 1 / 30) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    w.update(dt);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}

test('a parent broods: fetches wood for its nest, breathes fire into it, and the eggs grow while it is hot', () => {
  const w = world(9601);
  const n = w.dragons.nests[0];
  const parent = nests.parentOf(w, n);
  assert.ok(parent, 'a parent at home');
  assert.ok(nests.nestEggs(w, n).length > 0);
  for (const nn of w.dragons.nests) nn.layT = Infinity;
  const start = Math.max(...nests.nestEggs(w, n).map((e) => e.progress));
  let wood = 0, fired = false, fetched = false;
  run(w, 240, () => {
    wood = Math.max(wood, n.wood ?? 0);
    if (parent.state === 'fetch') fetched = true;
    if ((n.fireT ?? 0) > 0) fired = true;
    return false;
  });
  assert.ok(fetched, 'flew off for wood');
  assert.ok(wood >= 2, `wood in the nest (${wood})`);
  assert.ok(fired, 'breathed fire into it');
  assert.ok(Math.max(...nests.nestEggs(w, n).map((e) => e.progress)) > start + 0.05, 'the eggs grew');
  // with nobody to tend them, a nest's eggs just wait
  const other = w.dragons.nests[1];
  const op = nests.parentOf(w, other);
  if (op) w.dragons.list.splice(w.dragons.list.indexOf(op), 1);
  other.parent = 0; other.emptyT = Infinity; other.warmth = 1;
  const before = nests.nestEggs(w, other).map((e) => e.progress);
  run(w, 30);
  assert.deepEqual(nests.nestEggs(w, other).map((e) => e.progress), before, 'cold nest, no growth');
});

test('an egg ready to hatch cracks open: a wild baby dragon at the nest (the dragons\' own ids)', () => {
  const w = world(9602);
  const n = w.dragons.nests[0];
  const egg = nests.nestEggs(w, n)[0];
  egg.progress = 0.999;
  n.warmth = 1;
  const had = w.dragons.list.length;
  let cracking = false;
  const hatched = run(w, 20, () => { if (egg.hatchT > 0) cracking = true; return !w.dragons.eggs.includes(egg); });
  assert.ok(cracking && hatched, 'cracked, then hatched');
  const baby = w.dragons.list.find((d) => d.young && d.nest === n.id);
  assert.ok(baby && w.dragons.list.length === had + 1, 'a wild youngster');
  assert.equal(baby.owner, undefined);
  assert.ok(baby.growth < 0.1 && baby.maxHp < 600, 'small');
  assert.ok(baby.id >= 1e8, 'dragon id range');
  // it grows up at home
  run(w, 60, null, 0.1);
  assert.ok(baby.growth > 0.03, 'growing');
  assert.ok(Math.hypot(baby.x - n.x, baby.y - n.y) < 300, 'stays at the nest');
});

test('grown up, it flies off and builds a nest of its own far away (which then lays eggs of its own)', () => {
  const w = world(9603);
  const n = w.dragons.nests[0];
  const egg = nests.nestEggs(w, n)[0];
  const baby = brood.wildHatch(w, egg, n);
  baby.age = brood.FLEDGE_AT + 400;
  baby.growth = 1;
  const count = w.dragons.nests.length;
  run(w, 2);
  assert.equal(w.dragons.nests.length, count + 1, 'a new nest');
  const mine = w.dragons.nests.find((x) => x.parent === baby.id);
  assert.ok(mine && !baby.young && baby.nest === mine.id, 'it lives there now');
  assert.ok(Math.hypot(mine.x - w.camp.x, mine.y - w.camp.y) >= 1300, 'far from the town');
  for (const o of w.dragons.nests) if (o !== mine) assert.ok(Math.hypot(o.x - mine.x, o.y - mine.y) >= 900, 'its own patch');
  assert.equal(mine.breed, baby.breed);
  // flies home to it, and in time it's expecting
  mine.layT = 1;
  run(w, 400, () => nests.nestEggs(w, mine).length > 0, 0.1);
  assert.ok(nests.nestEggs(w, mine).length > 0, 'eggs in the new nest');
});

test('the parent killed: a grown-up youngster takes the nest over', () => {
  const w = world(9604);
  const n = w.dragons.nests[0];
  const parent = nests.parentOf(w, n);
  const baby = brood.wildHatch(w, nests.nestEggs(w, n)[0], n);
  baby.growth = 0.7;
  baby.age = 0.7 * 1260;
  w.dragons.list.splice(w.dragons.list.indexOf(parent), 1);
  run(w, 1);
  assert.equal(n.parent, baby.id);
  assert.ok(!baby.young);
});

test('left alone, the dragons keep going: eggs hatch, young grow up, new nests spread (up to a limit)', () => {
  const w = world(9605);
  const n0 = w.dragons.nests.length;
  const d0 = w.dragons.list.length;
  let hatched = 0;
  const seen = new Set(w.dragons.list.map((d) => d.id));
  run(w, 4200, () => {
    for (const d of w.dragons.list) if (!seen.has(d.id)) { seen.add(d.id); hatched++; }
    return false;
  }, 0.1);
  assert.ok(hatched >= 2, `wild hatchings (${hatched})`);
  assert.ok(w.dragons.nests.length > n0, `new nests (${n0} → ${w.dragons.nests.length})`);
  assert.ok(w.dragons.list.length > d0, `more dragons (${d0} → ${w.dragons.list.length})`);
  assert.ok(w.dragons.nests.length <= brood.MAX_NESTS && w.dragons.list.length <= brood.MAX_WILD + 2, 'within the limit');
});
