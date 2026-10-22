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
const { evenSplit } = require(path.join(__dirname, '..', 'app', 'dinosors', 'sim', 'duties.ts'));

const people = (roles) => roles.map((role, id) => ({ id, role }));

test('split evenly: everyone shared out across every job, the counts never more than one apart', () => {
  const roles = ['gatherer', 'builder', 'hunter', 'guard', 'cook', 'farmer', 'smith'];
  const ps = people(Array(100).fill('guard'));
  const moves = evenSplit(ps, roles);
  for (const [h, r] of moves) h.role = r;
  const count = (r) => ps.filter((h) => h.role === r).length;
  const counts = roles.map(count);
  assert.equal(counts.reduce((a, b) => a + b, 0), 100, 'everyone has a job');
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `even: ${counts}`);
  assert.equal(moves.size, 100 - count('guard'), 'only the extra guards were moved (the rest stay on guard)');
});

test('people already in a job keep it while it has room', () => {
  const roles = ['gatherer', 'builder', 'hunter'];
  const ps = people(['builder', 'builder', 'hunter', 'auto', 'auto', 'auto']);
  const moves = evenSplit(ps, roles);
  assert.ok(!moves.has(ps[0]) && !moves.has(ps[1]) && !moves.has(ps[2]), 'the builders + the hunter stay put');
  for (const [h, r] of moves) h.role = r;
  assert.deepEqual(roles.map((r) => ps.filter((h) => h.role === r).length), [2, 2, 2]);
});
