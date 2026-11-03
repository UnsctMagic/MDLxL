import test from 'node:test';
import assert from 'node:assert/strict';
import { measureRigCandidate } from '../src/ai-rig-checks.js';
const key = (Frame, ...Vector) => ({ Frame, Vector });
const track = (...Keys) => ({ LineType: 1, Keys });
const bounds = () => ({ MinimumExtent: [-20,-20,-20], MaximumExtent: [20,20,20] });
function fixture(hd = false) {
  return {
    Info: bounds(), Sequences: [{ Name: 'Stand', Interval: [0, 4], ...bounds() }, { Name: 'Attack', Interval: [10, 14], ...bounds() }], GlobalSequences: [],
    Bones: [{ ObjectId: 0, Translation: track(key(0,0,0,0),key(4,0,0,0),key(10,0,0,0),key(12,5,0,0),key(14,0,0,0)) }, { ObjectId: 1 }],
    Geosets: [{ Vertices: [0,0,0,2,0,0,0,2,0], Faces: [0,1,2], VertexGroup: [0,0,0], Groups: [[0]], ...(hd ? { SkinWeights: [0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0,0,0,0,255,0,0,0] } : {}), ...bounds(), Anims: [bounds(), bounds()] }],
  };
}
const rigid = { rigidParts: [{ geoset: 0, driverBone: 0 }] };

test('rigid shape and driver attachment are independent across every clip, SD and weighted', async () => {
  for (const hd of [false,true]) {
    const a = fixture(hd), frozen = structuredClone(a), stretched = structuredClone(a);
    if (hd) for (let v=0;v<3;v++) frozen.Geosets[0].SkinWeights[v*8]=1;
    else frozen.Geosets[0].Groups = [[1]];
    const result = await measureRigCandidate(a, frozen, rigid);
    assert.ok(result.rigidParts[0].shape.max < 1e-6, 'a detached frozen shield keeps its rigid shape');
    assert.equal(result.rigidParts[0].attachment.max,5, 'a frozen shield leaves its moving driver');
    assert.deepEqual([result.rigidParts[0].attachment.worst.clip,result.rigidParts[0].attachment.worst.frame],['Attack',12]);
    assert.equal(result.rigidParts[0].attachment.worst.geosetId,1);
    stretched.Geosets[0].Vertices[3] = 4;
    const plate = (await measureRigCandidate(a,stretched,rigid)).rigidParts[0];
    assert.equal(plate.shape.max,2,'attached plate stretching is measured independently');
    assert.equal(plate.attachment.max,2);
    assert.deepEqual(result.clips.map(c=>c.framesSampled),[5,5]);
  }
});

test('driver-authored scaling is removed; explicit expectedScale allows an intentional rigid rescale', async () => {
  const a=fixture(),b=structuredClone(a);
  b.Bones[0].Scaling=track(key(0,1,1,1),key(4,3,2,1));
  const result=await measureRigCandidate(a,b,rigid);
  assert.ok(result.rigidParts[0].shape.max<1e-5);
  assert.ok(result.rigidParts[0].attachment.max<1e-5);
  b.Bones[0].Scaling=undefined;
  b.Geosets[0].Vertices=b.Geosets[0].Vertices.map(x=>x*2);
  const scaled=await measureRigCandidate(a,b,{rigidParts:[{geoset:0,driverBone:0,expectedScale:2}]});
  assert.ok(scaled.rigidParts[0].shape.max<1e-5);
  assert.ok(scaled.rigidParts[0].attachment.max<1e-5);
});

test('flexible edge strain and authored seams identify the worst location and are scale-aware', async () => {
  const a=fixture(),b=structuredClone(a);
  a.Geosets.push(structuredClone(a.Geosets[0]));b.Geosets.push(structuredClone(b.Geosets[0]));
  b.Geosets[0].Vertices[3]=4;b.Geosets[1].Groups=[[1]];
  const options={flexibleParts:[{geoset:0,seamPairs:[[{geoset:0,vertex:0},{geoset:1,vertex:0}]]}]};
  const row=(await measureRigCandidate(a,b,options)).flexibleParts[0];
  assert.equal(row.edgeStrain.max,2);
  assert.equal(row.seamOpening.max,5);
  assert.deepEqual([row.seamOpening.worst.clip,row.seamOpening.worst.frame],['Attack',12]);
  assert.equal(row.edgeStrain.worst.edge.length,2);
  for(const m of [a,b]) {
    for(const g of m.Geosets) g.Vertices=g.Vertices.map(x=>x*10);
    for(const bone of m.Bones) for(const k of bone.Translation?.Keys||[]) k.Vector=k.Vector.map(x=>x*10);
  }
  const large=(await measureRigCandidate(a,b,options)).flexibleParts[0];
  assert.ok(Math.abs(large.edgeStrain.normalized-row.edgeStrain.normalized)<1e-6);
  assert.ok(Math.abs(large.seamOpening.normalized-row.seamOpening.normalized)<1e-6);
});

test('animated bounds report static, sequence and geoset coverage, final frames, and missing extents', async () => {
  const a=fixture(),b=structuredClone(a);
  b.Geosets[0].MaximumExtent=[3,3,3];b.Geosets[0].Anims[1].MaximumExtent=[3,3,3];b.Sequences[1].MaximumExtent=[3,3,3];
  b.Bones[0].Translation.Keys.at(-1).Vector=[9,0,0];
  const result=await measureRigCandidate(a,b,{step:3});
  for(const owner of ['geoset-animation','sequence']) {
    const row=result.bounds.boxes.find(r=>r.owner===owner && (r.sequence===undefined||r.sequence===1));
    assert.equal(row.maxOverflow,8);assert.equal(row.worst.frame,14);assert.equal(row.worst.vertex,1);
  }
  assert.equal(result.bounds.boxes.find(r=>r.owner==='model').maxOverflow,0);
  assert.equal(result.bounds.boxes.find(r=>r.owner==='geoset').maxOverflow,0,'static geoset extents cover bind vertices; animation extents cover moving poses');
  delete b.Geosets[0].Anims[1].MinimumExtent;
  assert.ok((await measureRigCandidate(a,b)).bounds.missing.some(r=>r.owner==='geoset-animation'&&r.sequence===1));
});

test('topology changes, singular drivers, billboards and missing clips never become zero-error evidence', async () => {
  const a=fixture(),b=structuredClone(a);
  b.Geosets[0].Faces=[0,2,1];
  const topology=await measureRigCandidate(a,b,rigid);
  assert.deepEqual(topology.changedTopology,[0]);assert.equal(topology.rigidParts[0].shape.max,null);
  b.Geosets[0].Faces=[0,1,2];b.Bones[0].Scaling=track(key(0,0,0,0));b.Bones[0].Flags=8;
  const singular=await measureRigCandidate(a,b,{...rigid,sequences:[0]});
  assert.equal(singular.rigidParts[0].attachment.max,null);assert.ok(singular.rigidParts[0].unmeasured.length);
  assert.deepEqual(singular.cameraDependentNodes,[0]);
  b.Sequences[0].Name='Other';
  assert.equal((await measureRigCandidate(a,b,{...rigid,sequences:[0]})).missingClips.length,1);
});


test('rigid rotation, reflected/nonuniform driver scale and tiny model units keep distinct shape evidence', async () => {
  for (const unit of [1,1e-8,1e8]) {
    const a=fixture(),b=structuredClone(a);
    for(const m of [a,b])for(const g of m.Geosets)g.Vertices=g.Vertices.map(x=>x*unit);
    b.Bones[1].Rotation=track(key(0,0,0,0,1),key(4,0,0,1,0));
    b.Geosets[0].Groups=[[1]];
    const rotated=await measureRigCandidate(a,b,{...rigid,sequences:[0]});
    assert.ok(rotated.rigidParts[0].shape.normalized<1e-6,'whole-piece rotation cannot become shape damage');
    assert.ok(rotated.rigidParts[0].attachment.normalized>1,'orientation leaving the driver is attachment drift');
    b.Geosets[0].Groups=[[0]];
    b.Bones[0].Scaling=track(key(0,-2,3,0.5),key(4,-2,3,0.5));
    const scaled=await measureRigCandidate(a,b,{...rigid,sequences:[0]});
    assert.ok(scaled.rigidParts[0].shape.normalized<1e-6,'invertible reflected and nonuniform driver scale is authored motion');
    assert.ok(scaled.rigidParts[0].attachment.normalized<1e-6);
  }
});

test('flexible expected bending is compared to its baseline without a rigid-piece verdict', async () => {
  const a=fixture();a.Geosets[0].Groups=[[0],[1]];a.Geosets[0].VertexGroup=[0,1,0];
  a.Bones[1].Rotation=track(key(0,0,0,0,1),key(4,0,0,1,0));
  const result=await measureRigCandidate(a,a,{flexibleParts:[{geoset:0}],sequences:[0]});
  assert.equal(result.flexibleParts[0].edgeStrain.max,0);
  assert.deepEqual(result.rigidParts,[]);
});

test('invalid selectors/parts and cancellation reject instead of producing acceptance evidence', async () => {
  const m=fixture();
  for(const options of [{rigidParts:[null]},{rigidParts:[{geoset:0,driverBone:99}]},{rigidParts:[{geoset:0,driverBone:0,expectedScale:0}]},{flexibleParts:[{geoset:0,vertices:[]}]},{flexibleParts:[{geoset:0,seamPairs:[[{geoset:0,vertex:8},{geoset:0,vertex:0}]]}]},{sequences:[{sequence:0,globalSequence:0}]},{step:0}])
    await assert.rejects(measureRigCandidate(m,m,options),/rig|driver|scale|seam|vert|animation|step/i);
  const controller=new AbortController();controller.abort();
  await assert.rejects(measureRigCandidate(m,m,rigid,controller.signal),/abort/i);
});

test('camera caveats follow declared influences and ancestors, including mixed weighted-prefix/native-tail data', async () => {
  const a=fixture();
  a.Bones.push({ObjectId:2,Flags:16},{ObjectId:3,Flags:8});a.Bones[0].Parent=2;
  // Vertex zero uses weighted bone1, while other vertices use classic bone0.
  a.Geosets[0].SkinWeights=[1,0,0,0,255,0,0,0];
  const weighted=await measureRigCandidate(a,a,{rigidParts:[{geoset:0,vertices:[0],driverBone:1}],sequences:[0]});
  assert.deepEqual(weighted.cameraDependentNodes,[2,3]);
  assert.deepEqual(weighted.affectedCameraDependentNodes,[],'unrelated billboard flags cannot invalidate this vertex');
  const tail=await measureRigCandidate(a,a,{rigidParts:[{geoset:0,vertices:[1],driverBone:0}],sequences:[0]});
  assert.deepEqual(tail.affectedCameraDependentNodes,[2],'classic tail influence includes its billboard ancestor');
});

test('hidden corpse poses do not poison rig or animated bounds; disappearance cannot erase reference-visible evidence', async () => {
  const a=fixture(),b=structuredClone(a);
  a.GeosetAnims=[{GeosetId:0,Alpha:track(key(0,1),key(4,1),key(10,0),key(14,0))}];
  b.GeosetAnims=structuredClone(a.GeosetAnims);b.Geosets[0].Groups=[[1]];
  b.Sequences[1].MaximumExtent=[0,0,0];b.Geosets[0].Anims[1].MaximumExtent=[0,0,0];
  const result=await measureRigCandidate(a,b,rigid),row=result.rigidParts[0];
  assert.equal(row.attachment.max,0,'the invisible moving corpse is excluded');
  assert.deepEqual(row.coverage.map(c=>[c.measuredFrames,c.hiddenFrames]),[[5,0],[0,5]]);
  const hiddenBounds=result.bounds.boxes.find(r=>r.owner==='sequence'&&r.sequence===1);
  assert.equal(hiddenBounds.measuredVertices,0);assert.equal(hiddenBounds.maxOverflow,null);assert.equal(hiddenBounds.hiddenVertexSamples,15);
  a.GeosetAnims[0].Alpha=1;
  assert.equal((await measureRigCandidate(a,b,rigid)).rigidParts[0].attachment.max,5,'hiding a damaged candidate cannot hide baseline-visible drift');
  a.GeosetAnims[0].Alpha=0;b.GeosetAnims[0].Alpha=0;
  const none=(await measureRigCandidate(a,b,rigid)).rigidParts[0];
  assert.equal(none.attachment.max,null);assert.ok(none.unmeasured.some(r=>typeof r==='string'&&r.includes('No visible')));
});

test('declared rigid driver is checked against bind shape even when the original rig is frozen', async () => {
  const original=fixture();original.Geosets[0].Groups=[[1]];
  const repaired=structuredClone(original);repaired.Geosets[0].Groups=[[0]];
  const fixed=(await measureRigCandidate(original,repaired,rigid)).rigidParts[0];
  assert.ok(fixed.attachment.max<1e-6,'a first-job repair following the declared driver must pass without a golden rig');
  assert.ok(fixed.shape.max<1e-6);
  const unchanged=(await measureRigCandidate(original,original,rigid)).rigidParts[0];
  assert.equal(unchanged.attachment.max,5,'the broken frozen baseline must fail its own attachment goal');
});

test('absolute flexible strain and seam opening expose defects already present in reference motion', async () => {
  const a=fixture();a.Geosets[0].Groups=[[0],[1]];a.Geosets[0].VertexGroup=[0,1,0];
  a.Geosets.push(structuredClone(a.Geosets[0]));a.Geosets[1].Groups=[[1]];a.Geosets[1].VertexGroup=[0,0,0];
  const result=await measureRigCandidate(a,a,{flexibleParts:[{geoset:0,seamPairs:[[{geoset:0,vertex:0},{geoset:1,vertex:0}]]}]});
  const row=result.flexibleParts[0];
  assert.equal(row.edgeStrain.max,0);assert.equal(row.seamOpening.max,0);
  assert.ok(row.absoluteEdgeStrain.max>0);assert.equal(row.absoluteSeamOpening.max,5);
});
