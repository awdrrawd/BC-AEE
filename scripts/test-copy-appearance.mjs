import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const left = {Name: '眼睛9', Group: {Name: '左眼_Luzi'}, Layer: [
  {Name: 'Eye', x: 200, y: 100}, {Name: 'Shadow', x: 210, y: 110},
]};
const right = {Name: '眼睛9', Group: {Name: '右眼_Luzi'}, Layer: [
  {Name: 'Shadow', x: 270, y: 110}, {Name: 'Eye', x: 280, y: 100}, {Name: 'New', x: 280, y: 100},
]};
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/util/copyAppearance.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports: api, CommonCloneDeep: structuredClone, CanvasUpperOverflow: 100,
  CommonDrawComputeDrawingCoordinates: (_, __, layer) => ({X: layer.x, Y: layer.y + 100}),
  require: () => ({itemFromBundle: (_, entry) => ({Asset: entry.Group === left.Group.Name ? left : right, Property: entry.Property})}),
});
const entry = {Name: left.Name, Group: left.Group.Name, Color: ['#112233'], Property: {
  LayerOverrides: [{DrawingLeft: {'': 205}, DrawingTop: {'': 97}, Rotation: 355}, {Rotation: 10}],
  LayerTranslationX: {Eye: 2, Shadow: 3, Unknown: 99}, LayerRotation: {Eye: -5},
  OverridePriority: {Eye: 30}, Opacity: [0.5, 0.7],
}};
const original = structuredClone(entry);
const pasted = api.copyAppearanceToGroup({}, entry, left, right);
assert.equal(pasted.Group, right.Group.Name);
assert.deepEqual(pasted.Color, entry.Color);
assert.deepEqual({...pasted.Property.LayerOverrides[0]}, {Rotation: 10});
assert.deepEqual({...pasted.Property.LayerOverrides[1]}, {DrawingLeft: {'': 285}, DrawingTop: {'': 97}, Rotation: 355});
assert.deepEqual({...pasted.Property.LayerOverrides[2]}, {});
assert.deepEqual({...pasted.Property.LayerTranslationX}, {Shadow: 3, Eye: 2});
assert.deepEqual(Array.from(pasted.Property.Opacity), [0.7, 0.5, 1]);
assert.deepEqual({...pasted.Property.OverridePriority}, {Eye: 30});
assert.deepEqual(entry, original, 'copy buffer and worn source cannot be mutated');
assert.deepEqual(api.copyAppearanceToGroup({}, entry, left, left), entry, 'same-group paste preserves exact properties');
pasted.Property.LayerOverrides[1].DrawingLeft[''] = 100;
assert.equal(entry.Property.LayerOverrides[0].DrawingLeft[''], 205, 'pasted edits cannot leak into the source');
console.log('Cross-group copy: layer matching, relative origins, independent properties and same-group fidelity passed.');
