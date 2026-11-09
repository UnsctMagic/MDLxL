import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {serializedNodes} from '../../src/node-id-order.js';
import {openDocument,recalculateExtents} from '../../src/editor-document.js';
import {createStarterDocument} from '../../src/starter-model.js';
import {loadAnatomyCase,challengeCase,analyticalRig} from './pose-anatomy-fixtures.mjs';

function normals(geo){
 const sums=new Float32Array(geo.Vertices.length),v=geo.Vertices,f=geo.Faces;
 for(let i=0;i<f.length;i+=3){const a=f[i]*3,b=f[i+1]*3,c=f[i+2]*3,u=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]],w=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]],n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];for(const at of[a,b,c])for(let k=0;k<3;k++)sums[at+k]+=n[k];}
 for(let i=0;i<sums.length;i+=3){const len=Math.hypot(sums[i],sums[i+1],sums[i+2])||1;for(let k=0;k<3;k++)sums[i+k]/=len;}return sums;
}
function expectationAfterSerialization(before,after,expected){
 const old=serializedNodes(before),next=serializedNodes(after);assert.equal(next.length,old.length,'Native serialization preserves every node');
 const mapping=new Map(old.map((node,index)=>[node.ObjectId,next[index].ObjectId]));
 for(let i=0;i<old.length;i++){assert.equal(next[i].Name,old[i].Name,'Serialized node order preserves identity without requiring names');assert.deepEqual(Array.from(next[i].PivotPoint),Array.from(old[i].PivotPoint),'Serialized node order preserves authored pivots');const parent=old[i].Parent==null||old[i].Parent<0?old[i].Parent:mapping.get(old[i].Parent);assert.equal(next[i].Parent,parent,'Serialized node order preserves hierarchy');}
 const mapped=id=>{assert.ok(mapping.has(id),'Expected native joint exists');return mapping.get(id);};
 const result=structuredClone(expected);result.limbs=result.limbs.map(l=>({...l,middle:mapped(l.middle),ends:l.ends.map(mapped),...(l.roots?{roots:l.roots.map(mapped)}:{})}));
 for(const field of ['heads','forbidden','forbiddenChains','forbiddenControlIds','central'])if(result[field])result[field]=result[field].map(mapped);
 if(result.requiredRoles)result.requiredRoles=Object.fromEntries(Object.entries(result.requiredRoles).map(([role,ids])=>[role,ids.map(mapped)]));
 if(result.appendages)result.appendages=result.appendages.map(a=>({...a,nodes:a.nodes.map(mapped),chainIds:a.chainIds.map(mapped)}));
 if(result.exactBody!=null)result.exactBody=mapped(result.exactBody);
 if(result.semanticRoles)result.semanticRoles=Object.fromEntries(Object.entries(result.semanticRoles).map(([id,roles])=>[mapped(Number(id)),roles]));
 if(result.headAlternatives)result.headAlternatives=Object.fromEntries(Object.entries(result.headAlternatives).map(([id,alternatives])=>[mapped(Number(id)),alternatives.map(mapped)]));
 return result;
}
export function prepareAnatomyUIFixture(spec,mode,directory){
 const input=spec.file?loadAnatomyCase(spec):analyticalRig(spec.options),originalExpected=spec.file?spec:input.expected;
 const challenged=challengeCase(input.model,originalExpected,mode),model=challenged.model;
 if(spec.file&&mode==='original')return {...input,expected:challenged.expected,derived:false};
 const doc=spec.file?openDocument(fs.readFileSync(input.file)):createStarterDocument();
 if(spec.file)doc.model=model;
 else doc.apply('Create anatomical acceptance fixture',['Nodes','Geosets','Sequences','GlobalSequences','Info'],m=>{
  const geoDefaults=m.Geosets[0];Object.assign(m,{Bones:model.Bones,Helpers:model.Helpers,Attachments:model.Attachments,PivotPoints:model.PivotPoints,GlobalSequences:[],Sequences:model.Sequences.map(s=>({...s,MoveSpeed:0,NonLooping:false,Rarity:0,MinimumExtent:Float32Array.from([0,0,0]),MaximumExtent:Float32Array.from([0,0,0]),BoundsRadius:0}))});
  m.Bones.forEach(n=>{n.GeosetId=null;n.GeosetAnimId=null;});
  m.Geosets=model.Geosets.map(g=>({...geoDefaults,...g,Normals:normals(g),TVertices:[new Float32Array(g.Vertices.length/3*2)],TotalGroupsCount:g.Groups.reduce((sum,ids)=>sum+ids.length,0),Anims:[]}));m.GeosetAnims=[];m.Info.Name=model.Info.Name;recalculateExtents(m);
 });
 const before=structuredClone(doc.model),bytes=doc.serialize('mdx'),reopened=openDocument(bytes).model,expected=expectationAfterSerialization(before,reopened,challenged.expected);
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,spec.key+'-'+mode+'.mdx');fs.writeFileSync(file,bytes);
 return {file,model:reopened,expected,derived:true,source:input.file,sourceHash:input.sha256};
}
