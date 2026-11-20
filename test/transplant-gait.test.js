import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Matrix4, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { transferRig } from '../src/anim-transfer.js';
import { openDocument } from '../src/editor-document.js';
import { vertexBones } from '../src/part-bones.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load = file => openDocument(new Uint8Array(fs.readFileSync(file)), file).model;

function footPaths(own, donor, result, report) {
  const rig = transferRig(own), source = transferRig(donor);
  const nodes = new Map(allNodes(own).map(n => [n.ObjectId,n]));
  const feet = Object.values(rig.parts).filter(part => part.limbKind === 'leg');
  const below = (id,root) => {
    for (let n=nodes.get(id); n; n=nodes.get(n.Parent)) if(n.ObjectId===root) return true;
    return false;
  };
  const index = result.Sequences.findIndex(s => /^walk$/i.test(s.Name.trim()));
  assert.ok(index>=0,'a real walking cycle');
  const [a,b] = result.Sequences[index].Interval;
  const frames=Array.from({length:17},(_,i)=>{
    const m=sampleNodeMatrices(result,Math.round(a+(b-a)*i/16),index);
    return {posed:result.Geosets.map(g=>skinGeoset(g,m)), back:new Matrix4().copy(m.get(report.donorNodes[source.body])).invert()};
  });
  return feet.map(foot=>{
    let points=[];
    for(const joint of [...foot.joints].reverse()){
      for(const [gi,g] of own.Geosets.entries()) for(let vi=0;vi<g.Vertices.length/3;vi++)
        if(vertexBones(g,vi).some(id=>below(id,joint))) points.push([gi,vi]);
      if(points.length) break;
    }
    assert.ok(points.length,foot.key+' has actual foot skin');
    const path=frames.map(({posed,back})=>{
      const centre=new Vector3();
      for(const [gi,vi] of points) centre.add(new Vector3().fromArray(posed[gi],vi*3));
      return centre.divideScalar(points.length).applyMatrix4(back);
    });
    const span=Math.max(...path.flatMap(p=>path.map(q=>p.distanceTo(q))));
    return {key:foot.key,span:span/Math.max(rig.hipHeight,1),path};
  });
}

for (const [ownName,donorName,choices] of [
  ['orc__hellscream','creeps__giantseaturtle',['back','front','back-and-arms']],
  ['creeps__timberwolf','human__footman',['same-side','diagonal']],
]) {
  const files=[ownName,donorName].map(n=>testModel('corpus-sd/'+n+'.mdx'));
  test('Gait choices move the actual feet through Walk: '+ownName+' on '+donorName,{skip:files.some(f=>!fs.existsSync(f))?'private SD fixture unavailable':false},()=>{
    const own=load(files[0]), donor=load(files[1]);
    const curves=[];
    for(const gait of choices) {
      const {model,report}=transplantSkeleton(own,donor,{gait,extents:false});
      const feet=footPaths(own,donor,model,report);
      for(const f of feet) assert.ok(f.span>0.08,`${gait} ${f.key} swings only ${f.span.toFixed(4)} hip heights`);
      assert.ok(!report.still.some(k=>/^leg/.test(k)),'all recipient legs have drivers');
      curves.push(feet);
    }
    const differs=curves[0].some((f,i)=>f.path.some((p,j)=>p.distanceTo(curves[1][i].path[j])>1));
    assert.ok(differs,'the first two choices produce visibly different foot paths');
    const selected = ownName === 'orc__hellscream' ? 'back-and-arms' : 'same-side';
    const automatic = transplantSkeleton(own,donor,{extents:false}).model;
    const explicit = transplantSkeleton(own,donor,{gait:selected,extents:false}).model;
    assert.deepEqual(automatic.Geosets,explicit.Geosets,'default uses the selected gait skin');
    assert.deepEqual(automatic.Helpers,explicit.Helpers,'default uses the selected animation drivers');
  });
}
