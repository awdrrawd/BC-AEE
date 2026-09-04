import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = fs.readFileSync(new URL('../src/hooks/menuHooks.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports, require: () => ({})});
const inject = exports.injectClothingPreviewButtons;

const self = ['Use', 'WearRandom', 'Naked', 'Cancel', 'Accept'];
inject(self, true, false);
assert.deepEqual([...self], ['AEE_HoverTryOn', 'Use', 'WearRandom', 'Naked', 'Cancel', 'Accept']);

const other = ['Use', 'Naked', 'ColorChange', 'Cancel', 'Accept'];
inject(other, true, false);
assert.deepEqual([...other], ['AEE_HoverTryOn', 'Use', 'Naked', 'ColorChange', 'Cancel', 'Accept']);

const both = ['Use', 'Naked', 'Cancel', 'Accept'];
inject(both, true, true);
assert.deepEqual([...both], ['AEE_HoverTryOn', 'AEE_CharacterPreview', 'Use', 'Naked', 'Cancel', 'Accept']);
inject(both, true, true);
assert.equal(both.filter(value => value === 'AEE_HoverTryOn').length, 1);
assert.equal(both.filter(value => value === 'AEE_CharacterPreview').length, 1);

const previewOnly = ['WearRandom', 'Cancel', 'Accept'];
inject(previewOnly, false, true);
assert.deepEqual([...previewOnly], ['AEE_CharacterPreview', 'WearRandom', 'Cancel', 'Accept']);

console.log('Clothing hover menu regression checks passed.');
