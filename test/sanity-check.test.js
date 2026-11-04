import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { sanityTest } from './helpers/hive.mjs';
import { openDocument, validateModel } from '../src/editor-document.js';
import { generateCompatibleMdx } from '../src/mdx-compatibility.js';
import { checkSanity } from '../src/sanity-check.js';
import { createStarterDocument } from '../src/starter-model.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
const require = createRequire(import.meta.url);
const { fixturePath } = require('./helpers/fixtures.cjs');
const hive = async bytes => { const r = sanityTest(bytes); return { ...r, findings: flattenHiveFindings(r.nodes) }; };
const privateModelPath = fixturePath('optimizexl-review');
const model = () => openDocument(fs.readFileSync(privateModelPath), 'flail.mdx').model;
const expected = m => hive(new Uint8Array(generateCompatibleMdx(m)));

test('Sanity Check returns only Hive findings for real geometry with MDLxL-only warnings', { skip: !fs.existsSync(privateModelPath) && 'private flail model not on this machine' }, async () => {
 const m = model(), before = structuredClone(m);
 assert.ok(validateModel(m).some(f => f.code === 'DEGENERATE_FACES'), 'fixture exercises the reported repeated-vertex warning');
 const result = await checkSanity(m, hive);
 assert.equal(Object.hasOwn(result, 'structural'), false, 'Sanity Check must not include MDLxL structural findings');
 assert.deepEqual(result.hive, await expected(m));
 assert.deepEqual(m, before, 'checking leaves authored model data unchanged');
});

test('Hive checks current unsaved data even when MDLxL validation would reject it', async () => {
 const m = createStarterDocument().model;
 m.Geosets[0].MaterialID = 123456;
 const result = await checkSanity(m, hive);
 assert.ok(result.hive, 'MDLxL structural validation must not prevent Hive from running');
 assert.deepEqual(result.hive, await expected(m));
 assert.ok(result.hive.errors > 0, 'the invalid material is still reported by Hive');
 assert.equal(result.status, 'Review findings');
});

test('source diagnostics do not change Hive results or checker status', async () => {
 const m = createStarterDocument().model, clean = await checkSanity(m, hive);
 for (const diagnostic of [
  { severity: 'error', code: 'BAD_CHUNK', message: 'Truncated source' },
  { severity: 'info', code: 'OPAQUE_DATA_PRESERVED', message: 'Unknown chunk' },
  { severity: 'error', code: 'HD_VIEW_ONLY', message: 'Saving is disabled in view-only mode.' },
 ]) assert.deepEqual(await checkSanity(m, hive, [diagnostic]), clean);
 m.GlobalSequences = [0];
 assert.deepEqual((await checkSanity(m, hive)).hive, await expected(m), 'zero-duration globals use Hive severity and wording');
});

test('unsupported comparison formats and failed Hive execution cannot claim a complete pass', async () => {
 const m = createStarterDocument().model; m.Version = 1000;
 const modern = await checkSanity(m, hive);
 assert.equal(modern.status, 'Check partially completed');
 assert.equal(modern.hive, null);
 assert.doesNotMatch(modern.limitation, /Structural checks/);
 m.Version = 800;
 const failed = await checkSanity(m, async () => { throw Error('unavailable'); });
 assert.match(failed.limitation, /unavailable/);
 assert.equal(failed.status, 'Check partially completed');
});

test('native Help menu dispatches Sanity Check', () => {
 const { buildMenuTemplate } = require('../electron/menu.cjs'); let action;
 buildMenuTemplate({}, id => action = id).find(x => x.label === 'Help').submenu.find(x => x.label === 'Sanity Check').click();
 assert.equal(action, 'sanityCheck');
});
