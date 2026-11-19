// The Forge tools of the Vertex editor (Extrude, Inset, Cut, Bend, Bulge, Taper, Bevel, Twist
// and Add shape) as one call each, for scripts. They run the window's own steps
// (app/ForgeVertexTools.jsx) on the same model code; nothing here is a second implementation.
import { forgeMoldState, prepareForgeMold, previewForgeMold } from './forge-molding.js';
import { forgeSelectionNormal, extrudeForgeFaces, insetForgeFaces, forgeCutFrame, cutForgeShape } from './forge-shape-editing.js';
import { vertexForgeDraft, vertexForgeFaces, vertexForgeResult, appendVertexForgeShape } from './forge-vertex.js';
import { buildForgePrimitive, PRIMITIVE_DEFAULTS } from './forge-primitives.js';

export const FORGE_VERTEX_TOOLS = Object.freeze(['Extrude', 'Inset', 'Cut', 'Bend', 'Bulge', 'Taper', 'Bevel', 'Twist']);
const FACE_TOOLS = ['Extrude', 'Inset', 'Cut'];

/**
 * One Forge vertex tool on the marked vertices (`selection`: vertex IDs per geoset index), as the
 * window's Apply does. Changes `model` in place (only the geosets the tool changed are replaced)
 * and returns { selection } to show afterwards. Run inside one Undo step ('Geosets' scope).
 * Options by tool: Extrude `distance` along the faces' normal; Inset `amount`; Cut `sections` (2-64)
 * and `turned`; Bend/Bulge/Taper/Twist/Bevel `amount` (degrees for Bend and Twist, a fraction for
 * Bulge and Taper, units for Bevel) plus optional `center`, `width`, `axis`, `direction`, `round`.
 * The marked vertices must contain complete faces for Extrude, Inset and Cut.
 */
export function runForgeVertexTool(model, selection, tool, options = {}) {
  if (!FORGE_VERTEX_TOOLS.includes(tool)) throw Error('Unknown Forge tool: ' + tool + '. Use one of ' + FORGE_VERTEX_TOOLS.join(', ') + '.');
  const before = FACE_TOOLS.includes(tool) ? vertexForgeFaces(vertexForgeDraft(model, selection)) : vertexForgeDraft(model, selection);
  if (FACE_TOOLS.includes(tool) && !Object.values(before.selection).some(ids => ids.length)) throw Error('Select a complete face to use ' + tool + '.');
  let after = before;
  if (tool === 'Inset') after = { ...before, shapes: before.shapes.map(shape => before.selection[shape.id].length ? insetForgeFaces(shape, before.selection[shape.id], Math.abs(options.amount ?? 0)) : shape) };
  else if (tool === 'Cut') {
    const sections = Number(options.sections ?? 2);
    if (!Number.isInteger(sections) || sections < 2 || sections > 64) throw Error('Choose between 2 and 64 sections.');
    after = { ...before, shapes: before.shapes.map(shape => {
      const ids = before.selection[shape.id];
      if (!ids.length) return shape;
      const frame = forgeCutFrame(shape, ids[0], !!options.turned, ids);
      return cutForgeShape(shape, frame, Array.from({ length: sections - 1 }, (_, i) => (i + 1) / sections), ids);
    }) };
  } else if (tool === 'Extrude') {
    const distance = options.distance ?? 0;
    if (distance) after = { ...before, shapes: before.shapes.map(shape => before.selection[shape.id].length ? extrudeForgeFaces(shape, before.selection[shape.id], forgeSelectionNormal([shape], before.selection).map(n => n * distance)) : shape) };
  } else {
    const state = { ...forgeMoldState(before, tool), ...Object.fromEntries(['center', 'width', 'amount', 'axis', 'direction', 'round'].filter(key => options[key] !== undefined).map(key => [key, options[key]])) };
    after = previewForgeMold(before, prepareForgeMold(before, state), state);
  }
  const result = vertexForgeResult(model, before, after);
  for (let i = 0; i < result.Geosets.length; i++) if (result.Geosets[i] !== model.Geosets[i]) model.Geosets[i] = result.Geosets[i];
  return { selection: result.forgeSelection };
}

/**
 * Forge "Add shape" into geoset `geosetIndex`: `settings` as the window's palette
 * ({ shape, width, height, depth, complexity, ... }; shapes in FORGE_SHAPES), placed at `center`
 * and taking the nearest of `selected` vertices' material and bindings. Returns { selection }.
 */
export function addForgeVertexShape(model, geosetIndex, settings = {}, selected = [], center = [0, 0, 0]) {
  return appendVertexForgeShape(model, geosetIndex, selected, buildForgePrimitive({ ...PRIMITIVE_DEFAULTS, ...settings, zUp: true }), center);
}
