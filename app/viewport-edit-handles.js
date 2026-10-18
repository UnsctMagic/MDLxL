import { Vector3 } from 'three';

export function projectEditHandle(point,camera,width,height) {
  const p=new Vector3(...point).project(camera);
  return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z>=-1&&p.z<=1};
}
export function pickEditHandle(handles,{end,camera}) {
  return handles.points.map(h=>({...h,screen:projectEditHandle(h.position,camera,end.width,end.height)})).filter(h=>h.screen.visible&&Math.hypot(h.screen.x-end.x,h.screen.y-end.y)<=13).sort((a,b)=>Math.hypot(a.screen.x-end.x,a.screen.y-end.y)-Math.hypot(b.screen.x-end.x,b.screen.y-end.y))[0];
}
export function drawEditHandles(canvas,handles,camera,width,height,ratio) {
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const c=canvas.getContext('2d'),project=p=>projectEditHandle(p,camera,width,height);
  c.setTransform(ratio,0,0,ratio,0,0);c.lineWidth=2;c.font='bold 11px Tahoma, sans-serif';
  for(const line of handles.lines||[]){
    const points=line.points.map(project);if(points.some(p=>!p.visible))continue;
    c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=line.color||'#a26c13';c.setLineDash(line.dashed?[5,4]:[]);c.stroke();
  }
  c.setLineDash([]);
  for(const h of handles.points){
    const p=project(h.position);if(!p.visible)continue;
    c.beginPath();c.arc(p.x,p.y,7,0,Math.PI*2);c.fillStyle=h.color||'#ffd166';c.fill();c.strokeStyle='#3f311c';c.stroke();
    c.lineWidth=3;c.strokeStyle='#f6f1e9';c.strokeText(h.label,p.x+11,p.y-9);c.fillStyle='#38250d';c.fillText(h.label,p.x+11,p.y-9);c.lineWidth=2;
  }
}
