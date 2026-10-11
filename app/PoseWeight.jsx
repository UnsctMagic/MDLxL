import React, { useEffect, useRef, useState } from 'react';
import useMovableWindow from './useMovableWindow.js';
import './pose-controls.css';

function GroundHeight({ value, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => { if (draft.trim() && Number.isFinite(Number(draft))) onChange(Number(draft)); else setDraft(String(value)); };
  return <label className="pose-motion-ground" title="Ground is the editor XY plane at this Z height, in model units. Original kept poses remain unchanged.">Ground height <input aria-label="Motion ground height" type="number" step="any" value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}/></label>;
}

export default function PoseWeight({ weight }) {
  const ref = useRef(null), movable = useMovableWindow(ref), value = weight.state;
  if (!value) return null;
  const interval = Array.from(value.model.Sequences[value.sequence].Interval);
  const setting = (name, amount) => weight.update({ settings: { ...value.settings, [name]: amount }, compare: false });
  return <div ref={ref} style={movable.style} className="pose-setup pose-weight" role="dialog" aria-modal="false" aria-label="POSE Motion" aria-busy={value.pending}>
    <header {...movable.handleProps}><strong>Motion</strong><button aria-label="Close Motion" title="Discard both previews and close" onClick={weight.cancel}>×</button></header>
    <div className="pose-motion-variants" role="group" aria-label="Edit motion variant">
      {['A', 'B'].map(id => <button key={id} aria-pressed={value.editing === id} title={`Adjust variant ${id}; the other variant keeps its own settings`} onClick={() => weight.update({ editing: id, compare: false, right: value.sideBySide && (value.left === id || value.right === id) ? value.right : id })}>Edit {id}</button>)}
      <button title="Copy these settings to the other variant as a starting point" onClick={weight.copy}>Copy {value.editing} → {value.editing === 'A' ? 'B' : 'A'}</button>
    </div>
    <div className="pose-weight-modes" role="group" aria-label="Motion style">
      {[
        ['flow', 'Flow', 'Shape the transitions between your poses with smooth starts and stops'],
        ['swing', 'Swing', 'Build preparation, a quicker strike and a connected recovery'],
        ['step', 'Step', 'Shape the lifted steps and body response while keeping foot contacts'],
      ].map(([id, label, title]) => <button key={id} aria-pressed={value.settings.style === id} title={title} onClick={() => weight.update({ settings: { ...value.settings, style: id, hit: undefined }, compare: false })}>{label}</button>)}
    </div>
    {[
      ['timing', value.settings.style === 'step' ? 'Hang time' : 'Timing', value.settings.style === 'step' ? 'Let the lifted step linger before the landing' : 'Change how the movement accelerates and settles between your poses'],
      ['follow', value.settings.style === 'step' ? 'Foot lift' : 'Follow-through', value.settings.style === 'step' ? 'Give the lifted foot a clearer arc between its planted poses' : 'Let connected parts continue and settle after the main movement'],
      ['body', value.settings.style === 'step' ? 'Landing response' : 'Body response', value.settings.style === 'step' ? 'Let the body absorb each landing while the planted feet stay in place' : 'Let the torso participate in the action, keeping the connected limbs together'],
    ].filter(([key]) => key !== 'follow' || value.settings.style !== 'flow').map(([key, label, title]) => <label key={key} className="pose-weight-amount" title={title}><span>{label}<output>{value.settings[key]}%</output></span><input aria-label={label} title={title} type="range" min="0" max="100" step="1" value={value.settings[key]} onChange={event => setting(key, Number(event.target.value))}/></label>)}
    <div className="pose-weight-preview">
      <button onClick={weight.play} title="Play or pause this motion preview">{weight.playing ? 'Pause' : 'Play'}</button>
      {!value.sideBySide && <button aria-pressed={value.compare} onClick={() => weight.update({ compare: !value.compare })} title="Switch this view between the original animation and the selected variant">Original</button>}
    </div>
    <div className="pose-motion-speed" role="group" aria-label="Motion playback speed"><span>Speed</span>{[25, 50, 100].map(speed => <button key={speed} aria-pressed={weight.speed === speed} title={`Play at ${speed}% of normal speed; this does not change the saved animation`} onClick={() => weight.setSpeed(speed)}>{speed}%</button>)}</div>
    <label className="pose-motion-compare-toggle" title="Compare Original, A or B in two synchronized, rotatable views"><input type="checkbox" aria-label="Side by side" checked={value.sideBySide} onChange={event => weight.update({ sideBySide: event.target.checked })}/>Side by side</label>
    <details className="pose-weight-refine"><summary>{value.settings.style === 'swing' ? 'Poses, hit and feet' : 'Poses and feet'}</summary>
      {value.settings.style === 'swing' && <>
        <label title="Choose which kept pose is the intended strike or landing. The time shown is the actual hit used by Motion.">The hit <select aria-label="Motion hit pose" value={value.result?.impact ?? ''} onChange={event => setting('hit', Number(event.target.value))}>
          {!value.result?.anchors?.length && <option value="">Finding poses…</option>}
          {(value.result?.anchors || []).map(frame => <option key={frame} value={frame}>{frame} ms</option>)}
        </select></label>
        <button onClick={weight.markHit} title="Use the current timeline position as the hit and keep its original pose">Pick hit pose</button>
        {value.settings.hit != null && <button onClick={() => setting('hit', undefined)} title="Let Motion find the hit again">Auto hit</button>}
      </>}
      <label className="pose-motion-compare-toggle" title="Keep feet that are resting on the ground from drifting during body movement"><input type="checkbox" aria-label="Keep planted feet" checked={value.settings.contacts} onChange={event => setting('contacts', event.target.checked)}/>Keep planted feet</label>
      {value.settings.style === 'step' && <GroundHeight value={value.settings.ground ?? 0} onChange={height => setting('ground', height)}/>}
      <p title="These moments retain your original poses while Motion shapes the movement between them">{value.result?.anchors?.length ?? '…'} {value.result?.sparse === false ? 'key poses kept; motion between them can change' : 'poses kept'}</p>
      <div className="pose-motion-anchors" aria-label="Kept poses">{(value.result?.anchors || []).map((frame, index, anchors) => <span key={frame}>
        <button title="Pause and view this kept pose" onClick={() => weight.seek(frame)}>{frame}</button>
        {index > 0 && index < anchors.length - 1 && frame !== value.result?.impact && <button aria-label={`Remove kept pose ${frame}`} title="Allow Motion to reshape this moment" onClick={() => setting('anchors', anchors.filter(value => value !== frame))}>×</button>}
      </span>)}</div>
      <button onClick={weight.keepPose} title="Keep the original pose at the current timeline position">Keep pose at playhead</button>
      {value.settings.anchors && <button onClick={() => setting('anchors', undefined)} title="Let Motion choose the key poses again">Automatic poses</button>}
      <p className="pose-weight-interval">{value.range[0]}–{value.range[1]} ms</p>
      <button disabled={value.range.every((frame, i) => frame === interval[i])} onClick={() => weight.update({ range: interval })} title="Use the full current animation. Shift-drag the timeline before opening Motion to use a portion.">Whole animation</button>
    </details>
    {value.pending && <p role="status">Updating {value.editing}…</p>}
    {value.error && <p role="alert">{value.error}</p>}
    {!value.pending && !value.error && value.result && !value.result.tracks.length && <p role="status">No motion change at these settings.</p>}
    <div className="pose-actions"><button disabled={value.pending || !!value.error || !value.result?.tracks.length} title={`Write variant ${value.editing} as ordinary editable keys in one undoable change`} onClick={weight.commit}>Commit {value.editing}</button><button title="Discard both previews" onClick={weight.cancel}>Cancel</button></div>
  </div>;
}
