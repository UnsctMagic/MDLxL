import { allNodes, sampleNodeMatrices } from './animation.js';

// A classic matrix group averages its bones equally. Some edits fake uneven
// weights by repeating a bone in the group and scaling a partner bone to zero
// (and others up) per animation. MDLxL's average still looks right, but
// Warcraft III has stretched such vertices into long spikes. Only a bone that
// collapses to a point counts: a one-axis flatten (an eyelid blink) or a whole
// part hidden at zero scale is ordinary and keeps every member collapsed.
const COLLAPSED = 1e-3, LIVE = 1e-2;
const list = names => names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
const json = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const reach = m => { const e = m.elements; return Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])); };

export function skinCollapseProposals(model) {
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n]));
  // Without a point-collapse scale key no matrix can collapse. Skip sampling.
  const zeroKey = n => n.Scaling?.Keys?.some(k => Math.max(...Array.from(k.Vector, Math.abs)) < COLLAPSED);
  if (!nodes.some(zeroKey)) return [];
  const groups = [];
  model.Geosets.forEach((g, geoset) => (g.Groups || []).forEach((group, index) => {
    const members = [...new Set(group)], vertices = Array.from(g.VertexGroup || []).filter(v => v === index).length;
    if (members.length > 1 && vertices) groups.push({ geoset, index, group: Array.from(group), members, vertices });
  }));
  if (!groups.length) return [];
  const chain = id => { const ids = []; for (let n = byId.get(id); n && !ids.includes(n.ObjectId); n = byId.get(n.Parent)) ids.push(n.ObjectId); return ids; };
  const scaled = [...new Set(groups.flatMap(g => g.members.flatMap(chain)))].map(id => byId.get(id)).filter(n => n?.Scaling?.Keys);
  const hits = new Map();
  model.Sequences.forEach((sequence, si) => {
    const [lo, hi] = sequence.Interval, frames = new Set([lo, hi]);
    for (let k = 1; k < 8; k++) frames.add(Math.round(lo + (hi - lo) * k / 8));
    for (const n of scaled) for (const key of n.Scaling.Keys) if (key.Frame >= lo && key.Frame <= hi) frames.add(key.Frame);
    for (const frame of [...frames].sort((a, b) => a - b)) {
      const matrices = sampleNodeMatrices(model, frame, si);
      for (const g of groups) {
        const sizes = g.members.map(id => matrices.has(id) ? reach(matrices.get(id)) : 1);
        if (!sizes.some(s => s < COLLAPSED) || !sizes.some(s => s >= LIVE)) continue;
        const hit = hits.get(g.geoset) || { groups: new Map(), sequences: new Map() };
        hits.set(g.geoset, hit); hit.groups.set(g.index, g);
        if (!hit.sequences.has(si)) hit.sequences.set(si, frame);
        for (const [i, id] of g.members.entries()) if (sizes[i] < COLLAPSED) (hit.collapsed ??= new Set()).add(id);
      }
    }
  });
  const name = id => byId.get(id)?.Name || `Node ${id}`;
  return [...hits].map(([geoset, hit]) => {
    const flagged = [...hit.groups.values()], vertices = flagged.reduce((n, g) => n + g.vertices, 0);
    const [[sequence, frame]] = hit.sequences, repeated = [...new Set(flagged.flatMap(g => g.group.filter((id, i) => g.group.indexOf(id) !== i)))];
    const count = hit.sequences.size, plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
    return {
      id: `skinCollapse:${geoset}`, kind: 'skinCollapse', geoset, groups: flagged.map(g => g.index), sequence, frame, inspectionOnly: true,
      signature: json([model.Sequences, model.Geosets[geoset].Groups, ...[...new Set(flagged.flatMap(g => g.members.flatMap(chain)))].map(id => [id, byId.get(id)?.Parent, byId.get(id)?.Scaling])]),
      label: `Geoset ${geoset + 1}: ${plural(vertices, 'vertex', 'vertices')} share a bone scaled to zero — may break in Warcraft III`,
      detail: `${plural(vertices, 'vertex', 'vertices')} average several bones, and in ${plural(count, 'animation')} ${list([...hit.collapsed].map(name))} ${hit.collapsed.size === 1 ? 'shrinks' : 'shrink'} to nothing while the others do not. ` +
        `${repeated.length ? `The group also repeats ${list(repeated.map(name))} to weight it. ` : ''}` +
        'MDLxL can show this correctly, but Warcraft III has stretched such vertices into long spikes. Bind them to ordinary bones instead, for example in a separate geoset shown per animation.',
    };
  });
}
