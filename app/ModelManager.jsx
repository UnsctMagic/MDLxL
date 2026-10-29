import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Circle, Move, Trash2 } from 'lucide-react';
import { createNode, deleteNode } from '../src/editor-document.js';
import { fittedCollision, moveCollision, resizeCollision } from '../src/model-collisions.js';
import { movementDragAmount } from './movement-overlay.js';
import './model-manager.css';
import { MODEL_COMMENTS_KEY } from '../src/model-comments.js';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const previewOverlays = { bones: false, nodes: false, attachments: false, particles: false, wires: false };
const sections = ['CollisionShapes', 'Nodes', 'PivotPoints'];
const visible = point => point?.every(Number.isFinite) && point[2] >= -1 && point[2] <= 1;

export default function ModelManager({ doc, edit, assets, preferences, teamColor }) {
  const model = doc.model;
  const [selectedId, setSelectedId] = useState(model.CollisionShapes[0]?.ObjectId);
  const [draft, setDraft] = useState(null), [stage, setStage] = useState(null);
  const [name, setName] = useState(model.Info.Name || '');
  const [comments, setComments] = useState(model[MODEL_COMMENTS_KEY] || '');
  const [view, setView] = useState('perspective');
  const gesture = useRef(null), pending = useRef(null);
  useEffect(() => { setName(model.Info.Name || ''); setComments(model[MODEL_COMMENTS_KEY] || ''); pending.current = null; gesture.current = null; setDraft(null); }, [doc, doc.revision]);
  const selected = model.CollisionShapes.find(shape => shape.ObjectId === selectedId);
  const shape = draft || selected;
  const shapes = useMemo(() => model.CollisionShapes.map(item => item.ObjectId === draft?.ObjectId ? draft : item), [model, doc.revision, draft]);
  const previewDraft = value => { pending.current = value; setDraft(value); };
  const commit = () => {
    const value = pending.current; pending.current = null; gesture.current = null; setDraft(null);
    if (!value) return;
    edit('Edit collision shape', sections, m => {
      const target = m.CollisionShapes.find(item => item.ObjectId === value.ObjectId);
      if (target) { target.Vertices = new Float32Array(value.Vertices); target.BoundsRadius = value.BoundsRadius; }
    });
  };
  const cancel = () => { pending.current = null; gesture.current = null; setDraft(null); };
  useEffect(() => () => { pending.current = null; }, []);
  useEffect(() => {
    const active = gesture.current;
    if (!active) return;
    const row = stage?.rows.find(item => item.id === active.before.ObjectId);
    const retained = selectedId === active.before.ObjectId && row && (active.handle.move
      ? row.move && visible(row.center)
      : row.handles.some(handle => handle.axis === active.handle.axis && handle.sign === active.handle.sign && visible(handle.point)));
    if (!retained) cancel();
  }, [stage, selectedId]);
  const add = type => {
    const id = edit(type === 2 ? 'Add collision sphere' : 'Add collision box', sections, m => {
      const created = createNode(m, 'CollisionShape');
      Object.assign(created, fittedCollision(m, type));
      created.Name = `${type === 2 ? 'Sphere' : 'Box'} ${m.CollisionShapes.length}`;
      return created.ObjectId;
    });
    if (id !== false) setSelectedId(id);
  };
  const beginDrag = (event, handle) => {
    if (doc.readOnly || !selected || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, before: structuredClone(selected), handle };
    event.currentTarget.focus();
  };
  const drag = event => {
    const active = gesture.current; if (!active) return;
    const next = structuredClone(active.before), dx = event.clientX - active.x, dy = event.clientY - active.y;
    if (active.handle.move) moveCollision(next, [0, 1, 2].map(i => dx * active.handle.move.dx[i] + dy * active.handle.move.dy[i]));
    else {
      const { axis, basis } = active.handle;
      const amount = movementDragAmount(basis, dx, dy, 'move');
      resizeCollision(next, axis, next.Shape === 2 ? next.BoundsRadius + amount : next.Vertices[axis + 3] - next.Vertices[axis] + amount * 2);
    }
    previewDraft(next);
  };
  const handleProps = handle => ({
    tabIndex: doc.readOnly ? -1 : 0, role: 'slider',
    onPointerDown: event => beginDrag(event, handle), onPointerMove: drag,
    onPointerUp: event => { if (gesture.current) { drag(event); commit(); } },
    onPointerCancel: cancel, onLostPointerCapture: () => { if (gesture.current) cancel(); },
    onKeyDown: event => {
      if (event.key === 'Escape') { cancel(); event.stopPropagation(); }
      if (!doc.readOnly && selected && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); const next = structuredClone(selected), direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        if (handle.move) moveCollision(next, (event.key.includes('Left') || event.key.includes('Right') ? handle.move.dx : handle.move.dy).map(v => v * direction * (event.shiftKey ? 10 : 1)));
        else resizeCollision(next, handle.axis, (next.Shape === 2 ? next.BoundsRadius : next.Vertices[handle.axis + 3] - next.Vertices[handle.axis]) + direction * (event.shiftKey ? 10 : 1));
        previewDraft(next); commit();
      }
    }
  });
  return <div className="model-manager" onKeyDown={event => { if (event.key === 'Escape' && pending.current) { cancel(); event.stopPropagation(); } }}>
    <div className="mm-stage">
      <Suspense fallback={<div className="classic-empty-view">Loading model…</div>}><GamePreview model={model} revision={doc.revision} textureAssets={assets} preferences={preferences} teamColor={teamColor} presentation="preview" sequenceIndex={-1} time={0} playing={false} preserveCameraView showGrid={false} showAxes={false} showParticles={false} mode="textured" view={view} overlays={previewOverlays} collisionShapes={shapes} collisionSelectedId={selectedId} onCollisionStage={setStage}/></Suspense>
      <div className="mm-view-controls"><select aria-label="Collision view" value={view} onChange={event => setView(event.target.value)}>{['perspective', 'front', 'side', 'top'].map(item => <option key={item}>{item}</option>)}</select></div>
      {stage && <svg className="mm-overlay" viewBox={`0 0 ${stage.width} ${stage.height}`} aria-label="Collision shapes" onPointerMove={drag}>
        {stage.rows.map(row => <g key={row.id} className={row.id === selectedId ? 'mm-selected' : ''}>
          {row.outlines.filter(line => line.every(visible)).map((line, index) => <polyline key={index} points={line.map(p => p.slice(0, 2).join(',')).join(' ')} className="mm-outline" onPointerDown={event => { event.stopPropagation(); setSelectedId(row.id); }}><title>Select collision shape</title></polyline>)}
          {row.id === selectedId && !doc.readOnly && <>
            {row.handles.filter(handle => visible(handle.point)).map(handle => <rect key={`${handle.axis}:${handle.sign}`} x={handle.point[0] - 5} y={handle.point[1] - 5} width="10" height="10" rx="2" className="mm-handle" aria-label={`Resize ${['X', 'Y', 'Z'][handle.axis]} ${handle.sign > 0 ? 'positive' : 'negative'}`} {...handleProps(handle)}><title>Drag to resize</title></rect>)}
            {row.move && visible(row.center) && <circle cx={row.center[0]} cy={row.center[1]} r="8" className="mm-center" aria-label="Move collision shape" {...handleProps({ move: row.move })}><title>Drag to move</title></circle>}
          </>}
        </g>)}
      </svg>}
    </div>
    <aside className="mm-properties">
      <label className="mm-name">Model name<input aria-label="Model name" title="The name stored inside the model, separate from the file name." disabled={doc.readOnly} maxLength={79} value={name} onChange={event => setName(event.target.value)} onBlur={() => { if (name !== model.Info.Name) edit('Rename model', ['Info'], m => { m.Info.Name = name; }); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>
      <div className="mm-add"><button disabled={doc.readOnly} onClick={() => add(2)} title="Add a sphere fitted around the model"><Circle size={17}/> Sphere</button><button disabled={doc.readOnly} onClick={() => add(0)} title="Add a box fitted around the model"><Box size={17}/> Box</button></div>
      <div className="mm-shapes" role="listbox" aria-label="Model collision shapes">{model.CollisionShapes.map(item => <button key={item.ObjectId} role="option" aria-selected={item.ObjectId === selectedId} onClick={() => { commit(); setSelectedId(item.ObjectId); }}>{item.Shape === 2 ? <Circle size={16}/> : <Box size={16}/>}<span>{item.Name || 'Collision shape'}</span></button>)}</div>
      {shape && <fieldset disabled={doc.readOnly} className="mm-size"><legend>{shape.Shape === 2 ? 'Radius' : 'Size'}</legend>{(shape.Shape === 2 ? [0] : shape.Shape === 0 ? [0, 1, 2] : []).map(axis => {
        const value = shape.Shape === 2 ? shape.BoundsRadius : shape.Vertices[axis + 3] - shape.Vertices[axis];
        const original = selected.Shape === 2 ? selected.BoundsRadius : selected.Vertices[axis + 3] - selected.Vertices[axis];
        const label = shape.Shape === 2 ? 'Radius' : ['Width', 'Depth', 'Height'][axis];
        return <label key={axis} title={`Resize ${label.toLowerCase()} around the shape's center`}><span>{shape.Shape === 2 ? <Circle size={14}/> : ['X', 'Y', 'Z'][axis]}</span><input aria-label={label} type="range" min="0.01" max={Math.max(128, original * 3)} step="0.1" value={value} onChange={event => { const next = structuredClone(shape); resizeCollision(next, axis, Number(event.target.value)); previewDraft(next); }} onPointerUp={commit} onPointerCancel={cancel} onBlur={commit} onKeyUp={commit}/><output>{Math.round(value * 10) / 10}</output></label>;
      })}<div className="mm-selection-actions"><span title="Drag the center dot to move; drag the edge handles to resize"><Move size={16}/></span><button aria-label="Remove collision shape" title="Remove selected collision shape" onClick={() => edit('Remove collision shape', sections, m => deleteNode(m, selectedId))}><Trash2 size={16}/></button></div></fieldset>}
      <details className="mm-comments"><summary>Comments</summary>{doc.format === 'mdl' ? <textarea aria-label="Model comments" disabled={doc.readOnly} rows={6} value={comments} onChange={event => setComments(event.target.value)} onBlur={() => { if (comments !== (model[MODEL_COMMENTS_KEY] || '')) edit('Edit model comments', [MODEL_COMMENTS_KEY], m => { if (comments) m[MODEL_COMMENTS_KEY] = comments; else delete m[MODEL_COMMENTS_KEY]; }); }}/> : <p>Standard comments are stored in MDL files. MDX has no comment field.</p>}</details>
    </aside>
  </div>;
}
