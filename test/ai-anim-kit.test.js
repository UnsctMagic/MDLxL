// The AI's hand-animation kit on real models: IK with a pole, planted feet, writing one clip without
// touching the others, key reduction under a vertex tolerance, follow-through, time maps, clipping.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes, sampleNodeMatrices, skinGeoset, visitTracks } from '../src/animation.js';
import { animate, kitRig, retime } from '../src/ai-anim-kit.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const footmanFile = fixturePath('footman'), knightFile = fixturePath('hoofprint');
const missing = (...files) => files.some(file => !file || !fs.existsSync(file)) && 'test model not on this machine';
const load = file => openDocument(fs.readFileSync(file), 'model.mdx').model;
const sword = rig => rig.chains.arms.find(c => rig.heldBy(c.joints.at(-1))?.kind === 'weapon');
const v = a => new Vector3().fromArray(a);

// Every key of every track outside [a, b], with its owner path, for "the rest stays byte-identical".
function keysOutside(model, [a, b]) {
  const rows = [];
  visitTracks(model, (track, { path }) => {
    for (const key of track.Keys) if (key.Frame < a || key.Frame > b) rows.push([path.join('/'), key.Frame, ...['Vector', 'InTan', 'OutTan'].map(p => key[p] ? Array.from(key[p]) : null)]);
  }, { skip: ['Nodes'] });
  return rows;
}

test('reach puts the wrist on the target and the elbow bends toward the pole', { skip: missing(footmanFile) }, () => {
  const rig = kitRig(load(footmanFile)), arm = sword(rig), [root, elbow, hand] = [arm.joints[0], arm.joints[1], arm.joints.at(-1)];
  const stand = rig.pose('Stand - 1', 0), target = stand.point(hand).add(new Vector3(8, -3, 10));
  for (const pole of [[0, 0, -1], [0, 0, 1]]) {
    const pose = stand.copy(), handTurn = pose.world(hand).rotation;
    const left = pose.reach(arm, target.toArray(), pole);
    assert.ok(left < 1e-3, `wrist ${left} from the target`);
    assert.ok(pose.point(hand).distanceTo(target) < 1e-3);
    // The elbow sits on the pole's side of the shoulder-wrist line.
    const s = pose.point(root), line = target.clone().sub(s).normalize(), e = pose.point(elbow).sub(s);
    const off = e.sub(line.clone().multiplyScalar(e.dot(line)));
    assert.ok(off.dot(v(pole)) > 1, `elbow offset ${off.toArray()} toward pole ${pole}`);
    // Bone lengths and the hand's own world turn stay.
    assert.ok(Math.abs(pose.point(elbow).distanceTo(pose.point(root)) - stand.point(elbow).distanceTo(stand.point(root))) < 1e-3);
    const q = pose.world(hand).rotation;
    assert.ok(Math.abs(q.reduce((a, x, i) => a + x * handTurn[i], 0)) > 1 - 1e-9, 'the hand keeps its world rotation');
  }
});

test('planted feet stay put while the body crouches, in the clip and in the written keys', { skip: missing(footmanFile) }, () => {
  const model = load(footmanFile), rig = kitRig(model), stand = rig.pose('Stand - 1', 0), feet = stand.feet();
  const crouch = stand.copy();
  crouch.move(rig.body, [3, 0, -9]);
  const clip = animate(rig, { sequence: 'Kit Crouch', length: 900, keys: [{ ms: 0, pose: stand }, { ms: 450, pose: crouch }, { ms: 900, pose: stand }], each: (ms, pose) => pose.plant(feet) });
  const body = clip.pose(450).point(rig.body).z - stand.point(rig.body).z;
  assert.ok(body < -8, `body moved ${body}`);
  for (let n = 0; n < clip.N; n++) for (const foot of feet) {
    const d = clip.poseAt(n).point(foot.chain.joints.at(-1)).distanceTo(v(foot.position));
    assert.ok(d < 0.5, `foot moved ${d} at ${clip.times[n]} ms`);
  }
  const report = clip.check();
  for (const row of report.feet) assert.ok(row.slide < 0.5 && row.planted === 1, JSON.stringify(row));
  const written = clip.write(model, { tolerance: 0.2 });
  for (let t = 0; t <= 900; t += 5) {
    const matrices = sampleNodeMatrices(model, written.interval[0] + t, written.sequence);
    for (const foot of feet) {
      const id = foot.chain.joints.at(-1), d = v(rig.pivot(id)).applyMatrix4(matrices.get(id)).distanceTo(v(foot.position));
      assert.ok(d < 0.5, `played foot ${d} off at ${t} ms`);
    }
  }
});

test('write creates a new clip or replaces one in place; every other key stays byte-identical', { skip: missing(footmanFile) }, () => {
  const model = load(footmanFile), rig = kitRig(model), count = model.Sequences.length;
  const lastEnd = Math.max(...model.Sequences.map(s => s.Interval[1]));
  const before = keysOutside(model, [lastEnd + 1, Infinity]);
  const stand = rig.pose('Stand - 1', 0), lunge = stand.copy();
  lunge.turn(sword(rig).joints[0], { pitch: -60 });
  const made = animate(rig, { sequence: 'Kit Lunge', length: 800, keys: [{ ms: 0, pose: stand }, { ms: 350, pose: lunge }, { ms: 800, pose: stand }] }).write(model);
  assert.equal(made.created, true);
  assert.equal(model.Sequences.length, count + 1);
  assert.equal(model.Sequences[made.sequence].Name, 'Kit Lunge');
  assert.ok(made.interval[0] > lastEnd && made.interval[1] - made.interval[0] === 800, `${made.interval}`);
  assert.equal(model.Sequences[made.sequence].NonLooping, true);
  assert.deepEqual(keysOutside(model, [lastEnd + 1, Infinity]), before, 'no key of the old animations changed');

  // Replace Attack - 2 in place: its own motion, but the head turns. Only the head's channels change.
  const index = rig.sequence('Attack - 2'), interval = Array.from(model.Sequences[index].Interval), head = rig.find('Bone_Head');
  const outside = keysOutside(model, interval);
  const untouched = rig.find('Bone_Leg1_L'), legKeys = JSON.stringify(allNodes(model).find(b => b.ObjectId === untouched).Rotation.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]).map(k => [k.Frame, Array.from(k.Vector)]));
  const clip = animate(rig, { sequence: 'Attack - 2', keys: [{ ms: 0, pose: stand }], each: (ms, pose) => {
    const own = rig.pose('Attack - 2', ms);
    for (const [id, value] of own.values) pose.values.set(id, value);
    pose.changed().turn(head, { yaw: 30 * Math.sin(Math.PI * ms / 1000) });
  }, smooth: false });
  const nose = v(rig.pivot(head)).add(new Vector3(10, 0, 0)).toArray(), before500 = rig.pose('Attack - 2', 500).point(head, nose);
  const replaced = clip.write(model);
  assert.equal(replaced.created, false);
  assert.equal(replaced.sequence, index);
  assert.deepEqual(Array.from(model.Sequences[index].Interval), interval);
  assert.deepEqual(keysOutside(model, interval), outside, 'other animations keep their keys');
  assert.equal(JSON.stringify(allNodes(model).find(b => b.ObjectId === untouched).Rotation.Keys.filter(k => k.Frame >= interval[0] && k.Frame <= interval[1]).map(k => [k.Frame, Array.from(k.Vector)])), legKeys, 'an untouched bone keeps its keys in the replaced clip');
  assert.ok(replaced.tracks >= 1 && replaced.tracks <= 4, `${replaced.tracks} tracks written (head and below)`);
  const played = v(nose).applyMatrix4(sampleNodeMatrices(model, interval[0] + 500, index).get(head));
  assert.ok(played.distanceTo(before500) > 2, `the head really turns in the written clip (${played.distanceTo(before500)})`);
  assert.ok(played.distanceTo(clip.pose(500).point(head, nose)) < 0.5, 'and plays as the clip says');
});

test('key reduction keeps every skinned vertex within tolerance with few strong keys', { skip: missing(footmanFile) }, () => {
  const model = load(footmanFile), rig = kitRig(model), arm = sword(rig), stand = rig.pose('Stand - 1', 0);
  const windUp = stand.copy(), strike = stand.copy(), hand = arm.joints.at(-1);
  windUp.turn(rig.find('Bone_Chest'), { yaw: 25 }); windUp.reach(arm, windUp.point(hand).add(new Vector3(-10, 4, 18)).toArray(), [0, 1, -1]);
  strike.turn(rig.find('Bone_Chest'), { yaw: -30, pitch: 10 }); strike.reach(arm, strike.point(hand).add(new Vector3(22, -12, -6)).toArray(), [0, 1, -1]);
  const clip = animate(rig, { sequence: 'Kit Swing', length: 1000, keys: [{ ms: 0, pose: stand }, { ms: 380, pose: windUp }, { ms: 520, pose: strike }, { ms: 1000, pose: stand }] });
  const tolerance = 0.3, written = clip.write(model, { tolerance });
  // Measured independently: MDLxL's own playback of the written keys against the dense clip.
  let worst = 0;
  for (let n = 0; n < clip.N; n++) {
    const played = sampleNodeMatrices(model, written.interval[0] + clip.times[n], written.sequence), wanted = clip.poseAt(n).matrices();
    for (const geoset of model.Geosets) {
      const a = skinGeoset(geoset, played), b = skinGeoset(geoset, wanted);
      for (let i = 0; i < a.length; i += 3) worst = Math.max(worst, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
    }
  }
  assert.ok(worst <= tolerance + 0.01, `largest vertex error ${worst}`);
  assert.ok(written.largestVertexError <= tolerance, `reported ${written.largestVertexError}`);
  const dense = clip.N * written.tracks;
  assert.ok(written.keys < dense * 0.06, `${written.keys} keys for ${written.tracks} tracks (${dense} samples)`);
  assert.ok(written.keysPerTrack <= 8, `median ${written.keysPerTrack} keys per track`);
  const loose = clip.fit(model, { tolerance: 2 });
  assert.ok(loose.keys < written.keys, 'a looser tolerance writes fewer keys');
});

test('follow chains lag, overshoot and settle; share takes part of the parent swing', { skip: missing(footmanFile) }, () => {
  const model = load(footmanFile), rig = kitRig(model), stand = rig.pose('Stand - 1', 0), chest = rig.find('Bone_Chest');
  const arm = rig.chains.arms.find(c => c !== sword(rig)), upper = arm.joints[0], elbow = arm.joints[1];
  const turned = stand.copy();
  turned.turn(chest, { yaw: 50 });
  const keys = [{ ms: 0, pose: stand }, { ms: 150, pose: turned }, { ms: 1600, pose: turned }];
  const plain = animate(rig, { sequence: 'Kit Turn', length: 1600, keys });
  const loose = animate(rig, { sequence: 'Kit Turn', length: 1600, keys, follow: [{ chain: [upper], frequency: 3, damping: 0.3, maxDeg: 40 }], easeBack: false });
  const yaw = (pose, id) => { const d = pose.point(elbow).sub(pose.point(id)); return Math.atan2(d.y, d.x) * 180 / Math.PI; };
  const deviation = ms => { let d = yaw(loose.pose(ms), upper) - yaw(plain.pose(ms), upper); return d > 180 ? d - 360 : d < -180 ? d + 360 : d; };
  const during = Math.min(...[50, 100, 150].map(deviation)), after = Math.max(...Array.from({ length: 60 }, (_, i) => deviation(160 + i * 10)));
  assert.ok(during < -2, `lags behind the chest turn by ${during} deg`);
  assert.ok(after > 1, `overshoots after the chest stops by ${after} deg`);
  assert.ok(Math.abs(deviation(1600)) < 0.5, `settles at ${deviation(1600)} deg`);
  const half = animate(rig, { sequence: 'Kit Turn', length: 1600, keys, follow: [{ chain: [upper], frequency: 8, damping: 1, share: 0.5 }], easeBack: false });
  const swing = yaw(plain.pose(1600), upper) - yaw(plain.pose(0), upper), shared = yaw(half.pose(1600), upper) - yaw(half.pose(0), upper);
  assert.ok(Math.abs(shared - swing / 2) < 3, `share 0.5 takes ${shared} of a ${swing} deg swing`);
});

test('a time map stretches the wind-up and keeps the hit itself unchanged', { skip: missing(footmanFile) }, () => {
  const rig = kitRig(load(footmanFile)), arm = sword(rig), hand = arm.joints.at(-1), stand = rig.pose('Stand - 1', 0);
  const raised = stand.copy(), hit = stand.copy();
  raised.reach(arm, raised.point(hand).add(new Vector3(-6, 0, 20)).toArray());
  hit.reach(arm, hit.point(hand).add(new Vector3(20, 0, -5)).toArray());
  const keys = [{ ms: 0, pose: stand }, { ms: 400, pose: raised }, { ms: 550, pose: hit }, { ms: 1000, pose: stand }];
  const plain = animate(rig, { sequence: 'Kit Hit', length: 1000, keys });
  const slow = animate(rig, { sequence: 'Kit Hit', keys, timing: [[0, 0], [400, 700], [550, 850], [1000, 1300]] });
  assert.equal(slow.length, 1300);
  // The hit lands 300 ms later, exactly in the authored pose, and the strike from raised to hit keeps its 150 ms.
  assert.ok(slow.pose(850).point(hand).distanceTo(hit.point(hand)) < 0.05);
  assert.ok(slow.pose(700).point(hand).distanceTo(raised.point(hand)) < 0.05);
  for (const ms of [420, 450, 500, 530]) assert.ok(slow.pose(ms + 300).point(hand).distanceTo(plain.pose(ms).point(hand)) < 0.05, `strike at ${ms} ms`);
  // The wind-up is slower.
  assert.ok(slow.pose(200).point(hand).distanceTo(stand.point(hand)) < plain.pose(200).point(hand).distanceTo(stand.point(hand)));
});

test('check finds clipping in a pose built to clip and none in the stand', { skip: missing(footmanFile) }, () => {
  const rig = kitRig(load(footmanFile)), arm = sword(rig), stand = rig.pose('Stand - 1', 0), chest = rig.find('Bone_Chest');
  const calm = animate(rig, { sequence: 'Kit Calm', length: 200, keys: [{ ms: 0, pose: stand }, { ms: 200, pose: stand }] }).check({ clipping: true, bytes: false });
  assert.equal(calm.clipping.total, 0, JSON.stringify(calm.clipping.rows));
  // The blade driven straight back through the chest.
  const stab = stand.copy();
  stab.hold(arm, stab.point(chest).add(new Vector3(14, 0, 0)).toArray(), [-1, 0, -0.1]);
  const report = animate(rig, { sequence: 'Kit Stab', length: 200, keys: [{ ms: 0, pose: stab }, { ms: 200, pose: stab }] }).check({ clipping: true, bytes: false });
  const body = report.clipping.rows.find(row => row[0] === 'weapon' && row[1] === 'body');
  assert.ok(body && body[3] > 0 && body[5] > 0, JSON.stringify(report.clipping.rows));
});

test('hold points a mounted knight\'s weapon along a direction with the hand on the grip', { skip: missing(knightFile) }, () => {
  const rig = kitRig(load(knightFile));
  assert.ok(rig.mount != null && rig.chains.mountLegs.length === 4 && rig.rider != null, 'horse and rider found');
  const arm = rig.chains.arms.find(c => rig.heldBy(c.joints.at(-1))?.tip), hand = arm.joints.at(-1), held = rig.heldBy(hand);
  const pose = rig.pose('Stand -1', 0), grip = pose.point(hand).add(new Vector3(6, 0, 4)), direction = new Vector3(1, 0, -0.4).normalize();
  const left = pose.hold(arm, grip.toArray(), direction.toArray(), [0, -1, -1]);
  assert.ok(left < 1e-3, `hand ${left} from the grip`);
  const axis = pose.point(held.tipBone, held.tip).sub(pose.point(hand)).normalize();
  assert.ok(axis.angleTo(direction) < 0.01, `weapon off by ${axis.angleTo(direction)} rad`);
});

test('retime moves a clip\'s keys through a time map and leaves other animations alone', { skip: missing(footmanFile) }, () => {
  const model = load(footmanFile), index = 4, [a, b] = Array.from(model.Sequences[index].Interval);
  const outside = keysOutside(model, [a, b]), body = allNodes(model).find(n => n.Name === 'Bone_Root').Translation.Keys.filter(k => k.Frame >= a && k.Frame <= b);
  const result = retime(model, index, [[0, 0], [400, 600], [1000, 1200]]);
  assert.equal(result.interval[1] - result.interval[0], 1200);
  assert.equal(result.moved, true, 'no room before the next animation, so it moves after the last one');
  assert.deepEqual(keysOutside(model, [a, b]).filter(row => row[1] < result.interval[0]), outside);
  const moved = allNodes(model).find(n => n.Name === 'Bone_Root').Translation.Keys.filter(k => k.Frame >= result.interval[0]);
  assert.equal(moved.length, body.length);
  for (const [i, key] of moved.entries()) {
    const old = body[i].Frame - a, want = old <= 400 ? old * 1.5 : 600 + (old - 400);
    assert.ok(Math.abs(key.Frame - result.interval[0] - want) <= 1, `${old} ms -> ${key.Frame - result.interval[0]}`);
    assert.deepEqual(Array.from(key.Vector), Array.from(body[i].Vector));
  }
});
