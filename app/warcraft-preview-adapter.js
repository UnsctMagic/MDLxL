import { portraitFragmentDeclarations, portraitFragmentLight, portraitLightDeclarations, portraitLightCalculation } from './portrait-lighting.js';
import { sampleTrack, sampleGeosetAnimation } from '../src/animation.js';
import { previewLighting } from '../src/preview-lighting.js';

/** war3-model 4.0.1 omits geoset RGB and fractional alpha in its mesh shader. */
export function patchWarcraftMeshFragmentShader(source) {
  if (!source.includes('uniform mat3 uTVertexAnim;') || !source.includes('uniform float uWireframe;')) return source;
  const output = source.includes('out vec4 FragColor;') ? 'FragColor' : source.includes('gl_FragColor') ? 'gl_FragColor' : null;
  if (!output) return source;
  const hd = source.includes('uniform vec3 uLightPos;');
  const legacyLighting = hd
    ? `    if (uMdlxlLighting < .5) ${output}.rgb = pow(baseColor.rgb, vec3(1. / gamma));\n`
    : `    if (uMdlxlLighting > .5) ${output}.rgb *= .55 + .45 * max(0., dot(normalize(vNormal), normalize(uMdlxlLightDirection)));\n`;
  // Bone influence tints the Surface grey: pale amber for parts that move with
  // the selected bones, strong amber for the parts those bones move directly.
  const lighting = `    float mdlxlLayerAlpha = ${output}.a;\n    vec3 mdlxlSurfaceColor = vec3(.663, .714, .757);\n    if (uMdlxlInfluenceOn > .5) mdlxlSurfaceColor = mix(mix(mdlxlSurfaceColor, vec3(.98, .8, .5), clamp(vMdlxlInfluence.y, 0., 1.)), vec3(.94, .55, .12), clamp(vMdlxlInfluence.x, 0., 1.));\n    if (uMdlxlSurface > .5) { ${output}.rgb = mdlxlSurfaceColor; ${hd ? 'baseColor.rgb = mdlxlDecodeSRGB(mdlxlSurfaceColor);' : ''} }\n    ${hd ? '' : `if (uMdlxlPortrait > .5) { if (uMdlxlLighting > .5) ${output}.rgb *= ${portraitFragmentLight}; } else `}if (uMdlxlLegacy > .5) {\n${legacyLighting}    } else if (uMdlxlLighting > .5) {
        vec3 inspectionNormal = ${hd ? 'normal' : 'vNormal'};
        inspectionNormal = dot(inspectionNormal, inspectionNormal) > 1.e-12 ? normalize(inspectionNormal) : normalize(uMdlxlViewDirection);
        ${hd ? '// HD normal mapping already accounts for face orientation.' : 'if (!gl_FrontFacing) inspectionNormal = -inspectionNormal;'}
        vec3 inspectionLight = normalize(uMdlxlLightDirection);
        float inspectionDiffuse = max(0., dot(inspectionNormal, inspectionLight));
        vec3 inspectionHalf = normalize(inspectionLight + normalize(uMdlxlViewDirection));
        float inspectionSpecular = inspectionDiffuse > 0. ? pow(max(0., dot(inspectionNormal, inspectionHalf)), max(.0001, uMdlxlPower)) : 0.;
        vec3 inspectionBase = ${hd ? 'baseColor.rgb' : `mdlxlDecodeSRGB(max(${output}.rgb, vec3(0.)))`};
        ${output}.rgb = mdlxlEncodeSRGB(max(inspectionBase * (uMdlxlAmbient + uMdlxlDiffuse * inspectionDiffuse) + uMdlxlSpecular * inspectionSpecular, vec3(0.)));
    }${hd ? ` else { ${output}.rgb = pow(baseColor.rgb, vec3(1. / gamma)); }` : ''}\n`;
  // This renderer uses WebGL2, but upstream SD shaders still use GLSL 100.
  // Upgrade both stages so derivatives are available without a WebGL1 extension.
  const header = source.startsWith('#version 300 es') ? '' : '#version 300 es\nprecision highp float;\nout vec4 mdlxlFragmentColor;\n#define gl_FragColor mdlxlFragmentColor\n';
  if (header) source = source.replace(/\bvarying\b/g, 'in').replace(/\btexture2D\b/g, 'texture').replace(/\btextureCube\b/g, 'texture');
  return header + source.replace('precision mediump float;', 'precision highp float;')
    .replace(/void main\s*\(/, `${hd ? '' : portraitFragmentDeclarations}void main(`)
    .replace(/void main\s*\(/, `vec3 mdlxlDecodeSRGB(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(vec3(.04045), c)); }\nvec3 mdlxlEncodeSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(vec3(.0031308), c)); }\nvoid main(`)
    .replace('uniform float uWireframe;', 'uniform float uWireframe;\nuniform vec4 uMdlvisGeosetTint;\nuniform float uMdlxlLighting;\nuniform vec3 uMdlxlLightDirection;\nuniform float uMdlxlCoverage;\nuniform float uMdlxlSurface;\nuniform vec3 uMdlxlAmbient;\nuniform vec3 uMdlxlDiffuse;\nuniform vec3 uMdlxlSpecular;\nuniform float uMdlxlPower;\nuniform float uMdlxlLegacy;\nuniform vec3 uMdlxlViewDirection;\nuniform float uMdlxlInfluenceOn;\nuniform float uMdlxlGhostAlpha;\nuniform float uMdlxlInfluencePart;\nin vec2 vMdlxlInfluence;')
    .replace(/if \((?:gl_FragColor|FragColor)\[3\] < uDiscardAlphaLevel\) \{\s*discard;\s*}/, `if (uDiscardAlphaLevel > 0. && uMdlxlCoverage > .5) {\n        float edge = max(fwidth(${output}.a), .001);\n        ${output}.a = smoothstep(uDiscardAlphaLevel - edge, uDiscardAlphaLevel + edge, ${output}.a);\n        if (${output}.a <= 0.) discard;\n    } else if (${output}.a < uDiscardAlphaLevel) { discard; }`)
    .replace(/}\s*$/, `${lighting}    ${output} *= uMdlvisGeosetTint;\n    // Ghost passes keep the unaffected half of each face, hot passes the rest,\n    // so the two layers meet without gaps. Blended layers keep their cut-outs.\n    if (uMdlxlInfluenceOn > .5 && ((vMdlxlInfluence.y >= .5) != (uMdlxlInfluencePart > .5) || uMdlxlInfluenceOn > 1.5 && mdlxlLayerAlpha < .1)) discard;\n    // 2 keeps a blended layer's own cut-out; opaque layers may carry junk alpha.\n    if (uMdlxlInfluenceOn > .5) ${output}.a = uMdlvisGeosetTint.a * (uMdlxlInfluenceOn > 1.5 ? mdlxlLayerAlpha : 1.) * mix(uMdlxlGhostAlpha, .82, clamp(vMdlxlInfluence.y, 0., 1.));\n}\n`);
}

/** The upstream SD vertex shader skins positions but leaves normals in bind pose. */
export function patchWarcraftMeshVertexShader(source) {
  const mesh = source.includes('aNormal') && source.includes('uMVMatrix') && source.includes('vTextureCoord');
  if (mesh && !source.startsWith('#version 300 es')) source = '#version 300 es\n' + source.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out');
  // Every mesh fragment shader reads vMdlxlInfluence, so every mesh vertex shader writes it.
  if (mesh) source = patchBoneInfluenceVertexShader(source);
  if (!source.includes('vNormal = aNormal;')) return source;
  const count = /uNodesMatrices\[(\d+)\]/.exec(source)?.[1] || '256';
  const normal = source.includes('aGroup') ? `vec3 posedNormal = mat3(uNodesMatrices[int(aGroup[0])]) * aNormal;
    if (aGroup[1] < ${count}.) posedNormal += mat3(uNodesMatrices[int(aGroup[1])]) * aNormal;
    if (aGroup[2] < ${count}.) posedNormal += mat3(uNodesMatrices[int(aGroup[2])]) * aNormal;
    if (aGroup[3] < ${count}.) posedNormal += mat3(uNodesMatrices[int(aGroup[3])]) * aNormal;
    vNormal = normalize(posedNormal);` : 'vNormal = normalize(aNormal);';
  return source.replace(/void main\s*\(/, 'uniform vec3 uMdlxlLightDirection;\n' + portraitLightDeclarations + 'void main(')
    .replace('vNormal = aNormal;',normal + portraitLightCalculation);
}

/**
 * Bone influence: x is how much the selected bones move a vertex, y how much
 * it moves with them through their child bones. One texel per node ObjectId
 * keeps the bone matrix uniforms at their full budget: the sampler uses a
 * texture unit, and only the fragment stage decides whether to show the tint.
 */
function patchBoneInfluenceVertexShader(source) {
  if (source.includes('vMdlxlInfluence')) return source;
  const count = /uNodesMatrices\[(\d+)\]/.exec(source)?.[1] || '254';
  const node = slot => `mdlxlNodeInfluence(${slot})`;
  const influence = source.includes('aGroup') ? `vec2 mdlxlInfluence = ${node('aGroup[0]')}; float mdlxlInfluenceCount = 1.;
    for (int i = 1; i < 4; i++) if (aGroup[i] < ${count}.) { mdlxlInfluence += ${node('aGroup[i]')}; mdlxlInfluenceCount += 1.; }
    vMdlxlInfluence = mdlxlInfluence / mdlxlInfluenceCount;`
    : source.includes('aSkin') && source.includes('aBoneWeight') ? `vMdlxlInfluence = ${[0, 1, 2, 3].map(i => `${node(`aSkin[${i}]`)} * aBoneWeight[${i}]`).join(' + ')};`
    : 'vMdlxlInfluence = vec2(0.);';
  return source.replace(/void main\s*\(/, 'uniform sampler2D uMdlxlInfluenceMap;\nout vec2 vMdlxlInfluence;\nvec2 mdlxlNodeInfluence(float node) { int index = int(node + .5); return index >= 0 && index < 256 ? texelFetch(uMdlxlInfluenceMap, ivec2(index, 0), 0).rg : vec2(0.); }\nvoid main(')
    .replace(/}\s*$/, `    ${influence}\n}\n`);
}

export function previewGeosetTint(model, geosetIndex, layer, frame, sequenceIndex, globalTime = frame, hideRgb = false) {
  const options = { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime };
  const evaluated = sampleGeosetAnimation(model, geosetIndex, frame, sequenceIndex, globalTime), rgb = hideRgb ? [1, 1, 1] : evaluated.color;
  const alpha = Math.max(0, Math.min(1, evaluated.alpha * sampleTrack(layer?.Alpha, frame, { ...options, fallback: 1 })));
  return [...Array.from(rgb, value => Math.max(0, Math.min(1, value)) * (layer?.FilterMode === 3 ? alpha : 1)), alpha];
}

export function resetPreviewEffects(native) {
  for (const emitter of native.particlesController?.emitters || []) {
    emitter.particles.length = 0; emitter.emission = 0; emitter.squirtFrame = -1;
  }
  for (const emitter of native.ribbonsController?.emitters || []) { emitter.creationTimes.length = 0; emitter.emission = 0; }
}

/**
 * war3-model gives a nonempty Image path precedence over ReplaceableId. Warcraft
 * team textures commonly have both, so restore the ReplaceableId after its
 * standard-layer setup has bound that stale image path.
 */
export function applyReplaceableTextureColor(native, gl, textureID) {
  const texture = native?.model?.Textures?.[textureID];
  const replaceableId = Number(texture?.ReplaceableId);
  if (replaceableId !== 1 && replaceableId !== 2) return false;
  gl.uniform3fv(native.shaderProgramLocations.replaceableColorUniform, native.rendererData.teamColor);
  gl.uniform1f(native.shaderProgramLocations.replaceableTypeUniform, replaceableId);
  return true;
}

/** Reforged skin weights do not guarantee Reforged/PBR materials. */
export function isExplicitHdMaterial(material) {
  return /^Shader_HD_/i.test(material?.Shader || '') || (material?.Layers || []).some(layer => layer?.ShaderTypeId != null);
}

function createSolidTexture(gl, rgba) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

const BONE_INFLUENCE_TEXTURE_UNIT = 8;
const BONE_INFLUENCE_GHOST_ALPHA = .5;
const BONE_INFLUENCE_PASSES = ['ghost-depth', 'ghost', 'hot-depth', 'hot'];
// Particles and ribbons draw once per frame, in the last colour pass.
const effectsPass = pass => pass === null || pass === 'blended' || pass === 'hot';

/** All hooks belong to this preview's private WebGL context, not global GL. */
export function installWarcraftPreviewAdapter(gl, model, getClock) {
  const original = { shaderSource: gl.shaderSource, bindBuffer: gl.bindBuffer, useProgram: gl.useProgram, drawElements: gl.drawElements };
  gl.shaderSource = function (shader, source) { return original.shaderSource.call(this, shader, patchWarcraftMeshVertexShader(patchWarcraftMeshFragmentShader(source))); };
  let native, location, lightingLocation, lightDirectionLocation, portraitLocation, coverageLocation, surfaceLocation, lightUniforms, activeProgram, elementBuffer, activeLayer, byIndexBuffer, setLayerProps, setLayerPropsHD, renderRibbons, updateRibbons, renderParticles, render;
  let neutralNormalTexture, neutralOrmTexture, influenceLocations, influenceTexture, influenceKey;
  const classicSkinnedMaterials = new Set((model.Geosets || []).flatMap(geoset => geoset.SkinWeights?.length && model.Materials?.[geoset.MaterialID]?.Layers?.length && !isExplicitHdMaterial(model.Materials[geoset.MaterialID]) ? [geoset.MaterialID] : []));
  let meshPass = null;
  // A unit war3-model never binds, so the per-bone map survives layer setup.
  const bindBoneInfluence = (context, influence) => {
    influenceTexture ||= context.createTexture();
    context.activeTexture(context.TEXTURE0 + BONE_INFLUENCE_TEXTURE_UNIT);
    context.bindTexture(context.TEXTURE_2D, influenceTexture);
    if (influenceKey !== influence.key) {
      influenceKey = influence.key;
      context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, influence.map.length / 4, 1, 0, context.RGBA, context.UNSIGNED_BYTE, influence.map);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
    }
    context.activeTexture(context.TEXTURE0);
    if (influenceLocations.map) context.uniform1i(influenceLocations.map, BONE_INFLUENCE_TEXTURE_UNIT);
    if (influenceLocations.ghost) context.uniform1f(influenceLocations.ghost, BONE_INFLUENCE_GHOST_ALPHA);
  };
  return {
    ready(renderer) {
      native = renderer; gl.shaderSource = original.shaderSource;
      location = gl.getUniformLocation(native.shaderProgram, 'uMdlvisGeosetTint');
      lightingLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlLighting');
      lightDirectionLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlLightDirection');
      portraitLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlPortrait');
      coverageLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlCoverage');
      surfaceLocation = gl.getUniformLocation(native.shaderProgram, 'uMdlxlSurface');
      lightUniforms = Object.fromEntries(['Ambient', 'Diffuse', 'Specular', 'Power', 'Legacy', 'ViewDirection'].map(name => [name, gl.getUniformLocation(native.shaderProgram, `uMdlxl${name}`)]));
      if (!location) throw new Error('The Warcraft preview shader is incompatible with geoset color editing.');
      influenceLocations = { on: gl.getUniformLocation(native.shaderProgram, 'uMdlxlInfluenceOn'), map: gl.getUniformLocation(native.shaderProgram, 'uMdlxlInfluenceMap'), ghost: gl.getUniformLocation(native.shaderProgram, 'uMdlxlGhostAlpha'), part: gl.getUniformLocation(native.shaderProgram, 'uMdlxlInfluencePart') };
      byIndexBuffer = new Map(native.indexBuffer.map((buffer, index) => [buffer, index]));
      setLayerProps = native.setLayerProps; setLayerPropsHD = native.setLayerPropsHD;
      if (classicSkinnedMaterials.size) {
        // The HD shader needs both maps even when the authored material is a
        // Classic diffuse/glow stack. These private 1x1 maps add no detail.
        neutralNormalTexture = createSolidTexture(gl, [128, 128, 255, 255]);
        // Classic materials have no ORM team-colour mask. Alpha zero keeps
        // their diffuse pixels unchanged by the HD shader's team tint.
        neutralOrmTexture = createSolidTexture(gl, [255, 255, 0, 0]);
      }
      native.setLayerProps = function (layer, textureID) {
        activeLayer = layer;
        const result = setLayerProps.call(this, layer, textureID);
        applyReplaceableTextureColor(this, gl, textureID);
        // Additive is ONE + ONE, as in the vertex editor. SRC_COLOR squares
        // the texture/tint and suppresses the soft edges of glow textures.
        if (layer.FilterMode === 3) gl.blendFunc(gl.ONE, gl.ONE);
        return result;
      };
      const setClassicSkinnedLayer = (materialID, layerIndex) => {
        const layer = model.Materials[materialID].Layers[layerIndex];
        native.setLayerProps(layer, native.rendererData.materialLayerTextureID[materialID][layerIndex]);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, neutralNormalTexture);
        gl.uniform1i(native.shaderProgramLocations.normalSamplerUniform, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, neutralOrmTexture);
        gl.uniform1i(native.shaderProgramLocations.ormSamplerUniform, 2);
      };
      native.setLayerPropsHD = function (materialID, layers) {
        activeLayer = layers[0];
        if (classicSkinnedMaterials.has(materialID)) return setClassicSkinnedLayer(materialID, 0);
        return setLayerPropsHD.call(this, materialID, layers);
      };
      // Upstream draws in geoset file order. Finish opaque depth first so a
      // later face cannot paint over an earlier glow. Each mesh layer draws
      // once; original IDs, buffer mappings and within-pass order stay intact.
      render = native.render;
      native.render = function (mvMatrix, pMatrix, options) {
        try {
          // Bone influence shows only the nearest ghost surface, so overlapping
          // faces cannot stack into blotches. The affected parts get their own
          // depth and draw over the ghost, so they still show through the body.
          if (getClock().boneInfluence) {
            for (const pass of BONE_INFLUENCE_PASSES) {
              // The ghost colour pass leaves depth writes off, and clear() obeys that mask.
              if (pass === 'hot-depth') { gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); }
              meshPass = pass; render.call(this, mvMatrix, pMatrix, pass === 'ghost-depth' ? options : { ...options, env: false });
            }
            return;
          }
          meshPass = 'opaque'; render.call(this, mvMatrix, pMatrix, options);
          meshPass = 'blended'; return render.call(this, mvMatrix, pMatrix, { ...options, env: false });
        } finally { meshPass = null; }
      };
      if (native.particlesController) {
        renderParticles = native.particlesController.render;
        native.particlesController.render = function (...args) {
          if (!effectsPass(meshPass)) return;
          return renderParticles.apply(this, args);
        };
      }
      if (native.ribbonsController) {
        updateRibbons = native.ribbonsController.update;
        let ribbonWallClock = Date.now();
        native.ribbonsController.update = function (delta) {
          const now = Date.now(), adjustment = now - ribbonWallClock - delta; ribbonWallClock = now;
          // Upstream ribbons use wall-clock birth times. Shift those times so
          // their ages advance only by the simulated delta, including pause.
          for (const emitter of this.emitters || []) for (let i = 0; i < emitter.creationTimes.length; i++) emitter.creationTimes[i] += adjustment;
          return updateRibbons.call(this, delta);
        };
        renderRibbons = native.ribbonsController.render;
        native.ribbonsController.render = function (...args) {
          if (!effectsPass(meshPass)) return;
          const { frame, sequenceIndex, globalTime } = getClock(), replacements = [];
          for (const emitter of this.emitters || []) if (emitter.props.Color?.Keys) {
            const color = emitter.props.Color; replacements.push([emitter.props, color]);
            emitter.props.Color = new Float32Array(sampleTrack(color, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime, fallback: [1, 1, 1] }));
          }
          try { return renderRibbons.apply(this, args); }
          finally { for (const [props, color] of replacements) props.Color = color; }
        };
      }
      gl.useProgram = function (program) { activeProgram = program; return original.useProgram.call(this, program); };
      gl.bindBuffer = function (target, buffer) { if (target === this.ELEMENT_ARRAY_BUFFER) elementBuffer = buffer; return original.bindBuffer.call(this, target, buffer); };
      gl.drawElements = function (...args) {
        const geosetIndex = activeProgram === native.shaderProgram ? byIndexBuffer.get(elementBuffer) : undefined;
        const drawLayer = () => {
          if (geosetIndex === undefined) return original.drawElements.apply(this, args);
          if (getClock().hiddenGeosets?.has?.(geosetIndex) || Array.isArray(getClock().hiddenGeosets) && getClock().hiddenGeosets.includes(geosetIndex)) return;
          // Bone influence is a see-through Surface View. Additive and modulate
          // effect cards carry no body shape, so they would only cloud it.
          const influence = getClock().boneInfluence, surface = getClock().surface || !!influence;
          if (surface && activeLayer !== model.Materials?.[model.Geosets[geosetIndex].MaterialID]?.Layers?.[0]) return;
          if (influence && (activeLayer?.FilterMode ?? 0) >= 3) return;
          if (surfaceLocation) this.uniform1f(surfaceLocation, surface ? 1 : 0);
          const { frame, sequenceIndex, globalTime } = getClock();
          const tint = previewGeosetTint(model, geosetIndex, activeLayer, frame, sequenceIndex, globalTime, getClock().hideRgbGeoset === geosetIndex);
          if (tint[3] <= 1e-6) return;
          const blended = !!influence || (activeLayer?.FilterMode ?? 0) >= 2 || tint[3] < .999999;
          if (meshPass && !influence && blended !== (meshPass === 'blended')) return;
          // Geoset colours would turn the influence orange yellow or green;
          // only their visibility (alpha) still applies in Bone influence.
          this.uniform4fv(location, influence ? [1, 1, 1, tint[3]] : tint);
          if (influenceLocations.on) this.uniform1f(influenceLocations.on, influence ? activeLayer?.FilterMode === 2 ? 2 : 1 : 0);
          if (influence) bindBoneInfluence(this, influence);
          if (influenceLocations.part) this.uniform1f(influenceLocations.part, meshPass?.startsWith('hot') ? 1 : 0);
          // Surface View is an inspection material: its faces must remain
          // shaded even when the authored texture layer is Unshaded.
          if (lightingLocation) this.uniform1f(lightingLocation, surface || getClock().lighting !== false && !(activeLayer?.Shading & 1) ? 1 : 0);
          // Experimental DNC rig only (2); 1 keeps the verified MiscData light.
          const portraitLight = getClock().portrait ? getClock().portraitLight : null;
          if (portraitLocation) this.uniform1f(portraitLocation, getClock().portrait ? portraitLight ? 2 : 1 : 0);
          if (lightDirectionLocation) this.uniform3fv(lightDirectionLocation, getClock().portrait && getClock().portraitLight?.direction || getClock().lightDirection || [-.65, .55, 1]);
          const lighting = previewLighting(getClock().preferences);
          for (const name of ['Ambient', 'Diffuse', 'Specular']) if (lightUniforms[name]) this.uniform3fv(lightUniforms[name], portraitLight && name !== 'Specular' ? portraitLight[name === 'Ambient' ? 'ambient' : 'color'] : lighting[name.toLowerCase()]);
          if (lightUniforms.Power) this.uniform1f(lightUniforms.Power, lighting.power);
          if (lightUniforms.Legacy) this.uniform1f(lightUniforms.Legacy, lighting.preset === 'legacy' ? 1 : 0);
          if (lightUniforms.ViewDirection) this.uniform3fv(lightUniforms.ViewDirection, getClock().viewDirection || [0, 0, 1]);
          const coverage = !influence && activeLayer?.FilterMode === 1 && !!gl.getContextAttributes()?.antialias;
          if (coverageLocation) this.uniform1f(coverageLocation, coverage ? 1 : 0);
          if (coverage) this.enable(this.SAMPLE_ALPHA_TO_COVERAGE);
          else this.disable(this.SAMPLE_ALPHA_TO_COVERAGE);
          const depthOnly = !!influence && meshPass?.endsWith('-depth');
          if (influence) this.enable(this.DEPTH_TEST);
          if (depthOnly) { this.disable(this.BLEND); this.colorMask(false, false, false, false); this.depthMask(true); }
          else if (influence || tint[3] < .999999 && (activeLayer?.FilterMode ?? 0) <= 1) {
            this.enable(this.BLEND); this.blendFuncSeparate(this.SRC_ALPHA, this.ONE_MINUS_SRC_ALPHA, this.ONE, this.ONE_MINUS_SRC_ALPHA); this.depthMask(false);
          }
          try { return original.drawElements.apply(this, args); }
          finally { this.disable(this.SAMPLE_ALPHA_TO_COVERAGE); if (depthOnly) this.colorMask(true, true, true, true); }
        };
        const materialID = geosetIndex === undefined ? undefined : model.Geosets[geosetIndex]?.MaterialID;
        if (!classicSkinnedMaterials.has(materialID)) return drawLayer();
        let result;
        for (let layerIndex = 0; layerIndex < model.Materials[materialID].Layers.length; layerIndex++) {
          setClassicSkinnedLayer(materialID, layerIndex);
          result = drawLayer();
        }
        return result;
      };
    },
    dispose() {
      Object.assign(gl, original);
      if (native && render) native.render = render;
      if (native?.particlesController && renderParticles) native.particlesController.render = renderParticles;
      if (native && setLayerProps) native.setLayerProps = setLayerProps;
      if (native && setLayerPropsHD) native.setLayerPropsHD = setLayerPropsHD;
      if (native?.ribbonsController && renderRibbons) native.ribbonsController.render = renderRibbons;
      if (native?.ribbonsController && updateRibbons) native.ribbonsController.update = updateRibbons;
      if (neutralNormalTexture) gl.deleteTexture(neutralNormalTexture);
      if (neutralOrmTexture) gl.deleteTexture(neutralOrmTexture);
      if (influenceTexture) gl.deleteTexture(influenceTexture);
    },
  };
}
