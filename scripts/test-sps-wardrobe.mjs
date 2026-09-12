import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/core/spsWardrobe.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports, crypto: webcrypto, structuredClone});
const {SpsWardrobe, spsCapacity, SPS_MANIFEST_KEY} = exports;
for (const [count, expected] of [[0,100],[89,100],[90,200],[189,200],[190,300],[289,300],[290,400],[889,900],[890,984],[983,984],[984,984]]) {
  assert.equal(spsCapacity(count), expected, `capacity at ${count}`);
}
assert.equal(spsCapacity(0, 980), 984, 'sparse data remains reachable');
assert.equal(spsCapacity(0, -1, 500), 500, 'deletion does not shrink capacity');
assert.throws(() => spsCapacity(1,984), /overflow/);
const data = new Map();
let fault = null, checks = 0, alive = true;
const writes = [];
const io = {
  read: async key => data.get(key) ?? null,
  list: async () => [...data.keys()],
  check() { checks++; if (!alive) throw new Error('account_changed'); },
  async write(key, value) {
    writes.push(key);
    if (fault?.(key, value)) throw new Error('offline');
    data.set(key, value);
  },
};
const row = name => ({outfit: [{Group:'Cloth',Name:name}],name,meta:{favorite:true,tags:['tag']}});
const store = new SpsWardrobe(io);
await assert.rejects(store.save([0]), /not_ready/);
await store.load(); assert.equal(store.rows.length,100);
for (let i=0;i<90;i++) store.rows[i]=row(`a${i}`);
await store.save([...Array(90).keys()]); assert.equal(store.rows.length,200);
const before = data.get(SPS_MANIFEST_KEY);
store.rows[0]=row('changed'); store.rows[1]=row('changed2');
fault = key => key.includes('/slot/1/');
await assert.rejects(store.save([0,1]), /offline/);
assert.equal(data.get(SPS_MANIFEST_KEY),before,'partial uploads must not publish an index');
const reader = new SpsWardrobe(io); await reader.load();
assert.equal(reader.rows[0].name,'a0'); assert.equal(reader.rows[1].name,'a1');
fault=null;
await store.save([0,1]);
await reader.load(); assert.equal(reader.rows[0].name,'changed');
assert.deepEqual([...reader.rows[0].meta.tags],['tag']);
assert.equal(reader.rows[0].meta.favorite,true);
// First tab detects another already committed edit instead of overwriting it.
const stale = new SpsWardrobe(io); await stale.load();
reader.rows[2]=row('newer'); await reader.save([2]);
await assert.rejects(stale.save([3]),/remote_changed/);
// A response lost after a successful index write must be reconciled as success.
fault=(key,value) => { if (key===SPS_MANIFEST_KEY) {data.set(key,value);return true;} return false; };
reader.rows[3]=row('lost-response'); await reader.save([3]);
fault=null;
alive=false; await assert.rejects(reader.save([0]),/account_changed/); alive=true;
assert.ok(checks>writes.length,'account checks surround IO');
// Old chunks are copied on first save and never removed; malformed/overflow data blocks writes.
data.clear(); const legacyKey='liko-aee:wardon/1';
const legacy=JSON.stringify({version:1,outfits:[row('legacy').outfit],names:['legacy']});
data.set(legacyKey,legacy);
const migration=new SpsWardrobe(io); await migration.load();
assert.equal(migration.rows.length,100); assert.equal(migration.rows[0].name,'legacy');
migration.rows[1]=row('new'); await migration.save([1]);
assert.equal(data.get(legacyKey),legacy);
const migrated=new SpsWardrobe(io); await migrated.load(); assert.equal(migrated.rows[0].name,'legacy');
data.clear();data.set(legacyKey,JSON.stringify({version:99,outfits:[],names:[]}));
await assert.rejects(new SpsWardrobe(io).load(),/invalid_legacy/);
data.clear();data.set('liko-aee:wardon/5',legacy);
await assert.rejects(new SpsWardrobe(io).load(),/overflow/);
console.log('SPS capacity, atomic publication, failures, identity and legacy preservation passed');
