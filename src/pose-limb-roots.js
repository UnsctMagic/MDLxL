const finitePoint = point => point && [point.x, point.y, point.z].every(Number.isFinite);

/** Compare possible starts of one articulated path against its shared trunk.
 * A clavicle generally travels out through the trunk before the free limb
 * changes direction. The native pivot direction and measured trunk covariance
 * contribute together; neither joint names nor a prescribed limb count enter.
 * Scores compare starts of this path, not head/arm/leg interpretations.
 */
export function poseLimbRootEvidence(ids, { origin, pivot, jointSurface, points } = {}) {
  if (ids.length < 3) return [];
  const positions = points || ids.map(pivot), anchor = pivot(origin), trunk = jointSurface(origin);
  const lengths = positions.slice(1).map((point, i) => point.distanceTo(positions[i]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let skipped = 0;
  const result = [];
  for (let index = 0; index <= ids.length - 3; index++) {
    if (index) skipped += lengths[index - 1];
    const at = positions[index], radial = at.clone().sub(anchor), distal = positions[index + 1].clone().sub(at);
    const directionKnown = radial.lengthSq() > 1e-12 && distal.lengthSq() > 1e-12;
    const alignment = directionKnown ? radial.normalize().dot(distal.normalize()) : 0;
    const departure = (1 - Math.max(-1, Math.min(1, alignment))) / 2;
    let envelope = .5, distance = null;
    if (finitePoint(trunk?.center) && trunk.eigenvalues?.[0] > 0) {
      const delta = at.clone().sub(trunk.center), floor = trunk.eigenvalues[0] * 1e-4;
      distance = Math.sqrt(trunk.axes.reduce((sum, axis, i) => sum + delta.dot(axis) ** 2 / Math.max(trunk.eigenvalues[i], floor), 0));
      // The covariance's effective rank gives its RMS standardized radius,
      // including flat surfaces. This remains a soft proximity likelihood.
      const radius = Math.sqrt(trunk.eigenvalues.reduce((sum, value) => sum + value / Math.max(value, floor), 0));
      envelope = Math.exp(-.5 * (distance - radius) ** 2);
    }
    const removedFraction = total > 0 ? skipped / total : 0;
    const score = .75 * departure + .15 * envelope - .1 * removedFraction;
    result.push({ index, id: ids[index], score, evidence: { departure, alignment, envelope, standardizedDistance: distance, removedFraction } });
  }
  return result;
}
