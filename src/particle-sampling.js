import {sampleTrack} from './animation.js';
/** Choose a useful inspection time from authored activity, without forcing visibility or rate. */
export function activeParticleSample(model){
 let chosen={sequence:0,time:model.Sequences?.[0]?.Interval?.[0]||0,score:-1};
 for(const [sequence,clip]of (model.Sequences||[]).entries()){
  const [start,end]=clip.Interval;if(!(end>start))continue;const candidates=new Set(Array.from({length:8},(_,i)=>start+(end-start)*(i+1)/9));
  for(const r of model.RibbonEmitters||[])for(const track of [r.Visibility,r.Alpha])for(const key of track?.Keys||[]){
    const duration=model.GlobalSequences?.[track.GlobalSeqId],frame=duration>0?key.Frame+Math.ceil((start-key.Frame)/duration)*duration:key.Frame;
    if(frame>=start&&frame<end){candidates.add(Math.min(end-0.001,frame+1));candidates.add(Math.min(end-0.001,frame+r.LifeSpan*500));}
  }
  for(const p of model.ParticleEmitters2||[])if(p.Squirt)for(const key of p.EmissionRate?.Keys||[])if(key.Vector[0]>0&&key.Frame>=start&&key.Frame<end)candidates.add(Math.min(end,key.Frame+Math.min(120,p.LifeSpan*500)));
  for(const time of candidates){let score=0;
   for(const p of model.ParticleEmitters2||[]){const at=(field,atTime=time)=>{const n=sampleTrack(p[field],atTime,{interval:clip.Interval,globalSequences:model.GlobalSequences,globalTime:atTime,fallback:field==='Visibility'?1:0});return Number(n?.[0]??n);};
    if(p.Squirt&&p.EmissionRate?.Keys){const duration=model.GlobalSequences[p.EmissionRate.GlobalSeqId],phase=duration>0?time%duration:time;for(const key of p.EmissionRate.Keys)if(phase>=key.Frame&&phase-key.Frame<p.LifeSpan*1000&&at('Visibility',key.Frame)>0)score+=Math.max(0,key.Vector[0]);}
    else score+=Math.max(0,at('EmissionRate'))*Math.max(0,Math.min(p.LifeSpan,(time-start)/1000))*(at('Visibility')>0?1:0);
   }
   for(const r of model.RibbonEmitters||[]){
    const at=(track,frame,fallback)=>{const n=sampleTrack(track,frame,{interval:clip.Interval,globalSequences:model.GlobalSequences,globalTime:frame,fallback});return Number(n?.[0]??n);};
    if(at(r.Alpha,time,r.Alpha?.Keys?0:1)<=0)continue;
    const from=Math.max(start,time-r.LifeSpan*1000),steps=24,step=(time-from)/steps;
    let emitting=0;for(let i=0;i<steps;i++)if(at(r.Visibility,from+(i+.5)*step,1)>0)emitting+=step;
    score+=Math.max(0,r.EmissionRate*emitting/1000);
   }
   if(score>chosen.score)chosen={sequence,time,score};
  }
 }
 return chosen;
}
