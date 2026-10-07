import React, { useEffect, useMemo, useRef, useState } from 'react';
import GamePreview from './GamePreview.jsx';
import { previewPlaybackStep } from './game-preview-capture.js';
import { condenseExactResources, sortMyMessProposals, applySortMyMessProposal } from '../src/sort-my-mess.js';
import './sort-my-mess.css';

const titles = { rgb: 'Different RGB', team: 'Team color', render: 'Different rendering' };

export default function SortMyMess({ doc, modelPath, textureAssets, preferences, teamColor, sequenceIndex, frame, onCommit, onClose }) {
  const [original] = useState(() => structuredClone(doc.model));
  const [draft, setDraft] = useState(() => { const copy = structuredClone(original); condenseExactResources(copy); return copy; });
  const [ignored, setIgnored] = useState(new Set()), [optionId, setOptionId] = useState(null), [error, setError] = useState('');
  const [sequence, setSequence] = useState(original.Sequences[sequenceIndex] ? sequenceIndex : original.Sequences.length ? 0 : -1);
  const interval = original.Sequences[sequence]?.Interval || [0, 1000];
  const [clock, setClock] = useState(() => { const time = Math.min(interval[1], Math.max(interval[0], frame || interval[0])); return { time, globalTime: time, seekId: 0 }; }), [playing, setPlaying] = useState(false);
  const { time, globalTime, seekId } = clock;
  const seek = time => setClock(current => ({ time, globalTime: time, seekId: current.seekId + 1 }));
  const camera = useRef({ saved: null, listeners: new Set() }), root = useRef(null);
  const proposals = useMemo(() => sortMyMessProposals(draft).filter(item => !ignored.has(item.id)), [draft, ignored]);
  const proposal = proposals[0], option = proposal?.options.find(item => item.id === optionId) || proposal?.options[0];
  const preview = useMemo(() => {
    if (!proposal) return draft;
    const copy = structuredClone(draft); applySortMyMessProposal(copy, proposal, option.id); return copy;
  }, [draft, proposal, option]);
  const ids = proposal?.geosetIds || original.Geosets.map((_, i) => i);
  const hidden = useMemo(() => new Set(original.Geosets.flatMap((_, i) => ids.includes(i) ? [] : [i])), [original, ids.join(',')]);
  const previewPreferences = useMemo(() => ({ ...preferences, wheelMode: 'rotate' }), [preferences]);
  useEffect(() => { const previous = document.activeElement; root.current?.focus(); return () => previous?.focus?.(); }, []);
  useEffect(() => {
    if (!playing) return;
    let request, previous;
    const step = now => { const delta = previous == null ? 0 : Math.min(100, now - previous); previous = now; setClock(current => { const next = previewPlaybackStep(interval, current.time, delta); return { ...current, time: next.frame, globalTime: current.globalTime + next.elapsed }; }); request = requestAnimationFrame(step); };
    request = requestAnimationFrame(step); return () => cancelAnimationFrame(request);
  }, [playing, interval[0], interval[1]]);
  const decide = accept => {
    setError('');
    if (!accept) setIgnored(previous => new Set([...previous, proposal.id]));
    else setDraft(preview);
    setOptionId(null);
  };
  const commit = () => {
    try { if (JSON.stringify(original) !== JSON.stringify(draft) && onCommit(draft) === false) { setError('No change applied.'); return; } onClose(); }
    catch (cause) { setError(cause.message); }
  };
  const keys = event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const controls = [...root.current.querySelectorAll('button:not(:disabled),select,input')].filter(element => element.getClientRects().length);
      if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === root.current)) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  };
  const common = { textureAssets, modelPath, preferences: previewPreferences, teamColor, presentation: 'preview', sequenceIndex: sequence, time, seekId, playing: false, syncPlayback: true, playbackRunning: playing, playbackGlobalTime: globalTime, cameraMode: 'rotate', compareCamera: camera.current, preserveCameraView: true, showGrid: false, showAxes: false, showParticles: false, isolatedGeosets: ids, hiddenGeosets: hidden };
  const savedMaterials = original.Materials.length - draft.Materials.length, savedTextures = original.Textures.length - draft.Textures.length;
  return <div className="smm-overlay" onKeyDown={keys}>
    <section className="smm-window" role="dialog" aria-modal="true" aria-label="Sort My Mess" tabIndex={-1} ref={root}>
      <header><strong>Sort My Mess</strong><button aria-label="Close Sort My Mess" onClick={onClose}>×</button></header>
      <div className="smm-question"><strong>{proposal ? titles[proposal.kind] : 'All done'}</strong><span>{proposal ? `${ids.length} geoset${ids.length === 1 ? '' : 's'}` : `${savedMaterials} duplicate / merged materials · ${savedTextures} duplicate textures removed`}</span></div>
      <div className="smm-previews">
        <section aria-label="Before preview"><h2>Before</h2><GamePreview {...common} model={original}/></section>
        <section aria-label="After preview"><h2>After</h2><GamePreview {...common} model={preview}/></section>
      </div>
      {sequence >= 0 && <div className="smm-playback"><button aria-label={playing ? 'Pause comparison' : 'Play comparison'} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause' : 'Play'}</button><select aria-label="Comparison animation" value={sequence} onChange={event => { const next = Number(event.target.value); setSequence(next); seek(original.Sequences[next].Interval[0]); }}>{original.Sequences.map((item, i) => <option key={i} value={i}>{item.Name}</option>)}</select><input type="range" aria-label="Comparison frame" min={interval[0]} max={interval[1]} value={time} onChange={event => { setPlaying(false); seek(Number(event.target.value)); }}/></div>}
      {proposal && proposal.kind !== 'rgb' && <div className="smm-options" role="group" aria-label="Merge direction">{proposal.options.map(item => <button key={item.id} aria-pressed={item.id === option.id} onClick={() => setOptionId(item.id)}>{item.label}</button>)}</div>}
      <footer><span role="status">{error}</span>{proposal ? <><button onClick={() => decide(false)}>Ignore</button><button className="smm-accept" onClick={() => decide(true)}>{proposal.kind === 'rgb' ? 'Choose most similar RGB' : 'Merge & next'}</button></> : <button className="smm-accept" onClick={commit}>Done</button>}</footer>
    </section>
  </div>;
}
