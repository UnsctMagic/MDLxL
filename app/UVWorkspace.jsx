import MaterialProperties from './MaterialProperties.jsx';
import React, { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UVWindowTools } from './UVWindow.jsx';
import UVEditor from './UVEditor.jsx';
import useStoredState from './useStoredState.js';
import { createFrameCoalescer } from './viewport-performance.js';
import MeshDensitySlider from './MeshDensitySlider.jsx';
import { selectedDensityTriangles } from '../src/mesh-density.js';
import { combineSelectedUVGeosets, mirrorCopyUVCoordinates, otherUVMaterials, projectUVFromView, relaxUVCoordinates, relevantUVMaterials, splitSelectedUVGeosets, straightenUVCoordinates } from '../src/uv-tools.js';
import { boxProjectUVCorners, cylinderProjectUVCorners, planUVCorners, POINT_LIMIT_ERROR, unwrapUVCorners, uvCornerCopies, wholeSelectedTriangles } from '../src/uv-unwrap.js';
import { fitUVs, maskOutline } from '../src/uv-fit.js';
import { magicSelection } from '../src/paint-selection.js';
import { paintMessage } from '../src/paint-messages.js';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { Tool as EditorTool } from './EditorControls.jsx';
import ToolIcon from './ToolIcon.jsx';
import { geosetsHiddenByExtras } from '../src/geoset-extras.js';
import { sampleGeosetAnimation } from '../src/animation.js';
import { vertexRgbPreviewState } from './vertex-rgb-preview.js';
import { uvToolState } from '../src/uv-tool-state.js';
import { hiddenUVPreviewGeosets, normalizeUVPreviewDisplay, previewMeshDomain, uvPreviewOverlay } from '../src/uv-preview-display.js';
import { renderUVMaterialTexture } from './uv-material-preview.js';
import { normalizeUVGrid, UV_GRID_SPACING_MAX, UV_GRID_SPACING_MIN, uvGridSpacingFromSlider, uvGridSpacingSliderValue } from '../src/uv-grid.js';
import { MAX_UV_VIEW_TILE_LIMIT, MIN_UV_VIEW_TILE_LIMIT, normalizeUVViewTileLimit } from '../src/uv-view-limit.js';
import {
  UV_PREVIEW_DEFAULT, UV_PREVIEW_MAX, UV_PREVIEW_MIN,
  UV_SIDE_DEFAULT, UV_SIDE_MAX, UV_SIDE_MIN, clampUVPreviewPercent, clampUVSidePercent,
  uvPreviewPercentAtPointer, uvSidePercentAtPointer,
} from './uv-workspace-layout.js';
import { RangeInput, useDraftNumber } from './Fields.jsx';
import './uv-workspace.css';

const GamePreview = lazy(() => import('./GamePreview.jsx'));
const unique = values => [...new Set(Array.from(values || []).filter(Number.isSafeInteger))];
const selectedCount = value => Object.values(value || {}).reduce((sum, ids) => sum + (ids?.length || 0), 0);
const LAYOUT_KEYS = { side: 'mdlxl.uv.side-percent', preview: 'mdlxl.uv.preview-percent' };
const EMPTY_PREVIEW_RGB = ['', '', ''];
const STANDARD_PROJECTIONS = [['top','Top'],['bottom','Bottom'],['front','Front'],['back','Back'],['left','Side Left'],['right','Side Right']];
const ANGLED_PROJECTIONS = [
  ['top-front-right','Top Front Right'],['top-front-left','Top Front Left'],['top-back-right','Top Back Right'],['top-back-left','Top Back Left'],
  ['bottom-front-right','Bottom Front Right'],['bottom-front-left','Bottom Front Left'],['bottom-back-right','Bottom Back Right'],['bottom-back-left','Bottom Back Left'],
];
const gridSpacingLabel = value => value < 0.01 ? value.toFixed(4) : value < 1 ? value.toFixed(3) : value.toFixed(2);

// The main toolbar's tool button; the UV icons are in ModernIcon's table.
function Tool({ action, icon, label, description, active, disabled, onClick, ...hotkey }) {
  return <EditorTool action={action} icon={`uv_${icon}`} title={label} description={description} active={active} disabled={disabled} onClick={onClick} {...hotkey} className="uv-tool" data-hotkey-category="UV">{label}</EditorTool>;
}

function PreviewRgbField({ channel, icon, value, onCommit, disabled, ...hotkeys }) {
  const label = `Preview RGB ${channel}`;
  const draft = useDraftNumber({ value, onCommit, disabled, parse: text => text });
  return <label>
    <ToolIcon name={icon} className="uv-rgb-channel-icon" size={14}/>
    <input {...hotkeys} aria-label={label} type="number" min="0" max="255" step="1" disabled={disabled} {...draft}/>
  </label>;
}

function UVGridControls({ value, onChange, children }) {
  const [open, setOpen] = useState(false);
  const update = change => onChange({ ...value, ...change });
  return <div className="uv-grid-toolbar" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    {children}
    <button data-hotkey="uv-wrapper:grid" data-hotkey-manual data-hotkey-label="UV grid" type="button" className={value.enabled ? 'active' : ''} aria-pressed={value.enabled} title="Show UV grid" onClick={() => update({ enabled: !value.enabled })}>Grid</button>
    <button data-hotkey="uv-wrapper:snap" data-hotkey-manual data-hotkey-label="UV grid snap" type="button" className={value.snap ? 'active' : ''} aria-pressed={value.snap} title="Snap a dragged vertex or coincident vertex stack to grid crossings" onClick={() => update({ snap: !value.snap })}>Snap</button>
    <label className="uv-grid-size"><span>Size</span><RangeInput data-hotkey="uv-wrapper:uv-grid-size" data-hotkey-manual data-hotkey-label="UV grid size" aria-label="UV grid size" min={Math.log10(UV_GRID_SPACING_MIN)} max={Math.log10(UV_GRID_SPACING_MAX)} step="0.01" value={uvGridSpacingSliderValue(value.spacing)} onChange={event => update({ spacing: uvGridSpacingFromSlider(event.target.value) })}/><output>{gridSpacingLabel(value.spacing)}</output></label>
    <button data-hotkey="uv-wrapper:grid-settings" data-hotkey-manual data-hotkey-label="UV grid settings" type="button" aria-haspopup="dialog" aria-expanded={open} title="UV grid settings" onClick={() => setOpen(previous => !previous)}>Settings</button>
    {open && <div className="uv-grid-settings" role="dialog" aria-label="UV grid settings">
      <label><span>Spacing</span><input aria-label="UV grid spacing" type="number" min={UV_GRID_SPACING_MIN} max={UV_GRID_SPACING_MAX} step="0.0001" value={value.spacing} onChange={event => update({ spacing: Number(event.target.value) })}/></label>
      <label><span>Thickness</span><RangeInput aria-label="UV grid thickness" min="0.5" max="6" step="0.25" value={value.thickness} onChange={event => update({ thickness: Number(event.target.value) })}/><output>{value.thickness}px</output></label>
      <label><span>Color</span><input aria-label="UV grid color" type="color" value={value.color} onChange={event => update({ color: event.target.value })}/></label>
      <label><span>Opacity</span><RangeInput aria-label="UV grid opacity" min="0" max="1" step="0.05" value={value.opacity} onChange={event => update({ opacity: Number(event.target.value) })}/><output>{Math.round(value.opacity * 100)}%</output></label>
    </div>}
  </div>;
}

function Splitter({ orientation, label, value, minimum, maximum, defaultValue, onPointerValue, onValue }) {
  // A drag records the pointer; the resize (and its saved layout) applies once per frame. Keys stay immediate.
  const pointer = useRef(null), point = useRef(null), report = useRef(onPointerValue), frame = useRef(null), vertical = orientation === 'vertical';
  report.current = onPointerValue;
  frame.current ||= createFrameCoalescer(() => { if (point.current) report.current(point.current); });
  useEffect(() => () => frame.current.cancel(), []);
  const stop = event => {
    if (pointer.current !== event.pointerId) return;
    frame.current.flush(); // cancel too: the splitter keeps where it was dragged, as before
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = event => {
    let next;
    if (event.key === 'Home') next = minimum;
    else if (event.key === 'End') next = maximum;
    else if (vertical && event.key === 'ArrowLeft') next = value + 2;
    else if (vertical && event.key === 'ArrowRight') next = value - 2;
    else if (!vertical && event.key === 'ArrowUp') next = value - 2;
    else if (!vertical && event.key === 'ArrowDown') next = value + 2;
    if (next === undefined) return;
    event.preventDefault(); onValue(next);
  };
  return <div className={`uv-splitter uv-splitter-${vertical ? 'column' : 'row'}`} role="separator" aria-label={label} aria-orientation={orientation}
    aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={Math.round(value)} tabIndex={0} title={`${label} · drag or use arrow keys · double-click to reset`}
    onDoubleClick={() => onValue(defaultValue)} onKeyDown={keyDown}
    onPointerDown={event => { pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); event.preventDefault(); }}
    onPointerMove={event => { if (pointer.current === event.pointerId) { point.current = { clientX: event.clientX, clientY: event.clientY }; frame.current.schedule(); event.preventDefault(); } }} onPointerUp={stop} onPointerCancel={stop}><span/></div>;
}

export default function UVWorkspace({ model: sourceModel, materialModel: suppliedMaterialModel, previewModel: suppliedPreviewModel, revision = 0, activeGeoset = -1, eligibleSelection: suppliedEligibleSelection = {}, selectionByGeoset: suppliedSelectionByGeoset = {}, onSelectionChange,
  onPreviewSelectionChange, onUVChanges, onUVCorners, onPreviewChanges, onUncouple, onGeosetChange, onWrappingChange, onMaterialPreset, onMaterialAssign, textureAssets, teamColor, preferences, onPreferences,
  draftCount = 0, onLibrary, onSavePreview, onRevertPreview, previewProps, readOnly = false, suspended = false, onDensityApply, onExit, rgbPreview = true, rgbSequence = -1, onRgbPreview, sketchDocument = null }) {
  const [materialID, setMaterialID] = useState(null), [uvTool, setUVTool] = useState('select'), [axis, setAxis] = useState(null), [foldDirection, setFoldDirection] = useState('right-to-left');
  const [showOnlySelected, setShowOnlySelected] = useState(false), [hideRGB, setHideRGB] = useState(false), [showVerticles, setShowVerticles] = useState(false), [grabThrough, setGrabThrough] = useState(true), [showLines, setShowLines] = useState(true);
  const [previewRgb, setPreviewRgb] = useState(EMPTY_PREVIEW_RGB);
  const commitPreviewRgb = (index, value) => {
    setPreviewRgb(previous => previous.map((part, i) => i === index ? value : part));
    setHideRGB(false);
    // A cleared box goes back to showing the model's own value.
    return value === '' ? false : undefined;
  };
  const [hideExtras, setHideExtras] = useState(false);
  const [projectionPreset, setProjectionPreset] = useState({ name: 'front', revision: 0, fit: true });
  const [scrollSensitivity, setScrollSensitivity] = useState(1.3);
  const [materialPreview, setMaterialPreview] = useState(null), [materialError, setMaterialError] = useState('');
  const [sidePercent, setSidePercent] = useStoredState(LAYOUT_KEYS.side, UV_SIDE_DEFAULT, clampUVSidePercent);
  const [previewPercent, setPreviewPercent] = useStoredState(LAYOUT_KEYS.preview, UV_PREVIEW_DEFAULT, clampUVPreviewPercent);
  const [densityOpen, setDensityOpen] = useState(false), [densityValue, setDensityValue] = useState(0), [densityResult, setDensityResult] = useState(null);
  // Fit: while marking, the map's left button marks an area (Citadel Paint's polygon lasso, freehand
  // lasso and magic wand); Fit again (or Enter) lays the selection into it, or tidies it in place
  // when no area is marked.
  const [marking, setMarking] = useState(null), [fitTolerance, setFitTolerance] = useState(32), markPress = useRef(null);
  const projectionView = useRef(null), workspaceBody = useRef(null), sidePanel = useRef(null), titleBar = useContext(UVWindowTools);
  const activePreviewPercent = previewPercent;
  const baseMaterialModel = suppliedMaterialModel || sourceModel, basePreviewModel = suppliedPreviewModel || sourceModel;
  const densitySelectionKey = JSON.stringify(suppliedSelectionByGeoset), densityEligibilityKey = JSON.stringify(suppliedEligibleSelection);
  const densityTargets = useMemo(() => Object.entries(suppliedSelectionByGeoset).map(([index, ids]) => {
    const eligible = new Set(suppliedEligibleSelection[index]);
    return { index: Number(index), geoset: sourceModel.Geosets[index], selectedVertices: unique(ids).filter(id => eligible.has(id)) };
  }).filter(target => target.geoset && selectedDensityTriangles(target.geoset, target.selectedVertices).length), [sourceModel, revision, densitySelectionKey, densityEligibilityKey]);
  const densityChanges = densityOpen ? densityResult?.changes : null;
  const replaceDensityGeoset = source => {
    if (!source || !densityChanges) return source;
    const next = { ...source, Geosets: source.Geosets.slice() };
    for (const change of densityChanges) next.Geosets[change.index] = change.geoset;
    return next;
  };
  const model = useMemo(() => replaceDensityGeoset(sourceModel), [sourceModel, densityChanges]);
  const materialModel = useMemo(() => replaceDensityGeoset(baseMaterialModel), [baseMaterialModel, densityChanges]);
  const previewModel = useMemo(() => replaceDensityGeoset(basePreviewModel), [basePreviewModel, densityChanges]);
  const eligibleSelection = densityChanges ? { ...suppliedEligibleSelection, ...Object.fromEntries(densityChanges.map(change => [change.index, unique([...(suppliedEligibleSelection[change.index] || []), ...change.selectedVertices])])) } : suppliedEligibleSelection;
  const selectionByGeoset = densityChanges ? { ...suppliedSelectionByGeoset, ...Object.fromEntries(densityChanges.map(change => [change.index, change.selectedVertices])) } : suppliedSelectionByGeoset;
  const editingLocked = readOnly || densityOpen || suspended;
  const selectionKey = JSON.stringify(selectionByGeoset), eligibilityKey = JSON.stringify(eligibleSelection);
  const previewDomain = useMemo(() => previewMeshDomain(model), [model, revision]);
  const materialEntries = useMemo(() => relevantUVMaterials(materialModel, eligibleSelection), [materialModel, revision, eligibilityKey]);
  const current = materialEntries.find(entry => entry.materialID === materialID) || materialEntries[0] || null;
  // Labels come from the document, so an unsaved test texture never names a material it isn't saved on.
  const assignableMaterials = useMemo(() => current && !editingLocked ? otherUVMaterials(model, current.geosetIndices, materialEntries.map(entry => entry.materialID)) : [], [model, revision, materialEntries, current?.materialID, editingLocked]);
  const materialOptions = [...materialEntries, ...assignableMaterials].sort((a, b) => a.materialID - b.materialID);
  const imageLayers = (current?.layers || []).filter(({ texture }) => texture && !texture.ReplaceableId && texture.Image?.trim());
  const wrappingEnabled = imageLayers.length > 0 && imageLayers.every(({ texture }) => (texture.Flags & 3) === 3);
  // UV drags keep the renderer alive; material, texture and point-count changes must reload it (tools that
  // add point copies change the model in place, and a light UV update cannot draw new points).
  const previewWrappingRevision = JSON.stringify({ materials: previewModel?.Materials, textures: previewModel?.Textures, geosetMaterials: previewModel?.Geosets?.map(geoset => geoset.MaterialID), density: densityChanges?.map(change => [change.index, change.geoset.Faces.length]) || [], points: previewModel?.Geosets?.map(geoset => [geoset.Vertices?.length, geoset.Faces?.length]) });

  useEffect(() => { setDensityOpen(false); setDensityValue(0); setDensityResult(null); }, [revision]);

  useEffect(() => {
    if (!current) { setMaterialID(null); return; }
    if (materialID !== current.materialID) setMaterialID(current.materialID);
  }, [current?.materialID, materialID]);

  const allSelected = useMemo(() => Object.fromEntries(Object.entries(selectionByGeoset).map(([index, ids]) => [index, unique(ids).filter(id => eligibleSelection[index]?.includes(id))])), [selectionKey, eligibilityKey]);
  const allEligible = useMemo(() => Object.fromEntries(materialEntries.flatMap(entry => entry.geosetIndices.map(index => {
    const uv = model.Geosets[index]?.TVertices?.[entry.coordId] || [];
    return [index, (previewDomain[index] || []).filter(id => id * 2 + 1 < uv.length && Number.isFinite(uv[id * 2]) && Number.isFinite(uv[id * 2 + 1]))];
  }))), [materialEntries, model, previewDomain]);
  const combined = useMemo(() => combineSelectedUVGeosets(model, eligibleSelection, allSelected, materialEntries),
    [model, revision, eligibilityKey, selectionKey, materialEntries]);
  const materialSignature = current ? JSON.stringify({ material: materialModel.Materials?.[current.materialID], textures: current.layers.map(layer => layer.texture) }) : '';

  useEffect(() => {
    let cancelled = false;
    if (!current || !preferences?.graphics?.textures) { setMaterialError(''); setMaterialPreview(null); return; }
    // Keep the previous texture and its warning until this render settles, so a
    // slow decode never blanks the map or shifts the workspace under the pointer.
    renderUVMaterialTexture(materialModel, current.materialID, textureAssets, { teamColor, restPose: true }).then(value => { if (!cancelled) { setMaterialError(''); setMaterialPreview(value); } }).catch(cause => { if (!cancelled) { setMaterialPreview(null); setMaterialError(cause.message); } });
    return () => { cancelled = true; };
  }, [current?.materialID, materialSignature, textureAssets, teamColor, preferences?.graphics?.textures]);

  const display = normalizeUVPreviewDisplay(preferences?.uvPreviewDisplay), uvGrid = normalizeUVGrid(preferences?.uvGrid), liveView = display.mesh === 'selected';
  const selectedGeosets = Object.keys(eligibleSelection).filter(index => eligibleSelection[index]?.length).map(Number);
  const rgbTarget = selectedGeosets.includes(activeGeoset) ? activeGeoset : selectedGeosets[0] ?? -1;
  const rgbOverride = useMemo(() => {
    if (rgbTarget < 0) return null;
    const channels = previewRgb.map(value => {
      const number = Number(value);
      return value !== '' && Number.isInteger(number) && number >= 0 && number <= 255 ? number / 255 : null;
    });
    return channels.some(value => value !== null) ? { geosetIndex: rgbTarget, channels } : null;
  }, [previewRgb, rgbTarget]);
  // The model's RGB as the Vertex editor's RGB Preview shows it: many models keep it only in their
  // animations, so it is sampled from the RGB sequence's first frame, not from the rest pose.
  const geosetRgb = useMemo(() => {
    const state = vertexRgbPreviewState(previewModel, { enabled: true, sequenceIndex: rgbSequence });
    return (previewModel.Geosets || []).map((_, index) => Array.from(sampleGeosetAnimation(previewModel, index, state.frame, state.sequenceIndex, state.globalTime).color));
  }, [previewModel, rgbSequence, revision]);
  const previewGeosetRgb = useMemo(() => rgbPreview ? geosetRgb : geosetRgb.map(() => [1, 1, 1]), [geosetRgb, rgbPreview]);
  // The boxes show the active geoset's own RGB; a typed value only previews.
  const modelRgb = rgbTarget < 0 || !geosetRgb[rgbTarget] ? EMPTY_PREVIEW_RGB
    : geosetRgb[rgbTarget].map(value => String(Math.round(Math.max(0, Math.min(1, value)) * 255)));
  const shownRgb = previewRgb.map((value, index) => value !== '' ? value : modelRgb[index]);
  // As in the Vertex editor, decide which geosets are extras when toggled or when the geoset count changes.
  const extraGeosets = useMemo(() => hideExtras ? geosetsHiddenByExtras(sourceModel) : null, [hideExtras, sourceModel.Geosets.length]);
  const hiddenPreviewGeosets = useMemo(() => hiddenUVPreviewGeosets(model, eligibleSelection, showOnlySelected, extraGeosets),
    [model.Geosets.length, eligibilityKey, showOnlySelected, extraGeosets]);
  // UV-grid and UV-drag preferences belong only to the 2D texture canvas. Keep
  // the 3D renderer's preference object stable while one of them is adjusted.
  const uvPreferences = { ...(preferences || {}), scrollSensitivity };
  const previewPreferencesInput = { ...uvPreferences }; delete previewPreferencesInput.uvGrid; delete previewPreferencesInput.uvDrag; delete previewPreferencesInput.uvEachPiece;
  const previewPreferencesKey = JSON.stringify(previewPreferencesInput);
  const previewPreferences = useMemo(() => previewPreferencesInput, [previewPreferencesKey]);
  const liveOverlay = showVerticles
    ? { allMesh: true, interactiveSelection: true, highlightSelection: false, grabThrough, showLines, size: display.size, color: preferences?.visuals?.uvSelection, eligibleByGeoset: allEligible, selectionByGeoset: allSelected }
    : uvPreviewOverlay(previewDomain, allSelected, null, { ...display, mesh: liveView ? 'selected' : 'none' }, preferences?.visuals?.uvSelection);

  const dispatch = (kind, value) => window.dispatchEvent(new CustomEvent('mdlvis-uv-action', { detail: { kind, value } }));
  const chooseMaterial = value => {
    const id = Number(value), entry = materialOptions.find(item => item.materialID === id); setMaterialID(id); setUVTool('select'); onPreviewChanges?.(null);
    if (assignableMaterials.includes(entry)) onMaterialAssign?.(entry.geosetIndices, id);
    if (entry?.geosetIndices.length) onGeosetChange?.(entry.geosetIndices[0], entry.coordId);
  };
  const selectCombined = ids => {
    if (!combined) return;
    const chosen = new Set(ids), next = { ...selectionByGeoset };
    for (const index of Object.keys(eligibleSelection)) next[index] = [];
    combined.refs.forEach((ref, index) => { if (chosen.has(index)) (next[ref.geosetIndex] ||= []).push(ref.vertexIndex); });
    onSelectionChange?.(next);
  };
  const applyCombined = (values, preview = false, label = 'Edit UV coordinates') => {
    if (!combined || editingLocked) return;
    const changes = splitSelectedUVGeosets(model, combined.refs, values);
    (preview ? onPreviewChanges : onUVChanges)?.(changes, label);
  };
  const triangleCount = useMemo(() => combined ? wholeSelectedTriangles(combined.geoset.Faces, combined.selectedVertices).length : 0, [combined]);
  const toolState = uvToolState({ readOnly: editingLocked, selectionCount: selectedCount(allSelected), draftCount, eligibleCount: combined?.eligibleVertices.length || 0, triangleCount });
  useEffect(() => {
    const body = workspaceBody.current;
    if (!body) return;
    const trackPointer = event => {
      body.dataset.pointerRegion = event.target.closest('.uv-live-preview') ? 'preview' :
        event.target.closest('.uv-map-pane') ? 'map' : '';
    };
    const clearPointer = () => { body.dataset.pointerRegion = ''; };
    body.addEventListener('pointermove', trackPointer, true);
    body.addEventListener('pointerdown', trackPointer, true);
    body.addEventListener('pointerleave', clearPointer);
    return () => {
      body.removeEventListener('pointermove', trackPointer, true);
      body.removeEventListener('pointerdown', trackPointer, true);
      body.removeEventListener('pointerleave', clearPointer);
    };
  }, []);
  useEffect(() => {
    const action = event => {
      const { kind, value } = event.detail || {};
      if (kind === 'tool' && ['select','move','rotate','scale'].includes(value)) setUVTool(value);
      if (kind === 'uncouple' && toolState.uncouple) onUncouple?.(Object.fromEntries(Object.entries(allSelected).filter(([, ids]) => ids.length)), Object.fromEntries(materialEntries.flatMap(entry => entry.geosetIndices.map(index => [index, entry.coordId]))));
    };
    window.addEventListener('mdlvis-uv-action', action);
    return () => window.removeEventListener('mdlvis-uv-action', action);
  }, [toolState.uncouple, selectionKey, materialEntries, onUncouple]);
  const project = () => {
    const view = projectionView.current; if (!view || editingLocked || !selectedCount(allSelected)) return;
    try {
      applyCombined(projectUVFromView(combined.geoset, combined.selectedVertices, view.viewMatrix, view.projectionMatrix), false, 'Project UVs from model view');
    } catch (cause) { setMaterialError(cause.message); }
  };
  // Box, Cylinder, Straighten, Mirror Copy, Unwrap and Relax: a refused tool explains itself on the
  // warning line, and the next tool that works clears that explanation again.
  const toolError = useRef('');
  const runTool = work => {
    if (!combined || editingLocked) return;
    try {
      work();
      const shown = toolError.current; toolError.current = '';
      if (shown) setMaterialError(previous => previous === shown ? '' : previous);
    } catch (cause) { toolError.current = cause.message; setMaterialError(cause.message); }
  };
  // Tools that give each triangle corner its own UV; the App adds point copies where a point needs two.
  const projectCorners = (label, corners) => runTool(() => {
    const view = projectionView.current;
    const plans = planUVCorners(combined, corners(combined.geoset, combined.selectedVertices, view?.viewMatrix, view?.projectionMatrix, combined.geoset.TVertices[0]));
    for (const plan of plans) if (model.Geosets[plan.geosetIndex].Vertices.length / 3 + uvCornerCopies(model.Geosets[plan.geosetIndex], plan.corners) > 65536) throw Error(POINT_LIMIT_ERROR);
    onUVCorners?.(plans, label);
  });
  const moveUVs = (label, next) => runTool(() => applyCombined(next(combined.geoset.TVertices[0]), false, label));
  const fitAspect = materialPreview?.width > 0 && materialPreview?.height > 0 ? materialPreview.width / materialPreview.height : 1;
  const applyFit = () => {
    const area = marking?.area || (marking?.mode === 'polygon' && marking.points.length >= 3 ? marking.points : null);
    setMarking(null);
    if (!area) return;
    // Fit moves the existing UV points only: the same points and triangles, nothing cut or added.
    const view = projectionView.current;
    moveUVs('Fit', source => fitUVs(combined.geoset, combined.selectedVertices, view?.viewMatrix, view?.projectionMatrix, source, area, fitAspect));
  };
  const fitPress = () => { if (marking) applyFit(); else { setMaterialError(''); setMarking({ mode: 'polygon', points: [], area: null }); } };
  const fitMode = mode => setMarking(previous => previous && { ...previous, mode, points: [] });
  const markingHandlers = marking && {
    ...marking,
    onDown: ({ uv, detail, sizeX, sizeY, raster }) => {
      markPress.current = { sizeX, sizeY };
      if (marking.mode === 'wand') {
        const image = raster();
        if (!image) { setMaterialError('The magic wand needs the texture picture.'); return; }
        const tileU = Math.floor(uv[0]), tileV = Math.floor(uv[1]);
        const mask = magicSelection(image, (uv[0] - tileU) * image.width, (uv[1] - tileV) * image.height, fitTolerance, true), outline = maskOutline(mask, image.width, image.height);
        setMarking(previous => previous && { ...previous, points: [], area: outline ? outline.map(([x, y]) => [tileU + x / image.width, tileV + y / image.height]) : null });
        return;
      }
      if (marking.mode === 'lasso') { setMarking(previous => previous && { ...previous, points: [uv], area: null }); return; }
      setMarking(previous => {
        if (!previous) return previous;
        const points = previous.area ? [] : previous.points, first = points[0];
        // The first point (or a double click) closes the polygon, as in Citadel Paint.
        if (points.length >= 3 && (detail === 2 || Math.hypot((uv[0] - first[0]) * sizeX, (uv[1] - first[1]) * sizeY) <= 9)) return { ...previous, points: [], area: points };
        return detail === 2 ? previous : { ...previous, points: [...points, uv], area: null };
      });
    },
    onMove: ({ uv }) => {
      if (marking.mode !== 'lasso') return;
      const press = markPress.current;
      setMarking(previous => {
        const last = previous?.points.at(-1);
        if (!previous || !last || Math.hypot((uv[0] - last[0]) * press.sizeX, (uv[1] - last[1]) * press.sizeY) < 1) return previous;
        return { ...previous, points: [...previous.points, uv] };
      });
    },
    onUp: () => { if (marking.mode === 'lasso') setMarking(previous => previous && (previous.points.length >= 3 ? { ...previous, points: [], area: previous.points } : { ...previous, points: [] })); },
  };
  // Enter fits (or closes a polygon in progress), Backspace removes the last corner, Esc cancels.
  useWindowKeyClaim(({ event }) => {
    if (!marking || event.target?.matches?.('input, select, textarea')) return false;
    if (event.key === 'Enter') { if (marking.mode === 'polygon' && marking.points.length >= 3 && !marking.area) setMarking(previous => ({ ...previous, points: [], area: previous.points })); else applyFit(); return true; }
    if (event.key === 'Backspace' && marking.mode === 'polygon' && marking.points.length) { setMarking(previous => ({ ...previous, points: previous.points.slice(0, -1) })); return true; }
    return false;
  }, 5);
  useEffect(() => {
    if (!marking) return;
    const escape = event => { event.preventDefault(); setMarking(previous => previous?.points.length ? { ...previous, points: [] } : null); };
    window.addEventListener('mdlxl-escape-key', escape);
    return () => window.removeEventListener('mdlxl-escape-key', escape);
  }, [!!marking]);
  useEffect(() => { if (editingLocked || !toolState.fit) setMarking(null); }, [editingLocked, toolState.fit]);
  const chooseProjectionPreset = name => { if (name) setProjectionPreset(previous => ({ name, revision: previous.revision + 1 })); };
  const setActivePreviewPercent = value => setPreviewPercent(clampUVPreviewPercent(value));
  const changeLiveDisplay = change => onPreferences?.({ ...preferences, uvPreviewDisplay: { ...preferences?.uvPreviewDisplay, ...display, ...change } });
  const changeLiveColor = color => onPreferences?.({ ...preferences, visuals: { ...preferences.visuals, uvSelection: color } });
  const changeUVGrid = value => onPreferences?.({ ...preferences, uvGrid: value });
  const viewTileLimit = normalizeUVViewTileLimit(preferences?.uvViewTileLimit);
  const changeViewTileLimit = value => onPreferences?.({ ...preferences, uvViewTileLimit: normalizeUVViewTileLimit(value) });

  // The map and texture controls live in the window's title bar, which leaves the whole left column to the map.
  const titleTools = <><UVGridControls value={uvGrid} onChange={changeUVGrid}>
        <button data-hotkey="uv-wrapper:wrap" data-hotkey-manual data-hotkey-label="Wrap U and V" type="button" disabled={editingLocked || !onWrappingChange || !imageLayers.length}
          title="Toggle Wrap U and Wrap V for this material's image textures. Applies to all uses of these textures."
          onClick={() => onWrappingChange?.([...new Set(imageLayers.map(layer => layer.textureID))], !wrappingEnabled)}>{wrappingEnabled ? 'Disable Wrapping' : 'Enable Wrapping'}</button>
        <button data-hotkey="uv-wrapper:triangles" data-hotkey-manual data-hotkey-label="Triangles" type="button" aria-haspopup="dialog" aria-expanded={densityOpen} disabled={readOnly || !densityTargets.length || !onDensityApply} title="Make selected UV triangles more or less dense" onClick={() => { setDensityOpen(value => !value); setDensityValue(0); setDensityResult(null); }}>Triangles</button>
        <label className="uv-view-limit" title="Maximum texture tiles visible while zooming out"><span>View</span><input data-hotkey="uv-wrapper:uv-map-tile-limit" data-hotkey-manual data-hotkey-label="UV map tile limit" aria-label="UV map tile limit" type="number" min={MIN_UV_VIEW_TILE_LIMIT} max={MAX_UV_VIEW_TILE_LIMIT} step="1" value={viewTileLimit} onChange={event => changeViewTileLimit(event.target.value)}/><output>×{viewTileLimit}</output></label>
      </UVGridControls></>;
  return <div className="uv-workspace" aria-label="UV wrapper workspace">
    {titleBar ? createPortal(titleTools, titleBar) : <div className="uv-workspace-tools">{titleTools}</div>}
    <div ref={workspaceBody} className="uv-workspace-body" style={{ '--uv-side-width': `${sidePercent}%` }}>
      <section className="uv-map-pane" aria-label="UV texture map">
        {/* Floats over the map so a warning never pushes the workspace down. */}
        {(materialError || materialPreview?.warnings?.length > 0) && <div className="uv-workspace-warning" role="status" data-alert="">{materialError || materialPreview.warnings.join(' · ')}</div>}
        {densityOpen && <div className="uv-density-popup" role="dialog" aria-modal="false" aria-label="Triangle density"><strong>{densityTargets.length === 1 ? `Geoset ${densityTargets[0].index + 1} triangle density` : 'Triangle density'}</strong><MeshDensitySlider compact targets={densityTargets} value={densityValue} onChange={value => { setDensityValue(value); setDensityResult(null); }} onResult={setDensityResult}/><div><button onClick={() => { setDensityOpen(false); setDensityValue(0); setDensityResult(null); }}>Cancel</button><button className="primary" disabled={!densityValue || !densityResult || densityResult.trianglesAfter === densityResult.trianglesBefore} onClick={() => { const changes = densityResult.changes; setDensityOpen(false); setDensityValue(0); setDensityResult(null); onDensityApply(changes); }}>Apply</button></div></div>}
        {combined?.eligibleVertices.length ? <UVEditor key="selected-geosets" wrapperControls sketchDocument={sketchDocument} sketchRefs={combined.refs} geoset={combined.geoset} uvSet={0} revision={revision} textureUrl={materialPreview?.url} textureSize={materialPreview ? [materialPreview.width, materialPreview.height] : undefined} textureWrapping={!imageLayers.length || wrappingEnabled} viewTileLimit={viewTileLimit}
          eligibleVertices={combined.eligibleVertices} selectedVertices={combined.selectedVertices} transformMode={uvTool} cameraMode="work" preferences={uvPreferences} onSensitivityChange={setScrollSensitivity} suspended={editingLocked} axis={axis}
          uvGrid={uvGrid} showTextureFrame={display.textureFrame} textureFrameColor={preferences?.visuals?.uvSelection}
          onSelectVertices={selectCombined} onChange={values => applyCombined(values)} onPreviewChange={values => values ? applyCombined(values, true) : onPreviewChanges?.(null)} marking={markingHandlers || null} />
          : <div className="classic-empty-view">Select textured vertices before opening the UV wrapper.</div>}
        {combined?.eligibleVertices.length > 0 && <button type="button" className="preview-reset-view" aria-label="Reset view" title="Reset view" onClick={() => dispatch('reset-view')}><span aria-hidden="true">↺</span></button>}
        {marking ? <div className="uv-fit-bar" role="toolbar" aria-label="Fit area">
          {['polygon', 'lasso', 'wand'].map(mode => <button key={mode} type="button" aria-pressed={marking.mode === mode} data-hotkey={'uv-fit:' + mode} data-hotkey-manual data-hotkey-label={paintMessage('paint.select.' + mode)} onClick={() => fitMode(mode)}>{paintMessage('paint.select.' + mode)}</button>)}
          {marking.mode === 'wand' && <label>{paintMessage('paint.tolerance')}<RangeInput aria-label="Fit wand tolerance" min="0" max="255" value={fitTolerance} onChange={event => setFitTolerance(+event.target.value)}/>{fitTolerance}</label>}
          <span>{marking.area ? 'Fit or Enter lays the selection into the area. Esc cancels.' : { polygon: 'Click corners. Click the first point or press Enter to finish. Backspace removes a point.', lasso: 'Draw around the patch. Release to close it.', wand: 'Click a color. Tolerance controls how much is selected.' }[marking.mode]}</span>
          <button type="button" onClick={() => setMarking(null)}>Cancel</button>
        </div> : <div className="uv-texture-caption">{materialPreview?.layerCount ? `${current?.label} · ${materialPreview.layerCount} rendered layer${materialPreview.layerCount === 1 ? '' : 's'} · seamless tiled view` : current?.label || 'No material loaded'}</div>}
      </section>
      <Splitter orientation="vertical" label="Resize texture and live-view columns" value={sidePercent} minimum={UV_SIDE_MIN} maximum={UV_SIDE_MAX} defaultValue={UV_SIDE_DEFAULT}
        onValue={value => setSidePercent(clampUVSidePercent(value))} onPointerValue={event => { const rect = workspaceBody.current?.getBoundingClientRect(); if (rect) setSidePercent(uvSidePercentAtPointer(event.clientX, rect)); }}/>
      <aside ref={sidePanel} className="uv-side-panel" style={{ '--uv-preview-height': `${activePreviewPercent}%`, '--uv-selection-color': preferences?.visuals?.uvSelection || '#4cff59' }}>
        <div className="uv-material-controls"><label title="Picks the material for the selected geosets. An unsaved test texture on them is cancelled."><select data-hotkey="uv-wrapper:uv-material" data-hotkey-manual data-hotkey-label="UV material" aria-label="UV material" value={current?.materialID ?? ''} disabled={densityOpen} onChange={event => chooseMaterial(event.target.value)}>{materialOptions.map(entry => <option key={entry.materialID} value={entry.materialID}>{entry.label}</option>)}</select></label><MaterialProperties model={materialModel} materialID={current?.materialID} disabled={editingLocked} onChange={(_, preset, tint) => onMaterialPreset?.(model.Geosets[current.geosetIndices[0]].MaterialID, preset, tint)} compact filterModes/><div className="uv-header-actions"><button data-hotkey="uv-wrapper:replace-texture" data-hotkey-manual data-hotkey-label="Replace Texture…" disabled={editingLocked} onClick={onLibrary}>Replace Texture…</button>{draftCount > 0 && <><button data-hotkey="uv-wrapper:save-texture" data-hotkey-manual data-hotkey-label="Save texture" disabled={editingLocked} onClick={onSavePreview}>Save texture</button><button data-hotkey="uv-wrapper:revert-texture" data-hotkey-manual data-hotkey-label="Revert texture" disabled={editingLocked} onClick={onRevertPreview}>Revert texture</button></>}</div></div>
        <section className="uv-live-options" aria-label="Live view options">
          <div className="uv-live-toggles">
            <label><input data-hotkey="uv-wrapper:highlight-live" data-hotkey-manual data-hotkey-label="Highlight live" aria-label="Highlight selected vertices in live preview" type="checkbox" checked={liveView} onChange={event => changeLiveDisplay({ mesh: event.target.checked ? 'selected' : 'none' })}/>Highlight Live</label>
            <label><input data-hotkey="uv-wrapper:highlight-frame" data-hotkey-manual data-hotkey-label="Highlight texture frame" aria-label="Highlight texture frame" type="checkbox" checked={display.textureFrame} onChange={event => changeLiveDisplay({ textureFrame: event.target.checked })}/>Highlight Texture Frame</label>
          </div>
          <label className="uv-thickness"><span>Thickness</span><RangeInput data-hotkey="uv-wrapper:live-selection-thickness" data-hotkey-manual data-hotkey-label="Live selection thickness" aria-label="Live selection thickness" min="0.25" max="3" step="0.25" value={display.size} onChange={event => changeLiveDisplay({ size: Number(event.target.value) })}/><output>{display.size.toFixed(2)}×</output><input className="uv-color-button" aria-label="Live selection and texture-frame color" title="Choose live selection and texture-frame color" type="color" value={preferences?.visuals?.uvSelection || '#4cff59'} onChange={event => changeLiveColor(event.target.value)}/></label>
        </section>
        <section className="uv-live-preview" aria-label="Live model preview">
          <div className="uv-preview-canvas"><Suspense fallback={<div className="classic-empty-view">Loading preview…</div>}><GamePreview {...previewProps} preferences={previewPreferences} onSensitivityChange={setScrollSensitivity} revision={previewWrappingRevision} uvRevision={revision} presentation="preview" preserveCameraView={true} interactivePreview={!densityOpen && !!current} restPose={true} model={previewModel} sequenceIndex={-1} time={0} playing={false} showParticles={false} previewOverlay={liveOverlay}
            uvOnlySelected={showOnlySelected} uvHideExtras={hideExtras} hiddenGeosets={hiddenPreviewGeosets} hideRgbGeoset={hideRGB && rgbTarget >= 0 ? rgbTarget : null} rgbOverride={rgbOverride} geosetRgb={previewGeosetRgb}
            selectionByGeoset={selectionByGeoset} selectableGeosets={Object.keys(eligibleSelection).map(Number)}
            previewSelectionMode={showVerticles ? 'vertices' : 'polygons'} previewEligibleByGeoset={allEligible}
            onSelectionChange={densityOpen ? undefined : onPreviewSelectionChange}
            view="orthographic" cameraMode="rotate" transformMode="select" cameraPresetRequest={projectionPreset} onProjectionViewChange={value => { projectionView.current = value; }} /></Suspense></div>
          <div className="uv-preview-footer">
            <button data-hotkey="uv-wrapper:live-select" data-hotkey-manual data-hotkey-label="Live Select" aria-label="Live Select" aria-pressed={showVerticles} disabled={!current} onClick={() => setShowVerticles(value => !value)}>Live Select</button>{showVerticles && <><button data-hotkey="uv-wrapper:lines" data-hotkey-manual data-hotkey-label="Lines" aria-label="Lines" aria-pressed={showLines} title="Show the lines between vertices. Turn off to see only the vertex dots when the mesh gets cluttered." onClick={() => setShowLines(value => !value)}>Lines</button><button data-hotkey="uv-wrapper:grabthrough" data-hotkey-manual data-hotkey-label="Grabthrough" aria-label="Grabthrough" aria-pressed={grabThrough} title="On: pick vertices straight through the model, including ones hidden behind it. Off: pick only the vertices you can see." onClick={() => setGrabThrough(value => !value)}>Grabthrough</button></>}<button data-hotkey="uv-wrapper:selected-only" data-hotkey-manual data-hotkey-label="Selected Only" aria-label="Selected Only" aria-pressed={showOnlySelected} disabled={!selectedGeosets.length} onClick={() => setShowOnlySelected(value => !value)}>Selected Only</button><button data-hotkey="uv-wrapper:hide-rgb" data-hotkey-manual data-hotkey-label="Hide RGB" aria-pressed={hideRGB} disabled={rgbTarget < 0} onClick={() => setHideRGB(value => !value)}>Hide RGB</button>
            <div className="uv-preview-appearance">
              <div className="uv-preview-rgb" role="group" aria-label="Preview RGB" title="The active geoset’s RGB (0–255). Change a value to preview a different RGB; the model is not changed.">
                <button type="button" data-hotkey="uv-wrapper:preview-rgb" data-hotkey-manual data-hotkey-label="Preview RGB" aria-pressed={rgbPreview}
                  title="Shows the whole model’s RGB in the preview, like the RGB switch in Vertices." onClick={onRgbPreview}>Preview RGB</button>
                <span>Test RGB</span>
                <PreviewRgbField channel="R" icon="rgbRed" value={shownRgb[0]} disabled={rgbTarget < 0}
                  data-hotkey="uv-wrapper:preview-rgb-red" data-hotkey-manual data-hotkey-label="Preview RGB R" onCommit={value => commitPreviewRgb(0, value)}/>
                <PreviewRgbField channel="G" icon="rgbGreen" value={shownRgb[1]} disabled={rgbTarget < 0}
                  data-hotkey="uv-wrapper:preview-rgb-green" data-hotkey-manual data-hotkey-label="Preview RGB G" onCommit={value => commitPreviewRgb(1, value)}/>
                <PreviewRgbField channel="B" icon="rgbBlue" value={shownRgb[2]} disabled={rgbTarget < 0}
                  data-hotkey="uv-wrapper:preview-rgb-blue" data-hotkey-manual data-hotkey-label="Preview RGB B" onCommit={value => commitPreviewRgb(2, value)}/>
                <button type="button" aria-label="Reset preview RGB" disabled={!previewRgb.some(Boolean)}
                  onClick={() => { setPreviewRgb(EMPTY_PREVIEW_RGB); setHideRGB(false); }}>Reset</button>
              </div>
              <button type="button" data-hotkey="uv-wrapper:hide-extras" data-hotkey-manual data-hotkey-label="Hide extras" aria-pressed={hideExtras}
                title="Hide corpses, portrait backgrounds, hero glow and part-time effects. Keep the UV working geosets visible."
                onClick={() => setHideExtras(value => !value)}>Hide extras</button>
            </div>
          </div>
        </section>
        <Splitter orientation="horizontal" label="Resize live model preview" value={activePreviewPercent} minimum={UV_PREVIEW_MIN} maximum={UV_PREVIEW_MAX} defaultValue={UV_PREVIEW_DEFAULT}
          onValue={setActivePreviewPercent} onPointerValue={event => { const rect = sidePanel.current?.getBoundingClientRect(); if (rect) setActivePreviewPercent(uvPreviewPercentAtPointer(event.clientY, rect)); }}/>
        <div className="uv-side-controls">
          <section className="uv-projection" aria-label="UV projection"><div className="uv-projection-actions"><button data-hotkey="uv-wrapper:project-from-current-view" data-hotkey-manual data-hotkey-label="Project from Current View" title="Rotate the model to the required viewpoint, or choose a standard projection plane." disabled={editingLocked || !selectedCount(allSelected)} onClick={project}>Project from Current View</button><button data-hotkey="uv-wrapper:box-projection" data-hotkey-manual data-hotkey-label="Box Projection" title="Projects each selected triangle from the box side it faces most and lays the six sides out as an unfolded box. Uses the live preview's view." disabled={!toolState.boxProjection} onClick={() => projectCorners('Box Projection', boxProjectUVCorners)}>Box Projection</button><button data-hotkey="uv-wrapper:cylinder-projection" data-hotkey-manual data-hotkey-label="Cylinder Projection" title="Wraps the selected triangles around the live preview's upright axis. The seam goes at the back, away from the viewer." disabled={!toolState.cylinderProjection} onClick={() => projectCorners('Cylinder Projection', cylinderProjectUVCorners)}>Cylinder Projection</button><select data-hotkey="uv-wrapper:standard-projection-view" data-hotkey-manual data-hotkey-label="Standard projection view" aria-label="Standard projection view" disabled={densityOpen} defaultValue="" onChange={event => { chooseProjectionPreset(event.target.value); event.target.value = ''; }}><option value="">Standard…</option>{STANDARD_PROJECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Angled projection view" disabled={densityOpen} defaultValue="" onChange={event => { chooseProjectionPreset(event.target.value); event.target.value = ''; }}><option value="">Angled…</option>{ANGLED_PROJECTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div></section>
          <section className="uv-toolbox" aria-label="UV tools"><div className="uv-panel-title"><strong>Tools</strong><div className="uv-axis-controls uv-each-piece-control"><button type="button" aria-label="Each Piece" aria-pressed={preferences?.uvEachPiece === true} data-hotkey="uv:each-piece" data-hotkey-manual data-hotkey-label="Each Piece" data-hotkey-category="UV" title="On: Rotate and Zoom work on each separate piece, on its own spot. Off: the whole selection moves as one group." onClick={() => onPreferences?.({ ...preferences, uvEachPiece: preferences?.uvEachPiece !== true })}>Each Piece</button></div><div className="uv-axis-controls" role="group" aria-label="UV axis when Shift is held">{['X','Y'].map(value => <button key={value} type="button" aria-label={`UV ${value} axis`} aria-pressed={axis === value} onClick={() => setAxis(previous => previous === value ? null : value)}>{value}</button>)}</div></div><div className="uv-tool-grid">
            <Tool action="select" icon="select" label="Select" active={uvTool === 'select'} onClick={() => setUVTool('select')}/>
            <Tool action="translate" icon="move" label="Move" active={uvTool === 'move'} disabled={!toolState.move} onClick={() => setUVTool('move')}/>
            <Tool action="rotate" icon="rotate" label="Rotate" active={uvTool === 'rotate'} disabled={!toolState.rotate} onClick={() => setUVTool('rotate')}/>
            <Tool action="scale" icon="scale" label="Zoom" active={uvTool === 'scale'} disabled={!toolState.scale} onClick={() => setUVTool('scale')}/>
            <Tool action="uv:flip-u" icon="mirrorX" label="Mirror by X" disabled={!toolState.mirror} onClick={() => dispatch('flip-u')}/>
            <Tool action="uv:flip-v" icon="mirrorY" label="Mirror by Y" disabled={!toolState.mirror} onClick={() => dispatch('flip-v')}/>
            <Tool action="Uncouple" icon="uncouple" label="Uncouple selected face corners" disabled={!toolState.uncouple} onClick={() => onUncouple?.(Object.fromEntries(Object.entries(allSelected).filter(([, ids]) => ids.length)), Object.fromEntries(materialEntries.flatMap(entry => entry.geosetIndices.map(index => [index, entry.coordId]))))}/>
            <div className="uv-fold-control"><Tool action="uv:fold" icon="fold" label="Fold" disabled={!toolState.fold} onClick={() => dispatch('fold', foldDirection)}/><select data-hotkey="uv-wrapper:fold-direction" data-hotkey-manual data-hotkey-label="Fold direction" aria-label="Fold direction" value={foldDirection} onChange={event => setFoldDirection(event.target.value)}><option value="right-to-left">Right → left</option><option value="left-to-right">Left → right</option><option value="bottom-to-top">Bottom → top</option><option value="top-to-bottom">Top → bottom</option></select></div>
            <div className="uv-tool-row">
              <Tool data-hotkey="uv:straighten" data-hotkey-manual data-hotkey-label="Straighten" icon="straighten" label="Straighten" description="Straighten: lines the selected points up in a row, or in a column when they are taller than wide." disabled={!toolState.straighten} onClick={() => moveUVs('Straighten', values => straightenUVCoordinates(values, combined.selectedVertices, combined.geoset))}/>
              <Tool data-hotkey="uv:fit" data-hotkey-manual data-hotkey-label="Fit" icon="fit" label="Fit" active={!!marking} description="Fit: marks an area on the texture with a polygon lasso, freehand lasso or magic wand. Press Fit again (or Enter) to move the selected UVs into it. Only existing points move." disabled={!toolState.fit} onClick={fitPress}/>
              <Tool data-hotkey="uv:mirror-copy" data-hotkey-manual data-hotkey-label="Mirror Copy" icon="mirrorCopy" label="Mirror Copy" description="Mirror Copy: copies the selected points' UVs onto the matching points on the other side of the model." disabled={!toolState.mirrorCopy} onClick={() => moveUVs('Mirror Copy', values => mirrorCopyUVCoordinates(combined.geoset, combined.selectedVertices, combined.eligibleVertices, values))}/>
              <Tool data-hotkey="uv:unwrap" data-hotkey-manual data-hotkey-label="Unwrap" icon="unwrap" label="Unwrap" description="Unwrap: lays the selected triangles out flat. A closed or tube-shaped part is cut along its outline in the live preview." disabled={!toolState.unwrap} onClick={() => projectCorners('Unwrap', unwrapUVCorners)}/>
              <Tool data-hotkey="uv:relax" data-hotkey-manual data-hotkey-label="Relax" icon="relax" label="Relax" description="Relax: evens out the selected points so their triangles stop overlapping. Points on the selection's outer edge stay in place." disabled={!toolState.relax} onClick={() => moveUVs('Relax', values => relaxUVCoordinates(combined.geoset, combined.selectedVertices, combined.eligibleVertices, values))}/></div>
          </div></section>
        </div>
      </aside>
    </div>
  </div>;
}
