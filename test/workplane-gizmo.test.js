import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,OrthographicCamera,Vector3,Quaternion} from 'three';
import {beginGizmoRotation,constrainedRotationTangent,gizmoMoveTranslation,movementAxisHandles,pickMovementHandle} from '../app/movement-overlay.js';
import {rotationDragDegrees} from '../src/rotation-drag.js';
const camera=()=>{const c=new PerspectiveCamera(45,1.4,.1,10000);c.up.set(0,0,1);c.position.set(300,-400,250);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;};
for(const editor of ['vertices','bones','movement','forge'])test(`${editor}: actual gizmo path applies speed overrides, DPI and precision`,()=>{
 const c=camera(),world=new Vector3();
 const options={x:400,y:300,world,camera:c,width:800,height:600,workplaneEnabled:true,workplane:'xz',preferences:{rotation:{sensitivity:3,precision:.2,editors:{[editor]:{sensitivity:.5}}}},editor};
 const drag=beginGizmoRotation(options);
 assert.ok(Math.abs(rotationDragDegrees(drag,drag.tangent.x*40,drag.tangent.y*40,.67,true)-2.68)<1e-10);
 const a=beginGizmoRotation({...options,space:'local',rotation:new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)});
 assert.ok(a.directions.X.distanceTo(new Vector3(0,1,0))<1e-10);
});
test('plane-facing press to the right has a vertical arrow; edge-on arrow follows the visible plane line',()=>{
 const c=camera(),world=new Vector3();
 c.up.set(0,1,0);
 c.position.set(0,0,500);c.lookAt(world);c.updateMatrixWorld(true);
 const face=constrainedRotationTangent({x:500,y:300,world,camera:c,width:800,height:600,normal:new Vector3(0,0,1)});
 assert.ok(Math.abs(face.x)<1e-8 && face.y<-.99);
 c.up.set(0,0,1);
 c.position.set(500,0,0);c.lookAt(world);c.updateMatrixWorld(true);
 const edge=constrainedRotationTangent({x:400,y:300,world,camera:c,width:800,height:600,normal:new Vector3(0,0,1)});
 assert.ok(Math.abs(edge.x)>.99 && Math.abs(edge.y)<1e-8);
});
test('every camera angle and editor turns positively along its captured arrow and negatively back',()=>{
 for(const position of [[0,0,500],[500,0,0],[300,-400,250],[-250,350,100]])for(const editor of ['vertices','bones','movement','forge'])for(const plane of ['xy','xz','yz']){
  const c=camera();c.position.set(...position);c.lookAt(0,0,0);c.updateMatrixWorld(true);
  const drag=beginGizmoRotation({x:460,y:340,world:new Vector3(),camera:c,width:800,height:600,workplaneEnabled:true,workplane:plane,editor});
  const {x,y}=drag.tangent;assert.ok(Math.abs(Math.hypot(x,y)-1)<1e-9);
  assert.ok(Math.abs(rotationDragDegrees(drag,x*40,y*40)-40)<1e-8);
  assert.ok(Math.abs(rotationDragDegrees(drag,-x*40,-y*40)+40)<1e-8);
  assert.ok(Math.abs(rotationDragDegrees(drag,(-x-y)*40,(-y+x)*40)+40)<1e-8,'cross-arrow motion does not turn');
 }
});
test('the same 40 px hand motion along the arrow gives 40 degrees in every quad pane and editor',()=>{
 for(const [plane,position] of [['yz',[500,0,0]],['xy',[0,0,500]],['xz',[0,-500,0]],['xy',[300,-400,250]]])for(const editor of ['vertices','bones','movement','forge']){
  const c=new OrthographicCamera(-200,200,150,-150,.1,10000);c.up.set(0,0,1);c.position.set(...position);c.lookAt(0,0,0);c.updateMatrixWorld(true);
  const drag=beginGizmoRotation({x:450,y:325,world:new Vector3(),camera:c,width:800,height:600,workplaneEnabled:true,workplane:plane,editor});
  assert.ok(Math.abs(rotationDragDegrees(drag,drag.tangent.x*40,drag.tangent.y*40)-40)<1e-8);
 }
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
