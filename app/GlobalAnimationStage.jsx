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
import {withEmitterAim,emitterRotationTrack,individualEmitterLayer,withEmitterPlacement,withEmitterPosition,emitterSitePoint,emitterFormationAxes,emitterFormationCenter} from '../src/fx-emitter-placement.js';

export default function GlobalAnimationStage({Preview,graph,layer,placing,rotating,showMarkers,onLayer,selectedSite,selectSite,deleteEmitter,surfaceSnap,setSurfaceSnap,onDrag,windowRef,...props}){
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
 const frame=layer?.type==='Particles'?graph?.frame:graph?.frame?.regions?.find(r=>r.weights.some(([id])=>id===parentNode))?.frame||graph?.frame;
 const active=placing&&frame&&value&&real,parent=active?parentNode??null:null;
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
  const points=new Map((result.sites||[]).map(site=>[site.key,site.point]));
  return {...graph.model,ParticleEmitters2:graph.model.ParticleEmitters2.map(node=>{
   if(!node._FxTag?.startsWith(prefix))return node;
   const key=node._FxTag.slice(prefix.length),point=points.get(key);if(!point)return node;
   if(liveDraft.rotationDrag){
    const rotation=individualEmitterLayer(liveDraft.layer,key).native?.Rotation;
    return rotation?{...node,Rotation:emitterRotationTrack(graph.model,rotation)}:node;
   }
   return {...node,PivotPoint:Float32Array.from(emitterSitePoint(graph.frame,liveDraft.layer,key,new Vector3(...point)).toArray())};
  })};
 },[liveDraft,graph,layer,result,prefix]);
 const marks=useMemo(()=>{
  if(!active)return undefined;
  const sites=showMarkers?Object.fromEntries(nodes.map(node=>{
   const live=liveModel.ParticleEmitters2.find(n=>n.ObjectId===node.ObjectId)||node;
   return ['site:'+keyOf(node),{point:Array.from(live.PivotPoint),node:node.ObjectId}];
  })):null;
  if(individual){const point=value.individuals?.[selectedSite]?.position||Array.from(individual.PivotPoint);return {...sites,center:{point,node:individual.ObjectId}};}
  const base=(layer.impact||flat)&&real?new Vector3().fromArray(real.PivotPoint).sub(new Vector3(...layer.offset)):null;
  const at=d=>(base?base.clone().addScaledVector(frame.axis,d):frame.at(d)).add(new Vector3(...value.offset)).toArray();
  const centre=formation?.centre.clone().add(new Vector3(...value.offset));
  const marks={...sites,center:{point:centre?.toArray()||at(0),node:parent,radius:radius?value.size:undefined},
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
 },[active,frame,parent,value,radius,individual,selectedSite,liveModel,showMarkers,formation]);
 const stageReady=snap?.site===selectedSite&&snap?.layerId===layer?.id;
 const center=stageReady&&snap?.marks?.center;
 let snapshot=null;
 if(center&&snap.anchor){
  const [x,y,,,r]=center,points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>[x+a*r,y+b*r,0]);
  snapshot={...snap,anchor:layer.impact&&!individual?null:{...snap.anchor,point:center},guide:{...snap.guide,...snap.marks,origin:center},samples:radius&&!individual?[{owner:real.ObjectId,age:.5,points}]:[]};
 }
 const fieldKeys={Translation:'offset',ParticleScaling:'size',HeightAbove:'upper',HeightBelow:'lower',FormationWidth:'formationWidth',FormationDepth:'formationDepth'};
 const extent=formation?.extents.map(half=>half*(value.formation||1));
 const aim=rotating&&active&&nodes.length>0;
 const representativeOverride=aim&&layer.individuals?.[keyOf(real)]?.values?.native?.Rotation;
 const rotation=aim?(individual?individualEmitterLayer(value,selectedSite).native?.Rotation??real.Rotation:
  value.native?.Rotation??(representativeOverride?undefined:real.Rotation)):undefined;
 const emitter=value&&{ObjectId:real?.ObjectId,Rotation:rotation,Translation:individual?(value.individuals?.[selectedSite]?.position||Array.from(individual.PivotPoint)):value.offset,ParticleScaling:[value.size,value.size,value.size],HeightAbove:value.upper,HeightBelow:value.lower,
  ...(extent?{FormationWidth:extent[0]*(value.formationWidth??1),FormationDepth:extent[1]*(value.formationDepth??1)}:{})};
 const rotationOptions={frame:snap?.frame??props.time,interval:graph?.model?.Sequences[props.sequenceIndex]?.Interval,globalSequences:graph?.model?.GlobalSequences,
  globalTime:rotation?.GlobalSeqId===real?.Rotation?.GlobalSeqId?snap?.turn?.globalTime:undefined};
 const options={...rotationOptions,family:aim||individual||radius?'ParticleEmitters2':'RibbonEmitters',stage:1};
 function begin(field){
  const g={key:fieldKeys[field],initial:layer,extent:field==='FormationWidth'?extent?.[0]:field==='FormationDepth'?extent?.[1]:undefined,
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
  }else{
   g.next=g.site?withEmitterPosition(g.initial,g.site,value,g.attachmentPoint):
    withEmitterPlacement(g.initial,{...g.initial,[g.key]:g.extent?value/g.extent:value});
  }
  setDraft({layer:g.next,initial:g.initial,site:g.site,rotationDrag:g.rotationDrag});
 }
 // Register before texture loading so the first placement click has sprite coverage data.
 const pick=(id,hits=[id])=>{if(!active)return;const node=nodes.find(n=>n.ObjectId===id)||nodes.find(n=>hits.includes(n.ObjectId));if(node)selectSite(keyOf(node));};
 return <><Preview {...props} particleLiveModel={liveModel} particleLiveRevision={draft} onCaptureReady={captureReady}
  onParticleSurfacePlace={active&&individual&&surfaceSnap?(_,hit)=>{onLayer({...layer,individuals:{...layer.individuals,[selectedSite]:{...layer.individuals?.[selectedSite],position:hit.bindPosition,attachmentPoint:hit.bindPosition,surface:{geoset:hit.geoset,vertices:hit.vertices,barycentric:hit.barycentric}}}});setSurfaceSnap(false);}:undefined}
  particleAnchorId={active?anchorId:undefined} keepBillboards={card||!!layer?.swarm} particleSelectedId={active?real.ObjectId:undefined}
  particlePickOnClick={!!active&&nodes.length>0} onParticlePick={pick} particleStageMarks={marks} onParticleStage={active?s=>setSnap({...s,site:selectedSite,layerId:layer.id}):undefined}/>
 {active&&showMarkers&&nodes.length>0&&stageReady&&snap&&<svg className="pe-stage-tools fx-emitter-markers" viewBox={'0 0 '+snap.width+' '+snap.height}>{nodes.map((node,i)=>{
  const key=keyOf(node),point=snap.marks?.['site:'+key];if(key===selectedSite||!point||point[2]<-1||point[2]>1)return null;
  return <ParticleStageHandle key={key} point={point} radius={3} hitRadius={10} role="button" label={translate(emitterName(layer))+' '+(i+1)}
   onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();selectSite(key);}}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectSite(key);}}}/>;
 })}</svg>}
 {active&&<ParticleStageTools onDrag={onDrag} frames={capture.current?.frames} spanHandles={!aim&&!individual&&layer.type==='Particles'} rotate={aim} preferences={props.preferences}
  snapshot={aim&&snapshot?{...snapshot,anchor:null}:snapshot} tool={aim?'Rotate':individual||layer.stamp?'Placement':'Look'} emitter={emitter} options={options}
  begin={begin} change={change}
  finish={()=>{const g=gesture.current;gesture.current=null;setDraft(null);if(g?.next&&g.initial===layer&&g.site===selectedSite&&placing)onLayer(g.next,g.rotationDrag);}}
  cancel={()=>{gesture.current=null;setDraft(null);}}/>}</>;
}
