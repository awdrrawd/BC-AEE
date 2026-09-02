import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const self = {name: 'self'}, other = {name: 'other'};
const item = {Asset: {Group: {Name: 'ItemArms'}}};
const runtime = {itemColorChar: other, itemColorItem: item};
const hooks = new Map();
let invalidations = 0, refreshed = null;
const globals = {
  CharacterAppearanceSelection: self, CharacterAppearanceMode: '',
  DialogMenuMode: 'color', DialogFocusItem: null,
  CharacterGetCurrent: () => other,
  CharacterRefresh: character => { refreshed = character; },
  InventoryGet: () => item,
};
function load(file, dependencies) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const context = vm.createContext({...globals, exports, require: name => dependencies[name] ?? {}});
  vm.runInContext(ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, context);
  return {exports, context};
}
const bc = load('src/core/bc.ts', {'@/core/runtime': {runtime}});
assert.equal(bc.exports.getCurrentCharacter(), other, 'active ItemColor owner wins over stale wardrobe selection');
bc.exports.refreshCurrentCharacter();
assert.equal(refreshed, other, 'opening transform refreshes the edited character');
const drawing = load('src/hooks/drawingHooks.ts', {
  '@/core/runtime': {runtime},
  '@/core/bc': bc.exports,
  '@/modsdk': {default: {hookFunction: (name, priority, hook) => hooks.set(name, hook)}},
  '@/controllers/appearancePickerController': {invalidateAppearancePicker: () => invalidations++},
  '@/controllers/hideRestraintsController': {withRestraintsHidden: (character, draw) => draw()},
});
drawing.exports.installDrawingHooks();
hooks.get('CharacterLoadCanvas')([self], () => {});
assert.equal(invalidations, 0, 'unrelated self redraw must retain target captures');
hooks.get('CharacterLoadCanvas')([other], () => {});
assert.equal(invalidations, 1, 'target redraw clears outdated layers');
runtime.itemColorChar = null;
runtime.itemColorItem = null;
assert.equal(bc.exports.getCurrentCharacter(), self, 'wardrobe editing remains supported');
bc.context.DialogMenuMode = 'extended';
bc.context.DialogFocusItem = item;
assert.equal(bc.exports.getCurrentCharacter(), other, 'extended dialog retains its current character');
bc.context.DialogMenuMode = 'color';
runtime.itemColorChar = self;
runtime.itemColorItem = item;
assert.equal(bc.exports.getCurrentCharacter(), self, 'self ItemColor remains supported');
console.log('Editor character regression checks passed.');
