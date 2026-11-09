import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticalRig, challengeCase, nameVariants, anatomyProblems } from './helpers/pose-anatomy-fixtures.mjs';
import * as pose from '../src/pose-ik.js';

// Change authored morphology while keeping the same independent neck branches.
// Expected anatomy comes from the generator, never from recognition output.
function proportions(model, headId, skullScale, neckScale) {
  const head = model.Bones.find(node => node.ObjectId === headId);
  const neck = model.Bones.find(node => node.ObjectId === head.Parent);
  const point = Array.from(head.PivotPoint), base = Array.from(neck.PivotPoint);
  const axis = point.map((value, i) => value - base[i]);
  const length2 = axis.reduce((sum, value) => sum + value * value, 0);
  const delta = axis.map(value => value * (neckScale - 1));
  for (const geo of model.Geosets) {
    const skull = geo.Groups.length === 1 && geo.Groups[0].length === 1 && geo.Groups[0][0] === headId;
    const neckSurface = geo.Groups.some(group => group.includes(headId)) && geo.Groups.some(group => group.includes(neck.ObjectId));
    if (!skull && !neckSurface) continue;
    for (let i = 0; i < geo.Vertices.length; i += 3) {
      const along = neckSurface ? axis.reduce((sum, value, j) => sum + (geo.Vertices[i + j] - base[j]) * value, 0) / length2 : 1;
      for (let j = 0; j < 3; j++) geo.Vertices[i + j] = (skull ? point[j] + (geo.Vertices[i + j] - point[j]) * skullScale : geo.Vertices[i + j]) + delta[j] * along;
    }
  }
  for (let i = 0; i < 3; i++) head.PivotPoint[i] = point[i] + delta[i];
}

const variations = [
  ['control', []], ['half skull', [[0,.5,1]]], ['three-quarter skull', [[0,.75,1]]],
  ['larger skull', [[0,1.5,1]]], ['short neck', [[0,1,.25]]], ['long neck', [[0,1,3]]],
  ['unequal skulls', [[0,.6,1],[2,1.4,1]]], ['unequal skulls and necks', [[0,.6,3],[2,1.4,.25]]],
];
for (const [label, changes] of variations) for (const mode of nameVariants) test(`independent heads retain ${label}, ${mode}`, () => {
  const fixture = analyticalRig({heads:3});
  for (const [index, skull, neck] of changes) proportions(fixture.model, fixture.expected.heads[index], skull, neck);
  const {model, expected} = challengeCase(fixture.model, fixture.expected, mode), before = structuredClone(model);
  assert.deepEqual(anatomyProblems(model, pose.suggestPoseRig(model,0,0), expected, pose), []);
  assert.deepEqual(model, before, 'recognition preserves the changed morphology');
});
