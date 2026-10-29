// Loads the vendored Hive (mdx-m3-viewer) build once for Node tests and scripts, so a vendor update changes one path.
import fs from 'node:fs';
import vm from 'node:vm';

export const HIVE_VIEWER = new URL('../../public/vendor/hive-viewer-5.12.0.js', import.meta.url);

// Returns the global ModelViewer, running the vendored script in this context the first time.
export function loadHiveViewer() {
  if (!globalThis.ModelViewer) vm.runInThisContext(fs.readFileSync(HIVE_VIEWER, 'utf8'), { filename: 'hive-viewer.js' });
  return globalThis.ModelViewer;
}

// Hive's sanity test of MDX bytes: { errors, severe, warnings, unused, nodes }.
export function sanityTest(bytes) {
  const viewer = loadHiveViewer(), model = new viewer.parsers.mdlx.Model();
  model.load(bytes.slice().buffer);
  return viewer.utils.mdlx.sanityTest(model);
}
