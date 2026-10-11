import { useEffect, useRef, useState } from 'react';
import { applyPoseWeight, buildPoseWeight, preparePoseWeight } from '../src/pose-weight.js';

export default function usePoseWeight(options) {
  const [state, setState] = useState(null), current = useRef(null), latest = useRef(options), worker = useRef(null), queued = useRef(null), serial = useRef(0);
  latest.current = options;
  const publish = next => { current.current = next; setState(next); };
  const calculate = next => {
    try {
      const key = JSON.stringify([next.target, next.range, next.selection]);
      const analysis = next.analysisKey === key ? next.analysis : preparePoseWeight(next.model, next.config, next.target, next.sequence, next.range, next.selection);
      return { ...next, analysis, analysisKey: key, result: buildPoseWeight(analysis, next.mode, next.amount, latest.current.restrictions, next.settings), error: '', pending: false };
    } catch (error) { return { ...next, result: null, error: error.message, pending: false }; }
  };
  const stopWorker = () => { worker.current?.terminate(); worker.current = null; queued.current = null; };
  const send = next => {
    const job = worker.current;
    if (!job) return;
    job.postMessage({ request: next.request, selection: next.selection, mode: next.mode, amount: next.amount, settings: next.settings, restrictions: latest.current.restrictions });
  };
  const schedule = next => {
    next = { ...next, request: ++serial.current, pending: true }; publish(next);
    if (worker.current) { queued.current = next; return; }
    try {
      const job = worker.current = new Worker(new URL('./pose-weight.worker.js', import.meta.url), { type: 'module' });
      const fail = message => { if (worker.current !== job) return; stopWorker(); if (current.current) publish({ ...current.current, result: null, error: message, pending: false }); };
      job.onerror = event => fail(event.message || 'Weight preview failed.');
      job.onmessageerror = () => fail('Weight preview returned unreadable results.');
      job.onmessage = ({ data }) => {
        if (worker.current !== job || !current.current) return;
        if (queued.current) { const next = queued.current; queued.current = null; send(next); return; }
        if (data.request === current.current.request) publish({ ...current.current, result: data.result || null, error: data.error || '', pending: false });
        // Keep sampled motion in this worker between slider changes.
        job.idle = true;
      };
      job.postMessage({ context: { model: next.model, config: next.config, target: next.target, sequence: next.sequence, range: next.range } });
      send(next);
    } catch (error) { stopWorker(); publish({ ...next, result: null, error: error.message, pending: false }); }
  };
  const update = change => {
    if (!current.current) return;
    const next = { ...current.current, ...change };
    if (Object.keys(change).length > 0 && Object.keys(change).every(key => ['vertices', 'compare'].includes(key))) { publish(next); return; }
    if ('range' in change || 'target' in change) { stopWorker(); schedule(next); return; }
    if (worker.current?.idle) {
      worker.current.idle = false;
      const pending = { ...next, request: ++serial.current, pending: true }; publish(pending); send(pending);
    } else schedule(next);
  };
  const finish = (commit = true) => {
    let value = current.current; if (!value) return true;
    const o = latest.current;
    const valid = value.model === o.model && value.revision === o.revision && value.sessionId === o.sessionId;
    if (commit && valid && value.pending) value = calculate(value);
    if (commit && valid && value.error) { stopWorker(); publish(value); return false; }
    if (commit && valid && value.result?.tracks.length) {
      const result = o.onEdit(`POSE Weight: ${value.mode === 'step' ? 'Step' : 'Swing'}`, ['Nodes'], model => applyPoseWeight(model, value.result));
      if (result === false) return false;
    }
    stopWorker(); publish(null); o.onPlayingChange(false); return true;
  };
  const open = () => {
    if (current.current) return finish(false);
    const o = latest.current;
    const range = o.range || o.model.Sequences?.[o.sequence]?.Interval;
    if (!range) return;
    const target = o.config.target?.kind === 'bend' ? { kind: 'endpoint', key: o.config.target.key } : o.config.target;
    const chain = o.config.chains?.find(c => c.key === target?.key);
    const next = { model: o.model, revision: o.revision, sessionId: o.sessionId, config: structuredClone(o.config),
      target, sequence: o.sequence, range: [...range], selection: {}, mode: chain?.kind === 'leg' ? 'step' : 'strike', amount: 100,
      settings: { drag: 65, recoil: 65, body: 45 }, vertices: false, compare: false, result: null, error: '', pending: false };
    o.onPlaybackSpeedChange(100); o.onSeek(range[0]); schedule(next); o.onPlayingChange(true);
    if (target && JSON.stringify(target) !== JSON.stringify(o.config.target)) o.onTargetChange(target);
  };
  const selectTarget = target => {
    if (!current.current) return;
    const value = current.current, chain = value.config.chains.find(c => c.key === target?.key);
    update({ target, config: { ...value.config, target }, selection: {}, vertices: false, mode: chain?.kind === 'leg' ? 'step' : 'strike', settings: { ...value.settings, hit: undefined }, compare: false });
    latest.current.onTargetChange(target);
  };
  useEffect(() => {
    const value = current.current; if (!value) return;
    if (value.model !== options.model || value.revision !== options.revision || value.sessionId !== options.sessionId) { finish(false); return; }
    if (!options.enabled || options.sequence !== value.sequence) { finish(); return; }
    if (JSON.stringify(options.config.target) !== JSON.stringify(value.target)) {
      if (options.config.target && options.config.target.kind !== 'bend') selectTarget(options.config.target);
      return;
    }
  }, [options.enabled, options.model, options.revision, options.sessionId, options.sequence, JSON.stringify(options.config.target)]);
  useEffect(() => { if (current.current) update({}); }, [JSON.stringify(options.restrictions)]);
  useEffect(() => {
    if (!state) return;
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(false); } };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [!!state]);
  useEffect(() => () => stopWorker(), []);
  return { state, open, update, finish, selectTarget, playing: options.playing,
    play: () => { const o = latest.current; if (!o.playing) o.onSeek(current.current.range[0]); o.onPlayingChange(!o.playing); },
    markHit: () => { const o = latest.current; o.onPlayingChange(false); update({ settings: { ...current.current.settings, hit: Math.round(o.time) } }); },
    cancel: () => finish(false) };
}
