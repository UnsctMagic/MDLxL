import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { BufferAttribute, BufferGeometry } from 'three';
import { createDemoDocument } from '../src/editor-document.js';
import { analyzeNormals, planNormalRebuild, applyNormalRebuild } from '../src/normals-rebuild.js';
import { buildForgeMesh, polygonMask } from '../src/forge.js';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('vite'))('esbuild');
const built = await build({ entryPoints: [fileURLToPath(new URL('../app/Inspectors.jsx', import.meta.url))], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', loader: { '.css': 'empty' }, logLevel: 'silent' });
const module = { exports: {} };
const react = { ...React, useState: initial => [initial, () => {}] };
new Function('require', 'module', 'exports', built.outputFiles[0].text)(id => id === 'react' ? react : require(id), module, module.exports);
const Inspector = module.exports.default;
function normalButton(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'button' && node.props.children === 'Recalculate normals') return node;
  return React.Children.toArray(node.props?.children).map(normalButton).find(Boolean);
}

for (const resourceManager of [false, true]) test(`Inspector normals match NormalsXL defaults and undo (resourceManager=${resourceManager})`, () => {
  const doc = createDemoDocument(), index = 1;
  doc.apply('Zero-normal fixture', ['Geosets'], m => { for (const g of m.Geosets) g.Normals.fill(0); });
  const before = structuredClone(doc.model), expected = structuredClone(before);
  const plan = planNormalRebuild(analyzeNormals(expected, { geosets: [index] }));
  assert.equal(plan.settings.smoothingAngle, 90);
  applyNormalRebuild(expected, plan);
  let edits = 0;
  const tree = Inspector({ resourceManager, doc, selection: { kind: 'Geosets', index }, selectedVertices: [0],
    edit(label, sections, operation) {
      assert.equal(label, 'Recalculate normals');
      assert.deepEqual(sections, ['Geosets']);
      edits++;
      return doc.apply(label, sections, operation);
    } });
  const button = normalButton(tree);
  assert.ok(button);
  assert.equal(button.props['data-hotkey'], 'inspectors:action:8');
  button.props.onClick();
  assert.equal(edits, 1);
  assert.deepEqual(doc.model, expected, 'whole selected geoset matches; other model data stays unchanged');
  assert.notDeepEqual(doc.model.Geosets[index].Normals, before.Geosets[index].Normals);
  doc.undo();
  assert.deepEqual(doc.model, before);
  doc.redo();
  assert.deepEqual(doc.model, expected);
});

test('Forge retains area-weighted generated normals rather than NormalsXL unit sums', () => {
  const mask = polygonMask(16, 16, [[1, 1], [14, 2], [10, 14], [2, 10]]);
  const { geosets } = buildForgeMesh({ mask, width: 16, height: 16, size: 16, thickness: 2, detail: 0 });
  for (const g of geosets) {
    // Three.js independently sums the unnormalised face cross products at each indexed vertex.
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(g.Vertices.slice(), 3));
    geometry.setIndex(new BufferAttribute(g.Faces.slice(), 1));
    geometry.computeVertexNormals();
    assert.ok(g.Normals.every((n, i) => Math.abs(n - geometry.attributes.normal.array[i]) < 1e-6));
    geometry.dispose();
  }
  const model = { Geosets: structuredClone(geosets) };
  applyNormalRebuild(model, planNormalRebuild(analyzeNormals(model)));
  assert.ok(geosets.some((g, gi) => g.Normals.some((n, i) => Math.abs(n - model.Geosets[gi].Normals[i]) > 0.01)), 'fixture distinguishes area weighting from NormalsXL');
});
