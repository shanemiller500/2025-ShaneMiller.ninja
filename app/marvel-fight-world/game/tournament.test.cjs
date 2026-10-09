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
const root = path.join(__dirname, '..');
const { buildFighter } = require(path.join(root, 'engine', 'fighters.ts'));
const { newBracket, resolveCpuBout, advance, continueBracket, boutSeed, simulateBout } = require('./tournament.ts');
const { scoreMatch } = require(path.join(root, 'data', 'score.ts'));
const stats = (n) => ({ intelligence: n, strength: n, speed: n, durability: n, power: n, combat: n });
const hero = (id, n) => ({ id, name: `Fighter ${id}`, powerstats: stats(n), biography: { fullName: '', alignment: 'good' }, images: { xs: '', sm: '', md: '', lg: '' } });

test('appearance metadata changes fighter proportions', () => {
  const tall = buildFighter({ ...hero(1, 60), appearance: { height: ['-', '215 cm'], weight: ['-', '90 kg'] } });
  const short = buildFighter({ ...hero(2, 60), appearance: { height: ['-', '155 cm'], weight: ['-', '90 kg'] } });
  assert.ok(tall.height > short.height);
  assert.ok(tall.physical.reach > short.physical.reach);
  assert.ok(tall.physical.arm > short.physical.arm);
  assert.ok(short.physical.chest > tall.physical.chest);
});

test('seeded bracket separates top seeds and uses combat for CPU results', () => {
  const pool = Array.from({ length: 16 }, (_, i) => buildFighter(hero(100 + i, 40 + i * 3)));
  let br = newBracket(pool[0], pool, false, 16);
  assert.equal(br.rounds[0].length, 8);
  assert.ok(!br.rounds[0].some((b) => [b.seedA, b.seedB].includes(1) && [b.seedA, b.seedB].includes(2)));
  const index = br.rounds[0].findIndex((b) => !b.player);
  const b = br.rounds[0][index];
  const actual = simulateBout(b.a, b.b, 'hard', boutSeed(br, index));
  br = resolveCpuBout(br, index);
  assert.equal(br.rounds[0][index].winner.id, actual.winner.id);
  br = advance(br, true, true, '1-0 rounds');
  assert.equal(continueBracket(br).current, 0);
  br.rounds[0].forEach((x, i) => { if (!x.winner) br = resolveCpuBout(br, i); });
  assert.equal(continueBracket(br).rounds[1].length, 4);
});

test('brackets scale to 32 and 64 entrants when the roster allows it', () => {
  const pool = Array.from({ length: 64 }, (_, i) => buildFighter(hero(300 + i, 30 + i)));
  assert.equal(newBracket(pool[0], pool).size, 32);
  const large = newBracket(pool[0], pool, false, 64);
  assert.equal(large.rounds[0].length, 32);
  assert.equal(large.rounds[0].filter((b) => b.player).length, 1);
  assert.equal(new Set(large.rounds[0].flatMap((b) => [b.a.id, b.b.id])).size, 64);
});

test('CPU tournament reaches a champion through simulated bouts', () => {
  const pool = Array.from({ length: 8 }, (_, i) => buildFighter(hero(500 + i, 50 + i * 4)));
  let br = newBracket(pool[0], pool, false, 8);
  br = advance(br, false);
  for (let round = 0; round < 3; round++) {
    br.rounds[br.current].forEach((bout, index) => { if (!bout.winner) br = resolveCpuBout(br, index); });
    if (round < 2) br = continueBracket(br);
  }
  assert.equal(br.rounds.length, 3);
  assert.ok(pool.some((d) => d.id === br.rounds[2][0].winner.id));
});

test('perfect KO needs no damage taken', () => {
  const base = { me: buildFighter(hero(4, 60)), opponent: buildFighter(hero(5, 70)), won: true, difficulty: 'normal', kos: 1, perfects: 1, maxCombo: 3, ults: 0, fastestKo: 20, healthLeft: 1, streakBefore: 0, bestStreakBefore: 0 };
  const perfect = scoreMatch({ ...base, damageTaken: 0 });
  assert.ok(perfect.lines.some((l) => l.label === 'CLEAN SWEEP' && l.points === 1500));
  assert.ok(perfect.lines.some((l) => l.label === 'PERFECT KO' && l.points === 3000));
  assert.ok(!scoreMatch({ ...base, damageTaken: 1 }).lines.some((l) => l.label === 'PERFECT KO'));
});
