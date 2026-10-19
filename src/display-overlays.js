export function defaultEditorDisplay(vanilla = false) {
  const base = { shaded: true, vertices: true, bones: false, skeleton: false, focusedSkeleton: false, nodes: false, attachments: false, particles: false, ...(!vanilla && {sounds:false,events:false}), wires: false, normals: false, grid: false, cameras: false };
  return {
    vertices: { ...base },
    // Bones is one shared switch across the rig editors (see shareBones).
    bones: { ...base, bones: true },
    movement: { ...base, bones: true, focusedSkeleton: true, ...(!vanilla && {particles:true}) },
    animations: { ...base, bones: true, shaded: false, vertices: false, ...(!vanilla && {particles:true,sounds:true,events:true}) },
    uv: { ...base, grid: true },
    paint: { ...base, shaded: false, vertices: false },
  };
}

// Bones, Movement and Animations share one Bones switch, so bone markers stay
// on (or off) while the user moves between the rig editors.
const RIG_EDITORS = ['bones', 'movement', 'animations'];
function shareBones(overlays, mode) {
  if (!RIG_EDITORS.includes(mode)) return overlays;
  const bones = !!overlays[mode]?.bones;
  return { ...overlays, ...Object.fromEntries(RIG_EDITORS.filter(editor => editor !== mode && overlays[editor])
    .map(editor => [editor, { ...overlays[editor], bones }])) };
}

export function setEditorDisplay(overlays, mode, key, value) {
  const current = overlays?.[mode] || {};
  const resolved = typeof value === 'function' ? value(current[key]) : value;
  const next = { ...current, [key]: !!resolved };
  if (resolved && key === 'skeleton') next.focusedSkeleton = false;
  if (resolved && key === 'focusedSkeleton') next.skeleton = false;
  const result = { ...overlays, [mode]: next };
  return key === 'bones' ? shareBones(result, mode) : result;
}

// Clear the active editor's visible options without changing the model or selection.
export function clearQuickDisplay(overlays, mode) {
  return shareBones({ ...overlays, [mode]: Object.fromEntries(Object.keys(overlays[mode] || {}).map(key => [key, false])) }, mode);
}

// POSE starts clean, then keeps the user's own display choices separately.
export function defaultPoseDisplay(overlays) {
  return { ...overlays, vertices: false, bones: false, skeleton: false, focusedSkeleton: true,
    nodes: false, attachments: false, particles: false, sounds: false, events: false,
    wires: false, normals: false, cameras: false };
}

const EDITOR_DISPLAY_KEY = 'mdlxl-editor-display';

/** The defaults, overlaid with the switches the user last chose (same keys only). */
export function storedEditorDisplay(vanilla = false, storage = globalThis.localStorage) {
  const defaults = defaultEditorDisplay(vanilla);
  let saved = null;
  try { saved = JSON.parse(storage?.getItem(EDITOR_DISPLAY_KEY) || 'null')?.[vanilla ? 'vis' : 'xl']; } catch { saved = null; }
  if (!saved || typeof saved !== 'object') return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([mode, display]) => [mode, Object.fromEntries(Object.entries(display)
    .map(([key, value]) => [key, typeof saved[mode]?.[key] === 'boolean' ? saved[mode][key] : value]))]));
}

export function saveEditorDisplay(xl, vis, storage = globalThis.localStorage) {
  try { storage?.setItem(EDITOR_DISPLAY_KEY, JSON.stringify({ xl, vis })); } catch { /* Private or full storage keeps this session's choices only. */ }
}

/** F: Textured View, or back to the view the user last chose in this editor. */
export const textureToggleTarget = (current, lastUntextured, fallback = 'wireframe') => current === 'textured' ? lastUntextured || fallback : 'textured';
