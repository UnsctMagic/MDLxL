import { Quaternion, Vector3 } from 'three';
import { sampleGeosetAnimation, nodePivot } from './animation.js';
import { vertexBoneWeights } from './part-bones.js';
import { poseTorsoStations } from './pose-torso.js';

const mass = shape => shape?.mass || 0;
const compactness = shape => shape?.eigenvalues?.[0] > 0 ? Math.sqrt(Math.max(0, shape.eigenvalues[2]) / shape.eigenvalues[0]) : 0;
const thickness = shape => shape?.eigenvalues?.[1] > 0 ? Math.max(0, shape.eigenvalues[2]) / shape.eigenvalues[1] : 0;
const sigmoid = value => 1 / (1 + Math.exp(-value));

/** Find head regions from terminal surface bulks and the joints carrying them.
 * Face pieces can share one head region; independent neck branches remain
 * independent. No head count, spelling, symmetry or animation is required.
 * Local animation contributes evidence of independent articulation. Static
 * skeletons and surfaces remain supported without animation tracks.
 */
export function inferPoseHeads({ model, geometry, tree, joints, children, parent, paths, pivot, jointSurface, nameRole }) {
  const { byId } = tree, nativeChildren = geometry.children;
  const helpers = new Set((model.Helpers || []).map(node => node.ObjectId));
  const verticalRanges = new Map(), componentIds = new Map();
  for (const id of geometry.byId.keys()) {
    const root = tree.root(id), z = pivot(id).z, range = verticalRanges.get(root) || [Infinity, -Infinity];
    range[0] = Math.min(range[0], z); range[1] = Math.max(range[1], z); verticalRanges.set(root, range);
    const ids = componentIds.get(root) || []; ids.push(id); componentIds.set(root, ids);
  }
  const componentShapes = new Map([...componentIds].map(([root, ids]) => [root, geometry.measure(ids)]));
  const motion = new Map();
  const independent = id => {
    if (motion.has(id)) return motion.get(id);
    const node = byId.get(id), keys = node?.Rotation?.Keys || [];
    const first = keys[0] && new Quaternion().fromArray(keys[0].Vector).normalize();
    const rotating = !!first && keys.some(key => 1 - Math.abs(first.dot(new Quaternion().fromArray(key.Vector).normalize())) > 1e-10);
    const varying = property => {
      const keys = node?.[property]?.Keys || [], initial = keys[0]?.Vector;
      return initial && keys.some(key => Array.from(key.Vector).some((value, axis) => Math.abs(value - initial[axis]) > 1e-7));
    };
    const value = rotating || !!varying('Translation') || !!varying('Scaling'); motion.set(id, value); return value;
  };
  const ownCache = new Map(), ownIds = new Map();
  const own = id => {
    if (ownCache.has(id)) return ownCache.get(id);
    const ids = [id], pending = [...(nativeChildren.get(id) || [])], seen = new Set(ids);
    while (pending.length) {
      const child = pending.pop(); if (seen.has(child.ObjectId)) continue; seen.add(child.ObjectId);
      const adapter = helpers.has(id) && byId.get(child.ObjectId)?.Parent === id && !helpers.has(child.ObjectId);
      if (independent(child.ObjectId) && !adapter) continue;
      if (!joints.has(child.ObjectId) || adapter) { ids.push(child.ObjectId); pending.push(...(nativeChildren.get(child.ObjectId) || [])); }
    }
    const shape = geometry.measure(ids); ownIds.set(id, ids); ownCache.set(id, shape); return shape;
  };
  const nativeControl = id => {
    let at = id;
    const seen = new Set();
    while (!seen.has(at)) {
      seen.add(at); const parent = byId.get(at)?.Parent;
      if (helpers.has(at)) break;
      if (parent == null || !geometry.byId.has(parent) || mass(geometry.profiles.get(parent))) break;
      if (helpers.has(parent) && !helpers.has(at)) { at = parent; continue; }
      if (independent(at)) break;
      if (!joints.has(at)) { at = parent; continue; }
      const supported = (nativeChildren.get(parent) || []).filter(node => mass(geometry.subtree.get(node.ObjectId)) > 0);
      if (supported.length !== 1) break;
      at = parent;
    }
    return at;
  };
  // A jaw, eyelid or scalp patch resides inside a more substantial surface
  // lobe. A neck continuation occupies a different lobe, even when it is wider
  // than the skull. This measures geometry rather than assuming a neck length.
  const lobeOwner = id => {
    let at = nativeControl(id), branchExposure = 0;
    for (const ancestor of tree.ancestors(at)) {
      const parent = nativeControl(ancestor);
      if (parent === at || !tree.isAncestor(at, parent)) continue;
      const a = own(parent), b = own(at);
      if (!a?.center || !b?.center) continue;
      const childRegion = geometry.subtree.get(at), parentRegion = geometry.subtree.get(parent);
      const siblings = (nativeChildren.get(parent) || []).filter(node => !tree.isAncestor(at, node.ObjectId) && independent(node.ObjectId)).reduce((sum, node) => sum + mass(geometry.subtree.get(node.ObjectId)) / Math.max(mass(a), 1e-12), 0);
      const neighboringMass = (nativeChildren.get(parent) || []).filter(node => !tree.isAncestor(at, node.ObjectId) && independent(node.ObjectId) && !(helpers.has(parent) && !helpers.has(node.ObjectId))).reduce((sum, node) => { const sibling = geometry.subtree.get(node.ObjectId); return sum + (sibling?.center ? mass(sibling) * Math.exp(-((sibling.center.distanceTo(a.center) / Math.max(a.radius + sibling.radius, 1e-6)) ** 2)) : 0); }, 0);
      const parentMass = mass(a) + neighboringMass;
      const parentOwnership = Math.min(1, parentMass / Math.max(mass(parentRegion), 1e-12));
      const spreading = [...(branchesByOrigin.get(parent)?.values() || [])].filter(path => !tree.isAncestor(at, path.ids[0])).reduce((sum, path) => { const branch = geometry.subtree.get(path.ids[0]); return sum + (branch?.center ? Math.max(0, Math.min(1, Math.max(branch.center.distanceTo(a.center), path.points.at(-1).distanceTo(a.center)) / Math.max(a.radius, 1e-6) - 1)) : 0); }, 0);
      branchExposure = Math.max(branchExposure, spreading);
      const cohesion = compactness(parentRegion) * (.5 + .5 * Math.sqrt(parentOwnership)) - compactness(childRegion) + .2 * Math.log(Math.max(parentMass, 1e-12) / Math.max(mass(childRegion), 1e-12)) - .15 * Math.log1p(siblings) - .25 * branchExposure * branchExposure;
      // Moment radii describe mass spread, not the occupied surface boundary.
      // A long jaw can meet its skull outside both RMS spheres.
      const gap = a.min && b.min ? Math.hypot(...[0, 1, 2].map(axis => Math.max(0,
        a.min.getComponent(axis) - b.max.getComponent(axis), b.min.getComponent(axis) - a.max.getComponent(axis)))) : Infinity;
      if (cohesion > 0 && (gap < 1e-7 || a.center.distanceTo(b.center) <= a.radius + b.radius)) at = parent;
    }
    return at;
  };
  const branchesByOrigin = new Map();
  for (const path of paths) {
    if (path.ids.length < 3) continue;
    const branches = branchesByOrigin.get(path.origin) || new Map();
    const first = path.ids[0], previous = branches.get(first);
    if (!previous || path.ids.length > previous.ids.length) branches.set(first, path);
    branchesByOrigin.set(path.origin, branches);
  }
  const externalCache = new Map();
  const externalSurface = (id, origin) => {
    const key = `${id}:${origin}`;
    if (externalCache.has(key)) return externalCache.get(key);
    const localThickness = thickness(own(id));
    let linked = 0;
    for (const owner of geometry.byId.keys()) {
      if (!tree.isAncestor(owner, id)) continue;
      for (const [other, weight] of geometry.surfaceLinks.get(owner) || []) {
        const control = nativeControl(other);
        if (tree.root(control) === tree.root(id) && !tree.isAncestor(control, id) && control !== nativeControl(byId.get(id)?.Parent) && control !== origin) linked += weight * Math.min(1, thickness(own(control)) / Math.max(localThickness, 1e-12));
      }
    }
    externalCache.set(key, linked); return linked;
  };
  const candidates = [];
  const origins = [...new Set(paths.map(path => path.origin))].sort((a, b) => tree.depth(b) - tree.depth(a));
  const lobes = new Map();
  for (const id of geometry.byId.keys()) { const owner = lobeOwner(id), ids = lobes.get(owner) || []; ids.push(id); lobes.set(owner, ids); }
  const ids = new Set(lobes.keys());
  for (const id of ids) {
      const ancestralOrigins = origins.filter(origin => origin !== id && tree.isAncestor(id, origin));
      const origin = ancestralOrigins.find(origin => [...(branchesByOrigin.get(origin)?.values() || [])].some(peer => !tree.isAncestor(id, peer.ids[0]) && !tree.isAncestor(peer.ids[0], id))) ?? ancestralOrigins[0];
      if (origin == null) continue;
      const originShape = jointSurface(origin), anchor = originShape?.center || pivot(origin);
      const lineage = tree.ancestors(id, true), stop = lineage.indexOf(origin), chain = stop >= 0 ? lineage.slice(0, stop).reverse() : [id];
      const existingPath = paths.find(path => path.origin === origin && tree.isAncestor(id, path.ids[0]));
      const path = existingPath || { origin, ids: chain, points: chain.map(pivot), surface: geometry.measure(chain), delta: pivot(id).sub(pivot(origin)) };
      const shape = geometry.measure(lobes.get(id) || [id]), region = geometry.subtree.get(id), core = own(id);
      const hasSurface = !!region?.center;
      // Spelling is uncertain evidence only for an incomplete or planar actor.
      // An isolated unskinned accessory on a complete3D actor does not gain a
      // skull interpretation merely from its label. Unrelated roots are local.
      const componentShape = componentShapes.get(tree.root(id));
      let ambiguousLayout = !componentShape?.area || componentShape.eigenvalues[2] <= componentShape.eigenvalues[0] * 1e-8;
      const center = shape?.center || region?.center || pivot(id);
      const delta = center.clone().sub(anchor), length = delta.length();
      const surfaceUp = length ? delta.z / length : 0;
      const skeletonDelta = pivot(id).sub(pivot(origin)), skeletonUp = skeletonDelta.length() ? skeletonDelta.z / skeletonDelta.length() : surfaceUp;
      const up = (surfaceUp + skeletonUp) * .5;
      const ownership = mass(region) ? Math.min(1, mass(shape) / mass(region)) : 1;
      const bulk = Math.max(compactness(core), compactness(shape), compactness(region));
      let elevation = Math.sqrt(sigmoid(surfaceUp * 4) * sigmoid(skeletonUp * 4));
      const localSupport = mass(own(origin));
      const anchorSupport = localSupport ? .8 + .2 * localSupport / (localSupport + mass(region)) : 1;
      const peers = [...(branchesByOrigin.get(origin)?.values() || [])].filter(peer => !tree.isAncestor(id, peer.ids[0]) && !tree.isAncestor(peer.ids[0], id));
      // A skinned torso can support a skull without any limb branches. Follow
      // the incoming surface, since an imported root may itself be unskinned.
      const trunkSurface = Math.max(...[origin, ...chain.slice(0, -1)].map(ancestor => mass(own(ancestor)) * compactness(own(ancestor)) ** 2)) / Math.max(mass(region) * bulk * bulk, 1e-12);
      const bodyContext = 1 - Math.exp(-peers.length - Math.log1p(trunkSurface));
      const verticalRange = verticalRanges.get(tree.root(id));
      ambiguousLayout ||= verticalRange?.[0] === verticalRange?.[1];
      // Compare against directional variance, not a sphere enlarged by a long
      // beard or crest. This equals distance/radius for an isotropic region.
      const clearanceShape = core?.center ? core : shape;
      const separation = Math.min(...peers.map(peer => {
        const offset = (clearanceShape?.center || center).clone().sub(peer.points[0]);
        return clearanceShape?.radius ? Math.sqrt(clearanceShape.axes.reduce((sum, axis, index) => sum + offset.dot(axis) ** 2 / Math.max(clearanceShape.eigenvalues[index], clearanceShape.radius ** 2 * 1e-12, 1e-12), 0) / 3) : offset.length() / 1e-6;
      }), Infinity);
      const clearance = 1 - .5 * Math.exp(-separation * separation);
      const originParent = byId.get(origin)?.Parent;
      const axis = originParent != null && byId.has(originParent) ? pivot(origin).sub(pivot(originParent)).normalize() : new Vector3();
      // A unary scene container contributes no body direction. Prefer the
      // owned trunk surface, then the complete body when that joint is unskinned.
      // A candidate without a surface keeps its native skeleton direction;
      // remote skin cannot supply a missing skull region on a leftover branch.
      const parentBranches = (nativeChildren.get(originParent) || []).filter(node => mass(geometry.subtree.get(node.ObjectId)) > 0);
      if (hasSurface && originParent != null && !mass(geometry.profiles.get(originParent)) && parentBranches.length === 1) {
        const ownedTrunk = jointSurface(origin);
        const bodyShape = mass(ownedTrunk) ? ownedTrunk : geometry.subtree.get(origin);
        if (bodyShape?.mass) {
          axis.copy(bodyShape.axes[0]);
          if (axis.dot(skeletonDelta) < 0) axis.negate();
        }
      }
      const articulatedAxis = axis.lengthSq() > 0;
      if (!axis.lengthSq()) axis.set(0, 0, 1);
      const horizontalAxis = new Vector3(axis.x, axis.y, 0), horizontalDirection = new Vector3(skeletonDelta.x, skeletonDelta.y, 0);
      const axialElevation = articulatedAxis && chain.length > 1 ? horizontalAxis.lengthSq() * horizontalDirection.lengthSq() / Math.max(skeletonDelta.lengthSq(), 1e-12) * Math.sqrt(sigmoid(delta.clone().normalize().dot(horizontalAxis.normalize()) * 4) * sigmoid(skeletonDelta.clone().normalize().dot(horizontalAxis) * 4)) : 0;
      elevation = Math.max(elevation, axialElevation);
      const radial = point => { const offset = point.clone().sub(pivot(origin)); return offset.addScaledVector(axis, -offset.dot(axis)).length(); };
      const peerRadius = peers.length ? peers.reduce((sum, peer) => sum + radial(peer.points[0]), 0) / peers.length : 1;
      const centrality = Math.exp(-radial(pivot(id)) / Math.max(peerRadius, 1e-6));
      const attachmentCentrality = Math.exp(-radial(pivot(chain[0])) / Math.max(peerRadius, 1e-6));
      const endness = 1 / (1 + (nativeChildren.get(id) || []).length);
      const articulatedContinuation = [...joints].filter(joint => joint !== id && tree.isAncestor(joint, id)).length;
      const structuralExtent = skeletonDelta.length() / Math.max(skeletonDelta.length() + peerRadius, 1e-12);
      const structural = skeletonDelta.lengthSq() ? .2 * centrality * structuralExtent / (1 + articulatedContinuation) : 0;
      const previous = byId.get(id)?.Parent;
      const parentShape = own(previous);
      // Measure the actual attachment neighborhood, defined by native joints,
      // so a longer cape cannot inflate the skull's parent reference area.
      const attachmentDistances = peers.map(peer => peer.points[0].distanceTo(pivot(origin))).filter(value => value > 0).sort((a,b) => a-b);
      const attachmentRadius = attachmentDistances[Math.floor(attachmentDistances.length / 2)] || parentShape.radius || shape.radius;
      const proximalParent = previous === origin ? geometry.measureNear(ownIds.get(previous) || [previous], pivot(origin), attachmentRadius) : parentShape;
      const terminalMass = previous === origin ? mass(shape) * Math.max(compactness(core), compactness(shape)) ** 2 : mass(shape);
      const proximalMass = previous === origin ? mass(proximalParent) * compactness(proximalParent) ** 2 : mass(proximalParent);
      let terminalBulk = previous === origin && !mass(parentShape) ? .5 : terminalMass / Math.max(terminalMass + proximalMass, 1e-12);
      const continuationMass = (nativeChildren.get(id) || []).reduce((sum, child) => {
        const owner = lobeOwner(child.ObjectId);
        const articulation = [...joints].filter(joint => tree.isAncestor(joint, child.ObjectId) && mass(geometry.subtree.get(joint)) > 0).length;
        const independentBranch = articulation > 1 && !(helpers.has(id) && !helpers.has(child.ObjectId));
        const childShape = geometry.subtree.get(child.ObjectId);
        // A thin fin or hair strip is weaker evidence of continuing anatomy
        // than an equally sized volumetric segment. Preserve both as evidence.
        const relativeThickness = Math.min(1, thickness(childShape) / Math.max(thickness(core) || thickness(shape), 1e-12));
        return owner !== id && tree.isAncestor(owner, id) || independentBranch ? sum + mass(childShape) * relativeThickness : sum;
      }, 0);
      const externalArea = externalSurface(id, origin);
      const continuity = Math.exp(-6 * (externalArea / Math.max(externalArea + mass(region), 1e-12)) ** 2);
      const termination = mass(shape) / Math.max(mass(shape) + continuationMass, 1e-12) * continuity;
      if (previous === origin && mass(parentShape)) {
        const attachment = geometry.measureNear(ownIds.get(previous) || [previous], pivot(id), attachmentRadius);
        const attachmentMass = mass(attachment) * compactness(attachment) ** 2;
        const localBulk = terminalMass / Math.max(terminalMass + attachmentMass, 1e-12);
        // An independently owned terminal lobe supplies a second local view
        // of its attachment. Interior body regions retain their continuation debt.
        terminalBulk += Math.max(0, localBulk - terminalBulk) * ownership * termination;
      }
      const controlGap = hasSurface && shape?.min ? pivot(id).distanceTo(pivot(id).clamp(shape.min, shape.max)) / Math.max(shape.radius, 1e-6) : 0;
      const controlSupport = Math.exp(-controlGap);
      const motionSupport = independent(id) || !peers.some(peer => peer.ids.some(independent)) ? 1 : .8;
      const centralSupport = .5 + .5 * Math.sqrt(centrality);
      let score = centralSupport * motionSupport * controlSupport * (hasSurface ? bulk * Math.sqrt(ownership) * terminalBulk * termination * (.5 + .5 * attachmentCentrality) : structural * Math.sqrt(endness)) * elevation * anchorSupport * bodyContext * clearance;
      let nameSupport = 0, memberOf = null;
      if (ambiguousLayout && typeof nameRole === 'function') {
        const label = nameRole(byId.get(id));
        const anatomical = new Set(['Head', 'Chest', 'Body', 'Pelvis', 'Hand', 'Foot', 'Hoof', 'Tail']);
        const namedParent = tree.ancestors(id).find(parent => anatomical.has(nameRole(byId.get(parent))));
        const parentLabel = nameRole(byId.get(namedParent));
        const coherentChest = parentLabel === 'Chest' && tree.ancestors(namedParent).some(ancestor => nameRole(byId.get(ancestor)) === 'Body') && (nativeChildren.get(namedParent) || []).length > 1;
        const supportedTrunk = mass(geometry.subtree.get(namedParent)) > mass(region) || bodyContext > 0 && independent(namedParent) || coherentChest;
        if (label === 'Head' && ['Chest', 'Body', 'Pelvis'].includes(parentLabel) && supportedTrunk) {
          nameSupport = .2 * Math.sqrt(endness) * (.5 + .5 * bodyContext);
          score = Math.max(score, nameSupport);
        } else if (['Hand', 'Foot', 'Hoof', 'Tail', 'Chest', 'Body', 'Pelvis'].includes(label) || label === 'Head' && ['Head', 'Hand', 'Foot', 'Hoof'].includes(parentLabel)) {
          nameSupport = -score * .8; score += nameSupport;
          if (label === 'Head' && parentLabel === 'Head') memberOf = namedParent;
        }
      }
      const entry = { id, origin, path, index: path.ids.indexOf(id), neckIds: chain.slice(0, -1).filter(id => geometry.byId.has(id)), score, up, shape: region,
        evidence: { compactness: bulk, coreCompactness: compactness(core), groupCompactness: compactness(shape), regionCompactness: compactness(region), ownership, surfaceUp, skeletonUp, elevation, axialElevation, motionSupport, anchorSupport, bodyContext, trunkSurface, clearance, separation, hasSurface, centrality, attachmentCentrality, structural, structuralExtent, centralSupport, articulatedContinuation, terminalBulk, attachmentRadius, proximalParentMass: mass(proximalParent), continuationMass, termination, externalArea, continuity, controlGap, controlSupport, ambiguousLayout, nameSupport, memberOf, center: center.toArray(), originCenter: anchor.toArray(), directArea: shape?.area || 0, regionArea: region?.area || 0 } };
      candidates.push(entry);
  }
  // Every branch contributes candidates to the same comparison. A positive
  // head interpretation needs both terminal bulk and separation from the body;
  // weak surface evidence stays ambiguous rather than becoming a named head.
  const nearest = new Map();
  for (const candidate of candidates) {
    const previous = nearest.get(candidate.id);
    if (!previous || tree.depth(candidate.origin) > tree.depth(previous.origin)) nearest.set(candidate.id, candidate);
  }
  // Several parallel, continuously tubular terminal regions support a digit
  // fan interpretation. Independent rounded skull lobes do not produce this
  // signal, even when they share a body or point in the same direction.
  const terminalBranches = new Map();
  for (const candidate of nearest.values()) {
    const key = `${candidate.origin}:${candidate.neckIds[0] ?? candidate.id}`;
    const previous = terminalBranches.get(key);
    if (!previous || candidate.score > previous.score) terminalBranches.set(key, candidate);
  }
  const tubular = candidate => candidate.shape?.eigenvalues?.[0] > 0 ? 1 - candidate.shape.eigenvalues[1] / candidate.shape.eigenvalues[0] : 0;
  for (const candidate of nearest.values()) {
    const axis = new Vector3().fromArray(candidate.evidence.center).sub(pivot(candidate.origin)).normalize();
    let tubularFan = 0;
    for (const peer of terminalBranches.values()) {
      if (peer.origin !== candidate.origin || peer.id === candidate.id || tree.isAncestor(peer.id, candidate.id) || tree.isAncestor(candidate.id, peer.id)) continue;
      const direction = new Vector3().fromArray(peer.evidence.center).sub(pivot(peer.origin)).normalize();
      tubularFan += Math.max(0, axis.dot(direction)) ** 2 * (tubular(candidate) * tubular(peer)) ** 2;
    }
    candidate.evidence.tubularFan = tubularFan;
    candidate.score *= Math.exp(-tubularFan);
  }
  // A distinct neck without another skull lobe along it owns independent
  // evidence. Rounded shoulder plates and parts beyond an existing skull
  // remain in their trunk's comparison. Snapshot raw scores before ranking:
  // transformed scores must never depend on native collection order.
  const headStations = poseTorsoStations({ tree, children, parent,
    junctions: new Set([...branchesByOrigin].filter(([, branches]) => branches.size > 1).map(([id]) => id)),
    geometry, pivot, jointSurface, heads: [] }).evidence;
  const rawScores = new Map([...nearest.values()].map(candidate => [candidate.id, candidate.score]));
  const peaks = new Map();
  for (const candidate of nearest.values()) peaks.set(candidate.origin, Math.max(peaks.get(candidate.origin) || 0, candidate.score));
  for (const candidate of nearest.values()) {
    const independentNeck = candidate.neckIds.length > 0 && !candidate.neckIds.some(id => (rawScores.get(id) || 0) > .055);
    const branchPeak = Math.max(rawScores.get(candidate.id), ...[...nearest.values()]
      .filter(other => tree.isAncestor(candidate.id, other.id) || tree.isAncestor(other.id, candidate.id))
      .map(other => rawScores.get(other.id)));
    const contextualPeak = Math.max(independentNeck ? branchPeak : peaks.get(candidate.origin) || 0,
      ...tree.ancestors(candidate.origin).map(ancestor => {
        // An upper trunk supported by its own outgoing branches is a local
        // comparison region. Its skull does not compete with a mount's skull.
        const station = headStations.get(candidate.origin);
        return station?.skeleton > 0 && station?.surface > 0 ? 0 : peaks.get(ancestor) || 0;
      }));
    const rawScore = candidate.score, relative = rawScore / Math.max(contextualPeak, 1e-12);
    candidate.evidence.rawScore = rawScore; candidate.evidence.relative = relative;
    candidate.score = Math.sqrt(rawScore) * relative * relative;
  }
  const contenders = [...nearest.values()].filter(candidate => candidate.evidence.rawScore > .055 && candidate.score > .1).sort((a, b) => b.score - a.score || tree.depth(a.id) - tree.depth(b.id));
  const heads = [];
  for (const candidate of contenders) {
    if (heads.some(head => head.id === candidate.id)) continue;
    const ancestor = heads.find(head => tree.isAncestor(candidate.id, head.id));
    if (ancestor) continue;
    const contained = heads.filter(head => tree.isAncestor(head.id, candidate.id));
    if (contained.length) continue;
    // Several prefix paths can originate inside the same skull. A separate
    // neck/head lobe remains separate because it has no ancestor overlap.
    heads.push(candidate);
  }
  return { heads, candidates: [...nearest.values()], parts: candidates.filter(candidate => candidate.evidence.memberOf != null).map(candidate => ({ id: candidate.id, owner: candidate.evidence.memberOf, role: 'Head' })) };
}


/** Match an alternate visible surface to an already identified anatomical part.
 * Visibility contributes a reversible replacement relationship, not a clip-name
 * rule. Centered surface correspondence and ancestry disambiguate other pieces
 * that happen to share the same visibility track.
 */
export function inferPoseReplacements(model, { geometry, tree = geometry.tree, roles }) {
  if (!(model.GeosetAnims || []).some(animation => animation.Alpha?.Keys?.length)) return [];
  const points = new Map(), geosets = new Map();
  for (let geosetId = 0; geosetId < (model.Geosets || []).length; geosetId++) {
    const geoset = model.Geosets[geosetId];
    for (let vertex = 0; vertex < (geoset.Vertices?.length || 0) / 3; vertex++) {
      const point = Array.from(geoset.Vertices.slice(vertex * 3, vertex * 3 + 3));
      for (const [id, weight] of vertexBoneWeights(geoset, vertex)) {
        if (!(weight > 0) || !geometry.byId.has(id)) continue;
        if (!points.has(id)) points.set(id, []);
        points.get(id).push(point);
        if (!geosets.has(id)) geosets.set(id, new Set());
        geosets.get(id).add(geosetId);
      }
    }
  }
  const samples = [];
  for (let sequence = 0; sequence < (model.Sequences || []).length; sequence++) {
    const interval = model.Sequences[sequence].Interval;
    if (!interval) continue;
    const frames = new Set([interval[0], interval[1]]);
    for (const animation of model.GeosetAnims || []) for (const key of animation.Alpha?.Keys || []) if (key.Frame >= interval[0] && key.Frame <= interval[1]) frames.add(key.Frame);
    for (const frame of frames) samples.push({ frame, sequence });
  }
  if (samples.length < 2) return [];
  const alpha = (model.Geosets || []).map((_, id) => samples.map(sample => sampleGeosetAnimation(model, id, sample.frame, sample.sequence).alpha));
  const regions = new Map();
  const region = id => {
    if (regions.has(id)) return regions.get(id);
    const owners = mass(geometry.profiles.get(id)) ? [id] : (geometry.children.get(id) || []).filter(node => mass(geometry.profiles.get(node.ObjectId))).map(node => node.ObjectId);
    const shape = geometry.measure(owners);
    if (!shape.center) { regions.set(id, null); return null; }
    const unique = new Map();
    for (const owner of owners) for (const point of points.get(owner) || []) unique.set(point.join(','), point);
    const vertices = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    const stride = Math.max(1, vertices.length / 256), cloud = [];
    for (let i = 0; i < vertices.length; i += stride) cloud.push(vertices[Math.floor(i)].map((value, axis) => value - shape.center.getComponent(axis)));
    const skin = [...new Set(owners.flatMap(owner => [...(geosets.get(owner) || [])]))];
    const visibility = samples.map((_, index) => Math.max(0, ...skin.map(geoset => alpha[geoset][index])));
    const controlPoint = new Vector3().fromArray(nodePivot(model, geometry.byId.get(id)));
    const controlFit = Math.exp(-controlPoint.distanceTo(controlPoint.clone().clamp(shape.min, shape.max)) / Math.max(shape.radius, 1e-6));
    const value = { shape, cloud, visibility, skin, controlFit };
    regions.set(id, value); return value;
  };
  const reversal = (a, b) => {
    let forward = 0, backward = 0;
    for (let i = 0; i < samples.length; i++) {
      forward = Math.max(forward, a.visibility[i] * (1 - b.visibility[i]));
      backward = Math.max(backward, b.visibility[i] * (1 - a.visibility[i]));
    }
    return forward * backward;
  };
  const distance = (a, b) => {
    const directed = (left, right) => left.reduce((sum, point) => {
      let nearest = Infinity;
      for (const other of right) nearest = Math.min(nearest, Math.hypot(point[0] - other[0], point[1] - other[1], point[2] - other[2]));
      return sum + nearest;
    }, 0) / Math.max(left.length, 1);
    return (directed(a.cloud, b.cloud) + directed(b.cloud, a.cloud)) / Math.max(a.shape.radius + b.shape.radius, 1e-6);
  };
  const sources = [...geometry.byId.keys()].filter(id => ['Head', 'Chest'].includes(roles[id])).sort((a, b) => (roles[a] === 'Head' ? 0 : 1) - (roles[b] === 'Head' ? 0 : 1));
  const result = [], occupied = new Set();
  for (const source of sources) {
    const a = region(source); if (!a?.cloud.length) continue;
    const descendantHeads = result.filter(pair => roles[pair.source] === 'Head' && tree.isAncestor(pair.source, source));
    const matches = [];
    for (const target of geometry.byId.keys()) {
      if (tree.ancestors(target).some(ancestor => roles[ancestor] === roles[source])) continue;
      if (occupied.has(target) || source === target || tree.isAncestor(target, source) || tree.isAncestor(source, target)) continue;
      if (roles[target] && roles[target] !== 'Object' && roles[target] !== roles[source]) continue;
      const b = region(target); if (!b?.cloud.length) continue;
      const swapped = reversal(a, b); if (swapped <= 0) continue;
      let relation = 1;
      for (const head of descendantHeads) {
        if (!tree.isAncestor(head.target, target) || head.target === target) { relation = 0; break; }
        const sourceDepth = tree.depth(head.source) - tree.depth(source), targetDepth = tree.depth(head.target) - tree.depth(target);
        relation *= Math.exp(-Math.abs(Math.log(Math.max(targetDepth, 1) / Math.max(sourceDepth, 1))));
      }
      if (!relation) continue;
      const surfaceDistance = distance(a, b), coverage = Math.min(mass(a.shape), mass(b.shape)) / Math.max(mass(a.shape), mass(b.shape), 1e-12);
      const score = swapped * relation * b.controlFit * Math.exp(-4 * surfaceDistance) * coverage;
      matches.push({ source, target, score, evidence: { swapped, relation, surfaceDistance, coverage, controlFit: b.controlFit, sourceGeosets: a.skin, targetGeosets: b.skin } });
    }
    matches.sort((a, b) => b.score - a.score || a.target - b.target);
    const best = matches[0];
    if (best && best.score > .12 && (descendantHeads.length || best.evidence.surfaceDistance < .3)) {
      result.push(best); occupied.add(best.target);
    }
  }
  return result;
}
