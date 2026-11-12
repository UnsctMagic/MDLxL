// The model-unit sizes makeLayer derives from the part a layer is fitted to. DOM-free so saved looks can be refitted to another part.
export const LAYER_UNIT_FALLBACK=[1,24,.12,1,0,1];
/** Sizes taken from a part frame ({length,girth,radius}, or a split frame, whose first region is used). */
export function layerBasis(frame){
 // Sizes come from the part's longest skin region: the first region can be a small piece (a buckle on a body).
 const tall=frame.unitHeight;
 frame=frame.regions?.length?frame.regions.reduce((a,b)=>b.frame.length>a.frame.length?b:a).frame:frame;
 const {length,girth,radius}=frame,unit=Math.max(1,Math.min(length*.23,Math.max(length*.055,girth*.82)));
 const properties={
  flame:[7,104,.46,unit*2.2,-unit*9,Math.min(length*.19,unit*2.38)],embers:[4,46,.72,unit*3.6,-unit*5,unit*.40],
  crackle:[3,4,.40,unit*6.2,0,unit*2.25],sparks:[4,58,.38,unit*6,unit*.5,unit*.45],mist:[5,22,1.18,-unit*.52,unit*2.5,unit*1.72],
  drops:[4,7,.69,-unit*.5,unit*7,unit*.33],motes:[4,11,1.05,unit*.7,-unit*.35,unit*.53],
  flies:[5,5,.09,0,0,Math.max(2.1,Math.min(8,length*.066+radius*.037))],
 };
 return {length,girth,radius,unit,properties,runeSize:Math.min(girth,length*.29)*1.35,flySize:Math.max(radius*1.12,length*.32),
  // Fly swarm (native Flies.mdx technique): fly size from the unit's height, the swarm from the part's main piece.
  swarmRadius:Math.max(radius*.9,length*.3),flyQuad:flyQuadSize(tall??Math.max(length,radius*2)*1.5)};
}
/** Default fly width: about 7% of the unit's height, kept between 10 and 22 units whatever the swarm's size. */
export const flyQuadSize=height=>Math.max(10,Math.min(22,(Number(height)||0)*.07));
/** Default swarm radius: the part's main piece, but never so small that flies of that size crowd into one blot. */
export const swarmRadiusFor=(basis,flyQuad=basis.flyQuad)=>Math.max(basis.swarmRadius,flyQuad*4);
/** The unit's height from its Stand bounds (or the model's), or null when the model stores none. */
export function unitHeight(model){
 const sane=item=>item?.MinimumExtent&&item?.MaximumExtent&&[0,1,2].every(k=>Math.abs(item.MinimumExtent[k])<1e7&&Math.abs(item.MaximumExtent[k])<1e7)&&item.MaximumExtent[2]>item.MinimumExtent[2];
 const stand=(model?.Sequences||[]).find(s=>/^stand/i.test(s.Name||'')&&sane(s));
 const item=stand||(sane(model?.Info)?model.Info:null);
 return item?item.MaximumExtent[2]-item.MinimumExtent[2]:null;
}
