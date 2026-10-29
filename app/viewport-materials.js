import * as THREE from 'three';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { decodeBLP, getBLPImageData } from 'war3-model';
import { decodeBlp2 } from '../src/blp2.js';
import { decodeDds } from '../src/dds.js';
import { configureEditorTexture } from './viewport-quality.js';
import { configureWideWirePattern } from '../src/wire-pattern.js';

const asBuffer = bytes => bytes instanceof ArrayBuffer ? bytes : bytes?.buffer?.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
// Decoding BLP/TGA/DDS and browser images dominates repeated preview startup.
// Assets are immutable within a session, so retain CPU pixels/images while
// each viewport still creates and owns its own disposable GPU texture.
const decodedRasterCache = new WeakMap(), decodedImageCache = new WeakMap();

export async function textureFromAsset(asset, textureInfo = {}, { fallbackDecoder } = {}) {
  const buffer = asBuffer(asset?.bytes);
  let name = String(asset?.name || textureInfo.Image || '').toLowerCase();
  if (buffer && buffer.byteLength >= 4 && new DataView(buffer).getUint32(0,true) === 0x20534444) name = name.replace(/\.[^.]+$/, '.dds');
  let texture;
  if (buffer && name.endsWith('.blp')) {
    let pixels = decodedRasterCache.get(asset);
    if (!pixels) {
      try {
        const bytes = new Uint8Array(buffer);
        pixels = bytes[0] === 66 && bytes[1] === 76 && bytes[2] === 80 && bytes[3] === 50 ? decodeBlp2(buffer) : getBLPImageData(decodeBLP(buffer), 0);
      } catch (cause) {
        if (!fallbackDecoder) throw cause;
        pixels = await fallbackDecoder(buffer);
      }
      decodedRasterCache.set(asset, pixels);
    }
    texture = new THREE.DataTexture(new Uint8Array(pixels.data), pixels.width, pixels.height, THREE.RGBAFormat);
    texture.needsUpdate = true;
  } else if (buffer && name.endsWith('.tga')) {
    let pixels = decodedRasterCache.get(asset); if (!pixels) { pixels = new TGALoader().parse(buffer); decodedRasterCache.set(asset, pixels); }
    texture = new THREE.DataTexture(pixels.data, pixels.width, pixels.height, THREE.RGBAFormat);
    texture.needsUpdate = true;
  } else if (buffer && name.endsWith('.dds')) {
    let pixels = decodedRasterCache.get(asset); if (!pixels) { pixels = decodeDds(buffer); decodedRasterCache.set(asset, pixels); }
    texture = new THREE.DataTexture(new Uint8Array(pixels.data), pixels.width, pixels.height, THREE.RGBAFormat);
    texture.needsUpdate = true;
  } else {
    let promise = asset && decodedImageCache.get(asset);
    if (!promise) {
      let url = asset?.url, temporary = false;
      if (!url && buffer) { url = URL.createObjectURL(new Blob([buffer])); temporary = true; }
      if (!url) throw new Error('Texture has no image data');
      promise = new THREE.TextureLoader().loadAsync(url).then(loaded => { const image = loaded.image; loaded.dispose(); return image; }).finally(() => { if (temporary) URL.revokeObjectURL(url); });
      if (asset) decodedImageCache.set(asset, promise);
    }
    try { texture = new THREE.Texture(await promise); texture.needsUpdate = true; }
    catch (cause) { if (asset) decodedImageCache.delete(asset); throw cause; }
  }
  // Warcraft UV origin is at the top of the image. Keep its V coordinates intact.
  texture.flipY = false;
  // Match the classic Warcraft sampler: filter encoded texels, then decode
  // exactly once in the mesh shader. This is independent of silhouette AA.
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = textureInfo.Flags & 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = textureInfo.Flags & 2 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  return configureEditorTexture(texture);
}

export function layerMaterial(layer, shaded = true, { extendShader, cacheKey } = {}) {
  const shading = layer.Shading || 0, filter = layer.FilterMode || 0;
  const material = !shaded || shading & 1 ? new THREE.MeshBasicMaterial() : new THREE.MeshPhongMaterial({ shininess: 9, specular: 0x1c242d });
  material.userData.geosetTint = { value: new THREE.Vector3(1, 1, 1) };
  material.onBeforeCompile = shader => {
    shader.uniforms.uMdlxlGeosetTint = material.userData.geosetTint;
    // Warcraft GeosetRGB multiplies the encoded final color. Applying it to
    // Three's linear material color makes intermediate authored RGB too bright.
    shader.fragmentShader = 'uniform vec3 uMdlxlGeosetTint;\n' + shader.fragmentShader.replace('#include <colorspace_fragment>', '#include <colorspace_fragment>\ngl_FragColor.rgb *= uMdlxlGeosetTint;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\nvec4 sampledDiffuseColor = sRGBTransferEOTF(texture2D(map, vMapUv));\ndiffuseColor *= sampledDiffuseColor;\n#endif');
    if (material.isMeshPhongMaterial) {
      // A zero authored normal must stay finite before interpolation. Fixing
      // normalize(0) afterwards is too late: it can poison the whole triangle.
      shader.vertexShader = shader.vertexShader.replace('#include <normal_vertex>', THREE.ShaderChunk.normal_vertex.replace(
        'vNormal = normalize( transformedNormal );',
        'vNormal = dot(transformedNormal, transformedNormal) > 0.0 ? normalize(transformedNormal) : vec3(0.0);'));
      // Compute derivatives before alpha/clipping discards or divergent branches.
      // Only undefined lighting directions use the face; authored buffers stay intact.
      shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() {\nvec3 mdlxlFaceNormal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));')
        .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace(
          'vec3 normal = normalize( vNormal );',
          'vec3 normal = dot(vNormal, vNormal) > 1.e-12 ? normalize(vNormal) : mdlxlFaceNormal * faceDirection;'));
    }
    extendShader?.(shader);
  };
  if (cacheKey !== undefined) material.customProgramCacheKey = () => cacheKey;
  material.side = shading & 16 ? THREE.DoubleSide : THREE.FrontSide;
  material.depthTest = !(shading & 64);
  material.depthWrite = !(shading & 128) && filter < 2;
  material.transparent = filter >= 2;
  material.alphaTest = filter === 1 ? 0.75 : 0;
  if (filter === 3) {
    material.blending = THREE.CustomBlending; material.blendSrc = THREE.OneFactor; material.blendDst = THREE.OneFactor;
  } else if (filter === 4) material.blending = THREE.AdditiveBlending;
  else if (filter === 5 || filter === 6) {
    material.blending = THREE.CustomBlending; material.blendSrc = THREE.DstColorFactor; material.blendDst = filter === 6 ? THREE.SrcColorFactor : THREE.ZeroFactor;
  }
  material.userData.layerBlending = material.blending;
  return material;
}

export function updateWideWireGeometry(entry) {
  if (!entry?.wireGeometry || !entry.edgeIndices) return;
  const source = entry.geometry.attributes.position.array, positions = new Float32Array(Math.max(6, entry.edgeIndices.length * 3));
  for (let edge = 0; edge < entry.edgeIndices.length; edge++) {
    const vertex = entry.edgeIndices[edge], target = edge * 3, from = vertex * 3;
    positions[target] = source[from]; positions[target + 1] = source[from + 1]; positions[target + 2] = source[from + 2];
  }
  entry.wireGeometry.setPositions(positions); entry.wire.computeLineDistances();
  if (entry.selectedWire) updateWideWireGeometry({ geometry: entry.geometry, edgeIndices: entry.selectedEdgeIndices || [], wireGeometry: entry.selectedWire.geometry, wire: entry.selectedWire });
}

export function configureWideLine(material, appearance, width, height, hiddenOpacity = 1) {
  material.color.set(appearance.color); material.linewidth = appearance.thickness;
  material.opacity = appearance.opacity * hiddenOpacity; material.resolution.set(Math.max(1, width), Math.max(1, height));
  const dashed = appearance.style !== 'solid'; if (material.dashed !== dashed) { material.dashed = dashed; material.needsUpdate = true; }
  configureWideWirePattern(material, appearance);
}
