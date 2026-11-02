import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {movementAxisHandles,movementDragAmount,gizmoMoveTranslation} from '../app/movement-overlay.js';
test('Move keeps the existing short-arrow speed near the viewing axis',()=>{
 for(const [axis,position] of [['X',[1000,20,15]],['Y',[20,1000,15]],['Z',[20,15,1000]]]){
  const camera=new PerspectiveCamera(45,1.4,.1,10000);camera.up.set(0,0,1);camera.position.set(...position);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const origin=new Vector3(),handle=movementAxisHandles({world:origin,x:400,y:300,visible:true},camera,800,600,100,'world','move').find(h=>h.axis===axis&&!h.plane);
  assert.ok(Math.hypot(handle.projectedDx,handle.projectedDy)<18);
  const length=Math.hypot(handle.dx,handle.dy),dx=handle.dx/length*20,dy=handle.dy/length*20;
  const actual=gizmoMoveTranslation({handle,origin,camera,width:800,height:600},dx,dy,false);
  assert.ok(Math.abs(actual['XYZ'.indexOf(axis)]-movementDragAmount(handle,dx,dy,'move'))<1e-8,'short arrow retains its old steady speed');
 }
});
