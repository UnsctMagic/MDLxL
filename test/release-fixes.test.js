import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tabs = readFileSync(new URL('../app/ModelTabs.jsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../app/GamePreview.jsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../app/Settings.jsx', import.meta.url), 'utf8');

test('a long tab name split into two flex pieces still reads as one name', () => {
  assert.match(tabs, /name\.slice\(0, -8\)/, 'long names are still split to keep the extension visible');
  assert.match(tabs, /role="tab" aria-selected=\{item === session\} aria-label=\{item\.doc\.name\}/);
});

test('the preview render loop never appends to a host React has already cleared', () => {
  assert.match(preview, /const hostElement = host\.current;/);
  assert.equal((preview.match(/host\.current\.appendChild/g) || []).length, 0);
  assert.ok((preview.match(/hostElement\.appendChild/g) || []).length >= 10);
});

test('double-clicking overlapping emitters keeps cycling after the first click selected a bone', () => {
  assert.match(preview, /const from=hits\.some\(h=>h\.owner===p\.particleSelectedId\)\?p\.particleSelectedId:lastPickedParticle/);
  assert.match(preview, /lastPickedParticle=hits\[\(current\+1\)%hits\.length\]\.owner;p\.onParticlePick\(lastPickedParticle,/);
});

test('a fresh configuration export imports again; real shortcut clashes are still refused', async () => {
  const { COMMANDS } = await import('../src/commands.js');
  const { configurationHotkeyConflict, effectiveBindings } = await import('../src/preferences.js');
  const { exportConfiguration, importConfiguration } = await import('../src/portable-settings.js');
  const { normalizePreferences } = await import('../src/preferences.js');
  const imported = importConfiguration(JSON.stringify(exportConfiguration(normalizePreferences({}))));
  assert.equal(configurationHotkeyConflict(COMMANDS, imported.hotkeys), null, 'Forge shape keys may share letters with editor commands');
  const editor = COMMANDS.filter(action => action.scope !== 'forge-shapes' && (effectiveBindings(COMMANDS, {})[action.id] || []).length);
  const [first, second] = editor, key = effectiveBindings(COMMANDS, {})[first.id][0];
  assert.equal(configurationHotkeyConflict(COMMANDS, { [second.id]: [key] }), key, 'two editor commands on one key still conflict');
  assert.match(settings, /const conflict=configurationHotkeyConflict\(catalog,next\.hotkeys\);if\(conflict\)throw new Error\('Conflicting shortcut '\+conflict\+'\.'\);/);
});

test('an update reply never overwrites a newer status broadcast', () => {
  const updates = readFileSync(new URL('../app/useUpdates.js', import.meta.url), 'utf8');
  assert.match(updates, /const reply = async request => \{ const seen = broadcasts\.current, value = await request\(\); if \(broadcasts\.current === seen\) setStatus\(value\); return value; \};/);
  assert.match(updates, /received = true; broadcasts\.current\+\+; setStatus\(value\);/);
  for (const call of ['checkUpdates', 'installUpdate', 'revertUpdate']) assert.ok(updates.includes(`reply(() => window.desktop.${call}())`), call);
});

test('selected manager rows keep readable secondary labels', () => {
  const css = readFileSync(new URL('../app/resource-managers-xl.css', import.meta.url), 'utf8');
  assert.match(css, /:root\[data-theme\] \.resource-editor\.re-xl \.re-list :is\(button,\.re-tree-row\)\.re-selected small\{color:var\(--tree-selected-text\)\}/);
});

test('an imported part is selected in the same step as its import, so one Undo removes both', () => {
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const body = app.slice(app.indexOf('async function importPart('), app.indexOf("say(replacement?'Part replaced"));
  assert.ok(body.indexOf('setSelection(') < body.indexOf('await loadTextures('), 'selection updates happen before waiting for textures');
});
