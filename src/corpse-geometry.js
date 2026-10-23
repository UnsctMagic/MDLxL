import { ShapeUtils, Vector2, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, skinGeoset } from './animation.js';
import { suggestPoseRig, poseChainIds, poseNodeRole } from './pose-ik.js';
import { updateBounds } from './mesh-tools.js';
import { booleanContours, polygonGroups, signedArea } from './forge-geometry.js';

const mean = points => points.length ? points.reduce((sum,p) => sum.map((v,i) => v+p[i]/points.length), [0,0,0]) : null;
const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
const quantile = (values,t) => values.toSorted((a,b)=>a-b)[Math.floor((values.length-1)*t)];
const accessory = /weapon|sword|axe|shield|bow|staff|spear|hammer|gun|rifle|cape|cloth|hair|banner|rein|ribbon|glow|camera|event|attachment|ref\b|corpse|gutz/i;
const headAccessory = /flare|horn|hair|helmet|jaw|eye|ear|mouth/i;

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

function influences(g,i) {
  if(g.SkinWeights?.length >= (i+1)*8) return Array.from(g.SkinWeights.slice(i*8,i*8+4)).filter((id,k)=>g.SkinWeights[i*8+4+k]>=32);
  return Array.from(g.Groups?.[g.VertexGroup?.[i]]||[]);
}

/** Build a ground corpse from this model's joints and its skinned final Death
 * frame. No source-model names, vertex numbers or race/size presets are used. */
export function buildCorpseGeometry(model, bodyIds, deathIndex) {
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
  const ground=span*.012, margin=Math.max(span*.0002,1e-5), top=surface(meshes,span);
  const nodes=allNodes(model),byId=new Map(nodes.map(n=>[n.ObjectId,n])),clouds=new Map();
  for(const {g,vertices} of meshes) for(let i=0;i<g.Vertices.length/3;i++) for(const id of influences(g,i)) {
    const cloud=clouds.get(id)||[];cloud.push(Array.from(vertices.slice(i*3,i*3+3)));clouds.set(id,cloud);
  }
  const ancestors=id=>{const result=[],seen=new Set();while(byId.has(id)&&!seen.has(id)){seen.add(id);result.push(id);id=byId.get(id).Parent;}return result;};
  const hasSkin=id=>[...clouds.keys()].some(key=>ancestors(key).includes(id));
  const at=id=>new Vector3().fromArray(byId.get(id)?.PivotPoint||model.PivotPoints?.[id]||[0,0,0]).applyMatrix4(matrices.get(id)).toArray();
  const rig=suggestPoseRig(model,frame,deathIndex),chains=rig.chains.filter(c=>poseChainIds(c).some(hasSkin)&&!poseChainIds(c).some(id=>accessory.test(byId.get(id)?.Name||'')&&!/hand|foot|toe|hoof|ref\b/i.test(byId.get(id)?.Name||'')));
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
  const role=id=>rig.roles[id]||poseNodeRole(byId.get(id));
  const heads=nodes.filter(n=>role(n.ObjectId)==='Head'&&!headAccessory.test(n.Name)&&hasSkin(n.ObjectId)&&!ancestors(n.Parent).some(id=>role(id)==='Head'));
  const vertices=[],uv=[],faces=[],parts=[],used=new Set();
  function vertex(p,t) {
    const roof=top(p[0],p[1]);
    // Coverage changes height/width, never the joint-to-joint limb length.
    // Death meshes often penetrate the floor. Keep the corpse on the ground
    // like the native gutz meshes, rather than burying its limbs before decay.
    const z=Math.max(ground,Number.isFinite(roof)?Math.min(p[2],roof-margin):Math.min(p[2],ground));
    const i=vertices.length/3;vertices.push(p[0],p[1],z);uv.push(...t);return i;
  }
  function halfWidth(a,b,ids,factor=1) {
    const len=distance(a,b);if(len<1e-6)return span*.015;
    const d=[(b[0]-a[0])/len,(b[1]-a[1])/len], samples=ids.flatMap(cloud).filter(p=>{
      const along=(p[0]-a[0])*d[0]+(p[1]-a[1])*d[1];return along>=-len*.1&&along<=len*1.1;
    }).map(p=>Math.abs((p[0]-a[0])*d[1]-(p[1]-a[1])*d[0]));
    return samples.length?Math.max(span*.004,quantile(samples,.9)*factor):span*.035;
  }
  function strip(label,a,b,half,rect,ids=[]) {
    const len=distance(a,b);if(len<span*.0001)return;
    const normal=[(b[1]-a[1])/len,-(b[0]-a[0])/len], rows=[];
    for(let r=0;r<=4;r++) {
      const t=r/4,c=mix(a,b,t),pair=[];
      for(const side of [-1,1]) {
        let width=half,roof=top(c[0]+normal[0]*width*side,c[1]+normal[1]*width*side);
        if(Number.isFinite(top(c[0],c[1]))&&!Number.isFinite(roof)) {
          let low=0,high=width;for(let k=0;k<10;k++){const mid=(low+high)/2;if(Number.isFinite(top(c[0]+normal[0]*mid*side,c[1]+normal[1]*mid*side)))low=mid;else high=mid;}width=low;
        }
        pair.push(vertex([c[0]+normal[0]*width*side,c[1]+normal[1]*width*side,ground], [side<0?rect[0]:rect[2],rect[1]+t*(rect[3]-rect[1])]));
      }
      rows.push(pair);
    }
    for(let i=1;i<rows.length;i++){const [a,b]=rows[i-1],[c,d]=rows[i];faces.push(a,b,c,b,d,c);}
    parts.push({kind:label,start:a,end:b,length:len,ids,vertices:rows.flat()});
  }
  // Native gutz atlas: upper/lower long bones at left; palm/forearm in the
  // middle; ribs/pelvis at bottom right. Match every actual chain link.
  for(const chain of chains) {
    const ids=poseChainIds(chain);
    for(let i=1;i<ids.length;i++) {
      const key=[ids[i-1],ids[i]].sort().join(':');if(used.has(key))continue;used.add(key);
      const a=at(ids[i-1]),b=ids[i]===chain.end&&chain.grip?new Vector3().fromArray(chain.grip).applyMatrix4(matrices.get(chain.end)).toArray():at(ids[i]);
      const region=chain.kind==='arm'&&i===ids.length-1?[.315,1,.625,.75]:i%2?[.006,.005,.31,.495]:[.006,.505,.31,.995];
      strip(chain.kind,a,b,halfWidth(a,b,[ids[i-1],ids[i]]),region,[ids[i-1],ids[i]]);
    }
    const end=at(chain.end),skin=cloud(chain.end);
    if(chain.kind==='arm'&&skin.length) {
      const center=mean(skin),len=distance(end,center),dir=len>span*.002?[(center[0]-end[0])/len,(center[1]-end[1])/len]:null;
      if(dir) {
        const ordered=skin.toSorted((a,b)=>(b[0]-end[0])*dir[0]+(b[1]-end[1])*dir[1]-((a[0]-end[0])*dir[0]+(a[1]-end[1])*dir[1]));
        const tip=mean(ordered.slice(0,Math.max(1,Math.ceil(ordered.length*.1))));
        if(distance(end,tip)<span*.3)strip('hand',end,tip,halfWidth(end,tip,[chain.end]),[.315,.75,.625,.5],[chain.end]);
      }
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
    // The native gutz skull occupies the TOP RIGHT of the atlas. Its nine
    // surface landmarks retain a broad cranium and jaw, scaled to head skin.
    const shape=[[.489,.014,1,.808594,.21582],[0,.079,.223,.816406,.451172],[.234,.730,0,.910156,.369141],[.787,.737,.15,.917969,.124512],[1,-.091,.427,.789063,.012939],[.915,-.841,.201,.699219,.07373],[.489,-1,.36,.6875,.236328],[.234,-.755,.053,.695313,.376953],[.489,1,.29,.941406,.233398]];
    const skullIds=shape.map(([along,across,z,u,v])=>vertex([neck[0]+axis[0]*(near+length*along)+side[0]*width*across,neck[1]+axis[1]*(near+length*along)+side[1]*width*across,ground+z*Math.min(width,length*.45)],[u,v]));
    for(const index of [0,1,2,3,4,0,5,6,0,7,1,0,2,8,0,0,8,3,0,4,5,0,6,7])faces.push(skullIds[index]);
    parts.push({kind:'skull',ids:[id],start:neck,end:center,vertices:skullIds});
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
    const torso=torsos.get(key)||{necks:[],pelvis,ids:new Set()};torso.necks.push(neck);
    for(const i of [...headAncestors.slice(1),...hips.flatMap(ancestors)])if(!accessory.test(byId.get(i)?.Name||''))torso.ids.add(i);
    torsos.set(key,torso);
  }
  for(const {necks,pelvis,ids} of torsos.values()){const neck=mean(necks),trunkIds=[...ids];strip('torso',neck,pelvis,halfWidth(neck,pelvis,trunkIds),[.634,.505,.999,.995],trunkIds);}
  // Tails, wings and anonymous rigs retain their real articulated branches.
  // Geometry evidence excludes weapon/cloth branches; no humanoid-only template.
  const inferredAnatomy=parts.length>0;
  for(const node of nodes) {
    const parent=byId.get(node.Parent);if(!parent||accessory.test(node.Name)||accessory.test(parent.Name))continue;
    if(inferredAnatomy&&(node.GeosetId!==undefined||['Chest','Pelvis','Body','Spine'].includes(role(node.ObjectId))||chains.some(c=>c.root===node.ObjectId)&&!/leg|tail|wing/i.test(parent.Name)))continue;
    const key=[parent.ObjectId,node.ObjectId].sort().join(':');if(used.has(key))continue;
    const anatomical=/leg|shin|calf|arm|tail|wing|spine|neck|chest|pelvis|head|body|back|front|toe/i.test(node.Name);
    if(!hasSkin(node.ObjectId)||(!anatomical&&inferredAnatomy)||['Head','Hand','Foot','Hoof'].includes(role(node.ObjectId)))continue;
    const a=at(parent.ObjectId),b=at(node.ObjectId);
    if(distance(a,b)>span*.6)continue;
    strip('branch',a,b,halfWidth(a,b,[node.ObjectId,parent.ObjectId]),[.006,.005,.31,.495],[parent.ObjectId,node.ObjectId]);used.add(key);
  }
  if(!faces.length) {
    // A single rigid object has no joints. Its own surface's principal axis
    // supplies a fitted remnant, rather than fabricating arms and legs.
    const center=mean(points),xx=points.reduce((s,p)=>s+(p[0]-center[0])**2,0),yy=points.reduce((s,p)=>s+(p[1]-center[1])**2,0),xy=points.reduce((s,p)=>s+(p[0]-center[0])*(p[1]-center[1]),0),angle=.5*Math.atan2(2*xy,xx-yy),axis=[Math.cos(angle),Math.sin(angle)];
    const projection=points.map(p=>(p[0]-center[0])*axis[0]+(p[1]-center[1])*axis[1]);
    const a=[center[0]+axis[0]*quantile(projection,.1),center[1]+axis[1]*quantile(projection,.1),ground],b=[center[0]+axis[0]*quantile(projection,.9),center[1]+axis[1]*quantile(projection,.9),ground];
    strip('rigid remnant',a,b,span*.12,[.634,.505,.999,.995]);
  }
  if(!faces.length)throw Error('The last Death pose has no measurable ground footprint.');
  // Fit the complete textured pieces to the actual projected body outline.
  // Sampling only corner widths can still leave a triangle spanning empty
  // space between a bent limb and torso. Use the existing polygon owner to
  // trim those edges, retaining UVs and substantial interior body volume.
  const projected=[];
  for(const {g,vertices:v} of meshes)for(let i=0;i<g.Faces.length;i+=3){const tri=Array.from(g.Faces.slice(i,i+3),id=>[v[id*3],v[id*3+1]]);if(signedArea(tri)<0)tri.reverse();if(signedArea(tri)>span*span*1e-12)projected.push(tri);}
  const footprint=booleanContours(projected,[],'add',span),originalV=vertices.splice(0),originalUV=uv.splice(0),originalFaces=faces.splice(0),partOf=new Map();
  for(const part of parts){for(const id of part.vertices)partOf.set(id,part);part.vertices=[];}
  for(let i=0;i<originalFaces.length;i+=3) {
    const ids=originalFaces.slice(i,i+3),[a,b,c]=ids.map(id=>originalV.slice(id*3,id*3+3));
    const determinant=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(determinant)<1e-10)continue;
    const tri=[a.slice(0,2),b.slice(0,2),c.slice(0,2)];if(signedArea(tri)<0)tri.reverse();
    for(const {outer,holes} of polygonGroups(booleanContours([tri],footprint,'keep',span))) {
      const outline=outer.map(p=>new Vector2(...p)),voids=holes.map(h=>h.map(p=>new Vector2(...p))),local=[...outer,...holes.flat()],offset=vertices.length/3;
      for(const [x,y] of local){const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/determinant,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/determinant,weights=[u,v,1-u-v];const id=vertex([x,y,weights.reduce((z,w,j)=>z+w*originalV[ids[j]*3+2],0)],[0,1].map(axis=>weights.reduce((t,w,j)=>t+w*originalUV[ids[j]*2+axis],0)));partOf.get(ids[0]).vertices.push(id);}
      for(const t of ShapeUtils.triangulateShape(outline,voids))faces.push(...t.map(id=>offset+id));
    }
  }
  if(!faces.length)throw Error('The last Death pose has no measurable ground footprint.');
  if(vertices.length/3>65535)throw Error('The fitted corpse exceeds the MDX vertex limit.');
  const normals=new Float32Array(vertices.length);
  for(let f=0;f<faces.length;f+=3){const [a,b,c]=faces.slice(f,f+3).map(i=>new Vector3().fromArray(vertices,i*3)),n=b.sub(a).cross(c.sub(a));for(const id of faces.slice(f,f+3)){normals[id*3]+=n.x;normals[id*3+1]+=n.y;normals[id*3+2]+=n.z;}}
  for(let i=0;i<normals.length;i+=3){const n=new Vector3().fromArray(normals,i).normalize();n.toArray(normals,i);}
  const geoset={Vertices:new Float32Array(vertices),Normals:normals,TVertices:[new Float32Array(uv)],Faces:new Uint16Array(faces),VertexGroup:new Uint8Array(vertices.length/3),Groups:[],TotalGroupsCount:1,MaterialID:0,SelectionGroup:0,Unselectable:false,Anims:[]};
  updateBounds(geoset);
  return {geoset,parts,ground,span,bodyBounds:{min:lo,max:hi},frame,bodyIds};
}
