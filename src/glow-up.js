import { clamp } from './math.js';
import { createRigNode } from './bone-tools.js';
import { recalculateExtents } from './editor-document.js';
import { allNodes } from './animation.js';
import { ribbonPolygonSelection } from './particle-ribbon-fit.js';

// Hero glow as Blizzard and Gluma build it (docs/GLOW_UP.md): team glow
// (ReplaceableId 2), Additive, Unshaded, alpha 0.75.
//  - Origin: three flat ground planes stacked at the feet, each on its own
//    unparented bone that pulses on its own global sequence.
//  - Weapon: a row of camera-facing squares along the blade, each on its own
//    billboarded bone parented to the weapon bone.
// The planes, heights and pulse keys are the Paladin/Jaina/Uther template,
// scaled to the model. Layer three runs on its own period, as Gluma does.

const WEAPON_NAME = /weapon|(^|[\s_])(w_|wep)|sword|sord|blade|axe|hammer|mace|club|staff|stave|spear|lance|pike|glaive|scythe|halberd|polearm|flail|maul|wand|dagger|knife|katana|scimitar|trident|bow|gun|rifle|pipe/i;
const SIDE = /(^|[\s_.-])(l|r|left|right)(?=$|[\s_.\d-])/i;
const HIDDEN = /death|decay|dissipate/i;
const HERMITE = 2;
const PULSE_FAST = [[0, 1, 0, .255], [1100, 1.17, 0, 0], [1600, 1, -.255, 0]];
const PULSE_SLOW = [[0, 1, 0, -.244], [833, .823, -.043, -.04], [1600, .917, .094, -.138], [2400, .78, .038, .044], [3333, 1, .308, 0]];
// Paladin: widths 225/254/189 at heights 7/15.8/25.5 for a 254 wide glow.
const ORIGIN_LAYERS = [
  { width: .887, height: 7 / 254, keys: PULSE_FAST, period: 1600 },
  { width: 1, height: 15.8 / 254, keys: PULSE_SLOW, period: 3333 },
  { width: .745, height: 25.5 / 254, keys: PULSE_SLOW, period: 2666 },
];

const isTeamGlowGeoset = (model, g) => (model.Materials?.[g.MaterialID]?.Layers || []).some(l => model.Textures?.[l.TextureID]?.ReplaceableId === 2);
const bindingsOf = (g, id) => {
  if (g.SkinWeights?.length >= (id + 1) * 8) return Array.from(g.SkinWeights.slice(id * 8, id * 8 + 4)).filter((_, i) => g.SkinWeights[id * 8 + 4 + i] >= 128);
  return Array.from(g.Groups?.[g.VertexGroup?.[id]] || []);
};
const point = (g, id) => [g.Vertices[id * 3], g.Vertices[id * 3 + 1], g.Vertices[id * 3 + 2]];

/** Does the model already carry visible team glow geometry? */
export function hasHeroGlow(model) {
  return (model.Geosets || []).some(g => (model.Materials?.[g.MaterialID]?.Layers || []).some(l => model.Textures?.[l.TextureID]?.ReplaceableId === 2 && l.FilterMode >= 3));
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
  const nodes = model.Nodes || [];
  for (let node = nodes[id], guard = 0; node && guard++ < 64; node = nodes[node.Parent]) if (/hand/i.test(node.Name || '')) return Array.from(node.PivotPoint || [0, 0, 0]);
  return Array.from(nodes[id]?.PivotPoint || [0, 0, 0]);
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
  const nodes = model.Nodes || [], found = [], body = bodyHeight(model) ?? 100;
  for (const bone of model.Bones || []) {
    const points = weaponPoints(model, bone.ObjectId);
    if (points.length < 4) continue;
    const fit = principalAxis(points), length = fit.max - fit.min;
    if (!(length > 4)) continue;
    let held = false;
    for (let node = nodes[bone.Parent], guard = 0; node && guard++ < 4; node = nodes[node.Parent]) if (/hand/i.test(node.Name || '')) held = true;
    const named = WEAPON_NAME.test(bone.Name || ''), slender = length / fit.thickness;
    // An unnamed sword held in a hand (the Footman's Cone11) is long and thin: 2 + 1 + 1.
    const score = (named ? 4 : 0) + (held ? 2 : 0) + (slender > 3 ? 1 : 0) + (length > .35 * body ? 1 : 0) - (/hand(?!le)|arm|leg|foot|head|chest|root|spine|neck|tail|wing/i.test(bone.Name || '') ? 5 : 0);
    found.push({ id: bone.ObjectId, name: bone.Name, score, length });
  }
  return found.sort((a, b) => b.score - a.score || b.length - a.length);
}

const sideless = name => String(name || '').replace(SIDE, (_, lead) => lead + '#');

/**
 * Weapon choices for the picker, best first. Marked polygons come first when
 * there are any; a mirrored pair (sword_L + sword_R) is offered as one choice.
 */
export function weaponChoices(model, marked) {
  const choices = [], found = weaponCandidates(model), likely = found.filter(c => c.score > 0);
  // `sure`: clear enough to switch weapon glow on by default (a weapon name).
  if (marked && ribbonPolygonSelection(model, marked).polygons) choices.push({ key: 'marked', label: 'Marked polygons', marked, sure: true });
  const top = likely[0], twin = top && SIDE.test(top.name) && likely.find(c => c !== top && c.score === top.score && sideless(c.name) === sideless(top.name));
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

function uniqueName(model, base) {
  const names = new Set(allNodes(model).map(n => n.Name));
  let name = base, suffix = 2; while (names.has(name)) name = `${base} ${suffix++}`;
  return name;
}

function addBone(model, name, center, parentId, flags) {
  const bone = createRigNode(model, 'Bone');
  bone.Name = uniqueName(model, name); bone.Parent = parentId; bone.Flags = 256 | flags;
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
  if (!sequences.some(s => HIDDEN.test(s.Name || ''))) return 1;
  // Sequences may share a start frame; any visible one keeps the glow on there.
  const keys = new Map();
  for (const s of sequences) {
    // Some Blizzard files carry a stray sequence at an unsigned -167; it cannot be keyed.
    const frame = Number(s.Interval[0]), value = HIDDEN.test(s.Name || '') ? 0 : 1;
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
  g.Anims = (model.Sequences || []).map(() => ({ MinimumExtent: g.MinimumExtent.slice(), MaximumExtent: g.MaximumExtent.slice(), BoundsRadius: g.BoundsRadius }));
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
  // One material per brightness: the ground and the weapon share it when they match.
  const material = alpha => model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 3, Shading: 17, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: alpha }] }) - 1;
  const materialId = material(origin ? originBrightness : weaponBrightness);
  const weaponMaterialId = origin && weapon && weaponBrightness !== originBrightness ? material(weaponBrightness) : materialId;
  const geosetIndices = [];
  if (origin) geosetIndices.push(addOrigin(model, fitted * originSize, materialId, originOffset));
  if (weapon) geosetIndices.push(addWeapon(model, lines, weaponSize, fitted, weaponMaterialId));
  if (model.Info) {
    const added = geosetIndices.map(i => model.Geosets[i]);
    for (const key of ['MinimumExtent', 'MaximumExtent']) model.Info[key] = new Float32Array([0, 1, 2].map(a => (key === 'MinimumExtent' ? Math.min : Math.max)(model.Info[key]?.[a] ?? added[0][key][a], ...added.map(g => g[key][a]))));
    model.Info.BoundsRadius = Math.max(model.Info.BoundsRadius || 0, Math.hypot(...model.Info.MaximumExtent.map((v, i) => (v - model.Info.MinimumExtent[i]) / 2)));
    model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length; model.Info.NumBones = model.Bones.length;
  }
  return { geosetIndices, materialId, weaponMaterialId, textureId, size: fitted };
}

/**
 * Where the glow's drag handles sit, in bind-pose model space: the origin
 * glow's centre and half width (its widest plane), and per weapon line the
 * butt, tip, glowing stretch and the middle square's half width.
 */
export function glowLayout(model, { originSize = 1, originOffset = [0, 0], weaponIds = [], marked, weaponSize = 1, weaponFrom, weaponTo } = {}) {
  const fitted = originGlowSize(model), size = fitted * originSize, range = { from: weaponFrom, to: weaponTo };
  const origin = { center: [originOffset[0], originOffset[1], size * ORIGIN_LAYERS[1].height], half: size * ORIGIN_LAYERS[1].width / 2 };
  const lines = marked ? [weaponLine(model, { marked, ...range })] : weaponIds.map(weaponId => weaponLine(model, { weaponId, ...range }));
  return { origin, weapons: lines.map(line => ({ ...line, mid: line.start.map((v, a) => (v + line.end[a]) / 2), half: weaponSquares(line, weaponSize, fitted).quad / 2 })) };
}
