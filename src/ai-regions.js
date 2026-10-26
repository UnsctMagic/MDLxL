// Job regions are declarations checked against the model, never trust supplied dependencies.
const nodes = ['Bones', 'Helpers', 'Attachments', 'Lights', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'RibbonEmitters', 'ParticleEmitterPopcorns'];
const tables = ['Geosets', 'GeosetAnims', 'Materials', 'Textures', 'TextureAnims', 'Sequences', 'GlobalSequences', 'PivotPoints', 'Cameras', ...nodes];
export const overlaps = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
const pathParts = path => {
  if (typeof path !== 'string' || !/^\/(?:[A-Za-z][A-Za-z0-9]*)(?:\/[^/]+)*$/.test(path)) throw Error('Declare canonical model paths.');
  const parts = path.slice(1).split('/');
  if (parts.some(p => ['__proto__', 'prototype', 'constructor'].includes(p)) || parts[0] === 'Nodes') throw Error('Use canonical node collections, not /Nodes.');
  return parts;
};
const read = (model, path) => pathParts(path).reduce((v, k) => v?.[k], model);
const text = value => JSON.stringify(value, (key, v) => ArrayBuffer.isView(v) ? { type: v.constructor.name, values: Array.from(v) } : typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0)) ? { number: String(v), negativeZero: Object.is(v, -0) } : v);
export function structureSignature(model) {
  return text([model.Version, ...tables.map(key => [key, (model[key] || []).length, nodes.includes(key) ? model[key]?.map(n => [n.ObjectId, n.Parent]) : key === 'Geosets' ? model[key]?.map(g => [g.Vertices?.length, g.Faces?.length, g.Groups, g.VertexGroup, g.SkinWeights, g.MaterialID]) : key === 'Materials' ? model[key]?.map(m => m.Layers?.map(l => [l.TextureID, l.TVertexAnimId])) : null])]);
}
export function structureSummary(model) {
  return {
    geosets: (model.Geosets || []).map((g, i) => ({ path: '/Geosets/' + i, vertices: g.Vertices.length / 3, material: g.MaterialID, bones: [...new Set((g.Groups || []).flat())] })),
    nodes: nodes.flatMap(key => (model[key] || []).map((n, i) => ({ path: '/' + key + '/' + i, id: n.ObjectId, parent: n.Parent, name: n.Name }))),
    materials: (model.Materials || []).map((m, i) => ({ path: '/Materials/' + i, textures: m.Layers?.map(l => l.TextureID) })),
    textures: (model.Textures || []).map((t, i) => ({ path: '/Textures/' + i, image: t.Image })),
    sequences: (model.Sequences || []).map((s, i) => ({ path: '/Sequences/' + i, name: s.Name, interval: Array.from(s.Interval || []) })),
    globalSequences: Array.from(model.GlobalSequences || []),
  };
}
export function declareRegion(model, spec = {}) {
  if (spec.layout && spec.layout !== structureSignature(model)) throw Error('The structure changed since this bird was assigned. Start a new job with the current part numbers.');
  const scope = [...new Set(spec.scope || [])];
  for (const item of spec.nodes || []) {
    if (!nodes.includes(item.collection)) throw Error('Unknown node collection.');
    const index = model[item.collection]?.findIndex(n => n.ObjectId === item.objectId);
    if (!(index >= 0)) throw Error('Declared node ObjectId does not exist.');
    scope.push('/' + item.collection + '/' + index);
  }
  if (!spec.readOnly && !scope.length) throw Error('Each editing bird must declare its model part.');
  let structural = spec.structural === true;
  const dependencies = new Set(spec.protectedPaths || []);
  const add = p => { if (read(model, p) !== undefined) dependencies.add(p); };
  const byId = new Map(nodes.flatMap(key => (model[key] || []).map((n, i) => [n.ObjectId, { node: n, path: '/' + key + '/' + i }])));
  const bone = (id, seen = new Set()) => {
    if (seen.has(id)) return; seen.add(id);
    const item = byId.get(id); if (!item) return;
    add(item.path); add('/PivotPoints/' + id);
    if (item.node.Parent >= 0) bone(item.node.Parent, seen);
  };
  const material = id => {
    const m = model.Materials?.[id]; if (!m) return;
    add('/Materials/' + id);
    for (const layer of m.Layers || []) {
      for (const [key, value] of Object.entries(layer)) if (/TextureID$/.test(key) && Number.isInteger(value)) add('/Textures/' + value);
      if (layer.TVertexAnimId >= 0) add('/TextureAnims/' + layer.TVertexAnimId);
    }
  };
  for (const p of scope) {
    const parts = pathParts(p), value = read(model, p);
    if (!tables.includes(parts[0]) && !['Info', 'Version'].includes(parts[0])) throw Error('Unsupported model region: ' + p);
    if (value === undefined && !structural) throw Error('Model region does not exist: ' + p);
    if (['Sequences', 'GlobalSequences'].includes(parts[0])) structural = true;
    if (parts.length < 2 || !/^\d+$/.test(parts[1])) structural = true;
    if (parts.some(key => ['ObjectId', 'Parent', 'Groups', 'VertexGroup', 'SkinWeights', 'MaterialID', 'GeosetId', 'TextureID', 'TVertexAnimId', 'GlobalSeqId'].includes(key))) structural = true;
    if (parts[0] === 'Geosets' && model.Geosets?.[parts[1]]) {
      const g = model.Geosets[parts[1]];
      material(g.MaterialID);
      for (const id of new Set((g.Groups || []).flat())) bone(id);
      if (g.SkinWeights) for (let i = 0; i < g.SkinWeights.length; i += 8) for (let j = 0; j < 4; j++) if (g.SkinWeights[i + 4 + j]) bone(g.SkinWeights[i + j]);
      (model.GeosetAnims || []).forEach((a, i) => { if (a.GeosetId === Number(parts[1])) add('/GeosetAnims/' + i); });
    } else if (nodes.includes(parts[0])) {
      const n = model[parts[0]]?.[parts[1]]; if (n?.Parent >= 0) bone(n.Parent);
      if (n) add('/PivotPoints/' + n.ObjectId);
    } else if (parts[0] === 'Materials') material(Number(parts[1]));
  }
  const globals = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) return;
    if (value.GlobalSeqId >= 0) add('/GlobalSequences/' + value.GlobalSeqId);
    for (const child of Object.values(value)) globals(child);
  };
  for (const p of [...scope, ...dependencies]) globals(read(model, p));
  for (const p of dependencies) pathParts(p);
  if (spec.globalSequence != null && !spec.animationRanges) throw Error('Declare the global-sequence time range.');
  if (spec.globalSequence != null && (!Number.isInteger(spec.globalSequence) || !(model.GlobalSequences?.[spec.globalSequence] > 0))) throw Error('Declare an existing global sequence.');
  const ranges = spec.animationRanges;
  if (ranges && (!Array.isArray(ranges) || !ranges.length || ranges.some(r => !Array.isArray(r) || r.length !== 2 || r.some(n => !Number.isFinite(n)) || r[0] > r[1]))) throw Error('Declare ordered animation ranges.');
  return { scope, layout: structureSignature(model), protectedPaths: spec.protectedPaths || [], dependencies: [...dependencies], structural, readOnly: spec.readOnly === true, ...(ranges ? { animationRanges: ranges } : {}), ...(spec.globalSequence != null ? { globalSequence: spec.globalSequence } : {}) };
}
export function regionsConflict(a, b) {
  if (a.readOnly || b.readOnly) return false;
  if (a.structural || b.structural) return true;
  return a.scope.some(p => [...b.scope, ...b.dependencies].some(q => overlaps(p, q))) || b.scope.some(p => a.dependencies.some(q => overlaps(p, q)));
}
export const regionSignature = (model, region) => region.readOnly ? '' : text([structureSignature(model), [...new Set([...region.scope, ...region.dependencies])].map(p => [p, read(model, p)])]);
export function checkRegionEdit(before, after, region, changes) {
  if (region.readOnly) throw Error('This bird is read-only.');
  const reordered = tables.some(key => {
    const a=before[key]||[],b=after[key]||[];
    if (!a.length || a.length!==b.length || !a[0] || typeof a[0]!=='object') return false;
    const positions=new Map(a.map((v,i)=>[text(v),i]));
    return b.some((v,i)=>text(a[i])!==text(v) && positions.has(text(v)) && positions.get(text(v))!==i);
  });
  if (!region.structural && reordered) throw Error('Reordering model records is structural and needs an exclusive job.');
  if (!region.structural && structureSignature(before) !== structureSignature(after)) throw Error('This is a structural edit. Start an exclusive job before changing shared tables, IDs or bindings.');
  for (const c of changes) {
    const p = '/' + c.path.join('/');
    if ((region.protectedPaths || []).some(s => overlaps(p, s)) && text(read(before, p)) !== text(read(after, p))) throw Error('Bird edit changes a protected path: ' + p);
    const bounds = c.path[0] === 'Info' && ['MinimumExtent', 'MaximumExtent', 'BoundsRadius'].includes(c.path[1]) && region.scope.some(s => s.startsWith('/Geosets/'));
    if (!bounds && !region.scope.some(s => p === s || p.startsWith(s + '/'))) throw Error('Bird edit exceeds its declared region: ' + p);
    if (region.dependencies.some(s => overlaps(p, s)) && !region.scope.some(s => p === s || p.startsWith(s + '/'))) throw Error('Bird edit changes a dependency: ' + p);
  }
  if (region.animationRanges) {
    const outside = frame => !region.animationRanges.some(([a,b]) => frame >= a && frame <= b);
    const walk = (a,b) => {
      if (a?.Keys || b?.Keys) {
        if (region.globalSequence != null && (a?.GlobalSeqId !== region.globalSequence || b?.GlobalSeqId !== region.globalSequence)) {
          if (text(a) !== text(b)) throw Error('Bird edit changes another global sequence.');
        }
        if (text(a?.Keys?.filter(k => outside(k.Frame))) !== text(b?.Keys?.filter(k => outside(k.Frame))) || a?.LineType !== b?.LineType || a?.GlobalSeqId !== b?.GlobalSeqId) throw Error('Bird edit exceeds its animation range.');
        return;
      }
      if (!a || !b || typeof a !== 'object' || ArrayBuffer.isView(a)) return;
      for (const k of new Set([...Object.keys(a),...Object.keys(b)])) walk(a[k],b[k]);
    };
    for (const p of region.scope) walk(read(before,p),read(after,p));
  }
}
// Verification sees the original owned parts and the latest unowned parts. Actual
// ownership is enforced for every commit above, not inferred from this projection.
export function regionBefore(current, before, region) {
  const result = structuredClone(current);
  for (const p of region.scope) {
    const parts=pathParts(p), key=parts.pop(); let to=result, from=before;
    for (const k of parts) { to=to?.[k]; from=from?.[k]; }
    if (to && from) to[key]=structuredClone(from[key]);
  }
  return result;
}
