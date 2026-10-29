import React, { lazy, Suspense } from 'react';
import { applyMaterialPreset } from '../src/material-presets.js';
import { LoadingWindow } from './Dialog.jsx';
import { setUVTextureWrapping } from '../src/uv-tools.js';
import { filterVertexSelection } from '../src/classic-selection.js';
import { poseTrackScope } from '../src/pose-ik.js';
const UVWorkspace = lazy(() => import('./UVWorkspace.jsx'));
const TextureLibrary = lazy(() => import('./TextureLibrary.jsx'));
const KeyframeTimeline = lazy(() => import('./KeyframeTimeline.jsx'));
const MotionInspector = lazy(() => import('./MotionInspector.jsx'));

// Panels App builds once per render and places itself (uvWorkspace, textureLibraryDialog,
// timeline). Every prop is the App value of the same name, so this markup reads exactly
// as it did inline.

/** The UV Wrapper workspace inside its model tab. */
export function AppUVWorkspace({
  activeGeoset, applyGeosetDensity, cameraMode, cameraProps, changePointerSensitivity, changePreferences,
  changeSensitivity, commitUVChanges, doc, edit, finishUVPreview, model, openLibrary, preferences, previewModel,
  previewSuspended, saving, closeUVWindow, session, setActiveGeoset, setLiveUV, setSelection, setUVEntrySelection,
  setUvSet, teamColor, texturedModel, toggleMiddleCamera, uncoupleUVSelection, uvEntryId, uvEntrySelection,
  validSelection, view, uvMinimized
}) {
  return (<Suspense fallback={null}><UVWorkspace key={session.id+':'+uvEntryId} model={model} materialModel={texturedModel} previewModel={previewModel} revision={doc.revision} activeGeoset={activeGeoset} eligibleSelection={uvEntrySelection} selectionByGeoset={validSelection}
        onSelectionChange={next => setSelection(filterVertexSelection(next, new Set(Object.keys(uvEntrySelection).map(Number)), doc.model))}
        onPreviewSelectionChange={next => {
          setUVEntrySelection(previous => {
            let expanded = previous;
            for (const [index, ids] of Object.entries(next)) if (ids?.some(id => previous[index] && !previous[index].includes(id))) {
              if (expanded === previous) expanded = { ...previous };
              expanded[index] = [...new Set([...previous[index], ...ids])];
            }
            return expanded;
          });
          setSelection(filterVertexSelection(next, new Set(Object.keys(uvEntrySelection).map(Number)), doc.model));
        }}
        onUVChanges={commitUVChanges} onPreviewChanges={changes => setLiveUV(changes?.length ? changes : null)} onUncouple={uncoupleUVSelection}
        onMaterialPreset={(id, preset, tint) => edit(preset, ['Materials', 'Textures'], current => applyMaterialPreset(current, id, preset, tint))}
        onWrappingChange={(textureIDs, enabled) => edit(`${enabled ? 'Enable' : 'Disable'} UV texture wrapping`, ['Textures'], current => setUVTextureWrapping(current, textureIDs, enabled))}
        onDensityApply={applyGeosetDensity}
        onGeosetChange={(index, coordId = 0) => { if (index < 0) return; setActiveGeoset(index); setUvSet(coordId); setLiveUV(null); }}
        textureAssets={session.assets} teamColor={teamColor} preferences={preferences} onPreferences={changePreferences} readOnly={doc.readOnly || saving} suspended={uvMinimized}
        draftCount={Object.keys(session.uvPreviews).length} onLibrary={() => openLibrary(true)} onSavePreview={() => finishUVPreview()} onRevertPreview={() => finishUVPreview(true)} onExit={closeUVWindow}
        previewProps={{ ...cameraProps, previewMode:'textured', modelPath:session.path, key: session.id, preferences, onSensitivityChange: changeSensitivity, onPointerSensitivityChange: changePointerSensitivity, onCameraModeToggle: toggleMiddleCamera, suspended: previewSuspended,
          revision: doc.revision, teamColor, textureAssets: session.assets, view, cameraMode }} /></Suspense>);
}

/** The Texture Library dialog (App renders it only while dialog.type is 'library'). */
export function AppTextureLibrary({
  addTexture, dialog, doc, importPart, model, openGameModel, preferences, previewSelection, previewTexture, session, setDialog
}) {
  return <Suspense fallback={<LoadingWindow title="Loading texture library…"/>}><TextureLibrary model={model} modelPath={session.path} onClose={() => setDialog(dialog.returnTo)} onAddTexture={doc.readOnly ? undefined : addTexture} onPreviewTexture={dialog.preview ? previewTexture : undefined} previewEnabled={dialog.preview && previewSelection.enabled && !doc.readOnly} previewReason={doc.readOnly ? 'This model is read-only.' : previewSelection.reason} onOpenMaterials={() => setDialog({ type: 'resource', kind: 'Materials' })} fullLibrary={!!dialog.full} onOpenGameModel={openGameModel} onImportGameGeosets={doc.readOnly ? undefined : ({ source, assets }) => importPart({ source, rgbSequence: null, assets, keepOpen: true })} importTargetName={doc.name} preferences={preferences}/></Suspense>;
}

/** Animation modes: the keyframe timeline, with the Motion Inspector of the Movement panel. */
export function AppTimeline({
  animationPanel, closeMotion, doc, edit, globalSeqId, highlightChain, highlightKeyframes, inspectingMotion,
  materialVisibility, mode, model, motion, motionAnchor, motionOrigin, movementMode, playbackSpeed, playing,
  poseConfig, poseViewActive, preferences, registerTimelineCommands, replayMotion, restPose, restrictions,
  rigWorkspace, saving, say, seekMotionTime, selectable, selectedNodeIds, selectMotion, sequence, session,
  setMotionAnchor, setPlaybackSpeed, setPlaying, time
}) {
  return (<Suspense fallback={<div>Loading keyframes…</div>}><KeyframeTimeline
    motionFindings={inspectingMotion ? motion.visible : []} motionActive={!inspectingMotion || motion.stale || motion.active?.resolved ? null : motion.active}
    motionControls={inspectingMotion && sequence >= 0 && (motion.active || motion.desiredCount > 0) ? motion : null}
    onMotionFinding={(finding, element) => { motionOrigin.current = element; setMotionAnchor(element.getBoundingClientRect().left); motion.setActive(finding); selectMotion(finding); }}
    onKeyClick={mode === 'animation' && animationPanel === 'movement' ? () => { if (motion.active) closeMotion(); } : undefined}
    poseEnabled={poseViewActive && globalSeqId === null} poseScope={rigWorkspace && !restPose && poseConfig.enabled && poseConfig.target ? poseTrackScope(poseConfig, poseConfig.target, movementMode, model, restrictions) : null} restrictions={rigWorkspace?restrictions:{}} key={session.id} model={model} revision={doc.revision} sequenceIndex={sequence} time={time} selectedNodeIds={selectedNodeIds} selectedGeosets={animationPanel === 'animations' && selectedNodeIds.length ? [] : [...selectable]} globalSeqId={globalSeqId} highlightKeyframes={animationPanel === 'animations' && selectedNodeIds.length > 0 || highlightKeyframes} highlightChain={animationPanel === 'movement' && highlightChain} playbackSpeed={playbackSpeed} onPlaybackSpeedChange={setPlaybackSpeed} playing={playing} onPlayingChange={setPlaying} onStatus={say} activeController={animationPanel==='movement'?movementMode:materialVisibility?`materialVisibility:${materialVisibility.id}:${materialVisibility.layer}`:selectedNodeIds.length?'nodeVisibility':'animations'} onEdit={edit} onSeek={seekMotionTime} onCommands={registerTimelineCommands} disabled={doc.readOnly||saving} preferences={preferences}>
    {inspectingMotion && animationPanel === 'movement' && motion.active && <Suspense fallback={null}><MotionInspector time={time} selectedNodeIds={selectedNodeIds} mode={movementMode} motion={motion} anchor={motionAnchor} onClose={closeMotion} onSelect={selectMotion} onReplay={replayMotion}/></Suspense>}
  </KeyframeTimeline></Suspense>);
}
