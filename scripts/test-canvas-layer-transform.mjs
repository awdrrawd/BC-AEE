import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}, globals = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {exports, require: name => dependencies[name] ?? {}, ...globals});
  return exports;
}

const canvasLayer = load('src/core/canvasLayer.ts');
const {resolveNativeLayerTransform} = canvasLayer;

// Same arithmetic as BC CommonDraw getTransform.
const item = {Property: {
  LayerTranslationX: {Text: 30}, TranslationX: 5,
  LayerTranslationY: {Text: -12},
  LayerScaleX: {Text: 2}, ScaleX: 1.25,
  LayerRotation: {Text: 400},
}};
assert.deepEqual({...resolveNativeLayerTransform(item, 'Text')},
  {tx: 35, ty: -12, sx: 2.5, sy: 1, rot: 180}, 'additive translation/rotation, multiplicative scale, clamped');
assert.equal(resolveNativeLayerTransform({Property: {}}, 'Text'), null, 'untouched layers are not modified');
assert.equal(resolveNativeLayerTransform({}, 'Text'), null, 'items without Property are safe');
assert.equal(resolveNativeLayerTransform({Property: {LayerTranslationX: {Other: 9}}}, 'Text'), null, 'other layers do not leak');
assert.equal(resolveNativeLayerTransform({Property: {LayerScaleX: {Text: 99}}}, 'Text').sx, 3, 'scale clamps to BC max');

// GLDrawImage hook.
const hooks = new Map();
const runtime = {afterDrawContext: null};
let captured;
const drawing = load('src/hooks/drawingHooks.ts', {
  '@/modsdk': {default: {hookFunction: (name, _p, fn) => hooks.set(name, fn)}},
  '@/controllers/appearancePickerController': {captureAppearanceImage: (...a) => { captured = a; return undefined; }},
  '@/core/drawImageTracker': {recordDrawImage() {}},
  '@/core/pickerTransform': {withPickerMatrices: (_m, draw) => draw()},
  '@/core/runtime': {runtime},
  '@/core/canvasLayer': canvasLayer,
  '@/hooks/renderHooks': {renderGlImage: (args, next) => next(args)},
});
drawing.installDrawingHooks();
const hook = hooks.get('GLDrawImage');
const run = args => { let seen; hook(args, a => { seen = a; }); return seen; };
const canvas = {width: 128, height: 128};

// Outside AfterDraw nothing changes (e.g. other canvas draws).
let args = [canvas, {}, 100, 200, {AlphaMasks: []}, 0];
run(args);
assert.deepEqual([args[2], args[3]], [100, 200]);

// Inside AfterDraw a text canvas gets the layer transform; position is offset
// the same way CommonDraw offsets image layers (drawX = X + Translation).
runtime.afterDrawContext = {item, layerName: 'Text', layerIndex: 2};
args = [canvas, {}, 100, 200, {AlphaMasks: [[1, 2, 3, 4]]}, 500];
run(args);
assert.equal(args[2], 135); assert.equal(args[3], 188);
assert.deepEqual({...args[4]}, {AlphaMasks: [[1, 2, 3, 4]], TranslationX: 35, TranslationY: -12, ScaleX: 2.5, ScaleY: 1, Rotation: 180});
assert.equal(captured[1], 135, 'capture sees the final draw position');
assert.equal(captured[3].ScaleX, 2.5, 'capture sees the final transform for the gizmo');
assert.equal(captured[4], 500, 'blink offset reaches the capture');

// URL (image) draws are never touched: BC already transforms those.
args = ['Assets/x.png', {}, 10, 20, {}, 0];
run(args);
assert.deepEqual([args[2], args[3]], [10, 20]);

// A BC that transforms canvases itself must not be applied twice.
args = [canvas, {}, 100, 200, {TranslationX: 7}, 0];
run(args);
assert.equal(args[2], 100); assert.equal(args[4].TranslationX, 7);

// Layer without any transform is left alone.
runtime.afterDrawContext = {item: {Property: {}}, layerName: 'Text', layerIndex: 0};
args = [canvas, {}, 100, 200, undefined, 0];
run(args);
assert.deepEqual([args[2], args[3], args[4]], [100, 200, undefined]);

console.log('Canvas (text) layer transform regression checks passed.');
