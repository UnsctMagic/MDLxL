import { BoxGeometry, PlaneGeometry, CircleGeometry, CylinderGeometry, TorusGeometry, Euler, Quaternion } from 'three';

export const FORGE_SHAPES = ['Plane', 'Box', 'Sphere', 'Disc', 'Cylinder', 'Cone', 'Torus'];
export const PRIMITIVE_DEFAULTS = { shape: 'Box', complexity: 2, width: 100, height: 100, depth: 100, tube: 20, position: [0, 0, 0], rotation: [0, 0, 0] };

/** Small, regular grids: even the highest setting stays below 800 triangles.
 * UV and normal seams remain separate vertices for Warcraft's single-index mesh.
 */
export function buildForgePrimitive(options = {}) {
  const { shape, complexity, width, height, depth, tube, position, rotation } = { ...PRIMITIVE_DEFAULTS, ...options };
  if (!FORGE_SHAPES.includes(shape)) throw Error('Choose a shape.');
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 4) throw Error('Complexity must be between 1 and 4.');
  if ([width, height, depth].some(n => !Number.isFinite(n) || n < .01 || n > 100000)) throw Error('Dimensions must be between 0.01 and 100000.');
  if (!Number.isFinite(tube) || tube < 5 || tube > 45) throw Error('Tube size must be between 5% and 45%.');
  for (const vector of [position, rotation]) if (!Array.isArray(vector) || vector.length !== 3 || vector.some(n => !Number.isFinite(n) || Math.abs(n) > 100000)) throw Error('Placement must contain three finite coordinates.');
  const cells = complexity * 2, sides = shape === 'Cone' ? 4 + complexity : 4 + complexity * 4;
  let geometry;
  if (shape === 'Plane') geometry = new PlaneGeometry(1, 1, cells, cells);
  else if (shape === 'Disc') geometry = new CircleGeometry(.5, sides);
  else if (shape === 'Cylinder' || shape === 'Cone') geometry = new CylinderGeometry(shape === 'Cone' ? 0 : .5, .5, 1, sides, shape === 'Cone' ? 1 : cells);
  else if (shape === 'Torus') geometry = new TorusGeometry(.5 - tube / 200, tube / 200, complexity + 4, sides);
  else {
    geometry = new BoxGeometry(1, 1, 1, cells, cells, cells);
    if (shape === 'Sphere') {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), length = Math.hypot(x, y, z); p.setXYZ(i, x / length * .5, y / length * .5, z / length * .5); n.setXYZ(i, x / length, y / length, z / length); }
    }
    // Six separate, regularly gridded UV islands; no pole fans on the sphere.
    const uv = geometry.attributes.uv;
    geometry.groups.forEach((group, face) => { const ids = new Set(Array.from(geometry.index.array.slice(group.start, group.start + group.count))); for (const id of ids) uv.setXY(id, (uv.getX(id) + face % 3) / 3, (uv.getY(id) + Math.floor(face / 3)) / 2); });
  }
  if (shape === 'Cylinder' || shape === 'Cone') {
    // Cylinder sides above two cap islands, without overlapping UV charts.
    const uv = geometry.attributes.uv;
    geometry.groups.forEach(group => { const ids = new Set(Array.from(geometry.index.array.slice(group.start, group.start + group.count))); for (const id of ids) { const u = uv.getX(id), v = uv.getY(id); uv.setXY(id, group.materialIndex === 0 ? u : (u + group.materialIndex - 1) / 2, group.materialIndex === 0 ? .35 + v * .65 : v * .3); } });
  }
  geometry.scale(width, height, depth);
  geometry.applyQuaternion(new Quaternion().setFromEuler(new Euler(...rotation.map(n => n * Math.PI / 180), 'XYZ')));
  geometry.translate(...position);
  const g = { Vertices: geometry.attributes.position.array.slice(), Normals: geometry.attributes.normal.array.slice(), TVertices: [geometry.attributes.uv.array.slice()], Faces: new Uint16Array(geometry.index.array) };
  geometry.dispose();
  return { geosets: [g], vertexCount: g.Vertices.length / 3, triangleCount: g.Faces.length / 3 };
}
