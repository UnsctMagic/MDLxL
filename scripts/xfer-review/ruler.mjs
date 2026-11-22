import { bindingChecks, compareMaterialClip, materialClip, referenceLandmarks } from './material-motion.mjs';
import { measureFistClearance } from './fist-clearance.mjs';
import { compareSubframeMotion, subframeMotion } from './subframe-motion.mjs';
// Offline XFER review. The own model identifies pieces of its mesh by vertex index.
// Sample those same vertices in the serialized result, including on donor bones that
// have animation but carry no visible skin. Neither case names nor grades are inputs.
import { Matrix4, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, sampleTrack } from '../../src/animation.js';
import { transferRig } from '../../src/anim-transfer.js';
import { vertexBoneWeights } from '../../src/part-bones.js';
import { geosetAlphaTrack } from '../../src/geoset-extras.js';
import { standSequenceIndex } from '../../src/sequence-editor.js';

const V = p => new Vector3().fromArray(p);
const median = values => values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : 0;
const radians = 180 / Math.PI;
const limbs = (rig, kind) => Object.values(rig.parts || {}).filter(p => p.limbKind === kind);
const propName = /arrow|missile|projectile|spear|javelin|rifle|weapon|sword|shield|buckler|choppa|handle|bow/i;
const missile = /arrow|missile|projectile/i;
const die = /death|decay|dissipate|portrait|birth/i;
const shapeCache = new WeakMap();

function anatomy(model) {
  if (shapeCache.has(model)) return shapeCache.get(model);
  const nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const stand = standSequenceIndex(model);
  const rig = transferRig(model, { sequence: stand });
  const owners = new Map();
  for (const p of Object.values(rig.parts || {})) for (const [ordinal, id] of p.joints.entries()) owners.set(id, { part: p, ordinal });
  const paths = new Map();
  function path(id) {
    if (!paths.has(id)) {
      const ids = [];
      for (let cur = id; nodes.has(cur) && !ids.includes(cur); cur = nodes.get(cur).Parent) ids.push(cur);
      paths.set(id, ids);
    }
    return paths.get(id);
  }
  const pieces = new Map(), props = [], wings = [];
  const geos = model.Geosets || [];
  for (let gi = 0; gi < geos.length; gi++) {
    const g = geos[gi], named = new Map();
    for (let vi = 0; vi < g.Vertices.length / 3; vi++) {
      const weights = vertexBoneWeights(g, vi);
      if (!weights.length) continue;
      const [id] = weights.reduce((best, p) => p[1] > best[1] ? p : best);
      const line = path(id), closest = line.find(n => owners.has(n));
      const point = { gi, vi, id, weight: weights };
      if (closest != null) {
        const { part, ordinal } = owners.get(closest);
        if (!pieces.has(part.key)) pieces.set(part.key, []);
        pieces.get(part.key).push({ ...point, ordinal });
      }
      const name = line.map(n => nodes.get(n)?.Name || '').find(n => propName.test(n) && !/attachment|\bref\b/i.test(n));
      if (name) {
        const family = missile.test(name) ? 'projectile' : name;
        if (!named.has(family)) named.set(family, []);
        named.get(family).push(point);
      }
      if (line.some(n => /wing/i.test(nodes.get(n)?.Name || ''))) wings.push(point);
    }
    for (const [name, points] of named) if (points.length >= 4) props.push({ gi, name, points, share: points.length * 3 / g.Vertices.length });
  }
  const data = { model, rig, stand, nodes, path, pieces, props, wings };
  shapeCache.set(model, data);
  return data;
}

function subset(points, n = 12) {
  if (points.length <= n) return points;
  return Array.from({ length: n }, (_, i) => points[Math.round(i * (points.length - 1) / (n - 1))]);
}
function visible(model, gi, index, frame) {
  const alpha = geosetAlphaTrack(model, gi);
  return sampleTrack(alpha, frame, { interval: model.Sequences[index].Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: 1 }) > 0.02;
}
function centroid(model, points, sample) {
  const centre = new Vector3();
  let n = 0;
  for (const {gi, vi} of points) {
    const g = model.Geosets?.[gi];
    if (!g || !visible(model, gi, sample.i, sample.f)) continue;
    const local = new Vector3().fromArray(g.Vertices, vi * 3);
    const weights = vertexBoneWeights(g, vi);
    for (const [id, w] of weights) {
      const m = sample.m.get(id);
      centre.addScaledVector(m ? local.clone().applyMatrix4(m) : local, w);
    }
    n++;
  }
  return n ? centre.divideScalar(n) : null;
}
function pivot(data, id, sample) {
  if (id == null || !data.nodes.has(id)) return null;
  const p = V(nodePivot(data.model, data.nodes.get(id), id));
  const matrix = sample.m.get(id);
  return matrix ? p.applyMatrix4(matrix) : p;
}
function samples(model, index, steps) {
  if (index < 0) return [];
  const [a,b] = model.Sequences[index].Interval;
  return Array.from({length: steps + 1}, (_, k) => {
    const f = Math.round(a + (b-a)*k/steps);
    return {i:index, f, m:sampleNodeMatrices(model, f, index)};
  });
}
function span(series) {
  let max = 0;
  for (const p of series) for (const q of series) max = Math.max(max, p.distanceTo(q));
  return max;
}
function distal(data, part) {
  const pts = data.pieces.get(part.key) || [];
  const end = Math.max(-1, ...pts.map(p => p.ordinal));
  return subset(pts.filter(p => p.ordinal === end));
}
function motion(data, geometry, clouds, frames, body) {
  const ranges = [];
  for (const cloud of clouds) {
    const series = [];
    for (const frame of frames) {
      const c = centroid(geometry, cloud, frame);
      if (!c) continue;
      const m = frame.m.get(body);
      if (m && Math.abs(m.determinant()) > 1e-8) c.applyMatrix4(new Matrix4().copy(m).invert());
      series.push(c);
    }
    if (series.length > 2) ranges.push(span(series));
  }
  return median(ranges) / Math.max(1, data.rig.hipHeight || 1);
}
function onlyOnTrunk(result, points) {
  const bodyIds = new Set([result.rig.body, ...(result.rig.parts.hips?.joints || []), ...(result.rig.parts.chest?.joints || [])]);
  const limbIds = new Set(Object.values(result.rig.parts || {}).filter(p => p.kind === 'limb').flatMap(p => p.joints));
  return points.every(({gi,vi}) => vertexBoneWeights(result.model.Geosets[gi], vi).every(([id]) => {
    const closest = result.path(id).find(n => bodyIds.has(n) || limbIds.has(n));
    return bodyIds.has(closest);
  }));
}
// A pair of material points stays attached to the same part after re-skinning.
// Choose front/back by the source Stand pose, then use those vertex indices forever.
function directionClouds(data, points, fraction = 0.2) {
  if (points.length < 5 || data.stand < 0) return [[],[]];
  const f = data.model.Sequences[data.stand].Interval[0];
  const sample = { m:sampleNodeMatrices(data.model,f,data.stand), i:data.stand, f };
  const facing = V(data.rig.facing || [1,0,0]);
  const ordered = points.flatMap(p=>{
    const position = centroid(data.model,[p],sample);
    return position ? [{p, x:position.dot(facing)}] : [];
  }).sort((a,b)=>a.x-b.x);
  const k = Math.max(1,Math.ceil(ordered.length*fraction));
  return [subset(ordered.slice(0,k).map(v=>v.p)),subset(ordered.slice(-k).map(v=>v.p))];
}
function skinAxis(model, clouds, frame) {
  const a=centroid(model,clouds[0],frame), b=centroid(model,clouds[1],frame);
  return a && b && a.distanceTo(b)>1 ? b.sub(a) : null;
}
function positions(data, part, frames) {
  if (!part) return [];
  return frames.map(f => pivot(data, part.marker, f)?.sub(pivot(data, part.joints[0], f) || new Vector3()).normalize());
}
function byName(model, name) {return model.Sequences.findIndex(s => s.Name.trim().toLowerCase() === name.trim().toLowerCase());}
function regular(model, pattern) {return model.Sequences.findIndex(s => s.Interval && pattern.test(s.Name.trim()));}

export function gradeMotion(ownModel, donorModel, resultModel, report = {}) {
  const own = anatomy(ownModel), donor = anatomy(donorModel), result = anatomy(resultModel);
  const metrics = {}, faults = [];
  const fault = (type, severity, detail) => faults.push({type, severity, detail});
  if (!own.rig.ok || !donor.rig.ok) return {verdict:'bad', reasons:['unreadable body'], metrics};
  const donorToResult = id => report?.donorNodes?.[id] ?? [...result.nodes.values()].find(n => n.Name === donor.nodes.get(id)?.Name)?.ObjectId;
  const resultBody = donorToResult(donor.rig.body) ?? result.rig.body;
  const walks = donorModel.Sequences.map((s,i) => /^walk/i.test(s.Name.trim()) ? i : -1).filter(i => i >= 0);
  const walk = walks.find(i => /^walk(?:\s*-?\s*\d+)?$/i.test(donorModel.Sequences[i].Name.trim())) ?? walks[0];
  const ownLegs = limbs(own.rig,'leg'), donorLegs = limbs(donor.rig,'leg');
  if (walk != null && ownLegs.length) {
    const ri = byName(resultModel,donorModel.Sequences[walk].Name);
    const rf = samples(resultModel, ri, 8), df = samples(donorModel, walk, 8);
    const ownFeet = ownLegs.map(p => distal(own,p)).filter(a => a.length);
    const donorFeet = donorLegs.map(p => distal(donor,p)).filter(a => a.length);
    metrics.donorStep = motion(donor,donorModel,donorFeet,df,donor.rig.body);
    metrics.resultStep = motion(own,resultModel,ownFeet,rf,resultBody);
    if (metrics.donorStep > 0.12 && ownFeet.length) {
      const fraction = metrics.resultStep / metrics.donorStep;
      if (metrics.resultStep < 0.06 || fraction < 0.15) fault('gait','bad','The donor steps while the model’s foot skin stays with the body.');
      else if (fraction < 0.35 && ownLegs.length !== donorLegs.length) fault('short-step','mixed','The model’s feet travel less than a third of the donor stride, relative to each body.');
    }
    if (ownLegs.length >= 4 && donorLegs.length === ownLegs.length) {
      const angles = [];
      for (const pair of ownLegs) {
        const dp = donor.rig.parts[pair.key];
        if (!dp) continue;
        const top = (data,p) => subset((data.pieces.get(p.key) || []).filter(v=>v.ordinal===0));
        const oa=top(own,pair), ob=distal(own,pair), da=top(donor,dp), db=distal(donor,dp);
        rf.forEach((f,i)=>{
          const a=centroid(resultModel,oa,f), b=centroid(resultModel,ob,f);
          const c=centroid(donorModel,da,df[i]), d=centroid(donorModel,db,df[i]);
          if (a && b && c && d && a.distanceTo(b)>1 && c.distanceTo(d)>1) angles.push(b.sub(a).angleTo(d.sub(c))*radians);
        });
      }
      metrics.legAxis = median(angles);
      const roots = (data,legs) => legs.flatMap(p => (data.pieces.get(p.key) || []).filter(v=>v.ordinal===0));
      const ownBack = directionClouds(own,roots(own,ownLegs));
      const donorBack = directionClouds(donor,roots(donor,donorLegs));
      const pitch = rf.flatMap((f,i) => {
        const axis = skinAxis(resultModel,ownBack,f), target = skinAxis(donorModel,donorBack,df[i]);
        return axis && target ? [axis.angleTo(target)*radians] : [];
      });
      metrics.backAxis = median(pitch);
      if (metrics.backAxis>80) fault('back-posture','mixed','The visible shoulder-to-hip direction lies across the donor’s back.');
      if (metrics.legAxis>90) fault('leg-posture','mixed','The model’s visible legs point into the opposite hemisphere from the donor’s.');
    }
    if (!donorFeet.length && donor.rig.parts.tail && metrics.resultStep < 0.04) {
      const tailPoints = donor.pieces.get(donor.rig.parts.tail.key) || [];
      const root = donor.rig.parts.tail.joints[0];
      const byReach = [...tailPoints].sort((a,b) => donor.path(b.id).indexOf(root)-donor.path(a.id).indexOf(root));
      const tail = motion(donor,donorModel,[subset(byReach.slice(0,Math.max(8,Math.ceil(byReach.length/5))))],df,donor.rig.body);
      metrics.tailTravel = tail;
      if (tail > 0.12) fault('tail-gait','bad','A moving tail drives the donor forward while the model’s feet remain still.');
    }
  }
  const stand = regular(donorModel,/^stand(?:\s*-?\s*\d+)?$/i);
  if (stand >= 0) {
    const ri = byName(resultModel,donorModel.Sequences[stand].Name);
    const interval = donorModel.Sequences[stand].Interval;
    const steps = Math.min(160, Math.max(16, Math.ceil((interval[1]-interval[0])/32)));
    const df = samples(donorModel,stand,steps), rf = samples(resultModel,ri,steps);
    const wings = limbs(own.rig,'wing');
    if (wings.length) {
      const wingClouds = limbs(donor.rig,'wing').map(p=>distal(donor,p));
      if (!wingClouds.length && donor.wings.length) wingClouds.push(subset(donor.wings.filter(p => /left|_l/i.test(donor.nodes.get(p.id)?.Name))),subset(donor.wings.filter(p => /right|_r/i.test(donor.nodes.get(p.id)?.Name))));
      metrics.donorFlap = motion(donor,donorModel,wingClouds,df.filter((_,i)=>i%4===0),donor.rig.body);
      metrics.resultFlap = motion(own,resultModel,wings.map(p=>distal(own,p)),rf.filter((_,i)=>i%4===0),resultBody);
      if (metrics.donorFlap > 0.12 && metrics.resultFlap < 0.16*metrics.donorFlap) fault('wings','bad','The donor flaps while the model’s wing skin stays spread.');
    }
    for (const p of limbs(donor.rig,'arm')) {
      if (!own.rig.parts[p.key]) continue;
      const mapped = {...p, marker:donorToResult(p.marker), joints:p.joints.map(donorToResult)};
      const ds = positions(donor,p,df), rs = positions(result,mapped,rf);
      let worst = 0;
      for (let i=1;i<rs.length;i++) {
        if (!rs[i] || !rs[i-1] || !ds[i] || !ds[i-1]) continue;
        const d = ds[i-1].angleTo(ds[i])*radians, r = rs[i-1].angleTo(rs[i])*radians;
        if (d < 2) worst = Math.max(worst, r - d);
      }
      metrics.armJump = Math.max(metrics.armJump || 0,worst);
    }
    if (metrics.armJump > 8) fault('jitter','bad','The result arm jumps between adjacent idle frames while the donor arm is steady.');
  }
  const attacks = resultModel.Sequences.map((s,i)=>/attack/i.test(s.Name) && !die.test(s.Name) ? i : -1).filter(i=>i>=0);
  for (const prop of own.props) {
    const points = subset(prop.points);
    if (prop.share < 0.6) continue;
    const projectile = missile.test(prop.name);
    const show = (i,ph) => {const [a,b]=resultModel.Sequences[i].Interval;return visible(resultModel,prop.gi,i,Math.round(a+(b-a)*ph));};
    const shown = attacks.some(i=>Array.from({length:17},(_,j)=>show(i,j/16)).some(Boolean));
    if (projectile) {
      if (shown && onlyOnTrunk(result,points) && !donor.props.some(p=>missile.test(p.name))) fault('projectile','bad','The model shows its own projectile attached to the torso in a donor attack.');
      continue;
    }
    if (!shown || !own.model.Geosets[prop.gi] || !own.model.Sequences[own.stand] || !visible(own.model,prop.gi,own.stand,own.model.Sequences[own.stand].Interval[0])) continue;
    if (limbs(donor.rig,'arm').length > 0 && onlyOnTrunk(result,points)) fault('grip','bad','A held piece of the model is attached to the torso.');
    const target = vertexBoneWeights(resultModel.Geosets[prop.gi],points[0].vi)[0]?.[0];
    if (target != null && result.path(target).filter(id=>/weapon|chain|flail/i.test(result.nodes.get(id)?.Name || '')).length >= 3 && !/chain|flail/i.test(prop.name)) fault('distal-weapon','mixed','A rigid weapon rides the moving end of a jointed donor weapon.');
    const donorParts = donor.props.filter(p=>!missile.test(p.name) && !/handle|shield|buckler/i.test(p.name));
    if (donorParts.length && attacks.some(i=>{
      const di=byName(donorModel,resultModel.Sequences[i].Name);if(di<0)return false;
      const [a,b]=donorModel.Sequences[di].Interval;
      return Array.from({length:17},(_,j)=>j/16).some(ph=>!show(i,ph) && donorParts.some(p=>visible(donorModel,p.gi,di,Math.round(a+(b-a)*ph))));
    })) fault('weapon-visibility','mixed','The model hides its held weapon during an attack while the donor still shows its weapon.');
  }
  // For a single four-legged animal use the mount’s head as the physical counterpart.
  // Compare motion of the two head axes in the world, including the bind re-pose.
  const walkRig = donor.rig.actors?.length > 1 && ownLegs.length >= 4 && !limbs(own.rig,'arm').length ? transferRig(donorModel,{sequence:donor.stand,actor:'walker'}) : donor.rig;
  const front = (a, p) => {
    const cloud = a.pieces.get(p?.key) || [];
    return cloud.filter(v => p?.joints.includes(a.path(v.id).find(id=>p.joints.includes(id))));
  };
  if (walkRig !== donor.rig && walkRig.parts.head && own.rig.parts.head && walk != null) {
    const head = own.rig.parts.head, pts = front(own,head);
    const cranial = (data,part) => {
      const points=[];
      data.model.Geosets.forEach((g,gi)=>{
        for(let vi=0;vi<g.Vertices.length/3;vi++)
          if(vertexBoneWeights(g,vi).some(([id])=>data.path(id).includes(part.marker))) points.push({gi,vi});
      });
      return directionClouds(data,points);
    };
    const modelHead=cranial(own,head), donorHead=cranial(donor,walkRig.parts.head);
    const angleSamples=[];
    for (const index of [stand,walk,regular(donorModel,/^attack/i)].filter((n,i,a)=>n>=0 && a.indexOf(n)===i)) {
      const df=samples(donorModel,index,8), rf=samples(resultModel,byName(resultModel,donorModel.Sequences[index].Name),8);
      rf.forEach((f,i)=>{
        const a=skinAxis(resultModel,modelHead,f), b=skinAxis(donorModel,donorHead,df[i]);
        if(a && b) angleSamples.push(a.angleTo(b)*radians);
      });
    }
    metrics.faceAngle=median(angleSamples);
    metrics.facePeak=Math.max(0,...angleSamples);
    if(metrics.faceAngle>30 && metrics.facePeak>45) fault('head','bad','The model’s face consistently points away from the mount’s face.');
    const face = V(own.rig.facing || [1,0,0]);
    const ordered = [...pts].sort((a,b)=>new Vector3().fromArray(ownModel.Geosets[a.gi].Vertices,a.vi*3).dot(face)-new Vector3().fromArray(ownModel.Geosets[b.gi].Vertices,b.vi*3).dot(face));
    const k=Math.max(1,Math.floor(ordered.length/5));
    const rf=samples(resultModel,byName(resultModel,donorModel.Sequences[walk].Name),8), df=samples(donorModel,walk,8);
    const h=walkRig.parts.head, angles=[];
    rf.forEach((f,i)=>{
      const nose=centroid(resultModel,subset(ordered.slice(-k)),f), back=centroid(resultModel,subset(ordered.slice(0,k)),f);
      const start = h.joints[0] === h.marker ? donor.nodes.get(h.marker)?.Parent : h.joints[0];
      const b=pivot(donor,start,df[i]), t=pivot(donor,h.marker,df[i]);
      if(nose && back && b && t && b.distanceTo(t)>1) angles.push(nose.sub(back).angleTo(t.sub(b))*radians);
    });
    metrics.mountHeadAngle=median(angles);
    if(metrics.mountHeadAngle>40) fault('head','bad','The model’s face points away from the walking mount’s head.');
  }
  const verdict = faults.some(f=>f.severity==='bad') ? 'bad' : faults.length ? 'mixed' : 'good';
  return {verdict,reasons:[...new Set(faults.map(f=>f.type))],metrics};
}

export function fistClearanceForModels(own, donor, result, report, include) {
  return measureFistClearance(anatomy(own), anatomy(donor), result, report, include);
}

// The recipient supplies the vertex identities. Reclassifying them on the
// export would measure whichever mesh the new binding happened to select.
export function materialChecks(own, donor, result, report, include = () => true, overlapChecks = true) {
  const native=anatomy(own), source=anatomy(donor);
  const ownMarks=referenceLandmarks(native), donorMarks=referenceLandmarks(source);
  const resultMarks=referenceLandmarks(anatomy(result));
  const wrists=Object.fromEntries(donorMarks.arms.map(a=>[a.side,report.donorNodes?.[a.marker]]));
  const nativeClips=new Map(), output=[], binding=bindingChecks(result,ownMarks,source.rig,report);
  for(const [si,seq] of donor.Sequences.entries()) {
    if(!include(seq,si) || /death|decay|dissipate|birth/i.test(seq.Name))continue;
    const oi=own.Sequences.findIndex(q=>q.Name.trim().toLowerCase()===seq.Name.trim().toLowerCase());
    if(oi>=0&&!nativeClips.has(oi))nativeClips.set(oi,materialClip(own,ownMarks,oi,null,overlapChecks));
    const a=materialClip(donor,donorMarks,si,null,overlapChecks), b=materialClip(result,ownMarks,si,wrists,overlapChecks);
    const fields=compareMaterialClip(nativeClips.get(oi),a,b,resultMarks.H,donorMarks.H,donorMarks,ownMarks,seq.Name);
    output.push({index:si,sequence:seq.Name.trim(),samples:b.frames.length,fields:{...fields,...binding}});
  }
  return output;
}
export function materialVerdict(initial, clips) {
  const failed = new Set();
  for (const clip of clips) {
    for (const [field, measurement] of Object.entries(clip.fields)) {
      if (!measurement.pass) failed.add(field);
    }
  }
  return {verdict:initial === 'good' && failed.size ? 'mixed' : initial, failures:[...failed].sort()};
}

export function gradeSweepMotion(own, donor, result, report) {
  const score = gradeMotion(own, donor, result, report);
  const checks = compareSubframeMotion(subframeMotion(donor), subframeMotion(result), report.donorNodes);
  score.metrics.subframe = checks;
  score.metrics.material = materialChecks(own, donor, result, report);
  const material = materialVerdict(score.verdict, score.metrics.material);
  score.verdict = material.verdict;
  score.reasons.push(...material.failures);
  const fists = fistClearanceForModels(own, donor, result, report);
  score.metrics.fistClearance = fists;
  if (fists.available && fists.clips.some(clip => clip.belowBand > 0)) {
    score.reasons.push('hand clearance');
    // This warning is advisory: the owner accepted 21 of the 25 flagged holds.
  }
  if (checks.some(clip => clip.unmatchedSpikes.length || clip.unmatchedKeys.length)) {
    score.verdict = 'bad';
    score.reasons.push('subframe motion');
  }
  return score;
}
