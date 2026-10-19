// Windows falls back to WARP ("Microsoft Basic Render Driver") or SwiftShader
// when no usable graphics card is present. Both draw every pixel on the CPU.
const SOFTWARE_RENDERER = /swiftshader|basic render driver|llvmpipe|softpipe|software rasterizer/i;

export const isSoftwareRenderer = name => SOFTWARE_RENDERER.test(String(name || ''));

let detected;
/** Names the WebGL renderer once per window; the probe context is released at once. */
export function detectRenderer(createCanvas = () => document.createElement('canvas')) {
  if (detected) return detected;
  let name = '';
  try {
    const gl = createCanvas().getContext('webgl2') || createCanvas().getContext('webgl');
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {}
  return detected = Object.freeze({ name, software: isSoftwareRenderer(name) });
}
