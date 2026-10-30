// Generated test data only; the committed model remains unchanged.
import { openDocument } from '../../src/editor-document.js';
import { allNodes, sampleTrack, TRANSFORM_DEFAULTS, isGlobalTrack } from '../../src/animation.js';
import { nodeIndex } from '../../src/node-hierarchy.js';
import { vertexBones } from '../../src/part-bones.js';

export function motionFixture(bytes, { excursion = false } = {}) {
  const doc = openDocument(bytes, 'motion-source.mdx'), model = doc.model;
  const nodes = allNodes(model), hierarchy = nodeIndex(model), influence = new Map();
  for (const geoset of model.Geosets) for (let v = 0; v < geoset.Vertices.length / 3; v++)
    for (const id of vertexBones(geoset, v)) { const root = hierarchy.root(id); influence.set(root, (influence.get(root) || 0) + 1); }
  const root = hierarchy.byId.get([...influence].sort((a, b) => b[1] - a[1])[0][0]);
  const attack = model.Sequences.findIndex(s => /^attack\b/i.test(s.Name));
  if (excursion) doc.apply('Fixture: pre-existing sideways excursion', ['Bones', 'Helpers'], () => {
    const original = root.Translation, keys = [], amplitude = (model.Info.MaximumExtent[2] - model.Info.MinimumExtent[2]) * .2;
    model.Sequences.forEach((sequence, si) => {
      const [start, end] = sequence.Interval;
      const times = new Set([start, end, ...(original?.Keys || []).filter(k => k.Frame >= start && k.Frame <= end).map(k => k.Frame)]);
      if (si === attack) times.add(Math.round((start + end) / 2));
      for (const Frame of [...times].sort((a, b) => a - b)) {
        const Vector = new Float32Array(sampleTrack(original, Frame, { interval: sequence.Interval, fallback: TRANSFORM_DEFAULTS.Translation }));
        if (si === attack) Vector[0] += amplitude * (1 - Math.abs(2 * (Frame - start) / (end - start) - 1));
        keys.push({ Frame, Vector });
      }
    });
    root.Translation = { LineType: 1, GlobalSeqId: null, Keys: keys };
  });
  const referenceBytes = doc.serialize('mdx');
  doc.apply('Fixture: redundant sampled motion', ['Bones', 'Helpers', 'GeosetAnims'], () => {
    const selected = [];
    for (const property of ['Translation', 'Rotation']) {
      const eligible = nodes.filter(node => node[property]?.LineType === 1 && !isGlobalTrack(node[property], model) && node[property].Keys.length > 1);
      for (const node of eligible.slice(0, 2)) selected.push({ node, property });
    }
    selected.forEach(({ node, property }, index) => {
      const original = node[property], keys = [], step = 1 + index % 3;
      for (const sequence of model.Sequences) {
        const [start, end] = sequence.Interval, local = original.Keys.filter(k => k.Frame >= start && k.Frame <= end);
        const times = new Set(local.map(k => k.Frame));
        // Constant/empty domains retain their own keys and fallback behaviour.
        if (local.length > 1 && local.some(k => k.Vector.some((v, i) => v !== local[0].Vector[i]))) {
          for (let f = start; f < end; f += step) times.add(f);
          times.add(end);
        }
        for (const Frame of [...times].sort((a, b) => a - b)) keys.push({ Frame, Vector: new Float32Array(sampleTrack(original, Frame, {
          interval: sequence.Interval, globalSequences: model.GlobalSequences, fallback: TRANSFORM_DEFAULTS[property], quaternion: property === 'Rotation',
        })) });
      }
      // Preserve pre-existing unassigned keys; add one intentionally redundant
      // record beyond every clip, where it cannot change local playback.
      for (const key of original.Keys) if (!model.Sequences.some(s => key.Frame >= s.Interval[0] && key.Frame <= s.Interval[1])) keys.push(structuredClone(key));
      const last = Math.max(...model.Sequences.map(s => s.Interval[1]));
      keys.push({ Frame: last + 100 + index, Vector: keys.at(-1).Vector.slice() });
      if (property === 'Rotation') for (const key of keys) key.InTan = key.OutTan = key.Vector.slice();
      node[property] = { LineType: property === 'Rotation' ? 2 : 1, GlobalSeqId: null, Keys: keys.sort((a, b) => a.Frame - b.Frame) };
    });
    const animation = model.GeosetAnims.find(g => g.Flags & 2 && !g.Color?.Keys);
    if (animation) animation.Color = { LineType: 0, GlobalSeqId: null, Keys: model.Sequences.map(s => ({ Frame: s.Interval[0], Vector: new Float32Array(animation.Color) })) };
  });
  return { bytes: doc.serialize('mdx'), referenceBytes, attack, root: root.ObjectId };
}
