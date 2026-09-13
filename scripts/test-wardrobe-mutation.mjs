import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const player={MemberNumber:1}, state={saving:false,source:'local'};
const rows=[{outfit:[{Group:'Cloth',Name:'A'}],name:'A',meta:{favorite:false,tags:['old']}}];
let resolveWrite, ready=true, writes=0;
const source={id:'local',size:()=>rows.length,isReady:()=>ready,
  outfitAt:i=>rows[i].outfit,nameAt:i=>rows[i].name,
  writeSlot(i,outfit,name){Object.assign(rows[i],{outfit,name});},
  persist(){writes++;return new Promise(resolve=>{resolveWrite=resolve;});},
};
const storage={activeWardrobeSource:()=>source,storageScope:()=> 'acct-1',
  getSlotMeta:(_,i)=>rows[i].meta,setSlotMeta:(_,i,meta)=>rows[i].meta={...rows[i].meta,...meta}};
const store={getWardrobeState:()=>state,setWardrobeState:patch=>Object.assign(state,patch),bumpWardrobeData(){}};
const mutation={};
vm.runInNewContext(compile('src/core/wardrobeMutation.ts'),{exports:mutation,Player:player,
  require:name=>name==='./wardrobeStore'?store:storage});
const exports={};
vm.runInNewContext(compile('src/controllers/outfitsController.ts'),{exports,Player:player,structuredClone,console,
  require:name=>({'@/core/wardrobeMutation':mutation,'@/core/wardrobeStore':store,'@/core/wardrobeStorage':storage,
    '@/i18n/i18n':{t:key=>key},'@/util/toast':{showToast(){}}}[name]??{}),
});
const result=exports.saveOutfitMeta(0,'B',['new']);
assert.equal(state.saving,true);
assert.equal(await exports.saveOutfitMeta(0,'C',[]),false,'second command must be rejected before mutation');
assert.equal(writes,1);assert.equal(rows[0].name,'B');
resolveWrite(false);assert.equal(await result,false);
assert.equal(rows[0].name,'A');assert.deepEqual([...rows[0].meta.tags],['old']);assert.equal(state.saving,false);
const success=exports.saveOutfitMeta(0,'D',['saved']);resolveWrite(true);
assert.equal(await success,true);assert.equal(rows[0].name,'D');
ready=false;assert.equal(await exports.deleteOutfit(0),false);assert.equal(rows[0].outfit.length,1);
console.log('Wardrobe awaited results, duplicate protection, metadata rollback and loading guard passed');
