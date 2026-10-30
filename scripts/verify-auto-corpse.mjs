import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {EditorDocument} from '../src/editor-document.js';
import {autoCorpse,AUTO_CORPSE_SECTIONS} from '../src/auto-corpse.js';
import {allNodes,sampleNodeMatrices,skinGeoset,sampleGeosetAnimation} from '../src/animation.js';

const [corpus,output]=process.argv.slice(2);
if(!corpus||!output)throw Error('Usage: node scripts/verify-auto-corpse.mjs CORPUS REPORT.json');
const study=JSON.parse(fs.readFileSync(path.join(corpus,'study.json'))),models=[];
const pose=(m,id,index,time)=>skinGeoset(m.Geosets[id],sampleNodeMatrices(m,time,index));
const near=(a,b)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<.003,`Pose differs at ${i}`);};
const maxZ=vertices=>{let z=-Infinity;for(let i=2;i<vertices.length;i+=3)z=Math.max(z,vertices[i]);return z;};
for(const source of study.models) {
  const doc=new EditorDocument(fs.readFileSync(path.join(corpus,source.file)),source.file),before=structuredClone(doc.model),start=performance.now();
  const row={asset:source.member,sha256:source.sha256,deathBounds:source.deathBounds,nativeDecays:source.decays.map(s=>({name:s.name,milliseconds:s.interval[1]-s.interval[0]})),nativeCorpseTextures:source.corpseGeosets.map(g=>g.texture)};
  try {
    const result=doc.apply('Auto Corpse',AUTO_CORPSE_SECTIONS,autoCorpse),model=doc.model;
    for(let id=0;id<before.Geosets.length;id++)for(const field of ['Vertices','Normals','TVertices','Faces','VertexGroup','Groups','SkinWeights'])assert.deepEqual(model.Geosets[id][field],before.Geosets[id][field]);
    const nodes=new Map(allNodes(model).map(n=>[n.ObjectId,n]));
    // Blizzard-style decay keys the body's own bones; only keys inside the decay clips may change.
    const decay=result.corpses.flatMap(c=>[c.flesh,c.bone]).map(i=>Array.from(model.Sequences[i].Interval)),outside=v=>v?.Keys?{...v,Keys:v.Keys.filter(k=>!decay.some(([a,b])=>k.Frame>=a&&k.Frame<=b))}:v;
    for(const n of allNodes(before)){for(const field of ['Parent','PivotPoint','Flags'])assert.deepEqual(nodes.get(n.ObjectId)[field],n[field]);for(const field of ['Translation','Rotation','Scaling'])if(n[field]!=null)assert.deepEqual(outside(nodes.get(n.ObjectId)[field]),outside(n[field]));}
    for(const c of result.corpses) {
      const flesh=model.Sequences[c.flesh],bone=model.Sequences[c.bone];
      assert.ok(Array.from(pose(model,c.corpseGeoset,c.bone,bone.Interval[0])).filter((_,i)=>i%3===2).every(z=>z>0),'Corpse must start above the terrain');
      for(let i=0;i<c.bodyGeosets.length;i++)near(pose(model,c.bodyGeosets[i],c.flesh,flesh.Interval[0]),skinGeoset(before.Geosets[c.sourceBodyGeosets[i]],sampleNodeMatrices(before,c.sourceFrame,c.death,flesh.Interval[0]))); // global loops keep running: compare at the same loop time
      for(const id of c.bodyGeosets) {
        const end=flesh.Interval[1];assert.ok(maxZ(pose(model,id,c.flesh,end-1))<0,'Body must be buried before its last-frame hide');assert.equal(sampleGeosetAnimation(model,id,end,c.flesh).alpha,0);
      }
      // Native Decay Bone: the corpse lies still, visible until its last frame.
      const [b0,b1]=bone.Interval;for(const t of [(b0+b1)/2,b1-1])near(pose(model,c.corpseGeoset,c.bone,t),pose(model,c.corpseGeoset,c.bone,b0));
      assert.equal(sampleGeosetAnimation(model,c.corpseGeoset,b1-1,c.bone).alpha,1);assert.equal(sampleGeosetAnimation(model,c.corpseGeoset,b1,c.bone).alpha,0);
      assert.equal(sampleGeosetAnimation(model,c.corpseGeoset,flesh.Interval[0]+167,c.flesh).alpha,1);
      for(const g of [c.corpseGeoset,...c.bodyGeosets].map(id=>model.Geosets[id])){assert.ok(g.Faces.length>0);assert.ok(Array.from(g.Vertices).every(Number.isFinite));}
    }
    const formats={};
    for(const format of ['mdx','mdl']) {
      let bytes;
      try {bytes=doc.serialize(format);} catch(error) {
        // Disclose a source codec limitation only when the untouched input
        // reproduces the identical error. A new failure remains a failure.
        let baseline;try{new EditorDocument(fs.readFileSync(path.join(corpus,source.file)),source.file).serialize(format);}catch(e){baseline=e.message;}
        if(format!=='mdl'||baseline!==error.message)throw error;
        formats[format]={unchangedSourceLimitation:baseline};continue;
      }
      const reopened=new EditorDocument(bytes,'saved.'+format);assert.equal(reopened.readOnly,false);
      for(const c of result.corpses){const m=reopened.model,seq=m.Sequences[c.bone];assert.equal(sampleGeosetAnimation(m,c.corpseGeoset,seq.Interval[0],c.bone).alpha,1);assert.equal(sampleGeosetAnimation(m,c.corpseGeoset,seq.Interval[1],c.bone).alpha,0);near(pose(m,c.corpseGeoset,c.bone,seq.Interval[0]),pose(model,c.corpseGeoset,c.bone,seq.Interval[0]));}
      formats[format]=typeof bytes==='string'?Buffer.byteLength(bytes):bytes.byteLength;
    }
    const after=structuredClone(model);assert.equal(doc.apply('Auto Corpse',AUTO_CORPSE_SECTIONS,autoCorpse),false);assert.deepEqual(doc.model,after);
    doc.undo();assert.deepEqual(doc.model,before);doc.redo();assert.deepEqual(doc.model,after);
    Object.assign(row,{passed:true,formats,corpses:result.corpses.map(c=>({death:c.deathName,parts:c.parts.length,torsoWidths:c.parts.filter(p=>p.kind==='torso').map(p=>{const g=model.Geosets[c.corpseGeoset],normal=[(p.end[1]-p.start[1])/p.length,-(p.end[0]-p.start[0])/p.length],widths=p.vertices.map(id=>g.Vertices[id*3]*normal[0]+g.Vertices[id*3+1]*normal[1]);return widths.length?Math.max(...widths)-Math.min(...widths):0;}),sink:c.sinkDistance})),milliseconds:Math.round(performance.now()-start)});
  } catch(error) {
    const excluded=/\\(?:wisp|obsidianstatue)\\/i.test(source.member)&&/no body geometry/.test(error.message);
    const collapsed=/collapses the body to a point/.test(error.message);
    if(excluded||collapsed)assert.deepEqual(doc.model,before,'Unsupported final pose must leave the input untouched');
    Object.assign(row,excluded?{excluded:'Effect/Statue death excluded by the requested scope'}:collapsed?{excluded:'Final Death frame shrinks the body away; no physical terminal pose to fit'}:{passed:false,error:error.stack});
  }
  models.push(row);console.log(`${models.length}/${study.count} ${source.file}: ${row.excluded?'excluded':row.passed?'PASS':'FAIL '+row.error}`);
}
const report={source:study.source,studied:models.length,passed:models.filter(r=>r.passed).length,excluded:models.filter(r=>r.excluded).length,failed:models.filter(r=>r.passed===false).length,checks:['Literal final Death pose','Original geometry preserved; transform keys change only inside the decay clips','Body buried before the end of Decay Flesh; corpse still through Decay Bone; both hidden on the final frame','MDX and MDL save/reopen','One Undo/Redo','Repeat click is a no-op'],models};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({studied:report.studied,passed:report.passed,excluded:report.excluded,failed:report.failed}));
if(report.failed)process.exitCode=1;
