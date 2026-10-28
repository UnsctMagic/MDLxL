import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createStarterDocument } from '../src/starter-model.js';
import { checkSanity, sanityLocation } from '../src/sanity-check.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js', import.meta.url), 'utf8'));
const hive = async bytes => {const m = new ModelViewer.parsers.mdlx.Model();m.load(bytes.slice().buffer);const r = ModelViewer.utils.mdlx.sanityTest(m);return {...r,findings:flattenHiveFindings(r.nodes)};};
test('current unsaved data is checked without mutation, including Hive notices', async () => {
 const m = createStarterDocument().model, before = structuredClone(m);
 const result = await checkSanity(m, hive);
 assert.deepEqual(m,before); assert.ok(result.hive); assert.equal(result.status,'Review findings');
 m.Geosets[0].MaterialID = 123456;
 const broken = await checkSanity(m, hive);
 assert.ok(broken.structural.some(f=>f.code==='MATERIAL_REFERENCE')); assert.equal(broken.hive,null); assert.equal(broken.status,'Structural errors found');
});
test('modern formats and failed Hive execution cannot claim a complete pass', async () => {
 const m = createStarterDocument().model;
 m.Version=1000; assert.equal((await checkSanity(m, hive)).status,'Check partially completed');
 m.Version=800; const r=await checkSanity(m,async()=>{throw Error('unavailable');}); assert.match(r.limitation,/unavailable/); assert.equal(r.status,'Check partially completed');
});
test('displayed geoset positions are one based and node identities stay literal', () => {
 assert.equal(sanityLocation('Geosets[0].Groups[3] Nodes[7]'),'Geosets 1.Groups[3] Nodes[7]');
});
test('native Help menu dispatches Sanity Check', () => {
 const {buildMenuTemplate}=require('../electron/menu.cjs'); let action;
 buildMenuTemplate({}, id=>action=id).find(x=>x.label==='Help').submenu.find(x=>x.label==='Sanity Check').click();
 assert.equal(action,'sanityCheck');
});
test('Blizzard zero-duration globals remain warnings; invalid durations remain errors', async () => {
 const m = createStarterDocument().model; m.GlobalSequences=[0];
 const r=await checkSanity(m,hive); assert.equal(r.errors,0);assert.ok(r.structural.some(f=>f.code==='GLOBAL_SEQUENCE_DURATION'&&f.severity==='warning'));
 m.GlobalSequences=[-1];assert.ok((await checkSanity(m,hive)).errors>0);
});
test('empty event objects are reported before serialization', async () => {
 const m=createStarterDocument().model; const {createNode}=await import('../src/editor-document.js');
 createNode(m,'EventObject').EventTrack=new Uint32Array();
 assert.ok((await checkSanity(m,hive)).structural.some(f=>f.code==='EMPTY_EVENT_TRACK'));
});
test('parser errors and opaque chunks cannot produce a clean result', async () => {
 const m=createStarterDocument().model;
 const r=await checkSanity(m,hive,[{severity:'error',code:'BAD_CHUNK',message:'Truncated source'}]); assert.equal(r.status,'Structural errors found');
 const opaque=await checkSanity(m,hive,[{severity:'info',code:'OPAQUE_DATA_PRESERVED',message:'Unknown chunk'}]);assert.equal(opaque.status,'Check partially completed');
});
