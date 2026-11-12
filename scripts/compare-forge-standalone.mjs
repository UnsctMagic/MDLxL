import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

// Explicit main checkout + branch checkout. No production state or profile is used.
const [baseRoot,branchRoot=process.cwd(),output='out/contract-review/standalone']=process.argv.slice(2);
if(!baseRoot)throw Error('Usage: node scripts/compare-forge-standalone.mjs <main checkout> <branch checkout> <output>');
const roots=[baseRoot,branchRoot].map(p=>path.resolve(p)),out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
const apis=await Promise.all(roots.map(async root=>Object.assign({},...await Promise.all(['forge-primitives','forge-shape-editing','forge-molding','forge-detail-editing','forge-detail-magnet'].map(name=>import(pathToFileURL(path.join(root,'src',name+'.js'))))))));
const encode=value=>Buffer.from(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?{type:v.constructor.name,bytes:Buffer.from(v.buffer,v.byteOffset,v.byteLength).toString('base64')}:v));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const versions=roots.map(root=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
const options=(shape,complexity,thickness=0)=>({shape,complexity,width:100,height:80,depth:60,thickness,zUp:true});
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
function components(a,shape){
 const edges=new Map();for(const f of shape.faces)f.vertices.forEach((u,i)=>{const key=a.forgeEdgeKey(u,f.vertices[(i+1)%f.vertices.length]);if(!edges.has(key))edges.set(key,[]);edges.get(key).push(f);});
 const remaining=new Set(shape.faces),parts=[];
 while(remaining.size){const queue=[remaining.values().next().value],faces=[],keys=new Set();while(queue.length){const f=queue.pop();if(!remaining.delete(f))continue;faces.push(f);f.vertices.forEach((u,i)=>{const key=a.forgeEdgeKey(u,f.vertices[(i+1)%f.vertices.length]);keys.add(key);queue.push(...edges.get(key).filter(g=>remaining.has(g)));});}const border=[...keys].filter(k=>edges.get(k).length===1).length;parts.push({faces,border,closed:[...keys].every(k=>edges.get(k).length===2)});}
 return parts;
}
const seedFace=(api,s)=>[...s.faces].sort((a,b)=>api.forgeFaceNormal(s,b)[2]-api.forgeFaceNormal(s,a)[2]||b.triangles.length-a.triangles.length||a.id-b.id)[0];
const feature=(api,s)=>{const face=seedFace(api,s),frame=api.forgeCutFrame(s,face.id,false,[face.id]);let shape=api.cutForgeShape(s,frame,[.25],[face.id]);const cap=shape.faces.find(f=>f.id===face.id),first=shape.nextFaceId;shape=api.extrudeForgeFaces(shape,[cap.id],api.forgeFaceNormal(shape,cap).map(n=>n*5));return{shape,ids:[cap.id,...shape.faces.filter(f=>f.id>=first).map(f=>f.id)]};};
const operations=[
 ['Create',(a,s)=>s],
 ['Move',(a,s)=>a.transformForgeSelection(s,['shape'],'Shape',{translation:[3,5,-7]})],
 ['Rotate',(a,s)=>a.transformForgeSelection(s,['shape'],'Shape',{quaternion:[0,0,Math.sin(.2),Math.cos(.2)]})],
 ['Scale',(a,s)=>a.transformForgeSelection(s,['shape'],'Shape',{scale:[.8,1.2,.9]})],
 ['Extrude',(a,s)=>{const f=seedFace(a,s);return a.extrudeForgeFaces(s,[f.id],a.forgeFaceNormal(s,f).map(n=>n*5));}],
 ['Inset flat',(a,s)=>a.insetForgeFaces(s,[seedFace(a,s).id],.5)],
 ['Inset curved',(a,s)=>{const f=seedFace(a,s),n=a.forgeFaceNormal(s,f),other=s.faces.find(g=>g.id!==f.id&&dot(n,a.forgeFaceNormal(s,g))>.5&&dot(n,a.forgeFaceNormal(s,g))<.99999&&g.vertices.filter(id=>f.vertices.includes(id)).length>=2);return a.insetForgeFaces(s,other?[f.id,other.id]:[f.id],.5);}],
 ['Cut shape',(a,s)=>a.cutForgeShape(s,a.forgeCutFrame(s),[.33,.67])],
 ['Cut face',(a,s)=>{const f=seedFace(a,s);return a.cutForgeShape(s,a.forgeCutFrame(s,f.id,true,[f.id]),[.33,.67],[f.id]);}],
 ...['Shape','Faces','Edges','Vertices'].flatMap(mode=>[false,true].map(round=>[`Bevel ${mode} ${round?'Rounded':'Angled'}`,(a,s)=>{
  const edge=[...a.forgeShapeEdges(s)].find(([key,[u,v]])=>{const faces=s.faces.filter(f=>f.vertices.includes(u)&&f.vertices.includes(v));return faces.length===2&&dot(a.forgeFaceNormal(s,faces[0]),a.forgeFaceNormal(s,faces[1]))<.9999;})?.[0]||[...a.forgeShapeEdges(s).keys()][0];
  return a.bevelForgeShape(s,mode==='Shape'?['shape']:mode==='Faces'?[seedFace(a,s).id]:mode==='Vertices'?seedFace(a,s).vertices:[edge],mode,2,round);
 }])),
 ['Bevel negative',(a,s)=>a.bevelForgeShape(s,['shape'],'Shape',-2)],
 ...['Bend','Bulge','Taper','Twist'].map(tool=>[tool,(a,s)=>{const draft={shapes:[s],selection:{[s.id]:['shape']},mode:'Shape'},state={...a.forgeMoldState(draft,tool),amount:tool==='Bend'||tool==='Twist'?35:.25};return a.previewForgeMold(draft,a.prepareForgeMold(draft,state),state).shapes[0];}]),
 ['Blend',(a,s)=>{const f=seedFace(a,s),frame=a.forgeCutFrame(s,f.id,false,[f.id]),first=s.nextFaceId,next=a.cutForgeShape(s,frame,[.25,.5],[f.id]);return a.blendForgeFaces(next,next.faces.filter(g=>g.id===f.id||g.id>=first).map(g=>g.id));}],
 ['Detail copy preview',(a,s)=>{const {shape,ids}=feature(a,s);return a.forgeDetailPreview(shape,ids,{offset:[12,3,0]});}],
 ['Detail mirror preview',(a,s)=>{const {shape,ids}=feature(a,s);return a.forgeDetailPreview(shape,ids,{axis:0,plane:0});}],
 ['Detail copy attach',(a,s)=>{const {shape,ids}=feature(a,s),center=a.forgeSelectionCenter([shape],{[shape.id]:ids},'Faces');return a.repeatForgeDetail(shape,ids,{offset:[-2*center[0],0,0]});}],
 ['Detail mirror attach',(a,s)=>{const {shape,ids}=feature(a,s);return a.repeatForgeDetail(shape,ids,{axis:0,plane:0});}],
 ['Detail close',(a,s)=>{const {shape,ids}=feature(a,s);return a.closeForgeDetail(a.forgeDetailPreview(shape,ids));}],
 ['Detail magnet move',(a,s)=>{const {shape,ids}=feature(a,s),fitted=a.magnetizeForgeDetail(shape,a.forgeDetailPreview(shape,ids));return a.moveMagnetizedDetail(fitted.shape,fitted.surface,[3,2,1]);}],
 ['Detail magnet turn',(a,s)=>{const {shape,ids}=feature(a,s),fitted=a.magnetizeForgeDetail(shape,a.forgeDetailPreview(shape,ids));return a.turnForgeDetail(fitted.shape,fitted.shape.faces[0].id,fitted.surface);}],
 ['Detail magnet refit',(a,s)=>{const {shape,ids}=feature(a,s),fitted=a.magnetizeForgeDetail(shape,a.forgeDetailPreview(shape,ids));return a.refitMagnetizedDetail(fitted.shape,fitted.surface,true);}],
];
const rows=[],differences=[];
for(const name of apis[0].FORGE_SHAPES)for(const complexity of [1,2,3,4])for(const thickness of apis[0].FLAT_FORGE_SHAPES.includes(name)?[0,5]:[0]){
 const starts=apis.map(a=>a.createForgeShape(a.buildForgePrimitive(options(name,complexity,thickness))));
 const parts=components(apis[0],starts[0]),closedParts=parts.filter(p=>!p.border),extra=parts.length>1?closedParts.flatMap((part,i)=>[false,true].map(round=>[`Bevel closed component ${i+1} ${round?'Rounded':'Angled'}`,(a,s)=>a.bevelForgeShape({...s,faces:s.faces.filter(f=>part.faces.some(p=>p.id===f.id))},['shape'],'Shape',2,round)])):[];
 for(const [operation,run]of [...operations,...extra]){
  const results=apis.map((a,i)=>{try{const result=run(a,structuredClone(starts[i])),shape=result.shape||result,mesh=a.forgeShapeMesh(shape),bytes=encode({mesh,...(result.selection?{selection:result.selection}:{})});return{hash:hash(bytes),length:bytes.length,mesh};}catch(e){return{error:e.message,hash:hash(encode({error:e.message})),mesh:a.forgeShapeMesh(starts[i])};}});
  const same=results[0].hash===results[1].hash,key=[name,complexity,thickness,operation].join(' / ');
  const intended=!same&&parts.some(p=>p.border)&&operation.startsWith('Bevel')&&!operation.startsWith('Bevel closed')&&!results[1].error?'thin-sheet rim':!same&&operation==='Inset curved'&&results[0].error==='Inset needs faces on the same plane.'&&!results[1].error?'curved Inset':null;
  const row={key,name,complexity,thickness,operation,same,intended,components:parts.map(p=>({faces:p.faces.length,border:p.border,closed:p.closed})),main:{hash:results[0].hash,length:results[0].length,error:results[0].error},branch:{hash:results[1].hash,length:results[1].length,error:results[1].error}};rows.push(row);
  if(!same)differences.push({...row,before:results[0].mesh,after:results[1].mesh});
 }
 console.log(name+' complexity '+complexity+' thickness '+thickness+' compared');
}
const summary={versions,total:rows.length,identical:rows.filter(r=>r.same).length,intended:rows.filter(r=>r.intended).length,unexpected:rows.filter(r=>!r.same&&!r.intended).length};
fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify({summary,rows},null,2));
fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(roots.map(root=>({root,revision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hashes:Object.fromEntries(['src/forge-shape-editing.js','src/forge-molding.js','src/forge-detail-editing.js','src/forge-detail-magnet.js','src/forge-primitives.js','app/ForgeShapes.jsx'].map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]))})),null,2));
fs.writeFileSync(path.join(out,'differences.json'),JSON.stringify(differences,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
console.log(JSON.stringify(summary));if(summary.unexpected)process.exitCode=1;
