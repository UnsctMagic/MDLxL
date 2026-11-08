/** The Settings preview: one SVG, one requestAnimationFrame loop, nothing focusable. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cursorFade, gestureAt, runLoop } from './clock.js';
import { previewLook } from './palette.js';
import { previewEntry, previewScene } from './registry.js';
import { STAGE } from './tracks.js';

const REDUCE = '(prefers-reduced-motion: reduce)';
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia(REDUCE).matches;

/** Fits the stage into the element: the subject scales, HUD parts keep their size. */
export function previewView(width, height) {
  const k = Math.min(width / STAGE.width, height / STAGE.height), left = 8, top = 7;
  return { width, height, k, u: 1 / k, x: (width - STAGE.width * k) / 2, y: (height - STAGE.height * k) / 2, left, top, right: width - left, bottom: height - top };
}

/** One frame of a scene, for the component and for tests and contact sheets alike. */
export function renderSceneFrame({ scene, entry, value, track, phase, preferences, width = STAGE.width, height = STAGE.height, look = previewLook(preferences) }) {
  const view = previewView(width, height), ctx = { look, u: view.u };
  const at = track?.frames ? Math.round(gestureAt(phase) * (track.frames.length - 1)) : 0;
  const { stage, hud } = scene.draw({ value, focus: entry.focus, options: entry.options, track, at, phase, ctx, view, preferences, fade: cursorFade(phase) });
  return <>
    <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>{stage}</g>
    <g>{hud}</g>
  </>;
}

function useElementSize(ref) {
  const [size, setSize] = useState([STAGE.width, STAGE.height]);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== 'function') return undefined;
    // The content box, so the border never scales the scene.
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width >= 40 && height >= 40) setSize(previous => previous[0] === width && previous[1] === height ? previous : [width, height]);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/**
 * `target` is a registry key (see useSettingsPreviewTarget); `restart` replays the
 * demo when it changes. `editor` is the Rotation page's "Apply to" choice.
 */
export function SettingsPreview({ preferences, target, restart = 0, editor = 'all', className = '' }) {
  const element = useRef(null), [width, height] = useElementSize(element);
  const entry = useMemo(() => previewEntry(target), [target]), scene = entry && previewScene(entry.scene);
  const look = useMemo(() => previewLook(preferences), [preferences]);
  const valueJson = useMemo(() => entry ? JSON.stringify(scene.read(preferences, entry, { editor })) : '', [preferences, entry, scene, editor]);
  const value = useMemo(() => entry ? JSON.parse(valueJson) : null, [valueJson, entry]);
  const track = useMemo(() => entry && scene.track ? scene.track(value, entry.focus, entry.options) : null, [entry, scene, value]);
  const duration = entry && scene.duration ? scene.duration(entry.focus, value) || 0 : 0, animated = duration > 0, runKey = `${target}|${restart}|${valueJson}`;
  const [clock, setClock] = useState({ key: null, phase: 1 });
  useEffect(() => {
    if (!animated || reducedMotion()) return undefined;
    return runLoop({ duration, request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id), doc: document, onPhase: phase => setClock({ key: runKey, phase }) });
  }, [animated, duration, runKey]);
  if (!entry) return null;
  // Before this run's first tick: its start, or the final frame when motion is off.
  const phase = !animated || reducedMotion() ? 1 : clock.key === runKey ? clock.phase : 0;
  return <svg ref={element} className={`settings-preview-scene ${className}`.trim()} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={scene.label} focusable="false" style={{ backgroundColor: look.stage }}>
    {renderSceneFrame({ scene, entry, value, track, phase, preferences, width, height, look })}
  </svg>;
}
