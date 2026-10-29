import {useWindowHotkeys} from './Hotkeys.jsx';
import React from 'react';
import { SMOOTHING_ANGLE_RANGE } from '../src/normals-rebuild.js';

const count = value => value.toLocaleString('en-US');

/** Result parts are separate strings so each one is translated on its own. */
export function normalizerSummary(stats, flipped = null) {
  const parts = flipped == null ? [] : [count(flipped) + ' triangles flipped'];
  parts.push(stats?.changed ? count(stats.normalsChanged) + ' normals changed' : 'No changes needed.');
  return parts;
}

/** One status-bar sentence, matching a single translated template. */
export function normalizerStatus(stats, facing = false) {
  return facing ? 'NormalsXL: ' + count(stats.trianglesFlipped) + ' triangles flipped' : 'NormalsXL: ' + count(stats.normalsChanged) + ' normals changed';
}

export default function NormalizerControls({ session, plan, error, onChange, onApply, onFixFacing, onCancel }) {
  useWindowHotkeys('normalizer',[{id:'normalizer:close',label:'Close NormalsXL',category:'NormalsXL',keys:['Escape'],allowInInput:true,run:onCancel}]);
  const stats = plan?.stats, [min, max] = SMOOTHING_ANGLE_RANGE;
  const parts = error ? [error] : stats ? normalizerSummary(stats, session.flipped) : [];
  return <section className="normalizer-controls" role="dialog" aria-modal="false" data-hotkey-prefix="normalizer" data-hotkey-scope="normalizer" aria-label="NormalsXL">
    <div className="normalizer-heading"><b>NormalsXL</b>
      <span title={session.scope === 'selection' ? 'Only the selected vertices get new normals; the triangles around them still count. Clear the selection to recalculate the whole visible model.' : 'All visible shaded geosets are recalculated. Select vertices first to change only those.'}>{session.scope === 'selection' ? 'Selected area' : 'Whole model'}</span>
      <button data-hotkey="close" aria-label="Close NormalsXL" title="Discard the preview and close NormalsXL." onClick={onCancel}>×</button></div>
    <label className="normalizer-strength" title="Copies of a vertex at the same spot smooth together when their faces differ by less than this angle; sharper edges stay crisp. A vertex shared by several faces is always smooth.">Smoothing angle <input aria-label="Smoothing angle" type="range" min={min} max={max} step="5" value={session.smoothingAngle} onChange={event => onChange({ smoothingAngle: Number(event.target.value) })}/><output>{session.smoothingAngle}°</output></label>
    <label title="Show a direction line on every vertex. Yellow lines are normals NormalsXL changes; blue lines stay the same."><input type="checkbox" checked={session.showNormals} onChange={event => onChange({ showNormals: event.target.checked })}/> Show normals</label>
    <div className="normalizer-result" role="status">{parts.flatMap((part, i) => i ? [' · ', part] : [part])}</div>
    <div className="normalizer-actions">
      <button title="Apply the previewed result as one undoable edit." disabled={!!error || !stats?.changed} onClick={onApply}>Apply</button>
      <button title="Flip triangles that face the wrong way, as a separate undoable edit. Their normals are recalculated to match." disabled={!!error} onClick={onFixFacing}>Fix facing</button>
      <button title="Discard this preview." onClick={onCancel}>Cancel</button>
    </div>
  </section>;
}
