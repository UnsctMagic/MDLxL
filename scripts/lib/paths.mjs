import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const outDir = (...parts) => path.join(repoRoot, 'out', ...parts);
// Each caller owns and removes the returned staging directory.
export async function tempDir(prefix) {
  const base = path.resolve(process.env.MDLXL_TEMP || outDir('tmp'));
  await fs.mkdir(base, { recursive: true });
  return fs.mkdtemp(path.join(await fs.realpath(base), prefix));
}
