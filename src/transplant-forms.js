import { geosetAlphaTrack, geosetVisibleIn, geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';
import { isGlobalTrack, sampleTrack } from './animation.js';
import { vertexBones } from './part-bones.js';

// A morphing model can present a separate rigid body in ordinary Stand. If
// most of that visible solid skin sits outside the recognized alternate rig,
// carry its base with the donor and keep that form through donor attacks.
export function rigidLivingForm(model, standIndex, outside) {
  const stand = model.Sequences?.[standIndex], alternate = model.Sequences?.find(s => /^stand.*alternate/i.test(s.Name));
  if (!stand || !alternate || stand === alternate || !outside.size) return null;
  const skin = new Map(), visibility = new Map();
  let visibleCount = 0, alternateCount = 0;
  for (const [gi,geo] of model.Geosets.entries()) {
    const overlay = hasOnlyAdditiveLayers(geosetMaterialLayers(model,geo));
    const alpha = geosetAlphaTrack(model,gi), show = geosetVisibleIn(model,alpha,stand);
    const other = geosetVisibleIn(model,alpha,alternate);
    const count = geo.Vertices.length/3;
    if (show && !overlay) visibleCount += count;
    if (!alpha?.Keys?.length || isGlobalTrack(alpha,model) || show === other) continue;
    visibility.set(gi,show ? sampleTrack(alpha,stand.Interval[0],{interval:stand.Interval,fallback:1}) : 0);
    if (overlay) continue;
    if (other) { alternateCount += count; continue; }
    for (let i=0; i<count; i++) {
      const ids = vertexBones(geo,i);
      for (const id of ids) if (outside.has(id)) skin.set(id,(skin.get(id) || 0)+1/ids.length);
    }
  }
  const main = [...skin].sort((a,b)=>b[1]-a[1])[0];
  if (!main || main[1] < visibleCount/2 || alternateCount < visibleCount/4) return null;
  return {carrier:main[0],visibility};
}
