import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { checkSanity } from '../src/sanity-check.js';
import { sanityForAi } from '../src/ai-sanity.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
import { sanityTest } from './helpers/hive.mjs';
import { AI_TOOLS } from '../src/ai-tools.js';
import { validateArguments } from '../electron/ai-mcp.cjs';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const file = fixturePath('citadel-footman');
const skip = !fs.existsSync(file) && 'test model not on this machine';
// The dialog's checker, loaded in Node the same way the app loads it in the window.
const hive = async bytes => { const result = sanityTest(bytes); return { ...result, findings: flattenHiveFindings(result.nodes) }; };

test('the AI gets the Sanity Check findings the Help menu shows, and a planted unused texture appears', { skip }, async () => {
  const doc = openDocument(fs.readFileSync(file), 'Footman.mdx');
  const plain = sanityForAi(await checkSanity(doc.model, hive));
  assert.equal(plain.version, 800);
  assert.ok(plain.counts && plain.status, JSON.stringify(plain));
  assert.equal(plain.findings.length, Math.min(200, plain.total)); assert.equal(plain.truncated, plain.total > 200);
  doc.apply('Unused texture', ['Textures'], () => doc.model.Textures.push({ Image: 'Textures\\Unused.blp', ReplaceableId: 0, Flags: 0 }));
  const planted = sanityForAi(await checkSanity(doc.model, hive));
  assert.equal(planted.total, plain.total + 1); assert.equal(planted.counts.unused, plain.counts.unused + 1);
  assert.ok(planted.findings.some(f => f.type === 'unused' && f.path === '/Texture 3 - \"Unused.blp\"'), JSON.stringify(planted.findings.filter(f => /Texture/.test(f.path))));
  const order = planted.findings.map(f => ({ error: 0, severe: 1, warning: 2, unused: 3 })[f.type] ?? 4);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'errors and severe first');
  const schema = AI_TOOLS.find(t => t.name === 'mdlxl_document').inputSchema;
  for (const action of ['health', 'sanity', 'validate']) validateArguments(schema, { target: 't', action });
});

test('a version 1000 model gets the checker limitation instead of findings', { skip }, async () => {
  const doc = openDocument(fs.readFileSync(file), 'Footman.mdx'), model = structuredClone(doc.model);
  model.Version = 1000;
  const result = sanityForAi(await checkSanity(model, hive));
  assert.match(result.limitation, /version 800 only/); assert.equal(result.total, 0);
});
