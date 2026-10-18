import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { createForgeShape, forgeShapeMesh, forgeFaceNormal, forgeCutFrame, cutForgeShape, extrudeForgeFaces } from '../src/forge-shape-editing.js';
const make = shape => createForgeShape(buildForgePrimitive({ shape, width: 160, height: 70, depth: 20, zUp: true, complexity: 1 }));
const top = shape => shape.faces.filter(face => forgeFaceNormal(shape, face)[2] > .999);
function check(shape, closed) {
  const mesh = forgeShapeMesh(shape), edges = new Map();
  for (const face of shape.faces) for (const t of face.triangles) {
    const [a,b,c] = t.vertices.map(id => shape.vertices[id]), u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
    assert.ok(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-6);
    for(let i=0;i<3;i++){const key=[t.vertices[i],t.vertices[(i+1)%3]].sort((a,b)=>a-b).join(':');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(n=>closed?n===2:n<=2), 'shared triangle edges remain connected');
  assert.ok(mesh.geosets[0].Vertices.every(Number.isFinite));
}
test('equal sections cut a solid wall without changing its bounds, UV seams or source',()=>{
  const source=make('Cube'),before=structuredClone(source),frame=forgeCutFrame(source,top(source)[0].id);
  const shape=cutForgeShape(source,frame,[.25,.5,.75]);
  assert.deepEqual(source,before); assert.equal(top(shape).length,4);check(shape,true);
  for(let axis=0;axis<3;axis++)assert.deepEqual([Math.min(...shape.vertices.map(p=>p[axis])),Math.max(...shape.vertices.map(p=>p[axis]))],[Math.min(...source.vertices.map(p=>p[axis])),Math.max(...source.vertices.map(p=>p[axis]))]);
  const uv=source.faces.flatMap(f=>f.triangles.flatMap(t=>t.uv)),min=Math.min(...uv),max=Math.max(...uv);
  for(const f of shape.faces)for(const t of f.triangles)assert.ok(t.uv.every(n=>n>=min-1e-6&&n<=max+1e-6));
  const raised=extrudeForgeFaces(shape,top(shape).filter((_,i)=>i%2===0).map(f=>f.id),[0,0,25]);check(raised,true);
});
test('manual cuts and turned equal cuts also divide a flat plane',()=>{
  const source=make('Plane'), frame=forgeCutFrame(source);
  const shape=cutForgeShape(source,frame,[.17,.64]);assert.equal(shape.faces.length,3);check(shape,false);
  const turned=cutForgeShape(shape,forgeCutFrame(shape,undefined,true),[.5]);check(turned,false);
  assert.ok(turned.faces.length>shape.faces.length); assert.ok(turned.vertices.every(p=>Math.abs(p[2])<1e-6));
  assert.equal(cutForgeShape(source,frame,[]),source);
  assert.equal(cutForgeShape(source,frame,[0,1]),source);
});
test('several cut planes preserve connected curved starter surfaces',()=>{
  for(const name of ['Cylinder','Cone']) {const source=make(name),shape=cutForgeShape(source,forgeCutFrame(source),[.2,.4,.6,.8]);check(shape,true);}
});

test('face cuts divide only the selected top and keep neighboring sides connected for extrusion',()=>{
  const source=make('Cube'), before=structuredClone(source), selected=[top(source)[0].id];
  for(const fractions of [[.25,.5,.75],[.17,.64]]) {
    const shape=cutForgeShape(source,forgeCutFrame(source,selected[0],false,selected),fractions,selected);
    assert.deepEqual(source,before);assert.equal(top(shape).length,fractions.length+1);check(shape,true);
    assert.deepEqual(shape.faces.filter(f=>forgeFaceNormal(shape,f)[2]<-.999),source.faces.filter(f=>forgeFaceNormal(source,f)[2]<-.999));
    for(const face of source.faces.filter(f=>!selected.includes(f.id))) {
      const matching=shape.faces.filter(f=>forgeFaceNormal(shape,f).every((n,i)=>Math.abs(n-forgeFaceNormal(source,face)[i])<1e-6));
      assert.equal(matching.length,1);assert.equal(matching[0].id,face.id);
      // Adjacent triangles retain their original texture interpolation at every new corner.
      for(const triangle of matching[0].triangles)for(let k=0;k<3;k++) {
        const p=shape.vertices[triangle.vertices[k]];
        assert.ok(face.triangles.some(original=>{
          const [a,b,c]=original.vertices.map(id=>source.vertices[id]),u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),w=p.map((n,i)=>n-a[i]);
          const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),d=uu*vv-uv*uv;
          const t=(dot(w,u)*vv-dot(w,v)*uv)/d,r=(dot(w,v)*uu-dot(w,u)*uv)/d;
          return t>=-1e-6&&r>=-1e-6&&t+r<=1+1e-6&&[0,1].every(i=>Math.abs(triangle.uv[k*2+i]-(original.uv[i]*(1-t-r)+original.uv[2+i]*t+original.uv[4+i]*r))<1e-6);
        }));
      }
    }
    const raised=extrudeForgeFaces(shape,top(shape).filter((_,i)=>i%2===0).map(f=>f.id),[0,0,25]);check(raised,true);
  }
});
test('a later face cut uses that section bounds, and multiple selected sides remain connected',()=>{
  const source=make('Cube'), divided=cutForgeShape(source,forgeCutFrame(source),[.25,.5,.75]);
  const face=top(divided)[1],selected=[face.id],frame=forgeCutFrame(divided,face.id,false,selected);
  assert.ok(frame.max-frame.min<forgeCutFrame(source).max-forgeCutFrame(source).min);
  const recut=cutForgeShape(divided,frame,[.5],selected);assert.equal(recut.faces.length,divided.faces.length+1);check(recut,true);
  for(const turned of [false,true]) {
    const selected=source.faces.filter(f=>forgeFaceNormal(source,f)[2]>.999||forgeFaceNormal(source,f)[1]<-.999).map(f=>f.id);
    const shape=cutForgeShape(source,forgeCutFrame(source,selected[0],turned,selected),[.2,.4,.6,.8],selected);check(shape,true);
  }
});
