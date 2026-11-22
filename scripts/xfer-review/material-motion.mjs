import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, compileTrackSampler, composeNodeMatrices, nodePivot, skinGeoset } from '../../src/animation.js';
import { vertexBoneWeights } from '../../src/part-bones.js';
import { overlapGroups, insideTorso, headVisibility } from './surface-overlap.mjs';
import { surfaceVisible } from './surface-review.mjs';

const identity = new Matrix4();
const rad = 180 / Math.PI;
const pt = (positions, point) => positions[point.gi] ? new Vector3().fromArray(positions[point.gi], 3 * point.vi) : null;
const average = points => points.length ? points.reduce((s,p) => s.add(p), new Vector3()).divideScalar(points.length) : null;
const distance = (a,b) => a && b ? a.distanceTo(b) : null;
const percentile = (values,q) => values.length ? values.sort((a,b)=>a-b)[Math.floor(q*(values.length-1))] : null;
const byId = model => new Map(allNodes(model).map(n=>[n.ObjectId,n]));

// Reuse the editor's interpolation and transform inheritance with prepared key ranges.
export function sequenceSampler(model, si) {
  const nodes=byId(model), interval=model.Sequences[si].Interval, scratch={};
  const tracks=new Map();
  for (const node of nodes.values()) {
    const options={interval,globalSequences:model.GlobalSequences};
    tracks.set(node,[
      compileTrackSampler(node.Translation,{...options,fallback:[0,0,0]}),
      compileTrackSampler(node.Rotation,{...options,fallback:[0,0,0,1],quaternion:true}),
      compileTrackSampler(node.Scaling,{...options,fallback:[1,1,1]}),
    ]);
  }
  const local={t:new Vector3(),r:new Quaternion(),s:new Vector3()};
  return frame=>composeNodeMatrices(model,nodes.keys(),node=>{
    const [t,r,s]=tracks.get(node);
    local.t.fromArray(t(frame)); local.r.fromArray(r(frame)); local.s.fromArray(s(frame));
    return local;
  },nodes,scratch);
}

function principalPitch(points, positions) {
  let x=0,z=0,xx=0,zz=0,xz=0,n=0;
  for(const p of points){
    const skin=positions[p.gi];if(!skin)continue;
    const a=skin[p.vi*3],b=skin[p.vi*3+2];
    n++;x+=a;z+=b;xx+=a*a;zz+=b*b;xz+=a*b;
  }
  if(n<3)return null;
  return .5*Math.atan2(2*(xz-x*z/n),xx-zz-(x*x-z*z)/n)*rad;
}
const lineDifference=(a,b)=>((a-b+270)%180+180)%180-90;

function strongest(model, points) {
  const weights=new Map();
  for(const {gi,vi} of points) for(const [id,w] of vertexBoneWeights(model.Geosets[gi],vi))
    weights.set(id,(weights.get(id)||0)+w);
  return [...weights].sort((a,b)=>b[1]-a[1])[0]?.[0];
}

function worldPoint(model,id,matrices) {
  const n=model.Nodes?.[id];
  return n ? new Vector3().fromArray(nodePivot(model,n,id)).applyMatrix4(matrices.get(id)||identity) : null;
}

function visiblePose(model,si,frame,matrices) {
  return model.Geosets.map((g,i)=>surfaceVisible(model,i,frame,si)?skinGeoset(g,matrices):null);
}

function bounds(skin) {
  let top=-Infinity,bottom=Infinity;
  for(const v of skin) if(v) for(let i=2;i<v.length;i+=3){top=Math.max(top,v[i]);bottom=Math.min(bottom,v[i]);}
  return {top,bottom};
}

// Classify landmarks on the untouched native meshes. The result always uses exactly
// the same recipient vertex indices, including when the carrier changes.
export function referenceLandmarks(a) {
  const m=a.model,si=Math.max(0,a.stand),frame=m.Sequences[si].Interval[0];
  const w=sequenceSampler(m,si)(frame),skin=visiblePose(m,si,frame,w),box=bounds(skin);
  const item=[],secondary=[],mouth=[],attachment=m.Attachments?.find(n=>/weapon/i.test(n.Name));
  for(let gi=0;gi<m.Geosets.length;gi++) if(skin[gi]) for(let vi=0;vi<skin[gi].length/3;vi++){
    const p={gi,vi},weights=vertexBoneWeights(m.Geosets[gi],vi);
    if(!weights.length)continue;
    const path=a.path(weights.reduce((x,y)=>x[1]>y[1]?x:y)[0]);
    const names=path.map(j=>a.nodes.get(j)?.Name||'');
    if(attachment && path.includes(attachment.Parent))item.push(p);
    if(names.some(n=>/cape|cloak|tail|robe|cloth|skirt/i.test(n)))secondary.push(p);
    if(names.some(n=>/lip|jaw|mouth/i.test(n)))mouth.push(p);
  }
  const parts=a.rig.parts||{},arms=Object.values(parts).filter(p=>p.limbKind==='arm').map(p=>{
    const cloud=(a.pieces.get(p.key)||[]).filter(t=>skin[t.gi]);
    return {side:p.side,marker:p.marker,bands:p.joints.map((_,i)=>cloud.filter(t=>t.ordinal===i))};
  });
  const head=(a.pieces.get('head')||[]).filter(p=>skin[p.gi]);
  const last=head.reduce((n,p)=>Math.max(n,p.ordinal),-1);
  const mass=head.filter(t=>t.ordinal===last);
  const hips=(a.pieces.get('hips')||[]).filter(p=>skin[p.gi]),chest=(a.pieces.get('chest')||[]).filter(p=>skin[p.gi]);
  const H=box.top-box.bottom;
  const at=p=>pt(skin,p);
  const hands=arms.map(p=>({side:p.side,p:worldPoint(m,p.marker,w)})).filter(h=>h.p);
  const nearest=hands.map(h=>({...h,d:percentile(item.map(v=>at(v).distanceTo(h.p)),0)})).filter(h=>h.d!=null).sort((a,b)=>a.d-b.d)[0];
  // A reference on the trunk does not establish a hand-held item.
  let grip=[],tip=[],two=false;
  if(nearest && nearest.d<.18*H && item.length>=3){
    const ranked=item.slice().sort((a,b)=>at(a).distanceToSquared(nearest.p)-at(b).distanceToSquared(nearest.p));
    grip=ranked.slice(0,Math.max(3,Math.round(.1*ranked.length)));
    const g=average(grip.map(at));
    tip=ranked.sort((a,b)=>at(b).distanceToSquared(g)-at(a).distanceToSquared(g)).slice(0,Math.max(3,Math.round(.05*ranked.length)));
    const axis=average(tip.map(at)).sub(g).normalize();
    two=hands.some(h=>h.side!==nearest.side && h.p.clone().sub(g).cross(axis).length()<.05*H);
  }
  secondary.sort((a,b)=>at(a).z-at(b).z);
  const n=Math.ceil(secondary.length*.1);
  // Choose shoulder-seam vertices at rest. Measure the same neighbouring material
  // in every pose, even if a different arm bone now carries one end of an edge.
  const armPoints=arms.flatMap(p=>p.bands[0]||[]), armSet=new Set(armPoints.map(p=>p.gi+','+p.vi));
  const edges=[],sockets=[];
  for (const p of armPoints) {
    let closest=null,dist=Infinity;
    for (const q of chest){const d=at(p).distanceToSquared(at(q));if(d<dist){dist=d;closest=q;}}
    if(closest && dist<(.04*H)**2)sockets.push([p,closest]);
  }
  for(const [gi,g] of m.Geosets.entries()){
    if(!skin[gi])continue;
    const seen=new Set();
    for(let t=0;t<g.Faces.length;t+=3)for(const [x,y]of [[0,1],[1,2],[2,0]]){
      const i=g.Faces[t+x],j=g.Faces[t+y],k=Math.min(i,j)+','+Math.max(i,j);
      if(seen.has(k)||!armSet.has(gi+','+i)&&!armSet.has(gi+','+j))continue;
      seen.add(k);const p={gi,vi:i},q={gi,vi:j},d=distance(at(p),at(q));
      if(d>.005*H)edges.push([p,q,d]);
    }
  }
  const trunk=hips.concat(chest);
  const gripCentre=average(grip.map(at)),tipCentre=average(tip.map(at));
  let asymmetric=false;
  if(gripCentre&&tipCentre&&gripCentre.distanceTo(tipCentre)>1e-6){
    const axis=tipCentre.clone().sub(gripCentre).normalize(),length=gripCentre.distanceTo(tipCentre),width=[[],[]];
    for(const p of item){const v=at(p).sub(gripCentre),t=v.dot(axis)/length;if(t>.65)width[1].push(v.cross(axis).length());else if(t<.35)width[0].push(v.cross(axis).length());}
    const near=percentile(width[0],.9),far=percentile(width[1],.9);asymmetric=far!=null&&near!=null&&far>Math.max(1.6*near,.055*length);
  }
  const overlap=overlapGroups(m,head,trunk,arms);
  return {H,overlap,arms,head:mass,hips,chest,trunk,pitch:principalPitch(trunk,skin),grip,tip,asymmetric,two,hand:nearest?.side,mouth,sockets,edges,
    hem:secondary.slice(0,n),collar:n?secondary.slice(-n):[],mounted:a.rig.actors?.length>1};
}

function travelBox() {
  const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);
  return {add(p){if(p){lo.min(p);hi.max(p)}},range(){return Number.isFinite(lo.x)?hi.distanceTo(lo):null}};
}

export function materialClip(model,landmarks,si,bodyMapped,overlapChecks=false) {
  const seq=model.Sequences[si], [start,end]=seq.Interval, sample=sequenceSampler(model,si);
  const head=strongest(model,landmarks.head),chest=strongest(model,landmarks.chest);
  const mouth=travelBox(),hem=travelBox(),face=travelBox(), frames=[];
  let headRest,hemLength=null;
  for(let f=start;f<=end;f+=2){
    const matrices=sample(f),positions=visiblePose(model,si,f,matrices);
    const p=id=>worldPoint(model,id,matrices),cent=pts=>average(pts.map(v=>pt(positions,v)).filter(Boolean));
    const h=cent(landmarks.head),hip=cent(landmarks.hips),g=cent(landmarks.grip),tip=cent(landmarks.tip);
    const axis=g&&tip?tip.clone().sub(g).normalize():null,headM=matrices.get(head),chestM=matrices.get(chest);
    const q=headM?new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(headM)):null;
    if(q&&!headRest)headRest=q.clone();
    const toChest=chestM?.clone().invert(),toHead=headM?.clone().invert();
    if(h && toChest)face.add(h.clone().applyMatrix4(toChest));
    const lips=cent(landmarks.mouth);if(lips && toHead)mouth.add(lips.applyMatrix4(toHead));
    const bottom=cent(landmarks.hem),top=cent(landmarks.collar);
    if(bottom && top && toChest){const vec=bottom.applyMatrix4(toChest).sub(top.applyMatrix4(toChest));hemLength??=vec.length();hem.add(vec);}
    const hands=[],elbows=[];
    for(const arm of landmarks.arms){
      const id=bodyMapped ? bodyMapped[arm.side] : arm.marker,palm=p(id);
      if(palm&&g){const v=palm.clone().sub(g);hands.push({side:arm.side,gap:v.length(),shaft:axis?v.cross(axis).length():null});}
      if(arm.bands.length>=3){const line=[arm.bands[0],arm.bands[1],arm.bands.at(-1)].map(cent);if(line.every(Boolean))elbows.push({side:arm.side,angle:line[0].sub(line[1]).angleTo(line[2].sub(line[1]))*rad});}
    }
    const gaps=landmarks.sockets.map(([a,b])=>distance(pt(positions,a),pt(positions,b))).filter(n=>n!=null);
    let stretch=null;
    for(const [a,b,rest] of landmarks.edges){const d=distance(pt(positions,a),pt(positions,b));if(d!=null)stretch=Math.max(stretch||0,d-rest);}
    let seat=null;
    if(landmarks.mounted && hip && h){const rider=worldPoint(model,chest,matrices);if(rider){let z=-Infinity;for(const v of landmarks.hips){const m=pt(positions,v);if(m&&Math.hypot(m.x-rider.x,m.y-rider.y)<.1*landmarks.H)z=Math.max(z,m.z);}if(Number.isFinite(z))seat=rider.z-z;}}
    const {bottom:floor}=bounds(positions);
    const pitch=principalPitch(landmarks.trunk,positions);
    const inside=overlapChecks?insideTorso(landmarks.overlap,positions):null;
    const attacking=overlapChecks&&/^attack/i.test(seq.Name.trim());
    const side=attacking?headVisibility(landmarks.overlap,positions,false):null;
    const front=attacking?headVisibility(landmarks.overlap,positions,true):null;
    frames.push({floor,pitch,inside,side,front,headInChest:h&&toChest?h.clone().applyMatrix4(toChest).toArray():null,turn:q?q.angleTo(headRest)*rad:null,lean:h&&hip?Math.atan2(h.x-hip.x,h.z-hip.z)*rad:null,
      axis:axis?.toArray(),hands,elbows,socket:percentile(gaps,.9),stretch,seat,tip:tip?.z});
  }
  return {frames,hem:hemLength>0?hem.range()/hemLength:null,mouth:mouth.range(),face:face.range()};
}

function greatest(frames,property){let worst=-Infinity;for(const f of frames)if(Number.isFinite(f[property]))worst=Math.max(worst,f[property]);return Number.isFinite(worst)?worst:null;}
function least(frames,property){let least=Infinity;for(const f of frames)if(Number.isFinite(f[property]))least=Math.min(least,f[property]);return Number.isFinite(least)?least:null;}
export function compareMaterialClip(own, donor, result, H, Hd, donorMarks, ownMarks, name) {
  const measurements={};
  function check(key,n,limit){if(Number.isFinite(n)&&Number.isFinite(limit)&&(!measurements[key]||n-limit>measurements[key].value-measurements[key].limit))measurements[key]={value:n,limit,pass:n<=limit+1e-6};}
  const r0=result.frames[0],d0=donor.frames[0],nativeInside=own?greatest(own.frames,'inside'):null;
  for(let i=0;i<Math.min(donor.frames.length,result.frames.length);i++){
    const a=donor.frames[i],b=result.frames[i];check('hover',Math.abs(b.floor/H-a.floor/Hd),.05);
    if(a.inside===0 && b.inside!=null && nativeInside!=null)check('limbPenetration',b.inside,nativeInside);
    if(a.side>=.7 && b.side!=null)check('headSideOcclusion',1-b.side,.30);
    if(a.front>=.85 && b.front!=null)check('headFrontOcclusion',1-b.front,.15);
    if(a.pitch!=null&&b.pitch!=null&&donorMarks.pitch!=null&&ownMarks.pitch!=null)
      check('trunkPitch',Math.abs(lineDifference(lineDifference(b.pitch,ownMarks.pitch),lineDifference(a.pitch,donorMarks.pitch))),5);
    if(a.headInChest&&b.headInChest&&d0.headInChest&&r0.headInChest){
      const d=new Vector3(...a.headInChest).sub(new Vector3(...d0.headInChest));
      const r=new Vector3(...b.headInChest).sub(new Vector3(...r0.headInChest));
      if(d.length()>.025*Hd&&r.length()>.025*H)check('headTravelDirection',r.angleTo(d)*rad,90);
    }
    if(a.tip!=null&&b.tip!=null)check('itemBelowDonor',a.tip/Hd-b.tip/H,.05);
    if(i && a.axis && b.axis && donor.frames[i-1].axis && result.frames[i-1].axis){
      const change=(v,w)=>new Vector3(...v).angleTo(new Vector3(...w))*rad;
      const donorStep=change(a.axis,donor.frames[i-1].axis),resultStep=change(b.axis,result.frames[i-1].axis);
      check('itemStep',resultStep-donorStep,10);
    }
    if(a.lean!=null&&b.lean!=null)check('skinLean',a.lean-b.lean,8);
    if(a.axis&&b.axis){const c=Math.max(-1,Math.min(1,new Vector3(...a.axis).dot(new Vector3(...b.axis))));check('itemLine',Math.acos(Math.abs(c))*rad,30);if(ownMarks.asymmetric&&donorMarks.asymmetric)check('itemHeadDirection',Math.acos(c)*rad,30);}
    if(a.hands.length && b.hands.length){
      const near=hands=>hands.reduce((a,b)=>a.gap<b.gap?a:b);
      check('itemHand',near(a.hands).side!==near(b.hands).side?1:0,0);
      if(ownMarks.two||donorMarks.two)for(const hand of b.hands)if(hand.shaft!=null)check('shaftGap',hand.shaft/H,.05);
    }
    for(const limb of b.elbows){const src=a.elbows.find(x=>x.side===limb.side);if(src)check('meshElbow',Math.abs(limb.angle-src.angle),15);}
  }
  const peakA=greatest(donor.frames,'turn'),peakB=greatest(result.frames,'turn');
  if(peakA!=null&&peakB!=null)check('headTurn',Math.abs(peakA-peakB),10);
  if(donor.hem>=.25&&result.hem!=null)check('hemTravel',donor.hem*.5-result.hem,0);
  if(/portrait.*talk/i.test(name)&&donor.mouth>0&&result.mouth!=null)check('mouthTravel',donor.mouth*.5-result.mouth,0);
  if(own){
    const maxGap=frames=>{let max=null;for(const f of frames)if(f.hands.length)max=Math.max(max||0,Math.min(...f.hands.map(h=>h.gap)));return max};
    const g=maxGap(own.frames),r=maxGap(result.frames);if(g!=null&&r!=null)check('gripDistance',r,1.5*g);
    const s=greatest(own.frames,'socket'),t=greatest(result.frames,'socket');if(s!=null&&t!=null)check('shoulderGap',t,s);
    const s0=greatest(own.frames,'stretch'),s1=greatest(result.frames,'stretch');if(s0!=null&&s1!=null)check('shoulderStretch',s1,Math.max(s0,.05*H));
    const z=least(own.frames,'seat'),rz=least(result.frames,'seat');if(z!=null&&rz!=null)check('riderGap',z-rz,.05*H);
  }
  return measurements;
}