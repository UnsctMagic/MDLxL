import { generateCompatibleMdx } from './mdx-compatibility.js';

// Sanity Check reports the bundled Hive checker's results without editor diagnostics.
export async function checkSanity(model, hive) {
  const snapshot = structuredClone(model);
  const report = { hive: null, limitation: '', version: snapshot.Version };
  if (snapshot.Version !== 800) {
    report.limitation = 'The bundled mdx-m3-viewer checker supports this comparison for classic version 800 only.';
  } else {
    try { report.hive = await hive(new Uint8Array(generateCompatibleMdx(snapshot))); }
    catch (error) { report.limitation = `mdx-m3-viewer comparison could not complete: ${error.message}`; }
  }
  report.status = report.limitation ? 'Check partially completed' : report.hive?.findings?.length ? 'Review findings' : 'No issues found by these checks';
  return report;
}
