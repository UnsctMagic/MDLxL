import test from 'node:test';
import assert from 'node:assert/strict';
import { poseAssemblyEvidence } from '../../src/pose-assemblies.js';
import { poseGeometryEvidence } from '../../src/pose-geometry.js';
import { nodeIndex } from '../../src/node-hierarchy.js';
import { realAnatomyCases, loadAnatomyCase, challengeCase, nameVariants } from '../helpers/pose-anatomy-fixtures.mjs';

test('independent vampire rider follows the actual saddle with every naming and ID challenge', () => {
  const { model: input } = loadAnatomyCase(realAnatomyCases.find(spec => spec.key === 'vampire-dragon'));
  const ids = [82, 182, 230, 218, 219, 220, 221, 222, 223, 224, 225];
  for (const mode of nameVariants) {
    const { model, expected } = challengeCase(input, { limbs: [], heads: [], central: ids }, mode);
    const [rider, host, seat, a,b,c,d,e,f,g,h] = expected.central;
    const original = structuredClone(model);
    const actors = [
      { body: rider, limbs: [], span: 100 },
      { body: host, limbs: [{ kind: 'leg', ids: [a,b,c,d] }, { kind: 'leg', ids: [e,f,g,h] }], span: 350 },
    ];
    const geometry = poseGeometryEvidence(model), tree = nodeIndex(model);
    const result = poseAssemblyEvidence(model, actors, { geometry, tree });
    assert.deepEqual(result.carriers, { [rider]: seat }, mode);
    assert.deepEqual(result.followers, {}, mode);
    assert.deepEqual(model, original, 'relationship analysis cannot edit authored tracks or surfaces');
  }
});
