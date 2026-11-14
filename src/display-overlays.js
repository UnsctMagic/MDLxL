import { migrateObjectDisplay } from './object-kinds.js';

// The object switches (Bones … Collision) are listed in object-kinds.js.
export function defaultEditorDisplay(vanilla = false) {
  const view = { shaded: true, vertices: true, wires: false, normals: false, grid: false, cameras: false };
  const rig = { bones: false, helpers: false, boneTypesBones: true, boneTypesHelpers: true, skeleton: false, focusedSkeleton: false };
  const base = { ...view, ...rig, attachments: false, particles: false, events: false, sounds: false, lights: false, collision: false };
  return {
    // Vertex shows the mesh; Bones is its only object switch.
    vertices: { ...view, ...rig, ...(vanilla && { bones: true, helpers: true }) },
    // Bones is one shared switch across the rig editors (see shareBones).
    bones: { ...base, bones: true, helpers: true, ...(vanilla && { attachments: true }) },
    movement: { ...base, bones: true, helpers: true, focusedSkeleton: true, ...(vanilla ? { attachments: true } : { particles: true }) },
    // Animations is a model preview: its switches hide the real effects, not symbols.
    animations: { ...view, shaded: false, vertices: false, particles: true, events: true, sounds: true },
    uv: { ...base, grid: true },
    paint: { ...base, shaded: false, vertices: false },
  };
}

// Rig marker choices follow the user between Bones and Movement.
const RIG_EDITORS = ['bones', 'movement'];
function shareBones(overlays, mode, key = 'bones') {
  if (!RIG_EDITORS.includes(mode)) return overlays;
  const enabled = !!overlays[mode]?.[key];
  return { ...overlays, ...Object.fromEntries(RIG_EDITORS.filter(editor => editor !== mode && overlays[editor])
    .map(editor => [editor, { ...overlays[editor], [key]: enabled }])) };
}

export function setEditorDisplay(overlays, mode, key, value) {
  const current = overlays?.[mode] || {};
  const resolved = typeof value === 'function' ? value(current[key] ?? key.startsWith('boneTypes')) : value;
  const next = { ...current, [key]: !!resolved };
  if (key === 'bones') next.helpers = !!resolved;
  if (resolved && key === 'skeleton') next.focusedSkeleton = false;
  if (resolved && key === 'focusedSkeleton') next.skeleton = false;
  const result = { ...overlays, [mode]: next };
  if (key === 'bones') return shareBones(shareBones(result, mode, key), mode, 'helpers');
  return ['helpers', 'attachments', 'boneTypesBones', 'boneTypesHelpers'].includes(key) ? shareBones(result, mode, key) : result;
}

// Clear the active editor's visible options without changing the model or selection.
export function clearQuickDisplay(overlays, mode) {
  return shareBones(shareBones({ ...overlays, [mode]: Object.fromEntries(Object.keys(overlays[mode] || {}).map(key => [key, key.startsWith('boneTypes') ? overlays[mode][key] : false])) }, mode), mode, 'helpers');
}

// POSE starts clean, then keeps the user's own display choices separately.
// Type filters remain available in the Bones context menu.
export function defaultPoseDisplay(overlays) {
  const { helpers: _helpers, nodes: _nodes, ...display } = overlays || {};
  return { ...display, vertices: false, bones: false, skeleton: false, focusedSkeleton: true,
    attachments: false, particles: false, sounds: false, events: false, lights: false, collision: false,
    wires: false, normals: false, cameras: false };
}

const EDITOR_DISPLAY_KEY = 'mdlxl-editor-display';

/** The defaults, overlaid with the switches the user last chose (same keys only). */
export function storedEditorDisplay(vanilla = false, storage = globalThis.localStorage) {
  const defaults = defaultEditorDisplay(vanilla);
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(EDITOR_DISPLAY_KEY) || 'null')?.[vanilla ? 'vis' : 'xl']; } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([mode, display]) => {
    // Before the switch list was shared, ViS Animations used Emitters for a
    // symbol only; its real effects always played, so they start shown.
    const before = saved[mode], legacy = typeof before?.nodes === 'boolean';
    const chosen = legacy && vanilla && mode === 'animations' ? { ...before, particles: undefined, events: undefined, sounds: undefined } : migrateObjectDisplay(before, vanilla) || {};
    return [mode, Object.fromEntries(Object.entries(display)
      .map(([key, value]) => [key, key === 'helpers' ? (chosen.bones ?? display.bones) : typeof chosen[key] === 'boolean' ? chosen[key] : value]))];
  }));
}

export function saveEditorDisplay(xl, vis, storage = globalThis.localStorage) {
  try { storage?.setItem(EDITOR_DISPLAY_KEY, JSON.stringify({ xl, vis })); } catch { /* Private or full storage keeps this session's choices only. */ }
}

/** F: Textured View, or back to the view the user last chose in this editor. */
export const textureToggleTarget = (current, lastUntextured, fallback = 'wireframe') => current === 'textured' ? lastUntextured || fallback : 'textured';

/** Shared display/picking filter; helpers retain their real hierarchy identity. */
export function rigTypeVisible(point, options) {
  return point.helperNode ? options.boneTypesHelpers !== false : point.overlayKind !== 'bones' || options.boneTypesBones !== false;
}
