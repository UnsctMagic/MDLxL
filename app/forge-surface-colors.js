export const SURFACE_COLORS = [0xa9b6c1, 0x8caca8, 0xb9aa94, 0x939bb5, 0xb499a6, 0x9eac8b];

// Display-only face shades: adjoining faces, including new inset/extrusion
// walls, get a strong boundary without changing the model's materials.
export function forgeFaceShades(shape) {
  const edges = new Map(), neighbors = new Map(shape.faces.map(face => [face.id, new Set()]));
  for (const face of shape.faces) for (let i = 0; i < face.vertices.length; i++) {
    const a = face.vertices[i], b = face.vertices[(i + 1) % face.vertices.length], key = a < b ? `${a}:${b}` : `${b}:${a}`;
    for (const other of edges.get(key) || []) { neighbors.get(face.id).add(other); neighbors.get(other).add(face.id); }
    edges.set(key, [...(edges.get(key) || []), face.id]);
  }
  const assigned = new Map(), levels = [.42, 1.25, .78, 1.04, .6];
  for (const face of shape.faces) {
    const adjacent = [...neighbors.get(face.id)].map(id => assigned.get(id)).filter(value => value !== undefined);
    const shade = levels.reduce((best, value) => Math.min(...adjacent.map(n => Math.abs(value - n))) > Math.min(...adjacent.map(n => Math.abs(best - n))) ? value : best, levels[face.id % levels.length]);
    assigned.set(face.id, shade);
  }
  return Float32Array.from(shape.faces.flatMap(face => face.triangles.flatMap(() => Array(9).fill(assigned.get(face.id)))));
}
