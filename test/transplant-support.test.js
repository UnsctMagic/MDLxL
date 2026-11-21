import test from 'node:test';
import { Vector3 } from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { transferRig } from '../src/anim-transfer.js';
import { nodePivot, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { vertexBones } from '../src/part-bones.js';
import { mirrorModel, transplantSkeleton } from '../src/skeleton-transplant.js';
import { solidContactFaces } from './helpers/transplant-contact.js';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
function check(label, donorName, ownName, inspect, mirror = false) {
  const files = [donorName, ownName].map(name => testModel('corpus-sd/' + name + '.mdx'));
  test(label, { skip: files.some(file => !fs.existsSync(file)) && 'SD fixture unavailable' }, () => {
    const [donor, own] = files.map(file => openDocument(fs.readFileSync(file), file).model);
    const { model, report } = transplantSkeleton(own, donor, { mirror, extents: false });
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

for (const [donorName, recipientName] of [['orc__wolfrider','human__knight'],['human__knight','orc__wolfrider']]) {
  check('Mounted torso skin stays on its own actor: ' + donorName + ' to ' + recipientName,
    donorName, recipientName, ({ own, donor, model, report }) => {
      const rig = transferRig(own), source = nodeIndex(own), result = nodeIndex(model);
      const parts = new Map(Object.values(rig.parts).flatMap(p => p.joints.map(id => [id,p.key])));
      const ownSeat = transferRig(own, { actor: 'seated' }).parts.hips;
      for (const id of ownSeat.joints) parts.set(id, 'seat');
      const donorSeat = report.donorNodes[transferRig(donor, { actor: 'seated' }).parts.hips.marker];
      const donorChest = report.donorNodes[transferRig(donor).parts.chest.joints[0]];
      const checked = { hips: 0, seat: 0, chest: 0 };
      for (const [gi, g] of own.Geosets.entries()) {
        for (let vi = 0; vi < g.Vertices.length / 3; vi++) {
          const ids = vertexBones(g,vi);
          const roles = new Set(ids.map(id => parts.get(source.ancestors(id,true).find(a => parts.has(a)))));
          const [role] = roles;
          if (roles.size !== 1 || !Object.hasOwn(checked, role)) continue;
          const drivers = vertexBones(model.Geosets[gi], vi);
          const matches = id => result.isAncestor(id, donorSeat) === (role !== 'hips') &&
            result.isAncestor(id, donorChest) === (role === 'chest');
          assert.ok(drivers.length && drivers.every(matches),
            `geoset ${gi}, vertex ${vi}, ${role}: ${drivers.map(id=>model.Nodes[id].Name)}`);
          checked[role]++;
        }
      }
      assert.ok(checked.hips && checked.seat && checked.chest, 'checked both mount and rider skin');
    });
}


for (const name of ['orc__herotaurenchieftain', 'orc__tauren']) {
  check('Tauren head and hand separation follow the Bear through Walk: ' + name,
    'creeps__grizzlybear', name, ({ donor, own, model, report }) => {
      const rig = transferRig(donor), ownRig = transferRig(own);
      const headVertices = (mesh, marker) => {
        const tree = nodeIndex(mesh), vertices = [];
        for (const [gi, geo] of mesh.Geosets.entries()) {
          for (let vi = 0; vi < geo.Vertices.length / 3; vi++) {
            const ids = vertexBones(geo, vi);
            if (ids.length && ids.every(id => tree.isAncestor(id, marker))) vertices.push([gi, vi]);
          }
        }
        assert.ok(vertices.length > 0, 'head has skinned vertices');
        return vertices;
      };
      const sourceHead = headVertices(donor, rig.parts.head.marker);
      const targetHead = headVertices(own, ownRig.parts.head.marker);
      const si = donor.Sequences.findIndex(s => s.Name.trim() === 'Walk');
      const [start, end] = donor.Sequences[si].Interval;
      function offsets(mesh, vertices, mapped, frame) {
        const matrices = sampleNodeMatrices(mesh, frame, si);
        const joint = (key, index) => {
          const id = mapped(rig.parts[key].joints.at(index));
          return new Vector3().fromArray(nodePivot(mesh, mesh.Nodes[id], id)).applyMatrix4(matrices.get(id));
        };
        const left = joint('legL2', 0), right = joint('legR2', 0);
        const fore = left.clone().lerp(right, 0.5), rear = joint('legL', 0).lerp(joint('legR', 0), 0.5);
        const across = left.sub(right);
        across.z = 0;
        const separation = joint('legL2', -1).sub(joint('legR2', -1)).dot(across) / across.lengthSq();
        const axis = fore.clone().sub(rear), length = axis.length();
        const skin = mesh.Geosets.map(g => skinGeoset(g, matrices));
        const head = new Vector3();
        for (const [gi, vi] of vertices) head.add(new Vector3().fromArray(skin[gi], vi * 3));
        const offset = head.divideScalar(vertices.length).sub(fore);
        return { front: offset.dot(axis.normalize()) / length, height: offset.z / length, separation };
      }
      for (let frame = start; frame <= end; frame += 16) {
        const source = offsets(donor, sourceHead, id => id, frame);
        const result = offsets(model, targetHead, id => report.donorNodes[id], frame);
        assert.ok(result.front >= 0.5 * source.front, 'head projects ahead of the forelegs at ' + frame);
        assert.ok(Math.abs(result.height - source.height) < 0.25, 'head height relative to shoulders at ' + frame);
        assert.ok(result.separation >= 0.5 * source.separation, 'hands maintain the donor stance width at ' + frame);
      }
      // A planted wrist can stay on its side and still snap across successive
      // poses. Compare its shoulder-relative motion in units of limb length.
      for (const [index, seq] of donor.Sequences.entries()) {
        if (!/^(Walk|Attack Slam)$/.test(seq.Name.trim())) continue;
        const peak = (mesh, mapped) => {
          let maximum = 0, previous = null;
          for (let f = seq.Interval[0]; f <= seq.Interval[1]; f += 10) {
            const mats = sampleNodeMatrices(mesh, f, index);
            const positions = ['legL2', 'legR2'].map(key => {
              const ids = rig.parts[key].joints.map(mapped);
              const points = ids.map(id => new Vector3().fromArray(nodePivot(mesh, mesh.Nodes[id], id)).applyMatrix4(mats.get(id)));
              const length = points.slice(1).reduce((sum, point, i) => sum + point.distanceTo(points[i]), 0);
              return points.at(-1).clone().sub(points[0]).divideScalar(length);
            });
            if (previous) positions.forEach((p, i) => { maximum = Math.max(maximum, p.distanceTo(previous[i])); });
            previous = positions;
          }
          return maximum;
        };
        assert.ok(peak(model, id => report.donorNodes[id]) <= peak(donor, id => id) + 0.08,
          seq.Name + ' palm changes direction too abruptly');
      }
    });
}


check('Footman shield follows the Bandit wrist through guard and strike',
  'creeps__bandit', 'human__footman', ({ own, donor, model, report }) => {
    const source = mirrorModel(donor);
    const arm = transferRig(source).parts.armR;
    const shoulder = arm.joints[0];
    function plate(mesh, name) {
      const carrier = mesh.Nodes.find(n => n?.Name.trim() === name).ObjectId;
      const points = [];
      for (const [gi, geo] of mesh.Geosets.entries()) {
        for (let vi = 0; vi < geo.Vertices.length / 3; vi++) {
          const ids = vertexBones(geo, vi);
          if (ids.length === 1 && ids[0] === carrier) points.push([gi, vi]);
        }
      }
      assert.ok(points.length > 40);
      return points;
    }
    const ownPlate = plate(own, 'Mesh01'), donorPlate = plate(source, 'HandRight');
    function position(mesh, plate, root, si, frame) {
      const matrices = sampleNodeMatrices(mesh, frame, si);
      const skin = mesh.Geosets.map(g => skinGeoset(g, matrices));
      const centre = new Vector3();
      for (const [gi, vi] of plate) centre.add(new Vector3().fromArray(skin[gi], vi * 3));
      const pivot = new Vector3().fromArray(nodePivot(mesh, mesh.Nodes[root], root)).applyMatrix4(matrices.get(root));
      return centre.divideScalar(plate.length).sub(pivot);
    }
    // Corresponding large outward faces on the two native shield meshes.
    function faceNormal(mesh, face, si, frame) {
      const positions = skinGeoset(mesh.Geosets[0], sampleNodeMatrices(mesh, frame, si));
      const [a,b,c] = face.map(i => new Vector3().fromArray(positions, 3 * i));
      return b.sub(a).cross(c.sub(a)).normalize();
    }
    for (const [si, seq] of source.Sequences.entries()) {
      if (!/^(stand|walk|attack)/i.test(seq.Name.trim())) continue;
      for (let f = seq.Interval[0]; f <= seq.Interval[1]; f += 16) {
        const expected = position(source, donorPlate, shoulder, si, f);
        const actual = position(model, ownPlate, report.donorNodes[shoulder], si, f);
        assert.ok(actual.distanceTo(expected) < 0.4 * arm.length, seq.Name + ' shield offset at ' + f);
        const donorNormal = faceNormal(source, [273, 274, 275], si, f);
        const resultNormal = faceNormal(model, [259, 260, 261], si, f);
        assert.ok(Math.abs(donorNormal.dot(resultNormal)) > Math.cos(12 * Math.PI / 180),
          seq.Name + ' shield face points across the donor guard at ' + f);
      }
    }
  }, true);
