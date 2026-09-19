import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const native = fs.readFileSync(new URL('./fixtures/r132-item-runtime.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function client() {
  const groups = new Map(), assets = new Map(), data = new Map(), calls = [];
  let enabled = true;
  const context = vm.createContext({console, exports: {},
    CommonKeys: Object.keys, CommonEntries: Object.entries,
    CommonCloneDeep: value => JSON.parse(JSON.stringify(value)), CommonIsArray: Array.isArray,
    CommonArrayConcatDedupe: (target, values) => { for (const value of values) if (!target.includes(value)) target.push(value); },
    CommonIsObject: value => value != null && typeof value === 'object' && !Array.isArray(value),
    CommonCapitalize: value => value[0].toUpperCase() + value.slice(1),
    CharacterLoadSimple: () => ({Appearance: []}),
    CharacterAppearanceSetItem: (character, group) => { character.Appearance = character.Appearance.filter(item => item.Asset.Group.Name !== group); },
    CharacterRefresh: () => calls.push('refresh'), ChatRoomCharacterItemUpdate: () => calls.push('sync'),
    NoArchItemDataLookup: {},
    ExtendedArchetype: {NOARCH: 'noarch', TYPED: 'typed'},
    ExtendedItemGetData: asset => data.get(`${asset.Group.Name}/${asset.Name}`),
    CommonCallFunctionByNameWarn: (name, ...args) => context[name]?.(...args),
    ItemColorIsDefault: item => item.Color === 'Default',
    AppearanceItem: {fromAsset: (asset, options) => ({Asset: asset, Property: {},
      Color: options.color ?? 'Default', Difficulty: options.difficulty ?? 0, Craft: options.craft})},
    DialogLeaveFocusItem: () => calls.push('leave'),
    AssetGroupGet: (_, group) => groups.get(group),
    AssetGet: (_, group, name) => assets.get(`${group}/${name}`),
    AssetGroupAdd: (_, def) => {
      const group = {Name: def.Group, Asset: []}; groups.set(def.Group, group); return group;
    },
    AssetAdd: (group, definition, configs) => {
      const asset = {...definition, Group: group, Layer: definition.Layer ?? []};
      group.Asset.push(asset); assets.set(`${group.Name}/${asset.Name}`, asset);
      const config = configs?.[group.Name]?.[asset.Name];
      if (config) {
        asset.Archetype = config.Archetype;
        const itemData = {asset, archetype: config.Archetype, baselineProperty: config.BaselineProperty,
          scriptHooks: context.parseHooks(config.ScriptHooks),
          functionPrefix: `Inventory${group.Name}${asset.Name}`};
        data.set(`${group.Name}/${asset.Name}`, itemData);
        context.registerCallbacks(itemData);
      }
    },
  });
  vm.runInContext(native + `
    globalThis.parseHooks = ExtendedItemParseScriptHooks;
    globalThis.registerCallbacks = data => ExtendedItemCreateCallbacks(data, {
      init: (...args) => NoArch.Init(data, ...args),
    });
  `, context);
  context.ServerAppearanceBundle = items => items.map(context.ServerBundledItemFromAppearanceItem);
  const deps = {};
  function load(file) {
    context.exports = {};
    context.require = name => {
      assert.ok(name in deps, `Missing dependency ${name}`);
      return deps[name];
    };
    vm.runInContext(`(function (exports, require) {\n${compile(file)}\n})(exports, require);`, context);
    return context.exports;
  }
  const constants = load('src/components/mask-system/constants.ts');
  deps['../constants'] = constants;
  deps['@/core/settings'] = {settings: {enableFreeDraw: {get: () => enabled}}};
  deps['./lifecycle'] = {slotLoad: async i => calls.push(`load:${i}`), slotExit: () => calls.push('exit')};
  deps['./ui'] = {slotDraw: () => calls.push('draw'), slotClick: () => calls.push('click')};
  deps['./extendedConfig'] = load('src/components/mask-system/freeDraw/extendedConfig.ts');
  deps['./slots'] = {slots: constants.DRAW_GROUPS.map(group => ({
    maskGroup: `${group}Mask`, maskAsset: `${group}MaskA`, visGroup: `${group}Vis`, visAsset: `${group}VisA`,
  }))};
  deps['../translations'] = {maskLabel: key => key};
  const registration = load('src/components/mask-system/freeDraw/registration.ts');
  assert.equal(registration.registerFreeDrawGroups(), true);
  deps['./heartLock'] = {sanitizeHeartLock: value => value, protectedGroup: () => false};
  const bundle = load('src/util/appearanceBundle.ts');
  deps['@/util/appearanceBundle'] = bundle;
  context.TextEncoder = TextEncoder;
  const sizes = load('src/components/mask-system/freeDraw/appearanceSize.ts');
  return {context, constants, groups, assets, data, calls, registration, bundle, sizes,
    setEnabled: value => { enabled = value; }};
}

const sender = client(), receiver = client();
const group = sender.constants.DRAW_GROUPS[0], name = sender.constants.DRAW_ASSET;
const asset = sender.assets.get(`${group}/${name}`);
const prefix = `Inventory${group}${name}`;
const makeItem = Property => ({Asset: asset, Color: ['#112233'], Difficulty: 0, Property});
const wearer = {AssetFamily: 'Female3DCG', Appearance: []};
const receive = item => receiver.bundle.itemFromBundle(wearer, plain(sender.bundle.bundleItem(item)));

// The former plain Extended item loses all free-draw properties in R132.
const oldItem = {...makeItem({CustomDraw: 'pixels', OffsetX: 50}), Asset: {...asset, Name: 'LegacyBoard', Archetype: null}};
assert.equal(sender.context.ItemPropertiesCompress(oldItem), undefined);

const embedded = makeItem({CustomDraw: 'data:image/png;base64,pixels', OffsetX: -30, OffsetY: 75, MaskPriority: 42,
  LayerOverrides: [{SkewX: 12, MirrorCopy: true}], wceOverrideHide: [], LayerTranslationX: {'': 20},
  UnrelatedModField: 'must not whitelist everything'});
const original = structuredClone(embedded.Property);
const restored = receive(embedded);
for (const key of ['CustomDraw', 'OffsetX', 'OffsetY', 'MaskPriority', 'LayerOverrides', 'wceOverrideHide', 'LayerTranslationX']) {
  assert.deepEqual(plain(restored.Property[key]), plain(original[key]), key);
}
assert.equal(restored.Property.UnrelatedModField, undefined);
assert.equal(restored.Property.CustomDrawSPS, null);
assert.deepEqual(embedded.Property, original, 'serialization must not mutate the editor data');
assert.equal(receiver.calls.includes('refresh'), false, 'decompression cannot redraw a dummy character');
assert.equal(receiver.calls.includes('sync'), false, 'decompression cannot broadcast');

const reference = {o: 123, s: 0, r: 'a'.repeat(64), m: 'image/png', u: 'drawing-key', v: 4};
const sps = receive(makeItem({CustomDrawSPS: reference, OffsetX: 0, OffsetY: 0, MaskPriority: 99}));
assert.deepEqual(plain(sps.Property.CustomDrawSPS), reference);
assert.equal(sps.Property.CustomDraw, '');
assert.equal(sps.Property.MaskPriority, 99, 'omitted defaults must be restored');
assert.equal(sps.Property.OffsetX, 0);
const typedDefaults = receive(makeItem({TypeRecord: {}}));
assert.equal(typedDefaults.Property.CustomDraw, '', 'R132 must run full Init even with TypeRecord present');
assert.equal(typedDefaults.Property.MaskPriority, 99);
const cleared = receive(makeItem({}));
assert.equal(cleared.Property.CustomDraw, '');
assert.equal(cleared.Property.CustomDrawSPS, null, 'clearing must not revive an old SPS reference');
const legacy = receiver.bundle.itemFromBundle(wearer, {Group: group, Name: name,
  Property: {CustomDraw: 'old-save', OffsetX: 14, OffsetY: -9, MaskPriority: 37}});
assert.equal(legacy.Property.CustomDraw, 'old-save', 'existing full-property outfits still load');
assert.equal(legacy.Property.OffsetX, 14);

// Exercise the wardrobe's exact bundle -> JSON storage -> wear path with a
// timed lock, crafting metadata and AEE/native transforms.
for (const client of [sender, receiver]) {
  client.context.NoArchItemDataLookup.ItemMiscTimerPadlock = {
    baselineProperty: {RemoveTimer: -1, ShowTimer: true, RemoveItem: false},
  };
}
const lockedItem = makeItem({CustomDraw: 'saved drawing', LockedBy: 'TimerPadlock', LockMemberNumber: 123,
  RemoveTimer: 123456789, ShowTimer: false, Effect: ['Lock'], Opacity: [0.3],
  LayerRotation: {'': 30}, LayerOverrides: [{SkewX: 12}], wceOverrideHide: ['Cloth']});
lockedItem.Craft = {Name: 'Example', Description: 'Saved craft'};
lockedItem.Difficulty = 8;
const saved = plain(sender.bundle.bundleItem(lockedItem));
const snapshot = structuredClone(saved);
const dressed = receiver.bundle.wearBundle(wearer, saved);
assert.equal(wearer.Appearance[0], dressed);
assert.equal(dressed.Property.RemoveTimer, 123456789);
assert.ok(dressed.Property.Effect.includes('Lock'), 'R132 restores the compressed Lock effect');
assert.deepEqual(plain(dressed.Craft), lockedItem.Craft);
assert.equal(dressed.Difficulty, 8);
for (const key of ['Opacity', 'LayerRotation', 'LayerOverrides', 'wceOverrideHide']) {
  assert.deepEqual(plain(dressed.Property[key]), lockedItem.Property[key]);
}
const unlocked = receiver.bundle.wearBundle(wearer, receiver.bundle.stripLock(saved));
assert.equal(unlocked.Property.LockedBy, undefined);
assert.equal(unlocked.Property.RemoveTimer, undefined, 'exclude-lock must remove R132 timer data');
assert.ok(!unlocked.Property.Effect?.includes('Lock'));
assert.equal(wearer.Appearance.length, 1, 'wear replaces the group');
assert.deepEqual(saved, snapshot, 'wear/strip lock must not mutate the stored outfit');

// A regular typed restraint uses the same native serializer. Its registered
// Init callback is stubbed here; compression/decompression themselves are BC's.
for (const client of [sender, receiver]) {
  const asset = {Name: 'TypedCuffs', Group: {Name: 'ItemArms'}, Extended: true, Archetype: 'typed'};
  const data = {asset, archetype: 'typed', name: 'typed', baselineProperty: {Text: ''}};
  data.options = [0, 1].map(index => ({OptionType: 'TypedItemOption', ParentData: data,
    Property: {Effect: index ? ['Block'] : []}}));
  client.assets.set('ItemArms/TypedCuffs', asset);
  client.data.set('ItemArms/TypedCuffs', data);
  client.context.InventoryItemArmsTypedCuffsInit = (dummy, item, push, refresh) => {
    assert.equal(push, false);
    assert.equal(refresh, false);
    const index = item.Property.TypeRecord?.typed ?? 0;
    item.Property.TypeRecord = {typed: index};
    item.Property.Effect = [...data.options[index].Property.Effect];
  };
}
const typed = {Asset: sender.assets.get('ItemArms/TypedCuffs'),
  Property: {TypeRecord: {typed: 1, UnknownOldModule: 2}, Effect: ['Block'], LayerScaleX: {'': 1.5}}};
const typedBefore = structuredClone(typed.Property);
const typedSaved = plain(sender.bundle.bundleItem(typed));
assert.deepEqual(typed.Property, typedBefore, 'R132 option normalization cannot mutate worn properties during save');
assert.deepEqual(typedSaved.Property.TypeRecord, {typed: 1});
assert.equal(typedSaved.Property.Effect, undefined, 'R132 omits derived option effects');
const typedWorn = receiver.bundle.wearBundle(wearer, typedSaved);
assert.deepEqual(plain(typedWorn.Property.TypeRecord), {typed: 1});
assert.deepEqual(plain(typedWorn.Property.Effect), ['Block'], 'wear must invoke the native extended-item initialization path');
assert.deepEqual(plain(typedWorn.Property.LayerScaleX), {'': 1.5});
assert.doesNotThrow(() => sender.bundle.bundleItem({Asset: typed.Asset}), 'items without properties must still save');

wearer.Appearance = [embedded];
const session = {character: wearer, item: embedded};
assert.ok(sender.sizes.projectedAppearanceBytes('x'.repeat(20_000), session)
  > sender.sizes.projectedAppearanceBytes('x', session) + 19_000,
  'R132 compression must not make the upload size estimator ignore drawing bytes');

// New BC callback registration must preserve the custom UI on every asset reload.
sender.context[`${prefix}Load`]();
sender.context[`${prefix}Draw`]();
sender.context[`${prefix}Click`]();
sender.context[`${prefix}Exit`]();
assert.deepEqual(sender.calls, ['load:0', 'draw', 'click', 'exit']);
sender.groups.clear(); sender.assets.clear(); sender.data.clear();
assert.equal(sender.registration.registerFreeDrawGroups(), true);
sender.context[`${prefix}Load`]();
assert.equal(sender.calls.at(-1), 'load:0');
sender.setEnabled(false);
sender.context[`${prefix}Load`]();
assert.equal(sender.calls.at(-1), 'leave');
for (const slotGroup of sender.constants.DRAW_GROUPS) {
  assert.equal(sender.assets.get(`${slotGroup}/${name}`).Archetype, 'noarch');
}
console.log('R132 native property round trips, legacy saves, drawing size estimates and callback reloads passed.');
