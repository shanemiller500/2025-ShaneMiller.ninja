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
const { startPadBridge, suspendPadBridge, padState } = require('./gamepad.ts');
test('Xbox buttons and stick map to documented combat actions', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  const pad = { connected: true, id: 'Xbox Controller', mapping: 'standard', buttons, axes: [0, 0] };
  const oldNavigator = global.navigator;
  Object.defineProperty(global, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  try {
    const input = new InputManager();
    for (const [button, action] of [[0, 'up'], [1, 'kick'], [2, 'lp'], [3, 'hp'], [5, 'special'], [7, 'block']]) {
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
    buttons[7].pressed = true;
    assert.equal(input.read(0).ult, true);
    assert.equal(input.read(0).block, false);
  } finally {
    Object.defineProperty(global, 'navigator', { configurable: true, value: oldNavigator });
  }
});

test('Bluetooth pad with an empty mapping retains standard-style D-pad and Menu buttons', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  const pad = { connected: true, id: 'Xbox Wireless Controller (Bluetooth)', mapping: '', buttons, axes: [0, 0, 0, 0] };
  buttons[0].pressed = true;
  buttons[12].pressed = true;
  buttons[9].pressed = true;
  const state = padState(pad);
  assert.equal(state.b[0], true, 'A stays A');
  assert.equal(state.b[12], true, 'D-pad up stays available');
  assert.equal(state.b[9], true, 'Menu stays available');
});

test('legacy Xbox HID hat and face buttons are normalized', () => {
  const buttons = Array.from({ length: 15 }, () => ({ pressed: false, value: 0 }));
  const pad = { connected: true, id: 'Xbox 045e', mapping: '', buttons, axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, -1] };
  buttons[3].pressed = true;
  buttons[11].pressed = true;
  const state = padState(pad);
  assert.equal(state.b[2], true, 'raw X is standard X');
  assert.equal(state.b[9], true, 'raw Menu is standard Menu');
  assert.equal(state.b[12], true, 'hat up is standard D-pad up');
  pad.axes[9] = 0;
  assert.equal(padState(pad).b[13], false, 'centred hat does not hold D-pad down');
});

test('connected Xbox pad drives title menu navigation and confirm through the bridge', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  const pad = { connected: true, id: 'Xbox Controller', mapping: 'standard', buttons, axes: [0, 0] };
  const old = Object.fromEntries(['navigator', 'window', 'document', 'KeyboardEvent', 'requestAnimationFrame', 'cancelAnimationFrame'].map((k) => [k, global[k]]));
  const events = [];
  let screen = 'title';
  let nextFrame;
  const listeners = new Map();
  Object.defineProperty(global, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  global.window = { addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: (type) => listeners.delete(type) };
  global.document = { hidden: false, querySelectorAll: () => [], querySelector: (selector) => selector === `[data-pad-${screen}]` ? {} : null, body: { dispatchEvent: (e) => events.push([e.type, e.code]) } };
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
    assert.equal(new InputManager().read(0).up, true);
    resumeBridge();
    buttons[0].pressed = false;
    nextFrame(240);
    buttons[0].pressed = true;
    nextFrame(260);
    assert.equal(events.filter(([type, code]) => type === 'keydown' && code === 'Enter').length, enterCount + 1);
    screen = 'select';
    buttons[4].pressed = true;
    nextFrame(280);
    assert.ok(events.some(([type, code]) => type === 'keydown' && code === 'KeyQ'));
    buttons[4].pressed = false;
    nextFrame(300);
    buttons[5].pressed = true;
    nextFrame(320);
    assert.ok(events.some(([type, code]) => type === 'keydown' && code === 'KeyE'));
    buttons[5].pressed = false;
    nextFrame(340);
    screen = 'world';
    buttons[11].pressed = true;
    nextFrame(360);
    assert.ok(events.some(([type, code]) => type === 'keydown' && code === 'KeyR'));
  } finally {
    stop?.();
    for (const [k, v] of Object.entries(old)) Object.defineProperty(global, k, { configurable: true, writable: true, value: v });
  }
});
