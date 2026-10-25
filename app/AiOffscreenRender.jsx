import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
const GamePreview = lazy(() => import('./GamePreview.jsx'));

// AI pictures of a model, drawn in a hidden preview of their own. The view, camera
// and frame on screen never move, and a model whose tab is not showing can still be
// looked at. One picture at a time; each gets a fresh preview so nothing carries over.
const WIDTH = 768,
  HEIGHT = 576;
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
          const entry = { ...spec, id: crypto.randomUUID(), resolve, reject };
          // A preview that never gets ready must not hold up the AI forever.
          entry.timer = setTimeout(() => finish(entry, Error('The off-screen picture could not be drawn.')), 30000);
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
      await api.whenReady();
      // Fit the model, then look from the requested side (fit keeps the preset view).
      api.fit();
      await new Promise(requestAnimationFrame);
      finish(entry, null, api.captureView().toDataURL('image/png'));
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
