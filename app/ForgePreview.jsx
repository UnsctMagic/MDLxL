import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EditorCameraControls, preserveShiftCameraAction } from './editor-camera-controls.js';
import { forgeShapeEdges, forgeSelectionCenter, forgeSelectionNormal } from '../src/forge-shape-editing.js';
import { screenPlaneTranslation } from './viewport-math.js';
import { bindScrollSensitivity, pointerSensitivityValue } from './viewport-performance.js';
import { previewLighting, configurePreviewLights, applyPreviewMaterialLighting } from './preview-lighting.js';
import { cameraLeftLight } from './viewport-quality.js';
import { visualOptions, cameraBindings } from '../src/preferences.js';

export const forgeShapeColor = id => ['#a9b6c1', '#8caca8', '#b9aa94', '#939bb5', '#b499a6', '#9eac8b'][(Math.max(1, id) - 1) % 6];

export default function ForgePreview({ geosets = [], image = null, wire = false, checker = false, trimColor = '#cca64d', surfaceColor = '#dddddd', shapeHandle = null, vertexSelection = null, meshEditing = null, initialView = 'front', viewAxes = null, preferences }) {
  const host = useRef(), state = useRef(), drag = useRef();
  const latest = useRef(preferences); latest.current = preferences;
  const editing = useRef(meshEditing); editing.current = meshEditing;
  const meshDrag = useRef();
  const pickPart = (e, s, current) => {
    const rect = s.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), s.camera);
    const hit = ray.intersectObjects(s.group.children.filter(o => o.isMesh && o.userData.shapeId), false)[0];
    if (!hit) return;
    const shape = current.shapes.find(shape => shape.id === hit.object.userData.shapeId);
    if (!shape) return;
    let part = hit.object.userData.faceIds[hit.faceIndex], mode = 'Faces';
    if (!['Extrude', 'Inset'].includes(current.tool)) {
      const face = shape.faces.find(f => f.id === part), candidates = [...forgeShapeEdges({ ...shape, faces: [face] })]; let best = Infinity;
      let edge;
      for (const [key, ids] of candidates) {
        const [a, b] = ids.map(id => { const p = new THREE.Vector3(...shape.vertices[id]).project(s.camera); return [rect.left + (p.x + 1) * rect.width / 2, rect.top + (1 - p.y) * rect.height / 2]; });
        const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((e.clientX - a[0]) * dx + (e.clientY - a[1]) * dy) / (dx * dx + dy * dy || 1))), distance = Math.hypot(e.clientX - a[0] - t * dx, e.clientY - a[1] - t * dy);
        if (distance < best) { best = distance; edge = key; }
      }
      if (best < 7) { part = edge; mode = 'Edges'; }
    }
    return { id: shape.id, part, mode };
  };
  const pickVertex = e => {
    if (!vertexSelection?.picking || e.target.tagName !== 'CANVAS' || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const s = state.current; if (!s) return; const rect = s.renderer.domElement.getBoundingClientRect(), point = new THREE.Vector3(); let best = null;
    geosets.forEach((g, gi) => { for (let id = 0; id < g.Vertices.length / 3; id++) { point.fromArray(g.Vertices, id * 3).project(s.camera); if (point.z < -1 || point.z > 1) continue; const x = rect.left + (point.x + 1) * rect.width / 2, y = rect.top + (1 - point.y) * rect.height / 2, distance = Math.hypot(x - e.clientX, y - e.clientY); if (distance < 12 && (!best || distance < best.distance - .01 || Math.abs(distance - best.distance) < .01 && point.z < best.z)) best = { gi, id, distance, z: point.z }; } });
    if (best) vertexSelection.onPick(best.gi, best.id, e.shiftKey);
  };
  const viewFor = (view, box) => {
    if (viewAxes) {
      const direction = new THREE.Vector3(), up = new THREE.Vector3().setComponent(viewAxes.vertical, 1);
      direction.setComponent(view === 'side' ? viewAxes.horizontal : viewAxes.depth, view === 'side' ? 1 : viewAxes.depthSign ?? 1);
      if (view === 'oblique') { direction.setComponent(viewAxes.horizontal, .35); direction.setComponent(viewAxes.vertical, .55); }
      return { direction: direction.normalize(), up, fitted: true };
    }
    if (view === 'largest') {
      const size = box.getSize(new THREE.Vector3());
      const axis = [[size.y * size.z, 'x'], [size.x * size.z, 'y'], [size.x * size.y, 'z']].sort((a, b) => b[0] - a[0])[0][1];
      if (axis === 'x') return { direction: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, size.y >= size.z ? 0 : 1, size.y >= size.z ? 1 : 0), fitted: true };
      if (axis === 'y') return { direction: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(size.x >= size.z ? 0 : 1, 0, size.x >= size.z ? 1 : 0), fitted: true };
      return { direction: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(size.x >= size.y ? 0 : 1, size.x >= size.y ? 1 : 0, 0), fitted: true };
    }
    return { direction: view === 'side' ? new THREE.Vector3(1, 0, 0) : view === 'oblique' ? new THREE.Vector3(.7, .45, 1).normalize() : new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
  };
  const distanceFor = (viewState, box, fallback) => {
    if (!viewState.fitted) return fallback * 1.7;
    const size = box.getSize(new THREE.Vector3()), rect = host.current?.getBoundingClientRect(), aspect = Math.max(.1, rect?.width / Math.max(1, rect?.height) || 1), tangent = Math.tan(THREE.MathUtils.degToRad(38 / 2));
    const span = axis => Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;
    const right = new THREE.Vector3().crossVectors(viewState.direction, viewState.up).normalize();
    return span(viewState.direction) / 2 + Math.max(span(right) / (2 * tangent * aspect), span(viewState.up) / (2 * tangent)) * 1.15;
  };
  const fit = (view = 'front') => { const s = state.current; if (!s || !s.group.children.length) return; const box = new THREE.Box3().setFromObject(s.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 100, viewState = viewFor(view, box); s.controls.target.copy(center); s.camera.up.copy(viewState.up); s.camera.zoom = 1; s.camera.updateProjectionMatrix(); s.camera.position.copy(center).addScaledVector(viewState.direction, distanceFor(viewState, box, size)); s.controls.update(); s.render(); };
  useEffect(() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#182028');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 10000); camera.up.set(0, 1, 0);
    if (editing.current) renderer.domElement.tabIndex = 0;
    host.current.appendChild(renderer.domElement); const controls = new EditorCameraControls(camera, renderer.domElement); controls.enableDamping = false;
    const ambient = new THREE.HemisphereLight(0xffffff, 0x505864, 2); scene.add(ambient); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(100, 150, 200); scene.add(light, light.target);
    const group = new THREE.Group(); scene.add(group);
    const render = () => { const config = previewLighting(latest.current); configurePreviewLights(ambient, light, config); light.position.copy(cameraLeftLight(camera, controls.target, Math.max(1, camera.position.distanceTo(controls.target))).position); light.target.position.copy(controls.target); scene.background.set(visualOptions(latest.current).background); group.traverse(object => { if (object.material) applyPreviewMaterialLighting(object.material, config); }); renderer.render(scene, camera); };
    controls.addEventListener('change', render);
    state.current = { scene, renderer, camera, controls, group, render, fit: false, rotateMode: false };
    const finishGesture = (e, canceled = false) => {
      const start = meshDrag.current; if (!start) return;
      meshDrag.current = null;
      if (!start.pickOnly) {
        if (canceled) editing.current?.onCancel(); else editing.current?.onEnd();
        if (!canceled && !start.moved && start.whole) editing.current?.onPick(start.hit.id, start.hit.part, false, start.hit.mode);
      }
      if (renderer.domElement.hasPointerCapture(start.pointerId)) renderer.domElement.releasePointerCapture(start.pointerId);
      controls.enabled = true; e.preventDefault?.(); e.stopImmediatePropagation?.();
    };
    const cancelGesture = e => { if (e.type !== 'keydown' || e.key === 'Escape') finishGesture(e, true); };
    const unbindScroll = bindScrollSensitivity(renderer.domElement, { getPreferences: () => latest.current, onWheel: (event, value) => { controls.zoomSpeed = value; }, onCameraModeToggle: () => { state.current.rotateMode = !state.current.rotateMode; renderer.domElement.style.cursor = state.current.rotateMode ? 'grab' : 'default'; }, onPointerAdjustment: event => finishGesture(event, true) });
    const pointerDown = e => {
      if (meshDrag.current) return;
      const current = editing.current, binding = cameraBindings(latest.current), action = value => value === 'rotate' ? THREE.MOUSE.ROTATE : value === 'pan' ? THREE.MOUSE.PAN : value === 'zoom' ? THREE.MOUSE.DOLLY : null;
      controls.enabled = true; controls.rotateSpeed = controls.panSpeed = pointerSensitivityValue(latest.current?.pointerSensitivity) * (e.shiftKey ? latest.current?.fineSensitivity ?? .2 : 1);
      controls.mouseButtons.RIGHT = preserveShiftCameraAction(action(binding.right), e); controls.mouseButtons.MIDDLE = preserveShiftCameraAction(action(binding.middle), e); controls.mouseButtons.LEFT = preserveShiftCameraAction(THREE.MOUSE.ROTATE, e);
      if (!current || e.button !== 0 || e.altKey || state.current.rotateMode) return;
      const hit = pickPart(e, state.current, current); if (!hit) return;
      renderer.domElement.focus({ preventScroll: true }); controls.enabled = false; e.preventDefault(); e.stopImmediatePropagation();
      const whole = !e.shiftKey && current.mode === 'Shape' && current.selection[hit.id]?.length && !['Extrude', 'Inset'].includes(current.tool), keep = !e.shiftKey && current.mode === hit.mode && current.selection[hit.id]?.includes(hit.part);
      const selected = whole || keep ? current : current.onPick(hit.id, hit.part, e.shiftKey, hit.mode);
      const center = new THREE.Vector3(...forgeSelectionCenter(selected.shapes, selected.selection, selected.mode)), normal = new THREE.Vector3(...forgeSelectionNormal(selected.shapes, selected.selection));
      meshDrag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, center, normal, hit, whole, pickOnly: e.shiftKey, moved: false, tool: current.tool, sensitivity: controls.rotateSpeed };
      renderer.domElement.setPointerCapture(e.pointerId); if (!e.shiftKey) current.onBegin();
    };
    const pointerMove = e => {
      const start = meshDrag.current; if (!start || start.pickOnly) return;
      const dx = (e.clientX - start.x) * start.sensitivity, dy = (e.clientY - start.y) * start.sensitivity;
      if (!start.moved && Math.hypot(dx, dy) < 3) return; start.moved = true;
      const rect = renderer.domElement.getBoundingClientRect(), values = { center: start.center.toArray() }, units = screenPlaneTranslation(camera, start.center, rect.width, rect.height, 0, -1).length();
      if (start.tool === 'Move') values.translation = screenPlaneTranslation(camera, start.center, rect.width, rect.height, dx, dy).toArray();
      if (start.tool === 'Scale') values.scale = [1, 1, 1].map(() => Math.exp((dx - dy) / 100));
      if (start.tool === 'Rotate') values.quaternion = new THREE.Quaternion().setFromAxisAngle(camera.getWorldDirection(new THREE.Vector3()).negate(), (dx - dy) * Math.PI / 180).toArray();
      if (start.tool === 'Inset') values.inset = (dx - dy) * units / 4;
      if (start.tool === 'Extrude') {
        const a = start.center.clone().project(camera), b = start.center.clone().add(start.normal).project(camera), ax = (b.x - a.x) * rect.width / 2, ay = -(b.y - a.y) * rect.height / 2, length = ax * ax + ay * ay;
        const amount = length * units * units > .05 ? (dx * ax + dy * ay) / length : (dx - dy) * units;
        values.translation = start.normal.clone().multiplyScalar(amount).toArray();
      }
      editing.current?.onTransform(values); e.preventDefault(); e.stopImmediatePropagation();
    };
    const pointerUp = e => finishGesture(e), contextMenu = e => e.preventDefault();
    renderer.domElement.addEventListener('pointerdown', pointerDown, true); renderer.domElement.addEventListener('pointermove', pointerMove, true); renderer.domElement.addEventListener('pointerup', pointerUp, true); renderer.domElement.addEventListener('pointercancel', cancelGesture); renderer.domElement.addEventListener('contextmenu', contextMenu);
    window.addEventListener('keydown', cancelGesture, true); window.addEventListener('blur', cancelGesture);
    const element = host.current;
    const observer = new ResizeObserver(() => { if (host.current !== element || !element.isConnected) return; const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); render(); }); observer.observe(element);
    return () => { window.removeEventListener('keydown', cancelGesture, true); window.removeEventListener('blur', cancelGesture); unbindScroll(); renderer.domElement.removeEventListener('pointerdown', pointerDown, true); renderer.domElement.removeEventListener('pointermove', pointerMove, true); renderer.domElement.removeEventListener('pointerup', pointerUp, true); renderer.domElement.removeEventListener('pointercancel', cancelGesture); renderer.domElement.removeEventListener('contextmenu', contextMenu); observer.disconnect(); controls.dispose(); group.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); state.current = null; };
  }, []);
  useEffect(() => {
    const s = state.current; if (!s) return;
    for (const child of [...s.group.children]) { child.geometry?.dispose(); child.material?.map?.dispose(); child.material?.dispose(); s.group.remove(child); }
    let map = null;
    if (checker) {
      const w = 64, h = Math.max(8, Math.round(64 * (image ? image.height / image.width : 1))), data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [44, 111, 163, 255] : [238, 239, 219, 255], (y * w + x) * 4);
      map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); map.wrapS = map.wrapT = THREE.RepeatWrapping;
    } else if (image) map = new THREE.DataTexture(new Uint8Array(image.data), image.width, image.height, THREE.RGBAFormat);
    if (map) { map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.anisotropy = Math.min(8, s.renderer.capabilities.getMaxAnisotropy()); map.needsUpdate = true; }
    geosets.forEach((g, i) => {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(g.Vertices, 3)); geometry.setAttribute('normal', new THREE.BufferAttribute(g.Normals, 3)); if (g.TVertices?.[0]) geometry.setAttribute('uv', new THREE.BufferAttribute(g.TVertices[0], 2)); geometry.setIndex(new THREE.BufferAttribute(g.Faces, 1));
      const entry = meshEditing?.entries[i], shape = entry?.shape;
      if (shape) {
        const selected = meshEditing.selection[shape.id] || [], colors = [];
        for (const faceId of entry.faceIds) {
          const picked = meshEditing.mode === 'Shape' ? selected.length : meshEditing.mode === 'Faces' && selected.includes(faceId), color = shape.id === 0 && image ? new THREE.Color('#ffffff') : picked ? new THREE.Color('#ffc46b') : new THREE.Color(forgeShapeColor(shape.id)).offsetHSL(0, 0, (faceId % 3) * .025);
          for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
      }
      const ghost = shape?.id === 0 && meshEditing.shapes.length > 0;
      const material = new THREE.MeshPhongMaterial({ map: shape ? checker || shape.id === 0 ? map : null : i === 0 || checker ? map : null, color: ghost ? '#bac2c8' : shape || checker ? '#ffffff' : i === 0 ? map ? '#ffffff' : surfaceColor : trimColor, vertexColors: !!shape, flatShading: !!shape, transparent: ghost, opacity: ghost ? .45 : 1, depthWrite: !ghost, side: THREE.DoubleSide, alphaTest: .1, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const object = new THREE.Mesh(geometry, material); if (shape) object.userData = { shapeId: shape.id, faceIds: entry.faceIds }; s.group.add(object);
      if (shape) {
        const edges = [], selectedEdges = [], selected = meshEditing.selection[shape.id] || [];
        for (const [key, ids] of forgeShapeEdges(shape)) {
          const picked = meshEditing.mode === 'Shape' ? selected.length : meshEditing.mode === 'Edges' ? selected.includes(key) : shape.faces.some(f => selected.includes(f.id) && ids.every(id => f.vertices.includes(id)));
          (picked ? selectedEdges : edges).push(...ids.flatMap(id => shape.vertices[id]));
        }
        for (const [points, color, opacity] of [[edges, '#182934', .75], [selectedEdges, '#ffe391', 1]]) if (points.length) s.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
      }
      if (wire) { const wires = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xccedff, transparent: true, opacity: .58 })); s.group.add(wires); }
      if (vertexSelection) {
        const points = ids => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(ids.flatMap(id => Array.from(g.Vertices.slice(id * 3, id * 3 + 3))), 3));
        if (vertexSelection.picking) s.group.add(new THREE.Points(points(Array.from({ length: g.Vertices.length / 3 }, (_, id) => id)), new THREE.PointsMaterial({ color: '#89d8ff', size: 4, sizeAttenuation: false, depthTest: false })));
        const ids = vertexSelection.byGeoset[i] || []; if (ids.length) s.group.add(new THREE.Points(points(ids), new THREE.PointsMaterial({ color: '#ffb951', size: 7, sizeAttenuation: false, depthTest: false })));
      }
    });
    if (vertexSelection?.origin) s.group.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertexSelection.origin, 3)), new THREE.PointsMaterial({ color: '#fff278', size: 12, sizeAttenuation: false, depthTest: false })));
    if (geosets.length) {
      const box = new THREE.Box3().setFromObject(s.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 100;
      s.camera.near = Math.max(.001, size / 1000); s.camera.far = size * 100; s.camera.updateProjectionMatrix();
      if (!s.fit) { const viewState = viewFor(initialView, box); s.controls.target.copy(center); s.camera.up.copy(viewState.up); s.camera.position.copy(center).addScaledVector(viewState.direction, distanceFor(viewState, box, size)); s.controls.update(); s.fit = true; }
    }
    s.render();
  }, [geosets, image, wire, checker, trimColor, surfaceColor, initialView, vertexSelection, meshEditing]);
  useEffect(() => { state.current?.render(); }, [preferences]);
  return <div ref={host} onPointerDownCapture={pickVertex} className="forge-preview-canvas" aria-label="3D mesh preview"><div className="forge-preview-views"><button onClick={() => fit('front')}>Front / fit</button><button onClick={() => fit('side')}>Side</button><button onClick={() => fit('oblique')}>Oblique</button></div>{shapeHandle && <button className="forge-shape-handle" title="Drag to shape" aria-label="Drag to shape" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, amount: shapeHandle.amount }; }} onPointerMove={e => { if (drag.current) { e.stopPropagation(); shapeHandle.onChange(drag.current.amount + drag.current.y - e.clientY); } }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); shapeHandle.onChange(shapeHandle.amount + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); } }}>↕</button>}</div>;
}
