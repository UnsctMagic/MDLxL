import { visitTextureReferences } from './texture-references.js';
import { sampleTrack } from './animation.js';
import { createVisibilityGeosetAnimation } from './geoset-animation-defaults.js';
import { tintTexturePath } from './material-presets.js';
import { TEAM_COLORS } from './team-colors.js';

const clone = value => structuredClone(value);
const colors = new Set(['Color', 'FresnelColor']);
const renderFields = new Set(['FilterMode', 'Shading', 'RenderMode', 'PriorityPlane']);
const slots = ['TextureID', 'NormalTextureID', 'ORMTextureID', 'EmissiveTextureID', 'TeamColorTextureID', 'ReflectionsTextureID'];
const fixedColors = new Map(TEAM_COLORS.filter(color => color.index !== null).map(color => [tintTexturePath(color.index).toLowerCase(), color.rgb.map(value => value / 255)]));
const fixedTint = texture => texture?.ReplaceableId === 0 && fixedColors.get(texture.Image?.replaceAll('/', '\\').toLowerCase());
function canonical(value, omit = new Set()) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, item => canonical(item, omit));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => !omit.has(key) && value[key] !== undefined).map(key => [key, canonical(value[key], omit)]));
  return value;
}
const key = (value, omit) => JSON.stringify(canonical(value, omit));
const animsFor = (model, id) => (model.GeosetAnims || []).filter(anim => anim.GeosetId === id);
function visibility(model, id) {
  const anims = animsFor(model, id);
  if (!anims.length) return key([{ Alpha: 1, Flags: 0 }]);
  return key(anims.map(anim => {
    const copy = clone(anim); delete copy.GeosetId; delete copy.Color;
    copy.Flags = (copy.Flags || 0) & ~2; copy.Alpha ??= 1;
    if (copy._MdxDefaults) { delete copy._MdxDefaults.Color; if (!Object.keys(copy._MdxDefaults).length) delete copy._MdxDefaults; }
    return copy;
  }));
}
function materialVisibility(model, materialId) {
  const values = new Set(model.Geosets.flatMap((g, i) => g.MaterialID === materialId ? [visibility(model, i)] : []));
  // Ribbons are material consumers too; never merge across different effect alpha.
  for (const ribbon of model.RibbonEmitters || []) if (ribbon.MaterialID === materialId) values.add(key({ ribbon: true, Alpha: ribbon.Alpha, Visibility: ribbon.Visibility }));
  return [...values].sort().join('|');
}
function compact(model, collection, fingerprint, remap) {
  const kept = [], seen = new Map(), indices = new Map();
  model[collection].forEach((record, i) => {
    const signature = fingerprint(record, i);
    if (!seen.has(signature)) { seen.set(signature, kept.length); kept.push(record); }
    indices.set(i, seen.get(signature));
  });
  const removed = model[collection].length - kept.length;
  if (removed) { remap(indices); model[collection] = kept; }
  return removed;
}
function hasInterpolatedTextureIds(model) {
  const interpolated = track => track?.Keys && (track.LineType !== 0 || track.Keys.some(k => k.InTan || k.OutTan));
  return model.Materials.some(material => material.Layers.some(layer => slots.some(slot => interpolated(layer[slot])))) || (model.ParticleEmitters2 || []).some(node => interpolated(node.TextureID));
}
/** Only exact resource records collapse. Layer passes and unused records remain. */
export function condenseExactResources(model) {
  const textureIdsProtected = hasInterpolatedTextureIds(model);
  const textures = textureIdsProtected ? 0 : compact(model, 'Textures', texture => key(texture), indices => {
    visitTextureReferences(model, (id, set) => { if (indices.has(id)) set(indices.get(id)); });
  });
  const materials = compact(model, 'Materials', (material, id) => key(material) + '|' + materialVisibility(model, id), indices => {
    for (const consumer of [...model.Geosets, ...(model.RibbonEmitters || [])]) if (indices.has(consumer.MaterialID)) consumer.MaterialID = indices.get(consumer.MaterialID);
  });
  return { textures, materials, textureIdsProtected };
}
function resolved(model, material, omit, textureMode) {
  const result = clone(material);
  for (const layer of result.Layers) for (const field of slots) {
    const resolve = id => {
      const texture = model.Textures[id];
      if (textureMode === 'rgb' && fixedTint(texture)) return { ...texture, Image: '<fixed RGB>' };
      if (textureMode === 'team' && (fixedTint(texture) || texture?.ReplaceableId === 1)) return { ...texture, Image: '<team or fixed RGB>', ReplaceableId: 0 };
      return texture || id;
    };
    if (typeof layer[field] === 'number') layer[field] = resolve(layer[field]);
    else if (layer[field]?.Keys) for (const frame of layer[field].Keys) for (const part of ['Vector', 'InTan', 'OutTan']) if (frame[part]) frame[part] = Array.from(frame[part], resolve);
    if (typeof layer._MdxDefaults?.[field] === 'number') layer._MdxDefaults[field] = resolve(layer._MdxDefaults[field]);
  }
  return key(result, omit);
}
function tint(model, id) {
  const anim = animsFor(model, id)[0];
  return anim?.Flags & 2 ? { enabled: true, Color: clone(anim.Color), base: clone(anim._MdxDefaults?.Color) } : { enabled: false };
}
function materialColors(value, path = '', output = {}) {
  if (!value || typeof value !== 'object') return output;
  for (const [name, item] of Object.entries(value)) {
    if (colors.has(name)) output[path + name] = item;
    else if (item && typeof item === 'object' && !ArrayBuffer.isView(item)) materialColors(item, path + name + '.', output);
  }
  return output;
}
function materialColorProfile(model, materialId) {
  const material = model.Materials[materialId], profile = materialColors(material);
  material.Layers.forEach((layer, i) => { if (typeof layer.TextureID === 'number') { const color = fixedTint(model.Textures[layer.TextureID]); if (color) profile[`Layers.${i}.TextureID`] = color; } });
  return profile;
}
function colorSamples(value, frames, model) {
  if (!value?.Keys) return frames.flatMap(() => Array.from(value || [1, 1, 1]));
  return frames.flatMap(frame => {
    const sequence = model.Sequences?.find(s => frame >= s.Interval[0] && frame <= s.Interval[1]);
    return sampleTrack(value, frame, { interval: sequence?.Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: [1, 1, 1] });
  });
}
function closestProfile(model, entries) {
  const profiles = entries.map(entry => ({ ...materialColorProfile(model, entry.materialId), geoset: entry.tint.enabled ? entry.tint.Color || entry.tint.base : [1, 1, 1] }));
  const names = [...new Set(profiles.flatMap(profile => Object.keys(profile)))].sort();
  const times = new Set([0, ...(model.Sequences || []).flatMap(s => Array.from(s.Interval)), ...profiles.flatMap(profile => Object.values(profile).flatMap(value => value?.Keys?.map(k => k.Frame) || []))]);
  const ordered = [...times].sort((a, b) => a - b), frames = [...ordered, ...ordered.slice(1).map((v, i) => (v + ordered[i]) / 2)];
  const samples = profiles.map(profile => names.flatMap(name => colorSamples(profile[name], frames, model)));
  const average = samples[0].map((_, j) => samples.reduce((sum, sample) => sum + sample[j], 0) / samples.length);
  let best = 0, bestDistance = Infinity;
  samples.forEach((sample, i) => {
    const distance = sample.reduce((d, value, j) => d + (value - average[j]) ** 2, 0);
    if (distance < bestDistance) { best = i; bestDistance = distance; }
  });
  return entries[best];
}
const filterNames = ['Opaque', 'Transparent', 'Blend', 'Additive', 'Add Alpha', 'Modulate', 'Modulate 2X'];
function filterLabel(material) {
  return [...new Set(material.Layers.map(layer => filterNames[layer.FilterMode] || `Filter ${layer.FilterMode}`))].join(' + ');
}
function teamLayer(model, layer) {
  return typeof layer.TextureID === 'number' && model.Textures[layer.TextureID]?.ReplaceableId === 1;
}
function withoutTeam(model, material) {
  const copy = clone(material), team = copy.Layers.filter(layer => teamLayer(model, layer));
  // Removing an animated/partly transparent TC pass would change visibility.
  if (team.some(layer => layer.Alpha != null && layer.Alpha !== 1 || layer._MdxDefaults?.Alpha != null && layer._MdxDefaults.Alpha !== 1)) return null;
  copy.Layers = copy.Layers.filter(layer => !teamLayer(model, layer));
  if (!copy.Layers.length) return null;
  for (const layer of copy.Layers) if ([0, 1, 2].includes(layer.FilterMode)) {
    layer.FilterMode = 0;
    if (layer._MdxDefaults && 'FilterMode' in layer._MdxDefaults) layer._MdxDefaults.FilterMode = 0;
  }
  return copy;
}
function proposal(kind, entries, model, options) {
  const materialIds = [...new Set(entries.map(entry => entry.materialId))];
  const geosetIds = kind === 'rgb' ? entries.map(entry => entry.geosetId) : model.Geosets.flatMap((g, i) => materialIds.includes(g.MaterialID) ? [i] : []);
  const signature = key({ kind, geosetIds, materials: materialIds.map(id => resolved(model, model.Materials[id])), tints: kind === 'rgb' ? entries.map(entry => entry.tint) : [] });
  return { kind, id: signature, entries, materialIds, geosetIds, options };
}
/** Alpha tracks are part of every family key and are never proposed for merging. */
export function sortMyMessProposals(model) {
  const proposals = [], rgbFamilies = new Map(), teamFamilies = new Map(), renderFamilies = new Map();
  const add = (map, signature, entry) => { if (!map.has(signature)) map.set(signature, []); map.get(signature).push(entry); };
  model.Geosets.forEach((geoset, id) => {
    if (animsFor(model, id).length > 1 || !model.Materials[geoset.MaterialID]) return;
    const material = model.Materials[geoset.MaterialID];
    add(rgbFamilies, resolved(model, material, colors, 'rgb') + '|' + materialVisibility(model, geoset.MaterialID) + '|' + visibility(model, id), { materialId: geoset.MaterialID, geosetId: id, tint: tint(model, id) });
  });
  for (const entries of rgbFamilies.values()) {
    const profiles = new Set(entries.map(entry => key({ colors: materialColorProfile(model, entry.materialId), tint: entry.tint })));
    if (profiles.size < 2) continue;
    const target = closestProfile(model, entries);
    proposals.push(proposal('rgb', entries, model, [{ id: 'closest', label: 'Choose most similar RGB', materialId: target.materialId, tint: target.tint }]));
  }
  model.Materials.forEach((material, materialId) => {
    const entries = model.Geosets.flatMap((g, i) => g.MaterialID === materialId ? [i] : []);
    if (!entries.length) return;
    const entry = { materialId }, alpha = materialVisibility(model, materialId);
    const base = withoutTeam(model, material);
    if (base) add(teamFamilies, resolved(model, base) + '|' + alpha, entry);
    if (material.Layers.some(layer => teamLayer(model, layer) || fixedTint(model.Textures[layer.TextureID]))) add(teamFamilies, 'tint:' + resolved(model, material, undefined, 'team') + '|' + alpha, entry);
    add(renderFamilies, resolved(model, material, renderFields) + '|' + alpha, entry);
  });
  for (const entries of teamFamilies.values()) {
    const withTeam = entries.find(e => model.Materials[e.materialId].Layers.some(layer => teamLayer(model, layer)));
    const noTeam = entries.find(e => !model.Materials[e.materialId].Layers.some(layer => teamLayer(model, layer)));
    if (!withTeam || !noTeam) continue;
    proposals.push(proposal('team', entries, model, [{ id: 'add', label: 'Add team color', materialId: withTeam.materialId }, { id: 'remove', label: 'Remove team color', materialId: noTeam.materialId }]));
  }
  for (const entries of renderFamilies.values()) {
    const variants = [...new Map(entries.map(e => [resolved(model, model.Materials[e.materialId]), e])).values()];
    if (variants.length < 2) continue;
    proposals.push(proposal('render', entries, model, variants.map(e => ({ id: String(e.materialId), label: `Use ${filterLabel(model.Materials[e.materialId])} · material ${e.materialId + 1}`, materialId: e.materialId }))));
  }
  return proposals;
}
function writeTint(model, id, profile) {
  let anim = animsFor(model, id)[0];
  if (!anim) { if (!profile.enabled && profile.Color == null && profile.base == null) return; anim = createVisibilityGeosetAnimation(id); model.GeosetAnims.push(anim); }
  anim.Flags = ((anim.Flags || 0) & ~2) | (profile.enabled ? 2 : 0);
  if (!profile.enabled) return; // Disabled authored colour data can remain dormant.
  if (profile.Color === undefined) delete anim.Color; else anim.Color = clone(profile.Color);
  if (anim._MdxDefaults) { delete anim._MdxDefaults.Color; if (!Object.keys(anim._MdxDefaults).length) delete anim._MdxDefaults; }
  if (profile.base !== undefined) (anim._MdxDefaults ||= {}).Color = clone(profile.base);
}
export function applySortMyMessProposal(model, proposal, optionId) {
  const current = sortMyMessProposals(model).find(item => item.id === proposal.id);
  if (!current) throw Error('The material choice changed. Reopen Sort My Mess.');
  const option = current.options.find(item => item.id === optionId);
  if (!option) throw Error('Choose a material result.');
  if (current.kind === 'rgb') {
    for (const id of current.geosetIds) { model.Geosets[id].MaterialID = option.materialId; writeTint(model, id, option.tint); }
  } else {
    for (const consumer of [...model.Geosets, ...(model.RibbonEmitters || [])]) if (current.materialIds.includes(consumer.MaterialID)) consumer.MaterialID = option.materialId;
  }
  const used = new Set([...model.Geosets, ...(model.RibbonEmitters || [])].map(consumer => consumer.MaterialID));
  const indices = new Map();
  model.Materials = model.Materials.filter((material, id) => {
    if (current.materialIds.includes(id) && !used.has(id)) return false;
    indices.set(id, indices.size); return true;
  });
  for (const consumer of [...model.Geosets, ...(model.RibbonEmitters || [])]) if (indices.has(consumer.MaterialID)) consumer.MaterialID = indices.get(consumer.MaterialID);
  if (model.Info) model.Info.NumGeosetAnims = model.GeosetAnims.length;
  return condenseExactResources(model);
}

/** Commit only this command's owned resources and reference fields. Geometry,
 * node identity/aliases and emitter configuration stay in the live document. */
export function commitSortMyMessModel(model, draft) {
  const copy = clone(draft);
  for (const section of ['Materials', 'Textures', 'GeosetAnims']) model[section] = copy[section];
  model.Geosets.forEach((geoset, i) => { geoset.MaterialID = copy.Geosets[i].MaterialID; });
  (model.RibbonEmitters || []).forEach((ribbon, i) => { ribbon.MaterialID = copy.RibbonEmitters[i].MaterialID; });
  (model.ParticleEmitters2 || []).forEach((emitter, i) => {
    if ('TextureID' in copy.ParticleEmitters2[i]) emitter.TextureID = copy.ParticleEmitters2[i].TextureID;
    if (copy.ParticleEmitters2[i]._MdxDefaults?.TextureID !== undefined) (emitter._MdxDefaults ||= {}).TextureID = copy.ParticleEmitters2[i]._MdxDefaults.TextureID;
  });
}
