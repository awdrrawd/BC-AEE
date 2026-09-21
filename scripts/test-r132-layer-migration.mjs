import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const plain = value => JSON.parse(JSON.stringify(value));
function load(file, globals) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {exports, ...globals});
  return exports;
}
const character = {AssetFamily: 'Female3DCG', DrawPose: ['Kneel']};
let asset = {Name: 'Example', Group: {Name: 'Cloth'}, Layer: [{Name: null, DrawingLeft: 10, DrawingTop: 20}]};
const runtime = {};
const window = {Layering: {UpdateProperty(item, key, value, layer) {
  // The actual R132 helper branches on truthiness; an empty key would corrupt
  // the whole-item transform if AEE forwarded it here.
  if (layer) (item.Property[`Layer${key}`] ??= {})[layer] = value;
  else item.Property[key] = value;
}}};
const bc = load('src/core/bc.ts', {
  require: name => name === '@/core/runtime' ? {runtime} : {clamp: (v, min, max) => Math.min(max, Math.max(min, v))},
  window, DialogMenuMode: '', CharacterAppearanceMode: '', CharacterAppearanceSelection: character,
  CharacterRefresh() {},
});
for (const withApi of [true, false]) {
  const api = window.Layering;
  if (!withApi) delete window.Layering;
  const item = {Asset: asset, Property: {TranslationX: 7, ScaleX: 1.3, Rotation: 9}};
  for (const [key, value, native, expected] of [
    ['DrawingLeft', {'': 35}, 'TranslationX', 25], ['DrawingTop', {'': 14}, 'TranslationY', -6],
    ['ScaleX', 1.5, 'ScaleX', 1.5], ['ScaleY', 0.8, 'ScaleY', 0.8], ['Rotation', 30, 'Rotation', 30],
  ]) {
    bc.setLayerOverride(item, '0', key, value);
    assert.equal(item.Property[`Layer${native}`][''], expected);
    assert.deepEqual(plain(bc.getLayerOverride(item, '0')[key]), value);
  }
  assert.equal(item.Property.TranslationX, 7);
  assert.equal(item.Property.ScaleX, 1.3);
  assert.equal(item.Property.Rotation, 9);
  bc.setLayerOverride(item, 'all', 'Rotation', 40);
  assert.equal(item.Property.Rotation, 40);
  assert.equal(item.Property.LayerRotation[''], 30);
  window.Layering = api;
}
const migration = load('src/core/wardrobeMigration.ts', {
  require: () => ({wardrobeMutation: async (_, fn) => fn(), wardrobeIdentity: () => () => true}),
  CommonCloneDeep: structuredClone, AssetGet: () => asset, PoseType: {DEFAULT: ''}, CanvasUpperOverflow: 100,
  PropertyLayerOrigin: {getOriginal: () => ({'': 0})},
  CommonDrawComputeDrawingCoordinates: c => {assert.deepEqual(plain(c.DrawPose), []); return {X: 10, Y: 120};},
  console,
});
const fields = ['LayerTranslationX', 'LayerTranslationY', 'LayerScaleX', 'LayerScaleY', 'LayerRotation'];
let outfit;
const source = {size: () => 1, outfitAt: () => outfit, nameAt: () => 'Test', writeSlot: (_, v) => {outfit = v;}, persist: async () => true};
function scan(property) {
  outfit = [{Group: 'Cloth', Name: 'Example', Property: structuredClone(property)}];
  const original = structuredClone(outfit);
  const result = migration.scanWardrobeMigration(source, character);
  assert.deepEqual(outfit, original, 'scan does not mutate saved outfits');
  return result;
}
const maps = Object.fromEntries(fields.map((key, i) => [key, {Example: i + 1}]));
let plan = scan({...maps, TranslationX: 12});
assert.equal(plan.length, 1);
assert.equal(plan[0].parts[0].layers, 1);
for (let i = 0; i < fields.length; i++) assert.deepEqual(plain(plan[0].after[0].Property[fields[i]]), {'': i + 1});
assert.equal(plan[0].after[0].Property.TranslationX, 12);
assert.deepEqual(plain(migration.buildWardrobeMigrationOutfit(plan[0], character, () => false)), outfit);
assert.equal(await migration.applyWardrobeMigration(source, plan), true);
assert.equal(migration.scanWardrobeMigration(source, character).length, 0, 'idempotent');
plan = scan({TranslationX: 5, Rotation: 5, LayerOverrides: [{DrawingLeft: {'': 50}, ScaleX: 1.5, Rotation: 25, SkewX: 7}]});
assert.equal(plan[0].parts[0].layers, 1);
let prop = plan[0].after[0].Property;
assert.equal(prop.LayerTranslationX[''], 15);
assert.equal(prop.LayerScaleX[''], 1.5);
assert.equal(prop.LayerRotation[''], 20);
assert.equal(prop.LayerOverrides[0].SkewX, 7);
assert.equal(prop.LayerOverrides[0].DrawingLeft, undefined);
plan = scan({LayerTranslationX: {Example: 11}, LayerOverrides: [{DrawingLeft: 50, ScaleY: 1.7}]});
prop = plan[0].after[0].Property;
assert.equal(prop.LayerTranslationX[''], 11, 'native map takes precedence over legacy override');
assert.equal(prop.LayerScaleY[''], 1.7);
assert.equal(plan[0].parts[0].layers, 1);
plan = scan({LayerTranslationX: {Example: 11, '': 22}, LayerScaleX: {Example: 1.5}});
assert.equal(plan[0].parts[0].conflict, true);
assert.deepEqual(plain(plan[0].after), outfit, 'conflicting item is entirely unchanged');
const originalAsset = asset;
asset = {...asset, Layer: [...asset.Layer, {Name: 'Example'}]};
plan = scan(maps);
assert.equal(plan[0].parts[0].conflict, true);
asset = {...asset, Layer: [{Name: 'Example'}]};
assert.equal(scan(maps).length, 0, 'real named layer is not renamed');
asset = null;
plan = scan(maps);
assert.equal(plan[0].parts[0].conflict, true);
plan = scan({LayerOverrides: [{DrawingLeft: 30}]});
assert.equal(plan[0].parts[0].conflict, true, 'missing legacy asset is reported');
asset = originalAsset;
assert.equal(scan({LayerTranslationX: {'': 10}, TranslationX: 5}).length, 0);
plan = scan(maps);
outfit[0].Property.TranslationY = 99;
assert.equal(await migration.applyWardrobeMigration(source, plan), false, 'stale plan must not overwrite subsequent edits');
plan = scan(maps);
const before = structuredClone(outfit);
source.persist = async () => false;
assert.equal(await migration.applyWardrobeMigration(source, plan), false);
assert.deepEqual(outfit, before, 'failed persistence restores originals');
console.log('R132 unnamed layer editing, migrations, conflicts, idempotence and persistence checks passed.');
