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
const {sanitizeLayerOverrides, sanitizeHideOverride, sanitizeFreeDrawProperties} = load('src/core/propertySanitize.ts');
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

// ------------------------------------------------------------------ free draw fields
const drawDeps = {
  isDrawSource: v => typeof v === 'string' && v.startsWith('OK:'),
  readSpsRef: props => {
    const r = props.CustomDrawSPS;
    return Number.isInteger(r?.o) && typeof r?.r === 'string' && /^[a-f0-9]{64}$/.test(r.r) ? {o: r.o, s: 0, r: r.r, m: 'image/png', u: String(r.u)} : null;
  },
};
const goodRef = {o: 7, s: 0, r: 'a'.repeat(64), m: 'image/png', u: 'x'};

{
  const board = {CustomDraw: 'OK:abc', CustomDrawSPS: goodRef, OffsetX: -12.5, OffsetY: 40, MaskPriority: 55, PluginCustom: 1};
  const kept = sanitizeFreeDrawProperties(board, drawDeps);
  assert.deepEqual(plain(kept), {CustomDraw: 'OK:abc', CustomDrawSPS: goodRef, OffsetX: -12.5, OffsetY: 40, MaskPriority: 55});
  assert.notEqual(kept.CustomDrawSPS, board.CustomDrawSPS, 'SPS reference is a copy');

  assert.deepEqual(plain(sanitizeFreeDrawProperties({CustomDraw: 'http://evil/x.png', OffsetX: '5', OffsetY: Infinity, MaskPriority: 100}, drawDeps)), {},
    'foreign URL, non-numbers and out-of-range priority are dropped');
  assert.deepEqual(plain(sanitizeFreeDrawProperties({CustomDraw: 'OK:x'.padEnd(10), MaskPriority: 1.5, OffsetX: 99999}, drawDeps)), {CustomDraw: 'OK:x'.padEnd(10)});
  assert.deepEqual(plain(sanitizeFreeDrawProperties({CustomDrawSPS: 'str'}, drawDeps)), {});
  assert.deepEqual(plain(sanitizeFreeDrawProperties({CustomDrawSPS: {o: -1, r: 'zz'}}, drawDeps)), {});
  assert.deepEqual(plain(sanitizeFreeDrawProperties(null, drawDeps)), {});
  assert.deepEqual(plain(sanitizeFreeDrawProperties({CustomDraw: ''}, drawDeps)), {}, 'empty drawing is not restored (baseline already is empty)');
}

// ------------------------------------------------------------------ hook
function install() {
  const hooks = new Map();
  const sdk = {hookFunction: (name, priority, fn) => hooks.set(name, {priority, fn})};
  const mod = load('src/hooks/propertyCompatHooks.ts', {
    AssetGroupGet: (_family, name) => (groups.has(name) ? {Name: name} : null),
  }, {'@/modsdk': {default: sdk}, '@/core/propertySanitize': {sanitizeLayerOverrides, sanitizeHideOverride, sanitizeFreeDrawProperties},
    '@/components/mask-system/constants': {DRAW_ASSET: 'DrawingBoard', DRAW_GROUPS: ['ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3']},
    '@/components/mask-system/freeDraw/drawSource': {drawImageSource: v => (drawDeps.isDrawSource(v) ? v : null)},
    '@/components/mask-system/freeDraw/spsDrawing': {readDrawRef: drawDeps.readSpsRef}});
  mod.installPropertyCompatHooks();
  return hooks;
}

{
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
// Free Draw boards: restored for AEE's own assets only.
{
  const {fn} = install().get('ItemPropertiesValidate');
  const dropped = () => ({value: {TranslationX: 1}, status: 'ok', errorDescriptions: {}});
  const board = {CustomDraw: 'OK:abc', CustomDrawSPS: goodRef, OffsetX: 3, OffsetY: -4, MaskPriority: 20, TranslationX: 1};
  const asset = group => ({Name: 'DrawingBoard', Group: {Name: group, Family: 'Female3DCG'}});

  for (const group of ['ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3']) {
    const ret = fn([board, asset(group)], dropped);
    assert.deepEqual(plain(ret.value), {TranslationX: 1, CustomDraw: 'OK:abc', CustomDrawSPS: goodRef, OffsetX: 3, OffsetY: -4, MaskPriority: 20}, `${group} drawing survives validation`);
  }
  // Same field names on someone else's asset are none of our business.
  assert.deepEqual(plain(fn([board, asset('ItemArms')], dropped).value), {TranslationX: 1});
  assert.deepEqual(plain(fn([board, {Name: 'Other', Group: {Name: 'ItemCanvas1'}}], dropped).value), {TranslationX: 1});
  // Hostile payload on our asset: nothing unsafe is restored.
  const hostile = fn([{CustomDraw: 'http://evil/x.png', OffsetX: 'a', MaskPriority: 500}, asset('ItemCanvas1')], dropped);
  assert.deepEqual(plain(hostile.value), {TranslationX: 1});
  // BC already kept a value: not overwritten.
  const kept = fn([board, asset('ItemCanvas1')], () => ({value: {OffsetX: 99}}));
  assert.equal(kept.value.OffsetX, 99);
  assert.doesNotThrow(() => fn([board, undefined], dropped));
}
console.log('r134 property compat: ok');
