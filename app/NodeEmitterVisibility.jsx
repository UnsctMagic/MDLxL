import React from 'react';
import { SelectField } from './Fields.jsx';
import { globalSequenceId } from '../src/animation.js';
import { readAnimationTrack, setAnimationKey, deleteAnimationKey } from '../src/animation-tracks.js';

// Emitter visibility keys in the Nodes manager, laid out like event tracks:
// frame buttons seek, then show/hide at the current frame or remove its key.
export default function NodeEmitterVisibility({ node, model, edit, frame, onSeek, sequenceIndex, onSequenceChange }) {
  const target = { kind: 'node', id: node.ObjectId, property: 'Visibility' }, track = readAnimationTrack(model, target);
  const keyed = Array.isArray(track?.Keys), global = keyed ? globalSequenceId(track) ?? -1 : -1;
  const duration = global >= 0 ? model.GlobalSequences?.[global] : 0, interval = model.Sequences?.[sequenceIndex]?.Interval;
  const at = global >= 0 && duration > 0 ? frame % duration : frame;
  const keys = keyed ? track.Keys.filter(key => global >= 0 || !interval || key.Frame >= interval[0] && key.Frame <= interval[1]) : [];
  const hasKey = keys.some(key => key.Frame === at);
  const outside = global < 0 && (!interval || frame < interval[0] || frame > interval[1]);
  const set = value => edit(value ? 'Show emitter' : 'Hide emitter', ['Nodes'], current => setAnimationKey(current, [target], frame, value, sequenceIndex));
  return <div className="re-event-editor">
    {global < 0 && <SelectField label="Preview animation" value={sequenceIndex} options={model.Sequences.map((seq, value) => ({ value, label: seq.Name }))} onChange={v => onSequenceChange(Number(v))}/>}
    <div className="re-event-frames"><span title="Frames where this emitter turns on or off. Click a frame to jump to it.">Visibility{global >= 0 ? ` · global sequence ${global + 1}` : ''}</span>
      <div>{keys.map(key => <button key={key.Frame} aria-label={`Visibility key ${key.Frame}`} onClick={() => onSeek(key.Frame)}>{key.Frame} · {key.Vector?.[0] > 0 ? 'On' : 'Off'}</button>)}</div>
      <button disabled={outside} title="Turn this emitter on from the current frame." onClick={() => set(1)}>Show at {at}</button>
      <button disabled={outside} title="Turn this emitter off from the current frame." onClick={() => set(0)}>Hide at {at}</button>
      <button disabled={!hasKey} onClick={() => edit('Remove visibility key', ['Nodes'], current => deleteAnimationKey(current, [target], frame, sequenceIndex))}>Remove</button>
    </div>
  </div>;
}
