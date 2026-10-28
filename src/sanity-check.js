import { validateModel } from './editor-document.js';
import { generateCompatibleMdx } from './mdx-compatibility.js';

// The bundled mdx-m3-viewer engine predates modern MDX versions. Its results are kept
// verbatim as advisory evidence, separate from the current editor's validator.
export async function checkSanity(model, hive, sourceDiagnostics = []) {
  const snapshot = structuredClone(model);
  const diagnostics = [...sourceDiagnostics, ...validateModel(snapshot)];
  const unique = [...new Map(diagnostics.map(f => [JSON.stringify([f.code, f.path, f.message]), f])).values()];
  const structural = unique.map(f => {
    // Zero durations occur in shipped Blizzard portraits and effects. Preserve
    // the finding as a review warning; negative/non-integer durations stay errors.
    const index = f.path?.match(/^GlobalSequences\[(\d+)\]$/)?.[1];
    if (f.code === 'GLOBAL_SEQUENCE_DURATION' && snapshot.GlobalSequences?.[index] === 0)
      return { ...f, severity: 'warning', message: 'Zero-duration global sequence; also occurs in Blizzard assets. Review whether any tracks use it.' };
    return f;
  });
  for (const [index, event] of (snapshot.EventObjects || []).entries()) {
    if (!event.EventTrack?.length) structural.push({ severity: 'error', code: 'EMPTY_EVENT_TRACK', path: `EventObjects[${index}]`, message: 'Event object has no timestamps. Empty event tracks can prevent Warcraft III from loading a model.' });
  }
  const report = { structural, hive: null, limitation: '', version: snapshot.Version };
  if (structural.some(f => f.severity === 'error')) {
    report.limitation = 'mdx-m3-viewer comparison was skipped because structural errors prevent a reliable serialized comparison.';
  } else if (structural.some(f => f.code === 'OPAQUE_DATA_PRESERVED')) {
    report.limitation = 'Unrecognized source data is preserved but cannot be fully checked.';
  } else if (snapshot.Version !== 800) {
    report.limitation = 'The bundled mdx-m3-viewer checker supports this comparison for classic version 800 only. Structural checks ran; modern format compatibility needs testing in Warcraft III.';
  } else {
    try { report.hive = await hive(new Uint8Array(generateCompatibleMdx(snapshot))); }
    catch (error) { report.limitation = `mdx-m3-viewer comparison could not complete: ${error.message}`; }
  }
  report.errors = structural.filter(f => f.severity === 'error').length;
  report.warnings = structural.filter(f => f.severity === 'warning').length;
  report.status = report.errors ? 'Structural errors found' : report.limitation ? 'Check partially completed' : report.warnings || report.hive?.findings?.length ? 'Review findings' : 'No issues found by these checks';
  return report;
}

// Display list positions as one-based, while preserving actual node ObjectIds.
export function sanityLocation(path = '') {
  return path.replace(/\b(Geoset|Material|Sequence|Global sequence) (\d+)\b/g, (_, kind, index) => `${kind} ${Number(index) + 1}`)
    .replace(/\b(Geosets|Materials|Textures|Sequences|GlobalSequences|TextureAnims|GeosetAnims|Layers|TVertices|EventObjects)\[(\d+)\]/g, (_, kind, index) => `${kind} ${Number(index) + 1}`);
}

