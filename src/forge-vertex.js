import { Triangle, Vector3 } from 'three';
import { createForgeShape, forgeSelectionVertices } from './forge-shape-editing.js';
import { checkedVertexSelection, updateBounds } from './mesh-tools.js';
import { interpolatedRecord, sourceRecord } from './mesh-density.js';
import { forgeTangents } from './geoset-tangents.js';
import { appendGeosetGeometry } from './editor-document.js';

const point = (g, id) => Array.from(g.Vertices.slice(id*3, id*3+3));
const binding = (g, i) => [g.VertexGroup[i], ...Array.from(g.SkinWeights?.slice(i*8, i*8+8) || [])].join(',');

/** Capture only the current selection when an operation starts, never on opening
 * the tool drawer. The document and its geoset ownership remain authoritative. */
export function vertexForgeDraft(model, selection) {
  const shapes = [], picked = {};
  for (const [key, ids] of Object.entries(selection)) {
    if (!ids.length) continue;
    const g = model.Geosets[key]; checkedVertexSelection(g, ids, { requireFaces: true });
    const shape = createForgeShape({ geosets: [g] }, { id: Number(key), name: `Geoset ${Number(key)+1}`, trackSources: true, vertexKey: binding });
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

function cornerRecord(g, source, shape, face, triangle, corner, groups) {
  const id = triangle.vertices[corner], origins = shape.vertexSources[id];
  const sourcePoint = [0,1,2].map(axis => origins.reduce((n, [index, weight]) => n + g.Vertices[index*3+axis]*weight, 0));
  const uv = triangle.uv.slice(corner*2, corner*2+2);
  let samples = origins, best = Infinity;
  // Pick the original side of a UV seam, then interpolate every UV set and rig
  // stream using the mesh-density owner's established SD/HD rules.
  for (const indices of face.sourceTriangles || []) {
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
  record.position = shape.vertices[id]; record.uvs[0] = uv;
  record.normal = normal;
  return record;
}

function writeRecords(g, records, faces, groups) {
  const stream = (prior, width, read) => new prior.constructor(records.flatMap(read));
  const out = { ...g, Vertices: stream(g.Vertices, 3, r => r.position), Normals: stream(g.Normals, 3, r => r.normal),
    TVertices: g.TVertices.map((uv, i) => stream(uv, 2, r => r.uvs[i])),
    VertexGroup: stream(g.VertexGroup, 1, r => [r.vertexGroup]), Groups: groups,
    TotalGroupsCount: groups.reduce((n, group) => n + group.length, 0), Faces: new g.Faces.constructor(faces) };
  if (records.length > 65536) throw Error('This operation exceeds the 65536-vertex geoset limit.');
  if (g.SkinWeights?.length) out.SkinWeights = stream(g.SkinWeights, 8, r => r.skin);
  if (g.Tangents?.length) out.Tangents = stream(g.Tangents, 4, r => r.tangent);
  if (g.PrimitiveTypes?.length) out.PrimitiveTypes = new g.PrimitiveTypes.constructor([4]);
  if (g.PrimitiveCounts?.length) out.PrimitiveCounts = new g.PrimitiveCounts.constructor([faces.length]);
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
    const records = [], faces = [], cache = new Map(), selected = new Set();
    for (const face of shape.faces) for (const triangle of face.triangles) for (let k=0;k<3;k++) {
      const record = cornerRecord(g, source, shape, face, triangle, k, groups);
      // Keep UV/normal/rig seams separate even when position topology is shared.
      const key = JSON.stringify([triangle.vertices[k], record]);
      let index = cache.get(key);
      if (index === undefined) { index = records.length; records.push(record); cache.set(key,index); }
      faces.push(index); if (picked.has(triangle.vertices[k])) selected.add(index);
    }
    // Authored free vertices are unrelated to surface edits.
    const used = new Set(g.Faces);
    for (let i=0;i<g.Vertices.length/3;i++) if (!used.has(i)) records.push(sourceRecord(g,i));
    const result = writeRecords(g, records, faces, groups);
    if (g.Tangents?.length) {
      const tangents=forgeTangents(result);
      records.forEach((record,i)=>{if(record.tangentChanged)result.Tangents.set(tangents.subarray(i*4,i*4+4),i*4);});
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
  checkedVertexSelection(g, selected, { allowEmpty: true });
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
