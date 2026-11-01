import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Euler} from 'three';
import {constrainedDegrees,beginSweep,sweepDegrees,chooseLeverAxis,dominantPlaneAxis,facingAxis,moveConstraint} from '../app/gizmo-lab-rules.js';
for(const [plane,sign]of [['yz',1],['xz',-1],['xy',1]])test(`MDLVis ${plane}: fixed direction and one degree per pixel regardless of DPI/camera/grab`,()=>{
 for(const dpi of [.2,.67,1,3])for(const tilt of [0,30,60,85,90,180])for(const grab of [-80,0,80]){
  assert.equal(constrainedDegrees({plane,strength:1,pointerSensitivity:dpi,cameraTilt:tilt,grab,earlierTurns:720},40,200),sign*40);
  assert.equal(constrainedDegrees({plane,strength:.5},40,0),sign*20);
  assert.equal(constrainedDegrees({plane,strength:1,snap:true},37,0),sign*30);
 }
});
test('swept angle holds within 8px, wraps and never uses ring projection',()=>{
 for(const z of [1,.5,.01,1e-10,-1e-10,-.01,-1]){
  const d=beginSweep({x:40,y:0,pivot:{x:0,y:0},facing:z});
  const sign=z>0?-1:1;
  assert.equal(sweepDegrees(d,0,40),sign*90);
  assert.equal(sweepDegrees(d,0,0),sign*90);
  assert.equal(sweepDegrees(d,-40,0),sign*180);
  assert.equal(sweepDegrees(d,0,-40),sign*270);
  assert.equal(sweepDegrees(d,40,0),sign*360);
 }
});
test('same three swept drags turn in the same direction',()=>{
 const results=Array.from({length:3},()=>sweepDegrees(beginSweep({x:40,y:-40,facing:1}),80,-40));
 assert.ok(results.every(v=>v===results[0]&&v<0));
});
test('lever waits for 6px and chooses the other axis with greatest projected push',()=>{
 const tangents={X:[0,0],Y:[-3,1],Z:[0,2]};
 assert.equal(chooseLeverAxis('X',tangents,3,3),null);
 assert.equal(chooseLeverAxis('X',tangents,10,0),'Y');
 assert.equal(chooseLeverAxis('X',tangents,0,10),'Z');
});
test('Move modifiers: arrows to perpendicular planes, squares to dominant in-plane axes',()=>{
 for(const axis of ['X','Y','Z']){
  const c=moveConstraint({axis},true);assert.equal(c.plane,{X:'yz',Y:'xz',Z:'xy'}[axis]);assert.equal(c.axis,null);
  assert.equal(moveConstraint({axis},false).axis,axis);
 }
 for(const plane of ['xy','xz','yz']){
  const axes=plane.toUpperCase().split(''),basis={[axes[0]]:[2,0],[axes[1]]:[0,2]};
  assert.equal(dominantPlaneAxis(plane,basis,30,10),axes[0]);
  assert.equal(dominantPlaneAxis(plane,basis,10,30),axes[1]);
  assert.deepEqual(moveConstraint({plane},false),{plane,axis:null,dominant:false});
  assert.equal(moveConstraint({plane},true).dominant,true);
 }
});
test('off-handle plane/axis is the world axis facing the camera most',()=>{
 assert.equal(facingAxis([.2,-.8,.3]),'Y');assert.equal(facingAxis([0,0,-1]),'Z');
});

test('constrained authored XYZ transforms agree with vRotate, including its different Y-axis equation',()=>{
 for(const [plane,axis]of [['yz',0],['xz',1],['xy',2]])for(const dx of [-37,37,180]){
  const a=-dx*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let [x,y,z]=[3,7,11];
  if(plane==='xy')[x,y]=[x*c+y*s,y*c-x*s];
  if(plane==='xz')[x,z]=[x*c+z*s,z*c-x*s];
  if(plane==='yz')[y,z]=[y*c+z*s,z*c-y*s];
  const degrees=[0,0,0];degrees[axis]=constrainedDegrees({plane},dx);
  const actual=new Vector3(3,7,11).applyEuler(new Euler(...degrees.map(v=>v*Math.PI/180)));
  assert.ok(actual.distanceTo(new Vector3(x,y,z))<1e-10);
  // mdlDraw scales Y by -1 for display; it does not negate authored vertex Y.
  const mdlvisDraw=new Vector3(x,-y,z),ourDataForThatDraw=actual.clone().multiply(new Vector3(1,-1,1));
  assert.ok(mdlvisDraw.distanceTo(ourDataForThatDraw)<1e-10);
 }
});
test('a sweep begun inside the 8px centre waits for a usable direction',()=>{
 const d=beginSweep({x:0,y:0});assert.equal(sweepDegrees(d,7,0),0);assert.equal(sweepDegrees(d,40,0),0);assert.equal(sweepDegrees(d,0,40),90);
});
