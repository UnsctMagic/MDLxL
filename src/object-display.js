// MDLxL look (XL) only: the Objects switch and its kinds. The VIS look keeps
// main's per-kind switches and its own view menu (src/view-menu.json).

/** Right-click Objects menu rows: label, stored display key, marker kinds it shows. */
export const OBJECT_TYPES = Object.freeze([
  ['Attachments', 'objectTypesAttachments', ['attachments']],
  ['Emitters', 'objectTypesEmitters', ['particles', 'ribbons']],
  ['Events', 'objectTypesEvents', ['events']],
  ['Sounds', 'objectTypesSounds', ['sounds']],
]);
export const OBJECT_TYPE_KEYS = Object.freeze(OBJECT_TYPES.map(([, key]) => key));

/**
 * What Movement (animated, not the Bones rest pose) may select AND move or
 * rotate. Every other shown kind is selectable only (to show its diamonds).
 * Narrow or widen it here; nothing else hard-codes the list.
 * Sounds are timed by their event frames only, so they never move here.
 */
export const MOVEMENT_EDITABLE_KINDS = Object.freeze(['bones', 'attachments', 'particles', 'ribbons', 'events', 'lights']);
export const movementKindEditable = kind => MOVEMENT_EDITABLE_KINDS.includes(kind);

/** XL marker kind of every object: bones (and helpers), attachments, particles, ribbons, events, sounds, lights.
 * Collision shapes (and cameras) get no kind, so the XL rig editors never draw them. */
export function xlObjectKinds(model) {
  const kinds = new Map();
  for (const node of model.Bones || []) kinds.set(node.ObjectId, 'bones');
  for (const node of model.Helpers || []) kinds.set(node.ObjectId, 'bones');
  for (const node of model.Attachments || []) kinds.set(node.ObjectId, 'attachments');
  for (const collection of ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns']) for (const node of model[collection] || []) kinds.set(node.ObjectId, 'particles');
  for (const node of model.RibbonEmitters || []) kinds.set(node.ObjectId, 'ribbons');
  // Sounds are SND; every other event (blood, footprints, splats and odd ones) is an event.
  for (const node of model.EventObjects || []) kinds.set(node.ObjectId, node.Name?.slice(0, 3).toUpperCase() === 'SND' ? 'sounds' : 'events');
  for (const node of model.Lights || []) kinds.set(node.ObjectId, 'lights');
  return kinds;
}

/** The marker kinds an XL rig display shows, or null for a display without the Objects switch. */
export function objectSwitches(overlays) {
  if (!overlays || overlays.objects === undefined) return null;
  const on = key => !!overlays.objects && overlays[key] !== false;
  return {
    attachments: on('objectTypesAttachments'), particles: on('objectTypesEmitters'), ribbons: on('objectTypesEmitters'),
    events: on('objectTypesEvents'), sounds: on('objectTypesSounds'), lights: !!overlays.lights,
  };
}

/** Saved XL display from before the Objects switch: nodes → Lights; the old kind switches become the Objects checkboxes. */
const OLD_KINDS = [['attachments', 'objectTypesAttachments'], ['particles', 'objectTypesEmitters'], ['events', 'objectTypesEvents'], ['sounds', 'objectTypesSounds']];
export function migrateXLDisplay(saved) {
  if (!saved || typeof saved !== 'object') return saved;
  const result = { ...saved };
  for (const mode of ['vertices', 'bones', 'movement']) {
    const old = saved[mode];
    if (mode === 'vertices' && old && typeof old === 'object') {
      // XL Vertices draws no objects any more: drop saved Objects, Lights and their ticks.
      const { objects: _o, lights: _l, nodes: _n, attachments: _a, particles: _p, sounds: _s, events: _e, objectTypesAttachments: _t1, objectTypesEmitters: _t2, objectTypesEvents: _t3, objectTypesSounds: _t4, ...rest } = old;
      result[mode] = { ...rest, bones: false, helpers: false, skeleton: false };
      continue;
    }
    if (!old || typeof old !== 'object' || old.objects !== undefined) continue;
    const next = { ...old };
    if (typeof old.nodes === 'boolean') next.lights = old.nodes;
    const shown = OLD_KINDS.filter(([key]) => old[key] === true);
    if (OLD_KINDS.some(([key]) => typeof old[key] === 'boolean')) {
      next.objects = shown.length > 0;
      // Ticking Objects again must show something: keep every type when none was on.
      if (shown.length) for (const [key, type] of OLD_KINDS) next[type] = old[key] === true;
    }
    // XL Vertices has no Bones switch any more; a saved Bones tick would be stuck on.
    if (mode === 'vertices') { next.bones = false; next.helpers = false; next.skeleton = false; }
    result[mode] = next;
  }
  return result;
}
