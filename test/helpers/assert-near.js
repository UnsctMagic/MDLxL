// Approximate equality for source tests. The tolerance is always explicit, so moving a test onto these
// helpers never changes what it accepts.
import assert from 'node:assert/strict';

export function assertNear(actual, expected, epsilon, message) {
  if (typeof epsilon !== 'number') throw TypeError('assertNear needs an explicit epsilon');
  assert.ok(Math.abs(actual - expected) <= epsilon, message || `${actual} is not within ${epsilon} of ${expected}`);
}

export function assertVecNear(actual, expected, epsilon, message) {
  if (typeof epsilon !== 'number') throw TypeError('assertVecNear needs an explicit epsilon');
  const a = Array.from(actual), b = Array.from(expected);
  assert.equal(a.length, b.length, message || `length ${a.length} != ${b.length}`);
  a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) <= epsilon, message || `[${a}] is not within ${epsilon} of [${b}] at ${i}`));
}
