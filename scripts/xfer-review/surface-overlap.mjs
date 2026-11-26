// Material-indexed winding and occlusion checks on posed triangles. Broad-phase
// bounds only discard points outside the torso or pixels outside the head.
const RASTER = 300;
export function overlapGroups(model,head,trunk,arms) {
  const classes=model.Geosets.map(g=>new Uint8Array(g.Vertices.length/3));
  for(const p of trunk)classes[p.gi][p.vi]=1;
  for(const p of head)classes[p.gi][p.vi]=2;
  const faces=model.Geosets.map((g,gi)=>{
    const dest={head:[],body:[],other:[]},cls=classes[gi];
    for(let i=0;i<g.Faces.length;i+=3){
      const a=g.Faces[i],b=g.Faces[i+1],c=g.Faces[i+2];
      const part=cls[a]===cls[b]&&cls[b]===cls[c]?cls[a]:0;
      (part===2?dest.head:dest.other).push(a*3,b*3,c*3);
      if(part===1)dest.body.push(a*3,b*3,c*3);
    }
    return dest;
  });
  const distal=arms.flatMap(a=>a.bands.slice(1).flat());
  return {faces,distal};
}

function solidAngle(s,a,b,c,x,y,z){
  const ax=s[a]-x,ay=s[a+1]-y,az=s[a+2]-z;
  const bx=s[b]-x,by=s[b+1]-y,bz=s[b+2]-z;
  const cx=s[c]-x,cy=s[c+1]-y,cz=s[c+2]-z;
  const al=Math.sqrt(ax*ax+ay*ay+az*az),bl=Math.sqrt(bx*bx+by*by+bz*bz),cl=Math.sqrt(cx*cx+cy*cy+cz*cz);
  const det=ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx);
  const den=al*bl*cl+(ax*bx+ay*by+az*bz)*cl+(bx*cx+by*cy+bz*cz)*al+(cx*ax+cy*ay+cz*az)*bl;
  return 2*Math.atan2(det,den);
}

export function insideTorso(layout,skin){
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],mesh=[];
  for(let gi=0;gi<skin.length;gi++){
    const v=skin[gi],indices=layout.faces[gi].body;
    if(!v||!indices.length)continue;
    mesh.push([v,indices]);
    for(const i of indices)for(let axis=0;axis<3;axis++){lo[axis]=Math.min(lo[axis],v[i+axis]);hi[axis]=Math.max(hi[axis],v[i+axis]);}
  }
  if(!mesh.length)return null;
  let inside=0,tested=0;
  for(const p of layout.distal){
    const s=skin[p.gi];if(!s)continue;
    const i=3*p.vi,x=s[i],y=s[i+1],z=s[i+2];tested++;
    if(x<lo[0]||x>hi[0]||y<lo[1]||y>hi[1]||z<lo[2]||z>hi[2])continue;
    let angle=0;
    for(const [v,indices] of mesh)for(let t=0;t<indices.length;t+=3)
      angle+=solidAngle(v,indices[t],indices[t+1],indices[t+2],x,y,z);
    if(Math.abs(angle)>2*Math.PI)inside++;
  }
  return tested?inside/tested:null;
}

export function headVisibility(layout,skin,front) {
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,hasHead=false;
  const axis=front?1:0,depth=front?0:1,sign=front?1:-1;
  for(let gi=0;gi<skin.length;gi++){
    const v=skin[gi];if(!v)continue;
    hasHead ||= layout.faces[gi].head.length>0;
    for(let i=0;i<v.length;i+=3){x0=Math.min(x0,v[i+axis]);x1=Math.max(x1,v[i+axis]);z0=Math.min(z0,v[i+2]);z1=Math.max(z1,v[i+2]);}
  }
  if(!hasHead || x1<=x0||z1<=z0)return null;
  const scale=(RASTER-10)/Math.max(x1-x0,z1-z0);
  const ox=RASTER/2-(x0+x1)*.5*scale,oy=RASTER/2+(z0+z1)*.5*scale;
  let left=RASTER,right=0,top=RASTER,bottom=0;
  for(let gi=0;gi<skin.length;gi++){
    const v=skin[gi];if(!v)continue;
    for(const i of layout.faces[gi].head){
      const x=ox+v[i+axis]*scale,y=oy-v[i+2]*scale;
      left=Math.min(left,Math.floor(x));right=Math.max(right,Math.ceil(x));top=Math.min(top,Math.floor(y));bottom=Math.max(bottom,Math.ceil(y));
    }
  }
  const width=right-left+1,height=bottom-top+1;
  if(width<1||height<1)return null;
  const head=new Float32Array(width*height).fill(-Infinity),other=new Float32Array(width*height).fill(-Infinity);
  function raster(v,indices,buffer){
    for(let t=0;t<indices.length;t+=3){
      const a=indices[t],b=indices[t+1],c=indices[t+2];
      const ax=ox+scale*v[a+axis],ay=oy-scale*v[a+2],bx=ox+scale*v[b+axis],by=oy-scale*v[b+2],cx=ox+scale*v[c+axis],cy=oy-scale*v[c+2];
      const xmin=Math.max(left,Math.floor(Math.min(ax,bx,cx))),xmax=Math.min(right,Math.ceil(Math.max(ax,bx,cx)));
      const ymin=Math.max(top,Math.floor(Math.min(ay,by,cy))),ymax=Math.min(bottom,Math.ceil(Math.max(ay,by,cy)));
      const area=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);
      if(xmin>xmax||ymin>ymax||Math.abs(area)<1e-9)continue;
      const da=sign*v[a+depth],db=sign*v[b+depth],dc=sign*v[c+depth];
      for(let y=ymin;y<=ymax;y++)for(let x=xmin;x<=xmax;x++){
        const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/area,vv=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/area,w=1-u-vv;
        if(u<0||vv<0||w<0)continue;
        const i=(y-top)*width+x-left;
        buffer[i]=Math.max(buffer[i],u*da+vv*db+w*dc);
      }
    }
  }
  for(let gi=0;gi<skin.length;gi++)if(skin[gi]){
    raster(skin[gi],layout.faces[gi].head,head);
    raster(skin[gi],layout.faces[gi].other,other);
  }
  let n=0,shown=0;for(let i=0;i<head.length;i++)if(Number.isFinite(head[i])){n++;if(head[i]>=other[i])shown++;}
  return n?shown/n:null;
}