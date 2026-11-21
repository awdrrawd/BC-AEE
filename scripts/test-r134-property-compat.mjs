import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// BC-R134-COMPAT: ItemPropertiesValidate() rebuilds Item.Property from PropertyData only, which deletes
// LayerOverrides and wceOverrideHide. Checks the restore hook and its sanitizers.
const compile = file => ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;

function load(file, extra = {}, requires = {}) {
  const exports = {};
  const context = vm.createContext({exports, console, Object, Array, Number, JSON, Set, ...extra,
    require: name => requires[name] ?? assert.fail(`unexpected import ${name}`)});
  vm.runInContext(compile(file), context);
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));

// ------------------------------------------------------------------ sanitizers
const {sanitizeLayerOverrides, sanitizeHideOverride} = load('src/core/propertySanitize.ts');
const groups = new Set(['Bra', 'Panties', 'Cloth']);

{
  const good = [{SkewX: 0.2, FlipX: true, MirrorCopy: true, MirrorCopyAxisX: 0.5, DrawingLeft: {'': 12}}, {}, null];
  assert.deepEqual(plain(sanitizeLayerOverrides(good)), [good[0], {}, {}], 'valid data survives, holes become {}');

  assert.equal(sanitizeLayerOverrides('x'), null);
  assert.equal(sanitizeLayerOverrides({0: {}}), null, 'object instead of array');
  assert.equal(sanitizeLayerOverrides(Array(200).fill({})), null, 'too many layers');

  const dirty = sanitizeLayerOverrides([{
    SkewX: 'a', ScaleX: Infinity, Opacity: 5, Rotation: NaN, FlipX: 1, DrawingTop: {'': 'x'},
    DrawingLeft: {'': 3, evil: {a: 1}}, nested: {a: 1}, fn: () => 1, ok: 7, str: 'hi', long: 'x'.repeat(100),
  }]);
  assert.deepEqual(plain(dirty), [{DrawingLeft: {'': 3}, ok: 7, str: 'hi'}], 'bad values and nested data are dropped');

  const proto = JSON.parse('[{"__proto__": {"polluted": 1}, "constructor": 1, "SkewX": 1}]');
  const cleaned = sanitizeLayerOverrides(proto);
  assert.deepEqual(plain(cleaned), [{SkewX: 1}]);
  assert.equal(({}).polluted, undefined, 'no prototype pollution');

  const big = Array.from({length: 128}, () => Object.fromEntries(Array.from({length: 40}, (_, i) => [`k${i}`.padEnd(60, 'x'), 'y'.repeat(60)])));
  assert.equal(sanitizeLayerOverrides(big), null, 'oversized payload is rejected');
}

{
  const exists = name => groups.has(name);
  assert.deepEqual(plain(sanitizeHideOverride(['Bra', 'Bra', 'Panties'], exists)), ['Bra', 'Panties']);
  assert.deepEqual(plain(sanitizeHideOverride([], exists)), [], 'empty (hide nothing) is a legitimate override');
  for (const bad of [['Nope'], 'Bra', [{x: 1}], Array(200).fill('Bra'), null, undefined, {length: 1}]) {
    assert.equal(sanitizeHideOverride(bad, exists), null);
  }
}

// ------------------------------------------------------------------ hook
function install({validateDefined = true} = {}) {
  const hooks = new Map();
  const sdk = {hookFunction: (name, priority, fn) => hooks.set(name, {priority, fn})};
  const mod = load('src/hooks/propertyCompatHooks.ts', {
    AssetGroupGet: (_family, name) => (groups.has(name) ? {Name: name} : null),
    ...(validateDefined ? {ItemPropertiesValidate: () => ({})} : {}),
  }, {'@/modsdk': {default: sdk}, '@/core/propertySanitize': {sanitizeLayerOverrides, sanitizeHideOverride}});
  mod.installPropertyCompatHooks();
  return hooks;
}

{
  assert.equal(install({validateDefined: false}).size, 0, 'R132 and older without the function: nothing is hooked');
  const hooks = install();
  assert.equal(hooks.size, 1);
  const {fn} = hooks.get('ItemPropertiesValidate');
  // R134 behaviour: unregistered fields vanish, a brand-new object comes back.
  const dropped = () => ({value: {TranslationX: 1}, status: 'ok', errorDescriptions: {}});

  const source = {TranslationX: 1, LayerOverrides: [{SkewX: 0.3, FlipY: true}], wceOverrideHide: ['Bra'], PluginCustom: 1};
  const ret = fn([source, {Group: {Family: 'Female3DCG'}}], dropped);
  assert.deepEqual(plain(ret.value), {TranslationX: 1, LayerOverrides: [{SkewX: 0.3, FlipY: true}], wceOverrideHide: ['Bra']});
  assert.equal(ret.value.PluginCustom, undefined, 'fields AEE does not own stay dropped');
  assert.notEqual(ret.value.LayerOverrides, source.LayerOverrides, 'restored data is a copy, not the source reference');
  assert.notEqual(ret.value.wceOverrideHide, source.wceOverrideHide);

  // Hostile input is not restored.
  const hostile = fn([{LayerOverrides: 'x', wceOverrideHide: ['Nope']}, {}], dropped);
  assert.equal(hostile.value.LayerOverrides, undefined);
  assert.equal(hostile.value.wceOverrideHide, undefined);

  // Whatever BC (or another mod) already kept is never overwritten.
  const kept = fn([source, {}], () => ({value: {LayerOverrides: [], wceOverrideHide: ['Panties']}}));
  assert.deepEqual(plain(kept.value), {LayerOverrides: [], wceOverrideHide: ['Panties']});

  // Degenerate inputs never throw.
  assert.doesNotThrow(() => fn([null, {}], dropped));
  assert.doesNotThrow(() => fn([source, undefined], () => undefined));
  assert.doesNotThrow(() => fn([source, {}], () => ({value: null})));
}
console.log('r134 property compat: ok');
