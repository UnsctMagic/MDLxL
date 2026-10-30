/** Forge items start without a material or texture. Previews show them in
 * clay colours until the user assigns a material; nothing here is written to
 * the model, and saving waits until every Forge item has a material and texture.
 */
export const FORGE_ITEM_KEY = '_ForgeItem';
export const NO_MATERIAL = -1;
// Earthy, clearly distinct clay tones, so neighbouring items can be told apart.
export const CLAY_COLORS = [0xb7876a, 0x8f9a7a, 0xa98bb0, 0xc9a66b, 0x7f99ad, 0xb57a7a];

const textureIds = value => typeof value === 'number' ? [value] : Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value) : (value?.Keys || []).flatMap(key => Array.from(key.Vector || []));
export const hasMaterial = (model, geoset) => !!model?.Materials?.[geoset?.MaterialID]?.Layers?.length;
/** A material whose layers show at least one texture of the model. */
export function hasMaterialAndTexture(model, geoset) {
  if (!hasMaterial(model, geoset)) return false;
  return model.Materials[geoset.MaterialID].Layers.some(layer => textureIds(layer.TextureID).some(id => !!model.Textures?.[Math.round(id)]));
}

/** Geoset index → clay colour for every geoset without a material. */
export function clayColors(model) {
  const colors = new Map();
  for (const [index, geoset] of (model?.Geosets || []).entries()) if (!hasMaterial(model, geoset)) colors.set(index, CLAY_COLORS[colors.size % CLAY_COLORS.length]);
  return colors;
}

export function unfinishedForgeItems(model) {
  return (model?.Geosets || []).flatMap((geoset, index) => geoset?.[FORGE_ITEM_KEY] && !hasMaterialAndTexture(model, geoset) ? [{ index, name: String(geoset[FORGE_ITEM_KEY]) }] : []);
}

/** Plain-language reason saving must wait, or '' when nothing blocks it. */
export function forgeSaveBlock(model) {
  const items = unfinishedForgeItems(model);
  if (!items.length) return '';
  const names = items.map(item => `${item.name} (geoset ${item.index + 1})`).join(', ');
  return `Give ${items.length === 1 ? 'this Forge item' : 'these Forge items'} a material and texture before saving: ${names}.`;
}

const CLAY_FOLDER = 'MDLxL_Clay\\';
const HD_CLAY_MAPS = { normal: [128, 128, 255], orm: [255, 230, 0], emissive: [0, 0, 0] };
const rgb = color => [color >> 16 & 255, color >> 8 & 255, color & 255];

/** For a renderer's private clone only: give each clay geoset a one-colour
 * material. Returns texture path → RGB for the renderer to fill in. */
export function addClayPreviewMaterials(model) {
  const pixels = new Map(), colors = clayColors(model);
  if (!colors.size) return pixels;
  model.Textures ||= []; model.Materials ||= [];
  const texture = (name, color) => { const Image = CLAY_FOLDER + name; if (!pixels.has(Image)) { pixels.set(Image, color); model.Textures.push({ Image, ReplaceableId: 0, Flags: 0 }); } return model.Textures.findIndex(t => t.Image === Image); };
  const hd = (model.Geosets || []).some(g => g.SkinWeights?.length);
  const layer = id => ({ FilterMode: 0, Shading: 0, TextureID: id, TVertexAnimId: null, CoordId: 0, Alpha: 1 });
  for (const [index, color] of colors) {
    const diffuse = texture(color.toString(16).padStart(6, '0'), rgb(color));
    const Layers = hd ? [layer(diffuse), ...Object.entries(HD_CLAY_MAPS).map(([name, value]) => layer(texture(name, value)))] : [layer(diffuse)];
    model.Geosets[index].MaterialID = model.Materials.push({ PriorityPlane: 0, RenderMode: 0, ...(hd ? { Shader: 'Shader_HD_DefaultUnit' } : {}), Layers }) - 1;
  }
  return pixels;
}
