import {Box3,Matrix4,Quaternion,Triangle,Vector3} from 'three';
import {tattooPieces} from './fx-tattoo.js';
import {layerEmitterPoint,individualEmitterLayer,emitterSitePoint,activeEmitterSites,emitterRotationTrack} from './fx-emitter-placement.js';
import {analyseEmitterSurface,suggestEmitterSites,suggestAdditionalEmitterSites,suggestTipEmitterSites,suggestHeadEmitterSites,suggestBladeEmitterSites,suggestMassEmitterSites,crossSection,surfaceFitInputs,SURFACE_FIT_VERSION} from './fx-emitter-surface.js';
import {appendGeosetGeometry,createNode,removeGeosets,updateCounts,geosetBounds} from './editor-document.js';
import {cardFields,CARD_CLOCK_FACTORS,CARD_JITTER_MS,EASED_TURN,LINEAR_TURN,FLY_SETS,FLY_SIZES,FLY_SCATTER,FLY_BOUNDS,flyClock,flyPicture,squarePicture} from './fx-cards.js';
import {unitHeight} from './fx-layer-basis.js';
import {applySurfaceEffect,defaultEffectOptions,effectAnchor} from './surface-effects.js';
import {indexedSurfaceIslands} from './geoset-operations.js';
import {streakCoordinates} from './visual-effect-composition.js';
import {partFrame,createsOverlay,surfaceIngredient,layerMoves,secondTint,findLook,layerIngredient,makeLayer,currentVariation} from './global-animation-looks.js';
import {stackForPart} from './fx-own-looks.js';
import {visitTextureReferences} from './texture-references.js';
import {ribbonQuickValues} from './ribbon-quick.js';
import {visitTracks,geosetSkinMatrix,geosetVertexBones,nodeIndex,sampleSomeNodeMatrices} from './animation.js';
import {emptyParticleModel} from './particle-recipes.js';
import {createResourceImporter} from './model-import.js';
import {addParticles} from './visual-effect-composition.js';
import {particleBurstTrack} from './particle-sweep.js';
import {deleteGlobalSequence} from './sequence-editor.js';
import {gamePathKey,effectPicturePath} from './game-path.js';
import {attackContact} from './fx-attack-contact.js';
import {vertexBoneWeights} from './part-bones.js';
import {nameRegion} from './rig-names.js';
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
// wrap (fresh recipes, teamTile): a team picture that travels over the surface needs a repeating texture entry.
function teamTexture(m,team,tag,wrap=false){
 const existing=m.Textures.findIndex(t=>t.ReplaceableId===team&&(!wrap||(t.Flags&3)===3));
 return existing<0?m.Textures.push({Image:'',Flags:wrap?3:0,ReplaceableId:team,_FxTag:tag})-1:existing;
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
function overlay(c,geometry,material,colour,ownAnimation,inflate,closed){
 const m=c.model,tag=c.tag+'/shape',copy=structuredClone(geometry);delete copy._FxStack;
 copy.MaterialID=material;
 // Lift: a shell pushed out along the vertex normals, like native glow shells.
 if(inflate>0&&copy.Normals?.length===copy.Vertices.length){
  let normals=copy.Normals;
  if(closed){
   // closedLift (a look's own shells): vertices at one place move together along their shared normal, so the shell of
   // a hard-edged part (a blade, a crystal) stays in one piece instead of opening at every edge.
   const place=i=>Math.round(copy.Vertices[i]*1000)+','+Math.round(copy.Vertices[i+1]*1000)+','+Math.round(copy.Vertices[i+2]*1000),sums=new Map();
   for(let i=0;i<normals.length;i+=3){
    const key=place(i),d=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
    if(!sums.has(key))sums.set(key,[0,0,0]);
    const sum=sums.get(key);for(let a=0;a<3;a++)sum[a]+=normals[i+a]/d;
   }
   normals=Float32Array.from(normals);
   for(let i=0;i<normals.length;i+=3){const sum=sums.get(place(i));if(Math.hypot(sum[0],sum[1],sum[2])>1e-3)normals.set(sum,i);}
  }
  for(let i=0;i<copy.Vertices.length;i+=3){
   const x=normals[i],y=normals[i+1],z=normals[i+2],d=Math.hypot(x,y,z)||1;
   copy.Vertices[i]+=x/d*inflate;copy.Vertices[i+1]+=y/d*inflate;copy.Vertices[i+2]+=z/d*inflate;
  }
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
 let tex=own?structuredClone(original.TextureID):l.team?teamTexture(m,l.team,tag,!!l.teamTile&&!rect):texture(m,l.image,!rect,tag);
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
 const index=overlay(c,g,material,rhythmColour(c,l,colour),m.GeosetAnims.find(a=>a.GeosetId===c.index),l.inflate,l.closedLift);
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
 return {geoset:overlay(c,temp.Geosets[0],material,rhythmColour(c,l,l.tint),m.GeosetAnims.find(a=>a.GeosetId===c.index),l.inflate,l.closedLift)};
}
export function impactDefaults(model,_index,sequence,hit){
 const seq=/^attack\b/i.test(model.Sequences[sequence]?.Name||'')?sequence:model.Sequences.findIndex(s=>/^attack\b/i.test(s.Name));
 return seq<0?{sequence:-1,hit:0,contact:null}:attackContact(model,seq,hit);
}
/** Freeze the geometry offer by recipe inputs and selected surface for this model revision. */
const usesSiteGeometry=layer=>layer.widthCap!=null||layer.aim!=null;
function defaultSurfaceSites(c,layer){
 if(layer.ride)return rideSites(c,layer);
 if(layer.gather==='head'&&!layer.siteLayout)return headEmitterSites(c);
 if(strikes(layer)&&!layer.siteLayout)return strikeEmitterSites(c,layer);
 if(layer.gather==='tip'&&!layer.siteLayout)return tipEmitterSites(c);
 if(layer.gather==='orb'&&!layer.siteLayout)return orbSites(c);
 if(layer.gather==='spots'&&!layer.siteLayout)return spotSites(c,layer);
 if(layer.gather==='mouth'&&!layer.siteLayout)return mouthEmitterSites(c);
 if(layer.birthRegion&&!layer.siteLayout)return layer.cover?coverSites(c,layer):birthRegionSites(c,layer);
 const fit=layer.surfaceFit;
 if(layer.siteLayout||fit?.version!==SURFACE_FIT_VERSION||!Number.isFinite(fit.footprint)||!Number.isFinite(fit.liveParticles))return null;
 const {attachmentCache:cache,surfaceKey,frame}=c;
 const fireFit=(layer.fireFit||layer.airyFit)?.version===1;
 const offerKey='emitter-surface|'+surfaceKey+'|'+JSON.stringify([fit,fireFit,usesSiteGeometry(layer)]);
 if(cache.has(offerKey))return cache.get(offerKey);
 const samples=suggestEmitterSites(emitterSurface(c),fit,frame.unitHeight);
 // Separate dots are never the default: sites that cannot reach each other cover the part instead.
 if(layer.coverFit&&layer.nativeSpec&&separateSites(c,layer,samples)){
  const covered=coverSites(c,{...layer,cover:'surface'});
  if(covered){cache.set(offerKey,covered);return covered;}
 }
 const sites=attachEmitterSites(c,samples.map((sample,index)=>({...sample,key:'surface'+index})),fireFit,usesSiteGeometry(layer));
 const result=sites.length?sites:null;
 cache.set(offerKey,result);
 return result;
}
// ride (fresh recipes; owner, 14 November: "they trail with the flies ... flies with fire - thats pretty cool"): the
// layer's emitters ride the flies of the look's swarm, one on each. Sizes and speeds are shares of that fly's width, and
// the layer's rate is per fly. A particle left in the world trails behind its fly.
function rideSites(c,layer){
 const swarm=c.stack.layers.find(item=>item.swarm&&item.enabled!==false&&(layer.ride===true||item.label===layer.ride))||c.stack.layers.find(item=>item.swarm&&item.enabled!==false);
 if(!swarm)return null;
 const prefix=c.stack.owner+'/'+swarm.id+'/fly',flies=c.model.Bones.filter(n=>n._FxTag?.startsWith(prefix)).map(n=>[Number(n._FxTag.slice(prefix.length)),n]).sort((a,b)=>a[0]-b[0]);
 if(!flies.length)return null;
 return flies.map(([k,bone])=>{
  const width=Math.max(.5,(swarm.spriteSize||10)*FLY_SIZES[k%5]);
  return {key:'ride'+k,point:Array.from(bone.PivotPoint),region:0,ground:false,rideBone:bone.ObjectId,radius:width,componentWidth:width*.5,strip:false,birth:{width:width*.15,length:width*.15,share:flies.length}};
 });
}
function separateSites(c,layer,samples){
 if(samples.length<2)return false;
 const regions=c.frame.regions?.length?c.frame.regions:[{frame:c.frame}];
 const radius=Math.max(2,Math.min(55,.48*Math.max(...regions.map(region=>region.frame.length))));
 const spec=layer.nativeSpec;
 const reach=layer.surfaceFit.footprint+Math.max(spec.area??0,spec.width??0,spec.length??0)*radius;
 let nearest=Infinity;
 for(const [i,a] of samples.entries())for(const b of samples.slice(i+1))
  nearest=Math.min(nearest,Math.hypot(a.point[0]-b.point[0],a.point[1]-b.point[1],a.point[2]-b.point[2]));
 return nearest>reach*2.5;
}
// One compact source for every gathered layer of a look: the sites surround the part's head.
function headEmitterSites(c){
 const {attachmentCache:cache,surfaceKey,frame,model,source}=c;
 const key='emitter-head|'+surfaceKey;
 if(cache.has(key))return cache.get(key);
 const points=Array.from({length:source.Vertices.length/3},(_,i)=>new Vector3().fromArray(source.Vertices,i*3));
 const pivot=new Vector3().fromArray(model.PivotPoints[c.parent]??frame.center.toArray());
 const axis=frame.axis.clone();
 if(frame.center.clone().sub(pivot).dot(axis)<0)axis.negate();
 const head=suggestHeadEmitterSites(points,axis,(frame.regions?.length??1)>4);
 let result=null;
 if(head){
  const owner=new Map(),votes=new Map();
  frame.regions?.forEach((region,index)=>region.vertices.forEach(vertex=>owner.set(vertex,index)));
  for(const vertex of head.vertices)if(owner.has(vertex))votes.set(owner.get(vertex),(votes.get(owner.get(vertex))||0)+1);
  const region=[...votes].sort((a,b)=>b[1]-a[1])[0]?.[0]??0;
  result=head.sites.map((site,index)=>({key:'head'+index,point:site.point,region,ground:false,componentWidth:head.width,strip:false,normal:site.normal,tipDirection:head.axis}));
 }
 cache.set(key,result);
 return result;
}
// gather:'strike' is the striking part of a weapon. A straight blade gets patches along its outer
// part, largest near the tip ('strike-head' keeps only that pair); any other part keeps the head source.
// gather:'engulf' ('engulf-core') keeps those patches on a flat straight blade and seats the fire in
// the mass of any other part (massEmitterSites).
const engulfs=layer=>layer.gather==='engulf'||layer.gather==='engulf-core';
const strikes=layer=>layer.gather==='strike'||layer.gather==='strike-head'||engulfs(layer);
// Each layer's rate is shared among the sites it uses.
function shareSites(sites){
 if(!sites?.length)return null;
 const mean=sites.reduce((sum,site)=>sum+site.birth.share,0)/sites.length;
 return sites.map(({head:_head,...site})=>({...site,birth:{...site.birth,share:site.birth.share/mean}}));
}
function strikeEmitterSites(c,layer){
 const {attachmentCache:cache,surfaceKey,frame,model,source}=c;
 const key='emitter-strike|'+surfaceKey;
 if(!cache.has(key)){
  let all=null,flat=false;
  if((frame.regions?.length??1)<=4){
   const points=Array.from({length:source.Vertices.length/3},(_,i)=>new Vector3().fromArray(source.Vertices,i*3));
   const pivot=new Vector3().fromArray(model.PivotPoints[c.parent]??frame.center.toArray());
   const axis=frame.axis.clone();
   if(frame.center.clone().sub(pivot).dot(axis)<0)axis.negate();
   const blade=suggestBladeEmitterSites(points,axis);
   if(blade){
    const owner=new Map(),votes=new Map();
    frame.regions?.forEach((region,index)=>region.vertices.forEach(vertex=>owner.set(vertex,index)));
    for(const vertex of blade.vertices)if(owner.has(vertex))votes.set(owner.get(vertex),(votes.get(owner.get(vertex))||0)+1);
    const region=[...votes].sort((a,b)=>b[1]-a[1])[0]?.[0]??0;
    const along=new Vector3(...blade.axis);
    all=blade.sites.map(site=>{
     // The patch lies on the face (its length along the blade) and launches away from it.
     const out=new Vector3(...site.direction);
     const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(along.clone().cross(out).normalize(),along,out)).toArray();
     return {key:site.key,head:site.head,point:site.point,region,ground:false,componentWidth:site.width,strip:false,tipDirection:blade.axis,birth:{...site.birth,rotation}};
    });
    // A round bar is long and straight too, but it has no faces to burn on.
    const run=blade.vertices.map(vertex=>points[vertex]);
    const section=crossSection(run,run.reduce((sum,point)=>sum.add(point),new Vector3()).multiplyScalar(1/run.length),along);
    flat=section.thin<section.wide*.5;
   }
  }
  cache.set(key,all&&{all:shareSites(all),head:shareSites(all.filter(site=>site.head)),flat});
 }
 const core=layer.gather==='strike-head'||layer.gather==='engulf-core';
 const blade=cache.get(key);
 if(!engulfs(layer))return blade?core?blade.head:blade.all:headEmitterSites(c);
 const fire=blade?.flat?blade:massEmitterSites(c);
 return fire?core?fire.head:fire.all:headEmitterSites(c);
}
// The fire seated in the part's own mass (suggestMassEmitterSites): one source in a compact piece, a
// chain down a claw or horn, the head of a body. `head` is the main source alone.
function massEmitterSites(c){
 const {attachmentCache:cache,surfaceKey,frame,model}=c;
 const key='emitter-mass|'+surfaceKey;
 if(cache.has(key))return cache.get(key);
 const shape=emitterSurface(c),regions=frame.regions||[];
 let result=null;
 if(shape){
  const pivot=new Vector3().fromArray(model.PivotPoints[c.parent]??frame.center.toArray());
  const axis=frame.axis.clone();
  if(frame.center.clone().sub(pivot).dot(axis)<0)axis.negate();
  const many=regions.length>4;
  // A body's head: the skin bound mostly to head bones.
  let only=null;
  if(many){
   only=new Set();
   for(const region of regions)
    if(region.weights.reduce((sum,[bone,weight])=>sum+(nameRegion(model.Nodes[bone]?.Name||'')==='head'?weight:0),0)>=.5)region.vertices.forEach(vertex=>only.add(vertex));
  }
  const owner=new Map();
  regions.forEach((region,index)=>region.vertices.forEach(vertex=>owner.set(vertex,index)));
  const regionOf=vertices=>{
   const votes=new Map();
   for(const vertex of vertices)if(owner.has(vertex))votes.set(owner.get(vertex),(votes.get(owner.get(vertex))||0)+1);
   return [...votes].sort((a,b)=>b[1]-a[1])[0]?.[0]??0;
  };
  // The largest sprite a region draws: the radius nativeParticles sizes its emitters by.
  const limitOf=region=>Math.max(2,Math.min((regions[region]?.frame||frame).length*.48,55));
  let plan=suggestMassEmitterSites(shape,axis,{many,only,limit:regions.length>1?55:limitOf(0)});
  let region=plan?regionOf(plan.vertices):0;
  if(plan&&regions.length>1&&limitOf(region)<55){
   plan=suggestMassEmitterSites(shape,axis,{many,only,limit:limitOf(region)})||plan;
   region=regionOf(plan.vertices);
  }
  if(plan?.sites.length){
   const all=plan.sites.map(site=>{
    // The birth patch runs along the mass (its length) and launches along the site's direction.
    const along=new Vector3(...site.along),out=new Vector3(...site.direction);
    const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(along.clone().cross(out).normalize(),along,out)).toArray();
    return {key:site.key,head:site.head,point:site.point,region,ground:false,componentWidth:site.width,strip:false,tipDirection:plan.axis,birth:{...site.birth,rotation}};
   });
   result={all:shareSites(all),head:shareSites(all.filter(site=>site.head))};
  }
 }
 cache.set(key,result);
 return result;
}
// cover:'cloud' (fresh recipes): a cloud belongs to the whole part. A weapon is covered as by 'around'. A body's skin
// regions are slivers, and a cloud fitted to them is a scatter of small puffs (owner, 14 November: "a lot of tiny
// clouds"); a body gets six sources around its middle instead, each sized by the body itself: a big unit wears a big
// cloud, a small unit a small one.
function cloudSites(c){
 if(!(c.frame.regions?.length>SHARED_REGIONS))return null;
 const key='emitter-cloud|'+c.surfaceKey;
 if(!c.attachmentCache.has(key)){
  const up=uprightFrame(c),sites=[],v=c.source.Vertices,owner=new Map();
  c.frame.regions.forEach((region,index)=>region.vertices.forEach(vertex=>owner.set(vertex,index)));
  const place=(point,name)=>{
   // The skin nearest to a source carries it.
   let region=0,least=Infinity;
   for(const [vertex,index] of owner){const d=(v[vertex*3]-point.x)**2+(v[vertex*3+1]-point.y)**2+(v[vertex*3+2]-point.z)**2;if(d<least){least=d;region=index;}}
   sites.push({key:name,point:point.toArray(),region,ground:false,radius:up.radius,componentWidth:up.radius*.2,strip:false,birth:{width:up.radius*.3,length:up.radius*.3,share:1}});
  };
  // Eight sources on the body's outline (a cloud born inside the body is hidden by it) and one over its top.
  for(let i=0;i<8;i++){
   const angle=i*2*Math.PI/8+.4,along=[-.2,.14,-.32,.26,-.06,.34,-.26,.08][i],r=up.reachToward(along,angle)*1.05;
   place(up.center.clone().add(new Vector3(Math.cos(angle)*r,Math.sin(angle)*r,along*up.length)),'cloud'+i);
  }
  place(up.center.clone().add(new Vector3(0,0,up.length*.52)),'cloud8');
  c.attachmentCache.set(key,sites);
 }
 return c.attachmentCache.get(key);
}
const PATCH_SITES=16;
/**
 * Continuous cover for fresh layers. A straight rigid piece gets birth lines along
 * its whole length (on each face when the layer hugs the surface); any other piece
 * gets surface patches that reach their neighbours. Rates follow each piece's area.
 */
function coverSites(c,layer){
 const {attachmentCache:cache,surfaceKey,frame}=c;
 const key='emitter-cover|'+surfaceKey+'|'+JSON.stringify([layer.cover,layer.birthAcross??null,layer.widthCap??null,layer.size,layer.nativeSpec?.size,layer.nativeSpec?.alpha,layer.native?.ParticleScaling,layer.native?.Alpha]);
 if(cache.has(key))return cache.get(key);
 if(layer.cover==='cloud'){const cloud=cloudSites(c);if(cloud)return cloud;}
 const regions=frame.regions?.length?frame.regions:[{frame,geometry:c.source,weights:[[c.parent,1]]}];
 const pieces=regions.flatMap((region,regionIndex)=>{
  const shape=analyseEmitterSurface(region.geometry);
  return (shape?.components||[]).map((part,componentIndex)=>({region,regionIndex,shape,part,componentIndex,
   straight:region.weights.length===1&&!!part.frame&&part.frame.length>=5.2*Math.max(part.radius,.001)}));
 });
 const total=pieces.reduce((sum,piece)=>sum+piece.part.area,0);
 const width=layer.widthCap!=null,sites=[];
 const largest=pieces.reduce((a,b)=>!a||b.part.area>a.part.area?b:a,null);
 for(const piece of pieces){
  if(!piece.straight||piece.part.area<total*.04&&piece!==largest)continue;
  const {part,regionIndex,componentIndex}=piece,{axis,center,length}=part.frame;
  const name='cover'+regionIndex+'-'+componentIndex;
  if(layer.cover!=='surface'){
   sites.push({key:name,point:center.toArray(),region:regionIndex,ground:false,area:part.area,
    birth:{width:Math.max(.05,part.radius*(layer.birthAcross??.7)),length:length*.45,rotation:new Quaternion().setFromUnitVectors(y,axis).toArray()},
    ...(width?{componentWidth:part.radius}:{})});
   continue;
  }
  // Lines just outside each face, launching away from it. A round piece is covered from four sides.
  const section=crossSection([...new Set(part.triangles.flatMap(triangle=>triangle.points))],center,axis);
  const flat=section.thin<section.wide*.5,lines=section.sides.slice(0,flat?2:4);
  const sprite=Math.min(surfaceFitInputs(layer,piece.region.frame).footprint,width?section.wide*layer.widthCap:Infinity);
  const clearance=Math.max(.1,Math.min(sprite*.35,section.wide*.5));
  for(const [i,{direction,reach}] of lines.entries()){
   const across=i<2?section.wide:section.thin;
   const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(axis.clone().cross(direction).normalize(),axis,direction)).toArray();
   sites.push({key:name+'-'+i,point:center.clone().addScaledVector(direction,reach+clearance).toArray(),region:regionIndex,ground:false,area:part.area/lines.length,
    birth:{width:Math.max(.05,across*(layer.birthAcross??(flat?.85:.5))),length:length*.45,rotation},
    ...(width?{componentWidth:section.wide}:{})});
  }
 }
 // Every other piece shares a fixed number of patches by area, largest pieces first.
 const curved=pieces.filter(piece=>!piece.straight).sort((a,b)=>b.part.area-a.part.area);
 const curvedArea=curved.reduce((sum,piece)=>sum+piece.part.area,0);
 if(curvedArea>0){
  const exact=curved.map(piece=>PATCH_SITES*piece.part.area/curvedArea),counts=exact.map(Math.floor);
  const order=exact.map((_,i)=>i).sort((a,b)=>exact[b]-counts[b]-(exact[a]-counts[a])||a-b);
  for(let k=0,left=PATCH_SITES-counts.reduce((a,b)=>a+b,0);k<left&&k<order.length;k++)counts[order[k]]++;
  for(const [index,piece] of curved.entries()){
   const count=counts[index];if(!count)continue;
   const {part,shape,regionIndex,componentIndex}=piece;
   const bounds=new Box3().setFromPoints(part.triangles.flatMap(triangle=>triangle.points));
   const local={...shape,components:[part],area:part.area,centre:part.centre,bounds,span:bounds.getSize(new Vector3())};
   const samples=suggestEmitterSites(local,{siteCount:count,footprint:1,liveParticles:4*count},frame.unitHeight);
   for(const [i,sample] of samples.entries()){
    const nearest=samples.reduce((least,other)=>other===sample?least:Math.min(least,Math.hypot(sample.point[0]-other.point[0],sample.point[1]-other.point[1],sample.point[2]-other.point[2])),Infinity);
    const reach=Math.max(.05,Number.isFinite(nearest)?nearest*.55:Math.min(local.span.length()*.3,Math.sqrt(part.area)*.35));
    const rotation=new Quaternion().setFromUnitVectors(z,new Vector3(...sample.normal).normalize()).toArray();
    sites.push({key:'cover'+regionIndex+'-'+componentIndex+'-p'+i,point:sample.point,region:regionIndex,ground:false,area:part.area/samples.length,
     birth:{width:reach,length:reach,rotation,patch:true},normal:sample.normal,
     ...(width?{componentWidth:sample.componentWidth}:{})});
   }
  }
 }
 let result=null;
 if(sites.length){
  // Each site's share of the layer's rate follows the area it covers.
  const mean=sites.reduce((sum,site)=>sum+site.area,0)/sites.length;
  result=sites.map(({area,...site})=>({...site,birth:{...site.birth,share:mean>0?area/mean:1}}));
 }else result=birthRegionSites(c,layer);
 cache.set(key,result);
 return result;
}
// gather:'orb' (fresh recipes): where a part carries an orb. A slender weapon carries it at its far end, in full view
// (seated in a blade, the blade hides the middle of it); a compact piece or a body holds it where Fireball sits.
function orbSites(c){
 const slender=(c.frame.regions?.length??1)<=SHARED_REGIONS&&c.frame.length>=c.frame.radius*3.5;
 if(slender)return tipEmitterSites(c);
 // Seated in a head or a mace the orb is hidden by it: it rests on top of the mass (above a body's head).
 const body=c.frame.regions?.length>SHARED_REGIONS;
 return strikeEmitterSites(c,{gather:'engulf-core'})?.map(({birth:_birth,...site})=>({...site,point:[site.point[0],site.point[1],site.point[2]+site.componentWidth*(body?2:1.3)]}))||null;
}
// gather:'spots' (fresh recipes; owner, 14 November: "tattoo spots needs to be movable ... it doesnt work if it only
// picks 1 area"): a few places on the part's surface (spots: how many), the same for every layer of the look that asks.
// Each is an emitter bound to the skin under it: it can be selected, moved, snapped to the surface, deleted, and the
// Emitters slider adds more.
function spotSites(c,layer){
 const count=Math.max(1,Math.min(16,Math.round(layer.spots??3))),key='emitter-spots|'+c.surfaceKey+'|'+count;
 if(c.attachmentCache.has(key))return c.attachmentCache.get(key);
 const samples=suggestEmitterSites(emitterSurface(c),{siteCount:count,footprint:Math.max(1,c.frame.length*.12),liveParticles:4*count},c.frame.unitHeight);
 const sites=attachEmitterSites(c,samples.map((sample,index)=>({...sample,key:'spot'+index})),false,true),result=sites.length?sites:null;
 c.attachmentCache.set(key,result);
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
// gather:'mouth' (breath recipes): where a breath leaves the part. A weapon breathes from its far end, like 'tip'.
// A body (more skin regions than a weapon has) breathes from its head, where Fireball sits, the way the unit faces:
// a Warcraft III model looks along +X. The head's own skin region is a sliver, so the site carries the radius its
// emitters are sized by: enough for a breath as wide as the head.
function mouthEmitterSites(c){
 const head=c.frame.regions?.length>SHARED_REGIONS?massEmitterSites(c)?.head?.[0]:null;
 if(!head)return tipEmitterSites(c);
 const {birth:_birth,head:_head,...site}=head;
 return [{...site,key:'mouth0',tipDirection:[1,0,0],radius:Math.max(2,Math.min(55,site.componentWidth*3.2))}];
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
 if(layer.gather&&layout.some(site=>!site.point)){
  const tips=(strikes(layer)?strikeEmitterSites(c,layer):layer.gather==='head'?headEmitterSites(c):layer.gather==='mouth'?mouthEmitterSites(c):layer.gather==='orb'?orbSites(c):layer.gather==='spots'?spotSites(c,layer):tipEmitterSites(c))||[];
  layout=layout.map(slot=>slot.point?slot:{...slot,...tips.find(tip=>tip.key===slot.key)});
 }
 const missing=layout.filter(site=>!site.point);
 if(!missing.length)return layout;
 if(layer.birthRegion){
  const regions=layer.cover?coverSites(c,layer):birthRegionSites(c,layer);
  if(regions?.length){
   let ordinal=0;
   return layout.map(slot=>{
    if(slot.point)return slot;
    const index=ordinal++,base=regions[index%regions.length],copies=Math.ceil((missing.length-index%regions.length)/regions.length),copy=Math.floor(index/regions.length);
    const birth={...base.birth},point=new Vector3(...base.point);
    if(birth.rotation&&!birth.patch&&copies>1){
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
 // Straight strips can carry their own cap so flames stay in proportion on thin blades.
 if(layer.widthCapStrip!=null&&slot.strip&&slot.componentWidth>0)return slot.componentWidth*layer.widthCapStrip;
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
 const points=planned.filter(slot=>slot.birth&&(!slot.birth.rotation||slot.birth.patch)&&(active?active.has(slot.key):!layer.individuals?.[slot.key]?.deleted));
 if(!points.length)return 1;
 const rate=(layer.nativeSpec.rate??8)*layer.amount/24*(layer.siteRateScale??1);
 const count=active?.size??planned.length;
 const leastWeight=weights?Math.min(...points.map(slot=>weights[planned.indexOf(slot)])):1;
 const live=rate*layer.nativeSpec.life*leastWeight/count;
 return live>0?Math.min(4,Math.max(1,2/live)):1;
}
// The order in which a layer's sites fire: scattered over the part, every site once per cycle.
function burstTurn(index,turns){
 if(turns<3)return index;
 const common=(a,b)=>b?common(b,a%b):a;
 let stride=Math.max(1,Math.round(turns*.382));
 while(common(stride,turns)>1)stride++;
 return index*stride%turns;
}
// fieldScale: a whole-layer edit carried from another part, as a ratio of what the layer makes on this one.
// A field the layer or the emitter sets itself is left alone.
function applyFieldScale(node,l){
 for(const [field,scale] of Object.entries(l.fieldScale||{})){
  if(l.native&&field in l.native)continue;
  const value=node[field],by=i=>Array.isArray(scale)?scale[i]??1:scale;
  if(typeof value==='number')node[field]=value*by(0);
  else if(ArrayBuffer.isView(value))node[field]=value.map((v,i)=>v*by(i));
 }
}
function hasRecipeEmitterDefaults(layer){
 return layer.fieldScale||layer.recipeOwner||layer.airyFit||layer.fireFit?.version===1||layer.rampTint||layer.rampPinned||layer.widthCap!=null||
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
 // Bursts (fresh recipes, burstCount): each firing site takes its turn, one burst at a time.
 // A burst starts a little early or late each time, so the rhythm is never a steady blink.
 const bursts=l.burstGap!=null&&l.burstCount!=null&&!l.impact,marks=[];
 const firing=bursts?planned.filter((slot,i)=>!(!layout&&shares&&!shares[i])&&(!active||active.has(slot.key))&&!layer.individuals?.[slot.key]?.deleted).length:0;
 let fired=0;
 for(const [i,slot] of planned.entries()){
  const region=slot.region;if(!layout&&shares&&!shares[i])continue;
  if(active&&!active.has(slot.key)){
   c.sites.push(emitterSiteRecord(slot,new Vector3(...slot.point),slot.regionIndex,!!slot.ground));
   continue;
  }
  const key=slot.key,l=individualEmitterLayer(layer,key);
  const f=region.frame;
  const radius=contact?.radius??slot.radius??Math.max(2,Math.min(f.length*.48,55)),temp=emptyParticleModel(m.Version);
  const share=active?(layer.siteRateScale??1)/active.size:c.autoSites?1/planned.length:layout?1:shares?shares[i]:1;
  const spec={...l.nativeSpec},e={duration:ms},options={speed:l.speed,opacity:l.strength,density:l.amount/24*share*floor,tint:l.tint,sequence:c.stack.sequence};
  const source=addParticles(temp,m,spec,e,options,radius);
  if(slot.birth){source.Width=slot.birth.width;source.Length=slot.birth.length;if(slot.birth.rotation)source.Rotation=emitterRotationTrack(m,slot.birth.rotation);}
  if(slot.birth?.share&&typeof source.EmissionRate==='number')source.EmissionRate*=slot.birth.share;
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
  if(layer.tattoo)marks.push({point:pos.clone(),width:slot.componentWidth,geoset:layer.individuals?.[key]?.surface?.geoset});
  const p=nodeFor(c,'ParticleEmitters2','ParticleEmitter2',key,l.label,pos,slot.rideBone!=null?slot.rideBone:(slot.ground??l.ground)&&!contact&&!layer.individuals?.[key]?.surface?null:siteParent({...c,source:sourceGeo,parent:contact?null:c.parent},layer,key,region,pos,'native-'+i,slot));
  const keep={Name:p.Name,ObjectId:p.ObjectId,Parent:p.Parent,PivotPoint:p.PivotPoint,_FxTag:p._FxTag};Object.assign(p,source,keep);
  applyRecipeAim(c,l,slot,p,slot.birth?.rotation);
  for(const [key,value] of Object.entries(l.native||{}))p[key]=nativeValue(key,recipeNativeValue(l,key,value),m,c.createdClocks);
  if(!l.native?.ParticleScaling){
   p.ParticleScaling=vec(Array.from(p.ParticleScaling,v=>v*l.size));
   const edited=l.widthCapEdited||layer.individuals?.[key]?.values?.size!=null;
   if(l.widthCap!=null?!edited:l.airyFit){
    const fitted=Math.max(...p.ParticleScaling);
    p.ParticleScaling=capParticleScaling(p.ParticleScaling,widthCapFor(l,slot));
    // capMotion (fresh recipes): launch speed and lift follow the capped sprite, so a flame climbs as many of its own
    // widths on any part. A number names the cap to follow instead of the layer's own (embers that rise with a flame).
    const motion=l.capMotion===true?Math.max(...p.ParticleScaling)/fitted:l.capMotion>0&&slot.componentWidth>0?Math.min(1,slot.componentWidth*l.capMotion/radius):1;
    if(fitted>0&&motion!==1)for(const key of ['Speed','Gravity'])if(typeof p[key]==='number'&&!(l.native&&key in l.native))p[key]*=motion;
   }
  }
  applyFieldScale(p,l);
  if(bursts){
   const span=Math.max(60,Math.round((layer.burstWindow??.15)*1000)),gap=Math.max(100,Math.round(layer.burstGap*1000)),period=span+gap;
   const turns=Math.max(1,firing),slots=turns*Math.ceil(3/turns),cycle=period*slots,clock=clockFor(m,cycle,c.createdClocks);
   const rate=Math.max(0,l.burstCount)*1000/span,pairs=[[0,0]];
   for(let k=burstTurn(fired++,turns);k<slots;k+=turns){
    const start=k*period+40+Math.round((k*.618034+.11)%1*gap*.5);
    pairs.push([start/cycle,rate],[(start+span)/cycle,0]);
   }
   pairs.push([1,0]);
   p.Squirt=false;
   p.EmissionRate=keys(clock,cycle,pairs,0);
  }
  // A tattoo's emitters are only its markers (select, drag, snap to surface): the design is cut from the skin.
  if(layer.tattoo){p.Squirt=false;p.EmissionRate=0;}
  ids.push(p.ObjectId);
 }
 if(layer.tattoo)tattooLayer(c,layer,marks);
 return {id:ids[0],ids};
}
/**
 * Tattoo (fresh recipes; see fx-tattoo.js): at every marker of the layer, a tribal design cut out of the part's own
 * skin triangles, a hair above them, bound to the bones of the skin it was cut from. Drawn in the player's flat colour
 * and lit like the skin; Glow adds the player's light over it.
 */
function tattooLayer(c,l,marks){
 const {model:m,tag}=c;
 const slender=(c.frame.regions?.length??1)<=SHARED_REGIONS&&c.frame.length>=c.frame.radius*3.5,up=slender?c.frame.axis.clone().normalize():z.clone();
 const vertices=[],normals=[],uvs=[],out=[],vertexGroup=[],groups=[],groupOf=new Map(),centres=[];
 const lift=Math.max(.12,c.frame.length*.0025),triangle=new Triangle(),closest=new Vector3(),flat=new Vector3();
 let widest=1;
 for(const mark of marks){
  // The skin the mark was put on: the part itself, or the geoset the user clicked (never an effect's own geoset).
  const clicked=mark.geoset!=null&&mark.geoset!==c.index?m.Geosets[mark.geoset]:null,source=clicked&&!clicked._FxTag&&clicked.Faces?.length?clicked:c.source,part=source===c.source?-1:mark.geoset;
  const v=source.Vertices,faces=source.Faces,smooth=source.Normals?.length===v.length?source.Normals:null;
  const bind=vertex=>{const from=source.VertexGroup?.[vertex]??0,id=part+':'+from;if(!groupOf.has(id)){groupOf.set(id,groups.length);groups.push([...(source.Groups?.[from]||[c.parent])]);}return groupOf.get(id);};
  // The skin under the marker: its nearest triangle gives the place and the way the skin faces.
  let best=Infinity,face=-1;const at=new Vector3();
  for(let f=0;f<faces.length;f+=3){
   triangle.a.fromArray(v,faces[f]*3);triangle.b.fromArray(v,faces[f+1]*3);triangle.c.fromArray(v,faces[f+2]*3);
   triangle.closestPointToPoint(mark.point,closest);const d=closest.distanceToSquared(mark.point);
   if(d<best){best=d;face=f;at.copy(closest);}
  }
  if(face<0)continue;
  triangle.a.fromArray(v,faces[face]*3);triangle.b.fromArray(v,faces[face+1]*3);triangle.c.fromArray(v,faces[face+2]*3);triangle.getNormal(flat);
  if(flat.lengthSq()<.5)continue;
  // The side the skin's own normals point to (a two-sided blade is drawn from the side its normals name).
  if(smooth){const own=new Vector3(smooth[faces[face]*3],smooth[faces[face]*3+1],smooth[faces[face]*3+2]);if(own.dot(flat)<0)flat.negate();}
  // A design is as wide as the part is there, never more than a quarter of the part's length.
  const size=Math.max(.5,Math.min(Math.max(mark.width>0?mark.width*.45:0,c.frame.radius*.45),c.frame.length*.14)*(l.tattooSize??1));
  widest=Math.max(widest,size);centres.push(at.toArray());
  for(const piece of tattooPieces(v,faces,at,flat,up,size,l.tattoo,(l.tattooTurn||0)*Math.PI/180)){
   const ids=[faces[piece.face],faces[piece.face+1],faces[piece.face+2]],first=vertices.length/3;
   for(const [k,weights] of piece.weights.entries()){
    const point=new Vector3(),normal=new Vector3();
    for(let j=0;j<3;j++){point.x+=v[ids[j]*3]*weights[j];point.y+=v[ids[j]*3+1]*weights[j];point.z+=v[ids[j]*3+2]*weights[j];
     if(smooth){normal.x+=smooth[ids[j]*3]*weights[j];normal.y+=smooth[ids[j]*3+1]*weights[j];normal.z+=smooth[ids[j]*3+2]*weights[j];}}
    if(normal.lengthSq()<1e-6)normal.copy(flat);normal.normalize();if(normal.dot(flat)<0)normal.negate();
    point.addScaledVector(normal,lift);
    vertices.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);
    // Only the bright middle of the round team glow is used for the light over the design.
    uvs.push(.5+piece.points[k][0]*.05,.5-piece.points[k][1]*.05);
    vertexGroup.push(bind(ids[weights.indexOf(Math.max(...weights))]));
   }
   out.push(first,first+1,first+2);
  }
 }
 if(!out.length)return;
 const base=l.loop!=null?Math.max(100,Math.round(l.loop)):c.ms,clock=l.loop!=null?clockFor(m,base,c.createdClocks):c.id;
 const passes=[{TextureID:teamTexture(m,1,tag),CoordId:0,TVertexAnimId:null,FilterMode:0,Shading:0,Alpha:1}];
 const glow=Math.max(0,Math.min(1,l.tattooGlow??0));
 if(glow>0)passes.push({TextureID:teamTexture(m,2,tag),CoordId:0,TVertexAnimId:null,FilterMode:3,Shading:1|32,Alpha:keys(clock,base,curves.soft.map(([t,a])=>[t,a*glow]),3)});
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:passes});
 const g={Vertices:Float32Array.from(vertices),Normals:Float32Array.from(normals),TVertices:[Float32Array.from(uvs)],Faces:Uint16Array.from(out),VertexGroup:Uint8Array.from(vertexGroup),Groups:groups.length?groups:[[c.parent]],TotalGroupsCount:Math.max(1,groups.length),MaterialID:material,SelectionGroup:0,Unselectable:false,Anims:[]};
 if(m.Version>=900)g.LevelOfDetail=0;
 quadBounds(c,g,centres,widest*1.5);
 overlay(c,g,material,l.tint||[1,1,1],m.GeosetAnims.find(a=>a.GeosetId===c.index),0);
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
 const keys=[],plain=[],steady=new Vector3();
 // Only the bones this attachment reads, and their parents, are sampled; each frame's matrices are shared by every site.
 const nodes=nodeIndex(c.model),bones=[...new Set([parent,...geosetVertexBones(c.source,region.vertices[0]),...(region.surface?.vertices||[]).flatMap(v=>geosetVertexBones(c.source,v))])];
 // steady: where the attachment last was a real place. A bone scaled to nothing in one animation (a piece the model
 // hides) has no inverse, and the sample there is not a number; that key keeps the last real place.
 for(const [sequence,clip] of c.model.Sequences.entries()){
  const value=frame=>{const key=sequence+':'+frame,matrices=sampleSomeNodeMatrices(c.model,bones,frame,sequence,frame,samples.get(key),nodes);samples.set(key,matrices);const skin=geosetSkinMatrix(c.source,region.vertices[0],matrices),world=point.clone().applyMatrix4(skin);if(region.surface){const bind=new Vector3(),posed=new Vector3();region.surface.vertices.forEach((v,i)=>{const at=new Vector3().fromArray(c.source.Vertices,v*3),weight=region.surface.barycentric[i];bind.addScaledVector(at,weight);posed.addScaledVector(at.applyMatrix4(geosetSkinMatrix(c.source,v,matrices)),weight);});world.add(posed).sub(bind.applyMatrix4(skin));}const inverse=matrices.get(parent)?.clone().invert();if(inverse)world.applyMatrix4(inverse);world.sub(point);if(!Number.isFinite(world.x+world.y+world.z))return steady.clone();steady.copy(world);return world;};
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
  applyFieldScale(p,l);
  ids.push(p.ObjectId);
 }
 return {id:ids[Math.floor(ids.length/2)],ids,family:'ParticleEmitters2'};
}
// upright (fresh recipes): what goes around a body stands level. A body's own long axis may lie any way (a wide belly,
// a rider), so the frame is the vertical through the body's middle, as wide as the body is at each height.
function uprightFrame(c){
 const key='upright|'+c.surfaceKey;
 if(c.attachmentCache.has(key))return c.attachmentCache.get(key);
 const v=c.source.Vertices,f=c.source.Faces,n=v.length/3;
 let lo=Infinity,hi=-Infinity;
 for(let i=0;i<n;i++){lo=Math.min(lo,v[i*3+2]);hi=Math.max(hi,v[i*3+2]);}
 // The skin by area (owner, 14 November: "souls is not centered properly on the body"): arms, horns and spikes are
 // thin and weigh little, so the middle line and the reach are the trunk's, not the box around every limb.
 const pieces=[];
 for(let i=0;i+2<f.length;i+=3){
  const a=f[i]*3,b=f[i+1]*3,d=f[i+2]*3,ux=v[b]-v[a],uy=v[b+1]-v[a+1],uz=v[b+2]-v[a+2],wx=v[d]-v[a],wy=v[d+1]-v[a+1],wz=v[d+2]-v[a+2];
  const area=Math.hypot(uy*wz-uz*wy,uz*wx-ux*wz,ux*wy-uy*wx)/2;
  if(area>0)pieces.push({x:(v[a]+v[b]+v[d])/3,y:(v[a+1]+v[b+1]+v[d+1])/3,z:(v[a+2]+v[b+2]+v[d+2])/3,area});
 }
 if(!pieces.length)for(let i=0;i<n;i++)pieces.push({x:v[i*3],y:v[i*3+1],z:v[i*3+2],area:1});
 // The value below which a share of the area lies.
 const share=(list,value,p)=>{
  if(!list.length)return 0;
  const sorted=list.map(e=>[value(e),e.area]).sort((a,b)=>a[0]-b[0]),total=sorted.reduce((t,e)=>t+e[1],0);
  let sum=0;for(const [x,area] of sorted){sum+=area;if(sum>=total*p)return x;}
  return sorted.at(-1)[0];
 };
 const cx=share(pieces,e=>e.x,.5),cy=share(pieces,e=>e.y,.5);
 for(const e of pieces)e.reach=Math.hypot(e.x-cx,e.y-cy);
 const radius=Math.max(1,share(pieces,e=>e.reach,.75)),length=Math.max(1,hi-lo),center=new Vector3(cx,cy,(lo+hi)/2),axis=new Vector3(0,0,1);
 const slice=(along,band)=>{const height=center.z+along*length;return pieces.filter(e=>Math.abs(e.z-height)<=length*band);};
 // The body's reach from its middle line in a slice at one height (along: a share of its height from the middle).
 const radiusAt=along=>{const near=slice(along,.14);return near.length>=4?Math.max(radius*.45,share(near,e=>e.reach,.72)):radius;};
 // The same toward one side (an angle about the vertical): a body is seldom round. Its slice is read as an oval, so
 // what is wound around it lies as close to its back as to its shoulders and never jumps out at an arm.
 const reachToward=(along,angle)=>{
  const near=slice(along,.18);if(near.length<4)return radiusAt(along);
  const rx=Math.max(radius*.4,share(near,e=>Math.abs(e.x-cx),.8)),ry=Math.max(radius*.4,share(near,e=>Math.abs(e.y-cy),.8));
  return rx*ry/Math.max(1e-6,Math.hypot(ry*Math.cos(angle),rx*Math.sin(angle)));
 };
 const frame={center,axis,length,radius,girth:radius,radiusAt,reachToward,at:distance=>center.clone().addScaledVector(axis,distance)};
 c.attachmentCache.set(key,frame);
 return frame;
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
 h2.Rotation=keys(clockFor(m,t2,c.createdClocks),t2,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,turn(side,a*(l.orbitTilt??35))]));
 const p3=p2.clone().addScaledVector(axis,radius*.4);
 const h3=nodeFor(c,'Bones','Bone','orbit'+r+'-3',l.label+' orbit 3',p3,h2.ObjectId);h3.Flags=256;
 h3.Translation=keys(clockFor(m,t3,c.createdClocks),t3,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,normal.clone().multiplyScalar(radius*.3*a).toArray()]));
 return {parent:h3.ObjectId,at:p3};
}
function edgeLayer(c,l){
 const {model:m,id,ms,tag}=c;
 // whole (fresh recipes): one ribbon for the whole part instead of one for each skin region, which crowds a body.
 // along: its place on the part's length, as a share of that length from the middle.
 // upright (fresh recipes): around a body the ring stands level, as wide as the body is at its height.
 const up=l.whole&&l.upright&&c.frame.regions?.length>SHARED_REGIONS?uprightFrame(c):null;
 if(up&&l.orbit&&c.frame.radius>0)l={...l,orbitRadius:l.orbitRadius*up.radiusAt(l.along||0)/c.frame.radius};
 const regions=!l.whole&&c.frame.regions?.length?c.frame.regions:[{frame:up||c.frame,weights:[[c.parent,1]]}],ids=[];
 // sharedSites (fresh recipes): on a part with more skin regions than a weapon has, only its longest regions carry a ribbon.
 const shares=l.sharedSites&&!l.whole?emissionShares(regions,1):null;
 for(const [regionIndex,region] of regions.entries()){const frame=region.frame;
 if(shares&&!shares[regionIndex])continue;
 const point=frame.center.clone().addScaledVector(frame.axis,frame.length*(l.along||0)).add(new Vector3(...l.offset));
 let parent=regionParent(c,region,point,'edge-'+regionIndex),at=point;
 // Orbit: the ribbon rides the end of a helper chain, each helper on its own clock, so it draws a wandering loop.
 if(l.orbit)({parent,at}=orbitChain(c,l,frame,point,parent,regionIndex));
 const p=nodeFor(c,'RibbonEmitters','RibbonEmitter','edge'+regionIndex,l.label,at,parent);
 // A small closed sway gives a stationary edge a width as the ribbon sheds its last vertices.
 const normal=new Vector3().crossVectors(frame.axis,Math.abs(frame.axis.z)<.9?z:y).normalize();
 if(l.orbit)delete p.Translation;
 else p.Translation=keys(id,ms,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,a])=>[t,normal.clone().multiplyScalar(frame.girth*.18*a).toArray()]));
 const layer={FilterMode:l.filter??(l.orbit?3:4),Shading:17,TextureID:l.team?teamTexture(m,l.team,tag):texture(m,l.image,false,tag),CoordId:0,TVertexAnimId:null,Alpha:1};
 Object.assign(p,{MaterialID:resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:[layer]}),Rotation:keys(id,ms,[[0,new Quaternion().setFromUnitVectors(y,frame.axis).toArray()]],0),
  HeightAbove:l.upper,HeightBelow:l.lower,Alpha:l.orbit||l.pulse==='steady'?l.strength:keys(id,ms,curves.flicker.map(([t,a])=>[t,a*l.strength])),Color:vec(l.tint),LifeSpan:l.lasts,EmissionRate:l.smoothness,Gravity:l.gravity,Visibility:keys(id,ms,[[0,1],[1,1]])});
 ids.push(p.ObjectId);
 }
 return {id:ids[0],ids,family:'RibbonEmitters'};
}
// The part's middle line and its reach at places along it (t from 0 to 1), for what is wound around it. A body is read
// upright; any other part along its own length, following a bend.
function partProfile(c){
 const key='profile|'+c.surfaceKey;
 if(c.attachmentCache.has(key))return c.attachmentCache.get(key);
 let profile;
 if(c.frame.regions?.length>SHARED_REGIONS){
  const up=uprightFrame(c);
  profile={axis:up.axis.clone(),length:up.length,radius:up.radius,centreAt:t=>up.at((t-.5)*up.length),radiusAt:(t,toward)=>toward?up.reachToward(t-.5,Math.atan2(toward.y,toward.x)):up.radiusAt(t-.5)};
 }else{
  const {frame}=c,v=c.source.Vertices,n=v.length/3,axis=frame.axis.clone().normalize(),stations=17,centres=[],raw=[];
  const p=new Vector3();
  for(let s=0;s<stations;s++){
   const centre=frame.at((s/(stations-1)-.5)*frame.length),near=[];
   for(let i=0;i<n;i++){p.set(v[i*3],v[i*3+1],v[i*3+2]).sub(centre);const a=p.dot(axis);if(Math.abs(a)<=frame.length*.07)near.push(p.addScaledVector(axis,-a).length());}
   near.sort((a,b)=>a-b);centres.push(centre);raw.push(near.length>=3?near[Math.floor(near.length*.9)]:0);
  }
  // An odd shape (a scythe, a hooked or bent piece; owner, 14 November) leaves its own straight middle line: where the
  // skin's middle lies well off that line, the line follows the skin and the reach is measured from there.
  const middles=centres.map(centre=>{
   const sum=new Vector3();let count=0;
   for(let i=0;i<n;i++){p.set(v[i*3],v[i*3+1],v[i*3+2]).sub(centre);const a=p.dot(axis);if(Math.abs(a)<=frame.length*.07){sum.add(p.addScaledVector(axis,-a));count++;}}
   return count>=3?sum.multiplyScalar(1/count):sum.set(0,0,0);
  });
  if(Math.max(...middles.map(m=>m.length()))>frame.radius*.25){
   const smooth=middles.map((m,s)=>m.clone().multiplyScalar(2).add(middles[Math.max(0,s-1)]).add(middles[Math.min(stations-1,s+1)]).multiplyScalar(.25));
   for(let s=0;s<stations;s++){
    centres[s].add(smooth[s]);const near=[];
    for(let i=0;i<n;i++){p.set(v[i*3],v[i*3+1],v[i*3+2]).sub(centres[s]);const a=p.dot(axis);if(Math.abs(a)<=frame.length*.07)near.push(p.addScaledVector(axis,-a).length());}
    near.sort((a,b)=>a-b);raw[s]=near.length>=3?near[Math.floor(near.length*.9)]:0;
   }
  }
  const floor=frame.radius*.3,radii=raw.map((r,s)=>Math.max(floor,(raw[Math.max(0,s-1)]+2*r+raw[Math.min(stations-1,s+1)])/4));
  const pick=t=>{const x=Math.max(0,Math.min(1,t))*(stations-1),i=Math.min(stations-2,Math.floor(x));return [i,x-i];};
  profile={axis,length:frame.length,radius:Math.max(floor,radii.reduce((a,b)=>a+b,0)/stations),
   centreAt:t=>{const [i,f]=pick(t);return centres[i].clone().lerp(centres[i+1],f);},radiusAt:t=>{const [i,f]=pick(t);return radii[i]+(radii[i+1]-radii[i])*f;}};
 }
 c.attachmentCache.set(key,profile);
 return profile;
}
/**
 * Twirl (Card facing 'twirl', pass 8): energy wound around the part. The owner's references build it as geometry: glow
 * strips laid in a spiral around a blade on a bone that turns about the blade (Blade of the Abyssal Serpent), fire bands
 * on spinning helpers (Infernal Bulwark). Each strand is a strip following the part's own outline at every place along
 * it, pointed at both ends; all strands of a layer ride one bone that turns about the part.
 */
function twirlStrands(c,l,card,size,out){
 const profile=partProfile(c),axis=profile.axis;
 const e1=new Vector3().crossVectors(axis,Math.abs(axis.z)<.9?z:y).normalize(),e2=new Vector3().crossVectors(axis,e1).normalize();
 // Size is the strand's distance from the middle line as a share of the part's reach there.
 const k=size/Math.max(1e-6,c.frame.radius),span=.9,length=profile.length*span,mean=Math.max(.1,profile.radius*k);
 const turns=card.turns??1.5,steps=Math.max(8,Math.round(turns*14)),band=card.band??.5,repeat=Math.max(.25,l.tiling??1);
 // A strand is as wide as a share (Width) of its distance from the part, but never of more than an eighth of the
 // part's length: around a body or a claw it stays a strand, not a sheet.
 const wide=Math.min(mean,profile.length*.12)*band*.5;
 const centre=profile.centreAt(.5).add(new Vector3(...l.offset));
 const bone=nodeFor(c,'Bones','Bone','twirl',l.label,centre,c.parent);
 bone.Flags=256;delete bone.Translation;
 for(let s=0;s<card.count;s++){
  const phase=2*Math.PI*s/card.count,first=out.vertices.length/3;
  for(let j=0;j<=steps;j++){
   const t=j/steps,place=(1-span)/2+span*t,angle=phase+2*Math.PI*turns*t;
   const radial=e1.clone().multiplyScalar(Math.cos(angle)).addScaledVector(e2,Math.sin(angle));
   const radius=Math.max(profile.radiusAt(place,radial)*k,mean*.35),point=profile.centreAt(place).add(new Vector3(...l.offset)).addScaledVector(radial,radius);
   const tangent=axis.clone().multiplyScalar(length).addScaledVector(e1,-Math.sin(angle)*radius*2*Math.PI*turns).addScaledVector(e2,Math.cos(angle)*radius*2*Math.PI*turns).normalize();
   const across=new Vector3().crossVectors(radial,tangent).normalize(),half=wide*Math.pow(Math.sin(Math.PI*t),.6);
   for(const side of [-1,1]){
    out.vertices.push(...point.clone().addScaledVector(across,side*half).toArray());out.normals.push(...radial.toArray());out.uvs.push(l.team?.2+.6*t:t*repeat,l.team?(side<0?.62:.38):side<0?1:0);out.vertexGroup.push(out.groups.length);
   }
   out.centres.push(point);
   if(j<steps){const a=first+j*2;out.faces.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
 }
 out.groups.push([bone.ObjectId]);
 return {bone,axis,reach:wide};
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
 // whole (fresh recipes): one set of cards along the whole part instead of one set for each skin region.
 // along: the set's place on the part's length, as a share of that length from the middle.
 // seated (fresh recipes): only a slender part is a piece a ring can go around. A ring around all of a body or a bulky
 // piece is as wide as the unit. On a body (more skin regions than a weapon has) or a part wider than a fifth of its
 // length, a whole-part set gathers where Fireball sits (a body's head, the middle of a mass): the cards are stacked
 // through it and sized to that mass by reach. On a body they stand level.
 // tilt (pass 8; owner: "body doesn't show"): a seated set with a tilt stands level around a body, one ring at each
 // height, as wide as the body is there; on a weapon each ring leans out of its plane and turns about the part.
 const body=c.frame.regions?.length>SHARED_REGIONS,twirl=card.facing==='twirl';
 const level=l.whole&&l.seated&&l.tilt!=null&&body&&card.facing!=='ground'&&!twirl?uprightFrame(c):null;
 // seat 'orb' (fresh recipes): the card sits where the part carries an orb (orbSites).
 const seat=level||twirl||card.facing==='ring'||!l.whole||card.facing==='ground'?null:l.seat==='orb'?orbSites(c)?.[0]:l.seated&&(body||c.frame.radius>c.frame.length*.2)?massEmitterSites(c)?.head?.[0]:null;
 const seatAxis=seat?(body||!seat.tipDirection?z.clone():new Vector3(...seat.tipDirection).normalize()):null;
 const regions=card.facing==='ground'?[null]:level?[{frame:level,weights:[[c.parent,1]]}]:seat?[c.frame.regions?.[seat.region]||{frame:c.frame,weights:[[c.parent,1]]}]:!l.whole&&c.frame.regions?.length?c.frame.regions:[{frame:c.frame,weights:[[c.parent,1]]}];
 const seatHalf=seat&&l.reach!=null?Math.max(.1,seat.componentWidth/1.1*l.reach*(l.tilt!=null&&l.seated?1.7:1)):size;
 let widest=seatHalf;
 const vertices=[],normals=[],uvs=[],faces=[],groups=[],vertexGroup=[],centres=[];
 // sharedSites (fresh recipes): on a part with more skin regions than a weapon has, the cards go to its longest
 // regions, four regions' worth in all, like the emitters. A body no longer gets a set on every bone.
 const shares=l.sharedSites&&!l.whole&&card.facing!=='ground'?emissionShares(regions,card.count):null;
 let k=0,wound=null;
 if(card.facing==='ring'){
  // ring (fresh recipes; owner, 14 November: "where are floating runes"): the cards face the camera and stand evenly
  // spaced on a ring about the part, as wide as the part is there (a body: its trunk). One bone turns the ring about
  // the part; every card bobs and swells on its own clock. phase: where on the ring the first card stands.
  const profile=partProfile(c),axis=profile.axis.clone().normalize(),place=.5+(l.along||0);
  const e1=new Vector3().crossVectors(axis,Math.abs(axis.z)<.9?z:y).normalize(),e2=new Vector3().crossVectors(axis,e1).normalize();
  // A slender part is ringed at its own half width at least, so the letters float about a blade and do not hug it.
  const reach=body?profile.radiusAt(place):Math.max(profile.radiusAt(place),c.frame.radius*.9);
  const radius=Math.max(.5,reach*size/Math.max(1e-6,c.frame.radius)),centre=profile.centreAt(place).add(new Vector3(...l.offset));
  // band: a card's half width as a share of the ring's radius; a letter (.26) is 4 to 9% of the part's length.
  const band=card.band??.26,half=Math.max(.3,Math.min(Math.max(radius*.26,profile.length*.04),profile.length*.09)*band/.26);
  const hub=nodeFor(c,'Bones','Bone','ring',l.label+' ring',centre,c.parent);hub.Flags=256;delete hub.Translation;delete hub.Scaling;
  if(card.spin){const ms=Math.max(100,Math.round(base/Math.abs(card.spin))),sign=Math.sign(card.spin);hub.Rotation=keys(clockFor(m,ms,c.createdClocks),ms,LINEAR_TURN.map((a,j)=>[j/(LINEAR_TURN.length-1),turn(axis,j===LINEAR_TURN.length-1?0:a*sign)]));}else delete hub.Rotation;
  for(let i=0;i<card.count;i++,k++){
   const angle=2*Math.PI*(i/card.count+(l.phase||0)),point=centre.clone().addScaledVector(e1,Math.cos(angle)*radius).addScaledVector(e2,Math.sin(angle)*radius);
   const bone=nodeFor(c,'Bones','Bone','card0-'+i,l.label+' '+(k+1),point,hub.ObjectId);bone.Flags=256|8;delete bone.Rotation;
   const factor=CARD_CLOCK_FACTORS[k%CARD_CLOCK_FACTORS.length],ms=Math.round(base*.4*factor),[a,b]=k%2?[card.sizeMax,card.sizeMin]:[card.sizeMin,card.sizeMax];
   bone.Translation=keys(clockFor(m,ms,c.createdClocks),ms,[[0,0],[.25,1],[.5,0],[.75,-1],[1,0]].map(([t,s])=>[t,axis.clone().multiplyScalar(half*.45*s*(k%2?-1:1)).toArray()]),3);
   if(card.sizeMin!==1||card.sizeMax!==1){const pulse=Math.round(base*.31*factor);bone.Scaling=keys(clockFor(m,pulse,c.createdClocks),pulse,[[0,[a,a,a]],[.5,[b,b,b]],[1,[a,a,a]]],3);}else delete bone.Scaling;
   const area=l.atlasRect?.length===4?l.atlasRect:[0,0,1,1],first=vertices.length/3;
   for(const [s,t] of [[-1,-1],[1,-1],[1,1],[-1,1]]){vertices.push(point.x,point.y+s*half,point.z+t*half);normals.push(1,0,0);vertexGroup.push(groups.length);}
   uvs.push(area[0],area[1]+area[3],area[0]+area[2],area[1]+area[3],area[0]+area[2],area[1],area[0],area[1]);
   faces.push(first,first+1,first+2,first,first+2,first+3);
   groups.push([bone.ObjectId]);centres.push(point);
  }
  widest=half*1.5;
 }else if(twirl){
  wound=twirlStrands(c,l,card,size,{vertices,normals,uvs,faces,groups,vertexGroup,centres});widest=wound.reach;
  const bone=wound.bone;
  if(card.sizeMin!==1||card.sizeMax!==1)bone.Scaling=keys(clockFor(m,base,c.createdClocks),base,[[0,[card.sizeMin,card.sizeMin,card.sizeMin]],[.5,[card.sizeMax,card.sizeMax,card.sizeMax]],[1,[card.sizeMin,card.sizeMin,card.sizeMin]]],3);else delete bone.Scaling;
  if(card.spin){const ms=Math.max(100,Math.round(base/Math.abs(card.spin))),sign=Math.sign(card.spin);bone.Rotation=keys(clockFor(m,ms,c.createdClocks),ms,LINEAR_TURN.map((a,j)=>[j/(LINEAR_TURN.length-1),turn(wound.axis,j===LINEAR_TURN.length-1?0:a*sign)]));}else delete bone.Rotation;
 }else for(const [r,region] of regions.entries())for(let i=0,count=shares?shares[r]:card.count;i<count;i++,k++){
  const f=region?.frame,along=!f?0:(count===1?0:((i+.5)/count-.5)*f.length*(level?.6:.9))+f.length*(l.along||0);
  const half=level&&l.reach!=null?Math.max(.1,level.radiusAt(along/f.length)*l.reach*.82):seatHalf;widest=Math.max(widest,half);
  const point=seat?new Vector3(...seat.point).addScaledVector(seatAxis,count===1?0:((i+.5)/count-.5)*half*1.6):region?f.at(along):new Vector3(0,0,1.5);point.add(new Vector3(...l.offset));
  const parent=region?regionParent(c,region,point,'card-'+r+'-'+i):null;
  const bone=nodeFor(c,'Bones','Bone','card'+r+'-'+i,l.label+' '+(k+1),point,parent);
  // Camera cards face +X on a billboarded bone; ground cards lie flat; part cards turn with the part.
  bone.Flags=256|(card.facing==='camera'?8:0);
  let side,up,normal,spinAxis=null;
  if(card.facing==='camera'){side=new Vector3(0,1,0);up=new Vector3(0,0,1);}
  else if(card.facing==='ground'){side=new Vector3(1,0,0);up=new Vector3(0,1,0);}
  else if(card.facing==='across'){
   const axis=seat?seatAxis.clone():f.axis.clone().normalize();side=new Vector3().crossVectors(axis,Math.abs(axis.z)<.9?z:y).normalize();up=new Vector3().crossVectors(axis,side);
   // tilt: the card leans out of its plane, each the other way from its neighbour, and Spin turns it about the part:
   // a ring that shows from every side. Around a body the lean is slight.
   if(card.tilt>0){const lean=(k%2?-1:1)*card.tilt*(level?.4:1)*Math.PI/180;up.multiplyScalar(Math.cos(lean)).addScaledVector(axis,Math.sin(lean)).normalize();spinAxis=axis;}
  }
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
   bone.Rotation=keys(clockFor(m,ms,c.createdClocks),ms,angles.map((a,j)=>[j/(angles.length-1),turn(spinAxis||normal,j===angles.length-1?0:a*sign)]));
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
  // atlasRect (fresh recipes): the card shows one area of its picture.
  const cell=((flipbook?card.cell+k*3:card.cell)%cells+cells)%cells,area=!flipbook&&l.atlasRect?.length===4?l.atlasRect:null,u0=area?area[0]:(cell%card.columns)/card.columns,v0=area?area[1]:Math.floor(cell/card.columns)/card.rows,du=area?area[2]:1/card.columns,dv=area?area[3]:1/card.rows;
  const first=vertices.length/3;
  for(const [s,t] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
   vertices.push(...point.clone().addScaledVector(side,s*half).addScaledVector(up,t*half).toArray());normals.push(...normal.toArray());vertexGroup.push(groups.length);
  }
  uvs.push(u0,v0+dv,u0+du,v0+dv,u0+du,v0,u0,v0);
  faces.push(first,first+1,first+2,first,first+2,first+3);
  groups.push([holder.ObjectId]);centres.push(point);
 }
 const tex=l.team?teamTexture(m,l.team,tag,twirl):texture(m,l.image,flipbook||twirl,tag);
 const shape=l.pulse==null||l.pulse==='steady'||COLOUR_RHYTHMS[l.pulse]?null:curves[l.pulse]||null,curveType=l.pulse==='soft'?3:1;
 const alphaFor=value=>shape?keys(id,base,shape.map(([t,a])=>[t,a*value]),curveType):value;
 const layer={TextureID:tex,CoordId:0,TVertexAnimId:null,FilterMode:card.filter,Shading:(card.unshaded?1:0)|(card.twoSided?16:0)|(card.unfogged?32:0),Alpha:alphaFor(1)};
 if(flipbook){
  // Flipbook: step through the atlas cells, one cell per frame time, holding each (no blending between cells).
  const ms=cells*Math.max(10,Math.round(card.frameMs));
  layer.TVertexAnimId=resource(m.TextureAnims,tag+'/flipbook',{Translation:keys(clockFor(m,ms,c.createdClocks),ms,[...Array.from({length:cells},(_,j)=>[j/cells,[(j%card.columns)/card.columns,Math.floor(j/card.columns)/card.rows,0]]),[1,[0,0,0]]],0)});
 }
 // flow (twirl): the picture runs along the strands, whole passes per loop so it closes.
 // (The team glow is one round light: it is drawn once along each strand, through its middle, and does not flow.)
 if(twirl&&card.flow&&!l.team){const pass=passClock({...c,id,ms:base},Math.abs(card.flow));layer.TVertexAnimId=resource(m.TextureAnims,tag+'/flow',{Translation:keys(pass.id,pass.ms,[[0,[0,0,0]],[1,[-Math.sign(card.flow)*pass.turns,0,0]]])});}
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:strengthPasses([layer],card.strength,false,alphaFor)});
 const reach=widest*Math.SQRT2*Math.max(1,card.sizeMax);
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
 // square (fresh recipes): the swarm carries a square picture (an orb, a rune), not the native fly diamond.
 const picture=l.square?squarePicture(l.atlasRect):flyPicture(l.image,l.pictureOverride);
 const vertices=[],normals=[],uvs=[],faces=[],groups=[],vertexGroup=[],points=[];
 let widest=0;
 for(let k=0;k<count;k++){
  // flock (fresh recipes): which set of paths the swarm starts with.
  const s=Math.floor(k/5)+(l.flock||0),p=k%5,set=FLY_SETS[s%FLY_SETS.length],yaw=set.yaw*Math.PI/180,cos=Math.cos(yaw),sin=Math.sin(yaw);
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
 // team (fresh recipes): the swarm carries the player's glow.
 const layer={TextureID:l.team?teamTexture(m,l.team,tag):texture(m,l.image,false,tag),CoordId:0,TVertexAnimId:null,FilterMode:l.square?l.filter??1:1,Shading:l.square&&l.unshaded?49:16,Alpha:Math.max(0,Math.min(1,l.strength??1))};
 if(l.riseOnDeath){
  const motion=[],visibility=[];
  // A local Z translation is turned downward by a falling parent in native playback.
  // Keep the centre following that parent, but write its rise in model space.
  const parent=swarm.Parent;swarm.Parent=null;
  const nodes=nodeIndex(m);
  for(const [sequence,clip] of m.Sequences.entries()){
   const [start,end]=clip.Interval,death=/^death\b/i.test(clip.Name),time=Math.min(1,(end-start)/2170);
   visibility.push([start,layer.Alpha],[end,death?0:layer.Alpha]);
   if(death)visibility.push([start+Math.round(1900*time),0]);
   const first=start+Math.round(1000*time),last=start+Math.round(2170*time);
   const value=frame=>{const key=sequence+':'+frame,matrices=sampleSomeNodeMatrices(m,[parent],frame,sequence,frame,c.attachmentCache.get(key),nodes);c.attachmentCache.set(key,matrices);const at=centre.clone(),matrix=matrices.get(parent);if(matrix)at.applyMatrix4(matrix);at.sub(centre);if(death)at.z+=tall*(frame<=first?.6*(frame-start)/Math.max(1,first-start):.6+1.9*Math.min(1,(frame-first)/Math.max(1,last-first)));return at;};
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
/**
 * Growth layer (pass 8). The owner, 14 November: "many small crystals (actual geosets) added to the unit with sliders to
 * adjust the spikes - make sure they always attach to the geoset properly - e.g no gaps from skin to geoset." This is the
 * one layer that makes new solid geometry, on that explicit request.
 * Pieces are spread over the part's surface by area, from a seed, so the same layer always grows the same way. Every piece
 * is bound to the very bones of the skin it stands on (the matrix group of the nearest corner of its triangle), so it
 * moves exactly as that spot of skin moves; and its foot starts under the surface, so no gap can open between them.
 * shape 'crystal': a faceted spike (a shaft and a point), flat-shaded. shape 'leaf': a two-sided card of one cell of a
 * leaf picture, its stem in the skin, lying along the surface (the owner's Demigod Cenarius).
 */
function growthLayer(c,l){
 const {model:m,source,tag}=c,v=source.Vertices,faces=source.Faces,normalsIn=source.Normals;
 const count=Math.max(1,Math.min(400,Math.round(l.count??24))),size=Math.max(.05,l.size||1),long=Math.max(.1,l.long??2.2);
 const spread=Math.max(0,Math.min(1,l.spread??.35)),variety=Math.max(0,Math.min(1,l.variety??.5)),leaf=l.shape==='leaf';
 const next=shake(1000+Math.round(l.seed??1)*7919);
 const P=i=>new Vector3(v[i*3],v[i*3+1],v[i*3+2]),N=i=>normalsIn?.length===v.length?new Vector3(normalsIn[i*3],normalsIn[i*3+1],normalsIn[i*3+2]):null;
 // Triangles by area; places are taken at even steps of the total area, so the pieces cover the part evenly.
 const areas=[];let total=0;
 for(let f=0;f<faces.length;f+=3){const a=P(faces[f]),b=P(faces[f+1]),d=P(faces[f+2]);const area=b.sub(a).cross(d.sub(a)).length()/2;total+=area;areas.push(total);}
 const vertices=[],normals=[],uvs=[],out=[],vertexGroup=[],groups=[],groupOf=new Map(),tips=[];
 const bind=vertex=>{const from=source.VertexGroup?.[vertex]??0;if(!groupOf.has(from)){groupOf.set(from,groups.length);groups.push([...(source.Groups?.[from]||[c.parent])]);}return groupOf.get(from);};
 const cells=leaf?Math.max(1,Math.round(l.atlas??1)):1;
 const push=(point,normal,u,w,group)=>{vertices.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);uvs.push(u,w);vertexGroup.push(group);return vertices.length/3-1;};
 let widest=0;
 if(total>0)for(let i=0;i<count;i++){
  const want=(i+next())/count*total;let lo=0,hi=areas.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<want)lo=mid+1;else hi=mid;}
  const f=lo*3,ids=[faces[f],faces[f+1],faces[f+2]],a=P(ids[0]),b=P(ids[1]),d=P(ids[2]);
  let r1=next(),r2=next();if(r1+r2>1){r1=1-r1;r2=1-r2;}
  const weights=[1-r1-r2,r1,r2],at=a.clone().multiplyScalar(weights[0]).addScaledVector(b,weights[1]).addScaledVector(d,weights[2]);
  const flat=b.clone().sub(a).cross(d.clone().sub(a)).normalize(),corner=N(ids[0]);
  const normal=corner?corner.multiplyScalar(weights[0]).addScaledVector(N(ids[1]),weights[1]).addScaledVector(N(ids[2]),weights[2]):flat.clone();
  if(normal.lengthSq()<1e-8)normal.copy(flat);normal.normalize();
  // Straight out of the face it stands on, on the side the skin's own normals point to: on a thin blade the smoothed
  // vertex normals point along the blade's width, not out of its faces.
  if(flat.lengthSq()>.5)normal.multiplyScalar(.3).addScaledVector(flat,flat.dot(normal)<0?-.7:.7).normalize();
  const group=bind(ids[weights.indexOf(Math.max(...weights))]);
  // A direction along the surface, from the seed.
  const any=new Vector3(next()*2-1,next()*2-1,next()*2-1),along=any.addScaledVector(normal,-any.dot(normal));
  if(along.lengthSq()<1e-6)along.copy(b).sub(a);along.normalize();
  const scale=1-variety*.7*next(),width=size*scale;
  if(leaf){
   // The leaf hangs: its direction leans toward the ground along the surface. Spread lifts it off the surface.
   const down=new Vector3(0,0,-1).addScaledVector(normal,normal.z);if(down.lengthSq()>1e-4)along.addScaledVector(down.normalize(),1.2).normalize();
   const lift=(spread*.9+.08*next())*Math.PI/2,reach=along.clone().multiplyScalar(Math.cos(lift)).addScaledVector(normal,Math.sin(lift)).normalize();
   const across=new Vector3().crossVectors(normal,along).normalize().multiplyScalar(width*.5),face=new Vector3().crossVectors(across,reach).normalize();
   const foot=at.clone().addScaledVector(normal,-width*.08),end=foot.clone().addScaledVector(reach,width*long);
   const cell=Math.floor(next()*cells*cells)%(cells*cells),u0=(cell%cells)/cells,v0=Math.floor(cell/cells)/cells,du=1/cells;
   const q=[push(foot.clone().sub(across),face,u0,v0+du,group),push(foot.clone().add(across),face,u0+du,v0+du,group),push(end.clone().add(across),face,u0+du,v0,group),push(end.clone().sub(across),face,u0,v0,group)];
   out.push(q[0],q[1],q[2],q[0],q[2],q[3]);tips.push(end.toArray());widest=Math.max(widest,width);
   continue;
  }
  // Crystal: a spike of 3 to 5 sides. Spread leans it away from straight out; every second one is a smaller companion
  // leaning further, so crystals stand in clusters like grown ones.
  const companion=i%2===1,lean=spread*(companion?1.5:.8)*(.4+.6*next());
  const dir=normal.clone().addScaledVector(along,lean).normalize(),radius=width*.5*(companion?.7:1),height=width*long*(companion?.65:1)*(1-variety*.4*next());
  const sides=3+Math.floor(next()*3),side=new Vector3().crossVectors(dir,along).normalize(),front=new Vector3().crossVectors(side,dir).normalize();
  const ring=(distance,r)=>Array.from({length:sides},(_,s)=>{const angle=2*Math.PI*(s+.5*(i%2))/sides;return at.clone().addScaledVector(dir,distance).addScaledVector(side,Math.cos(angle)*r).addScaledVector(front,Math.sin(angle)*r);});
  // The foot starts under the skin, by most of the crystal's own radius.
  const foot=ring(-radius*.8,radius),shoulder=ring(height*.62,radius*.82),tip=at.clone().addScaledVector(dir,height);
  const u0=next()*.7,v0=next()*.6,span=.3;
  for(let s=0;s<sides;s++){
   const t=(s+1)%sides,faceNormal=shoulder[s].clone().sub(foot[s]).cross(foot[t].clone().sub(foot[s])).normalize();
   if(faceNormal.dot(foot[s].clone().add(foot[t]).multiplyScalar(.5).sub(at))<0)faceNormal.negate();
   const ua=u0+span*s/sides,ub=u0+span*(s+1)/sides;
   const q=[push(foot[s],faceNormal,ua,v0+span,group),push(foot[t],faceNormal,ub,v0+span,group),push(shoulder[t],faceNormal,ub,v0+span*.38,group),push(shoulder[s],faceNormal,ua,v0+span*.38,group)];
   out.push(q[0],q[1],q[2],q[0],q[2],q[3]);
   const pointNormal=tip.clone().sub(shoulder[s]).cross(shoulder[t].clone().sub(shoulder[s])).normalize();
   if(pointNormal.dot(shoulder[s].clone().add(shoulder[t]).multiplyScalar(.5).sub(at.clone().addScaledVector(dir,height*.62)))<0)pointNormal.negate();
   const p=[push(shoulder[s],pointNormal,ua,v0+span*.38,group),push(shoulder[t],pointNormal,ub,v0+span*.38,group),push(tip,pointNormal,(ua+ub)/2,v0,group)];
   out.push(p[0],p[1],p[2]);
  }
  tips.push(tip.toArray());widest=Math.max(widest,radius);
 }
 if(!tips.length)tips.push(c.frame.center.toArray());
 const base=l.loop!=null?Math.max(100,Math.round(l.loop)):c.ms,clock=l.loop!=null?clockFor(m,base,c.createdClocks):c.id;
 const texId=l.team?teamTexture(m,l.team,tag):texture(m,l.image,!leaf,tag);
 // One solid layer; Glow adds the same picture as light over it, and the layer's rhythm moves that light.
 const solid={TextureID:texId,CoordId:0,TVertexAnimId:null,FilterMode:l.filter??(leaf?1:0),Shading:(l.unshaded?1:0)|16,Alpha:1};
 const passes=strengthPasses([solid],l.strength??1);
 const glow=Math.max(0,Math.min(1,l.glow??0));
 if(glow>0){
  const shape=l.pulse==null||l.pulse==='steady'||COLOUR_RHYTHMS[l.pulse]?null:curves[l.pulse]||null;
  const light=l.team?texture(m,l.glowImage||'Textures\\CrystalOpaque.blp',true,tag):texId;
  passes.push({TextureID:light,CoordId:0,TVertexAnimId:null,FilterMode:3,Shading:1|16|32,Alpha:shape?keys(clock,base,shape.map(([t,a])=>[t,a*glow]),l.pulse==='soft'?3:1):glow});
 }
 const material=resource(m.Materials,tag+'/material',{PriorityPlane:0,RenderMode:0,Layers:passes});
 const g={Vertices:Float32Array.from(vertices),Normals:Float32Array.from(normals),TVertices:[Float32Array.from(uvs)],Faces:Uint16Array.from(out),VertexGroup:Uint8Array.from(vertexGroup),Groups:groups.length?groups:[[c.parent]],TotalGroupsCount:Math.max(1,groups.length),MaterialID:material,SelectionGroup:0,Unselectable:false,Anims:[]};
 if(m.Version>=900)g.LevelOfDetail=0;
 quadBounds(c,g,tips,widest+size);
 return {geoset:overlay(c,g,material,rhythmColour({...c,id:clock,ms:base},l,l.tint),m.GeosetAnims.find(a=>a.GeosetId===c.index),0)};
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
const CARRIED_RATIOS=['ParticleScaling','Speed','Gravity','Width','Length','LifeSpan','TailLength'];
/**
 * A stack taken to another part of the same model (frame: the part it is on, targetFrame: the part it goes to).
 * stackForPart refits it. Whole-layer slider edits are stored per emitter, so they travel separately: a size, speed
 * or time as its ratio to what the layer makes without the edit (fieldScale), a colour, opacity or angle as itself.
 */
// What a look fits to the whole part, not to one emitter: a ribbon's ring and width, a swarm's radius, how many drops fall.
const RECIPE_FITTED=layer=>layer.type==='Growth'?['size']:layer.type==='Edge'?['orbitRadius','upper','lower']:layer.swarm?['size']:layer.kind==='drops'?['amount']:[];
/**
 * A layer the look made follows the look's own rules to the new part: the value the look gives there, times how far the
 * user had moved it from the value the look gave on the old part. An untouched layer is exactly the fresh one. (The
 * ratios of stackForPart alone gave a ribbon carried from a small part a width several times the look's.)
 */
function refitFromRecipe(stack,next,from,to){
 const look=findLook(stack.look);if(!look||stack.impact)return;
 const variation=look.variations?.find(v=>v.id===currentVariation(stack,look));
 for(const layer of stack.layers){
  const target=next.layers.find(item=>item.id===layer.id),fields=RECIPE_FITTED(layer);
  if(!target||!fields.length||layer.recipeOwner!==look.id)continue;
  const same=s=>s.type===layer.type&&s.label===layer.label&&s.kind===layer.kind;
  const spec=variation?.layers.find(same)||[layerIngredient(look,layer)].find(s=>s&&same(s));
  if(!spec)continue;
  const was=makeLayer(spec,from,look.palette,layer.id),now=makeLayer(spec,to,look.palette,layer.id);
  for(const key of fields){
   const a=was[key],b=now[key],old=layer[key];
   if(typeof a==='number'&&typeof b==='number'&&typeof old==='number')target[key]=Math.abs(a)>1e-9?b*old/a:b;
  }
  if(layer.kind==='drops'&&now.surfaceFit&&target.surfaceFit&&!target.siteLayout)target.surfaceFit={...now.surfaceFit,...(target.surfaceFit.siteCount!=null?{siteCount:target.surfaceFit.siteCount}:{})};
 }
}
export function carryAnimationStack(model,index,stack,frame,targetFrame,owner,options){
 const next=stackForPart(stack,frame,targetFrame,owner);
 refitFromRecipe(stack,next,frame,targetFrame);
 const edits=layer=>layer.enabled!==false&&layer.type==='Particles'&&!layer.swarm&&!layer.impact?[...new Set(Object.values(layer.individuals||{}).flatMap(record=>record.deleted?[]:record.groupFields||[]))].filter(field=>field!=='EmissionRate'&&field!=='Rotation'):[];
 if(!stack.layers.some(layer=>edits(layer).length))return next;
 const compiled=draft=>{const copy=structuredClone(model);return {model:copy,layers:compileAnimation(copy,index,draft,options).layers};};
 const plain=layer=>{
  const individuals=structuredClone(layer.individuals);
  for(const record of Object.values(individuals)){
   for(const field of record.groupFields||[]){if(record.values?.native)delete record.values.native[field];if(field==='Alpha'&&record.values){delete record.values.opacityBase;delete record.values.particleStrength;}}
   delete record.groupFields;
  }
  return {...layer,individuals};
 };
 const now=compiled(stack),base=compiled({...stack,layers:stack.layers.map(layer=>edits(layer).length?plain(layer):layer)});
 const read=(result,layer,key,field)=>{const value=result.model.Nodes[result.layers[layer.id]?.siteIds?.[key]]?.[field];return typeof value==='number'?value:ArrayBuffer.isView(value)?Array.from(value):Array.isArray(value)&&value.every(ArrayBuffer.isView)?value.map(v=>Array.from(v)):undefined;};
 for(const layer of stack.layers){
  const target=next.layers.find(item=>item.id===layer.id);
  for(const field of edits(layer)){
   const pairs=Object.entries(layer.individuals).filter(([,record])=>!record.deleted&&record.groupFields?.includes(field)).map(([key])=>[read(now,layer,key,field),read(base,layer,key,field)]).filter(([a,b])=>a!==undefined&&b!==undefined);
   if(!pairs.length)continue;
   if(!CARRIED_RATIOS.includes(field)){target.native={...target.native,[field]:pairs[0][0]};continue;}
   const parts=Array.isArray(pairs[0][0])?pairs[0][0].length:0,old=layer.fieldScale?.[field];
   const mean=i=>{const ratios=pairs.map(([a,b])=>parts?[a[i],b[i]]:[a,b]).filter(([,b])=>Math.abs(b)>1e-6).map(([a,b])=>a/b);return ratios.length?ratios.reduce((sum,v)=>sum+v,0)/ratios.length:1;};
   const before=i=>Array.isArray(old)?old[i]??1:old??1;
   target.fieldScale={...target.fieldScale,[field]:parts?Array.from({length:parts},(_,i)=>mean(i)*before(i)):mean(0)*before(0)};
  }
 }
 return next;
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
  const own=l.loop!=null&&!draft.impact&&(surfaceIngredient(l)||l.type==='Edge'||l.type==='Growth'||!!l.nativeSpec)?Math.max(100,Math.round(l.loop)):null;
  const tag=owner+'/'+l.id,context={sites:sites[l.id]=[],model,source:surface,index,base,frame,parent:effectAnchor(model,surface),id:own?clockFor(model,own,created):id,ms:own??ms,tag,used,rune,prior,recipeChanged,state,createdClocks:created,stack:draft,attachmentCache,surfaceKey,sameGroup,sameClock:before?.loop===ms&&prior?.loop===l.loop};
  context.autoSites=defaultSurfaceSites(context,l);
  context.siteLayout=l.ride?undefined:completeEmitterSiteLayout(context,l);
  context.activeSites=activeEmitterSites(l,context.siteLayout||context.autoSites||[]);
  const saved=state.layers.find(item=>item.id===l.id);
  if(context.siteLayout!==l.siteLayout)saved.siteLayout=context.siteLayout;
  if(Array.isArray(l.activeSiteKeys)&&context.activeSites)saved.activeSiteKeys=[...context.activeSites];
  if(l.nativeSpec&&!l.impact)siteRateScales[l.id]=nativeEmitterBudget(context,l);
  // Retain edits made in the normal material, node or emitter managers for untouched layers.
  if(!recipeChanged&&!l.ride&&!l.placement&&l.siteCount==null&&before?.look===draft.look&&sameGroup&&(!draft.impact||JSON.stringify(before?.contact)===JSON.stringify(draft.contact))&&ms===before?.loop&&before?.sequence===draft.sequence&&before?.hit===draft.hit&&sameLayerForRetention(prior,l)){
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
  else if(l.type==='Growth')growthLayer(context,l);
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
 // Pictures the effect added are named by their .blp path, never .dds (also looks saved before this rule).
 for(const t of model.Textures)if(t._FxTag&&!t.ReplaceableId&&t.Image)t.Image=effectPicturePath(t.Image);
 return {geoset:model.Geosets.indexOf(source),layers:results,frame};
}
