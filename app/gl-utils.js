// Small raw-WebGL helpers shared by the preview overlays that draw outside Three.

/** Compile and link a program. Shaders are released once linked; the program keeps what it needs. */
export function createGLProgram(gl, vertexSource, fragmentSource) {
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message); }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const message = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(message); }
  return program;
}

/** Bind `texture` on unit 0 and upload an RGBA image with clamped edges. filter is 'linear' (default) or
 * 'nearest'. The context's UNPACK flip (and premultiply, when given) setting is restored afterwards. */
export function uploadTexture(gl, texture, image, { filter = 'linear', flipY = false, premultiplyAlpha } = {}) {
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
  const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  const premultiply = premultiplyAlpha === undefined ? undefined : gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
  if (premultiply !== undefined) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  const mode = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mode); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mode);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
  if (premultiply !== undefined) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
}

/** Capture the GL state a preview draw may disturb; call the returned function to put it back. */
export function preserveGLState(gl) {
  const names = ['CURRENT_PROGRAM','VERTEX_ARRAY_BINDING','ARRAY_BUFFER_BINDING','ACTIVE_TEXTURE','DEPTH_WRITEMASK','DEPTH_FUNC','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA','POLYGON_OFFSET_FACTOR','POLYGON_OFFSET_UNITS','CULL_FACE_MODE','FRONT_FACE'];
  const state = Object.fromEntries(names.map(name => [name,gl.getParameter(gl[name])]));
  const enabled = [gl.BLEND,gl.DEPTH_TEST,gl.CULL_FACE,gl.POLYGON_OFFSET_FILL].map(name => [name,gl.isEnabled(name)]);
  const textures = [];
  for (let i = 0; i < Math.min(8,gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)); i++) { gl.activeTexture(gl.TEXTURE0+i); textures.push(gl.getParameter(gl.TEXTURE_BINDING_2D)); }
  gl.activeTexture(state.ACTIVE_TEXTURE);
  return () => {
    textures.forEach((texture,i) => { gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D,texture); }); gl.activeTexture(state.ACTIVE_TEXTURE);
    gl.useProgram(state.CURRENT_PROGRAM); gl.bindVertexArray(state.VERTEX_ARRAY_BINDING); gl.bindBuffer(gl.ARRAY_BUFFER,state.ARRAY_BUFFER_BINDING);
    gl.depthMask(state.DEPTH_WRITEMASK); gl.depthFunc(state.DEPTH_FUNC);
    gl.blendFuncSeparate(state.BLEND_SRC_RGB,state.BLEND_DST_RGB,state.BLEND_SRC_ALPHA,state.BLEND_DST_ALPHA); gl.blendEquationSeparate(state.BLEND_EQUATION_RGB,state.BLEND_EQUATION_ALPHA);
    gl.polygonOffset(state.POLYGON_OFFSET_FACTOR,state.POLYGON_OFFSET_UNITS); gl.cullFace(state.CULL_FACE_MODE); gl.frontFace(state.FRONT_FACE);
    for (const [name,value] of enabled) value ? gl.enable(name) : gl.disable(name);
  };
}
