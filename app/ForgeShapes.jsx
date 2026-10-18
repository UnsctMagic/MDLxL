import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { createPortal } from 'react-dom';
import { ArrowUpFromLine, Scissors, PackagePlus } from 'lucide-react';
import { Tool } from './EditorControls.jsx';
import { transformVertices } from '../src/editor-commands.js';
import { buildForgePrimitive, FORGE_SHAPES, FLAT_FORGE_SHAPES, PRIMITIVE_DEFAULTS, PRIMITIVE_TEXTURE } from '../src/forge-primitives.js';
import { thumperImage, THUMPER_TEXTURE, THUMPER_COLORS } from '../src/forge-thumper.js';
import { encodeForgeTga } from '../src/forge.js';
import ForgeEditor from './ForgeEditor.jsx';
import { ForgeMoldTools, ForgeMoldControls } from './ForgeMoldTools.jsx';
import { forgeMoldState, prepareForgeMold, previewForgeMold, clamp } from '../src/forge-molding.js';
import { forgeMoldHandles } from './forge-mold-handles.js';
import { pickEditHandle } from './viewport-edit-handles.js';

import { HotkeyBadge } from './Hotkeys.jsx';
import { normalDragTranslation } from './viewport-math.js';
import { SURFACE_COLORS, forgeModelingOverlay } from './forge-surface-colors.js';
import { forgePartsFromVertices, forgeVertexSelection, pickForgeParts, pickForgePoint } from './forge-viewport-selection.js';
import { createForgeShape, forgeShapeMesh, forgeSelectionVertices, forgeSelectionCenter, forgeSelectionNormal, extrudeForgeFaces, insetForgeFaces, forgeCutFrame, cutForgeShape } from '../src/forge-shape-editing.js';

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
  const [historySize, setHistorySize] = useState([0, 0]), [frame, setFrame] = useState(0), [toolRequest, requestTool] = useState(null);
  const history = useRef([]), future = useRef([]), clipboard = useRef([]), nextId = useRef(1), viewBasis = useRef({ up: [0, 0, 1], normal: [0, -1, 0] });
  const [extrudeReady, setExtrudeReady] = useState(false), [preview, setPreview] = useState(null);
  const extrusion = useRef(null);
  useEffect(() => { extrusion.current = null; setPreview(null); setExtrudeReady(false); }, [draft]);
  const [cut, setCut] = useState(null), workspace = useRef(null);
  useEffect(() => { setCut(null); }, [draft]);
  const cutResult = (state, hover = false) => {
    const sections = Number(state.sections);
    if (state.mode === 'equal' && (!Number.isInteger(sections) || sections < 2 || sections > 64)) throw Error('Choose between 2 and 64 sections.');
    const shapes = draft.shapes.map(shape => {
      if (!state.frames[shape.id]) return shape;
      const fractions = state.mode === 'equal' ? Array.from({ length: sections - 1 }, (_, i) => (i + 1) / sections) : [...(state.positions[shape.id] || []), ...(hover && state.hover?.shapeId === shape.id ? [state.hover.fraction] : [])];
      return { ...cutForgeShape(shape, state.frames[shape.id], fractions, state.faces?.[shape.id]), committed: false };
    });
    return { ...draft, shapes, mode: state.faces ? 'Faces' : 'Shape', selection: Object.fromEntries(shapes.filter(s => state.frames[s.id]).map(shape => [shape.id, state.faces ? shape.faces.filter(f => state.faces[shape.id].includes(f.id) || f.id >= draft.shapes.find(s => s.id === shape.id).nextFaceId).map(f => f.id) : ['shape']])) };
  };
  const cutPreview = useMemo(() => { if (!cut || cut.base !== draft) return null; try { return { draft: cutResult(cut, true) }; } catch (e) { return { error: e.message }; } }, [cut, draft]);
  const [mold, setMold] = useState(null), moldDrag = useRef(null);
  useEffect(() => { setMold(null); moldDrag.current = null; }, [draft]);
  const moldSupport = useMemo(() => {
    if (!mold) return null;
    try { return { draft: prepareForgeMold(draft, mold) }; } catch (e) { return { error: e.message }; }
  }, [draft, mold?.tool, mold?.axis, mold?.center, mold?.width]);
  const moldResult = useMemo(() => {
    if (!mold || !moldSupport?.draft) return moldSupport;
    try { return { draft: previewForgeMold(draft, moldSupport.draft, mold) }; } catch (e) { return { error: e.message }; }
  }, [draft, mold, moldSupport]);
  const handles = useMemo(() => mold ? forgeMoldHandles(mold) : null, [mold]);
  const shown = moldResult?.draft || cutPreview?.draft || preview || draft;
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
  const entries = useMemo(() => shown.shapes.map(shape => ({ shape, mesh: forgeShapeMesh(shape) })), [shown.shapes]);
  const surfaceColors = useMemo(() => entries.map((_, i) => SURFACE_COLORS[i % SURFACE_COLORS.length]), [entries]);
  const modelingOverlay = useMemo(() => entries.map(({ shape, mesh }) => forgeModelingOverlay(shape, mesh, shown.selection[shape.id], shown.mode)), [entries, shown.selection, shown.mode]);
  const model = useMemo(() => ({ Version: 800, Info: { Name: 'Forge' }, Nodes: [], Bones: [], PivotPoints: [], Sequences: [], GlobalSequences: [], GeosetAnims: [], TextureAnims: [], Textures: [{ Image: PRIMITIVE_TEXTURE }, { Image: THUMPER_TEXTURE }], Materials: [0, 1].map(TextureID => ({ Layers: [{ TextureID, Alpha: 1, Shading: 16 }] })), Geosets: entries.map(({shape, mesh}) => ({ ...mesh.geosets[0], MaterialID: shape.texturePath === THUMPER_TEXTURE ? 1 : 0 })) }), [entries]);
  const textureAssets = useMemo(() => new Map([[PRIMITIVE_TEXTURE, stock], [THUMPER_TEXTURE, { name: THUMPER_TEXTURE, bytes: encodeForgeTga(helmet) }]]), [stock, helmet]);
  const selection = useMemo(() => forgeVertexSelection(entries, shown.selection, shown.mode), [entries, shown.selection, shown.mode]);
  const selected = draft.shapes.filter(s => draft.selection[s.id]?.length), count = Object.values(draft.selection).reduce((n, ids) => n + ids.length, 0);
  const chooseMode = mode => {
    const sourceEntries = cut ? draft.shapes.map(shape => ({ shape, mesh: forgeShapeMesh(shape) })) : entries;
    const selectedVertices = forgeVertexSelection(sourceEntries, draft.selection, draft.mode);
    setDraft({ ...draft, mode, selection: forgePartsFromVertices(sourceEntries, selectedVertices, mode) });
    requestTool({ tool: 'select' });
  };
  const selectFace = event => {
    const picked = pickForgeParts(entries, {}, 'Faces', event);
    if (!Object.values(picked).some(ids => ids.length)) return;
    // Shift+double-click adds the face to faces already chosen.
    const keep = event.start?.shift && draft.mode === 'Faces';
    const selection = keep ? Object.fromEntries(entries.map(({ shape }) => [shape.id, [...new Set([...(draft.selection[shape.id] || []), ...picked[shape.id]])]])) : picked;
    setDraft({ ...draft, selection, mode: 'Faces' });
    requestTool({ tool: 'translate' });
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
      const floor = Math.min(...shape.vertices.map(p => p[2]));
      shape = { ...shape, vertices: shape.vertices.map(([x, y, z]) => [x, y, z - floor]) };
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
  const cancelExtrude = () => {
    if (!extrudeReady && !extrusion.current) return false;
    extrusion.current = null; setPreview(null); setExtrudeReady(false);
    return true;
  };
  const cancelMold = () => { if (!mold) return false; moldDrag.current = null; setMold(null); requestTool({ tool: 'translate', focus: true }); return true; };
  const openMold = tool => {
    try { cancelExtrude(); cancelCut(); setMold(forgeMoldState(draft, tool)); setPalette(false); setError(''); requestTool({ tool: 'translate', focus: true }); }
    catch (e) { setError(e.message); }
  };
  const applyMold = () => {
    if (!mold?.amount || !moldResult?.draft || moldResult.error) return;
    change(moldResult.draft); cancelMold(); requestTool({ tool: 'translate', focus: true });
  };
  const startMoldDrag = event => {
    const handle = pickEditHandle(handles, event);
    if (!handle) return { update() {}, finish() {}, cancel: cancelMold };
    const before = mold, session = {}; moldDrag.current = session;
    const axis = handle.id === 'amount' ? mold.direction : mold.axis, normal = new Vector3().setComponent(axis, 1), pivot = new Vector3(...handle.position);
    return {
      update: end => {
        if (moldDrag.current !== session) return;
        const delta = normalDragTranslation(event.camera, pivot, normal, end.width, end.height, end.x-event.start.x, end.y-event.start.y).getComponent(axis);
        const size = Math.max(...before.bounds.span, 1), length = Math.max(before.bounds.span[before.axis], 1);
        if (handle.id === 'center') setMold({ ...before, center: clamp(before.center+delta,before.bounds.min[before.axis],before.bounds.max[before.axis]) });
        else if (handle.id.startsWith('range')) setMold({ ...before, width: clamp(before.width+delta*(handle.id==='rangeStart'?-2:2),length*.05,length*2) });
        else {
          const amount = before.tool==='Bend'||before.tool==='Twist' ? clamp(before.amount+delta/size*180,-180,180) : before.tool==='Bevel' ? Math.max(0,before.amount+delta) : clamp(before.amount+delta/Math.max(before.bounds.span[before.direction]/2,size*.12),-.9,3);
          setMold({ ...before, amount });
        }
      },
      finish: () => { moldDrag.current = null; },
      cancel: cancelMold,
    };
  };
  const cancelCut = () => { if (!cut) return false; setCut(null); return true; };
  const cutFrames = turned => Object.fromEntries(selected.map(shape => [shape.id, forgeCutFrame(shape, draft.mode === 'Faces' ? draft.selection[shape.id]?.[0] : undefined, turned, draft.mode === 'Faces' ? draft.selection[shape.id] : undefined)]));
  const openCut = event => {
    try { const r = event.currentTarget.getBoundingClientRect(), w = event.currentTarget.ownerDocument.defaultView; cancelMold(); cancelExtrude(); setCut({ base: draft, mode: 'equal', sections: '4', turned: false, frames: cutFrames(false), faces: draft.mode === 'Faces' ? draft.selection : null, position: { right: Math.max(8, w.innerWidth - r.right), top: Math.max(8, Math.min(w.innerHeight - 200, r.bottom + 4)) }, positions: {}, hover: null }); setPalette(false); setError(''); requestTool({ tool: 'translate' }); }
    catch (e) { setError(e.message); }
  };
  const cutPosition = event => {
    if (!event || !cut) return null;
    const hit = pickForgePoint(entries, event), frame = hit && cut.frames[hit.shapeId];
    if (!frame || cut.faces && !shown.selection[hit.shapeId]?.includes(hit.faceId)) return null;
    const fraction = (hit.point.reduce((n, v, i) => n + v * frame.direction[i], 0) - frame.min) / (frame.max - frame.min);
    return fraction > 1e-6 && fraction < 1 - 1e-6 ? { shapeId: hit.shapeId, fraction: Math.round(fraction * 10000) / 10000 } : null;
  };
  const hoverCut = event => {
    const hover = cutPosition(event);
    setCut(previous => !previous || previous.mode !== 'manual' || previous.hover?.shapeId === hover?.shapeId && previous.hover?.fraction === hover?.fraction ? previous : { ...previous, hover });
  };
  const placeCut = event => {
    let position = cut.mode === 'manual' ? cutPosition(event) : null;
    return { update: end => { if (cut.mode === 'manual') { position = cutPosition({ ...event, end }); hoverCut({ ...event, end }); } },
      finish: () => { if (position) setCut(previous => previous ? { ...previous, positions: { ...previous.positions, [position.shapeId]: [...new Set([...(previous.positions[position.shapeId] || []), position.fraction])] }, hover: null } : previous); },
      cancel: cancelCut };
  };
  const applyCuts = () => { try { const result = cutResult(cut); change(result); setCut(null); requestTool({ tool: 'translate' }); } catch (e) { setError(e.message); } };
  const startExtrude = event => {
    const selection = Object.fromEntries(draft.shapes.map(s => { if (draft.mode === 'Faces') return [s.id, draft.selection[s.id] || []]; const ids = new Set(forgeSelectionVertices(s, draft.selection[s.id], draft.mode)); return [s.id, s.faces.filter(f => f.vertices.every(id => ids.has(id))).map(f => f.id)]; }));
    const hit = pickForgeParts(entries, {}, 'Faces', event);
    const picked = draft.shapes.find(s => hit[s.id]?.some(id => selection[s.id].includes(id)));
    if (!picked) return null;
    const before = draft, session = { next: before }; extrusion.current = session;
    const normal = new Vector3(...forgeSelectionNormal([picked], selection));
    const pivot = new Vector3(...forgeSelectionCenter([picked], selection, 'Faces'));
    return {
      update: end => {
        if (extrusion.current !== session) return;
        try {
          const delta = normalDragTranslation(event.camera, pivot, normal, end.width, end.height, end.x - event.start.x, end.y - event.start.y).toArray();
          if (Math.hypot(...delta) < 1e-8) { session.next = before; setPreview(null); return; }
          const distance = new Vector3(...delta).dot(normal);
          const shapes = before.shapes.map(shape => selection[shape.id].length ? { ...extrudeForgeFaces(shape, selection[shape.id], forgeSelectionNormal([shape], selection).map(n => n * distance)), committed: false } : shape);
          session.next = { ...before, shapes, selection, mode: 'Faces' }; setPreview(session.next);
        } catch (e) { cancelExtrude(); setError(e.message); }
      },
      finish: () => {
        if (extrusion.current !== session) return;
        if (session.next !== before) { record(before); setDraft(session.next); setError(''); }
        cancelExtrude();
      },
      cancel: cancelExtrude,
    };
  };
  const faceOperation = kind => {
    if (extrusion.current) return;
    cancelMold();
    if (kind === 'Extrude') { setExtrudeReady(true); setError(''); requestTool({ tool: 'translate' }); return; }
    cancelExtrude();
    try {
      const selection = Object.fromEntries(draft.shapes.map(s => { if (draft.mode === 'Faces') return [s.id, draft.selection[s.id] || []]; const ids = new Set(forgeSelectionVertices(s, draft.selection[s.id], draft.mode)); return [s.id, s.faces.filter(f => f.vertices.every(id => ids.has(id))).map(f => f.id)]; }));
      const shapes = draft.shapes.map(shape => {
        const ids = selection[shape.id]; if (!ids.length) return shape;
        const points = forgeSelectionVertices(shape, ids, 'Faces').map(id => shape.vertices[id]), size = Math.max(1, ...[0,1,2].map(a => Math.max(...points.map(p => p[a])) - Math.min(...points.map(p => p[a]))));
        return { ...insetForgeFaces(shape, ids, size * .08), committed: false };
      });
      change({ ...draft, shapes, selection, mode: 'Faces' }); requestTool({tool:'translate'});
    } catch (e) { setError(e.message); }
  };
  const faceCount = draft.shapes.reduce((n, s) => { if (draft.mode === 'Faces') return n + (draft.selection[s.id]?.length || 0); const ids = new Set(forgeSelectionVertices(s, draft.selection[s.id], draft.mode)); return n + s.faces.filter(f => f.vertices.every(id => ids.has(id))).length; }, 0);
  const addToModel = async () => {
    setBusy(true); onBusyChange(true); setError('');
    try {
      const items = draft.shapes.map(shape => ({ mesh: forgeShapeMesh(shape), texturePath: shape.texturePath, asset: shape.texturePath === THUMPER_TEXTURE ? { name: THUMPER_TEXTURE, source: 'forge', bytes: encodeForgeTga(helmet) } : stock }));
      if (await onCommit({ items }) !== false) onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); onBusyChange(false); }
  };
  const paletteUI = <div className="forge-add-menu" role="group" aria-label="Add shape"><div className="forge-shape-gallery">{FORGE_SHAPES.map(shape => <button data-hotkey={'forge:shape:primitive:'+shape} key={shape} aria-label={shape} title={'Add '+shape} onClick={() => addShape(shape)}><ShapeThumbnail shape={shape}/><span>{shape}</span></button>)}</div><div className="forge-dimensions">{['width','height','depth'].map(key => <label key={key}>{key[0].toUpperCase()+key.slice(1)}<HotkeyBadge actionId={'forge:shape:parameter:'+key}/><input data-hotkey={'forge:shape:parameter:'+key} aria-label={key[0].toUpperCase()+key.slice(1)} type="number" min=".01" value={settings[key]} onChange={e => setting(key,+e.target.value)}/></label>)}</div><label>Detail<HotkeyBadge actionId="forge:shape:parameter:detail"/><input data-hotkey="forge:shape:parameter:detail" aria-label="Shape complexity" type="range" min="1" max="4" value={settings.complexity} onChange={e => setting('complexity',+e.target.value)}/>{settings.complexity}</label><details><summary data-hotkey="forge:shape:thickness">Thickness<HotkeyBadge actionId="forge:shape:thickness"/></summary><label>Flat shapes<HotkeyBadge actionId="forge:shape:parameter:thickness"/><input data-hotkey="forge:shape:parameter:thickness" aria-label="Shape thickness" type="number" min="0" step=".5" value={settings.thickness} onChange={e => setting('thickness',+e.target.value)}/></label><label>Torus (%)<HotkeyBadge actionId="forge:shape:parameter:tube"/><input data-hotkey="forge:shape:parameter:tube" aria-label="Tube thickness" type="number" min="5" max="45" value={settings.tube} onChange={e => setting('tube',+e.target.value)}/></label></details></div>;
  const cutUI = <><Tool action="forge:shape:cut" title="Cut" active={!!cut} disabled={!selected.length} description="Cut: divide the selected faces, or the whole piece in Shape mode. Preview equal sections or place your own cuts." onClick={event => cut ? cancelCut() : openCut(event)}><Scissors className="modern-retro-icon modern-retro-gold" aria-hidden="true" strokeWidth={2.25}/></Tool>{cut && createPortal(<div style={cut.position} className="forge-cut-menu" role="group" aria-label="Cut controls">
        <div className="forge-cut-row"><button aria-pressed={cut.mode==='equal'} onClick={() => setCut({ ...cut, mode: 'equal', hover: null })}>Equal sections</button><button aria-pressed={cut.mode==='manual'} onClick={() => setCut({ ...cut, mode: 'manual', hover: null })}>Place cuts</button></div>
        {cut.mode==='equal' ? <label title="Preview evenly spaced sections before applying them.">Sections<input aria-label="Cut sections" type="number" min="2" max="64" value={cut.sections} onChange={e => setCut({ ...cut, sections: e.target.value })}/></label> : <small>Point at the piece to preview a cut. Click to place it; repeat for more.</small>}
        <div className="forge-cut-row"><button title="Turn the cut lines across the selected surface." onClick={() => setCut({ ...cut, turned: !cut.turned, frames: cutFrames(!cut.turned), hover: null })}>Turn cuts</button>{cut.mode==='manual' && <button onClick={() => setCut({ ...cut, positions: {}, hover: null })}>Clear cuts</button>}</div>
        <div className="forge-cut-row"><button aria-label="Apply cuts" disabled={!!cutPreview?.error || cut.mode==='manual' && !Object.values(cut.positions).some(p=>p.length)} onClick={applyCuts}>Apply</button><button aria-label="Cancel cuts" onClick={cancelCut}>Cancel</button></div>
      </div>, workspace.current)}</>;
  return <div ref={workspace} className="forge-shape-workspace" data-hotkey-scope="forge-shapes" data-hotkey-category="MDLxL FORGE">
    <ForgeEditor model={model} preferences={preferences} editorState={{ ...editorState, quadView: false }} initialView="perspective" initialGrid frameGrid={false} surfaceColors={surfaceColors} modelingOverlay={modelingOverlay} selection={selection} onSelectionChange={cut ? undefined : onSelectionChange} onSelectParts={draft.mode==='Vertices' ? undefined : event => setDraft({ ...draft, selection: pickForgeParts(entries, draft.selection, draft.mode, event) })} onDoubleClickParts={cut ? () => {} : selectFace} onHoverParts={cut?.mode === 'manual' ? hoverCut : undefined} onStartPartDrag={mold ? startMoldDrag : cut ? placeCut : extrudeReady ? startExtrude : undefined} onCancelPartDrag={() => cancelMold() || cancelCut() || cancelExtrude()} onTransform={cut ? undefined : transform} onView={(up, normal) => {viewBasis.current={up,normal};}} frame={frame} toolRequest={toolRequest} textureAssets={textureAssets}
      onUndo={() => { if (window.dispatchEvent(new Event('mdlxl-cancel-gesture', { cancelable: true }))) undo(false); }} onRedo={() => undo(true)} canUndo={!!mold || !!cut || extrudeReady || historySize[0]>0} canRedo={!mold && !cut && !extrudeReady && historySize[1]>0} onDelete={remove} duplicateAction="forge:shape:duplicate" onDuplicate={() => duplicate()} onCopy={() => {clipboard.current=structuredClone(selected);}} onPaste={() => duplicate(clipboard.current)} canCopy={selected.length>0}

      editHandles={handles}
      shapingTools={<ForgeMoldTools active={mold?.tool} disabled={!selected.length} onChoose={openMold}/>}
      viewportTools={<ForgeMoldControls state={mold} error={moldResult?.error} onChange={setMold} onApply={applyMold} onCancel={cancelMold}/>}
      controlPoints={<div className="forge-selection-scope" role="group" aria-label="Control points">{[['Shape','Shape','M4 7 12 3 20 7 20 17 12 21 4 17Z M4 7 12 11 20 7 M12 11V21','Select and move whole pieces. Double-click a surface to select a face; Shift+double-click adds more faces.'],['Edges','Edge','M4 18 20 6 M4 15V21 M20 3V9','Select and move the edges of a piece.'],['Vertices','Vertex','M5 5H19V19H5Z','Select and move individual points to reshape a piece.']].map(([mode,label,path,description]) => <Tool action={'forge:shape:mode:'+mode} title={label} key={mode} description={description} active={draft.mode===mode} onClick={() => chooseMode(mode)}><svg viewBox="0 0 24 24" className="modern-retro-icon modern-retro-gold" aria-hidden="true"><path d={path}/>{mode==='Vertices' && [[5,5],[19,5],[5,19],[19,19]].map(([x,y])=><circle key={x+','+y} cx={x} cy={y} r="2.5"/>)}</svg></Tool>)}</div>}
      operations={<div className="forge-shape-operations">
        <div className="forge-add-control"><Tool action="forge:shape:add" title="Add shape" description="Add a new piece to mold." active={palette} onClick={() => setPalette(!palette)}><PackagePlus className="modern-retro-icon modern-retro-gold" aria-hidden="true" strokeWidth={2.25}/></Tool></div>
        <Tool action="forge:shape:extrude" title="Extrude" description="Extrude: drag the selected face to extend it; release to finish. Escape cancels." disabled={!!cut || !faceCount || draft.mode==='Shape'} active={extrudeReady} onClick={() => faceOperation('Extrude')}><ArrowUpFromLine className="modern-retro-icon modern-retro-gold" aria-hidden="true" strokeWidth={2.25}/></Tool>
        <Tool action="forge:shape:inset" title="Inset" description="Inset: make a smaller face inside the selected face, leaving a border around it." disabled={!!cut || !faceCount || draft.mode==='Shape'} onClick={() => faceOperation('Inset')}><svg viewBox="0 0 24 24" className="modern-retro-icon modern-retro-gold" aria-hidden="true" strokeWidth={2.25}><rect x="3" y="3" width="18" height="18"/><rect x="8" y="8" width="8" height="8"/></svg></Tool>
        {cutUI}
      </div>}
      sidebar={<><div className="forge-section-title">Shapes</div><div className="forge-draft-shapes" role="group" aria-label="Forge shapes">{draft.shapes.map(shape => <button key={shape.id} aria-label={'Edit '+shape.name+' '+shape.id} className={draft.selection[shape.id]?.length?'active':''} onClick={e => {setDraft({...draft,mode:'Shape',selection:{...(e.shiftKey?draft.selection:{}),[shape.id]:['shape']}});}}>{shape.name} {shape.id}</button>)}</div></>}
      status={error || moldResult?.error || (mold ? 'Drag the gold handle to shape · Center / Range choose the affected area · ✓ keeps · Esc cancels' : '') || cutPreview?.error || (cut ? 'Cut preview · Apply to keep · Esc cancels' : '') || (extrudeReady ? 'Extrude ready · drag the selected face · release to finish · Esc cancels' : '') || (count ? count+' '+(draft.mode==='Shape'?'shape(s)':draft.mode.toLowerCase())+' selected' : 'Add a shape · select and edit with the vertex editor controls')}/>
    {palette && paletteUI}
    <footer><button data-hotkey="forge:shape:cancel" aria-label="Cancel" disabled={busy} onClick={onClose}>Cancel</button><button data-hotkey={mold ? undefined : "forge:shape:commit"} aria-label="Commit shape" disabled={!!mold || !!cut || !draft.shapes.length || busy} onClick={() => {setDraft({...draft,selection:{},shapes:draft.shapes.map(s=>({...s,committed:true}))});requestTool({tool:'select'});setError('Shape committed · Add another shape or continue editing');}}>Commit shape</button><button data-hotkey="forge:shape:add-model" aria-label="Add to model" className="forge-primary" disabled={!!mold || !!cut || !draft.shapes.length || busy} onClick={addToModel}>{busy?'Working…':'Add to model'}</button></footer>

  </div>;
}
