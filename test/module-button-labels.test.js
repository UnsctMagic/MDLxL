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

test('new-look dock follows docs/TOOLBAR-DOCK.md: one frame, one label style, one colour each, only with VIS off',()=>{
  const P=':root .classic-app.classic-app:not([data-vis-ui])>.classic-toolbar>.toolbar-modules>';
  assert.ok(look.includes(P+'button>:is(.module-icon-badge,span:not(.hotkey-badge)){position:absolute;display:flex;align-items:center;justify-content:center;background:transparent;top:auto!important;left:1px!important;right:1px!important;bottom:-1px!important;height:50%!important;font:700 10px/1 \'MDLxL Dock\',Tahoma,sans-serif!important'));
  assert.ok(look.includes("@font-face{font-family:'MDLxL Dock';src:url('/fonts/showcase/oxanium/font.ttf')"));
  assert.match(look,/>\.toolbar-modules>button\{[^}]*border:0!important;[^}]*background:transparent!important;box-shadow:none!important/);
  assert.match(look,/button:not\(\.toolbar-modules>button\)\{border:1px solid transparent!important/,'the general toolbar border skips the dock');
  assert.doesNotMatch(look,/toolbar-modules>button\[aria-pressed=true\]\{/,'switched-on icons keep their frame');
  const colors=[
    ['.ai-tool .module-icon-badge','#c9a2ff'],
    ['.library-tool .module-icon-badge','#ffbf47'],
    ['.forge-tool .module-icon-badge','#7cc4ff'],
    ['.bits-tool .module-icon-badge','#ece8de'],
    ['.optimizer-tool .module-icon-badge','#8fe07f'],
    ['.emitter-tool .module-icon-badge','#5fe0cf'],
    ['.animxl-tool .module-icon-badge','#ff8574'],
    ['.pressed-keys-tool>span:not(.hotkey-badge)','#ffa257'],
    ['.learner-tool .module-icon-badge','#f2e35c'],
    ['.vis-toggle>.module-icon-badge','#ff8fd0'],
  ];
  for(const [selector,color] of colors)assert.ok(look.includes(`${P}${selector}{color:${color}!important}`),selector);
  assert.equal(new Set(colors.map(([,color])=>color)).size,colors.length,'every dock label has its own colour');
  assert.ok(look.includes(P+'button b{color:inherit!important}'),'EMTR and KEY letters share one colour');
  // Every new-look rule is scoped away from VIS.
  for(const rule of look.split('}').map(part=>part.trim()).filter(part=>part.startsWith(':root')))assert.match(rule,/:not\(\[data-vis-ui\]\)/);
});
