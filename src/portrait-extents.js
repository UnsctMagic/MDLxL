import { portraitSequenceIndices } from './sequence-editor.js';
import { repairBounds } from './optimizexl-bounds.js';
import { createChanges } from './history-store.js';

/** Portrait edits move the rendered rig without moving its bind-pose vertices.
 * WC3 culls against sequence/geoset animation extents, so refresh those from
 * native animation samples. Keep model/mesh bounds and other sequences intact. */
export function recalculatePortraitExtents(model, indices = portraitSequenceIndices(model)) {
  if (!model.Geosets?.some(geoset => geoset.Vertices?.length) || !indices.length) return;
  const targets = [];
  for (const sequence of new Set(indices)) {
    if (!model.Sequences?.[sequence]) throw new Error('The portrait extent has no matching animation.');
    targets.push({ path: ['Sequences', sequence], sequence });
    model.Geosets.forEach((geoset, index) => {
      // Keep entries aligned with sequence indices, including older files
      // whose geoset animation extents were omitted.
      geoset.Anims ||= [];
      while (geoset.Anims.length <= sequence) geoset.Anims.push({
        MinimumExtent: new Float32Array(geoset.MinimumExtent || [0, 0, 0]),
        MaximumExtent: new Float32Array(geoset.MaximumExtent || [0, 0, 0]),
        BoundsRadius: geoset.BoundsRadius || 0,
      });
      targets.push({ path: ['Geosets', index, 'Anims', sequence], geoset: index, sequence });
    });
  }
  repairBounds(model, { targets }, { includeGlobalKeys: true });
}

const RIG_KEYS = ['Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters', 'PivotPoints', 'GlobalSequences', 'Sequences'];
/** Refresh portrait extents only when an edit actually changed the rig, so an
 * unchanged commit never rewrites authored bounds. */
export function refreshPortraitExtentsAfterRigEdit(before, model) {
  if (before && RIG_KEYS.every(key => !createChanges({ [key]: before[key] }, { [key]: model[key] }, { ignore: path => path.length === 3 && path[2] === 'PivotPoint' }).length)) return false;
  recalculatePortraitExtents(model);
  return true;
}
