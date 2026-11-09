import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { poseLimbRootEvidence } from '../src/pose-limb-roots.js';
import { poseGeometryEvidence } from '../src/pose-geometry.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { realAnatomyCases, loadAnatomyCase, challengeCase, nameVariants } from './helpers/pose-anatomy-fixtures.mjs';

// Independently established native boundaries: the arm begins beyond the
// clavicle, while the horse retains its complete four-joint leg.
const cases = [
  ['kurgan',2,[24,3,4,5,6],4], ['kurgan',2,[25,7,8,9,10],8],
  ['dense-twin-rider',58,[60,62,64,67],62], ['dense-twin-rider',58,[61,63,65,66],63],
  ['horse',32,[33,34,35,36],33], ['horse',43,[44,45,46,47],44],
];
test('limb starts leave the torso without losing the upper leg across label and ID challenges', () => {
  for (const [key, origin, ids, root] of cases) {
    const input = loadAnatomyCase(realAnatomyCases.find(spec => spec.key === key)).model;
    for (const mode of nameVariants) {
      const { model, expected } = challengeCase(input, { limbs:[], heads:[], central:[origin,root,...ids] }, mode);
      const [mappedOrigin,mappedRoot,...path] = expected.central, tree = nodeIndex(model), geometry = poseGeometryEvidence(model);
      const scores = poseLimbRootEvidence(path, {
        origin:mappedOrigin, pivot:id=>new Vector3(...tree.byId.get(id).PivotPoint), jointSurface:id=>geometry.profiles.get(id),
      });
      scores.sort((a,b)=>b.score-a.score);
      assert.equal(scores[0].id,mappedRoot,key+'/'+mode);
    }
  }
});

test('root evidence is unchanged by coordinate rotation, translation or uniform scale', () => {
  const positions = [[0,0,0],[0,2,1],[0,4,1],[0,5,-2],[1,5,-6]].map(p=>new Vector3(...p));
  const context = points => ({origin:0,pivot:id=>points[id],jointSurface:()=>null});
  const before = poseLimbRootEvidence([1,2,3,4],context(positions));
  const axis = new Vector3(2,3,4).normalize();
  const moved = positions.map(p=>p.clone().applyAxisAngle(axis,.82).multiplyScalar(83).add(new Vector3(100,-300,71)));
  const after = poseLimbRootEvidence([1,2,3,4],context(moved));
  assert.deepEqual(after.map(row=>row.id),before.map(row=>row.id));
  after.forEach((row,i)=>assert.ok(Math.abs(row.score-before[i].score)<1e-12));
});
