import { repairBounds } from './optimizexl-bounds.js';

/** Portrait edits move the rendered rig without moving its bind-pose vertices.
 * WC3 culls against sequence/geoset animation extents, so refresh those from
 * native animation samples. Keep model/mesh bounds and other sequences intact. */
export function recalculatePortraitExtents(model, indices = model.Sequences?.flatMap((sequence, index) => /portrait/i.test(sequence.Name || '') ? [index] : []) || []) {
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
