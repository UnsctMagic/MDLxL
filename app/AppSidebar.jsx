import React, { lazy, Suspense, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Tool, Coordinate, TransformTools, WorkplaneControls } from './EditorControls.jsx';
import { translate } from '../src/localization.js';
import { sketchStore } from '../src/ai-sketch.js';
import SidebarSection from './SidebarSection.jsx';
import GeosetTabs from './GeosetTabs.jsx';
import AnimationNodes from './AnimationNodes.jsx';
import LookIcon from './LookIcon.jsx';
const MovementController = lazy(() => import('./MovementControllerRecomp.jsx'));
const AnimationController = lazy(() => import('./AnimationController.jsx'));

const geosetHighlightLabel='Highlight Geoset';

// New look only (hidden with VIS on): Stats and Coords fold under a slim header.
// The choice lasts until MDLxL closes, also when switching editors.
const folds = { stats: false, coords: true };
function FoldHeader({ name, title, tip, summary, open, onToggle }) {
  return <button type="button" className={`sidebar-fold sidebar-fold-${name}`} aria-expanded={open} title={tip} onClick={onToggle}><span className="sidebar-fold-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span><b>{title}</b>{!open && summary && <span className="sidebar-fold-summary">{summary}</span>}</button>;
}
function useFold(name) {
  const [open, setOpen] = useState(folds[name]);
  return [open, () => setOpen(value => folds[name] = !value)];
}

// The right-hand sidebar panels of App. Every prop is the App value of the same
// name, so this markup reads exactly as it did inline.

/** Vertices mode: counts, coordinates, workplane and the transform / mesh tool buttons. */
export function VertexTools({
  cameraRotating, centroid, commandEnabled, deleteSelectedNode, editable, lockedVertexPlane, meshAction,
  mode, moveNodes, preferences, selectedFaces, selectedNodeIds, selectionCount, selectMode, setDialog, setWorkplane,
  setWorkplaneEnabled, setWorkTool, tool, totalFaces, totalVertices, transform, uvAction, validSelection,
  vertexNodeCenter, workplane, workplaneEnabled
}) {
  const singleTriangle = Object.values(validSelection).filter(ids => ids.length).length === 1 && selectionCount === 3;
  // While the AI console's Marker, Pen or Eraser has the left button, no editor tool shows as active.
  const drawing = !!useSyncExternalStore(sketchStore.subscribe, sketchStore.get, sketchStore.get).tool;
  const [statsOpen, toggleStats] = useFold('stats'), [coordsOpen, toggleCoords] = useFold('coords');
  const toolButton = (icon, name, title = name, condition = selectionCount > 0) => {const nodes=name==='Delete vertices'&&vertexNodeCenter;return <Tool look action={name} icon={icon} title={nodes?'Delete object':title} disabled={!editable || !(condition||nodes) || mode === 'uv'} onClick={() => nodes?deleteSelectedNode():meshAction(name)}/>;};
  return <><FoldHeader name="stats" title="Stats" tip="Vertex and triangle counts. Click to fold them into one line." summary={`${totalVertices} verts · ${selectionCount} sel · ${totalFaces} tris`} open={statsOpen} onToggle={toggleStats}/><div className="classic-counts" data-folded={statsOpen ? undefined : ''}><div>Vertices: <span>{totalVertices}</span></div><div>Selected: <span>{selectionCount}</span></div><div>Triangles: <span>{totalFaces}</span></div><div>Selected: <span>{selectedFaces}</span></div></div>
      <FoldHeader name="coords" title="Coords" tip="Position of the selection; type a number to move it. Click to fold." open={coordsOpen} onToggle={toggleCoords}/><div className="classic-coordinates" data-folded={coordsOpen ? undefined : ''} data-label={preferences.language === 'zh' ? 'Coords:' : translate('Coords:')}>{['X', 'Y', 'Z'].map((axis, i) => <Coordinate key={axis} axis={axis} value={(vertexNodeCenter||centroid)[i]} disabled={!editable || !(selectionCount||vertexNodeCenter) || mode === 'uv'} onCommit={value => { const translation = [0, 0, 0]; translation[i] = value - (vertexNodeCenter||centroid)[i]; if(vertexNodeCenter)moveNodes({nodeIds:selectedNodeIds,mode:'move',values:translation,restPose:true,workplaneEnabled:false});else transform({ translation }); }}/>)}</div>
      <WorkplaneControls enabled={workplaneEnabled} onEnabled={setWorkplaneEnabled} value={workplane} onChange={setWorkplane} locked={lockedVertexPlane}/>
      {!cameraRotating && <div className="classic-tools"><TransformTools look value={drawing ? null : tool} onChange={setWorkTool}/><Tool look action="normalRotate" icon="sb_nrot" title="Rotate normals" disabled={!editable || !selectionCount || mode === 'uv'} onClick={() => setDialog({ type: 'normalRotate' })}/>
        {toolButton('sb_del', 'Delete vertices', 'Delete vertices')}{toolButton('sb_uncouple', 'Uncouple', 'Uncouple vertices')}<Tool look action="Mirror" icon="sb_mirror" title="Mirror in workplane" disabled={!editable || !selectionCount} onClick={() => mode === 'uv' ? uvAction('flip-u') : meshAction('Mirror')}/>{toolButton('b_extrude', 'Extrude', 'Extrude 10 units, then move', selectedFaces > 0)}{toolButton('b_detach', 'Detach', 'Detach as new geoset', selectedFaces > 0)}
        {toolButton('sb_triangle', 'Create triangle', 'Create triangle', singleTriangle)}{toolButton('sb_deltr', 'Delete triangles', 'Delete selected triangles', selectedFaces > 0)}<button data-hotkey="Collapse" className="classic-tool classic-collapse span-2 has-look-icon" title="Collapse points" disabled={!editable || selectionCount < 2 || mode === 'uv'} onClick={() => meshAction('Collapse')}><LookIcon name="Collapse"/>Collapse</button><button data-hotkey="Weld" className="classic-tool classic-weld has-look-icon look-icon-only" title="Weld points; retains last selected vertex attributes" disabled={!editable || selectionCount < 2 || mode === 'uv'} onClick={() => meshAction('Weld')}><LookIcon name="Weld"/>Weld</button>
        <Tool look className="look-icon-only" action="Reverse normals" title="Reverse normals" disabled={!editable || !selectionCount || mode === 'uv'} onClick={() => meshAction('Reverse normals')}>−1</Tool>{toolButton('sb_nsmooth', 'Smooth normals', 'Average selected normals')}{toolButton('sb_nrestore', 'Restore normals', 'Recalculate geoset normals')}<button data-hotkey="uv" className="classic-tool classic-uv-button uv-button has-look-icon" title="UV maps" disabled={!commandEnabled('uv')} onClick={() => selectMode('uv')}><LookIcon name="uv"/>UV-maps</button>
      </div>}
  </>;
}

/** The Geosets section: Show all / highlight options, All / Clear / Hide extras and the geoset tabs list. */
export function GeosetPicker({
  activeGeoset, changePreferences, chooseSet, chooseSets, cleanView, Dialog, doc, edit, geosetTab,
  highlightAppearance, model, preferences, saving, selectable, selectGeosetTab, session, setContext,
  setSelectionHoveredGeoset, setShowAllGeosets, showAllGeosets, tabGeosets, tabVisibleGeosets, viewHoveredGeoset,
  visibleOnly, hideExtras, setHideExtras, visUI, floatAt, onFloat
}) {
  const sectionMenu = event => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY }); };
  const body = <><div className="geoset-options"><label className="check"><input data-hotkey="showAllGeosets" aria-label="Show all geosets" type="checkbox" checked={showAllGeosets} onChange={event => setShowAllGeosets(event.target.checked)}/>Show all</label><label className="check"><input data-hotkey="highlightSelection" aria-label={geosetHighlightLabel} type="checkbox" checked={preferences.highlightSelection} onChange={event => changePreferences(previous => ({ ...previous, highlightSelection: event.target.checked }))}/>{geosetHighlightLabel}</label></div><div className="classic-selection-actions"><button data-hotkey="geosetsAll" onClick={() => chooseSets(new Set(tabVisibleGeosets))}>All</button><button data-hotkey="geosetsClear" onClick={() => chooseSets(new Set())}>Clear</button><button aria-pressed={hideExtras} title="Hides corpse and portrait-background geosets (never shown in Stand, Walk or Attack) from the list and view. Nothing is deleted; click again to bring them back." onClick={() => setHideExtras(value => !value)}>Hide extras</button></div><GeosetTabs key={session.id} model={model} active={geosetTab} onActive={selectGeosetTab} selected={selectable} edit={edit} disabled={doc.readOnly || saving} Dialog={Dialog}><div className="classic-geoset-list" style={{ '--geoset-rows': Math.max(1, Math.ceil(tabGeosets.size / 4)) }} role="listbox" aria-label="Geosets" aria-multiselectable="true">{[...tabGeosets].map(i => <div key={i} className={`geoset-row${activeGeoset === i ? ' selected' : ''}${!cleanView && preferences.highlightSelection && highlightAppearance.viaView && viewHoveredGeoset === i ? ' hovered' : ''}`} role="option" aria-selected={selectable.has(i)} title={visibleOnly.has(i) ? 'Leave as visible' : undefined} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setContext({ x: event.clientX, y: event.clientY, geosetIndex: i }); }} ><span className="geoset-hover-target" onMouseEnter={() => setSelectionHoveredGeoset(i)} onMouseLeave={() => setSelectionHoveredGeoset(null)}><input data-hotkey={`geoset:${i}`} type="checkbox" aria-label={`Select geoset ${i}`} checked={selectable.has(i)} disabled={!tabVisibleGeosets.has(i)} onChange={event => chooseSet(i, event, event.target.checked)}/><span style={{ whiteSpace: 'nowrap' }}>{i + 1}{visibleOnly.has(i) && <span style={{ fontSize: 7, marginLeft: 1 }} aria-label={`Geoset ${i} left visible`}>◉</span>}</span></span></div>)}</div></GeosetTabs></>;
  // VIS keeps the classic look, so Geosets never floats there.
  const container = floatAt && !visUI && document.querySelector('.classic-app');
  if (!container) return <SidebarSection title={<>Geosets{!visUI && onFloat && <button type="button" className="geosets-float-toggle" aria-label="Float Geosets" title="Float Geosets over the view; drag it anywhere by its title bar. It goes back to the sidebar when MDLxL restarts." onClick={event => { event.preventDefault(); event.stopPropagation(); const side = event.currentTarget.closest('.classic-sidebar')?.getBoundingClientRect(); onFloat({ x: Math.max(8, (side?.left ?? innerWidth) - 248), y: (side?.top ?? 100) + 44 }); }}><span aria-hidden="true">⇱</span></button>}</>} className="classic-geosets" onContextMenu={sectionMenu}>{body}</SidebarSection>;
  return <><div className="geosets-slot"><span>Geosets</span><button type="button" className="geosets-dock-back" title="Put Geosets back in the sidebar" onClick={() => onFloat(null)}>floating · <span aria-hidden="true">⇲</span> dock back</button></div>
    {createPortal(<FloatingGeosets at={floatAt} onMove={onFloat} onContextMenu={sectionMenu}>{body}</FloatingGeosets>, container)}</>;
}

/** The detached Geosets panel: dragged by its title bar, kept inside the window. */
function FloatingGeosets({ at, onMove, onContextMenu, children }) {
  const [drag, setDrag] = useState(null), panel = useRef(null);
  const place = drag?.at || at, width = panel.current?.offsetWidth || 228;
  const left = Math.min(Math.max(0, place.x), Math.max(0, innerWidth - width)), top = Math.min(Math.max(0, place.y), Math.max(0, innerHeight - 32));
  const grab = event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from: [event.clientX, event.clientY], start: { x: left, y: top }, at: { x: left, y: top } });
  };
  const move = event => drag && setDrag({ ...drag, at: { x: drag.start.x + event.clientX - drag.from[0], y: drag.start.y + event.clientY - drag.from[1] } });
  const drop = () => { if (drag) { onMove({ x: left, y: top }); setDrag(null); } };
  return <section ref={panel} className="geosets-float" aria-label="Geosets" style={{ left, top }} onContextMenu={onContextMenu}>
    <header title="Drag to move Geosets anywhere over the view." onPointerDown={grab} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}><span className="geosets-float-grip" aria-hidden="true">⠿</span><b>Geosets</b><button type="button" className="geosets-dock-back" aria-label="Dock Geosets back" title="Put Geosets back in the sidebar" onClick={() => onMove(null)}><span aria-hidden="true">⇲</span></button></header>
    <div className="classic-geosets">{children}</div>
  </section>;
}

/** Bones mode (Movement controller with the rig tools) and Animation mode (Movement or Animations panel). */
export function RigSidebar({
  activePortrait, animationPanel, attachSourceIds, beginAttach, bindSelectedVertices, boneCreateOpen, cameraGesture,
  controlsWholeModel, createBoneOrAttachment, deleteSelectedNode, detachSelectedNode, Dialog, doc, edit, geosetPicker,
  globalSeqId, materialVisibility, mode, model, movementControllerProps, multipleNodes, openAttachemator, parentedRigNodes,
  renameSelectedNode, saving, selectable, selectedBone, selectedNodeIds, selectedRigNodes, selectionCount,
  selectTimeline, sequence, session, setBoneCreateOpen, setMaterialVisibility, setPlaying, setSelectedBoneBillboarded,
  setSelectedNodeIds, setTime, singleRigNode, time
}) {
  return <>
      {mode === 'bones' && <Suspense fallback={<p>Loading controller…</p>}><MovementController key={session.id} {...movementControllerProps()} onDeleteNode={deleteSelectedNode} onRenameNode={renameSelectedNode} onBillboarded={setSelectedBoneBillboarded} onCreateRigNode={createBoneOrAttachment} onAttach={beginAttach} onDetach={detachSelectedNode} onSoftBind={() => bindSelectedVertices('soft')} onHardBind={() => bindSelectedVertices('hard')} onDetachVertices={() => bindSelectedVertices('detach')} onAttachemator={openAttachemator} attachActive={attachSourceIds.length > 0} createOpen={boneCreateOpen} onCreateOpen={setBoneCreateOpen} canDeleteNode={!!singleRigNode} canAttach={selectedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1)} canDetach={parentedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1)} canBind={!!selectedBone && selectionCount > 0} /></Suspense>}
      {/* Rotate camera mode carries over between tabs, so only an active camera
          drag may swap the Animations controls for the camera view. */}
      {mode === 'animation' && (!cameraGesture || animationPanel === 'movement') && <Suspense fallback={<p>Loading controller…</p>}>

        {animationPanel === 'movement' ? <MovementController key={session.id} {...movementControllerProps()} portraitMode={activePortrait} controlModel={controlsWholeModel(selectedNodeIds)} /> : <>
          <AnimationController Dialog={Dialog} materialVisibility={materialVisibility} selectedNodeIds={selectedNodeIds} globalSeqId={globalSeqId} key={session.id} model={model} revision={doc.revision} sequenceIndex={sequence} time={time} selectedGeosets={[...selectable]} onEdit={edit} onTimelineChange={selectTimeline} onSeek={value => { setPlaying(false); setTime(value); }} disabled={doc.readOnly || saving} />
          {geosetPicker}
          <AnimationNodes model={model} revision={doc.revision} selectedNodeIds={selectedNodeIds} onSelectNodes={ids=>{setMaterialVisibility(null);setSelectedNodeIds(ids);}}/>

        </>}
      </Suspense>}
  </>;
}
