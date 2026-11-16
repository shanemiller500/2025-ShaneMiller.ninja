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
const { nationOf } = require('./diplomacy.ts');
const { scorpionTarget } = require('./colony.ts');
const { breathBlast } = require('./breath.ts');
const { sideOfDragon, canHurt } = require('./factions.ts');
const { T, TILE } = require('./types.ts');
const { addDino } = require('./dinos.ts');

function fixture() {
  const w = new World(9211, false);
  w.dinos.length = 0;
  w.weather.auto = false;
  w.time = 12;
  w.terrain.tiles.fill(T.Grass);
  w.rivals.started = true;
  const clan = { id: 1, name: 'Trade Rock', color: '#5ad', x: w.camp.x + 650, y: w.camp.y + 100, food: 24, growT: 500, raidT: 500 };
  w.rivals.clans.push(clan);
  const human = addHuman(w, w.camp.x, w.camp.y, false, { role: 'gatherer', think: 0 });
  const b = w.rivals.addBrute(w, clan, clan.x, clan.y);
  w.diplomacy.known.add('clan:1');
  const post = { id: w.nextId(), kind: 'tradingPost', x: w.camp.x + 160, y: w.camp.y + 64, tx: 0, ty: 0, built: 1, hp: 400, have: {} };
  w.colony.buildings.push(post);
  Object.assign(w.camp.stock, { wood: 200, stone: 100, gold: 100, iron: 20, water: 20 });
  return { w, clan, human, b, post, d: w.diplomacy };
}
function arrive(w) {
  for (let i = 0; i < 4000 && w.diplomacy.caravans.some((c) => !c.delivered); i++) { w.elapsed += 0.1; w.diplomacy.update(w, 0.1); }
}

test('peace, trade, friendship, alliance, war and peace form a working progression', () => {
  const { w, d } = fixture();
  assert.equal(d.status('us', 'clan:1'), 'Hostile');
  assert.match(d.action(w, 'clan:1', 'peace'), /Peace agreed/);
  assert.equal(d.status('us', 'clan:1'), 'Neutral');
  assert.match(d.trade(w, 'clan:1', 'wood', 40, 'iron', true), /approaching/);
  arrive(w);
  w.elapsed += 30;
  d.trade(w, 'clan:1', 'gold', 30, 'iron', true); arrive(w);
  w.elapsed += 30;
  d.trade(w, 'clan:1', 'gold', 30, 'iron', true); arrive(w);
  assert.equal(d.status('us', 'clan:1'), 'Friendly');
  assert.equal(d.action(w, 'clan:1', 'alliance'), 'Alliance formed.');
  assert.equal(d.status('us', 'clan:1'), 'Allied');
  d.action(w, 'clan:1', 'war');
  assert.equal(d.status('us', 'clan:1'), 'At War');
  assert.equal(d.relation('us', 'clan:1').allied, false);
  w.elapsed += 90;
  assert.match(d.action(w, 'clan:1', 'peace'), /Peace agreed/);
  assert.equal(d.hostile('us', 'clan:1'), false);
});

test('trade reserves goods, travels physically and exchanges exactly once', () => {
  const { w, d } = fixture(); d.peace(w, 'us', 'clan:1');
  const iron = w.camp.stock.iron, wood = w.camp.stock.wood;
  const quantity = d.quote(w, 'clan:1', 'wood', 20, 'iron');
  assert.match(d.trade(w, 'clan:1', 'wood', 20, 'iron'), /approaching/);
  assert.equal(w.camp.stock.wood, wood - 20);
  assert.equal(w.camp.stock.iron, iron);
  const startX = d.caravans[0].x;
  d.update(w, 1); d.update(w, 1);
  assert.notEqual(d.caravans[0].x, startX);
  arrive(w);
  assert.equal(w.camp.stock.iron, iron + quantity);
  for (let i = 0; i < 1000; i++) { w.elapsed += 0.1; d.update(w, 0.1); }
  assert.equal(w.camp.stock.iron, iron + quantity);
});

test('war cancels undelivered trades and refunds escrow without duplication', () => {
  const { w, d } = fixture(); d.peace(w, 'us', 'clan:1');
  const wood = w.camp.stock.wood, stock = d.stock('clan:1').iron;
  d.trade(w, 'clan:1', 'wood', 20, 'iron');
  d.war(w, 'us', 'clan:1');
  assert.equal(d.caravans.length, 0);
  assert.equal(w.camp.stock.wood, wood);
  assert.equal(d.stock('clan:1').iron, stock);
  d.war(w, 'us', 'clan:1');
  assert.equal(w.camp.stock.wood, wood);
});

test('invalid trade quantities, unavailable goods and same-good exchanges are rejected', () => {
  const { w, d } = fixture(); d.peace(w, 'us', 'clan:1');
  for (const n of [0, -10, NaN, Infinity, 1.5, 500]) assert.doesNotMatch(d.trade(w, 'clan:1', 'wood', n, 'iron'), /approaching/);
  assert.doesNotMatch(d.trade(w, 'clan:1', 'wood', 10, 'wood'), /approaching/);
  assert.equal(d.caravans.length, 0);
});

test('hostile factions accept gifts without a war; gifts really arrive', () => {
  const { w, d } = fixture();
  assert.match(d.trade(w, 'clan:1', 'gold', 10, 'iron', true), /approaching/);
  arrive(w);
  assert.ok(d.relation('us', 'clan:1').score > -35);
});

test('craft inventory can be traded without touching equipped gear', () => {
  const { w, d, human } = fixture(); d.peace(w, 'us', 'clan:1');
  w.colony.armory.spear1 = 3; human.gear.weapon = 'spear1';
  assert.match(d.trade(w, 'clan:1', 'gear:spear1', 2, 'wood'), /approaching/);
  assert.equal(w.colony.armory.spear1, 1);
  assert.equal(human.gear.weapon, 'spear1');
});

test('peace cancels human attack orders, clan raids and projectiles immediately', () => {
  const { w, d, human, b } = fixture();
  b.raid = true; b.state = 'fight'; b.targetId = human.id;
  human.state = 'aim'; human.targetId = b.id; human.order = { kind: 'hunt', id: b.id };
  const order = w.tasks.add(w, { kind: 'hunt', icon: '', label: 'Attack', x: b.x, y: b.y, target: b.id }, [human]);
  human.taskId = order.id;
  w.tribe.raid = { by: 'brute', ids: [b.id], phase: 'attack', t: 0, fromX: b.x, fromY: b.y, label: 'Raid', breached: false };
  w.rivals.missiles.push({ target: human.id });
  w.tribe.projectiles.push({ target: b.id });
  d.peace(w, 'us', 'clan:1');
  assert.equal(w.tribe.raid, null); assert.equal(b.raid, false); assert.equal(b.targetId, 0);
  assert.equal(human.order, null); assert.equal(human.state, 'idle');
  assert.equal(human.taskId, 0); assert.equal(order.people.length, 0);
  assert.equal(w.rivals.missiles.length, 0); assert.equal(w.tribe.projectiles.length, 0);
  assert.equal(w.rivals.startRaid(w, w.rivals.clans[0]), false);
});

test('friendly visitors do not trigger guard fire or civilian flight', () => {
  const { w, d, human, b } = fixture(); d.peace(w, 'us', 'clan:1');
  b.x = human.x + 80; b.y = human.y;
  assert.equal(w.rivals.hostile(w, b), false);
  assert.equal(scorpionTarget(w, human.x, human.y, 400), null);
  updateHuman(w, human, 1 / 30);
  assert.notEqual(human.state, 'flee');
  d.war(w, 'us', 'clan:1');
  assert.equal(w.rivals.hostile(w, b), true);
  assert.equal(scorpionTarget(w, human.x, human.y, 400).id, b.id);
});

test('ally joins a joint war, recruits existing fighters and keeps defenders home', () => {
  const { w, d, clan } = fixture();
  for (let i = 0; i < 7; i++) w.rivals.addBrute(w, clan, clan.x + i * 10, clan.y);
  w.rivals.clans.push({ ...clan, id: 2, name: 'Enemy', x: clan.x + 800 });
  d.known.add('clan:2');
  Object.assign(d.relation('us', 'clan:1'), { score: 80, allied: true });
  d.war(w, 'us', 'clan:2');
  const count = w.rivals.brutes.length;
  assert.match(d.action(w, 'clan:1', 'join', 'clan:2'), /joined the war/);
  assert.equal(d.relation('clan:1', 'clan:2').war, true);
  assert.equal(w.rivals.brutes.length, count);
  assert.equal(d.missions[0].ids.length, 6);
  assert.equal(d.dispatch(w, 'clan:1', 'clan:2', 'war'), false);
});

test('political fighters damage an enemy faction independently of the player', () => {
  const { w, d, clan, b } = fixture();
  for (let i = 0; i < 5; i++) w.rivals.addBrute(w, clan, clan.x, clan.y);
  const other = { ...clan, id: 2, name: 'Enemy', x: clan.x + 120 };
  w.rivals.clans.push(other);
  const foe = w.rivals.addBrute(w, other, b.x + 20, b.y);
  d.war(w, 'clan:1', 'clan:2');
  w.rivals.thinkBrute(w, foe);
  assert.equal(foe.state, 'fight', 'native defenders recognize a diplomatic enemy');
  const hp = foe.hp;
  d.missionStep(w, b, 1 / 30);
  assert.ok(foe.hp < hp);
  assert.equal(d.relation('us', 'clan:1').war, false);
});

test('political raiders attack the player after declaration and stop after peace', () => {
  const { w, d, clan, b, human } = fixture();
  for (let i = 0; i < 5; i++) w.rivals.addBrute(w, clan, clan.x, clan.y);
  d.war(w, 'clan:1', 'us');
  b.x = human.x + 20; b.y = human.y; b.cd = 0;
  d.missionStep(w, b, 1 / 30);
  assert.ok(human.hp < 1);
  d.peace(w, 'clan:1', 'us');
  const hp = human.hp; b.cd = 0;
  d.missionStep(w, b, 1 / 30);
  assert.equal(human.hp, hp);
});

test('friendly Sand dragons and lingering breath respect peace', () => {
  const { w, d, human } = fixture();
  const dr = { id: 999, kind: 'dragon', sandTribe: 1, x: human.x, y: human.y, z: 60, vx: 0, vy: 0, state: 'circle' };
  d.peace(w, 'us', 'sand:1');
  w.dragons.list.push(dr);
  assert.equal(scorpionTarget(w, human.x, human.y, 400), null);
  assert.equal(canHurt(sideOfDragon(dr), 'us', w), false);
  breathBlast(w, dr, human.x, human.y, 'sand');
  assert.equal(human.hp, 1);
  d.war(w, 'us', 'sand:1');
  breathBlast(w, dr, human.x, human.y, 'sand');
  const hp = human.hp;
  assert.ok(hp < 1);
  d.peace(w, 'us', 'sand:1');
  w.hazards.update(w, 1);
  assert.equal(human.hp, hp);
});

test('save roundtrip preserves treaties, history, offers, inventory and active caravan progress', () => {
  const { w, d } = fixture(); d.peace(w, 'us', 'clan:1');
  d.trade(w, 'clan:1', 'wood', 20, 'iron'); d.update(w, 1);
  d.offers.push({ id: 800, kind: 'trade', from: 'clan:1', expires: 180 });
  const data = JSON.parse(JSON.stringify(w.serialize()));
  const loaded = World.deserialize(data);
  assert.deepEqual(loaded.diplomacy.serialize(), data.diplomacy);
  assert.equal(loaded.diplomacy.caravans[0].x, d.caravans[0].x);
  const before = loaded.camp.stock.iron;
  arrive(loaded);
  assert.ok(loaded.camp.stock.iron > before);
});

test('old saves without diplomacy load with safe defaults', () => {
  const { w } = fixture(); const data = w.serialize(); delete data.diplomacy;
  const loaded = World.deserialize(JSON.parse(JSON.stringify(data)));
  assert.equal(loaded.diplomacy.caravans.length, 0);
  assert.equal(loaded.diplomacy.status('us', 'snow:1'), 'Neutral');
});

test('post upgrades improve prices and cargo capacity and persist', () => {
  const { w, d } = fixture();
  const quote = d.quote(w, 'clan:1', 'wood', 40, 'iron');
  assert.match(d.upgrade(w), /level 2/);
  assert.match(d.upgrade(w), /level 3/);
  assert.equal(d.postLevel(w), 3);
  assert.ok(d.quote(w, 'clan:1', 'wood', 40, 'iron') >= quote);
  assert.match(d.upgrade(w), /already level 3/);
});

test('native clan AI stays peaceful when a visitor is next to a worker', () => {
  const { w, d, human, b } = fixture(); d.peace(w, 'us', 'clan:1');
  b.x = human.x + 20; b.y = human.y; b.state = 'fight'; b.targetId = human.id; b.think = 0;
  for (let i = 0; i < 100; i++) { w.elapsed += 0.1; w.rivals.update(w, 0.1); }
  assert.equal(human.hp, 1);
  assert.notEqual(b.state, 'fight');
});

test('all four native folk combat implementations refuse peaceful targets', () => {
  for (const [kind, module] of [['tree', 'forest'], ['sea', 'seaFolk'], ['sand', 'sandFolk'], ['snow', 'snowFolk']]) {
    const { w, d, human, b } = fixture();
    b[kind] = 1; b.clan = 0;
    d.peace(w, 'us', `${kind}:1`);
    w[module].strike(w, b, { kind: 'human', h: human }, 1);
    w[module].throwAt(w, b, { kind: 'human', h: human });
    assert.equal(human.hp, 1, kind);
    assert.equal(w.rivals.missiles.length, 0, kind);
  }
});

test('a peace agreement frees existing clan prisoners and their carriers', () => {
  const { w, d, human, b } = fixture();
  human.captive = 1; human.state = 'captive'; b.captive = human.id;
  d.peace(w, 'us', 'clan:1');
  assert.equal(human.captive, 0); assert.equal(b.captive, 0);
  assert.notEqual(human.state, 'captive');
});

test('friendly faction mounts pass guards and civilian threat detection', () => {
  const { w, d, human } = fixture();
  d.peace(w, 'us', 'snow:1');
  const mount = addDino(w, 'frosthorn', human.x + 70, human.y, { snowTribe: 1, state: 'defend' });
  w.creatureHash.insert(mount);
  assert.equal(w.tribe.hostile(w, mount), false);
  assert.equal(scorpionTarget(w, human.x, human.y, 400), null);
  updateHuman(w, human, 1 / 30);
  assert.notEqual(human.state, 'flee');
});

test('ask for help creates a common-enemy war and sends a bounded defense party', () => {
  const { w, d, clan, human } = fixture();
  for (let i = 0; i < 6; i++) w.rivals.addBrute(w, clan, clan.x, clan.y);
  const enemy = { ...clan, id: 2, name: 'Attackers', x: clan.x + 1000 };
  w.rivals.clans.push(enemy);
  w.rivals.addBrute(w, enemy, human.x + 100, human.y);
  Object.assign(d.relation('us', 'clan:1'), { allied: true, score: 80 });
  assert.match(d.action(w, 'clan:1', 'help'), /on their way/);
  assert.equal(d.relation('clan:1', 'clan:2').war, true);
  assert.ok(d.missions.some((m) => m.reason === 'help' && m.target === 'us'));
});

test('supplies and their replenishment cooldown survive saving', () => {
  const { w, d } = fixture();
  Object.assign(d.relation('us', 'clan:1'), { allied: true, score: 80 });
  assert.match(d.action(w, 'clan:1', 'supplies'), /approaching/);
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  loaded.elapsed += 30;
  assert.match(loaded.diplomacy.action(loaded, 'clan:1', 'supplies'), /replenish/);
});

test('old clan wars and alliances migrate into diplomacy', () => {
  const { w, clan } = fixture();
  w.rivals.clans.push({ ...clan, id: 2, name: 'Pact' }, { ...clan, id: 3, name: 'Feud' });
  w.rivals.setRelation(1, 2, 1); w.rivals.setRelation(1, 3, -1);
  const data = w.serialize(); delete data.diplomacy;
  const loaded = World.deserialize(JSON.parse(JSON.stringify(data)));
  assert.equal(loaded.diplomacy.status('clan:1', 'clan:2'), 'Allied');
  assert.equal(loaded.diplomacy.status('clan:1', 'clan:3'), 'At War');
});

test('settlement unions carry diplomatic agreements and caravan ownership forward', () => {
  const { w, d, clan } = fixture();
  w.rivals.clans.push({ ...clan, id: 2, name: 'Union' });
  Object.assign(d.relation('us', 'clan:1'), { allied: true, score: 80 });
  d.merge(w, 'clan:1', 'clan:2');
  assert.equal(d.status('us', 'clan:2'), 'Allied');
  assert.equal(d.known.has('clan:2'), true);
});
