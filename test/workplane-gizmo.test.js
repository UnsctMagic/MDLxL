import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Quaternion} from 'three';
import {beginGizmoRotation,gizmoMoveTranslation,movementAxisHandles,pickMovementHandle} from '../app/movement-overlay.js';
import {rotationDragDegrees} from '../src/rotation-drag.js';
const camera=()=>{const c=new PerspectiveCamera(45,1.4,.1,10000);c.up.set(0,0,1);c.position.set(300,-400,250);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;};
for(const editor of ['vertices','bones','movement','forge'])test(`${editor}: actual gizmo path applies speed overrides, DPI and precision`,()=>{
 const c=camera(),world=new Vector3();
 const options={x:400,y:300,world,camera:c,width:800,height:600,workplaneEnabled:true,workplane:'xz',preferences:{rotation:{sensitivity:3,precision:.2,editors:{[editor]:{sensitivity:.5}}}},editor};
 assert.equal(rotationDragDegrees(beginGizmoRotation(options),40,120,.67,true),-2.68);
 const a=beginGizmoRotation({...options,space:'local',rotation:new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)});
 assert.ok(a.directions.X.distanceTo(new Vector3(0,1,0))<1e-10);
});
test('Move handles switch constraints in the middle of a drag without changing visible position',()=>{
 const c=camera(),base={camera:c,origin:new Vector3(),handle:{axis:'X'},width:800,height:600};
 const a=gizmoMoveTranslation(base,20,8,false),b=gizmoMoveTranslation(base,20,8,true);assert.deepEqual(b,a);
 const d=gizmoMoveTranslation(base,30,18,true);assert.equal(d[0],a[0]);assert.ok(Math.hypot(d[1],d[2])>0);
 const e=gizmoMoveTranslation(base,30,18,false);assert.deepEqual(e,d);
 const square={camera:c,origin:new Vector3(),handle:{axis:'XY',plane:'xy'},width:800,height:600};
 const s=gizmoMoveTranslation(square,10,30,true);assert.equal(s.filter(v=>Math.abs(v)>1e-9).length,1);assert.equal(s[2],0);
});
test('Lines, Rings and Arcs use visible pickable handles in every camera view',()=>{
 for(const position of [[300,-400,250],[500,0,0],[0,0,500]])for(const style of ['lines','rings','arcs']){
  const c=camera();c.position.set(...position);c.lookAt(0,0,0);c.updateMatrixWorld(true);
  const active={world:new Vector3(),x:400,y:300,visible:true,rotation:new Quaternion()};const handles=movementAxisHandles(active,c,800,600,100,'world','rotate',{rotateHandles:style});assert.equal(handles.length,3);
  for(const h of handles){const at=h.ring?h.points[25]:h;assert.ok(pickMovementHandle(handles,at.x,at.y,'rotate'),'a visible handle is pickable');}
 }
});
