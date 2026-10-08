import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { transformVertices } from '../src/editor-commands.js';
import { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES, PRIMITIVE_DEFAULTS, PRIMITIVE_TEXTURE } from '../src/forge-primitives.js';
import { thumperImage, THUMPER_TEXTURE, THUMPER_COLORS } from '../src/forge-thumper.js';
import { encodeForgeTga } from '../src/forge.js';
import ForgeEditor from './ForgeEditor.jsx';
import ShapingDialog from './ShapingDialog.jsx';
import { forgePartsFromVertices, forgeVertexSelection, pickForgeParts } from './forge-viewport-selection.js';
import { createForgeShape, forgeShapeMesh, forgeSelectionVertices, forgeSelectionCenter, forgeSelectionNormal, extrudeForgeFaces, insetForgeFaces } from '../src/forge-shape-editing.js';

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


export default function ForgeShapes({ modelPath, preferences, editorState, onClose, onCommit, onBusyChange }) {
  const [settings, setSettings] = useState(PRIMITIVE_DEFAULTS), [palette, setPalette] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [stock, setStock] = useState(null), [draft, setDraft] = useState({ shapes: [], selection: {}, mode: 'Shape' });
  const [historySize, setHistorySize] = useState([0, 0]), [frame, setFrame] = useState(0), [toolRequest, requestTool] = useState(null), [shaping, setShaping] = useState(false);
  const history = useRef([]), future = useRef([]), clipboard = useRef([]), nextId = useRef(1), viewBasis = useRef({ up: [0, 0, 1], normal: [0, -1, 0] });
  const helmet = useMemo(thumperImage, []);
  useEffect(() => {
    let active = true;
    (async () => {
      const records = await window.desktop?.resolveTextures({ path: modelPath, names: [PRIMITIVE_TEXTURE] });
      const asset = records?.find(record => record.bytes);
      if (asset && active) setStock(asset);
    })().catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [modelPath]);
  const record = before => { history.current.push(before); if (history.current.length > 80) history.current.shift(); future.current = []; setHistorySize([history.current.length, 0]); };
  const change = next => { record(draft); setDraft(next); setError(''); };
  const undo = redo => { const from = redo ? future.current : history.current, to = redo ? history.current : future.current, previous = from.pop(); if (!previous) return; to.push(draft); setDraft(previous); setError(''); setHistorySize([history.current.length, future.current.length]); };
  const setting = (key, value) => setSettings(s => ({ ...s, [key]: value }));
  const entries = useMemo(() => draft.shapes.map(shape => ({ shape, mesh: forgeShapeMesh(shape) })), [draft.shapes]);
  const model = useMemo(() => ({ Version: 800, Info: { Name: 'Forge' }, Nodes: [], Bones: [], PivotPoints: [], Sequences: [], GlobalSequences: [], GeosetAnims: [], TextureAnims: [], Textures: [{ Image: PRIMITIVE_TEXTURE }, { Image: THUMPER_TEXTURE }], Materials: [0, 1].map(TextureID => ({ Layers: [{ TextureID, Alpha: 1, Shading: 16 }] })), Geosets: entries.map(({shape, mesh}) => ({ ...mesh.geosets[0], MaterialID: shape.texturePath === THUMPER_TEXTURE ? 1 : 0 })) }), [entries]);
  const textureAssets = useMemo(() => new Map([[PRIMITIVE_TEXTURE, stock], [THUMPER_TEXTURE, { name: THUMPER_TEXTURE, bytes: encodeForgeTga(helmet) }]]), [stock, helmet]);
  const selection = useMemo(() => forgeVertexSelection(entries, draft.selection, draft.mode), [entries, draft.selection, draft.mode]);
  const selected = draft.shapes.filter(s => draft.selection[s.id]?.length), count = Object.values(draft.selection).reduce((n, ids) => n + ids.length, 0);
  const chooseMode = mode => {
    const selectedVertices = forgeVertexSelection(entries, draft.selection, draft.mode);
    setDraft({ ...draft, mode, selection: forgePartsFromVertices(entries, selectedVertices, mode) });
    requestTool({ tool: 'select' });
  };
  const onSelectionChange = next => setDraft({ ...draft, selection: forgePartsFromVertices(entries, next, draft.mode) });
  const transform = payload => {
    try {
      const shapes = draft.shapes.map((shape, gi) => {
        const ids = [...new Set((payload.selections?.[gi] || selection[gi] || []).map(i => entries[gi].mesh.vertexIds[i]))];
        if (!ids.length) return shape;
        const mesh = structuredClone(entries[gi].mesh.geosets[0]), affected = new Set(ids);
        const indices = entries[gi].mesh.vertexIds.flatMap((id, index) => affected.has(id) ? [index] : []);
        transformVertices(mesh, indices, payload.translation, payload.scale, payload.rotation, payload.pivot || forgeSelectionCenter(draft.shapes, draft.selection, draft.mode), {allowSingularScale:payload.allowSingularScale===true});
        const next = structuredClone(shape); next.committed = false;
        entries[gi].mesh.vertexIds.forEach((id, index) => { if (affected.has(id)) next.vertices[id] = Array.from(mesh.Vertices.slice(index*3,index*3+3)); });
        for (const face of next.faces) if (face.vertices.some(id=>affected.has(id))) face.triangles.forEach(t=>{t.normals=undefined;});
        return next;
      });
      change({ ...draft, shapes });
    } catch (e) { setError(e.message); }
  };
  const besideOffset = points => {
    const right = new Vector3(...viewBasis.current.up).cross(new Vector3(...viewBasis.current.normal)).normalize().toArray(), project = p => p.reduce((n, v, a) => n + v * right[a], 0);
    const bounds = points.reduce(([min, max], p) => [Math.min(min, project(p)), Math.max(max, project(p))], [Infinity, -Infinity]);
    const edge = draft.shapes.reduce((max, s) => s.vertices.reduce((max, p) => Math.max(max, project(p)), max), -Infinity);
    return right.map(n => n * (edge - bounds[0] + Math.max(10, (bounds[1] - bounds[0]) * .15)));
  };
  const addShape = name => {
    try {
      let shape = createForgeShape(buildForgePrimitive({ ...settings, shape: name, zUp: true }), { id: nextId.current++, name, texturePath: name === 'ThumperXL' ? THUMPER_TEXTURE : PRIMITIVE_TEXTURE });
      if (draft.shapes.length) { const delta = besideOffset(shape.vertices); shape = { ...shape, vertices: shape.vertices.map(p => p.map((n, a) => n + delta[a])) }; }
      change({ shapes: [...draft.shapes, shape], selection: { [shape.id]: ['shape'] }, mode: 'Shape' }); setPalette(false); requestTool({tool:'translate'}); setFrame(n => n + 1);
    } catch (e) { setError(e.message); }
  };
  const duplicate = (originals = selected) => {
    if (!originals.length) return;
    const delta = besideOffset(originals.flatMap(s => s.vertices)), copies = originals.map(s => ({ ...structuredClone(s), id: nextId.current++, committed: false, vertices: s.vertices.map(p => p.map((n, a) => n + delta[a])) }));
    change({ shapes: [...draft.shapes, ...copies], mode: 'Shape', selection: Object.fromEntries(copies.map(s => [s.id, ['shape']])) }); requestTool({tool:'translate'}); setFrame(n => n + 1);
  };
  const remove = () => {
    const shapes = draft.shapes.flatMap(shape => {
      const ids = draft.selection[shape.id]; if (!ids?.length) return [shape]; if (draft.mode === 'Shape') return [];
      const vertices = new Set(forgeSelectionVertices(shape, ids, draft.mode));
      const faces = shape.faces.filter(face => draft.mode === 'Faces' ? !ids.includes(face.id) : !face.vertices.some(id => vertices.has(id)));
      return faces.length ? [{ ...shape, faces, committed: false }] : [];
    });
    change({ ...draft, shapes, selection: {} });
  };
  const faceOperation = kind => {
    try {
      const selection = Object.fromEntries(draft.shapes.map(s => { const ids = new Set(forgeSelectionVertices(s, draft.selection[s.id], draft.mode)); return [s.id, s.faces.filter(f => f.vertices.every(id => ids.has(id))).map(f => f.id)]; }));
      const shapes = draft.shapes.map(shape => {
        const ids = selection[shape.id]; if (!ids.length) return shape;
        const points = forgeSelectionVertices(shape, ids, 'Faces').map(id => shape.vertices[id]), size = Math.max(1, ...[0,1,2].map(a => Math.max(...points.map(p => p[a])) - Math.min(...points.map(p => p[a]))));
        return { ...(kind === 'Extrude' ? extrudeForgeFaces(shape, ids, forgeSelectionNormal([shape], { [shape.id]: ids }).map(n => n * 10)) : insetForgeFaces(shape, ids, size * .08)), committed: false };
      });
      change({ ...draft, shapes, selection, mode: 'Faces' }); requestTool({tool:'translate'});
    } catch (e) { setError(e.message); }
  };
  const faceCount = draft.shapes.reduce((n, s) => { const ids = new Set(forgeSelectionVertices(s, draft.selection[s.id], draft.mode)); return n + s.faces.filter(f => f.vertices.every(id => ids.has(id))).length; }, 0);
  const addToModel = async () => {
    setBusy(true); onBusyChange(true); setError('');
    try {
      const items = draft.shapes.map(shape => ({ mesh: forgeShapeMesh(shape), texturePath: shape.texturePath, asset: shape.texturePath === THUMPER_TEXTURE ? { name: THUMPER_TEXTURE, source: 'forge', bytes: encodeForgeTga(helmet) } : stock }));
      if (await onCommit({ items }) !== false) onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); onBusyChange(false); }
  };
  const paletteUI = <div className="forge-add-menu" role="group" aria-label="Add shape"><div className="forge-shape-gallery">{FORGE_SHAPES.map(shape => <button key={shape} aria-label={shape} title={'Add '+shape} onClick={() => addShape(shape)}><ShapeThumbnail shape={shape}/><span>{shape}</span></button>)}</div><div className="forge-dimensions">{['width','height','depth'].map(key => <label key={key}>{key[0].toUpperCase()+key.slice(1)}<input aria-label={key[0].toUpperCase()+key.slice(1)} type="number" min=".01" value={settings[key]} onChange={e => setting(key,+e.target.value)}/></label>)}</div><label>Detail<input aria-label="Shape complexity" type="range" min="1" max="4" value={settings.complexity} onChange={e => setting('complexity',+e.target.value)}/>{settings.complexity}</label><details><summary>Thickness</summary><label>Flat shapes<input aria-label="Shape thickness" type="number" min="0" step=".5" value={settings.thickness} onChange={e => setting('thickness',+e.target.value)}/></label><label>Torus (%)<input aria-label="Tube thickness" type="number" min="5" max="45" value={settings.tube} onChange={e => setting('tube',+e.target.value)}/></label></details></div>;
  return <div className="forge-shape-workspace">
    <ForgeEditor model={model} preferences={preferences} editorState={editorState} selection={selection} onSelectionChange={onSelectionChange} onSelectParts={draft.mode === 'Vertices' ? undefined : event => setDraft({ ...draft, selection: pickForgeParts(entries, draft.selection, draft.mode, event) })} onTransform={transform} onView={(up, normal) => {viewBasis.current={up,normal};}} frame={frame} toolRequest={toolRequest} textureAssets={textureAssets}
      onUndo={() => undo(false)} onRedo={() => undo(true)} canUndo={historySize[0]>0} canRedo={historySize[1]>0} onDelete={remove} onDuplicate={() => duplicate()} onCopy={() => {clipboard.current=structuredClone(selected);}} onPaste={() => duplicate(clipboard.current)} canCopy={selected.length>0}
      toolbar={<><div className="forge-add-control"><button aria-expanded={palette} onClick={() => setPalette(!palette)}>Add shape</button>{palette && paletteUI}</div><div className="forge-selection-scope" role="group" aria-label="Select">{[['Shape','Shape'],['Faces','Face'],['Edges','Edge'],['Vertices','Vertex']].map(([mode,label]) => <button key={mode} aria-pressed={draft.mode===mode} className={draft.mode===mode?'active':''} onClick={() => chooseMode(mode)}>{label}</button>)}</div></>}
      operations={<div className="forge-shape-operations"><button data-warmkey="Extrude" disabled={!faceCount || draft.mode==='Shape'} title="Extrude 10 units, then move" onClick={() => faceOperation('Extrude')}>Extrude</button><button disabled={!faceCount || draft.mode==='Shape'} onClick={() => faceOperation('Inset')}>Inset</button><button disabled={!count} onClick={() => setShaping(true)}>Shape…</button></div>}
      sidebar={<><div className="forge-section-title">Shapes</div><div className="forge-draft-shapes" role="group" aria-label="Forge shapes">{draft.shapes.map(shape => <button key={shape.id} aria-label={'Edit '+shape.name+' '+shape.id} className={draft.selection[shape.id]?.length?'active':''} onClick={e => {setDraft({...draft,mode:'Shape',selection:{...(e.shiftKey?draft.selection:{}),[shape.id]:['shape']}});}}>{shape.name} {shape.id}</button>)}</div></>}
      status={error || (count ? count+' '+(draft.mode==='Shape'?'shape(s)':draft.mode.toLowerCase())+' selected' : 'Add a shape · select and edit with the vertex editor controls')}/>
    <footer><button disabled={busy} onClick={onClose}>Cancel</button><button disabled={!draft.shapes.length || busy} onClick={() => {setDraft({...draft,selection:{},shapes:draft.shapes.map(s=>({...s,committed:true}))});requestTool({tool:'select'});setError('Shape committed · Add another shape or continue editing');}}>Commit shape</button><button className="forge-primary" disabled={!draft.shapes.length || busy} onClick={addToModel}>{busy?'Working…':'Add to model'}</button></footer>
    {shaping && <ShapingDialog model={model} preferences={preferences} editorState={editorState} selectedGeosets={entries.flatMap((e,i)=>draft.selection[e.shape.id]?.length?[i]:[])} selectionByGeoset={selection} onClose={() => setShaping(false)} onApplyModel={result => {change({...draft,shapes:entries.map(({shape},i)=>!draft.selection[shape.id]?.length?shape:createForgeShape({geosets:[result.Geosets[i]]},{id:shape.id,name:shape.name,texturePath:shape.texturePath})),selection:{},mode:'Shape'});setShaping(false);}}/>}
  </div>;
}
