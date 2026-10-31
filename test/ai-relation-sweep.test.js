import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleAiModel } from '../src/ai-sampling.js';

const key = (Frame, ...Vector) => ({ Frame, Vector });
const track = (...Keys) => ({ LineType: 1, Keys });
const point = { geoset: 0, vertices: [0, 1] }, anchor = { nodeId: 0 };
const run = async (model, sweep) => sampleAiModel(model, { sequence: 0, frame: 0 }, { frames: [0], sweep });
const records = result => result.rows.map(row => Object.fromEntries(result.columns.map((name, i) => [name, row[i]])));

function fixture() {
  return {
    Sequences: ['Turn', 'Stand', 'Last'].map((Name, i) => ({ Name, Interval: [i * 100, i * 100 + 64] })),
    GlobalSequences: [], PivotPoints: [],
    Bones: [
      { ObjectId: 0, Rotation: track(key(0, 0, 0, 0, 1), key(64, 0, 0, 1, 0)) },
      { ObjectId: 1, Parent: 0, Translation: track(key(200, 0, 0, 0), key(222, 0, 0, 0), key(223, 3, 0, 0), key(224, 0, 0, 0)) },
    ],
    Geosets: [{ Vertices: [1, 0, 0, 5, 0, 0], VertexGroup: [0, 0], Groups: [[1]], Faces: [] }],
  };
}

test('attached follows a rotating reference space and finds the single slipping frame', async () => {
  const model = fixture();
  const result = await run(model, { kind: 'attached', a: point, b: anchor, limit: 2 });
  assert.deepEqual(result.worst, { clip: 'Last', frame: 223, value: 3 });
  const rows = records(result);
  assert.ok(rows[0].worst < 1e-6 && rows[1].worst === 0);
  assert.deepEqual(rows.map(r => r.framesSampled), [65, 65, 65]);
  assert.ok(Math.abs(rows[2].sharePast - 1 / 65) < 0.00001);
  assert.deepEqual([rows[2].p50, rows[2].p95], [0, 0]);
  // A group bound to the rotating anchor has the same orientation as its node.
  model.Geosets.push({ Vertices: [0, 0, 0, 2, 0, 0], VertexGroup: [0, 0], Groups: [[0]] });
  const grouped = await run(model, { kind: 'attached', a: point, b: { geoset: 1, vertices: [0, 1] } });
  assert.deepEqual(grouped.worst, result.worst);
  assert.ok(records(grouped)[0].worst < 1e-6);
  const custom = await run(model, { kind: 'attached', a: point, b: anchor, reference: { sequence: 2, frame: 223 }, sequences: [1] });
  assert.deepEqual(custom.worst, { clip: 'Stand', frame: 100, value: 3 });
});

test('clear finds the closest vertex pair between spot checks and excludes invisible frames', async () => {
  const m = fixture();
  m.Bones[0].Rotation = undefined;
  m.Bones[1].Translation = track(key(0, 10, 0, 0), key(23, 10, 0, 0), key(24, -1, 0, 0), key(25, 10, 0, 0));
  const frames = Array.from({ length: 32 }, (_, i) => Math.round(i * 64 / 31));
  const picked = sampleAiModel(m, { sequence: 0 }, { frames, nodeIds: [0], vertices: { 0: [0, 1] } });
  assert.equal(Math.min(...picked.samples.flatMap(s => s.geosets[0].selected.positions.map(p =>
    Math.abs(p.position[0] - s.nodes[0].position[0])))), 11);
  const rule = { kind: 'clear', a: point, b: anchor, sequences: [0], limit: 1 };
  const result = await run(m, rule);
  assert.deepEqual(result.worst, { clip: 'Turn', frame: 24, value: 0 });
  assert.ok(Math.abs(records(result)[0].sharePast - 1 / 65) < 0.00001);
  m.GeosetAnims = [{ GeosetId: 0, Alpha: { LineType: 0, Keys: [key(0, 1), key(24, 0), key(25, 1)] } }];
  const hidden = records(await run(m, rule))[0];
  assert.equal(hidden.worst, 11);
  assert.equal(hidden.framesSampled, 65);
  assert.equal(hidden.measured, 64);
  m.GeosetAnims[0].Alpha = 0;
  const none = await run(m, rule);
  assert.equal(none.worst, null);
  assert.equal(records(none)[0].sharePast, null);
});

test('level measures signed Z and its spread on the isolated global clock', async () => {
  const m = fixture();
  m.GlobalSequences = [8];
  m.Bones[1].Translation = { ...track(key(0, 0, 0, -2), key(4, 0, 0, 6), key(8, 0, 0, -2)), GlobalSeqId: 0 };
  const result = await run(m, { kind: 'level', a: point, b: anchor, globalSequence: 0, limit: 3 });
  assert.deepEqual(result.worst, { clip: 'global sequence 0', frame: 4, value: 6 });
  const [row] = records(result);
  assert.deepEqual([row.framesSampled, row.min, row.max, row.spread], [9, -2, 6, 8]);
  assert.ok(Math.abs(row.sharePast - 3 / 9) < 0.00001);
  assert.equal((await run(m, { kind: 'level', a: point })).rows.length, 4);
});

test('long clips include the off-grid endpoint, report step and flag billboard nodes', async () => {
  const m = fixture();
  m.Bones[1].Flags = 8;
  m.Sequences[2].Interval = [200, 5203];
  m.Bones[1].Translation = track(key(200, 0, 0, 0), key(5203, 0, 0, -7));
  const result = await run(m, { kind: 'level', a: point, sequences: [2] });
  assert.deepEqual(result.cameraDependentNodes, [1]);
  assert.deepEqual(result.worst, { clip: 'Last', frame: 5203, value: -7 });
  const [row] = records(result);
  assert.deepEqual([row.framesSampled, row.stepMs, row.spread], [502, 10, 7]);
});

test('invalid points, reference poses and clip selectors give actionable errors', async () => {
  const level = { kind: 'level', a: anchor };
  for (const [change, message] of [
    [{ a: { nodeId: 8 } }, /node/i], [{ a: { geoset: 3, vertices: [0] } }, /geoset/i],
    [{ a: { geoset: 0, vertices: [2] } }, /vert/i], [{ sequences: [14] }, /sequence/i],
    [{ globalSequence: 9 }, /global/i], [{ kind: 'clear' }, /point B/i],
    [{ kind: 'attached', b: point, reference: { sequence: 0, frame: 99 } }, /reference/i],
  ]) await assert.rejects(run(fixture(), { ...level, ...change }), message);
});

test('30-clip evidence stays below 2 KiB without per-frame values or verdicts', async () => {
  const m = fixture();
  m.Sequences = Array.from({ length: 30 }, (_, i) => ({ Name: 'Animation ' + i, Interval: [i * 100, i * 100 + 64] }));
  m.Bones[1].Translation = track(...m.Sequences.flatMap(({ Interval: [lo, hi] }) =>
    [key(lo, 0, 0, -1), key(hi, 0, 0, 2)]));
  const result = await run(m, { kind: 'level', a: point, limit: .1 });
  assert.equal(result.rows.length, 30);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 2048);
  assert.doesNotMatch(JSON.stringify(result), /perFrame|passed|failed/);
});
