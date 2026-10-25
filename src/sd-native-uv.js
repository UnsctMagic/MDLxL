import { gather } from './mesh-tools.js';
import { projectUVFromView } from './uv-tools.js';
import { nativeTexture } from './sd-native-textures.js';
/** Remap explicit triangle ids (not an approximate vertex selection) into one
 * visually checked native rectangle. Shared boundaries split only for a UV
 * seam; all standard streams, weights, other UV sets and unselected corners
 * are retained through the existing gather operation. Does not change material. */
export async function mapNativeRegion(model,{geosetId,faces,texturePath,region,uvSet=0,projection='fit',axes='xz',flipU=false,padding=1}={}) {
  const g=model.Geosets?.[geosetId],texture=await nativeTexture(texturePath);
  const area=texture?.regions.find(r=>r.name===region&&r.checkedByEye);
  if(!g||!area)throw Error('Choose a geoset and a visually checked catalogue region.');
  if(!Number.isInteger(uvSet)||uvSet<0||!g.TVertices?.[uvSet])throw Error('Choose an existing UV set.');
  const selected=new Set(faces); if(!selected.size||[...selected].some(f=>!Number.isInteger(f)||f<0||f>=g.Faces.length/3))throw Error('Supply explicit valid triangle ids.');
  const imageLayers=(model.Materials?.[g.MaterialID]?.Layers||[]).filter(l=>typeof l.TextureID==='number');
  const key=s=>String(s||'').replaceAll('\\','/').toLowerCase().replace(/\.(?:blp|dds)$/,'');
  if(!imageLayers.some(l=>key(model.Textures?.[l.TextureID]?.Image)===key(texture.path)))throw Error('Assign this native sheet to the geoset material first; UV mapping does not replace an existing material.');
  if(!imageLayers.some(l=>key(model.Textures?.[l.TextureID]?.Image)===key(texture.path)&&(l.CoordId??0)===uvSet))throw Error('Choose the UV set used by this native texture layer.');
  if(!Number.isFinite(padding)||padding<0)throw Error('Padding must be a nonnegative pixel count.');
  const sources=Array.from({length:g.Vertices.length/3},(_,i)=>i),outside=new Set(),inside=new Set();
  for(let f=0;f<g.Faces.length/3;f++) for(const id of g.Faces.subarray(f*3,f*3+3))(selected.has(f)?inside:outside).add(id);
  const duplicates=new Map(); for(const id of inside)if(outside.has(id)){duplicates.set(id,sources.length);sources.push(id);}
  if(sources.length>65536)throw Error('UV seam would exceed the geoset vertex limit; split the geoset first.');
  const data=gather(g,sources),nextFaces=new g.Faces.constructor(g.Faces),indices=[];
  for(const f of selected)for(let c=0;c<3;c++){const at=f*3+c,id=nextFaces[at];nextFaces[at]=duplicates.get(id)??id;indices.push(nextFaces[at]);}
  const ids=[...new Set(indices)];let values=data.TVertices[uvSet];
  if(projection==='planar') {
    const matrices={xy:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],xz:[1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],yz:[0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1]};
    if(!matrices[axes])throw Error('Planar axes must be xy, xz or yz.');
    values=projectUVFromView({...g,...data},ids,matrices[axes],[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],values);
  } else if(projection!=='fit')throw Error('Use fit for existing islands or planar for selected flat faces.');
  const lows=[0,1].map(k=>Math.min(...ids.map(i=>values[i*2+k]))),highs=[0,1].map(k=>Math.max(...ids.map(i=>values[i*2+k])));
  if(highs.some((v,k)=>v-lows[k]<1e-8))throw Error('The UV island is collapsed; choose a suitable planar projection.');
  const [u0,v0,u1,v1]=area.rect,padU=padding/texture.width,padV=padding/texture.height;
  if(u1-u0<=2*padU||v1-v0<=2*padV)throw Error('Padding consumes the selected region.');
  for(const i of ids){let u=(values[i*2]-lows[0])/(highs[0]-lows[0]);if(flipU)u=1-u;values[i*2]=u0+padU+u*(u1-u0-2*padU);values[i*2+1]=v0+padV+(values[i*2+1]-lows[1])/(highs[1]-lows[1])*(v1-v0-2*padV);}
  data.TVertices[uvSet]=values;Object.assign(g,data,{Faces:nextFaces});
  return {faces:selected.size,splitVertices:duplicates.size,texture:texture.path,region:area.name,rect:area.rect,uvSet};
}

/** Inspect one selected, unmirrored UV layout without changing any stream.
 * Mixed winding within a connected chart can be a fold or intentionally reused
 * paint. Select the outer anatomical half separately from caps/interior faces.
 * Opposite-winding disconnected islands are valid; this never rewrites them. */
export function inspectUVChart(geoset, faces, uvSet = 0) {
  const uv = geoset?.TVertices?.[uvSet], ids = [...new Set(faces || [])];
  if (!uv || !geoset?.Vertices || !ids.length || ids.some(f => !Number.isInteger(f) || f < 0 || f >= geoset.Faces.length / 3))
    throw Error('Choose an existing UV set and explicit valid triangle ids.');
  const vertexKey = i => [...geoset.Vertices.subarray(i * 3, i * 3 + 3), ...uv.subarray(i * 2, i * 2 + 2)].map(v => Math.round(v * 1e5)).join(','),
    edges = new Map(), adjacency = new Map(ids.map(f => [f, []])), signs = new Map();
  for (const f of ids) {
    const corners = Array.from(geoset.Faces.subarray(f * 3, f * 3 + 3)), points = corners.map(i => [uv[i * 2], uv[i * 2 + 1]]);
    const area = (points[1][0] - points[0][0]) * (points[2][1] - points[0][1]) - (points[2][0] - points[0][0]) * (points[1][1] - points[0][1]);
    signs.set(f, Math.abs(area) < 1e-10 ? 0 : Math.sign(area));
    for (let k = 0; k < 3; k++) {
      const key = [vertexKey(corners[k]), vertexKey(corners[(k + 1) % 3])].sort().join('|');
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(f);
    }
  }
  let ambiguousEdges = 0;
  for (const joined of edges.values()) {
    if (joined.length > 2) { ambiguousEdges++; continue; }
    if (joined.length === 2) { adjacency.get(joined[0]).push(joined[1]); adjacency.get(joined[1]).push(joined[0]); }
  }
  const seen = new Set(), charts = [];
  for (const first of ids) if (!seen.has(first)) {
    const pending = [first], group = []; seen.add(first);
    while (pending.length) { const f = pending.pop(); group.push(f); for (const next of adjacency.get(f)) if (!seen.has(next)) { seen.add(next); pending.push(next); } }
    const positive = group.filter(f => signs.get(f) === 1), negative = group.filter(f => signs.get(f) === -1), collapsedFaces = group.filter(f => signs.get(f) === 0);
    charts.push({triangles:group.length,positive:positive.length,negative:negative.length,collapsedFaces,
      possibleFoldFaces:positive.length && negative.length ? (positive.length < negative.length ? positive : negative) : []});
  }
  return {charts,ambiguousEdges,note:'Read-only hints for the selected charts. Mixed winding can be a fold, bad mesh facing or intentional mirrored paint. Inspect anatomy and seams; never globally flip or unwrap an authored model.'};
}
