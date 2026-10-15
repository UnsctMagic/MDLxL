import React, { useEffect, useState } from 'react';

export const NORMALIZER_OPERATIONS = [
  ['sd', 'Rebuild SD'], ['seams', 'Fix seams'], ['smooth', 'Soften edges'],
  ['outward', 'Globe outward'], ['inward', 'Globe inward'],
];
const descriptions = {
  sd: 'Rebuild shading from the surrounding faces, preserving existing hard splits and matching smooth joins.',
  seams: 'Match lighting at touching open edges. Select both sides of the seam. Other normals stay as they are.',
  smooth: 'Rebuild smooth shading across touching split edges below the chosen angle.',
  outward: 'Point selected normals away from the gold centre.',
  inward: 'Point selected normals toward the gold centre.',
};
export default function NormalizerControls({ session, result, error, onChange, onApply, onCancel, onRepair }) {
  const [coordinates, setCoordinates] = useState(() => session.center.map(String));
  useEffect(() => setCoordinates(previous => session.center.map((value, axis) =>
    Number(previous[axis]) === value ? previous[axis] : String(Number(value.toFixed(5))))), [session.center]);
  const globe = session.mode === 'outward' || session.mode === 'inward';
  const invalid = globe && coordinates.some(value => !value.trim() || !Number.isFinite(Number(value)));
  const coordinate = (axis, value) => {
    setCoordinates(previous => previous.map((old, i) => i === axis ? value : old));
    if (value.trim() && Number.isFinite(Number(value))) onChange({ center: session.center.map((old, i) => i === axis ? Number(value) : old) });
  };
  return <section className="normalizer-controls" aria-label="NormalsXL normalizer">
    <div className="normalizer-heading"><b>NormalsXL</b><span>{session.snapshot.count} vertices</span><button aria-label="Close normalizer" title="Discard the preview and close NormalsXL." onClick={onCancel}>×</button></div>
    <label className="normalizer-setting" title="Rebuild SD restores surface lighting while retaining sharp splits. Fix seams matches lighting only at matching open edges. Soften edges deliberately smooths those splits.">Operation <select aria-label="Normal operation" value={session.mode} onChange={event => onChange({ mode: event.target.value })}>{NORMALIZER_OPERATIONS.map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}</select></label>
    <p>{descriptions[session.mode]}</p>
    {(session.mode === 'sd' || session.mode === 'smooth') && <label className="normalizer-setting" title="Equal faces gives each surrounding face the same influence and suits classic SD shading. Corner angle reduces triangulation bias. Triangle area makes larger triangles dominate.">Face weighting <select aria-label="Face weighting" value={session.weighting} onChange={event => onChange({ weighting: event.target.value })}><option value="equal">Equal faces</option><option value="angle">Corner angle</option><option value="area">Triangle area</option></select></label>}
    {(session.mode === 'seams' || session.mode === 'smooth') && <label className="normalizer-strength" title="Only join edges whose surfaces meet below this angle. Lower values keep more corners sharp. Overlapping sheets and different bone bindings stay separate.">Join angle <input aria-label="Join angle" type="range" min="0" max="150" step="5" value={session.creaseAngle} onChange={event => onChange({ creaseAngle: Number(event.target.value) })}/><output>{session.creaseAngle}°</output></label>}
    {globe && <>
      <div className="normalizer-coordinates">{['X','Y','Z'].map((axis, i) => <label key={axis} title={'Globe centre on the ' + axis + ' axis. You can also drag the gold centre in the view.'}>{axis}<input aria-label={'Globe centre ' + axis} type="text" inputMode="decimal" value={coordinates[i]} onChange={event => coordinate(i, event.target.value)} onBlur={() => setCoordinates(session.center.map(v => String(Number(v.toFixed(5)))))} /></label>)}</div>
      <button className="normalizer-fit" title="Place the globe around the selected vertices again. Its radius is a visual guide." onClick={() => onChange({ center: [...session.snapshot.center] })}>Fit globe to selection</button>
    </>}
    <label className="normalizer-strength" title="Blend from the original normals to the chosen result. 100% fully uses the new direction.">Strength <input aria-label="Normal strength" type="range" min="0" max="100" step="1" value={Math.round(session.strength * 100)} onChange={event => onChange({ strength: Number(event.target.value) / 100 })}/><output>{Math.round(session.strength * 100)}%</output></label>
    <div className="normalizer-toggles"><label title="Compare the proposed shading with the original. The model changes only when you Apply."><input type="checkbox" checked={session.preview} onChange={event => onChange({ preview: event.target.checked })}/> Preview changes</label><label title="Show blue direction lines on selected vertices."><input type="checkbox" checked={session.showNormals} onChange={event => onChange({ showNormals: event.target.checked })}/> Show normals</label></div>
    <div className="normalizer-result" role="status">{error || (result?.unresolved ? result.unresolved + ' vertices have no direction; left unchanged.' : session.mode === 'seams' && !result?.joinedVertices ? 'No matching seams in the selection.' : result?.changed ? result.changed + ' normals will change.' : 'No normals will change.')}{!!result?.seamGroups && <span> {result.seamGroups} matching joins.</span>}</div>
    {!!session.snapshot.unshadedCount && <p className="normalizer-material-note">{session.snapshot.unshadedCount === session.snapshot.count ? "The selected material is unshaded. Normals do not change its textured lighting." : session.snapshot.unshadedCount + " selected vertices use unshaded materials."}</p>}
    <div className="normalizer-actions"><button title="Apply the previewed normals as one undoable edit." disabled={invalid || !!error || !result?.changed} onClick={onApply}>Apply</button><button title="Discard this preview." onClick={onCancel}>Cancel</button><button title="Repair triangle facing by picking a correctly facing reference vertex. This may reverse triangles as well as normals." onClick={onRepair}>Repair facing…</button></div>
  </section>;
}
