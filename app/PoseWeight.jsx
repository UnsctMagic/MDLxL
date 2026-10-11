import React, { useRef } from 'react';
import { allNodes } from '../src/animation.js';
import useMovableWindow from './useMovableWindow.js';
import './pose-controls.css';

export default function PoseWeight({ weight }) {
  const ref = useRef(null), movable = useMovableWindow(ref), value = weight.state;
  if (!value) return null;
  const names = new Map(allNodes(value.model).map(node => [node.ObjectId, node.Name]));
  const choices = [
    ...value.config.chains.map(chain => ({ target: { kind: 'endpoint', key: chain.key }, label: names.get(chain.end) })),
    ...[...new Set([value.config.body, ...(value.config.nodes || [])])].filter(id => names.has(id)).map(id => ({ target: id === value.config.body ? { kind: 'body' } : { kind: 'node', id }, label: names.get(id) })),
  ];
  const interval = Array.from(value.model.Sequences[value.sequence].Interval);
  const selected = Object.values(value.selection).reduce((sum, ids) => sum + ids.length, 0);
  const setting = (name, amount) => weight.update({ settings: { ...value.settings, [name]: amount }, compare: false });
  const foot = value.config.chains.find(chain => chain.key === value.target?.key)?.kind === 'leg';
  return <div ref={ref} style={movable.style} className="pose-setup pose-weight" role="dialog" aria-modal="false" aria-label="POSE Weight" aria-busy={value.pending}>
    <header {...movable.handleProps}><strong>Weight</strong><button aria-label="Close Weight" title="Discard the preview and close" onClick={weight.cancel}>×</button></header>
    <label className="pose-weight-part" title="The hand, foot or part whose movement receives weight">Part
      <select aria-label="Weight part" value={value.target ? JSON.stringify(value.target) : ''} onChange={event => weight.selectTarget(JSON.parse(event.target.value))}>
        <option value="" disabled>Choose a part…</option>
        {choices.map(choice => <option key={JSON.stringify(choice.target)} value={JSON.stringify(choice.target)}>{choice.label}</option>)}
      </select>
    </label>
    <div className="pose-weight-modes" role="group" aria-label="Weight style">
      <button aria-pressed={value.mode === 'strike'} title="Drag the preparation, accelerate the strike, then recoil and settle" onClick={() => weight.update({ mode: 'strike', settings: { ...value.settings, hit: undefined }, compare: false })}>Swing</button>
      <button aria-pressed={value.mode === 'step'} disabled={!foot} title="Delay the lifted foot, plant it firmly and compress the body without moving the planted feet" onClick={() => weight.update({ mode: 'step', settings: { ...value.settings, hit: undefined }, compare: false })}>Step</button>
    </div>
    {[
      ['drag', value.mode === 'step' ? 'Hang time' : 'Drag', 'Keep the part behind the movement, then let it catch up into the hit'],
      ['recoil', value.mode === 'step' ? 'Stomp' : 'Recoil', 'Add a controlled response after the hit, followed by a smaller settle'],
      ['body', 'Body response', 'Let the connected torso react; for a step, lower the body while retaining the foot contacts'],
    ].map(([key, label, title]) => <label key={key} className="pose-weight-amount" title={title}><span>{label}<output>{value.settings[key]}%</output></span><input aria-label={label} type="range" min="0" max="100" step="1" value={value.settings[key]} onChange={event => setting(key, Number(event.target.value))}/></label>)}
    <div className="pose-weight-preview">
      <button onClick={weight.play} title="Preview the selected portion at the playback speed below">{weight.playing ? 'Pause' : 'Play'}</button>
      <button aria-pressed={value.compare} onClick={() => weight.update({ compare: !value.compare })} title="Switch between the original motion and this preview">Original</button>
    </div>
    <details className="pose-weight-refine"><summary>Adjust hit / selection</summary>
      {value.mode === 'strike' ? <>
        <label title="The strike time. Move it if the automatic choice catches the wrong moment.">Hit <input aria-label="Weight hit frame" type="number" min={value.range[0]} max={value.range[1]} value={value.settings.hit ?? value.result?.impact ?? ''} onChange={event => setting('hit', event.target.value === '' ? undefined : Number(event.target.value))}/> ms</label>
        <button onClick={weight.markHit} title="Use the current timeline position as the hit">Hit at playhead</button>
      </> : <p title="Landing is detected from this foot's lift and descent">Landing: {value.result?.impact ?? '…'} ms</p>}
      <p className="pose-weight-interval">{value.range[0]}–{value.range[1]} ms</p>
      <button disabled={value.range.every((frame, i) => frame === interval[i])} onClick={() => weight.update({ range: interval, settings: { ...value.settings, hit: undefined } })} title="Use the full current animation. Shift-drag the timeline before opening Weight to use a portion.">Whole animation</button>
      <button className="pose-weight-vertices" aria-pressed={value.vertices} title="Choose the carried area by clicking or dragging vertices in Movement; Shift adds vertices" onClick={() => weight.update({ vertices: !value.vertices })}>Pick vertices</button>
      <p>{selected ? `${selected} vertices` : 'Using the attached part'}</p>
      {selected > 0 && <button onClick={() => weight.update({ selection: {}, vertices: false })}>Use attached part</button>}
    </details>
    {value.error && <p role="status">{value.error}</p>}
    <div className="pose-actions"><button disabled={value.pending || !!value.error || !value.result?.tracks.length} title="Keep ordinary editable animation keys as one undoable change" onClick={() => weight.finish()}>Apply</button><button title="Discard this preview" onClick={weight.cancel}>Cancel</button></div>
  </div>;
}
