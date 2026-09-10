import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = path => ts.transpileModule(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const code = compile('src/core/aeePresence.ts');
let now = 1000, sequence = 0;
const queue = [], clients = [];
const characters = [1, 2, 3].map(MemberNumber => ({MemberNumber, OnlineSharedSettings: {}}));
function client(index, enabled) {
  const hooks = new Map(), watchers = [], intervals = [];
  let freeDraw = enabled;
  const exports = {};
  const deps = {
    '@/modsdk': {default: {hookFunction: (name, _, hook) => hooks.set(name, hook)}},
    '@/core/version': {MOD_VERSION: 'test'}, '@/core/fonts': {DEFAULT_FONT_ID: 'default'},
    '@/core/settings': {settings: {itemFont: {get: () => 'default'}, enableFreeDraw: {get: () => freeDraw, onChange: cb => watchers.push(cb)}}},
  };
  const context = vm.createContext({exports, require: name => deps[name],
    Player: characters[index], ChatRoomCharacter: characters, window: {Liko: {AEE: {}}},
    ChatRoomMessage() {}, ChatRoomSync() {}, ServerPlayerIsInChatRoom: () => true,
    bcModSdk: {getModsInfo: () => [{name: 'Liko - AEE'}]},
    crypto: {randomUUID: () => `nonce-${++sequence}`}, Date: {now: () => now},
    ServerSend: (_, data) => queue.push({...data, Sender: characters[index].MemberNumber}),
    ServerAccountUpdate: {QueueData() {}}, ChatRoomCharacterUpdate() {},
    setInterval: cb => intervals.push(cb), setTimeout: cb => cb(),
  });
  exports.installPeerDetection = undefined;
  vm.runInContext(code, context);
  const result = {api: exports, hooks, intervals, context,
    setFreeDraw(value) { freeDraw = value; watchers.forEach(cb => cb(value)); }};
  clients.push(result);
  exports.installPeerDetection();
  return result;
}
function deliver() {
  let count = 0;
  while (queue.length) {
    assert.ok(++count < 100, 'handshake must terminate');
    const data = queue.shift();
    clients.forEach((c, index) => {
      if (data.Sender !== characters[index].MemberNumber && (!data.Target || data.Target === characters[index].MemberNumber)) {
        c.hooks.get('ChatRoomMessage')([data], () => {});
      }
    });
  }
}
const a = client(0, true), b = client(1, false);
deliver();
assert.equal(a.api.getAeeStatus(characters[2]).enabled, false, 'no AEE cannot use drawing');
assert.equal(a.api.getAeeStatus(characters[1]).enabled, true);
assert.equal(a.api.getAeeStatus(characters[1]).freeDraw, false, 'AEE with drawing off cannot use drawing');
b.setFreeDraw(true); deliver();
assert.equal(a.api.getAeeStatus(characters[1]).freeDraw, true, 'AEE with drawing on becomes usable immediately');
b.setFreeDraw(false); deliver();
assert.equal(a.api.getAeeStatus(characters[1]).freeDraw, false, 'turning drawing off is shared immediately');
// Two outstanding requests must both remain valid until their deadline.
await a.hooks.get('ChatRoomSync')([], async () => {});
queue.length = 0;
a.intervals[0](); a.intervals[0]();
queue.pop(); // Only the earlier request is delivered; its reply must still count.
deliver();
assert.equal(a.api.getAeeStatus(characters[1]).enabled, true);
// BC awaits screen setup before populating the room's character list.
queue.length = 0;
a.context.ChatRoomCharacter = [];
let finish;
const synced = a.hooks.get('ChatRoomSync')([], () => new Promise(resolve => { finish = () => {
  a.context.ChatRoomCharacter = characters; resolve();
}; }));
assert.equal(queue.length, 0, 'must not announce before async room sync completes');
finish(); await synced; deliver();
assert.equal(a.api.getAeeStatus(characters[1]).enabled, true, 'async room entry discovers peers');
now += 75_001;
assert.equal(a.api.getAeeStatus(characters[1]).enabled, false, 'silent peers still expire');
console.log('Two-client AEE capability and asynchronous room tests passed.');
