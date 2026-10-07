// Format repairs with exact local playback preservation. Sequence indices and
// durations stay authored; only absolute local timestamps are relocated.
const json=x=>JSON.stringify(x,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v);
const local=t=>t.GlobalSeqId==null||t.GlobalSeqId===-1||t.GlobalSeqId===0xffffffff;
const at=(m,path)=>path.reduce((v,k)=>v[k],m);
const validFrame=f=>Number.isInteger(f)&&f>=0&&f<=0x7fffffff;

export function visibilityInterpolationProposals(model,entries){
  const out=[];
  for(const {track,path}of entries){
    if(path.at(-1)!=='Visibility'||track.LineType!==1||!track.Keys.length)continue;
    const global=!local(track),duration=model.GlobalSequences[track.GlobalSeqId];
    const domains=global?(duration>0?[[0,duration]]:[]):model.Sequences.map(s=>Array.from(s.Interval));
    // No keys or one key in a domain is also constant. Different animations
    // may use different values; a real fade within one domain is unsupported.
    if(!domains.length||track.Keys.some((k,i)=>!validFrame(k.Frame)||i&&k.Frame<=track.Keys[i-1].Frame||
      k.Vector?.length!==1||!Number.isFinite(k.Vector[0])))continue;
    if(domains.some(([lo,hi])=>{const keys=track.Keys.filter(k=>k.Frame>=lo&&k.Frame<=hi);
      return keys.some(k=>k.Vector[0]!==keys[0].Vector[0]);}))continue;
    const sequence=global?0:Math.max(0,model.Sequences.findIndex(s=>track.Keys.some(k=>k.Frame>=s.Interval[0]&&k.Frame<=s.Interval[1])));
    out.push({id:`visibilityInterpolation:${path.join('.')}`,kind:'visibilityInterpolation',path,sequence,
      frame:model.Sequences[sequence]?.Interval[0]||0,signature:json([track,domains]),
      label:`${at(model,path.slice(0,-1)).Name||path.slice(0,-1).join('.')}: constant visibility interpolation`,
      detail:'Set Visibility interpolation to None. Values are exactly constant within every playback domain; keep every key and each animation’s visibility.'});
  }
  return out;
}

export function sequenceTimelineProposals(model,entries){
  const intervals=model.Sequences.map(s=>Array.from(s.Interval));
  if(!intervals.some(([lo],i)=>i&&lo<intervals[i-1][1]))return [];
  if(intervals.some(([lo,hi])=>!validFrame(lo)||!validFrame(hi)||lo>=hi))return [];
  const sorted=[...intervals].sort((a,b)=>a[0]-b[0]);
  // Shared boundaries and actual overlaps have ambiguous record ownership.
  if(sorted.some(([lo],i)=>i&&lo<=sorted[i-1][1]))return [];
  const moved=[];
  for(const [lo,hi]of intervals){const start=Math.max(lo,moved.length?moved.at(-1)[1]+1:lo);
    moved.push([start,start+hi-lo]);}
  if(moved.some(([,hi])=>!validFrame(hi)))return [];
  const domain=frame=>intervals.findIndex(([lo,hi])=>frame>=lo&&frame<=hi);
  const maps=frame=>{const i=domain(frame);return i<0?frame:frame+moved[i][0]-intervals[i][0];};
  const lists=[...entries.filter(e=>local(e.track)).map(e=>e.track.Keys.map(k=>k.Frame)),
    ...model.EventObjects.filter(local).map(e=>Array.from(e.EventTrack||[]))];
  for(const frames of lists){
    if(frames.some((f,i)=>!validFrame(f)||i&&f<=frames[i-1]))return [];
    // A formerly unused/setup record must not enter a relocated animation.
    if(frames.some(f=>domain(f)<0&&moved.some(([lo,hi])=>f>=lo&&f<=hi)))return [];
    const mapped=frames.map(maps).sort((a,b)=>a-b);
    if(mapped.some((f,i)=>i&&f===mapped[i-1]))return [];
  }
  const sequence=intervals.findIndex((s,i)=>s[0]!==moved[i][0]);
  return [{id:'sequenceTimeline',kind:'sequenceTimeline',sequence,frame:intervals[sequence][0],intervals:moved,
    signature:json([model.Sequences,entries.map(e=>[e.path,e.track]),model.EventObjects]),
    label:'Repair sequence timeline order without changing animation indices',
    detail:'Relocate local animation ranges and their keys/events into sequence order. Keep sequence indices, names, durations, values, controls, extents and global motion. Absolute local timestamps change.'}];
}

export function applyFormatRepair(model,fix,entries,evidenceModel){
  if(fix.kind==='visibilityInterpolation'){at(model,fix.path).LineType=0;return;}
  const intervals=evidenceModel.Sequences.map(s=>Array.from(s.Interval));
  const map=frame=>{const i=intervals.findIndex(([lo,hi])=>frame>=lo&&frame<=hi);
    return i<0?frame:frame+fix.intervals[i][0]-intervals[i][0];};
  for(const {track}of entries)if(local(track)){
    for(const key of track.Keys)key.Frame=map(key.Frame);
    track.Keys.sort((a,b)=>a.Frame-b.Frame);
  }
  for(const event of model.EventObjects)if(local(event)){
    const frames=Array.from(event.EventTrack||[],map).sort((a,b)=>a-b);
    event.EventTrack=ArrayBuffer.isView(event.EventTrack)?new event.EventTrack.constructor(frames):frames;
  }
  model.Sequences.forEach((s,i)=>{s.Interval=ArrayBuffer.isView(s.Interval)?new s.Interval.constructor(fix.intervals[i]):[...fix.intervals[i]];});
}
