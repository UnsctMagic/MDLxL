// Reach and discoverability of the AI's editor functions (stream R of docs/agent-tasks/ai-full-power.md):
// every module is in an area, every on-screen name finds its engine, and the one-call wrappers give the
// same result as the window's own code path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { AI_AREAS, aiExportNames, areasForRequest, searchAiCapabilities } from '../src/ai-capabilities.js';
import { guidesForRequest } from '../src/ai-tools.js';
import { SCREEN_NAMES, screenEntryFor, findScreenNames } from '../src/ai-screen-names.js';
import { MESH_ACTIONS, GEOSET_ACTIONS, CUT_ACTION, applyMeshAction, applyGeosetAction, applyCut, remapGeosetSet } from '../src/mesh-actions.js';
import { openDocument } from '../src/editor-document.js';
import { separateGeosetsByLoosePart, deleteFreeVertices, nuclearWeldVertices } from '../src/geoset-operations.js';
import { runOptimizeStage, simpleSettings } from '../src/optimizexl.js';
import { optimizeModelStage, planToSize, modelBytes, applyOptimized } from '../src/optimizexl-run.js';
import { flipUVs, unwrapUVs, fitUVsToRegion, packUVIslands, uvRegionOfPixels } from '../src/uv-actions.js';
import { runForgeVertexTool, addForgeVertexShape } from '../src/forge-vertex-run.js';
import { vertexForgeDraft, vertexForgeFaces, vertexForgeResult } from '../src/forge-vertex.js';
import { forgeSelectionNormal, extrudeForgeFaces } from '../src/forge-shape-editing.js';
import { ANIMXL_PRESETS, ANIMXL_PRESET_KEYS } from '../src/anim-xl.js';

const require = createRequire(import.meta.url);
const { fixturePath } = require('./helpers/fixtures.cjs');
const srcDir = new URL('../src/', import.meta.url);
const sources = Object.fromEntries(fs.readdirSync(srcDir).filter(name => name.endsWith('.js') && name !== 'cli.js').map(name => [name.slice(0, -3), fs.readFileSync(new URL(name, srcDir), 'utf8')]));
const footmanPath = fixturePath('citadel-footman'), missing = !footmanPath || !fs.existsSync(footmanPath);
const footman = () => openDocument(fs.readFileSync(footmanPath), 'Footman.mdx');
const allOf = g => Array.from({ length: g.Vertices.length / 3 }, (_, i) => i);

test('every module the audits found missing is in an area, and the new areas exist', () => {
  const wanted = ['edge-cut', 'forge-vertex', 'sanity-check', 'model-extents', 'model-collisions', 'mesh-clipboard', 'model-import', 'plain-track-values',
    'optimizexl-geometry', 'motion-path', 'auto-corpse', 'corpse-geometry', 'attachemator', 'bone-namer', 'rig-names', 'uv-unwrap', 'uv-grid', 'team-colors',
    'uv-material-compositor', 'ribbon-sweeps', 'particle-world-effects', 'emitter-timing', 'event-object-codec', 'preview-lighting',
    ...Object.keys(sources).filter(name => /^(global-animation|fx)-/.test(name))];
  const inAreas = new Set(AI_AREAS.flatMap(area => area.modules));
  for (const name of wanted) {
    assert.ok(sources[name] && aiExportNames(sources[name]).length, name + ' exists and exports');
    assert.ok(inAreas.has(name), name + ' is in an area');
  }
  assert.ok(AI_AREAS.find(area => area.id === 'fx') && AI_AREAS.find(area => area.id === 'lifecycle'));
  for (const area of AI_AREAS) assert.ok(area.description.length < 200, area.id + ' description stays short');
});

test('request words reach the new areas and guides', () => {
  assert.deepEqual(areasForRequest('make a corpse that decays after the death animation'), ['lifecycle', 'animation']);
  assert.ok(areasForRequest('run the Sanity Check and get the file under 200 KB').includes('inspection'));
  assert.ok(areasForRequest('import this clipboard polygon').includes('mesh'));
  assert.ok(areasForRequest('add a tattoo FX to the surface').includes('fx'));
  for (const text of ['get this under 500 KB', 'too many bytes', 'reduce the polygon count'])
    assert.ok(guidesForRequest(text).length, text);
  assert.ok(guidesForRequest('get this under 500 KB').includes('WC3-EDITING-OPTIMIZATION.md'));
  assert.ok(guidesForRequest('the corpse needs a decay animation').includes('WC3-EDITING-GAME-INTEGRATION.md'));
});

// ---- On-screen names -------------------------------------------------------------------------------------
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function screenLabels() {
  const labels = [];
  for (const m of read('app/UVWorkspace.jsx').matchAll(/<Tool\b[^>]*?\blabel="([^"]+)"/g)) labels.push(['UV Wrapper tool', m[1]]);
  const toolbar = read('app/AppToolbar.jsx'), dock = toolbar.split('\n').find(line => line.includes('const moduleDock'));
  for (const m of dock.matchAll(/\btitle="([^"]+)"/g)) labels.push(['toolbar module icon', m[1]]);
  const menus = toolbar.split('\n').find(line => line.includes("['Modules', ["));
  for (const group of ['Modules', 'Managers', 'Help']) {
    const from = menus.indexOf(`['${group}', [`), to = menus.indexOf(']]', from);
    for (const m of menus.slice(from, to + 2).matchAll(/\['([^']+)',\s*'([^']+)'\]/g)) labels.push(['menu ' + group, m[1]]);
  }
  const sidebar = read('app/AppSidebar.jsx'), tools = sidebar.slice(sidebar.indexOf('className="classic-tools"'), sidebar.indexOf('UV-maps</button>'));
  for (const m of tools.matchAll(/toolButton\('[^']*', '[^']*', '([^']*)'/g)) labels.push(['sidebar button', m[1]]);
  for (const m of tools.matchAll(/\btitle="([^"]+)"/g)) labels.push(['sidebar button', m[1]]);
  const geosetOps = read('app/App.jsx').split('\n').find(line => line.includes('classic-geoset-operations'));
  for (const m of geosetOps.matchAll(/>([A-Za-z][A-Za-z ]+)<\/button>/g)) labels.push(['geoset operation', m[1]]);
  return labels;
}
test('every window, icon, menu entry and button label of the walked UI maps to an engine entry', () => {
  const labels = screenLabels();
  assert.ok(labels.length > 60, 'the walk found the UI: ' + labels.length);
  const unmapped = labels.filter(([, label]) => !screenEntryFor(label)).map(([where, label]) => where + ': ' + label);
  assert.deepEqual(unmapped, [], 'add these names to SCREEN_NAMES in src/ai-screen-names.js');
  // The names the owner uses for what he sees.
  for (const name of ['Sanity Check', 'NormalsXL', 'OptimizeXL', 'Cut', 'Separate', 'Merge Similar', 'Nuclear Weld', 'Delete free vertices', 'AnimXL', 'Auto Corpse', 'Attachemator', 'Bone Namer', 'FX', 'Forge', 'Citadel Paint', 'Team Color Overlay', 'New base coat'])
    assert.ok(screenEntryFor(name), name);
});
test('every engine named in the table is a real export and every command id is one the editor runs', () => {
  const commands = new Set([...MESH_ACTIONS, ...Object.keys(GEOSET_ACTIONS), CUT_ACTION, 'vertices', 'bones', 'uv', 'animation']);
  for (const entry of SCREEN_NAMES) {
    for (const engine of entry.engines) {
      const [module, name] = engine.split('.');
      assert.ok(sources[module], engine + ': no such module');
      assert.ok(aiExportNames(sources[module]).includes(name), engine + ': not exported');
    }
    if (entry.hidden) assert.ok(commands.has(entry.command), entry.names[0] + ' command ' + entry.command);
    assert.ok(entry.engines.length || entry.use, entry.names[0] + ' says what to do');
  }
});
test('the capabilities search answers an on-screen name with its engine', () => {
  const found = searchAiCapabilities(sources, { query: 'nuclear weld' }).screen;
  assert.equal(found[0].command, 'Nuclear Weld');
  assert.deepEqual(found[0].engines, ['geoset-operations.nuclearWeldVertices']);
  assert.ok(searchAiCapabilities(sources, { query: 'OptimizeXL' }).screen[0].engines.includes('optimizexl-run.planToSize'));
  assert.equal(searchAiCapabilities(sources, { query: 'detach' }).screen[0].command, 'Detach');
  assert.deepEqual(findScreenNames('zzzz'), []);
});

// ---- Wrappers ------------------------------------------------------------------------------------------------
const same = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a, (_, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))), JSON.parse(JSON.stringify(b, (_, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v))));

test('OptimizeXL stage wrapper gives the window path\'s bytes; plan-to-size reports steps and leaves the model alone', { skip: missing }, () => {
  const doc = footman(), model = doc.model, before = structuredClone(model);
  const out = optimizeModelStage(model, 'animation', { strength: 50 });
  // The window's own path: serialize the document, run the stage with simpleSettings.
  const bytes = doc.serialize('mdx'), direct = runOptimizeStage(bytes, 'animation', simpleSettings('animation', 50, openDocument(bytes, 'working.mdx').model));
  assert.deepEqual(out.report.bytes, direct.bytes);
  assert.deepEqual(out.settings, simpleSettings('animation', 50, openDocument(bytes, 'working.mdx').model));
  same(model, before);
  const target = modelBytes(model) - 3000, plan = planToSize(model, { targetBytes: target });
  assert.equal(plan.startBytes, modelBytes(model));
  assert.ok(plan.reached && plan.endBytes <= target && plan.steps.length && plan.steps.every(step => step.saved > 0));
  same(model, before);
  const copy = structuredClone(model);
  applyOptimized(copy, plan.candidate);
  assert.equal(modelBytes(copy), plan.endBytes);
  assert.throws(() => optimizeModelStage(model, 'nope'), /Unknown OptimizeXL stage/);
});

test('UV wrappers: flip, unwrap commit with corner splits, fit into a region, pack islands', { skip: missing }, () => {
  const model = footman().model, gi = model.Geosets.findIndex(g => g.Faces.length > 30), geoset = model.Geosets[gi], all = allOf(geoset);
  const uv0 = Array.from(geoset.TVertices[0]);
  // Mirror by X: the same arithmetic as the UV Wrapper (centre minus offset), twice is the original.
  const flip = flipUVs(model, { [gi]: all }, 'u');
  assert.equal(flip.count, all.length);
  const after = geoset.TVertices[0];
  for (const i of all) { assert.ok(Math.abs(after[i * 2] - (2 * flip.centre[0] - uv0[i * 2])) < 1e-5); assert.equal(after[i * 2 + 1], uv0[i * 2 + 1]); }
  flipUVs(model, { [gi]: all }, 'u');
  for (const i of all) assert.ok(Math.abs(geoset.TVertices[0][i * 2] - uv0[i * 2]) < 1e-5);
  flipUVs(model, { [gi]: all }, 'v');
  assert.throws(() => flipUVs(model, {}, 'u'), /Mark UV points/);
  // Fit into a pixel region of a 256 texture.
  const region = uvRegionOfPixels({ x: 128, y: 0, width: 64, height: 64 }, 256, 256);
  fitUVsToRegion(model, { [gi]: all }, region);
  let lo = [9, 9], hi = [-9, -9];
  for (const i of all) for (let a = 0; a < 2; a++) { lo[a] = Math.min(lo[a], geoset.TVertices[0][i * 2 + a]); hi[a] = Math.max(hi[a], geoset.TVertices[0][i * 2 + a]); }
  assert.ok(Math.abs(lo[0] - .5) < 1e-5 && Math.abs(hi[0] - .75) < 1e-5 && Math.abs(lo[1]) < 1e-5 && Math.abs(hi[1] - .25) < 1e-5, JSON.stringify([lo, hi]));
  // Pack islands: all of them end inside the region, same scale, none of the triangles' islands overlap each other's boxes.
  const packed = packUVIslands(model, { [gi]: all }, { region: { u0: 0, v0: 0, u1: .5, v1: .5 } });
  assert.ok(packed.islands >= 1);
  for (const v of geoset.TVertices[0]) assert.ok(v >= -1e-6 && v <= .5 + 1e-6, 'inside the region: ' + v);
  // Unwrap commits through corner splits and keeps every corner's 3D position.
  const copy = structuredClone(model.Geosets[gi]), vertexPositions = g => Array.from(g.Faces, face => Array.from(g.Vertices.subarray(face * 3, face * 3 + 3)).join());
  const marked = allOf(copy);
  const result = unwrapUVs({ ...model, Geosets: [copy] }, { 0: marked }, 'unwrap');
  assert.deepEqual(vertexPositions(copy), vertexPositions(model.Geosets[gi]));
  assert.equal(copy.TVertices[0].length, copy.Vertices.length / 3 * 2);
  assert.ok(result.created[0].length > 0, 'unwrapping made point copies for the seams');
  assert.ok(packed.islands > 1);
});

test('Forge vertex wrapper equals the window\'s Extrude path; Add shape appends geometry', { skip: missing }, () => {
  const make = () => footman().model;
  const model = make();
  let gi = 0, selection = {};
  // Six vertices that make complete faces: the first two triangles of a geoset.
  gi = model.Geosets.findIndex(g => g.Faces.length >= 6);
  const faces = Array.from(model.Geosets[gi].Faces.slice(0, 3)); selection = { [gi]: faces };
  const window = make();
  // What ForgeVertexTools does for Extrude with a distance.
  const before = vertexForgeFaces(vertexForgeDraft(window, selection));
  const next = { ...before, shapes: before.shapes.map(s => before.selection[s.id].length ? extrudeForgeFaces(s, before.selection[s.id], forgeSelectionNormal([s], before.selection).map(n => n * 5)) : s) };
  const expected = vertexForgeResult(window, before, next);
  const out = runForgeVertexTool(model, selection, 'Extrude', { distance: 5 });
  same(model.Geosets, expected.Geosets);
  same(out.selection, expected.forgeSelection);
  assert.throws(() => runForgeVertexTool(model, selection, 'Nope'), /Unknown Forge tool/);
  const count = model.Geosets[gi].Vertices.length;
  const added = addForgeVertexShape(model, gi, { shape: 'Cube', width: 20, height: 20, depth: 20 }, [], [0, 0, 0]);
  assert.ok(model.Geosets[gi].Vertices.length > count && added.selection[gi].length);
});

test('mesh tool options: Extrude distance, Mirror pivot and Rotate normals angle', { skip: missing }, () => {
  const run = (name, options) => {
    const model = footman().model, g = model.Geosets[0], marked = { 0: allOf(g).slice(0, 12) };
    applyMeshAction(model, name, marked, options);
    return model.Geosets[0];
  };
  const base = run('Extrude', {}), far = run('Extrude', { distance: 50 }), none = footman().model.Geosets[0];
  assert.deepEqual(Array.from(run('Extrude', { distance: 10 }).Vertices), Array.from(base.Vertices), 'the default stays 10');
  assert.notDeepEqual(Array.from(far.Vertices), Array.from(base.Vertices));
  assert.ok(base.Vertices.length >= none.Vertices.length);
  const mirrored = run('Mirror', { pivot: [100, 100, 100] }), centred = run('Mirror', {});
  assert.notDeepEqual(Array.from(mirrored.Vertices), Array.from(centred.Vertices));
  const turned = run('Rotate normals', { normalAngle: 45 }), turnedDefault = run('Rotate normals', {});
  assert.notDeepEqual(Array.from(turned.Normals), Array.from(turnedDefault.Normals));
});

test('geoset operations: the shared function matches the editor\'s own model code and carries the selection along', { skip: missing }, () => {
  const make = () => footman().model;
  // Separate by loose parts
  let model = make(), expected = make();
  const marked = Object.fromEntries(model.Geosets.map((g, i) => [i, allOf(g)]).filter(([i]) => i < 2));
  const state = { selection: marked, selectable: new Set(model.Geosets.map((_, i) => i)), activeGeoset: 0 };
  const direct = separateGeosetsByLoosePart(expected, marked), shown = applyGeosetAction(model, 'Separate by loose parts', state);
  same(model.Geosets, expected.Geosets);
  same(shown.result, direct);
  assert.ok([...shown.selectable].includes(direct.geosetIndices[0]));
  // Delete free vertices: one extra point no triangle uses, marked by the user as well.
  const withFree = () => {
    const model = make(), g = model.Geosets[0], n = g.Vertices.length / 3, grow = (data, stride) => { const out = new data.constructor(data.length + stride); out.set(data); return out; };
    g.Vertices = grow(g.Vertices, 3); g.Normals = grow(g.Normals, 3); g.VertexGroup = grow(g.VertexGroup, 1); g.TVertices = g.TVertices.map(uv => grow(uv, 2));
    return { model, n };
  };
  { const { model: free, n } = withFree(), { model: reference } = withFree();
    const removed = deleteFreeVertices(reference, new Set([0, 1, 2])), got = applyGeosetAction(free, 'Delete free vertices', { selection: { 0: [0, n] }, selectable: new Set([0, 1, 2]), activeGeoset: 1 });
    assert.equal(removed.removedVertices, 1);
    same(free.Geosets, reference.Geosets);
    assert.deepEqual([...got.selectable], [0, 1, 2]);
    assert.deepEqual(got.selection, { 0: [0] }, 'the marked free point is gone, the other mark stays');
    assert.equal(got.activeGeoset, 1);
    assert.throws(() => applyGeosetAction(make(), 'Delete free vertices', { selection: {}, selectable: new Set([0, 1, 2]), activeGeoset: 0 }), /No free vertices/); }
  // Nuclear Weld
  model = make(); expected = make();
  const weldMarked = { 0: allOf(model.Geosets[0]) }, welded = nuclearWeldVertices(expected, weldMarked);
  assert.ok(welded.welded > 0);
  applyGeosetAction(model, 'Nuclear Weld', { selection: weldMarked, selectable: new Set([0]), activeGeoset: 0 });
  same(model.Geosets, expected.Geosets);
  assert.throws(() => applyGeosetAction(make(), 'Nope', { selection: {}, selectable: new Set(), activeGeoset: 0 }), /Unknown geoset operation/);
});

test('Cut splits a triangle through the shared function', { skip: missing }, () => {
  const model = footman().model, g = model.Geosets[0], [a, b, c] = g.Faces, before = g.Vertices.length / 3;
  const shown = applyCut(model, { geosetIndex: 0, start: a, a: b, b: c, t: .5 });
  assert.equal(shown.geosetIndex, 0);
  assert.ok(model.Geosets[0].Vertices.length / 3 > before && shown.selection.length >= 1);
});

test('AnimXL presets live in src and keep the window\'s quick-start buttons', () => {
  assert.deepEqual(ANIMXL_PRESETS.map(([name]) => name), ['Default', 'Heavy', 'Agile', 'Relaxed', 'Fall']);
  assert.ok(ANIMXL_PRESET_KEYS.includes('collapseStyle'));
  assert.match(read('app/AnimXL.jsx'), /const PRESETS = ANIMXL_PRESETS;/);
});
