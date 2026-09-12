import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
class AuthError extends Error {constructor(code,status){super(code);this.code=code;this.status=status;}}
const exports={}, calls=[];
let hold, failKey=false, generated=0;
const player = n => ({MemberNumber:n,ExtensionSettings:{StudioOAuth:{registeredAs:n,privateJwk:{x:`key${n}`}}}});
const context=vm.createContext({exports,Player:player(1),AbortSignal,atob,console,
  ServerPlayerExtensionSettingsSync(){},ServerSend(){throw new Error('unexpected registration');},
  require:()=>({AuthError,generateKey:async()=>{generated++;if(failKey){failKey=false;throw new Error('key_failed');}return {privateJwk:{x:'generated'}};},
    selfSign:async(typ,payload,key)=>JSON.stringify({typ,payload,key}),
    authHeader:async(key,token)=>({authorization:`${key.x}:${token}`}),
  }),
  fetch:async(_,init)=>{
    const {payload}=JSON.parse(init.body);calls.push(payload.sub);
    if(payload.sub==='1') await new Promise(resolve=>{hold=resolve;});
    return {ok:true,json:async()=>({token:Buffer.from(JSON.stringify({expires:Date.now()/1000+300})).toString('base64url')+`.${payload.sub}`})};
  },
});
vm.runInContext(ts.transpileModule(fs.readFileSync('src/core/studioOauth.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,context);
const old=exports.studioOauthHeader('resource');
const rejected=assert.rejects(old,/account_changed/);
while(!hold) await new Promise(resolve=>setImmediate(resolve));
context.Player=player(2);
const [a,b]=await Promise.all([exports.studioOauthHeader('resource'),exports.studioOauthHeader('resource')]);
assert.equal(a,b);assert.match(a,/^key2:/);assert.equal(calls.filter(n=>n==='2').length,1,'concurrent token requests share work');
hold();await rejected;
await exports.studioOauthHeader('resource');assert.equal(calls.filter(n=>n==='2').length,1,'valid account token is cached');
await exports.studioOauthHeader('resource',true);assert.equal(calls.filter(n=>n==='2').length,2,'401 refresh invalidates cached token');
context.Player=player(3);delete context.Player.ExtensionSettings.StudioOAuth.privateJwk;failKey=true;
await assert.rejects(exports.studioOauthHeader('resource'),/key_failed/);
assert.match(await exports.studioOauthHeader('resource'),/^generated:/);assert.equal(generated,2,'failed identity creation can retry');
console.log('OAuth account isolation, pending request sharing, forced refresh and key retry passed');
