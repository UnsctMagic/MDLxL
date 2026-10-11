// Downloads the pinned FFmpeg build into electron/ffmpeg and verifies every
// binary against electron/ffmpeg/PROVENANCE.json. The license texts, SOURCE.txt
// and PROVENANCE.json stay tracked in git; only the executable and DLLs are
// fetched, because they are large and identical to the reviewed upstream build.
//
// Usage: node scripts/fetch-ffmpeg.mjs [--force]
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'electron', 'ffmpeg');
const force = process.argv.includes('--force');
const sha256 = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');

const provenance = JSON.parse(await fs.readFile(path.join(target, 'PROVENANCE.json'), 'utf8'));
const archive = provenance.binaryArchive;
if (!archive?.url?.startsWith('https://') || !/^[a-f0-9]{64}$/.test(archive.sha256 || '')) throw Error('PROVENANCE.json has no pinned binary archive.');
// Only executables and DLLs come from the archive. Everything else is tracked.
const binaries = Object.keys(provenance.files).filter(name => /\.(?:exe|dll)$/i.test(name)).sort();
if (!binaries.length) throw Error('PROVENANCE.json lists no binaries.');

async function matches(name) {
  try { return await sha256(path.join(target, name)) === provenance.files[name]; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

if (!force && (await Promise.all(binaries.map(matches))).every(Boolean)) {
  console.log(`FFmpeg ${provenance.version} is already present and verified (${binaries.length} files).`);
  process.exit(0);
}

const work = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'mdlxl-ffmpeg-'));
try {
  console.log(`Downloading ${archive.url}`);
  const response = await fetch(archive.url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw Error(`Download failed: HTTP ${response.status}`);
  const file = path.join(work, 'ffmpeg.tar.gz');
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  const actual = await sha256(file);
  if (actual !== archive.sha256) throw Error(`The FFmpeg archive does not match the pinned hash.\n  expected ${archive.sha256}\n  actual   ${actual}`);

  // Extract only the named binaries. The system tar (bsdtar on Windows 10+) runs
  // from the work folder with relative names so drive letters are not an issue.
  const extracted = path.join(work, 'extracted');
  await fs.mkdir(extracted);
  await run('tar', ['-xzf', path.relative(extracted, file), ...binaries], { cwd: extracted });

  // Verify every file before replacing anything in the destination.
  for (const name of binaries) {
    const hash = await sha256(path.join(extracted, name));
    if (hash !== provenance.files[name]) throw Error(`${name} does not match PROVENANCE.json.\n  expected ${provenance.files[name]}\n  actual   ${hash}`);
  }
  for (const name of binaries) await fs.copyFile(path.join(extracted, name), path.join(target, name));
  console.log(`FFmpeg ${provenance.version} installed and verified (${binaries.length} files): ${binaries.join(', ')}`);
} finally {
  await fs.rm(work, { recursive: true, force: true });
}
