import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, compileTrackSampler, composeNodeMatrices, inheritedParentMatrix, keysInInterval, nodePivot, sampleNodeMatrices, sampleNodeProperty, sampleTrack, TRANSFORM_DEFAULTS, worldPivot } from '../src/animation.js';
import { movementParentMatrix, sampleMovement } from '../src/movement.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

// The node maths before animation.js owned it (audit WP-1.3), kept here as the
// reference the shared version must match bit for bit.
function referenceMatrices(model, frame = 0, sequenceIndex = -1, globalTime = frame) {
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  const matrices = new Map(), visiting = new Set();
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  const bindPose = sequenceIndex < 0 || !interval;
  const options = { interval, globalSequences: model.GlobalSequences, globalTime };
  function resolve(id) {
    if (matrices.has(id)) return matrices.get(id);
    const node = byId.get(id);
    if (!node || visiting.has(id)) return new Matrix4();
    visiting.add(id);
    let matrix = new Matrix4();
    if (!bindPose) {
      const translation = new Vector3().fromArray(sampleTrack(node.Translation, frame, { ...options, fallback: [0, 0, 0] }));
      const rotation = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options, fallback: [0, 0, 0, 1], quaternion: true }));
      const scale = new Vector3().fromArray(sampleTrack(node.Scaling, frame, { ...options, fallback: [1, 1, 1] }));
      const pivot = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[id] || [0, 0, 0]);
      matrix.compose(translation, rotation, scale);
      const rotatedPivot = pivot.clone().applyMatrix4(matrix).sub(translation);
      matrix.setPosition(translation.add(pivot).sub(rotatedPivot));
      if (node.Parent != null && byId.has(node.Parent)) {
        let parent = resolve(node.Parent);
        if (node.Flags & 7) {
          const p = new Vector3(), q = new Quaternion(), s = new Vector3();
          parent.decompose(p, q, s);
          if (node.Flags & 1) p.set(0, 0, 0);
          if (node.Flags & 2) q.identity();
          if (node.Flags & 4) s.set(1, 1, 1);
          parent = new Matrix4().compose(p, q, s);
        }
        matrix.premultiply(parent);
      }
    }
    visiting.delete(id); matrices.set(id, matrix); return matrix;
  }
  nodes.forEach(node => resolve(node.ObjectId));
  return matrices;
}

const sameMaps = (actual, expected) => {
  assert.deepEqual([...actual.keys()], [...expected.keys()]);
  for (const [id, matrix] of expected) assert.ok(actual.get(id).elements.every((v, i) => Object.is(v, matrix.elements[i])), `node ${id} differs`);
};
const knight = () => openDocument(readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url)), 'knight.mdx').model;
// Every inherit-flag combination on a parented node, so the shared Flags block is exercised.
const withFlags = model => { allNodes(model).forEach((node, i) => { if (node.Parent != null && node.Parent >= 0) node.Flags = (node.Flags & ~7) | (i % 8); }); return model; };

test('shared node matrices match the previous sampler bit for bit', () => {
  for (const model of [createDemoDocument().model, knight(), withFlags(knight())]) {
    model.Sequences.forEach((sequence, index) => {
      const [from, to] = sequence.Interval;
      for (const frame of [from, from + (to - from) / 3, (from + to) / 2, to]) sameMaps(sampleNodeMatrices(model, frame, index), referenceMatrices(model, frame, index));
    });
    sameMaps(sampleNodeMatrices(model), referenceMatrices(model));
  }
});

test('parent loops resolve to identity as before', () => {
  const model = knight(), nodes = allNodes(model).filter(node => node.Parent != null && node.Parent >= 0);
  const [a] = nodes, parent = allNodes(model).find(node => node.ObjectId === a.Parent);
  parent.Parent = a.ObjectId;
  const frame = model.Sequences[0].Interval[0] + 100;
  sameMaps(sampleNodeMatrices(model, frame, 0), referenceMatrices(model, frame, 0));
});

test('inherited parent matrix and its callers keep their old results', () => {
  const parent = new Matrix4().compose(new Vector3(3, -4, 5), new Quaternion(0.2, -0.3, 0.4, 0.8).normalize(), new Vector3(1.5, 0.5, 2));
  assert.equal(inheritedParentMatrix(parent, 8), parent);
  for (let flags = 1; flags < 8; flags++) {
    const p = new Vector3(), q = new Quaternion(), s = new Vector3();
    parent.decompose(p, q, s);
    if (flags & 1) p.set(0, 0, 0); if (flags & 2) q.identity(); if (flags & 4) s.set(1, 1, 1);
    const expected = new Matrix4().compose(p, q, s);
    assert.deepEqual(inheritedParentMatrix(parent, flags).elements, expected.elements);
    const moved = movementParentMatrix({ Parent: 7, Flags: flags }, new Map([[7, parent]]));
    assert.deepEqual(moved.elements, expected.elements);
  }
  const plain = movementParentMatrix({ Parent: 7, Flags: 0 }, new Map([[7, parent]]));
  assert.notEqual(plain, parent);
  assert.deepEqual(plain.elements, parent.elements);
});

test('composeNodeMatrices takes local transforms from the caller', () => {
  const model = knight(), frame = model.Sequences[0].Interval[0] + 250;
  const custom = composeNodeMatrices(model, allNodes(model).map(n => n.ObjectId), node => ({
    t: new Vector3().fromArray(sampleNodeProperty(model, node, 'Translation', frame, 0)),
    r: new Quaternion().fromArray(sampleNodeProperty(model, node, 'Rotation', frame, 0)),
    s: new Vector3().fromArray(sampleNodeProperty(model, node, 'Scaling', frame, 0)),
  }));
  sameMaps(custom, referenceMatrices(model, frame, 0));
});

test('node property sampling, pivots and interval keys match the inline copies', () => {
  const model = knight(), [from, to] = model.Sequences[0].Interval;
  for (const node of allNodes(model)) {
    for (const property of ['Translation', 'Rotation', 'Scaling']) {
      const old = Array.from(sampleTrack(node[property], from + 77, { interval: model.Sequences[0].Interval, globalSequences: model.GlobalSequences, globalTime: from + 77,
        fallback: { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] }[property], quaternion: property === 'Rotation' }));
      assert.deepEqual(sampleNodeProperty(model, node, property, from + 77, 0), old);
      assert.deepEqual(sampleMovement(model, node, property, from + 77, 0), old);
      if (node[property]?.Keys) assert.deepEqual(keysInInterval(node[property], [from, to]), node[property].Keys.filter(k => k.Frame >= from && k.Frame <= to));
    }
    assert.equal(nodePivot(model, node), node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
  }
  assert.deepEqual(nodePivot({ PivotPoints: [[1, 2, 3]] }, undefined, 0), [1, 2, 3]);
  assert.deepEqual(nodePivot({}, undefined, 4), [0, 0, 0]);
  const matrices = new Map([[2, new Matrix4().makeTranslation(1, 2, 3)]]);
  assert.deepEqual(worldPivot({ PivotPoints: { 2: [1, 1, 1] } }, 2, matrices).toArray(), [2, 3, 4]);
  assert.deepEqual(worldPivot({}, 5, matrices, { PivotPoint: [1, 0, 0] }).toArray(), [1, 0, 0]);
  assert.ok(Object.isFrozen(TRANSFORM_DEFAULTS.Rotation));
});


test('compiled tracks match the shared sampler bit for bit across domains and controls',()=>{
  const model=withFlags(knight());
  for(const node of allNodes(model))for(const property of ['Translation','Rotation','Scaling'])for(let sequence=0;sequence<model.Sequences.length;sequence++){
    const interval=model.Sequences[sequence].Interval,options={interval,globalSequences:model.GlobalSequences,globalTime:17,fallback:TRANSFORM_DEFAULTS[property],quaternion:property==='Rotation'};
    const compiled=compileTrackSampler(node[property],options);
    for(let i=0;i<=8;i++){
      const frame=interval[0]+(interval[1]-interval[0])*i/8;
      assert.deepEqual(compiled(frame),sampleTrack(node[property],frame,options));
    }
  }
  for(const GlobalSeqId of [0,8,-1,null]){
    const track={GlobalSeqId,LineType:3,Keys:[{Frame:0,Vector:[0,0,0,1],OutTan:[0,.6,0,.8]},{Frame:100,Vector:[0,0,.6,.8],InTan:[.6,0,0,.8]}]};
    for(const quaternion of [false,true]){
      const options={interval:[20,100],globalSequences:[100],fallback:[0,0,0,1],quaternion};
      const compiled=compileTrackSampler(track,options);
      for(let frame=0;frame<=220;frame+=.25)assert.deepEqual(compiled(frame),sampleTrack(track,frame,options));
    }
  }
});

test('pooled node matrices preserve arithmetic, flags, cycles and explicit subtree revisions',()=>{
  for(const model of [knight(),withFlags(knight())]){
    const nodes=allNodes(model),byId=new Map(nodes.map(n=>[n.ObjectId,n])),ids=nodes.map(n=>n.ObjectId),scratch={};
    const local=(node,frame)=>({t:new Vector3().fromArray(sampleNodeProperty(model,node,'Translation',frame,0)),r:new Quaternion().fromArray(sampleNodeProperty(model,node,'Rotation',frame,0)),s:new Vector3().fromArray(sampleNodeProperty(model,node,'Scaling',frame,0))});
    for(const frame of [0,200,100,200])sameMaps(composeNodeMatrices(model,ids,n=>local(n,frame),byId,scratch),composeNodeMatrices(model,ids,n=>local(n,frame),byId));
    let revision=0,calls=0;const fixed={version:()=>revision},sample=n=>{calls++;return local(n,200);};
    sameMaps(composeNodeMatrices(model,ids,sample,byId,fixed),composeNodeMatrices(model,ids,n=>local(n,200),byId));
    const count=calls;composeNodeMatrices(model,ids,sample,byId,fixed);assert.equal(calls,count);
    revision++;sameMaps(composeNodeMatrices(model,ids,sample,byId,fixed),composeNodeMatrices(model,ids,n=>local(n,200),byId));
    const parented=nodes.filter(n=>byId.has(n.Parent));if(parented.length){byId.get(parented[0].Parent).Parent=parented[0].ObjectId;
      sameMaps(composeNodeMatrices(model,ids,n=>local(n,200),byId,{}),composeNodeMatrices(model,ids,n=>local(n,200),byId));}
  }
});


test('matrix revisions resample only the edited subtree and retain ancestor entries',()=>{
 const model={Sequences:[{Interval:[0,10]}],Bones:[{ObjectId:0},{ObjectId:1,Parent:0},{ObjectId:2,Parent:0}]};
 const nodes=allNodes(model),byId=new Map(nodes.map(n=>[n.ObjectId,n])),revision=new Map(),calls=new Map(),translations=new Map(nodes.map(n=>[n.ObjectId,new Vector3()]));
 const scratch={version:n=>revision.get(n.ObjectId)||0},sample=n=>{calls.set(n.ObjectId,(calls.get(n.ObjectId)||0)+1);return {t:translations.get(n.ObjectId),r:new Quaternion(),s:new Vector3(1,1,1)};};
 const check=()=>sameMaps(composeNodeMatrices(model,[1,2],sample,byId,scratch),composeNodeMatrices(model,[1,2],n=>({t:translations.get(n.ObjectId),r:new Quaternion(),s:new Vector3(1,1,1)}),byId));
 check();translations.get(1).x=7;revision.set(1,1);check();assert.equal(calls.get(0),1);assert.equal(calls.get(1),2);assert.equal(calls.get(2),1);
 translations.get(0).y=3;for(const n of nodes)revision.set(n.ObjectId,(revision.get(n.ObjectId)||0)+1);check();
 assert.equal(calls.get(0),2);assert.equal(calls.get(1),3);assert.equal(calls.get(2),2);
});


test('pooled cyclic graphs keep traversal-dependent identity edges when requested roots change',()=>{
 const model={Bones:[{ObjectId:0,Parent:1},{ObjectId:1,Parent:0}]},byId=new Map(model.Bones.map(n=>[n.ObjectId,n])),scratch={version:()=>0};
 const local=n=>({t:new Vector3(n.ObjectId+1,1,0),r:new Quaternion(),s:new Vector3(1,1,1)});
 for(const ids of [[0],[1],[0,1],[1,0],[1]])sameMaps(composeNodeMatrices(model,ids,local,byId,scratch),composeNodeMatrices(model,ids,local,byId));
});
