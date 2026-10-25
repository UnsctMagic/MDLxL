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
