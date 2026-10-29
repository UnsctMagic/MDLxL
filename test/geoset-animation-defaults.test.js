import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisibilityGeosetAnimation, ensureGeosetAnimation, geosetAnimationOf } from '../src/geoset-animation-defaults.js';

test('geosetAnimationOf finds the first record and ensureGeosetAnimation reuses or appends one', () => {
  const model = { GeosetAnims: [{ GeosetId: 1, Alpha: 0.5 }] };
  assert.equal(geosetAnimationOf(model, 1), model.GeosetAnims[0]);
  assert.equal(geosetAnimationOf(model, 0), undefined);
  assert.equal(geosetAnimationOf({}, 0), undefined);
  assert.equal(ensureGeosetAnimation(model, 1), model.GeosetAnims[0]);
  const created = ensureGeosetAnimation(model, 0);
  assert.deepEqual(created, createVisibilityGeosetAnimation(0));
  assert.equal(model.GeosetAnims[1], created);
  const empty = {};
  assert.equal(ensureGeosetAnimation(empty, 2), empty.GeosetAnims[0]);
});

test('ensureGeosetAnimation refuses duplicates unless the caller takes the first', () => {
  const model = { GeosetAnims: [{ GeosetId: 0, Alpha: 1 }, { GeosetId: 0, Alpha: 0 }] };
  assert.throws(() => ensureGeosetAnimation(model, 0), /Geoset 1 has more than one geoset animation/);
  assert.throws(() => ensureGeosetAnimation(model, 0, { refuseDuplicates: 'Resolve them first.' }), /^Error: Resolve them first\.$/);
  assert.equal(ensureGeosetAnimation(model, 0, { refuseDuplicates: false }), model.GeosetAnims[0]);
  assert.equal(model.GeosetAnims.length, 2);
});
