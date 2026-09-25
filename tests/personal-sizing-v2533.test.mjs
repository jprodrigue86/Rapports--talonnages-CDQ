import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('personal-sizing-v2533.js','utf8');
const prefix='cdq-personal-sizing-v1:android:owner@example.invalid';
const curve=(v,low,high)=>v<=50?low+(1-low)*v/50:1+(high-1)*(v-50)/50;
function fixture(profile){const store=new Map(profile?[[prefix,JSON.stringify(profile)]]:[]);const c={document:{documentElement:{matches:()=>true},getElementById:()=>null},innerWidth:384,navigator:{userAgent:'BalanceCDQAndroid/25.34'},utilisateurCourantEmail:'owner@example.invalid',utilisateurCourantRole:'admin',localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},addEventListener(){}};c.window=c;vm.runInNewContext(source,c);return {c,store,api:c.cdqPersonalSizing};}
const profile={schema:1,anchor:{General:50,Text:71,Icon:100},position:{General:50,Text:50,Icon:50}};
test('standard 50 reproduces the former validated 50/71/100 rendering',()=>{
 const {api,store}=fixture(),anchors={General:50,Text:71,Icon:100};
 for(const [axis,anchor] of Object.entries(anchors)){
   assert.equal(api.factor(axis,50,x=>curve(x,.48,1.55)),curve(anchor,.48,1.55),axis);
   let last=-Infinity;
   for(let v=0;v<=100;v++){const value=api.factor(axis,v,x=>curve(x,.48,1.55));assert(value>last,axis+' monotonic '+v);last=value;}
 }
 assert.equal(store.size,0);
});
test('personal 50 returns the original 50/71/100 rendering without rounding',()=>{const {api}=fixture(profile);for(const [axis,anchor] of Object.entries(profile.anchor))for(const [lo,hi] of [[.78,1.25],[.78,1.35],[.65,1.5],[.48,1.5],[.45,1.55]])assert.equal(api.factor(axis,50,x=>curve(x,lo,hi)),curve(anchor,lo,hi));assert.equal(api.factor('Text',50,x=>curve(x,.78,1.35)),1.147);assert.equal(api.factor('Icon',50,x=>curve(x,.65,1.5)),1.5);});
test('both halves remain strictly increasing, including Icons past old 100',()=>{for(const axis of ['General','Text','Icon']){let last=-1;for(let v=0;v<=100;v++){const p=structuredClone(profile);p.position[axis]=v;const {api}=fixture(p);const value=api.factor(axis,50,x=>curve(x,.65,1.5));assert(value>last);last=value;}}});
test('profile is account/platform local; schema 1 and 2 are valid, malformed records fail closed',()=>{
 const {c,api,store}=fixture(profile);
 c.utilisateurCourantEmail='simon@example.invalid';assert.equal(api.current(),null);
 c.utilisateurCourantEmail='owner@example.invalid';c.navigator.userAgent='iPhone';assert.equal(api.current(),null);
 c.navigator.userAgent='BalanceCDQAndroid/25.34';store.set(prefix,JSON.stringify({...profile,schema:2,anchor:{General:50,Text:50,Icon:50}}));assert.equal(api.current().schema,2);
 store.set(prefix,'not JSON');assert.equal(api.current(),null);
 for(const bad of [{...profile,schema:3},{...profile,anchor:{...profile.anchor,Icon:101}},{...profile,position:{...profile.position,Text:'50'}}]){store.set(prefix,JSON.stringify(bad));assert.equal(api.current(),null);}
});
test('module contains no transport, real account identity or native-model targeting',()=>{assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|postMessage\s*\(|\.enregistrerPreferences|SM-S711|S25 Ultra|jp\.rodrigue86/);});
test('paired generated interfaces include guarded reset and calibration, no PDF change',()=>{for(const path of ['balance-cdq-android/app/build/generated/cdq-web-assets/cdq-web/Selector.html','iphone/app/Selector.html']){const html=fs.readFileSync(path,'utf8');assert.equal(html.split('id="cdqPersonalSizingV2533"').length,2);assert.match(html,/cdqPersonalSizing\.mount\(panels.sizes\)/);assert.match(html,/if\(window.cdqPersonalSizing\?\.current\(\)\)\{window.cdqPersonalSizing.reset\(\);return;\}/);assert.match(html,/cdqSafe/);assert.match(html,/cdqHomeUnderlineV2531|cdqHomeUnderline|cdq-home/);}});
