import { createRigNode, selectedVertexCenter } from './bone-tools.js';
import { recalculateExtents } from './editor-document.js';
import { allNodes } from './animation.js';

export const GLOW_TYPES = Object.freeze([
  { id: 'billboard', label: 'Billboarded (faces camera)', flags: 8 },
  { id: 'plane', label: 'Flat plane', flags: 0 },
  { id: 'lockX', label: 'Billboarded · lock X', flags: 16 },
  { id: 'lockY', label: 'Billboarded · lock Y', flags: 32 },
  { id: 'lockZ', label: 'Billboarded · lock Z', flags: 64 },
]);

/** Use authored vertex positions and bindings, as in the vertex editor. */
export function glowSelection(model, selection = {}) {
  const selected = {}, weights = new Map(), nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  let count = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const [key, ids] of Object.entries(selection)) {
    const g = model.Geosets?.[key]; if (!g) continue;
    const valid = [...new Set(ids)].filter(id => Number.isInteger(id) && id >= 0 && id * 3 + 2 < g.Vertices.length);
    if (!valid.length) continue;
    selected[key] = valid;
    for (const id of valid) {
      count++;
      for (let axis = 0; axis < 3; axis++) { const value = g.Vertices[id * 3 + axis]; min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); }
      const hd = g.SkinWeights?.length, group = hd ? Array.from(g.SkinWeights.slice(id * 8, id * 8 + 4)) : g.Groups?.[g.VertexGroup?.[id]] || [];
      group.forEach((bone, slot) => {
        const weight = hd ? g.SkinWeights[id * 8 + 4 + slot] / 255 : 1 / group.length;
        if (weight > 0 && nodes.has(bone)) weights.set(bone, (weights.get(bone) || 0) + weight);
      });
    }
  }
  if (!count) throw Error('Select vertices in the vertex editor, then open Forge → Glow Up.');
  const center = selectedVertexCenter(model, selected), size = Math.max(8, ...max.map((v, i) => v - min[i]));
  if (center.some(v => !Number.isFinite(v))) throw Error('The selected vertices have invalid positions.');
  const ranked = [...weights].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return { selected, count, center, size, parentId: ranked[0]?.[0] ?? null, mixed: ranked.length > 1 };
}

/** Add a fresh quad and bone. Existing rig nodes and authored geometry stay intact. */
export function commitGlow(model, selection, { type = 'billboard', plane = 'xy', width, height, alpha = .75, parentId } = {}) {
  const anchor = glowSelection(model, selection), kind = GLOW_TYPES.find(item => item.id === type);
  if (!kind) throw Error('Choose a glow type.');
  if (!['xy', 'xz', 'yz'].includes(plane)) throw Error('Choose a glow plane.');
  width ??= anchor.size; height ??= anchor.size;
  if (![width, height].every(value => Number.isFinite(value) && value >= .01 && value <= 100000)) throw Error('Glow sizes must be between 0.01 and 100000.');
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw Error('Glow intensity must be between 0 and 100%.');
  parentId = parentId === undefined ? anchor.parentId : parentId;
  if (parentId !== null && !allNodes(model).some(n => n.ObjectId === parentId)) throw Error('The glow attachment no longer exists.');
  const bone = createRigNode(model, 'Bone', anchor.selected);
  const names = new Set(allNodes(model).filter(n => n !== bone).map(n => n.Name));
  let name = 'Glow', suffix = 2; while (names.has(name)) name = `Glow ${suffix++}`;
  bone.Name = name; bone.Parent = parentId; bone.Flags = 256 | kind.flags;
  model.Textures ||= []; model.Materials ||= []; model.Geosets ||= []; model.GeosetAnims ||= [];
  let textureId = model.Textures.findIndex(t => t.ReplaceableId === 2 && !t.Image && !t.Flags);
  if (textureId < 0) { textureId = model.Textures.length; model.Textures.push({ Image: '', ReplaceableId: 2, Flags: 0 }); }
  const materialId = model.Materials.length;
  // AddAlpha makes the intensity slider effective. It is also used by the
  // supplied Gnome Dragonrider. Unshaded + TwoSided; retain normal depth testing.
  model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 4, Shading: 17, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: alpha }] });
  // Warcraft camera-facing quads face +X (YZ), not the editor's usual XY plane.
  const axes = type === 'plane' ? ({ xy: [0, 1, 2], xz: [0, 2, 1], yz: [1, 2, 0] })[plane] : [1, 2, 0];
  const vertices = [], normals = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = [...anchor.center], n = [0, 0, 0]; p[axes[0]] += u * width / 2; p[axes[1]] += v * height / 2; n[axes[2]] = type === 'plane' && plane === 'xz' ? -1 : 1;
    vertices.push(...p); normals.push(...n);
  }
  const geosetIndex = model.Geosets.length, geosetAnimId = model.GeosetAnims.length;
  const g = { Vertices: new Float32Array(vertices), Normals: new Float32Array(normals), TVertices: [new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])], Faces: new Uint16Array([0, 1, 2, 0, 2, 3]), VertexGroup: new Uint8Array(4), Groups: [[bone.ObjectId]], TotalGroupsCount: 1, MaterialID: materialId, SelectionGroup: 0, Unselectable: false, Anims: [] };
  if (model.Version >= 900) g.LevelOfDetail = 0;
  model.Geosets.push(g);
  model.GeosetAnims.push({ GeosetId: geosetIndex, Flags: 0, Alpha: 1, Color: new Float32Array([1, 1, 1]) });
  bone.GeosetId = geosetIndex; bone.GeosetAnimId = geosetAnimId;
  // Recalculate only the new geoset, preserving authored bounds on old meshes.
  const boundsModel = { Geosets: [g], Info: {} }; recalculateExtents(boundsModel);
  g.Anims = (model.Sequences || []).map(() => ({ MinimumExtent: g.MinimumExtent.slice(), MaximumExtent: g.MaximumExtent.slice(), BoundsRadius: g.BoundsRadius }));
  if (model.Info) {
    for (const key of ['MinimumExtent', 'MaximumExtent']) model.Info[key] = new Float32Array(anchor.center.map((_, i) => (key === 'MinimumExtent' ? Math.min : Math.max)(model.Info[key]?.[i] ?? g[key][i], g[key][i])));
    model.Info.BoundsRadius = Math.max(model.Info.BoundsRadius || 0, Math.hypot(...model.Info.MaximumExtent.map((v, i) => (v - model.Info.MinimumExtent[i]) / 2)));
    model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length; model.Info.NumBones = model.Bones.length;
  }
  return { geosetIndices: [geosetIndex], boneId: bone.ObjectId, parentId, textureId };
}
