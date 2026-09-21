import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps, globals, extra = '') {
  const exports = {};
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8') + extra;
  const context = vm.createContext({exports, require: name => deps[name] ?? {}, ...globals});
  vm.runInContext(ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, context);
  return {exports, context};
}

const group = {Name: 'Cloth', Category: 'Appearance'};
const item = {Asset: {Group: group, Layer: [{AllowColorize: true}]}};
const character = {Appearance: [item], FocusGroup: null};
const colors = [], menus = [], previews = [];
const globals = {
  CharacterAppearanceSelection: character, CharacterAppearanceSelectedGroup: group,
  CharacterAppearanceMode: 'Cloth', Player: character, window: {},
  InventoryGet: () => item, CommonMemoize: fn => fn,
  AppearanceItemColor: (...args) => colors.push(args),
  AppearanceMenuBuild: (...args) => menus.push(args),
  AppearancePreviewBuild: (...args) => previews.push(args),
  document: {body: null, getElementById: () => null},
};
const picker = load('src/controllers/appearancePickerController.ts', {}, globals, '\nexport {openItemEditor};');
assert.equal(picker.exports.openItemEditor(group), true);
assert.deepEqual(colors.pop(), [character, item, group, 'Cloth'], 'picker passes the group object to R132');
assert.equal(character.FocusGroup, null, 'opening a color panel cannot leave stale dialog focus');

const draft = {layerManager: {open: true}};
const layers = load('src/controllers/layerManagerController.ts', {
  '@/core/store': {mutateState: fn => fn(draft)},
}, globals);
assert.equal(layers.exports.openLayerRowColor(character, {item, groupName: group.Name}), true);
assert.deepEqual(colors.pop(), [character, item, group, 'Cloth']);
assert.equal(draft.layerManager.open, false);

const copy = load('src/controllers/copyPasteController.ts', {}, globals, '\nexport {rebuildAppearanceMenu};');
copy.exports.rebuildAppearanceMenu();
assert.deepEqual(menus.pop(), [character, group], 'copy/paste refresh retains the selected clothing category');

const watchers = new Map();
const setting = key => ({get: () => false, set() {}, onChange: callback => watchers.set(key, callback)});
const settings = Object.fromEntries(['hoverHighlight', 'hoverHighlightChar', 'hoverOutlinePanel', 'hoverTryOn',
  'hairCharacterPreview', 'characterPreviewActive', 'enableCopyPaste', 'hideLscgLayers'].map(key => [key, setting(key)]));
const ui = load('src/controllers/uiController.ts', {
  '@/core/settings': {settings}, '@/core/bc': {getCurrentItem: () => null},
  '@/core/store': {getState: () => ({visible: false})},
}, globals);
ui.exports.installSettingEffects();
for (const key of ['hoverTryOn', 'hairCharacterPreview', 'characterPreviewActive']) {
  watchers.get(key)(true);
  assert.deepEqual(menus.pop(), [character, group], key);
}
assert.deepEqual(previews.pop(), [character, group, true], 'preview updates even when FocusGroup is null');
ui.context.CharacterAppearanceSelectedGroup = null;
watchers.get('characterPreviewActive')(false);
assert.equal(previews.length, 0, 'no preview build without a selected category');
console.log('R132 color entry points, selected-group menu updates and immediate preview refresh passed.');
