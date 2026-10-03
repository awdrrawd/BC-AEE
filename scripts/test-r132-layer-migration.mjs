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
  outfit = [{Group: asset?.Group.Name ?? 'Cloth', Name: asset?.Name ?? 'Example', Property: structuredClone(property)}];
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
// User's Luzi eyes: five layers at 355 degrees on the left and 5 on the
// right. BC clamps native rotation instead of wrapping the legacy angle.
asset = {...originalAsset, Layer: Array.from({length: 5}, (_, i) => ({Name: `Eye${i}`}))};
for (const [legacy, expected] of [[355, -5], [5, 5], [-355, 5], [715, -5], [360, 0]]) {
  const eye = scan({LayerOverrides: Array.from({length: 5}, () => ({Rotation: legacy, Opacity: 1}))});
  const migrated = eye[0].after[0].Property;
  for (let i = 0; i < 5; i++) {
    const native = Math.max(-180, Math.min(180, migrated.LayerRotation[`Eye${i}`]));
    assert.equal(native, expected);
    assert.ok(Math.abs(Math.sin(native * Math.PI / 180) - Math.sin(legacy * Math.PI / 180)) < 1e-10);
    assert.ok(Math.abs(Math.cos(native * Math.PI / 180) - Math.cos(legacy * Math.PI / 180)) < 1e-10);
    assert.equal(migrated.LayerOverrides[i].Rotation, undefined);
    assert.equal(migrated.LayerOverrides[i].Opacity, 1);
  }
}
asset = originalAsset;
// The same rotation path handles every group, not only the user's eyes.
// Exercise named/unnamed layers, item-level rotation and angles on both sides
// of the native clamp boundary. Compare the rendered direction, not just data.
for (const group of ['Cloth', 'ClothLower', 'HairFront', 'HairBack', 'Hat', 'Gloves', 'Shoes', 'ItemNeckAccessories', 'CustomAccessory']) {
  for (const layerName of [null, 'Front']) {
    asset = {...originalAsset, Group: {Name: group}, Layer: [{Name: layerName}]};
    for (const itemRotation of [-30, 0, 45]) {
      for (const rotation of [-715, -355, -181, -180, 5, 180, 181, 270, 355, 360, 715]) {
        const plan = scan({Rotation: itemRotation, LayerOverrides: [{Rotation: rotation}]});
        const property = plan[0].after[0].Property;
        const rendered = Math.max(-180, Math.min(180, property.Rotation + property.LayerRotation[layerName ?? '']));
        const label = `${group}/${layerName ?? '(unnamed)'}: ${rotation}, item ${itemRotation}`;
        assert.ok(Math.abs(Math.sin(rendered * Math.PI / 180) - Math.sin(rotation * Math.PI / 180)) < 1e-10, label);
        assert.ok(Math.abs(Math.cos(rendered * Math.PI / 180) - Math.cos(rotation * Math.PI / 180)) < 1e-10, label);
        assert.equal(property.Rotation, itemRotation, 'other layers retain their whole-item rotation');
        outfit = plain(plan[0].after);
        assert.equal(migration.scanWardrobeMigration(source, character).length, 0, 'repeated migration is stable');
      }
    }
    const native = scan({LayerRotation: {[layerName ?? '']: 12}, LayerOverrides: [{Rotation: 355}]});
    assert.equal(native.length, 0, 'existing native rotation takes precedence in every group');
  }
}
asset = originalAsset;
assert.equal(scan({LayerTranslationX: {'': 10}, TranslationX: 5}).length, 0);
// Legacy scaling multiplies the existing shader dimensions. BC multiplies
// item/layer scales too, but clamps their product: verify both axes and names.
for (const name of [null, 'Front']) {
  asset = {...originalAsset, Layer: [{Name: name}]};
  for (const key of ['ScaleX', 'ScaleY']) {
    for (const base of [0.01, 0.5, 1, 2, 3]) {
      for (const factor of [-1, 0, 0.001, 0.01, 0.5, 1, 1.5, 2, 3, 5]) {
        const input = {[key]: base, LayerOverrides: [{[key]: factor, Rotation: 355}]};
        const result = scan(input);
        const expected = base * factor;
        const compatible = expected >= 0.01 && expected <= 3;
        if (!compatible) {
          assert.equal(result[0].parts[0].conflict, true, `${key}: ${base} * ${factor}`);
          assert.deepEqual(plain(result[0].after), outfit, 'unsafe size and other edits remain untouched');
          assert.deepEqual(plain(migration.buildWardrobeMigrationOutfit(result[0], character, () => true)), outfit);
        } else {
          assert.ok(!result[0].parts[0].conflict);
          const property = result[0].after[0].Property;
          const rendered = Math.max(0.01, Math.min(3, property[key] * (property[`Layer${key}`]?.[name ?? ''] ?? 1)));
          assert.ok(Math.abs(rendered - expected) < 1e-10);
          assert.equal(property[key], base, 'item scale is preserved for other layers');
        }
      }
    }
    assert.equal(scan({[`Layer${key}`]: {[name ?? '']: 0.5}, LayerOverrides: [{[key]: 5}]}).length, 0,
      'existing native scaling is authoritative');
  }
}
asset = originalAsset;
plan = scan(maps);
outfit[0].Property.TranslationY = 99;
assert.equal(await migration.applyWardrobeMigration(source, plan), false, 'stale plan must not overwrite subsequent edits');
plan = scan(maps);
const before = structuredClone(outfit);
source.persist = async () => false;
assert.equal(await migration.applyWardrobeMigration(source, plan), false);
assert.deepEqual(outfit, before, 'failed persistence restores originals');
console.log('R132 unnamed layer editing, migrations, conflicts, idempotence and persistence checks passed.');
