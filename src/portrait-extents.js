import { portraitSequenceIndices } from './sequence-editor.js';
import { repairBounds } from './optimizexl-bounds.js';
import { createChanges } from './history-store.js';
import { NODE_COLLECTION_KEYS } from './animation.js';

/** Portrait edits move the rendered rig without moving its bind-pose vertices.
 * The animation (sequence) box is what the game is understood to cull and
 * place the unit by, so refresh it from native animation samples, and each
 * geoset's own box for that animation where the geoset keeps them. A geoset
 * without them stays without: the game runs without them (owner's in-game
 * test, 20 Nov 2026) and a model may leave them out (keepsGeosetAnimationBounds).
 * Keep model/mesh bounds and other sequences intact. */
export function recalculatePortraitExtents(model, indices = portraitSequenceIndices(model)) {
  if (!model.Geosets?.some(geoset => geoset.Vertices?.length) || !indices.length) return;
  const targets = [];
  for (const sequence of new Set(indices)) {
    if (!model.Sequences?.[sequence]) throw new Error('The portrait extent has no matching animation.');
    targets.push({ path: ['Sequences', sequence], sequence });
    model.Geosets.forEach((geoset, index) => {
      if (!geoset.Anims?.length) return;
      // Keep entries aligned with sequence indices in a short table.
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

// Every node collection except Nodes, plus pivots and timing.
const RIG_KEYS = [...NODE_COLLECTION_KEYS.slice(1), 'PivotPoints', 'GlobalSequences', 'Sequences'];
const NODE_KEYS = new Set([...NODE_COLLECTION_KEYS.slice(1), 'PivotPoints']);
/** Whether an edit's actually changed sections include nodes or pivots. */
export const nodeSectionsChanged = sections => sections.some(key => NODE_KEYS.has(key));
/** Refresh portrait extents only when an edit actually changed the rig, so an
 * unchanged commit never rewrites authored bounds. */
export function refreshPortraitExtentsAfterRigEdit(before, model) {
  if (before && RIG_KEYS.every(key => !createChanges({ [key]: before[key] }, { [key]: model[key] }, { ignore: path => path.length === 3 && path[2] === 'PivotPoint' }).length)) return false;
  recalculatePortraitExtents(model);
  return true;
}
