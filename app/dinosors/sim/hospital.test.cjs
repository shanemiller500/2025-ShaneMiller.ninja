const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { World } = require('./world.ts');
const { addHuman, updateHuman } = require('./humans.ts');
const { HEALER_TIERS, hospitalTick, patientsOf, upgradeHealer, wardView } = require('./hospital.ts');

function fixture(hurt = 1) {
  const w = new World(9211, false);
  w.dinos.length = 0;
  w.time = 12; w.weather.auto = false;
  const x = w.camp.caveX, y = w.camp.caveY;
  const hut = { id: w.nextId(), kind: 'healer', tx: Math.floor(x / 32) + 4, ty: Math.floor(y / 32), x: x + 160, y, built: 1, hp: 280, have: {} };
  w.colony.buildings.push(hut);
  const people = [];
  for (let i = 0; i < hurt; i++) people.push(addHuman(w, x + i * 6, y, false, { role: 'gatherer', hp: 0.45, think: 0 }));
  return { w, hut, people };
}
function run(w, people, seconds, until) {
  for (let t = 0; t < seconds; t += 0.1) {
    w.elapsed += 0.1;
    for (const h of people) updateHuman(w, h, 0.1);
    hospitalTick(w);
    if (until && until()) return t;
  }
  return -1;
}

test('someone hurt takes a bed, stays a short while and walks out mended', () => {
  const { w, hut, people: [h] } = fixture();
  run(w, [h], 0.2);
  assert.equal(h.bed, hut.id, 'booked into the hut');
  const took = run(w, [h], 90, () => !h.selfHealing);
  assert.ok(took > 5 && took < 70, `a short stay, not instant (${took}s)`);
  assert.ok(h.hp >= 0.9);
  assert.equal(h.bed, undefined, 'the bed is free again');
});

test('a hut has two beds: the third waits at home and the camp is told', () => {
  const { w, hut, people } = fixture(3);
  run(w, people, 3);
  assert.equal(patientsOf(w, hut).length, 2);
  const out = people.find((h) => !h.bed);
  assert.ok(out && out.selfHealing, 'the third is still hurt, without a bed');
  assert.ok(w.events.some((e) => e.type === 'toast' && /Every bed is taken/.test(e.text)));
  const door = w.colony.door(hut);
  assert.ok(Math.hypot(out.tx - door.x, out.ty - door.y) > 20 || out.state === 'rest', 'they do not queue at the door');
});

test('a bed heals faster than resting at home', () => {
  const { w, people } = fixture(3);
  run(w, people, 30);
  const out = people.find((h) => !h.bed && h.selfHealing);
  const inBed = people.filter((h) => h !== out);
  assert.ok(out, 'someone is still waiting');
  assert.ok(inBed.every((h) => h.hp > out.hp));
});

test('upgrading costs refined metal and adds beds', () => {
  const { w, hut, people } = fixture(3);
  assert.match(upgradeHealer(w, hut), /Not enough/);
  Object.assign(w.camp.stock, { wood: 20, stone: 20, clay: 10, copperBar: 1 });
  assert.equal(upgradeHealer(w, hut), null);
  assert.equal(hut.level, 2);
  assert.equal(w.camp.stock.copperBar, 0);
  run(w, people, 3);
  assert.equal(patientsOf(w, hut).length, 3, 'the infirmary takes all three');
  assert.equal(wardView(w, hut).beds, HEALER_TIERS[1].beds);
  Object.assign(w.camp.stock, { wood: 20, stone: 20, silverBar: 1, salt: 2 });
  assert.equal(upgradeHealer(w, hut), null);
  assert.equal(hut.level, 3);
  assert.match(upgradeHealer(w, hut), /already/);
});

test('the tier survives a save', () => {
  const { w, hut } = fixture(0);
  hut.level = 3;
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(loaded.colony.buildings.find((b) => b.kind === 'healer').level, 3);
});
