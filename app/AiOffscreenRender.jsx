import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { aiPictureProps, frameExactly } from '../src/ai-picture.js';
import { PORTRAIT_ASPECT } from '../src/portrait-view.js';
const GamePreview = lazy(() => import('./GamePreview.jsx'));

// AI pictures of a model, drawn in a hidden preview of their own. The view, camera
// and frame on screen never move, and a model whose tab is not showing can still be
// looked at. One picture at a time; each gets a fresh preview so nothing carries over.
const WIDTH = 768,
  HEIGHT = 576;
// The task's marked vertices and Marker/Pen notes drawn over the picture, as the
// modeling viewport shows them: red marked vertices, pen lines and wide marker bands.
function drawMarks(canvas, api, marks) {
  if (!marks || !api.project) return;
  const context = canvas.getContext('2d'),
    scale = canvas.width / WIDTH;
  context.save();
  context.lineCap = context.lineJoin = 'round';
  for (const stroke of marks.strokes || []) {
    const screen = api.project(stroke.points);
    context.strokeStyle = stroke.color;
    context.globalAlpha = stroke.tool === 'marker' ? 0.5 : 1;
    context.lineWidth = (stroke.tool === 'marker' ? 14 : 3.2) * scale;
    context.beginPath();
    for (let i = 0; i < screen.length; i += 3) context[i ? 'lineTo' : 'moveTo'](screen[i], screen[i + 1]);
    if (screen.length === 3) context.lineTo(screen[0] + 0.1, screen[1]);
    context.stroke();
  }
  // Motion trails: the path, a small dot per sampled frame (spacing shows speed), big dots on
  // key frames, a ring where the node is in this frame and the trail's number at its start.
  for (const trail of marks.trails || []) {
    const path = api.project(trail.points),
      keys = api.project(trail.keys),
      dot = (x, y, r) => (context.beginPath(), context.arc(x, y, r, 0, Math.PI * 2));
    context.globalAlpha = 1;
    for (const [style, width] of [['rgba(0,0,0,0.55)', 4], [trail.color, 2]]) {
      context.strokeStyle = style;
      context.lineWidth = width * scale;
      context.beginPath();
      let open = false;
      for (let i = 0; i < path.length; i += 3) {
        if (!path[i + 2]) { open = false; continue; }
        context[open ? 'lineTo' : 'moveTo'](path[i], path[i + 1]);
        open = true;
      }
      context.stroke();
    }
    context.fillStyle = trail.color;
    for (let i = 0; i < path.length; i += 3) if (path[i + 2]) (dot(path[i], path[i + 1], 1.8 * scale), context.fill());
    context.lineWidth = 1.5 * scale;
    context.strokeStyle = '#000000';
    for (let i = 0; i < keys.length; i += 3) if (keys[i + 2]) (dot(keys[i], keys[i + 1], 4.5 * scale), context.fill(), context.stroke());
    if (trail.now) {
      const [x, y, front] = api.project(trail.now);
      if (front) {
        context.lineWidth = 2.5 * scale;
        context.strokeStyle = trail.color;
        dot(x, y, 8 * scale);
        context.stroke();
      }
    }
    if (path[2]) {
      context.font = `bold ${16 * scale}px Tahoma, sans-serif`;
      context.lineWidth = 3 * scale;
      context.strokeStyle = '#000000';
      context.strokeText(String(trail.number), path[0] + 7 * scale, path[1] - 7 * scale);
      context.fillStyle = trail.color;
      context.fillText(String(trail.number), path[0] + 7 * scale, path[1] - 7 * scale);
    }
  }
  if (marks.vertices?.length) {
    const screen = api.project(marks.vertices),
      size = 4 * scale;
    context.globalAlpha = 1;
    context.fillStyle = '#ff2020';
    for (let i = 0; i < screen.length; i += 3)
      if (screen[i + 2]) context.fillRect(screen[i] - size / 2, screen[i + 1] - size / 2, size, size);
  }
  context.restore();
}
// The middle of a camera picture in the in-game portrait's shape: same height, portrait width.
function portraitCrop(source) {
  const width = Math.round(source.height * PORTRAIT_ASPECT),
    canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, (source.width - width) / 2, 0, width, source.height, 0, 0, width, source.height);
  return canvas;
}
export default function AiOffscreenRender({ onReady, preferences, teamColor }) {
  const [job, setJob] = useState(null),
    queue = useRef([]),
    current = useRef(null),
    teamColorNow = useRef(teamColor);
  teamColorNow.current = teamColor;
  const next = useCallback(() => {
    current.current = queue.current.shift() || null;
    setJob(current.current);
  }, []);
  useEffect(() => {
    onReady({
      render: spec =>
        // UV pictures draw team colour the way these pictures do: ask without drawing.
        spec.query === 'teamColor' ? Promise.resolve(teamColorNow.current) : new Promise((resolve, reject) => {
          const entry = { ...spec, id: crypto.randomUUID(), resolve, reject, stage: 'loading the model' };
          // A preview that never gets ready must not hold up the AI forever. Say
          // where it stopped, and any error the hidden preview shows.
          entry.timer = setTimeout(() => {
            const shown = document.querySelector('.ai-offscreen-render [role=alert]')?.textContent?.trim();
            finish(entry, Error(`The off-screen picture could not be drawn: it was still ${entry.stage} after 30 seconds.${shown ? ' ' + shown : ''}`));
          }, 30000);
          queue.current.push(entry);
          if (!current.current) next();
        }),
    });
    return () => {
      onReady(null);
      for (const entry of [current.current, ...queue.current]) entry && finish(entry, Error('The editor closed.'));
    };
  }, []);
  function finish(entry, error, image) {
    if (entry.done) return;
    entry.done = true;
    clearTimeout(entry.timer);
    error ? entry.reject(error) : entry.resolve(image);
    if (current.current === entry) next();
    else queue.current = queue.current.filter(item => item !== entry);
  }
  const ready = useCallback(async api => {
    const entry = current.current;
    if (!api || !entry || entry.started) return;
    entry.started = true;
    try {
      entry.stage = 'loading textures and effects';
      await api.whenReady();
      entry.stage = 'drawing';
      // Frame the posed points exactly (centred, the same share of every view), then
      // zoom about their centre. captureView draws right away: waiting for the next
      // screen refresh would stall while the window is covered or minimized.
      // A model camera picture keeps the camera's own view.
      const camera = Number.isInteger(entry.camera);
      if (!camera) frameExactly(api, entry.focus, { zoom: entry.zoom });
      let image = api.captureView();
      drawMarks(image, api, entry.marks);
      if (camera) image = portraitCrop(image);
      const url = image.toDataURL('image/png');
      finish(entry, null, entry.notes?.length ? { image: url, notes: entry.notes } : url);
    } catch (error) {
      // An effect over the preview's live-particle budget still gets its picture, without effects.
      if (entry.particles !== false && /particle budget/.test(error.message)) {
        Object.assign(entry, { particles: false, started: false, id: crypto.randomUUID(), notes: [...(entry.notes || []), 'no particles or ribbons: their replay went over the preview budget'] });
        setJob({ ...entry });
        return;
      }
      finish(entry, error);
    }
  }, []);
  if (!job) return null;
  const previewPreferences = { ...preferences, graphics: { ...preferences.graphics, pauseWhenHidden: false } };
  return (
    <div
      className="ai-offscreen-render"
      aria-hidden="true"
      style={{ position: 'fixed', left: -10000 - WIDTH, top: 0, width: WIDTH, height: HEIGHT, pointerEvents: 'none' }}
    >
      <Suspense fallback={null}>
        <GamePreview key={job.id} {...aiPictureProps(job, { preferences: previewPreferences, teamColor })} onCaptureReady={ready} />
      </Suspense>
    </div>
  );
}
