import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarterDocument} from '../src/starter-model.js';
import {EditorDocument,createNode} from '../src/editor-document.js';
import {autoCorpse,AUTO_CORPSE_SECTIONS} from '../src/auto-corpse.js';
import {sampleNodeMatrices,skinGeoset,sampleGeosetAnimation,sampleTrack} from '../src/animation.js';
import {createVisibilityGeosetAnimation} from '../src/geoset-animation-defaults.js';
import {buildCorpseGeometry} from '../src/corpse-geometry.js';

const track=(pairs,line=1,GlobalSeqId=null)=>({LineType:line,GlobalSeqId,Keys:pairs.map(([Frame,v])=>({Frame,Vector:new Float32Array(v)}))});
function fixture({variants=1,globalMotion=false,sharedStart=false}={}) {
  const d=createStarterDocument();d.apply('Rig',[],m=>{
    m.GeosetAnims=[createVisibilityGeosetAnimation(0)];
    m.Sequences=['Stand',...Array.from({length:variants},(_,i)=>'Death'+(i?' Alternate':''))].map((Name,i)=>({Name,Interval:new Uint32Array([i*1000,i*1000+900]),NonLooping:false,MoveSpeed:0,Rarity:0,MinimumExtent:new Float32Array([-40,-40,-40]),MaximumExtent:new Float32Array([40,40,40]),BoundsRadius:70}));
    if(sharedStart)m.Sequences.push({...structuredClone(m.Sequences[0]),Name:'Stand Ready'});
    const root=m.Bones[0];root.Name='Body';root.Translation=track([[0,[0,0,0]],[900,[10,0,0]],[1000,[0,0,0]],[1900,[40,-15,-5]],[2000,[0,0,0]],[2900,[-40,15,-10]]]);
    if(globalMotion){m.GlobalSequences=[500];root.Rotation=track([[0,[0,0,0,1]],[250,[0,0,1,0]],[500,[0,0,0,1]]],1,0);}
  });return d;
}
const apply=d=>d.apply('Auto Corpse',AUTO_CORPSE_SECTIONS,autoCorpse);
const posed=(m,id,seq,time)=>skinGeoset(m.Geosets[id],sampleNodeMatrices(m,time,seq));
const alpha=(m,id,seq,time)=>sampleGeosetAnimation(m,id,time,seq).alpha;
const near=(a,b,e=1e-4)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<e,`${i}: ${a[i]} != ${b[i]}`);};

test('one edit freezes the literal last Death pose, then sinks flesh and bones completely',()=>{
  const d=fixture({globalMotion:true}),before=structuredClone(d.model),r=apply(d).corpses[0],m=d.model,fs=m.Sequences[r.flesh],bs=m.Sequences[r.bone];
  near(posed(m,r.bodyGeosets[0],r.flesh,fs.Interval[0]),posed(before,0,r.death,r.sourceFrame));
  assert.ok(Array.from(posed(m,r.corpseGeoset,r.bone,bs.Interval[0])).filter((_,i)=>i%3===2).every(z=>z>0),'Corpse starts above the terrain even where the Death body intersects it');
  assert.deepEqual(m.Bones.slice(0,before.Bones.length),before.Bones);
  for(const t of [0,.25,.5,.75,1]) {
    const p=posed(m,r.bodyGeosets[0],r.flesh,fs.Interval[0]+t*(fs.Interval[1]-fs.Interval[0])),base=posed(before,0,r.death,r.sourceFrame);
    near(p,base.map((v,i)=>v-(i%3===2?r.sinkDistance*t:0)),.001);
  }
  assert.ok(Math.max(...Array.from(posed(m,r.bodyGeosets[0],r.flesh,fs.Interval[1])).filter((_,i)=>i%3===2))<0);
  assert.ok(Math.max(...Array.from(posed(m,r.corpseGeoset,r.bone,bs.Interval[1])).filter((_,i)=>i%3===2))<0);
  assert.equal(alpha(m,0,r.flesh,fs.Interval[0]),0);
  assert.equal(alpha(m,r.corpseGeoset,r.flesh,fs.Interval[0]),0);
  assert.equal(alpha(m,r.corpseGeoset,r.flesh,fs.Interval[0]+167),1);
  assert.equal(alpha(m,r.corpseGeoset,r.bone,bs.Interval[0]),1);
  assert.equal(alpha(m,r.corpseGeoset,r.bone,bs.Interval[1]),0);
  assert.equal(alpha(m,r.bodyGeosets[0],r.bone,bs.Interval[0]),0);
  for(const seq of [0,1])for(const time of [before.Sequences[seq].Interval[0],before.Sequences[seq].Interval[1]]) {
    near(posed(m,0,seq,time),posed(before,0,seq,time));assert.equal(alpha(m,0,seq,time),alpha(before,0,seq,time));
    assert.equal(alpha(m,r.corpseGeoset,seq,time),0);assert.equal(alpha(m,r.bodyGeosets[0],seq,time),0);
  }
});
test('save/reopen in MDX and MDL retains corpse visibility, motion and a single undo/redo',()=>{
  const d=fixture(),before=structuredClone(d.model),r=apply(d).corpses[0],after=structuredClone(d.model);
  d.undo();assert.deepEqual(d.model,before);d.redo();assert.deepEqual(d.model,after);
  for(const format of ['mdx','mdl']){const reopened=new EditorDocument(d.serialize(format),'corpse.'+format);assert.equal(reopened.readOnly,false);const m=reopened.model;assert.equal(alpha(m,r.corpseGeoset,r.flesh,m.Sequences[r.flesh].Interval[0]+167),1);near(posed(m,r.bodyGeosets[0],r.flesh,m.Sequences[r.flesh].Interval[1]),posed(after,r.bodyGeosets[0],r.flesh,after.Sequences[r.flesh].Interval[1]),.001);}
});
test('multiple Death variants get separate poses and repeat clicks do not add data or history',()=>{
  const d=fixture({variants:2}),r=apply(d),before=structuredClone(d.model),count=d.history.length;
  assert.equal(r.corpses.length,2);assert.notDeepEqual(d.model.Geosets[r.corpses[0].corpseGeoset].Vertices,d.model.Geosets[r.corpses[1].corpseGeoset].Vertices);
  assert.equal(apply(d),false);assert.deepEqual(d.model,before);assert.equal(d.history.length,count);
});
test('pre-existing decay intervals are reused and duplicate live sequence starts remain valid',()=>{
  const d=fixture({sharedStart:true});d.apply('Existing',[],m=>{for(const [i,Name]of ['Decay Flesh','Decay Bones'].entries())m.Sequences.push({...structuredClone(m.Sequences[0]),Name,Interval:new Uint32Array([5000+i*3000,7000+i*3000])});});
  const count=d.model.Sequences.length,original=d.model.Sequences.map(s=>Array.from(s.Interval));apply(d);assert.equal(d.model.Sequences.length,count);assert.deepEqual(d.model.Sequences.map(s=>Array.from(s.Interval)),original);
});
test('generic Decay becomes the flesh clip without leaving an empty decay or changing its timing',()=>{
  const d=fixture();d.apply('Generic decay',[],m=>m.Sequences.push({...structuredClone(m.Sequences[0]),Name:'Decay',Interval:new Uint32Array([5000,65000])}));
  const r=apply(d).corpses[0];assert.equal(r.flesh,2);assert.equal(d.model.Sequences[2].Name,'Decay Flesh');assert.deepEqual(Array.from(d.model.Sequences[2].Interval),[5000,65000]);assert.equal(alpha(d.model,r.bodyGeosets[0],2,5000),1);
});
test('corpse torso uses skin on mesh children and grows with body girth while joint lengths stay fixed',()=>{
  function body(width){const d=fixture();d.apply('Body skin',[],m=>{
    const root=m.Bones[0];root.Name='Bone_Root';delete root.Translation;
    const chest=createNode(m,'Bone');chest.Name='Bone_Chest';chest.Parent=root.ObjectId;
    const head=createNode(m,'Bone');head.Name='Bone_Head';head.Parent=chest.ObjectId;head.PivotPoint.set([0,35,0]);
    const torso=createNode(m,'Bone');torso.Name='Mesh01';torso.Parent=chest.ObjectId;torso.GeosetId=0;
    const skull=createNode(m,'Bone');skull.Name='Box02';skull.Parent=head.ObjectId;skull.GeosetId=1;
    const g=m.Geosets[0];g.Vertices=g.Vertices.map((v,i)=>v*[width,1,.3][i%3]);g.Groups=[[torso.ObjectId]];
    const h=structuredClone(g);h.Vertices=h.Vertices.map((v,i)=>v*.3+(i%3===1?45:0));h.Groups=[[skull.ObjectId]];m.Geosets.push(h);m.GeosetAnims.push(createVisibilityGeosetAnimation(1));
  });return buildCorpseGeometry(d.model,[0,1],1);}
  const narrow=body(1),wide=body(2),extent=(r,part)=>{const xs=part.vertices.map(i=>r.geoset.Vertices[i*3]);return Math.max(...xs)-Math.min(...xs);};
  const a=narrow.parts.find(p=>p.kind==='torso'),b=wide.parts.find(p=>p.kind==='torso');assert.ok(a&&b);assert.equal(a.length,b.length);assert.ok(extent(wide,b)>extent(narrow,a)*1.7,'Broad bodies need broad ribs, not a fixed narrow strip');
  assert.ok(narrow.parts.find(p=>p.kind==='skull').vertices.length>=9);
});
test('corpse ribs are a lump clearly beneath the body, and a head carried in a hand is no skull',()=>{
  const d=fixture();d.apply('Flail warrior',[],m=>{
    const root=m.Bones[0];root.Name='Bone_Root';delete root.Translation;
    const chest=createNode(m,'Bone');chest.Name='Bone_Chest';chest.Parent=root.ObjectId;
    const head=createNode(m,'Bone');head.Name='Bone_Head';head.Parent=chest.ObjectId;head.PivotPoint.set([0,35,0]);
    const hand=createNode(m,'Bone');hand.Name='Bone_Hand_R';hand.Parent=chest.ObjectId;hand.PivotPoint.set([30,0,0]);
    const flail=createNode(m,'Bone');flail.Name='Flail_Head';flail.Parent=hand.ObjectId;flail.PivotPoint.set([60,0,0]);
    const g=m.Geosets[0];g.Vertices=g.Vertices.map((v,i)=>v*[1.5,1,.6][i%3]);g.Groups=[[chest.ObjectId]];
    for(const [node,dx,dy] of [[head,0,45],[flail,60,0]]){const h=structuredClone(g);h.Vertices=h.Vertices.map((v,i)=>v*.3+[dx,dy,0][i%3]);h.Groups=[[node.ObjectId]];m.Geosets.push(h);m.GeosetAnims.push(createVisibilityGeosetAnimation(m.Geosets.length-1));}
  });
  const m=d.model,r=buildCorpseGeometry(m,[0,1,2],1),body=skinGeoset(m.Geosets[0],sampleNodeMatrices(m,r.frame,1));
  assert.equal(r.parts.filter(p=>p.kind==='skull').length,1,'Flail_Head hangs from a hand: equipment, not a second skull');
  const ribs=r.parts.find(p=>p.kind==='torso').vertices.map(i=>r.geoset.Vertices[i*3+2]),top=Math.max(...Array.from(body).filter((_,i)=>i%3===2));
  assert.ok(Math.max(...ribs)-r.ground>r.span*.03,'Ribs need visible height, not a flat decal');
  assert.ok(Math.max(...ribs)<top-r.span*.005,'The corpse keeps a clear gap below the body surface, so it cannot z-fight or pop through');
});
test('native body geometry, skin weights, Death keys and non-decay alpha curves are preserved',()=>{
  const d=fixture();d.apply('Cubic',[],m=>{m.GeosetAnims[0].Alpha=track([[0,[.3]],[500,[.8]],[900,[.5]],[1000,[1]],[1900,[1]]],3);for(const k of m.GeosetAnims[0].Alpha.Keys){k.InTan=new Float32Array(k.Vector);k.OutTan=new Float32Array(k.Vector);}});
  const before=structuredClone(d.model);apply(d);for(const field of ['Vertices','Normals','TVertices','Faces','Groups','VertexGroup'])assert.deepEqual(d.model.Geosets[0][field],before.Geosets[0][field]);
  for(let t=0;t<1900;t+=37){const seq=t<1000?0:1;assert.equal(alpha(d.model,0,seq,t),alpha(before,0,seq,t));}
});
test('existing corpse and effects are hidden, death sound is preserved and decay event keys are removed',()=>{
  const d=fixture();d.apply('Effects',[],m=>{const corpse=structuredClone(m.Geosets[0]);m.Textures.push({Image:'Textures\\gutz.blp',ReplaceableId:0,Flags:0});m.Materials.push({Layers:[{TextureID:m.Textures.length-1,FilterMode:1,Alpha:1,Shading:0,CoordId:0,TVertexAnimId:null}],PriorityPlane:0,RenderMode:0});corpse.MaterialID=m.Materials.length-1;m.Geosets.push(corpse);const ref=createNode(m,'Attachment');ref.Visibility=1;const event=createNode(m,'EventObject');event.Name='SNDxDTH1';event.EventTrack=new Uint32Array([1500,5000]);m.Sequences.push({...structuredClone(m.Sequences[0]),Name:'Decay Flesh',Interval:new Uint32Array([5000,6000])});});
  const r=apply(d).corpses[0],m=d.model;assert.equal(alpha(m,1,0,0),0);assert.deepEqual(Array.from(m.EventObjects[0].EventTrack),[1500]);assert.equal(sampleTrack(m.Attachments[0].Visibility,5000,{interval:m.Sequences[r.flesh].Interval,fallback:1}),0);
});
test('global body alpha stays intact while a private material gates only decay',()=>{
  const d=fixture();d.apply('Global',[],m=>{m.GlobalSequences=[1000];m.GeosetAnims[0].Alpha=track([[0,[.25]],[1000,[1]]],1,0);});const before=structuredClone(d.model);apply(d);assert.deepEqual(d.model.GeosetAnims[0].Alpha,before.GeosetAnims[0].Alpha);assert.deepEqual(d.model.Materials.slice(0,before.Materials.length),before.Materials);assert.notEqual(d.model.Geosets[0].MaterialID,before.Geosets[0].MaterialID);
});
test('a nearly zero final Death scale is rejected without creating a tiny corpse',()=>{
  const d=fixture();d.apply('Disappear',[],m=>{m.Bones[0].Scaling=track([[1000,[1,1,1]],[1900,[.001,.001,.001]]]);});
  const before=structuredClone(d.model);assert.throws(()=>apply(d),/collapses the body/);assert.deepEqual(d.model,before);
});

test('missing Death or unsupported double-global visibility fails atomically',()=>{
  const d=fixture();d.apply('No Death',[],m=>{m.Sequences=m.Sequences.slice(0,1);});let before=structuredClone(d.model);assert.throws(()=>apply(d),/needs a Death/);assert.deepEqual(d.model,before);
  const other=fixture();other.apply('Global',[],m=>{m.GlobalSequences=[1000];m.GeosetAnims[0].Alpha=track([[0,[1]],[1000,[0]]],1,0);m.Materials[0].Layers[0].Alpha=track([[0,[1]],[1000,[0]]],1,0);});before=structuredClone(other.model);assert.throws(()=>apply(other),/global visibility/);assert.deepEqual(other.model,before);
});
