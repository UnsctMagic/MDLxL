import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBinding, applyBinding, boneColors, defaultExcludedBones, pieceAt, planBinding, previewBinding } from '../src/bind-xl.js';

const swing = () => ({ LineType: 1, Keys: [{ Frame: 0, Vector: [0, 0, 0, 1] }, { Frame: 100, Vector: [0, .38, 0, .92] }] });

/** A box from x0 to x1 (square section), as 8 vertices and 12 triangles. */
function box(x0, x1, half = 2, z = 50) {
  const vertices = [], faces = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  for (const x of [x0, x1]) for (const [y, dz] of [[-half, -half], [half, -half], [half, half], [-half, half]]) vertices.push(x, y, z + dz);
  return { vertices, faces };
}
function geoset({ vertices, faces }, group = [0]) {
  const count = vertices.length / 3;
  return { Vertices: new Float32Array(vertices), Normals: new Float32Array(vertices.length).fill(0), Faces: new Uint16Array(faces), TVertices: [new Float32Array(count * 2)], VertexGroup: new Uint8Array(count), Groups: [group], TotalGroupsCount: group.length, MaterialID: 0 };
}

/** An arm along +X: Shoulder (0) at x=0, Elbow (1) at x=20, Hand (2) at x=40.
 * Geoset 0 = upper arm, geoset 1 = forearm (sharing the elbow ring of
 * vertices with geoset 0), geoset 2 = a small bracer plate on the forearm.
 * Everything starts bound to the shoulder. */
function arm({ helperJoints = false } = {}) {
  const upper = box(0, 20), fore = box(20, 40), bracer = box(26, 32, 2.5);
  const pivot = [[0, 0, 50], [20, 0, 50], [40, 0, 50]];
  const bones = ['Shoulder', 'Elbow', 'Hand'].map((Name, ObjectId) => ({ Name, ObjectId, Parent: ObjectId ? ObjectId - 1 : -1, Rotation: swing(), PivotPoint: new Float32Array(pivot[ObjectId]) }));
  const model = { Version: 800, Geosets: [geoset(upper), geoset(fore), geoset(bracer)], Bones: bones, Helpers: [], PivotPoints: pivot.map(p => new Float32Array(p)), Materials: [{ Layers: [{ FilterMode: 0 }] }], Sequences: [{ Name: 'Walk', Interval: new Uint32Array([0, 100]) }] };
  if (helperJoints) {
    // Blizzard style: helpers are the moving joints; the bones under them sit
    // at one junk pivot and never animate.
    model.Helpers = bones.map((bone, index) => ({ ...bone, ObjectId: 3 + index, Name: 'Joint' + index, Parent: index ? 3 + index - 1 : -1 }));
    model.Bones = bones.map(bone => ({ Name: bone.Name, ObjectId: bone.ObjectId, Parent: 3 + bone.ObjectId, PivotPoint: new Float32Array([90, 90, 90]) }));
    model.PivotPoints = [...model.Bones.map(bone => bone.PivotPoint), ...model.Helpers.map(helper => helper.PivotPoint)];
  }
  return model;
}
const groupsOf = (model, index) => Array.from(model.Geosets[index].VertexGroup, group => model.Geosets[index].Groups[group].join('+'));

test('rebinding from the skeleton follows where vertices sit, and pieces move as one', () => {
  const model = arm(), analysis = analyzeBinding(model);
  assert.equal(analysis.pieces.length, 3, 'upper arm, forearm and bracer are separate pieces');
  const plan = planBinding(analysis, { rebind: 1, soft: 0, plates: 0, glue: 0 });
  applyBinding(model, analysis, plan);
  assert.deepEqual(groupsOf(model, 0).slice(0, 4), ['0', '0', '0', '0'], 'shoulder end of the upper arm');
  assert.deepEqual(groupsOf(model, 1).slice(4), ['1', '1', '1', '1'], 'hand end of the forearm follows the elbow');
  // Plates stiff: the bracer is one piece on one bone.
  const stiff = arm(), stiffAnalysis = analyzeBinding(stiff);
  applyBinding(stiff, stiffAnalysis, planBinding(stiffAnalysis, { rebind: 1, soft: 0, plates: 1, glue: 0 }));
  assert.equal(new Set(groupsOf(stiff, 2)).size, 1, 'the bracer moves stiffly');
  assert.deepEqual([...new Set(groupsOf(stiff, 2))], ['1'], 'on the forearm bone');
});

test('seams: vertices that touch across geosets always share one binding', () => {
  for (const soft of [0, .5, 1]) for (const rebind of [0, .5, 1]) {
    const model = arm();
    // A messy start: the forearm's elbow ring says Elbow, the upper arm's says Shoulder.
    model.Geosets[1].Groups = [[1]];
    const analysis = analyzeBinding(model), plan = planBinding(analysis, { rebind, soft, plates: .5, glue: 0 });
    for (let i = 0; i < analysis.touchDistance.length; i++) {
      if (analysis.touchDistance[i] > analysis.scale * 1e-4) continue;
      const a = analysis.touchPairs[i * 2], b = analysis.touchPairs[i * 2 + 1];
      assert.deepEqual(plan.groups[a], plan.groups[b], `touching vertices agree (soft ${soft}, rebind ${rebind})`);
    }
  }
});

test('soft joints blend the two bones around a joint, hard keeps one bone per vertex', () => {
  const analysis = analyzeBinding(arm());
  const hard = planBinding(analysis, { rebind: 1, soft: 0, plates: 0 }), smooth = planBinding(analysis, { rebind: 1, soft: 1, plates: 0 });
  assert.ok(hard.groups.every(group => group.length === 1));
  assert.ok(smooth.groups.some(group => group.length === 2 && group.includes(0) && group.includes(1)), 'elbow vertices follow upper arm and forearm');
  assert.ok(smooth.groups.every(group => group.length <= 4));
});

test('keep: Rebind 0 changes nothing that is bound sensibly; strays and unbound vertices are fixed', () => {
  const model = arm();
  model.Geosets[1].Groups = [[1]]; model.Geosets[2].Groups = [[1]];
  // One stray vertex in the forearm bound to the hand's far end... and one to nothing.
  model.Geosets[1].Groups.push([0]); model.Geosets[1].VertexGroup[6] = 1;
  const analysis = analyzeBinding(model), plan = planBinding(analysis, { rebind: 0, soft: 0, plates: .5, glue: 0 });
  const before = analyzeBinding(arm());
  assert.equal(plan.groups[analysis.offsets.get(0)].join(), '0', 'upper arm kept on the shoulder');
  assert.equal(plan.groups[analysis.offsets.get(1) + 6].join(), '1', 'the stray takes its neighbours’ bone');
  assert.ok(before.count === analysis.count);
});

test('marks: a stiff mark with a bone holds the whole part; keep leaves it exactly as it was', () => {
  const model = arm(), analysis = analyzeBinding(model);
  const bracer = pieceAt(analysis, 2, 0), key = analysis.pieces[bracer].key;
  let plan = planBinding(analysis, { rebind: 1, marks: { [key]: { mode: 'plate', bone: 2 } } });
  for (const flat of analysis.pieces[bracer].vertices) assert.deepEqual(plan.groups[flat], [2]);
  plan = planBinding(analysis, { rebind: 1, marks: { [key]: { mode: 'keep' } } });
  for (const flat of analysis.pieces[bracer].vertices) assert.deepEqual(plan.groups[flat], [0]);
});

test('turned-off bones take no vertices, and parts held only by them stay as they are', () => {
  const model = arm();
  model.Geosets[2].Groups = [[2]];
  const analysis = analyzeBinding(model), plan = planBinding(analysis, { rebind: 1, excluded: new Set([2]) });
  for (let flat = 0; flat < analysis.count; flat++) if (analysis.geosetOf[flat] !== 2) assert.ok(!plan.groups[flat].includes(2));
  for (const flat of analysis.pieces[pieceAt(analysis, 2, 0)].vertices) assert.deepEqual(plan.groups[flat], [2], 'the bracer held only by the turned-off Hand keeps it');
  assert.throws(() => planBinding(analysis, { excluded: new Set([0, 1, 2]) }), /at least one bone/);
});

test('Blizzard-style rigs: bones hanging under moving helpers use the helper joints', () => {
  const model = arm({ helperJoints: true }), analysis = analyzeBinding(model);
  assert.deepEqual(analysis.bones.map(region => region.driver), [3, 4, 5], 'one region per moving helper joint');
  const plan = planBinding(analysis, { rebind: 1, soft: 0, plates: 0, glue: 0 });
  assert.equal(plan.groups[analysis.offsets.get(1) + 7].join(), '1', 'the forearm follows the bone under the elbow joint, despite its junk pivot');
});

test('roots that only carry the skeleton, portrait bones and glow bones are off by default', () => {
  const model = arm();
  model.Bones.push({ Name: 'PortraitBackdrop', ObjectId: 6, Parent: -1, PivotPoint: new Float32Array([-200, 0, 0]) });
  model.Bones.push({ Name: 'HeroGlow', ObjectId: 7, Parent: 0, PivotPoint: new Float32Array([0, 0, 0]) });
  model.PivotPoints[6] = model.Bones.at(-2).PivotPoint; model.PivotPoints[7] = model.Bones.at(-1).PivotPoint;
  const excluded = defaultExcludedBones(model, analyzeBinding(model));
  assert.ok(excluded.has(6) && excluded.has(7) && !excluded.has(0) && !excluded.has(1));
});

test('apply writes compact classic groups, previews share untouched data, and HD weights stay valid', () => {
  const model = arm(), analysis = analyzeBinding(model), plan = planBinding(analysis, { rebind: 1, soft: 1, plates: 0 });
  const preview = previewBinding(model, analysis, plan);
  assert.equal(preview.Bones, model.Bones); assert.equal(preview.Geosets[0].Vertices, model.Geosets[0].Vertices);
  assert.notEqual(preview.Geosets[0].VertexGroup, model.Geosets[0].VertexGroup);
  assert.deepEqual(Array.from(model.Geosets[0].Groups), [[0]], 'previews never touch the model');
  applyBinding(model, analysis, plan);
  for (const geoset of model.Geosets) {
    assert.ok(geoset.Groups.length <= 256);
    assert.equal(new Set(geoset.Groups.map(group => group.join())).size, geoset.Groups.length, 'no duplicate groups');
    assert.equal(geoset.TotalGroupsCount, geoset.Groups.reduce((sum, group) => sum + group.length, 0));
  }
  const hd = arm(); for (const geoset of hd.Geosets) geoset.SkinWeights = new Uint8Array(geoset.Vertices.length / 3 * 8).map((_, slot) => slot % 8 === 4 ? 255 : 0);
  const hdAnalysis = analyzeBinding(hd);
  applyBinding(hd, hdAnalysis, planBinding(hdAnalysis, { rebind: 1, soft: 1, plates: 0 }));
  for (const geoset of hd.Geosets) for (let vertex = 0; vertex < geoset.Vertices.length / 3; vertex++) {
    const weights = Array.from(geoset.SkinWeights.subarray(vertex * 8 + 4, vertex * 8 + 8));
    assert.equal(weights.reduce((sum, weight) => sum + weight, 0), 255, 'HD weights add up to 255');
  }
});

test('every bone gets a colour; bones on one joint share it', () => {
  const model = arm({ helperJoints: true }), colors = boneColors(analyzeBinding(model));
  assert.deepEqual([...colors.keys()].sort(), [0, 1, 2]);
  assert.equal(new Set([...colors.values()].map(rgb => rgb.join())).size, 3);
  for (const rgb of colors.values()) assert.ok(rgb.every(value => value >= 0 && value <= 1));
});
