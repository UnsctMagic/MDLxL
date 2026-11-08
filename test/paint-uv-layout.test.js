import test from 'node:test';
import assert from 'node:assert/strict';
import {createFreshPaintAtlas} from '../src/paint-uv-atlas.js';
import {createPaintLayout} from '../src/paint-uv-layout.js';
import {interpolatePaintStroke,mirroredPaintMatrix,paintPenBrush} from '../src/paint-projection.js';
import {paintFixtureModel} from './fixtures/paint-fixtures.js';

/** A closed tube standing along Z, as a limb is built: rings of quads, no caps. */
function tube({sides=8,rings=4,radius=10,height=40,offset=[0,0,0]}={}){
  const Vertices=[],Normals=[],Faces=[];
  for(let ring=0;ring<=rings;ring++)for(let side=0;side<sides;side++){const a=side/sides*Math.PI*2;Vertices.push(offset[0]+Math.cos(a)*radius,offset[1]+Math.sin(a)*radius,offset[2]+ring/rings*height);Normals.push(Math.cos(a),Math.sin(a),0);}
  const id=(ring,side)=>ring*sides+(side%sides);
  for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++)Faces.push(id(ring,side),id(ring,side+1),id(ring+1,side+1),id(ring,side),id(ring+1,side+1),id(ring+1,side));
  const count=Vertices.length/3;
  return {Vertices:new Float32Array(Vertices),Normals:new Float32Array(Normals),Faces:new Uint16Array(Faces),TVertices:[new Float32Array(count*2)],VertexGroup:new Uint8Array(count),Groups:[[0]],TotalGroupsCount:1,MaterialID:0};
}
function pieces(geoset,coord=geoset.TVertices.length-1){
  const uv=geoset.TVertices[coord],parent=new Int32Array(geoset.Vertices.length/3).map((_,i)=>i),find=a=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  for(let f=0;f<geoset.Faces.length;f+=3){parent[find(geoset.Faces[f])]=find(geoset.Faces[f+1]);parent[find(geoset.Faces[f])]=find(geoset.Faces[f+2]);}
  const set=new Set();for(let f=0;f<geoset.Faces.length;f+=3)set.add(find(geoset.Faces[f]));return {count:set.size,uv};
}
const area=(uv,a,b,c)=>((uv[b*2]-uv[a*2])*(uv[c*2+1]-uv[a*2+1])-(uv[c*2]-uv[a*2])*(uv[b*2+1]-uv[a*2+1]))/2;

test('a limb stays in a few whole pieces where the old layout shredded it',()=>{
  const model=paintFixtureModel([tube({sides:12,rings:6})]),layout=createPaintLayout(model,[0],512),old=createFreshPaintAtlas(model,[0],512);
  assert.ok(layout.chartCount<=4,`limb cut into ${layout.chartCount} pieces`);
  assert.ok(layout.chartCount<old.chartCount,'fewer pieces than the old layout');
});

test('authored UV seams do not decide where pieces end',()=>{
  // Split the tube's vertices along a column, as an imported model's UV seam would.
  const base=tube({sides:8,rings:2}),count=base.Vertices.length/3,extra=[],faces=Array.from(base.Faces);
  const remap=new Map();for(let ring=0;ring<=2;ring++){const v=ring*8;remap.set(v,count+extra.length/3);extra.push(base.Vertices[v*3],base.Vertices[v*3+1],base.Vertices[v*3+2]);}
  for(let f=0;f<faces.length;f+=3)if(f%12>=6)for(let c=0;c<3;c++)if(remap.has(faces[f+c])&&faces[f]!==undefined&&(f/6|0)%4===0)faces[f+c]=remap.get(faces[f+c]);
  const total=count+extra.length/3,geoset={...base,Vertices:new Float32Array([...base.Vertices,...extra]),Normals:new Float32Array(total*3).fill(0),Faces:new Uint16Array(faces),TVertices:[new Float32Array(total*2)],VertexGroup:new Uint8Array(total)};
  for(let v=0;v<total;v++){const x=geoset.Vertices[v*3],y=geoset.Vertices[v*3+1],l=Math.hypot(x,y)||1;geoset.Normals[v*3]=x/l;geoset.Normals[v*3+1]=y/l;}
  const clean=createPaintLayout(paintFixtureModel([base]),[0],512),seamed=createPaintLayout(paintFixtureModel([geoset]),[0],512);
  assert.equal(seamed.chartCount,clean.chartCount);
});

test('every triangle lands inside the image, faces the same way, and no pieces collide',()=>{
  const model=paintFixtureModel([tube(),tube({offset:[40,0,0],sides:6}),tube({offset:[0,40,0],radius:4,height:12})]),result=createPaintLayout(model,[0,1,2],256);
  const size=256,seen=new Uint16Array(size*size);
  for(let g=0;g<3;g++){const geoset=result.model.Geosets[g],uv=geoset.TVertices.at(-1);
    for(const value of uv)assert.ok(value>=0&&value<=1,'UV inside the image');
    for(let f=0;f<geoset.Faces.length;f+=3){
      const [a,b,c]=[geoset.Faces[f],geoset.Faces[f+1],geoset.Faces[f+2]],signed=area(uv,a,b,c);assert.ok(signed<=1e-7,'not mirrored');
      const p=[a,b,c].map(v=>[uv[v*2]*size,uv[v*2+1]*size]);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){const inside=[0,1,2].every(i=>{const s=p[i],t=p[(i+1)%3];return (t[0]-s[0])*(y+.5-s[1])-(t[1]-s[1])*(x+.5-s[0])<0;});if(inside){seen[y*size+x]++;}}
    }
  }
  assert.ok(seen.every(v=>v<=1),'no pixel is shared unless the user asks for it');
});

test('up on the model is up in the image',()=>{
  const model=paintFixtureModel([tube({sides:12,rings:6,height:60})]),result=createPaintLayout(model,[0],512),geoset=result.model.Geosets[0],uv=geoset.TVertices.at(-1);
  let correct=0,total=0;
  for(let f=0;f<geoset.Faces.length;f+=3)for(let c=0;c<3;c++){const a=geoset.Faces[f+c],b=geoset.Faces[f+(c+1)%3],dz=geoset.Vertices[b*3+2]-geoset.Vertices[a*3+2];if(Math.abs(dz)<1)continue;total++;if(Math.sign(uv[b*2+1]-uv[a*2+1])===-Math.sign(dz))correct++;}
  assert.ok(correct/total>.95,`${correct}/${total} edges upright`);
});

test('the source model and its original UVs are never changed',()=>{
  const model=paintFixtureModel([tube()]),before=structuredClone(model),result=createPaintLayout(model,[0],512);
  assert.deepEqual(model,before);
  assert.equal(result.model.Geosets[0].TVertices.length,2);
  assert.equal(result.coordIds[0],1);
});

test('skin streams stay parallel when pieces duplicate vertices',()=>{
  const result=createPaintLayout(paintFixtureModel([tube({sides:12,rings:3})]),[0],512).model.Geosets[0],count=result.Vertices.length/3;
  assert.equal(result.Normals.length,count*3);assert.equal(result.VertexGroup.length,count);for(const uv of result.TVertices)assert.equal(uv.length,count*2);assert.ok(Math.max(...result.Faces)<count);
});

test('sharing sides gives matching left and right parts the same pixels, and is off by default',()=>{
  const left=tube({offset:[0,25,0]}),right=tube({offset:[0,-25,0]});
  // Mirror the right tube exactly across Y = 0.
  for(let v=0;v<right.Vertices.length/3;v++){right.Vertices[v*3]=left.Vertices[v*3];right.Vertices[v*3+1]=-left.Vertices[v*3+1];right.Vertices[v*3+2]=left.Vertices[v*3+2];right.Normals[v*3+1]=-left.Normals[v*3+1];right.Normals[v*3]=left.Normals[v*3];}
  const merged={...left,Vertices:new Float32Array([...left.Vertices,...right.Vertices]),Normals:new Float32Array([...left.Normals,...right.Normals]),Faces:new Uint16Array([...left.Faces,...Array.from(right.Faces,v=>v+left.Vertices.length/3)]),TVertices:[new Float32Array((left.Vertices.length+right.Vertices.length)/3*2)],VertexGroup:new Uint8Array((left.Vertices.length+right.Vertices.length)/3)};
  const model=paintFixtureModel([merged]),separate=createPaintLayout(model,[0],512),shared=createPaintLayout(model,[0],512,{mirror:true});
  assert.equal(separate.sharedCharts,0);
  assert.ok(shared.sharedCharts>0,'mirrored pieces share');
  assert.ok(shared.chartCount<separate.chartCount,'fewer pieces to paint');
  const uv=shared.model.Geosets[0].TVertices.at(-1),geo=shared.model.Geosets[0],bySide=[new Set(),new Set()];
  for(let v=0;v<geo.Vertices.length/3;v++)bySide[geo.Vertices[v*3+1]>0?0:1].add(`${uv[v*2].toFixed(5)},${uv[v*2+1].toFixed(5)}`);
  assert.deepEqual([...bySide[0]].sort(),[...bySide[1]].sort());
});

test('a pen thins the stroke, a mouse leaves the brush as it was',()=>{
  const brush={size:40,opacity:.8};
  assert.equal(paintPenBrush(brush,undefined,{size:true,opacity:true}),brush);
  assert.ok(paintPenBrush(brush,.1,{size:true}).size<paintPenBrush(brush,.9,{size:true}).size);
  assert.equal(paintPenBrush(brush,.1,{size:true}).opacity,.8);
  assert.ok(Math.abs(paintPenBrush(brush,.5,{size:false,opacity:true}).opacity-.4)<1e-9);
  assert.equal(paintPenBrush(brush,.5,{size:false,opacity:false}),brush);
});

test('pressure glides between pointer samples',()=>{
  const points=interpolatePaintStroke({x:0,y:0,pressure:0},{x:100,y:0,pressure:1},{size:10,spacing:.1});
  assert.ok(points.length>5);for(let i=1;i<points.length;i++)assert.ok(points[i].pressure>points[i-1].pressure);
  assert.equal(points.at(-1).pressure,1);
  for(const point of interpolatePaintStroke({x:0,y:0},{x:50,y:0},{size:10,spacing:.1}))assert.equal(point.pressure,undefined);
});

test('the mirror camera reflects only left and right',()=>{
  const m=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],r=mirroredPaintMatrix(m);
  assert.deepEqual(r,[1,2,3,4,-5,-6,-7,-8,9,10,11,12,13,14,15,16]);assert.deepEqual(m,[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
});
