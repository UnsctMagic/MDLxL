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


const VALUE_GROUPS=[['tint','native.SegmentColor'],['strength','particleStrength','opacityBase','native.Alpha'],['lasts','native.LifeSpan'],['amount','native.EmissionRate'],['velocity','native.Speed'],['gravity','native.Gravity'],['size','spriteSize','native.ParticleScaling','native.Width','native.Length']];
const at=(value,key)=>key.startsWith('native.')?value.native?.[key.slice(7)]:value[key];
function touchedEmitterFields(previous,next){
 const fields=new Set([...VALUE_GROUPS.flat(),...Object.keys(previous.native||{}).map(k=>'native.'+k),...Object.keys(next.native||{}).map(k=>'native.'+k)]),changed=new Set([...fields].filter(k=>JSON.stringify(at(previous,k))!==JSON.stringify(at(next,k))));
 for(const group of VALUE_GROUPS)if(group.some(k=>changed.has(k)))for(const key of group)changed.add(key);
 const position=['offset','upper','lower','formation'].some(k=>JSON.stringify(previous[k])!==JSON.stringify(next[k]));
 return {changed,position};
}
export function emitterEditOverlaps(previous,next){
 const {changed,position}=touchedEmitterFields(previous,next);
 return Object.values(previous.individuals||{}).some(record=>!record.deleted&&(position&&record.position||[...changed].some(k=>at(record.values||{},k)!==undefined)));
}
export function resolveEmitterEdit(previous,next,applyAll){
 if(!applyAll)return next;
 const {changed}=touchedEmitterFields(previous,next),individuals=structuredClone(previous.individuals||{});
 for(const [key,record] of Object.entries(individuals)){
  if(record.deleted)continue;
  delete record.position;delete record.surface;
  for(const field of changed)if(field.startsWith('native.')){if(record.values?.native)delete record.values.native[field.slice(7)];}else if(record.values)delete record.values[field];
  if(record.values?.native&&!Object.keys(record.values.native).length)delete record.values.native;
  if(record.values&&!Object.keys(record.values).length)delete record.values;
  if(!Object.keys(record).length)delete individuals[key];
 }
 return {...next,individuals};
}
/** Freeze the current automatic offer, retaining its stable sites across recipe changes. */
export function replaceEmitter(layer,next,graph){
 const sites=graph.layers[layer.id]?.sites||[];
 if(!sites.length)return {...next,enabled:layer.enabled,offset:layer.offset,upper:layer.upper,lower:layer.lower};
 return {...next,enabled:layer.enabled,offset:[0,0,0],upper:layer.upper,lower:layer.lower,placement:{upper:layer.upper,lower:layer.lower},formation:1,
  siteLayout:sites.map(site=>({...site,ground:site.ground??!!layer.ground,point:layerEmitterPoint(graph.frame,layer,new Vector3(...site.point)).toArray()})),...(layer.individuals?{individuals:structuredClone(layer.individuals)}:{})};
}
