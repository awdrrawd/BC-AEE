import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {test} from '@playwright/test';

// Execute the actual listener against real HTML range step/clamp semantics.
test('range wheel respects steps, limits and scroll handling', async ({page}) => {
let effect;
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ui/useRangeWheel.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports, require: () => ({useEffect: fn => { effect = fn; }})});
exports.useRangeWheel({}, () => {});
  await page.setContent('<div style="height:100px;overflow:auto"><input type="range" min="0" max="1" step="0.01" value="0.5"><div style="height:1000px"></div></div>');
  const result = await page.evaluate(source => {
    const input = document.querySelector('input');
    const ref = {current: input};
    const changes = [];
    const onChange = value => changes.push(value);
    const cleanup = eval(`(${source})`)();
    const fire = (deltaY, ctrlKey = false) => {
      const event = new WheelEvent('wheel', {deltaY, ctrlKey, bubbles: true, cancelable: true});
      input.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const blocked = fire(-100);
    fire(100);
    input.value = '1'; fire(-100);
    input.value = '0'; fire(100);
    const zoomBlocked = fire(-100, true);
    input.disabled = true; fire(-100);
    input.disabled = false;
    cleanup(); fire(-100);
    return {changes, blocked, zoomBlocked, value: input.value};
  }, effect.toString());
  assert.deepEqual(result, {changes: [0.51, 0.5], blocked: true, zoomBlocked: false, value: '0'});
  console.log('Range wheel: native decimal steps, bounds, scroll prevention, zoom, disabled and cleanup passed.');
});
