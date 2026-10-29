import { createHash } from 'node:crypto';
import { createDemoDocument, openDocument } from '../../src/editor-document.js';
import { sortMyMessInventory, applySortMyMess } from '../../src/sort-my-mess.js';
import { commitPart, partMaterialKey } from '../../src/bits-and-parts.js';
import { mergeSimilarGeosets } from '../../src/geoset-operations.js';

// Includes typed-array constructors, undefined, Map entries and the entire result/model.
export function identityHash(value) {
  const canonical = item => {
    if (ArrayBuffer.isView(item)) return [item.constructor.name, Array.from(item)];
    if (item instanceof Map) return ['Map', [...item].map(canonical)];
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]));
    return item === undefined ? ['undefined'] : item;
  };
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function withReferences(input) {
  const model = structuredClone(input), source = model.Geosets[0];
  const duplicate = model.Textures.push(structuredClone(model.Textures[0])) - 1;
  const fallback = model.Textures.push({ Image: 'Textures\\WP34.blp', ReplaceableId: 0, Flags: 0 }) - 1;
  const material = structuredClone(model.Materials[source.MaterialID]);
  material.Layers[0].TextureID = { LineType: 0, GlobalSeqId: null, Keys: [0, 1000].map((Frame, i) => ({ Frame, Vector: new Float32Array([i ? 0 : duplicate]) })) };
  material.Layers[0]._MdxDefaults = { ...material.Layers[0]._MdxDefaults, TextureID: fallback };
  source.MaterialID = model.Materials.push(material) - 1;
  const copy = structuredClone(source); copy.MaterialID = model.Materials.push(structuredClone(material)) - 1;
  model.Geosets.push(copy);
  return model;
}

export function textureReferenceIdentity(input) {
  const results = { input: identityHash(input) };
  for (const [name, source] of [['raw', input], ['references', withReferences(input)]]) {
    const sorted = structuredClone(source);
    const inventory = sortMyMessInventory(sorted);
    const sortedResult = applySortMyMess(sorted, inventory.groups.map(group => ({ geosets: group.geosets, actions: {}, results: {}, share: true })));
    results[name + ':sort'] = identityHash({ inventory, model: sorted, result: sortedResult });
    const merged = structuredClone(source);
    const mergedResult = mergeSimilarGeosets(merged, Object.fromEntries(merged.Geosets.map((_, id) => [id, [0]])));
    results[name + ':merge'] = identityHash({ model: merged, result: mergedResult });
    const target = createDemoDocument().model;
    const keys = source.Materials.map(material => partMaterialKey(source, material));
    const first = commitPart(target, source), second = commitPart(target, source);
    results[name + ':parts'] = identityHash({ model: target, first, second, keys });
    // The same output bytes are part of the preservation contract too.
    const doc = openDocument('Version { FormatVersion 800, }\nModel "Identity" { BlendTime 150, }', 'identity.mdl');
    Object.assign(doc.model, target);
    for (const format of ['mdx', 'mdl']) results[name + ':' + format] = identityHash(doc.serialize(format));
  }
  return results;
}
