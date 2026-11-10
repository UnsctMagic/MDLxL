import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { openDocument } from '../../src/editor-document.js';
import { poseGeometryEvidence } from '../../src/pose-geometry.js';
import { inferPoseReplacements } from '../../src/pose-heads.js';
import { allNodes } from '../../src/animation.js';
const { testModel } = createRequire(import.meta.url)('../helpers/fixtures.cjs');

test('ratling head and chest replacements survive anonymous nodes and reordered geosets', () => {
  for (const file of ['ratling_unit.mdx', 'ratling_hero.mdx']) {
    const model = openDocument(fs.readFileSync(testModel('corpse-fixtures/' + file))).model;
    allNodes(model).forEach(node => { node.Name = ''; });
    model.Sequences.forEach(sequence => { sequence.Name = ''; });
    const count = model.Geosets.length;
    model.Geosets.reverse();
    model.GeosetAnims.forEach(animation => { animation.GeosetId = count - animation.GeosetId - 1; });
    const before = structuredClone(model);
    const result = inferPoseReplacements(model, { geometry: poseGeometryEvidence(model), roles: { 18: 'Head', 2: 'Chest' } });
    assert.deepEqual(result.map(pair => [pair.source, pair.target]), [[18, 52], [2, 48]], file);
    assert.deepEqual(model, before, file);
  }
});
