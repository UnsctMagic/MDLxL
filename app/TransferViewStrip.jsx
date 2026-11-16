import React, { useEffect, useRef } from 'react';
import { createFrameCoalescer } from './viewport-performance.js';

// Viewing speeds, in percent of real time (GamePreview's playbackSpeed).
const SPEEDS = [25, 50, 100, 200];

/**
 * The playback strip under one of Transfer's two views: a scrub track with a small reset-view button
 * at its end, Play/Pause, the viewing
 * Speed and the animation the view shows. Each view has its own. Scrubbing only records the newest
 * value per input event; the seek runs once per display frame (docs/ARCHITECTURE.md).
 * `options`: [{ value, label, own }]; `own` labels are the user's text (model animation names).
 */
export default function TransferViewStrip({ name, donor = false, playing, onPlay, playTitle, interval, time, onSeek, speed, onSpeed, value, options, onChange, selectTitle, onReset, disabled = false }) {
  const pending = useRef(null), frame = useRef(null), seek = useRef(onSeek);
  seek.current = onSeek;
  frame.current ||= createFrameCoalescer(() => applyScrub());
  useEffect(() => () => frame.current.cancel(), []);
  const [from, to] = interval || [0, 1];
  const scrubInput = event => {
    pending.current = Number(event.target.value); frame.current.schedule();
  };
  const applyScrub = () => {
    if (pending.current == null) return;
    const next = pending.current; pending.current = null; seek.current(next);
  };
  return <div className="xs-strip" role="group" aria-label={name}>
    {donor
      ? <button type="button" className="xs-play" data-hotkey="transfer:play-donor" data-hotkey-manual data-hotkey-label="Play donor" disabled={disabled} title={playTitle} onClick={onPlay}>{playing ? 'Pause' : 'Play'}</button>
      : <button type="button" className="xs-play" data-hotkey="transfer:play" data-hotkey-absolute disabled={disabled} title={playTitle} onClick={onPlay}>{playing ? 'Pause' : 'Play'}</button>}
    <input className="range-input xs-scrub" type="range" aria-label="Time in this view" title="Time in this animation. Drag to look at a moment." min={from} max={Math.max(from + 1, to)} step={1} value={Math.max(from, Math.min(to, Math.round(time)))} disabled={disabled} onChange={scrubInput} onPointerUp={() => frame.current.flush()}/>
    {donor
      ? <button type="button" className="xs-reset" data-hotkey="transfer:reset-view-donor" data-hotkey-manual data-hotkey-label="Reset donor view" aria-label="Reset donor view" disabled={disabled} title="Fits the model in this view again and turns both views back to the starting angle." onClick={onReset}><span aria-hidden="true">↺</span></button>
      : <button type="button" className="xs-reset" data-hotkey="transfer:reset-view" data-hotkey-manual data-hotkey-label="Reset view" aria-label="Reset view" disabled={disabled} title="Fits the model in this view again and turns both views back to the starting angle." onClick={onReset}><span aria-hidden="true">↺</span></button>}
    <select className="xs-speed" aria-label="Viewing speed" title="Viewing speed only. It does not change the animation." value={speed} disabled={disabled} onChange={event => onSpeed(Number(event.target.value))}>
      {SPEEDS.map(percent => <option key={percent} value={percent} translate="no">{percent}%</option>)}
    </select>
    <select className="xs-animation" aria-label="Animation in this view" title={selectTitle} value={value} disabled={disabled || !options.length} onChange={event => onChange(event.target.value)}>
      {options.map(option => <option key={option.value} value={option.value} translate={option.own ? 'no' : undefined}>{option.label}</option>)}
    </select>
  </div>;
}
