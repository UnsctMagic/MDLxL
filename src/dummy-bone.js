import { createNode } from './editor-document.js';
import { canonicalizeSerializedNodeOrder, serializedNodes } from './node-id-order.js';

const validPivot = value => value && value.length === 3 && Array.from(value).every(Number.isFinite);
const identity = () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

/**
 * Repair the shared rigid-import anchor as part of the surrounding undoable
 * import. Name collisions keep their nodes and bindings; only the chosen Bone
 * becomes the root anchor.
 */
export function ensureDummyBone(model, { weighted = false } = {}) {
  const named = serializedNodes(model).filter(node => node?.Name === 'DummyBone');
  let bone = named.find(node => (model.Bones || []).includes(node));
  const usedNames = new Set(serializedNodes(model).map(node => node.Name));
  for (const node of named) if (node !== bone) {
    let suffix = 2;
    while (usedNames.has(`DummyBone_${suffix}`)) suffix++;
    node.Name = `DummyBone_${suffix}`; usedNames.add(node.Name);
  }
  if (bone) {
    const nodes = serializedNodes(model), otherIds = new Set(nodes.filter(node => node !== bone).map(node => node.ObjectId));
    if (!Number.isInteger(bone.ObjectId) || bone.ObjectId < 0 || bone.ObjectId > 1000000 || otherIds.has(bone.ObjectId)) {
      const oldId = bone.ObjectId;
      const pivot = model.PivotPoints?.[oldId];
      bone.ObjectId = 0; while (otherIds.has(bone.ObjectId)) bone.ObjectId++;
      if (validPivot(pivot)) (model.PivotPoints ||= [])[bone.ObjectId] = pivot;
      if (!otherIds.has(oldId)) {
        for (const node of nodes) if (oldId != null && oldId !== -1 && node.Parent === oldId) node.Parent = bone.ObjectId;
        for (const geoset of model.Geosets || []) {
          geoset.Groups = (geoset.Groups || []).map(group => group.map(id => id === oldId ? bone.ObjectId : id));
          for (let offset = 0; offset < (geoset.SkinWeights?.length || 0); offset += 8) for (let influence = 0; influence < 4; influence++)
            if (geoset.SkinWeights[offset + 4 + influence] && geoset.SkinWeights[offset + influence] === oldId) geoset.SkinWeights[offset + influence] = bone.ObjectId;
        }
      }
    }
    if (bone.Parent != null && bone.Parent !== -1) bone.Parent = null;
    if (bone.GeosetId != null && bone.GeosetId !== -1) bone.GeosetId = null;
    if (bone.GeosetAnimId != null && bone.GeosetAnimId !== -1) bone.GeosetAnimId = null;
    const pivot = validPivot(model.PivotPoints?.[bone.ObjectId]) ? model.PivotPoints[bone.ObjectId] : validPivot(bone.PivotPoint) ? bone.PivotPoint : new Float32Array(3);
    bone.PivotPoint = pivot; (model.PivotPoints ||= [])[bone.ObjectId] = pivot;
    for (const pose of model.BindPoses || []) {
      const cameraStart = pose.Matrices.length - (model.Cameras?.length || 0);
      if (bone.ObjectId < cameraStart && pose.Matrices[bone.ObjectId]) continue;
      const matrices = Array.from({ length: Math.max(0, bone.ObjectId - cameraStart + 1) }, identity);
      pose.Matrices.splice(cameraStart, 0, ...matrices);
      pose.Matrices[bone.ObjectId] = identity();
    }
  }
  canonicalizeSerializedNodeOrder(model, { preserveUnusedPivots: true });
  if (!bone) { bone = createNode(model, 'Bone'); bone.Name = 'DummyBone'; }
  // Put a high-index anchor in an available skin-index slot without moving an
  // existing weighted bone beyond the destination format's index capacity.
  const maximum = model.Version >= 1400 ? 65535 : 255, index = model.Bones.indexOf(bone);
  if (weighted && index > maximum) {
    const weightedIds = new Set();
    for (const geoset of model.Geosets || []) for (let offset = 0; offset < (geoset.SkinWeights?.length || 0); offset += 8)
      for (let influence = 0; influence < 4; influence++) if (geoset.SkinWeights[offset + 4 + influence]) weightedIds.add(geoset.SkinWeights[offset + influence]);
    const slot = model.Bones.findIndex((node, position) => position <= maximum && !weightedIds.has(node.ObjectId));
    if (slot >= 0) [model.Bones[slot], model.Bones[index]] = [bone, model.Bones[slot]];
  }
  canonicalizeSerializedNodeOrder(model, { preserveUnusedPivots: true });
  return bone;
}
