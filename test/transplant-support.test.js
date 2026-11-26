import test from 'node:test';
import { Triangle, Vector3 } from 'three';
import { physicalSurfaceComponents } from '../src/geoset-operations.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { transferRig } from '../src/anim-transfer.js';
import { nodePivot, sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
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

function surfaceAt(mesh, sequence, frame, geoset) {
  const index = mesh.Sequences.findIndex(s => s.Name.trim() === sequence);
  assert.ok(index >= 0, sequence);
  return skinGeoset(mesh.Geosets[geoset], sampleNodeMatrices(mesh, frame, index));
}

function point(vertices, index) {
  return new Vector3().fromArray(vertices, 3 * index);
}

check('The Knight covering stays sewn across materials and meets the legs in the wolf gallop',
  'orc__wolfrider', 'human__knight', ({ model }) => {
    const sequence = model.Sequences.find(s => s.Name.trim() === 'Walk');
    for (let frame = sequence.Interval[0]; frame <= sequence.Interval[1]; frame += 5) {
      const fringe = surfaceAt(model, 'Walk', frame, 0), panel = surfaceAt(model, 'Walk', frame, 1);
      for (const [a,b] of [[520,8],[521,9]]) assert.ok(point(fringe,a).distanceTo(point(panel,b)) < 0.001);
      assert.ok(point(fringe,520).distanceTo(point(fringe,521)) < 56, 'central seam exceeds native Walk envelope');
    }
    const frame = sequence.Interval[0], fringe = surfaceAt(model, 'Walk', frame, 0);
    const panel = surfaceAt(model, 'Walk', frame, 1);
    const cloth = [];
    for (const [geo,skin,start] of [[0,fringe,520],[1,panel,8]]) {
      const group = physicalSurfaceComponents(model.Geosets[geo]).find(p => p.vertices.includes(start));
      for (const face of group.faceIndices) {
        const indices = model.Geosets[geo].Faces.subarray(3*face,3*face+3);
        cloth.push(new Triangle(...Array.from(indices,i => point(skin,i))));
      }
    }
    for (const cuff of [[120,122,123],[130,132,133],[283,285,286],[531,533,534]]) {
      let gap = Infinity;
      for (const i of cuff) for (const face of cloth) {
        const top = point(fringe,i);
        gap = Math.min(gap,top.distanceTo(face.closestPointToPoint(top,new Vector3())));
      }
      assert.ok(gap < 5, 'a boot separates from the covering by ' + gap);
    }
  });

check('The living wolf and rider fall with the Knight corpse and the blade lands with the lance',
  'human__knight', 'orc__wolfrider', ({ donor, model }) => {
    const torso = surfaceAt(model,'Death',31800,1);
    assert.ok(point(torso,24).distanceTo(point(torso,30)) < 31.2);
    assert.ok(Math.max(...torso.filter((_,i) => i%3 === 2)) < 80, 'rider still seated at the end of the fall');
    for (const frame of [29700,31200,31800]) {
      const expected = surfaceAt(donor,'Death',frame,3), actual = surfaceAt(model,'Death',frame,0);
      const lance = point(expected,53).sub(point(expected,57)).normalize();
      const blade = point(actual,136).sub(point(actual,138)).normalize();
      assert.ok(Math.abs(lance.dot(blade)) > Math.cos(3*Math.PI/180), 'blade direction at ' + frame);
    }
  });

for (const [name,frame,a,b,limit] of [
  ['orc__herotaurenchieftain',229859,91,106,60],
  ['orc__tauren',229942,326,327,36],
]) {
  check('The upper arm stays attached through the Bear slam on ' + name,
    'creeps__grizzlybear', name, ({ model }) => {
      const skin = surfaceAt(model,'Attack Slam',frame,0);
      assert.ok(point(skin,a).distanceTo(point(skin,b)) < limit);
      if (name === 'orc__herotaurenchieftain') {
        const hand = surfaceAt(model,'Walk',210400,0), axe = surfaceAt(model,'Walk',210400,3);
        assert.ok(Math.abs(point(axe,11).z - point(hand,185).z) < 1, 'axe clears the supporting palm plane');
      }
    });
}

for (const [donorName,recipient,mirror] of [
  ['orc__wolfrider','human__knight'], ['creeps__satyr','undead__ghoul'],
  ['orc__orcwarlockguldan','creeps__koboldgeomancer'], ['creeps__centaur','orc__grunt',true],
  ...['creeps__timberwolf','orc__tauren','orc__herotaurenchieftain'].map(name=>['creeps__grizzlybear',name]),
]) {
  check(`Walk ground contact adds no frame-scale hip jolt on ${donorName} into ${recipient}`,
    donorName,recipient,({model,donor,own,report}) => {
      const free = transplantSkeleton(own,donor,{mirror:!!mirror,feet:'free',extents:false});
      const src = transferRig(donor), h = transferRig(own).hipHeight;
      const si = model.Sequences.findIndex(s=>/^walk$/i.test(s.Name.trim()));
      const [start,end] = model.Sequences[si].Interval, extra = [];
      const height = (m,id,t) => new Vector3().fromArray(nodePivot(m,m.Nodes[id],id))
        .applyMatrix4(sampleNodeMatrices(m,t,si).get(id)).z;
      for (let k=0;start+k*1000/60<=end;k++) {
        const f=start+k*1000/60;
        extra.push(height(model,report.donorNodes[src.body],f)-height(free.model,free.report.donorNodes[src.body],f));
      }
      for (let k=1;k<extra.length-1;k++)
        assert.ok(Math.abs(extra[k+1]+extra[k-1]-2*extra[k])<.035*h,'ground fit jolts the hips at frame '+k);
    },!!mirror);
}

for (const [donorName,ownName,clip,patch,host] of [
  ['creeps__ogreoneheaded','creeps__furbolg','Stand 3','Stomach','belly'],
  ['orc__shaman','human__priest','Walk','Cape4','Cape'],
  ['undead__acolyte','human__priest','Walk','Cape4','Cape'],
]) {
  check(`${donorName} moves the actual ${patch} surface on ${ownName}`,donorName,ownName,({model,own})=>{
    const bone = own.Nodes.find(n=>n?.Name===patch), carrier = model.Nodes.find(n=>n?.Name===host);
    assert.ok(carrier,'secondary surface retained its attachment');
    const anchor = host==='belly' ? carrier.Parent : carrier.ObjectId;
    const verts = own.Geosets.flatMap((g,gi)=>Array.from({length:g.Vertices.length/3},(_,v)=>
      vertexBones(g,v).includes(bone.ObjectId) ? [gi,v] : null).filter(Boolean));
    assert.ok(verts.length);
    const si=model.Sequences.findIndex(s=>s.Name.trim()===clip), [a,b]=model.Sequences[si].Interval;
    const path=[];
    for (let k=0;k<=30;k++) {
      const matrices=sampleNodeMatrices(model,a+(b-a)*k/30,si);
      const points=model.Geosets.map(g=>skinGeoset(g,matrices));
      const centre=verts.reduce((sum,[gi,v])=>sum.add(new Vector3().fromArray(points[gi],3*v)),new Vector3());
      path.push(centre.divideScalar(verts.length).applyMatrix4(matrices.get(anchor).clone().invert()));
    }
    assert.ok(path.some(p=>path.some(q=>p.distanceTo(q)>4)),'the bound patch moves relative to its host');
  });
}

check('Footman attacks retain the Spell Breaker solid GEOSET POSE blade',
  'human__footman','human__bloodelfspellthief',({model})=>{
    for (const [si,s] of model.Sequences.entries()) {
      if (!/attack/i.test(s.Name)) continue;
      for (let f=s.Interval[0];f<=s.Interval[1];f+=8) {
        assert.ok(sampleGeosetAnimation(model,2,f,si).alpha>.99);
        for (const gi of [3,8]) assert.ok(sampleGeosetAnimation(model,gi,f,si).alpha<.001);
      }
    }
  },true);

function frames60(model, name, inspect) {
  const si = model.Sequences.findIndex(s => s.Name.trim() === name);
  assert.ok(si >= 0);
  const [a,b] = model.Sequences[si].Interval, samples = [];
  for (let t=a; t<=b; t+=1000/60) samples.push(inspect(sampleNodeMatrices(model,Math.round(t),si)));
  return samples;
}

check('The Grunt holds the Centaur front body height through Stand - 3',
  'creeps__centaur','orc__grunt',({own,donor,model,report}) => {
    const hip = report.donorNodes[transferRig(donor).body];
    const z = frames60(model,'Stand - 3',m => new Vector3().fromArray(nodePivot(model,model.Nodes[hip])).applyMatrix4(m.get(hip)).z);
    assert.ok(Math.max(...z)-Math.min(...z)<.5,'stationary torso bounced');
    const rig=transferRig(own);
    const feet=['legL','legR'].flatMap(key=>solidContactFaces(own,rig.parts[key].marker,{hand:true}));
    assert.ok(feet.length);
    frames60(model,'Stand - 3',m=>{
      const skin=model.Geosets.map(g=>skinGeoset(g,m));
      const lowest=Math.min(...feet.flatMap(face=>face.ids.map(v=>skin[face.gi][3*v+2])));
      assert.ok(lowest>-.04*rig.hipHeight && lowest<.08*rig.hipHeight,'front boots lost contact');
    });
  },true);

check('The Tauren keeps the width of its rear shin sections through the Bear walk',
  'creeps__grizzlybear','orc__tauren',({own,model}) => {
    const rig=transferRig(own),g=own.Geosets[0],sections=new Map();
    for (let v=0;v<g.Vertices.length/3;v++) {
      const bones=vertexBones(g,v);
      if (bones.length!==2 || !bones.every(id=>/shin|hoof/i.test(own.Nodes[id].Name))) continue;
      const key=bones.join(',');
      if (!sections.has(key)) sections.set(key,[]);
      sections.get(key).push(v);
    }
    const rest=skinGeoset(g,sampleNodeMatrices(own,rig.reference.frame,rig.reference.sequence));
    const widths=Array.from(sections.values()).map(vertices=>{
      let a,b,width=0;
      for (const i of vertices) for (const j of vertices) {
        const d=point(rest,i).distanceTo(point(rest,j));
        if (d>width) { a=i;b=j;width=d; }
      }
      return {a,b,width};
    });
    assert.ok(widths.length>=4);
    frames60(model,'Walk',m=>{
      const skin=skinGeoset(model.Geosets[0],m);
      for (const {a,b,width} of widths)
        assert.ok(Math.abs(point(skin,a).distanceTo(point(skin,b))-width)<.05,'rear shin section pinched');
    });
  });

check('The Acolyte trailing hem lifts the lower center of the Priest cape',
  'undead__acolyte','human__priest',({own,donor,model}) => {
    function centerHeight(reference, animated) {
      let best=null;
      reference.Geosets.forEach((g,gi)=>{
        for (let v=0;v<g.Vertices.length/3;v++) {
          const p=point(g.Vertices,v),names=vertexBones(g,v).map(id=>reference.Nodes[id].Name);
          if (p.z<15 && names.some(s=>/skirt|cape/i.test(s)) && (!best || p.x<best.x)) best={gi,v,x:p.x};
        }
      });
      assert.ok(best);
      return frames60(animated,'Walk',m=>point(skinGeoset(animated.Geosets[best.gi],m),best.v).z);
    }
    const a=centerHeight(donor,donor),b=centerHeight(own,model);
    const span=v=>Math.max(...v)-Math.min(...v),aPeak=a.indexOf(Math.max(...a)),bPeak=b.indexOf(Math.max(...b));
    assert.ok(span(b)>.8*span(a) && span(b)<1.4*span(a),'hem lift diverged from the donor');
    assert.ok(Math.abs(aPeak-bPeak)<5,'trailing surface peaked out of phase');
  });

check('The Chieftain keeps the Bear paw cadence without an elbow reversal',
  'creeps__grizzlybear','orc__herotaurenchieftain',({model,donor,report})=>{
    const r=transferRig(donor),hip=report.donorNodes[r.body];
    for (const key of ['legL2','legR2']) for (const joint of r.parts[key].joints) {
      const id=report.donorNodes[joint];
      const p=frames60(model,'Walk',m=>{
        const at=j=>new Vector3().fromArray(nodePivot(model,model.Nodes[j])).applyMatrix4(m.get(j));
        return at(id).sub(at(hip));
      });
      for (let j=2;j<p.length;j++)
        assert.ok(p[j].clone().add(p[j-2]).addScaledVector(p[j-1],-2).length()<8,'supporting arm twitched');
    }
  });

check('Chieftain rear hock sections preserve their standing width and slam reach',
  'creeps__grizzlybear','orc__herotaurenchieftain',({own,model})=>{
    const rig=transferRig(own), g=own.Geosets[0];
    const rest=skinGeoset(g,sampleNodeMatrices(own,rig.reference.frame,rig.reference.sequence));
    const sections=[];
    for(const side of ['legL','legR']){
      const joints=rig.parts[side].joints;
      for(let k=1;k<joints.length;k++){
        const vs=Array.from(g.VertexGroup.keys()).filter(v=>{
          const ids=vertexBones(g,v);
          return ids.length===2&&ids.includes(joints[k])&&ids.includes(joints[k-1]);
        });
        assert.ok(vs.length>=3);
        let best={width:0};
        for(const a of vs)for(const b of vs){
          const width=point(rest,a).distanceTo(point(rest,b));
          if(width>best.width)best={a,b,width};
        }
        sections.push(best);
      }
    }
    for(const seq of ['Walk','Attack Slam'])frames60(model,seq,m=>{
      const skin=skinGeoset(model.Geosets[0],m);
      for(const {a,b,width} of sections) assert.ok(Math.abs(point(skin,a).distanceTo(point(skin,b))-width)<.05,'collapsed rear leg section');
      assert.ok(point(skin,305).distanceTo(point(skin,306))<32,'thigh stretched past native reach');
    });
  });

check('Chieftain unanimated geosets disappear with the Bear living body in Decay Bone',
  'creeps__grizzlybear','orc__herotaurenchieftain',({model})=>{
    for(const seq of ['Stand','Decay Bone']){
      const si=model.Sequences.findIndex(s=>s.Name===seq);
      const [a,b]=model.Sequences[si].Interval;
      for(const t of [a,(a+b)>>1,b]) for(const gi of model.Geosets.keys()){
        const alpha=sampleGeosetAnimation(model,gi,t,si).alpha;
        if(seq==='Stand'&&gi===0)assert.ok(alpha>.99);
        if(seq==='Decay Bone')assert.ok(alpha<.001,'body or glow survived the donor');
      }
    }
  });

check('Centaur front torso keeps the Grunt waist joined in Attack - 1',
  'creeps__centaur','orc__grunt',({model})=>{
    frames60(model,'Attack - 1',m=>{
      const skin=skinGeoset(model.Geosets[1],m);
      assert.ok(point(skin,292).distanceTo(point(skin,294))<17,'waist spans the horse torso');
    });
  },true);

test('Static decay visibility follows the active geoset record on legacy duplicate GEOAs', t => {
  const files=['orc__herotaurenchieftain','creeps__grizzlybear'].map(name => testModel('corpus-sd/'+name+'.mdx'));
  if (files.some(f => !fs.existsSync(f))) return t.skip('SD fixture unavailable');
  const [own,donor]=files.map(f => openDocument(fs.readFileSync(f),f).model);
  const record=alpha=>({GeosetId:0,Flags:0,Color:new Float32Array([1,1,1]),Alpha:alpha});
  own.GeosetAnims.push(record(1),record(.37));
  const {model}=transplantSkeleton(own,donor,{extents:false});
  const records=model.GeosetAnims.filter(a=>a.GeosetId===0);
  assert.equal(records.length,2);
  assert.equal(records[1].Alpha,.37);
  const si=model.Sequences.findIndex(s=>s.Name==='Decay Bone');
  assert.equal(sampleGeosetAnimation(model,0,model.Sequences[si].Interval[0],si).alpha,0);
});
