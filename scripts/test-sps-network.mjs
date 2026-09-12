import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('src/core/sps.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const exports={}, calls=[], refreshes=[];
let handler=async()=>new Response('ok');
const player={MemberNumber:1};
const context=vm.createContext({exports,Player:player,AbortSignal,Headers,Response,TextEncoder,Blob,
  fetch:async(url,init)=>{calls.push({url,init});return handler(url,init);},
  require:()=>({studioOauthHeader:async(_,refresh)=>{refreshes.push(refresh);return 'auth';}}),
});
vm.runInContext(code,context);
handler=async()=>new Response('denied',{status:401});
await assert.rejects(exports.writeSpsText('x','y'),/401/);
assert.equal(calls.length,2,'401 retry must be bounded');
assert.deepEqual(refreshes,[false,true]);
calls.length=0;
await assert.rejects(exports.spsRequest('x',{signal:AbortSignal.abort()}));
assert.equal(calls.length,0,'already cancelled request must not be sent');
handler=async()=>{context.Player={MemberNumber:2};return new Response('ok');};
await assert.rejects(exports.readSpsText('x'),/account_changed/);
context.Player=player;
let readBody=false;
handler=async()=>({status:200,statusText:'OK',headers:new Headers(),async arrayBuffer(){readBody=true;return new TextEncoder().encode('body').buffer;}});
assert.equal(await exports.readSpsText('x'),'body');assert.equal(readBody,true);
const signal=calls.at(-1).init.signal;assert.ok(signal instanceof AbortSignal);
await exports.readSpsPublic(1,'drawing','hash');
assert.ok(calls.at(-1).url.endsWith('?v=hash'),'legacy revision remains in public URL');
console.log('SPS bounded retry, cancellation, identity and response-body consumption passed');
