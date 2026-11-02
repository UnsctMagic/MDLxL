import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { normalizeRotationPreferences, rotationOptions, ROTATION_EDITORS, beginRotationDrag, rotationDragDegrees } from '../src/rotation-drag.js';

test('old and fresh profiles use common 3D rules, preserving per-editor speeds and pointer settings', () => {
 const prefs=normalizePreferences({pointerSensitivity:.4,uvSensitivity:.7,rotation:{behavior:'ring',sensitivity:2,editors:{bones:{behavior:'linear'},forge:{sensitivity:.25}}}});
 assert.deepEqual(prefs.rotation,{sensitivity:2,precision:.1,editors:{forge:{sensitivity:.25}}});
 for(const editor of Object.keys(ROTATION_EDITORS)) assert.deepEqual(rotationOptions(prefs,editor),{sensitivity:editor==='forge'?.25:2,precision:.1});
 assert.equal(prefs.pointerSensitivity,.4);assert.equal(prefs.uvSensitivity,.7);
});
test('speed overrides and precision survive portable export/import and inherit later default changes',()=>{
 const prefs=normalizePreferences({rotation:{sensitivity:2,precision:.2,editors:{bones:{sensitivity:.3},forge:{sensitivity:.25}}}});
 assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))).rotation,prefs.rotation);
 const changed=normalizePreferences({...prefs,rotation:{...prefs.rotation,sensitivity:3}});
 assert.deepEqual(rotationOptions(changed,'forge'),{sensitivity:.25,precision:.2});
 assert.deepEqual(rotationOptions(changed,'movement'),{sensitivity:3,precision:.2});
});
test('invalid data cannot reverse, zero or make speed infinite',()=>{
 assert.deepEqual(normalizeRotationPreferences({behavior:'arc',sensitivity:null,editors:{bones:{sensitivity:'oops'},unknown:{sensitivity:2}}}),{sensitivity:1,precision:.1,editors:{}});
 for(const [value,expected] of [[-3,.01],[999,4],[Infinity,1]]) assert.equal(normalizeRotationPreferences({sensitivity:value}).sensitivity,expected);
 assert.equal(normalizeRotationPreferences({precision:2}).precision,1);
});
test('every sample counts across a full turn; speed and sign are fixed through repeated drags',()=>{
 for(const z of [-1,.000001,1]) for(let turn=0;turn<3;turn++){
  const d=beginRotationDrag({x:100,axis:[0,0,z],sensitivity:.5});
  for(let degree=15;degree<=360;degree+=15){const a=degree*Math.PI/180;assert.ok(Math.abs(rotationDragDegrees(d,100*Math.cos(a)-100,100*Math.sin(a),2)-degree*(z>0?-1:1))<1e-8);}
 }
});
test('centre hold has no linear fallback, even on an edge-on ring',()=>{
 const d=beginRotationDrag({x:0,y:0,axis:[1,0,0]});
 assert.equal(rotationDragDegrees(d,7,0),0);assert.equal(rotationDragDegrees(d,40,0),0);
 assert.equal(rotationDragDegrees(d,0,40),90);assert.equal(rotationDragDegrees(d,0,0),90);
});
