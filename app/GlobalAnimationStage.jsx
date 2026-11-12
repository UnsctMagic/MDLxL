import React,{useCallback,useMemo,useRef,useState} from 'react';
import {Vector3} from 'three';
import ParticleStageTools from './ParticleStageTools.jsx';
import ParticleStageHandle from './ParticleStageHandle.jsx';
import {useWindowKeyClaim} from './Hotkeys.jsx';
import {translate} from '../src/localization.js';
import {emitterName} from '../src/global-animation-looks.js';
import {withEmitterPlacement,withEmitterPosition,emitterSitePoint} from '../src/fx-emitter-placement.js';

export default function GlobalAnimationStage({Preview,graph,layer,placing,onLayer,selectedSite,selectSite,onDrag,...props}){
 const [snap,setSnap]=useState(null),[draft,setDraft]=useState(null),gesture=useRef(null),capture=useRef(null);
 const captureReady=useCallback(api=>{capture.current=api;props.onCaptureReady?.(api);},[props.onCaptureReady]);
 const value=draft||layer,result=graph?.layers?.[layer?.id],prefix=graph?.model?.Geosets[graph.geoset]?._FxStack?.owner+'/'+layer?.id+'/';
 const nodes=(result?.ids||[]).map(id=>graph.model.Nodes[id]).filter(node=>graph.model.ParticleEmitters2.includes(node));
 const keyOf=node=>node._FxTag.slice(prefix.length),individual=nodes.find(node=>keyOf(node)===selectedSite);
 const card=layer?.type==='Card',flat=layer?.ground||card&&layer.facing==='ground';
 const radius=flat||layer?.kind==='flies'||layer?.kind==='native'||card;
 const real=individual||graph?.model?.Nodes[result?.id];
 let parentNode=real?.Parent,anchorId=real?.ObjectId;
 if(layer?.orbit&&layer.type==='Edge')for(let i=0;i<3&&parentNode!=null;i++){anchorId=parentNode;parentNode=graph.model.Nodes[parentNode]?.Parent;}
 const frame=layer?.type==='Particles'?graph?.frame:graph?.frame?.regions?.find(r=>r.weights.some(([id])=>id===parentNode))?.frame||graph?.frame;
 const active=placing&&frame&&value&&real,parent=active?parentNode??null:null;
 useWindowKeyClaim(({event})=>{if(event.key==='Escape'&&active&&individual&&!gesture.current){selectSite(null);return true;}return false;},1);
 const liveModel=useMemo(()=>{
  if(!draft||!graph?.model||layer.type!=='Particles'||layer.swarm)return graph?.model;
  const points=new Map((result.sites||[]).map(site=>[site.key,site.point]));
  return {...graph.model,ParticleEmitters2:graph.model.ParticleEmitters2.map(node=>{
   if(!node._FxTag?.startsWith(prefix))return node;
   const key=node._FxTag.slice(prefix.length),point=points.get(key);if(!point)return node;
   return {...node,PivotPoint:Float32Array.from(emitterSitePoint(graph.frame,draft,key,new Vector3(...point)).toArray())};
  })};
 },[draft,graph,layer,result,prefix]);
 const marks=useMemo(()=>{
  if(!active)return undefined;
  const sites=Object.fromEntries(nodes.map(node=>{
   const live=liveModel.ParticleEmitters2.find(n=>n.ObjectId===node.ObjectId)||node;
   return ['site:'+keyOf(node),{point:Array.from(live.PivotPoint),node:node.ObjectId}];
  }));
  if(individual){const point=value.individuals?.[selectedSite]?.position||Array.from(individual.PivotPoint);return {...sites,center:{point,node:individual.ObjectId}};}
  const base=(layer.impact||flat)&&real?new Vector3().fromArray(real.PivotPoint).sub(new Vector3(...layer.offset)):null;
  const at=d=>(base?base.clone().addScaledVector(frame.axis,d):frame.at(d)).add(new Vector3(...value.offset)).toArray();
  return {...sites,center:{point:at(0),node:parent,radius:radius?value.size:undefined},
   upper:{point:at(value.upper),node:parent},upperUnit:{point:at(value.upper+1),node:parent},
   lower:{point:at(-value.lower),node:parent},lowerUnit:{point:at(-value.lower-1),node:parent}};
 },[active,frame,parent,value,radius,individual,selectedSite,liveModel]);
 const stageReady=snap?.site===selectedSite&&snap?.layerId===layer?.id;
 const center=stageReady&&snap?.marks?.center;
 let snapshot=null;
 if(center&&snap.anchor){
  const [x,y,,,r]=center,points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>[x+a*r,y+b*r,0]);
  snapshot={...snap,anchor:layer.impact&&!individual?null:{...snap.anchor,point:center},guide:{...snap.guide,...snap.marks,origin:center},samples:radius&&!individual?[{owner:real.ObjectId,age:.5,points}]:[]};
 }
 const fieldKeys={Translation:'offset',ParticleScaling:'size',HeightAbove:'upper',HeightBelow:'lower'};
 const emitter=value&&{ObjectId:real?.ObjectId,Translation:individual?(value.individuals?.[selectedSite]?.position||Array.from(individual.PivotPoint)):value.offset,ParticleScaling:[value.size,value.size,value.size],HeightAbove:value.upper,HeightBelow:value.lower};
 const pick=(id,hits=[id])=>{const node=nodes.find(n=>n.ObjectId===id)||nodes.find(n=>hits.includes(n.ObjectId));if(node)selectSite(keyOf(node));};
 return <><Preview {...props} particleLiveModel={liveModel} particleLiveRevision={draft} onCaptureReady={captureReady}
  particleAnchorId={active?anchorId:undefined} keepBillboards={card||!!layer?.swarm} particleSelectedId={active?real.ObjectId:undefined}
  particlePickOnClick={!!active&&nodes.length>0} onParticlePick={active&&nodes.length?pick:undefined} particleStageMarks={marks} onParticleStage={active?s=>setSnap({...s,site:selectedSite,layerId:layer.id}):undefined}/>
 {active&&nodes.length>0&&snap&&<svg className="pe-stage-tools fx-emitter-markers" viewBox={'0 0 '+snap.width+' '+snap.height}>{nodes.map((node,i)=>{
  const key=keyOf(node),point=snap.marks?.['site:'+key];if(key===selectedSite||!point||point[2]<-1||point[2]>1)return null;
  return <ParticleStageHandle key={key} point={point} radius={3} role="button" label={translate(emitterName(layer))+' '+(i+1)}
   onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();selectSite(key);}}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectSite(key);}}}/>;
 })}</svg>}
 {active&&<ParticleStageTools onDrag={onDrag} frames={capture.current?.frames} spanHandles={!individual&&layer.type==='Particles'} snapshot={snapshot} tool={individual||layer.stamp?'Placement':'Look'} emitter={emitter} options={{family:individual||radius?'ParticleEmitters2':'RibbonEmitters',stage:1}}
  begin={field=>{gesture.current={key:fieldKeys[field],initial:layer,site:individual?selectedSite:null};}}
  change={v=>{const g=gesture.current;if(!g)return;g.next=g.site?withEmitterPosition(g.initial,g.site,v):withEmitterPlacement(g.initial,{...g.initial,[g.key]:v});setDraft(g.next);}}
  finish={()=>{const g=gesture.current;gesture.current=null;setDraft(null);if(g?.next)onLayer(g.next);}}
  cancel={()=>{gesture.current=null;setDraft(null);}}/>}</>;
}
