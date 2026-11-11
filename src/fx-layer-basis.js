// The model-unit sizes makeLayer derives from the part a layer is fitted to. DOM-free so saved looks can be refitted to another part.
export const LAYER_UNIT_FALLBACK=[1,24,.12,1,0,1];
/** Sizes taken from a part frame ({length,girth,radius}, or a split frame, whose first region is used). */
export function layerBasis(frame){
 frame=frame.regions?.[0]?.frame||frame;
 const {length,girth,radius}=frame,unit=Math.max(1,Math.min(length*.23,Math.max(length*.055,girth*.82)));
 const properties={
  flame:[7,104,.46,unit*2.2,-unit*9,Math.min(length*.19,unit*2.38)],embers:[4,46,.72,unit*3.6,-unit*5,unit*.40],
  crackle:[3,4,.40,unit*6.2,0,unit*2.25],sparks:[4,58,.38,unit*6,unit*.5,unit*.45],mist:[5,22,1.18,-unit*.52,unit*2.5,unit*1.72],
  drops:[4,7,.69,-unit*.5,unit*7,unit*.33],motes:[4,11,1.05,unit*.7,-unit*.35,unit*.53],
  flies:[5,5,.09,0,0,Math.max(2.1,Math.min(8,length*.066+radius*.037))],
 };
 return {length,girth,radius,unit,properties,runeSize:Math.min(girth,length*.29)*1.35,flySize:Math.max(radius*1.12,length*.32)};
}
