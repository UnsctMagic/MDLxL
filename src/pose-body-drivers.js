import { Quaternion, Vector3 } from 'three';
import { nodeIndex } from './node-hierarchy.js';
import { isGlobalTrack } from './animation.js';

const median = values => {
  const sorted = values.slice().sort((a,b)=>a-b), middle = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2 : 0;
};

/** Evidence for choosing between native drivers of the same whole assembly.
 * Equal weighting of authored intervals and a median prevent a one-off death
 * or spawn transform from outweighing ordinary body articulation. Key density,
 * clip names and node names do not contribute. A static rig has zero motion
 * evidence; its structural body remains valid.
 */
export function poseBodyDriverMotion(model, ids, { scale = 1, tree = nodeIndex(model) } = {}) {
  const result = new Map(), intervals = (model.Sequences || []).map(sequence=>sequence.Interval).filter(interval=>interval?.length===2&&interval.every(Number.isFinite));
  const length = Math.max(Math.abs(scale),1e-6);
  for (const id of ids) {
    const node = tree.byId.get(id), clips = [];
    for (const interval of intervals) {
      const magnitude = property => {
        const track = node?.[property];
        // Global channels belong to a shared loop, not a local body gesture.
        if (!track || isGlobalTrack(track, model)) return 0;
        const keys = (track.Keys || []).filter(key=>key.Frame>=interval[0]&&key.Frame<=interval[1]&&key.Vector&&Array.from(key.Vector).every(Number.isFinite));
        if (keys.length < 2) return 0;
        const rotation = property==='Rotation', initial = rotation ? new Quaternion().fromArray(keys[0].Vector).normalize() : new Vector3().fromArray(keys[0].Vector);
        let largest = 0;
        for (const key of keys) {
          const difference = rotation ? initial.angleTo(new Quaternion().fromArray(key.Vector).normalize()) : initial.distanceTo(new Vector3().fromArray(key.Vector));
          largest = Math.max(largest,difference);
        }
        return largest;
      };
      clips.push({ rotation:magnitude('Rotation'), translation:magnitude('Translation') });
    }
    result.set(id, {
      rotation:median(clips.map(clip=>clip.rotation)), translation:median(clips.map(clip=>clip.translation)),
      score:median(clips.map(clip=>clip.rotation+clip.translation/length)), clips,
    });
  }
  return result;
}
