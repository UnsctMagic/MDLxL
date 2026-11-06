import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMDX } from 'war3-model';
import { boundsProposals, calculateExtents, extentsDiffer, extentsExclusions } from '../src/model-extents.js';

const load = path => parseMDX(readFileSync(new URL(path, import.meta.url)).buffer);
const top = record => record.MaximumExtent[2];

test('hero glow and effect planes stay out of model and animation extents', () => {
  const model = load('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  assert.deepEqual([...extentsExclusions(model)], [[3, 'effect'], [4, 'glow']]);
  assert.equal(Math.round(top(model.Info)), 252);
  assert.equal(boundsProposals(model)[0].kind, 'bounds');
  calculateExtents(model);
  // The 252-high glow plane no longer lifts the model or its Stand box.
  assert.ok(top(model.Info) < 160);
  // The additive rune (geoset 4) rises to 262 in Stand; the tallest counted part reaches 253.
  const stand = model.Sequences.find(s => /^stand$/i.test(s.Name));
  assert.ok(top(stand) > 250 && top(stand) < 255, `Stand top ${top(stand)}`);
  // Excluded geosets keep their own geoset boxes.
  assert.ok(top(model.Geosets[4]) > 0);
  for (const geoset of model.Geosets) assert.equal(geoset.Anims.length, model.Sequences.length);
  assert.equal(extentsDiffer(model), false);
  assert.deepEqual(boundsProposals(model), []);
});

test('portrait-only geosets are left out; a model of only effects keeps everything', () => {
  const model = load('./fixtures/demo.mdx');
  const portrait = model.Geosets.findIndex((_, i) => !extentsExclusions(model).has(i));
  assert.ok(portrait >= 0);
  const [, end] = model.Sequences[0].Interval;
  model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Portrait', Interval: new Uint32Array([end + 100, end + 1100]) });
  model.GeosetAnims = (model.GeosetAnims || []).filter(anim => anim.GeosetId !== portrait);
  const keys = model.Sequences.map((s, i) => ({ Frame: s.Interval[0], Vector: new Float32Array([i === model.Sequences.length - 1 ? 1 : 0]) }));
  model.GeosetAnims.push({ GeosetId: portrait, Alpha: { LineType: 0, GlobalSeqId: null, Keys: keys }, Color: new Float32Array([1, 1, 1]), Flags: 0 });
  assert.equal(extentsExclusions(model).get(portrait), 'portrait');

  const effects = load('./fixtures/demo.mdx');
  for (const material of effects.Materials) for (const layer of material.Layers) layer.FilterMode = 3;
  assert.equal(extentsExclusions(effects).size, 0);
});
