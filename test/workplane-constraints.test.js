import test from 'node:test';
import assert from 'node:assert/strict';
const { beginRotationDrag, rotationDragDegrees, normalizeRotationPreferences, rotationOptions, chooseLeverAxis, moveConstraint, dominantPlaneAxis } = await import('../src/rotation-drag.js');
for (const plane of ['yz','xz','xy']) test(`${plane}: constrained turn follows its fixed press direction, speed and precision`,()=>{
 for(const x of [-80,0,80]) for(const facing of [-1,0,1]) {
  const d=beginRotationDrag({x,y:23,constrained:true,plane,axis:[0,0,facing],tangent:{x:0,y:1}});
  assert.equal(rotationDragDegrees(d,40,200),200);
  assert.equal(rotationDragDegrees(d,40,-200),-200);
 }
 const d=beginRotationDrag({constrained:true,plane,tangent:{x:0,y:1},sensitivity:2,precision:.2});
 assert.equal(rotationDragDegrees(d,40,90,1.5,true),54);
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
  const d=beginRotationDrag({x:100,constrained,plane:'xy',tangent:{x:0,y:1}});
  const at=angle=>constrained?[0,angle]:[100*Math.cos(angle*Math.PI/180)-100,100*Math.sin(angle*Math.PI/180)];
  const run=(angle,shift)=>rotationDragDegrees(d,...at(angle),1,shift);
  assert.ok(Math.abs(run(40,false)-40)<1e-8);
  assert.ok(Math.abs(run(40,true)-40)<1e-8);
  assert.ok(Math.abs(run(50,true)-41)<1e-8);
  assert.ok(Math.abs(run(50,false)-41)<1e-8);
  assert.ok(Math.abs(run(60,false)-51)<1e-8);
 }
});

test('flat quad panes follow the dominant camera direction at drag start', async () => {
  const { lockedQuadPlane } = await import('../app/quad-view.js');
  for (const [plane, direction] of [['yz',[1,0,0]], ['xy',[0,0,1]], ['xz',[0,-1,0]]])
    assert.equal(lockedQuadPlane(plane, direction), plane);
  const tilt = 80 * Math.PI / 180;
  assert.equal(lockedQuadPlane('xy', [Math.sin(tilt),0,Math.cos(tilt)]), 'yz');
  assert.equal(lockedQuadPlane(null, [1,0,0]), null);
});

test('Forge precision override changes only shifted samples in a batch', () => {
  const preferences = { rotation: { precision: .1, editors: { forge: { precision: .25 } } } };
  for (const [editor, expected] of [['forge',25], ['movement',22]]) {
    const drag = beginRotationDrag({ constrained: true, tangent: { x: 1, y: 0 }, ...rotationOptions(preferences, editor) });
    for (const [dx, shift] of [[10,false], [20,false], [30,true], [40,true]])
      rotationDragDegrees(drag, dx, 0, 1, shift);
    assert.equal(drag.degrees, expected);
  }
});

test('ring and arc segments use the rotate threshold and ignore hidden line tips', async () => {
  const { pickMovementHandle } = await import('../app/movement-overlay.js');
  const ring = {ring:true, x:50, y:0, points:[{x:0,y:0},{x:50,y:0}]};
  assert.equal(pickMovementHandle([ring],20,9,'rotate'), ring);
  assert.equal(pickMovementHandle([ring],20,11,'rotate'), null);
  assert.equal(pickMovementHandle([ring],20,0,'tip'), null);
  assert.equal(pickMovementHandle([ring],50,0,'tip'), null);
  assert.equal(pickMovementHandle([ring],50,0,'rotate'), ring);
});
