import { createNode, deleteNode } from './editor-document.js';
import { bindVertices } from './editor-commands.js';
import { checkedVertexSelection } from './mesh-tools.js';
import { vertexBones } from './part-bones.js';
import { allNodes } from './animation.js';
import { uniqueName } from './node-hierarchy.js';

const IDENTITY_BIND_POSE = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export function selectedVertexCenter(model, selection = {}) {
  const center = [0, 0, 0];
  let count = 0;
  for (const [key, indices] of Object.entries(selection)) {
    const vertices = model.Geosets?.[Number(key)]?.Vertices;
    if (!vertices) continue;
    for (const index of new Set(indices)) {
      if (!Number.isInteger(index) || index < 0 || index * 3 + 2 >= vertices.length) continue;
      for (let axis = 0; axis < 3; axis++) center[axis] += vertices[index * 3 + axis];
      count++;
    }
  }
  return count ? center.map(value => value / count) : center;
}

export function createRigNode(model, type, selection = {}) {
  if (!['Bone', 'Attachment'].includes(type)) throw new Error('Choose Bone or Attachment.');
  // Any node already named bone_newN (a helper or attachment too) takes N.
  const name = type === 'Bone' ? uniqueName('bone_new0', new Set(allNodes(model).map(node => node.Name)), n => `bone_new${n}`, 1) : 'New Ref';
  const node = createNode(model, type);
  node.Name = name;
  node.PivotPoint = new Float32Array(selectedVertexCenter(model, selection));
  model.PivotPoints[node.ObjectId] = node.PivotPoint;
  return node;
}

export function attachToBone(model, childId, parentId) {
  const child = model.Nodes?.[childId], parent = (model.Bones || []).find(bone => bone.ObjectId === parentId);
  if (!child || !parent || childId === parentId) throw new Error('Select one child and a different parent bone.');
  const seen = new Set();
  let branchRoot = null;
  for (let next = parent; next; next = model.Nodes?.[next.Parent]) {
    if (seen.has(next.ObjectId)) throw new Error('The parent chain already contains a cycle.');
    seen.add(next.ObjectId);
    if (next.ObjectId === childId) {
      // Break the descendant branch at its link to the selected node. The
      // clicked parent keeps its own parent and the rest of its chain.
      branchRoot.Parent = null;
      break;
    }
    branchRoot = next;
  }
  child.Parent = parentId;
}

export function detachFromBone(model, childId) {
  const child = model.Nodes?.[childId];
  if (!child || !(model.Bones || []).some(bone => bone.ObjectId === child.Parent)) throw new Error('Select one node with a parent bone.');
  child.Parent = null;
}

function selectedIndices(geoset, indices) {
  const { count, selected: ids } = checkedVertexSelection(geoset, indices, { streams: false, message: 'Select valid vertices first.' });
  if (geoset.VertexGroup?.length !== count) throw new Error('Vertex groups do not match the vertex count.');
  if (geoset.SkinWeights?.length && geoset.SkinWeights.length !== count * 8) throw new Error('Skin weights do not match the vertex count.');
  return ids;
}

function groupFor(geoset, boneIds) {
  let index = geoset.Groups.findIndex(group => group.length === boneIds.length && group.every((id, slot) => id === boneIds[slot]));
  if (index < 0) {
    if (geoset.Groups.length >= 256) throw new Error('Classic vertex groups are limited to 256 by the file format.');
    index = geoset.Groups.push(boneIds) - 1;
  }
  return index;
}

function writeWeights(skin, vertex, influences) {
  const offset = vertex * 8;
  skin.fill(0, offset, offset + 8);
  const total = influences.reduce((sum, item) => sum + item[1], 0);
  if (!total) return;
  let assigned = 0;
  influences.forEach(([id, weight], slot) => {
    const portion = slot === influences.length - 1 ? 255 - assigned : Math.min(255 - assigned, Math.round(weight * 255 / total));
    skin[offset + slot] = id;
    skin[offset + 4 + slot] = portion;
    assigned += portion;
  });
}

export function changeVertexBinding(model, geoset, indices, boneId, mode) {
  const ids = selectedIndices(geoset, indices);
  if (!(model.Bones || []).some(bone => bone.ObjectId === boneId)) throw new Error('Select one bone.');
  if (mode === 'hard') return bindVertices(model, geoset, ids, boneId);
  if (!['soft', 'detach'].includes(mode)) throw new Error('Unknown bone binding tool.');
  const skin = geoset.SkinWeights?.length ? geoset.SkinWeights : null;
  if (skin && boneId > (model.Version >= 1400 ? 65535 : 255)) throw new Error('Bone ID exceeds this skin format.');
  for (const vertex of ids) {
    const group = geoset.Groups[geoset.VertexGroup[vertex]] || [];
    const influences = skin
      ? Array.from({ length: 4 }, (_, slot) => [skin[vertex * 8 + slot], skin[vertex * 8 + 4 + slot]]).filter(([, weight]) => weight > 0)
      : group.map(id => [id, 1]);
    const present = influences.some(([id]) => id === boneId);
    if (mode === 'soft' && !present) {
      if (influences.length >= 4) throw new Error('A vertex supports at most four controlling bones.');
      influences.push([boneId, influences.reduce((sum, [, weight]) => sum + weight, 0) / Math.max(1, influences.length)]);
    }
    if (mode === 'detach') influences.splice(0, influences.length, ...influences.filter(([id]) => id !== boneId));
    const boneIds = [...new Set(influences.map(([id]) => id))];
    geoset.VertexGroup[vertex] = groupFor(geoset, boneIds);
    if (skin) writeWeights(skin, vertex, influences);
  }
  geoset.TotalGroupsCount = geoset.Groups.reduce((sum, group) => sum + group.length, 0);
}

export function renameRigNode(model, id, value) {
  const node = model.Nodes?.[id];
  if (!node) throw new Error('Select one object to rename.');
  const name = String(value ?? '').replace(/[\r\n\0]/g, '').trim();
  if (!name) throw new Error('An object name cannot be empty.');
  if (new TextEncoder().encode(name).length > 79) throw new Error('An object name must fit in 79 UTF-8 bytes.');
  node.Name = name;
  return name;
}

export function setBoneBillboarded(model, id, enabled) {
  const bone = (model.Bones || []).find(node => node.ObjectId === id);
  if (!bone) throw new Error('Select one bone.');
  bone.Flags = (bone.Flags || 0) & ~120 | (enabled ? 8 : 0);
}

// Selected bones/helpers, and the bones/helpers below them that follow along.
function selectedBoneFamily(model, selectedNodeIds = []) {
  const bones = [...(model.Bones || []), ...(model.Helpers || [])], boneIds = new Set(bones.map(node => node.ObjectId));
  const selected = new Set(selectedNodeIds.filter(id => boneIds.has(id))), descendants = new Set();
  if (!selected.size) return { selected, descendants };
  for (const node of bones) {
    if (selected.has(node.ObjectId)) continue;
    const seen = new Set([node.ObjectId]);
    for (let parent = node.Parent; parent != null && !seen.has(parent); parent = model.Nodes?.[parent]?.Parent) {
      if (selected.has(parent)) { descendants.add(node.ObjectId); break; }
      seen.add(parent);
    }
  }
  return { selected, descendants };
}

/**
 * One RGBA texel per node ObjectId for the Bone influence view: red marks the
 * selected bones, green marks every bone that moves with them.
 */
export function boneInfluenceMap(model, selectedNodeIds = [], size = 256) {
  const { selected, descendants } = selectedBoneFamily(model, selectedNodeIds), map = new Uint8Array(size * 4);
  for (const id of [...selected, ...descendants]) {
    if (!Number.isInteger(id) || id < 0 || id >= size) continue;
    map[id * 4] = selected.has(id) ? 255 : 0; map[id * 4 + 1] = 255; map[id * 4 + 3] = 255;
  }
  return map;
}

export function boneVertexHighlights(model, selectedNodeIds = []) {
  const { selected, descendants } = selectedBoneFamily(model, selectedNodeIds);
  if (!selected.size) return new Map();
  const colors = new Map();
  (model.Geosets || []).forEach((geoset, geosetIndex) => {
    const vertices = new Map(), count = (geoset.Vertices?.length || 0) / 3;
    for (let vertex = 0; vertex < count; vertex++) {
      const influences = vertexBones(geoset, vertex);
      if (influences.some(id => selected.has(id))) vertices.set(vertex, '#000000');
      else if (influences.some(id => descendants.has(id))) vertices.set(vertex, '#808080');
    }
    if (vertices.size) colors.set(geosetIndex, vertices);
  });
  return colors;
}

export function deleteRigNode(model, id) {
  if (!model.Nodes?.[id]) throw new Error('Select one object to delete.');
  const children = (model.Nodes || []).filter(node => node?.Parent === id);
  for (const geoset of model.Geosets || []) {
    for (const group of geoset.Groups || []) {
      for (let at = group.indexOf(id); at >= 0; at = group.indexOf(id)) group.splice(at, 1);
    }
    geoset.TotalGroupsCount = (geoset.Groups || []).reduce((sum, group) => sum + group.length, 0);
    const skin = geoset.SkinWeights;
    if (skin?.length) for (let vertex = 0; vertex < skin.length / 8; vertex++) {
      if (![0, 1, 2, 3].some(slot => skin[vertex * 8 + slot] === id && skin[vertex * 8 + 4 + slot] > 0)) continue;
      const influences = Array.from({ length: 4 }, (_, slot) => [skin[vertex * 8 + slot], skin[vertex * 8 + 4 + slot]])
        .filter(([bone, weight]) => bone !== id && weight > 0);
      writeWeights(skin, vertex, influences);
    }
  }
  const bindPoses = model.BindPoses;
  if (bindPoses?.length) model.BindPoses = [];
  let removed;
  try { removed = deleteNode(model, id); }
  finally { if (bindPoses?.length) model.BindPoses = bindPoses; }
  for (const pose of bindPoses || []) {
    const cameras = pose.Matrices.splice(pose.Matrices.length - (model.Cameras?.length || 0));
    if (pose.Matrices[id]) pose.Matrices[id] = new Float32Array(IDENTITY_BIND_POSE);
    while (pose.Matrices.length && !model.Nodes[pose.Matrices.length - 1]) pose.Matrices.pop();
    pose.Matrices.push(...cameras);
  }
  for (const child of children) child.Parent = null;
  return removed;
}

export const deleteRigBone = deleteRigNode;
