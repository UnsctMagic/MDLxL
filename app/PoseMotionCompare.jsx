import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { previewPlaybackStep } from './game-preview-capture.js';
const GamePreview = lazy(() => import('./GamePreview.jsx'));

export default function PoseMotionCompare({ weight, model, revision, sequence, time, playing, speed, onTimeChange, onPlayingChange, cameraHandoff, ...previewProps }) {
  const value = weight.state, camera = useRef({ saved: null, listeners: new Set() });
  const [clock, setClock] = useState({ time, globalTime: time, seekId: 0 });
  const live = useRef(null), emitted = useRef(time), currentClock = useRef(clock);
  live.current = { time, playing, speed, onTimeChange, range: value.range, suspended: previewProps.suspended };
  useLayoutEffect(() => {
    if (Math.abs(time - emitted.current) < .001) return;
    emitted.current = time;
    const next = { time, globalTime: time, seekId: currentClock.current.seekId + 1 };
    currentClock.current = next; setClock(next);
  }, [time]);
  useEffect(() => {
    if (!playing || previewProps.suspended) return;
    let request, previous;
    const step = now => {
      const o = live.current, elapsed = previous == null ? 0 : Math.min(100, now - previous) * o.speed / 100;
      previous = now;
      const current = currentClock.current, next = previewPlaybackStep(o.range, current.time, elapsed, true);
      const updated = { ...current, time: next.frame, globalTime: current.globalTime + next.elapsed };
      // Publish the preview and timeline together. A delayed timeline echo must
      // never be interpreted as a user seek back into an earlier playback tick.
      currentClock.current = updated; emitted.current = next.frame;
      setClock(updated); o.onTimeChange(next.frame);
      request = requestAnimationFrame(step);
    };
    request = requestAnimationFrame(step); return () => cancelAnimationFrame(request);
  }, [playing, previewProps.suspended]);
  const common = { ...previewProps, model, revision, sequenceIndex: sequence, cameraHandoff, compareCamera: camera.current,
    preserveHiddenGeosets: true,
    presentation: 'preview', pixelAligned: true, preserveCameraView: true, cameraMode: 'rotate',
    syncPlayback: true, playbackRunning: playing, playbackGlobalTime: clock.globalTime, seekId: clock.seekId,
    playing: false, time: clock.time, playbackRange: value.range, loop: true, onPlayingChange,
    showGrid: false, showAxes: false, overlays: { grid: false, axes: false, bones: false, nodes: false, sounds: false },
  };
  return <div className="pose-motion-comparison" aria-label="Motion comparison">
    {['left', 'right'].map((side, index) => {
      const id = value[side], item = value.variants[id];
      return <section key={side} className="pose-motion-pane" aria-label={`${index ? 'Right' : 'Left'} motion preview`}>
        <label className="pose-motion-pane-label" title="Choose the original animation or either independent variant">View
          <select aria-label={`${index ? 'Right' : 'Left'} preview animation`} value={id} onChange={event => weight.update({ [side]: event.target.value })}>
            <option value="original">Original</option><option value="A">Variant A</option><option value="B">Variant B</option>
          </select>
          {item?.pending && <span role="status">Updating…</span>}
        </label>
        <Suspense fallback={<div className="classic-empty-view">Loading model preview…</div>}><GamePreview {...common} weightPreview={item?.result || null}/></Suspense>
        {item?.error && <p className="pose-motion-pane-error" role="alert">{item.error}</p>}
      </section>;
    })}
  </div>;
}
