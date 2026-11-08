import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { COMMANDS } from '../src/commands.js';
import { TOOLBAR_MODES, normalizeToolbarMode, nextToolbarMode } from '../src/toolbar-mode.js';
import { launcherExtraRows, launcherRows, filterLauncherRows, LAUNCHER_EDITORS } from '../src/command-launcher.js';
import APPLICATION_THEMES from '../src/application-themes.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const { buildMenuTemplate } = require('../electron/menu.cjs');
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r', '');
const look = read('app/new-look.css'), app = read('app/App.jsx'), bar = read('app/AppToolbar.jsx'), launcherCss = read('app/launcher.css');

// Every rule as [selector, body], looking inside @media.
const rules = css => [...css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => [match[1].trim(), match[2]]);
const splitSelectors = selector => { const parts = ['']; let depth = 0; for (const letter of selector) { depth += letter === '(' ? 1 : letter === ')' ? -1 : 0; if (letter === ',' && !depth) parts.push(''); else parts[parts.length - 1] += letter; } return parts; };
const toolbarRules = rules(look).filter(([selector]) => selector.includes('data-toolbar'));
const settingsMenu = (state = {}, sent = []) => buildMenuTemplate({}, id => sent.push(id), 'win32', [], text => text, state).find(item => item.label === 'Settings').submenu;
const menu = (name, state = {}, sent = []) => buildMenuTemplate({}, id => sent.push(id), 'win32', [], text => text, state).find(item => item.label.replace('&', '') === name).submenu;

test('toolbar modes normalize and cycle Graphic, Trim, Hidden', () => {
  assert.deepEqual([...TOOLBAR_MODES], ['graphic', 'trim', 'hidden']);
  for (const bad of [undefined, null, '', 'Trim', 'compact', 3]) assert.equal(normalizeToolbarMode(bad), 'graphic');
  for (const mode of TOOLBAR_MODES) assert.equal(normalizeToolbarMode(mode), mode);
  assert.equal(nextToolbarMode('graphic'), 'trim');
  assert.equal(nextToolbarMode('trim'), 'hidden');
  assert.equal(nextToolbarMode('hidden'), 'graphic');
  assert.equal(nextToolbarMode('bad value'), 'trim');
});

test('the launcher and the cycle have their keys, and nothing else claims them', () => {
  const owners = key => COMMANDS.filter(command => command.defaultKeys.includes(key) && command.scope === 'editor').map(command => command.id);
  assert.deepEqual(owners('Ctrl+F2'), ['launcher']);
  assert.deepEqual(owners('Shift+F3'), ['toolbarCycle']);
  for (const id of ['showcase', 'managers', 'autoCorpse', 'visToggle']) assert.deepEqual(COMMANDS.find(command => command.id === id).defaultKeys, []);
});

test('Graphic stays untouched: its attribute is absent and every new rule needs another mode', () => {
  assert.match(app, /data-toolbar=\{preferences\.toolbarMode === 'graphic' \? undefined : preferences\.toolbarMode\}/);
  assert.match(app, /data-vis-ui=\{visUI \|\| undefined\}/);
  assert.ok(toolbarRules.length > 20);
  for (const [selector] of toolbarRules) for (const part of splitSelectors(selector)) {
    assert.match(part, /\[data-toolbar=(trim|hidden)\]/, part);
    assert.match(part, /:not\(\[data-vis-ui\]\)/, 'VIS keeps its own look: ' + part);
  }
  assert.equal(rules(look).filter(([selector]) => /graphic/i.test(selector)).length, 0, 'no rule targets Graphic');
  const before = look.slice(0, look.indexOf('Toolbar setting (Settings > Toolbar)'));
  assert.doesNotMatch(before, /data-toolbar/);
});

test('Trim uses theme colours only: no pictures, gradients, gold or dock font', () => {
  const trim = toolbarRules.filter(([selector]) => selector.includes('=trim'));
  for (const [selector, body] of trim) {
    assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|gradient|MDLxL Dock|rgb\(/i, selector);
    for (const [, name] of body.matchAll(/var\(--([\w-]+)/g)) assert.match(name, /^(ui-|m-|lit$)/, `${name} in ${selector}`);
  }
  assert.ok(trim.some(([selector, body]) => selector.endsWith('>img') && /display:none/.test(body)), 'dock pictures are gone in Trim');
});

test('Trim keeps one active state: field, raised edge and a lit bar, with the label in the theme text colour', () => {
  const trim = toolbarRules.filter(([selector]) => selector.includes('=trim'));
  const bar = trim.find(([selector]) => selector.includes('::after'));
  assert.ok(bar, 'lit bar rule');
  for (const target of ['button[aria-pressed=true]::after', 'editor-modules>button[aria-pressed=true]::after', 'label:has(input:checked)::after']) assert.ok(bar[0].includes(target), target);
  assert.match(bar[1], /background:var\(--lit\)/);
  const labels = trim.filter(([selector]) => /aria-pressed=true/.test(selector) && !selector.includes('::after'));
  for (const [selector, body] of labels) assert.doesNotMatch(body, /color:var\(--lit\)/, 'accent text would fail contrast: ' + selector);
  const dockActive = trim.find(([selector]) => /toolbar-modules>\[aria-pressed=true\]$/.test(selector));
  assert.match(dockActive[1], /background:var\(--ui-field\)/);
  assert.match(dockActive[1], /box-shadow:var\(--m-raise\)/);
  assert.ok(!trim.some(([selector, body]) => /aria-pressed=true/.test(selector) && /font-weight:[5-9]00/.test(body)), 'pressing a control never changes its width');
});

test('Hidden moves the bars off-screen and never removes them', () => {
  const hidden = toolbarRules.filter(([selector]) => selector.includes('=hidden'));
  const bars = hidden.filter(([selector]) => /classic-toolbar|classic-modules/.test(selector));
  assert.equal(bars.length, 1);
  assert.match(bars[0][1], /position:fixed/);
  assert.match(bars[0][1], /left:-9999px/);
  for (const [selector, body] of hidden) assert.doesNotMatch(body, /display:none|visibility:hidden/, selector);
  assert.doesNotMatch(bar, /toolbar-visibility|data-hotkey="hide"|data-hotkey="show"/);
});

test('the status row only gains its chips while the toolbar is hidden, and VIS ignores it', () => {
  assert.match(app, /const toolbarHidden = preferences\.toolbarMode === 'hidden' && !visUI;/);
  assert.match(app, /\{toolbarHidden && <ToolbarHiddenStatus /);
  assert.match(app, /if \(id === 'toolbarCycle' \|\| id === 'ai:open' \|\| id\.startsWith\('toolbar:'\)\) return !visUI;/);
});

test('the one-time note covers every route to Hidden and is remembered', () => {
  assert.match(app, /if \(!preferencesReady \|\| !toolbarHidden \|\| preferences\.toolbarHiddenNoted\) return;/);
  assert.match(app, /toolbarHiddenNoted: true/);
  assert.match(app, /quiet: true/, 'a tip, not a warning');
  assert.match(read('app/WarningToasts.jsx'), /data-alert=\{warning\.quiet \? undefined : ''\}/);
  assert.match(app, /Toolbar hidden\. Settings > Toolbar or \$\{formatChord\(key\)\} brings it back\./);
});

test('presentation choices are not offered to the AI console', () => {
  assert.match(app, /const uiCommands = \{/);
  assert.doesNotMatch(app, /commands\.current\['toolbar:/);
  assert.match(app, /const runCommand = id => \{ if\(commandEnabled\(id\)\) \(uiCommands\[id\] \|\| commands\.current\[id\]\)\?\.\(\); \};/);
});

test('the launcher and the cycle work in Paint, Managers and every other editor', () => {
  assert.match(app, /scope:\['undo','redo','launcher','toolbarCycle'\]\.includes\(command\.id\)/);
});

test('Settings has a Toolbar radio, Language and VIS look, and Add-ons still ends its group', () => {
  const sent = [], items = settingsMenu({ toolbarMode: 'trim', language: 'de', languages: [{ id: 'en', nativeLabel: 'English' }, { id: 'de', nativeLabel: 'Deutsch' }] }, sent);
  const addons = items.findIndex(item => item.label === 'Add-ons…');
  assert.equal(items[addons + 1].type, 'separator');
  const toolbar = items.find(item => item.label === 'Toolbar');
  assert.deepEqual(toolbar.submenu.map(item => [item.label, item.type, item.checked]), [['Graphic', 'radio', false], ['Trim', 'radio', true], ['Hidden', 'radio', false]]);
  toolbar.submenu[2].click();
  assert.deepEqual(sent, ['toolbar:hidden']);
  const language = items.find(item => item.label === 'Language');
  assert.deepEqual(language.submenu.map(item => [item.label, item.type, item.checked]), [['English', 'radio', false], ['Deutsch', 'radio', true]]);
  assert.equal(items.find(item => item.label === 'VIS look').type, 'checkbox');
  for (const label of ['Show hotkeys', 'Learn settings…', 'VIS look']) assert.ok(items.some(item => item.label === label), label);
  assert.ok(items.findIndex(item => item.label === 'Toolbar') > addons + 1);
});

test('native radios default to Graphic and grey out while VIS is on', () => {
  assert.equal(settingsMenu().find(item => item.label === 'Toolbar').submenu[0].checked, true);
  assert.equal(settingsMenu({ vanilla: true }).find(item => item.label === 'Toolbar').enabled, false);
  assert.equal(settingsMenu({ vanilla: true }).find(item => item.label === 'VIS look').checked, true);
});

test('every control that had no menu route has one now, in both menus', () => {
  const sent = [], items = menu('Modules', {}, sent), want = { 'Citadel Paint': 'paint', Managers: 'managers', Showcase: 'showcase', 'Forge…': 'forge', 'BitsAndParts…': 'bitsAndParts', 'OptimizeXL…': 'optimizeModel', 'Auto Corpse…': 'autoCorpse', 'AI console': 'ai:open' };
  for (const [label, id] of Object.entries(want)) { const row = items.find(item => item.label === label); assert.ok(row, label); row.click(); assert.equal(sent.at(-1), id); }
  for (const id of Object.values(want)) assert.ok(bar.includes(`'${id}']`), 'browser menu: ' + id);
  assert.ok(menu('File').some(item => item.label === 'Convert MDX800 / MDX1000'));
  assert.ok(menu('Help').some(item => item.label === 'Search commands…'));
  assert.ok(bar.includes(`['Search commands…','launcher']`));
  assert.ok(bar.includes(`['Convert MDX800 / MDX1000', 'convertVersion']`));
  assert.match(bar, /\['Add-ons…','addons'\], null/);
});

test('a command that cannot run now is greyed out in the native menu and does not dispatch', () => {
  const sent = [], items = menu('Modules', { disabledCommands: ['forge'] }, sent);
  const forge = items.find(item => item.label === 'Forge…'), bits = items.find(item => item.label === 'BitsAndParts…');
  assert.equal(forge.enabled, false);
  forge.click();
  assert.deepEqual(sent, []);
  assert.equal('enabled' in bits, false, 'a command with no state keeps Electron’s default');
});

// The launcher.
const catalog = [
  { id: 'select', label: 'Selection tool' }, { id: 'bones', label: 'Bones rest-pose workspace' }, { id: 'vertices', label: 'Vertex editor' },
  { id: 'launcher', label: 'Search commands' }, { id: 'forge:shape:add', label: 'Forge: Add shape' }, { id: 'paint:draw', label: 'Paint / draw' },
  { id: 'someButton', label: 'Window control', contextual: true }, { id: 'convertVersion', label: 'Convert MDX800 / MDX1000' }, { id: 'weld', label: 'Weld selected vertices' },
];
const extras = (overrides = {}) => launcherExtraRows({ toolbarMode: 'trim', visUI: false, language: 'en', antialias: true, showHotkeys: false, teamColor: '#ff0303', modelVersion: 800, displayMode: 'vertices', checks: { grid: true }, ...overrides });
const ids = rows => rows.map(row => row.id);

test('the launcher lists catalog commands, editors first, without forge, paint, window controls or itself', () => {
  const rows = launcherRows(catalog, extras(), () => true), listed = ids(rows);
  assert.deepEqual(listed.slice(0, 2), ['vertices', 'bones']);
  for (const absent of ['launcher', 'forge:shape:add', 'paint:draw', 'someButton']) assert.ok(!listed.includes(absent), absent);
  assert.ok(LAUNCHER_EDITORS.includes('managers') && LAUNCHER_EDITORS.includes('showcase'));
});

test('the launcher applies the same enabled rule to every row', () => {
  const blocked = new Set(['bones', 'weld', 'toolbar:hidden', 'convertVersion']);
  const listed = ids(launcherRows(catalog, extras(), id => !blocked.has(id)));
  for (const id of blocked) assert.ok(!listed.includes(id), id);
  assert.ok(listed.includes('vertices'));
});

test('extra rows carry the audit list and show their current state', () => {
  const rows = extras(), byId = Object.fromEntries(rows.map(row => [row.id, row]));
  assert.equal(byId['toolbar:trim'].checked, true);
  assert.equal(byId['toolbar:graphic'].checked, false);
  assert.equal(byId.smoothEdges.checked, true);
  assert.equal(byId.showHotkeys.checked, false);
  assert.equal(byId.convertVersion.label, 'Convert to MDX1000');
  assert.equal(extras({ modelVersion: 1000 }).find(row => row.id === 'convertVersion').label, 'Convert to MDX800');
  assert.equal(byId.grid.checked, true);
  assert.equal(byId.grid.label, 'Display');
  assert.equal(byId.clearDisplay.label, 'Clear display');
  assert.ok(byId.learnSettings && byId['ai:open']);
  assert.equal(byId['language:en'].searchOnly, true);
  assert.equal(byId['team:#ff0303'].checked, true);
  assert.equal(byId['team:#ff0303'].searchOnly, true);
});

test('extra rows follow VIS and editors that have no view menu', () => {
  const vis = ids(extras({ visUI: true }));
  assert.ok(!vis.some(id => id.startsWith('toolbar:') || id === 'ai:open'));
  const managers = ids(extras({ displayMode: 'manager' }));
  assert.ok(!managers.includes('grid') && !managers.includes('clearDisplay'));
});

test('an empty search hides the long choice lists, typing finds them', () => {
  const rows = launcherRows(catalog, extras(), () => true);
  assert.ok(!ids(filterLauncherRows(rows, '')).some(id => id.startsWith('language:') || id.startsWith('team:')));
  assert.deepEqual(ids(filterLauncherRows(rows, 'team red')), ['team:#ff0303']);
  assert.deepEqual(ids(filterLauncherRows(rows, 'language deutsch')), ['language:de']);
  assert.deepEqual(ids(filterLauncherRows(rows, '  TOOLBAR   trim ')), ['toolbar:trim']);
  assert.deepEqual(filterLauncherRows(rows, 'zzzz'), []);
});

test('names that start with the search come first, and translated names match too', () => {
  const rows = [{ id: 'a', label: 'Reverse normals' }, { id: 'b', label: 'Average normals' }, { id: 'c', label: 'Normals overlay' }];
  assert.deepEqual(ids(filterLauncherRows(rows, 'normals')), ['c', 'a', 'b']);
  const german = text => ({ 'Normals overlay': 'Normalen' }[text] || text);
  assert.deepEqual(ids(filterLauncherRows(rows, 'normalen', german)), ['c']);
  assert.deepEqual(ids(filterLauncherRows(rows, 'overlay', german)), ['c'], 'the English name still works');
});

test('the launcher draws nothing until asked and keeps to theme colours', () => {
  assert.match(app, /const \[launcherQuery, setLauncherQuery\] = useState\(null\);/);
  assert.match(app, /\{launcherQuery !== null && <CommandLauncher /);
  const component = read('app/CommandLauncher.jsx');
  assert.match(component, /placeholder="Search commands"/);
  assert.match(component, /data-hotkey-window="" data-hotkey-scope="launcher"/);
  assert.match(component, /useDismiss\(true, \[panel\], onClose, \{ claimEscape: true/);
  assert.doesNotMatch(component, /aria-modal/);
  for (const [selector, body] of rules(launcherCss)) assert.doesNotMatch(body.replaceAll(/#0000[0-9a-f]{4}/gi, ''), /#[0-9a-f]{3,8}\b/i, selector);
});

// Contrast, computed from the theme tokens the rules above use.
const channel = value => { const scaled = value / 255; return scaled <= .04045 ? scaled / 12.92 : ((scaled + .055) / 1.055) ** 2.4; };
const rgb = hex => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
const luminance = color => color.reduce((sum, value, index) => sum + channel(value) * [.2126, .7152, .0722][index], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
const mix = (a, amount, b) => a.map((value, index) => value * amount + b[index] * (1 - amount));

test('every label meets 4.5:1 on every background it is drawn on, in every theme', t => {
  const failures = [];
  for (const [id, theme] of Object.entries(APPLICATION_THEMES)) {
    const c = Object.fromEntries(Object.entries(theme.colors).map(([name, value]) => [name, rgb(value)]));
    const soft = mix(c.text, .05, c.panel);
    const pairs = {
      'Trim editor label': [c.text, c.panel], 'Trim dock label': [c.text, soft], 'Trim hover': [c.text, c.hover], 'Trim active': [c.text, c.field],
      'Trim quick display': [c.muted, soft], 'Trim input read-out': [c.muted, soft],
      'Hidden status': [c.muted, c.panel], 'Hidden status hover': [c.text, c.hover],
      'Launcher row': [c.text, c.panel], 'Launcher key': [c.muted, c.panel], 'Launcher query': [c.text, c.field], 'Launcher placeholder': [c.muted, c.field], 'Launcher selected row': [c['selected-text'], c.selected],
    };
    const values = Object.entries(pairs).map(([name, [text, background]]) => [name, contrast(text, background)]);
    for (const [name, value] of values) if (value < 4.5) failures.push(`${theme.name}: ${name} ${value.toFixed(2)}`);
    const worst = values.reduce((low, row) => row[1] < low[1] ? row : low);
    t.diagnostic(`${theme.name} (${id}): lowest ${worst[1].toFixed(2)}:1, ${worst[0]}`);
  }
  assert.deepEqual(failures, []);
});

test('hovering a muted label brings it to the text colour, since muted on hover is too faint in some themes', () => {
  const trim = toolbarRules.filter(([selector]) => selector.includes('=trim'));
  assert.ok(trim.some(([selector, body]) => /label:hover/.test(selector) && /color:var\(--ui-text\)/.test(body)));
  assert.ok(trim.some(([selector, body]) => /quick-display-options>button:hover/.test(selector) && /color:var\(--ui-text\)/.test(body)));
  assert.ok(trim.some(([selector, body]) => /compact-input-strength>span:hover/.test(selector) && /color:var\(--ui-text\)/.test(body)));
});
