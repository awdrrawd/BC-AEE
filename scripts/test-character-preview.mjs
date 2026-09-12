import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies, globals = {}) {
  const exports = {};
  const context = vm.createContext({exports, require: name => dependencies[name] ?? {}, ...globals});
  vm.runInContext(ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, context);
  return {exports, context};
}

const storage = new Map();
const globals = {localStorage: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
}};
function loadSettings(player) {
  return load('src/core/settings.ts', {}, {...globals, Player: player}).exports.settings;
}
const settings = loadSettings(null);
settings.hairCharacterPreview.set(true);
settings.characterPreviewActive.set(false);
settings.hoverTryOnClothingEnabled.set(true);
settings.hoverTryOnItemEnabled.set(false);
// Account data cannot override local preferences, even across a full reload.
for (const saved of [{}, {characterPreviewActive: true, hoverTryOnItemEnabled: true}]) {
  const reloaded = loadSettings({ExtensionSettings: {AEE: saved}});
  assert.equal(reloaded.hairCharacterPreview.get(), true);
  assert.equal(reloaded.characterPreviewActive.get(), false);
  assert.equal(reloaded.hoverTryOnClothingEnabled.get(), true);
  assert.equal(reloaded.hoverTryOnItemEnabled.get(), false);
}

const controller = load('src/controllers/uiController.ts', {
  '@/core/settings': {settings}, '@/core/runtime': {runtime: {}},
}).exports;
controller.toggleCharacterPreviewActive();
assert.equal(loadSettings(null).characterPreviewActive.get(), true);
settings.hoverTryOn.set(true);
controller.toggleHoverTryOn('item');
assert.equal(controller.isHoverTryOnEnabled('item'), true);
assert.equal(loadSettings(null).hoverTryOnItemEnabled.get(), true);
controller.toggleHoverTryOn('clothing');
assert.equal(controller.isHoverTryOnEnabled('clothing'), false);
assert.equal(loadSettings(null).hoverTryOnClothingEnabled.get(), false);
settings.hoverTryOn.set(false);
assert.equal(controller.isHoverTryOnEnabled('item'), false);
const hooks = new Map();
const menu = load('src/hooks/menuHooks.ts', {
  '@/modsdk': {default: {hookFunction: (name, priority, callback) => hooks.set(name, callback)}},
  '@/core/settings': {settings},
}, {document: {addEventListener() {}}});
menu.exports.installMenuHooks();

const preview = hooks.get('AppearancePreviewUseCharacter');
const clothing = {Name: 'Cloth', Category: 'Appearance', Clothing: true, PreviewZone: {}};
for (const native of [false, true]) {
  for (const state of [false, true]) {
    settings.characterPreviewActive.set(state);
    assert.equal(preview([clothing], () => native), state, 'AEE must own both preview states');
  }
  settings.characterPreviewActive.set(false);
  assert.equal(preview([{...clothing, Name: 'HairFront'}], () => native), true);
  assert.equal(preview([{...clothing, PreviewZone: undefined}], () => native), native);
  assert.equal(preview([null], () => native), native);
  assert.equal(preview([{...clothing, Category: 'Item', Clothing: false}], () => native), native);
  settings.hairCharacterPreview.set(false);
  assert.equal(preview([clothing], () => native), native, 'disabled replacement must respect BC');
  settings.hairCharacterPreview.set(true);
}
console.log('Character preview account and toggle regression checks passed.');
