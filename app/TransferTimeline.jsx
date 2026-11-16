import React, { useEffect, useRef } from 'react';
import { createFrameCoalescer } from './viewport-performance.js';
import { useMousePressLost, useWindowKeyClaim } from './Hotkeys.jsx';

const DELAY_MAX = 2000, SPEED = [0.25, 3];
const rulerStep = length => [100, 250, 500, 1000, 2000, 5000, 10000].find(step => length / step <= 8) || 20000;

/**
 * Transfer's clip timeline under the stage: the time, a ruler to scrub, the body animation
 * lane (its loops drawn as repeats) and one lane per taken source animation. A clip dragged
 * sideways changes Delay, by its right edge Speed; Ease ramps sit at its ends; moment fixes are
 * diamonds. Pointer events only record; the work runs once per display frame
 * (docs/ARCHITECTURE.md "Only do work someone can see"). Times are result ms, 0..length.
 * `dimmed`: the result view shows another animation; any press on the timeline first calls `onUse`
 * (which brings the view back to the new animation) and then works as usual.
 */
export default function TransferTimeline({ length, time, onSeek, bodyLane, lanes, selectedLanes = [], onLaneSelect, onLaneChange, onFixSelect, onFixDelete, readout, dimmed = false, onUse }) {
  const track = useRef(null), drag = useRef(null), apply = useRef(null), frame = useRef(null);
  frame.current ||= createFrameCoalescer(() => apply.current());
  useEffect(() => () => frame.current.cancel(), []);
  const span = Math.max(1, length), pct = t => `${Math.max(0, Math.min(100, t / span * 100))}%`, widthPct = (a, b) => `${Math.max(0, (Math.min(b, span) - Math.max(a, 0)) / span * 100)}%`;
  const timeAt = (clientX, box) => Math.max(0, Math.min(span, (clientX - box.left) / Math.max(1, box.width) * span));
  const cancel = () => { const d = drag.current; drag.current = null; frame.current.cancel(); if (d?.lane) onLaneChange(d.lane, null, false); };
  useWindowKeyClaim(({ event }) => { if (event.key !== 'Escape' || !drag.current) return false; cancel(); return true; }, 0);
  useMousePressLost(() => { if (drag.current) cancel(); });

  // Scrub: the ruler and the empty lane space.
  const seekDown = event => {
    if (event.button !== 0) return;
    const box = track.current.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { seek: true, box, x: event.clientX }; frame.current.schedule();
  };
  // A clip: the body moves it (Delay), the right edge stretches it (Speed).
  const clipDown = (event, lane) => {
    if (event.button !== 0 || !lane.editable) return;
    event.stopPropagation();
    const box = track.current.getBoundingClientRect(), clip = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { lane, box, origin: event.clientX, x: event.clientX, edge: clip.right - event.clientX <= 6, start: lane.start, span: lane.span, value: null };
    onLaneSelect(lane);
  };
  function move(event) {
    const d = drag.current;
    if (!d) return;
    d.x = event.clientX; frame.current.schedule();
  }
  function applyMove() {
    const d = drag.current;
    if (!d) return;
    if (d.seek) { onSeek(timeAt(d.x, d.box)); return; }
    const dt = (d.x - d.origin) / Math.max(1, d.box.width) * span;
    d.value = d.edge
      ? { speed: Math.round(Math.max(SPEED[0], Math.min(SPEED[1], d.lane.span * d.lane.speed / Math.max(10, d.span + dt))) * 100) / 100 }
      : { start: Math.round(Math.max(0, Math.min(DELAY_MAX, d.start + dt)) / 10) * 10 };
    onLaneChange(d.lane, d.value, true);
  }
  apply.current = applyMove;
  const up = () => {
    frame.current.flush();
    const d = drag.current; drag.current = null;
    if (d?.lane) onLaneChange(d.lane, d.value, false);
  };
  const ticks = [];
  // No tick crammed against the right end, where its number would be cut.
  for (let t = 0, step = rulerStep(span); t <= span - step * 0.35; t += step) ticks.push(t);
  const laneRow = (lane, body) => {
    const selected = !body && selectedLanes.includes(lane.id);
    // Keyed by its parts, not by Delay and Speed, so a drag keeps the same element (and its pointer capture).
    return <div key={lane.keys ? lane.keys.join(',') : lane.id} className={'xt-lane' + (body ? ' xt-body' : '') + (selected ? ' selected' : '')} data-lane={lane.id}>
      <button type="button" className="xt-label" title={lane.title} disabled={body} onClick={() => onLaneSelect(lane)}><span translate="no">{lane.label}</span>{lane.parts && <small>{lane.parts}</small>}</button>
      <div className="xt-cells" onPointerDown={seekDown} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {lane.blocks.map((block, i) => {
          const first = i === 0 && !body, ease = first && !lane.looping && lane.blend > 0 ? `${Math.min(45, lane.blend / Math.max(1, block.to - block.from) * 100)}%` : null;
          return <div key={i} className={'xt-clip' + (first ? ' xt-main' : ' xt-repeat')} data-clip={first ? lane.id : undefined} style={{ left: pct(block.from), width: widthPct(block.from, block.to) }}
            title={first ? 'Drag to change when it starts (Delay); drag its right edge to change its Speed.' : undefined} onPointerDown={first ? event => clipDown(event, lane) : undefined} onPointerMove={first ? move : undefined} onPointerUp={first ? up : undefined} onPointerCancel={first ? up : undefined}>
            {ease && <><i className="xt-ease xt-ease-in" style={{ width: ease }}/><i className="xt-ease xt-ease-out" style={{ width: ease }}/></>}
            {first && lane.editable && <i className="xt-edge"/>}
          </div>;
        })}
        <i className="xt-cursor" style={{ left: pct(time) }}/>
        {(lane.fixes || []).map(fix => <button type="button" key={fix.key + fix.index} className="xt-fix" data-fix={`${fix.key}:${fix.index}`} style={{ left: pct(fix.time) }} title="A moment fix. Click to go there; Delete removes it." onPointerDown={event => event.stopPropagation()} onClick={() => onFixSelect(fix)} onKeyDown={event => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onFixDelete(fix); } }}/>)}
      </div>
      <span className="xt-gap"/>
    </div>;
  };
  return <div className={'xt-timeline' + (dimmed ? ' xt-dimmed' : '')} role="group" aria-label="Clip timeline" aria-disabled={dimmed || undefined} onPointerDownCapture={() => { if (dimmed) onUse?.(); }}>
    <div className="xt-head">
      <span className="xt-readout" title="Time in the new animation.">{readout}</span>
      <div ref={track} className="xt-ruler" role="slider" aria-label="Time" aria-valuemin={0} aria-valuemax={Math.round(span)} aria-valuenow={Math.round(time)} title="Time in the new animation. Click or drag to go there." onPointerDown={seekDown} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {ticks.map(t => <span key={t} style={{ left: pct(t) }}>{t ? `${(t / 1000).toFixed(t % 1000 ? 2 : 1)}` : '0'}</span>)}
        <i className="xt-head-cursor" style={{ left: pct(time) }}/>
      </div>
      <span className="xt-gap"/>
    </div>
    <div className="xt-lanes">
      {bodyLane && laneRow(bodyLane, true)}
      {lanes.map(lane => laneRow(lane, false))}
    </div>
  </div>;
}
