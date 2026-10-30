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
  const narrow=body(.3),wide=body(1),extent=(r,part)=>{const xs=part.vertices.map(i=>r.geoset.Vertices[i*3]);return Math.max(...xs)-Math.min(...xs);};
  const a=narrow.parts.find(p=>p.kind==='torso'),b=wide.parts.find(p=>p.kind==='torso');assert.ok(a&&b);assert.equal(a.length,b.length);assert.ok(extent(wide,b)>extent(narrow,a)*1.15,'Broad bodies get broader ribs, within the native rib shape');
  assert.ok(narrow.parts.find(p=>p.kind==='skull').vertices.length>=9);
});
test('corpse ribs are one flat native rectangle on a level above the ground, and whatever hangs from a hand is no anatomy',()=>{
  const d=fixture();d.apply('Armed body',[],m=>{
    const root=m.Bones[0];root.Name='Bone_Root';delete root.Translation;
    const chest=createNode(m,'Bone');chest.Name='Bone_Chest';chest.Parent=root.ObjectId;
    const head=createNode(m,'Bone');head.Name='Bone_Head';head.Parent=chest.ObjectId;head.PivotPoint.set([0,35,0]);
    const hand=createNode(m,'Bone');hand.Name='Bone_Hand_R';hand.Parent=chest.ObjectId;hand.PivotPoint.set([30,0,0]);
    // A held object whose bone happens to carry an anatomical name.
    const held=createNode(m,'Bone');held.Name='Spiked_Head';held.Parent=hand.ObjectId;held.PivotPoint.set([60,0,0]);
    const g=m.Geosets[0];g.Vertices=g.Vertices.map((v,i)=>v*[1.5,1,.6][i%3]);g.Groups=[[chest.ObjectId]];
    for(const [node,dx,dy] of [[head,0,45],[held,60,0]]){const h=structuredClone(g);h.Vertices=h.Vertices.map((v,i)=>v*.3+[dx,dy,0][i%3]);h.Groups=[[node.ObjectId]];m.Geosets.push(h);m.GeosetAnims.push(createVisibilityGeosetAnimation(m.Geosets.length-1));}
  });
  const m=d.model,r=buildCorpseGeometry(m,[0,1,2],1),body=skinGeoset(m.Geosets[0],sampleNodeMatrices(m,r.frame,1));
  assert.equal(r.parts.filter(p=>p.kind==='skull').length,1,'Bones below a hand are held equipment, whatever they are called');
  assert.ok(!r.parts.some(p=>p.ids.includes(m.Bones.find(b=>b.Name==='Spiked_Head').ObjectId)));
  const ribs=r.parts.find(p=>p.kind==='torso').vertices.map(i=>r.geoset.Vertices[i*3+2]),top=Math.max(...Array.from(body).filter((_,i)=>i%3===2));
  assert.equal(ribs.length,4,'Like the native gutz corpses, a rib cage is one rectangle');
  assert.ok(Math.max(...ribs)-Math.min(...ribs)<1e-6&&Math.min(...ribs)>=2,'It lies flat, on a level above the ground');
  assert.ok(Math.max(...ribs)<top,'It stays below the body surface');
});
test('a body without a recognized head still gets ribs, and overlapping pieces never share a height',()=>{
  const d=fixture();d.apply('Headless',[],m=>{
    const root=m.Bones[0];root.Name='Bone_Root';delete root.Translation;
    const chest=createNode(m,'Bone');chest.Name='Bone_Chest';chest.Parent=root.ObjectId;chest.PivotPoint.set([0,10,0]);
    const g=m.Geosets[0];g.Vertices=g.Vertices.map((v,i)=>v*[1,2,.6][i%3]);g.Groups=[[chest.ObjectId]];
    for(const side of [-1,1]){let parent=chest;for(const [name,x] of [['Arm1',20],['Arm2',40],['Hand',60]]){
      const bone=createNode(m,'Bone');bone.Name=`Bone_${name}_${side<0?'L':'R'}`;bone.Parent=parent.ObjectId;bone.PivotPoint.set([x*side,10,0]);parent=bone;
      const h=structuredClone(g);h.Vertices=h.Vertices.map((v,i)=>v*[.4,.2,.5][i%3]+[(x-10)*side,10,0][i%3]);h.Groups=[[bone.ObjectId]];m.Geosets.push(h);m.GeosetAnims.push(createVisibilityGeosetAnimation(m.Geosets.length-1));
    }}
  });
  const r=buildCorpseGeometry(d.model,d.model.Geosets.map((_,i)=>i),1),{Vertices:v,Faces:f}=r.geoset;
  assert.equal(r.parts.filter(p=>p.kind==='skull').length,0);
  assert.equal(r.parts.filter(p=>p.kind==='torso').length,1,'The trunk comes from the body the limbs hang from, not from a head');
  // Where pieces overlap, the visible top and the surface just below it
  // belong to different pieces at clearly different heights.
  const owner=new Map();r.parts.forEach((p,k)=>p.vertices.forEach(i=>owner.set(i,k)));
  const p=i=>[v[i*3],v[i*3+1],v[i*3+2]],xs=v.filter((_,i)=>i%3===0),ys=v.filter((_,i)=>i%3===1);
  let overlap=0,fighting=0;
  for(let gx=0;gx<=60;gx++)for(let gy=0;gy<=60;gy++) {
    const x=Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*gx/60,y=Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*gy/60,hits=[];
    for(let t=0;t<f.length;t+=3){const [a,b,c]=[f[t],f[t+1],f[t+2]].map(p),det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-9)continue;const s=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,u=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;if(s>=0&&u>=0&&s+u<=1)hits.push({z:s*a[2]+u*b[2]+(1-s-u)*c[2],part:owner.get(f[t])});}
    hits.sort((a,b)=>b.z-a.z);if(hits.length<2||hits[0].part===hits[1].part)continue;overlap++;if(hits[0].z-hits[1].z<.05)fighting++;
  }
  assert.ok(overlap>0&&fighting/overlap<.02,`Pieces z-fight over ${fighting} of ${overlap} overlapping samples`);
});
test('Size and Height scale the fitted corpse, and 100% keeps it unchanged',()=>{
  const make=options=>{const d=fixture();const r=d.apply('Auto Corpse',AUTO_CORPSE_SECTIONS,m=>autoCorpse(m,options)).corpses[0];return {g:d.model.Geosets[r.corpseGeoset],r,m:d.model};};
  const plain=make({}),same=make({size:1,height:1}),big=make({size:1.5,height:1}),tall=make({size:1,height:2});
  assert.deepEqual(same.g.Vertices,plain.g.Vertices);
  const spread=g=>Math.max(...g.Vertices.filter((_,i)=>i%3===0))-Math.min(...g.Vertices.filter((_,i)=>i%3===0)),peak=g=>Math.max(...g.Vertices.filter((_,i)=>i%3===2));
  assert.ok(Math.abs(spread(big.g)/spread(plain.g)-1.5)<.01,'Size scales the footprint');
  assert.ok(peak(tall.g)>peak(plain.g)*1.5,'Height raises the bones');
  // A taller corpse is still buried completely before Decay Bone hides it.
  const bs=tall.m.Sequences[tall.r.bone];assert.ok(Math.max(...Array.from(posed(tall.m,tall.r.corpseGeoset,tall.r.bone,bs.Interval[1]-1)).filter((_,i)=>i%3===2))<0);
});
test('edited, added and removed pieces and the corpse tint reach the made corpse',()=>{
  const make=options=>{const d=fixture();const r=d.apply('Auto Corpse',AUTO_CORPSE_SECTIONS,m=>autoCorpse(m,options)).corpses[0];return {r,m:d.model,g:d.model.Geosets[r.corpseGeoset]};};
  const plain=make({}),pieces=plain.r.pieces,[cx,cy]=plain.r.sizeCenter,far=plain.r.span*2;
  assert.ok(pieces.length>0&&pieces.every(p=>p.start&&p.end&&p.half>0));
  // A piece placed outside the body outline is kept exactly where it was put.
  const added=make({pieces:[...pieces,{kind:'branch',start:[cx+far,cy,0],end:[cx+far+20,cy,0],half:4,rect:[.006,.005,.31,.495],ids:[],free:true}]});
  assert.ok(added.g.Vertices.filter((_,i)=>i%3===0).some(x=>x>cx+far),'An added piece outside the body is not trimmed away');
  const removed=make({pieces:added.r.pieces.slice(1)});assert.equal(removed.r.pieces.length,pieces.length);
  const red=make({color:[1,.3,.3]}),anim=red.m.GeosetAnims.find(a=>a.GeosetId===red.r.corpseGeoset);
  assert.deepEqual(Array.from(anim.Color).map(v=>+v.toFixed(2)),[1,.3,.3]);assert.equal(anim.Flags&2,2);
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
test('Death blood: splats and a spray are keyed in Death, other animations keep their events',()=>{
  const d=fixture();d.apply('Blood',[],m=>{const old=createNode(m,'EventObject');old.Name='SPLxHBS0';old.EventTrack=new Uint32Array([500,1400]);});
  const r=d.apply('Auto Corpse',AUTO_CORPSE_SECTIONS,m=>autoCorpse(m,{blood:[{type:'SPL',id:'OBL2',time:300,position:[5,6,0]},{type:'SPN',id:'HBF0',time:100,position:[0,0,0]}]})).corpses[0],m=d.model,[start]=m.Sequences[r.death].Interval;
  const names=m.EventObjects.map(e=>e.Name+':'+Array.from(e.EventTrack).join(','));
  assert.ok(names.includes('SPLxHBS0:500'),'The Stand key of an existing splat stays; its Death key is replaced');
  assert.ok(m.EventObjects.some(e=>/^SPL.OBL2$/.test(e.Name)&&e.EventTrack[0]===start+300&&e.PivotPoint[0]===5));
  assert.ok(m.EventObjects.some(e=>/^SPN.HBF0$/.test(e.Name)&&e.EventTrack[0]===start+100));
  assert.throws(()=>fixture().apply('Bad',AUTO_CORPSE_SECTIONS,m=>autoCorpse(m,{blood:[{type:'SPL',id:'SND0',time:0,position:[0,0,0]}]}),{rethrow:true}),/not a blood event/);
});
test('blood kinds: splat codes carry their race, sprays their first letter (night elf sprays use N)',async()=>{
  const {splatCode,parseSplat,sprayKind}=await import('../src/corpse-blood.js');
  assert.equal(splatCode('U','L',2),'UBL2');assert.equal(parseSplat('DBS1').race,'D');
  assert.deepEqual(['HBF0','OBG0','UBGH','NBAR','DBPT','CBAL'].map(sprayKind),['H','O','U','E','D','X']);
});

test('corpse excludes tracked team glow, retaining its every-layer and additive rules', () => {
  for (const mixed of [false, true]) {
    const d = fixture(), model = d.model, glowId = model.Geosets.length;
    const textureId = model.Textures.push({ Image: '', ReplaceableId: 2, Flags: 0 }) - 1;
    const layer = { ...structuredClone(model.Materials[0].Layers[0]), FilterMode: 0, TextureID: track([[0, [textureId]], [1900, [textureId]]], 0) };
    const materialId = model.Materials.push({ Layers: [layer, ...(mixed ? [structuredClone(model.Materials[0].Layers[0])] : [])] }) - 1;
    model.Geosets.push({ ...structuredClone(model.Geosets[0]), MaterialID: materialId });
    const before = structuredClone(model.Geosets[glowId]), materialBefore = structuredClone(model.Materials[materialId]);
    const result = apply(d).corpses[0];
    assert.equal(result.sourceBodyGeosets.includes(glowId), mixed, 'only all-glow/additive layers are excluded');
    assert.deepEqual(model.Geosets[glowId], before);
    if (!mixed) assert.deepEqual(model.Materials[materialId], materialBefore);
  }
});

// Owner report: a flail on its own skeleton (no limbs) became a second skull.
// Private model, skipped when absent: MDLXL_CORPSE_FLAIL or the research copy.
test('a separate weapon skeleton never becomes a corpse skull', {skip: !flailModel() && 'private flail model not on this machine'}, async () => {
  const fs = await import('node:fs');
  const {openDocument} = await import('../src/editor-document.js');
  const {allNodes} = await import('../src/animation.js');
  const d = openDocument(new Uint8Array(fs.readFileSync(flailModel())), 'flail.mdx');
  const byId = new Map(allNodes(d.model).map(n => [n.ObjectId, n]));
  const top = id => { let n = byId.get(id); while (byId.has(n?.Parent)) n = byId.get(n.Parent); return n?.ObjectId; };
  const r = apply(d).corpses[0], skulls = r.pieces.filter(p => p.kind === 'skull');
  assert.equal(skulls.length, 1, 'only the body head becomes a skull');
  const bodies = new Set(r.pieces.filter(p => p.kind !== 'skull' && p.ids?.length).flatMap(p => p.ids.map(top)));
  for (const p of r.pieces) for (const id of p.ids || []) assert.ok(bodies.has(top(id)), `${byId.get(id)?.Name} belongs to the body skeleton`);
});
function flailModel() {
  const fs = process.getBuiltinModule('node:fs');
  return [process.env.MDLXL_CORPSE_FLAIL, 'D:/Claude/research/fx-optimization-2026-10-30/fable-success/Fx_optimization_research/01_original/Fx_original.mdx'].find(p => p && fs.existsSync(p));
}
