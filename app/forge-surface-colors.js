import { createForgeShape, forgeShapeEdges, forgeSelectionVertices, forgeShapeMesh } from '../src/forge-shape-editing.js';

export const SURFACE_COLORS = [0xa9b6c1, 0x8caca8, 0xb9aa94, 0x939bb5, 0xb499a6, 0x9eac8b];

// Consistent object colors and light describe form; topology and selection
// are separate overlays, matching the solid mesh-editing convention.
export function forgeModelingOverlay(shape, mesh, selected = [], mode = 'Shape') {
  const first = new Map(); mesh.vertexIds.forEach((id, index) => { if (!first.has(id)) first.set(id, index); });
  const chosen = new Set(forgeSelectionVertices(shape, selected, mode)), faces = new Set(selected);
  const selectedBoundaries = new Set();
  for (const face of shape.faces) if (faces.has(face.id)) for (let i = 0; i < face.vertices.length; i++) {
    const a = face.vertices[i], b = face.vertices[(i + 1) % face.vertices.length]; selectedBoundaries.add(a < b ? `${a}:${b}` : `${b}:${a}`);
  }
  const edgeIndices = [], selectedEdgeIndices = [];
  for (const [key, [a, b]] of forgeShapeEdges(shape)) {
    edgeIndices.push(first.get(a), first.get(b));
    const picked = mode === 'Edges' ? faces.has(key) : mode === 'Faces' ? selectedBoundaries.has(key) : chosen.has(a) && chosen.has(b);
    if (picked) selectedEdgeIndices.push(first.get(a), first.get(b));
  }
  const selectedFaceIndices = [];
  if (mode === 'Faces') mesh.faceIds.forEach((id, triangle) => { if (faces.has(id)) selectedFaceIndices.push(triangle * 3, triangle * 3 + 1, triangle * 3 + 2); });
  return { edgeIndices, selectedEdgeIndices, selectedFaceIndices, mode };
}

export function geosetModelingOverlay(geoset, selection = []) {
  const source = { ...geoset, Normals: geoset.Normals || new Float32Array(geoset.Vertices.length), TVertices: geoset.TVertices?.length ? geoset.TVertices : [new Float32Array(geoset.Vertices.length / 3 * 2)] };
  const shape = createForgeShape({ geosets: [source] }), mesh = forgeShapeMesh(shape);
  const positions = new Map();
  for (let i = 0; i < geoset.Vertices.length; i += 3) { const key = Array.from(geoset.Vertices.slice(i, i + 3)).join(','); if (!positions.has(key)) positions.set(key, i / 3); }
  const sourceIndex = mesh.vertexIds.map(id => positions.get(shape.vertices[id].join(',')));
  const chosen = new Set(selection.map(id => Array.from(geoset.Vertices.slice(id * 3, id * 3 + 3)).join(',')));
  const ids = shape.vertices.flatMap((p, id) => chosen.has(p.join(',')) ? [id] : []);
  const overlay = forgeModelingOverlay(shape, mesh, ids, 'Vertices');
  return { ...overlay, edgeIndices: overlay.edgeIndices.map(id => sourceIndex[id]), selectedEdgeIndices: overlay.selectedEdgeIndices.map(id => sourceIndex[id]) };
}
