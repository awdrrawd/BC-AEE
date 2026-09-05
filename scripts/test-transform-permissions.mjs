import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const runtime = {itemColorItem: null};
const exports = {};
const context = vm.createContext({
  exports, DialogMenuMode: 'color', CharacterAppearanceMode: '',
  require: name => name === '@/core/runtime' ? {runtime} : {},
});
vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/core/bc.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, context);
function check(group, dynamic, expected, label) {
  runtime.itemColorItem = {Asset: {Group: group, DynamicAfterDraw: dynamic}};
  for (const layer of ['all', '0']) assert.equal(exports.isGroupLocked(layer), expected, label);
}
for (const name of ['ItemNeckAccessories', 'ItemPelvis', 'ItemTorso', 'CustomProp']) {
  for (const AllowNone of [true, false]) {
    check({Name: name, Category: 'Item', AllowNone}, true, false, `${name}: dynamic props remain editable`);
  }
}
check({Name: 'ModDecoration', Category: 'Appearance', AllowNone: true}, true, false, 'removable mod decoration');
check({Name: 'ModClothing', Category: 'Appearance', Clothing: true, AllowNone: false}, true, false, 'clothing');
for (const Name of ['BodyUpper', 'BodyLower', 'Nipples', 'Head']) {
  check({Name, Category: 'Appearance', AllowNone: true}, false, true, 'core body protection');
}
check({Name: 'HairFront', AllowNone: false}, false, false, 'existing hair exception');
check({Name: 'HairFront', AllowNone: false}, true, true, 'mandatory body dynamic restriction');
check({Name: 'OtherBody', AllowNone: false}, false, true, 'mandatory body restriction');
runtime.itemColorItem = null;
assert.equal(exports.isGroupLocked(), false);
console.log('Transform permission regression checks passed.');
