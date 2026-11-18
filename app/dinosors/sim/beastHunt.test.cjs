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
const { addDino } = require('./dinos.ts');
const { T, TILE } = require('./types.ts');
const snow = require('./snowBeasts.ts');
const beasts = require('./beasts.ts');
const zoo = require('./zoo.ts');
const ch = require('./chariots.ts');
const { hitDino } = require('./tribe.ts');
const { inferCommand } = require('./tasks.ts');

const DT = 1 / 30;
function world(seed = 4411, people = 12) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.randomEvents.enabled = false;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.weather.storm = 0;
  w.timePaused = true;
  w.time = 12;
  w.tribe.planT = Infinity;
  w.dragons.timer = Infinity;
  w.dragons.seeded = true;
  w.rivals.started = true;
  w.rivals['arriveT'] = Infinity;
  w.rivals['relT'] = Infinity;
  w.snowLife.enabled = false;
  for (const t of ['tools', 'spear', 'bow', 'smelting']) w.camp.learned.add(t);
  const cx = Math.floor(w.camp.x / TILE), cy = Math.floor(w.camp.y / TILE);
  for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 10; x <= cx + 60; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  while (w.humans.filter((h) => !h.child).length < people) addHuman(w, w.camp.x + (w.humans.length % 6) * 18, w.camp.y + 30 + Math.floor(w.humans.length / 6) * 18);
  for (const h of w.humans) h.role = 'guard';
  Object.assign(w.camp.stock, { meat: 40, cooked: 40, water: 40 });
  return w;
}
function run(w, seconds, each) {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    w.update(DT);
    const stop = each && each(w) === true;
    w.events.length = 0;
    if (stop) return true;
  }
  return false;
}
function enclosure(w, dx = 260, dy = 160) {
  const tx = Math.floor((w.camp.x + dx) / TILE), ty = Math.floor((w.camp.y + dy) / TILE);
  const b = { id: w.nextId(), kind: 'zoo', tx, ty, x: (tx + 4) * TILE, y: (ty + 5) * TILE - TILE / 2, built: 1, hp: 700, have: {} };
  w.colony.buildings.push(b);
  w.colony.version++;
  return b;
}
const adults = (w) => w.humans.filter((h) => !h.child);

test('every Yeti cave is high on the snow, well apart, and newcomers move into one', () => {
  const w = new World(4411, false);
  const dens = snow.yetiDens(w);
  assert.ok(dens.length >= 3, `${dens.length} caves`);
  for (const d of dens) assert.ok(snow.snowGround(w, d.x, d.y), 'on the snow');
  for (const a of dens) for (const b of dens) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 340);
  w.dinos.length = 0;
  const [y] = w.snowLife.arrive(w, 'yeti', 1);
  assert.ok(y, 'a Yeti arrived');
  assert.ok(snow.yetiDenOf(w, y), 'its home is one of the caves');
  assert.equal(beasts.beastDens(w).filter((d) => d.beast === y).length, 1);
});

test('at night the Yeti sleeps in its cave and howls: everyone in earshot is frightened', () => {
  const w = new World(4411, false);
  w.dinos.length = 0;
  w.weather.auto = false;
  const den = snow.yetiDens(w)[0];
  const y = addDino(w, 'yeti', den.x, den.y, { growth: 1, homeX: den.x, homeY: den.y });
  const h = addHuman(w, den.x, den.y + 1200, false, { role: 'gatherer' });
  h.fear = 0;
  w.time = 1;
  w.timePaused = true;
  let howled = false;
  run(w, 60, () => {
    if (w.events.some((e) => e.type === 'toast' && /howl/.test(e.text))) howled = true;
    return howled;
  });
  assert.ok(howled, 'the first howl is announced');
  assert.equal(y.state, 'sleep');
  assert.ok(snow.inCave(w, y));
  assert.ok(beasts.dreadOf(w) > 0, 'dread grows');
});

test('nobody wanders up to a den, but people under orders still go', () => {
  const w = new World(4411, false);
  w.dinos.length = 0;
  const den = snow.yetiDens(w)[0];
  addDino(w, 'yeti', den.x, den.y, { growth: 1, homeX: den.x, homeY: den.y, state: 'stalk' });
  const idle = addHuman(w, den.x + 60, den.y + 200, false, { role: 'gatherer' });
  const sent = addHuman(w, den.x - 60, den.y + 200, false, { role: 'gatherer' });
  sent.order = { kind: 'guard', x: sent.x, y: sent.y };
  assert.equal(beasts.dreadThink(w, idle), true);
  assert.equal(idle.state, 'walk');
  assert.ok(Math.hypot(idle.tx - den.x, idle.ty - den.y) > Math.hypot(idle.x - den.x, idle.y - den.y), 'heading away from the cave');
  assert.equal(beasts.dreadThink(w, sent), false);
});

test('tapping a great beast with a party offers a hunt, and a capture once there are nets + a free enclosure', () => {
  const w = world();
  const d = addDino(w, 'dinoScorpion', w.camp.x + 900, w.camp.y, { growth: 1 });
  const people = adults(w);
  const picked = { human: null, dino: d, dragon: null };
  let cmd = inferCommand(w, people, d.x, d.y, picked);
  assert.equal(cmd.beast, 'kill');
  assert.match(cmd.alts[0].label, /nets/);
  w.colony.kits.add(zoo.NETS_KIT);
  assert.match(zoo.captureBlock(w), /zoo enclosure/);
  enclosure(w);
  assert.equal(zoo.captureBlock(w), null);
  cmd = inferCommand(w, people, d.x, d.y, picked);
  assert.equal(cmd.beast, 'capture');
  assert.equal(cmd.alts[0].beast, 'kill');
});

test('a hunting party kills the beast: victory, and the dread lifts', () => {
  const w = world();
  const d = addDino(w, 'dinoScorpion', w.camp.x + 900, w.camp.y, { growth: 1, health: 0.35 });
  d.homeX = d.x; d.homeY = d.y;
  run(w, 0.1);
  beasts.addDread(w, 0.8);
  assert.equal(ch.startHunt(w, 'ring', { people: adults(w), beast: d.id }), null);
  assert.equal(w.colony.hunt.beast, d.id);
  let won = false;
  run(w, 400, () => {
    if (w.events.some((e) => e.type === 'toast' && /VICTORY/.test(e.text))) won = true;
    return won;
  });
  assert.ok(won, 'the hunt is won');
  assert.ok(!w.dinos.includes(d), 'the beast is dead');
  assert.equal(beasts.dreadOf(w), 0);
  assert.ok(run(w, 400, () => !w.colony.hunt), 'everyone comes home and the expedition ends');
});

test('a capture party nets it, hauls it home and cages it; it cannot be hurt or hunted after', () => {
  const w = world();
  w.colony.kits.add(zoo.NETS_KIT);
  const b = enclosure(w);
  const d = addDino(w, 'dinoScorpion', w.camp.x + 900, w.camp.y, { growth: 1, health: 0.45 });
  d.homeX = d.x; d.homeY = d.y;
  run(w, 0.1);
  assert.equal(ch.startHunt(w, 'ring', { people: adults(w), beast: d.id, capture: true }), null);
  assert.ok(run(w, 400, () => d.netted === true), 'netted, not killed');
  assert.ok(d.health >= zoo.CAPTURE_AT - 1e-6);
  const hp = d.health;
  hitDino(w, d, 500, d.x - 10, d.y);
  assert.equal(d.health, hp, 'bound in the nets: nothing more hurts it');
  assert.ok(run(w, 700, () => d.caged === b.id), 'hauled home into the enclosure');
  assert.equal(d.owner, true);
  assert.equal(w.colony.hunt, null);
  const p = zoo.pen(b);
  run(w, 30);
  assert.ok(d.x >= p.x0 && d.x <= p.x1 && d.y >= p.y0 && d.y <= p.y1, 'it stays inside the bars');
  assert.equal(beasts.wildBeast(d), false);
  assert.match(ch.startHunt(w, 'ring', { people: adults(w), beast: d.id }) ?? '', /gone/);
  assert.match(zoo.captureBlock(w), /full/);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  const again = loaded.dinos.find((x) => x.species === 'dinoScorpion');
  assert.equal(again.caged, b.id, 'still caged after a save');
});

test('a caged beast eats from the stores, and breaks out if it starves', () => {
  const w = world(4411, 4);
  const b = enclosure(w);
  const d = addDino(w, 'yeti', b.x, b.y - 40, { growth: 1 });
  zoo.cageBeast(w, d, b);
  w.events.length = 0;
  Object.assign(w.camp.stock, { meat: 10, fish: 0, cooked: 0 });
  for (const h of w.humans) h.hunger = 0;
  w.elapsed += zoo.FEED_EVERY + 2;
  zoo.zooTick(w);
  assert.equal(w.camp.stock.meat, 10 - zoo.MEAL);
  Object.assign(w.camp.stock, { meat: 0, fish: 0, cooked: 0 });
  for (let i = 0; i < 3; i++) {
    w.elapsed += zoo.FEED_EVERY + 2;
    zoo.zooTick(w);
  }
  assert.ok(!w.dinos.includes(d), 'gone');
  assert.ok(w.events.some((e) => e.type === 'toast' && /broke the bars/.test(e.text)));
  assert.ok(b.hp < 700, 'the enclosure is damaged');
});
