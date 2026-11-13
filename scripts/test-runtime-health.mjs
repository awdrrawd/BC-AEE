import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
  }).outputText, {exports, require: name => deps[name] ?? {}, ...globals});
  return exports;
}

const {createExternalStore} = load('src/core/externalStore.ts');
const initial = {count: 0, value: NaN, nested: {open: false}};
const store = createExternalStore(initial);
let notifications = 0;
const unsubscribe = store.subscribe(() => notifications++);
store.setState(initial);
store.setState(current => current);
store.patchState({});
store.patchState({count: 0, value: NaN, nested: initial.nested});
assert.equal(notifications, 0, 'unchanged state must not notify subscribers');
assert.equal(store.getState(), initial, 'no-op patches preserve the React snapshot');
store.patchState({count: 1});
assert.equal(notifications, 1);
assert.equal(store.getState().nested, initial.nested);
store.setState(current => ({...current}));
assert.equal(notifications, 2, 'explicit refresh still notifies for in-place BC changes and language changes');
store.patchState({count: -0});
store.patchState({count: 0});
assert.equal(notifications, 4, 'Object.is distinguishes signed zero');
unsubscribe();
store.patchState({count: 2});
assert.equal(notifications, 4);

const slots = load('src/components/mask-system/freeDraw/slots.ts', {
  '../constants': {SLOT_COUNT: 0}, '../masking': {bustMaskTexture() {}},
}, {document: {createElement: () => ({getContext: () => ({})})}});
let encodes = 0;
let pixels = 'first';
const slot = {canvas: {toDataURL: () => { encodes++; return pixels; }}};
const sizes = load('src/components/mask-system/freeDraw/appearanceSize.ts', {}, {
  LZString: {compressToBase64: text => `compressed:${text}`},
});
for (let i = 0; i < 100; i++) assert.equal(sizes.slotEmbeddedData(slot), 'compressed:first');
assert.equal(encodes, 1, 'unchanged drawing estimates encode only once');
pixels = 'edited';
slots.invalidateSlot(slot);
assert.equal(sizes.slotEmbeddedData(slot), 'compressed:edited');
assert.equal(encodes, 2, 'edits invalidate the encoded drawing');
pixels = 'save';
assert.equal(sizes.canvasEmbeddedData(slot.canvas), 'compressed:save', 'saving always encodes current pixels');
slots.invalidateSlot(slot);
slot.canvas.toDataURL = () => { throw new Error('tainted'); };
assert.throws(() => sizes.slotEmbeddedData(slot), /tainted/);
assert.equal(slot._embeddedData, undefined, 'failed encodes cannot populate the cache');

const effects = [];
let updates = 0;
let poll;
let cleared = false;
let activeSession = null;
const active = {getActiveSession: () => activeSession};
const panel = load('src/components/free-draw/FreeDrawLibraryPanel.tsx', {
  react: {
    useCallback: fn => fn,
    useEffect: fn => effects.push(fn),
    useState: initial => [initial, () => updates++],
    useSyncExternalStore: (_, snapshot) => snapshot(),
  },
  '@/components/mask-system/freeDraw/slots': active,
  '@/components/mask-system/freeDraw/editorState': {State: {useSps: false}},
  '@/components/mask-system/freeDraw/appearanceSize': {projectedAppearanceBytes: () => 100},
}, {
  document: {getElementById: () => null},
  window: {setInterval: fn => { poll = fn; return 1; }, clearInterval: () => { cleared = true; }},
});
assert.equal(panel.FreeDrawLibraryPanel(), null);
assert.equal(effects[0](), undefined);
assert.equal(poll, undefined, 'closed editor must not start a polling timer');
assert.equal(updates, 0, 'closed panel must not schedule React updates');
activeSession = {slot, hasDrawing: false};
panel.FreeDrawLibraryPanel();
const cleanup = effects[2]();
poll();
assert.ok(updates > 0, 'open editor still measures appearance size');
cleanup();
assert.equal(cleared, true);
activeSession = null;
poll = undefined;
panel.FreeDrawLibraryPanel();
assert.equal(effects[4](), undefined);
assert.equal(poll, undefined, 'closing the editor leaves no timer');
console.log('Runtime health: no-op stores, drawing encoding invalidation and idle panel updates passed.');
