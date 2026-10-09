import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack, skinGeoset } from './animation.js';
import { animationTargets } from './animation-tracks.js';
import { movementParentMatrix } from './movement.js';
import { poseNodeRole, suggestPoseRig } from './pose-ik.js';
import { SERIALIZED_NODE_COLLECTIONS, canonicalizeSerializedNodeOrder } from './node-id-order.js';
import { createNode } from './editor-document.js';

const clone = value => structuredClone(value);
const transforms = { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] };
const rigNodes = model => [...(model.Bones || []), ...(model.Helpers || [])];
const globalTrack = (model, value) => Number.isInteger(value?.GlobalSeqId) && value.GlobalSeqId >= 0 && model.GlobalSequences?.[value.GlobalSeqId] > 0;
const inRange = (frame, interval) => frame >= interval[0] && frame <= interval[1];
const pivot = (model, node) => new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
const normalizedName = node => String(node.Name || '').toLowerCase().replace(/^(?:bone|helper|bip\d*)[\s_.-]*/g, '').replace(/[\s_.-]/g, '');
const side = node => /(?:^|[\s_.-])(?:left|l)(?:$|[\s_.-])|left/i.test(node.Name || '') ? 'left' : /(?:^|[\s_.-])(?:right|r)(?:$|[\s_.-])|right/i.test(node.Name || '') ? 'right' : '';

function sequence(model, index) {
  const item = model.Sequences?.[index];
  if (!item?.Interval || item.Interval[1] <= item.Interval[0]) throw Error('Choose an animation with a nonzero duration.');
  return item;
}

/** Use the merged POSE owner for limb/body identities. Uncertain matches stay
 * empty and can be chosen in the two-model view; ObjectIds are never names. */
export function animationImportSkeleton(model, sequenceIndex = 0) {
  const frame = model.Sequences?.[sequenceIndex]?.Interval?.[0] ?? 0;
  const rig = suggestPoseRig(model, frame, sequenceIndex), nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node])), roles = new Map();
  if (rig.body != null) roles.set(rig.body, 'Body');
  for (const id of rig.nodes) {
    const node = byId.get(id); roles.set(id, `${side(node)}:${poseNodeRole(node)}`);
  }
  for (const chain of rig.chains) {
    const end = byId.get(chain.end), label = `${side(end)}:${chain.kind}`;
    ['root', 'middle', 'end'].forEach(part => roles.set(chain[part], `${label}:${part}`));
  }
  return { rig, roles, nodes: nodes.filter(node => rigNodes(model).includes(node) || roles.has(node.ObjectId)) };
}

export function suggestAnimationBoneMatches(source, destination) {
  const from = animationImportSkeleton(source), into = animationImportSkeleton(destination), matches = {}, used = new Set();
  for (const node of from.nodes) {
    const named = into.nodes.filter(other => normalizedName(node) && normalizedName(node) === normalizedName(other));
    const role = from.roles.get(node.ObjectId), byRole = role ? into.nodes.filter(other => into.roles.get(other.ObjectId) === role) : [];
    const candidate = named.length === 1 ? named[0] : byRole.length === 1 ? byRole[0] : null;
    if (candidate && !used.has(candidate.ObjectId)) { matches[node.ObjectId] = candidate.ObjectId; used.add(candidate.ObjectId); }
  }
  return matches;
}

function walkTracks(value, visit, path = []) {
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
  if (Array.isArray(value.Keys)) { visit(value, path); return; }
  for (const [key, child] of Object.entries(value)) if (key !== 'Nodes') walkTracks(child, visit, [...path, key]);
}

function sampled(model, value, frame, interval, fallback, quaternion = false) {
  return sampleTrack(value, frame, { interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback, quaternion });
}

export function animationImportObjects(source, sequenceIndex, matches) {
  const interval = sequence(source, sequenceIndex).Interval, mapped = new Set(Object.keys(matches).filter(id => matches[id] !== '' && matches[id] != null).map(Number));
  const result = [];
  for (const collection of SERIALIZED_NODE_COLLECTIONS) for (const node of source[collection] || []) {
    if (mapped.has(node.ObjectId)) continue;
    let active = false;
    walkTracks(node, track => { if (globalTrack(source, track) || track.Keys.some(key => inRange(key.Frame, interval))) active = true; });
    if (collection === 'EventObjects') active = globalTrack(source, node) || Array.from(node.EventTrack || []).some(frame => inRange(frame, interval));
    if (['Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(collection)) {
      const times = [interval[0], interval[1], ...(node.Visibility?.Keys || []).filter(key => inRange(key.Frame, interval)).map(key => key.Frame)];
      active ||= times.some(frame => sampled(source, node.Visibility, frame, interval, 1) > 0);
    }
    if (active) result.push({ id: node.ObjectId, name: node.Name || `${collection} ${node.ObjectId}`, collection, parent: node.Parent });
  }
  return result;
}

function frameGrid(model, interval) {
  const frames = new Set(interval);
  // Bake the native evaluator at 60 Hz, including all authored key times and
  // the frame before step keys. Global controllers become local to this import.
  for (let frame = interval[0]; frame < interval[1]; frame += 16) frames.add(frame);
  walkTracks(model, track => {
    if (globalTrack(model, track)) {
      const duration = model.GlobalSequences[track.GlobalSeqId];
      for (let cycle = Math.floor(interval[0] / duration); cycle <= Math.floor(interval[1] / duration); cycle++) {
        for (const key of track.Keys) { const frame = cycle * duration + key.Frame; if (inRange(frame, interval)) { frames.add(frame); if (frame > interval[0]) frames.add(frame - 1); } }
      }
    } else for (const key of track.Keys) if (inRange(key.Frame, interval)) { frames.add(key.Frame); if (track.LineType === 0 && key.Frame > interval[0]) frames.add(key.Frame - 1); }
  });
  return [...frames].sort((a, b) => a - b);
}

function keyFor(frame, value, lineType) {
  const Vector = new Float32Array(typeof value === 'number' ? [value] : value);
  if (!Array.from(Vector).every(Number.isFinite)) throw Error('The imported animation contains a nonfinite sampled value.');
  return { Frame: frame, Vector, ...(lineType >= 2 ? { InTan: lineType === 2 && Vector.length !== 4 ? new Float32Array(Vector.length) : Vector.slice(), OutTan: lineType === 2 && Vector.length !== 4 ? new Float32Array(Vector.length) : Vector.slice() } : {}) };
}

function spliceTrack(model, prior, interval, values, fallback) {
  if (globalTrack(model, prior)) throw Error('A destination global controller cannot be replaced by a local imported animation.');
  const track = prior?.Keys ? clone(prior) : { LineType: 1, GlobalSeqId: null, Keys: [] };
  if (!prior?.Keys && prior != null) for (const item of model.Sequences) if (item.Interval !== interval && !item.Interval.every((value, index) => value === interval[index])) {
    for (const frame of item.Interval) track.Keys.push(keyFor(frame, prior, track.LineType));
  }
  const incoming = new Map(values.map(([frame, value]) => [frame, keyFor(frame, value ?? fallback, track.LineType)]));
  track.Keys = [...track.Keys.filter(key => !inRange(key.Frame, interval)), ...incoming.values()].sort((a, b) => a.Frame - b.Frame);
  return track;
}

function modelScale(model) {
  const points = rigNodes(model).map(node => pivot(model, node));
  if (!points.length) return 1;
  const min = points[0].clone(), max = min.clone(); points.forEach(point => { min.min(point); max.max(point); });
  return Math.max(1e-6, max.distanceTo(min));
}

function boneDirection(model, node, matches, sourceSide) {
  const nodes = allNodes(model), child = nodes.find(other => other.Parent === node.ObjectId && (sourceSide ? matches[other.ObjectId] != null : Object.values(matches).includes(other.ObjectId)));
  const parent = nodes.find(other => other.ObjectId === node.Parent);
  return child ? pivot(model, child).sub(pivot(model, node)) : parent ? pivot(model, node).sub(pivot(model, parent)) : new Vector3(0, 0, 1);
}

function matchPlan(source, destination, matches) {
  const from = new Map(allNodes(source).map(node => [node.ObjectId, node])), into = new Map(allNodes(destination).map(node => [node.ObjectId, node])), used = new Set(), result = [];
  for (const [id, target] of Object.entries(matches)) {
    if (target == null || target === '') continue;
    const node = from.get(Number(id)), other = into.get(Number(target));
    if (!node || !other) throw Error('A selected bone match no longer exists.');
    if (used.has(other.ObjectId)) throw Error('Match each destination bone to only one source bone.');
    used.add(other.ObjectId);
    const a = boneDirection(source, node, matches, true), b = boneDirection(destination, other, matches, false);
    const alignment = a.lengthSq() > 1e-10 && b.lengthSq() > 1e-10 ? new Quaternion().setFromUnitVectors(a.normalize(), b.normalize()) : new Quaternion();
    result.push({ source: node, destination: other, alignment });
  }
  if (!result.length) throw Error('Match at least one source bone to the destination skeleton.');
  // The target hierarchy owns evaluation order, including unmatched helpers.
  const depth = node => { let current = node, count = 0, seen = new Set(); while (current) { if (seen.has(current.ObjectId)) throw Error('The destination skeleton has a cyclic hierarchy.'); seen.add(current.ObjectId); current = into.get(current.Parent); count++; } return count; };
  return result.sort((a, b) => depth(a.destination) - depth(b.destination));
}

function nativeLocal(model, node, translation, rotation, scaling) {
  const local = new Matrix4().compose(translation, rotation, scaling), p = pivot(model, node);
  local.setPosition(translation.clone().add(p).sub(p.clone().applyMatrix4(local).sub(translation)));
  return local;
}

function targetMatrices(model, frame, index, changed) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node])), matrices = new Map(changed), interval = model.Sequences[index].Interval, visiting = new Set();
  const resolve = id => {
    if (matrices.has(id)) return matrices.get(id);
    const node = nodes.get(id); if (!node) return new Matrix4();
    if (visiting.has(id)) throw Error('The destination skeleton has a cyclic hierarchy.');
    visiting.add(id); if (node.Parent != null) resolve(node.Parent);
    const t = new Vector3().fromArray(sampled(model, node.Translation, frame, interval, transforms.Translation)), q = new Quaternion().fromArray(sampled(model, node.Rotation, frame, interval, transforms.Rotation, true)), s = new Vector3().fromArray(sampled(model, node.Scaling, frame, interval, transforms.Scaling));
    const matrix = movementParentMatrix(node, matrices).multiply(nativeLocal(model, node, t, q, s)); matrices.set(id, matrix); visiting.delete(id); return matrix;
  };
  for (const id of nodes.keys()) resolve(id);
  return matrices;
}

function copyAppearance(destination, templateIndex, interval) {
  const template = sequence(destination, templateIndex).Interval;
  const targets = animationTargets(destination, { geosetIds: destination.Geosets.map((_, index) => index), nodeIds: allNodes(destination).map(node => node.ObjectId) });
  destination.Materials.forEach((material, id) => material.Layers.forEach((_, layer) => targets.push({ kind: 'material', id, layer, property: 'Alpha' })));
  for (const target of targets) {
    const owner = target.kind === 'geoset' ? destination.GeosetAnims.find(anim => anim.GeosetId === target.id) : target.kind === 'material' ? destination.Materials[target.id].Layers[target.layer] : allNodes(destination).find(node => node.ObjectId === target.id);
    if (!owner) continue;
    const prior = owner[target.property];
    if (!prior?.Keys || globalTrack(destination, prior)) continue;
    const fallback = ['Color', 'AmbColor'].includes(target.property) ? [1, 1, 1] : 1;
    const mapTime = frame => Math.round(interval[0] + (frame - template[0]) * (interval[1] - interval[0]) / (template[1] - template[0]));
    const copied = new Map(prior.Keys.filter(key => inRange(key.Frame, template)).map(key => [mapTime(key.Frame), { ...clone(key), Frame: mapTime(key.Frame) }]));
    for (const [index, frame] of interval.entries()) if (!copied.has(frame)) copied.set(frame, keyFor(frame, sampled(destination, prior, template[index], template, fallback), prior.LineType));
    owner[target.property] = { ...clone(prior), Keys: [...prior.Keys.filter(key => !inRange(key.Frame, interval)), ...copied.values()].sort((a, b) => a.Frame - b.Frame) };
  }
}

function newInterval(destination, duration) {
  let last = Math.max(0, ...destination.Sequences.flatMap(item => Array.from(item.Interval)));
  walkTracks(destination, track => { if (!globalTrack(destination, track)) for (const key of track.Keys) last = Math.max(last, key.Frame); });
  for (const node of destination.EventObjects || []) if (!globalTrack(destination, node)) for (const frame of node.EventTrack || []) last = Math.max(last, frame);
  const start = last + 1000;
  if (start + duration > 0x7fffffff) throw Error('There is not enough frame space to import this animation.');
  return [start, start + duration];
}

function importObjects(source, destination, objects, matches, interval, sourceInterval, grid, mapTime, ratio) {
  const byId = new Map(allNodes(source).map(node => [node.ObjectId, node])), ids = new Map(Object.entries(matches).filter(([, value]) => value !== '' && value != null).map(([key, value]) => [Number(key), Number(value)]));
  const approved = new Set(objects.filter(item => item.import).map(item => item.id)), imported = [], allocated = new Map();
  const textureIds = new Map(), materialIds = new Map(), textureAnimIds = new Map();
  const bakeTracks = owner => walkTracks(owner, (track, path) => {
    const parent = path.slice(0, -1).reduce((value, key) => value[key], owner), key = path.at(-1), fallback = transforms[key] || (track.Keys[0]?.Vector?.length > 1 ? Array(track.Keys[0].Vector.length).fill(1) : 0);
    const keys = new Map(grid.map(frame => [mapTime(frame), keyFor(mapTime(frame), sampled(source, track, frame, sourceInterval, fallback, key === 'Rotation'), track.LineType)]));
    parent[key] = { LineType: track.LineType, GlobalSeqId: null, Keys: [...keys.values()] };
  });
  const texture = id => {
    if (textureIds.has(id)) return textureIds.get(id);
    const value = source.Textures?.[id]; if (!value) throw Error('An imported emitter references a missing texture.');
    let index = destination.Textures.findIndex(other => JSON.stringify(other) === JSON.stringify(value));
    if (index < 0) index = destination.Textures.push(clone(value)) - 1;
    textureIds.set(id, index); return index;
  };
  const material = id => {
    if (materialIds.has(id)) return materialIds.get(id);
    const value = clone(source.Materials?.[id]); if (!value) throw Error('An imported ribbon references a missing material.');
    for (const layer of value.Layers || []) {
      if (layer.TextureID?.Keys) {
        const original = layer.TextureID; layer.TextureID = { LineType: 0, GlobalSeqId: null, Keys: [...new Map(grid.map(frame => [mapTime(frame), keyFor(mapTime(frame), texture(Math.round(sampled(source, original, frame, sourceInterval, 0))), 0)])).values()] };
      } else if (Number.isInteger(layer.TextureID)) layer.TextureID = texture(layer.TextureID);
      for (const name of ['NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID']) if (Number.isInteger(layer[name]) && layer[name] >= 0) layer[name] = texture(layer[name]);
      if (Number.isInteger(layer.TVertexAnimId) && layer.TVertexAnimId >= 0) {
        const originalId = layer.TVertexAnimId;
        if (!textureAnimIds.has(originalId)) { const animation = clone(source.TextureAnims?.[originalId]); if (!animation) throw Error('An imported material references a missing texture animation.'); bakeTracks(animation); textureAnimIds.set(originalId, destination.TextureAnims.push(animation) - 1); }
        layer.TVertexAnimId = textureAnimIds.get(originalId);
      }
    }
    // TextureID was already remapped; bake the remaining source controllers.
    for (const layer of value.Layers || []) { const textureTrack = layer.TextureID; delete layer.TextureID; bakeTracks(layer); layer.TextureID = textureTrack; }
    const index = destination.Materials.push(value) - 1; materialIds.set(id, index); return index;
  };
  const depth = item => { let node = byId.get(item.id), count = 0, seen = new Set(); while (node) { if (seen.has(node.ObjectId)) throw Error('The source skeleton has a cyclic hierarchy.'); seen.add(node.ObjectId); node = byId.get(node.Parent); count++; } return count; };
  const ordered = objects.filter(item => approved.has(item.id)).sort((a, b) => depth(a) - depth(b));
  const types = { Bones: 'Bone', Helpers: 'Helper', Lights: 'Light', Attachments: 'Attachment', ParticleEmitters: 'ParticleEmitter', ParticleEmitters2: 'ParticleEmitter2', ParticleEmitterPopcorns: 'ParticleEmitterPopcorn', RibbonEmitters: 'RibbonEmitter', EventObjects: 'EventObject', CollisionShapes: 'CollisionShape' };
  for (const item of ordered) {
    if (item.collection === 'RibbonEmitters') material(byId.get(item.id).MaterialID);
    const node = createNode(destination, types[item.collection]); allocated.set(item.id, node); ids.set(item.id, node.ObjectId);
  }
  for (const item of ordered) {
    const original = byId.get(item.id), value = allocated.get(item.id), attachmentId = value.AttachmentID;
    Object.assign(value, clone(original)); if (item.collection === 'Attachments') value.AttachmentID = attachmentId;
    let ancestor = byId.get(original.Parent), seen = new Set();
    while (ancestor && !ids.has(ancestor.ObjectId)) { if (seen.has(ancestor.ObjectId)) throw Error('The source skeleton has a cyclic hierarchy.'); seen.add(ancestor.ObjectId); ancestor = byId.get(ancestor.Parent); }
    const parentId = item.bindTo === '' || item.bindTo == null ? ancestor ? ids.get(ancestor.ObjectId) : null : Number(item.bindTo);
    if (parentId == null && original.Parent != null && original.Parent >= 0) throw Error(`Choose the corresponding destination bone for ${item.name}.`);
    value.ObjectId = ids.get(item.id); value.Parent = parentId;
    const intoParent = allNodes(destination).find(node => node.ObjectId === parentId) || imported.find(node => node.ObjectId === parentId);
    if (parentId != null && !intoParent) throw Error(`The destination parent for ${item.name} no longer exists.`);
    const sourceParent = ancestor || byId.get(original.Parent);
    let anchor = sourceParent; while (anchor && (matches[anchor.ObjectId] == null || matches[anchor.ObjectId] === '')) anchor = byId.get(anchor.Parent);
    const anchorTarget = anchor ? allNodes(destination).find(node => node.ObjectId === Number(matches[anchor.ObjectId])) : intoParent;
    const fromDirection = sourceParent ? boneDirection(source, anchor || sourceParent, matches, true) : new Vector3(0, 0, 1), intoDirection = anchorTarget ? boneDirection(destination, anchorTarget, matches, false) : fromDirection.clone();
    const bindingAlignment = fromDirection.lengthSq() > 1e-10 && intoDirection.lengthSq() > 1e-10 ? new Quaternion().setFromUnitVectors(fromDirection.normalize(), intoDirection.normalize()) : new Quaternion();
    const offset = pivot(source, original).sub(sourceParent ? pivot(source, sourceParent) : new Vector3()).applyQuaternion(bindingAlignment).multiplyScalar(ratio);
    value.PivotPoint = new Float32Array(offset.add(intoParent ? pivot(destination, intoParent) : new Vector3()).toArray());
    bakeTracks(value);
    // Flatten any skipped source helpers through the native hierarchy, then
    // express the imported node in its corresponding destination parent's pose.
    const basis = new Matrix4().makeTranslation(...(intoParent ? pivot(destination, intoParent).toArray() : [0, 0, 0])).multiply(new Matrix4().makeRotationFromQuaternion(bindingAlignment)).multiply(new Matrix4().makeScale(ratio, ratio, ratio)).multiply(new Matrix4().makeTranslation(...(sourceParent ? pivot(source, sourceParent).negate().toArray() : [0, 0, 0]))), inverseBasis = basis.clone().invert();
    const motion = Object.fromEntries(Object.keys(transforms).map(property => [property, []]));
    for (const frame of grid) {
      const matrices = sampleNodeMatrices(source, frame, source.Sequences.findIndex(item => item.Interval === sourceInterval), frame), sourceParentMatrix = sourceParent ? matrices.get(sourceParent.ObjectId) : new Matrix4();
      if (Math.abs(sourceParentMatrix.determinant()) < 1e-12) throw Error(`${item.name} has a singular source parent transform.`);
      const local = basis.clone().multiply(sourceParentMatrix.clone().invert().multiply(matrices.get(original.ObjectId))).multiply(inverseBasis), position = new Vector3(), rotation = new Quaternion(), scale = new Vector3(); local.decompose(position, rotation, scale);
      const p = pivot(destination, value), translation = position.sub(p).add(p.clone().applyMatrix4(new Matrix4().compose(new Vector3(), rotation, scale)));
      motion.Translation.push([mapTime(frame), translation.toArray()]); motion.Rotation.push([mapTime(frame), rotation.toArray()]); motion.Scaling.push([mapTime(frame), scale.toArray()]);
    }
    for (const property of Object.keys(transforms)) value[property] = spliceTrack(destination, null, interval, motion[property], transforms[property]);
    if (value.TextureID != null) value.TextureID = texture(value.TextureID);
    if (value.MaterialID != null) value.MaterialID = material(value.MaterialID);
    if (item.collection === 'Bones') { value.GeosetId = null; value.GeosetAnimId = null; }
    if (item.collection === 'EventObjects') {
      const events = new Set();
      if (globalTrack(source, original)) { const duration = source.GlobalSequences[original.GlobalSeqId]; for (let cycle = Math.floor(sourceInterval[0] / duration); cycle <= Math.floor(sourceInterval[1] / duration); cycle++) for (const frame of original.EventTrack || []) if (inRange(cycle * duration + frame, sourceInterval)) events.add(mapTime(cycle * duration + frame)); }
      else for (const frame of original.EventTrack || []) if (inRange(frame, sourceInterval)) events.add(mapTime(frame));
      value.GlobalSeqId = null; value.EventTrack = new Uint32Array([...events].sort((a, b) => a - b));
    } else if (['Attachments', 'Lights', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'].includes(item.collection)) {
      const zeros = destination.Sequences.filter(item => item.Interval !== interval).flatMap(item => Array.from(item.Interval, frame => keyFor(frame, 0, 0)));
      value.Visibility = { LineType: 0, GlobalSeqId: null, Keys: [...zeros, ...new Map(grid.map(frame => [mapTime(frame), keyFor(mapTime(frame), sampled(source, original.Visibility, frame, sourceInterval, 1), 0)])).values()].sort((a, b) => a.Frame - b.Frame) };
    }
    destination.PivotPoints[value.ObjectId] = value.PivotPoint; imported.push(value);
  }
  return imported;
}

function animationBounds(destination, index, frames) {
  const minimum = new Vector3(Infinity, Infinity, Infinity), maximum = new Vector3(-Infinity, -Infinity, -Infinity), bounds = destination.Geosets.map(() => ({ min: minimum.clone(), max: maximum.clone(), radius: 0 }));
  for (const frame of frames) {
    const matrices = sampleNodeMatrices(destination, frame, index, frame);
    destination.Geosets.forEach((geoset, id) => { const vertices = skinGeoset(geoset, matrices), item = bounds[id]; for (let offset = 0; offset < vertices.length; offset += 3) { const point = new Vector3().fromArray(vertices, offset); item.min.min(point); item.max.max(point); item.radius = Math.max(item.radius, point.length()); } });
  }
  let radius = 0;
  bounds.forEach((item, id) => {
    if (!Number.isFinite(item.min.x)) return;
    minimum.min(item.min); maximum.max(item.max); radius = Math.max(radius, item.radius);
    const geoset = destination.Geosets[id]; geoset.Anims ||= [];
    while (geoset.Anims.length < destination.Sequences.length) geoset.Anims.push({ MinimumExtent: clone(geoset.MinimumExtent), MaximumExtent: clone(geoset.MaximumExtent), BoundsRadius: geoset.BoundsRadius || 0 });
    geoset.Anims[index] = { MinimumExtent: new Float32Array(item.min.toArray()), MaximumExtent: new Float32Array(item.max.toArray()), BoundsRadius: item.radius };
  });
  if (Number.isFinite(minimum.x)) Object.assign(destination.Sequences[index], { MinimumExtent: new Float32Array(minimum.toArray()), MaximumExtent: new Float32Array(maximum.toArray()), BoundsRadius: radius });
}

/** Called once through EditorDocument.apply. No source model, mesh, skin,
 * destination RGB/visibility template, or unrelated interval is rewritten. */
export function importAnimation(destination, source, { sourceSequence, mode, destinationSequence, matches, objects = [] }) {
  const selected = sequence(source, sourceSequence), sourceInterval = selected.Interval;
  if (!['replace', 'new'].includes(mode)) throw Error('Choose Replace or Make new.');
  const template = sequence(destination, destinationSequence), plan = matchPlan(source, destination, matches);
  if (source.Version !== destination.Version && objects.some(item => item.import)) throw Error('Extra objects require matching model formats.');
  const interval = mode === 'replace' ? template.Interval : newInterval(destination, sourceInterval[1] - sourceInterval[0]);
  if (mode === 'replace' && destination.Sequences.some((item, index) => index !== destinationSequence && item.Interval[0] <= interval[1] && item.Interval[1] >= interval[0])) throw Error('The destination animation overlaps another animation. Choose a separate interval.');
  const index = mode === 'replace' ? destinationSequence : destination.Sequences.length;
  if (mode === 'new') { destination.Sequences.push({ ...clone(selected), Interval: interval }); copyAppearance(destination, destinationSequence, interval); }
  const mapTime = frame => Math.round(interval[0] + (frame - sourceInterval[0]) * (interval[1] - interval[0]) / (sourceInterval[1] - sourceInterval[0]));
  const grid = frameGrid(source, sourceInterval), ratio = modelScale(destination) / modelScale(source), values = new Map();
  // Reset local motion only inside the imported interval. This also prevents
  // unmapped destination nodes retaining an animation that was replaced.
  for (const node of allNodes(destination)) for (const [property, fallback] of Object.entries(transforms)) {
    if (globalTrack(destination, node[property])) { if (plan.some(item => item.destination === node)) throw Error(`${node.Name}: ${property} uses a global controller. Choose a destination with local motion.`); continue; }
    if (node[property]?.Keys || plan.some(item => item.destination === node)) node[property] = spliceTrack(destination, node[property], interval, Array.from(interval, frame => [frame, fallback]), fallback);
  }
  if (mode === 'replace') for (const node of destination.EventObjects || []) if (!globalTrack(destination, node)) node.EventTrack = new Uint32Array(Array.from(node.EventTrack || []).filter(frame => !inRange(frame, interval)));
  const sourceById = new Map(allNodes(source).map(node => [node.ObjectId, node])), destinationById = new Map(allNodes(destination).map(node => [node.ObjectId, node]));
  for (const item of plan) {
    let ancestor = sourceById.get(item.source.Parent), seen = new Set();
    const targetAncestors = new Set(); let into = destinationById.get(item.destination.Parent);
    while (into) { if (targetAncestors.has(into.ObjectId)) throw Error('The destination skeleton has a cyclic hierarchy.'); targetAncestors.add(into.ObjectId); into = destinationById.get(into.Parent); }
    while (ancestor) { if (seen.has(ancestor.ObjectId)) throw Error('The source skeleton has a cyclic hierarchy.'); seen.add(ancestor.ObjectId); const parent = plan.find(other => other.source === ancestor && targetAncestors.has(other.destination.ObjectId)); if (parent) { item.parentMatch = parent; break; } ancestor = sourceById.get(ancestor.Parent); }
  }
  for (const frame of grid) {
    const matrices = sampleNodeMatrices(source, frame, sourceSequence, frame), intoMatrices = new Map();
    for (const item of plan) {
      const sourceNode = item.source, node = item.destination, position = new Vector3(), worldRotation = new Quaternion(), worldScale = new Vector3();
      matrices.get(sourceNode.ObjectId).decompose(position, worldRotation, worldScale);
      const alignment = item.alignment, desired = alignment.clone().multiply(worldRotation).multiply(alignment.clone().invert()).normalize();
      const targetFrame = mapTime(frame), currentMatrices = targetMatrices(destination, targetFrame, index, intoMatrices);
      const parent = movementParentMatrix(node, currentMatrices), parentPosition = new Vector3(), parentRotation = new Quaternion(), parentScale = new Vector3(); parent.decompose(parentPosition, parentRotation, parentScale);
      if (Math.abs(parent.determinant()) < 1e-12) throw Error('The destination skeleton has a singular parent transform.');
      const rotation = parentRotation.invert().multiply(desired).normalize();
      const anchor = item.parentMatch, sourcePoint = pivot(source, sourceNode).applyMatrix4(matrices.get(sourceNode.ObjectId));
      const sourceAnchor = anchor ? matrices.get(anchor.source.ObjectId) : new Matrix4();
      if (Math.abs(sourceAnchor.determinant()) < 1e-12) throw Error('The source skeleton has a singular parent transform.');
      const displacement = sourcePoint.applyMatrix4(sourceAnchor.clone().invert()).sub(pivot(source, sourceNode));
      const sourceLength = anchor ? pivot(source, sourceNode).distanceTo(pivot(source, anchor.source)) : 0, targetLength = anchor ? pivot(destination, node).distanceTo(pivot(destination, anchor.destination)) : 0;
      displacement.applyQuaternion(anchor?.alignment || alignment).multiplyScalar(sourceLength > 1e-6 ? targetLength / sourceLength : ratio);
      const targetAnchor = anchor ? currentMatrices.get(anchor.destination.ObjectId) : new Matrix4();
      const translation = pivot(destination, node).add(displacement).applyMatrix4(targetAnchor).applyMatrix4(parent.clone().invert()).sub(pivot(destination, node));
      const scaling = worldScale.divide(parentScale).toArray();
      const local = nativeLocal(destination, node, translation, rotation, new Vector3().fromArray(scaling));
      intoMatrices.set(node.ObjectId, parent.clone().multiply(local));
      for (const [property, value] of Object.entries({ Translation: translation.toArray(), Rotation: rotation.toArray(), Scaling: scaling })) {
        const key = `${node.ObjectId}:${property}`; if (!values.has(key)) values.set(key, { node, property, samples: [] }); values.get(key).samples.push([targetFrame, value]);
      }
    }
  }
  for (const { node, property, samples } of values.values()) node[property] = spliceTrack(destination, node[property], interval, samples, transforms[property]);
  const imported = importObjects(source, destination, objects, matches, interval, sourceInterval, grid, mapTime, ratio);
  const nodeIdMap = imported.length ? Object.fromEntries(canonicalizeSerializedNodeOrder(destination)) : null;
  animationBounds(destination, index, [...new Set(grid.map(mapTime))]);
  return { sequenceIndex: index, importedObjects: imported.length, nodeIdMap };
}
