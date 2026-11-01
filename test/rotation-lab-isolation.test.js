import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {Euler,Quaternion,Vector3,PerspectiveCamera} from 'three';
import {beginRotationDrag,rotationDragDegrees} from '../src/rotation-drag.js';
import {freeTurn} from '../src/rotation-lab-styles.js';
import {transformVertices} from '../src/editor-commands.js';
import {transformLabSource} from '../scripts/rotation-lab-transform.mjs';
const file=path.resolve(`out/lab-adapter-${process.pid}.mjs`);
await fs.mkdir(path.dirname(file),{recursive:true});
const bundled=await build({entryPoints:['app/rotation-lab.jsx'],bundle:true,platform:'node',packages:'external',format:'esm',write:false,loader:{'.css':'empty'}});
let code=bundled.outputFiles[0].text;
if(process.env.MDLXL_LAB_BAD_ORDER==='1')code=code.replace('setFromQuaternion(q, "ZYX")','setFromQuaternion(q, "XYZ")');
await fs.writeFile(file,code);
let adapter;try{adapter=await import(pathToFileURL(file));}finally{await fs.unlink(file);}
test('without lab injection every product drag state and angle stays identical',()=>{
 assert.deepEqual(adapter.beginRotationDrag(),beginRotationDrag());
 for(const behavior of ['ring','linear','pivot'])for(const axis of [[0,0,1],[1,0,0],[.2,.5,-.84]]){
  const o={behavior,axis,x:50,y:35,pivot:{x:10,y:10},sensitivity:.37};
  const product=beginRotationDrag(o),lab=adapter.beginRotationDrag(o);
  assert.deepEqual(lab,product);
  for(const [dx,dy]of [[20,10],[-50,40],[-50,-40],[0,0]])assert.equal(adapter.rotationDragDegrees(lab,dx,dy,.67),rotationDragDegrees(product,dx,dy,.67));
 }
});
test('A injected into the real editor is exactly today’s ring rule',()=>{
 for(const axis of [[0,0,1],[1,0,0],[.2,.5,-.84]]){
  const o={behavior:'ring',axis,x:50,y:35,pivot:{x:10,y:10},sensitivity:.37};
  const product=beginRotationDrag(o),lab=adapter.beginRotationDrag({...o,lab:true});
  for(const [dx,dy]of [[20,10],[-50,40],[-50,-40],[0,0]])assert.equal(adapter.rotationDragDegrees(lab,dx,dy,.67),rotationDragDegrees(product,dx,dy,.67));
 }
});
test('E preview and committed vertex transform agree with screen-axis quaternion at all tilts',()=>{
 for(const tilt of [30,60,85])for(const [dx,dy]of [[40,0],[0,40],[40,25]]){
  const camera=new PerspectiveCamera();camera.position.set(Math.sin(tilt*Math.PI/180)*100,-60,Math.cos(tilt*Math.PI/180)*100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const d={...freeTurn.begin(),labChoice:{style:'E',unit:true},labRule:freeTurn};
  const preview=adapter.labEuler(d,dx,dy,1,false,camera,2);
  const up=new Vector3(0,1,0).applyQuaternion(camera.quaternion),right=new Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const expected=new Quaternion().setFromAxisAngle(up,dx*Math.PI/180).multiply(new Quaternion().setFromAxisAngle(right,dy*Math.PI/180));
  const point=new Vector3(30,20,10),oracle=point.clone().applyQuaternion(expected);
  const g={Vertices:new Float32Array(point.toArray())};
  transformVertices(g,[0],[0,0,0],[1,1,1],[preview.x,preview.y,preview.z].map(v=>v*180/Math.PI),[0,0,0]);
  assert.ok(point.clone().applyEuler(preview).distanceTo(oracle)<1e-9,'free-turn preview must follow the screen axes');
  assert.ok(new Vector3().fromArray(g.Vertices).distanceTo(oracle)<1e-5,'free-turn commit must equal the preview');
 }
});
test('build hooks leave real source unchanged and reject drift',async()=>{
 for(const name of ['App.jsx','Viewport.jsx']){
  const file=path.resolve('app',name),source=await fs.readFile(file,'utf8');
  assert.notEqual(transformLabSource(source,file.replaceAll('\\','/')),source);
  assert.equal(await fs.readFile(file,'utf8'),source);
 }
 assert.throws(()=>transformLabSource('changed upstream','/app/Viewport.jsx'),/hook drifted/);
 const config=await fs.readFile('vite.config.js','utf8');assert.ok(!config.includes('rotation-lab'));
});
