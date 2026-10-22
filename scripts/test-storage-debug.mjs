import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Values built inside a vm context have a different realm's prototypes, so compare them as JSON.
const same = (actual, expected) => assert.equal(JSON.stringify(actual), JSON.stringify(expected));

function load(file, dependencies, globals) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {exports, require: name => dependencies[name] ?? {}, ...globals});
  return exports;
}
function logger() {
  const lines = {log: [], warn: [], info: []};
  return {lines, console: {log: (...a) => lines.log.push(a), warn: (...a) => lines.warn.push(a), info: (...a) => lines.info.push(a), table: (...a) => lines.log.push(['table', ...a])}};
}
function fakeStorage(overrides = {}) {
  const data = new Map();
  return {data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), ...overrides};
}

// Normal use: strings and JSON round-trip, invalid or malformed JSON falls back.
{
  const localStorage = fakeStorage();
  const storage = load('src/core/storage.ts', {}, {localStorage, console: logger().console});
  assert.equal(storage.writeText('a', 'x'), true);
  assert.equal(storage.readText('a'), 'x');
  assert.equal(storage.readText('missing'), null);
  assert.equal(storage.writeJson('j', {n: 1}), true);
  same(storage.readJson('j', null), {n: 1});
  assert.equal(storage.readJson('missing', 'fallback'), 'fallback');
  localStorage.data.set('bad', '{oops');
  assert.equal(storage.readJson('bad', 'fallback'), 'fallback', 'malformed JSON uses the fallback');
  localStorage.data.set('shape', '[1]');
  assert.equal(storage.readJson('shape', 'fallback', value => !Array.isArray(value)), 'fallback', 'wrong shape uses the fallback');
  assert.equal(storage.removeKey('a'), true);
  assert.equal(storage.readText('a'), null);
  const circular = {};
  circular.self = circular;
  assert.equal(storage.writeJson('c', circular), false, 'unserialisable values report failure instead of throwing');
}

// Blocked or full storage never throws; a failed write warns once per key.
{
  const {lines, console} = logger();
  const storage = load('src/core/storage.ts', {}, {
    localStorage: fakeStorage({setItem() { throw new Error('QuotaExceededError'); }, getItem() { throw new Error('SecurityError'); }, removeItem() { throw new Error('SecurityError'); }}),
    console,
  });
  assert.equal(storage.readText('k'), null);
  assert.equal(storage.readJson('k', 7), 7);
  assert.equal(storage.writeText('k', 'v'), false);
  assert.equal(storage.writeJson('k', 1), false);
  assert.equal(storage.writeText('other', 'v'), false);
  assert.equal(storage.removeKey('k'), false);
  assert.equal(lines.warn.length, 2, 'one warning per failing key');
}
{
  // Reading the property itself can throw (sandboxed iframes), and some contexts have no storage at all.
  const {lines, console} = logger();
  const blocked = vm.createContext({console});
  Object.defineProperty(blocked, 'localStorage', {get() { throw new Error('SecurityError'); }});
  const run = globals => {
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(new URL('../src/core/storage.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
    vm.runInContext(`(function (exports, require) {${source}})`, globals)(exports, () => ({}));
    return exports;
  };
  const storage = run(blocked);
  assert.equal(storage.readText('k'), null);
  assert.equal(storage.writeText('k', 'v'), false);
  const absent = run(vm.createContext({console}));
  assert.equal(absent.writeJson('k', 1), false);
  assert.equal(absent.readJson('k', 'x'), 'x');
  assert.ok(lines.warn.length >= 1);
}

// Debug switch: off by default, persisted, gated log, ungated diagnostics.
{
  const localStorage = fakeStorage();
  const {lines, console} = logger();
  const globals = {localStorage, console, window: {Liko: {AEE: {}}}};
  const storage = load('src/core/storage.ts', {}, globals);
  const debug = load('src/core/debug.ts', {'@/core/storage': storage}, globals);
  assert.equal(debug.isDebugEnabled(), false);
  debug.debugLog('hidden');
  debug.diagLog('always');
  same(lines.log, [['[AEE]', 'always']]);
  debug.installDebugApi();
  assert.equal(globals.window.Liko.AEE.debug, debug.setDebug);
  assert.equal(globals.window.Liko.AEE.debug(true), true);
  assert.equal(localStorage.data.get('liko-aee-debug'), '1');
  debug.debugLog('shown', 1);
  same(lines.log.at(-1), ['[AEE]', 'shown', 1]);
  const reloaded = load('src/core/debug.ts', {'@/core/storage': storage}, globals);
  assert.equal(reloaded.isDebugEnabled(), true, 'the switch survives a reload');
  assert.equal(debug.setDebug(false), false);
  assert.equal(localStorage.data.has('liko-aee-debug'), false);
  const before = lines.log.length;
  debug.debugLog('hidden again');
  assert.equal(lines.log.length, before);
}
console.log('Storage and debug checks passed: safe reads/writes, JSON validation, warn-once, blocked storage and the persisted debug switch.');
