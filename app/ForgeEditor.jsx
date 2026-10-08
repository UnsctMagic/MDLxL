import React, { useMemo, useRef, useState } from 'react';
import { Euler, Quaternion, Vector3 } from 'three';
import Viewport from './Viewport.jsx';
import { CameraTools, Coordinate, Tool, TransformTools, WorkplaneControls } from './EditorControls.jsx';
import { useWarmKeys } from './WarmKeys.jsx';
import { chordFromEvent, isTextEditingTarget } from '../src/preferences.js';
import { QUAD_VIEW_OPTIONS } from './quad-view.js';

// Forge uses the vertex editor itself. This component only supplies the draft
// document and the existing controls; it owns no picking or transform math.
export default function ForgeEditor({ model, preferences, editorState = {}, selection = {}, onSelectionChange, onTransform, onSelectParts, onView, frame = 0, toolRequest, toolbar, controlPoints, sidebar, operations, status, onUndo, onRedo, canUndo, canRedo, onDelete, onDuplicate, onCopy, onPaste, canCopy, textureAssets, teamColor, surfaceColors, faceShades, initialView, initialRenderMode = 'solid', wire, previewOnly = false }) {
  const [view, setStoredView] = useState(initialView || editorState.view || 'orthographic'), [quad, setQuad] = useState(!!editorState.quadView), [pane, setPane] = useState(null), [viewRequest, requestView] = useState(null);
  const [tool, setTool] = useState(editorState.tool || 'select'), [cameraMode, setCameraMode] = useState('work');
  const [workplane, setWorkplane] = useState(editorState.workplane || 'xy'), [workplaneEnabled, setWorkplaneEnabled] = useState(editorState.workplaneEnabled !== false);
  const [renderMode, setRenderMode] = useState(initialRenderMode), [vertices, setVertices] = useState(!previewOnly), [grid, setGrid] = useState(false), [grabThrough, setGrabThrough] = useState(editorState.grabThrough !== false);
  const [localFrame, setLocalFrame] = useState({ id: 0, selection: false }), [angles, setAngles] = useState({ x: 0, y: 0, z: 0 }), [angleRequest, setAngleRequest] = useState(null);
  const { shortcuts } = useWarmKeys(), root = useRef();
  const selectable = useMemo(() => new Set(model.Geosets.map((_, i) => i)), [model]);
  const points = Object.entries(selection).flatMap(([gi, ids]) => ids.map(id => Array.from(model.Geosets[gi]?.Vertices.slice(id * 3, id * 3 + 3) || []))).filter(p => p.length === 3);
  const center = points.length ? [0, 1, 2].map(a => points.reduce((sum, p) => sum + p[a], 0) / points.length) : [0, 0, 0];
  const chooseTool = next => { setTool(next); setCameraMode('work'); };
  React.useEffect(() => { if (toolRequest) chooseTool(toolRequest.tool); }, [toolRequest]);
  React.useEffect(() => { if (wire !== undefined) setRenderMode(wire ? 'wireframe' : initialRenderMode); }, [wire]);
  const toggleCamera = () => { setCameraMode(cameraMode === 'rotate' ? 'work' : 'rotate'); if (cameraMode === 'rotate' && tool === 'rotate') setTool('select'); };
  const setView = next => { setStoredView(next); requestView({ view: next, id: Date.now() }); };
  const fit = selection => setLocalFrame(previous => ({ id: previous.id + 1, selection }));
  const all = () => onSelectionChange?.(Object.fromEntries(model.Geosets.map((g, i) => [i, Array.from({ length: g.Vertices.length / 3 }, (_, v) => v)])));
  const invert = () => onSelectionChange?.(Object.fromEntries(model.Geosets.map((g, i) => { const picked = new Set(selection[i]); return [i, Array.from({ length: g.Vertices.length / 3 }, (_, v) => v).filter(v => !picked.has(v))]; })));
  const actions = { selectAll: all, clear: () => { if (window.dispatchEvent(new Event('mdlxl-cancel-gesture', {cancelable:true}))) onSelectionChange?.({}); }, invertSelection: invert, cameraToggle: toggleCamera, frame: () => setRenderMode(renderMode === 'textured' ? 'wireframe' : 'textured'), frameSelection: () => setRenderMode('solid'), wireframe: () => setRenderMode('wireframe'), grid: () => setGrid(!grid), showVertices: () => setVertices(!vertices), ...Object.fromEntries(['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'].map(v => [v, () => setView(v)])) };
  const keys = e => {
    if (isTextEditingTarget(e.target)) return;
    const chord = chordFromEvent(e), id = Object.keys(actions).find(id => shortcuts[id]?.includes(chord));
    if (id) { e.preventDefault(); e.stopPropagation(); actions[id](); }
  };
  const receiveAngles = value => {
    setAngles(previous => ['x','y','z'].every(a=>Math.abs(previous[a]-value[a])<1e-8)?previous:value);
    const q = new Quaternion().setFromEuler(new Euler(...['x', 'y', 'z'].map(a => value[a] * Math.PI / 180), 'XYZ'));
    onView?.(new Vector3(0, 1, 0).applyQuaternion(q).toArray(), new Vector3(0, 0, 1).applyQuaternion(q).toArray());
  };
  const frameRequest = useMemo(() => ({ ...localFrame, frame }), [localFrame, frame]);
  return <div className="forge-editor" ref={root} onKeyDown={keys}>
    <div className="classic-toolbar forge-editor-toolbar"><CameraTools value={cameraMode} onChange={setCameraMode}/>
      {onUndo && <div className="classic-toolbar-group"><Tool action="undo" icon="sb_undo" title="Undo" disabled={!canUndo} onClick={onUndo}/><Tool action="redo" icon="sb_undo" title="Redo" flip disabled={!canRedo} onClick={onRedo}/>{onCopy && <><Tool action="copy" icon="sb_copy" title="Copy" disabled={!canCopy} onClick={onCopy}/><Tool action="paste" icon="sb_paste" title="Paste" onClick={onPaste}/></>}</div>}
      {toolbar}
      <div className="forge-display"><label className="check"><input type="checkbox" checked={vertices} onChange={e => setVertices(e.target.checked)}/>Vertices</label><label className="check"><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)}/>Grid</label></div>
    </div>
    <div className="classic-workspace forge-editor-workspace"><section className="classic-view">
      <div className="classic-view-label"><select data-warmkey="viewDirection" aria-label="View direction" value={quad ? pane?.view || 'front' : view} onChange={e => setView(e.target.value)}>{(quad ? QUAD_VIEW_OPTIONS : ['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'].map(v => [v, v[0].toUpperCase() + v.slice(1)])).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><select aria-label="Render mode" value={renderMode} onChange={e => setRenderMode(e.target.value)}><option value="wireframe">Wireframe</option><option value="solid">Surface</option><option value="textured">Textured View</option></select><button aria-pressed={quad} onClick={() => setQuad(!quad)}>Quad View</button><button data-warmkey="fit" title="Fit model" onClick={() => fit(false)}>Fit</button><button data-warmkey="fitSelection" title="Fit selection" onClick={() => fit(true)}>Fit selection</button></div>
      <Viewport model={model} preferences={preferences} mode={renderMode} view={view} onViewChange={setView} quadView={quad} viewRequest={viewRequest} onActivePaneChange={setPane} cameraMode={cameraMode} onCameraModeToggle={toggleCamera} onCameraAnglesChange={receiveAngles} cameraAnglesRequest={angleRequest} frameRequest={frameRequest} workplane={workplane} workplaneEnabled={workplaneEnabled} transformMode={previewOnly ? 'select' : tool} selectionByGeoset={selection} selectableGeosets={selectable} visibleGeosets={selectable} onSelectionChange={onSelectionChange} onSelectParts={onSelectParts} onTransform={onTransform} showVertices={vertices} showGrid={grid} showAxes={true} shaded={true} grabThrough={grabThrough} textureAssets={textureAssets} teamColor={teamColor} surfaceColors={surfaceColors} faceShades={faceShades} highlightSelection={true}/>
    </section>{controlPoints && <div className="forge-control-points">{controlPoints}</div>}<aside className="classic-sidebar forge-editor-sidebar">
      {cameraMode === 'rotate' ? <><div className="forge-section-title">Camera rotation</div><div className="classic-coordinates">{['X', 'Y', 'Z'].map(axis => <Coordinate key={axis} axis={axis} value={angles[axis.toLowerCase()]} onCommit={value => setAngleRequest({ ...angles, [axis.toLowerCase()]: value })}/>)}</div></> : !previewOnly && <>
        <div className="classic-counts"><div>Vertices: <span>{model.Geosets.reduce((n, g) => n + g.Vertices.length / 3, 0)}</span></div><div>Selected: <span>{points.length}</span></div><div>Triangles: <span>{model.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0)}</span></div></div>
        <div className="classic-coordinates" data-label="Coords:">{['X', 'Y', 'Z'].map((axis, i) => <Coordinate key={axis} axis={axis} value={center[i]} disabled={!points.length || !onTransform} onCommit={value => onTransform({ selections: selection, pivot: center, translation: center.map((n, a) => a === i ? value - n : 0) })}/>)}</div>
        <WorkplaneControls enabled={workplaneEnabled} onEnabled={setWorkplaneEnabled} value={workplane} onChange={setWorkplane} locked={quad && pane?.workplane}/>
        <div className="classic-tools"><TransformTools value={tool} onChange={chooseTool}/>{onDelete && <Tool action="Delete vertices" icon="sb_del" title="Delete selection" disabled={!points.length} onClick={onDelete}/>}</div>
        {operations}
        <label className="check grabthrough-option"><input aria-label="Grabthrough" type="checkbox" checked={grabThrough} onChange={e => setGrabThrough(e.target.checked)}/>Grabthrough</label>
        <div className="forge-selection-actions"><button data-warmkey="selectAll" onClick={all}>All</button><button data-warmkey="clear" onClick={actions.clear}>Clear</button><button data-warmkey="invertSelection" onClick={invert}>Invert</button></div>
        {onDuplicate && <button className="forge-duplicate" disabled={!points.length} onClick={onDuplicate}>Duplicate</button>}
      </>}
      {sidebar}
    </aside></div><div className="forge-editor-status" role="status">{status || 'MDLxL FORGE'}</div>
  </div>;
}
