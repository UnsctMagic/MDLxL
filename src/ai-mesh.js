import { gather, updateBounds, weldVertices } from './mesh-tools.js';
import { transformVertices } from './editor-commands.js';

/** Mirror a marked piece into the same geoset, so compatible seam vertices can weld.
 * The ordinary Mirror command reflects in place; this explicitly duplicates first.
 * Geometry streams and triangle winding use the editor's existing implementations.
 */
export function mirrorSelection(model, selection, {axis='x', plane=0, weld=false, tolerance=1e-5}={}) {
  const axisIndex=['x','y','z'].indexOf(axis);
  if(axisIndex<0||!Number.isFinite(plane)||!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid mirror plane or tolerance.');
  const result={},details=[];
  for(const [gi,values] of Object.entries(selection)) {
    const ids=[...new Set(values)]; if(!ids.length)continue;
    const g=model.Geosets[gi], count=g?.Vertices?.length/3;
    if(!g||ids.some(id=>!Number.isInteger(id)||id<0||id>=count))throw Error('Selection contains an invalid vertex.');
    if(count+ids.length>65536)throw Error('Mirroring exceeds the MDX geoset vertex limit.');
    const set=new Set(ids), map=new Map(ids.map((old,i)=>[old,count+i])), faces=[];
    for(let i=0;i<g.Faces.length;i+=3) {
      const face=Array.from(g.Faces.slice(i,i+3));
      if(face.every(id=>set.has(id)))faces.push(...face.map(id=>map.get(id)));
    }
    const copy=gather(g,ids), append=(a,b)=>{const out=new a.constructor(a.length+b.length);out.set(a);out.set(b,a.length);return out;};
    for(const key of ['Vertices','Normals','VertexGroup','Tangents','SkinWeights'])if(copy[key])g[key]=append(g[key],copy[key]);
    g.TVertices=g.TVertices.map((uv,i)=>append(uv,copy.TVertices[i]));
    g.Faces=append(g.Faces,new g.Faces.constructor(faces));
    const created=ids.map((_,i)=>count+i),scale=[1,1,1],pivot=[0,0,0];scale[axisIndex]=-1;pivot[axisIndex]=plane;
    transformVertices(g,created,[0,0,0],scale,[0,0,0],pivot);
    let merged=0, selected=created;
    if(weld) {
      const seam=Array.from({length:g.Vertices.length/3},(_,i)=>i).filter(i=>Math.abs(g.Vertices[i*3+axisIndex]-plane)<=tolerance&&(set.has(i)||i>=count));
      const welded=weldVertices(g,[...new Set([...created,...seam])],tolerance);
      merged=welded.merged;selected=welded.selection;
    }
    updateBounds(g);result[gi]=selected;details.push({geoset:Number(gi),addedVertices:ids.length,addedTriangles:faces.length/3,weldedVertices:merged});
  }
  if(!details.length)throw Error('Mark the vertices to mirror first.');
  return {selection:result,details};
}
