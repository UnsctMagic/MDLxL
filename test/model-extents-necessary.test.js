import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { openDocument } from '../src/editor-document.js';
import { runOptimizeStage, sanityProposals } from '../src/optimizexl.js';
import { invalidBoundsTargets } from '../src/optimizexl-bounds.js';
import { defaultExtentsChoice, extentsDiffer, geosetAnimationBoundsBytes, offersNecessaryExtents, boundsProposals } from '../src/model-extents.js';
import { geosetAlphaTrack, geosetVisibleIn } from '../src/geoset-extras.js';
import { isGlobalTrack } from '../src/animation.js';
import { classifyHiveFindings } from '../src/optimizexl-diagnostics.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
import { sanityTest } from './helpers/hive.mjs';
import { testModel } from './helpers/fixtures.cjs';

// Calculate extents on Classic/SD models: "Full" keeps a box per animation on every geoset, "Necessary only"
// leaves those out and grows each geoset's own box over every animation that shows it (as Blizzard's files do).
const read = file => new Uint8Array(fs.readFileSync(testModel(file)));
const archnathid = () => read('corpus-sd800/creeps__archnathid.mdx');
const shandris = () => read('corpus-sd800/nightelf__shandris.mdx');
const abomination = () => read('corpus-sd800/undead__abominationexplosion.mdx');
const nurgle = () => read('optimizexl-bounds/WH_WOC_WarriorNurgle_Flail11_Optimized.mdx');
const open = bytes => openDocument(new Uint8Array(bytes), 'x.mdx');
const modelOf = bytes => open(bytes).model;
const boundsFix = model => sanityProposals(model).find(f => f.kind === 'bounds');
const apply = (bytes, settings, fix) => runOptimizeStage(bytes, 'sanity', settings, fix);
const hive = bytes => { const r = sanityTest(bytes); return { ...r, findings: flattenHiveFindings(r.nodes) }; };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const extent = () => ({ MinimumExtent: new Float32Array([-999, -999, -999]), MaximumExtent: new Float32Array([999, 999, 999]), BoundsRadius: 2000 });
// Extent fields are the only thing Calculate extents may change.
const EXTENT_FIELDS = ['MinimumExtent', 'MaximumExtent', 'BoundsRadius', 'Anims'];
const strip = model => { const copy = structuredClone(model); for (const record of [copy.Info, ...copy.Sequences, ...copy.Geosets]) for (const field of EXTENT_FIELDS) delete record[field]; return copy; };
const kb = bytes => (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0);
// Same test as countsAsVisible in src/model-extents.js.
const shown = (model, index, sequence) => { const track = geosetAlphaTrack(model, index); return isGlobalTrack(track) || geosetVisibleIn(model, track, sequence, sequence.Interval || [0, 0]); };
const stillBox = geoset => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geoset.Vertices.length; i++) { const c = i % 3; min[c] = Math.min(min[c], geoset.Vertices[i]); max[c] = Math.max(max[c], geoset.Vertices[i]); }
  return { min, max };
};
const inside = (outer, innerMin, innerMax) => [0, 1, 2].every(c => outer.MinimumExtent[c] <= innerMin[c] && outer.MaximumExtent[c] >= innerMax[c]);

// Measured on main 16904f82 (before this feature): sha256 of runOptimizeStage(bytes, 'sanity', {}, fix).bytes
// for the extents proposal, run against a `git archive 16904f82` copy of src/app/test/public.
const MAIN_HASH = {
  archnathid: '8232c5c54313ff43a9abe3803679428ec9c3dfabbefeb7e7f5db12b4a21764c7',
  shandris: 'f1d55993087e495246f5f6856b592912e4422750b836efcba0b7d0c8964f7934',
};

test('Necessary only drops every geoset animation box and grows each geoset box over the animations that show it', () => {
  const bytes = archnathid(), original = modelOf(bytes), fix = boundsFix(original);
  const saved = geosetAnimationBoundsBytes(original);
  assert.equal(saved, 7 * 10 * 28);
  assert.equal(fix.choiceLabel, 'Geoset animation bounds');
  assert.equal(fix.choice, 'full');
  assert.deepEqual(fix.choices, [['full', 'Full'], ['necessary', `Necessary only (saves ${kb(saved)} KB)`]]);
  assert.equal(fix.choices[1][1], 'Necessary only (saves 1.9 KB)');

  const full = apply(bytes, { choice: 'full' }, fix), necessary = apply(bytes, { choice: 'necessary' }, fix);
  const fullModel = modelOf(full.bytes), necModel = modelOf(necessary.bytes);
  assert.equal(necModel.Geosets.length, 7);
  for (const geoset of necModel.Geosets) assert.equal(geoset.Anims.length, 0);
  for (const geoset of fullModel.Geosets) assert.equal(geoset.Anims.length, 10);
  // Model and animation boxes do not depend on the choice.
  assert.deepEqual(necModel.Info, fullModel.Info);
  assert.deepEqual(necModel.Sequences, fullModel.Sequences);
  // The 28 bytes per box are the whole saving.
  assert.equal(bytes.length - necessary.afterBytes, saved);
  assert.equal(full.afterBytes - necessary.afterBytes, 7 * 10 * 28);
  // Nothing but extents differs.
  assert.deepEqual(strip(necModel), strip(fullModel));

  let hidden = 0, widened = false;
  necModel.Geosets.forEach((geoset, index) => {
    const still = stillBox(original.Geosets[index]);
    assert.ok(inside(geoset, still.min, still.max), `geoset ${index} box holds its still pose`);
    original.Sequences.forEach((sequence, si) => {
      const record = fullModel.Geosets[index].Anims[si];
      if (!shown(original, index, sequence)) { hidden++; return; }
      assert.ok(inside(geoset, record.MinimumExtent, record.MaximumExtent), `geoset ${index} box holds Full's box for ${sequence.Name}`);
    });
    const own = fullModel.Geosets[index];
    if ([0, 1, 2].some(c => geoset.MinimumExtent[c] < own.MinimumExtent[c] || geoset.MaximumExtent[c] > own.MaximumExtent[c])) widened = true;
  });
  assert.ok(hidden > 0, 'archnathid hides some geosets in some animations');
  assert.ok(widened, 'a Necessary geoset box is larger than the same geoset box in Full');
});

test('Full is unchanged: the same bytes as main for default and explicit Full', () => {
  // Preservation test: passes on main too (no choice there), which is the point.
  for (const [name, bytes] of [['archnathid', archnathid()], ['shandris', shandris()]]) {
    const fix = boundsFix(modelOf(bytes));
    assert.equal(sha(apply(bytes, {}, fix).bytes), MAIN_HASH[name], `${name} default`);
    assert.equal(sha(apply(bytes, { choice: 'full' }, fix).bytes), MAIN_HASH[name], `${name} Full`);
  }
});

test('a table with no records is not damage; a partial table still is', () => {
  const bytes = shandris(), model = modelOf(bytes);
  assert.equal(model.Sequences.length, 13);
  assert.ok(!invalidBoundsTargets(model).some(t => t.sequenceExtents), 'empty tables are not targets');
  const zero = hive(bytes).findings.filter(f => f.message.startsWith('Number of sequence extents (0) does not match'));
  assert.ok(zero.length > 0, 'Hive reports the empty table');
  for (const f of classifyHiveFindings(zero, sanityProposals(model))) { assert.equal(f.status, 'note'); assert.equal(f.fixId, undefined); assert.equal(f.kind, 'sequenceExtents'); }

  const doc = open(bytes), complete = model.Geosets.findIndex(g => g.Anims.length === 13);
  assert.ok(complete >= 0);
  doc.apply('Partial table', ['Geosets'], m => { m.Geosets[complete].Anims = m.Geosets[complete].Anims.slice(0, 5); });
  const partialBytes = doc.serialize('mdx'), partial = modelOf(partialBytes);
  const targets = invalidBoundsTargets(partial).filter(t => t.sequenceExtents);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].geoset, complete);
  const fix = boundsFix(partial);
  assert.ok(fix.targets.some(t => t.sequenceExtents && t.geoset === complete));
  const five = hive(partialBytes).findings.filter(f => f.message.startsWith('Number of sequence extents (5) does not match'));
  assert.equal(five.length, 1);
  const [classified] = classifyHiveFindings(five, [fix]);
  assert.equal(classified.status, 'preview');
  assert.equal(classified.fixId, fix.id);
});

test('the default choice follows the model\'s own state', () => {
  for (const [name, bytes] of [['abominationexplosion', abomination()], ['nurgle flail', nurgle()]]) {
    const model = modelOf(bytes), [fix] = boundsProposals(model);
    assert.equal(defaultExtentsChoice(model), 'necessary', name);
    assert.equal(fix.choice, 'necessary', name);
    assert.equal(fix.choices[1][1], 'Necessary only', name);
  }
  for (const [name, bytes] of [['archnathid', archnathid()], ['shandris', shandris()]]) {
    const model = modelOf(bytes);
    assert.equal(defaultExtentsChoice(model), 'full', name);
    assert.equal(boundsFix(model).choice, 'full', name);
  }
  // Reforged HD keeps its tables. Its extents are not computed here: that takes over a minute.
  const hd = modelOf(read('forge-hd/Footman.mdx'));
  assert.equal(offersNecessaryExtents(hd), false);
  assert.equal(defaultExtentsChoice(hd), 'full');
  assert.equal(offersNecessaryExtents(modelOf(archnathid())), true);

  // One geoset with a partial table keeps the model in Necessary only and is the one broken target.
  const doc = open(nurgle());
  doc.apply('Partial table', ['Geosets'], m => { m.Geosets[0].Anims = Array.from({ length: 3 }, extent); });
  const bytes = doc.serialize('mdx'), model = modelOf(bytes), fix = boundsFix(model);
  assert.equal(defaultExtentsChoice(model), 'necessary');
  assert.equal(fix.choice, 'necessary');
  assert.equal(fix.targets.length, 1);
  assert.equal(fix.targets[0].geoset, 0);
  assert.ok(fix.targets[0].sequenceExtents);
  const after = modelOf(apply(bytes, {}, fix).bytes);
  assert.equal(after.Geosets.length, model.Geosets.length);
  for (const geoset of after.Geosets) assert.equal(geoset.Anims.length, 0);
});

test('after Necessary only the model is not offered Calculate extents again', () => {
  const nurgleBytes = nurgle();
  const cases = [['archnathid', archnathid(), { choice: 'necessary' }], ['nurgle flail', nurgleBytes, {}]];
  for (const [name, bytes, settings] of cases) {
    const fix = boundsFix(modelOf(bytes)), after = modelOf(apply(bytes, settings, fix).bytes);
    for (const geoset of after.Geosets) assert.equal(geoset.Anims.length, 0, name);
    assert.ok(!sanityProposals(after).some(f => f.kind === 'bounds'), `${name} is not offered Calculate extents again`);
    assert.equal(defaultExtentsChoice(after), 'necessary', name);
    assert.equal(extentsDiffer(after), false, name);
  }
});
