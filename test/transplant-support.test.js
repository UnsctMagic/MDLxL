import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { transferRig } from '../src/anim-transfer.js';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { vertexBones } from '../src/part-bones.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { solidContactFaces } from './helpers/transplant-contact.js';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
function check(label, donorName, ownName, inspect) {
  const files = [donorName, ownName].map(name => testModel('corpus-sd/' + name + '.mdx'));
  test(label, { skip: files.some(file => !fs.existsSync(file)) && 'SD fixture unavailable' }, () => {
    const [donor, own] = files.map(file => openDocument(fs.readFileSync(file), file).model);
    const { model, report } = transplantSkeleton(own, donor, { mirror: false, extents: false });
    inspect({ donor, own, model, report });
  });
}

function checkSkinDriver(own, model, marker, driver) {
  const ownTree = nodeIndex(own), resultTree = nodeIndex(model);
  let count = 0;
  for (const [gi, g] of own.Geosets.entries()) {
    for (let v = 0; v < g.Vertices.length / 3; v++) {
      const source = vertexBones(g, v);
      if (!source.length || !source.every(id => ownTree.isAncestor(id, marker))) continue;
      const result = vertexBones(model.Geosets[gi], v);
      assert.ok(result.length && result.every(id => resultTree.isAncestor(id, driver)),
        `Vertex ${v} in geoset ${gi} must follow ${model.Nodes[driver].Name}`);
      count++;
    }
  }
  assert.ok(count > 0, 'actual skin belongs to the recipient handle');
}

check('Grunt feet, hands and head follow the front half of the Centaur', 'creeps__centaur', 'orc__grunt',
  ({ donor, own, model, report }) => {
    const target = transferRig(own), source = transferRig(donor);
    for (const key of ['legL', 'legR', 'armL', 'armR', 'head']) {
      const donorKey = key.startsWith('leg') ? key + '2' : key;
      const id = source.parts[donorKey].marker;
      if (key.startsWith('leg')) assert.match(donor.Nodes[id].Name, /front/i);
      checkSkinDriver(own, model, target.parts[key].marker, report.donorNodes[id]);
    }
  });

check('Bear head stays on the Centaur forequarters below its humanoid torso', 'creeps__centaur', 'creeps__grizzlybear',
  ({ donor, own, model, report }) => {
    const target = transferRig(own), source = transferRig(donor);
    const horseChest = donor.Nodes.find(n => n && /chesthorse/i.test(n.Name));
    assert.ok(horseChest);
    checkSkinDriver(own, model, target.parts.head.marker, report.donorNodes[horseChest.ObjectId]);
    for (const key of ['legL', 'legR', 'legL2', 'legR2'])
      checkSkinDriver(own, model, target.parts[key].marker, report.donorNodes[source.parts[key].marker]);
    // Both the humanoid head and horse forequarters descend from the horse chest.
    // Explicitly exclude the humanoid chest as a driver of any head vertex.
    const resultTree = nodeIndex(model), upper = report.donorNodes[source.parts.chest.joints[0]];
    for (const face of solidContactFaces(own, target.parts.head.marker, { hand: true }))
      for (const vi of face.ids)
        assert.ok(vertexBones(model.Geosets[face.gi], vi).every(id => !resultTree.isAncestor(id, upper)));
  });

check('Tauren Chieftain palms carry weight during the Grizzly Bear Walk', 'creeps__grizzlybear', 'orc__herotaurenchieftain',
  ({ own, model }) => {
    const rig = transferRig(own);
    const surfaces = ['armL', 'armR', 'legL', 'legR'].map(key => solidContactFaces(own, rig.parts[key].marker, { hand: true }));
    assert.ok(surfaces.every(faces => faces.length));
    const si = model.Sequences.findIndex(s => /^walk$/i.test(s.Name.trim()));
    const [start, end] = model.Sequences[si].Interval;
    const contact = [0, 0];
    for (let i = 0; i < 12; i++) {
      const frame = Math.round(start + (end - start) * i / 12);
      const matrices = sampleNodeMatrices(model, frame, si);
      const skin = model.Geosets.map(g => skinGeoset(g, matrices));
      const z = surfaces.map(faces => Math.min(...faces.flatMap(f => f.ids.map(v => skin[f.gi][3 * v + 2]))));
      const sole = Math.min(z[2], z[3]);
      for (let side = 0; side < 2; side++) {
        assert.ok(z[side] >= sole - 0.14 * rig.hipHeight, 'palm goes through the support plane');
        if (Math.abs(z[side] - sole) < 0.17 * rig.hipHeight) contact[side]++;
      }
    }
    assert.ok(contact.every(n => n >= 6), 'each palm meets the rear-hoof plane in at least half the sampled walk');
  });

check('A shield opposite the authored weapon hand does not hide the Skeleton Warrior mirror choice',
  'undead__skeleton', 'human__footman', ({ donor, own, report }) => {
    const source = transferRig(donor), recipient = transferRig(own);
    assert.equal(source.weaponSide, 'R');
    assert.equal(recipient.weaponSide, 'L');
    assert.equal(report.mirrorOffer, true);
    const dual = structuredClone(donor);
    dual.Nodes.find(node => node?.Name.trim().toLowerCase() === 'shield').Name = 'Axe';
    assert.equal(transferRig(dual).weaponSide, null, 'two weapons stay ambiguous');
  });
