import { Vector3 } from 'three';
import { nodePivot } from '../src/animation.js';
import { movementNodeCategories } from './preview-overlays.js';
import { objectSwitches } from '../src/object-display.js';

export function viewportOverlayOptions(props) {
  const explicit = props.overlays != null, overlays = props.overlays || {};
  const markers = !!props.showSkeleton;
  const options = {
    boneTypesBones: overlays.boneTypesBones ?? true, boneTypesHelpers: overlays.boneTypesHelpers ?? true,
    explicit,
    bones: props.editorDisplayMode === 'vertices' ? false : explicit ? !!overlays.bones : markers,
    helpers: props.editorDisplayMode === 'vertices' ? false : explicit ? !!(overlays.helpers ?? overlays.bones) : markers,
    nodes: props.editorDisplayMode === 'vertices' ? false : explicit ? !!overlays.nodes : markers,
    attachments: props.editorDisplayMode === 'vertices' ? false : explicit ? !!overlays.attachments : markers,
    particles: props.editorDisplayMode === 'vertices' ? false : explicit ? !!overlays.particles : markers,
    ribbons: props.editorDisplayMode !== 'vertices' && (explicit ? !!overlays.particles : markers),
    sounds: props.editorDisplayMode !== 'vertices' && !!overlays.sounds,
    events: props.editorDisplayMode !== 'vertices' && !!overlays.events,
    boneLines: props.editorDisplayMode === 'vertices' ? false : explicit ? !!(overlays.skeleton ?? overlays.boneLines) : markers,
    wires: explicit ? !!overlays.wires : props.mode === 'wireframe' || props.mode === 'vertices',
    vertices: explicit ? !!overlays.vertices : props.mode === 'vertices' || !!props.showVertices,
    grid: explicit ? !!overlays.grid : !!props.showGrid,
    axes: !!(props.showAxes ?? overlays.axes ?? props.showGrid),
  };
  if (props.vanilla) return options;
  // MDLxL look: lights were part of the old Nodes pile; the Objects switch shows its checked types (no lights, no collision).
  options.lights = options.nodes;
  const objects = props.editorDisplayMode === 'vertices' ? null : objectSwitches(explicit ? overlays : null);
  return objects ? { ...options, nodes: false, ...objects, lights: false } : options;
}

export function viewportNodeLayout(model, nodes) {
  const kinds = movementNodeCategories(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const groups = { bones: [], nodes: [], attachments: [], particles: [], ribbons: [], sounds: [], events: [], lights: [] }, allLinks = [], boneLinks = [];
  for (const node of nodes) {
    const kind = kinds.get(node.ObjectId) || 'nodes';
    groups[kind].push(node);
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
