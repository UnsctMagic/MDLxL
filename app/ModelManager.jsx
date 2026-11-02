import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Box, Circle, Move, Trash2 } from 'lucide-react';
import { createNode, deleteNode } from '../src/editor-document.js';
import { fittedCollision, resizeCollision } from '../src/model-collisions.js';
import CollisionOverlay, { useCollisionGesture } from './CollisionOverlay.jsx';
import './model-manager.css';
import { MODEL_COMMENTS_KEY } from '../src/model-comments.js';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const previewOverlays = { bones: false, nodes: false, attachments: false, particles: false, wires: false };
const sections = ['CollisionShapes', 'Nodes', 'PivotPoints'];

export default function ModelManager({ doc, edit, assets, teamColor }) {
  const model = doc.model;
  const [selectedId, setSelectedId] = useState(model.CollisionShapes[0]?.ObjectId);
  const [draft, setDraft] = useState(null), [stage, setStage] = useState(null);
  const [name, setName] = useState(model.Info.Name || '');
  const [comments, setComments] = useState(model[MODEL_COMMENTS_KEY] || '');
  const [view, setView] = useState('perspective');
  const selected = model.CollisionShapes.find(shape => shape.ObjectId === selectedId);
  const { previewDraft, commit, cancel, reset, hasPending, ...gesture } = useCollisionGesture({ selected, readOnly: doc.readOnly, stage, selectedId, setDraft,
    onCommit: value => edit('Edit collision shape', sections, m => {
      const target = m.CollisionShapes.find(item => item.ObjectId === value.ObjectId);
      if (target) { target.Vertices = new Float32Array(value.Vertices); target.BoundsRadius = value.BoundsRadius; }
    }) });
  useEffect(() => { setName(model.Info.Name || ''); setComments(model[MODEL_COMMENTS_KEY] || ''); reset(); }, [doc, doc.revision]);
  const shape = draft || selected;
  const shapes = useMemo(() => model.CollisionShapes.map(item => item.ObjectId === draft?.ObjectId ? draft : item), [model, doc.revision, draft]);
  const add = type => {
    const id = edit(type === 2 ? 'Add collision sphere' : 'Add collision box', sections, m => {
      const created = createNode(m, 'CollisionShape');
      Object.assign(created, fittedCollision(m, type));
      created.Name = `${type === 2 ? 'Sphere' : 'Box'} ${m.CollisionShapes.length}`;
      return created.ObjectId;
    });
    if (id !== false) setSelectedId(id);
  };
  return <div className="model-manager" onKeyDown={event => { if (event.key === 'Escape' && hasPending()) { cancel(); event.stopPropagation(); } }}>
    <div className="mm-stage">
      <Suspense fallback={<div className="classic-empty-view">Loading model…</div>}><GamePreview model={model} revision={doc.revision} textureAssets={assets} teamColor={teamColor} presentation="preview" sequenceIndex={-1} time={0} playing={false} preserveCameraView showGrid={false} showAxes={false} showParticles={false} mode="textured" view={view} overlays={previewOverlays} collisionShapes={shapes} collisionSelectedId={selectedId} onCollisionStage={setStage}/></Suspense>
      <div className="mm-view-controls"><select aria-label="Collision view" value={view} onChange={event => setView(event.target.value)}>{['perspective', 'front', 'side', 'top'].map(item => <option key={item}>{item}</option>)}</select></div>
      <CollisionOverlay stage={stage} selectedId={selectedId} readOnly={doc.readOnly} onSelect={setSelectedId} gesture={gesture}/>
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
