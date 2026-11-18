// A compact fingerprint of a model per part (geosets, nodes, animations,
// materials, textures), so the AI service can tell the next job what the owner
// changed by hand since the AI's last delivery. Small short hashes, no model data.

const FIELDS = {
  geoset: { v: 'vertex positions', n: 'normals', uv: 'UVs', f: 'faces', s: 'skinning', m: 'material', a: 'colour or visibility' },
  node: { t: 'movement keys', r: 'rotation keys', s: 'scaling keys', p: 'pivot', h: 'parent', o: 'other settings' },
};

// FNV-1a over a stable walk of the value; typed arrays by their bytes.
// Keys starting with "_" are editor bookkeeping, not the owner's data.
function hash(value) {
  let h = 0x811c9dc5;
  const byte = b => { h ^= b; h = Math.imul(h, 0x01000193); };
  const text = s => { for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); byte(c & 255); byte(c >> 8); } };
  const open = new WeakSet();
  const walk = v => {
    if (v === undefined) return text('u');
    if (v === null || typeof v !== 'object') return text(typeof v + String(v) + ';');
    if (open.has(v)) return text('^');
    if (ArrayBuffer.isView(v)) {
      const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      text('#' + bytes.length);
      for (let i = 0; i < bytes.length; i++) byte(bytes[i]);
      return;
    }
    open.add(v);
    if (Array.isArray(v)) { text('[' + v.length); for (const item of v) walk(item); text(']'); }
    else {
      text('{');
      for (const key of Object.keys(v).filter(k => !k.startsWith('_')).sort()) { text(key + ':'); walk(v[key]); }
      text('}');
    }
    open.delete(v);
  };
  walk(value);
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}
const pick = (object, keys) => Object.fromEntries(keys.map(key => [key, object?.[key]]));
const rest = (object, skip) => Object.fromEntries(Object.entries(object || {}).filter(([key]) => !skip.includes(key)));
// Absent data (a bone without scaling keys) adds nothing, which keeps the digest small.
const parts = fields => Object.entries(fields).filter(([, value]) => value !== undefined).map(([key, value]) => key + ':' + hash(value)).join(',');

// One short string per part, keyed by the names the owner sees.
export function modelDigest(model) {
  const digest = {};
  (model?.Geosets || []).forEach((geoset, i) => {
    const anims = (model.GeosetAnims || []).filter(anim => anim?.GeosetId === i);
    digest['geoset ' + (i + 1)] = parts({
      v: geoset?.Vertices, n: geoset?.Normals, uv: geoset?.TVertices, f: geoset?.Faces,
      s: pick(geoset, ['VertexGroup', 'Groups', 'SkinWeights']), m: geoset?.MaterialID, a: anims,
    });
  });
  const nodes = (model?.Nodes || []).filter(Boolean);
  const seen = new Map();
  for (const node of nodes) {
    let name = 'node ' + (node.Name || node.ObjectId);
    seen.set(name, (seen.get(name) || 0) + 1);
    if (seen.get(name) > 1) name += ' #' + seen.get(name);
    digest[name] = parts({
      t: node.Translation, r: node.Rotation, s: node.Scaling, p: node.PivotPoint, h: node.Parent,
      o: rest(node, ['Translation', 'Rotation', 'Scaling', 'PivotPoint', 'Parent', 'Name', 'ObjectId']),
    });
  }
  (model?.Sequences || []).forEach((sequence, i) => { digest['animation ' + (sequence?.Name || i)] = hash(sequence); });
  (model?.GlobalSequences || []).forEach((value, i) => { digest['global animation ' + i] = hash(value); });
  (model?.Materials || []).forEach((material, i) => { digest['material ' + i] = hash(material); });
  (model?.Textures || []).forEach((texture, i) => { digest['texture ' + i + (texture?.Image ? ' (' + texture.Image + ')' : '')] = hash(texture); });
  return digest;
}

// Plain lines naming what changed between two digests, at most `limit` lines.
export function describeDigestChanges(before, after, limit = 20) {
  if (!before || !after) return [];
  const lines = [];
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[name], b = after[name];
    if (a === b) continue;
    if (a === undefined) { lines.push(name + ': added'); continue; }
    if (b === undefined) { lines.push(name + ': removed'); continue; }
    const kind = FIELDS[name.split(' ')[0]];
    if (!kind || !a.includes(':') || !b.includes(':')) { lines.push(name + ': changed'); continue; }
    const split = value => Object.fromEntries(value.split(',').filter(Boolean).map(item => item.split(':')));
    const left = split(a), right = split(b);
    const what = Object.keys(kind).filter(key => left[key] !== right[key]).map(key => kind[key]);
    lines.push(name + ': ' + (what.join(', ') || 'changed'));
  }
  return lines.length > limit ? [...lines.slice(0, limit), `and ${lines.length - limit} more parts`] : lines;
}
