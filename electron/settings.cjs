const fs = require('node:fs/promises');
const path = require('node:path');
const { writeFileAtomic, serialQueue } = require('./atomic-file.cjs');

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Refuses preference values outside `limits`, the PREFERENCE_LIMITS exported
// by src/preferences.js, so the store and the editor share one rule. Without
// limits only the shape is checked and normalizePreferences clamps the values.
function validatePreferences(value, limits = {}) {
  const range = (key, number) => typeof number === 'number' && Number.isFinite(number) && (!limits[key] || (number >= limits[key].min && number <= limits[key].max));
  const listed = (list, item) => !list || list.includes(item);
  if (!record(value)) throw Error('Invalid preferences.');
  if (own(value, 'scrollSensitivity') && !range('scrollSensitivity', value.scrollSensitivity)) throw Error(limits.scrollSensitivity ? `Scroll sensitivity must be between ${limits.scrollSensitivity.min} and ${limits.scrollSensitivity.max}.` : 'Invalid scroll sensitivity.');
  if (own(value, 'wheelMode') && (typeof value.wheelMode !== 'string' || !listed(limits.wheelModes, value.wheelMode))) throw Error('Invalid middle button mode.');
  if (own(value, 'pointerSensitivity') && !range('pointerSensitivity', value.pointerSensitivity)) throw Error(limits.pointerSensitivity ? `Pointer sensitivity must be between ${limits.pointerSensitivity.min} and ${limits.pointerSensitivity.max}.` : 'Invalid pointer sensitivity.');
  if (own(value, 'rightScrollAdjust') && typeof value.rightScrollAdjust !== 'boolean') throw Error('Invalid mouse adjustment setting.');
  if (own(value, 'graphics')) {
    const graphics = value.graphics;
    if (!record(graphics)) throw Error('Invalid graphical settings.');
    if (own(graphics, 'pixelRatio') && (typeof graphics.pixelRatio !== 'number' || !listed(limits.pixelRatios, graphics.pixelRatio))) throw Error('Invalid render resolution.');
    if (own(graphics, 'maxFps') && (typeof graphics.maxFps !== 'number' || !listed(limits.maxFps, graphics.maxFps))) throw Error('Invalid frame rate limit.');
    for (const key of ['antialias', 'textures', 'lighting', 'particles', 'pauseWhenHidden', 'softwareLow']) {
      if (own(graphics, key) && typeof graphics[key] !== 'boolean') throw Error(`Invalid graphical setting: ${key}.`);
    }
  }
  if (own(value, 'hotkeys')) {
    if (!record(value.hotkeys) || Object.keys(value.hotkeys).length > 5000) throw Error('Invalid Hotkeys settings.');
    const idLength = limits.hotkeyIdLength ?? Infinity, perAction = limits.hotkeysPerAction ?? Infinity;
    for (const [id, keys] of Object.entries(value.hotkeys)) {
      if (!id || id.length > idLength || /[\x00-\x1f]/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id) || !Array.isArray(keys) || keys.length > perAction || keys.some(key => typeof key !== 'string' || !key || key.length > 100 || /[\x00-\x1f]/.test(key))) throw Error('Invalid Hotkeys assignment.');
    }
  }
}

function applySettingsPatch(current, patch, normalizePreferences, limits) {
  if (!record(patch)) throw Error('Invalid settings.');
  const next = { ...current };
  if (own(patch, 'historyBudgetBytes')) {
    const budget = patch.historyBudgetBytes;
    if (!Number.isSafeInteger(budget) || budget < 64 * 1048576 || budget > 4096 * 1048576) throw Error('Invalid undo memory limit.');
    next.historyBudgetBytes = budget;
  }
  if (own(patch, 'historyMaxSteps')) {
    const steps = patch.historyMaxSteps;
    if (!Number.isSafeInteger(steps) || steps < 10 || steps > 100000) throw Error('Invalid undo step limit.');
    next.historyMaxSteps = steps;
  }
  if (own(patch, 'gameData')) {
    // This field is written only by the native directory picker.  `null`
    // deliberately clears a previous choice without leaving a stale path in
    // the portable profile.
    if (patch.gameData === null) delete next.gameData;
    else {
      if (typeof patch.gameData !== 'string' || !patch.gameData.trim() || patch.gameData.length > 32768 || patch.gameData.includes('\0')) throw Error('Invalid game data folder.');
      next.gameData = patch.gameData.trim();
    }
  }
  if (own(patch, 'gameDataSources')) {
    if (!Array.isArray(patch.gameDataSources) || patch.gameDataSources.some(source => !record(source) || !['casc', 'mpq'].includes(source.kind) || typeof source.path !== 'string' || !path.isAbsolute(source.path) || source.path.length > 32768 || source.path.includes('\0'))) throw Error('Invalid custom game archive.');
    next.gameDataSources = [...new Map(patch.gameDataSources.map(source => [path.resolve(source.path).toLowerCase(), { kind: source.kind, path: path.resolve(source.path) }])).values()];
  }
  if (own(patch, 'preferences')) {
    validatePreferences(patch.preferences, limits);
    const previous = normalizePreferences(current.preferences);
    next.preferences = normalizePreferences({
      ...previous,
      ...patch.preferences,
      graphics: { ...previous.graphics, ...patch.preferences.graphics },
      // A supplied map is a complete set of overrides. An empty map restores defaults.
      hotkeys: own(patch.preferences, 'hotkeys') ? patch.preferences.hotkeys : previous.hotkeys,
    });
  }
  return next;
}

class SettingsStore {
  // `limits` is PREFERENCE_LIMITS from src/preferences.js.
  constructor(file, normalizePreferences, limits) {
    this.file = file;
    this.normalizePreferences = normalizePreferences;
    this.limits = limits;
    this.settings = { preferences: normalizePreferences() };
    this.enqueue = serialQueue();
  }
  async load(fallbackFile) {
    let value;
    try { value = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch { if (fallbackFile) try { value = JSON.parse(await fs.readFile(fallbackFile, 'utf8')); } catch {} }
    value = record(value) ? value : {};
    this.settings = { preferences: this.normalizePreferences(value.preferences) };
    // Preserve each valid legacy field independently if a settings file was damaged.
    for (const key of ['historyBudgetBytes', 'historyMaxSteps', 'gameData', 'gameDataSources']) {
      if (own(value, key)) try { this.settings = applySettingsPatch(this.settings, { [key]: value[key] }, this.normalizePreferences, this.limits); } catch {}
    }
    return this.settings;
  }
  configure(patch) {
    // Validate before enqueuing and snapshot IPC input so later callers cannot alter it.
    applySettingsPatch(this.settings, patch, this.normalizePreferences, this.limits);
    const input = structuredClone(patch);
    return this.enqueue(async () => {
      const next = applySettingsPatch(this.settings, input, this.normalizePreferences, this.limits);
      if (JSON.stringify(next) === JSON.stringify(this.settings)) return this.settings;
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await writeFileAtomic(this.file, JSON.stringify(next));
      this.settings = next;
      return next;
    });
  }
  async flush() { await this.enqueue.idle(); }
}

module.exports = { SettingsStore, applySettingsPatch, validatePreferences };
