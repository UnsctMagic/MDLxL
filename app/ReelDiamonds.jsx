import React, { useEffect, useRef, useState } from 'react';
import useDismiss from './useDismiss.js';
import { KeyDiamonds, pointLimits } from './ParticleKeyTrack.jsx';
import { setEmitterSpans, addSpan, setEventDiamonds, addEventFrame, timelineDiamonds } from '../src/emitter-timing.js';

/**
 * EMTR's blue diamonds on the keyframe reel for the one clicked object: shows/hides pairs for
 * anything with a Visibility track (emitters, ribbons, lights, attachments), one diamond per frame
 * for events and sounds. Returns the track layer and its add button, placed by the reel.
 */
export default function useReelDiamonds({ model, selectedNodeIds, domain, frame, disabled, onEdit, onSeek, onStatus }) {
  const box = useRef(null), menuBox = useRef(null), [menu, setMenu] = useState(null);
  useDismiss(menu, [menuBox], () => setMenu(null), { stopEscape: false });
  // A menu belongs to the object and timeline it was opened on.
  useEffect(() => setMenu(null), [selectedNodeIds.join(','), domain?.start, domain?.end]);
  const item = timelineDiamonds(model, selectedNodeIds, domain);
  if (!item) return { track: null, add: null };
  const { id, sequence, global, kind, start, end, groups } = item, events = kind === 'events';
  const write = (label, next) => onEdit?.(label, ['Nodes'], current => {
    if (events) setEventDiamonds(current, id, sequence, next.map(([at]) => at), global);
    else setEmitterSpans(current, id, sequence, next, global);
  });
  const change = next => write(events ? 'Move event frame' : 'Change when it shows', next);
  const context = (event, at) => {
    event.preventDefault(); event.stopPropagation();
    if (disabled) return;
    const view = event.currentTarget.ownerDocument.defaultView || window;
    setMenu({ x: Math.min(event.clientX, view.innerWidth - 160), y: Math.min(event.clientY, view.innerHeight - 40), ...at });
  };
  const describe = events
    ? (index, side, at) => ({ kind: 'hides', label: 'Event at frame ' + at, title: 'Event at frame ' + at + '. Drag to change when. Right-click to remove.' })
    : (index, side, at) => ({ kind: side ? 'hides' : 'shows', label: (side ? 'Hides at frame ' : 'Shows at frame ') + at, title: (side ? 'Hides' : 'Shows') + ' at frame ' + at + '. Drag to change when. Right-click to remove this pair.' });
  const add = () => {
    try {
      if (events) write('Add event frame', addEventFrame(groups.map(([at]) => at), frame, start, end).map(at => [at]));
      else write('Add a part where it shows', addSpan(groups, start, end));
    } catch (error) { onStatus?.(error.message, true); }
  };
  // The reel scrubs on pointer down and steps on arrow keys; a diamond keeps both to itself.
  const track = <div ref={box} data-hold-playback className="classic-reel-diamonds" data-object-id={id} onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation(); }} onContextMenu={event => { if (event.target !== event.currentTarget) event.stopPropagation(); }}>
    <KeyDiamonds key={id} box={box} groups={groups} start={start} end={end} inset={0} disabled={disabled} limits={events ? pointLimits : undefined} describe={describe} onChange={change} onScrub={onSeek} onContext={context}/>
    {menu && <div ref={menuBox} className="pe-key-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
      <button role="menuitem" autoFocus onClick={() => { setMenu(null); write(events ? 'Remove event frame' : 'Remove a part where it shows', groups.filter((_, index) => index !== menu.part)); }}>{events ? 'Remove' : 'Remove this pair'}</button>
    </div>}
  </div>;
  const button = <button type="button" className="pe-key-add" disabled={disabled} title={events ? 'Add a diamond at the current frame: the event plays there too.' : 'Add another pair of diamonds: one more part where it shows and then hides.'} onClick={add}>{events ? '+ ◆' : '+ ◆◆'}</button>;
  return { track, add: button };
}
