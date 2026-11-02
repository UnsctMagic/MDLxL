import {Vector3} from 'three';
import {isGlobalTrack,keysInInterval} from './animation.js';
import {indexedSurfaceIslands} from './geoset-operations.js';
import {createNode,geosetBounds} from './editor-document.js';
import {copyEffectGraph,emptyParticleModel} from './particle-recipes.js';
import {vertexBones} from './part-bones.js';
import {fitRibbonToPolygons,weaponStripFrame} from './particle-ribbon-fit.js';
import {constantTrack} from './plain-track-values.js';
import {gamePathKey} from './game-path.js';

const vec=Float32Array.from.bind(Float32Array);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const identityPlacement=()=>({offset:[0,0,0],size:1});
export {identityPlacement};
const cueNames={attack:/^(attack|spell)/i,death:/^death/i,birth:/^(birth|spawn|morph)/i};
export function effectSequence(model,effect,current=0){
  const preferred=effect.cue?model.Sequences.findIndex(s=>cueNames[effect.cue].test(s.Name)):-1;
  return preferred>=0?preferred:model.Sequences[current]?current:model.Sequences.length?0:-1;
}
function nativeTexture(source,target,image,wrap=false){
  const samePath=t=>!t.ReplaceableId&&gamePathKey(t.Image)===gamePathKey(image);
  const flags=target.Textures.find(t=>samePath(t)&&(!wrap||(t.Flags&3)===3))?.Flags??(wrap?3:0);
  const index=source.Textures.findIndex(t=>samePath(t)&&t.Flags===flags);
  return index>=0?index:source.Textures.push({Image:image,ReplaceableId:0,Flags:flags})-1;
}
function teamTexture(source){
  const id=source.Textures.findIndex(t=>t.ReplaceableId===2&&!t.Image);
  return id>=0?id:source.Textures.push({Image:'',ReplaceableId:2,Flags:0})-1;
}
function clock(model,ms){
  const duration=Math.max(1,Math.round(ms)),i=model.GlobalSequences.indexOf(duration);
  return i>=0?i:model.GlobalSequences.push(duration)-1;
}
function track(pairs,start,length,id,step=1,other=[]){
  const frames=new Map(other);
  for(const [fraction,value] of pairs)frames.set(start+Math.round(fraction*length),Array.isArray(value)?value:[value]);
  return {LineType:step,GlobalSeqId:id,Keys:[...frames].sort(([a],[b])=>a-b).map(([Frame,value])=>({Frame,Vector:vec(value)}))};
}
// A cue is dark in every other clip, including Death/Decay. A static model can
// still preview and save the appearance using an ordinary global clock.
function timedTrack(source,target,effect,options,pairs,ms,step=1){
  const interval=effect.cue&&target.Sequences[options.sequence]?.Interval;
  if(interval){
    const off=target.Sequences.flatMap(s=>Array.from(s.Interval,f=>[f,[0]]));
    return track(pairs,interval[0],interval[1]-interval[0],null,step,off);
  }
  return track(pairs,0,Math.round(ms),clock(source,ms),step);
}
export function cueColour(model,index,base,tint){
  const [start,end]=model.Sequences[index].Interval,normal=Array.from(base);
  const outside=model.Sequences.flatMap(s=>Array.from(s.Interval,f=>[f,normal]));
  return track([[0,normal],[.155,normal],[.185,tint],[.28,tint],[.55,normal],[1,normal]],start,end-start,null,1,outside);
}
// The length of a hook and its detached teeth each receive a whole pass of the
// highlight. Sampling the narrow centre of the mask keeps the core on the metal.
export function streakCoordinates(geometry,effect){
  const uv=geometry.TVertices[0].slice(),vertical=effect.axis==='v';
  for(const ids of indexedSurfaceIslands(geometry)){
    const points=ids.map(id=>Array.from(geometry.Vertices.subarray(id*3,id*3+3)));
    const frame=weaponStripFrame(points);if(!frame)continue;
    const {axis,center,length}=frame;
    const offsets=points.map(p=>new Vector3(...p).sub(center));
    const transverse=offsets.map(p=>p.clone().addScaledVector(axis,-p.dot(axis)));
    const side=transverse.reduce((a,b)=>a.lengthSq()>=b.lengthSq()?a:b).clone().normalize();
    let min=Infinity,max=-Infinity;const widths=transverse.map(p=>{const w=p.dot(side);min=Math.min(min,w);max=Math.max(max,w);return w;});
    ids.forEach((id,i)=>{
      const along=.5+offsets[i].dot(axis)/length;
      const across=.5+(max>min?(widths[i]-min)/(max-min)-.5:0)*(effect.band??.65);
      uv[2*id]=vertical?across:along;uv[2*id+1]=vertical?along:across;
    });
  }
  return uv;
}
export function visualMaterial(target,effect,options){
  const pack=emptyParticleModel(target.Version);
  const specs=effect.undercoat && options.mode!=='overlay'?[effect.undercoat,...effect.layers]:effect.layers;
  const layers=specs.map(spec=>{
    const duration=Math.max(1,Math.round(effect.duration*(spec.period??1)/options.speed));
    const layer={TextureID:spec.team?teamTexture(pack):nativeTexture(pack,target,spec.texture,!!spec.scroll),CoordId:0,TVertexAnimId:null,
      FilterMode:spec.filter??3,Shading:17,Alpha:spec.strength};
    if(spec.sheet){
      const last=spec.sheet**2,frames=Array.from({length:last+1},(_,i)=>[i/last,[(i%last)%spec.sheet/spec.sheet,Math.floor((i%last)/spec.sheet)/spec.sheet,0]]);
      layer.TVertexAnimId=pack.TextureAnims.push({Translation:track(frames,0,duration,clock(pack,duration),0)})-1;
    }else if(spec.spin){
      // The fitted UVs are centred on zero. A constant half-tile translation
      // keeps the sigil turning about its centre at every interpolated angle.
      const turns=Array.from({length:9},(_,i)=>{const a=Math.PI*spec.spin*i/8;return [i/8,[0,0,Math.sin(a),Math.cos(a)]];});
      layer.TVertexAnimId=pack.TextureAnims.push({Rotation:track(turns,0,duration,clock(pack,duration)),Translation:constantTrack(target,[.5,.5,0])})-1;
    }else if(spec.scroll){
      layer.TVertexAnimId=pack.TextureAnims.push({Translation:track([[0,[0,0,0]],[1,[...spec.scroll,0]]],0,duration,clock(pack,duration))})-1;
    }
    if(spec.light)layer.Alpha=timedTrack(pack,target,effect,options,spec.light.map(([t,a])=>[t,a*spec.strength]),duration);
    return layer;
  });
  pack.Materials.push({PriorityPlane:0,RenderMode:0,Layers:layers});return pack;
}
function accentFrame(model,geometry,parent,ground){
  const box=geosetBounds(geometry.Vertices),span=Array.from(box.MaximumExtent,(v,i)=>v-box.MinimumExtent[i]);
  const radius=clamp(Math.max(...span)*.48,15,55);
  if(ground){
    const ref=model.Attachments.find(a=>/^origin\s*ref/i.test(a.Name));
    const origin=Array.from(ref?.PivotPoint||[0,0,0]);origin[2]+=1.5;
    return {origin,radius:clamp(Math.max(...span)*.8,33,68)};
  }
  // Paired shoulders and boots often share a geoset. Their combined centre
  // is inside the body. Use a real exterior vertex carried by the chosen bone.
  const points=[];
  for(let i=0;i<geometry.Vertices.length/3;i++)if(parent==null||vertexBones(geometry,i).includes(parent))points.push(geometry.Vertices.subarray(i*3,i*3+3));
  if(!points.length)return {origin:span.map((v,i)=>box.MinimumExtent[i]+v/2),radius};
  const mid=[0,0,0];for(const p of points)for(let i=0;i<3;i++)mid[i]+=p[i]/points.length;
  const radial=Math.hypot(mid[0],mid[1])||1,normal=[mid[0]/radial,mid[1]/radial,.35];
  const target=mid.map((v,i)=>v+normal[i]*radius*.48);
  const distance=p=>(p[0]-target[0])**2+(p[1]-target[1])**2+(p[2]-target[2])**2;
  const outside=points.reduce((a,b)=>distance(a)<=distance(b)?a:b);
  return {origin:Array.from(outside,(v,i)=>v+normal[i]*radius*.12),radius};
}
function orbit(source,spec,radius,duration){
  const points=Array.from({length:17},(_,i)=>{
    const angle=2*Math.PI*(i/16+(spec.phase||0));
    return [i/16,[Math.cos(angle)*radius*spec.orbit,Math.sin(angle)*radius*spec.orbit,Math.sin(2*angle)*radius*.1]];
  });
  points.at(-1)[1]=points[0][1];
  return track(points,0,duration,clock(source,duration));
}
export function addParticles(source,target,spec,effect,options,radius){
  const p=createNode(source,'ParticleEmitter2'),speed=options.speed,life=spec.life/speed;
  p.TextureID=spec.team?teamTexture(source):nativeTexture(source,target,spec.texture);
  p.Flags|=32768|(spec.flat?1048576:0);
  Object.assign(p,{Squirt:false,LifeSpan:life,FilterMode:spec.filter??1,Time:.43,Width:(spec.area??0)*radius,Length:(spec.area??0)*radius,
    Speed:(spec.velocity??0)*radius*speed,Gravity:(spec.gravity??0)*radius*speed*speed,Latitude:spec.spread??0,
    Variation:spec.velocity ? .22 : 0,ParticleScaling:vec(spec.size.map(v=>v*radius)),Alpha:Uint8Array.from(spec.alpha||[235,180,0],v=>Math.round(v*options.opacity)),
    EmissionRate:(spec.rate??8)*options.density*speed,FrameFlags:spec.tail?3:1,TailLength:(spec.tail||0)/speed});
  const tint=spec.team?[1,1,1]:options.tint;
  p.SegmentColor=[vec(tint.map(v=>Math.min(1,v*1.17+.025))),vec(tint),vec(tint.map(v=>v*.56))];
  if(spec.atlas){
    const end=spec.atlas**2-1;
    p.Rows=p.Columns=spec.atlas;
    p.LifeSpanUVAnim=new Uint32Array([0,Math.floor(end*.45),1]);p.DecayUVAnim=new Uint32Array([Math.floor(end*.45)+1,end,1]);
  }
  const duration=Math.max(1,Math.round(effect.duration/speed));
  if(spec.burst){
    const t=.185+(spec.delay||0),count=Math.max(1,Math.round(spec.burst*options.density));
    p.Squirt=true;
    p.EmissionRate=timedTrack(source,target,effect,options,[[0,0],[t,count],[1,0]],duration,0);
  }
  if(spec.orbit)p.Translation=orbit(source,spec,radius,duration);
  return p;
}
function addRibbon(source,target,spec,options,radius){
  const texture=nativeTexture(source,target,spec.texture);
  source.Materials.push({PriorityPlane:0,RenderMode:0,Layers:[{FilterMode:spec.blend,Shading:17,TextureID:texture,CoordId:0,TVertexAnimId:null,Alpha:1}]});
  const p=createNode(source,'RibbonEmitter');
  Object.assign(p,{MaterialID:source.Materials.length-1,HeightAbove:spec.width*radius,HeightBelow:spec.width*radius,
    LifeSpan:spec.life/options.speed,EmissionRate:48,Alpha:spec.alpha*options.opacity,Color:vec(options.tint),Visibility:1});
  return p;
}
// This small patch is also used by the shared EMTR handles during a drag. The
// model, material resources and renderer stay alive until the gesture ends.
export function positionedAccents(rest,origin,placement){
  const {offset,size}=placement,patch={ParticleEmitters2:[],RibbonEmitters:[],EventObjects:[]};
  for(const [family,nodes] of Object.entries(rest))for(const base of nodes){
    const node={...base,PivotPoint:vec(base.PivotPoint.map((v,i)=>origin[i]+(v-origin[i])*size+offset[i]))};
    if(node.Translation)node.Translation={...base.Translation,Keys:base.Translation.Keys.map(k=>({...k,Vector:vec(k.Vector.map(v=>v*size))}))};
    if(family==='RibbonEmitters'){node.HeightAbove*=size;node.HeightBelow*=size;}
    else if(family==='ParticleEmitters2'){
      node.ParticleScaling=vec(base.ParticleScaling.map(v=>v*size));
      for(const field of ['Width','Length','Speed','Gravity'])node[field]*=size;
    }
    patch[family].push(node);
  }
  if(patch.EventObjects.length)patch.eventPlacement=true;
  return patch;
}
// A geoset is visible in a clip without alpha keys. A ribbon defaults to hidden
// in the same clip. One held key in that clip gives both the same visibility.
function accentVisibility(model,gate,ribbon){
  const track=structuredClone(gate);
  if(!ribbon||!track.Keys)return track;
  const intervals=isGlobalTrack(track,model)?[[0,model.GlobalSequences[track.GlobalSeqId]]]:model.Sequences.map(s=>s.Interval);
  for(const interval of intervals){
    if(keysInInterval(track,interval).length)continue;
    const key={Frame:Math.round((interval[0]+interval[1])/2),Vector:vec([1])};
    if(track.LineType>=2){
      key.InTan=vec([track.LineType===2?0:1]);key.OutTan=key.InTan.slice();
    }
    track.Keys.push(key);
  }
  track.Keys.sort((a,b)=>a.Frame-b.Frame);
  return track;
}
export function attachVisualAccents(model,geometry,parent,effect,options){
  if(!effect.accents?.length)return null;
  const source=emptyParticleModel(model.Version),ground=effect.at==='ground';
  const frame=accentFrame(model,geometry,parent,ground);
  let fit=null;
  if(effect.accents.some(a=>a.ribbon)&&geometry.Faces.length){
    const index=options.geoset,selection={[index]:new Set(geometry.Faces)};
    fit=fitRibbonToPolygons(model,selection);
    frame.origin=Array.from(fit.recipe.native.RibbonEmitters[0].PivotPoint);
  }
  const {origin,radius}=frame;
  for(const [i,spec] of effect.accents.entries()){
    const p=spec.ribbon?addRibbon(source,model,spec,options,radius):addParticles(source,model,spec,effect,options,radius);
    if(spec.ribbon&&fit){
      const rotation=fit.recipe.native.RibbonEmitters[0].Rotation.Keys[0].Vector;
      p.Rotation=constantTrack(model,rotation);
      p.HeightAbove=p.HeightBelow=fit.length*Math.min(.48,spec.width*1.35);
    }
    const pivot=[origin[0],origin[1],origin[2]+radius*(spec.height||0)];
    if(spec.along&&fit)for(let axis=0;axis<3;axis++)pivot[axis]+=(fit.endpoints[1][axis]-fit.endpoints[0][axis])*spec.along;
    p.Name=effect.name+(i?' '+(i+1):'');
    p.PivotPoint=source.PivotPoints[p.ObjectId]=vec(pivot);
  }
  const {ids}=copyEffectGraph(model,source,source.Nodes.map(n=>n.ObjectId),{parent:ground?null:parent});
  const rest={ParticleEmitters2:[],RibbonEmitters:[],EventObjects:[]};
  if(effect.stamp){
    const mark=createNode(model,'EventObject'),interval=model.Sequences[options.sequence]?.Interval;
    const duration=interval?interval[1]-interval[0]:Math.round(effect.duration/options.speed);
    const code=effect.stamp.slice(4),type=effect.stamp.slice(0,3);
    const names=new Set(model.EventObjects.map(n=>n.Name));
    const letter=[...'xyzwvutsrqponmlkjihgfedcba'].find(c=>!names.has(type+c+code));
    if(!letter)throw Error('This model already contains every variation of this ground mark.');
    mark.Name=type+letter+code;mark.Parent=null;
    mark.PivotPoint=model.PivotPoints[mark.ObjectId]=vec(origin);
    mark.EventTrack=new Uint32Array([Math.round((interval?.[0]||0)+duration*.185)]);
    if(!interval)mark.GlobalSeqId=clock(model,duration);
    rest.EventObjects.push({...mark});
  }
  const gate=model.GeosetAnims.find(a=>a.GeosetId===options.geoset)?.Alpha;
  for(const id of ids){
    const node=model.Nodes[id],family=node.ParticleScaling?'ParticleEmitters2':'RibbonEmitters';
    if(!effect.cue && gate!=null && gate!==1)node.Visibility=accentVisibility(model,gate,family==='RibbonEmitters');
    rest[family].push({...node});
  }
  const patch=positionedAccents(rest,origin,options.placement);
  for(const family of ['ParticleEmitters2','RibbonEmitters','EventObjects'])for(const node of patch[family]){
    Object.assign(model.Nodes[node.ObjectId],node);model.PivotPoints[node.ObjectId]=node.PivotPoint;
  }
  return {ids,rest,origin};
}
