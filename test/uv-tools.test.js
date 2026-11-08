import test from 'node:test';
import assert from 'node:assert/strict';
import { combineUVGeosets, combineSelectedUVGeosets, splitSelectedUVGeosets, collapseUVCoordinates, foldUVCoordinates, projectUVFromView, uvTurn, relevantUVMaterials, otherUVMaterials, splitCombinedUV, uncoupleUVVertices } from '../src/uv-tools.js';
import { compositeMaterialPixels } from '../src/uv-material-compositor.js';

const geoset = (offset = 0, material = 0) => ({ MaterialID: material,
  Vertices: new Float32Array([offset, 0, 0, offset + 1, 0, 0, offset, 1, 0, offset + 1, 1, 0]),
  Normals: new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]), VertexGroup: new Uint8Array([0,0,0,0]),
  TVertices: [new Float32Array([0,0, 1,0, 0,1, 1,1])], Faces: new Uint16Array([0,1,2, 1,3,2]), Groups: [[0]],
});

test('the UV material menu can offer every other model material for the working geosets', () => {
  const texture = name => ({ Image: name, ReplaceableId: 0, Flags: 3 });
  const model = {
    Textures: [texture('A.blp'), texture('B.blp')],
    Materials: [{ Layers: [{ TextureID: 0 }] }, { Layers: [{ TextureID: 1, CoordId: 1 }] }, { Layers: [{ TextureID: 1, CoordId: 3 }] }],
    Geosets: [{ MaterialID: 0, TVertices: [[0, 0], [0, 0]] }],
  };
  const others = otherUVMaterials(model, [0], [0]);
  assert.deepEqual(others.map(entry => [entry.materialID, entry.label, entry.geosetIndices]), [[1, 'Material 2 · B.blp', [0]], [2, 'Material 3 · B.blp', [0]]]);
  // The geoset has no fourth UV set, so the third material falls back to one it does have.
  assert.deepEqual(others.map(entry => entry.coordId), [1, 0]);
});

test('relevant UV material menu contains only materials used by available geosets and retains every WC3 layer', () => {
  const model = { Textures: [{ ReplaceableId: 1 }, { Image: 'Textures\\Body.blp' }, { Image: 'Other.blp' }], Materials: [
    { Layers: [{ TextureID: 0, CoordId: 0, FilterMode: 0 }, { TextureID: 1, CoordId: 0, FilterMode: 2 }] },
    { Layers: [{ TextureID: 2, CoordId: 0, FilterMode: 0 }] },
  ], Geosets: [geoset(0, 0), geoset(2, 0), geoset(4, 1)], Sequences: [], GlobalSequences: [] };
  const entries = relevantUVMaterials(model, { 0: [0,1], 1: [2], 2: [] });
  assert.equal(entries.length, 1); assert.equal(entries[0].materialID, 0); assert.deepEqual(entries[0].geosetIndices, [0,1]);
  assert.deepEqual(entries[0].layers.map(layer => layer.label), ['Team Color', 'Body.blp']);
  assert.match(entries[0].label, /Team Color \+ Body\.blp/);
});

test('combined material map round-trips UVs across multiple geosets without exposing unavailable vertices', () => {
  const model = { Geosets: [geoset(0), geoset(2)] };
  const combined = combineUVGeosets(model, [0,1], { 0: [0,1,2], 1: [1,2,3] }, { 0: [1], 1: [2] });
  assert.deepEqual(combined.eligibleVertices, [0,1,2,5,6,7]); assert.deepEqual(combined.selectedVertices, [1,6]);
  const edited = new Float32Array(combined.geoset.TVertices[0]); edited[2] = .25; edited[13] = .75;
  const changes = splitCombinedUV(model, combined.refs, edited);
  assert.equal(changes.length, 2); assert.equal(changes[0].values[2], .25); assert.equal(changes[1].values[5], .75);
  assert.equal(model.Geosets[0].TVertices[0][2], 1, 'temporary map does not mutate the model');
});

test('Collapse shares the centroid and repeated Fold presses halve the selected UV span like paper', () => {
  const values = new Float32Array([0,0, 1,0, 2,0, 3,0]);
  assert.deepEqual([...collapseUVCoordinates(values, [0,3])], [1.5,0, 1,0, 2,0, 1.5,0]);
  const once = foldUVCoordinates(values, [0,1,2,3], 'right-to-left');
  assert.deepEqual([...once], [0,0, 1,0, 1,0, 0,0]);
  assert.deepEqual([...foldUVCoordinates(once, [0,1,2,3], 'right-to-left')], [0,0, 0,0, 0,0, 0,0]);
  assert.deepEqual([...foldUVCoordinates(new Float32Array([0,0, .25,0, 1,0]), [0,1,2], 'right-to-left')], [0,0, .25,0, 0,0]);
});

test('UV Uncouple matches MDLVis by duplicating face corners, moving active UVs inward, and clearing selection', () => {
  const joined = geoset(); joined.Faces = new Uint16Array([0,1,2, 0,2,3]); joined.Tangents = new Float32Array(16).map((_, i) => i); joined.SkinWeights = new Uint8Array(32).map((_, i) => i);
  joined.TVertices.push(new Float32Array([.2,.2, .8,.2, .2,.8, .8,.8]));
  const joinedBefore = structuredClone(joined), changed = uncoupleUVVertices(joined, [0], 0);
  assert.equal(changed.added, 1); assert.deepEqual(changed.created, [4]); assert.deepEqual(changed.selection, []);
  assert.deepEqual([...joined.Faces], [0,1,2,4,2,3]);
  assert.deepEqual([...joined.TVertices[0]], [.10000000149011612,.10000000149011612, 1,0, 0,1, 1,1, .10000000149011612,.20000000298023224]);
  assert.deepEqual([...joined.TVertices[1].slice(8,10)], [.20000000298023224,.20000000298023224], 'inactive UV sets are copied without movement');
  assert.deepEqual([...joined.Vertices.slice(12,15)], [...joinedBefore.Vertices.slice(0,3)]); assert.deepEqual([...joined.Normals.slice(12,15)], [...joinedBefore.Normals.slice(0,3)]);
  assert.deepEqual([...joined.Tangents.slice(16,20)], [...joinedBefore.Tangents.slice(0,4)]); assert.deepEqual([...joined.SkinWeights.slice(32,40)], [...joinedBefore.SkinWeights.slice(0,8)]);
});

test('UV Uncouple separates selected coincident points by their own faces without touching unrelated stacks', () => {
  const geo = {
    Vertices: new Float32Array(30), Normals: new Float32Array(30), VertexGroup: new Uint8Array(10),
    TVertices: [new Float32Array([.5,.5, 0,0, 0,1, .5,.5, 1,0, 1,1, .5,.5, .2,.8, .8,.8, .5,.5])],
    Faces: new Uint16Array([0,1,2, 3,4,5, 6,7,8]),
  };
  const beforeGeometry = new Float32Array(geo.Vertices), result = uncoupleUVVertices(geo, [0,3,6], 0);
  assert.equal(result.added, 0); assert.deepEqual(result.selection, []);
  const points = [0,3,6].map(index => [...geo.TVertices[0].slice(index * 2, index * 2 + 2)]);
  assert.deepEqual(points, [[.4000000059604645,.5], [.6000000238418579,.5], [.5,.5600000023841858]]);
  assert.deepEqual([...geo.TVertices[0].slice(18,20)], [.5,.5], 'an unselected coincident point remains untouched');
  assert.deepEqual(geo.Vertices, beforeGeometry, 'uncoupling never moves the 3D mesh');
});

test('view projection keeps the selected UV center and uses the user view for orientation and scale', () => {
  const geo = { Vertices: new Float32Array([-1,-1,0, 1,1,0, 0,0,0]), TVertices: [new Float32Array([.4,.4, .4,.4, .8,.8])] };
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const projected = projectUVFromView(geo, [0,1], identity, identity);
  assert.ok(Math.abs(projected[0] + .1) < 1e-6); assert.ok(Math.abs(projected[1] - .9) < 1e-6);
  assert.ok(Math.abs(projected[2] - .9) < 1e-6); assert.ok(Math.abs(projected[3] + .1) < 1e-6);
  assert.deepEqual([...projected.slice(4)], [.800000011920929,.800000011920929], 'unselected UVs stay unchanged');
  assert.ok(Math.abs((projected[0] + projected[2]) / 2 - .4) < 1e-6);
  assert.ok(Math.abs((projected[1] + projected[3]) / 2 - .4) < 1e-6);

  const quarterScale = [.25,0,0,0, 0,.25,0,0, 0,0,1,0, 0,0,0,1];
  const scaled = projectUVFromView(geo, [0,1], identity, quarterScale);
  assert.ok(Math.abs(scaled[2] - scaled[0] - .25) < 1e-6, 'camera zoom controls projected width');
  assert.ok(Math.abs(scaled[1] - scaled[3] - .25) < 1e-6, 'camera zoom controls projected height');
  assert.ok(Math.abs((scaled[0] + scaled[2]) / 2 - .4) < 1e-6, 'camera framing does not move the UV island');

  const pannedView = [1,0,0,0, 0,1,0,0, 0,0,1,0, .6,-.4,0,1];
  assert.deepEqual(projectUVFromView(geo, [0,1], pannedView, identity), projected, 'camera panning cannot teleport the UV island');
});

test('material compositor combines opaque team colour and alpha image layers and supports modulate 2x', () => {
  const base = new Uint8ClampedArray([255,0,0,255]), blue = new Uint8ClampedArray([0,0,255,128]);
  assert.deepEqual([...compositeMaterialPixels([{ pixels: base, filterMode: 0, alpha: 1 }, { pixels: blue, filterMode: 2, alpha: 1 }], 1, 1)], [127,0,128,255]);
  assert.deepEqual([...compositeMaterialPixels([{ pixels: new Uint8ClampedArray([64,64,64,255]), filterMode: 0, alpha: 1 }, { pixels: new Uint8ClampedArray([255,128,64,255]), filterMode: 6, alpha: 1 }], 1, 1)], [128,64,32,255]);
});

for (const texture of ['first.blp', 'second.blp']) test(`combined projection keeps geoset placement with ${texture === 'first.blp' ? 'matching' : 'different'} textures and UV sets`, () => {
  const first = geoset(0, 0), second = geoset(1, 1);
  second.TVertices.push(new Float32Array([.2,.3, .4,.5, .6,.7, .8,.9]));
  const model = { Geosets: [first, second, geoset(5)], Materials: [{ Layers: [{ TextureID: 0, CoordId: 0 }] }, { Layers: [{ TextureID: 1, CoordId: 1 }] }], Textures: [{ Image: 'first.blp' }, { Image: texture }] };
  const original = structuredClone(model), domain = { 0: [0,1,2], 1: [0,1,2] }, selected = { 0: [0,1], 1: [0,1] };
  const canvas = combineSelectedUVGeosets(model, domain, selected, relevantUVMaterials(model, domain));
  const identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const values = projectUVFromView(canvas.geoset, canvas.selectedVertices, identity, identity);
  const changes = splitSelectedUVGeosets(model, canvas.refs, values), [a, b] = changes.map(change => change.values);
  assert.deepEqual(changes.map(change => [change.geosetIndex, change.uvSet]), [[0,0],[1,1]]);
  assert.ok(Math.abs(a[2] - b[0]) < 1e-6 && Math.abs(a[3] - b[1]) < 1e-6, 'the shared 3D edge stays joined in UV space');
  assert.ok(Math.abs(b[2] - a[0] - 1) < 1e-6, 'the combined width retains the parts model-space spacing');
  assert.ok(Math.abs((a[0] + a[2] + b[0] + b[2]) / 4 - .4) < 1e-6, 'one shared center anchors the whole selection');
  assert.ok(Math.abs((a[1] + a[3] + b[1] + b[3]) / 4 - .2) < 1e-6);
  for (const change of changes) assert.deepEqual(change.values.slice(4), original.Geosets[change.geosetIndex].TVertices[change.uvSet].slice(4), 'unselected UVs stay unchanged');
  const pan = identity.slice(); pan[12] = .6; pan[13] = -.4;
  assert.deepEqual(projectUVFromView(canvas.geoset, canvas.selectedVertices, pan, identity), values, 'panning leaves the whole projection anchored');
  for (const change of changes) model.Geosets[change.geosetIndex].TVertices[change.uvSet] = change.values;
  model.Geosets[0].TVertices[0] = original.Geosets[0].TVertices[0]; model.Geosets[1].TVertices[1] = original.Geosets[1].TVertices[1];
  assert.deepEqual(model, original, 'materials, geometry, rigging, other geosets and inactive UV sets are preserved');
});


test('selected geosets of different materials stay on one canvas and edits return to their own UV sets', () => {
  const first = geoset(0, 0), second = geoset(2, 1);
  first.TVertices.push(new Float32Array([.1,.2, .3,.4, .5,.6, .7,.8]));
  second.TVertices.push(new Float32Array([.9,.8, .7,.6, .5,.4, .3,.2]));
  const model = { Geosets: [first, second], Materials: [{ Layers: [{ TextureID: 0, CoordId: 0 }] }, { Layers: [{ TextureID: 1, CoordId: 1 }] }], Textures: [{ Image: 'first.blp' }, { Image: 'second.blp' }] };
  const original = structuredClone(model), domain = { 0: [0,1,2], 1: [0,1,2] }, selected = { 0: [1], 1: [1] };
  const materials = relevantUVMaterials(model, domain);
  assert.equal(materials.length, 2);
  const canvas = combineSelectedUVGeosets(model, domain, selected, materials);
  assert.deepEqual(canvas.selectedVertices, [1,5]);
  assert.deepEqual(canvas.refs.filter(ref => ref.vertexIndex === 1).map(ref => ref.uvSet), [0,1]);
  assert.equal(canvas.geoset.TVertices[0][10], second.TVertices[1][2]);
  const values = new Float32Array(canvas.geoset.TVertices[0]);
  values[2] = .25; values[10] = .75;
  const changes = splitSelectedUVGeosets(model, canvas.refs, values);
  assert.deepEqual(changes.map(change => [change.geosetIndex, change.uvSet]), [[0,0],[1,1]]);
  assert.equal(changes[0].values[2], .25);
  assert.equal(changes[1].values[2], .75);
  assert.deepEqual(model, original, 'the combined canvas never changes the input model');
  assert.deepEqual(splitSelectedUVGeosets(model, canvas.refs, canvas.geoset.TVertices[0]), [], 'unchanged geosets are not written');
});

// Owner lock, 6 Nov 2026 (docs/UV-ROTATE-ZOOM.md). If one of these fails, the
// feel changed: do not edit the numbers unless the owner asked for a new rule.
test('UV map Rotate: only circling turns, same strength everywhere, never snaps', () => {
  const deg = Math.PI / 180, pivotScreen = [100, 50];
  const run = (points, drag = { pivotScreen }) => { let previous = 0, biggest = 0; for (const [x, y] of points) { const turn = uvTurn(drag, x, y); biggest = Math.max(biggest, Math.abs(turn - previous)); previous = turn; } return { total: previous / deg, biggest: biggest / deg }; };
  const arc = (radius, from, to, steps = 90, round = false) => Array.from({ length: steps + 1 }, (_, i) => { const a = (from + (to - from) * i / steps) * deg, x = 100 + radius * Math.cos(a), y = 50 + radius * Math.sin(a); return round ? [Math.round(x), Math.round(y)] : [x, y]; });
  const line = (x0, y0, x1, y1, steps = 300) => Array.from({ length: steps + 1 }, (_, i) => [Math.round(100 + x0 + (x1 - x0) * i / steps), Math.round(50 + y0 + (y1 - y0) * i / steps)]);
  // Same quarter circle, same 70% turn at any distance from 24 px out, even on whole pixels.
  for (const radius of [24, 48, 60, 100, 300]) {
    assert.ok(Math.abs(run(arc(radius, 30, 120)).total - 63) < 1e-9, `quarter circle at ${radius}px turns 63°`);
    assert.ok(Math.abs(run(arc(radius, 30, 120, 360, true)).total - 63) < 2, `rounded quarter circle at ${radius}px stays near 63°`);
  }
  // Nearer the centre the same circle turns less, steadily (no jump, no reversal).
  assert.ok(Math.abs(run(arc(12, 30, 120)).total - 31.5) < 1e-9, 'quarter circle at 12px turns half as far');
  assert.ok(Math.abs(run(arc(80, 0, 450)).total - 315) < 1e-9, 'clockwise past a full turn');
  assert.ok(Math.abs(run(arc(80, 0, -720, 144)).total + 504) < 1e-9, 'counter-clockwise past two turns');
  assert.ok(Math.abs(run(arc(80, 0, 90), { pivotScreen, fine: .2 }).total - 12.6) < 1e-9, 'Shift/Alt fine control');
  assert.ok(Math.abs(run(arc(80, 0, 90), { pivotScreen, wrapperControls: false }).total - 90) < 1e-9, 'FX texture fitting keeps one for one');
  // Owner, 7 Nov: a big piece must never spin. Over the piece its farthest point
  // moves at most 70% of the mouse; outside the piece nothing changes.
  for (const radius of [24, 40, 100, 200]) {
    const mousePath = radius * 90 * deg, { total } = run(arc(radius, 30, 120), { pivotScreen, reach: 400 });
    assert.ok(Math.abs(total * deg * 400 - mousePath * .7) < 1e-6, `over a 400px piece at ${radius}px the far edge moves 70% of the mouse`);
  }
  assert.ok(Math.abs(run(arc(500, 30, 120), { pivotScreen, reach: 400 }).total - 63) < 1e-9, 'outside a big piece the turn is unchanged');
  assert.ok(Math.abs(run(arc(60, 30, 120), { pivotScreen, reach: 10 }).total - 63) < 1e-9, 'a small piece turns as before');
  assert.ok(Math.abs(run(arc(80, 0, 90), { pivotScreen, wrapperControls: false, reach: 400 }).total - 90) < 1e-9, 'FX texture fitting ignores piece size');
  // Straight toward/away from the centre does not turn, in any direction.
  for (const [vx, vy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.6, .8], [-.8, .6]]) {
    assert.ok(Math.abs(run(line(vx * 24, vy * 24, vx * 230, vy * 230)).total) < 1, `straight away ${vx},${vy} does not turn`);
    assert.ok(Math.abs(run(line(vx * 230, vy * 230, vx * 24, vy * 24)).total) < 1, `straight toward ${vx},${vy} does not turn`);
  }
  // Sweeping straight across the piece beside its centre never snaps or spins.
  for (const offset of [3, 5, -5, 8]) {
    const { total, biggest } = run(line(-150, offset, 150, offset));
    assert.ok(biggest < 3, `across at ${offset}px: biggest step ${biggest.toFixed(1)}° stays under 3°`);
    assert.ok(Math.abs(total) < 100, `across at ${offset}px: total ${total.toFixed(0)}° stays under 100°`);
  }
  // The mouse exactly on the centre is skipped, not a jump.
  const centre = { pivotScreen }; uvTurn(centre, 100, 50); assert.equal(uvTurn(centre, 101, 50), 0);
});
