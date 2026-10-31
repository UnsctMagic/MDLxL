import React,{useEffect,useRef} from 'react';
import {createFrameCoalescer} from './viewport-performance.js';
/** The time strip is an authoring proxy; display clipping never rewrites imported values. */
export default function ParticleLifeMarker({value,begin,change,finish,cancel,onSelect}){
 const drag=useRef(null),strip=useRef(null),follow=useRef(null),frame=useRef(null);
 // Each change updates the live preview: follow the pointer once per frame.
 follow.current=()=>{const d=drag.current;if(d?.next!=null)change(d.next);};
 frame.current||=createFrameCoalescer(()=>follow.current());
 useEffect(()=>()=>frame.current.cancel(),[]);
 const end=()=>{frame.current.flush();if(drag.current){drag.current=null;finish();}};
 return <div className="pe-life-axis" ref={strip} aria-label="Particle age"><span>Born</span><span>End</span><button role="slider" aria-label="Halfway point" aria-valuemin={0} aria-valuemax={1} aria-valuenow={value} style={{left:(Math.max(0,Math.min(1,value))*100)+'%'}} onPointerDown={e=>{e.preventDefault();e.currentTarget.focus();onSelect?.(1);begin('Time');drag.current={x:e.clientX,value,width:strip.current.getBoundingClientRect().width};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const d=drag.current;if(d&&e.clientX!==d.x){d.next=Math.max(0,Math.min(1,d.value+(e.clientX-d.x)/d.width));frame.current.schedule();}}} onPointerUp={end} onPointerCancel={()=>{frame.current.cancel();drag.current=null;cancel();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();frame.current.cancel();drag.current=null;cancel();}else if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();begin('Time');change(e.key==='Home'?0:e.key==='End'?1:Math.max(0,Math.min(1,value+(e.key==='ArrowRight'?.01:-.01))));finish();}}}>◆<small>Halfway</small></button></div>;
}
