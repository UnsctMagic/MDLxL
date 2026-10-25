import {measureModelParts,measurePart} from './sd-model-metrics.js';
import {SD_PART_TARGETS} from './sd-knowledge.js';
/** Read-only diagnostics. No decimation, smoothing, welding or geometry edits.
 * Contact boxes are explicitly hints; intentional gaps/overlap need images. */
export function inspectSdModel(model,{before,parts=[]}={}) {
  const measured=measureModelParts(model),baseline=before?measureModelParts(before):[];
  for(const p of parts) {
    const g=model.Geosets?.[p.geosetId];
    if(!g||!SD_PART_TARGETS[p.kind]||!Array.isArray(p.faces)||!p.faces.length||p.faces.some(f=>!Number.isInteger(f)||f<0||f>=g.Faces.length/3))throw Error('SD part measurements need a known kind, geosetId and explicit valid triangle ids.');
    measured.push({...measurePart(g,[...new Set(p.faces)]),geosetId:p.geosetId,kind:p.kind,label:p.label||p.kind,method:'explicit review triangle ids',confidence:'user/agent annotated'});
    const old=before?.Geosets?.[p.geosetId];
    if(old&&p.faces.every(f=>f<old.Faces.length/3))baseline.push({...measurePart(old,[...new Set(p.faces)]),geosetId:p.geosetId,kind:p.kind,label:p.label||p.kind});
  }
  const warnings=[];
  for(const p of measured) {
    const target=SD_PART_TARGETS[p.kind],old=baseline.find(b=>b.geosetId===p.geosetId&&b.kind===p.kind&&b.label===p.label&&b.boneId===p.boneId&&b.componentId===p.componentId);
    p.target=target||null;
    p.sourceTriangles=old?.triangles??null;
    if(target&&p.triangles>target.triangles[1]&&(!old||p.triangles>old.triangles))warnings.push({kind:'too dense',part:p.label,geosetId:p.geosetId,actual:p.triangles,startingRange:target.triangles,observation:'New/increased part exceeds its ordinary game-camera target. Simplify unless the requested silhouette/articulation justifies it.'});
    const sideTarget=target?.sides??6;
    if(p.round&&p.round.sides>sideTarget&&(!old?.round||p.round.sides>old.round.sides))warnings.push({kind:'too round',part:p.label,geosetId:p.geosetId,actual:p.round.sides,startingSides:sideTarget,observation:'Measured polygon rings have more sides than the starting construction target; inspect the outline and simplify.'});
    if(p.round&&p.smoothCornerFraction>.8&&(!old||p.smoothCornerFraction>(old.smoothCornerFraction??0)+.1))warnings.push({kind:'smooth shading',part:p.label,geosetId:p.geosetId,actual:p.smoothCornerFraction,observation:'Most normals smooth across the measured round surface. Check faceted SD form; do not globally recalculate authored normals.'});
  }
  const contacts=[];
  const components=measured.filter(p=>p.method.startsWith('positional'));
  const height=components.length?Math.max(...components.map(p=>p.bounds.max[2]))-Math.min(...components.map(p=>p.bounds.min[2])):0;
  for(let i=0;i<Math.min(components.length,128);i++) {
    const a=components[i];let nearest=null;
    for(let j=0;j<Math.min(components.length,128);j++){if(i===j)continue;const b=components[j];const gaps=[0,1,2].map(k=>Math.max(0,a.bounds.min[k]-b.bounds.max[k],b.bounds.min[k]-a.bounds.max[k])),distance=Math.hypot(...gaps);if(!nearest||distance<nearest.distance)nearest={part:measured.indexOf(b),distance};}
    if(nearest&&nearest.distance>Math.max(.01,height*.02))contacts.push({part:measured.indexOf(a),nearestPart:nearest.part,gap:nearest.distance,status:'possible floating part; verify the actual surface and intended attachment in every view'});
  }
  for(let i=0;i<Math.min(components.length,128)&&contacts.length<32;i++)for(let j=i+1;j<Math.min(components.length,128)&&contacts.length<32;j++) {
    const a=components[i],b=components[j],overlap=[0,1,2].map(k=>Math.min(a.bounds.max[k],b.bounds.max[k])-Math.max(a.bounds.min[k],b.bounds.min[k]));
    if(overlap.every(v=>v>0))contacts.push({part:measured.indexOf(a),otherPart:measured.indexOf(b),overlap,status:'possible clipping or intentional overlap; boxes alone cannot distinguish these. Inspect the actual surfaces in every view.'});
  }
  return {parts:measured.map(({bounds,...p})=>p),warnings,contacts,contactCoverage:{tested:Math.min(components.length,128),total:components.length},contactMethod:'AABB separation/overlap hints only; overlapping boxes do not prove surface contact or clipping. Inspect every join in the returned images.',unclassified:measured.filter(p=>!p.kind).length,note:'Targets are guidance for ordinary new parts, not global caps. Unchanged source density is preserved. Explicit part triangles improve classifications; visual and animation inspection remain required.'};
}
