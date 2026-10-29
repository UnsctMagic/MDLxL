import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=file=>readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
const claimOf=file=>{const match=source(file).match(/useWindowKeyClaim\(\(\{event\}\)\s*=>\{([\s\S]*?)\},\s*(\d+)\)/);assert.ok(match,file+' must claim before window dismissal');return {body:match[1],priority:Number(match[2])};};

test('Glow Up cancels only an active drag before the Particle Editor can dismiss it',()=>{
  const glow=source('GlowStageTools.jsx'),claim=claimOf('GlowStageTools.jsx'),hotkeys=source('Hotkeys.jsx');
  const windowPriority=Number(hotkeys.match(/useWindowKeyClaim\(handler, priority = (\d+)/)[1]);
  assert.match(claim.body,/event\.key\s*!==\s*'Escape'\s*\|\|\s*!drag\.current/);
  assert.match(claim.body,/abort\(\);return true/);
  assert.ok(claim.priority<windowPriority,'drag rollback must run before the window claim');
  for(const menu of ['AppToolbar.jsx','MovementControllerRecomp.jsx'])assert.ok(Number(source(menu).match(/escapePriority:\s*(-?\d+)/)[1])<claim.priority,'existing menus keep first refusal');
  assert.ok(glow.indexOf('useWindowKeyClaim(')<glow.indexOf('if(!marks||!layout)return null'),'the hook must also run while the preview is loading');
  assert.match(glow,/function abort\(\)[^\n]*set\(d\.before\);onDrag\?\.\(false\)/);
  const keydown=hotkeys.slice(hotkeys.indexOf('const keydown = event =>'));
  assert.ok(keydown.indexOf("'mdlxl-escape-key'")<keydown.indexOf("'mdlxl-window-key'"),'AI drawing tools keep first refusal');
  assert.ok(keydown.indexOf('claims.sort')<keydown.indexOf('if (chord) runShortcut'),'claims must settle before Close dispatch');
});

test('emitter and placement handle drags claim before their containing panel',()=>{
  for(const file of ['ParticleStageTools.jsx','ParticlePlacementStage.jsx']){
    const claim=claimOf(file);assert.equal(claim.priority,0,file);assert.match(claim.body,/!drag\.current/);assert.match(claim.body,/abort\(\);return true/);
  }
  assert.match(source('ParticlePlacementStage.jsx'),/if\(drag\.current\)onPosition\(drag\.current\.position\)/);
});

test('UV, Movement and Forge expose their existing drag rollback to the window-key claims',()=>{
  const uv=source('UVEditor.jsx');assert.match(uv,/claims\.push\(\{ priority: 0,[^\n]*cancelGesture\(\); return true/);
  assert.match(uv,/removeEventListener\('mdlxl-window-key', nudgeKey\)/);assert.doesNotMatch(uv,/mdlxl-uv-key/);
  for(const file of ['GamePreview.jsx','Viewport.jsx']){
    const text=source(file);assert.match(text,/claims\.push\(\{priority:0/);assert.match(text,/addEventListener\('mdlxl-window-key',claimWindowKey\)/);assert.match(text,/removeEventListener\('mdlxl-window-key',claimWindowKey\)/);
  }
  assert.match(source('GamePreview.jsx'),/cancelPreviewCommand\(claim\);return true/);
  assert.match(source('Viewport.jsx'),/run:\(\)=>cancelCommand\(claim\)/);
  assert.match(source('PaintCutoutEditor.jsx'),/cancelDrag\(\);return true/,'cut-out already owns Escape before its Close');
});
