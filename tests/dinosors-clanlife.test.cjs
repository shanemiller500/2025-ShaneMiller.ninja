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
const { addHuman } = require(path.join(root, 'sim', 'humans.ts'));
const { addDino } = require(path.join(root, 'sim', 'dinos.ts'));
const { makeCarcass } = require(path.join(root, 'sim', 'carcass.ts'));
const life = require(path.join(root, 'sim', 'clanLife.ts'));
const rite = require(path.join(root, 'sim', 'clanRite.ts'));
const { makePlant } = require(path.join(root, 'sim', 'plants.ts'));

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
  w.rivals['relT'] = Infinity;
  w.rivals['arriveT'] = Infinity;
  while (w.humans.filter((h) => !h.child).length < 3) addHuman(w, w.camp.x + w.humans.length * 20, w.camp.y + 40);
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
/** a clan whose raids + spies are switched off, so they just live */
function homeClan(w, n = 5) {
  const clan = w.rivals.spawnClan(w, n, { x: w.camp.x + 1500, y: w.camp.y + 150 });
  assert.ok(clan);
  clan.raidT = Infinity;
  clan.spyT = Infinity;
  clan.ambushT = Infinity;
  clan.trapT = Infinity;
  clan.riteT = Infinity;
  for (const b of w.rivals.members(clan.id)) b.age = 180;
  return clan;
}
/** a dead dino by the camp, full of bones */
function carcassAt(w, x, y) {
  const d = addDino(w, 'trike', x, y);
  const it = makeCarcass(w, d);
  w.removeDino(d);
  it.carcass.bone = 30;
  return it;
}

test('a clan fetches bones off carcasses + wood off trees, then builds and levels up its buildings', () => {
  const w = world(8801);
  const clan = homeClan(w);
  clan.food = 60;
  carcassAt(w, clan.x - 200, clan.y + 60);
  carcassAt(w, clan.x + 220, clan.y + 40);
  for (let i = 0; i < 6; i++) w.plants.push(makePlant(w, 'conifer', clan.x - 300 + i * 110, clan.y - 260, 1));
  let gathered = false;
  let built = false;
  run(w, 900, () => {
    if ((clan.bones ?? 0) > 0 && (clan.wood ?? 0) > 0) gathered = true;
    if (life.lvOf(clan, 'longhouse') >= 1 && life.lvOf(clan, 'smokehouse') >= 1) built = true;
    clan.food = Math.max(clan.food, 40);
    return built;
  });
  assert.ok(gathered || built, 'bones + wood came home');
  assert.ok(built, `built ${JSON.stringify(clan.builds)} (bones ${clan.bones}, wood ${clan.wood})`);
  assert.equal(life.nextProject(clan), 'trainingRing', 'the training ring is next');
});

test('warriors spar at the training ring and get tougher', () => {
  const w = world(8802);
  const clan = homeClan(w);
  clan.food = 60;
  clan.builds = { longhouse: 3, smokehouse: 2, trainingRing: 2, dragonAltar: 1, boneRack: 2 };
  run(w, 240);
  const best = Math.max(...w.rivals.members(clan.id).map((b) => b.skill ?? 0));
  assert.ok(best > 0.2, `skill ${best.toFixed(2)}`);
  // a trained brute shrugs off more
  const [a, b] = w.rivals.members(clan.id);
  a.skill = 1;
  b.skill = 0;
  a.hp = b.hp = 1;
  w.rivals.hit(w, a, 0.2, a.x, a.y, true);
  w.rivals.hit(w, b, 0.2, b.x, b.y, true);
  assert.ok(a.hp > b.hp);
});

test('hungry hunters go out as a pack and take a bigger dinosaur', () => {
  const w = world(8803);
  const clan = homeClan(w, 4);
  clan.food = 1;
  const big = addDino(w, 'trike', clan.x + 260, clan.y + 40, { age: 9999 });
  let pack = 0;
  run(w, 60, () => {
    pack = Math.max(pack, w.rivals.members(clan.id).filter((b) => b.state === 'hunt' && b.targetId === big.id).length);
    return pack >= 3;
  });
  assert.ok(pack >= 2, `${pack} hunted together`);
});

test('a hidden pit trap catches one of ours; the clan fetches them home unless we pull them out', () => {
  const w = world(8804);
  const clan = homeClan(w, 4);
  const h = w.humans.find((x) => !x.child);
  h.x = w.camp.x + 700;
  h.y = w.camp.y;
  w.rivals.traps.push({ id: w.nextId(), clan: clan.id, x: h.x + 4, y: h.y, t: 0, caught: 0 });
  run(w, 0.2);
  assert.equal(h.captive, clan.id, 'fell in');
  assert.ok(w.rivals.traps[0].caught === h.id);
  // the clan sends someone, who carries them home
  const home = run(w, 120, () => !w.rivals.traps.length && !w.rivals.brutes.some((b) => b.captive === h.id) && Math.hypot(h.x - clan.x, h.y - clan.y) < 120);
  assert.ok(home, 'carried off to the camp');
  assert.equal(h.captive, clan.id);

  // a second one: a friend pulls them out first
  const w2 = world(8805);
  const c2 = homeClan(w2, 3);
  const [p, friend] = w2.humans.filter((x) => !x.child);
  p.x = w2.camp.x + 700;
  p.y = w2.camp.y;
  w2.rivals.traps.push({ id: w2.nextId(), clan: c2.id, x: p.x, y: p.y, t: 0, caught: 0 });
  run(w2, 0.2);
  assert.equal(p.captive, c2.id);
  friend.x = p.x + 20;
  friend.y = p.y + 30;
  friend.think = 99;
  run(w2, 1.5);
  assert.equal(p.captive, 0, 'rescued');
  run(w2, 0.2);
  assert.equal(w2.rivals.traps.length, 0);
});

test('the dragon rite: they dance, the dragon eats the offering, spreads its wings + breathes fire at the sky, and leaves that clan alone', () => {
  const w = world(8806);
  const clan = homeClan(w, 5);
  clan.builds = { longhouse: 1, smokehouse: 1, trainingRing: 1, dragonAltar: 1 };
  const victim = w.humans.find((x) => !x.child);
  victim.captive = clan.id;
  victim.state = 'captive';
  victim.x = clan.x;
  victim.y = clan.y + 24;
  const a = life.altarOf(clan);
  const dr = w.dragons.summon(w, a);
  dr.x = a.x - 900;
  dr.y = a.y;
  clan.riteT = 0;
  let danced = 0;
  let spread = false;
  let skyFire = false;
  let cheered = false;
  const done = run(w, 120, () => {
    danced = Math.max(danced, w.rivals.members(clan.id).filter((b) => b.state === 'dance').length);
    if ((dr.spread ?? 0) > 0.9) spread = true;
    if (dr.skyFire) skyFire = true;
    if (w.rivals.members(clan.id).some((b) => b.state === 'cheer')) cheered = true;
    return !w.rivals.rite && clan.favor === dr.id;
  });
  assert.ok(done, `rite finished (phase ${w.rivals.rite?.phase})`);
  assert.ok(danced >= 3, `${danced} danced`);
  assert.ok(!w.humans.includes(victim), 'the offering was eaten');
  assert.ok(spread && skyFire, 'wings spread, fire into the sky');
  assert.ok(cheered, 'they jumped for joy');
  assert.ok(clan.altarBlood > 0);
  // the happy dragon leaves them be
  let atClan = 0;
  for (let i = 0; i < 40; i++) {
    dr.atClan = undefined;
    dr.waveOn = false;
    w.dragons['decide'](w, dr, false);
    if (dr.atClan === clan.id) atClan++;
  }
  assert.equal(atClan, 0);
  assert.ok(rite.favored(w, clan.id, dr));
  // save + load keeps the favour + the buildings
  const back = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const bc = back.rivals.clan(clan.id);
  assert.equal(bc.favor, dr.id);
  assert.equal(life.lvOf(bc, 'dragonAltar'), 1);
});

test('reach the offering in time and the rite is broken (no friendly dragon)', () => {
  const w = world(8807);
  const clan = homeClan(w, 3);
  clan.builds = { dragonAltar: 1 };
  const [victim] = w.humans.filter((x) => !x.child);
  victim.captive = clan.id;
  victim.state = 'captive';
  victim.x = clan.x;
  victim.y = clan.y + 24;
  const a = life.altarOf(clan);
  const dr = w.dragons.summon(w, a);
  dr.x = a.x - 3000;
  dr.y = a.y;
  clan.riteT = 0;
  run(w, 2);
  assert.ok(w.rivals.rite, 'rite started');
  // the clan's away (or beaten): a rescuer gets to the altar
  for (const b of w.rivals.members(clan.id)) w.rivals.kill(w, b);
  w.rivals.free(w, victim, 'saved');
  run(w, 0.5);
  assert.equal(w.rivals.rite, null);
  assert.ok(w.humans.includes(victim));
  assert.notEqual(dr.state, 'offering');
});
