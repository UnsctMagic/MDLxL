import { readWarcraftDnc, sampleWarcraftDnc } from '../src/warcraft-dnc.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { createPortraitCamera, makePortraitCamera, editPortraitCamera, framePortraitSubject, portraitShot } from '../app/portrait-camera-edit.js';
import { evaluateModelCamera, editorCameraSnapshot, applyEvaluatedModelCamera, portraitPreviewSequences, firstPortraitSequenceIndex, PORTRAIT_ASPECT, portraitCompositionRect } from '../app/portrait-view.js';
import { loadPortraitLights, portraitLightUniformValues, PORTRAIT_DNC_PATH } from '../app/portrait-lighting.js';

const view = {position:[200,0,90],target:[0,0,90],fieldOfView:Math.PI/4,near:.1,far:2000};
const track = vector => ({LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array(vector)},{Frame:1000,Vector:new Float32Array(vector)}]});

test('new cameras and first-camera assignment preserve old cameras and all rig animation; undo/save/reopen work', () => {
  const doc=createDemoDocument(); doc.model.Cameras=[];
  const before=structuredClone(doc.model), bones=structuredClone(doc.model.Bones);
  doc.apply('New camera',['Cameras','Geosets','Info'],model=>createPortraitCamera(model,view));
  const old=structuredClone(doc.model.Cameras[0]);
  doc.apply('New camera',['Cameras','Geosets','Info'],model=>createPortraitCamera(model,{...view,position:[300,0,100]}));
  assert.equal(doc.model.Cameras.length,2); assert.deepEqual(doc.model.Cameras[0],old);
  const beforePromotion=structuredClone(doc.model);
  doc.apply('Use camera',['Cameras'],model=>makePortraitCamera(model,1));
  assert.equal(doc.model.Cameras[0].Name,'Camera 02');assert.deepEqual(doc.model.Cameras[1],old);assert.deepEqual(doc.model.Bones,bones);
  doc.undo();assert.deepEqual(doc.model,beforePromotion);doc.redo();
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'portrait.'+format);
    assert.equal(reopened.readOnly,false);assert.equal(reopened.model.Cameras[0].Name,'Camera 02');
    assert.deepEqual(Array.from(reopened.model.Cameras[1].Position),view.position);
    assert.deepEqual(reopened.model.Bones[0].Translation,before.Bones[0].Translation);
  }
  doc.undo();doc.undo();doc.undo();assert.deepEqual(doc.model,before);
});

test('camera bind matrices follow camera addition and promotion without moving node matrices', () => {
  const model=createDemoDocument().model;model.Cameras=[];
  model.BindPoses=[{Matrices:[Float32Array.from({length:12},()=>7)]}];
  createPortraitCamera(model,view);createPortraitCamera(model,{...view,position:[300,0,90]});
  model.BindPoses[0].Matrices[1][9]=11;model.BindPoses[0].Matrices[2][9]=22;
  makePortraitCamera(model,1);
  assert.equal(model.BindPoses[0].Matrices[0][0],7);assert.equal(model.BindPoses[0].Matrices[1][9],22);assert.equal(model.BindPoses[0].Matrices[2][9],11);
});

test('numeric camera edits preserve animated offsets and reject invalid clipping or coincident targets', () => {
  const model=createDemoDocument().model;model.Cameras=[];createPortraitCamera(model,view);
  const camera=model.Cameras[0];camera.Translation=track([10,0,0]);camera.TargetTranslation=track([0,0,10]);
  const tracks=structuredClone([camera.Translation,camera.TargetTranslation]);
  editPortraitCamera(model,0,{position:[250,0,90],target:[0,0,80],fieldOfView:.9,near:2,far:1000},0,0);
  const evaluated=evaluateModelCamera(model,camera,0,0);
  assert.deepEqual(evaluated.position,[250,0,90]);assert.deepEqual(evaluated.target,[0,0,80]);assert.deepEqual([camera.Translation,camera.TargetTranslation],tracks);
  const before=structuredClone(model);
  for(const patch of [{near:0},{far:1},{fieldOfView:NaN},{fieldOfView:Math.PI},{position:evaluated.target},{position:[NaN,0,0]}]) {
    assert.throws(()=>editPortraitCamera(model,0,patch,0,0));assert.deepEqual(model,before);
  }
});

test('idle and talk choices leave sequence content unchanged and handle Stand-only models', () => {
  const model={Sequences:[{Name:'Portrait Talk 2'},{Name:'Attack'},{Name:'Stand'},{Name:'Portrait'},{Name:'Portrait 2'}]}, before=structuredClone(model);
  assert.equal(firstPortraitSequenceIndex(model),3);assert.deepEqual(portraitPreviewSequences(model),{idle:[3,4],talk:[0],stand:[2]});assert.deepEqual(model,before);
  assert.equal(firstPortraitSequenceIndex({Sequences:[{Name:'Portrait Talk'},{Name:'Stand'}]}),1);
  assert.equal(firstPortraitSequenceIndex({Sequences:[{Name:'Stand'}]}),0);assert.equal(firstPortraitSequenceIndex({Sequences:[]}),-1);
});

test('front and level shots preserve target, distance, lens and clips', () => {
  const angled={...view,position:[100,-100,180]}, distance=new Vector3(...angled.position).distanceTo(new Vector3(...angled.target));
  for(const kind of ['front','level']) {
    const shot=portraitShot(angled,kind);
    assert.deepEqual(shot.target,view.target);assert.equal(shot.position[2],view.target[2]);assert.equal(shot.fieldOfView,view.fieldOfView);
    assert.ok(Math.abs(new Vector3(...shot.position).distanceTo(new Vector3(...shot.target))-distance)<1e-8);
  }
  assert.equal(portraitShot(angled,'front').position[1],view.target[1]);
});

test('automatic portrait framing follows a posed head and excludes the lower body', () => {
  const head={Name:'Head',ObjectId:0,Parent:null,PivotPoint:[0,0,90],Translation:track([30,0,0])};
  const vertices=[-10,-15,75, 10,-15,75, 0,15,115, -20,-20,0,20,-20,0,0,20,60];
  const marker={Name:'Head - Ref',ObjectId:1,Parent:0,PivotPoint:[0,0,110]};
  const model={Nodes:[head,marker],Bones:[],Helpers:[head],Attachments:[marker],Sequences:[{Name:'Stand',Interval:[0,1000]}],Geosets:[{Vertices:Float32Array.from(vertices),Faces:Uint16Array.from([0,1,2,3,4,5]),VertexGroup:Uint8Array.from([0,0,0,0,0,0]),Groups:[[0]]}],Materials:[],GeosetAnims:[],GlobalSequences:[]};
  const before=structuredClone(model), shot=framePortraitSubject(model,null,0,0);
  assert.ok(shot.target[0]>20);assert.ok(shot.target[2]>75);assert.deepEqual(model,before);
  const camera=new PerspectiveCamera(), controls={target:new Vector3(),update(){}};
  applyEvaluatedModelCamera(camera,controls,shot,PORTRAIT_ASPECT);
  for(const id of [0,1,2]) {const point=new Vector3().fromArray(vertices,id*3).add(new Vector3(30,0,0)).project(camera);assert.ok(Math.abs(point.x)<=1 && Math.abs(point.y)<=1);}
  assert.ok(new Vector3(30,0,0).project(camera).y < -1);
  const unknown=createDemoDocument().model;const fallback=framePortraitSubject(unknown,null,0,0);assert.ok(fallback.far>fallback.near);assert.ok(fallback.position.every(Number.isFinite));
});

test('outside composition keeps the game crop projection identical', () => {
  const camera=new PerspectiveCamera(), controls={target:new Vector3(),update(){}};
  applyEvaluatedModelCamera(camera,controls,view,PORTRAIT_ASPECT);
  const subject=new Vector3(0,8,100), expected=subject.clone().project(camera);
  for(const [width,height] of [[900,500],[320,800]]) {
    const crop=portraitCompositionRect(width,height);
    camera.setViewOffset(crop.width,crop.height,-crop.x,-crop.y,width,height);
    const point=subject.clone().project(camera),x=(point.x+1)*width/2,y=(1-point.y)*height/2;
    assert.ok(Math.abs((x-crop.x)/crop.width-(expected.x+1)/2)<1e-8);
    assert.ok(Math.abs((y-crop.y)/crop.height-(1-expected.y)/2)<1e-8);
  }
});

test('portrait lighting reports missing assets and packs all light types', async () => {
  let request;
  await assert.rejects(()=>loadPortraitLights({resolveEventResources:async value=>{request=value;return [];}},'unit.mdx'),/Choose Warcraft/);
  assert.equal(request.names[0],PORTRAIT_DNC_PATH);assert.equal(request.path,'unit.mdx');
  const lights=[0,1,2].map(type=>({type,position:[1,2,3],direction:[0,0,1],color:[.8,.6,.4],ambient:[.1,.2,.3],start:80,end:200}));
  const packed=portraitLightUniformValues(lights);assert.equal(packed.count,3);assert.equal(packed.positions[11],2);assert.equal(packed.ranges[5],200);assert.ok(Math.abs(packed.ambient[8]-.3)<1e-6);
});


test('current game DNC light records retain color, intensity, attenuation and light animation', () => {
  const uint=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;}, float=n=>{const b=Buffer.alloc(4);b.writeFloatLE(n);return b;};
  const chunk=(tag,b)=>Buffer.concat([Buffer.from(tag),uint(b.length),b]);
  for(const version of [800,1200,1800]) {
    const node=Buffer.concat([uint(96),Buffer.alloc(80),uint(0),uint(0xffffffff),uint(0)]);
    const scalar=version>=1800?[float(0)]:[];
    const fixed=Buffer.concat([uint(1),...scalar,...[80,200,1,.5,.25,2,.3,.2,.1,.4].map(float)]);
    const extra=version>=1800?[.4,0,0,.0005,0,.00001].map(float):version>=1200?[float(.4)]:[];
    const animation=Buffer.concat([Buffer.from('KLAI'),uint(1),uint(0),uint(0xffffffff),uint(0),float(1.5)]);
    const record=Buffer.concat([node,fixed,...extra,animation]);
    const bytes=Buffer.concat([Buffer.from('MDLX'),chunk('VERS',uint(version)),chunk('LITE',Buffer.concat([uint(record.length+4),record])),chunk('PIVT',Buffer.alloc(12))]);
    const model=readWarcraftDnc(bytes), light=model.Lights[0], sampled=sampleWarcraftDnc(model)[0];
    assert.equal(light.AttenuationStart,80);assert.equal(light.AttenuationEnd,200);assert.deepEqual(light.Color,[1,.5,.25]);
    assert.deepEqual(sampled.color,[.375,.75,1.5]);assert.ok(Math.abs(sampled.ambient[0]-.04)<1e-6);
  }
});


test('saving an orthographic composition view uses the inner portrait crop', () => {
  const camera=new OrthographicCamera(-200,200,100,-100,.1,1000),target=new Vector3();camera.position.set(500,0,0);camera.up.set(0,0,1);camera.lookAt(target);camera.updateMatrixWorld();
  const view=editorCameraSnapshot(camera,target,new PerspectiveCamera(),.65), applied=new PerspectiveCamera(),controls={target:new Vector3(),update(){}};
  applyEvaluatedModelCamera(applied,controls,view,PORTRAIT_ASPECT);
  assert.ok(Math.abs(new Vector3(0,0,65).project(applied).y-1)<1e-8);
});
