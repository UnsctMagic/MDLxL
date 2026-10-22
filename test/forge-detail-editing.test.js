import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { createForgeShape, forgeFaceNormal, forgeShapeMesh, cutForgeShape, extrudeForgeFaces, insetForgeFaces, forgeEdgeKey } from '../src/forge-shape-editing.js';
import { blendForgeFaces, repeatForgeDetail, forgeDetailPreview, forgeDetailBorders, forgeRepeatDefaults, forgeDetailFaces, snapForgeCut, snapForgeExtrusion } from '../src/forge-detail-editing.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { commitForge } from '../src/forge.js';
import {magnetizeForgeDetail,moveMagnetizedDetail,refitMagnetizedDetail,turnForgeDetail,closeForgeDetail} from '../src/forge-detail-magnet.js';
import {transformVertices} from '../src/editor-commands.js';

const cube = () => createForgeShape(buildForgePrimitive({shape:'Cube',width:120,height:120,depth:20,zUp:true}));
const top = shape => shape.faces.filter(f=>forgeFaceNormal(shape,f)[2]>.999);
const middle = (shape,face,axis) => face.vertices.reduce((n,id)=>n+shape.vertices[id][axis],0)/face.vertices.length;
function closed(shape) {
  const edges=new Map();
  for(const face of shape.faces)for(const t of face.triangles){
    const [a,b,c]=t.vertices.map(id=>shape.vertices[id]),u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-6,'noncollapsed triangle');
    for(let i=0;i<3;i++){const key=forgeEdgeKey(t.vertices[i],t.vertices[(i+1)%3]);if(!edges.has(key))edges.set(key,[]);edges.get(key).push([t.vertices[i],t.vertices[(i+1)%3]]);}
  }
  for(const [key,list] of edges){assert.equal(list.length,2,'closed edge '+key);assert.deepEqual(list[0],[...list[1]].reverse(),'consistent winding '+key);}
  assert.ok(forgeShapeMesh(shape).geosets[0].Vertices.every(Number.isFinite));
}
function feature() {
  let shape=cube();
  shape=cutForgeShape(shape,{direction:[1,0,0],min:-60,max:60},[.2],top(shape).map(f=>f.id));
  const cap=top(shape).find(f=>middle(shape,f,0)<-35).id,before=shape.nextFaceId;
  shape=extrudeForgeFaces(shape,[cap],[0,0,8]);
  return {shape,selected:[cap,...shape.faces.filter(f=>f.id>=before).map(f=>f.id)]};
}

test('Blend joins only selected adjoining planes and retains exact geometry, UV seams, and side faces',()=>{
  const initial=cube(),shape=cutForgeShape(initial,{direction:[1,0,0],min:-60,max:60},[.25,.5,.75],top(initial).map(f=>f.id)),before=structuredClone(shape),ids=top(shape).map(f=>f.id);
  const result=blendForgeFaces(shape,ids),sides=shape.faces.filter(f=>!ids.includes(f.id));
  assert.deepEqual(shape,before);assert.equal(top(result.shape).length,1);assert.equal(result.selection.length,1);
  assert.deepEqual(result.shape.faces.filter(f=>!result.selection.includes(f.id)),sides);
  assert.deepEqual(result.shape.vertices,shape.vertices);
  assert.deepEqual(result.shape.faces.find(f=>result.selection.includes(f.id)).triangles.flatMap(t=>t.uv).sort(),top(shape).flatMap(f=>f.triangles.flatMap(t=>t.uv)).sort());
  closed(result.shape);closed(extrudeForgeFaces(result.shape,result.selection,[0,0,7]));
  const partial=blendForgeFaces(shape,ids.slice(0,2));assert.equal(top(partial.shape).length,3);closed(partial.shape);
  assert.throws(()=>blendForgeFaces(initial,initial.faces.map(f=>f.id)),/adjoining/);
});

test('Mirror embeds the marked raised strip on the opposite side, preserving the original and outward winding',()=>{
  const {shape,selected}=feature(),before=structuredClone(shape),defaults=forgeRepeatDefaults(shape,selected);
  assert.equal(defaults.center[0],0);
  const result=repeatForgeDetail(shape,selected,{axis:0,plane:0});
  assert.deepEqual(shape,before);closed(shape);closed(result.shape);
  assert.equal(result.selection.length,selected.length);assert.equal(result.shape.id,shape.id);
  for(const id of selected)assert.deepEqual(result.shape.faces.find(f=>f.id===id),shape.faces.find(f=>f.id===id));
  const cap=result.shape.faces.find(f=>result.selection.includes(f.id)&&forgeFaceNormal(result.shape,f)[2]>.999);
  assert.ok(cap.vertices.every(id=>result.shape.vertices[id][0]>=36-1e-5));
  assert.equal(Math.max(...cap.vertices.map(id=>result.shape.vertices[id][2])),Math.max(...shape.vertices.map(p=>p[2])));
});

test('Copy keeps a multistep inset/extrusion detail at the same size and attaches it lower on the same panel',()=>{
  let shape=cube();const front=shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999),base=shape.nextFaceId;
  shape=cutForgeShape(shape,{direction:[0,0,1],min:-60,max:60},[.75],[front.id]);
  const panel=shape.faces.filter(f=>forgeFaceNormal(shape,f)[1]<-.999).sort((a,b)=>middle(shape,b,2)-middle(shape,a,2))[0];
  const ids=[panel.id],start=shape.nextFaceId;
  shape=insetForgeFaces(shape,ids,3);shape=extrudeForgeFaces(shape,ids,[0,-5,0]);
  const selected=[panel.id,...shape.faces.filter(f=>f.id>=start).map(f=>f.id)],before=structuredClone(shape);
  const result=repeatForgeDetail(shape,selected,{offset:[0,0,-50]});
  assert.deepEqual(shape,before);closed(result.shape);
  const original=shape.faces.find(f=>f.id===panel.id),copy=result.shape.faces.find(f=>f.id===result.selection[0]);
  assert.deepEqual(copy.triangles.map(t=>t.uv),original.triangles.map(t=>t.uv));
  assert.deepEqual(copy.vertices.map(id=>result.shape.vertices[id]),original.vertices.map(id=>shape.vertices[id].map((n,a)=>n+(a===2?-50:0))));
  assert.ok(base>0);
});

test('a detail spanning perpendicular panels mirrors with its complete folded attachment border',()=>{
  let shape=cube();shape=cutForgeShape(shape,{direction:[1,0,0],min:-60,max:60},[.2],top(shape).map(f=>f.id));
  const caps=[top(shape).find(f=>middle(shape,f,0)<-35).id,shape.faces.find(f=>forgeFaceNormal(shape,f)[0]<-.999).id],start=shape.nextFaceId;
  shape=extrudeForgeFaces(shape,caps,[-5,0,5]);
  const selected=[...caps,...shape.faces.filter(f=>f.id>=start).map(f=>f.id)];
  const result=repeatForgeDetail(shape,selected,{axis:0,plane:0});closed(shape);closed(result.shape);
  assert.equal(result.selection.length,selected.length);
});

test('marking the extrusion cap carries its walls and earlier stages, including later cuts',()=>{
  const {shape,selected}=feature(),cap=selected[0];
  assert.deepEqual(new Set(forgeDetailFaces(shape,[cap])),new Set(selected));
  const divided=cutForgeShape(shape,{direction:[0,1,0],min:-10,max:10},[.5],[cap]);
  const ids=forgeDetailFaces(divided,[cap]);
  assert.ok(ids.length>selected.length);
  closed(repeatForgeDetail(divided,ids,{axis:0,plane:0}).shape);
});

test('an incomplete cap selection, overlapping original, or floating copy cannot create a disconnected detail',()=>{
  const {shape,selected}=feature(),cap=selected[0];
  assert.throws(()=>repeatForgeDetail(shape,[cap],{axis:0,plane:0}),/border|sides/);
  assert.throws(()=>repeatForgeDetail(shape,selected),/Move the copy/);
  assert.throws(()=>repeatForgeDetail(shape,selected,{offset:[200,0,0]}),/border/);
});

test('a floating preview remains available with correct reflected winding and UVs before it can attach',()=>{
  const {shape,selected}=feature(),before=structuredClone(shape),preview=forgeDetailPreview(shape,selected,{axis:0,offset:[300,0,11]});
  assert.deepEqual(shape,before);assert.equal(preview.faces.length,selected.length);
  for(const face of preview.faces){const source=shape.faces.find(f=>f.id===face.id);assert.deepEqual(face.vertices,[...source.vertices].reverse());assert.deepEqual(face.triangles[0].uv,[...source.triangles[0].uv.slice(4,6),...source.triangles[0].uv.slice(2,4),...source.triangles[0].uv.slice(0,2)]);}
  for(const id of selected.flatMap(id=>shape.faces.find(f=>f.id===id).vertices))assert.deepEqual(preview.vertices[id],[-shape.vertices[id][0]+300,shape.vertices[id][1],shape.vertices[id][2]+11]);
  assert.throws(()=>repeatForgeDetail(shape,selected,{axis:0,offset:[300,0,11]}),/border/);
});

test('an extrusion group spanning the entire body keeps the explicitly marked surface available',()=>{
  const {shape}=feature(),cap=top(shape)[0].id;
  shape.details=[{caps:[cap],faces:shape.faces.map(f=>f.id)}];
  assert.deepEqual(forgeDetailFaces(shape,[cap]),[cap]);
});

test('a preview positioned through the normal transform owner attaches without applying placement twice',()=>{
  const {shape,selected}=feature(),ghost=forgeDetailPreview(shape,selected,{axis:0});
  const placed={...shape,vertices:ghost.vertices,faces:shape.faces.map(face=>ghost.faces.find(copy=>copy.id===face.id)||face)};
  const expected=repeatForgeDetail(shape,selected,{axis:0}),actual=repeatForgeDetail(shape,selected,{detail:placed});
  const corners=result=>result.shape.faces.filter(face=>result.selection.includes(face.id)).flatMap(face=>face.triangles.map(t=>t.vertices.map((id,i)=>JSON.stringify([...result.shape.vertices[id],...t.uv.slice(i*2,i*2+2)])).sort().join('|'))).sort();
  assert.deepEqual(corners(actual),corners(expected));closed(actual.shape);
});

test('Magnet retains an exactly fitting top strip and clamps its complete contact border at the surface edges',()=>{
  const {shape,selected}=feature(),before=structuredClone(shape),ghost=forgeDetailPreview(shape,selected,{axis:0}),magnet=magnetizeForgeDetail(shape,ghost);
  assert.ok(magnet.surface.normal[2]>.999);assert.deepEqual(shape,before);
  for(const delta of [[500,0,100],[-500,0,-100],[0,500,0]]){
    const moved=moveMagnetizedDetail(magnet.shape,magnet.surface,delta),border=forgeDetailBorders(moved.faces).flat().map(id=>moved.vertices[id]);
    assert.ok(border.every(p=>p[0]>=-36-1e-5&&p[0]<=60+1e-5&&Math.abs(p[1])<=10+1e-5&&Math.abs(p[2]-60)<1e-5));
  }
});

test('Magnet rotates a floating block onto its nearest side without resizing it, and prevents normal movement or overhang',()=>{
  const {shape,selected}=feature(),ghost=forgeDetailPreview(shape,selected,{axis:0,offset:[-15,-25,-35]}),magnet=magnetizeForgeDetail(shape,ghost);
  assert.ok(magnet.surface.normal[1]<-.999);
  const ids=forgeDetailBorders(ghost.faces).flat(),distance=s=>Math.hypot(...s.vertices[ids[0]].map((v,a)=>v-s.vertices[ids[1]][a]));
  assert.ok(Math.abs(distance(ghost)-distance(magnet.shape))<1e-7);
  const moved=moveMagnetizedDetail(magnet.shape,magnet.surface,[500,-1000,500]),border=forgeDetailBorders(moved.faces).flat().map(id=>moved.vertices[id]);
  assert.ok(border.every(p=>Math.abs(p[1]+10)<1e-5&&p[0]<=60+1e-5&&p[0]>=-60-1e-5&&p[2]<=60+1e-5&&p[2]>=-60-1e-5));
  const detail={...shape,vertices:magnet.shape.vertices,faces:shape.faces.map(f=>magnet.shape.faces.find(copy=>copy.id===f.id)||f)};
  closed(repeatForgeDetail(shape,selected,{detail}).shape);
});

test('Magnet also keeps the whole footprint clear of an occupied opening within a divided surface',()=>{
  let shape=cube(),front=shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999);
  shape=cutForgeShape(shape,{direction:[1,0,0],min:-60,max:60},[.4,.6],[front.id]);
  const middleFace=shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999&&Math.abs(middle(shape,f,0))<1);
  shape=cutForgeShape(shape,{direction:[0,0,1],min:-60,max:60},[.4,.6],[middleFace.id]);
  const panel=shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999&&Math.abs(middle(shape,f,0))<1&&Math.abs(middle(shape,f,2))<1),start=shape.nextFaceId;
  shape=extrudeForgeFaces(shape,[panel.id],[0,-5,0]);const selected=[panel.id,...shape.faces.filter(f=>f.id>=start).map(f=>f.id)];
  const magnet=magnetizeForgeDetail(shape,forgeDetailPreview(shape,selected,{offset:[35,-6,0]})),moved=moveMagnetizedDetail(magnet.shape,magnet.surface,[-35,0,0]);
  assert.ok(magnet.surface.normal[1]<-.999);const border=forgeDetailBorders(moved.faces).flat().map(id=>moved.vertices[id]);
  assert.ok(border.every(p=>p[0]>=12-1e-5)||border.every(p=>p[0]<=-12+1e-5)||border.every(p=>p[2]>=12-1e-5)||border.every(p=>p[2]<=-12+1e-5),JSON.stringify({border,regions:magnet.surface.regions}));
});

test('Magnet keeps ordinary rotation on the surface and stops a resize that cannot fit',()=>{
  const {shape,selected}=feature(),magnet=magnetizeForgeDetail(shape,forgeDetailPreview(shape,selected,{axis:0,offset:[-15,-25,-35]}));
  const transformed=(rotation,scale=[1,1,1])=>{const next=structuredClone(magnet.shape),mesh=forgeShapeMesh(next),g=mesh.geosets[0];g.Vertices=Float64Array.from(mesh.vertexIds.flatMap(id=>next.vertices[id]));transformVertices(g,mesh.vertexIds.map((id,i)=>i),[0,0,0],scale,rotation);mesh.vertexIds.forEach((id,i)=>{next.vertices[id]=Array.from(g.Vertices.slice(i*3,i*3+3));});return next;};
  const rotated=refitMagnetizedDetail(transformed([30,20,40]),magnet.surface);
  assert.ok(rotated);assert.ok(forgeDetailBorders(rotated.shape.faces).flat().every(id=>Math.abs(rotated.shape.vertices[id][1]+10)<1e-5));
  assert.equal(refitMagnetizedDetail(transformed([0,0,0],[10,10,10]),magnet.surface),null);
});

test('Turn block attaches each chosen side at unchanged size and preserves a closed solid on Apply',()=>{
  const {shape,selected}=feature(),magnet=magnetizeForgeDetail(shape,forgeDetailPreview(shape,selected,{axis:0,offset:[-15,-25,-35]})),before=structuredClone(magnet.shape);
  for(const face of magnet.shape.faces){
    const turned=turnForgeDetail(magnet.shape,face.id,magnet.surface),ids=turned.shape.faces.map(f=>f.id);
    assert.deepEqual(magnet.shape,before);
    const border=forgeDetailBorders(turned.shape.faces).flat();assert.ok(border.every(id=>Math.abs(turned.shape.vertices[id][1]+10)<1e-5));
    const distance=(s,a,b)=>Math.hypot(...s.vertices[a].map((v,i)=>v-s.vertices[b][i]));
    for(const a of face.vertices)for(const b of face.vertices)assert.ok(Math.abs(distance(turned.shape,a,b)-distance(magnet.shape,a,b))<1e-6);
    const detail={...turned.shape,faces:[...shape.faces.filter(f=>!selected.includes(f.id)),...turned.shape.faces]};
    closed(repeatForgeDetail(shape,ids,{detail,originalIds:selected}).shape);
    // Turn again, including the cap that used to be the open attachment.
    const next=turnForgeDetail(turned.shape,turned.shape.faces.at(-1).id,turned.surface),nextIds=next.shape.faces.map(f=>f.id);
    closed(repeatForgeDetail(shape,nextIds,{detail:{...next.shape,faces:[...shape.faces.filter(f=>!selected.includes(f.id)),...next.shape.faces]},originalIds:selected}).shape);
  }
});

test('standard rotations choose the facing contact side automatically and keep a complete solid preview',()=>{
  const {shape,selected}=feature(),magnet=magnetizeForgeDetail(shape,forgeDetailPreview(shape,selected,{axis:0,offset:[-15,-25,-35]})),before=structuredClone(magnet.shape);
  closed(closeForgeDetail(magnet.shape));
  for(const angle of [15,60,90,120,170,180,260,360]){
    const moved=structuredClone(magnet.shape),mesh=forgeShapeMesh(moved),g=mesh.geosets[0];g.Vertices=Float64Array.from(mesh.vertexIds.flatMap(id=>moved.vertices[id]));transformVertices(g,mesh.vertexIds.map((_,i)=>i),[0,0,0],[1,1,1],[angle,0,0]);mesh.vertexIds.forEach((id,i)=>moved.vertices[id]=Array.from(g.Vertices.slice(i*3,i*3+3)));
    const fitted=refitMagnetizedDetail(moved,magnet.surface,true);assert.ok(fitted,'rotation '+angle);assert.deepEqual(magnet.shape,before);
    const ghost=fitted.shape,ids=ghost.faces.map(f=>f.id),border=forgeDetailBorders(ghost.faces).flat();assert.ok(border.every(id=>Math.abs(ghost.vertices[id][1]+10)<1e-5));closed(closeForgeDetail(ghost));
    const all=[...new Set(ghost.faces.flatMap(f=>f.vertices))];assert.ok(all.every(id=>ghost.vertices[id][1]<=-10+1e-5),'block remains outside the host');
    for(const axis of [0,2])assert.ok(Math.abs(all.reduce((sum,id)=>sum+ghost.vertices[id][axis]-moved.vertices[id][axis],0)/all.length)<1e-6,'turn keeps its center along the surface');
    if(angle===90||angle===180)assert.notDeepEqual(ids,selected,'rotation selects another attaching side');
    const detail={...ghost,faces:[...shape.faces.filter(f=>!selected.includes(f.id)),...ghost.faces]};closed(repeatForgeDetail(shape,ids,{detail,originalIds:selected}).shape);
  }
});

test('cut snapping uses exact existing coordinates on other panels and ignores inactive historical vertices',()=>{
  const initial=cube(),shape=cutForgeShape(initial,{direction:[1,0,0],min:-60,max:60},[.23],top(initial).map(f=>f.id));
  const frame={direction:[1,0,0],min:-60,max:60};
  assert.equal(snapForgeCut(shape,frame,.235,1).fraction,.23);
  assert.equal(snapForgeCut(shape,frame,.3,1).snapped,false);
  shape.vertices.push([0,0,0]);assert.equal(snapForgeCut(shape,frame,.501,1).snapped,false);
});

test('extrusion snaps to existing levels and reuses the same extrusion depth on a perpendicular panel',()=>{
  const {shape}=feature(),other=top(shape).find(f=>middle(shape,f,0)>-30);
  assert.equal(snapForgeExtrusion(shape,[other.id],[0,0,1],7.8,.5).distance,8);
  const side=shape.faces.find(f=>forgeFaceNormal(shape,f)[1]<-.999);
  assert.equal(snapForgeExtrusion(shape,[side.id],[0,-1,0],8.2,.5).distance,8);
  assert.equal(snapForgeExtrusion(shape,[side.id],[0,-1,0],13,.5).snapped,false);
  assert.equal(snapForgeExtrusion(shape,[other.id],[0,0,1],0,.5).snapped,false);
});

test('repeated and blended geometry survives MDL/MDX saves and atomic model Undo/Redo',()=>{
  const {shape,selected}=feature(),mirrored=repeatForgeDetail(shape,selected,{axis:0,plane:0}).shape;
  const initial=cube(),divided=cutForgeShape(initial,{direction:[1,0,0],min:-60,max:60},[.25,.5,.75],top(initial).map(f=>f.id));
  const blended=blendForgeFaces(divided,top(divided).map(f=>f.id)).shape;
  for(const final of [mirrored,blended]){
    const doc=createDemoDocument(),before=structuredClone(doc.model),mesh=forgeShapeMesh(final);
    doc.apply('Forge detail',[],model=>commitForge(model,mesh,{texturePath:'detail.tga'}));
    const after=structuredClone(doc.model);
    for(const format of ['mdl','mdx']){
      const reopened=openDocument(doc.serialize(format));assert.equal(reopened.diagnostics.filter(d=>d.severity==='error').length,0);
      const saved=reopened.model.Geosets.at(-1);assert.equal(saved.Faces.length,mesh.geosets[0].Faces.length);assert.deepEqual(Array.from(saved.TVertices[0]),Array.from(mesh.geosets[0].TVertices[0]));closed(createForgeShape({geosets:[saved]}));
    }
    doc.undo();assert.deepEqual(doc.model,before);doc.redo();assert.deepEqual(doc.model,after);
  }
});
