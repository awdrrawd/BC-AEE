import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const manifest='liko-aee:wardrobe/v2/index';
function load(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,TextEncoder,structuredClone,require:()=>load('src/core/spsWardrobe.ts')});return exports;}
const {archiveSpsWardrobe}=load('src/core/spsMaintenance.ts');
const live='liko-aee:wardrobe/v2/slot/0/abc',old='liko-aee:wardrobe/v2/slot/0/def';
const records={[manifest]:JSON.stringify({version:2,revision:'abc',capacity:100,slots:{0:live}}),[live]:'live',[old]:'old','foreign/key':'secret'};
const io={list:async()=>Object.keys(records),read:async key=>records[key]??null,check(){}};
const archive=await archiveSpsWardrobe(io,1);
assert.equal(archive.entries['foreign/key'],undefined);
assert.deepEqual([...archive.notReferencedByObservedIndex],[old]);
await assert.rejects(archiveSpsWardrobe({...io,list:async()=>[manifest,old]},1),/incomplete_archive/);
let reads=0;
await assert.rejects(archiveSpsWardrobe({...io,read:async key=>key===manifest&&++reads>1?'changed':records[key]},1),/archive_changed/);
await assert.rejects(archiveSpsWardrobe({...io,check(){throw Error('account_changed');}},1),/account_changed/);
const {scanWardrobeDrawings,prepareWardrobeDrawings}=load('src/core/wardrobeDrawingMigration.ts');
const board={Group:'ItemCanvas1',Name:'DrawingBoard',Property:{CustomDraw:'image',Opacity:0.5}};
const outfits=[[board,{Group:'Other',Name:'DrawingBoard',Property:{CustomDraw:'untouched'}}],[board,{...board,Group:'ItemCanvas3'}]];
const source={size:()=>2,outfitAt:i=>outfits[i],nameAt:i=>String(i)};
const plan=scanWardrobeDrawings(source);const calls=[];
const result=await prepareWardrobeDrawings(plan,async(slot)=>{calls.push(slot);return {v:4,s:slot};},()=>{});
assert.deepEqual(calls,[0,2]);
assert.equal(result[0].outfit[0].Property.CustomDraw,undefined);
assert.equal(result[0].outfit[0].Property.Opacity,0.5);
assert.equal(result[0].outfit[1].Property.CustomDraw,'untouched');
assert.equal(outfits[0][0].Property.CustomDraw,'image');
await assert.rejects(prepareWardrobeDrawings(plan,async()=>{throw Error('upload_failed');},()=>{}),/upload_failed/);
assert.equal(plan[0].before[0].Property.CustomDraw,'image');
console.log('SPS archive consistency and non-mutating drawing migration passed');

const {recoverSpsArchive}=load('src/core/spsMaintenance.ts');
const outfit=[{Group:'Cloth',Name:'Dress'}];
const snapshot={format:'aee-sps-archive',version:1,entries:{
 [manifest]:JSON.stringify({version:2,revision:'abc',capacity:100,slots:{0:live}}),
 [live]:JSON.stringify({outfit,name:'Saved',meta:{favorite:true,tags:['tag']}}),
 [old]:'invalid historical data must not replace published content',
}};
const recovered=await recoverSpsArchive(snapshot);
assert.equal(recovered.length,1);
assert.equal(recovered[0].name,'Saved');
assert.equal(recovered[0].meta.favorite,true);
assert.equal(recovered[0].sourceIndex,0);
await assert.rejects(recoverSpsArchive({...snapshot,version:2}),/invalid_archive/);
await assert.rejects(recoverSpsArchive({...snapshot,entries:{[manifest]:snapshot.entries[manifest]}}),/missing_slot/);
await assert.rejects(recoverSpsArchive({...snapshot,entries:{...snapshot.entries,'other/data':'x'}}),/invalid_archive/);
const legacy=await recoverSpsArchive({format:'aee-sps-archive',version:1,entries:{'liko-aee:wardon/2':JSON.stringify({version:1,outfits:[outfit],names:['Legacy']})}});
assert.equal(legacy[0].sourceIndex,300);
assert.equal(legacy[0].name,'Legacy');
console.log('Archive recovery: published snapshot, metadata, legacy and invalid input passed');
const fileModule={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/core/wardrobeFile.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:fileModule,require:key=>key.endsWith('spsMaintenance')?{recoverSpsArchive}:{decodeBundles:()=>null},
});
assert.equal((await fileModule.parseWardrobeFile(JSON.stringify(snapshot)))[0].name,'Saved');
assert.equal((await fileModule.parseWardrobeFile(JSON.stringify({format:'aee-wardrobe',version:1,slots:[{index:3,name:'Standard',outfit}]})))[0].sourceIndex,3);
assert.equal((await fileModule.parseWardrobeFile(JSON.stringify([outfit]))).length,1);
await assert.rejects(fileModule.parseWardrobeFile(JSON.stringify({...snapshot,entries:{}})),/incomplete_archive/);
console.log('Wardrobe file entry point supports archives and existing formats');
// Live loading and archival must reject the same invalid index, not produce an unrestorable archive.
const {SpsWardrobe}=load('src/core/spsWardrobe.ts');
for(const invalidIndex of [
 {version:2,revision:'abc',capacity:99,slots:{0:live}},
 {version:2,revision:'abc',capacity:100,slots:{1:live}},
 {version:2,revision:'abc',capacity:100,slots:{0:'liko-aee:wardrobe/v2/slot/0/not-a-record'}},
]){
 const invalidIO={...io,read:async key=>key===manifest?JSON.stringify(invalidIndex):records[key]??null};
 await assert.rejects(archiveSpsWardrobe(invalidIO,1),/invalid_index/);
 await assert.rejects(new SpsWardrobe({...invalidIO,write:async()=>{throw Error('unexpected write');}}).load(),/invalid_index/);
}
console.log('Live and archived wardrobes share strict index validation');
