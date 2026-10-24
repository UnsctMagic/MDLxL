import React, { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import Viewport from './Viewport.jsx';
import {visiblePaintGeosets} from '../src/paint-view.js';
import PaintBoundary from './PaintBoundary.jsx';
import {validatePaintAssignments,repairPaintMaterials} from '../src/paint-materials.js';
import {preparePaintModelCommit,commitPaintModel,adoptCommittedPaintUVs} from '../src/paint-model-integration.js';
import './addons.css'; // keeps the stylesheet's place in the CSS order; Addons renders in AppToolbar
import AiAssistant from './AiAssistant.jsx';
import { AiEditorBridge } from './ai-editor.js';
import { directlyBoundBoneIds } from '../src/binding-inspection.js';
import { applyPortraitModelTransform, modelControlGroups, modelControlRoots } from '../src/portrait-model-control.js';
import { refreshPortraitExtentsAfterRigEdit } from '../src/portrait-extents.js';
import { attachToBone, changeVertexBinding, createRigNode, deleteRigNode, detachFromBone, renameRigNode, setBoneBillboarded } from '../src/bone-tools.js';
import { applyAttachmentPlan } from '../src/attachemator.js';
import { builtinTextureAssets } from '../src/builtin-textures.js';
// Keep UV window styles available before its lazy workspace mounts.
import './uv-workspace.css';
import './mesh-density.css';
import { openOptimizeXLWindow } from './detached-window.js';
import UVWindow from './UVWindow.jsx';
import './optimizexl.css';
import { applyApplicationTheme } from './theme.js';
import { detectRenderer } from './renderer-detection.js';
import PressedKeys from './PressedKeys.jsx';
import AppDialogs from './AppDialogs.jsx';
import useUpdates from './useUpdates.js';
import { Coordinate } from './EditorControls.jsx';
import { setLanguage, translate } from '../src/localization.js';
import { usePreviewBackgrounds } from './usePreviewBackgrounds.js';
const GamePreview = lazy(() => import('./GamePreview.jsx'));
import useMovableWindow from './useMovableWindow.js';
import SidebarSection from './SidebarSection.jsx';
import './animation-resources.css'; // keeps the stylesheet's place in the CSS order; AnimationNodes renders in AppSidebar
const PaintWorkspace = lazy(() => import('./PaintWorkspace.jsx'));
const ShowcaseWorkspace = lazy(() => import('./ShowcaseWorkspace.jsx'));
const Attachemator = lazy(() => import('./Attachemator.jsx'));
import { AppUVWorkspace, AppTextureLibrary, AppTimeline } from './AppPanels.jsx';
import useMotionInspector from './useMotionInspector.js';
import { rememberMotionSave } from '../src/motion-decisions.js';
import { SHAPE_TOOLS } from '../src/shaping.js';
import { retainedForgeAssets, forgeExportArchive, isForgeAssetPath, missingForgeAssetPaths } from '../src/forge-assets.js';
import { applyMovementTransform, applyMovementPose, movementRestricted, constrainMovementVector, movementProperties } from '../src/movement.js';
import { withPoseResult, samplePoseChain } from '../src/pose-ik.js';
import { classicTimelineDomain } from '../src/classic-keyframes.js';
import { beginUVPreview, applyUVPreviews, revertUVPreviews, uvPreviewModel, restoreUVPreviews, addLibraryTexture, existingTextureIndex, addTextureMaterial, captureUVPreviewGuard, validateUVPreviewGuard, getUVPreviewSelection } from '../src/uv-preview.js';
import { uncoupleUVVertices } from '../src/uv-tools.js';
import './modules.css';
import './texture-library.css';
import './material-properties.css';
import { installTextureLibraryDecoder } from './asset-preload-client.js';
import { flushRecordingQueue } from './preview-recording-queue.js';
import { HotkeysProvider } from './Hotkeys.jsx';
import { normalizePreferences, SOFTWARE_RENDERING_GRAPHICS } from '../src/preferences.js';
import { COMMANDS } from '../src/commands.js';
import { SelectionHistory } from '../src/selection-history.js';
import { analyzeNormals, planNormalRebuild, planFacingFix, applyNormalRebuild, previewNormalRebuild, isShadedGeoset, DEFAULT_SMOOTHING_ANGLE } from '../src/normals-rebuild.js';
import NormalizerControls, { normalizerStatus } from './NormalizerControls.jsx';
import { EditorDocument, openDocument, deleteGeoset, recalculateExtents, recalculateNormals } from '../src/editor-document.js';
import { HD_VIEW_ONLY_MESSAGE, HD_BORDERLINE_MESSAGE, HD_CONVERTED_MESSAGE } from '../src/model-version.js';
import { separateGeosetsByLoosePart, nuclearSeparateGeosets, mergeSimilarGeosets, geosetMergeConflicts, deleteFreeVertices } from '../src/geoset-operations.js';
import './geoset-merge.css';
import { transformVertices, setVertexPositions, deleteVertices, addTriangle } from '../src/editor-commands.js';
import { detachFaces, extrudeFaces } from '../src/mesh-tools.js';
import { captureMeshSelection } from '../src/mesh-clipboard.js';
import { captureNodeSelection } from '../src/node-clipboard.js';
import { prepareClipboardPaste } from '../src/clipboard-paste.js';
import { captureUVSelection } from '../src/uv-selection.js';
import { collapseVertices, weldSelectedVertices, uncoupleVertices, deleteSelectedFaces, averageSelectedNormals } from '../src/classic-mesh.js';
import { allGeosets, chooseGeosets, initialGeosetSelection, filterVertexSelection } from '../src/classic-selection.js';
import { createEmptyDocument } from '../src/starter-model.js';
import { bindDropdownWheel } from '../src/dropdown-wheel.js';
import { prepareModelSaveAsync } from './model-save.js';
import { clearEditorData, EDITOR_DATA_SECTIONS } from '../src/editor-data.js';
import { sampleTrack } from '../src/animation.js';
import { buildPaintExportArtifact, buildPaintProjectArtifact } from '../src/paint-export.js';
import { markPaintProjectSaved, restorePaintProject, travelPaintHistory } from '../src/paint-project.js';
import { enumeratePaintTargets, installFreshPaintLayer, paintTargetsForGeoset } from '../src/paint-targets.js';
import { paintMessage } from '../src/paint-messages.js';
import { decodePaintImage } from './paint-raster.js';
import { clearQuickDisplay, defaultPoseDisplay, saveEditorDisplay, setEditorDisplay, storedEditorDisplay, textureToggleTarget } from '../src/display-overlays.js';
import { setCameraFromCurrentView, createPortraitCamera, makePortraitCamera, editPortraitCamera, framePortraitSubject, portraitShot, changedPortraitFields } from './portrait-camera-edit.js';
import { firstPortraitSequenceIndex, evaluateModelCamera } from './portrait-view.js';
import { currentBackdropLook, findPortraitBackground, normalizeBackdropLook, refreshPortraitBackground } from './portrait-background.js';
import PortraitToolbar from './PortraitToolbar.jsx';
import AppToolbar, { AppViewLabel } from './AppToolbar.jsx';
import GeosetAnimationRepair from './GeosetAnimationRepair.jsx';
import { VertexTools, GeosetPicker, RigSidebar } from './AppSidebar.jsx';
import { GEOSET_TABS_KEY, geosetsInTab } from '../src/geoset-tabs.js';
import { corpseAndBackgroundGeosets } from '../src/geoset-extras.js';
import { createPortraitSequence, portraitSequenceIndices } from '../src/sequence-editor.js';
import { scanGeosetAnimationDuplicates, repairGeosetAnimations } from '../src/geoset-animation-repair.js';
import ModelTabs from './ModelTabs.jsx';
import SidebarResizer, { PANEL_WIDTH_EVENT } from './SidebarResizer.jsx';

const normalize = value => String(value || '').replaceAll('/', '\\').toLowerCase();
const views = ['orthographic', 'perspective', 'front', 'back', 'left', 'right', 'top', 'bottom'];
const resources = ['Materials', 'Textures', 'Nodes', 'Geosets', 'GeosetAnims', 'Sequences', 'TextureAnims', 'GlobalSequences'];
const blank = () => openDocument(new TextEncoder().encode('Version { FormatVersion 800, }\nModel "Untitled" { BlendTime 150, MinimumExtent { 0, 0, 0 }, MaximumExtent { 0, 0, 0 }, BoundsRadius 0, }\n'), 'Untitled.mdl');
const sessionDirty = session => !!session && (session.doc.dirty || Object.keys(session.uvPreviews || {}).length > 0 || Object.keys(session.animationDrafts || {}).length > 0 || !!session.paintProject?.dirty);
const defaultSessionView = doc => {
  const selectable = initialGeosetSelection(doc.model.Geosets.length);
  const citadel = doc.model.Textures.some(texture => /^MDLxL_Citadel[\\/]/i.test(texture.Image || ''));
  return { mode: 'vertices', animationPanel: 'movement', selectable, selection: {}, hidden: {}, activeGeoset: selectable.size ? 0 : -1, activeGeosetTab: 'all', uvSet: 0, selectedNodeIds: [], globalSeqId: null, sequence: -1, time: 0, rgbPreview: false, rgbSequence: -1, renderMode: citadel ? 'textured' : 'wireframe', movementRenderMode: 'influence', showAllGeosets: !citadel };
};
const newSession = (doc = blank(), path = null, assets = builtinTextureAssets()) => ({ doc, path, assets, uvPreviews: {}, animationDrafts: {}, paintProject: null, paintOriginalModelBytes: null, paintWorkingModel: null, paintWorkingRevision: 0, id: crypto.randomUUID(), checkpoint: 0, viewState: defaultSessionView(doc) });
export async function readInputBytes(file){
  const bytes=typeof file.arrayBuffer==='function'?await file.arrayBuffer():file.bytes;
  if(bytes instanceof ArrayBuffer)return new Uint8Array(bytes);
  if(bytes instanceof Uint8Array)return bytes;
  if(ArrayBuffer.isView(bytes))return new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  throw new Error('The selected file did not provide readable binary data.');
}
function browserRecovery(operation, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mdlvis-classic-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction('drafts', operation === 'put' ? 'readwrite' : 'readonly'), store = tx.objectStore('drafts'); const action = operation === 'put' ? store.put(value) : operation === 'get' ? store.get(value) : store.getAll(); let result; action.onsuccess = () => { result = action.result; }; tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); }; };
  });
}
function Dialog({ title, children, footer, onClose, onHotkeys, overlayClass = '', onKeyDown }) {
  const windowRef = useRef(null), movable = useMovableWindow(windowRef);
  return <div className={`classic-modal ${overlayClass}`} onKeyDown={onKeyDown}><section data-hotkey-scope="dialog" data-hotkey-prefix={title} ref={windowRef} style={movable.style} className="classic-modal-window" role="dialog" aria-modal="true" aria-label={title}><header {...movable.handleProps}><span>{title}</span><div>{onHotkeys && <button data-hotkey="hotkeys" aria-label="Hotkeys for this dialog" onClick={onHotkeys}>Keys</button>}<button data-hotkey="close" aria-label={`Close ${title}`} onClick={onClose}>×</button></div></header><div className="classic-modal-body">{children}</div><footer>{footer || <button data-hotkey="app:action:1" onClick={onClose}>Close</button>}</footer></section></div>;
}

export default function App() {
  useEffect(() => installTextureLibraryDecoder(window.desktop), []);
  const [preferences, setPreferences] = useState(() => { try { return normalizePreferences(JSON.parse(localStorage.getItem('mdlvis-preferences') || '{}')); } catch { return normalizePreferences({}); } });
  setLanguage(preferences.language);
  const updates = useUpdates();
  useEffect(()=>{document.documentElement.lang=preferences.language;},[preferences.language]);
  const [settingsTab, setSettingsTab] = useState(null), [preferencesReady, setPreferencesReady] = useState(!window.desktop);
  const pressedKeysIcon = './classic/btn-magical-sentry.png';
  useEffect(() => bindDropdownWheel(document), []);
  const textureUrls = useRef(new Set());
  const timelineCommands = useRef({});
  const [materialVisibility,setMaterialVisibility] = useState(null);
  const registerTimelineCommands = useCallback(value=>{timelineCommands.current=value;},[]);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const savedPreferences = useRef(null), preferencesTimer = useRef(), saveBeforeCloseRef = useRef(async () => false), modelOpenQueue = useRef(Promise.resolve());
  function changePreferences(next) { const value = normalizePreferences(typeof next === 'function' ? next(preferencesRef.current) : next); preferencesRef.current = value; setPreferences(value); }
  useEffect(() => {
    const resizePanel = event => changePreferences(previous => ({ ...previous, panelWidth: event.detail }));
    window.addEventListener(PANEL_WIDTH_EVENT, resizePanel);
    return () => window.removeEventListener(PANEL_WIDTH_EVENT, resizePanel);
  }, []);
  const changeSensitivity = value => changePreferences({ ...preferencesRef.current, scrollSensitivity: value });
  const changePointerSensitivity = value => changePreferences({ ...preferencesRef.current, pointerSensitivity: value });
  const toggleWheelMode = mode => changePreferences(previous => ({ ...previous, wheelMode: previous.wheelMode === mode ? 'rotate' : mode }));
  const toggleCamera = () => setCameraMode(previous => previous === 'work' ? 'rotate' : 'work');
  const [showcaseHistoryState,setShowcaseHistoryState]=useState({undo:false,redo:false});
  const showcaseHistoryChanged=useCallback(value=>setShowcaseHistoryState(prior=>prior.undo===value.undo&&prior.redo===value.redo?prior:value),[]);
  const [showcaseSession,setShowcaseSession]=useState(null),[showcaseVisited,setShowcaseVisited]=useState(false);
  const [session, setSession] = useState(newSession);
  const [sessions, setSessions] = useState(() => [session]);
  const [tick, setTick] = useState(0), [status, setStatus] = useState('Ready'), [statusAlert, setStatusAlert] = useState(0);
  const [fileDrag, setFileDrag] = useState(false), fileDragTimer = useRef();
  const [repairReceipt, setRepairReceipt] = useState(null);
  const [mode, setMode] = useState('vertices'), [cameraMode, setCameraMode] = useState('work'), [view, setStoredView] = useState('orthographic'), [portraitView, setPortraitView] = useState('perspective'), [storedWorkplane, setStoredWorkplane] = useState('xy');
  const [adjustingInput, setAdjustingInput] = useState(null);
  // VIS switches display controls while retaining editing and portrait state.
  const [visUI, setVisUI] = useState(false);
  const [quadView, setQuadView] = useState(false), [activeVertexPane, setActiveVertexPane] = useState(null);
  const [vertexViewRequest, setVertexViewRequest] = useState(null);
  const setView = value => {
    if (quadView && mode === 'vertices') setVertexViewRequest(previous => ({ view: value, revision: (previous?.revision || 0) + 1 }));
    else setStoredView(value);
  };
  const toggleQuadView = () => setQuadView(value => !value);
  const lockedVertexPlane = mode === 'vertices' && quadView ? activeVertexPane?.workplane : null;
  const [cameraAngles, setCameraAngles] = useState({x:0,y:0,z:0}), [cameraAnglesRequest,setCameraAnglesRequest] = useState(null), [cameraGesture,setCameraGesture] = useState(false);
  const [portraitEnabled, setPortraitEnabled] = useState(false), [portraitCameraIndex, setPortraitCameraIndex] = useState(0);
  const [controlModelIds, setControlModelIds] = useState([]);
  const [controlModelGroup, setControlModelGroup] = useState('all');
  useEffect(() => { setControlModelGroup('all'); setControlModelIds([]); setMaterialVisibility(null); }, [session.id]);
  useEffect(() => { setPortraitCameraIndex(0); setPortraitPreviewChanged(false); }, [session.id]);
  const [portraitSnapRevision, setPortraitSnapRevision] = useState(0);
  const [portraitSettings, setPortraitSettings] = useState({ lighting: true, dncLights: false, composition: false, thirds: false, mask: .65 });
  const [portraitPreviewChanged, setPortraitPreviewChanged] = useState(false), [portraitLightingStatus, setPortraitLightingStatus] = useState('');
  const receiveCameraAngles = useCallback(value => setCameraAngles(previous => ['x','y','z'].some(axis=>Math.abs(previous[axis]-value[axis])>.001)?value:previous), []);
  const [grabThroughByEditor, setGrabThroughByEditor] = useState({vertices:true,bones:false});
  const grabThrough = grabThroughByEditor[mode] ?? false;
  const setGrabThrough = value => setGrabThroughByEditor(previous => ({...previous,[mode]:value}));
  const cameraProps = {onCameraAnglesChange:receiveCameraAngles,cameraAnglesRequest,onCameraGestureChange:setCameraGesture,onSensitivityIndicator:setAdjustingInput,grabThrough};
  useEffect(()=>setCameraGesture(false),[mode,session.id]);
  const [tool, setTool] = useState('select'), [teamColor, setTeamColor] = useState('#ff0303'), [renderMode, setRenderMode] = useState('wireframe'), [movementRenderMode, setMovementRenderMode] = useState('influence'), untexturedModes = useRef({});
  const [previewRenderModes, setPreviewRenderModes] = useState({});
  const [visibleOnly, setVisibleOnly] = useState(new Set());
  const [checkedGeosets, setSelectable] = useState(new Set()), [selection, setSelection] = useState({}), [hidden, setHidden] = useState({}), [activeGeoset, setActiveGeoset] = useState(0), [uvSet, setUvSet] = useState(0);
  const [normalizer, setNormalizer] = useState(null), normalizerKeepRef = useRef(null);
  const [showAllGeosets, setShowAllGeosets] = useState(true), [hideExtras, setHideExtras] = useState(false);
  const [activeGeosetTab, setActiveGeosetTab] = useState('all');
  const [viewHoveredGeoset, setViewHoveredGeoset] = useState(null), [selectionHoveredGeoset, setSelectionHoveredGeoset] = useState(null);
  useEffect(() => { setViewHoveredGeoset(null); setSelectionHoveredGeoset(null); }, [mode, preferences.highlightSelection, preferences.viewportAppearance.geosetHighlight.viaView, preferences.viewportAppearance.geosetHighlight.viaSelection]);
  const [globalSeqId, setGlobalSeqId] = useState(null), [highlightByPanel, setHighlightByPanel] = useState({ movement: false, animations: false }), [highlightChain, setHighlightChain] = useState(false);
  const [sequence, setSequence] = useState(-1), [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [playbackSpeed, setPlaybackSpeed] = useState(100), [dialog, setDialog] = useState(null), [context, setContext] = useState(null);
  useEffect(()=>setAdjustingInput(null),[mode,settingsTab,dialog?.type]);
  const [animationPanel, setAnimationPanel] = useState('movement'), [selectedNodeIds, setSelectedNodeIdsState] = useState([]), [movementMode, setMovementMode] = useState('select'), [movementSpace, setMovementSpace] = useState('local'), [showNodes, setShowNodes] = useState(true);
  // Leaving Movement or Animations ends a camera drag the preview never finished.
  useEffect(()=>setCameraGesture(false),[animationPanel]);
  const poseConfig = session.pose || { enabled: false, chains: [], body: null, pins: [], target: null };
  const poseSelectionOnly = useRef(false);
  const changePose = value => { if (value.enabled) session.poseView ||= poseView; session.pose = value; setTick(tick => tick + 1); };
  const pinPose = (key, frame, sequence) => {
    const config = session.pose || poseConfig, chain = config.chains.find(item => item.key === key);
    if (!chain || doc.readOnly || saving) return;
    samplePoseChain(model, chain, frame, sequence);
    const targets = { ...config.targets }; delete targets[key];
    changePose({ ...config, targets, pins: config.pins.includes(key) ? config.pins.filter(value => value !== key) : [...config.pins, key] });
  };
  const selectPose = target => { poseSelectionOnly.current = true; setSelectedNodeIdsState(target?.kind === 'node' ? [target.id] : target?.kind === 'body' ? [session.pose.body] : []); changePose({ ...(session.pose || poseConfig), target, ...(session.pose?.picking ? { pickSerial: (session.pose.pickSerial || 0) + 1 } : {}) }); };
  const setSelectedNodeIds = value => {
    if (session.pose?.enabled && value.length === 1) {
      const id = value[0], chain = session.pose.chains.find(item => item.end === id);
      if (session.pose.picking) { poseSelectionOnly.current = true; session.pose = { ...session.pose, pickSerial: (session.pose.pickSerial || 0) + 1 }; }
      session.pose = { ...session.pose, target: chain ? { kind: 'endpoint', key: chain.key } : id === session.pose.body ? { kind: 'body' } : { kind: 'node', id } };
    } else if (session.pose?.target) session.pose = { ...session.pose, target: null };
    setSelectedNodeIdsState(value);
  };
  const [attachSourceIds, setAttachSourceIds] = useState([]), [boneCreateOpen, setBoneCreateOpen] = useState(false), [attachematorOpen, setAttachematorOpen] = useState(false);
  // Each model tab keeps its own cameras, so switching tabs returns to the view left there.
  const cameraHandoff = session.cameraHandoff ||= { current: null };
  const paintCamera = session.paintCamera ||= { current: null };
  const portraitModeActive = portraitEnabled && mode === 'animation';
  const cameraRotating = cameraMode === 'rotate' && !lockedVertexPlane || cameraGesture;
  const [storedWorkplaneEnabled, setStoredWorkplaneEnabled] = useState(true), [multipleNodes, setMultipleNodes] = useState(false);
  const [restrictions, setRestrictions] = useState({translation:false,rotation:false,scaling:false});
  const rigWorkspace = mode === 'bones' || mode === 'animation' && animationPanel === 'movement';
  const restPose = mode === 'bones', cleanAnimationPreview = mode === 'animation' && animationPanel === 'animations';
  const highlightKeyframes = highlightByPanel[animationPanel];
  const setHighlightKeyframes = value => { setHighlightByPanel(previous => ({ ...previous, [animationPanel]: value })); if (animationPanel === 'movement' && !value) setHighlightChain(false); };
  const changeHighlightChain = value => { setHighlightChain(value); if (value) setHighlightByPanel(previous => ({ ...previous, movement: true })); };
  const [captureAPI, setCaptureAPI] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [uvEntrySelection, setUVEntrySelection] = useState({}), [uvEntryId,setUVEntryId] = useState(0);
  const [uvWindow, setUVWindowState] = useState(null), [uvFocused, setUVFocused] = useState(false);
  const uvEditing = !!uvWindow && !uvWindow.minimized && uvFocused;
  const setUVWindow = next => {
    const value = typeof next === 'function' ? next(session.uvWindow || null) : next;
    session.uvWindow = value; setUVWindowState(value);
  };
  const closeUVWindow = () => { document.activeElement?.blur?.(); setUVWindow(null); setUVFocused(false); setLiveUV(null); if (dialog?.host === 'uv') setDialog(null); };
  const [rgbPreview, setRGBPreview] = useState(false), [rgbSequence, setRGBSequence] = useState(-1);
  const [background, setBackground] = useState(() => localStorage.getItem('mdlvis-preview-background') || '');
  const [xlCleanViews, setXLCleanViews] = useState({}), [visCleanViews, setVISCleanViews] = useState({});
  const [xlOverlayModes, setXLOverlayModes] = useState(()=>storedEditorDisplay()), [visOverlayModes, setVISOverlayModes] = useState(()=>storedEditorDisplay(true));
  useEffect(() => saveEditorDisplay(xlOverlayModes, visOverlayModes), [xlOverlayModes, visOverlayModes]);
  const normalCleanViews = visUI ? visCleanViews : xlCleanViews, setNormalCleanViews = visUI ? setVISCleanViews : setXLCleanViews;
  const normalOverlayModes = visUI ? visOverlayModes : xlOverlayModes, setNormalOverlayModes = visUI ? setVISOverlayModes : setXLOverlayModes;
  const displayMode = mode === 'animation' ? animationPanel : mode;
  const poseViewActive = mode === 'animation' && animationPanel === 'movement' && poseConfig.enabled;
  const poseView = session.poseView || { overlays: defaultPoseDisplay(normalOverlayModes.movement), cleanView: false, workplaneEnabled: false, workplane: storedWorkplane };
  const changePoseView = patch => { session.poseView = { ...(session.poseView || poseView), ...patch }; setTick(tick => tick + 1); };
  const cleanViews = poseViewActive ? { ...normalCleanViews, [mode]: poseView.cleanView } : normalCleanViews;
  const overlayModes = poseViewActive ? { ...normalOverlayModes, [displayMode]: poseView.overlays } : normalOverlayModes;
  const setCleanViews = next => poseViewActive ? changePoseView({ cleanView: (typeof next === 'function' ? next(cleanViews) : next)[mode] }) : setNormalCleanViews(next);
  const setOverlayModes = next => poseViewActive ? changePoseView({ overlays: (typeof next === 'function' ? next(overlayModes) : next)[displayMode] }) : setNormalOverlayModes(next);
  const workplaneEnabled = poseViewActive ? poseView.workplaneEnabled : storedWorkplaneEnabled;
  const workplane = poseViewActive ? poseView.workplane : storedWorkplane;
  const setWorkplaneEnabled = next => poseViewActive ? changePoseView({ workplaneEnabled: typeof next === 'function' ? next(workplaneEnabled) : next }) : setStoredWorkplaneEnabled(next);
  const setWorkplane = next => poseViewActive ? changePoseView({ workplane: typeof next === 'function' ? next(workplane) : next }) : setStoredWorkplane(next);
  const cleanView = !!cleanViews[mode], storedOverlays = mode === 'showcase' ? {} : cleanView ? Object.fromEntries(Object.keys(overlayModes[displayMode]).map(key => [key, false])) : overlayModes[displayMode];
  const visibleOverlays = visUI ? { ...storedOverlays, bones: true, helpers: true, attachments: true } : storedOverlays;
  const overlays = visibleOverlays.cameras ? { ...visibleOverlays, cameras: false } : visibleOverlays;
  const panelOverlays = overlays;
  function changeOverlay(key, value) { setOverlayModes(previous => setEditorDisplay(previous, displayMode, key, value)); setCleanViews(previous => ({ ...previous, [mode]: false })); }
  const shaded = overlays.shaded, setShaded = value => changeOverlay('shaded', value);
  const showAxes = !cleanView && !cleanAnimationPreview && Object.values(preferences.grid.axes).some(Boolean);
  const showGrid = overlays.grid, setShowGrid = value => changeOverlay('grid', value), showVertices = overlays.vertices, setShowVertices = value => changeOverlay('vertices', value);
  const portraitOverlays = { ...panelOverlays, grid: false, cameras: false };
  const [liveUV, setLiveUV] = useState(null), [saving, setSaving] = useState(false);
  const [saveDataChoice, setSaveDataChoice] = useState(null);
  // One small modal for HD notices; editors raise it with an mdlxl-notice event.
  const [notice, setNotice] = useState(null);
  useEffect(() => { const show = event => setNotice({ message: event.detail }); window.addEventListener('mdlxl-notice', show); return () => window.removeEventListener('mdlxl-notice', show); }, []);
  const savingRef = useRef(false);
  const liveMovementRevision = useRef(-1);
  const [recoveries, setRecoveries] = useState([]), [historyMB, setHistoryMB] = useState(512), [historySteps, setHistorySteps] = useState(10000), [anchor, setAnchor] = useState(''), [normalAngle, setNormalAngle] = useState(90), [gameDataPath, setGameDataPath] = useState('');
  const [gameDataSources, setGameDataSources] = useState([]);
  const [zoomAnchor, setZoomAnchor] = useState(null), [choosingZoomAnchor, setChoosingZoomAnchor] = useState(false);
  const files = useRef(), textures = useRef(), managerTextures = useRef(), folder = useRef(), clipboard = useRef(null), latest = useRef(), commands = useRef({}), rangeAnchor = useRef(0), settings = useRef({}), textureResolutions = useRef(new WeakMap());
  const doc = session.doc, model = doc.model, geoset = model.Geosets[activeGeoset];
  const geosetTab = activeGeosetTab === 'ungrouped' || (model[GEOSET_TABS_KEY] || []).some(tab => tab.id === activeGeosetTab) ? activeGeosetTab : 'all';
  // Hide extras only takes corpse/background geosets out of the work area; nothing is deleted.
  const extraGeosets = useMemo(() => hideExtras ? corpseAndBackgroundGeosets(model) : new Set(), [model, doc.revision, hideExtras]);
  const tabGeosets = useMemo(() => new Set([...geosetsInTab(model, geosetTab)].filter(index => !extraGeosets.has(index))), [model, doc.revision, geosetTab, extraGeosets]);
  const tabVisibleGeosets = useMemo(() => new Set([...geosetsInTab(model, geosetTab, { visible: true })].filter(index => !extraGeosets.has(index))), [model, doc.revision, geosetTab, extraGeosets]);
  const selectable = useMemo(() => new Set([...checkedGeosets].filter(index => tabVisibleGeosets.has(index))), [checkedGeosets, tabVisibleGeosets]);
  const selectGeosetTab = next => {
    setActiveGeosetTab(next);
    const indices = geosetsInTab(model, next);
    setActiveGeoset(previous => indices.has(previous) ? previous : indices.values().next().value ?? -1);
    setUvSet(0); rangeAnchor.current = -1;
  };
  const inspectingMotion = mode === 'animation' && globalSeqId === null;
  const motion = useMotionInspector(session, sequence, doc.revision, inspectingMotion && sequence >= 0);
  const [motionAnchor, setMotionAnchor] = useState(8);
  const motionOrigin = useRef(null);
  const closeMotion = () => { motion.setActive(null); motion.setFocus(null); motionOrigin.current?.focus({ preventScroll: true }); };
  const sharedMotionChannel = inspectingMotion && model.Nodes?.some(node => {
    const global = node?.[movementProperties[movementMode]]?.GlobalSeqId;
    return selectedNodeIds.includes(node?.ObjectId) && Number.isInteger(global) && global >= 0;
  });
  const seekMotionTime = value => {
    setPlaying(false); setTime(value);
    if (motion.focus && (value < motion.focus[0] || value > motion.focus[1])) motion.setFocus(null);
  };
  const selectMotion = finding => {
    const target = finding.targets?.[0] || { time: finding.time, keyTimes: finding.selectionKeys || [finding.time] };
    const channel = Object.keys(movementProperties).find(mode => movementProperties[mode] === finding.property) || 'rotate';
    selectAnimationPanel('movement');
    seekMotionTime(Math.round(target.time)); setSelectedNodeIds([finding.nodeId]);
    setMovementMode(channel); setTool(channel === 'move' ? 'translate' : channel);
    setHighlightByPanel(previous => ({ ...previous, movement: true }));
    timelineCommands.current.selectKeys?.(target.keyTimes || [target.time], { kind: 'node', id: finding.nodeId, property: finding.property });
    setCameraMode('work');
    setShowNodes(true); setCleanViews(previous => ({ ...previous, animation: false }));
    setOverlayModes(previous => setEditorDisplay(setEditorDisplay(previous, 'animation', 'bones', true), 'animation', 'nodes', true));
  };
  const replayMotion = finding => {
    const interval = model.Sequences[sequence]?.Interval;
    if (!interval) return;
    const padding = Math.max(100, Math.round((finding.end - finding.start) * .2));
    const focus = [Math.max(interval[0], Math.floor(finding.start - padding)), Math.min(interval[1], Math.ceil(finding.end + padding))];
    motion.setFocus(focus); setTime(focus[0]); setPlaying(true);
  };
  const duplicateAnimations = useMemo(() => scanGeosetAnimationDuplicates(model), [model, doc.revision]);
  const repairBlocked = duplicateAnimations.length > 0 || !!repairReceipt;
  useEffect(() => { if (!model.Cameras?.[portraitCameraIndex]) setPortraitCameraIndex(model.Cameras?.length ? 0 : -1); }, [model, doc.revision, portraitCameraIndex]);
  useEffect(() => {
    if (portraitEnabled && !model.Cameras?.length) setPortraitEnabled(false);
  }, [model, doc.revision, sequence, portraitEnabled]);
  const paintOriginalModel=useMemo(()=>session.paintOriginalModelBytes?openDocument(session.paintOriginalModelBytes,doc.name).model:model,[session.paintOriginalModelBytes,session.id,model]);
  const animationDomain = useMemo(() => classicTimelineDomain(model, model.Sequences[sequence] ? sequence : -1, model.GlobalSequences?.[globalSeqId] > 0 ? globalSeqId : null), [model, doc.revision, sequence, globalSeqId]);
  useLayoutEffect(() => {
    const missingSequence = sequence >= 0 && !model.Sequences[sequence];
    const missingGlobal = globalSeqId !== null && !(model.GlobalSequences?.[globalSeqId] > 0);
    if (missingSequence || missingGlobal) {
      if (missingSequence) setSequence(-1);
      if (missingGlobal) setGlobalSeqId(null);
      setPlaying(false); setTime(value => Math.max(animationDomain.start, Math.min(animationDomain.end, value)));
    }
  }, [model, doc.revision, sequence, globalSeqId, animationDomain]);
  const selectionHistory = useMemo(() => new SelectionHistory(doc), [doc]);
  const selectionState = { selectable, visibleOnly, selection, hidden, activeGeoset, uvSet, selectedNodeIds };
  useLayoutEffect(() => { const record = !poseSelectionOnly.current; poseSelectionOnly.current = false; if (selectionHistory.observe(selectionState, { record })) setTick(value => value + 1); }, [selectionHistory, selectable, visibleOnly, selection, hidden, activeGeoset, uvSet, selectedNodeIds, doc.revision]);
  latest.current = { session, sessions, showcaseSession, doc, model, selection, checkedGeosets, activeGeosetTab, selectable, visibleOnly, hidden, mode, animationPanel, activeGeoset, uvSet, selectedNodeIds, globalSeqId, sequence, time, rgbPreview, rgbSequence, renderMode, movementRenderMode, showAllGeosets, uvEntrySelection, uvEntryId, dialog, settingsTab, preferencesReady };
  const refresh = () => setTick(value => value + 1);
  // Each error gets a new alert number so the status bar flashes again even when the same error repeats.
  const say = (message, error = false) => { setStatus((error ? 'Error: ' : '') + message); setStatusAlert(count => error ? count + 1 : 0); };
  const selectBackground = value => { setBackground(value); localStorage.setItem('mdlvis-preview-background', value); };
  const backgroundLibrary = usePreviewBackgrounds(mode === 'animation' || mode === 'showcase', background, selectBackground, say);
  const {validSelection,selectionCount,centroid,totalVertices,totalFaces,hiddenCount,selectedFaces} = useMemo(() => {
    const validSelection = filterVertexSelection(selection, selectable, model);
  const selectionCount = Object.values(validSelection).reduce((sum, ids) => sum + ids.length, 0);
  const centroid = [0, 0, 0];
  for (const [gi, ids] of Object.entries(validSelection)) for (const id of ids) for (let axis = 0; axis < 3; axis++) centroid[axis] += model.Geosets[gi].Vertices[id * 3 + axis] / (selectionCount || 1);
  const totalVertices = model.Geosets.reduce((sum, g, i) => sum + (selectable.has(i) ? g.Vertices.length / 3 : 0), 0), totalFaces = model.Geosets.reduce((sum, g, i) => sum + (selectable.has(i) ? g.Faces.length / 3 : 0), 0);
  const hiddenCount = Object.entries(hidden).reduce((sum, [gi, ids]) => sum + new Set(ids.filter(i => i < (model.Geosets[gi]?.Vertices.length || 0) / 3)).size, 0);
  let selectedFaces = 0; for (const [gi, ids] of Object.entries(validSelection)) { const picked = new Set(ids), faces = model.Geosets[gi].Faces; for (let i = 0; i < faces.length; i += 3) if (picked.has(faces[i]) && picked.has(faces[i + 1]) && picked.has(faces[i + 2])) selectedFaces++; }
    return {validSelection,selectionCount,centroid,totalVertices,totalFaces,hiddenCount,selectedFaces};
  }, [doc, doc.revision, selection, selectable, hidden]);
  useEffect(() => {
    if (!zoomAnchor) return;
    const anchorGeoset = model.Geosets[zoomAnchor.geosetIndex];
    if (mode !== 'vertices' || tool !== 'scale' || !anchorGeoset || zoomAnchor.vertexIndex < 0 || zoomAnchor.vertexIndex >= anchorGeoset.Vertices.length / 3 || !validSelection[zoomAnchor.geosetIndex]?.includes(zoomAnchor.vertexIndex)) clearZoomAnchor();
  }, [zoomAnchor, mode, tool, model, doc.revision, validSelection]);
  // The NormalsXL preview is transient: any other change discards it, except
  // its own Fix facing edit, after which the panel stays open on the result.
  useEffect(() => {
    const keep = normalizerKeepRef.current === doc.revision;
    normalizerKeepRef.current = null;
    if (!keep) setNormalizer(null);
  }, [session.id, doc.revision, mode, selection, selectable, hidden, showAllGeosets, activeGeosetTab, dialog, settingsTab, saving]);
  useEffect(() => {
    if (!normalizer) return;
    const cancel = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setNormalizer(null); }
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [!!normalizer]);
  const editable = !doc.readOnly && mode !== 'animation' && mode !== 'paint' && mode !== 'showcase' && !saving;
  const edit = (label, sections, operation, options = {}) => {
    if (savingRef.current) return false;
    try {
      const ticket = selectionHistory.captureEdit(selectionState), guard = captureUVPreviewGuard(doc.model, session.uvPreviews);
      const result = doc.apply(label, sections, m => {
        const value = operation(m);
        // Numeric fields, timeline edits and mouse drags share this commit.
        // Temporary drag poses never pay for a complete animation sweep.
        if (portraitModeActive && sections.includes('Nodes')) refreshPortraitExtentsAfterRigEdit(doc._committedModel, m);
        validateUVPreviewGuard(m, session.uvPreviews, guard);
        return value;
      }, {validate:options.validate});
      selectionHistory.recordEdit(ticket, selectionState); refresh(); if (result !== false) say(label); return result;
    } catch (error) { refresh(); say(error.message, true); if(options.rethrow)throw error; return false; }
  };
  const singleRigNode = selectedNodeIds.length === 1 ? model.Nodes?.[selectedNodeIds[0]] : null;
  const selectedBone = singleRigNode && model.Bones.some(bone => bone.ObjectId === singleRigNode.ObjectId) ? singleRigNode : null;
  const parentBone = singleRigNode && model.Bones.some(bone => bone.ObjectId === singleRigNode.Parent);
  const selectedRigNodes = selectedNodeIds.map(id => model.Nodes?.[id]).filter(Boolean);
  const vertexNodeCenter=visUI&&mode==='vertices'&&!selectionCount&&selectedRigNodes.length?[0,1,2].map(axis=>selectedRigNodes.reduce((sum,node)=>sum+(node.PivotPoint?.[axis]||0),0)/selectedRigNodes.length):null;
  const parentedRigNodes = selectedRigNodes.filter(node => model.Bones.some(bone => bone.ObjectId === node.Parent));
  const createBoneOrAttachment = type => {
    if (type === 'Bone' && !selectionCount) captureAPI?.focusPoint?.([0, 0, 0]);
    const created = edit(`Create ${type.toLowerCase()}`, ['Nodes', 'PivotPoints', 'Info'], current => createRigNode(current, type, validSelection));
    setBoneCreateOpen(false);
    if (created && created !== false) {
      setSelectedNodeIds([created.ObjectId]);
      if (type === 'Attachment') changeOverlay('attachments', true);
    }
  };
  const openAttachemator = () => { setBoneCreateOpen(false); setAttachSourceIds([]); setAttachematorOpen(true); };
  const commitAttachemator = ({ rows, chosen, pivots, parents }) => {
    const result = edit('Attachemator', ['Nodes', 'PivotPoints', 'Info'], current => applyAttachmentPlan(current, rows, { chosen, pivots, parents }), { rethrow: true });
    if (result === false) return false;
    changeOverlay('attachments', true); setSelectedNodeIds([]);
    say(`Attachemator placed ${result.changed} attachment point${result.changed === 1 ? '' : 's'}.`);
    return result;
  };
  const deleteSelectedNode = () => {
    const ids=mode==='vertices'?selectedRigNodes.map(node=>node.ObjectId):singleRigNode?[singleRigNode.ObjectId]:[];
    if (!ids.length) return;
    const result = edit('Delete object', ['Nodes', 'PivotPoints', 'Geosets', 'Info'], current => {for(const id of ids.sort((a,b)=>b-a))deleteRigNode(current,id);});
    if (result !== false) { setSelectedNodeIds([]); setAttachSourceIds([]); }
  };
  const renameSelectedNode = (id, value) => edit('Rename object', ['Nodes'], current => renameRigNode(current, id, value));
  const setSelectedBoneBillboarded = (id, enabled) => edit('Set bone billboarded', ['Nodes'], current => setBoneBillboarded(current, id, enabled));
  const beginAttach = () => {
    if (!selectedRigNodes.length || selectedRigNodes.length > 1 && !multipleNodes) return;
    setCameraMode('work'); setMovementMode('select'); setAttachSourceIds(selectedRigNodes.map(node => node.ObjectId));
  };
  const finishAttach = parentId => {
    if (!attachSourceIds.length) return;
    const changed = attachSourceIds.filter(id => model.Nodes?.[id]?.Parent !== parentId);
    if (!changed.length) { setAttachSourceIds([]); return; }
    const result = edit('Attach to parent bone', ['Nodes'], current => changed.forEach(id => attachToBone(current, id, parentId)));
    if (result !== false) setAttachSourceIds([]);
  };
  const detachSelectedNode = () => {
    if (!parentedRigNodes.length || selectedRigNodes.length > 1 && !multipleNodes) return;
    edit('Detach from parent bone', ['Nodes'], current => parentedRigNodes.forEach(node => detachFromBone(current, node.ObjectId)));
  };
  const bindSelectedVertices = kind => {
    if (!selectedBone || !selectionCount) return;
    edit(kind === 'soft' ? 'Soft bind vertices' : kind === 'hard' ? 'Hard bind vertices' : 'Detach vertices from bone', ['Geosets'], current => {
      for (const [index, ids] of Object.entries(validSelection)) if (ids.length) changeVertexBinding(current, current.Geosets[Number(index)], ids, selectedBone.ObjectId, kind);
    });
  };
  // Portrait is a view within Movement: preserve its selection, tools and undo path.
  const enterPortrait = (cameraIndex, sequenceIndex) => {
    setPortraitCameraIndex(cameraIndex); setGlobalSeqId(null);
    setSequence(sequenceIndex); setTime(model.Sequences[sequenceIndex]?.Interval[0] || 0);
    setRenderMode('textured'); setCleanViews(previous => ({ ...previous, animation: false }));
    setCameraMode('work'); setPortraitView('perspective'); setPortraitEnabled(true); setPlaying(sequenceIndex >= 0); setPortraitPreviewChanged(false);
  };
  const enablePortrait = () => {
    const cameraIndex = model.Cameras?.[portraitCameraIndex] ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
    const portraitSequence = firstPortraitSequenceIndex(model);
    if (cameraIndex < 0) {
      setDialog({ type: 'portraitSetup', missingCamera: true, missingSequence: false });
      return;
    }
    enterPortrait(cameraIndex, portraitSequence);
  };
  const currentCameraView = () => captureAPI?.cameraView?.();
  const completePortraitSetup = ({ duration, sourceIndex }) => {
    const cameraIndex = model.Cameras?.[portraitCameraIndex] ? portraitCameraIndex : model.Cameras?.length ? 0 : -1;
    if (cameraIndex < 0) throw Error('Use Set Current View to create a camera first.');
    const sequenceIndex = edit('Create Portrait sequence', ['Sequences', 'Geosets', 'GeosetAnims', 'Materials', 'Nodes', 'Info'], current => createPortraitSequence(current, duration, sourceIndex), { rethrow: true });
    if (sequenceIndex === false) return;
    setDialog(null); enterPortrait(cameraIndex, sequenceIndex);
  };
  const updatePortraitCamera = () => {
    const view = currentCameraView();
    if (!view) { say('The model viewport is still loading.', true); return false; }
    if (model.Cameras?.[portraitCameraIndex] && !Object.keys(changedPortraitFields(model, portraitCameraIndex, view, time, sequence)).length) {
      // The preview already matches the camera: nothing to apply or undo.
      setPortraitView('perspective'); setPortraitPreviewChanged(false); return portraitCameraIndex;
    }
    const index = edit('Set camera to current view', ['Cameras', 'BindPoses'], current => setCameraFromCurrentView(current, portraitCameraIndex, view, time, sequence));
    if (index !== false) { setPortraitCameraIndex(index); setPortraitView('perspective'); setPortraitPreviewChanged(false); }
    return index;
  };
  const newPortraitCamera = () => {
    const previewSequence = firstPortraitSequenceIndex(model), previewFrame = model.Sequences[previewSequence]?.Interval[0] || 0;
    const index = edit('New portrait camera', ['Cameras', 'BindPoses'], current => createPortraitCamera(current, framePortraitSubject(current, null, previewFrame, previewSequence)));
    if (index !== false) enterPortrait(index, previewSequence);
  };
  const promotePortraitCamera = () => {
    const index = edit('Make game portrait camera', ['Cameras','BindPoses'], current => makePortraitCamera(current, portraitCameraIndex));
    if (index !== false) { setPortraitCameraIndex(index); setPortraitPreviewChanged(false); }
  };
  const editPortraitFields = patch => {
    let changed;
    try { changed = changedPortraitFields(model, portraitCameraIndex, patch, time, sequence); } catch (error) { say(error.message, true); return false; }
    // Unchanged values are not edits: no undo step and no Modified state.
    if (!Object.keys(changed).length) return true;
    setPlaying(false);
    const result = edit('Edit portrait camera', ['Cameras'], current => editPortraitCamera(current, portraitCameraIndex, changed, time, sequence));
    if (result !== false) { setPortraitView('perspective'); setPortraitPreviewChanged(false); }
    return result;
  };
  const composePortraitShot = kind => {
    const view = (portraitModeActive && currentCameraView()) || evaluateModelCamera(model, model.Cameras?.[portraitCameraIndex], time, sequence);
    const index = edit(kind === 'frame' ? 'Frame portrait subject' : kind === 'front' ? 'Front portrait shot' : 'Level portrait shot', ['Cameras','BindPoses'], current => setCameraFromCurrentView(current, portraitCameraIndex, kind === 'frame' ? framePortraitSubject(current, view, time, sequence) : portraitShot(view, kind), time, sequence));
    if (index !== false) { setPlaying(false); setPortraitView('perspective'); setPortraitPreviewChanged(false); }
  };
  const hasPortraitBackground = useMemo(() => findPortraitBackground(model) >= 0, [model, doc.revision]);
  // The last look placed from Background options also shapes the next Add.
  const lastBackdropLook = () => { try { return normalizeBackdropLook(JSON.parse(localStorage.getItem('mdlxl-portrait-background-look') || 'null')); } catch { return normalizeBackdropLook(null); } };
  const portraitBackdropLook = () => (hasPortraitBackground && currentBackdropLook(model, portraitCameraIndex, time, sequence)) || lastBackdropLook();
  const placePortraitBackground = look => {
    if (look) try { localStorage.setItem('mdlxl-portrait-background-look', JSON.stringify(normalizeBackdropLook(look))); } catch { /* the look still applies now */ }
    const label = hasPortraitBackground ? 'Refresh portrait background' : 'Add portrait background';
    // Without a chosen look, Refresh keeps the background's own size and height.
    edit(label, ['Geosets', 'GeosetAnims', 'Materials', 'Textures', 'Bones', 'Nodes', 'PivotPoints', 'BindPoses', 'Sequences', 'Cameras', 'Info'], current => refreshPortraitBackground(current, portraitCameraIndex, { frame: time, sequenceIndex: sequence, portraitFile: /_portrait\.md[lx]$/i.test(doc.name), look, fallback: lastBackdropLook() }));
  };
  const openPortraitSequenceSetup = () => setDialog({ type: 'portraitSetup', missingCamera: !model.Cameras?.length, missingSequence: true });
  const selectControlModel = (group = controlModelGroup) => {
    try {
      const ids = group === 'all' ? modelControlRoots(model).map(root => root.id) : modelControlGroups(model)[Number(group)]?.ids;
      if (!ids?.length) throw new Error('Control Model group is unavailable.');
      setControlModelGroup(group); setControlModelIds(ids); setSelectedNodeIds(ids); setMovementMode('move'); setMovementSpace('world'); setTool('translate'); setCameraMode('work'); setPlaying(false);
    } catch (cause) { say(cause.message, true); }
  };
  const setMissingPortraitCamera = () => {
    const index = updatePortraitCamera();
    if (index === false) return;
    if (dialog.missingSequence) setDialog(previous => ({ ...previous, missingCamera: false }));
    else { setDialog(null); enterPortrait(index, firstPortraitSequenceIndex(model)); }
  };
  const clearDisplay = () => {
    setOverlayModes(previous => clearQuickDisplay(previous, displayMode));
    setCleanViews(previous => ({ ...previous, [mode]: false }));
  };
  const clearZoomAnchor = () => { setZoomAnchor(null); setChoosingZoomAnchor(false); };
  const openOptimizeXL = () => {
    if (dialog?.type === 'optimizeModel' && dialog.child && !dialog.child.closed) { dialog.child.focus(); return; }
    const child = openOptimizeXLWindow(window);
    if (!child) { say('The OptimizeXL window could not be opened.', true); return; }
    setPlaying(false); setDialog({ type:'optimizeModel', child });
  };
  // Animations does not show the bones picked in Movement or Bones, yet any
  // node selection takes Visibility & Color away from the checked geosets.
  // Park those bones on entering Animations and give them back on leaving
  // unless Animations picked its own nodes; neither step is an undo entry.
  const parkNodeSelection = () => {
    if (selectedNodeIds.length) { session.parkedNodeIds = selectedNodeIds; poseSelectionOnly.current = true; setSelectedNodeIdsState([]); }
    setMaterialVisibility(null);
  };
  const returnParkedNodes = () => {
    const parked = session.parkedNodeIds; delete session.parkedNodeIds;
    if (!parked || selectedNodeIds.length) return false;
    const existing = new Set(model.Nodes.filter(Boolean).map(node => node.ObjectId)), ids = parked.filter(id => existing.has(id));
    if (!ids.length) return false;
    poseSelectionOnly.current = true; setSelectedNodeIdsState(ids); return true;
  };
  const selectMode = async next => {
    if (savingRef.current || next === mode && next !== 'uv') { if (next === 'vertices') setUVFocused(false); return; }
    // Function-key mode changes can remove a focused blur-committed field
    // before React sees its blur. Commit that pending value while its editor
    // is still mounted (notably the final RGB channel in Animations).
    document.activeElement?.blur?.();
    if (mode === 'showcase') { const pending = []; window.dispatchEvent(new CustomEvent('mdlvis-flush-captures', { detail: pending })); await Promise.all(pending); }
    if (mode === 'paint') { window.dispatchEvent(new CustomEvent('mdlxl-paint-flush')); if (session.paintProject && !await applyPaintToModel()) return; setRenderMode('textured'); setSelectable(new Set(visiblePaintGeosets(paintOriginalModel, activeGeoset))); setShowAllGeosets(false); }
    if (next === 'paint' && session.paintAppliedRevision !== undefined) { session.paintWorkingModel = structuredClone(doc.model); session.paintWorkingRevision++; }
    if (next === 'uv' && uvWindow) { setUVWindow(previous => ({ ...previous, minimized: false })); setUVFocused(true); return; }
    if (next === 'uv') {
      const entry = captureUVSelection(model, validSelection, selectable, hidden), eligible = Object.keys(entry)[0];
      if (eligible === undefined) return;
      setUVEntrySelection(entry); setUVEntryId(value => value + 1);
      if (!entry[activeGeoset]?.length) { setActiveGeoset(Number(eligible)); setUvSet(0); }
    }
    setUVFocused(next === 'uv');
    if (next !== 'vertices') clearZoomAnchor();
    if (next !== 'bones') { setAttachSourceIds([]); setBoneCreateOpen(false); }
    if (next !== 'animation') returnParkedNodes();
    setMode(next === 'uv' ? 'vertices' : next); setPlaying(false); setLiveUV(null);
    if (next === 'uv') { setUVWindow({ minimized: false, expanded: true, position: null }); setGlobalSeqId(null); setSequence(-1); setTime(0); }
    if (next === 'animation' && mode !== next && sequence < 0 && globalSeqId === null && model.Sequences.length) { setSequence(0); setTime(model.Sequences[0].Interval[0]); }
  };
  const selectAnimationPanel = async panel => {
    if (panel === 'animations' && !(mode === 'animation' && animationPanel === 'animations')) parkNodeSelection();
    if (panel === 'movement') setCleanViews(previous => ({ ...previous, animation: false }));
    if (panel === 'movement' && !returnParkedNodes() && !selectedNodeIds.length && model.Nodes?.length) setSelectedNodeIds([model.Nodes[0].ObjectId]);
    setAnimationPanel(panel);
    await selectMode('animation');
  };

  const setWorkTool = next => {
    const movement = next === 'translate' ? 'move' : next;
    if (uvEditing) { uvAction('tool', movement); return; }
    if (rigWorkspace && (movementRestricted(movement, restrictions) || restPose && !['select','move'].includes(movement))) return;
    if(next!=='scale'||tool==='scale')clearZoomAnchor();
    if (mode === 'bones') setAttachSourceIds([]);
    setTool(next); setCameraMode('work');
    if (rigWorkspace) setMovementMode(movement);
  };
  const toggleMiddleCamera = () => {
    if (cameraMode !== 'rotate') { setCameraMode('rotate'); return; }
    setCameraMode('work');
    if (tool === 'rotate') setTool('select');
    if (rigWorkspace && movementMode === 'rotate') setMovementMode('select');
  };
  const selectSequence = index => { setGlobalSeqId(null); setSequence(index); setTime(model.Sequences[index]?.Interval[0] || 0); };
  const selectTimeline = value => { if (portraitModeActive && String(value).startsWith('global:')) return; if (String(value).startsWith('global:')) { setGlobalSeqId(Number(value.split(':')[1])); setSequence(-1); setTime(0); } else selectSequence(Number(value)); };
  const showParticlePreview = value => changePreferences(previous => ({ ...previous, graphics: { ...previous.graphics, particles: value } }));
  const texturedModel = useMemo(() => uvPreviewModel(model, session.uvPreviews), [model, doc.revision, session.uvPreviews]);
  const previewModel = useMemo(() => {
    const result = uvPreviewModel(texturedModel, {}, liveUV);
    if (!uvWindow || !uvSet || !result.Geosets[activeGeoset]?.TVertices?.[uvSet]) return result;
    const materialID = result.Geosets[activeGeoset].MaterialID, mapped = { ...result, Geosets: result.Geosets.slice() };
    for (const index of new Set([...Object.keys(uvEntrySelection).map(Number), activeGeoset])) {
      const g = result.Geosets[index]; if (!g || g.MaterialID !== materialID || !g.TVertices?.[uvSet]) continue;
      mapped.Geosets[index] = { ...g, TVertices: g.TVertices.map((value, i) => i === 0 ? g.TVertices[uvSet] : value) };
    }
    return mapped;
  }, [texturedModel, liveUV, uvWindow, uvSet, activeGeoset, uvEntrySelection]);
  const hasUVPreview = Object.keys(session.uvPreviews).length > 0;
  const hasTrackDrafts = Object.keys(session.animationDrafts).length > 0;
  const hasPaintChanges = !!session.paintProject?.dirty;
  const previewSuspended = saving || (!!settingsTab && settingsTab !== 'visuals') || (!!dialog && dialog.type !== 'resource');
  // full: the Library button shows every game file; texture pickers (UV, managers) stay texture-only.
  const openLibrary = (preview = uvEditing, full = false) => setDialog({ type: 'library', preview, full, host: preview && uvWindow ? 'uv' : 'main', returnTo: dialog?.type === 'resource' ? dialog : null });
  const openParticles = id => {
    setPlaying(false);
    const selected=Number.isInteger(id)?id:selectedNodeIds.at(-1),isEffect=['ParticleEmitters2','RibbonEmitters','ParticleEmitters','ParticleEmitterPopcorns'].some(family=>model[family].some(node=>node.ObjectId===selected));
    setDialog({type:'particles',nodeId:isEffect?selected:undefined,attachmentId:selectedBone?.ObjectId,selection:validSelection});
  };
  const inspectGeoset = index => { if(model.Geosets[index])setActiveGeoset(index); };
  const openNodeManager = () => setDialog({ type: 'resource', kind: 'Nodes' });
  const controlsWholeModel = ids => portraitModeActive && portraitSequenceIndices(model).includes(sequence) && controlModelIds.length > 0 && ids.length === controlModelIds.length && controlModelIds.every(id => ids.includes(id));
  const moveNodes = payload => {
    const pose=payload.restPose??restPose;
    const change = {...payload, restPose:pose, workplaneEnabled: payload.workplaneEnabled ?? workplaneEnabled, workplane:payload.workplane??workplane, restrictions, globalSeqId: pose ? null : globalSeqId};
    if (movementRestricted(payload.mode || movementMode, restrictions)) return false;
    setPlaying(false); if (!pose) setTime(payload.time ?? time);
    const ids = payload.nodeIds || selectedNodeIds, controlModel = controlsWholeModel(ids) && ['move', 'rotate'].includes(change.mode);
    const result = edit(controlModel ? 'Control Model' : pose ? 'Move rest-pose nodes' : 'Transform bones and nodes', pose ? ['Nodes','PivotPoints'] : ['Nodes'], m => controlModel ? applyPortraitModelTransform(m, ids, Math.round(payload.time ?? time), payload.sequenceIndex ?? sequence, change) : applyMovementTransform(m, ids, Math.round(payload.time ?? time), payload.sequenceIndex ?? sequence, change));
    if (result !== false) liveMovementRevision.current = doc.revision;
    return result;
  };
  const commitPose = payload => {
    if (restPose || !rigWorkspace || doc.readOnly || saving || globalSeqId !== null || payload.model !== model || payload.revision !== doc.revision || payload.frame !== Math.round(time) || payload.inputSequence !== sequence) return false;
    setPlaying(false);
    const result = edit(payload.label, ['Nodes'], current => applyMovementPose(current, payload.changes, payload.frame, payload.sequence, restrictions), { rethrow: true });
    if (result !== false) {
      liveMovementRevision.current = doc.revision;
      if (result && payload.bends?.length) changePose(withPoseResult(session.pose, payload));
    }
    return result;
  };
  const chooseSets = next => { next = new Set([...next].filter(index => tabVisibleGeosets.has(index))); if (mode === 'animation' && animationPanel === 'animations') { setSelectedNodeIds([]); setMaterialVisibility(null); } setSelectable(next); setVisibleOnly(previous => new Set([...previous].filter(index => !next.has(index)))); setSelection(previous => filterVertexSelection(previous, next, doc.model)); setActiveGeoset(previous => next.has(previous) ? previous : next.size ? next.values().next().value : -1); };
  const stepGeoset = direction => {
    const indices = [...tabVisibleGeosets], index = indices.indexOf(activeGeoset);
    if (indices.length) chooseSets(new Set([indices[index < 0 ? (direction > 0 ? 0 : indices.length - 1) : (index + direction + indices.length) % indices.length]]));
  };
  const leaveGeosetVisible = index => {
    const next = new Set(selectable); next.delete(index);
    setVisibleOnly(previous => { const pinned = new Set(previous); pinned.has(index) ? pinned.delete(index) : pinned.add(index); return pinned; });
    setSelectable(next); setSelection(previous => filterVertexSelection(previous, next, doc.model));
    setActiveGeoset(previous => next.has(previous) ? previous : next.values().next().value ?? -1);
  };
  const chooseSet = (index, event, checked) => { const shift = !!(event.shiftKey || event.nativeEvent?.shiftKey), ctrl = !!(event.ctrlKey || event.metaKey || event.nativeEvent?.ctrlKey); const next = chooseGeosets(selectable, index, { shift, ctrl, checked, anchor: rangeAnchor.current, count: model.Geosets.length }); chooseSets(next); if (next.has(index)) setActiveGeoset(index); setUvSet(0); if (!shift) rangeAnchor.current = index; };
  const selectAll = () => { if(mode==='paint')return window.dispatchEvent(new CustomEvent('mdlxl-paint-command',{detail:'all'})); if(uvEditing)return uvAction('select-all'); if (mode === 'animation' || mode === 'bones') { setSelectedNodeIds(model.Nodes.filter(Boolean).map(node => node.ObjectId)); return; } const next = {}; for (const gi of selectable) { const invisible = new Set(hidden[gi] || []); next[gi] = Array.from({ length: model.Geosets[gi]?.Vertices.length / 3 || 0 }, (_, i) => i).filter(i => !invisible.has(i)); } setSelection(next); };
  const frame = selectionOnly => window.dispatchEvent(new CustomEvent('mdlvis-frame', { detail: { selection: !!selectionOnly } }));
  const isPreviewMode = cleanAnimationPreview || mode==='uv';
  // Movement keeps its own render mode (Bone influence by default); the other
  // editors share the ordinary one, which never holds Bone influence.
  const boneInfluenceAvailable = mode === 'animation' && animationPanel === 'movement';
  const viewRenderMode = boneInfluenceAvailable ? movementRenderMode : renderMode === 'influence' ? 'wireframe' : renderMode;
  const setChosenRenderMode = boneInfluenceAvailable ? setMovementRenderMode : setRenderMode;
  const effectiveRenderMode = mode === 'uv' ? 'textured' : isPreviewMode ? (previewRenderModes[mode] || 'textured') : cleanView ? 'textured' : viewRenderMode;
  const setViewRenderMode = next => {
    if (uvEditing) return;
    if (isPreviewMode) setPreviewRenderModes(previous=>({...previous,[mode]:next}));
    else { setChosenRenderMode(next); setCleanViews(previous=>({...previous,[mode]:false})); }
  };
  // F swaps between Textured View and whichever view the user last chose here.
  const textureToggleContext = isPreviewMode ? `preview:${mode}` : boneInfluenceAvailable ? 'movement' : 'editor';
  if (effectiveRenderMode !== 'textured') untexturedModes.current[textureToggleContext] = effectiveRenderMode;
  const toggleTextured = () => setViewRenderMode(textureToggleTarget(effectiveRenderMode, untexturedModes.current[textureToggleContext], boneInfluenceAvailable ? 'influence' : 'wireframe'));
  const uvAction = (kind, value) => window.dispatchEvent(new CustomEvent('mdlvis-uv-action', { detail: { kind, value } }));

  function releaseUnusedTextureUrls() {
    const keep = new Set([...(latest.current.sessions || [latest.current.session]).flatMap(item => [...item.assets.values()]), ...(latest.current.showcaseSession?.assets.values()||[]), ...(clipboard.current?.assets.values() || [])].map(asset=>asset.url));
    for(const url of textureUrls.current) if(!keep.has(url)) {URL.revokeObjectURL(url);textureUrls.current.delete(url);}
  }
  useEffect(() => { releaseUnusedTextureUrls(); },[sessions, session.assets,showcaseSession,showcaseSession?.assets]);
  useEffect(() => () => {for(const url of textureUrls.current)URL.revokeObjectURL(url);textureUrls.current.clear();},[]);
  const nextTextureResolution = target => {
    const generation = (textureResolutions.current.get(target) || 0) + 1;
    textureResolutions.current.set(target, generation); return generation;
  };
  async function loadTextures(records, target = session, { resolutionGeneration = null, source = 'manual' } = {}) {
    if (resolutionGeneration === null) nextTextureResolution(target);
    const current = () => resolutionGeneration === null || textureResolutions.current.get(target) === resolutionGeneration;
    if (!current()) return 0;
    // Replacing a configured Warcraft folder must also remove old native
    // bytes that the newly selected folder did not provide. User-loaded
    // texture files remain available as explicit overrides.
    const assets = source === 'gameData' ? new Map([...target.assets].filter(([, asset]) => asset.source !== 'gameData')) : new Map(target.assets);
    const createdUrls = []; let count = 0;
    const discard = () => { for (const url of createdUrls) { URL.revokeObjectURL(url); textureUrls.current.delete(url); } };
    for (const record of records || []) {
      try {
        if (!current()) { discard(); return 0; }
        const bytes = await readInputBytes(record), name = record.logicalName || record.texturePath || record.webkitRelativePath || record.name;
        if (!name) continue;
        if (source === 'gameData' && assets.get(normalize(name))?.source === 'gameFile') continue;
        const asset = { name, bytes, source: isForgeAssetPath(name) ? 'forge' : source }; const mime = /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.webp$/i.test(name) ? 'image/webp' : null;
        if (mime) { asset.url = URL.createObjectURL(new Blob([bytes], { type: mime })); textureUrls.current.add(asset.url); createdUrls.push(asset.url); }
        if (!current()) { discard(); return 0; }
        assets.set(normalize(name), asset); assets.set(normalize(name.split(/[\\/]/).at(-1)), asset); count++;
      } catch (error) { say(`${record.name || 'Texture'}: ${error.message}`, true); }
    }
    if (!current()) { discard(); return 0; }
    target.assets = assets; releaseUnusedTextureUrls(); if (latest.current.session.id === target.id || latest.current.showcaseSession?.id === target.id) refresh(); return count;
  }
  async function resolveTextures(target = session) {
    if (!window.desktop?.resolveTextures) return;
    const generation = nextTextureResolution(target);
    try {
      // Keep referenced assets ready for final-model previews even when the
      // work viewport has texture display disabled. This is not library preload.
      const names = target.doc.model.Textures.map(texture => texture.Image).filter(Boolean);
      if (!names.length) return;
      const records = await window.desktop.resolveTextures({ path: target.path, names });
      if (textureResolutions.current.get(target) !== generation) return;
      await loadTextures(records, target, { resolutionGeneration: generation, source: 'gameData' });
    } catch (error) { say(error.message, true); }
  }
  async function checkpoint(target) {
    const envelope = { id: target.id, version: ++target.checkpoint, path: target.path, dirty: target.doc.dirty || Object.keys(target.uvPreviews).length > 0 || Object.keys(target.animationDrafts).length > 0 || !!target.paintProject?.dirty, date: new Date().toISOString(), state: target.doc.captureRecoveryState({ compact: true }), animationDrafts: structuredClone(target.animationDrafts), uvPreviews: structuredClone(target.uvPreviews), paintProject: target.paintProject ? structuredClone(target.paintProject) : null, paintOriginalModelBytes: target.paintOriginalModelBytes ? new Uint8Array(target.paintOriginalModelBytes) : null, paintWorkingModel: target.paintWorkingModel ? structuredClone(target.paintWorkingModel) : null, paintAppliedRevision: target.paintAppliedRevision, forgeAssets: retainedForgeAssets(target.assets) };
    if (window.desktop?.writeRecovery) await window.desktop.writeRecovery(envelope); else await browserRecovery('put', envelope);
  }
  function rememberSessionView(target = session) {
    if (!target) return;
    const view=target===latest.current.session?latest.current:{ mode, animationPanel, checkedGeosets, activeGeosetTab, selectable, visibleOnly, selection, hidden, activeGeoset, uvSet, selectedNodeIds, globalSeqId, sequence, time, rgbPreview, rgbSequence, renderMode, movementRenderMode, showAllGeosets };
    target.viewState = { mode:view.mode, animationPanel:view.animationPanel, selectable:new Set(view.checkedGeosets), activeGeosetTab:view.activeGeosetTab, visibleOnly:new Set(view.visibleOnly), selection:structuredClone(view.selection), hidden:structuredClone(view.hidden), activeGeoset:view.activeGeoset, uvSet:view.uvSet, selectedNodeIds:[...view.selectedNodeIds], globalSeqId:view.globalSeqId, sequence:view.sequence, time:view.time, rgbPreview:view.rgbPreview, rgbSequence:view.rgbSequence, renderMode:view.renderMode, movementRenderMode:view.movementRenderMode, showAllGeosets:view.showAllGeosets, uvEntrySelection:structuredClone(view.uvEntrySelection), uvEntryId:view.uvEntryId };
  }
  function restoreSessionView(target) {
    const viewState = target.viewState || (target.viewState = defaultSessionView(target.doc));
    setActiveGeosetTab(viewState.activeGeosetTab || 'all'); setMode(viewState.mode); setAnimationPanel(viewState.animationPanel); setSelectable(new Set(viewState.selectable)); setVisibleOnly(new Set(viewState.visibleOnly)); setSelection(structuredClone(viewState.selection)); setHidden(structuredClone(viewState.hidden)); setActiveGeoset(viewState.activeGeoset); setUvSet(viewState.uvSet); setSelectedNodeIds([...viewState.selectedNodeIds]); setGlobalSeqId(viewState.globalSeqId); setSequence(viewState.sequence); setTime(viewState.time); setRGBPreview(viewState.rgbPreview); setRGBSequence(viewState.rgbSequence); setRenderMode(viewState.renderMode); setMovementRenderMode(viewState.movementRenderMode || 'influence'); setShowAllGeosets(viewState.showAllGeosets);
    setUVWindowState(target.uvWindow || null); setUVFocused(false); setUVEntrySelection(viewState.uvEntrySelection || {}); setUVEntryId(viewState.uvEntryId || 0);
    setPlaying(false); setAttachSourceIds([]); setLiveUV(null); setNormalizer(null); setDialog(null); setContext(null); setRepairReceipt(null); setPortraitEnabled(false); setShowcaseSession(null); setCleanViews({}); rangeAnchor.current = 0;
  }
  function activateSession(next, { remember = true } = {}) {
    if (!next || next === session || savingRef.current) return;
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    if (remember) {
      rememberSessionView(session);
      if (sessionDirty(session)) checkpoint(session).catch(error => say(`Recovery checkpoint failed: ${error.message}`, true));
    }
    setSession(next); restoreSessionView(next);
    if (latest.current.preferencesReady) resolveTextures(next);
    say(next.doc.hdViewOnly ? HD_VIEW_ONLY_MESSAGE : next.doc.readOnly ? 'Read-only model; original data retained.' : `Switched to ${next.doc.name}`);
  }
  function install(next, { replace = false } = {}) {
    const history = settings.current; next.doc.configureHistory({ budgetBytes: history.historyBudgetBytes ?? 512 * 1024 * 1024, maxSteps: history.historyMaxSteps ?? 10000 });
    const currentSessions = latest.current.sessions || sessions, active = latest.current.session || session;
    const pristinePlaceholder = currentSessions.length === 1 && active === currentSessions[0] && !active.path && active.doc.name === 'Untitled.mdl' && !sessionDirty(active) && active.doc.revision === 0;
    const replaceActive = replace || pristinePlaceholder;
    const nextSessions = replaceActive ? currentSessions.map(item => item === active ? next : item) : [...currentSessions, next];
    if (!replaceActive) rememberSessionView(active);
    setSessions(nextSessions); setSession(next); restoreSessionView(next);
    say(next.doc.hdViewOnly ? HD_VIEW_ONLY_MESSAGE : next.doc.readOnly ? 'Read-only model; original data retained.' : `Opened ${next.doc.name}`);
    if (next.doc.hdViewOnly) setNotice(next.doc.hdBorderline ? { message: HD_BORDERLINE_MESSAGE, convert: next } : { message: HD_VIEW_ONLY_MESSAGE });
    // The boot effect resolves once after installing the initial model and settings.
    if (latest.current.preferencesReady) resolveTextures(next);
  }
  function convertToSD(target) {
    if (target !== (latest.current.session || session)) return;
    try { install(newSession(target.doc.convertToSD(), target.path, target.assets), { replace: true }); say(HD_CONVERTED_MESSAGE); }
    catch (error) { say(error.message, true); }
  }
  function removeSession(target) {
    const currentSessions = latest.current.sessions || sessions, index = currentSessions.indexOf(target);
    if (index < 0) return;
    let remaining = currentSessions.filter(item => item !== target);
    if (!remaining.length) remaining = [newSession(createEmptyDocument(preferences.newModelVersion))];
    setSessions(remaining);
    if (target === (latest.current.session || session)) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      setSession(next); restoreSessionView(next); say(`Closed ${target.doc.name}`);
    } else { releaseUnusedTextureUrls(); refresh(); }
  }
  function requestCloseSession(target) {
    if (savingRef.current) return;
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    if (target === session) rememberSessionView(target);
    if (sessionDirty(target)) setDialog({ type: 'closeTab', target });
    else removeSession(target);
  }
  async function loadFile(record) {
    try {
      const bytes=await readInputBytes(record);
      if(/\.mdlxlpaint$/i.test(record.name)){
        const restored=await restorePaintProject(bytes);
        if(!restored.modelBytes)throw new Error('The paint project does not contain its working model.');
        const opened=openDocument(restored.originalModelBytes||restored.modelBytes,restored.modelName||record.name.replace(/\.mdlxlpaint$/i,'.mdl'));
        if(!opened.model||opened.version==null)throw new Error('The paint project contains no readable model. The current model was kept.');
        const next=newSession(opened,null);next.paintProject=restored.project;next.paintOriginalModelBytes=restored.originalModelBytes;next.paintWorkingModel=openDocument(restored.modelBytes,restored.modelName).model;if(next.paintProject.materialMode){repairPaintMaterials(next.paintProject,opened.model,next.paintWorkingModel);validatePaintAssignments(next.paintProject,next.paintWorkingModel);}install(next);
        if(restored.sourceTextures.length)await loadTextures(restored.sourceTextures,next,{source:'paint-project'});
        setRenderMode('textured');setView('perspective');setMode('paint');say(paintMessage('paint.projectOpened'));refresh();return;
      }
      const opened = openDocument(bytes, record.name); if (!opened.model || opened.version == null) throw new Error('This file has no readable model header. The current model was kept.'); install(newSession(opened, record.path || null));
    } catch (error) { say(error.message, true); }
  }
  // A model from the Library's game files opens as a new unsaved tab. Its
  // textures come from the same game module (Reforged, Forsaken Kingdom) and
  // are kept when the ordinary game-data lookup runs for the new tab.
  async function openGameModel({ name, bytes, textures = [] }) {
    const opened = openDocument(bytes, name); if (!opened.model || opened.version == null) throw new Error('This file has no readable model header.');
    const next = newSession(opened, null);
    await loadTextures(textures, next, { source: 'gameFile' });
    install(next); say(`Opened ${name} from the game files. Save As keeps your own copy.`);
  }
  // Files dragged from Explorer open like File > Open: with their real path, so
  // neighbouring textures resolve, Save writes back and Recent Files remembers them.
  function dragFiles(event) {
    event.preventDefault();
    if (![...(event.dataTransfer?.types || [])].includes('Files')) return;
    event.dataTransfer.dropEffect = 'copy'; setFileDrag(true);
    clearTimeout(fileDragTimer.current); fileDragTimer.current = setTimeout(() => setFileDrag(false), 250);
  }
  async function dropFiles(event) {
    event.preventDefault(); clearTimeout(fileDragTimer.current); setFileDrag(false);
    const dropped = [...event.dataTransfer.files], models = dropped.filter(file => /\.(mdl|mdx|mdlxlpaint)$/i.test(file.name));
    try {
      if (!models.length) { if (dropped.length) await loadTextures(dropped); return; }
      const showcase = mode === 'showcase', paths = models.map(file => window.desktop?.droppedPath?.(file) || '');
      const records = paths.some(Boolean) ? await window.desktop.openDropped(paths.filter(Boolean), showcase) : [];
      records.push(...models.filter((_, index) => !paths[index]));
      if (showcase) await loadShowcaseModel(records[0]); else await queueModelRecords(records);
    } catch (error) { say(error.message, true); }
  }
  function queueModelRecords(records) {
    modelOpenQueue.current=modelOpenQueue.current.catch(()=>{}).then(async()=>{for(const record of records||[]){await loadFile(record);await new Promise(resolve=>requestAnimationFrame(resolve));}});
    return modelOpenQueue.current;
  }
  async function loadShowcaseModel(record){
    try{
      record ||= await window.desktop?.openShowcaseModel();if(!record)return;
      const opened=openDocument(await readInputBytes(record),record.name);
      if(!opened.model||opened.version==null)throw Error('This file has no readable model. The Showcase model was kept.');
      const next=newSession(opened,record.path||null);
      latest.current.showcaseSession=next;setShowcaseSession(next);
      await resolveTextures(next);refresh();say('Showcase: '+record.name);return next;
    }catch(error){say(error.message,true);}
  }
  useEffect(()=>{if(mode==='showcase')setShowcaseVisited(true);},[mode]);
  async function showRecent() { try { setRecentFiles(await window.desktop.recent()); setDialog({type:'recent'}); } catch(error) { say(error.message,true); } }
  function openRecent(path) { if(repairReceipt)return;if(mode==='showcase'){window.desktop.openRecent(path,true).then(loadShowcaseModel).catch(error=>say(error.message,true));return;} window.desktop.openRecent(path).then(loadFile).catch(error=>say(error.message,true)); }
  async function clearRecent() { try { setRecentFiles(await window.desktop.clearRecent()); say('Recent files history cleared.'); } catch(error) { say(error.message,true); } }
  function open() { if(mode==='showcase'){if(window.desktop)loadShowcaseModel();else files.current.click();return;} (async () => { try { if (window.desktop) { const records = await window.desktop.open(); if (records?.length) await loadFile(records[0]); } else files.current.click(); } catch (error) { say(error.message, true); } })(); }
  async function repairDuplicateAnimations(options) {
    if (savingRef.current) return;
    if (!window.desktop?.repairGeosetAnimations || !session.path) throw Error('Save a local MDL or MDX copy first; automatic backup and disk Undo require the desktop build.');
    if (hasUVPreview || hasTrackDrafts || session.paintProject) throw Error('Repair the original model in a separate model session before applying pending UV, animation-text or paint work. That work has not been discarded.');
    savingRef.current = true; setSaving(true);
    try {
      const staged = EditorDocument.restoreRecoveryState(doc.captureRecoveryState({ includeHistory: false }));
      const report = staged.apply('Repair duplicate geoset animations', ['GeosetAnims', 'Bones', 'Geosets', 'Info'], m => repairGeosetAnimations(m, options));
      const bytes = staged.serialize(doc.format), reopened = openDocument(bytes, doc.name);
      if (reopened.readOnly || scanGeosetAnimationDuplicates(reopened.model).length) throw Error('Repaired model failed reload verification. No file was changed.');
      await checkpoint(session);
      const result = await window.desktop.repairGeosetAnimations({ path: session.path, bytes, beforeBytes: doc.serialize(doc.format), expectedDiskBytes: doc.originalBytes });
      install(newSession(reopened, result.path, session.assets), { replace: true });
      setRepairReceipt({ ...result, bytes: undefined, report });
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function undoDuplicateRepair() {
    if (savingRef.current || !repairReceipt) return;
    savingRef.current = true; setSaving(true);
    try {
      const result = await window.desktop.undoGeosetRepair(repairReceipt.id);
      install(newSession(openDocument(result.bytes, result.name), result.path, session.assets), { replace: true });
      say('Repair undone. The pre-repair backup was restored; duplicate editing remains paused.');
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function save(saveAs = false, requestedFormat = session.doc.format, target = session) {
    if (savingRef.current) return false;
    if (target.doc.hdViewOnly) { say(HD_VIEW_ONLY_MESSAGE, true); setNotice({ message: HD_VIEW_ONLY_MESSAGE }); return false; }
    if (Object.keys(target.animationDrafts).length) { if (target !== session) activateSession(target); setAnimationPanel('animations'); selectMode('animation'); say('Press Bake Text in Animations to apply the edited track text before saving.'); return false; }
    savingRef.current = true; setSaving(true);
    try {
      const pending = target.uvPreviews;
      const staged = Object.keys(pending).length ? EditorDocument.restoreRecoveryState(target.doc.captureRecoveryState({ includeHistory: false })) : target.doc;
      if (staged !== target.doc) staged.apply('Save UV texture previews', ['Geosets', 'Textures', 'Materials'], m => applyUVPreviews(m, pending));
      // Save As must bring reopened Forge textures along, even before preview
      // resolution completes or when texture rendering is disabled.
      const missing = missingForgeAssetPaths(target.assets, staged.model);
      if (missing.length && window.desktop?.resolveTextures) {
        const records = await window.desktop.resolveTextures({ path: target.path, names: missing });
        await loadTextures(records, target, { source: 'forge' });
      }
      if (missingForgeAssetPaths(target.assets, staged.model).length) throw Error('A Forge texture is missing. Load the model beside its MDLxL_Forge folder, or import the missing texture before saving.');
      const prepared = await prepareModelSaveAsync(staged,requestedFormat,target.doc.name);
      let removeData = false;
      if (prepared.editorDataBytes > 512) {
        removeData = await new Promise(resolve => setSaveDataChoice({ name: prepared.name, bytes: prepared.editorDataBytes, resolve }));
        if (removeData === null) return false;
      }
      const { format, name } = prepared, bytes = removeData ? prepared.withoutEditorData : prepared.bytes;
      let savedName = name;
      if (window.desktop) { const result = await window.desktop.save({ bytes, name, path: target.path, format, saveAs:saveAs||format!==target.doc.format, forgeAssets:retainedForgeAssets(target.assets,staged.model) }); if (!result) return false; target.path = result.path; savedName = result.name; say([`Saved ${result.name}`, ...(prepared.notes || [])].join(' ')); }
      else { const forgeAssets=retainedForgeAssets(target.assets,staged.model), blob=forgeAssets.length?forgeExportArchive(name,bytes,forgeAssets):new Blob([bytes]); const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = forgeAssets.length?name.replace(/\.(mdl|mdx)$/i,'')+'.zip':name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); say(`Downloaded ${name}`); }
      if (staged !== target.doc) target.doc.apply('Save UV texture previews', ['Geosets', 'Textures', 'Materials'], m => applyUVPreviews(m, pending));
      if (removeData && !target.doc.readOnly) target.doc.apply('Remove MDLxL editor data', EDITOR_DATA_SECTIONS, clearEditorData);
      // Keep the target document's semantic serialization snapshot. Re-parsing
      // a staged document's bytes can differ in harmless object key order and
      // incorrectly leave an otherwise identical saved texture list dirty.
      if (staged !== target.doc) {
        const savedModel = structuredClone(staged.model);
        if (removeData) clearEditorData(savedModel);
        target.doc.rememberSerializedSnapshot(bytes, savedModel);
      }
      target.uvPreviews = {}; target.doc.markSaved(bytes, savedName);
      try { await rememberMotionSave(target, bytes, target.path, savedName); }
      catch (error) { say(`Model saved; Motion Inspector decisions could not follow this save: ${error.message}`, true); }
      try { await checkpoint(target); } catch (error) { say(`Saved; recovery checkpoint failed: ${error.message}`, true); }
      if (latest.current.session.id === target.id) refresh(); return !target.doc.dirty;
    } catch (error) { say(error.message, true); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }
  const paintArtifactName = (extension, target = session) => `${target.doc.name.replace(/\.(?:mdl|mdx)$/i,'').replace(/[^a-z0-9_-]+/gi,'-') || 'model'}${extension}`;
  async function writePaintArtifact(blob, name) {
    if (window.desktop?.saveArtifact) return !!(await window.desktop.saveArtifact({name,bytes:new Uint8Array(await blob.arrayBuffer())}));
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;
  }
  function paintDocument(target = session) {
    const staged=EditorDocument.restoreRecoveryState(target.doc.captureRecoveryState({includeHistory:false}));
    if(target.paintWorkingModel)staged.model=structuredClone(target.paintWorkingModel);
    return staged;
  }
  async function applyPaintToModel(){
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    const value=session.paintProject;if(!value)return true;
    if(savingRef.current||doc.readOnly)return false;
    savingRef.current=true;setSaving(true);
    try{
      repairPaintMaterials(value,paintOriginalModel,session.paintWorkingModel||doc.model);
      const prepared=await preparePaintModelCommit(session.paintWorkingModel||doc.model,value,paintOriginalModel);
      const assets=new Map(session.assets);
      for(const asset of prepared.assets){if(!asset.bytes?.byteLength)throw Error('A painted texture is empty.');assets.set(normalize(asset.name),asset);assets.set(normalize(asset.name.split(/[\\/]/).at(-1)),asset);}
      commitPaintModel(doc,prepared);
      nextTextureResolution(session);session.assets=assets;adoptCommittedPaintUVs(value);
      session.paintWorkingModel=structuredClone(doc.model);session.paintWorkingRevision++;
      session.paintAppliedRevision=value.revision;refresh();
      say('Paint applied to the model. Save the model to keep its BLP textures beside it.');return true;
    }catch(error){say('Could not apply paint: '+error.message,true);return false;}
    finally{savingRef.current=false;setSaving(false);}
  }
  async function savePaintProject(value=session.paintProject, target=session) {
    if(target===session)window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    if(!value||savingRef.current)return false;savingRef.current=true;setSaving(true);
    try{const artifact=await buildPaintProjectArtifact(paintDocument(target),value,target.assets,target.paintOriginalModelBytes||target.doc.originalBytes);if(!await writePaintArtifact(artifact,paintArtifactName('.mdlxlpaint',target)))return false;markPaintProjectSaved(value);refresh();say(paintMessage('paint.projectSaved'));return true;}
    catch(error){say(error.message,true);return false;}finally{savingRef.current=false;setSaving(false);}
  }
  async function exportPaintProject(value=session.paintProject) {
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    if(!value||savingRef.current)return false;savingRef.current=true;setSaving(true);
    try{const result=await buildPaintExportArtifact(paintDocument(),value,session.assets,session.paintOriginalModelBytes||doc.originalBytes);if(!await writePaintArtifact(result.archive,paintArtifactName('-warcraft.zip')))return false;markPaintProjectSaved(value);refresh();say(paintMessage('paint.packageSaved'));return true;}
    catch(error){say(error.message,true);return false;}finally{savingRef.current=false;setSaving(false);}
  }
  async function ensurePaintTarget(geosetIndex) {
    const working=session.paintWorkingModel ||= structuredClone(model);
    const existing=paintTargetsForGeoset(enumeratePaintTargets(working),geosetIndex);
    if(existing.length)return enumeratePaintTargets(working);
    const base=doc.name.replace(/\.(?:mdl|mdx)$/i,'').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()||'model';
    const used=new Set(working.Textures.map(texture=>normalize(texture.Image)));let number=1,imagePath;
    do{imagePath='CitadelPaint/'+base+'_texture_'+(number++)+'.blp';}while(used.has(normalize(imagePath)));
    installFreshPaintLayer(working,geosetIndex,imagePath);session.paintWorkingRevision++;refresh();
    return enumeratePaintTargets(working);
  }
  async function addTexture(asset, _item, { material } = {}) {
    if (savingRef.current || doc.readOnly) return;
    const existing = existingTextureIndex(model, asset.name);
    if (existing >= 0 && material === 'new') {
      const result = edit('Add material for existing texture', ['Materials'], m => addTextureMaterial(m, existing));
      if (result !== false) { await loadTextures([asset], session, { source: 'library' }); say(`Added Material ${model.Materials.length} using ${asset.name}.`); }
      return;
    }
    if (existing >= 0 && Number.isSafeInteger(material)) { await loadTextures([asset], session, { source: 'library' }); say(`Kept Material ${material + 1}, which already uses ${asset.name}.`); return; }
    if (model.Textures.some(texture => normalize(texture.Image) === normalize(asset.name))) { await loadTextures([asset], session, { source: 'library' }); say('This texture is already in the model.'); return; }
    const result = edit('Add library texture', ['Textures'], m => addLibraryTexture(m, asset));
    if (result !== false) { await loadTextures([asset], session, { source: 'library' }); say(`Added ${asset.name} to the model.`); }
  }
  async function previewTexture(asset, _item, { material } = {}) {
    if (savingRef.current || doc.readOnly) return;
    try {
      session.uvPreviews = beginUVPreview(model, session.uvPreviews, (uvEditing || dialog?.host === 'uv')?[activeGeoset]:[...selectable], asset, { material });
      await loadTextures([asset], session, { source: 'library' });
      setDialog(null); selectMode('uv'); refresh();
      say('Temporary texture loaded. Save keeps it; Revert removes it and keeps your geometry and UV edits.');
    } catch (error) { say(error.message, true); }
  }
  function finishUVPreview(revert = false) {
    if (savingRef.current) return;
    if (revert) {
      revertUVPreviews(model, session.uvPreviews); session.uvPreviews = {}; setLiveUV(null); refresh(); say('Reverted temporary textures; geometry and UV edits kept.'); return;
    }
    // A preview can already match the model (an existing material chosen for
    // the geoset that uses it): saving then changes nothing but still ends it.
    let result;
    try { result = edit('Save UV texture previews', ['Geosets','Textures','Materials'], m => applyUVPreviews(m, session.uvPreviews), { rethrow: true }); }
    catch { return; }
    session.uvPreviews = {}; setLiveUV(null); refresh();
    if (result === false) say('Texture kept: the model already uses this material.');
  }
  const importTextures = async () => { try { if (window.desktop) say(`Loaded ${await loadTextures(await window.desktop.textures())} textures.`); else textures.current.click(); } catch (error) { say(error.message, true); } };
  const textureFolder = async () => { try { if (window.desktop) say(`Loaded ${await loadTextures(await window.desktop.textureFolder(model.Textures.map(t => t.Image)))} textures.`); else folder.current.click(); } catch (error) { say(error.message, true); } };
  const selectManagerTextures = async records => {
    try {
      if (!records.length) return;
      const selected = await Promise.all(records.map(async record => ({ name: record.name, bytes: await readInputBytes(record) })));
      const loaded = await loadTextures(selected);
      const existing = new Set(model.Textures.map(texture => normalize(texture.Image.split(/[\\/]/).at(-1))));
      const additions = selected.filter(record => {
        const name = normalize(record.name);
        if (existing.has(name)) return false;
        existing.add(name);
        return true;
      });
      if (additions.length && edit('Add texture files', ['Textures'], m => additions.forEach(asset => addLibraryTexture(m, asset))) === false) return;
      say(`Loaded ${loaded} textures${additions.length ? `; added ${additions.length} to the model` : ''}.`);
    } catch (error) { say(error.message, true); }
  };
  const selectManagerTextureFiles = async () => { try { if (window.desktop) await selectManagerTextures(await window.desktop.textures()); else managerTextures.current.click(); } catch (error) { say(error.message, true); } };
  const undo = redo => {
    if (savingRef.current) return;
    if(mode==='showcase')return window.dispatchEvent(new CustomEvent('mdlxl-showcase-command',{detail:redo?'redo':'undo'}));
    try {
      if(mode==='paint'){
        window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
        const entry=session.paintProject&&travelPaintHistory(session.paintProject,redo);if(!entry){say(paintMessage(redo?'paint.redoEmpty':'paint.undoEmpty'));return;}
        refresh();say(redo?paintMessage('paint.redo'):paintMessage('paint.undo'));return;
      }
      const guard = captureUVPreviewGuard(doc.model, session.uvPreviews);
      let validBefore = true; try { validateUVPreviewGuard(doc.model, session.uvPreviews); } catch { validBefore = false; }
      const restored = selectionHistory.travel(redo ? 'redo' : 'undo', selectionState);
      if (!restored) return;
      // A cached older document may already have mismatched geometry. Permit
      // travelling back through that history so it can be repaired by Undo.
      if (validBefore) {
        try { validateUVPreviewGuard(doc.model, session.uvPreviews, guard); }
        catch { selectionHistory.travel(redo ? 'undo' : 'redo', restored); refresh(); say('Save or Revert temporary UV textures before undoing changes to their geoset targets.'); return; }
      }
      setSelection(restored.selection); setHidden(restored.hidden); setSelectable(restored.selectable); setVisibleOnly(restored.visibleOnly || new Set()); setActiveGeoset(restored.activeGeoset); setUvSet(restored.uvSet); if(restored.selectedNodeIds)setSelectedNodeIds(restored.selectedNodeIds); setLiveUV(null); refresh(); say(redo ? 'Redo' : 'Undo');
    } catch (error) { refresh(); say(error.message, true); }
  };
  const transform = payload => { if (restPose) { if (restrictions.translation && payload.translation?.some(value=>value!==0) || restrictions.rotation && payload.rotation?.some(value=>value!==0) || restrictions.scaling && payload.scale?.some(value=>value!==1)) return false; if(payload.translation&&!payload.modelPositions)payload={...payload,translation:constrainMovementVector(payload.translation,{workplaneEnabled,workplane})}; } const picked = filterVertexSelection(payload.selections || validSelection, selectable, model); const result = edit('Transform vertices', ['Geosets'], m => { for (const [gi, ids] of Object.entries(picked)) if (ids.length) { const positions=payload.modelPositions?.[gi]; if(positions)setVertexPositions(m.Geosets[gi],ids,positions); else transformVertices(m.Geosets[gi], ids, payload.translation || [0, 0, 0], payload.scale || [1, 1, 1], payload.rotation || [0, 0, 0], payload.pivot || centroid, {allowSingularScale:payload.allowSingularScale===true}); } }); return result; };
  // NormalsXL: analyse once per opening (and after Fix facing), re-plan on
  // each angle change, and preview the plan on a copy of the model. Apply
  // commits it as one edit. Vertex indices never change, so selection and
  // hidden vertices carry over as they are.
  const normalAnalysis = useMemo(() => {
    if (!normalizer) return null;
    try { return { analysis: analyzeNormals(normalizer.doc.model, { geosets: normalizer.geosets, selection: normalizer.selection }) }; }
    catch (error) { return { error: error.message }; }
  }, [normalizer?.doc, normalizer?.revision, normalizer?.geosets, normalizer?.selection]);
  const normalPlan = useMemo(() => {
    if (!normalAnalysis?.analysis) return normalAnalysis || {};
    try { return { plan: planNormalRebuild(normalAnalysis.analysis, { smoothingAngle: normalizer.smoothingAngle }) }; }
    catch (error) { return { error: error.message }; }
  }, [normalAnalysis, normalizer?.smoothingAngle]);
  const normalizerModel = useMemo(() => normalPlan.plan ? previewNormalRebuild(previewModel, normalPlan.plan) : null, [normalPlan, previewModel]);
  // Which normals NormalsXL visibly changes, so the overlay can highlight them.
  const normalChanges = useMemo(() => {
    if (!normalPlan.plan) return null;
    const changes = {};
    for (const { index, Normals: after } of normalPlan.plan.geosets) {
      const before = model.Geosets[index]?.Normals, changed = new Uint8Array(after.length / 3);
      for (let v = 0; v < changed.length; v++) {
        const a = after.subarray(v * 3, v * 3 + 3), b = before?.subarray(v * 3, v * 3 + 3), length = b ? Math.hypot(b[0], b[1], b[2]) * Math.hypot(a[0], a[1], a[2]) : 0;
        changed[v] = !(length > 1e-12 && (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / length >= Math.cos(Math.PI / 180)) ? 1 : 0;
      }
      changes[index] = changed;
    }
    return changes;
  }, [normalPlan, model]);
  const beginNormalizer = () => {
    if (!editable || mode !== 'vertices' || normalizer) return;
    // Whole visible model, or only the selected vertices.
    const geosets = model.Geosets.map((g, index) => !hiddenGeosets.has(index) && isShadedGeoset(model, g) ? index : -1).filter(index => index >= 0);
    const selection = selectionCount ? Object.fromEntries(Object.entries(validSelection).filter(([key, ids]) => ids.length && !hiddenGeosets.has(Number(key)))) : null;
    setPlaying(false);
    setNormalizer({ doc, revision: doc.revision, geosets, selection, scope: selection ? 'selection' : 'model', smoothingAngle: DEFAULT_SMOOTHING_ANGLE, showNormals: true, flipped: null, renderMode: viewRenderMode === 'wireframe' ? 'solid' : viewRenderMode });
  };
  const changeNormalizer = changes => setNormalizer(previous => previous && ({ ...previous, ...changes }));
  const normalizerReady = () => normalizer && !savingRef.current && normalizer.doc === doc && normalizer.revision === doc.revision && normalAnalysis?.analysis;
  const applyNormalizer = () => {
    const plan = normalPlan.plan;
    if (!normalizerReady() || !plan) return;
    if (!plan.stats.changed) { setNormalizer(null); say('No changes needed.'); return; }
    try { edit('NormalsXL', ['Geosets'], current => applyNormalRebuild(current, plan), { rethrow: true }); } catch { return; }
    clearZoomAnchor(); setNormalizer(null); say(normalizerStatus(plan.stats));
  };
  // Fix facing is its own undo step; the panel stays open on the new model.
  const fixNormalizerFacing = () => {
    if (!normalizerReady()) return;
    let plan;
    try { plan = planFacingFix(normalAnalysis.analysis, { smoothingAngle: normalizer.smoothingAngle }); } catch (error) { say(error.message, true); return; }
    if (plan.stats.changed) {
      normalizerKeepRef.current = doc.revision + 1;
      try { edit('NormalsXL · Fix facing', ['Geosets'], current => applyNormalRebuild(current, plan), { rethrow: true }); } catch { normalizerKeepRef.current = null; return; }
    }
    setNormalizer(previous => previous && ({ ...previous, revision: doc.revision, flipped: plan.stats.trianglesFlipped }));
    say(normalizerStatus(plan.stats, true));
  };
  function meshAction(name) {
    if (!editable || !selectionCount) return;
    if (uvEditing) {
      if (name === 'Mirror') uvAction('flip-u');
      if (name === 'Collapse') uvAction('collapse');
      if (name === 'Uncouple') uvAction('uncouple');
      return;
    }
    const updated = {}, removedGeosets = [], axis = (lockedVertexPlane || workplane) === 'xy' ? 2 : (lockedVertexPlane || workplane) === 'yz' ? 0 : 1;
    const result = edit(name, ['Geosets', 'GeosetAnims', 'Nodes'], m => {
      for (const [key, ids] of Object.entries(validSelection).sort((a, b) => Number(b[0]) - Number(a[0]))) {
        if (!ids.length) continue; const gi = Number(key), g = m.Geosets[gi]; let outcome;
        if (name === 'Delete vertices') { if (ids.length === g.Vertices.length / 3) { deleteGeoset(m, gi); removedGeosets.push(gi); } else deleteVertices(g, ids); }
        else if (name === 'Create triangle') addTriangle(g, ids);
        else if (name === 'Delete triangles') outcome = deleteSelectedFaces(g, ids);
        else if (name === 'Uncouple') outcome = uncoupleVertices(g, ids);
        else if (name === 'Collapse') outcome = collapseVertices(g, ids, centroid);
        else if (name === 'Weld') outcome = weldSelectedVertices(g, ids, centroid);
        else if (name === 'Smooth normals') outcome = averageSelectedNormals(g, ids);
        else if (name === 'Restore normals') recalculateNormals(g);
        else if (name === 'Mirror') { const scale = [1, 1, 1]; scale[axis] = -1; transformVertices(g, ids, [0, 0, 0], scale, [0, 0, 0], centroid); }
        else if (name === 'Extrude') { const delta = [0, 0, 0]; delta[axis] = 10; outcome = { selection: extrudeFaces(g, ids, delta) }; }
        else if (name === 'Detach') { const added = detachFaces(m, gi, ids); updated[added] = Array.from({ length: m.Geosets[added].Vertices.length / 3 }, (_, i) => i); }
        else if (name === 'Reverse normals') { const picked = new Set(ids); for (const id of ids) { for (let a = 0; a < 3; a++) g.Normals[id * 3 + a] *= -1; if (g.Tangents) g.Tangents[id * 4 + 3] *= -1; } for (let i = 0; i < g.Faces.length; i += 3) if ([0, 1, 2].every(a => picked.has(g.Faces[i + a]))) [g.Faces[i + 1], g.Faces[i + 2]] = [g.Faces[i + 2], g.Faces[i + 1]]; }
        else if (name === 'Rotate normals') { const a = (axis + 1) % 3, b = (axis + 2) % 3, angle = normalAngle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle); for (const id of ids) for (const [array, stride] of [[g.Normals, 3], [g.Tangents, 4]]) if (array?.length) { const x = array[id * stride + a], y = array[id * stride + b]; array[id * stride + a] = x * c - y * s; array[id * stride + b] = x * s + y * c; } }
        if (outcome?.selection) updated[gi] = outcome.selection;
      }
    });
    if (result !== false) { if (name !== 'Uncouple') setHidden({}); if (name === 'Delete vertices') {
      const remap = index => index - removedGeosets.filter(removed => removed < index).length;
      const next = new Set([...selectable].filter(index => !removedGeosets.includes(index)).map(remap));
      setSelection({}); setSelectable(next); setVisibleOnly(previous => new Set([...previous].filter(index => !removedGeosets.includes(index)).map(remap))); setActiveGeoset(removedGeosets.includes(activeGeoset) ? next.values().next().value ?? -1 : remap(activeGeoset));
    } else if (Object.keys(updated).length) { setSelection(updated); setSelectable(previous => new Set([...previous, ...Object.keys(updated).map(Number)])); setActiveGeoset(Number(Object.keys(updated)[0])); } if (name === 'Extrude') setWorkTool('translate'); }
  }
  function copy() {
    if(mode==='paint')return window.dispatchEvent(new CustomEvent('mdlxl-paint-command',{detail:'copy'}));
    if (mode === 'animation') return poseViewActive && globalSeqId === null ? timelineCommands.current.copyPose?.() : timelineCommands.current.copy?.();
    if ((mode === 'bones' || visUI) && selectedNodeIds.length) {
      const captured = captureNodeSelection(model, selectedNodeIds);
      if (!captured.nodeIds.length) { say('Select nodes to copy.'); return; }
      clipboard.current = { ...captured, sourceDocument: doc, assets: new Map(session.assets) };
      say(`Copied ${captured.nodeIds.length} node${captured.nodeIds.length === 1 ? '' : 's'}.`); refresh(); return;
    }
    const captured = captureMeshSelection(model, validSelection, selectable, { rgbPreview, rgbSequence });
    if (!captured.indices.length) { say('Select vertices, triangles or geosets to copy.'); return; }
    clipboard.current = { ...captured, sourceDocument: doc, assets: new Map(session.assets) };
    say(`Copied ${captured.vertexCount} vertices and ${captured.triangleCount} triangles.`); refresh();
  }
  function paste(parent, special = false, fix = false, pasteSource = clipboard.current) {
    if(mode==='paint')return window.dispatchEvent(new CustomEvent('mdlxl-paint-command',{detail:'paste'}));
    if (mode === 'animation') return timelineCommands.current.paste?.();
    if (!pasteSource || doc.readOnly) return;
    const source = pasteSource;
    const prepared = prepareClipboardPaste(model, source, { parent, special, sameModel: source.sourceDocument === doc, targetGeoset: activeGeoset });
    if (prepared.repairs.length && !fix) { setDialog({ type: 'pasteRepair', source, parent, special, repairs: prepared.repairs }); return; }
    const commit = model => { Object.assign(model, prepared.model); return prepared.result; };
    if (source.kind === 'nodes') {
      const result = edit('Paste nodes', ['Nodes', 'PivotPoints', 'Materials', 'Textures', 'TextureAnims', 'GlobalSequences', 'BindPoses', 'Info'], commit);
      if (result !== false) { session.assets = new Map([...source.assets, ...session.assets]); setSelectedNodeIds(result.nodeIds); setSelection({}); setDialog(null); say(`Pasted ${result.nodeIds.length} node${result.nodeIds.length === 1 ? '' : 's'} on DummyBone.`); refresh(); }
      return;
    }
    const result = edit('Paste geosets', ['Geosets', 'Materials', 'Textures', 'Nodes', 'PivotPoints', 'GeosetAnims', 'GlobalSequences', 'TextureAnims', 'BindPoses'], commit);
    if (result !== false) { session.assets = new Map([...source.assets, ...session.assets]); setSelectedNodeIds([]); setSelectable(new Set(result.geosetIndices)); setSelection(result.selection || Object.fromEntries(result.geosetIndices.map(gi => [gi, Array.from({ length: doc.model.Geosets[gi].Vertices.length / 3 }, (_, i) => i)]))); setActiveGeoset(result.geosetIndices[0] ?? 0); setDialog(null); say('Pasted geosets.'); refresh(); }
  }
  const hide = () => { setHidden(previous => { const next = { ...previous }; for (const [gi, ids] of Object.entries(validSelection)) next[gi] = [...new Set([...(next[gi] || []), ...ids])]; return next; }); setSelection({}); };
  async function listRecovery() { try { const items = window.desktop?.listRecovery ? await window.desktop.listRecovery() : await browserRecovery('list'); setRecoveries((items || []).map(({ state, ...item }) => ({ ...item, name: item.name || state?.name }))); setDialog({ type: 'recovery' }); } catch (error) { say(error.message, true); } }
  async function restoreRecovery(item) { try { const envelope = window.desktop?.readRecovery ? await window.desktop.readRecovery(item.id) : await browserRecovery('get', item.id), restored = newSession(EditorDocument.restoreRecoveryState(envelope.state || envelope), envelope.path || null); restored.id = envelope.id || restored.id; restored.checkpoint = envelope.version || 0; restored.animationDrafts = envelope.animationDrafts || {}; restored.paintProject = envelope.paintProject || null; restored.paintOriginalModelBytes = envelope.paintOriginalModelBytes || null; restored.paintWorkingModel = envelope.paintWorkingModel || null;restored.paintAppliedRevision=envelope.paintAppliedRevision;if(restored.paintProject?.materialMode){const original=restored.paintOriginalModelBytes?openDocument(restored.paintOriginalModelBytes,restored.doc.name).model:restored.doc.model;repairPaintMaterials(restored.paintProject,original,restored.paintWorkingModel||restored.doc.model);validatePaintAssignments(restored.paintProject,restored.paintWorkingModel||restored.doc.model);} for(const asset of envelope.forgeAssets||[]){const record={...asset,source:asset.source||'forge'};restored.assets.set(normalize(asset.name),record);restored.assets.set(normalize(asset.name.split(/[\\/]/).at(-1)),record);} restored.uvPreviews = restoreUVPreviews(restored.doc.model, envelope.uvPreviews); for (const draft of Object.values(restored.uvPreviews)) { restored.assets.set(normalize(draft.asset.name), draft.asset); restored.assets.set(normalize(draft.asset.name.split(/[\\/]/).at(-1)), draft.asset); } install(restored); say(`Recovered ${restored.doc.name} with undo history${restored.paintProject ? ' and paint coats' : ''}.`); } catch (error) { say(error.message, true); } }
  async function gameData() {
    if (!window.desktop?.chooseGameData) { say('Choose a Warcraft III installation folder in the desktop application.'); return; }
    try {
      const next = await window.desktop.chooseGameData();
      if (!next) return;
      settings.current = next;
      setGameDataPath(next.gameData || '');
      await resolveTextures();
      say(next.gameData ? 'Warcraft III installation saved. Native textures will now load automatically.' : 'Warcraft III installation was not changed.');
    } catch (error) { say(error.message, true); }
  }
  async function clearGameData() {
    if (!window.desktop?.clearGameData) return;
    try {
      const next = await window.desktop.clearGameData();
      settings.current = next || settings.current;
      setGameDataPath('');
      await resolveTextures();
      say('Saved Warcraft III installation folder removed.');
    } catch (error) { say(error.message, true); }
  }
  async function changeGameDataSource(kind, file) {
    try {
      const next = file ? await window.desktop.removeGameDataSource(file) : await window.desktop.addGameDataSource(kind);
      if (!next) return;
      settings.current = next;
      setGameDataSources(next.gameDataSources || []);
      const target = latest.current.session;
      target.assets = new Map([...target.assets].filter(([, asset]) => asset.source !== 'gameData'));
      releaseUnusedTextureUrls();
      await resolveTextures(target);
      refresh();
      say(file ? 'Custom game archive removed.' : 'Custom game archives saved.');
    } catch (error) { say(error.message, true); }
  }
  function showHistory() { setHistoryMB(Math.round(doc.historyStats.budgetBytes / 1048576)); setHistorySteps(doc.historyStats.maxSteps); setDialog({ type: 'history' }); }
  async function forgeItem({mesh,asset,texturePath,trimColor,items}) {
    const {commitForge}=await import('../src/forge.js');
    if(latest.current.session!==session || savingRef.current)return false;
    const drafts=items||[{mesh,asset,texturePath,trimColor}];
    const result=edit('Forge item',['Geosets','Materials','Textures','Nodes','PivotPoints','GeosetAnims','Info'],m=>{
      const added=drafts.map(d=>commitForge(m,d.mesh,{texturePath:d.texturePath,trimColor:d.trimColor}));
      return {...added[0],geosetIndices:added.flatMap(r=>r.geosetIndices),extraAssets:added.flatMap(r=>r.extraAssets)};
    });
    if(result===false)return false;
    for(const draft of drafts)if(draft.asset) await loadTextures([{...draft.asset,name:draft.texturePath}],session,{source:draft.asset.source==='forge'?'forge':'gameData'});
    if(result.extraAssets?.length) await loadTextures(result.extraAssets,session,{source:'forge'});
    if(drafts.some(d=>d.mesh.geosets.length>1)){const white={name:'Textures\\white.blp',bytes:new Uint8Array([0,0,2,0,0,0,0,0,0,0,0,0,1,0,1,0,32,40,255,255,255,255]),source:'forge-preview'};session.assets.set(normalize('Textures\\white.blp'),{...white,name:'white.tga'});}
    setSelectable(new Set(result.geosetIndices));setSelection(Object.fromEntries(result.geosetIndices.map(i=>[i,Array.from({length:doc.model.Geosets[i].Vertices.length/3},(_,v)=>v)])));setActiveGeoset(result.geosetIndices[0]);setSelectedNodeIds([result.boneId]);selectMode('vertices');setRenderMode('textured');setDialog(null);requestAnimationFrame(()=>frame(false));
    say('Forge item created and attached to DummyBone.');return result;
  }
  function applyGeosetDensity(changes) {
    try {
      if (!changes?.length || changes.some(change => !Number.isSafeInteger(change.index) || !model.Geosets[change.index] || !change.geoset?.Vertices?.length || !change.geoset?.Faces?.length)) throw Error('Choose a valid geoset density preview.');
      const result = edit('Change geoset triangle density', ['Geosets'], current => {
        for (const change of changes) current.Geosets[change.index] = structuredClone(change.geoset);
        return changes;
      }, { rethrow: true });
      if (result === false) return false;
      const nextSelection = Object.fromEntries(changes.map(change => [change.index, change.selectedVertices]));
      setSelection(previous => ({ ...previous, ...nextSelection }));
      if (uvWindow) setUVEntrySelection(previous => ({ ...previous, ...Object.fromEntries(changes.map(change => [change.index, [...new Set([...(previous[change.index] || []), ...change.selectedVertices])]])) }));
      setLiveUV(null); clearZoomAnchor(); say(changes.map(change => `Geoset ${change.index + 1}: ${change.trianglesBefore} → ${change.trianglesAfter} triangles.`).join(' ')); return result;
    } catch (error) { say(error.message, true); return false; }
  }
  // keepOpen: the Library stays open so more geosets can be imported in a row.
  async function importPart({source,rgbSequence,assets,replacement,keepOpen=false}) {
    const {commitPart}=await import('../src/bits-and-parts.js');
    if(latest.current.session!==session || savingRef.current)return false;
    const target=session;
    const result=edit(replacement?'Replace Part':'Import BitsAndParts',['Geosets','Materials','Textures','TextureAnims','GlobalSequences','Sequences','Nodes','PivotPoints','GeosetAnims','Gliders','Info'],m=>commitPart(m,source,{rgbSequence,replacement}),{rethrow:true});
    if(result===false)return false;
    // Select the new part in the same tick as its edit, so the selection joins the
    // import's undo step instead of becoming a separate 'Change selection'.
    if(replacement)setHidden({});setSelectable(new Set(result.geosetIndices));setSelection(Object.fromEntries(result.geosetIndices.map(i=>[i,Array.from({length:doc.model.Geosets[i].Vertices.length/3},(_,v)=>v)])));setActiveGeoset(result.geosetIndices[0]);setSelectedNodeIds(result.boneIds);selectMode('vertices');if(replacement){setTool('translate');setCameraMode('work');}setRenderMode('textured');if(!keepOpen)setDialog(null);requestAnimationFrame(()=>frame(false));
    await loadTextures(assets,target,{source:'parts'});
    if(latest.current.session!==target)return result;
    say(replacement?'Part replaced using its existing bone bindings. Place it with the vertex editor tools.':'Part imported and attached to DummyBone.');return result;
  }
  commands.current = { 'paint:select':()=>window.dispatchEvent(new CustomEvent('mdlxl-paint-tool',{detail:'select'})), 'paint:draw':()=>window.dispatchEvent(new CustomEvent('mdlxl-paint-tool',{detail:'draw'})), open, recent:showRecent, openRecent, clearRecent, save: () => mode==='paint'?savePaintProject():save(), saveAs: () => mode==='paint'?savePaintProject():doc.hdViewOnly?save(true):setDialog({type:'saveFormat'}), new: () => install(newSession(createEmptyDocument(preferences.newModelVersion))), recovery: listRecovery, gameData, undo: () => undo(false), redo: () => undo(true), copy, paste: () => paste(), pasteSpecial: () => { if (clipboard.current?.kind !== 'nodes') { setAnchor(''); setDialog({ type: 'pasteSpecial' }); } }, selectAll, clear: () => { if(mode==='paint')return window.dispatchEvent(new CustomEvent('mdlxl-paint-command',{detail:'clear'})); if (normalizer) { setNormalizer(null); return; } if (mode === 'bones' && attachSourceIds.length) { setAttachSourceIds([]); return; } if ((mode === 'vertices' || rigWorkspace) && !window.dispatchEvent(new Event('mdlxl-cancel-gesture', { cancelable: true }))) return; if(uvEditing)return uvAction('select-none');setSelectedNodeIds([]); setSelection({}); }, history: showHistory, grid: () => setShowGrid(v => !v), frame: toggleTextured, frameSelection: () => setViewRenderMode('solid'), fit: () => frame(false), fitSelection: () => frame(true), vertices: () => selectMode('vertices'), bones: () => {setMovementMode('select');selectMode('bones');}, uv: () => selectMode('uv'), paint: () => {setRenderMode('textured');setView('perspective');selectMode('paint');}, animation: () => selectAnimationPanel('movement'), animations: () => selectAnimationPanel('animations'), textureLibrary: () => openLibrary(uvEditing, true), help: () => setDialog({ type: 'help' }), diagnostics: () => setDialog({ type: 'diagnostics' }), about: () => setDialog({ type: 'about' }), ...Object.fromEntries(resources.map(kind => [kind, () => setDialog({ type: 'resource', kind })])), ...Object.fromEntries(views.map(name => [name, () => setView(name)])) };
  Object.assign(commands.current, {
    forge:()=>setDialog({type:'forge'}), optimizeModel:()=>openOptimizeXL(), bitsAndParts:()=>setDialog({type:'bitsAndParts'}), particles:()=>openParticles(), animXL:()=>setDialog({type:'animXL'}),
    ...Object.fromEntries(SHAPE_TOOLS.map(tool=>['shape:'+tool.toLowerCase(),()=>setDialog({type:'shape',tool})])),
    ...Object.fromEntries(['set','copy','paste','copyPose','delete','clear','selectAll','previous','next'].map(id=>['keyframe:'+id,()=>timelineCommands.current[id]?.()])),
    exit: () => window.desktop?.close?.(), settings: () => setSettingsTab('mouse'), hotkeys: () => setSettingsTab('hotkeys'), graphics: () => setSettingsTab('graphics'), appearanceSettings: () => setSettingsTab('visuals'), configurationSettings: () => setSettingsTab('configuration'), gridSettings: () => setSettingsTab('grid'), gameDataSettings: () => setSettingsTab('gameData'),
    pressedKeys: () => changePreferences(previous=>({...previous,showPressedKeys:!previous.showPressedKeys})), captureSettings:()=>setSettingsTab('capture'),
    importTextures, textureFolder, hide, show: () => setHidden({}),
    cameraToggle: toggleCamera,
    'wheel:scroll': () => toggleWheelMode('scroll'), 'wheel:pointer': () => toggleWheelMode('pointer'), 'wheel:rotate': () => changePreferences(previous => ({ ...previous, wheelMode: 'rotate' })),
    pointerUp: () => changePointerSensitivity(preferencesRef.current.pointerSensitivity * 1.15), pointerDown: () => changePointerSensitivity(preferencesRef.current.pointerSensitivity / 1.15),
    'game-data-rescan': async () => { if (!window.desktop?.rescanGameData) { say('Choose a Warcraft III installation folder in the desktop application.'); return; } try { say('Refreshing Warcraft III texture locations…'); const found = await window.desktop.rescanGameData(); settings.current.gameDataDiscovery = found; await resolveTextures(); say(`Warcraft III texture locations refreshed: ${found.archives?.length || 0} archives available.`); } catch (error) { say(error.message, true); } },
    'grid:small': () => changePreferences(previous=>({...previous,grid:{...previous.grid,small:!previous.grid.small}})),
    ...Object.fromEntries(['xz','yz','xy'].map(plane=>['grid:'+plane,()=>{setShowGrid(true);changePreferences(previous=>({...previous,grid:{...previous.grid,planes:{...previous.grid.planes,[plane]:!previous.grid.planes[plane]}}}));}])),
    axes: () => changePreferences(previous=>{const visible=Object.values(previous.grid.axes).some(Boolean);return {...previous,grid:{...previous.grid,axes:{x:!visible,y:!visible,z:!visible}}};}),
    wireframe: () => setViewRenderMode('wireframe'),
    workplaneEnabled: () => setWorkplaneEnabled(value=>!value),
    normals: () => changeOverlay('normals', value => !value), shaded: () => setShaded(v => !v), showVertices: () => setShowVertices(v => !v), showAllGeosets: () => setShowAllGeosets(v => !v), clearDisplay,
    ...Object.fromEntries(['bones','skeleton','focusedSkeleton','wires','nodes','attachments','particles','sounds','events','cameras'].map(key=>[`display:${key}`,()=>changeOverlay(key,value=>!value)])),
    showParticles: () => showParticlePreview(!preferencesRef.current.graphics.particles),
    cleanView: () => setCleanViews(previous => ({...previous,[mode]:!previous[mode]})),
    geosetsAll: () => chooseSets(new Set(tabVisibleGeosets)), geosetsClear: () => chooseSets(new Set()), geosetsInvert: () => chooseSets(new Set([...tabVisibleGeosets].filter(index => !selectable.has(index)))),
    invertSelection: () => { if(uvEditing)return uvAction('select-invert'); const next={}; for(const gi of selectable) { const exclude=new Set([...(validSelection[gi]||[]),...(hidden[gi]||[])]); next[gi]=Array.from({length:model.Geosets[gi]?.Vertices.length/3||0},(_,i)=>i).filter(i=>!exclude.has(i)); } setSelection(next); },
    nextGeoset: () => stepGeoset(1), previousGeoset: () => stepGeoset(-1),
    nextUV: () => setUvSet(v => (v+1)%(geoset?.TVertices.length||1)),
    convertVersion: () => { if (hasUVPreview || hasTrackDrafts) { say('Apply or revert pending previews before conversion.',true); return; } try { const target=model.Version===800?1000:800; doc.convertVersion(target); refresh(); say('Converted to MDX'+target+'. Undo is available; Save writes the result.'); } catch(error) { refresh(); say(error.message,true); } },
    normalRotate: () => setDialog({type:'normalRotate'}),
    anchorSelect: () => { setChoosingZoomAnchor(true); say('Drag a selection box over one selected vertex.'); },
    play: () => setPlaying(v => !v),
    nextSequence: () => { const ids = model.Sequences.map((_, i) => i); if (ids.length) selectSequence(ids[(ids.indexOf(sequence) + 1) % ids.length]); },
    previousSequence: () => { const ids = model.Sequences.map((_, i) => i); if (ids.length) selectSequence(ids[(ids.indexOf(sequence) + ids.length - 1) % ids.length]); },
    firstFrame: () => {setPlaying(false);setTime(animationDomain.start);}, lastFrame: () => {setPlaying(false);setTime(animationDomain.end);},
    nextFrame: () => {setPlaying(false);setTime(v=>Math.min(animationDomain.end,Math.round(v)+1));}, previousFrame: () => {setPlaying(false);setTime(v=>Math.max(animationDomain.start,Math.round(v)-1));},
    sensitivityUp: () => changeSensitivity(preferencesRef.current.scrollSensitivity*1.15), sensitivityDown: () => changeSensitivity(preferencesRef.current.scrollSensitivity/1.15),
    ...Object.fromEntries(['work','zoom','rotate','move'].map(v=>['camera:'+v,()=>setCameraMode(v)])),
    ...Object.fromEntries(['select','translate','rotate','scale'].map(v=>[v,()=>mode === 'bones' && v === 'rotate' ? bindSelectedVertices('hard') : setWorkTool(v)])),
    ...Object.fromEntries(['xy','xz','yz'].map(v=>['plane:'+v,()=>setWorkplane(v)])),
    ...Object.fromEntries(['Delete vertices','Create triangle','Delete triangles','Uncouple','Collapse','Weld','Mirror','Extrude','Detach','Reverse normals','Smooth normals','Restore normals'].map(v=>[v,()=>(mode === 'bones'||vertexNodeCenter) && v === 'Delete vertices' ? deleteSelectedNode() : mode === 'bones' && v === 'Create triangle' ? beginAttach() : mode === 'bones' && v === 'Collapse' ? bindSelectedVertices('soft') : mode==='animation' && v==='Collapse' ? timelineCommands.current.copyPose?.() : mode==='animation' && v==='Delete vertices' ? timelineCommands.current.delete?.() : meshAction(v)])),
    'bone:detach': detachSelectedNode,
    'bone:detachVertices': () => bindSelectedVertices('detach'),
    ...Object.fromEntries(['flip-u','flip-v','rotate','fold','select-connected','select-invert'].map(v=>['uv:'+v,()=>uvAction(v)])),
  });
  function commandEnabled(id) {
    if (repairBlocked) return !saving && (id === 'exit' || !repairReceipt && ['open', 'save', 'saveAs'].includes(id));
    if (mode === 'showcase' && (['paste', 'pasteSpecial', 'optimizeModel', 'forge', 'bitsAndParts', 'particles', 'animXL', 'GeosetAnims', 'convertVersion'].includes(id) || id.startsWith('shape:') || id.startsWith('keyframe:'))) return false;
    if(id==='particles')return !saving;
    if(vertexNodeCenter&&id==='Delete vertices')return editable;
    if(id==='paint')return !doc.readOnly&&!saving&&model.Version===800;
    if(id.startsWith('paint:'))return mode==='paint'&&!doc.readOnly&&!saving;
    if(id==='optimizeModel')return !doc.readOnly&&!saving&&!liveUV&&!Object.keys(session.uvPreviews).length;
    if (mode === 'bones') {
      if (id === 'Delete vertices') return editable && !!singleRigNode;
      if (id === 'Create triangle') return editable && selectedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1);
      if (id === 'Collapse' || id === 'rotate' || id === 'bone:detachVertices') return editable && !!selectedBone && selectionCount > 0;
      if (id === 'bone:detach') return editable && parentedRigNodes.length > 0 && (multipleNodes || selectedRigNodes.length === 1);
      if (['scale', 'Delete triangles', 'Uncouple', 'Weld', 'Mirror', 'Extrude', 'Detach', 'Reverse normals', 'Smooth normals', 'Restore normals'].includes(id)) return false;
    } else if (id.startsWith('bone:')) return false;
    // N is easy to hit while wrapping UVs and would leave normals on in the main view.
    // The UV mapper may still turn them off.
    if (id==='normals' && uvEditing && !overlays.normals) return false;
    if (id==='uv' && uvWindow) return true;
    if (id==='uv') return Object.entries(validSelection).some(([index,ids])=>ids.length && model.Geosets[index]?.TVertices?.length);
    if (id==='anchorSelect') return editable && mode === 'vertices' && tool === 'scale' && selectionCount > 1;
    if (rigWorkspace && ['select','translate','rotate','scale'].includes(id)) return !movementRestricted(id === 'translate' ? 'move' : id, restrictions) && (!restPose || ['select','translate'].includes(id));
    if (id==='exit') return !!window.desktop;
    if (['undo','redo'].includes(id)&&mode==='showcase')return showcaseHistoryState[id];
    if (['undo','redo'].includes(id)) return mode==='paint' ? !!session.paintProject?.history?.[id==='undo'?'undo':'redo']?.length : id==='undo'?doc.canUndo:doc.canRedo;
    if (mode === 'animation' && ['Collapse','Delete vertices'].includes(id)) return !doc.readOnly && !saving;
    if(['forge','bitsAndParts','particles','animXL','GeosetAnims','convertVersion'].includes(id))return !doc.readOnly&&!saving;
    if(id.startsWith('shape:'))return !doc.readOnly&&!saving&&selectable.size>0;
    if(id.startsWith('keyframe:'))return ['animation','uv'].includes(mode)&&!doc.readOnly&&!saving;
    if(id==='paste'&&mode==='animation')return !doc.readOnly&&!saving;
    if (id==='pasteSpecial') return clipboard.current?.kind !== 'nodes' && !doc.readOnly && mode!=='animation';
    if (id==='paste') return (mode==='paint'?!!session.paintProject:!!clipboard.current) && !doc.readOnly && mode!=='animation';
    if (id==='copy') return mode==='animation'||selectedNodeIds.length>0||selectable.size>0;
    if (id==='hide') return selectionCount>0;
    if (id==='show') return hiddenCount>0;
    if (['play','firstFrame','lastFrame','nextFrame','previousFrame'].includes(id)) return (mode==='animation' || mode==='uv' && sequence>=0);
    if (['nextSequence','previousSequence'].includes(id)) return (mode==='animation' || mode==='uv') && model.Sequences.length>0;
    if (['nextGeoset','previousGeoset'].includes(id)) return model.Geosets.length>0;
    if (id.startsWith('uv:')) return uvEditing && !doc.readOnly;
    if (id==='nextUV') return uvEditing && !!geoset;
    if (['normalRotate','Delete vertices','Create triangle','Delete triangles','Uncouple','Collapse','Weld','Mirror','Extrude','Detach','Reverse normals','Smooth normals','Restore normals'].includes(id)) {
      if(!editable || !selectionCount || (uvEditing && !['Mirror','Uncouple','Collapse'].includes(id))) return false;
      if(['Collapse','Weld'].includes(id)) return selectionCount>=2;
      if(['Extrude','Detach','Delete triangles'].includes(id)) return selectedFaces>0;
      if(id==='Create triangle') return selectionCount===3 && Object.values(validSelection).filter(ids=>ids.length).length===1;
    }
    return true;
  }
  // Playback time changes do not change available commands or shortcut bindings.
  const settingsCommands = ['settings','hotkeys','graphics','captureSettings','appearanceSettings','configurationSettings','gridSettings','gameDataSettings'];
  const commandCatalog = useMemo(() => COMMANDS.map(command => ({...command,scope:['undo','redo'].includes(command.id)?'global':command.scope,label: mode === 'bones' ? ({ rotate: 'Hard Bind', 'Delete vertices': 'Delete object', 'Create triangle': 'Attach', Collapse: 'Soft Bind' }[command.id] || command.label) : command.label,allowInModal:settingsCommands.includes(command.id),enabled:commandEnabled(command.id)})), [doc, doc.revision, uvEditing, overlays.normals, doc.historyStats.undoSteps, doc.historyStats.redoSteps, mode, tool, sequence, validSelection, selectable, hiddenCount, selectionCount, selectedNodeIds, singleRigNode, selectedBone, parentBone, multipleNodes, selectedFaces, geoset, clipboard.current, restrictions, restPose, rigWorkspace, cleanAnimationPreview, visUI, saving, repairBlocked, repairReceipt, session.paintProject?.revision,showcaseHistoryState]);
  const runCommand = id => { if(commandEnabled(id)) { if(repairBlocked && id==='saveAs') return save(true); return commands.current[id]?.(); } };
  const runLatest = useRef(runCommand); runLatest.current = runCommand;
  const aiHost = useRef();
  aiHost.current = {
    state: () => ({...latest.current,model:latest.current.doc.model,selection:validSelection,workplane,view,cameraAngles,playing,saving,uvEditing,uvEligibleSelection:uvEditing?uvEntrySelection:undefined,renderMode:effectiveRenderMode,hidden,hiddenGeosets,keyframes:timelineCommands.current.selectionContext?.()}),
    // Cheap header data for the open AI panel; state() is only built when the AI acts.
    summary: () => ({name:doc.name,vertices:Object.values(validSelection||{}).reduce((n,ids)=>n+ids.length,0),nodes:selectedNodeIds.length,sequenceName:sequence>=0?model.Sequences[sequence]?.Name:null,time}),
    commands: () => Object.entries(commands.current).filter(([,run])=>typeof run==='function'&&run.length===0).map(([id])=>({id,label:commandCatalog.find(command=>command.id===id)?.label||id,enabled:commandEnabled(id)})),
    command: id => { if(!commandEnabled(id))throw Error('Editor command is unavailable.');return runCommand(id); },
    edit,
    select: value => {
      if(value.vertices)setSelection(filterVertexSelection(value.vertices,new Set(Object.keys(value.vertices).map(Number)),doc.model));
      if(value.nodeIds)setSelectedNodeIds(value.nodeIds);
      if(value.geosetIds)setSelectable(new Set(value.geosetIds));
      if(value.activeGeoset!==undefined)setActiveGeoset(value.activeGeoset);
    },
    selectKeys: async value => {
      await selectAnimationPanel('movement');setSelectedNodeIds([value.nodeId]);setMovementMode(({Translation:'move',Rotation:'rotate',Scaling:'scale'})[value.property]);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!timelineCommands.current.selectKeys)throw Error('The Movement timeline is not available.');
      timelineCommands.current.selectKeys(value.frames,{kind:'node',id:value.nodeId,property:value.property});
      await new Promise(resolve=>requestAnimationFrame(resolve));
    },
    restoreContext: async value => {
      await selectMode(value.mode);setWorkplane(value.workplane);setUvSet(value.uvSet);setActiveGeoset(value.activeGeoset);setSelectable(new Set(value.checkedGeosets));setSelection(value.selection);setSelectedNodeIds(value.selectedNodeIds);
      if(value.globalSequence!=null)selectTimeline('global:'+value.globalSequence);else selectSequence(value.sequence);
      setPlaying(false);setTime(value.liveFrame??value.frame);
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(value.keyframes){if(value.keyframes.keys?.length){await selectAnimationPanel('movement');setMovementMode(value.keyframes.controller);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}timelineCommands.current.restoreSelection?.(value.keyframes);await new Promise(resolve=>requestAnimationFrame(resolve));}
    },
    view: async value => {if(value.mode)await selectMode(value.mode);if(value.view)setView(value.view);if(value.globalSequence!==undefined)selectTimeline(value.globalSequence==null?String(value.sequence??sequence):'global:'+value.globalSequence);else if(value.sequence!==undefined)selectSequence(value.sequence);if(value.frame!==undefined){setPlaying(false);setTime(value.frame);}if(value.playing!==undefined)setPlaying(value.playing);if(value.renderMode)setViewRenderMode(value.renderMode);if(value.fit)frame(value.fit==='selection');},
    open: record => queueModelRecords([record]),
    assets: () => retainedForgeAssets(session.assets,doc.model),
    addAssets: records => loadTextures(records,session,{source:'forge'}),
    addReference: async record => {const opened=openDocument(record.bytes,record.name);if(!opened.model||opened.version==null)throw Error('This reference has no readable model.');const next=newSession(opened,record.path);setSessions(previous=>[...previous,next]);if(record.textures?.length)await loadTextures(record.textures,next,{source:'gameFile'});await resolveTextures(next);return {id:next.id,name:next.doc.name};},
  };
  const aiBridge = useMemo(() => new AiEditorBridge(() => aiHost.current), []);
  useEffect(() => aiBridge.attach(window.desktop), [aiBridge]);
  useEffect(() => {aiBridge.editorChanged();});


  const menuChecks = {shaded:overlays.shaded,'display:bones':overlays.bones,'display:skeleton':overlays.skeleton,'display:focusedSkeleton':overlays.focusedSkeleton,'display:wires':overlays.wires,'display:nodes':overlays.nodes,'display:attachments':overlays.attachments,'display:particles':overlays.particles,'display:sounds':overlays.sounds,'display:events':overlays.events,showVertices:overlays.vertices,grid:overlays.grid,normals:overlays.normals};
  useEffect(()=>{window.desktop?.setMenuState?.({readOnly:doc.readOnly,saving,viewMode:displayMode,vanilla:visUI,checks:menuChecks,uvEnabled:commandEnabled('uv')});},[doc.readOnly,saving,displayMode,visUI,JSON.stringify(menuChecks),selectionCount,activeGeoset]);
  useEffect(() => window.desktop?.onMenu(action => { if (action?.action === 'openRecent') { if (!latest.current.dialog && !latest.current.settingsTab) commands.current.openRecent(action.path); return; } if(['exit',...settingsCommands].includes(action) || latest.current.dialog?.type === 'resource' && ['undo','redo'].includes(action) || (!latest.current.dialog && !latest.current.settingsTab)) runLatest.current(action); }), []);
  useEffect(() => { const boot = session.id; window.desktop?.initial?.().then(async initial => { settings.current = initial.settings || {}; setGameDataPath(settings.current.gameData || ''); setGameDataSources(settings.current.gameDataSources || []); const persisted=normalizePreferences(settings.current.preferences || preferencesRef.current); savedPreferences.current=JSON.stringify(persisted); changePreferences(persisted); const current = latest.current.session; current.doc.configureHistory({ budgetBytes: settings.current.historyBudgetBytes ?? 512 * 1048576, maxSteps: settings.current.historyMaxSteps ?? 10000 }); setRecoveries(initial.recovery || []); const records=initial.models?.length?initial.models:initial.model?[initial.model]:[]; if(records.length&&current.id===boot&&!current.doc.dirty)await queueModelRecords(records); else refresh(); setPreferencesReady(true); if(initial.recoveryPrompt && initial.recovery?.length)setDialog({type:'recovery'}); }).catch(error => { setPreferencesReady(true); say(error.message, true); }); }, []);
  useEffect(() => window.desktop?.onExternalModels?.(records => { queueModelRecords(records).catch(error=>say(error.message,true)); }), []);
  const hasUnsavedWork=doc.dirty||hasUVPreview||hasTrackDrafts||hasPaintChanges;
  const hasAnyUnsavedWork=sessions.some(sessionDirty);
  async function saveSessionWork(target, includeNeverSaved = false) {
    const hasModelWork = target.doc.dirty || Object.keys(target.uvPreviews).length > 0 || Object.keys(target.animationDrafts).length > 0;
    let saved = !target.paintProject?.dirty || await savePaintProject(target.paintProject, target);
    if (saved && (hasModelWork || includeNeverSaved && !target.path)) saved = await save(false, target.doc.format, target);
    return saved;
  }
  saveBeforeCloseRef.current=async()=>{
    window.dispatchEvent(new CustomEvent('mdlxl-paint-flush'));
    for (const target of latest.current.sessions) if ((sessionDirty(target) || !target.path) && !await saveSessionWork(target, true)) return false;
    return true;
  };
  useEffect(() => { const pending=sessions.filter(item=>sessionDirty(item)||!item.path);window.desktop?.setDirty({dirty:hasAnyUnsavedWork,saved:pending.length===0,name:pending.length>1?`${pending.length} open models`:pending[0]?.doc.name||doc.name}); document.title = `${hasUnsavedWork ? '* ' : ''}${session.path || doc.name} — MDLxL`; }, [doc, tick, sessions, session.path, hasUnsavedWork, hasAnyUnsavedWork]);
  useEffect(() => { applyApplicationTheme(preferences); }, [preferences]);
  // Without a graphics card the processor draws every frame. Lighten such a
  // PC once; later choices in Graphics settings are kept.
  useEffect(() => { if (preferencesReady && !preferencesRef.current.graphics.softwareLow && detectRenderer().software) changePreferences(previous => ({ ...previous, graphics: { ...previous.graphics, ...SOFTWARE_RENDERING_GRAPHICS } })); }, [preferencesReady]);
  useEffect(() => { const handler = event => { if (latest.current.sessions.some(sessionDirty)) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, []);
  useEffect(() => {
    if (!doc.dirty && doc.revision === 0 && !hasUVPreview && !hasTrackDrafts && session.checkpoint === 0) return;
    const timer = setTimeout(async () => { try { await checkpoint(session); } catch (error) { say(`Recovery checkpoint failed: ${error.message}`, true); } }, 350);
    return () => clearTimeout(timer);
  }, [doc, doc.revision, session, session.uvPreviews, session.animationDrafts]);
  useEffect(() => {
    if(!preferencesReady) return;
    const encoded=JSON.stringify(preferences);
    try { localStorage.setItem('mdlvis-preferences',encoded); } catch(error) { say('Settings could not be stored in this browser: '+error.message,true); }
    if(!window.desktop || savedPreferences.current===encoded)return;
    const timer=preferencesTimer.current=setTimeout(() => { window.desktop.configure({preferences}).then(result => {settings.current=result; savedPreferences.current=encoded;}).catch(error=>say('Settings could not be saved: '+error.message,true)); },200);
    return () => clearTimeout(timer);
  },[preferences,preferencesReady]);
  useEffect(() => window.desktop?.onBeforeClose?.(async () => { const captures=[]; window.dispatchEvent(new CustomEvent('mdlvis-flush-captures',{detail:captures})); window.dispatchEvent(new CustomEvent('mdlxl-flush-particle-draft',{detail:captures})); await Promise.all(captures); await flushRecordingQueue(); clearTimeout(preferencesTimer.current); if(!latest.current.preferencesReady)return; const current=preferencesRef.current, encoded=JSON.stringify(current); if(savedPreferences.current!==encoded) {await window.desktop.configure({preferences:current});savedPreferences.current=encoded;} }),[]);
  useEffect(() => window.desktop?.onSaveBeforeClose?.(() => saveBeforeCloseRef.current()),[]);
  useEffect(() => { if(preferencesReady) resolveTextures(); },[preferencesReady, JSON.stringify(model.Textures.map(texture => texture.Image))]);


  // NonLooping is a Warcraft III serialization flag. Editor playback loops
  // until the user explicitly pauses it.
  const previewLoop = true;
  const previewSelection = getUVPreviewSelection(model, (uvEditing || dialog?.host === 'uv')?[activeGeoset]:[...selectable]);
  const cameraPanel = <fieldset className="camera-angle-panel"><legend>Rotate around Axis</legend>{['x','y','z'].map(axis=><Coordinate key={axis} axis={'Camera '+axis.toUpperCase()} displayAxis={axis.toUpperCase()} value={cameraAngles[axis]} onCommit={value=>setCameraAnglesRequest(previous=>({...cameraAngles,[axis]:value,revision:(previous?.revision||0)+1}))}/>)}<small>World XYZ · degrees</small></fieldset>;
  const boundBoneIds=directlyBoundBoneIds(model,validSelection);
  const bindingPanel=<SidebarSection className="binding-panel" title="Connected Bones"><section className="binding-inspection" aria-label="List of bones connected to selected vertices">{boundBoneIds.map(id=>{const name=model.Nodes.find(node=>node?.ObjectId===id)?.Name||'Bone '+id;return <button type="button" className="binding-bone" aria-pressed={selectedNodeIds.includes(id)} title={`Select ${name} without clearing selected vertices`} key={id} onClick={()=>setSelectedNodeIds([id])}>{name}</button>;})}</section></SidebarSection>;
  const highlightAppearance = preferences.viewportAppearance.geosetHighlight;
  const highlightedFromSelection = !cleanView && preferences.highlightSelection && highlightAppearance.viaSelection ? selectionHoveredGeoset : null;
  const inputStrength = <div className="compact-input-strength" aria-label="Input strengths" title="Adjust in Settings → Mouse, or use the existing input hotkeys"><span className={adjustingInput?.kind === 'pointer' ? 'adjusting' : ''}>DPI {preferences.pointerSensitivity}×</span><span className={adjustingInput?.kind === 'scroll' ? 'adjusting' : ''}>Scroll {preferences.scrollSensitivity}×</span></div>;
  const grabThroughToggle = <label className="check grabthrough-option"><input aria-label="Grabthrough" type="checkbox" checked={grabThrough} onChange={event => setGrabThrough(event.target.checked)}/>Grabthrough</label>;
  const displayedGeosets = new Set([...selectable, ...visibleOnly].filter(index => tabVisibleGeosets.has(index)));
  const hiddenGeosets = new Set([...allGeosets(model.Geosets.length)].filter(index => !tabVisibleGeosets.has(index) || !showAllGeosets && !displayedGeosets.has(index)));
  const leaveVisibleAvailable = mode === 'vertices' || mode === 'bones' || mode === 'animation' && animationPanel === 'movement';
  const geosetPicker = <GeosetPicker {...{
    activeGeoset, changePreferences, chooseSet, chooseSets, cleanView, Dialog, doc, edit, geosetTab,
    highlightAppearance, model, preferences, saving, selectable, selectGeosetTab, session, setContext,
    setSelectionHoveredGeoset, setShowAllGeosets, showAllGeosets, tabGeosets, tabVisibleGeosets, viewHoveredGeoset,
    visibleOnly, hideExtras, setHideExtras
  }}/>;
  const changeGeosetStructure = (label, sections, operation) => {
    let result;
    try { result = edit(label, sections, operation, { rethrow: true }); }
    catch { return; }
    if (result === false) { say('No geosets share compatible materials and RGB.'); return false; }
    const remapVertices = previous => {
      const next = {};
      for (const [oldIndex, vertices] of Object.entries(previous)) {
        const newIndex = result.oldToNew[oldIndex];
        if (newIndex === undefined) continue;
        (next[newIndex] ||= []).push(...vertices.map(vertex => vertex + result.vertexOffsets[oldIndex]));
      }
      return next;
    };
    setSelection(remapVertices); setHidden(remapVertices);
    setSelectable(previous => new Set([...previous].map(index => result.oldToNew[index]).filter(index => index !== undefined)));
    setVisibleOnly(previous => new Set([...previous].map(index => result.oldToNew[index]).filter(index => index !== undefined)));
    setActiveGeoset(previous => result.oldToNew[previous] ?? -1); setUvSet(0); clearZoomAnchor();
    say(`Merged ${result.merged} geosets.`);
    return result;
  };
  const mergeSelectedGeosets = () => {
    const review = geosetMergeConflicts(model, validSelection);
    if (!review.groups.length) { say('No geosets share compatible materials and RGB.'); return; }
    if (review.conflicts.length) {
      setDialog({ type: 'mergeGeosets', review, selection: structuredClone(validSelection), resolutions: {}, doc, revision: doc.revision });
      return;
    }
    changeGeosetStructure('Merge geosets', ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], current => mergeSimilarGeosets(current, validSelection));
  };
  const resolveGeosetMerge = () => {
    if (dialog.doc !== doc || dialog.revision !== doc.revision) { setDialog(null); say('The model changed. Select the geosets and merge again.'); return; }
    const result = changeGeosetStructure('Merge geosets', ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], current => mergeSimilarGeosets(current, dialog.selection, dialog.resolutions));
    if (result !== undefined) {
      setDialog(null);
      if (result === false) say('Selected geosets exceed the model format limits and were kept separate.');
    }
  };
  const separateSelectedGeosets = nuclear => {
    const label = nuclear ? 'Nuclear Seperation' : 'Seperate by Loose parts';
    let result;
    try { result = edit(label, ['Geosets', 'GeosetAnims', 'Gliders', 'Info'], current => (nuclear ? nuclearSeparateGeosets : separateGeosetsByLoosePart)(current, validSelection), { rethrow: true }); }
    catch { return; }
    if (result === false) { say('The selected vertices contain no parts to separate.'); return; }
    setSelection(previous => { const next = { ...previous }; for (const index of result.touched) delete next[index]; return { ...next, ...result.selection }; });
    setHidden(previous => { const next = { ...previous }; for (const index of result.touched) delete next[index]; return next; });
    setSelectable(previous => new Set([...previous, ...result.geosetIndices]));
    setActiveGeoset(result.geosetIndices[0] ?? activeGeoset); setUvSet(0); clearZoomAnchor();
    say(`Separated selected geometry into ${result.parts} new geoset${result.parts === 1 ? '' : 's'}.`);
  };
  const deleteSelectedGeosetFreeVertices = () => {
    let result;
    try { result = edit('Delete free vertices', ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], current => deleteFreeVertices(current, selectable), { rethrow: true }); }
    catch { return; }
    if (result === false) { say('No free vertices found in selected geosets.'); return; }
    const remapVertexState = previous => {
      const next = {};
      for (const [oldIndex, vertices] of Object.entries(previous)) {
        const newIndex = result.oldToNew[oldIndex];
        if (newIndex === undefined) continue;
        const vertexMap = result.vertexMaps[oldIndex];
        const remapped = vertices.map(vertex => vertexMap ? vertexMap[vertex] : vertex).filter(Number.isInteger);
        if (remapped.length) next[newIndex] = [...new Set(remapped)];
      }
      return next;
    };
    setSelection(remapVertexState); setHidden(remapVertexState);
    setSelectable(previous => new Set([...previous].map(index => result.oldToNew[index]).filter(index => index !== undefined)));
    setVisibleOnly(previous => new Set([...previous].map(index => result.oldToNew[index]).filter(index => index !== undefined)));
    setActiveGeoset(previous => result.oldToNew[previous] ?? -1); setUvSet(0); clearZoomAnchor();
    say(`Deleted ${result.removedVertices} free ${result.removedVertices === 1 ? 'vertex' : 'vertices'} from selected geosets.`);
  };
  const commitUVChanges = (changes, label = 'Edit UV coordinates') => {
    setLiveUV(null);
    return edit(label, ['Geosets'], current => {
      for (const change of changes || []) {
        const target = current.Geosets[change.geosetIndex]?.TVertices?.[change.uvSet];
        if (!target || target.length !== change.values?.length) throw Error('The UV map changed structure before the edit could be applied.');
        current.Geosets[change.geosetIndex].TVertices[change.uvSet] = new Float32Array(change.values);
      }
    });
  };
  const uncoupleUVSelection = (currentSelection, coordByGeoset = {}) => {
    let nextSelection = { ...validSelection }, nextDomain = { ...uvEntrySelection };
    const result = edit('Uncouple UV vertices', ['Geosets'], current => {
      for (const [indexText, ids] of Object.entries(currentSelection || {})) {
        const index = Number(indexText), uncoupled = uncoupleUVVertices(current.Geosets[index], ids, coordByGeoset[index] ?? uvSet);
        nextSelection[index] = [];
        nextDomain[index] = [...new Set([...(nextDomain[index] || []), ...uncoupled.created])];
      }
    });
    if (result !== false) { setSelection(nextSelection); setUVEntrySelection(nextDomain); setLiveUV(null); }
  };
  const uvWorkspace = <AppUVWorkspace {...{
    activeGeoset, applyGeosetDensity, cameraMode, cameraProps, changePointerSensitivity, changePreferences,
    changeSensitivity, commitUVChanges, doc, edit, finishUVPreview, model, openLibrary, preferences, previewModel,
    previewSuspended: previewSuspended || !!uvWindow?.minimized, saving, closeUVWindow, session, setActiveGeoset, setLiveUV, setSelection, setUVEntrySelection,
    setUvSet, teamColor, texturedModel, toggleMiddleCamera, uncoupleUVSelection, uvEntryId, uvEntrySelection,
    validSelection, view, uvMinimized: !!uvWindow?.minimized
  }}/>;
  const textureLibraryDialog = dialog?.type === 'library' && <AppTextureLibrary {...{
    addTexture, dialog, doc, importPart, model, openGameModel, preferences, previewSelection, previewTexture, session, setDialog
  }}/>;
  const timeline = <AppTimeline {...{
    animationPanel, closeMotion, doc, edit, globalSeqId, highlightChain, highlightKeyframes, inspectingMotion,
    materialVisibility, mode, model, motion, motionAnchor, motionOrigin, movementMode, playbackSpeed, playing,
    poseConfig, poseViewActive, preferences, registerTimelineCommands, replayMotion, restPose, restrictions,
    rigWorkspace, saving, say, seekMotionTime, selectable, selectedNodeIds, selectMotion, sequence, session,
    setMotionAnchor, setPlaybackSpeed, setPlaying, time
  }}/>;
  const activePortrait = portraitModeActive;
  const controlGroups = useMemo(() => { try { return modelControlGroups(model); } catch { return []; } }, [model, doc.revision]);
  const cameraPortraitActive = activePortrait && !!model.Cameras?.[portraitCameraIndex];
  // Props shared by both Movement controller render sites: Bones mode and the
  // Animation > Movement panel. Called while rendering each site, as before.
  const movementControllerProps = () => ({
    vanilla: visUI, objectDisplay: overlays, onObjectDisplay: changeOverlay,
    poseConfig, onPoseChange: changePose, onPoseSelect: selectPose, onOpenEmitter: openParticles, restPose, selectionByGeoset: validSelection,
    workplaneEnabled, onWorkplaneEnabled: setWorkplaneEnabled, workplane, onWorkplane: setWorkplane, restrictions, onRestrictions: setRestrictions,
    multiple: multipleNodes, onMultiple: setMultipleNodes, onVertexTransform: transform, globalSeqId: restPose ? null : globalSeqId,
    onTimelineChange: selectTimeline, highlightKeyframes, onHighlightKeyframes: setHighlightKeyframes, highlightChain,
    onHighlightChain: changeHighlightChain, preferences, disabled: doc.readOnly || saving, model, revision: doc.revision, sequenceIndex: sequence,
    time, selectedNodeIds, onSelectNodes: setSelectedNodeIds, onEdit: edit, onSeek: setTime, onSequenceChange: selectSequence, playing,
    onPlayingChange: setPlaying, transformMode: movementMode, onTransformMode: value => setWorkTool(value==='move'?'translate':value),
    transformSpace: movementSpace, onTransformSpace: setMovementSpace, showNodes, onShowNodes: setShowNodes,
    showParticles: preferences.graphics.particles, onShowParticles: showParticlePreview, onOpenNodeManager: openNodeManager
  });
  // Gate BEFORE mounting the timeline/controllers. Their duplicate-owner edit
  // invariant remains strict; malformed models get a choice instead of a crash.
  if (repairBlocked) return <>
    <input ref={files} type="file" accept=".mdl,.mdx,.mdlxlpaint" hidden onChange={event => { if (event.target.files[0]) loadFile(event.target.files[0]); event.target.value = ''; }}/>
    <div className="repair-model-tabs"><ModelTabs sessions={sessions} session={session} activateSession={activateSession} sessionDirty={sessionDirty} requestCloseSession={requestCloseSession}/></div>
    <GeosetAnimationRepair key={session.id} model={model} name={doc.name} groups={duplicateAnimations} receipt={repairReceipt} busy={saving} status={status}
      unavailable={doc.readOnly ? 'This model is read-only; repair is disabled to preserve unsupported data.' : !window.desktop?.repairGeosetAnimations || !session.path ? 'Save a local copy first. Automatic backup and disk Undo require the desktop build.' : hasUVPreview || hasTrackDrafts || session.paintProject ? 'Pending UV, animation-text or paint work is retained. Repair the original model in a separate model session first.' : ''}
      onRepair={repairDuplicateAnimations} onUndo={undoDuplicateRepair} onAccept={() => setRepairReceipt(null)} onOpen={open} onSave={() => save(true)}/>
    {dialog?.type === 'closeTab' && <Dialog title="Close model tab?" onClose={() => setDialog(null)} footer={<><button disabled={saving} onClick={async()=>{const target=dialog.target;if(await saveSessionWork(target)){setDialog(null);removeSession(target);}}}>Save</button><button disabled={saving} onClick={()=>{const target=dialog.target;setDialog(null);removeSession(target);}}>Don't save</button><button disabled={saving} onClick={()=>setDialog(null)}>Cancel</button></>}><p>Save changes to {dialog.target.doc.name} before closing its tab?</p></Dialog>}
  </>;
  return <HotkeysProvider preferences={preferences} catalog={commandCatalog} activeScope={settingsTab?'settings':dialog?'dialog':mode==='paint'?'paint':'editor'} onAction={id=>runLatest.current(id)}><div data-vis-ui={visUI || undefined} data-hotkey-scope={mode==='paint'?'paint':'editor'} className={`classic-app${rigWorkspace?' rig-workspace':''}${mode==='bones'?' bones-workspace':''}${activePortrait?' portrait-workspace':''}${mode==='uv'?' uv-mode':''}${mode==='paint'?' paint-mode':''}`} onPointerDownCapture={event => setUVFocused(!!event.target.closest('.uv-tab-window'))} onFocusCapture={event => setUVFocused(!!event.target.closest('.uv-tab-window'))} onDragOver={dragFiles} onDrop={dropFiles} onClick={() => context && setContext(null)}>{fileDrag && <div className="file-drop-overlay" aria-hidden="true"/>}
    <input hidden ref={files} type="file" accept=".mdl,.mdx,.mdlxlpaint" onChange={event => { const file = event.target.files[0]; event.target.value = ''; if (file) (mode==='showcase'?loadShowcaseModel:loadFile)(file); }}/><input hidden ref={textures} type="file" accept=".blp,.tga,.dds,.png,.jpg,.jpeg,.webp" multiple onChange={event => { loadTextures([...event.target.files]); event.target.value = ''; }}/><input hidden ref={managerTextures} type="file" accept=".blp,.tga,.dds,.png,.jpg,.jpeg,.webp" multiple onChange={event => { const selected = [...event.target.files]; event.target.value = ''; selectManagerTextures(selected); }}/><input hidden ref={folder} type="file" webkitdirectory="" multiple onChange={event => loadTextures([...event.target.files])}/>
    <AppToolbar {...{
      activateSession, animationPanel, cameraMode, changePreferences, clearDisplay, commandEnabled, commands, copy,
      dialog, displayMode, doc, hiddenCount, hide, inputStrength, menuChecks, mode, model, open, openLibrary,
      openOptimizeXL, openParticles, paste, preferences, pressedKeysIcon, requestCloseSession, resources, rgbPreview,
      rgbSequence, runCommand, runLatest, save, saving, selectAnimationPanel, selectMode, selectionCount, session,
      sessionDirty, sessions, setCameraMode, setDialog, setHidden, setRGBPreview, setRGBSequence, setRenderMode,
      setTeamColor, setVisUI, settingsTab, teamColor, undo, visUI
    }} aiControl={<AiAssistant bridge={aiBridge}/>}/>
    {attachematorOpen && <Suspense fallback={null}><Attachemator key={session.id} doc={doc} modelPath={session.path} textureAssets={session.assets} preferences={preferences} teamColor={teamColor} onCommit={commitAttachemator} onClose={() => setAttachematorOpen(false)}/></Suspense>}
    {mode === 'animation' && <PortraitToolbar model={model} active={activePortrait} cameraIndex={portraitCameraIndex} disabled={doc.readOnly || saving} allowControlModel={animationPanel === 'movement' && portraitSequenceIndices(model).includes(sequence)} controlModel={controlsWholeModel(selectedNodeIds)} controlGroups={controlGroups} controlModelGroup={controlModelGroup} onControlModel={() => selectControlModel()} onControlModelGroup={selectControlModel} onToggle={() => activePortrait ? setPortraitEnabled(false) : enablePortrait()} onCameraIndex={value => { setPortraitView('perspective'); setPortraitCameraIndex(value); }} frame={time} sequenceIndex={sequence} onSequence={selectSequence} onNew={newPortraitCamera} onMakePortrait={promotePortraitCamera} onEdit={editPortraitFields} onShot={composePortraitShot} onPause={() => setPlaying(false)} settings={portraitSettings} onSettings={patch => setPortraitSettings(value => ({...value,...patch}))} previewChanged={portraitPreviewChanged} lightingStatus={portraitLightingStatus} onCreatePortraitSequence={openPortraitSequenceSetup} onSetView={updatePortraitCamera} hasBackground={hasPortraitBackground} onBackground={placePortraitBackground} backgroundLook={portraitBackdropLook} teamColor={teamColor} onSnap={() => { setPortraitView('perspective'); setPortraitSnapRevision(value => value + 1); }}/>}
    <main className={`classic-workspace${mode === 'vertices' && quadView ? ' quad-workspace' : ''}${mode === 'animation' ? ' animation-workspace' : ''}${mode === 'uv' ? ' uv-immersive' : ''}${mode === 'paint' ? ' paint-immersive' : ''}${mode === 'showcase' ? ' showcase-immersive' : ''}`} inert={saving || undefined}><section className="classic-view">
      <AppViewLabel {...{
        activeVertexPane, cameraPortraitActive, cleanAnimationPreview, frame, mode, portraitView, quadView, renderMode,
        setCleanViews, setPortraitView, setRenderMode, setView, toggleQuadView, view, views
      }} boneInfluenceAvailable={boneInfluenceAvailable && !normalizer} renderMode={normalizer?.renderMode || viewRenderMode} setRenderMode={normalizer ? value => changeNormalizer({ renderMode: value }) : setChosenRenderMode}/>
      {(mode === 'showcase'||showcaseVisited) && <div style={{display:mode==='showcase'?'contents':'none'}}><Suspense fallback={<div className="classic-empty-view">Loading Showcase…</div>}><ShowcaseWorkspace onHistoryState={showcaseHistoryChanged} active={mode==='showcase'} onLoadModel={loadShowcaseModel} model={showcaseSession?.doc.model||model} modelName={showcaseSession?.doc.name||doc.name} modelPath={showcaseSession?showcaseSession.path:session.path} revision={showcaseSession?.doc.revision??doc.revision} textureAssets={showcaseSession?.assets||session.assets} preferences={preferences} teamColor={teamColor} sessionId={showcaseSession?.id||session.id} background={background} backgroundLibrary={backgroundLibrary} onBackground={selectBackground} onStatus={say}/></Suspense></div>}
      {normalizer && <NormalizerControls session={normalizer} plan={normalPlan.plan} error={normalPlan.error} onChange={changeNormalizer} onApply={applyNormalizer} onFixFacing={fixNormalizerFacing} onCancel={() => setNormalizer(null)}/>}
      {preferencesReady && mode === 'vertices' && <Viewport
        vanilla={visUI} editorDisplayMode={visUI?undefined:'vertices'}
        {...(visUI?{selectedNodeIds,onSelectNodes:ids=>{setSelectedNodeIds(ids);setSelection({});},onNodeTransform:doc.readOnly||saving?undefined:moveNodes}:{})}
        cameraHandoff={cameraHandoff} quadView={quadView} viewRequest={vertexViewRequest} onActivePaneChange={setActiveVertexPane} workplaneEnabled={workplaneEnabled}
        {...cameraProps}
        rotationNormals={dialog?.type==='normalRotate'} onInspectGeoset={inspectGeoset} onHoverGeoset={setViewHoveredGeoset}
        highlightSelection={!cleanView && preferences.highlightSelection && highlightAppearance.viaView} onViewChange={setView}
        preferences={preferences} onSensitivityChange={changeSensitivity} onPointerSensitivityChange={changePointerSensitivity} onCameraModeToggle={toggleMiddleCamera}
        suspended={!!dialog || (!!settingsTab && settingsTab !== 'visuals')} key={session.id}
        hoveredGeoset={highlightedFromSelection} model={normalizerModel || previewModel} revision={doc.revision} selectedGeoset={activeGeoset}
        selectedVertices={validSelection[activeGeoset] || []}
        visibleGeosets={displayedGeosets} selectableGeosets={selectable} selectionByGeoset={validSelection}
        onSelectionChange={next => {setSelectedNodeIds([]);setSelection(filterVertexSelection(next, selectable, doc.model));}}
        normalizer={!!normalizer} normalChanges={normalizer?.showNormals ? normalChanges || {} : null}
        hiddenVertices={hidden} hiddenGeosets={hiddenGeosets} onSelectGeoset={setActiveGeoset}
        mode={normalizer ? normalizer.renderMode : cleanView ? 'textured' : viewRenderMode} overlays={normalizer ? { ...overlays, normals: normalizer.showNormals } : overlays} showVertices={showVertices}
        showSkeleton={overlays.bones || overlays.nodes || overlays.attachments || overlays.particles}
        showGrid={showGrid} showAxes={showAxes} shaded={normalizer ? true : shaded} view={view} cameraMode={cameraMode}
        workplane={workplane} transformMode={tool}
        zoomAnchor={zoomAnchor} choosingZoomAnchor={!normalizer && choosingZoomAnchor}
        onChooseZoomAnchor={next => { if (tool === 'scale' && validSelection[next.geosetIndex]?.includes(next.vertexIndex)) { setZoomAnchor(next); setChoosingZoomAnchor(false); say('Anchor vertex selected.'); } }}
        rgbPreview={rgbPreview} rgbPreviewSequenceIndex={rgbSequence} sequenceIndex={-1} time={0} playing={false}
        teamColor={teamColor} textureAssets={session.assets} onTransform={transform}/>}
      {uvWindow && <UVWindow key={`uv:${session.id}`} state={uvWindow} onChange={setUVWindow} onClose={closeUVWindow}>{uvWorkspace}{dialog?.host === 'uv' && textureLibraryDialog}</UVWindow>}
      {preferencesReady && mode === 'paint' && <Suspense fallback={<div className="classic-empty-view">{paintMessage('paint.loading')}</div>}><PaintBoundary key={session.id} onSave={()=>savePaintProject()} onExit={()=>selectMode('vertices')}><PaintWorkspace key={session.id} model={session.paintWorkingModel||model} originalModel={paintOriginalModel} revision={doc.revision+session.paintWorkingRevision} modelName={doc.name} modelPath={session.path} textureAssets={session.assets} project={session.paintProject} activeGeoset={activeGeoset} onGeosetChange={setActiveGeoset} onWorkingModelChange={value=>{session.paintWorkingModel=value;session.paintWorkingRevision++;refresh();}} onProjectChange={value=>{if(!session.paintProject&&value){session.paintOriginalModelBytes=doc.serialize(doc.format);session.paintWorkingModel ||= structuredClone(model);}if(!value){session.paintWorkingModel=null;session.paintWorkingRevision++;delete session.paintAppliedRevision;}session.paintProject=value;refresh();}} onEnsureTarget={ensurePaintTarget} onSaveProject={savePaintProject} onOpenProject={open} onExport={exportPaintProject} onApply={applyPaintToModel} onExit={()=>selectMode('vertices')} onStatus={say} preferences={preferences} cameraMemory={paintCamera} cameraProps={{...cameraProps,onWorkMode:()=>setCameraMode('work'),onSensitivityChange:changeSensitivity,onPointerSensitivityChange:changePointerSensitivity,onCameraModeToggle:toggleMiddleCamera}} view={view} cameraMode={cameraMode} teamColor={teamColor} readOnly={doc.readOnly||saving||model.Version!==800}/></PaintBoundary></Suspense>}

      {(mode === 'animation' || mode === 'bones') && <Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview
        vanilla={visUI} editorDisplayMode={displayMode}
        onParticlePick={id=>{setMaterialVisibility(null);setSelectedNodeIds([id]);if(mode!=='animation'||animationPanel!=='animations')openParticles(id);}} particleSelectedId={selectedNodeIds[0]}
        cameraHandoff={cameraHandoff} attachSourceIds={mode === 'bones' ? attachSourceIds : []} onAttachTarget={finishAttach} onCancelAttach={() => setAttachSourceIds([])}
        previewMode={previewRenderModes.animation} presentation={cleanAnimationPreview?"preview":"editor"} restPose={restPose} cleanAnimationPreview={cleanAnimationPreview}
        workplaneEnabled={workplaneEnabled} restrictions={restrictions} multiple={multipleNodes}
        {...cameraProps}
        onInspectGeoset={inspectGeoset} onHoverGeoset={setViewHoveredGeoset} highlightSelection={!cleanView && preferences.highlightSelection && highlightAppearance.viaView}
        selectedGeoset={activeGeoset} selectionByGeoset={validSelection} visibleGeosets={displayedGeosets} selectableGeosets={selectable}
        onSelectionChange={next=>setSelection(filterVertexSelection(next,selectable,doc.model))} hiddenGeosets={hiddenGeosets} modelPath={session.path}
        mode={cleanView ? 'textured' : viewRenderMode} shaded={shaded} showGrid={cameraPortraitActive ? false : showGrid} showAxes={cameraPortraitActive ? false : showAxes} workplane={workplane}
        backgroundUrl={backgroundLibrary.url} backgroundType={backgroundLibrary.type} onCaptureReady={setCaptureAPI} timelineInterval={[animationDomain.start,animationDomain.end]}
        overlays={cameraPortraitActive ? portraitOverlays : panelOverlays} loop={previewLoop} hoveredGeoset={highlightedFromSelection}
        preferences={preferences} onSensitivityChange={changeSensitivity} onPointerSensitivityChange={changePointerSensitivity} onCameraModeToggle={toggleMiddleCamera}
        suspended={previewSuspended} key={session.id} model={previewModel} revision={doc.revision}
        sequenceIndex={sequence} time={time} playbackSpeed={playbackSpeed} playing={playing} onTimeChange={setTime} onPlayingChange={setPlaying}
        teamColor={teamColor} textureAssets={session.assets} view={cameraPortraitActive ? portraitView : view} cameraMode={cameraMode}
        poseConfig={rigWorkspace && !restPose && !activePortrait ? poseConfig : null} poseDocumentModel={model} onPoseSelect={selectPose} onPosePin={pinPose} onPoseCommit={commitPose}
        portraitMode={activePortrait} portraitSettings={portraitSettings} onPortraitPreviewChange={setPortraitPreviewChanged} onPortraitLightingStatus={setPortraitLightingStatus} controlModel={controlsWholeModel(selectedNodeIds)} portraitCameraIndex={portraitCameraIndex} portraitSnapRevision={portraitSnapRevision}
        liveMovementRevision={liveMovementRevision.current} playbackRange={inspectingMotion ? motion.focus : null} globalSeqId={globalSeqId}
        selectedNodeIds={selectedNodeIds} onSelectNodes={ids=>{if(animationPanel==='animations')setMaterialVisibility(null);setSelectedNodeIds(ids);}}
        onNodeTransform={doc.readOnly || saving || sharedMotionChannel || !rigWorkspace ? undefined : moveNodes}
        showNodes={showNodes} showParticles={overlays.particles} transformMode={rigWorkspace ? movementMode : 'select'} transformSpace={movementSpace} /></Suspense>}

    </section>{mode !== 'uv' && mode !== 'paint' && mode !== 'showcase' && <aside className="classic-sidebar">
      <SidebarResizer/>
      {cameraRotating && !activePortrait && cameraPanel}
      {!rigWorkspace && mode !== 'animation' && !cameraRotating && <VertexTools {...{
        cameraRotating, centroid, commandEnabled, deleteSelectedNode, editable, hiddenCount, lockedVertexPlane,
        meshAction, mode, moveNodes, preferences, selectedFaces, selectedNodeIds, selectionCount, selectMode,
        setDialog, setWorkplane, setWorkplaneEnabled, setWorkTool, tool, totalFaces, totalVertices, transform,
        uvAction, validSelection, vertexNodeCenter, workplane, workplaneEnabled
      }}/>}
      <RigSidebar {...{
        activePortrait, animationPanel, attachSourceIds, beginAttach, bindSelectedVertices, boneCreateOpen,
        cameraGesture, controlsWholeModel, createBoneOrAttachment, deleteSelectedNode, detachSelectedNode, Dialog, openAttachemator,
        doc, edit, geosetPicker, globalSeqId, materialVisibility, mode, model, movementControllerProps, multipleNodes,
        parentedRigNodes, renameSelectedNode, saving, selectable, selectedBone, selectedNodeIds, selectedRigNodes,
        selectionCount, selectTimeline, sequence, session, setBoneCreateOpen, setMaterialVisibility, setPlaying,
        setSelectedBoneBillboarded, setSelectedNodeIds, setTime, singleRigNode, time
      }}/>
      {mode === 'vertices' && !cameraRotating && <div className="classic-geoset-operations"><button disabled={!editable || !selectionCount} onClick={() => separateSelectedGeosets(false)}>Seperate by Loose parts</button><button disabled={!editable || !selectionCount} onClick={() => separateSelectedGeosets(true)}>Nuclear Seperation</button><button disabled={!editable || !selectionCount} onClick={mergeSelectedGeosets}>Merge Geosets</button><button disabled={!editable || !!normalizer} title="Recalculate normals from the faces, like Model Studio. The vertex count never changes. With vertices selected, only those change." onClick={beginNormalizer}>NormalsXL</button><button disabled={!editable || !selectable.size} onClick={deleteSelectedGeosetFreeVertices}>Delete free vertices</button></div>}
      {(mode === 'vertices' || mode === 'bones') && grabThroughToggle}
      {(mode !== 'animation' || animationPanel === 'movement' || cameraGesture) && geosetPicker}
      {rigWorkspace && (mode === 'bones' || boundBoneIds.length > 0) && bindingPanel}
    </aside>}</main>
    {mode==='animation' && timeline}
    <div className="classic-status" role="status"><span key={statusAlert || 'status'} data-alert={statusAlert && !saving ? '' : undefined}>{saving ? 'Saving…' : status}</span><span>{doc.dirty || hasUVPreview || hasTrackDrafts ? 'Modified · ' : hasPaintChanges ? 'Paint preset unsaved · ' : ''}{activePortrait ? `Human UI portrait simulation · ${model.Cameras?.[portraitCameraIndex]?.Name || 'no camera'}` : mode === 'showcase' ? 'Showcase · Classic SD' : mode === 'paint' ? paintMessage('paint.hint') : mode === 'vertices' ? 'Vertex editor (F1)' : mode === 'uv' ? 'UV editor (F2)' : mode === 'bones' ? 'Bones · Rest pose' : animationPanel === 'movement' ? 'Movement (F3)' : 'Animations'}</span></div>
    <AppDialogs {...{
      Dialog, activeGeoset, anchor, changeGameDataSource, changeOverlay, changePreferences, chooseSets,
      clearGameData, clearRecent, completePortraitSetup, context, convertToSD, dialog, doc, edit, editable,
      forgeItem, gameData, gameDataPath, gameDataSources, geosetTab, grabThrough, historyMB, historySteps,
      importPart, latest, leaveGeosetVisible, leaveVisibleAvailable, meshAction, mode, model, normalAngle, notice,
      openLibrary, openParticles, openRecent, paste, preferences, quadView, recentFiles, recoveries, refresh,
      removeSession, resolveGeosetMerge, restoreRecovery, save, saveDataChoice, saveSessionWork, saving, say,
      selectAnimationPanel, selectManagerTextureFiles, selectMode, selectSequence, selectable, selectedNodeIds,
      sequence, session, setActiveGeoset, setAnchor, setDialog, setHidden, setHistoryMB, setHistorySteps,
      setMaterialVisibility, setMissingPortraitCamera, setNormalAngle, setNotice, setPlaying, setSaveDataChoice,
      setSelectable, setSelectedNodeIds, setSelection, setSettingsTab, setTime, setUvSet, setView,
      settings, settingsTab, tabVisibleGeosets, teamColor, textureLibraryDialog, time, tool, undo, updates,
      validSelection, view, visibleOnly, workplane, workplaneEnabled
    }}/>
    <PressedKeys enabled={preferences.showPressedKeys}/>
  </div></HotkeysProvider>;
}
