export const EDITOR_DISPLAY_MODES = Object.freeze(['vertices', 'bones', 'movement', 'animations']);

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

export function setEditorDisplay(overlays, mode, key, value) {
  const current = overlays?.[mode] || {};
  const resolved = typeof value === 'function' ? value(current[key]) : value;
  const next = { ...current, [key]: !!resolved };
  if (resolved && key === 'skeleton') next.focusedSkeleton = false;
  if (resolved && key === 'focusedSkeleton') next.skeleton = false;
  return { ...overlays, [mode]: next };
}

// Clear the active editor's visible options without changing the model or selection.
export function clearQuickDisplay(overlays, mode) {
  return { ...overlays, [mode]: Object.fromEntries(Object.keys(overlays[mode] || {}).map(key => [key, false])) };
}
