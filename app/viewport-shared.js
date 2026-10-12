import * as THREE from 'three';

export function makeChecker() {
  const data = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const value = ((x >> 2) + (y >> 2)) % 2 ? 135 : 95, i = (y * 16 + x) * 4;
    data.set([value, value + 5, value + 10, 255], i);
  }
  const texture = new THREE.DataTexture(data, 16, 16);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter; texture.needsUpdate = true;
  return texture;
}

export function makeTeamGlow() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2;
    const intensity = Math.round(Math.sin(Math.max(0, Math.min(1, 1 - distance * 1.4))) * 255);
    pixels.set([intensity, intensity, intensity, 255], (y * size + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size); texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter; return texture;
}

export function clearGroup(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  group.clear(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

export function uniqueEdges(faces) {
  const seen = new Set(), edges = [];
  for (let i = 0; i < faces.length; i += 3) for (let corner = 0; corner < 3; corner++) {
    const a = Number(faces[i + corner]), b = Number(faces[i + (corner + 1) % 3]);
    const first = Math.min(a, b), last = Math.max(a, b), key = `${first}:${last}`;
    if (first === last || seen.has(key)) continue;
    seen.add(key); edges.push(first, last);
  }
  return edges;
}

export function pointMarkerTexture(style) {
  if (style === 'square') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.beginPath();
  if (style === 'circle') context.arc(16, 16, 14, 0, Math.PI * 2);
  else { context.moveTo(16, 1); context.lineTo(31, 16); context.lineTo(16, 31); context.lineTo(1, 16); context.closePath(); }
  context.fill(); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.NoColorSpace; return texture;
}

export function configurePointMaterial(material, appearance, texture) {
  material.color.set(appearance.color); material.size = appearance.size;
  const transparent = !!texture; if (material.map !== texture || material.transparent !== transparent) { material.map = texture; material.transparent = transparent; material.needsUpdate = true; }
  material.alphaTest = texture ? .45 : 0;
}

export function emitSelection(p, next) {
  if (p.onSelectionChange) p.onSelectionChange(next);
  else p.onSelectVertices?.(next[p.selectedGeoset] || []);
}
