import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { attachToBone, boneInfluenceMap, createRigNode } from '../src/bone-tools.js';
import { createStarterDocument } from '../src/starter-model.js';
import { patchWarcraftMeshFragmentShader, patchWarcraftMeshVertexShader } from '../app/warcraft-preview-adapter.js';

const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../app/GamePreview.jsx', import.meta.url), 'utf8');

async function toolbarModule() {
  const result = await build({ entryPoints: [new URL('../app/AppToolbar.jsx', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
}
const { AppViewLabel, BONE_INFLUENCE_TIP } = await toolbarModule();
const label = props => renderToStaticMarkup(React.createElement(AppViewLabel, { mode: 'animation', view: 'orthographic', views: ['orthographic'], renderMode: 'wireframe', frame() {}, setCleanViews() {}, setPortraitView() {}, setRenderMode() {}, setView() {}, toggleQuadView() {}, ...props }));

// Upstream war3-model shapes: SD hardware skinning, HD weighted skinning, and
// the SD software-skinning fallback used when bone uniforms do not fit.
const sdVertex = 'attribute vec3 aVertexPosition;\nattribute vec3 aNormal;\nattribute vec2 aTextureCoord;\nattribute vec4 aGroup;\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nuniform mat4 uNodesMatrices[254];\nvarying vec3 vNormal;\nvarying vec2 vTextureCoord;\nvoid main(void) {\n    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.);\n    vTextureCoord = aTextureCoord;\n    vNormal = aNormal;\n}';
const hdVertex = '#version 300 es\nin vec3 aVertexPosition;\nin vec3 aNormal;\nin vec2 aTextureCoord;\nin vec4 aSkin;\nin vec4 aBoneWeight;\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nuniform mat4 uNodesMatrices[254];\nout vec3 vNormal;\nout vec2 vTextureCoord;\nvoid main(void) {\n    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.);\n    vTextureCoord = aTextureCoord;\n    vec3 normal = aNormal;\n    vNormal = normal;\n}';
const softwareVertex = 'attribute vec3 aVertexPosition;\nattribute vec3 aNormal;\nattribute vec2 aTextureCoord;\nuniform mat4 uMVMatrix;\nuniform mat4 uPMatrix;\nvarying vec3 vNormal;\nvarying vec2 vTextureCoord;\nvoid main(void) {\n    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.);\n    vTextureCoord = aTextureCoord;\n    vNormal = aNormal;\n}';

test('the influence map marks selected bones and the bones that follow them', () => {
  const model = createStarterDocument().model, root = model.Bones[0].ObjectId;
  const child = createRigNode(model, 'Bone'), loose = createRigNode(model, 'Bone');
  attachToBone(model, child.ObjectId, root);
  const map = boneInfluenceMap(model, [root]), texel = id => Array.from(map.slice(id * 4, id * 4 + 4));
  assert.equal(map.length, 256 * 4);
  assert.deepEqual(texel(root), [255, 255, 0, 255]);
  assert.deepEqual(texel(child.ObjectId), [0, 255, 0, 255]);
  assert.deepEqual(texel(loose.ObjectId), [0, 0, 0, 0]);
  assert.ok(boneInfluenceMap(model, []).every(value => value === 0));
  assert.deepEqual(Array.from(boneInfluenceMap(model, [child.ObjectId]).slice(root * 4, root * 4 + 4)), [0, 0, 0, 0], 'a parent does not follow its child');
});

test('every mesh vertex shader writes the influence without new uniform vectors', () => {
  const sd = patchWarcraftMeshVertexShader(sdVertex), hd = patchWarcraftMeshVertexShader(hdVertex), software = patchWarcraftMeshVertexShader(softwareVertex);
  for (const [source, shader] of [[sdVertex, sd], [hdVertex, hd], [softwareVertex, software]]) {
    assert.ok(shader.startsWith('#version 300 es\n'));
    assert.equal(shader.match(/out vec2 vMdlxlInfluence;/g)?.length, 1);
    // SD skinning sits at the vertex uniform limit: the only new uniform is a
    // texture sampler (the light direction predates this view).
    const added = shader.match(/uniform [^;]+;/g).filter(line => !source.includes(line));
    assert.ok(added.includes('uniform sampler2D uMdlxlInfluenceMap;'));
    assert.deepEqual(added.filter(line => !['uniform sampler2D uMdlxlInfluenceMap;', 'uniform vec3 uMdlxlLightDirection;'].includes(line)), []);
  }
  assert.match(sd, /for \(int i = 1; i < 4; i\+\+\) if \(aGroup\[i\] < 254\.\) \{ mdlxlInfluence \+= mdlxlNodeInfluence\(aGroup\[i\]\); mdlxlInfluenceCount \+= 1\.; \}/);
  assert.match(sd, /vMdlxlInfluence = mdlxlInfluence \/ mdlxlInfluenceCount;\n}\n$/);
  assert.match(hd, /vMdlxlInfluence = mdlxlNodeInfluence\(aSkin\[0\]\) \* aBoneWeight\[0\] \+ .* \+ mdlxlNodeInfluence\(aSkin\[3\]\) \* aBoneWeight\[3\];/);
  assert.match(software, /vMdlxlInfluence = vec2\(0\.\);\n}\n$/);
  assert.equal(patchWarcraftMeshVertexShader(sd), sd, 'patching twice changes nothing');
  const particle = 'attribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\nuniform mat4 uMVMatrix;\nvoid main(void) { gl_Position = vec4(aVertexPosition, 1.); }';
  assert.equal(patchWarcraftMeshVertexShader(particle), particle);
});

test('the fragment stage tints Surface grey and ghosts unaffected parts only in Bone influence', () => {
  const sd = patchWarcraftMeshFragmentShader('precision mediump float;\nvarying vec2 vTextureCoord;\nuniform mat3 uTVertexAnim;\nuniform float uWireframe;\nvoid main(void) {\n    gl_FragColor = vec4(1.);\n}\n');
  assert.ok(sd.includes('in vec2 vMdlxlInfluence;'));
  assert.ok(sd.includes('if (uMdlxlInfluenceOn > .5) mdlxlSurfaceColor = mix(mix(uMdlxlGhostColor, uMdlxlFollowColor, clamp(vMdlxlInfluence.y, 0., 1.)), uMdlxlDirectColor, clamp(vMdlxlInfluence.x, 0., 1.));'));
  for (const name of ['Ghost', 'Direct', 'Follow']) assert.ok(sd.includes(`uniform vec3 uMdlxl${name}Color;`), name);
  assert.ok(sd.includes('if (uMdlxlSurface > .5) { gl_FragColor.rgb = mdlxlSurfaceColor;'));
  assert.ok(sd.includes('if (uMdlxlInfluenceOn > .5) gl_FragColor.a = uMdlvisGeosetTint.a * (uMdlxlInfluenceOn > 1.5 ? mdlxlLayerAlpha : 1.) * mix(uMdlxlGhostAlpha, .82, clamp(vMdlxlInfluence.y, 0., 1.));'));
  assert.ok(sd.indexOf('gl_FragColor *= uMdlvisGeosetTint;') < sd.indexOf('gl_FragColor.a = uMdlvisGeosetTint.a'));
  // Ghost and highlighted passes split every face at the same threshold, so they meet without gaps.
  assert.ok(sd.includes('if (uMdlxlInfluenceOn > .5 && ((vMdlxlInfluence.y >= .5) != (uMdlxlInfluencePart > .5) || uMdlxlInfluenceOn > 1.5 && mdlxlLayerAlpha < .1)) discard;'));
});

test('Bone influence draws one smooth ghost layer, then the highlighted parts over it', () => {
  const adapter = readFileSync(new URL('../app/warcraft-preview-adapter.js', import.meta.url), 'utf8');
  assert.match(adapter, /const BONE_INFLUENCE_PASSES = \['ghost-depth', 'ghost', 'hot-depth', 'hot'\];/);
  assert.ok(adapter.includes("if (pass === 'hot-depth') { gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); }"), 'clear() obeys the depth mask');
  assert.match(adapter, /if \(depthOnly\) \{ this\.disable\(this\.BLEND\); this\.colorMask\(false, false, false, false\); this\.depthMask\(true\); \}/);
  assert.match(adapter, /const effectsPass = pass => pass === null \|\| pass === 'blended' \|\| pass === 'hot';/);
});

test('Bone influence is offered in Movement only and explains itself', () => {
  assert.doesNotMatch(label({}), /Bone influence/);
  const movement = label({ boneInfluenceAvailable: true, renderMode: 'influence' });
  assert.match(movement, /<option value="influence" title="Bone influence: the model turns see-through[^"]*" selected="">Bone influence<\/option>/);
  assert.match(movement, new RegExp(`<select aria-label="Render mode" title="${BONE_INFLUENCE_TIP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.doesNotMatch(label({ boneInfluenceAvailable: true }), /<select aria-label="Render mode" title=/);
  assert.match(app, /const boneInfluenceAvailable = mode === 'animation' && animationPanel === 'movement';/);
  // Movement keeps its own mode, Bone influence by default; other editors never get it.
  assert.match(app, /const viewRenderMode = boneInfluenceAvailable \? movementRenderMode : renderMode === 'influence' \? 'wireframe' : renderMode;/);
  assert.match(app, /\[movementRenderMode, setMovementRenderMode\] = useState\('influence'\)/);
  assert.match(app, /movementRenderMode: 'influence', showAllGeosets/);
  assert.equal(app.match(/mode=\{[^}]*cleanView \? 'textured' : viewRenderMode\}/g)?.length, 2, 'both viewports leave Bone influence outside Movement');
});

test('Bone influence keeps the skeleton and hidden vertices drawn through the ghost', () => {
  assert.match(preview, /boneInfluence: latest\.current\.mode === 'influence' \? boneInfluence\(latest\.current\.selectedNodeIds, latest\.current\.preferences\) : null/);
  assert.match(preview, /influenceLook = \{ preferences, opacity: look\.opacity, colors: \{ ghost: srgb\(look\.ghost\), direct: srgb\(look\.direct\), follow: srgb\(look\.follow\) \} \};/);
  assert.match(preview, /wireframeMarkers: p\.mode === 'wireframe' \|\| p\.mode === 'vertices' \|\| p\.mode === 'influence'/);
  assert.match(preview, /showHiddenVertices = p\.mode === 'wireframe' \|\| p\.mode === 'vertices' \|\| p\.mode === 'influence'/);
});

test('F swaps between Textured View and the view last chosen in that editor', async () => {
  const { textureToggleTarget } = await import('../src/display-overlays.js');
  assert.equal(textureToggleTarget('wireframe', 'wireframe'), 'textured');
  assert.equal(textureToggleTarget('influence', 'influence', 'influence'), 'textured');
  assert.equal(textureToggleTarget('textured', 'influence', 'influence'), 'influence');
  assert.equal(textureToggleTarget('textured', 'solid'), 'solid');
  assert.equal(textureToggleTarget('textured', undefined, 'influence'), 'influence');
  assert.equal(textureToggleTarget('textured', undefined), 'wireframe');
  assert.match(app, /if \(effectiveRenderMode !== 'textured'\) untexturedModes\.current\[textureToggleContext\] = effectiveRenderMode;/);
  assert.match(app, /const toggleTextured = \(\) => setViewRenderMode\(textureToggleTarget\(effectiveRenderMode, untexturedModes\.current\[textureToggleContext\], boneInfluenceAvailable \? 'influence' : 'wireframe'\)\);/);
});

test('display switches the user picks survive a restart; untouched ones keep the defaults', async () => {
  const { defaultEditorDisplay, saveEditorDisplay, setEditorDisplay, storedEditorDisplay } = await import('../src/display-overlays.js');
  const store = new Map(), storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.deepEqual(storedEditorDisplay(false, storage), defaultEditorDisplay());
  const picked = setEditorDisplay(setEditorDisplay(defaultEditorDisplay(), 'movement', 'skeleton', true), 'movement', 'bones', false);
  saveEditorDisplay(picked, defaultEditorDisplay(true), storage);
  const restored = storedEditorDisplay(false, storage);
  assert.deepEqual([restored.movement.skeleton, restored.movement.focusedSkeleton, restored.movement.bones, restored.bones.bones], [true, false, false, false]);
  assert.deepEqual(storedEditorDisplay(true, storage), defaultEditorDisplay(true));
  store.set('mdlxl-editor-display', '{"xl":{"movement":{"skeleton":"yes","unknown":true}}}');
  assert.deepEqual(storedEditorDisplay(false, storage), defaultEditorDisplay(), 'only known boolean switches are restored');
  store.set('mdlxl-editor-display', 'not json');
  assert.deepEqual(storedEditorDisplay(false, storage), defaultEditorDisplay());
  assert.deepEqual(storedEditorDisplay(false, { getItem() { throw new Error('blocked'); } }), defaultEditorDisplay());
});
