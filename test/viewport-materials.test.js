import test from 'node:test';
import assert from 'node:assert/strict';
import { ShaderLib, MeshPhongMaterial, MeshBasicMaterial, CustomBlending, NormalBlending, AdditiveBlending, DstColorFactor, SrcColorFactor, ZeroFactor, OneFactor } from 'three';
import { layerMaterial, textureFromAsset } from '../app/viewport-materials.js';
import { createPaintLightUniforms, applyPaintLightShader } from '../app/paint-lighting.js';

test('shared layer shader fixes zero normals before interpolation and keeps Paint extensions', () => {
  const material = layerMaterial({ FilterMode: 1 });
  const shader = { ...ShaderLib.phong, uniforms: {} }; material.onBeforeCompile(shader);
  assert.ok(material instanceof MeshPhongMaterial);
  assert.match(shader.vertexShader, /dot\(transformedNormal, transformedNormal\) > 0.0/);
  assert.match(shader.fragmentShader, /mdlxlFaceNormal \* faceDirection/);
  assert.equal(material.alphaTest, .75); assert.equal(material.transparent, false);
  const uniforms = createPaintLightUniforms();
  const paint = layerMaterial({ FilterMode: 4 }, false, { extendShader: shader => applyPaintLightShader(shader, uniforms, false), cacheKey: 'paint-test' });
  const paintShader = { ...ShaderLib.basic, uniforms: {} }; paint.onBeforeCompile(paintShader);
  assert.ok(paint instanceof MeshBasicMaterial); assert.equal(paint.customProgramCacheKey(), 'paint-test');
  assert.equal(paintShader.uniforms.uCitadelCount, uniforms.uCitadelCount);
  assert.equal(paintShader.uniforms.uMdlxlGeosetTint, paint.userData.geosetTint);
  assert.match(paintShader.fragmentShader, /gl_FragColor.rgb \*= vCitadelLight/);
  assert.equal(paint.transparent, true); material.dispose(); paint.dispose();
});

test('Paint decoder fallback is opt-in, caches pixels and still creates owned GPU textures', async () => {
  const asset = { name: 'bad.blp', bytes: new Uint8Array([0, 0, 0, 50]) };
  await assert.rejects(textureFromAsset(asset));
  let calls = 0;
  const fallbackDecoder = () => { calls++; return { width: 1, height: 1, data: Uint8Array.of(70, 90, 10, 255) }; };
  const first = await textureFromAsset(asset, { Flags: 0 }, { fallbackDecoder });
  const second = await textureFromAsset(asset, { Flags: 0 }, { fallbackDecoder });
  assert.equal(calls, 1); assert.notEqual(first, second); assert.equal(first.flipY, false);
  assert.deepEqual(first.image.data, Uint8Array.of(70, 90, 10, 255)); first.dispose(); second.dispose();
});

test('Modulate layers keep the drawn alpha like the game preview; other filters keep their blending', () => {
  const blend = filter => { const m = layerMaterial({ FilterMode: filter }); const r = [m.blending, m.blendSrc, m.blendDst, m.blendSrcAlpha, m.blendDstAlpha]; m.dispose(); return r; };
  // war3-model: Modulate blendFuncSeparate(ZERO, SRC_COLOR, ZERO, ONE), Modulate 2x (DST_COLOR, SRC_COLOR, ZERO, ONE).
  assert.deepEqual(blend(6), [CustomBlending, DstColorFactor, SrcColorFactor, ZeroFactor, OneFactor]);
  assert.deepEqual(blend(5), [CustomBlending, DstColorFactor, ZeroFactor, ZeroFactor, OneFactor]);
  for (const filter of [0, 1, 2]) assert.deepEqual(blend(filter), [NormalBlending, 204, 205, null, null]);
  assert.deepEqual(blend(3), [CustomBlending, OneFactor, OneFactor, null, null]);
  assert.deepEqual(blend(4), [AdditiveBlending, 204, 205, null, null]);
});
