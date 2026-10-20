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
const towns = require(path.join(root, 'sim', 'clanTowns.ts'));

const DT = 1 / 30;
function world(seed) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.rivals.started = true;
  for (const t of ['tools', 'spear', 'bow', 'crossbow', 'tower', 'scorpion']) w.camp.learned.add(t);
  return w;
}
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    w.events.length = 0;
    if (each && each(w) === true) return true;
  }
  return false;
}

test('clans make friends, then unite: colours + names combine (2, then 3) and the camp grows into a town', () => {
  const w = world(7701);
  const r = w.rivals;
  const a = r.spawnClan(w, 4, { x: w.camp.x + 1500, y: w.camp.y });
  const b = r.spawnClan(w, 2, { x: w.camp.x + 1500, y: w.camp.y + 450 });
  const c = r.spawnClan(w, 2, { x: w.camp.x - 1500, y: w.camp.y });
  assert.ok(a && b && c);
  r.setRelation(a.id, b.id, -1);
  // politics only ever makes up feuds now
  for (let i = 0; i < 30; i++) r['politics'](w);
  for (const x of r.clans) for (const y of r.clans) if (x !== y) assert.notEqual(r.relation(x.id, y.id), -1, 'no feuds');

  const w2 = world(7702);
  const A = w2.rivals.spawnClan(w2, 4, { x: w2.camp.x + 1500, y: w2.camp.y });
  const B = w2.rivals.spawnClan(w2, 2, { x: w2.camp.x + 1500, y: w2.camp.y + 450 });
  const C = w2.rivals.spawnClan(w2, 2, { x: w2.camp.x - 1500, y: w2.camp.y });
  const [na, nb, nc] = [A.name, B.name, C.name];
  assert.equal(towns.isTown(A), false);
  w2.rivals.merge(w2, B, A);
  assert.deepEqual(towns.colorsOf(A), [A.color, B.color]);
  assert.equal(A.name, `${na}-${nb}`);
  assert.ok(towns.isTown(A), 'a union is a town');
  assert.equal(w2.rivals.members(A.id).length, 6);
  assert.ok(!w2.rivals.clans.includes(B));
  const tier = A.campTier;
  w2.rivals.merge(w2, C, A);
  assert.equal(towns.colorsOf(A).length, 3, 'a third colour joins the flag');
  assert.equal(A.name, `${na}-${nb}-${nc}`);
  assert.ok(A.campTier > tier);
  // the flag survives a reload
  const back = World.deserialize(JSON.parse(JSON.stringify(w2.serialize())));
  assert.deepEqual(towns.colorsOf(back.rivals.clan(A.id)), towns.colorsOf(A));
});

test('a clan town brings a catapult: it stops out of Scorpion range and its boulders smash the Scorpion', () => {
  const w = world(7703);
  const sc = w.colony.addScorpion(w, w.camp.x + 120, w.camp.y + 120);
  assert.equal(typeof sc, 'object');
  sc.built = 1;
  const clan = w.rivals.spawnClan(w, 4, { x: w.camp.x + 1500, y: w.camp.y + 120 });
  clan.colors = [clan.color, '#3a7bd5'];
  clan.campTier = 4;
  assert.ok(towns.hasEngines(clan));
  assert.ok(w.rivals.startRaid(w, clan));
  const cat = w.rivals.brutes.find((b) => b.weapon === 'catapult');
  assert.ok(cat, 'the catapult rolls out');
  w.tribe.raid.phase = 'attack';
  const hp = sc.hp;
  const hit = run(w, 240, () => sc.hp < hp);
  assert.ok(hit, 'a boulder hit the Scorpion');
  const d = Math.hypot(cat.x - sc.x, cat.y - sc.y);
  assert.ok(d > 700 && d <= towns.CATAPULT_RANGE + 10, `catapult sits at ${d.toFixed(0)}: past the Scorpion's 700`);
});

test('a dragon strafing a clan town burns Neanderthals, and one snatched is dropped into the volcano', () => {
  const w = world(7704);
  const clan = w.rivals.spawnClan(w, 4, { x: w.camp.x + 1500, y: w.camp.y + 120 });
  // the volcano is near the town
  w.volcano.x = clan.x + 900;
  w.volcano.y = clan.y;
  const dr = w.dragons.summon(w);
  dr.x = clan.x - 300;
  dr.y = clan.y;
  dr.z = 120;
  dr.atClan = clan.id;
  dr.tx = clan.x + 500;
  dr.ty = clan.y;
  dr.state = 'strafe';
  dr.t = 0;
  // the fire hurts them
  const b = w.rivals.members(clan.id)[0];
  const hp0 = w.rivals.members(clan.id).reduce((s, x) => s + x.hp, 0);
  for (let i = 0; i < 30; i++) w.dragons['breathe'](w, Object.assign(dr, { x: b.x - 40, y: b.y, dir: 1, z: 60 }), DT);
  const hp1 = w.rivals.members(clan.id).reduce((s, x) => s + x.hp, 0);
  assert.ok(hp1 < hp0, 'dragon fire hurts Neanderthals');

  // snatch one and carry it off
  const victim = w.rivals.members(clan.id).find((x) => x.hp > 0);
  dr.foe = victim.id;
  dr.preyBrute = true;
  dr.state = 'snatch';
  dr.t = 0;
  dr.x = victim.x - 100;
  dr.y = victim.y;
  dr.z = 40;
  let grabbed = false;
  const gone = run(w, 60, () => {
    if (victim.snatched === dr.id) grabbed = true;
    return grabbed && !w.rivals.byId(victim.id);
  });
  assert.ok(grabbed, 'the dragon grabbed the Neanderthal');
  assert.ok(gone, 'and dropped it into the volcano');
});

test('a wild dragon sometimes picks a clan town instead of our camp', () => {
  const w = world(7705);
  const clan = w.rivals.spawnClan(w, 3, { x: w.camp.x + 1500, y: w.camp.y + 120 });
  const dr = w.dragons.summon(w);
  let atClan = 0;
  for (let i = 0; i < 40; i++) {
    dr.waveOn = false;
    dr.atClan = undefined;
    w.dragons['decide'](w, dr, false);
    if (dr.atClan === clan.id) atClan++;
  }
  assert.ok(atClan > 3 && atClan < 30, `${atClan}/40 went for the clan`);
});
