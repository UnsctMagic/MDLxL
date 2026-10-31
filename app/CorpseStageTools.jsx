import React,{useEffect,useRef} from 'react';
import {useWindowKeyClaim} from './Hotkeys.jsx';
import {createFrameCoalescer} from './viewport-performance.js';
import {particleAxisMapping} from '../src/particle-handles.js';
import {movementDragAmount} from './movement-overlay.js';
// Corpse piece handles in the Auto Corpse preview. Same handles, look and keys
// as EMTR/Glow Up: the middle moves a piece like an emitter, the two ends
// stretch it like a ribbon's edges, the side handle sets its width like the
// spawn width, and the handle above the middle raises or lowers it like a
// ribbon's edge handle. Only the double-clicked piece shows handles. Escape
// cancels a drag; arrow keys nudge.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
// show(point, raise) places a piece point in the preview at that piece's raise.
export const pieceMarks=(pieces,selected,show)=>{
  const marks={};
  pieces.forEach((piece,k)=>{marks[k+'s']={point:show(piece.start,piece.raise||0)};marks[k+'e']={point:show(piece.end,piece.raise||0)};});
  const piece=pieces[selected];
  if(piece) {
    const raise=piece.raise||0,at=point=>show(point,raise);
    const mid=piece.start.map((v,a)=>(v+piece.end[a])/2),len=Math.hypot(piece.end[0]-piece.start[0],piece.end[1]-piece.start[1])||1,normal=[(piece.end[1]-piece.start[1])/len,-(piece.end[0]-piece.start[0])/len];
    marks.mid={point:at(mid)};marks.midX={point:at([mid[0]+1,mid[1],mid[2]])};marks.midY={point:at([mid[0],mid[1]+1,mid[2]])};marks.midZ={point:show(mid,raise+1)};
    marks.side={point:at([mid[0]+normal[0]*piece.half,mid[1]+normal[1]*piece.half,mid[2]])};
    for(const [i,[a,b]] of [[1,1],[1,-1],[-1,-1],[-1,1]].entries())marks['corner'+i]={point:at([(a>0?piece.end:piece.start)[0]+normal[0]*piece.half*b,(a>0?piece.end:piece.start)[1]+normal[1]*piece.half*b,mid[2]])};
  }
  return marks;
};
// moveOnly (Blood): points with only the move handle; others show as dots.
export default function CorpseStageTools({snapshot,pieces,selected,moveOnly=false,onSelect,onChange,onDrag}) {
  const drag=useRef(null),follow=useRef(null),frame=useRef(null),raw=snapshot?.marks;
  // Each piece change rebuilds the corpse: follow the pointer once per frame.
  frame.current||=createFrameCoalescer(()=>follow.current?.());
  useEffect(()=>()=>frame.current.cancel(),[]);
  // Like Glow Up: Escape during a drag cancels the drag before the window's Close takes it.
  useWindowKeyClaim(({event})=>{
    const d=drag.current;if(event.key!=='Escape'||!d)return false;
    frame.current.cancel();drag.current=null;onChange(selected,d.before);onDrag?.(false);return true;
  },0);
  if(!raw||!pieces)return null;
  // A just-added piece has no projected marks until the preview draws again.
  const marks=Object.fromEntries(Object.entries(raw).filter(([,p])=>p&&Number.isFinite(p[0])&&Number.isFinite(p[1])));
  const ends=k=>marks[k+'s']&&marks[k+'e'];
  // A small or distant piece (a skull far away) squeezes its handles onto
  // one spot. Draw each at least 34 px from the middle so every one can be
  // grabbed; the drag still moves the real end, width or piece.
  const apart=(point,other)=>{
    const m=marks.mid;if(!point||!m)return point;
    let dx=point[0]-m[0],dy=point[1]-m[1],d=Math.hypot(dx,dy);
    if(d>=34)return point;
    if(d<1e-3){if(other){dx=m[0]-other[0];dy=m[1]-other[1];}else{const s=marks[selected+'s'],e=marks[selected+'e'];dx=-(e?.[1]-s?.[1])||0;dy=(e?.[0]-s?.[0])||1;}d=Math.hypot(dx,dy)||1;}
    return [m[0]+dx/d*34,m[1]+dy/d*34,...point.slice(2)];
  };
  const piece=ends(selected)&&marks.corner0&&marks.corner1&&marks.corner2&&marks.corner3&&marks.mid?pieces[selected]:null;
  const grips=piece&&!moveOnly?[apart(marks[selected+'s'],marks[selected+'e']),apart(marks[selected+'e'],marks[selected+'s']),apart(marks.side,null)]:[];
  // Up from the middle, at least 48 px away and clear of the other handles.
  // Looking straight down there is no up to drag: turn the camera.
  const up=piece&&!moveOnly&&marks.midZ?particleAxisMapping(marks.mid,marks.midZ):null;
  const above=d=>[marks.mid[0]+up.dx*up.unitsPerPixel*d,marks.mid[1]+up.dy*up.unitsPerPixel*d];
  let raised=null;
  for(let d=48;up&&d<=192&&!raised;d+=24)if(grips.every(g=>!g||Math.hypot(g[0]-above(d)[0],g[1]-above(d)[1])>=30))raised=above(d);
  if(up&&!raised)raised=above(48);
  // Screen movement for one piece unit along X and Y on the ground (Size is
  // already in the marks), latched when the drag starts; the drag inverts it
  // into a ground-plane move, so the piece stays under the pointer.
  function basis(){if(!marks.mid||!marks.midX||!marks.midY)return null;const ex=sub(marks.midX,marks.mid),ey=sub(marks.midY,marks.mid),det=ex[0]*ey[1]-ex[1]*ey[0];return Math.abs(det)>1e-6?{ex,ey,det}:null;}
  function next(d,dx,dy) {
    if(d.kind==='raise')return {...d.before,raise:(d.before.raise||0)+movementDragAmount(d.axis,dx,dy,'move')};
    const m=d.basis,wx=(dx*m.ey[1]-dy*m.ey[0])/m.det,wy=(m.ex[0]*dy-m.ex[1]*dx)/m.det,b=d.before,shift=p=>[p[0]+wx,p[1]+wy,p[2]];
    if(d.kind==='move')return {...b,start:shift(b.start),end:shift(b.end)};
    if(d.kind==='start')return {...b,start:shift(b.start)};
    if(d.kind==='end')return {...b,end:shift(b.end)};
    const len=Math.hypot(b.end[0]-b.start[0],b.end[1]-b.start[1])||1,normal=[(b.end[1]-b.start[1])/len,-(b.end[0]-b.start[0])/len];
    return {...b,half:Math.max(.5,b.half+wx*normal[0]+wy*normal[1])};
  }
  const set=value=>onChange(selected,moveOnly?value:{...value,free:true});
  function begin(kind){if(kind==='raise')return up&&{kind,axis:up,before:structuredClone(piece)};const m=basis();return m&&{kind,basis:m,before:structuredClone(piece)};}
  function start(event,kind) {
    event.preventDefault();event.stopPropagation();
    const d=begin(kind);if(!d)return;
    event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();
    drag.current={...d,x:event.clientX,y:event.clientY};onDrag?.(true);
  }
  function move(event){const d=drag.current;if(!d)return;const dx=event.clientX-d.x,dy=event.clientY-d.y;if(dx===0&&dy===0)return;d.delta=[dx,dy];frame.current.schedule();}
  function applyMove(){const d=drag.current;if(d?.delta)set(next(d,...d.delta));}
  follow.current=applyMove;
  function end(){frame.current.flush();if(drag.current)onDrag?.(false);drag.current=null;}
  function abort(){frame.current.cancel();const d=drag.current;drag.current=null;if(d){onChange(selected,d.before);onDrag?.(false);}}
  const handle=(point,kind,label,className)=>point&&<g role="slider" tabIndex={0} aria-label={label} className={className} onPointerDown={event=>start(event,kind)} onPointerMove={move} onPointerUp={end} onPointerCancel={abort} onKeyDown={event=>{
    if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();abort();}
    if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const d=begin(kind);if(d)set(next(d,event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0,event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0));}
  }}><circle className="pe-grab" cx={point[0]} cy={point[1]} r="20"/><circle cx={point[0]} cy={point[1]} r="7"/><title>{label}</title></g>;
  return <svg className="pe-stage-tools acp-stage-tools" viewBox={'0 0 '+snapshot.width+' '+snapshot.height} aria-label="Corpse piece handles">
    {moveOnly&&pieces.map((_,k)=>k!==selected&&marks[k+'s']&&<circle key={'d'+k} className="acp-blood-dot" cx={marks[k+'s'][0]} cy={marks[k+'s'][1]} r="5" onPointerDown={event=>{event.stopPropagation();onSelect(k);}}><title>Select this blood</title></circle>)}
    {piece&&moveOnly&&handle(marks.mid,'move','Move this blood','pe-move-emitter')}
    {piece&&!moveOnly&&<>
      <polygon points={[0,1,2,3].map(i=>marks['corner'+i].slice(0,2).join(',')).join(' ')}/>
      <line x1={marks[selected+'s'][0]} y1={marks[selected+'s'][1]} x2={marks[selected+'e'][0]} y2={marks[selected+'e'][1]}/>
      {handle(grips[0],'start','Stretch from this end')}
      {handle(grips[1],'end','Stretch from this end')}
      {handle(grips[2],'width','Widen or narrow this piece')}
      {raised&&<line x1={marks.mid[0]} y1={marks.mid[1]} x2={raised[0]} y2={raised[1]}/>}
      {raised&&handle(raised,'raise','Raise or lower this piece')}
      {handle(marks.mid,'move','Move this piece','pe-move-emitter')}
    </>}
  </svg>;
}
