import test from 'node:test';
import assert from 'node:assert/strict';
const { beginRotationDrag, rotationDragDegrees, normalizeRotationPreferences, rotationOptions, chooseLeverAxis, moveConstraint, dominantPlaneAxis } = await import('../src/rotation-drag.js');
for (const [plane,sign] of [['yz',1],['xz',-1],['xy',1]]) test(`MDLVis ${plane}: horizontal, fixed sign, speed and precision`,()=>{
 for(const x of [-80,0,80]) for(const facing of [-1,0,1]) for(const earlierTurns of [0,720]) {
  const d=beginRotationDrag({x,y:23,constrained:true,plane,axis:[0,0,facing],earlierTurns});
  assert.equal(rotationDragDegrees(d,40,200),sign*40);
 }
 const d=beginRotationDrag({constrained:true,plane,sensitivity:2,precision:.2});
 assert.equal(rotationDragDegrees(d,40,90,1.5,true),sign*24);
});
test('sweep wraps through 360, holds within 8 px, including edge-on axes',()=>{
 for(const z of [1,.01,1e-10,-1e-10,-.01,-1]) {
  const d=beginRotationDrag({x:40,y:0,axis:[0,0,z]}); const sign=z>0?-1:1;
  assert.equal(rotationDragDegrees(d,-40,40),sign*90);
  assert.equal(rotationDragDegrees(d,-40,0),sign*90);
  assert.equal(rotationDragDegrees(d,-80,0),sign*180);
  assert.equal(rotationDragDegrees(d,-40,-40),sign*270);
  assert.equal(rotationDragDegrees(d,0,0),sign*360);
 }
});
test('swept speed uses Rotation, DPI and Shift precision',()=>{
 for(const editor of ['vertices','bones','movement','forge']) {
  const options=rotationOptions({rotation:{sensitivity:2,precision:.1,editors:{[editor]:{sensitivity:.5}}}},editor);
  const d=beginRotationDrag({...options,x:40});
  assert.ok(Math.abs(rotationDragDegrees(d,-40,40,2,true)-9)<1e-10);
 }
 assert.deepEqual(normalizeRotationPreferences({behavior:'ring'}),{sensitivity:1,precision:.1,editors:{}});
});
test('lever waits for 6px then chooses only one of the other axes',()=>{
 const tangents={X:[0,0],Y:[-3,1],Z:[0,2]};
 assert.equal(chooseLeverAxis('X',tangents,3,3),null);
 assert.equal(chooseLeverAxis('X',tangents,10,0),'Y');
 assert.equal(chooseLeverAxis('X',tangents,0,10),'Z');
});
test('Shift on Move arrows selects perpendicular plane; squares select dominant axis',()=>{
 for(const [axis,plane] of [['X','yz'],['Y','xz'],['Z','xy']]) {
  assert.deepEqual(moveConstraint({axis},true),{plane,axis:null,dominant:false});
  assert.equal(moveConstraint({axis},false).axis,axis);
  const [a,b]=plane.toUpperCase().split(''),basis={[a]:[2,0],[b]:[0,2]};
  assert.equal(dominantPlaneAxis(plane,basis,30,10),a);
  assert.equal(dominantPlaneAxis(plane,basis,10,30),b);
  assert.equal(moveConstraint({plane},true).dominant,true);
 }
});

test('Shift precision changes the speed of subsequent motion without jumping on press or release',()=>{
 for(const constrained of [true,false]){
  const d=beginRotationDrag({x:100,constrained,plane:'xy'});
  const at=angle=>constrained?[angle,0]:[100*Math.cos(angle*Math.PI/180)-100,100*Math.sin(angle*Math.PI/180)];
  const run=(angle,shift)=>rotationDragDegrees(d,...at(angle),1,shift);
  assert.ok(Math.abs(run(40,false)-40)<1e-8);
  assert.ok(Math.abs(run(40,true)-40)<1e-8);
  assert.ok(Math.abs(run(50,true)-41)<1e-8);
  assert.ok(Math.abs(run(50,false)-41)<1e-8);
  assert.ok(Math.abs(run(60,false)-51)<1e-8);
 }
});
