import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStarterDocument} from '../src/starter-model.js';
import {openDocument,createNode} from '../src/editor-document.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {stageAvailability} from '../src/optimizexl-availability.js';

const seq=(Name,a,b)=>({Name,Interval:new Uint32Array([a,b]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0});
const key=(Frame,Vector)=>({Frame,Vector:new Float32Array(Vector)});
const step=(...keys)=>({LineType:0,GlobalSeqId:null,Keys:keys.map(([f,v])=>key(f,v))});
// Four vertices average Bone_Root with a second bone; the rest stay on Bone_Root.
function fixture(scaling,{repeat=false,parentScaling=null}={}){
 const d=createStarterDocument();d.apply('Skin fixture',['Sequences','Bones','Helpers','PivotPoints','Geosets'],m=>{
  m.Sequences=[seq('Stand',100,300),seq('Attack',500,700)];
  const blend=createNode(m,'Bone');blend.Name='Blend';blend.Scaling=scaling;
  if(parentScaling){const base=createNode(m,'Helper');base.Name='Blend base';base.Scaling=parentScaling;blend.Parent=base.ObjectId;}
  const g=m.Geosets[0];g.Groups=[[0],repeat?[0,0,blend.ObjectId]:[0,blend.ObjectId]];
  g.VertexGroup=Uint8Array.from([0,0,0,0,1,1,1,1]);g.TotalGroupsCount=g.Groups.flat().length;
 });return openDocument(d.serialize('mdx'),'x.mdx');}
const flags=d=>sanityProposals(d.model).filter(f=>f.kind==='skinCollapse');

test('a blended bone scaled to zero while its partner stays is an inspection-only Warcraft III warning',async()=>{
 const d=fixture(step([100,[0,0,0]],[500,[2,2,2]]),{repeat:true}),[f]=flags(d);
 assert.ok(f);assert.equal(f.geoset,0);assert.deepEqual(f.groups,[1]);assert.equal(f.inspectionOnly,true);
 assert.equal(f.sequence,0);assert.equal(f.frame,100);
 assert.match(f.label,/Geoset 1: 4 vertices share a bone scaled to zero/);
 assert.match(f.detail,/in 1 animation Blend shrinks/);assert.match(f.detail,/repeats Bone_Root/);assert.match(f.detail,/Warcraft III/);
 const source=d.serialize('mdx');
 assert.throws(()=>runOptimizeStage(source,'sanity',{},f),/needs inspection/);
 // Inspection does not light the stage as an available repair.
 for await(const a of stageAvailability(source))if(a.stage==='sanity')assert.equal(a.hasChanges,sanityProposals(d.model).some(x=>!x.inspectionOnly));
});

test('a collapse inherited from a zero-scaled parent helper is found',()=>{
 const [f]=flags(fixture(null,{parentScaling:step([100,[2,2,2]],[500,[0,0,0]])}));
 assert.ok(f);assert.equal(f.sequence,1);assert.equal(f.frame,500);assert.match(f.detail,/Blend/);assert.doesNotMatch(f.detail,/repeats/);
});

test('ordinary scaling is not a warning: blinks, partial shrink and whole hidden parts',()=>{
 // One-axis flatten keeps a plane, like the classic eyelid blink.
 assert.deepEqual(flags(fixture(step([100,[1,1,0]],[200,[1,1,1]]))),[]);
 assert.deepEqual(flags(fixture(step([100,[.2,.2,.2]],[500,[1.5,1.5,1.5]]))),[]);
 // Hiding a whole part collapses every member of its group together.
 const d=createStarterDocument();d.apply('Hidden part',['Sequences','Bones','PivotPoints','Geosets'],m=>{
  m.Sequences=[seq('Stand',100,300)];const b=createNode(m,'Bone');b.Parent=0;m.Bones[0].Scaling=step([100,[0,0,0]]);
  m.Geosets[0].Groups=[[0,b.ObjectId]];m.Geosets[0].TotalGroupsCount=2;
 });
 assert.deepEqual(flags(openDocument(d.serialize('mdx'),'x.mdx')),[]);
});

// Private regression pair outside the repository: the user's in-game broken
// export and its rebuilt counterpart that works in Warcraft III.
const broken=process.env.MDLXL_SKIN_COLLAPSE_BROKEN,rebuilt=process.env.MDLXL_SKIN_COLLAPSE_REBUILT;
test('user regression pair: broken export is flagged, rebuilt model is clean',{skip:!(broken&&rebuilt)&&'set MDLXL_SKIN_COLLAPSE_BROKEN and MDLXL_SKIN_COLLAPSE_REBUILT'},()=>{
 const [f,...rest]=flags(openDocument(fs.readFileSync(broken),broken));
 assert.ok(f);assert.equal(rest.length,0);assert.equal(f.geoset,0);assert.match(f.detail,/repeats/);
 assert.deepEqual(flags(openDocument(fs.readFileSync(rebuilt),rebuilt)),[]);
});
