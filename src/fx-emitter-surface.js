import {Box3,Vector3} from 'three';
import {physicalSurfaceComponents} from './geoset-operations.js';
import {weaponStripFrame} from './particle-ribbon-fit.js';
import {clamp,clamp01} from './math.js';

export const SURFACE_FIT_VERSION=1;
const UP=new Vector3(0,0,1);
const EPS=1e-8;
const MAX_SITES=16;

/** Freeze the recipe inputs that determine the default site count and clearance. */
export function surfaceFitInputs(layer,basis) {
 const spec=layer.nativeSpec;
 const radius=clamp(basis.length*.48,2,55);
 const sizes=layer.native?.ParticleScaling || spec?.size?.map(size=>size*radius*layer.size) || [layer.size];
 const alpha=layer.native?.Alpha || spec?.alpha;
 const visible=Array.from(sizes).filter((_,i)=>!alpha||alpha[i]>0);
 const footprint=Math.max(1,...(visible.length?visible:sizes));
 const rate=spec?(spec.rate??8)*layer.amount/24:layer.amount;
 const liveParticles=rate*(spec?.life??layer.lasts);
 // A compact multi-emitter recipe shares one surface anchor across its layers.
 if(layer.focusedEmitter)return {version:SURFACE_FIT_VERSION,footprint:Math.max(1,basis.length*.1),liveParticles:4};
 return {version:SURFACE_FIT_VERSION,footprint,liveParticles};
}

function weightedCentre(triangles,area) {
 return triangles.reduce((centre,triangle)=>centre.addScaledVector(triangle.centre,triangle.area),new Vector3()).multiplyScalar(1/area);
}

/** Analyse physical components once per selected surface. Retain the source triangles for skin attachment. */
export function analyseEmitterSurface(geometry) {
 if(!geometry.Faces?.length)return null;
 const vertices=Array.from({length:geometry.Vertices.length/3},(_,i)=>new Vector3().fromArray(geometry.Vertices,i*3));
 const positions=vertices.map(point=>point.toArray().map(value=>Math.round(value*1000)).join(','));
 const seen=new Set(),components=[];
 const bounds=new Box3();
 for(const part of physicalSurfaceComponents(geometry)){
  const triangles=[];
  for(const index of part.faceIndices){
   const ids=Array.from(geometry.Faces.subarray(index*3,index*3+3));
   const key=ids.map(id=>positions[id]).sort().join('|');
   if(seen.has(key))continue;
   const points=ids.map(id=>vertices[id]);
   const [a,b,c]=points;
   const normal=b.clone().sub(a).cross(c.clone().sub(a));
   const twiceArea=normal.length();
   if(!(twiceArea>EPS))continue;
   seen.add(key);
   triangles.push({index,ids,points,area:twiceArea*.5,normal:normal.multiplyScalar(1/twiceArea),
    centre:a.clone().add(b).add(c).multiplyScalar(1/3)});
  }
  if(!triangles.length)continue;
  const usedVertices=new Set(triangles.flatMap(triangle=>triangle.ids));
  const points=[...usedVertices].map(id=>vertices[id]);
  const frame=weaponStripFrame(points.map(point=>point.toArray()));
  const box=new Box3().setFromPoints(points);
  const area=triangles.reduce((sum,triangle)=>sum+triangle.area,0);
  const centre=weightedCentre(triangles,area);
  const span=box.getSize(new Vector3());
  bounds.union(box);
  const component={triangles,frame,area,centre,span};
  // Shape classification is geometry-only. Share it between every recipe on this part.
  component.radius=frame?stripRadius(component):0;
  components.push(component);
 }
 if(!components.length)return null;
 const area=components.reduce((sum,part)=>sum+part.area,0);
 const centre=components.reduce((sum,part)=>sum.addScaledVector(part.centre,part.area),new Vector3()).multiplyScalar(1/area);
 return {components,area,centre,bounds,span:bounds.getSize(new Vector3())};
}

// Use the area-weighted outer radius across the whole strip, so bevels and
// tessellation do not turn the middle slice of a broad object into a blade.
function stripRadius(part) {
 const {frame,triangles,area}=part;
 const radii=triangles.flatMap(triangle=>triangle.points.map(point=>{
  const delta=point.clone().sub(frame.center);
  const along=delta.dot(frame.axis);
  return {radius:Math.sqrt(Math.max(0,delta.lengthSq()-along*along)),weight:triangle.area/3};
 })).sort((a,b)=>a.radius-b.radius);
 let covered=0;
 for(const sample of radii){
  covered+=sample.weight;
  if(covered>=area*.90)return sample.radius;
 }
 return radii.at(-1).radius;
}

function pointOnTriangle(triangle,barycentric) {
 return triangle.points.reduce((point,vertex,i)=>point.addScaledVector(vertex,barycentric[i]),new Vector3());
}

/** Return the midpoint of a triangle's actual cross-section, in barycentric coordinates. */
function triangleSection(triangle,along,station) {
 const offsets=along.map(value=>value-station),hits=[];
 for(let i=0;i<3;i++){
  const j=(i+1)%3;
  if(Math.abs(offsets[i])<EPS){
   const barycentric=[0,0,0];barycentric[i]=1;
   hits.push(barycentric);
  }else if(offsets[i]*offsets[j]<0&&Math.abs(offsets[j])>=EPS){
   const t=offsets[i]/(offsets[i]-offsets[j]);
   const barycentric=[0,0,0];barycentric[i]=1-t;barycentric[j]=t;
   hits.push(barycentric);
  }
 }
 if(!hits.length)return null;
 const barycentric=[0,1,2].map(i=>hits.reduce((sum,hit)=>sum+hit[i],0)/hits.length);
 const weight=hits.length===2?pointOnTriangle(triangle,hits[0]).distanceTo(pointOnTriangle(triangle,hits[1])):
  hits.length===3?Math.sqrt(triangle.area):EPS;
 return {triangle,barycentric,weight,point:pointOnTriangle(triangle,barycentric)};
}

function stripSites(part,count,footprint,stationAt) {
 const {axis,center,length}=part.frame;
 const direction=Math.abs(axis.z)<.9?UP.clone():new Vector3(1,0,0);
 direction.addScaledVector(axis,-direction.dot(axis)).normalize();
 const spans=part.triangles.map(triangle=>{
  const along=triangle.points.map(point=>point.clone().sub(center).dot(axis));
  return {triangle,along,min:Math.min(...along),max:Math.max(...along)};
 }).sort((a,b)=>a.min-b.min);
 const sites=[],active=new Set();
 let next=0;
 for(let i=0;i<count;i++){
  const station=stationAt?.(i)??(count===1?0:length*.9*(i/(count-1)-.5));
  while(next<spans.length&&spans[next].min<=station+EPS)active.add(spans[next++]);
  const section=[];
  for(const span of active){
   if(span.max<station-EPS){active.delete(span);continue;}
   const hit=triangleSection(span.triangle,span.along,station);
   if(hit)section.push(hit);
  }
  if(!section.length)continue;
  const weight=section.reduce((sum,hit)=>sum+hit.weight,0);
  const centre=section.reduce((sum,hit)=>sum.addScaledVector(hit.point,hit.weight),new Vector3()).multiplyScalar(1/weight);
  let best,score=-Infinity;
  for(const hit of section){
   const radial=hit.point.clone().sub(centre);
   const normal=hit.triangle.normal.clone().addScaledVector(axis,-hit.triangle.normal.dot(axis));
   if(normal.lengthSq()<EPS)continue;
   normal.normalize();
   const alignment=normal.dot(radial);
   if(alignment<-EPS||(Math.abs(alignment)<=EPS&&normal.dot(direction)<0))normal.negate();
   const exposure=radial.dot(direction)/Math.max(1,part.radius)+normal.dot(direction)*.35;
   if(exposure>score){best={...hit,normal};score=exposure;}
  }
  if(!best)best={...section[0],normal:direction};
  // The offset lies in the same axial plane as the sampled triangle.
  sites.push(siteAt(best,Math.max(.04,Math.min(footprint*.10,part.radius*.18)),{strip:true},part.radius));
 }
 return sites;
}

function siteAt({triangle,barycentric,point,normal},clearance,fit,componentWidth=fit?.radius) {
 return {
  point:point.clone().addScaledVector(normal,clearance).toArray(),
  vertices:triangle.ids,
  triangle:triangle.index,
  barycentric,
  fit,componentWidth,normal:normal.toArray()
 };
}

// A compact piece gets its own rim. A body spends its coverage on the upper
// lateral silhouette first, even if small pieces make up the visible shoulders.
function rimSites(shape,footprint,limit,unitHeight,tip) {
 const {components,centre,bounds,span}=shape;
 const across=span.y>=span.x*.8?'y':'x',other=across==='x'?'y':'x';
 const breadth=Math.max(bounds.max[across]-centre[across],centre[across]-bounds.min[across],EPS);
 const body=span.z>=Math.max(span.x,span.y)*.55&&span.z>=.43*(unitHeight||span.length());
 const spacing=Math.max(1,footprint*.88,span.length()*.12);
 const [first,second]=span.toArray().sort((a,b)=>b-a);
 const coverage=body?span[across]*.85+span[other]*.35:(first+second)*1.15;
 const count=Math.min(limit,Math.max(body?2:1,Math.round(coverage/spacing)));
 const grid=new Map(),cell=spacing*.34,extrema=new Map();
 const samples=tip?[[1,0,0],[0,1,0],[0,0,1]]:[[1/3,1/3,1/3],[.76,.12,.12],[.12,.76,.12],[.12,.12,.76]];
 for(const part of components){
  const partScale=Math.max(EPS,part.span.length()*.5);
  const importance=Math.min(1,Math.sqrt(part.area)/spacing)*.12;
  for(const triangle of part.triangles){
   // Include near-corner samples so sparse triangles still offer their rim.
   for(const barycentric of samples){
    const point=pointOnTriangle(triangle,barycentric);
    const radial=point.clone().sub(part.centre),normal=triangle.normal.clone();
    if(normal.dot(radial)<-EPS)normal.negate();
    const rim=clamp01(radial.length()/partScale);
    const outward=normal.dot(radial.normalize());
    const lateral=(point[across]-centre[across])/breadth;
    const height=(point.z-bounds.min.z)/Math.max(span.z,EPS);
    const shoulder=height>=.48&&Math.abs(lateral)>=.25;
    if(tip){
     const root=tip.pivotFor(triangle.ids,barycentric),distance=point.distanceToSquared(root);
     const side=tip.many?Math.sign(lateral):0,prior=extrema.get(side);
     const preferred=tip.many&&shoulder;
     if(!prior||preferred&&!prior.preferred||preferred===prior.preferred&&distance>prior.distance){
      const axis=part.frame?.axis,away=point.clone().sub(root);
      const direction=axis&&Math.abs(axis.dot(away))>EPS?axis.clone().multiplyScalar(Math.sign(axis.dot(away))):away.normalize();
      extrema.set(side,{triangle,barycentric,point,normal,distance,preferred,partScale,radius:part.radius,direction});
     }
     continue;
    }
    const upper=clamp01(1-Math.abs(height-.78)/.45);
    const exposure=.55*Math.max(0,outward)+.25*Math.max(0,normal.z);
    const score=rim+exposure+importance+(body?2.5*upper*Math.abs(lateral):.25*upper);
    const key=point.toArray().map(value=>Math.floor(value/cell)).join(',');
    if((grid.get(key)?.score??-Infinity)<score)
     grid.set(key,{triangle,barycentric,point,normal,score,lateral,shoulder,partScale,radius:part.radius});
   }
  }
 }
 if(tip){
  const sides=tip.many?[-1,1]:[0];
  const chosen=sides.map(side=>extrema.get(side)).filter(Boolean);
  if(!chosen.length&&extrema.has(0))chosen.push(extrema.get(0));
  return chosen.map(site=>({...siteAt(site,Math.max(.04,Math.min(footprint*.10,site.partScale*.12)),{radius:site.radius}),tipDirection:site.direction.toArray()}));
 }
 const candidates=[...grid.values()].sort((a,b)=>b.score-a.score);
 const shoulders=body?candidates.filter(candidate=>candidate.shoulder):[];
 const pool=shoulders.length?shoulders:candidates,chosen=[];
 const clear=candidate=>chosen.every(site=>site.point.distanceToSquared(candidate.point)>=spacing*spacing);
 if(shoulders.length&&count>1){
  for(const side of [-1,1]){
   const pick=pool.find(candidate=>candidate.lateral*side>0&&clear(candidate));
   if(pick)chosen.push(pick);
  }
 }
 for(const candidate of pool){
  if(chosen.length===count)break;
  if(clear(candidate))chosen.push(candidate);
 }
 return chosen.map(site=>siteAt(site,Math.max(.04,Math.min(footprint*.10,site.partScale*.12)),{radius:site.radius}));
}

function surfaceStrips(shape){
 return shape.components.filter(part=>part.frame&&part.area>=shape.area*.04&&part.frame.length>=5.2*Math.max(part.radius,EPS));
}

export function suggestTipEmitterSites(shape,pivotFor,unitHeight,many){
 if(!shape)return [];
 const strips=surfaceStrips(shape);
 const footprint=Math.max(1,shape.span.length()*.04);
 if(!many&&strips.reduce((sum,part)=>sum+part.area,0)>=shape.area*.65){
  const strip=strips.reduce((a,b)=>a.frame.length>=b.frame.length?a:b);
  const {axis,length}=strip.frame;
  const ends=stripSites(strip,2,footprint,i=>length*.45*(i?1:-1));
  if(ends.length===2){
   const distance=site=>new Vector3(...site.point).distanceToSquared(pivotFor(site.vertices,site.barycentric));
   const end=distance(ends[0])>distance(ends[1])?0:1;
   return [{...ends[end],tipDirection:axis.clone().multiplyScalar(end?1:-1).toArray()}];
  }
 }
 return rimSites(shape,footprint,many?2:1,unitHeight,{pivotFor,many});
}

export function suggestEmitterSites(shape,fit,unitHeight) {
 if(!shape)return [];
 const footprint=Math.max(1,fit.siteCount?shape.span.length()/fit.siteCount:fit.footprint);
 // Split one layer's existing emission budget while keeping enough live
 // particles at each site for a continuous effect.
 const limit=clamp(fit.siteCount??Math.floor(fit.liveParticles/4),1,MAX_SITES);
 const strips=surfaceStrips(shape).map(part=>({...part,count:1,desired:fit.siteCount??Math.max(1,Math.round(part.frame.length/footprint))}));
 if(strips.reduce((sum,part)=>sum+part.area,0)>=shape.area*.65){
  const active=strips.sort((a,b)=>b.frame.length-a.frame.length).slice(0,limit);
  for(let allocated=active.length;allocated<limit;allocated++){
   const next=active.filter(part=>part.count<part.desired).sort((a,b)=>b.frame.length/(b.count+1)-a.frame.length/(a.count+1))[0];
   if(!next)break;
   next.count++;
  }
  const sites=active.flatMap(part=>stripSites(part,part.count,footprint));
  if(sites.length)return sites;
 }
 return rimSites(shape,footprint,limit,unitHeight);
}

const siteDistance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
/** Extra slots use the same shape's coverage first, then sample other points on its triangles. */
export function suggestAdditionalEmitterSites(shape,fit,unitHeight,existing,needed,groundZ) {
 if(!shape)return [];
 const occupied=existing.slice(),added=[];
 const ground=site=>groundZ==null?site:{point:[site.point[0],site.point[1],groundZ]};
 const append=site=>{
  if(occupied.some(point=>siteDistance(site.point,point)<.0001))return;
  occupied.push(site.point);added.push(site);
 };
 // On a refitted own look, start with the ordinary suggestion for this new part.
 if(!occupied.length){
  for(const site of suggestEmitterSites(shape,fit,unitHeight)){
   if(added.length===needed)break;
   append(ground(site));
  }
 }
 const spread=candidates=>{
  const open=candidates.map(ground).map(site=>({site,space:occupied.reduce((nearest,point)=>Math.min(nearest,siteDistance(site.point,point)),Infinity)}));
  while(open.length&&added.length<needed){
   let best=0;
   for(let i=1;i<open.length;i++)if(open[i].space>open[best].space)best=i;
   const [{site,space}]=open.splice(best,1);
   if(space<.0001)break;
   append(site);
   for(const candidate of open)candidate.space=Math.min(candidate.space,siteDistance(candidate.site.point,site.point));
  }
 };
 if(added.length<needed)spread(suggestEmitterSites(shape,{...fit,footprint:Math.max(1,fit.footprint*.55),liveParticles:MAX_SITES*4},unitHeight));
 if(added.length===needed)return added;

 // Bounded, area-weighted samples also cover sparsely triangulated meshes.
 const faces=shape.components.flatMap(part=>part.triangles.map(triangle=>({part,triangle})));
 const grid=[];
 for(let a=1;a<=12;a++)for(let b=1;b<=13-a;b++)grid.push([a/14,b/14,(14-a-b)/14]);
 const sampleCount=Math.max(256,needed*8),pool=[];
 let index=0,cumulative=faces[0].triangle.area;
 for(let i=0;i<sampleCount;i++){
  const area=(i+.5)*shape.area/sampleCount;
  while(cumulative<area&&index+1<faces.length)cumulative+=faces[++index].triangle.area;
  const {part,triangle}=faces[index],barycentric=grid[i%grid.length];
  const point=pointOnTriangle(triangle,barycentric),normal=triangle.normal.clone();
  if(normal.dot(point.clone().sub(part.centre))<0)normal.negate();
  pool.push(siteAt({triangle,barycentric,point,normal},Math.max(.04,Math.min(fit.footprint*.1,part.span.length()*.06)),undefined,part.radius));
 }
 spread(pool);
 return added;
}
