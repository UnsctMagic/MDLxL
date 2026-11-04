import { allNodes, NODE_COLLECTION_KEYS, TRANSFORM_DEFAULTS } from './animation.js';
import { trimTerminalHolds } from './optimizexl-animation.js';
import { optimizexlLocalTrack } from './optimizexl-format.js';
import { compactVertices } from './optimizexl-geometry.js';
import { protectedGeosetData } from './optimizexl-exclusions.js';
import { typedJson as json } from './value-key.js';

const same=(a,b)=>a?.length===b?.length&&Array.from(a||[]).every((v,i)=>Object.is(v,b[i]));
const at=(m,path)=>path.reduce((v,k)=>v?.[k],m);
const intervals=m=>m.Sequences.map(s=>Array.from(s.Interval));
const validDomains=m=>m.Sequences.length>0&&m.Sequences.every((s,i)=>Number.isInteger(s.Interval?.[0])&&Number.isInteger(s.Interval?.[1])&&s.Interval[0]>=0&&s.Interval[0]<s.Interval[1]&&!m.Sequences.some((o,j)=>j!==i&&o.Interval[0]<=s.Interval[1]&&o.Interval[1]>=s.Interval[0]));
const trackSignature=(m,path)=>json([at(m,path),at(m,path.slice(0,-1))?._MdxDefaults?.[path.at(-1)],intervals(m)]);
const geometrySignature=g=>json([g.Vertices,g.Normals,g.TVertices,g.Faces,g.VertexGroup,g.Groups,g.PrimitiveTypes,g.PrimitiveCounts]);

// A constant track still has separate empty-domain and Unanimated defaults.
// EditorDocument already exposes RGB; never copy raw KGAC BGR into static RGB.
function staticValue(m,track,path){
 const property=path.at(-1),owner=at(m,path.slice(0,-1));
 if(!optimizexlLocalTrack(track)||!validDomains(m)||![0,1].includes(track.LineType)||!track.Keys.length)return;
 const value=track.Keys[0].Vector;
 if(!value||!Array.from(value).every(Number.isFinite)||track.Keys.some((k,i,all)=>!Number.isInteger(k.Frame)||i&&k.Frame<=all[i-1].Frame||!same(k.Vector,value)||!m.Sequences.some(s=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1])))return;
 const node=NODE_COLLECTION_KEYS.includes(path[0])&&Object.hasOwn(TRANSFORM_DEFAULTS,property);
 if(node){if(same(value,TRANSFORM_DEFAULTS[property]))return {drop:true};return;}
 if(path[0]!=='GeosetAnims'||!['Alpha','Color'].includes(property)||value.length!==(property==='Color'?3:1))return;
 const fallback=property==='Color'?[1,1,1]:[1],base=owner._MdxDefaults?.[property]??(property==='Color'?[1,1,1]:1),baseValue=typeof base==='number'?[base]:base;
 if(!same(value,baseValue))return;
 if(m.Sequences.some(s=>!track.Keys.some(k=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1]))&&!same(value,fallback))return;
 return {value:Array.from(value)};
}

function collapsedFaces(m,g){
 if(g.SkinWeights?.length||g.Tangents?.length||g.Faces.length%3||!g.Faces.length||g.PrimitiveTypes?.some(t=>t!==4))return [];
 const count=g.Vertices.length/3,ids=new Set(allNodes(m).map(n=>n.ObjectId));
 if(!Number.isInteger(count)||g.Normals.length!==count*3||g.VertexGroup.length!==count||g.TVertices.some(t=>t.length!==count*2)||Array.from(g.Faces).some(i=>!Number.isInteger(i)||i<0||i>=count))return [];
 const signature=i=>{
  const group=g.Groups[g.VertexGroup[i]],point=Array.from(g.Vertices.slice(i*3,i*3+3));
  if(!point.every(Number.isFinite)||!group?.length||group.some(id=>!ids.has(id)))return null;
  // Retain order and repeated influences, so the native floating-point skin
  // sum is identical too, not just mathematically equivalent after sorting.
  return json([point,group]);
 };
 const points=Array.from({length:count},(_,i)=>signature(i)),faces=[];
 for(let i=0;i<g.Faces.length;i+=3){const [a,b,c]=Array.from(g.Faces.slice(i,i+3),v=>points[v]);if(a!==null&&a===b||b!==null&&b===c||a!==null&&a===c)faces.push(i/3);}
 // The empty-geoset checker owns removal of entire objects. Do not introduce
 // a new empty-geoset finding or silently remove the author's geoset here.
 return faces.length===g.Faces.length/3?[]:faces;
}

/** One additional, explicitly previewed plan. Existing reducers/repairs retain
 * their outputs. A pending owner on a track finishes before exact cleanup is
 * proposed for it; node terminal holds share the world reducer's implementation. */
export function exactCleanupProposals(m,entries,pending=[]){
 if(m.Version!==800||m.BindPoses?.length)return [];
 const checker=new Set(pending.filter(p=>p.kind==='checker').map(p=>p.rule));
 // These owners can renumber the target collections. Rescan their result before
 // capturing paths; do not create a second plan against obsolete indices.
 if(['emptyEvents','geosetAnimReference','helperSkin','unskinnedBone','zeroFaces','vertexLimit','duplicateGeosetAnims'].some(rule=>checker.has(rule)))return [];
 const origin=pending.find(p=>p.kind==='checker'&&p.rule==='origin');
 if(origin&&[...m.Bones,...m.Helpers].some(n=>origin.items.includes(n.Name)))return [];
 const blocked=new Set(pending.filter(p=>p.path).map(p=>p.path.join('.')));
 for(const p of pending)if(p.kind==='gravity')blocked.add(`ParticleEmitters2.${p.emitter}.Gravity`);
 // Relocation changes which authored endpoint is the whole-track last key.
 // Let that owner settle timestamps before planning any track cleanup.
 const tracks=[],relocating=pending.some(p=>p.kind==='sequenceTimeline')||checker.has('timeline')||checker.has('zeroLength');
 for(const {track,path}of relocating?[]:entries){
  if(blocked.has(path.join('.')))continue;
  const property=path.at(-1);
  if(checker.has('variation')&&path[0]==='ParticleEmitters2'&&property==='Variation'||checker.has('lightAttenuation')&&path[0]==='Lights'&&['AttenuationStart','AttenuationEnd'].includes(property)||checker.has('visibilityFade')&&property==='Visibility')continue;
  const constant=staticValue(m,track,path);
  if(constant){tracks.push({path,signature:trackSignature(m,path),mode:'static',...constant,keys:track.Keys.length});continue;}
  const candidate=structuredClone(track),changes=[];
  trimTerminalHolds(m,candidate,path.at(-1),c=>changes.push(c),{acrossSequences:true});
  if(changes.length)tracks.push({path,signature:trackSignature(m,path),mode:'terminal',frames:changes.map(c=>c.frame),changes,keys:changes.length});
 }
 const geosets=checker.has('vertexAttachment')?[]:m.Geosets.flatMap((g,index)=>{const faces=collapsedFaces(m,g);return faces.length?[{index,faces,signature:geometrySignature(g)}]:[];});
 if(!tracks.length&&!geosets.length)return [];
 const terminal=tracks.filter(t=>t.mode==='terminal').reduce((n,t)=>n+t.keys,0),constants=tracks.filter(t=>t.mode==='static').length,triangles=geosets.reduce((n,g)=>n+g.faces.length,0);
 const sequence=tracks.find(t=>t.changes?.length)?.changes[0].sequence??0;
 return [{id:'exactCleanup',kind:'exactCleanup',tracks,geosets,sequence,frame:m.Sequences[sequence]?.Interval[0]||0,
  label:'Remove exact redundancy',detail:`Remove ${terminal} repeated end keys, ${constants} constant tracks and ${triangles} collapsed triangles. Keep animation values, colours, rig, surviving triangles and bounds.`}];
}

export function applyExactCleanup(m,fix,settings={}){
 const protectedData=protectedGeosetData(m,settings),protectedTrack=path=>{
  const [collection,index]=path;
  return NODE_COLLECTION_KEYS.includes(collection)&&protectedData.nodes.has(m[collection]?.[index]?.ObjectId)||collection==='GeosetAnims'&&protectedData.geosets.has(m.GeosetAnims[index]?.GeosetId)||collection==='Materials'&&protectedData.materials.has(Number(index))||collection==='TextureAnims'&&protectedData.textureAnims.has(Number(index));
 };
 // Revalidate every owned target before any write. Bounds and unrelated tracks
 // may be changed by a disjoint selected repair without invalidating this plan.
 for(const t of fix.tracks)if(!protectedTrack(t.path)&&trackSignature(m,t.path)!==t.signature)throw Error('This exact-cleanup track changed. Select it again.');
 for(const g of fix.geosets)if(!protectedData.geosets.has(g.index)&&(!m.Geosets[g.index]||geometrySignature(m.Geosets[g.index])!==g.signature||json(collapsedFaces(m,m.Geosets[g.index]))!==json(g.faces)))throw Error('This exact-cleanup geometry changed. Select it again.');
 for(const t of fix.tracks){
  if(protectedTrack(t.path))continue;
  const owner=at(m,t.path.slice(0,-1)),property=t.path.at(-1);
  if(t.mode==='terminal'){const remove=new Set(t.frames);owner[property].Keys=owner[property].Keys.filter(k=>!remove.has(k.Frame));}
  else{
   if(t.drop)delete owner[property];else owner[property]=t.value.length===1?t.value[0]:new Float32Array(t.value);
   if(owner._MdxDefaults){delete owner._MdxDefaults[property];if(!Object.keys(owner._MdxDefaults).length)delete owner._MdxDefaults;}
  }
 }
 for(const change of fix.geosets){
  if(protectedData.geosets.has(change.index))continue;
  const g=m.Geosets[change.index],remove=new Set(change.faces),faces=Array.from(g.Faces).filter((_,i)=>!remove.has(Math.floor(i/3))),used=new Set(faces);
  // Remove only vertices orphaned by this operation. Previously unused points
  // retain the Unused data stage's ownership and editing behaviour.
  const previouslyUsed=new Set(g.Faces),kept=Array.from({length:g.Vertices.length/3},(_,i)=>i).filter(i=>used.has(i)||!previouslyUsed.has(i));
  compactVertices(g,kept,faces);g.PrimitiveTypes=Uint32Array.of(4);g.PrimitiveCounts=Uint32Array.of(g.Faces.length);
 }
}
