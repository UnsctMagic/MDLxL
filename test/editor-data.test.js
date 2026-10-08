import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createDemoDocument, openDocument, EditorDocument } from '../src/editor-document.js';
import { prepareModelSave } from '../src/save-target.js';
import { clearEditorData, removeEditorData } from '../src/editor-data.js';
import { createGeosetTab, geosetTabsData } from '../src/geoset-tabs.js';
import { ANIMATION_SPEED_LEGACY_TAG, ANIMATION_SPEED_TAG, animationSpeedData, animationSpeed, setAnimationActualSpeed, setAnimationSpeedChecked, setRememberOriginalTiming, rememberOriginalTiming } from '../src/animation-speed.js';

const prefix = `// ${ANIMATION_SPEED_LEGACY_TAG} `;
function legacyRecord(model, format) {
  const text = Buffer.from(prefix + JSON.stringify(animationSpeedData(model)) + '\n');
  if (format === 'mdl') return text;
  const header = Buffer.alloc(8); header.write('XLAS'); header.writeUInt32LE(text.length, 4);
  return Buffer.concat([header, text]);
}

for (const format of ['mdl', 'mdx']) {
  test(`${format}: opening controls, selecting participants and setting 100% add no editor data`, () => {
    const original = createDemoDocument().serialize(format), doc = openDocument(original, `unused.${format}`);
    doc.apply('Choose participants', [], model => setAnimationSpeedChecked(model, 0, false));
    doc.apply('Master with no participants', [], model => setAnimationActualSpeed(model, null, 50));
    doc.apply('Original speed', [], model => setAnimationActualSpeed(model, 0, 100));
    doc.apply('Do not remember', [], model => setRememberOriginalTiming(model, false));
    doc.apply('Remember', [], model => setRememberOriginalTiming(model, true));
    const result = prepareModelSave(doc, format);
    assert.equal(animationSpeedData(doc.model), null);
    assert.equal(doc.dirty, false);
    assert.equal(result.editorDataBytes, 0);
    assert.equal(result.withoutEditorData, null);
    assert.deepEqual(result.bytes, original);
  });

  test(`${format}: Remember Original Timing controls persistence while keeping current playback and session restoration`, () => {
    const doc = createDemoDocument(), originalFrames = doc.model.Bones[0].Translation.Keys.map(key => key.Frame);
    doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 137));
    const adjusted = doc.serialize(format), native = removeEditorData(adjusted, format).bytes;
    doc.apply('Do not remember', [], model => setRememberOriginalTiming(model, false));
    const without = doc.serialize(format);
    assert.deepEqual(without, native);
    assert.equal(animationSpeedData(openDocument(without, `without.${format}`).model), null);
    assert.equal(animationSpeed(doc.model.Sequences[0]), 137);
    const recovery = EditorDocument.restoreRecoveryState(doc.captureRecoveryState());
    assert.equal(rememberOriginalTiming(recovery.model), false);
    recovery.apply('Back to 100', [], model => setAnimationActualSpeed(model, 0, 100));
    assert.deepEqual(recovery.model.Bones[0].Translation.Keys.map(key => key.Frame), originalFrames);
    doc.apply('Remember again', [], model => setRememberOriginalTiming(model, true));
    assert.deepEqual(doc.serialize(format), adjusted);
    doc.undo(); assert.deepEqual(doc.serialize(format), without);
  });

  test(`${format}: legacy records compress on save and retain exact restoration through reopen and conversion`, () => {
    const doc = createDemoDocument(), originalFrames = doc.model.Bones[0].Translation.Keys.map(key => key.Frame);
    doc.apply('Speed', [], model => setAnimationActualSpeed(model, 0, 137));
    const native = removeEditorData(doc.serialize(format), format).bytes, legacy = legacyRecord(doc.model, format);
    const bytes = format === 'mdl' ? Buffer.concat([legacy, native]) : Buffer.concat([native, legacy]);
    let reopened = openDocument(bytes, `legacy.${format}`);
    assert.equal(reopened.readOnly, false);
    assert.deepEqual(animationSpeedData(reopened.model), animationSpeedData(doc.model));
    const saved = prepareModelSave(reopened, format);
    assert(saved.editorDataBytes < legacy.length);
    assert(Buffer.from(saved.bytes).includes(ANIMATION_SPEED_TAG));
    assert(!Buffer.from(saved.bytes).includes(ANIMATION_SPEED_LEGACY_TAG));
    assert.deepEqual(saved.withoutEditorData, native);
    reopened = openDocument(saved.bytes, saved.name);
    const opposite = format === 'mdl' ? 'mdx' : 'mdl';
    reopened = openDocument(reopened.serialize(opposite), `converted.${opposite}`);
    reopened.apply('Restore', [], model => setAnimationActualSpeed(model, 0, 100));
    assert.deepEqual(reopened.model.Bones[0].Translation.Keys.map(key => key.Frame), originalFrames);
  });

  test(`${format}: remove all editor data reports exact savings and preserves every other byte`, () => {
    const doc = createDemoDocument();
    doc.apply('Speed and tabs', [], model => { setAnimationActualSpeed(model, 0, 35); createGeosetTab(model, 'Armor', [0]); });
    const withMetadata = doc.serialize(format);
    const foreign = format === 'mdl' ? Buffer.from('// Artist credit: preserve this\r\n') : Buffer.from([88, 84, 82, 65, 4, 0, 0, 0, 1, 2, 3, 4]);
    const input = Buffer.concat([withMetadata, foreign]), reopened = openDocument(input, `foreign.${format}`);
    const before = structuredClone(reopened.model), saved = prepareModelSave(reopened, format);
    assert.deepEqual(reopened.model, before); // Preparing a choice or canceling it changes nothing.
    const stripped = removeEditorData(input, format);
    assert.equal(saved.editorDataBytes, input.length - stripped.bytes.length);
    assert.deepEqual(saved.withoutEditorData, stripped.bytes);
    assert(Buffer.from(stripped.bytes).subarray(-foreign.length).equals(foreign));
    const clean = openDocument(stripped.bytes, `clean.${format}`);
    assert.equal(clean.readOnly, false);
    assert.equal(animationSpeedData(clean.model), null);
    assert.deepEqual(geosetTabsData(clean.model), { tabs: [], geosets: {} });
    assert.deepEqual(clean.model.Sequences[0].Interval, reopened.model.Sequences[0].Interval);
    assert.deepEqual(clean.model.Bones[0].Translation.Keys.map(key => key.Frame), reopened.model.Bones[0].Translation.Keys.map(key => key.Frame));
    reopened.apply('Remove editor data', [], clearEditorData);
    reopened.rememberSerializedSnapshot(stripped.bytes, reopened.model);
    reopened.markSaved(stripped.bytes, `clean.${format}`);
    assert.equal(reopened.dirty, false);
    assert.equal(rememberOriginalTiming(reopened.model), false);
    assert.deepEqual(reopened.serialize(), stripped.bytes);
    reopened.apply('Rename', ['Info'], model => { model.Info.Name = 'Same motion'; });
    assert.equal(prepareModelSave(reopened, format).editorDataBytes, 0);
    reopened.undo(); reopened.undo();
    assert(animationSpeedData(reopened.model));
    assert.equal(geosetTabsData(reopened.model).tabs.length, 1);
  });
}
