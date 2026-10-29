import { createGLProgram, uploadTexture } from './gl-utils.js';

/** Draw the cosmetic background into the destination before WC3 materials.
 * Additive/modulate layers must see the actual background in their blend target.
 */
export function createGLPreviewBackground(gl) {
  const program = createGLProgram(gl, `#version 300 es
out vec2 uv;
void main(){ vec2 positions[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));vec2 p=positions[gl_VertexID];uv=(p+1.)*.5;gl_Position=vec4(p,0.,1.); }`, `#version 300 es
precision mediump float;in vec2 uv;uniform sampler2D background;out vec4 color;
void main(){ color=vec4(texture(background,uv).rgb,1.); }`);
  const texture = gl.createTexture(), sampler = gl.getUniformLocation(program, 'background');
  let canvas, dirty = true;
  return {
    update(source) { canvas = source; dirty = true; },
    draw() {
      if (!canvas) return;
      const previous = { program: gl.getParameter(gl.CURRENT_PROGRAM), active: gl.getParameter(gl.ACTIVE_TEXTURE), blend: gl.isEnabled(gl.BLEND), depth: gl.isEnabled(gl.DEPTH_TEST), cull: gl.isEnabled(gl.CULL_FACE), depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) };
      gl.activeTexture(gl.TEXTURE0); const priorTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (dirty) {
        uploadTexture(gl, texture, canvas, { filter: 'nearest', flipY: true, premultiplyAlpha: false }); dirty = false;
      }
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.depthMask(false);
      gl.useProgram(program); gl.uniform1i(sampler, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(previous.program); gl.bindTexture(gl.TEXTURE_2D, priorTexture); gl.activeTexture(previous.active); gl.depthMask(previous.depthMask);
      for (const [name, enabled] of [[gl.BLEND, previous.blend], [gl.DEPTH_TEST, previous.depth], [gl.CULL_FACE, previous.cull]]) enabled ? gl.enable(name) : gl.disable(name);
    },
    dispose() { gl.deleteTexture(texture); gl.deleteProgram(program); },
  };
}
