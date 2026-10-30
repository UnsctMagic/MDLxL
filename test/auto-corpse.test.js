import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
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

// Keys of a track outside the given frame intervals.
const outside=(value,intervals)=>value?.Keys?{...value,Keys:value.Keys.filter(k=>!intervals.some(([a,b])=>k.Frame>=a&&k.Frame<=b))}:value;
test('the body itself holds the last Death pose in Decay Flesh and sinks; only the corpse is added',()=>{
  const d=fixture(),before=structuredClone(d.model),r=apply(d).corpses[0],m=d.model,fs=m.Sequences[r.flesh],bs=m.Sequences[r.bone];
  assert.equal(m.Geosets.length,before.Geosets.length+1,'no copy of the body, only the corpse');
  assert.deepEqual(r.bodyGeosets,[0]);assert.deepEqual(m.Geosets[0],before.Geosets[0]);
  near(posed(m,0,r.flesh,fs.Interval[0]),posed(before,0,r.death,r.sourceFrame));
  assert.ok(Array.from(posed(m,r.corpseGeoset,r.bone,bs.Interval[0])).filter((_,i)=>i%3===2).every(z=>z>0),'Corpse starts above the terrain even where the Death body intersects it');
  // Blizzard: one key holds the pose, the top bone sinks in a straight line.
  const decay=[Array.from(fs.Interval),Array.from(bs.Interval)];
  for(const [i,bone] of before.Bones.entries())for(const property of ['Translation','Rotation','Scaling'])assert.deepEqual(outside(m.Bones[i][property],decay),outside(bone[property],decay),`${bone.Name} ${property} outside decay`);
  assert.deepEqual(m.GlobalSequences,before.GlobalSequences);
  for(const [seq,s] of before.Sequences.entries())for(const t of [0,.5,1])assert.equal(alpha(m,0,seq,s.Interval[0]+t*(s.Interval[1]-s.Interval[0])),alpha(before,0,seq,s.Interval[0]+t*(s.Interval[1]-s.Interval[0])));
  for(const t of [0,.25,.5,.75,1]) {
    const p=posed(m,r.bodyGeosets[0],r.flesh,fs.Interval[0]+t*(fs.Interval[1]-fs.Interval[0])),base=posed(before,0,r.death,r.sourceFrame);
    near(p,base.map((v,i)=>v-(i%3===2?r.sinkDistance*t:0)),.001);
  }
  assert.ok(Math.max(...Array.from(posed(m,r.bodyGeosets[0],r.flesh,fs.Interval[1])).filter((_,i)=>i%3===2))<0);
  // Blizzard: the corpse lies still through all of Decay Bone, visible until its last frame.
  for(const t of [.25,.5,.75,1])near(posed(m,r.corpseGeoset,r.bone,bs.Interval[0]+t*(bs.Interval[1]-bs.Interval[0])),posed(m,r.corpseGeoset,r.bone,bs.Interval[0]));
  near(posed(m,r.corpseGeoset,r.bone,bs.Interval[0]),posed(m,r.corpseGeoset,r.flesh,fs.Interval[1]));
  assert.equal(alpha(m,r.corpseGeoset,r.bone,bs.Interval[1]-1),1);
  // ...and, like 198 of 206 native corpses, its material fades out over the last 1667 ms.
  const fade=t=>sampleTrack(m.Materials[m.Geosets[r.corpseGeoset].MaterialID].Layers[0].Alpha,t,{interval:bs.Interval,fallback:1});
  assert.equal(fade(bs.Interval[1]-1667),1);assert.ok(Math.abs(fade(bs.Interval[1]-833)-.5)<.01);assert.ok(fade(bs.Interval[1]-1)<.01);
  assert.equal(sampleTrack(m.Materials[m.Geosets[r.corpseGeoset].MaterialID].Layers[0].Alpha,fs.Interval[0]+167,{interval:fs.Interval,fallback:1}),1);
  for(const time of [fs.Interval[0],(fs.Interval[0]+fs.Interval[1])/2,fs.Interval[1]-1])assert.equal(alpha(m,0,r.flesh,time),1,'the body shows through Decay Flesh');
  assert.equal(alpha(m,0,r.flesh,fs.Interval[1]),0);
  assert.equal(alpha(m,r.corpseGeoset,r.flesh,fs.Interval[0]),0);
  assert.equal(alpha(m,r.corpseGeoset,r.flesh,fs.Interval[0]+167),1);
  assert.equal(alpha(m,r.corpseGeoset,r.bone,bs.Interval[0]),1);
  assert.equal(alpha(m,r.corpseGeoset,r.bone,bs.Interval[1]),0);
  assert.equal(alpha(m,r.bodyGeosets[0],r.bone,bs.Interval[0]),0);
  for(const seq of [0,1])for(const time of [before.Sequences[seq].Interval[0],before.Sequences[seq].Interval[1]]) {
    near(posed(m,0,seq,time),posed(before,0,seq,time));assert.equal(alpha(m,0,seq,time),alpha(before,0,seq,time));
    assert.equal(alpha(m,r.corpseGeoset,seq,time),0);
  }
});
test('global loops keep running in decay like Blizzard units; a globally moving top bone is refused',()=>{
  const d=fixture({globalMotion:true}),before=structuredClone(d.model),r=apply(d).corpses[0],m=d.model;
  assert.deepEqual(m.Bones[0].Rotation,before.Bones[0].Rotation,'the global rotation loop is untouched');
  assert.equal(m.Geosets.length,before.Geosets.length+1);
  // The loop spins the body around Z, so heights still sink exactly.
  const fs=m.Sequences[r.flesh],z=a=>Array.from(a).filter((_,i)=>i%3===2);
  near(z(posed(m,0,r.flesh,fs.Interval[1])),z(posed(before,0,r.death,r.sourceFrame)).map(v=>v-r.sinkDistance),.001);
  const g=fixture();g.apply('Global slide',[],x=>{x.GlobalSequences=[500];x.Bones[0].Translation.GlobalSeqId=0;});
  const kept=structuredClone(g.model);
  assert.throws(()=>apply(g),/global loop/);assert.deepEqual(g.model,kept);
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
// Legs (not arms): native arms get no long bone, and the overlap check needs overlapping limb bones.
test('a body without a recognized head still gets ribs, and overlapping pieces never share a height',()=>{
  const d=fixture();d.apply('Headless',[],m=>{
    const root=m.Bones[0];root.Name='Bone_Root';delete root.Translation;
    const chest=createNode(m,'Bone');chest.Name='Bone_Chest';chest.Parent=root.ObjectId;chest.PivotPoint.set([0,10,0]);
    const g=m.Geosets[0];g.Vertices=g.Vertices.map((v,i)=>v*[1,2,.6][i%3]);g.Groups=[[chest.ObjectId]];
    for(const side of [-1,1]){let parent=chest;for(const [name,x] of [['Leg1',20],['Leg2',40],['Foot',60]]){
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
  // A taller corpse lies still through Decay Bone like any native corpse.
  const bs=tall.m.Sequences[tall.r.bone];near(posed(tall.m,tall.r.corpseGeoset,tall.r.bone,bs.Interval[1]-1),posed(tall.m,tall.r.corpseGeoset,tall.r.bone,bs.Interval[0]));
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
// Real models: the SD Footman (out/pose, prepared by out/fixtures.sh) and the owner's flail.
const footmanModel=()=>{const file=new URL('../out/pose/Footman.mdx',import.meta.url);return existsSync(file)?file:null;};
test('the skull has the native gutz skull proportions and rests near the ground',{skip:!footmanModel()&&!flailModel()&&'no SD Footman or flail on this machine'},async()=>{
  // Every native skull is one mesh scaled evenly: 0.72 of its length wide, 0.42 tall, 0.22 above the ground.
  const {openDocument}=await import('../src/editor-document.js');
  for(const file of [footmanModel(),flailModel()].filter(Boolean)) {
  const d=openDocument(new Uint8Array(readFileSync(file)),'model.mdx'),r=apply(d).corpses[0],g=d.model.Geosets[r.corpseGeoset];
  const skulls=r.parts.filter(p=>p.kind==='skull');assert.ok(skulls.length>0);
  for(const part of skulls) {
    const ids=part.vertices,P=ids.map(i=>[g.Vertices[i*3],g.Vertices[i*3+1],g.Vertices[i*3+2]]);
    const length=Math.hypot(part.end[0]-part.start[0],part.end[1]-part.start[1]),axis=[(part.end[0]-part.start[0])/length,(part.end[1]-part.start[1])/length],side=[axis[1],-axis[0]];
    const across=P.map(p=>p[0]*side[0]+p[1]*side[1]),z=P.map(p=>p[2]);
    assert.ok(Math.abs((Math.max(...across)-Math.min(...across))/length-.724)<.02,'skull width is 0.72 of its length');
    assert.ok(Math.abs((Math.max(...z)-Math.min(...z))/length-.42)<.01,'skull height is 0.42 of its length');
    assert.ok(Math.abs(Math.min(...z)/length-.218)<.01,'skull rests 0.22 of its length above the ground');
  }
  }
});
test('normal arms get an upper-arm bone plus a forearm hand, and legs get two bones',{skip:!footmanModel()&&!flailModel()&&'no SD Footman or flail on this machine'},async()=>{
  // Owner correction: normal arms need two pieces, including their upper arm.
  const {openDocument}=await import('../src/editor-document.js');
  for(const file of [footmanModel(),flailModel()].filter(Boolean)) {
    const r=apply(openDocument(new Uint8Array(readFileSync(file)),'model.mdx')).corpses[0],count=kind=>r.pieces.filter(p=>p.kind===kind).length;
    assert.equal(count('arm'),count('hand'),'one upper-arm bone accompanies each forearm/hand piece');
    assert.ok(count('hand')>=2,'the hands stay');
    assert.ok(count('leg')>=4&&count('leg')%2===0,'two long bones per leg');
  }
});

// The owner's rejected result covered roughly 40% of the dead-body outline;
// Blizzard's 206-unit median mesh area is 83%, with small native overhangs.
test('real corpses occupy a Blizzard-sized footprint instead of thin joint strips',{skip:!footmanModel()&&!flailModel()&&'prepare the SD Footman or set MDLXL_CORPSE_FLAIL'},async()=>{
  const {booleanContours,signedArea}=await import('../src/forge-geometry.js');
  const {openDocument}=await import('../src/editor-document.js');
  const files=[footmanModel(),flailModel()].filter(Boolean);
  const area=loops=>Math.abs(loops.reduce((sum,loop)=>sum+signedArea(loop),0));
  for(const file of files){
    const d=openDocument(new Uint8Array(readFileSync(file)),'model.mdx');
    const r=apply(d).corpses[0],g=d.model.Geosets[r.corpseGeoset],triangles=[];
    for(let f=0;f<g.Faces.length;f+=3){const tri=Array.from(g.Faces.slice(f,f+3),i=>[g.Vertices[i*3],g.Vertices[i*3+1]]);if(signedArea(tri)<0)tri.reverse();triangles.push(tri);}
    const footprint=booleanContours(triangles,[],'add',r.span),bodyArea=area(r.outline);
    const ratio=area(footprint)/bodyArea,coverage=area(booleanContours(footprint,r.outline,'keep',r.span))/bodyArea;
    assert.ok(ratio>=.65&&ratio<=1.1,`${file}: corpse/body area ${ratio.toFixed(3)} must be 0.65–1.10 (Blizzard central range)`);
    assert.ok(coverage>=.55,`${file}: only ${(coverage*100).toFixed(1)}% of the dead body is covered`);
  }
});

test('a detached Death chest with a POSE head keeps its skull, while the separate flail stays excluded',{skip:!process.env.MDLXL_CORPSE_DETACHED&&'set MDLXL_CORPSE_DETACHED to the owner ratling fixture'},async()=>{
  const file=process.env.MDLXL_CORPSE_DETACHED;
  assert.ok(file&&existsSync(file),'prepare the owner ratling fixture');
  const {openDocument}=await import('../src/editor-document.js');
  const {allNodes}=await import('../src/animation.js');
  const d=openDocument(new Uint8Array(readFileSync(file)),'ratling.mdx'),byId=new Map(allNodes(d.model).map(n=>[n.ObjectId,n]));
  const r=apply(d).corpses[0],skulls=r.pieces.filter(p=>p.kind==='skull');
  assert.equal(skulls.length,1,'the visible detached Death head needs a skull');
  assert.equal(byId.get(skulls[0].ids[0]).Name,'gore_head','the skull belongs to the final Death head, not the hidden living head');
});

test('native hand pieces retain forearm-scale reach instead of shrinking to palm vertices',{skip:!flailModel()&&'set MDLXL_CORPSE_FLAIL to the owner flail fixture'},async()=>{
  const {openDocument}=await import('../src/editor-document.js');
  const {suggestPoseRig,poseChainIds}=await import('../src/pose-ik.js');
  const {allNodes,nodePivot}=await import('../src/animation.js');
  const {Vector3}=await import('three');
  for(const file of [flailModel(),new URL('../out/pose/Ogre.mdx',import.meta.url)]){
  const d=openDocument(new Uint8Array(readFileSync(file)),'model.mdx'),m=structuredClone(d.model),r=apply(d).corpses[0];
  const rig=suggestPoseRig(m,r.sourceFrame,r.death),M=sampleNodeMatrices(m,r.sourceFrame,r.death),nodes=new Map(allNodes(m).map(n=>[n.ObjectId,n]));
  for(const hand of r.pieces.filter(p=>p.kind==='hand')){
    const chain=rig.chains.find(c=>c.kind==='arm'&&hand.ids.includes(c.end));assert.ok(chain);
    const ids=poseChainIds(chain),at=id=>new Vector3().fromArray(nodePivot(m,nodes.get(id),id)).applyMatrix4(M.get(id)),a=at(ids.at(-2)),b=at(ids.at(-1));
    const forearm=Math.hypot(b.x-a.x,b.y-a.y),length=Math.hypot(hand.end[0]-hand.start[0],hand.end[1]-hand.start[1]);
    assert.ok(length>=forearm,`hand length ${length.toFixed(2)} must cover its ${forearm.toFixed(2)} forearm (native hands reach 1.62x)`);
    assert.ok(length<=forearm*2.1,`hand length ${length.toFixed(2)} must not include held equipment beyond its ${forearm.toFixed(2)} forearm`);
  }
  }
});


test('ribs stay on the chest and pelvis instead of consuming tail skin',{skip:!process.env.MDLXL_CORPSE_TAILED&&'set MDLXL_CORPSE_TAILED to the owner Skink fixture'},async()=>{
  const {openDocument}=await import('../src/editor-document.js');
  const {suggestPoseRig}=await import('../src/pose-ik.js');
  const {allNodes,nodePivot}=await import('../src/animation.js');
  const {Vector3}=await import('three');
  const file=process.env.MDLXL_CORPSE_TAILED;assert.ok(existsSync(file),'prepare the owner Skink fixture');
  const d=openDocument(new Uint8Array(readFileSync(file)),'model.mdx'),m=structuredClone(d.model),r=apply(d).corpses[0];
  const rig=suggestPoseRig(m,r.sourceFrame,r.death),M=sampleNodeMatrices(m,r.sourceFrame,r.death),nodes=new Map(allNodes(m).map(n=>[n.ObjectId,n]));
  const at=id=>new Vector3().fromArray(nodePivot(m,nodes.get(id),id)).applyMatrix4(M.get(id));
  const head=r.pieces.find(p=>p.kind==='skull'),rib=r.pieces.find(p=>p.kind==='torso');assert.ok(head&&rib);
  const neck=at(head.ids[0]),hips=rig.chains.filter(c=>c.kind==='leg').map(c=>at(c.root));assert.ok(hips.length);
  const pelvis=hips.reduce((sum,p)=>sum.addScaledVector(p,1/hips.length),new Vector3()),dx=pelvis.x-neck.x,dy=pelvis.y-neck.y,length2=dx*dx+dy*dy;
  for(const p of [rib.start,rib.end]){
    const along=((p[0]-neck.x)*dx+(p[1]-neck.y)*dy)/length2;
    assert.ok(along>=-.5&&along<=1.5,`rib endpoint ${along.toFixed(2)} torso lengths from the neck must stay around the chest/pelvis, not follow the tail`);
  }
});


const robeFixtures=()=>[new URL('../out/pose/Necromancer.mdx',import.meta.url),process.env.MDLXL_CORPSE_ROBED].filter(Boolean);
const robeOptions={skip:!process.env.MDLXL_CORPSE_ROBED&&'set MDLXL_CORPSE_ROBED to the owner Lahmian fixture'};
async function robeCase(file){
  const {openDocument}=await import('../src/editor-document.js');
  const {allNodes,nodePivot}=await import('../src/animation.js');
  const {Vector3}=await import('three');
  assert.ok(existsSync(file),'prepare both Necromancer and owner Lahmian fixtures');
  const d=openDocument(new Uint8Array(readFileSync(file)),'model.mdx'),m=structuredClone(d.model),r=apply(d).corpses[0];
  const nodes=allNodes(m),M=sampleNodeMatrices(m,r.sourceFrame,r.death),at=id=>new Vector3().fromArray(nodePivot(m,nodes.find(n=>n.ObjectId===id),id)).applyMatrix4(M.get(id)).toArray();
  const byName=name=>nodes.find(n=>n.Name===name)?.ObjectId;
  const legs=byName('Hip_R')!=null?[['Hip_R','Knee_R','Ankle_R'],['Hip_L','Knee_L','Ankle_L']]:[['UpperLegL','LowerLegL','FootL'],['UpperLegR','LowerLegR','FootR']];
  return {m,r,at,nodes,legs:legs.map(names=>names.map(byName))};
}
test('robes retain both anatomical hip-knee-foot legs, never a root-to-foot-mesh chain',robeOptions,async()=>{
  for(const file of robeFixtures()){
    const {r,legs}=await robeCase(file),bones=r.pieces.filter(p=>p.kind==='leg');
    assert.equal(bones.length,4,`${file}: two bones per leg must survive the robe`);
    for(const ids of legs)for(let i=0;i<2;i++)assert.ok(bones.some(p=>p.ids[0]===ids[i]&&p.ids.at(-1)===ids[i+1]),`${file}: missing anatomical leg segment ${ids[i]} to ${ids[i+1]}`);
  }
});
test('robed humanoid ribs end at the pelvis rather than at the clothing hem',robeOptions,async()=>{
  for(const file of robeFixtures()){
    const {r,at,legs}=await robeCase(file),rib=r.pieces.find(p=>p.kind==='torso'),head=r.pieces.find(p=>p.kind==='skull');
    assert.ok(rib&&head);
    const neck=at(head.ids[0]),hips=legs.map(ids=>at(ids[0])),pelvis=hips[0].map((v,i)=>(v+hips[1][i])/2),dx=pelvis[0]-neck[0],dy=pelvis[1]-neck[1],len2=dx*dx+dy*dy;
    for(const p of [rib.start,rib.end]){
      const along=((p[0]-neck[0])*dx+(p[1]-neck[1])*dy)/len2;
      assert.ok(along>=-.25&&along<=1.25,`${file}: rib endpoint ${along.toFixed(2)} torso lengths from the neck reaches the robe instead of the pelvis`);
    }
  }
});
test('extending named garment panels changes the chalk outline but does not grow the anatomy',robeOptions,async()=>{
  const {nameTokens}=await import('../src/rig-names.js');
  const {nodeIndex}=await import('../src/node-hierarchy.js');
  const {vertexBones}=await import('../src/part-bones.js');
  for(const file of robeFixtures()){
    const {m,r,nodes}=await robeCase(file),tree=nodeIndex(m,nodes);
    const garment=id=>tree.ancestors(id,true).some(a=>nameTokens(tree.byId.get(a)?.Name).some(t=>['robe','skirt','dress','flap','flaps'].includes(t)));
    let count=0;
    for(const gi of r.sourceBodyGeosets){const g=m.Geosets[gi];for(let i=0;i<g.Vertices.length/3;i++){
      const ids=vertexBones(g,i,{minWeight:32});if(!ids.length||!ids.every(garment))continue;
      for(let a=0;a<3;a++)g.Vertices[i*3+a]*=2;
      count++;
    }}
    assert.ok(count>0,'real garment vertices were changed');
    const changed=buildCorpseGeometry(m,r.sourceBodyGeosets,r.death);
    assert.notDeepEqual(changed.outline,r.outline,'chalk still shows the dressed body');
    assert.equal(changed.pieces.length,r.pieces.length,'clothes never add anatomical pieces');
    for(let i=0;i<r.pieces.length;i++){
      const a=r.pieces[i],b=changed.pieces[i];assert.equal(a.kind,b.kind);
      const dimensions=p=>[...p.start.slice(0,2),...p.end.slice(0,2),p.half];
      near(dimensions(a),dimensions(b),.01);
    }
  }
});



test('Medivh ribs fit his shoulders, not his cape, including blended cloth vertices',{skip:!existsSync(new URL('../out/pose/Medivh.mdx',import.meta.url))&&'prepare SD Medivh'},async()=>{
  const {m,r,at,nodes}=await robeCase(new URL('../out/pose/Medivh.mdx',import.meta.url));
  const {nameTokens}=await import('../src/rig-names.js');
  const {nodeIndex}=await import('../src/node-hierarchy.js');
  const {vertexBones}=await import('../src/part-bones.js');
  const shoulder=side=>at(nodes.find(n=>n.Name===`Bone_Arm1_${side}`).ObjectId),a=shoulder('L'),b=shoulder('R');
  const shoulderWidth=Math.hypot(a[0]-b[0],a[1]-b[1]),rib=r.pieces.find(p=>p.kind==='torso');
  assert.ok(rib.half*2<=shoulderWidth*1.5,`rib width ${(rib.half*2).toFixed(1)} must fit the ${shoulderWidth.toFixed(1)} shoulder span, not the cape`);
  const tree=nodeIndex(m,nodes),garment=id=>tree.ancestors(id,true).some(a=>nameTokens(tree.byId.get(a)?.Name).some(t=>['cape','cloth','cloak'].includes(t)));
  let blended=0;
  for(const gi of r.sourceBodyGeosets){const g=m.Geosets[gi];for(let i=0;i<g.Vertices.length/3;i++){
    const ids=vertexBones(g,i,{minWeight:32});if(!ids.some(garment))continue;
    if(!ids.every(garment))blended++;
    for(let a=0;a<3;a++)g.Vertices[i*3+a]*=1.5;
  }}
  assert.ok(blended>0,'the real cape shares skin weights with the body');
  const changed=buildCorpseGeometry(m,r.sourceBodyGeosets,r.death);
  assert.equal(changed.pieces.length,r.pieces.length);
  for(let i=0;i<r.pieces.length;i++){
    const dimensions=p=>[...p.start.slice(0,2),...p.end.slice(0,2),p.half];
    near(dimensions(r.pieces[i]),dimensions(changed.pieces[i]),.01);
  }
});
test('Guldan backpack never becomes an anatomical bone',{skip:!existsSync(new URL('../out/pose/Guldan.mdx',import.meta.url))&&'prepare SD Guldan'},async()=>{
  const {r,nodes}=await robeCase(new URL('../out/pose/Guldan.mdx',import.meta.url));
  const pack=nodes.filter(n=>/backpack/i.test(n.Name)).map(n=>n.ObjectId);assert.ok(pack.length);
  assert.ok(r.pieces.every(p=>!p.ids.some(id=>pack.includes(id))),'backpack controls must not generate corpse bones');
});


test('Acolyte keeps two arms and two legs under the robe using its authored foot references',{skip:!existsSync(new URL('../out/pose/Acolyte.mdx',import.meta.url))&&'prepare SD Acolyte'},async()=>{
  const {r}=await robeCase(new URL('../out/pose/Acolyte.mdx',import.meta.url));
  const count=kind=>r.pieces.filter(p=>p.kind===kind).length;
  assert.equal(count('skull'),1);assert.equal(count('torso'),1);
  assert.equal(count('arm'),2);assert.equal(count('hand'),2);
  assert.equal(count('leg'),4,'two thigh and two lower-leg pieces, even when the skirt has no knee joints');
  assert.equal(count('branch'),0,'a human robe does not add extra limbs');
  const legs=r.pieces.filter(p=>p.kind==='leg');
  assert.equal(legs.filter(p=>Math.min(p.start[0],p.end[0]) < -45).length,2,'both lower legs reach the feet beneath the final Death robe');
  assert.ok(legs.every(p=>p.half*2<30),'the skirt width must not become a leg width');
});


test('quadruped trunks reach the hind hips instead of ending at the front legs',{skip:!existsSync(new URL('../out/pose/DragonSeaTurtle.mdx',import.meta.url))&&'prepare turtle, centaur and knight'},async()=>{
  for(const name of ['DragonSeaTurtle','CentaurKhan','Knight']){
    const {r,at,nodes}=await robeCase(new URL(`../out/pose/${name}.mdx`,import.meta.url)),byId=new Map(nodes.map(n=>[n.ObjectId,n]));
    const roots=[...new Set(r.pieces.filter(p=>p.kind==='leg').map(p=>p.ids[0]))].filter(id=>/leg1.*rear|back.*leg/i.test(byId.get(id)?.Name));
    assert.equal(roots.length,2,`${name}: both actual hind hip joints were found`);
    const ps=roots.map(at),hip=ps[0].map((v,i)=>(v+ps[1][i])/2);
    const covers=p=>{const dx=p.end[0]-p.start[0],dy=p.end[1]-p.start[1],len=Math.hypot(dx,dy),x=hip[0]-p.start[0],y=hip[1]-p.start[1],along=(x*dx+y*dy)/len,across=(x*dy-y*dx)/len;return along>=-len*.1&&along<=len*1.1&&Math.abs(across)<=p.half*1.1;};
    assert.ok(r.pieces.filter(p=>p.kind==='torso').some(covers),`${name}: the trunk must cover the hind pelvis, not only the front-leg/neck region`);
  }
});
test('the turtle tail stays behind the shell instead of becoming a bone through its trunk',{skip:!existsSync(new URL('../out/pose/DragonSeaTurtle.mdx',import.meta.url))&&'prepare SD turtle'},async()=>{
  const {r,at,nodes}=await robeCase(new URL('../out/pose/DragonSeaTurtle.mdx',import.meta.url));
  const a=at(nodes.find(n=>n.Name==='Bone Tail 03').ObjectId),b=at(nodes.find(n=>n.Name==='Bone Tail 04').ObjectId),dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
  const tails=r.pieces.filter(p=>p.kind==='branch');assert.ok(tails.length);
  for(const p of tails)for(const v of [p.start,p.end])assert.ok(((v[0]-a[0])*dx+(v[1]-a[1])*dy)/len2>=-.35,'tail pieces must not cross the shell from the waist to the tail root');
});
