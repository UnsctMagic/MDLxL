import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalValue, stableKey, typedJson } from '../src/value-key.js';

// Bodies of the copies this module replaced.
function oldCanonical(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value, oldCanonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, oldCanonical(value[key])]));
  return value;
}
function oldSignature(value) {
  if (ArrayBuffer.isView(value)) return Array.from(value, oldSignature);
  if (Array.isArray(value)) return value.map(oldSignature);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, oldSignature(value[key])]));
  return value;
}
const oldJson = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);

const records = [
  { Name: 'a', Image: 'x.blp', Flags: 0, Extra: undefined },
  { Z: new Float32Array([1, 2.5, -3]), A: [new Uint16Array([1, 2]), { b: 1, a: undefined, c: [null, undefined] }], M: null },
  [1, 'two', { three: 3 }], 'text', 7, null, undefined, { Keys: [{ Frame: 0, Vector: new Float32Array([0, 1, 0, 1]) }], GlobalSeqId: -1 },
];

test('stableKey matches every replaced canonical copy', () => {
  for (const record of records) {
    assert.deepEqual(canonicalValue(record), oldCanonical(record));
    assert.deepEqual(canonicalValue(record), oldSignature(record));
    assert.equal(stableKey(record), JSON.stringify(oldCanonical(record)));
    assert.equal(stableKey(record), JSON.stringify(oldSignature(record)));
  }
  assert.equal(stableKey({ b: 1, a: 2 }), stableKey({ a: 2, b: 1 }));
});

test('canonicalValue can omit keys', () => {
  assert.deepEqual(canonicalValue({ a: 1, skip: 2, n: { skip: 3, b: 4 } }, { omit: ['skip'] }), { a: 1, n: { b: 4 } });
});

test('typedJson matches the replaced typed-json copies', () => {
  for (const record of records) assert.equal(typedJson(record), oldJson(record));
});
