// Made-up rigs for the Bone Namer tests. Every bone owns a little box of skinned vertices so POSE sees real,
// supported joints. Units face +X, so +Y is the unit's left (docs/agent-tasks/bone-namer.md, "Side").

export function emptyModel() {
  return { Version: 800, Bones: [], Helpers: [], Attachments: [], ParticleEmitters2: [], Nodes: [], Geosets: [], GeosetAnims: [], GlobalSequences: [], Sequences: [{ Name: 'Stand', Interval: [0, 1000] }, { Name: 'Walk', Interval: [1100, 2000] }], PivotPoints: [], Materials: [{ Layers: [{ FilterMode: 0 }] }], Textures: [], Info: {} };
}

// The one skinned geoset every rig bone adds its box to.
function newGeoset(model) {
  model.Geosets.push({ Vertices: new Float32Array(0), Normals: new Float32Array(0), VertexGroup: new Uint8Array(0), Groups: [], Faces: new Uint16Array([0, 1, 2]), TVertices: [new Float32Array(0)], MaterialID: 0, SelectionGroup: 0, Unselectable: false, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0, Anims: [] });
  return model.Geosets.length - 1;
}
const geosetOf = model => model.Geosets[model.currentGeoset ?? (model.Geosets.length ? 0 : newGeoset(model))];

// Skins every bone added from now on to a new geoset; hidden = invisible in every sequence (a rig copy).
export function startGeoset(model, { hidden = false } = {}) {
  model.currentGeoset = newGeoset(model);
  if (hidden) model.GeosetAnims.push({ GeosetId: model.currentGeoset, Flags: 0, Alpha: 0 });
  return model.currentGeoset;
}

// Adds one node (bone by default) with a skinned box around `mesh`, returns its ObjectId.
export function addNode(model, Name, Parent, PivotPoint, { mesh = true, list = 'Bones' } = {}) {
  const node = { Name, ObjectId: model.Nodes.length, Parent, PivotPoint: new Float32Array(PivotPoint), Flags: 256, GeosetId: null, GeosetAnimId: null };
  model[list].push(node); model.Nodes[node.ObjectId] = node; model.PivotPoints[node.ObjectId] = node.PivotPoint;
  if (mesh && list !== 'Attachments') {
    const geoset = geosetOf(model), index = geoset.Groups.length, vertices = [], group = [];
    geoset.Groups.push([node.ObjectId]);
    const [x, y, z] = PivotPoint;
    for (const dx of [-2, 2]) for (const dy of [-2, 2]) for (const dz of [-2, 2]) { vertices.push(x + dx, y + dy, z + dz); group.push(index); }
    const merge = (a, b) => { const out = new a.constructor(a.length + b.length); out.set(a); out.set(b, a.length); return out; };
    geoset.Vertices = merge(geoset.Vertices, new Float32Array(vertices));
    geoset.Normals = new Float32Array(geoset.Vertices.length);
    geoset.VertexGroup = merge(geoset.VertexGroup, new Uint8Array(group));
    geoset.TVertices = [new Float32Array(geoset.Vertices.length / 3 * 2)];
  }
  return node.ObjectId;
}

export const allBones = model => [...model.Bones, ...model.Helpers];
export const idOf = (model, name) => allBones(model).find(node => node.Name === name)?.ObjectId;
export const nodeName = (model, id) => model.Nodes[id].Name;

/**
 * A standing biped. `name(part)` supplies each bone name; parts are
 * root pelvis chest head neck, spine.0.., neckN.0.., arm1|arm2|hand + L|R, leg1|leg2|foot + L|R.
 * `ox`/`oz`/`scale` place and size it; `parent` hangs the whole actor under a node (a rider on a mount).
 * `links` inserts unnamed bones between pelvis and chest (spine) or chest and head (neck).
 * `swapSides` names the left (+Y) limbs `R` and the right ones `L`, like a badly made model.
 */
export function addBiped(model, { name, ox = 0, oz = 0, scale = 1, parent = null, spineLinks = 0, neckLinks = 0, swapSides = false, legHeight = 38, leftLeg = null, noPelvis = false } = {}) {
  const at = (x, y, z) => [ox + x * scale, y * scale, oz + z * scale];
  const root = addNode(model, name('root'), parent, at(0, 0, 40));
  const pelvis = noPelvis ? root : addNode(model, name('pelvis'), root, at(0, 0, legHeight));
  let up = pelvis;
  for (let i = 0; i < spineLinks; i++) up = addNode(model, name(`spine.${i}`), up, at(0, 0, 44 + i * 3));
  const chest = addNode(model, name('chest'), up, at(0, 0, 60));
  let top = chest;
  for (let i = 0; i < neckLinks; i++) top = addNode(model, name(`neck.${i}`), top, at(0, 0, 70 + i * 3));
  const head = addNode(model, name('head'), top, at(0, 0, 80));
  const ids = { root, pelvis, chest, head };
  for (const [side, sign] of [['L', 1], ['R', -1]]) {
    const label = swapSides ? (side === 'L' ? 'R' : 'L') : side;
    const part = key => name(`${key}.${label}`);
    ids[`arm1${side}`] = addNode(model, part('arm1'), chest, at(0, 15 * sign, 62));
    ids[`arm2${side}`] = addNode(model, part('arm2'), ids[`arm1${side}`], at(0, 22 * sign, 48));
    ids[`hand${side}`] = addNode(model, part('hand'), ids[`arm2${side}`], at(0, 25 * sign, 36));
    if (side === 'L' && leftLeg === 'extra') {
      // An extra numbered joint above the thigh: POSE walks up through "Bone01" into the leg chain.
      ids.extraL = addNode(model, 'Bone01', pelvis, at(0, 4, legHeight + 2));
      ids.leg1L = addNode(model, part('leg1'), ids.extraL, at(0, 8, legHeight));
    } else if (side === 'L' && leftLeg === 'missed') {
      // POSE's chain starts at Link_L; the joint above it (Upper_L) is left out of the leg.
      ids.upperL = addNode(model, 'Upper_L', pelvis, at(0, 8, legHeight));
      ids.linkL = addNode(model, 'Link_L', ids.upperL, at(0, 8.5, 30));
      ids.leg1L = ids.linkL;
    } else ids[`leg1${side}`] = addNode(model, part('leg1'), pelvis, at(0, 8 * sign, legHeight));
    ids[`leg2${side}`] = addNode(model, side === 'L' && leftLeg === 'missed' ? 'Knee_L' : part('leg2'), ids[`leg1${side}`], at(0, 9 * sign, 20));
    ids[`foot${side}`] = addNode(model, part('foot'), ids[`leg2${side}`], at(2, 9 * sign, 5));
  }
  return ids;
}

// Blizzard-style names for the biped parts (what the namer itself produces for a single actor).
export function standardName(part) {
  const [key, side] = part.split('.');
  const map = { root: 'Bone_Root', pelvis: 'Bone_Pelvis', chest: 'Bone_Chest', head: 'Bone_Head' };
  if (map[key]) return map[key];
  if (/^spine\./.test(part)) return `Bone_Spine_${key}`;
  return { arm1: 'Bone_Arm1', arm2: 'Bone_Arm2', hand: 'Bone_Hand', leg1: 'Bone_Leg1', leg2: 'Bone_Leg2', foot: 'Bone_Foot' }[key] + '_' + side;
}

// Names nobody can read: only the part's own word survives, so POSE still finds the part but the names are junk.
export const messyName = part => {
  const [key, side] = part.split('.');
  const word = { root: 'BoneRoot', pelvis: 'Bone_Hips', chest: 'Torso_Chest', head: 'Bone_Head01', arm1: 'Shoulder', arm2: 'Elbow', hand: 'Hand', leg1: 'Thigh', leg2: 'Knee', foot: 'Foot' }[key];
  if (word) return side ? `${word}_${side}` : word;
  return `Link_${part.replace('.', '_')}`;
};

/**
 * A four-legged animal facing +X: a body, chest/neck/head, pelvis/tail, and four legs whose ends are hooves.
 * `pairs` is the list of leg-pair x positions, front first. Names follow Blizzard's horse: Leg1..Leg3 then Hoof.
 */
export function addQuadruped(model, { prefix = 'Bone Horse ', ox = 0, scale = 1, pairs = [30, -25], parent = null, bodyName = 'Body' } = {}) {
  const at = (x, y, z) => [ox + x * scale, y * scale, 50 * scale + z * scale];
  const root = addNode(model, `${prefix}${bodyName}`, parent, at(0, 0, 0));
  const pelvis = addNode(model, `${prefix}Pelvis`, root, at(-20, 0, 0));
  const chest = addNode(model, `${prefix}Chest`, root, at(25, 0, 5));
  const neck = addNode(model, `${prefix}Neck`, chest, at(40, 0, 20));
  const head = addNode(model, `${prefix}Head`, neck, at(55, 0, 25));
  const ids = { root, pelvis, chest, neck, head };
  pairs.forEach((x, pair) => {
    for (const [side, sign] of [['L', 1], ['R', -1]]) {
      const key = `${pair}${side}`;
      ids[`leg1_${key}`] = addNode(model, `${prefix}Leg1_${pair}_${side}`, x > 0 ? chest : pelvis, at(x, 10 * sign, -5));
      ids[`leg2_${key}`] = addNode(model, `${prefix}Leg2_${pair}_${side}`, ids[`leg1_${key}`], at(x, 10 * sign, -22));
      ids[`leg3_${key}`] = addNode(model, `${prefix}Leg3_${pair}_${side}`, ids[`leg2_${key}`], at(x, 10 * sign, -38));
      ids[`hoof_${key}`] = addNode(model, `${prefix}Hoof_${pair}_${side}`, ids[`leg3_${key}`], at(x, 10 * sign, -50));
    }
  });
  return ids;
}
