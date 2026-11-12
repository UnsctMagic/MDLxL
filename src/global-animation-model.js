import {Quaternion,Vector3} from 'three';
import {layerEmitterPoint,individualEmitterLayer,emitterSitePoint,activeEmitterSites,emitterRotationTrack} from './fx-emitter-placement.js';
import {analyseEmitterSurface,suggestEmitterSites,suggestAdditionalEmitterSites,suggestTipEmitterSites,surfaceFitInputs,SURFACE_FIT_VERSION} from './fx-emitter-surface.js';
import {appendGeosetGeometry,createNode,removeGeosets,updateCounts,geosetBounds} from './editor-document.js';
import {cardFields,CARD_CLOCK_FACTORS,CARD_JITTER_MS,EASED_TURN,LINEAR_TURN,FLY_SETS,FLY_SIZES,FLY_SCATTER,FLY_BOUNDS,flyClock,flyPicture} from './fx-cards.js';
import {unitHeight} from './fx-layer-basis.js';
import {applySurfaceEffect,defaultEffectOptions,effectAnchor} from './surface-effects.js';
import {indexedSurfaceIslands} from './geoset-operations.js';
import {streakCoordinates} from './visual-effect-composition.js';
import {partFrame,createsOverlay,surfaceIngredient,layerMoves,secondTint} from './global-animation-looks.js';
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
 // Looping glows keep alpha high (study): a shallow smooth swell.
 soft:[[0,.78],[.5,1],[1,.78]],
};
// Colour rhythms keep alpha constant and move the geoset colour between colour A and B.
const COLOUR_RHYTHMS={
 beat:{type:3,keys:(a,b)=>[[0,a],[.5,b],[1,a]]},
 embers:{type:1,keys:(a,b)=>[[0,a],[.11,b],[.27,a],[.45,b.map(v=>v*.41)],[.58,a],[.79,b.map(v=>v*.76)],[1,a]]},
 shift:{type:1,keys:(a,b)=>[[0,a],[.2,a],[.5,b],[.7,b],[1,a]]},
};
function keys(clock,ms,pairs,type=1,ArrayType=Float32Array){
 // Smooth (Bezier) keys ease in and out of each value.
 return {GlobalSeqId:clock,LineType:type,Keys:pairs.map(([t,value])=>{const Vector=ArrayType.from(Array.isArray(value)?value:[value]);return type>=2?{Frame:Math.round(t*ms),Vector,InTan:Vector.slice(),OutTan:Vector.slice()}:{Frame:Math.round(t*ms),Vector};})};
}
/** The layer's geoset colour: a colour rhythm animates it from A to B on the layer clock. */
function rhythmColour(c,l,colour){
 const rhythm=COLOUR_RHYTHMS[l.pulse];if(!rhythm)return colour;
 const map=l.steel?v=>.22+v*.31:l.crust?v=>.18+v*.22:v=>v,second=(l.tint2||secondTint(l.tint)).map(map);
 return keys(c.id,c.ms,rhythm.keys(Array.from(colour),second),rhythm.type);
}
/**
 * Whole passes for a Speed: an integer speed runs that many passes on the layer clock (as always); a fractional
 * one runs the next whole number of passes on a longer clock, so the texture still wraps seamlessly.
 */
function passClock(c,speed,perPass=1){
 const passes=speed*perPass,whole=Math.max(1,Math.ceil(passes-1e-9));
 if(Math.abs(passes-Math.round(passes))<1e-9&&passes>=1)return {turns:Math.round(passes),id:c.id,ms:c.ms};
 const ms=Math.max(1,Math.round(c.ms*whole/passes));
 return {turns:whole,id:clockFor(c.model,ms,c.createdClocks),ms};
}
function clockFor(m,ms,created){
 const owned=[...created,...m.Geosets.flatMap(g=>g._FxStack?.createdClockIds||[])];
 let id=owned.find(i=>m.GlobalSequences[i]===ms);
 if(id==null)id=m.GlobalSequences.push(ms)-1;
 if(!created.includes(id))created.push(id);
 return id;
}
function texture(m,name,wrap,tag){
 const existing=m.Textures.findIndex(t=>!t.ReplaceableId&&gamePathKey(t.Image||'')===gamePathKey(name)&&(!wrap||(t.Flags&3)===3));
 return existing<0?m.Textures.push({Image:name,Flags:wrap?3:0,ReplaceableId:0,_FxTag:tag})-1:existing;
}
// team: 1 team colour, 2 team glow; the player's colour, as native team cards use it.
function teamTexture(m,team,tag){
 const existing=m.Textures.findIndex(t=>t.ReplaceableId===team);
 return existing<0?m.Textures.push({Image:'',Flags:0,ReplaceableId:team,_FxTag:tag})-1:existing;
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
function overlay(c,geometry,material,colour,ownAnimation,inflate){
 const m=c.model,tag=c.tag+'/shape',copy=structuredClone(geometry);delete copy._FxStack;
 copy.MaterialID=material;
 // Lift: a shell pushed out along the vertex normals, like native glow shells.
 if(inflate>0&&copy.Normals?.length===copy.Vertices.length)for(let i=0;i<copy.Vertices.length;i+=3){
  const x=copy.Normals[i],y=copy.Normals[i+1],z=copy.Normals[i+2],d=Math.hypot(x,y,z)||1;
  copy.Vertices[i]+=x/d*inflate;copy.Vertices[i+1]+=y/d*inflate;copy.Vertices[i+2]+=z/d*inflate;
 }
 const index=resource(m.Geosets,tag,copy);c.used.add(tag);
 // The lifted shell gets its own bounds; the model's authored bounds stay, so removing the look restores them.
 if(inflate>0)Object.assign(m.Geosets[index],geosetBounds(m.Geosets[index].Vertices));
 const old=m.GeosetAnims.find(a=>a.GeosetId===index);
 const anim={...(ownAnimation?structuredClone(ownAnimation):{}),GeosetId:index,Alpha:ownAnimation?.Alpha??1,Flags:(ownAnimation?.Flags||0)|2,Color:colour.Keys?colour:vec(colour)};
 if(old)Object.assign(old,anim);else m.GeosetAnims.push(anim);
 return index;
}
// Layer fields that only stacks made with per-layer editing carry.
const EDITOR_FIELDS=['unshaded','unfogged','twoSided','loop','inflate','tint2','team','repeats','glyphScale','glyphTurn','glyphSlide','glyphAcross'];
const LIGHTING=[['unshaded',1],['twoSided',16],['unfogged',32]];
const hasLighting=l=>LIGHTING.some(([key])=>l[key]!=null);
// Explicit layer lighting replaces only the bits it names.
function shading(bits,l){
 for(const [key,bit] of LIGHTING)if(l[key]!=null)bits=l[key]?bits|bit:bits&~bit;
 return bits;
}
export function textureRepeats(model,textureId){
 return (model.Textures[textureId]?.Flags&3)===3;
}
// Scale each pass of this ingredient. Excess glow adds light after the first pass.
export function strengthPasses(unitLayers,strength,glow=false,alphaFor=null){
 const copies=glow?Math.max(1,Math.ceil(strength)):1,passes=[];
 for(let i=0;i<copies;i++)for(const source of unitLayers){
  const pass={...source},value=Math.max(0,Math.min(1,strength-i));
  if(i)pass.FilterMode=3;
  else if(value<1&&[0,1].includes(pass.FilterMode))pass.FilterMode=2;
  if(alphaFor)pass.Alpha=alphaFor(value);
  else if(typeof source.Alpha==='number'||!source.Alpha)pass.Alpha=(source.Alpha??1)*value;
  else pass.Alpha={...source.Alpha,Keys:source.Alpha.Keys.map(key=>{
   const next={...key};
   for(const field of ['Vector','InTan','OutTan'])if(key[field])next[field]=Float32Array.from(key[field],n=>n*value);
   return next;
  })};
  passes.push(pass);
 }
 return passes;
}
/** Per-island glyph strips: the vertices of each island and how often the glyphs repeat along it. */
export function glyphIslands(source){
 return indexedSurfaceIslands(source).flatMap(vertices=>{
  const region={Vertices:Float32Array.from(vertices.flatMap(v=>Array.from(source.Vertices.subarray(v*3,v*3+3))))};
  const f=partFrame(region,false);
  return f?[{vertices,repeats:Math.max(1,Math.round(f.length/Math.max(f.radius*2,1)*.4))}]:[];
 });
}
const GLYPH_LAYOUT=['glyphScale','glyphTurn','glyphSlide','glyphAcross'];
/** The rune layout fields as one similarity transform about the texture centre: [a,b,c,d,x,y] like uvMatrix. */
export function glyphTransform(l){
 const s=1/(l.glyphScale||1),turn=-(l.glyphTurn||0)*Math.PI/180,a=s*Math.cos(turn),b=s*Math.sin(turn);
 return [a,b,-b,a,.5-a*.5+b*.5+(l.glyphAcross||0),.5-b*.5-a*.5+(l.glyphSlide||0)];
}
const compose=([a,b,c,d,x,y],[e,f,g,h,u,v])=>[a*e+c*f,b*e+d*f,a*g+c*h,b*g+d*h,a*u+c*v+x,b*u+d*v+y];
function invert([a,b,c,d,x,y]){const det=a*d-b*c,ia=d/det,ib=-b/det,ic=-c/det,id=a/det;return [ia,ib,ic,id,-(ia*x+ic*y),-(ib*x+id*y)];}
const round=(v,step)=>Math.round(v/step)*step;
/** Apply a fit-view gesture (an affine change of the final UVs) to the rune layout fields, so fields and view agree. */
export function withGlyphGesture(l,gesture){
 const m=l.uvMatrix||[1,0,0,1,0,0],[a,b,c,d,x,y]=compose(invert(m),compose(gesture,compose(m,glyphTransform(l))));
 const s=Math.sqrt(Math.abs(a*d-b*c));if(!(s>1e-6))return l;
 const turn=-Math.atan2(b,a)*180/Math.PI;
 return {...l,glyphScale:round(1/s,.001),glyphTurn:round(((turn+540)%360)-180,.1),glyphAcross:round(x-.5+a*.5+c*.5,1e-4),glyphSlide:round(y-.5+b*.5+d*.5,1e-4)};
}
function fitCoordinates(c,l){
 const {model:m,source}=c;
 const mat=m.Materials[c.base],original=mat?.Layers.findLast(layer=>typeof layer.TextureID==='number'&&!m.Textures[layer.TextureID]?.ReplaceableId)||mat?.Layers.at(-1);
 if(!original&&!l.image)throw Error('The selected part has no texture to animate.');
 const own=!l.image;
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
  // Repeat replaces the count fitted to each island's length.
  for(const {vertices,repeats} of glyphIslands(source))for(const v of vertices)coords[v*2+1]*=l.repeats!=null?Math.max(.25,l.repeats):repeats;
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
 // Rune layout (Size, Turn, Slide, Across) comes before a UV map moved in the fit view.
 for(const matrix of [l.glyphs&&GLYPH_LAYOUT.some(key=>l[key]!=null)?glyphTransform(l):null,l.uvMatrix])if(matrix){const [a,b,c,d,x,y]=matrix;for(let i=0;i<coords.length;i+=2){const u=coords[i],v=coords[i+1];coords[i]=a*u+c*v+x;coords[i+1]=b*u+d*v+y;}}
 return {coords,original,own,rect,paintedAtlas,angle};
}
/** The UVs a surface layer would get, for a live preview of a fitting control. */
export function previewCoordinates(model,index,stack,layer){
 const source=model.Geosets[index],saved=source?._FxStack;
 let surface=source;
 const members=[...new Set(stack.group||[])].filter(i=>i!==index&&model.Geosets[i]&&!model.Geosets[i]._FxTag);
 if(members.length){surface=structuredClone(source);delete surface._FxStack;for(const i of members)appendGeosetGeometry(surface,model.Geosets[i]);}
 const base=saved&&source.MaterialID!==saved.baseMaterial&&model.Materials[source.MaterialID]?._FxTag!==saved.owner+'/underlay'?source.MaterialID:saved?.baseMaterial??source.MaterialID;
 const l=layer.type==='Rune'?{...layer,type:'Glow',pulse:layer.pulse||'breathe',axis:'v',band:.8,bodyUV:false}:layer;
 return fitCoordinates({model,source:surface,base,frame:l.water?partFrame(surface):null},l).coords;
}
function skinLayer(c,l){
 const {model:m,source,tag,id,ms}=c;
 const prior=c.prior?.type===l.type?c.prior:null;
 const previousShape=m.Geosets.find(g=>g._FxTag===tag+'/shape');
 const previous=m.Materials[previousShape?.MaterialID]?.Layers[0];
 const samePicture=prior&&prior.image===l.image;
 const {coords,original,own,rect,paintedAtlas,angle}=fitCoordinates(c,l),g={...source,TVertices:[...source.TVertices]};
 // A UV Wrapper edit belongs to the live shape. Refit when the target or its fitting controls change.
 const keepUV=prior&&previous&&c.sameGroup
  &&previousShape.Vertices.length===source.Vertices.length&&previousShape.Faces.length===source.Faces.length
  &&source.Faces.every((vertex,i)=>vertex===previousShape.Faces[i])
  &&['own','direction','tiling','atlasRect','uvOffset','uvMatrix','repeats',...GLYPH_LAYOUT].every(key=>JSON.stringify(prior[key])===JSON.stringify(l[key]));
 g.TVertices=keepUV?previousShape.TVertices:[coords];
 let tex=own?structuredClone(original.TextureID):l.team?teamTexture(m,l.team,tag):texture(m,l.image,!rect,tag);
 if(l.frames){
  // Three frame cycles per unit of Speed; a fractional count of cycles runs whole cycles on a longer clock.
  const tids=l.frames.map(name=>texture(m,name,true,tag)),flip=l.speed>0?passClock(c,l.speed,3):{turns:1,id,ms},n=tids.length*flip.turns;
  // Speed 0 holds the first frame.
  tex=l.speed===0?tids[0]:keys(flip.id,flip.ms,Array.from({length:n+1},(_,i)=>[i/n,tids[i%tids.length]]),0,Uint32Array);
 }

 const shape=l.pulse==='steady'||COLOUR_RHYTHMS[l.pulse]?null:curves[l.pulse]||(l.type==='Glow'?curves.breathe:null),curveType=l.pulse==='soft'?3:1;
 const glyphCurve=l.glyphs&&l.pulse==='flicker'?[[0,1],[.12,1],[.14,.03],[.20,.05],[.22,.92],[.49,.9],[.50,.06],[.58,.04],[.60,1],[1,1]]:l.glyphs&&l.pulse==='breathe'?[[0,.04],[.17,.08],[.49,1],[.64,.94],[1,.04]]:shape;
 let arc;
 if(l.powerArcs){
  const count=Math.max(1,Math.round(l.amount)),span=Math.max(60,Math.round(l.burstWindow*1000));
  const ms=span+Math.max(100,Math.round(l.burstGap*1000)),clock=clockFor(m,ms,c.createdClocks);
  const alpha=[[0,0]],motion=[[0,[0,0,0]]];
  for(let i=0;i<count;i++){
   const start=40+i*(span-40)/count,end=start+(span-40)/count*.68;
   alpha.push([start/ms,1],[end/ms,0]);
   motion.push([start/ms,[[0,.07,-.06,.04][i%4],[0,.29,.61,.84][i%4],0]]);
  }
  alpha.push([1,0]);motion.push([1,[0,0,0]]);arc={ms,clock,alpha,motion};
 }
 const alphaFor=value=>arc?keys(arc.clock,arc.ms,arc.alpha.map(([t,a])=>[t,a*value]),0):glyphCurve?keys(id,ms,glyphCurve.map(([t,a])=>[t,a*value]),curveType):value;
 const alpha=alphaFor(1);
 const layer={TextureID:tex,CoordId:keepUV?(previous.CoordId??0):0,TVertexAnimId:null,FilterMode:l.filter??(l.base?2:3),Shading:shading(l.water?(l.base?1:0):l.bodyUV||l.steel?16:17,l),Alpha:alpha};
 if(layerMoves(l)&&l.speed!==0){
  // Whole tiles at wrap. The direction selects a lattice vector or a closed excursion for an atlas.
  // A fractional Speed runs the next whole number of passes on a longer clock: slower, still whole at wrap.
  const pass=l.speed>0?passClock(c,l.speed):{turns:Math.max(1,Math.round(l.speed)),id,ms},turns=pass.turns;
  // Painted unit atlases do not repeat. Drift a few texels and return to the same face.
  const extent=rect?[rect[2]*.09,rect[3]*.09]:paintedAtlas?[.014,.014]:null;
  const pairs=extent?Array.from({length:turns*4+1},(_,i)=>{
   const phase=[0,1,0,-1][i%4];
   return [i/(turns*4),[phase*extent[0]*Math.cos(angle),phase*extent[1]*Math.sin(angle),0]];
  }):[[0,[0,0,0]],[1,l.axis==='v'?[0,turns,0]:[turns,0,0]]];
  if(samePicture&&previous&&c.sameClock&&prior.speed===l.speed&&prior.direction===l.direction&&prior.fixed===l.fixed&&prior.pulse===l.pulse)layer.TVertexAnimId=previous.TVertexAnimId;
  else layer.TVertexAnimId=resource(m.TextureAnims,tag+'/motion',{Translation:keys(pass.id,pass.ms,pairs)});
 }
 if(samePicture&&previous){
  if(typeof previous.TextureID==='number'&&!(l.frames&&prior.speed!==l.speed)||c.sameClock&&prior.speed===l.speed)layer.TextureID=previous.TextureID;
  // Keep a material-manager edit unless this layer's own Blend or lighting changed.
  if(prior.filter===l.filter)layer.FilterMode=previous.FilterMode;
  if(LIGHTING.every(([key])=>prior[key]===l[key]))layer.Shading=previous.Shading;
 }
 if(arc){layer.FilterMode=l.filter??3;layer.TVertexAnimId=resource(m.TextureAnims,tag+'/motion',{Translation:keys(arc.clock,arc.ms,arc.motion,0)});}
 const passes=strengthPasses([layer],l.strength,l.type==='Glow',alphaFor);
 if(samePicture&&previous&&c.sameClock&&prior.strength===l.strength&&prior.pulse===l.pulse)passes[0].Alpha=previous.Alpha;
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:l.base?0:1,RenderMode:0,Layers:passes});
 const colour=l.steel?l.tint.map(v=>.22+v*.31):l.crust?l.tint.map(v=>.18+v*.22):l.tint;
 const index=overlay(c,g,material,rhythmColour(c,l,colour),m.GeosetAnims.find(a=>a.GeosetId===c.index),l.inflate);
 return {geoset:index};
}
function nativeSurface(c,l){
 // atlasRect picks another area of the card's picture; the native fit and drift follow it.
 const m=c.model,temp=emptyParticleModel(m.Version),e={...l.nativeSurface,texture:l.nativeSurface.texture||l.nativeSurface.picture,flow:l.nativeSurface.flow||(l.nativeSurface.id==='revenant'?[0,1,0]:undefined),...(l.atlasRect?{atlas:l.atlasRect}:{})};
 temp.Geosets=[structuredClone(c.source)];temp.Materials=structuredClone(m.Materials);temp.Textures=structuredClone(m.Textures);temp.TextureAnims=structuredClone(m.TextureAnims);temp.GlobalSequences=[...m.GlobalSequences];
 temp.Geosets[0].MaterialID=c.base;
 const options={...defaultEffectOptions(e),mode:'replace',geoset:0,speed:(e.duration||2000)/c.ms*(l.speed||1),opacity:1,tint:l.tint,direction:l.direction,tiling:l.tiling};
 applySurfaceEffect(temp,null,e,options);
 if(l.uvMatrix){const [a,b,cc,d,x,y]=l.uvMatrix;for(const uv of temp.Geosets[0].TVertices)for(let i=0;i<uv.length;i+=2){const u=uv[i],v=uv[i+1];uv[i]=a*u+cc*v+x;uv[i+1]=b*u+d*v+y;}}
 const importer=createResourceImporter(temp,m,{reuseTextures:'partKey',reuseGlobals:true,reuseTextureAnims:true});
 const texCount=m.Textures.length,animCount=m.TextureAnims.length;
 const native=importer.remapMaterial(temp.Materials[temp.Geosets[0].MaterialID]);
 // An explicit Rhythm replaces the card's own alpha: a curve at each layer's peak, or a constant one.
 if(l.pulse!=null)for(const layer of native.Layers){
  const peak=typeof layer.Alpha==='number'?layer.Alpha:layer.Alpha?.Keys?Math.max(...layer.Alpha.Keys.map(k=>k.Vector[0])):1;
  const curve=l.pulse==='steady'||COLOUR_RHYTHMS[l.pulse]?null:curves[l.pulse]||curves.breathe;
  layer.Alpha=curve?keys(c.id,c.ms,curve.map(([t,a])=>[t,a*peak]),l.pulse==='soft'?3:1):peak;
 }
 const first=native.Layers[0].Alpha;
 const peak=typeof first==='number'?first:Math.max(...first.Keys.map(k=>k.Vector[0]));
 c.state.layers.find(v=>v.id===l.id).unitAlphaPeak=peak;
 // Speed 0 holds the card's texture still.
 for(const layer of native.Layers){if(l.filter!=null)layer.FilterMode=l.filter;if(hasLighting(l))layer.Shading=shading(layer.Shading??0,l);if(l.speed===0)layer.TVertexAnimId=null;}
 native.Layers=strengthPasses(native.Layers,l.strength);
 const material=resource(m.Materials,c.tag+'/material',native);
 for(let i=texCount;i<m.Textures.length;i++)m.Textures[i]._FxTag=c.tag+'/native-texture'+i;
 for(let i=animCount;i<m.TextureAnims.length;i++){m.TextureAnims[i]._FxTag=c.tag+'/native-motion'+i;visitTracks(m.TextureAnims[i],t=>{if(t.GlobalSeqId==null||t.GlobalSeqId<0){t.GlobalSeqId=c.id;t.Keys=[{...t.Keys[0],Frame:0}];}});}
 return {geoset:overlay(c,temp.Geosets[0],material,rhythmColour(c,l,l.tint),m.GeosetAnims.find(a=>a.GeosetId===c.index),l.inflate)};
}
export function impactDefaults(model,_index,sequence,hit){
 const seq=/^attack\b/i.test(model.Sequences[sequence]?.Name||'')?sequence:model.Sequences.findIndex(s=>/^attack\b/i.test(s.Name));
 return seq<0?{sequence:-1,hit:0,contact:null}:attackContact(model,seq,hit);
}
/** Freeze the geometry offer by recipe inputs and selected surface for this model revision. */
const usesSiteGeometry=layer=>layer.widthCap!=null||layer.aim!=null;
function defaultSurfaceSites(c,layer){
 if(layer.gather==='tip'&&!layer.siteLayout)return tipEmitterSites(c);
 if(layer.birthRegion&&!layer.siteLayout)return birthRegionSites(c,layer);
 const fit=layer.surfaceFit;
 if(layer.siteLayout||fit?.version!==SURFACE_FIT_VERSION||!Number.isFinite(fit.footprint)||!Number.isFinite(fit.liveParticles))return null;
 const {attachmentCache:cache,surfaceKey,frame}=c;
 const fireFit=(layer.fireFit||layer.airyFit)?.version===1;
 const offerKey='emitter-surface|'+surfaceKey+'|'+JSON.stringify([fit,fireFit,usesSiteGeometry(layer)]);
 if(cache.has(offerKey))return cache.get(offerKey);
 const samples=suggestEmitterSites(emitterSurface(c),fit,frame.unitHeight);
 const sites=attachEmitterSites(c,samples.map((sample,index)=>({...sample,key:'surface'+index})),fireFit,usesSiteGeometry(layer));
 const result=sites.length?sites:null;
 cache.set(offerKey,result);
 return result;
}
function tipEmitterSites(c){
 const {attachmentCache:cache,surfaceKey,frame,model,source}=c;
 const key='emitter-tip|'+surfaceKey;
 if(cache.has(key))return cache.get(key);
 const pivotFor=(vertices,barycentric)=>{
  const parent=dominantWeight(surfaceWeights(source,vertices,barycentric))??c.parent;
  return new Vector3().fromArray(model.PivotPoints[parent]??frame.center.toArray());
 };
 const samples=suggestTipEmitterSites(emitterSurface(c),pivotFor,frame.unitHeight,(frame.regions?.length??1)>4);
 const sites=attachEmitterSites(c,samples.map((sample,index)=>({...sample,key:'tip'+index})),false,true);
 const result=sites.length?sites:null;
 cache.set(key,result);
 return result;
}
// Rectangles use native local X/Y half extents. Only one rigid connected
// straight piece can share a long rectangle; skin bindings stay separate.
function birthRegionSites(c,layer){
 const sites=[];
 for(const [regionIndex,region] of (c.frame.regions?.length?c.frame.regions:[{frame:c.frame,geometry:c.source,weights:[[c.parent,1]]}]).entries()){
  const shape=analyseEmitterSurface(region.geometry);
  const components=shape?.components||[];
  for(const [componentIndex,part] of components.entries()){
   const straight=region.weights.length===1&&part.frame&&part.frame.length>=5.2*Math.max(part.radius,.001);
   if(straight){
    const rotation=new Quaternion().setFromUnitVectors(y,part.frame.axis).toArray();
    sites.push({key:'region'+regionIndex+'-'+componentIndex,point:part.frame.center.toArray(),region:regionIndex,ground:false,
     birth:{width:Math.max(.05,part.radius*(layer.birthAcross??.7)),length:part.frame.length*.45,rotation},
     ...(layer.widthCap!=null?{componentWidth:part.radius}:{})});
   }else{
    // Curves and blended regions keep surface anchors rather than spanning air.
    const fit=layer.birthRegionFit?surfaceFitInputs(layer,region.frame):{footprint:Math.max(1,part.radius*.7),liveParticles:16};
    if(layer.birthRegionFit)fit.liveParticles=4*Math.min(16,Math.max(1,Math.round((part.frame?.length??part.span.length())/fit.footprint)));
    const local={...shape,components:[part],area:part.area,centre:part.centre};
    for(const [i,site] of suggestEmitterSites(local,fit,c.frame.unitHeight).entries())
     sites.push({key:'region'+regionIndex+'-'+componentIndex+'-'+i,point:site.point,region:regionIndex,ground:false,birth:{width:.05,length:.05},...(layer.widthCap!=null?{componentWidth:site.componentWidth}:{})});
   }
  }
  // A narrow skin binding may contain vertices but no complete triangles.
  if(!components.length)sites.push({key:'region'+regionIndex,point:region.frame.surfaceAt(0).toArray(),region:regionIndex,ground:false,birth:{width:.05,length:.05}});
 }
 return sites.length?sites:null;
}
function emitterSurface(c){
 const key='emitter-surface|'+SURFACE_FIT_VERSION+'|'+c.surfaceKey;
 if(!c.attachmentCache.has(key))c.attachmentCache.set(key,analyseEmitterSurface(c.source));
 return c.attachmentCache.get(key);
}
function attachEmitterSites(c,samples,fireFit,geometry=false){
 const {frame}=c,regionByVertex=new Map();
 frame.regions?.forEach((region,index)=>region.vertices.forEach(vertex=>regionByVertex.set(vertex,index)));
 // Convert the combined geometry's triangle back to its original geoset/indices.
 let vertexStart=0,triangleStart=0;
 const parts=[c.index,...(c.stack.group||[])].map(geoset=>{
  const part=c.model.Geosets[geoset];
  const range={geoset,vertexStart,triangleStart};
  vertexStart+=part.Vertices.length/3;
  triangleStart+=part.Faces.length/3;
  return range;
 });
 return samples.map(({key,point,vertices,triangle,barycentric,fit,componentWidth,normal,tipDirection})=>{
  if(!vertices)return {key,point,region:0,ground:true};
  const part=parts.findLast(entry=>entry.triangleStart<=triangle);
  const local=vertices.map(vertex=>vertex-part.vertexStart);
  const byWeight=[0,1,2].sort((a,b)=>barycentric[b]-barycentric[a]);
  const region=byWeight.map(i=>regionByVertex.get(vertices[i])).find(Number.isInteger)??0;
  return {key,point,region,ground:false,surface:{geoset:part.geoset,triangle:triangle-part.triangleStart,vertices:local,barycentric},attachmentPoint:point,
   ...(fireFit&&fit?{fireFit:fit}:{}),...(geometry?{componentWidth,strip:!!fit?.strip,normal,...(tipDirection?{tipDirection}:{})}:{})};
 });
}
function completeEmitterSiteLayout(c,layer){
 let layout=layer.siteLayout;
 if(!layout||!Number.isInteger(layer.siteCount))return layout;
 if(layer.gather==='tip'&&layout.some(site=>!site.point)){
  const tips=tipEmitterSites(c)||[];
  layout=layout.map(slot=>slot.point?slot:{...slot,...tips.find(tip=>tip.key===slot.key)});
 }
 const missing=layout.filter(site=>!site.point);
 if(!missing.length)return layout;
 if(layer.birthRegion){
  const regions=birthRegionSites(c,layer);
  if(regions?.length){
   let ordinal=0;
   return layout.map(slot=>{
    if(slot.point)return slot;
    const index=ordinal++,base=regions[index%regions.length],copies=Math.ceil((missing.length-index%regions.length)/regions.length),copy=Math.floor(index/regions.length);
    const birth={...base.birth},point=new Vector3(...base.point);
    if(birth.rotation&&copies>1){
     const axis=y.clone().applyQuaternion(new Quaternion(...birth.rotation));
     point.addScaledVector(axis,birth.length*2*((copy+.5)/copies-.5));birth.length/=copies;
    }
    return {...slot,...base,key:slot.key,refit:slot.refit,point:point.toArray(),birth};
   });
  }
 }
 const {frame,attachmentCache:cache}=c;
 const fit=layer.surfaceFit||{footprint:Math.max(1,frame.girth*.55),liveParticles:32};
 const fixed=layout.filter(site=>site.point);
 const ground=fixed.find(site=>site.ground!=null)?.ground??!!(layer.ground||layer.nativeSpec?.flat);
 const groundZ=ground?(fixed.find(site=>site.ground)?.point[2]??1.5):undefined;
 const fireFit=(layer.fireFit||layer.airyFit)?.version===1;
 const key='emitter-extra|'+c.surfaceKey+'|'+JSON.stringify([fit,groundZ,layout,fireFit,usesSiteGeometry(layer)]);
 if(cache.has(key))return cache.get(key);
 const samples=suggestAdditionalEmitterSites(emitterSurface(c),fit,frame.unitHeight,fixed.map(site=>site.point),missing.length,groundZ);
 const extra=attachEmitterSites(c,samples.map((sample,index)=>({...sample,key:missing[index].key})),fireFit,usesSiteGeometry(layer));
 const byKey=new Map(extra.map(site=>[site.key,site]));
 const completed=layout.map((slot,index)=>{
  if(slot.point)return slot;
  const sample=byKey.get(slot.key);
  if(sample)return {...slot,...sample};
  // Empty/degenerate geometry has no triangle to attach to. Keep the slot
  // usable along the fitted part instead of losing its identity.
  const point=frame.at(frame.length*((index+.5)/layout.length-.5)).toArray();
  if(ground)point[2]=groundZ;
  return {...slot,point,region:0,ground};
 });
 cache.set(key,completed);
 return completed;
}
function emitterSiteRecord(slot,point,region,ground){
 return {key:slot.key,point:point.toArray(),region,ground,...(slot.refit?{refit:true}:{}),...(slot.fireFit?{fireFit:slot.fireFit}:{}),...(slot.birth?{birth:slot.birth}:{}),
  ...(slot.componentWidth!=null?{componentWidth:slot.componentWidth,strip:!!slot.strip}:{}),
  ...(slot.normal?{normal:slot.normal}:{}),...(slot.tipDirection?{tipDirection:slot.tipDirection}:{}),
  ...(slot.surface?{surface:slot.surface,attachmentPoint:slot.attachmentPoint??slot.point}:{})};
}
function nativeEmitterRegions(c,layer,contact,source){
 const regions=contact?[{frame:null,vertices:[contact.vertex],weights:vertexBoneWeights(source,contact.vertex)}]:
  c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}];
 // A ground/flat recipe has one emitter at the longest region, not one copy per region.
 if(layer.sharedSites&&!contact&&regions.length>1&&(layer.ground||layer.nativeSpec?.flat))
  return [regions.reduce((a,b)=>b.frame.length>a.frame.length?b:a)];
 return regions;
}
/** A count edit distributes the same recipe budget that was active before it. */
function nativeEmitterBudget(c,layer){
 if(layer.siteCount!=null)return layer.siteRateScale??1;
 const surviving=key=>!layer.individuals?.[key]?.deleted;
 if(c.autoSites)return c.autoSites.filter(site=>surviving(site.key)).length/c.autoSites.length||1;
 if(c.siteLayout)return c.siteLayout.filter(site=>surviving(site.key)).length||1;
 const regions=nativeEmitterRegions(c,layer,null,c.source);
 const shares=layer.sharedSites?emissionShares(regions,1):null;
 return regions.reduce((sum,_,index)=>sum+(surviving('source'+index)?(shares?.[index]??1):0),0)||1;
}
function scatterWeights(layer,planned,active){
 if(!layer.scatter)return null;
 // Hash stable site keys, then normalize over the surviving live sites.
 const weights=planned.map(({key})=>{
  let hash=2166136261;
  for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  hash=Math.imul(hash^(hash>>>16),0x45d9f3b);
  return 1+layer.scatter*(2*((hash>>>0)/0xffffffff)-1);
 });
 const live=weights.filter((_,i)=>active?active.has(planned[i].key):!layer.individuals?.[planned[i].key]?.deleted);
 const mean=live.reduce((sum,w)=>sum+w,0)/(live.length||1)||1;
 return weights.map(weight=>weight/mean);
}
function widthCapFor(layer,slot){
 if(layer.widthCap!=null&&(!layer.widthCapRimOnly||!slot.strip))return slot.componentWidth*layer.widthCap;
 return (layer.fireFit||layer.airyFit)?.version===1?slot.fireFit?.radius*.75:undefined;
}
function capParticleScaling(stages,cap){
 const peak=Math.max(...stages);
 return cap>0&&peak>cap?vec(Array.from(stages,v=>v*cap/peak)):stages;
}
function recipeNativeValue(layer,key,value){
 if(key!=='SegmentColor'||!layer.rampTint)return value;
 return value.map(stage=>stage.map((channel,i)=>{
  const recipe=layer.rampTint[i],tint=layer.tint[i];
  return Math.max(0,Math.min(1,recipe?channel*tint/recipe:channel+tint));
 }));
}
function birthRegionRateScale(layer,planned,active,weights){
 if(!layer.birthRegionFit||layer.nativeSpec.burst)return 1;
 const points=planned.filter(slot=>slot.birth&&!slot.birth.rotation&&(active?active.has(slot.key):!layer.individuals?.[slot.key]?.deleted));
 if(!points.length)return 1;
 const rate=(layer.nativeSpec.rate??8)*layer.amount/24*(layer.siteRateScale??1);
 const count=active?.size??planned.length;
 const leastWeight=weights?Math.min(...points.map(slot=>weights[planned.indexOf(slot)])):1;
 const live=rate*layer.nativeSpec.life*leastWeight/count;
 return live>0?Math.min(4,Math.max(1,2/live)):1;
}
function hasRecipeEmitterDefaults(layer){
 return layer.recipeOwner||layer.airyFit||layer.fireFit?.version===1||layer.rampTint||layer.rampPinned||layer.widthCap!=null||
  layer.surfaceFit?.siteCount!=null||layer.scatter||layer.birthRegionFit||layer.gather||layer.aim;
}
function applyRecipeAim(c,layer,slot,node,slabRotation){
 if(layer.native?.Rotation!=null)return;
 if(layer.aim){
  let direction=layer.aim==='outward'?slot.normal:slot.tipDirection;
  if(!direction&&layer.aim==='tip'){
   const axis=c.frame.axis,point=new Vector3(...node.PivotPoint);
   direction=axis.clone().multiplyScalar(point.sub(c.frame.center).dot(axis)<0?-1:1).toArray();
  }
  if(direction&&new Vector3(...direction).lengthSq()>0){
   const rotation=new Quaternion().setFromUnitVectors(z,new Vector3(...direction).normalize());
   node.Rotation=emitterRotationTrack(c.model,rotation.toArray());
   return;
  }
 }
 if(c.prior?.aim&&!slabRotation)delete node.Rotation;
}
function nativeParticles(c,layer){
 const l=layer;
 const {model:m,tag,id,ms}=c,contact=l.impact?c.stack.contact:null;
 if(l.impact&&!contact)throw Error('Choose an Attack animation.');
 const sourceGeo=contact?m.Geosets[contact.geoset]:c.source;
 const regions=nativeEmitterRegions(c,l,contact,sourceGeo),ids=[];
 const shares=l.sharedSites&&!contact&&!l.impact?emissionShares(regions,1):null;
 const layout=c.siteLayout||c.autoSites,active=c.activeSites;
 const planned=layout?layout.map(slot=>({...slot,regionIndex:slot.region??0,region:c.frame.regions?.[slot.region]||regions[0]})):regions.map((region,i)=>({region,key:'source'+i}));
 const weights=scatterWeights(layer,planned,active),floor=birthRegionRateScale(layer,planned,active,weights);
 for(const [i,slot] of planned.entries()){
  const region=slot.region;if(!layout&&shares&&!shares[i])continue;
  if(active&&!active.has(slot.key)){
   c.sites.push(emitterSiteRecord(slot,new Vector3(...slot.point),slot.regionIndex,!!slot.ground));
   continue;
  }
  const key=slot.key,l=individualEmitterLayer(layer,key);
  const f=region.frame;
  const radius=contact?.radius??Math.max(2,Math.min(f.length*.48,55)),temp=emptyParticleModel(m.Version);
  const share=active?(layer.siteRateScale??1)/active.size:c.autoSites?1/planned.length:layout?1:shares?shares[i]:1;
  const spec={...l.nativeSpec},e={duration:ms},options={speed:l.speed,opacity:l.strength,density:l.amount/24*share*floor,tint:l.tint,sequence:c.stack.sequence};
  const source=addParticles(temp,m,spec,e,options,radius);
  if(slot.birth){source.Width=slot.birth.width;source.Length=slot.birth.length;if(slot.birth.rotation)source.Rotation=emitterRotationTrack(m,slot.birth.rotation);}
  if(weights&&typeof source.EmissionRate==='number')source.EmissionRate*=weights[i];
  else if(l.airyFit)source.EmissionRate*=1+.06*(i%5-2);
  const importer=createResourceImporter(temp,m,{reuseTextures:'partKey',reuseGlobals:true});
  const texCount=m.Textures.length;
  source.TextureID=importer.textureRef(source.TextureID);importer.globalRef(source);
  for(let t=texCount;t<m.Textures.length;t++)m.Textures[t]._FxTag=tag+'/native-texture'+t;
  const clearance=l.surfaceSites?Math.max(.1,Math.max(...source.ParticleScaling)*.3+Math.hypot(source.Width,source.Length)*.5):0;
  const pos=slot.point?new Vector3(...slot.point):contact?new Vector3().fromArray(sourceGeo.Vertices,3*contact.vertex):f.surfaceAt(0,clearance,c.frame.center);
  if(l.impact){
   const interval=m.Sequences[c.stack.sequence]?.Interval;if(!interval)throw Error('Choose an Attack animation.');
   source.Squirt=true;source.EmissionRate={LineType:0,GlobalSeqId:null,Keys:m.Sequences.flatMap(s=>Array.from(s.Interval,Frame=>({Frame,Vector:vec([0])})))};
   source.EmissionRate=particleBurstTrack(source,interval,Math.min(interval[1]-1,c.stack.hit),Math.max(1,Math.round(l.burst??(spec.burst||16)*options.density)));
   // Squirt emits once at a positive key; hold its value until the clip end so
   // ordinary frame stepping cannot skip a one-millisecond positive interval.
   source.EmissionRate.Keys=source.EmissionRate.Keys.filter((k,j,all)=>!(k.Frame<interval[1]&&k.Vector[0]===0&&j>0&&all[j-1].Vector[0]>0&&k.Frame===all[j-1].Frame+1));
   source.Visibility={LineType:0,GlobalSeqId:null,Keys:m.Sequences.flatMap((s,j)=>Array.from(s.Interval,Frame=>({Frame,Vector:vec([j===c.stack.sequence?1:0])})))};
  }else source.Visibility=keys(id,ms,[[0,1],[1,1]]);
  if(!slot.point&&!l.impact){if(l.ground)pos.set(0,0,1.5);pos.z+=radius*(spec.height||0);}
  c.sites.push(emitterSiteRecord(slot,pos,Math.max(0,c.frame.regions?.indexOf(region)??0),slot.ground??!!l.ground));
  if(!l.impact||l.placement||layer.individuals?.[key]?.position)pos.copy(emitterSitePoint(c.frame,layer,key,pos));
  if(layer.individuals?.[key]?.deleted)continue;
  const p=nodeFor(c,'ParticleEmitters2','ParticleEmitter2',key,l.label,pos,(slot.ground??l.ground)&&!contact&&!layer.individuals?.[key]?.surface?null:siteParent({...c,source:sourceGeo,parent:contact?null:c.parent},layer,key,region,pos,'native-'+i,slot));
  const keep={Name:p.Name,ObjectId:p.ObjectId,Parent:p.Parent,PivotPoint:p.PivotPoint,_FxTag:p._FxTag};Object.assign(p,source,keep);
  applyRecipeAim(c,l,slot,p,slot.birth?.rotation);
  for(const [key,value] of Object.entries(l.native||{}))p[key]=nativeValue(key,recipeNativeValue(l,key,value),m,c.createdClocks);
  if(!l.native?.ParticleScaling){
   p.ParticleScaling=vec(Array.from(p.ParticleScaling,v=>v*l.size));
   const edited=l.widthCapEdited||layer.individuals?.[key]?.values?.size!=null;
   if(l.widthCap!=null?!edited:l.airyFit)p.ParticleScaling=capParticleScaling(p.ParticleScaling,widthCapFor(l,slot));
  }
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
function siteParent(c,layer,key,region,point,fallback,slot){
 const record=layer.individuals?.[key],manual=record?.surface;
 const surface=manual||slot?.surface,source=surface&&c.model.Geosets[surface.geoset];
 // Keep the same attachment frame throughout a drag, including when an
 // automatic site already uses a blended triangle or was frozen by Change emitter.
 const anchor=slot?.surface&&!manual?(slot.attachmentPoint??slot.point):record?.attachmentPoint;
 if(anchor)point=new Vector3(...anchor);
 if(!source)return regionParent(c,region,point,fallback);
 const weights=surfaceWeights(source,surface.vertices,surface.barycentric,manual);
 const kind=manual?'snap':'surface';
 const surfaceKey=kind+'/'+surface.geoset+'/'+surface.vertices.join(',')+'/'+surface.barycentric.join(',');
 return regionParent({...c,source,surfaceKey},{vertices:surface.vertices,weights,surface},point,kind+'-'+key);
}
function surfaceWeights(source,vertices,barycentric,manual){
 const weights=new Map();
 vertices.forEach((v,i)=>{
  if(!manual&&barycentric[i]<=0)return;
  vertexBoneWeights(source,v).forEach(([id,w])=>weights.set(id,(weights.get(id)||0)+w*barycentric[i]));
 });
 return [...weights];
}
const dominantWeight=weights=>weights.slice().sort((a,b)=>b[1]-a[1])[0]?.[0];
function regionParent(c,region,point,key){
 const parent=dominantWeight(region.weights)??c.parent;
 if(region.weights.length<2)return parent;
 const bone=nodeFor(c,'Bones','Bone','binding-'+key,'Skin attachment '+key,point,parent),samples=c.attachmentCache;
 // The same part, vertex, parent and point always sample to the same keys; reuse them from the caller's cache.
 const memo='keys|'+c.surfaceKey+'|'+region.vertices[0]+'|'+parent+'|'+point.toArray().join(',')+'|'+c.frame.length,known=samples.get(memo);
 if(known){bone.Translation={LineType:1,GlobalSeqId:null,Keys:known.map(([Frame,v])=>({Frame,Vector:vec(v)}))};return bone.ObjectId;}
 const keys=[],plain=[];
 for(const [sequence,clip] of c.model.Sequences.entries()){
  const value=frame=>{const key=sequence+':'+frame;let matrices=samples.get(key);if(!matrices){matrices=sampleNodeMatrices(c.model,frame,sequence,frame);samples.set(key,matrices);}const skin=geosetSkinMatrix(c.source,region.vertices[0],matrices),world=point.clone().applyMatrix4(skin);if(region.surface){const bind=new Vector3(),posed=new Vector3();region.surface.vertices.forEach((v,i)=>{const at=new Vector3().fromArray(c.source.Vertices,v*3),weight=region.surface.barycentric[i];bind.addScaledVector(at,weight);posed.addScaledVector(at.applyMatrix4(geosetSkinMatrix(c.source,v,matrices)),weight);});world.add(posed).sub(bind.applyMatrix4(skin));}const inverse=matrices.get(parent)?.clone().invert();if(inverse)world.applyMatrix4(inverse);return world.sub(point);};
  const result=new Map(),sample=t=>{if(!result.has(t))result.set(t,value(t));return result.get(t);};
  const split=(a,b)=>{const mid=Math.floor((a+b)/2);if(mid===a)return;const error=sample(mid).distanceTo(sample(a).clone().lerp(sample(b),(mid-a)/(b-a)));if(b-a>80||error>Math.max(.005,c.frame.length*.0003)){split(a,mid);split(mid,b);}else result.delete(mid);};
  const [a,b]=clip.Interval;sample(a);sample(b);split(a,b);
  for(const [Frame,v] of [...result].sort(([a],[b])=>a-b)){keys.push({Frame,Vector:vec(v.toArray())});plain.push([Frame,v.toArray()]);}
 }
 samples.set(memo,plain);
 bone.Translation={LineType:1,GlobalSeqId:null,Keys:keys};return bone.ObjectId;
}
// Emitter fields FX edits under More. A key absent from layer.native keeps the value the layer compiles to.
export const EMITTER_DEPTH=['Latitude','Variation','FilterMode','Flags','FrameFlags','TailLength','Rows','Columns','LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim','Squirt'];
const UV_RANGES=new Set(['LifeSpanUVAnim','DecayUVAnim','TailUVAnim','TailDecayUVAnim']);
/** A layer.native value as the emitter field it sets. */
function nativeValue(key,value,model,created){
 if(value?.Keys&&value._FxGlobalDuration>0){
  value=structuredClone(value);
  if(value.GlobalSeqId==null||model.GlobalSequences[value.GlobalSeqId]==null)value.GlobalSeqId=clockFor(model,value._FxGlobalDuration,created);
  delete value._FxGlobalDuration;
 }

 if(key==='Rotation')return emitterRotationTrack(model,structuredClone(value));
 return key==='SegmentColor'?value.map(vec):key==='Alpha'?Uint8Array.from(value):key==='ParticleScaling'?vec(value):UV_RANGES.has(key)?Uint32Array.from(value):structuredClone(value);
}
/** The values a fresh compile writes for EMITTER_DEPTH, so an edit made in EMTR can be told apart from them. */
export function emitterDepthDefaults(model,l){
 if(l.kind==='native'){
  const p=addParticles(emptyParticleModel(model.Version),model,{...l.nativeSpec},{duration:1000},{speed:l.speed||1,opacity:1,density:1,tint:[1,1,1]},10);
  return Object.fromEntries(EMITTER_DEPTH.map(key=>[key,ArrayBuffer.isView(p[key])?Array.from(p[key]):p[key]]));
 }
 const fly=l.kind==='flies',mote=l.kind==='motes',flame=l.kind==='flame',mist=l.kind==='mist',crackle=l.kind==='crackle',atlas=l.atlas||1;
 const first=fly&&!l.pictureOverride?9*16+7:0,end=fly?first:mist&&!l.pictureOverride?25:atlas*atlas-1,mid=fly?first:mist&&!l.pictureOverride?12:Math.floor(end*.4);
 return {Latitude:crackle?l.spread??55:flame?24:mist?48:34,Variation:crackle?(l.burstGap!=null?.55:.18):fly?0:.35,FilterMode:fly||l.kind==='drops'?0:1,Flags:4096|32768|(fly||mote||crackle?524288:0),FrameFlags:1,TailLength:0,
  Rows:fly&&!l.pictureOverride?12:atlas,Columns:fly&&!l.pictureOverride?16:atlas,LifeSpanUVAnim:[first,mid,1],DecayUVAnim:[Math.min(end,mid+1),end,1],TailUVAnim:[0,0,1],TailDecayUVAnim:[0,0,1],Squirt:false};
}
const sameDepth=(a,b)=>{
 if(typeof a==='boolean'||typeof b==='boolean')return !!a===!!b;
 const x=ArrayBuffer.isView(a)?Array.from(a):a,y=ArrayBuffer.isView(b)?Array.from(b):b;
 if(typeof x==='number'&&typeof y==='number')return Math.abs(x-y)<=1e-5*Math.max(1,Math.abs(y));
 if(Array.isArray(x)&&Array.isArray(y))return x.length===y.length&&x.every((v,i)=>sameDepth(v,y[i]));
 return JSON.stringify(x)===JSON.stringify(y);
};
/** EMTR edits of EMITTER_DEPTH on the layer's emitter, as layer.native keys (a key FX already stores is read by the caller). */
function emitterDepthEdits(model,l,node){
 if(l.impact)return {};
 const defaults=emitterDepthDefaults(model,l),edits={};
 for(const key of EMITTER_DEPTH)if(!(l.native&&key in l.native)&&node[key]!==undefined&&!sameDepth(node[key],defaults[key]))edits[key]=ArrayBuffer.isView(node[key])?Array.from(node[key]):structuredClone(node[key]);
 return edits;
}
// A part shares one layer's Amount among at most as many emission sites as a four-region weapon has (a sword with
// its handle bones), so every site keeps at least the density that looks right there. A body split into many skin
// regions otherwise gave each of its many emitters one particle every few seconds, which flashes.
const SHARED_REGIONS=4;
/** Sites per region when the part has more regions than that: count x 4 sites, given to regions by length (null: one set per region). */
function emissionShares(regions,count){
 if(regions.length<=SHARED_REGIONS)return null;
 const total=count*SHARED_REGIONS,lengths=regions.map(r=>r.frame.length),sum=lengths.reduce((a,b)=>a+b,0)||1;
 const exact=lengths.map(v=>total*v/sum),shares=exact.map(Math.floor);
 const order=exact.map((v,i)=>i).sort((a,b)=>exact[b]-shares[b]-(exact[a]-shares[a])||lengths[b]-lengths[a]||a-b);
 for(let k=0,left=total-shares.reduce((a,b)=>a+b,0);k<left;k++)shares[order[k]]++;
 return shares;
}
function particles(c,layer){
 const l=layer;
 const {model:m,id,ms,tag}=c,fly=l.kind==='flies',mote=l.kind==='motes';
 const count=fly?Math.max(1,Math.round(l.amount)):l.count;
 const ids=[];
 const regions=c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}];
 const shares=fly||l.burstGap!=null?null:emissionShares(regions,count);
 const layout=c.siteLayout||c.autoSites,active=c.activeSites;
 const planned=layout?layout.map((slot,index)=>({...slot,regionIndex:slot.region??0,region:regions[slot.region??0]||regions[0],i:index,regionCount:layout.length})):regions.flatMap((region,regionIndex)=>{
  const regionCount=fly?Math.ceil((regionIndex+1)*count/regions.length)-Math.ceil(regionIndex*count/regions.length):shares?shares[regionIndex]:count;
  return Array.from({length:regionCount},(_,i)=>({regionIndex,region,i,regionCount,key:'source'+regionIndex+'-'+i}));
 });
 const fireFit=(layer.fireFit||layer.airyFit)?.version===1?(layer.fireFit||layer.airyFit):null;
 // Keep the layer's emission budget, with slightly different steady rates to
 // break up identical birth intervals along a straight strip.
 const scatter=scatterWeights(layer,planned,active);
 const rateWeights=!scatter&&fireFit&&planned.some(slot=>slot.fireFit?.strip)?planned.map((slot,i)=>slot.fireFit?.strip?1+.06*(i%5-2):1):null;
 const rateScale=rateWeights&&rateWeights.reduce((sum,weight,i)=>sum+(!active||active.has(planned[i].key)?weight:0),0)/(active?.size||planned.length);
 let emitted=0;
 for(const [site,slot] of planned.entries()){
  const {regionIndex,region,i,regionCount,key}=slot,frame=region.frame,l=individualEmitterLayer(layer,key);
  // Shared sites sit evenly along their own region.
  const span=l.placement||l;
  const along=shares?(regionCount===1?0:frame.length*.8*((i+.5)/regionCount-.5)):count===1?0:-span.lower+(span.upper+span.lower)*(i+.20)/(count-.60);
  const rate=(active?l.amount/Math.max(1,active.size):layout?l.amount/planned.length:shares?l.amount/(count*SHARED_REGIONS):l.amount/(count*regions.length))*(scatter?.[site]??(rateScale?rateWeights[site]/rateScale:1));
  const wave=shares?site%count:i;
  const pos=slot.point?new Vector3(...slot.point):fly||mote?frame.center.clone():frame.surfaceAt(along,layer.surfaceSites?Math.max(.1,layer.size*.5):0,c.frame.center);
  c.sites.push(emitterSiteRecord(slot,pos,regionIndex,!!slot.ground));pos.copy(emitterSitePoint(c.frame,layer,key,pos));
  if(layer.individuals?.[key]?.deleted||active&&!active.has(key))continue;
  const ordinal=emitted++;
  let parent=slot.ground&&!layer.individuals?.[key]?.surface?null:siteParent(c,layer,key,region,pos,'particles-'+regionIndex+'-'+i,slot);
  if(fly||mote){
   if(!l.placement&&!slot.point&&!layer.individuals?.[key]?.position)pos.copy(frame.center).add(new Vector3(...l.offset));
   const orbit=nodeFor(c,'Bones','Bone','orbit'+regionIndex+'-'+i,l.label+' orbit '+(i+1),pos,parent);
   const r=fly?l.size:Math.max(frame.girth*.9,frame.length*.25),phase=i*2.39996,tilt=(i%3-1)*.38+.16;
   const wind=i%2?-1:1,steps=32,turns=1+i%3;
   const path=Array.from({length:steps+1},(_,k)=>{
    const a=2*Math.PI*(k%steps)/steps,b=a*turns*wind+phase,rr=r*(.84+.17*Math.sin(2*a+phase)+.08*Math.cos(5*a-phase));
    return [k/steps,[Math.cos(b)*rr,Math.sin(b)*rr*(.76+.12*Math.sin(phase)),Math.sin(b+tilt)*tilt*r+.16*r*Math.sin(3*a+phase)+.07*r*Math.cos(7*a-phase)]];
   });
   orbit.Translation=fly?{LineType:2,GlobalSeqId:id,Keys:FLY_PATHS[i%FLY_PATHS.length].map(k=>({Frame:Math.round(k[0]*ms),Vector:vec(k.slice(1,4).map(v=>v*r)),InTan:vec(k.slice(4,7).map(v=>v*r)),OutTan:vec(k.slice(7,10).map(v=>v*r))}))}:keys(id,ms,path);parent=orbit.ObjectId;
  }else if(l.kind==='drops'&&!l.surfaceSites&&!slot.point&&!layer.individuals?.[key]?.position)pos.z-=frame.girth*.35;
  const p=nodeFor(c,'ParticleEmitters2','ParticleEmitter2',key,l.label+' '+(i+1),pos,parent);
  const size=fly?l.spriteSize:l.size,atlas=l.atlas||1,flame=l.kind==='flame',mist=l.kind==='mist';
  const strip=fireFit&&slot.fireFit?.strip;
  const values=layer.individuals?.[key]?.values;
  const cap=widthCapFor(l,slot),edited=l.widthCapEdited||fireFit?.sizeEdited||values?.size!=null;
  const sprite=l.widthCap==null&&cap>0&&!edited?Math.min(size,cap):size;
  const loft=strip?Math.max(24,Math.min(64,(layer.surfaceFit?.footprint??size)*2.6)):0;
  const velocity=strip&&!fireFit.velocityEdited&&values?.velocity==null?loft:l.velocity;
  const gravity=strip&&!fireFit.gravityEdited&&values?.gravity==null?loft/.38:l.gravity;
  const colors=flame?[l.tint.map(v=>Math.min(1,strip?v*.88+.12:v*.37+.63)),l.tint,l.tint.map((v,j)=>v*[.98,.42,.08][j])]:[l.tint,l.tint,mist?l.tint:l.tint.map(v=>v*.75)];
  const current={...p},prior=individualEmitterLayer(c.prior,key);
  Object.assign(p,{Squirt:false,Flags:4096|32768|(fly||mote?524288:0),TextureID:texture(m,l.image,false,tag),FilterMode:fly||l.kind==='drops'?0:1,Rows:fly&&!l.pictureOverride?12:atlas,Columns:fly&&!l.pictureOverride?16:atlas,
   Speed:velocity,Variation:fly?0:.35,Latitude:flame?24:mist?48:34,Gravity:gravity,LifeSpan:l.lasts,
   Width:fly?0:size*.2,Length:fly?0:size*.25,
   EmissionRate:fly?1.3/l.lasts:l.steadyRate?rate:keys(id,ms,Array.from({length:9},(_,k)=>[k/8,rate*(.76+.24*Math.cos((k%8)*Math.PI/4+wave*1.7))])),
   Visibility:keys(id,ms,[[0,1],[1,1]]),FrameFlags:1,Time:fly?.5:.36,SegmentColor:colors.map(vec),
   ParticleScaling:vec(fly?[size,size,size]:flame?[sprite*.94,sprite,sprite*.23]:mist?[size*.45,size,size*1.38]:[size*.45,size,size*.12]),
   Alpha:Uint8Array.from((fly?[255,255,245]:mist?[0,70,0]:flame?(strip?[84,106,0]:[230,254,0]):[88,232,0]).map(a=>Math.round(a*l.strength)))});
  if(l.widthCap!=null&&!edited)p.ParticleScaling=capParticleScaling(p.ParticleScaling,cap);
  if(l.kind==='crackle'&&l.burstGap!=null){
   // Each site gets one turn, alternating limbs before advancing along the blade.
   const span=Math.max(60,Math.round(l.burstWindow*1000)),period=span+Math.max(100,Math.round(l.burstGap*1000));
   const cycle=period*(active?active.size:count*regions.length),clock=clockFor(m,cycle,c.createdClocks);
   const start=(active?ordinal:i*regions.length+regionIndex)*period+40;
   p.EmissionRate=keys(clock,cycle,[[0,0],[start/cycle,l.amount*1000/span],[(start+span)/cycle,0],[1,0]],0);
  }
  if(l.kind==='crackle'){
   // The Knight and Impaler use this additive, model-space sprite in Spell.
   p.Flags|=524288;p.Variation=l.burstGap!=null?.55:.18;p.Latitude=l.spread??55;p.Time=.43;
   p.SegmentColor=[vec([1,1,1]),vec(l.tint),vec(l.tint.map((v,j)=>v*[.8,.48,1][j]))];
   p.Alpha=Uint8Array.from([255,250,0],a=>Math.round(a*l.strength));p.ParticleScaling=vec([size*.48,size,size*1.18]);
  }
  const first=fly&&!l.pictureOverride?9*16+7:0,end=fly?first:mist&&!l.pictureOverride?25:atlas*atlas-1,mid=fly?first:mist&&!l.pictureOverride?12:Math.floor(end*.4);
  p.LifeSpanUVAnim=Uint32Array.from([first,mid,1]);p.DecayUVAnim=Uint32Array.from([Math.min(end,mid+1),end,1]);
  if(!c.recipeChanged&&fireFit&&prior?.fireFit?.version===1&&prior.image===l.image&&current.Visibility?.GlobalSeqId!=null)
   p.TextureID=current.TextureID; // Native-manager picture edits keep their model-local texture reference.
  if(!c.recipeChanged&&!fireFit&&prior?.kind===l.kind&&current.Visibility?.GlobalSeqId!=null){
   // A layer adjustment preserves independent native fields already edited in EMTR.
   const samePicture=prior.image===l.image;
   for(const field of ['Flags','FilterMode','FrameFlags','Time','Variation','TailLength','TailUVAnim','TailDecayUVAnim'])p[field]=current[field];
   if(samePicture)for(const field of ['TextureID','Rows','Columns','LifeSpanUVAnim','DecayUVAnim'])p[field]=current[field];
   if(prior.spread===l.spread)p.Latitude=current.Latitude;
   if(l.burstGap==null)p.Squirt=!!current.Squirt;
   for(const [option,fields] of Object.entries({size:['ParticleScaling','Width','Length'],lasts:['LifeSpan'],velocity:['Speed'],gravity:['Gravity'],strength:['Alpha'],tint:['SegmentColor']})){
    if(JSON.stringify(l[option])===JSON.stringify(prior[option])&&(option!=='size'||l.spriteSize===prior.spriteSize))for(const field of fields)p[field]=current[field];
   }
   if(l.siteCount===prior.siteCount&&l.amount===prior.amount&&l.burstGap===prior.burstGap&&l.burstWindow===prior.burstWindow&&c.sameClock&&l.lasts===prior.lasts)p.EmissionRate=current.EmissionRate;
  }
  applyRecipeAim(c,l,slot,p);
  for(const [key,value] of Object.entries(l.native||{}))p[key]=nativeValue(key,recipeNativeValue(l,key,value),m,c.createdClocks);
  ids.push(p.ObjectId);
 }
 return {id:ids[Math.floor(ids.length/2)],ids,family:'ParticleEmitters2'};
}
/** Orbit helpers for an Edge: a turn about the part, a tilt and a bob, on three clocks that never line up. */
function orbitChain(c,l,frame,point,parent,r){
 const m=c.model,axis=frame.axis.clone().normalize(),side=new Vector3().crossVectors(axis,Math.abs(axis.z)<.9?z:y).normalize(),normal=new Vector3().crossVectors(side,axis).normalize();
 const radius=Math.max(0,l.orbitRadius??frame.girth*1.5),turns=Math.max(1,Math.round(l.orbitTurns??1));
 const t1=Math.max(100,Math.round(c.ms/turns)),t2=Math.max(100,Math.round(t1*.739)),t3=Math.max(100,Math.round(t1*.479));
 const h1=nodeFor(c,'Bones','Bone','orbit'+r+'-1',l.label+' orbit 1',point,parent);h1.Flags=256;
 h1.Rotation=keys(clockFor(m,t1,c.createdClocks),t1,LINEAR_TURN.map((a,j)=>[j/(LINEAR_TURN.length-1),turn(axis,j===LINEAR_TURN.length-1?0:a)]));
 const p2=point.clone().addScaledVector(side,radius);
 const h2=nodeFor(c,'Bones','Bone','orbit'+r+'-2',l.label+' orbit 2',p2,h1.ObjectId);h2.Flags=256;
 h2.Rotation=keys(clockFor(m,t2,c.createdClocks),t2,[[0,0],[.25,35],[.5,0],[.75,-35],[1,0]].map(([t,a])=>[t,turn(side,a)]));
 const p3=p2.clone().addScaledVector(axis,radius*.4);
 const h3=nodeFor(c,'Bones','Bone','orbit'+r+'-3',l.label+' orbit 3',p3,h2.ObjectId);h3.Flags=256;
 h3.Translation=keys(clockFor(m,t3,c.createdClocks),t3,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,normal.clone().multiplyScalar(radius*.3*a).toArray()]));
 return {parent:h3.ObjectId,at:p3};
}
function edgeLayer(c,l){
 const {model:m,id,ms,tag}=c;
 const regions=c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}],ids=[];
 for(const [regionIndex,region] of regions.entries()){const frame=region.frame;
 const point=frame.center.clone().add(new Vector3(...l.offset));
 let parent=regionParent(c,region,point,'edge-'+regionIndex),at=point;
 // Orbit: the ribbon rides the end of a helper chain, each helper on its own clock, so it draws a wandering loop.
 if(l.orbit)({parent,at}=orbitChain(c,l,frame,point,parent,regionIndex));
 const p=nodeFor(c,'RibbonEmitters','RibbonEmitter','edge'+regionIndex,l.label,at,parent);
 // A small closed sway gives a stationary edge a width as the ribbon sheds its last vertices.
 const normal=new Vector3().crossVectors(frame.axis,Math.abs(frame.axis.z)<.9?z:y).normalize();
 if(l.orbit)delete p.Translation;
 else p.Translation=keys(id,ms,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,normal.clone().multiplyScalar(frame.girth*.18*a).toArray()]));
 const layer={FilterMode:l.filter??(l.orbit?3:4),Shading:17,TextureID:texture(m,l.image,false,tag),CoordId:0,TVertexAnimId:null,Alpha:1};
 Object.assign(p,{MaterialID:resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:[layer]}),Rotation:keys(id,ms,[[0,new Quaternion().setFromUnitVectors(y,frame.axis).toArray()]],0),
  HeightAbove:l.upper,HeightBelow:l.lower,Alpha:l.orbit||l.pulse==='steady'?l.strength:keys(id,ms,curves.flicker.map(([t,a])=>[t,a*l.strength])),Color:vec(l.tint),LifeSpan:l.lasts,EmissionRate:l.smoothness,Gravity:l.gravity,Visibility:keys(id,ms,[[0,1],[1,1]])});
 ids.push(p.ObjectId);
 }
 return {id:ids[0],ids,family:'RibbonEmitters'};
}
const turn=(axis,degrees)=>new Quaternion().setFromAxisAngle(axis,degrees*Math.PI/180).toArray();
// A deterministic pseudo-random sequence, so recompiling the same layer writes the same keys.
const shake=seed=>()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
/** Card layer: flat quads with one native texture, each on its own owned bone, in one owned geoset and material. */
function cardLayer(c,l){
 const {model:m,tag}=c,card=cardFields(l),size=Math.max(.1,l.size||1);
 // Motion runs on the layer's own clocks; Loop length replaces the look's loop for this layer only.
 const base=card.loop!=null?Math.max(100,Math.round(card.loop)):c.ms;
 const id=card.loop!=null?clockFor(m,base,c.createdClocks):c.id;
 const cells=card.rows*card.columns,flipbook=cells>1&&card.frameMs>0;
 const regions=card.facing==='ground'?[null]:c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}];
 const vertices=[],normals=[],uvs=[],faces=[],groups=[],vertexGroup=[],centres=[];
 let k=0;
 for(const [r,region] of regions.entries())for(let i=0;i<card.count;i++,k++){
  const f=region?.frame,along=!f||card.count===1?0:((i+.5)/card.count-.5)*f.length*.9;
  const point=region?f.at(along):new Vector3(0,0,1.5);point.add(new Vector3(...l.offset));
  const parent=region?regionParent(c,region,point,'card-'+r+'-'+i):null;
  const bone=nodeFor(c,'Bones','Bone','card'+r+'-'+i,l.label+' '+(k+1),point,parent);
  // Camera cards face +X on a billboarded bone; ground cards lie flat; part cards turn with the part.
  bone.Flags=256|(card.facing==='camera'?8:0);
  let side,up,normal;
  if(card.facing==='camera'){side=new Vector3(0,1,0);up=new Vector3(0,0,1);}
  else if(card.facing==='ground'){side=new Vector3(1,0,0);up=new Vector3(0,1,0);}
  else{up=f.axis.clone().normalize();side=new Vector3().crossVectors(up,Math.abs(up.z)<.9?z:y).normalize();}
  normal=new Vector3().crossVectors(side,up).normalize();
  const factor=CARD_CLOCK_FACTORS[k%CARD_CLOCK_FACTORS.length]*(1+Math.floor(k/CARD_CLOCK_FACTORS.length)*.071);
  // Size pulse: bone scale between the smallest and largest size; odd cards start large.
  if(card.sizeMin!==1||card.sizeMax!==1){
   const ms=Math.round(base*factor),[a,b]=k%2?[card.sizeMax,card.sizeMin]:[card.sizeMin,card.sizeMax];
   bone.Scaling=keys(clockFor(m,ms,c.createdClocks),ms,[[0,[a,a,a]],[.5,[b,b,b]],[1,[a,a,a]]],3);
  }else delete bone.Scaling;
  // Spin: one turn per clock, so a fraction of a turn per loop is a longer clock. Eased keeps the native flare's uneven speed.
  if(card.spin){
   const ms=Math.max(100,Math.round(base*factor/Math.abs(card.spin))),angles=card.spinEased?EASED_TURN:LINEAR_TURN,sign=Math.sign(card.spin);
   bone.Rotation=keys(clockFor(m,ms,c.createdClocks),ms,angles.map((a,j)=>[j/(angles.length-1),turn(normal,j===angles.length-1?0:a*sign)]));
  }else delete bone.Rotation;
  delete bone.Translation;
  let holder=bone;
  if(card.jitter>0){
   // Jitter: fast uneven turns on a child bone, on a clock that never lines up with its neighbours.
   holder=nodeFor(c,'Bones','Bone','jitter'+r+'-'+i,l.label+' '+(k+1)+' jitter',point,bone.ObjectId);holder.Flags=256;
   const ms=CARD_JITTER_MS[k%CARD_JITTER_MS.length],next=shake(k+7),times=[0,.23,.51,.74,1];
   holder.Rotation=keys(clockFor(m,ms,c.createdClocks),ms,times.map((t,j)=>[t,turn(normal,j===0||j===times.length-1?0:(next()*2-1)*card.jitter)]));
  }
  // The quad, bound to its bone; its picture is one atlas cell (neighbours start on different cells).
  const cell=((flipbook?card.cell+k*3:card.cell)%cells+cells)%cells,u0=(cell%card.columns)/card.columns,v0=Math.floor(cell/card.columns)/card.rows,du=1/card.columns,dv=1/card.rows;
  const first=vertices.length/3;
  for(const [s,t] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
   vertices.push(...point.clone().addScaledVector(side,s*size).addScaledVector(up,t*size).toArray());normals.push(...normal.toArray());vertexGroup.push(groups.length);
  }
  uvs.push(u0,v0+dv,u0+du,v0+dv,u0+du,v0,u0,v0);
  faces.push(first,first+1,first+2,first,first+2,first+3);
  groups.push([holder.ObjectId]);centres.push(point);
 }
 const tex=l.team?teamTexture(m,l.team,tag):texture(m,l.image,flipbook,tag);
 const shape=l.pulse==null||l.pulse==='steady'||COLOUR_RHYTHMS[l.pulse]?null:curves[l.pulse]||null,curveType=l.pulse==='soft'?3:1;
 const alphaFor=value=>shape?keys(id,base,shape.map(([t,a])=>[t,a*value]),curveType):value;
 const layer={TextureID:tex,CoordId:0,TVertexAnimId:null,FilterMode:card.filter,Shading:(card.unshaded?1:0)|(card.twoSided?16:0)|(card.unfogged?32:0),Alpha:alphaFor(1)};
 if(flipbook){
  // Flipbook: step through the atlas cells, one cell per frame time, holding each (no blending between cells).
  const ms=cells*Math.max(10,Math.round(card.frameMs));
  layer.TVertexAnimId=resource(m.TextureAnims,tag+'/flipbook',{Translation:keys(clockFor(m,ms,c.createdClocks),ms,[...Array.from({length:cells},(_,j)=>[j/cells,[(j%card.columns)/card.columns,Math.floor(j/card.columns)/card.rows,0]]),[1,[0,0,0]]],0)});
 }
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:strengthPasses([layer],card.strength,false,alphaFor)});
 const reach=size*Math.SQRT2*Math.max(1,card.sizeMax);
 const g={Vertices:Float32Array.from(vertices),Normals:Float32Array.from(normals),TVertices:[Float32Array.from(uvs)],Faces:Uint16Array.from(faces),VertexGroup:Uint8Array.from(vertexGroup),Groups:groups,TotalGroupsCount:groups.length,MaterialID:material,SelectionGroup:0,Unselectable:false,Anims:[]};
 if(m.Version>=900)g.LevelOfDetail=0;
 // Bounds hold a card at its largest size facing any way, and the part's own animated bounds.
 quadBounds(c,g,centres.map(p=>p.toArray()),reach);
 return {geoset:overlay(c,g,material,rhythmColour({...c,id,ms:base},l,l.tint),m.GeosetAnims.find(a=>a.GeosetId===c.index),0)};
}
/** Owned quad geoset bounds: every point grown by reach, joined with the part's own bounds in each sequence. */
function quadBounds(c,g,points,reach){
 const m=c.model;
 const reachOf=list=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of list)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]-reach);hi[a]=Math.max(hi[a],p[a]+reach);}return [lo,hi];};
 const [lo,hi]=reachOf(points);
 Object.assign(g,geosetBounds(Float32Array.from([...lo,...hi])));
 g.Anims=(m.Sequences||[]).map((_,s)=>{const own=c.source.Anims?.[s];
  // A sequence without usable bounds of its own (missing, or the empty ±3.4e38 box some files store) takes the cards' bounds.
  if(!own?.MinimumExtent||!own?.MaximumExtent||![0,1,2].every(k=>Math.abs(own.MinimumExtent[k])<1e7&&Math.abs(own.MaximumExtent[k])<1e7&&own.MinimumExtent[k]<=own.MaximumExtent[k]))return {MinimumExtent:vec(lo),MaximumExtent:vec(hi),BoundsRadius:g.BoundsRadius};const [a,b]=reachOf([Array.from(own.MinimumExtent),Array.from(own.MaximumExtent)]),min=a.map((v,i)=>Math.min(v,lo[i])),max=b.map((v,i)=>Math.max(v,hi[i]));return {MinimumExtent:vec(min),MaximumExtent:vec(max),BoundsRadius:geosetBounds(Float32Array.from([...min,...max])).BoundsRadius};});
}
// The five native paths as keys {t,v,i,o}, and their mean distance from their centre (the swarm radius they make at scale 1).
const FLY_KEYS=FLY_PATHS.map(path=>path.map(k=>({t:k[0],v:k.slice(1,4),i:k.slice(4,7),o:k.slice(7,10)})));
const FLY_PATH_RADIUS=FLY_KEYS.flat().reduce((sum,k)=>sum+Math.hypot(k.v[0],k.v[1]),0)/FLY_KEYS.flat().length;
/** A closed path started later: its keys rotated to start at the key nearest phase; the wrap key joins both tangents. */
function phasedPath(path,phase){
 const n=path.length-1,j=phase>0?path.slice(0,n).reduce((best,k,i)=>Math.abs(k.t-phase)<Math.abs(path[best].t-phase)?i:best,0):0;
 if(!j)return path;
 const start=path[j].t,keysOut=[];
 for(let i=0;i<n;i++){const k=path[(j+i)%n];keysOut.push({...k,t:((k.t-start)%1+1)%1,i:k===path[0]?path[n].i:k.i});}
 keysOut.push({...path[j],t:1});
 return keysOut;
}
/**
 * Fly swarm (native Flies.mdx technique): one owned quad per fly in one owned geoset, each quad entirely on its own
 * billboarded bone riding a closed native path, under one owned swarm bone that follows the part without tilting.
 */
function flySwarm(c,l){
 const {model:m,tag}=c,count=Math.round(Math.max(FLY_BOUNDS.amount[0],Math.min(FLY_BOUNDS.amount[1],l.amount||5)));
 const radius=Math.max(1,l.size||1),width=Math.max(.5,l.spriteSize||10),speed=Math.max(FLY_BOUNDS.speed[0],Math.min(FLY_BOUNDS.speed[1],l.speed??1));
 const tall=c.frame.unitHeight??c.frame.length,scale=radius/FLY_PATH_RADIUS,spread=radius/88*.45;
 const centre=layerEmitterPoint(c.frame,l,c.frame.center);
 const swarm=nodeFor(c,'Bones','Bone','swarm',l.label,centre,c.parent);
 swarm.Flags=256|2;for(const key of ['Translation','Rotation','Scaling'])delete swarm[key];
 // The measured corner layout and picture area of the native fly pictures; another picture shows whole.
 const picture=flyPicture(l.image,l.pictureOverride);
 const vertices=[],normals=[],uvs=[],faces=[],groups=[],vertexGroup=[],points=[];
 let widest=0;
 for(let k=0;k<count;k++){
  const s=Math.floor(k/5),p=k%5,set=FLY_SETS[s%FLY_SETS.length],yaw=set.yaw*Math.PI/180,cos=Math.cos(yaw),sin=Math.sin(yaw);
  // Path keys turned by the set's yaw, widened by its scale and flattened to three quarters in height.
  const xy=scale*set.width,turned=a=>[(a[0]*cos-a[1]*sin)*xy,(a[0]*sin+a[1]*cos)*xy,a[2]*xy*.75];
  const at=FLY_SCATTER[p],pivot=centre.clone().add(new Vector3((at[0]*cos-at[1]*sin)*spread,(at[0]*sin+at[1]*cos)*spread,at[2]*spread+set.height*tall));
  const fly=nodeFor(c,'Bones','Bone','fly'+k,l.label+' '+(k+1),pivot,swarm.ObjectId);
  fly.Flags=256|8;delete fly.Rotation;delete fly.Scaling;
  const ms=flyClock(radius,s,speed),clock=clockFor(m,ms,c.createdClocks);
  fly.Translation={LineType:2,GlobalSeqId:clock,Keys:phasedPath(FLY_KEYS[p],set.phase).map(key=>({Frame:Math.round(key.t*ms),Vector:vec(turned(key.v)),InTan:vec(turned(key.i)),OutTan:vec(turned(key.o))}))};
  for(const key of fly.Translation.Keys)points.push(pivot.clone().add(new Vector3(...key.Vector)).toArray());
  const half=width*FLY_SIZES[p]/2,first=vertices.length/3;widest=Math.max(widest,half);
  for(const [j,corner] of picture.corners.entries()){
   vertices.push(...corner.map((v,a)=>pivot.getComponent(a)+v*half));normals.push(...picture.normal);uvs.push(...picture.uv[j]);vertexGroup.push(groups.length);
  }
  faces.push(first,first+1,first+2,first+3,first+2,first+1);
  groups.push([fly.ObjectId]);
 }
 // One layer like the native flies: alpha-keyed (Transparent), two-sided and lit by the map.
 const layer={TextureID:texture(m,l.image,false,tag),CoordId:0,TVertexAnimId:null,FilterMode:1,Shading:16,Alpha:Math.max(0,Math.min(1,l.strength??1))};
 if(l.riseOnDeath){
  const motion=[],visibility=[];
  // A local Z translation is turned downward by a falling parent in native playback.
  // Keep the centre following that parent, but write its rise in model space.
  const parent=swarm.Parent;swarm.Parent=null;
  for(const [sequence,clip] of m.Sequences.entries()){
   const [start,end]=clip.Interval,death=/^death\b/i.test(clip.Name),time=Math.min(1,(end-start)/2170);
   visibility.push([start,layer.Alpha],[end,death?0:layer.Alpha]);
   if(death)visibility.push([start+Math.round(1900*time),0]);
   const first=start+Math.round(1000*time),last=start+Math.round(2170*time);
   const value=frame=>{const key=sequence+':'+frame;let matrices=c.attachmentCache.get(key);if(!matrices){matrices=sampleNodeMatrices(m,frame,sequence,frame);c.attachmentCache.set(key,matrices);}const at=centre.clone(),matrix=matrices.get(parent);if(matrix)at.applyMatrix4(matrix);at.sub(centre);if(death)at.z+=tall*(frame<=first?.6*(frame-start)/Math.max(1,first-start):.6+1.9*Math.min(1,(frame-first)/Math.max(1,last-first)));return at;};
   const samples=new Map(),sample=t=>{if(!samples.has(t))samples.set(t,value(t));return samples.get(t);};
   const split=(a,b)=>{const mid=Math.floor((a+b)/2);if(mid===a)return;const error=sample(mid).distanceTo(sample(a).clone().lerp(sample(b),(mid-a)/(b-a)));if(b-a>80||error>Math.max(.005,tall*.0003)){split(a,mid);split(mid,b);}else samples.delete(mid);};
   const stops=[...new Set(death?[start,first,last,end]:[start,end])].sort((a,b)=>a-b);
   for(const stop of stops)sample(stop);for(let i=1;i<stops.length;i++)split(stops[i-1],stops[i]);
   for(const [frame,at] of samples)motion.push([frame,at.toArray()]);
  }
  const ordered=pairs=>[...new Map(pairs)].sort((a,b)=>a[0]-b[0]);
  swarm.Translation=keys(null,1,ordered(motion));
  layer.Alpha=keys(null,1,ordered(visibility),0);
  points.push(...points.map(p=>[p[0],p[1],p[2]+tall*2.5]));
 }
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:[layer]});
 const g={Vertices:Float32Array.from(vertices),Normals:Float32Array.from(normals),TVertices:[Float32Array.from(uvs)],Faces:Uint16Array.from(faces),VertexGroup:Uint8Array.from(vertexGroup),Groups:groups,TotalGroupsCount:groups.length,MaterialID:material,SelectionGroup:0,Unselectable:false,Anims:[]};
 if(m.Version>=900)g.LevelOfDetail=0;
 // Hermite paths swing a little past their keys.
 quadBounds(c,g,points,widest*Math.SQRT2+radius*.15);
 return {geoset:overlay(c,g,material,l.tint,m.GeosetAnims.find(a=>a.GeosetId===c.index),0)};
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
 // Also an id an earlier apply freed (an empty slot in the node index), once nothing after it is left.
 const nodeSlots=m.Nodes.length,emptySlot=i=>i<nodeSlots&&!(i in m.Nodes);
 while(m.PivotPoints.length&&(freed.has(m.PivotPoints.length-1)||freed.size&&emptySlot(m.PivotPoints.length-1))){
  const last=m.PivotPoints.length-1;m.PivotPoints.pop();
  for(const b of m.BindPoses||[])if(b.Matrices.length===last+1+(m.Cameras?.length||0))b.Matrices.splice(last,1);
 }
 // Freed ids at the end leave no empty slots behind in the node index.
 if(freed.size)while(m.Nodes.length&&!(m.Nodes.length-1 in m.Nodes))m.Nodes.pop();
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
const INDIVIDUAL_NATIVE_FIELDS=[...EMITTER_DEPTH,'Time','LifeSpan','Width','Length','ParticleScaling','SegmentColor','Alpha','Speed','Gravity','EmissionRate','Rotation'];
const plainEmitterValue=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v));
const sameEmitterValue=(a,b)=>a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>sameEmitterValue(a[k],b[k])):sameDepth(a,b);
/** Read quick-control values from their native managers. More complex authored tracks stay intact. */
export function readAnimationStack(model,index){
 const saved=model.Geosets[index]?._FxStack;
 if(!saved||typeof saved.look!=='string')return null;
 const draft=structuredClone(saved);
 // Refresh only explicit portable gesture metadata after an authored clock edit.
 const refreshClock=value=>{if(!value||typeof value!=='object')return;if(value.Keys&&value._FxGlobalDuration>0&&model.GlobalSequences[value.GlobalSeqId]!=null)value._FxGlobalDuration=model.GlobalSequences[value.GlobalSeqId];for(const child of Object.values(value))refreshClock(child);};
 for(const layer of draft.layers){refreshClock(layer.native);refreshClock(layer.individuals);}
 for(const l of draft.layers){
  const prefix=draft.owner+'/'+l.id+'/';
  if(l.type==='Particles'&&!l.swarm&&(l.individuals||hasRecipeEmitterDefaults(l)&&l.emitterState)){
   // Native-manager edits come back to their own site, never to sibling defaults.
   for(const [key,baseline] of Object.entries(l.emitterState||{})){
    const node=model.ParticleEmitters2.find(n=>n._FxTag===prefix+key);if(l.individuals?.[key]?.deleted||!node)continue;
    for(const field of INDIVIDUAL_NATIVE_FIELDS)if(node[field]!==undefined&&!sameEmitterValue(plainEmitterValue(node[field]),baseline[field])){
     const individuals=l.individuals||(l.individuals={});
     const record=individuals[key]||(individuals[key]={});
     if(record.groupFields)record.groupFields=record.groupFields.filter(key=>key!==field);
     record.values={...record.values,native:{...record.values?.native,[field]:plainEmitterValue(node[field])}};
    }
   }
   continue;
  }
  const emitters=[...model.ParticleEmitters2,...model.RibbonEmitters].filter(n=>n._FxTag?.startsWith(prefix));
  const node=emitters[Math.floor(emitters.length/2)];
  const read=(key,v)=>{if(Number.isFinite(v)&&Math.abs(v-l[key])>1e-4*Math.max(1,Math.abs(v)))l[key]=v;};
  if(!node){
   const index=model.Geosets.findIndex(g=>g._FxTag===prefix+'shape');
   const layer=model.Materials[model.Geosets[index]?.MaterialID]?.Layers[0];if(!layer)continue;
   const peak=typeof layer.Alpha==='number'?layer.Alpha:layer.Alpha?.Keys.reduce((n,k)=>Math.max(n,k.Vector[0]),0);
   read('strength',(l.type==='Glow'||l.glyphs)?model.Materials[model.Geosets[index]?.MaterialID].Layers.reduce((n,v)=>n+(typeof v.Alpha==='number'?v.Alpha:v.Alpha?.Keys.reduce((a,k)=>Math.max(a,k.Vector[0]),0)||0),0):peak/(l.unitAlphaPeak||1));
   const rgb=model.GeosetAnims.find(a=>a.GeosetId===index)?.Color;
   if(rgb?.length===3){
    const colour=Array.from(rgb,v=>Math.max(0,Math.min(1,l.steel?(v-.22)/.31:l.crust?(v-.18)/.22:v)));
    if(colour.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=colour;
   }
   const track=model.TextureAnims[layer.TVertexAnimId]?.Translation,travel=track?.Keys;
   if(l.type==='Moving skin'&&!l.atlasRect&&travel?.length===2){
    const axis=l.axis==='v'?1:0,offset=travel[1].Vector[axis]-travel[0].Vector[axis];
    // Whole passes on the travel clock; a clock longer than the layer's loop is a fractional Speed.
    const loop=l.loop??draft.loop,clock=model.GlobalSequences[track.GlobalSeqId],speed=clock>0?offset*loop/clock:offset;
    // A clock rounded to whole milliseconds keeps the saved fraction.
    if(Number.isInteger(offset)&&offset>=1&&offset<=8&&Math.abs(speed-l.speed)>speed/Math.max(1,clock)+1e-6)read('speed',Math.round(speed*100)/100);
   }
   continue;
  }
  if(l.type==='Edge'){
   const r=ribbonQuickValues(node);for(const [k,v] of Object.entries({upper:r.above,lower:r.below,strength:r.intensity,lasts:r.lasts,gravity:r.gravity,smoothness:r.amount}))read(k,v);
   if(r.color.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=r.color;
  }else{
   if(l.opacityBase&&l.opacityBase.some((a,i)=>Math.round(a*l.particleStrength)!==node.Alpha[i])){
    // A subsequent EMTR edit defines the new three-stage opacity.
    delete l.opacityBase;delete l.particleStrength;
   }
   if(l.kind==='native'){if(l.native)for(const key of Object.keys(l.native)){const value=node[key];l.native[key]=key==='SegmentColor'?value.map(v=>Array.from(v)):ArrayBuffer.isView(value)?Array.from(value):structuredClone(value);}
    const edits=emitterDepthEdits(model,l,node);if(Object.keys(edits).length)l.native={...l.native,...edits};continue;}
   read('lasts',node.LifeSpan);read('gravity',typeof node.Gravity==='number'?node.Gravity:null);read('velocity',typeof node.Speed==='number'?node.Speed:null);
   read(l.kind==='flies'?'spriteSize':'size',node.ParticleScaling?.[1]);
   if(l.kind!=='flies'&&l.kind!=='native'&&l.burstGap==null){
    const rate=typeof node.EmissionRate==='number'?node.EmissionRate:node.EmissionRate?.Keys?.[0]?.Vector[0];
    const phase=(Math.floor(emitters.length/2)%l.count)*1.7,weight=typeof node.EmissionRate==='number'?1:.76+.24*Math.cos(phase);
    if(Number.isFinite(rate))read('amount',rate*emitters.length/weight);
   }
   if(l.native)for(const key of Object.keys(l.native)){const v=node[key];l.native[key]=key==='SegmentColor'?v.map(a=>Array.from(a)):ArrayBuffer.isView(v)?Array.from(v):structuredClone(v);}
   // Spread, blend, frames and the other fields under More: an edit made in EMTR comes back as a layer value.
   const edits=emitterDepthEdits(model,l,node);if(Object.keys(edits).length)l.native={...l.native,...edits};
   const rgb=Array.from(node.SegmentColor?.[1]||[]);
   if(rgb.length===3&&rgb.some((v,i)=>Math.abs(v-l.tint[i])>.001))l.tint=rgb;
  }
 }
 return draft;
}
function sameLayerForRetention(prior,layer){
 if(!prior)return false;
 if(!layer.individuals)return JSON.stringify(prior)===JSON.stringify(layer);
 if(prior.individuals||layer.type!=='Particles'||layer.swarm)return false;
 // Open in EMTR adds one empty record to start tracking this layer's native
 // values. Keep the existing nodes so registering that baseline cannot edit them.
 const {individuals,...shared}=layer;
 const records=Object.values(individuals);
 return records.length===1&&records[0]&&Object.keys(records[0]).length===0&&JSON.stringify(prior)===JSON.stringify(shared);
}
/**
 * Builds the stack into model. attachments (optional) is a Map the caller keeps for one model revision:
 * skin-attachment samples of the model's own bones are reused from it instead of recomputed, with the same result.
 */
export function compileAnimation(model,index,draft,{rune,attachments}={}){
 const source=model.Geosets[index];if(!source)throw Error('Select a part first.');
 // Several selected geosets are fitted as one surface; each original stays as it is.
 const members=[...new Set(draft.group||[])].filter(i=>i!==index&&model.Geosets[i]&&!model.Geosets[i]._FxTag);
 if(members.length)draft={...draft,group:members,asOverlay:true};
 else if(draft.group){draft={...draft};delete draft.group;}
 let surface=source;
 if(members.length){surface=structuredClone(source);delete surface._FxStack;for(const i of members)appendGeosetGeometry(surface,model.Geosets[i]);}
 const before=readAnimationStack(model,index),owner=draft.owner;
 const sameGroup=JSON.stringify(before?.group||[])===JSON.stringify(draft.group||[]);
 const base=before&&source.MaterialID!==before.baseMaterial&&model.Materials[source.MaterialID]?._FxTag!==before.owner+'/underlay'?source.MaterialID:before?.baseMaterial??source.MaterialID;
 const strikeGeo=draft.impact?model.Geosets[draft.contact?.geoset]:null;
 if(draft.impact&&(!strikeGeo||strikeGeo._FxTag||!(draft.contact.vertex>=0&&draft.contact.vertex*3<strikeGeo.Vertices.length)))draft={...draft,...impactDefaults(model,index,draft.sequence,draft.hit)};
 // Samples read only the skin bones of this part, which a compile never changes; a caller's cache is keyed by part too.
 const attachmentCache=attachments||new Map(),surfaceKey=index+'/'+members.join(','),originalClockCount=model.GlobalSequences.length;
 const frame=partFrame(surface),created=[...(before?.createdClockIds||[])],used=new Set();
 // The unit's height sizes new flies (graph.frame carries it to the layer builder).
 if(frame)frame.unitHeight=unitHeight(model);
 const ms=Math.max(200,Math.round(draft.loop)),id=draft.layers.length&&!draft.impact?clockFor(model,ms,created):-1;
 const state=JSON.parse(JSON.stringify(draft));state.baseMaterial=base;state.createdClockIds=created;state.createdClocks=[];
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
 const results={},sites={},siteRateScales={};
 for(const l of draft.layers){
  if(l.enabled===false)continue;
  const prior=before?.look===draft.look?before.layers.find(item=>item.id===l.id):null;
  const recipeChanged=prior&&l.recipeOwner===draft.look&&before.variation!==draft.variation;
  // A surface layer, Edge or native emitter with its own Loop length runs on its own owned clock.
  const own=l.loop!=null&&!draft.impact&&(surfaceIngredient(l)||l.type==='Edge'||!!l.nativeSpec)?Math.max(100,Math.round(l.loop)):null;
  const tag=owner+'/'+l.id,context={sites:sites[l.id]=[],model,source:surface,index,base,frame,parent:effectAnchor(model,surface),id:own?clockFor(model,own,created):id,ms:own??ms,tag,used,rune,prior,recipeChanged,state,createdClocks:created,stack:draft,attachmentCache,surfaceKey,sameGroup,sameClock:before?.loop===ms&&prior?.loop===l.loop};
  context.autoSites=defaultSurfaceSites(context,l);
  context.siteLayout=completeEmitterSiteLayout(context,l);
  context.activeSites=activeEmitterSites(l,context.siteLayout||context.autoSites||[]);
  const saved=state.layers.find(item=>item.id===l.id);
  if(context.siteLayout!==l.siteLayout)saved.siteLayout=context.siteLayout;
  if(Array.isArray(l.activeSiteKeys)&&context.activeSites)saved.activeSiteKeys=[...context.activeSites];
  if(l.nativeSpec&&!l.impact)siteRateScales[l.id]=nativeEmitterBudget(context,l);
  // Retain edits made in the normal material, node or emitter managers for untouched layers.
  if(!recipeChanged&&!l.placement&&l.siteCount==null&&before?.look===draft.look&&sameGroup&&(!draft.impact||JSON.stringify(before?.contact)===JSON.stringify(draft.contact))&&ms===before?.loop&&before?.sequence===draft.sequence&&before?.hit===draft.hit&&sameLayerForRetention(prior,l)){
   for(const item of [...model.Geosets,...model.Nodes.filter(Boolean)])if(item._FxTag?.startsWith(tag+'/'))used.add(item._FxTag);
   const layout=context.siteLayout||context.autoSites;
   if(layout)context.sites.push(...layout);
  }else if(l.stamp)groundSeal(context,l);
  else if(l.nativeSurface)nativeSurface(context,l);
  else if(l.nativeSpec)nativeParticles(context,l);
  else if(l.type==='Particles'&&l.swarm)flySwarm(context,l);
  else if(l.type==='Particles')particles(context,l);
  else if(l.type==='Edge')edgeLayer(context,l);
  else if(l.type==='Rune')runeLayer(context,l);
  else if(l.type==='Card')cardLayer(context,l);
  else skinLayer(context,l);
  if(l.individuals&&sites[l.id].length){
   const keys=new Set(sites[l.id].map(site=>site.key));
   saved.individuals=Object.fromEntries(Object.entries(l.individuals).filter(([key])=>keys.has(key)));
  }
 }
 for(let i=originalClockCount;i<model.GlobalSequences.length;i++)if(!created.includes(i))created.push(i);
 if(!draft.layers.length)delete source._FxStack;
 sweep(model,owner,used);
 const clocks=new Set();visitTracks(model,t=>clocks.add(t.GlobalSeqId),{skip:['Nodes','_FxStack'],event:n=>clocks.add(n.GlobalSeqId)});
 // Removing an owned clock must not rewrite the model's authored bounds (the sequence editor recalculates them).
 const BOUNDS=['MinimumExtent','MaximumExtent','BoundsRadius'],keepBounds=item=>item&&Object.fromEntries(BOUNDS.filter(key=>key in item).map(key=>[key,item[key]]));
 const authoredBounds=[keepBounds(model.Info),...model.Geosets.map(keepBounds)];
 const restoreBounds=()=>{for(const [item,saved] of [[model.Info,authoredBounds[0]],...model.Geosets.map((g,i)=>[g,authoredBounds[i+1]])])if(item&&saved){for(const key of BOUNDS)if(key in saved)item[key]=saved[key];else delete item[key];}};
 let clockRemoved=false;
 for(const i of [...new Set(created)].sort((a,b)=>b-a))if(model.GlobalSequences[i]!=null&&!clocks.has(i)){
  clockRemoved=true;
  deleteGlobalSequence(model,i);
  for(const g of model.Geosets)if(g._FxStack?.createdClockIds)g._FxStack.createdClockIds=g._FxStack.createdClockIds.filter(id=>id!==i).map(id=>id>i?id-1:id);
  for(const k of [...clocks])if(k>i){clocks.delete(k);clocks.add(k-1);}
 }
 // Limited to stacks made with per-layer editing (a Card, an orbit, or any field it added) so stacks saved
 // before it compile exactly as they did; and to removing the whole stack, which leaves the bounds as they were.
 if(clockRemoved&&(!draft.layers.length||[...draft.layers,...(before?.layers||[])].some(l=>l.type==='Card'||l.swarm||l.orbit||EDITOR_FIELDS.some(key=>key in l))))restoreBounds();
 for(const g of model.Geosets)if(g._FxStack?.createdClockIds)g._FxStack.createdClocks=[...new Set(g._FxStack.createdClockIds.map(i=>model.GlobalSequences[i]).filter(Number.isFinite))];
 for(const l of draft.layers){
  const prefix=owner+'/'+l.id+'/',nodes=model.Nodes.filter(n=>n?._FxTag?.startsWith(prefix)),emitters=nodes.filter(n=>model.ParticleEmitters2.includes(n)||model.RibbonEmitters.includes(n));
  const saved=state.layers.find(item=>item.id===l.id);
  if(saved.type==='Particles'&&!saved.swarm&&(saved.individuals||hasRecipeEmitterDefaults(saved))){
   const live=emitters.map(n=>[n._FxTag.slice(prefix.length),Object.fromEntries(INDIVIDUAL_NATIVE_FIELDS.filter(key=>n[key]!==undefined).map(key=>[key,plainEmitterValue(n[key])]))]);
   const slots=new Set(saved.siteLayout?.map(site=>site.key));
   const retained=saved.siteCount!=null?Object.entries(saved.emitterState||{}).filter(([key])=>slots.has(key)):[];
   saved.emitterState=Object.fromEntries([...retained,...live]);
  }
  results[l.id]={...(siteRateScales[l.id]!=null?{siteRateScale:siteRateScales[l.id]}:{}),siteIds:Object.fromEntries(emitters.map(n=>[n._FxTag.slice(prefix.length),n.ObjectId])),sites:sites[l.id]?.length?sites[l.id]:emitters.map(n=>({key:n._FxTag.slice(prefix.length),point:Array.from(n.PivotPoint,(v,i)=>v-l.offset[i]),region:l.nativeSpec&&(l.ground||l.nativeSpec.flat)?frame.regions.indexOf(frame.regions.reduce((a,b)=>b.frame.length>a.frame.length?b:a)):Number(n._FxTag.slice(prefix.length).match(/^source(\d+)/)?.[1]||0),ground:!!l.ground})),id:(emitters[Math.floor(emitters.length/2)]||nodes.find(n=>n._FxTag===prefix+'card0-0'||n._FxTag===prefix+'swarm')||nodes[0])?.ObjectId,ids:emitters.map(n=>n.ObjectId),geoset:model.Geosets.findIndex(g=>g._FxTag===prefix+'shape')};
 }
 return {geoset:model.Geosets.indexOf(source),layers:results,frame};
}
