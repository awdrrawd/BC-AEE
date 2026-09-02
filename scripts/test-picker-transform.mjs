import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}, extra = '') {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8') + extra;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {exports, require: name => dependencies[name] ?? {}});
  return exports;
}
const transforms = load('src/core/pickerTransform.ts');
const picker = load('src/controllers/appearancePickerController.ts', {
  '@/core/pickerTransform': transforms,
}, '\nexport {captureOpaqueAt, captureScreenBounds};');
const {withPickerMatrices, recordPickerMatrix} = transforms;
const matrices = [];
// A 100x200 texture rotated 90 degrees: (u,v) -> (300-v, 200+u).
// Fixture is in shader clip space for a 500x1100 character canvas.
const rotated = [0, -200 / 1100, 0, 0, -400 / 500, 0, 0, 0,
  0, 0, 1, 0, 0.2, 1 - 400 / 1100, 0, 1];
const gl = {canvas: {width: 500, height: 1100}};
withPickerMatrices(matrices, () => recordPickerMatrix(gl, rotated));
const cap = {matrices, x: 400, y: 600};
const bounds = {x: 0, y: 0, w: 100, h: 200};
const alpha = {scale: 1, mw: 100, mh: 200, mask: new Uint8Array(20000)};
// Only a small patch is opaque, so a bounding-box-only hit would fail this test.
for (let y = 20; y < 30; y++) for (let x = 10; x < 20; x++) alpha.mask[y * 100 + x] = 1;
const hit = point => picker.captureOpaqueAt(cap, 100, 200, bounds, alpha, point);
assert.equal(hit({x: 275, y: 215}), true, 'rotated opaque patch');
assert.equal(hit({x: 415, y: 625}), false, 'old unrotated position must miss');
assert.equal(hit({x: 250, y: 250}), false, 'transparent part of rotated quad');
const rect = picker.captureScreenBounds(cap, 100, 200, bounds, {ox: 10, oy: 20, sx: 2, sy: 3, yStart: 50});
for (const [key, expected] of Object.entries({left: 210, right: 610, top: 470, bottom: 770})) {
  assert.ok(Math.abs(rect[key] - expected) < 1e-8, `${key}: transformed outline/label bounds`);
}
// Arbitrary affine draw covers nonuniform scale, shear and negative scale.
cap.matrices = [[-200, 50, 80, 300, 400, 100]];
assert.equal(hit({x: 380, y: 145}), true);
assert.equal(hit({x: 320, y: 275}), false);
// A second draw is the mirror-copy. Either instance must be selectable.
cap.matrices.push([100, 0, 0, 200, 50, 40]);
assert.equal(hit({x: 65, y: 65}), true, 'mirror-copy instance');
cap.matrices = [[0, 0, 0, 0, 0, 0]];
assert.equal(hit({x: 0, y: 0}), false, 'singular transform');
cap.matrices = [];
assert.equal(hit({x: 415, y: 625}), true, 'translation fallback');
// BC packs normal and blink draws beside each other in a 1000px atlas,
// then copies the blink half back to x=0 on the character canvas.
const atlasGl = {canvas: {width: 1000, height: 1100}};
for (const rotatedDraw of [false, true]) {
  const captures = [];
  for (const offsetX of [0, 500]) {
    const captured = [];
    const originX = rotatedDraw ? 300 : 150;
    const shader = rotatedDraw
      ? [0, -200 / 1100, 0, 0, -400 / 1000, 0, 0, 0, 0, 0, 1, 0,
        2 * (originX + offsetX) / 1000 - 1, 1 - 400 / 1100, 0, 1]
      : [200 / 1000, 0, 0, 0, 0, -400 / 1100, 0, 0, 0, 0, 1, 0,
        2 * (originX + offsetX) / 1000 - 1, 1 - 400 / 1100, 0, 1];
    withPickerMatrices(captured, () => recordPickerMatrix(atlasGl, shader), offsetX);
    cap.matrices = captured;
    const target = rotatedDraw ? {x: 275, y: 215} : {x: 165, y: 225};
    assert.equal(hit(target), true, `atlas offset ${offsetX}, rotated=${rotatedDraw}`);
    assert.equal(hit({x: target.x + 500, y: target.y}), false, 'no ghost in blink atlas half');
    captures.push(picker.captureScreenBounds(cap, 100, 200, bounds,
      {ox: 0, oy: 0, sx: 1, sy: 1, yStart: 0}));
  }
  for (const key of ['left', 'right', 'top', 'bottom']) {
    assert.ok(Math.abs(captures[0][key] - captures[1][key]) < 1e-8, 'blink and normal outline bounds match');
  }
}
// Nested draws and thrown downstream hooks must restore the capture scope.
const outer = [], inner = [];
withPickerMatrices(outer, () => {
  recordPickerMatrix(gl, rotated);
  assert.throws(() => withPickerMatrices(inner, () => { recordPickerMatrix(gl, rotated); throw Error('draw'); }));
  recordPickerMatrix(gl, rotated);
});
recordPickerMatrix(gl, rotated);
assert.equal(outer.length, 2);
assert.equal(inner.length, 1);
// Exercise the actual GLDrawImage hook so the sixth argument cannot be lost
// between the atlas draw and the matrix recorder.
const hooks = new Map();
const hookCapture = {matrices: []};
const drawing = load('src/hooks/drawingHooks.ts', {
  '@/modsdk': {default: {hookFunction: (name, priority, fn) => hooks.set(name, fn)}},
  '@/controllers/appearancePickerController': {captureAppearanceImage: () => hookCapture},
  '@/core/drawImageTracker': {recordDrawImage: () => {}},
  '@/core/pickerTransform': transforms,
  '@/hooks/renderHooks': {renderGlImage: (args, next) => next(args)},
});
drawing.installDrawingHooks();
hooks.get('GLDrawImage')(['coat.png', atlasGl, 150, 200, {}, 500], () => {
  recordPickerMatrix(atlasGl, [0.2, 0, 0, 0, 0, -400 / 1100, 0, 0,
    0, 0, 1, 0, 0.3, 1 - 400 / 1100, 0, 1]);
});
cap.matrices = hookCapture.matrices;
assert.equal(hit({x: 165, y: 225}), true, 'drawing hook forwards blink atlas offset');
assert.equal(hit({x: 665, y: 225}), false);
console.log('Picker transform regression checks passed.');
