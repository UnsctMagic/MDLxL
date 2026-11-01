import test from 'node:test';
import assert from 'node:assert/strict';
import { circleAround, straightDrag, drawnRing, freeTurn, current } from '../src/rotation-lab-styles.js';
import { beginRotationDrag, rotationDragDegrees } from '../src/rotation-drag.js';
const axes = [[0,0,1],[0,1,0],[1,0,0], ...[30,60,85].map(d => [Math.sin(d*Math.PI/180),0,Math.cos(d*Math.PI/180)])];
for (const [i,axis] of axes.entries()) {
  test(`B/C/E invariant gesture, view ${i}`, () => {
    const options={x:40,y:0,axis,sensitivity:.3};
    const b=circleAround.begin(options);
    assert.equal(Math.abs(circleAround.degrees(b,-40,40)),27);
    assert.equal(Math.abs(straightDrag.degrees(straightDrag.begin(options),40,200)),12);
    assert.deepEqual(freeTurn.degrees(freeTurn.begin(options),40,20),{up:12,right:6});
  });
  test(`D one degree per pixel along projected ring, view ${i}`, () => {
    const drag=drawnRing.begin({x:35,y:-40,axis,sensitivity:.3});
    assert.ok(Math.abs(drawnRing.degrees(drag,drag.tangent.x*40,drag.tangent.y*40)-12)<1e-10);
  });
}
test('B holds inside 12px and resumes without a reversal; wrap safe past 180',()=>{
  const d=circleAround.begin({x:40,y:0,axis:[0,0,-1]});
  assert.equal(circleAround.degrees(d,-30,0),0);
  assert.equal(circleAround.degrees(d,-40,40),90);
  assert.equal(circleAround.degrees(d,-40,0),90);
  assert.equal(circleAround.degrees(d,-80,0),180);
  assert.equal(circleAround.degrees(d,-40,-40),270);
  assert.equal(circleAround.degrees(d,0,0),360);
});
test('B can begin inside the centre without inventing an angle',()=>{
  const d=circleAround.begin({x:0,y:0,axis:[0,0,-1]});
  assert.equal(circleAround.degrees(d,40,0),0);
  assert.equal(circleAround.degrees(d,0,40),90);
});
test('B/C direction flips only with axis facing; A remains the exact ring baseline',()=>{
  for(const axis of [[0,0,1],[0,0,-1],[1,0,1e-8],[1,0,-1e-8]]) {
    const o={x:35,y:-40,axis,behavior:'ring',sensitivity:.3};
    const a=current.begin(o), b=beginRotationDrag(o);
    for(const [x,y] of [[40,0],[-20,10],[100,70]]) assert.equal(current.degrees(a,x,y),rotationDragDegrees(b,x,y));
    assert.equal(straightDrag.degrees(straightDrag.begin(o),40,0),axis[2]>0?-12:12);
  }
});

test('D tangent follows an independently projected 3D ring at every open tilt',()=>{
  for(const tilt of [0,30,60,85,89.999]){
    const t=tilt*Math.PI/180,axis=[Math.sin(t),0,Math.cos(t)];
    // r is in the turn plane; a cross r is its positive right-hand tangent.
    const r=[Math.cos(t)*30,40,-Math.sin(t)*30],tangent=[-axis[2]*r[1],axis[2]*r[0]-axis[0]*r[2]];
    const expected=[tangent[0],-tangent[1]],length=Math.hypot(...expected);
    const d=drawnRing.begin({x:r[0],y:-r[1],axis});
    assert.ok(Math.abs(d.tangent.x-expected[0]/length)<1e-9);
    assert.ok(Math.abs(d.tangent.y-expected[1]/length)<1e-9);
  }
});
