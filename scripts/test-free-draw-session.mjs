import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const item={Property:{},Asset:{Name:'Board',Group:{Name:'Canvas'}}};
const player={MemberNumber:1,Appearance:[item]};
const exports={};
const ctx=vm.createContext({exports,Player:player,
  document:{createElement:()=>({getContext:()=>({clearRect(){},getImageData:()=>({data:[0,0,0,255]}),putImageData(){}})})},
  require:name=>name==='../constants'?{DRAW_GROUPS:['Canvas'],DRAW_ASSET:'Board',SLOT_COUNT:1,BOARD_W:2,BOARD_H:2,MASK_PRIORITY:99}:{bustMaskTexture(){}},
});
vm.runInContext(compile('src/components/mask-system/freeDraw/slots.ts'),ctx);
const slot=exports.slots[0];
const first=exports.beginEditSession(slot,player,item);
assert.equal(exports.isEditorInteractive(),false);
assert.equal(exports.activateEditSession(first,{}, {},true),true);
assert.equal(exports.isEditorInteractive(),true);
exports.setSessionPhase(first,'saving'); assert.equal(exports.isEditorInteractive(),false);
exports.endEditSession(first);
const second=exports.beginEditSession(slot,player,item);
assert.equal(exports.isCurrentSession(first),false,'reopening same slot invalidates old async work');
assert.equal(exports.isCurrentSession(second),true);
player.Appearance=[{...item}];
assert.equal(exports.isCurrentSession(second),false,'replacement item invalidates target');
assert.equal(exports.endEditSession(second),true,'invalid target still allows cleanup');
player.Appearance=[item]; const third=exports.beginEditSession(slot,player,item);
ctx.Player={MemberNumber:2,Appearance:[item]};
assert.equal(exports.isCurrentSession(third),false,'account switch invalidates target');
exports.endEditSession(third);assert.equal(exports.A,null);
const size={};
vm.runInNewContext(compile('src/components/mask-system/freeDraw/appearanceSize.ts'),{
  exports:size,TextEncoder,require:name=>name.includes('appearanceBundle')?{bundleAppearance:()=>{throw new Error('serialize failed');}}:{PROP_KEY:'CustomDraw',PROP_SPS_KEY:'SPS'},
});
assert.throws(()=>size.projectedAppearanceBytes('data',{character:player,item}),/serialize failed/,'failed estimates cannot report zero');
console.log('Free draw session identity, cleanup, editing phases and failed estimates passed');
