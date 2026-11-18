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
const { addDino, walkable, sizeOf } = require('./dinos.ts');
const { T, TILE, MAP_W } = require('./types.ts');
const { hitDino } = require('./tribe.ts');
const { sp } = require('../data/species.ts');
const lava = require('./lavaFolk.ts');
const nests = require('./dragonNests.ts');
const keep = require('./dragonKeep.ts');

function quiet(seed = 4411) {
  const w = new World(seed, false);
  w.dinos.length = 0;
  w.weather.auto = false;
  w.weather.rain = 0;
  w.time = 12;
  w.timePaused = true;
  return w;
}
/** A patch of plain ground on the volcano's slopes, with one Lava Monster in the middle. */
function arena() {
  const w = quiet();
  const cx = Math.floor(w.volcano.x / TILE) + 12, cy = Math.floor(w.volcano.y / TILE) + 4;
  for (let y = cy - 8; y <= cy + 8; y++) for (let x = cx - 8; x <= cx + 8; x++) if (w.terrain.inBounds(x, y)) w.terrain.setTile(x, y, T.Dirt);
  w.nav.sync(w);
  const d = lava.spawnLavaFolk(w, cx * TILE + 16, cy * TILE + 16);
  w.update(1 / 30);
  return { w, d, cx, cy };
}

test('the volcano has its Lava Monsters, on its slopes and lava fields', () => {
  const w = quiet();
  w.wildlife.enabled = true;
  lava.lavaTick(w, 1.1);
  const folk = w.dinos.filter(lava.isLavaFolk);
  assert.ok(folk.length >= lava.LAVA_KEEP - 2, `${folk.length} of them`);
  for (const d of folk) assert.ok(w.volcanoes.some((v) => Math.hypot(d.x - v.x, d.y - v.y) < lava.LAVA_HOME_R), 'near a crater');
  // both volcanoes have their own (the far east's too)
  for (const v of w.volcanoes) assert.ok(folk.filter((d) => Math.hypot(d.homeX - v.x, d.homeY - v.y) < 900).length >= lava.LAVA_KEEP - 2, 'at each volcano');
  assert.ok(folk.every((d) => d.layT > 1e8), 'they never lay eggs: the volcano makes them');
});

test('slow and fearless: slower than a person walks, and a hit makes it turn on whoever did it', () => {
  const def = sp('lavaFolk');
  assert.ok(def.speed < 30 && def.run < 30, 'you can always walk away from one');
  assert.equal(def.fear, 0);
  const { w, d } = arena();
  const h = addHuman(w, d.x - 300, d.y, false, { role: 'guard' });
  w.update(1 / 30);
  hitDino(w, d, 20, h.x, h.y);
  assert.notEqual(d.state, 'flee');
  assert.equal(d.targetId, h.id, 'it comes for the one who hit it');
});

test('it hates everything alive: people, other peoples and every animal', () => {
  const { w, d } = arena();
  const trike = addDino(w, 'trike', d.x + 120, d.y, { growth: 1 });
  w.update(1 / 30);
  d.think = 0;
  lava.lavaThink(w, d);
  assert.equal(d.targetId, trike.id, 'an animal is a target');
  const h = addHuman(w, d.x - 60, d.y, false, { role: 'gatherer' });
  d.targetId = 0;
  lava.lavaThink(w, d);
  assert.equal(d.targetId, h.id, 'the nearest living thing, whoever it is');
});

test('anything it touches burns: people, animals, and other folk', () => {
  const { w, d } = arena();
  const h = addHuman(w, d.x + 10, d.y, false, { role: 'gatherer' });
  const raptor = addDino(w, 'raptor', d.x - 12, d.y + 4, { growth: 1 });
  const hp = h.hp, health = raptor.health;
  w.elapsed += 1;
  lava.lavaAct(w, d, 1 / 30);
  assert.ok(h.hp < hp, 'the person is burned');
  assert.ok(raptor.health < health, 'the animal is burned');
  const at = h.hp;
  lava.lavaAct(w, d, 1 / 30);
  assert.equal(h.hp, at, 'a burn, then a moment before the next');
});

test('nobody can make peace or trade with them: they are not in Diplomacy', () => {
  const { w, d } = arena();
  assert.ok(!w.diplomacy.settlements(w).some((s) => /lava/i.test(s.id) || /lava/i.test(s.name)));
  assert.equal(w.diplomacy.nationDino(d), null);
  assert.equal(w.diplomacy.protectedDino(d), false, 'never protected by a treaty');
});

test('fire and lava are home ground, water stops it', () => {
  const { w, d, cx, cy } = arena();
  const i = cy * MAP_W + cx + 2;
  w.lava.heat[i] = 0.9;
  w.fire.heat[i + 1] = 0.9;
  assert.equal(walkable(w, d, (cx + 2) * TILE + 16, cy * TILE + 16), true, 'walks on live lava');
  assert.equal(walkable(w, d, (cx + 3) * TILE + 16, cy * TILE + 16), true, 'walks through fire');
  const trike = addDino(w, 'trike', d.x, d.y, { growth: 1 });
  assert.equal(walkable(w, trike, (cx + 2) * TILE + 16, cy * TILE + 16), false, 'an ordinary animal does not');
  w.terrain.setTile(cx - 3, cy, T.Shallow);
  w.nav.sync(w);
  assert.equal(walkable(w, d, (cx - 3) * TILE + 16, cy * TILE + 16), false, 'it will not step into water');
});

test('killed, it leaves no body: it cools into a lava-stone statue to dig', () => {
  const { w, d } = arena();
  const nodes = w.colony.nodes.length, items = w.items.length;
  hitDino(w, d, 1e6, d.x - 50, d.y);
  assert.ok(!w.dinos.includes(d), 'gone');
  const node = w.colony.nodes[w.colony.nodes.length - 1];
  assert.equal(w.colony.nodes.length, nodes + 1);
  assert.equal(node.kind, 'lavaStone');
  assert.ok(node.found && node.amount > 0);
  assert.equal(w.items.length, items, 'no carcass, no meat');
});

test('a dead one is replaced from the volcano in time, faster in an eruption', () => {
  const w = quiet();
  w.wildlife.enabled = true;
  lava.lavaTick(w, 1.1);
  const n = w.dinos.filter(lava.isLavaFolk).length;
  for (const d of w.dinos.filter(lava.isLavaFolk).slice(0, 2)) w.removeDino(d);
  for (let t = 0; t < 400; t += 1) { w.elapsed += 1; lava.lavaTick(w, 1); }
  assert.ok(w.dinos.filter(lava.isLavaFolk).length >= n - 1, 'the volcano makes more');
  assert.ok(sizeOf(w.dinos.find(lava.isLavaFolk)) > 40, 'a big lump');
});

test('in the snow it cools off: steam, a greying crust, slower, and too cold it sets solid into lava stone', () => {
  const { w, d, cx, cy } = arena();
  for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) { w.terrain.setTile(x, y, T.Snow); w.snow.depth[y * MAP_W + x] = 0.9; }
  w.nav.sync(w);
  d.lavaHeat = 1;
  const i = cy * MAP_W + cx;
  const snowBefore = w.snow.depth[i];
  for (let k = 0; k < 30 * 8; k++) lava.lavaAct(w, d, 1 / 30);
  assert.ok(d.lavaHeat < 0.6, `cooled (${d.lavaHeat.toFixed(2)})`);
  assert.ok(w.snow.depth[i] < snowBefore, 'it melts the snow it stands in');
  for (let k = 0; k < 30 * 4; k++) lava.lavaAct(w, d, 1 / 30);
  assert.ok(d.lavaHeat < lava.HEAT.slow && d.slowT > 0, 'cool: it slows right down');
  d.think = 0;
  lava.lavaThink(w, d);
  assert.equal(d.state, 'wander', 'cold: it heads back to the lava');
  const nodes = w.colony.nodes.length;
  d.lavaHeat = 0;
  d.health = 0.05;
  for (let k = 0; k < 30 * 4 && w.dinos.includes(d); k++) lava.lavaAct(w, d, 1 / 30);
  assert.ok(!w.dinos.includes(d), 'set solid');
  assert.equal(w.colony.nodes[w.colony.nodes.length - 1].kind, 'lavaStone');
  assert.equal(w.colony.nodes.length, nodes + 1);
});

test('the volcano keeps a lava pool molten, and swimming in it heats + heals them', () => {
  const w = quiet();
  w.wildlife.enabled = true;
  lava.lavaTick(w, 1.1);
  const pool = lava.lavaPool(w);
  assert.ok(pool.length >= 6, `a pool of ${pool.length} tiles`);
  for (const i of pool) assert.ok(w.lava.heat[i] >= 0.4, 'molten');
  const i = pool[0];
  const d = lava.spawnLavaFolk(w, (i % MAP_W) * TILE + 16, Math.floor(i / MAP_W) * TILE + 16);
  assert.ok(lava.inLava(w, d.x, d.y));
  d.lavaHeat = 0.3;
  d.health = 0.5;
  for (let k = 0; k < 30 * 2; k++) lava.lavaAct(w, d, 1 / 30);
  assert.ok(d.lavaHeat > 0.9, 'hot again');
  assert.ok(d.health > 0.5, 'healing');
});

test('it balls up lava and throws it: the ball splatters, melts whoever it lands on, and leaves lava that cools to stone', () => {
  const { w, d } = arena();
  const h = addHuman(w, d.x + 220, d.y, false, { role: 'gatherer' });
  w.update(1 / 30);
  d.targetId = h.id;
  d.lavaCd = 0;
  d.lavaHeat = 1;
  h.x = d.x + 220; h.y = d.y; h.vx = h.vy = 0;
  const hp = h.hp;
  let thrown = false;
  for (let k = 0; k < 30 * 2 && !thrown; k++) { lava.lavaAct(w, d, 1 / 30); thrown = lava.lavaBalls(w).length > 0; h.x = d.x + 220; h.y = d.y; }
  assert.ok(thrown, 'a ball is in the air');
  for (let k = 0; k < 30 * 3 && lava.lavaBalls(w).length; k++) { lava.lavaBallsTick(w, 1 / 30); h.x = d.x + 220; h.y = d.y; }
  assert.equal(lava.lavaBalls(w).length, 0, 'it came down');
  assert.ok(h.hp < hp, 'it melted them');
  const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE);
  let hot = 0;
  for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) hot = Math.max(hot, w.lava.heat[y * MAP_W + x]);
  assert.ok(hot > 0.2, 'a splat of live lava (it cools into basalt: volcano.ts)');
});

test('a dragon flying past gets a lava ball lobbed at it', () => {
  const { w, d } = arena();
  const egg = { id: w.nextId(), breed: 'fire', x: d.x + 200, y: d.y, at: 'camp', nest: 0, carrier: 0, heat: 1, progress: 1, health: 1, rare: false, hatchT: 0 };
  w.dragons.eggs.push(egg);
  const dr = nests.hatch(w, egg);
  dr.age = 1300; dr.growth = 1; keep.newDragonStats(dr); dr.hp = dr.maxHp;
  dr.x = d.x + 160; dr.y = d.y; dr.z = 90; dr.vx = 0; dr.vy = 0;
  d.lavaCd = 0; d.lavaHeat = 1; d.targetId = 0;
  let ball = null;
  for (let k = 0; k < 30 * 2 && !ball; k++) { lava.lavaAct(w, d, 1 / 30); ball = lava.lavaBalls(w)[0] ?? null; dr.x = d.x + 160; dr.y = d.y; dr.z = 90; }
  assert.ok(ball, 'a ball is thrown');
  assert.equal(ball.dragon, dr.id, 'at the dragon');
  const hp = dr.hp;
  for (let k = 0; k < 30 * 3 && lava.lavaBalls(w).length; k++) { lava.lavaBallsTick(w, 1 / 30); dr.x = d.x + 160; dr.y = d.y; dr.z = 90; }
  assert.ok(dr.hp < hp, 'it hit the dragon');
});

test('tap one and it moans LAVA… lava… (one word or two), like a zombie', () => {
  const { w, d } = arena();
  const words = new Set();
  for (let k = 0; k < 12; k++) {
    d.speech = undefined;
    w.events.length = 0;
    lava.lavaSpeak(w, d);
    assert.match(d.speech.text, /la+va+/i);
    const n = d.speech.text.split(/…\s*/).filter(Boolean).length;
    assert.ok(n === 1 || n === 2, `${d.speech.text}: once or twice`);
    words.add(n);
    const sfx = w.events.find((e) => e.type === 'sfx');
    assert.ok(sfx && sfx.sound === (n === 2 ? 'lava2' : 'lava1'), 'the moan matches the words');
  }
  assert.equal(words.size, 2, 'sometimes once, sometimes twice');
  lava.lavaSpeak(w, d);
  const before = d.speech.text;
  lava.lavaSpeak(w, d);
  assert.equal(d.speech.text, before, 'no talking over itself');
});

const { applyTool, DEFAULT_TOOL } = require('../game/tools.ts');
const { updateHuman } = require('./humans.ts');

test('fire + weapons barely touch them: spears and teeth melt in them', () => {
  const { w, d } = arena();
  const hp = d.health;
  hitDino(w, d, 40, d.x - 60, d.y);
  assert.ok(hp - d.health < 0.03, `a scratch (${(hp - d.health).toFixed(3)})`);
  assert.ok(w.dinos.includes(d));
});

test('water and snow cool them right down: set solid, they turn to stone (no bones, no body)', () => {
  const { w, d } = arena();
  const items = w.items.length;
  for (let k = 0; k < 6 && w.dinos.includes(d); k++) lava.coolLava(w, d, 0.28);
  assert.ok(!w.dinos.includes(d), 'set solid');
  assert.equal(w.items.length, items, 'no carcass, no bones');
  const statues = lava.lavaStatues(w);
  assert.equal(statues.length, 1, 'a stone statue of it');
  const node = w.colony.nodes.find((n) => n.id === statues[0].node);
  assert.equal(node.kind, 'lavaStone');
  node.amount = 0;
  assert.equal(lava.lavaStatues(w).length, 0, 'gone once the lava stone is dug away');
});

test('a Lava Monster that faints (any cause) turns to stone too', () => {
  const { w, d } = arena();
  const items = w.items.length;
  d.health = 0;
  d.state = 'faint';
  d.stateT = 3;
  for (let k = 0; k < 5; k++) w.update(1 / 30);
  assert.ok(!w.dinos.includes(d));
  assert.equal(w.items.length, items, 'no charred skeleton');
  assert.equal(lava.lavaStatues(w).length, 1);
});

test('our people fight one with buckets of water, from out of its reach', () => {
  const { w, d } = arena();
  w.camp.stock.water = 20;
  const h = addHuman(w, d.x + 150, d.y, false, { role: 'guard' });
  w.update(1 / 30);
  h.targetId = d.id;
  h.state = 'hunt';
  h.stateT = 0;
  d.lavaHeat = 1;
  let closest = Infinity;
  for (let k = 0; k < 30 * 6 && w.dinos.includes(d); k++) {
    d.x = d.homeX = d.x; d.vx = d.vy = 0; d.lavaCd = 99;
    h.think = 1;
    updateHuman(w, h, 1 / 30);
    lava.lavaBallsTick(w, 1 / 30);
    lava.lavaAct(w, d, 1 / 30);
    if (w.dinos.includes(d)) closest = Math.min(closest, Math.hypot(h.x - d.x, h.y - d.y));
    w.elapsed += 1 / 30;
  }
  assert.ok(w.camp.stock.water < 20, 'water from the stores');
  assert.ok(!w.dinos.includes(d) || d.lavaHeat < 0.6, 'it is cooling');
  assert.ok(closest > lava.TOUCH + 20, `they kept out of its reach (${Math.round(closest)} px)`);
});

test('on snowy ground they pelt it with snowballs (no water needed)', () => {
  const { w, d, cx, cy } = arena();
  w.camp.stock.water = 0;
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx; x <= cx + 8; x++) { w.terrain.setTile(x, y, T.Snow); w.snow.depth[y * MAP_W + x] = 0.8; }
  w.nav.sync(w);
  const h = addHuman(w, d.x + 140, d.y, false, { role: 'guard' });
  w.update(1 / 30);
  h.targetId = d.id; h.state = 'aim'; h.stateT = 0; h.cd = 0;
  d.lavaHeat = 1;
  for (let k = 0; k < 30 * 2; k++) { h.think = 1; updateHuman(w, h, 1 / 30); lava.lavaBallsTick(w, 1 / 30); w.elapsed += 1 / 30; }
  assert.equal(w.camp.stock.water, 0);
  assert.ok(d.lavaHeat < 1, 'the snowballs cooled it');
});

test('when the volcano erupts they cheer, then ride the lava down like a slide', () => {
  const { w, d } = arena();
  d.lavaJoy = 0;
  w.volcano.phase = 'erupt';
  lava.lavaBallsTick(w, 1 / 30);
  assert.ok(d.lavaJoy > 0, 'cheering');
  assert.ok(d.speech && /la+va/i.test(d.speech.text), 'LAVA! LAVA!');
  const tx = Math.floor(d.x / TILE), ty = Math.floor(d.y / TILE);
  w.lava.spawn(tx, ty, 2);
  lava.lavaAct(w, d, 1 / 30);
  assert.ok(lava.isRidingLava(d), 'hopped on');
  const head = w.lava.heads[0];
  head.x += 3;
  const x0 = d.x;
  for (let k = 0; k < 30; k++) lava.lavaAct(w, d, 1 / 30);
  assert.ok(d.x > x0 + 40, 'carried along with the flow');
  head.vol = 0;
  lava.lavaAct(w, d, 1 / 30);
  assert.ok(!lava.isRidingLava(d), 'hops off when the flow runs out');
});

test('the People tool puts Lava Monsters down (never in water), and they make that spot home', () => {
  const { w, cx, cy } = arena();
  const n = w.dinos.filter(lava.isLavaFolk).length;
  const tool = { ...DEFAULT_TOOL, id: 'people', people: 'lavaFolk' };
  const x = (cx - 4) * TILE + 16, y = cy * TILE + 16;
  assert.equal(applyTool(w, tool, x, y, false), true);
  const added = w.dinos.filter(lava.isLavaFolk).slice(n);
  assert.equal(added.length, 3);
  for (const d of added) assert.ok(Math.hypot(d.homeX - x, d.homeY - y) < 1, 'home is where they were put');
  w.terrain.setTile(cx - 7, cy, T.Deep);
  w.nav.sync(w);
  assert.equal(applyTool(w, tool, (cx - 7) * TILE + 16, cy * TILE + 16, false), false);
});

test('standing in lava or fire never hurts them (the world update, not just their own brain)', () => {
  const w = quiet();
  w.wildlife.enabled = true;
  lava.lavaTick(w, 1.1);
  const i = lava.lavaPool(w)[0];
  const d = lava.spawnLavaFolk(w, (i % MAP_W) * TILE + 16, Math.floor(i / MAP_W) * TILE + 16);
  d.health = 1;
  for (let k = 0; k < 30 * 5; k++) w.update(1 / 30);
  assert.ok(w.dinos.includes(d), 'still there');
  assert.ok(d.health > 0.9, `unhurt (${d.health.toFixed(2)})`);
  assert.notEqual(d.state, 'flee', 'and not running from it');
});

test('their hot tub: a round pool of lava below the volcano (never up on the cone), and they go and sit in it', () => {
  const w = quiet();
  w.wildlife.enabled = true;
  lava.lavaTick(w, 1.1);
  const tub = lava.lavaTub(w);
  assert.ok(tub, 'there is a tub');
  assert.ok(!lava.onCone(w, tub.x, tub.y), 'not on the cone');
  assert.ok(tub.y > w.volcano.y + 150, 'below the cone');
  for (const i of lava.lavaPool(w)) {
    const x = (i % MAP_W) * TILE + 16, y = Math.floor(i / MAP_W) * TILE + 16;
    assert.ok(!lava.onCone(w, x, y), 'none of it on the cone');
    assert.ok(w.lava.heat[i] >= 0.4 && w.lava.held.has(i), 'kept molten');
  }
  assert.ok(lava.inTub(w, tub.x, tub.y));
  // a cold one walks to the tub and sits in it (no eggs about to distract it: the valley's wildlife stays off)
  w.wildlife.enabled = false;
  w.eggs.length = 0;
  const d = lava.spawnLavaFolk(w, tub.x + 260, tub.y + 40);
  d.lavaHeat = 0.3;
  let sat = false;
  for (let k = 0; k < 30 * 40 && !sat; k++) { w.update(1 / 30); sat = lava.inTub(w, d.x, d.y); }
  assert.ok(sat, 'it got in');
  for (let k = 0; k < 30 * 3; k++) w.update(1 / 30);
  assert.ok(d.lavaHeat > 0.9, 'and warmed right up');
});

test('hit by lava, things catch fire: they burn and run (not freeze), and water puts them out', () => {
  const { w, d, cx, cy } = arena();
  const h = addHuman(w, d.x + 10, d.y, false, { role: 'gatherer' });
  const raptor = addDino(w, 'trike', d.x - 30, d.y + 4, { growth: 1 });
  w.update(1 / 30);
  h.x = d.x + 10; h.y = d.y; raptor.x = d.x - 30; raptor.y = d.y + 4;
  w.elapsed += 1;
  d.lavaHeat = 1;
  lava.lavaAct(w, d, 1 / 30);
  lava.lavaBallsTick(w, 1 / 30);
  assert.ok(h.aflame > 0, 'the person is on fire');
  assert.ok(raptor.aflame > 0, 'the animal is on fire');
  assert.ok(lava.aflameNow(w).has(raptor));
  assert.equal(raptor.state, 'flee', 'and runs');
  // it keeps burning after it's got away
  raptor.x += 400; h.x += 400;
  const hr = raptor.health;
  for (let k = 0; k < 30; k++) { lava.lavaBallsTick(w, 1 / 30); w.elapsed += 1 / 30; }
  assert.ok(raptor.health < hr, 'burning down');
  // into the water: out it goes
  w.terrain.setTile(Math.floor(raptor.x / TILE), Math.floor(raptor.y / TILE), T.Shallow);
  lava.lavaBallsTick(w, 1 / 30);
  assert.equal(raptor.aflame, 0, 'put out');
  assert.ok(!lava.aflameNow(w).has(raptor));
  // and it burns out on its own in a few seconds
  for (let k = 0; k < 30 * 8; k++) { lava.lavaBallsTick(w, 1 / 30); w.elapsed += 1 / 30; }
  assert.ok(!h.aflame, 'the person burned out');
});

test('an animal that dies burning leaves charred remains, not a fresh carcass', () => {
  const { w, d } = arena();
  const o = addDino(w, 'raptor', d.x + 300, d.y, { growth: 1 });
  lava.setAflame(w, o, 'dino');
  const n = w.items.length;
  hitDino(w, o, 1e6, o.x - 10, o.y);
  const body = w.items[w.items.length - 1];
  assert.equal(w.items.length, n + 1);
  assert.equal(body.carcass.burnt, true, 'charred');
});

test('they love dino eggs: a nest near the volcano gets raided, the eggs gobbled and the nest set alight', () => {
  const { w, d, cx, cy } = arena();
  for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx + 3; x <= cx + 8; x++) w.terrain.setTile(x, y, T.Grass);
  w.nav.sync(w);
  w.eggs.length = 0;
  const egg = w.addEgg('trike', d.x + 160, d.y + 10, 0, 0);
  d.lavaHeat = 1;
  d.think = 0;
  let eaten = false;
  for (let k = 0; k < 30 * 30 && !eaten; k++) { w.update(1 / 30); eaten = !w.eggs.includes(egg); }
  assert.ok(eaten, 'gobbled');
  assert.ok(w.dinos.includes(d));
  const tx = Math.floor(egg.x / TILE), ty = Math.floor(egg.y / TILE);
  let hot = 0;
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) hot = Math.max(hot, w.fire.heat[y * MAP_W + x]);
  assert.ok(hot > 0 || w.fire.burnt[ty * MAP_W + tx] > 0, 'the nest burned');
});

test('eggs far from the volcano are safe from them', () => {
  const { w, d } = arena();
  w.eggs.length = 0;
  const far = w.addEgg('trike', d.homeX + lava.EGG_RANGE + 300, d.homeY, 0, 0);
  d.x = far.x - 200; d.y = far.y;
  d.think = 0;
  lava.lavaThink(w, d);
  assert.ok(!(d.state === 'wander' && Math.hypot(d.tx - far.x, d.ty - far.y) < 20), 'it does not go for it');
});

test('a Scorpion aimed at a Lava Monster turns water cannon: it fires water (not a bolt) and cools it', () => {
  const { w, d } = arena();
  w.camp.stock.water = 10;
  d.lavaHeat = 1;
  d.vx = d.vy = 0;
  const s = w.colony.addScorpion(w, d.x - 260, d.y);
  s.built = 1;
  s.hp = 999;
  s.reload = 0;
  // pointed straight at it: the art turns to a water cannon, and the shot is a jet of water
  s.aim = 0;
  w.tribe.hostile = () => true;
  w.colony['aimAndFire'](w, s, 1 / 30, null);
  assert.equal(s.water, true, 'it shows as a water cannon while a Lava Monster is in its sights');
  const bolts = w.tribe.projectiles.length;
  w.tribe.fireBolt(w, s.x, s.y, 20, { id: d.id, x: d.x, y: d.y, z: 20, vx: 0, vy: 0, dragon: false }, 40, 500, 1);
  assert.equal(w.tribe.projectiles.length, bolts, 'no bolt: bolts just melt in it');
  assert.ok(w.camp.stock.water < 10, 'the jet draws on the water stores');
  const heat = d.lavaHeat;
  for (let k = 0; k < 60 && w.dinos.includes(d); k++) {
    d.vx = d.vy = 0;
    lava.lavaBallsTick(w, 1 / 30);
  }
  assert.ok(!w.dinos.includes(d) || d.lavaHeat < heat - 0.2, `the jet cooled it (${heat} → ${d.lavaHeat})`);
});
