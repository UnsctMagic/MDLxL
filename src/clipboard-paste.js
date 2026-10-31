import { TEXTURE_SLOTS } from './mdx-compatibility.js';
import { createNode, importGeosets } from './editor-document.js';
import { ensureDummyBone } from './dummy-bone.js';
import { canonicalizeSerializedNodeOrder, serializedNodes } from './node-id-order.js';
import { pasteNodesToDummy } from './node-clipboard.js';
import { applyMeshClipboardColors } from './mesh-clipboard.js';
import { adaptPasteFormat, convertHDToSD } from './paste-format.js';
import { hdContentIssues, HD_CONVERT_NOTICE } from './model-version.js';
import { forgeTangents } from './geoset-tangents.js';
import { fixPlainTrackValues, plainTrackValues } from './plain-track-values.js';

const validPivot = value => value?.length === 3 && Array.from(value).every(Number.isFinite);
const identity = () => new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

function repairNodeReferences(model, repairs) {
  const nodes = serializedNodes(model), ids = new Set(), remapped = new Map();
  const oldMatrices = (model.BindPoses || []).map(pose => pose.Matrices.slice(0, pose.Matrices.length - (model.Cameras?.length || 0)));
  for (const node of nodes) {
    const oldId = node.ObjectId;
    if (!Number.isInteger(node.ObjectId) || node.ObjectId < 0 || node.ObjectId > 1000000 || ids.has(node.ObjectId)) {
      let id = 0; while (ids.has(id) || nodes.some(other => other !== node && other.ObjectId === id)) id++;
      node.ObjectId = id;
      if (!nodes.some(other => other !== node && other.ObjectId === oldId)) remapped.set(oldId, id);
      repairs.add('Repair invalid or duplicate node IDs.');
    }
    ids.add(node.ObjectId);
    const storedPivot = model.PivotPoints?.[oldId], pivot = validPivot(storedPivot) ? storedPivot : validPivot(node.PivotPoint) ? node.PivotPoint : new Float32Array(3);
    if (!validPivot(model.PivotPoints?.[node.ObjectId]) || !validPivot(node.PivotPoint)) repairs.add('Repair missing or invalid node pivots.');
    node.PivotPoint = pivot; (model.PivotPoints ||= [])[node.ObjectId] = pivot;
  }
  model.Nodes = []; nodes.forEach(node => { model.Nodes[node.ObjectId] = node; });
  for (const node of nodes) {
    if (node.Parent != null && node.Parent !== -1 && remapped.has(node.Parent)) node.Parent = remapped.get(node.Parent);
    if (node.Parent != null && node.Parent !== -1 && !model.Nodes[node.Parent]) { node.Parent = null; repairs.add('Detach nodes from missing parents.'); }
    const seen = new Set([node.ObjectId]); let cursor = node;
    while (cursor.Parent != null && cursor.Parent !== -1) {
      if (seen.has(cursor.Parent)) { cursor.Parent = null; repairs.add('Repair circular parent links.'); break; }
      seen.add(cursor.Parent); cursor = model.Nodes[cursor.Parent]; if (!cursor) break;
    }
  }
  const missing = new Set();
  for (const geoset of model.Geosets || []) {
    geoset.Groups = (geoset.Groups || []).map(group => group.map(id => remapped.get(id) ?? id));
    for (let offset = 0; offset < (geoset.SkinWeights?.length || 0); offset += 8) for (let influence = 0; influence < 4; influence++)
      if (geoset.SkinWeights[offset + 4 + influence] && remapped.has(geoset.SkinWeights[offset + influence])) geoset.SkinWeights[offset + influence] = remapped.get(geoset.SkinWeights[offset + influence]);
    for (const id of (geoset.Groups || []).flat()) if (!model.Nodes[id]) missing.add(id);
    for (let offset = 0; offset < (geoset.SkinWeights?.length || 0); offset += 8) for (let influence = 0; influence < 4; influence++)
      if (geoset.SkinWeights[offset + 4 + influence] && !model.Nodes[geoset.SkinWeights[offset + influence]]) missing.add(geoset.SkinWeights[offset + influence]);
  }
  for (const oldId of missing) {
    const bone = createNode(model, 'Bone');
    if (Number.isInteger(oldId) && oldId >= 0 && oldId <= 1000000) {
      delete model.Nodes[bone.ObjectId]; bone.ObjectId = oldId; model.Nodes[oldId] = bone; model.PivotPoints[oldId] = bone.PivotPoint;
    } else for (const geoset of model.Geosets || []) geoset.Groups = (geoset.Groups || []).map(group => group.map(id => id === oldId ? bone.ObjectId : id));
    repairs.add('Restore missing mesh binding nodes.');
  }
  for (const [index, pose] of (model.BindPoses || []).entries()) {
    const cameraStart = pose.Matrices.length - (model.Cameras?.length || 0), cameras = pose.Matrices.slice(cameraStart), matrices = pose.Matrices.slice(0, cameraStart);
    for (const [oldId, id] of remapped) if (oldMatrices[index][oldId]) matrices[id] = oldMatrices[index][oldId];
    for (const node of serializedNodes(model)) if (!matrices[node.ObjectId]) { matrices[node.ObjectId] = identity(); repairs.add('Restore missing bind-pose matrices.'); }
    pose.Matrices = matrices.concat(cameras);
  }
  return remapped;
}

function repairDependencies(model, repairs, indices, nodeIds) {
  model.Textures ||= []; model.Materials ||= []; model.TextureAnims ||= []; model.GlobalSequences ||= [];
  const blankTexture = () => {
    let index = model.Textures.findIndex(item => item.Image === '' && !item.ReplaceableId);
    if (index < 0) index = model.Textures.push({ Image: '', ReplaceableId: 0, Flags: 0 }) - 1;
    return index;
  };
  const texture = id => {
    if (id == null || id === -1 || model.Textures[id]) return id;
    repairs.add('Replace missing texture records with a blank texture.');
    return blankTexture();
  };
  const slots = TEXTURE_SLOTS;
  const materials = new Set(), objects = nodeIds.map(id => model.Nodes?.[id]).filter(Boolean);
  const material = id => {
    if (model.Materials[id]) return id;
    repairs.add('Restore missing pasted materials.');
    return model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 0, TextureID: blankTexture(), TVertexAnimId: null, CoordId: 0, Alpha: 1 }] }) - 1;
  };
  for (const index of indices) { const geoset = model.Geosets[index]; geoset.MaterialID = material(geoset.MaterialID); materials.add(geoset.MaterialID); }
  for (const object of objects) {
    if ((model.RibbonEmitters || []).includes(object)) { object.MaterialID = material(object.MaterialID); materials.add(object.MaterialID); }
    if ((model.ParticleEmitters2 || []).includes(object)) object.TextureID = texture(object.TextureID);
  }
  for (const id of materials) for (const layer of model.Materials[id].Layers || []) {
    for (const slot of slots) {
      if (typeof layer[slot] === 'number') layer[slot] = texture(layer[slot]);
      else for (const key of layer[slot]?.Keys || []) for (const field of ['Vector', 'InTan', 'OutTan']) if (key[field]) key[field] = Int32Array.from(key[field], texture);
      if (typeof layer._MdxDefaults?.[slot] === 'number') layer._MdxDefaults[slot] = texture(layer._MdxDefaults[slot]);
    }
    if (layer.TVertexAnimId != null && layer.TVertexAnimId !== -1 && !model.TextureAnims[layer.TVertexAnimId]) { layer.TVertexAnimId = null; repairs.add('Remove missing texture-animation references.'); }
  }
  const visited = new Set();
  const tracks = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || visited.has(value)) return;
    visited.add(value);
    if (value.GlobalSeqId != null && value.GlobalSeqId !== -1 && !(model.GlobalSequences[value.GlobalSeqId] > 0)) { value.GlobalSeqId = null; repairs.add('Repair missing global-sequence references.'); }
    for (const child of Object.values(value)) tracks(child);
  };
  objects.forEach(tracks);
  for (const id of materials) {
    tracks(model.Materials[id]);
    for (const layer of model.Materials[id].Layers || []) if (model.TextureAnims[layer.TVertexAnimId]) tracks(model.TextureAnims[layer.TVertexAnimId]);
  }
  (model.GeosetAnims || []).filter(animation => indices.includes(animation.GeosetId)).forEach(tracks);
}

/** For each copied geoset whose every bound node still exists in the model
 * under the same ID and name, map the copied IDs to those nodes. */
function originalBindings(source, indices, existingNodes, builtWeights) {
  const bindings = new Map();
  for (const index of indices) {
    const geoset = source.Geosets[index], ids = new Set((geoset.Groups || []).flat());
    if (!builtWeights.has(index)) for (let offset = 0; offset < (geoset.SkinWeights?.length || 0); offset += 8) for (let influence = 0; influence < 4; influence++)
      if (geoset.SkinWeights[offset + 4 + influence]) ids.add(geoset.SkinWeights[offset + influence]);
    if (builtWeights.has(index) || !ids.size) continue;
    const nodes = new Map();
    for (const id of ids) {
      const node = existingNodes.get(id), original = source.Nodes?.[id];
      if (!node || !original || node.Name !== original.Name) break;
      nodes.set(id, node);
    }
    if (nodes.size === ids.size) bindings.set(index, nodes);
  }
  return bindings;
}

function mergeImportResults(parts) {
  const merged = { geosetIndices: [], geosetMap: {}, selection: {}, nodeMap: {}, materialMap: {}, textureMap: {}, warnings: [] };
  for (const part of parts) {
    merged.geosetIndices.push(...part.geosetIndices);
    for (const key of ['geosetMap', 'selection', 'nodeMap', 'materialMap', 'textureMap']) Object.assign(merged[key], part[key]);
    merged.warnings.push(...part.warnings.filter(warning => !merged.warnings.includes(warning)));
  }
  return merged;
}

/** Build the complete paste on copies so a repair prompt never partially edits
 * a document. Committing this model through EditorDocument.apply is one Undo. */
export function prepareClipboardPaste(model, clipboard, { parent = null, special = false, sameModel = false, targetGeoset = null } = {}) {
  const target = structuredClone(model), repairs = new Set(), source = { ...clipboard, model: structuredClone(clipboard.model) };
  const plainBefore = new Set(plainTrackValues(target).map(item => item.owner));
  const existingNodes = sameModel ? new Map(serializedNodes(target).map(node => [node.ObjectId, node])) : null;
  if (source.model.Version !== target.Version) repairs.add(`Adapt the copied objects from MDX${source.model.Version} to MDX${target.Version}${target.Version === 800 ? ' using Classic geometry and diffuse materials' : ''}.`);
  source.model = adaptPasteFormat(source.model, target.Version);
  const builtWeights = new Set();
  if (source.kind !== 'nodes' && !special && target.Version >= 900) {
    const targetHD = target.Geosets.some(geoset => geoset.SkinWeights?.length);
    if (targetHD) for (const index of source.indices) {
      const geoset = source.model.Geosets[index], count = geoset.Vertices.length / 3;
      if (!geoset.SkinWeights?.length) {
        geoset.SkinWeights = new (target.Version >= 1400 ? Uint16Array : Uint8Array)(count * 8);
        for (let offset = 0; offset < geoset.SkinWeights.length; offset += 8) geoset.SkinWeights[offset + 4] = 255;
        builtWeights.add(index);
        repairs.add('Build HD skin weights for the copied geometry.');
      }
      if (!geoset.Tangents?.length) { geoset.Tangents = forgeTangents(geoset); repairs.add('Build tangents for the copied geometry.'); }
    }
  }
  // An SD destination stays SD for every paste kind: HD content is not supported yet.
  if (!hdContentIssues(target).length && hdContentIssues(source.model).length) { source.model = convertHDToSD(source.model); repairs.add(HD_CONVERT_NOTICE); }
  const orderChanged = serializedNodes(target).some((node, index) => node.ObjectId !== index);
  repairNodeReferences(target, repairs);
  if (orderChanged) repairs.add('Repair node order and update existing mesh bindings.');
  const named = serializedNodes(target).filter(node => node.Name === 'DummyBone');
  if (!special || source.kind === 'nodes') {
    if (named.length > 1 || named.some(node => !target.Bones.includes(node))) repairs.add('Repair the shared DummyBone name and type.');
    const dummy = named.find(node => target.Bones.includes(node));
    if (dummy?.Parent != null && dummy.Parent !== -1) repairs.add('Make DummyBone a root bone.');
    if (dummy && [dummy.GeosetId, dummy.GeosetAnimId].some(id => id != null && id !== -1)) repairs.add('Clear DummyBone geoset ownership.');
    if (source.kind !== 'nodes' && source.indices.some(index => source.model.Geosets[index]?.SkinWeights?.length) && (dummy ? target.Bones.indexOf(dummy) : target.Bones.length) > (target.Version >= 1400 ? 65535 : 255)) repairs.add('Give DummyBone a usable skin-weight index.');
  }
  const sourceIds = new Set(source.kind === 'nodes' ? source.nodeIds : []);
  if (special && source.kind !== 'nodes') {
    const requireNode = id => {
      if (sourceIds.has(id)) return; sourceIds.add(id);
      const parent = source.model.Nodes?.[id]?.Parent; if (parent != null && parent !== -1) requireNode(parent);
    };
    for (const index of source.indices) {
      const geoset = source.model.Geosets[index];
      (geoset.Groups || []).flat().forEach(requireNode);
      for (let offset = 0; offset < (geoset.SkinWeights?.length || 0); offset += 8) for (let influence = 0; influence < 4; influence++) if (geoset.SkinWeights[offset + 4 + influence]) requireNode(geoset.SkinWeights[offset + influence]);
    }
  }
  repairDependencies(source.model, repairs, source.indices || [], [...sourceIds]);
  let result;
  if (source.kind === 'nodes') {
    const remapped = repairNodeReferences(source.model, repairs); source.nodeIds = source.nodeIds.map(id => remapped.get(id) ?? id);
    result = pasteNodesToDummy(target, source);
  } else if (special) {
    const sourceRemapped = repairNodeReferences(source.model, repairs);
    const parentNode = target.Nodes[parent]; canonicalizeSerializedNodeOrder(target, { preserveUnusedPivots: true });
    if (parentNode) parent = parentNode.ObjectId;
    if (parent != null && !target.Nodes[parent]) { parent = ensureDummyBone(target).ObjectId; repairs.add('Restore the missing paste parent with DummyBone.'); }
    const existingNodeMap = existingNodes && new Map([...existingNodes].map(([oldId, node]) => [sourceRemapped.get(oldId) ?? oldId, node.ObjectId]));
    if (sameModel && [...sourceIds].some(id => !existingNodeMap.has(sourceRemapped.get(id) ?? id))) { sameModel = false; repairs.add('Restore missing copied rig nodes.'); }
    result = importGeosets(target, source.model, source.indices, parent, { sameModel, targetGeoset, existingNodeMap, flattenGeosetAnimations: !sameModel });
  } else {
    // A copy pasted back into its own model keeps the bones it was bound to;
    // geometry whose bones are gone (or never existed) goes on DummyBone.
    const bones = sameModel ? originalBindings(source.model, source.indices, existingNodes, builtWeights) : new Map();
    const kept = source.indices.filter(index => bones.has(index)), loose = source.indices.filter(index => !bones.has(index));
    const weighted = loose.some(index => source.model.Geosets[index]?.SkinWeights?.length), dummy = loose.length ? ensureDummyBone(target, { weighted }) : null;
    const parts = [];
    if (kept.length) {
      const existingNodeMap = new Map(kept.flatMap(index => [...bones.get(index)].map(([id, node]) => [id, node.ObjectId])));
      parts.push(importGeosets(target, source.model, kept, null, { sameModel: true, newGeosets: true, existingNodeMap }));
    }
    if (loose.length) parts.push(importGeosets(target, source.model, loose, null, { rigidNode: dummy.ObjectId, flattenGeosetAnimations: !sameModel }));
    result = parts.length === 1 ? parts[0] : mergeImportResults(parts);
    applyMeshClipboardColors(target, result.geosetMap, source.rgbByGeoset);
  }
  // Pasted values Warcraft III keeps only as keyframes get keyframes over this model's animations.
  const plain = plainTrackValues(target).filter(item => !plainBefore.has(item.owner));
  if (plain.length) { fixPlainTrackValues(target, plain); repairs.add('Turn single animation values into keyframes.'); }
  return { model: target, result, repairs: [...repairs] };
}
