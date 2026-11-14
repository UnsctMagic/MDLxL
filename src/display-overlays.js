import { OBJECT_TYPE_KEYS, migrateXLDisplay } from './object-display.js';

export function defaultEditorDisplay(vanilla = false) {
  const base = { shaded: true, vertices: true, bones: false, helpers: false, boneTypesBones: true, boneTypesHelpers: true, skeleton: false, focusedSkeleton: false, nodes: false, attachments: false, particles: false, ...(!vanilla && {sounds:false,events:false}), wires: false, normals: false, grid: false, cameras: false };
  if (!vanilla) return defaultXLDisplay(base);
  return {
    vertices: { ...base, ...(vanilla && { bones: true, helpers: true, attachments: true }) },
    // Bones is one shared switch across the rig editors (see shareBones).
    bones: { ...base, bones: true, helpers: true, ...(vanilla && { helpers: true, attachments: true }) },
    movement: { ...base, bones: true, helpers: true, focusedSkeleton: true, ...(vanilla && { helpers: true, attachments: true }), ...(!vanilla && {particles:true}) },
    animations: { ...base, bones: true, helpers: true, shaded: false, vertices: false, ...(vanilla && { helpers: true, attachments: true }), ...(!vanilla && {particles:true,sounds:true,events:true}) },
    uv: { ...base, grid: true },
    paint: { ...base, shaded: false, vertices: false },
  };
}

// MDLxL look: Objects (attachments, emitters, events, sounds; right-click picks
// which) and Lights replace the old per-kind switches in Vertices, Bones and
// Movement. Animations draws no symbols; its switches hide the real effects.
const OBJECT_TYPE_DEFAULTS = Object.fromEntries(OBJECT_TYPE_KEYS.map(key => [key, true]));
function defaultXLDisplay(base) {
  const { nodes: _nodes, attachments: _attachments, particles: _particles, sounds: _sounds, events: _events, ...rest } = base;
  const rig = { ...rest, objects: true, lights: false, ...OBJECT_TYPE_DEFAULTS };
  return {
    vertices: { ...rest, objects: false, ...OBJECT_TYPE_DEFAULTS },
    // Bones is one shared switch across the rig editors (see shareBones); Objects
    // and its types are shared between Bones and Movement the same way.
    bones: { ...rig, bones: true, helpers: true },
    movement: { ...rig, bones: true, helpers: true, focusedSkeleton: true },
    animations: { ...rest, bones: true, helpers: true, shaded: false, vertices: false, rgb: true, lights: true, particles: true, sounds: true, events: true },
    uv: { ...base, grid: true },
    paint: { ...base, shaded: false, vertices: false },
  };
}

// Rig marker choices follow the user between Bones, Movement and Animations.
const RIG_EDITORS = ['bones', 'movement', 'animations'];
const OBJECT_EDITORS = ['bones', 'movement'];
function shareBones(overlays, mode, key = 'bones', editors = RIG_EDITORS) {
  if (!editors.includes(mode)) return overlays;
  const enabled = !!overlays[mode]?.[key];
  return { ...overlays, ...Object.fromEntries(editors.filter(editor => editor !== mode && overlays[editor])
    .map(editor => [editor, { ...overlays[editor], [key]: enabled }])) };
}
const OBJECT_SHARED = ['objects', 'lights', ...OBJECT_TYPE_KEYS];
const shareObjects = (overlays, mode, keys = OBJECT_SHARED) => keys.reduce((result, key) => result[mode]?.[key] === undefined ? result : shareBones(result, mode, key, OBJECT_EDITORS), overlays);
const keepsOnClear = key => key.startsWith('boneTypes') || key.startsWith('objectTypes');

export function setEditorDisplay(overlays, mode, key, value) {
  const current = overlays?.[mode] || {};
  const resolved = typeof value === 'function' ? value(current[key] ?? keepsOnClear(key)) : value;
  const next = { ...current, [key]: !!resolved };
  if (key === 'bones') next.helpers = !!resolved;
  if (resolved && key === 'skeleton') next.focusedSkeleton = false;
  if (resolved && key === 'focusedSkeleton') next.skeleton = false;
  const result = { ...overlays, [mode]: next };
  if (key === 'bones') return shareBones(shareBones(result, mode, key), mode, 'helpers');
  if (OBJECT_SHARED.includes(key)) return shareObjects(result, mode, [key]);
  return ['helpers', 'attachments', 'boneTypesBones', 'boneTypesHelpers'].includes(key) ? shareBones(result, mode, key) : result;
}

// Clear the active editor's visible options without changing the model or selection.
export function clearQuickDisplay(overlays, mode) {
  return shareObjects(shareBones(shareBones({ ...overlays, [mode]: Object.fromEntries(Object.keys(overlays[mode] || {}).map(key => [key, keepsOnClear(key) ? overlays[mode][key] : false])) }, mode), mode, 'helpers'), mode, ['objects', 'lights']);
}

// POSE starts clean, then keeps the user's own display choices separately.
// Type filters remain available in the Bones context menu.
export function defaultPoseDisplay(overlays) {
  const { helpers: _helpers, ...display } = overlays || {};
  return { ...display, vertices: false, bones: false, skeleton: false, focusedSkeleton: true,
    nodes: false, attachments: false, particles: false, sounds: false, events: false,
    wires: false, normals: false, cameras: false, ...('objects' in display && { objects: false, lights: false }) };
}

const EDITOR_DISPLAY_KEY = 'mdlxl-editor-display';

/** The defaults, overlaid with the switches the user last chose (same keys only). */
export function storedEditorDisplay(vanilla = false, storage = globalThis.localStorage) {
  const defaults = defaultEditorDisplay(vanilla);
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(EDITOR_DISPLAY_KEY) || 'null')?.[vanilla ? 'vis' : 'xl']; if (!vanilla) saved = migrateXLDisplay(saved); } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([mode, display]) => [mode, Object.fromEntries(Object.entries(display)
    .map(([key, value]) => [key, key === 'helpers' ? (saved[mode]?.bones ?? display.bones) : typeof saved[mode]?.[key] === 'boolean' ? saved[mode][key] : value]))]));
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
