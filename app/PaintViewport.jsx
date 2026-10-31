import { createModelSmoothing, MODEL_LAYER } from './model-smoothing.js';
import { drawPreviewBackground } from './game-preview-capture.js';
import { textureFromAsset, layerMaterial, configureWideLine } from './viewport-materials.js';
import {createPaintLampObject,paintLampDrag} from './paint-lamps.js';
import {paintRowRanges,acknowledgePaintUpload} from '../src/paint-preview.js';
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createEditorCameras, applyCameraButtons, editorCameraAngles, setEditorCameraAngles } from './editor-camera-controls.js';
import { previewLighting, createEditorLights, configurePreviewLights, applyPreviewMaterialLighting } from './preview-lighting.js';
import { viewportCursor } from './viewport-cursors.js';
import { createPreviewPlatform } from './preview-platform.js';
import { drawPreviewGeometryOverlay, drawPresentationOverlay } from './preview-overlays.js';
import { previewPresentationProps, previewOverlaySettings } from './preview-presentation.js';
import { drawMovementOverlay, projectMovementNodes } from './movement-overlay.js';
import { projectPreviewGeosets, pickPreviewGeoset } from './preview-selection.js';
import { configureEditorTexture, configurePaintTexture, cameraLeftLight, viewportPixelRatio } from './viewport-quality.js';
import { createRigMarkersGL } from './rig-markers-gl.js';
import { drawModelCameraOverlay } from './model-camera-overlay.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { createOverlayDepth, needsSolidDepthPrepass } from './preview-depth.js';
import { decodePaintBlp } from '../src/paint-blp.js';
import { allNodes, sampleGeosetAnimation, sampleTrack } from '../src/animation.js';
import { applySelection, marqueeContainsPoint } from './classic-gestures.js';
import { watchContextLoss, bindScrollSensitivity, createFrameCoalescer, createRenderScheduler, graphicsOptions, pointerDragPoint, pointerSensitivityValue, scrollSensitivityCallbacks, SensitivityIndicator } from './viewport-performance.js';
import { viewportOverlayOptions } from './viewport-overlays.js';
import { makeChecker, makeTeamGlow, clearGroup, uniqueEdges, pointMarkerTexture, configurePointMaterial, emitSelection } from './viewport-shared.js';

import { snapshotPreviewCamera, restorePreviewCamera, applyViewPreset, applyModelCamera, orthographicHalfHeight, updateDepthClipping, modelClipRadius } from './viewport-math.js';
import { createViewportGrid } from './viewport-grid.js';
import { visualOptions, viewportAppearanceOptions, gridOptions, cameraBindings } from '../src/preferences.js';
import { viewportPointDepth, viewportPointIndices } from './viewport-point-selection.js';
import { paintOutlinePositions } from '../src/paint-view.js';
import {paintRegionFaces,paintRegionEntries,paintConnectedPieces} from '../src/paint-region.js';
import { createPaintLightUniforms, updatePaintLights, applyPaintLightShader } from './paint-lighting.js';

const COLORS = [0xa9b6c1, 0x8caca8, 0xb9aa94, 0x939bb5, 0xb499a6, 0x9eac8b];
import { gamePathKey as normalizedPath } from '../src/game-path.js';
const selectionArray = selection => Array.from(selection || []);
export default function PaintViewport(inputProps) {
  const props = previewPresentationProps(inputProps);
  const { model, revision = 0, selectedGeoset = 0, selectedVertices = [], hiddenGeosets, mode = 'vertices', shaded = true, showSkeleton = false, showGrid = true, view = 'front', cameraMode = 'work', workplane = 'xy', transformMode = 'select', sequenceIndex = -1, time = 0, playing = false, teamColor = '#ff0000', textureAssets } = props;
  const host = useRef(null), runtime = useRef(null), latest = useRef(props);
  latest.current = { ...props, selectedGeoset, selectedVertices, mode, showSkeleton, showGrid, view, cameraMode, workplane, transformMode, sequenceIndex, time, playing, teamColor };
  const [error, setError] = useState(''), [textureMessage, setTextureMessage] = useState(''), [backgroundMessage, setBackgroundMessage] = useState(''), [box, setBox] = useState(null);
  const paintCursor = useRef(null);
  const [adjustingSensitivity, setAdjustingSensitivity] = useState(null);
  // The model tab's memory survives the remount that switching tabs causes.
  const ownCameraMemory = useRef(null), cameraMemory = props.cameraMemory || ownCameraMemory;
  const graphics = graphicsOptions(props.preferences);
  const textureSignature = (model?.Textures || []).map(texture => `${texture.Image}|${texture.Flags}|${texture.ReplaceableId}`).join('\n');
  const texturesNeeded = graphics.textures && (mode === 'textured' || props.paintMode);

  useEffect(() => {
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' }); }
    catch (cause) { setError(`The 3D viewport could not start: ${cause.message}. Model data and the other editors remain available.`); return; }
    setError('');
    renderer.setPixelRatio(viewportPixelRatio(graphics, window.devicePixelRatio,latest.current.paintWorkspace));
    renderer.setClearColor(0xcccccc); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
    renderer.domElement.tabIndex = 0;
    host.current.appendChild(renderer.domElement);
    const modelSmoothing = createModelSmoothing(renderer);
    const scene = new THREE.Scene(), modelGroup = new THREE.Group();
    scene.add(modelGroup);
    const { perspective, ortho, controls } = createEditorCameras(renderer.domElement, { target: [0, 0, 45] });
    perspective.position.set(180, -260, 170); controls.update();
    let camera = perspective;
    const { ambient, key } = createEditorLights(scene); ambient.layers.enable(MODEL_LAYER); key.layers.enable(MODEL_LAYER);
    let cameraCanvas, normalCanvas, nodeCanvas, previewCanvas, rotating = false;
    const grid = createViewportGrid(); scene.add(grid);
    const rigMarkers = createRigMarkersGL(renderer.getContext()); renderer.resetState();
    const platform = createPreviewPlatform(() => invalidate()); scene.add(platform);
    const backgroundCanvas = document.createElement('canvas'), backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);
    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    const state = { renderer, modelSmoothing, scene, modelGroup, perspective, ortho, camera, controls, grid, entries: [], nodes: [], textures: new Map(), markerTextures: new Map(), checker: makeChecker(), background: { canvas: backgroundCanvas, texture: backgroundTexture, data: null, image: null, status: 'idle', drawKey: '' }, frame: 0, dirty: true, radius: 100, center: new THREE.Vector3(0, 0, 40), loadedSignature: null, selectionKey: '', disposed: false };
    runtime.current = state;
    latest.current.onPaintCameraReady?.(()=>({position:camera.position.toArray(),target:controls.target.toArray(),center:state.center.toArray(),radius:state.radius}));
    if (latest.current.paintWorkspace) {
      state.paintUniforms=createPaintLightUniforms();state.lampMarkers=new THREE.Group();scene.add(state.lampMarkers);
      const geometry = new LineSegmentsGeometry(), material = new LineMaterial({ color: 0x35d9ff, linewidth: 2, depthTest: true, depthWrite: false, transparent: true });
      state.paintOutline = new LineSegments2(geometry, material); state.paintOutline.frustumCulled = false; state.paintOutline.renderOrder = 14000; state.paintOutline.visible = false; scene.add(state.paintOutline);
      state.paintRegion=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x35d9ff,transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide}));state.paintRegion.visible=false;state.paintRegion.renderOrder=13999;scene.add(state.paintRegion);
    }
    state.teamGlow = makeTeamGlow();
    state.globalTime = 0;
    state.textureSources = new Map();
    // The app's camera angles follow once per frame, not per pointer event.
    let reportedAngles = null;
    const cameraReport = createFrameCoalescer(() => latest.current.onCameraAnglesChange?.(reportedAngles));
    const invalidate = () => { reportedAngles = editorCameraAngles(camera); cameraReport.schedule(); state.scheduler?.invalidate(); };
    const markerTexture = style => {
      if (style === 'square') return null;
      if (!state.markerTextures.has(style)) state.markerTextures.set(style, pointMarkerTexture(style));
      return state.markerTextures.get(style);
    };
    function syncViewportBackground(appearance) {
      const config = latest.current.paintBackground || appearance.background, background = state.background;
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
      const width = Math.max(1, renderer.domElement.width), height = Math.max(1, renderer.domElement.height);
      const key = `${width}|${height}|${config.color}|${config.display}|${config.opacity}`;
      if (background.drawKey !== key) {
        background.canvas.width = width; background.canvas.height = height;
        drawPreviewBackground(background.canvas.getContext('2d'), width, height, background.image, config.color, config);
        background.texture.needsUpdate = true; background.drawKey = key;
      }
      scene.background = background.texture;
    }
    state.refreshCursor = () => { const p=latest.current;renderer.domElement.style.cursor=p.paintMode&&!p.paintSelectOnly&&!p.paintDisabled&&p.cameraMode==='work'&&!rotating?'none':viewportCursor(p.cameraMode,p.rotationNormals?'rotateNormals':p.transformMode,rotating); };
    state.restoreCamera = saved => { camera = restorePreviewCamera(saved, perspective, ortho, controls); state.camera = camera; };
    state.setCameraAngles = values => { if (setEditorCameraAngles(camera, controls.target, values)) { controls.update(); invalidate(); } };
    const cameraChanged=()=>{latest.current.onPaintCameraChange?.();invalidate();};
    controls.addEventListener('change', cameraChanged);
    const unbindScroll = bindScrollSensitivity(renderer.domElement, scrollSensitivityCallbacks(latest, {
      onIndicator: setAdjustingSensitivity,
      // A Wisp left-button wheel gesture is a settings gesture, never a select or transform.
      onPointerAdjustment: () => cancelGesture(),
      onWheel: (_event, sensitivity) => { controls.zoomSpeed = sensitivity; },
    }));

    function resize() {
      const width = Math.max(1, host.current?.clientWidth || 1), height = Math.max(1, host.current?.clientHeight || 1);
      renderer.setPixelRatio(viewportPixelRatio(graphicsOptions(latest.current.preferences), window.devicePixelRatio,latest.current.paintWorkspace));
      renderer.setSize(width, height, false); perspective.aspect = width / height; perspective.updateProjectionMatrix();
      const half = orthographicHalfHeight(state.radius, width / height); ortho.left = -half * width / height; ortho.right = half * width / height; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
      invalidate();
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
      if (bounds.isEmpty()) for (const [index, geo] of (p.model?.Geosets || []).entries()) {
        if (p.paintWorkspace && p.hiddenGeosets?.has(index)) continue;
        const vertices=p.paintWorkspace?new Set(geo.Faces):Array.from({length:geo.Vertices.length/3},(_,i)=>i);
        for (const vertex of vertices) bounds.expandByPoint(new THREE.Vector3().fromArray(geo.Vertices, vertex*3));
      }
      if (bounds.isEmpty()) bounds.set(new THREE.Vector3(-50, -50, 0), new THREE.Vector3(50, 50, 100));
      bounds.getCenter(state.center); state.radius = Math.max(1, bounds.getSize(new THREE.Vector3()).length() / 2);
      state.floor = bounds.min.z;
      const direction = perspective.position.clone().sub(controls.target).normalize();
      const aspect = Math.max(.1, (host.current?.clientWidth || 1) / (host.current?.clientHeight || 1));
      const halfFov = Math.atan(Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)) * Math.min(1, aspect));
      const fitDistance = p.paintWorkspace ? state.radius / Math.sin(halfFov) * 1.08 : state.radius * 3.2;
      perspective.position.copy(state.center).addScaledVector(direction.lengthSq() ? direction : new THREE.Vector3(1, -1.5, .9).normalize(), fitDistance);
      controls.target.copy(state.center); perspective.zoom = ortho.zoom = 1;
      resize(); state.setView(latest.current.view || 'front');
      if(p.paintWorkspace&&camera===perspective){
        // Frame the visible paint surface instead of wasting space on its
        // bounding sphere, loose vertices, or hidden corpse/helper geometry.
        const point=new THREE.Vector3();
        for(let pass=0;pass<3;pass++){
          perspective.lookAt(state.center);perspective.updateMatrixWorld(true);let extent=0;
          for(const [index,geo] of (p.model?.Geosets||[]).entries())if(!p.hiddenGeosets?.has(index))for(const vertex of new Set(geo.Faces)){
            point.fromArray(geo.Vertices,vertex*3).project(perspective);extent=Math.max(extent,Math.abs(point.x),Math.abs(point.y));
          }
          if(!Number.isFinite(extent)||extent<=0)break;
          perspective.position.sub(state.center).multiplyScalar(extent/.84).add(state.center);
        }
        perspective.lookAt(state.center);perspective.updateMatrixWorld(true);invalidate();
      }
    };
    state.setView = next => {
      state.appliedView = next;
      if (next === 'perspective') camera = perspective;
      else if (next === 'orthographic') {
        const previous = camera; camera = ortho; camera.position.copy(previous.position); camera.quaternion.copy(previous.quaternion); camera.up.copy(previous.up);
      }
      else {
        camera = ortho; applyViewPreset(camera, next, controls.target, state.radius * 4);
      }
      controls.object = camera; controls.enableRotate = true;
      state.camera = camera; controls.update(); invalidate();
    };

    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); raycaster.layers.enable(MODEL_LAYER);
    let down = null;
    function point(event) { const rect = renderer.domElement.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height }; }
    function editableGeosets(p) { return p.selectableGeosets == null ? new Set([p.selectedGeoset]) : new Set(p.selectableGeosets); }
    function selections(p) { return p.selectionByGeoset || { [p.selectedGeoset]: selectionArray(p.selectedVertices) }; }
    function cameraAction(event) {
      const p = latest.current;
      const binding = cameraBindings(p.preferences);
      if (event.button === 2 || event.button === 1) { const action = event.button === 2 ? binding.right : binding.middle; return action === 'pan' ? 'move' : action; }
      if (event.altKey) return 'rotate';
      return p.cameraMode;
    }
    function paintHit(event, outside = false) {
      const p = latest.current, cursor = point(event);
      if (outside) {
        camera.updateMatrixWorld(); camera.updateProjectionMatrix();
        return { outside: true, screen: { x: cursor.x, y: cursor.y }, viewport: { width: cursor.width, height: cursor.height }, viewProjectionMatrix: new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements.slice() };
      }
      pointer.set(cursor.x / cursor.width * 2 - 1, 1 - cursor.y / cursor.height * 2); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(state.entries.flatMap(entry => entry?.meshes.filter(mesh => mesh.visible||p.paintColorfy) || []), false), hit = hits.find(value => value.object.parent?.visible);
      if (!hit) return null;
      const geometry = hit.object.geometry, faceIndex = Number.isInteger(hit.faceIndex) ? hit.faceIndex : 0, index = geometry.index?.array, ids = index ? [index[faceIndex * 3], index[faceIndex * 3 + 1], index[faceIndex * 3 + 2]] : [faceIndex * 3, faceIndex * 3 + 1, faceIndex * 3 + 2];
      const position = geometry.attributes.position, a = new THREE.Vector3().fromBufferAttribute(position, ids[0]), b = new THREE.Vector3().fromBufferAttribute(position, ids[1]), c = new THREE.Vector3().fromBufferAttribute(position, ids[2]), barycentric = new THREE.Vector3();
      const localPoint = hit.object.worldToLocal(hit.point.clone());
      THREE.Triangle.getBarycoord(localPoint, a, b, c, barycentric);
      camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      const viewProjection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), normal = hit.face?.normal?.clone() || new THREE.Vector3(); normal.transformDirection(hit.object.matrixWorld);
      const textureId = hit.object.userData.textureId, texture = Number.isInteger(textureId) ? p.model?.Textures?.[textureId] : null;
      return {
        geosetIndex: hit.object.userData.geosetIndex, materialId: hit.object.userData.materialId, layerIndex: hit.object.userData.layerIndex, textureId: textureId, coordId: hit.object.userData.coordId,
        textureTarget: { textureId, texturePath: texture?.Image || '', flags: Number(texture?.Flags) || 0 },
        triangle: p.model.Geosets[hit.object.userData.geosetIndex].paintFaceIndices?.[faceIndex]??faceIndex, subtract:event.ctrlKey||event.metaKey, add:event.shiftKey, vertexIds: ids, barycentric: barycentric.toArray(), uv: hit.uv?.toArray() || [0, 0], worldPosition: hit.point.toArray(), normal: normal.toArray(), depth: hit.point.clone().project(camera).z,
        screen: { x: cursor.x, y: cursor.y }, viewport: { width: cursor.width, height: cursor.height }, viewProjectionMatrix: viewProjection.elements.slice(),
      };
    }
    // OrbitControls is used only for navigation. Capture configures it before its handler runs.
    function pointerDown(event) {
      if (down) return;
      host.current?.focus();if(latest.current.paintWorkspace)latest.current.onPaintInteractionChange?.(true);
      const action = cameraAction(event);
      rotating = action === 'rotate'; latest.current.onCameraGestureChange?.(rotating);
      state.refreshCursor();
      controls.enabled = true;
      applyCameraButtons(controls, event, latest.current.preferences, { left: action === 'move' ? 'pan' : action, fine: action !== 'work' });
      if (action === 'move' || action === 'rotate') return;
      if (latest.current.presentation === 'preview' && action !== 'zoom') return;
      if (event.button !== 0) return;
      const p = latest.current, start = point(event);
      down = { ...start, pointerId: event.pointerId, shift: event.shiftKey, ctrl: event.ctrlKey || event.metaKey, pointerSensitivity: pointerSensitivityValue(p.preferences?.pointerSensitivity), action: action === 'zoom' ? 'zoom' : p.transformMode };
      controls.enabled = false; renderer.domElement.setPointerCapture(event.pointerId);
      if (action === 'zoom') { down.zoomFactor = 1; return; }
      if(p.paintMode&&p.paintSelectOnly&&!p.paintLampPickingDisabled){
        pointer.set(start.x/start.width*2-1,1-start.y/start.height*2);raycaster.setFromCamera(pointer,camera);
        state.lampMarkers?.updateMatrixWorld(true);
        const picked=state.lampMarkers&&raycaster.intersectObjects(state.lampMarkers.children,true).find(hit=>hit.object.userData.lampId);
        if(picked){const id=picked.object.userData.lampId,lamp=p.paintLights?.markers.find(l=>l.id===id);if(lamp){down.action='paintLamp';down.lamp=structuredClone(lamp);down.lampMode=p.paintLampTransform||'move';p.onPaintLampSelect?.(id);return;}}
        p.onPaintLampSelect?.(null);
      }
      if (p.paintMode) {
        const selecting=p.paintSelectOnly||event.shiftKey||event.ctrlKey||event.metaKey;
        down.action = selecting ? 'paintPick' : 'paint';
        if (p.paintDisabled && !selecting) return;
        const hit = paintHit(event, !selecting && p.paintOutside); down.paintHit = hit;
        if (hit) { if (selecting) p.onPaintPick?.(hit); else p.onPaintStart?.(hit); }
        return;
      }
      down.action = 'select';
    }
    // Lamp drags and face sweeps update Paint and the app once per frame. A sweep
    // still raycasts every recorded point, so a fast drag skips no face.
    const dragFrame = createFrameCoalescer(applyDrag, { request: callback => state.scheduler.frames.request(callback), cancel: id => state.scheduler?.frames.cancel(id) });
    function applyDrag() {
      if (!down) return;
      if(down.action==='paintLamp'&&down.pendingLamp){const {dx,dy,width,height}=down.pendingLamp;down.pendingLamp=null;latest.current.onPaintLampChange?.(down.lamp.id,paintLampDrag(down.lamp,dx,dy,camera,width,height,down.lampMode,down.shift?(latest.current.preferences?.fineSensitivity??.2):1));invalidate();return;}
      if(down.action==='paintPick'&&down.pendingPicks?.length){const hits=down.pendingPicks.map(sample=>paintHit(sample)).filter(Boolean);down.pendingPicks=[];if(hits.length)latest.current.onPaintPick?.({...hits.at(-1),continueSelection:true,sweep:hits});}
    }
    function pointerMove(event) {
      if (latest.current.paintMode && paintCursor.current) {
        const cursor = point(event), decal=latest.current.paintDecal, width=decal?.width||Math.max(1,Number(latest.current.paintBrushSize)||1),height=decal?.height||width;
        Object.assign(paintCursor.current.style, { display: latest.current.paintSelectOnly || latest.current.paintDisabled || latest.current.cameraMode!=='work' || event.buttons>1 || event.altKey || event.shiftKey || event.ctrlKey ? 'none' : 'block', left: `${cursor.x}px`, top: `${cursor.y}px`, width: `${width}px`, height: `${height}px`,transform:`translate(-50%,-50%) rotate(${decal?.angle||0}deg)` });
      }
      if (!down) {
        // Only a stamp previews on hover. It needs the camera and cursor, not a
        // raycast, so moving the mouse stays cheap.
        const p=latest.current;if(p.paintMode&&p.paintDecal&&!p.paintSelectOnly&&!p.paintDisabled&&p.cameraMode==='work'&&!event.buttons&&!event.altKey&&!event.shiftKey&&!event.ctrlKey)p.onPaintHover?.(paintHit(event,true));else p.onPaintHover?.(null);
        return;
      }
      const rawEnd = point(event), end = down.action === 'select' ? rawEnd : pointerDragPoint(down, rawEnd, down.pointerSensitivity), dx = end.x - down.x, dy = end.y - down.y;
      // The stroke already owns a fixed camera/depth projection. Pointer motion
      // needs screen coordinates only, not another full-model raycast.
      if (down.action === 'paint') { if (down.paintHit) latest.current.onPaintMove?.({ screen: { x: rawEnd.x, y: rawEnd.y } }); return; }
      if(down.action==='paintLamp'){down.pendingLamp={dx,dy,width:rawEnd.width,height:rawEnd.height};dragFrame.schedule();return;}
      if (down.action === 'paintPick') { if(latest.current.paintSelectFaces){(down.pendingPicks||=[]).push({clientX:event.clientX,clientY:event.clientY,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey});dragFrame.schedule();} return; }
      if (down.action === 'zoom') {
        const factor = Math.exp(-dy * .01);
        controls.zoomView(factor / down.zoomFactor); down.zoomFactor = factor;
        controls.update(); return;
      }
      if (down.action === 'select') { if (Math.hypot(dx, dy) > 5) setBox({ left: Math.min(down.x, end.x), top: Math.min(down.y, end.y), width: Math.abs(dx), height: Math.abs(dy) }); return; }
    }
    function pointerUp(event) {
      dragFrame.flush();
      if(latest.current.paintWorkspace)latest.current.onPaintInteractionChange?.(false);
      rotating = false; latest.current.onCameraGestureChange?.(false);
      state.refreshCursor();
      const start = down; down = null; setBox(null); controls.enabled = true;
      if (!start) return;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      if (start.action === 'paint') { latest.current.onPaintEnd?.(); invalidate(); return; }
      if (start.action === 'paintPick'||start.action==='paintLamp') return;
      if (start.action !== 'select') return;
      const end = point(event), distance = Math.hypot(end.x - start.x, end.y - start.y), p = latest.current;
      if (distance <= 5 && start.ctrl && p.onInspectGeoset) {
        const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geometry.index.array, vertices: entry.geometry.attributes.position.array }] : []);
        const hit = pickPreviewGeoset(projectPreviewGeosets(geometry, camera, end.width, end.height), end.x, end.y);
        if (hit) p.onInspectGeoset(hit.index);
        return;
      }
      // Source N15/N16 only change rendering: Work still selects vertices in every view.
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
    function cancelGesture() {
      dragFrame.cancel();
      if(latest.current.paintWorkspace)latest.current.onPaintInteractionChange?.(false);
      if(down?.action==='paintLamp')latest.current.onPaintLampChange?.(down.lamp.id,{position:down.lamp.position,target:down.lamp.target});
      rotating = false; latest.current.onCameraGestureChange?.(false);
      if (down?.action === 'paint') latest.current.onPaintCancel?.();
      down = null; setBox(null); controls.enabled = true; state.dirty = true; invalidate();
    }
    const frameModel = event => { cancelGesture(); state.fit(event.detail?.selection === true); };
    const viewCamera = event => { cancelGesture(); if (applyModelCamera(perspective, controls, event.detail)) { camera = perspective; state.camera = camera; state.appliedView = 'perspective'; invalidate(); } };
    window.addEventListener('mdlxl-view-camera', viewCamera);
    const cancelKey = event => { if (event.key === 'Escape' && down) { cancelGesture(); event.preventDefault(); } };
    const lampKey = event => {
      const p=latest.current;
      if(!p.paintMode||!p.paintSelectOnly||!p.paintSelectedLamp||down||event.ctrlKey||event.metaKey||event.altKey)return;
      const offset={ArrowLeft:[-12,0,'move'],ArrowRight:[12,0,'move'],ArrowUp:[0,-12,'move'],ArrowDown:[0,12,'move'],PageUp:[0,-12,'depth'],PageDown:[0,12,'depth']}[event.key];
      const lamp=p.paintLights?.markers.find(item=>item.id===p.paintSelectedLamp);
      if(!offset||!lamp)return;
      event.preventDefault();event.stopPropagation();
      p.onPaintLampChange?.(lamp.id,paintLampDrag(lamp,offset[0],offset[1],camera,renderer.domElement.clientWidth,renderer.domElement.clientHeight,offset[2],event.shiftKey?(p.preferences?.fineSensitivity??.2):1));
      invalidate();
    };
    const contextMenu = event => event.preventDefault();
    const paintDragOver=event=>{if(latest.current.paintDecal&&!latest.current.paintDisabled)event.preventDefault();};
    const paintDrop=event=>{if(!latest.current.paintDecal||latest.current.paintDisabled)return;event.preventDefault();const hit=paintHit(event);if(hit)latest.current.onPaintDrop?.(hit);};
    const paintLeave=()=>{if(paintCursor.current)paintCursor.current.style.display='none';latest.current.onPaintHover?.(null);};
    renderer.domElement.addEventListener('dragover',paintDragOver);renderer.domElement.addEventListener('drop',paintDrop);renderer.domElement.addEventListener('pointerleave',paintLeave);
    renderer.domElement.addEventListener('pointerdown', pointerDown, true);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', cancelGesture);
    renderer.domElement.addEventListener('contextmenu', contextMenu);
    window.addEventListener('mdlvis-frame', frameModel); window.addEventListener('keydown', cancelKey);
    const lampKeyHost=host.current;lampKeyHost.addEventListener('keydown',lampKey);
    const unwatchContext = watchContextLoss(renderer.domElement, () => { state.scheduler?.dispose(); setError('The graphics context was lost. Reload the editor to restore the viewport. Save your work first.'); });

    function render(now, delta) {
      if (state.disposed) return;
      const p = latest.current, renderGraphics = graphicsOptions(p.preferences), visual = visualOptions(p.preferences), appearance = viewportAppearanceOptions(p.preferences);
      const lighting = previewLighting(p.preferences); configurePreviewLights(ambient, key, lighting);
      if(state.paintUniforms){
        updatePaintLights(state.paintUniforms,p.paintLights);
        if(state.markerSettings!==p.paintLights||state.selectedLamp!==p.paintSelectedLamp||state.lampColor!==p.paintLampColor){
          state.markerSettings=p.paintLights;state.selectedLamp=p.paintSelectedLamp;state.lampColor=p.paintLampColor;
          const lamps=p.paintLights?.markers||[],ids=new Set(lamps.map(l=>l.id));
          for(const object of [...state.lampMarkers.children])if(!ids.has(object.userData.lampId)){clearGroup(object);state.lampMarkers.remove(object);}
          for(const lamp of lamps){
            let object=state.lampMarkers.children.find(item=>item.userData.lampId===lamp.id);
            if(!object){object=createPaintLampObject(lamp.id);state.lampMarkers.add(object);}
            object.position.fromArray(lamp.position);object.lookAt(new THREE.Vector3().fromArray(lamp.target));object.scale.setScalar(Math.max(3,state.radius*.12));
            object.userData.housing.color.set(lamp.id===p.paintSelectedLamp?(p.paintLampColor||'#ffc34b'):'#73787d');object.userData.bulb.color.set(lamp.enabled?lamp.color:'#444444');
          }
        }
      }
      state.refreshCursor();
      syncViewportBackground(appearance);
      ambient.visible = key.visible = renderGraphics.lighting;
      const overlays = viewportOverlayOptions(p);
      const showMarkers = overlays.bones || overlays.nodes || overlays.attachments || overlays.particles;
      grid.update(p.preferences, p.workplane, overlays.grid, overlays.axes, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
      platform.update(p.preferences, state.center, state.radius, state.floor || 0);
      const selectedMap = selections(p), active = editableGeosets(p);
      const selectionKey = `${JSON.stringify(selectedMap, (_, value) => value instanceof Set ? [...value] : value)}|${[...active].join(',')}|${JSON.stringify(p.hiddenVertices, (_, value) => value instanceof Set ? [...value] : value)}|${p.mode}|${p.sequenceIndex}|${p.transformMode}|${JSON.stringify(visual)}`;
      const interval = p.model?.Sequences?.[p.sequenceIndex]?.Interval;
      const animOptions = { interval, globalSequences: p.model?.GlobalSequences, globalTime: state.globalTime };
      // Paint is authored in raw rest pose, including when half geometry is
      // clipped. Re-skinning on a paint update wastes CPU and moves its hit map.
      state.dirty = false;
      const hidden = p.hiddenGeosets instanceof Set ? p.hiddenGeosets : new Set(p.hiddenGeosets || []);
      for (let index = 0; index < state.entries.length; index++) {
        const entry = state.entries[index]; if (!entry) continue;
        const chosen = active.has(index), selection = selectionArray(selectedMap[index]);
        const hovered = p.hoveredGeoset === index;
        const geosetAnim = state.geosetAnims.get(index);
        const alpha = p.sequenceIndex >= 0 ? sampleTrack(geosetAnim?.Alpha, state.frame, { ...animOptions, fallback: 1 }) : typeof geosetAnim?.Alpha === 'number' ? geosetAnim.Alpha : 1;
        entry.group.visible = hovered || (!hidden.has(index) && (alpha > .001 || p.mode !== 'textured'));
        entry.hoverWire.visible = hovered; entry.hoverPoints.visible = hovered;
        const pureWireframe = p.mode === 'wireframe' || p.mode === 'vertices';
        const activeAppearance = index === p.selectedGeoset ? appearance.selectedGeoset : appearance.otherGeoset;
        const pointDepth = viewportPointDepth(pureWireframe, appearance.xrayVertices);
        const showPoints = overlays.vertices && chosen, showHiddenPoints = showPoints && pointDepth.showHidden;
        entry.points.visible = entry.selectedPoints.visible = showPoints;
        entry.hiddenPoints.visible = entry.hiddenSelectedPoints.visible = showHiddenPoints;
        configurePointMaterial(entry.points.material, appearance.unselectedVertex, markerTexture(appearance.unselectedVertex.style));
        configurePointMaterial(entry.hiddenPoints.material, appearance.unselectedVertex, markerTexture(appearance.unselectedVertex.style));
        configurePointMaterial(entry.selectedPoints.material, appearance.selectedVertex, markerTexture(appearance.selectedVertex.style));
        configurePointMaterial(entry.hiddenSelectedPoints.material, appearance.selectedVertex, markerTexture(appearance.selectedVertex.style));
        entry.points.material.depthTest = entry.selectedPoints.material.depthTest = pointDepth.depthTest;
        entry.hiddenPoints.material.depthTest = entry.hiddenSelectedPoints.material.depthTest = true;
        entry.wire.visible = pureWireframe || overlays.wires;
        entry.hiddenWire.visible = pureWireframe && visual.occludedOpacity > 0 && activeAppearance.opacity > 0;
        // Textured/solid General View already produces the correct depth from
        // its real materials, including alpha-tested holes and translucent
        // layers. The geometry-only prepass is reserved for modes where those
        // surface meshes are absent; otherwise it turns alpha planes opaque.
        entry.depth.visible = needsSolidDepthPrepass(p.mode);
        configureWideLine(entry.wire.material, activeAppearance, renderer.domElement.clientWidth, renderer.domElement.clientHeight);
        configureWideLine(entry.hiddenWire.material, activeAppearance, renderer.domElement.clientWidth, renderer.domElement.clientHeight, visual.occludedOpacity);
        entry.hoverWire.material.color.set(visual.selectedGeometry); entry.hoverPoints.material.color.set(visual.selectedGeometry);
        for (let layerIndex = 0; layerIndex < entry.meshes.length; layerIndex++) {
          const mesh = entry.meshes[layerIndex], material = mesh.material, layer = entry.layers[layerIndex];
          applyPreviewMaterialLighting(material, lighting);
          const coverage = layer.FilterMode === 1 && renderGraphics.antialias;
          if (material.alphaToCoverage !== coverage) { material.alphaToCoverage = coverage; material.needsUpdate = true; }
          mesh.visible = !p.paintColorfy && (p.rgbPreview || p.mode !== 'wireframe' && p.mode !== 'vertices') && (p.mode === 'textured' || layerIndex === 0);
          if (p.rgbPreview) entry.depth.visible = false;
          const textureIndex = Math.round(sampleTrack(layer.TextureID, state.frame, { ...animOptions, fallback: 0 }));
          const textureInfo = p.model?.Textures?.[textureIndex];
          const textured = p.mode === 'textured' && renderGraphics.textures;
          const map = !textured || textureInfo?.ReplaceableId === 1 ? null : textureInfo?.ReplaceableId === 2 ? state.teamGlow : state.textures.get(textureIndex) || state.checker;
          if (material.map !== map) { material.map = map; material.needsUpdate = true; }
          material.color.set(textured ? textureInfo?.ReplaceableId === 1 || textureInfo?.ReplaceableId === 2 ? p.teamColor : 0xffffff : COLORS[index % COLORS.length]);
          material.userData.geosetTint.value.set(1, 1, 1);
          if (textured || p.rgbPreview) {
            const rgbSequence = p.rgbPreview ? p.rgbPreviewSequenceIndex : p.sequenceIndex;
            const rgbTime = p.rgbPreview ? (p.model?.Sequences?.[rgbSequence]?.Interval?.[0] ?? 0) : state.frame;
            const sampled = sampleGeosetAnimation(p.model, index, rgbTime, rgbSequence, p.rgbPreview ? rgbTime : state.globalTime);
            if (p.rgbPreview) material.color.set(0xffffff).multiply(new THREE.Color(...sampled.color));
            else material.userData.geosetTint.value.fromArray(sampled.color);
          }
          material.opacity = textured ? Math.max(0, Math.min(1, alpha * sampleTrack(layer.Alpha, state.frame, { ...animOptions, fallback: 1 }))) : 1;
          const transparent = textured && ((layer.FilterMode || 0) >= 2 || material.opacity < 1);
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          // Clockwise faces are culled; counterclockwise winding is front-facing.
          material.side = layer.Shading & 16 ? THREE.DoubleSide : THREE.FrontSide;
          material.depthWrite = !textured || (!(layer.Shading & 128) && (layer.FilterMode || 0) < 2);
          material.blending = textured ? material.userData.layerBlending : THREE.NormalBlending;
          material.alphaTest = textured && layer.FilterMode === 1 ? .75 : 0;
          material.depthTest = !textured || !(layer.Shading & 64);

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
      updateDepthClipping(camera, state.center, modelClipRadius(p.model, state.center, state.radius), gridOptions(p.preferences).extent);
      if (state.paintOutline) {
        const outline=state.paintOutline,settings=p.paintOutline;
        outline.visible=!!(p.paintMode&&(p.paintPartOutlines||p.paintRegion||settings?.visible));
        if(outline.visible){
          camera.updateMatrixWorld();const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements,key=matrix.join(',')+':'+[...hidden]+':'+p.paintPartOutlines;
          if(state.outlineModel!==p.model||state.outlineRegion!==p.paintRegion||state.outlineKey!==key){
            const positions=[];
            for(let index=0;index<p.model.Geosets.length;index++){
              if(hidden.has(index))continue;const geo=p.model.Geosets[index],selected=paintRegionFaces(p.paintRegion,index);
              const sets=p.paintPartOutlines?paintConnectedPieces(geo).pieces:selected?[selected]:settings?.visible&&index===p.selectedGeoset?[new Set(Array.from({length:geo.Faces.length/3},(_,i)=>i))]:[];
              for(const faces of sets){const ids=[];for(let f=0;f<geo.Faces.length/3;f++)if(faces.has(p.paintPartOutlines?f:geo.paintFaceIndices?.[f]??f))ids.push(...geo.Faces.subarray(f*3,f*3+3));if(ids.length)positions.push(...paintOutlinePositions({...geo,Faces:new geo.Faces.constructor(ids)},matrix));}
            }
            outline.geometry.setPositions(positions);state.outlineModel=p.model;state.outlineRegion=p.paintRegion;state.outlineKey=key;
          }
          outline.material.color.set(p.paintPartOutlines?'#292c35':settings?.color||'#35d9ff');outline.material.linewidth=p.paintPartOutlines?1.5:settings?.thickness||2;outline.material.resolution.set(renderer.domElement.clientWidth,renderer.domElement.clientHeight);
        }
      }
      if(state.paintRegion){
        const region=p.paintRegion;state.paintRegion.visible=!!(region&&paintRegionEntries(region).some(([id,f])=>f.size&&!hidden.has(id)));
        if(state.paintRegion.visible&&(state.regionValue!==region||state.regionModel!==p.model)){
          const positions=[];for(const [index,faces] of paintRegionEntries(region)){
            const geo=p.model.Geosets[index];if(!geo||hidden.has(index))continue;
            for(let face=0;face<geo.Faces.length/3;face++)if(faces.has(geo.paintFaceIndices?.[face]??face))for(let corner=0;corner<3;corner++){const id=geo.Faces[face*3+corner];positions.push(...geo.Vertices.subarray(id*3,id*3+3));}
          }
          state.paintRegion.geometry.dispose();state.paintRegion.geometry=new THREE.BufferGeometry();state.paintRegion.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));state.regionValue=region;state.regionModel=p.model;
        }
        state.paintRegion.material.opacity=p.paintSelectOnly?.23:.07;
      }
      if(p.paintWorkspace){
        if(!state.partColors){state.partColors=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));state.partColors.material.onBeforeCompile=shader=>applyPaintLightShader(shader,state.paintUniforms,false);state.partColors.layers.set(MODEL_LAYER);scene.add(state.partColors);}
        state.partColors.visible=!!p.paintColorfy;
        const colorKey=[...hidden].join(',');
        if(p.paintColorfy&&(state.colorModel!==p.model||state.colorKey!==colorKey)){
          const positions=[],colors=[];let count=0;
          for(let index=0;index<p.model.Geosets.length;index++){
            const geo=p.model.Geosets[index];
            for(const faces of paintConnectedPieces(geo).pieces){const color=new THREE.Color().setHSL((count++*.61803398875)%1,.64,.57);if(hidden.has(index))continue;
              for(const face of faces)for(let c=0;c<3;c++){const id=geo.Faces[face*3+c];positions.push(...geo.Vertices.subarray(id*3,id*3+3));colors.push(color.r,color.g,color.b);}
            }
          }
          state.partColors.geometry.dispose();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();state.partColors.geometry=geometry;state.colorModel=p.model;state.colorKey=colorKey;
        }
      }
      const light = cameraLeftLight(camera, controls.target, state.radius);
      key.position.copy(light.position); key.target.position.copy(controls.target);
      ambient.position.copy(light.direction);
      try { modelSmoothing.render(scene, camera, renderGraphics.antialias, [grid, platform]);
        if (p.presentation === 'preview' && previewOverlaySettings(p.previewOverlay).mode !== 'none') {
          if (!previewCanvas) { previewCanvas = document.createElement('canvas'); previewCanvas.dataset.geometryOverlay = ''; previewCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(previewCanvas); }
          previewCanvas.width = renderer.domElement.width; previewCanvas.height = renderer.domElement.height;
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible ? [{ index, faces: entry.geoset.Faces, vertices: entry.geometry.attributes.position.array }] : []);
          drawPresentationOverlay(previewCanvas.getContext('2d'), geometry, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight, p.previewOverlay, renderer.getPixelRatio());
        } else if (previewCanvas) { previewCanvas.remove(); previewCanvas = null; }
        if (p.overlays?.normals || p.showNormals) {
          if (!normalCanvas) { normalCanvas = document.createElement('canvas'); normalCanvas.dataset.normalOverlay = ''; normalCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(normalCanvas); }
          normalCanvas.width = renderer.domElement.width; normalCanvas.height = renderer.domElement.height;
          const geometry = state.entries.flatMap((entry, index) => entry?.group.visible && active.has(index) ? [{ index, vertices: entry.geometry.attributes.position.array, normals: entry.geometry.attributes.normal.array }] : []);
          drawPreviewGeometryOverlay(normalCanvas.getContext('2d'), geometry, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight, { normals: true, preferences: p.preferences }, state.center, state.radius, renderer.getPixelRatio());
        } else if (normalCanvas) { normalCanvas.remove(); normalCanvas = null; }
        if (showMarkers) {
          if (!nodeCanvas) { nodeCanvas = document.createElement('canvas'); nodeCanvas.dataset.nodeOverlay = ''; nodeCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(nodeCanvas); }
          nodeCanvas.width = renderer.domElement.width; nodeCanvas.height = renderer.domElement.height;
          const width = renderer.domElement.clientWidth, height = renderer.domElement.clientHeight;
          const nodes = projectMovementNodes(p.model, state.frame, p.sequenceIndex, camera, width, height, state.globalTime, state.matrices);
          const options = { ...overlays, boneLines: true, preferences: p.preferences, glMarkers: true, wireframeMarkers: p.mode === 'wireframe' || p.mode === 'vertices', occludedMarkerEdges: p.mode === 'solid' || p.mode === 'textured' };
          renderer.resetState(); rigMarkers.draw(camera, nodes, p.selectedNodeIds || [], options); renderer.resetState();
          drawMovementOverlay(nodeCanvas.getContext('2d'), nodes, p.selectedNodeIds || [], [], width, height, renderer.getPixelRatio(), options);
        } else if (nodeCanvas) { nodeCanvas.remove(); nodeCanvas = null; }
        if (p.overlays?.cameras ?? p.showCameras) {
          if (!cameraCanvas) { cameraCanvas = document.createElement('canvas'); cameraCanvas.dataset.cameraOverlay = ''; cameraCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; host.current.appendChild(cameraCanvas); }
          cameraCanvas.width = renderer.domElement.width; cameraCanvas.height = renderer.domElement.height;
          drawModelCameraOverlay(cameraCanvas.getContext('2d'), p.model || {}, camera, renderer.domElement.clientWidth, renderer.domElement.clientHeight, renderer.getPixelRatio(), state.frame, p.sequenceIndex, state.globalTime, state.radius, visual.node);
        } else if (cameraCanvas) { cameraCanvas.remove(); cameraCanvas = null; }
      }
      catch (cause) { setError(`Preview error: ${cause.message}`); return false; }
    }
    state.scheduler = createRenderScheduler({ render,
      continuous: () => false,
      paused: () => latest.current.suspended || (document.hidden && graphicsOptions(latest.current.preferences).pauseWhenHidden),
      maxFps: () => graphicsOptions(latest.current.preferences).maxFps,
    });
    document.addEventListener('visibilitychange', state.scheduler.sync);
    state.scheduler.invalidate();
    return () => {
      cameraMemory.current = { view: state.appliedView, ...snapshotPreviewCamera(camera, perspective, ortho, controls), center: state.center.clone(), radius: state.radius };
      state.paintOutline?.geometry.dispose(); state.paintOutline?.material.dispose();
      state.paintRegion?.geometry.dispose();state.paintRegion?.material.dispose();state.partColors?.geometry.dispose();state.partColors?.material.dispose();
      if(state.lampMarkers)clearGroup(state.lampMarkers);
      renderer.domElement.removeEventListener('dragover',paintDragOver);renderer.domElement.removeEventListener('drop',paintDrop);renderer.domElement.removeEventListener('pointerleave',paintLeave);
      state.disposed = true; cameraReport.cancel(); dragFrame.cancel(); state.scheduler.dispose(); document.removeEventListener('visibilitychange', state.scheduler.sync); unbindScroll(); resizeObserver.disconnect(); controls.removeEventListener('change', cameraChanged); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointermove', pointerMove); renderer.domElement.removeEventListener('pointerup', pointerUp); unwatchContext();
      renderer.domElement.removeEventListener('pointercancel', cancelGesture); renderer.domElement.removeEventListener('contextmenu', contextMenu);
      window.removeEventListener('mdlvis-frame', frameModel); window.removeEventListener('mdlxl-view-camera', viewCamera); window.removeEventListener('keydown', cancelKey);
      lampKeyHost.removeEventListener('keydown',lampKey);
      cameraCanvas?.remove(); normalCanvas?.remove(); nodeCanvas?.remove(); previewCanvas?.remove(); rigMarkers.dispose(); platform.dispose(); clearGroup(modelGroup); state.textures.forEach(texture => texture.dispose()); state.markerTextures.forEach(texture => texture.dispose()); state.background.texture.dispose(); state.checker.dispose(); state.teamGlow.dispose(); grid.dispose(); modelSmoothing.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const state = runtime.current; if (!state) return;
    clearGroup(state.modelGroup); state.entries = []; state.nodes = allNodes(model || {}); state.selectionKey = ''; state.dirty = true;
    state.geosetAnims = new Map((model?.GeosetAnims || []).map(anim => [anim.GeosetId, anim]));
    state.scheduler?.invalidate();
    if (!model) return;
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
        const material = layerMaterial(layer, shaded && graphics.lighting && !state.paintUniforms, { extendShader: state.paintUniforms ? shader => applyPaintLightShader(shader, state.paintUniforms, !!(layer.Shading & 1)) : undefined, cacheKey: state.paintUniforms ? 'citadel-vertex-light-' + (layer.Shading & 1) : 'mdlxl-layer' }); material.polygonOffset = false; material.alphaToCoverage = layer.FilterMode === 1 && graphics.antialias;
        const mesh = new THREE.Mesh(layerGeometry, material); mesh.layers.set(MODEL_LAYER); mesh.userData.geosetIndex = index; mesh.userData.materialId = geoset.MaterialID; mesh.userData.layerIndex = layerIndex; mesh.userData.textureId = Number.isInteger(layer.TextureID) ? layer.TextureID : null; mesh.userData.coordId = layer.CoordId || 0; mesh.userData.baseUV = new Float32Array(layerGeometry.attributes.uv.array); mesh.renderOrder = index * 16 + layerIndex; mesh.frustumCulled = false; group.add(mesh); meshes.push(mesh);
      }
      const depth = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })); depth.layers.set(MODEL_LAYER); depth.renderOrder = -1; depth.frustumCulled = false; group.add(depth);
      const edgeIndices = uniqueEdges(geoset.Faces), wireGeometry = new LineSegmentsGeometry();
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
      const hoverWire = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true }));
      hoverWire.renderOrder = 13000; hoverWire.frustumCulled = false; hoverWire.visible = false; group.add(hoverWire);
      const hoverGeometry = new THREE.BufferGeometry(); hoverGeometry.setAttribute('position', geometry.attributes.position);
      const hoverPoints = new THREE.Points(hoverGeometry, new THREE.PointsMaterial({ color: 0x39ff14, size: 6, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true }));
      hoverPoints.renderOrder = 13001; hoverPoints.frustumCulled = false; hoverPoints.visible = false; group.add(hoverPoints);
      state.modelGroup.add(group); state.entries[index] = { geoset, group, geometry, meshes, layers, depth, edgeIndices, wireGeometry, wire, hiddenWire, points, hiddenPoints, selectedPoints, hiddenSelectedPoints, hoverWire, hoverPoints };
    }
    const signature = `${model.Info?.Name}|${model.Geosets?.map(g => g.Vertices.length).join(',')}`;
    if (state.loadedSignature === null) {
      state.loadedSignature = signature; state.fit();
      const saved = cameraMemory.current;
      if (saved && saved.view === latest.current.view) { state.restoreCamera(saved); state.center.copy(saved.center); state.radius=saved.radius; state.resize(); state.controls.update(); }
    }
  }, [model, revision, shaded, graphics.lighting]);

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
    const assets = textureAssets instanceof Map ? textureAssets : new Map(Object.entries(textureAssets || {})), overrides = props.paintTextureOverrides instanceof Map ? props.paintTextureOverrides : new Map(Object.entries(props.paintTextureOverrides || {}));
    const normalized = new Map([...assets].map(([path, asset]) => [normalizedPath(path), asset]));
    for (const index of state.textureSources.keys()) if (index >= (model?.Textures?.length || 0)) { state.textures.get(index)?.dispose(); state.textures.delete(index); state.textureSources.delete(index); }
    const failures = [], jobs = (model?.Textures || []).map(async (texture, index) => {
      const path = normalizedPath(texture.Image);
      const asset = normalized.get(path) || normalized.get(path.split('\\').at(-1));
      const override = overrides.get(index) || overrides.get(String(index));
      const smoothing=props.paintTextureSmoothing!==false;
      const key = override ? `paint|${texture.Flags}|${smoothing}` : `${path}|${texture.Flags}|${texture.ReplaceableId}`, previous = state.textureSources.get(index);
      if (override?.canvas && previous?.canvas === override.canvas && previous.key === key && state.textures.has(index)) {
        if (previous.revision !== override.revision) { previous.revision = override.revision; const loaded=state.textures.get(index);loaded.clearUpdateRanges();if(!override.fullUpload)for(const range of paintRowRanges(override.uploadRows,override.raster.width))loaded.addUpdateRange(range.start,range.count);loaded.needsUpdate=true;state.scheduler?.invalidate(); } return;
      }
      if (!override && previous && previous.asset === asset && previous.key === key) { if (previous.error) failures.push(previous.error); return; }
      state.textures.get(index)?.dispose(); state.textures.delete(index);
      const source = { asset, key, canvas: override?.canvas || null, revision: override?.revision }; state.textureSources.set(index, source);
      if (override?.canvas) {
        // Hover and committed coats own different GPU textures. A reused
        // preview entry may have acknowledged an earlier texture's upload;
        // the newly allocated texture still needs every pixel before ranges.
        override.fullUpload=true;
        const loaded = override.raster?new THREE.DataTexture(override.raster.data,override.raster.width,override.raster.height,THREE.RGBAFormat):new THREE.CanvasTexture(override.canvas);
        loaded.flipY=false;loaded.colorSpace=THREE.NoColorSpace;loaded.wrapS=texture.Flags&1?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;loaded.wrapT=texture.Flags&2?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
        configurePaintTexture(loaded,smoothing);
        if(override.raster)loaded.onUpdate=()=>acknowledgePaintUpload(override);
        state.textures.set(index,loaded);state.scheduler?.invalidate();return;
      }
      if (!asset || texture.ReplaceableId) { state.scheduler?.invalidate(); return; }
      try {
        const loaded = await textureFromAsset(asset, texture, { fallbackDecoder: decodePaintBlp });
        if (state.disposed || state.textureSources.get(index) !== source) loaded.dispose();
        else { configureEditorTexture(loaded, state.renderer.capabilities.getMaxAnisotropy()); state.textures.set(index, loaded); state.scheduler?.invalidate(); }
      }
      catch (cause) { source.error = `${texture.Image}: ${cause.message}`; failures.push(source.error); }
    });
    Promise.all(jobs).then(() => { if (!cancelled && failures.length) setTextureMessage(failures.join('; ')); });
    return () => { cancelled = true; };
  }, [textureSignature, textureAssets, texturesNeeded, graphics.textures, props.paintTextureOverrides, props.paintTextureRevision, props.paintTextureSmoothing]);

  useEffect(() => { if(runtime.current && runtime.current.appliedView !== view) runtime.current.setView(view); }, [view]);
  useEffect(() => { if (props.cameraAnglesRequest) runtime.current?.setCameraAngles(props.cameraAnglesRequest); }, [props.cameraAnglesRequest]);
  useEffect(() => { runtime.current?.refreshCursor(); }, [cameraMode, transformMode, props.rotationNormals]);
  useEffect(() => { setAdjustingSensitivity(null); }, [props.preferences?.wheelMode]);
  useEffect(() => { const controls = runtime.current?.controls; if (controls) controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(props.preferences?.pointerSensitivity); }, [props.preferences?.pointerSensitivity]);
  useEffect(() => { runtime.current?.resize(); }, [graphics.pixelRatio]);
  useEffect(() => { runtime.current?.scheduler.invalidate(); }, [props.paintOutline, props.paintSelectOnly]);
  useEffect(() => { runtime.current?.scheduler.invalidate(); }, [props.paintLights,props.paintBackground,props.paintSelectedLamp,props.paintLampColor]);
  useEffect(() => { runtime.current?.scheduler.sync(); }, [props.presentation, props.previewMode, props.previewOverlay, model, revision, props.hoveredGeoset, selectedGeoset, selectedVertices, props.selectionByGeoset, props.selectableGeosets, hiddenGeosets, props.hiddenVertices, mode, showSkeleton, showGrid, props.showAxes, props.showVertices, props.overlays, props.showCameras, props.preferences, props.rgbPreview, props.rgbPreviewSequenceIndex, workplane, transformMode, sequenceIndex, time, playing, teamColor, props.suspended, props.paintTextureRevision, props.paintRegion, props.paintColorfy, props.paintPartOutlines, props.paintLights, graphics.maxFps, graphics.pauseWhenHidden, graphics.textures, graphics.lighting]);
  return <div className="viewport" style={{ position: 'relative', width: '100%', height: '100%', minHeight: props.presentation === 'preview' ? 0 : 180, background: '#ccc', overflow: 'hidden' }}>
    <div ref={host} tabIndex={0} aria-label="3D model viewport" style={{ position: 'absolute', inset: 0, outline: 'none', cursor: viewportCursor(cameraMode, transformMode) }} />
    <SensitivityIndicator value={adjustingSensitivity} />
    {textureMessage && <div role="status" style={{ position: 'absolute', bottom: 4, left: 5, color: '#fff0cb', fontSize: 11, pointerEvents: 'none' }}>{textureMessage}</div>}
    {backgroundMessage && <div role="status" style={{ position: 'absolute', top: 4, left: 5, color: '#5b2500', background: '#fff4d6dd', padding: '2px 5px', fontSize: 11, pointerEvents: 'none' }}>{backgroundMessage}</div>}
    {box && <div style={{ position: 'absolute', ...box, border: '1px dotted white', pointerEvents: 'none' }} />}
    {props.paintMode && <div ref={paintCursor} className={'paint-visible-cursor'+(props.paintDecal?' paint-detail-outline':'')} aria-hidden="true" style={{display:'none',position:'absolute',pointerEvents:'none',zIndex:5}}>{props.paintDecal?null:<img src={props.paintBrushPreview} style={{width:'100%',height:'100%',objectFit:'fill',filter:'drop-shadow(0 0 1px #000)'}}/>}</div>}
    {error && <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 30, color: '#300', background: '#ddd', textAlign: 'center', fontSize: 13 }}>{error}</div>}
  </div>;
}
