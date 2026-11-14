import { Vector3 } from 'three';
import { nodePivot } from '../src/animation.js';
import { OBJECT_KIND_KEYS, objectKind, objectOverlayOptions } from '../src/object-kinds.js';

export function viewportOverlayOptions(props) {
  const explicit = props.overlays != null, overlays = props.overlays || {};
  const markers = !!props.showSkeleton, vertexEditor = props.editorDisplayMode === 'vertices';
  return {
    boneTypesBones: overlays.boneTypesBones ?? true, boneTypesHelpers: overlays.boneTypesHelpers ?? true,
    explicit,
    // Legacy callers (no overlays object) show every kind with showSkeleton.
    ...objectOverlayOptions(explicit ? overlays : null, { editor: props.editorDisplayMode, markers: !explicit && markers }),
    boneLines: vertexEditor ? false : explicit ? !!(overlays.skeleton ?? overlays.boneLines) : markers,
    wires: explicit ? !!overlays.wires : props.mode === 'wireframe' || props.mode === 'vertices',
    vertices: explicit ? !!overlays.vertices : props.mode === 'vertices' || !!props.showVertices,
    grid: explicit ? !!overlays.grid : !!props.showGrid,
    axes: !!(props.showAxes ?? overlays.axes ?? props.showGrid),
  };
}

export function viewportNodeLayout(model, nodes) {
  const kinds = objectKind(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const groups = Object.fromEntries(OBJECT_KIND_KEYS.map(key => [key, []])), allLinks = [], boneLinks = [];
  for (const node of nodes) {
    const kind = kinds.get(node.ObjectId);
    groups[kind]?.push(node);
    if (node.Parent != null && byId.has(node.Parent)) {
      allLinks.push(byId.get(node.Parent), node);
      if (kind === 'bones') boneLinks.push(byId.get(node.Parent), node);
    }
  }
  return { groups, allLinks, boneLinks };
}

/** Matrix samples are identity in bind pose and include parents in animations. */
export function updateNodeOverlayPositions(model, nodes, matrices, positions) {
  const pivot = new Vector3();
  nodes.forEach((node, index) => {
    pivot.fromArray(nodePivot(model, node));
    const matrix = matrices?.get(node.ObjectId);
    if (matrix) pivot.applyMatrix4(matrix);
    pivot.toArray(positions, index * 3);
  });
  return positions;
}
