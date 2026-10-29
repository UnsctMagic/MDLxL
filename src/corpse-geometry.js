import { Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset } from './animation.js';
import { suggestPoseRig, poseChainIds, poseNodeRole } from './pose-ik.js';
import { updateBounds } from './mesh-tools.js';
import { booleanContours, polygonGroups, signedArea } from './forge-geometry.js';

const mean = points => points.length ? points.reduce((sum,p) => sum.map((v,i) => v+p[i]/points.length), [0,0,0]) : null;
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
const quantile = (values,t) => values.toSorted((a,b)=>a-b)[Math.floor((values.length-1)*t)];
const accessory = /weapon|sword|axe|shield|bow|staff|spear|hammer|gun|rifle|cape|cloth|hair|banner|rein|ribbon|glow|camera|event|attachment|ref\b|corpse|gutz/i;
const headAccessory = /flare|horn|hair|helmet|jaw|eye|ear|mouth/i;
// Native gutz proportions, measured on the 58 study models with a native
// corpse (docs/AUTO-CORPSE.md). Sizes are in the unit's typical limb bone
// (joint to joint), the steadiest predictor of native piece sizes: ribs 2.57
// and skull 1.18 limb bones long, a hand 1.62 of its own forearm; each long
// bone reaches 1.6x its own joints. Widths are native width/length. Heights are shares of the dead
// body's height: bones lowest, then hands and ribs, the skull's crown at 43%.
const NATIVE = { bone: .47, boneReach: 1.6, hand: .62, handLimb: 1.62, ribs: .57, ribLimb: 2.57, skull: 1.18, skullHalf: .42, base: .12, step: .04, crown: .43 };

/** Top surface of the actual terminal pose, rather than its bounding rectangle.
 * A uniform XY grid keeps footprint/height fitting linear in mesh size. */
function surface(meshes, span) {
  const cell = Math.max(span/24,1e-4), bins = new Map();
  for (const {g,vertices} of meshes) for (let f=0;f<g.Faces.length;f+=3) {
    const tri = Array.from(g.Faces.slice(f,f+3), i=>Array.from(vertices.slice(i*3,i*3+3)));
    const [a,b,c]=tri, determinant=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if (Math.abs(determinant)<1e-10) continue;
    const xs=tri.map(p=>p[0]/cell),ys=tri.map(p=>p[1]/cell);
    for(let x=Math.floor(Math.min(...xs));x<=Math.floor(Math.max(...xs));x++) for(let y=Math.floor(Math.min(...ys));y<=Math.floor(Math.max(...ys));y++) {
      const key=x+','+y,list=bins.get(key)||[]; list.push({tri,determinant});bins.set(key,list);
    }
  }
  return (x,y) => {
    let top=-Infinity;
    for(const {tri:[a,b,c],determinant:d} of bins.get(Math.floor(x/cell)+','+Math.floor(y/cell))||[]) {
      const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d;
      const v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;
      if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001) top=Math.max(top,u*a[2]+v*b[2]+(1-u-v)*c[2]);
    }
    return top;
  };
}

/** Projected triangles overlap by area (separating-axis test). Touching
 * along an edge or corner is not an overlap. */
function trianglesOverlap(a,b,tolerance) {
  for(const tri of [a,b])for(let i=0;i<3;i++) {
    const p=tri[i],q=tri[(i+1)%3],axis=[q[1]-p[1],p[0]-q[0]];
    const range=t=>{const d=t.map(v=>v[0]*axis[0]+v[1]*axis[1]);return [Math.min(...d),Math.max(...d)];};
    const [a0,a1]=range(a),[b0,b1]=range(b),scale=Math.hypot(...axis)||1;
    if(a1-b0<=tolerance*scale||b1-a0<=tolerance*scale)return false;
  }
  return true;
}

function influences(g,i) {
  if(g.SkinWeights?.length >= (i+1)*8) return Array.from(g.SkinWeights.slice(i*8,i*8+4)).filter((id,k)=>g.SkinWeights[i*8+4+k]>=32);
  return Array.from(g.Groups?.[g.VertexGroup?.[i]]||[]);
}

/** Build a ground corpse from this model's joints and its skinned final Death
 * frame. No source-model names, vertex numbers or race/size presets are used. */
export function buildCorpseGeometry(model, bodyIds, deathIndex, {size=1,height=1,pieces:edited=null}={}) {
  const frame=model.Sequences[deathIndex].Interval[1], matrices=sampleNodeMatrices(model,frame,deathIndex);
  const meshes=bodyIds.map(id=>({g:model.Geosets[id],vertices:skinGeoset(model.Geosets[id],matrices)}));
  const points=meshes.flatMap(({vertices})=>Array.from({length:vertices.length/3},(_,i)=>Array.from(vertices.slice(i*3,i*3+3))));
  if(!points.length) throw Error('Death has no body geometry to place a corpse beneath.');
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a]);}
  const span=Math.max(hi[0]-lo[0],hi[1]-lo[1]);
  const restLo=[Infinity,Infinity,Infinity],restHi=[-Infinity,-Infinity,-Infinity];
  for(const {g} of meshes)for(let i=0;i<g.Vertices.length;i++){const axis=i%3;restLo[axis]=Math.min(restLo[axis],g.Vertices[i]);restHi[axis]=Math.max(restHi[axis],g.Vertices[i]);}
  // Some flying/effect deaths shrink to 0.001, not exactly zero. That is a
  // disappearance frame, not a body-sized pose from which to make a corpse.
  if(!(span>1e-5)||Math.hypot(...hi.map((v,i)=>v-lo[i]))<Math.hypot(...restHi.map((v,i)=>v-restLo[i]))*.005) throw Error('The last Death frame collapses the body to a point. A corpse needs a visible final pose.');
  const ground=span*.012, top=surface(meshes,span), bodyHeight=Math.min(Math.max(hi[2],span*.15),span*.6);
  const nodes=allNodes(model),byId=new Map(nodes.map(n=>[n.ObjectId,n])),clouds=new Map();
  for(const {g,vertices} of meshes) for(let i=0;i<g.Vertices.length/3;i++) for(const id of influences(g,i)) {
    const cloud=clouds.get(id)||[];cloud.push(Array.from(vertices.slice(i*3,i*3+3)));clouds.set(id,cloud);
  }
  const ancestors=id=>{const result=[],seen=new Set();while(byId.has(id)&&!seen.has(id)){seen.add(id);result.push(id);id=byId.get(id).Parent;}return result;};
  const hasSkin=id=>[...clouds.keys()].some(key=>ancestors(key).includes(id));
  const at=id=>new Vector3().fromArray(nodePivot(model,byId.get(id),id)).applyMatrix4(matrices.get(id)).toArray();
  const rig=suggestPoseRig(model,frame,deathIndex),role=id=>rig.roles[id]||poseNodeRole(byId.get(id));
  // Whatever hangs below a hand is held (a weapon, its head or chain, a
  // carried object), never anatomy, whatever its bones are called.
  const hands=new Set(rig.chains.filter(c=>c.kind==='arm').map(c=>c.end));
  const held=id=>ancestors(byId.get(id)?.Parent).some(a=>hands.has(a)||role(a)==='Hand');
  const chains=rig.chains.filter(c=>!held(c.root)&&poseChainIds(c).some(hasSkin)&&!poseChainIds(c).some(id=>accessory.test(byId.get(id)?.Name||'')&&!/hand|foot|toe|hoof|ref\b/i.test(byId.get(id)?.Name||'')));
  // Blizzard commonly binds skin to Mesh/Box children, while the actual
  // anatomical joints own no vertices. Attribute that skin to the nearest
  // recognized joint. Measuring only directly bound skin turns full bodies
  // into arbitrarily thin centerlines.
  const landmarks=new Set([rig.body,...rig.nodes,...chains.flatMap(poseChainIds)]),regions=new Map(),candidates=new Map();
  const ownerOf=id=>ancestors(id).find(i=>landmarks.has(i))??id;
  for(const {g,vertices} of meshes) {
    const owners=Array.from({length:g.Vertices.length/3},(_,i)=>[...new Set(influences(g,i).filter(id=>!ancestors(id).some(a=>accessory.test(byId.get(a)?.Name||'')&&!/hand|foot|ref\b/i.test(byId.get(a)?.Name||''))).map(ownerOf))]);
    const covered=new Set(owners.flat()),bodySurface=covered.size>=3;
    for(const owner of covered) {
      const ids=owners.flatMap((list,i)=>list.includes(owner)?[i]:[]),parent=new Map(ids.map(i=>[i,i])),coincident=new Map();
      const find=i=>{let root=i;while(parent.get(root)!==root)root=parent.get(root);while(parent.get(i)!==i){const next=parent.get(i);parent.set(i,root);i=next;}return root;};
      const join=(a,b)=>parent.set(find(a),find(b));
      // UV/normal seams do not make separate body parts.
      for(const i of ids){const key=Array.from(g.Vertices.slice(i*3,i*3+3)).map(v=>Math.round(v/Math.max(span*1e-6,1e-7))).join(',');if(coincident.has(key))join(i,coincident.get(key));else coincident.set(key,i);}
      for(let f=0;f<g.Faces.length;f+=3){const tri=Array.from(g.Faces.slice(f,f+3)).filter(i=>parent.has(i));for(let i=1;i<tri.length;i++)join(tri[0],tri[i]);}
      const components=new Map();for(const i of ids){const root=find(i),list=components.get(root)||[];list.push(i);components.set(root,list);}
      for(const component of components.values()) {
        if(component.length<3)continue;
        const center=mean(component.map(i=>Array.from(g.Vertices.slice(i*3,i*3+3)))),pivot=byId.get(owner)?.PivotPoint||[0,0,0],distance=Math.hypot(...center.map((v,i)=>v-pivot[i]));
        const list=candidates.get(owner)||[];list.push({bodySurface,distance,points:component.map(i=>Array.from(vertices.slice(i*3,i*3+3)))});candidates.set(owner,list);
      }
    }
  }
  // Equipment can share its hand/head's skin binding. Prefer the connected
  // body surface closest to the joint, not a shield, blade or tall helmet.
  for(const [owner,list] of candidates){list.sort((a,b)=>Number(b.bodySurface)-Number(a.bodySurface)||a.distance-b.distance);regions.set(owner,list[0].points);}
  const cloud=id=>regions.get(id)||clouds.get(id)||[];
  const heads=nodes.filter(n=>role(n.ObjectId)==='Head'&&!headAccessory.test(n.Name)&&hasSkin(n.ObjectId)&&!held(n.ObjectId)&&!ancestors(n.Parent).some(id=>role(id)==='Head'));
  const vertices=[],uv=[],faces=[],parts=[],pieces=[],used=new Set();
  // Wanted positions; heights are settled once every piece is known.
  function vertex(p,t) {const i=vertices.length/3;vertices.push(p[0],p[1],p[2]);uv.push(...t);return i;}
  // Principal axis of a point set, from its 10th to 90th percentile.
  function axisEnds(cloud) {
    const center=mean(cloud),xx=cloud.reduce((s,p)=>s+(p[0]-center[0])**2,0),yy=cloud.reduce((s,p)=>s+(p[1]-center[1])**2,0),xy=cloud.reduce((s,p)=>s+(p[0]-center[0])*(p[1]-center[1]),0),angle=.5*Math.atan2(2*xy,xx-yy),axis=[Math.cos(angle),Math.sin(angle)];
    const projection=cloud.map(p=>(p[0]-center[0])*axis[0]+(p[1]-center[1])*axis[1]);
    return [.1,.9].map(t=>[center[0]+axis[0]*quantile(projection,t),center[1]+axis[1]*quantile(projection,t),ground]);
  }
  function halfWidth(a,b,ids,factor=1) {
    const len=distance(a,b);if(len<1e-6)return span*.015;
    const d=[(b[0]-a[0])/len,(b[1]-a[1])/len], samples=ids.flatMap(cloud).filter(p=>{
      const along=(p[0]-a[0])*d[0]+(p[1]-a[1])*d[1];return along>=-len*.1&&along<=len*1.1;
    }).map(p=>Math.abs((p[0]-a[0])*d[1]-(p[1]-a[1])*d[0]));
    return samples.length?Math.max(span*.004,quantile(samples,.9)*factor):span*.035;
  }
  // Pieces are planned first, so the Auto Corpse window can stretch, move,
  // add or remove them before the mesh is built from the edited list.
  function strip(kind,a,b,half,rect,ids=[]) {if(distance(a,b)>=span*.0001)pieces.push({kind,start:a,end:b,half,rect,ids});}
  // The native gutz standard: each limb bone, hand, foot and rib cage is one
  // flat rectangle showing its whole atlas region, lying at one height.
  function emitStrip({kind:label,start:a,end:b,half,rect,ids=[],free=false},index) {
    const len=distance(a,b);if(len<span*.0001)return;
    const normal=[(b[1]-a[1])/len,-(b[0]-a[0])/len],first=faces.length;
    const corners=[[a,-1,rect[0],rect[1]],[a,1,rect[2],rect[1]],[b,-1,rect[0],rect[3]],[b,1,rect[2],rect[3]]].map(([p,side,u,v])=>vertex([p[0]+normal[0]*half*side,p[1]+normal[1]*half*side,0],[u,v]));
    faces.push(corners[0],corners[1],corners[2],corners[1],corners[3],corners[2]);
    parts.push({kind:label,start:a,end:b,length:len,ids,piece:index,free,vertices:corners,faces:[first,faces.length]});
  }
  // Native gutz corpses lay one long-bone rectangle for each upper and lower
  // limb and one palm rectangle for each hand; feet get no piece. A longer
  // joint chain (helpers, extra links) is split once, at the joint nearest
  // half its length. Each rectangle keeps the native width/length, so the
  // bone picture is never squashed across a short, wide piece.
  // Native bone rectangles reach past both joints, overlapping at the elbow.
  // Their native width/length is the minimum; a broad body's skin widens them
  // up to 80% of their length, never further (that squashes the picture).
  const fit=(a,b,aspect,ids)=>{const len=distance(a,b);return Math.min(Math.max(len*aspect/2,ids.length?halfWidth(a,b,ids)*.7:0),len*.4);};
  const reach=(a,b,factor)=>{const c=mix(a,b,.5);return [mix(c,a,factor),mix(c,b,factor)];};
  // A limb starts where it leaves the trunk: walk up from the recognized
  // chain through single joints (a thigh above a three-joint leg) until a
  // joint that branches or belongs to the trunk.
  const trunkRole=id=>['Body','Pelvis','Chest','Spine','Neck','Head'].includes(role(id));
  const branches=id=>nodes.filter(n=>n.Parent===id&&hasSkin(n.ObjectId)&&nodes.some(c=>c.Parent===n.ObjectId)).length>1;
  const limbs=chains.map(chain=>{
    const ids=poseChainIds(chain).slice();
    for(let up=byId.get(byId.get(ids[0])?.Parent);up&&!trunkRole(up.ObjectId)&&!branches(up.ObjectId)&&!held(up.ObjectId)&&!ids.includes(up.ObjectId);up=byId.get(up.Parent))ids.unshift(up.ObjectId);
    for(let i=1;i<ids.length;i++)used.add([ids[i-1],ids[i]].sort().join(':'));
    const joints=ids.map(id=>id===chain.end&&chain.grip?new Vector3().fromArray(chain.grip).applyMatrix4(matrices.get(chain.end)).toArray():at(id));
    const lengths=joints.slice(1).map((p,i)=>distance(joints[i],p)),total=lengths.reduce((a,b)=>a+b,0);
    let walked=0,split=1,best=Infinity;
    for(let i=1;i<joints.length-1;i++){walked+=lengths[i-1];const off=Math.abs(walked-total/2);if(off<best){best=off;split=i;}}
    return {chain,ids,joints,total,segments:joints.length>2?[[0,split],[split,joints.length-1]]:[[0,1]]};
  }).filter(limb=>limb.total>=span*.001);
  const limbJoints=new Set(limbs.flatMap(limb=>limb.ids));
  // The unit's typical limb bone sets the size of every native piece.
  const segmentLengths=limbs.flatMap(({joints,segments})=>segments.map(([from,to])=>distance(joints[from],joints[to]))).filter(v=>v>span*.01);
  let unit=segmentLengths.length?quantile(segmentLengths,.5):0;
  for(const {chain,ids,joints,segments} of limbs) {
    segments.forEach(([from,to],k)=>{const [a,b]=reach(joints[from],joints[to],NATIVE.boneReach),bones=ids.slice(from,to+1);strip(chain.kind,a,b,fit(a,b,NATIVE.bone,bones),k?[.006,.505,.31,.995]:[.006,.005,.31,.495],bones);});
    if(chain.kind==='arm') {
      const elbow=joints[segments.at(-1)[0]],wrist=joints.at(-1),forearm=distance(elbow,wrist);
      // Like the native hands, centred over the end of the forearm: a third
      // of the palm overlaps the forearm, the rest reaches past the wrist.
      if(forearm>span*.001){const length=forearm*NATIVE.handLimb,d=[(wrist[0]-elbow[0])/forearm,(wrist[1]-elbow[1])/forearm],at=t=>[wrist[0]+d[0]*length*t,wrist[1]+d[1]*length*t,ground];strip('hand',at(-.3),at(.7),length*NATIVE.hand/2,[.315,1,.625,.5],[chain.end]);}
    }
  }
  const torsos=new Map();
  for(const head of heads) {
    const id=head.ObjectId,neck=at(id),skin=cloud(id).length?cloud(id):nodes.filter(n=>ancestors(n.ObjectId).includes(id)&&!headAccessory.test(n.Name)).flatMap(n=>cloud(n.ObjectId));
    let center=mean(skin);
    if(!center||distance(center,neck)<span*.005) {
      const parent=byId.get(head.Parent),from=parent?at(parent.ObjectId):mean(points),d=distance(from,neck)||1;
      center=[neck[0]+(neck[0]-from[0])/d*span*.05,neck[1]+(neck[1]-from[1])/d*span*.05,ground];
    }
    const d=distance(neck,center)||1,axis=[(center[0]-neck[0])/d,(center[1]-neck[1])/d],side=[axis[1],-axis[0]];
    const projected=skin.map(p=>(p[0]-neck[0])*axis[0]+(p[1]-neck[1])*axis[1]);
    const near=skin.length?Math.min(0,quantile(projected,.02)):0,far=skin.length?Math.max(d,quantile(projected,.98)):d*1.8,length=far-near;
    const width=skin.length?Math.max(span*.012,quantile(skin.map(p=>Math.abs((p[0]-center[0])*side[0]+(p[1]-center[1])*side[1])),.95)):length*.45;
    const skull={kind:'skull',start:[neck[0],neck[1],ground],end:[neck[0]+axis[0]*far,neck[1]+axis[1]*far,ground],half:width,ids:[id]};pieces.push(skull);
    // Choose the closest shared body ancestor, separating rider and mount.
    const headAncestors=ancestors(id);
    let hips=chains.filter(c=>c.kind==='leg').map(c=>c.root);
    const rank=root=>headAncestors.findIndex(a=>ancestors(root).includes(a));
    if(hips.length){const best=Math.min(...hips.map(rank).filter(i=>i>=0));hips=hips.filter(i=>rank(i)===best);}
    let pelvis=mean(hips.map(at));
    if(!pelvis) {
      const body=headAncestors.slice(1).find(i=>['Pelvis','Body','Chest'].includes(role(i))&&distance(at(i),neck)>span*.06);
      pelvis=body!=null?at(body):mean(points);
    }
    const key=pelvis.slice(0,2).map(v=>Math.round(v/Math.max(span*.01,1e-4))).join(':');
    const torso=torsos.get(key)||{necks:[],skulls:[],pelvis,ids:new Set()};torso.necks.push(neck);torso.skulls.push({skull,axis});
    for(const i of [...headAncestors.slice(1),...hips.flatMap(ancestors)])if(!accessory.test(byId.get(i)?.Name||'')&&!held(i))torso.ids.add(i);
    torsos.set(key,torso);
  }
  // Without limbs, the neck-to-pelvis distance stands in for the limb bone.
  if(!unit){const first=[...torsos.values()][0];unit=first?distance(mean(first.necks),first.pelvis)*.56:span*.13;}
  // The rib cage lies along the neck-to-pelvis line, sized like the native
  // one from the limb bone; the skull too, not from the helmet's parts.
  function ribs(a,b,ids) {
    const len=distance(a,b);if(len<span*.0001)return 0;
    const c=mix(a,b,.5),reach=unit*NATIVE.ribLimb/2,d=[(b[0]-a[0])/len,(b[1]-a[1])/len];
    const from=[c[0]-d[0]*reach,c[1]-d[1]*reach,ground],to=[c[0]+d[0]*reach,c[1]+d[1]*reach,ground];
    strip('torso',from,to,fit(from,to,NATIVE.ribs,ids),[.634,.505,.999,.995],ids);
    return reach*2;
  }
  for(const {necks,skulls,pelvis,ids} of torsos.values()) {
    const ribLength=ribs(mean(necks),pelvis,[...ids]);
    if(ribLength)for(const {skull,axis} of skulls){const length=unit*NATIVE.skull;skull.end=[skull.start[0]+axis[0]*length,skull.start[1]+axis[1]*length,ground];skull.half=length*NATIVE.skullHalf;}
  }
  // A body whose head is not recognized still has a trunk: the skin of the
  // joints its limbs hang from, along that skin's own long axis. One rib cage
  // per unit: a separate leg rig (a death rig, say) gets none of its own.
  const limbIds=limbJoints,actors=new Map(),headed=new Set(heads.map(h=>ancestors(h.ObjectId).at(-1)));
  for(const chain of chains){const owner=ancestors(chain.root).at(-1),list=actors.get(owner)||[];list.push(chain);actors.set(owner,list);}
  for(const [owner,limbs] of actors) {
    if(headed.has(owner)||pieces.some(p=>p.kind==='torso'))continue;
    const trunkIds=[...new Set(limbs.flatMap(c=>ancestors(byId.get(c.root)?.Parent)))].filter(id=>!limbIds.has(id)&&!held(id)&&!accessory.test(byId.get(id)?.Name||''));
    let skin=trunkIds.flatMap(cloud);if(skin.length<3)skin=limbs.map(c=>at(c.root));
    if(skin.length<2)continue;
    const [a,b]=axisEnds(skin);if(distance(a,b)>span*.05)ribs(a,b,trunkIds);
  }
  // Tails, wings and anonymous rigs retain their real articulated branches.
  // Geometry evidence excludes weapon/cloth branches; no humanoid-only template.
  const inferredAnatomy=pieces.length>0,trunkJoints=new Set([...torsos.values()].flatMap(t=>[...t.ids]));
  for(const node of nodes) {
    const parent=byId.get(node.Parent);if(!parent||accessory.test(node.Name)||accessory.test(parent.Name)||held(node.ObjectId))continue;
    if(inferredAnatomy&&(node.GeosetId!==undefined||['Chest','Pelvis','Body','Spine'].includes(role(node.ObjectId))||chains.some(c=>c.root===node.ObjectId)&&!/leg|tail|wing/i.test(parent.Name)))continue;
    const key=[parent.ObjectId,node.ObjectId].sort().join(':');if(used.has(key))continue;
    // The rib cage covers the trunk and neck; limbs have their own pieces.
    if(limbJoints.has(node.ObjectId)||trunkJoints.has(node.ObjectId)&&trunkJoints.has(parent.ObjectId)||trunkRole(node.ObjectId))continue;
    const anatomical=/leg|shin|calf|arm|tail|wing|spine|neck|chest|pelvis|head|body|back|front|toe/i.test(node.Name);
    if(!hasSkin(node.ObjectId)||(!anatomical&&inferredAnatomy)||['Head','Hand','Foot','Hoof'].includes(role(node.ObjectId)))continue;
    const a=at(parent.ObjectId),b=at(node.ObjectId);
    // A joint that fans out to several pieces links them only where the body
    // lies along the link; spokes to scattered pieces cross empty ground. A
    // single continuing link (a tail or wing tip) may thin out past the skin.
    const fan=nodes.filter(n=>n.Parent===parent.ObjectId&&hasSkin(n.ObjectId)&&nodes.some(c=>c.Parent===n.ObjectId)).length>1;
    if(distance(a,b)>span*.6||distance(a,b)<unit*.5||fan&&Array.from({length:9},(_,k)=>mix(a,b,k/8)).filter(p=>Number.isFinite(top(p[0],p[1]))).length<6)continue;
    const [from,to]=reach(a,b,NATIVE.boneReach);strip('branch',from,to,distance(from,to)*NATIVE.bone/2,[.006,.005,.31,.495],[parent.ObjectId,node.ObjectId]);used.add(key);
  }
  if(!pieces.length) {
    // A single rigid object has no joints. Its own surface's principal axis
    // supplies a fitted remnant, rather than fabricating arms and legs.
    const [a,b]=axisEnds(points);
    strip('rigid remnant',a,b,span*.12,[.634,.505,.999,.995]);
  }
  // The native gutz skull occupies the TOP RIGHT of the atlas. Its nine
  // surface landmarks retain a broad cranium and jaw, scaled to head skin.
  function emitSkull({start,end,half:width,ids=[],free=false},index) {
    const length=distance(start,end)||span*.01,axis=[(end[0]-start[0])/length,(end[1]-start[1])/length],side=[axis[1],-axis[0]];
    const shape=[[.489,.014,1,.808594,.21582],[0,.079,.223,.816406,.451172],[.234,.730,0,.910156,.369141],[.787,.737,.15,.917969,.124512],[1,-.091,.427,.789063,.012939],[.915,-.841,.201,.699219,.07373],[.489,-1,.36,.6875,.236328],[.234,-.755,.053,.695313,.376953],[.489,1,.29,.941406,.233398]];
    const skullIds=shape.map(([along,across,z,u,v])=>vertex([start[0]+axis[0]*length*along+side[0]*width*across,start[1]+axis[1]*length*along+side[1]*width*across,z],[u,v]));
    const first=faces.length;for(const k of [0,1,2,3,4,0,5,6,0,7,1,0,2,8,0,0,8,3,0,4,5,0,6,7])faces.push(skullIds[k]);
    parts.push({kind:'skull',ids,start,end,piece:index,free,vertices:skullIds,faces:[first,faces.length]});
  }
  const plan=edited?structuredClone(edited):pieces;
  plan.forEach((piece,index)=>piece.kind==='skull'?emitSkull(piece,index):emitStrip(piece,index));
  if(!faces.length)throw Error('The last Death pose has no measurable ground footprint.');
  // Native corpses give each kind of piece its own level: legs lowest, then
  // arms, hands, the rib cage and the skull on top. Overlapping pieces of one
  // kind (crossed arms) are lifted a quarter level apart, so nothing shares a
  // height and shimmers.
  const shapes=parts.map(part=>{const tris=[];for(let f=part.faces[0];f<part.faces[1];f+=3)tris.push([0,1,2].map(k=>[vertices[faces[f+k]*3],vertices[faces[f+k]*3+1]]));return tris;});
  const boxes=shapes.map(tris=>{const ps=tris.flat();return [0,1].flatMap(a=>[Math.min(...ps.map(p=>p[a])),Math.max(...ps.map(p=>p[a]))]);});
  const touches=(i,j)=>boxes[i][0]<boxes[j][1]&&boxes[j][0]<boxes[i][1]&&boxes[i][2]<boxes[j][3]&&boxes[j][2]<boxes[i][3]&&shapes[i].some(a=>shapes[j].some(b=>trianglesOverlap(a,b,span*1e-4)));
  const rank={leg:0,arm:1,branch:1,hand:1.5,torso:2,'rigid remnant':2,skull:3},kindOf=part=>rank[part.kind]??1;
  for(const [i,part] of parts.entries()){const taken=new Set(parts.slice(0,i).filter((other,j)=>kindOf(other)===kindOf(part)&&touches(i,j)).map(other=>other.lift));let lift=0;while(taken.has(lift))lift++;part.lift=lift;part.level=kindOf(part)+lift*.25;}
  // Many overlapping pieces of one kind can climb to the next kind's level:
  // keep every overlapping pair, of any kind, at least a fifth of a level apart.
  const settled=[];
  for(const i of parts.map((_,k)=>k).sort((a,b)=>parts[a].level-parts[b].level||a-b)){while(settled.some(j=>touches(i,j)&&Math.abs(parts[j].level-parts[i].level)<.2))parts[i].level+=.25;settled.push(i);}
  const base=Math.max(1.5,bodyHeight*NATIVE.base),step=Math.max(1.5,bodyHeight*NATIVE.step);
  for(const part of parts) {
    const z=base+part.level*step,rise=Math.max(step,bodyHeight*NATIVE.crown-z);
    // The skull's crown reaches the native 43% of the body's height.
    for(const id of part.vertices)vertices[id*3+2]=part.kind==='skull'?z+vertices[id*3+2]*rise:z;
    delete part.faces;
  }
  // The footprint gives the window's chalk outline of the dead body: the
  // body only, without what it holds or wears as equipment.
  const equipment=id=>held(id)||ancestors(id).some(a=>accessory.test(byId.get(a)?.Name||'')&&!/hand|foot|ref\b/i.test(byId.get(a)?.Name||''));
  const projected=[];
  for(const {g,vertices:v} of meshes)for(let i=0;i<g.Faces.length;i+=3){
    const ids=Array.from(g.Faces.slice(i,i+3));if(ids.every(k=>{const bones=influences(g,k);return bones.length&&bones.every(equipment);}))continue;
    const tri=ids.map(id=>[v[id*3],v[id*3+1]]);if(signedArea(tri)<0)tri.reverse();if(signedArea(tri)>span*span*1e-12)projected.push(tri);
  }
  const footprint=booleanContours(projected,[],'add',span);
  // The user's Size and Height choice, about the dead body's centre, which
  // stays put while pieces are edited.
  const center=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2];
  if(size!==1||height!==1)for(let i=0;i<vertices.length;i+=3){vertices[i]=center[0]+(vertices[i]-center[0])*size;vertices[i+1]=center[1]+(vertices[i+1]-center[1])*size;vertices[i+2]*=height;}
  if(vertices.length/3>65535)throw Error('The fitted corpse exceeds the MDX vertex limit.');
  const normals=new Float32Array(vertices.length);
  for(let f=0;f<faces.length;f+=3){const [a,b,c]=faces.slice(f,f+3).map(i=>new Vector3().fromArray(vertices,i*3)),n=b.sub(a).cross(c.sub(a));for(const id of faces.slice(f,f+3)){normals[id*3]+=n.x;normals[id*3+1]+=n.y;normals[id*3+2]+=n.z;}}
  for(let i=0;i<normals.length;i+=3){const n=new Vector3().fromArray(normals,i).normalize();n.toArray(normals,i);}
  const geoset={Vertices:new Float32Array(vertices),Normals:normals,TVertices:[new Float32Array(uv)],Faces:new Uint16Array(faces),VertexGroup:new Uint8Array(vertices.length/3),Groups:[],TotalGroupsCount:1,MaterialID:0,SelectionGroup:0,Unselectable:false,Anims:[]};
  updateBounds(geoset);
  // The body's outline on the ground, for the window's chalk outline.
  const outline=polygonGroups(footprint).flatMap(({outer,holes})=>[outer,...holes]);
  return {geoset,parts,pieces:plan,outline,sizeCenter:center,ground,span,bodyBounds:{min:lo,max:hi},frame,bodyIds};
}
