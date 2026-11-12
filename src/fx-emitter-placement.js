import {Vector3} from 'three';

/** Opt in only after a placement edit; old saved upper/lower values keep their original compiler. */
export function withEmitterPlacement(previous,next){
 if(previous.type!=='Particles')return next;
 return {...next,placement:previous.placement||{upper:previous.upper,lower:previous.lower}};
}
export function layerEmitterPoint(frame,layer,point){
 const at=point.clone();
 if(layer.placement){
  const centre=layer.ground?new Vector3(0,0,1.5):frame.center,along=at.clone().sub(centre).dot(frame.axis);
  const base=layer.placement,span=base.upper+base.lower;
  const fitted=span>0?-layer.lower+(layer.upper+layer.lower)*(along+base.lower)/span:(layer.upper-layer.lower)/2;
  at.addScaledVector(frame.axis,fitted-along);
  if(layer.formation!=null)at.sub(centre).multiplyScalar(layer.formation).add(centre);
 }
 return at.add(new Vector3(...layer.offset));
}


/** Per-site values never replace the shared layer defaults. */
export function individualEmitterLayer(layer,key){
 if(!layer)return layer;
 const values=layer.individuals?.[key]?.values;
 if(!values)return layer;
 const result={...layer,...values,native:{...layer.native,...values.native}};
 if(Object.hasOwn(values,'tint')&&!Object.hasOwn(values.native||{},'SegmentColor'))delete result.native.SegmentColor;
 return result;
}
export function withIndividualEmitter(layer,key,previous,next){
 const record=layer.individuals?.[key]||{},values={...record.values};
 for(const field of ['tint','size','spriteSize','lasts','amount','strength','particleStrength','opacityBase','velocity','gravity','spread','burstGap','burstWindow']){
  if(JSON.stringify(previous[field])===JSON.stringify(next[field]))continue;
  if(next[field]===undefined)delete values[field];else values[field]=structuredClone(next[field]);
 }
 if(JSON.stringify(previous.native)!==JSON.stringify(next.native)){
  values.native={...values.native};
  for(const field of new Set([...Object.keys(previous.native||{}),...Object.keys(next.native||{})])){
   if(JSON.stringify(previous.native?.[field])===JSON.stringify(next.native?.[field]))continue;
   if(next.native?.[field]===undefined)delete values.native[field];else values.native[field]=structuredClone(next.native[field]);
  }
 }
 return {...layer,individuals:{...layer.individuals,[key]:{...record,values}}};
}
export function withEmitterPosition(layer,key,position){
 return {...layer,individuals:{...layer.individuals,[key]:{...layer.individuals?.[key],position:[...position]}}};
}
export function emitterSitePoint(frame,layer,key,point){
 const own=layer.individuals?.[key]?.position;
 return own?new Vector3(...own):layerEmitterPoint(frame,layer,point);
}

