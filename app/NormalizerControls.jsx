import React from 'react';
import { SMOOTHING_ANGLE_RANGE } from '../src/normals-rebuild.js';

const count = value => value.toLocaleString('en-US');
export const LOOK_TIP = 'Open pieces whose outside could not be worked out. Their facing was left as it was. Click to select them in the view.';

/** The small "need a look" indicator: clicking it selects those pieces' vertices. */
export function LookButton({ count: pieces, onClick }) {
  return <button type="button" className="normalizer-look" title={LOOK_TIP} onClick={onClick}>{pieces === 1 ? '1 piece needs a look' : count(pieces) + ' pieces need a look'}</button>;
}

/** Result parts are separate strings so each one is translated on its own. */
export function normalizerSummary(stats) {
  if (!stats?.changed) return ['No changes needed.'];
  const parts = [count(stats.normalsRebuilt) + ' normals rebuilt'];
  if (stats.verticesSplit) parts.push(count(stats.verticesSplit) + ' vertices split');
  if (stats.trianglesFlipped) parts.push(count(stats.trianglesFlipped) + ' triangles flipped');
  return parts;
}

/** One status-bar sentence, matching a single translated template. */
export function normalizerStatus(stats, facingOnly = false) {
  if (facingOnly) return 'NormalsXL: ' + count(stats.trianglesFlipped) + ' triangles flipped';
  return 'NormalsXL: ' + count(stats.normalsRebuilt) + ' normals rebuilt · ' + count(stats.verticesSplit) + ' vertices split · ' + count(stats.trianglesFlipped) + ' triangles flipped';
}

export default function NormalizerControls({ session, plan, error, onChange, onApply, onFacingOnly, onCancel, onShowLook }) {
  const stats = plan?.stats, [min, max] = SMOOTHING_ANGLE_RANGE;
  const parts = error ? [error] : stats ? normalizerSummary(stats) : [];
  return <section className="normalizer-controls" aria-label="NormalsXL">
    <div className="normalizer-heading"><b>NormalsXL</b>
      <span title={session.scope === 'selection' ? 'Only the triangles touching the selected vertices change. Clear the selection to repair the whole visible model.' : 'All visible shaded geosets are repaired. Select vertices first to change only the triangles touching them.'}>{session.scope === 'selection' ? 'Selected area' : 'Whole model'}</span>
      <button aria-label="Close NormalsXL" title="Discard the preview and close NormalsXL." onClick={onCancel}>×</button></div>
    <label className="normalizer-strength" title="Edges sharper than this angle stay crisp. Softer edges are smoothed.">Smoothing angle <input aria-label="Smoothing angle" type="range" min={min} max={max} step="5" value={session.smoothingAngle} onChange={event => onChange({ smoothingAngle: Number(event.target.value) })}/><output>{session.smoothingAngle}°</output></label>
    <div className="normalizer-toggles">
      <label title="Flips triangles that face the wrong way so the whole piece faces outward."><input type="checkbox" checked={session.fixFacing} onChange={event => onChange({ fixFacing: event.target.checked })}/> Fix facing</label>
      <label title="Show blue direction lines on the vertices."><input type="checkbox" checked={session.showNormals} onChange={event => onChange({ showNormals: event.target.checked })}/> Show normals</label>
    </div>
    <div className="normalizer-result" role="status">{parts.flatMap((part, i) => i ? [' · ', part] : [part])}{!error && !!stats?.piecesNeedLook && <> · <LookButton count={stats.piecesNeedLook} onClick={() => onShowLook(plan.lookSelection)}/></>}</div>
    <div className="normalizer-actions">
      <button title="Apply the previewed result as one undoable edit." disabled={!!error || !stats?.changed} onClick={onApply}>Apply</button>
      <button title="Only flip triangles that face the wrong way and rebuild the normals of their corners, as a separate undoable edit." disabled={!!error} onClick={onFacingOnly}>Fix facing only</button>
      <button title="Discard this preview." onClick={onCancel}>Cancel</button>
    </div>
  </section>;
}
