import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFrameCoalescer, createRenderScheduler } from '../app/viewport-performance.js';
import { beginRotationDrag, rotationDragDegrees } from '../src/rotation-drag.js';
import { uvTurn } from '../src/uv-tools.js';

function manualFrames() {
  let next = 1, now = 0; const queued = new Map();
  return {
    request: callback => { const id = next++; queued.set(id, callback); return id; },
    cancel: id => { queued.delete(id); },
    run() { now += 1000 / 60; const callbacks = [...queued.values()]; queued.clear(); for (const callback of callbacks) callback(now); },
    get size() { return queued.size; },
  };
}

test('many pointer events in one frame run the drag work once', () => {
  const frames = manualFrames(); let runs = 0;
  const coalescer = createFrameCoalescer(() => { runs++; }, frames);
  for (let i = 0; i < 20; i++) coalescer.schedule();
  assert.equal(frames.size, 1);
  assert.equal(runs, 0);
  frames.run();
  assert.equal(runs, 1);
  coalescer.schedule(); frames.run();
  assert.equal(runs, 2);
});

test('pointer up flushes the pending move; cancel drops it', () => {
  const frames = manualFrames(); let runs = 0;
  const coalescer = createFrameCoalescer(() => { runs++; }, frames);
  coalescer.flush();
  assert.equal(runs, 0, 'nothing pending, nothing runs');
  coalescer.schedule(); coalescer.flush();
  assert.equal(runs, 1); assert.equal(frames.size, 0); assert.equal(coalescer.pending, false);
  coalescer.schedule(); coalescer.cancel(); frames.run();
  assert.equal(runs, 1);
});

test('drag work queued on a 3D view is drawn in the same frame, not the next one', () => {
  const frames = manualFrames(), order = [];
  const scheduler = createRenderScheduler({ render: () => { order.push('draw'); }, continuous: () => false, paused: () => false, maxFps: () => 0, request: frames.request, cancel: frames.cancel });
  frames.run(); order.length = 0;
  const drag = createFrameCoalescer(() => { order.push('drag'); scheduler.invalidate(); }, scheduler.frames);
  drag.schedule(); drag.schedule();
  frames.run();
  assert.deepEqual(order, ['drag', 'draw'], 'one drag step, then the draw that shows it');
  frames.run(); frames.run();
  assert.deepEqual(order, ['drag', 'draw'], 'no extra draw afterwards');
  drag.schedule(); drag.flush(); frames.run();
  assert.deepEqual(order, ['drag', 'draw', 'drag', 'draw'], 'pointer up applies at once and still draws');
});

// Pivot turns sum wrapped angle steps. Fed every pointer sample they follow a fast
// spin; sampled only once per frame, a step past 180° wraps and turns backwards.
test('a fast pivot turn keeps its direction when every sample feeds the angle', () => {
  const pivot = { x: 0, y: 0 }, radius = 100, at = degrees => ({ x: Math.cos(degrees * Math.PI / 180) * radius, y: Math.sin(degrees * Math.PI / 180) * radius });
  const start = at(0), samples = Array.from({ length: 8 }, (_, i) => at((i + 1) * 30)); // 240° in one frame
  const everySample = beginRotationDrag({ x: start.x, y: start.y, pivot, behavior: 'pivot' });
  for (const point of samples) rotationDragDegrees(everySample, point.x - start.x, point.y - start.y);
  const last = samples.at(-1), total = rotationDragDegrees(everySample, last.x - start.x, last.y - start.y);
  assert.ok(Math.abs(Math.abs(total) - 240) < 1e-6, `turned ${total}°`);
  const frameOnly = beginRotationDrag({ x: start.x, y: start.y, pivot, behavior: 'pivot' });
  assert.ok(Math.abs(Math.abs(rotationDragDegrees(frameOnly, last.x - start.x, last.y - start.y)) - 120) < 1e-6, 'one sample per frame wraps to the short way round');
  const uv = { pivotScreen: [0, 0] }; uvTurn(uv, start.x, start.y);
  for (const point of samples) uvTurn(uv, point.x, point.y);
  assert.ok(Math.abs(uvTurn(uv, last.x, last.y) - 240 * Math.PI / 180) < 1e-6, 'UV turn follows every sample');
});

// Every handler that feeds a turn does it in the per-event code, before scheduling.
for (const { name, file, from, feed } of [
  { name: 'Vertex rotate', file: 'app/Viewport.jsx', from: 'if (!state.drag) return;', feed: 'rotationDragDegrees(state.drag.rotationDrag' },
  { name: 'UV rotate', file: 'app/UVEditor.jsx', from: 'function pointerMove(event)', feed: 'uvTurn(s.drag' },
  { name: 'Preview bone and POSE rotate', file: 'app/GamePreview.jsx', from: 'if (nodeGesture.adjusted) return;', feed: 'movementRotationAmount(nodeGesture.rotationDrag, turnX, turnY)' },
  { name: 'Showcase text rotate', file: 'app/ShowcaseLayers.jsx', from: 'function move(event){', feed: 'rotationDragDegrees(row.rotationDrag' },
]) test(`${name} feeds every sample to the turn`, () => {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf(from), body = source.slice(start, source.indexOf('.schedule()', start));
  assert.ok(start >= 0 && body.includes(feed), `${feed} runs before the frame is scheduled`);
});

// Live drags must not redraw, rebuild previews or lift state on every pointer
// event. Each listed per-event code path only records the point and schedules
// a frame; `forbidden` is the expensive work that moved into the frame callback.
const coalescedDrags = [
  { name: 'UV Wrapper drag', file: 'app/UVEditor.jsx', from: 'function pointerMove(event)', to: 'function applyMove()', forbidden: /\bdraw\(|onPreviewChange|restrictUVChange/ },
  { name: 'Vertex move/rotate/scale', file: 'app/Viewport.jsx', from: 'if (!state.drag) return;', to: 'function applyTransformMove()', forbidden: /onTransformPreview|updateWideWireGeometry|computeBoundingSphere/ },
  { name: 'Viewport camera report', file: 'app/Viewport.jsx', from: 'const invalidate = () => {', to: 'const markerTexture', forbidden: /onCameraAnglesChange|setCompassAxes/ },
  { name: 'Paint camera report', file: 'app/PaintViewport.jsx', from: 'const invalidate = () => {', to: 'const markerTexture', forbidden: /onCameraAnglesChange/ },
  { name: 'Game preview camera report', file: 'app/GamePreview.jsx', from: 'const cameraChanged = () => {', to: 'invalidate();', forbidden: /onCameraAnglesChange/ },
  { name: 'Movable window drag', file: 'app/useMovableWindow.js', from: 'onPointerMove:', to: 'onPointerUp:', forbidden: /setPosition|getBoundingClientRect/ },
  { name: 'Timeline scrub', file: 'app/KeyframeTimeline.jsx', from: 'const move = pointer => {', to: 'const end = pointer =>', forbidden: /\bseek\(/ },
  { name: 'Viewport hover', file: 'app/Viewport.jsx', from: 'hoverMove = { event:', to: "if (down.action === 'sketch')", forbidden: /hoverParts\(|inspectHoveredGeoset\(/ },
  { name: 'Forge part drags', file: 'app/Viewport.jsx', from: "if (down.action === 'parts') {", to: "if (down.action === 'normalizer')", forbidden: /\.update\(/ },
  { name: 'Zoom anchor marquee', file: 'app/Viewport.jsx', from: "if (down.action === 'anchor') {", to: "if (down.action === 'zoom')", forbidden: /anchorVertexInMarquee|showBox|setBox/ },
  { name: 'AI sketch line', file: 'app/viewport-sketch.js', from: 'stroke.onSurface.push(hit.surface);', to: 'const lineFrame', forbidden: /lineFor\(|dispose\(/ },
  { name: 'Preview bone and POSE drag', file: 'app/GamePreview.jsx', from: 'nodeMove = { gesture: nodeGesture', to: 'const applyNodeMove', forbidden: /applyMovementTransform|previewPoseGesture\(nodeGesture|setGestureLabel/ },
  { name: 'Preview marquee', file: 'app/GamePreview.jsx', from: 'if (selectionGesture?.id === event.pointerId) {\n        const rect', to: 'event.preventDefault(); event.stopImmediatePropagation(); return;', forbidden: /setSelectionBox/ },
  { name: 'Preview hover', file: 'app/GamePreview.jsx', from: 'const hoverGeoset = event =>', to: 'const leaveGeoset', forbidden: /projectPreviewGeosets|onHoverGeoset/ },
  { name: 'Glow Up handle drag', file: 'app/GlowStageTools.jsx', from: 'function move(event)', to: 'function applyMove()', forbidden: /\bset\(|onChange|next\(/ },
  { name: 'Auto Corpse piece drag', file: 'app/CorpseStageTools.jsx', from: 'function move(event)', to: 'function applyMove()', forbidden: /\bset\(|onChange|next\(/ },
  { name: 'EMTR emitter handle drag', file: 'app/ParticleStageTools.jsx', from: 'function move(event)', to: 'function applyMove()', forbidden: /\bchange\(|onSizeDraft/ },
  { name: 'EMTR halfway marker drag', file: 'app/ParticleLifeMarker.jsx', from: 'onPointerMove={', to: 'onPointerUp={end}', forbidden: /\bchange\(/ },
  { name: 'EMTR placement ghost drag', file: 'app/ParticlePlacementStage.jsx', from: 'onPointerMove={', to: 'onPointerUp={stop}', forbidden: /onPosition/ },
  { name: 'EMTR ribbon diamond drag', file: 'app/ParticleKeyTrack.jsx', from: 'const move=event=>', to: 'const applyMove=', forbidden: /setDraft|onScrub|frameAt|getBoundingClientRect/ },
  { name: 'AnimXL strip drag', file: 'app/AnimXL.jsx', from: 'const stripMove = event => {', to: 'stripApply.current = () => {', forbidden: /\bupdate\(|setSettings|setTime|setDraft|stripTime/ },
  { name: 'Showcase layer drag', file: 'app/ShowcaseLayers.jsx', from: 'function move(event){', to: 'function applyMove(){', forbidden: /onChange|scaleTextRuns/ },
  { name: 'Showcase crop drag', file: 'app/ShowcaseWorkspace.jsx', from: 'function moveCrop(event) {', to: 'function applyCropMove() {', forbidden: /setCrop|cropBetween|getBoundingClientRect/ },
  { name: 'Collision shape drag (Managers, Sphereomancer)', file: 'app/CollisionOverlay.jsx', from: 'const drag = event => {', to: 'function applyDrag() {', forbidden: /structuredClone|previewDraft|setDraft|moveCollision|resizeCollision/ },
  { name: 'UV splitters', file: 'app/UVWorkspace.jsx', from: 'onPointerMove={event => { if (pointer.current === event.pointerId) {', to: 'onPointerUp={stop}', forbidden: /onPointerValue|report\.current\(/ },
  { name: 'AI console resize', file: 'app/AiAssistant.jsx', from: 'const move = moveEvent => {', to: 'const end = () => {', forbidden: /setWidth/ },
  { name: 'Geoset list resize', file: 'app/GeosetListBox.jsx', from: 'onPointerMove={event => {', to: 'onPointerUp={stop}', forbidden: /setHeight/ },
  { name: 'Emitter text hover help', file: 'app/EmitterTextDialog.jsx', from: 'const hover=event=>{', to: 'const leave=', forbidden: /setTip|getComputedStyle|measureText|getBoundingClientRect/ },
  { name: 'Paint lamp drag', file: 'app/PaintViewport.jsx', from: "if(down.action==='paintLamp'){down.pendingLamp=", to: 'dragFrame.schedule();return;}', forbidden: /onPaintLampChange|paintLampDrag|invalidate\(/ },
  { name: 'Paint face sweep', file: 'app/PaintViewport.jsx', from: "if (down.action === 'paintPick') { if(latest.current.paintSelectFaces){", to: 'dragFrame.schedule();} return; }', forbidden: /paintHit|onPaintPick/ },
  { name: 'Paint texture rectangle mask and UV draft', file: 'app/PaintTextureCanvas.jsx', from: 'if(drag.paint){onMove(hit(e));return;}drag.pending=p;', to: 'dragFrame.current.schedule();', forbidden: /onMask|combineSelection|shapeSelection|setDraft/ },
  { name: 'Paint cutout crop, lasso and polygon hover', file: 'app/PaintCutoutEditor.jsx', from: "const pointer=point(event);if(tool==='polygon'){hover.current=pointer;", to: 'current.redraw=true;dragFrame.current.schedule();', forbidden: /setHoverPoint|setCrop|setMask|cropMask|setPoints/ },
  { name: 'Paint view divider', file: 'app/PaintStudioLayout.jsx', from: 'onPointerMove={e=>{if(e.buttons===1){splitDrag.current=', to: 'splitFrame.current.schedule();}}}', forbidden: /onSplit|getBoundingClientRect/ },
  { name: 'Paint image zoom drag', file: 'app/usePaintImageNavigation.js', from: "if(p.type==='zoom'){p.clientY", to: 'zoomFrame.current.schedule();}', forbidden: /setZoom|getBoundingClientRect/ },
  { name: 'Forge image mask drag', file: 'app/Forge.jsx', from: 'const move = e => {', to: 'applyMove.current = () => {', forbidden: /setPan|setZoom|setPoints|cropContour|polygonMask|onSelected/ },
];

for (const { name, file, from, to, forbidden } of coalescedDrags) test(`${name} waits for the next frame`, () => {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf(from);
  assert.ok(start >= 0, `${from} found in ${file}`);
  const stop = source.indexOf(to, start + from.length);
  assert.ok(stop > start, `${to} found after ${from}`);
  const body = source.slice(start, stop + to.length);
  assert.match(source, /createFrameCoalescer\(/);
  assert.match(body, /\.schedule\(\)/);
  assert.doesNotMatch(body, forbidden, 'expensive work runs per pointer event');
});
