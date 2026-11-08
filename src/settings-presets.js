/**
 * Named presets for one settings domain: built-ins, saved ones and shared files.
 * DOM-free. Domains are mouse, rotate, uv, hotkeys and appearance.
 *
 * Every state-changing export returns a plain change for Settings' commit(change).
 * Two extra properties are non-enumerable, so spreading the change into the
 * preferences never carries them: `status`, a short sentence for the status line,
 * and `presetId`, the preset that is now active. A failure throws a short sentence.
 *
 * This module and preferences.js import each other, so nothing here may touch a
 * preferences.js export while modules load; the domain table is built on first use.
 */
export { DEFAULT_SETTINGS_PRESETS } from './settings-presets-defaults.js';
import { APPLICATION_THEMES, CAMERA_PRESETS, DEFAULT_PREFERENCES, DEFAULT_VISUALS, effectiveBindings, formatChord, hotkeyConflicts, LIGHT_DARK_KEYS, normalizePreferences, uvTransformSensitivity } from './preferences.js';
import { HOTKEY_LEADER, migrateHotkeyBindings } from './hotkey-defaults.js';
import { viewportPresetChange } from './light-dark-switch.js';
import { modifierConflicts, normalizeModifiers } from './modifier-bindings.js';
import { DEFAULT_PAINT_APPEARANCE } from './paint-appearance.js';
import { DEFAULT_ROTATION_BEHAVIOR, normalizeRotationPreferences, ROTATION_PRESETS, rotationPresetId } from './rotation-drag.js';
import { normalizeUVDrag, UV_DRAG_PRESETS, uvDragPreset } from './uv-drag-settings.js';
import { APPEARANCE_LOOK_KEYS, APPEARANCE_SIZE_KEYS, BUILT_IN_VIEWPORT_PRESETS, DEFAULT_VIEWPORT_PRESET_ID, MAX_VIEWPORT_BACKGROUND_DATA_LENGTH, MAX_VIEWPORT_PRESETS, normalizeViewportPresets, viewportPresetById } from './viewport-appearance.js';

export const PRESET_SCHEMA = 'mdlxl-preset', PRESET_VERSION = 1, PRESET_EXTENSION = 'mdlxl-preset';
export const PRESET_DOMAINS = Object.freeze(['mouse', 'rotate', 'uv', 'hotkeys', 'appearance']);
/** What activePreset returns when the settings match no preset. */
export const CUSTOM_PRESET = 'custom';
/** Protects settings.json only; people are never told about a smaller limit. Appearance keeps its own 24. */
export const MAX_SAVED_PRESETS = 500;
/** The largest domain's limit. electron/main.cjs repeats this number as MAX_PRESET_FILE. */
export const MAX_PRESET_FILE_BYTES = 32 * 1024 * 1024;

const MAX_DEPTH = 8, MAX_NODES = 50_000, MAX_STRING = 4096, MAX_NAME = 80, MAX_APP = 32;
const MAX_HOTKEY_IDS = 5000; // electron/settings.cjs refuses a larger map, which would block every later save.
const SMALL_FILE = 64 * 1024, HOTKEY_FILE = 2 * 1024 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ENVELOPE_KEYS = ['schema', 'version', 'domain', 'name', 'app', 'values'];
const SAVED_ID = /^custom-[a-z0-9_-]{1,80}$/i;
const NAME_JUNK = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g;
const CONTROL_CHARACTER = /[\x00-\x1f]/;
const NOT_VALID = 'This preset file is not valid.', TOO_LARGE = 'This file is too large to be a preset.', TOO_COMPLEX = 'This preset file is too complex to load.';
const MOUSE_KEYS = ['cameraBindings', 'pointerSensitivity', 'scrollSensitivity', 'fineSensitivity', 'wheelMode', 'rightScrollAdjust'];
const DRAG_PRESET_NAMES = [['mdlxl', 'MDLxL'], ['mdlvis', 'MDLVis'], ['freeform', 'Freeform'], ['manipulator', 'Manipulator']];

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const record = value => isRecord(value) ? value : {};
const own = (object, key) => Object.hasOwn(object, key);
const pick = (object, keys) => Object.fromEntries(keys.filter(key => own(object, key)).map(key => [key, object[key]]));
function sortedCopy(value, sortLists) {
  if (Array.isArray(value)) { const items = value.map(item => sortedCopy(item, sortLists)); return sortLists ? items.sort() : items; }
  return isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortedCopy(value[key], sortLists)])) : value;
}
const canonical = (value, sortLists) => JSON.stringify(sortedCopy(value, !!sortLists));
const withStatus = (change, status, presetId) => Object.defineProperties(change, { status: { value: status }, presetId: { value: presetId } });
const invalidSetting = path => Error(`This preset has an invalid setting: ${path}.`);

/** Names are shown as plain text only; control and text-direction characters are removed. */
export function sanitizePresetName(value) { return typeof value === 'string' ? value.replace(NAME_JUNK, '').trim().slice(0, MAX_NAME).trim() : ''; }

// ---- What each domain's values are ----------------------------------------

function normalizeMouseValues(values) { return pick(normalizePreferences(pick(record(values), MOUSE_KEYS)), MOUSE_KEYS); }
function rotationValues(value) { const { eachPiece, ...values } = normalizeRotationPreferences(value); return values; }
function normalizeUVValues(values) { return { ...normalizeUVDrag(values), uvSensitivity: uvTransformSensitivity(values) }; }
/** preferences' own hotkey rule, plus the ids and chords the settings store would refuse. */
function normalizeHotkeyValues(values) {
  const input = record(values), hotkeys = {};
  const clean = Object.entries(normalizePreferences({ hotkeys: input.hotkeys }).hotkeys).filter(([id]) => !CONTROL_CHARACTER.test(id)).slice(0, MAX_HOTKEY_IDS);
  for (const [id, keys] of clean) hotkeys[id] = keys.filter(key => !CONTROL_CHARACTER.test(key));
  return { hotkeys, modifiers: normalizeModifiers(input.modifiers) };
}
function normalizeAppearanceValues(values) {
  const { id, name, ...result } = normalizeViewportPresets([{ ...record(values), id: 'custom-values', name: 'values' }])[0];
  return result;
}
const unnamedBackground = holder => isRecord(holder) && isRecord(holder.background) ? { ...holder, background: { ...holder.background, imageName: '' } } : holder;
/** Shared files embed background images but never say what the file was called on this PC. */
function withoutImageNames(appearance) {
  if (!isRecord(appearance)) return appearance;
  const result = unnamedBackground(appearance);
  return own(result, 'quadView') ? { ...result, quadView: unnamedBackground(result.quadView) } : result;
}

// ---- Domain table ----------------------------------------------------------

/** A domain whose saved presets live in preferences.settingsPresets[id]. */
function standardDomain(spec) {
  const domain = {
    saved: prefs => { const list = record(prefs.settingsPresets)[spec.id]; return Array.isArray(list) ? list : []; },
    store: (prefs, list) => ({ settingsPresets: { ...record(prefs.settingsPresets), [spec.id]: list } }),
    limit: MAX_SAVED_PRESETS, limitMessage: 'No room for more saved presets. Delete one first.',
    apply: (prefs, preset) => spec.write(prefs, preset.values),
    select: () => ({}), afterDelete: () => ({}), deleted: name => `${name} deleted. Current settings were kept.`,
    capture: prefs => spec.read(prefs), restoreCaptured: (prefs, values) => spec.write(prefs, values),
    parseValues: input => ({ values: strictValues(domain, input) }),
    ...spec,
  };
  return domain;
}
const dragBuiltIns = (presets, normalize) => DRAG_PRESET_NAMES.map(([id, name]) => ({ id, name, values: normalize(presets[id]) }));
function viewportToPreset(preset) {
  const { id, name, appearance, theme, accent } = preset;
  return { id, name, values: { appearance, ...(theme ? { theme, accent: accent || APPLICATION_THEMES[theme].accent } : {}), ...pick(preset, ['toolHighlight', 'visuals', 'citadelPaint', 'emitterMarker']) } };
}
/** The parts of a look outside viewportAppearance, for storing beside it in a saved viewport preset. */
export function appearanceLook(prefs) {
  return { toolHighlight: prefs.toolHighlight, visuals: pick(record(prefs.visuals), APPEARANCE_LOOK_KEYS), citadelPaint: prefs.citadelPaint, emitterMarker: prefs.emitterMarker };
}
/** A built-in writes every part of the look, so nothing set before shows through. The Grid page's colours are not part of it. */
function fullLook(change) {
  if (!own(BUILT_IN_VIEWPORT_PRESETS, change.viewportPreset)) return change;
  return { ...change, visuals: { ...change.visuals, ...pick(DEFAULT_VISUALS, APPEARANCE_SIZE_KEYS) }, citadelPaint: { ...change.citadelPaint, borderThickness: DEFAULT_PAINT_APPEARANCE.borderThickness }, emitterMarker: DEFAULT_PREFERENCES.emitterMarker };
}

let domainTable = null;
function domains() {
  if (domainTable) return domainTable;
  const appearance = {
    label: 'Appearance', maxBytes: MAX_PRESET_FILE_BYTES,
    builtIns: Object.values(BUILT_IN_VIEWPORT_PRESETS).map(viewportToPreset),
    saved: prefs => (Array.isArray(prefs.viewportPresets) ? prefs.viewportPresets : []).map(viewportToPreset),
    store: (prefs, list) => ({ viewportPresets: list.map(({ id, name, values }) => ({ id, name, ...values })) }),
    limit: MAX_VIEWPORT_PRESETS, limitMessage: `You can save up to ${MAX_VIEWPORT_PRESETS} custom viewport presets.`,
    read: prefs => ({ appearance: prefs.viewportAppearance, theme: prefs.theme, accent: prefs.accent, ...appearanceLook(prefs) }),
    normalize: normalizeAppearanceValues, sameKeys: true,
    forFile: values => ({ ...values, appearance: withoutImageNames(values.appearance) }),
    parseValues: input => ({ values: strictValues(appearance, isRecord(input) && own(input, 'appearance') ? { ...input, appearance: withoutImageNames(input.appearance) } : input) }),
    // The stored flag says it: comparing hundreds of values and images on every render buys nothing.
    active: prefs => viewportPresetById(prefs.viewportPreset, prefs.viewportPresets) ? prefs.viewportPreset : CUSTOM_PRESET,
    apply: (prefs, preset) => fullLook(viewportPresetChange(prefs, preset.id)),
    select: id => ({ viewportPreset: id }),
    afterDelete: (prefs, id) => prefs.viewportPreset === id ? { viewportPreset: CUSTOM_PRESET } : {},
    deleted: name => `${name} deleted. Current appearance was kept.`,
    capture: prefs => pick(prefs, [...LIGHT_DARK_KEYS, 'toolHighlight', 'emitterMarker']), restoreCaptured: (prefs, captured) => ({ ...captured }),
    restore: prefs => ({ ...fullLook(viewportPresetChange(prefs, DEFAULT_VIEWPORT_PRESET_ID)), toolHighlight: '' }),
  };
  domainTable = {
    mouse: standardDomain({
      id: 'mouse', label: 'Mouse', maxBytes: SMALL_FILE, fallback: 'classic',
      builtIns: [{ id: 'classic', name: 'Classic MDLVis', values: normalizeMouseValues(CAMERA_PRESETS.classic) }, { id: 'orbit', name: 'Orbit navigation', values: normalizeMouseValues(CAMERA_PRESETS.orbit) }],
      read: prefs => pick(prefs, MOUSE_KEYS), write: (prefs, values) => pick(values, MOUSE_KEYS), normalize: normalizeMouseValues,
    }),
    rotate: standardDomain({
      id: 'rotate', label: 'Rotate', maxBytes: SMALL_FILE, fallback: 'mdlxl',
      builtIns: dragBuiltIns(ROTATION_PRESETS, rotationValues),
      // A built-in clears the per-editor overrides, so any left mean the settings are no longer that built-in.
      activeBuiltIn: prefs => Object.keys(record(prefs.rotation?.editors)).length ? CUSTOM_PRESET : rotationPresetId(prefs.rotation),
      // Stored rotation omits defaults; comparing the omitted keys too keeps a mostly-default preset from matching everything.
      expand: values => ({ ...DEFAULT_ROTATION_BEHAVIOR, ...values }),
      read: prefs => rotationValues(prefs.rotation), normalize: rotationValues,
      // Each piece is a tool toggle that lives in the same object; it stays out of every preset.
      write: (prefs, values) => ({ rotation: { ...values, ...pick(record(prefs.rotation), ['eachPiece']) } }),
    }),
    uv: standardDomain({
      id: 'uv', label: 'UV Rotate and Zoom', maxBytes: SMALL_FILE, fallback: 'mdlxl',
      builtIns: dragBuiltIns(UV_DRAG_PRESETS, normalizeUVDrag), activeBuiltIn: prefs => uvDragPreset(prefs.uvDrag),
      read: prefs => ({ ...normalizeUVDrag(prefs.uvDrag), uvSensitivity: uvTransformSensitivity(prefs) }), normalize: normalizeUVValues,
      write: (prefs, { uvSensitivity, ...uvDrag }) => ({ uvDrag, ...(uvSensitivity === undefined ? {} : { uvSensitivity }) }),
      restore: () => ({ uvDrag: normalizeUVDrag(UV_DRAG_PRESETS.mdlxl), uvSensitivity: DEFAULT_PREFERENCES.uvSensitivity }),
    }),
    hotkeys: standardDomain({
      id: 'hotkeys', label: 'Hotkeys', maxBytes: HOTKEY_FILE, fallback: 'default', unorderedLists: true,
      restoreQuestion: 'Restore every default shortcut and clear custom assignments?',
      builtIns: [{ id: 'default', name: 'Default', values: { hotkeys: {}, modifiers: {} } }],
      read: prefs => ({ hotkeys: record(prefs.hotkeys), modifiers: record(prefs.modifiers) }), write: (prefs, values) => pick(values, ['hotkeys', 'modifiers']), normalize: normalizeHotkeyValues,
      parseValues: parseHotkeyValues,
    }),
    appearance,
  };
  return domainTable;
}
function domainOf(id) {
  if (typeof id !== 'string' || !own(domains(), id)) throw Error('Unknown preset type.');
  return domains()[id];
}

// ---- Listing and matching --------------------------------------------------

const allPresets = (domain, prefs) => [...domain.builtIns, ...domain.saved(prefs)];
const findPreset = (domain, prefs, id) => allPresets(domain, prefs).find(preset => preset.id === id) || null;
const namedPreset = (domain, prefs, name) => allPresets(domain, prefs).find(preset => preset.name.toLowerCase() === name.toLowerCase()) || null;
/** Only the keys the preset lists count, so a saved snapshot and a smaller built-in can both match. Appearance needs the same keys: an older preset is not the same look as one that also holds helper colours. */
function listedMatch(domain, current, values) {
  const expand = domain.expand || (value => value), have = expand(current), want = expand(values);
  if (domain.sameKeys && Object.keys(have).length !== Object.keys(want).length) return false;
  return Object.keys(want).every(key => canonical(have[key], domain.unorderedLists) === canonical(want[key], domain.unorderedLists));
}

/** Plain label of a domain, for bar captions and messages. */
export function presetDomainLabel(domainId) { return domainOf(domainId).label; }
/** The question to confirm before Restore, or '' when Restore needs none. */
export function presetRestoreQuestion(domainId) { return domainOf(domainId).restoreQuestion || ''; }
/** Built-ins first, then saved ones: `{ id, name, builtIn }`. */
export function listPresets(domainId, prefs) {
  const domain = domainOf(domainId);
  return [...domain.builtIns.map(({ id, name }) => ({ id, name, builtIn: true })), ...domain.saved(prefs).map(({ id, name }) => ({ id, name, builtIn: false }))];
}
/** The active preset's id, or CUSTOM_PRESET. `preferId` is the one last picked, when several hold the same values. */
export function activePreset(domainId, prefs, preferId) {
  const domain = domainOf(domainId);
  if (domain.active) return domain.active(prefs);
  const current = domain.read(prefs), matches = preset => listedMatch(domain, current, preset.values);
  const preferred = preferId ? findPreset(domain, prefs, preferId) : null;
  if (preferred && matches(preferred)) return preferred.id;
  // Saved first, so a full snapshot wins over a built-in; newest first, so the one just saved shows.
  const saved = [...domain.saved(prefs)].reverse().find(matches);
  if (saved) return saved.id;
  if (domain.activeBuiltIn) { const id = domain.activeBuiltIn(prefs); return domain.builtIns.some(preset => preset.id === id) ? id : CUSTOM_PRESET; }
  return domain.builtIns.find(matches)?.id ?? CUSTOM_PRESET;
}

// ---- Changes ---------------------------------------------------------------

function newPresetId(taken) {
  const stamp = Date.now().toString(36);
  for (let n = 0; ; n += 1) { const id = `custom-${stamp}${n ? `-${n}` : ''}`; if (!taken.has(id)) return id; }
}
function addPreset(domain, prefs, name, values) {
  const saved = domain.saved(prefs);
  if (saved.length >= domain.limit) throw Error(domain.limitMessage);
  const preset = { id: newPresetId(new Set(saved.map(item => item.id))), name, values };
  return { preset, stored: domain.store(prefs, [...saved, preset]) };
}
function uniqueName(name, taken) {
  if (!taken.has(name.toLowerCase())) return name;
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`, candidate = `${name.slice(0, MAX_NAME - suffix.length).trim()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function applyPreset(domainId, prefs, id) {
  const domain = domainOf(domainId), preset = findPreset(domain, prefs, id);
  if (!preset) throw Error('That preset no longer exists.');
  return withStatus(domain.apply(prefs, preset), `${preset.name} loaded.`, preset.id);
}
/** Adds the current settings to Saved under a name the user typed. */
export function savePreset(domainId, prefs, name) {
  const domain = domainOf(domainId), clean = sanitizePresetName(name);
  if (!clean) throw Error('Enter a name for the preset.');
  const values = domain.normalize(domain.read(prefs)), existing = namedPreset(domain, prefs, clean);
  if (existing) {
    if (!listedMatch(domain, values, existing.values)) throw Error('A preset with that name already exists.');
    return withStatus(domain.select(existing.id), `${existing.name} is already saved.`, existing.id);
  }
  const { preset, stored } = addPreset(domain, prefs, clean, values);
  return withStatus({ ...stored, ...domain.select(preset.id) }, `${clean} saved.`, preset.id);
}
export function deletePreset(domainId, prefs, id) {
  const domain = domainOf(domainId), saved = domain.saved(prefs), preset = saved.find(item => item.id === id);
  if (!preset) throw Error('That preset no longer exists.');
  return withStatus({ ...domain.store(prefs, saved.filter(item => item.id !== id)), ...domain.afterDelete(prefs, id) }, domain.deleted(preset.name), null);
}
export function restoreDomain(domainId, prefs) {
  const domain = domainOf(domainId);
  const change = domain.restore ? domain.restore(prefs) : domain.write(prefs, domain.builtIns.find(preset => preset.id === domain.fallback).values);
  return withStatus(change, 'Defaults restored.', domain.fallback ?? DEFAULT_VIEWPORT_PRESET_ID);
}
function loadStatus(name, { skipped = 0, waiting = 0 }) {
  if (skipped && waiting) return `${name} loaded. Entries skipped: ${skipped}. Keys for unopened windows: ${waiting}.`;
  if (skipped) return `${name} loaded. Entries skipped: ${skipped}.`;
  return waiting ? `${name} loaded. Keys for unopened windows: ${waiting}.` : `${name} loaded.`;
}
/** Adds a parsePresetFile result to Saved and applies it. A name already taken becomes "Name (2)"; the same name with the same values reuses that preset. */
export function loadPreset(prefs, parsed) {
  const domain = domainOf(parsed.domain), existing = namedPreset(domain, prefs, parsed.name);
  if (existing && listedMatch(domain, parsed.values, existing.values)) return withStatus(domain.apply(prefs, existing), loadStatus(existing.name, parsed), existing.id);
  const name = uniqueName(parsed.name, new Set(allPresets(domain, prefs).map(preset => preset.name.toLowerCase())));
  const { preset, stored } = addPreset(domain, prefs, name, parsed.values);
  return withStatus({ ...stored, ...domain.apply({ ...prefs, ...stored }, preset) }, loadStatus(name, parsed), preset.id);
}
/** Opaque copy of the current settings, kept in memory while another preset is tried. */
export function captureCustom(domainId, prefs) { return domainOf(domainId).capture(prefs); }
/** The change that returns to a captureCustom copy. */
export function restoreCustom(domainId, prefs, captured) { return withStatus(domainOf(domainId).restoreCaptured(prefs, captured), 'Unsaved custom restored.', null); }
/**
 * Accent, tool highlight, helper, marker and Citadel edits are not part of viewportAppearance,
 * so the page routes them through this to make Appearance read as Custom. A write that
 * changes nothing, or only the Grid page's colours in `visuals`, leaves the preset alone.
 */
export function appearanceEdit(prefs, change) {
  const edited = ['accent', 'toolHighlight', 'emitterMarker'].some(key => own(change, key) && change[key] !== prefs[key])
    || (own(change, 'visuals') && APPEARANCE_LOOK_KEYS.some(key => change.visuals?.[key] !== prefs.visuals?.[key]))
    || (own(change, 'citadelPaint') && canonical(change.citadelPaint) !== canonical(prefs.citadelPaint));
  return edited ? { ...change, viewportPreset: CUSTOM_PRESET } : change;
}

// ---- Saved lists in settings.json ------------------------------------------

// normalizePreferences runs on every commit; a list that came out of here needs no second pass.
const alreadyNormalized = new WeakSet();
function normalizeSavedList(domain, list) {
  const ids = new Set(), names = new Set(), output = [];
  for (const item of list) {
    if (output.length >= MAX_SAVED_PRESETS) break;
    if (!isRecord(item) || !isRecord(item.values)) continue;
    const id = typeof item.id === 'string' && SAVED_ID.test(item.id) ? item.id : '', name = sanitizePresetName(item.name);
    if (!id || !name || ids.has(id) || names.has(name.toLowerCase())) continue;
    ids.add(id); names.add(name.toLowerCase());
    const values = alreadyNormalized.has(item.values) ? item.values : domain.normalize(item.values);
    alreadyNormalized.add(values);
    output.push({ id, name, values });
  }
  return output;
}
/** Called by normalizePreferences. Appearance is absent on purpose: its presets stay in viewportPresets. */
export function normalizeSettingsPresets(input) {
  const source = record(input);
  // The domain table's own normalizers call normalizePreferences, which arrives here with
  // no lists: an empty list must not touch the table.
  return Object.fromEntries(['mouse', 'rotate', 'uv', 'hotkeys'].map(id => [id, Array.isArray(source[id]) && source[id].length ? normalizeSavedList(domains()[id], source[id]) : []]));
}

// ---- Files -----------------------------------------------------------------

/** The text of a .mdlxl-preset file. `id` is a preset, or CUSTOM_PRESET for the current settings under `name`. */
export function serializePreset(domainId, prefs, id, appVersion, { name } = {}) {
  const domain = domainOf(domainId), preset = id === CUSTOM_PRESET ? null : findPreset(domain, prefs, id);
  if (id !== CUSTOM_PRESET && !preset) throw Error('That preset no longer exists.');
  const values = domain.normalize(preset ? preset.values : domain.read(prefs));
  return `${JSON.stringify({
    schema: PRESET_SCHEMA, version: PRESET_VERSION, domain: domainId,
    name: sanitizePresetName(preset ? preset.name : name) || 'Custom',
    app: typeof appVersion === 'string' ? appVersion.slice(0, MAX_APP) : '',
    values: domain.forFile ? domain.forFile(values) : values,
  }, null, 2)}\n`;
}

function assertSafeStructure(root) {
  let nodes = 0;
  const visit = (value, depth, key) => {
    if (++nodes > MAX_NODES) throw Error(TOO_COMPLEX);
    if (typeof value === 'string') { if (value.length > (key === 'imageData' ? MAX_VIEWPORT_BACKGROUND_DATA_LENGTH : MAX_STRING)) throw Error(TOO_LARGE); return; }
    if (value === null || typeof value !== 'object') return;
    if (depth > MAX_DEPTH) throw Error(TOO_COMPLEX);
    if (Array.isArray(value)) { for (const item of value) visit(item, depth + 1, ''); return; }
    // Object.keys also sees an own "__proto__", which JSON.parse creates as ordinary data.
    for (const name of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(name)) throw Error(NOT_VALID);
      if (name.length > MAX_STRING) throw Error(TOO_LARGE);
      visit(value[name], depth + 1, name);
    }
  };
  visit(root, 1, '');
}
/** Every key in the file must survive normalizing and every value must come back identical, so a bad value is refused instead of being quietly reset. Keys the file lacks take their defaults. */
function assertCanonical(input, normalized, path) {
  if (Array.isArray(input)) {
    if (!Array.isArray(normalized) || normalized.length !== input.length) throw invalidSetting(path);
    input.forEach((item, index) => assertCanonical(item, normalized[index], `${path}[${index}]`));
  } else if (isRecord(input)) {
    if (!isRecord(normalized)) throw invalidSetting(path);
    for (const key of Object.keys(input)) {
      const inner = path ? `${path}.${key}` : key;
      if (!own(normalized, key)) throw invalidSetting(inner);
      assertCanonical(input[key], normalized[key], inner);
    }
  } else if (input !== normalized) throw invalidSetting(path);
}
function strictValues(domain, input) {
  if (!isRecord(input)) throw Error(NOT_VALID);
  const values = domain.normalize(input);
  assertCanonical(input, domain.expand ? domain.expand(values) : values, '');
  return values;
}

/** Scope-aware, and only between controls this PC knows: a window not opened yet cannot raise a false clash. */
function hotkeyFileConflict(catalog, overrides) {
  const actions = new Map(catalog.filter(action => action?.id).map(action => [action.id, action]));
  const commands = new Set(catalog.map(action => action?.bindingCommand).filter(Boolean));
  const known = Object.fromEntries(Object.entries(overrides).filter(([id]) => actions.has(id) || commands.has(id)));
  const bindings = effectiveBindings(catalog, known);
  for (const [id, action] of actions) {
    if (!own(known, id) && !(action.bindingCommand && own(known, action.bindingCommand))) continue;
    for (const key of bindings[id] || []) {
      const other = hotkeyConflicts(catalog, known, id, key).find(otherId => actions.has(otherId));
      if (other) return { key, first: action, second: actions.get(other) };
    }
  }
  return null;
}
function conflictMessage({ key, first, second }) {
  const both = `${formatChord(key)} is on both ${first.label || first.id} and ${second.label || second.id}`;
  return first.category ? `${both} in ${first.category}.` : `${both}.`;
}
/** Hotkeys are the one domain where a bad entry is dropped and counted rather than fatal: a shared map stays useful across versions. */
function parseHotkeyValues(input, { catalog = [] } = {}) {
  if (!isRecord(input)) throw Error(NOT_VALID);
  const extra = Object.keys(input).find(key => key !== 'hotkeys' && key !== 'modifiers');
  if (extra) throw invalidSetting(extra);
  for (const key of ['hotkeys', 'modifiers']) if (own(input, key) && !isRecord(input[key])) throw invalidSetting(key);
  const rawHotkeys = migrateHotkeyBindings(input.hotkeys ?? {}), rawModifiers = input.modifiers ?? {};
  if (Object.keys(rawHotkeys).length > MAX_HOTKEY_IDS) throw Error(TOO_COMPLEX);
  const values = normalizeHotkeyValues({ hotkeys: rawHotkeys, modifiers: rawModifiers });
  for (const keys of Object.values(values.hotkeys)) if (keys.includes(HOTKEY_LEADER)) throw Error('Ctrl+Alt+Space starts a Hotkeys sequence, so it cannot be a shortcut.');
  const conflict = hotkeyFileConflict(catalog, values.hotkeys);
  if (conflict) throw Error(conflictMessage(conflict));
  if (modifierConflicts(values.modifiers).length) throw Error('This preset uses one mouse drag key for two jobs, so it was not loaded.');
  let skipped = 0;
  for (const [id, keys] of Object.entries(rawHotkeys)) skipped += own(values.hotkeys, id) ? keys.length - values.hotkeys[id].length : 1;
  for (const [key, value] of Object.entries(rawModifiers)) if (values.modifiers[key] !== value) skipped += 1;
  const commands = new Set(catalog.flatMap(action => [action?.id, action?.bindingCommand]));
  return { values, skipped, waiting: catalog.length ? Object.keys(values.hotkeys).filter(id => !commands.has(id)).length : 0 };
}

/**
 * Validates an untrusted preset file and returns `{ domain, name, app, values, skipped, waiting }`.
 * Throws a short sentence on any failure; nothing is applied. `values` is always the
 * normalizer's fresh output. `catalog` is the current Hotkeys catalog.
 */
export function parsePresetFile(text, { expectDomain, catalog } = {}) {
  if (typeof text !== 'string') throw Error(NOT_VALID);
  if (text.length > MAX_PRESET_FILE_BYTES) throw Error(TOO_LARGE);
  let data;
  try { data = JSON.parse(text.replace(/^﻿/, '')); } catch { throw Error(NOT_VALID); }
  assertSafeStructure(data);
  if (!isRecord(data) || data.schema !== PRESET_SCHEMA) throw Error('This is not an MDLxL preset file.');
  if (!Number.isInteger(data.version) || data.version < 1) throw Error(NOT_VALID);
  if (data.version > PRESET_VERSION) throw Error('This preset was made by a newer MDLxL.');
  if (Object.keys(data).length !== ENVELOPE_KEYS.length || !ENVELOPE_KEYS.every(key => own(data, key))) throw Error(NOT_VALID);
  if (typeof data.domain !== 'string' || !own(domains(), data.domain)) throw Error(NOT_VALID);
  const domain = domains()[data.domain];
  if (expectDomain && expectDomain !== data.domain) throw Error(`This preset is for ${domain.label}. Open that page to load it.`);
  if (new TextEncoder().encode(text).length > domain.maxBytes) throw Error(TOO_LARGE);
  const name = sanitizePresetName(data.name);
  if (!name) throw Error('This preset has no name.');
  if (typeof data.app !== 'string' || data.app.length > MAX_APP) throw Error(NOT_VALID);
  try {
    const { values, skipped = 0, waiting = 0 } = domain.parseValues(data.values, { catalog });
    return { domain: data.domain, name, app: data.app, values, skipped, waiting };
    // Some colour normalizers throw on an array that reads as a colour; people see a sentence, not that.
  } catch (error) { throw error instanceof TypeError ? Error(NOT_VALID) : error; }
}
