// Cloth that hangs from the torso or a shoulder and has no donor counterpart keeps
// the model's own motion against its own torso (CP14, owner 24 Nov 2026: donor and
// model archers are near twins, yet the cape ballooned). The transplant would bind
// such a chain to a donor forearm, which flings the cloth whenever the arm moves.
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset } from './animation.js';
import { sameKindSequence } from './anim-transfer.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';
import { standSequenceIndex } from './sequence-editor.js';

const BONE_FLAG = 256;
const notCloth = /weapon|sword|axe|blade|shield|bow|quiver|arrow|bolt|gun|rifle|staff|spear|hammer|mace|head|hair|jaw|eye|brow|lip|portrait|finger|thumb/i;
const MAX_SAMPLES = 40, STEP = 50;

// Best similarity transform taking points p onto q (Horn, unit quaternions).
export function similarity(p, q) {
  const n = p.length, cp = new Vector3(), cq = new Vector3();
  for (let i = 0; i < n; i++) { cp.add(p[i]); cq.add(q[i]); }
  cp.divideScalar(n); cq.divideScalar(n);
  const S = [[0,0,0],[0,0,0],[0,0,0]];
  let sp = 0, sq = 0;
  for (let i = 0; i < n; i++) {
    const a = p[i].clone().sub(cp), b = q[i].clone().sub(cq);
    sp += a.lengthSq(); sq += b.lengthSq();
    const A = a.toArray(), B = b.toArray();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += A[r] * B[c];
  }
  if (sp < 1e-9) return null;
  const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]] = S;
  const N = [
    [xx+yy+zz, yz-zy, zx-xz, xy-yx],
    [yz-zy, xx-yy-zz, xy+yx, zx+xz],
    [zx-xz, xy+yx, -xx+yy-zz, yz+zy],
    [xy-yx, zx+xz, yz+zy, -xx-yy+zz],
  ];
  const shift = Math.abs(xx)+Math.abs(yy)+Math.abs(zz)+Math.abs(xy)+Math.abs(xz)+Math.abs(yx)+Math.abs(yz)+Math.abs(zx)+Math.abs(zy)+1e-6;
  let v = [1, .01, .02, .03];
  for (let k = 0; k < 200; k++) {
    const w = N.map((row, r) => row.reduce((s, x, c) => s + x * v[c], 0) + shift * v[r]);
    const len = Math.hypot(...w);
    if (len < 1e-12) return null;
    v = w.map(x => x / len);
  }
  const rotation = new Quaternion(v[1], v[2], v[3], v[0]).normalize();
  const scale = Math.sqrt(sq / sp);
  const offset = cq.clone().sub(cp.clone().applyQuaternion(rotation).multiplyScalar(scale));
  return new Matrix4().compose(offset, rotation, new Vector3(scale, scale, scale));
}

function lengthOfChain(tree, id, inChain) {
  let best = 1;
  for (const child of tree.children.get(id) || []) if (inChain(child.ObjectId)) best = Math.max(best, 1 + lengthOfChain(tree, child.ObjectId, inChain));
  return best;
}

/** Returns the number of vertices that now follow the model's own cloth motion. */
export function nativeCloth(M, own, rigB, rigA, donorMap) {
  if (!rigB?.ok || !rigA?.ok || !rigB.parts.chest) return { vertices: 0, chains: [] };
  const tree = nodeIndex(own);
  const anatomy = new Set(Object.values(rigB.parts).flatMap(p => p.joints));
  const arms = Object.values(rigB.parts).filter(p => p.limbKind === 'arm');
  const torso = new Set([...(rigB.parts.chest.joints || []), ...(rigB.parts.hips?.joints || [])]);
  const anchors = new Set([...(rigB.parts.chest.joints || []), ...arms.map(p => p.joints[0])]);
  // Donor forearms and hands as they appear in the result.
  const forearms = new Set(Object.values(rigA.parts).filter(p => p.limbKind === 'arm')
    .flatMap(p => p.joints.slice(1)).map(id => donorMap[id] ?? id));
  const tops = allNodes(own).filter(n => !anatomy.has(n.ObjectId) && anchors.has(n.Parent) && !notCloth.test(n.Name || ''));
  // Chains of cloth links (at least three deep). Chains that share skin are one garment.
  const found = [];
  for (const top of tops) {
    const members = new Set([top.ObjectId]);
    const visit = id => { for (const c of tree.children.get(id) || []) if (!anatomy.has(c.ObjectId) && !members.has(c.ObjectId)) { members.add(c.ObjectId); visit(c.ObjectId); } };
    visit(top.ObjectId);
    if ([...members].some(id => notCloth.test(own.Nodes[id]?.Name || ''))) continue;
    if (lengthOfChain(tree, top.ObjectId, id => members.has(id)) < 3) continue;
    found.push({ top: top.ObjectId, members });
  }
  const garments = [];
  const skinOf = members => {
    const skin = [];
    for (const [gi, g] of own.Geosets.entries()) {
      const rg = M.Geosets[gi];
      if (!rg || rg.Vertices.length !== g.Vertices.length) continue;
      for (let v = 0; v < g.Vertices.length / 3; v++) {
        const bones = vertexBones(g, v);
        if (bones.length && bones.every(id => members.has(id))) skin.push([gi, v]);
      }
    }
    return skin;
  };
  for (const chain of found) {
    const joined = garments.find(g => {
      const both = new Set([...g.members, ...chain.members]);
      return skinOf(both).length > skinOf(g.members).length + skinOf(chain.members).length;
    });
    if (joined) { for (const id of chain.members) joined.members.add(id); joined.tops.push(chain.top); }
    else garments.push({ members: new Set(chain.members), tops: [chain.top] });
  }
  const chains = [];
  for (const garment of garments) {
    const skin = skinOf(garment.members);
    const onForearm = skin.filter(([gi, v]) => vertexBones(M.Geosets[gi], v).some(id => forearms.has(id))).length;
    // Only cloth the transplant hung on a donor forearm: elsewhere the donor drives it.
    if (skin.length < 20 || onForearm < .25 * skin.length) continue;
    chains.push({ top: garment.tops[0], tops: garment.tops, members: garment.members, skin });
  }
  if (!chains.length) return { vertices: 0, chains: [] };

  // The torso skin both models share: own vertices on the chest and hips (with no
  // cloth weight). When the torso is all blended with limbs, include those blends.
  const clothBones = new Set(chains.flatMap(c => [...c.members]));
  const torsoSkin = strict => {
    const out = [];
    for (const [gi, g] of own.Geosets.entries()) {
      const rg = M.Geosets[gi];
      if (!rg || rg.Vertices.length !== g.Vertices.length) continue;
      for (let v = 0; v < g.Vertices.length / 3; v++) {
        const a = vertexBones(g, v);
        if (!a.length || a.some(id => clothBones.has(id))) continue;
        const host = id => tree.ancestors(id, true).find(j => anatomy.has(j));
        if (strict ? a.every(id => torso.has(host(id))) : a.some(id => torso.has(host(id)))) out.push([gi, v]);
      }
    }
    return out;
  };
  let body = torsoSkin(true);
  if (body.length < 12) body = torsoSkin(false);
  if (body.length < 6) return { vertices: 0, chains: [] };

  const ownStand = Math.max(0, standSequenceIndex(own));
  const skinAt = (model, frame, sequence, refs) => {
    const world = sampleNodeMatrices(model, frame, sequence), cache = new Map();
    const points = refs.map(([gi, v]) => {
      if (!cache.has(gi)) cache.set(gi, skinGeoset(model.Geosets[gi], world));
      return new Vector3().fromArray(cache.get(gi), 3 * v);
    });
    return { world, points };
  };
  const nextId = () => Math.max(...allNodes(M).map(n => n.ObjectId)) + 1;
  let moved = 0;
  const made = [];
  for (const chain of chains) {
    // One new bone per chain bone, carrying the baked motion. Parentless: the
    // keys hold the whole placement, so nothing above can fling the cloth.
    const bones = new Map();
    for (const id of chain.members) {
      const source = own.Nodes[id];
      const bone = { Name: source.Name, ObjectId: nextId(), Parent: null, PivotPoint: new Float32Array(nodePivot(own, source, id)),
        Flags: BONE_FLAG, GeosetId: null, GeosetAnimId: null,
        Translation: { LineType: 1, GlobalSeqId: null, Keys: [] }, Rotation: { LineType: 1, GlobalSeqId: null, Keys: [] }, Scaling: { LineType: 1, GlobalSeqId: null, Keys: [] } };
      M.Bones.push(bone);
      if (Array.isArray(M.Nodes)) M.Nodes[bone.ObjectId] = bone;
      if (Array.isArray(M.PivotPoints)) M.PivotPoints[bone.ObjectId] = bone.PivotPoint;
      bones.set(id, bone);
    }
    for (const [si, sequence] of M.Sequences.entries()) {
      const [start, end] = sequence.Interval;
      const match = sameKindSequence(own, sequence.Name);
      const ownSeq = match ?? ownStand, [os, oe] = own.Sequences[ownSeq].Interval;
      const count = Math.max(2, Math.min(MAX_SAMPLES, Math.round((end - start) / STEP) + 1));
      for (let k = 0; k < count; k++) {
        const phase = k / (count - 1), frame = Math.round(start + phase * (end - start));
        const ownFrame = match == null ? os : Math.round(os + phase * (oe - os));
        const mine = skinAt(own, ownFrame, ownSeq, body), theirs = skinAt(M, frame, si, body);
        const place = similarity(mine.points, theirs.points);
        if (!place) continue;
        for (const [id, bone] of bones) {
          const world = place.clone().multiply(mine.world.get(id) || new Matrix4());
          const t = new Vector3(), q = new Quaternion(), s = new Vector3();
          world.decompose(t, q, s);
          const pivot = new Vector3().fromArray(bone.PivotPoint);
          const shift = pivot.clone().applyMatrix4(world).sub(pivot);
          bone.Translation.Keys.push({ Frame: frame, Vector: new Float32Array(shift.toArray()) });
          bone.Rotation.Keys.push({ Frame: frame, Vector: new Float32Array(q.toArray()) });
          bone.Scaling.Keys.push({ Frame: frame, Vector: new Float32Array(s.toArray()) });
        }
      }
    }
    // Same stored shape as the model's own cloth, bound to the matching new bones.
    for (const [gi, v] of chain.skin) {
      const g = own.Geosets[gi], rg = M.Geosets[gi];
      const ids = vertexBones(g, v).map(id => bones.get(id).ObjectId);
      let group = rg.Groups.findIndex(list => list.length === ids.length && list.every((x, i) => x === ids[i]));
      if (group < 0) {
        if (rg.Groups.length >= 256) continue;
        group = rg.Groups.push(ids) - 1;
        rg.TotalGroupsCount = rg.Groups.reduce((sum, list) => sum + list.length, 0);
      }
      if (rg.SkinWeights?.length) continue;
      rg.VertexGroup[v] = group;
      for (let k = 0; k < 3; k++) rg.Vertices[3 * v + k] = g.Vertices[3 * v + k];
      if (g.Normals?.length === g.Vertices.length) for (let k = 0; k < 3; k++) rg.Normals[3 * v + k] = g.Normals[3 * v + k];
      moved++;
    }
    made.push({ topId: chain.top, tops: chain.tops, top: own.Nodes[chain.top]?.Name, bones: bones.size, vertices: chain.skin.length });
  }
  return { vertices: moved, chains: made };
}
