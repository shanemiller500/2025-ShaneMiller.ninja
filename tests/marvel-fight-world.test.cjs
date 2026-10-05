// Headless tests for the Marvel Fight World engine (app/marvel-fight-world/engine).
// The engine is DOM-free, so we transpile its TypeScript on the fly and step matches in Node.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const root = path.join(__dirname, '..', 'app', 'marvel-fight-world');
const { Match } = require(path.join(root, 'engine', 'match.ts'));
const { FightAI } = require(path.join(root, 'engine', 'ai.ts'));
const { emptyInput } = require(path.join(root, 'engine', 'types.ts'));
const { buildFighter, deriveArchetype } = require(path.join(root, 'engine', 'fighters.ts'));
const { buildRoster, fallbackHeroes } = require(path.join(root, 'data', 'roster.ts'));
const { matchesCharacter } = require(path.join(root, 'data', 'fandom.ts'));

const roster = buildRoster(fallbackHeroes(), true);
const byName = (n) => roster.fighters.find((f) => f.name === n);
const spidey = byName('Spider-Man');
const hulk = byName('Hulk');

const press = (keys) => Object.assign(emptyInput(), Object.fromEntries(keys.map((k) => [k, true])));
const idle = () => emptyInput();

/** Start a match and skip the intro. */
function ready(p1 = spidey, p2 = hulk, opts = {}) {
  const m = new Match({ p1, p2, seed: 3, ...opts });
  while (m.phase !== 'fight') m.step([idle(), idle()]);
  m.events.length = 0;
  return m;
}
function run(m, frames, p1 = idle, p2 = idle) {
  for (let i = 0; i < frames; i++) m.step([p1(i), p2(i)]);
}
/** Put the fighters next to each other. */
function closeIn(m, gap = 30) {
  const [a, b] = m.fighters;
  a.x = -gap / 2 - a.def.width / 2;
  b.x = gap / 2 + b.def.width / 2;
  run(m, 2);
}

test('every fallback character builds a usable fighter with all move slots', () => {
  assert.equal(roster.fighters.length, 12);
  for (const f of roster.fighters) {
    assert.ok(f.custom, `${f.name} should use its signature kit`);
    for (const slot of ['lp', 'hp', 'kick', 'low', 'launcher', 'air', 'throw', 's1', 's2', 's3', 'ult']) assert.ok(f.moves[slot], `${f.name} ${slot}`);
    assert.ok(f.maxHealth >= 1000 && f.maxHealth <= 1400);
  }
});

test('characters without a custom kit get archetype moves', () => {
  const generic = buildFighter({
    id: 999, name: 'Test Person', powerstats: { intelligence: 50, strength: 90, speed: 20, durability: 90, power: 20, combat: 60 },
    biography: { fullName: 'Tess Person', alignment: 'good' }, images: { xs: '', sm: '', md: '', lg: '' },
  });
  assert.equal(generic.custom, false);
  assert.ok(['brawler', 'tank'].includes(generic.archetype));
  assert.ok(generic.moves.s1.name && generic.moves.ult.cost === 100);
  assert.equal(deriveArchetype({ intelligence: 50, strength: 50, speed: 50, durability: 50, power: 50, combat: 50 }), 'balanced');
});

test('balancing keeps Hulk stronger without one-shotting', () => {
  assert.ok(hulk.physMul > byName('Captain America').physMul);
  const m = ready(hulk, byName('Captain America'));
  const dmg = m.computeDamage(m.fighters[0], m.fighters[1], hulk.moves.hp, 1, false, 1);
  assert.ok(dmg > 50 && dmg < m.fighters[1].def.maxHealth * 0.12, `heavy punch dealt ${dmg}`);
});

test('walking and jumping move the fighter', () => {
  const m = ready();
  const a = m.fighters[0];
  const x0 = a.x;
  run(m, 20, () => press(['right']));
  assert.ok(a.x > x0 + 40, 'walked right');
  run(m, 5, () => press(['up']));
  let peak = 0;
  for (let i = 0; i < 60; i++) {
    m.step([idle(), idle()]);
    peak = Math.max(peak, a.y);
  }
  assert.ok(peak > 120, `jumped to ${peak}`);
  assert.equal(a.y, 0);
  assert.equal(a.state, 'idle');
});

test('a punch connects, damages and pushes back', () => {
  const m = ready();
  closeIn(m);
  const b = m.fighters[1];
  const hp0 = b.health;
  const x0 = b.x;
  run(m, 30, (i) => press(i === 0 ? ['lp'] : []));
  assert.ok(b.health < hp0, 'damaged');
  assert.ok(b.x > x0, 'knocked back');
  assert.ok(m.events.some((e) => e.type === 'hit' && !e.blocked));
});

test('blocking reduces damage to zero for normals and drains guard', () => {
  const m = ready();
  closeIn(m);
  const b = m.fighters[1];
  const hp0 = b.health;
  run(m, 30, (i) => press(i === 0 ? ['hp'] : []), () => press(['block']));
  assert.equal(b.health, hp0);
  assert.ok(b.guard < 100);
  assert.ok(m.events.some((e) => e.type === 'hit' && e.blocked));
});

test('low attacks beat a standing block', () => {
  const m = ready();
  closeIn(m);
  const b = m.fighters[1];
  const hp0 = b.health;
  run(m, 30, (i) => press(i < 2 ? ['down', 'kick'] : ['down']), () => press(['block']));
  assert.ok(b.health < hp0);
});

test('chained normals form a combo with a counter and label', () => {
  const m = ready();
  closeIn(m, 20);
  // Jab, jab, kick: Spider-Man's "Spidey Flurry"
  const seq = { 0: ['lp'], 9: ['lp'], 18: ['kick'] };
  run(m, 50, (i) => press(seq[i] ?? []));
  const combos = m.events.filter((e) => e.type === 'combo');
  assert.ok(combos.length >= 2, `combo events: ${combos.length}`);
  assert.ok(combos.some((e) => e.hits >= 3), 'reached 3 hits');
  assert.ok(combos.some((e) => e.label === 'Spidey Flurry'));
});

test('specials fire projectiles and go on cooldown', () => {
  const m = ready();
  run(m, 3, (i) => press(i === 0 ? ['special'] : []));
  run(m, 20);
  assert.ok(m.projectiles.length > 0 || m.events.some((e) => e.type === 'hit'), 'web shot spawned');
  assert.ok(m.fighters[0].cooldowns.s1 > 0);
});

test('meter fills and the ultimate costs a full bar', () => {
  const m = ready();
  closeIn(m);
  const a = m.fighters[0];
  a.meter = 100;
  run(m, 3, (i) => press(i === 0 ? ['ult'] : []));
  assert.equal(a.meter, 0);
  assert.equal(a.slot, 'ult');
  assert.ok(m.events.some((e) => e.type === 'super'));
  const hp0 = m.fighters[1].health;
  run(m, 160);
  const lost = hp0 - m.fighters[1].health;
  assert.ok(lost > 100, `ultimate dealt ${lost}`);
  assert.ok(lost < m.fighters[1].def.maxHealth * 0.6, 'ultimate is not an instant win');
});

test('throws beat blocking', () => {
  const m = ready();
  closeIn(m, 20);
  const b = m.fighters[1];
  const hp0 = b.health;
  run(m, 40, (i) => press(i === 0 ? ['lp', 'kick'] : []), () => press(['block']));
  assert.ok(b.health < hp0, 'throw landed through block');
});

test('K.O. ends the round and the match, and rematch resets it', () => {
  const m = ready(spidey, hulk, { roundsToWin: 1 });
  closeIn(m);
  m.fighters[1].health = 5;
  run(m, 20, (i) => press(i === 0 ? ['hp'] : []));
  assert.equal(m.phase, 'ko');
  assert.ok(m.events.some((e) => e.type === 'ko' && e.winner === 0));
  run(m, 600);
  assert.equal(m.phase, 'over');
  assert.equal(m.winner, 0);
  m.rematch();
  assert.equal(m.phase, 'intro');
  assert.equal(m.fighters[1].health, m.fighters[1].def.maxHealth);
  assert.deepEqual(m.wins, [0, 0]);
});

test('AI vs AI fights finish with a winner on every difficulty', () => {
  for (const diff of ['easy', 'normal', 'hard', 'insane']) {
    const m = new Match({ p1: byName('Wolverine'), p2: byName('Thor'), seed: 11, roundSeconds: 60 });
    const ai1 = new FightAI(0, diff, 1);
    const ai2 = new FightAI(1, diff, 2);
    let frames = 0;
    let hits = 0;
    while (m.phase !== 'over' && frames < 60 * 60 * 8) {
      m.step([ai1.update(m), ai2.update(m)]);
      for (const e of m.events) if (e.type === 'hit' && e.damage > 0) hits++;
      m.events.length = 0;
      frames++;
    }
    assert.equal(m.phase, 'over', `${diff} match finished`);
    assert.ok(hits > 10, `${diff}: ${hits} hits landed`);
  }
});

test('every polished fighter can use every special without crashing', () => {
  for (const f of roster.fighters) {
    const m = ready(f, spidey);
    closeIn(m);
    m.fighters[0].meter = 100;
    const plan = [['special'], ['down', 'special'], ['right', 'special'], ['ult']];
    for (const keys of plan) {
      run(m, 3, (i) => press(i === 0 ? keys : keys.filter((k) => k === 'down' || k === 'right')));
      run(m, 120);
      m.fighters[0].cooldowns = {};
      m.fighters[1].health = m.fighters[1].def.maxHealth;
      if (m.phase !== 'fight') break;
    }
  }
});

test('wiki matching rejects the wrong page', () => {
  const hero = { name: 'Thor', biography: { fullName: 'Thor Odinson', aliases: ['God of Thunder'] } };
  assert.ok(matchesCharacter(hero, 'Thor Odinson (Earth-616)', 'Thor Odinson is the Asgardian God of Thunder'));
  assert.ok(!matchesCharacter(hero, 'Thor Girl (Earth-616)', 'Tarene is a cosmic being'));
  assert.ok(!matchesCharacter(hero, 'Thor (Film)', 'Thor is a 2011 film'));
  const spideyHero = { name: 'Spider-Man', biography: { fullName: 'Peter Parker', aliases: [] } };
  assert.ok(matchesCharacter(spideyHero, 'Peter Parker (Earth-616)', 'Peter Benjamin Parker is Spider-Man'));
  assert.ok(!matchesCharacter(spideyHero, 'Spider-Man (Miles Morales) (Earth-1610)', 'Miles Morales'));
});
