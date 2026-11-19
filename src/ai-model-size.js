// Where a model's bytes go: the saved MDX split by chunk (geosets each, animation tracks, nodes,
// materials, texture paths, emitters ...), and which parts of the model use each texture.
import { trackInventory } from './ai-motion-compare.js';
import { layerTextureIds } from './texture-references.js';

const GROUPS = {
  geosets: ['GEOS'], geosetAnims: ['GEOA'], nodes: ['BONE', 'HELP', 'ATCH', 'EVTS', 'CLID'], materials: ['MTLS'],
  texturePaths: ['TEXS'], textureAnims: ['TXAN'], emitters: ['PREM', 'PRE2', 'RIBB', 'CORN'], lights: ['LITE'],
  cameras: ['CAMS'], sequences: ['SEQS', 'GLBS'], pivots: ['PIVT'], header: ['VERS', 'MODL'],
};
const tag = (view, at) => String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));

/** Top-level MDX chunks: [{ tag, bytes }] (bytes include the 8-byte chunk header). */
export function mdxChunks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), chunks = [];
  if (bytes.byteLength < 4 || tag(view, 0) !== 'MDLX') throw Error('Not MDX bytes.');
  for (let at = 4; at + 8 <= bytes.byteLength;) {
    const size = view.getUint32(at + 4, true);
    chunks.push({ tag: tag(view, at), bytes: 8 + size, start: at + 8 });
    at += 8 + size;
  }
  return chunks;
}

/**
 * The saved MDX bytes by part: groups (geosets, geosetAnims, nodes, materials, texturePaths,
 * textureAnims, emitters, lights, cameras, sequences, pivots, header, other) that add up to the total;
 * the biggest geosets; and animation tracks (keys inside nodes, materials, geoset animations and
 * emitters: their encoded bytes and the biggest tracks). Texture images are separate files.
 */
export function mdxSizeBreakdown(bytes, model) {
  const chunks = mdxChunks(bytes), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const groups = Object.fromEntries(Object.keys(GROUPS).map(name => [name, 0]));
  groups.other = 0;
  for (const chunk of chunks) {
    const group = Object.entries(GROUPS).find(([, tags]) => tags.includes(chunk.tag))?.[0] || 'other';
    groups[group] += chunk.bytes;
  }
  const geosets = [], geos = chunks.find(c => c.tag === 'GEOS');
  if (geos) for (let at = geos.start, i = 0; at + 4 <= geos.start + geos.bytes - 8; i++) {
    const size = view.getUint32(at, true);
    if (!size) break;
    const geoset = model?.Geosets?.[i];
    geosets.push({ geoset: i, bytes: size, ...(geoset ? { vertices: geoset.Vertices.length / 3, triangles: geoset.Faces.length / 3 } : {}) });
    at += size;
  }
  let tracks = null;
  if (model) {
    const inventory = trackInventory(model);
    tracks = { bytes: inventory.trackBytes, count: inventory.tracks.length, keysOutsideAnimations: inventory.keysOutsideAnimations,
      biggest: [...inventory.tracks].sort((a, b) => b.bytes - a.bytes).slice(0, 5).map(t => ({ path: t.path, keys: t.keys, bytes: t.bytes })) };
  }
  return {
    total: bytes.byteLength, groups,
    biggestGeosets: geosets.sort((a, b) => b.bytes - a.bytes).slice(0, 5),
    tracks,
    note: 'groups add up to the total; tracks are inside nodes, materials, geosetAnims and emitters. Texture images are separate files (see mdlxl_assets source model).',
  };
}

/** For each texture: the materials and layers, geosets (with triangles), particle emitters and ribbons
 * that use it. */
export function textureUses(model) {
  const uses = (model.Textures || []).map(() => ({ materials: new Set(), geosets: new Set(), triangles: 0, emitters: [], ribbons: [] }));
  (model.Materials || []).forEach((material, mi) => (material.Layers || []).forEach(layer => {
    for (const id of layerTextureIds(model, layer)) uses[id]?.materials.add(mi);
  }));
  (model.Geosets || []).forEach((geoset, gi) => uses.forEach(use => {
    if (use.materials.has(geoset.MaterialID)) { use.geosets.add(gi); use.triangles += geoset.Faces.length / 3; }
  }));
  (model.ParticleEmitters2 || []).forEach((emitter, i) => {
    const ids = typeof emitter.TextureID === 'number' ? [emitter.TextureID] : layerTextureIds(model, emitter);
    for (const id of ids) uses[id]?.emitters.push(emitter.Name || 'Emitter ' + i);
  });
  (model.RibbonEmitters || []).forEach((ribbon, i) => uses.forEach(use => { if (use.materials.has(ribbon.MaterialID)) use.ribbons.push(ribbon.Name || 'Ribbon ' + i); }));
  return uses.map(use => ({ materials: [...use.materials], geosets: [...use.geosets], triangles: use.triangles,
    ...(use.emitters.length ? { emitters: use.emitters } : {}), ...(use.ribbons.length ? { ribbons: use.ribbons } : {}) }));
}
