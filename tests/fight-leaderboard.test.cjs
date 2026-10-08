const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function makeCloud({ failBoard = false } = {}) {
  const docs = new Map();
  const published = [];
  const firestore = {
    collection: (_, name) => name,
    doc: (_, ...parts) => parts.join('/'),
    getDoc: async (ref) => ({ exists: () => docs.has(ref), data: () => docs.get(ref) }),
    getDocs: async (q) => ({ docs: [...docs.entries()]
      .filter(([key]) => key.startsWith('fightWorldLeaderboard/'))
      .map(([key, value]) => ({ id: key.split('/')[1], data: () => value }))
      .sort((a, b) => b.data()[q.sort] - a.data()[q.sort])
      .slice(0, q.max) }),
    getCountFromServer: async (q) => ({ data: () => ({ count: [...docs.entries()]
      .filter(([key, value]) => key.startsWith('fightWorldLeaderboard/') && value[q.field] > q.value).length }) }),
    limit: (max) => ({ max }),
    orderBy: (sort) => ({ sort }),
    query: (collection, ...clauses) => ({ collection, ...Object.assign({}, ...clauses) }),
    serverTimestamp: () => new Date(),
    runTransaction: async (_, callback) => callback({
      get: async (ref) => ({ exists: () => docs.has(ref), data: () => docs.get(ref) }),
      set: (ref, data) => {
        if (failBoard) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
        published.push(data.score);
        docs.set(ref, data);
      },
    }),
    setDoc: async (ref, data) => {
      if (ref.startsWith('fightWorldLeaderboard/')) {
        if (failBoard) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
        published.push(data.score);
      }
      docs.set(ref, data);
    },
    Timestamp: class Timestamp {},
    where: (field, _, value) => ({ field, value }),
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'marvel-fight-world', 'data', 'cloud.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  const modules = {
    'firebase/firestore': firestore,
    '@/utils/firebase/client': { deviceKind: () => 'computer', firebase: () => ({ db: {}, auth: { currentUser: { uid: 'one' } } }), friendlyError: (error) => error.code },
    './storage': {
      EMPTY_STATS: { score: 0, wins: 0, matches: 0, knockouts: 0, perfects: 0, bestStreak: 0, streak: 0, biggestCombo: 0, tournamentWins: 0, survivalBest: 0, bestStreakById: null, fighters: {} },
      cleanName: (name) => name.trim(), validName: (name) => name.length >= 2,
      mainFighter: () => null,
    },
  };
  vm.runInNewContext(js, { exports, require: (id) => modules[id], Date, Map, Promise }, { filename: 'cloud.ts' });
  return { api: exports, docs, published };
}

const user = { uid: 'one', email: 'player@example.test' };
const meta = { matches: 1, wins: 1, knockouts: 1, tournamentWins: 0, survivalBest: 0 };
const bundle = (score) => JSON.stringify({ profile: { name: 'Player One' }, stats: { score, wins: 1, matches: 1 } });

test('publishes the latest score to Firebase in save order and reads it back', async () => {
  const { api, docs, published } = makeCloud();
  await Promise.all([api.fightCloud.write(user, bundle(100), meta), api.fightCloud.write(user, bundle(250), meta)]);
  assert.deepEqual(published, [100, 250]);
  assert.equal(docs.get('fightWorldPlayers/one/saves/current').data, bundle(250));
  assert.equal(docs.get('fightWorldLeaderboard/one').score, 250);
  const rows = await api.loadLeaderboard('score');
  assert.equal(rows[0].name, 'Player One');
  assert.equal((await api.myLeaderboardRank('score')).rank, 1);
});

test('reports leaderboard rejection while preserving the cloud save', async () => {
  const { api, docs } = makeCloud({ failBoard: true });
  const result = await api.fightCloud.write(user, bundle(100), meta);
  assert.match(result.warning, /permission-denied/);
  assert.equal(docs.get('fightWorldPlayers/one/saves/current').data, bundle(100));
  assert.equal(docs.has('fightWorldLeaderboard/one'), false);
});

test('automatically republishes a returning player from the existing cloud save', async () => {
  const { api, docs } = makeCloud();
  await api.fightCloud.write(user, bundle(350), meta);
  docs.delete('fightWorldLeaderboard/one');
  const saved = docs.get('fightWorldPlayers/one/saves/current');
  assert.equal(await api.fightCloud.publishPublic(user, saved.data), true);
  assert.equal(docs.get('fightWorldLeaderboard/one').score, 350);
  assert.equal(docs.get('fightWorldPlayers/one/saves/current'), saved);
});

test('older saves and a local reset cannot lower lifetime leaderboard totals', async () => {
  const { api, docs } = makeCloud();
  const earned = JSON.stringify({ profile: { name: 'Player One' }, stats: {
    score: 500, wins: 7, matches: 9, knockouts: 4, perfects: 2,
    bestStreak: 3, biggestCombo: 8, tournamentWins: 1, survivalBest: 5,
  } });
  const reset = JSON.stringify({ profile: { name: 'Player One' }, stats: {} });
  await api.fightCloud.write(user, earned, meta);
  await api.fightCloud.write(user, reset, meta);
  const row = docs.get('fightWorldLeaderboard/one');
  assert.deepEqual([row.score, row.wins, row.matches, row.kos, row.perfects, row.bestStreak, row.bestCombo, row.titles, row.survivalBest], [500, 7, 9, 4, 2, 3, 8, 1, 5]);
  assert.equal(docs.get('fightWorldPlayers/one/saves/current').data, reset);
});
