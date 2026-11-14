import { Triangle, Vector3 } from 'three';
import { createForgeShape, forgeSelectionVertices, forgeShapeMesh } from './forge-shape-editing.js';
import { checkedVertexSelection, updateBounds } from './mesh-tools.js';
import { interpolatedRecord, sourceRecord } from './mesh-density.js';
import { forgeTangents } from './geoset-tangents.js';
import { appendGeosetGeometry } from './editor-document.js';

const point = (g, id) => Array.from(g.Vertices.slice(id*3, id*3+3));
const binding = (g, i) => [g.VertexGroup?.[i], ...Array.from(g.SkinWeights?.slice(i*8, i*8+8) || [])].join(',');
const remainders=new WeakMap();

function localDraft(shape,g,ids){
  // Two rings retain the complete neighborhoods of changed corners. Distant
  // triangles never enter the per-frame shaping or attribute-sampling work.
  let region=new Set(ids.map(i=>shape.sourceVertices[i])),faces=[];
  for(let ring=0;ring<2;ring++){
    faces=shape.faces.filter(f=>f.triangles.some(t=>t.vertices.some(id=>region.has(id))));
    region=new Set([...region,...faces.flatMap(f=>f.triangles.flatMap(t=>t.vertices))]);
  }
  const vertices=[...region].sort((a,b)=>a-b),remap=new Map(vertices.map((id,i)=>[id,i]));
  const offsets=new Set(faces.flatMap(f=>f.triangles.map(t=>t.sourceOffset))),rest=[];
  for(let i=0;i<g.Faces.length;i+=3)if(!offsets.has(i))rest.push(g.Faces[i],g.Faces[i+1],g.Faces[i+2]);
  const local={...shape,vertices:vertices.map(i=>shape.vertices[i]),vertexSources:vertices.map(i=>shape.vertexSources[i]),
    sourceVertices:shape.sourceVertices.map(id=>remap.get(id)??-1),
    faces:faces.map(f=>({...f,vertices:f.vertices.map(id=>remap.get(id)),triangles:f.triangles.map(t=>({...t,vertices:t.vertices.map(id=>remap.get(id))}))}))};
  remainders.set(local,{faces:rest,reserved:new Set(rest)});return local;
}

/** Capture only the current selection when an operation starts, never on opening
 * the tool drawer. The document and its geoset ownership remain authoritative. */
export function vertexForgeDraft(model, selection) {
  const shapes = [], picked = {};
  for (const [key, ids] of Object.entries(selection)) {
    if (!ids.length) continue;
    const g = model.Geosets[key]; checkedVertexSelection(g, ids, { requireFaces: true, allowSkinOnly: true });
    const shape = localDraft(createForgeShape({ geosets: [g] }, { id: Number(key), name: `Geoset ${Number(key)+1}`, trackSources: true, vertexKey: binding }),g,ids);
    shapes.push(shape); picked[shape.id] = [...new Set(ids.map(i => shape.sourceVertices[i]))];
  }
  if (!shapes.length) throw Error('Select vertices to work on.');
  return { shapes, selection: picked, mode: 'Vertices' };
}

export function vertexForgeFaces(draft) {
  return { ...draft, mode: 'Faces', selection: Object.fromEntries(draft.shapes.map(shape => {
    const ids = new Set(forgeSelectionVertices(shape, draft.selection[shape.id], draft.mode));
    return [shape.id, shape.faces.filter(f => f.triangles.every(t => t.vertices.every(i => ids.has(i)))).map(f => f.id)];
  })) };
}

/** Revision checks compare only selection geometry. Reuse unaffected geosets
 * even when editor commands mutate a stream in place. */
export function vertexForgePickEntries(model, selectable, cache) {
  const result=[];
  for(const i of selectable){
    const g=model.Geosets[i];if(!g?.Faces.length)continue;
    const streams=[g.Vertices,g.Faces,g.Normals,g.TVertices[0],g.VertexGroup,g.SkinWeights].map(s=>s?.length?new Uint8Array(s.buffer,s.byteOffset,s.byteLength):new Uint8Array());
    let entry=cache.get(i);
    if(!entry||!streams.every((s,k)=>same(s,entry.streams[k]))){
      checkedVertexSelection(g,[],{requireFaces:true,allowEmpty:true,allowSkinOnly:true});
      const shape=createForgeShape({geosets:[g]},{id:i,name:`Geoset ${i+1}`,trackSources:true,vertexKey:binding});
      entry={shape,mesh:forgeShapeMesh(shape),streams:streams.map(s=>s.slice())};cache.set(i,entry);
    }
    result.push(entry);
  }
  for(const i of cache.keys())if(!selectable.has(i))cache.delete(i);
  return result;
}

function cornerRecord(g, source, shape, face, triangle, corner, groups, original) {
  const id = triangle.vertices[corner], origins = shape.vertexSources[id];
  const sourcePoint = [0,1,2].map(axis => origins.reduce((n, [index, weight]) => n + g.Vertices[index*3+axis]*weight, 0));
  const uv = triangle.uv.slice(corner*2, corner*2+2);
  const direct=original!==undefined&&uv.every((n,a)=>Math.abs(n-g.TVertices[0][original*2+a])<1e-7);
  let samples = direct ? [[original,1]] : origins, best = Infinity;
  // Pick the original side of a UV seam, then interpolate every UV set and rig
  // stream using the mesh-density owner's established SD/HD rules.
  for (const indices of direct ? [] : face.sourceTriangles || []) {
    const positions = indices.map(index => new Vector3(...point(g, index)));
    const bary = Triangle.getBarycoord(new Vector3(...sourcePoint), ...positions, new Vector3());
    if (!bary) continue;
    const weights = bary.toArray(), distance = new Triangle(...positions).closestPointToPoint(new Vector3(...sourcePoint), new Vector3()).distanceToSquared(new Vector3(...sourcePoint));
    const outside = weights.reduce((n, w) => n + Math.max(0, -w), 0);
    const sampleUV = [0,1].map(axis => weights.reduce((n, w, k) => n+w*g.TVertices[0][indices[k]*2+axis], 0));
    const score = distance + outside*1e6 + sampleUV.reduce((n, v, k) => n+(v-uv[k])**2, 0)*1e-5;
    if (score < best) {
      best = score;
      const positive = weights.map(w => Math.max(0,w)), total = positive.reduce((a,b) => a+b, 0);
      samples = indices.map((index,k) => [index, positive[k]/total]).filter(([,w]) => w > 1e-8);
    }
  }
  const record = samples.length === 1 ? sourceRecord(g, samples[0][0]) : interpolatedRecord(g, samples.map(s => s[0]), samples.map(s => s[1]), groups);
  const normal = triangle.normals?.slice(corner*3, corner*3+3) || Triangle.getNormal(...triangle.vertices.map(i => new Vector3(...shape.vertices[i])), new Vector3()).toArray();
  if(record.tangent)record.tangentChanged=record.position.some((n,a)=>n!==shape.vertices[id][a])||record.normal.some((n,a)=>n!==normal[a])||record.uvs[0].some((n,a)=>n!==uv[a]);
  record.position = shape.vertices[id];
  // Surface rims sample the authored surface once for every UV set. Their
  // primitive preview UVs must not replace the first authored stream alone.
  if(!triangle.sourceUV)record.uvs[0] = uv;
  record.normal = normal;
  return record;
}

function writeRecords(g, records, faces, groups) {
  const stream = (prior, width, read) => new prior.constructor(records.flatMap(read));
  const out = { ...g, Vertices: stream(g.Vertices, 3, r => r.position), Normals: stream(g.Normals, 3, r => r.normal),
    TVertices: g.TVertices.map((uv, i) => stream(uv, 2, r => r.uvs[i])),
    VertexGroup: g.VertexGroup?.length ? stream(g.VertexGroup, 1, r => [r.vertexGroup]) : g.VertexGroup, Groups: groups,
    TotalGroupsCount: groups.reduce((n, group) => n + group.length, 0), Faces: new g.Faces.constructor(faces) };
  if (records.length > 65536) throw Error('This operation exceeds the 65536-vertex geoset limit.');
  if (g.SkinWeights?.length) out.SkinWeights = stream(g.SkinWeights, 8, r => r.skin);
  if (g.Tangents?.length) out.Tangents = stream(g.Tangents, 4, r => r.tangent);
  if (g.PrimitiveTypes?.length) out.PrimitiveTypes = new g.PrimitiveTypes.constructor([4]);
  if (g.PrimitiveCounts?.length) out.PrimitiveCounts = new g.PrimitiveCounts.constructor([faces.length]);
  updateBounds(out);
  return out;
}

const same = (a,b) => a === b || !!a && !!b && a.length === b.length && a.every((n,i)=>n===b[i]);
const sameRecord = (a,b) => same(a.position,b.position) && same(a.normal,b.normal) && a.vertexGroup===b.vertexGroup && same(a.skin,b.skin) && same(a.tangent,b.tangent) && a.uvs.every((uv,i)=>same(uv,b.uvs[i]));

// Copy streams once, then patch only changed slots. Authored duplicates and free
// vertices remain distinct; new corners append after the original vertex count.
function writeVertexChanges(g, changes, count, faces, groups) {
  if(count>65536)throw Error('This operation exceeds the 65536-vertex geoset limit.');
  const stream=(prior,width,read)=>{
    if(!prior?.length)return prior;
    const out=new prior.constructor(count*width);out.set(prior);
    for(const [index,record] of changes)out.set(read(record),index*width);
    return out;
  };
  const out={...g,Vertices:stream(g.Vertices,3,r=>r.position),Normals:stream(g.Normals,3,r=>r.normal),
    TVertices:g.TVertices.map((uv,i)=>stream(uv,2,r=>r.uvs[i])),VertexGroup:stream(g.VertexGroup,1,r=>[r.vertexGroup]),
    Groups:groups,TotalGroupsCount:groups.reduce((n,group)=>n+group.length,0),Faces:new g.Faces.constructor(faces)};
  if(g.SkinWeights?.length)out.SkinWeights=stream(g.SkinWeights,8,r=>r.skin);
  if(g.Tangents?.length)out.Tangents=stream(g.Tangents,4,r=>r.tangent);
  if(g.PrimitiveTypes?.length)out.PrimitiveTypes=new g.PrimitiveTypes.constructor([4]);
  if(g.PrimitiveCounts?.length)out.PrimitiveCounts=new g.PrimitiveCounts.constructor([faces.length]);
  updateBounds(out);
  return out;
}

/** Preview and commit share the exact same model result. Untouched geosets and
 * all non-geometry records are retained; opening/cancelling never writes. */
export function vertexForgeResult(model, before, after) {
  const Geosets = model.Geosets.slice(), selection = {};
  for (const shape of after.shapes) {
    const source = before.shapes.find(s => s.id === shape.id);
    if (source === shape) continue;
    const g = model.Geosets[shape.id], groups = g.Groups.map(group => Array.from(group));
    // Standalone bevel selects its whole Shape. Here a Shape represents a
    // geoset, so keep the authored region selected through the new topology.
    const sourcePicked = new Set(forgeSelectionVertices(source, before.selection[shape.id], before.mode));
    const picked = new Set(after.mode === 'Shape' && before.mode !== 'Shape'
      ? shape.vertexSources.flatMap((origins, id) => origins.some(([index]) => sourcePicked.has(source.sourceVertices[index])) ? [id] : [])
      : forgeSelectionVertices(shape, after.selection[shape.id], after.mode));
    const remainder=remainders.get(source);
    const changes=new Map(), faces=remainder?.faces.slice()||[], cache=new Map(), selected=new Set(), reserved=new Set(remainder?.reserved), corners=[], movedNormals=new Map();
    let count=g.Vertices.length/3;
    // Reserve original corners before allocating any changed ones, regardless
    // of face order. An adjacent new face cannot overwrite an untouched corner.
    for (const face of shape.faces) for (const triangle of face.triangles) for (let k=0;k<3;k++) {
      const id=triangle.vertices[k], origins=shape.vertexSources[id], authored=triangle.sourceCorners?.[k];
      const origin=origins.length===1&&origins[0][1]===1?source.sourceVertices[origins[0][0]]:undefined;
      const original=authored!==undefined&&source.sourceVertices[authored]===origin?authored:
        origin===undefined?undefined:(face.sourceTriangles?.flat().find(i=>source.sourceVertices[i]===origin)??origins[0][0]);
      const unchanged=original!==undefined&&same(shape.vertices[id],source.vertices[origin])&&
        (!sourcePicked.has(origin)||same(triangle.normals?.slice(k*3,k*3+3),Array.from(g.Normals.subarray(original*3,original*3+3))))&&
        same(triangle.uv.slice(k*2,k*2+2),Array.from(g.TVertices[0].subarray(original*2,original*2+2)));
      if(!unchanged&&authored===original&&!triangle.normals){
        const [a,b,c]=triangle.vertices.map(i=>new Vector3(...shape.vertices[i])),n=b.sub(a).cross(c.sub(a));
        if(!movedNormals.has(original))movedNormals.set(original,new Vector3());movedNormals.get(original).add(n);
      }
      if(unchanged)reserved.add(original);
      corners.push({face,triangle,k,id,original,unchanged});
    }
    for(const {face,triangle,k,id,original,unchanged} of corners){
      let index=original;
      if(!unchanged){
        const record=cornerRecord(g,source,shape,face,triangle,k,groups,original);
        if(triangle.sourceCorners?.[k]===original&&!triangle.normals&&movedNormals.has(original))record.normal=movedNormals.get(original).clone().normalize().toArray();
        const key=original===undefined?'new:'+id:'old:'+original, entries=cache.get(key)||[];
        index=entries.find(entry=>sameRecord(entry.record,record))?.index;
        if(index===undefined){
          if(original!==undefined&&!reserved.has(original)&&!changes.has(original))index=original;
          else if(original!==undefined&&sameRecord(sourceRecord(g,original),record))index=original;
          else index=count++;
          changes.set(index,record);entries.push({index,record});cache.set(key,entries);
        }
      }
      faces.push(index);if(picked.has(id))selected.add(index);
    }
    const result = writeVertexChanges(g,changes,count,faces,groups);
    if (g.Tangents?.length) {
      const tangents=forgeTangents(result,new Set([...changes].filter(([,record])=>record.tangentChanged).map(([i])=>i)));
      for(const [i,record] of changes)if(record.tangentChanged)result.Tangents.set(tangents.subarray(i*4,i*4+4),i*4);
    }
    Geosets[shape.id] = result; selection[shape.id] = [...selected];
  }
  return { ...model, Geosets, forgeSelection: selection };
}

/** New objects use the active geoset's material and nearby selected bindings.
 * They are immediately editable/weldable with normal Vertex commands. */
export function appendVertexForgeShape(model, geosetIndex, selected, mesh, center) {
  const g = model.Geosets[geosetIndex];
  if (!g) throw Error('Select a geoset to add the object to.');
  checkedVertexSelection(g, selected, { allowEmpty: true, allowSkinOnly: true });
  const count = g.Vertices.length/3, candidates = selected.length ? selected : Array.from({length:count},(_,i)=>i);
  const records = [], faces = [];
  for (const part of mesh.geosets) {
    const start = records.length;
    for (let i=0;i<part.Vertices.length/3;i++) {
      const position = point(part,i).map((n,a)=>n+center[a]);
      let nearest = candidates[0], distance = Infinity;
      for (const candidate of candidates) { const d = point(g,candidate).reduce((n,v,a)=>n+(v-position[a])**2,0); if(d<distance){nearest=candidate;distance=d;} }
      const record = sourceRecord(g,nearest); record.position=position;
      record.normal=Array.from(part.Normals.slice(i*3,i*3+3));
      record.uvs=record.uvs.map(()=>Array.from(part.TVertices[0].slice(i*2,i*2+2)));
      records.push(record);
    }
    faces.push(...Array.from(part.Faces,i=>start+i));
  }
  const result=writeRecords(g,records,faces,g.Groups.map(group=>Array.from(group)));
  if(g.Tangents?.length)result.Tangents=forgeTangents(result);
  const indices=appendGeosetGeometry(g,result);
  if(g.PrimitiveCounts?.length)g.PrimitiveCounts=new g.PrimitiveCounts.constructor([g.Faces.length]);
  return {selection:{[geosetIndex]:indices}};
}
