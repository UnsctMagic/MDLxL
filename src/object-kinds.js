// One list of object kinds for every editor: the show switches, their order,
// their names and which model collections each one covers. XL and ViS share it.
export const OBJECT_KINDS = Object.freeze([
  { key: 'bones', label: 'Bones', tip: 'Show bones and helpers. Right-click to choose Helpers or Bones.', collections: ['Bones', 'Helpers'] },
  { key: 'attachments', label: 'Attachments', tip: 'Show attachment points', collections: ['Attachments'] },
  { key: 'particles', label: 'Emitters', tip: 'Show particle emitters and ribbons', collections: ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'] },
  { key: 'events', label: 'Events', tip: 'Show blood, footprints and other events', collections: ['EventObjects'] },
  { key: 'sounds', label: 'Sounds', tip: 'Show sound events', collections: ['EventObjects'] },
  { key: 'lights', label: 'Lights', tip: 'Show lights', collections: ['Lights'] },
  { key: 'collision', label: 'Collision', tip: 'Show collision shapes', collections: ['CollisionShapes'] },
].map(Object.freeze));

export const OBJECT_KIND_KEYS = Object.freeze(OBJECT_KINDS.map(kind => kind.key));

// Animations draws no symbols: its switches hide the real particles, events and sounds.
export const EDITOR_KINDS = Object.freeze({
  vertices: Object.freeze(['bones']),
  bones: OBJECT_KIND_KEYS,
  movement: OBJECT_KIND_KEYS,
  animations: Object.freeze([]),
});
export const ANIMATION_EFFECT_KINDS = Object.freeze(['particles', 'events', 'sounds']);

const eventType = node => String(node?.Name || '').slice(0, 3).toUpperCase();

/** ObjectId → kind key. Every node of the model gets exactly one kind. */
export function objectKind(model) {
  const kinds = new Map();
  for (const { key, collections } of OBJECT_KINDS) {
    if (key === 'events' || key === 'sounds') continue;
    for (const collection of collections) for (const node of model?.[collection] || []) kinds.set(node.ObjectId, key);
  }
  for (const node of model?.EventObjects || []) kinds.set(node.ObjectId, eventType(node) === 'SND' ? 'sounds' : 'events');
  return kinds;
}

const EVENT_SYMBOLS = Object.freeze({ SPL: 'blood', FPT: 'foot', UBR: 'uber' });

/** ObjectId → marker symbol, where it differs from the kind (ribbons share the Emitters switch). */
export function objectSymbol(model) {
  const symbols = new Map();
  for (const node of model?.RibbonEmitters || []) symbols.set(node.ObjectId, 'ribbons');
  for (const node of model?.EventObjects || []) { const symbol = EVENT_SYMBOLS[eventType(node)]; if (symbol) symbols.set(node.ObjectId, symbol); }
  return symbols;
}

/** The kind switches for one viewport. `markers` fills switches the caller did
 * not set; an editor shows only the kinds it owns. */
export function objectOverlayOptions(overlays, { editor, markers = false } = {}) {
  const allowed = EDITOR_KINDS[editor], fallback = !!markers;
  const options = {};
  for (const key of OBJECT_KIND_KEYS) options[key] = (!allowed || allowed.includes(key)) && !!(overlays?.[key] ?? fallback);
  options.helpers = (!allowed || allowed.includes('bones')) && !!(overlays?.helpers ?? overlays?.bones ?? fallback);
  return options;
}

/** Saved display switches from before Lights and Collision existed: `nodes`
 * covered lights and collision, and in ViS every event as well. */
export function migrateObjectDisplay(saved, vanilla = false) {
  if (!saved || typeof saved.nodes !== 'boolean') return saved;
  const { nodes, ...rest } = saved;
  return { ...rest, lights: rest.lights ?? nodes, collision: rest.collision ?? nodes,
    ...(vanilla && { events: rest.events ?? nodes, sounds: rest.sounds ?? nodes }) };
}
