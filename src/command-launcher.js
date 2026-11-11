// What the command launcher lists and how typing narrows it. No DOM here.
import VIEW_MENU from './view-menu.json' with { type: 'json' };
import { LANGUAGES } from './localization.js';
import { TEAM_COLORS } from './team-colors.js';
import { TOOLBAR_MODES, TOOLBAR_MODE_LABELS } from './toolbar-mode.js';

/** Shown first while the search field is empty. */
export const LAUNCHER_EDITORS = Object.freeze(['vertices', 'bones', 'uv', 'animation', 'animations', 'paint', 'showcase']);

const notListed = id => id === 'launcher' || id.startsWith('forge:shape:') || id.startsWith('paint:');

/**
 * Rows that are not plain catalog commands: choices with a value and the View toggles.
 * `label` is English and translated when drawn; `value` is already final text.
 * `searchOnly` rows stay out of the empty list so long choice lists don't bury the commands.
 */
export function launcherExtraRows({ toolbarMode, visUI, language, antialias, showHotkeys, teamColor, modelVersion, displayMode, checks = {}, translate = text => text }) {
  return [
    ...(visUI ? [] : TOOLBAR_MODES.map(mode => ({ id: 'toolbar:' + mode, label: 'Toolbar', value: translate(TOOLBAR_MODE_LABELS[mode]), checked: toolbarMode === mode }))),
    { id: 'convertVersion', label: modelVersion === 800 ? 'Convert to MDX1000' : 'Convert to MDX800' },
    { id: 'smoothEdges', label: 'Smooth edges', checked: !!antialias },
    { id: 'showHotkeys', label: 'Show hotkeys', checked: !!showHotkeys },
    { id: 'learnSettings', label: 'Learn settings' },
    ...(visUI ? [] : [{ id: 'ai:open', label: 'AI console' }]),
    ...(VIEW_MENU[displayMode] || []).map(([label, id]) => id === 'clearDisplay' ? { id, label: 'Clear display' } : { id, label: 'Display', value: translate(label), checked: !!checks[id] }),
    ...LANGUAGES.map(item => ({ id: 'language:' + item.id, label: 'Language', value: item.nativeLabel, checked: language === item.id, searchOnly: true })),
    ...TEAM_COLORS.map(row => ({ id: 'team:' + row.rgbHex, label: 'Team color', value: translate(row.name), checked: teamColor === row.rgbHex, searchOnly: true })),
  ];
}

/** Everything the launcher can run right now: editors, then the extra rows, then the other commands. */
export function launcherRows(catalog, extras, isEnabled) {
  const extraIds = new Set(extras.map(row => row.id));
  const commands = catalog.filter(action => !action.contextual && !notListed(action.id) && !extraIds.has(action.id)).map(action => ({ id: action.id, label: action.label }));
  const rank = id => { const index = LAUNCHER_EDITORS.indexOf(id); return index < 0 ? LAUNCHER_EDITORS.length : index; };
  const editors = commands.filter(row => rank(row.id) < LAUNCHER_EDITORS.length).sort((a, b) => rank(a.id) - rank(b.id));
  return [...editors, ...extras, ...commands.filter(row => rank(row.id) === LAUNCHER_EDITORS.length)].filter(row => isEnabled(row.id));
}

/** Every typed word must appear; names that start with the first word come before names that merely contain it. */
export function filterLauncherRows(rows, query, translate = text => text) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows.filter(row => !row.searchOnly);
  const hits = [];
  rows.forEach((row, index) => {
    const label = translate(row.label).toLowerCase(), text = `${label} ${row.label.toLowerCase()} ${(row.value || '').toLowerCase()}`;
    if (!words.every(word => text.includes(word))) return;
    const quality = label.startsWith(words[0]) || row.label.toLowerCase().startsWith(words[0]) ? 0 : ` ${text}`.includes(` ${words[0]}`) ? 1 : 2;
    hits.push({ row, index, quality });
  });
  return hits.sort((a, b) => a.quality - b.quality || a.index - b.index).map(hit => hit.row);
}
