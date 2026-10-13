import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createDemoDocument, openDocument, EditorDocument } from '../src/editor-document.js';
import { prepareModelSave } from '../src/save-target.js';
import { clearEditorData, removeEditorData } from '../src/editor-data.js';
import { createGeosetTab, geosetTabsData } from '../src/geoset-tabs.js';
import { ANIMATION_SPEED_KEY, ANIMATION_SPEED_LEGACY_TAG, ANIMATION_SPEED_TAG, animationSpeed, setAnimationActualSpeed, setAnimationSpeedChecked } from '../src/animation-speed.js';

for (const format of ['mdl', 'mdx']) {
  test(`${format}: opening controls, selecting participants and setting 100% add no editor data`, () => {
    const original = createDemoDocument().serialize(format), doc = openDocument(original, `unused.${format}`);
    doc.apply('Choose participants', [], model => setAnimationSpeedChecked(model, 0, false));
    doc.apply('Master with no participants', [], model => setAnimationActualSpeed(model, null, 50));
    doc.apply('Original speed', [], model => setAnimationActualSpeed(model, 0, 100));
    const result = prepareModelSave(doc, format);
    assert.equal(doc.dirty, false);
    assert.equal(result.editorDataBytes, 0);
    assert.equal(result.withoutEditorData, null);
    assert.deepEqual(result.bytes, original);
  });

  test(`${format}: speed edits save no editor data while the session can still restore 100%`, () => {
    const doc = createDemoDocument(), originalFrames = doc.model.Bones[0].Translation.Keys.map(key => key.Frame);
    doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 137));
    const adjusted = prepareModelSave(doc, format);
    assert.equal(adjusted.editorDataBytes, 0);
    assert(!Buffer.from(adjusted.bytes).includes(ANIMATION_SPEED_TAG));
    assert.equal(animationSpeed(doc.model.Sequences[0]), 137);
    const recovery = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
    assert.equal(animationSpeed(recovery.model.Sequences[0]), 137);
    recovery.apply('Back to 100', [], model => setAnimationActualSpeed(model, 0, 100));
    assert.deepEqual(recovery.model.Bones[0].Translation.Keys.map(key => key.Frame), originalFrames);
  });

  test(`${format}: speed records from earlier versions are dropped on save`, () => {
    const doc = createDemoDocument();
    doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 137));
    const nativeBytes = Buffer.from(doc.serialize(format));
    for (const tag of [ANIMATION_SPEED_LEGACY_TAG, ANIMATION_SPEED_TAG]) {
      const text = Buffer.from(`// ${tag} {}\n`), header = Buffer.alloc(8); header.write('XLAS'); header.writeUInt32LE(text.length, 4);
      const bytes = format === 'mdl' ? Buffer.concat([text, nativeBytes]) : Buffer.concat([nativeBytes, header, text]);
      assert.deepEqual(Buffer.from(removeEditorData(bytes, format).bytes), nativeBytes);
      const reopened = openDocument(bytes, `legacy.${format}`);
      assert.equal(reopened.readOnly, false);
      const saved = prepareModelSave(reopened, format);
      assert.equal(saved.editorDataBytes, 0);
      assert.deepEqual(Buffer.from(saved.bytes), nativeBytes);
    }
  });

  test(`${format}: remove all editor data reports exact savings and preserves every other byte`, () => {
    const doc = createDemoDocument();
    doc.apply('Speed and tabs', [], model => { setAnimationActualSpeed(model, 0, 35); createGeosetTab(model, 'Armor', [0]); });
    const withMetadata = doc.serialize(format);
    const foreign = format === 'mdl' ? Buffer.from('// Artist credit: preserve this\r\n') : Buffer.from([88, 84, 82, 65, 4, 0, 0, 0, 1, 2, 3, 4]);
    const input = Buffer.concat([withMetadata, foreign]), reopened = openDocument(input, `foreign.${format}`);
    reopened.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 50));
    const before = structuredClone(reopened.model), saved = prepareModelSave(reopened, format);
    assert.deepEqual(reopened.model, before); // Preparing a choice or canceling it changes nothing.
    const stripped = removeEditorData(saved.bytes, format);
    assert(stripped.removedBytes > 0);
    assert.equal(saved.editorDataBytes, stripped.removedBytes);
    assert.deepEqual(saved.withoutEditorData, stripped.bytes);
    assert(Buffer.from(stripped.bytes).subarray(-foreign.length).equals(foreign));
    const clean = openDocument(stripped.bytes, `clean.${format}`);
    assert.equal(clean.readOnly, false);
    assert.deepEqual(geosetTabsData(clean.model), { tabs: [], geosets: {} });
    assert.deepEqual(clean.model.Sequences[0].Interval, reopened.model.Sequences[0].Interval);
    assert.deepEqual(clean.model.Bones[0].Translation.Keys.map(key => key.Frame), reopened.model.Bones[0].Translation.Keys.map(key => key.Frame));
    reopened.apply('Remove editor data', [], clearEditorData);
    reopened.rememberSerializedSnapshot(stripped.bytes, reopened.model);
    reopened.markSaved(stripped.bytes, `clean.${format}`);
    assert.equal(reopened.dirty, false);
    assert.equal(reopened.model[ANIMATION_SPEED_KEY], undefined);
    assert.deepEqual(reopened.serialize(), stripped.bytes);
    reopened.apply('Rename', ['Info'], model => { model.Info.Name = 'Same motion'; });
    assert.equal(prepareModelSave(reopened, format).editorDataBytes, 0);
    reopened.undo(); reopened.undo();
    assert.equal(animationSpeed(reopened.model.Sequences[0]), 50);
    assert.equal(geosetTabsData(reopened.model).tabs.length, 1);
  });
}
