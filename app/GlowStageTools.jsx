import React,{useRef} from 'react';
import {particleAxisMapping} from '../src/particle-handles.js';
import {movementDragAmount,movementFreeScaleValues} from './movement-overlay.js';
// Glow Up handles in the EMTR preview. Same handles, look, latching and keys as
// ParticleStageTools: Move like an emitter, the ground glow's edge like the
// spawn width, the weapon glow's two ends like a ribbon's edges, and its corners
// like a particle's size corners. Escape cancels a drag; arrow keys nudge.
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export default function GlowStageTools({snapshot,glow,layout,onChange}) {
  const drag=useRef(null),marks=snapshot?.marks;
  if(!marks||!layout)return null;
  const {width,height}=snapshot,set=change=>onChange(value=>({...value,...change}));
  const weapon=glow.weapon&&marks.start&&marks.end&&marks.butt&&marks.tip&&marks.mid;
  // Latched screen-space mappings, taken when the drag starts.
  function mapping(kind) {
    if(kind==='move'){const ex=[marks.originX[0]-marks.origin[0],marks.originX[1]-marks.origin[1]],ey=[marks.originY[0]-marks.origin[0],marks.originY[1]-marks.origin[1]],det=ex[0]*ey[1]-ex[1]*ey[0];return Math.abs(det)>1e-6?{ex,ey,det}:null;}
    if(kind==='originSize')return particleAxisMapping(marks.edge,marks.edgeUnit);
    if(kind==='weaponFrom'||kind==='weaponTo'){
      // Screen movement per model unit along the weapon and its two sides; the
      // drag takes the smallest move that lands under the pointer, so the end
      // slides in the view plane like a free handle.
      const key=kind==='weaponFrom'?'start':'end',p=marks[key],columns=['along','side','other'].map(axis=>marks[key+'-'+axis]&&[marks[key+'-'+axis][0]-p[0],marks[key+'-'+axis][1]-p[1]]);
      if(!columns.every(Boolean))return null;
      const a=columns.reduce((s,c)=>s+c[0]*c[0],0),b=columns.reduce((s,c)=>s+c[0]*c[1],0),c=columns.reduce((s,c)=>s+c[1]*c[1],0),det=a*c-b*b;
      return Math.abs(det)>1e-9?{columns,inverse:[c/det,-b/det,a/det],size:layout.weapons[0].frame.size}:null;
    }
    return {};
  }
  function next(d,dx,dy) {
    const b=d.before,m=d.basis;
    if(d.kind==='move'){const wx=(dx*m.ey[1]-dy*m.ey[0])/m.det,wy=(m.ex[0]*dy-m.ex[1]*dx)/m.det;return {originOffset:[b.originOffset[0]+wx,b.originOffset[1]+wy]};}
    if(d.kind==='originSize')return {originSize:clamp(b.originSize*(d.half+movementDragAmount(m,dx,dy,'move'))/d.half,.2,5)};
    if(d.kind==='weaponFrom'||d.kind==='weaponTo'){
      const [i,j,k]=m.inverse,x=i*dx+j*dy,y=j*dx+k*dy,limits=[[-.5,1.5],[-1,1],[-1,1]];
      return {[d.kind]:d.value.map((v,axis)=>clamp(v+(m.columns[axis][0]*x+m.columns[axis][1]*y)/m.size,...limits[axis]))};
    }
    return {weaponSize:clamp(b.weaponSize*movementFreeScaleValues(dx,dy)[0],.1,5)};
  }
  const triple=v=>v==null?v:Array.isArray(v)?v:[v,0,0];
  const value=kind=>kind==='weaponFrom'?triple(glow.weaponFrom??layout.weapons[0]?.from):kind==='weaponTo'?triple(glow.weaponTo??layout.weapons[0]?.to):kind==='move'?undefined:glow[kind];
  function begin(kind){const basis=mapping(kind);return basis&&{kind,basis,before:structuredClone(glow),value:value(kind),half:layout.origin.half};}
  function start(event,kind) {
    event.preventDefault();event.stopPropagation();
    const d=begin(kind);if(!d)return;
    event.currentTarget.setPointerCapture(event.pointerId);event.currentTarget.focus();
    drag.current={...d,x:event.clientX,y:event.clientY};
  }
  function move(event){const d=drag.current;if(!d)return;const dx=event.clientX-d.x,dy=event.clientY-d.y;if(dx===0&&dy===0)return;set(next(d,dx,dy));}
  function end(){drag.current=null;}
  function abort(){const d=drag.current;drag.current=null;if(d)set(d.before);}
  const handle=(point,kind,label)=>point&&<g role="slider" tabIndex={0} aria-label={label} aria-valuenow={[value(kind)].flat()[0]} onPointerDown={event=>start(event,kind)} onPointerMove={move} onPointerUp={end} onPointerCancel={abort} onKeyDown={event=>{
    if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();abort();}
    if(['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();const d=begin(kind);if(d)set(next(d,event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0,event.key==='ArrowDown'?10:event.key==='ArrowUp'?-10:0));}
  }}><circle cx={point[0]} cy={point[1]} r="7"/><title>{label}</title></g>;
  const square=marks.mid&&[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[marks.mid[0]+a*marks.mid[4],marks.mid[1]+b*marks.mid[4]]);
  return <svg className="pe-stage-tools" viewBox={'0 0 '+width+' '+height} aria-label="Glow handles">
    {glow.origin&&marks.origin&&<>
      <polygon points={[0,1,2,3].map(i=>marks['corner'+i].slice(0,2).join(',')).join(' ')}/>
      {handle(marks.edge,'originSize','Resize origin glow')}
      <g className="pe-move-emitter">{handle(marks.origin,'move','Move origin glow')}<text x={marks.origin[0]+12} y={marks.origin[1]+20}>Move</text></g>
    </>}
    {weapon&&<g>
      <line x1={marks.start[0]} y1={marks.start[1]} x2={marks.end[0]} y2={marks.end[1]}/>
      {handle(marks.start,'weaponFrom','Weapon glow start')}{handle(marks.end,'weaponTo','Weapon glow end')}
      <polygon points={square.map(p=>p.join(',')).join(' ')}/>
      {square.map((point,index)=><React.Fragment key={index}>{handle(point,'weaponSize',index===2?'Resize weapon glow':'Resize weapon glow corner '+(index+1))}</React.Fragment>)}
      <text x={square[0][0]} y={square[0][1]-8}>Size</text>
    </g>}
  </svg>;
}
