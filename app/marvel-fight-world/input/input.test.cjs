const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const { InputManager } = require('./input.ts');
const { startPadBridge, suspendPadBridge } = require('./gamepad.ts');
test('original Xbox buttons and stick map to combat actions', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  const pad = { connected: true, buttons, axes: [0, 0] };
  const oldNavigator = global.navigator;
  Object.defineProperty(global, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  try {
    const input = new InputManager();
    for (const [button, action] of [[0, 'kick'], [1, 'special'], [2, 'lp'], [3, 'hp'], [4, 'block'], [5, 'ult']]) {
      buttons[button].pressed = true;
      assert.equal(input.read(0)[action], true, `button ${button} -> ${action}`);
      buttons[button].pressed = false;
    }
    pad.axes = [-0.8, 0.8];
    assert.equal(input.read(0).left, true);
    assert.equal(input.read(0).down, true);
    pad.axes = [0, 0];
    buttons[6].pressed = true;
    assert.equal(input.read(0).block, true);
    buttons[6].pressed = false;
    buttons[7].pressed = true;
    assert.equal(input.read(0).ult, true);
  } finally {
    Object.defineProperty(global, 'navigator', { configurable: true, value: oldNavigator });
  }
});

test('connected Xbox pad drives title menu navigation and confirm through the bridge', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  const pad = { connected: true, id: 'Xbox Controller', buttons, axes: [0, 0] };
  const old = Object.fromEntries(['navigator', 'window', 'document', 'KeyboardEvent', 'requestAnimationFrame', 'cancelAnimationFrame'].map((k) => [k, global[k]]));
  const events = [];
  let nextFrame;
  const listeners = new Map();
  Object.defineProperty(global, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  global.window = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type) => listeners.delete(type) };
  global.document = { hidden: false, querySelectorAll: () => [], body: { dispatchEvent: (e) => events.push([e.type, e.code]) } };
  global.KeyboardEvent = class { constructor(type, init) { this.type = type; this.code = init.code; } };
  global.requestAnimationFrame = (fn) => { nextFrame = fn; return 1; };
  global.cancelAnimationFrame = () => {};
  let connected = '';
  let stop;
  try {
    stop = startPadBridge({ onConnect: (name) => connected = name });
    buttons[13].pressed = true;
    nextFrame(100);
    assert.equal(connected, 'Xbox controller');
    assert.ok(events.some(([type, code]) => type === 'keydown' && code === 'ArrowDown'));
    buttons[13].pressed = false;
    nextFrame(120);
    buttons[0].pressed = true;
    nextFrame(140);
    assert.ok(events.some(([type, code]) => type === 'keydown' && code === 'Enter'));
    buttons[0].pressed = false;
    nextFrame(160);
    buttons[1].pressed = true;
    nextFrame(180);
    assert.ok(events.some(([type, code]) => type === 'keydown' && code === 'Escape'));
    buttons[1].pressed = false;
    nextFrame(200);
    const enterCount = events.filter(([type, code]) => type === 'keydown' && code === 'Enter').length;
    const resumeBridge = suspendPadBridge();
    buttons[0].pressed = true;
    nextFrame(220);
    assert.equal(events.filter(([type, code]) => type === 'keydown' && code === 'Enter').length, enterCount);
    assert.equal(new InputManager().read(0).kick, true);
    resumeBridge();
    buttons[0].pressed = false;
    nextFrame(240);
    buttons[0].pressed = true;
    nextFrame(260);
    assert.equal(events.filter(([type, code]) => type === 'keydown' && code === 'Enter').length, enterCount + 1);
  } finally {
    stop?.();
    for (const [k, v] of Object.entries(old)) Object.defineProperty(global, k, { configurable: true, writable: true, value: v });
  }
});
