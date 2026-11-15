import {Box3,Vector3} from 'three';
import {physicalSurfaceComponents} from './geoset-operations.js';
import {weaponStripFrame} from './particle-ribbon-fit.js';
import {clamp,clamp01} from './math.js';
export {SURFACE_FIT_VERSION,surfaceFitInputs} from './fx-surface-fit.js';

const UP=new Vector3(0,0,1);
const EPS=1e-8;
const MAX_SITES=16;

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

/**
 * The cross-section of points about a line: its thin and wide directions (both
 * perpendicular to the axis) and how far the points reach along each.
 */
export function crossSection(points,centre,axis) {
 const e1=(Math.abs(axis.z)<.9?UP.clone():new Vector3(1,0,0)).addScaledVector(axis,-(Math.abs(axis.z)<.9?axis.z:axis.x)).normalize();
 const e2=axis.clone().cross(e1).normalize();
 const flat=points.map(point=>{const delta=point.clone().sub(centre);return [delta.dot(e1),delta.dot(e2)];});
 let xx=0,xy=0,yy=0;
 for(const [x,y] of flat){xx+=x*x;xy+=x*y;yy+=y*y;}
 const angle=.5*Math.atan2(2*xy,xx-yy),cos=Math.cos(angle),sin=Math.sin(angle);
 const wide=e1.clone().multiplyScalar(cos).addScaledVector(e2,sin),thin=e1.clone().multiplyScalar(-sin).addScaledVector(e2,cos);
 const reach=direction=>points.reduce((most,point)=>Math.max(most,point.clone().sub(centre).dot(direction)),0);
 const sides=[thin,thin.clone().negate(),wide,wide.clone().negate()].map(direction=>({direction,reach:reach(direction)}));
 return {sides,thin:Math.max(sides[0].reach,sides[1].reach),wide:Math.max(sides[2].reach,sides[3].reach)};
}

/**
 * One compact source around the part's head: the widest mass of its far half
 * (the outer part of a blade, a mace or axe head), or the top of a body. The
 * sites surround the head, so the sprites merge into one source from any side.
 */
export function suggestHeadEmitterSites(points,axis,many) {
 if(points.length<3)return null;
 const toward=many?UP.clone():axis.clone().normalize();
 const along=points.map(point=>point.dot(toward));
 const min=Math.min(...along),max=Math.max(...along),length=max-min;
 if(!(length>EPS))return null;
 const all=points.map((_,i)=>i),from=min+length*(many?.7:.5);
 let far=all.filter(i=>along[i]>=from);
 if(far.length<3)far=all;
 const mean=ids=>ids.reduce((sum,i)=>sum.add(points[i]),new Vector3()).multiplyScalar(1/ids.length);
 let head=far,station=null;
 if(!many){
  // Weight by distance from the centre line: a mace or axe head outweighs its shaft.
  const line=mean(far);
  let total=0,sum=0;
  for(const i of far){
   const delta=points[i].clone().sub(line),weight=delta.addScaledVector(toward,-delta.dot(toward)).lengthSq()+EPS;
   total+=weight;sum+=weight*along[i];
  }
  station=sum/total;
  const near=far.filter(i=>Math.abs(along[i]-station)<=length*.14);
  if(near.length>=3)head=near;
 }
 const centre=mean(head);
 if(station!=null)centre.addScaledVector(toward,station-centre.dot(toward));
 const section=crossSection(head.map(i=>points[i]),centre,toward);
 // The source is at least a tenth of the part long and never wider than a fifth of it.
 const width=clamp(section.wide,length*.1,length*.2);
 const flat=section.thin<section.wide*.35;
 const clearance=Math.max(.1,width*.25);
 const sites=section.sides.slice(0,flat?2:4).map(({direction,reach})=>({
  point:centre.clone().addScaledVector(direction,reach+clearance).toArray(),normal:direction.toArray()}));
 return {sites,vertices:head,width,axis:toward.toArray()};
}

/**
 * A long straight blade has no head to gather a source around, so its source lies
 * along the blade: one patch off each face near the tip and two smaller ones behind
 * it. The fire is largest at the striking end and thins toward the hilt. Returns
 * null for any other shape (a headed weapon, a curved or short part).
 */
export function suggestBladeEmitterSites(points,axis) {
 if(points.length<4)return null;
 const toward=axis.clone().normalize();
 const along=points.map(point=>point.dot(toward));
 const min=Math.min(...along),max=Math.max(...along),length=max-min;
 if(!(length>EPS))return null;
 const across=point=>point.clone().addScaledVector(toward,-point.dot(toward));
 // Ten slices along the part: each slice's centre and half-width. An empty slice takes its neighbours' values.
 const BINS=10,slices=Array.from({length:BINS},()=>[]);
 points.forEach((point,i)=>slices[Math.min(BINS-1,Math.floor((along[i]-min)/length*BINS))].push(across(point)));
 const centres=slices.map(slice=>slice.length>1?slice.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/slice.length):null);
 const widths=slices.map((slice,i)=>centres[i]?slice.reduce((most,p)=>Math.max(most,p.distanceTo(centres[i])),0):null);
 const known=widths.map((w,i)=>w==null?-1:i).filter(i=>i>=0);
 if(known.length<2)return null;
 const fill=(values,i,mix)=>{
  if(values[i]!=null)return values[i];
  const before=known.filter(k=>k<i).at(-1),after=known.find(k=>k>i);
  if(before==null)return values[after];
  if(after==null)return values[before];
  return mix(values[before],values[after],(i-before)/(after-before));
 };
 const width=widths.map((_,i)=>fill(widths,i,(a,b,t)=>a+(b-a)*t));
 const centre=centres.map((_,i)=>fill(centres,i,(a,b,t)=>a.clone().lerp(b,t)));
 // The blade is the run of wide slices around the widest slice of the far half; a tapering tip belongs to it.
 let peak=BINS/2;
 for(let i=peak;i<BINS;i++)if(width[i]>width[peak])peak=i;
 const limit=width[peak]*.5;
 if(!(limit>EPS))return null;
 let first=peak,last=peak;
 while(first>0&&width[first-1]>=limit)first--;
 while(last<BINS-1&&width[last+1]>=limit)last++;
 if(width.slice(last+1).every(w=>w<limit))last=BINS-1;
 const run=(last-first+1)/BINS,runLength=length*run;
 const inRun=width.slice(first,last+1).sort((a,b)=>a-b),half=inRun[Math.floor(inRun.length/2)];
 if(run<.5||runLength<half*3.2)return null;
 const line=centre.slice(first,last+1).reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/(last-first+1));
 // A curved blade keeps the single head source: patches on a straight line would leave it.
 if(centre.slice(first,last+1).some(p=>p.distanceTo(line)>Math.max(half*.6,runLength*.04)))return null;
 const start=min+length*first/BINS;
 const at=share=>line.clone().addScaledVector(toward,start+runLength*share);
 const vertices=points.map((_,i)=>i).filter(i=>along[i]>=start&&along[i]<=start+runLength);
 if(vertices.length<3)return null;
 const section=crossSection(vertices.map(i=>points[i]),at(.5),toward);
 const size=clamp(half,runLength*.08,runLength*.2),clearance=Math.max(.1,size*.25);
 // Station along the blade, sprite width, patch across and along, share of the layer's rate.
 const STATIONS=[[.74,1.1,.45,.07,1.5],[.5,.78,.4,.11,.95],[.27,.52,.3,.1,.55]];
 const sites=STATIONS.flatMap(([share,scale,wide,long,rate],station)=>section.sides.slice(0,2).map(({direction,reach},face)=>({
  key:'blade'+station+'-'+face,head:station===0,point:at(share).addScaledVector(direction,reach+clearance).toArray(),
  direction:direction.toArray(),width:size*scale,birth:{width:Math.max(.05,size*wide),length:Math.max(.05,runLength*long),share:rate}})));
 return {sites,vertices,axis:toward.toArray()};
}

const MASS_POINTS=[[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]];
const MASS_SITES=8;
// Skew directions for the inside test: none runs along a model axis or a usual mesh edge.
const MASS_RAYS=[[1,.13,.07],[-1,.11,-.09],[.09,1,.12],[-.12,-1,.08],[.1,-.07,1],[-.08,.12,-1],[1,1,1.1],[-1,1.05,.9],[1,-1,.95],[1.02,.97,-1],[-1,-1.03,1],[-1,1,-.96],[1,-.98,-1],[-.97,-1,-1]]
 .map(direction=>new Vector3(...direction).normalize());

function weightedReach(values,weights,share) {
 const order=values.map((value,i)=>[Math.abs(value),weights[i]]).sort((a,b)=>a[0]-b[0]);
 const total=order.reduce((sum,entry)=>sum+entry[1],0);
 let covered=0;
 for(const [value,weight] of order){
  covered+=weight;
  if(covered>=total*share)return value;
 }
 return order.at(-1)?.[0]??0;
}

/**
 * Whether a point lies in the piece rather than in a gap beside it. In a piece the surface lies all
 * around the point (also between the flanges of a mace head, which have no wall between them), or
 * rays from it meet the surface in most directions (nested shells), or cross it an odd number of
 * times (an open sheet). In the hollow of a curve the surface lies to one side and most rays meet nothing.
 */
function insidePiece(point,triangles,samples) {
 const pull=new Vector3(),toward=new Vector3();
 let total=0;
 for(const sample of samples){
  const distance=toward.subVectors(sample.point,point).lengthSq();
  if(!(distance>EPS))continue;
  const weight=sample.weight/distance;
  total+=weight;pull.addScaledVector(toward,weight/Math.sqrt(distance));
 }
 if(total>0&&pull.length()<total*.25)return true;
 let odd=0,met=0;
 const edge1=new Vector3(),edge2=new Vector3(),h=new Vector3(),s=new Vector3(),q=new Vector3();
 for(const direction of MASS_RAYS){
  let crossings=0;
  for(const {points:[a,b,c]} of triangles){
   edge1.subVectors(b,a);edge2.subVectors(c,a);h.crossVectors(direction,edge2);
   const det=edge1.dot(h);
   if(Math.abs(det)<EPS)continue;
   s.subVectors(point,a);
   const u=s.dot(h)/det;
   if(u<0||u>1)continue;
   q.crossVectors(s,edge1);
   const v=direction.dot(q)/det;
   if(v<0||u+v>1)continue;
   if(edge2.dot(q)/det>EPS)crossings++;
  }
  odd+=crossings%2;
  if(crossings)met++;
 }
 return met>=MASS_RAYS.length*.6||odd>=MASS_RAYS.length*.4;
}

/** One mass of surface samples: its centre, long axis, cross-section and how large a fire seated in it is. */
function massLeaf(samples,surface,limit) {
 const weights=samples.map(sample=>sample.weight);
 const weight=weights.reduce((sum,value)=>sum+value,0);
 const centre=samples.reduce((sum,sample)=>sum.addScaledVector(sample.point,sample.weight),new Vector3()).multiplyScalar(1/weight);
 const deltas=samples.map(sample=>sample.point.clone().sub(centre));
 let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;
 deltas.forEach((d,i)=>{const w=weights[i];xx+=w*d.x*d.x;xy+=w*d.x*d.y;xz+=w*d.x*d.z;yy+=w*d.y*d.y;yz+=w*d.y*d.z;zz+=w*d.z*d.z;});
 // Long axis: the direction the samples spread most along (power iteration on their covariance).
 const axis=xx>=yy&&xx>=zz?new Vector3(xx,xy,xz):yy>=zz?new Vector3(xy,yy,yz):new Vector3(xz,yz,zz);
 if(!(axis.lengthSq()>EPS))axis.set(1,0,0);
 for(let i=0;i<48;i++)axis.set(xx*axis.x+xy*axis.y+xz*axis.z,xy*axis.x+yy*axis.y+yz*axis.z,xz*axis.x+yz*axis.y+zz*axis.z).normalize();
 const seed=Math.abs(axis.z)<.9?UP:new Vector3(1,0,0);
 const e1=seed.clone().addScaledVector(axis,-seed.dot(axis)).normalize(),e2=axis.clone().cross(e1).normalize();
 let aa=0,ab=0,bb=0;
 const flatPoints=deltas.map((d,i)=>{const a=d.dot(e1),b=d.dot(e2),w=weights[i];aa+=w*a*a;ab+=w*a*b;bb+=w*b*b;return [a,b];});
 const angle=.5*Math.atan2(2*ab,aa-bb),cos=Math.cos(angle),sin=Math.sin(angle);
 const wide=e1.clone().multiplyScalar(cos).addScaledVector(e2,sin),thin=e1.clone().multiplyScalar(-sin).addScaledVector(e2,cos);
 const long=weightedReach(deltas.map(d=>d.dot(axis)),weights,.95);
 const wideReach=weightedReach(flatPoints.map(([a,b])=>a*cos+b*sin),weights,.9);
 const thinReach=weightedReach(flatPoints.map(([a,b])=>b*cos-a*sin),weights,.9);
 // The solid the fire has to clear: a round piece's radius, a flat piece's half-width. Spikes and flanges stay outside it.
 const radius=Math.max(Math.sqrt((aa+bb)/weight),wideReach,EPS);
 const width=radius*1.1,fire=Math.min(width*1.35,limit);
 const inside=insidePiece(centre,surface.triangles,surface.samples);
 return {samples,weight,centre,axis,wide,thin,long,wideReach,thinReach,radius,width,fire,inside,
  flat:thinReach<wideReach*.35,need:inside?long/(fire*1.6):Infinity};
}

function splitMassLeaf(leaf,surface,limit) {
 const order=leaf.samples.map(sample=>[sample.point.dot(leaf.axis),sample]).sort((a,b)=>a[0]-b[0]);
 let covered=0,cut=0;
 while(cut<order.length-1&&covered+order[cut][1].weight<leaf.weight/2)covered+=order[cut++][1].weight;
 cut=clamp(cut,6,order.length-6);
 return [order.slice(0,cut),order.slice(cut)].map(half=>massLeaf(half.map(entry=>entry[1]),surface,limit));
}

// The condensed mass of a weapon part: the part without the thin shaft that carries it (a mace or
// axe head, a whole claw or horn). Slices are weighed by area and distance from the part's centre line.
function massRun(samples,toward) {
 const along=samples.map(sample=>sample.point.dot(toward));
 const min=Math.min(...along),max=Math.max(...along),length=max-min;
 if(!(length>EPS))return samples;
 const total=samples.reduce((sum,sample)=>sum+sample.weight,0);
 const line=samples.reduce((sum,sample)=>sum.addScaledVector(sample.point,sample.weight),new Vector3()).multiplyScalar(1/total);
 line.addScaledVector(toward,-line.dot(toward));
 const BINS=10,mass=new Array(BINS).fill(0);
 samples.forEach((sample,i)=>{
  const across=sample.point.clone().addScaledVector(toward,-along[i]).distanceTo(line);
  mass[Math.min(BINS-1,Math.floor((along[i]-min)/length*BINS))]+=sample.weight*across;
 });
 const limit=Math.max(...mass)*.25;
 let first=0;
 while(first<BINS*.7&&mass[first]<limit)first++;
 if(!first||first>=BINS*.7)return samples;
 const from=min+length*first/BINS;
 const run=samples.filter((_,i)=>along[i]>=from);
 return run.length>=8?run:samples;
}

// A part made of separate pieces burns on one of them: the bulkiest group of pieces that touch
// (a mace head with its flanges and ring), the farther one when two are alike.
function massPiece(shape,toward) {
 const parts=shape.components;
 if(parts.length<2)return parts;
 const slack=shape.span.length()*.02;
 const boxes=parts.map(part=>new Box3().setFromPoints(part.triangles.flatMap(triangle=>triangle.points)).expandByScalar(slack));
 const group=parts.map((_,i)=>i);
 const find=i=>group[i]===i?i:(group[i]=find(group[i]));
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(boxes[i].intersectsBox(boxes[j]))group[find(i)]=find(j);
 const clusters=new Map();
 parts.forEach((part,i)=>{
  const key=find(i),cluster=clusters.get(key)||{parts:[],bulk:0,area:0,centre:new Vector3()};
  cluster.parts.push(part);cluster.bulk+=part.area*(part.radius||Math.sqrt(part.area)*.3);
  cluster.area+=part.area;cluster.centre.addScaledVector(part.centre,part.area);
  clusters.set(key,cluster);
 });
 const list=[...clusters.values()],most=Math.max(...list.map(cluster=>cluster.bulk));
 return list.filter(cluster=>cluster.bulk>=most*.9).reduce((a,b)=>b.centre.dot(toward)/b.area>a.centre.dot(toward)/a.area?b:a).parts;
}

/**
 * One fire seated in the piece's own mass, the way the Moarg Overlord's fire uses its mace: the
 * source sits inside the head at the centre of its mass, between its flanges, and the fire is a
 * third larger than that mass, so the piece hides the middle of the fire and flames show all
 * around its outline while the flanges and spikes reach out of it.
 * A compact piece gets one source. A curved or tapering piece (a claw, a horn) gets a short chain
 * of sources down its own middle, each the size of the piece there, which burn as one fire in the
 * piece's shape. A flat piece gets its sources off both faces. A body (many) burns at `only`, its
 * head, or at its top, and so does a piece too sprawling for one fire. `limit` is the largest
 * sprite the part can draw: a mass too large to engulf gets its source just under its top, so the
 * fire still shows.
 */
export function suggestMassEmitterSites(shape,axis,{many=false,only=null,limit=Infinity}={}) {
 if(!shape)return null;
 const samplesOf=parts=>parts.flatMap(part=>part.triangles).flatMap(triangle=>MASS_POINTS.map(barycentric=>
  ({point:pointOnTriangle(triangle,barycentric),weight:triangle.area/MASS_POINTS.length,ids:triangle.ids})));
 const all=samplesOf(shape.components);
 if(all.length<8)return null;
 const surface={triangles:shape.components.flatMap(part=>part.triangles),samples:all};
 const toward=many?UP.clone():axis.clone().normalize();
 const topOf=samples=>{
  const heights=samples.map(sample=>sample.point.z),low=Math.min(...heights),high=Math.max(...heights);
  const top=samples.filter(sample=>sample.point.z>=low+(high-low)*.7);
  return top.length>=8?top:samples;
 };
 let leaves;
 if(many){
  const head=only?all.filter(sample=>sample.ids.every(id=>only.has(id))):[];
  leaves=[massLeaf(head.length>=16?head:topOf(all),surface,limit)];
 }else{
  const piece=samplesOf(massPiece(shape,toward));
  leaves=[massLeaf(massRun(piece,toward),surface,limit)];
  const count=()=>leaves.reduce((sum,leaf)=>sum+(leaf.flat?2:1),0);
  // A fire that cannot cover its mass, or whose middle lies in a gap beside the piece, is divided along the mass.
  for(;;){
   const worst=leaves.filter(leaf=>leaf.need>1&&leaf.samples.length>=16).sort((a,b)=>b.need-a.need||b.weight-a.weight)[0];
   if(!worst||count()+(worst.flat?2:1)>MASS_SITES)break;
   leaves.splice(leaves.indexOf(worst),1,...splitMassLeaf(worst,surface,limit));
  }
  if(count()>=MASS_SITES-1&&leaves.some(leaf=>leaf.need>2.5)){
   many=true;
   leaves=[massLeaf(topOf(piece),surface,limit)];
  }
 }
 const widest=Math.max(...leaves.map(leaf=>leaf.width));
 const core=leaves.filter(leaf=>leaf.width>=widest*.9).reduce((a,b)=>b.centre.dot(toward)>a.centre.dot(toward)?b:a);
 // One fire: a source that cannot reach the others is left out, and none is a speck beside the main one.
 const widthOf=leaf=>Math.max(leaf.width,core.width*.45);
 const patch=leaf=>many?0:Math.max(0,leaves.length===1?leaf.long*.75-leaf.fire:leaf.long-widthOf(leaf)*.5);
 const reach=leaf=>patch(leaf)+widthOf(leaf)*1.35;
 const joined=new Set([core]);
 for(let grown=true;grown;){
  grown=false;
  for(const leaf of leaves)if(!joined.has(leaf)&&[...joined].some(other=>other.centre.distanceTo(leaf.centre)<=reach(other)+reach(leaf))){joined.add(leaf);grown=true;}
 }
 const sites=[];
 for(const [index,leaf] of leaves.entries()){
  if(!joined.has(leaf))continue;
  const {axis:along,thin}=leaf,line=patch(leaf),head=leaf===core;
  let point=leaf.centre.clone(),width=widthOf(leaf);
  // Sprites for an even fire along the source's line, a little fewer where the piece is slight.
  const share=Math.sqrt(width)*(1+line/width);
  // A middle that still lies beside the piece moves onto the piece.
  if(!leaf.inside)point=leaf.samples.reduce((a,b)=>b.point.distanceToSquared(leaf.centre)<a.point.distanceToSquared(leaf.centre)?b:a).point.clone();
  if(leaf.flat&&!many){
   const clearance=leaf.thinReach+Math.max(.1,width*.25);
   for(const [face,side] of [1,-1].entries()){
    const out=thin.clone().multiplyScalar(side);
    sites.push({key:'mass'+index+'-'+face,head,point:point.clone().addScaledVector(out,clearance).toArray(),direction:out.toArray(),along:along.toArray(),width,
     birth:{width:Math.max(.05,width*.4),length:Math.max(.05,width*.3,line),share:share/2}});
   }
   continue;
  }
  if(leaf.inside&&leaf.fire<leaf.radius*1.15){
   // Too large to engulf: the source sits just under the top of the mass above it.
   const near=leaf.samples.filter(sample=>Math.hypot(sample.point.x-point.x,sample.point.y-point.y)<=Math.max(leaf.fire,leaf.radius*.5));
   const above=near.length?near:leaf.samples;
   const top=weightedReach(above.map(sample=>Math.max(0,sample.point.z-point.z)),above.map(sample=>sample.weight),.9);
   point.z+=Math.max(0,top-leaf.fire*.4);
   width=leaf.fire/1.35;
  }
  let out=UP.clone().addScaledVector(along,-UP.dot(along));
  if(out.lengthSq()<.04)out=leaf.wide.clone();
  out.normalize();
  const across=Math.min(leaf.radius,width)*.3;
  sites.push({key:'mass'+index,head,point:point.toArray(),direction:out.toArray(),along:along.toArray(),width,
   birth:{width:Math.max(.05,across),length:Math.max(.05,across,line),share}});
 }
 return {sites,vertices:[...new Set(core.samples.flatMap(sample=>sample.ids))],axis:toward.toArray()};
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
