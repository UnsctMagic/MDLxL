import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { serializeCollectedPart } from '../src/bits-and-parts.js';
import { prepareOptimizeXL } from '../src/optimizexl.js';
import { buildPaintExportArtifact, buildPaintProjectArtifact } from '../src/paint-export.js';
import { createPaintRaster } from '../src/paint-raster.js';
import { addPaintProjectTarget, createPaintProject } from '../src/paint-project.js';
import { enumeratePaintTargets, installFreshPaintLayer } from '../src/paint-targets.js';

function modelWithLoss() {
  const bytes = fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url));
  const doc = openDocument(bytes, 'knight.mdx');
  // Stand in for an unsupported field on a supported record. The real writer
  // drops it and the real reopen comparison names the difference.
  doc.apply('Set field without a writer', ['Info'], model => { model.Info.UnwrittenTestField = 23; });
  return doc;
}

test('OptimizeXL rejects a source whose serialization changes fields', () => {
  assert.throws(() => prepareOptimizeXL(modelWithLoss()), /Save verification failed: .*UnwrittenTestField/);
});

test('Collect Bit rejects a part whose serialization changes fields', () => {
  assert.throws(() => serializeCollectedPart(modelWithLoss().model), /Save verification failed: .*UnwrittenTestField/);
});

function paintWithLoss() {
  const doc = createDemoDocument();
  doc.apply('Paint material', ['Materials', 'Textures'], model => installFreshPaintLayer(model, 0, 'Primer.blp'));
  const project = createPaintProject({ sourceMode: 'primer' });
  const target = enumeratePaintTargets(doc.model).find(item => item.texturePath === 'Primer.blp');
  addPaintProjectTarget(project, target, createPaintRaster(256, 256, [100, 90, 80, 255]));
  doc.apply('Set field without a writer', ['Info'], model => { model.Info.UnwrittenTestField = 23; });
  return { doc, project };
}

test('Paint project refuses a changed working model that cannot round-trip', async () => {
  const { doc, project } = paintWithLoss();
  await assert.rejects(buildPaintProjectArtifact(doc, project, new Map()), /Save verification failed: .*UnwrittenTestField/);
});

test('Paint export refuses a changed model that cannot round-trip', async () => {
  const { doc, project } = paintWithLoss();
  await assert.rejects(buildPaintExportArtifact(doc, project, new Map()), /Save verification failed: .*UnwrittenTestField/);
});
