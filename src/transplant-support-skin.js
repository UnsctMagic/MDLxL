import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset, skinGeosetNormals } from './animation.js';
import { isHdSkinned, vertexBones } from './part-bones.js';
import { nodeIndex } from './node-hierarchy.js';

const point = (m, world, id) => new Vector3().fromArray(nodePivot(m, m.Nodes[id], id)).applyMatrix4(world.get(id));
const lateral = new Vector3(0, 1, 0);

// SD rigs can carry an entire cross-section on a single matrix group. When
// opposing hocks fold, the linear matrix average can squeeze that section to
// a line. Give each original section a rigid frame following its POSE handles.
export function supportLegSkin(model, own, donor, rig, sourceRig, entries, tree, newId, alignFrames) {
  const rest = sampleNodeMatrices(own, rig.reference.frame, rig.reference.sequence);
  const donorRest = sampleNodeMatrices(donor, sourceRig.reference.frame, sourceRig.reference.sequence);
  const chains = entries.filter(
    (e) => e.own.limbKind === 'leg' && e.own.joints.length === 4 && e.theirs.joints.length === 4
  );
  if (chains.length !== 2 || own.Geosets.some(isHdSkinned)) return null;
  const handles = new Map(),
    sections = new Map();
  const bend = (p) => p[2].clone().sub(p[0]).dot(p[3].clone().sub(p[0]).cross(lateral).normalize());
  const legs = chains.map(({ own: part, theirs }) => {
    const from = part.joints.map((id) => point(own, rest, id)),
      donorPoints = theirs.joints.map((id) => point(donor, donorRest, id));
    return {
      from,
      ids: theirs.joints,
      reverse: bend(from) * bend(donorPoints) < 0,
      sign: part.key === 'legL' ? -1 : 1
    };
  });
  if (legs.some((l) => !l.reverse)) return null;
  chains.forEach((e, l) => e.own.joints.forEach((id, k) => handles.set(id, { l, k })));
  const paths = new Map(
    [...tree.byId.keys()].map((id) => [id, handles.get(tree.ancestors(id, true).find((j) => handles.has(j)))])
  );
  const meshes = [];
  for (const [gi, original] of own.Geosets.entries()) {
    const vertices = [],
      groups = new Set();
    for (let v = 0; v < original.Vertices.length / 3; v++) {
      const bones = vertexBones(original, v);
      // Direct joint weighting already articulates the recipient's leg.
      if (bones.some((id) => handles.has(id))) return null;
      const slots = bones.map((id) => paths.get(id));
      if (!slots.length || !slots[0] || slots.some((p) => p?.l !== slots[0].l)) continue;
      const indices = slots.map((p) => p.k).sort(),
        l = slots[0].l,
        key = l + '-' + indices.join('.');
      if (!sections.has(key)) sections.set(key, { l, indices, center: new Vector3(), count: 0, keys: [] });
      vertices.push([v, sections.get(key)]);
      groups.add(key);
    }
    if (model.Geosets[gi].Groups.length + groups.size > 256) return null;
    meshes.push(vertices);
  }
  if (!sections.size) return null;
  const edges = [],
    faces = [];
  let next = Math.max(model.PivotPoints?.length || 0, ...allNodes(model).map((n) => n.ObjectId + 1));
  for (const [gi, vertices] of meshes.entries()) {
    if (!vertices.length) continue;
    const g = model.Geosets[gi],
      src = own.Geosets[gi],
      positions = skinGeoset(src, rest);
    const normals = src.Normals?.length === src.Vertices.length ? skinGeosetNormals(src, rest) : null;
    const groups = new Map();
    const atVertex = new Map(vertices),
      seen = new Set();
    for (let f = 0; f < src.Faces.length; f += 3)
      for (let k = 0; k < 3; k++) {
        const a = src.Faces[f + k],
          b = src.Faces[f + ((k + 1) % 3)],
          from = atVertex.get(a),
          to = atVertex.get(b);
        if (!from || !to || from === to || from.l !== to.l) continue;
        const pa = new Vector3().fromArray(positions, 3 * a),
          pb = new Vector3().fromArray(positions, 3 * b);
        const signature = [pa.toArray().join(','), pb.toArray().join(',')].sort().join('|');
        if (seen.has(signature)) continue;
        seen.add(signature);
        edges.push({ from, to, pa, pb, length: pa.distanceTo(pb) });
      }
    for (let f = 0; f < src.Faces.length; f += 3) {
      const ids = Array.from(src.Faces.subarray(f, f + 3)),
        parts = ids.map((v) => atVertex.get(v));
      if (parts.some((s) => !s || s.l !== parts[0].l) || new Set(parts).size < 2) continue;
      const points = ids.map((v) => new Vector3().fromArray(positions, 3 * v));
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      if (normal.lengthSq() > 1) faces.push({ parts, points, area: normal.length() });
    }
    for (const [v, s] of vertices) {
      if (!s.bone) {
        const driver = legs[s.l].ids[s.indices[0]];
        s.bone = {
          ObjectId: next++,
          Name: donor.Nodes[driver].Name + ' skin ' + s.indices.join('-'),
          Flags: 256,
          Parent: newId(driver),
          PivotPoint: new Float32Array(3),
          GeosetId: null,
          GeosetAnimId: null
        };
        model.Bones.push(s.bone);
      }
      if (!groups.has(s)) {
        groups.set(s, g.Groups.length);
        g.Groups.push([s.bone.ObjectId]);
        g.TotalGroupsCount++;
      }
      g.VertexGroup[v] = groups.get(s);
      g.Vertices.set(positions.subarray(v * 3, v * 3 + 3), v * 3);
      if (normals && g.Normals) g.Normals.set(normals.subarray(v * 3, v * 3 + 3), v * 3);
      s.center.add(new Vector3().fromArray(positions, v * 3));
      s.count++;
    }
  }
  for (const s of sections.values()) {
    s.center.divideScalar(s.count);
    s.bone.PivotPoint.set(s.center.toArray());
  }
  const items = [...sections.values()];
  for (const face of faces) {
    face.indices = face.parts.map((s) => items.indexOf(s));
    face.points.forEach((p, k) => p.sub(face.parts[k].center));
  }
  for (const edge of edges) {
    edge.i = items.indexOf(edge.from);
    edge.j = items.indexOf(edge.to);
    edge.pa.sub(edge.from.center);
    edge.pb.sub(edge.to.center);
  }
  return (donorMap) => {
    const all = items,
      hierarchy = nodeIndex(model);
    for (const leg of legs) leg.joints = leg.ids.map((j) => donorMap[j]);
    const base = sampleNodeMatrices(model, sourceRig.reference.frame, sourceRig.reference.sequence);
    const ancestors = new Set(legs.flatMap((l) => hierarchy.ancestors(l.joints[3], true)));
    const done = new Set();
    for (const [si, seq] of model.Sequences.entries()) {
      if (!seq.Interval || done.has(seq.Interval.join(','))) continue;
      done.add(seq.Interval.join(','));
      const [a, b] = seq.Interval,
        authored = new Set([a, b]);
      for (const id of ancestors)
        for (const k of ['Translation', 'Rotation', 'Scaling'])
          for (const key of model.Nodes[id][k]?.Keys || [])
            if (key.Frame > a && key.Frame < b) authored.add(key.Frame);
      const cache = new Map();
      const pose = (frame) => {
        if (cache.has(frame)) return cache.get(frame);
        const world = sampleNodeMatrices(model, frame, si);
        const limbs = legs.map((leg, index) => {
          const p = leg.joints.map((j) => point(model, world, j));
          const side = point(model, world, legs[1 - index].joints[0])
            .sub(p[0])
            .multiplyScalar(leg.sign)
            .normalize();
          const from = leg.from,
            foot = leg.joints[3];
          const turns = p.map((v, k) =>
            k < 3
              ? alignFrames(from[k + 1].clone().sub(from[k]), p[k + 1].clone().sub(v), lateral, side)
              : new Quaternion()
                  .setFromRotationMatrix(new Matrix4().extractRotation(world.get(foot)))
                  .multiply(
                    new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(base.get(foot))).invert()
                  )
                  .normalize()
          );
          return { dest: p, turns, side };
        });
        const poses = all.map((s) => {
          const { dest, turns } = limbs[s.l],
            source = legs[s.l].from;
          const center = new Vector3(),
            rotation = new Quaternion(0, 0, 0, 0),
            first = turns[s.indices[0]];
          for (const k of s.indices) {
            center.add(s.center.clone().sub(source[k]).applyQuaternion(turns[k]).add(dest[k]));
            const q = turns[k],
              sign = q.dot(first) < 0 ? -1 : 1;
            rotation.set(
              rotation.x + sign * q.x,
              rotation.y + sign * q.y,
              rotation.z + sign * q.z,
              rotation.w + sign * q.w
            );
          }
          center.divideScalar(s.indices.length);
          rotation.normalize();
          return { center, rotation };
        });
        // The donor can close its hock farther than the recipient's thick
        // calf fits. Rotate the whole calf with the hip-to-hoof chord first,
        // then fit the donor's individual joint turns within the skin's reach.
        for (const [li, leg] of legs.entries()) {
          const { dest, side } = limbs[li],
            from = leg.from;
          const axis = from[3].clone().sub(from[0]),
            reach = dest[3].clone().sub(dest[0]);
          const swing = alignFrames(axis, reach, lateral, side);
          const extension = reach.clone().sub(axis.clone().applyQuaternion(swing));
          const stable = all.map((s) => {
            const offset = s.center.clone().sub(from[0]);
            const along = Math.max(0, Math.min(1, offset.dot(axis) / axis.lengthSq()));
            return offset.applyQuaternion(swing).add(dest[0]).addScaledVector(extension, along);
          });
          const trial = (mix) =>
            all.map((s, j) =>
              s.l === li
                ? {
                    center: stable[j].clone().lerp(poses[j].center, mix),
                    rotation: swing.clone().slerp(poses[j].rotation, mix)
                  }
                : poses[j]
            );
          const at = (frames, j, offset) =>
            offset.clone().applyQuaternion(frames[j].rotation).add(frames[j].center);
          const straight = trial(0);
          const spans = edges
            .filter((e) => e.from.l === li)
            .map((e) => ({
              ...e,
              limit: Math.max(e.length * 1.14, at(straight, e.i, e.pa).distanceTo(at(straight, e.j, e.pb)) + 0.05)
            }));
          const area = (frames, f) => {
            const [a, b, c] = f.indices.map((j, k) => at(frames, j, f.points[k]));
            return b.sub(a).cross(c.sub(a)).length();
          };
          const patches = faces
            .filter((f) => f.parts[0].l === li)
            .map((f) => ({ ...f, limit: Math.min(0.65 * f.area, 0.95 * area(straight, f)) }));
          const fits = (frames) =>
            spans.every((e) => at(frames, e.i, e.pa).distanceTo(at(frames, e.j, e.pb)) <= e.limit) &&
            patches.every((f) => area(frames, f) >= f.limit);
          if (fits(poses)) continue;
          let low = 0,
            high = 1;
          for (let n = 0; n < 9; n++) {
            const mid = (low + high) / 2;
            if (fits(trial(mid))) low = mid;
            else high = mid;
          }
          const best = trial(low);
          all.forEach((s, j) => {
            if (s.l === li) poses[j] = best[j];
          });
        }
        const output = poses.map(({ center, rotation }, i) => {
          const s = all[i],
            pm = world.get(s.bone.Parent),
            parent = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(pm)).normalize();
          return {
            p: center.applyMatrix4(pm.clone().invert()).sub(s.center),
            q: parent.invert().multiply(rotation).normalize()
          };
        });
        cache.set(frame, output);
        return output;
      };
      const keep = new Set(authored),
        times = [...authored].sort((x, y) => x - y);
      const split = (x, y) => {
        if (y - x <= 16) return;
        const u = pose(x),
          v = pose(y);
        if (
          [0.25, 0.5, 0.75].every((t) =>
            pose(Math.round(x + (y - x) * t)).every(
              (n, j) =>
                n.p.distanceTo(u[j].p.clone().lerp(v[j].p, t)) < 0.15 &&
                n.q.angleTo(u[j].q.clone().slerp(v[j].q, t)) < 0.005
            )
          )
        )
          return;
        const mid = Math.round((x + y) / 2);
        keep.add(mid);
        split(x, mid);
        split(mid, y);
      };
      for (let j = 1; j < times.length; j++) split(times[j - 1], times[j]);
      for (const Frame of [...keep].sort((x, y) => x - y))
        pose(Frame).forEach((v, j) => all[j].keys.push({ Frame, ...v }));
    }
    for (const s of all) {
      const rotations = [],
        translations = [];
      let previous;
      for (const { Frame, q, p } of s.keys.sort((a, b) => a.Frame - b.Frame)) {
        const v = q.toArray();
        if (previous && previous.dot(q) < 0) for (let k = 0; k < 4; k++) v[k] *= -1;
        previous = new Quaternion().fromArray(v);
        rotations.push({ Frame, Vector: new Float32Array(v) });
        translations.push({ Frame, Vector: new Float32Array(p.toArray()) });
      }
      s.bone.Rotation = { LineType: 1, GlobalSeqId: null, Keys: rotations };
      s.bone.Translation = { LineType: 1, GlobalSeqId: null, Keys: translations };
    }
  };
}
