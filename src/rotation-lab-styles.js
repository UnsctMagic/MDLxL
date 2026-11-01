import {beginRotationDrag,rotationDragDegrees} from './rotation-drag.js';
// Rotation Lab only. Screen x points right, y down; view-space z points at the eye.
const speed = options => options.sensitivity ?? 1;
const sign = options => (options.axis?.[2] ?? -1) > 0 ? -1 : 1;
export const circleAround = {
  begin(options = {}) {
    const x=(options.x??0)-(options.pivot?.x??0), y=(options.y??0)-(options.pivot?.y??0);
    return {px:x,py:y,previous:Math.hypot(x,y)>=12?Math.atan2(y,x):null,swept:0,sign:sign(options),sensitivity:speed(options)};
  },
  degrees(drag,dx,dy) {
    const x=drag.px+dx,y=drag.py+dy;
    if(Math.hypot(x,y)>=12) {
      const angle=Math.atan2(y,x);
      if(drag.previous!==null) {const delta=angle-drag.previous;drag.swept+=Math.atan2(Math.sin(delta),Math.cos(delta));}
      drag.previous=angle;
    }
    return drag.swept*180/Math.PI*drag.sign*drag.sensitivity;
  },
};
export const straightDrag = {
  begin: (options={}) => ({sign:sign(options),sensitivity:speed(options)}),
  degrees: (drag,dx,dy) => dx*drag.sign*drag.sensitivity,
};
export const drawnRing = {
  begin(options={}) {
    const [a,b,c]=options.axis??[0,0,-1], x=(options.x??0)-(options.pivot?.x??0),y=(options.y??0)-(options.pivot?.y??0);
    // Adjugate of the projected circle's quadratic form, then a quarter turn.
    // This avoids division by c: as the ellipse collapses, its tangent follows
    // its long direction. There is no camera-angle threshold or alternate rule.
    const facing=c>0?1:-1;
    let tx=(-a*b*x+(b*b+c*c)*y)*facing,ty=(-(a*a+c*c)*x+a*b*y)*facing;
    let length=Math.hypot(tx,ty);
    // Only the mathematically undefined grab (zero gradient) needs a direction.
    if(length===0){tx=b;ty=a;length=Math.hypot(tx,ty);if(length===0){tx=1;length=1;}}
    return {tangent:{x:tx/length,y:ty/length},sensitivity:speed(options)};
  },
  degrees: (drag,dx,dy) => (dx*drag.tangent.x+dy*drag.tangent.y)*drag.sensitivity,
};
export const freeTurn = {
  begin: (options={}) => ({sensitivity:speed(options)}),
  degrees: (drag,dx,dy) => ({up:dx*drag.sensitivity,right:dy*drag.sensitivity}),
};
export const LAB_STYLES={B:circleAround,C:straightDrag,D:drawnRing,E:freeTurn};

export const current = {begin:options=>beginRotationDrag({...options,behavior:'ring'}),degrees:rotationDragDegrees};
