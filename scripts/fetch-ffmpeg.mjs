// Downloads the pinned FFmpeg build into electron/ffmpeg and verifies every
// binary against electron/ffmpeg/PROVENANCE.json. The license texts, SOURCE.txt
// and PROVENANCE.json stay tracked in git; only the executable and DLLs are
// fetched, because they are large and identical to the reviewed upstream build.
//
// Usage: node scripts/fetch-ffmpeg.mjs [--force]
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repoRoot, tempDir } from './lib/paths.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const run = promisify(execFile);
const target = path.join(repoRoot, 'electron', 'ffmpeg');
const { digest: sha256 } = createRequire(import.meta.url)('../electron/updater.cjs');
const { verifyFFmpegBundle } = createRequire(import.meta.url)('../electron/ffmpeg-verification.cjs');
const force = process.argv.includes('--force');

const provenance = JSON.parse(await fs.readFile(path.join(target, 'PROVENANCE.json'), 'utf8'));
const archive = provenance.binaryArchive;
if (!archive?.url?.startsWith('https://') || !/^[a-f0-9]{64}$/.test(archive.sha256 || '')) throw Error('PROVENANCE.json has no pinned binary archive.');
// Only executables and DLLs come from the archive. Everything else is tracked.
const binaries = Object.keys(provenance.files).filter(name => /\.(?:exe|dll)$/i.test(name)).sort();
if (!binaries.length) throw Error('PROVENANCE.json lists no binaries.');

let verified = false;
if (!force) {
  try { await verifyFFmpegBundle(target); verified = true; }
  catch (error) { console.log('FFmpeg needs fetching: ' + error.message); }
}
if (verified) {
  console.log('FFmpeg ' + provenance.version + ' is already present and verified (' + binaries.length + ' files).');
  process.exit(0);
}

const work = await tempDir('mdlxl-ffmpeg-');
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

  // The shared verifier checks licenses, pinned bytes and runtime capabilities.
  // License/provenance files are tracked here, not taken from the download.
  for (const name of (await fs.readdir(target)).filter(name => !/\.(?:exe|dll)$/i.test(name))) {
    if ((await fs.stat(path.join(target, name))).isFile()) await fs.copyFile(path.join(target, name), path.join(extracted, name));
  }
  await verifyFFmpegBundle(extracted);
  for (const name of binaries) await fs.copyFile(path.join(extracted, name), path.join(target, name));
  console.log(`FFmpeg ${provenance.version} installed and verified (${binaries.length} files): ${binaries.join(', ')}`);
} finally {
  await fs.rm(work, { recursive: true, force: true });
}
