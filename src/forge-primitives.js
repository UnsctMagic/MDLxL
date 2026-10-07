import { BoxGeometry, PlaneGeometry, CircleGeometry, SphereGeometry, IcosahedronGeometry, CylinderGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, Euler, Quaternion } from 'three';
import { MONKEY_LEVELS } from './forge-monkey.js';

export const FORGE_SHAPES = ['Plane', 'Cube', 'Circle', 'UV Sphere', 'Icosphere', 'Cylinder', 'Cone', 'Torus', 'Grid', 'Monkey', 'Quad Sphere'];
export const FLAT_FORGE_SHAPES = ['Plane', 'Circle', 'Grid'];
export const PRIMITIVE_DEFAULTS = { shape: 'Cube', complexity: 2, width: 100, height: 100, depth: 100, thickness: 0, tube: 20, position: [0, 0, 0], rotation: [0, 0, 0] };

function boxUVs(geometry) {
  const uv = geometry.attributes.uv;
  geometry.groups.forEach((group, face) => {
    const ids = new Set(Array.from(geometry.index.array.slice(group.start, group.start + group.count)));
    for (const id of ids) uv.setXY(id, (uv.getX(id) + face % 3) / 3, (uv.getY(id) + Math.floor(face / 3)) / 2);
  });
}

function cylinderUVs(geometry) {
  const uv = geometry.attributes.uv;
  geometry.groups.forEach(group => {
    const ids = new Set(Array.from(geometry.index.array.slice(group.start, group.start + group.count)));
    for (const id of ids) {
      const u = uv.getX(id), v = uv.getY(id);
      uv.setXY(id, group.materialIndex === 0 ? u : (u + group.materialIndex - 1) / 2, group.materialIndex === 0 ? .35 + v * .65 : v * .3);
    }
  });
}

function monkeyGeometry(complexity) {
  const level = MONKEY_LEVELS[complexity - 1], base = new BufferGeometry();
  base.setAttribute('position', new Float32BufferAttribute(level.vertices, 3)); base.setIndex(level.faces); base.computeVertexNormals();
  const geometry = base.toNonIndexed(); base.dispose();
  // Six directional charts keep every triangle usable, without spherical poles.
  const p = geometry.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) {
    const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
    const ab = b.map((v, axis) => v - a[axis]), ac = c.map((v, axis) => v - a[axis]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const axis = normal.reduce((best, v, axis) => Math.abs(v) > Math.abs(normal[best]) ? axis : best, 0), chart = axis * 2 + (normal[axis] < 0 ? 1 : 0);
    for (let k = 0; k < 3; k++) {
      const point = [p.getX(i + k), p.getY(i + k), p.getZ(i + k)], axes = [0, 1, 2].filter(a => a !== axis);
      uv.set([(point[axes[0]] + .5 + chart % 3) / 3, (point[axes[1]] + .5 + Math.floor(chart / 3)) / 2], (i + k) * 2);
    }
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** Blender's mesh starters with four modest complexity levels. Separate UV and
 * normal seam vertices match Warcraft's single-index mesh. Flat starters can
 * become closed solids; thickness 0 retains a single front surface.
 */
export function buildForgePrimitive(options = {}) {
  const { shape, complexity, width, height, depth, thickness, tube, position, rotation } = { ...PRIMITIVE_DEFAULTS, ...options };
  if (!FORGE_SHAPES.includes(shape)) throw Error('Choose a shape.');
  if (!Number.isInteger(complexity) || complexity < 1 || complexity > 4) throw Error('Complexity must be between 1 and 4.');
  if ([width, height, depth].some(n => !Number.isFinite(n) || n < .01 || n > 100000)) throw Error('Dimensions must be between 0.01 and 100000.');
  if (!Number.isFinite(thickness) || thickness < 0 || thickness > 100000) throw Error('Thickness must be between 0 and 100000.');
  if (!Number.isFinite(tube) || tube < 5 || tube > 45) throw Error('Tube thickness must be between 5% and 45%.');
  for (const vector of [position, rotation]) if (!Array.isArray(vector) || vector.length !== 3 || vector.some(n => !Number.isFinite(n) || Math.abs(n) > 100000)) throw Error('Placement must contain three finite coordinates.');
  const flat = FLAT_FORGE_SHAPES.includes(shape), cells = complexity * 2, sides = shape === 'Cone' ? 4 + complexity : 4 + complexity * 4;
  const longest = Math.max(width, height, ...(flat ? [] : [depth]));
  const divisions = size => Math.max(1, Math.min(cells, Math.round(cells * size / longest / 2) * 2));
  let geometry;
  if (shape === 'Plane' || shape === 'Grid') {
    const x = shape === 'Plane' ? 1 : divisions(width), y = shape === 'Plane' ? 1 : divisions(height);
    geometry = thickness > 0 ? new BoxGeometry(1, 1, 1, x, y, 1) : new PlaneGeometry(1, 1, x, y);
    if (thickness > 0) boxUVs(geometry);
  } else if (shape === 'Circle') {
    geometry = thickness > 0 ? new CylinderGeometry(.5, .5, 1, sides, 1) : new CircleGeometry(.5, sides);
    if (thickness > 0) { cylinderUVs(geometry); geometry.rotateX(Math.PI / 2); }
  } else if (shape === 'UV Sphere') geometry = new SphereGeometry(.5, sides, sides / 2);
  else if (shape === 'Icosphere') geometry = new IcosahedronGeometry(.5, complexity - 1);
  else if (shape === 'Monkey') geometry = monkeyGeometry(complexity);
  else if (shape === 'Cylinder' || shape === 'Cone') {
    geometry = new CylinderGeometry(shape === 'Cone' ? 0 : .5, .5, 1, sides, shape === 'Cone' ? 1 : divisions(height)); cylinderUVs(geometry);
  } else if (shape === 'Torus') geometry = new TorusGeometry(.5 - tube / 200, tube / 200, complexity + 4, sides);
  else {
    geometry = new BoxGeometry(1, 1, 1, divisions(width), divisions(height), divisions(depth));
    if (shape === 'Quad Sphere') {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), length = Math.hypot(x, y, z); p.setXYZ(i, x / length * .5, y / length * .5, z / length * .5); n.setXYZ(i, x / length, y / length, z / length); }
    }
    boxUVs(geometry);
  }
  geometry.scale(width, height, flat ? thickness || 1 : depth);
  geometry.applyQuaternion(new Quaternion().setFromEuler(new Euler(...rotation.map(n => n * Math.PI / 180), 'XYZ')));
  geometry.translate(...position);
  const g = { Vertices: geometry.attributes.position.array.slice(), Normals: geometry.attributes.normal.array.slice(), TVertices: [geometry.attributes.uv.array.slice()], Faces: geometry.index ? new Uint16Array(geometry.index.array) : Uint16Array.from({ length: geometry.attributes.position.count }, (_, i) => i) };
  geometry.dispose();
  return { geosets: [g], vertexCount: g.Vertices.length / 3, triangleCount: g.Faces.length / 3 };
}
