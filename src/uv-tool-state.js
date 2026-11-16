/** UV tools operate on the selection captured when the wrapper opened. `eligibleCount` is the UV
 * Wrapper's points, `triangleCount` the triangles whose three corners are selected. */
export function uvToolState({ readOnly = false, selectionCount = 0, draftCount = 0, eligibleCount = 0, triangleCount = 0 } = {}) {
  const editable = !readOnly, selected = Math.max(0, Number(selectionCount) || 0), triangles = Math.max(0, Number(triangleCount) || 0);
  // Box, Cylinder and Unwrap can add points, so like Uncouple they wait for an unsaved test texture.
  const wholeTriangles = editable && triangles > 0 && !draftCount;
  return {
    move: editable,
    rotate: editable,
    scale: editable,
    mirror: editable && selected > 0,
    uncouple: editable && selected > 0 && !draftCount,
    fold: editable && selected > 1,
    boxProjection: wholeTriangles,
    cylinderProjection: wholeTriangles,
    unwrap: wholeTriangles,
    straighten: editable && selected > 1,
    mirrorCopy: editable && selected > 0 && (Number(eligibleCount) || 0) > selected,
    relax: editable && triangles > 0,
  };
}
