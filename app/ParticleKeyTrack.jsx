import React from 'react';

const names={Visibility:'Visible',HeightAbove:'Upper end',HeightBelow:'Lower end',Alpha:'Intensity',Color:'Color',EmissionRate:'Amount',Translation:'Move',Rotation:'Turn',Scaling:'Scale'};

/** The selected emitter's keys in this animation, as clickable diamonds on the playhead. */
export function emitterKeyFrames(emitter,start,end){
 const frames=new Map();
 for(const [field,value]of Object.entries(emitter||{})){
  if(!Array.isArray(value?.Keys)||value.GlobalSeqId!=null&&value.GlobalSeqId>=0)continue;
  for(const key of value.Keys)if(key.Frame>=start&&key.Frame<=end){const list=frames.get(key.Frame)||[];if(!list.includes(field))list.push(field);frames.set(key.Frame,list);}
 }
 return [...frames].sort((a,b)=>a[0]-b[0]).map(([frame,fields])=>({frame,fields}));
}

export default function ParticleKeyTrack({emitter,start,end,frame,onScrub}){
 const keys=emitterKeyFrames(emitter,start,end),span=Math.max(1,end-start);
 return <div className="pe-key-track">
  <input aria-label="Particle preview playhead" type="range" min={start} max={end} step="1" value={frame} onChange={e=>onScrub(Number(e.target.value))}/>
  {keys.map(({frame:at,fields})=><button key={at} type="button" className={'pe-key-mark'+(at===Math.round(frame)?' current':'')} style={{left:`calc(6px + (100% - 12px) * ${(at-start)/span})`}}
   aria-label={'Key at frame '+at} title={'Frame '+at+': '+fields.map(field=>names[field]||field).join(', ')+'. Click to jump here.'} onClick={()=>onScrub(at)}/>)}
 </div>;
}
