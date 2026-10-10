const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return resolve.call(this, request.startsWith('@/') ? path.join(__dirname, '..', request.slice(2)) : request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const { Engine } = require(path.join(__dirname, '..', 'app', 'dinosors', 'game', 'engine.ts'));
const person = (id, role = 'auto', extra = {}) => ({ id, role, autoRole: 'gatherer', child: false, stranger: false, captive: false, under: false, state: 'idle', x: id * 10, y: 0, taskId: 0, taskStep: 0, site: '', order: null, wantTop: false, think: 1, task: null, ...extra });

test('bulk jobs set an exact manual count and release old work', () => {
  const oldTask = { people: [2, 9] };
  const people = [person(1, 'builder'), person(2, 'auto', { state: 'smith', taskId: 7, order: { kind: 'guard', x: 1, y: 2 } }), person(3, 'gatherer', { carry: 'stick', carryN: 2 }), person(4, 'auto', { child: true }), person(5, 'auto', { under: true }), person(6, 'auto', { state: 'down' })];
  const engine = Object.create(Engine.prototype);
  engine.world = { humans: people, mine: { pending: new Map() }, tasks: { get: (id) => id === 7 ? oldTask : null }, colony: { scorpions: [] }, camp: { stock: { stick: 0 } }, toast: () => {} };
  assert.equal(engine.setRoleCount('miner', 2), 2);
  assert.deepEqual(people.filter((h) => h.role === 'miner').map((h) => h.id), [2, 3]);
  assert.deepEqual(oldTask.people, [9]);
  assert.equal(people[1].taskId, 0);
  assert.equal(people[1].order, null);
  assert.equal(people[1].state, 'idle');
  assert.equal(engine.world.camp.stock.stick, 2, 'carried supplies return to stock');
  assert.equal(engine.setAllRoles('builder'), 3);
  assert.deepEqual(people.slice(0, 3).map((h) => h.role), ['builder', 'builder', 'builder']);
  assert.equal(engine.setRoleCount('builder', 1), 1);
  assert.deepEqual(people.slice(0, 3).map((h) => h.role), ['builder', 'auto', 'auto']);
  assert.deepEqual(people.slice(3).map((h) => h.role), ['auto', 'auto', 'auto'], 'children, underground and down people stay untouched');
  assert.equal(engine.setRoleCount('auto', 1), 1);
  assert.equal(people.slice(0, 3).filter((h) => h.role === 'auto').length, 1);
});


