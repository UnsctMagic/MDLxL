import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app/App.jsx',import.meta.url),'utf8');
const bar=readFileSync(new URL('../app/AppToolbar.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/portrait-view.css',import.meta.url),'utf8');

test('Quick Display moved from the top toolbar to the editor row after RGB controls',()=>{
  const top=bar.slice(bar.indexOf('<div className="classic-toolbar">'),bar.indexOf('<div className="classic-modules"'));
  const editor=bar.slice(bar.indexOf('<div className="editor-modules"'),bar.indexOf('<div className="module-divider"'));
  assert.doesNotMatch(top,/<QuickDisplay/);
  assert.ok(editor.indexOf('RGB preview animation')<editor.indexOf('<QuickDisplay'));
  assert.equal((bar.match(/<QuickDisplay/g)||[]).length,1);
  assert.doesNotMatch(app,/<QuickDisplay/);
  assert.match(css,/\.editor-modules \.quick-display\{[^}]*flex-wrap:nowrap/);
  assert.doesNotMatch(css,/\.classic-toolbar \.quick-display\{/);
});
