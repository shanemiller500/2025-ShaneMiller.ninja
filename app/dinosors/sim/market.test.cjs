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
const { addDino } = require('./dinos.ts');
const { T, TILE } = require('./types.ts');
const { MARKET, TRADE_GOODS, goodName } = require('./diplomacy.ts');
const zoo = require('./zoo.ts');

function fixture() {
  const w = new World(9211, false);
  w.dinos.length = 0;
  w.weather.auto = false;
  w.time = 12;
  w.terrain.tiles.fill(T.Grass);
  w.rivals.started = true;
  const clan = { id: 1, name: 'Trade Rock', color: '#5ad', x: w.camp.x + 650, y: w.camp.y + 100, food: 24, growT: 500, raidT: 500 };
  w.rivals.clans.push(clan);
  addHuman(w, w.camp.x, w.camp.y, false, { role: 'gatherer', think: 0 });
  w.rivals.addBrute(w, clan, clan.x, clan.y);
  w.diplomacy.known.add('clan:1');
  const post = { id: w.nextId(), kind: 'tradingPost', x: w.camp.x + 160, y: w.camp.y + 64, tx: 0, ty: 0, built: 1, hp: 400, have: {} };
  w.colony.buildings.push(post);
  Object.assign(w.camp.stock, { wood: 200, stone: 100, gold: 100, iron: 20, water: 20, copper: 20, copperBar: 20, silverBar: 10, goldBar: 10, steel: 10, diamond: 5 });
  w.diplomacy.peace(w, 'us', 'clan:1');
  return { w, d: w.diplomacy };
}
function arrive(w) {
  for (let i = 0; i < 4000 && w.diplomacy.caravans.some((c) => !c.delivered); i++) { w.elapsed += 0.1; w.diplomacy.update(w, 0.1); }
}

test('what the mine and the refinery make can be traded, and bars beat raw ore', () => {
  const { w, d } = fixture();
  for (const id of ['copperBar', 'silverBar', 'goldBar', 'steel', 'diamond', 'obsidian', 'wine']) assert.ok(TRADE_GOODS.some((g) => g.id === id), id);
  assert.equal(goodName('copperBar'), 'Copper bars');
  const ore = d.quote(w, 'clan:1', 'copper', 10, 'wood');
  const bars = d.quote(w, 'clan:1', 'copperBar', 10, 'wood');
  assert.ok(bars > ore * 1.8, `bars ${bars} vs ore ${ore}`);
  assert.match(d.trade(w, 'clan:1', 'steel', 2, 'stone'), /approaching/);
  const stone = w.camp.stock.stone;
  arrive(w);
  assert.ok(w.camp.stock.stone > stone);
  assert.equal(w.camp.stock.steel, 8);
});

test('each settlement wants something different every day: selling it pays more, their surplus is cheaper', () => {
  const { w, d } = fixture();
  const seen = new Set();
  for (let day = 1; day <= 12; day++) {
    w.day = day;
    const m = d.market(w, 'clan:1');
    seen.add(m.want);
    assert.notEqual(m.want, m.glut);
    assert.deepEqual(d.market(w, 'clan:1'), m, 'the same for everyone that day');
    assert.ok(Math.abs(d.value('clan:1', m.want, w) / d.value('clan:1', m.want) - MARKET.hot) < 1e-9);
    assert.ok(Math.abs(d.value('clan:1', m.glut, w) / d.value('clan:1', m.glut) - MARKET.glut) < 1e-9);
  }
  assert.ok(seen.size >= 3, `the demand moves around (${[...seen].join(', ')})`);
  w.day = 3;
  const m = d.market(w, 'clan:1');
  Object.assign(w.camp.stock, { [m.want]: 50 });
  const hot = d.quote(w, 'clan:1', m.want, 20, 'water');
  w.day = 4;
  const other = d.market(w, 'clan:1').want === m.want ? null : d.quote(w, 'clan:1', m.want, 20, 'water');
  if (other !== null) assert.ok(hot > other, 'worth more on the day they want it');
});

test('older saves: settlements stock the new goods after loading', () => {
  const { w, d } = fixture();
  const stock = d.stock('clan:1');
  delete stock.steel;
  delete stock.flint;
  const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
  assert.ok(loaded.diplomacy.stock('clan:1').steel >= 1);
  assert.equal(loaded.diplomacy.stock('clan:1').flint, 40, 'the clans sell flint');
});

test('a caravan that finds a beast in the zoo leaves gold and goes home impressed', () => {
  const { w, d } = fixture();
  const tx = Math.floor((w.camp.x + 300) / TILE), ty = Math.floor((w.camp.y + 200) / TILE);
  const b = { id: w.nextId(), kind: 'zoo', tx, ty, x: (tx + 4) * TILE, y: (ty + 5) * TILE - TILE / 2, built: 1, hp: 700, have: {} };
  w.colony.buildings.push(b);
  zoo.cageBeast(w, addDino(w, 'yeti', b.x, b.y - 40, { growth: 1 }), b);
  const gold = w.camp.stock.gold, score = d.relation('us', 'clan:1').score;
  d.trade(w, 'clan:1', 'wood', 20, 'stone');
  arrive(w);
  assert.equal(w.camp.stock.gold, gold + 2);
  assert.ok(d.relation('us', 'clan:1').score >= score + 5);
  assert.ok(d.history.some((h) => /zoo/.test(h.text)));
});
