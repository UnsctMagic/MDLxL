import test from 'node:test';
import assert from 'node:assert/strict';
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';
import { EditorCameraControls, MAX_BACK_AWAY, zoomEditorCamera } from '../app/editor-camera-controls.js';
import { configureEditorTexture, cameraLeftLight, captureDimensions, improveNativeTexture } from '../app/viewport-quality.js';
import { modelCameraGizmos } from '../app/model-camera-overlay.js';
import { applyReplaceableTextureColor, patchWarcraftMeshVertexShader, patchWarcraftMeshFragmentShader } from '../app/warcraft-preview-adapter.js';

test('perspective zoom changes projected size while retaining camera position, target and depth proportions', () => {
  const camera = new PerspectiveCamera(42, 1, 100, 1000); camera.position.set(0, 0, 320); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const controls = new EditorCameraControls(camera), original = camera.position.clone(), direction = camera.quaternion.clone();
  const a = new Vector3(10, 0, 0), b = new Vector3(10, 0, 50);
  const widthA = a.clone().project(camera).x, widthB = b.clone().project(camera).x;
  controls.dollyOut(2); controls.update(); camera.updateMatrixWorld();
  assert.equal(camera.zoom, 2); assert.ok(camera.position.distanceTo(original) < 1e-9); assert.ok(camera.quaternion.angleTo(direction) < 1e-8);
  assert.ok(Math.abs(a.clone().project(camera).x / widthA - 2) < 1e-9);
  assert.ok(Math.abs(b.clone().project(camera).x / widthB - 2) < 1e-9);
  assert.equal(camera.near, 100); assert.equal(camera.far, 1000);
  controls.dollyIn(2); assert.equal(camera.zoom, 1);
  const ortho = new OrthographicCamera(-1, 1, 1, -1); zoomEditorCamera(ortho, 10000); assert.equal(ortho.zoom, 100);
});

test('perspective zoom out backs the camera away instead of widening the lens past normal', () => {
  const camera = new PerspectiveCamera(42, 1.6, 1, 5000); camera.position.set(300, -400, 200); camera.up.set(0, 0, 1);
  const controls = new EditorCameraControls(camera), target = controls.target.set(0, 0, 50).clone(); controls.update();
  const direction = camera.position.clone().sub(target).normalize(), start = camera.position.distanceTo(target);
  const near = new Vector3(0, 0, 50), far = new Vector3(0, 200, 50), sizeOf = () => { camera.updateMatrixWorld(); return far.clone().project(camera).distanceTo(near.clone().project(camera)); };
  const size = sizeOf(), out = (factor, steps = 1) => { for (let i = 0; i < steps; i++) { controls.dollyIn(factor); controls.update(); } };
  out(2);
  assert.equal(camera.zoom, 1, 'lens keeps its normal angle');
  assert.ok(Math.abs(camera.position.distanceTo(target) - start * 2) < 1e-6, 'camera backed away twice as far');
  assert.ok(camera.position.clone().sub(target).normalize().distanceTo(direction) < 1e-9 && controls.target.distanceTo(target) < 1e-9, 'same viewing direction and target');
  assert.ok(sizeOf() < size * .6, 'the model looks smaller');
  // Zooming back in returns to the starting distance before the lens narrows.
  controls.dollyOut(4); controls.update();
  assert.ok(Math.abs(camera.position.distanceTo(target) - start) < 1e-6, 'camera returned to where it started');
  assert.ok(Math.abs(camera.zoom - 2) < 1e-9, 'remaining zoom narrows the lens');
  // A narrowed lens widens back to normal first, then the camera backs away.
  controls.dollyIn(6); controls.update();
  assert.equal(camera.zoom, 1); assert.ok(Math.abs(camera.position.distanceTo(target) - start * 3) < 1e-6);
  // Thirty wheel notches out: never a wide lens, and the camera stops at the old lens limit.
  out(1.15, 200);
  assert.equal(camera.zoom, 1); assert.ok(Math.abs(camera.position.distanceTo(target) - start * MAX_BACK_AWAY) < 1e-6);
});

test('perspective zoom forgets where it backed away from after Fit moves the camera', () => {
  const camera = new PerspectiveCamera(42, 1, 1, 5000); camera.position.set(0, -500, 0); camera.up.set(0, 0, 1);
  const controls = new EditorCameraControls(camera); controls.update();
  controls.dollyIn(4); controls.update(); assert.ok(Math.abs(camera.position.length() - 2000) < 1e-6);
  camera.position.set(0, -800, 0); controls.update(); // Fit places the camera at its own distance.
  controls.dollyOut(2); controls.update();
  assert.ok(Math.abs(camera.position.length() - 800) < 1e-6, 'zooming in does not pull the camera toward the old start');
  assert.equal(camera.zoom, 2);
});

test('zoom tool drag, orthographic, portrait and Showcase zoom keep their own behavior', () => {
  const drag = new PerspectiveCamera(42, 1, 1, 5000); drag.position.set(0, -500, 0);
  const dragControls = new EditorCameraControls(drag);
  let previous = 1; for (const factor of [.8, .5, .25]) { dragControls.zoomView(factor / previous); previous = factor; }
  assert.equal(drag.zoom, 1); assert.ok(Math.abs(drag.position.length() - 2000) < 1e-6, 'zoom tool drag backs away too');
  for (const factor of [.5, 1, 2]) { dragControls.zoomView(factor / previous); previous = factor; }
  assert.ok(Math.abs(drag.position.length() - 500) < 1e-6 && Math.abs(drag.zoom - 2) < 1e-9, 'dragging back returns, then narrows the lens');
  const ortho = new OrthographicCamera(-1, 1, 1, -1); ortho.position.set(0, -500, 0);
  const orthoControls = new EditorCameraControls(ortho); orthoControls.dollyIn(4);
  assert.equal(ortho.zoom, .25); assert.ok(Math.abs(ortho.position.length() - 500) < 1e-9);
  const showcase = new PerspectiveCamera(42, 1, 1, 5000); showcase.position.set(0, -500, 0);
  const showcaseControls = new EditorCameraControls(showcase); showcaseControls.wideLensZoom = () => true; showcaseControls.dollyIn(4);
  assert.equal(showcase.zoom, .25, 'Showcase framing still owns the lens'); assert.ok(Math.abs(showcase.position.length() - 500) < 1e-9);
  const portrait = new PerspectiveCamera(42, 1, 1, 5000); portrait.position.set(0, -500, 0);
  const portraitControls = new EditorCameraControls(portrait); portraitControls.portraitDolly = () => true; portraitControls.dollyIn(4);
  assert.equal(portrait.zoom, 1); assert.ok(Math.abs(portrait.position.length() - 2000) < 1e-6, 'portrait cameras still dolly');
});

test('key light remains on viewing-camera left after rotation and pan', () => {
  for (const position of [[10, -20, 30], [-30, 10, 5], [0, 0, 40]]) {
    const camera = new PerspectiveCamera(), target = new Vector3(4, 5, 6); camera.position.fromArray(position); camera.lookAt(target);
    const light = cameraLeftLight(camera, target, 100), local = light.position.clone().sub(target).applyQuaternion(camera.quaternion.clone().invert());
    assert.ok(local.x < 0 && local.y > 0 && local.z > 0); assert.ok(Math.abs(light.direction.length() - 1) < 1e-9);
  }
});

test('decoded texture maps generate filtered mipmaps and native upload preserves previous binding', () => {
  const texture = configureEditorTexture(new DataTexture(new Uint8Array(64), 4, 4), 64);
  assert.equal(texture.magFilter, LinearFilter); assert.equal(texture.minFilter, LinearMipmapLinearFilter); assert.equal(texture.generateMipmaps, true); assert.equal(texture.anisotropy, 16);
  const calls = [], gl = { TEXTURE_2D:1,TEXTURE_BINDING_2D:2,TEXTURE_MAG_FILTER:3,TEXTURE_MIN_FILTER:4,LINEAR:5,LINEAR_MIPMAP_LINEAR:6,
    getParameter: () => 'previous', bindTexture: (...args) => calls.push(['bind',...args]), generateMipmap: (...args) => calls.push(['mips',...args]), texParameteri: (...args) => calls.push(['parameter',...args]) };
  improveNativeTexture(gl, { rendererData:{textures:{'skin.blp':'skin'}} }, 'skin.blp');
  assert.deepEqual(calls[0], ['bind',1,'skin']); assert.deepEqual(calls.at(-1), ['bind',1,'previous']); assert.ok(calls.some(call=>call[0]==='mips'));
});

test('capture dimensions render at requested long edge, preserve aspect and respect GPU limits', () => {
  assert.deepEqual(captureDimensions(800,600,3840), {width:3840,height:2880});
  assert.deepEqual(captureDimensions(600,800,1920), {width:1440,height:1920});
  assert.deepEqual(captureDimensions(800,600,3840,2048), {width:2048,height:1536});
  assert.deepEqual(captureDimensions(800,600), {width:800,height:600});
});

test('camera gizmos follow animated camera and target without modifying model', () => {
  const track = Vector => ({LineType:0,Keys:[{Frame:0,Vector}]});
  const model = {Sequences:[{Interval:[0,100]}],Cameras:[{Name:'Portrait',Position:[0,-20,10],TargetPosition:[0,0,10],FieldOfView:Math.PI/4,Translation:track([10,0,0]),TargetTranslation:track([0,0,20])}]};
  const original = structuredClone(model), [gizmo] = modelCameraGizmos(model,50,0);
  assert.deepEqual(gizmo.position.toArray(),[10,-20,10]); assert.deepEqual(gizmo.segments[0][1].toArray(),[0,0,30]); assert.equal(gizmo.segments.length,11); assert.deepEqual(model,original);
  assert.deepEqual(modelCameraGizmos({Cameras:[{Position:[NaN,0,0],TargetPosition:[0,0,0]}]}),[]);
});

test('native shader repairs retain SD bone bounds and derivative support for smooth alpha cutouts', () => {
  const vertex = 'uniform mat4 uNodesMatrices[128]; attribute vec4 aGroup; void main() { vNormal = aNormal; }';
  const result = patchWarcraftMeshVertexShader(vertex);
  assert.ok(result.includes('aGroup[3] < 128.')); assert.ok(!result.includes('${MAX_NODES}'));
  const fragment = 'precision mediump float; uniform mat3 uTVertexAnim; uniform float uWireframe; void main() { gl_FragColor = vec4(1.); if (gl_FragColor[3] < uDiscardAlphaLevel) { discard; } }';
  const shader = patchWarcraftMeshFragmentShader(fragment);
  assert.ok(shader.startsWith('#version 300 es')); assert.ok(shader.includes('fwidth(gl_FragColor.a)')); assert.ok(shader.includes('uMdlxlLightDirection'));
});

test('classic portrait uses clamped vertex lighting without changing ordinary inspection shading', () => {
  const vertex = patchWarcraftMeshVertexShader('uniform mat4 uNodesMatrices[128]; attribute vec4 aGroup; void main() { vNormal = aNormal; }');
  const fragment = patchWarcraftMeshFragmentShader('precision mediump float; uniform mat3 uTVertexAnim; uniform float uWireframe; void main() { gl_FragColor = vec4(1.); }');
  // Default: the verified MiscData light, clamp(.3 + N.L), unchanged from the previous release.
  assert.ok(vertex.includes('out vec2 vMdlxlPortraitLight;'));
  assert.ok(vertex.includes('float mdlxlPortraitDiffuse = max(0., dot(vNormal, normalize(uMdlxlLightDirection)));'));
  assert.ok(vertex.includes('vMdlxlPortraitLight = vec2(clamp(.3 + mdlxlPortraitDiffuse, 0., 1.), mdlxlPortraitDiffuse);'));
  // No uniforms beyond main's: the vertex stage is near the SD skinning limit.
  assert.deepEqual(vertex.match(/uniform [^;]+;/g), ['uniform mat4 uNodesMatrices[128];', 'uniform vec3 uMdlxlLightDirection;']);
  assert.ok(!/uPortraitLight/.test(vertex + fragment));
  assert.ok(fragment.includes('in vec2 vMdlxlPortraitLight;'));
  assert.ok(fragment.includes('if (uMdlxlPortrait > .5) { if (uMdlxlLighting > .5) gl_FragColor.rgb *= (uMdlxlPortrait > 1.5 ? clamp(uMdlxlAmbient + uMdlxlDiffuse * vMdlxlPortraitLight.y, 0., 1.) : vec3(vMdlxlPortraitLight.x)); } else if (uMdlxlLegacy > .5)'));
  assert.ok(fragment.includes('mdlxlEncodeSRGB(max(inspectionBase'));
});

test('Showcase Low and Highest change actual GPU texture filtering',()=>{
  const calls=[],gl={TEXTURE_2D:1,TEXTURE_BINDING_2D:2,TEXTURE_MAG_FILTER:3,TEXTURE_MIN_FILTER:4,LINEAR:5,LINEAR_MIPMAP_LINEAR:6,LINEAR_MIPMAP_NEAREST:7,
    getParameter:key=>key===9?16:null,bindTexture(){},generateMipmap(){},texParameteri:(...args)=>calls.push(args),texParameterf:(...args)=>calls.push(args)};
  const native={rendererData:{textures:{skin:'texture'}},anisotropicExt:{TEXTURE_MAX_ANISOTROPY_EXT:8,MAX_TEXTURE_MAX_ANISOTROPY_EXT:9}};
  improveNativeTexture(gl,native,'skin',{textureFiltering:'bilinear',anisotropy:1});
  assert.ok(calls.some(call=>call[1]===4&&call[2]===7));assert.ok(calls.some(call=>call[1]===8&&call[2]===1));
  calls.length=0;improveNativeTexture(gl,native,'skin',{textureFiltering:'trilinear',anisotropy:16});
  assert.ok(calls.some(call=>call[1]===4&&call[2]===6));assert.ok(calls.some(call=>call[1]===8&&call[2]===16));
});

test('path-backed team colours still use the live preview team colour', () => {
  const calls = [];
  const native = {
    model: { Textures: [{ Image: 'ReplaceableTextures\\TeamColor\\TeamColor00.blp', ReplaceableId: 1 }, { Image: 'skin.blp', ReplaceableId: 0 }] },
    rendererData: { teamColor: new Float32Array([.129, .749, 0]) },
    shaderProgramLocations: { replaceableColorUniform: 'replaceableColor', replaceableTypeUniform: 'replaceableType' },
  };
  const gl = {
    uniform3fv(location, value) { calls.push(['uniform3fv', location, Array.from(value)]); },
    uniform1f(location, value) { calls.push(['uniform1f', location, value]); },
  };

  assert.equal(applyReplaceableTextureColor(native, gl, 0), true);
  assert.deepEqual(calls, [
    ['uniform3fv', 'replaceableColor', [0.1289999932050705, 0.7490000128746033, 0]],
    ['uniform1f', 'replaceableType', 1],
  ]);
  assert.equal(applyReplaceableTextureColor(native, gl, 1), false);
});
