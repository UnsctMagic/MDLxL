import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tempDir } from './helpers/fixtures.cjs';
const { keepCandidateFile, readCandidateFile, removeCandidateFile } = createRequire(import.meta.url)('../electron/ai-candidate-files.cjs');

test('a retained candidate reopens as the verified bytes and cannot cross chats', async t => {
  const folder = tempDir('ai-candidate-');
  await fs.mkdir(folder, { recursive: true });
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const bytes = await fs.readFile(path.join(import.meta.dirname, 'fixtures/ai-real-use/helmet.mdx'));
  const fingerprint = createHash('sha256').update(bytes).digest('hex');
  const snapshot = { bytes, fingerprint, name: 'Helmet.mdx' };
  await keepCandidateFile(folder, 'chat1', snapshot);
  assert.deepEqual(await readCandidateFile(folder, 'chat1', fingerprint), bytes);
  await assert.rejects(readCandidateFile(folder, 'chat2', fingerprint));
  await assert.rejects(keepCandidateFile(folder, 'chat1', { ...snapshot, bytes: bytes.subarray(8) }), /fingerprint/i);
  await assert.rejects(keepCandidateFile(folder, '../escape', snapshot));
  await removeCandidateFile(folder, 'chat1', fingerprint);
  await assert.rejects(readCandidateFile(folder, 'chat1', fingerprint));
});
