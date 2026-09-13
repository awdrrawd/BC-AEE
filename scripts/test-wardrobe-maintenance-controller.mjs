import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(path){return ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;}
const drawing={};vm.runInNewContext(compile('src/core/wardrobeDrawingMigration.ts'),{exports:drawing,structuredClone});
async function run(mode){
 const events=[];const original=[{Group:'ItemCanvas1',Name:'DrawingBoard',Property:{CustomDraw:'data:image/png;base64,YQ=='}}];
 let outfit=structuredClone(original),valid=true;
 const source={id:'local',size:()=>1,outfitAt:()=>outfit,nameAt:()=>'',isReady:()=>true,writeSlot:(_,next)=>{events.push('write');outfit=next;},persist:async()=>{events.push('persist');if(mode==='save-throw')throw Error('save');return mode!=='save-false';}};
 const modules={
 '@/core/wardrobeStorage':{activeWardrobeSource:()=>source},
 '@/core/wardrobeMutation':{wardrobeIdentity:()=>()=>valid,wardrobeMutation:async(_,work)=>work()},
 '@/core/wardrobeFile':{backupWardrobeSource:()=>{events.push('backup');return 1;}},
 '@/core/wardrobeStore':{bumpWardrobeData(){}},
 '@/core/sps':{},'@/core/spsMaintenance':{},
 '@/core/wardrobeDrawingMigration':drawing,
 '@/components/mask-system/freeDraw/spsDrawing':{uploadSpsBlob:async()=>{events.push('upload');if(mode==='upload-fail')throw Error('upload');if(mode==='account')valid=false;if(mode==='edit')outfit=[{Group:'Cloth',Name:'New'}];return {v:4};}},
 '@/core/prompts':{askConfirm:async()=>mode!=='cancel'},
 '@/util/toast':{showToast:key=>events.push(key)},
 '@/i18n/i18n':{t:key=>key},
 };
 const exports={};vm.runInNewContext(compile('src/controllers/wardrobeMaintenanceController.ts'),{exports,require:key=>modules[key],Blob,atob,Uint8Array,console:{warn(){}}});
 await exports.migrateEmbeddedWardrobeDrawings();
 return {events,outfit,original};
}
let r=await run('success');assert.deepEqual(r.events.slice(0,4),['backup','upload','write','persist']);assert.equal(r.outfit[0].Property.CustomDraw,undefined);
for(const mode of ['upload-fail','save-false','save-throw']){r=await run(mode);assert.deepEqual(r.outfit,r.original);assert.ok(!r.events.includes('wardrobe-drawing-done'));}
r=await run('cancel');assert.equal(r.events.length,0);
r=await run('account');assert.ok(!r.events.includes('write'));
r=await run('edit');assert.ok(!r.events.includes('write'));assert.equal(r.outfit[0].Name,'New');
console.log('Drawing maintenance: backup ordering, cancellation, rollback and stale identity/content passed');
