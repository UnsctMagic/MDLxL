import {Quaternion,Vector3} from 'three';
import {createNode,removeGeosets,recalculateExtents,updateCounts} from './editor-document.js';
import {applySurfaceEffect,defaultEffectOptions,effectAnchor} from './surface-effects.js';
import {indexedSurfaceIslands} from './geoset-operations.js';
import {streakCoordinates} from './visual-effect-composition.js';
import {findLook,partFrame,createsOverlay,surfaceIngredient} from './global-animation-looks.js';
import {visitTextureReferences} from './texture-references.js';
import {ribbonQuickValues} from './ribbon-quick.js';
import {visitTracks,sampleNodeMatrices,geosetSkinMatrix} from './animation.js';
import {emptyParticleModel} from './particle-recipes.js';
import {createResourceImporter} from './model-import.js';
import {addParticles} from './visual-effect-composition.js';
import {particleBurstTrack} from './particle-sweep.js';
import {deleteGlobalSequence} from './sequence-editor.js';
import {gamePathKey} from './game-path.js';
import {attackContact} from './fx-attack-contact.js';
import {vertexBoneWeights} from './part-bones.js';
import {FLY_PATHS} from './global-animation-flies.js';

const vec=v=>Float32Array.from(v);
const z=new Vector3(0,0,1),y=new Vector3(0,1,0);
export const FX_SECTIONS=['Info','Geosets','GeosetAnims','Materials','Textures','TextureAnims','GlobalSequences','Nodes','PivotPoints','BindPoses'];
const curves={
 crystal:[[0,.78],[.4,.93],[.63,1],[1,.78]],
 double:[[0,.05],[.15,.05],[.20,1],[.29,.13],[.36,.87],[.48,.05],[1,.05]],
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
 if(l.water){
  // One spatial projection across the part, including duplicated seam vertices. A painted
  // atlas island must not turn into a separate full-frame patch of water.
  const {axis,center,length}=c.frame;
  const offsets=Array.from({length:source.Vertices.length/3},(_,i)=>new Vector3().fromArray(source.Vertices,i*3).sub(center));
  const side=offsets.map(v=>v.clone().addScaledVector(axis,-v.dot(axis))).reduce((a,b)=>a.lengthSq()>b.lengthSq()?a:b).normalize();
  for(let i=0;i<offsets.length;i++){coords[2*i]=.5+offsets[i].dot(side)/(length*.55);coords[2*i+1]=.5+offsets[i].dot(axis)/(length*.55);}
 }else if(l.bodyUV&&!own)for(const island of indexedSurfaceIslands(source)){
  for(let axis=0;axis<2;axis++){
   let lo=Infinity,hi=-Infinity;
   for(const v of island){const n=coords[v*2+axis];lo=Math.min(lo,n);hi=Math.max(hi,n);}
   if(hi>lo)for(const v of island)coords[v*2+axis]=(coords[v*2+axis]-lo)/(hi-lo);
  }
 }
 if(l.glyphs){
  // A weapon material may be only disconnected edge strips. Use the existing
  // surface-island mapper so glyphs land on metal, not the gap between strips.
  coords=streakCoordinates(source,{axis:'v',band:.65});
  for(const vertices of indexedSurfaceIslands(source)){
   const region={Vertices:Float32Array.from(vertices.flatMap(v=>Array.from(source.Vertices.subarray(v*3,v*3+3))))};
   const f=partFrame(region,false);if(!f)continue;
   const repeats=Math.max(1,Math.round(f.length/Math.max(f.radius*2,1)*.4));
   for(const v of vertices)coords[v*2+1]*=repeats;
  }
 }

 const rect=l.atlasRect;
 const angle=l.direction*Math.PI/180;
 if(rect){
  // Keep every interpolation inside this native atlas cell, including extreme original UVs.
  let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;
  for(let i=0;i<coords.length;i+=2){minU=Math.min(minU,coords[i]);maxU=Math.max(maxU,coords[i]);minV=Math.min(minV,coords[i+1]);maxV=Math.max(maxV,coords[i+1]);}
  for(let i=0;i<coords.length;i+=2){
   coords[i]=rect[0]+rect[2]*((l.glyphs?.02:.10)+(l.glyphs?.96:.76)*(coords[i]-minU)/(maxU-minU||1));
   coords[i+1]=rect[1]+rect[3]*((l.glyphs?.02:.12)+(l.glyphs?.96:.73)*(coords[i+1]-minV)/(maxV-minV||1));
  }
 }else if(!paintedAtlas)for(let i=0;i<coords.length;i+=2){
  const u=coords[i]-.5,v=coords[i+1]-.5;
  coords[i]=.5+(l.uvOffset?.[0]||0)+tiles*(u*Math.cos(angle)+v*Math.sin(angle));
  coords[i+1]=.5+(l.uvOffset?.[1]||0)+tiles*(v*Math.cos(angle)-u*Math.sin(angle));
 }
 if(l.uvMatrix){const [a,b,c,d,x,y]=l.uvMatrix;for(let i=0;i<coords.length;i+=2){const u=coords[i],v=coords[i+1];coords[i]=a*u+c*v+x;coords[i+1]=b*u+d*v+y;}}
 g.TVertices=[coords];
 let tex=own?structuredClone(original.TextureID):texture(m,l.image,!rect,tag);
 if(l.frames){
  const tids=l.frames.map(name=>texture(m,name,true,tag)),n=tids.length* Math.max(1,Math.round(l.speed*3));
  tex=keys(id,ms,Array.from({length:n+1},(_,i)=>[i/n,tids[i%tids.length]]),0,Uint32Array);
 }
 const previous=m.Materials.find(mat=>mat._FxTag===tag+'/material')?.Layers[0];
 const prior=c.prior?.type===l.type&&c.prior.image===l.image?c.prior:null;
 const shape=l.pulse==='steady'?null:curves[l.pulse]||(l.type==='Glow'?curves.breathe:null);
 const strength=Math.min(1,l.strength);
 const glyphCurve=l.glyphs&&l.pulse==='flicker'?[[0,1],[.12,1],[.14,.03],[.20,.05],[.22,.92],[.49,.9],[.50,.06],[.58,.04],[.60,1],[1,1]]:l.glyphs&&l.pulse==='breathe'?[[0,.04],[.17,.08],[.49,1],[.64,.94],[1,.04]]:shape;
 const alphaFor=value=>glyphCurve?keys(id,ms,glyphCurve.map(([t,a])=>[t,a*value])):value;
 const alpha=alphaFor(strength);
 const layer={TextureID:tex,CoordId:0,TVertexAnimId:null,FilterMode:l.filter??(l.base?2:3),Shading:l.water?(l.base?1:0):l.bodyUV||l.steel?16:17,Alpha:alpha};
 if(!l.fixed&&!l.glyphs&&l.pulse!=='steady'&&l.pulse!=='fade'&&(l.type==='Moving skin'||!shape)){
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
  if(c.sameClock&&prior.strength===l.strength&&prior.pulse===l.pulse)layer.Alpha=previous.Alpha;
  if(typeof previous.TextureID==='number'||c.sameClock&&prior.speed===l.speed)layer.TextureID=previous.TextureID;
  layer.FilterMode=previous.FilterMode;layer.Shading=previous.Shading;
 }
 // Opaque native passes ignore opacity. A reduced strength needs native Blend.
 if(layer.FilterMode===0&&l.strength<1)layer.FilterMode=2;
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:l.base?0:1,RenderMode:0,Layers:Array.from({length:l.type==='Glow'?Math.max(1,Math.ceil(l.strength)):1},(_,i)=>({...structuredClone(layer),Alpha:i?alphaFor(Math.min(1,l.strength-i)):layer.Alpha}))});
 const colour=l.steel?l.tint.map(v=>.22+v*.31):l.crust?l.tint.map(v=>.18+v*.22):l.tint;
 const index=overlay(c,g,material,colour,m.GeosetAnims.find(a=>a.GeosetId===c.index));
 return {geoset:index};
}
function nativeSurface(c,l){
 const m=c.model,temp=emptyParticleModel(m.Version),e={...l.nativeSurface,texture:l.nativeSurface.texture||l.nativeSurface.picture,flow:l.nativeSurface.flow||(l.nativeSurface.id==='revenant'?[0,1,0]:undefined)};
 temp.Geosets=[structuredClone(c.source)];temp.Materials=structuredClone(m.Materials);temp.Textures=structuredClone(m.Textures);temp.TextureAnims=structuredClone(m.TextureAnims);temp.GlobalSequences=[...m.GlobalSequences];
 temp.Geosets[0].MaterialID=c.base;
 const options={...defaultEffectOptions(e),mode:'replace',geoset:0,speed:(e.duration||2000)/c.ms*l.speed,opacity:l.strength,tint:l.tint,direction:l.direction,tiling:l.tiling};
 applySurfaceEffect(temp,null,e,options);
 const importer=createResourceImporter(temp,m,{reuseTextures:'partKey',reuseGlobals:true,reuseTextureAnims:true});
 const texCount=m.Textures.length,animCount=m.TextureAnims.length;
 const material=resource(m.Materials,c.tag+'/material',importer.remapMaterial(temp.Materials[temp.Geosets[0].MaterialID]));
 for(let i=texCount;i<m.Textures.length;i++)m.Textures[i]._FxTag=c.tag+'/native-texture'+i;
 for(let i=animCount;i<m.TextureAnims.length;i++){m.TextureAnims[i]._FxTag=c.tag+'/native-motion'+i;visitTracks(m.TextureAnims[i],t=>{if(t.GlobalSeqId==null||t.GlobalSeqId<0){t.GlobalSeqId=c.id;t.Keys=[{...t.Keys[0],Frame:0}];}});}
 return {geoset:overlay(c,temp.Geosets[0],material,l.tint,m.GeosetAnims.find(a=>a.GeosetId===c.index))};
}
export function impactDefaults(model,_index,sequence,hit){
 const seq=/^attack\b/i.test(model.Sequences[sequence]?.Name||'')?sequence:model.Sequences.findIndex(s=>/^attack\b/i.test(s.Name));
 return seq<0?{sequence:-1,hit:0,contact:null}:attackContact(model,seq,hit);
}
function nativeParticles(c,l){
 const {model:m,tag,id,ms}=c,contact=l.impact?c.stack.contact:null;
 if(l.impact&&!contact)throw Error('Choose an Attack animation.');
 const sourceGeo=contact?m.Geosets[contact.geoset]:c.source;
 const regions=contact?[{frame:null,vertices:[contact.vertex],weights:vertexBoneWeights(sourceGeo,contact.vertex)}]:c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}],ids=[];
 for(const [i,region] of regions.entries()){
  const f=region.frame;
  const radius=contact?.radius??Math.max(2,Math.min(f.length*.48,55)),temp=emptyParticleModel(m.Version);
  const spec={...l.nativeSpec},e={duration:ms},options={speed:l.speed,opacity:l.strength,density:l.amount/24,tint:l.tint,sequence:c.stack.sequence};
  const source=addParticles(temp,m,spec,e,options,radius);
  const importer=createResourceImporter(temp,m,{reuseTextures:'partKey',reuseGlobals:true});
  const texCount=m.Textures.length;
  source.TextureID=importer.textureRef(source.TextureID);importer.globalRef(source);
  for(let t=texCount;t<m.Textures.length;t++)m.Textures[t]._FxTag=tag+'/native-texture'+t;
  const pos=contact?new Vector3().fromArray(sourceGeo.Vertices,3*contact.vertex):f.surfaceAt(0);
  if(l.impact){
   const interval=m.Sequences[c.stack.sequence]?.Interval;if(!interval)throw Error('Choose an Attack animation.');
   source.Squirt=true;source.EmissionRate={LineType:0,GlobalSeqId:null,Keys:m.Sequences.flatMap(s=>Array.from(s.Interval,Frame=>({Frame,Vector:vec([0])})))};
   source.EmissionRate=particleBurstTrack(source,interval,Math.min(interval[1]-1,c.stack.hit),Math.max(1,Math.round(l.burst??(spec.burst||16)*options.density)));
   // Squirt emits once at a positive key; hold its value until the clip end so
   // ordinary frame stepping cannot skip a one-millisecond positive interval.
   source.EmissionRate.Keys=source.EmissionRate.Keys.filter((k,j,all)=>!(k.Frame<interval[1]&&k.Vector[0]===0&&j>0&&all[j-1].Vector[0]>0&&k.Frame===all[j-1].Frame+1));
   source.Visibility={LineType:0,GlobalSeqId:null,Keys:m.Sequences.flatMap((s,j)=>Array.from(s.Interval,Frame=>({Frame,Vector:vec([j===c.stack.sequence?1:0])})))};
  }else source.Visibility=keys(id,ms,[[0,1],[1,1]]);
  if(!l.impact){if(l.ground)pos.set(0,0,1.5);pos.add(new Vector3(...l.offset));pos.z+=radius*(spec.height||0);}
  const p=nodeFor(c,'ParticleEmitters2','ParticleEmitter2','source'+i,l.label,pos,l.ground&&!contact?null:regionParent({...c,source:sourceGeo,parent:contact?null:c.parent},region,pos,'native-'+i));
  const keep={Name:p.Name,ObjectId:p.ObjectId,Parent:p.Parent,PivotPoint:p.PivotPoint,_FxTag:p._FxTag};Object.assign(p,source,keep);
  for(const [key,value] of Object.entries(l.native||{}))p[key]=key==='SegmentColor'?value.map(vec):key==='Alpha'?Uint8Array.from(value):key==='ParticleScaling'?vec(value):structuredClone(value);
  if(!l.native?.ParticleScaling)p.ParticleScaling=vec(Array.from(p.ParticleScaling,v=>v*l.size));
  ids.push(p.ObjectId);
 }
 return {id:ids[0],ids};
}
function groundSeal(c,l){
 const p=nodeFor(c,'EventObjects','EventObject','seal',l.stamp,new Vector3(...l.offset).add(new Vector3(0,0,1.5)),null);
 const code=l.stamp.slice(4),type=l.stamp.slice(0,3),names=new Set(c.model.EventObjects.filter(n=>n!==p).map(n=>n.Name)),letter=[...'xyzabcdefghijklmnopqrstuvw'].find(k=>!names.has(type+k+code));
 p.Name=type+letter+code;p.EventTrack=Uint32Array.from([c.stack.impact?c.stack.hit:Math.round(c.ms*.185)]);p.GlobalSeqId=c.stack.impact?null:c.id;
 return {id:p.ObjectId,ids:[p.ObjectId]};
}
// PRE2 has one parent. A blended skin region needs an attachment translation under
// that parent; sample the existing skin evaluator without changing any authored key.
function regionParent(c,region,point,key){
 const parent=region.weights.slice().sort((a,b)=>b[1]-a[1])[0]?.[0]??c.parent;
 if(region.weights.length<2)return parent;
 const bone=nodeFor(c,'Bones','Bone','binding-'+key,'Skin attachment '+key,point,parent),samples=c.attachmentCache;
 const keys=[];
 for(const [sequence,clip] of c.model.Sequences.entries()){
  const value=frame=>{const key=sequence+':'+frame;let matrices=samples.get(key);if(!matrices){matrices=sampleNodeMatrices(c.model,frame,sequence,frame);samples.set(key,matrices);}const world=point.clone().applyMatrix4(geosetSkinMatrix(c.source,region.vertices[0],matrices));const inverse=matrices.get(parent)?.clone().invert();if(inverse)world.applyMatrix4(inverse);return world.sub(point);};
  const result=new Map(),sample=t=>{if(!result.has(t))result.set(t,value(t));return result.get(t);};
  const split=(a,b)=>{const mid=Math.floor((a+b)/2);if(mid===a)return;const error=sample(mid).distanceTo(sample(a).clone().lerp(sample(b),(mid-a)/(b-a)));if(b-a>80||error>Math.max(.005,c.frame.length*.0003)){split(a,mid);split(mid,b);}else result.delete(mid);};
  const [a,b]=clip.Interval;sample(a);sample(b);split(a,b);
  for(const [Frame,v] of [...result].sort(([a],[b])=>a-b))keys.push({Frame,Vector:vec(v.toArray())});
 }
 bone.Translation={LineType:1,GlobalSeqId:null,Keys:keys};return bone.ObjectId;
}
function particles(c,l){
 const {model:m,id,ms,tag}=c,fly=l.kind==='flies',mote=l.kind==='motes';
 const count=fly?Math.max(1,Math.round(l.amount)):l.count;
 const ids=[];
 const regions=c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}];
 for(const [regionIndex,region] of regions.entries()){
 const regionCount=fly?Math.ceil((regionIndex+1)*count/regions.length)-Math.ceil(regionIndex*count/regions.length):count;
 const frame=region.frame;
 const parentBone=region.weights.slice().sort((a,b)=>b[1]-a[1])[0]?.[0]??c.parent;
 for(let i=0;i<regionCount;i++){
  const along=count===1?0:-l.lower+(l.upper+l.lower)*(i+.20)/(count-.60);
  const pos=fly||mote?frame.center.clone():frame.surfaceAt(along);
  pos.add(new Vector3(...l.offset));
  let parent=regionParent(c,region,pos,'particles-'+regionIndex+'-'+i);
  if(fly||mote){
   pos.copy(frame.center).add(new Vector3(...l.offset));
   const orbit=nodeFor(c,'Bones','Bone','orbit'+regionIndex+'-'+i,l.label+' orbit '+(i+1),pos,parent);
   const r=fly?l.size:Math.max(frame.girth*.9,frame.length*.25),phase=i*2.39996,tilt=(i%3-1)*.38+.16;
   const wind=i%2?-1:1,steps=32,turns=1+i%3;
   const path=Array.from({length:steps+1},(_,k)=>{
    const a=2*Math.PI*(k%steps)/steps,b=a*turns*wind+phase,rr=r*(.84+.17*Math.sin(2*a+phase)+.08*Math.cos(5*a-phase));
    return [k/steps,[Math.cos(b)*rr,Math.sin(b)*rr*(.76+.12*Math.sin(phase)),Math.sin(b+tilt)*tilt*r+.16*r*Math.sin(3*a+phase)+.07*r*Math.cos(7*a-phase)]];
   });
   orbit.Translation=fly?{LineType:2,GlobalSeqId:id,Keys:FLY_PATHS[i%FLY_PATHS.length].map(k=>({Frame:Math.round(k[0]*ms),Vector:vec(k.slice(1,4).map(v=>v*r)),InTan:vec(k.slice(4,7).map(v=>v*r)),OutTan:vec(k.slice(7,10).map(v=>v*r))}))}:keys(id,ms,path);parent=orbit.ObjectId;
  }else if(l.kind==='drops')pos.z-=frame.girth*.35;
  const p=nodeFor(c,'ParticleEmitters2','ParticleEmitter2','source'+regionIndex+'-'+i,l.label+' '+(i+1),pos,parent);
  const size=fly?l.spriteSize:l.size,atlas=l.atlas||1,flame=l.kind==='flame',mist=l.kind==='mist';
  const colors=flame?[l.tint.map(v=>Math.min(1,v*.37+.63)),l.tint,l.tint.map((v,j)=>v*[.98,.42,.08][j])]:[l.tint,l.tint,mist?l.tint:l.tint.map(v=>v*.75)];
  const current={...p},prior=c.prior;
  Object.assign(p,{Flags:4096|32768|(fly||mote?524288:0),TextureID:texture(m,l.image,false,tag),FilterMode:fly||l.kind==='drops'?0:1,Rows:fly?12:atlas,Columns:fly?16:atlas,
   Speed:l.velocity,Variation:fly?0:.35,Latitude:flame?24:mist?48:34,Gravity:l.gravity,LifeSpan:l.lasts,
   Width:fly?0:size*.2,Length:fly?0:size*.25,
   EmissionRate:fly?1.3/l.lasts:keys(id,ms,Array.from({length:9},(_,k)=>[k/8,l.amount/(count*regions.length)*(.76+.24*Math.cos((k%8)*Math.PI/4+i*1.7))])),
   Visibility:keys(id,ms,[[0,1],[1,1]]),FrameFlags:1,Time:fly?.5:.36,SegmentColor:colors.map(vec),
   ParticleScaling:vec(fly?[size,size,size]:flame?[size*.94,size,size*.23]:mist?[size*.45,size,size*1.38]:[size*.45,size,size*.12]),
   Alpha:Uint8Array.from((fly?[255,255,245]:mist?[0,70,0]:flame?[230,254,0]:[88,232,0]).map(a=>Math.round(a*l.strength)))});
  if(l.kind==='crackle'){
   // The Knight and Impaler use this additive, model-space sprite in Spell.
   p.Flags|=524288;p.Variation=.18;p.Latitude=55;p.Time=.43;
   p.SegmentColor=[vec([1,1,1]),vec(l.tint),vec(l.tint.map((v,j)=>v*[.8,.48,1][j]))];
   p.Alpha=Uint8Array.from([255,250,0],a=>Math.round(a*l.strength));p.ParticleScaling=vec([size*.48,size,size*1.18]);
  }
  const first=fly?9*16+7:0,end=fly?first:mist?25:atlas*atlas-1,mid=fly?first:mist?12:Math.floor(end*.4);
  p.LifeSpanUVAnim=Uint32Array.from([first,mid,1]);p.DecayUVAnim=Uint32Array.from([Math.min(end,mid+1),end,1]);
  if(prior?.kind===l.kind&&current.Visibility?.GlobalSeqId!=null){
   // A layer adjustment preserves independent native fields already edited in EMTR.
   for(const field of ['Flags','FilterMode','TextureID','Rows','Columns','FrameFlags','Time','Variation','Latitude','TailLength','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim'])p[field]=current[field];
   for(const [option,fields] of Object.entries({size:['ParticleScaling','Width','Length'],lasts:['LifeSpan'],velocity:['Speed'],gravity:['Gravity'],strength:['Alpha'],tint:['SegmentColor']})){
    if(JSON.stringify(l[option])===JSON.stringify(prior[option])&&(option!=='size'||l.spriteSize===prior.spriteSize))for(const field of fields)p[field]=current[field];
   }
   if(l.amount===prior.amount&&c.sameClock&&l.lasts===prior.lasts)p.EmissionRate=current.EmissionRate;
  }
  for(const [key,value] of Object.entries(l.native||{}))p[key]=key==='SegmentColor'?value.map(vec):key==='Alpha'?Uint8Array.from(value):key==='ParticleScaling'?vec(value):structuredClone(value);
  ids.push(p.ObjectId);
 }
 }
 return {id:ids[Math.floor(ids.length/2)],ids,family:'ParticleEmitters2'};
}
function edgeLayer(c,l){
 const {model:m,id,ms,tag}=c;
 const regions=c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}],ids=[];
 for(const [regionIndex,region] of regions.entries()){const frame=region.frame;
 const point=frame.center.clone().add(new Vector3(...l.offset));
 const p=nodeFor(c,'RibbonEmitters','RibbonEmitter','edge'+regionIndex,l.label,point,regionParent(c,region,point,'edge-'+regionIndex));
 // A small closed sway gives a stationary edge a width as the ribbon sheds its last vertices.
 const normal=new Vector3().crossVectors(frame.axis,Math.abs(frame.axis.z)<.9?z:y).normalize();
 p.Translation=keys(id,ms,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,normal.clone().multiplyScalar(frame.girth*.18*a).toArray()]));
 const layer={FilterMode:4,Shading:17,TextureID:texture(m,l.image,false,tag),CoordId:0,TVertexAnimId:null,Alpha:1};
 Object.assign(p,{MaterialID:resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:[layer]}),Rotation:keys(id,ms,[[0,new Quaternion().setFromUnitVectors(y,frame.axis).toArray()]],0),
  HeightAbove:l.upper,HeightBelow:l.lower,Alpha:keys(id,ms,curves.flicker.map(([t,a])=>[t,a*l.strength])),Color:vec(l.tint),LifeSpan:l.lasts,EmissionRate:l.smoothness,Gravity:l.gravity,Visibility:keys(id,ms,[[0,1],[1,1]])});
 ids.push(p.ObjectId);
 }
 return {id:ids[0],ids,family:'RibbonEmitters'};
}
function runeLayer(c,l){
 return skinLayer({...c,prior:c.prior?{...c.prior,type:'Glow',pulse:c.prior.pulse||'breathe'}:null},{...l,type:'Glow',pulse:l.pulse||'breathe',axis:'v',band:.8,bodyUV:false});
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
 for(const key of ['ParticleEmitters2','RibbonEmitters','EventObjects','Bones']){
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
   read('strength',(l.type==='Glow'||l.glyphs)?model.Materials[model.Geosets[index]?.MaterialID].Layers.reduce((n,v)=>n+(typeof v.Alpha==='number'?v.Alpha:v.Alpha?.Keys.reduce((a,k)=>Math.max(a,k.Vector[0]),0)||0),0):peak);
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
   if(l.kind==='native'){if(l.native)for(const key of Object.keys(l.native)){const value=node[key];l.native[key]=key==='SegmentColor'?value.map(v=>Array.from(v)):ArrayBuffer.isView(value)?Array.from(value):structuredClone(value);}continue;}
   read('lasts',node.LifeSpan);read('gravity',typeof node.Gravity==='number'?node.Gravity:null);read('velocity',typeof node.Speed==='number'?node.Speed:null);
   read(l.kind==='flies'?'spriteSize':'size',node.ParticleScaling?.[1]);
   if(l.kind!=='flies'&&l.kind!=='native'){
    const rate=typeof node.EmissionRate==='number'?node.EmissionRate:node.EmissionRate?.Keys?.[0]?.Vector[0];
    const phase=(Math.floor(emitters.length/2)%l.count)*1.7,weight=typeof node.EmissionRate==='number'?1:.76+.24*Math.cos(phase);
    if(Number.isFinite(rate))read('amount',rate*emitters.length/weight);
   }
   if(l.native)for(const key of Object.keys(l.native)){const v=node[key];l.native[key]=key==='SegmentColor'?v.map(a=>Array.from(a)):ArrayBuffer.isView(v)?Array.from(v):structuredClone(v);}
   const rgb=Array.from(node.SegmentColor?.[1]||[]);
   if(rgb.length===3&&rgb.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=rgb;
  }
 }
 return draft;
}
export function compileAnimation(model,index,draft,{rune}={}){
 const source=model.Geosets[index];if(!source)throw Error('Select a part first.');
 const before=readAnimationStack(model,index), base=before?.baseMaterial??source.MaterialID,owner=draft.owner;
 const strikeGeo=draft.impact?model.Geosets[draft.contact?.geoset]:null;
 if(draft.impact&&(!strikeGeo||strikeGeo._FxTag||!(draft.contact.vertex>=0&&draft.contact.vertex*3<strikeGeo.Vertices.length)))draft={...draft,...impactDefaults(model,index,draft.sequence,draft.hit)};
 const attachmentCache=new Map(),originalClocks=[...model.GlobalSequences];
 const frame=partFrame(source),created=[...(before?.createdClocks||[])],used=new Set();
 const ms=Math.max(200,Math.round(draft.loop)),id=draft.layers.length&&!draft.impact?clockFor(model,ms,created):-1;
 const state=JSON.parse(JSON.stringify(draft));state.baseMaterial=base;state.createdClocks=created;
 source.MaterialID=base;source._FxStack=state;
 if(!createsOverlay(draft)&&draft.layers.some(l=>l.enabled!==false&&surfaceIngredient(l))){
  const original=model.Materials[base].Layers[0];
  const water=draft.asOverlay==null&&draft.layers.some(l=>l.enabled!==false&&l.base&&l.water);
  const underlay=water?structuredClone(model.Materials[base].Layers):[structuredClone(original)];
  for(const layer of underlay){
   layer.FilterMode=2;
   if(!water)layer.Alpha=0;
   else if(layer.Alpha==null)layer.Alpha=.22;
   else if(typeof layer.Alpha==='number')layer.Alpha*=.22;
   else for(const key of layer.Alpha.Keys)key.Vector[0]*=.22;
  }
  source.MaterialID=resource(model.Materials,owner+'/underlay',{PriorityPlane:0,RenderMode:0,Layers:underlay});
 }
 const results={};
 for(const l of draft.layers){
  if(l.enabled===false)continue;
  const prior=before?.look===draft.look?before.layers.find(item=>item.id===l.id):null;
  const tag=owner+'/'+l.id,context={model,source,index,base,frame,parent:effectAnchor(model,source),id,ms,tag,used,rune,prior,stack:draft,attachmentCache,sameClock:before?.loop===ms};
  // Retain edits made in the normal material, node or emitter managers for untouched layers.
  if(before?.look===draft.look&&(!draft.impact||JSON.stringify(before?.contact)===JSON.stringify(draft.contact))&&ms===before?.loop&&before?.sequence===draft.sequence&&before?.hit===draft.hit&&JSON.stringify(before.layers.find(other=>other.id===l.id))===JSON.stringify(l)){
   for(const item of [...model.Geosets,...model.Nodes.filter(Boolean)])if(item._FxTag?.startsWith(tag+'/'))used.add(item._FxTag);
  }else if(l.stamp)groundSeal(context,l);
  else if(l.nativeSurface)nativeSurface(context,l);
  else if(l.nativeSpec)nativeParticles(context,l);
  else if(l.type==='Particles')particles(context,l);
  else if(l.type==='Edge')edgeLayer(context,l);
  else if(l.type==='Rune')runeLayer(context,l);
  else skinLayer(context,l);
 }
 for(const duration of model.GlobalSequences)if(!originalClocks.includes(duration)&&!created.includes(duration))created.push(duration);
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
