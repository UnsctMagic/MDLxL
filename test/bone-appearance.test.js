import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Quaternion, Vector3 } from 'three';
import { BONE_STYLES, BONE_CONNECTORS, DEFAULT_BONE_APPEARANCE, DEFAULT_BONE_INFLUENCE, normalizeViewportAppearance, BUILT_IN_VIEWPORT_PRESETS } from '../src/viewport-appearance.js';
import { normalizePreferences } from '../src/preferences.js';
import { boneDisplayColor, boneDisplayOptions, drawBoneLink, BONE_DIAMOND } from '../app/bone-display.js';
import { markerStyle, rigMarkerGeometry } from '../app/rig-markers-gl.js';
import { createPixelLineBatch } from '../app/pixel-lines.js';

const settings = readFileSync(new URL('../app/Settings.jsx', import.meta.url), 'utf8');
const prefsWith = bones => normalizePreferences({ viewportAppearance: { ...BUILT_IN_VIEWPORT_PRESETS['mdlvis-vanilla'].appearance, bones: { ...DEFAULT_BONE_APPEARANCE, ...bones } } });

test('bone, wire and Bone influence appearance normalise to safe values and classic defaults', () => {
  const plain = normalizeViewportAppearance({});
  assert.deepEqual(plain.bones, DEFAULT_BONE_APPEARANCE);
  assert.equal(plain.wireMode, 'all');
  assert.deepEqual(plain.boneInfluence, DEFAULT_BONE_INFLUENCE);
  const odd = normalizeViewportAppearance({ bones: { style: 'octahedral', connector: 'tapered', bone: 'green', thickness: 40 }, wireMode: 'depth', boneInfluence: { opacity: 2, direct: '#123456' } });
  assert.deepEqual([odd.bones.style, odd.bones.connector, odd.bones.bone, odd.bones.thickness], ['cubes', 'tapered', '#4cff59', 12]);
  assert.equal(odd.wireMode, 'all');
  assert.deepEqual([odd.boneInfluence.opacity, odd.boneInfluence.direct, odd.boneInfluence.ghost], [.95, '#123456', '#a9b6c1']);
  assert.equal(normalizeViewportAppearance({ wireMode: 'hidden-line' }).wireMode, 'hidden-line');
});

test('bone markers follow the chosen style and the user colours, keeping highlight meaning', () => {
  const byId = new Map([[0, { overlayKind: 'bones', node: { ObjectId: 0 } }]]);
  const root = { overlayKind: 'bones', node: { ObjectId: 0 } }, child = { overlayKind: 'bones', node: { ObjectId: 1, Parent: 0 } };
  const classic = prefsWith({});
  assert.equal(markerStyle(child, byId, classic).color, '#4cff59');
  assert.equal(markerStyle(root, byId, classic).color, '#4cb259');
  assert.equal(markerStyle({ ...child, helperNode: true }, byId, prefsWith({ style: 'diamond' })).shape, BONE_DIAMOND);
  assert.equal(markerStyle(child, byId, classic).shape.faces.length, 6, 'Cubes keeps the cube');
  const joint = prefsWith({ style: 'diamond', bone: '#112233', selected: '#00ffff' });
  assert.equal(markerStyle(child, byId, joint).shape, BONE_DIAMOND);
  assert.equal(markerStyle(child, byId, joint).color, '#112233');
  assert.equal(markerStyle(child, byId, joint, new Map([[1, '#ff0000']])).color, '#00ffff');
  assert.equal(boneDisplayColor(DEFAULT_BONE_APPEARANCE, '#ffff00', true), '#ffff00');
  assert.equal(boneDisplayOptions(joint), boneDisplayOptions(joint), 'normalised once per preferences object');
});

test('diamond faces point outward and selection keeps its flat highlight', () => {
  const shape = BONE_DIAMOND;
  for (const face of shape.faces) {
    const [a, b, c] = face.slice(0, 3).map(i => new Vector3(...shape.vertices[i]));
    const normal = b.clone().sub(a).cross(c.clone().sub(a)), centre = face.reduce((sum, i) => sum.add(new Vector3(...shape.vertices[i])), new Vector3());
    assert.ok(normal.dot(centre) > 0);
  }
  const point = { visible: true, overlayKind: 'bones', node: { ObjectId: 1 }, world: new Vector3(), rotation: new Quaternion(), unitsPerPixel: 1 };
  const flat = rigMarkerGeometry([point], [1], { bones: true, preferences: prefsWith({ style: 'diamond', selected: '#00ff00' }) });
  const colors = new Set(); for (let i = 3; i < flat.triangles.length; i += 6) colors.add(flat.triangles.slice(i, i + 3).join(','));
  assert.equal(colors.size, 1, 'a selected diamond stays flat in the chosen colour');
});

function recordingContext() {
  const calls = [];
  const context = { canvas: { width: 200, height: 200 }, calls, save() {}, restore() {}, setTransform() {}, beginPath() { calls.push('path'); }, moveTo(...p) { calls.push(['moveTo', ...p]); }, lineTo(...p) { calls.push(['lineTo', ...p]); }, closePath() {},
    fill() { calls.push(['fill', this.fillStyle]); }, stroke() { calls.push(['stroke', this.strokeStyle]); }, fillRect(...r) { calls.push(['rect', this.fillStyle, ...r]); }, createLinearGradient() { return { stops: [], addColorStop(at, color) { this.stops.push([at, color]); } }; } };
  return context;
}

test('connectors draw shaded, tapered or as cones, and the chain highlight keeps that shape', () => {
  const from = { x: 20, y: 20 }, to = { x: 120, y: 20 };
  const shaded = recordingContext(); drawBoneLink(shaded, from, to, { bones: DEFAULT_BONE_APPEARANCE });
  assert.ok(shaded.calls.every(call => call[0] === 'rect') && shaded.calls.length > 50, 'shaded stays a pixel line');
  assert.equal(shaded.calls[0][4], 3, '3 px classic width');
  const tapered = recordingContext(); drawBoneLink(tapered, from, to, { bones: { ...DEFAULT_BONE_APPEARANCE, connector: 'tapered' } });
  const corners = tapered.calls.filter(call => call[0] === 'moveTo' || call[0] === 'lineTo');
  assert.equal(corners.length, 4); assert.ok(Math.abs(corners[0][2] - 20) > Math.abs(corners[1][2] - 20), 'wide at the parent, narrow at the child');
  assert.equal(typeof tapered.calls.find(call => call[0] === 'fill')[1], 'object', 'ordinary links keep the dark-to-light shading');
  const highlighted = recordingContext(); drawBoneLink(highlighted, from, to, { bones: { ...DEFAULT_BONE_APPEARANCE, connector: 'tapered', child: '#abcdef' }, highlight: '#ffff00' });
  assert.deepEqual(highlighted.calls.find(call => call[0] === 'fill'), ['fill', '#abcdef']);
  const cone = recordingContext(); drawBoneLink(cone, from, to, { bones: { ...DEFAULT_BONE_APPEARANCE, connector: 'cone' } });
  assert.ok(cone.calls.some(call => call[0] === 'stroke'), 'Cone outlines its link');
  const stick = recordingContext(); drawBoneLink(stick, from, to, { bones: { ...DEFAULT_BONE_APPEARANCE, connector: 'stick' } });
  assert.equal(stick.calls[0][4], 6, 'Stick bars are twice as thick');
});

test('skeleton links and bone/helper geometry remain independent in every combination', () => {
  assert.deepEqual(BONE_STYLES, ['cubes', 'diamond']);
  const point = { visible: true, overlayKind: 'bones', node: { ObjectId: 1 }, world: new Vector3(), rotation: new Quaternion(), unitsPerPixel: 1 };
  for (const connector of BONE_CONNECTORS) {
    const links = BONE_STYLES.map(style => {
      const context = recordingContext();
      drawBoneLink(context, { x: 20, y: 20 }, { x: 120, y: 20 }, { bones: prefsWith({ style, connector }).viewportAppearance.bones });
      return context.calls;
    });
    assert.equal(JSON.stringify(links[0]), JSON.stringify(links[1]), connector + ' ignores marker style');
  }
  for (const style of BONE_STYLES) for (const helperNode of [false, true]) {
    const node = { ...point, helperNode };
    const geometry = BONE_CONNECTORS.map(connector => rigMarkerGeometry([node], [], { bones: true, preferences: prefsWith({ style, connector }) }));
    for (const candidate of geometry.slice(1)) assert.deepEqual(candidate, geometry[0], style + ' ignores skeleton style');
  }
});

test('old round marker styles become cubes while keeping cone/stick skeleton links', () => {
  for (const [style, connector] of [['joint', 'cone'], ['stick', 'stick']]) {
    const prefs = prefsWith({ style, connector: 'tapered', helper: '#123456' });
    assert.equal(prefs.viewportAppearance.bones.style, 'cubes');
    assert.equal(prefs.viewportAppearance.bones.connector, connector);
    assert.equal(prefs.viewportAppearance.bones.helper, '#123456');
    assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))), prefs);
  }
  const prefs = prefsWith({ style: 'diamond', connector: 'cone' });
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))), prefs);
});

test('Hidden-line dashes only the hidden stretch of a wire', () => {
  const data = new Uint8ClampedArray(200 * 40 * 4);
  const context = { canvas: { width: 200, height: 40 }, createImageData: () => ({ data }), putImageData() {} };
  const batch = createPixelLineBatch(context);
  batch.draw({ x: 0, y: 10, z: 0 }, { x: 199, y: 10, z: 0 }, { color: '#ffffff', depth: { isOccluded: p => p.x > 100 }, hiddenDash: [4, 3] });
  const lit = x => data[(10 * 200 + x) * 4 + 3] > 0;
  const front = Array.from({ length: 90 }, (_, x) => lit(x + 5)), back = Array.from({ length: 80 }, (_, x) => lit(x + 115));
  assert.ok(front.every(Boolean), 'visible part solid');
  assert.ok(back.some(Boolean) && !back.every(Boolean), 'hidden part dashed');
});

test('Appearance shows one page at a time, with Bones & skeleton and Bone influence pages', () => {
  assert.match(settings, /export const APPEARANCE_PAGES = Object\.freeze\(\['Presets', 'Interface', 'Viewport', 'Wires', 'Vertices', 'Bones & skeleton', 'Bone influence', 'Controllers', 'Lists & folders', 'Quadview', 'Editor helpers', 'Citadel Paint'\]\);/);
  assert.match(settings, /if \(page && \(APPEARANCE_PAGE_OF\[title\] \|\| title\) !== page\) return null;/);
  assert.doesNotMatch(settings, /<details className="settings-appearance-section"/);
  for (const label of ['aria-label="Bone style"', 'aria-label="Skeleton style"', 'aria-label="Wire style"', 'label="Ghost opacity"', 'label="Chain highlight thickness"']) assert.ok(settings.includes(label), label);
  assert.match(settings, /title=\{BONE_STYLE_TIP\}/); assert.match(settings, /title=\{BONE_CONNECTOR_TIP\}/); assert.match(settings, /title=\{WIRE_MODE_TIP\}/);
  assert.ok(!settings.includes("['occludedOpacity', 'Hidden wire intensity'"), 'Hidden wire intensity moved to Wires');
});


test('each appearance owns distinct green, purple and pink markers and custom colours round trip', () => {
  const colors = [];
  for (const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)) {
    const { bones, selectedVertex, unselectedVertex } = preset.appearance;
    const ordinary = [bones.bone, bones.root, bones.helper, bones.ref];
    assert.equal(new Set(ordinary).size, ordinary.length, preset.name);
    for (const c of ordinary) assert.ok(![selectedVertex.color, unselectedVertex.color].includes(c), preset.name + ' differs from vertices');
    const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const [r,g,b] = rgb(bones.bone); assert.ok(g > r && g > b, preset.name + ' green bones');
    const [hr,hg,hb] = rgb(bones.helper); assert.ok(hb > hr && hr > hg, preset.name + ' purple helpers');
    const [rr,rg,rb] = rgb(bones.ref); assert.ok(rr > rb && rb > rg, preset.name + ' pink refs');
    colors.push(bones.helper + bones.ref);
    const missing = structuredClone(preset.appearance); delete missing.bones.helper; delete missing.bones.ref;
    const migrated = normalizePreferences({ rendererRevision: 3, theme: preset.theme, viewportPreset: preset.id, viewportAppearance: missing });
    assert.equal(migrated.viewportAppearance.bones.helper, bones.helper);
    assert.equal(migrated.viewportAppearance.bones.ref, bones.ref);
  }
  assert.equal(new Set(colors).size, 7);
  const appearance = structuredClone(BUILT_IN_VIEWPORT_PRESETS['blender-style'].appearance);
  appearance.bones.helper = '#c144ff'; appearance.bones.ref = '#ff22aa';
  const prefs = normalizePreferences({ rendererRevision: 3, theme: 'dark', viewportAppearance: appearance,
    viewportPresets: [{ id: 'custom-rig', name: 'My rig colors', theme: 'dark', appearance }] });
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))), prefs);
  const helper = { node: { ObjectId: 0 }, overlayKind: 'bones', helperNode: true };
  const ref = { node: { ObjectId: 1 }, overlayKind: 'attachments' };
  assert.equal(markerStyle(helper, new Map(), prefs).color, '#c144ff');
  assert.equal(markerStyle(ref, new Map(), prefs).color, '#ff22aa');
  assert.equal(markerStyle(ref, new Map(), prefs, new Map([[1, '#ff0000']])).color, appearance.bones.selected);
});
