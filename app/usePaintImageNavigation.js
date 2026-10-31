import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {bindScrollSensitivity,createFrameCoalescer,pointerSensitivityValue,wheelZoomFactor} from './viewport-performance.js';
import {cameraBindings} from '../src/preferences.js';

/** Wheel zoom stays under the pointer; Mouse bindings choose image navigation. */
export function usePaintImageNavigation(scroll,image,zoom,setZoom,onNavigate,options={}){
  const current=useRef(),anchor=useRef(),pan=useRef(),[adjustingSensitivity,setAdjustingSensitivity]=useState(null);
  current.current={zoom,setZoom,onNavigate,...options};
  const zoomFrame=useRef();
  zoomFrame.current||=createFrameCoalescer(()=>{
    const p=pan.current;if(p?.type!=='zoom'||p.clientY===undefined||!image.current)return;
    const rect=image.current.getBoundingClientRect(),z=current.current.zoom;
    anchor.current={x:(p.x-rect.left)/z,y:(p.y-rect.top)/z,clientX:p.x,clientY:p.y};
    current.current.setZoom(Math.max(.05,Math.min(32,p.zoom*Math.exp(-(p.clientY-p.y)*.01*p.sensitivity))));
  });
  useEffect(()=>()=>zoomFrame.current.cancel(),[]);
  useEffect(()=>{
    const element=scroll.current;
    return bindScrollSensitivity(element,{
      getPreferences:()=>current.current.preferences,
      onChange:value=>current.current.onSensitivityChange?.(value),
      onPointerChange:value=>current.current.onPointerSensitivityChange?.(value),
      onCameraModeToggle:()=>current.current.onCameraModeToggle?.(),
      onPointerAdjustment:()=>{pan.current=null;current.current.onNavigate?.();},
      onIndicator:setAdjustingSensitivity,
      onWheel:(e,sensitivity)=>{
        if(!image.current)return;e.preventDefault();current.current.onNavigate?.();
        const rect=image.current.getBoundingClientRect(),z=current.current.zoom;
        anchor.current={x:(e.clientX-rect.left)/z,y:(e.clientY-rect.top)/z,clientX:e.clientX,clientY:e.clientY};
        current.current.setZoom(Math.max(.05,Math.min(32,z*wheelZoomFactor(e,sensitivity))));
      },
    });
  },[]);
  useLayoutEffect(()=>{
    const a=anchor.current;if(!a)return;anchor.current=null;
    const rect=image.current.getBoundingClientRect();scroll.current.scrollLeft+=rect.left+a.x*zoom-a.clientX;scroll.current.scrollTop+=rect.top+a.y*zoom-a.clientY;
  },[zoom]);
  const navigation={
    onContextMenu:e=>e.preventDefault(),
    onPointerDownCapture:e=>{
      const preferences=current.current.preferences,bindings=cameraBindings(preferences),binding=e.button===2?bindings.right:e.button===1?bindings.middle:null;
      if(!binding||binding==='none'||binding==='toggle')return;
      e.preventDefault();e.stopPropagation();current.current.onNavigate?.();
      pan.current={type:binding==='zoom'?'zoom':'pan',x:e.clientX,y:e.clientY,left:scroll.current.scrollLeft,top:scroll.current.scrollTop,zoom:current.current.zoom,sensitivity:pointerSensitivityValue(preferences?.pointerSensitivity)*(e.altKey?(preferences?.fineSensitivity??.2):1)};
      scroll.current.setPointerCapture(e.pointerId);
    },
    onPointerMoveCapture:e=>{
      const p=pan.current;if(!p)return;e.preventDefault();e.stopPropagation();
      // A zoom drag re-renders the image; follow the pointer once per frame. Panning only scrolls.
      if(p.type==='zoom'){p.clientY=e.clientY;zoomFrame.current.schedule();}
      else{scroll.current.scrollLeft=p.left+(p.x-e.clientX)*p.sensitivity;scroll.current.scrollTop=p.top+(p.y-e.clientY)*p.sensitivity;}
    },
    onPointerUpCapture:e=>{if(!pan.current)return;zoomFrame.current.flush();pan.current=null;e.stopPropagation();if(scroll.current.hasPointerCapture(e.pointerId))scroll.current.releasePointerCapture(e.pointerId);},
    onPointerCancel:()=>{zoomFrame.current.cancel();pan.current=null;},
  };
  return {navigation,adjustingSensitivity};
}
