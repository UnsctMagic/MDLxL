import { measureEditingCandidate } from '../src/ai-editing-procedures.js';
import { measureRigCandidate } from '../src/ai-rig-checks.js';

// Shared by normal review and read-only named-version comparison. These
// app-owned checks supplement (never replace) the request-specific checksCode.
export async function measureNativeCandidate({ before, candidate, specifications, rigBefore, originalBytes }, signal) {
  const reports = [], checks = [], worstPoses = [];
  for (const specification of specifications) {
    const { name, editing, rig } = specification;
    if (!name || (!editing && !rig)) throw Error('A native check needs a name and editing or rig options.');
    const report = { name };
    if (editing) {
      let options = editing;
      if (editing.optimization?.measureBytes) {
        if (!(originalBytes instanceof Uint8Array) || !originalBytes.length) throw Error('Native saved-byte verification needs trusted source MDX bytes from the document.');
        options = { ...editing, optimization: { ...editing.optimization, sourceBytes: new Uint8Array(originalBytes) } };
      }
      report.editing = await measureEditingCandidate(before, candidate, options);
      if (editing.selection) {
        const unmatched = Object.keys(editing.selection).map(Number).filter(geoset => {
          const original = rigBefore.Geosets?.[geoset], current = before.Geosets?.[geoset];
          return !original || !current || original.Vertices.length !== current.Vertices.length || JSON.stringify(Array.from(original.Faces)) !== JSON.stringify(Array.from(current.Faces));
        });
        checks.push({ name: name + ': original selection correspondence', passed: !unmatched.length, actual: unmatched.map(geoset => geoset + 1), expected: 'Original selected vertex IDs retain matching topology; otherwise re-resolve the region or leave it unverified.' });
      }
      checks.push(...report.editing.checks.map(check => ({ ...check, name: name + ': ' + check.name })));
      worstPoses.push(...report.editing.worstPoses.map(pose => ({ ...pose, name })));
    }
    if (rig) {
      if (!rig.rigidParts?.length && !rig.flexibleParts?.length && rig.limits?.bounds === undefined) throw Error('Native rig checks need declared rigid or flexible part roles, or an explicit bounds limit.');
      report.rig = await measureRigCandidate(rigBefore, candidate, rig, signal);
      const measured = report.rig, limits = rig.limits || {};
      const add = (label, passed, actual, expected) => checks.push({ name: name + ': ' + label, passed, actual, expected });
      add('rig correspondence', !measured.changedTopology.length && !measured.missingClips.length && !measured.affectedCameraDependentNodes.length,
        { changedTopology: measured.changedTopology, missingClips: measured.missingClips, affectedCameraDependentNodes: measured.affectedCameraDependentNodes }, 'Matching topology, clips and camera-independent skinning.');
      const metric = (row, property, label, fallback, part) => {
        const value = row[property], limit = limits[property] ?? fallback;
        if (limit === undefined) return;
        if (!Number.isFinite(limit) || limit < 0) throw Error('Native rig limits must be finite nonnegative values.');
        const passed = Number.isFinite(value?.normalized) && value.samples > 0 && !!value.worst && !row.unmeasured?.length && value.normalized <= limit;
        add(`geoset ${row.geosetId}: ${label}`, passed, { ...value, unmeasured: row.unmeasured }, limit);
        if (value?.worst) worstPoses.push({ ...value.worst, name, metric: label, baseline: 'original', ...(part?.vertices ? { partVertices: part.vertices } : {}), distance: value.normalized });
      };
      if (rig.rigidParts?.length && measured.rigidParts.length !== rig.rigidParts.length)
        add('rigid parts measured', false, measured.rigidParts.length, rig.rigidParts.length);
      for (const [index, row] of measured.rigidParts.entries()) {
        metric(row, 'shape', 'rigid shape', 0.00001, rig.rigidParts[index]);
        metric(row, 'attachment', 'driver attachment', 0.00001, rig.rigidParts[index]);
      }
      for (const [index, row] of measured.flexibleParts.entries()) {
        add(`geoset ${row.geosetId}: flexible evidence`, !row.unmeasured?.length && (row.edgeStrain.samples > 0 || row.seamOpening.samples > 0), { edgeSamples: row.edgeStrain.samples, seamSamples: row.seamOpening.samples, unmeasured: row.unmeasured }, 'At least one measured flexible edge or seam.');
        metric(row, 'edgeStrain', 'edge strain', undefined, rig.flexibleParts[index]);
        metric(row, 'seamOpening', 'seam opening', undefined, rig.flexibleParts[index]);
      }
      if (limits.bounds !== undefined) {
        if (!Number.isFinite(limits.bounds) || limits.bounds < 0) throw Error('Native bounds limit must be finite and nonnegative.');
        add('animated bounds', !measured.bounds.missing.length && measured.bounds.boxes.length > 0 && measured.bounds.boxes.every(row => row.measuredVertices > 0 && Number.isFinite(row.normalized) && row.normalized <= limits.bounds), measured.bounds, limits.bounds);
      }
    }
    reports.push(report);
  }
  worstPoses.sort((a, b) => (b.distance || 0) - (a.distance || 0));
  return { checks, reports, worstPoses };
}
