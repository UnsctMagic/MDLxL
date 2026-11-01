import {Quaternion,Vector3} from 'three';
import {createNode,removeGeosets,recalculateExtents,updateCounts} from './editor-document.js';
import {effectAnchor} from './surface-effects.js';
import {indexedSurfaceIslands} from './geoset-operations.js';
import {streakCoordinates} from './visual-effect-composition.js';
import {findLook,partFrame} from './global-animation-looks.js';
import {visitTextureReferences} from './texture-references.js';
import {ribbonQuickValues} from './ribbon-quick.js';
import {visitTracks} from './animation.js';
import {deleteGlobalSequence} from './sequence-editor.js';
import {gamePathKey} from './game-path.js';

const vec=v=>Float32Array.from(v);
const z=new Vector3(0,0,1),y=new Vector3(0,1,0);
export const FX_SECTIONS=['Info','Geosets','GeosetAnims','Materials','Textures','TextureAnims','GlobalSequences','Nodes','PivotPoints','BindPoses'];
const curves={
 steel:[[0,.93],[.55,1],[1,.93]],
 breathe:[[0,.38],[.22,.56],[.53,1],[.78,.69],[1,.38]],
 fade:[[0,1],[.4,.24],[.57,.24],[1,1]],
 glint:[[0,.08],[.25,.12],[.29,1],[.37,.08],[.79,.12],[.82,.65],[.89,.08],[1,.08]],
 lightning:[[0,.34],[.08,.45],[.10,1],[.15,.59],[.19,.94],[.25,.34],[.48,.43],[.53,.96],[.59,.32],[.77,.4],[.82,.91],[.88,.38],[1,.34]],
 flicker:[[0,.72],[.12,.96],[.25,.67],[.35,.89],[.48,.73],[.64,1],[.82,.65],[1,.72]],
};
function keys(clock,ms,pairs,type=1,ArrayType=Float32Array){
 return {GlobalSeqId:clock,LineType:type,Keys:pairs.map(([t,value])=>({Frame:Math.round(t*ms),Vector:ArrayType.from(Array.isArray(value)?value:[value])}))};
}
function clockFor(m,ms,created){
 let id=m.GlobalSequences.indexOf(ms);
 if(id<0){id=m.GlobalSequences.push(ms)-1;created.push(ms);}
 return id;
}
function texture(m,name,wrap,tag){
 const existing=m.Textures.findIndex(t=>!t.ReplaceableId&&gamePathKey(t.Image||'')===gamePathKey(name)&&(!wrap||(t.Flags&3)===3));
 return existing<0?m.Textures.push({Image:name,Flags:wrap?3:0,ReplaceableId:0,_FxTag:tag})-1:existing;
}
function resource(list,tag,value){
 const index=list.findIndex(r=>r._FxTag===tag);
 value._FxTag=tag;
 if(index<0)return list.push(value)-1;
 list[index]=value;return index;
}
function nodeFor(c,family,type,key,title,point,parent){
 const tag=c.tag+'/'+key;
 let node=c.model[family].find(n=>n._FxTag===tag);
 if(!node){node=createNode(c.model,type);node._FxTag=tag;}
 c.used.add(tag);
 node.Name='FX '+title;node.Parent=parent;node.PivotPoint=vec(point.toArray());
 c.model.PivotPoints[node.ObjectId]=node.PivotPoint;
 return node;
}
function overlay(c,geometry,material,colour,ownAnimation){
 const m=c.model,tag=c.tag+'/shape',copy=structuredClone(geometry);delete copy._FxStack;
 copy.MaterialID=material;
 const index=resource(m.Geosets,tag,copy);c.used.add(tag);
 const old=m.GeosetAnims.find(a=>a.GeosetId===index);
 const anim={...(ownAnimation?structuredClone(ownAnimation):{}),GeosetId:index,Alpha:ownAnimation?.Alpha??1,Flags:(ownAnimation?.Flags||0)|2,Color:vec(colour)};
 if(old)Object.assign(old,anim);else m.GeosetAnims.push(anim);
 return index;
}
export function textureRepeats(model,textureId){
 return (model.Textures[textureId]?.Flags&3)===3;
}
function skinLayer(c,l){
 const {model:m,source,tag,id,ms}=c;
 const mat=m.Materials[c.base],original=mat?.Layers.findLast(layer=>typeof layer.TextureID==='number'&&!m.Textures[layer.TextureID]?.ReplaceableId)||mat?.Layers.at(-1);
 if(!original&&!l.image)throw Error('The selected part has no texture to animate.');
 const own=!l.image, g={...source,TVertices:[...source.TVertices]};
 const paintedAtlas=l.own&&!textureRepeats(m,original.TextureID);
 const tiles=l.tiling||1;
 let coords=own||l.bodyUV?(source.TVertices[original?.CoordId||0]||source.TVertices[0]).slice():streakCoordinates(source,{axis:l.axis,band:l.band??(l.base?1:.8)});
 // A body often occupies a slender slice of its painted texture atlas. Give each island
 // the full native material while keeping the modeller's seams and winding.
 if(l.bodyUV&&!own)for(const island of indexedSurfaceIslands(source)){
  for(let axis=0;axis<2;axis++){
   let lo=Infinity,hi=-Infinity;
   for(const v of island){const n=coords[v*2+axis];lo=Math.min(lo,n);hi=Math.max(hi,n);}
   if(hi>lo)for(const v of island)coords[v*2+axis]=(coords[v*2+axis]-lo)/(hi-lo);
  }
 }
 const rect=l.atlasRect;
 const angle=l.direction*Math.PI/180;
 if(rect){
  // Keep every interpolation inside this native atlas cell, including extreme original UVs.
  let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;
  for(let i=0;i<coords.length;i+=2){minU=Math.min(minU,coords[i]);maxU=Math.max(maxU,coords[i]);minV=Math.min(minV,coords[i+1]);maxV=Math.max(maxV,coords[i+1]);}
  for(let i=0;i<coords.length;i+=2){
   coords[i]=rect[0]+rect[2]*(.10+.76*(coords[i]-minU)/(maxU-minU||1));
   coords[i+1]=rect[1]+rect[3]*(.12+.73*(coords[i+1]-minV)/(maxV-minV||1));
  }
 }else if(!paintedAtlas)for(let i=0;i<coords.length;i+=2){
  const u=coords[i]-.5,v=coords[i+1]-.5;
  coords[i]=.5+tiles*(u*Math.cos(angle)+v*Math.sin(angle));
  coords[i+1]=.5+tiles*(v*Math.cos(angle)-u*Math.sin(angle));
 }
 g.TVertices=[coords];
 let tex=own?structuredClone(original.TextureID):texture(m,l.image,!rect,tag);
 if(l.frames){
  const tids=l.frames.map(name=>texture(m,name,true,tag)),n=tids.length* Math.max(1,Math.round(l.speed*3));
  tex=keys(id,ms,Array.from({length:n+1},(_,i)=>[i/n,tids[i%tids.length]]),0,Uint32Array);
 }
 const previous=m.Materials.find(mat=>mat._FxTag===tag+'/material')?.Layers[0];
 const prior=c.prior?.type===l.type&&c.prior.image===l.image?c.prior:null;
 const shape=curves[l.pulse]||(l.type==='Glow'?curves.breathe:null);
 const alpha=shape?keys(id,ms,shape.map(([t,a])=>[t,.005+a*(l.strength-.005)])):l.strength;
 const layer={TextureID:tex,CoordId:0,TVertexAnimId:null,FilterMode:l.filter??(l.base?2:3),Shading:l.bodyUV||l.steel?16:17,Alpha:alpha};
 if(l.pulse!=='fade'&&(l.type==='Moving skin'||!shape)){
  // Whole tiles at wrap. The direction selects a lattice vector or a closed excursion for an atlas.
  const turns=Math.max(1,Math.round(l.speed));
  // Painted unit atlases do not repeat. Drift a few texels and return to the same face.
  const extent=rect?[rect[2]*.09,rect[3]*.09]:paintedAtlas?[.014,.014]:null;
  const pairs=extent?Array.from({length:turns*4+1},(_,i)=>{
   const phase=[0,1,0,-1][i%4];
   return [i/(turns*4),[phase*extent[0]*Math.cos(angle),phase*extent[1]*Math.sin(angle),0]];
  }):[[0,[0,0,0]],[1,l.axis==='v'?[0,turns,0]:[turns,0,0]]];
  if(prior&&previous&&c.sameClock&&prior.speed===l.speed&&prior.direction===l.direction)layer.TVertexAnimId=previous.TVertexAnimId;
  else layer.TVertexAnimId=resource(m.TextureAnims,tag+'/motion',{Translation:keys(id,ms,pairs)});
 }
 if(prior&&previous){
  if(c.sameClock&&prior.strength===l.strength)layer.Alpha=previous.Alpha;
  if(typeof previous.TextureID==='number'||c.sameClock&&prior.speed===l.speed)layer.TextureID=previous.TextureID;
  layer.FilterMode=previous.FilterMode;layer.Shading=previous.Shading;
 }
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:l.base?0:1,RenderMode:0,Layers:[layer]});
 const colour=l.steel?l.tint.map(v=>.22+v*.31):l.crust?l.tint.map(v=>.18+v*.22):l.tint;
 const index=overlay(c,g,material,colour,m.GeosetAnims.find(a=>a.GeosetId===c.index));
 return {geoset:index};
}
function particles(c,l){
 const {model:m,frame,id,ms,tag}=c,fly=l.kind==='flies',mote=l.kind==='motes';
 const count=fly?Math.max(1,Math.round(l.amount)):l.count;
 const ids=[];
 for(let i=0;i<count;i++){
  const along=count===1?0:-l.lower+(l.upper+l.lower)*(i+.20)/(count-.60);
  const pos=fly||mote?frame.center.clone():frame.surfaceAt(along);
  pos.add(new Vector3(...l.offset));
  let parent=c.parent;
  if(fly||mote){
   pos.copy(frame.center).add(new Vector3(...l.offset));
   const orbit=nodeFor(c,'Bones','Bone','orbit'+i,l.label+' orbit '+(i+1),pos,parent);
   const r=fly?l.size:Math.max(frame.girth*.9,frame.length*.25),phase=i*2.39996,tilt=(i%3-1)*.38+.16;
   const wind=i%2?-1:1,steps=32,turns=1+i%3;
   const path=Array.from({length:steps+1},(_,k)=>{
    const a=2*Math.PI*(k%steps)/steps,b=a*turns*wind+phase,rr=r*(.84+.17*Math.sin(2*a+phase)+.08*Math.cos(5*a-phase));
    return [k/steps,[Math.cos(b)*rr,Math.sin(b)*rr*(.76+.12*Math.sin(phase)),Math.sin(b+tilt)*tilt*r+.16*r*Math.sin(3*a+phase)+.07*r*Math.cos(7*a-phase)]];
   });
   orbit.Translation=keys(id,ms,path);parent=orbit.ObjectId;
  }else if(l.kind==='drops')pos.z-=frame.girth*.35;
  const p=nodeFor(c,'ParticleEmitters2','ParticleEmitter2','source'+i,l.label+' '+(i+1),pos,parent);
  const size=fly?l.spriteSize:l.size,atlas=l.atlas||1,flame=l.kind==='flame',mist=l.kind==='mist';
  const colors=flame?[l.tint.map(v=>Math.min(1,v*.37+.63)),l.tint,l.tint.map((v,j)=>v*[.98,.42,.08][j])]:[l.tint,l.tint,l.tint.map(v=>v*.75)];
  const current={...p},prior=c.prior;
  Object.assign(p,{Flags:4096|32768|(fly||mote?524288:0),TextureID:texture(m,l.image,false,tag),FilterMode:fly||mist||l.kind==='drops'?0:1,Rows:fly?16:atlas,Columns:fly?16:atlas,
   Speed:l.velocity,Variation:fly?0:.35,Latitude:flame?24:mist?48:34,Gravity:l.gravity,LifeSpan:l.lasts,
   Width:fly?0:size*.2,Length:fly?0:size*.25,
   EmissionRate:fly?1.3/l.lasts:keys(id,ms,Array.from({length:9},(_,k)=>[k/8,l.amount/count*(.76+.24*Math.cos((k%8)*Math.PI/4+i*1.7))])),
   Visibility:keys(id,ms,[[0,1],[1,1]]),FrameFlags:1,Time:fly?.5:.36,SegmentColor:colors.map(vec),
   ParticleScaling:vec(fly?[size,size,size]:flame?[size*.94,size,size*.23]:mist?[size*.45,size,size*1.38]:[size*.45,size,size*.12]),
   Alpha:Uint8Array.from((fly?[255,255,245]:mist?[0,180,0]:flame?[230,254,0]:[88,232,0]).map(a=>Math.round(a*l.strength)))});
  const first=fly?12*16+7:0,end=fly?first:atlas*atlas-1,mid=fly?first:Math.floor(end*.4);
  p.LifeSpanUVAnim=Uint32Array.from([first,mid,1]);p.DecayUVAnim=Uint32Array.from([Math.min(end,mid+1),end,1]);
  if(prior?.kind===l.kind&&current.Visibility?.GlobalSeqId!=null){
   // A layer adjustment preserves independent native fields already edited in EMTR.
   for(const field of ['Flags','FilterMode','TextureID','Rows','Columns','FrameFlags','Time','Variation','Latitude','TailLength','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim'])p[field]=current[field];
   for(const [option,fields] of Object.entries({size:['ParticleScaling','Width','Length'],lasts:['LifeSpan'],velocity:['Speed'],gravity:['Gravity'],strength:['Alpha'],tint:['SegmentColor']})){
    if(JSON.stringify(l[option])===JSON.stringify(prior[option])&&(option!=='size'||l.spriteSize===prior.spriteSize))for(const field of fields)p[field]=current[field];
   }
   if(l.amount===prior.amount&&c.sameClock&&l.lasts===prior.lasts)p.EmissionRate=current.EmissionRate;
  }
  ids.push(p.ObjectId);
 }
 return {id:ids[Math.floor(ids.length/2)],ids,family:'ParticleEmitters2'};
}
function edgeLayer(c,l){
 const {model:m,frame,id,ms,tag}=c;
 const point=frame.center.clone().add(new Vector3(...l.offset));
 const p=nodeFor(c,'RibbonEmitters','RibbonEmitter','edge',l.label,point,c.parent);
 // A small closed sway gives a stationary edge a width as the ribbon sheds its last vertices.
 const normal=new Vector3().crossVectors(frame.axis,Math.abs(frame.axis.z)<.9?z:y).normalize();
 p.Translation=keys(id,ms,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,normal.clone().multiplyScalar(frame.girth*.18*a).toArray()]));
 const layer={FilterMode:4,Shading:17,TextureID:texture(m,l.image,false,tag),CoordId:0,TVertexAnimId:null,Alpha:1};
 Object.assign(p,{MaterialID:resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:[layer]}),Rotation:keys(id,ms,[[0,new Quaternion().setFromUnitVectors(y,frame.axis).toArray()]],0),
  HeightAbove:l.upper,HeightBelow:l.lower,Alpha:keys(id,ms,curves.flicker.map(([t,a])=>[t,a*l.strength])),Color:vec(l.tint),LifeSpan:l.lasts,EmissionRate:l.smoothness,Gravity:l.gravity,Visibility:keys(id,ms,[[0,1],[1,1]])});
 return {id:p.ObjectId,ids:[p.ObjectId],family:'RibbonEmitters'};
}
function runeLayer(c,l){
 const {model:m,frame,id,ms,tag}=c,donor=c.rune?.Geosets[1];
 if(!donor)throw Error('Choose your Warcraft III folder to load the native rune.');
 const p=frame.at(0).add(new Vector3(...l.offset));
 const bone=nodeFor(c,'Bones','Bone','pivot','Turning rune pivot',p,c.parent), turns=Math.max(1,Math.round(l.speed));
 const rotation=Array.from({length:turns*8+1},(_,i)=>[i/(turns*8),new Quaternion().setFromAxisAngle(frame.axis,i*Math.PI/4).toArray()]);
 bone.Rotation=keys(id,ms,rotation);
 const geometry=structuredClone(donor),vertices=geometry.Vertices,center=new Vector3();
 for(let i=0;i<vertices.length;i+=3)center.add(new Vector3().fromArray(vertices,i));
 center.multiplyScalar(3/vertices.length);
 const basis=new Quaternion().setFromUnitVectors(z,frame.axis);
 let r=0;for(let i=0;i<vertices.length;i+=3)r=Math.max(r,new Vector3().fromArray(vertices,i).distanceTo(center));
 for(let i=0;i<vertices.length;i+=3){
  new Vector3().fromArray(vertices,i).sub(center).multiplyScalar(l.size*1.4/r).applyQuaternion(basis).add(p).toArray(vertices,i);
  new Vector3().fromArray(geometry.Normals,i).applyQuaternion(basis).toArray(geometry.Normals,i);
 }
 geometry.VertexGroup=new Uint8Array(vertices.length/3);geometry.Groups=[[bone.ObjectId]];geometry.TotalGroupsCount=1;geometry.Anims=[];
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:1,RenderMode:0,Layers:[{FilterMode:4,Shading:17,CoordId:0,TVertexAnimId:null,TextureID:texture(m,l.image,false,tag),
  Alpha:keys(id,ms,[[0,l.strength*.62],[.47,l.strength],[1,l.strength*.62]])}]});
 const index=overlay(c,geometry,material,l.tint);recalculateExtents(m,[index]);
 return {id:bone.ObjectId,geoset:index};
}
function compact(list,isUnused,refs){
 const used=new Set();refs((id)=>used.add(id));
 const map=new Map();const next=list.filter((v,i)=>{if(isUnused(v)&&!used.has(i))return false;map.set(i,map.size);return true;});
 if(next.length===list.length)return list;
 refs((id,set)=>{if(map.has(id))set(map.get(id));});return next;
}
function sweep(m,owner,used){
 const obsolete=n=>n._FxTag?.startsWith(owner+'/')&&!used.has(n._FxTag);
 removeGeosets(m,m.Geosets.flatMap((g,i)=>obsolete(g)?[i]:[]));
 const freed=new Set();
 for(const key of ['ParticleEmitters2','RibbonEmitters','Bones']){
  const remove=new Set(m[key].filter(obsolete).map(n=>n.ObjectId));
  for(const n of m.Nodes.filter(Boolean))if(remove.has(n.Parent)&&!obsolete(n))remove.delete(n.Parent);
  for(const g of m.Geosets)for(const group of g.Groups||[])for(const id of group)remove.delete(id);
  for(const id of remove){freed.add(id);delete m.Nodes[id];m.PivotPoints[id]=vec([0,0,0]);}
  m[key]=m[key].filter(n=>!remove.has(n.ObjectId));
 }
 while(freed.has(m.PivotPoints.length-1)){
  const last=m.PivotPoints.length-1;m.PivotPoints.pop();
  for(const b of m.BindPoses||[])if(b.Matrices.length===last+1+(m.Cameras?.length||0))b.Matrices.splice(last,1);
 }
 const owned=r=>!!r._FxTag;
 m.Materials=compact(m.Materials,owned,visit=>{for(const x of [...m.Geosets,...m.RibbonEmitters])visit(x.MaterialID,i=>x.MaterialID=i);for(const g of m.Geosets)if(g._FxStack)visit(g._FxStack.baseMaterial,i=>g._FxStack.baseMaterial=i);});
 m.TextureAnims=compact(m.TextureAnims,owned,visit=>{for(const mat of m.Materials)for(const l of mat.Layers)if(l.TVertexAnimId!=null)visit(l.TVertexAnimId,i=>l.TVertexAnimId=i);});
 m.Textures=compact(m.Textures,owned,visit=>visitTextureReferences(m,visit));
 updateCounts(m);
}
export function animationPart(model,index){
 const tag=model.Geosets[index]?._FxTag;
 if(!tag)return index;
 const owner=tag.split('/')[0];
 const part=model.Geosets.findIndex(g=>g._FxStack?.owner===owner);
 return part<0?index:part;
}
/** Read quick-control values from their native managers. More complex authored tracks stay intact. */
export function readAnimationStack(model,index){
 const saved=model.Geosets[index]?._FxStack;
 if(!saved||!findLook(saved.look))return null;
 const draft=structuredClone(saved);
 for(const l of draft.layers){
  const prefix=draft.owner+'/'+l.id+'/';
  const emitters=[...model.ParticleEmitters2,...model.RibbonEmitters].filter(n=>n._FxTag?.startsWith(prefix));
  const node=emitters[Math.floor(emitters.length/2)];
  const read=(key,v)=>{if(Number.isFinite(v)&&Math.abs(v-l[key])>1e-4*Math.max(1,Math.abs(v)))l[key]=v;};
  if(!node){
   const index=model.Geosets.findIndex(g=>g._FxTag===prefix+'shape');
   const layer=model.Materials[model.Geosets[index]?.MaterialID]?.Layers[0];if(!layer)continue;
   const peak=typeof layer.Alpha==='number'?layer.Alpha:layer.Alpha?.Keys.reduce((n,k)=>Math.max(n,k.Vector[0]),0);
   read('strength',peak);
   const rgb=model.GeosetAnims.find(a=>a.GeosetId===index)?.Color;
   if(rgb?.length===3){
    const colour=Array.from(rgb,v=>Math.max(0,Math.min(1,l.steel?(v-.22)/.31:l.crust?(v-.18)/.22:v)));
    if(colour.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=colour;
   }
   const travel=model.TextureAnims[layer.TVertexAnimId]?.Translation?.Keys;
   if(l.type==='Moving skin'&&!l.atlasRect&&travel?.length===2){
    const axis=l.axis==='v'?1:0,offset=travel[1].Vector[axis]-travel[0].Vector[axis];
    if(Number.isInteger(offset)&&offset>=1&&offset<=4)read('speed',offset);
   }
   continue;
  }
  if(l.type==='Edge'){
   const r=ribbonQuickValues(node);for(const [k,v] of Object.entries({upper:r.above,lower:r.below,strength:r.intensity,lasts:r.lasts,gravity:r.gravity,smoothness:r.amount}))read(k,v);
   if(r.color.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=r.color;
  }else{
   read('lasts',node.LifeSpan);read('gravity',typeof node.Gravity==='number'?node.Gravity:null);read('velocity',typeof node.Speed==='number'?node.Speed:null);
   read(l.kind==='flies'?'spriteSize':'size',node.ParticleScaling?.[1]);
   if(l.kind!=='flies'){
    const rate=typeof node.EmissionRate==='number'?node.EmissionRate:node.EmissionRate?.Keys?.[0]?.Vector[0];
    const phase=Math.floor(emitters.length/2)*1.7,weight=typeof node.EmissionRate==='number'?1:.76+.24*Math.cos(phase);
    if(Number.isFinite(rate))read('amount',rate*l.count/weight);
   }
   const rgb=Array.from(node.SegmentColor?.[1]||[]);
   if(rgb.length===3&&rgb.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=rgb;
  }
 }
 return draft;
}
export function compileAnimation(model,index,draft,{rune}={}){
 const source=model.Geosets[index];if(!source)throw Error('Select a part first.');
 const before=readAnimationStack(model,index), base=before?.baseMaterial??source.MaterialID,owner=draft.owner;
 const frame=partFrame(source),created=[...(before?.createdClocks||[])],used=new Set();
 const ms=Math.max(200,Math.round(draft.loop)),id=draft.layers.length?clockFor(model,ms,created):-1;
 const state=structuredClone(draft);state.baseMaterial=base;state.createdClocks=created;
 source.MaterialID=base;source._FxStack=state;
 if(draft.layers.some(l=>l.base)){
  const original=model.Materials[base].Layers[0];
  const hidden={...structuredClone(original),Alpha:0,FilterMode:2};
  source.MaterialID=resource(model.Materials,owner+'/underlay',{PriorityPlane:0,RenderMode:0,Layers:[hidden]});
 }
 const results={};
 for(const l of draft.layers){
  const prior=before?.look===draft.look?before.layers.find(item=>item.id===l.id):null;
  const tag=owner+'/'+l.id,context={model,source,index,base,frame,parent:effectAnchor(model,source),id,ms,tag,used,rune,prior,sameClock:before?.loop===ms};
  // Retain edits made in the normal material, node or emitter managers for untouched layers.
  if(ms===before?.loop&&JSON.stringify(before.layers.find(other=>other.id===l.id))===JSON.stringify(l)){
   for(const item of [...model.Geosets,...model.Nodes.filter(Boolean)])if(item._FxTag?.startsWith(tag+'/'))used.add(item._FxTag);
  }else if(l.type==='Particles')particles(context,l);
  else if(l.type==='Edge')edgeLayer(context,l);
  else if(l.type==='Rune')runeLayer(context,l);
  else skinLayer(context,l);
 }
 if(!draft.layers.length)delete source._FxStack;
 for(const duration of [...created]){
  if(draft.layers.length&&ms===duration)continue;
  const peer=model.Geosets.find(g=>g!==source&&g._FxStack?.loop===duration)?._FxStack;
  if(peer){if(!peer.createdClocks.includes(duration))peer.createdClocks.push(duration);created.splice(created.indexOf(duration),1);}
 }
 sweep(model,owner,used);
 const clocks=new Set();visitTracks(model,t=>clocks.add(t.GlobalSeqId),{skip:['Nodes','_FxStack'],event:n=>clocks.add(n.GlobalSeqId)});
 for(const duration of [...created]){const i=model.GlobalSequences.indexOf(duration);if(i>=0&&!clocks.has(i)){deleteGlobalSequence(model,i);for(const k of [...clocks].sort((a,b)=>a-b))if(k>i){clocks.delete(k);clocks.add(k-1);}created.splice(created.indexOf(duration),1);}}
 for(const l of draft.layers){
  const prefix=owner+'/'+l.id+'/',nodes=model.Nodes.filter(n=>n?._FxTag?.startsWith(prefix)),emitters=nodes.filter(n=>model.ParticleEmitters2.includes(n)||model.RibbonEmitters.includes(n));
  results[l.id]={id:(emitters[Math.floor(emitters.length/2)]||nodes[0])?.ObjectId,ids:emitters.map(n=>n.ObjectId),geoset:model.Geosets.findIndex(g=>g._FxTag===prefix+'shape')};
 }
 return {geoset:model.Geosets.indexOf(source),layers:results,frame};
}
