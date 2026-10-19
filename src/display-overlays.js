export function defaultEditorDisplay(vanilla = false) {
  const base = { shaded: true, vertices: true, bones: false, skeleton: false, focusedSkeleton: false, nodes: false, attachments: false, particles: false, ...(!vanilla && {sounds:false,events:false}), wires: false, normals: false, grid: false, cameras: false };
  return {
    vertices: { ...base },
    bones: { ...base },
    movement: { ...base, ...(!vanilla && {particles:true}) },
    animations: { ...base, shaded: false, vertices: false, ...(!vanilla && {particles:true,sounds:true,events:true}) },
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
