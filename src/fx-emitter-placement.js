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
 }
 return at.add(new Vector3(...layer.offset));
}

