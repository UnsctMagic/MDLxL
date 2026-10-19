import {preparePaintSurface,paintSurfaceTile} from './paint-projection.js';
import {blendPaintPixel} from './paint-raster.js';

// Strength is defined per quarter brush width of travel, so the dab spacing
// and the brush size do not change how far a smear reaches.
const SMUDGE_REFERENCE_STEP=.25;

/** Smudge drags the visible colours under the brush along the stroke, like a
 * finger in wet paint. The brush carries a small screen-space image of what it
 * last touched; each dab lays that image down at the new position and picks up
 * the surface again. Only visible, selected texels are read, so a protected
 * neighbour never leaks into the smear. Writes go to the active layer;
 * `options.reference` is the composite the user sees and must be kept current. */
export function smudgeProjectedPaint(raster,projection,center,brush,options,state){
  const strength=Math.max(0,Math.min(1,Number(brush.opacity)*Number(brush.strength??1)));if(!strength)return 0;
  const radius=Math.max(1,Number(brush.size)/2),inner=Math.max(0,Math.min(.995,Number(brush.hardness)||0))*radius;
  const cells=Math.max(2,Math.min(96,Math.ceil(radius*2))),cell=radius*2/cells,reference=options.reference.data,mask=options.mask;
  if(state.cells!==cells){state.cells=cells;state.carry=null;state.last=null;}
  const travel=state.last?Math.hypot(center.x-state.last.x,center.y-state.last.y)/(radius*2*SMUDGE_REFERENCE_STEP):0;
  const keep=Math.pow(strength,travel),deposit=1-Math.pow(1-strength,travel);
  const falloffAt=distance=>{let value=distance<=inner?1:1-(distance-inner)/Math.max(.001,radius-inner);value=Math.max(0,Math.min(1,value));return value*value*(3-2*value);};
  const surface=preparePaintSurface(projection,raster,options.flags),{tileSize,columns}=surface;
  const pickup=new Float32Array(cells*cells*4),hits=new Uint32Array(cells*cells),texels=new Map();
  for(let ty=Math.max(0,Math.floor((center.y-radius)/tileSize));ty<=Math.min(Math.ceil(projection.height/tileSize)-1,Math.floor((center.y+radius)/tileSize));ty++)for(let tx=Math.max(0,Math.floor((center.x-radius)/tileSize));tx<=Math.min(columns-1,Math.floor((center.x+radius)/tileSize));tx++){
    const points=paintSurfaceTile(projection,raster,options.flags,tx,ty);if(!points)continue;
    const key=ty*columns+tx,nearest=surface.cellSamples?.get(key),ranks=surface.sampleRanks?.get(key);
    for(let i=0;i<points.length;i+=3){
      if(nearest&&!nearest[i/3])continue;
      const dx=points[i]-center.x,dy=points[i+1]-center.y,distance=dx*dx+dy*dy,pixel=points[i+2];
      if(distance>radius*radius||mask&&!mask[pixel])continue;
      const gx=Math.min(cells-1,Math.max(0,Math.floor((dx+radius)/cell))),gy=Math.min(cells-1,Math.max(0,Math.floor((dy+radius)/cell))),g=gy*cells+gx,alpha=reference[pixel*4+3]/255;
      pickup[g*4]+=reference[pixel*4]*alpha;pickup[g*4+1]+=reference[pixel*4+1]*alpha;pickup[g*4+2]+=reference[pixel*4+2]*alpha;pickup[g*4+3]+=alpha;hits[g]++;
      const rank=ranks?.[i/3]??2,previous=texels.get(pixel);
      if(!previous||rank>previous.rank||rank===previous.rank&&distance<previous.distance)texels.set(pixel,{dx,dy,distance,rank});
    }
  }
  let changed=0;
  if(state.carry&&deposit>0){
    const color=[0,0,0,255],{carry,carried}=state;
    for(const [pixel,{dx,dy,distance}] of texels){
      // Bilinear read of the carried image, ignoring cells that carried nothing.
      const x=(dx+radius)/cell-.5,y=(dy+radius)/cell-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;let r=0,g=0,b=0,a=0,w=0;
      for(let j=0;j<2;j++)for(let k=0;k<2;k++){
        const cx=ix+k,cy=iy+j;if(cx<0||cy<0||cx>=cells||cy>=cells||!carried[cy*cells+cx])continue;
        const o=(cy*cells+cx)*4,weight=(k?fx:1-fx)*(j?fy:1-fy);r+=carry[o]*weight;g+=carry[o+1]*weight;b+=carry[o+2]*weight;a+=carry[o+3]*weight;w+=weight;
      }
      if(w<1e-6||a<1e-6)continue;
      color[0]=Math.round(r/a);color[1]=Math.round(g/a);color[2]=Math.round(b/a);
      const amount=deposit*falloffAt(Math.sqrt(distance))*Math.min(1,a/w)*(mask?mask[pixel]/255:1);
      if(blendPaintPixel(raster.data,pixel*4,color,amount,'paint')){
        changed++;if(options.dirtyRows){const px=pixel%raster.width,row=Math.floor(pixel/raster.width)*2;options.dirtyRows[row]=Math.min(options.dirtyRows[row],px);options.dirtyRows[row+1]=Math.max(options.dirtyRows[row+1],px);}
      }
    }
  }
  // Pick the surface back up. The rim of a soft brush mostly takes fresh
  // colour, so smears fade at their sides instead of leaving a hard outline.
  const carry=state.carry||new Float32Array(cells*cells*4),carried=state.carried||new Uint8Array(cells*cells);
  for(let g=0;g<cells*cells;g++){
    if(!hits[g])continue;
    const gx=g%cells,gy=Math.floor(g/cells),hold=carried[g]?keep*falloffAt(Math.hypot((gx+.5)*cell-radius,(gy+.5)*cell-radius)):0;
    for(let c=0;c<4;c++)carry[g*4+c]=carry[g*4+c]*hold+pickup[g*4+c]/hits[g]*(1-hold);
    carried[g]=1;
  }
  state.carry=carry;state.carried=carried;state.last={x:center.x,y:center.y};
  return changed;
}
