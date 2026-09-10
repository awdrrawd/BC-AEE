import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let dragging = false, finish;
const jsx = (type, props) => ({type, props});
const dependencies = {
  react: {useState: () => [dragging, value => { dragging = value; }], useRef: () => ({current: null}), useEffect() {}},
  'react/jsx-runtime': {jsx, jsxs: jsx},
  '@/core/bc': {isGroupLocked: () => false, getLayerOverride: () => ({}), getAssetBaseXY: () => ({bx: 0, by: 0})},
  '@/controllers/layerGeometryController': {getSelectedLayerGeometry: () => ({corners: [[0, 0], [100, 0], [100, 100], [0, 100]], center: [50, 50], pivot: [50, 50], pivots: [[50, 50]], width: 100, height: 100})},
  '@/controllers/appearancePickerController': {getCapturedTranslationFactor: () => 1},
  '@/controllers/uiController': {setEditProperties() {}, setEditProperty() {}},
  '@/controllers/pointerDragController': {beginPointerDrag: (_event, _move, end) => { finish = end; return end; }},
  '@/i18n/i18n': {t: key => key},
};
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/components/overlays/FreeTransformGizmo.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText, {exports, require: key => dependencies[key] ?? {}});
const state = {editTool: 'gizmo', canvasRect: {left: 0, top: 0, width: 2000, height: 1000}, item: {}, selectedLayer: '0'};
const render = () => exports.FreeTransformGizmo({state}).props.children.props.children;
const event = {preventDefault() {}, stopPropagation() {}, nativeEvent: {}, clientX: 0, clientY: 0};
for (const control of ['move', 'scale', 'rotate']) {
  const [polygon, handles] = render();
  assert.equal(polygon.props.strokeDasharray, undefined);
  const target = control === 'move' ? polygon : control === 'rotate' ? handles.props.children[1] : handles.props.children[2][0];
  target.props.onPointerDown(event);
  const [during, hidden, pivots] = render();
  assert.equal(during.props.strokeDasharray, '4 4');
  assert.equal(during.props.fill, 'none');
  assert.equal(hidden.props.visibility, 'hidden');
  assert.equal(pivots.length, 1, 'pivot stays outside the hidden handles');
  assert.equal(pivots[0].props.visibility, undefined);
  assert.equal(pivots[0].props.children.length, 2, 'both crosshair lines remain visible');
  finish();
  const [after, visible] = render();
  assert.equal(after.props.strokeDasharray, undefined);
  assert.equal(visible.props.visibility, undefined);
}
console.log('Gizmo move, scale and rotate outline tests passed.');
