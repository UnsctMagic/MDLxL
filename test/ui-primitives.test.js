import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

// The shared field hooks run against a tiny hook runner: each render() calls the
// hook again with the kept state, then runs the effects whose inputs changed.
async function bundle(file) {
  const result = await build({ entryPoints: [new URL('../app/' + file, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty', '.js': 'jsx' }, jsx: 'automatic', logLevel: 'silent' });
  return result.outputFiles[0].text;
}
function load(text, react = React) {
  const module = { exports: {} }, require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', text)(id => id === 'react' ? react : require(id), module, module.exports);
  return module.exports;
}
function hookRunner() {
  const states = [], refs = [], effects = [];
  let state = 0, ref = 0, effect = 0, queued = [];
  const react = {
    ...React,
    useState: initial => { const index = state++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
    useRef: initial => { const index = ref++; return refs[index] ??= { current: initial }; },
    useEffect: (run, deps) => { const index = effect++, old = effects[index]; if (!old || !deps || deps.some((value, i) => !Object.is(value, old[i]))) queued.push(run); effects[index] = deps; },
  };
  react.useLayoutEffect = react.useEffect;
  react.useCallback = run => run;
  return { react, render(hook, props) { state = ref = effect = 0; queued = []; const result = hook(props); queued.forEach(run => run()); return result; } };
}
const fieldsSource = await bundle('Fields.jsx');
const input = (value = '') => ({ value, blur() { this.onBlur?.({ currentTarget: this }); } });
function draftField(props) {
  const runner = hookRunner(), { useDraftNumber } = load(fieldsSource, runner.react);
  let current = props, field = runner.render(useDraftNumber, current);
  const element = input();
  const rerender = next => { current = { ...current, ...next }; field = runner.render(useDraftNumber, current); element.onBlur = field.onBlur; return field; };
  return {
    get field() { return runner.render(useDraftNumber, current); },
    rerender,
    type(text) { element.value = text; field.onFocus(); field.onChange({ target: element }); element.onBlur = field.onBlur; },
    key(key) { element.onBlur = field.onBlur; field.onKeyDown({ key, currentTarget: element }); },
    blur() { field.onBlur({ currentTarget: element }); },
  };
}

test('a typed number commits once on Enter, not again when Enter leaves the box', () => {
  const commits = [], box = draftField({ value: 2, onCommit: value => commits.push(value) });
  box.type('5'); box.key('Enter');
  assert.deepEqual(commits, [5]);
  assert.equal(box.field.value, 5);
  box.rerender({ value: 5 });
  box.type('6'); box.blur();
  assert.deepEqual(commits, [5, 6]);
});

test('Escape puts the value back without committing; invalid text is refused', () => {
  const commits = [], box = draftField({ value: 2, onCommit: value => commits.push(value) });
  box.type('7'); box.key('Escape');
  assert.equal(box.field.value, 2);
  box.type('abc'); box.blur();
  assert.equal(box.field.value, 2);
  box.type('   '); box.blur();
  assert.deepEqual(commits, []);
});

test('leaving the box commits; an unchanged number is not committed', () => {
  const commits = [], format = value => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '0';
  const box = draftField({ value: 1.000001, format, onCommit: value => commits.push(value) });
  assert.equal(box.field.value, '1');
  box.type('1'); box.blur();
  assert.deepEqual(commits, []);
  box.type('3.25'); box.blur();
  assert.deepEqual(commits, [3.25]);
});

test('a refused commit shows the value again, also when refused later', async () => {
  const box = draftField({ value: 4, onCommit: () => false });
  box.type('9'); box.key('Enter');
  assert.equal(box.field.value, 4);
  const later = draftField({ value: 4, onCommit: () => Promise.resolve(false) });
  later.type('9'); later.key('Enter');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(later.field.value, 4);
});

test('a live number commits each valid keystroke and clamps when the box is left', () => {
  const commits = [], parse = (text, final) => { const n = Number(text); if (!String(text).trim() || !Number.isFinite(n)) return undefined; return final ? Math.max(0, Math.min(100, n)) : n >= 0 && n <= 100 ? n : undefined; };
  const box = draftField({ value: 10, live: true, format: String, parse, onCommit: value => commits.push(value) });
  box.type('4'); box.type('48');
  assert.deepEqual(commits, [4, 48]);
  box.rerender({ value: 48 });
  box.type('480');
  assert.deepEqual(commits, [4, 48]);
  box.blur();
  assert.deepEqual(commits, [4, 48, 100]);
});

test('disabled fields never commit', () => {
  const commits = [], box = draftField({ value: 1, disabled: true, onCommit: value => commits.push(value) });
  box.type('2'); box.key('Enter');
  assert.deepEqual(commits, []);
  assert.equal(box.field.value, 1);
});

function rangeField(props) {
  const runner = hookRunner(), { useRangeCommit } = load(fieldsSource, runner.react);
  let current = props, range = runner.render(useRangeCommit, current);
  const listeners = {}, node = { addEventListener: (name, run) => { listeners[name] = run; }, removeEventListener: name => { delete listeners[name]; } };
  range.ref(node);
  return {
    get range() { return runner.render(useRangeCommit, current); },
    rerender(next) { current = { ...current, ...next }; range = runner.render(useRangeCommit, current); },
    move(value) { range.onChange({ target: { value: String(value) } }); },
    release() { listeners.change?.(); },
    key(key) { const event = { key, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }; range.onKeyDown(event); return event; },
    blur() { range.onBlur(); },
  };
}

test('a slider drag moves a draft and commits once on release', () => {
  const commits = [], drafts = [], slider = rangeField({ value: 10, onCommit: value => commits.push(value), onDraft: value => drafts.push(value) });
  slider.move(20); slider.move(35);
  assert.equal(slider.range.value, 35);
  assert.deepEqual(commits, []);
  slider.release();
  assert.deepEqual(commits, [35]);
  assert.deepEqual(drafts, [20, 35, null]);
  slider.release(); slider.blur();
  assert.deepEqual(commits, [35]);
});

test('Escape drops a slider draft without committing and keeps the key from closing the window', () => {
  const commits = [], slider = rangeField({ value: 10, onCommit: value => commits.push(value) });
  slider.move(50);
  const escape = slider.key('Escape');
  assert.equal(escape.stopped, true);
  assert.equal(slider.range.value, 10);
  slider.release();
  assert.deepEqual(commits, []);
  assert.equal(slider.key('Escape').stopped, false, 'without a drag Escape still reaches the window');
});

test('a slider released at its old value commits nothing; leaving it commits the drag', () => {
  const commits = [], slider = rangeField({ value: 10, onCommit: value => commits.push(value) });
  slider.move(10); slider.release();
  assert.deepEqual(commits, []);
  slider.move(12); slider.blur();
  assert.deepEqual(commits, [12]);
});
test('every slider wrapper draws the one shared slider look', () => {
  const { RangeField } = load(fieldsSource);
  const html = renderToStaticMarkup(React.createElement(RangeField, { className: 'ax-slider', label: 'Weight', output: 40, ends: ['Light', 'Heavy'], min: 0, max: 100, value: 40, onChange() {} }));
  assert.match(html, /^<label class="range-field ax-slider"><span class="range-field-head"><span>Weight<\/span><output>40<\/output><\/span><input class="range-input" type="range"[^>]*aria-label="Weight"/);
  assert.match(html, /<span class="range-field-ends"><span>Light<\/span><span>Heavy<\/span><\/span><\/label>$/);
  const bare = renderToStaticMarkup(React.createElement(RangeField, { 'aria-label': 'Speed', min: 1, max: 300, value: 100, onCommit() {} }));
  assert.doesNotMatch(bare, /range-field-head/, 'a slider without label or value has no top row');
  const source = name => readFileSync(new URL('../app/' + name, import.meta.url), 'utf8');
  for (const file of ['AnimXL.jsx', 'AutoCorpse.jsx', 'ShowcaseWorkspace.jsx', 'PaintStudioLayout.jsx', 'ParticleRibbonFields.jsx', 'AnimationController.jsx']) assert.match(source(file), /<RangeField /, file + ' uses the shared slider');
  for (const file of ['ParticleCluelessControls.jsx', 'MeshDensitySlider.jsx']) assert.match(source(file), /className="range-input" [^>]*type="range"/, file + ' adopts the shared look');
  // The wrappers no longer style their own slider.
  assert.doesNotMatch(source('anim-xl.css') + source('auto-corpse.css'), /\.ax-slider|\.ax-ends/);
  assert.doesNotMatch(source('showcase.css'), /\.showcase-slider (input|output)|\.showcase-dialog input\[type=range\]/);
  assert.doesNotMatch(source('paint-studio.css'), /\.studio-slider\{|\.studio-slider input\[type=range\]/);
  assert.doesNotMatch(source('mesh-density.css') + source('particle-editor.css') + source('AnimationController.css'), /accent-color:#dfa94c|ribbon-box-row input\[type=range\]|ac-actual-speed input\[type=range\]/);
  assert.match(source('styles.css'), /\.range-field\.range-field\{/);
  assert.match(source('theme.css'), /input\[type=range\]\.range-input\{accent-color:var\(--ui-accent\)\}/);
});