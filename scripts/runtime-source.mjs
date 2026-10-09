import path from 'node:path';
import { build } from 'esbuild';

// These two source entry points are compiled into dist by vite.config.js.
// Electron loads the resulting bundles, which already contain their codecs.
export const BUILD_ONLY_ELECTRON_FILES = ['optimizexl-validation.js', 'particle-runtime.js'];

export async function runtimeSourceFiles(root, electronFiles) {
  const entryPoints = electronFiles.filter(file => /\.[cm]?js$/.test(file) && !BUILD_ONLY_ELECTRON_FILES.includes(file.replaceAll(path.sep, '/'))).map(file => path.join('electron', file));
  const result = await build({
    absWorkingDir: root, entryPoints, outdir: 'runtime-closure',
    bundle: true, write: false, metafile: true, platform: 'node',
    packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'already-bundled-runtime', setup(builder) {
      builder.onResolve({ filter: /^\.\.\/dist\// }, args => ({ path: args.path, external: true }));
    } }],
  });
  // esbuild distinguishes require() from JSON imports with attributes in its
  // metafile keys; both refer to the same physical source file.
  return [...new Set(Object.keys(result.metafile.inputs).map(file => file.replace(/ with \{.*\}$/, '').replaceAll(path.sep, '/')).filter(file => file.startsWith('src/')))].sort();
}
