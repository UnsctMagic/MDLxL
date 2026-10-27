import test from 'node:test';
import assert from 'node:assert/strict';
import { createVersionStore } from '../src/ai-versions.js';
import { patchAiModel, prepareAiEdit } from '../src/ai-model.js';

const model = () => ({
  Version: 800,
  Info: { Name: 'cup' },
  Geosets: [{ Vertices: new Float32Array([0, 0, 0, 1, 0, 0]), Faces: new Uint16Array([0, 1, 0]) }],
  Bones: [{ Name: 'root', PivotPoint: new Float32Array(3) }],
});

test('each job keeps the model from before it, and "original" only once', () => {
  const versions = createVersionStore(),
    m = model();
  versions.beforeJob('doc', m);
  m.Info.Name = 'changed';
  versions.beforeJob('doc', m);
  assert.deepEqual(versions.names('doc'), ['original', 'before job 1', 'before job 2']);
  assert.equal(versions.get('doc', 'original').Info.Name, 'cup');
  assert.equal(versions.get('doc', 'before job 2').Info.Name, 'changed');
  // Saved copies do not follow later edits.
  m.Geosets[0].Vertices[0] = 9;
  assert.equal(versions.get('doc', 'before job 2').Geosets[0].Vertices[0], 0);
  assert.deepEqual(versions.names('other'), [], 'each model tab has its own versions');
});

test('saved versions are listed, compared and made current again exactly', () => {
  const versions = createVersionStore(),
    m = model();
  versions.beforeJob('doc', m);
  m.Geosets[0].Vertices[3] = 2;
  versions.save('doc', 'repair only', m, 'bindings fixed, keys untouched');
  m.Geosets[0].Vertices[3] = 5;
  m.Extra = { added: true };
  const list = versions.list('doc', m);
  assert.deepEqual(list.map(v => [v.name, v.kept, v.sameAsCurrent]), [
    ['original', 'automatically', false],
    ['before job 1', 'automatically', false],
    ['repair only', 'saved', false],
  ]);
  assert.equal(list[2].note, 'bindings fixed, keys untouched');
  const compared = versions.compare('doc', 'original', m, 'repair only');
  assert.equal(compared.differences, 1);
  assert.deepEqual(compared.bySection, { Geosets: 1 });
  // Going back runs through the normal AI edit preparation as one change set.
  const { scope, operations } = versions.restore('doc', 'repair only', m);
  const after = patchAiModel(m, operations);
  const prepared = prepareAiEdit(m, after, { scope });
  assert.ok(prepared.changeCount > 0);
  assert.equal(after.Geosets[0].Vertices[3], 2);
  assert.ok(after.Geosets[0].Vertices instanceof Float32Array, 'typed arrays stay typed');
  assert.equal('Extra' in after, false, 'sections added since are removed');
  assert.equal(versions.compare('doc', 'repair only', after).differences, 0);
});

test('names are checked and automatic versions do not pile up', () => {
  const versions = createVersionStore(),
    m = model();
  assert.throws(() => versions.save('doc', '', m), /short name/);
  assert.throws(() => versions.save('doc', 'original', m), /kept automatically/);
  assert.throws(() => versions.get('doc', 'missing'), /no version called "missing"/);
  versions.save('doc', 'mine', m);
  for (let job = 0; job < 20; job++) versions.beforeJob('doc', m);
  const names = versions.names('doc');
  assert.ok(names.includes('original') && names.includes('mine') && names.includes('before job 20'));
  assert.ok(!names.includes('before job 1'));
  assert.equal(names.filter(n => n.startsWith('before job')).length, 12);
});
