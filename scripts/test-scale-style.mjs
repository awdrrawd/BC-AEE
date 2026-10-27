import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync(new URL('../src/util/scaleStyle.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;

function load(supported, measuredWidth = 20) {
  let probes = 0;
  let removed = 0;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    CSS: {supports: () => supported},
    document: {
      body: {appendChild() { probes++; }},
      createElement: () => ({
        style: {}, appendChild() {}, remove() { removed++; },
        offsetWidth: 10,
        getBoundingClientRect: () => ({left: 20, width: measuredWidth}),
      }),
    },
  });
  return {exports, counts: () => ({probes, removed})};
}

for (const supported of [true, false]) {
  const {exports: {scaleStyle}, counts} = load(supported);
  for (const scale of [0.625, 1, 1.25]) {
    const style = scaleStyle(scale, {left: 100.25, top: -20.5});
    if (supported) {
      assert.equal(style.zoom, scale);
      assert.equal(style.left * scale, 100.25);
      assert.equal(style.top * scale, -20.5);
      assert.equal(style.transform, undefined);
    } else {
      assert.equal(style.transform, `scale(${scale})`);
      assert.equal(style.left, 100.25);
      assert.equal(style.top, -20.5);
    }
  }
  assert.deepEqual(counts(), {probes: supported ? 1 : 0, removed: supported ? 1 : 0});
}
const incompatible = load(true, 10);
assert.equal(incompatible.exports.scaleStyle(0.5).transform, 'scale(0.5)', 'CSS syntax support alone is insufficient');
assert.deepEqual(incompatible.counts(), {probes: 1, removed: 1});
console.log('Panel scaling coordinate and compatibility checks passed.');
