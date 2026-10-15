const json = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
const defaults = { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] };
const same = (a, b) => a?.length === b?.length && Array.from(a).every((v, i) => v === b[i]);
const local = track => track.GlobalSeqId == null || track.GlobalSeqId === -1 || track.GlobalSeqId === 0xffffffff;

/** Explicit exact-data proposal, separate from adjustable curve reduction.
 * A local constant span clamps to the same first value after its other keys
 * are removed. Only axis-unit identity rotations qualify: non-unit quaternion
 * interpolation can differ between native renderers even for equal values. */
export function constantTransformProposals(model, entries) {
  const out = [], sequences = model.Sequences;
  if (!sequences.length) return out;
  for (const { track, path } of entries) {
    const [collection, index, property] = path, fallback = defaults[property];
    if (path.length !== 3 || !['Bones', 'Helpers'].includes(collection) || !fallback || !local(track) || ![0, 1].includes(track.LineType) || !track.Keys.length) continue;
    if (track.Keys.some((k, i, keys) => !Number.isInteger(k.Frame) || k.Frame < 0 || i && k.Frame <= keys[i - 1].Frame || k.Vector?.length !== fallback.length || !Array.from(k.Vector).every(Number.isFinite) || k.InTan || k.OutTan)) continue;
    // Duplicate/overlapping or malformed domains need a separate timeline decision.
    if (sequences.some((s, i) => !s.Interval || s.Interval.length !== 2 || !Array.from(s.Interval).every(Number.isInteger) || s.Interval[0] >= s.Interval[1] || sequences.some((other, j) => i !== j && other.Interval?.[0] <= s.Interval[1] && other.Interval?.[1] >= s.Interval[0]))) continue;
    const domains = [], frames = [];
    for (const [sequence, s] of sequences.entries()) {
      const keys = track.Keys.filter(k => k.Frame >= s.Interval[0] && k.Frame <= s.Interval[1]);
      if (!keys.length || keys[0].Frame !== s.Interval[0] || !keys.every(k => same(k.Vector, keys[0].Vector)) || property === 'Rotation' && !same(keys[0].Vector, fallback)) continue;
      const redundant = keys.slice(1).filter(k => k.Frame !== 0);
      if (redundant.length) { domains.push(sequence); frames.push(...redundant.map(k => k.Frame)); }
    }
    const active = key => sequences.some(s => key.Frame >= s.Interval[0] && key.Frame <= s.Interval[1]);
    // Setup keys and out-of-domain authored poses are retained, even if default.
    // Let unused-local-key repair finish first if removing its records could
    // turn this partial plan into whole-track deletion on the next approval.
    if (!track.Keys.some(k => k.Frame === 0) && track.Keys.some(k => !active(k)) && track.Keys.filter(active).every(k => same(k.Vector, fallback))) continue;
    const drop = track.Keys.every(k => k.Frame !== 0 && active(k) && same(k.Vector, fallback));
    if (drop) { frames.splice(0, frames.length, ...track.Keys.map(k => k.Frame)); domains.splice(0, domains.length, ...sequences.keys()); }
    if (!frames.length) continue;
    const sequence = domains[0], owner = model[collection][index];
    out.push({ id: `constantTransform:${path.join('.')}`, kind: 'constantTransform', path, frames, domains, drop,
      signature: json([track, sequences.map(s => s.Interval)]), sequence, frame: sequences[sequence].Interval[0],
      label: `${owner.Name || collection + ' ' + index}: ${frames.length} constant ${property} key${frames.length === 1 ? "" : "s"}`,
      detail: drop ? 'Remove a transform track whose authored values exactly match the channel default. Animation poses stay the same.' : 'Keep the first key of each exactly constant animation span. Preserve every moving span, setup key and out-of-animation pose.' });
  }
  return out;
}

export function applyConstantTransform(model, fix) {
  const [collection, index, property] = fix.path, owner = model[collection][index];
  if (fix.drop) delete owner[property];
  else { const removed = new Set(fix.frames); owner[property].Keys = owner[property].Keys.filter(k => !removed.has(k.Frame)); }
}
