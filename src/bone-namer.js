import { suggestPoseRig, poseChainIds, poseRole, poseNodeRole } from './pose-ik.js';
import { standSequenceIndex } from './sequence-editor.js';
import { sampleNodeMatrices, worldPivot, sampleGeosetAnimation } from './animation.js';
import { nodeIndex, uniqueName } from './node-hierarchy.js';
import { renameRigNode } from './bone-tools.js';
import { movementBoneVertexCenter } from './movement-selection.js';
import { isWeaponName } from './rig-names.js';

export const BONE_PARTS = Object.freeze(['root', 'pelvis', 'spine', 'chest', 'neck', 'head', 'arm', 'hand', 'leg', 'foot', 'hoof', 'tail', 'wing', 'mesh', 'keep']);
const ROLES = new Set(['Body', 'Pelvis', 'Spine', 'Chest', 'Neck', 'Head', 'Hand', 'Foot', 'Hoof', 'Tail', 'Wing']);
const SIDED = new Set(['arm', 'hand', 'leg', 'foot', 'hoof', 'wing']);
const LEGS = new Set(['leg', 'foot', 'hoof']);
const NUMBERED = new Set(['arm', 'leg', 'tail', 'wing']);
const MESH_PARENT_EXCLUSIONS = new Set(['root', 'hand', 'chest', 'mesh', 'keep']);
const PROTECTED_MESH_NAME = /chain|rein|guard|camera|over[\s_.-]*head|cloth|cape|banner|hair|beard|finger|thumb|decoration|jaw|lip|eye|brow|death|portrait|gutz|glow|ref/i;
const title = word => word[0].toUpperCase() + word.slice(1);
const rigNodes = model => [...(model.Bones || []), ...(model.Helpers || [])];

function measure(model) {
  const tree = nodeIndex(model), sequence = standSequenceIndex(model), frame = model.Sequences?.[sequence]?.Interval?.[0] ?? 0;
  const matrices = sampleNodeMatrices(model, frame, sequence, frame), points = new Map();
  for (const [id, node] of tree.byId) points.set(id, worldPivot(model, id, matrices, node));
  const rig = suggestPoseRig(model, frame, sequence), meshEndYs = new Map();
  for (const chain of rig.chains || []) if (Array.isArray(chain.grip)) {
    meshEndYs.set(chain.end, movementBoneVertexCenter(model, chain.end, matrices).center.y);
  }
  return { tree, sequence, frame, points, matrices, rig, meshEndYs };
}

// Preorder keeps unnamed siblings together, with the shared cycle/parent rules.
function hierarchyOrder(tree) {
  const order = new Map();
  const visit = start => {
    const pending = [start];
    while (pending.length) {
      const id = pending.pop();
      if (order.has(id)) continue;
      order.set(id, order.size);
      pending.push(...(tree.children.get(id) || []).map(node => node.ObjectId).reverse());
    }
  };
  for (const node of tree.children.get(null) || []) visit(node.ObjectId);
  for (const id of tree.byId.keys()) visit(id);
  return order;
}

export function planBoneNames(model) {
  const scratch = structuredClone(model), originals = new Map(rigNodes(model).map(node => [node.ObjectId, node.Name]));
  let plan;
  // POSE reads a named rig differently. Bound that feedback to three planning
  // rounds on a private copy; the caller's names and other data are untouched.
  for (let round = 0; round < 3; round++) {
    plan = planOnce(scratch, originals);
    const chosen = new Set(plan.rows.filter(row => row.name !== scratch.Nodes?.[row.id]?.Name).map(row => row.id));
    if (!chosen.size) break;
    applyBoneNames(scratch, plan.rows, chosen);
  }
  return { ...plan, rows: plan.rows.map(row => ({ ...row, current: originals.get(row.id) })) };
}

function planOnce(model, originals) {
  const unit = measure(model), { tree, points, matrices, rig, meshEndYs } = unit;
  const bones = rigNodes(model), allowed = new Set(bones.map(node => node.ObjectId));
  const identified = new Set([rig.body, ...(rig.nodes || []), ...(rig.chains || []).flatMap(poseChainIds), ...Object.keys(rig.roles || {}).map(Number)].filter(id => id != null));
  const role = id => { const value = poseRole(model, rig, id); return ROLES.has(value) ? value : null; };
  const parts = new Map(), blocked = new Set();
  // Shape-only Wing limbs must stay anonymous to retain POSE's limb reading.
  const shapeWingIds = new Set((rig.chains || []).filter(chain => chain.label === 'Wing' && !poseChainIds(chain).some(id => poseNodeRole(tree.byId.get(id)) === 'Wing')).flatMap(poseChainIds));
  const assign = (id, part) => { if (allowed.has(id)) parts.set(id, shapeWingIds.has(id) ? 'keep' : part); };
  for (const id of identified) { const value = role(id); if (value && !['Hand', 'Foot', 'Hoof'].includes(value)) assign(id, value === 'Body' ? 'root' : value.toLowerCase()); }
  for (const chain of rig.chains || []) {
    const ids = poseChainIds(chain);
    if (chain.label === 'Chain') { for (const id of ids) { blocked.add(id); assign(id, 'keep'); } continue; }
    const lastBone = ids.filter(id => allowed.has(id)).at(-1);
    const attachmentEnd = (model.Attachments || []).some(node => node.ObjectId === chain.end);
    const wing = chain.label === 'Wing' || ids.some(id => role(id) === 'Wing');
    for (const id of ids) {
      const value = role(id);
      if (wing) assign(id, 'wing');
      else if (value && !['Hand', 'Foot', 'Hoof'].includes(value)) assign(id, value === 'Body' ? 'root' : value.toLowerCase());
      else if (attachmentEnd && id === lastBone && ['Hand', 'Foot', 'Hoof'].includes(value)) assign(id, value.toLowerCase());
      else if (chain.kind === 'leg') assign(id, id === chain.end ? (chain.label === 'Hoof' || role(chain.end) === 'Hoof' ? 'hoof' : 'foot') : 'leg');
      else if (chain.kind === 'arm' && !chain.label) assign(id, id === chain.end ? 'hand' : 'arm');
    }
  }
  if (rig.body != null) assign(rig.body, 'root');
  // Only POSE-selected endpoints start path recognition. Intervening roles are
  // resolved by the same POSE export, never by a second naming heuristic.
  const endpoints = [...parts];
  for (const [id, part] of endpoints) {
    if (!['tail', 'chest', 'head'].includes(part)) continue;
    const path = tree.ancestors(id), stopParts = part === 'tail' ? ['Body', 'Pelvis', 'Chest'] : part === 'chest' ? ['Pelvis', 'Body'] : ['Chest', 'Pelvis', 'Body'];
    const stop = path.findIndex(parent => parent === rig.body || stopParts.includes(role(parent)));
    if (stop < 0) continue;
    const fill = part === 'tail' ? 'tail' : part === 'chest' || role(path[stop]) !== 'Chest' ? 'spine' : 'neck';
    for (const parent of path.slice(0, stop + 1)) {
      if (blocked.has(parent)) continue;
      const value = role(parent);
      if (['Hand', 'Foot', 'Hoof'].includes(value)) continue;
      if (value) assign(parent, value === 'Body' ? 'root' : value.toLowerCase());
      else if (parent !== path[stop] && !parts.has(parent)) assign(parent, fill);
    }
  }
  const bodies = new Set([...parts].filter(([, part]) => part === 'root').map(([id]) => id));
  if (rig.body != null && tree.byId.has(rig.body)) bodies.add(rig.body);
  for (const chain of rig.chains || []) {
    const first = poseChainIds(chain).find(id => tree.byId.has(id));
    if (first != null && !tree.ancestors(first, true).some(id => bodies.has(id))) bodies.add(tree.root(first));
  }
  // A named internal body is not a second actor unless two leg chains use it.
  const nearestBody = id => tree.ancestors(id, true).find(parent => bodies.has(parent));
  const limbCounts = new Map();
  for (const chain of rig.chains || []) if (chain.kind === 'leg' && chain.label !== 'Chain') {
    const body = nearestBody(chain.end);
    if (body != null) limbCounts.set(body, (limbCounts.get(body) || 0) + 1);
  }
  const nested = [...bodies].filter(id => role(id) === 'Body' && tree.ancestors(id).some(parent => bodies.has(parent)) && (limbCounts.get(id) || 0) < 2);
  for (const id of nested) { bodies.delete(id); assign(id, 'keep'); }
  // Hubs are shared structure, not an arm/leg segment, even when POSE also
  // resolves a body role there. Retain their actor identity, but not a rename.
  const chains = rig.chains || [];
  for (const chain of chains) for (const id of poseChainIds(chain)) {
    if (id !== chain.end && chains.some(other => other !== chain && (poseChainIds(other).includes(id) || tree.isAncestor(other.end, id)))) assign(id, 'keep');
  }
  for (const node of model.Bones || []) {
    const id = node.ObjectId, parent = tree.parentOf(id), parentPart = parts.get(parent);
    if (identified.has(id) || parts.has(id) || !parentPart || MESH_PARENT_EXCLUSIONS.has(parentPart)) continue;
    if (tree.children.get(id)?.some(child => allowed.has(child.ObjectId))) continue;
    const current = originals.get(id);
    if (isWeaponName(current) || PROTECTED_MESH_NAME.test(current)) continue;
    const keys = node.Rotation?.Keys || [], first = keys[0]?.Vector;
    if (first && keys.some(({ Vector }) => Vector.some((value, index) => value !== first[index])
      && Vector.some((value, index) => value !== -first[index]))) continue;
    const skin = movementBoneVertexCenter(model, id, matrices);
    const parentY = meshEndYs.get(parent) ?? points.get(parent).y;
    // Only a sided parent gives the piece a side to agree with; trunk parts (Pelvis, Head, Neck...) have none.
    if (skin && (!SIDED.has(parentPart) || Math.abs(skin.center.y) <= 1e-4 || Math.sign(skin.center.y) === Math.sign(parentY))) assign(id, 'mesh');
  }
  const rows = bones.map(node => ({ id: node.ObjectId, current: (parts.get(node.ObjectId) || 'keep') === 'keep' ? originals.get(node.ObjectId) : node.Name, part: parts.get(node.ObjectId) || 'keep', side: null, position: null,
    actor: tree.ancestors(node.ObjectId, true).find(id => bodies.has(id)) ?? null, name: node.Name }));
  const plan = { actors: [...bodies].map(body => ({ body })), rows, error: null };
  return { ...resolve(model, plan, {}, unit), error: null };
}

function legPositions(rows, unit) {
  const { tree, points } = unit;
  for (const actor of new Set(rows.map(row => row.actor))) {
    const legs = rows.filter(row => row.actor === actor && LEGS.has(row.part));
    const ends = legs.filter(row => !legs.some(other => other !== row && tree.isAncestor(other.id, row.id)));
    const limbs = ends.map(end => ({ end, point: points.get(end.id), side: end.side }));
    const left = limbs.filter(limb => limb.side === 'L'), right = limbs.filter(limb => limb.side === 'R');
    const candidates = left.flatMap(a => right.map(b => ({ a, b, cost: Math.abs(a.point.x - b.point.x) + Math.abs(a.point.y + b.point.y) + Math.abs(a.point.z - b.point.z) }))).sort((a, b) => a.cost - b.cost || a.a.end.id - b.a.end.id || a.b.end.id - b.b.end.id);
    const used = new Set(), pairs = [];
    for (const { a, b } of candidates) if (!used.has(a) && !used.has(b)) { used.add(a); used.add(b); pairs.push([a, b]); }
    for (const limb of limbs) if (!used.has(limb)) pairs.push([limb]);
    pairs.sort((a, b) => Math.max(...b.map(limb => limb.point.x)) - Math.max(...a.map(limb => limb.point.x)) || a[0].end.id - b[0].end.id);
    pairs.forEach((pair, index) => {
      const position = pairs.length < 2 ? null : index === 0 ? 'Front' : index === pairs.length - 1 ? 'Rear' : pairs.length === 3 ? 'Middle' : `Middle${index}`;
      for (const limb of pair) for (const row of legs) if (tree.isAncestor(limb.end.id, row.id) && row.position === null) row.position = position;
    });
  }
}

function actorMeasures(model, rows, actors, unit) {
  const { sequence, frame, points, tree } = unit, visible = new Set(), owner = new Map(rows.map(row => [row.id, row.actor]));
  for (const [index, geoset] of (model.Geosets || []).entries()) {
    if (sequence >= 0 && sampleGeosetAnimation(model, index, frame, sequence, frame).alpha <= .01) continue;
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
    for (let vertex = 0; vertex < count; vertex++) {
      const hd = skin?.length >= (vertex + 1) * 8;
      const ids = hd ? Array.from({ length: 4 }, (_, slot) => skin[vertex * 8 + 4 + slot] > 0 ? skin[vertex * 8 + slot] : null) : geoset.Groups?.[geoset.VertexGroup?.[vertex]] || [];
      for (const id of ids) if (id != null) visible.add(owner.get(id) ?? tree.ancestors(id, true).find(parent => actors.some(actor => actor.body === parent)));
    }
  }
  return actors.map(actor => {
    const own = rows.filter(row => row.actor === actor.body), limbs = own.filter(row => SIDED.has(row.part) || row.part === 'tail');
    const xyz = limbs.map(row => points.get(row.id)).filter(Boolean);
    const span = xyz.length ? Math.hypot(...['x', 'y', 'z'].map(axis => Math.max(...xyz.map(p => p[axis])) - Math.min(...xyz.map(p => p[axis])))) : 0;
    return { ...actor, visible: visible.has(actor.body), hands: own.filter(row => row.part === 'hand').length >= 2, span };
  }).sort((a, b) => Number(b.visible) - Number(a.visible) || Number(b.hands) - Number(a.hands) || b.span - a.span || a.body - b.body);
}

function resolve(model, plan, { parts = {}, sides = {}, actors: overrides = {} } = {}, unit = measure(model)) {
  const { tree, points, rig, meshEndYs } = unit, order = hierarchyOrder(tree);
  const chains = rig.chains || [], mounts = new Set(Object.keys(rig.followers || {}).map(Number));
  const limbOf = row => {
    if (!['arm', 'leg', 'wing'].includes(row.part)) return null;
    const direct = chains.findIndex(chain => poseChainIds(chain).includes(row.id));
    if (direct >= 0) return direct;
    // A manually assigned joint between the body and an existing endpoint joins
    // that limb, so correcting a missed shin still renumbers its own chain.
    const descendant = chains.findIndex(chain => tree.isAncestor(chain.end, row.id));
    return descendant >= 0 ? descendant : null;
  };
  const rows = plan.rows.map(row => {
    const part = parts[row.id] ?? row.part;
    if (!BONE_PARTS.includes(part)) throw new Error('Choose a valid bone part.');
    const side = SIDED.has(part) ? sides[row.id]?.side ?? ((meshEndYs.get(row.id) ?? points.get(row.id).y) >= 0 ? 'L' : 'R') : null;
    return { ...row, part, side, position: null, name: row.current };
  });
  legPositions(rows, unit);
  for (const row of rows) {
    if (LEGS.has(row.part) && sides[row.id] && 'position' in sides[row.id]) row.position = sides[row.id].position;
    if (SIDED.has(row.part) && !['L', 'R'].includes(row.side)) throw new Error('Choose Left or Right.');
    if (row.position != null && !/^(Front|Rear|Middle[1-9][0-9]*|Middle)$/.test(row.position)) throw new Error('Choose a valid leg position.');
  }
  const groups = new Map();
  for (const row of rows.filter(row => row.part !== 'keep' && row.part !== 'mesh')) {
    const key = JSON.stringify([row.actor, row.part, row.side, row.position, limbOf(row)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const base = new Map();
  for (const group of groups.values()) {
    group.sort((a, b) => tree.depth(a.id) - tree.depth(b.id) || order.get(a.id) - order.get(b.id));
    group.forEach((row, index) => {
      const numbered = NUMBERED.has(row.part) || ['spine', 'neck'].includes(row.part) && group.length > 1;
      base.set(row.id, `${meshEndYs.has(row.id) ? 'Mesh' : 'Bone'}_${title(row.part)}${numbered ? index + 1 : ''}${row.position ? '_' + row.position : ''}${row.side ? '_' + row.side : ''}`);
    });
  }
  let actors = actorMeasures(model, rows, plan.actors, unit);
  // Manually classified bones in an unrecognised rig share the unprefixed group.
  if (rows.some(row => row.actor === null && base.has(row.id))) actors.push({ body: null, span: 0 });
  const signatures = new Map(actors.map(actor => [actor.body, JSON.stringify([...new Set(rows.filter(row => row.actor === actor.body && base.has(row.id)).map(row => base.get(row.id)))].sort())]));
  const requestedMain = actors.find(actor => !mounts.has(actor.body) && overrides[actor.body] === 'main');
  const originalMain = actors.find(actor => !mounts.has(actor.body));
  // Determine the original kinds before a Main swap, so the former Main takes
  // the newly selected actor's kind rather than becoming a second Main.
  actors.forEach((actor, index) => {
    const prior = actors.slice(0, index).find(other => signatures.get(actor.body) !== '[]' && signatures.get(other.body) === signatures.get(actor.body));
    actor.kind = actor === originalMain ? 'main' : prior ? 'copy' : actor.span > (originalMain?.span ?? 0) ? 'mount' : 'extra';
  });
  const swappedKind = requestedMain?.kind;
  // Promote only Main; all remaining actors retain their normal relative order.
  const main = requestedMain || originalMain;
  if (main) actors = [main, ...actors.filter(actor => actor !== main)];
  const counters = new Map(), completed = [], names = new Map();
  const next = key => { const n = (counters.get(key) || 0) + 1; counters.set(key, n); return n === 1 ? '' : String(n); };
  for (const [index, actor] of actors.entries()) {
    const prior = completed.find(other => signatures.get(actor.body) !== '[]' && signatures.get(other.body) === signatures.get(actor.body));
    let kind = overrides[actor.body] ?? (index === 0 && !mounts.has(actor.body) ? 'main' : prior ? 'copy' : actor.span > (actors[0]?.span ?? 0) ? 'mount' : 'extra');
    if (requestedMain && actor === originalMain && actor !== requestedMain && overrides[actor.body] == null) kind = swappedKind;
    if (!['main', 'mount', 'extra', 'copy'].includes(kind)) throw new Error('Choose a valid actor kind.');
    // Only eligible actors can become Main, including an explicit Main swap.
    if (index === 0 && !mounts.has(actor.body)) kind = 'main';
    if (mounts.has(actor.body) && kind === 'main') kind = actor.kind;
    const copyOf = kind === 'copy' ? (prior || completed[0])?.body ?? null : null;
    const source = kind === 'copy' ? completed.find(other => other.body === copyOf) : null;
    const prefix = kind === 'main' ? '' : kind === 'copy' ? source?.prefix || '' : `${title(kind)}${next(kind)}_`;
    const bodyName = tree.byId.get(actor.body)?.Name || '';
    const copySuffixes = new Map();
    const suffixFor = name => {
      if (kind !== 'copy') return '';
      const text = `${bodyName} ${name}`, word = /death/i.test(text) ? 'Death' : /portrait/i.test(text) ? 'Portrait' : 'Copy';
      if (!copySuffixes.has(word)) copySuffixes.set(word, `_${word}${next(`copy:${copyOf}:${word}`)}`);
      return copySuffixes.get(word);
    };
    for (const row of rows.filter(row => row.actor === actor.body && base.has(row.id))) names.set(row.id, base.get(row.id).replace(/^(Bone_|Mesh_)/, '$1' + prefix) + suffixFor(row.current));
    completed.push({ body: actor.body, kind, copyOf, prefix, suffix: kind === 'copy' ? suffixFor(bodyName) : '' });
  }
  const meshRows = rows.filter(row => row.part === 'mesh' && tree.parentOf(row.id) != null);
  // Kept nodes of EVERY type reserve their names before any renamed node.
  const changing = new Set([...base.keys(), ...meshRows.map(row => row.id)]);
  const kept = new Map(rows.filter(row => !changing.has(row.id)).map(row => [row.id, row.current]));
  const used = new Set([...tree.byId.values()].filter(node => !changing.has(node.ObjectId)).map(node => kept.get(node.ObjectId) ?? node.Name));
  const actorOrder = new Map(completed.map((actor, index) => [actor.body, index]));
  const positionOrder = position => position === 'Front' ? 0 : position === 'Rear' ? 1e6 : position?.startsWith('Middle') ? Number(position.slice(6) || 1) : 0;
  const rank = row => {
    if (row.part === 'keep') return [1e9, 0, 0, 0];
    const trunk = BONE_PARTS.indexOf(row.part);
    return [actorOrder.get(row.actor) ?? 0, trunk <= 5 ? trunk : ['arm', 'hand'].includes(row.part) ? 6 : LEGS.has(row.part) ? 7 : row.part === 'tail' ? 8 : row.part === 'mesh' ? 10 : 9,
      LEGS.has(row.part) ? positionOrder(row.position) : 0, row.side === 'R' ? 1 : 0];
  };
  rows.sort((a, b) => { const ar = rank(a), br = rank(b); for (let i = 0; i < ar.length; i++) if (ar[i] !== br[i]) return ar[i] - br[i]; return order.get(a.id) - order.get(b.id); });
  const assignName = (row, proposed) => {
    row.name = uniqueName(proposed, used, n => `${proposed}_${n}`);
    used.add(row.name);
  };
  for (const row of rows) if (base.has(row.id)) assignName(row, names.get(row.id) || base.get(row.id));
  // Use the parent's final name, including actor words and uniqueness suffixes.
  const rowsById = new Map(rows.map(row => [row.id, row]));
  meshRows.sort((a, b) => tree.depth(a.id) - tree.depth(b.id) || order.get(a.id) - order.get(b.id));
  for (const row of meshRows) {
    const parent = tree.parentOf(row.id), parentName = rowsById.get(parent)?.name ?? tree.byId.get(parent).Name;
    assignName(row, `Mesh_${String(parentName ?? '').replace(/^Bone_/, '')}`);
  }
  return { actors: completed.filter(actor => actor.body !== null), rows };
}

export function nameBones(model, plan, { parts = {}, sides = {}, actors = {} } = {}) {
  if (![parts, sides, actors].some(values => Object.keys(values).length)) return plan.rows.map(row => ({ ...row }));
  // Corrections start from the last default proposal, not the unnamed rig.
  const scratch = structuredClone(model);
  applyBoneNames(scratch, plan.rows, new Set(plan.rows.filter(row => row.name !== row.current).map(row => row.id)));
  return resolve(scratch, plan, { parts, sides, actors }).rows;
}

export function applyBoneNames(model, rows, chosen) {
  const allowed = new Map(rigNodes(model).map(node => [node.ObjectId, node]));
  const pending = [], seen = new Set();
  // Validate on detached nodes with the owning rename function. No live names
  // change until every selected row passes, including a stale/partial selection.
  for (const row of rows) if (chosen.has(row.id)) {
    const node = allowed.get(row.id);
    if (!node || !model.Nodes?.[row.id] || seen.has(row.id)) throw new Error('Select one bone or helper to rename.');
    seen.add(row.id);
    const scratch = { Nodes: [] }; scratch.Nodes[row.id] = { ...node };
    const name = renameRigNode(scratch, row.id, row.name);
    if (name !== node.Name) pending.push({ id: row.id, node, name });
  }
  const changing = new Set(pending.map(row => row.id));
  const used = new Set([...nodeIndex(model).byId.values()].filter(node => !changing.has(node.ObjectId)).map(node => node.Name));
  for (const row of pending) {
    if (used.has(row.name)) throw new Error('A proposed bone name is already in use.');
    used.add(row.name);
  }
  for (const row of pending) {
    renameRigNode(model, row.id, row.name);
    // Parsed models alias Nodes and Bones/Helpers; keep the collections coherent
    // for callers whose node arrays contain separate objects, without new data.
    row.node.Name = row.name;
  }
  return { changed: pending.length };
}
