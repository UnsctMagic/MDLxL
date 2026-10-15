import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4 } from 'three';
import { ModelRenderer } from 'war3-model';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { constantTransformProposals } from '../src/optimizexl-constant-transforms.js';
import { runOptimizeStage, sanityProposals, simpleSettings } from '../src/optimizexl.js';
import { OptimizeXLSession } from '../src/optimizexl-session.js';
import { skinGeoset } from '../src/animation.js';

const seq = (start, end, Name = 'Any name') => ({ Name, Interval: new Uint32Array([start, end]), MinimumExtent: new Float32Array([-50,-50,0]), MaximumExtent: new Float32Array([50,50,100]), BoundsRadius: 100, MoveSpeed: 0, NonLooping: false, Rarity: 0 });
const track = rows => ({ LineType: 1, GlobalSeqId: null, Keys: rows.map(([Frame, Vector]) => ({ Frame, Vector: new Float32Array(Vector) })) });
const reopen = bytes => openDocument(bytes, 'model.mdx').model;
const plans = m => sanityProposals(m).filter(f => f.kind === 'constantTransform');
function fixture(property = 'Translation', value = [4,2,3]) {
  const d = createStarterDocument();
  d.apply('Constant spans and moving animation', ['Sequences', 'Bones'], m => {
    m.Sequences = [seq(100,500), seq(1000,1500), seq(2000,2400)];
    m.Bones[0][property] = track([[100,value],[500,value],[1000,value],[1250,value.map((v,i)=>i===0?v+.001:v)],[1500,value],[2000,value.map(v=>v*2)],[2400,value.map(v=>v*2)]]);
  });
  return d;
}
function nativePose(r, frame) {
  r.setFrame(frame); r.updateNode(r.rendererData.rootNode);
  const matrices = new Map(r.rendererData.nodes.filter(Boolean).map(n => [n.node.ObjectId, new Matrix4().fromArray(n.matrix)]));
  return r.rendererData.model.Geosets.flatMap(g => Array.from(skinGeoset(g, matrices)));
}

test('constant span proposal preserves every native posed vertex and moving sequence', () => {
  for (const [property, value] of [['Translation',[4,2,3]],['Scaling',[2,1,1]]]) {
    const d=fixture(property,value), bytes=d.serialize('mdx'), before=reopen(bytes), fixes=plans(before);
    assert.equal(fixes.length,1);assert.deepEqual(fixes[0].frames,[500,2400]);assert.equal(fixes[0].drop,false);
    assert.ok(!sanityProposals(before).some(f=>f.kind==='redundantTracks'&&[0,2].includes(f.sequence)));
    const result=runOptimizeStage(bytes,'sanity',{},fixes[0]),after=reopen(result.bytes);
    assert.ok(result.saved>0);assert.deepEqual(after.Sequences,before.Sequences);assert.deepEqual(after.Geosets,before.Geosets);
    assert.deepEqual(after.Bones[0][property].Keys.filter(k=>k.Frame>=1000&&k.Frame<=1500),before.Bones[0][property].Keys.filter(k=>k.Frame>=1000&&k.Frame<=1500));
    const a=new ModelRenderer(structuredClone(before)), b=new ModelRenderer(structuredClone(after));
    for(let si=0;si<3;si++){a.setSequence(si);b.setSequence(si);for(let f=before.Sequences[si].Interval[0];f<=before.Sequences[si].Interval[1];f+=5)assert.deepEqual(nativePose(a,f),nativePose(b,f));}
    assert.deepEqual(plans(after),[]);assert.deepEqual(d.serialize('mdx'),bytes);
  }
});

test('default-only local channels can be dropped, including an absent opening value', () => {
  for(const [property,value]of [['Translation',[0,0,0]],['Rotation',[0,0,0,1]],['Scaling',[1,1,1]]]){
    const d=fixture();d.apply('Exact default',['Bones'],m=>{m.Bones[0][property]=track([[200,value],[500,value],[1100,value],[1500,value]]);if(property!=='Translation')delete m.Bones[0].Translation;});
    const bytes=d.serialize('mdx'),before=reopen(bytes),fix=plans(before)[0];assert.ok(fix.drop);assert.equal(fix.frames.length,4);
    assert.ok(!sanityProposals(before).some(p=>p.kind==='openingTrack'&&p.path.at(-1)===property));
    const after=reopen(runOptimizeStage(bytes,'sanity',{},fix).bytes);assert.equal(after.Bones[0][property],undefined);
    const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));
    for(let si=0;si<3;si++){a.setSequence(si);b.setSequence(si);for(let f=before.Sequences[si].Interval[0];f<=before.Sequences[si].Interval[1];f+=7)assert.deepEqual(nativePose(a,f),nativePose(b,f));}
  }
});

test('setup and out-of-animation keys retain their existing repair owner before compaction', () => {
  const d=fixture('Translation',[0,0,0]);d.apply('Setup and editor pose',['Bones'],m=>{m.Bones[0].Translation=track([[0,[0,0,0]],[100,[0,0,0]],[500,[0,0,0]],[700,[8,0,0]],[1000,[0,0,0]],[1500,[0,0,0]]]);});
  const bytes=d.serialize('mdx'),before=reopen(bytes);assert.deepEqual(plans(before),[]);
  const unused=sanityProposals(before).find(p=>p.kind==='unusedLocalKeys');assert.ok(unused);
  const cleaned=runOptimizeStage(bytes,'sanity',{},unused),constant=plans(reopen(cleaned.bytes))[0];
  assert.equal(constant.drop,false);assert.ok(!constant.frames.includes(0));
  const direct=reopen(runOptimizeStage(cleaned.bytes,'sanity',{},constant).bytes);
  assert.equal(direct.Bones[0].Translation.Keys[0].Frame,0);assert.deepEqual(plans(direct),[]);
  assert.equal(before.Bones[0].Translation.Keys.find(k=>k.Frame===700).Vector[0],8);
});

test('globals, spline controls, overlaps, invalid times, nonidentity rotations and nonconstant spans stay protected', () => {
  const m={Sequences:[seq(100,500)],Bones:[{Name:'Neutral'}],Helpers:[]};
  const plain=track([[100,[0,0,0]],[300,[0,0,0]],[500,[0,0,0]]]);
  const propose=(t,property='Translation',model=m,collection='Bones')=>constantTransformProposals(model,[{track:t,path:[collection,'0',property]}]);
  for(const id of [0,2])assert.deepEqual(propose({...plain,GlobalSeqId:id}),[]);
  for(const type of [2,3])assert.deepEqual(propose({...plain,LineType:type}),[]);
  for(const vector of [[0,0,.1,Math.sqrt(.99)],[0,0,0,2],[0,0,0,0],[0,0,0,-1]])assert.deepEqual(propose(track([[100,vector],[500,vector]]),'Rotation'),[]);
  for(const intervals of [[seq(100,500),seq(400,700)],[seq(100,500),seq(500,700)],[seq(500,100)]])assert.deepEqual(propose(plain,'Translation',{...m,Sequences:intervals}),[]);
  const nonconstant=structuredClone(plain);nonconstant.Keys[1].Vector[0]=1e-8;assert.deepEqual(propose(nonconstant),[]);
  for(const mutate of [t=>t.Keys[1].Frame=100,t=>t.Keys[1].Frame=NaN,t=>t.Keys[1].Vector[0]=Infinity,t=>t.Keys[1].OutTan=new Float32Array(3)]){const t=structuredClone(plain);mutate(t);assert.deepEqual(propose(t),[]);}
  assert.deepEqual(propose(plain,'Translation',m,'Attachments'),[]);
  assert.deepEqual(propose(track([[50,[0,0,0]],[80,[0,0,0]]])),[]);
});

test('constant nondefault spans without an opening key stay unchanged', () => {
  const d=fixture();d.apply('Missing nondefault opening',['Bones'],m=>{m.Bones[0].Translation=track([[200,[3,0,0]],[500,[3,0,0]]]);});
  const bytes=d.serialize('mdx'),m=reopen(bytes);assert.deepEqual(plans(m),[]);assert.deepEqual(runOptimizeStage(bytes,'sanity',{}).bytes,bytes);
});

test('stale constant proposals are rejected and preview, approval, saving and Back retain the original', () => {
  const d=fixture(),bytes=d.serialize('mdx'),fix=plans(reopen(bytes))[0],session=new OptimizeXLSession(bytes,'source.mdx');
  const result=runOptimizeStage(bytes,'sanity',{},fix);session.propose(result,0);assert.deepEqual(session.accepted,bytes);session.approve('sanity',{});assert.deepEqual(session.savePayload().after,result.bytes);assert.deepEqual(session.savePayload().before,bytes);session.back();assert.deepEqual(session.accepted,bytes);
  d.apply('Changed authored value',['Bones'],m=>m.Bones[0].Translation.Keys[1].Vector[0]++);assert.throws(()=>runOptimizeStage(d.serialize('mdx'),'sanity',{},fix),/finding changed/);
});

test('existing redundant-key owner runs first and exact endpoint compaction follows on rescan', () => {
  const d=fixture();d.apply('Existing owner',['Bones'],m=>m.Bones[0].Translation=track([[100,[4,2,3]],[300,[4,2,3]],[500,[4,2,3]]]));
  const bytes=d.serialize('mdx'),m=reopen(bytes);assert.deepEqual(plans(m),[]);
  const old=sanityProposals(m).find(p=>p.kind==='redundantTracks');assert.ok(old);
  const cleaned=runOptimizeStage(bytes,'sanity',{},old),next=plans(reopen(cleaned.bytes))[0];assert.deepEqual(next.frames,[500]);
  assert.deepEqual(plans(reopen(runOptimizeStage(cleaned.bytes,'sanity',{},next).bytes)),[]);
  const stage=runOptimizeStage(bytes,'animation',simpleSettings('animation',0,m));assert.equal(stage.stats.keys,1);assert.ok(reopen(stage.bytes).Bones[0].Translation.Keys.some(k=>k.Frame===500));
});

test('independent constant tracks compose in either approval order and as one selected batch', () => {
  const d=fixture();d.apply('Second independent track',['Bones'],m=>m.Bones[0].Scaling=track([[100,[2,2,2]],[500,[2,2,2]]]));
  const bytes=d.serialize('mdx'),fixes=plans(reopen(bytes));assert.equal(fixes.length,2);
  const batch=runOptimizeStage(bytes,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix,settings:{}}))});
  for(const ids of [fixes.map(f=>f.id),fixes.map(f=>f.id).reverse()]){let current=bytes;for(const id of ids){const fix=plans(reopen(current)).find(p=>p.id===id);current=runOptimizeStage(current,'sanity',{},fix).bytes;}assert.deepEqual(current,batch.bytes);}
});
