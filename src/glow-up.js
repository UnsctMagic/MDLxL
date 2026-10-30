import { isTeamGlowLayer } from './texture-references.js';
import { isWeaponName, nameSide, nameTokens } from './rig-names.js';
import { clamp } from './math.js';
import { createRigNode } from './bone-tools.js';
import { recalculateExtents } from './editor-document.js';
import { fillSequenceExtents, isDeathSequence, isDecaySequence, isDissipateSequence } from './sequence-editor.js';
import { allNodes } from './animation.js';
import { ribbonPolygonSelection } from './particle-ribbon-fit.js';
import { nodeIndex, uniqueName } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';
import { bindVertices } from './editor-commands.js';

// Hero glow as Blizzard and Gluma build it (docs/GLOW_UP.md): team glow
// (ReplaceableId 2), Additive, Unshaded, alpha 0.75.
//  - Origin: three flat ground planes stacked at the feet, each on its own
//    unparented bone that pulses on its own global sequence.
//  - Weapon: a row of camera-facing squares along the blade, each on its own
//    billboarded bone parented to the weapon bone.
// The planes, heights and pulse keys are the Paladin/Jaina/Uther template,
// scaled to the model. Layer three runs on its own period, as Gluma does.

const HIDDEN = sequence => isDeathSequence(sequence) || isDecaySequence(sequence) || isDissipateSequence(sequence);
const HERMITE = 2;
const PULSE_FAST = [[0, 1, 0, .255], [1100, 1.17, 0, 0], [1600, 1, -.255, 0]];
const PULSE_SLOW = [[0, 1, 0, -.244], [833, .823, -.043, -.04], [1600, .917, .094, -.138], [2400, .78, .038, .044], [3333, 1, .308, 0]];
// Paladin: widths 225/254/189 at heights 7/15.8/25.5 for a 254 wide glow.
const ORIGIN_LAYERS = [
  { width: .887, height: 7 / 254, keys: PULSE_FAST, period: 1600 },
  { width: 1, height: 15.8 / 254, keys: PULSE_SLOW, period: 3333 },
  { width: .745, height: 25.5 / 254, keys: PULSE_SLOW, period: 2666 },
];

const isTeamGlowGeoset = (model, g) => (model.Materials?.[g.MaterialID]?.Layers || []).some(l => isTeamGlowLayer(model, l));
// Only a bone carrying at least half an HD vertex counts as holding it.
const bindingsOf = (g, id) => vertexBones(g, id, { minWeight: 128 });
const point = (g, id) => [g.Vertices[id * 3], g.Vertices[id * 3 + 1], g.Vertices[id * 3 + 2]];

const glowLayer = (model, material) => (material?.Layers || []).find(l => isTeamGlowLayer(model, l) && l.FilterMode >= 3);
const isGlowGeoset = (model, g) => !!glowLayer(model, model.Materials?.[g.MaterialID]);

/** Does the model already carry visible team glow geometry? */
export function hasHeroGlow(model) {
  return (model.Geosets || []).some(g => isGlowGeoset(model, g));
}

/**
 * Origin glow width from body height: 8.9 × height^0.71, fitted to 32 Blizzard
 * and Gluma heroes (mean error 15%). Big bodies get relatively smaller glows.
 */
export function originGlowSize(model) {
  const height = bodyHeight(model);
  if (height == null) return 250;
  const size = 8.9 * Math.max(height, 10) ** .71;
  return Number.isFinite(size) ? Math.min(600, Math.max(150, Math.round(size))) : 250;
}

/** 95th-percentile vertex height of the opaque body, or null without one. */
function bodyHeight(model) {
  const height = [];
  for (const g of model.Geosets || []) {
    if (isTeamGlowGeoset(model, g) || (model.Materials?.[g.MaterialID]?.Layers || []).every(l => l.FilterMode >= 2)) continue;
    for (let i = 2; i < g.Vertices.length; i += 3) height.push(g.Vertices[i]);
  }
  if (!height.length) return null;
  height.sort((a, b) => a - b);
  return height[Math.floor(height.length * .95)];
}

function principalAxis(points) {
  const center = [0, 1, 2].map(a => points.reduce((sum, p) => sum + p[a], 0) / points.length), m = Array(9).fill(0);
  for (const p of points) { const d = p.map((v, a) => v - center[a]); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] += d[i] * d[j]; }
  let axis = [1, 1, 1];
  for (let step = 0; step < 40; step++) {
    const next = [0, 1, 2].map(i => m[i * 3] * axis[0] + m[i * 3 + 1] * axis[1] + m[i * 3 + 2] * axis[2]), length = Math.hypot(...next);
    if (!length) break; axis = next.map(v => v / length);
  }
  if (!axis.every(Number.isFinite) || Math.hypot(...axis) < .5) axis = [1, 0, 0];
  const along = points.map(p => p.reduce((sum, v, a) => sum + (v - center[a]) * axis[a], 0));
  const across = points.map((p, k) => Math.hypot(...p.map((v, a) => v - center[a] - axis[a] * along[k])));
  return { center, axis, min: Math.min(...along), max: Math.max(...along), thickness: Math.max(...across, 1) };
}

/** The hand-side reference: the nearest "hand" ancestor's pivot, else the bone's own pivot. */
function gripOf(model, id) {
  const { byId, ancestors } = nodeIndex(model);
  const hand = ancestors(id, true).map(at => byId.get(at)).find(node => /hand/i.test(node.Name || ''));
  return Array.from((hand || byId.get(id))?.PivotPoint || [0, 0, 0]);
}

function weaponPoints(model, id) {
  const solo = [], shared = [];
  for (const g of model.Geosets || []) {
    if (isTeamGlowGeoset(model, g)) continue;
    for (let v = 0; v * 3 + 2 < g.Vertices.length; v++) {
      const bones = bindingsOf(g, v);
      if (!bones.includes(id)) continue;
      (bones.length === 1 ? solo : shared).push(point(g, v));
    }
  }
  return solo.length >= 4 ? solo : [...solo, ...shared];
}

/** Bones with geometry, likeliest weapon first: a weapon name, held in a hand, long and thin. */
export function weaponCandidates(model) {
  const tree = nodeIndex(model), found = [], body = bodyHeight(model) ?? 100;
  for (const bone of model.Bones || []) {
    const points = weaponPoints(model, bone.ObjectId);
    if (points.length < 4) continue;
    const fit = principalAxis(points), length = fit.max - fit.min;
    if (!(length > 4)) continue;
    const held = tree.ancestors(bone.ObjectId).slice(0, 4).some(id => /hand/i.test(tree.byId.get(id).Name || ''));
    const named = isWeaponName(bone.Name), slender = length / fit.thickness;
    // An unnamed sword held in a hand (the Footman's Cone11) is long and thin: 2 + 1 + 1.
    const score = (named ? 4 : 0) + (held ? 2 : 0) + (slender > 3 ? 1 : 0) + (length > .35 * body ? 1 : 0) - (/hand(?!le)|arm|leg|foot|head|chest|root|spine|neck|tail|wing/i.test(bone.Name || '') ? 5 : 0);
    found.push({ id: bone.ObjectId, name: bone.Name, score, length });
  }
  return found.sort((a, b) => b.score - a.score || b.length - a.length);
}

const sideless = name => nameTokens(name).map(token => {
  const side = nameSide(token);
  if (!side) return token;
  if (token === side || token === side[0]) return '#';
  return token.endsWith(side[0]) ? token.slice(0, -1) + '#' : '#' + token.slice(1);
}).join(' ') + ':' + (String(name || '').match(/\d+/g) || []).join(',');

/**
 * Weapon choices for the picker, best first. Marked polygons come first when
 * there are any; a mirrored pair (sword_L + sword_R) is offered as one choice.
 */
export function weaponChoices(model, marked) {
  const choices = [], found = weaponCandidates(model), likely = found.filter(c => c.score > 0);
  // `sure`: clear enough to switch weapon glow on by default (a weapon name).
  if (marked && ribbonPolygonSelection(model, marked).polygons) choices.push({ key: 'marked', label: 'Marked polygons', marked, sure: true });
  const top = likely[0], twin = top && nameSide(top.name) && likely.find(c => c !== top && c.score === top.score && sideless(c.name) === sideless(top.name));
  if (twin) choices.push({ key: `pair-${top.id}-${twin.id}`, label: `${top.name} + ${twin.name}`, ids: [top.id, twin.id], sure: top.score >= 4 });
  for (const c of found) choices.push({ key: `bone-${c.id}`, label: c.name, ids: [c.id], other: c.score <= 0, sure: c.score >= 4 });
  return choices;
}

/**
 * Where the weapon glow runs and the bone it follows. `from` and `to` are
 * fractions of the whole weapon, 0 at the butt and 1 at the tip; left out,
 * the glow runs from 30% of the way from the grip to the tip, as on Blizzard's heroes.
 */
export function weaponLine(model, { weaponId, marked, from, to } = {}) {
  let points, parentId;
  if (marked) {
    const selected = ribbonPolygonSelection(model, marked);
    if (!selected.polygons) throw Error('Mark the weapon’s polygons in Vertices, or choose its bone.');
    points = selected.points; parentId = selected.parent;
  } else {
    if (!(model.Bones || []).some(b => b.ObjectId === weaponId)) throw Error('Choose the weapon’s bone.');
    points = weaponPoints(model, weaponId); parentId = weaponId;
  }
  if (points.length < 3 || points.some(p => !p.every(Number.isFinite))) throw Error('That weapon has too little geometry for a glow.');
  const fit = principalAxis(points), grip = parentId == null ? fit.center : gripOf(model, parentId);
  const at = t => fit.center.map((v, a) => v + fit.axis[a] * t);
  const gripT = Math.min(fit.max, Math.max(fit.min, grip.reduce((sum, v, a) => sum + (v - fit.center[a]) * fit.axis[a], 0)));
  // The business end is long and carries most of the geometry: a blade, a
  // hammer head, a staff head. A pommel or a short grip end has little of both.
  let ahead = 0, behind = 0;
  for (const p of points) { const t = p.reduce((sum, v, a) => sum + (v - fit.center[a]) * fit.axis[a], 0); if (t > gripT) ahead++; else if (t < gripT) behind++; }
  const tipT = ahead * (fit.max - gripT) >= behind * (gripT - fit.min) ? fit.max : fit.min, reach = tipT - gripT;
  if (Math.abs(reach) < 2) throw Error('That weapon is too short for a glow.');
  const buttT = tipT === fit.max ? fit.min : fit.max, length = tipT - buttT, held = (gripT - buttT) / length;
  // A frame along the weapon (butt → tip) with two sides, so an end can leave
  // the axis: onto a hammer's head, an axe's blade, past the tip.
  const along = fit.axis.map(v => v * Math.sign(length)), size = Math.abs(length);
  let side = [0, 0, 1].map((v, a) => v - along[2] * along[a]);
  if (Math.hypot(...side) < .1) side = [1, 0, 0].map((v, a) => v - along[0] * along[a]);
  side = side.map(v => v / Math.hypot(...side));
  const other = [along[1] * side[2] - along[2] * side[1], along[2] * side[0] - along[0] * side[2], along[0] * side[1] - along[1] * side[0]];
  const end = (value, fallback) => {
    const [t, u = 0, w = 0] = Array.isArray(value) ? value : [value ?? fallback];
    return [clamp(Number.isFinite(t) ? t : fallback, -.5, 1.5), clamp(Number.isFinite(u) ? u : 0, -1, 1), clamp(Number.isFinite(w) ? w : 0, -1, 1)];
  };
  // Reversed numbers mean the same stretch. Dragged ends stay whose they are: across a
  // hammer head both sit near the tip, and swapping would make the dragged dot jump.
  const swap = !Array.isArray(from) && !Array.isArray(to);
  from = end(from, held + (1 - held) * .3); to = end(to, 1);
  if (swap && from[0] > to[0]) [from, to] = [to, from];
  const butt = at(buttT), place = ([t, u, w]) => butt.map((v, a) => v + size * (along[a] * t + side[a] * u + other[a] * w));
  const onAxis = f => f[1] === 0 && f[2] === 0 ? f[0] : f;
  return { start: place(from), end: place(to), butt, tip: at(tipT), parentId, from: onAxis(from), to: onAxis(to), frame: { along, side, other, size } };
}

const freeNodeName = (model, base) => uniqueName(base, new Set(allNodes(model).map(n => n.Name)));

function addBone(model, name, center, parentId, flags) {
  const bone = createRigNode(model, 'Bone');
  bone.Name = freeNodeName(model, name); bone.Parent = parentId; bone.Flags = 256 | flags;
  bone.PivotPoint.set(center);
  return bone;
}

function globalSequence(model, length) {
  model.GlobalSequences ||= [];
  const found = model.GlobalSequences.indexOf(length);
  return found >= 0 ? found : model.GlobalSequences.push(length) - 1;
}

function pulse(model, keys, period) {
  const scale = period / keys.at(-1)[0], v3 = value => new Float32Array([value, value, value]);
  return { LineType: HERMITE, GlobalSeqId: globalSequence(model, period), Keys: keys.map(([frame, value, inTan, outTan]) => ({ Frame: Math.round(frame * scale), Vector: v3(value), InTan: v3(inTan), OutTan: v3(outTan) })) };
}

/** Visible in every animation except Death, Decay and Dissipate. */
function visibility(model) {
  const sequences = model.Sequences || [];
  if (!sequences.some(s => HIDDEN(s))) return 1;
  // Sequences may share a start frame; any visible one keeps the glow on there.
  const keys = new Map();
  for (const s of sequences) {
    // Some Blizzard files carry a stray sequence at an unsigned -167; it cannot be keyed.
    const frame = Number(s.Interval[0]), value = HIDDEN(s) ? 0 : 1;
    if (Number.isInteger(frame) && frame >= 0 && frame <= 2147483647) keys.set(frame, Math.max(keys.get(frame) ?? 0, value));
  }
  return { LineType: 0, GlobalSeqId: null, Keys: [...keys].sort((a, b) => a[0] - b[0]).map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) };
}

/** One geoset of quads; quad k is bound to bones[k]. */
function addQuads(model, quads, materialId) {
  const vertices = [], normals = [], uvs = [], faces = [], groups = [], vertexGroup = [];
  quads.forEach(({ corners, normal, bone }, k) => {
    for (const c of corners) { vertices.push(...c); normals.push(...normal); vertexGroup.push(k); }
    uvs.push(0, 1, 1, 1, 1, 0, 0, 0);
    faces.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    groups.push([bone.ObjectId]);
  });
  const g = { Vertices: new Float32Array(vertices), Normals: new Float32Array(normals), TVertices: [new Float32Array(uvs)], Faces: new Uint16Array(faces), VertexGroup: new Uint8Array(vertexGroup), Groups: groups, TotalGroupsCount: groups.length, MaterialID: materialId, SelectionGroup: 0, Unselectable: false, Anims: [] };
  if (model.Version >= 900) g.LevelOfDetail = 0;
  const geosetIndex = model.Geosets.push(g) - 1, geosetAnimId = model.GeosetAnims.push({ GeosetId: geosetIndex, Flags: 0, Alpha: visibility(model), Color: new Float32Array([1, 1, 1]) }) - 1;
  for (const { bone } of quads) { bone.GeosetId = geosetIndex; bone.GeosetAnimId = geosetAnimId; }
  // Bounds for the new geoset only; authored bounds on existing meshes stay.
  recalculateExtents({ Geosets: [g], Info: {} });
  fillSequenceExtents(model, g);
  return geosetIndex;
}

function addOrigin(model, size, materialId, [x, y] = [0, 0]) {
  const quads = ORIGIN_LAYERS.map(({ width, height, keys, period }, k) => {
    const half = size * width / 2, z = size * height;
    const bone = addBone(model, `Glow Origin ${k + 1}`, [x, y, z], null, 0);
    bone.Scaling = pulse(model, keys, period);
    return { bone, normal: [0, 0, 1], corners: [[x - half, y - half, z], [x + half, y - half, z], [x + half, y + half, z], [x - half, y + half, z]] };
  });
  return addQuads(model, quads, materialId);
}

/** Square width and count for one weapon line. */
function weaponSquares(line, size, originSize) {
  const span = Math.hypot(...line.end.map((v, a) => v - line.start[a]));
  // Squares are ~1.4× the glowing span: Arthas 66 → 90, Paladin 42 → 76, Gluma's blades 40 → 54.
  const base = Math.min(.4 * originSize, Math.max(.2 * originSize, 1.4 * span));
  // Spacing follows the unscaled square, so Weapon size shrinks the glow
  // without crowding it. A short stretch (a spear tip) gets one to three.
  return { quad: base * size, count: Math.max(1, Math.min(10, Math.round(span / (.2 * base)) + 1)) };
}

function addWeapon(model, lines, size, originSize, materialId) {
  const quads = [];
  for (const line of lines) {
    const { quad, count } = weaponSquares(line, size, originSize);
    for (let k = 0; k < count; k++) {
      const t = count > 1 ? k / (count - 1) : .5, center = line.start.map((v, a) => v + (line.end[a] - v) * t);
      // Full along the blade, narrower at the hilt and the tip.
      const half = quad * (count === 1 ? 1 : t < .5 ? .85 + .3 * t : 1 - .4 * ((t - .5) / .5) ** 2) / 2;
      const bone = addBone(model, `Glow Weapon ${quads.length + 1}`, center, line.parentId, 8);
      // Warcraft turns billboarded quads so +X faces the camera: build them in YZ.
      const [x, y, z] = center;
      quads.push({ bone, normal: [1, 0, 0], corners: [[x, y - half, z - half], [x, y + half, z - half], [x, y + half, z + half], [x, y - half, z + half]] });
    }
  }
  return addQuads(model, quads, materialId);
}

/**
 * Add hero glow. One undo step when run inside EditorDocument.apply.
 * options: origin, originSize (× fitted width), weapon, weaponIds | marked, weaponSize,
 * weaponFrom/weaponTo (0 butt … 1 tip, or [along, side, side] in weapon lengths;
 * default from past the grip to the tip), brightness, or originBrightness and
 * weaponBrightness to light the two apart.
 */
export function addHeroGlow(model, { origin = true, originSize = 1, originOffset = [0, 0], weapon = false, weaponIds = [], marked, weaponSize = 1, weaponFrom, weaponTo, brightness = .75, originBrightness = brightness, weaponBrightness = brightness } = {}) {
  if (!origin && !weapon) throw Error('Choose origin glow, weapon glow, or both.');
  if (!(originOffset.length === 2 && originOffset.every(Number.isFinite))) throw Error('The origin glow position is invalid.');
  if (![originSize, weaponSize].every(v => Number.isFinite(v) && v >= .1 && v <= 5)) throw Error('Glow size must be between 10% and 500%.');
  if (![originBrightness, weaponBrightness].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw Error('Glow brightness must be between 0 and 100%.');
  if (weapon && !marked && !weaponIds.length) throw Error('Choose the weapon’s bone.');
  const fitted = originGlowSize(model), range = { from: weaponFrom, to: weaponTo };
  const lines = !weapon ? [] : marked ? [weaponLine(model, { marked, ...range })] : weaponIds.map(weaponId => weaponLine(model, { weaponId, ...range }));
  model.Textures ||= []; model.Materials ||= []; model.Geosets ||= []; model.GeosetAnims ||= [];
  let textureId = model.Textures.findIndex(t => t.ReplaceableId === 2 && !t.Image);
  if (textureId < 0) textureId = model.Textures.push({ Image: '', ReplaceableId: 2, Flags: 0 }) - 1;
  // One material per brightness: the ground and the weapon share it when they
  // match, and an identical team-glow material already in the model is reused.
  const material = alpha => {
    const found = model.Materials.findIndex(m => (m.PriorityPlane ?? 0) === 0 && (m.RenderMode ?? 0) === 0 && m.Layers?.length === 1 && [m.Layers[0]].every(l => l.FilterMode === 3 && l.Shading === 17 && l.TextureID === textureId && l.TVertexAnimId == null && (l.CoordId ?? 0) === 0 && l.Alpha === alpha));
    return found >= 0 ? found : model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 3, Shading: 17, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: alpha }] }) - 1;
  };
  const materialId = material(origin ? originBrightness : weaponBrightness);
  const weaponMaterialId = origin && weapon && weaponBrightness !== originBrightness ? material(weaponBrightness) : materialId;
  const geosetIndices = [];
  if (origin) geosetIndices.push(addOrigin(model, fitted * originSize, materialId, originOffset));
  if (weapon) geosetIndices.push(addWeapon(model, lines, weaponSize, fitted, weaponMaterialId));
  growBounds(model, geosetIndices.map(i => model.Geosets[i]));
  return { geosetIndices, materialId, weaponMaterialId, textureId, size: fitted };
}

/** Widen the model bounds to cover these geosets; authored bounds never shrink. */
function growBounds(model, geosets) {
  if (!model.Info || !geosets.length) return;
  for (const key of ['MinimumExtent', 'MaximumExtent']) model.Info[key] = new Float32Array([0, 1, 2].map(a => (key === 'MinimumExtent' ? Math.min : Math.max)(model.Info[key]?.[a] ?? geosets[0][key][a], ...geosets.map(g => g[key][a]))));
  model.Info.BoundsRadius = Math.max(model.Info.BoundsRadius || 0, Math.hypot(...model.Info.MaximumExtent.map((v, i) => (v - model.Info.MinimumExtent[i]) / 2)));
  model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims?.length || 0; model.Info.NumBones = model.Bones?.length || 0;
}

/**
 * Where the glow's drag handles sit, in bind-pose model space: the origin
 * glow's centre and half width (its widest plane), and per weapon line the
 * butt, tip, glowing stretch and the middle square's half width. On a model
 * that already glows, the handles sit on its own glow (see glowUp).
 */
export function glowLayout(model, { originSize = 1, originOffset = [0, 0], weaponIds = [], marked, weaponSize = 1, weaponFrom, weaponTo } = {}) {
  const fitted = originGlowSize(model), size = fitted * originSize, range = { from: weaponFrom, to: weaponTo }, found = findHeroGlow(model);
  const origin = found?.origin
    ? { center: [originOffset[0], originOffset[1], found.origin.center[2] * size / found.origin.width], half: size / 2 }
    : { center: [originOffset[0], originOffset[1], size * ORIGIN_LAYERS[1].height], half: size * ORIGIN_LAYERS[1].width / 2 };
  if (found?.weapon) return { origin, weapons: [ownWeaponHandles(model, found.weapon, { weaponSize, weaponFrom, weaponTo })] };
  const lines = marked ? [weaponLine(model, { marked, ...range })] : weaponIds.map(weaponId => weaponLine(model, { weaponId, ...range }));
  return { origin, weapons: lines.map(line => ({ ...line, mid: line.start.map((v, a) => (v + line.end[a]) / 2), half: weaponSquares(line, weaponSize, fitted).quad / 2 })) };
}

// A model that already glows (docs/GLOW_UP.md): Glow Up adjusts the model's
// own glow in place and offers to repair glow built unlike Blizzard's heroes:
// each ground plane on its own bone pulsing on a global sequence, each weapon
// square on its own Billboarded bone centred on it and facing +X, hidden in
// Death/Decay/Dissipate, Unshaded.

const BILLBOARDED = 8 | 16 | 32 | 64;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function pieceNormal(g, set) {
  for (let f = 0; f + 2 < g.Faces.length; f += 3) {
    if (!set.has(g.Faces[f])) continue;
    const [a, b, c] = [0, 1, 2].map(k => point(g, g.Faces[f + k])), u = b.map((v, i) => v - a[i]), w = c.map((v, i) => v - a[i]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], length = Math.hypot(...n);
    if (length > 1e-9) return n.map(v => v / length);
  }
  return [0, 0, 1];
}

/** Two in-plane directions for a normal: across, and up the plane (world up where it can). */
function planeBasis(n) {
  const up = Math.abs(n[2]) < .9 ? [0, 0, 1] : [0, 1, 0], along = dot(up, n);
  const v = up.map((value, a) => value - n[a] * along), length = Math.hypot(...v), w = v.map(value => value / length);
  return [[w[1] * n[2] - w[2] * n[1], w[2] * n[0] - w[0] * n[2], w[0] * n[1] - w[1] * n[0]], w];
}

/** Glow that never shows (alpha keyed or set to 0 throughout, like the Hydralisk's portrait plane). */
function alwaysHidden(model, geoset) {
  const alpha = (model.GeosetAnims || []).find(a => a.GeosetId === geoset)?.Alpha;
  return alpha === 0 || !!alpha?.Keys?.length && alpha.Keys.every(k => k.Vector[0] === 0);
}

/** Connected pieces of the glow geosets: a ground plane, a weapon square. */
function glowPieces(model) {
  const pieces = [], boneIds = new Set((model.Bones || []).map(b => b.ObjectId));
  (model.Geosets || []).forEach((g, geoset) => {
    if (!isGlowGeoset(model, g) || alwaysHidden(model, geoset)) return;
    const root = Array.from({ length: g.Vertices.length / 3 }, (_, i) => i), find = i => { while (root[i] !== i) i = root[i] = root[root[i]]; return i; };
    for (let f = 0; f + 2 < g.Faces.length; f += 3) for (const k of [1, 2]) { const a = find(g.Faces[f]), b = find(g.Faces[f + k]); if (a !== b) root[b] = a; }
    const parts = new Map();
    for (const v of g.Faces) { const r = find(v); if (!parts.has(r)) parts.set(r, new Set()); parts.get(r).add(v); }
    for (const set of parts.values()) {
      const vertices = [...set], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], load = new Map();
      let unbound = false;
      for (const v of vertices) {
        point(g, v).forEach((value, a) => { lo[a] = Math.min(lo[a], value); hi[a] = Math.max(hi[a], value); });
        const bones = vertexBones(g, v);
        if (!bones.length || bones.some(id => !boneIds.has(id))) unbound = true;
        for (const id of bones) if (boneIds.has(id)) load.set(id, (load.get(id) || 0) + 1);
      }
      const extent = hi.map((v, a) => v - lo[a]), center = lo.map((v, a) => (v + hi[a]) / 2), width = Math.max(...extent), normal = pieceNormal(g, set);
      // A glow square or ground plane: flat, four to eight corners, about as wide as high.
      const basis = planeBasis(normal), offsets = vertices.map(v => point(g, v).map((value, a) => value - center[a]));
      const flat = offsets.every(d => Math.abs(dot(d, normal)) <= .05 * width + 1e-6), [across, up] = basis.map(axis => Math.max(...offsets.map(d => dot(d, axis))) - Math.min(...offsets.map(d => dot(d, axis))));
      const square = flat && vertices.length >= 4 && vertices.length <= 8 && Math.max(across, up) <= 1.6 * Math.min(across, up);
      pieces.push({ geoset, vertices, center, extent, width, normal, square, unbound, load, bones: [...load.keys()] });
    }
  });
  return pieces;
}

const layerAlpha = layer => typeof layer?.Alpha === 'number' ? layer.Alpha : layer?.Alpha?.Keys?.length ? Math.max(...layer.Alpha.Keys.map(k => k.Vector[0])) : 1;
const piecesAlpha = (model, pieces) => layerAlpha(glowLayer(model, model.Materials[model.Geosets[pieces[0].geoset].MaterialID]));

function weaponPart(model, pieces, nodes, holds) {
  // A square on its own bone follows that bone's parent; one on a shared bone follows that bone.
  const anchors = pieces.map(p => p.bones.length !== 1 ? undefined : holds(p.bones[0], [p]) ? nodes.get(p.bones[0]).Parent ?? undefined : p.bones[0]);
  const mid = pieces[Math.floor(pieces.length / 2)];
  const part = { pieces, center: mid.center, node: mid.bones[0], half: pieces.reduce((sum, p) => sum + p.width, 0) / pieces.length / 2, brightness: piecesAlpha(model, pieces) };
  const anchor = anchors[0];
  if (anchor == null || anchors.some(a => a !== anchor)) return part;
  let line;
  try { line = weaponLine(model, { weaponId: anchor }); } catch { return part; }
  const { butt, frame } = line, coords = c => ['along', 'side', 'other'].map(axis => c.reduce((sum, v, a) => sum + (v - butt[a]) * frame[axis][a], 0) / frame.size);
  const sorted = [...pieces].sort((a, b) => coords(a.center)[0] - coords(b.center)[0]);
  return { ...part, anchor, pieces: sorted, start: sorted[0].center, end: sorted.at(-1).center, from: coords(sorted[0].center), to: coords(sorted.at(-1).center) };
}

/**
 * The model's own hero glow, or null without any: `origin` (ground planes) and
 * `weapon` (every other glow square), each with its pieces, place, size and
 * brightness. Other glow shapes are left as the author made them.
 */
export function findHeroGlow(model) {
  const pieces = glowPieces(model);
  if (!pieces.length) return null;
  const nodes = new Map((model.Bones || []).map(b => [b.ObjectId, b])), loads = new Map(), body = bodyHeight(model) ?? 100;
  for (const g of model.Geosets) for (let v = 0; v * 3 < g.Vertices.length; v++) for (const id of vertexBones(g, v)) loads.set(id, (loads.get(id) || 0) + 1);
  // Does the bone hold these pieces' vertices and nothing else?
  const holds = (id, set) => loads.get(id) === set.reduce((sum, p) => sum + (p.load.get(id) || 0), 0);
  // Ground planes lie flat or nearly (the Death Knight's tilt), below mid-body
  // (a mounted Far Seer's sits high) or low for their size (a small body's
  // glow is at least 150 wide), on bones that don't turn to the camera.
  for (const p of pieces) p.ground = p.square && Math.abs(p.normal[2]) > .9 && (p.center[2] < .5 * body || p.center[2] < .2 * p.width) && !p.bones.some(id => nodes.get(id).Flags & BILLBOARDED);
  const ground = pieces.filter(p => p.ground), rest = pieces.filter(p => p.square && !p.ground), widest = ground.reduce((a, b) => !a || b.width > a.width ? b : a, null);
  return {
    pieces, nodes, holds,
    origin: widest && { pieces: ground, center: widest.center, width: widest.width, brightness: piecesAlpha(model, ground) },
    weapon: rest.length ? weaponPart(model, rest, nodes, holds) : null,
  };
}

function ownWeaponHandles(model, part, { weaponSize = 1, weaponFrom, weaponTo }) {
  const half = part.half * weaponSize;
  if (part.anchor == null) return { mid: part.center, half, parentId: part.node };
  const line = weaponLine(model, { weaponId: part.anchor, from: weaponFrom ?? part.from, to: weaponTo ?? part.to });
  return { ...line, mid: line.start.map((v, a) => (v + line.end[a]) / 2), half };
}

/**
 * Glow Up's starting choices. Without glow: origin glow, weapon glow for a
 * clear weapon, 75%. With glow: the model's own parts ticked at their current
 * place, size and brightness.
 */
export function glowStart(model, marked) {
  const best = weaponChoices(model, marked)[0], found = findHeroGlow(model);
  const start = { origin: true, originSize: 1, originOffset: [0, 0], weapon: !!best?.sure, weaponKey: best?.key ?? '', weaponSize: 1, weaponFrom: null, weaponTo: null, originBrightness: .75, weaponBrightness: .75 };
  if (!found) return start;
  Object.assign(start, { origin: !!found.origin, weapon: !!found.weapon });
  if (found.origin) Object.assign(start, { originSize: found.origin.width / originGlowSize(model), originOffset: found.origin.center.slice(0, 2), originBrightness: found.origin.brightness });
  if (found.weapon) start.weaponBrightness = found.weapon.brightness;
  return start;
}

/** Move the pieces' vertices, and the pivots of bones holding nothing else, through place(point, piece). */
function transformPieces(model, found, pieces, place, moved) {
  for (const piece of pieces) {
    const g = model.Geosets[piece.geoset];
    for (const v of piece.vertices) g.Vertices.set(place(point(g, v), piece), v * 3);
    moved.add(piece.geoset);
  }
  for (const id of new Set(pieces.flatMap(p => p.bones))) {
    if (!found.holds(id, pieces)) continue;
    const bone = found.nodes.get(id);
    bone.PivotPoint.set(place(Array.from(bone.PivotPoint), pieces.find(p => p.bones.includes(id))));
  }
}

const scaleTrack = (track, factor) => ({ ...track, Keys: track.Keys.map(k => ({ ...k, Vector: k.Vector.map(v => v * factor), ...(k.InTan && { InTan: k.InTan.map(v => v * factor), OutTan: k.OutTan.map(v => v * factor) }) })) });
const materialKey = material => JSON.stringify(material, (key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value);

/** Set the pieces' glow alpha. A material other geosets share is copied, or an identical one reused. */
function setBrightness(model, pieces, value) {
  if (!(Number.isFinite(value) && value >= 0 && value <= 1)) throw Error('Glow brightness must be between 0 and 100%.');
  const geosets = new Set(pieces.map(p => p.geoset));
  for (const id of new Set([...geosets].map(i => model.Geosets[i].MaterialID))) {
    const shared = model.Geosets.some((g, i) => g.MaterialID === id && !geosets.has(i)), material = shared ? structuredClone(model.Materials[id]) : model.Materials[id];
    const layer = glowLayer(model, material), old = layerAlpha(layer);
    layer.Alpha = layer.Alpha && typeof layer.Alpha === 'object' && old > 0 ? scaleTrack(layer.Alpha, value / old) : value;
    if (!shared) continue;
    const key = materialKey(material), same = model.Materials.findIndex(m => materialKey(m) === key), target = same >= 0 ? same : model.Materials.push(material) - 1;
    for (const i of geosets) if (model.Geosets[i].MaterialID === id) model.Geosets[i].MaterialID = target;
  }
}

function adjustOrigin(model, found, { originSize = 1, originOffset = [0, 0] }, moved) {
  const part = found.origin, scale = originGlowSize(model) * originSize / part.width, [cx, cy] = part.center, [x, y] = originOffset;
  if (!(Number.isFinite(scale) && scale > 0 && [x, y].every(Number.isFinite))) throw Error('The origin glow position is invalid.');
  // Ground planes stay on the ground: heights scale with the glow, as in the template.
  if (Math.abs(scale - 1) > 1e-6 || Math.abs(x - cx) > 1e-6 || Math.abs(y - cy) > 1e-6) transformPieces(model, found, part.pieces, p => [x + (p[0] - cx) * scale, y + (p[1] - cy) * scale, p[2] * scale], moved);
}

function adjustWeapon(model, found, { weaponSize = 1, weaponFrom, weaponTo }, moved) {
  const part = found.weapon, ends = part.anchor != null && (weaponFrom != null || weaponTo != null), scale = Math.abs(weaponSize - 1) > 1e-6 ? weaponSize : 1;
  if (!(Number.isFinite(weaponSize) && weaponSize > 0)) throw Error('Glow size must be between 10% and 500%.');
  if (ends || scale !== 1) {
    // Each square keeps its share of the stretch and its offset from it, and shrinks or grows about its centre.
    const next = ends ? weaponLine(model, { weaponId: part.anchor, from: weaponFrom ?? part.from, to: weaponTo ?? part.to }) : null;
    const was = ends && part.end.map((v, a) => v - part.start[a]), now = ends && next.end.map((v, a) => v - next.start[a]), length = ends && dot(was, was);
    const shift = new Map(part.pieces.map(p => {
      if (!ends) return [p, [0, 0, 0]];
      const t = length > 1e-9 ? dot(p.center.map((v, a) => v - part.start[a]), was) / length : .5;
      return [p, [0, 1, 2].map(a => next.start[a] - part.start[a] + (now[a] - was[a]) * t)];
    }));
    transformPieces(model, found, part.pieces, (q, p) => q.map((v, a) => p.center[a] + shift.get(p)[a] + (v - p.center[a]) * scale), moved);
  }
}

/**
 * Glow Up. Without glow it adds hero glow (addHeroGlow). With glow it adjusts
 * the model's own glow in place with the same options: origin position, size
 * and brightness; weapon ends, square size and brightness. A part the model
 * lacks is added only when ticked. One undo step inside EditorDocument.apply.
 */
export function glowUp(model, options = {}) {
  const found = findHeroGlow(model);
  if (!found) return addHeroGlow(model, options);
  const { origin = true, weapon = false } = options, add = { origin: origin && !found.origin, weapon: weapon && !found.weapon }, moved = new Set();
  const result = add.origin || add.weapon ? addHeroGlow(model, { ...options, ...add }) : { geosetIndices: [] };
  if (origin && found.origin) adjustOrigin(model, found, options, moved);
  if (weapon && found.weapon) adjustWeapon(model, found, options, moved);
  // Only a slider that moved applies; set to the same brightness, the two change together and a shared material stays one.
  const lit = [[origin && found.origin, options.originBrightness], [weapon && found.weapon, options.weaponBrightness]].filter(([part, value]) => part && value != null && Math.abs(value - part.brightness) >= 1e-6);
  if (lit.length === 2 && lit[0][1] === lit[1][1]) setBrightness(model, [...lit[0][0].pieces, ...lit[1][0].pieces], lit[0][1]);
  else for (const [part, value] of lit) setBrightness(model, part.pieces, value);
  for (const index of moved) { const g = model.Geosets[index]; recalculateExtents({ Geosets: [g], Info: {} }); fillSequenceExtents(model, g, { onlyIfPresent: true }); }
  growBounds(model, [...moved].map(i => model.Geosets[i]));
  return { ...result, adjusted: [...moved] };
}

// Faults Blizzard's own heroes don't have (86 native glowing models), plus the
// owner's: ground glow without a global animation. Natives do keep glow on in
// Death (most), leave it lit (6), share one billboarded bone between squares
// and pivot off-centre, so none of those is flagged.
const FAULTS = {
  unbound: ['Glow is attached to no bone', 'Glow without a bone is left behind or not drawn. Fix gives ground glow its own pulsing bone and other glow its own camera-facing bone under the nearest bone.'],
  'ground-bone': ['Ground glow moves with the body', 'Blizzard puts the ground glow planes on bones of their own, not on the body’s bones. Fix gives each plane its own pulsing bone.'],
  pulse: ['Ground glow doesn’t pulse', 'Blizzard’s ground glow pulses in size on a global sequence, so the pulse never restarts between animations. Fix gives each plane the Paladin’s pulse.'],
  billboard: ['Glow squares don’t face the camera', 'Blizzard puts weapon glow squares on Billboarded bones of their own, built facing the camera, so they never turn edge-on. Fix gives each square that bone, under the bone it follows now.'],
};

const hasChildren = (model, id) => allNodes(model).some(n => n.Parent === id);
const onGlobal = track => track && typeof track === 'object' && track.GlobalSeqId != null;

/** Pulses or otherwise animates on a global sequence: its bones or their parents, its geoset alpha or its material alpha. */
function animatesGlobally(model, tree, p) {
  const { byId, ancestors } = tree, g = model.Geosets[p.geoset];
  if (onGlobal((model.GeosetAnims || []).find(a => a.GeosetId === p.geoset)?.Alpha) || onGlobal(glowLayer(model, model.Materials[g.MaterialID])?.Alpha)) return true;
  return p.bones.some(id => ancestors(id, true).some(at => ['Scaling', 'Translation', 'Rotation'].some(key => onGlobal(byId.get(at)?.[key]))));
}
const facesCamera = p => Math.abs(p.normal[0]) > .9;
const billboardBones = (found, p) => p.bones.every(id => found.nodes.get(id).Flags & BILLBOARDED && found.holds(id, found.pieces));

function diagnose(model, found) {
  const faults = Object.fromEntries(Object.keys(FAULTS).map(key => [key, []])), ground = found.origin?.pieces || [], tree = nodeIndex(model);
  for (const p of [...ground, ...found.weapon?.pieces || []]) {
    if (p.unbound) faults.unbound.push(p);
    else if (p.ground && !p.bones.every(id => found.holds(id, ground))) faults['ground-bone'].push(p);
    else if (p.ground && !animatesGlobally(model, tree, p)) faults.pulse.push(p);
    else if (!p.ground && !(billboardBones(found, p) && facesCamera(p))) faults.billboard.push(p);
  }
  return faults;
}

/** Faults in the model's own glow, judged against Blizzard's heroes: [{ key, count, label, title }]. */
export function heroGlowFaults(model) {
  const found = findHeroGlow(model);
  if (!found) return [];
  return Object.entries(diagnose(model, found)).filter(([, items]) => items.length).map(([key, items]) => ({ key, count: items.length, label: FAULTS[key][0], title: FAULTS[key][1] }));
}

const glowBoneName = (model, base) => uniqueName(`${base} 1`, new Set(allNodes(model).map(n => n.Name)), n => `${base} ${n}`);

/** The bone of the nearest vertex outside the glow, for glow attached to nothing. */
function nearestBone(model, center) {
  let best = null, distance = Infinity;
  for (const g of model.Geosets) {
    if (isTeamGlowGeoset(model, g)) continue;
    for (let v = 0; v * 3 < g.Vertices.length; v++) {
      const d = Math.hypot(...point(g, v).map((value, a) => value - center[a])), [bone] = bindingsOf(g, v);
      if (d < distance && (model.Bones || []).some(b => b.ObjectId === bone)) { distance = d; best = bone; }
    }
  }
  return best ?? model.Bones?.[0]?.ObjectId ?? null;
}

/** Warcraft turns billboarded geometry so +X faces the camera: lay the piece in YZ, same shape and size. */
function faceCamera(g, p) {
  const [u, w] = planeBasis(p.normal);
  for (const i of p.vertices) {
    const d = point(g, i).map((value, a) => value - p.center[a]);
    g.Vertices.set([p.center[0], p.center[1] + dot(d, u), p.center[2] + dot(d, w)], i * 3);
    g.Normals?.set([1, 0, 0], i * 3);
  }
}

/**
 * Repair the model's own glow in place, as Blizzard builds it. A glow-only
 * bone is reused for its first piece; new bones are made only where a piece
 * has no bone of its own. Returns the number of pieces fixed.
 */
export function repairHeroGlow(model) {
  const found = findHeroGlow(model);
  if (!found) return 0;
  const faults = diagnose(model, found), { nodes } = found, claimed = new Set();
  const ownBone = (p, base, parent, flags) => {
    const bone = addBone(model, base, p.center, parent, flags);
    bone.Name = glowBoneName(model, base);
    bindVertices(model, model.Geosets[p.geoset], p.vertices, bone.ObjectId);
    return bone;
  };
  // A bone holding only glow serves its first piece; its pivot moves onto that piece when nothing turns about it.
  const claim = (p, set, still) => {
    const id = p.bones.length === 1 && !p.unbound ? p.bones[0] : null, bone = nodes.get(id);
    if (!bone || claimed.has(id) || !found.holds(id, set) || !still(bone)) return null;
    claimed.add(id);
    if (!hasChildren(model, id)) bone.PivotPoint.set(p.center);
    return bone;
  };
  // Ground planes pulse like the template's, lowest first.
  const ground = [...(found.origin?.pieces || [])].sort((a, b) => a.center[2] - b.center[2]);
  for (const p of [...faults['ground-bone'], ...faults.pulse, ...faults.unbound.filter(p => p.ground)]) {
    const bone = claim(p, ground, b => !b.Rotation) || ownBone(p, 'Glow Origin', null, 0), { keys, period } = ORIGIN_LAYERS[Math.min(2, ground.indexOf(p))];
    bone.Scaling = pulse(model, keys, period);
  }
  for (const p of [...faults.billboard, ...faults.unbound.filter(p => !p.ground)]) {
    if (p.unbound || !billboardBones(found, p)) {
      const reuse = claim(p, found.pieces, b => !b.Rotation && !b.Scaling);
      if (reuse) reuse.Flags |= reuse.Flags & BILLBOARDED ? 0 : 8;
      else {
        const id = p.unbound ? nearestBone(model, p.center) : [...p.load].sort((a, b) => b[1] - a[1])[0][0], bone = nodes.get(id);
        ownBone(p, 'Glow Weapon', bone && bone.Flags & BILLBOARDED ? bone.Parent ?? null : id, 8);
      }
    }
    if (!facesCamera(p)) faceCamera(model.Geosets[p.geoset], p);
  }
  if (model.Info) model.Info.NumBones = model.Bones?.length || 0;
  return Object.values(faults).reduce((sum, items) => sum + items.length, 0);
}
