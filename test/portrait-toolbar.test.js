import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera, Vector3 } from 'three';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { setCameraFromCurrentView } from '../app/portrait-camera-edit.js';
import { evaluateModelCamera, applyEvaluatedModelCamera, PORTRAIT_ASPECT } from '../app/portrait-view.js';
import { allNodes } from '../src/animation.js';
import { clearQuickDisplay } from '../src/display-overlays.js';

const view={position:[25,-200,80],target:[0,0,45],roll:.37,fieldOfView:Math.PI/4,near:1,far:1000};
test('Set Current View creates once, updates selected camera without touching extents and supports undo/save',()=>{
  const doc=createDemoDocument(); doc.model.Cameras=[];
  const before=structuredClone(doc.model);
  const index=doc.apply('Set Current View',['Cameras','BindPoses'],model=>setCameraFromCurrentView(model,-1,view));
  assert.equal(index,0); assert.equal(doc.model.Cameras[0].Name,'Camera 01');
  for(const key of ['Info','Sequences','Geosets']) assert.deepEqual(doc.model[key],before[key],key);
  assert.deepEqual(Array.from(doc.model.Cameras[0].Position),view.position);
  assert.equal(doc.model.Cameras[0].Rotation,undefined);
  assert.ok(!allNodes(doc.model).includes(doc.model.Cameras[0]));
  doc.undo(); assert.deepEqual(doc.model,before); doc.redo();
  const next={...view,position:[50,-150,90]};
  doc.apply('Set Current View',['Cameras','BindPoses'],model=>setCameraFromCurrentView(model,0,next));
  assert.equal(doc.model.Cameras.length,1); assert.deepEqual(Array.from(doc.model.Cameras[0].Position),next.position);
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'camera.'+format);
    assert.equal(reopened.model.Cameras.length,1);
    assert.deepEqual(Array.from(reopened.model.Cameras[0].Position),next.position);
    assert.equal(reopened.model.Cameras[0].Rotation,undefined);
  }
  doc.model.Cameras.push({...structuredClone(doc.model.Cameras[0]),Name:'Other camera'});
  const first=structuredClone(doc.model.Cameras[0]);
  setCameraFromCurrentView(doc.model,1,view);
  assert.equal(doc.model.Cameras.length,2);
  assert.deepEqual(doc.model.Cameras[0],first);
  assert.equal(doc.model.Cameras[1].Name,'Other camera');
});

test('Set Current View preserves existing camera animation when updating the evaluated view',()=>{
  const model=createDemoDocument().model;
  model.Cameras=[{Name:'Existing',Translation:{LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([10,20,30])}]}}];
  setCameraFromCurrentView(model,0,view,0,0);
  const camera=evaluateModelCamera(model,model.Cameras[0],0,0,0);
  assert.deepEqual(camera.position,view.position);
  assert.equal(model.Cameras[0].Translation.Keys.length,1);
});

test('Set Current View and shots keep authored camera roll (KCRL) tracks untouched',()=>{
  const doc=createDemoDocument();
  const sequence=doc.model.Sequences[0];
  doc.model.Sequences=[
    {...structuredClone(sequence),Name:'Stand',Interval:new Uint32Array([0,99])},
    {...structuredClone(sequence),Name:'Portrait - 1',Interval:new Uint32Array([100,199])},
    {...structuredClone(sequence),Name:'Portrait Talk - 1',Interval:new Uint32Array([300,399])},
  ];
  const rotation={LineType:1,GlobalSeqId:null,Keys:[{Frame:50,Vector:Float32Array.of(.1)},{Frame:100,Vector:Float32Array.of(.3)},{Frame:300,Vector:Float32Array.of(.4)}]};
  doc.model.Cameras=[{Name:'Existing',Position:new Float32Array(view.position),TargetPosition:new Float32Array(view.target),FieldOfView:view.fieldOfView,NearClip:view.near,FarClip:view.far,Rotation:structuredClone(rotation)}];
  const moved={...view,position:[60,-180,90]};
  doc.apply('Set Current View',['Cameras','BindPoses'],model=>setCameraFromCurrentView(model,0,moved,300,2));
  const source=doc.model.Cameras[0];
  assert.deepEqual(Array.from(source.Position),moved.position);
  assert.deepEqual(source.Rotation,rotation);
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'shared-camera.'+format), camera=reopened.model.Cameras[0];
    assert.deepEqual(camera.Rotation.Keys.map(key=>[key.Frame,+key.Vector[0].toFixed(5)]),rotation.Keys.map(key=>[key.Frame,+key.Vector[0].toFixed(5)]));
  }
});

test('Clear turns off the active view, including Shadows and Grid',()=>{
  const state={vertices:{grid:true,shaded:true},bones:{grid:true},animations:{grid:true,shaded:true,vertices:true,wires:true,bones:true,skeleton:true,nodes:true,attachments:true,particles:true},uv:{vertices:true}};
  const before=structuredClone(state),next=clearQuickDisplay(state,'animations');
  assert.deepEqual(state,before);assert.deepEqual(next.vertices,before.vertices);assert.deepEqual(next.bones,{...before.bones,bones:false});assert.deepEqual(next.uv,before.uv);
  assert.ok(Object.values(next.animations).every(value=>!value));
});

test('Snap uses existing camera entry without altering document, playback or sequence',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  const portrait=readFileSync(new URL('../app/usePortraitState.js',import.meta.url),'utf8');
  assert.match(portrait,/\[portraitSnapRevision, setPortraitSnapRevision\] = useState\(0\)/);
  assert.match(app,/onSnap=\{\(\) => \{ setPortraitView\('perspective'\); setPortraitSnapRevision\(value => value \+ 1\); \}\}/);
  assert.match(preview,/current\.enterPortrait\(evaluated\);\s*\}, \[props\.portraitMode, props\.portraitCameraIndex, props\.portraitSnapRevision/);

  for(const file of ['src/commands.js','electron/menu.cjs']) {
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/'Cameras'/);
  }
});

test('Portrait retains compact camera controls and permits vertical orbit',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(app,/const cameraRotating = cameraMode === 'rotate' && !lockedVertexPlane \|\| cameraGesture;/);
  assert.match(app,/\{cameraRotating && !activePortrait && cameraPanel\}/);
  assert.doesNotMatch(preview,/controls\.minPolarAngle = controls\.maxPolarAngle = controls\.getPolarAngle\(\)/);
  assert.match(preview,/setCameraAngles: values => \{ if \(state\.portraitActive \|\| latest\.current\.suspended\) return;/);
});

test('Movement and Portrait share the complete viewpoint dropdown',()=>{
  const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(app,/const views = \['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'\]/);
  const bar=readFileSync(new URL('../app/AppToolbar.jsx',import.meta.url),'utf8');
  assert.match(bar,/value=\{cameraPortraitActive \? portraitView : mode === 'vertices' && quadView \? activeVertexPane\?\.view \|\| 'front' : view\}/);
  assert.match(bar,/onChange=\{event => cameraPortraitActive \? setPortraitView\(event\.target\.value\) : setView\(event\.target\.value\)\}/);
  assert.doesNotMatch(preview,/function setView\(next\) \{\s*if \(state\.portraitActive\) return;/);
  assert.match(preview,/if \(state\.portraitActive\) \{ state\.cameraDetached = true; latest\.current\.onPlayingChange\?\.\(false\); latest\.current\.onPortraitPreviewChange\?\.\(true\); \}/);
  assert.match(preview,/state\.portraitActive = true; state\.cameraDetached = false; latest\.current\.onPortraitPreviewChange\?\.\(false\); state\.appliedView = 'perspective';/);
});

test('switching Portrait sequences preserves the one shared camera view',()=>{
  const preview=readFileSync(new URL('../app/GamePreview.jsx',import.meta.url),'utf8');
  assert.match(preview,/current\.enterPortrait\(evaluated\);\s*\}, \[props\.portraitMode, props\.portraitCameraIndex, props\.portraitSnapRevision, model, rendererRevision\]\);/);
  assert.doesNotMatch(preview,/current\.enterPortrait\(evaluated\);\s*\}, \[[^\]]*sequenceIndex/);
  assert.match(preview,/setCameraAngles: values => \{ if \(state\.portraitActive \|\| latest\.current\.suspended\) return;/);
});

test('snapping restores the native camera projection after temporary viewport navigation without authoring changes',()=>{
  const model=createDemoDocument().model;
  setCameraFromCurrentView(model,-1,view);
  const before=structuredClone(model),camera=new PerspectiveCamera(),controls={target:new Vector3(),update(){}};
  const evaluated=evaluateModelCamera(model,model.Cameras[0],0,0,0);
  applyEvaluatedModelCamera(camera,controls,evaluated,PORTRAIT_ASPECT);
  const projection=camera.projectionMatrix.clone(),up=camera.up.clone();
  camera.position.set(99,88,77);controls.target.set(3,4,5);camera.zoom=3;camera.updateProjectionMatrix();
  applyEvaluatedModelCamera(camera,controls,evaluated,PORTRAIT_ASPECT);
  assert.deepEqual(camera.position.toArray(),view.position);
  assert.deepEqual(controls.target.toArray(),view.target);
  assert.deepEqual(camera.projectionMatrix,projection);assert.deepEqual(camera.up,up);
  assert.equal(camera.zoom,1);assert.deepEqual(model,before);
});
