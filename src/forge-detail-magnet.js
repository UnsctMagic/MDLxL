import {Quaternion, Vector2, Vector3, ShapeUtils} from 'three';
import ClipperLib from 'clipper-lib';
import {forgeDetailBorders} from './forge-detail-editing.js';
import {forgeFaceNormal, forgeSelectionVertices} from './forge-shape-editing.js';
import {pointInside, signedArea} from './forge-geometry.js';
import {TRIANGLE_ICON_UV} from './forge-primitives.js';

const vector=p=>new Vector3(...p),mean=points=>points.reduce((sum,p)=>sum.add(vector(p)),new Vector3()).multiplyScalar(1/points.length);
const vertices=shape=>forgeSelectionVertices(shape,['shape'],'Shape');
const extent=shape=>{const points=vertices(shape).map(id=>shape.vertices[id]);return Math.max(1,...[0,1,2].map(a=>Math.max(...points.map(p=>p[a]))-Math.min(...points.map(p=>p[a]))));};
function clip(subject,paths,type){
  const worker=new ClipperLib.Clipper(ClipperLib.Clipper.ioStrictlySimple),result=[];
  worker.AddPaths(subject,ClipperLib.PolyType.ptSubject,true);worker.AddPaths(paths,ClipperLib.PolyType.ptClip,true);
  worker.Execute(type,result,ClipperLib.PolyFillType.pftNonZero,ClipperLib.PolyFillType.pftNonZero);return result;
}
function contact(shape){
  const loops=forgeDetailBorders(shape.faces),ids=[...new Set(loops.flat())];
  if(!ids.length)throw Error('Magnet needs a contact border.');
  const center=mean(ids.map(id=>shape.vertices[id])),normal=new Vector3();
  for(const loop of loops)for(let i=0;i<loop.length;i++)normal.add(vector(shape.vertices[loop[i]]).sub(center).cross(vector(shape.vertices[loop[(i+1)%loop.length]]).sub(center)));
  normal.normalize();const outward=mean(vertices(shape).map(id=>shape.vertices[id])).sub(center);
  if(normal.dot(outward)<0)normal.negate();
  if(!normal.lengthSq())return null;
  if(ids.some(id=>Math.abs(vector(shape.vertices[id]).sub(center).dot(normal))>extent(shape)*1e-6))throw Error('Magnet needs a flat contact border.');
  return {loops,center,normal};
}
function surfaces(host,excluded){
  const groups=[],epsilon=extent(host)*1e-7;
  for(const face of host.faces){
    if(excluded.includes(face.id))continue;
    const normal=vector(forgeFaceNormal(host,face)),origin=vector(host.vertices[face.vertices[0]]);
    if(face.vertices.some(id=>Math.abs(vector(host.vertices[id]).sub(origin).dot(normal))>epsilon))continue;
    let surface=groups.find(g=>vector(g.normal).dot(normal)>1-1e-8&&Math.abs(origin.clone().sub(vector(g.origin)).dot(normal))<epsilon);
    if(!surface){const axis=normal.toArray().map(Math.abs).indexOf(Math.min(...normal.toArray().map(Math.abs))),u=new Vector3().setComponent(axis,1).cross(normal).normalize(),v=normal.clone().cross(u);surface={normal:normal.toArray(),origin:origin.toArray(),u:u.toArray(),v:v.toArray(),faces:[],dimension:extent(host)};groups.push(surface);}
    surface.faces.push(face);
  }
  return groups.map(surface=>{
    const origin=vector(surface.origin),u=vector(surface.u),v=vector(surface.v),scale=1e8/surface.dimension;
    const paths=surface.faces.flatMap(face=>face.triangles.map(t=>t.vertices.map(id=>{const p=vector(host.vertices[id]).sub(origin);return {X:Math.round(p.dot(u)*scale),Y:Math.round(p.dot(v)*scale)};})));
    paths.forEach(path=>{if(!ClipperLib.Clipper.Orientation(path))path.reverse();});
    return {...surface,faces:surface.faces.map(f=>f.id),paths:clip(paths,[],ClipperLib.ClipType.ctUnion),scale};
  });
}
function fittingRegion(surface,footprint){
  const {scale}=surface,pattern=footprint.map(p=>({X:Math.round(-p[0]*scale),Y:Math.round(-p[1]*scale)}));
  if(!ClipperLib.Clipper.Orientation(pattern))pattern.reverse();
  const points=surface.paths.flat(),pad=2e8,minX=Math.min(...points.map(p=>p.X))-pad,maxX=Math.max(...points.map(p=>p.X))+pad,minY=Math.min(...points.map(p=>p.Y))-pad,maxY=Math.max(...points.map(p=>p.Y))+pad;
  const frame=[[{X:minX,Y:minY},{X:maxX,Y:minY},{X:maxX,Y:maxY},{X:minX,Y:maxY}]];
  // Two integer ticks preserve an exactly fitting strip or point. This remains
  // below the existing seam-weld tolerance; it never permits a visible overhang.
  const offset=new ClipperLib.ClipperOffset(),expanded=[];offset.AddPaths(surface.paths,ClipperLib.JoinType.jtMiter,ClipperLib.EndType.etClosedPolygon);offset.Execute(expanded,2);
  const outside=clip(frame,expanded,ClipperLib.ClipType.ctDifference),swept=ClipperLib.Clipper.MinkowskiSum(pattern,outside,true);
  // Clipper sweeps polygon boundaries. Fill each positive obstacle too, so a
  // small occupied opening cannot leave a false fitting pocket inside the sum.
  const filled=outside.filter(path=>ClipperLib.Clipper.Orientation(path)).flatMap(path=>path.map(at=>pattern.map(p=>({X:p.X+at.X,Y:p.Y+at.Y}))));
  const blocked=clip(swept,filled,ClipperLib.ClipType.ctUnion);
  return clip(frame,blocked,ClipperLib.ClipType.ctDifference).map(path=>path.map(p=>[p.X/scale,p.Y/scale]));
}
function closestFit(point,regions){
  if(regions.reduce((n,loop)=>n+(pointInside(point,loop)?Math.sign(signedArea(loop)):0),0)!==0)return point;
  let best,distance=Infinity;
  for(const loop of regions)for(let i=0;i<loop.length;i++){
    const a=loop[i],b=loop[(i+1)%loop.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1))),p=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(p[0]-point[0],p[1]-point[1]);
    if(d<distance){best=p;distance=d;}
  }
  return best;
}
function place(shape,surface,keepCenter=false){
  const base=contact(shape);if(!base)return null;
  const normal=vector(surface.normal),u=vector(surface.u),v=vector(surface.v),origin=vector(surface.origin),rotation=new Quaternion().setFromUnitVectors(base.normal,normal);
  const relative=shape.vertices.map(p=>vector(p).sub(base.center).applyQuaternion(rotation));
  const footprint=base.loops.map(loop=>loop.map(id=>[relative[id].dot(u),relative[id].dot(v)])).sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)))[0];
  const center=mean(vertices(shape).map(id=>shape.vertices[id])),anchor=keepCenter?center.clone().sub(center.clone().sub(base.center).applyQuaternion(rotation)):base.center;
  const regions=fittingRegion(surface,footprint),at=anchor.clone().sub(origin),fit=closestFit([at.dot(u),at.dot(v)],regions);
  if(!fit)return null;
  const target=origin.clone().addScaledVector(u,fit[0]).addScaledVector(v,fit[1]);
  const next={...shape,vertices:relative.map(p=>p.add(target).toArray()),faces:shape.faces.map(face=>({...face,triangles:face.triangles.map(t=>({...t,normals:t.normals&&Array.from({length:3},(_,i)=>vector(t.normals.slice(i*3,i*3+3)).applyQuaternion(rotation).toArray()).flat()}))}))};
  return {shape:next,surface:{...surface,regions},distance:target.distanceTo(base.center)};
}

export function magnetizeForgeDetail(host,shape,excluded=shape.faces.map(f=>f.id)){
  if(!contact(shape))throw Error('Magnet needs a flat contact border.');
  const choices=surfaces(host,excluded).map(surface=>place(shape,surface)).filter(Boolean).sort((a,b)=>a.distance-b.distance);
  if(!choices.length)throw Error('This detail does not fit on a surface of the shape.');
  return choices[0];
}

export function moveMagnetizedDetail(shape,surface,translation){
  const base=contact(shape),origin=vector(surface.origin),u=vector(surface.u),v=vector(surface.v),desired=base.center.clone().add(vector(translation)).sub(origin),fit=closestFit([desired.dot(u),desired.dot(v)],surface.regions);
  const delta=origin.addScaledVector(u,fit[0]).addScaledVector(v,fit[1]).sub(base.center);
  return {...shape,vertices:shape.vertices.map(p=>vector(p).add(delta).toArray())};
}

export function refitMagnetizedDetail(shape,surface,rotating=false){
  if(!rotating)return place(shape,surface);
  const base=contact(shape),normal=vector(surface.normal),epsilon=extent(shape)*1e-6;
  let side,alignment=base.normal.dot(normal);
  for(const face of shape.faces){
    const outward=vector(forgeFaceNormal(shape,face)),origin=vector(shape.vertices[face.vertices[0]]),score=-outward.dot(normal);
    if(score<=alignment+1e-7||face.vertices.some(id=>Math.abs(vector(shape.vertices[id]).sub(origin).dot(outward))>epsilon))continue;
    side=face;alignment=score;
  }
  return place(side?turnForgeDetail(shape,side.id).shape:shape,surface,true);
}

// Turning an open extrusion onto another side closes its old attachment and
// opens the chosen face. The copied solid keeps its size and authored faces.
export function turnForgeDetail(shape,faceId,surface){
  const base=contact(shape),face=shape.faces.find(f=>f.id===faceId);
  if(!base||!face)throw Error('Magnet needs a flat contact border.');
  const normal=vector(forgeFaceNormal(shape,face)),origin=vector(shape.vertices[face.vertices[0]]),epsilon=extent(shape)*1e-6;
  const planar=f=>vector(forgeFaceNormal(shape,f)).dot(normal)>1-1e-7&&f.vertices.every(id=>Math.abs(vector(shape.vertices[id]).sub(origin).dot(normal))<=epsilon);
  if(!planar(face))throw Error('Magnet needs a flat contact border.');
  const group=new Set([face.id]),queue=[face];
  while(queue.length){const current=queue.pop();for(const other of shape.faces)if(!group.has(other.id)&&planar(other)&&other.vertices.some((id,i)=>current.vertices.some((a,j)=>a===other.vertices[(i+1)%other.vertices.length]&&current.vertices[(j+1)%current.vertices.length]===id))){group.add(other.id);queue.push(other);}}
  const closed=closeForgeDetail(shape);
  const turned={...closed,faces:closed.faces.filter(f=>!group.has(f.id)),contactCap:shape.faces.filter(f=>group.has(f.id))};
  const fitted=surface?place(turned,surface):null;
  if(surface&&!fitted)throw Error('This detail does not fit on a surface of the shape.');
  return fitted||{shape:turned};
}

// A solid preview stays visually complete while Rotate changes which side is
// the attachment. Apply still uses the open patch to weld onto the host.
export function closeForgeDetail(shape){
  const base=contact(shape);let nextFaceId=shape.nextFaceId;
  const u=vector(shape.vertices[base.loops[0][0]]).sub(base.center).normalize(),v=base.normal.clone().negate().cross(u);
  const rings=base.loops.map(loop=>[...loop].reverse()).sort((a,b)=>{
    const area=loop=>Math.abs(signedArea(loop.map(id=>{const p=vector(shape.vertices[id]).sub(base.center);return [p.dot(u),p.dot(v)];})));return area(b)-area(a);
  });
  const flat=rings.map(loop=>loop.map(id=>{const p=vector(shape.vertices[id]).sub(base.center);return new Vector2(p.dot(u),p.dot(v));})),ids=rings.flat();
  const caps=shape.contactCap||[{id:nextFaceId++,vertices:rings[0],triangles:ShapeUtils.triangulateShape(flat[0],flat.slice(1)).map(indices=>({vertices:indices.map(i=>ids[i]),uv:[...TRIANGLE_ICON_UV]}))}];
  return {...shape,nextFaceId,faces:[...shape.faces,...caps.map(f=>({...f,triangles:f.triangles.map(t=>({...t,normals:undefined}))}))]};
}
