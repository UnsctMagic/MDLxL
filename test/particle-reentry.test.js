import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDemoDocument, createNode } from '../src/editor-document.js';
import { effectNodes } from '../src/particle-recipes.js';

// Execute App's actual opening action with its dependencies; no duplicate selection logic.
const source = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const body = source.match(/const openParticles = id => \{([\s\S]*?)\n  \};/)[1];
function open(model, selectedNodeIds = [], id) {
  const dialogs = [], playing = [], selection = { 0: [1] }, singleRigNode = selectedNodeIds.length===1?model.Nodes?.[selectedNodeIds[0]]:null, selectedBone = model.Bones.includes(singleRigNode)?singleRigNode:null;
  const action = new Function('effectNodes', 'model', 'selectedNodeIds', 'selectedBone', 'singleRigNode', 'validSelection', 'setPlaying', 'setDialog', 'id', body);
  const before = structuredClone(model);
  action(effectNodes, model, selectedNodeIds, selectedBone, singleRigNode, selection, value => playing.push(value), value => dialogs.push(value), id);
  assert.deepEqual(model, before); assert.deepEqual(playing, [false]);
  const expected=[...(model.Bones||[]),...(model.Helpers||[]),...(model.Attachments||[])].find(n=>n===singleRigNode)?.ObjectId;assert.equal(dialogs[0].attachmentId, expected); assert.equal(dialogs[0].selection, selection);
  return dialogs[0].nodeId;
}

test('EMTR with no effect selected opens On model at the first ribbon ahead of particles', () => {
  const model = createDemoDocument().model;
  createNode(model, 'ParticleEmitter2');
  const ribbon = createNode(model, 'RibbonEmitter'); createNode(model, 'RibbonEmitter');
  assert.equal(open(model), ribbon.ObjectId);
  assert.equal(open(model, [model.Bones[0].ObjectId]), ribbon.ObjectId);
});

test('EMTR keeps an explicitly opened or selected effect, including zero ObjectId', () => {
  const model = createDemoDocument().model, particle = createNode(model, 'ParticleEmitter2');
  const ribbon = createNode(model, 'RibbonEmitter');
  assert.equal(open(model, [particle.ObjectId]), particle.ObjectId);
  assert.equal(open(model, [ribbon.ObjectId], particle.ObjectId), particle.ObjectId);
  const empty = { ParticleEmitters2: [{ ObjectId: 0 }], RibbonEmitters: [], Bones: [] };
  assert.equal(open(empty, [], 0), 0);
});

test('EMTR with only particles chooses the first effect; with no effects it opens Lab', () => {
  const model = createDemoDocument().model;
  assert.equal(open(model), undefined);
  const particle = createNode(model, 'ParticleEmitter2'); createNode(model, 'ParticleEmitter');
  assert.equal(open(model), particle.ObjectId);
  const editor = readFileSync(new URL('../app/ParticleEditor.jsx', import.meta.url), 'utf8');
  assert.match(editor, /useState\(Number\.isInteger\(selectedNodeId\)\?'On model':'Lab'\)/);
  assert.match(editor, /\[library,setLibrary\]=useState\(!Number\.isInteger\(selectedNodeId\)\)/);
});

test('EMTR forwards a selected bone, helper or attachment as the no-vertex placement target',()=>{
 const model=createDemoDocument().model;for(const type of ['Bone','Helper','Attachment']){const node=createNode(model,type);node.PivotPoint=new Float32Array([7,11,13]);open(model,[node.ObjectId]);}
 const light=createNode(model,'Light');open(model,[light.ObjectId]);
});
