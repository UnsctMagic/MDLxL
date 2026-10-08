import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,OrthographicCamera,Vector3,Quaternion} from 'three';
import {markerStyle,rigMarkerGeometry} from '../app/rig-markers-gl.js';
import {normalizePreferences} from '../src/preferences.js';
import {pickMovementNode} from '../app/movement-overlay.js';
test('Move grabs the selected overlapping marker while Select still cycles the stack',()=>{
 const points=[1,2].map(id=>({node:{ObjectId:id},visible:true,x:20,y:30}));
 assert.equal(pickMovementNode(points,20,30,[1]).node.ObjectId,2);
 assert.equal(pickMovementNode(points,20,30,[1],13,true).node.ObjectId,1);
});

test('circled symbols retain readable sizes when zooming out and have a close-up ceiling',()=>{
 const camera=new OrthographicCamera(-200,200,200,-200,.1,1000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const point={node:{ObjectId:0},overlayKind:'sounds',visible:true,world:new Vector3(),rotation:new Quaternion(),billboardRotation:camera.quaternion};
 const width=zoom=>{
  camera.zoom=zoom;camera.updateProjectionMatrix();point.unitsPerPixel=400/zoom/800;
  const geometry=rigMarkerGeometry([point],[],{sounds:true,modelRadius:100});const xs=[];
  for(let i=0;i<geometry.triangles.length;i+=6)xs.push(new Vector3().fromArray(geometry.triangles,i).project(camera).x*400);
  return Math.max(...xs)-Math.min(...xs);
 };
 assert.ok(width(.025)>=20);assert.ok(width(.25)>=20);
 assert.ok(width(2)>width(.25));
 assert.ok(width(10)<29);assert.ok(Math.abs(width(10)-width(20))<.001);
});
test('emitters use a camera-facing pentagram ring with normal marker alternatives',()=>{
 const point={node:{ObjectId:0},overlayKind:'particles',visible:true,world:new Vector3(),rotation:new Quaternion(),unitsPerPixel:1};
 const byId=new Map([[0,point]]),shape=markerStyle(point,byId,{}).shape;
 assert.equal(shape.billboard,true);assert.equal(shape.faces.length,37);
 assert.equal(markerStyle(point,byId,{emitterMarker:'tetrahedron'}).shape.vertices.length,4);
 assert.equal(markerStyle(point,byId,{emitterMarker:'cube'}).shape.vertices.length,8);
 const projections=[];
 for(const position of [[0,0,100],[100,0,0],[0,100,.1]]){
  const camera=new PerspectiveCamera(45,1,.1,1000);camera.position.set(...position);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  point.billboardRotation=camera.quaternion;
  const geometry=rigMarkerGeometry([point],[],{particles:true});
  const points=[];for(let i=0;i<geometry.triangles.length;i+=6){const p=new Vector3().fromArray(geometry.triangles,i).project(camera);points.push([p.x,p.y]);}
  projections.push(points);
 }
 for(const points of projections.slice(1))for(let i=0;i<points.length;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(points[i][axis]-projections[0][i][axis])<.00001);
 assert.equal(normalizePreferences({emitterMarker:'cube'}).emitterMarker,'cube');
 assert.equal(normalizePreferences({emitterMarker:'invalid'}).emitterMarker,'pentagram');
});

test('VIS uses the original polyhedra at their original screen size for every node family',()=>{
 const camera=new OrthographicCamera(-200,200,200,-200,.1,1000);camera.position.set(0,0,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 for(const kind of ['bones','attachments','particles','ribbons','sounds','events']){
  const point={node:{ObjectId:0,Name:'SPLxTEST'},eventNode:['sounds','events'].includes(kind),overlayKind:kind,visible:true,world:new Vector3(),rotation:new Quaternion(),billboardRotation:camera.quaternion};
  const style=markerStyle(point,new Map(),{},new Map(),true);assert.equal(style.shape.billboard,undefined);assert.equal(style.shape.vertices.length,kind==='bones'?8:4);
  const widths=[];
  for(const zoom of [.25,1,10]){camera.zoom=zoom;camera.updateProjectionMatrix();point.unitsPerPixel=400/zoom/800;const geometry=rigMarkerGeometry([point],[],{[kind]:true,vanilla:true,modelRadius:100});const xs=[];for(let i=0;i<geometry.triangles.length;i+=6)xs.push(new Vector3().fromArray(geometry.triangles,i).project(camera).x*400);widths.push(Math.max(...xs)-Math.min(...xs));}
  for(const width of widths)assert.ok(Math.abs(width-18)<.001,kind+' retains original zoom sizing');
 }
});
