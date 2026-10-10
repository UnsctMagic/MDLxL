import test from 'node:test';
import assert from 'node:assert/strict';
import { poseSkeletonHighlights } from '../app/pose-overlay.js';
import { boneConnectionVisible } from '../app/movement-overlay.js';
import { rigMarkerGeometry } from '../app/rig-markers-gl.js';
import { Vector3, Quaternion } from 'three';

test('POSE limb focus covers its joints without sibling or endpoint child branches', () => {
  const nodes=[{ObjectId:0,Parent:-1},{ObjectId:1,Parent:0},{ObjectId:2,Parent:1},{ObjectId:3,Parent:2},{ObjectId:4,Parent:0},{ObjectId:5,Parent:3}];
  const points=nodes.map(node=>({node,overlayKind:'bones',visible:true,x:node.ObjectId*10,y:0,world:new Vector3(node.ObjectId,0,0),rotation:new Quaternion(),unitsPerPixel:1}));
  const config={body:0,chains:[{key:'leg',root:1,middle:2,end:3}],target:{kind:'endpoint',key:'leg'}};
  const highlights=poseSkeletonHighlights(points,{Nodes:nodes,Bones:nodes},config);
  assert.deepEqual([...highlights],[[1,'#ff0000'],[2,'#ffff00'],[3,'#ffff00'],[0,'#000000']]);
  assert.deepEqual(points.filter(point=>{const parent=points.find(p=>p.node.ObjectId===point.node.Parent);return parent&&boneConnectionVisible(parent,point,highlights,true);}).map(p=>p.node.ObjectId),[1,2,3]);
  assert.equal(poseSkeletonHighlights(points,{Nodes:nodes,Bones:nodes},{...config,target:null}).size,0);
  const hidden=rigMarkerGeometry(points,[],{bones:false,focusedBoneMarkers:false,boneHighlights:highlights});
  assert.equal(hidden.triangles.length,0);
  const shown=rigMarkerGeometry(points,[],{bones:true,focusedBoneMarkers:false,boneHighlights:highlights});
  assert.ok(shown.triangles.length>0,'User can toggle bone symbols back on');
});
