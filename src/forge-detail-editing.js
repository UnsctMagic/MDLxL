import { cutForgeShape, forgeEdgeKey, forgeFaceNormal, forgeSelectionVertices } from './forge-shape-editing.js';

import { add, sub, scale as mul, dot, cross, unit } from './vec.js';
const edges = face => face.vertices.map((a, i) => [a, face.vertices[(i + 1) % face.vertices.length]]);
const faceVertices = faces => [...new Set(faces.flatMap(f => f.triangles.flatMap(t => t.vertices)))];
const sizeOf = shape => Math.max(1, ...[0,1,2].map(a => {
  const values = forgeSelectionVertices(shape, ['shape'], 'Shape').map(id => shape.vertices[id][a]);
  return Math.max(...values) - Math.min(...values);
}));

function adjacency(faces) {
  const map = new Map();
  for (const face of faces) for (const [a, b] of edges(face)) {
    const key = forgeEdgeKey(a, b);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ face, a, b });
  }
  return map;
}

function outlines(faces) {
  const border = [...adjacency(faces).values()].filter(list => list.length === 1).map(([edge]) => [edge.a, edge.b]);
  const remaining = new Map(border.map(([a, b]) => [a, b])), loops = [];
  if (remaining.size !== border.length) throw Error('Select a detail with a continuous border.');
  while (remaining.size) {
    const start = remaining.keys().next().value, loop = [start];
    do {
      const next = remaining.get(loop.at(-1));
      if (next === undefined) throw Error('Select a detail with a continuous border.');
      remaining.delete(loop.at(-1)); loop.push(next);
    } while (loop.at(-1) !== start && loop.length <= border.length + 1);
    if (loop.at(-1) !== start) throw Error('Select a detail with a continuous border.');
    loops.push(loop.slice(0, -1));
  }
  return loops;
}

export { outlines as forgeDetailBorders };

// Keep the authored triangles and their UV seams. Only the selected coplanar
// face boundaries disappear; perpendicular neighbors remain separate planes.
export function blendForgeFaces(source, selected) {
  const wanted = new Set(selected), byEdge = adjacency(source.faces), remaining = new Set(selected), result = [], selection = [], replacements = new Map();
  const epsilon = sizeOf(source) * 1e-7;
  let merged = false;
  for (const seed of source.faces) {
    if (!remaining.has(seed.id)) continue;
    const normal = forgeFaceNormal(source, seed), origin = source.vertices[seed.vertices[0]], queue = [seed], group = [];
    const planar = face => dot(normal, forgeFaceNormal(source, face)) > 1-1e-7 && faceVertices([face]).every(id => Math.abs(dot(sub(source.vertices[id], origin), normal)) <= epsilon);
    if (!planar(seed)) throw Error('Blend needs flat faces on the same plane.');
    while (queue.length) {
      const face = queue.pop();
      if (!remaining.has(face.id) || !planar(face)) continue;
      remaining.delete(face.id); group.push(face);
      for (const [a,b] of edges(face)) for (const neighbor of byEdge.get(forgeEdgeKey(a,b)) || []) if (remaining.has(neighbor.face.id)) queue.push(neighbor.face);
    }
    const loops = outlines(group);
    if (loops.length !== 1) throw Error('Blend needs connected faces without a hole.');
    result.push({ ...seed, vertices: loops[0], triangles: group.flatMap(f => f.triangles) }); selection.push(seed.id);
    group.forEach(face => replacements.set(face.id, seed.id));
    merged ||= group.length > 1;
  }
  if (!merged) throw Error('Select adjoining faces on the same plane to blend.');
  const remap = ids => [...new Set(ids.map(id => replacements.get(id) ?? id))];
  return { shape: { ...source, committed: false, faces: [...source.faces.filter(f => !wanted.has(f.id)), ...result], ...(source.details && {details:source.details.map(detail=>({caps:remap(detail.caps),faces:remap(detail.faces)}))}) }, selection };
}

export function forgeRepeatDefaults(shape, selected) {
  if (!selected.length) throw Error('Mark a detail on one shape to copy or mirror.');
  const faces = shape.faces.filter(f => !selected.includes(f.id)), points = faceVertices(faces).map(id => shape.vertices[id]);
  if (!points.length) throw Error('Select the detail, leaving the rest of the shape unselected.');
  const center = [0,1,2].map(a => (Math.min(...points.map(p => p[a])) + Math.max(...points.map(p => p[a]))) / 2);
  const detail = forgeSelectionVertices(shape, selected, 'Faces').map(id => shape.vertices[id]);
  const distances = center.map((v,a) => Math.abs(detail.reduce((n,p) => n+p[a],0)/detail.length-v));
  return { center, axis: distances.indexOf(Math.max(...distances)) };
}

// A marked extrusion cap carries its walls and earlier inset/extrusion stages.
// Explicitly marked additional faces are retained in the same detail.
export function forgeDetailFaces(shape, selected) {
  const ids = new Set(selected);
  for (const detail of shape.details || []) if (detail.caps.some(id => ids.has(id))) for (const id of detail.faces) ids.add(id);
  const expanded = shape.faces.filter(f => ids.has(f.id)).map(f => f.id);
  // A starter made by extruding a plane records the entire body. Marking its
  // top must still mean that top, rather than silently selecting the whole body.
  return expanded.length === shape.faces.length ? shape.faces.filter(f => selected.includes(f.id)).map(f => f.id) : expanded;
}

// The on-object preview exists independently of whether its border currently
// fits the host. Moving through an invalid position must never hide the copy.
export function forgeDetailPreview(source, selected, {axis = null, plane = 0, offset = [0,0,0]} = {}) {
  if (![null,0,1,2].includes(axis) || !Number.isFinite(plane) || offset.length!==3 || offset.some(v=>!Number.isFinite(v))) throw Error('Use finite copy coordinates.');
  const faces = structuredClone(source.faces.filter(f => selected.includes(f.id)));
  if (!faces.length) throw Error('Mark a detail on one shape to copy or mirror.');
  const vertices = source.vertices.map(p => p.map((v,a) => (a===axis ? 2*plane-v : v)+offset[a]));
  if (axis!==null) for (const face of faces) {
    face.vertices.reverse();
    for (const t of face.triangles) {
      t.vertices.reverse(); t.uv=[...t.uv.slice(4,6),...t.uv.slice(2,4),...t.uv.slice(0,2)];
      if (t.normals) { const n=t.normals.map((v,i)=>i%3===axis?-v:v); t.normals=[...n.slice(6,9),...n.slice(3,6),...n.slice(0,3)]; }
    }
  }
  return {...source,id:'repeat-preview',vertices,faces};
}

// Split only existing edges, interpolating each triangle's own UV/normal seam.
// This is also used for the copied patch so both sides share every seam point.
function splitEdges(shape, points, epsilon) {
  const between = (a,b) => {
    const start = shape.vertices[a], edge = sub(shape.vertices[b],start), length2 = dot(edge,edge);
    if (length2 <= epsilon*epsilon) return [];
    return points.filter(id => id !== a && id !== b).map(id => ({id,t:dot(sub(shape.vertices[id],start),edge)/length2}))
      .filter(({id,t}) => t > epsilon/Math.sqrt(length2) && t < 1-epsilon/Math.sqrt(length2) && Math.hypot(...sub(shape.vertices[id],add(start,mul(edge,t)))) <= epsilon)
      .sort((a,b) => a.t-b.t);
  };
  return { ...shape, faces: shape.faces.map(face => {
    const outline = edges(face).flatMap(([a,b]) => [a,...between(a,b).map(p=>p.id)]);
    let changed = outline.length !== face.vertices.length;
    const triangles = face.triangles.flatMap(triangle => {
      const corners = triangle.vertices.map((id,i) => ({id,uv:triangle.uv.slice(i*2,i*2+2),normal:triangle.normals?.slice(i*3,i*3+3)})), pieces = [corners];
      for (let i=0;i<3;i++) {
        const a=corners[i],b=corners[(i+1)%3]; let start=a.id;
        for (const {id,t} of between(a.id,b.id)) {
          const point={id,uv:a.uv.map((v,k)=>v+(b.uv[k]-v)*t),normal:a.normal&&b.normal?unit(a.normal.map((v,k)=>v+(b.normal[k]-v)*t)):undefined};
          const index=pieces.findIndex(p=>p.some((v,k)=>v.id===start&&p[(k+1)%3].id===b.id)),piece=pieces[index],corner=piece.findIndex(p=>p.id===start);
          const [first,last,opposite]=[0,1,2].map(k=>piece[(corner+k)%3]);
          pieces.splice(index,1,[first,point,opposite],[point,last,opposite]);start=id;changed=true;
        }
      }
      return pieces.map(p=>({...triangle,vertices:p.map(v=>v.id),uv:p.flatMap(v=>v.uv),normals:p.every(v=>v.normal)?p.flatMap(v=>v.normal):undefined}));
    });
    return changed ? {...face,vertices:outline,triangles} : face;
  }) };
}

// Whether a segment overlaps the interior or border of one of a face's triangles.
function overlaps(shape,face,a,b,normal,epsilon) {
  return face.triangles.some(triangle => {
    let lo=0,hi=1;
    const vertices=triangle.vertices.map(id=>shape.vertices[id]);
    for(let i=0;i<3;i++) {
      const start=vertices[i],edge=sub(vertices[(i+1)%3],start),length=Math.hypot(...edge);
      const da=dot(cross(edge,sub(a,start)),normal)/length,db=dot(cross(edge,sub(b,start)),normal)/length;
      if(da < -epsilon && db < -epsilon)return false;
      if(da < -epsilon)lo=Math.max(lo,da/(da-db));
      if(db < -epsilon)hi=Math.min(hi,da/(da-db));
    }
    return hi-lo > epsilon/Math.max(epsilon,Math.hypot(...sub(b,a)));
  });
}

// A copied detail replaces the surface enclosed by its border. Cutting and
// flood filling the host surface works across folded panels as well as a flat
// face, and avoids overlapping caps or a floating duplicate above the shape.
export function repeatForgeDetail(source, selected, { axis = null, plane = 0, offset = [0,0,0], detail = source, originalIds = selected } = {}) {
  if (![null,0,1,2].includes(axis) || !Number.isFinite(plane) || offset.length!==3 || offset.some(v=>!Number.isFinite(v))) throw Error('Use finite copy coordinates.');
  const originals=detail.faces.filter(f=>selected.includes(f.id));
  if (!originals.length || originals.length===detail.faces.length) throw Error('Select the detail, leaving the rest of the shape unselected.');
  const border=outlines(originals).flatMap(loop=>loop.map((a,i)=>[a,loop[(i+1)%loop.length]]));
  if (!border.length) throw Error('Select a detail with a border attached to the shape.');
  const transform=p=>p.map((v,a)=>(axis===a?2*plane-v:v)+offset[a]);
  const segments=border.map(edge=>edge.map(id=>transform(detail.vertices[id])));
  if (axis!==null)segments.forEach(edge=>edge.reverse());
  const epsilon=sizeOf(source)*1e-7;
  if (forgeSelectionVertices(detail,selected,'Faces').every(id=>Math.hypot(...sub(transform(detail.vertices[id]),source.vertices[id]))<=epsilon)) throw Error('Move the copy or choose a mirror axis.');
  let shape={...structuredClone(source),faces:source.faces.map(f=>({...structuredClone(f),repeatOriginal:f.id}))};
  // Divide only panels touched by the copied border. The existing cut owner
  // maintains shared border vertices and the neighboring texture coordinates.
  for(const [a,b] of segments) {
    const edge=unit(sub(b,a));
    for(const id of shape.faces.map(f=>f.id)) {
      const face=shape.faces.find(f=>f.id===id);
      if(originalIds.includes(face.repeatOriginal))continue;
      const normal=forgeFaceNormal(shape,face),origin=shape.vertices[face.vertices[0]];
      if(Math.abs(dot(sub(a,origin),normal))>epsilon || Math.abs(dot(sub(b,origin),normal))>epsilon || faceVertices([face]).some(id=>Math.abs(dot(sub(shape.vertices[id],origin),normal))>epsilon) || !overlaps(shape,face,a,b,normal,epsilon))continue;
      const direction=unit(cross(edge,normal)),values=face.vertices.map(id=>dot(shape.vertices[id],direction)),min=Math.min(...values),max=Math.max(...values),value=dot(a,direction);
      if(value<=min+epsilon || value>=max-epsilon)continue;
      shape=cutForgeShape(shape,{direction,min,max},[(value-min)/(max-min)],[face.id]);
    }
  }
  const active=faceVertices(shape.faces);
  const weld=p=>{
    const id=active.find(id=>Math.hypot(...sub(p,shape.vertices[id]))<=epsilon);
    if(id!==undefined)return id;
    shape.vertices.push(p);active.push(shape.vertices.length-1);return shape.vertices.length-1;
  };
  const preview=forgeDetailPreview(detail,selected,{axis,plane,offset});
  const copies=new Map(faceVertices(originals).map(id=>[id,weld(preview.vertices[id])]));
  const patch=preview.faces.map(face=>({...face,id:shape.nextFaceId++,vertices:face.vertices.map(id=>copies.get(id)),triangles:face.triangles.map(t=>({...t,vertices:t.vertices.map(id=>copies.get(id))}))}));
  const targetCount=shape.faces.length;
  const seamPoints=[...new Set([...faceVertices(shape.faces),...copies.values()])].filter(id=>segments.some(([a,b])=>{
    const edge=sub(b,a),length2=dot(edge,edge),t=dot(sub(shape.vertices[id],a),edge)/length2;
    return t>=-1e-7&&t<=1+1e-7&&Math.hypot(...sub(shape.vertices[id],add(a,mul(edge,t))))<=epsilon;
  }));
  shape=splitEdges({...shape,faces:[...shape.faces,...patch]},seamPoints,epsilon);
  const seams=new Map();
  for(const [a,b] of segments){
    const edge=sub(b,a),length2=dot(edge,edge);
    const points=seamPoints.map(id=>({id,t:dot(sub(shape.vertices[id],a),edge)/length2})).filter(({id,t})=>t>=-1e-7&&t<=1+1e-7&&Math.hypot(...sub(shape.vertices[id],add(a,mul(edge,t))))<=epsilon).sort((a,b)=>a.t-b.t);
    for(let i=0;i+1<points.length;i++)seams.set(forgeEdgeKey(points[i].id,points[i+1].id),[points[i].id,points[i+1].id]);
  }
  const targets=shape.faces.slice(0,targetCount),byEdge=adjacency(targets),queue=[],removed=new Set();
  for(const [key,[a,b]] of seams){
    const candidates=byEdge.get(key)||[],inside=candidates.find(e=>e.a===a&&e.b===b);
    if(!inside)throw Error('Place the detail border on the shape. Include the sides of the detail in your selection.');
    queue.push(inside.face);
  }
  while(queue.length){
    const face=queue.pop();if(removed.has(face.id))continue;
    if(originalIds.includes(face.repeatOriginal))throw Error('Place the copy away from the original detail.');
    removed.add(face.id);
    for(const [a,b] of edges(face)){const key=forgeEdgeKey(a,b);if(!seams.has(key))for(const neighbor of byEdge.get(key)||[])if(!removed.has(neighbor.face.id))queue.push(neighbor.face);}
  }
  const removedBorder=outlines(targets.filter(f=>removed.has(f.id))).flatMap(loop=>loop.map((a,i)=>forgeEdgeKey(a,loop[(i+1)%loop.length])));
  if(removedBorder.length!==seams.size || removedBorder.some(key=>!seams.has(key)))throw Error('The copied border must enclose a surface on the shape.');
  const kept=targets.filter(f=>!removed.has(f.id)),groups=new Map();
  for(const face of kept){if(!groups.has(face.repeatOriginal))groups.set(face.repeatOriginal,[]);groups.get(face.repeatOriginal).push(face);}
  // Remove construction cuts outside the footprint where one outline suffices.
  const restored=[...groups.values()].flatMap(faces=>{
    if(faces.length===1)return faces;
    const loops=outlines(faces);
    return loops.length===1?[{...faces[0],vertices:loops[0],triangles:faces.flatMap(f=>f.triangles)}]:faces;
  });
  const faces=[...restored,...shape.faces.slice(targetCount)].map(({repeatOriginal,...face})=>face);
  const selection=shape.faces.slice(targetCount).map(f=>f.id);
  return {shape:{...shape,faces,committed:false,details:[...(source.details||[]),{caps:selection,faces:selection}]},selection};
}

function nearest(value, candidates, tolerance) {
  const target=candidates.filter(Number.isFinite).reduce((best,n)=>Math.abs(n-value)<Math.abs(best-value)?n:best,Infinity);
  return Math.abs(target-value)<=tolerance ? {value:target,snapped:true} : {value,snapped:false};
}

export function snapForgeCut(shape, frame, fraction, tolerance) {
  const span=frame.max-frame.min,value=frame.min+fraction*span;
  const candidates=forgeSelectionVertices(shape,['shape'],'Shape').map(id=>dot(shape.vertices[id],frame.direction)).filter(n=>n>frame.min+span*1e-6&&n<frame.max-span*1e-6);
  const result=nearest(value,candidates,tolerance);
  return {...result,fraction:(result.value-frame.min)/span};
}

export function snapForgeExtrusion(shape, selected, normal, distance, tolerance) {
  const ids=new Set(forgeSelectionVertices(shape,selected,'Faces')),points=[...ids].map(id=>shape.vertices[id]);
  const level=points.reduce((n,p)=>n+dot(p,normal),0)/points.length;
  const levels=forgeSelectionVertices(shape,['shape'],'Shape').filter(id=>!ids.has(id)).map(id=>dot(shape.vertices[id],normal)-level);
  const depths=(shape.extrusionDistances||[]).flatMap(n=>[n,-n]);
  const candidates=[...levels,...depths].filter(n=>Math.abs(n)>1e-7);
  const result=nearest(distance,candidates,tolerance);
  return {...result,distance:result.value};
}
