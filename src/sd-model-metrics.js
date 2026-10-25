import { sampleGeosetAnimation } from './animation.js';

const point = (g, i) => Array.from(g.Vertices.subarray(i * 3, i * 3 + 3));
const dot = (a,b) => a.reduce((s,v,i) => s + v*b[i], 0);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const length = a => Math.hypot(...a);
const unit = a => a.map(v => v/(length(a)||1));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const partKind = name => {
  name = String(name).split(':').at(-1).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[0-9_.-]/g, ' ');
  if (/grass|surface/i.test(name)) return null;
  for (const [kind,re] of [
    ['shoulder',/shoulder|pauldron/i], ['hand',/hand|fist|palm/i], ['foot',/foot|feet|boot|hoof/i],
    ['head',/head|face|skull/i], ['helmet',/helmet|helm/i], ['torso',/chest|torso|ribcage/i],
    ['arm',/forearm|upperarm|(?:^|[_ .])arm|bicep/i], ['leg',/thigh|calf|shin|(?:^|[_ .])leg/i],
    ['blade',/blade|sword|cleaver/i], ['axe',/axe/i], ['hammer',/hammer|mace/i],
    ['shaft',/shaft|handle|staff/i], ['guard',/guard/i], ['pommel',/pommel/i], ['shield',/shield/i],
    ['cape',/cape|cloak/i], ['cloth',/cloth|banner|flag|skirt|robe/i], ['hair',/hair|beard|mane/i],
    ['wing',/wing/i], ['tail',/tail/i], ['horn',/horn|tusk|spike/i], ['roof',/roof/i], ['trunk',/trunk|stem/i],
  ]) if (new RegExp('(?:^|[^a-z])(?:' + re.source + ')(?=[^a-z]|$)', 'i').test(name)) return kind;
  return null;
};

/** Join positional seams for measurement only. Never weld or change the model. */
export function meshComponents(g) {
  const count = g.Vertices.length / 3, parent = Array.from({length:count},(_,i)=>i), positions = new Map();
  const find = i => { while (parent[i] !== i) {parent[i] = parent[parent[i]]; i = parent[i];} return i; };
  const join = (a,b) => {parent[find(a)] = find(b);};
  for(let i=0;i<count;i++) {
    const key=point(g,i).map(v=>Math.round(v*10000)).join(',');
    if(positions.has(key)) join(i,positions.get(key)); else positions.set(key,i);
  }
  for(let i=0;i<g.Faces.length;i+=3) {join(g.Faces[i],g.Faces[i+1]); join(g.Faces[i],g.Faces[i+2]);}
  const parts=new Map();
  for(let f=0;f<g.Faces.length/3;f++) {const root=find(g.Faces[f*3]); if(!parts.has(root)) parts.set(root,[]); parts.get(root).push(f);}
  return [...parts.values()];
}

/** Detect actual polygon rings, rather than guessing sides from triangle totals.
 * PCA and the three model axes are tried. A ring must be planar, approximately
 * circular, surround its centre, and contain >=3 distinct perimeter positions.
 * Irregular/sculpted/flat parts deliberately return no side estimate. */
export function roundPartSides(points) {
  points=[...new Map(points.map(p=>[p.map(v=>Math.round(v*100000)).join(','),p])).values()];
  if(points.length<6) return null;
  const center=[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length), centered=points.map(p=>sub(p,center));
  const cov=[0,1,2].map(i=>[0,1,2].map(j=>centered.reduce((s,p)=>s+p[i]*p[j],0)));
  let axis=unit([1,.73,.37]); for(let n=0;n<24;n++) axis=unit(cov.map(row=>dot(row,axis)));
  const span=Math.max(...[0,1,2].map(k=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k]))));
  if(!span) return null;
  let best=null;
  for(const a of [axis,[1,0,0],[0,1,0],[0,0,1]]) {
    const rings=new Map(), tolerance=span*0.0001;
    for(const p of points) {const t=dot(sub(p,center),a), key=Math.round(t/tolerance); if(!rings.has(key)) rings.set(key,[]); rings.get(key).push(p);}
    const matches=[];
    for(const ring of rings.values()) {
      const c=[0,1,2].map(k=>ring.reduce((s,p)=>s+p[k],0)/ring.length);
      const unique=[...new Map(ring.map(p=>[p.map(v=>Math.round(v/tolerance)).join(','),p])).values()];
      const radii=unique.map(p=>length(sub(p,c))).sort((a,b)=>a-b), mid=radii[Math.floor(radii.length/2)];
      const perimeter=unique.filter(p=>length(sub(p,c))>mid*.5), rs=perimeter.map(p=>length(sub(p,c)));
      if(perimeter.length<3||perimeter.length>64||!mid||Math.max(...rs)/Math.min(...rs)>1.3) continue;
      const u=unit(sub(perimeter[0],c)),v=cross(a,u);
      const angles=perimeter.map(p=>Math.atan2(dot(sub(p,c),v),dot(sub(p,c),u))).sort((a,b)=>a-b);
      const gaps=angles.map((x,i)=>(i+1<angles.length?angles[i+1]:angles[0]+Math.PI*2)-x);
      if(Math.max(...gaps)>Math.PI*.95) continue;
      matches.push({sides:perimeter.length, center:dot(sub(c,center),a)});
    }
    if(matches.length<2 || Math.max(...matches.map(x=>x.center))-Math.min(...matches.map(x=>x.center))<span*.15) continue;
    const candidate={sides:Math.max(...matches.map(x=>x.sides)),rings:matches.length,confidence:'measured planar rings'};
    if(!best||candidate.rings>best.rings) best=candidate;
  }
  return best;
}

export function measurePart(g, faces) {
  const ids=[...new Set(faces.flatMap(f=>Array.from(g.Faces.subarray(f*3,f*3+3))))];
  const points=ids.map(i=>point(g,i));
  const min=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))),max=[0,1,2].map(k=>Math.max(...points.map(p=>p[k])));
  let smoothCorners=0,corners=0;
  for(const f of faces) {
    const tri=Array.from(g.Faces.subarray(f*3,f*3+3)),[a,b,c]=tri.map(i=>point(g,i));
    const normal=unit(cross(sub(b,a),sub(c,a)));
    if(!length(normal)) continue;
    for(const id of tri) {const n=Array.from(g.Normals?.subarray(id*3,id*3+3)||[]); if(n.length!==3||length(n)<1e-8) continue; corners++; if(Math.abs(dot(unit(n),normal))<.985) smoothCorners++;}
  }
  return {triangles:faces.length,vertices:ids.length,extent:max.map((v,k)=>v-min[k]),bounds:{min,max},round:roundPartSides(points),smoothCornerFraction:corners?smoothCorners/corners:null};
}

/** Bone territories are proxies, not anatomical segmentation. Classification
 * names are reported with the method so an ambiguous region is never sold as a
 * measured individual finger, blade or muscle. */
export function measureModelParts(model,{frame,sequence,includeUnknown=true}={}) {
  const stand=sequence??model.Sequences?.findIndex(s=>/^stand(?:\b|\s)/i.test(s.Name));
  const time=frame??model.Sequences?.[stand]?.Interval?.[0]??0;
  const nodes=new Map([...(model.Bones||[]),...(model.Helpers||[])].map(b=>[b.ObjectId,b.Name||'']));
  const parts=[];
  for(let gi=0;gi<(model.Geosets||[]).length;gi++) {
    const g=model.Geosets[gi]; if(sampleGeosetAnimation(model,gi,time,stand<0?null:stand).alpha<=.01) continue;
    const regions=new Map();
    for(let f=0;f<g.Faces.length/3;f++) {
      const votes=new Map();
      for(const id of g.Faces.subarray(f*3,f*3+3)) for(const bone of g.Groups?.[g.VertexGroup?.[id]]||[]) {
        const name=nodes.get(bone)||'',kind=partKind(name); if(kind) votes.set(bone,(votes.get(bone)||0)+1);
      }
      const winner=[...votes].sort((a,b)=>b[1]-a[1])[0];
      if(winner&&winner[1]>=2) {if(!regions.has(winner[0])) regions.set(winner[0],[]); regions.get(winner[0]).push(f);}
    }
    const assigned=new Set([...regions.values()].flat());
    for(const [bone,faces] of regions) parts.push({geosetId:gi,kind:partKind(nodes.get(bone)),boneId:bone,label:nodes.get(bone),method:'named bone territory; majority triangle corner membership',confidence:'medium',...measurePart(g,faces)});
    if(includeUnknown) for(const faces of meshComponents(g)) {
      const remaining=faces.filter(f=>!assigned.has(f)); if(!remaining.length) continue;
      parts.push({geosetId:gi,componentId:faces[0],kind:partKind(g.Name||''),label:g.Name||'unclassified connected surface',method:'positional connected component; seams joined for measurement only',confidence:partKind(g.Name||'')?'medium':'unclassified',...measurePart(g,remaining)});
    }
  }
  const height=parts.length?Math.max(...parts.map(p=>p.bounds.max[2]))-Math.min(...parts.map(p=>p.bounds.min[2])):0;
  for(const p of parts) p.heightRatio=height?p.extent[2]/height:null;
  return parts;
}
