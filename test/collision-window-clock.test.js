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
  const useGesture=new Function('useRef','useEffect','useWindowKeyClaim','createFrameCoalescer','moveCollision','resizeCollision','movementDragAmount','visible','requestAnimationFrame','cancelAnimationFrame','window','return ('+hook+');')(
    value=>({current:value}),()=>{},()=>{},createFrameCoalescer,moveCollision,resizeCollision,movementDragAmount,()=>true,hidden.requestAnimationFrame,hidden.cancelAnimationFrame,hidden);
  const selected={ObjectId:0,Shape:2,Vertices:new Float32Array([0,0,40]),BoundsRadius:30};
  const move={dx:[1,0,0],dy:[0,0,-1]},stage={rows:[{id:0,center:[0,0,0],move,handles:[]}]};
  const gesture=useGesture({selected,readOnly:false,stage,selectedId:0,setDraft:value=>drafts.push(value),onCommit:value=>commits.push(value)});
  const target={ownerDocument:{defaultView:owner},setPointerCapture(){},focus(){}};
  const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,currentTarget:target,preventDefault(){},stopPropagation(){}});
  const handlers=gesture.handleProps({move});handlers.onPointerDown(event(0,0));
  for(let x=1;x<=20;x++)gesture.drag(event(x,0));
  assert.equal(main.size,0,'an occluded main-window frame must not own the live drag');
  assert.equal(popup.size,1,'pointer events coalesce on the popup clock');
  const callbacks=[...popup.values()];popup.clear();callbacks.forEach(callback=>callback());
  assert.equal(drafts.at(-1).Vertices[0],20,'draft moves before mouse release');assert.equal(commits.length,0);
  handlers.onPointerUp(event(25,0));assert.equal(commits.at(-1).Vertices[0],25,'release flushes the final point');assert.equal(popup.size,0);
});
