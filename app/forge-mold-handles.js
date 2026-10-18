export function forgeMoldHandles(state){
  const {bounds,axis,direction,tool,center,width,amount}=state,size=Math.max(...bounds.span,1);
  const point=value=>bounds.center.map((n,a)=>a===axis?value:n),half=Math.max(bounds.span[direction]/2,size*.12),radial=half+size*.15;
  const amountPoint=point(tool==='Taper'||tool==='Twist'?bounds.max[axis]:center);
  const factor=tool==='Bend'||tool==='Twist'?size/180:tool==='Bevel'?1:half;
  amountPoint[direction]+=radial+amount*factor;
  const points=[{id:'amount',position:amountPoint,label:'Drag',color:'#ffd166'}],lines=[];
  const start=point(bounds.min[axis]),end=point(bounds.max[axis]);
  lines.push({points:[start,end],dashed:true});
  if(tool==='Bend'||tool==='Bulge'||tool==='Twist'){
    points.push({id:'center',position:point(center),label:'Center',color:'#8edbe8'});
    points.push({id:'rangeStart',position:point(center-width/2),label:'Range',color:'#fff0c2'});
    points.push({id:'rangeEnd',position:point(center+width/2),label:'Range',color:'#fff0c2'});
    lines.push({points:[point(center-width/2),point(center+width/2)],color:'#ffbd42'});
  }
  lines.push({points:[point(amountPoint[axis]),amountPoint],color:'#d49b21'});
  return {points,lines};
}
