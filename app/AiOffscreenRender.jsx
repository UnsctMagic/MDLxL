import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
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
export default function AiOffscreenRender({ onReady, preferences, teamColor }) {
  const [job, setJob] = useState(null),
    queue = useRef([]),
    current = useRef(null);
  const next = useCallback(() => {
    current.current = queue.current.shift() || null;
    setJob(current.current);
  }, []);
  useEffect(() => {
    onReady({
      render: spec =>
        new Promise((resolve, reject) => {
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
      // Fit the model, or the close-up points, then look from the requested side
      // (fit keeps the preset view). captureView draws right away: waiting for the
      // next screen refresh would stall while the window is covered or minimized.
      api.fit(entry.focus);
      const image = api.captureView();
      drawMarks(image, api, entry.marks);
      finish(entry, null, image.toDataURL('image/png'));
    } catch (error) {
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
        <GamePreview
          key={job.id}
          presentation="preview"
          model={job.model}
          revision={job.revision || 0}
          textureAssets={job.assets}
          modelPath={job.path}
          preferences={previewPreferences}
          teamColor={teamColor}
          sequenceIndex={job.sequence ?? -1}
          globalSeqId={job.globalSequence ?? null}
          time={job.frame || 0}
          playing={false}
          showGrid={false}
          mode={job.renderMode || 'textured'}
          view={job.view || 'perspective'}
          hiddenGeosets={job.hiddenGeosets}
          overlays={{ bones: false, nodes: false, particles: false, attachments: false }}
          onCaptureReady={ready}
        />
      </Suspense>
    </div>
  );
}
