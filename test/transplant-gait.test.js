import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Matrix4, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { transferRig } from '../src/anim-transfer.js';
import { openDocument } from '../src/editor-document.js';
import { vertexBones } from '../src/part-bones.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { frontBodySupport, shiftLoopKeys, transplantGait } from '../src/transplant-gait.js';
import { standSequenceIndex } from '../src/sequence-editor.js';

const { fixturePath, testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load = file => openDocument(new Uint8Array(fs.readFileSync(file)), file).model;

function footPaths(own, donor, result, report) {
  const rig = transferRig(own), source = transferRig(donor);
  const nodes = new Map(allNodes(own).map(n => [n.ObjectId,n]));
  const feet = Object.values(rig.parts).filter(part => part.limbKind === 'leg');
  const below = (id,root) => {
    for (let n=nodes.get(id); n; n=nodes.get(n.Parent)) if(n.ObjectId===root) return true;
    return false;
  };
  const index = result.Sequences.findIndex(s => /^walk$/i.test(s.Name.trim()));
  assert.ok(index>=0,'a real walking cycle');
  const [a,b] = result.Sequences[index].Interval;
  const frames=Array.from({length:17},(_,i)=>{
    const m=sampleNodeMatrices(result,Math.round(a+(b-a)*i/16),index);
    return {posed:result.Geosets.map(g=>skinGeoset(g,m)), back:new Matrix4().copy(m.get(report.donorNodes[source.body])).invert()};
  });
  return feet.map(foot=>{
    let points=[];
    for(const joint of [...foot.joints].reverse()){
      for(const [gi,g] of own.Geosets.entries()) for(let vi=0;vi<g.Vertices.length/3;vi++)
        if(vertexBones(g,vi).some(id=>below(id,joint))) points.push([gi,vi]);
      if(points.length) break;
    }
    assert.ok(points.length,foot.key+' has actual foot skin');
    const path=frames.map(({posed,back})=>{
      const centre=new Vector3();
      for(const [gi,vi] of points) centre.add(new Vector3().fromArray(posed[gi],vi*3));
      return centre.divideScalar(points.length).applyMatrix4(back);
    });
    const span=Math.max(...path.flatMap(p=>path.map(q=>p.distanceTo(q))));
    return {key:foot.key,span:span/Math.max(rig.hipHeight,1),path};
  });
}

for (const [ownName,donorName,choices] of [
  ['orc__hellscream','creeps__giantseaturtle',['back','front','back-and-arms']],
  ['creeps__timberwolf','human__footman',['same-side','diagonal']],
]) {
  const files=[ownName,donorName].map(n=>testModel('corpus-sd/'+n+'.mdx'));
  test('Gait choices move the actual feet through Walk: '+ownName+' on '+donorName,{skip:files.some(f=>!fs.existsSync(f))?'private SD fixture unavailable':false},()=>{
    const own=load(files[0]), donor=load(files[1]);
    const curves=[];
    for(const gait of choices) {
      const {model,report}=transplantSkeleton(own,donor,{gait,extents:false});
      const feet=footPaths(own,donor,model,report);
      for(const f of feet) assert.ok(f.span>0.08,`${gait} ${f.key} swings only ${f.span.toFixed(4)} hip heights`);
      assert.ok(!report.still.some(k=>/^leg/.test(k)),'all recipient legs have drivers');
      curves.push(feet);
    }
    const differs=curves[0].some((f,i)=>f.path.some((p,j)=>p.distanceTo(curves[1][i].path[j])>1));
    assert.ok(differs,'the first two choices produce visibly different foot paths');
    // With no front-leg box ticked the Timber Wolf's front legs copy the back legs' walk, as same-side does (step 5b).
    const selected = ownName === 'orc__hellscream' ? 'back-and-arms' : 'same-side';
    const automatic = transplantSkeleton(own,donor,{extents:false}).model;
    const explicit = transplantSkeleton(own,donor,{gait:selected,extents:false}).model;
    assert.deepEqual(automatic.Geosets,explicit.Geosets,'default uses the selected gait skin');
    assert.deepEqual(automatic.Helpers,explicit.Helpers,'default uses the selected animation drivers');
  });
}

// Front legs (owner, 26 Nov 2026): no box ticked, the spare front legs copy the back legs as before; Use arms gives them the
// donor's arms ("why did the front legs not become the arms of the beast? ... this is possible"); Mirror legs the
// mirrored opposite back leg.
test('Snap Dragon taking the riderless Cold One: front legs copy, take the arms, or mirror by checkbox', { skip: ['xfer-r45-own', 'xfer-r45-donor'].some(key => !fs.existsSync(fixturePath(key))) ? 'XFER reasonable models unavailable' : false }, () => {
  const own = load(fixturePath('xfer-r45-own')), donor = load(fixturePath('xfer-r45-donor'));
  const rigOf = m => transferRig(m, Math.max(0, standSequenceIndex(m)));
  const ownRig = rigOf(own), donorRig = rigOf(donor);
  const gait = flags => transplantGait(own, donor, ownRig, donorRig, 'back-and-arms', frontBodySupport(donor, donorRig), flags);
  const along = part => { const id = part.line?.[0] ?? part.joints[0], p = nodePivot(own, own.Nodes[id], id); return p[0] * ownRig.facing[0] + p[1] * ownRig.facing[1]; };
  const plain = gait(), arms = gait({ useArms: true }), mirror = gait({ mirrorLegs: true, legTiming: 25 });
  for (const side of ['L', 'R']) {
    const other = side === 'L' ? 'R' : 'L';
    const [back, front] = Object.values(ownRig.parts).filter(p => p.limbKind === 'leg' && p.side === side).sort((a, b) => along(a) - along(b));
    assert.deepEqual(plain.get(front.key), { from: 'leg' + side, copy: true, reflected: false }, `no box: ${front.key} copies the back leg`);
    assert.equal(arms.get(front.key)?.from, 'arm' + side, `Use arms: ${front.key} takes ${JSON.stringify(arms.get(front.key))}`);
    assert.deepEqual(mirror.get(front.key), { from: 'leg' + other, copy: true, reflected: true, shift: -0.25 }, `Mirror legs: ${front.key}`);
    for (const flags of [plain, arms, mirror]) assert.deepEqual(flags.get(back.key), { from: 'leg' + side, copy: false, reflected: false }, `${back.key} (back) keeps its leg`);
  }
});

// The Leg timing shift: keys inside one looping Walk move round the loop; the loop stays closed.
test('shiftLoopKeys moves a looping track round its interval and keeps the loop closed', () => {
  const track = { LineType: 1, Keys: [
    { Frame: 0, Vector: new Float32Array([9]) },
    { Frame: 100, Vector: new Float32Array([0]) }, { Frame: 150, Vector: new Float32Array([10]) },
    { Frame: 200, Vector: new Float32Array([20]) }, { Frame: 250, Vector: new Float32Array([10]) },
    { Frame: 300, Vector: new Float32Array([0]) },
    { Frame: 400, Vector: new Float32Array([7]) },
  ] };
  const interval = [100, 300], at = (t, f) => sampleTrack(t, f, { interval });
  for (const share of [0, 1]) for (let f = 100; f <= 300; f += 10) assert.equal(at(shiftLoopKeys(track, interval, share), f), at(track, f), `shift ${share} at ${f}`);
  const half = shiftLoopKeys(track, interval, 0.5);
  for (let f = 100; f <= 300; f += 10) assert.ok(Math.abs(at(half, f) - at(track, 100 + (f - 100 + 100) % 200)) < 1e-6, `half a clip at ${f}`);
  const inside = half.Keys.filter(key => key.Frame >= 100 && key.Frame <= 300);
  assert.equal(inside[0].Frame, 100); assert.equal(inside.at(-1).Frame, 300);
  assert.deepEqual(Array.from(inside[0].Vector), Array.from(inside.at(-1).Vector), 'first and last key agree');
  assert.deepEqual(half.Keys.filter(key => key.Frame < 100 || key.Frame > 300), [track.Keys[0], track.Keys[6]], 'keys of other animations stay');
  const quarter = shiftLoopKeys(track, interval, 0.25);
  for (let f = 100; f <= 300; f += 10) assert.ok(Math.abs(at(quarter, f) - at(track, 100 + ((f - 100 - 50) % 200 + 200) % 200)) < 1e-6, `a quarter at ${f}`);
});

// Mirror legs on a four-legged body under a biped: the slider changes when the front feet step, and they still step.
test('Footman onto the Timber Wolf with Mirror legs: front feet step at timing 25 and 50, on different paths', { skip: ['transfer-footman'].some(key => !fs.existsSync(fixturePath(key))) || !fs.existsSync(testModel('corpus-sd/creeps__timberwolf.mdx')) ? 'SD fixture unavailable' : false }, () => {
  const own = load(testModel('corpus-sd/creeps__timberwolf.mdx')), donor = load(fixturePath('transfer-footman'));
  const ownRig = transferRig(own), front = new Set();
  for (const side of ['L', 'R']) {
    const along = part => { const id = part.line?.[0] ?? part.joints[0], p = nodePivot(own, own.Nodes[id], id); return p[0] * ownRig.facing[0] + p[1] * ownRig.facing[1]; };
    front.add(Object.values(ownRig.parts).filter(p => p.limbKind === 'leg' && p.side === side).sort((a, b) => along(a) - along(b)).at(-1).key);
  }
  const paths = legTiming => {
    const { model, report } = transplantSkeleton(own, donor, { extents: false, autoFix: { mirrorLegs: true }, legTiming });
    return footPaths(own, donor, model, report).filter(foot => front.has(foot.key));
  };
  const four = paths(25), plain = paths(50);
  assert.equal(four.length, 2);
  for (const foot of [...four, ...plain]) assert.ok(foot.span > 0.08, `${foot.key} swings only ${foot.span.toFixed(4)} hip heights`);
  assert.ok(four.some((foot, i) => foot.path.some((p, j) => p.distanceTo(plain[i].path[j]) > 1)), 'timing 25 and 50 put the front feet on different paths');
});
