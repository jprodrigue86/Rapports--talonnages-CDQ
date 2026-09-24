import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {adaptIphoneRpc} from '../scripts/iphone-rpc-compat.mjs';
const original=fs.readFileSync((process.env.CDQ_ASSET_SOURCE||'balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web')+'/embedded-rpc.js','utf8');
const source=adaptIphoneRpc(original);
const origin='https://real-script.googleusercontent.com';
function harness(){
 const listeners=new Map(),sent=[],success=[],failure=[],timers=new Map();let seq=0;
 const frame={setAttribute(){},contentWindow:null};
 const ctx={URL,Proxy,Map,Set,Error,Event,crypto:{randomUUID:()=> 'a'.repeat(36)},navigator:{onLine:true},location:{origin:'https://jprodrigue86.github.io'},
  document:{body:{append(){}},createElement:()=>frame},
  setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout(id){timers.delete(id);},
  addEventListener(type,fn){listeners.set(type,fn);},dispatchEvent(){}};
 ctx.window=ctx;ctx.parent=ctx;
 const outer={parent:ctx},relay={parent:outer},peer={parent:relay,postMessage:(data,to)=>sent.push({data,to})};
 const sibling={parent:outer},foreign={parent:ctx};frame.contentWindow=outer;
 vm.runInNewContext(source,ctx);
 const channel=new URL(frame.src).searchParams.get('channel');
 const event=(from,data,fromOrigin=origin)=>listeners.get('message')({source:from,origin:fromOrigin,data:{protocol:1,channel,...data}});
 const ready=(from=peer)=>event(from,{type:'CDQ_EMBEDDED_READY'});
 const call=()=>ctx.google.script.run.withSuccessHandler(v=>success.push(v)).withFailureHandler(e=>failure.push(e.message)).obtenirEtatAcces('','');
 const result=(from=peer,extra={},fromOrigin=origin)=>event(from,{type:'CDQ_EMBEDDED_RESULT',id:sent.at(-1)?.data.id||'1',ok:true,value:'test-result',...extra},fromOrigin);
 return {ctx,outer,relay,peer,sibling,foreign,frame,sent,success,failure,timers,ready,call,result};
}
test('original source retained and adaptation fails closed after anchors change',()=>{
 assert.ok(original.includes('event.source===peer&&event.origin===peerOrigin'));
 assert.throws(()=>adaptIphoneRpc(source));
 assert.ok(source.includes('!trusted(event)'));
 assert.ok(source.includes('data.channel!==channel'));
 assert.ok(source.includes('if(peer&&peer!==event.source)return;'));
 assert.equal(fs.readFileSync('iphone/app/embedded-rpc.js','utf8'),source);
});
for(const who of ['peer','relay'])test('accepts one checked transport reply from exact '+who,()=>{
 const h=harness();h.call();assert.equal(h.sent.length,0);h.ready();assert.equal(h.sent.length,1);
 h.result(h[who]);h.result(h[who]);assert.deepEqual(h.success,['test-result']);assert.deepEqual(h.failure,[]);
});
for(const who of ['sibling','foreign','outer'])test('rejects reply from '+who+' even with matching channel',()=>{
 const h=harness();h.ready();h.call();h.result(h[who]);assert.equal(h.success.length,0);h.result(h.relay);assert.equal(h.success.length,1);
});
for(const bad of ['https://evil.example','null','http://real-script.googleusercontent.com','https://real-script.googleusercontent.com:444','https://other-script.googleusercontent.com'])test('rejects origin '+bad,()=>{
 const h=harness();h.ready();h.call();h.result(h.relay,{},bad);assert.equal(h.success.length,0);h.result();assert.equal(h.success.length,1);
});
for(const extra of [{channel:'bad'},{protocol:2},{id:'wrong'},{ok:'true'}])test('rejects altered packet '+JSON.stringify(extra),()=>{
 const h=harness();h.ready();h.call();h.result(h.relay,extra);assert.equal(h.success.length,0);h.result();assert.equal(h.success.length,1);
});
test('does not accept a result before handshake or send the queued call twice',()=>{
 const h=harness();h.call();h.result(h.relay);assert.equal(h.success.length,0);
 h.ready();h.ready(h.sibling);h.ready();assert.equal(h.sent.length,1);h.result(h.relay);assert.equal(h.success.length,1);
});
test('server failures propagate through the pinned relay without retries',()=>{
 const h=harness();h.ready();h.call();h.result(h.relay,{ok:false,error:'Server failure'});
 assert.deepEqual(h.failure,['Server failure']);assert.equal(h.sent.length,1);
});
test('read timeout is clear and no timed-out operation is replayed',()=>{
 const h=harness();h.ready();h.call();for(const fn of [...h.timers.values()])fn();
 assert.equal(h.failure.length,1);assert.match(h.failure[0],/vérification de connexion/);h.ready();assert.equal(h.sent.length,1);h.result(h.relay);assert.equal(h.success.length,0);
});
