import { Quaternion, Vector3 } from 'three';

/** Tiny authored walk, with original geometry and no external model assets. */
export function stepFixture({ legCount = 2, dense = false } = {}) {
  const bones = [{ ObjectId: 0, Name: 'Body', Parent: null, PivotPoint: [0, 0, 12], Flags: 256 }], chains = [], geosets = [];
  const q = angle => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle).toArray();
  for (let leg = 0; leg < legCount; leg++) {
    const root = bones.length, y = leg % 2 ? 2 : -2, x = leg > 1 ? -6 : 0, end = root + 2;
    const phase = leg % 2 ? -1 : 1;
    const frames = dense ? Array.from({ length: 41 }, (_, i) => i * 25) : [0, 500, 1000];
    const rotation = { LineType: 1, GlobalSeqId: null, Keys: frames.map(Frame => ({ Frame, Vector: new Float32Array(q(phase * .4 * Math.cos(Frame / 1000 * Math.PI * 2))) })) };
    bones.push(
      { ObjectId: root, Name: 'Upper leg', Parent: 0, PivotPoint: [x, y, 10], Rotation: rotation, Flags: 256 },
      { ObjectId: root + 1, Name: 'Knee', Parent: root, PivotPoint: [x + 3, y, 6], Flags: 256 },
      { ObjectId: end, Name: 'Foot', Parent: root + 1, PivotPoint: [x, y, 1], Flags: 256 });
    chains.push({ root, middle: root + 1, end, kind: 'leg', key: `leg:${end}` });
    geosets.push({ Vertices: new Float32Array([x - 1, y - .7, 0, x + 2, y - .7, 0, x + 2, y + .7, 0, x - 1, y + .7, 0]), Faces: [0, 1, 2, 0, 2, 3], VertexGroup: [0, 0, 0, 0], Groups: [[end]] });
  }
  const model = { Bones: bones, Helpers: [], PivotPoints: bones.map(node => node.PivotPoint), Sequences: [{ Name: 'Walk', Interval: [0, 1000] }, { Name: 'Other', Interval: [2000, 3000] }], GlobalSequences: [], Geosets: geosets, GeosetAnims: [] };
  return { model, config: { body: 0, chains, nodes: [0], roles: { 0: 'Body' }, pins: [] }, anchors: [0, 500, 1000] };
}
