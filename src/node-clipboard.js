import { createResourceImporter } from './model-import.js';
import { stableKey } from './value-key.js';
import { isGlobalTrack } from './animation.js';
import { createNode, NODE_TYPES } from './editor-document.js';
import { ensureDummyBone } from './dummy-bone.js';
import { canonicalizeSerializedNodeOrder } from './node-id-order.js';
import { adaptPasteFormat } from './paste-format.js';
import { uniqueName as freeName } from './node-hierarchy.js';

const clone = value => structuredClone(value);
const fingerprint = value => stableKey(value, { omit: ['PivotPoint'] });
const nodeType = (model, id) => Object.keys(NODE_TYPES).find(type => model[NODE_TYPES[type][0]]?.some(node => node?.ObjectId === id));

export function captureNodeSelection(model, selectedNodeIds = []) {
  const nodeIds = [...new Set(selectedNodeIds)].filter(id => Number.isInteger(id) && model.Nodes?.[id]);
  return { kind: 'nodes', model: clone(model), nodeIds };
}

/** Copy exactly the selected nodes. Selected parent/child relationships survive;
 * roots are attached to the destination's validated shared DummyBone. */
export function pasteNodesToDummy(target, clipboard) {
  const source = clipboard?.model && adaptPasteFormat(clipboard.model, target.Version), selected = new Set(clipboard?.nodeIds || []);
  if (!source || !selected.size) throw Error('Copy one or more nodes before pasting.');
  for (const id of selected) if (!source.Nodes?.[id] || !nodeType(source, id)) throw Error(`Copied node ${id} no longer exists.`);
  const dummy = ensureDummyBone(target);
  target.Textures ||= []; target.Materials ||= []; target.TextureAnims ||= []; target.GlobalSequences ||= [];
  const { requireNode, requiredNodes: ordered, globalRef: remapGlobals, textureRef, materialRef, maps } = createResourceImporter(source, target, {
    reuseTextures: 'fingerprint', reuseGlobals: true,
    validGlobalId: (id, model) => Number.isInteger(model.GlobalSequences?.[id]) && model.GlobalSequences[id] > 0,
    keyArrayType: 'int32', fingerprint, reuseMaterials: true, reuseTextureAnims: true,
    isGlobalRef: isGlobalTrack, validateMappedGlobals: true, materialSentinels: true,
    isTextureAnimRef: id => Number.isInteger(id) && id >= 0,
    parentForNode: node => selected.has(node.Parent) ? node.Parent : null,
    error: (kind, id) => ({
      cycle: 'Copied node hierarchy contains a cycle.',
      global: `Copied node references missing global sequence ${id}.`,
      texture: `Copied node references missing texture ${id}.`,
      material: `Copied node references missing material ${id}.`,
      textureAnim: `Copied node material references missing texture animation ${id}.`,
    })[kind],
  });
  const createdNodes = new Map();
  for (const id of selected) requireNode(id);
  const usedNames = new Set((target.Nodes || []).filter(Boolean).map(node => node.Name));
  const uniqueName = original => {
    if (original !== 'DummyBone' && !usedNames.has(original)) { usedNames.add(original); return original; }
    const base = `${original || 'Node'}_copy`, name = freeName(base, usedNames, n => `${base}${n}`);
    usedNames.add(name); return name;
  };
  for (const old of ordered) {
    const original = source.Nodes[old], type = nodeType(source, old), created = createNode(target, type);
    const newId = created.ObjectId, attachmentId = created.AttachmentID;
    Object.assign(created, clone(original), { ObjectId: newId, Parent: selected.has(original.Parent) ? createdNodes.get(original.Parent).ObjectId : dummy.ObjectId, Name: uniqueName(original.Name) });
    created.PivotPoint = clone(source.PivotPoints?.[old] || original.PivotPoint || new Float32Array(3)); target.PivotPoints[newId] = created.PivotPoint;
    for (const [index, pose] of (target.BindPoses || []).entries()) if (source.BindPoses?.[index]?.Matrices?.[old]) pose.Matrices[newId] = clone(source.BindPoses[index].Matrices[old]);
    if (type === 'Attachment') created.AttachmentID = attachmentId;
    if (type === 'Bone') { created.GeosetId = null; created.GeosetAnimId = null; }
    if (type === 'ParticleEmitter2') created.TextureID = textureRef(created.TextureID);
    if (type === 'RibbonEmitter') created.MaterialID = materialRef(created.MaterialID);
    remapGlobals(created); createdNodes.set(old, created);
  }
  canonicalizeSerializedNodeOrder(target);
  for (const [old, node] of createdNodes) maps.nodes.set(old, node.ObjectId);
  return { nodeIds: [...ordered].map(id => maps.nodes.get(id)), nodeMap: Object.fromEntries(maps.nodes), dummyId: dummy.ObjectId };
}
