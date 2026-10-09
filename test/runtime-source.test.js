import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runtimeSourceFiles } from '../scripts/runtime-source.mjs';

test('portable source closure follows imports, lazy locales and workers while excluding build inputs and comments', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mdlxl-runtime-source-'));
  try {
    const source = {
      'electron/main.cjs': "require('../src/preferences.js'); require('../src/names.json'); // require('../src/retired.js')\n",
      'electron/library-worker.mjs': "import names from '../src/names.json' with {type:'json'}; export default names;",
      'electron/particle-runtime.js': "export * from '../src/model-codec.js';",
      'src/preferences.js': "export {default} from './shared.js'; export const locale=()=>import('./locales/ru.js');",
      'src/shared.js': 'export default 1;',
      'src/locales/ru.js': "import shared from '../shared.js'; export default {shared};",
      'src/names.json': '{}',
      'src/model-codec.js': 'export const unused=1;',
    };
    for (const [file, text] of Object.entries(source)) {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), text);
    }
    const entryFiles = ['main.cjs', 'library-worker.mjs', 'particle-runtime.js'];
    assert.deepEqual(await runtimeSourceFiles(root, entryFiles), ['src/locales/ru.js', 'src/names.json', 'src/preferences.js', 'src/shared.js']);
    await fs.unlink(path.join(root, 'src/shared.js'));
    await assert.rejects(runtimeSourceFiles(root, entryFiles), /Could not resolve/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
