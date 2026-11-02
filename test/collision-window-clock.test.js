import { moveDragPoint } from '../app/classic-gestures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFrameCoalescer } from '../app/viewport-performance.js';
import { moveCollision, resizeCollision } from '../src/model-collisions.js';
import { movementDragAmount } from '../app/movement-overlay.js';

// Exercise the production hook with an occluded main clock and a live popup
// clock. The packaged mouse check separately covers real React/DOM delivery.
test('collision drafts use the pointer target window while the main frame clock is suspended', t => {
  const source=readFileSync(process.env.MDLXL_COLLISION_SOURCE || new URL('../app/CollisionOverlay.jsx',import.meta.url),'utf8');
  const hook=source.slice(source.indexOf('export function useCollisionGesture'),source.indexOf('/** Shared EMTR-style')).replace('export function','function');
  const main=new Map(),popup=new Map();let next=1;
  const clock=queue=>({requestAnimationFrame(callback){const id=next++;queue.set(id,callback);return id;},cancelAnimationFrame(id){queue.delete(id);}});
  const owner=clock(popup),hidden=clock(main),drafts=[],commits=[];
  const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame=hidden.requestAnimationFrame;globalThis.cancelAnimationFrame=hidden.cancelAnimationFrame;
  t.after(()=>{if(oldRequest===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=oldRequest;if(oldCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=oldCancel;});
  const refs=[],effects=[];let refIndex=0;
  const useGesture=new Function('useRef','useEffect','useWindowKeyClaim','createFrameCoalescer','moveCollision','resizeCollision','movementDragAmount','moveDragPoint','visible','requestAnimationFrame','cancelAnimationFrame','window','return ('+hook+');')(
    value=>refs[refIndex++]||=({current:value}),(effect,deps)=>{if(deps.length)effects.push(effect);},()=>{},createFrameCoalescer,moveCollision,resizeCollision,movementDragAmount,moveDragPoint,()=>true,hidden.requestAnimationFrame,hidden.cancelAnimationFrame,hidden);
  const selected={ObjectId:0,Shape:2,Vertices:new Float32Array([0,0,40]),BoundsRadius:30};
  const move={dx:[1,0,0],dy:[0,0,-1]},stage={rows:[{id:0,center:[0,0,0],move,handles:[]}]};
  const render=(shape=selected)=>{refIndex=0;return useGesture({selected:shape,readOnly:false,stage,selectedId:shape.ObjectId,setDraft:value=>drafts.push(value),onCommit:value=>commits.push(value)});};
  const gesture=render();
  const target={ownerDocument:{defaultView:owner},setPointerCapture(){},focus(){}};
  const event=(x,y,shiftKey=false)=>({shiftKey,button:0,pointerId:1,clientX:x,clientY:y,currentTarget:target,preventDefault(){},stopPropagation(){}});
  const handlers=gesture.handleProps({move});handlers.onPointerDown(event(0,0));
  for(let x=1;x<=20;x++)gesture.drag(event(x,0));
  assert.equal(main.size,0,'an occluded main-window frame must not own the live drag');
  assert.equal(popup.size,1,'pointer events coalesce on the popup clock');
  const callbacks=[...popup.values()];popup.clear();callbacks.forEach(callback=>callback());
  assert.equal(drafts.at(-1).Vertices[0],20,'draft moves before mouse release');assert.equal(commits.length,0);
  handlers.onPointerUp(event(25,0));assert.equal(commits.at(-1).Vertices[0],25,'release flushes the final point');assert.equal(popup.size,0);
  const draw=()=>{const callbacks=[...popup.values()];popup.clear();callbacks.forEach(callback=>callback());};
  handlers.onPointerDown(event(0,0,true));gesture.drag(event(20,4,true));draw();assert.deepEqual([...drafts.at(-1).Vertices],[20,0,40],'Shift latches Quad horizontal movement');
  gesture.drag(event(25,30,true));draw();assert.deepEqual([...drafts.at(-1).Vertices],[25,0,40],'perpendicular travel stays discarded');
  handlers.onKeyUp({key:'Shift',shiftKey:false});gesture.drag(event(30,40,false));draw();assert.deepEqual([...drafts.at(-1).Vertices],[30,0,30],'release only adds new travel');
  handlers.onKeyDown({key:'Shift',shiftKey:true});gesture.drag(event(31,60,true));draw();assert.deepEqual([...drafts.at(-1).Vertices],[30,0,10],'a new Shift hold can latch vertical movement');
  handlers.onPointerUp(event(31,60,true));
  const second={ObjectId:1,Shape:2,Vertices:new Float32Array([10,20,50]),BoundsRadius:15};stage.rows.push({id:1,center:[0,0,0],move,handles:[]});
  const number=gesture.handleProps({move},second),count=commits.length;number.onPointerDown(event(5,6));number.onPointerUp(event(5,6));assert.equal(commits.length,count,'clicking a number selects without committing a shape edit');
  number.onPointerDown(event(5,6));effects.at(-1)();gesture.drag(event(17,9));draw();assert.equal(drafts.at(-1)?.ObjectId,1,'a pending previous-selection effect must not cancel the number drag');render(second);effects.at(-1)();number.onPointerUp(event(17,9));assert.equal(commits.at(-1).ObjectId,1,'number drag targets its sphere even if another was selected');assert.deepEqual([...commits.at(-1).Vertices],[22,20,47]);assert.deepEqual([...selected.Vertices],[0,0,40]);
  const switched=render(second);switched.handleProps({move}).onPointerDown(event(0,0));switched.drag(event(10,0));draw();render();effects.at(-1)();assert.equal(drafts.at(-1),null,'a later unrelated selection still cancels the drag');
});
