import test from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { turnLocalRotation } from '../src/rotation-math.js';
import { turnWeaponEnds } from '../src/glow-up.js';

const near = (a, b, label, eps = 1e-5) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < eps, `${label}: ${a} vs ${b}`));
const about = (axis, degrees) => new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), degrees * Math.PI / 180);
const sameTurn = (a, b, label) => { const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w; assert.ok(Math.abs(Math.abs(dot) - 1) < 1e-6, label); };

test('a Rotate handle turns an emitter around the world axis, whatever its parent is turned to', () => {
  const parent = about([1, 2, 3], 70), local = about([0, 1, 0], 25);
  for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) for (const degrees of [-40, 15, 90]) {
    const result = new Quaternion().fromArray(turnLocalRotation(local.toArray(), parent.toArray(), axis, degrees));
    // world = parent × local; the turn is applied in world space.
    sameTurn(parent.clone().multiply(result), about(axis, degrees).multiply(parent.clone().multiply(local)), `${axis} ${degrees}°`);
  }
});

test('no turn leaves the emitter as it was', () => {
  const local = about([1, 1, 0], 33).toArray();
  sameTurn(new Quaternion().fromArray(turnLocalRotation(local, about([0, 0, 1], 80).toArray(), [1, 0, 0], 0)), new Quaternion().fromArray(local), 'zero turn');
});

// A weapon along X from the butt at the origin, 100 long; side +Z, other = along × side = −Y.
const line = { start: [20, 0, 0], end: [80, 0, 0], butt: [0, 0, 0], frame: { along: [1, 0, 0], side: [0, 0, 1], other: [0, -1, 0], size: 100 } };

test('the weapon glow swings both ends around its middle, keeping its length', () => {
  const { weaponFrom, weaponTo } = turnWeaponEnds(line, [0, 0, 0, 1], [0, 0, 1], 90);
  near(weaponFrom, [.5, 0, .3], 'start');
  near(weaponTo, [.5, 0, -.3], 'end');
  const tilted = turnWeaponEnds(line, [0, 0, 0, 1], [0, 1, 0], 20), span = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  assert.ok(Math.abs(span(tilted.weaponFrom, tilted.weaponTo) - .6) < 1e-6, 'length kept');
});

test('a posed weapon bone carries the world axis back into the bind-pose frame', () => {
  // The bone is turned 90° about X, so world Y is bind-pose −Z.
  const { weaponFrom, weaponTo } = turnWeaponEnds(line, about([1, 0, 0], 90).toArray(), [0, 1, 0], 90);
  near(weaponFrom, [.5, 0, -.3], 'start');
  near(weaponTo, [.5, 0, .3], 'end');
});

test('a zero turn keeps the weapon glow ends', () => {
  const { weaponFrom, weaponTo } = turnWeaponEnds(line, about([0, 1, 1], 45).toArray(), [1, 0, 0], 0);
  near(weaponFrom, [.2, 0, 0], 'start');
  near(weaponTo, [.8, 0, 0], 'end');
});
