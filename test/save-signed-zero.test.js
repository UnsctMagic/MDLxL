import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDocument, createNode, openDocument, EditorDocument } from '../src/editor-document.js';
import { assertModelEquivalent, modelDifferenceReport } from '../src/save-equivalence.js';

const f = (...values) => Float32Array.from(values);

test('save verification treats signed zero as the same model coordinate', () => {
  for (const format of ['mdx', 'mdl']) {
    const expected = { PivotPoints: [f(1, -0, 2)], Bones: [{ Translation: { Keys: [{ Vector: f(-0, 3, 0) }] } }] };
    const actual = { PivotPoints: [f(1, 0, 2)], Bones: [{ Translation: { Keys: [{ Vector: f(0, 3, -0) }] } }] };
    assertModelEquivalent(expected, actual, { format });
    assertModelEquivalent(actual, expected, { format });
  }
});

test('save verification still rejects distinct float32 coordinates and integer fields', () => {
  const tiny = 2 ** -149;
  for (const value of [tiny, -tiny, 1 + 2 ** -23]) {
    const before = { PivotPoints: [f(value === 1 + 2 ** -23 ? 1 : 0, 0, 0)] };
    const after = { PivotPoints: [f(value, 0, 0)] };
    assert.deepEqual(modelDifferenceReport(before, after).differences, ['PivotPoints[0][0]']);
  }
  assert.throws(() => assertModelEquivalent({ ObjectId: 16777216 }, { ObjectId: 16777217 }), /ObjectId/);
});

for (const format of ['mdx', 'mdl']) test(`${format}: recovered edits with a signed-zero pivot save without changing live state`, () => {
  const source = createDemoDocument();
  source.apply('Add collision', ['CollisionShapes', 'PivotPoints'], model => {
    const node = createNode(model, 'CollisionShape');
    node.PivotPoint.set([0, 0, 0]);
  });
  const bytes = Buffer.from(source.serialize('mdx'));
  for (let p = 4; p < bytes.length; p += 8 + bytes.readUInt32LE(p + 4)) {
    if (bytes.toString('ascii', p, p + 4) === 'PIVT') {
      bytes.writeFloatLE(-0, p + 8 + (source.model.PivotPoints.length - 1) * 12 + 4);
      break;
    }
  }
  const doc = openDocument(bytes, 'signed-zero.mdx');
  assert.ok(Object.is(doc.model.PivotPoints.at(-1)[1], -0));
  doc.apply('Move another pivot', ['PivotPoints'], model => { model.PivotPoints[0][0] += 1; });
  for (const compact of [false, true]) {
    const recovered = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ compact }));
    const before = structuredClone(recovered.model), history = recovered.historyStats;
    const saved = recovered.serialize(format), reopened = openDocument(saved, `saved.${format}`);
    assert.equal(reopened.readOnly, false);
    assertModelEquivalent(before, reopened.model, { format });
    assert.deepEqual(recovered.model, before);
    assert.deepEqual(recovered.historyStats, history);
    recovered.markSaved(saved, `saved.${format}`);
    assert.equal(recovered.dirty, false);
    assert.deepEqual(recovered.serialize(format), saved);
  }
});
