import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {solveMove, shiftDragLatch} from '../src/shift-lock.js';

const start = {x:0, y:0};
function move(plane, options, enabled = true) {
  const gesture = {workplane:plane, workplaneEnabled:enabled, latch:shiftDragLatch(start, false)};
  return (x,y,held) => solveMove(gesture, {x,y}, held, {basis:[[2,0],[0,-2]], screen:(a,b)=>[a,b,0], ...options});
}
test('the displayed model axis is the only dimension that changes in the held segment', () => {
  for (const [plane,label] of [['xy','X'],['xz','Z'],['yz','Y']]) {
    const solve = move(plane), before = solve(4,6,false);
    assert.equal(before.lock,null);
    const pressed = solve(4,6,true);
    assert.deepEqual(pressed.offset,before.offset);
    const held = solve(12,14,true);
    assert.deepEqual(held.lock,{kind:'axis',label});
    assert.deepEqual(held.offset.map((v,i)=>v!==before.offset[i]), [...'XYZ'].map(a=>a===label));
    assert.deepEqual(solve(12,14,false),{offset:held.offset, lock:null});
    assert.equal(move(plane,{},false)(12,14,true).lock,null);
  }
});
test('flat screen latches report model axes, oblique screen latches report the locked plane', () => {
  for (const [plane,flat,oblique] of [['xy','X','XY'],['xz','X','ZX'],['yz','Y','YZ']]) {
    assert.equal(move(plane,{quad:true})(12,1,true).lock.label, flat);
    const solve = move(plane,{quad:true,basis:[[1,1],[-1,1]]});
    assert.equal(solve(0,0,true).lock,null);
    assert.deepEqual(solve(12,1,true).lock,{kind:'plane',label:oblique});
  }
});
test('3D editors use the shared Move lock and one badge implementation', () => {
  const app = new URL('../app/', import.meta.url);
  for (const name of readdirSync(app).filter(n=>/\.jsx?$/.test(n))) {
    const source = readFileSync(new URL(name,app),'utf8');
    assert.doesNotMatch(source, /(?:shiftDragOffset|moveConstraint|dominantPlaneAxis)\s*\(/, name);
    if (name!=='ShiftLockBadge.jsx') assert.doesNotMatch(source,/className="shift-lock-badge"/,name);
    if (['Viewport.jsx','GamePreview.jsx','CollisionOverlay.jsx'].includes(name)) {
      assert.match(source, /from ['"][^'"]*shift-lock\.js['"]/,name);
      assert.doesNotMatch(source,/moveDragPoint\(|projectedPlaneTranslation\([^;]*shiftKey|freeDragTranslation\([^;]*shift:/,name);
    }
  }
});
