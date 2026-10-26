import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const bar=readFileSync(new URL('../app/AppToolbar.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/portrait-view.css',import.meta.url),'utf8');
const quick=readFileSync(new URL('../app/QuickDisplay.jsx',import.meta.url),'utf8');

test('Black is short and the display options remain visible',()=>{
  assert.match(bar,/row.index === null \? row.name :/);
  assert.doesNotMatch(bar,/Neutral Hostile/);
  assert.match(css,/\.classic-app>\.classic-toolbar\{flex-wrap:nowrap\}/);
  assert.match(css,/\.editor-modules \.quick-display\{[^}]*flex-wrap:nowrap/);
  assert.doesNotMatch(css,/quick-display\[data-expanded="true"\][^\n]*flex-wrap:wrap/);
  assert.match(css,/\.editor-modules \.quick-display-options label\{[^}]*font-size:9\.5px/);
  assert.match(quick,/\(vanilla\?VIS_VIEW_MENU:VIEW_MENU\)\[viewMode\]/);
  assert.match(quick,/>Clear<\/span><\/button>/);
  assert.ok(quick.indexOf('>Clear</span></button>') < quick.indexOf('(vanilla?VIS_VIEW_MENU:VIEW_MENU)[viewMode]'));
  assert.doesNotMatch(quick,/>Reveal<\/button>|>Textured View<\/button>/);
});

test('Vis is a reversible presentation toggle, not a model or editing command',()=>{
  assert.match(app,/\[visUI, setVisUI\] = useState\(false\)/);
  assert.match(app,/data-vis-ui=\{visUI \|\| undefined\}/);
  assert.match(bar,/<Tool className="vis-toggle".*?badge=\{visUI \? 'XL' : 'VIS'\}.*?onClick=\{\(\) => setVisUI\(value => !value\)\}/);
  const group=bar.match(/<div className="classic-toolbar-group toolbar-visibility">(.*?)<\/div>/)[1];
  assert.doesNotMatch(group,/visUI/);
  assert.match(group,/onClick=\{hide\}/);
  assert.match(group,/onClick=\{\(\) => setHidden\(\{\}\)\}/);
  assert.match(css,/data-vis-ui\]>\.classic-modules/);
  assert.match(css,/data-vis-ui\]>\.classic-modules>:not\(\.toolbar-modules\):not\(\.editor-modules\)/);
  assert.match(css,/data-vis-ui\]>\.classic-modules>\.editor-modules>button/);
  assert.match(css,/data-vis-ui\]>\.classic-modules>\.editor-modules\{grid-row:1\/-1;align-self:center\}/);
  assert.doesNotMatch(css,/data-vis-ui\][^{}]*\.quick-display-options[^{}]*\{display:none\}/);
  assert.doesNotMatch(css,/data-vis-ui[^{}]*portrait-toolbar/);
});

test('quick display follows editor buttons; WC3 dock is above the full-width tabs',()=>{
  const toolbar=bar.slice(bar.indexOf('<div className="classic-toolbar">'),bar.indexOf('<div className="classic-modules"'));
  const editor=bar.slice(bar.indexOf('<div className="editor-modules"'),bar.indexOf('<div className="module-divider"'));
  assert.match(toolbar,/\{moduleDock\}/);
  assert.doesNotMatch(toolbar,/quickDisplay/);
  assert.doesNotMatch(editor,/RGB Preview|RGB preview animation/);
  assert.equal((bar.match(/<QuickDisplay/g)||[]).length,1);
  assert.doesNotMatch(app,/<QuickDisplay/);
  assert.doesNotMatch(app+bar,/className="module-hint"/);
  assert.doesNotMatch(toolbar,/<LanguageSwitch/);
  assert.match(toolbar,/\{visUI && inputStrength\}/);
  assert.match(app,/\{!visUI && inputStrength\}\{!visUI && <LanguageSwitch[^\n]+<\/div>/);
  assert.match(css,/team-picker select\{width:auto;min-width:0;max-width:none\}/);
});

test('module menu remains available with the custom module row hidden',()=>{
  const {buildMenuTemplate}=require('../electron/menu.cjs');
  const dispatched=[];
  const menu=buildMenuTemplate({},id=>dispatched.push(id)).find(entry=>entry.label==='Modules');
  for(const label of ['Movement','Animations: visibility and RGB'])menu.submenu.find(item=>item.label===label).click();
  assert.deepEqual(dispatched,['animation','animations']);
  assert.match(bar,/\['Modules', \[\['Vertices', 'vertices'\]/);
  assert.match(app,/mode === 'animation' && <PortraitToolbar/);
});
