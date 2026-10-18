import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// R133's colour-screen Cancel only restores Color/Opacity. AEE edits other
// Property fields while the screen is open, so it restores the whole item from
// the load-time backup itself (what R132's BC did).
const source = ts.transpileModule(
  fs.readFileSync(new URL('../src/core/itemColorCancel.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText;
const exports = {};
vm.runInContext(source, vm.createContext({exports, Object}));
const {restoreItemFromColorBackup} = exports;

// BC's AppearanceItemParse: JSON.parse, turning "Asset" strings back into assets.
const asset = {Name: 'Cuffs'};
const parse = text => JSON.parse(text, (key, value) => key === 'Asset' ? asset : value);
const backupOf = item => JSON.stringify({...item, Asset: 'A/B/C'});

// Edited properties and colours are rolled back; the live item object is kept.
{
  const item = {Asset: asset, Color: ['#111111'], Property: {LayerOverrides: {0: {Opacity: 1}}, OverridePriority: 5}};
  const backup = backupOf({Color: ['#111111'], Property: {OverridePriority: 1}});
  const original = item;
  item.Color = ['#ffffff'];
  item.Property.LayerOverrides[0].Opacity = 0.2;
  restoreItemFromColorBackup(item, backup, parse);
  assert.equal(item, original, 'restored in place, not replaced');
  assert.deepEqual(item.Color, ['#111111']);
  assert.deepEqual(item.Property, {OverridePriority: 1}, 'AEE edits removed from Property');
  assert.equal(item.Asset, asset);
}

// The backup is taken before BC sanitises the item: no Property then means "no edits".
{
  const item = {Asset: asset, Color: ['#111111'], Property: {LayerOverrides: {0: {Opacity: 0.5}}}};
  restoreItemFromColorBackup(item, backupOf({Color: ['#111111']}), parse);
  // (object created inside the vm realm, so compare by value rather than prototype)
  assert.equal(JSON.stringify(item.Property), '{}', 'Property reset to {} (R133 cancel writes Property.Opacity)');
}

// Idempotent: harmless on R132 where BC restores the same backup right after.
{
  const item = {Asset: asset, Color: ['#abcdef'], Property: {OverridePriority: 9}};
  const backup = backupOf({Color: ['#111111'], Property: {OverridePriority: 1}});
  restoreItemFromColorBackup(item, backup, parse);
  const once = JSON.stringify(item);
  restoreItemFromColorBackup(item, backup, parse);
  assert.equal(JSON.stringify(item), once);
}

console.log('Colour-screen Cancel restores the whole item (R133) without changing R132 behaviour.');
