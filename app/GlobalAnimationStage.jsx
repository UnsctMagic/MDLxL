import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Vector3} from 'three';
import ParticleStageTools from './ParticleStageTools.jsx';
import ParticleStageHandle from './ParticleStageHandle.jsx';
import {useWindowKeyClaim} from './Hotkeys.jsx';
import {translate} from '../src/localization.js';
import {emitterName} from '../src/global-animation-looks.js';
import {isTextEditingTarget} from '../src/preferences.js';
import {beginParticleParameter} from '../src/particle-bindings.js';
import {globalSequenceId} from '../src/animation.js';
import {degreesToQuaternion} from '../src/rotation-math.js';
import {withLayerSize} from '../src/global-animation-looks.js';
import {withEmitterAim,emitterRotationTrack,individualEmitterLayer,withEmitterPlacement,withEmitterPosition,emitterSitePoint,emitterFormationAxes,emitterFormationCenter} from '../src/fx-emitter-placement.js';

export default function GlobalAnimationStage({Preview,graph,layer,group,stackLayers,onLayers,placing,rotating,showMarkers,onLayer,selectedSite,selectSite,deleteEmitter,surfaceSnap,setSurfaceSnap,onDrag,windowRef,...props}){
 const [snap,setSnap]=useState(null),[draft,setDraft]=useState(null),gesture=useRef(null),capture=useRef(null);
 useEffect(()=>{
  const current=gesture.current;
  if(current&&(current.initial!==layer||current.site!==selectedSite||!placing)){
   gesture.current=null;setDraft(null);onDrag?.(false);
  }
 },[layer,selectedSite,placing,onDrag]);
 const captureReady=useCallback(api=>{capture.current=api;props.onCaptureReady?.(api);},[props.onCaptureReady]);
 const liveDraft=draft?.initial===layer&&draft?.site===selectedSite&&placing?draft:null;
 const value=liveDraft?.layer||layer,result=graph?.layers?.[layer?.id],prefix=graph?.model?.Geosets[graph.geoset]?._FxStack?.owner+'/'+layer?.id+'/';
 const nodes=(result?.ids||[]).map(id=>graph.model.Nodes[id]).filter(node=>graph.model.ParticleEmitters2.includes(node));
 const keyOf=node=>node._FxTag.slice(prefix.length),individual=nodes.find(node=>keyOf(node)===selectedSite);
 const card=layer?.type==='Card',flat=layer?.ground||card&&layer.facing==='ground';
 const radius=flat||layer?.kind==='flies'||layer?.kind==='native'||card;
 const real=individual||graph?.model?.Nodes[result?.id];
 let parentNode=real?.Parent,anchorId=real?.ObjectId;
 if(layer?.orbit&&layer.type==='Edge')for(let i=0;i<3&&parentNode!=null;i++){anchorId=parentNode;parentNode=graph.model.Nodes[parentNode]?.Parent;}
 const frame=layer?.type==='Particles'||layer?.whole?graph?.frame:graph?.frame?.regions?.find(r=>r.weights.some(([id])=>id===parentNode))?.frame||graph?.frame;
 const active=placing&&frame&&value&&real,parent=active?parentNode??null:null;
 // The corner handles show the size the preview really draws: a native sprite's own scale, not the layer's multiplier.
 const sized=radius||layer?.type==='Particles'&&!layer.stamp&&!layer.tattoo;
 const shown=layer?.type==='Particles'&&!layer.swarm&&real?.ParticleScaling?.[1]>0?real.ParticleScaling[1]:value?.size;
 const shape=active&&!individual&&layer.type==='Particles'&&!layer.swarm&&!layer.impact&&nodes.length>1;
 const formation=useMemo(()=>{
  if(!shape)return null;
  const axes=emitterFormationAxes(frame),centre=emitterFormationCenter(frame,layer);
  const extents=axes.map(axis=>(result.sites||[]).reduce((extent,site)=>Math.max(extent,Math.abs(new Vector3(...site.point).sub(centre).dot(axis))),Math.max(1,frame.length*.06)));
  return {axes,centre,extents};
 },[shape,frame,layer,result]);
 useWindowKeyClaim(({event,localWindow})=>{
  if(localWindow!==windowRef.current||!active||!individual||gesture.current)return false;
  if(event.key==='Escape'){selectSite(null);return true;}
  if(event.key!=='Delete'||isTextEditingTarget(event.target)||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return false;
  if(!event.repeat)deleteEmitter();
  return true;
 },1);
 const liveModel=useMemo(()=>{
  if(!liveDraft||!graph?.model||layer.type!=='Particles'||layer.swarm)return graph?.model;
  // The dragged layer, and the layers whose emitters move with it when emitters are selected by group.
  const owner=prefix.slice(0,prefix.length-String(layer.id).length-1);
  const drafts=[liveDraft.layer,...(liveDraft.others||[])].map(item=>({item,prefix:owner+item.id+'/',points:new Map((graph.layers[item.id]?.sites||[]).map(site=>[site.key,site.point]))}));
  return {...graph.model,ParticleEmitters2:graph.model.ParticleEmitters2.map(node=>{
   const draft=drafts.find(entry=>node._FxTag?.startsWith(entry.prefix));if(!draft)return node;
   const key=node._FxTag.slice(draft.prefix.length),point=draft.points.get(key);if(!point)return node;
   if(liveDraft.scale&&draft.item===liveDraft.layer&&node.ParticleScaling&&ArrayBuffer.isView(node.ParticleScaling))return {...node,ParticleScaling:node.ParticleScaling.map(v=>v*liveDraft.scale)};
   if(liveDraft.rotationDrag){
    const rotation=draft.item===liveDraft.layer&&individualEmitterLayer(liveDraft.layer,key).native?.Rotation;
    return rotation?{...node,Rotation:emitterRotationTrack(graph.model,rotation)}:node;
   }
   return {...node,PivotPoint:Float32Array.from(emitterSitePoint(graph.frame,draft.item,key,new Vector3(...point)).toArray())};
  })};
 },[liveDraft,graph,layer,result,prefix]);
 // Group selection: the emitters at the same place take the same move.
 const together=active&&individual&&group?.length?group:null;
 const movedTogether=(first,delta,place)=>{
  const moved=new Map([[layer.id,first]]);
  for(const member of together){
   const base=moved.get(member.layer)||stackLayers.find(item=>item.id===member.layer);
   if(base)moved.set(member.layer,place(base,member.key,member.point.map((v,i)=>v+delta[i]),member.point));
  }
  return [...moved.values()];
 };
 const marks=useMemo(()=>{
  if(!active)return undefined;
  const sites=showMarkers?Object.fromEntries(nodes.map(node=>{
   const live=liveModel.ParticleEmitters2.find(n=>n.ObjectId===node.ObjectId)||node;
   return ['site:'+keyOf(node),{point:Array.from(live.PivotPoint),node:node.ObjectId}];
  })):null;
  if(individual){const point=value.individuals?.[selectedSite]?.position||Array.from(individual.PivotPoint);return {...sites,center:{point,node:individual.ObjectId}};}
  const base=(layer.impact||flat)&&real?new Vector3().fromArray(real.PivotPoint).sub(new Vector3(...layer.offset)):null;
  const shift=(layer.along||0)*frame.length;
  const at=d=>(base?base.clone().addScaledVector(frame.axis,d):frame.at(d+shift)).add(new Vector3(...value.offset)).toArray();
  const centre=formation?.centre.clone().add(new Vector3(...value.offset));
  const marks={...sites,center:{point:centre?.toArray()||at(0),node:parent,radius:sized?shown:undefined},
   upper:{point:at(value.upper),node:parent},upperUnit:{point:at(value.upper+1),node:parent},
   lower:{point:at(-value.lower),node:parent},lowerUnit:{point:at(-value.lower-1),node:parent}};
  if(centre){
   ['formationWidth','formationDepth'].forEach((key,i)=>{
    const edge=centre.clone().addScaledVector(formation.axes[i],formation.extents[i]*(value[key]??1)*(value.formation??1));
    marks[key]={point:edge.toArray(),node:parent};
    marks[key+'Unit']={point:edge.addScaledVector(formation.axes[i],1).toArray(),node:parent};
   });
  }
  return marks;
 },[active,frame,parent,value,radius,sized,shown,individual,selectedSite,liveModel,showMarkers,formation]);
 const stageReady=snap?.site===selectedSite&&snap?.layerId===layer?.id;
 const center=stageReady&&snap?.marks?.center;
 let snapshot=null;
 if(center&&snap.anchor&&real){
  // Corners clear of the move handle and inside the stage, however large or small the effect is on screen.
  const [x,y,,,projected]=center,r=Math.max(22,Math.min(projected||0,.3*Math.min(snap.width,snap.height))),points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>[x+a*r,y+b*r,0]);
  snapshot={...snap,anchor:layer.impact&&!individual?null:{...snap.anchor,point:center},guide:{...snap.guide,...snap.marks,origin:center},samples:sized&&!individual?[{owner:real.ObjectId,age:.5,points}]:[]};
 }
 const fieldKeys={Translation:'offset',ParticleScaling:'size',HeightAbove:'upper',HeightBelow:'lower',FormationWidth:'formationWidth',FormationDepth:'formationDepth'};
 const extent=formation?.extents.map(half=>half*(value.formation||1));
 const aim=rotating&&active&&nodes.length>0;
 const representativeOverride=aim&&layer.individuals?.[keyOf(real)]?.values?.native?.Rotation;
 const rotation=aim?(individual?individualEmitterLayer(value,selectedSite).native?.Rotation??real.Rotation:
  value.native?.Rotation??(representativeOverride?undefined:real.Rotation)):undefined;
 const emitter=value&&{ObjectId:real?.ObjectId,Rotation:rotation,Translation:individual?(value.individuals?.[selectedSite]?.position||Array.from(individual.PivotPoint)):value.offset,ParticleScaling:[shown,shown,shown],HeightAbove:value.upper,HeightBelow:value.lower,
  ...(extent?{FormationWidth:extent[0]*(value.formationWidth??1),FormationDepth:extent[1]*(value.formationDepth??1)}:{})};
 const rotationOptions={frame:snap?.frame??props.time,interval:graph?.model?.Sequences[props.sequenceIndex]?.Interval,globalSequences:graph?.model?.GlobalSequences,
  globalTime:rotation?.GlobalSeqId===real?.Rotation?.GlobalSeqId?snap?.turn?.globalTime:undefined};
 const options={...rotationOptions,family:layer?.type==='Edge'&&!aim?'RibbonEmitters':'ParticleEmitters2',stage:1};
 function begin(field){
  const g={together:field==='Translation'?together:null,start:individual?Array.from(emitter.Translation):null,key:fieldKeys[field],initial:layer,extent:field==='FormationWidth'?extent?.[0]:field==='FormationDepth'?extent?.[1]:undefined,
   attachmentPoint:individual?Array.from(individual.PivotPoint):null,site:individual?selectedSite:null};
  if(field==='Rotation'){
   g.rotationDrag=true;
   if(rotation?.Keys?.length){
    const interval=rotationOptions.interval;
    const hasKeys=globalSequenceId(rotation,graph.model)!=null||!interval||rotation.Keys.some(key=>key.Frame>=interval[0]&&key.Frame<=interval[1]);
    g.rotation=beginParticleParameter(emitter,field,{...rotationOptions,scope:hasKeys?'track':'key'});
   }
  }
  gesture.current=g;
 }
 function change(value){
  const g=gesture.current;if(!g||g.initial!==layer||g.site!==selectedSite||!placing)return;
  if(g.rotationDrag){
   const rotation=g.rotation?JSON.parse(JSON.stringify(g.rotation.change(value),(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v)):degreesToQuaternion(value).normalize().toArray();
   g.next=withEmitterAim(g.initial,g.site,rotation);
  }else if(g.key==='size'){
   // The same size edit as the Size control: capped, native and quick-fit layers follow too.
   const actual=real?.ParticleScaling?.[1]??0,base=g.initial,fit=base.fireFit?.version===1,native=!!(base.native?.ParticleScaling||base.nativeSpec)&&actual>0&&base.kind!=='flies',ratio=native?value/actual:1;
   // A native sprite keeps its own scale: the layer size is a multiplier there, and its stages follow by the same ratio.
   let next={...base,size:native?base.size*ratio:value};
   if(fit)next.fireFit={...base.fireFit,sizeEdited:true};
   if(base.type==='Card'&&base.reach!=null&&base.size>0)next.reach=base.reach*value/base.size;
   g.next=withEmitterPlacement(base,withLayerSize(base,next));g.scale=native?ratio:value/(actual>0?actual:base.size||1);
  }else{
   g.next=g.site?withEmitterPosition(g.initial,g.site,value,g.attachmentPoint):
    withEmitterPlacement(g.initial,{...g.initial,[g.key]:g.extent?value/g.extent:value});
   if(g.site&&g.together){
    const all=movedTogether(g.next,Array.from(value,(v,i)=>v-g.start[i]),withEmitterPosition);
    g.next=all[0];g.others=all.slice(1);
   }
  }
  setDraft({layer:g.next,others:g.others,initial:g.initial,site:g.site,rotationDrag:g.rotationDrag,scale:g.scale});
 }
 // Register before texture loading so the first placement click has sprite coverage data.
 const pick=(id,hits=[id])=>{if(!active)return;const node=nodes.find(n=>n.ObjectId===id)||nodes.find(n=>hits.includes(n.ObjectId));if(node)selectSite(keyOf(node));};
 // A tattoo has no handles (owner, 14 November: "i should just click any point of the skin to put a tattoo there"):
 // a click on the model puts the selected mark, or the mark nearest the click, at that point of the skin, on whatever
 // geoset it is. A click on an effect's own geoset keeps only the place.
 const placeTattoo=layer?.tattoo&&real&&nodes.length?(_,hit)=>{
  const at=hit.bindPosition,far=node=>Math.hypot(node.PivotPoint[0]-at[0],node.PivotPoint[1]-at[1],node.PivotPoint[2]-at[2]);
  const key=individual?selectedSite:keyOf(nodes.reduce((a,b)=>far(b)<far(a)?b:a));
  const record={...layer.individuals?.[key],position:Array.from(at),attachmentPoint:Array.from(at)};
  if(graph.model.Geosets[hit.geoset]?._FxTag)delete record.surface;else record.surface={geoset:hit.geoset,vertices:hit.vertices,barycentric:hit.barycentric};
  onLayer({...layer,individuals:{...layer.individuals,[key]:record}});
 }:null;
 return <><Preview {...props} particleLiveModel={liveModel} particleLiveRevision={draft} onCaptureReady={captureReady}
  onParticleSurfacePlace={placeTattoo?placeTattoo:active&&individual&&surfaceSnap?(_,hit)=>{
   const snap=(target,key,position)=>({...target,individuals:{...target.individuals,[key]:{...target.individuals?.[key],position,attachmentPoint:hit.bindPosition,surface:{geoset:hit.geoset,vertices:hit.vertices,barycentric:hit.barycentric}}}});
   const first=snap(layer,selectedSite,hit.bindPosition);
   if(together)onLayers(movedTogether(first,Array.from(hit.bindPosition,(v,i)=>v-individual.PivotPoint[i]),snap));else onLayer(first);
   setSurfaceSnap(false);}:undefined}
  particleAnchorId={active||placeTattoo?anchorId:undefined} keepBillboards={card||!!layer?.swarm} particleSelectedId={active?real.ObjectId:undefined}
  particlePickOnClick={!!placeTattoo||!!active&&nodes.length>0} onParticlePick={pick} particleStageMarks={marks} onParticleStage={active?s=>setSnap({...s,site:selectedSite,layerId:layer.id}):undefined}/>
 {active&&showMarkers&&nodes.length>0&&stageReady&&snap&&<svg className="pe-stage-tools fx-emitter-markers" viewBox={'0 0 '+snap.width+' '+snap.height}>{nodes.map((node,i)=>{
  const key=keyOf(node),point=snap.marks?.['site:'+key];if(key===selectedSite||!point||point[2]<-1||point[2]>1)return null;
  return <ParticleStageHandle key={key} point={point} radius={3} hitRadius={10} role="button" label={translate(emitterName(layer))+' '+(i+1)}
   onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();selectSite(key);}}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectSite(key);}}}/>;
 })}</svg>}
 {active&&!layer.tattoo&&(individual||layer.type!=='Particles'||layer.swarm||layer.impact||nodes.length<2)&&<ParticleStageTools onDrag={onDrag} frames={capture.current?.frames} spanHandles={!aim&&!individual&&layer.type==='Particles'&&!layer.swarm&&!layer.tattoo&&!layer.impact&&nodes.length>1} hitRadius={12} quiet rotate={aim} preferences={props.preferences}
  snapshot={aim&&snapshot?{...snapshot,anchor:null}:snapshot} tool={aim?'Rotate':individual||layer.stamp||layer.tattoo?'Placement':'Look'} emitter={emitter} options={options}
  begin={begin} change={change}
  finish={()=>{const g=gesture.current;gesture.current=null;setDraft(null);if(g?.next&&g.initial===layer&&g.site===selectedSite&&placing){if(g.others?.length)onLayers([g.next,...g.others]);else onLayer(g.next,g.rotationDrag);}}}
  cancel={()=>{gesture.current=null;setDraft(null);}}/>}</>;
}
