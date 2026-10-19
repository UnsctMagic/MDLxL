import { blendPaintPixel, rgbaColor } from './paint-raster.js';
import { preparePaintSurface, paintSurfaceTile } from './paint-projection.js';
import { borrowPaintColor } from './paint-borrow.js';

export function paintDecalTransform(source,brush,dragging=false) {
  const longest=Math.max(1,source.width,source.height),size=Math.max(1,Number(brush.size)||longest),zoom=Math.max(.01,Math.min(64,Number(brush.zoom)||1)),scale=size/longest*zoom;
  return {width:source.width*scale,height:source.height*scale,angle:0,flipX:false,flipY:false,opacity:Math.max(0,Math.min(1,Number(brush.opacity)*Number(brush.strength??1)*(dragging?Number(brush.flow):1)))};
}

// Premultiplied box-filtered levels of a stamp image. A stamp is usually shown
// smaller than its source; one source pixel per texture pixel aliases into
// noise, while the on-screen ghost is a smooth reduction of the whole image.
const decalLevels=new WeakMap();
function paintDecalLevels(source){
  const cached=decalLevels.get(source);if(cached?.data===source.data)return cached.levels;
  let width=source.width,height=source.height,data=new Float32Array(width*height*4);
  for(let i=0;i<data.length;i+=4){const a=source.data[i+3]/255;data[i]=source.data[i]*a;data[i+1]=source.data[i+1]*a;data[i+2]=source.data[i+2]*a;data[i+3]=a;}
  const levels=[{width,height,data}];
  while(width>1||height>1){
    const w=Math.max(1,Math.ceil(width/2)),h=Math.max(1,Math.ceil(height/2)),next=new Float32Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const x0=Math.min(width-1,x*2),x1=Math.min(width-1,x*2+1),y0=Math.min(height-1,y*2),y1=Math.min(height-1,y*2+1),o=(y*w+x)*4;
      for(let c=0;c<4;c++)next[o+c]=(data[(y0*width+x0)*4+c]+data[(y0*width+x1)*4+c]+data[(y1*width+x0)*4+c]+data[(y1*width+x1)*4+c])/4;
    }
    levels.push({width:w,height:h,data:next});width=w;height=h;data=next;
  }
  decalLevels.set(source,{data:source.data,levels});return levels;
}
function sampleLevel(level,u,v,weight,out){
  const x=Math.max(0,Math.min(level.width-1,u*level.width-.5)),y=Math.max(0,Math.min(level.height-1,v*level.height-.5)),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const x1=Math.min(level.width-1,ix+1),y1=Math.min(level.height-1,iy+1),d=level.data;
  for(let c=0;c<4;c++){
    const top=d[(iy*level.width+ix)*4+c]*(1-fx)+d[(iy*level.width+x1)*4+c]*fx,bottom=d[(y1*level.width+ix)*4+c]*(1-fx)+d[(y1*level.width+x1)*4+c]*fx;
    out[c]+=(top*(1-fy)+bottom*fy)*weight;
  }
}
/** Read the stamp at (u,v), averaged over `footprint` source pixels. At full
 * size or enlarged, keep its exact pixels and hard cutout edges. */
export function samplePaintDecal(source,u,v,footprint,out=[0,0,0,0]){
  if(!(footprint>1)){
    const offset=(Math.min(source.height-1,Math.floor(v*source.height))*source.width+Math.min(source.width-1,Math.floor(u*source.width)))*4;
    for(let c=0;c<4;c++)out[c]=source.data[offset+c];return out;
  }
  const levels=paintDecalLevels(source),level=Math.max(0,Math.min(levels.length-1,Math.log2(Math.max(1,footprint)))),low=Math.floor(level),blend=level-low,sum=[0,0,0,0];
  sampleLevel(levels[low],u,v,1-blend,sum);if(blend>0&&low+1<levels.length)sampleLevel(levels[low+1],u,v,blend,sum);
  const alpha=sum[3];
  for(let c=0;c<3;c++)out[c]=alpha>1e-6?Math.max(0,Math.min(255,Math.round(sum[c]/alpha))):0;
  out[3]=Math.max(0,Math.min(255,Math.round(alpha*255)));return out;
}
function decalPlacement(source,center,transform){
  const width=Math.max(1,transform.width),height=Math.max(1,transform.height),angle=-(transform.angle||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  return {width,height,c,s,scale:Math.max(source.width/width,source.height/height)};
}
function decalInside(source,center,transform){
  const {width,height,c,s}=decalPlacement(source,center,transform);
  return (x,y)=>{const dx=x-center.x,dy=y-center.y,u=(dx*c-dy*s)/width+.5,v=(dx*s+dy*c)/height+.5;return u>=0&&v>=0&&u<1&&v<1;};
}
// `footprint` is the size of one destination pixel in screen pixels. The stamp
// scale converts it to source pixels, so the result matches the scaled ghost.
function decalSampler(source,center,transform) {
  const {width,height,c,s,scale}=decalPlacement(source,center,transform);
  return (x,y,footprint,out)=>{
    const dx=x-center.x,dy=y-center.y,u=(dx*c-dy*s)/width+.5,v=(dx*s+dy*c)/height+.5;
    if(u<0||v<0||u>=1||v>=1)return null;
    return samplePaintDecal(source,transform.flipX?1-u:u,transform.flipY?1-v:v,footprint*scale,out);
  };
}
export function pastePaintDecal(target,source,center,transform,mask=null) {
  const sample=decalSampler(source,center,transform),color=[0,0,0,0];let changed=0;
  const radius=Math.hypot(transform.width,transform.height)/2;
  for(let y=Math.max(0,Math.floor(center.y-radius));y<Math.min(target.height,center.y+radius);y++)for(let x=Math.max(0,Math.floor(center.x-radius));x<Math.min(target.width,center.x+radius);x++){
    const pixel=y*target.width+x;if(mask&&!mask[pixel]||!sample(x+.5,y+.5,1,color))continue;
    if(blendPaintPixel(target.data,pixel*4,color,(transform.opacity??1)*(mask?mask[pixel]/255:1),'paint'))changed++;
  }
  return changed;
}
export function projectPaintDecal(target,projection,source,center,transform,flagsOrOptions=0) {
  const options=typeof flagsOrOptions==='object'?flagsOrOptions:{flags:flagsOrOptions},flags=Number(options.flags)||0,mask=options.mask,tint=rgbaColor(options.filterColor||'#ffffff');
  const surface=preparePaintSurface(projection,target,flags),{tileSize,columns}=surface,inside=decalInside(source,center,transform),sample=decalSampler(source,center,transform),color=[0,0,0,0],picked=[0,0,0,0],radius=Math.hypot(transform.width,transform.height)/2;let changed=0;
  // Mirrored faces and seam filter samples may address one texture pixel many
  // times. A placed cutout is one operation, so blend that pixel only once.
  const selected=new Map();
  for(let ty=Math.max(0,Math.floor((center.y-radius)/tileSize));ty<=Math.min(Math.ceil(projection.height/tileSize)-1,Math.floor((center.y+radius)/tileSize));ty++)for(let tx=Math.max(0,Math.floor((center.x-radius)/tileSize));tx<=Math.min(columns-1,Math.floor((center.x+radius)/tileSize));tx++){
    const points=paintSurfaceTile(projection,target,flags,tx,ty);if(!points)continue;
    const ranks=surface.sampleRanks?.get(ty*columns+tx),footprints=surface.footprints?.get(ty*columns+tx);
    for(let i=0;i<points.length;i+=3){
      if(!inside(points[i],points[i+1]))continue;
      const pixel=points[i+2];if(mask&&!mask[pixel])continue;const distance=(points[i]-center.x)**2+(points[i+1]-center.y)**2,rank=ranks?.[i/3]??2,previous=selected.get(pixel);
      // Texel-center projections define the image. Filter footprints are only
      // a fallback for edges, magnified cells and collapsed mappings. Letting
      // those footprints win pulls the source toward the center of the stamp.
      if(!previous||rank>previous.rank||rank===previous.rank&&distance<previous.distance)selected.set(pixel,{x:points[i],y:points[i+1],footprint:footprints?.[i/3]??1,distance,rank});
    }
  }
  for(const [pixel,{x,y,footprint}] of selected){
    if(!sample(x,y,footprint,picked))continue;
    for(let c=0;c<3;c++)color[c]=Math.round(picked[c]*tint[c]/255);color[3]=picked[3];
    if(options.borrowMode&&options.borrowMode!=='image'&&options.reference)borrowPaintColor(source,picked,options.reference,pixel,options.borrowMode,color);
    if(blendPaintPixel(target.data,pixel*4,color,(transform.opacity??1)*(mask?mask[pixel]/255:1),options.mode==='erase'?'erase':'paint')){
      changed++;if(options.dirtyRows){const x=pixel%target.width,row=Math.floor(pixel/target.width)*2;options.dirtyRows[row]=Math.min(options.dirtyRows[row],x);options.dirtyRows[row+1]=Math.max(options.dirtyRows[row+1],x);}
    }
  }
  return changed;
}
