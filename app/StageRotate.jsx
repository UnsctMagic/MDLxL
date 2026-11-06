import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Vector3} from 'three';
import {useWindowKeyClaim} from './Hotkeys.jsx';
import {beginGizmoRotation,drawGizmoRotationFeedback,drawMovementGizmo,movementAxisHandles,pickMovementHandle,rotationDisplayHandles} from './movement-overlay.js';
import {rotationDragDegrees} from '../src/rotation-drag.js';
import {viewportAppearanceOptions} from '../src/preferences.js';
import {createFrameCoalescer,pointerSensitivityValue} from './viewport-performance.js';

// The main editor's Rotate gizmo for stage previews (EMTR emitters and ribbons,
// Glow Up's weapon glow). Same handles (Settings → Rotate handles: lines, rings
// or arcs), colours, speed settings, yellow sweep and degree readout as Vertices
// and Movement: drag a handle to turn around X, Y or Z in world space.
// at: world pivot; camera: the preview camera (snapshot.camera).
// onBegin() → onTurn(axis [x,y,z] in world space, degrees from the start) … →
// onEnd() or onCancel() (Escape or a lost pointer).
const ring=handle=>handle.points.map(p=>p.x+','+p.y).join(' ');
export function useStageRotate({at,camera,width,height,preferences,onBegin,onTurn,onEnd,onCancel}) {
  const canvas=useRef(null),drag=useRef(null),frame=useRef(null),latest=useRef(null),[hover,setHover]=useState(null),[active,setActive]=useState(null);
  // The per-frame redraw must use this render's drawing (size, handles, hover), never the
  // first render's: a stale size of 0 blanked the gizmo every frame of a drag.
  latest.current={onTurn,draw:()=>draw()};
  frame.current||=createFrameCoalescer(()=>{const d=drag.current;if(d?.turn)latest.current.onTurn(...d.turn);latest.current.draw();});
  useEffect(()=>()=>frame.current.cancel(),[]);
  useWindowKeyClaim(({event})=>{if(event.key!=='Escape'||!drag.current)return false;abort();return true;},0);
  const appearance=viewportAppearanceOptions(preferences).controllers;
  const shown=!!(at&&camera&&width&&height)||!!drag.current;
  let handles=[];
  if(shown&&!drag.current){
    const world=new Vector3().fromArray(at),screen=world.clone().project(camera);
    handles=movementAxisHandles({world,x:(screen.x+1)*width/2,y:(1-screen.y)*height/2,visible:screen.z>=-1&&screen.z<=1},camera,width,height,1,'world','rotate',appearance);
  }
  // A drag keeps the handles it started with, so preview refreshes cannot make them jump.
  if(drag.current)handles=drag.current.handles;
  const live=useRef(handles);live.current=handles;
  function draw() {
    const element=canvas.current;if(!element||!(width>0&&height>0))return;
    const ratio=window.devicePixelRatio||1,w=Math.round(width*ratio),h=Math.round(height*ratio);
    if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
    const context=element.getContext('2d');context.clearRect(0,0,element.width,element.height);
    const feedback=drag.current?.rotation||null;
    drawMovementGizmo(context,rotationDisplayHandles(live.current,feedback),ratio,drag.current?.handle.axis||hover,appearance);
    drawGizmoRotationFeedback(context,feedback,ratio);
  }
  useLayoutEffect(draw);
  const local=event=>{const box=event.currentTarget.ownerSVGElement.getBoundingClientRect();return {x:(event.clientX-box.left)*width/(box.width||width),y:(event.clientY-box.top)*height/(box.height||height)};};
  function start(event,own) {
    event.preventDefault();event.stopPropagation();
    const {x,y}=local(event),handle=pickMovementHandle(handles,x,y,'rotate',12)||own;
    event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();
    const rotation=beginGizmoRotation({x,y,world:new Vector3().fromArray(at),camera,width,height,handle,preferences,editor:'emtr'});
    drag.current={handle,handles,rotation,x,y,box:event.currentTarget.ownerSVGElement.getBoundingClientRect(),sensitivity:pointerSensitivityValue(preferences?.pointerSensitivity)};
    setActive(handle.axis);onBegin?.();
  }
  function move(event) {
    const d=drag.current;if(!d)return;
    // Every sample counts: a ring turn follows the path the pointer took.
    for(const sample of [...(event.nativeEvent.getCoalescedEvents?.()||[]),event]){
      const x=(sample.clientX-d.box.left)*width/(d.box.width||width),y=(sample.clientY-d.box.top)*height/(d.box.height||height);
      rotationDragDegrees(d.rotation,x-d.x,y-d.y,d.sensitivity,sample.shiftKey);
    }
    const axis=d.rotation.axisName;
    if(axis)d.turn=[d.rotation.directions[axis].toArray(),d.rotation.degrees];
    frame.current.schedule();
  }
  function end(){frame.current.flush();if(!drag.current)return;drag.current=null;setActive(null);onEnd?.();}
  function abort(){frame.current.cancel();if(!drag.current)return;drag.current=null;setActive(null);onCancel?.();}
  function nudge(event,handle) {
    if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    onBegin?.();onTurn(handle.direction.toArray(),['ArrowRight','ArrowUp'].includes(event.key)?1:-1);onEnd?.();
  }
  const element=shown&&<canvas className="pe-rotate-gizmo" aria-hidden="true" data-active-handle={active||hover||''} ref={canvas}/>;
  const targets=shown&&handles.map(handle=>{
    return <g key={handle.axis} className="pe-rotate-handle" role="slider" tabIndex={0} aria-label={'Rotate '+handle.axis} data-axis={handle.axis}
      onPointerDown={event=>start(event,handle)} onPointerMove={move} onPointerUp={end} onPointerCancel={abort} onKeyDown={event=>nudge(event,handle)}
      onPointerEnter={()=>setHover(handle.axis)} onPointerLeave={()=>setHover(axis=>axis===handle.axis?null:axis)}>
      {handle.ring?<polyline points={ring(handle)}/>:<><line x1={handle.startX} y1={handle.startY} x2={handle.x} y2={handle.y}/><circle cx={handle.x} cy={handle.y} r="12"/></>}
      <title>Drag to rotate. Hold Shift for fine control.</title>
    </g>;
  });
  return {canvas:element,targets:targets||null,dragging:!!active};
}
