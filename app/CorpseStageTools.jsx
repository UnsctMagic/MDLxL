import React,{useRef} from 'react';
// Corpse piece handles in the Auto Corpse preview. Same handles, look and keys
// as EMTR/Glow Up: the middle moves a piece like an emitter, the two ends
// stretch it like a ribbon's edges, the side handle sets its width like the
// spawn width. Only the double-clicked piece shows handles. Escape cancels a
// drag; arrow keys nudge.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
export const pieceMarks=(pieces,selected,show)=>{
  const marks={};
  pieces.forEach((piece,k)=>{marks[k+'s']={point:show(piece.start)};marks[k+'e']={point:show(piece.end)};});
  const piece=pieces[selected];
  if(piece) {
    const mid=piece.start.map((v,a)=>(v+piece.end[a])/2),len=Math.hypot(piece.end[0]-piece.start[0],piece.end[1]-piece.start[1])||1,normal=[(piece.end[1]-piece.start[1])/len,-(piece.end[0]-piece.start[0])/len];
    marks.mid={point:show(mid)};marks.midX={point:show([mid[0]+1,mid[1],mid[2]])};marks.midY={point:show([mid[0],mid[1]+1,mid[2]])};
    marks.side={point:show([mid[0]+normal[0]*piece.half,mid[1]+normal[1]*piece.half,mid[2]])};
    for(const [i,[a,b]] of [[1,1],[1,-1],[-1,-1],[-1,1]].entries())marks['corner'+i]={point:show([(a>0?piece.end:piece.start)[0]+normal[0]*piece.half*b,(a>0?piece.end:piece.start)[1]+normal[1]*piece.half*b,mid[2]])};
  }
  return marks;
};
// moveOnly (Blood): points with only the move handle; others show as dots.
export default function CorpseStageTools({snapshot,pieces,selected,scale=1,moveOnly=false,onSelect,onChange,onDrag}) {
  const drag=useRef(null),raw=snapshot?.marks;
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
  // Screen movement for one model unit along X and Y on the ground, latched
  // when the drag starts; the drag inverts it into a ground-plane move.
  function basis(){if(!marks.mid||!marks.midX||!marks.midY)return null;const ex=sub(marks.midX,marks.mid),ey=sub(marks.midY,marks.mid),det=ex[0]*ey[1]-ex[1]*ey[0];return Math.abs(det)>1e-6?{ex,ey,det}:null;}
  function next(d,dx,dy) {
    const m=d.basis,wx=(dx*m.ey[1]-dy*m.ey[0])/m.det/scale,wy=(m.ex[0]*dy-m.ex[1]*dx)/m.det/scale,b=d.before,shift=p=>[p[0]+wx,p[1]+wy,p[2]];
    if(d.kind==='move')return {...b,start:shift(b.start),end:shift(b.end)};
    if(d.kind==='start')return {...b,start:shift(b.start)};
    if(d.kind==='end')return {...b,end:shift(b.end)};
    const len=Math.hypot(b.end[0]-b.start[0],b.end[1]-b.start[1])||1,normal=[(b.end[1]-b.start[1])/len,-(b.end[0]-b.start[0])/len];
    return {...b,half:Math.max(.5,b.half+wx*normal[0]+wy*normal[1])};
  }
  const set=value=>onChange(selected,moveOnly?value:{...value,free:true});
  function begin(kind){const m=basis();return m&&{kind,basis:m,before:structuredClone(piece)};}
  function start(event,kind) {
    event.preventDefault();event.stopPropagation();
    const d=begin(kind);if(!d)return;
    event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();
    drag.current={...d,x:event.clientX,y:event.clientY};onDrag?.(true);
  }
  function move(event){const d=drag.current;if(!d)return;const dx=event.clientX-d.x,dy=event.clientY-d.y;if(dx===0&&dy===0)return;set(next(d,dx,dy));}
  function end(){if(drag.current)onDrag?.(false);drag.current=null;}
  function abort(){const d=drag.current;drag.current=null;if(d){onChange(selected,d.before);onDrag?.(false);}}
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
      {handle(apart(marks[selected+'s'],marks[selected+'e']),'start','Stretch from this end')}
      {handle(apart(marks[selected+'e'],marks[selected+'s']),'end','Stretch from this end')}
      {handle(apart(marks.side,null),'width','Widen or narrow this piece')}
      {handle(marks.mid,'move','Move this piece','pe-move-emitter')}
    </>}
  </svg>;
}
