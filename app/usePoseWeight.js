import { useEffect, useRef, useState } from 'react';
import { applyPoseMotion, buildPoseMotion, preparePoseMotion } from '../src/pose-motion.js';

const defaults = () => ({ style: 'flow', timing: 65, follow: 35, body: 35, contacts: true });
const variant = () => ({ settings: defaults(), result: null, error: '', pending: false, request: 0 });

export default function usePoseWeight(options) {
  const [state, setState] = useState(null), current = useRef(null), latest = useRef(options);
  const worker = useRef(null), queued = useRef(new Map()), busy = useRef(false), serial = useRef(0);
  latest.current = options;
  const publish = next => {
    const value = next ? { ...next, ...next.variants[next.editing] } : null;
    current.current = value; setState(value);
  };
  const stopWorker = () => { worker.current?.terminate(); worker.current = null; queued.current.clear(); busy.current = false; };
  const pump = () => {
    if (busy.current || !worker.current || !queued.current.size) return;
    const [id, request] = queued.current.entries().next().value;
    queued.current.delete(id); busy.current = true; worker.current.postMessage(request);
  };
  const schedule = (next, ids = [next.editing]) => {
    const variants = { ...next.variants };
    for (const id of ids) {
      const value = variants[id] = { ...variants[id], request: ++serial.current, pending: true, error: '' };
      queued.current.set(id, { variant: id, request: value.request, settings: value.settings, restrictions: latest.current.restrictions });
    }
    publish({ ...next, variants });
    try {
      if (!worker.current) {
        const job = worker.current = new Worker(new URL('./pose-weight.worker.js', import.meta.url), { type: 'module' });
        const fail = message => {
          if (worker.current !== job) return;
          stopWorker(); const value = current.current;
          if (value) publish({ ...value, variants: Object.fromEntries(Object.entries(value.variants).map(([id, item]) => [id, { ...item, pending: false, result: null, error: message }])) });
        };
        job.onerror = event => fail(event.message || 'Motion preview failed.');
        job.onmessageerror = () => fail('Motion preview returned unreadable results.');
        job.onmessage = ({ data }) => {
          if (worker.current !== job || !current.current) return;
          busy.current = false;
          const value = current.current, item = value.variants[data.variant];
          if (item?.request === data.request) publish({ ...value, variants: { ...value.variants, [data.variant]: { ...item, result: data.result || null, error: data.error || '', pending: false } } });
          pump();
        };
        job.postMessage({ context: { model: next.model, config: next.config, sequence: next.sequence, range: next.range } });
      }
      pump();
    } catch (error) {
      stopWorker(); const value = current.current;
      publish({ ...value, variants: Object.fromEntries(Object.entries(value.variants).map(([id, item]) => [id, { ...item, result: null, error: error.message, pending: false }])) });
    }
  };
  const update = change => {
    const value = current.current; if (!value) return;
    const next = { ...value, ...change, variants: { ...value.variants } };
    if (change.settings) next.variants[value.editing] = { ...value.variants[value.editing], settings: change.settings };
    if (change.range) {
      stopWorker();
      for (const id of ['A', 'B']) next.variants[id] = { ...next.variants[id], result: null, settings: { ...next.variants[id].settings, hit: undefined, anchors: undefined } };
      schedule(next, ['A', 'B']);
    } else if (change.settings) schedule(next);
    else publish(next);
  };
  // Leaving the preview never writes keys. Only the explicit Commit button does.
  const finish = () => {
    if (!current.current) return true;
    stopWorker(); publish(null); latest.current.onPlayingChange(false); return true;
  };
  const commit = () => {
    const value = current.current, o = latest.current;
    if (!value) return false;
    if (value.model !== o.model || value.revision !== o.revision || value.sessionId !== o.sessionId || value.sequence !== o.sequence) { finish(); return false; }
    let result = value.result;
    try {
      if (value.pending) result = buildPoseMotion(preparePoseMotion(value.model, value.config, value.sequence, value.range), value.settings, o.restrictions);
      if (value.error || !result?.tracks.length) return false;
      if (o.onEdit(`Motion ${value.editing}: ${value.settings.style}`, ['Nodes'], model => applyPoseMotion(model, result)) === false) return false;
      finish(); return true;
    } catch (error) {
      publish({ ...value, variants: { ...value.variants, [value.editing]: { ...value.variants[value.editing], error: error.message, pending: false } } }); return false;
    }
  };
  const open = () => {
    if (current.current) return finish();
    const o = latest.current, range = o.range || o.model.Sequences?.[o.sequence]?.Interval;
    if (!range) return;
    const next = { model: o.model, revision: o.revision, sessionId: o.sessionId, config: structuredClone(o.config), sequence: o.sequence,
      range: [...range], variants: { A: variant(), B: variant() }, editing: 'A', compare: false, sideBySide: false, left: 'original', right: 'A' };
    o.onSeek(range[0]); schedule(next, ['A', 'B']); o.onPlayingChange(true);
  };
  const copy = () => {
    const value = current.current; if (!value) return;
    const into = value.editing === 'A' ? 'B' : 'A';
    const next = { ...value, variants: { ...value.variants, [into]: { ...value.variants[into], settings: structuredClone(value.settings) } } };
    schedule(next, [into]);
  };
  useEffect(() => {
    const value = current.current;
    if (value && (value.model !== options.model || value.revision !== options.revision || value.sessionId !== options.sessionId || !options.enabled || options.sequence !== value.sequence)) finish();
  }, [options.enabled, options.model, options.revision, options.sessionId, options.sequence]);
  useEffect(() => { if (current.current) schedule(current.current, ['A', 'B']); }, [JSON.stringify(options.restrictions)]);
  useEffect(() => {
    if (!state) return;
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(); } };
    window.addEventListener('keydown', escape, true); return () => window.removeEventListener('keydown', escape, true);
  }, [!!state]);
  useEffect(() => () => stopWorker(), []);
  return { state, open, update, finish, commit, copy, playing: options.playing, speed: options.playbackSpeed,
    setSpeed: value => latest.current.onPlaybackSpeedChange(value),
    seek: frame => { latest.current.onPlayingChange(false); latest.current.onSeek(frame); },
    keepPose: () => { const value = current.current; if (!value) return; const frame = Math.max(value.range[0], Math.min(value.range[1], Math.round(latest.current.time))); update({ settings: { ...value.settings, anchors: [...new Set([...(value.result?.anchors || value.range), frame])].sort((a, b) => a - b) } }); },
    play: () => { const o = latest.current; if (!current.current) return; if (o.time < current.current.range[0] || o.time >= current.current.range[1]) o.onSeek(current.current.range[0]); o.onPlayingChange(!o.playing); },
    markHit: () => { const o = latest.current; o.onPlayingChange(false); update({ settings: { ...current.current.settings, hit: Math.max(current.current.range[0], Math.min(current.current.range[1], Math.round(o.time))) } }); },
    cancel: finish };
}
