import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {bindScrollSensitivity,pointerSensitivityValue,wheelZoomFactor} from '../app/viewport-performance.js';
import {cameraBindings} from '../src/preferences.js';

// Execute the real hook with deterministic React effects and DOM event targets.
const source=readFileSync(new URL('../app/usePaintImageNavigation.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export function','function');
function target(){
  const listeners=new Map();
  return {listeners,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name){listeners.delete(name);},emit(name,event){listeners.get(name)?.(event);},focus(){},setPointerCapture(){},hasPointerCapture(){return true;},releasePointerCapture(){}};
}
function event(extra={}){return {deltaY:-100,deltaMode:0,buttons:0,button:0,pointerId:1,clientX:250,clientY:180,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...extra};}
function harness(preferences){
  const owner=target(),element=Object.assign(target(),{ownerDocument:{defaultView:owner},scrollLeft:100,scrollTop:80}),scroll={current:element};
  let zoom=2,adjusting,options={preferences},api,cursor=0,mounted=false;
  const refs=[],layouts=[],effects=[],cleanup=[];
  const image={current:{getBoundingClientRect:()=>({left:150-element.scrollLeft,top:120-element.scrollTop})}};
  const context={bindScrollSensitivity,pointerSensitivityValue,wheelZoomFactor,cameraBindings,
    useRef:()=>refs[cursor++]??(refs[cursor-1]={current:undefined}),useState:()=>[adjusting,value=>{adjusting=value;}],
    useEffect:fn=>{if(!mounted)effects.push(fn);},useLayoutEffect:fn=>layouts.push(fn)};
  vm.createContext(context);vm.runInContext(source+'; globalThis.hook=usePaintImageNavigation;',context);
  function render(){cursor=0;api=context.hook(scroll,image,zoom,value=>{zoom=value;},()=>{},options);for(const fn of layouts.splice(0))fn();if(!mounted){mounted=true;for(const fn of effects)cleanup.push(fn());}}
  render();
  return {element,owner,get zoom(){return zoom;},get indicator(){return adjusting;},get navigation(){return api.navigation;},render,
    preferences(value){options={...options,preferences:value};render();},callbacks(value){options={...options,...value};render();},wheel(extra){element.emit('wheel',event(extra));},dispose(){cleanup.forEach(fn=>fn());}};
}

test('Paint wheel uses the live Mouse sensitivity, normalizes deltas, and anchors the cursor',t=>{
  const h=harness({scrollSensitivity:1});t.after(()=>h.dispose());
  h.wheel();assert.equal(h.zoom,2*Math.exp(.15));h.render();
  assert.ok(Math.abs((250-(150-h.element.scrollLeft))/h.zoom-100)<1e-10);
  assert.ok(Math.abs((180-(120-h.element.scrollTop))/h.zoom-70)<1e-10);
  h.preferences({scrollSensitivity:3});const before=h.zoom;h.wheel({deltaY:-100/16,deltaMode:1});
  assert.equal(h.zoom,before*Math.exp(.45));
});

test('Paint Peon/Wisp and held-button wheels adjust settings without zoom, then use the live adjustment',t=>{
  const h=harness({scrollSensitivity:2,wheelMode:'scroll'});t.after(()=>h.dispose());let saved,pointer;
  h.callbacks({onSensitivityChange:value=>{saved=value;},onPointerSensitivityChange:value=>{pointer=value;}});
  h.wheel();assert.equal(h.zoom,2);assert.ok(saved>2);assert.equal(h.indicator.kind,'scroll');
  h.preferences({scrollSensitivity:2,wheelMode:'rotate'});h.wheel();assert.equal(h.zoom,2*wheelZoomFactor(event(),saved));h.render();
  h.preferences({scrollSensitivity:2,wheelMode:'pointer'});const before=h.zoom;h.wheel();assert.equal(h.zoom,before);assert.ok(pointer>1);assert.equal(h.indicator.kind,'pointer');
  h.preferences({scrollSensitivity:2,wheelMode:'rotate'});h.wheel({buttons:2});assert.equal(h.zoom,before);assert.equal(h.indicator.kind,'scroll');
  h.wheel({buttons:1});assert.equal(h.zoom,before);assert.equal(h.indicator.kind,'pointer');
});

test('Paint navigation respects disabled/toggle buttons, maps 2D rotate to pan and honours zoom bindings',t=>{
  const h=harness({cameraBindings:{right:'none',middle:'toggle'}});t.after(()=>h.dispose());
  for(const button of [1,2]){h.navigation.onPointerDownCapture(event({button}));h.navigation.onPointerMoveCapture(event({clientX:300}));assert.equal(h.element.scrollLeft,100);}
  h.preferences({cameraBindings:{right:'rotate',middle:'pan'},pointerSensitivity:2});
  h.navigation.onPointerDownCapture(event({button:2}));h.navigation.onPointerMoveCapture(event({clientX:270,clientY:190}));assert.equal(h.element.scrollLeft,60);assert.equal(h.element.scrollTop,60);
  h.navigation.onPointerUpCapture(event({button:2}));
  h.preferences({cameraBindings:{right:'zoom'}});h.navigation.onPointerDownCapture(event({button:2}));h.navigation.onPointerMoveCapture(event({clientY:170}));assert.equal(h.zoom,2*Math.exp(.1));
});

test('Paint middle toggle and listener cleanup use the shared scroll controller',()=>{
  const h=harness({cameraBindings:{middle:'toggle'}});let toggles=0;h.callbacks({onCameraModeToggle:()=>toggles++});
  h.element.emit('pointerdown',event({button:1}));h.owner.emit('pointerup',event({button:1}));assert.equal(toggles,1);
  h.dispose();assert.equal(h.element.listeners.size,0);assert.equal(h.owner.listeners.size,0);
});
