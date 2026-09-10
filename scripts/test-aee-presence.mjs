import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let now = 1000, active = true, inRoom = true, freeDraw = true, font = 'default';
const hooks = new Map(), sent = [], timers = [];
const player = {MemberNumber: 1, OnlineSharedSettings: {AEEItemFont: 'old', OtherMod: true}};
const other = {MemberNumber: 2, OnlineSharedSettings: {AEE: {Version: 'old', Enabled: true}}};
const globals = {window: {Liko: {AEE: {}}}, Player: player, ChatRoomCharacter: [player, other],
  ChatRoomMessage() {}, ChatRoomSync() {},
  ServerPlayerIsInChatRoom: () => inRoom,
  bcModSdk: {getModsInfo: () => active ? [{name: 'Liko - AEE'}] : []},
  ServerSend: (_, data) => sent.push(data),
  ServerAccountUpdate: {QueueData() {}}, ChatRoomCharacterUpdate() {},
  Date: {now: () => now}, crypto: {randomUUID: () => `nonce-${now}`},
  setInterval: callback => timers.push(callback), setTimeout: callback => callback(),
};
const dependencies = {
  '@/modsdk': {default: {hookFunction: (name, _, hook) => hooks.set(name, hook)}},
  '@/core/version': {MOD_VERSION: 'test'}, '@/core/fonts': {DEFAULT_FONT_ID: 'default'},
  '@/core/settings': {settings: {itemFont: {get: () => font}, enableFreeDraw: {get: () => freeDraw, onChange() {}}}},
};
function load(path, deps = dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {...globals, exports, require: name => deps[name] ?? {}});
  return exports;
}
const api = load('src/core/aeePresence.ts');
api.installPeerDetection();
assert.equal(player.OnlineSharedSettings.AEE.Version, 'test');
assert.equal(player.OnlineSharedSettings.AEEItemFont, undefined);
assert.equal(player.OnlineSharedSettings.OtherMod, true);
assert.equal(api.getAeeStatus(other).enabled, false, 'saved settings never prove presence');
assert.equal(api.getAeeStatus(player).enabled, true);
const receive = message => hooks.get('ChatRoomMessage')([{Sender: 2, Type: 'Hidden', Content: 'LikoAEE:status:' + JSON.stringify(message)}], () => {});
const reply = () => receive({type: 'reply', nonce: JSON.parse(sent.findLast(data => data.Content.includes('request')).Content.slice('LikoAEE:status:'.length)).nonce, version: 'peer', freeDraw: true});
receive({type: 'reply', nonce: 'stale', version: 'peer', freeDraw: true});
assert.equal(api.getAeeStatus(other).enabled, false);
reply();
assert.equal(api.getAeeStatus(other).enabled, true);
assert.equal(api.getAeeStatus(other).freeDraw, true);
now += 75_001;
assert.equal(api.getAeeStatus(other).enabled, false, 'silent disable expires');
receive({type: 'reply', nonce: 'nonce-1000', version: 'peer', freeDraw: true});
assert.equal(api.getAeeStatus(other).enabled, false, 'expired challenge cannot revive presence');
timers[0](); reply();
assert.equal(api.getAeeStatus(other).enabled, true);
hooks.get('ChatRoomSyncMemberLeave')([{SourceMemberNumber: 2}], () => {});
assert.equal(api.getAeeStatus(other).enabled, false);
reply();
hooks.get('ChatRoomSync')([], () => {});
assert.equal(api.getAeeStatus(other).enabled, false, 'room sync clears old confirmations');
reply();
inRoom = false;
assert.equal(api.getAeeStatus(other).enabled, false);
inRoom = true;
font = 'custom-font'; api.shareAeeSettings();
assert.equal(player.OnlineSharedSettings.AEE.ItemFont, font);
font = 'default'; api.shareAeeSettings();
assert.equal(player.OnlineSharedSettings.AEE.ItemFont, undefined);
const access = load('src/components/mask-system/access.ts', {...dependencies,
  '@/core/aeePresence': api,
  './constants': {DRAW_GROUPS: ['ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3'], SG_MASK_GROUP: 'SingleGloveFX',
    drawMaskGroupName: group => group + 'Mask', drawVisibleGroupName: group => group + 'Vis'},
});
access.installAeeGroupAccess();
assert.equal(access.canUseAeeGroup(other, 'ItemCanvas1'), true);
freeDraw = false;
assert.equal(access.canUseAeeGroup(player, 'ItemCanvas1'), false);
assert.equal(access.canUseAeeGroup(player, 'SingleGloveFX'), true);
active = false;
assert.equal(api.getAeeStatus(player).enabled, false, 'SDK unload disables local status');
assert.equal(api.getAeeStatus(other).enabled, false);
assert.equal(access.canUseAeeGroup(other, 'ItemCanvas1'), false);
assert.equal(access.canUseAeeGroup(other, 'Cloth'), true);
let calls = 0;
assert.equal(hooks.get('InventoryWear')([other, 'DrawingBoard', 'ItemCanvas1'], () => ++calls), null);
assert.equal(calls, 0, 'unsupported wear never reaches BC');
hooks.get('CharacterAppearanceSetItem')([other, 'ItemCanvas1', null], () => ++calls);
assert.equal(calls, 0, 'set-item removal is blocked for unsupported wearers');
hooks.get('InventoryRemove')([other, 'ItemCanvas1'], () => ++calls);
assert.equal(calls, 0, 'direct removal is also blocked');
other.Appearance = [{Asset: {Group: {Name: 'ItemCanvas1'}}}];
for (const group of ['SingleGloveFX', 'ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3']) {
  assert.equal(hooks.get('AppearanceGroupAllowed')([other, group], () => true), false,
    'unsupported groups remain hidden even when already worn');
}
hooks.get('InventoryRemove')([other, 'Cloth'], () => ++calls);
assert.equal(calls, 1, 'ordinary BC removal is unchanged');
const before = sent.length; timers[0]();
assert.equal(sent.length, before, 'unloaded SDK cannot keep announcing');
console.log('AEE presence, shared settings and group access tests passed.');
