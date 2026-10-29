import test from 'node:test';
import assert from 'node:assert/strict';
import { hotkeyHint } from '../src/hotkey-badge.js';

test('readable hints keep every modifier and physical key', () => {
  for (const [chord, label] of [
    ['Ctrl+J', 'Ctrl+J'], ['Shift+K', 'Shift+K'], ['Alt+M', 'Alt+M'],
    ['Shift+Home', 'Shift+Home'], ['Ctrl+F12', 'Ctrl+F12'],
    ['Ctrl+Shift+Delete', 'Ctrl+Shift+DEL'], ['Alt+ArrowLeft', 'Alt+←'],
    ['Backspace', 'Backspace'], ['Ctrl+Alt+Space > ABC', 'Ctrl+Alt+Space > ABC'],
  ]) assert.equal(hotkeyHint(chord), label);
  assert.equal(hotkeyHint(undefined), '');
});

// Embedded tools inherit the actual owning window's close control.
const closeOwners = {
  AnimXL:'ToolWindow', ParticleEditor:'ToolWindow', Attachemator:'ToolWindow', SortMyMess:'ToolWindow',
  Forge:'Forge', BitsAndParts:'BitsAndParts', TextureLibrary:'TextureLibrary', OptimizeXL:'OptimizeXL',
  ShowcaseWorkspace:'Dialog', PaintWorkspace:'PaintCutoutEditor', GameFileBrowser:'TextureLibrary',
  NodeEventEditor:'ToolWindow', GlowUpControls:'GlowUpControls', PortraitSetup:'Dialog',
  EmitterTextDialog:'Dialog', Addons:'Addons', NormalizerControls:'NormalizerControls',
};

test('every audited tool has an allocated Close action and a real close control', async () => {
  const {readFileSync}=await import('node:fs');
  const {contextualHotkeyDefaults}=await import('../src/hotkey-defaults.js');
  for(const [window,owner] of Object.entries(closeOwners)) {
    const source=readFileSync(new URL('../app/'+owner+'.jsx',import.meta.url),'utf8');
    assert.match(source,/data-hotkey="close"/,window+' closes through '+owner);
    const [action]=contextualHotkeyDefaults([{id:window+':close',label:'Close '+window,scope:window,group:window,contextual:true}]);
    assert.deepEqual(action.defaultKeys,['Escape'],window);
  }
  for(const window of ['AnimXL','ParticleEditor','Attachemator','SortMyMess'])assert.match(readFileSync(new URL('../app/'+window+'.jsx',import.meta.url),'utf8'),/<ToolWindow/);
  for(const window of ['PortraitSetup','EmitterTextDialog'])assert.match(readFileSync(new URL('../app/'+window+'.jsx',import.meta.url),'utf8'),/<Dialog/);
  assert.match(readFileSync(new URL('../app/TextureLibrary.jsx',import.meta.url),'utf8'),/<GameFileBrowser/);
  assert.match(readFileSync(new URL('../app/ResourceEditors.jsx',import.meta.url),'utf8'),/<NodeEventEditor/);
});

test('AnimXL and Showcase playback buttons carry their window catalog identities', async () => {
  const {readFileSync}=await import('node:fs');
  for(const [window,scope]of [['AnimXL','animxl'],['ShowcaseWorkspace','showcase']]){
    const source=readFileSync(new URL('../app/'+window+'.jsx',import.meta.url),'utf8');
    assert.ok(source.includes('data-hotkey="'+scope+':play"'));
    assert.match(source,/windowCommandActions/);
    assert.match(source,/undo:.*redo:/);
  }
  assert.match(readFileSync(new URL('../app/AnimXL.jsx',import.meta.url),'utf8'),/data-hotkey="animxl:undo"/);
});

test('Forge main Close keeps a prefix without changing shape-control identities',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../app/Forge.jsx',import.meta.url),'utf8');
  assert.match(source,/<header data-hotkey-prefix="forge-main">/);
  assert.doesNotMatch(source,/<section[^>]*data-hotkey-prefix="forge-main"/);
  assert.match(source,/sourceMode === 'image'\);/);
});

test('resource-manager history buttons use the same scoped actions as keyboard history',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../app/ResourceEditors.jsx',import.meta.url),'utf8');
  assert.match(source,/data-hotkey=\{historyScope \+ ':undo'\} data-hotkey-absolute aria-label="Undo manager edit"/);
  assert.match(source,/data-hotkey=\{historyScope \+ ':redo'\} data-hotkey-absolute aria-label="Redo manager edit"/);
  assert.match(source,/useWindowHotkeys\(historyScope/);
});
