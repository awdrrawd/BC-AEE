import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let mode = 'all', enabled = false, freeDraw = false;
const groups = ['Cloth', 'SingleGloveFX', 'ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3'].map(Name => ({Name}));
const exports = {};
const deps = {
  '@/core/store': {getState: () => ({partsFilterMode: mode})},
  '@/controllers/copyPasteController': {isAppearanceOverlayActive: () => false},
  '@/components/mask-system/access': {canUseAeeGroup: (_, group) => group === 'Cloth' || enabled && (group === 'SingleGloveFX' || freeDraw)},
};
const context = vm.createContext({exports, require: key => deps[key] ?? {},
  CharacterAppearanceSelection: {}, CharacterAppearanceMode: '', CharacterAppearanceGroups: groups,
  CharacterAppearanceOffset: 4, InventoryGet: (_, group) => group === 'ItemCanvas3' ? null : {},
});
vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/controllers/partsFilterController.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, context);
const visible = () => exports.withFilteredGroups(() => Array.from(context.CharacterAppearanceGroups, group => group.Name));
assert.deepEqual(visible(), ['Cloth']);
assert.equal(context.CharacterAppearanceOffset, 0);
assert.equal(context.CharacterAppearanceGroups, groups, 'original list restored after drawing or clicking');
enabled = true;
assert.deepEqual(visible(), ['Cloth', 'SingleGloveFX']);
freeDraw = true;
assert.deepEqual(visible(), groups.map(group => group.Name));
mode = 'has';
assert.deepEqual(visible(), ['Cloth', 'SingleGloveFX', 'ItemCanvas1', 'ItemCanvas2']);
mode = 'empty';
assert.deepEqual(visible(), ['ItemCanvas3']);
enabled = false;
assert.deepEqual(visible(), []);
assert.throws(() => exports.withFilteredGroups(() => { throw Error('render'); }));
assert.equal(context.CharacterAppearanceGroups, groups);
console.log('Custom group visibility and shared drawing/click filtering passed.');
