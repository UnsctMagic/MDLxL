// AI scripts reach only src modules (api.module), so the portrait camera helpers live in src; the
// Portrait toolbar and every other app caller keep importing the same functions from app/.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as appView from '../app/portrait-view.js';
import * as appEdit from '../app/portrait-camera-edit.js';
import * as srcView from '../src/portrait-view.js';
import * as srcEdit from '../src/portrait-camera-edit.js';

test('scripts and the Portrait toolbar share one set of portrait camera helpers', () => {
  for (const [app, src] of [[appView, srcView], [appEdit, srcEdit]]) {
    assert.deepEqual(Object.keys(app).sort(), Object.keys(src).sort());
    for (const name of Object.keys(src)) assert.equal(app[name], src[name], name);
  }
  for (const name of ['createPortraitCamera', 'framePortraitSubject', 'setCameraFromCurrentView', 'editPortraitCamera', 'makePortraitCamera', 'portraitShot'])
    assert.equal(typeof srcEdit[name], 'function', name);
  assert.equal(typeof srcView.evaluateModelCamera, 'function');
});
