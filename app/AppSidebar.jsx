import React, { lazy, Suspense } from 'react';
import { Tool, Coordinate, TransformTools, WorkplaneControls } from './EditorControls.jsx';
import { translate } from '../src/localization.js';
import SidebarSection from './SidebarSection.jsx';
import GeosetTabs from './GeosetTabs.jsx';
import AnimationNodes from './AnimationNodes.jsx';
const MovementController = lazy(() => import('./MovementControllerRecomp.jsx'));
const AnimationController = lazy(() => import('./AnimationController.jsx'));

const geosetHighlightLabel='Highlight Geoset';

// The right-hand sidebar panels of App. Every prop is the App value of the same
// name, so this markup reads exactly as it did inline.

/** Vertices mode: counts, coordinates, workplane and the transform / mesh tool buttons. */
export function VertexTools({
  cameraRotating, centroid, commandEnabled, deleteSelectedNode, editable, hiddenCount, lockedVertexPlane, meshAction,
  mode, moveNodes, preferences, selectedFaces, selectedNodeIds, selectionCount, selectMode, setDialog, setWorkplane,
  setWorkplaneEnabled, setWorkTool, tool, totalFaces, totalVertices, transform, uvAction, validSelection,
  vertexNodeCenter, workplane, workplaneEnabled
}) {
  const singleTriangle = Object.values(validSelection).filter(ids => ids.length).length === 1 && selectionCount === 3;
  const toolButton = (icon, name, title = name, condition = selectionCount > 0) => {const nodes=name==='Delete vertices'&&vertexNodeCenter;return <Tool action={name} icon={icon} title={nodes?'Delete object':title} disabled={!editable || !(condition||nodes) || mode === 'uv'} onClick={() => nodes?deleteSelectedNode():meshAction(name)}/>;};
  return <><div className="classic-counts"><div>Vertices: <span>{totalVertices}</span></div><div>Selected: <span>{selectionCount}</span></div><div>Hidden: <span>{hiddenCount}</span></div><div>Triangles: <span>{totalFaces}</span></div><div>Selected: <span>{selectedFaces}</span></div></div>
      <div className="classic-coordinates" data-label={preferences.language === 'zh' ? 'Coords:' : translate('Coords:')}>{['X', 'Y', 'Z'].map((axis, i) => <Coordinate key={axis} axis={axis} value={(vertexNodeCenter||centroid)[i]} disabled={!editable || !(selectionCount||vertexNodeCenter) || mode === 'uv'} onCommit={value => { const translation = [0, 0, 0]; translation[i] = value - (vertexNodeCenter||centroid)[i]; if(vertexNodeCenter)moveNodes({nodeIds:selectedNodeIds,mode:'move',values:translation,restPose:true,workplaneEnabled:false});else transform({ translation }); }}/>)}</div>
      <WorkplaneControls enabled={workplaneEnabled} onEnabled={setWorkplaneEnabled} value={workplane} onChange={setWorkplane} locked={lockedVertexPlane}/>
      {!cameraRotating && <div className="classic-tools"><TransformTools value={tool} onChange={setWorkTool}/><Tool action="normalRotate" icon="sb_nrot" title="Rotate normals" disabled={!editable || !selectionCount || mode === 'uv'} onClick={() => setDialog({ type: 'normalRotate' })}/>
        {toolButton('sb_del', 'Delete vertices', 'Delete vertices')}{toolButton('sb_uncouple', 'Uncouple', 'Uncouple vertices')}<Tool action="Mirror" icon="sb_mirror" title="Mirror in workplane" disabled={!editable || !selectionCount} onClick={() => mode === 'uv' ? uvAction('flip-u') : meshAction('Mirror')}/>{toolButton('b_extrude', 'Extrude', 'Extrude 10 units, then move', selectedFaces > 0)}{toolButton('b_detach', 'Detach', 'Detach as new geoset', selectedFaces > 0)}
        {toolButton('sb_triangle', 'Create triangle', 'Create triangle', singleTriangle)}{toolButton('sb_deltr', 'Delete triangles', 'Delete selected triangles', selectedFaces > 0)}<button data-hotkey="Collapse" className="classic-tool classic-collapse span-2" title="Collapse points" disabled={!editable || selectionCount < 2 || mode === 'uv'} onClick={() => meshAction('Collapse')}>Collapse</button><button data-hotkey="Weld" className="classic-tool classic-weld" title="Weld points; retains last selected vertex attributes" disabled={!editable || selectionCount < 2 || mode === 'uv'} onClick={() => meshAction('Weld')}>Weld</button>
        <Tool action="Reverse normals" title="Reverse normals" disabled={!editable || !selectionCount || mode === 'uv'} onClick={() => meshAction('Reverse normals')}>−1</Tool>{toolButton('sb_nsmooth', 'Smooth normals', 'Average selected normals')}{toolButton('sb_nrestore', 'Restore normals', 'Recalculate geoset normals')}<button data-hotkey="uv" className="classic-tool classic-uv-button uv-button" title="UV maps" disabled={!commandEnabled('uv')} onClick={() => selectMode('uv')}>UV-maps</button>
      </div>}
  </>;
}

/** The Geosets section: Show all / highlight options, All / Clear / Hide extras and the geoset tabs list. */
export function GeosetPicker({
  activeGeoset, changePreferences, chooseSet, chooseSets, cleanView, Dialog, doc, edit, geosetTab,
  highlightAppearance, model, preferences, saving, selectable, selectGeosetTab, session, setContext,
  setSelectionHoveredGeoset, setShowAllGeosets, showAllGeosets, tabGeosets, tabVisibleGeosets, viewHoveredGeoset,
  visibleOnly, hideExtras, setHideExtras
}) {
  return <SidebarSection title="Geosets" className="classic-geosets" onContextMenu={event => { event.preventDefault(); setContext({ x: event.clientX, y: event.clientY }); }}><div className="geoset-options"><label className="check"><input data-hotkey="showAllGeosets" aria-label="Show all geosets" type="checkbox" checked={showAllGeosets} onChange={event => setShowAllGeosets(event.target.checked)}/>Show all</label><label className="check"><input data-hotkey="highlightSelection" aria-label={geosetHighlightLabel} type="checkbox" checked={preferences.highlightSelection} onChange={event => changePreferences(previous => ({ ...previous, highlightSelection: event.target.checked }))}/>{geosetHighlightLabel}</label></div><div className="classic-selection-actions"><button data-hotkey="geosetsAll" onClick={() => chooseSets(new Set(tabVisibleGeosets))}>All</button><button data-hotkey="geosetsClear" onClick={() => chooseSets(new Set())}>Clear</button><button aria-pressed={hideExtras} title="Hides corpse and portrait-background geosets (never shown in Stand, Walk or Attack) from the list and view. Nothing is deleted; click again to bring them back." onClick={() => setHideExtras(value => !value)}>Hide extras</button></div><GeosetTabs key={session.id} model={model} active={geosetTab} onActive={selectGeosetTab} selected={selectable} edit={edit} disabled={doc.readOnly || saving} Dialog={Dialog}><div className="classic-geoset-list" style={{ '--geoset-rows': Math.max(1, Math.ceil(tabGeosets.size / 4)) }} role="listbox" aria-label="Geosets" aria-multiselectable="true">{[...tabGeosets].map(i => <div key={i} className={`geoset-row${activeGeoset === i ? ' selected' : ''}${!cleanView && preferences.highlightSelection && highlightAppearance.viaView && viewHoveredGeoset === i ? ' hovered' : ''}`} role="option" aria-selected={selectable.has(i)} title={visibleOnly.has(i) ? 'Leave as visible' : undefined} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setContext({ x: event.clientX, y: event.clientY, geosetIndex: i }); }} ><span className="geoset-hover-target" onMouseEnter={() => setSelectionHoveredGeoset(i)} onMouseLeave={() => setSelectionHoveredGeoset(null)}><input data-hotkey={`geoset:${i}`} type="checkbox" aria-label={`Select geoset ${i}`} checked={selectable.has(i)} disabled={!tabVisibleGeosets.has(i)} onChange={event => chooseSet(i, event, event.target.checked)}/><span style={{ whiteSpace: 'nowrap' }}>{i + 1}{visibleOnly.has(i) && <span style={{ fontSize: 7, marginLeft: 1 }} aria-label={`Geoset ${i} left visible`}>◉</span>}</span></span></div>)}</div></GeosetTabs></SidebarSection>;
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
