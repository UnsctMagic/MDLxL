import { BoxGeometry, PlaneGeometry, CircleGeometry, SphereGeometry, IcosahedronGeometry, CylinderGeometry, TorusGeometry, BufferGeometry, Float32BufferAttribute, Euler, Quaternion } from 'three';
import { thumperGeometry } from './forge-thumper.js';

export const FORGE_SHAPES = ['Plane', 'Cube', 'Circle', 'UV Sphere', 'Icosphere', 'Cylinder', 'Cone', 'Torus', 'Grid', 'ThumperXL', 'Quad Sphere'];
export const FLAT_FORGE_SHAPES = ['Plane', 'Circle', 'Grid'];
export const PRIMITIVE_DEFAULTS = { shape: 'Cube', complexity: 1, width: 100, height: 100, depth: 100, thickness: 0, tube: 20, position: [0, 0, 0], rotation: [0, 0, 0] };

function minimalCylinder(cone) {
  const geometry = new CylinderGeometry(cone ? 0 : .5, .5, 1, 3, 1, true), p = Array.from(geometry.attributes.position.array), n = Array.from(geometry.attributes.normal.array), uv = Array.from(geometry.attributes.uv.array), faces = Array.from(geometry.index.array);
  for (const sign of cone ? [-1] : [-1, 1]) {
    const start = p.length / 3;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; p.push(Math.sin(a) * .5, sign * .5, Math.cos(a) * .5); n.push(0, sign, 0); uv.push(Math.sin(a) * .5 + .5, Math.cos(a) * .5 + .5); }
    faces.push(start, start + (sign > 0 ? 1 : 2), start + (sign > 0 ? 2 : 1));
  }
  geometry.setAttribute('position', new Float32BufferAttribute(p, 3)); geometry.setAttribute('normal', new Float32BufferAttribute(n, 3)); geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(faces); return geometry;
}

export const PRIMITIVE_TEXTURE = 'ReplaceableTextures\\CommandButtons\\BTNTemp.blp';
// The UV triangle contains the complete unit square. With Warcraft's clamped
// sampler, each triangle shows the whole portrait once (including its frame).
export const TRIANGLE_ICON_UV = [-.5, 0, 1.5, 0, .5, 2];
function fullIconPerTriangle(source) {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.setAttribute('uv', new Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count / 3 }, () => TRIANGLE_ICON_UV).flat(), 2));
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
  const flat = FLAT_FORGE_SHAPES.includes(shape), cells = [1, 2, 4, 8][complexity - 1], sides = (shape === 'Cone' ? [3, 4, 6, 8] : [3, 8, 12, 20])[complexity - 1];
  const longest = Math.max(width, height, ...(flat ? [] : [depth]));
  const divisions = size => Math.max(1, Math.min(cells, Math.round(cells * size / longest / 2) * 2));
  let geometry;
  if (shape === 'Plane' || shape === 'Grid') {
    const x = shape === 'Plane' ? 1 : divisions(width), y = shape === 'Plane' ? 1 : divisions(height);
    geometry = thickness > 0 ? new BoxGeometry(1, 1, 1, x, y, 1) : new PlaneGeometry(1, 1, x, y);
  } else if (shape === 'Circle') {
    geometry = thickness > 0 ? complexity === 1 ? minimalCylinder(false) : new CylinderGeometry(.5, .5, 1, sides, 1) : new CircleGeometry(.5, sides);
    if (!thickness && complexity === 1) geometry.setIndex([1, 2, 3]);
    if (thickness > 0) geometry.rotateX(Math.PI / 2);
  } else if (shape === 'UV Sphere') geometry = new SphereGeometry(.5, complexity === 1 ? 4 : sides, complexity === 1 ? 2 : sides / 2);
  else if (shape === 'Icosphere') geometry = new IcosahedronGeometry(.5, complexity - 1);
  else if (shape === 'ThumperXL') geometry = thumperGeometry();
  else if (shape === 'Cylinder' || shape === 'Cone') {
    geometry = complexity === 1 ? minimalCylinder(shape === 'Cone') : new CylinderGeometry(shape === 'Cone' ? 0 : .5, .5, 1, sides, shape === 'Cone' ? 1 : divisions(height));
  } else if (shape === 'Torus') geometry = new TorusGeometry(.5 - tube / 200, tube / 200, complexity === 1 ? 3 : complexity + 4, complexity === 1 ? 6 : sides);
  else {
    geometry = new BoxGeometry(1, 1, 1, divisions(width), divisions(height), divisions(depth));
    if (shape === 'Quad Sphere') {
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), length = Math.hypot(x, y, z); p.setXYZ(i, x / length * .5, y / length * .5, z / length * .5); n.setXYZ(i, x / length, y / length, z / length); }
    }
  }
  if (shape !== 'ThumperXL') geometry = fullIconPerTriangle(geometry);
  geometry.scale(width, height, flat ? thickness || 1 : depth);
  geometry.applyQuaternion(new Quaternion().setFromEuler(new Euler(...rotation.map(n => n * Math.PI / 180), 'XYZ')));
  geometry.translate(...position);
  const g = { Vertices: geometry.attributes.position.array.slice(), Normals: geometry.attributes.normal.array.slice(), TVertices: [geometry.attributes.uv.array.slice()], Faces: geometry.index ? new Uint16Array(geometry.index.array) : Uint16Array.from({ length: geometry.attributes.position.count }, (_, i) => i) };
  geometry.dispose();
  return { geosets: [g], vertexCount: g.Vertices.length / 3, triangleCount: g.Faces.length / 3 };
}
