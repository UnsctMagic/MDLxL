import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { forgeShapeEdges, forgeSelectionCenter, forgeSelectionNormal } from '../src/forge-shape-editing.js';
import { previewLighting, configurePreviewLights, applyPreviewMaterialLighting } from './preview-lighting.js';
import { cameraLeftLight } from './viewport-quality.js';
import { visualOptions } from '../src/preferences.js';

export default function ForgePreview({ geosets = [], image = null, wire = false, checker = false, trimColor = '#cca64d', surfaceColor = '#dddddd', shapeHandle = null, vertexSelection = null, meshEditing = null, initialView = 'front', viewAxes = null, preferences }) {
  const host = useRef(), state = useRef(), drag = useRef();
  const latest = useRef(preferences); latest.current = preferences;
  const editing = useRef(meshEditing); editing.current = meshEditing;
  const pickStart = useRef();
  const startPick = e => {
    if (!meshEditing || e.target.tagName !== 'CANVAS' || e.button !== 0 || state.current?.gizmo.axis) return;
    e.target.focus({ preventScroll: true });
    pickStart.current = [e.clientX, e.clientY];
  };
  const finishPick = e => {
    const start = pickStart.current; pickStart.current = null;
    const s = state.current;
    if (!start || !s || Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 4 || s.gizmo.dragging) return;
    const rect = s.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2), s.camera);
    const hit = ray.intersectObjects(s.group.children.filter(o => o.isMesh && o.userData.shapeId), false)[0];
    if (!hit) { if (!e.shiftKey) meshEditing.onPick(null); return; }
    const shape = meshEditing.shapes.find(shape => shape.id === hit.object.userData.shapeId);
    if (!shape) return;
    let part = hit.object.userData.faceIds[hit.faceIndex];
    if (meshEditing.mode === 'Shape') part = 'shape';
    if (meshEditing.mode === 'Edges') {
      const face = shape.faces.find(f => f.id === part), candidates = [...forgeShapeEdges({ ...shape, faces: [face] })]; let best = Infinity;
      for (const [key, ids] of candidates) {
        const [a, b] = ids.map(id => { const p = new THREE.Vector3(...shape.vertices[id]).project(s.camera); return [rect.left + (p.x + 1) * rect.width / 2, rect.top + (1 - p.y) * rect.height / 2]; });
        const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((e.clientX - a[0]) * dx + (e.clientY - a[1]) * dy) / (dx * dx + dy * dy || 1))), distance = Math.hypot(e.clientX - a[0] - t * dx, e.clientY - a[1] - t * dy);
        if (distance < best) { best = distance; part = key; }
      }
      if (best > 12) return;
    }
    meshEditing.onPick(shape.id, part, e.shiftKey);
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
      direction.setComponent(view === 'side' ? viewAxes.horizontal : viewAxes.depth, 1);
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
  const fit = (view = 'front') => { const s = state.current; if (!s || !s.group.children.length) return; const box = new THREE.Box3().setFromObject(s.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length() || 100, viewState = viewFor(view, box); s.controls.target.copy(center); s.camera.up.copy(viewState.up); s.camera.position.copy(center).addScaledVector(viewState.direction, distanceFor(viewState, box, size)); s.controls.update(); s.render(); };
  useEffect(() => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#182028');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch { return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const camera = new THREE.PerspectiveCamera(38, 1, .01, 10000); camera.up.set(0, 1, 0);
    if (editing.current) renderer.domElement.tabIndex = 0;
    host.current.appendChild(renderer.domElement); const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false;
    const ambient = new THREE.HemisphereLight(0xffffff, 0x505864, 2); scene.add(ambient); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(100, 150, 200); scene.add(light, light.target);
    const group = new THREE.Group(); scene.add(group);
    const pivot = new THREE.Object3D(); scene.add(pivot);
    const gizmo = new TransformControls(camera, renderer.domElement); gizmo.enabled = false; gizmo.setSize(.8); scene.add(gizmo.getHelper());
    const render = () => { const config = previewLighting(latest.current); configurePreviewLights(ambient, light, config); light.position.copy(cameraLeftLight(camera, controls.target, Math.max(1, camera.position.distanceTo(controls.target))).position); light.target.position.copy(controls.target); scene.background.set(visualOptions(latest.current).background); group.traverse(object => { if (object.material) applyPreviewMaterialLighting(object.material, config); }); renderer.render(scene, camera); };
    controls.addEventListener('change', render);
    gizmo.addEventListener('change', render);
    gizmo.addEventListener('dragging-changed', e => { controls.enabled = !e.value; });
    gizmo.addEventListener('mouseDown', () => {
      pickStart.current = null;
      const current = editing.current; if (!current) return;
      state.current.gizmoStart = { center: pivot.position.clone(), quaternion: pivot.quaternion.clone(), tool: current.tool };
      current.onBegin();
    });
    gizmo.addEventListener('objectChange', () => {
      const current = editing.current, start = state.current?.gizmoStart; if (!current || !start) return;
      const delta = pivot.position.clone().sub(start.center);
      current.onTransform({ translation: delta.toArray(), scale: pivot.scale.toArray(), quaternion: pivot.quaternion.clone().multiply(start.quaternion.clone().invert()).toArray(), center: start.center.toArray(), inset: delta.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(start.quaternion)) });
    });
    gizmo.addEventListener('mouseUp', () => { editing.current?.onEnd(); if (state.current) state.current.gizmoStart = null; });
    const cancelGesture = e => {
      if (!gizmo.dragging || e.type === 'keydown' && e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation(); editing.current?.onCancel(); gizmo.reset(); gizmo.pointerUp(null); controls.enabled = true; render();
    };
    window.addEventListener('keydown', cancelGesture, true); renderer.domElement.addEventListener('pointercancel', cancelGesture); window.addEventListener('blur', cancelGesture);
    const element = host.current;
    const observer = new ResizeObserver(() => { if (host.current !== element || !element.isConnected) return; const { width, height } = element.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); render(); }); observer.observe(element);
    state.current = { scene, renderer, camera, controls, group, render, pivot, gizmo, fit: false };
    return () => { window.removeEventListener('keydown', cancelGesture, true); window.removeEventListener('blur', cancelGesture); renderer.domElement.removeEventListener('pointercancel', cancelGesture); observer.disconnect(); controls.dispose(); gizmo.dispose(); group.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); state.current = null; };
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
          const picked = meshEditing.mode === 'Shape' ? selected.length : meshEditing.mode === 'Faces' && selected.includes(faceId), color = shape.id === 0 && image ? new THREE.Color('#ffffff') : picked ? new THREE.Color('#ffc46b') : new THREE.Color().setHSL((.55 + (Math.max(1, shape.id) - 1) * .21) % 1, .38, .52 + (faceId % 3) * .025);
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
  useEffect(() => {
    const s = state.current; if (!s || s.gizmo.dragging) return;
    const current = meshEditing, selected = current && Object.values(current.selection).some(ids => ids.length), faceTool = current && ['Extrude', 'Inset'].includes(current.tool);
    s.gizmo.enabled = !!selected && (!faceTool || current.mode === 'Faces');
    if (!s.gizmo.enabled) { s.gizmo.detach(); s.render(); return; }
    s.pivot.position.fromArray(forgeSelectionCenter(current.shapes, current.selection, current.mode)); s.pivot.scale.set(1, 1, 1); s.pivot.quaternion.identity();
    s.gizmo.setMode(current.tool === 'Scale' ? 'scale' : current.tool === 'Rotate' ? 'rotate' : 'translate'); s.gizmo.setSpace('world'); s.gizmo.showX = s.gizmo.showY = s.gizmo.showZ = true;
    if (current.tool === 'Inset') {
      const normal = new THREE.Vector3(...forgeSelectionNormal(current.shapes, current.selection));
      if (normal.lengthSq() > .1) s.pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      s.gizmo.setSpace('local'); s.gizmo.showY = s.gizmo.showZ = false;
    }
    s.gizmo.attach(s.pivot); s.render();
  }, [meshEditing, geosets]);
  useEffect(() => { state.current?.render(); }, [preferences]);
  return <div ref={host} onPointerDownCapture={e => { pickVertex(e); startPick(e); }} onPointerUpCapture={finishPick} onPointerCancel={() => { pickStart.current = null; }} className="forge-preview-canvas" aria-label="3D mesh preview"><div className="forge-preview-views"><button onClick={() => fit('front')}>Front / fit</button><button onClick={() => fit('side')}>Side</button><button onClick={() => fit('oblique')}>Oblique</button></div>{shapeHandle && <button className="forge-shape-handle" title="Drag to shape" aria-label="Drag to shape" onPointerDown={e => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { y: e.clientY, amount: shapeHandle.amount }; }} onPointerMove={e => { if (drag.current) { e.stopPropagation(); shapeHandle.onChange(drag.current.amount + drag.current.y - e.clientY); } }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); shapeHandle.onChange(shapeHandle.amount + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); } }}>↕</button>}</div>;
}
