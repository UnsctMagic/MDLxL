// Lab-only adapter for the real Vertices viewport. No product source imports this.
import * as THREE from 'three';
import {movementAxisHandles,drawMovementGizmo,pickMovementHandle} from './movement-overlay.js';
import {planeScreenBasis,projectedPlaneTranslation,quadProjectedPlaneTranslation} from './viewport-math.js';
import {shiftDragLatch,shiftDragOffset} from './classic-gestures.js';
import {viewportAppearanceOptions} from '../src/preferences.js';
import {rotationOptions} from '../src/rotation-drag.js';
import {AXES,NORMAL,PERPENDICULAR,constrainedDegrees,beginSweep,sweepDegrees,chooseLeverAxis,dominantPlaneAxis,facingAxis,moveConstraint} from './gizmo-lab-rules.js';
import {labAppearance} from './rotation-lab.jsx';
const COLORS={X:'#fa4343',Y:'#34cf59',Z:'#3588ff'},YELLOW='#fff14e',OUTLINE='#162137';
const axisVector=axis=>new THREE.Vector3().setComponent(AXES.indexOf(axis),1);
const screen=(world,camera,width,height)=>{const v=world.clone().project(camera);return {x:(v.x+1)*width/2,y:(1-v.y)*height/2,z:v.z};};
const constrained=(p,pane,quad)=>!!(quad&&pane.workplane)||p.workplaneEnabled!==false;
const panePlane=(p,pane,quad)=>quad&&pane.workplane||p.workplane;
const viewAxis=camera=>facingAxis(camera.getWorldDirection(new THREE.Vector3()).toArray());
const planeAxes=plane=>plane.toUpperCase().split('');
function views(state){return state.gizmoLabViews??=new Map();}
function pointSegment(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/l)):0;return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);}
function ringBasis(axis){return axis==='X'?[axisVector('Y'),axisVector('Z')]:axis==='Y'?[axisVector('Z'),axisVector('X')]:[axisVector('X'),axisVector('Y')];}
function ringPoints(pivot,axis,length,camera,width,height,start=0,end=Math.PI*2){
 const [u,v]=ringBasis(axis),points=[];
 for(let i=0;i<=96;i++){const a=start+(end-start)*i/96,world=pivot.clone().addScaledVector(u,Math.cos(a)*length).addScaledVector(v,Math.sin(a)*length);points.push({...screen(world,camera,width,height),near:world.clone().sub(pivot).dot(camera.position.clone().sub(pivot))>=0});}
 return points;
}
function makeData(p,state,camera,pane,quad,pivot,width,height){
 const appearance=labAppearance(),locked=constrained(p,pane,quad),at=screen(pivot,camera,width,height);
 const active={world:pivot,x:at.x,y:at.y,visible:at.z>=-1&&at.z<=1};
 const handles=locked?[]:movementAxisHandles(active,camera,width,height,state.radius,'world',p.transformMode==='translate'?'move':'rotate');
 const unit=handles[0]?.unitsPerPixel??(camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom/height:2*pivot.distanceTo(camera.position)*Math.tan(camera.fov*Math.PI/360)/camera.zoom/height);
 const rings=!locked&&p.transformMode==='rotate'&&appearance!=='Lines'?AXES.map(axis=>({axis,mode:'rotate',kind:'ring',points:ringPoints(pivot,axis,unit*68,camera,width,height,0,appearance==='Arcs'?Math.PI/2:Math.PI*2)})):[];
 const key=JSON.stringify([appearance,locked,p.transformMode,p.cameraMode,width,height,...pivot.toArray(),...camera.matrixWorld.elements,...[0,5,8,9,12,13].map(i=>camera.projectionMatrix.elements[i])].map(v=>typeof v==='number'?Math.round(v*1e8)/1e8:v));
 return {key,pivot:pivot.clone(),at,width,height,unit,handles:p.transformMode==='rotate'&&appearance!=='Lines'?rings:handles,poseHandles:handles,appearance,constrained:locked,plane:panePlane(p,pane,quad),tool:p.transformMode,camera:camera.clone(),defaultAxis:viewAxis(camera)};
}
export function pickLabHandle(state,pane,point){
 const view=views(state).get(pane.id);if(!view?.data||view.data.constrained)return null;
 const data=view.data;
 if(data.tool==='translate'||data.appearance==='Lines')return pickMovementHandle(data.handles,point.x,point.y,data.tool==='translate'?'move':'rotate');
 const hits=data.handles.map(handle=>({handle,distance:Math.min(...handle.points.slice(1).map((p,i)=>pointSegment(point,handle.points[i],p)))}));
 return hits.filter(hit=>hit.distance<=7).sort((a,b)=>a.distance-b.distance)[0]?.handle??null;
}
export function hoverLab(p,state,camera,pane,event,quad){
 if(!p.rotationLab)return;
 const view=views(state).get(pane.id);if(!view)return;
 const rect=pane.surface.getBoundingClientRect();view.pointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
 view.hoverEnabled=!event.altKey&&!event.buttons;
 const previous=view.hover;view.hover=p.cameraMode==='work'&&view.hoverEnabled&&!view.data?.constrained?pickLabHandle(state,pane,view.pointer)??{axis:viewAxis(camera),plane:p.transformMode==='translate'?PERPENDICULAR[viewAxis(camera)]:undefined,offHandle:true}:null;
 view.hoverKey=view.data?.key;view.hoverPointer={...view.pointer};
 if(previous?.axis!==view.hover?.axis||previous?.plane!==view.hover?.plane||previous?.offHandle!==view.hover?.offHandle)state.scheduler?.invalidate();
}
export function leaveLab(state,pane){const view=state.gizmoLabViews?.get(pane?.id);if(view&&(view.hover||view.pointer)){view.hover=null;view.pointer=null;state.scheduler?.invalidate();}}
export function releaseLabPointer(state,pane,point,alt=false){const view=state.gizmoLabViews?.get(pane?.id);if(view){view.pointer={x:point.x,y:point.y};view.hoverEnabled=!alt;}}
export function beginLabDrag(p,state,drag,start,camera,pane,quad,handle){
 if(!p.rotationLab||!['translate','rotate'].includes(drag.action))return;
 const locked=constrained(p,pane,quad),plane=panePlane(p,pane,quad),data=views(state).get(pane.id)?.data;
 const width=start.width,height=start.height,pivot=drag.pivot.clone(),center=screen(pivot,camera,width,height),defaultAxis=viewAxis(camera);
 const chosen=locked?null:handle??{axis:drag.action==='translate'?undefined:defaultAxis,plane:drag.action==='translate'?PERPENDICULAR[defaultAxis]:undefined,offHandle:true};
 const lab=drag.gizmoLab={tool:drag.action,constraints:locked,appearance:labAppearance(),plane,axis:locked?NORMAL[plane]:chosen?.axis??NORMAL[chosen?.plane],handle:chosen,pane:pane.id,start:{x:start.x,y:start.y},pointer:{x:start.x,y:start.y},width,height,pivot,center,camera:camera.clone(),strength:rotationOptions(p.preferences,'vertices').sensitivity,angle:0,distance:0,translation:[0,0,0],latch:shiftDragLatch({x:start.x,y:start.y},start.shiftKey??start.shift),ghost:new Map(),poseHandles:data?.poseHandles??[],unit:data?.unit??1,shift:!!(start.shiftKey??start.shift),rawSwept:0};
 if(drag.action==='rotate'&&!locked){
  lab.lever=lab.appearance==='Lines'&&!chosen.offHandle?chosen.axis:null;
  if(lab.lever)lab.axis=null;
  const turn=lab.axis?axisVector(lab.axis).transformDirection(camera.matrixWorldInverse):null;
  lab.sweep=beginSweep({x:start.x,y:start.y,pivot:center,facing:turn?.z??-1});
  if(lab.lever){
   const arm=axisVector(lab.lever).multiplyScalar(lab.unit*68),tip=pivot.clone().add(arm),s=screen(tip,camera,width,height);
   lab.tangents=Object.fromEntries(AXES.map(axis=>{const v=new THREE.Vector3().crossVectors(axisVector(axis),arm),t=screen(tip.clone().add(v),camera,width,height);return [axis,[t.x-s.x,t.y-s.y]];}));
  }
  const [u,v]=ringBasis(lab.axis??defaultAxis),su=screen(pivot.clone().addScaledVector(u,lab.unit*68),camera,width,height),sv=screen(pivot.clone().addScaledVector(v,lab.unit*68),camera,width,height),gx=start.x-center.x,gy=start.y-center.y;
  lab.phase=Math.atan2(gx*(sv.x-center.x)+gy*(sv.y-center.y),gx*(su.x-center.x)+gy*(su.y-center.y));
 }
}
export function sampleLabDrag(drag,point){
 const lab=drag?.gizmoLab;if(!lab)return;lab.pointer={x:point.x,y:point.y};
 if(lab.tool!=='rotate'||lab.constraints)return;
 if(lab.lever&&!lab.axis){
  lab.axis=chooseLeverAxis(lab.lever,lab.tangents,point.x-lab.start.x,point.y-lab.start.y);
  if(lab.axis){lab.sweep.sign=axisVector(lab.axis).transformDirection(lab.camera.matrixWorldInverse).z>0?-1:1;const [u,v]=ringBasis(lab.axis);lab.phase=Math.atan2(axisVector(lab.lever).dot(v),axisVector(lab.lever).dot(u));}
 }
 lab.rawSwept=sweepDegrees(lab.sweep,point.x,point.y);
}
function planeDelta(lab,plane,from,to){
 const raycaster=new THREE.Raycaster(),worldPlane=new THREE.Plane().setFromNormalAndCoplanarPoint(axisVector(NORMAL[plane]),lab.pivot);
 const hit=point=>{raycaster.setFromCamera({x:point.x/lab.width*2-1,y:1-point.y/lab.height*2},lab.camera);return raycaster.ray.intersectPlane(worldPlane,new THREE.Vector3());};
 const a=hit(from),b=hit(to);if(a&&b)return b.sub(a).toArray();
 return projectedPlaneTranslation(plane,planeScreenBasis(lab.camera,lab.pivot,lab.width,lab.height,plane),to.x-from.x,to.y-from.y);
}
export function moveLabDrag(drag,end,rawEnd,shift,axisSolve,quad){
 const lab=drag.gizmoLab,point=lab.constraints?end:rawEnd;lab.pointer={x:rawEnd.x,y:rawEnd.y};lab.shift=shift;
 const solve=(from,to,held)=>{
  if(lab.segmentFrom!==from){lab.segmentFrom=from;lab.dominantAxis=null;}
  const dx=to.x-from.x,dy=to.y-from.y;
  if(lab.constraints){const basis=planeScreenBasis(lab.camera,lab.pivot,lab.width,lab.height,lab.plane);return (quad?quadProjectedPlaneTranslation:projectedPlaneTranslation)(lab.plane,basis,dx,dy,held);}
  const constraint=moveConstraint(lab.handle,held);
  if(constraint.axis)return axisSolve(constraint.axis,from,to);
  if(constraint.dominant){
   const basis=Object.fromEntries(planeAxes(constraint.plane).map((axis,i)=>[axis,planeScreenBasis(lab.camera,lab.pivot,lab.width,lab.height,constraint.plane)[i]]));
   if(!lab.dominantAxis&&Math.hypot(dx,dy)>0)lab.dominantAxis=dominantPlaneAxis(constraint.plane,basis,dx,dy);
   return lab.dominantAxis?axisSolve(lab.dominantAxis,from,to):[0,0,0];
  }
  return planeDelta(lab,constraint.plane,from,to);
 };
 lab.translation=shiftDragOffset(lab.latch,point,shift,solve);lab.distance=Math.hypot(...lab.translation);
 const active=lab.constraints?{plane:lab.plane}:moveConstraint(lab.handle,shift);lab.usedPlane=active.plane;lab.usedAxis=active.dominant?lab.dominantAxis:active.axis;
 return new THREE.Vector3().fromArray(lab.translation);
}
export function rotateLabDrag(drag,rawEnd,shift){
 const lab=drag.gizmoLab;sampleLabDrag(drag,rawEnd);lab.shift=shift;
 let angle=lab.constraints?constrainedDegrees({plane:lab.plane,strength:lab.strength},rawEnd.x-lab.start.x,rawEnd.y-lab.start.y):lab.axis?lab.rawSwept:0;
 if(shift)angle=Math.round(angle/15)*15;lab.angle=angle;
 const degrees=[0,0,0];if(lab.axis)degrees[AXES.indexOf(lab.axis)]=angle;
 return degrees;
}
export function logLabDrag(drag,cancelled=false){
 const lab=drag?.gizmoLab;if(!lab)return;
 window.rotationLab.log({tool:lab.tool==='translate'?'Move':'Rotate',constraints:lab.constraints,appearance:lab.appearance,pane:lab.pane,cameraDirection:lab.camera.getWorldDirection(new THREE.Vector3()).toArray(),handle:lab.handle?.offHandle?'view':lab.handle?.plane??lab.handle?.axis??null,axis:lab.tool==='translate'?lab.usedAxis??null:lab.axis??null,plane:lab.usedPlane??(lab.constraints?lab.plane:lab.handle?.plane)??null,pixels:[lab.pointer.x-lab.start.x,lab.pointer.y-lab.start.y],degrees:lab.tool==='rotate'?lab.angle:null,distance:lab.tool==='translate'?lab.distance:null,translation:lab.translation,shift:lab.shift,cancelled});
}

function drawRing(ctx,points,color,active=false){
 for(let i=1;i<points.length;i++){
  ctx.beginPath();ctx.moveTo(points[i-1].x,points[i-1].y);ctx.lineTo(points[i].x,points[i].y);
  ctx.strokeStyle=OUTLINE;ctx.lineWidth=(points[i].near?2.6:1.4)+(active?1:0);ctx.stroke();
  ctx.strokeStyle=active?YELLOW:color;ctx.lineWidth=(points[i].near?1.6:.7)+(active?1:0);ctx.stroke();
 }
}
function ghostSegments(state,drag,camera,pane,width,height){
 const lab=drag.gizmoLab,key=[pane.id,camera.uuid,camera.zoom,width,height].join(':');
 if(lab.ghost.has(key))return lab.ghost.get(key);
 const segments=[];
 for(const [gi,ids]of Object.entries(drag.selections)){
  const vertices=drag.snapshots[gi],selected=new Set(ids),points=new Map(ids.map(i=>[i,screen(new THREE.Vector3().fromArray(vertices,i*3),camera,width,height)])),faces=state.entries[gi].geometry.index.array;
  const seen=new Set();
  for(let i=0;i<faces.length;i+=3)if([faces[i],faces[i+1],faces[i+2]].every(v=>selected.has(v)))for(const [a,b]of [[faces[i],faces[i+1]],[faces[i+1],faces[i+2]],[faces[i+2],faces[i]]]){
   const k=Math.min(a,b)+':'+Math.max(a,b);if(!seen.has(k)){segments.push([points.get(a),points.get(b)]);seen.add(k);}
  }
  if(!seen.size)for(const p of points.values())segments.push([{x:p.x-2,y:p.y},{x:p.x+2,y:p.y}]);
 }
 lab.ghost.set(key,segments);return segments;
}
function selectedPalette(p,active){
 const appearance={...viewportAppearanceOptions(p.preferences).controllers};
 if(active){const planeColor={xy:'Y',xz:'X',yz:'Z'}[active.plane];appearance['axis'+(planeColor??active.axis)]=YELLOW;}
 return appearance;
}
export function drawGizmoLab(p,state,camera,pane,quad,pivot,overlayHost,ratio){
 const map=views(state),previous=map.get(pane.id)??{};
 if(!pivot||!['translate','rotate'].includes(p.transformMode)){
  previous.canvas?.remove();previous.feedback?.remove();map.delete(pane.id);return;
 }
 const data=makeData(p,state,camera,pane,quad,pivot,pane.surface.clientWidth,pane.surface.clientHeight);
 const view={...previous,data};map.set(pane.id,view);
 const drag=state.drag?.gizmoLab?state.drag:null,lab=drag?.gizmoLab,activeDrag=lab?.pane===pane.id;
 // Reuse a hover result until either the pointer or the drawn handle geometry
 // changes. Release/cancel records the final pointer; this paint resolves it.
 if(!lab){
  const pointer=view.pointer;
  if(!pointer)view.hover=null;
  else if(view.hoverKey!==data.key||view.hoverPointer?.x!==pointer.x||view.hoverPointer?.y!==pointer.y){
   view.hover=p.cameraMode==='work'&&view.hoverEnabled!==false&&!data.constrained&&pointer.x>=0&&pointer.y>=0&&pointer.x<=data.width&&pointer.y<=data.height?pickLabHandle(state,pane,pointer)??{axis:data.defaultAxis,plane:data.tool==='translate'?PERPENDICULAR[data.defaultAxis]:undefined,offHandle:true}:null;
   view.hoverKey=data.key;view.hoverPointer={...pointer};
  }
 }
 const active=activeDrag?lab.handle:view.hover;
 view.visual={appearance:data.appearance,constrained:data.constrained,activeHandle:active?.plane??active?.axis??null,axis:activeDrag?lab.axis:null,angle:activeDrag?lab.angle:null,ghost:!!lab,ring:!!(activeDrag&&lab.axis&&!lab.constraints)};
 if(!data.handles.length&&!lab){view.canvas?.remove();view.canvas=null;view.feedback?.remove();view.feedback=null;return;}
 if(!view.canvas){const canvas=view.canvas=document.createElement('canvas');canvas.dataset.gizmoLab='';canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';overlayHost.appendChild(canvas);}
 const canvas=view.canvas;canvas.width=Math.round(data.width*ratio);canvas.height=Math.round(data.height*ratio);canvas.dataset.appearance=data.appearance;canvas.dataset.activeHandle=view.visual.activeHandle??'';
 const ctx=canvas.getContext('2d');ctx.save();ctx.scale(ratio,ratio);ctx.lineJoin='round';ctx.lineCap='round';
 if(lab){
  ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle=YELLOW;ctx.lineWidth=1;ctx.globalAlpha=.42;ctx.beginPath();
  for(const [a,b]of ghostSegments(state,drag,camera,pane,data.width,data.height)){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.stroke();ctx.restore();
 }
 if(data.tool==='translate')drawMovementGizmo(ctx,data.handles,1,active?.axis,selectedPalette(p,active));
 else if(data.appearance==='Lines'){
  let handles=data.handles;
  if(activeDrag&&lab.axis&&!lab.constraints){
   const q=new THREE.Quaternion().setFromAxisAngle(axisVector(lab.axis),THREE.MathUtils.degToRad(lab.angle));
   handles=handles.map(h=>{if(h.axis===lab.axis)return h;const point=screen(pivot.clone().add(axisVector(h.axis).applyQuaternion(q).multiplyScalar(data.unit*68)),camera,data.width,data.height);return {...h,x:point.x,y:point.y,dx:point.x-data.at.x||1e-9,dy:point.y-data.at.y,startX:data.at.x,startY:data.at.y};});
  }
  view.displayHandles=handles;
  drawMovementGizmo(ctx,handles,1,null,selectedPalette(p,active));
 }else{
  for(const handle of data.handles)drawRing(ctx,handle.points,COLORS[handle.axis],active?.axis===handle.axis);
 }
 if(activeDrag&&!lab.constraints&&lab.axis){
  if(data.appearance!=='Rings')drawRing(ctx,ringPoints(pivot,lab.axis,data.unit*68,camera,data.width,data.height),COLORS[lab.axis],true);
  const end=lab.phase+THREE.MathUtils.degToRad(lab.angle),slice=ringPoints(pivot,lab.axis,data.unit*68,camera,data.width,data.height,lab.phase,end);
  ctx.save();ctx.globalAlpha=.2;ctx.fillStyle=YELLOW;ctx.beginPath();ctx.moveTo(data.at.x,data.at.y);slice.forEach(point=>ctx.lineTo(point.x,point.y));ctx.closePath();ctx.fill();ctx.restore();
  ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle=YELLOW;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(data.at.x,data.at.y);ctx.lineTo(lab.pointer.x,lab.pointer.y);ctx.stroke();ctx.restore();
 }
 ctx.restore();
 if(activeDrag){
  if(!view.feedback){const label=view.feedback=document.createElement('div');label.dataset.gizmoFeedback='';label.style.cssText='position:absolute;pointer-events:none;z-index:4;white-space:nowrap;color:#fff14e;font: bold 12px Tahoma,sans-serif;text-shadow:-1px -1px #162137,1px 1px #162137,-1px 1px #162137,1px -1px #162137';overlayHost.appendChild(label);}
  const text=lab.tool==='rotate'?`${lab.constraints?'↔ ':''}${lab.axis??'–'} ${Math.round(lab.angle*10)/10}°`:`↔↕ ${(lab.usedAxis??lab.usedPlane??lab.plane??'').toUpperCase()} ${Math.round(lab.distance*100)/100}`;
  view.feedback.textContent=text;view.feedback.style.left=Math.min(data.width-135,Math.max(6,lab.pointer.x+16))+'px';view.feedback.style.top=Math.min(data.height-24,Math.max(6,lab.pointer.y+14))+'px';
 }else{view.feedback?.remove();view.feedback=null;}
}
export function disposeGizmoLab(state){for(const view of state.gizmoLabViews?.values()??[]){view.canvas?.remove();view.feedback?.remove();}state.gizmoLabViews?.clear();}
