import { usePreferencesContext } from './PreferencesContext.jsx';
import { createModelSmoothing, MODEL_LAYER } from './model-smoothing.js';
export { textureFromAsset, layerMaterial, updateWideWireGeometry, configureWideLine } from './viewport-materials.js';
import { textureFromAsset, layerMaterial, updateWideWireGeometry, configureWideLine } from './viewport-materials.js';
import { beginRotationDrag, rotationDragDegrees, rotationOptions } from '../src/rotation-drag.js';
import React, { useEffect, useRef, useState } from 'react';
import { drawEditHandles } from './viewport-edit-handles.js';
import * as THREE from 'three';
import { createEditorCameras, applyCameraButtons, editorCameraAngles, setEditorCameraAngles } from './editor-camera-controls.js';
import { previewLighting, createEditorLights, configurePreviewLights, applyPreviewMaterialLighting } from './preview-lighting.js';
import { viewportCursor } from './viewport-cursors.js';
import { createPreviewPlatform } from './preview-platform.js';
import { drawPreviewGeometryOverlay, drawPresentationOverlay, HIDDEN_LINE_DASH, HIDDEN_LINE_FADE } from './preview-overlays.js';
import { previewBillboarding, previewPresentationProps, previewOverlaySettings } from './preview-presentation.js';
import { drawMovementGizmo, drawMovementOverlay, movementAxisHandles, movementDragAmount, projectMovementNodes, pickMovementHandle, pickMovementNode, movementNodeSelection } from './movement-overlay.js';
import {drawPoseOverlay} from './pose-overlay.js';
import {translate} from '../src/localization.js';
import { visibleMovementPoints } from './preview-overlays.js';
import { samplePreviewMatrices } from './preview-pose.js';
import { projectPreviewGeosets, pickPreviewGeoset } from './preview-selection.js';
import { configureGeosetHighlightMaterial } from './geoset-highlight.js';
import { configureEditorTexture, cameraLeftLight, viewportPixelRatio } from './viewport-quality.js';
import { createRigMarkersGL } from './rig-markers-gl.js';
import { drawModelCameraOverlay } from './model-camera-overlay.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { createOverlayDepth, needsSolidDepthPrepass } from './preview-depth.js';
import { vertexRgbPreviewState } from './vertex-rgb-preview.js';
import { advanceSequence, allNodes, inverseGeosetSkinMatrix, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset, skinGeosetNormals } from '../src/animation.js';
import { alignTowardView, applySelection, dragScale, insideTriangle, marqueeContainsPoint, moveDragPoint, planeAxes, shiftDragLatch, shiftDragOffset } from './classic-gestures.js';
import { watchContextLoss, bindScrollSensitivity, createFrameCoalescer, createRenderScheduler, graphicsOptions, pointerDragPoint, pointerSensitivityValue, scrollSensitivityCallbacks, SensitivityIndicator } from './viewport-performance.js';
import { viewportOverlayOptions } from './viewport-overlays.js';
import { makeChecker, makeTeamGlow, clearGroup, uniqueEdges, pointMarkerTexture, configurePointMaterial, emitSelection } from './viewport-shared.js';
import { projectCompassAxes } from './viewport-compass.js';

import { snapshotPreviewCamera, restorePreviewCamera, applyViewPreset, applyModelCamera, gridDepthExtent, gridFrameRadius, orthographicHalfHeight, perspectiveFitDistance, updateDepthClipping, modelClipRadius, freeDragTranslation, planeScreenBasis, projectedPlaneTranslation, quadProjectedPlaneTranslation } from './viewport-math.js';
import { createViewportGrid } from './viewport-grid.js';
import { visualOptions, viewportAppearanceOptions, gridOptions, cameraBindings } from '../src/preferences.js';
import { QUAD_VIEWS, viewWorkplane, viewportRects } from './quad-view.js';
import { viewportPointDepth, viewportPointIndices } from './viewport-point-selection.js';
import { composeViewportLayers, drawPreviewBackground } from './game-preview-capture.js';
import { createViewportSketch, SKETCH_CURSORS } from './viewport-sketch.js';

const COLORS = [0xa9b6c1, 0x8caca8, 0xb9aa94, 0x939bb5, 0xb499a6, 0x9eac8b];
import { gamePathKey as normalizedPath } from '../src/game-path.js';
import { clayColors } from '../src/forge-clay.js';
const selectionArray = selection => Array.from(selection || []);
const sameCompassAxes = (left, right) => left?.length === right?.length && left.every((axis, index) => axis.id === right[index].id && Math.abs(axis.x - right[index].x) < .001 && Math.abs(axis.y - right[index].y) < .001 && Math.abs(axis.depth - right[index].depth) < .001);
const identityMatrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const isIdentityMatrix = matrix => matrix.elements.every((value, index) => Math.abs(value - identityMatrix[index]) < 1e-10);
export default function Viewport(inputProps) {
  const { preferences } = usePreferencesContext();
  const props = previewPresentationProps({ ...inputProps, preferences: inputProps.preferences === undefined ? preferences : inputProps.preferences });
  const { model, revision = 0, selectedGeoset = 0, selectedVertices = [], hiddenGeosets, mode = 'vertices', shaded = true, showSkeleton = false, showGrid = true, view = 'front', cameraMode = 'work', workplane = 'xy', transformMode = 'select', sequenceIndex = -1, time = 0, playing = false, teamColor = '#ff0000', textureAssets } = props;
  const host = useRef(null), runtime = useRef(null), latest = useRef(props);
  latest.current = { ...props, selectedGeoset, selectedVertices, mode, showSkeleton, showGrid, view, cameraMode, workplane, transformMode, sequenceIndex, time, playing, teamColor };
  const [error, setError] = useState(''), [textureMessage, setTextureMessage] = useState(''), [backgroundMessage, setBackgroundMessage] = useState(''), [box, setBox] = useState(null);
  const [compassAxes, setCompassAxes] = useState(() => projectCompassAxes());
  const [adjustingSensitivity, setAdjustingSensitivity] = useState(null);
  const cameraMemory = useRef(null);
  const graphics = graphicsOptions(props.preferences);
  const textureSignature = (model?.Textures || []).map(texture => `${texture.Image}|${texture.Flags}|${texture.ReplaceableId}`).join('\n');
  const texturesNeeded = graphics.textures && mode === 'textured';

  useEffect(() => {
    const viewportHost = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' }); }
    catch (cause) { setError(`The 3D viewport could not start: ${cause.message}. Model data and the other editors remain available.`); return; }
    setError('');
    renderer.setPixelRatio(viewportPixelRatio(graphics, window.devicePixelRatio));
    renderer.setClearColor(0xcccccc); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'display:block;position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;outline:none';
    renderer.domElement.tabIndex = 0;
    host.current.appendChild(renderer.domElement);
    const modelSmoothing = createModelSmoothing(renderer);
    const scene = new THREE.Scene(), modelGroup = new THREE.Group();
    scene.add(modelGroup);
    // The classic single view uses the canvas; Quad View adds its own input panes.
    let surface = renderer.domElement;
    let { perspective, ortho, controls } = createEditorCameras(surface, { target: [0, 0, 45] });
    perspective.position.set(180, -260, 170); controls.update();
    let camera = perspective;
    const { ambient, key } = createEditorLights(scene); ambient.layers.enable(MODEL_LAYER); key.layers.enable(MODEL_LAYER);
    let cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas, editCanvas, gizmoCanvas, magnetButton, rotating = false, altHover = false;
    let grid = createViewportGrid(); scene.add(grid);
    const rigMarkers = createRigMarkersGL(renderer.getContext()); renderer.resetState();
    const platform = createPreviewPlatform(() => invalidate()); scene.add(platform);
    // AI console Pen/Marker notes: display-only, never part of the model. They sit
    // beside modelGroup (same space), which is cleared on every geometry reload.
    const sketch = createViewportSketch({ parent: scene, entries: () => state.entries, invalidate: () => invalidate() });
    const backgroundCanvas = document.createElement('canvas'), backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    const state = { renderer, modelSmoothing, scene, modelGroup, perspective, ortho, camera, controls, grid, entries: [], nodes: [], textures: new Map(), markerTextures: new Map(), checker: makeChecker(), background: { canvas: backgroundCanvas, texture: backgroundTexture, data: null, image: null, status: 'idle', drawKey: '' }, frame: 0, lastExternalTime: undefined, sequenceIndex: -1, wasPlaying: false, drag: null, anchorCandidate: null, dirty: true, radius: 100, center: new THREE.Vector3(0, 0, 40), loadedSignature: null, selectionKey: '', hoveredGeoset: null, disposed: false };
    runtime.current = state; state.sketch = sketch;
    state.teamGlow = makeTeamGlow();
    state.globalTime = 0;
    state.textureSources = new Map();
    const singlePane = { id: 'single', surface, perspective, ortho, camera, controls, grid, view: latest.current.view, center: state.center, radius: state.radius };
    const panes = [singlePane];
    let boundPane = singlePane, activePane = singlePane, quad = false;
    // Only camera/input/overlay state is per pane. Scene, geometry, selection,
    // drag snapshots, textures and the document commit path stay shared.
    function savePane() {
      Object.assign(boundPane, { camera, view: state.appliedView, center: state.center, radius: state.radius, floor: state.floor, cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas, editCanvas });
    }
    function bindPane(pane) {
      savePane(); boundPane = pane;
      ({ surface, perspective, ortho, camera, controls, grid, cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, anchorCanvas, editCanvas } = pane);
      for (const item of panes) item.grid.visible = item === pane;
      Object.assign(state, { perspective, ortho, camera, controls, grid, appliedView: pane.view, center: pane.center, radius: pane.radius, floor: pane.floor });
    }
    function activatePane(pane) {
      if (down && pane !== activePane) return;
      bindPane(pane); activePane = pane;
      for (const item of panes) item.surface.classList.toggle('active', quad && item === pane);
      latest.current.onActivePaneChange?.(quad ? { id: pane.id, view: pane.view, workplane: pane.workplane } : null);
      invalidate();
    }
    // Orbits and drags invalidate on every pointer event; the compass and the
    // app's camera angles follow once per frame.
    let reportedCamera = null;
    const cameraReport = createFrameCoalescer(() => {
      const { compassAxes, angles } = reportedCamera;
      setCompassAxes(previous => sameCompassAxes(previous, compassAxes) ? previous : compassAxes);
      latest.current.onCameraAnglesChange?.(angles);
    });
    const invalidate = () => {
      if (boundPane !== activePane) { state.scheduler?.invalidate(); return; }
      reportedCamera = { compassAxes: projectCompassAxes(camera.quaternion), angles: editorCameraAngles(camera) };
      cameraReport.schedule(); state.scheduler?.invalidate();
    };
    const markerTexture = style => {
      if (style === 'square') return null;
      if (!state.markerTextures.has(style)) state.markerTextures.set(style, pointMarkerTexture(style));
      return state.markerTextures.get(style);
    };
    function syncViewportBackground(appearance) {
      const config = quad ? appearance.quadView.background : appearance.background, background = state.background;
      if (background.data !== config.imageData) {
        background.data = config.imageData; background.image = null; background.drawKey = ''; setBackgroundMessage('');
        if (config.imageData) {
          const picture = new Image(); background.status = 'loading';
          picture.onload = () => { if (state.disposed || background.data !== config.imageData) return; background.image = picture; background.status = 'ready'; background.drawKey = ''; setBackgroundMessage(''); invalidate(); };
          picture.onerror = () => { if (state.disposed || background.data !== config.imageData) return; background.status = 'failed'; background.image = null; setBackgroundMessage('Background image unavailable; using the preset color.'); invalidate(); };
          picture.src = config.imageData;
        } else background.status = 'idle';
      }
      if (config.type !== 'image' || !background.image) { scene.background = new THREE.Color(config.color); return; }
      const width = Math.max(1, Math.round(surface.clientWidth * renderer.getPixelRatio())), height = Math.max(1, Math.round(surface.clientHeight * renderer.getPixelRatio()));
      const key = `${width}|${height}|${config.color}|${config.display}|${config.opacity}`;
      if (background.drawKey !== key) {
        background.canvas.width = width; background.canvas.height = height;
        drawPreviewBackground(background.canvas.getContext('2d'), width, height, background.image, config.color, config);
        background.texture.needsUpdate = true; background.drawKey = key;
      }
      scene.background = background.texture;
    }
    state.refreshCursor = () => { surface.style.cursor = viewportCursor(latest.current.cameraMode, latest.current.rotationNormals ? 'rotateNormals' : latest.current.transformMode, rotating); };
    state.restoreCamera = saved => { camera = restorePreviewCamera(saved, perspective, ortho, controls); state.camera = boundPane.camera = camera; };
    state.setCameraAngles = values => { if (quad && boundPane.workplane) return; if (setEditorCameraAngles(camera, controls.target, values)) { controls.update(); if (quad) activatePane(activePane); else invalidate(); } };
    function bindInput(pane) {
      const element = pane.surface;
      const activate = () => activatePane(pane);
      // Pane activation is only needed for Quad View. The classic canvas
      // keeps its original listener order and input ownership.
      if (pane !== singlePane) {
        element.addEventListener('pointerdown', activate, true);
        element.addEventListener('wheel', activate, true);
        element.addEventListener('focus', activate);
      }
      pane.controls.addEventListener('change', invalidate);
      const unbindScroll = bindScrollSensitivity(element, scrollSensitivityCallbacks(latest, {
        onIndicator: value => { setAdjustingSensitivity(value); latest.current.onSensitivityIndicator?.(value); },
        // A Wisp left-button wheel gesture is a settings gesture, never a select or transform.
        onPointerAdjustment: () => cancelGesture(),
        onWheel: (_event, sensitivity) => { pane.controls.zoomSpeed = sensitivity; },
      }));
      element.addEventListener('pointerdown', pointerDown, true);
      element.addEventListener('pointermove', pointerMove);
      element.addEventListener('pointerup', pointerUp);
      element.addEventListener('dblclick', doubleClickParts);
      element.addEventListener('pointercancel', cancelGesture);
      element.addEventListener('pointerleave', pointerLeave);
      element.addEventListener('contextmenu', contextMenu);
      pane.dispose = () => { unbindScroll(); pane.controls.removeEventListener('change', invalidate); pane.controls.dispose(); element.remove(); };
    }

    function resizePane() {
      const width = Math.max(1, surface.clientWidth), height = Math.max(1, surface.clientHeight);
      perspective.aspect = width / height; perspective.updateProjectionMatrix();
      const half = orthographicHalfHeight(state.radius, width / height); ortho.left = -half * width / height; ortho.right = half * width / height; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
    }
    function resize() {
      const width = Math.max(1, host.current?.clientWidth || 1), height = Math.max(1, host.current?.clientHeight || 1);
      renderer.setPixelRatio(viewportPixelRatio(graphicsOptions(latest.current.preferences), window.devicePixelRatio));
      renderer.setSize(width, height, false);
      const visible = quad ? panes.slice(1) : [singlePane], rects = viewportRects(width, height, quad);
      for (const pane of panes) {
        pane.surface.style.display = pane === singlePane || visible.includes(pane) ? 'block' : 'none';
        if (pane === singlePane) pane.surface.style.pointerEvents = quad ? 'none' : 'auto';
      }
      if (quad) Object.assign(renderer.domElement.style, { left: '0px', top: '0px', width: width + 'px', height: height + 'px' });
      visible.forEach((pane, index) => {
        pane.rect = rects[index];
        Object.assign(pane.surface.style, Object.fromEntries(Object.entries(pane.rect).map(([key, value]) => [key, value + 'px'])));
        bindPane(pane); resizePane();
      });
      bindPane(activePane); invalidate();
    }
    state.resize = resize;
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host.current); resize();
    state.fit = (selectionOnly = false) => {
      const bounds = new THREE.Box3();
      const p = latest.current;
      if (selectionOnly) {
        const active = editableGeosets(p);
        for (const [key, indices] of Object.entries(selections(p))) {
          const entry = state.entries[key], hidden = new Set(p.hiddenVertices?.[key] || []);
          if (!active.has(Number(key)) || !entry?.group.visible) continue;
          for (const index of selectionArray(indices)) if (index >= 0 && index < entry.geometry.attributes.position.count && !hidden.has(index)) bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(entry.geometry.attributes.position, index));
        }
      }
      if (bounds.isEmpty()) for (const geo of p.model?.Geosets || []) {
        for (let i = 0; i < geo.Vertices.length; i += 3) bounds.expandByPoint(new THREE.Vector3().fromArray(geo.Vertices, i));
      }
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100));
      bounds.getCenter(state.center); state.radius = Math.max(1, bounds.getSize(new THREE.Vector3()).length() / 2);
      state.floor = bounds.min.z;
      const gridVisible = !quad && (p.overlays?.grid ?? !!p.showGrid);
      const framed = gridVisible && p.frameGrid !== false ? Math.max(state.radius, gridFrameRadius(state.center, gridOptions(p.preferences).extent)) : state.radius;
      const direction = perspective.position.clone().sub(controls.target).normalize();
      const width = Math.max(1, surface.clientWidth), height = Math.max(1, surface.clientHeight);
      perspective.position.copy(state.center).addScaledVector(direction.lengthSq() ? direction : new THREE.Vector3(1, -1.5, .9).normalize(), perspectiveFitDistance(framed, perspective.fov, width / height));
      controls.target.copy(state.center); perspective.zoom = ortho.zoom = 1;
      if (quad) resizePane(); else resize();
      setPaneView(quad ? boundPane.view : latest.current.view || 'front');
    };
    function rememberView(next) {
      state.appliedView = boundPane.view = next;
      const label = surface.querySelector('.quad-pane-label');
      if (label) label.textContent = next === 'right' ? 'Side' : next[0].toUpperCase() + next.slice(1);
    }
    function setPaneView(next) {
      // A quad pane owns a fixed world plane, independent of view commands.
      if (quad && boundPane !== singlePane && (boundPane.workplane ? viewWorkplane(next) !== boundPane.workplane : next !== 'perspective')) return;
      rememberView(next);
      if (next === 'perspective') camera = perspective;
      else if (next === 'orthographic') {
        const previous = camera; camera = ortho; camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion); camera.up.copy(previous.up);
      }
      else {
        const p = latest.current, gridVisible = !quad && (p.overlays?.grid ?? !!p.showGrid);
        const framed = gridVisible && p.frameGrid !== false ? Math.max(state.radius, gridFrameRadius(state.center, gridOptions(p.preferences).extent)) : state.radius;
        camera = ortho; applyViewPreset(camera, next, controls.target, framed * 4);
      }
      controls.object = camera; controls.enableRotate = !(quad && boundPane.workplane);
      state.camera = camera; boundPane.view = next; boundPane.camera = camera; controls.update(); invalidate();
    }
    state.setView = next => {
      if (quad) cancelGesture();
      if (quad) {
        const plane = viewWorkplane(next);
        if (!plane && next !== 'perspective') return;
        activatePane(panes.slice(1).find(pane => pane.workplane === plane));
      }
      setPaneView(next);
      if (quad) activatePane(activePane);
    };
    state.setQuad = enabled => {
      if (quad === !!enabled) return;
      cancelGesture(); savePane(); quad = !!enabled;
      for (const overlay of [singlePane.cameraCanvas, singlePane.normalCanvas, singlePane.nodeCanvas, singlePane.previewCanvas, singlePane.anchorCanvas, singlePane.editCanvas]) if (overlay) overlay.style.display = quad ? 'none' : '';
      if (quad && panes.length === 1) {
        for (const definition of QUAD_VIEWS) {
          const element = document.createElement('div'); element.className = 'viewport-input quad-pane'; element.tabIndex = 0;
          element.dataset.viewport = definition.id; element.setAttribute('aria-label', definition.label + ' viewport');
          const label = document.createElement('span'); label.className = 'quad-pane-label'; label.textContent = definition.label;
          element.appendChild(label); host.current.appendChild(element);
          const { perspective, ortho, controls: paneControls } = createEditorCameras(element, { target: singlePane.controls.target });
          perspective.copy(singlePane.perspective); ortho.copy(singlePane.ortho);
          const camera = definition.view === 'perspective' ? perspective : ortho;
          paneControls.object = camera;
          const pane = { ...definition, workplane: viewWorkplane(definition.view), surface: element, perspective, ortho, camera, controls: paneControls, grid: createViewportGrid(), center: singlePane.center.clone(), radius: singlePane.radius, floor: singlePane.floor };
          scene.add(pane.grid);
          panes.push(pane); bindInput(pane); bindPane(pane);
          const saved = cameraMemory.current?.panes?.find(item => item.id === pane.id);
          if (saved) { state.restoreCamera(saved); state.center.copy(saved.center); state.radius = saved.radius; }
          setPaneView(saved && viewWorkplane(saved.view) === pane.workplane ? saved.view : definition.view);
        }
      }
      activePane = quad ? panes[1] : singlePane;
      bindPane(activePane); resize(); activatePane(activePane);
    };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); raycaster.layers.enable(MODEL_LAYER);
    let down = null, editClicks = 0, partHover = null;
    function point(event) { const rect = surface.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height, shift: !!event.shiftKey }; }
    function clearHoveredGeoset() {
      if (state.hoveredGeoset === null) return;
      state.hoveredGeoset = null; latest.current.onHoverGeoset?.(null);
    }
    function inspectHoveredGeoset(event) {
      const p = latest.current;
      if (!p.highlightSelection || !p.onHoverGeoset) { clearHoveredGeoset(); return; }
      const end = point(event);
      const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geometry.index.array, vertices: entry.geometry.attributes.position.array }] : []);
      const hit = pickPreviewGeoset(projectPreviewGeosets(geometry, camera, end.width, end.height), end.x, end.y);
      const next = hit?.index ?? null;
      if (state.hoveredGeoset !== next) { state.hoveredGeoset = next; p.onHoverGeoset(next); }
    }
    function applyPreviewPose(p, poseCamera) {
      state.matrices = samplePreviewMatrices(p.model, state.frame, p.sequenceIndex, state.globalTime, previewBillboarding(p) ? poseCamera : undefined);
      for (const entry of state.entries) {
        if (!entry) continue;
        const positions = entry.geometry.attributes.position;
        skinGeoset(entry.geoset, state.matrices, positions.array);
        positions.needsUpdate = true; entry.geometry.computeBoundingSphere(); updateWideWireGeometry(entry);
        const normals = entry.geometry.attributes.normal;
        if (entry.geoset.Normals?.length === positions.array.length) {
          skinGeosetNormals(entry.geoset, state.matrices, normals.array);
          normals.needsUpdate = true;
        } else entry.geometry.computeVertexNormals();
      }
    }
    function editableGeosets(p) { return p.selectableGeosets == null ? new Set([p.selectedGeoset]) : new Set(p.selectableGeosets); }
    function selections(p) { return p.selectionByGeoset || { [p.selectedGeoset]: selectionArray(p.selectedVertices) }; }
    /** Workplane off in a single view: the Move tool shows the POSE arrows and plane squares at the selection. */
    function gizmoPivot(p) {
      if (quad || p.transformMode !== 'translate' || p.workplaneEnabled !== false || !p.onTransform || p.onStartPartDrag || p.normalizer || p.presentation === 'preview' || p.sequenceIndex >= 0 || p.playing) return null;
      const active = editableGeosets(p), pivot = new THREE.Vector3(); let count = 0;
      for (const [key, ids] of Object.entries(selections(p))) {
        const entry = state.entries[key], position = entry?.geometry.attributes.position, hidden = new Set(p.hiddenVertices?.[key] || []);
        if (!active.has(Number(key)) || !entry?.group.visible) continue;
        for (const i of selectionArray(ids)) if (Number.isInteger(i) && i >= 0 && i < position.count && !hidden.has(i)) { pivot.add(new THREE.Vector3().fromBufferAttribute(position, i)); count++; }
      }
      if (!count) return null;
      const anchor = p.zoomAnchor, anchorEntry = anchor && state.entries[anchor.geosetIndex];
      if (anchorEntry && selectionArray(selections(p)[anchor.geosetIndex]).includes(anchor.vertexIndex)) return pivot.fromBufferAttribute(anchorEntry.geometry.attributes.position, anchor.vertexIndex);
      return pivot.multiplyScalar(1 / count);
    }
    /** An arrow moves along its axis and a square within its plane, under the pointer. */
    function gizmoTranslation(start, end, drag) {
      const handle = drag.handle, dx = end.x - start.x, dy = end.y - start.y;
      if (handle.plane) return new THREE.Vector3().fromArray(projectedPlaneTranslation(handle.plane, planeScreenBasis(camera, drag.pivot, end.width, end.height, handle.plane), dx, dy));
      const axis = 'XYZ'.indexOf(handle.axis), origin = drag.pivot.clone().project(camera), tip = drag.pivot.clone().setComponent(axis, drag.pivot.getComponent(axis) + 1).project(camera);
      const ax = (tip.x - origin.x) * end.width / 2, ay = (origin.y - tip.y) * end.height / 2, pixels = ax * ax + ay * ay;
      // An axis pointing at the camera keeps its short stand-in arrow and a steady speed.
      return new THREE.Vector3().setComponent(axis, Math.hypot(handle.projectedDx, handle.projectedDy) < 18 ? movementDragAmount(handle, dx, dy, 'move') : (dx * ax + dy * ay) / pixels);
    }
    function screenPosition(value, rect) { const projected = value.clone().project(camera); return new THREE.Vector2((projected.x + 1) * rect.width / 2, (1 - projected.y) * rect.height / 2); }
    function anchorVertexInMarquee(p, start, end) {
      const active = editableGeosets(p), selected = selections(p), screen = new THREE.Vector3(), radius = Math.max(5, visualOptions(p.preferences).vertexSize / 2);
      let first = null, firstDistance = Infinity;
      for (const geosetIndex of active) {
        const entry = state.entries[geosetIndex], hidden = new Set(p.hiddenVertices?.[geosetIndex] || []);
        if (!entry?.group.visible) continue;
        for (const index of selectionArray(selected[geosetIndex])) {
          if (hidden.has(index) || index < 0 || index >= entry.geometry.attributes.position.count) continue;
          screen.fromBufferAttribute(entry.geometry.attributes.position, index).project(camera); if (screen.z < -1 || screen.z > 1) continue;
          const point = [(screen.x + 1) * end.width / 2, (1 - screen.y) * end.height / 2];
          if (!marqueeContainsPoint(point, start, end, radius)) continue;
          const distance = Math.hypot(point[0] - start.x, point[1] - start.y);
          if (distance < firstDistance) { firstDistance = distance; first = { geosetIndex, vertexIndex: index }; }
        }
      }
      return first;
    }
    function cameraAction(event) {
      const p = latest.current;
      const binding = cameraBindings(p.preferences);
      let action = event.button === 2 ? binding.right : event.button === 1 ? binding.middle : event.altKey ? 'rotate' : p.cameraMode;
      if (action === 'pan' || quad && boundPane.workplane && action === 'rotate') action = 'move';
      return action;
    }
    // OrbitControls is used only for navigation. Capture configures it before its handler runs.
    function pointerDown(event) {
      if (down) return;
      // A click acts on the hover it was aimed at.
      hoverFrame.flush();
      clearHoveredGeoset();
      if (quad) surface.focus(); else host.current?.focus();
      // Pen/Marker take the left button only in Work mode; Alt, rotate mode and the
      // other buttons keep the normal camera controls.
      if (sketch.tool && event.button === 0 && cameraAction(event) === 'work') {
        const start = point(event);
        down = { ...start, pointerId: event.pointerId, action: 'sketch' };
        controls.enabled = false; surface.setPointerCapture(event.pointerId);
        sketch.begin(start, camera, controls.target, state.radius);
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      const action = cameraAction(event);
      rotating = action === 'rotate'; latest.current.onCameraGestureChange?.(rotating);
      surface.style.cursor = viewportCursor(latest.current.cameraMode, latest.current.rotationNormals ? 'rotateNormals' : latest.current.transformMode, rotating);
      controls.enabled = true;
      applyCameraButtons(controls, event, latest.current.preferences, { left: action === 'move' ? 'pan' : action, fine: action !== 'work', rotateAsPan: !!(quad && boundPane.workplane), preserveShift: !quad });
      if (action === 'move' || action === 'rotate') return;
      if (latest.current.presentation === 'preview' && action !== 'zoom') return;
      if (event.button !== 0) return;
      const p = latest.current, start = point(event);
      down = { ...start, pointerId: event.pointerId, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, pointerSensitivity: pointerSensitivityValue(p.preferences?.pointerSensitivity), action: action === 'zoom' ? 'zoom' : p.transformMode };
      controls.enabled = false; surface.setPointerCapture(event.pointerId);
      if (action === 'zoom') { down.zoomFactor = 1; return; }
      // The NormalsXL preview shows proposed geometry with new vertex indices:
      // camera navigation only, so no edit can target the wrong vertices.
      if (p.normalizer) { down.action = 'normalizer'; event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (p.choosingZoomAnchor) { down.action = 'anchor'; state.anchorCandidate = null; return; }
      if (p.onStartPartDrag) { down.action = 'parts'; down.parts = p.onStartPartDrag({ start, end: start, camera, grabThrough: false }); return; }
      const gizmoHandle = state.gizmoHandles?.length ? pickMovementHandle(state.gizmoHandles, start.x, start.y, 'move') : null;
      if(p.onSelectNodes&&!down.ctrl&&!gizmoHandle){
        const nodes=visibleMovementPoints(projectMovementNodes(p.model,state.frame,p.sequenceIndex,camera,start.width,start.height,state.globalTime,state.matrices,p.vanilla),viewportOverlayOptions(p));
        const picked=pickMovementNode(nodes,start.x,start.y,p.selectedNodeIds,13,p.transformMode==='translate');
        if(picked){
          const ids=movementNodeSelection(p.selectedNodeIds||[],picked.node.ObjectId,{multiple:true,shift:event.shiftKey,ctrl:false});
          p.onSelectNodes(ids);down.action='node';
          if(p.onNodeTransform&&p.transformMode==='translate'&&ids.includes(picked.node.ObjectId))state.nodeDrag={ids,pivot:picked.world.clone(),workplane:quad&&boundPane.workplane||p.workplane,workplaneEnabled:!!(quad&&boundPane.workplane)||p.workplaneEnabled!==false,delta:new THREE.Vector3(),moved:false,latch:shiftDragLatch(start,event.shiftKey)};
          invalidate();event.preventDefault();event.stopImmediatePropagation();return;
        }
      }
      if (p.transformMode === 'select' || p.sequenceIndex >= 0 || p.playing || down.ctrl && p.onInspectGeoset) { down.action = 'select'; return; }
      const posedEditing = state.nodes.some(node => node.Flags & 120);
      if (posedEditing) applyPreviewPose(p, camera);
      const active = editableGeosets(p), selected = selections(p), snapshots = {}, selectedMap = {}, poseInverses = {}, pivot = new THREE.Vector3(); let count = 0, posedSelection = false, poseInvertible = true;
      for (const [key, ids] of Object.entries(selected)) {
        const index = Number(key), entry = state.entries[index], invisible = new Set(p.hiddenVertices?.[key] || []);
        if (!active.has(index) || !entry?.group.visible) continue;
        const indices = selectionArray(ids).filter(i => Number.isInteger(i) && i >= 0 && i < entry.geometry.attributes.position.count && !invisible.has(i));
        if (!indices.length) continue;
        selectedMap[index] = indices; snapshots[index] = new Float32Array(entry.geometry.attributes.position.array);
        if (posedEditing) {
          const inverseCache = new Map(), skin = entry.geoset.SkinWeights;
          const inverses = indices.map(vertex => {
            const key = skin?.length >= (vertex + 1) * 8 ? `h:${Array.from(skin.subarray(vertex * 8, vertex * 8 + 8)).join(',')}` : `c:${entry.geoset.VertexGroup?.[vertex] ?? -1}`;
            if (!inverseCache.has(key)) inverseCache.set(key, inverseGeosetSkinMatrix(entry.geoset, vertex, state.matrices));
            return inverseCache.get(key);
          });
          if (inverses.some(matrix => !matrix)) poseInvertible = false;
          else if (inverses.some(matrix => !isIdentityMatrix(matrix))) posedSelection = true;
          poseInverses[index] = inverses;
        }
        for (const i of indices) { pivot.add(new THREE.Vector3().fromArray(snapshots[index], i * 3)); count++; }
      }
      if (!count) { down.action = 'select'; return; }
      pivot.multiplyScalar(1 / count);
      const anchor = p.zoomAnchor, anchorIndices = anchor && selectedMap[anchor.geosetIndex];
      if (anchorIndices?.includes(anchor.vertexIndex)) pivot.fromArray(snapshots[anchor.geosetIndex], anchor.vertexIndex * 3);
      // Align is locked to this view for the whole drag.
      if (down.action === 'scale' && anchor?.kind === 'align' && anchorIndices?.includes(anchor.vertexIndex)) down.align = camera.isOrthographicCamera ? { direction: camera.getWorldDirection(new THREE.Vector3()).toArray() } : { eye: camera.position.toArray() };
      down.pivotScreen = screenPosition(pivot, start);
      const lockedPlane = quad && boundPane.workplane;
      if (down.action === 'rotate') {
        const axis = [0, 1, 2].find(i => !planeAxes(lockedPlane || p.workplane).includes(i));
        const turn = new THREE.Vector3().setComponent(axis, 1).transformDirection(camera.matrixWorldInverse);
        down.rotationDrag = beginRotationDrag({ ...rotationOptions(p.preferences, p.rotationEditor || 'vertices'), x: down.x, y: down.y, pivot: down.pivotScreen, axis: turn.toArray() });
      }
      state.drag = { ...down, selections: selectedMap, snapshots, pivot, poseInverses: posedSelection && poseInvertible ? poseInverses : null, workplane: lockedPlane || p.workplane, workplaneEnabled: !!lockedPlane || p.workplaneEnabled !== false, handle: gizmoHandle, payload: null, move: { pointer: start, point: start, shift: event.shiftKey, axis: null }, latch: shiftDragLatch(start, event.shiftKey) };
    }
    function translateInPlane(start, end, drag, constrain) {
      if (drag.handle) return gizmoTranslation(start, end, drag);
      if (!drag.workplaneEnabled) return freeDragTranslation(camera, drag.pivot, end.width, end.height, end.x - start.x, end.y - start.y, { shift: constrain, workplane: drag.workplane });
      const axes = planeAxes(drag.workplane), center = screenPosition(drag.pivot, end);
      const basis = axes.map(axis => { const value = drag.pivot.clone(); value.setComponent(axis, value.getComponent(axis) + 1); return screenPosition(value, end).sub(center).toArray(); });
      const solve = quad ? quadProjectedPlaneTranslation : projectedPlaneTranslation;
      return new THREE.Vector3().fromArray(solve(drag.workplane, basis, end.x - start.x, end.y - start.y, constrain));
    }
    /** Single view: Shift toggles mid-drag continue from the visible position. */
    function shiftTranslation(end, drag, shift) {
      return new THREE.Vector3().fromArray(shiftDragOffset(drag.latch, end, shift, (from, to, held) => translateInPlane(from, to, drag, held).toArray()));
    }
    function showBox(value) { setBox({ ...value, left: value.left + (boundPane.rect?.left || 0), top: value.top + (boundPane.rect?.top || 0) }); }
    function hoverParts(event) {
      const p = latest.current;
      partHover = !event.buttons && !event.altKey && p.cameraMode === 'work' ? { end: point(event), camera } : null;
      p.onHoverParts?.(partHover);
    }
    function pointerMove(event) {
      if (!down) {
        // Holding Alt over the model turns a drawing tool's drag into a camera rotation; show that.
        if (sketch.tool && altHover !== event.altKey) { altHover = event.altKey; invalidate(); }
        hoverMove = { event: { clientX: event.clientX, clientY: event.clientY, shiftKey: event.shiftKey, altKey: event.altKey, buttons: event.buttons }, pane: quad ? panes.find(pane => pane.surface === event.currentTarget) : null };
        hoverFrame.schedule(); return;
      }
      if (down.action === 'sketch') { for (const sample of event.getCoalescedEvents?.() || [event]) sketch.move(point(sample)); return; }
      const rawEnd = point(event), end = down.action === 'select' ? rawEnd : pointerDragPoint(down, rawEnd, down.pointerSensitivity), dx = end.x - down.x, dy = end.y - down.y;
      if (latest.current.onDoubleClickParts && Math.hypot(rawEnd.x - down.x, rawEnd.y - down.y) > 5) down.traveled = true;
      if (down.action === 'parts') { down.partsEnd=end; if (down.traveled && down.parts) { partsMove = { parts: down.parts, end }; partsFrame.schedule(); } return; }
      if (down.action === 'normalizer') return;
      if (down.action === 'anchor') { anchorMove = { down, rawEnd }; anchorFrame.schedule(); return; }
      if (down.action === 'zoom') {
        const factor = Math.exp(-dy * .01);
        controls.zoomView(factor / down.zoomFactor); down.zoomFactor = factor;
        controls.update(); return;
      }
      if (down.action === 'select') { if (Math.hypot(dx, dy) > 5) showBox({ left: Math.min(down.x, end.x), top: Math.min(down.y, end.y), width: Math.abs(dx), height: Math.abs(dy) }); return; }
      if(down.action==='node'){
        const drag=state.nodeDrag;if(drag){drag.delta=quad?translateInPlane(down,end,drag,event.shiftKey):shiftTranslation(end,drag,event.shiftKey);drag.moved=Math.hypot(dx,dy)>1;invalidate();}
        return;
      }
      if (!state.drag) return;
      // Forge double-clicks tolerate a little hand movement without moving the piece.
      if (latest.current.onDoubleClickParts && !down.traveled) return;
      // Turning around the pivot sums wrapped angle steps; feed every sample so a fast
      // turn between frames cannot flip direction. Repeating the last point adds nothing.
      if (state.drag.rotationDrag) rotationDragDegrees(state.drag.rotationDrag, rawEnd.x - down.x, rawEnd.y - down.y);
      transformMove = { down, rawEnd, end, dx, dy, shiftKey: event.shiftKey }; transformFrame.schedule();
    }
    // Hover picking projects every visible vertex and updates Forge cut previews; once per frame.
    let hoverMove = null;
    const hoverFrame = createFrameCoalescer(() => {
      const move = hoverMove; hoverMove = null; if (!move || down) return;
      if (move.pane) bindPane(move.pane);
      hoverParts(move.event); inspectHoveredGeoset(move.event);
      if (move.pane) bindPane(activePane);
    });
    // The zoom-anchor marquee searches every vertex; once per frame with the latest point.
    let anchorMove = null;
    const anchorFrame = createFrameCoalescer(() => {
      const move = anchorMove; anchorMove = null; if (!move || down !== move.down) return;
      const { rawEnd } = move, distance = Math.hypot(rawEnd.x - down.x, rawEnd.y - down.y);
      if (distance > 5) {
        showBox({ left: Math.min(down.x, rawEnd.x), top: Math.min(down.y, rawEnd.y), width: Math.abs(rawEnd.x - down.x), height: Math.abs(rawEnd.y - down.y) });
        down.anchorCandidate = anchorVertexInMarquee(latest.current, down, rawEnd); state.anchorCandidate = down.anchorCandidate; invalidate();
      } else { setBox(null); down.anchorCandidate = state.anchorCandidate = null; invalidate(); }
    });
    // Forge part drags (mold, extrude, cut) rebuild their meshes; once per frame.
    let partsMove = null;
    const partsFrame = createFrameCoalescer(() => { const move = partsMove; partsMove = null; move?.parts.update(move.end); });
    // Vertex transforms rebuild wires and update Coords; run them once per frame with the latest point.
    let transformMove = null;
    const transformFrame = createFrameCoalescer(applyTransformMove);
    function applyTransformMove() {
      const drag = state.drag, move = transformMove; transformMove = null; if (!drag || !move) return;
      const { down, rawEnd, end, dx, dy } = move, event = move;
      const payload ={ selections: drag.selections, geosetIndex: latest.current.selectedGeoset, indices: drag.selections[latest.current.selectedGeoset] || [], pivot: drag.pivot.toArray() };
      const rotation = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1), translation = new THREE.Vector3();
      if (drag.action === 'translate') {
        translation.copy(quad
          ? translateInPlane(down, moveDragPoint(drag.move, end, event.shiftKey), drag, false)
          : shiftTranslation(end, drag, event.shiftKey));
        payload.translation = translation.toArray();
      }
      // Align only pulls inward and stops once everything is lined up.
      if (drag.action === 'scale' && drag.align) payload.scale = [1, 1, 1].fill(Math.min(1, dragScale(dx)[0]));
      else if (drag.action === 'scale') { scale.fromArray(dragScale(dx, drag.workplane, event.shiftKey)); payload.scale = scale.toArray(); payload.allowSingularScale = true; }
      if (drag.action === 'rotate') {
        let angle = rotationDragDegrees(drag.rotationDrag, rawEnd.x - down.x, rawEnd.y - down.y, down.pointerSensitivity) * Math.PI / 180;
        const axis = [0, 1, 2].find(i => !planeAxes(drag.workplane).includes(i));
        if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
        const degrees = [0, 0, 0]; degrees[axis] = THREE.MathUtils.radToDeg(angle); payload.rotation = degrees;
        rotation.set(degrees[0] * Math.PI / 180, degrees[1] * Math.PI / 180, degrees[2] * Math.PI / 180);
      }
      const constrained=latest.current.constrainTransform?.(payload);
      if(constrained)Object.assign(payload,constrained);
      const vertex = new THREE.Vector3();
      for (const [key, indices] of Object.entries(drag.selections)) {
        const entry = state.entries[key], position = entry.geometry.attributes.position; position.array.set(drag.snapshots[key]);
        for (const index of indices) {
          if (drag.align) vertex.fromArray(alignTowardView(Array.from(drag.snapshots[key].subarray(index * 3, index * 3 + 3)), drag.pivot.toArray(), drag.align, 1 - payload.scale[0]));
          else vertex.fromArray(drag.snapshots[key], index * 3).sub(drag.pivot).multiply(scale).applyEuler(rotation).add(drag.pivot).add(translation);
          position.setXYZ(index, vertex.x, vertex.y, vertex.z);
        }
        const positions=constrained?.modelPositions?.[key];
        if(positions)indices.forEach((index,i)=>position.setXYZ(index,...positions.slice(i*3,i*3+3)));
        position.needsUpdate = true; entry.geometry.computeBoundingSphere(); updateWideWireGeometry(entry);
      }
      if (drag.action === 'translate' && drag.poseInverses || drag.align) {
        const modelPositions = {};
        for (const [key, indices] of Object.entries(drag.selections)) {
          const entry = state.entries[key], position = entry.geometry.attributes.position, inverses = drag.poseInverses?.[key], values = [];
          for (let slot = 0; slot < indices.length; slot++) {
            vertex.fromBufferAttribute(position, indices[slot]); if (inverses) vertex.applyMatrix4(inverses[slot]);
            values.push(vertex.x, vertex.y, vertex.z);
          }
          modelPositions[key] = values;
        }
        payload.modelPositions = modelPositions;
      }
      // Coords follows the preview without changing the document or undo history.
      if (latest.current.onTransformPreview) {
        const center = [0, 0, 0]; let count = 0;
        for (const [key, indices] of Object.entries(drag.selections)) {
          const positions = payload.modelPositions?.[key], rendered = state.entries[key].geometry.attributes.position.array;
          for (let slot = 0; slot < indices.length; slot++) {
            for (let axis = 0; axis < 3; axis++) center[axis] += positions ? positions[slot * 3 + axis] : rendered[indices[slot] * 3 + axis];
            count++;
          }
        }
        latest.current.onTransformPreview(center.map(value => value / count));
      }
      drag.payload = payload; drag.moved = drag.action === 'translate' && quad ? Math.hypot(drag.move.point.x - down.x, drag.move.point.y - down.y) > 1 : Math.hypot(dx, dy) > 1;
      invalidate();
    }
    function pointerUp(event) {
      anchorFrame.flush();
      rotating = false; latest.current.onCameraGestureChange?.(false);
      surface.style.cursor = viewportCursor(latest.current.cameraMode, latest.current.rotationNormals ? 'rotateNormals' : latest.current.transformMode);
      const start = down; down = null; setBox(null); controls.enabled = true;
      if (latest.current.onDoubleClickParts) {
        const end = point(event);
        const click = start && ['select', 'translate', 'scale', 'rotate', 'parts'].includes(start.action) && !start.traveled && Math.hypot(end.x - start.x, end.y - start.y) <= 5;
        editClicks = click ? Math.min(2, editClicks + 1) : 0;
      }
      if (!start) return;
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
      if (start.action === 'sketch') { if (event.type === 'pointercancel') sketch.cancel(); else sketch.end(); return; }
      if (start.action === 'parts') { partsFrame.flush(); if (start.parts) start.parts.finish(); else latest.current.onCancelPartDrag?.(); return; }
      if(start.action==='node'){
        const drag=state.nodeDrag;state.nodeDrag=null;
        if(event.type!=='pointercancel'&&drag?.moved)latest.current.onNodeTransform?.({nodeIds:drag.ids,mode:'move',space:'world',values:drag.delta.toArray(),restPose:true,workplaneEnabled:drag.workplaneEnabled,workplane:drag.workplane});
        invalidate();return;
      }
      transformFrame.flush();
      const drag = state.drag; state.drag = null;
      if (drag) {
        latest.current.onTransformPreview?.(null);
        if (drag.moved && drag.payload) latest.current.onTransform?.(drag.payload);
        state.dirty = true; state.selectionKey = ''; invalidate(); return;
      }
      if (start.action === 'anchor') {
        state.anchorCandidate = null; invalidate();
        if (start.anchorCandidate) latest.current.onChooseZoomAnchor?.(start.anchorCandidate);
        return;
      }
      if (start.action !== 'select') return;
      const end = point(event), distance = Math.hypot(end.x - start.x, end.y - start.y), p = latest.current;
      if (distance <= 5 && start.ctrl && p.onInspectGeoset) {
        const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geometry.index.array, vertices: entry.geometry.attributes.position.array }] : []);
        const hit = pickPreviewGeoset(projectPreviewGeosets(geometry, camera, end.width, end.height), end.x, end.y);
        if (hit) p.onInspectGeoset(hit.index);
        return;
      }
      // Every render mode stays editable; textured mode can reject vertices hidden by the surface.
      if (p.onSelectParts) {
        p.onSelectParts({ start, end, camera, grabThrough: p.grabThrough, mode: p.mode });
        return;
      }
      if (p.vertexSelection !== false) {
        const editable = editableGeosets(p), previousSelection = selections(p), found = {}, screen = new THREE.Vector3(), marqueeRadius = Math.max(3, visualOptions(p.preferences).vertexSize / 2); let closest = 5, nearest = null;
        const visibleOnly = p.mode === 'textured' && p.grabThrough === false;
        const selectionDepth = visibleOnly ? createOverlayDepth(projectPreviewGeosets(state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geometry.index.array, vertices: entry.geometry.attributes.position.array }] : []), camera, end.width, end.height), end.width, end.height) : null;
        for (const geosetIndex of editable) {
          const entry = state.entries[geosetIndex], hidden = new Set(p.hiddenVertices?.[geosetIndex] || []); if (!entry?.group.visible) continue;
          const position = entry.geometry.attributes.position; found[geosetIndex] = [];
          for (let i = 0; i < position.count; i++) {
            if (hidden.has(i)) continue;
            screen.fromBufferAttribute(position, i).project(camera); if (screen.z < -1 || screen.z > 1) continue;
            const x = (screen.x + 1) * end.width / 2, y = (1 - screen.y) * end.height / 2;
            if (selectionDepth?.isOccludedForSelection({ x, y, z: screen.z })) continue;
            if (distance > 5) { if (marqueeContainsPoint([x, y], start, end, marqueeRadius)) found[geosetIndex].push(i); }
            else { const d = Math.abs(x - end.x) + Math.abs(y - end.y); if (d < closest) { closest = d; nearest = [geosetIndex, i]; } }
          }
        }
        if (nearest) found[nearest[0]].push(nearest[1]);
        else if (distance <= 5) {
          // Editing picks both sides independently of material culling. The
          // shared barycentric-depth picker retains first-face coincident ties.
          const geosets = [...editable].flatMap(index => {
            const entry = state.entries[index], hidden = new Set(p.hiddenVertices?.[index] || []);
            if (!entry?.group.visible) return [];
            const faces = entry.geometry.index?.array || [], visibleFaces = [];
            for (let i = 0; i + 2 < faces.length; i += 3) if (![faces[i], faces[i+1], faces[i+2]].some(id => hidden.has(id))) visibleFaces.push(faces[i], faces[i+1], faces[i+2]);
            return [{ index, vertices: entry.geometry.attributes.position.array, faces: new Uint32Array(visibleFaces) }];
          });
          const hit = pickPreviewGeoset(projectPreviewGeosets(geosets, camera, end.width, end.height), end.x, end.y);
          if (hit) found[hit.index].push(...hit.ids);
        }
        const next = start.shift || start.ctrl ? { ...previousSelection } : {};
        for (const index of editable) next[index] = applySelection(selectionArray(previousSelection[index]), found[index] || [], start);
        emitSelection(p, next);
        return;
      }
      if (distance > 5) return;
      pointer.set(end.x / end.width * 2 - 1, 1 - end.y / end.height * 2); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(state.entries.flatMap(entry => entry?.meshes.filter(m => m.visible) || []), false);
      const hit = hits.find(h => h.object.parent?.visible);
      if (hit) p.onSelectGeoset?.(hit.object.userData.geosetIndex);
    }
    function doubleClickParts(event) {
      const p = latest.current;
      if (!p.onDoubleClickParts || editClicks < 2 || event.button !== 0 || cameraAction(event) !== 'work') return;
      editClicks = 0;
      const end = point(event);
      p.onDoubleClickParts({ start: { ...end, shift: event.shiftKey }, end, camera, grabThrough: false, mode: p.mode });
    }
    function cancelGesture() {
      editClicks = 0;
      partsFrame.cancel(); partsMove = null; anchorFrame.cancel(); anchorMove = null;
      if (down?.action === 'parts') down.parts?.cancel();
      if (down?.action === 'sketch') sketch.cancel();
      state.nodeDrag=null; transformFrame.cancel(); transformMove = null;
      rotating = false; latest.current.onCameraGestureChange?.(false);
      const drag = state.drag;
      if (drag) latest.current.onTransformPreview?.(null);
      if (drag) for (const [key, vertices] of Object.entries(drag.snapshots)) {
        const position = state.entries[key]?.geometry.attributes.position;
        if (position) { position.array.set(vertices); position.needsUpdate = true; }
      }
      if (quad && down && surface.hasPointerCapture(down.pointerId)) surface.releasePointerCapture(down.pointerId);
      state.drag = null; state.anchorCandidate = null; down = null; setBox(null); controls.enabled = true; state.dirty = true; invalidate();
    }
    state.cancelNormalizer = () => { if (down?.action === 'normalizer') cancelGesture(); };
    const frameModel = event => { cancelGesture(); state.fit(event.detail?.selection === true); };
    const viewCamera = event => { cancelGesture(); if (quad) activatePane(panes.find(pane => pane.id === 'perspective')); if (applyModelCamera(perspective, controls, event.detail)) { camera = perspective; state.camera = camera; state.appliedView = 'perspective'; invalidate(); } };
    window.addEventListener('mdlxl-view-camera', viewCamera);
    const cancelKey = event => { if (!quad && event.key === 'Escape' && down) { cancelGesture(); event.preventDefault(); } };
    const gestureKey = event => {
      if(event.key==='Shift') {
        const shift=event.type==='keydown';
        // A frame still waiting from the last move carries the old Shift; replace it now.
        if(down?.action==='parts'&&down.traveled){partsFrame.cancel();partsMove=null;down.parts?.update({...down.partsEnd,shift});}
        else if(!down&&hoverMove){hoverMove.event.shiftKey=shift;hoverFrame.flush();}
        else if(!down&&partHover)latest.current.onHoverParts?.({...partHover,end:{...partHover.end,shift}});
      }
      if (!quad) return;
      if (event.key === 'Escape' && event.type === 'keydown' && down) { cancelGesture(); event.preventDefault(); event.stopPropagation(); }
      // Modifier transitions must reset the latch even if the mouse is still.
      if (quad && event.key === 'Shift' && state.drag?.action === 'translate') moveDragPoint(state.drag.move, state.drag.move.pointer, event.shiftKey);
    };
    // Hotkeys consumes Escape before viewport key listeners. Its Clear command
    // gives an in-progress drag first refusal through this cancelable event.
    const cancelCommand = event => { if (down) { cancelGesture(); event.preventDefault(); return true; } if (!event.detail?.history && latest.current.onCancelPartDrag?.()) { event.preventDefault(); return true; } return false; };
    const claimWindowKey = claim => {
      const {event,localWindow}=claim.detail,canvas=renderer.domElement;
      if(event.key!=='Escape'||(event.target?.ownerDocument||document)!==canvas.ownerDocument||!canvas.getClientRects().length||localWindow&&!localWindow.contains(canvas))return;
      claim.detail.claims.push({priority:0,run:()=>cancelCommand(claim)});
    };
    const contextMenu = event => event.preventDefault();
    const pointerLeave = () => { if (!down) { hoverFrame.cancel(); hoverMove = null; clearHoveredGeoset(); partHover=null; latest.current.onHoverParts?.(null); } };
    bindInput(singlePane);
    window.addEventListener('mdlvis-frame', frameModel); window.addEventListener('keydown', cancelKey); window.addEventListener('keydown', gestureKey, true); window.addEventListener('keyup', gestureKey, true);
    window.addEventListener('mdlxl-cancel-gesture', cancelCommand);
    window.addEventListener('mdlxl-window-key',claimWindowKey);
    const unwatchContext = watchContextLoss(renderer.domElement, () => { state.scheduler?.dispose(); setError('The graphics context was lost. Reload the editor to restore the viewport. Save your work first.'); });

    let callbackTime = performance.now();
    function render(now, delta) {
      const visible = quad ? panes.slice(1) : [singlePane];
      renderer.setScissorTest(quad);
      for (const pane of visible) {
        bindPane(pane);
        const { left, top, width, height } = pane.rect;
        renderer.setViewport(left, viewportHost.clientHeight - top - height, width, height);
        renderer.setScissor(left, viewportHost.clientHeight - top - height, width, height);
        if (renderPane(now, delta) === false) { bindPane(activePane); return false; }
      }
      bindPane(activePane);
    }
    function renderPane(now, delta) {
      if (state.disposed) return;
      const p = latest.current, renderGraphics = graphicsOptions(p.preferences), visual = visualOptions(p.preferences), appearance = viewportAppearanceOptions(p.preferences);
      const lighting = previewLighting(p.preferences); configurePreviewLights(ambient, key, lighting);
      surface.style.cursor = sketch.tool && !rotating && !altHover && p.cameraMode === 'work' ? SKETCH_CURSORS[sketch.tool] : viewportCursor(p.cameraMode, p.rotationNormals ? 'rotateNormals' : p.transformMode, rotating || sketch.tool && altHover);
      sketch.resolution(surface.clientWidth, surface.clientHeight);
      const overlayHost = quad ? surface : viewportHost;
      syncViewportBackground(appearance);
      ambient.visible = key.visible = renderGraphics.lighting;
      if (p.sequenceIndex !== state.sequenceIndex || !p.playing || !state.wasPlaying || (p.time !== state.lastExternalTime && Math.abs(p.time - (state.lastReportedFrame ?? -Infinity)) > 1)) state.frame = p.time || 0;
      state.sequenceIndex = p.sequenceIndex; state.lastExternalTime = p.time; state.wasPlaying = p.playing;
      if (p.playing && p.sequenceIndex >= 0) {
        state.globalTime += delta;
        state.frame = advanceSequence(p.model?.Sequences?.[p.sequenceIndex], state.frame, delta);
        if (now - callbackTime > 32) { callbackTime = now; state.lastReportedFrame = state.frame; p.onTimeChange?.(state.frame); }
      }
      const overlays = viewportOverlayOptions(p);
      const showMarkers = overlays.bones || overlays.boneLines || overlays.nodes || overlays.attachments || overlays.particles;
      const clipRadius = modelClipRadius(p.model, state.center, state.radius);
      grid.update(p.preferences, p.workplane, overlays.grid, overlays.axes, surface.clientWidth, surface.clientHeight, quad ? { camera, target: controls.target, settings: appearance.quadView.grid } : null);
      platform.update(p.preferences, state.center, state.radius, state.floor || 0);
      const selectedMap = selections(p), editable = editableGeosets(p), active = new Set(p.visibleGeosets ?? editable);
      const selectionKey = `${JSON.stringify(selectedMap, (_, value) => value instanceof Set ? [...value] : value)}|${[...active].join(',')}|${JSON.stringify(p.hiddenVertices, (_, value) => value instanceof Set ? [...value] : value)}|${p.mode}|${p.sequenceIndex}|${p.transformMode}|${JSON.stringify(visual)}`;
      const rgbState = vertexRgbPreviewState(p.model, { enabled: p.rgbPreview, sequenceIndex: p.rgbPreview ? p.rgbPreviewSequenceIndex : p.sequenceIndex, frame: state.frame, globalTime: state.globalTime });
      const changed = state.dirty || state.nodes.some(node => node.Flags & 120) || p.playing || state.sampledFrame !== state.frame || state.sampledSequence !== p.sequenceIndex || (showMarkers && !state.sampledSkeleton) || state.sampledExplicitOverlays !== overlays.explicit;
      const animOptions = { interval: p.model?.Sequences?.[p.sequenceIndex]?.Interval, globalSequences: p.model?.GlobalSequences, globalTime: state.globalTime };
      if (changed && p.model && !state.drag) {
        applyPreviewPose(p, camera);
        state.sampledFrame = state.frame; state.sampledSequence = p.sequenceIndex; state.sampledSkeleton = showMarkers; state.sampledExplicitOverlays = overlays.explicit; state.dirty = false;
      }
      const hidden = p.hiddenGeosets instanceof Set ? p.hiddenGeosets : new Set(p.hiddenGeosets || []);
      for (let index = 0; index < state.entries.length; index++) {
        const entry = state.entries[index]; if (!entry) continue;
        const chosen = active.has(index), selection = selectionArray(selectedMap[index]);
        const hovered = p.hoveredGeoset === index;
        const geosetAnim = state.geosetAnims.get(index);
        const alpha = p.sequenceIndex >= 0 ? sampleTrack(geosetAnim?.Alpha, state.frame, { ...animOptions, fallback: 1 }) : typeof geosetAnim?.Alpha === 'number' ? geosetAnim.Alpha : 1;
        entry.group.visible = hovered || (!hidden.has(index) && (alpha > .001 || p.mode !== 'textured'));
        entry.hoverWire.visible = hovered; entry.hoverPoints.visible = hovered && appearance.geosetHighlight.type === 'wire-vertices' && (!chosen || editable.has(index));
        const pureWireframe = p.mode === 'wireframe' || p.mode === 'vertices';
        const activeAppearance = chosen ? appearance.selectedGeoset : appearance.otherGeoset;
        const pointDepth = viewportPointDepth(pureWireframe, appearance.xrayVertices, p.mode === 'textured' && p.grabThrough === true);
        const editOverlay = p.modelingOverlay?.[index];
        const showPoints = overlays.vertices && editable.has(index) && (!editOverlay || editOverlay.mode === 'Vertices'), showHiddenPoints = showPoints && pointDepth.showHidden;
        entry.points.visible = entry.selectedPoints.visible = showPoints;
        entry.hiddenPoints.visible = entry.hiddenSelectedPoints.visible = showHiddenPoints;
        configurePointMaterial(entry.points.material, appearance.unselectedVertex, markerTexture(appearance.unselectedVertex.style));
        configurePointMaterial(entry.hiddenPoints.material, appearance.unselectedVertex, markerTexture(appearance.unselectedVertex.style));
        configurePointMaterial(entry.selectedPoints.material, appearance.selectedVertex, markerTexture(appearance.selectedVertex.style));
        configurePointMaterial(entry.hiddenSelectedPoints.material, appearance.selectedVertex, markerTexture(appearance.selectedVertex.style));
        if (editOverlay) {
          entry.points.material.color.set(0x222222); entry.hiddenPoints.material.color.set(0x222222);
          entry.selectedPoints.material.color.set(0xff9a22); entry.hiddenSelectedPoints.material.color.set(0xff9a22);
        }
        entry.points.material.depthTest = entry.selectedPoints.material.depthTest = pointDepth.depthTest;
        entry.hiddenPoints.material.depthTest = entry.hiddenSelectedPoints.material.depthTest = true;
        entry.wire.visible = !!editOverlay || pureWireframe || overlays.wires;
        entry.hiddenWire.visible = pureWireframe && visual.occludedOpacity > 0 && activeAppearance.opacity > 0;
        // Textured/solid General View already produces the correct depth from
        // its real materials, including alpha-tested holes and translucent
        // layers. The geometry-only prepass is reserved for modes where those
        // surface meshes are absent; otherwise it turns alpha planes opaque.
        entry.depth.visible = needsSolidDepthPrepass(p.mode);
        configureWideLine(entry.wire.material, activeAppearance, surface.clientWidth, surface.clientHeight);
        // Hidden-line wireframe draws the edges the mesh hides as faint dashes.
        const hiddenLine = appearance.wireMode === 'hidden-line';
        configureWideLine(entry.hiddenWire.material, hiddenLine ? { ...activeAppearance, style: 'dashed', spacing: HIDDEN_LINE_DASH[0] } : activeAppearance, surface.clientWidth, surface.clientHeight, visual.occludedOpacity * (hiddenLine ? HIDDEN_LINE_FADE : 1));
        if (editOverlay) {
          configureWideLine(entry.wire.material, { color: editOverlay.preview?'#ffae38':'#303030', thickness: editOverlay.preview?2:1, opacity: editOverlay.preview?1:.7, style: 'solid' }, surface.clientWidth, surface.clientHeight);
          entry.wire.material.depthTest = !editOverlay.preview;
          configureWideLine(entry.selectedWire.material, { color: '#ff9a22', thickness: 1.7, opacity: 1, style: 'solid' }, surface.clientWidth, surface.clientHeight);
          entry.selectedWire.visible = editOverlay.selectedEdgeIndices.length > 0;
          entry.selectedSurface.visible = !pureWireframe && editOverlay.selectedFaceIndices.length > 0;
          entry.selectedWire.material.depthTest = entry.selectedSurface.material.depthTest = !editOverlay.preview;
          if (entry.appliedOverlay !== editOverlay) {
            entry.selectedEdgeIndices = editOverlay.selectedEdgeIndices;
            entry.selectedSurface.geometry.setIndex(editOverlay.selectedFaceIndices);
            updateWideWireGeometry(entry); entry.appliedOverlay = editOverlay;
          }
        }
        configureGeosetHighlightMaterial(entry.hoverWire.material, entry.hoverPoints.material, appearance.geosetHighlight);
        for (let layerIndex = 0; layerIndex < entry.meshes.length; layerIndex++) {
          const mesh = entry.meshes[layerIndex], material = mesh.material, layer = entry.layers[layerIndex];
          applyPreviewMaterialLighting(material, lighting);
          const coverage = layer.FilterMode === 1 && renderGraphics.antialias;
          if (material.alphaToCoverage !== coverage) { material.alphaToCoverage = coverage; material.needsUpdate = true; }
          mesh.visible = !pureWireframe && (p.mode === 'textured' || layerIndex === 0);
          const textureIndex = Math.round(sampleTrack(layer.TextureID, state.frame, { ...animOptions, fallback: 0 }));
          const textureInfo = p.model?.Textures?.[textureIndex];
          const textured = p.mode === 'textured' && renderGraphics.textures;
          // A geoset without a material (a new Forge item) shows its clay colour.
          const map = !textured || entry.clay !== undefined || textureInfo?.ReplaceableId === 1 ? null : textureInfo?.ReplaceableId === 2 ? state.teamGlow : state.textures.get(textureIndex) || state.checker;
          if (material.map !== map) { material.map = map; material.needsUpdate = true; }
          material.color.set(textured && entry.clay !== undefined ? entry.clay : textured ? textureInfo?.ReplaceableId === 1 || textureInfo?.ReplaceableId === 2 ? p.teamColor : 0xffffff : p.rgbPreview ? 0xffffff : p.surfaceColors?.[index] ?? COLORS[index % COLORS.length]);
          material.userData.geosetTint.value.set(1, 1, 1);
          if ((p.rgbPreview || p.presentation === 'preview') && !pureWireframe) {
            const sampled = sampleGeosetAnimation(p.model, index, rgbState.frame, rgbState.sequenceIndex, rgbState.globalTime);
            material.userData.geosetTint.value.fromArray(sampled.color);
          }
          material.opacity = editOverlay?.preview ? .45 : textured ? Math.max(0, Math.min(1, alpha * sampleTrack(layer.Alpha, state.frame, { ...animOptions, fallback: 1 }))) : 1;
          const transparent = !!editOverlay?.preview || textured && ((layer.FilterMode || 0) >= 2 || material.opacity < 1);
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          // Clockwise faces are culled; counterclockwise winding is front-facing.
          material.side = layer.Shading & 16 ? THREE.DoubleSide : THREE.FrontSide;
          material.depthWrite = !editOverlay?.preview && (!textured || (!(layer.Shading & 128) && (layer.FilterMode || 0) < 2));
          material.blending = textured ? material.userData.layerBlending : THREE.NormalBlending;
          material.alphaTest = textured && layer.FilterMode === 1 ? .75 : 0;
          material.depthTest = !textured || !(layer.Shading & 64);
          if (changed && Number.isInteger(layer.TVertexAnimId) && layer.TVertexAnimId >= 0) {
            const uv = mesh.geometry.attributes.uv, baseUV = mesh.userData.baseUV, textureAnim = p.model?.TextureAnims?.[layer.TVertexAnimId];
            uv.array.set(baseUV);
            if (textureAnim && p.sequenceIndex >= 0) {
              const translation = new THREE.Vector3().fromArray(sampleTrack(textureAnim.Translation, state.frame, { ...animOptions, fallback: [0, 0, 0] }));
              const rotation = new THREE.Quaternion().fromArray(sampleTrack(textureAnim.Rotation, state.frame, { ...animOptions, fallback: [0, 0, 0, 1], quaternion: true }));
              const scale = new THREE.Vector3().fromArray(sampleTrack(textureAnim.Scaling, state.frame, { ...animOptions, fallback: [1, 1, 1] }));
              const transform = new THREE.Matrix4().compose(translation, rotation, scale), value = new THREE.Vector3();
              for (let vertex = 0; vertex < uv.count; vertex++) { value.set(baseUV[vertex * 2], baseUV[vertex * 2 + 1], 0).applyMatrix4(transform); uv.setXY(vertex, value.x, value.y); }
            }
            uv.needsUpdate = true;
          }
        }
        if (selectionKey !== state.selectionKey) {
          if (chosen) {
            const indices = viewportPointIndices(entry.geometry.attributes.position.count, selection, p.hiddenVertices?.[index]);
            entry.points.geometry.setIndex(indices.unselected); entry.hiddenPoints.geometry.setIndex(indices.unselected);
            entry.selectedPoints.geometry.setIndex(indices.selected); entry.hiddenSelectedPoints.geometry.setIndex(indices.selected);
          }
        }
      }
      state.selectionKey = selectionKey;
      controls.update();
      updateDepthClipping(camera, state.center, clipRadius, quad ? grid.userData.extent : gridDepthExtent(state.center, gridOptions(p.preferences).extent));
      const light = cameraLeftLight(camera, controls.target, state.radius);
      key.position.copy(light.position); key.target.position.copy(controls.target);
      ambient.position.copy(light.direction);
      try { modelSmoothing.render(scene, camera, renderGraphics.antialias, [grid, platform]);
        if (p.editHandles) {
          if (!editCanvas) { editCanvas = document.createElement('canvas'); editCanvas.dataset.editHandles = ''; editCanvas.setAttribute('aria-label', 'Shaping handles'); editCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; overlayHost.appendChild(editCanvas); }
          drawEditHandles(editCanvas, p.editHandles, camera, surface.clientWidth, surface.clientHeight, renderer.getPixelRatio());
        } else if (editCanvas) { editCanvas.remove(); editCanvas = null; }
        const gizmoAt = gizmoPivot(p), gizmoScreen = gizmoAt?.clone().project(camera);
        state.gizmoHandles = gizmoScreen ? movementAxisHandles({ world: gizmoAt, x: (gizmoScreen.x + 1) * surface.clientWidth / 2, y: (1 - gizmoScreen.y) * surface.clientHeight / 2, visible: gizmoScreen.z >= -1 && gizmoScreen.z <= 1 }, camera, surface.clientWidth, surface.clientHeight, state.radius, 'world', 'move') : [];
        if (state.gizmoHandles.length) {
          if (!gizmoCanvas) { gizmoCanvas = document.createElement('canvas'); gizmoCanvas.dataset.moveGizmo = ''; gizmoCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'; overlayHost.appendChild(gizmoCanvas); }
          gizmoCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); gizmoCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          drawMovementGizmo(gizmoCanvas.getContext('2d'), state.gizmoHandles, renderer.getPixelRatio(), state.drag?.handle?.axis, viewportAppearanceOptions(p.preferences).controllers);
        } else if (gizmoCanvas) { gizmoCanvas.remove(); gizmoCanvas = null; }
        if(p.detailMagnet&&(!quad||boundPane===activePane)){
          if(!magnetButton){
            magnetButton=document.createElement('button');magnetButton.type='button';magnetButton.dataset.detailMagnet='';magnetButton.appendChild(document.createElement('canvas'));
            magnetButton.style.cssText='position:absolute;z-index:4;border:0;padding:0;background:transparent;cursor:pointer;line-height:0';
            magnetButton.addEventListener('pointerdown',event=>event.stopPropagation());
            magnetButton.addEventListener('click',event=>{event.stopPropagation();latest.current.detailMagnet?.onToggle();});
          }
          if(magnetButton.parentNode!==overlayHost)overlayHost.appendChild(magnetButton);
          const appearance=viewportAppearanceOptions(p.preferences).controllers,size=appearance.size,diameter=size*2+8,ratio=renderer.getPixelRatio(),canvas=magnetButton.firstChild;
          magnetButton.style.width=magnetButton.style.height=diameter+'px';canvas.width=canvas.height=Math.round(diameter*ratio);canvas.style.width=canvas.style.height=diameter+'px';
          magnetButton.setAttribute('aria-label',translate('Magnet'));magnetButton.setAttribute('aria-pressed',String(p.detailMagnet.enabled));
          magnetButton.title=translate(p.detailMagnet.enabled?'Magnet on: stays on this surface and stops at its edges. Click to release.':'Magnet: attach this block to the nearest surface and keep it within the edges.');
          magnetButton.dataset.shape=appearance.shape;
          drawPoseOverlay(canvas.getContext('2d'),[{visible:true,label:'Magnet',x:size+4,y:size+4,size,shape:appearance.shape}],ratio,null,{...appearance,symbols:true,color:p.detailMagnet.enabled?appearance.pinned:appearance.color});
          // Project the live block, not a cached sphere or a gizmo-dependent
          // offset. The magnet stays just above its visible bounds.
          const entry=state.entries[p.detailMagnet.geoset],positions=entry.geometry.attributes.position,points=[];
          for(let i=0;i<positions.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(positions,i).project(camera));
          const width=surface.clientWidth,height=surface.clientHeight,minX=Math.min(...points.map(p=>(p.x+1)*width/2)),maxX=Math.max(...points.map(p=>(p.x+1)*width/2)),minY=Math.min(...points.map(p=>(1-p.y)*height/2));
          const x=Math.max(4,Math.min(width-diameter-4,(minX+maxX)/2-diameter/2)),y=Math.max(4,Math.min(height-diameter-4,minY-diameter-6));
          magnetButton.style.left=x+'px';magnetButton.style.top=y+'px';
        } else if(!p.detailMagnet&&magnetButton){magnetButton.remove();magnetButton=null;}
        if (p.presentation === 'preview' && previewOverlaySettings(p.previewOverlay).mode !== 'none') {
          if (!previewCanvas) { previewCanvas = document.createElement('canvas'); previewCanvas.dataset.geometryOverlay = ''; previewCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; overlayHost.appendChild(previewCanvas); }
          previewCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); previewCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geoset.Faces, vertices: entry.geometry.attributes.position.array }] : []);
          drawPresentationOverlay(previewCanvas.getContext('2d'), geometry, camera, surface.clientWidth, surface.clientHeight, p.previewOverlay, renderer.getPixelRatio());
        } else if (previewCanvas) { previewCanvas.remove(); previewCanvas = null; }
        if (p.overlays?.normals || p.showNormals || p.normalChanges) {
          if (!normalCanvas) { normalCanvas = document.createElement('canvas'); normalCanvas.dataset.normalOverlay = ''; normalCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; overlayHost.appendChild(normalCanvas); }
          normalCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); normalCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible && active.has(index) ? [{ index, vertices: entry.geometry.attributes.position.array, normals: entry.geometry.attributes.normal.array }] : []);
          drawPreviewGeometryOverlay(normalCanvas.getContext('2d'), geometry, camera, surface.clientWidth, surface.clientHeight, { normals: true, normalChanges: p.normalChanges, preferences: p.preferences }, state.center, state.radius, renderer.getPixelRatio());
        } else if (normalCanvas) { normalCanvas.remove(); normalCanvas = null; }
        if (showMarkers) {
          if (!nodeCanvas) { nodeCanvas = document.createElement('canvas'); nodeCanvas.dataset.nodeOverlay = ''; nodeCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; overlayHost.appendChild(nodeCanvas); }
          nodeCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); nodeCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const width = surface.clientWidth, height = surface.clientHeight;
          const nodes = projectMovementNodes(p.model, state.frame, p.sequenceIndex, camera, width, height, state.globalTime, state.matrices,p.vanilla);
          if(state.nodeDrag)for(const point of nodes)if(state.nodeDrag.ids.includes(point.node.ObjectId)){point.world.add(state.nodeDrag.delta);const projected=point.world.clone().project(camera);point.x=(projected.x+1)*width/2;point.y=(1-projected.y)*height/2;}
          const options = { ...overlays, vanilla:p.vanilla, preferences: p.preferences, glMarkers: true, wireframeMarkers: p.mode === 'wireframe' || p.mode === 'vertices', occludedMarkerEdges: p.mode === 'solid' || p.mode === 'textured' };
          if (!quad) renderer.resetState();
          rigMarkers.draw(camera, nodes, p.selectedNodeIds || [], options); renderer.resetState(); renderer.setScissorTest(quad);
          drawMovementOverlay(nodeCanvas.getContext('2d'), nodes, p.selectedNodeIds || [], [], width, height, renderer.getPixelRatio(), options);
        } else if (nodeCanvas) { nodeCanvas.remove(); nodeCanvas = null; }
        if (p.overlays?.cameras ?? p.showCameras) {
          if (!cameraCanvas) { cameraCanvas = document.createElement('canvas'); cameraCanvas.dataset.cameraOverlay = ''; cameraCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; overlayHost.appendChild(cameraCanvas); }
          cameraCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); cameraCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          drawModelCameraOverlay(cameraCanvas.getContext('2d'), p.model || {}, camera, surface.clientWidth, surface.clientHeight, renderer.getPixelRatio(), state.frame, p.sequenceIndex, state.globalTime, state.radius, visual.node);
        } else if (cameraCanvas) { cameraCanvas.remove(); cameraCanvas = null; }
        const overlayPoint = value => {
          const entry = value && state.entries[value.geosetIndex], position = entry?.geometry.attributes.position;
          if (!position || value.vertexIndex < 0 || value.vertexIndex >= position.count || !entry.group.visible) return null;
          const projected = new THREE.Vector3().fromBufferAttribute(position, value.vertexIndex).project(camera);
          return projected.z >= -1 && projected.z <= 1 ? projected : null;
        };
        const anchorPoint = overlayPoint(p.zoomAnchor), candidatePoint = overlayPoint(p.choosingZoomAnchor ? state.anchorCandidate : null);
        if (anchorPoint || candidatePoint) {
          if (!anchorCanvas) { anchorCanvas = document.createElement('canvas'); anchorCanvas.dataset.anchorOverlay = ''; anchorCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2'; overlayHost.appendChild(anchorCanvas); }
          anchorCanvas.width = Math.round(surface.clientWidth * renderer.getPixelRatio()); anchorCanvas.height = Math.round(surface.clientHeight * renderer.getPixelRatio());
          const context = anchorCanvas.getContext('2d'), pixelRatio = renderer.getPixelRatio(), width = surface.clientWidth, height = surface.clientHeight;
          context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, anchorCanvas.width, anchorCanvas.height);
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.fillStyle = p.choosingZoomAnchor === 'align' ? '#ff4fd8' : '#39ff14';
          if (candidatePoint) {
            context.beginPath(); context.arc((candidatePoint.x + 1) * width / 2, (1 - candidatePoint.y) * height / 2, 7, 0, Math.PI * 2); context.fill();
          }
          if (anchorPoint) {
            context.font = 'bold 12px Tahoma, Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'bottom';
            context.fillStyle = p.zoomAnchor.kind === 'align' ? '#ff4fd8' : '#39ff14';
            context.fillText(p.zoomAnchor.kind === 'align' ? 'ALIGN' : 'ANCHOR', (anchorPoint.x + 1) * width / 2, (1 - anchorPoint.y) * height / 2 - 10);
          }
        } else if (anchorCanvas) { anchorCanvas.remove(); anchorCanvas = null; }
      }
      catch (cause) { setError(`Preview error: ${cause.message}`); return false; }
    }
    state.scheduler = createRenderScheduler({ render,
      continuous: () => {
        const p = latest.current, sequence = p.model?.Sequences?.[p.sequenceIndex];
        return p.playing && p.sequenceIndex >= 0 && !(sequence?.NonLooping && state.frame >= sequence.Interval?.[1]);
      },
      paused: () => latest.current.suspended || (document.hidden && graphicsOptions(latest.current.preferences).pauseWhenHidden),
      maxFps: () => graphicsOptions(latest.current.preferences).maxFps,
    });
    document.addEventListener('visibilitychange', state.scheduler.sync);
    state.scheduler.invalidate();
    state.captureApi = {captureView() {
      if (state.disposed || render(performance.now(), 0) === false) throw new Error('The model viewport could not render a capture.');
      return composeViewportLayers(viewportHost, renderer.domElement);
    }};
    latest.current.onCaptureReady?.(state.captureApi);
    return () => {
      latest.current.onCaptureReady?.(null);
      if (state.drag) latest.current.onTransformPreview?.(null);
      savePane();
      const remember = pane => ({ id: pane.id, view: pane.view, ...snapshotPreviewCamera(pane.camera, pane.perspective, pane.ortho, pane.controls), center: pane.center.clone(), radius: pane.radius });
      cameraMemory.current = { ...remember(singlePane), panes: panes.slice(1).map(remember) };
      if (latest.current.cameraHandoff) {
        // Quad panes own their cameras. Other editors inherit the single view.
        latest.current.cameraHandoff.current = { ...remember(singlePane), camera: singlePane.camera === singlePane.ortho ? 'ortho' : 'perspective' };
      }
      state.disposed = true; sketch.dispose(); transformFrame.cancel(); partsFrame.cancel(); anchorFrame.cancel(); hoverFrame.cancel(); cameraReport.cancel(); state.scheduler.dispose(); document.removeEventListener('visibilitychange', state.scheduler.sync); resizeObserver.disconnect(); panes.forEach(pane => { pane.dispose(); pane.grid.dispose(); });
      unwatchContext();
      window.removeEventListener('mdlvis-frame', frameModel); window.removeEventListener('mdlxl-view-camera', viewCamera); window.removeEventListener('keydown', cancelKey); window.removeEventListener('keydown', gestureKey, true); window.removeEventListener('keyup', gestureKey, true);
      window.removeEventListener('mdlxl-cancel-gesture', cancelCommand); window.removeEventListener('mdlxl-window-key',claimWindowKey);
      cameraCanvas?.remove(); normalCanvas?.remove(); nodeCanvas?.remove(); previewCanvas?.remove(); anchorCanvas?.remove(); editCanvas?.remove(); gizmoCanvas?.remove(); magnetButton?.remove(); rigMarkers.dispose(); platform.dispose(); clearGroup(modelGroup); state.textures.forEach(texture => texture.dispose()); state.markerTextures.forEach(texture => texture.dispose()); state.background.texture.dispose(); state.checker.dispose(); state.teamGlow.dispose(); modelSmoothing.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const state = runtime.current; if (!state) return;
    if (state.drag) latest.current.onTransformPreview?.(null);
    state.drag = null; clearGroup(state.modelGroup); state.entries = []; state.nodes = allNodes(model || {}); state.selectionKey = ''; state.dirty = true;
    state.geosetAnims = new Map((model?.GeosetAnims || []).map(anim => [anim.GeosetId, anim]));
    state.scheduler?.invalidate();
    if (!model) return;
    const clay = clayColors(model);
    for (let index = 0; index < (model.Geosets || []).length; index++) {
      const geoset = model.Geosets[index], group = new THREE.Group(), geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geoset.Vertices), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(geoset.Faces), 1));
      if (geoset.Normals?.length === geoset.Vertices.length) geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geoset.Normals), 3)); else geometry.computeVertexNormals();
      const layers = model.Materials?.[geoset.MaterialID]?.Layers?.length ? model.Materials[geoset.MaterialID].Layers : [{ TextureID: 0, Alpha: 1, Shading: 16 }];
      const meshes = [];
      for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
        const layer = layers[layerIndex], layerGeometry = layerIndex === 0 ? geometry : new THREE.BufferGeometry();
        if (layerIndex) { layerGeometry.setAttribute('position', geometry.attributes.position); layerGeometry.setAttribute('normal', geometry.attributes.normal); layerGeometry.setIndex(geometry.index); }
        const uv = geoset.TVertices?.[layer.CoordId || 0] || geoset.TVertices?.[0];
        layerGeometry.setAttribute('uv', new THREE.BufferAttribute(uv?.length ? new Float32Array(uv) : new Float32Array(geoset.Vertices.length / 3 * 2), 2));
        const material = layerMaterial(layer, shaded && graphics.lighting); material.polygonOffset = false;
        material.flatShading = !!props.modelingOverlay;
        // Coverage is enabled only while rendering into the multisampled model target.
        material.alphaToCoverage = layer.FilterMode === 1 && graphics.antialias;
        const mesh = new THREE.Mesh(layerGeometry, material); mesh.layers.set(MODEL_LAYER); mesh.userData.geosetIndex = index; mesh.userData.baseUV = new Float32Array(layerGeometry.attributes.uv.array); mesh.renderOrder = index * 16 + layerIndex; mesh.frustumCulled = false; group.add(mesh); meshes.push(mesh);
      }
      const depth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })); depth.layers.set(MODEL_LAYER); depth.renderOrder = -1; depth.frustumCulled = false; group.add(depth);
      const edgeIndices = props.modelingOverlay?.[index]?.edgeIndices || uniqueEdges(geoset.Faces), wireGeometry = new LineSegmentsGeometry();
      const wire = new LineSegments2(wireGeometry, new LineMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: 1, depthTest: true, depthWrite: false })); wire.renderOrder = 10000; wire.frustumCulled = false; wire.userData.overlay = 'wires'; group.add(wire);
      const hiddenWire = new LineSegments2(wireGeometry, new LineMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: .35, depthTest: true, depthFunc: THREE.GreaterDepth, depthWrite: false })); hiddenWire.renderOrder = 9999; hiddenWire.frustumCulled = false; group.add(hiddenWire);
      const pointGeometry = new THREE.BufferGeometry(); pointGeometry.setAttribute('position', geometry.attributes.position);
      const hiddenPointGeometry = new THREE.BufferGeometry(); hiddenPointGeometry.setAttribute('position', geometry.attributes.position);
      const selectedPointGeometry = new THREE.BufferGeometry(); selectedPointGeometry.setAttribute('position', geometry.attributes.position);
      const hiddenSelectedPointGeometry = new THREE.BufferGeometry(); hiddenSelectedPointGeometry.setAttribute('position', geometry.attributes.position);
      const pointMaterial = options => new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, depthTest: true, depthWrite: false, ...options });
      const points = new THREE.Points(pointGeometry, pointMaterial()); points.frustumCulled = false; points.renderOrder = 11000; points.userData.overlay = 'vertices'; group.add(points);
      const hiddenPoints = new THREE.Points(hiddenPointGeometry, pointMaterial({ depthFunc: THREE.GreaterDepth })); hiddenPoints.frustumCulled = false; hiddenPoints.renderOrder = 10999; group.add(hiddenPoints);
      const selectedPoints = new THREE.Points(selectedPointGeometry, pointMaterial()); selectedPoints.frustumCulled = false; selectedPoints.renderOrder = 11001; selectedPoints.userData.overlay = 'vertices'; group.add(selectedPoints);
      const hiddenSelectedPoints = new THREE.Points(hiddenSelectedPointGeometry, pointMaterial({ depthFunc: THREE.GreaterDepth })); hiddenSelectedPoints.frustumCulled = false; hiddenSelectedPoints.renderOrder = 11000; group.add(hiddenSelectedPoints);
      const hoverWire = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide }));
      hoverWire.renderOrder = 13000; hoverWire.frustumCulled = false; hoverWire.visible = false; group.add(hoverWire);
      const hoverGeometry = new THREE.BufferGeometry(); hoverGeometry.setAttribute('position', geometry.attributes.position);
      const hoverPoints = new THREE.Points(hoverGeometry, new THREE.PointsMaterial({ color: 0x39ff14, size: 6, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
      hoverPoints.renderOrder = 13001; hoverPoints.frustumCulled = false; hoverPoints.visible = false; group.add(hoverPoints);
      let selectedWire, selectedSurface;
      if (props.modelingOverlay) {
        selectedWire = new LineSegments2(new LineSegmentsGeometry(), new LineMaterial({ color: 0xff9a22, linewidth: 1.7, depthTest: true, depthWrite: false })); selectedWire.renderOrder = 10001; selectedWire.frustumCulled = false; group.add(selectedWire);
        const selectedGeometry = new THREE.BufferGeometry(); selectedGeometry.setAttribute('position', geometry.attributes.position); selectedGeometry.setIndex([]);
        selectedSurface = new THREE.Mesh(selectedGeometry, new THREE.MeshBasicMaterial({ color: 0xff9a22, opacity: .22, transparent: true, side: THREE.DoubleSide, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); selectedSurface.renderOrder = 9998; selectedSurface.frustumCulled = false; group.add(selectedSurface);
      }
      state.modelGroup.add(group); state.entries[index] = { geoset, clay: clay.get(index), group, geometry, meshes, layers, depth, edgeIndices, wireGeometry, wire, hiddenWire, points, hiddenPoints, selectedPoints, hiddenSelectedPoints, hoverWire, hoverPoints, selectedWire, selectedSurface };
      updateWideWireGeometry(state.entries[index]);
    }
    const signature = `${model.Info?.Name}|${model.Geosets?.map(g => g.Vertices.length).join(',')}`;
    if (state.loadedSignature === null) {
      state.loadedSignature = signature; state.fit();
      const saved = cameraMemory.current || latest.current.cameraHandoff?.current;
      if (saved && (latest.current.quadView || saved.view === latest.current.view || latest.current.cameraHandoff?.current === saved)) { if (latest.current.quadView) state.setView(saved.view); state.restoreCamera(saved); if (saved.center) state.center.copy(saved.center); if (saved.radius) state.radius=saved.radius; state.resize(); state.controls.update(); }
    }
  }, [model, revision, shaded, graphics.lighting, !!props.modelingOverlay]);

  useEffect(() => {
    const state = runtime.current; if (!state) return;
    let cancelled = false;
    setTextureMessage('');
    if (!graphics.textures) {
      state.textures.forEach(texture => texture.dispose()); state.textures.clear(); state.textureSources.clear(); state.scheduler?.invalidate(); return;
    }
    // Wireframe, solid and vertex editing do not decode textures. Switching view
    // modes keeps already loaded textures available without loading them again.
    if (!texturesNeeded) return;
    const assets = textureAssets instanceof Map ? textureAssets : new Map(Object.entries(textureAssets || {}));
    const normalized = new Map([...assets].map(([path, asset]) => [normalizedPath(path), asset]));
    for (const index of state.textureSources.keys()) if (index >= (model?.Textures?.length || 0)) { state.textures.get(index)?.dispose(); state.textures.delete(index); state.textureSources.delete(index); }
    const failures = [], jobs = (model?.Textures || []).map(async (texture, index) => {
      const path = normalizedPath(texture.Image);
      const asset = normalized.get(path) || normalized.get(path.split('\\').at(-1));
      const key = `${path}|${texture.Flags}|${texture.ReplaceableId}`, previous = state.textureSources.get(index);
      if (previous && previous.asset === asset && previous.key === key) { if (previous.error) failures.push(previous.error); return; }
      state.textures.get(index)?.dispose(); state.textures.delete(index);
      const source = { asset, key }; state.textureSources.set(index, source);
      if (!asset || texture.ReplaceableId) { state.scheduler?.invalidate(); return; }
      try {
        const loaded = await textureFromAsset(asset, texture);
        if (state.disposed || state.textureSources.get(index) !== source) loaded.dispose();
        else { configureEditorTexture(loaded, state.renderer.capabilities.getMaxAnisotropy()); state.textures.set(index, loaded); state.scheduler?.invalidate(); }
      }
      catch (cause) { source.error = `${texture.Image}: ${cause.message}`; failures.push(source.error); }
    });
    Promise.all(jobs).then(() => { if (!cancelled && failures.length) setTextureMessage(failures.join('; ')); });
    return () => { cancelled = true; };
  }, [textureSignature, textureAssets, texturesNeeded, graphics.textures]);

  useEffect(() => { props.onCaptureReady?.(runtime.current?.captureApi || null); }, [props.onCaptureReady]);
  useEffect(() => { runtime.current?.sketch?.configure({ enabled: props.sketchDocument != null, documentId: props.sketchDocument }); }, [props.sketchDocument]);
  useEffect(() => { if (!props.normalizer) runtime.current?.cancelNormalizer?.(); }, [!!props.normalizer]);
  useEffect(() => { runtime.current?.setQuad(props.quadView); }, [props.quadView]);
  useEffect(() => { if(!props.quadView && runtime.current && runtime.current.appliedView !== view) runtime.current.setView(view); }, [view, props.quadView]);
  useEffect(() => { if (props.quadView && props.viewRequest) runtime.current?.setView(props.viewRequest.view); }, [props.viewRequest]);
  useEffect(() => { if (props.cameraAnglesRequest) runtime.current?.setCameraAngles(props.cameraAnglesRequest); }, [props.cameraAnglesRequest]);
  useEffect(() => { runtime.current?.refreshCursor(); }, [cameraMode, transformMode, props.rotationNormals]);
  useEffect(() => { if (props.frameRequest) runtime.current?.fit(props.frameRequest.selection === true); }, [props.frameRequest]);
  useEffect(() => { setAdjustingSensitivity(null); }, [props.preferences?.wheelMode]);
  useEffect(() => { const controls = runtime.current?.controls; if (controls) controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(props.preferences?.pointerSensitivity); }, [props.preferences?.pointerSensitivity]);
  useEffect(() => { runtime.current?.resize(); }, [graphics.pixelRatio, showGrid, props.overlays?.grid, props.preferences?.grid]);
  useEffect(() => { runtime.current?.scheduler.sync(); }, [props.detailMagnet, props.constrainTransform, props.normalizer, props.normalChanges, props.presentation, props.previewMode, props.previewOverlay, props.modelingOverlay, props.editHandles, props.surfaceColors, props.selectedNodeIds, model, revision, props.hoveredGeoset, selectedGeoset, selectedVertices, props.selectionByGeoset, props.selectableGeosets, props.visibleGeosets, hiddenGeosets, props.hiddenVertices, mode, showSkeleton, showGrid, props.showAxes, props.showVertices, props.overlays, props.showCameras, props.preferences, props.grabThrough, props.rgbPreview, props.rgbPreviewSequenceIndex, workplane, props.workplaneEnabled, transformMode, props.zoomAnchor, props.choosingZoomAnchor, sequenceIndex, time, playing, teamColor, props.suspended, graphics.maxFps, graphics.pauseWhenHidden, graphics.textures, graphics.lighting]);
  return <div className="viewport" style={{ position: 'relative', width: '100%', height: '100%', minHeight: props.presentation === 'preview' ? 0 : 180, background: '#ccc', overflow: 'hidden' }}>
    <div ref={host} tabIndex={0} aria-label="3D model viewport" style={{ position: 'absolute', inset: 0, outline: 'none', cursor: viewportCursor(cameraMode, transformMode) }} />
    {!props.quadView && props.showOrientationCompass !== false && props.presentation !== 'preview' && <div className="viewport-orientation-compass" aria-label="View orientation" title="View orientation — click an axis to snap the camera" style={{ position: 'absolute', top: 31, left: 4, width: 82, height: 82, zIndex: 3, filter: 'drop-shadow(0 1px 2px #0008)' }}>
      <svg viewBox="0 0 82 82" width="82" height="82" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <circle cx="41" cy="41" r="34" fill="#18202bdd" stroke="#c8d6e8aa" />
        {compassAxes.map(axis => <g key={axis.id} opacity={axis.depth < -.2 ? .48 : 1}><line x1="41" y1="41" x2={41 + axis.x * 25} y2={41 + axis.y * 25} stroke={axis.color} strokeWidth="3" strokeLinecap="round" /><circle cx={41 + axis.x * 25} cy={41 + axis.y * 25} r="7" fill={axis.color} stroke="#fff9" /></g>)}
        <circle cx="41" cy="41" r="5" fill="#e7eef8" stroke="#1b2430" />
      </svg>
      {compassAxes.map(axis => <button key={axis.id} type="button" aria-label={axis.title} title={axis.title} onPointerDown={event => event.stopPropagation()} onClick={() => props.onViewChange?.(axis.view)} style={{ position: 'absolute', left: 41 + axis.x * 25, top: 41 + axis.y * 25, width: 20, height: 20, transform: 'translate(-50%, -50%)', border: 0, borderRadius: '50%', padding: 0, background: 'transparent', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '20px', textShadow: '0 1px 1px #000', cursor: 'pointer' }}>{axis.label}</button>)}
    </div>}
    <SensitivityIndicator value={adjustingSensitivity} />
    {textureMessage && <div role="status" style={{ position: 'absolute', bottom: 4, left: 5, color: '#fff0cb', fontSize: 11, pointerEvents: 'none' }}>{textureMessage}</div>}
    {backgroundMessage && <div role="status" style={{ position: 'absolute', top: 4, left: 5, color: '#5b2500', background: '#fff4d6dd', padding: '2px 5px', fontSize: 11, pointerEvents: 'none' }}>{backgroundMessage}</div>}
    {box && <div style={{ position: 'absolute', ...box, border: '1px dotted white', pointerEvents: 'none' }} />}
    {error && <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 30, color: '#300', background: '#ddd', textAlign: 'center', fontSize: 13 }}>{error}</div>}
  </div>;
}
