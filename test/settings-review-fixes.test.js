// The Settings review's interface fixes that live in markup and stylesheets. Real clicks and layout are covered by the packaged settings-layout run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8').replaceAll('\r', '');
const settings = read('app/Settings.jsx'), css = read('app/settings.css'), controls = read('app/settings/controls.jsx'), rotation = read('app/settings/RotationSettings.jsx'), uv = read('app/settings/UVDragSettings.jsx');

test('a control carries its own tip, so hovering it shows the tip above the Hotkey line', () => {
  assert.match(controls, /<input data-hotkey=\{id\} aria-label=\{label\} title=\{title\}/);
  assert.match(controls, /<select aria-label=\{aria\} data-hotkey=\{id\} title=\{tip\}/);
  assert.match(controls, /label=\{label\} title=\{tip\} value=\{checked\}/);
  assert.match(rotation, /label=\{row\.label\} title=\{row\.tip\}/);
  assert.match(rotation, /<SettingsNumberInput aria-label=\{aria\} title=\{row\.tip\}/);
  assert.match(rotation, /<select aria-label=\{aria\} title=\{row\.tip\}/);
  assert.match(read('app/Fields.jsx'), /aria-label=\{description\?undefined:label\} title=\{title\} type="checkbox"/);
  // Hotkeys builds "tip + Hotkey: X" from whatever title the control already has.
  assert.match(read('app/Hotkeys.jsx'), /if \(currentTitle !== element\.getAttribute\('data-hotkey-tooltip'\)\) element\.setAttribute\('data-hotkey-base-title', currentTitle\)/);
});

test('UV snap rows name the bound key, say when to press it, and leave with their key', () => {
  assert.match(uv, /snap = modifierLabel\('drag\.uv\.snap', preferences\)/);
  assert.match(uv, /\{snap && <SettingsSelect id="mouse:uv-rotate-snap" label=\{`Angle snap \(hold \$\{snap\} after the drag starts\)`\}/);
  assert.match(uv, /\{snap && <SettingsSelect id="mouse:uv-zoom-snap" label=\{`Size snap \(hold \$\{snap\} after the drag starts\)`\}/);
  assert.doesNotMatch(uv, /hold Ctrl|Ctrl is held/);
  assert.match(settings, /uvStartFine = modifierLabel\('drag\.uv\.pressFine', prefs\)/);
  assert.match(settings, /\{uvStartFine && <p className="settings-hint">\{`For fine control, hold \$\{uvStartFine\}/);
  assert.doesNotMatch(settings, /hold Alt when starting/);
  assert.match(settings, /<UVDragSettings value=\{normalizeUVDrag\(prefs\.uvDrag\)\} preferences=\{prefs\}/);
});

test('the Toolbar setting reads the real key, hints only for Hidden and steps aside in VIS', () => {
  assert.match(settings, /launcherKey = bindings\.launcher\?\.\[0\] \? formatChord\(bindings\.launcher\[0\]\) : ''/);
  assert.doesNotMatch(settings, /Ctrl\+F2/);
  assert.match(settings, /\{prefs\.toolbarMode === 'hidden' && !visUI && launcherKey && <p className="settings-hint">/);
  assert.match(settings, /tip=\{visUI \? 'VIS has its own toolbar layout\.' : toolbarModeTip\(prefs\.toolbarMode, launcherKey\)\} disabled=\{visUI\}/);
  assert.match(read('app/AppDialogs.jsx'), /<Settings visUI=\{visUI\}/);
});

test('the sticky preview follows the measured bar, and nothing shows through above the strip', () => {
  assert.match(settings, /split\.current\.style\.setProperty\('--settings-bar-height', `\$\{barBox\.current\.offsetHeight\}px`\)/);
  assert.match(settings, /new ResizeObserver\(measure\)/);
  assert.match(css, /\.settings-preset-bar~\.settings-preview\{top:calc\(var\(--settings-bar-height,50px\) \+ 12px\)\}/);
  assert.doesNotMatch(css, /top:62px|top:100px/, 'no guessed bar heights');
  const narrow = css.slice(css.indexOf('@media(max-width:899px)'), css.indexOf('/* Short windows'));
  assert.match(narrow, /\.settings-preview\{order:1;z-index:1;top:0;margin:-12px 0 12px;padding-top:12px;background:var\(--ui-panel\)\}/);
  assert.match(narrow, /\.settings-preset-bar~\.settings-preview\{top:var\(--settings-bar-height,50px\)\}/);
  assert.doesNotMatch(/\.settings-rotation-option\{[^}]*\}/.exec(css)[0], /nowrap/, 'long words wrap instead of scrolling the page sideways');
});

test('clash text uses the theme, readable on every palette', () => {
  assert.match(css, /\.hotkeys-conflict\{color:var\(--ui-text\)/);
  assert.doesNotMatch(/\.hotkeys-conflict\{[^}]*\}/.exec(css)[0], /#[0-9a-f]{3,8}/i);
});

test('the Classic and Orbit buttons keep Custom the way the bar does', () => {
  assert.match(settings, /data-hotkey="mouse:preset:classic" onClick=\{\(\) => pickPreset\('mouse', prefs, 'classic', commit, setMessage\)\}/);
  assert.match(settings, /data-hotkey="mouse:preset:orbit" onClick=\{\(\) => pickPreset\('mouse', prefs, 'orbit', commit, setMessage\)\}/);
  const bar = read('app/PresetBar.jsx');
  assert.match(bar, /export function pickPreset\(domain, preferences, id, commit, say, requestConfirmation\) \{/);
  assert.match(bar, /pickPreset\(domain, preferences, id, commit, say, requested => \{ setNaming\(false\); setConfirming\(requested\); \}\);/, 'the select goes the same way');
  assert.match(bar, /=== CUSTOM_PRESET\) unsavedCustom\.set\(domain, captureCustom\(domain, preferences\)\)/);
});

test('AnimXL asks about edits made in this window only', () => {
  const anim = read('app/AnimXL.jsx');
  assert.match(anim, /opened\.current \?\?= JSON\.stringify\(settings\)/);
  assert.match(anim, /opened\.current = JSON\.stringify\(next\)/, 'another animation starts its own count');
  assert.match(anim, /edited = useMemo\(\(\) => JSON\.stringify\(settings\) !== opened\.current, \[settings\]\)/);
  assert.match(anim, /unapplied=\{edited && !!result\?\.tracks\.length && !doc\.readOnly\}/);
});

test('every window that asks before closing compares with how it opened', () => {
  // Each of these is empty or equal to its starting value in a window nobody has touched.
  assert.match(read('app/Attachemator.jsx'), /Object\.keys\(pivots\.current\)\.length > 0 \|\| Object\.keys\(parents\)\.length > 0 \|\| \[\.\.\.chosen\]\.sort\(\)\.join\(\) !== startingTicks/);
  assert.match(read('app/AutoCorpse.jsx'), /changed = size !== 100 \|\| height !== 100 \|\| rgb\.join\(\) !== '255,255,255' \|\| pieces \|\| blood/);
  assert.match(read('app/Forge.jsx'), /data-hotkey-unapplied=\{undoCount > 0 \|\| shapesDirty \? '' : undefined\}/);
  assert.match(read('app/ShapingDialog.jsx'), /unapplied = history\.length > 0 \|\| settingsNow !== startingSettings/);
  assert.match(read('app/SortMyMess.jsx'), /selected = groups\.filter\(item => decisionChanges\(decisions\.get\(item\.key\)\)\)/);
  assert.match(read('app/SurfaceEffects.jsx'), /unapplied=\[\.\.\.drafts\.current\]\.some\(\(\[index,draft\]\)=>JSON\.stringify\(draft\)!==baselines\.current\.get\(index\)\)/);
});

test('the UV Each piece toggle takes no default key', () => {
  assert.match(read('app/UVWorkspace.jsx'), /data-hotkey="uv:each-piece" data-hotkey-manual data-hotkey-label="Each piece" data-hotkey-category="UV"/);
});
