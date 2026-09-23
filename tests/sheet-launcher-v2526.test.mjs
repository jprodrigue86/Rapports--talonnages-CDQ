import test from 'node:test';import assert from 'node:assert/strict';
import {openSheet,sheetWebUrl} from '../sheet-launcher-v2526.mjs';
const data={id:'sheet_test_123456',email:'tech@example.invalid'};
test('current Android hands Sheets to the native parent without navigating CDQ',()=>{
 let called;openSheet(data,{ua:'BalanceCDQAndroid/25.26',host:{BalanceCDQNative:{openSheet:(...args)=>called=args}},doc:null});assert.deepEqual(called,[data.id,data.email,false]);
});
test('browser and older APK open a separate context with no timer replacing the shell',()=>{
 for(const ua of ['Chrome desktop','Android Chrome','Android BalanceCDQAndroid/25.21']){
  let a;const doc={createElement:()=>a={style:{},click(){this.clicked=true},remove(){}},body:{append(){}}};
  openSheet(data,{ua,host:{},doc});assert.equal(a.target,'_blank');assert.equal(a.clicked,true);assert.equal(a.rel,'noopener');
  if(ua.includes('25.21'))assert.match(a.href,/scheme=cdqsheet/);else if(ua.includes('Android'))assert.match(a.href,/package=com.google.android.apps.docs.editors.sheets/);else assert.equal(new URL(a.href).host,'docs.google.com');
 }
 assert.match(sheetWebUrl({...data,readOnly:true}),/\/preview\?/);assert.throws(()=>sheetWebUrl({id:'../x'}));
});
