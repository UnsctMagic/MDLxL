import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Quaternion, Vector3 } from 'three';
import { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES, PRIMITIVE_DEFAULTS, PRIMITIVE_TEXTURE } from '../src/forge-primitives.js';
import { thumperImage, THUMPER_TEXTURE, THUMPER_COLORS } from '../src/forge-thumper.js';
import { textureFromAsset } from './Viewport.jsx';
import { encodeForgeTga } from '../src/forge.js';
import ForgePreview, { forgeShapeColor } from './ForgePreview.jsx';
import { createForgeShape, forgeShapeMesh, forgeFaceNormal, forgeSelectionCenter, forgeSelectionNormal, transformForgeSelection, extrudeForgeFaces, insetForgeFaces } from '../src/forge-shape-editing.js';
const SHAPE_AXES = { horizontal: 0, vertical: 2, depth: 1, depthSign: -1 };

// Small, static previews use the same geometry as the shape being added.
function ShapeThumbnail({ shape }) {
  const faces = useMemo(() => {
    const mesh = buildForgePrimitive({ ...PRIMITIVE_DEFAULTS, shape, complexity: 1 });
    const flat = FLAT_FORGE_SHAPES.includes(shape) || shape === 'ThumperXL', vertices = [], triangles = [];
    for (const g of mesh.geosets) {
      const start = vertices.length;
      for (let i = 0; i < g.Vertices.length; i += 3) {
        const [x, y, z] = g.Vertices.slice(i, i + 3);
        vertices.push(flat ? [x, -y, z] : [.82 * x + .57 * z, .2 * x - .93 * y - .29 * z, -.53 * x - .37 * y + .76 * z]);
      }
      for (let i = 0; i < g.Faces.length; i += 3) { const face = Array.from(g.Faces.slice(i, i + 3), id => vertices[start + id]); face.color = THUMPER_COLORS[Math.floor(g.TVertices[0][g.Faces[i] * 2] * 8)]; triangles.push(face); }
    }
    const minX = Math.min(...vertices.map(p => p[0])), maxX = Math.max(...vertices.map(p => p[0]));
    const minY = Math.min(...vertices.map(p => p[1])), maxY = Math.max(...vertices.map(p => p[1]));
    const scale = 42 / Math.max(maxX - minX, maxY - minY, 1);
    return triangles.sort((a, b) => a.reduce((n, p) => n + p[2], 0) - b.reduce((n, p) => n + p[2], 0)).map(points => {
      const [a, b, c] = points, u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
      const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const shade = 48 + 22 * Math.abs((normal[0] * -.3 + normal[1] * -.6 + normal[2] * .7) / (Math.hypot(...normal) || 1));
      return { points: points.map(p => [32 + (p[0] - (minX + maxX) / 2) * scale, 26 + (p[1] - (minY + maxY) / 2) * scale].join(',')).join(' '), fill: shape === 'ThumperXL' ? points.color : 'hsl(0 0% ' + shade + '%)' };
    });
  }, [shape]);
  return <svg viewBox="0 0 64 52" aria-hidden="true">{faces.map((face, i) => <polygon key={i} points={face.points} fill={face.fill} stroke="#444" strokeWidth=".35" strokeLinejoin="round"/>)}</svg>;
}

export default function ForgeShapes({ modelPath, preferences, onClose, onCommit, onBusyChange }) {
  const [settings, setSettings] = useState(PRIMITIVE_DEFAULTS), [wire, setWire] = useState(false), [checker, setChecker] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [stock, setStock] = useState(null), [textureError, setTextureError] = useState('');
  const [draft, setDraft] = useState({ shapes: [], selection: {}, mode: 'Shape' }), [phase, setPhase] = useState('create'), [tool, setTool] = useState('Move');
  const [adjustment, setAdjustment] = useState(0), [historySize, setHistorySize] = useState([0, 0]);
  const current = useRef(draft), history = useRef([]), future = useRef([]), gesture = useRef(), nextId = useRef(1); current.current = draft;
  const helmet = useMemo(thumperImage, []), isThumper = settings.shape === 'ThumperXL';
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const records = await window.desktop?.resolveTextures({ path: modelPath, names: [PRIMITIVE_TEXTURE] });
        const asset = records?.find(record => record.bytes);
        if (!asset) throw Error('BTNTemp preview needs Warcraft III textures. Set your game folder in Settings.');
        const texture = await textureFromAsset(asset);
        try { if (active) setStock({ asset, image: { width: texture.image.width, height: texture.image.height, data: new Uint8Array(texture.image.data) } }); }
        finally { texture.dispose(); }
      } catch (e) { if (active) setTextureError(e.message); }
    })();
    return () => { active = false; };
  }, [modelPath]);
  const setting = (key, value) => setSettings(s => ({ ...s, [key]: value }));
  const preview = useMemo(() => { try { return { mesh: buildForgePrimitive(settings) }; } catch (e) { return { error: e.message }; } }, [settings]);
  const record = before => { history.current.push(before); if (history.current.length > 80) history.current.shift(); future.current = []; setHistorySize([history.current.length, 0]); };
  const update = next => { current.current = next; setDraft(next); };
  const undo = redo => {
    const from = redo ? future.current : history.current, to = redo ? history.current : future.current, previous = from.pop();
    if (!previous) return; to.push(current.current); update(previous); setPhase(previous.shapes.length ? 'edit' : 'create'); setError(''); setHistorySize([history.current.length, future.current.length]);
  };
  const readySelection = (before, value) => {
    const active = before.shapes.filter(s => before.selection[s.id]?.length), shapes = active.length ? active : before.shapes.slice(-1);
    if (!shapes.length) return before;
    if (['Extrude', 'Inset'].includes(value) && (before.mode !== 'Faces' || !active.length)) {
      return { ...before, mode: 'Faces', selection: Object.fromEntries(shapes.map(shape => {
        const face = [...shape.faces].sort((a, b) => forgeFaceNormal(shape, b)[2] - forgeFaceNormal(shape, a)[2])[0];
        return [shape.id, [face.id]];
      })) };
    }
    return active.length ? before : { ...before, mode: 'Shape', selection: { [shapes[0].id]: ['shape'] } };
  };
  const chooseTool = value => { update(readySelection(current.current, value)); setTool(value); setAdjustment(0); setError(''); };
  const onPick = (id, part, add, mode = 'Faces') => {
    if (!id) return current.current;
    const before = current.current, keep = add && before.mode === mode, selected = keep ? [...(before.selection[id] || [])] : [];
    if (add && selected.includes(part)) selected.splice(selected.indexOf(part), 1); else selected.push(part);
    const next = { ...before, mode, selection: { ...(keep ? before.selection : {}), [id]: selected } };
    update(next); setPhase('edit'); setError(''); return next;
  };
  const operate = (before, values) => ({ ...before, shapes: before.shapes.map(shape => {
    const selected = before.selection[shape.id]; if (!selected?.length) return shape;
    let next;
    if (tool === 'Extrude') next = extrudeForgeFaces(shape, selected, values.translation);
    else if (tool === 'Inset') next = insetForgeFaces(shape, selected, values.inset);
    else next = transformForgeSelection(shape, selected, before.mode, values);
    if (next === shape) return shape;
    forgeShapeMesh(next);
    return { ...next, committed: false };
  }) });
  const begin = () => { const before = readySelection(current.current, tool); update(before); gesture.current = before; setError(''); };
  const transform = values => {
    if (!gesture.current) return;
    try { update(operate(gesture.current, values)); } catch (e) { setError(e.message); }
  };
  const end = () => { const before = gesture.current; gesture.current = null; if (before && before.shapes.some((s, i) => s !== current.current.shapes[i])) record(before); setAdjustment(0); };
  const cancel = () => { const before = gesture.current; gesture.current = null; if (before) update(before); setAdjustment(0); setError(''); };
  const adjust = value => {
    if (!gesture.current) begin();
    const before = gesture.current, center = forgeSelectionCenter(before.shapes, before.selection, before.mode), points = before.shapes.filter(s => before.selection[s.id]?.length).flatMap(s => s.vertices);
    const size = Math.max(1, ...[0, 1, 2].map(a => { const bounds = points.reduce(([min, max], p) => [Math.min(min, p[a]), Math.max(max, p[a])], [Infinity, -Infinity]); return bounds[1] - bounds[0]; })), values = { center };
    if (tool === 'Move') values.translation = [0, 0, value * size / 100];
    if (tool === 'Extrude') values.translation = forgeSelectionNormal(before.shapes, before.selection).map(n => n * value * size / 100);
    if (tool === 'Inset') values.inset = value * size / 400;
    if (tool === 'Scale') values.scale = [1, 1, 1].map(() => 2 ** (value / 50));
    if (tool === 'Rotate') values.quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), value * Math.PI / 180).toArray();
    setAdjustment(value); transform(values);
  };
  const addShape = () => {
    if (phase !== 'create') { setPhase('create'); setError(''); return; }
    try {
      const shape = createForgeShape(preview.mesh, { id: nextId.current++, name: settings.shape, texturePath: isThumper ? THUMPER_TEXTURE : PRIMITIVE_TEXTURE });
      record(current.current); update({ shapes: [...draft.shapes, shape], selection: { [shape.id]: ['shape'] }, mode: 'Shape' }); setPhase('edit'); chooseTool('Move'); setError('');
    } catch (e) { setError(e.message); }
  };
  const commit = () => { update({ ...draft, shapes: draft.shapes.map(s => ({ ...s, committed: true })) }); setError(''); };
  const entries = useMemo(() => {
    const shapes = [...draft.shapes]; if (phase === 'create' && preview.mesh) shapes.push(createForgeShape(preview.mesh, { id: 0, name: settings.shape }));
    return shapes.map(shape => { const mesh = forgeShapeMesh(shape); return { shape, geoset: mesh.geosets[0], faceIds: mesh.faceIds }; });
  }, [draft.shapes, phase, preview.mesh]);
  const geosets = useMemo(() => entries.map(e => e.geoset), [entries]);
  const pickedCount = Object.values(draft.selection).reduce((n, ids) => n + ids.length, 0);
  const keys = e => {
    if (gesture.current) return;
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase()) && (e.target.type === 'range' || !['INPUT', 'TEXTAREA'].includes(e.target.tagName))) { e.preventDefault(); e.stopPropagation(); undo(e.key.toLowerCase() === 'y' || e.shiftKey); return; }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const tools = { g: 'Move', s: 'Scale', r: 'Rotate', e: 'Extrude', i: 'Inset' }, key = e.key.toLowerCase();
    if (phase === 'edit' && tools[key]) { e.preventDefault(); e.stopPropagation(); chooseTool(tools[key]); }
  };
  const addToModel = async () => {
    setBusy(true); onBusyChange(true); setError('');
    try {
      const items = draft.shapes.map(shape => ({ mesh: forgeShapeMesh(shape), texturePath: shape.texturePath, asset: shape.texturePath === THUMPER_TEXTURE ? { name: THUMPER_TEXTURE, source: 'forge', bytes: encodeForgeTga(helmet) } : stock?.asset }));
      const result = await onCommit({ items }); if (result !== false) onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); onBusyChange(false); }
  };
  return <div className="forge-shape-workspace" onKeyDown={keys}><div className="forge-shape-body forge-primitives"><aside>
    {!!draft.shapes.length && <div className="forge-draft-shapes" role="group" aria-label="Forge shapes">{draft.shapes.map(shape => <button key={shape.id} className={draft.selection[shape.id]?.length ? 'active' : ''} aria-label={`Edit ${shape.name} ${shape.id}`} onClick={e => { const before = current.current; update({ ...before, mode: 'Shape', selection: { ...(e.shiftKey && before.mode === 'Shape' ? before.selection : {}), [shape.id]: ['shape'] } }); setPhase('edit'); chooseTool(['Extrude', 'Inset'].includes(tool) ? 'Move' : tool); }}><i style={{ background: forgeShapeColor(shape.id) }}/>{shape.name} {shape.id}{!shape.committed && <span> •</span>}</button>)}</div>}
    {phase === 'create' ? <>
    <div className="forge-shape-gallery" role="group" aria-label="Shape">{FORGE_SHAPES.map(shape => <button key={shape} aria-label={shape} aria-pressed={settings.shape === shape} className={settings.shape === shape ? 'active' : ''} onClick={() => setting('shape', shape)}><ShapeThumbnail shape={shape}/><span>{shape}</span></button>)}</div><div className="forge-dimensions">
    {['width', 'height', ...(FLAT_FORGE_SHAPES.includes(settings.shape) ? [] : ['depth'])].map(key => <label key={key}>{key[0].toUpperCase() + key.slice(1)}<input aria-label={key[0].toUpperCase() + key.slice(1)} type="number" min="0.01" max="100000" value={settings[key]} onChange={e => setting(key, +e.target.value)}/></label>)}
    {FLAT_FORGE_SHAPES.includes(settings.shape) && <label>Thickness<input aria-label="Shape thickness" type="number" min="0" max="100000" step="0.5" value={settings.thickness} onChange={e => setting('thickness', +e.target.value)}/></label>}
    {settings.shape === 'Torus' && <label>Thickness (%)<input aria-label="Tube thickness" type="number" min="5" max="45" value={settings.tube} onChange={e => setting('tube', +e.target.value)}/></label>}
    </div>{settings.shape !== 'Plane' && !isThumper && <><label>Detail<strong>{settings.complexity} / 4</strong></label><input aria-label="Shape complexity" type="range" min="1" max="4" step="1" value={settings.complexity} onChange={e => setting('complexity', +e.target.value)}/></>}
    <details><summary>Placement</summary>{['position', 'rotation'].map(key => <div key={key}><p>{key === 'position' ? 'Position' : 'Rotation (degrees)'}</p>{['X', 'Y', 'Z'].map((axis, i) => <label key={axis}>{axis}<input aria-label={`Shape ${key} ${axis}`} type="number" value={settings[key][i]} onChange={e => setting(key, settings[key].map((n, j) => j === i ? +e.target.value : n))}/></label>)}</div>)}</details></> : phase === 'edit' ? <>
    <div className="forge-edit-tools" role="group" aria-label="Shape controls">{['Move', 'Scale', 'Rotate', 'Extrude', 'Inset'].map((value, i) => <button key={value} title={`${value} (${['G', 'S', 'R', 'E', 'I'][i]}) · drag the shape or the slider`} aria-pressed={tool === value} className={tool === value ? 'active' : ''} onClick={() => chooseTool(value)}>{value}</button>)}</div>
    <div className="forge-live-adjustment"><span>{tool} · {draft.mode === 'Shape' ? 'whole shape' : draft.mode === 'Edges' ? 'edge' : pickedCount > 1 ? `${pickedCount} faces` : 'face'}</span><div><button aria-label={`Less ${tool.toLowerCase()}`} onClick={() => { begin(); adjust(-10); end(); }}>−</button><input aria-label="Shape adjustment" type="range" min="-100" max="100" value={adjustment} onPointerDown={begin} onChange={e => adjust(+e.target.value)} onPointerUp={end} onPointerCancel={cancel} onBlur={() => gesture.current && end()} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } }} onKeyUp={end}/><button aria-label={`More ${tool.toLowerCase()}`} onClick={() => { begin(); adjust(10); end(); }}>+</button></div></div>
    <p className="forge-hint">Drag to {tool.toLowerCase()}. Click a face or edge to work on it.<br/>Shift adds to selection. Alt-drag rotates the view.</p>
    </> : null}
    {!!draft.shapes.length && <div className="forge-edit-history"><button disabled={!historySize[0]} onClick={() => undo(false)}>Undo</button><button disabled={!historySize[1]} onClick={() => undo(true)}>Redo</button></div>}
  </aside><div className="forge-shape-preview"><div className="forge-preview-heading"><h3>{phase === 'create' ? settings.shape : 'Shapes'}</h3><div className="forge-preview-switches"><label className="forge-check"><input type="checkbox" checked={wire} onChange={e => setWire(e.target.checked)}/>Wireframe</label><label className="forge-check"><input type="checkbox" checked={checker} onChange={e => setChecker(e.target.checked)}/>Checker</label></div></div><ForgePreview preferences={preferences} geosets={geosets} image={phase === 'create' ? isThumper ? helmet : stock?.image : null} wire={wire} checker={checker} initialView="oblique" viewAxes={SHAPE_AXES} meshEditing={{ entries, shapes: draft.shapes, selection: draft.selection, mode: draft.mode, tool, onPick, onBegin: begin, onTransform: transform, onEnd: end, onCancel: cancel }}/><div className="forge-counts" aria-live="polite">{entries.reduce((n, e) => n + e.geoset.Vertices.length / 3, 0)} vertices · {entries.reduce((n, e) => n + e.geoset.Faces.length / 3, 0)} triangles</div></div></div>
  {!isThumper && phase === 'create' && textureError && <div role="status" className="forge-error">{textureError}</div>}
  {(error || phase === 'create' && preview.error) && <div role="alert" className="forge-error">{error || preview.error}</div>}<footer><button disabled={busy} onClick={onClose}>Cancel</button>{phase === 'edit' && <button disabled={busy} onClick={commit}>Commit</button>}<button disabled={busy || phase === 'create' && !preview.mesh} onClick={addShape}>Add shape</button><button className="forge-primary" disabled={busy || !draft.shapes.length} onClick={addToModel}>{busy ? 'Working…' : 'Add to model'}</button></footer></div>;
}
