import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const deps = {};
const c = vm.createContext({ exports: {}, require: name => deps[name], window: {}, CommonCloneDeep: structuredClone,
  ValidationDeleteLock(p) { delete p.LockedBy; delete p.LockMemberNumber; p.Effect = p.Effect?.filter(e => e !== 'Lock'); },
  ServerBundledItemToAppearanceItem(family, entry) { return {Asset: {Name: entry.Name, Group: {Name: entry.Group}}, Property: entry.Property}; },
  CharacterAppearanceSetItem(character, group) { character.Appearance = character.Appearance.filter(i => i.Asset.Group.Name !== group); },
  LZString: {compressToBase64: text => text},
});
function load(path) {
  c.exports = {};
  vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, c);
  return c.exports;
}
const api = load('src/util/heartLock.ts');
deps['./heartLock'] = api;
const bundleApi = load('src/util/appearanceBundle.ts');
const entry = {Name: 'Cuffs', Group: 'ItemArms', Property: {Name: 'Heart Padlock', HeartLockId: 'a', LockedBy: 'HighSecurityPadlock', Effect: ['Lock', 'Block'], Text: 'keep'}};
const clean = api.sanitizeHeartLock(entry);
assert.equal(clean.Property.HeartLockId, undefined);
assert.equal(clean.Property.Text, 'keep');
assert.equal(entry.Property.HeartLockId, 'a');
assert.equal(JSON.parse(bundleApi.encodeBundle([entry]))[0].Property.HeartLockId, undefined);
const locked = {Asset: {Name: 'Cuffs', Group: {Name: 'ItemArms'}}, Property: entry.Property};
const character = {Appearance: [locked], AssetFamily: 'Female3DCG'};
assert.equal(bundleApi.wearBundle(character, entry), null);
api.preserveHeartLocks(character, () => { character.Appearance = []; });
assert.equal(character.Appearance[0], locked);
const fresh = {Appearance: [], AssetFamily: 'Female3DCG'};
assert.equal(bundleApi.wearBundle(fresh, entry).Property.HeartLockId, undefined);
api.preserveHeartLocks(fresh, () => { fresh.Appearance = [structuredClone(locked)]; });
assert.equal(fresh.Appearance[0].Property.HeartLockId, undefined);
let called = false;
c.window.Liko = {AFC: {heartLock: {sanitizeOutfitItem: value => {called = true; return {...value, Property: {}};}}}};
api.sanitizeHeartLock(entry);
assert.equal(called, true);
console.log('HeartLock export, import, existing-slot protection, rollback and optional AFC API passed.');
