import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
const exports={}, data=new Map(), reads=[];
class Reader {
  readAsDataURL(blob) { blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onload();}); }
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/mask-system/freeDraw/spsDrawing.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports,Player:{MemberNumber:1},ChatRoomCharacter:[],CharacterLoadCanvas(){},console,
  crypto:webcrypto,Blob,TextEncoder,Uint8Array,ArrayBuffer,DataView,FileReader:Reader,
  require:name=>name==='@/core/sps'?{SPS_ORIGIN:'https://example.test',
    writeSpsPublic:async(key,blob)=>data.set(key,await blob.arrayBuffer()),
    readSpsPublic:async(owner,key,revision)=>{reads.push({owner,key,revision});return data.get(key)??null;},
  }:{PROP_SPS_KEY:'SPS'},
});
const a=await exports.uploadSpsBlob(0,new Blob(['A'],{type:'image/png'}));
const b=await exports.uploadSpsBlob(0,new Blob(['B'],{type:'image/png'}));
assert.equal(a.v,4);assert.notEqual(a.r,b.r);
assert.equal(await (await exports.downloadSpsDrawing(a)).text(),'A','new picture must preserve old wardrobe reference');
assert.equal(await (await exports.downloadSpsDrawing(b)).text(),'B');
data.set('liko-aee:FreeDraw/1',await new Blob(['A']).arrayBuffer());
assert.equal(await (await exports.downloadSpsDrawing({...a,v:2})).text(),'A');
assert.equal(reads.at(-1).revision,a.r,'legacy revision cache key retained');
assert.match(exports.cachedSpsDrawUrl({SPS:a}),/^data:image\/png/);
await assert.rejects(exports.uploadSpsBlob(3,new Blob(['x'])),/invalid_freedraw_slot/);
assert.equal(exports.readDrawRef({SPS:{...a,r:'invalid'}}),null);
console.log('Immutable SPS drawing history, old references and cache sources passed');
