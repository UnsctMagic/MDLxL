import {scaleValue} from './fx-own-looks.js';
import {Vector3} from 'three';
import {constantTrack} from './plain-track-values.js';

/** Opt in only after a placement edit; old saved upper/lower values keep their original compiler. */
export function withEmitterPlacement(previous,next){
 if(previous.type!=='Particles')return next;
 return {...next,placement:previous.placement||{upper:previous.upper,lower:previous.lower}};
}
/** Two perpendicular axes across the part's length, shared by the handles and compiler. */
export function emitterFormationAxes(frame){
 const width=Math.abs(frame.axis.x)<.8?new Vector3(1,0,0):new Vector3(0,1,0);
 width.addScaledVector(frame.axis,-width.dot(frame.axis)).normalize();
 return [width,new Vector3().crossVectors(frame.axis,width)];
}
export const emitterFormationCenter=(frame,layer)=>layer.ground?new Vector3(0,0,1.5):frame.center;
export function layerEmitterPoint(frame,layer,point){
 const at=point.clone();
 if(layer.placement){
  const centre=emitterFormationCenter(frame,layer),along=at.clone().sub(centre).dot(frame.axis);
  const base=layer.placement,span=base.upper+base.lower;
  const fitted=span>0?-layer.lower+(layer.upper+layer.lower)*(along+base.lower)/span:(layer.upper-layer.lower)/2;
  at.addScaledVector(frame.axis,fitted-along);
  if(layer.formationWidth!=null||layer.formationDepth!=null){
   const [width,depth]=emitterFormationAxes(frame),delta=at.clone().sub(centre);
   at.addScaledVector(width,delta.dot(width)*((layer.formationWidth??1)-1));
   at.addScaledVector(depth,delta.dot(depth)*((layer.formationDepth??1)-1));
  }
  if(layer.formation!=null)at.sub(centre).multiplyScalar(layer.formation).add(centre);
 }
 return at.add(new Vector3(...layer.offset));
}


const QUICK_NATIVE={tint:['SegmentColor'],size:['ParticleScaling','Width','Length'],spriteSize:['ParticleScaling'],lasts:['LifeSpan'],amount:['EmissionRate'],velocity:['Speed'],gravity:['Gravity'],strength:['Alpha']};
/** Per-site values never replace the shared layer defaults. */
export function individualEmitterLayer(layer,key){
 if(!layer)return layer;
 const values=layer.individuals?.[key]?.values;
 if(!values)return layer;
 const result={...layer,...values,native:{...layer.native,...values.native}};
 for(const [quick,fields] of Object.entries(QUICK_NATIVE))if(Object.hasOwn(values,quick))for(const field of fields)if(!Object.hasOwn(values.native||{},field))delete result.native[field];
 return result;
}
export function withIndividualEmitter(layer,key,previous,next,touched){
 const record=layer.individuals?.[key]||{},values={...record.values,...(record.values?.native?{native:{...record.values.native}}:{})};
 for(const field of ['tint','size','spriteSize','lasts','amount','strength','particleStrength','opacityBase','velocity','gravity','spread','burstGap','burstWindow']){
  if(field!==touched&&JSON.stringify(previous[field])===JSON.stringify(next[field]))continue;
  if(next[field]===undefined)delete values[field];else values[field]=structuredClone(next[field]);
  for(const native of QUICK_NATIVE[field]||[])if(values.native)delete values.native[native];
 }
 if(JSON.stringify(previous.native)!==JSON.stringify(next.native)){
  values.native={...values.native};
  for(const field of new Set([...Object.keys(previous.native||{}),...Object.keys(next.native||{})])){
   if(JSON.stringify(previous.native?.[field])===JSON.stringify(next.native?.[field]))continue;
   if(next.native?.[field]===undefined)delete values.native[field];else values.native[field]=structuredClone(next.native[field]);
  }
 }
 const changedNative=Object.keys(next.native||{}).filter(field=>JSON.stringify(previous.native?.[field])!==JSON.stringify(next.native?.[field]));
 const groupFields=(record.groupFields||[]).filter(field=>!changedNative.includes(field)&&!Object.entries(QUICK_NATIVE).some(([quick,fields])=>fields.includes(field)&&JSON.stringify(previous[quick])!==JSON.stringify(next[quick])));
 return {...layer,individuals:{...layer.individuals,[key]:{...record,values,...(record.groupFields?{groupFields}:{})}}};
}
export function withEmitterPosition(layer,key,position,attachmentPoint){
 const record=layer.individuals?.[key]||{};
 return {...layer,individuals:{...layer.individuals,[key]:{...record,...(attachmentPoint?{attachmentPoint:record.attachmentPoint||[...attachmentPoint]}:{}),position:[...position]}}};
}
export function emitterSitePoint(frame,layer,key,point){
 const own=layer.individuals?.[key]?.position;
 return own?new Vector3(...own):layerEmitterPoint(frame,layer,point);
}


/** Static aim stays portable in the stack and compiles to valid Warcraft keys. */
export function emitterRotationTrack(model,rotation){
 return Array.isArray(rotation)?constantTrack(model,rotation):rotation;
}
export function withEmitterAim(layer,key,rotation){
 const current=individualEmitterLayer(layer,key);
 const next={...current,native:{...current.native,Rotation:rotation}};
 return key?withIndividualEmitter(layer,key,current,next):{...next,individuals:layer.individuals||{}};
}

const VALUE_GROUPS=[['tint','native.SegmentColor'],['strength','particleStrength','opacityBase','native.Alpha'],['lasts','native.LifeSpan'],['amount','native.EmissionRate'],['velocity','native.Speed'],['gravity','native.Gravity'],['spread','native.Latitude'],['burstGap'],['burstWindow'],['size','spriteSize','native.ParticleScaling']];
const at=(value,key)=>key.startsWith('native.')?value.native?.[key.slice(7)]:value[key];
function touchedEmitterFields(previous,next){
 const fields=new Set([...VALUE_GROUPS.flat(),...Object.keys(previous.native||{}).map(k=>'native.'+k),...Object.keys(next.native||{}).map(k=>'native.'+k)]),changed=new Set([...fields].filter(k=>JSON.stringify(at(previous,k))!==JSON.stringify(at(next,k))));
 for(const field of ['size','velocity','gravity'])
  if(!!previous.fireFit?.[field+'Edited']!==!!next.fireFit?.[field+'Edited'])changed.add(field);
 // The quick Size changes sprite and spawn area; native Width and Length are independent edits.
 if(changed.has('size')){changed.add('native.Width');changed.add('native.Length');}
 for(const group of VALUE_GROUPS)if(group.some(k=>changed.has(k)))for(const key of group)changed.add(key);
 const position=['offset','upper','lower','formation'].some(k=>JSON.stringify(previous[k])!==JSON.stringify(next[k]))
  ||['formationWidth','formationDepth'].some(k=>(previous[k]??1)!==(next[k]??1));
 return {changed,position};
}
const hasIndividualField=(record,field)=>!record?.groupFields?.includes(field)&&(record?.values?.native?.[field]!==undefined||Object.entries(QUICK_NATIVE).some(([quick,fields])=>fields.includes(field)&&record?.values?.[quick]!==undefined));
export function clearGroupFieldEdits(previous,next){
 const {changed}=touchedEmitterFields(previous,next);
 if(!changed.size||!Object.values(next.individuals||{}).some(record=>record.groupFields?.some(field=>changed.has('native.'+field))))return next;
 const individuals=structuredClone(next.individuals||{});
 for(const record of Object.values(individuals)){
  const cleared=(record.groupFields||[]).filter(field=>changed.has('native.'+field));
  for(const field of cleared)if(record.values?.native)delete record.values.native[field];
  if(cleared.includes('Alpha')&&record.values){delete record.values.opacityBase;delete record.values.particleStrength;}
  if(cleared.length)record.groupFields=record.groupFields.filter(field=>!cleared.includes(field));
 }
 return {...next,individuals};
}
export function emitterEditOverlaps(previous,next,operation){
 if(operation?.layerId===previous.id)return operation.sites.some(key=>{const record=previous.individuals?.[key];return !record?.deleted&&hasIndividualField(record,operation.field);});
 const {changed,position}=touchedEmitterFields(previous,next);
 return Object.values(previous.individuals||{}).some(record=>!record.deleted&&(position&&record.position||[...changed].some(k=>k.startsWith('native.')?hasIndividualField(record,k.slice(7)):at(record.values||{},k)!==undefined&&!QUICK_NATIVE[k]?.every(field=>record.groupFields?.includes(field)))));
}
export function resolveEmitterEdit(previous,next,applyAll,operation){
 if(operation?.layerId===previous.id){
  if(applyAll)return next;
  const individuals=structuredClone(next.individuals||{});
  for(const key of operation.sites){
   const record=previous.individuals?.[key];
   if(record?.deleted||!hasIndividualField(record,operation.field))continue;
   individuals[key].values.native[operation.field]=structuredClone(operation.baselines[key]);
   individuals[key].groupFields=(individuals[key].groupFields||[]).filter(field=>field!==operation.field);
   if(operation.field==='Alpha')for(const field of ['opacityBase','particleStrength']){if(record.values[field]===undefined)delete individuals[key].values[field];else individuals[key].values[field]=structuredClone(record.values[field]);}
  }
  return {...next,individuals};
 }

 // The caller already cleared only group-produced bindings. True individual
 // records are unchanged; restoring the entire old map would mask the edit again.
 if(!applyAll)return next;
 const {changed,position}=touchedEmitterFields(previous,next),individuals=structuredClone(previous.individuals||{});
 const aimOnly=!position&&changed.size===1&&changed.has('native.Rotation');
 for(const [key,record] of Object.entries(individuals)){
  if(record.deleted)continue;
  if(!aimOnly){delete record.position;delete record.surface;delete record.attachmentPoint;}
  for(const field of changed)if(field.startsWith('native.')){if(record.values?.native)delete record.values.native[field.slice(7)];}else if(record.values)delete record.values[field];
  if(record.values?.native&&!Object.keys(record.values.native).length)delete record.values.native;
  if(record.values&&!Object.keys(record.values).length)delete record.values;
  if(!Object.keys(record).length)delete individuals[key];
 }
 return {...next,individuals};
}
export const MAX_EMITTER_SITES=64;

/** Retain inactive sites and their records so lowering the count is reversible. */
export function withEmitterSiteCount(layer,result,count){
 const sites=result.sites.map(site=>layer.siteLayout?site:{...site,refit:true});
 const siteRateScale=layer.siteRateScale??result.siteRateScale??1;
 let available=sites.filter(site=>!layer.individuals?.[site.key]?.deleted).length;
 const keys=new Set(sites.map(site=>site.key));
 for(let ordinal=1;available<count;ordinal++){
  const key='extra'+ordinal;
  if(keys.has(key))continue;
  keys.add(key);sites.push({key,refit:true});available++;
 }
 // A slider change deliberately redistributes the live sites.
 const {activeSiteKeys:_active,...shared}=layer;
 const individuals=structuredClone(layer.individuals||{});
 const previousCount=layer.groupRateCount||result.ids?.length||layer.siteCount||1;
 if(count>0)for(const record of Object.values(individuals))if(record.groupFields?.includes('EmissionRate')&&record.values?.native?.EmissionRate!=null)
  record.values.native.EmissionRate=scaleValue(record.values.native.EmissionRate,previousCount/count);
 return {...shared,siteCount:count,siteLayout:sites,individuals,...(layer.groupRateCount?{groupRateCount:count||previousCount}:{}),
  ...(layer.nativeSpec&&siteRateScale!==1?{siteRateScale}:{})};
}

export function activeEmitterSites(layer,sites){
 if(!Number.isInteger(layer.siteCount))return null;
 const available=sites.filter(site=>!layer.individuals?.[site.key]?.deleted);
 const count=Math.max(0,layer.siteCount);
 if(!count)return new Set();
 if(count>=available.length)return new Set(available.map(site=>site.key));

 // Explicit Delete keeps the other live keys. Ignore stale or deleted keys.
 const retained=new Set(Array.isArray(layer.activeSiteKeys)?layer.activeSiteKeys:[]),active=new Set();
 const fill=choices=>{
  for(const site of choices){
   if(active.size===count)break;
   active.add(site.key);
  }
  return active;
 };
 fill(available.filter(site=>retained.has(site.key)));
 if(active.size===count)return active;

 // Use the stored offer, so moving or snapping an emitter never changes
 // which keys are active. The compiler completes extra slots before ranking.
 const candidates=available.filter(site=>site.point?.length===3&&site.point.every(Number.isFinite))
  .map(site=>({key:site.key,point:new Vector3(...site.point)}));
 if(candidates.length<=count){
  fill(candidates);
  return fill(available);
 }
 if(count===1){
  const centre=candidates.reduce((sum,site)=>sum.add(site.point),new Vector3()).multiplyScalar(1/candidates.length);
  const closest=candidates.reduce((best,site)=>site.point.distanceToSquared(centre)<best.point.distanceToSquared(centre)?site:best);
  return new Set([closest.key]);
 }

 // Cover the greatest span first, then fill the largest remaining gaps.
 // Strict comparisons keep ties in the original layout order.
 if(!active.size){
  let first=0,second=1,span=-1;
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
   const distance=candidates[i].point.distanceToSquared(candidates[j].point);
   if(distance>span){first=i;second=j;span=distance;}
  }
  active.add(candidates[first].key);active.add(candidates[second].key);
 }
 const anchors=candidates.filter(site=>active.has(site.key));
 const nearest=candidates.map(site=>anchors.reduce((distance,anchor)=>Math.min(distance,site.point.distanceToSquared(anchor.point)),Infinity));
 while(active.size<count){
  let next=-1;
  for(let i=0;i<candidates.length;i++)
   if(!active.has(candidates[i].key)&&(next<0||nearest[i]>nearest[next]))next=i;
  if(next<0)break;
  const site=candidates[next];
  active.add(site.key);
  candidates.forEach((other,i)=>{nearest[i]=Math.min(nearest[i],site.point.distanceToSquared(other.point));});
 }
 return fill(available);
}
export function deleteEmitterSite(layer,key,sites=layer.siteLayout||[]){
 const individual={...layer.individuals?.[key],deleted:true};
 const active=activeEmitterSites(layer,sites);
 const count=active?{siteCount:Math.max(0,layer.siteCount-1)}:{};
 if(active?.delete(key))count.activeSiteKeys=[...active];
 return {...layer,...count,individuals:{...layer.individuals,[key]:individual}};
}

/** Bake the current formation, including width and depth, into stable sites across recipe changes. */
export function replaceEmitter(layer,next,graph){
 const compiled=graph.layers[layer.id]?.sites;
 const sites=compiled?.length?compiled:layer.siteLayout||[];
 const active=activeEmitterSites(layer,sites);
 const siteRateScale=active&&next.nativeSpec?(layer.nativeSpec?layer.siteRateScale??1:Math.max(1,active.size)):1;
 const count=active?{siteCount:layer.siteCount,activeSiteKeys:[...active],...(siteRateScale!==1?{siteRateScale}:{})}:{};
 if(!sites.length)return {...next,...count,enabled:layer.enabled,offset:layer.offset,upper:layer.upper,lower:layer.lower};
 return {...next,...count,enabled:layer.enabled,offset:[0,0,0],upper:layer.upper,lower:layer.lower,placement:{upper:layer.upper,lower:layer.lower},formation:1,
  siteLayout:sites.map(site=>site.point?{...site,ground:site.ground??!!layer.ground,point:layerEmitterPoint(graph.frame,layer,new Vector3(...site.point)).toArray()}:site),
  ...(layer.individuals?{individuals:structuredClone(layer.individuals)}:{})};
}
