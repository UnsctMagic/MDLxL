// Gizmo Lab only. Authored right-hand XYZ signs derived from MDLVis 1.40
// FindAngles (oldX-x) and vRotate: XY and YZ negate that angle; XZ keeps it.
export const AXES=['X','Y','Z'];
export const NORMAL={xy:'Z',xz:'Y',yz:'X'};
export const PERPENDICULAR={X:'yz',Y:'xz',Z:'xy'};
export const MDLVIS_SIGN={xy:1,xz:-1,yz:1};
export function constrainedDegrees({plane='xy',strength=1,snap=false}={},dx,dy=0){
 const degrees=dx*MDLVIS_SIGN[plane]*strength;
 return snap?Math.round(degrees/15)*15:degrees;
}
export function beginSweep({x=0,y=0,pivot={x:0,y:0},facing=-1}={}){
 const px=x-pivot.x,py=y-pivot.y;
 return {pivot:{...pivot},previous:Math.hypot(px,py)>=8?Math.atan2(py,px):null,swept:0,sign:facing>0?-1:1};
}
// Every sample changes the wrapped path; geometry and drawing still run once/frame.
export function sweepDegrees(drag,x,y){
 const px=x-drag.pivot.x,py=y-drag.pivot.y;
 if(Math.hypot(px,py)>=8){
  const angle=Math.atan2(py,px);
  if(drag.previous!==null){const delta=angle-drag.previous;drag.swept+=Math.atan2(Math.sin(delta),Math.cos(delta));}
  drag.previous=angle;
 }
 return drag.swept*180/Math.PI*drag.sign;
}
export function facingAxis(direction){return AXES.reduce((best,axis,i)=>Math.abs(direction[i])>Math.abs(direction[AXES.indexOf(best)])?axis:best,'X');}
export function chooseLeverAxis(grabAxis,tangents,dx,dy){
 if(Math.hypot(dx,dy)<6)return null;
 return AXES.filter(axis=>axis!==grabAxis).reduce((best,axis)=>{
  const score=a=>Math.abs(tangents[a][0]*dx+tangents[a][1]*dy);
  return !best||score(axis)>score(best)?axis:best;
 },null);
}
export function dominantPlaneAxis(plane,basis,dx,dy){
 return plane.toUpperCase().split('').reduce((best,axis)=>{
  const score=a=>{const [x,y]=basis[a];return Math.abs(x*dx+y*dy)/(Math.hypot(x,y)||1);};
  return !best||score(axis)>score(best)?axis:best;
 },null);
}
export function moveConstraint(handle,shift){
 if(handle.plane)return {plane:handle.plane,axis:null,dominant:!!shift};
 return shift?{plane:PERPENDICULAR[handle.axis],axis:null,dominant:false}:{plane:null,axis:handle.axis,dominant:false};
}
