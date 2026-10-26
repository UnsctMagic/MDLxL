import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app/AppToolbar.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../app/modules.css',import.meta.url),'utf8');
const look=readFileSync(new URL('../app/new-look.css',import.meta.url),'utf8');
const ai=readFileSync(new URL('../app/AiAssistant.jsx',import.meta.url),'utf8');

test('every module icon keeps its action and carries a visible short label',()=>{
  for(const [action,className,label] of [
    ['textureLibrary','library-tool','LIBR'],
    ['forge','forge-tool','FRG'],
    ['bitsAndParts','bits-tool','BITZ'],
    ['optimizeModel','optimizer-tool','OPXL'],
    ['animXL','animxl-tool','ANIM'],
    ['shredder','learner-tool','LER'],
  ]){
    assert.match(app,new RegExp(`action="${action}" className="${className}"[^>]*badge="${label}"`));
  }
  assert.ok(app.includes('action="particles" className="emitter-tool" icon="btn-mana-flare" badge={<><b>E</b><b>M</b><b>T</b><b>R</b></>}'));
  assert.match(app,/className="pressed-keys-tool" data-hotkey="pressedKeys"/);
  assert.match(app,/<b>K<\/b><b>E<\/b><b>Y<\/b>/);
  assert.match(app,/className="vis-toggle"[^>]*badge=\{visUI \? 'XL' : 'VIS'\}/);
});

test('classic (VIS) labels keep their transparent, distinct high-contrast colors',()=>{
  assert.match(css,/\.classic-modules \.library-tool \.module-icon-badge\{color:#ffc928\}/);
  assert.match(css,/\.classic-modules \.forge-tool \.module-icon-badge\{color:#54c8ff\}/);
  assert.match(css,/\.classic-modules \.bits-tool \.module-icon-badge\{color:#f0f3f5\}/);
  assert.match(css,/\.classic-modules \.optimizer-tool \.module-icon-badge\{color:#72ef66\}/);
  assert.match(css,/\.classic-modules \.pressed-keys-tool>span,\.classic-modules \.module-icon-badge\{[^}]*background:transparent/);
});

test('the AI button is the first dock icon: Illidan Metamorphosis with an AI label',()=>{
  assert.match(app,/<div className="classic-toolbar-group toolbar-modules">\{aiControl\}<Tool action="textureLibrary"/);
  assert.equal(app.match(/\{aiControl\}/g).length,1,'the top-row AI text button is gone');
  assert.match(ai,/className="classic-tool ai-open ai-tool"/);
  assert.match(ai,/src="\.\/classic\/btn-metamorphosis\.png"/);
});

test('new-look dock labels: one style like FRG/OPXL, one colour each, only with VIS off',()=>{
  const P=':root .classic-app.classic-app:not([data-vis-ui])>.classic-toolbar>.toolbar-modules>';
  assert.ok(look.includes(P+'button>:is(.module-icon-badge,span:not(.hotkey-badge)){position:absolute;display:flex;align-items:center;justify-content:center;background:transparent;top:auto!important;left:1px!important;right:1px!important;bottom:1px!important;height:50%!important;font:900 10px/1 Tahoma,Arial,sans-serif!important'));
  assert.ok(look.includes('text-shadow:-1px -1px #000,1px -1px #000,-1px 1px #000,1px 1px #000'));
  for(const [selector,color] of [
    ['.ai-tool .module-icon-badge','#d0a8ff'],
    ['.library-tool .module-icon-badge','#ffd06a'],
    ['.forge-tool .module-icon-badge','#78c6ff'],
    ['.bits-tool .module-icon-badge','#f1ebe0'],
    ['.optimizer-tool .module-icon-badge','#93e08a'],
    ['.emitter-tool .module-icon-badge','#66ded0'],
    ['.animxl-tool .module-icon-badge','#ff8b7b'],
    ['.pressed-keys-tool>span:not(.hotkey-badge)','#ffb062'],
    ['.learner-tool .module-icon-badge','#ffd06a'],
    ['.vis-toggle>.module-icon-badge','#ff9ad5'],
  ])assert.ok(look.includes(`${P}${selector}{color:${color}!important}`),selector);
  assert.ok(look.includes(P+'button b{color:inherit!important}'),'EMTR and KEY letters share one colour');
  // Every new-look rule is scoped away from VIS.
  for(const rule of look.split('}').map(part=>part.trim()).filter(part=>part.startsWith(':root')))assert.match(rule,/:not\(\[data-vis-ui\]\)/);
});
