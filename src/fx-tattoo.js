// Team tattoos (owner, 14 November: "think really old school tribals ... he has to do some cut-paste-triangle magic
// to produce patterns with what we have to work with"). The player's colour exists only as a flat colour, so a design
// in that colour cannot be a picture: it is a shape. A tribal design here is a handful of blades (curved, pointed at
// both ends) drawn as triangles, and the tattoo is cut out of the part's own skin triangles under that drawing: every
// piece lies exactly on the skin it was cut from and is bound to the same bones, so it follows any surface.
import {Vector3} from 'three';

/** A blade: a curve from a through the pull of c to b, widest at belly (a share of its length), pointed at both ends. */
function blade(a,c,b,width,belly=.38,segments=6,lean=.5){
 const left=[],right=[];
 for(let j=0;j<=segments;j++){
  const t=j/segments,u=1-t;
  const x=u*u*a[0]+2*u*t*c[0]+t*t*b[0],y=u*u*a[1]+2*u*t*c[1]+t*t*b[1];
  let dx=2*u*(c[0]-a[0])+2*t*(b[0]-c[0]),dy=2*u*(c[1]-a[1])+2*t*(b[1]-c[1]);const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
  const w=width*(t<belly?Math.pow(t/belly,.75):Math.pow((1-t)/(1-belly),1.15));
  // lean: how much of the width lies on the outside of the curve (a crescent has most of it there).
  left.push([x-dy*w*lean,y+dx*w*lean]);right.push([x+dy*w*(1-lean),y-dx*w*(1-lean)]);
 }
 const triangles=[];
 for(let j=0;j<segments;j++){
  if(j===0)triangles.push([left[0],right[1],left[1]]);
  else if(j===segments-1)triangles.push([left[j],right[j],left[j+1]]);
  else triangles.push([left[j],right[j],right[j+1]],[left[j],right[j+1],left[j+1]]);
 }
 return triangles;
}
const mirror=triangles=>[...triangles,...triangles.map(t=>t.map(([x,y])=>[-x,y]).reverse())];
const rotate=(triangles,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return triangles.map(t=>t.map(([x,y])=>[x*c-y*s,x*s+y*c]));};
const disc=(r,sides=8,turn=0)=>Array.from({length:sides},(_,i)=>{const a=turn+2*Math.PI*i/sides,b=turn+2*Math.PI*(i+1)/sides;return [[0,0],[Math.cos(a)*r,Math.sin(a)*r],[Math.cos(b)*r,Math.sin(b)*r]];});
const ccw=t=>(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0])<0?[t[0],t[2],t[1]]:t;

// Each design fits the square from -1 to 1, y up.
const DESIGNS={
 // Three claw slashes.
 blades:()=>[
  ...blade([-.62,-.78],[-.86,.05],[-.3,.88],.3,.4,6,.7),
  ...blade([-.08,-.96],[-.36,0],[.2,1],.34,.4,6,.7),
  ...blade([.46,-.8],[.2,.05],[.7,.84],.3,.4,6,.7),
 ],
 // Horns curving up and out, hooks under them, a spike between.
 horns:()=>[
  ...mirror([
   ...blade([.1,.02],[.86,.02],[.8,.98],.36,.42,7,.8),
   ...blade([.12,-.16],[.98,-.3],[.42,-.98],.28,.4,6,.2),
   ...blade([.22,.2],[.42,.5],[.3,.84],.14,.4,4,.5),
  ]),
  ...blade([0,.72],[0,0],[0,-.9],.2,.3,4,.5),
 ],
 // A sun of eight curved rays about a disc.
 sun:()=>[
  ...Array.from({length:8},(_,i)=>rotate(blade([.3,-.06],[.72,.4],[1,-.1],.24,.3,5,.75),i*Math.PI/4)).flat(),
  ...disc(.2,8,Math.PI/8),
 ],
 // A spine with barbs.
 thorns:()=>[
  ...blade([0,-1],[0,0],[0,1],.17,.5,4,.5),
  ...mirror([
   ...blade([.05,-.62],[.62,-.6],[.86,-.02],.24,.35,5,.75),
   ...blade([.05,-.14],[.54,-.1],[.72,.44],.2,.35,5,.75),
   ...blade([.05,.3],[.4,.36],[.5,.8],.16,.35,4,.75),
  ]),
 ],
 // Wings fanning from a drop.
 wings:()=>[
  ...mirror([
   ...blade([.08,-.42],[.6,-.66],[1,.06],.3,.36,6,.2),
   ...blade([.08,-.18],[.5,-.12],[.84,.62],.26,.36,6,.2),
   ...blade([.08,.06],[.3,.42],[.46,.96],.2,.36,5,.2),
  ]),
  ...blade([0,.3],[0,-.3],[0,-.98],.2,.25,4,.5),
 ],
 // A twin spiral: two hooks chasing each other.
 spiral:()=>[
  ...[0,Math.PI].flatMap(turn=>rotate([
   ...blade([.04,.1],[.1,.9],[.82,.56],.36,.5,7,.85),
   ...blade([.86,.5],[1.02,-.08],[.5,-.5],.26,.3,6,.85),
  ],turn)),
 ].map(t=>t.map(([x,y])=>[x*.9,y*.9])),
};
export const TATTOO_DESIGNS=Object.keys(DESIGNS);
const cache=new Map();
/** The triangles of a design, counter-clockwise, in the square from -1 to 1. */
export function tattooTriangles(design){
 if(!cache.has(design))cache.set(design,(DESIGNS[design]||DESIGNS.blades)().map(ccw).filter(t=>Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))>1e-5));
 return cache.get(design);
}
// One polygon cut by the half-plane left of the edge a>b (Sutherland-Hodgman). A point carries its weights in the skin triangle.
function cut(polygon,a,b){
 const side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),out=[];
 for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],sp=side(p),sq=side(q);
  if(sp>=0)out.push(p);
  if(sp>=0!==sq>=0){const t=sp/(sp-sq);out.push(p.map((v,k)=>v+(q[k]-v)*t));}
 }
 return out;
}
/**
 * The pieces of skin under a design. positions, faces: the skin. anchor, normal: where the design sits and which way
 * the skin faces there. up: the design's upward direction (flattened into the skin). size: half the design's width.
 * Returns triangles as corners {face, weights} (weights in that skin triangle), ready to be placed and bound.
 */
export function tattooPieces(positions,faces,anchor,normal,up,size,design,turn=0){
 const n=normal.clone().normalize();
 let v=up.clone().addScaledVector(n,-up.dot(n));
 if(v.lengthSq()<1e-4){v=new Vector3(1,0,0);v.addScaledVector(n,-v.dot(n));if(v.lengthSq()<1e-4)v=new Vector3(0,1,0).addScaledVector(n,-n.y);}
 v.normalize();
 let u=new Vector3().crossVectors(v,n).normalize();
 if(turn){const c=Math.cos(turn),s=Math.sin(turn),u2=u.clone().multiplyScalar(c).addScaledVector(v,s),v2=v.clone().multiplyScalar(c).addScaledVector(u,-s);u=u2;v=v2;}
 const shapes=tattooTriangles(design),p=new Vector3(),corners=[new Vector3(),new Vector3(),new Vector3()],pieces=[];
 const boxes=shapes.map(t=>[Math.min(t[0][0],t[1][0],t[2][0]),Math.min(t[0][1],t[1][1],t[2][1]),Math.max(t[0][0],t[1][0],t[2][0]),Math.max(t[0][1],t[1][1],t[2][1])]);
 for(let f=0;f<faces.length;f+=3){
  const flat=[];let depth=0;
  for(let k=0;k<3;k++){
   corners[k].fromArray(positions,faces[f+k]*3);p.copy(corners[k]).sub(anchor);
   flat.push([p.dot(u)/size,p.dot(v)/size]);depth+=p.dot(n)/3;
  }
  // Only skin that faces the same way and lies near the design's own plane: never the far side of the part.
  const facing=p.copy(corners[1]).sub(corners[0]).cross(corners[2].clone().sub(corners[0]));
  if(facing.lengthSq()<1e-10)continue;
  const area=(flat[1][0]-flat[0][0])*(flat[2][1]-flat[0][1])-(flat[1][1]-flat[0][1])*(flat[2][0]-flat[0][0]);
  if(facing.normalize().dot(n)<.12||Math.abs(depth)>size*1.1||Math.abs(area)<1e-9)continue;
  const x0=Math.min(flat[0][0],flat[1][0],flat[2][0]),y0=Math.min(flat[0][1],flat[1][1],flat[2][1]),x1=Math.max(flat[0][0],flat[1][0],flat[2][0]),y1=Math.max(flat[0][1],flat[1][1],flat[2][1]);
  if(x0>1||x1<-1||y0>1||y1<-1)continue;
  // The skin triangle as the window, counter-clockwise in the design's plane.
  const window=area>0?[0,1,2]:[0,2,1];
  for(const [s,shape] of shapes.entries()){
   const box=boxes[s];if(box[0]>x1||box[2]<x0||box[1]>y1||box[3]<y0)continue;
   let polygon=shape;
   for(let k=0;k<3&&polygon.length>2;k++)polygon=cut(polygon,flat[window[k]],flat[window[(k+1)%3]]);
   if(polygon.length<3)continue;
   // Weights of each point in the skin triangle (it is flat, so the design's plane gives them exactly).
   const weights=polygon.map(([x,y])=>{
    const w1=((x-flat[0][0])*(flat[2][1]-flat[0][1])-(y-flat[0][1])*(flat[2][0]-flat[0][0]))/area,w2=((flat[1][0]-flat[0][0])*(y-flat[0][1])-(flat[1][1]-flat[0][1])*(x-flat[0][0]))/area;
    return [1-w1-w2,w1,w2];
   });
   for(let k=1;k<polygon.length-1;k++){
    const a=polygon[0],b=polygon[k],c=polygon[k+1];
    if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-7)continue;
    pieces.push({face:f,points:[a,b,c],weights:[weights[0],weights[k],weights[k+1]]});
   }
  }
 }
 return pieces;
}
