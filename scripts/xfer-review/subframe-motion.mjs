import { Quaternion } from 'three';
import { allNodes, sampleNodeMatrices, skinGeoset } from '../../src/animation.js';
import { standSequenceIndex } from '../../src/sequence-editor.js';
import { surfaceVisible } from './surface-review.mjs';

const degrees = 180 / Math.PI;
const step = 2;

function shortReversals(model, sequence) {
  const [first, last] = sequence.Interval, reversals = [];
  for (const node of allNodes(model)) {
    const track = node.Rotation;
    if (!track?.Keys?.length || track.GlobalSeqId >= 0 && track.GlobalSeqId != null) continue;
    const keys = track.Keys.filter(key => key.Frame >= first && key.Frame <= last);
    for (let i = 1; i + 1 < keys.length; i++) {
      const [a, b, c] = [keys[i-1], keys[i], keys[i+1]];
      const gap = c.Frame - a.Frame;
      if (gap <= 0 || gap > 50) continue;
      const left = new Quaternion().fromArray(a.Vector);
      const right = new Quaternion().fromArray(c.Vector);
      const span = left.angleTo(right) * degrees;
      const mid = left.slerp(right, (b.Frame - a.Frame) / gap);
      const deviation = mid.angleTo(new Quaternion().fromArray(b.Vector)) * degrees;
      if (deviation >= 10 && deviation > 2 * span)
        reversals.push({node:node.ObjectId, time:b.Frame-first, deviation, gap});
    }
  }
  return reversals;
}

function surfaces(model, si, frame) {
  const matrices = sampleNodeMatrices(model, frame, si);
  return model.Geosets.map((g, i) => surfaceVisible(model, i, frame, si) ? skinGeoset(g, matrices) : null);
}

function referenceHeight(model) {
  const si = Math.max(0, standSequenceIndex(model));
  let min = Infinity, max = -Infinity;
  for (const p of surfaces(model, si, model.Sequences[si].Interval[0])) {
    if (!p) continue;
    for (let i=2; i<p.length; i+=3) {min=Math.min(min,p[i]); max=Math.max(max,p[i]);}
  }
  return max-min;
}

// Match Claude's popscan median and local-peak tests on the visible skin.
// Keep every qualifying peak. The five/six worst events suffice for display only.
export function subframeMotion(model, include = () => true) {
  const height = referenceHeight(model), clips = [];
  if (!(height > 0)) throw Error('No visible surface height at the reference pose');
  for (const [si, seq] of model.Sequences.entries()) {
    if (!include(seq,si)) continue;
    const [start,end] = seq.Interval, acceleration = [];
    let previous, older, peakSpeed=0, speedTime=0;
    for (let frame=start; frame<=end; frame+=step) {
      const now = surfaces(model,si,frame);
      let speedSquared=0, accelerationSquared=0;
      if (previous) {
        for (let gi=0; gi<now.length; gi++) {
          const p=now[gi], q=previous[gi], r=older?.[gi];
          if (!p || !q) continue;
          for (let i=0; i<p.length; i+=3) {
            const x=p[i]-q[i], y=p[i+1]-q[i+1], z=p[i+2]-q[i+2];
            speedSquared=Math.max(speedSquared,x*x+y*y+z*z);
            if (r) {
              const ax=x-q[i]+r[i], ay=y-q[i+1]+r[i+1], az=z-q[i+2]+r[i+2];
              accelerationSquared=Math.max(accelerationSquared,ax*ax+ay*ay+az*az);
            }
          }
        }
        if (speedSquared>peakSpeed) {peakSpeed=speedSquared; speedTime=frame-start;}
        if (older) acceleration.push(Math.sqrt(accelerationSquared)/height);
      }
      older=previous; previous=now;
    }
    const sorted=[...acceleration].sort((a,b)=>a-b);
    const threshold=Math.max(.01,6*(sorted[Math.floor(sorted.length/2)]??0));
    const spikes=[];
    for(let i=0;i<acceleration.length;i++) {
      const value=acceleration[i];
      if(value>threshold && value>=(acceleration[i-1]??0) && value>=(acceleration[i+1]??0))
        spikes.push({time:(i+1)*step,value});
    }
    clips.push({si,name:seq.Name.trim(),peakSpeed:Math.sqrt(peakSpeed)/height,speedTime,spikes,reversals:shortReversals(model,seq)});
  }
  return {height,clips};
}

export function compareSubframeMotion(donor, result, donorNodes = {}) {
  const checks = [];
  for (const clip of result.clips) {
    const source = donor.clips.find(c=>c.si===clip.si && c.name===clip.name);
    if (!source) throw Error('Missing matching donor clip '+clip.name);
    const unmatchedSpikes = clip.spikes.filter(p=>!source.spikes.some(d=>Math.abs(d.time-p.time)<=step));
    const unmatchedKeys = clip.reversals.filter(p=>!source.reversals.some(d=>Math.abs(d.time-p.time)<=step && donorNodes[d.node]===p.node));
    checks.push({sequence:clip.name,peakSpeed:clip.peakSpeed,donorPeakSpeed:source.peakSpeed,unmatchedSpikes,unmatchedKeys});
  }
  return checks;
}
