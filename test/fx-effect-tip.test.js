import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Quaternion,Vector3} from 'three';
import {openDocument} from '../src/editor-document.js';
import {findLook,makeLayer,newStack,partFrame} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
import {analyseEmitterSurface} from '../src/fx-emitter-surface.js';
import {deleteEmitterSite,withEmitterAim,withEmitterSiteCount} from '../src/fx-emitter-placement.js';

const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load=name=>openDocument(fs.readFileSync(fixturePath(name)),name+'.mdx').model;
const Z=new Vector3(0,0,1);
const image='Textures\\Zap1.blp';
const particle=(extra={},native={})=>({type:'Particles',kind:'native',label:'Discharge',image,
 nativeSpec:{texture:image,life:.5,rate:8,size:[.05,.2,.1],...native},...extra});
function setup(fixture,part,specs){
 const model=load(fixture),frame=partFrame(model.Geosets[part]);
 const stack=newStack(findLook('empty'),frame,'tip');
 stack.layers=specs.map((spec,i)=>makeLayer(spec,frame,'native',i+1));
 return {model,frame,stack,graph:compileAnimation(model,part,stack,{attachments:new Map()})};
}
const direction=node=>Z.clone().applyQuaternion(new Quaternion().fromArray(node.Rotation.Keys[0].Vector));
const nodeAt=(model,graph,layer,index=0)=>model.Nodes[graph.layers[layer].ids[index]];
const point=site=>new Vector3(...site.point);
const pivot=(model,node)=>{
 const parent=model.Nodes[node.Parent];
 const id=parent?._FxTag?.startsWith('tip/')?parent.Parent:node.Parent;
 return new Vector3().fromArray(model.PivotPoints[id]??[0,0,0]);
};

for(const [name,fixture,part,count] of [['straight strip','effect',5,1],['curved piece','effect',21,1],['many-region body','footman',0,2]]){
 test('gather tip shares surface attachments and extremities on a '+name,()=>{
  const {model,frame,graph}=setup(fixture,part,[particle({gather:'tip',aim:'tip'}),particle({gather:'tip',loop:1870},{burst:4,delay:.33})]);
  const shape=analyseEmitterSurface(model.Geosets[part]);
  const sites=graph.layers[1].sites;
  assert.equal(sites.length,count);
  assert.deepEqual(sites,graph.layers[2].sites);
  for(const [i,site] of sites.entries()){
   assert.ok(site.surface?.vertices?.length===3,'the tip keeps its triangle attachment');
   assert.equal(nodeAt(model,graph,2,i).Squirt,true);
   const emitter=nodeAt(model,graph,1,i),root=pivot(model,emitter),at=point(site);
   assert.ok(direction(emitter).dot(at.clone().sub(root).normalize())>0,'launch points away from the parent');
   if(name==='straight strip'){
    const {axis,center,length}=shape.components[0].frame;
    const signed=at.clone().sub(center).dot(axis)*Math.sign(center.clone().sub(root).dot(axis));
    assert.ok(signed>=length*.4,'site is in the last 10% at the far end');
    assert.ok(Math.abs(direction(emitter).dot(axis))>.999);
   }else if(name==='curved piece'){
    const farthest=Math.max(...shape.components.flatMap(component=>component.triangles.flatMap(t=>t.points.map(p=>p.distanceTo(root)))));
    assert.ok(at.distanceTo(root)>=farthest*.95,'site is near the farthest rim vertex');
   }
  }
  if(name==='many-region body'){
   assert.ok(frame.regions.length>8);
   const across=shape.span.y>=shape.span.x*.8?'y':'x';
   assert.ok((point(sites[0])[across]-shape.centre[across])*(point(sites[1])[across]-shape.centre[across])<0);
  }
 });
}

test('outward aim uses the surface normal and a ring edit replaces the starting Rotation',()=>{
 const part=5,{model,stack,graph}=setup('effect',part,[particle({aim:'outward',siteCount:3})]);
 const site=graph.layers[1].sites[0],emitter=model.Nodes[graph.layers[1].siteIds[site.key]];
 assert.ok(emitter.Rotation?.Keys?.length);
 const source=model.Geosets[site.surface.geoset];
 const [a,b,c]=site.surface.vertices.map(i=>new Vector3().fromArray(source.Vertices,i*3));
 const normal=b.sub(a).cross(c.sub(a)).normalize();
 assert.ok(Math.abs(direction(emitter).dot(normal))>.98);
 stack.layers=[withEmitterAim(stack.layers[0],site.key,[0,0,0,1])];
 const edited=compileAnimation(model,part,stack);
 assert.ok(direction(model.Nodes[edited.layers[1].siteIds[site.key]]).distanceTo(Z)<.0001);
});

test('the Emitters slider and Delete keep the gathered tip key stable',()=>{
 const part=5,{model,stack,graph}=setup('effect',part,[particle({gather:'tip',aim:'tip'})]);
 assert.ok(nodeAt(model,graph,1).Rotation?.Keys?.length,'the original site has the recipe aim');
 const key=graph.layers[1].sites[0].key;
 stack.layers=[withEmitterSiteCount(stack.layers[0],graph.layers[1],3)];
 const expanded=compileAnimation(model,part,stack);
 assert.equal(expanded.layers[1].ids.length,3);
 assert.deepEqual(expanded.layers[1].sites[0].point,graph.layers[1].sites[0].point);
 stack.layers=[deleteEmitterSite(stack.layers[0],key,expanded.layers[1].sites)];
 const removed=compileAnimation(model,part,stack);
 assert.equal(removed.layers[1].ids.length,2);
 assert.equal(removed.layers[1].siteIds[key],undefined);
});
