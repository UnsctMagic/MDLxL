// Geoset animation bounds: a model whose geosets all have no per-animation bounds
// (geoset.Anims = []) keeps none, and no tool quietly adds them. A model with full
// tables is untouched by the rule. Every writer is driven on the real SD Footman and
// (for the animation, Forge and portrait tools) on the big ChaosDragonSkeleton_13.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { importGeosets, openDocument } from '../src/editor-document.js';
import { buildForgeMesh, commitForge } from '../src/forge.js';
import { collectPart, collectedPartModel, commitPart } from '../src/bits-and-parts.js';
import { glowUp } from '../src/glow-up.js';
import { createSequence, createSequenceFromCurrent, createPortraitSequence, fillSequenceExtents, portraitSequenceIndices } from '../src/sequence-editor.js';
import * as sequenceEditor from '../src/sequence-editor.js';
import { mergeSimilarGeosets } from '../src/geoset-operations.js';
import { recalculatePortraitExtents } from '../src/portrait-extents.js';
import { refreshPortraitBackground } from '../app/portrait-background.js';
import { createPortraitCamera } from '../app/portrait-camera-edit.js';
import { autoCorpse } from '../src/auto-corpse.js';
import { GLOBAL_LOOKS, LAYER_CHOICES, partFrame } from '../src/global-animation-looks.js';
import { compileAnimation, FX_SECTIONS } from '../src/global-animation-model.js';
import { authoredStack } from './helpers/fx-authored-stack.js';

const { fixturePath, testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');

// Parsed once; every test works on its own structuredClone.
const loaded = {};
function load(key) {
  if (!loaded[key]) {
    const file = key === 'footman' ? fixturePath('footman') : testModel('uv-performance', 'ChaosDragonSkeleton_13.mdx');
    const model = openDocument(readFileSync(file), file.split(/[\\/]/).pop()).model;
    // The dragon ships two stock geosets with a one-record table; bring every table to full length so
    // "full" means the same thing on both models.
    for (const geoset of model.Geosets) if (geoset.Anims.length !== model.Sequences.length) fillSequenceExtents(model, geoset, { keep: true });
    loaded[key] = model;
  }
  return structuredClone(loaded[key]);
}
const full = key => load(key);
const emptied = key => { const model = load(key); for (const geoset of model.Geosets) geoset.Anims = []; return model; };
const lengths = model => model.Geosets.map(geoset => geoset.Anims?.length ?? 'none');
const assertAllEmpty = (model, label) => assert.ok(model.Geosets.every(geoset => !geoset.Anims?.length), `${label}: every geoset should have no animation bounds; Anims lengths per geoset = [${lengths(model)}] (${model.Sequences.length} animations)`);
const assertFull = (model, label, count = model.Sequences.length) => assert.ok(model.Geosets.every(geoset => geoset.Anims?.length === count), `${label}: every geoset should have ${count} animation bounds; Anims lengths per geoset = [${lengths(model)}]`);

const MODELS = ['footman', 'dragon'];
const FOOTMAN_ONLY = ['footman'];

// ---------- 1. Forge ----------
for (const key of MODELS) {
  const forge = model => {
    const mesh = buildForgeMesh({ mask: new Uint8Array(4).fill(1), width: 2, height: 2 });
    const before = model.Geosets.length, result = commitForge(model, mesh, { texturePath: 'Textures\\White.blp' });
    assert.ok(model.Geosets.length > before && result.geosetIndices.length > 0, `${key}: Forge added no geoset`);
    return result;
  };
  test(`Forge import (${key}): an emptied model gets no animation bounds on the new geosets`, () => {
    const model = emptied(key); forge(model); assertAllEmpty(model, 'after Forge');
  });
  test(`Forge import (${key}): a full-table model gets full tables on the new geosets`, () => {
    const model = full(key); forge(model); assertFull(model, 'after Forge');
  });
}

// ---------- 2. Collect Bit / Bit commit ----------
const everyVertex = (model, index = 0) => ({ [index]: Array.from({ length: model.Geosets[index].Vertices.length / 3 }, (_, i) => i) });
test('Collect Bit (Footman): a Bit from an emptied model has no tables, and neither has the model it is committed to', () => {
  const source = emptied('footman'), bit = collectPart(source, everyVertex(source));
  assertAllEmpty(bit, 'collected Bit');
  const target = emptied('footman'), before = target.Geosets.length;
  commitPart(target, bit);
  assert.ok(target.Geosets.length > before, 'Bit added no geoset');
  assertAllEmpty(target, 'after Bit commit into emptied model');
});
test('Collect Bit (Footman): a Bit from a full model is full and keeps full tables in a full model', () => {
  const source = full('footman'), bit = collectPart(source, everyVertex(source));
  assertFull(bit, 'collected Bit');
  const target = full('footman'), before = target.Geosets.length;
  commitPart(target, bit);
  assert.ok(target.Geosets.length > before, 'Bit added no geoset');
  assertFull(target, 'after Bit commit into full model');
});
test('Bit commit (Footman): the target decides, not the Bit', () => {
  const fullBit = collectPart(full('footman'), everyVertex(full('footman'))), emptyBit = collectPart(emptied('footman'), everyVertex(emptied('footman')));
  const emptyTarget = emptied('footman'); commitPart(emptyTarget, fullBit);
  assertAllEmpty(emptyTarget, 'full Bit into emptied model');
  const fullTarget = full('footman'); commitPart(fullTarget, emptyBit);
  assertFull(fullTarget, 'empty Bit into full model');
});
test('Collected Bit model (Footman): saved animations keep empty tables from an emptied donor, one record each from a full donor', () => {
  const animations = [{ sequenceIndex: 0, name: 'Stand' }];
  const emptyDonor = emptied('footman'), emptyBit = collectPart(emptyDonor, everyVertex(emptyDonor));
  assertAllEmpty(collectedPartModel(emptyBit, { name: 'x', animations }), 'emptied donor, one animation');
  const fullDonor = full('footman'), fullBit = collectPart(fullDonor, everyVertex(fullDonor));
  assertFull(collectedPartModel(fullBit, { name: 'x', animations }), 'full donor, one animation', 1);
});

// ---------- 3. Glow Up ----------
test('Glow Up (Footman): added glow geosets get no tables on an emptied model', () => {
  const model = emptied('footman'), before = model.Geosets.length;
  glowUp(model, { origin: true });
  assert.ok(model.Geosets.length > before, 'Glow Up added no geoset');
  assertAllEmpty(model, 'after Glow Up');
});
test('Glow Up (Footman): added glow geosets get full tables on a full model', () => {
  const model = full('footman'), before = model.Geosets.length;
  glowUp(model, { origin: true });
  assert.ok(model.Geosets.length > before, 'Glow Up added no geoset');
  assertFull(model, 'after Glow Up');
});

// ---------- 4. New animation ----------
for (const key of MODELS) {
  test(`New animation (${key}): an emptied model stays without tables`, () => {
    const model = emptied(key); createSequence(model, 1000); assertAllEmpty(model, 'after createSequence');
    createSequence(model, 500, { extents: 'ifPresent' }); assertAllEmpty(model, 'after ifPresent createSequence');
  });
  test(`New animation (${key}): a full model gets one more record on every geoset`, () => {
    const model = full(key), count = model.Sequences.length; createSequence(model, 1000); assertFull(model, 'after createSequence', count + 1);
  });
}
test('New animation (Footman): the model\'s very first animation starts a table on every geoset', () => {
  const model = emptied('footman'); model.Sequences = [];
  createSequence(model, 1000);
  assert.equal(model.Sequences.length, 1);
  assertFull(model, 'after the first animation', 1);
});

// ---------- 5. Animation copy ----------
for (const key of MODELS) {
  test(`Animation copy (${key}): an emptied model stays without tables`, () => {
    const model = emptied(key); createSequenceFromCurrent(model, 0); assertAllEmpty(model, 'after copy');
  });
  test(`Animation copy (${key}): a full model gets the copied record on every geoset`, () => {
    const model = full(key), count = model.Sequences.length, source = structuredClone(model.Geosets.map(g => g.Anims[0]));
    const index = createSequenceFromCurrent(model, 0);
    assertFull(model, 'after copy', count + 1);
    model.Geosets.forEach((g, i) => assert.deepEqual(g.Anims[index], source[i], `geoset ${i} copy differs from animation 0`));
  });
}

// ---------- 6. Geoset merge (unchanged code; must stay as it was) ----------
const mergeablePair = model => {
  model.GeosetAnims = [];
  const copy = structuredClone(model.Geosets[0]), index = model.Geosets.push(copy) - 1;
  return { 0: [0], [index]: [0] };
};
test('Geoset merge (Footman): two empty-table geosets merge and stay empty', () => {
  const model = emptied('footman'), selection = mergeablePair(model), before = model.Geosets.length;
  assert.ok(mergeSimilarGeosets(model, selection));
  assert.equal(model.Geosets.length, before - 1);
  assertAllEmpty(model, 'after merge');
});
test('Geoset merge (Footman): two full-table geosets merge and stay full', () => {
  const model = full('footman'), selection = mergeablePair(model), before = model.Geosets.length;
  assert.ok(mergeSimilarGeosets(model, selection));
  assert.equal(model.Geosets.length, before - 1);
  assertFull(model, 'after merge');
});

// ---------- 7. Portrait edits ----------
for (const key of MODELS) {
  const portrait = model => {
    const index = createPortraitSequence(model, 1000);
    assert.ok(portraitSequenceIndices(model).includes(index));
    return index;
  };
  test(`Portrait edits (${key}): an emptied model stays without tables through Create Portrait and Recalculate`, () => {
    const model = emptied(key), index = portrait(model); assertAllEmpty(model, 'after createPortraitSequence');
    recalculatePortraitExtents(model, [index]); assertAllEmpty(model, 'after recalculatePortraitExtents');
  });
  test(`Portrait edits (${key}): a full model gets and keeps a record on every geoset`, () => {
    const model = full(key), count = model.Sequences.length, index = portrait(model); assertFull(model, 'after createPortraitSequence', count + 1);
    recalculatePortraitExtents(model, [index]); assertFull(model, 'after recalculatePortraitExtents', count + 1);
  });
  const background = emptyModel => {
    const model = emptyModel ? emptied(key) : full(key), count = model.Sequences.length;
    if (!portraitSequenceIndices(model).length) portrait(model);
    if (!model.Cameras?.length) createPortraitCamera(model, { position: [200, -60, 150], target: [0, 0, 140], fieldOfView: Math.PI / 4, near: 8, far: 2000 });
    // The dragon already carries a backdrop, so there Refresh only moves it; Footman gets a new one.
    const geosets = model.Geosets.length, result = refreshPortraitBackground(model, 0);
    assert.equal(result.created, key === 'footman', `${key}: backdrop created = ${result.created}`);
    assert.equal(model.Geosets.length, geosets + (result.created ? 1 : 0));
    return { model, count };
  };
  test(`Add Portrait Background (${key}): the backdrop geoset gets no table on an emptied model`, () => {
    const { model } = background(true); assertAllEmpty(model, 'after refreshPortraitBackground');
  });
  test(`Add Portrait Background (${key}): the backdrop geoset gets a full table on a full model`, () => {
    const { model } = background(false); assertFull(model, 'after refreshPortraitBackground');
  });
}

// ---------- 8. Auto Corpse ----------
test('Auto Corpse (Footman): the new corpse geoset gets no table on an emptied model', () => {
  const model = emptied('footman'), before = model.Geosets.length;
  autoCorpse(model);
  assert.ok(model.Geosets.length > before, `Auto Corpse added no geoset (${before} geosets)`);
  assertAllEmpty(model, 'after Auto Corpse');
});
test('Auto Corpse (Footman): the new corpse geoset gets a full table on a full model', () => {
  const model = full('footman'), before = model.Geosets.length;
  autoCorpse(model);
  assert.ok(model.Geosets.length > before, `Auto Corpse added no geoset (${before} geosets)`);
  assertFull(model, 'after Auto Corpse');
});

// ---------- 9. Paste between models ----------
test('Paste between models (Footman): a geoset pasted into an emptied model arrives without a table', () => {
  const target = emptied('footman'), source = full('footman'), before = target.Geosets.length;
  importGeosets(target, source, [0]);
  assert.equal(target.Geosets.length, before + 1);
  assertAllEmpty(target, 'after paste into emptied model');
});
test('Paste between models (Footman): into a full model the pasted geoset keeps the donor\'s table as before', () => {
  const target = full('footman'), source = full('footman'), before = target.Geosets.length;
  importGeosets(target, source, [0]);
  assert.equal(target.Geosets.length, before + 1);
  assert.deepEqual(target.Geosets.at(-1).Anims, source.Geosets[0].Anims, 'pasted geoset table differs from the donor\'s');
  assertFull(target, 'after paste into full model');
});

// ---------- FX cards ----------
// Looks whose layers add card/quad geosets (several reach quadBounds).
const FX_LOOKS = ['flaming-sword', 'lava', 'fx-rune-circle', 'fx-orbs', 'spell-ward'];
const applyFx = (model, lookId) => {
  const look = GLOBAL_LOOKS.find(item => item.id === lookId), frame = partFrame(model.Geosets[0]), before = model.Geosets.length;
  const donors = { rune: { Geosets: [structuredClone(model.Geosets[0])], Materials: [{ Layers: [{ TextureID: 0 }] }], Textures: [{ Image: LAYER_CHOICES.find(l => l.type === 'Rune').image }] } };
  // compileAnimation works on the model in place; EditorDocument.apply would only add undo bookkeeping.
  compileAnimation(model, 0, authoredStack(look, frame, 'bounds-test'), donors);
  assert.ok(model.Geosets.length > before, `${lookId} added no geoset`);
  return before;
};
for (const lookId of FX_LOOKS) {
  test(`FX layer "${lookId}" (Footman): its geosets get no tables on an emptied model`, () => {
    const model = emptied('footman'); applyFx(model, lookId); assertAllEmpty(model, `after FX ${lookId}`);
  });
  test(`FX layer "${lookId}" (Footman): its geosets get full tables on a full model`, () => {
    const model = full('footman'); applyFx(model, lookId); assertFull(model, `after FX ${lookId}`);
  });
}

// ---------- 10. Mixed model (Blizzard style) ----------
const mixed = () => { const model = full('footman'); model.Geosets[model.Geosets.length - 1].Anims = []; return model; };
test('Mixed model (Footman): New animation extends the geosets with tables and leaves the empty one empty', () => {
  const model = mixed(), count = model.Sequences.length, last = model.Geosets.length - 1;
  createSequence(model, 1000);
  assert.deepEqual(lengths(model), model.Geosets.map((_, i) => i === last ? 0 : count + 1), `after createSequence: [${lengths(model)}]`);
});
test('Mixed model (Footman): Recalculate portrait refreshes the geosets with tables and leaves the empty one empty', () => {
  const model = mixed(), last = model.Geosets.length - 1, count = model.Sequences.length;
  const index = createPortraitSequence(model, 1000);
  // Wipe the records of the new Portrait so a refresh is visible.
  for (const [i, geoset] of model.Geosets.entries()) if (i !== last) geoset.Anims[index] = { MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 };
  recalculatePortraitExtents(model, [index]);
  assert.deepEqual(lengths(model), model.Geosets.map((_, i) => i === last ? 0 : count + 1), `after recalculatePortraitExtents: [${lengths(model)}]`);
  for (const [i, geoset] of model.Geosets.entries()) if (i !== last) assert.ok(geoset.Anims[index].BoundsRadius > 0 && geoset.Anims[index].MaximumExtent.some(v => v > 0), `geoset ${i} portrait bounds were not refreshed: ${JSON.stringify(geoset.Anims[index])}`);
});

// ---------- 11. The rule itself ----------
const keeps = sequenceEditor.keepsGeosetAnimationBounds;
const box = () => ({ MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 });
test('keepsGeosetAnimationBounds: nothing to judge means yes', () => {
  assert.equal(typeof keeps, 'function', 'keepsGeosetAnimationBounds is not exported by src/sequence-editor.js');
  assert.equal(keeps({ Sequences: [], Geosets: [{ Anims: [] }] }), true, 'no sequences');
  assert.equal(keeps({ Geosets: [{ Anims: [] }] }), true, 'sequences missing');
  assert.equal(keeps({ Sequences: [{}], Geosets: [] }), true, 'no geosets');
  assert.equal(keeps({ Sequences: [{}] }), true, 'geosets missing');
});
test('keepsGeosetAnimationBounds: all empty means no, any table means yes, ignore leaves a geoset out', () => {
  const none = { Anims: [] }, some = { Anims: [box()] };
  assert.equal(keeps({ Sequences: [{}], Geosets: [none, { }] }), false, 'all empty (one without Anims at all)');
  assert.equal(keeps({ Sequences: [{}], Geosets: [none, some] }), true, 'one non-empty');
  assert.equal(keeps({ Sequences: [{}], Geosets: [none, some] }, [some]), false, 'the only table is ignored');
  assert.equal(keeps({ Sequences: [{}], Geosets: [none, some] }, [none]), true, 'an empty geoset is ignored');
  assert.equal(keeps({ Sequences: [{}], Geosets: [some] }, [some]), true, 'ignoring every geoset leaves nothing to judge');
});
test('keepsGeosetAnimationBounds: real Footman', () => {
  assert.equal(typeof keeps, 'function', 'keepsGeosetAnimationBounds is not exported by src/sequence-editor.js');
  assert.equal(keeps(full('footman')), true);
  assert.equal(keeps(emptied('footman')), false);
  const model = full('footman'); for (const [i, geoset] of model.Geosets.entries()) if (i) geoset.Anims = [];
  assert.equal(keeps(model), true, 'one geoset with a table');
  assert.equal(keeps(model, [model.Geosets[0]]), false, 'that geoset ignored');
});
