import React, { useEffect, useRef } from 'react';
import { moveCollision, resizeCollision } from '../src/model-collisions.js';
import { movementDragAmount } from './movement-overlay.js';
import { createFrameCoalescer } from './viewport-performance.js';
import './model-manager.css';

export const collisionPointVisible = point => point?.every(Number.isFinite) && point[2] >= -1 && point[2] <= 1;
const visible = collisionPointVisible;

/** Drag/keyboard editing of one collision shape: the center dot moves it, the
 * edge squares resize it. A draft previews the change; release commits it. */
export function useCollisionGesture({ selected, readOnly, stage, selectedId, setDraft, onCommit }) {
  const gesture = useRef(null), pending = useRef(null), frame = useRef(null), latest = useRef(null);
  latest.current = { setDraft, onCommit };
  frame.current ||= createFrameCoalescer(() => applyDrag());
  const previewDraft = value => { pending.current = value; latest.current.setDraft(value); };
  const commit = () => {
    const value = pending.current; pending.current = null; gesture.current = null; latest.current.setDraft(null);
    if (value) latest.current.onCommit(value);
  };
  const cancel = () => { frame.current.cancel(); pending.current = null; gesture.current = null; latest.current.setDraft(null); };
  const reset = () => { pending.current = null; gesture.current = null; latest.current.setDraft(null); };
  useEffect(() => () => { frame.current.cancel(); pending.current = null; }, []);
  useEffect(() => {
    const active = gesture.current;
    if (!active) return;
    const row = stage?.rows.find(item => item.id === active.before.ObjectId);
    const retained = selectedId === active.before.ObjectId && row && (active.handle.move
      ? row.move && visible(row.center)
      : row.handles.some(handle => handle.axis === active.handle.axis && handle.sign === active.handle.sign && visible(handle.point)));
    if (!retained) cancel();
  }, [stage, selectedId]);
  const beginDrag = (event, handle) => {
    if (readOnly || !selected || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, before: structuredClone(selected), handle };
    event.currentTarget.focus();
  };
  // A move records the pointer; cloning, resizing and the preview update run once per frame.
  const drag = event => {
    const active = gesture.current; if (!active) return;
    active.point = { x: event.clientX, y: event.clientY }; frame.current.schedule();
  };
  function applyDrag() {
    const active = gesture.current; if (!active?.point) return;
    const next = structuredClone(active.before), dx = active.point.x - active.x, dy = active.point.y - active.y;
    if (active.handle.move) moveCollision(next, [0, 1, 2].map(i => dx * active.handle.move.dx[i] + dy * active.handle.move.dy[i]));
    else {
      const { axis, basis } = active.handle;
      const amount = movementDragAmount(basis, dx, dy, 'move');
      resizeCollision(next, axis, next.Shape === 2 ? next.BoundsRadius + amount : next.Vertices[axis + 3] - next.Vertices[axis] + amount * 2);
    }
    previewDraft(next);
  }
  const handleProps = handle => ({
    tabIndex: readOnly ? -1 : 0, role: 'slider',
    onPointerDown: event => beginDrag(event, handle), onPointerMove: drag,
    onPointerUp: event => { if (gesture.current) { drag(event); frame.current.flush(); commit(); } },
    onPointerCancel: cancel, onLostPointerCapture: () => { if (gesture.current) cancel(); },
    onKeyDown: event => {
      if (event.key === 'Escape') { cancel(); event.stopPropagation(); }
      if (!readOnly && selected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); const next = structuredClone(selected), direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        if (handle.move) moveCollision(next, (event.key.includes('Left') || event.key.includes('Right') ? handle.move.dx : handle.move.dy).map(v => v * direction * (event.shiftKey ? 10 : 1)));
        else resizeCollision(next, handle.axis, (next.Shape === 2 ? next.BoundsRadius : next.Vertices[handle.axis + 3] - next.Vertices[handle.axis]) + direction * (event.shiftKey ? 10 : 1));
        previewDraft(next); commit();
      }
    }
  });
  return { previewDraft, commit, cancel, reset, drag, handleProps, hasPending: () => !!pending.current };
}

/** Collision outlines over a preview, with the selected shape's handles. */
export default function CollisionOverlay({ stage, selectedId, readOnly, onSelect, gesture, className = '' }) {
  if (!stage) return null;
  return <svg className={`mm-overlay ${className}`} viewBox={`0 0 ${stage.width} ${stage.height}`} aria-label="Collision shapes" onPointerMove={gesture.drag}>
    {stage.rows.map(row => <g key={row.id} className={row.id === selectedId ? 'mm-selected' : ''}>
      {(row.guides || []).filter(line => line.every(visible)).map((line, index) => <polyline key={'g' + index} points={line.map(p => p.slice(0, 2).join(',')).join(' ')} className="mm-guide"/>)}
      {row.outlines.filter(line => line.every(visible)).map((line, index) => <polyline key={index} points={line.map(p => p.slice(0, 2).join(',')).join(' ')} className="mm-outline" onPointerDown={event => { event.stopPropagation(); onSelect(row.id); }}><title>Select collision shape</title></polyline>)}
      {row.id === selectedId && !readOnly && <>
        {row.handles.filter(handle => visible(handle.point)).map(handle => <rect key={`${handle.axis}:${handle.sign}`} x={handle.point[0] - 5} y={handle.point[1] - 5} width="10" height="10" rx="2" className="mm-handle" aria-label={`Resize ${['X', 'Y', 'Z'][handle.axis]} ${handle.sign > 0 ? 'positive' : 'negative'}`} {...gesture.handleProps(handle)}><title>Drag to resize</title></rect>)}
        {row.move && visible(row.center) && <circle cx={row.center[0]} cy={row.center[1]} r="8" className="mm-center" aria-label="Move collision shape" {...gesture.handleProps({ move: row.move })}><title>Drag to move</title></circle>}
      </>}
    </g>)}
  </svg>;
}
