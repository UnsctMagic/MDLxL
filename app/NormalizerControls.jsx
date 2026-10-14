import React, { useEffect, useState } from 'react';

export default function NormalizerControls({ session, result, error, onChange, onApply, onCancel, onRepair }) {
  const [coordinates, setCoordinates] = useState(() => session.center.map(String));
  useEffect(() => setCoordinates(previous => session.center.map((value, axis) =>
    Number(previous[axis]) === value ? previous[axis] : String(Number(value.toFixed(5))))), [session.center]);
  const invalid = coordinates.some(value => !value.trim() || !Number.isFinite(Number(value)));
  const coordinate = (axis, value) => {
    setCoordinates(previous => previous.map((old, i) => i === axis ? value : old));
    if (value.trim() && Number.isFinite(Number(value))) onChange({ center: session.center.map((old, i) => i === axis ? Number(value) : old) });
  };
  const surface = session.mode === 'surface';
  return <section className="normalizer-controls" aria-label="NormalsXL normalizer">
    <div className="normalizer-heading"><b>NormalsXL</b><span>{session.snapshot.count} vertices</span><button aria-label="Close normalizer" title="Discard the preview and close NormalsXL." onClick={onCancel}>×</button></div>
    <div className="normalizer-modes">
      <button aria-pressed={session.mode === 'outward'} title="Point selected normals away from the globe centre." onClick={() => onChange({ mode: 'outward' })}>Outward</button>
      <button aria-pressed={session.mode === 'inward'} title="Point selected normals toward the globe centre." onClick={() => onChange({ mode: 'inward' })}>Inward</button>
      <button aria-pressed={surface} title="Rebuild selected normals from their surrounding triangles. Uses the current triangle facing." onClick={() => onChange({ mode: 'surface' })}>From surface</button>
    </div>
    {!surface && <>
      <div className="normalizer-coordinates">
        {['X','Y','Z'].map((axis, i) => <label key={axis} title={'Globe centre on the ' + axis + ' axis. You can also drag the gold centre in the view.'}>{axis}<input aria-label={'Globe centre ' + axis} type="text" inputMode="decimal" value={coordinates[i]} onChange={event => coordinate(i, event.target.value)} onBlur={() => setCoordinates(session.center.map(v => String(Number(v.toFixed(5)))))} /></label>)}
      </div>
      <button className="normalizer-fit" title="Place the globe around the selected vertices again. Its centre controls direction; its radius is only a visual guide." onClick={() => onChange({ center: [...session.snapshot.center] })}>Fit globe to selection</button>
    </>}
    <label className="normalizer-strength" title="Blend from the original normals to the chosen direction. 100% fully uses the new direction.">Strength <input aria-label="Normal strength" type="range" min="0" max="100" step="1" value={Math.round(session.strength * 100)} onChange={event => onChange({ strength: Number(event.target.value) / 100 })}/><output>{Math.round(session.strength * 100)}%</output></label>
    <label title="See the proposed normals without changing the model. Turn this off to compare the original."><input type="checkbox" checked={session.preview} onChange={event => onChange({ preview: event.target.checked })}/> Preview changes</label>
    <p>{surface ? 'Uses triangle facing; split vertices stay separate.' : 'Drag the gold centre. Blue lines show selected normals.'} Rest pose.</p>
    <div className="normalizer-result" role="status">{error || (result?.unresolved ? result.unresolved + ' vertices have no direction; left unchanged.' : result?.changed ? result.changed + ' normals will change.' : 'No normals will change.')}</div>
    <div className="normalizer-actions"><button title="Write the previewed normals. Undo restores them in one step." disabled={invalid || !!error || !result?.changed} onClick={onApply}>Apply</button><button title="Discard this preview." onClick={onCancel}>Cancel</button><button title="Use the original reference-pick repair. This may reverse triangles as well as normals." onClick={onRepair}>Repair facing…</button></div>
  </section>;
}
