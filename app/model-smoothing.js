import * as THREE from 'three';
import { createGLProgram, preserveGLState } from './gl-utils.js';

// Layer 1 contains model surfaces (and the wire-mode depth prepass). Editor
// wires, dots, grid and raw GL rig markers keep the single-sample canvas.
export const MODEL_LAYER = 1;

export function createModelSmoothing(renderer) {
  let target, base;
  const size = new THREE.Vector2(), viewport = new THREE.Vector4();
  const copyScene = new THREE.Scene(), copyCamera = new THREE.Camera();
  const material = new THREE.ShaderMaterial({
    uniforms: { color: { value: null }, depth: { value: null } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `uniform sampler2D color; uniform sampler2D depth; varying vec2 vUv;
      void main(){ gl_FragColor=texture2D(color,vUv); gl_FragDepth=texture2D(depth,vUv).x;
      #include <colorspace_fragment>
      }`,
    depthFunc: THREE.AlwaysDepth, blending: THREE.NoBlending,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; copyScene.add(quad);
  return {
    get samples() { return target?.samples || 0; },
    render(scene, camera, enabled, backgrounds = []) {
      const mask = camera.layers.mask, background = scene.background, autoClear = renderer.autoClear;
      try {
        // Rasterize grid/platform once without MSAA, including their depth.
        for (const group of backgrounds) group.traverse(object => object.layers.set(2));
        camera.layers.enable(MODEL_LAYER); camera.layers.enable(2);
        if (!enabled) { renderer.render(scene, camera); return; }
        renderer.getViewport(viewport);
        const ratio = renderer.getPixelRatio();
        size.set(Math.max(1, Math.floor(viewport.z * ratio)), Math.max(1, Math.floor(viewport.w * ratio)));
        if (!target) {
          target = new THREE.WebGLRenderTarget(size.x, size.y, {
            samples: 4, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
            depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
          });
          base = new THREE.WebGLRenderTarget(size.x, size.y, {
            minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
            depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType),
          });
        }
        target.setSize(size.x, size.y); base.setSize(size.x, size.y);
        renderer.setRenderTarget(base); camera.layers.set(2);
        renderer.render(scene, camera);
        material.uniforms.color.value = base.texture; material.uniforms.depth.value = base.depthTexture;
        renderer.setRenderTarget(target); renderer.render(copyScene, copyCamera);
        // Seed exact grid pixels before the model: translucent/modulate layers
        // must blend OVER the grid, not have grid lines painted on top of them.
        renderer.autoClear = false; scene.background = null; camera.layers.set(MODEL_LAYER);
        renderer.render(scene, camera);
        // Resolves color AND depth. Copying depth keeps hidden wires and bone
        // previews on the same side of the model as in Classic (59cf9ce7).
        renderer.setRenderTarget(null); renderer.autoClear = autoClear;
        material.uniforms.color.value = target.texture; material.uniforms.depth.value = target.depthTexture;
        renderer.render(copyScene, copyCamera);
        renderer.autoClear = false; scene.background = null; camera.layers.set(0);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(null); camera.layers.mask = mask;
        scene.background = background; renderer.autoClear = autoClear;
      }
    },
    dispose() { base?.dispose(); target?.dispose(); quad.geometry.dispose(); material.dispose(); },
  };
}

/** The native renderer has no Three render target. Resolve its model pass into
 * the non-multisampled default framebuffer before drawing any editor helpers. */
export function createNativeModelSmoothing(gl) {
  let framebuffer, color, depth, base, baseColor, baseDepth, program, vao, width = 0, height = 0, active = false;
  const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
  function disposeTargets() {
    if (framebuffer) {
      gl.deleteFramebuffer(framebuffer); gl.deleteRenderbuffer(color); gl.deleteRenderbuffer(depth);
      gl.deleteFramebuffer(base); gl.deleteTexture(baseColor); gl.deleteTexture(baseDepth);
    }
    framebuffer = color = depth = base = baseColor = baseDepth = null; width = height = 0;
  }
  function copyPixels(destination) {
      if (!active) return;
      if (!program) {
        program = createGLProgram(gl, `#version 300 es
          out vec2 uv; void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`,
          `#version 300 es
          precision highp float; uniform sampler2D color; uniform sampler2D depth; in vec2 uv; out vec4 pixel;
          void main(){pixel=texture(color,uv);gl_FragDepth=texture(depth,uv).x;}`);
        vao = gl.createVertexArray();
      }
      const restore = preserveGLState(gl);
      try {
        gl.bindFramebuffer(gl.FRAMEBUFFER, destination); gl.bindVertexArray(vao); gl.useProgram(program);
        gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.ALWAYS); gl.depthMask(true);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, baseColor); gl.uniform1i(gl.getUniformLocation(program, 'color'), 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, baseDepth); gl.uniform1i(gl.getUniformLocation(program, 'depth'), 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } finally { restore(); }
  }
  return {
    prepare(enabled, w, h) {
      active = enabled && samples > 0;
      if (!active) return;
      if (width !== w || height !== h) {
        disposeTargets(); width = w; height = h;
        framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        color = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, color);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, color);
        depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        base = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, base);
        const texture = (internal, format, type, attachment) => {
          const value = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, value);
          gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
          for (const key of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, key, gl.NEAREST);
          for (const key of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, value, 0); return value;
        };
        baseColor = texture(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.COLOR_ATTACHMENT0);
        baseDepth = texture(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.DEPTH_ATTACHMENT);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, base);
    },
    beginModel() { copyPixels(framebuffer); },
    resolve() {
      if (!active) return;
      // Resolve into our matching depth format, then write depth with a shader.
      // A browser default buffer can use a different internal depth format.
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, base);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      copyPixels(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null); active = false;
    },
    dispose() { disposeTargets(); if (program) { gl.deleteProgram(program); gl.deleteVertexArray(vao); } },
  };
}
