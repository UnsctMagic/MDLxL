import test from 'node:test';
import assert from 'node:assert/strict';
import { Color, OrthographicCamera, Quaternion, Vector3 } from 'three';
import { createRigMarkersGL, rigMarkerGeometry } from '../app/rig-markers-gl.js';
import { createPixelLineBatch, drawPixelLine } from '../app/pixel-lines.js';

function recordingGL() {
  let id=0;const calls=[];
  const gl=new Proxy({}, {get(target,key) {
    if(key in target)return target[key];
    if(key===key.toUpperCase())return target[key]=++id;
    if(key.startsWith('create'))return ()=>({id:++id});
    if(key==='getUniformLocation')return (_program,name)=>name;
    if(key==='getParameter')return ()=>[0,0,400,400];
    if(key.startsWith('get'))return ()=>true;
    return (...args)=>calls.push([key,...args]);
  }});
  return {gl,calls};
}
const attachment=id=>({node:{ObjectId:id},overlayKind:'attachments',visible:true,world:new Vector3(id,0,0),rotation:new Quaternion(),billboardRotation:new Quaternion(),unitsPerPixel:1});

test('attachment artwork is uploaded once per GL context and moving it changes only pose uniforms',()=>{
  const {gl,calls}=recordingGL(),renderer=createRigMarkersGL(gl),camera=new OrthographicCamera(-100,100,100,-100,.1,1000);
  camera.position.z=250;camera.updateMatrixWorld();
  const points=Array.from({length:14},(_,i)=>attachment(i)),options={attachments:true,occludedMarkerEdges:true};
  const geometry=rigMarkerGeometry(points,[],options);
  renderer.draw(camera,points,[],options);
  assert.equal(calls.filter(c=>c[0]==='bufferData'&&c[3]===gl.STATIC_DRAW).length,1,'identical icons share their unmodified artwork');
  const drawn=mode=>calls.filter(c=>c[0]==='drawArrays'&&c[1]===mode).reduce((sum,c)=>sum+c[3],0);
  assert.equal(drawn(gl.TRIANGLES),geometry.triangles.length/6);assert.equal(drawn(gl.LINES),geometry.edges.length/6);
  calls.length=0;points[0].world.set(9,8,7);points[0].billboardRotation.setFromAxisAngle(new Vector3(0,0,1),.4);
  renderer.draw(camera,points,[],options);
  assert.equal(calls.filter(c=>c[0]==='bufferData').reduce((sum,c)=>sum+c[2].byteLength,0),0,'animation does not resend symbol vertices');
  assert.ok(calls.some(c=>c[0]==='uniform3fv'&&c[1]==='world'&&c[2].join(',')==='9,8,7'));
  assert.ok(calls.some(c=>c[0]==='uniform4fv'&&c[1]==='rotation'&&Math.abs(c[2][2])>.1));
  renderer.dispose();assert.equal(calls.filter(c=>c[0]==='deleteBuffer').length,2);assert.equal(calls.filter(c=>c[0]==='deleteVertexArray').length,2);
  const other=recordingGL(),reopened=createRigMarkersGL(other.gl);reopened.draw(camera,points,[],options);
  assert.equal(other.calls.filter(c=>c[0]==='bufferData'&&c[3]===other.gl.STATIC_DRAW).length,1,'a new context owns its own resources');reopened.dispose();
});

test('hidden parents still determine the visible bone and Vanilla attachment colours',()=>{
  for(const kind of ['bones','attachments']){
    const {gl,calls}=recordingGL(),renderer=createRigMarkersGL(gl),camera=new OrthographicCamera(-100,100,100,-100,.1,1000);
    camera.position.z=250;camera.updateMatrixWorld();
    const parent={...attachment(0),overlayKind:'bones',visible:false},child={...attachment(1),overlayKind:kind,node:{ObjectId:1,Parent:0}};
    const points=[parent,child],options={bones:true,attachments:true,vanilla:true};
    const expected=rigMarkerGeometry(points,[],options).triangles;
    renderer.draw(camera,points,[],options);
    const upload=calls.find(c=>c[0]==='bufferData'&&c[3]===gl.DYNAMIC_DRAW);
    assert.deepEqual(upload[2],expected,`${kind} keeps its hidden parent colour`);renderer.dispose();
  }
});

function raster(width,height) {
  let data=new Uint8ClampedArray(width*height*4);
  return {canvas:{width,height},save(){},restore(){},setTransform(){},fillStyle:'#ffffff',
    createImageData:()=>({data:new Uint8ClampedArray(width*height*4)}),putImageData(image){data=image.data;},
    fillRect(x,y,w,h){const rgb=new Color(this.fillStyle).getHex();for(let yy=Math.max(0,y);yy<Math.min(height,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(width,x+w);xx++){const i=(yy*width+xx)*4;data.set([rgb>>16&255,rgb>>8&255,rgb&255,255],i);}},
    pixels:()=>data};
}
test('batched shaded Skeleton links retain the exact pixel stamps, gradient and overlap order',()=>{
  const shade=t=>{const c=Math.round(t*255);return `rgb(${c},${c},${c})`;};
  for(const ratio of [1,1.25,2]){
    const before=raster(120,90),after=raster(120,90),batch=createPixelLineBatch(after);
    for(const [from,to,width,color] of [[{x:-40,y:8},{x:98,y:53},3,shade],[{x:47,y:70},{x:2,y:5},6,'#ed3421'],[{x:17,y:10},{x:17,y:10},3,shade],[{x:118,y:0},{x:-100,y:89},3,shade]]){
      drawPixelLine(before,from,to,{width,color,ratio});batch.draw(from,to,{width,color,ratio});
    }
    batch.flush();assert.deepEqual(after.pixels(),before.pixels(),`pixel ratio ${ratio}`);
  }
});
