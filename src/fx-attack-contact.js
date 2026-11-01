import {sampleNodeMatrices,sampleTrack,skinGeoset} from './animation.js';
import {vertexBoneWeights} from './part-bones.js';
import {isWeaponName} from './rig-names.js';

// Warcraft models face +X. Find the visible striking extremity in the posed Attack,
// including weapons sharing a geoset and unnamed creature rigs. Never use the click.
export function attackContact(model,sequence,requestedHit){
 const clip=model.Sequences[sequence],interval=clip.Interval,[a,b]=interval;
 const marks=model.EventObjects.filter(n=>!n._FxTag&&(n.GlobalSeqId==null||n.GlobalSeqId<0)&&/hit|impact|damage/i.test(n.Name))
  .flatMap(n=>Array.from(n.EventTrack)).filter(t=>t>a&&t<b);
 const moment=Number.isFinite(requestedHit)?Math.max(a,Math.min(b-1,requestedHit)):marks[0];
 const span=Math.max(4,Math.min(55,(clip.BoundsRadius||Math.hypot(...(clip.MaximumExtent||[]))||50)*.22));
 const arms=new Set(model.Attachments.filter(n=>/weapon/i.test(n.Name)&&n.Parent!=null).map(n=>n.Parent));
 const stem=n=>(n?.Name||'').trim().toLowerCase().replace(/[0-9]+$/,'');
 const peers=new Set([...arms].map(id=>stem(model.Nodes[id])).filter(s=>s&&!/^(?:bone|mesh|object|helper)$/.test(s)));
 for(const n of model.Bones)if(isWeaponName(n.Name)||peers.has(stem(n)))arms.add(n.ObjectId);
 const weapon=id=>{const seen=new Set();while(id!=null&&!seen.has(id)){if(arms.has(id))return true;seen.add(id);id=model.Nodes[id]?.Parent;}return false;};
 const start=sampleNodeMatrices(model,a,sequence,a),parts=[];
 for(const [index,g] of model.Geosets.entries()){
  if(g._FxTag||!g.Faces?.length||g.LevelOfDetail>0)continue;
  const vertices=[...new Set(g.Faces)],affinity=new Map();
  for(const i of vertices)affinity.set(i,vertexBoneWeights(g,i).reduce((s,[id,w])=>s+(weapon(id)?w:0),0));
  parts.push({index,g,vertices,affinity,start:skinGeoset(g,start),posed:new Float32Array(g.Vertices.length),alpha:model.GeosetAnims.find(v=>v.GeosetId===index)?.Alpha});
 }
 let best=-Infinity,contact=null,hit=moment;
 const times=moment==null?Array.from({length:31},(_,i)=>Math.round(a+(b-a)*(i+1)/34)):[moment];
 for(const t of times){
  const matrices=sampleNodeMatrices(model,t,sequence,t),opts={interval,globalSequences:model.GlobalSequences,globalTime:t,fallback:1};
  for(const part of parts){
   if(sampleTrack(part.alpha,t,opts)<.05)continue;
   skinGeoset(part.g,matrices,part.posed);
   for(const v of part.vertices){
    const i=3*v,x=part.posed[i],dx=x-part.start[i],dy=part.posed[i+1]-part.start[i+1],dz=part.posed[i+2]-part.start[i+2];
    const score=x+.42*dx+.12*Math.hypot(dy,dz)+span*part.affinity.get(v);
    if(score>best){best=score;contact={geoset:part.index,vertex:v,radius:span};hit=t;}
   }
  }
 }
 if(!contact)return {sequence,hit:moment??Math.round((a+b)/2),contact:null};
 return {sequence,hit,contact};
}
