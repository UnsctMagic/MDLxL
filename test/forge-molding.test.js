import test from 'node:test';
import assert from 'node:assert/strict';
import {buildForgePrimitive} from '../src/forge-primitives.js';
import {createForgeShape,forgeShapeMesh,forgeShapeEdges,forgeFaceNormal,extrudeForgeFaces} from '../src/forge-shape-editing.js';
import {forgeMoldState,prepareForgeMold,previewForgeMold,bevelForgeShape} from '../src/forge-molding.js';

const block=()=>createForgeShape(buildForgePrimitive({shape:'Cube',width:240,height:80,depth:60,complexity:1,zUp:true}),{id:1});
const draft=()=>({shapes:[block()],selection:{1:['shape']},mode:'Shape'});
const result=(d,tool,amount,options={})=>{const state={...forgeMoldState(d,tool),...options,amount};return previewForgeMold(d,prepareForgeMold(d,state),state);};
function geometry(shape,closed=true){
 const mesh=forgeShapeMesh(shape).geosets[0];
 assert.ok([...mesh.Vertices,...mesh.Normals,...mesh.TVertices[0]].every(Number.isFinite));
 const edges=new Map();let volume=0;
 for(const face of shape.faces)for(const t of face.triangles){
   const [a,b,c]=t.vertices.map(i=>shape.vertices[i]),u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
   assert.ok(Math.hypot(...cross)>1e-6,'nondegenerate triangle');
   volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
   t.vertices.forEach((a,i)=>{const b=t.vertices[(i+1)%3],key=a<b?a+':'+b:b+':'+a;const e=edges.get(key)||[];e.push(a<b?1:-1);edges.set(key,e);});
 }
 if(closed)for(const [key,uses]of edges){assert.equal(uses.length,2,'closed edge '+key);assert.equal(uses[0]+uses[1],0,'opposite edge winding '+key);}
 assert.ok(volume>0,'outward triangles');return volume/6;
}
test('Bend, Bulge, Taper and Twist visibly shape a plain solid without manual cuts; source stays immutable',()=>{
 for(const [tool,amount]of [['Bend',50],['Bulge',.7],['Taper',-.5],['Twist',70]]){
 const d=draft(),snapshot=structuredClone(d),next=result(d,tool,amount);
 assert.deepEqual(d,snapshot);assert.notDeepEqual(next.shapes[0].vertices,d.shapes[0].vertices,tool);
 if(tool!=='Taper')assert.ok(next.shapes[0].vertices.length>d.shapes[0].vertices.length,tool+' support');
 geometry(next.shapes[0]);
 }
});
test('Bulge and Pinch change the middle, retain both ends, and taper retains its starting end',()=>{
 for(const amount of [.5,-.5]){
 const d=draft(),next=result(d,'Bulge',amount).shapes[0],ends=d.shapes[0].vertices;
 for(const p of ends)assert.ok(next.vertices.some(q=>q.every((n,i)=>Math.abs(n-p[i])<1e-7)));
 const mid=next.vertices.filter(p=>Math.abs(p[0])<1e-7);
 assert.ok(mid.length);assert.equal(Math.max(...mid.map(p=>p[2])),40*(1+amount));
 }
 const d=draft(),next=result(d,'Taper',-.5).shapes[0];
 for(const [i,p]of d.shapes[0].vertices.entries())if(p[0]===-120)assert.deepEqual(next.vertices[i],p);
});
test('Bend has adjustable center and range, Twist keeps its start, and zero preview retains exact topology',()=>{
 const d=draft();assert.equal(result(d,'Bend',0),d);
 const wide=result(d,'Bend',50),narrow=result(d,'Bend',50,{width:60,center:25});
 assert.notDeepEqual(wide.shapes[0].vertices,narrow.shapes[0].vertices);geometry(narrow.shapes[0]);
 const twisted=result(d,'Twist',70).shapes[0];
 for(const p of d.shapes[0].vertices.filter(p=>p[0]===-120))assert.ok(twisted.vertices.some(q=>q.every((n,i)=>Math.abs(n-p[i])<1e-7)));
});
test('Selected surface shaping keeps unrelated pieces and nonselected original points unchanged',()=>{
 const d=draft(),s=d.shapes[0],top=s.faces.find(f=>forgeFaceNormal(s,f)[2]>.99),ids=new Set(top.triangles.flatMap(t=>t.vertices));
 d.mode='Faces';d.selection={1:[top.id]};const other={...block(),id:2};d.shapes.push(other);
 const next=result(d,'Bulge',.5);
 assert.equal(next.shapes[1],other);for(const [i,p]of s.vertices.entries())if(!ids.has(i))assert.deepEqual(next.shapes[0].vertices[i],p);
 geometry(next.shapes[0]);
});
test('Bevel and rounded bevel make closed outward geometry for a block, one edge and adjacent edges',()=>{
 const s=block(),edges=[...forgeShapeEdges(s)],before=structuredClone(s),volume=geometry(s);
 const first=edges[0],adjacent=edges.find(([key,ids])=>key!==first[0]&&ids.some(i=>first[1].includes(i)));
 for(const [selection,mode]of [[['shape'],'Shape'],[[first[0]],'Edges'],[[first[0],adjacent[0]],'Edges'],[[s.faces[0].id],'Faces']])for(const round of [false,true]){
 const next=bevelForgeShape(s,selection,mode,4,round),nextVolume=geometry(next);
 assert.ok(nextVolume<volume&&nextVolume>volume*.7);assert.ok(next.faces.length>s.faces.length);
 }
 assert.deepEqual(s,before);
});
test('Repeated shaping reuses existing cross sections and preserves earlier cuts and texture corners',()=>{
 let d=result(draft(),'Bulge',.3);const count=d.shapes[0].vertices.length;
 d=result(d,'Twist',30);assert.equal(d.shapes[0].vertices.length,count);geometry(d.shapes[0]);
});
test('The five tools can be applied to the same piece without open seams',()=>{
 let d=draft();
 for(const [tool,amount]of [['Bend',30],['Bulge',.25],['Taper',-.2],['Twist',20],['Bevel',2]]){
   d=result(d,tool,amount);geometry(d.shapes[0]);
 }
});


test('Bevel works on every side of an extruded plane and preserves its open underside',()=>{
 const plane=createForgeShape(buildForgePrimitive({shape:'Plane',width:240,depth:60,complexity:1,zUp:true}),{id:1});
 const source=extrudeForgeFaces(plane,plane.faces.map(f=>f.id),[0,0,80]),before=structuredClone(source);
 const sides=source.faces.filter(f=>Math.abs(forgeFaceNormal(source,f)[2])<.01);
 assert.equal(sides.length,4);
 for(const selected of [...sides.map(f=>[f.id]),['shape']])for(const round of [false,true]){
   const next=bevelForgeShape(source,selected,selected[0]==='shape'?'Shape':'Faces',4,round);
   assert.ok(next.faces.length>source.faces.length);geometry(next,false);
   const edges=new Map();
   for(const f of next.faces)for(const t of f.triangles)t.vertices.forEach((a,i)=>{
     const b=t.vertices[(i+1)%3],key=a<b?a+':'+b:b+':'+a;
     if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);
   });
   const rim=[];
   for(const uses of edges.values()){
     assert.ok(uses.length<=2,'no overlapping faces');
     if(uses.length===2)assert.deepEqual(uses[0],[uses[1][1],uses[1][0]],'consistent edge winding');
     else {rim.push(uses[0]);for(const id of uses[0])assert.ok(Math.abs(next.vertices[id][2])<1e-8,'only the original underside stays open');}
   }
   assert.ok(rim.length>=4,'the open underside was not capped');
   const degree=new Map();for(const edge of rim)for(const id of edge)degree.set(id,(degree.get(id)||0)+1);
   assert.ok([...degree.values()].every(n=>n===2),'the rim remains continuous');
 }
 assert.deepEqual(source,before);
});
