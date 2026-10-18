import { Vector2, Vector3, ShapeUtils, Triangle } from 'three';
import { cutForgeShape, forgeEdgeKey, forgeFaceNormal, forgeSelectionVertices } from './forge-shape-editing.js';
import { TRIANGLE_ICON_UV } from './forge-primitives.js';

const add = (a,b) => a.map((n,i)=>n+b[i]), sub = (a,b) => a.map((n,i)=>n-b[i]), mul = (a,s) => a.map(n=>n*s);
const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0), cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a,1/(Math.hypot(...a)||1));
export const clamp = (n,a,b) => Math.min(b,Math.max(a,n));

export function forgeMoldBounds(draft) {
  const points = draft.shapes.flatMap(s=>forgeSelectionVertices(s,draft.selection[s.id],draft.mode).map(i=>s.vertices[i]));
  if (!points.length) throw Error('Select a piece or part to shape.');
  const min=[0,1,2].map(a=>Math.min(...points.map(p=>p[a]))),max=[0,1,2].map(a=>Math.max(...points.map(p=>p[a])));
  return {min,max,center:min.map((n,a)=>(n+max[a])/2),span:min.map((n,a)=>max[a]-n)};
}

export function forgeMoldState(draft, tool) {
  const bounds=forgeMoldBounds(draft), axis=bounds.span.indexOf(Math.max(...bounds.span));
  return {tool,bounds,axis,direction:axis===2?0:2,center:bounds.center[axis],width:bounds.span[axis],amount:0,round:false};
}

// Add cross sections through solid shapes as well as flat regions. Face-only
// edits stitch their neighboring faces through the existing Cut implementation.
export function prepareForgeMold(draft, state) {
  if (!['Bend','Bulge','Twist'].includes(state.tool)) return draft;
  const {axis,center,width,bounds}=state, lo=Math.max(bounds.min[axis],center-width/2),hi=Math.min(bounds.max[axis],center+width/2);
  if (hi-lo<1e-6) return draft;
  const direction=[0,0,0];direction[axis]=1;
  const shapes=draft.shapes.map(source=>{
    const selected=draft.selection[source.id]||[];
    if(!selected.length)return source;
    const originalIds=new Set(forgeSelectionVertices(source,selected,draft.mode));
    const faces=draft.mode==='Shape'?undefined:source.faces.filter(f=>f.triangles.every(t=>t.vertices.every(i=>originalIds.has(i)))).map(f=>f.id);
    if(faces&&!faces.length)return source;
    const values=source.vertices.map(p=>p[axis]), min=Math.min(...values),max=Math.max(...values),span=max-min;
    if(span<1e-6)return source;
    const cuts=Array.from({length:13},(_,i)=>(lo+(hi-lo)*i/12-min)/span);
    return cutForgeShape(source,{direction,min,max},cuts,faces);
  });
  const selection=Object.fromEntries(shapes.map((s,i)=>{
    const old=draft.shapes[i],chosen=draft.selection[s.id]||[];
    if(!chosen.length||draft.mode==='Shape')return [s.id,chosen];
    const oldVertices=new Set(forgeSelectionVertices(old,chosen,draft.mode));
    if(draft.mode==='Edges')return [s.id,[...oldVertices,...s.vertices.flatMap((_,i)=>i>=old.vertices.length?[i]:[])]];
    if(s===old)return [s.id,chosen];
    if(draft.mode==='Faces')return [s.id,s.faces.filter(f=>chosen.includes(f.id)||f.id>=old.nextFaceId).map(f=>f.id)];
    return [s.id,[...oldVertices,...s.vertices.flatMap((_,i)=>i>=old.vertices.length?[i]:[])]];
  }));
  return {...draft,shapes,selection,mode:draft.mode==='Edges'?'Vertices':draft.mode};
}

export function deformForgeMold(prepared,state) {
  const {tool,axis,direction,amount,center,width,bounds}=state;
  if(!amount)return prepared;
  if(![0,1,2].includes(axis)||!Number.isFinite(amount)||axis===direction)throw Error('Choose a valid shaping direction.');
  const lo=center-width/2,hi=center+width/2,length=Math.max(width,1e-6),perp=[0,1,2].filter(a=>a!==axis);
  const shapes=prepared.shapes.map(source=>{
    const ids=new Set(forgeSelectionVertices(source,prepared.selection[source.id],prepared.mode));
    if(!ids.size)return source;
    const shape=structuredClone(source);shape.committed=false;
    for(const id of ids){
      const p=source.vertices[id],q=p.map((n,a)=>n-bounds.center[a]),out=[...p],t=clamp((p[axis]-lo)/length,0,1);
      if(tool==='Bend'){
        // Integrate a constant-curvature middle section with straight tails.
        const theta=amount*Math.PI/180,k=theta/length,s=p[axis]-center,inside=clamp(s,-length/2,length/2),a=inside*k,tail=s-inside,r=q[direction];
        out[axis]=center+Math.sin(a)/k+r*Math.sin(a)+tail*Math.cos(a);
        out[direction]=bounds.center[direction]+(Math.cos(a)-1)/k+r*Math.cos(a)-tail*Math.sin(a);
      }else if(tool==='Twist'){
        const a=amount*Math.PI/180*t,c=Math.cos(a),s=Math.sin(a),[u,v]=perp;
        out[u]=bounds.center[u]+q[u]*c-q[v]*s;out[v]=bounds.center[v]+q[u]*s+q[v]*c;
      }else{
        const weight=tool==='Bulge'?Math.sin(Math.PI*t)**2:clamp((p[axis]-bounds.min[axis])/Math.max(bounds.span[axis],1e-6),0,1);
        const factor=1+amount*weight;
        if(factor<.05)throw Error('Keep a little thickness; this amount would collapse the piece.');
        for(const a of perp)out[a]=bounds.center[a]+q[a]*factor;
      }
      if(out.some(n=>!Number.isFinite(n)))throw Error('The shaping amount is invalid.');
      shape.vertices[id]=out;
    }
    for(const f of shape.faces)if(f.triangles.some(t=>t.vertices.some(i=>ids.has(i))))for(const t of f.triangles)t.normals=undefined;
    return shape;
  });
  return {...prepared,shapes};
}

function polygonFace(shape,ids,face,source) {
  ids=ids.filter((id,i)=>id!==ids[(i+ids.length-1)%ids.length]);
  if(new Set(ids).size<3)return null;
  const normal=unit(ids.reduce((n,id,i)=>add(n,cross(shape.vertices[id],shape.vertices[ids[(i+1)%ids.length]])),[0,0,0]));
  const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),uvAxes=[0,1,2].filter(a=>a!==axis);
  const points=ids.map(id=>new Vector2(...uvAxes.map(a=>shape.vertices[id][a])));
  // Triangulate without collinear corners, then split the boundary triangles
  // to restore those exact shared vertices (cuts must never become T-junctions).
  const contour=points.map((_,i)=>i),scale=Math.max(1,...points.map(p=>p.length()));
  let removed=true;
  while(removed&&contour.length>3){
    removed=false;
    for(let i=0;i<contour.length;i++){
      const a=points[contour[(i+contour.length-1)%contour.length]],b=points[contour[i]],c=points[contour[(i+1)%contour.length]];
      const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if(Math.abs(area)<scale*scale*1e-10&&(b.x-a.x)*(b.x-c.x)+(b.y-a.y)*(b.y-c.y)<=1e-9){contour.splice(i,1);removed=true;break;}
    }
  }
  let triangles=ShapeUtils.triangulateShape(contour.map(i=>points[i]),[]).map(t=>t.map(i=>contour[i]));
  for(let i=0;i<contour.length;i++){
    const a=contour[i],b=contour[(i+1)%contour.length],middle=[];
    for(let j=(a+1)%ids.length;j!==b;j=(j+1)%ids.length)middle.push(j);
    if(!middle.length)continue;
    const index=triangles.findIndex(t=>t.includes(a)&&t.includes(b));
    if(index<0)throw Error('This edge could not be beveled cleanly.');
    const triangle=triangles[index],opposite=triangle.find(v=>v!==a&&v!==b),chain=[a,...middle,b];
    triangles.splice(index,1,...chain.slice(0,-1).map((v,j)=>[v,chain[j+1],opposite]));
  }
  const uvFor=position=>{
    if(!face)return null;
    let best;
    for(const t of face.triangles){
      const bary=Triangle.getBarycoord(new Vector3(...position),...t.vertices.map(id=>new Vector3(...source.vertices[id])),new Vector3());
      if(!bary)continue;
      const weights=bary.toArray(),penalty=weights.reduce((n,w)=>n+Math.max(0,-w),0);
      if(!best||penalty<best.penalty)best={penalty,uv:[0,1].map(a=>weights.reduce((n,w,i)=>n+w*t.uv[i*2+a],0))};
    }
    return best?.uv||[0,0];
  };
  return {id:face?.id??shape.nextFaceId++,vertices:ids,triangles:triangles.map(corners=>{
    let vertices=corners.map(i=>ids[i]);
    const area = points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%points.length].y-p.y*points[(i+1)%points.length].x,0), [a,b,c] = corners.map(i=>points[i]);
    if(((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*area<0)vertices.reverse();
    return {vertices,uv:face?vertices.flatMap(i=>uvFor(shape.vertices[i])):[...TRIANGLE_ICON_UV]};
  })};
}

export function bevelForgeShape(source,selected,mode,amount,round=false) {
  if(amount<=1e-8)return source;
  const edges=new Map(),normals=new Map(source.faces.map(f=>[f.id,forgeFaceNormal(source,f)]));
  for(const f of source.faces)f.vertices.forEach((a,i)=>{const b=f.vertices[(i+1)%f.vertices.length],key=forgeEdgeKey(a,b);if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key).faces.push(f);});
  const chosenVertices=new Set(forgeSelectionVertices(source,selected,mode)),chosenFaces=new Set(selected),chosenEdges=new Set(selected);
  const picked=new Set([...edges].filter(([key,e])=>e.faces.length===2&&dot(normals.get(e.faces[0].id),normals.get(e.faces[1].id))<.9999&&(mode==='Shape'||mode==='Edges'&&chosenEdges.has(key)||mode==='Faces'&&e.faces.some(f=>chosenFaces.has(f.id))||mode==='Vertices'&&chosenVertices.has(e.a)&&chosenVertices.has(e.b))).map(([key])=>key));
  if(!picked.size)throw Error('Select a solid corner or an edge between two surfaces to bevel.');
  const shortest=Math.min(...[...edges.values()].map(e=>Math.hypot(...sub(source.vertices[e.a],source.vertices[e.b]))).filter(n=>n>1e-6));
  const distance=Math.min(amount,shortest*.24),corner=new Map(),key=(f,v)=>f+':'+v;
  for(const f of source.faces)f.vertices.forEach((v,i)=>{
    const before=f.vertices[(i+f.vertices.length-1)%f.vertices.length],after=f.vertices[(i+1)%f.vertices.length],normal=normals.get(f.id);
    const n1=unit(cross(normal,sub(source.vertices[v],source.vertices[before]))),n2=unit(cross(normal,sub(source.vertices[after],source.vertices[v])));
    const d1=picked.has(forgeEdgeKey(before,v))?distance:0,d2=picked.has(forgeEdgeKey(v,after))?distance:0,c=dot(n1,n2),den=1-c*c;
    const delta=den>1e-8?add(mul(n1,(d1-c*d2)/den),mul(n2,(d2-c*d1)/den)):mul(n1,Math.max(d1,d2));
    corner.set(key(f.id,v),add(source.vertices[v],delta));
  });
  const ends=new Map();
  for(const [edgeKey,e]of edges)if(!picked.has(edgeKey))for(const [v,other]of [[e.a,e.b],[e.b,e.a]]){
    const p=source.vertices[v],line=sub(source.vertices[other],p),length=dot(line,line);
    const t=Math.max(0,...e.faces.map(f=>dot(sub(corner.get(key(f.id,v)),p),line)/length));
    ends.set(edgeKey+'/'+v,add(p,mul(line,t)));
    for(const f of e.faces)if(Math.hypot(...sub(corner.get(key(f.id,v)),p))>1e-8)corner.set(key(f.id,v),add(p,mul(line,t)));
  }
  const shape={...source,vertices:[],faces:[],committed:false},welded=new Map(),origins=[];
  const vertex=(p,origin)=>{const k=origin+':'+p.map(n=>Math.round(n*1e7)).join(':');if(!welded.has(k)){welded.set(k,shape.vertices.length);shape.vertices.push(p);origins.push(origin);}return welded.get(k);};
  const faceCorners=new Map();
  for(const f of source.faces){
    const ids=f.vertices.flatMap((v,i)=>{
      const before=f.vertices[(i+f.vertices.length-1)%f.vertices.length],after=f.vertices[(i+1)%f.vertices.length],inKey=forgeEdgeKey(before,v),outKey=forgeEdgeKey(v,after);
      if(picked.has(inKey)||picked.has(outKey)){const id=vertex(corner.get(key(f.id,v)),v);faceCorners.set(key(f.id,v),id);return [id];}
      return [vertex(ends.get(inKey+'/'+v)||source.vertices[v],v),vertex(ends.get(outKey+'/'+v)||source.vertices[v],v)];
    });
    const next=polygonFace(shape,ids,f,source);if(next)shape.faces.push(next);
  }
  for(const edgeKey of picked){
    const {a,b,faces:[first,second]}=edges.get(edgeKey);
    const i=first.vertices.indexOf(a),forward=first.vertices[(i+1)%first.vertices.length]===b,[u,v]=forward?[a,b]:[b,a];
    const A=faceCorners.get(key(first.id,u)),B=faceCorners.get(key(first.id,v)),C=faceCorners.get(key(second.id,v)),D=faceCorners.get(key(second.id,u)),segments=round?4:1;
    const line = unit(sub(source.vertices[b],source.vertices[a]));
    const arc=(start,end,origin,t)=>{
      const control = add(source.vertices[origin],mul(line,dot(sub(mul(add(shape.vertices[start],shape.vertices[end]),.5),source.vertices[origin]),line)));
      return vertex(add(add(mul(shape.vertices[start],(1-t)**2),mul(control,2*t*(1-t))),mul(shape.vertices[end],t*t)),origin);
    };
    let left=A,right=B;
    for(let n=1;n<=segments;n++){
      const l=n===segments?D:arc(A,D,u,n/segments),r=n===segments?C:arc(B,C,v,n/segments);
      const face=polygonFace(shape,[right,left,l,r]);if(face)shape.faces.push(face);left=l;right=r;
    }
  }
  // Close only the new holes around beveled vertices. Original open borders stay open.
  const boundary=new Map();
  for(const f of shape.faces)f.vertices.forEach((a,i)=>{const b=f.vertices[(i+1)%f.vertices.length],k=forgeEdgeKey(a,b);if(boundary.has(k))boundary.delete(k);else boundary.set(k,[a,b]);});
  const openCorners=new Set([...edges.values()].filter(e=>e.faces.length===1).flatMap(e=>[e.a,e.b]));
  const remaining=[...boundary.values()].filter(([a,b])=>origins[a]===origins[b]&&!openCorners.has(origins[a]));
  while(remaining.length){
    const edge=remaining.shift(),loop=[edge[1],edge[0]];let next;
    while(loop.at(-1)!==loop[0]&&(next=remaining.findIndex(e=>e[1]===loop.at(-1)))>=0){loop.push(remaining.splice(next,1)[0][0]);}
    if(loop.at(-1)!==loop[0])throw Error('This corner could not be beveled cleanly.');
    loop.pop();const face=polygonFace(shape,loop);if(face)shape.faces.push(face);
  }
  return shape;
}

export function previewForgeMold(draft,prepared,state) {
  if(!state.amount)return draft;
  if(state.tool==='Bevel')return {...draft,shapes:draft.shapes.map(s=>draft.selection[s.id]?.length?bevelForgeShape(s,draft.selection[s.id],draft.mode,state.amount,state.round):s),mode:'Shape',selection:Object.fromEntries(draft.shapes.filter(s=>draft.selection[s.id]?.length).map(s=>[s.id,['shape']]))};
  return deformForgeMold(prepared,state);
}
