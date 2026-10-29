import { Color, LinearFilter, LinearMipmapLinearFilter, NearestFilter, Vector3 } from 'three';

// The native SD shader consumes encoded colors; Three materials consume linear.
export const nativeTeamColor = hex => { const value = new Color(hex).getHex(); return [value >> 16 & 255, value >> 8 & 255, value & 255].map(channel => channel / 255); };
/** Default player colour for the native (game-style) preview renderer. */
export const DEFAULT_TEAM_COLOR = '#ed3333';
/** Brightness (0..1) of the team-glow replaceable texture (ReplaceableId 2) at pixel (x, y) of a width x height picture. */
export const teamGlowFactor = (x, y, width, height = width) => Math.sin(Math.max(0, Math.min(1, 1 - Math.hypot((x + .5) / width - .5, (y + .5) / height - .5) * 2 * 1.4)));
/** RGBA pixels of a team-colour replaceable picture: flat colour for id 1, colour x glow for id 2. rgb is 0..1 per channel. */
export function teamColorPixels(id, rgb, size) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const factor = id === 2 ? teamGlowFactor(x, y, size) : 1, offset = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) data[offset + k] = Math.round(255 * rgb[k] * factor);
    data[offset + 3] = 255;
  }
  return data;
}
// Below 1 the viewport draws fewer pixels than the screen and is scaled up;
// software rendering cost follows the pixel count.
export const viewportPixelRatio = (graphics, device = 1, lowPower = false) => graphics.pixelRatio < 1 ? graphics.pixelRatio : lowPower ? 1 : device || 1;

export function configureEditorTexture(texture, anisotropy = 1) {
  // DataTexture defaults to nearest filtering and no generated mipmaps.
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.max(1, Math.min(16, anisotropy));
  texture.needsUpdate = true;
  return texture;
}

/** Live paint can show exact texel edges or the existing soft, filtered view.
 * This is preview sampling only: source pixels and exported mipmaps are intact. */
export function configurePaintTexture(texture, smoothing = true) {
  texture.magFilter = texture.minFilter = smoothing ? LinearFilter : NearestFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  return texture;
}

export function cameraLeftLight(camera, target, radius) {
  const direction = new Vector3(-.65, .55, 1).normalize().applyQuaternion(camera.quaternion);
  return { direction, position: target.clone().addScaledVector(direction, Math.max(1, radius) * 5) };
}

/** WebGL2 generates the complete mip chain for decoded BLP/TGA/DDS top levels. */
export function improveNativeTexture(gl, native, path, options = {}) {
  const texture = native.rendererData?.textures?.[path];
  if (!texture) return;
  const previous = gl.getParameter(gl.TEXTURE_BINDING_2D);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.textureFiltering === 'bilinear' ? gl.LINEAR_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR);
  const ext = native.anisotropicExt;
  if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(options.anisotropy || 16, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  gl.bindTexture(gl.TEXTURE_2D, previous);
}

export function captureDimensions(width, height, maxDimension, limit = 8192) {
  const edge = Number(maxDimension);
  const scale = Number.isFinite(edge) && edge > 0 ? Math.min(edge, limit) / Math.max(width, height) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
