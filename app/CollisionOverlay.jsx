import { shiftDragLatch, solveCollisionMove, moveOffset, clearMoveLock } from '../src/shift-lock.js';
import {useWindowKeyClaim} from './Hotkeys.jsx';
import { Trash2 } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { moveCollision, resizeCollision } from '../src/model-collisions.js';
import { movementDragAmount } from './movement-overlay.js';
import { createFrameCoalescer } from './viewport-performance.js';
import './optimizexl.css';

export const collisionPointVisible = point => point?.every(Number.isFinite) && point[2] >= -1 && point[2] <= 1;
const visible = collisionPointVisible;

/** Drag/keyboard editing of one collision shape: the labeled center grab moves it, the
 * outline/face circles resize it. A draft previews the change; release commits it. */
export function useCollisionGesture({ selected, readOnly, stage, selectedId, setDraft, onCommit }) {
  const gesture = useRef(null), pending = useRef(null), frame = useRef(null), latest = useRef(null);
  latest.current = { setDraft, onCommit };
  const ownerWindow = useRef(null);
  frame.current ||= createFrameCoalescer(() => applyDrag(), {
    request: callback => ownerWindow.current.requestAnimationFrame(callback),
    cancel: id => ownerWindow.current.cancelAnimationFrame(id),
  });
  const previewDraft = value => { pending.current = value; latest.current.setDraft(value); };
  const commit = () => {
    const value = pending.current; pending.current = null; gesture.current = null; latest.current.setDraft(null);
    if (value) latest.current.onCommit(value);
  };
  const cancel = () => { if (gesture.current) clearMoveLock(ownerWindow.current); frame.current.cancel(); pending.current = null; gesture.current = null; latest.current.setDraft(null); };
  const reset = cancel;
  useWindowKeyClaim(({event})=>{
    if(event.key!=='Escape'||!gesture.current)return false;
    cancel();return true;
  },0);
  useEffect(() => () => { frame.current.cancel(); pending.current = null; }, []);
  useEffect(() => {
    const active = gesture.current;
    if (!active) return;
    const row = stage?.rows.find(item => item.id === active.before.ObjectId);
    // Selecting and grabbing a number happen in one event. An older stage's
    // passive effect can still arrive before that selection has rendered.
    if (selectedId === active.before.ObjectId) active.selectingFrom = undefined;
    const retained = (selectedId === active.before.ObjectId || selectedId === active.selectingFrom) && row &&
      (!active.handle.move || row.move && visible(row.center));
    if (!retained) cancel();
  }, [stage, selectedId]);
  const beginDrag = (event, handle, shape = selected) => {
    if (readOnly || !shape || event.button !== 0) return;
    frame.current.cancel();
    ownerWindow.current = event.currentTarget.ownerDocument.defaultView || window;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY };
    gesture.current = { selectingFrom: shape.ObjectId === selectedId ? undefined : selectedId, x: event.clientX, y: event.clientY, workplane: handle.move?.plane, workplaneEnabled: !!handle.move?.plane, latch: shiftDragLatch(start, event.shiftKey), before: structuredClone(shape), handle, handles: stage.rows.find(row => row.id === shape.ObjectId).handles.filter(item => visible(item.point)) };
    event.currentTarget.focus();
  };
  // A move records the pointer; cloning, resizing and the preview update run once per frame.
  const drag = event => {
    const active = gesture.current; if (!active) return;
    const pointer = { x: event.clientX, y: event.clientY };
    active.point = pointer; active.shift = event.shiftKey;
    frame.current.schedule();
  };
  function applyDrag() {
    const active = gesture.current; if (!active?.point) return;
    if (!pending.current && active.point.x === active.x && active.point.y === active.y) return;
    const next = structuredClone(active.before), dx = active.point.x - active.x, dy = active.point.y - active.y;
    if (active.handle.move) {
      const result = solveCollisionMove(active, active.point, active.shift);
      moveCollision(next, moveOffset(result, ownerWindow.current, {clientX: active.point.x, clientY: active.point.y}));
    }
    else {
      const { axis, basis } = active.handle;
      const amount = movementDragAmount(basis, dx, dy, 'move');
      resizeCollision(next, axis, next.Shape === 2 ? next.BoundsRadius + amount : next.Vertices[axis + 3] - next.Vertices[axis] + amount * 2);
    }
    previewDraft(next);
  }
  const resizeHandles = row => {
    const handles = row.handles.filter(handle => visible(handle.point));
    const active = gesture.current;
    // Keep the starting set AND order: moving a captured DOM node in the list
    // releases pointer capture. Use live positions where available, otherwise
    // retain that face's starting point until release or cancellation.
    return active?.before.ObjectId === row.id && !active.handle.move
      ? active.handles.map(start => handles.find(handle => handle.axis === start.axis && handle.sign === start.sign) || start)
      : handles;
  };
  const center = delta => {
    if (readOnly || !selected || !delta) return;
    cancel(); const next = structuredClone(selected); moveCollision(next, delta); previewDraft(next); commit();
  };
  const shiftKey = event => {
    const active = gesture.current;
    if (event.key === 'Shift' && active?.handle.move && active.point) {
      frame.current.flush(); active.shift = event.shiftKey; frame.current.schedule();
    }
  };
  const handleProps = (handle, shape = selected) => ({
    tabIndex: readOnly ? -1 : 0, role: 'slider',
    onPointerDown: event => beginDrag(event, handle, shape), onPointerMove: drag,
    onPointerUp: event => { if (gesture.current) { drag(event); frame.current.flush(); commit(); } },
    onPointerCancel: cancel, onLostPointerCapture: () => { if (gesture.current) cancel(); },
    onKeyUp: shiftKey,
    onKeyDown: event => {
      shiftKey(event);
      if (event.key === 'Escape') { cancel(); event.stopPropagation(); }
      if (!readOnly && selected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); const next = structuredClone(selected), direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        if (handle.move) moveCollision(next, (event.key.includes('Left') || event.key.includes('Right') ? handle.move.dx : handle.move.dy).map(v => v * direction * (event.shiftKey ? 10 : 1)));
        else resizeCollision(next, handle.axis, (next.Shape === 2 ? next.BoundsRadius : next.Vertices[handle.axis + 3] - next.Vertices[handle.axis]) + direction * (event.shiftKey ? 10 : 1));
        previewDraft(next); commit();
      }
    }
  });
  return { previewDraft, commit, cancel, reset, drag, handleProps, resizeHandles, center, hasPending: () => !!pending.current };
}

/** Shared EMTR-style controls for Managers and Sphereomancer. */
export default function CollisionOverlay({ stage, selectedId, readOnly, onSelect, onRemove, gesture, className = '' }) {
  if (!stage) return null;
  const grab=(point,handle,label,kind,caption)=> <g className={kind} aria-label={label} {...gesture.handleProps(handle)}>
    <circle className="pe-grab" cx={point[0]} cy={point[1]} r="20"/>
    <circle cx={point[0]} cy={point[1]} r="7"/>
    {caption&&<text x={point[0]+12} y={point[1]+20}>{caption}</text>}
    <title>{handle.move?'Move. Hold Shift to lock direction.':'Drag to resize'}</title>
  </g>;
  const selectedRow = stage.rows.find(row => row.id === selectedId);
  const select = (event, id) => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); onSelect(id); };
  const selectorProps = row => {
    const props = gesture.handleProps({move: row.move}, row.source);
    return {...props, role: 'button', tabIndex: 0,
      onPointerDown: event => { select(event, row.id); if (row.move) props.onPointerDown(event); },
      onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect(row.id); } else if (row.id === selectedId) props.onKeyDown(event); },
    };
  };
  return <svg className={`mm-overlay ${className}`} viewBox={`0 0 ${stage.width} ${stage.height}`} aria-label="Collision shapes" onPointerMove={gesture.drag}>
    {stage.rows.map(row => <g key={row.id} className={row.id === selectedId ? 'mm-selected' : ''}>
      {(row.guides || []).filter(line => line.every(visible)).map((line, index) => <polyline key={'g' + index} points={line.map(p => p.slice(0, 2).join(',')).join(' ')} className="mm-guide"/>)}
      {row.outlines.filter(line => line.every(visible)).map((line, index) => <React.Fragment key={index}>
        <polyline points={line.map(p => p.slice(0, 2).join(',')).join(' ')} className="mm-outline"/>
        <polyline points={line.map(p => p.slice(0, 2).join(',')).join(' ')} className="mm-outline-hit" onPointerDown={event => select(event, row.id)}><title>Select collision shape</title></polyline>
      </React.Fragment>)}
      {visible(row.center) && <circle className="mm-select-center" cx={row.center[0]} cy={row.center[1]} r="20" onPointerDown={event => select(event, row.id)}><title>Select collision shape</title></circle>}
    </g>)}
    {stage.rows.map((row, index) => row.selectionBox && visible(row.selectionBox) && <g key={'select-' + row.id} className={`mm-sphere-select ${row.id === selectedId ? 'mm-selected' : ''}`} {...selectorProps(row)} aria-label={`Select collision shape ${index + 1}`} aria-pressed={row.id === selectedId}>
      <rect x={row.selectionBox[0] - 12} y={row.selectionBox[1] - 12} width="24" height="24" rx="2"/>
      <text x={row.selectionBox[0]} y={row.selectionBox[1] + 4} textAnchor="middle">{index + 1}</text>
      <title>Select and drag to move. Hold Shift to lock direction.</title>
    </g>)}
    {/* Selected controls are painted last so another shape cannot swallow a grab or trash click. */}
    {selectedRow && !readOnly && <g key={selectedId} className="mm-selected">
      {gesture.resizeHandles(selectedRow).map(handle => <React.Fragment key={`${handle.axis}:${handle.sign}`}>{grab(handle.point,handle,selectedRow.outlines.length===1?'Resize sphere radius':`Resize ${['X', 'Y', 'Z'][handle.axis]} ${handle.sign > 0 ? 'positive' : 'negative'}`,'mm-handle')}</React.Fragment>)}
      {selectedRow.move && visible(selectedRow.center) && <g className="pe-move-emitter">
        {grab(selectedRow.center,{move:selectedRow.move},'Move collision shape','mm-center','Move')}
        <foreignObject x={selectedRow.center[0]-30} y={selectedRow.center[1]+28} width="60" height="25" className="mm-recenter"><button type="button" aria-label="Center" title="Center horizontally and keep the current height." onPointerDown={event=>event.stopPropagation()} onClick={()=>gesture.center(selectedRow.centerDelta)}>Center</button></foreignObject>
        {onRemove&&<foreignObject x={selectedRow.center[0]+24} y={selectedRow.center[1]-28} width="28" height="28" className="mm-remove"><button aria-label="Remove collision shape" title="Remove collision shape" onPointerDown={event=>event.stopPropagation()} onClick={onRemove}><Trash2 size={16}/></button></foreignObject>}
      </g>}
    </g>}
  </svg>;
}
