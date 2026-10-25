import test from 'node:test';
import assert from 'node:assert/strict';
import { textureAreaLayout } from '../src/texture-thumbnail.js';

test('A texture area preview crops the asked area and labels a uv grid inside it', () => {
  const whole = textureAreaLayout({ width: 256, height: 128 });
  assert.deepEqual(whole.crop, [0, 0, 256, 128]);
  assert.deepEqual(whole.u, [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]);
  // A small area gets finer lines so a rectangle can be read off the picture.
  const area = textureAreaLayout({ width: 256, height: 256 }, [0.487, 0.008, 0.737, 0.168]);
  assert.deepEqual(area.crop, [124, 2, 65, 42]);
  assert.ok(area.u.length >= 4 && area.u.every(u => u >= 0.487 && u <= 0.737));
  assert.ok(area.v.length >= 2 && area.v.every(v => v >= 0.008 && v <= 0.168));
  assert.deepEqual(area.sheet, [256, 256]);
  assert.throws(() => textureAreaLayout({ width: 64, height: 64 }, [0.5, 0.5, 0.2, 0.9]), /u1 > u0/);
});
