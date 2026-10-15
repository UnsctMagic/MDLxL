const cache = new WeakMap();
const at = (a, i) => Array.from(a.subarray(i * 3, i * 3 + 3));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => { const length = Math.hypot(...a); return length > 1e-12 && Number.isFinite(length) ? a.map(v => v / length) : null; };

function topology(snapshot) {
  if (cache.has(snapshot)) return cache.get(snapshot);
  const vertices = [], byGeoset = new Map(), faces = [], geometricEdges = new Map();
  for (const g of snapshot.geosets) {
    const records = [], selected = new Set(g.ids), edges = new Map();
    byGeoset.set(g.index, records);
    for (let id = 0; id < g.Vertices.length / 3; id++) {
      const position = at(g.Vertices, id), skin = [...(g.Groups?.[g.VertexGroup?.[id]] || [])].sort((a, b) => a - b).join(',');
      const record = { index: vertices.length, geoset: g.index, id, key: position.join(',') + ':' + skin,
        position, source: unit(at(g.Normals, id)), incident: [], selected: selected.has(id) };
      vertices.push(record); records.push(record);
    }
    for (let offset = 0; offset < g.Faces.length; offset += 3) {
      const corners = Array.from(g.Faces.subarray(offset, offset + 3), id => records[id]);
      const raw = cross(subtract(corners[1].position, corners[0].position), subtract(corners[2].position, corners[0].position));
      const normal = unit(raw); if (!normal) continue;
      const face = { id: faces.length, normal, area: Math.hypot(...raw) }; faces.push(face);
      for (let corner = 0; corner < 3; corner++) {
        const a = corners[corner], b = corners[(corner + 1) % 3], c = corners[(corner + 2) % 3];
        const x = subtract(b.position, a.position), y = subtract(c.position, a.position);
        a.incident.push({ face, angle: Math.atan2(Math.hypot(...cross(x, y)), dot(x, y)) });
        const key = Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id);
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push({ a, b, face });
      }
    }
    for (const list of edges.values()) if (list.length === 1) {
      const edge = list[0], key = [edge.a.key, edge.b.key].sort().join('|');
      if (!geometricEdges.has(key)) geometricEdges.set(key, []);
      geometricEdges.get(key).push(edge);
    }
  }
  const links = [];
  for (const list of geometricEdges.values()) {
    // Matching open edges, rather than nearby positions, identify a real join.
    // Branches, touching points, overlapping copies and back-to-back sheets stay separate.
    if (list.length !== 2) continue;
    const [a, b] = list;
    if (a.a.key !== b.b.key || a.b.key !== b.a.key || dot(a.face.normal, b.face.normal) < -.999999) continue;
    links.push({ left: a, right: b });
  }
  const result = { vertices, byGeoset, faces, links };
  cache.set(snapshot, result); return result;
}

/** Rebuild lighting while retaining each stored vertex and its animation binding. */
export function sdNormalTargets(snapshot, { mode, weighting = 'equal', creaseAngle = 60 } = {}) {
  if (!['sd', 'seams', 'smooth'].includes(mode) || !['equal', 'area', 'angle'].includes(weighting) ||
      !Number.isFinite(creaseAngle) || creaseAngle < 0 || creaseAngle > 180) throw new Error('Invalid SD normal settings.');
  const data = topology(snapshot), parent = data.vertices.map(v => v.index);
  const find = value => { let root = value; while (parent[root] !== root) root = parent[root]; while (parent[value] !== value) { const next = parent[value]; parent[value] = root; value = next; } return root; };
  const join = (a, b) => { const x = find(a.index), y = find(b.index); if (x !== y) parent[y] = x; };
  const sameNormal = (a, b) => a.source && b.source && dot(a.source, b.source) >= Math.cos(Math.PI / 180);
  const limit = Math.cos(creaseAngle * Math.PI / 180);
  for (const { left, right } of data.links) {
    if (mode !== 'sd' && dot(left.face.normal, right.face.normal) < limit - 1e-10) continue;
    for (const [a, b] of [[left.a, right.b], [left.b, right.a]]) {
      if (mode === 'sd' && !sameNormal(a, b)) continue;
      join(a, b);
    }
  }
  const groups = new Map();
  for (const vertex of data.vertices) {
    const root = find(vertex.index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(vertex);
  }
  const directions = new Map(snapshot.geosets.map(g => [g.index, new Float64Array(g.Normals)]));
  const seamIds = new Map(snapshot.geosets.map(g => [g.index, new Set()]));
  let joinedVertices = 0, seamGroups = 0;
  for (const group of groups.values()) {
    const sum = [0, 0, 0], joined = group.length > 1;
    if (joined && group.some(v => v.selected)) seamGroups++;
    if (mode === 'seams' && !joined) continue;
    if (mode === 'seams') {
      for (const vertex of group) if (vertex.source) for (let axis = 0; axis < 3; axis++) sum[axis] += vertex.source[axis];
    } else {
      // Equal unit-face weights reproduce SD authored shading more closely than
      // triangle area weights. Split edges are retained unless explicitly softened.
      for (const vertex of group) for (const incident of vertex.incident) {
        const weight = weighting === 'area' ? incident.face.area : weighting === 'angle' ? incident.angle : 1;
        for (let axis = 0; axis < 3; axis++) sum[axis] += incident.face.normal[axis] * weight;
      }
    }
    const direction = unit(sum) || [0, 0, 0];
    for (const vertex of group) {
      directions.get(vertex.geoset).set(direction, vertex.id * 3);
      if (joined) {
        seamIds.get(vertex.geoset).add(vertex.id);
        if (vertex.selected) joinedVertices++;
      }
    }
  }
  return { directions, seamIds, joinedVertices, seamGroups };
}
