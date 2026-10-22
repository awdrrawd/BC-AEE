import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const transpile = file => ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const code = transpile('../src/core/settings.ts');
const storageCode = transpile('../src/core/storage.ts');
function load(saved) {
  const localStorage = {getItem: () => JSON.stringify(saved), setItem: () => {}};
  const storage = {};
  vm.runInNewContext(storageCode, {exports: storage, localStorage});
  const exports = {};
  vm.runInNewContext(code, {exports, require: name => name === '@/core/storage' ? storage : {}, localStorage});
  return exports.settings;
}

for (const [saved, enabled, color] of [
  [{}, false, 'theme'],
  [{hoverOutlineColor: 'off'}, false, 'theme'],
  [{hoverOutlineColor: 'rose'}, true, 'rose'],
  [{hoverOutlineColor: 'custom', hoverOutlineCustomColor: '#123456'}, true, 'custom'],
  [{hoverOutlineColor: 'theme', hoverOutlinePanel: false}, false, 'theme'],
]) {
  const settings = load(saved);
  assert.equal(settings.hoverOutlinePanel.get(), enabled);
  assert.equal(settings.hoverOutlineColor.get(), color);
  settings.hoverOutlineColor.set('gold');
  assert.equal(settings.hoverOutlinePanel.get(), enabled, 'changing color never enables panel outlines');
  settings.hoverOutlinePanel.toggle();
  assert.equal(settings.hoverOutlineColor.get(), 'gold', 'panel toggle never changes color');
  if (saved.hoverOutlineCustomColor) assert.equal(settings.hoverOutlineCustomColor.get(), '#123456');
}
for (const locale of fs.readdirSync(new URL('../src/i18n/locales/', import.meta.url))) {
  const translations = JSON.parse(fs.readFileSync(new URL(`../src/i18n/locales/${locale}/translation.json`, import.meta.url), 'utf8'));
  for (const key of ['settings-hover-panel-outline', 'settings-hover-outline', 'settings-hover-outline-theme']) {
    assert.ok(translations[key], `${locale}: ${key}`);
  }
}
console.log('Outline settings migration and translations passed.');
