import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps = {}, globals = {}, extra = '') {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {exports, require: name => deps[name] ?? {}, ...globals});
  return exports;
}
const bc = load('src/core/bc.ts', {'@/util/math': {clamp: (v, min, max) => Math.min(max, Math.max(min, v))}});
const manager = load('src/controllers/layerManagerController.ts', {'@/core/bc': bc});
const asset = {Name: 'Example', Group: {Name: 'Cloth'}, Layer: []};
asset.Layer = ['Front', 'Disabled', 'Transparent', 'DefaultZero', null].map((Name, i) =>
  ({Name, Asset: asset, Priority: i, Opacity: Name === 'DefaultZero' ? 0 : 1, MinOpacity: 0, MaxOpacity: 1}));
const item = {Asset: asset, Property: {Opacity: [1, 1, 0, undefined, 1], OverridePriority: {'': 12}}};
const character = {Appearance: [item], AppearanceLayers: asset.Layer.filter(l => l.Name !== 'Disabled').map(l => ({...l}))};
const rows = () => manager.buildLayerRows(character);
assert.deepEqual(Array.from(rows(), r => r.effectiveKey), ['Front', '']);
assert.equal(rows()[1].priority, 12);
assert.equal(rows()[1].layerIndex, 4, 'filtering must retain the original physical index');
item.Property.Opacity = 0;
assert.equal(bc.getOpacity(item, 'all'), 0, 'whole-item numeric opacity is shown accurately');
assert.equal(rows().length, 0);
item.Property.Opacity = 0.5;
assert.equal(bc.getOpacity(item, 'all'), 0.5);
assert.equal(rows().length, 4, 'numeric property overrides asset defaults');
delete item.Property.Opacity;
assert.equal(bc.getOpacity(item, '3'), 0, 'native layer defaults are shown accurately');
assert.equal(bc.getOpacity(item, 'all'), null, 'different layer defaults are mixed');
item.Property.Opacity = [0.25];
assert.equal(bc.getOpacity(item, '4'), 0.25, 'short opacity arrays use the native slot-zero fallback');
character.AppearanceLayers = [];
assert.equal(rows().length, 0, 'an empty native draw list means no enabled layers');

const runtime = {};
const hooks = new Map();
load('src/hooks/renderHooks.ts', {
  '@/core/runtime': {runtime}, '@/modsdk': {default: {hookFunction: (name, _, hook) => hooks.set(name, hook)}},
}, {window: {}}).installRenderHooks();
hooks.get('CommonDrawResolveLayerColor')([character, item, {...asset.Layer[4]}], () => {});
assert.equal(runtime.currentDrawLayerIndex, 4, 'R132 copied unnamed layers retain their index');

let outline = true;
const state = {visible: false, layerManager: {open: true}};
runtime.currentRenderChar = character;
const picker = load('src/controllers/appearancePickerController.ts', {
  '@/core/runtime': {runtime}, '@/core/store': {getState: () => state},
  '@/core/bc': {getCurrentCharacter: () => character},
  '@/core/settings': {settings: {hoverOutlinePanel: {get: () => outline}, appearancePick: {get: () => false}}},
}, {CurrentScreen: 'Appearance', CharacterAppearanceSelection: character, CharacterAppearanceMode: '',
  DialogFocusItem: null, CharacterLoadCanvas() {}}, '\nexport function managerImages() { return managerFrame; }');
picker.setLayerManagerHover(item, 4);
picker.captureAppearanceImage('custom.png', 0, 0, {Alpha: 1});
assert.equal(picker.managerImages().length, 1, 'manager outlines work while the part editor is closed');
runtime.currentDrawLayerIndex = 0;
picker.captureAppearanceImage('custom.png', 0, 0, {Alpha: 1});
assert.equal(picker.managerImages().length, 1, 'other parts cannot contaminate the outline');
runtime.currentDrawLayerIndex = 4;
picker.captureAppearanceImage('custom.png', 0, 0, {Alpha: 0});
assert.equal(picker.managerImages().length, 1, 'transparent flashes preserve the last visible capture');
picker.setLayerManagerHover(null);
assert.equal(picker.managerImages().length, 0);
outline = false;
picker.setLayerManagerHover(item, 4);
picker.captureAppearanceImage('custom.png', 0, 0, {Alpha: 1});
assert.equal(picker.managerImages().length, 0, 'disabled outline does not capture');
console.log('Layer manager visibility, R132 layer identity and scoped hover captures passed.');
