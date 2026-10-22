import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Quaternion, Vector3 } from 'three';
import { allNodes } from '../src/animation.js';
import { applyMovementTransform } from '../src/movement.js';
import { samplePreviewMatrices } from '../app/preview-pose.js';
import { previewBillboarding } from '../app/preview-presentation.js';
import { screenPlaneTranslation } from '../app/viewport-math.js';
const key = values => ({LineType:1,Keys:[{Frame:100,Vector:new Float32Array(values)}]});
const near = (actual,expected) => actual.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<2e-5,actual+' != '+expected));
const contexts=[{presentation:'editor',editorDisplayMode:'movement'},{presentation:'editor',editorDisplayMode:'bones',restPose:true},{presentation:'preview',restPose:true},{presentation:'preview',previewSelectionMode:true},{presentation:'preview',particleAnchorId:0}];
function camera(angle){const c=new OrthographicCamera(-50,50,50,-50,.1,1000);c.up.set(0,0,1);c.position.set(70*Math.cos(angle),70*Math.sin(angle),40);c.lookAt(0,0,0);c.updateMatrixWorld(true);return c;}
function fixture(flags,family){return{Sequences:[{Interval:[100,1000]}],GlobalSequences:[],Geosets:[],Bones:[{ObjectId:0,PivotPoint:[0,0,0],Rotation:key(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.41).toArray()),Scaling:key([2,3,4])},{ObjectId:1,Parent:0,Flags:flags,PivotPoint:[2,4,6]}],[family]:[{ObjectId:2,Parent:1,PivotPoint:[3,5,7]}]};}
const matrices=(m,c,context)=>samplePreviewMatrices(m,100,0,100,previewBillboarding(context)?c:undefined);
const point=(m,id,c,context)=>new Vector3().fromArray(allNodes(m).find(node=>node.ObjectId===id).PivotPoint).applyMatrix4(matrices(m,c,context).get(id));
for(const family of ['ParticleEmitters2','RibbonEmitters','ParticleEmitters','ParticleEmitterPopcorns','Attachments','Helpers','Lights','EventObjects'])test(family+' retains placement through drag, camera rotation, and another drag',()=>{
  for(const flags of [8,16,32,64])for(const context of contexts){
    const model=fixture(flags,family),before=structuredClone(model),a=camera(.3),b=camera(1.7);
    for(const [c,dx,dy]of [[a,-17,0],[a,0,13],[b,19,0],[b,0,-15]]){
      const from=point(model,2,c,context),delta=screenPlaneTranslation(c,from,900,700,dx,dy);
      applyMovementTransform(model,[2],100,0,{mode:'move',space:'world',values:delta.toArray()});
      near(point(model,2,c,context).sub(from).toArray(),delta.toArray());
      near(point(model,2,a,context).toArray(),point(model,2,b,context).toArray());
      for(const id of [0,1])assert.deepEqual(matrices(model,a,context).get(id),matrices(model,b,context).get(id));
    }
    assert.deepEqual(model.Bones,before.Bones);assert.deepEqual(model[family][0].PivotPoint,before[family][0].PivotPoint);
    for(const property of ['Rotation','Scaling','Flags'])assert.deepEqual(model[family][0][property],before[family][0][property]);
  }
});
test('viewing still evaluates authored full and locked billboards without changing flags or tracks',()=>{
  for(const flags of [8,16,32,64]){
    const model=fixture(flags,'ParticleEmitters2'),before=structuredClone(model);
    assert.equal(previewBillboarding({presentation:'preview'}),true);
    assert.notDeepEqual(matrices(model,camera(.3),{presentation:'preview'}).get(1),matrices(model,camera(1.7),{presentation:'preview'}).get(1));
    assert.deepEqual(model,before);
  }
});
