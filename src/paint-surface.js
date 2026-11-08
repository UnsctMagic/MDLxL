import {createFreshPaintAtlas} from './paint-uv-atlas.js';
import {createPaintLayout} from './paint-uv-layout.js';
import {forEachPaintUVTexel} from './paint-uv-coverage.js';
import {createPaintRaster,resizePaintRaster} from './paint-raster.js';
import {isPaintResolution} from './paint-types.js';

function sample(raster,u,v,flags,result,offset,premultiplied=false){
  const x=u*raster.width-.5,y=v*raster.height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const address=(p,size,repeat)=>repeat?(p%size+size)%size:Math.max(0,Math.min(size-1,p));
  const x0=address(ix,raster.width,flags&1),x1=address(ix+1,raster.width,flags&1),y0=address(iy,raster.height,flags&2),y1=address(iy+1,raster.height,flags&2);
  const data=raster.data,p0=(y0*raster.width+x0)*4,p1=(y0*raster.width+x1)*4,p2=(y1*raster.width+x0)*4,p3=(y1*raster.width+x1)*4,w0=(1-fx)*(1-fy),w1=fx*(1-fy),w2=(1-fx)*fy,w3=fx*fy,alpha=data[p0+3]*w0+data[p1+3]*w1+data[p2+3]*w2+data[p3+3]*w3;
  const a=premultiplied?w0*data[p0+3]:w0,b=premultiplied?w1*data[p1+3]:w1,c=premultiplied?w2*data[p2+3]:w2,d=premultiplied?w3*data[p3+3]:w3,divisor=premultiplied?alpha||1:1;
  for(let channel=0;channel<3;channel++)result[offset+channel]=Math.round((data[p0+channel]*a+data[p1+channel]*b+data[p2+channel]*c+data[p3+channel]*d)/divisor);result[offset+3]=Math.round(alpha);
}

/** Lay out a New base coat again with new detail levels, carrying all paint to
 * the new positions. Always starts from the original mesh, so repeat changes do
 * not pile up extra vertices or UV sets. */
export function preparePaintDetailChange(model,originalModel,project,pieceDetail){
  const targets=project.targets.filter(target=>target.generatedUV&&target.bindings.length),indices=[...new Set(targets.flatMap(target=>target.bindings.map(binding=>binding.geosetIndex)))];
  if(!indices.length)throw Error('Detail levels work on a New base coat.');
  const atlas=createPaintLayout(originalModel,indices,targets[0].base.width,{mirror:!!project.shareSides,detail:pieceDetail}),geometry={},uvEdits={...project.uvEdits},generatedUVSets={...project.generatedUVSets};
  const after=targets.map(target=>{
    const width=target.base.width,height=target.base.height,before=[target.base,target.alphaMask,...target.coats.map(c=>c.raster)],rasters=before.map((_,r)=>createPaintRaster(width,height,r===0?Array.from(target.base.data.subarray(0,4)):r===1?[255,255,255,255]:[0,0,0,0])),owner=new Uint8Array(width*height);
    for(const binding of target.bindings){
      const oldGeo=model.Geosets[binding.geosetIndex],newGeo=atlas.model.Geosets[binding.geosetIndex],source=oldGeo.TVertices[binding.coordId],destination=newGeo.TVertices[atlas.coordIds[binding.geosetIndex]];
      if(oldGeo.Faces.length!==newGeo.Faces.length)throw Error('This part changed shape, so its paint cannot be moved.');
      for(let i=0;i<newGeo.Faces.length;i+=3){
        if(binding.faceIndices&&!binding.faceIndices.has(i/3))continue;
        const oldIds=[oldGeo.Faces[i],oldGeo.Faces[i+1],oldGeo.Faces[i+2]],newIds=[newGeo.Faces[i],newGeo.Faces[i+1],newGeo.Faces[i+2]],uv=newIds.map(id=>({x:destination[id*2],y:destination[id*2+1]}));
        forEachPaintUVTexel(uv,width,height,0,(x,y,a,b,c,gutter)=>{
          const pixel=y*width+x,priority=gutter?1:2;if(owner[pixel]>=priority)return;owner[pixel]=priority;
          const u=source[oldIds[0]*2]*a+source[oldIds[1]*2]*b+source[oldIds[2]*2]*c,v=source[oldIds[0]*2+1]*a+source[oldIds[1]*2+1]*b+source[oldIds[2]*2+1]*c;
          for(let r=0;r<rasters.length;r++)sample(before[r],u,v,0,rasters[r].data,pixel*4,r>=2);
        },3);
      }
    }
    return {...target,base:rasters[0],alphaMask:rasters[1],coats:target.coats.map((coat,i)=>({...coat,raster:rasters[i+2]})),revision:(target.revision||0)+1};
  });
  for(const index of indices){geometry[index]=atlas.model.Geosets[index];generatedUVSets[index]=atlas.coordIds[index];for(const key of Object.keys(uvEdits))if(key.startsWith(index+':'))delete uvEdits[key];}
  return {targets:after,geometry,uvEdits,generatedUVSets,pieceDetail};
}

/** Stage a deliberate surface edit without touching any source or working data.
 * Every coat and alpha mask is rebaked separately. Other material layers keep
 * their own original UV sets; seam splits copy all existing rig streams. */
export function preparePaintSurfaceChange(model,project,target,{resolution=1024,unique=false}={}){
  if(!isPaintResolution(resolution))throw Error('Choose a paint resolution from 256 to 2048.');
  if(!target?.bindings?.length)throw Error('Choose a destination used by a model part.');
  const beforeRasters=[target.base,target.alphaMask,...target.coats.map(c=>c.raster)],geometry={},uvEdits={...project.uvEdits};
  let rasters,bindings=target.bindings,generatedUVSets={...project.generatedUVSets};
  if(unique){
    const byGeoset=new Map();
    for(const binding of target.bindings){
      const previous=byGeoset.get(binding.geosetIndex),geo=model.Geosets[binding.geosetIndex],layer=model.Materials[geo.MaterialID]?.Layers?.[binding.layerIndex];
      if(previous&&previous.coordId!==binding.coordId)throw Error('This texture uses multiple UV sets on one part. Keep its authored mapping.');
      if(Number.isInteger(layer?.TVertexAnimId)&&layer.TVertexAnimId>=0)throw Error('This destination has animated UVs. Its authored mapping must be retained.');
      const count=geo.Vertices.length/3;
      for(const [key,stride] of [['Vertices',3],['Normals',3],['VertexGroup',1],['Tangents',4],['SkinWeights',8]])if(geo[key]?.length&&(!ArrayBuffer.isView(geo[key])||geo[key].length!==count*stride))throw Error('This part has an unsupported '+key+' stream; its mapping was not changed.');
      for(const uv of geo.TVertices||[])if(!ArrayBuffer.isView(uv)||uv.length!==count*2)throw Error('This part has an unsupported UV stream; its mapping was not changed.');
      byGeoset.set(binding.geosetIndex,binding);
    }
    const atlas=createFreshPaintAtlas(model,[...byGeoset.keys()],resolution);
    rasters=beforeRasters.map(()=>createPaintRaster(resolution));
    const ownership=new Uint8Array(resolution*resolution);
    for(const [index,binding] of byGeoset){
      const geo=atlas.model.Geosets[index],destination=geo.TVertices[atlas.coordIds[index]],source=geo.TVertices[binding.coordId];geometry[index]=geo;
      for(let i=0;i<geo.Faces.length;i+=3){
        const ids=[geo.Faces[i],geo.Faces[i+1],geo.Faces[i+2]],uv=ids.map(id=>({x:destination[id*2],y:destination[id*2+1]}));
        forEachPaintUVTexel(uv,resolution,resolution,0,(x,y,a,b,c,gutter)=>{
          const pixel=y*resolution+x,priority=gutter?1:2;if(ownership[pixel]>priority)return;ownership[pixel]=priority;
          const u=source[ids[0]*2]*a+source[ids[1]*2]*b+source[ids[2]*2]*c,v=source[ids[0]*2+1]*a+source[ids[1]*2+1]*b+source[ids[2]*2+1]*c;
          for(let r=0;r<rasters.length;r++)sample(beforeRasters[r],u,v,target.flags,rasters[r].data,pixel*4,r>=2);
        },Math.SQRT2);
      }
      for(const key of Object.keys(uvEdits))if(key.startsWith(index+':'))delete uvEdits[key];
      generatedUVSets[index]=atlas.coordIds[index];
    }
    // Outside islands the erase mask must remain opaque, so subsequent UV
    // work or filtered gutters cannot reveal accidental transparent voids.
    for(let p=0;p<ownership.length;p++)if(!ownership[p])rasters[1].data.set([255,255,255,255],p*4);
    bindings=target.bindings.map(b=>project.preserveMaterials?{...b,coordId:atlas.coordIds[b.geosetIndex]}:{...b,coordId:0,sourceCoordId:atlas.coordIds[b.geosetIndex]});
  }else{
    const longest=Math.max(target.base.width,target.base.height),width=Math.max(1,Math.round(target.base.width/longest*resolution)),height=Math.max(1,Math.round(target.base.height/longest*resolution));
    rasters=beforeRasters.map(r=>resizePaintRaster(r,width,height));
  }
  const after={...target,base:rasters[0],alphaMask:rasters[1],coats:target.coats.map((coat,i)=>({...coat,raster:rasters[i+2]})),bindings,flags:unique?0:target.flags,sharedUV:unique?false:target.sharedUV,generatedUV:unique||target.generatedUV,revision:(target.revision||0)+1};
  return {target:after,geometry,previousGeometry:Object.fromEntries(Object.keys(geometry).map(index=>[index,model.Geosets[index]])),uvEdits,generatedUVSets};
}
